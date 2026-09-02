// src/worldengine/drivers/fluvialDeck.js
// ─────────────────────────────────────────────────────────────────────────────
// DRIVER PACK #9 — THE FLUVIAL DECK. docs/WORKSTREAMS/wire-river-router-lab-into-game/, 2026-09-02.
//
//     fluvialDeckPack(condition, ctx) -> { drivers, attributes, meta }
//
// FUNCTION: it is the lab's own fluvial derivation — world-engine-lab.html:2123-2167, the block that
// answers FIVE features from one set of locals — expressed ONCE, in a module both front-ends call:
//
//     F11 fluvial networks   uFluvialActivity · uFluvialDepth · uFluvialMeander  (+ the DENSITY, meta-only)
//     F14 lakes & seas       uSeaLevel · uLiquidMask
//     F12 deltas & fans      uDeltaDensity
//     F20 coastlines         uCoastStrength · uStrandStrength
//     F13 outflow channels   uOutflowDensity · uOutflowActivity
//
// INTENT: those ten names were DECLARED on the lab material (src/worldengine/shaders/uniforms.js:310
// -344) and written by NOTHING under src/, so every solid body the game swaps onto that material
// rendered the whole family at its factory default — uSeaLevel -1, uCoastStrength 0, uOutflowDensity
// 0, uLiquidMask 0. No sea, no coast, no channels, on every body in the galaxy, while the lab has
// answered all five from a condition since 2026-06-07.
//
// ⭐ THE FIVE FEATURES MOVE TOGETHER, AND THAT IS THE SCOPING RULING (intent.md, decision 5): F12's
// density is F11's density times F11's activity, F20's gate IS F14's sea, and F13 reuses F11's relict
// branch. Leaving half behind would make a state that exists in neither front-end.
//
// ⭐ NOT ONE LAW IS INVENTED HERE. Every expression below is transcribed character-for-character from
// the lab lines cited beside it; the three inputs it does not read off the condition come from ONE
// `deriveUniforms(condition)` bundle (src/worldengine/base/labCore.js), which is the same call the
// lab's own driver step makes at world-engine-lab.html:1943 before the block runs. The pack's suite
// re-transcribes the block INDEPENDENTLY and compares to the last bit over 124 solid bodies, because
// re-deriving a law on the way through is the one thing a wiring commit can get wrong.
//
// ⛔⛔ THE SEAM IS THE CONDITION VECTOR, NOT THE FROZEN PRESET. The lab's block reads `_fp` —
// world-engine-lab.html:2127 `const _fp = DRIVER_PRESETS[driverUI.preset];` — for erosion, atmosphere
// and volatiles, which is seed-DEAF: every seed of one preset would answer the same rivers. This pack
// reads all three off `condition` (`surfaceHistory.erosion`, `atmosphere`, `composition
// .volatileFraction`), and the lab's read-back at :2136 hands it the PER-SEED draw for exactly the
// reason pack #2's call site records at world-engine-lab.html:2074. `_fp` survives in the lab only
// below the read-back, for F21 karst and F15 dunes, which are not in this pack's scope.
//
// ⛔⛔ THREE GATES, NOT FOUR — `uSeaLevel` IS EMITTED UNGATED, AND THAT IS A MEASURED DECISION RATHER
// THAN AN OVERSIGHT. The lab has FOUR checkboxes over this family, and the fourth is `lakesEnabled`
// (world-engine-lab.html:5082 `uniforms.uSeaLevel.value = state.lakesEnabled ? state.seaLevel : -1.0;`).
// Its off-value is -1, meaning NO LIQUID. But the writer's gate short-circuits to exactly +0
// (src/worldengine/port/writePackUniforms.js `if (!gates[d.gate]) return 0;`) and `makeDriver` has no
// off-value field, so a `lakes`-gated uSeaLevel would resolve to 0 with the gate off — a sea AT THE
// DATUM, drowning every basin on the body, which is the opposite of what the checkbox means. So:
//   · the pack declares `deltas`, `coast` and `outflow`, whose lab off-values ARE 0
//     (world-engine-lab.html:5083, :5086, :5092) and whose gate therefore reproduces the lab exactly;
//   · `uSeaLevel` is a plain number. The GAME runs every declared gate ON
//     (src/worldengine/drivers/index.js `gatesFor` under GATE_POLICY_ALL_ON), so an all-on `lakes`
//     gate would have been a no-op there in any case; the LAB keeps its lakes checkbox where it
//     already lives, at its own per-frame writer, exactly as it keeps the other four.
// Giving the pack a fourth gate name whose off-value it cannot express would be a rendering decision
// nobody made, hidden behind a value that is legal.
//
// ⛔ `uFluvialDensity` IS DELIBERATELY NOT EMITTED, and the reason is the LAB's, not this file's:
// world-engine-lab.html:5518 `uniforms.uFluvialDensity.value  = 0.0;` pins it to zero on every frame
// (the retired worm-trail; the note above it records that F11's visual is carved, not painted). A
// pack that wrote it would be the only thing in either front-end putting a non-zero there, and the
// difference would show as a worm trail on every wet body. The DENSITY still travels — as
// `meta.fluvialDensity` and as the mirror's `fluvialDensity` field — because F12's delta density is
// derived from it and the lab's `state.fluvialDensity` slider is live.
//
// ⛔ `uLiquidMask` IS THE ONE DRIVER THE LAB WRITES STRAIGHT TO A UNIFORM (world-engine-lab.html:2148),
// so it is the whole of `fluvialDeckDirectDrivers`'s output — derived by SUBTRACTION from the binding
// below, never listed. It must stay a PLAIN NUMBER: the lab's read-back assigns the complement raw.
//
// ⭐⭐ THE EROSION KEY — ROOT-0 FIX 1 APPLIED TO ITS THIRD READER, MEASURED NOT PREDICTED. This is
// the ONE place this file does not copy the lab line character-for-character, and the departure is
// the repo's own established seam fix rather than a new law.
// THE DEFECT: the lab's block reads a raw `.erosion` (world-engine-lab.html:2128) while the game
// writes the other spelling — src/generation/PhysicsEngine.js:832 `erosionLevel: erosion,` — and
// src/worldengine/port/conditionFromBody.js forwards the game's own key untranslated (deliberately;
// its comment carries the whole history). ROOT-0 fix 1 (B1, 2026-08-20) taught BOTH readers known at
// the time both spellings — src/worldengine/base/labCore.js:646 and src/worldengine/base/baseStep.js:38,
// each `d.surfaceHistory?.erosion ?? d.surfaceHistory?.erosionLevel ?? 0` under the header "TWO
// SPELLINGS OF ONE QUANTITY", lab spelling winning where both exist so no preset moves. THE LAB'S
// FLUVIAL BLOCK WAS A THIRD READER AND IT WAS MISSED. Moving the block here is what made the miss
// visible, because this pack is the first thing to run that law on a game body — so the fix lands
// here, in the same expression, verbatim.
// MEASURED over the 24 rocky-* seeds (124 solid bodies), 2026-09-02, before and after the fix:
//   · `surfaceHistory.erosion` is defined on 2/124 (reading 0 on both); `erosionLevel` on 122/124,
//     running 0 … 1 with median 0.529. After the fix, 122/124 bodies carry a non-zero erosion.
//   · SINGLE SPELLING (the raw transcription): wet 2 · relict  0 · airless 122;
//     uOutflowDensity non-zero on  0 bodies; uStrandStrength non-zero on   0.
//   · DUAL SPELLING (what ships):              wet 2 · relict 66 · airless  56;
//     uOutflowDensity non-zero on 66 bodies; uStrandStrength non-zero on 122.
// So F13 outflow channels and F20 paleo-strandlines were DARK on every game body under the raw read
// and are live on 66 and 122 of them under this one, and the workstream's relict class (intent.md
// decision 4 — "relict bodies get the route") goes from admitting ZERO bodies to admitting 64.
// ⛔ NO LAB PRESET MOVES: driver-presets.js writes `erosion`, which still wins, so the lab's own
// fourteen presets answer exactly what they answered before. The change is entirely on the game side,
// where the old answer was a hard 0 for a quantity two-thirds of the way up its range.
// §F of this pack's suite pins the DUAL read and REDS on a single-spelling regression.
//
// ⛔ DELIBERATE NON-GOALS, each one a decision rather than an omission:
//   1. NO per-body ocean-fraction law. `seaCoverage` here is the lab's `stability x volatile budget`
//      and gives ~13% ocean on real relief; the router's own sea solve targets 0.35 from a histogram
//      (intent.md decision 3). Those are two different answers to one question and choosing between
//      them is Max's, not a wiring commit's. Logged in the workstream, not invented here.
//   2. NO routing, no ribbon, no carve. This pack answers the SCALARS. The geometry is the router's
//      (src/worldengine/rivers/), and it is a different unit of work in the same workstream.
//   3. NO per-body admission of the lab's global Rivers toggle. The lab's toggle is unauthored per
//      body; the classes below (`wet` / `relict` / `airless`) are what a per-body admission would key
//      on, which is why `fluvialClassOf` is exported — but the admission itself is not made here.
//
// ⛔ THREE-FREE, NO ENTROPY, NO TYPE LABEL. The import closure is base/ + port/. No entropy source,
// no clock, no preset name, no `d.type`. The applicability predicate is the condition's composition
// class, character-identical to rockySurface's and solidFeatures'.
import { compositionClass } from '../base/e1Regime.js';
import { deriveUniforms } from '../base/labCore.js';
import { scalar, assertDisplayPolicy, assertPackResult, resolveDriver, PackContractError } from '../port/writePackUniforms.js';

