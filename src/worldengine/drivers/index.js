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
// from src/main.js:7752 `const planetMoon = new Planet(scenePMData, pmStarInfo);` and not through
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
import { giantDeckPack, bandedEnvelopeOf, giantDeckLabState } from './giantDeck.js';
import { LIMB_DECK_ENTRY } from './limbDeck.js';
import { POLAR_DECK_ENTRY } from './polarDeck.js';
import { ROCKY_SURFACE_ENTRY } from './rockySurface.js';
import { SOLID_OPTICS_ENTRY } from './solidOptics.js';
import { CRATER_DECK_ENTRY } from './craterDeck.js';
import { SOLID_FEATURES_ENTRY } from './solidFeatures.js'; import { GIANT_SURFACE_ENTRY } from './giantSurface.js';   // ⛔ TWO import STATEMENTS ON ONE LINE, ON PURPOSE. Fifteen live symbol-anchored refs point INTO this file by line — src/worldengine/drivers/limbDeck.js:173 `import plus one array element at` is one of them — so a new line here reds fifteen citations as some other block's failure. The same discipline world-engine-lab.html:188 keeps.
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
// has: writePackUniforms.js:180 `if (gates == null || !(d.gate in gates)) {` makes an ABSENT gate key throw, on the stated
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
    // ⭐ R-07's FIRST GATE, B3 leg 2. It was `compositionClass(condition) === 'gas'`; it is now the
    // deck's own condition-derived banding predicate, IMPORTED rather than retyped —
    // src/worldengine/drivers/giantDeck.js:89 `export function bandedEnvelopeOf(condition) {` — so this
    // line and `uBandStrength` cannot disagree. ⛔ WIDENING THIS LINE ALONE IS A MEASURED NO-OP; the
    // second gate is inside the pack and the reason is written at both ends.
    // ⚠ IT WIDENS THE CLAIM BUT MOVES NO BODY BETWEEN MATERIALS: the 130 bodies it adds are already
    // claimed by `rockySurface` and `solidOptics`, so the `packs.length > 0` term of the admission
    // test cannot flip for any record and no census is re-pinned. Measured, not read off these lines.
    // ⚠ AND IT MAKES THE COLLISION THROW BELOW LIVE ON THOSE 130 rather than inert: this deck now
    // co-applies with two non-gas packs. Their emitted name sets are disjoint — the deck writes the
    // `uBand*`/`uJet*` families, `rockySurface` the impact/palette ones and `solidOptics` the air
    // optics — asserted by NAME LOOKUP over a generated population in the deck's own suite.
    applies: (condition) => bandedEnvelopeOf(condition),
    gates: Object.freeze(['bands', 'jets']),
    pack: giantDeckPack, labState: giantDeckLabState,   // ⭐ labState ADDED 2026-08-26 — see the identical note on the seven *_ENTRY objects. This entry is the one built inline here rather than imported, so its mirror is imported on the giantDeck import line above. ⛔ RIDES THIS LINE.
  }),
  // ⛔ APPENDED AFTER giantDeck, NEVER BEFORE IT, AND THIS IS NOT A STYLE PREFERENCE. Four
  // assertions index this array POSITIONALLY, and the dangerous one is
  // tests/driver-pack-polardeck.test.js's disjointness check, which reads `PACKS[0].pack(...)` with a
  // hardcoded `{ bands: true, jets: true }` gate map. Insert anything at index 0 and that test
  // compares polarDeck against the WRONG pack, finds them disjoint, and passes GREEN while asserting
  // nothing about giantDeck. Those four are converted to name lookups in this same commit; the
  // append order is the belt to that braces.
  //
  // ⛔ IMPORTED, NEVER RETYPED. Both entries are frozen and exported from their own modules, where
  // their predicates and their driver→field mappings are gated. A hand-written copy here would be a
  // second expression of the same law, free to drift from the one under test — and the natural wrong
  // version is measured, not imagined: `!!condition.atmosphere` admits every rocky and icy
  // world-engine body, which is Step 9's whole population arriving unruled at Step 6.
  //
  // ⚠ ALL THREE PREDICATES ARE `compositionClass(condition) === 'gas'`, character for character, so
  // registration admits EXACTLY the bodies already admitted — measured as set MEMBERSHIP over a
  // generated population in each pack's own suite, not inferred from reading three source lines.
  // Registration therefore cannot move a body from the legacy material to the lab material; it can
  // only change which uniforms an already-swapped body carries.
  //
  // ⛔⛔ THAT PARAGRAPH IS TRUE OF THE THREE GAS ENTRIES ABOVE AND **FALSE AS OF STEP 10a**. It held
  // only because all three predicates were `compositionClass(condition) === 'gas'` character for
  // character, so the union of claims never grew. `rockySurface` is the COMPLEMENT, `!== 'gas'`, and
  // src/objects/Planet.js:2197 `const packs = condition ? selectPacks(condition).map((e) => e.name) : [];`
  // feeds `packs.length > 0` into the admission test one line below it. A pack whose predicate claims
  // bodies no other pack claimed therefore ADMITS THEM TO THE LAB MATERIAL. Measured over
  // lab-procedural-0…199: swapped planets 341 -> 846, and 188 of the newcomers lose a legacy branch
  // that nothing yet rewrites (lava 52, ocean 6, venus 130 — ledger rows R-05, R-06, R-07).
  // ⭐ NOT A LIVE REGRESSION, AND THE REASON IS THE FLAG, NOT THE PACK: src/objects/Planet.js:2158
  // `export const LAB_GAS_BODIES_DEFAULT = true;` is the first term of that same admission test — ⭐ FLIPPED AT B7, 2026-08-21, so the first term now PASSES and admission turns on the other two. ⛔ Sol is still refused, by PROVENANCE rather than by the flag. Formerly `= false`, and so
  // none of this reaches a player until Step 12 deletes the fallbacks. It IS the trajectory Step 12
  // commits to, and the ledger is where those losses are declared before Max is asked to accept them.
  // ⚠ ANY FUTURE PACK WITH A NON-'gas' PREDICATE WIDENS THE SWAPPED POPULATION. Say so in the commit
  // and re-record the census in the same edit, or the parity fence reds on a declared change and
  // reads as a regression.
  LIMB_DECK_ENTRY,
  POLAR_DECK_ENTRY,
  // ── STEP 10a. THE FOURTH ENTRY, AND THE FIRST WHOSE PREDICATE IS NOT `=== 'gas'`.
  //
  // ⛔ APPENDED, NEVER PREPENDED, for the positional reason spelled out above — and with one extra
  // consequence the three gas entries did not have: this predicate is their exact COMPLEMENT, so
  // every body in the corpus is now claimed by exactly one of the two disjoint halves. The
  // collision throw below stays inert, and the pack suites assert that by NAME lookup rather than
  // by trusting a reading of four `applies` lines.
  //
  // ⚠ THIS IS THE FIRST ENTRY THAT MOVES BODIES FROM THE LEGACY MATERIAL TO THE LAB ONE. The
  // paragraph above says registration "cannot move a body"; that was true while all three
  // predicates were `=== 'gas'`, and it stops being true on this line. MEASURED over
  // lab-procedural-0…199: planets claimed by at least one pack go 343 -> 852 (i.e. all of them) and
  // swapped go 341 -> 846, the six refusals being provenance, not the predicate. Per-branch, three
  // legacy rocky branches become live for the first time — lava (52 bodies), ocean (6) and venus
  // (130). tests/material-parity-list.test.js's census is re-pinned in this same commit for that
  // declared reason; a census that moved silently is indistinguishable from a regression.
  // ⛔ THE PARITY LEDGER IS NOT CLOSED BY THAT RE-PIN, and an earlier draft of this note mis-routed
  // the work: of the eight §2/§3/§4 assertions the registration reddened, only TWO read the ledger
  // doc at all. Rows R-05/R-06/R-07 close those; five were pins this suite re-records itself, and
  // one was an instrument bug (`LEDGER.written` sampled the FIRST body, so it silently re-pointed at
  // rockySurface). What stays Max's (2026-08-09) is the SCHEDULING, recorded in each row's evidence.
  //
  // ⭐ `!== 'gas'` AND NOT `=== 'rocky'`, and the difference is a gate two commits away rather than
  // a style preference. Measured over the same corpus, plain moons are {rocky: 407, icy: 225} with
  // zero gas — so `=== 'rocky'` claims 64.4% of them, under the ≥95% bar Step 10's moon branch has
  // to clear, and the shortfall would surface as an unreachable gate with nothing pointing here.
  ROCKY_SURFACE_ENTRY,
  // ── BLOCK B3 leg 1. THE FIFTH ENTRY. Ledger rows P-11 (limb + terminator) and P-05 (aurora).
  //
  // ⭐ ITS PREDICATE IS CHARACTER-IDENTICAL TO ROCKY_SURFACE_ENTRY'S, `!== 'gas'`, AND THAT IS THE
  // WHOLE OF ITS POPULATION ARGUMENT. `selectPacks` already returns a non-empty list for every body
  // this claims — rockySurface claims the same set — so the `packs.length > 0` term of
  // src/objects/Planet.js:2199 `      admitted: flag.enabled && provenance.isWorldEngine && packs.length > 0,`
  // cannot flip for any record. ⛔ Unlike Step 10a's entry directly above, THIS ONE MOVES NO BODY
  // between materials and re-pins no census. That is asserted over lab-procedural-0…199 in
  // tests/driver-pack-solidoptics.test.js by comparing the swapped SET before and after
  // registration, not by comparing two `applies` lines by eye.
  //
  // ⛔ IT CO-APPLIES WITH rockySurface ON EVERY BODY IT CLAIMS, so the collision throw below is the
  // live guard rather than an inert one, and the two emitted name sets have to stay disjoint. They
  // are: rockySurface writes the crater/ejecta/palette families, this writes the air-optics ones.
  // Asserted by NAME LOOKUP in both suites.
  //
  // ⚠ WHAT IT DOES NOT CLOSE. `uLimbStrength` is not in P-11's subject list and is not written here,
  // so the limb pair it forwards is inert on pixels behind that uniform's 0.0 default. Named in the
  // pack header; it is a UAT decision about ~1000 solid bodies, not a wiring one.
  SOLID_OPTICS_ENTRY,
  // ── BLOCK B3 leg 2. THE SIXTH ENTRY. Ledger row P-14's crater half.
  //
  // ⭐ ITS PREDICATE IS THE EXACT COMPLEMENT OF ROCKY_SURFACE_ENTRY'S, `=== 'gas'`, AND THAT IS THE
  // WHOLE OF BOTH ITS POPULATION ARGUMENT AND ITS COLLISION ARGUMENT. Population: every gas-class
  // body is ALREADY claimed by giantDeck, so the `packs.length > 0` term of
  // src/objects/Planet.js:2199 `      admitted: flag.enabled && provenance.isWorldEngine && packs.length > 0,`
  // cannot flip for any record and NO CENSUS MOVES — the opposite of Step 10a's entry above, which
  // was the first to widen the swapped population and said so. Collision: `rockySurface` writes the
  // impact family on `!== 'gas'` and this writes it on `=== 'gas'`, so across any corpus EXACTLY ONE
  // pack writes each of the ten names on each body — never zero, which is what P-14 was, and never
  // two, which the throw below refuses.
  //
  // ⛔ IT SHARES ITS DRIVER BLOCK WITH `rockySurface` BY IMPORT, NOT BY COPY. Both call
  // src/worldengine/drivers/craterDeck.js:96 `export function craterDriverBlock(condition) {`, so the
  // two packs cannot answer differently for the same condition — asserted directly in
  // tests/driver-pack-craterdeck.test.js rather than inferred from the import graph.
  CRATER_DECK_ENTRY,
  // ── BLOCK B3 leg 3. THE SEVENTH ENTRY. Six lab features that no pack wrote: F7 volcanic edifices,
  // F9 chaos + F10 ridged icy (one shared master), F23 snowline/frost, F22 polar caps, F17 glacial.
  //
  // ⭐ ITS PREDICATE IS CHARACTER-IDENTICAL TO ROCKY_SURFACE_ENTRY'S AND SOLID_OPTICS_ENTRY'S,
  // `!== 'gas'`, so this registration is population-neutral in the same way leg 1's was:
  // `selectPacks` already returns a non-empty list for every body it claims, the `packs.length > 0`
  // term of src/objects/Planet.js:2199 `      admitted: flag.enabled && provenance.isWorldEngine && packs.length > 0,`
  // cannot flip for any record, and NO CENSUS IS RE-PINNED. Asserted over lab-procedural-0…199 in
  // tests/driver-pack-solidfeatures.test.js by comparing the swapped SET before and after
  // registration, not by reading three `applies` lines by eye.
  //
  // ⛔ IT CO-APPLIES WITH THREE PACKS, so the collision throw below is live rather than inert:
  // `rockySurface` and `solidOptics` on every body it claims, and `giantDeck` on the 130 venus-class
  // bodies R-07 admitted at leg 2. All four emitted name sets are disjoint — asserted by NAME LOOKUP
  // over a generated population in this pack's suite.
  //
  // ⚠ IT DECLARES FOUR GATE NAMES THAT DID NOT EXIST BEFORE — `edifices`, `chaos`, `frost`,
  // `glacial` — and `gatesFor` answers ALL_ON for each. That is PLAN §9 ruling 4 applied to four
  // more lab checkboxes, and it is a VISIBLE change on every swapped solid body rather than a
  // no-op: six feature families stop reading their factory default. It is the point of the leg.
  SOLID_FEATURES_ENTRY,
  // ── PACK #8 · giantSurface — ledger P-11's GAS HALF, P-12 and P-13, 2026-08-21 ─────────────────
  // ⭐⭐ IT IS THE COMPLEMENT OF `rockySurface` AND `solidOptics`, AND THAT IS THE WHOLE OF BOTH ITS
  // POPULATION ARGUMENT AND ITS COLLISION ARGUMENT. Those two register on
  // src/worldengine/drivers/rockySurface.js:349 `    applies: (condition) => compositionClass(condition) !== 'gas',`, so the thirteen names
  // they carry were unwritten on every gas-class body and answered the LAB FACTORY DEFAULT while the
  // GAME had a per-body value in hand — measured at 0604d13 on the gas giant Meameinath, where
  // `uTermStrength` and `uBioGroundCover` both read 0.
  //
  // ⛔ IT MOVES NO BODY BETWEEN MATERIALS. Every gas-class body is already claimed by `giantDeck`,
  // `limbDeck`, `polarDeck` and `craterDeck`, so the `packs.length > 0` term of
  // src/objects/Planet.js:2199 `      admitted: flag.enabled && provenance.isWorldEngine && packs.length > 0,`
  // cannot flip for any record and no census is re-pinned.
  //
  // ⛔ IT CO-APPLIES WITH FOUR PACKS AND WITH NEITHER SOLID ONE. Because the predicate is the exact
  // complement, no body ever runs this pack and `rockySurface`/`solidOptics` together — the thirteen
  // names cannot meet their solid-side twins on one body. Against the four gas packs that DO
  // co-apply the emitted sets are disjoint by name, asserted by NAME LOOKUP over a generated
  // population in this pack's suite rather than by reading `applies` lines by eye.
  //
  // ⚠ IT DECLARES NO NEW GATE NAME — `terminator` is `solidOptics`'s, IMPORTED rather than retyped,
  // so both halves of the population honour one checkbox. ⚠ AND IT IS A VISIBLE CHANGE ON EVERY
  // SWAPPED GAS BODY RATHER THAN A NO-OP, but only through two of its three families: the terminator
  // triple lights a twilight band that the legacy material already draws on those same bodies, and
  // the three domain offsets stop 343 gas-class bodies sharing one relief domain. The palette seven
  // change VALUES ONLY — the deck replaces the ground albedo at mask 1.0 — and giantSurface.js's
  // header carries the measurement rather than leaving it to be rediscovered as a bug.
  GIANT_SURFACE_ENTRY,
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
  return runPacks(condition, ctx, {
    label: 'applyDriverPacks',
    write: (entry, result, packCtx) => { writePackUniforms(uniforms, result.drivers, packCtx); },
  });
}

