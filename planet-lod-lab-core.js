// planet-lod-lab-core.js
// Pure CPU-side foundation math for the Planet LOD Lab.
// Imported by planet-lod-lab.html AND tests/planet-lod-foundation.test.js (DRY).
// No three.js / DOM deps — keep it unit-testable in node/vitest.
//
// This is the code that later grafts into production PlanetGenerator, so it
// earns real unit tests. The shader + UI live in the HTML and are verified
// visually through chrome-devtools (:9223).

export const clamp01 = (x) => Math.min(1, Math.max(0, x));
export const mix = (a, b, t) => a + (b - a) * t;

export function smoothstep(e0, e1, x) {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
}

// lodRamp: 0 (far) -> 1 (closest). e0 > e1 (descending) — detail RISES as distance shrinks.
export function lodRampOf(distanceRadii) {
  return smoothstep(20.0, 6.0, distanceRadii);
}

// Octave budget ramps with lodRamp: mix(4,9,lodRamp), then trimmed by qualityTier (0..1).
export function autoOctaves(lodRamp, qualityTier = 1.0) {
  const full = mix(4.0, 9.0, lodRamp);
  return mix(4.0, full, qualityTier); // qualityTier<1 trims the LOD2 octaves on weak GPUs
}

// Hysteresis on the discrete "is this body LOD2-active" flag.
// enter at 18 radii, exit at 22 radii — the 4-radius dead-band kills boundary flicker.
// prevActive: the flag's previous value. Returns the new flag.
export function lodHysteresis(distanceRadii, prevActive) {
  if (prevActive) return distanceRadii < 22.0; // stay active until we retreat past 22
  return distanceRadii < 18.0;                  // only activate once we're inside 18
}

// qualityTier 0 (mobile/cheap) -> 1 (desktop/full). Scales the cost knobs (spec §2.E).
export function qualityKnobs(qualityTier) {
  return {
    craterCells: qualityTier >= 0.5 ? 27 : 9,                  // 3D 27-cell vs tangent 9-cell
    atmosphereModel: qualityTier >= 0.5 ? 'raymarch' : 'fresnel',
    maxOctaves: Math.round(mix(4, 9, qualityTier)),            // 4..9
  };
}

// deriveUniforms: physics driver-bundle -> flat semantic uniform values.
// Generalizes the aurora/atmosphere precedent in PlanetGenerator.js:435-487
// (fieldStrength = composition.ironFraction * (locked ? 0.2 : 1.0); NO planetType branch).
// Mapping CONSTANTS are lab-tunable; the tests pin the LOGIC (hot->emissive, airless->no
// limb, etc.). Drivers schema mirrors PlanetGenerator's real fields.
export function deriveUniforms(drivers, qualityTier = 1.0) {
  const d = drivers || {};
  const iron = d.composition?.ironFraction ?? 0.3;
  const hasAtmo = !!d.atmosphere;
  const T = d.T_eq ?? 280;
  const erosion = d.surfaceHistory?.erosion ?? 0;
  const locked = !!d.tidalState?.locked;

  const hot = clamp01((T - 400) / 600);                          // 400K..1000K -> 0..1
  const liquidWater = (T > 250 && T < 330) ? 1 : 0;              // specular band

  return {
    emissive: hot,                                               // lava glow on hot bodies
    limbStrength: hasAtmo ? 0.7 : 0.0,                           // rim glow needs an atmosphere
    specStrength: (hasAtmo && liquidWater) ? 0.8 : iron * 0.15,  // ocean specular vs faint metal sheen
    auroraIntensity: iron * (locked ? 0.2 : 1.0) * (hasAtmo ? 1 : 0),
    cloudCoverage: hasAtmo ? clamp01((d.habitability ?? 0) + 0.2) : 0,
    reliefAmplitude: mix(1.0, 0.6, erosion),                     // eroded worlds = softer relief
    ...qualityKnobs(qualityTier),
  };
}
