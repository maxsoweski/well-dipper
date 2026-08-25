// src/worldengine/drivers/polarDeck.js
// ─────────────────────────────────────────────────────────────────────────────
// DRIVER PACK #2 — THE POLAR VORTEX (PLAN §4 "Step 5" contract; carried ledger C19). F29.
//
//     polarDeckPack(condition, ctx) -> { drivers, attributes, meta }
//
// It composes ONE module that was already pure, three-free and shared:
//
//     giantRegimeOf  ->  resolvePolarVortex
//
// ⭐ WHAT THIS LANE ACTUALLY DID, STATED SO NOBODY HAS TO INFER IT. C19 reads "give `uPolarStrength`
// a producer the game can call", and the producer was NOT lab-local. It is
// src/worldengine/base/storm-e.js:462 `function resolvePole(regime, stormsOn, vigor, rng) {`, which
// has been shared, pure and ported since the #3b merge and was merely UN-EXPORTED — reachable only
// by going through `resolveStormE`, i.e. only by paying for the whole storm slice. This pack does
// not extract a law out of planet-lod-lab.html; it opens a door onto one that was already inside
// `src/worldengine/`. The lab's planet-lod-lab.html:1916 `const _pd = polarDeckPack(_scond, {` is a
// CONSUMER of that producer, not the producer.
//
// ⛔ SO THE "THE LAB MUST IMPORT IT BACK" ACCEPTANCE TEST IS SATISFIED ALREADY, AND SAYING WHY IS
// PART OF THE MEASUREMENT. The heightNoise.glsl.js pattern exists to stop an extraction forking into
// a lab copy and a game copy. Here there is exactly one copy of `resolvePole` and the lab reaches it
// through planet-lod-lab.html:186 `import { resolveStormE, bakeStormEAttributes, chromophoreColor, STORM_DECK } from './src/worldengine/base/storm-e.js';   // #3b Slice P: physics vortex placement (shear argmax) + storm/convection MASK (the one new baked attribute); V-α.4 chromophore age→color ramp; S2 STORM_DECK deck table (carriage deckZ derivation)`.
// The single-source property is therefore not something a lab edit would establish — it is a
// property `resolvePolarVortex` either preserves or breaks, which is why the acceptance evidence is
// the BYTE-IDENTITY control in tests/driver-pack-polardeck.test.js (`resolvePolarVortex(a,b,c,d)`
// deep-equals `resolveStormE(a,b,c,d).pole` over the regime × seed × obliquity grid) and NOT a
// second import line. A test that can be made to fail beats a line that cannot.
//
// ⛔ WHY THIS IS A SEPARATE PACK AND NOT A FEW MORE LINES IN giantDeck.js. That module carries a
// loud and CORRECT fence — src/worldengine/drivers/giantDeck.js:22 `would be naming a uniform whose producer is out of scope.`
// The fence stays TRUE under this design: pack #1 still does not carry the polar family, and what
// changed is that a SIBLING now has the producer in scope. Extending pack #1 instead would force
// that comment to be rewritten from a statement into a history note, and would
// put two unrelated scope fences in one module. The uniform-collision throw at
// src/worldengine/drivers/index.js:305 `throw new PackContractError(` guarantees the two packs
// cannot silently overlap; their emitted name sets are disjoint (`uBand*`/`uJet*` vs `uPolar*`) and
// the pack test asserts that as a set difference rather than trusting the prefixes.
//
// ⛔ WHAT THIS PACK DELIBERATELY DOES NOT DO — read before adding a uniform.
// ---------------------------------------------------------------------------------------------
//  · THE STORM SLICE STAYS FENCED. PLAN §7 fences the lab function planet-lod-lab.html:1811 `function applyStormState(){`
//    by name, along with the F27/F28 `uStorm*` family, and leaves `aStorm`
//    zero-filled. This module imports `resolvePolarVortex` and NOTHING else from storm-e.js: it
//    never names `resolveStormE`, `writeStormESphere` or `bakeStormEAttributes`, emits no `uStorm*`
//    driver, and returns an EMPTY `attributes` map, so the zero-fill at
//    src/objects/Planet.js:2043 `const zeroFilled = ensureLabAttributes(geometry);` still supplies
//    `aStorm`. The pack test asserts all four as a source scan + an output scan.
//  · `uPolarAmp` AND `uPolarW` ARE NOT WRITTEN, AND THAT IS THE FAMILY BEING 8-DRIVEN OF 10, NOT AN
//    OMISSION. planet-lod-uniforms.js:429 `uPolarAmp:        { value: 0.12 },  // F29 polygon meander amplitude — lab knob (0.26 x 1.12 = 0.29 stays inside the 0.38 gate)`
//    and planet-lod-uniforms.js:433 `uPolarW:          { value: 0.025 }, // F29 polygon collar half-width rad — lab knob`
//    are LAB KNOBS with no producer on either side — the lab writes them straight from a slider whose
//    default equals the table default. Writing them here would be authoring a law this port has no
//    source for. Measured rather than assumed: the pack test asserts table default == lab slider
//    default for both, so "unwritten" is provably equal to the lab and not merely unwritten.
//  · NO PER-FEATURE RELEVANCE KEY, and this one is FORCED, not chosen. The lab folds a relevance
//    hard-gate in at planet-lod-lab.html:5174 `uniforms.uPolarStrength.value = state.polarVortexEnabled ? state.polarStrength * state.featureRelevant.polarVortex : 0.0;   // ✓ enable gate × per-feature relevance hard-gate (Thread B idiom) — zeros Mars leak (polar vortex authored for gas giants, not terrestrial)`,
//    whose signal is preset membership in `ASSOCIATIONS.polarVortex.rendersOn`. The game's
//    src/objects/Planet.js:2204 `export const GAME_RELEVANCE = Object.freeze({});   // pack #1 keys no per-feature relevance`
//    is empty, and a driver keying an absent relevance name THROWS. ⭐ MEASURED, over all 18 driver
//    presets: `compositionClass(cond) === 'gas'` and `rendersOn.includes(preset)` agree 18/18 with
//    zero disagreements — the lab's preset-NAME table and this pack's condition-derived predicate
//    select the same worlds. So the hard-gate survives as the ADMISSION predicate rather than as a
//    multiply, and the pack test re-runs that 18/18 measurement instead of quoting it.
//
// ⭐ THE PRESENCE PRIOR WILL MAKE A CORRECT WIRE LOOK BROKEN, AND NO COMMENT PREVENTS THAT — ONLY A
// POPULATION CONTROL DOES. `uPolarStrength` is NOT a master gate here. It is the per-seed PRESENCE
// coin from src/worldengine/base/storm-e.js:107 `export const POLAR_PRESENCE_PRIOR = Object.freeze({`
// — 0.98 Jovian, 0.97 Saturnian, 0.55 Neptunian, 0.45 sub-Neptune — so a live look at ONE ice giant
// can read 0 with everything working. The pack test therefore gates the observed present-FRACTION
// over a named population against the prior AND names one body that comes up present; a single-body
// check would confuse "the coin said absent" with "the wire is dead" in both directions.
//
// ⛔ THREE-FREE. The import closure is base/ + port/ only. `alea` is reachable through storm-e.js,
// as it already is through giantDeck.js's own closure — tests/gas-body-lab-material.test.js pins the
// npm set by name and fences `three` out, and the pack test re-asserts the absence of a renderer.
// ⛔ NO `Math.random`, NO `Date.now`. The only entropy is the `stormE:polar` alea stream keyed on
// (`ctx.macroSeed`, the declared storm seed).
// ─────────────────────────────────────────────────────────────────────────────
import { compositionClass, giantRegimeOf } from '../base/e1Regime.js';
import { resolvePolarVortex } from '../base/storm-e.js';
import {
  scalar, assertMacroSeed, assertDisplayPolicy, assertPackResult, resolveDriver, PackContractError,
} from '../port/writePackUniforms.js';

