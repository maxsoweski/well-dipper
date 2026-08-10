// src/worldengine/drivers/index.js
// ─────────────────────────────────────────────────────────────────────────────
// THE RUNTIME PACK COMPOSITION POINT (PLAN §4 "Step 6", 6a).
//
//     applyDriverPacks(material, condition, ctx)   // iterates PACKS
//
// ⭐ WHY THIS EXISTS AT ALL, given that today it iterates an array of length one. Step 6 ships ONE
// body class, so a single `if` in `Planet._createSurface` would render the same pixels. The cost
// this file removes is not today's — it is the shape of the edit Steps 9 and 10 have to make.
// Without it, admitting a class means editing the branch that mounts the material, and there are
// THREE such sites: `Planet._createSurface` (planets), `BodyRenderer.createMoon` (plain moons), and
// `Planet._createSurface` AGAIN by a different route for planet-class moons, which reach Planet.js
// from src/main.js:7422 `const planetMoon = new Planet(scenePMData, pmStarInfo);` and not through
// BodyRenderer at all. Three sites, one of them easy to miss, and the failure mode of missing it is
// a feature that renders on some bodies and not others with NOTHING COMPLAINING — no throw, no red
// test, just a class of body that quietly kept the old look. With this array, admitting a class is
// one entry and the mount sites do not change.
//
// ⛔ EACH PACK'S APPLICABILITY PREDICATE IS DERIVED FROM THE CONDITION — NEVER FROM A `type` LABEL.
// This is not a style rule and it is measurable in this repo right now:
//   · src/generation/SolarSystemData.js:271 `type: 'gas-giant',` (Jupiter) and :344 `type: 'gas-giant',`
//     (Saturn) are literally that label, yet both carry `atmosphere: null`, so
//     src/worldengine/base/e1Regime.js:66 `export function compositionClass(cv) {` returns 'rocky'
//     for both. A `type`-keyed predicate and a condition-keyed one disagree on Sol's two largest
//     planets (11.21 and 9.45 R⊕), in opposite directions. One of the two is reading a field the
//     generator assigned for RENDERING; the other is reading the body's atmosphere.
//   · Measured over Sol's 13 planets: `type === 'gas-giant'` selects 2 (Jupiter, Saturn);
//     `compositionClass === 'gas'` selects 2 (Uranus, Neptune). The two sets are DISJOINT.
// The condition is the thing the pipeline is for. `type` is a rendering label the generator picked.
//
// ⛔ THE PREDICATE IS NOT THE SOL EXCLUSION AND MUST NOT BE ASKED TO BE. The line above says
// `compositionClass === 'gas'` selects Sol's Uranus and Neptune — so a predicate that were the only
// gate would admit two Sol bodies. Sol is excluded by PROVENANCE at the mount site
// (`labPipelineAdmits` in src/objects/Planet.js), which is PLAN §4 Step 6d, and the split is
// deliberate: "is this body's condition one my pack models" and "did this body come out of the
// world engine" are different questions and a predicate that answered both would answer neither
// well. tests/gas-body-lab-material.test.js asserts BOTH halves, including the half that shows the
// predicate alone is insufficient.
//
// ⛔ NO RENDERER IN THE CLOSURE — and that is a NARROWER claim than "three-free", deliberately.
// ⚠ MEASURED, after this comment first said the wrong thing: the closure is base/ + port/, and the
// base tree is NOT free of bare specifiers — `alea` and `simplex-noise` are reachable through
// giant-drivers.js / climate-e5.js / band-flow.js, which is where the seeded streams live.
// tests/pack-contract.test.js's zero-bare assertion holds for `featureScale.js` and
// `writePackUniforms.js` only. What this module must guarantee is that neither front-end's RENDERER
// is reachable, so a pack can run in a headless test, in the lab and in the game — and
// tests/gas-body-lab-material.test.js asserts `three` is absent AND pins the npm set by name, so a
// new dependency in the shared tree is a deliberate edit. That is also why `attributes` are
// RETURNED rather than written: setting a vertex attribute needs `THREE.BufferAttribute`, so the
// caller — which already owns three — does that one line.
// ─────────────────────────────────────────────────────────────────────────────
import { compositionClass } from '../base/e1Regime.js';
import { giantDeckPack } from './giantDeck.js';
import {
  writePackUniforms, assertDisplayPolicy, assertPackResult, PackContractError,
} from '../port/writePackUniforms.js';

// ── The gate policy ──────────────────────────────────────────────────────────
// PLAN §9 ruling 4: `gates = ALL_ON` for the game. The lab's 49 checkboxes decide whether ~40
// features render AT ALL, and the game has no checkboxes; ALL_ON is the standing-constraint-1
// answer (the game bends toward the lab) and Max sees the consequence at Step 6's screenshot as a
// DECISION he made, not a regression he discovered.
//
// ⚠ THE GATE MAP IS BUILT FROM EACH PACK'S OWN DECLARED GATE NAMES, NOT FROM A PROXY THAT ANSWERS
// `true` FOR EVERYTHING. A Proxy would be shorter and it would destroy the one property the writer
// has: writePackUniforms.js:166 `if (gates == null || !(d.gate in gates)) {` makes an ABSENT gate key throw, on the stated
// grounds that "an absent gate is not an off gate and is not an on gate — it is an unanswered
// rendering decision". Under a permissive proxy, a pack that started emitting a driver gated on a
// name nobody had ever ruled on would silently render it ON. Declaring the names per entry keeps
// that throw alive: the new gate is unanswered until someone adds it here.
export const GATE_POLICY_ALL_ON = 'all-on';

