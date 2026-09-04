// src/worldengine/drivers/solidRelief.js
// ─────────────────────────────────────────────────────────────────────────────────────────────────
// DRIVER PACK #11 — THE SOLID-BODY RELIEF DECK. Workstream solid-relief-deck, 2026-09-04.
//
//     solidReliefPack(condition, ctx) -> { drivers, attributes, meta }
//
// It forwards the per-body masters of ELEVEN lab features that no pack wrote before this commit —
// the whole set the 2026-09-03 coverage audit found computed-and-unforwarded:
//
//     F1  mountains / ranges       uMountainAmp · uOrogenyStrength · uOrogenyAxis
//     F4  canyons / rifts          uChasmaDepth · uChasmaCount · uChasmaAxis
//     F5  scarps & fault systems   uScarpStrength · uScarpStyle · uScarpAxis
//     F6  plateaus & tessera       uPlateauStrength · uTesseraStrength · uTesseraAxis
//     F8  lava plains              uLavaCoverage · uLavaActivity · uLavaAxis
//     F15 dunes & wind forms       uDuneDensity
//     F16 dust mantles             uDustDepth
//     F18 sublimation landscapes   uSubStrength
//     F19 mass-wasting deposits    uMassWastDensity · uRepose · uLdaFat
//     F21 karst / dissolution      uKarstDensity · uKarstMaturity
//
// Twenty-three names. Every one was already DECLARED on the lab material
// (src/worldengine/shaders/uniforms.js) and written by NOTHING in `src/` — measured at the parent in
// tests/fixtures/solidrelief-pack-drivers-baseline.json, whose `newNamesAlreadyWritten` is empty
// over 156 corpus bodies × 18 presets. Every combiner these feed early-outs at master ≤ 0, which is
// what makes the gates-off arm byte-identical to the pre-pack render.
//
// ⭐ NOT ONE LAW IS EXPRESSED HERE. Seven masters are named fields off ONE `deriveUniforms(condition)`
// bundle — the `solidFeatures.js` shape — and four come off ONE `surfaceProcessesOf(condition, u)`
// call, the module this workstream created because those four laws lived only inside
// world-engine-lab.html and no module in `src/` could reach them. Both front-ends read those two
// modules, so there is exactly one expression of each law in the repository.
//
// ⛔⛔ THE SEEDED AXES COME OFF `ctx`, AND A PACK MAY NOT DERIVE THEM. `deriveUniforms` reads its seed
// from `d.seed` and a CONDITION VECTOR CARRIES NO `seed` — solidFeatures.js measured
// `condition.seed === undefined` on 1484 of 1484 bodies and refused to forward F10's axes on exactly
// that ground:
//     "forwarding the bundle's answer would put every body in the galaxy on the seed-0 pair —
//      1484 identical rift orientations, wired, green, and indistinguishable from the
//      'these are all identical' UAT this block exists to end."
// That is why this workstream lifted `reliefAxesFor` into labCore and why src/objects/Planet.js
// `labPackCtx` spreads it (and `chasmaRiftsFor`, which B3-3 already put there) from the game's own
// `labMacroSeed`. MEASURED over the 124 solid corpus bodies: 124 distinct values for each of
// `chasmaAxes`, `orogenyAxis`, `scarpAxis`, `tesseraAxes`, `lavaAxis`. Reading them off the bundle
// instead would have given 1. ⚠ The pack THROWS if ctx omits them rather than defaulting — an axis
// that silently falls back to (0,1,0) is the wired-but-identical failure wearing a green test.
//
// ⛔⛔ THE LAB'S PER-FEATURE RELEVANCE HARD-GATE IS NOT PORTED, AND THIS IS THE PACK'S ONE DECLARED
// DIVERGENCE. The lab multiplies five of these masters by `state.featureRelevant.<key>`
// (world-engine-lab.html:5369/:5376/:5381/:5388/:5393), whose signal is PRESET-NAME membership in
// `ASSOCIATIONS[key].rendersOn` (:1988). Three independent reasons it does not travel:
//
//   1. ⭐ MAX'S OWN RULING ON WHAT THE WORLD ENGINE IS (2026-07-19, the lab charter's INTENT FRAME):
//      "There should be no default; there should be seeds that are procedurally generated using
//      these physics-derived driver rules" and "presets remain dev fixtures / named-body canonical
//      locks, NOT the product." A table keyed on the string 'Mars (arid rocky)' is a dev fixture.
//      Porting it would put preset curation into the generated galaxy.
//   2. THE GAME HAS NO PLACE TO PUT IT. src/objects/Planet.js `GAME_RELEVANCE` is frozen EMPTY and
//      src/worldengine/port/writePackUniforms.js throws on a driver gated on an absent name — "an
//      absent gate is not an off gate and is not an on gate — it is an unanswered rendering
//      decision." `polarDeck` met this first and answered it by finding a condition-derived
//      predicate that AGREED with the table 18/18. Here no such predicate exists, which is finding 3.
//   3. ⛔ THE TABLE IS NOT PHYSICS AND CANNOT BE DERIVED. MEASURED over all 18 presets: it is not
//      composition class (Titan/Frozen/Europa/Moon-Mercury/Magma/Crystal are all rocky-class and
//      excluded while Lava, also rocky and airless, is included), not atmosphere (airless Lava is in,
//      atmospheric Titan is out), not temperature (Mars 210 K in, Moon/Mercury 235 K out), not iron
//      and not volatiles (Frozen 0.251 out vs Eyeball 0.252 in). It is a curation list. Deriving a
//      physical predicate to reproduce it would be inventing physics to fit an authoring choice —
//      the opposite of the rule in (1).
//
// ⚠ SO THE GAME RENDERS THESE FIVE ON MORE BODIES THAN THE LAB'S PRESET VIEW SHOWS, AND THE EXACT
// SET IS RECORDED RATHER THAN DISCOVERED LATER. Presets where the law is > 0 and the table is off:
//   mountains — Frozen (.003), Moon/Mercury (.583), Magma (.600), Carbon (.565), Crystal (.061)
//   canyons   — Titan (.103), Frozen (.013), Europa (.274), Moon/Mercury (.014), Magma (.280), Carbon (.027)
//   scarps    — Titan (.097), Europa (.094), Moon/Mercury (.108), Carbon (.023), Crystal (.060)
//   plateaus  — Titan (.074), Frozen (.010), Europa (.196), Moon/Mercury (.010), Magma (.200), Carbon (.019)
//   tessera   — Lava (.150), Magma (.150)
// The real-world check runs the same way: the Moon HAS ranges (Montes Apenninus) and Mercury has
// lobate scarps, so mountains and scarps on an airless rocky body are the physics being replicated,
// not a leak. The gas-class rows in that measurement (chasmaDepth .280, plateauStrength .200 on
// every giant — a rift in a body with no crust) never arise here: this pack's predicate refuses them.
//
// ⛔ THE EXOTIC-CRUST KNOCKDOWN IS NOT FORWARDED, AND IT IS MEASURED INERT RATHER THAN JUDGED
// UNIMPORTANT. The lab multiplies `uMountainAmp` by `(1 − state.isExoticCarbonOrGeometric)`
// (world-engine-lab.html:5369), which is 1.0 only on the Carbon and Crystal presets. Over the 124
// solid corpus bodies: `compositionClass === 'carbon'` on 0, and the facet/crystal predicate
// (world-engine-lab.html:2748) clears on 0. The multiply is therefore the constant 1 on every
// generated body, and forwarding a constant is the refusal solidFeatures.js's item (1) already made.
// ⚠ The physical half of that knockdown DOES travel, because it is inside the law: `mountainAmp` and
// `tesseraStrength` both carry `× rockyCrust` (labCore.js:793, :864).
//
// ⛔⛔ WHAT THIS PACK DELIBERATELY DOES NOT WRITE. Every name below is one the lab's frame writer DOES
// set, so each omission is a decision:
//   1. THE LAB KNOBS. `uMountainScale` 1.6, `uChasmaWidth` .12, `uChasmaFloor` .4, `uScarpWidth` .3,
//      `uScarpFreq` 6, `uScarpWarp` .5, `uScarpWarpFreq` 2, `uPlateauScale` 1.2, `uPlateauOffset` .5,
//      `uPlateauLevels` 4, `uPlateauSoftness` .4, `uTesseraFreq` 5, `uTesseraWarp` .5,
//      `uTesseraWarpFreq` 2, `uLavaScale` 1.4, `uLavaGlowRate` 1.5, `uSubAmp` .10 and the rest of the
//      F18 pit/polygon set, `uKarstDoline*`/`uKarstMaze*`/`uKarstPlateauLvl`, `uDuneAmp`/`uDuneFreq`/
//      `uDuneWarp`/`uDuneBelt`, `uDustRegionFreq`/`uDustFlatK`/`uDustTint`. Each is a lil-gui slider
//      whose default is byte-equal to the declared uniform default, so a forward would move no pixel
//      and would grow this pack's claimed name set for nothing — the hazard
//      tests/material-parity-list.test.js's non-varying-residue assertion exists to catch ("the
//      difference between wiring a law and wiring a constant").
//   2. THE 🎲 DOMAIN OFFSETS — `uMountainDomainOffset`, `uScarpDomainOffset`, `uPlateauDomainOffset`,
//      `uTesseraDomainOffset`, `uLavaOffset`, `uSubOffset`, `uKarstOffset`, `uDuneOffset`,
//      `uDustOffset`, `uMassWastOffset`. These are the FRONT-END's answer, exactly as P-13 ruled for
//      the three macro offsets: src/objects/Planet.js carries `labReliefOffsets(d)` on the ctx and a
//      pack synthesising a third law from `macroSeed` would agree with neither existing one.
//   3. `uTectonicGrainStrength` / `uTectonicGrainCube` — the BAKE's channel, not a runtime gate.
//      This workstream adds the runtime half beside the pre-computed terrain and modifies neither.
//
// ⛔ THREE-FREE, NO ENTROPY, NO TYPE LABEL. The import closure is base/ + port/. No `Math.random`,
// no `Date.now`, no preset name, no `d.type`. Not one numeric literal in the driver map.
// ─────────────────────────────────────────────────────────────────────────────────────────────────
import { compositionClass } from '../base/e1Regime.js';
import { deriveUniforms } from '../base/labCore.js';
import { surfaceProcessesOf } from '../base/surfaceProcesses.js';
import { scalar, assertDisplayPolicy, assertPackResult, PackContractError } from '../port/writePackUniforms.js';