// ── THE ONE GENUINELY NEW LAW IN THIS PACK, DECLARED RATHER THAN DEFAULTED ───────────────────────
// `resolvePolarVortex` takes a (macroSeed, stormSeed) PAIR. The game supplies `macroSeed` per body
// already (src/objects/Planet.js:2250 `macroSeed: labMacroSeed(d),`) but has no storm UI and so has
// never had a `stormSeed`. The lab's is a lil-gui default, planet-lod-lab.html:998 `stormSeed: 1234,      // F27 storm-placement seed — SEED IDENTITY: not reset on preset change; the folder 🎲 rerolls it`
// — and copying 1234 would import a GUI artifact into the game's world law, where nothing would
// ever explain the number. 0 is chosen because `macroSeed` is ALREADY per-body, so the identity pair
// is already unique across the galaxy without a second varying term.
//
// ⚠ IT IS A NAMED CONSTANT AND NOT AN IMPLICIT DEFAULT ON PURPOSE. Left unpassed, `stormIdentity`
// does `stormSeed | 0`, and `undefined | 0 === 0` — byte-identical to this constant and completely
// silent about whether anyone decided it. Named, exported and asserted, it is a law with an author.
//
// ⚠ AND IT IS DECLARED HERE RATHER THAN BESIDE ITS SIBLINGS, WHICH IS A COMPROMISE, NOT A DESIGN.
// It belongs next to src/objects/Planet.js:2203 `export const GAME_ANIM_RATE = 1.0;` with the other
// GAME_* front-end constants. It is here because this lane may not edit Planet.js.
// Recorded so the next author moves it deliberately instead of finding it and wondering.
export const GAME_STORM_SEED = 0;

