// src/worldengine/drivers/solidFeatures.js
// ─────────────────────────────────────────────────────────────────────────────
// DRIVER PACK #7 — THE SOLID-BODY SURFACE FEATURES. Block B3 leg 3, 2026-08-21.
//
//     solidFeaturesPack(condition, ctx) -> { drivers, attributes, meta }
//
// It forwards the per-body masters of SIX lab features that no pack wrote before this commit:
//
//     F7  volcanic edifices     uVolcanismStrength · uEdificeMaxHeight · uShieldStratoMix
//     F9  chaos terrain      ─┐ uCryoActivity (the ONE shared master) · uChaosRaftJitter
//     F10 ridged icy terrain ─┘
//     F23 snowline / frost      uFrostMaxCoverage · uFrostCondensationT · uFrostLatitudeBias ·
//                               uFrostAlbedo · uPlanetTempEq · uFrostLocked
//     F22 polar caps (PLD)      uPldStrength
//     F17 glacial landforms     uGlacialStrength · uGlacialFlowVigor
//
// Fourteen names. Every one of them was already DECLARED on the lab material
// (src/worldengine/shaders/uniforms.js) and written by NOTHING in `src/`, so every swapped solid
// body carried the factory default for all six families — one look, repainted.
//
// ⭐ NOT ONE LAW IS EXPRESSED HERE. Every value is a named field off ONE `deriveUniforms(condition)`
// bundle, which is the same call the lab's own driver step makes at
// planet-lod-lab.html:1943 `      const u = deriveUniforms(_dp, driverUI.qualityTier);` before forwarding the identical fields into
// `state` (planet-lod-lab.html:2074-2113). There is exactly one expression of these six laws in the
// repository — src/worldengine/base/labCore.js — and both front-ends read it. That is the property
// B3 leg 1 had to pay for twice (three copies of the terminator law) and it is cheap to keep here
// because the extraction was already done: the masters live in `src/`, not in the lab HTML.
//
// ⭐ ONE `deriveUniforms` CALL, NOT SIX. The precedent and its cost measurement are
// src/worldengine/base/auroraOptics.js:137 ` * ⚠ IT CALLS `deriveUniforms` ITSELF rather than taking a pre-computed bundle, for the same reason`
// — a per-feature helper taking a pre-computed bundle can be handed a bundle derived from a
// DIFFERENT condition than the one it reads, which is a silent wrong answer rather than a slow one.
// MEASURED this session on this corpus: 1484 conditions through `deriveUniforms` in 2.6 ms, i.e.
// 0.0017 ms/body, and it runs once per material build rather than once per frame.
//
// ⛔ `qualityTier` IS LEFT AT ITS DEFAULT AND THAT IS A CHECKED CLAIM, NOT AN OMISSION. The
// parameter reaches exactly one place — src/worldengine/base/labCore.js:1048 `    ...qualityKnobs(qualityTier),`
// — whose three outputs are `craterCells`, `atmosphereModel` and `maxOctaves`. None of the fourteen
// fields below is one of them and none is computed from them, so a tier the game has no opinion
// about cannot reach a value this pack emits.
//
// ⛔⛔ WHAT THIS PACK DELIBERATELY DOES NOT WRITE, WITH THE MEASUREMENT FOR EACH REFUSAL. Each of
// these is a name the lab's frame writer DOES set, so the omissions are decisions and are listed
// rather than left to be rediscovered as a gap.
//
//   1. THE PER-FEATURE CONSTANTS. `labCore` answers these with a bare literal that is byte-equal to
//      the lab material's own factory default, so a forward would move no pixel on any body and
//      would grow this pack's claimed name set for nothing. MEASURED over lab-procedural-0…199
//      (852 planets + 632 plain moons), each is 1 distinct value on 1484/1484 bodies:
//        `chaosCellScale` 5.0   vs src/worldengine/shaders/uniforms.js:249 `      uChaosCellScale:   { value: 5.0 },   // raft size (voronoi3d frequency, driven)`
//        `chaosMatrixRough` 0.5, `doubleRidgeFreq` 3.0, `cryoRidgeOffset` 0.45,
//        `cryoRidgeWidth` 0.18, `groovedBandFreq` 14.0, `pldLevels` 6 — all equal to their
//        declared defaults at src/worldengine/shaders/uniforms.js:251-263 and :282.
//      ⚠ tests/material-parity-list.test.js already names the hazard this avoids: its non-varying
//      residue assertion exists because "a new write that did not vary would have grown it, and that
//      is exactly the difference between wiring a law and wiring a constant".
//
//   2. `uChaosCellScale` HAS A SECOND, DIFFERENT LAB ANSWER, which is the stronger reason it is not
//      in (1)'s list by accident. The lab's frame writer does NOT use labCore's 5.0 — it resolves a
//      km slider: planet-lod-lab.html:5436 `      uniforms.uChaosCellScale.value   = featureFrequencyFromKm(_dispR, state.chaosSizeKm, C_CHAOS);`
//      against planet-lod-lab.html:1242 `      chaosSizeKm: 1274,    // real-units scale: representative chaos-raft width in km (6371/5.0; fuzzy — modeling choice, not rigorous)`.
//      Choosing between the bundle's frequency and the slider's km form is a display-policy ruling
//      of exactly the kind src/worldengine/drivers/craterDeck.js's DECISION 1 had to make for
//      `uCraterScale`, and a wiring commit does not make it silently.
//
//   3. THE DISPLAY-SCALED FREQUENCIES. `uDoubleRidgeFreq` and `uGroovedBandFreq` are written by the
//      lab as the state value TIMES its per-frame disc multiplier (planet-lod-lab.html:5440 and
//      :5443 — the multiplier is the lab's own display token, identity at 1). That multiply is the
//      FRONT-END's, the game has no counterpart for it, and this module may not spell the token at
//      all: tests/vis-scale-fence.test.js scans every `src/worldengine/**/*.js` for it and reds on a
//      COMMENT as readily as on code (measured — the first draft of this header reddened three of
//      its assertions). They are also both in (1), so nothing is lost today.
//
//   4. ⛔ `uCryoRidgeAxis0` / `uCryoRidgeAxis1` — F10's TWO SEEDED ORIENTATIONS, AND THE ONLY
//      OMISSION THAT COSTS A REAL VALUE. src/worldengine/base/labCore.js:985 derives them as
//      `[seededUnitVec3(seed + 13), seededUnitVec3(seed + 14)]` from
//      src/worldengine/base/labCore.js:756 `  const seed = d.seed ?? 0;` — and A CONDITION VECTOR CARRIES NO `seed`.
//      MEASURED: `condition.seed` is `undefined` on 1484/1484 bodies of this corpus, so forwarding
//      the bundle's answer would put every body in the galaxy on the seed-0 pair — 1484 identical
//      rift orientations, wired, green, and indistinguishable from the "these are all identical"
//      UAT this block exists to end. The seed is the FRONT-END's answer, exactly as the domain
//      offsets are (src/objects/Planet.js:2263), and the shape of the fix is the one this same
//      commit builds for F4: carry it on `ctx`. It is not done here because F10's axes are not in
//      this leg's scope and a half-answered seam is worse than a named one.
//
// ⭐ F37 AURORAE IS NOT IN THE LIST ABOVE BECAUSE IT IS ALREADY WIRED — and it contributes nothing
// on any moon. `uAuroraIntensity`/`uAuroraColor`/`uAuroraRingLat`/`uAuroraRingWidth` were closed at
// B3 leg 1 by src/worldengine/drivers/solidOptics.js:105 `    uAuroraIntensity: scalar(aurora.auroraIntensity, { gate: AURORA_GATE }),`, whose predicate is the same
// `!== 'gas'` as this pack's, so all 632 plain moons already receive the write. ⛔ RE-MEASURED THIS
// SESSION over lab-procedural-0…199: `auroraIntensity` is **0 nonzero / 1 distinct on 632 of 632
// plain moons** and 852 nonzero / 852 distinct on 852 planets. The cause is upstream of every wire —
// src/worldengine/base/labCore.js:1045 multiplies the field by `hasAtmo`, and a plain moon's
// `condition.atmosphere` is null on 632/632. F37 CONTRIBUTES NOTHING ON ANY MOON, and no pack can
// change that; it is a world-generation fact.
//
// ⚠ TWO MORE FIELDS BELOW ARE FLAT ON THE MOON HALF, MEASURED RATHER THAN PREDICTED, and they are
// named here so the moon UAT caption is not written from this file's optimism:
//   · `shieldStratoMix` is `clamp01(habitability)` (src/worldengine/base/labCore.js:843) and
//     `condition.habitability` is `undefined` on 632/632 plain moons ⇒ 1 distinct, 0 nonzero there.
//     On planets it is 852 nonzero / 17 distinct.
//   · `frostLocked` is 1 on 632/632 plain moons (every plain moon reads tidally locked) and splits
//     251/852 on planets.
// The other ten vary per moon; the counts are in this pack's suite and in the leg report.
//
// ⛔ THREE-FREE, NO ENTROPY, NO TYPE LABEL. The import closure is base/ + port/. No `Math.random`,
// no `Date.now`, no preset name, no `d.type`.
// ⛔ NOT ONE NUMERIC LITERAL IS TYPED IN THE DRIVER MAP. Every magnitude comes off the bundle; the
// suite pins this file's whole numeric-literal set for the same reason rockySurface's is pinned.
import { compositionClass } from '../base/e1Regime.js';
import { deriveUniforms } from '../base/labCore.js';
import { scalar, assertDisplayPolicy, assertPackResult, PackContractError } from '../port/writePackUniforms.js';

