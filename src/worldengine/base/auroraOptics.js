// src/worldengine/base/auroraOptics.js — the F37 AURORAL OVAL's four owned quantities, extracted
// 2026-08-21 (block B3, leg 1) so that ONE function object answers for both front-ends.
//
//     auroraOpticsOf(condition) -> { auroraIntensity, auroraColor, auroraRingLat, auroraRingWidth }
//
// ⭐ WHY THIS FILE EXISTS. Ledger row P-05 (docs/FEATURES/step6-parity-ledger.md:125) is the pure
// alias shape four times over: the lab material declares `uAuroraColor` `uAuroraIntensity`
// `uAuroraRingLat` `uAuroraRingWidth` and NOTHING under src/worldengine/drivers/ writes any of
// them, so a body swapped onto the lab material loses the whole feature behind the
// `uAuroraIntensity > 0.0` guard at src/worldengine/shaders/planetShaders.glsl.js:1293
// `        if (uAuroraIntensity > 0.0){`. The game's own legacy material does not close the gap
// either — it writes DIFFERENTLY-SPELLED uniforms (src/objects/Planet.js:1720
// `        auroraColor: { value: new THREE.Vector3(...(d.aurora?.color || [0.3, 0.8, 0.4])) },`,
// no `u` prefix) fed from a record field, which is why the row is filed as four orphans on each
// side rather than one broken feature.
//
// ⛔ WHOSE LAW THIS IS, AND WHY THERE IS NO CHOICE TO MAKE. Two aurora laws exist. The GAME's, at
// src/generation/PlanetGenerator.js:481 `        const auroraIntensity = Math.min(1.0, magneticField * windIntensity * 0.15);`,
// scales the field by stellar-wind flux — and `uvFlux` appears NOWHERE under src/worldengine/, so
// it never crosses the condition seam and is not expressible by a pack at all. The LAB's uses the
// field alone. The ledger row already ruled the consequence: "the lab's law wins by default and
// this row reduces to forwarding four values", with no ruling owed by Max. ⛔ DO NOT PORT uvFlux.
//
// ⛔ NOTHING HERE IS NEW AND NOTHING HERE IS TUNED. The intensity is not even re-typed: it is read
// straight off the shipped `deriveUniforms` bundle, so the magnitude law has exactly one expression
// and it is still labCore's. The three shape/colour laws are the lab's post-process, moved verbatim
// from world-engine-lab.html:2614-2630 — and they are the SAME expressions the game generator carries
// at src/generation/PlanetGenerator.js:502 `          const ringLatitude = 0.7 + magneticField * 0.2; // 0.7 to 0.9 (in normalized Y)`
// and :503, which is what makes this row a wiring row rather than a law choice.
//
// ⛔⛔ THE ONE PIECE OF THE LAB'S LAW THAT IS DELIBERATELY NOT HERE, NAMED SO IT CANNOT BE MISTAKEN
// FOR AN OVERSIGHT. world-engine-lab.html:2612 floors the field at 0.6 for GAS bodies of at least
// 3.5 R⊕ (`_giantDynamo`), and that branch is not expressed in this module. Two reasons, both hard:
//   (1) DOMAIN. Its first conjunct is "is a gas body", and the only consumer of this module is a
//       pack whose predicate is the complement of gas. The branch is unreachable on every body that
//       reaches this code, which the pack's test asserts over a generated population rather than
//       asserting from this paragraph.
//   (2) MECHANICS. Answering "is this a gas body" means importing `compositionClass` from
//       e1Regime.js, and tests/worldengine-e1-shadow-audit.test.js forbids exactly that for every
//       file in this directory. The composition class belongs one layer up, in the pack.
// ⚠ So this module is HONEST ON NON-GAS AND INCOMPLETE ON GAS. If a gas consumer ever appears, the
// giant-dynamo floor has to come with it, and it has to come in at the drivers layer.
//
// ⛔ THREE-FREE, NO ENTROPY, CONDITION-SHAPED FROM BIRTH. The only import is the shipped labCore
// derivation. No Math.random, no Date.now, no alea stream, no preset name, no `type` label — the
// reads are `condition.atmosphere` and whatever `deriveUniforms` reads, so a pack, a headless test,
// the lab and the game all get the same answer from the same object.
import { deriveUniforms } from './labCore.js';

