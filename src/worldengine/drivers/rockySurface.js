// src/worldengine/drivers/rockySurface.js
// ─────────────────────────────────────────────────────────────────────────────
// DRIVER PACK #4 — THE ROCKY SURFACE (PLAN §4 "Step 9"). Ledger rows P-12 and P-14.
//
//     rockySurfacePack(condition, ctx) -> { drivers, attributes, meta }
//
// It composes five modules that were already pure, three-free and SHARED, and derives nothing:
//
//     craterDriverBlock ──────────────────────> the impact family (10 uniforms) ⭐ IMPORTED, not
//                                               derived here since B3 leg 2 — see ./craterDeck.js
//     surfacePaletteOf -> applyAlbedoTransfer ─> the ground palette (5 uniforms)
//     icenessOf / biosphereOf ─────────────────> the two surface scalars
//     reliefEnvelope ─────────────────────────> the one global relief term
//     (ctx.macroOffset / detailOffset / craterOffset) ─> the three domain offsets, FORWARDED
//
// ⭐ WHY THIS PACK EXISTS, in one line. Ledger P-12 and P-14 are the two rows where the game
// ALREADY RUNS the producer and the lab material simply never receives the answer: the legacy
// material writes the palette and the crater family per body
// (src/objects/Planet.js:1628 `uFreshColor: { value: new THREE.Vector3(...(d.landPalette?.fresh || [0.6, 0.58, 0.55])) },`,
// src/objects/Planet.js:1688 `uCraterDensity: { value: craters.density },`), and a body swapped onto
// the lab material loses all of it to factory defaults. This module is the wire. NOTHING HERE IS
// DESIGNED — every value is a forward of a function both front-ends already call.
//
// ⭐⭐ AND IT IS THE FIRST PACK WITH A km-SHAPED DRIVER, which is the reason PLAN.md ordered it
// second rather than first. Packs #1-#3 all carry `ctx.displayRadiusEarth` and consume none of it,
// so their "the two display policies agree on every driver" evidence is a fact about the SIZE OF THE
// SET (src/worldengine/drivers/giantDeck.js:33 `⭐ THE DISPLAY POLICY IS CARRIED AND NOT CONSUMED, AND SAYING SO IS PART OF THE MEASUREMENT.`).
// `uCraterScale` here is the first driver that actually crosses
// src/worldengine/port/writePackUniforms.js:219 `    const dispR = assertDisplayPolicy(ctx);`, so the
// seam stops being vacuous. See DECISION 1 below — it is the single most load-bearing choice in
// this file and it is NOT the obvious one.
//
// ⛔⛔ WHAT IS DELIBERATELY NOT PORTED, AND NOT DERIVED — read before adding a uniform.
// ---------------------------------------------------------------------------------------------
//  1. THE LAB'S `craterComplexD`. The lab pins it high on purpose and this pack refuses it. The
//     refusal is not new law — it is already written down, verbatim, at
//     src/worldengine/port/craterUniforms.js:153 `// uCraterComplexD, in CELL units (one cell == D_char km). ⛔ NOT the lab's value: the lab pins`
//     src/worldengine/port/craterUniforms.js:154 `// this high to force morphology == 0, because every crater it draws is a sub-floor simple bowl.`
//     src/worldengine/port/craterUniforms.js:155 `// The game's craters are ~0.1 R across — complex craters — and their central peaks and wall`
//     src/worldengine/port/craterUniforms.js:156 `// terraces are most of what makes a big crater read as a crater rather than a dent.`
//     So this pack forwards the GAME's value, src/worldengine/port/craterUniforms.js:158 `const complexD = transitionDiameterKm(g) / Dchar;`,
//     and the byte-identity arm against the lab MUST be expected to fail on this one name. Porting
//     the lab's number would flatten every complex crater in the game while every gate stayed green.
//  2. `uDispDomainScale`. Ledger P-14 lists it beside the four crater names, and it has NO producer
//     among them — it is the lab's global domain multiplier and the game's is identity
//     (src/objects/Planet.js:1682 `uDispDomainScale: { value: RELIEF_DOMAIN_SCALE },`). P-14 closes
//     4 of 5 and stays partially open; naming it here would author a law with no source.
//  3. ⭐ THE OFFSET FAMILY IS NOW FORWARDED — AND STILL NOT DERIVED. `uMacroOffset`,
//     `uDetailOffset` and `uCraterOffset` (ledger P-13) are emitted below, but NOT ONE of the three
//     is computed in this file: they arrive on `ctx` already answered, and the answer is the game's
//     own `reliefOffsets` — the exact vectors the legacy material writes at
//     src/objects/Planet.js:1684 `uMacroOffset: { value: reliefSeed.macro },`. The earlier refusal
//     stands where it was aimed: there are TWO divergent private seed→vec3 laws (the game's, and the
//     lab's scalar sin-hash), so SYNTHESISING a third from a seed inside a pack would be a new
//     disagreement nothing can fail on. Forwarding a front-end's own law is the opposite act.
//     ⚠ AND IT CLOSES 3 OF 23, WHICH IS THE HONEST NUMBER. Measured on the material factory:
//     `grep -oE 'u[A-Za-z0-9]*Offset[A-Za-z0-9]*:' src/worldengine/shaders/uniforms.js | sort -u`
//     yields 26 names, of which 3 are scalar knobs (`uRidgeOffset`, `uPlateauOffset`,
//     `uCryoRidgeOffset`) and 23 are vec3 domain offsets defaulting to a bare `new THREE.Vector3()`
//     (src/rendering/LabPlanetMaterial.js:345 `it selects **111**: the 87 here plus 24 all-zero domain-offset vectors`).
//     The lab writes all 26; the GAME's legacy material writes exactly these three and no others
//     (measured: `uMacroOffset|uDetailOffset|uCraterOffset` are the only offset names in
//     src/objects/Planet.js), and no shipped pack writes any. So after this commit the 20 remaining
//     feature-domain offsets — dune, dust, karst, glacial, fluvial, tessera, … — are still identical
//     on every swapped body. That is a REAL residue and it is not a regression this pack introduces:
//     it is the state the legacy material already ships. Closing it is an offset-FAMILY decision
//     with 20 producers to find, not three more driver lines.
//  4. `uNoiseScale` (ledger P-10 planets / M-09 moons) — ⭐ NO LONGER A NON-PORT. CLOSED AT B2 LEG 3, 2026-08-20, and ⛔ the pre-leg text is kept as the thing CORRECTED rather than deleted, because a reader who finds only the new claim cannot tell what changed: it read "Measured: the lab never writes it either — it sits at the factory default (src/worldengine/shaders/uniforms.js:10 `      uNoiseScale: { value: 4.0 },`). There is no lab law to carry, so closing P-10 means DECIDING what a per-body value should be. Not wiring."
//     ⭐ THAT WAS RIGHT ABOUT THE STATE AND WRONG ABOUT THE REMEDY. Max ruled the shape — give the base field a characteristic wavelength in km, in the engine's established shape, and calibrate that wavelength against real bodies rather than choosing it mid-wiring — so the value is now DERIVED (an eight-body calibration plus an Io-anchored tidal process term) rather than decided. src/worldengine/base/macroWavelength.js carries the whole derivation; this pack forwards it and authors nothing, which is the same posture every other line here takes.
//     ⛔⛔ IT IS A RE-CALIBRATION, NOT A DIFFERENTIATOR, AND THE HEADLINE THAT SAYS OTHERWISE IS MEASURED AGAINST THE LAB FACTORY DEFAULT RATHER THAN AGAINST WHAT RENDERS. Two things a reader must not get wrong, both measured: (1) ⛔ THIS READ "NOTHING HERE IS VISIBLE IN A DEFAULT FRAME" AND THAT IS SUPERSEDED AT B7, 2026-08-21 — KEPT AS THE THING CORRECTED. The flag now reads src/objects/Planet.js:2153 `export const LAB_GAS_BODIES_DEFAULT = true;`, so this pack IS in a default frame on every non-gas world-engine body; the measurement below (SELECTS 1160 of 1160, ADMITTED 0 of 1160) was true at the old default and its ADMITTED half is now the selected count. The gate itself is unchanged and still gates admission, and MEASURED over `lab-procedural-0…199` this pack SELECTS 1160 of 1160 non-gas bodies while 0 of 1160 are ADMITTED at the default flag, so every one renders through the legacy program. Like B3 and B4, by the plan's own design; B7 is its only player-facing node. (2) POST-FLIP THIS REPLACES A 1160-DISTINCT LEGACY DRAW WITH A LESS DISTINCT DERIVED ONE. The legacy material is NOT one shared value: src/objects/Planet.js:1681 `        uNoiseScale: { value: d.noiseScale },` writes the generator's draw and MEASURED that is 1160 distinct over the 1160 non-gas at raw float64, at 9 significant figures and at float32 alike. The ONE shared 4.0 this closes is src/worldengine/shaders/uniforms.js:10 `      uNoiseScale: { value: 4.0 },`, the LAB factory default. THE SWAP, with the precision convention on every figure over the 1160 non-gas: legacy 1160 distinct → derived 985 at raw float64, 844 at 9 sig figs, 780 at float32 (the precision the uniform reaches the shader at), across 83 distinct 5 % bins. FEWER distinct values, and it is the intended trade only because Max ruled the value must be a PHYSICAL wavelength rather than a random draw. The base law is a CONSTANT 2.8736 against the lab's 4.0 — the reference bodies put the macro wavelength at about one body radius from Luna to Venus, so the radius cancels — and every per-body difference comes from the process term.
//  5. `uIcenessAlbedo`. `uIcenessMix` is the driven MIX; the albedo it mixes toward is a lab knob.
//  6. NO `assertMacroSeed`, and the omission is the honest one — same reasoning as
//     src/worldengine/drivers/limbDeck.js:52 `ASSERTION, and the omission is the honest one.`.
//     This pack draws NO entropy: every driver is a pure function of the condition vector AND of the
//     three offset vectors the front-end hands it, so asserting a seed it never reads would be a
//     check that cannot fail for a reason. The pack's own test asserts seed-INDEPENDENCE instead, so
//     the day a seeded term joins the deck the omission ends loudly rather than silently.
//     ⚠ THE OFFSETS DO NOT CHANGE THAT. They are the front-end's answer carried across a seam, the
//     same shape `displayRadiusEarth` has; the pack never opens a stream to produce them, which is
//     why they get a REQUIRED-field assertion (like the display policy) and not a seed assertion.
//
// ⛔ THREE-FREE, AND NO ENTROPY. The import closure is `base/` + `display/` + `port/`. Measured on
// this file's own imports rather than assumed:
//   · `base/labCore.js` imports exactly ONE module —
//     src/worldengine/base/labCore.js:1102 `import { R_EARTH_KM, featureFrequencyFromKm } from './featureScale.js';`
//     — and `featureScale.js` imports nothing at all. So the 1264-line module adds ZERO npm deps and
//     ZERO renderer surface to the closure. The alternative was weighed BEFORE writing — extract
//     `reliefEnvelope` and its four constants into a leaf module rather than pull a 1264-line file
//     in for one 4-line function — and the measurement is what decided it: the closure gate this
//     pack must pass is about `three` and npm specifiers, and on both counts importing `labCore`
//     whole costs nothing. Extracting a symbol the citation fence already resolves, to buy a
//     property no gate measures, would be churn dressed as hygiene.
//   · `base/bombardment.js` pulls `alea` (src/worldengine/base/bombardment.js:51 `import alea from 'alea';`).
//     That is NOT a new npm dep: pack #1's closure already carries it through giant-drivers.js /
//     climate-e5.js / band-flow.js, so the "adds no npm dep beyond giantDeck's" assertion holds.
//   · `display/albedoTransfer.js` and `base/surfaceMaterial.js` import NOTHING (measured: zero
//     import statements in either file).
// ⛔ NO `Math.random`, NO `Date.now`, NO alea stream opened here.
// ⛔ DO NOT import the lab's display-scale helper, or `featureFrequencyFromKm`, into this file — and
//   do not NAME the helper either, not even in a comment: tests/vis-scale-fence.test.js sweeps the
//   RAW TEXT of every file under src/worldengine/** for those tokens, comments included, with one
//   carved-out definer. This prose is written token-free for that reason, exactly as
//   src/worldengine/port/writePackUniforms.js:24 `lab's law. The prose above is written token-free for the same reason.` is.
//   The contract's whole shape is that the pack states a SIZE and the writer resolves the FREQUENCY.
//
// ⚠ CARRIED DEFECT, NOT FIXED HERE. `reliefEnvelope`'s first parameter is dead:
// src/worldengine/base/labCore.js:1178 `// for call-site symmetry with the old reliefNorm signature but is UNUSED in the return (radius via`
// — the radius reaches the answer only through g. It is filed as a defect in the gravity/self-
// compression workstream's evidence folder,
// docs/WORKSTREAMS/world-engine-gravity-selfcompression-2026-07-28/evidence/FINDING-uperturb-radius-blind.md.
// This pack PASSES the
// radius anyway, for call-site symmetry with the lab's own call
// (planet-lod-lab.html:5001 `uniforms.uPerturb.value = state.perturb * reliefEnvelope(_RE, _gNow);`).
// Whether relief should see radius independently of gravity is a LAW question and belongs where the
// law lives; silently dropping the argument here would erase the only visible trace of the defect.
// ─────────────────────────────────────────────────────────────────────────────
import { compositionClass } from '../base/e1Regime.js';
// ⭐ B3 LEG 2, 2026-08-21 — THE IMPACT FAMILY MOVED OUT AND IS IMPORTED BACK, and the reason is a row rather than tidiness: ledger P-14's crater half is that NO pack writes these ten names on a gas-class body, and the fix is a second pack over the complement predicate. Two packs emitting one family from two copies of ten lines is the third-transcription failure B3 leg 1 spent a commit deleting, so there is now exactly ONE expression of the block and both packs import it. The two producer imports this line replaces (`craterRelevanceOf`, `craterUniformsFrom`) moved WITH it.
import { craterDriverBlock, CRATER_GATE, EJECTA_GATE, C_CRATER } from './craterDeck.js';
import { surfacePaletteBlock, offsetDriverBlock } from './giantSurface.js';   // ⭐ 2026-08-21 — THE PALETTE AND OFFSET BLOCKS MOVED OUT AND ARE IMPORTED BACK, and the reason is a row rather than tidiness: ledger P-12's and P-13's GAS halves are exactly "no pack writes these names on a gas-class body", and the fix is a pack over the complement predicate. Two packs emitting one family from two copies of ten lines is the third-transcription failure B3 leg 1 spent a commit deleting, so there is now exactly ONE expression of each block and both packs import it — the same move `craterDriverBlock` made one family over.
// ⚠ THE FIVE PRODUCER IMPORTS THIS LINE REPLACES (`surfacePaletteOf`, `icenessOf`, `biosphereOf`, `BIO_PIGMENT`, `applyAlbedoTransfer`) MOVED WITH THE BLOCK and NOT ONE of them is called from this file any more. An unused import kept "for symmetry" is how a file grows a dependency it no longer has — the same note `scalar`'s departure carries three lines below.
import { reliefEnvelope } from '../base/labCore.js';
// ⚠ `scalar` LEFT THIS IMPORT AT B3 LEG 2 AND WAS NOT DROPPED FROM THE PROGRAM: the only two gated drivers this pack ever emitted are the crater/ejecta master gates, and they moved to `./craterDeck.js` with the block. An unused import kept "for symmetry" is how a file grows a dependency it no longer has.
import { sizeKm, assertDisplayPolicy, assertPackResult, PackContractError } from '../port/writePackUniforms.js';
// ⭐ B2 LEG 3 — the base field's km wavelength and its cFeature. ⛔ THE CALIBRATION CONSTANTS LIVE IN THAT MODULE AND ARE ONLY FORWARDED FROM HERE, and the reason is a shipped fence rather than taste: tests/driver-pack-rockysurface.test.js:767 `    expect(literals.sort()).toEqual(['0', '0.55', '1.0']);` asserts this file's numeric literals are exactly those THREE — ⭐ FOUR UNTIL 2026-08-21, and the `'3'` did not get deleted, it MOVED: its only source was `offsetOf`'s array-length guard, which went to `./giantSurface.js` with `offsetDriverBlock` and is fenced there instead (⭐ was also cited as :717 until 2026-08-21; that line is the `literalsIn` call, not the assertion, and being symbol-less the ref sat in gate 2's UNCHECKED column where nothing could catch it) — so a calibration constant TYPED here reds it. `C_CRATER` below is the same NAMED-FORWARD shape and escapes only because its value happens to be one of the three; a base-field constant of 1.16 does not, and routing around the fence rather than through a shared module is exactly the transcription it exists to catch.
import { macroWavelengthKm, C_MACRO } from '../base/macroWavelength.js';

