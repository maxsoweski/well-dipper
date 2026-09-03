// src/worldengine/drivers/stormDeck.js
// ─────────────────────────────────────────────────────────────────────────────
// DRIVER PACK #10 — THE STORM SLICE. F27 the great-spot anticyclone + F28 the storm clusters, carried
// by the `uStorm*` uniform family. Workstream wire-storm-slice-lab-into-game (greenlit 2026-09-03).
//
//     stormDeckPack(condition, ctx) -> { drivers, attributes, meta }
//
// ⭐ WHAT THIS PACK ACTUALLY IS, STATED SO NOBODY HAS TO INFER IT. The storm WRITER was never lab-local:
// src/worldengine/base/storm-e.js `export function resolveStormE(` has been shared, pure and three-free
// since the #3b merge, and the game has called it since 2026-08-28 through pack #1's mask bake
// (giantDeck.js `bakeStormEAttributes(`). What was lab-local — and what this module MOVES rather than
// re-authors — is the three things that stood between the writer and the eight carriage slots:
//   1. the COLOUR LAW    world-engine-lab.html's `_stormColor` (chromophore age ramp, 20 % deck tint,
//                        barge / scooter / dark-spot branches)             -> `stormColor`
//   2. the DECK-HEIGHT   `_stormDeckZ` over STORM_DECK (tower / floor)     -> `stormDeckZ`
//   3. the SLOT COMPOSER the per-frame loop in `frame()` (slot 0 = primary iff its gate, train iff its
//                        gate, cap 8, aux slot-synced, count = written)    -> `forEachStormSlot`
// plus the mapping from a writer result to the lab's fifteen `state.*` storm fields, which the lab
// wrote by hand at world-engine-lab.html:1811 `function applyStormState(){` and now reads back through
// `stormDeckLabState`. Both front-ends import every one of these; the lab's copies are deleted and
// tests/driver-pack-stormdeck.test.js deny-scans for them. The byte-identity evidence is a FIXTURE of
// the lab's own output captured BEFORE the move (tests/fixtures/storm-lab-state-baseline.json, sliced
// from the pinned blob and run through `new Function` — not re-typed), so "the pack reproduces the
// lab" is a claim a test can falsify rather than an agreement by construction.
//
// ⛔ WHY THIS IS A SEPARATE PACK AND NOT MORE LINES IN giantDeck.js OR polarDeck.js. Pack #1 carries a
// loud and CORRECT fence — giantDeck.js:23 `uStormCount` and the whole `uStorm*` family are out — and
// polarDeck.js:43 fences the same names from the pole. Both fences stay TRUE under this design: what
// changed is that a THIRD sibling now has the producer in scope. The uniform-collision throw in
// src/worldengine/drivers/index.js guarantees the three cannot silently overlap; their emitted sets are
// disjoint (`uBand*`/`uJet*` vs `uPolar*` vs `uStorm*`) and the pack test asserts that by membership.
//
// ⛔ WHAT THIS PACK DELIBERATELY DOES NOT DO — read before adding a uniform.
// ---------------------------------------------------------------------------------------------
//  · IT BAKES NOTHING. `aStorm` is pack #1's (giantDeck.js:309 `attributes.aStorm = stormBake.aStorm;`)
//    and `attributes` here is ALWAYS empty. The mask and the vortices are two readers of ONE
//    (regime, drivers, macroSeed, stormSeed) tuple — coherence is TESTED (the pack's `meta.vortices`
//    deep-equals the mask bake's own vortex list on every corpus gas body), not assumed.
//  · IT RE-DERIVES PACK #1'S INPUT CHAIN rather than reading pack #1's `meta`: packs cannot see each
//    other's results inside `runPacks`, and a pack that depended on array order would be the ordering
//    dependency the collision throw exists to forbid. The chain (`giantRegimeOf` on the UN-drawn
//    condition → `drawGiantConditions` → `deriveGiantDrivers` → `giantDriverScalars` + the front-end's
//    overrides) is deterministic, so the two derivations agree — and the test above says whether they do.
//  · `trainRadiusScale` IS A LAB KNOB (world-engine-lab.html:1011 `trainRadiusScale: 1.0,`), not a
//    uniform: the lab's frame loop multiplies it onto every train radius. The game passes nothing and
//    the composer's default is 1 (= the derived size); the pack test asserts the lab default equals 1,
//    the POLAR_LAB_KNOBS precedent.
//  · NO PER-FEATURE RELEVANCE KEY. The lab's storm write carries no `featureRelevant` multiply
//    (unlike the polar write beside it) — measured, not assumed — so `GAME_RELEVANCE` stays empty.
//  · NO NEW SEED. `GAME_STORM_SEED` is imported from polarDeck.js, where it was AUTHORED with its
//    reasoning on Max's 2026-08-22 ruling; a second 0 here would be a silent duplicate law.
//  · NO OBLIQUITY FOR GAME BODIES. `resolveStormE`'s Uranian read needs `obliquityDeg ≥ 80` on a
//    Neptunian body; the game passes none, so the branch is unreachable there and the pack test
//    RECORDS it as 0 of the corpus rather than wiring around it.
//
// ⭐ THE ONE PACK-CONTRACT EXTENSION THIS PACK NEEDED, and where it lives. The carriage is three
// `vec4[8]`, one `vec3[8]` and an `int`; the writer admitted flat numeric arrays only, and its
// element-wise branch would have REPLACED the material's Vector4 slots with plain arrays — rendering as
// nothing, throwing nowhere. writePackUniforms.js now admits an array of equal-length numeric arrays
// and writes it slot-wise through each element's `.set(...)`. Every pre-existing driver is byte-inert
// under that change (tests/fixtures/pack-drivers-baseline.json, 156 bodies + 18 presets), and this is
// the only pack that emits the shape. The arrays emitted here carry EXACTLY `count` rows: the writer
// touches only those slots and the material's zero defaults stand behind the count, which is what the
// lab's frame loop leaves behind too (it never clears a slot it did not write).
//
// ⛔ THREE-FREE. The import closure is base/ + port/ + the two sibling packs' CONSTANTS. `alea` is
// reachable through storm-e.js, as it already is through giantDeck.js's own closure.
// ⛔ NO `Math.random`, NO `Date.now`. The only entropy is the six `stormE:*` alea streams keyed on
// (`ctx.macroSeed`, the declared storm seed).
// ─────────────────────────────────────────────────────────────────────────────
import { compositionClass, giantRegimeOf } from '../base/e1Regime.js';
import { drawGiantConditions, deriveGiantDrivers, giantDriverScalars } from '../base/giant-drivers.js';
import { resolveStormE, chromophoreColor, STORM_DECK } from '../base/storm-e.js';
import { DECK_LAW } from './giantDeck.js';
import { GAME_STORM_SEED } from './polarDeck.js';
import {
  assertMacroSeed, assertDisplayPolicy, assertPackResult, PackContractError,
} from '../port/writePackUniforms.js';