/**
 * Run every applicable pack against one LAB STATE object — the state-mirroring front-end's entry
 * point, and the exact counterpart of applyDriverPacks above.
 *
 * ⭐⭐ WHY A SECOND ENTRY POINT RATHER THAN AN ADAPTER, and it is not a sink-shape convenience.
 * The two front-ends genuinely need different things and the difference is load-bearing:
 *
 *   GAME: pack -> uniforms. Final. Nothing reads them back.
 *   LAB:  pack -> `state` -> uniforms every frame. `state` is what the lil-gui sliders are bound to
 *         with `.listen()`, so a pack that wrote uniforms DIRECTLY in the lab would render correctly
 *         and leave every slider showing a stale number — the authoring surface silently lying.
 *         solidFeatures.js:322 says so in its own words: the mirror "is what makes the import-back
 *         survivable: every one of the fourteen is a live `.listen()`".
 *
 * So the lab's mirror is not a workaround to be adapted away; it is the correct sink for that
 * front-end, and each pack already owns its own (`<NAME>_LAB_BINDING` + `<name>LabState`). What was
 * missing was only the registry knowing about them — now `entry.labState`.
 *
 * ⛔ AND THE SELECTION PATH IS SHARED, NOT COPIED. Both entry points call `runPacks`, so the
 * applicability predicates, the gate policy, the collision throws and the returned shape cannot
 * drift between lab and game. A second hand-written loop here would be a new lab/game divergence
 * inside the very function whose job is to end them.
 *
 * ⚠ WHAT THIS BUYS THE LAB BEYOND TIDINESS: the lab calls eight packs by hand today with NO
 * collision detection and NO gate policy. Two packs naming one uniform is currently last-writer-wins
 * by source order, with no symptom. Through here it throws.
 *
 * @param {object} state      the lab's authoring state object; mutated in place.
 * @param {object} condition  the body's condition vector.
 * @param {object} ctx        pack context MINUS `gates`, supplied per entry from the gate policy.
 * @returns {{applied: string[], skipped: string[], attributes: object, uniformsWritten: string[],
 *            gates: object, meta: object, results: object, stateWritten: string[]}}
 *   `attributes`, `meta` and `results` are RETURNED rather than applied, because the bespoke work
 *   each lab call site does around its pack — geometry attribute uploads, direct-driver writes,
 *   live-AC probes — is the front-end's and this module must not invent it.
 */