// ── The cool shift that turns the deck tint into the cap tint ────────────────────────────────────
// Ported verbatim from the lab's inline cap-tint expression, which was RETIRED 2026-08-25 when the
// lab began reading this law back instead of holding a second copy: planet-lod-lab.html:1920 `Object.assign(state, polarDeckLabState(_pd));`
// — the Cassini gold-haze-outside / blue-core two-tone. Its input `_bt` is `state.bandTint`, which
// pack #1 sources from `condition.atmosphere.color`, so feeding this the SAME condition field makes
// the two front-ends' cap tints identical by construction rather than by coincidence.
//
// ⚠ WRITTEN AS NAMED COEFFICIENTS, for the reason recorded at giantDeck.js:101 `and that is a byte-identity decision, not a`:
// a tuned triple buried inside a return statement is a triple that gets "cleaned up" by someone who
// thought they were simplifying an expression.
export const POLAR_TINT_LAW = Object.freeze({ R: 0.45, G: 0.62, B_MUL: 0.85, B_ADD: 0.25 });
export function polarTintFromBandTint(bandTint) {
  return [
    bandTint[0] * POLAR_TINT_LAW.R,
    bandTint[1] * POLAR_TINT_LAW.G,
    Math.min(1, bandTint[2] * POLAR_TINT_LAW.B_MUL + POLAR_TINT_LAW.B_ADD),
  ];
}

// ── The eight DRIVEN uniforms, named as a set ────────────────────────────────────────────────────
// Exported so the pack test can assert the emitted set by MEMBERSHIP rather than by count. Step 4's
// re-bless was passed byte-identically by a count-preserving permutation, so a `length === 8` gate
// here would pass a commit that swapped `uPolarSides` for `uPolarRing`.
export const POLAR_DRIVEN = Object.freeze([
  'uPolarStrength', 'uPolarMode', 'uPolarSides', 'uPolarR0',
  'uPolarPole', 'uPolarRing', 'uPolarPhase', 'uPolarTint',
]);

// The two members of the F29 uniform family this pack must NOT write. Exported for the same reason:
// the fence is checkable instead of prose.
export const POLAR_LAB_KNOBS = Object.freeze(['uPolarAmp', 'uPolarW']);

// ⭐ ONE SPELLING OF THE GATE NAME, because there are about to be two places that need it: the
// driver that carries it and the registry entry that declares it. `gatesFor` builds ALL_ON from the
// ENTRY's names and `writePackUniforms` throws when a driver's gate is absent from that map — so a
// typo in either place is caught on the first admitted body. That is a good failure, but a shared
// constant means the two cannot disagree in the first place. Mirrors limbDeck.js's `LIMB_GATE`.
export const POLAR_GATE = 'polarVortex';