// ── The two declared gate names and the crater cFeature — RE-EXPORTED, NOT DECLARED ─────────────
// ⭐ ALL THREE MOVED TO `./craterDeck.js` AT B3 LEG 2 (2026-08-21), WITH THE DRIVERS THEY BELONG TO,
// and they are re-exported from here rather than dropped because both pack ENTRIES declare the same
// two gate names and every existing importer of this file reads them from this path. A constant in
// one file whose only consumer is another is how a "shared" law becomes two laws; the reasoning that
// used to sit here — the lab's two independent `cratersEnabled` / `ejectaEnabled` toggles, and why
// `C_CRATER` is written out instead of inlined into the `sizeKm(...)` argument — moved with them and
// is quoted in full at src/worldengine/drivers/craterDeck.js:56 `// ── The two declared gate names ──────────────────────────────────────────────────────────────────`.
// ⛔ THE NUMERIC-LITERAL FENCE OVER THIS FILE MOVES WITH `C_CRATER` AND THE SUITE RE-PINS IT IN THE
// SAME COMMIT: this file no longer NAMES 1.0 for the crater law, and `craterDeck.js` carries its own
// literal fence for the same anti-transcription reason.
export { CRATER_GATE, EJECTA_GATE, C_CRATER };

// ⚠ PERTURB_BASE IS A TRANSCRIPTION RISK AND IS DECLARED SO THE SUITE CAN PIN IT. The lab's global
// relief write is `state.perturb * reliefEnvelope(...)`, and `state.perturb` is a GUI default,
// planet-lod-lab.html:902 `perturb: 0.55,`. The SAME value is simultaneously the material factory's
// default, src/worldengine/shaders/uniforms.js:33 `uPerturb:    { value: 0.55 },`. That coincidence
// is a trap for every instrument in this program: a two-frame before/after comparison CANNOT
// distinguish "the pack wrote the relief envelope" from "the material already had the factory
// value", because on a body at g = 1 the envelope is ~1 and the product is the default again. So
// the constant is named, exported, and the pack test asserts it EQUALS the factory default rather
// than transcribing the digits — which converts a copied literal into a pinned reference and lets
// the anti-transcription fence stay meaningful over this file.
export const PERTURB_BASE = 0.55;