// ── The three declared gate names ────────────────────────────────────────────────────────────────
// One spelling each, mirroring the lab's own per-frame writer. The fourth checkbox, `lakes`, is NOT
// here — see the header's "THREE GATES, NOT FOUR".
export const DELTAS_GATE = 'deltas';    // world-engine-lab.html:5083 `uniforms.uDeltaDensity.value = state.deltasEnabled ? state.deltaDensity : 0.0;`
export const COAST_GATE = 'coast';      // world-engine-lab.html:5086 `uniforms.uCoastStrength.value = state.coastEnabled ? state.coastStrength : 0.0;`
export const OUTFLOW_GATE = 'outflow';  // world-engine-lab.html:5092 `uniforms.uOutflowDensity.value    = state.outflowEnabled ? state.outflowDensity : 0.0;`

// world-engine-lab.html:2130 `const _clamp01 = x => Math.max(0, Math.min(1, x));`
const clamp01 = (x) => Math.max(0, Math.min(1, x));
// world-engine-lab.html:2164 `const _ss = (e0, e1, x) => { const tt = _clamp01((x - e0) / (e1 - e0)); return tt*tt*(3 - 2*tt); };`
const ss = (e0, e1, x) => { const tt = clamp01((x - e0) / (e1 - e0)); return tt * tt * (3 - 2 * tt); };