/** The ctx.gates map for one entry under the ALL_ON policy: every DECLARED gate true, no others. */
export function gatesFor(entry, policy = GATE_POLICY_ALL_ON) {
  if (policy !== GATE_POLICY_ALL_ON) {
    throw new PackContractError(`unknown gate policy '${String(policy)}'.`);
  }
  const out = {};
  for (const g of entry.gates) out[g] = true;
  return out;
}

// ── THE ARRAY ────────────────────────────────────────────────────────────────
// Steps 9 and 10 add ONE ENTRY each. Nothing below this array knows how many entries there are.
//
// `name`    — stable identifier. Instrument E captions print it; the membership fence pins it.
//             ⚠ Pinned as a SET OF NAMES and not as a length: a count-preserving permutation is
//             byte-identical to every instrument this program owns (measured in Step 4), so a
//             length assertion would pass a swap of one pack for another.
// `applies` — (condition, ctx) -> boolean. CONDITION-DERIVED. See the ⛔ in the header.
// `gates`   — the gate names this pack's drivers may key on, so `gatesFor` can answer ALL_ON
//             without a permissive default. A driver gated on a name absent here throws.
// `pack`    — (condition, ctx) -> { drivers, attributes, meta }, the Step 5 contract.
export const PACKS = Object.freeze([
  Object.freeze({
    name: 'giantDeck',
    applies: (condition) => compositionClass(condition) === 'gas',
    gates: Object.freeze(['bands', 'jets']),
    pack: giantDeckPack,
  }),
]);

/** The entries whose predicate claims this condition, in array order. */
export function selectPacks(condition, ctx = {}) {
  if (condition == null || typeof condition !== 'object') {
    throw new PackContractError('selectPacks: condition vector is missing.');
  }
  return PACKS.filter((e) => e.applies(condition, ctx) === true);
}

/**
 * Run every applicable pack against one material.
 *
 * @param {{uniforms: object}} material  a THREE-style material (only `.uniforms` is touched).
 * @param {object} condition             the body's condition vector.
 * @param {object} ctx                   the Step 5a pack context MINUS `gates`, which this
 *                                       function supplies per entry from the gate policy.
 * @returns {{
 *   applied: string[], skipped: string[], attributes: object,
 *   uniformsWritten: string[], gates: object, meta: object,
 * }}
 *   `attributes` is returned rather than written — see the three-free note in the header. Every
 *   field is named so an Instrument E caption can print WHAT RAN on the body it is showing,
 *   instead of the caption asserting it from the plan.
 */
export function applyDriverPacks(material, condition, ctx = {}) {
  const uniforms = material == null ? null : material.uniforms;
  if (uniforms == null || typeof uniforms !== 'object') {
    throw new PackContractError(
      'applyDriverPacks: material has no uniforms map. Refusing rather than no-oping: a silent ' +
      'skip here is a body that renders the pack-less default and reports success.',
    );
  }
  // The display policy is the FRONT-END's and this module never invents one — see
  // src/worldengine/port/writePackUniforms.js:107 `export function assertDisplayPolicy(ctx) {`.
  assertDisplayPolicy(ctx);
  if (ctx.gates !== undefined) {
    throw new PackContractError(
      'applyDriverPacks: ctx.gates is supplied per-entry by the gate policy and may not be passed ' +
      'in. A caller-supplied map would silence the absent-gate throw for every pack at once.',
    );
  }

  const applied = [];
  const skipped = [];
  const attributes = {};
  const uniformsWritten = [];
  const meta = {};
  const gates = {};

  for (const entry of PACKS) {
    if (entry.applies(condition, ctx) !== true) { skipped.push(entry.name); continue; }
    const entryGates = gatesFor(entry);
    const packCtx = { ...ctx, gates: entryGates };
    const result = assertPackResult(entry.pack(condition, packCtx), entry.name);

    // ⛔ COLLISION IS AN ERROR, NOT A LAST-WRITER-WINS. Two packs claiming one body is legal by
    // construction (Step 9's rocky pack and this one are mutually exclusive TODAY and nothing
    // enforces that they stay so), and the moment two of them name the same uniform the visible
    // result is whichever entry sits later in the array — an ordering dependency with no symptom.
    for (const name of Object.keys(result.drivers)) {
      if (uniformsWritten.includes(name)) {
        throw new PackContractError(
          `applyDriverPacks: uniform '${name}' is written by two packs on the same body ` +
          `(${uniformsWritten.join(', ')} then ${entry.name}). Array order would decide what ` +
          'renders, which is not a decision anyone made.',
        );
      }
    }
    for (const name of Object.keys(result.attributes)) {
      if (name in attributes) {
        throw new PackContractError(
          `applyDriverPacks: vertex attribute '${name}' is baked by two packs on the same body.`,
        );
      }
    }

    writePackUniforms(uniforms, result.drivers, packCtx);
    for (const name of Object.keys(result.drivers)) uniformsWritten.push(name);
    Object.assign(attributes, result.attributes);
    Object.assign(gates, entryGates);
    meta[entry.name] = result.meta ?? null;
    applied.push(entry.name);
  }

  return { applied, skipped, attributes, uniformsWritten, gates, meta };
}
