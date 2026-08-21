// src/worldengine/drivers/rockySurface.js
// ─────────────────────────────────────────────────────────────────────────────
// DRIVER PACK #4 — THE ROCKY SURFACE (PLAN §4 "Step 9"). Ledger rows P-12 and P-14.
//
//     rockySurfacePack(condition, ctx) -> { drivers, attributes, meta }
//
// It composes five modules that were already pure, three-free and SHARED, and derives nothing:
//
//     craterRelevanceOf ─┐
//     craterUniformsFrom ┼─> the impact family (10 uniforms)
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
//     ⚠ AND IT IS A RE-CALIBRATION FIRST, A DIFFERENTIATOR SECOND. The base law is a CONSTANT 2.8736 against today's 4.0 — the reference bodies put the macro wavelength at about one body radius from Luna to Venus, so the radius cancels — and every per-body difference comes from the process term. MEASURED on `lab-procedural-0…199`'s 1160 non-gas bodies: 985 distinct values where there was 1, and 83 distinct 5% bins where there was 1.
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
//     src/worldengine/base/labCore.js:1064 `import { R_EARTH_KM, featureFrequencyFromKm } from './featureScale.js';`
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
// src/worldengine/base/labCore.js:1140 `// for call-site symmetry with the old reliefNorm signature but is UNUSED in the return (radius via`
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
import { craterRelevanceOf } from '../base/bombardment.js';
import { craterUniformsFrom } from '../port/craterUniforms.js';
import { surfacePaletteOf, icenessOf, biosphereOf, BIO_PIGMENT } from '../base/surfaceMaterial.js';
import { applyAlbedoTransfer } from '../display/albedoTransfer.js';
import { reliefEnvelope } from '../base/labCore.js';
import { sizeKm, scalar, assertDisplayPolicy, assertPackResult, PackContractError } from '../port/writePackUniforms.js';
// ⭐ B2 LEG 3 — the base field's km wavelength and its cFeature. ⛔ THE CALIBRATION CONSTANTS LIVE IN THAT MODULE AND ARE ONLY FORWARDED FROM HERE, and the reason is a shipped fence rather than taste: tests/driver-pack-rockysurface.test.js:717 asserts this file's numeric literals are exactly `0`, `0.55`, `1.0` and `3`, so a calibration constant TYPED here reds it. `C_CRATER` below is the same NAMED-FORWARD shape and escapes only because its value happens to be one of the four; a base-field constant of 1.16 does not, and routing around the fence rather than through a shared module is exactly the transcription it exists to catch.
import { macroWavelengthKm, C_MACRO } from '../base/macroWavelength.js';

// ── The two declared gate names ──────────────────────────────────────────────────────────────────
// ⭐ NAMES, NOT HARDCODED 1.0s, and TWO of them rather than one, because the lab has two independent
// toggles over this family and they do not switch together:
//   planet-lod-lab.html:5354 `= state.cratersEnabled ? state.craterDensity * state.craterRelevance : 0.0;`
//   planet-lod-lab.html:5361 `= state.ejectaEnabled ? state.ejectaStrength * state.craterRelevance : 0.0;`
// Ejecta off with craters on is a real lab state; collapsing the two into one gate would delete a
// rendering decision rather than express it. One spelling each, shared by the driver and the ENTRY,
// mirroring src/worldengine/drivers/limbDeck.js:78 `export const LIMB_GATE = 'limb';` and
// src/worldengine/drivers/polarDeck.js:140 `export const POLAR_GATE = 'polarVortex';` — a typo in
// either place is caught on the first admitted body by
// src/worldengine/port/writePackUniforms.js:180 `if (gates == null || !(d.gate in gates)) {`, but a
// shared constant means the ENTRY and the driver cannot disagree in the first place.
export const CRATER_GATE = 'craters';
export const EJECTA_GATE = 'ejecta';