// ── The eleven declared gate names ───────────────────────────────────────────────────────────────
// ⭐ ELEVEN, NOT ONE, because the lab has eleven independent ✓ checkboxes over these features and
// they do not switch together. One spelling each, mirroring the lab's own per-frame writer:
//   world-engine-lab.html:5369 uMountainAmp      ← state.mountainsEnabled
//   world-engine-lab.html:5376 uChasmaDepth      ← state.canyonsEnabled
//   world-engine-lab.html:5381 uScarpStrength    ← state.scarpsEnabled
//   world-engine-lab.html:5388 uPlateauStrength  ← state.plateausEnabled
//   world-engine-lab.html:5393 uTesseraStrength  ← state.tesseraEnabled
//   world-engine-lab.html:5422 uLavaCoverage     ← state.lavaEnabled
//   world-engine-lab.html:5478 uSubStrength      ← state.subEnabled
//   world-engine-lab.html:5103 uKarstDensity     ← state.karstEnabled
//   world-engine-lab.html:5113 uDuneDensity      ← state.dunesEnabled
//   world-engine-lab.html:5121 uDustDepth        ← state.dustEnabled
//   world-engine-lab.html:5127 uMassWastDensity  ← state.massWastEnabled
export const MOUNTAIN_GATE = 'mountains';
export const CANYON_GATE = 'canyons';
export const SCARP_GATE = 'scarps';
export const PLATEAU_GATE = 'plateaus';
export const TESSERA_GATE = 'tessera';
export const LAVA_GATE = 'lava';
export const SUB_GATE = 'sublimation';
export const KARST_GATE = 'karst';
export const DUNE_GATE = 'dunes';
export const DUST_GATE = 'dust';
export const MASSWAST_GATE = 'massWasting';