/**
 * The lab's block, whole. ONE function rather than five, because the five features share `_wet`,
 * `_erosion`, `_hadLiquid` and each other's outputs — F12 reads F11's two, F20 reads F14's sea, F13
 * reuses F11's relict branch. Splitting it would recreate the coupling as five call graphs.
 *
 * ⚠ IT CALLS `deriveUniforms` ITSELF rather than taking a pre-computed bundle, for the reason
 * src/worldengine/base/auroraOptics.js states and solidFeatures.js repeats: a helper handed a bundle
 * can be handed one derived from a DIFFERENT condition than the one it reads, which is a silent wrong
 * answer rather than a slow one. It runs once per material build, not once per frame.
 *
 * @param {object} condition  a body condition vector (deriveConditionVector / conditionFromBody).
 */
function derive(condition) {
  const u = deriveUniforms(condition);
  // world-engine-lab.html:2128 `const _erosion = _fp.surfaceHistory?.erosion ?? 0;`   (⛔ off the CONDITION here — see the header's seam note)
  // ⭐⭐ AND WITH ROOT-0 FIX 1'S SECOND SPELLING, WHICH IS THE ONE PLACE THIS FILE DOES NOT COPY THE
  // LAB LINE CHARACTER-FOR-CHARACTER. The expression is verbatim from the two readers that already
  // carry the fix — src/worldengine/base/labCore.js:646 and src/worldengine/base/baseStep.js:38, both
  // `d.surfaceHistory?.erosion ?? d.surfaceHistory?.erosionLevel ?? 0` under the header "TWO SPELLINGS
  // OF ONE QUANTITY". The lab spelling still WINS where both exist, so no lab preset moves. See the
  // header block for the measurement this closes.
  const erosion = condition.surfaceHistory?.erosion ?? condition.surfaceHistory?.erosionLevel ?? 0;
  // world-engine-lab.html:2129 `const _stab = u.liquidStability, _rain = u.precipitation, _g = u.surfaceGravity;`
  const stab = u.liquidStability, rain = u.precipitation, g = u.surfaceGravity;
  // world-engine-lab.html:2131 `const _wet = _stab > 0.15;` — F11's EXISTENCE GATE, and the workstream's
  // routing admission (intent.md decision 4).
  const wet = stab > 0.15;
  // world-engine-lab.html:2135 `const _hadLiquid = !!(_fp.atmosphere && _fp.atmosphere.retained !== false);`
  // A genuinely airless world floors to 0: its recorded erosion is bombardment, not water.
  const hadLiquid = !!(condition.atmosphere && condition.atmosphere.retained !== false);

  // ── F11 fluvial networks ───────────────────────────────────────────────────────────────────────
  // world-engine-lab.html:2136 `state.fluvialActivity = _wet ? 1.0 : _clamp01(_erosion);`
  const fluvialActivity = wet ? 1.0 : clamp01(erosion);
  // world-engine-lab.html:2137-2138 `state.fluvialDensity  = _wet ? _clamp01(_stab * (0.3 + 0.7 * _rain)) : (_hadLiquid ? 0.4 * _clamp01(_erosion) : 0.0);`
  const fluvialDensity = wet ? clamp01(stab * (0.3 + 0.7 * rain)) : (hadLiquid ? 0.4 * clamp01(erosion) : 0.0);
  // world-engine-lab.html:2139 `state.fluvialDepth    = 0.08 + 0.10 * _rain + 0.04 * _clamp01(_g);`
  const fluvialDepth = 0.08 + 0.10 * rain + 0.04 * clamp01(g);
  // world-engine-lab.html:2140 `state.fluvialMeander  = 0.3 + 0.5 * _rain;`
  const fluvialMeander = 0.3 + 0.5 * rain;

  // ── F14 lakes & seas ───────────────────────────────────────────────────────────────────────────
  // world-engine-lab.html:2145 `const _vol = _clamp01((_fp.composition?.volatileFraction ?? 0) * 2.0);`
  const vol = clamp01((condition.composition?.volatileFraction ?? 0) * 2.0);
  // world-engine-lab.html:2146 `const _seaCoverage = _wet ? _clamp01(_stab * _vol) : 0.0;`
  const seaCoverage = wet ? clamp01(stab * vol) : 0.0;
  // world-engine-lab.html:2147 `state.seaLevel = _wet && _seaCoverage > 0.0 ? -0.2 + 0.5 * _seaCoverage : -1.0;`
  const seaLevel = wet && seaCoverage > 0.0 ? -0.2 + 0.5 * seaCoverage : -1.0;

  // ── F12 deltas & fans ──────────────────────────────────────────────────────────────────────────
  // world-engine-lab.html:2151 `state.deltaDensity = state.fluvialDensity * (0.5 + 0.5 * state.fluvialActivity);`
  const deltaDensity = fluvialDensity * (0.5 + 0.5 * fluvialActivity);

  // ── F20 coastlines ─────────────────────────────────────────────────────────────────────────────
  // world-engine-lab.html:2156 `state.coastStrength  = state.seaLevel > -1.0 ? 1.0 : 0.0;`
  const coastStrength = seaLevel > -1.0 ? 1.0 : 0.0;
  // world-engine-lab.html:2157 `state.strandStrength = _clamp01(_erosion);`
  const strandStrength = clamp01(erosion);

  // ── F13 outflow channels ───────────────────────────────────────────────────────────────────────
  // world-engine-lab.html:2165 `const _fluvHistory = _wet || (_hadLiquid && _erosion > 0);`
  const fluvHistory = wet || (hadLiquid && erosion > 0);
  // world-engine-lab.html:2166 `state.outflowDensity  = _fluvHistory ? _ss(0.3, 0.45, _erosion) : 0.0;`
  const outflowDensity = fluvHistory ? ss(0.3, 0.45, erosion) : 0.0;
  // world-engine-lab.html:2167 `state.outflowActivity = state.fluvialActivity;`
  const outflowActivity = fluvialActivity;

  // ⭐ THE CLASS IS THE LAB'S OWN TWO GATES READ AS A PARTITION, not a new law: `_wet` is F11's
  // existence gate and `_fluvHistory` minus `_wet` is precisely its relict branch. Named because the
  // workstream's routing admission (intent.md decision 4) keys on it and because a test can otherwise
  // not tell a body whose feature is OFF from one a gate zeroed.
  const fluvialClass = wet ? 'wet' : (fluvHistory ? 'relict' : 'airless');

  return {
    wet, hadLiquid, erosion, liquidStability: stab, precipitation: rain,
    fluvialActivity, fluvialDensity, fluvialDepth, fluvialMeander,
    seaCoverage, seaLevel, deltaDensity, coastStrength, strandStrength,
    outflowDensity, outflowActivity, fluvialClass,
  };
}