// ── The four declared gate names ─────────────────────────────────────────────────────────────────
// ⭐ FOUR, NOT ONE, because the lab has four independent checkboxes over these six families and they
// do not switch together. One spelling each, mirroring the lab's own writer:
//   planet-lod-lab.html:5398 `      uniforms.uVolcanismStrength.value = state.edificesEnabled ? state.volcanismStrength : 0.0;   // ✓ enable gate`
//   planet-lod-lab.html:5437 `      uniforms.uChaosRaftJitter.value  = state.chaosEnabled ? state.chaosRaftJitter : 0.0;   // ✓ enable gate`
//   planet-lod-lab.html:5449 `      uniforms.uFrostMaxCoverage.value   = state.frostEnabled ? state.frostMaxCoverage : 0.0;   // ✓ enable gate`
//   planet-lod-lab.html:5488 `      uniforms.uGlacialStrength.value    = state.glacialEnabled ? state.glacialStrength : 0.0;   // ✓ enable gate`
// ⭐ F22's PLD RIDES F23's GATE AND THAT IS THE LAB'S OWN COUPLING, NOT A SIMPLIFICATION HERE:
//   planet-lod-lab.html:5474 `      uniforms.uPldStrength.value        = state.frostEnabled ? state.pldStrength : 0.0;   // F22 PLD rides the ✓ enable gate`
// Giving F22 a gate name of its own would invent a rendering decision the lab does not have, and
// src/worldengine/drivers/index.js's `gatesFor` would then answer ALL_ON for a name nobody ruled on.
export const EDIFICE_GATE = 'edifices';
export const CHAOS_GATE = 'chaos';
export const FROST_GATE = 'frost';
export const GLACIAL_GATE = 'glacial';