export const SOLID_RELIEF_GATES = Object.freeze([
  MOUNTAIN_GATE, CANYON_GATE, SCARP_GATE, PLATEAU_GATE, TESSERA_GATE, LAVA_GATE,
  SUB_GATE, KARST_GATE, DUNE_GATE, DUST_GATE, MASSWAST_GATE,
]);

// The five ctx keys this pack cannot answer from a condition. Named as a list so the throw below
// reports ALL of them at once rather than failing one axis at a time on eleven successive bodies.
const REQUIRED_CTX_AXES = Object.freeze(['chasmaCount', 'chasmaAxes', 'orogenyAxis', 'scarpAxis', 'tesseraAxes', 'lavaAxis']);

/**
 * The twenty-three relief drivers, from a condition vector plus the front-end's seeded axes.
 *
 * ⛔ THE GATE GOES ON THE MASTER AND ONLY THE MASTER — `solidFeatures.js`'s rule, and the reason is
 * the same: each family's combiner early-outs on its own master, so one zero deletes the pass
 * byte-identically, while gating the morphology terms too would give identical pixels and a
 * DIFFERENT state — a gated-off body left carrying the previous body's rift orientation behind a
 * zero, invisible until something read it off-gate.
 *
 * @param {object} condition  a body condition vector (deriveConditionVector / conditionFromBody).
 * @param {object} ctx        the Step-5a pack context — display policy, gate map, and the seeded
 *                            relief axes the front-end answers.
 */
