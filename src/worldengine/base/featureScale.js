// src/worldengine/base/featureScale.js
// Real-km → shader-frequency conversion. ONE definition, imported by BOTH front-ends.
//
// WHY THIS FILE EXISTS (PLAN §4 "Step 5", 5b)
// -------------------------------------------
// `featureFrequencyFromKm` was defined in planet-lod-lab-core.js at the repo root. The shared
// pack writer (src/worldengine/port/writePackUniforms.js) has to call it, and a writer under
// src/ importing a repo-root module would create exactly the escape Step 7's boundary fence
// then has to clear. So the FUNCTION moves here and planet-lod-lab-core.js imports it BACK —
// the `src/worldengine/shaders/heightNoise.glsl.js` pattern, which is the acceptance test for
// every extraction in this plan: the text lives in one place and the lab imports it.
//
// ⛔ THIS MODULE MUST STAY three-free AND dependency-free. It is imported by the game (which
// has THREE) and by the lab (which also has THREE) — but also by the headless golden harness
// and by node test processes, and `src/worldengine/**` is fenced against display-scale tokens
// (tests/vis-scale-fence.test.js). It has zero imports on purpose; tests/pack-contract.test.js
// walks the module graph and fails on any bare specifier in the closure.
//
// ⭐ WHAT IS DELIBERATELY *NOT* HERE: the display policy.
// The lab's display pseudo-radius (R^0.5, defined in planet-lod-lab-core.js, where the fence
// deliberately exempts the file that DEFINES the token) is a FRONT-END policy, not shared
// physics. Step 5a's whole argument is that the two front-ends legitimately differ on the first
// argument to `featureFrequencyFromKm` — so that argument is supplied BY THE CALLER through the
// pack context, and this module never picks it. Moving the lab's display law into this tree
// would both contradict 5a and breach the shipped fence. See writePackUniforms.js for the
// game's declared policy and for the required-ness argument.

// Earth's mean radius in km. `radiusEarth` is in Earth radii everywhere in this codebase.
// ⚠ src/worldengine/instrument/sampling.js keeps its own copy on purpose (it is a standalone
// instrument); that duplicate is out of this lane's file set and is left as it is.
export const R_EARTH_KM = 6371;

// Footprint → shader frequency. frequency = cFeature * radius_km / featureSize_km.
// Monotonic ↑ in radiusEarth (bigger planet ⇒ a fixed-km feature spans fewer cells ⇒ higher
// frequency ⇒ smaller + more numerous on the disk) and ↓ in featureSizeKm. cFeature is the
// per-feature calibration constant (the desired look at the reference radius).
//
// ⭐ The first argument is whatever radius the CALLER's display policy resolves to — the real
// `radiusEarth` for the game, the display pseudo-radius for the lab. The function is exactly
// linear in it, which is why the policy difference is a clean ratio and why a wrong policy
// produces a finite, plausible, in-band number that no value-range test can see.
export function featureFrequencyFromKm(radiusEarth, featureSizeKm, cFeature) {
  return cFeature * (radiusEarth * R_EARTH_KM) / featureSizeKm;
}