/**
 * The fourteen surface-feature drivers, from a condition vector alone.
 *
 * ⛔ THE GATE GOES ON THE MASTER AND ONLY THE MASTER, which reproduces the lab exactly rather than
 * simplifying it: each family's shader pass early-outs on its own master
 * (`uVolcanismStrength`, `uFrostMaxCoverage`, `uPldStrength`, `uGlacialStrength`), so one zero
 * deletes the pass byte-identically. Gating the morphology terms as well would give the same pixels
 * and a different STATE, and would leave a gated-off body carrying the previous body's condensation
 * temperature behind a zero — invisible until something read them off-gate.
 * ⚠ `uChaosRaftJitter` IS THE EXCEPTION AND IT IS THE LAB'S. F9's master is the SHARED
 * `uCryoActivity`, which the lab writes UNGATED (planet-lod-lab.html:5435), putting the ✓ chaos
 * checkbox on the two morphology terms instead. This file follows the lab; it does not correct it.
 *
 * @param {object} condition  a body condition vector (deriveConditionVector / conditionFromBody).
 * @param {object} ctx        the Step-5a pack context (display policy + gate map).
 */
export function solidFeaturesPack(condition, ctx) {
  if (condition == null || typeof condition !== 'object') {
    throw new PackContractError('solidFeaturesPack: condition vector is missing.');
  }
  // Checked FIRST and unconditionally, as every other pack does and for the reason
  // src/worldengine/port/writePackUniforms.js:107 `export function assertDisplayPolicy(ctx) {` gives:
  // a missing display policy fails silently and plausibly, so it is refused eagerly even by a pack
  // with no km-keyed driver. ⚠ This pack emits NO km-shaped driver, so its policy seam is vacuous —
  // stated so nobody reads the call as evidence that the seam is exercised here. It is exercised by
  // `craterDeck` and `rockySurface`.
  assertDisplayPolicy(ctx);

  const u = deriveUniforms(condition);

  const drivers = {
    // ── F7 volcanic edifices (3) ───────────────────────────────────────────────────────────────
    uVolcanismStrength: scalar(u.volcanismStrength, { gate: EDIFICE_GATE }),
    uEdificeMaxHeight: u.edificeMaxHeight,
    uShieldStratoMix: u.shieldStratoMix,

    // ── F9 chaos + F10 ridged icy — ONE shared master (2) ──────────────────────────────────────
    // ⭐ `uCryoActivity` is the single master BOTH features read; the lab says so at
    // src/worldengine/shaders/uniforms.js:245 `      // ── F9 chaos / disrupted terrain (Stage-C step 3, Relief) — reads shared uCryoActivity ──`
    // and again at :251. Writing it is what unblocks the pair; F10's own two seeded axes are the
    // named omission (4) in the header.
    uCryoActivity: u.cryoActivity,
    uChaosRaftJitter: scalar(u.chaosRaftJitter, { gate: CHAOS_GATE }),

    // ── F23 snowline / frost (6) ───────────────────────────────────────────────────────────────
    uFrostMaxCoverage: scalar(u.frostMaxCoverage, { gate: FROST_GATE }),
    uFrostCondensationT: u.frostCondensationT,
    // ⚠ THIS ONE IS LIVE ONLY BECAUSE THIS COMMIT ALSO FIXED ITS READER. `frostLatitudeBias` was
    // `clamp01(d.axialTilt / 90)` against a key the condition vector spells `axialTiltDeg`
    // (src/worldengine/base/conditionVector.js:200), so it measured 0 on 1484/1484 bodies before
    // this commit. See the dual-spelling read at src/worldengine/base/labCore.js and the ROOT-0
    // fix-5 block in tests/root0-seam-laws.test.js. ⛔ It is STILL 0 on all 632 plain moons — a
    // moon record carries no tilt key of either spelling — and that is a generator fact.
    uFrostLatitudeBias: u.frostLatitudeBias,
    // `.slice()` because the returned array is handed to a settable colour by
    // src/worldengine/port/writePackUniforms.js:280 `      if (target && typeof target.set === 'function') target.set(...v);`
    // — handing out a live array is how one body's frost tint follows another's.
    uFrostAlbedo: u.frostAlbedo.slice(),
    uPlanetTempEq: u.tempEq,
    uFrostLocked: u.frostLocked,

    // ── F22 polar-layered deposits (1) ─────────────────────────────────────────────────────────
    uPldStrength: scalar(u.pldStrength, { gate: FROST_GATE }),

    // ── F17 glacial landforms (2) ──────────────────────────────────────────────────────────────
    uGlacialStrength: scalar(u.glacialStrength, { gate: GLACIAL_GATE }),
    uGlacialFlowVigor: u.glacialFlowVigor,
  };

  // ⚠ POPULATED, NOT DECORATIVE — the six masters plus the class, so a test can tell a body whose
  // feature is OFF from a body whose feature the gate zeroed, which the emitted uniforms cannot.
  const meta = {
    compositionClass: compositionClass(condition),
    volcanismStrength: u.volcanismStrength,
    cryoActivity: u.cryoActivity,
    frostMaxCoverage: u.frostMaxCoverage,
    pldStrength: u.pldStrength,
    glacialStrength: u.glacialStrength,
    tempEq: u.tempEq,
    frostLive: u.frostMaxCoverage > 0,
    glacialLive: u.glacialStrength > 0,
  };

  // ⛔ `attributes` IS AN EXPLICIT EMPTY OBJECT, NEVER `undefined` —
  // src/worldengine/port/writePackUniforms.js:306 `"this pack has no attributes" and "this pack forgot" must not look the same.`
  return assertPackResult({ drivers, attributes: {}, meta }, 'solidFeaturesPack');
}