export function applyDriverPacksToState(state, condition, ctx = {}) {
  if (state == null || typeof state !== 'object') {
    throw new PackContractError(
      'applyDriverPacksToState: state object is missing. Refusing rather than no-oping, for the ' +
      'same reason applyDriverPacks refuses a material without uniforms: a silent skip is a body ' +
      'that authors nothing and reports success.',
    );
  }
  const stateWritten = [];
  return runPacks(condition, ctx, {
    label: 'applyDriverPacksToState',
    stateWritten,
    write: (entry, result) => {
      if (typeof entry.labState !== 'function') {
        throw new PackContractError(
          `applyDriverPacksToState: pack '${entry.name}' has no labState mirror on its registry ` +
          'entry. Every pack owns one; an entry without it would silently author nothing in the ' +
          'lab while the game rendered it, which is the two-route divergence this file exists to end.',
        );
      }
      const mirrored = entry.labState(result);
      for (const name of Object.keys(mirrored)) {
        if (stateWritten.includes(name)) {
          throw new PackContractError(
            `applyDriverPacksToState: state field '${name}' is written by two packs on the same ` +
            `body (${stateWritten.join(', ')} then ${entry.name}). Array order would decide what ` +
            'the lab authors, which is not a decision anyone made.',
          );
        }
        stateWritten.push(name);
      }
      Object.assign(state, mirrored);
    },
  });
}