// ── The two numbers this file owns, and they are both PINS rather than tunables ───────────────────
// ⚠ C_CRATER is the per-feature calibration constant of the km→frequency law, ported from the lab's
// own declaration, planet-lod-lab.html:821 `const C_CRATER = 1.0;`, whose comment two lines above
// states the identity it encodes: C = 1 means `uCraterScale = radius_km / craterSizeKm`. It is
// written out rather than inlined into the `sizeKm(...)` call for the reason recorded at
// src/worldengine/drivers/giantDeck.js:63 `and that is a byte-identity decision, not a` — a
// calibration constant buried in a call argument is a constant that gets "simplified" away.
export const C_CRATER = 1.0;

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

// ── The three domain-offset ctx fields, and why they are ASSERTED rather than defaulted ──────────
/**
 * One offset vector off the front-end's ctx, refused unless it is a 3-element array of finite
 * numbers.
 *
 * ⭐ WHY A THROW AND NOT A `?? ZERO` DEFAULT. The uniform's factory default IS the zero vector
 * (src/worldengine/shaders/uniforms.js:158 `uMacroOffset:  { value: new THREE.Vector3() },`), and a
 * zero domain offset is a perfectly legal noise domain — it renders a plausible planet. It just
 * renders the SAME planet's relief as every other body on the material, which is a defect only two
 * bodies side by side can show. A default here would therefore reproduce ledger row P-13 silently
 * inside the very commit that closes it, so the seam refuses instead, exactly as
 * src/worldengine/port/writePackUniforms.js:107 `export function assertDisplayPolicy(ctx) {` refuses a missing display policy.
 *
 * ⛔ THE ARRAY SHAPE IS CHECKED, NOT ASSUMED, AND `Array.isArray` IS THE POINT OF THE CHECK. A
 * `THREE.Vector3` has `.x/.y/.z` and no `.length`, so a front-end handing one over would fail here
 * loudly rather than reach src/worldengine/port/writePackUniforms.js:280 `if (target && typeof target.set === 'function') target.set(...v);`
 * as a non-array and be written as a scalar `slot.value`. The pack tree may not name a renderer
 * type, so the guard is written as a positive shape assertion rather than as a type test.
 */
function offsetOf(ctx, field) {
  const v = ctx == null ? undefined : ctx[field];
  if (!Array.isArray(v) || v.length !== 3) {
    throw new PackContractError(
      `rockySurfacePack: ctx.${field} is REQUIRED and must be a 3-element array. It is the ` +
      'FRONT-END\'s per-body noise-domain offset, not a value this pack may derive: two divergent ' +
      'private seed-to-vector laws already exist and a third would agree with neither. Defaulting ' +
      'it to zero is legal, invisible on one body, and gives every body the same relief.',
    );
  }
  for (let i = 0; i < v.length; i++) {
    if (typeof v[i] !== 'number' || !Number.isFinite(v[i])) {
      throw new PackContractError(`rockySurfacePack: ctx.${field} component ${i} is not a finite number.`);
    }
  }
  return v;
}