// ── The three domain-offset ctx fields ─────────────────────────────────────────────────────
// ⭐ `offsetOf` AND `offsetsOf` MOVED TO `./giantSurface.js` AS `offsetDriverBlock`, WITH THEIR WHOLE
// ARGUMENT, and the argument is the single decision the block exists to hold in one place: a
// missing offset THROWS rather than defaulting to the zero vector, because the zero vector is a
// legal noise domain that renders a plausible planet wearing the SAME relief as every other body
// on the material — ledger P-13 itself, reproduced silently inside the commit that closes it.
// ⛔ DO NOT RE-ADD A LOCAL COPY. A second pack now forwards the identical three names over the
// complement predicate, and a `?? ZERO` in one of them is invisible on every still frame and on
// every algebraic gate this program owns — it needs two bodies side by side to show.

// ─────────────────────────────────────────────────────────────────────────────
// THE PACK
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @param {object} condition  a body condition vector (deriveConditionVector / conditionFromBody).
 * @param {object} ctx
 *   THE FIVE CONTRACT FIELDS (PLAN 5a):
 *   @param {number} ctx.displayRadiusEarth  ⭐ READ, AND THE FIRST PACK THAT READS IT. `uCraterScale`
 *                                           is km-shaped, so the two front-ends get two different
 *                                           and both-correct answers here. See DECISION 1.
 *   @param {object} ctx.gates               must carry BOTH `craters` and `ejecta` — an ABSENT key
 *                                           throws; an absent gate is an unanswered decision.
 *   @param {number[]} ctx.macroOffset       ⭐ REQUIRED, all three. The front-end's per-body
 *   @param {number[]} ctx.detailOffset      noise-domain offsets as plain 3-arrays. FORWARDED
 *   @param {number[]} ctx.craterOffset      VERBATIM — see DECISION 4 and non-port 3. An absent one
 *                                           throws rather than defaulting to the zero vector, which
 *                                           is legal, invisible, and the P-13 defect itself.
 *   ⛔ `ctx.macroSeed` is NOT read — this pack draws no entropy (non-port 6 in the header).
 *   ⛔ `ctx.animRate` is NOT read — nothing in this family animates; the crater and palette GLSL is
 *      static (src/worldengine/shaders/height.glsl.js:2201 `// uCraterDensity≤0 ⇒ early-out, so the Stage-A base render is untouched.`).
 *   ⛔ `ctx.relevance` is NOT read, and that is FORCED rather than chosen. See DECISION 2.
 * @returns {{drivers: object, attributes: object, meta: object}}
 */
