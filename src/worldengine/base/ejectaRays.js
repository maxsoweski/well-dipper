// src/worldengine/base/ejectaRays.js
// ─────────────────────────────────────────────────────────────────────────────────────────────────
// THE BRIGHT-RAY LAW (F3's ray half), AND IT IS THE ONE DEFINITION. Workstream
// wire-ejecta-rays-lab-into-game, AC-0, 2026-09-03.
//
//     rayBrightnessOf(condition) -> 0..1     the airless × young albedo streak strength
//     RAY_COUNT = 6, RAY_SHARP = 8           the two lab constants that have no producer
//
// ⭐ PROVENANCE: THIS IS THE LAB'S OWN LINE, MOVED, NOT A PORT OF IT. Until this file existed the law
// was an inline expression inside `deriveUniforms` —
//   src/worldengine/base/labCore.js:785 `  const rayBrightness = clamp01(1 - erosion) * (hasAtmo ? 0 : 1);`
// with `hasAtmo` from :644 and `erosion` from :646 — reachable only by CALLING `deriveUniforms`,
// which the port's crater driver block does not and must not do. The alternative to moving it was
// re-typing four tokens in `craterDeck.js`, and this lane has already paid for that twice (the
// terminator law's third transcription at B3 leg 1, deleted; the storm colour law, moved). So the
// expression moved here and `labCore.js:785` rides in place as a call. There is exactly ONE
// expression of the ray law under `src/`, and tests/driver-pack-ejectarays.test.js deny-scans for a
// second one and mocks THIS module to prove both readers really come through it.
//
// ⛔ THE DUAL EROSION SPELLING IS PART OF THE LAW, NOT A CONVENIENCE. ROOT-0 fix 1 (B1, 2026-08-20):
// the lab presets write `surfaceHistory.erosion` and the game writes `surfaceHistory.erosionLevel`
// (src/generation/PhysicsEngine.js:822 `erosionLevel: erosion,`). A reader that knows only the lab
// spelling drives a hard 0 into every condition-shaped bundle — i.e. it would make every game body
// read ray brightness 1.0, the brightest possible, on exactly the population this wire ships to. The
// lab spelling still WINS where both exist, so no preset moves.
//
// ⛔ THE ATMOSPHERE READ IS `!!condition.atmosphere`, NOT the pressure law `airlessnessOf`
// (src/worldengine/base/atmosphereOptics.js). Measured identical on 124/124 corpus solid bodies
// (scoping 2026-09-03); a body between 0 and 0.1 bar would differ — Mars-class rays through thin air
// — and THAT IS A CHANGE TO THE LAW, deferred by Max's 2026-09-02 ruling ("wire the features before
// developing them") and logged. This file carries the law as the lab renders it today.
//
// ⚠ NO `craterRelevance` MULTIPLY HERE OR IN ANY CALLER. The lab's per-frame writer multiplies the
// APRON by relevance (world-engine-lab.html:5361) and the RAYS by nothing (:5365). Measured, mirrored.
// The rays still only RENDER where craters do — `rayField` hosts on
// src/worldengine/shaders/height.glsl.js:2190 `      float rayField(vec3 pos){` via
// `step(1.0 - uCraterDensity, ch.x)` — but that is the shader's multiply, not this law's.
//
// ⛔ THREE-FREE and pure: one `clamp01`, no renderer, no rng, no `ctx`. Import it from the port, the
// packs, the lab and the tests alike.
// ─────────────────────────────────────────────────────────────────────────────────────────────────
import { clamp01 } from './mathutil.js';   // ⚠ `Math.max(0, Math.min(1, x))`, where labCore.js:10 spells the same function `Math.min(1, Math.max(0, x))`. Identical on every finite input and on ±0; a third private copy in the file whose whole point is "one definition" would be the joke this workstream exists to stop. The parent fixture (tests/fixtures/ray-lab-baseline.json, 18 presets + 156 bodies, max delta 0) is the measurement that says so.

/**
 * The bright-ray albedo strength for one body, 0..1.
 *
 * Bright rays are the ALBEDO exception (relief doc §F3.a): fresh high-albedo streaks thrown from
 * YOUNG craters, and AIRLESS-ONLY — an atmosphere weathers them away, so the gate is hard. They fade
 * with erosion because rays are the first thing a surface loses as it ages. Airless + pristine →
 * bright; any atmosphere → exactly 0.
 *
 * @param {object} condition  a body condition vector, a driver preset, or any bundle carrying
 *                            `atmosphere` and `surfaceHistory` (both optional).
 * @returns {number} 0..1
 */
export function rayBrightnessOf(condition) {
  const erosion = condition?.surfaceHistory?.erosion ?? condition?.surfaceHistory?.erosionLevel ?? 0;
  return clamp01(1 - erosion) * (condition?.atmosphere ? 0 : 1);
}

// ⭐ THE TWO CONSTANTS, AND WHY THEY LIVE BESIDE THE LAW RATHER THAN BEING ASSERTED EQUAL IN TWO
// PLACES. `rayCount` and `raySharp` are the only two F3 knobs with NO producer in `deriveUniforms` —
// measured absent from its output on 18/18 driver presets at the parent
// (tests/fixtures/ray-lab-baseline.json). They were a literal in the lab's state
// (world-engine-lab.html:1175-1176) and, separately, a default in the shared uniform bag
// (src/worldengine/shaders/uniforms.js:178-179). The pack WRITES them — the F2 precedent, where
// `uTerraceCount: cu.terraceCount` is a constant the pack writes rather than a default it trusts —
// and the lab imports these same two names back, so there is one `6` and one `8`.
export const RAY_COUNT = 6.0;    // radial ray streak count per crater
export const RAY_SHARP = 8.0;    // ray streak angular sharpness
