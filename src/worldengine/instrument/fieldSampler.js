// src/worldengine/instrument/fieldSampler.js
// Non-visual analysis channel — LIVE FIELD READBACK (nonvisual-analysis-channel-2026-07-24, AC-SAMPLE).
//
// The ONE module in the instrument that touches the GPU. Everything it depends on for geometry and
// units (sampling.js) and for measurement (descriptors.js, stats.js) is THREE-free and headlessly
// tested; this file is the thin glue that gets real numbers out of the live shader.
//
// MECHANISM (research Family B — AOV readback). It does not build a second readback path: it reuses
// `createHeightSampler` from planet-lod-rivers.js, the same float-RTT point-cloud readback the river
// router has used against the live height field since AC4. That sampler binds the SAME `uniforms`
// object the planet material consumes, so what we measure is what the planet is actually rendering —
// the live preset, the live dials, the live radius — not a re-derivation that could drift.
//
// READ-ONLY. It pins uOctaves during the read (a fixed high LOD, so a measurement never depends on
// where the camera happens to be) and restores every uniform it touched. It writes no field, adds no
// feature card, and changes nothing about the rendered frame.
//
// WHY EVERY RESULT CARRIES TWO FRAMES: see the header of sampling.js. Briefly — a form held constant
// on screen is not constant in km, so a single "form size" number is ambiguous by construction. Each
// sample is therefore described in the PHYSICAL frame (km on the real body) and the ANGULAR frame
// (degrees of arc, which times the disc scale is what the eye sees). Reports quote both.
//
// ══ THE VERTICAL AXIS IS NOT CALIBRATED IN KM, AND THIS MODULE REFUSES TO PRETEND OTHERWISE ══
//
// Found while verifying AC-SAMPLE against the live lab (2026-07-24), and it is load-bearing enough
// to state at the top of the file:
//
//   HORIZONTAL distance IS calibrated. It comes from sphere geometry — angular separation times the
//   body's real radius — so wavelengths, crater diameters, drainage lengths and boundary lengths are
//   genuinely in km. Trust them.
//
//   VERTICAL height is NOT. The lab's relief is SHADED, NOT DISPLACED (planet-lod-lab.html:1544): the
//   height field drives a normal perturbation, it is never geometry. Its amplitudes are dimensionless
//   artistic values — e.g. deriveUniforms sets mountainAmp = clamp01(mix(0.25, 0.6, 1-erosion)) *
//   rockyCrust, which has no km in it anywhere. The km-named state knobs (mountainHeightKm = 9,
//   craterDepthKm = 2) exist and were intended to feed reliefAmplitudeFromKm * K, but the live write
//   at planet-lod-lab.html:6127 uses state.mountainAmp directly. On top of that the relief envelope
//   (uPerturb = perturb * reliefEnvelope(R, g)) is applied at SHADING time, downstream of the field
//   this module samples.
//
// Multiplying the sampled field by radius*6371 therefore produces a confident, wrong number: it
// reported ~488 km RMS relief and +/-1700 km elevation for an Earth-like world, which is ~200x too
// large. Reporting that would have been worse than reporting nothing — a fake physical number is
// exactly the failure mode this instrument exists to prevent.
//
// So: vertical quantities are reported in HEIGHT UNITS by default and clearly labelled as such. Pass
// an explicit `kmPerUnit` if a calibration is ever established, and only then do km appear.
//
// WHAT SURVIVES UNCALIBRATED (most of the census, as it happens):
//   valid as-is  — every wavelength, crater SFD, drainage/boundary density (horizontal only);
//                  hypsometric integral (a ratio, scale-invariant); band count; spectral slope
//                  (vertical scaling moves the intercept, not the slope).
//   units-only   — RMS relief, absolute elevation range.
//   needs kmPerUnit — slope in degrees (it divides a vertical by a horizontal, so it is meaningless
//                  as an angle until the vertical has a unit). Reported as gradient in units/km until then.