// ── The two gates, spelled once ─────────────────────────────────────────────────────────────────
// The lab's ✓ checkboxes (world-engine-lab.html:1007 `greatSpotEnabled` / :1012 `stormTrainEnabled`)
// become two registry gates; `gatesFor` builds ALL_ON from the entry's names. Unlike a scalar driver
// the composed slots cannot carry a `gate` option, so the pack reads `ctx.gates` itself and applies
// the writer's rule by hand: an ABSENT key throws (it is an unanswered rendering decision, not a no).
export const GREAT_SPOT_GATE = 'greatSpot';
export const STORM_TRAIN_GATE = 'stormTrain';

// The five DRIVEN uniforms, named as a set so the pack test asserts membership rather than a count.
export const STORM_DRIVEN = Object.freeze([
  'uStormPosSize', 'uStormParams', 'uStormColor', 'uStormAux', 'uStormCount',
]);
// The lab knob this pack must NOT write (a `state` field, no uniform). Exported so the fence is checkable.
export const STORM_LAB_KNOBS = Object.freeze(['trainRadiusScale']);
// The carriage cap — src/worldengine/shaders/uniforms.js declares eight slots per array.
export const STORM_SLOT_CAP = 8;

// ── The colour law, ported verbatim from the lab's `_stormColor` as NAMED coefficients ──────────
// ⚠ Written as named coefficients for the reason recorded at giantDeck.js:101: a tuned triple buried in
// a return statement is a triple that gets "cleaned up" by someone who thought they were simplifying.
// The arithmetic is the lab's, operation for operation, so the fixture comparison is exact.
export const STORM_COLOR_LAW = Object.freeze({
  BARGE: Object.freeze([0.50, 0.42, 0.38]),   // brown barge (dark cyclonic): deck tint × these
  SCOOTER: Object.freeze([0.85, 0.90, 1.0]),  // Neptune blue-white companion: an absolute colour
  WARM_TINT_W: 0.20,                          // grs / pearl / oval: 20 % deck tint …
  WARM_CHROMO_W: 0.80,                        // … + 80 % chromophore (white → brick-red by age)
});
// The deck tint the colour law reads when a body carries no atmosphere colour. It is the material's
// own `uBandTint` default (src/worldengine/shaders/uniforms.js `uBandTint:` 0.78/0.62/0.44) and the
// lab's `state.bandTint` boot value — the same number in both front-ends. `meta.tintFallback` says
// when it was used; the pack test asserts 0 uses over the corpus.
export const STORM_TINT_FALLBACK = Object.freeze([0.78, 0.62, 0.44]);