/**
 * `'wet' | 'relict' | 'airless'` for one condition — pure, cheap, and the ONE expression of the
 * class both the bake host and the worker read. Exported so a caller asking "does this body get a
 * route?" cannot answer it with a second copy of `liquidStability > 0.15`.
 */
export function fluvialClassOf(condition) {
  if (condition == null || typeof condition !== 'object') {
    throw new PackContractError('fluvialClassOf: condition vector is missing.');
  }
  return derive(condition).fluvialClass;
}

/**
 * The ten fluvial drivers, from a condition vector alone.
 *
 * ⛔ THE GATE GOES WHERE THE LAB PUTS IT AND NOWHERE ELSE. Each of the three gated names is a MASTER
 * its shader pass early-outs on, so one zero deletes the pass byte-identically — the same property
 * solidFeatures.js relies on. The morphology terms beside them (`uFluvialDepth`, `uFluvialMeander`,
 * `uStrandStrength`, `uOutflowActivity`) are UNGATED, exactly as the lab writes them
 * (world-engine-lab.html:5090, :5093 and the F11 block at :5519-5520), so a gated-off body does not
 * quietly carry the previous body's channel depth behind a zero.
 *
 * @param {object} condition  a body condition vector.
 * @param {object} ctx        the Step-5a pack context (display policy + gate map).
 */