import { createHeightSampler } from '../../../planet-lod-rivers.js';
import {
  equirectDirections, patchDirections,
  physicalGrid, angularGrid, physicalPatchGrid, angularPatchGrid,
} from './sampling.js';
import {
  rmsReliefKm, hypsometricIntegral, slopeStats, radialPSD, autocorrWavelengthKm, spectralExcessPeak,
  bandCount, distributionMoments, areaWeights, totalAreaKm2,
} from './descriptors.js';

/**
 * @param renderer  the lab's THREE.WebGLRenderer
 * @param uniforms  the LIVE uniform object shared with the planet material
 * @param octavesDuringRead  LOD pinned during readback; 9 matches the river router's choice, so the
 *        instrument and the router see the same field rather than two different levels of detail.
 */
export function createFieldSampler({ renderer, uniforms, octavesDuringRead = 9 }) {
  const cache = new Map();   // key -> { sampler, dirs } ; height samplers own a geometry + render target

  function samplerFor(key, dirs) {
    let entry = cache.get(key);
    if (!entry) {
      entry = { sampler: createHeightSampler({ renderer, uniforms, verts: dirs, octavesDuringRead }), dirs };
      cache.set(key, entry);
    }
    return entry;
  }

  /**
   * Whole-sphere sample. Returns raw height in shader units AND in km, plus the two grids the
   * descriptors read. Default 256x128 is a compromise: fine enough to resolve continental-scale form,
   * cheap enough to run M seeds x N radii without the sweep becoming an overnight job.
   */
  function sampleEquirect({ width = 256, height = 128, radiusEarth, kmPerUnit = null } = {}) {
    if (!(radiusEarth > 0)) throw new Error('sampleEquirect: radiusEarth is required (physical units depend on it)');
    const key = `eq:${width}x${height}`;
    const dirs = cache.has(key) ? cache.get(key).dirs : equirectDirections(width, height);
    const { sampler } = samplerFor(key, dirs);
    const { height: hUnits, grad } = sampler.read();
    return {
      kind: 'equirect', width, height, radiusEarth,
      heightUnits: hUnits, grad, dirs,
      // Vertical calibration is opt-in and absent by default — see the header. null means "this field
      // has no km meaning on the height axis", which is the truth for the lab as it stands.
      kmPerUnit,
      heightVertical: verticalAxis(hUnits, kmPerUnit),
      grids: { physical: physicalGrid(width, height, radiusEarth), angular: angularGrid(width, height) },
    };
  }

  /**
   * Km-window sample centred on a lat/lon. This is the mode that answers "how big are the forms" —
   * the patch is a flat, periodic-friendly window, which is what makes the FFT well-posed (a global
   * equirect FFT would measure the latitude seam, not the terrain).
   */
  function samplePatch({ latDeg = 0, lonDeg = 0, spanKm = 2000, width = 128, height = 128, radiusEarth, kmPerUnit = null } = {}) {
    if (!(radiusEarth > 0)) throw new Error('samplePatch: radiusEarth is required (physical units depend on it)');
    const key = `patch:${latDeg},${lonDeg},${spanKm},${width}x${height},${radiusEarth}`;
    const dirs = cache.has(key)
      ? cache.get(key).dirs
      : patchDirections({ latDeg, lonDeg, spanKmX: spanKm, spanKmY: spanKm, radiusEarth, width, height });
    const { sampler } = samplerFor(key, dirs);
    const { height: hUnits, grad } = sampler.read();
    return {
      kind: 'patch', width, height, radiusEarth, latDeg, lonDeg, spanKm,
      heightUnits: hUnits, grad, dirs, kmPerUnit,
      heightVertical: verticalAxis(hUnits, kmPerUnit),
      grids: {
        physical: physicalPatchGrid(width, height, spanKm, spanKm),
        angular: angularPatchGrid(width, height, spanKm, spanKm, radiusEarth),
      },
    };
  }

  function dispose() {
    for (const { sampler } of cache.values()) sampler.dispose();
    cache.clear();
  }

  return { sampleEquirect, samplePatch, dispose, get cacheSize() { return cache.size; } };
}

