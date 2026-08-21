// src/worldengine/drivers/craterDeck.js
// ─────────────────────────────────────────────────────────────────────────────
// THE IMPACT RECORD — ONE DRIVER BLOCK, TWO PACKS. Ledger row P-14's crater half (block B3, leg 2,
// 2026-08-21).
//
//     craterDriverBlock(condition) -> { drivers, cu, rel }   the ten impact uniforms
//     craterDeckPack(condition, ctx)                          the GAS-side pack that emits them
//     CRATER_DECK_ENTRY                                       its registry entry
//
// ⭐ WHY THIS FILE EXISTS, AND WHY IT IS AN EXTRACTION RATHER THAN A NEW PACK'S OWN CODE.
// The ten impact drivers were written inside `rockySurfacePack`, whose predicate is
// `compositionClass(condition) !== 'gas'`. Ledger P-14 (docs/FEATURES/step6-parity-ledger.md:134) is
// the consequence: on a gas-class body NO pack writes the family, so a swapped gas world takes the
// lab material's factory schedule — src/worldengine/shaders/uniforms.js:170 `      uCraterAmp:        { value: 0.9 },   // overall crater relief amplitude (lab-tunable)`
// — while the game's own material writes what the shared producer actually answers. The row's words
// for that state are "a loud default behind a shut gate".
//
// ⛔ THE ONE THING THIS FILE REFUSES TO BE IS A SECOND COPY. The obvious way to close the row is to
// give a gas pack its own ten lines calling the same two producers. That is the failure this lane
// paid for eight days ago and again at B3 leg 1, where `tools/port-condition-delta.mjs` carried a
// THIRD transcription of the terminator law: three expressions of one law, free to drift, with every
// algebraic gate green. So the block moved OUT of `rockySurface.js` and both packs import it. There
// is exactly one expression of the impact drivers in `src/`, and
// tests/driver-pack-craterdeck.test.js asserts the two packs emit the identical map on a condition
// each is handed.
//
// ⛔ THE PREDICATES ARE EXACT COMPLEMENTS AND THAT IS THE WHOLE COLLISION ARGUMENT.
// `rockySurface` is `!== 'gas'`, this entry is `=== 'gas'`, so every body in any corpus is claimed by
// EXACTLY ONE writer of the family — never zero (which was P-14) and never two (which
// src/worldengine/drivers/index.js:330 `          throw new PackContractError(` refuses at run time).
// Asserted over a generated population by NAME LOOKUP in this pack's suite, not by reading two
// `applies` lines side by side.
//
// ⚠⚠ WHAT THE CLOSURE ACTUALLY WRITES ON A GAS BODY IS NOT ALWAYS ZERO, AND THAT IS DECLARED HERE
// RATHER THAN DISCOVERED LATER. `craterUniformsFrom` is TOTAL and condition-derived: it returns the
// frozen `CRATERS_OFF` for any body that is not an impact surface, and a live schedule for any body
// that is. MEASURED over `lab-procedural-0…199` (this session): of 343 gas-class planets, 285 have
// `craterRelevanceOf > 0` and 204 have a schedule that FIRES, with `uCraterAmp` reaching 0.0310 and
// `uCraterDensity` reaching 1.0837e-3. So this pack does not "switch craters off on gas worlds" —
// it forwards the same producer the game's legacy material already calls at
// src/objects/Planet.js:1596 `    const craters = craterRelevanceOf(condition) > 0` , which is what
// makes P-14 a WIRING row. The direction of the fix is toward the game's shipped answer, on every
// body, and never toward a number this file chose.
//
// ⛔ THREE-FREE, NO ENTROPY, NO TYPE LABEL. The import closure is base/ + port/, which
// tests/pack-contract.test.js walks. No `Math.random`, no `Date.now`, no alea stream, no preset name.
// ⛔ NO CALIBRATION CONSTANT IS TYPED HERE. `C_CRATER` is a forward of the lab's own declaration and
// every other number in the family comes off `craterUniformsFrom`; the suite pins this file's whole
// numeric-literal set for the same reason `rockySurface.js`'s is pinned.
// ─────────────────────────────────────────────────────────────────────────────
import { compositionClass } from '../base/e1Regime.js';
import { craterRelevanceOf } from '../base/bombardment.js';
import { craterUniformsFrom } from '../port/craterUniforms.js';
import { sizeKm, scalar, assertDisplayPolicy, assertPackResult, PackContractError } from '../port/writePackUniforms.js';