/** The three, named once so the driver block below cannot spell one of them differently. */
function offsetsOf(ctx) {
  return {
    macro: offsetOf(ctx, 'macroOffset'),
    detail: offsetOf(ctx, 'detailOffset'),
    crater: offsetOf(ctx, 'craterOffset'),
  };
}

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

  // ── DECISION 2: THE RELEVANCE FOLD IS CPU-SIDE, AND IT IS FORCED ────────────────────────────────
  // The lab multiplies a per-feature relevance term into the two gated writes (the two lines quoted
  // above the gate constants). The obvious port is `scalar(v, { gate, relevance: 'craters' })` — and
  // it THROWS on every body, because the game's relevance map is empty:
  // src/objects/Planet.js:2204 `export const GAME_RELEVANCE = Object.freeze({});   // pack #1 keys no per-feature relevance`
  // and src/worldengine/port/writePackUniforms.js:240 `  if (d.relevance !== null && d.relevance !== undefined) {` refuses a name with no finite value.
  // ⛔ The fix is NOT to add a `craters` key to GAME_RELEVANCE. `craterRelevanceOf` is a pure
  // condition function — src/worldengine/base/bombardment.js:220 `export function craterRelevanceOf(condition) {`
  // — so folding it here reproduces the lab's product exactly while keeping the relevance CHANNEL
  // empty and every pack that keys nothing on it unchanged. It is also what the lab itself does one
  // step earlier: planet-lod-lab.html:2834 `state.craterRelevance = craterRelevanceOf(_bodyDrivers.condition);`
  // derives the same 0/1 from the same condition vector; the frame writer is only the multiply.
  const rel = craterRelevanceOf(condition);

  // The whole per-body crater derivation, in one call. TOTAL — it returns the frozen CRATERS_OFF for
  // any body whose schedule does not fire or whose resolvable band is empty, so this line never
  // throws and never needs a class guard of its own.
  const cu = craterUniformsFrom(condition);

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
  const sp = applyAlbedoTransfer(surfacePaletteOf(condition), { extra: { pigment: BIO_PIGMENT } });

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
  // Non-port 3 in the header is the whole argument; this line is only its consequence. `offsetsOf`
  // REQUIRES all three rather than defaulting them, for the same reason
  // src/worldengine/port/writePackUniforms.js:107 `export function assertDisplayPolicy(ctx) {` requires the display policy: the
  // default is (0,0,0), (0,0,0) is a legal noise domain, and a body that silently took it renders a
  // perfectly plausible planet wearing the SAME relief as every other body on the material. That is
  // the one failure in this family that no still frame and no algebraic gate can see — it needs two
  // bodies side by side — so the seam refuses rather than substitutes.
  const off = offsetsOf(ctx);

  const drivers = {
    // ── The three domain offsets (3) ─────────────────────────────────────────────────────────────
    // ⛔ UNGATED, AND FORWARDED BYTE-FOR-BYTE. There is no lab toggle over the noise domain, and a
    // gate here would hand a gated-off body the shared domain — the exact state this closes.
    // ⛔ `.slice()` FOR THE REASON THE PALETTE TAKES ONE, one seam further out: these arrays come
    // from the CALLER's ctx, which a front-end is free to build once and reuse across bodies. The
    // writer hands an array to a settable vector, and the pack's own suite asserts that two bodies
    // never share the array object.
    uMacroOffset: off.macro.slice(),
    uDetailOffset: off.detail.slice(),
    uCraterOffset: off.crater.slice(),

    // ── The impact family (10) ───────────────────────────────────────────────────────────────────
    // ⭐ ONLY THE TWO MASTER GATES CARRY A GATE, which reproduces the lab exactly rather than being
    // a simplification: the GLSL keys the whole crater pass on the density
    // (src/worldengine/shaders/height.glsl.js:2203 `if (uCraterDensity <= 0.0) return;`) and the
    // whole apron on the strength
    // (src/worldengine/shaders/craterRelief.glsl.js:157 `if (uEjectaStrength <= 0.0) return;`), so
    // one zero deletes each pass byte-identically. Gating the morphology terms too would give the
    // same pixels and a different STATE — and would leave a gated-off body carrying the previous
    // body's terrace count behind a zero, invisible until something read them off-gate.
    uCraterDensity: scalar(cu.density * rel, { gate: CRATER_GATE }),

    // ── DECISION 1: `uCraterScale` IS km-SHAPED, AND THAT IS THE POINT OF THIS PACK ───────────────
    // `craterUniformsFrom` returns BOTH the physical diameter and an already-resolved frequency:
    // src/worldengine/port/craterUniforms.js:142 `const Dchar = Math.sqrt(lo * H);` and
    // src/worldengine/port/craterUniforms.js:183 `scale: R_km / Dchar,`. Emitting `scale` as a plain
    // number would work, render correctly in the game today, and route around the policy seam
    // entirely — `sizeKm` would still have ZERO production callers and the contract's central claim
    // would remain untested. So the pack takes `Dchar` (policy-FREE) and lets the writer resolve it.
    // Under the game policy the two are byte-identical: src/worldengine/port/writePackUniforms.js:50 `export function gameDisplayRadiusEarth(radiusEarth) {`
    // is the identity, so src/worldengine/base/featureScale.js:42 `export function featureFrequencyFromKm(radiusEarth, featureSizeKm, cFeature) {`
    // computes 1.0 * (R * 6371) / Dchar, and multiplying by an exact 1.0 is exact in IEEE.
    // ⚠ ONE MEASURED EDGE, STATED RATHER THAN DISCOVERED: `craterUniformsFrom` floors its radius at
    // 1e-6 while `labPackCtx` passes the raw one (src/objects/Planet.js:2251 `displayRadiusEarth: gameDisplayRadiusEarth(condition.radiusEarth ?? d.radiusEarth ?? 1),`),
    // so the two arms agree on every radius at or above that floor and only there. Below it the
    // display policy is refused outright, so there is no silent band.
    // ⚠ AND THE BYTE-IDENTITY ARM AGAINST THE LAB IS STRUCTURALLY IMPOSSIBLE ON THIS ONE NAME. The
    // lab's write is planet-lod-lab.html:5358 `featureFrequencyFromKm(state.planetRadiusEarth, state.craterSizeKm, C_CRATER)`
    // — the REAL radius and then a further display multiply, i.e. R^1.5, while every other km-keyed
    // lab uniform resolves at the display pseudo-radius alone. The pack must NOT carry that trailing
    // multiply (it is the front-end's, and this file may not name it), so the gate over this driver
    // is a stated POLICY-DIFFERENCE assertion, not an identity.
    // ⛔ THE `Dchar === 0` BRANCH IS NOT A NULL CHECK — IT IS A DIVIDE-BY-ZERO GUARD, and the reason
    // is written into the constant it reads: src/worldengine/port/craterUniforms.js:96 `Dchar: 0,`
    // means "there is no characteristic diameter", not "the diameter is zero", and
    // src/worldengine/port/writePackUniforms.js:191 `if (typeof d.featureSizeKm !== 'number' || !Number.isFinite(d.featureSizeKm) || d.featureSizeKm <= 0) {`
    // would refuse it. So an un-cratered body forwards the paired `scale` VERBATIM —
    // src/worldengine/port/craterUniforms.js:89 `density: 0, scale: 1, amp: 0, complexD: 1, relaxation: 0, terraceCount: TERRACE_COUNT,`
    // — which is the value that ships today for this case and is inert behind a density of 0 anyway.
    uCraterScale: cu.Dchar > 0 ? sizeKm(cu.Dchar, C_CRATER) : cu.scale,

    // ── DECISION 1, SECOND HALF: `uCraterAmp` IS THE RECIPROCAL OF `uCraterScale`, AND ONLY ONE OF
    // THE PAIR CROSSES THE SEAM ─────────────────────────────────────────────────────────────────
    // ⚠⚠ THE TWO NAMES ABOVE AND BELOW ARE AN EXACT RECIPROCAL PAIR, DECLARED SO BY THE SHADER THAT
    // READS THEM, and the line above quietly put one of them behind a display policy. Say it here
    // rather than let a second front-end discover it:
    // src/worldengine/shaders/craterRelief.glsl.js:29 `//    frequency: uCraterAmp * uCraterScale == 1 exactly, so the crater slope is body-independent`
    // src/worldengine/port/craterUniforms.js:150 `  // amp * scale == 1 EXACTLY, which is why the crater slope is body-independent.`
    // and the GAME LEANS ON IT rather than merely documenting it — both analytic-normal call sites
    // skip a divide they would otherwise owe, for this reason and no other:
    // src/objects/Planet.js:312 `// the crater gradient is ALREADY a slope, because uCraterAmp * uCraterScale == 1 exactly (see`
    // src/objects/Planet.js:1385 `// because the crater slope is body-independent: uCraterAmp * uCraterScale == 1 EXACTLY (the`
    //
    // ⛔ SO THE PAIR DECOUPLES BY EXACTLY THE DISPLAY-POLICY RATIO. `uCraterScale` is km-shaped and
    // the writer resolves it at `ctx.displayRadiusEarth`; `uCraterAmp` is the raw crater law's
    // amplitude, computed by `craterUniformsFrom` from the REAL radius, and it crosses no seam at
    // all. Under the game policy the identity survives — that policy IS the identity, so nothing
    // ships wrong today and the pack's own test gates the emitted product. Under ANY OTHER display
    // policy the emitted product is `dispR / R` rather than 1. MEASURED 2026-08-19 over this pack's
    // own 24-seed corpus, resolving at a pseudo-radius of the square root of R: the product reaches
    // 10.77 on the smallest moon in the set — a 10.77x slope error in the one uniform pair the
    // analytic-normal path is allowed to trust, in a term no gate downstream re-derives.
    //
    // ⛔ AND THE FIX IS NOT AVAILABLE IN THIS FILE, which is why the hazard is written down instead
    // of closed. Emitting the reciprocal of the RESOLVED frequency would move shipped game values
    // (measured: it differs from `cu.amp` in the last ulp on 16 of the 53 fired bodies, a different
    // rounding order), and this module may not resolve a frequency at all — the contract's shape is
    // that the pack states a SIZE and the writer resolves it. Closing it properly needs an
    // INVERSE-km driver shape beside src/worldengine/port/writePackUniforms.js:83 `export function sizeKm(featureSizeKm, cFeature, opts) {`,
    // which is a port-layer change and not this commit's. UNTIL THEN: A SECOND FRONT-END PASSING A
    // NON-IDENTITY `displayRadiusEarth` MUST RESOLVE `uCraterAmp` ITSELF.
    uCraterAmp: cu.amp,
    // ⛔ THE GAME'S VALUE. See non-port 1 in the header for the refusal, quoted from its own source.
    uCraterComplexD: cu.complexD,
    uCraterRelaxation: cu.relaxation,
    uTerraceCount: cu.terraceCount,

    uEjectaStrength: scalar(cu.ejectaStrength * rel, { gate: EJECTA_GATE }),
    uEjectaRampart: cu.ejectaRampart,
    uEjectaAmp: cu.ejectaAmp,
    uEjectaLump: cu.ejectaLump,

    // ── The ground palette (5) ───────────────────────────────────────────────────────────────────
    // UNGATED ON PURPOSE, mirroring src/worldengine/drivers/limbDeck.js:143 `// Width and hue: forwarded, ungated, and UNGATED ON PURPOSE. They reproduce the lab, which`:
    // the lab writes the palette every frame regardless of any feature flag, and there is no palette
    // toggle to gate on. A colour behind a gate would leave a gated-off body wearing black ground.
    //
    // ⛔ `.slice()` ON EVERY COLOUR, AND IT IS NOT DEFENSIVE PROGRAMMING — IT IS THE FIX FOR A KNOWN
    // FAILURE MODE. The writer hands the array to a settable vector,
    // src/worldengine/port/writePackUniforms.js:280 `if (target && typeof target.set === 'function') target.set(...v);`
    // — and handing out a live array is how one body's tint follows another's
    // (src/worldengine/drivers/giantDeck.js:239 `// condition's array is shared with the record it came from and the writer hands it to a settable`).
    // ⚠ `applyAlbedoTransfer` happens to return fresh arrays TODAY (it maps every endmember). The
    // copy is taken anyway, because "no caller aliases my output" is a property of a module in
    // another directory, not of this one, and the failure it prevents is invisible on a still frame.
    uWeatheredColor: sp.weathered.slice(),
    uFreshColor: sp.fresh.slice(),
    uSedColor: sp.sediment.slice(),
    // ⭐ `uCratonColor` IS NOT ON LEDGER ROW P-12'S LIST, AND IT CLOSES HERE TOO — say so rather than
    // let it look like scope creep. Its producer already exists
    // (src/worldengine/base/surfaceMaterial.js:316 `const craton    = surfaceAlbedoOf(cond, { stable: true });`),
    // its shader consumer already reads it, and it is written by NOBODY in src/ today — the ancient
    // stable shield renders at the factory tone on every body in the game.
    uCratonColor: sp.craton.slice(),
    uBioGroundColor: sp.pigment.slice(),

    // ── The two surface scalars ──────────────────────────────────────────────────────────────────
    // Both are modules the game already imports and already writes to its LEGACY material
    // (src/objects/Planet.js:1657 `uBioGroundCover: { value: bioCover },`), so the swap is what loses
    // them. Re-derived from the condition here for the same reason the palette is.
    uBioGroundCover: biosphereOf(condition),
    uIcenessMix: icenessOf(condition),

    // ── The one global relief term ───────────────────────────────────────────────────────────────
    // ⭐ IT RIDES ONCE. The lab's own note at its write site is that the envelope applies at `uPerturb` and NOWHERE ELSE — applying it again at the crater amplitude squared it, which was a convicted defect. `uCraterAmp` above is therefore the raw crater law's value, unmultiplied, exactly as planet-lod-lab.html:5359 `uniforms.uCraterAmp.value        = state.craterAmp;` records. Do not "fix" the asymmetry between these two lines.
    uPerturb: PERTURB_BASE * relief,

    // ── B2 LEG 3: the base field's characteristic wavelength (ledger P-10 / M-09) ────────────────
    // ⭐ THE SECOND km-SHAPED DRIVER IN THIS PACK, and the second name whose VALUE this file refuses to author: `macroWavelengthKm` states a physical size in km and the writer resolves it at the front-end's display radius, exactly as `uCraterScale` does above. The eight-body calibration table, its two-convention caveat, the Io-anchored process term and every constant behind them live in src/worldengine/base/macroWavelength.js — ⛔ do not re-state any of them here. ⚠ UNGATED ON PURPOSE, AND THE SCOPE IS PINNED ELSEWHERE: tests/driver-pack-rockysurface.test.js:379 `  it('FAMILY 6b · GATE SCOPE: the two gates move those two names and NOTHING else', () => {` holds the gated set at exactly `uCraterDensity` and `uEjectaStrength`. There is no lab toggle over the base field, and a gate here would short-circuit to +0 — src/worldengine/port/writePackUniforms.js:186 `    if (!gates[d.gate]) return 0;` — i.e. hand a gated-off body a frequency of zero, one noise cell across the whole disc, a state neither front-end has ever rendered.
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
 * src/worldengine/drivers/index.js:140 `POLAR_DECK_ENTRY,`.
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
 * src/worldengine/drivers/index.js:175 `return PACKS.filter((e) => e.applies(condition, ctx) === true);`
 * and src/worldengine/drivers/index.js:219 `if (entry.applies(condition, ctx) !== true) { skipped.push(entry.name); continue; }`
 * — so a truthy non-boolean registers, reports as `skipped`, renders nothing, and throws nothing.
 * `!==` already yields a boolean; this is a note against a future rewrite, not a cast.
 *
 * ⚠ DISJOINTNESS FROM THE THREE SHIPPED PACKS IS BY CONSTRUCTION AND IS STILL ASSERTED. All three
 * are `compositionClass(condition) === 'gas'` character-for-character
 * (src/worldengine/drivers/index.js:100 `applies: (condition) => compositionClass(condition) === 'gas',`),
 * so this predicate is their exact complement and the collision throw at
 * src/worldengine/drivers/index.js:230 `throw new PackContractError(` is inert here. Inert is not the
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