/**
 * The one selection/gate/collision path both entry points run. Everything that could drift between
 * the lab and the game if it were written twice lives HERE and is written once.
 */
function runPacks(condition, ctx, sink) {
  // The display policy is the FRONT-END's and this module never invents one — see
  // src/worldengine/port/writePackUniforms.js:107 `export function assertDisplayPolicy(ctx) {`.
  assertDisplayPolicy(ctx);
  if (ctx.gates !== undefined) {
    throw new PackContractError(
      `${sink.label}: ctx.gates is supplied per-entry by the gate policy and may not be passed ` +
      'in. A caller-supplied map would silence the absent-gate throw for every pack at once.',
    );
  }

  const applied = [];
  const skipped = [];
  const attributes = {};
  const uniformsWritten = [];
  const meta = {};
  const gates = {};
  const results = {};

  for (const entry of PACKS) {
    if (entry.applies(condition, ctx) !== true) { skipped.push(entry.name); continue; }
    const entryGates = gatesFor(entry);
    const packCtx = { ...ctx, gates: entryGates };
    const result = assertPackResult(entry.pack(condition, packCtx), entry.name);

    // ⛔ COLLISION IS AN ERROR, NOT A LAST-WRITER-WINS. Two packs claiming one body is legal by
    // construction (Step 9's rocky pack and giantDeck are mutually exclusive TODAY and nothing
    // enforces that they stay so), and the moment two of them name the same uniform the visible
    // result is whichever entry sits later in the array — an ordering dependency with no symptom.
    for (const name of Object.keys(result.drivers)) {
      if (uniformsWritten.includes(name)) {
        throw new PackContractError(
          `${sink.label}: uniform '${name}' is written by two packs on the same body ` +
          `(${uniformsWritten.join(', ')} then ${entry.name}). Array order would decide what ` +
          'renders, which is not a decision anyone made.',
        );
      }
    }
    for (const name of Object.keys(result.attributes)) {
      if (name in attributes) {
        throw new PackContractError(
          `${sink.label}: vertex attribute '${name}' is baked by two packs on the same body.`,
        );
      }
    }

    sink.write(entry, result, packCtx);

    for (const name of Object.keys(result.drivers)) uniformsWritten.push(name);
    Object.assign(attributes, result.attributes);
    Object.assign(gates, entryGates);
    meta[entry.name] = result.meta ?? null;
    results[entry.name] = result;
    applied.push(entry.name);
  }

  const out = { applied, skipped, attributes, uniformsWritten, gates, meta, results };
  if (sink.stateWritten) out.stateWritten = sink.stateWritten;
  return out;
}