export function solidReliefPack(condition, ctx) {
  if (condition == null || typeof condition !== 'object') {
    throw new PackContractError('solidReliefPack: condition vector is missing.');
  }
  // Checked FIRST and unconditionally, as every pack does. ⚠ This pack emits NO km-shaped driver, so
  // its policy seam is vacuous — said out loud so the call is not read as evidence the seam is
  // exercised here. It is exercised by `craterDeck` and `rockySurface`.
  assertDisplayPolicy(ctx);

  // ⛔ THROW, NEVER DEFAULT. A missing axis that silently became the uniform's declared (0,1,0) would
  // give every body one scarp front and one wrinkle strike — green, wired, and the exact failure
  // this pack's header exists to prevent.
  const missing = REQUIRED_CTX_AXES.filter((k) => ctx[k] === undefined || ctx[k] === null);
  if (missing.length) {
    throw new PackContractError(
      `solidReliefPack: ctx is missing the front-end's seeded relief axes [${missing.join(', ')}]. ` +
      'A condition vector carries no `seed`, so these cannot be derived here — see `reliefAxesFor` / ' +
      '`chasmaRiftsFor` in src/worldengine/base/labCore.js and their spread in labPackCtx.',
    );
  }

  const u = deriveUniforms(condition);
  const sp = surfaceProcessesOf(condition, u);

  const drivers = {
    // ── F1 mountains / ranges (3) ──────────────────────────────────────────────────────────────
    uMountainAmp: scalar(u.mountainAmp, { gate: MOUNTAIN_GATE }),
    uOrogenyStrength: u.orogenyStrength,
    // `.slice()` on every array: src/worldengine/port/writePackUniforms.js spreads these into a
    // settable vector, and handing out a live array is how one body's strike follows another's.
    uOrogenyAxis: ctx.orogenyAxis.slice(),

    // ── F4 canyons / rifts (3) ─────────────────────────────────────────────────────────────────
    uChasmaDepth: scalar(u.chasmaDepth, { gate: CANYON_GATE }),
    uChasmaCount: ctx.chasmaCount,
    uChasmaAxis: ctx.chasmaAxes.map((a) => a.slice()),

    // ── F5 scarps & fault systems (3) ──────────────────────────────────────────────────────────
    uScarpStrength: scalar(u.scarpStrength, { gate: SCARP_GATE }),
    uScarpStyle: u.scarpStyle,
    uScarpAxis: ctx.scarpAxis.slice(),

    // ── F6 plateaus & tessera (3) — TWO masters, TWO gates: the lab has a checkbox for each ─────
    uPlateauStrength: scalar(u.plateauStrength, { gate: PLATEAU_GATE }),
    uTesseraStrength: scalar(u.tesseraStrength, { gate: TESSERA_GATE }),
    uTesseraAxis: ctx.tesseraAxes.map((a) => a.slice()),

    // ── F8 lava plains (3) ─────────────────────────────────────────────────────────────────────
    uLavaCoverage: scalar(u.lavaCoverage, { gate: LAVA_GATE }),
    uLavaActivity: u.lavaActivity,
    uLavaAxis: ctx.lavaAxis.slice(),

    // ── F18 sublimation landscapes (1) ─────────────────────────────────────────────────────────
    uSubStrength: scalar(u.subStrength, { gate: SUB_GATE }),

    // ── F21 karst / dissolution (2) ────────────────────────────────────────────────────────────
    uKarstDensity: scalar(sp.karstDensity, { gate: KARST_GATE }),
    uKarstMaturity: sp.karstMaturity,

    // ── F15 dunes (1) ──────────────────────────────────────────────────────────────────────────
    uDuneDensity: scalar(sp.duneDensity, { gate: DUNE_GATE }),

    // ── F16 dust mantles (1) ───────────────────────────────────────────────────────────────────
    uDustDepth: scalar(sp.dustDepth, { gate: DUST_GATE }),

    // ── F19 mass-wasting (3) ───────────────────────────────────────────────────────────────────
    // ⚠⚠ WIRED KNOWING IT RENDERS NOTHING YET. The master is a flat 1.0 on every solid world by the
    // lab's own law, but the LAB half of F19 measured .00006 of rendered contribution — an inert
    // feature, logged as a lab defect with its own backlog row. This is CARRIAGE: when the lab half
    // is repaired the game gets it for free, and the F-spine row says "wired, renders nothing" rather
    // than "shipped".
    uMassWastDensity: scalar(sp.massWastDensity, { gate: MASSWAST_GATE }),
    uRepose: sp.repose,
    uLdaFat: sp.ldaFat,
  };

  // ⚠ POPULATED, NOT DECORATIVE — the eleven masters plus the shared gates, so a test can tell a body
  // whose feature is genuinely 0 from a body whose feature the gate zeroed, which the emitted
  // uniforms cannot. Same reason `fluvialDeckPack` surfaces its own.
  const meta = {
    compositionClass: compositionClass(condition),
    mountainAmp: u.mountainAmp,
    chasmaDepth: u.chasmaDepth,
    scarpStrength: u.scarpStrength,
    plateauStrength: u.plateauStrength,
    tesseraStrength: u.tesseraStrength,
    lavaCoverage: u.lavaCoverage,
    subStrength: u.subStrength,
    karstDensity: sp.karstDensity,
    duneDensity: sp.duneDensity,
    dustDepth: sp.dustDepth,
    massWastDensity: sp.massWastDensity,
    karstMaturity: sp.karstMaturity, repose: sp.repose, ldaFat: sp.ldaFat,
    surface: sp.meta,
  };

  // ⛔ `attributes` IS AN EXPLICIT EMPTY OBJECT, NEVER `undefined` — "this pack has no attributes"
  // and "this pack forgot" must not look the same.
  return assertPackResult({ drivers, attributes: {}, meta }, 'solidReliefPack');
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// THE REGISTRY ENTRY
// ─────────────────────────────────────────────────────────────────────────────────────────────────
/**
 * ⛔⛔ THE PREDICATE IS CHARACTER-IDENTICAL to `rockySurface`'s, `solidOptics`', `solidFeatures`' and
 * `fluvialDeck`'s, AND THAT IS THE WHOLE OF ITS POPULATION ARGUMENT. `selectPacks` already returns a
 * non-empty list for every body this claims, so the `packs.length > 0` term of the admission test in
 * src/objects/Planet.js cannot flip for any record: registration moves NO body between materials and
 * re-pins no census.
 *
 * ⛔ COLLISION. The registry throws if two APPLICABLE packs write the same uniform name on one body.
 * All twenty-three names this emits were measured ABSENT from every pack's output at the parent
 * (tests/fixtures/solidrelief-pack-drivers-baseline.json `newNamesAlreadyWritten: []`, over 156
 * bodies × 18 presets), so the throw stays inert — asserted by name lookup in this pack's suite, not
 * by reading `applies` lines side by side.
 */
export const SOLID_RELIEF_ENTRY = Object.freeze({
  name: 'solidRelief',
  applies: (condition) => compositionClass(condition) !== 'gas',
  gates: SOLID_RELIEF_GATES,
  // ⛔ `labState` IS PART OF THE ENTRY, NOT AN EXTRA. tests/gas-body-lab-material.test.js asserts
  // "every registry entry carries a callable labState mirror" — `applyDriverPacksToState` is how the
  // lab runs the SAME composer the game runs, and an entry without a mirror silently drops out of it.
  // Caught by that fence on the first draft of this file, which exported the mirror and forgot the key.
  pack: solidReliefPack, labState: solidReliefLabState,
});

/**
 * The lab's mirror — SEVEN fields, not twenty-three, and the size is the point.
 *
 * ⭐ IT CARRIES EXACTLY THE FOUR EXTRACTED LAWS' OUTPUTS AND NOTHING ELSE. The other sixteen names
 * are already in the lab's `state` from its own `deriveUniforms` call (world-engine-lab.html:2050+),
 * so mirroring them would have `applyDrivers` overwrite sixteen values with themselves — a no-op that
 * reads as a wire. These seven are the ones that had NO src-side producer before this workstream, so
 * they are the ones the lab now gets back from the pack.
 *
 * ⛔ A MIRROR, NOT A DIRECT UNIFORM WRITE — `fluvialDeck`'s ruling. The lab's ✓ checkboxes and its 🎲
 * axis reroll (world-engine-lab.html:3411+) sit at its per-frame writers and must stay in their own
 * loop; a pack writing straight to the material would take the authoring surface out of it.
 */
export function solidReliefLabState(pack) {
  const m = pack.meta;
  return {
    karstDensity: m.karstDensity, karstMaturity: m.karstMaturity,
    duneDensity: m.duneDensity, dustDepth: m.dustDepth,
    massWastDensity: m.massWastDensity, repose: m.repose, ldaFat: m.ldaFat,
  };
}

/** The twenty-three names this pack claims, for the disjointness fences. */
export const SOLID_RELIEF_UNIFORMS = Object.freeze([
  'uMountainAmp', 'uOrogenyStrength', 'uOrogenyAxis',
  'uChasmaDepth', 'uChasmaCount', 'uChasmaAxis',
  'uScarpStrength', 'uScarpStyle', 'uScarpAxis',
  'uPlateauStrength', 'uTesseraStrength', 'uTesseraAxis',
  'uLavaCoverage', 'uLavaActivity', 'uLavaAxis',
  'uSubStrength',
  'uKarstDensity', 'uKarstMaturity',
  'uDuneDensity', 'uDustDepth',
  'uMassWastDensity', 'uRepose', 'uLdaFat',
]);

// ═══════════════════════════════════════════════════════════════════════════════════════════════════
// THE GAME GATES — which of these eleven the GAME draws, and what each OFF row is waiting for.
//
// ⭐ MAX'S BAR, ruled 2026-09-04: **"grown from the engine, not painted on"**. A feature is ON in the
// game only if it reads the bake's ACCUMULATED LANDFORMS — the running height or its gradient — and
// not merely the 3-channel province mask with a floor under it. He chose this over "off = anything
// whose look I haven't passed" and over "off = only the provably dead", and he chose it having been
// told the cost: it removes most of the landform detail he had accepted the session before, and the
// game looks barer until each row is developed.
//
// His words, on the UAT that opened this: *"they are just applied over the underlying world engine
// generative models and don't actually communicate with that process AFAIK. So they're wired up"*.
//
// ⛔ THIS IS A GAME-SIDE GATE ONLY. THE LAB KEEPS EVERY FEATURE ON — that is where the development
// happens, and being able to keep developing there while the game stays quiet is the entire point:
// *"I want to be able to continue developing the features in the lab then seamlessly be able to
// switch them on in game when ready."* The lab drives these through its own per-feature `*Enabled`
// state (world-engine-lab.html:5369ff) and never reads this map.
//
// ⚠⚠ EVERY `on: false` ROW IS **DEBT**, NOT A DECISION. Per `converge-dont-declare-divergence` a
// lab/game divergence is debt until proven otherwise; it is sanctioned here only because each row
// carries a named exit. A row that sits OFF for months with `waitingFor` untouched is a defect in
// this registry, not a steady state. Flipping one `on` to `true` is the whole ship action — the gate
// plumbing already exists (`gatesFor` answers `GATE_RULINGS[g] ?? true`; a false gate makes
// `resolveDriver` return 0 at writePackUniforms.js:186).
//
// ⛔ WHICH SIDE OF THE BAR EACH ROW FALLS ON WAS MEASURED IN THE SHADER, NOT TAKEN FROM PROSE —
// `src/worldengine/shaders/height.glsl.js`, per combiner:
//     karst        :1194  `lowGround` off the running height          → reactive, stays ON
//     dunes        :1255  `lowGround` off the running height          → reactive, stays ON
//     massWasting  :1364  `hostGrad = gradIn - gradBase`              → reactive, stays ON
//   the other eight synthesise their own noise and amplitude-modulate it by `provinceWeight(...)`
//   alone, with floors of 0.15–0.50 so they still render where the mask says they do not belong.
//
// The three jobs that would clear the bar are written up, in increasing cost, in
// `docs/WORKSTREAMS/solid-relief-deck/FOLLOWUP-not-fully-developed.md`: (a) a per-feature suitability
// FIELD instead of a mask with floors; (b) make the surface-blind combiners read the accumulated
// relief, as the three reactive ones already do; (c) have the generative writers PLACE the landforms.
// **(b) is the one that clears it** — it is the bar, restated as work.
export const SOLID_RELIEF_GAME_GATES = Object.freeze({
  [MOUNTAIN_GATE]: Object.freeze({
    on: false,
    why: 'reads neither the accumulated height nor its gradient — it does not know where two plates converged, only that the province mask reads craton-ish here (floor 0.15)',
    waitingFor: 'FOLLOWUP (b) — read the accumulated relief. ⚠ ALSO generation-blocked from the other side: the bake\'s plate path claims 0 of 124 corpus bodies, so F1 needs BOTH halves.',
  }),
  [CANYON_GATE]: Object.freeze({
    on: false,
    why: 'surface-blind; the bake\'s own rift corridors (stagnantLid) are drawn separately and this combiner reads none of them',
    waitingFor: 'FOLLOWUP (b)',
  }),
  [SCARP_GATE]: Object.freeze({
    on: false,
    why: 'surface-blind — a scarp does not know it is cutting a rift',
    waitingFor: 'FOLLOWUP (b)',
  }),
  [PLATEAU_GATE]: Object.freeze({
    on: false,
    why: 'surface-blind — a plateau does not know it is sitting on a crater rim',
    waitingFor: 'FOLLOWUP (b)',
  }),
  [TESSERA_GATE]: Object.freeze({
    on: false,
    why: 'surface-blind; its own generative source (stagnantLid tessera) reaches pixels through the bake independently',
    waitingFor: 'FOLLOWUP (b)',
  }),
  [LAVA_GATE]: Object.freeze({
    on: false,
    why: 'surface-blind — a lava plain does not know which basin it is flooding',
    waitingFor: 'FOLLOWUP (b)',
  }),
  [SUB_GATE]: Object.freeze({
    on: false,
    why: 'surface-blind',
    waitingFor: 'FOLLOWUP (b)',
  }),
  [DUST_GATE]: Object.freeze({
    on: false,
    why: 'surface-blind, and the worst-modulated of the eleven — floor 0.50, i.e. half strength everywhere regardless of province',
    waitingFor: 'FOLLOWUP (b), and a floor that is not 0.5',
  }),

  // ── ON. These three clear the bar today: each reads the bake's accumulated surface. ──
  [KARST_GATE]: Object.freeze({
    on: true,
    why: 'takes lowGround off the running height (height.glsl.js:1194) — dolines pool in ground that is really low',
    waitingFor: null,
  }),
  [DUNE_GATE]: Object.freeze({
    on: true,
    why: 'takes lowGround off the running height (height.glsl.js:1255) — sand pools in real basins and flows around real relief',
    waitingFor: null,
  }),
  [MASSWAST_GATE]: Object.freeze({
    on: true,
    why: 'takes the host-slope residual gradIn - gradBase (height.glsl.js:1364) — talus banks at the foot of relief that is really there',
    waitingFor: null,
  }),
});

/**
 * The `GATE_RULINGS` slice for this pack: gate name -> boolean, derived from the registry above so
 * the two cannot disagree. ⛔ DERIVED, NEVER RESTATED — a hand-written second list is exactly the
 * one-name-two-meanings shape this codebase keeps paying for.
 */
export const SOLID_RELIEF_RULINGS = Object.freeze(
  Object.fromEntries(Object.entries(SOLID_RELIEF_GAME_GATES).map(([g, r]) => [g, r.on])),
);