export function fluvialDeckPack(condition, ctx) {
  if (condition == null || typeof condition !== 'object') {
    throw new PackContractError('fluvialDeckPack: condition vector is missing.');
  }
  // Checked FIRST and unconditionally, as every other pack does. ⚠ This pack emits NO km-shaped
  // driver, so its policy seam is vacuous — stated so nobody reads the call as evidence that the seam
  // is exercised here. It is exercised by `craterDeck` and `rockySurface`.
  assertDisplayPolicy(ctx);

  const f = derive(condition);

  const drivers = {
    // ── F11 fluvial networks (3 — the DENSITY is not among them; see the header) ────────────────
    uFluvialActivity: f.fluvialActivity,
    uFluvialDepth: f.fluvialDepth,
    uFluvialMeander: f.fluvialMeander,

    // ── F14 lakes & seas (2) ────────────────────────────────────────────────────────────────────
    // ⛔ BOTH UNGATED, for two different reasons. `uSeaLevel`: an off gate resolves to 0 and the lab's
    // off-value is -1 (see the header). `uLiquidMask`: the lab writes it unconditionally too
    // (world-engine-lab.html:2148) — it is the coverage scalar, not a feature master.
    uSeaLevel: f.seaLevel,
    uLiquidMask: f.seaCoverage,

    // ── F12 deltas & fans (1) ───────────────────────────────────────────────────────────────────
    uDeltaDensity: scalar(f.deltaDensity, { gate: DELTAS_GATE }),

    // ── F20 coastlines (2) ──────────────────────────────────────────────────────────────────────
    uCoastStrength: scalar(f.coastStrength, { gate: COAST_GATE }),
    uStrandStrength: f.strandStrength,

    // ── F13 outflow channels (2) ────────────────────────────────────────────────────────────────
    uOutflowDensity: scalar(f.outflowDensity, { gate: OUTFLOW_GATE }),
    uOutflowActivity: f.outflowActivity,
  };

  // ⚠ POPULATED, NOT DECORATIVE. `fluvialDensity` and `seaCoverage` reach the front-ends ONLY through
  // here and through the mirror, and `fluvialClass` is what lets a caller tell an airless body from a
  // gated-off wet one — which the emitted uniforms cannot.
  const meta = { compositionClass: compositionClass(condition), ...f };

  // ⛔ `attributes` IS AN EXPLICIT EMPTY OBJECT, NEVER `undefined` —
  // src/worldengine/port/writePackUniforms.js `"this pack has no attributes" and "this pack forgot" must not look the same.`
  return assertPackResult({ drivers, attributes: {}, meta }, 'fluvialDeckPack');
}