export function rockySurfacePack(condition, ctx = {}) {
  if (condition == null || typeof condition !== 'object') {
    throw new PackContractError('rockySurfacePack: condition vector is missing.');
  }
  // Checked FIRST and unconditionally, as all three shipped packs do. Here it is NOT the vacuous
  // check it is for them — `uCraterScale` consumes it — but it is still made eagerly, for the reason
  // src/worldengine/port/writePackUniforms.js:107 `export function assertDisplayPolicy(ctx) {` gives:
  // a missing display policy fails silently and plausibly.
  assertDisplayPolicy(ctx);

  // ── THE IMPACT FAMILY (10) — ONE CALL, AND THE BLOCK LIVES IN `./craterDeck.js` ────────────────
  // ⭐ THE TEN DRIVERS AND THEIR TWO PRODUCER CALLS MOVED OUT AT B3 LEG 2 SO A SECOND PACK COULD EMIT
  // THE IDENTICAL MAP over the complement predicate — ledger P-14's crater half is exactly "no pack
  // writes this family on a gas-class body". The whole rationale that used to sit here (DECISION 1 on
  // `uCraterScale` being km-shaped, DECISION 2 on the CPU-side relevance fold, and why only the two
  // master gates carry a gate) moved verbatim with the code and is quoted at
  // src/worldengine/drivers/craterDeck.js:96 `export function craterDriverBlock(condition) {`.
  // ⛔ `cu` AND `rel` COME BACK OUT because this pack's `meta` reports both, and a second call to
  // `craterUniformsFrom` for them would be a second derivation of the same body.
  const { drivers: craterDrivers, cu, rel } = craterDriverBlock(condition);

  // The ground palette, re-derived from the CONDITION. ⚠ IT CANNOT BE READ OFF THE BODY RECORD.
  // The generator bakes an equivalent palette onto `d.landPalette`, but a pack receives `condition`
  // and never `d` — that is the contract's whole point (a pack must work for any front-end, and the
  // lab has no `d`). Re-deriving is byte-identical by construction because BOTH sides call the same
  // two shared functions in the same order, which is exactly what the lab does at
  // planet-lod-lab.html:2820 `state.surfacePalette = applyAlbedoTransfer(surfacePaletteOf(_bodyDrivers.condition),`.
  // ⭐ THE `extra: { pigment: BIO_PIGMENT }` ARGUMENT IS LOAD-BEARING, NOT DECORATION. The canopy
  // albedo must ride the SAME exposure scale as the ground endmembers it is mixed into; scaling it
  // by its own luminance drifts it out of relation with the rock, which
  // src/worldengine/display/albedoTransfer.js:42 `// through the SAME scale via opts.extra, which is the only correct way to add one: a pigment scaled by`
  // states as the only correct way to add one.
  const { drivers: paletteDrivers, sp } = surfacePaletteBlock(condition);   // ⛔ `sp` COMES BACK OUT because this pack's `meta` reports the palette, and a second `applyAlbedoTransfer(surfacePaletteOf(...))` for it would be a second derivation of the same body — pure and therefore harmless today, and exactly the shape that stops being harmless the day the producer takes an argument.

  // ── DECISION 3: THE RELIEF ENVELOPE'S GRAVITY FALLBACK IS THE LAB'S, NOT THE CRATER LAW'S ───────
  // ⚠ TWO SHARED MODULES IN THIS PACK FALL BACK DIFFERENTLY ON A CONDITION WITH NO `surfaceGravity`,
  // and picking the wrong one is silent: src/worldengine/port/craterUniforms.js:157 `const g = Math.max(1e-6, condition?.surfaceGravity ?? 0.5);`
  // uses 0.5, while the lab's relief call uses planet-lod-lab.html:4996 `const _RE = state.planetRadiusEarth, _gNow = state.surfaceGravity ?? 1.0;`
  // — 1.0. This driver is a port of the LAB's line, so it takes the lab's fallback; taking the
  // crater law's would raise the envelope by ~1.5x on any body missing the field and would look
  // exactly like a working wire.
  // ⛔ AND THE `??` IS NOT OPTIONAL. `reliefEnvelope` does `Math.max(surfaceGravity, 1e-3)`, and
  // `Math.max(undefined, 1e-3)` is NaN — which propagates through the pow/clamp and lands as a
  // non-finite driver. That throws at
  // src/worldengine/port/writePackUniforms.js:157 `if (!Number.isFinite(d)) {`
  // rather than rendering, which is the right failure, but it is a failure the port must not create.
  const relief = reliefEnvelope(condition.radiusEarth, condition.surfaceGravity ?? 1.0);

  // ── DECISION 4: THE THREE DOMAIN OFFSETS ARE FORWARDED, AND A MISSING ONE IS A THROW ────────────
  // ⭐ THE WHOLE ARGUMENT MOVED WITH THE CODE and is quoted at
  // src/worldengine/drivers/giantSurface.js:231 `export function offsetDriverBlock(ctx, packName) {`'s
  // two doc blocks: why a throw and not a `?? ZERO` default, and why `Array.isArray` is the point of
  // the shape check. ⛔ It is NOT restated here — a rationale in two places is a rationale that can
  // be repaired in one, which is how the two halves of a shared block start disagreeing.
  const { drivers: offsetDrivers, off } = offsetDriverBlock(ctx, 'rockySurfacePack');   // ⛔ THE PACK NAME IS PASSED so a refusal names the front-end seam that failed rather than the shared block both packs call.

  const drivers = {
    // ── The three domain offsets (3), from the shared block ──────────────────────────────────────
    // ⛔ SPREAD IN PLACE, at the position the three lines occupied, so `uniformsWritten` order is
    // unchanged and the diff is a move rather than a re-ordering.
    ...offsetDrivers,

    // ── The impact family (10), from the shared block ────────────────────────────────────────────
    // ⛔ SPREAD IN PLACE, at the position the ten lines occupied, so `uniformsWritten` order is
    // unchanged and the diff is a move rather than a re-ordering.
    ...craterDrivers,

    // ── The ground palette + the two surface scalars (7), from the shared block ──────────────────
    // ⭐ SEVEN, NOT THE FIVE THIS COMMENT USED TO SAY: the count now includes `uBioGroundCover` and
    // `uIcenessMix`, which sat in their own stanza below and moved into the block with the colours
    // because they are the same row (P-12) and the same producer family. ⛔ SPREAD IN PLACE, so
    // `uniformsWritten` order is unchanged. The ungated-on-purpose rule, the `.slice()` rule and the
    // `extra: { pigment: BIO_PIGMENT }` argument all moved with the code and are quoted at
    // src/worldengine/drivers/giantSurface.js:155 `export function surfacePaletteBlock(condition) {`.
    ...paletteDrivers,

    // ── The one global relief term ───────────────────────────────────────────────────────────────
    // ⭐ IT RIDES ONCE. The lab's own note at its write site is that the envelope applies at `uPerturb` and NOWHERE ELSE — applying it again at the crater amplitude squared it, which was a convicted defect. `uCraterAmp` above is therefore the raw crater law's value, unmultiplied, exactly as planet-lod-lab.html:5359 `uniforms.uCraterAmp.value        = state.craterAmp;` records. Do not "fix" the asymmetry between these two lines.
    uPerturb: PERTURB_BASE * relief,

    // ── B2 LEG 3: the base field's characteristic wavelength (ledger P-10 / M-09) ────────────────
    // ⭐ THE SECOND km-SHAPED DRIVER IN THIS PACK, and the second name whose VALUE this file refuses to author: `macroWavelengthKm` states a physical size in km and the writer resolves it at the front-end's display radius, exactly as `uCraterScale` does above. The eight-body calibration table, its two-convention caveat, the Io-anchored process term and every constant behind them live in src/worldengine/base/macroWavelength.js — ⛔ do not re-state any of them here. ⚠ UNGATED ON PURPOSE, AND THE SCOPE IS PINNED ELSEWHERE: tests/driver-pack-rockysurface.test.js:416 `  it('FAMILY 6b · GATE SCOPE: the two gates move those two names and NOTHING else', () => {` holds the gated set at exactly `uCraterDensity` and `uEjectaStrength`. There is no lab toggle over the base field, and a gate here would short-circuit to +0 — src/worldengine/port/writePackUniforms.js:186 `    if (!gates[d.gate]) return 0;` — i.e. hand a gated-off body a frequency of zero, one noise cell across the whole disc, a state neither front-end has ever rendered.
    uNoiseScale: sizeKm(macroWavelengthKm(condition), C_MACRO),
  };

  // ⚠ POPULATED, NOT DECORATIVE. src/worldengine/port/writePackUniforms.js:296 `export function assertPackResult(result, packName = 'pack') {`
  // checks only `drivers` and `attributes`, so `meta` is the pack's own report and the only place a
  // test can read WHY a body came out zero — an un-cratered world and a crater-irrelevant world both
  // write a density of 0 and are otherwise indistinguishable from outside.
  // `cratersFired` reads `Dchar > 0` rather than `density > 0`, and the two are NOT the same
  // question. `Dchar` is 0 on exactly the bodies that came back as the frozen CRATERS_OFF —
  // src/worldengine/port/craterUniforms.js:96 `Dchar: 0,` — so it says "this body has no resolvable
  // crater band at all", while a density of 0 also covers a body whose band exists and whose
  // coverage rounded to nothing under
  // src/worldengine/port/craterUniforms.js:79 `export const CRATER_MIN_VISIBLE = 1.0;` — ⭐ RE-POINTED 2026-08-20 (B2 leg 1): that line carried `CRATER_MIN_DENSITY = 1e-3` until the leg retired the fixed density floor into the per-body form `density * visibleCells >= CRATER_MIN_VISIBLE`. The sentence is unchanged in substance — a body whose band exists and whose coverage rounds away still reaches here with density 0 — only the constant it names moved. It also covers
  // a crater-IRRELEVANT body whose `rel` zeroed a real density. Three different worlds, one number.
  const meta = {
    compositionClass: compositionClass(condition),
    craterRelevance: rel,
    cratersFired: cu.Dchar > 0,
    craterDensity: cu.density * rel,
    Dchar: cu.Dchar,
    complexD: cu.complexD,
    ejectaStrength: cu.ejectaStrength * rel,
    iceness: drivers.uIcenessMix,
    biosphere: drivers.uBioGroundCover,
    reliefEnvelope: relief,
    palette: sp,
  };

  // ⛔ `attributes` IS AN EXPLICIT EMPTY OBJECT, NEVER `undefined`. This pack bakes nothing per
  // vertex, and src/worldengine/port/writePackUniforms.js:306 `"this pack has no attributes" and "this pack forgot" must not look the same.`
  // states the reason in the contract itself: "this pack has no attributes" and "this pack forgot"
  // must not look the same.
  return assertPackResult({ drivers, attributes: {}, meta }, 'rockySurfacePack');
}