/**
 * The core colour of one vortex. `role` ∈ grs | pearl | oval | barge | scooter | dark-spot;
 * `mode` 0 warm / 1 dark; `age` the writer's place-once ageScalar; `coreScale` the ice-giant dark-core
 * visibility (undefined on warm primaries and on every train member — defaults to 1, as the lab's did).
 */
export function stormColor(role, mode, age = 0, coreScale = 1, bandTint = STORM_TINT_FALLBACK) {
  const _bt = bandTint;
  if (role === 'dark-spot') {
    // V-β.3 lifecycle: coreScale = dark-core visibility (precursor 0 = NO cleared hole, blends into the
    // deck; mature 1 = full clearing). Blend the cleared colour toward the deck tint by (1 − coreScale).
    const _d = chromophoreColor(age, 1);
    const cs = (coreScale == null) ? 1 : coreScale;
    return [_bt[0] * (1 - cs) + _d[0] * cs, _bt[1] * (1 - cs) + _d[1] * cs, _bt[2] * (1 - cs) + _d[2] * cs];
  }
  const L = STORM_COLOR_LAW;
  if (role === 'barge') return [_bt[0] * L.BARGE[0], _bt[1] * L.BARGE[1], _bt[2] * L.BARGE[2]];
  if (role === 'scooter') return [L.SCOOTER[0], L.SCOOTER[1], L.SCOOTER[2]];
  const _cr = chromophoreColor(age, 0);
  return [
    _bt[0] * L.WARM_TINT_W + _cr[0] * L.WARM_CHROMO_W,
    _bt[1] * L.WARM_TINT_W + _cr[1] * L.WARM_CHROMO_W,
    _bt[2] * L.WARM_TINT_W + _cr[2] * L.WARM_CHROMO_W,
  ];
}

/**
 * The deck a storm occupies IS the storm (atmo-deck-spiral S2 §3.1): a warm mode-0 anticyclone earns a
 * TOWER above the zone deck, height ∝ prominence (older/redder = higher: prom = 0.35 + 0.65·age); a
 * mode-1 dark spot is a hole that reveals the deep FLOOR. Consumed by the `uStormAux.z` slot.
 */
export function stormDeckZ(mode, age) {
  return (mode >= 0.5)
    ? STORM_DECK.FLOOR
    : STORM_DECK.ZONE + (STORM_DECK.TOWER - STORM_DECK.ZONE) * (0.35 + 0.65 * (age ?? 0));
}