// ── The two declared gate names ──────────────────────────────────────────────────────────────────
// ⭐ NAMES, NOT HARDCODED 1.0s, and TWO of them rather than one, because the lab has two independent
// toggles over this family and they do not switch together:
//   planet-lod-lab.html:5354 `= state.cratersEnabled ? state.craterDensity * state.craterRelevance : 0.0;`
//   planet-lod-lab.html:5361 `= state.ejectaEnabled ? state.ejectaStrength * state.craterRelevance : 0.0;`
// Ejecta off with craters on is a real lab state; collapsing the two into one gate would delete a
// rendering decision rather than express it. One spelling each, shared by the driver and BOTH
// entries — src/worldengine/drivers/rockySurface.js re-exports them so neither pack can declare a
// gate name the driver does not key on, which
// src/worldengine/port/writePackUniforms.js:180 `if (gates == null || !(d.gate in gates)) {` would
// otherwise only catch on the first admitted body.
export const CRATER_GATE = 'craters';
export const EJECTA_GATE = 'ejecta';

// ⚠ C_CRATER is the per-feature calibration constant of the km→frequency law, ported from the lab's
// own declaration, planet-lod-lab.html:821 `const C_CRATER = 1.0;`, whose comment two lines above
// states the identity it encodes: C = 1 means `uCraterScale = radius_km / craterSizeKm`. It is
// written out rather than inlined into the `sizeKm(...)` call for the reason recorded at
// src/worldengine/drivers/giantDeck.js:101 `and that is a byte-identity decision, not a` — a
// calibration constant buried in a call argument is a constant that gets "simplified" away.
// ⭐ IT MOVED HERE FROM `rockySurface.js` WITH THE DRIVERS IT CALIBRATES, 2026-08-21. Leaving it
// behind would have put the constant in one file and its only consumer in another.
export const C_CRATER = 1.0;

/**
 * The ten impact drivers, from a condition vector alone.
 *
 * ⭐ IT RETURNS `cu` AND `rel` ALONGSIDE THE DRIVERS ON PURPOSE. `rockySurfacePack` reports both in
 * its `meta` (the only place a test can tell an un-cratered world from a crater-irrelevant one), and
 * a second call to `craterUniformsFrom` for that would be a second derivation of the same body — pure
 * and therefore harmless today, and exactly the shape that stops being harmless the day the producer
 * takes an argument. One derivation, handed out.
 *
 * ⛔ NO `ctx`. Not one of the ten reads the display policy: `uCraterScale` is emitted km-SHAPED and
 * the WRITER resolves it (DECISION 1 below). A block that took `ctx` would invite a front-end to
 * resolve the frequency here, which is the seam this contract exists to keep visible.
 *
 * @param {object} condition  a body condition vector (deriveConditionVector / conditionFromBody).
 * @returns {{drivers: object, cu: object, rel: number}}
 */
export function craterDriverBlock(condition) {
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

  const drivers = {
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
  };

  return { drivers, cu, rel };
}

// ─────────────────────────────────────────────────────────────────────────────
// THE GAS-SIDE PACK
// ─────────────────────────────────────────────────────────────────────────────
/**
 * The impact family on the population `rockySurface` does not claim.
 *
 * ⚠ IT EMITS NOTHING ELSE, and the omissions are the behaviour. A gas world gets no palette, no
 * iceness, no relief envelope and no domain offsets from here: those are rocky-surface quantities
 * whose rows are ruled elsewhere, and P-15 rules explicitly AGAINST a rocky pack claiming a gas body
 * (docs/FEATURES/step6-parity-ledger.md:135 — `uNoiseScale`'s gas half is `accepted-loss` because the
 * lab spends that spelling as a band-warp frequency there). This pack closes ONE row.
 *
 * @param {object} condition  a body condition vector.
 * @param {object} ctx        the Step-5a pack context. `displayRadiusEarth` is REQUIRED and IS
 *                            consumed — `uCraterScale` is km-shaped, so unlike the gas deck this
 *                            pack's policy seam is not vacuous.
 * @returns {{drivers: object, attributes: object, meta: object}}
 */