// ─────────────────────────────────────────────────────────────────────────────
// THE REGISTRY ENTRY
// ─────────────────────────────────────────────────────────────────────────────
/**
 * ⭐ EXPORTED AS A FROZEN ENTRY rather than assembled at the registry, so composing it is one import
 * plus one array element and the predicate cannot be retyped differently from the one this pack's
 * own test gates. Registration is STEP 10's commit, not Step 9's: appended AFTER
 * src/worldengine/drivers/index.js:155 `POLAR_DECK_ENTRY,`.
 *
 * ⛔⛔ THE PREDICATE IS `compositionClass(condition) !== 'gas'` AND IT MUST NOT BE `=== 'rocky'`,
 * even though this pack is named for rock and every uniform in it is a rocky-surface uniform. It is
 * a MEASURED choice, and the measurement is the reason:
 *
 *   Over the ledger's own corpus `lab-procedural-0…199` (200 systems), re-run for this file:
 *     planets     { rocky: 464, gas: 343, icy: 45 }   of 852
 *     plain moons { rocky: 407, icy: 225 }            of 632 — ZERO gas
 *   so `=== 'rocky'` claims 64.4% of plain moons and `!== 'gas'` claims 100.0%.
 *
 * Step 10's own gate is ">= 95% of plain moons render a non-zero crater density". `=== 'rocky'`
 * caps that at 64.4% and Step 10 would stall two commits later at a gate whose failure has NOTHING
 * to do with the class predicate — invisible from inside this pack's tests, every one of which would
 * be green. The icy 225 are not a different rendering problem either: an icy moon is an impact
 * surface with a palette, and every producer in this file answers for it (`icenessOf` is precisely
 * the term that makes it look icy).
 *
 * ⚠ IT MUST RETURN THE BOOLEAN, not a truthy value. Both admission sites compare with `=== true` —
 * src/worldengine/drivers/index.js:275 `return PACKS.filter((e) => e.applies(condition, ctx) === true);`
 * and src/worldengine/drivers/index.js:319 `if (entry.applies(condition, ctx) !== true) { skipped.push(entry.name); continue; }`
 * — so a truthy non-boolean registers, reports as `skipped`, renders nothing, and throws nothing.
 * `!==` already yields a boolean; this is a note against a future rewrite, not a cast.
 *
 * ⚠ DISJOINTNESS FROM THE SHIPPED PACKS IS ASSERTED, AND SINCE B3 LEG 2 IT IS NO LONGER UNIVERSAL.
 * `limbDeck` and `polarDeck` are still `compositionClass(condition) === 'gas'` character-for-character
 * and `craterDeck` is `=== 'gas'` too, so this predicate is their exact complement. ⛔ `giantDeck` IS
 * THE EXCEPTION AND IT IS NAMED RATHER THAN GLOSSED: ledger R-07 widened its entry to
 * src/worldengine/drivers/index.js:115 `applies: (condition) => bandedEnvelopeOf(condition),` — gas OR
 * an opaque CO2 shroud — and an opaque-CO2 body is `rocky`, so the deck CO-APPLIES with this pack on
 * that slice and the two are held apart by NAME rather than by predicate. That is asserted over the
 * population in FAMILY 22 alongside `solidOptics`, which has always had the same shape. For the three
 * that remain complementary, the collision throw at
 * src/worldengine/drivers/index.js:305 `throw new PackContractError(` is inert here. Inert is not the
 * same as impossible — the pack test asserts the emitted name sets are disjoint by NAME LOOKUP, so
 * the day a predicate widens the overlap is caught by a test rather than by array order.
 */
