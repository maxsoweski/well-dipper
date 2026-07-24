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

import { createHeightSampler } from '../../../planet-lod-rivers.js';
import {
  equirectDirections, patchDirections, heightUnitsToKm,
  physicalGrid, angularGrid, physicalPatchGrid, angularPatchGrid,
} from './sampling.js';
import {
  rmsReliefKm, hypsometricIntegral, slopeStats, radialPSD, autocorrWavelengthKm,
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
  function sampleEquirect({ width = 256, height = 128, radiusEarth } = {}) {
    if (!(radiusEarth > 0)) throw new Error('sampleEquirect: radiusEarth is required (physical units depend on it)');
    const key = `eq:${width}x${height}`;
    const dirs = cache.has(key) ? cache.get(key).dirs : equirectDirections(width, height);
    const { sampler } = samplerFor(key, dirs);
    const { height: hUnits, grad } = sampler.read();
    const heightKm = new Float64Array(hUnits.length);
    for (let i = 0; i < hUnits.length; i++) heightKm[i] = heightUnitsToKm(hUnits[i], radiusEarth);
    return {
      kind: 'equirect', width, height, radiusEarth,
      heightUnits: hUnits, heightKm, grad, dirs,
      grids: { physical: physicalGrid(width, height, radiusEarth), angular: angularGrid(width, height) },
    };
  }

  /**
   * Km-window sample centred on a lat/lon. This is the mode that answers "how big are the forms" —
   * the patch is a flat, periodic-friendly window, which is what makes the FFT well-posed (a global
   * equirect FFT would measure the latitude seam, not the terrain).
   */
  function samplePatch({ latDeg = 0, lonDeg = 0, spanKm = 2000, width = 128, height = 128, radiusEarth } = {}) {
    if (!(radiusEarth > 0)) throw new Error('samplePatch: radiusEarth is required (physical units depend on it)');
    const key = `patch:${latDeg},${lonDeg},${spanKm},${width}x${height},${radiusEarth}`;
    const dirs = cache.has(key)
      ? cache.get(key).dirs
      : patchDirections({ latDeg, lonDeg, spanKmX: spanKm, spanKmY: spanKm, radiusEarth, width, height });
    const { sampler } = samplerFor(key, dirs);
    const { height: hUnits, grad } = sampler.read();
    const heightKm = new Float64Array(hUnits.length);
    for (let i = 0; i < hUnits.length; i++) heightKm[i] = heightUnitsToKm(hUnits[i], radiusEarth);
    return {
      kind: 'patch', width, height, radiusEarth, latDeg, lonDeg, spanKm,
      heightUnits: hUnits, heightKm, grad, dirs,
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
  const out = { kind: sample.kind, radiusEarth: sample.radiusEarth, physical: {}, angular: {} };
  const h = sample.heightKm;

  for (const frame of ['physical', 'angular']) {
    const grid = sample.grids[frame];
    const d = out[frame];
    d.rmsReliefKm = rmsReliefKm(h, grid);              // height axis is km in both frames
    d.hypsometricIntegral = hypsometricIntegral(h, grid);
    const s = slopeStats(h, grid);
    d.meanSlopeDeg = s.meanDeg;
    d.medianSlopeDeg = s.medianDeg;
    d.p90SlopeDeg = s.p90Deg;
    d.slopeExcludedFraction = s.excludedFraction;
    d.autocorrWavelength = autocorrWavelengthKm(h, grid);   // km in physical frame, degrees in angular
    d.totalArea = totalAreaKm2(grid);
    if (sample.kind === 'patch') {
      const psd = radialPSD(h, grid);
      d.dominantWavelength = psd.dominantWavelengthKm;
      d.spectralSlope = psd.spectralSlope;
    }
    if (sample.kind === 'equirect') {
      d.bandCount = bandCount(h, grid).bands;
    }
    d.unit = frame === 'physical' ? 'km' : 'deg';
  }

  const w = areaWeights(sample.grids.physical);
  const m = distributionMoments(h, w);
  out.elevation = { meanKm: m.mean, sdKm: m.sd, minKm: m.min, maxKm: m.max, skew: m.skew };
  return out;
}