// ─────────────────────────────────────────────────────────────────────────────
// THE REGISTRY ENTRY
// ─────────────────────────────────────────────────────────────────────────────
/**
 * ⭐ EXPORTED AS A FROZEN ENTRY rather than assembled at the registry, so composing it is one import
 * plus one array element and the predicate cannot be retyped differently from the one this pack's own
 * test gates.
 *
 * ⛔⛔ THE PREDICATE IS CHARACTER-IDENTICAL TO rockySurface's, solidOptics' AND solidFeatures',
 * AND THAT IS THE WHOLE OF ITS POPULATION ARGUMENT. `selectPacks` already returns a non-empty list
 * for every body this claims, so the `packs.length > 0` term of src/objects/Planet.js's admission
 * cannot flip for any record: registration moves NO body between materials and re-pins no census.
 * Asserted over a generated population, not by reading three `applies` lines side by side.
 *
 * ⛔ COLLISION. Four packs co-apply with this one on every solid body. All ten names below are new to
 * the pack tree — no pack wrote any of them before this commit — and the suite asserts it by NAME
 * LOOKUP over real pack outputs across the corpus, so the day either set grows into the other it reds
 * instead of throwing at a player.
 *
 * ⚠ IT MUST RETURN THE BOOLEAN. Both admission sites compare with `=== true`, so a truthy non-boolean
 * registers, reports as `skipped`, renders nothing and throws nothing.
 */
export const FLUVIAL_DECK_ENTRY = Object.freeze({
  name: 'fluvialDeck',
  applies: (condition) => compositionClass(condition) !== 'gas',
  gates: Object.freeze([DELTAS_GATE, COAST_GATE, OUTFLOW_GATE]),
  pack: fluvialDeckPack, labState: fluvialDeckLabState,
});

/**
 * The uniform names this pack writes, as a frozen SET for the collision, scope and membership gates.
 * Exported so the suite can assert the emitted set by MEMBERSHIP rather than by count — a
 * count-preserving permutation is byte-identical to every instrument this program owns, so a
 * `length === 10` gate would pass a commit that swapped `uSeaLevel` for `uSeaFloor`.
 */
export const FLUVIAL_DECK_UNIFORMS = Object.freeze([
  'uFluvialActivity', 'uFluvialDepth', 'uFluvialMeander',
  'uSeaLevel', 'uLiquidMask',
  'uDeltaDensity',
  'uCoastStrength', 'uStrandStrength',
  'uOutflowDensity', 'uOutflowActivity',
]);