// ─────────────────────────────────────────────────────────────────────────────
// THE PACK
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @param {object} condition  a body condition vector (deriveConditionVector / conditionFromBody).
 * @param {object} ctx
 *   THE FIVE CONTRACT FIELDS (PLAN 5a):
 *   @param {number} ctx.macroSeed           integer, non-zero.
 *   @param {number} ctx.displayRadiusEarth  the front-end's display policy. Carried, not consumed —
 *                                           see the vacuity note below.
 *   @param {number} ctx.animRate            unread by this pack; no F29 uniform animates. The GLSL
 *                                           consumer is explicitly static —
 *                                           planet-lod-height.glsl.js:1796 `ALBEDO/LUMINANCE ONLY — no h/grad writes; static — no uTime`.
 *   @param {object} ctx.gates               must carry `polarVortex` — an ABSENT key throws.
 *   @param {object} ctx.relevance           unread. See the FORCED note in the header.
 *   PACK-SPECIFIC:
 *   @param {number} [ctx.stormSeed]         the placement half of the seed pair. Defaults to the
 *                                           DECLARED `GAME_STORM_SEED`, not to an implicit 0.
 *   @param {number} [ctx.obliquityDeg]      >= `STORM_PHYS.URANIAN_OBLIQUITY` on a NEPTUNIAN body
 *                                           selects the Uranian seasonal-hood read (mode 0). The
 *                                           game passes none today, so the branch is unreachable
 *                                           there — stated because "never fires" and "not wired" are
 *                                           the same picture, and this is the first.
 * @returns {{drivers: object, attributes: object, meta: object}}
 */