// ── The fifteen lab fields, named as a set ───────────────────────────────────────────────────────
// This is the vocabulary BOTH the lab's `state` and the composer speak; the lab's ~200 `.listen()`
// controllers read these names, which is why the record is in the lab's spelling and not the writer's.
export const STORM_LAB_FIELDS = Object.freeze([
  'spotStrength', 'spotCenter', 'spotRadius', 'spotRot', 'spotAspect', 'spotMode', 'spotColor',
  'spotCompanion', 'spotAge', 'spotEmboss', 'spotBillow',
  'trainStrength', 'trainSpots', 'trainCount', '_stormUranian',
]);

/**
 * THE SLOT COMPOSER — one law, two sinks. Walks the slots the lab's frame loop used to write by hand:
 * slot 0 = the great spot iff `gates.greatSpot` and `spotStrength > 0`; the next slots = the train
 * members iff `gates.stormTrain` and `trainStrength > 0`, capped at STORM_SLOT_CAP; `uStormAux` is
 * written at the SAME slot index as the three arrays (S2 slot-sync: with the great spot off, train
 * members occupy slot 0+, so a naive aux[0] = primary would desync deck/emboss scalars).
 *
 * @param {object} s      a storm record in the lab's vocabulary (STORM_LAB_FIELDS) plus the optional
 *                        lab knob `trainRadiusScale` (default 1 = the derived size).
 * @param {object} gates  { greatSpot, stormTrain } — the lab's checkboxes, or ALL_ON in the game.
 * @param {(i:number, posSize:number[4], params:number[4], color:number[3], aux:number[4]) => void} write
 * @returns {number} the count of slots written — the `uStormCount` value.
 */
export function forEachStormSlot(s, gates, write) {
  let _stormN = 0;
  const trs = s.trainRadiusScale ?? 1;
  if (gates.greatSpot && s.spotStrength > 0) {
    write(0,
      [s.spotCenter[0], s.spotCenter[1], s.spotCenter[2], s.spotRadius],
      [s.spotRot, s.spotAspect, s.spotMode, s.spotCompanion],
      [s.spotColor[0], s.spotColor[1], s.spotColor[2]],
      [s.spotAge, s.spotEmboss, stormDeckZ(s.spotMode, s.spotAge), s.spotBillow]);
    _stormN = 1;
  }
  if (gates.stormTrain && s.trainStrength > 0) {
    for (let i = 0; i < s.trainSpots.length && _stormN < STORM_SLOT_CAP; i++, _stormN++) {
      const t = s.trainSpots[i];
      write(_stormN,
        [t.center[0], t.center[1], t.center[2], t.radius * trs],
        [t.rot, t.aspect, t.mode, t.companion],   // the TRUE mode (S2 §0.4)
        [t.color[0], t.color[1], t.color[2]],
        [t.age, t.embossDir, stormDeckZ(t.mode, t.age), t.billowPhase]);
    }
  }
  return _stormN;
}

/** The composer's array form — what the pack emits and what the tests compare. Rows = `count`. */
export function composeStormSlots(s, gates) {
  const posSize = [], params = [], color = [], aux = [];
  const count = forEachStormSlot(s, gates, (i, ps, pr, c, a) => { posSize[i] = ps; params[i] = pr; color[i] = c; aux[i] = a; });
  return { count, posSize, params, color, aux };
}

// The record the lab writes off-gate: strength 0, no train, not Uranian; the spot fields are left as
// they were. ⛔ NOT an empty mirror — the lab's own comment at :1811 records why: an early-return that
// wrote nothing would leave a gas world's storms on `state` after a gas→solid preset change.
const OFF_GATE_LAB_STATE = Object.freeze({
  spotStrength: 0, trainStrength: 0, trainSpots: Object.freeze([]), trainCount: 0, _stormUranian: false,
});