// ─────────────────────────────────────────────────────────────────────────────
// THE REGISTRY ENTRY
// ─────────────────────────────────────────────────────────────────────────────
/**
 * ⭐ EXPORTED AS A FROZEN ENTRY rather than assembled at the registry, so composing it is one import
 * plus one array element and the predicate cannot be retyped differently from the one this pack's
 * own test gates.
 *
 * ⛔⛔ THE PREDICATE IS CHARACTER-IDENTICAL TO rockySurface's AND solidOptics',
 * src/worldengine/drivers/solidOptics.js:148 `  applies: (condition) => compositionClass(condition) !== 'gas',`, AND THAT IS THE WHOLE OF ITS
 * POPULATION ARGUMENT. `selectPacks` already returns a non-empty list for every body this claims, so
 * the `packs.length > 0` term of src/objects/Planet.js:2194 `      admitted: flag.enabled && provenance.isWorldEngine && packs.length > 0,`
 * cannot flip for any record: registration moves NO body between materials and re-pins no census.
 * Asserted over a generated population by comparing the swapped SET before and after registration,
 * not by reading three `applies` lines side by side.
 *
 * ⛔ COLLISION. src/worldengine/drivers/index.js's guard throws if two APPLICABLE packs write the
 * same uniform name on one body. Three packs co-apply with this one — `rockySurface` and
 * `solidOptics` on every body it claims, and `giantDeck` on the 130 venus-class bodies R-07 admitted
 * — and all four emitted name sets are disjoint: this pack writes the F7/F9/F17/F22/F23 families,
 * `rockySurface` the impact + palette ones, `solidOptics` the air optics, `giantDeck` the
 * `uBand*`/`uJet*` ones. Asserted by NAME LOOKUP over a generated population in this pack's suite,
 * so the day either set grows into the other it reds instead of throwing at a player.
 *
 * ⚠ IT MUST RETURN THE BOOLEAN. Both admission sites compare with `=== true`
 * (src/worldengine/drivers/index.js:196 `return PACKS.filter((e) => e.applies(condition, ctx) === true);`),
 * so a truthy non-boolean registers, reports as `skipped`, renders nothing and throws nothing.
 */
export const SOLID_FEATURES_ENTRY = Object.freeze({
  name: 'solidFeatures',
  applies: (condition) => compositionClass(condition) !== 'gas',
  gates: Object.freeze([EDIFICE_GATE, CHAOS_GATE, FROST_GATE, GLACIAL_GATE]),
  pack: solidFeaturesPack,
});

/**
 * The uniform names this pack writes, as a frozen SET for the collision, scope and membership gates.
 * Exported so the suite can assert the emitted set by MEMBERSHIP rather than by count — Step 4
 * measured that a count-preserving permutation is byte-identical to every instrument this program
 * owns, so a `length === 14` gate would pass a commit that swapped `uPldStrength` for `uPldLevels`.
 */
export const SOLID_FEATURES_UNIFORMS = Object.freeze([
  'uVolcanismStrength', 'uEdificeMaxHeight', 'uShieldStratoMix',
  'uCryoActivity', 'uChaosRaftJitter',
  'uFrostMaxCoverage', 'uFrostCondensationT', 'uFrostLatitudeBias', 'uFrostAlbedo',
  'uPlanetTempEq', 'uFrostLocked',
  'uPldStrength',
  'uGlacialStrength', 'uGlacialFlowVigor',
]);