// The hard field gate, world-engine-lab.html:2613
// `      state.auroraIntensity = _mag > 0.05 ? (_giantDynamo ? _mag : u.auroraIntensity) : 0.0;`
// — a dynamo this weak pins no oval at all, and the lab zeroes rather than fading it.
export const AURORA_FIELD_MIN = 0.05;

// Emission colour by D4 atmosphere composition. ⭐ VERBATIM, and verbatim TWICE: the table is
// character-identical in world-engine-lab.html:2622-2628 and in src/generation/PlanetGenerator.js:490
// `          const auroraColors = {`, and the lab's own comment names the generator as its source
// ("the PlanetGenerator auroraColors table"). Physical basis, in the order below: the oxygen
// 557.7 nm line; the hydrogen Balmer series; CO2 dissociation; methane.
export const AURORA_COLOR_BY_COMPOSITION = Object.freeze({
  'n2-o2':   Object.freeze([0.3, 0.9,  0.4]),   // green (oxygen line) — Earth
  'h2-he':   Object.freeze([0.3, 0.2,  0.8]),   // blue-purple (hydrogen Balmer) — Jupiter/Saturn
  'co2-n2':  Object.freeze([0.8, 0.3,  0.4]),   // pink-red (CO2 dissociation)
  'co2':     Object.freeze([0.9, 0.35, 0.5]),   // pink
  'methane': Object.freeze([0.2, 0.6,  0.7]),   // blue-green
});

// ⚠ THE FALLBACK IS [0.3, 0.8, 0.4] AND NOT THE `uAuroraColor` DEFAULT [0.3, 0.9, 0.5]. Both
// literals exist in this codebase and they are a hair apart, which is exactly how a wrong one
// survives a reading. The lab's fallback (world-engine-lab.html:2630) and the generator's
// (src/generation/PlanetGenerator.js:497) are both this one; the 0.9/0.5 value is the material's
// cold-start default at src/worldengine/shaders/uniforms.js:58, which a written uniform replaces.
export const AURORA_COLOR_FALLBACK = Object.freeze([0.3, 0.8, 0.4]);

/** Oval latitude in normalized Y. world-engine-lab.html:2614 — a stronger dynamo hugs the pole. */
export function auroraRingLatFor(magneticField) {
  return 0.7 + magneticField * 0.2;
}

/**
 * Oval gaussian half-width. world-engine-lab.html:2615
 * `      state.auroraRingWidth = Math.max(0.07, 0.15 - _mag * 0.08);`
 *
 * ⚠ THE 0.07 FLOOR IS THE LAB'S AND THE GENERATOR HAS NO EQUIVALENT — src/generation/PlanetGenerator.js:503
 * `          const ringWidth = 0.15 - magneticField * 0.08;  // 0.07 to 0.15` is unfloored. The ledger
 * calls that "a no-op over the field's own 0-1 range", which is arithmetic rather than measurement:
 * the expression only drops below 0.07 for a field above 1. The lab's floored form is taken because
 * the lab's law wins, and because a floor that never binds costs nothing while an absent floor that
 * turns out to bind is a negative half-width.
 */
export function auroraRingWidthFor(magneticField) {
  return Math.max(0.07, 0.15 - magneticField * 0.08);
}

/** The composition colour lookup, with the lab's green fallback. Returns a fresh, mutable array. */
export function auroraColorFor(atmosphereComposition) {
  const hit = AURORA_COLOR_BY_COMPOSITION[atmosphereComposition];
  return (hit ? hit : AURORA_COLOR_FALLBACK).slice();
}