export const ROCKY_SURFACE_ENTRY = Object.freeze({
  name: 'rockySurface',
  applies: (condition) => compositionClass(condition) !== 'gas',
  gates: Object.freeze([CRATER_GATE, EJECTA_GATE]),
  pack: rockySurfacePack,
});

/**
 * The uniform names this pack writes, as a frozen SET for the collision, scope and membership gates.
 * Exported so the test can assert the emitted set by MEMBERSHIP rather than by count — Step 4
 * measured that a count-preserving permutation is byte-identical to every instrument this program
 * owns, so a `length === 18` gate would pass a commit that swapped `uSedColor` for `uCratonColor`.
 */
export const ROCKY_SURFACE_UNIFORMS = Object.freeze([
  'uCraterDensity', 'uCraterScale', 'uCraterAmp', 'uCraterComplexD', 'uCraterRelaxation',
  'uTerraceCount', 'uEjectaStrength', 'uEjectaRampart', 'uEjectaAmp', 'uEjectaLump',
  'uWeatheredColor', 'uFreshColor', 'uSedColor', 'uCratonColor', 'uBioGroundColor',
  'uBioGroundCover', 'uIcenessMix', 'uPerturb',
  'uMacroOffset', 'uDetailOffset', 'uCraterOffset',
  // ⭐ 21 -> 22 AT B2 LEG 3, 2026-08-20. `uNoiseScale` is the base field's frequency (ledger P-10
  // planets / M-09 moons), and it is the first name this pack writes that the LEGACY material also
  // writes from a DRAWN record field rather than from a law — src/objects/Planet.js:1681 `        uNoiseScale: { value: d.noiseScale },`
  // spends `PlanetGenerator.js`'s `rng.range(2.0, 5.0)` on planets and MoonGenerator.js:209 `      noiseScale: Math.max(rng.range(3.0, 6.0), 2.5 / moonRadiusData.radius),`
  // on moons. ⛔ SO THIS NAME CANNOT REACH BYTE-IDENTITY WITH THE GAME AND IS NOT MEANT TO: the two
  // sides answer different questions, one drawn and one derived, and the ledger row is what records
  // that. MEASURED over `lab-procedural-0…199`: 0 of 1160 non-gas bodies agree.
  'uNoiseScale',
]);