// ─────────────────────────────────────────────────────────────────────────────
// THE TWO FRONT-END HELPERS — the lab's import-back seam
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Uniform name -> the `state` field world-engine-lab.html's per-frame writer reads.
 *
 * ⭐ WHY A MIRROR AND NOT A DIRECT WRITE: every field below is a live lil-gui slider bound with
 * `.listen()`, so writing pack output straight to the material would take the lab's authoring surface
 * out of its own loop, which is the lab's entire reason to exist. The pack result is mirrored into
 * `state` and the lab's frame loop keeps writing the uniforms exactly as it always has.
 *
 * ⚠ NINE OF TEN. `uLiquidMask` is absent ON PURPOSE — the lab writes it STRAIGHT to the uniform
 * (world-engine-lab.html:2148, it has no slider), so it falls out of `fluvialDeckDirectDrivers` by
 * subtraction. That complement is non-empty here, unlike solidFeatures', and the suite pins its
 * membership rather than its emptiness.
 */
export const FLUVIAL_DECK_LAB_BINDING = Object.freeze({
  uFluvialActivity: 'fluvialActivity',
  uFluvialDepth: 'fluvialDepth',
  uFluvialMeander: 'fluvialMeander',
  uSeaLevel: 'seaLevel',
  uDeltaDensity: 'deltaDensity',
  uCoastStrength: 'coastStrength',
  uStrandStrength: 'strandStrength',
  uOutflowDensity: 'outflowDensity',
  uOutflowActivity: 'outflowActivity',
});

/**
 * ⛔⛔ EVERY GATE ON, AND THAT IS THE LOAD-BEARING PART OF THIS FILE'S LAB SEAM.
 *
 * The lab re-applies its OWN checkbox at the per-frame writer —
 * `uniforms.uDeltaDensity.value = state.deltasEnabled ? state.deltaDensity : 0.0` — so the value this
 * mirror puts into `state` must be the UNGATED one. A mirror that resolved the gate too would apply
 * the decision twice: a body whose feature is enabled would still read zero the moment the pack's
 * gate map disagreed with the checkbox, and nothing would throw, because zero is a legal value for
 * every one of these masters.
 */
const LAB_MIRROR_CTX = Object.freeze({
  displayRadiusEarth: 1, animRate: 1, relevance: {},
  gates: Object.freeze({ [DELTAS_GATE]: true, [COAST_GATE]: true, [OUTFLOW_GATE]: true }),
});

/**
 * The subset of a pack result the LAB mirrors into `state`, resolved with every gate ON.
 *
 * ⚠ `fluvialDensity` IS APPENDED FROM `meta`, NOT FROM A DRIVER, because it has no uniform: the lab
 * pins `uFluvialDensity` to 0.0 every frame (world-engine-lab.html:5518). The lab's `state
 * .fluvialDensity` slider is nonetheless live — F12's delta density is derived from it — so the
 * mirror must still answer it or the slider would keep the previous body's value.
 *
 * @param {{drivers: object, meta: object}} pack  a `fluvialDeckPack` result
 * @returns {object} `state` field name -> value, containing ONLY the keys the pack actually emitted
 */
export function fluvialDeckLabState(pack) {
  const out = {};
  for (const [uName, stateField] of Object.entries(FLUVIAL_DECK_LAB_BINDING)) {
    if (!(uName in pack.drivers)) continue;
    out[stateField] = resolveDriver(uName, pack.drivers[uName], LAB_MIRROR_CTX);
  }
  out.fluvialDensity = pack.meta.fluvialDensity;
  return out;
}

/**
 * The complement: drivers the lab writes STRAIGHT to uniforms because its frame loop does not own
 * them. Derived by SUBTRACTION from the binding rather than listed, so a driver added to the pack and
 * forgotten in the binding defaults to being WRITTEN — a forgotten entry shows up as a uniform that
 * moves, not as one that silently never does.
 *
 * ⚠ IT RETURNS THE DRIVER, NOT A RESOLVED VALUE, and the lab's read-back assigns it raw. Everything
 * in this complement must therefore stay a plain number; the suite pins that by name.
 */
export function fluvialDeckDirectDrivers(pack) {
  const out = {};
  for (const [uName, d] of Object.entries(pack.drivers)) {
    if (uName in FLUVIAL_DECK_LAB_BINDING) continue;
    out[uName] = d;
  }
  return out;
}