/**
 * THE OPAQUE CO2 SHROUD — the lab's cloud regime 3, and P-05's Venus override.
 *
 * ⭐ RENAMED FROM `auroraOpaqueShroudOf` AT B3 LEG 2 (2026-08-21) BECAUSE IT ACQUIRED A SECOND
 * CONSUMER. Ledger R-07 needs the same two-term test to answer "is a thick CO2 blanket this body's
 * VISIBLE SURFACE" for the zonal band deck — src/worldengine/drivers/giantDeck.js reads it there. A
 * predicate named for its first consumer is how the second consumer ends up retyping it, and a
 * retyped `> 10` is a silent population change in two rows at once. The quantity is the LAB's cloud
 * regime and nothing about it is auroral; only the OVERRIDE it feeds is.
 *
 * world-engine-lab.html:2637 `      if (_cloudRegime === 3) state.auroraIntensity = 0.0;`
 * where regime 3 is world-engine-lab.html:2385
 * `      if (_fp.atmosphere?.composition === 'co2' && (_fp.atmosphere?.pressure ?? 0) > 10) _cloudRegime = 3;`
 *
 * ⭐ THIS IS THE PART OF P-05 THE ROW'S OWN PROSE DOES NOT NAME, and it is not small: MEASURED over
 * lab-procedural-0…199, the predicate is true on 130 of 852 generated planets and ALL 130 of them
 * are non-gas — i.e. every one of them is inside this module's domain. Dropping it would not have
 * been "forwarding four values", it would have been authoring a fifth law that lights an aurora on
 * 130 bodies the lab leaves dark.
 *
 * The lab's reason, quoted from world-engine-lab.html:2631-2636: the core keys magneticField on the
 * tidal-lock FLAG only, so a slow-rotator Venus "derives a physically-wrong 0.3 that would also be
 * invisible under the opaque H2SO4 blanket anyway".
 *
 * ⚠ Regime 3 is the FIRST branch of the lab's if/else-if chain, so it is unconditional on its own
 * two-term test — which is why it can be lifted out of the chain without carrying the other four
 * regimes. That is a property of the chain's ORDER; if regime 3 ever stops being first, this stops
 * being liftable.
 */
export function opaqueCO2ShroudOf(condition) {
  return condition?.atmosphere?.composition === 'co2' && (condition?.atmosphere?.pressure ?? 0) > 10;
}

/**
 * The four values an auroral oval needs, from a condition vector alone.
 *
 * ⚠ IT CALLS `deriveUniforms` ITSELF rather than taking a pre-computed bundle, for the same reason
 * terminatorOptics.js calls `atmosphereOpticsOf` itself: an optional bundle parameter makes it
 * possible to hand this function a bundle derived from a DIFFERENT condition than the atmosphere it
 * reads, which is a silent wrong answer rather than a slow one. MEASURED cost, 2026-08-21:
 * 852 conditions in 2.2 ms, 0.003 ms/body, and it is called once per material build, not per frame.
 *
 * ⛔ `magneticField` COMES OFF THE DERIVED BUNDLE, NEVER OFF `condition.magneticField`, and the two
 * are NOT the same number. `condition.magneticField` is a data-only passthrough
 * (src/worldengine/base/conditionVector.js:156 `  magneticField:   fp.magneticField,                     // D13 data-only (undefined for lab presets)`)
 * carrying whatever the GAME generator wrote; the bundle's is labCore's own
 * `ironFraction x lock-factor`. MEASURED over lab-procedural-0…199: they disagree on 21 of 852
 * generated planets, up to 0.290 apart. The lab's law wins, so the bundle wins.
 *
 * @param {object} condition  a body condition vector (deriveConditionVector / conditionFromBody).
 * @returns {{auroraIntensity: number, auroraColor: number[], auroraRingLat: number, auroraRingWidth: number}}
 */
export function auroraOpticsOf(condition) {
  const u = deriveUniforms(condition);
  const field = u.magneticField;
  // Live only above the hard field gate AND out from under an opaque CO2 shroud. Both are the
  // lab's; neither is a fade, so the whole feature is skipped by the shader's `> 0.0` guard.
  const live = field > AURORA_FIELD_MIN && !opaqueCO2ShroudOf(condition);
  return {
    auroraIntensity: live ? u.auroraIntensity : 0.0,
    auroraColor: auroraColorFor(condition?.atmosphere?.composition),
    auroraRingLat: auroraRingLatFor(field),
    auroraRingWidth: auroraRingWidthFor(field),
  };
}