export function polarDeckPack(condition, ctx = {}) {
  if (condition == null || typeof condition !== 'object') {
    throw new PackContractError('polarDeckPack: condition vector is missing.');
  }
  // ⭐ THE DISPLAY POLICY IS CARRIED AND NOT CONSUMED, AND THE VACUITY IS THE POINT OF SAYING IT.
  // Not one F29 driver is `sizeKm`-shaped: `uPolarR0` is an ANGULAR radius in radians, which is
  // already display-independent, and the rest are counts, signs, phases and a colour. So "the game
  // policy and the lab policy agree on every driver this pack emits" is a fact about the SIZE OF THE
  // SET, exactly as it is for pack #1 — giantDeck.js:33 `THE DISPLAY POLICY IS CARRIED AND NOT CONSUMED, AND SAYING SO IS PART OF THE MEASUREMENT.`
  // The pack test asserts the emptiness of the
  // km-shaped set directly, so the day a km-keyed polar uniform appears the vacuity ends loudly.
  assertDisplayPolicy(ctx);
  const macroSeed = assertMacroSeed(ctx.macroSeed);

  const gas = compositionClass(condition) === 'gas';

  const drivers = {};
  const attributes = {};   // ⚠ ALWAYS EMPTY. `aStorm` is the storm slice's, and it stays zero-filled.
  const meta = {
    gas, regime: null, present: null, mode: null,
    stormSeed: ctx.stormSeed ?? GAME_STORM_SEED, pole: null,
  };

  if (!gas) {
    // ⚠ NOTHING IS EMITTED ON A SOLID BODY, and unlike pack #1 this branch is UNREACHABLE through
    // `applyDriverPacks`, because the registry predicate is the same `compositionClass === 'gas'`
    // test. It exists because the pack is also called directly (by its own test, and by any future
    // front-end that composes packs itself), and a pack whose gas gate lives only in the registry is
    // a pack that answers with a gas giant's pole for a rock the day someone calls it straight.
    // Emitting nothing — rather than zeros — matches pack #1's stated reason: the lab does not reset
    // the polar bank on a gas→solid change either, and zeroing here would be a NEW behaviour wearing
    // the byte-identity gate's clothes.
    return assertPackResult({ drivers, attributes, meta }, 'polarDeckPack');
  }

  // ⛔ ORDER — CLASSIFY THE UN-DRAWN CONDITION. The same call pack #1 makes at giantDeck.js:269 `const regime = giantRegimeOf(condition);`,
  // and the lab records the specific damage of getting it wrong at exactly THIS derivation:
  // planet-lod-lab.html:1852 `which moves the polar bank this function writes (state.polarSides / state.polarR0) on 52/52 (preset, seed) pairs tried`
  // — the polar bank moves on 52/52 pairs while `polarStrength` and the storm count stay 0, i.e. the
  // mistake is invisible to every gate that keys on the master strength.
  const regime = giantRegimeOf(condition);

  // ⛔ THE VIGOR RAMP IS THE WRITER'S, NOT PACK #1's, AND THEY ARE NOT THE SAME FUNCTION. Both ramp
  // T_eq over 55..130 K — giantDeck.js:107 `export const VIGOR = Object.freeze({ LO: 55, HI: 130, T_FALLBACK: 288 });`
  // and storm-e.js:63 `VIGOR_LO: 55, VIGOR_HI: 130,             // T_eq → personality ramp (ports the legacy _ss(55,130,T_eq))`
  // — but their FALLBACKS differ: pack #1 falls back to 288 K, the writer falls back to a per-regime
  // `DEFAULT_T_EQ` (124 Jovian, 47 Neptunian, …). On a body with no `T_eq` those give different
  // `uPolarMode` values, so this pack routes T_eq through `resolvePolarVortex` and lets the WRITER's
  // ramp answer. Importing `convectiveVigor` here would silently re-decide the pole's variant.
  const pole = resolvePolarVortex(
    regime,
    {
      // The gas gate the writer re-applies internally. ⭐ TRUE BY CONSTRUCTION ON EVERY BODY THIS
      // PACK CLAIMS, and measured rather than assumed: e1Regime.js:67 `return 'gas';   // h2-he envelope terminal (fires first)`
      // is the ONLY branch in `compositionClass` returning 'gas', so `gas === true` above implies
      // this string is 'h2-he'. Passed anyway: the writer's gate is the writer's to enforce.
      composition: condition.atmosphere && condition.atmosphere.composition,
      T_eq: condition.T_eq,
      // Pack #1's idiom, giantDeck.js:285 `if ((ctx.obliquityDeg ?? 0) > 0) e5Drivers.obliquityDeg = ctx.obliquityDeg;   // else regime default`
      // — a zero/absent obliquity means "use the regime default", so only a positive one is forwarded.
      ...((ctx.obliquityDeg ?? 0) > 0 ? { obliquityDeg: ctx.obliquityDeg } : {}),
    },
    macroSeed,
    ctx.stormSeed ?? GAME_STORM_SEED,
  );

  // ── The eight driven uniforms ────────────────────────────────────────────────────────────────
  // ⭐ ONLY `uPolarStrength` CARRIES THE GATE, and that reproduces the lab exactly rather than being
  // a simplification: planet-lod-lab.html:5196 `      // F29 polar vortex — polarVortexEnabled gates strength→0 ONLY (the GLSL call`
  // says the enable gate zeroes strength ALONE, because the GLSL call site keys on `uPolarStrength`
  // — planet-lod-height.glsl.js:2167 `        if (uPolarStrength > 0.0) col = polarVortexCol(N, col);` — so one gate kills the whole
  // combiner and restores byte-identical F28 output, while the other seven keep their derived values.
  // Gating all eight would give the same pixels and a different STATE, which is the class of change
  // the lab's own 52/52 note above says no gate in this repo can see.
  drivers.uPolarStrength = scalar(pole.strength, { gate: POLAR_GATE });
  drivers.uPolarMode = pole.mode;
  drivers.uPolarSides = pole.sides;
  drivers.uPolarR0 = pole.r0;
  drivers.uPolarPole = pole.pole;
  drivers.uPolarRing = pole.ring;
  drivers.uPolarPhase = pole.phase;

  // The cap tint, from the SAME condition field pack #1 reads for `uBandTint`. `Array.isArray` guard
  // + omission on failure is pack #1's idiom, giantDeck.js:295 `if (Array.isArray(tint)) drivers.uBandTint = tint.slice();`
  // — a body with no atmosphere colour keeps the
  // last cap tint behind whatever strength it drew, which is what the lab does, rather than being
  // reset to a colour nobody derived.
  const bandTint = condition.atmosphere && condition.atmosphere.color;
  if (Array.isArray(bandTint) && bandTint.length >= 3) {
    drivers.uPolarTint = polarTintFromBandTint(bandTint);
  }

  meta.regime = regime;
  meta.present = pole.strength === 1;
  meta.mode = pole.mode;
  meta.pole = pole;

  return assertPackResult({ drivers, attributes, meta }, 'polarDeckPack');
}

/**
 * The runtime registry entry, exported so `src/worldengine/drivers/index.js` ADDS it rather than
 * RETYPES it.
 *
 * ⛔ THE POINT OF EXPORTING THIS IS THAT THE PREDICATE CANNOT BE RETYPED AT THE COMPOSITION POINT.
 * A hand-written copy at index.js is a second expression of the same law, free to drift from the one
 * this file's own gates test — and the natural mistake is specific and measured: writing the
 * predicate as `!!condition.atmosphere` (which is what the STRENGTH driver keys on internally)
 * admits every rocky and icy world-engine body, i.e. Step 9's whole population arriving unruled.
 * Registration is one import plus one array element, and the predicate travels with its tests.
 *
 * ⚠ Character-identical to giantDeck's and limbDeck's predicate on purpose: polar is a gas-class
 * feature, so registration must admit EXACTLY the bodies already admitted and no others. The gate in
 * this file's test suite asserts that as SET MEMBERSHIP, not as a count — a count-preserving
 * permutation was measured to pass every instrument in this program byte-identically.
 *
 * ⚠ `uPolarStrength` is the per-seed PRESENCE term, NOT a master gate: it is 1 on roughly 24 of 41
 * generated gas bodies and 0 on the rest, and the GLSL skips the whole effect at 0. So a registered,
 * correctly-wired polarDeck renders NOTHING on more than a third of gas giants BY DESIGN. Do not
 * read a capless body as a failed registration.
 */