/**
 * Run the descriptor pack over a sample, in BOTH frames.
 *
 * Elevation descriptors (RMS relief, hypsometry, slope) are frame-independent in the sense that they
 * are about the height axis, which is always km — but the SLOPE couples height to horizontal distance,
 * so it genuinely differs between frames and is reported per frame. Wavelengths are reported per frame
 * because that is the whole point of having frames.
 */
export function describeSample(sample) {
  const cal = sample.kmPerUnit;
  const vertUnit = cal ? 'km' : 'height-units';
  const out = {
    kind: sample.kind, radiusEarth: sample.radiusEarth,
    verticalCalibrated: !!cal, verticalUnit: vertUnit,
    physical: {}, angular: {},
  };
  // The height array used for measurement: raw units unless an explicit calibration was supplied.
  const h = sample.heightVertical;

  for (const frame of ['physical', 'angular']) {
    const grid = sample.grids[frame];
    const d = out[frame];
    d.horizontalUnit = frame === 'physical' ? 'km' : 'deg';
    d.verticalUnit = vertUnit;

    // ── valid regardless of vertical calibration ──────────────────────────────────────────────
    d.hypsometricIntegral = hypsometricIntegral(h, grid);        // a ratio: scale-invariant
    d.autocorrWavelength = autocorrWavelengthKm(h, grid);        // horizontal only
    d.totalArea = totalAreaKm2(grid);
    if (sample.kind === 'patch') {
      // THE form-size number. Not the most energetic bin — on red-noise terrain that is always the
      // window size and never moves (see spectralExcessPeak's header). This is the peak EXCESS over
      // the field's own power-law background, i.e. the scale at which there is an actual population
      // of forms rather than just roughness.
      const peak = spectralExcessPeak(h, grid);
      d.formWavelength = peak.wavelength;                        // horizontal only: km / deg by frame
      d.formExcessRatio = peak.excessRatio;                      // 1.0 = no band-limited population at all
      d.formDetected = peak.detected;
      d.spectralSlope = peak.spectralSlope;                      // vertical scaling moves the intercept, not the slope
      d.rawDominantWavelength = radialPSD(h, grid).dominantWavelengthKm;   // kept for comparison; expect ~= window size
    }
    if (sample.kind === 'equirect') d.bandCount = bandCount(h, grid).bands;

    // ── vertical-dependent: reported in whatever unit the vertical actually has ────────────────
    d.rmsRelief = rmsReliefKm(h, grid);
    const s = slopeStats(h, grid);
    d.slopeExcludedFraction = s.excludedFraction;
    if (cal) {
      d.meanSlopeDeg = s.meanDeg; d.medianSlopeDeg = s.medianDeg; d.p90SlopeDeg = s.p90Deg;
    } else {
      // atan() of a units-per-km ratio is not an angle until the vertical has a unit. Report the
      // gradient itself, and say so, rather than emitting a degree figure that means nothing.
      d.meanGradientUnitsPerHorizontal = Math.tan((s.meanDeg * Math.PI) / 180);
      d.p90GradientUnitsPerHorizontal = Math.tan((s.p90Deg * Math.PI) / 180);
      d.slopeNote = 'gradient in height-units per horizontal unit; not an angle until kmPerUnit is supplied';
    }
  }

  const w = areaWeights(sample.grids.physical);
  const m = distributionMoments(h, w);
  out.elevation = { mean: m.mean, sd: m.sd, min: m.min, max: m.max, skew: m.skew, unit: vertUnit };
  if (!cal) {
    out.verticalNote =
      'The lab relief is shaded, not displaced, and its amplitudes are dimensionless (see fieldSampler.js header). '
      + 'Vertical figures are height-units. Horizontal figures (wavelengths, densities, diameters) ARE real km.';
  }
  return out;
}

/** Apply an optional vertical calibration; returns the raw units array when there is none. */
function verticalAxis(hUnits, kmPerUnit) {
  if (!(kmPerUnit > 0)) return hUnits;
  const out = new Float64Array(hUnits.length);
  for (let i = 0; i < hUnits.length; i++) out[i] = hUnits[i] * kmPerUnit;
  return out;
}