export function craterDeckPack(condition, ctx = {}) {
  if (condition == null || typeof condition !== 'object') {
    throw new PackContractError('craterDeckPack: condition vector is missing.');
  }
  assertDisplayPolicy(ctx);

  const { drivers, cu, rel } = craterDriverBlock(condition);

  // ⚠ POPULATED, NOT DECORATIVE, and deliberately the SAME five fields `rockySurfacePack` reports for
  // this family — an un-cratered world and a crater-irrelevant world both write a density of 0 and
  // are otherwise indistinguishable from outside. `cratersFired` reads `Dchar > 0` rather than
  // `density > 0` because src/worldengine/port/craterUniforms.js:96 `  Dchar: 0,` means "this body has
  // no resolvable crater band at all", while a density of 0 also covers a body whose band exists and
  // whose coverage rounded away under
  // src/worldengine/port/craterUniforms.js:79 `export const CRATER_MIN_VISIBLE = 1.0;`.
  const meta = {
    compositionClass: compositionClass(condition),
    craterRelevance: rel,
    cratersFired: cu.Dchar > 0,
    craterDensity: cu.density * rel,
    Dchar: cu.Dchar,
    complexD: cu.complexD,
    ejectaStrength: cu.ejectaStrength * rel,
  };

  // ⛔ `attributes` IS AN EXPLICIT EMPTY OBJECT, NEVER `undefined` —
  // src/worldengine/port/writePackUniforms.js:306 `"this pack has no attributes" and "this pack forgot" must not look the same.`
  return assertPackResult({ drivers, attributes: {}, meta }, 'craterDeckPack');
}

// ─────────────────────────────────────────────────────────────────────────────
// THE REGISTRY ENTRY
// ─────────────────────────────────────────────────────────────────────────────
/**
 * ⭐ EXPORTED AS A FROZEN ENTRY rather than assembled at the registry, mirroring
 * src/worldengine/drivers/rockySurface.js:349 `  applies: (condition) => compositionClass(condition) !== 'gas',`
 * — one import plus one array element, and the predicate cannot be retyped differently from the one
 * this pack's own test gates.
 *
 * ⛔ IT MOVES NO BODY BETWEEN MATERIALS, and that is measured rather than argued. Every gas-class body
 * is already claimed by `giantDeck`, so the `packs.length > 0` term of
 * src/objects/Planet.js:2194 `      admitted: flag.enabled && provenance.isWorldEngine && packs.length > 0,`
 * cannot flip for any record, and no census is re-pinned by this registration. This is Step 10a's
 * entry inverted: that one WAS the first to widen the swapped population and said so.
 *
 * ⚠ IT MUST RETURN THE BOOLEAN. Both admission sites compare with `=== true`
 * (src/worldengine/drivers/index.js:275 `return PACKS.filter((e) => e.applies(condition, ctx) === true);`),
 * so a truthy non-boolean registers, reports as `skipped`, renders nothing and throws nothing.
 * `===` already yields a boolean; this is a note against a future rewrite, not a cast.
 */
export const CRATER_DECK_ENTRY = Object.freeze({
  name: 'craterDeck',
  applies: (condition) => compositionClass(condition) === 'gas',
  gates: Object.freeze([CRATER_GATE, EJECTA_GATE]),
  pack: craterDeckPack,
});

/**
 * The uniform names the block writes, as a frozen SET for the collision, scope and membership gates.
 * ⭐ It is the SAME set on both packs by construction — `rockySurface`'s own exported set contains
 * every one of these — so a name added to the block reaches both populations or neither.
 */
export const CRATER_DECK_UNIFORMS = Object.freeze([
  'uCraterDensity', 'uCraterScale', 'uCraterAmp', 'uCraterComplexD', 'uCraterRelaxation',
  'uTerraceCount', 'uEjectaStrength', 'uEjectaRampart', 'uEjectaAmp', 'uEjectaLump',
]);