export const POLAR_DECK_ENTRY = Object.freeze({
  name: 'polarDeck',
  applies: (condition) => compositionClass(condition) === 'gas',
  gates: Object.freeze([POLAR_GATE]),
  pack: polarDeckPack,
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// THE LAB SEAM — the mirror the lab imports back, and the reason it lives HERE and not in the lab.
//
// ⭐ THE MAPPING IS THE THING THAT MUST NOT BE WRITTEN TWICE. planet-lod-lab.html wrote these eight
// assignments by hand off `resolveStormE(...).pole`; the game reaches the same values through
// `applyDriverPacks`. Two hand-written spellings of one uniform→field map is exactly the two-routes
// disease this pack was extracted to end, so the map lives in the pack and both front-ends read it.
//
// ⚠ THE PAIR THE LAB KEEPS IS ABSENT ON PURPOSE. `POLAR_LAB_KNOBS` (`uPolarAmp`, `uPolarW`) are the
// lab's authoring sliders, planet-lod-lab.html:1017 `polarAmp: 0.12,` and :1021 `polarW: 0.025,`,
// and this pack never emits them. A mirror that invented them would hand the lab back its own knobs.
export const POLAR_LAB_BINDING = Object.freeze({
  uPolarStrength: 'polarStrength',
  uPolarMode: 'polarMode',
  uPolarSides: 'polarSides',
  uPolarR0: 'polarR0',
  uPolarPole: 'polarPole',
  uPolarRing: 'polarRing',
  uPolarPhase: 'polarPhase',
  uPolarTint: 'polarTint',
});

/**
 * ⛔⛔ EVERY GATE ON, for the reason solidFeatures.js:301 gives and one this pack makes sharper.
 *
 * The lab re-applies its OWN ✓ checkbox at the per-frame writer, planet-lod-lab.html:5200
 * `uniforms.uPolarStrength.value = state.polarVortexEnabled ? state.polarStrength * state.featureRelevant.polarVortex : 0.0;`
 * — so the value this mirror puts into `state.polarStrength` must be the UNGATED one, or the
 * decision is applied twice.
 *
 * ⚠ AND ZERO IS A LEGAL VALUE HERE, WHICH IS WHY DOUBLE-GATING WOULD BE SILENT RATHER THAN LOUD:
 * `uPolarStrength` is the per-seed PRESENCE term, not a master — POLAR_DECK_ENTRY's ⚠ measures it at
 * 1 on roughly 24 of 41 generated gas bodies — so a double-gated body reads 0 and is indistinguishable
 * from a body that legitimately drew no cap.
 */
const LAB_MIRROR_CTX = Object.freeze({
  displayRadiusEarth: 1, animRate: 1, relevance: {},
  gates: Object.freeze({ [POLAR_GATE]: true }),
});

/**
 * The subset of a pack result the LAB mirrors into `state`, resolved with every gate ON.
 *
 * ⚠ SKIPS WHAT THE PACK DID NOT EMIT rather than defaulting it, and both omissions are real: a solid
 * body returns empty `drivers` (the non-gas early return), and a gas body with no atmosphere colour
 * omits `uPolarTint` so the last cap tint stands. Writing `undefined` into either would be a NEW
 * behaviour wearing the byte-identity gate's clothes.
 *
 * @param {{drivers: object}} pack  a `polarDeckPack` result
 * @returns {object} `state` field name -> value, containing ONLY the keys the pack actually emitted
 */
export function polarDeckLabState(pack) {
  const out = {};
  for (const [uName, stateField] of Object.entries(POLAR_LAB_BINDING)) {
    if (!(uName in pack.drivers)) continue;
    out[stateField] = resolveDriver(uName, pack.drivers[uName], LAB_MIRROR_CTX);
  }
  return out;
}