function labStateOf(storm, bandTint) {
  const out = { spotStrength: storm.strength };
  if (storm.primary) {
    const p = storm.primary;
    out.spotCenter = p.center;
    out.spotRadius = p.radius;
    out.spotRot = p.rot;
    out.spotAspect = p.aspect;
    out.spotMode = p.mode;
    out.spotColor = stormColor(p.role, p.mode, p.ageScalar, p.coreScale, bandTint);
    out.spotCompanion = p.companion;
    out.spotAge = p.ageScalar;
    out.spotEmboss = p.embossDir;
    out.spotBillow = p.billowPhase;
  }
  out.trainStrength = storm.strength;
  out.trainSpots = storm.train.map((v) => ({
    center: v.center, radius: v.radius, rot: v.rot, aspect: v.aspect,
    color: stormColor(v.role, v.mode, v.ageScalar, undefined, bandTint), companion: v.companion,
    age: v.ageScalar, embossDir: v.embossDir, billowPhase: v.billowPhase, mode: v.mode,
  }));
  out.trainCount = out.trainSpots.length;
  out._stormUranian = storm.uranian;
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// THE PACK
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @param {object} condition  a body condition vector (deriveConditionVector / conditionFromBody).
 * @param {object} ctx
 *   THE FIVE CONTRACT FIELDS (PLAN 5a):
 *   @param {number} ctx.macroSeed           integer, non-zero.
 *   @param {number} ctx.displayRadiusEarth  the front-end's display policy. Carried, not consumed: not
 *                                           one storm driver is km-shaped (radii are ANGULAR), so the
 *                                           policy seam is vacuous here exactly as it is for the pole.
 *   @param {number} ctx.animRate            unread — every storm term in the shader is static.
 *   @param {object} ctx.gates               must carry `greatSpot` AND `stormTrain`; an absent key throws.
 *   @param {object} ctx.relevance           unread (see the header).
 *   PACK #1's INPUT-CHAIN FIELDS (the same names, the same fallbacks):
 *   @param {number} [ctx.rotationHours]     the drawn spin; falls back as giantDeck.js does.
 *   @param {number} [ctx.rotationScale]     default 1.
 *   @param {object} [ctx.e5DriverOverrides] the front-end's own E5 overrides, merged LAST.
 *   @param {number} [ctx.obliquityDeg]      > 0 forwards; 0/absent = regime default.
 *   PACK-SPECIFIC:
 *   @param {number} [ctx.stormSeed]         the placement half of the seed pair; defaults to the
 *                                           DECLARED `GAME_STORM_SEED`.
 * @returns {{drivers: object, attributes: object, meta: object}}
 */
export function stormDeckPack(condition, ctx = {}) {
  if (condition == null || typeof condition !== 'object') {
    throw new PackContractError('stormDeckPack: condition vector is missing.');
  }
  assertDisplayPolicy(ctx);
  const macroSeed = assertMacroSeed(ctx.macroSeed);
  const gates = ctx.gates;
  for (const g of [GREAT_SPOT_GATE, STORM_TRAIN_GATE]) {
    if (gates == null || !(g in gates)) {
      throw new PackContractError(
        `stormDeckPack: ctx.gates has no '${g}' key. An absent gate is not an off gate and is not an ` +
        'on gate — it is an unanswered rendering decision (the writer\'s rule, applied by hand because ' +
        'a composed slot array cannot carry a gate option).',
      );
    }
  }
  const stormSeed = ctx.stormSeed ?? GAME_STORM_SEED;
  const gas = compositionClass(condition) === 'gas';

  const drivers = {};
  const attributes = {};   // ⚠ ALWAYS EMPTY. `aStorm` is pack #1's.
  const meta = {
    gas, regime: null, vigor: null, strength: 0, count: 0, writerCount: 0,
    primary: null, train: [], vortices: [], uranian: false, hotJupiter: false,
    stormSeed, e5Drivers: null, tintFallback: false, labState: { ...OFF_GATE_LAB_STATE, trainSpots: [] },
  };

  if (!gas) {
    // Nothing is EMITTED on a solid body (the registry predicate never applies the pack there; this
    // branch exists for direct callers), but the LAB MIRROR is the off-gate reset, not nothing — see
    // OFF_GATE_LAB_STATE.
    return assertPackResult({ drivers, attributes, meta }, 'stormDeckPack');
  }

  // ── Pack #1's input chain, re-derived (see the header for why it is not read off pack #1) ─────────
  // ⛔ ORDER — CLASSIFY THE UN-DRAWN CONDITION (giantDeck.js:269 `const regime = giantRegimeOf(condition);`).
  const regime = giantRegimeOf(condition);
  const drawnCondition = drawGiantConditions(regime, condition, macroSeed);
  const triple = deriveGiantDrivers(drawnCondition);
  const rotationHours = ctx.rotationHours ?? condition.rotationHours ?? DECK_LAW.ROT_FALLBACK;
  const e5Drivers = {
    ...triple,
    ...giantDriverScalars(condition.radiusEarth, rotationHours, ctx.rotationScale ?? 1),
    ...(ctx.e5DriverOverrides || {}),
  };
  if ((ctx.obliquityDeg ?? 0) > 0) e5Drivers.obliquityDeg = ctx.obliquityDeg;
  // The exact bundle pack #1 hands the MASK bake (giantDeck.js:309): the E5 drivers + the gas gate + the
  // personality ramp's temperature. Same tuple, same seeds ⇒ the same vortices the mask was placed around.
  const inputs = {
    ...e5Drivers,
    composition: condition.atmosphere && condition.atmosphere.composition,
    T_eq: condition.T_eq,
  };
  const storm = resolveStormE(regime, inputs, macroSeed, stormSeed);

  // The deck tint the colour law reads — the field pack #1 makes `uBandTint` from and the polar pack
  // makes its cap tint from, so the three packs agree by construction on every body.
  const tint = condition.atmosphere && condition.atmosphere.color;
  const hasTint = Array.isArray(tint) && tint.length >= 3;
  const bandTint = hasTint ? tint : STORM_TINT_FALLBACK;

  const labState = labStateOf(storm, bandTint);
  const composed = composeStormSlots({ ...labState, trainRadiusScale: 1 }, gates);

  drivers.uStormPosSize = composed.posSize;
  drivers.uStormParams = composed.params;
  drivers.uStormColor = composed.color;
  drivers.uStormAux = composed.aux;
  drivers.uStormCount = composed.count;

  meta.regime = regime;
  meta.vigor = storm.vigor;
  meta.strength = storm.strength;
  meta.count = composed.count;
  meta.writerCount = storm.count;
  meta.primary = storm.primary;
  meta.train = storm.train;
  meta.vortices = storm.vortices;
  meta.uranian = storm.uranian;
  meta.hotJupiter = storm.hotJupiter;
  meta.e5Drivers = e5Drivers;
  meta.tintFallback = !hasTint;
  meta.labState = labState;

  return assertPackResult({ drivers, attributes, meta }, 'stormDeckPack');
}

/**
 * The runtime registry entry, exported so index.js ADDS it rather than RETYPES it (polarDeck's reason).
 * ⚠ Character-identical predicate to giantDeck's / limbDeck's / polarDeck's on purpose: storms are a
 * gas-class feature, so registration must admit EXACTLY the bodies already admitted and no others.
 */
export const STORM_DECK_ENTRY = Object.freeze({
  name: 'stormDeck',
  applies: (condition) => compositionClass(condition) === 'gas',
  gates: Object.freeze([GREAT_SPOT_GATE, STORM_TRAIN_GATE]),
  pack: stormDeckPack, labState: stormDeckLabState,
});

/**
 * THE LAB SEAM — the fifteen `state.*` fields the lab used to write by hand, UNGATED (the lab applies its
 * own ✓ checkboxes in `frame()` through `forEachStormSlot`; mirroring a gated value would gate twice).
 * Returns ONLY the fields the lab would have written: all fifteen on a gas body with a primary, the five
 * off-gate fields on a solid body or a hot Jupiter (spot fields untouched, as the lab left them).
 */
export function stormDeckLabState(pack) {
  return { ...pack.meta.labState };
}
