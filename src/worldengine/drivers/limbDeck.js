// src/worldengine/drivers/limbDeck.js
// ─────────────────────────────────────────────────────────────────────────────
// DRIVER PACK #2 — THE LIMB (F34). Ledger C20, and it is a WIRING, not a law.
//
//     limbDeckPack(condition, ctx) -> { drivers, attributes, meta }
//
// ⭐ WHAT C20 ACTUALLY IS, in one line. The limb's master gate has two different names on the two
// sides. The lab gates the rim on `uLimbStrength`, planet-lod-uniforms.js:40 `uLimbStrength:   { value: 0.0 },`,
// default 0.0; the game's own gate is the differently-named src/objects/Planet.js:1642 `uLimbMix: { value: LIMB_MIX },`,
// which the lab does not declare. So Step 6's material swap moves a gas body onto a material whose
// rim term is multiplied by a zero nobody writes, and F34 renders NOTHING on every swapped body.
// The Step-6 parity ledger's P-04 row rules it BLOCKING and calls it "One mapping line."
// This module is that line, made into a pack so the composition point stays an array entry.
//
// ⛔ NOTHING HERE IS DESIGNED. Every input already exists on the game side and no producer moves:
//   · STRENGTH — the lab's only producer is planet-lod-lab-core.js:1081 `limbStrength: hasAtmo ? 0.7 : 0.0,`
//     inside `deriveUniforms`, picked up at planet-lod-lab.html:2001 `state.emissive = u.emissive; state.specStrength = u.specStrength; state.limbStrength = u.limbStrength;`
//     — INSIDE `applyDrivers`, i.e. inside the pack-legal region and NOT inside the fenced storm
//     writer. Its one input is planet-lod-lab-core.js:625 `const hasAtmo = !!d.atmosphere;`, which
//     the game's condition vector answers directly. Nothing had to be extracted.
//   · WIDTH and HUE — the lab does not own these either. planet-lod-lab.html:2464 `const _atmoOptics = atmosphereOpticsOf(`
//     is the SAME module the game already calls at src/objects/Planet.js:1610 `const optics = atmosphereOpticsOf(condition);`
//     and already writes to its own legacy material at src/objects/Planet.js:1643 `uLimbExponent: { value: optics.limbExponent },`.
//     So this pack does not compute a width or a hue: it forwards the shared law's answer, and on a
//     given body it forwards the SAME numbers the legacy material would have carried. The swap
//     therefore moves the STRENGTH gate and nothing else in this family — which is what makes the
//     result readable as "the wire arrived" rather than as "the renderer looks different".
//
// ⭐ THE GATE IS THE PIPELINE, NOT THE PICTURE (Max, 2026-08-09). If the rim looks rough on a
// swapped giant, that is the world engine's law to improve later. This file tunes nothing, and the
// anti-transcription fence in tests/driver-pack-limbdeck.test.js is what keeps a future "just nudge
// it" from landing here instead of in src/worldengine/base/atmosphereOptics.js, where the law lives.
//
// ⛔⛔ WHAT IS DELIBERATELY NOT PORTED — declared here so it is not "discovered" at Step 9.
// ---------------------------------------------------------------------------------------------
//  1. THE x1.3 STRENGTH BOOST. ⭐ THE EXPONENT HALF OF THIS ITEM CLOSED 2026-08-22, MAX'S RULING.
//     planet-lod-lab.html:2479 `if (_thickHaze) state.limbStrength = Math.min(1.0, state.limbStrength * 1.3);`
//     still rides `_cloudRegime`, which is derived inside the lab's own `applyDrivers` and has no
//     game-side producer. The game keeps the CONTINUOUS law it already ships,
//     src/worldengine/base/atmosphereOptics.js:161 `limbExponent: 3.5 - 1.7 * thick,`.
//     ⭐⭐ THIS BLOCK USED TO SAY THE EXPONENT WAS 'ALREADY A LIVE DIVERGENCE THIS PACK DID NOT
//     CREATE' — TRUE WHEN WRITTEN, AND NOW CLOSED: the lab takes the shared value at
//     planet-lod-lab.html:2478 `state.limbExponent = _atmoOptics.limbExponent;`. The binary
//     `_thickHaze ? 1.8 : 3.5` agreed with the module ONLY at thick 0 and 1. Over
//     the GAS class the lab's fork reduces to exactly planet-lod-lab.html:2406 `else if (_gas && (state.planetRadiusEarth ?? 1) < 6 && (_fp.massEarth ?? 1) < 10) _cloudRegime = 2;`
//     — radiusEarth < 6 && massEarth < 10 — so it is closable later in ONE place. Transcribing it
//     HERE would create a second expression of a lab law with no shared module, which is the drift
//     this whole plan exists against.
//  2. THE F31e DETACHED HAZE SHELL. planet-lod-lab.html:5026 `hazeShell.visible = !!(state.limbEnabled && state.limbStrength > 0 && state.limbHazeShell > 0);`
//     is a separate THREE mesh, not a uniform. A pack whose contract is "a map keyed by uniform
//     name" cannot express it, and a game-side shell would be a rewrite rather than a wire.
//  3. NO `macroSeed` ASSERTION, and the omission is the honest one. `assertMacroSeed` is the PACK's
//     precondition, not the writer's (src/worldengine/port/writePackUniforms.js:138 `export function assertMacroSeed(macroSeed) {`),
//     and this pack draws no entropy at all — every driver is a pure function of the condition
//     vector. Asserting a seed it never reads would be a check that cannot fail for a reason, which
//     is the shape of gate §11.1 calls dead. The pack's own test asserts seed-INDEPENDENCE instead,
//     so the day a seeded term joins the deck the omission ends loudly rather than silently.
//
// ⛔ THREE-FREE, and NO ENTROPY. The import closure is `base/e1Regime.js` + `base/atmosphereOptics.js`
// + `port/writePackUniforms.js`. atmosphereOptics.js imports nothing at all (measured: zero import
// statements), which is why the optics were reachable from a pack closure without moving a file.
// No `Math.random`, no `Date.now`, no alea stream.
// ─────────────────────────────────────────────────────────────────────────────
import { compositionClass } from '../base/e1Regime.js';
import { atmosphereOpticsOf } from '../base/atmosphereOptics.js';
import { scalar, assertDisplayPolicy, assertPackResult, PackContractError } from '../port/writePackUniforms.js';

// ── The declared gate name ───────────────────────────────────────────────────
// ⭐ A NAME, NOT A HARDCODED 1.0, AND THE DIFFERENCE IS THE WHOLE POINT OF ruling 4. The lab's write
// is planet-lod-lab.html:5021 `uniforms.uLimbStrength.value = state.limbEnabled ? state.limbStrength : 0.0;   // ✓ enable gate`
// — an enable gate and nothing else. Unlike the F29 polar writer, which is
// planet-lod-lab.html:5200 `state.polarVortexEnabled ? state.polarStrength * state.featureRelevant.polarVortex : 0.0;`,
// this line multiplies NO relevance term — so the limb needs an enable gate and needs NO relevance key,
// and src/objects/Planet.js:2204 `export const GAME_RELEVANCE = Object.freeze({});   // pack #1 keys no per-feature relevance`
// stays untouched. Declaring the gate by NAME is what keeps the absent-gate throw alive at
// src/worldengine/port/writePackUniforms.js:180 `if (gates == null || !(d.gate in gates)) {`: a
// literal 1.0 would render the rim under a decision nobody had made.
export const LIMB_GATE = 'limb';

// ── The lab's strength constants, transcribed from its ONE producer ──────────
// These two numbers are the only values this file owns, and they are owned because the lab's
// producer is a literal ternary with no module behind it. Everything else is forwarded.
// Both branches of planet-lod-lab-core.js:1081 `limbStrength: hasAtmo ? 0.7 : 0.0,`, split in two:
export const LIMB_STRENGTH_WITH_AIR = 0.7;   // the `hasAtmo` branch — a retained atmosphere glows
export const LIMB_STRENGTH_AIRLESS = 0.0;    // the else branch — no air, hard dark silhouette

/**
 * `hasAtmo`, exactly as the lab's core derives it.
 *
 * ⚠ OVER THIS PACK'S OWN PREDICATE THIS IS CONSTANT-TRUE, AND SAYING SO IS PART OF THE MEASUREMENT.
 * `applies` admits only `compositionClass(condition) === 'gas'`, and that class is itself defined by
 * src/worldengine/base/e1Regime.js:67 `if (cv.atmosphere && cv.atmosphere.composition === 'h2-he') return 'gas';   // h2-he envelope terminal (fires first)`
 * — an h2-he envelope IS an atmosphere. So the airless branch below is unreachable from today's
 * population and the pack's test asserts that emptiness directly rather than leaving it implied.
 * It is written as the LAW and not specialised to a constant 0.7 for one reason: Step 9 admits the
 * rocky class, at which point an airless rock reaching this pack must get a hard dark silhouette,
 * and a specialised constant would give it a rim with nothing complaining.
 */
export function hasAtmosphere(condition) {
  return !!(condition && condition.atmosphere);
}

// ─────────────────────────────────────────────────────────────────────────────
// THE PACK
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @param {object} condition  a body condition vector (deriveConditionVector / conditionFromBody).
 * @param {object} ctx
 *   @param {number} ctx.displayRadiusEarth  the front-end's display policy. Carried, not consumed —
 *                                           NOT ONE driver here is sizeKm-shaped, so the two
 *                                           policies agree on every driver. That agreement is a
 *                                           fact about the SIZE OF THE SET and the pack's test
 *                                           asserts the emptiness so the vacuity ends loudly.
 *   @param {object} ctx.gates               must carry the `limb` key — an ABSENT key throws.
 *   ⛔ `ctx.macroSeed`, `ctx.animRate` and `ctx.relevance` are NOT read. See non-port 3 above.
 * @returns {{drivers: object, attributes: object, meta: object}}
 */
export function limbDeckPack(condition, ctx = {}) {
  if (condition == null || typeof condition !== 'object') {
    throw new PackContractError('limbDeckPack: condition vector is missing.');
  }
  // Checked FIRST and unconditionally, exactly as giantDeck does and for the reason
  // src/worldengine/port/writePackUniforms.js:107 `export function assertDisplayPolicy(ctx) {` gives:
  // a missing display policy fails silently and plausibly, so it is refused eagerly even by a pack
  // with no km-keyed driver.
  assertDisplayPolicy(ctx);

  const air = hasAtmosphere(condition);
  // ⭐ THE SHARED LAW, CALLED — NOT COPIED. The legacy path already calls it, at
  // src/objects/Planet.js:1610 `const optics = atmosphereOpticsOf(condition);`,
  // so a future change to the optics lands on both front-ends
  // and on both game materials at once. The pack's test pins that by asserting the swapped body's
  // exponent and hue EQUAL the legacy material's on the same body, which a transcription would
  // satisfy today and break the first time the law moved.
  const optics = atmosphereOpticsOf(condition);

  const drivers = {
    // The master gate. 0 deletes the additive rim term EXACTLY, because
    // planet-lod-shaders.glsl.js:939 `pow(1.0 - max(dot(N, V), 0.0), uLimbExponent) * uLimbStrength`
    // makes it a bare multiplicand on the whole term, which is the F34 regression
    // contract the shader's own comment states.
    uLimbStrength: scalar(air ? LIMB_STRENGTH_WITH_AIR : LIMB_STRENGTH_AIRLESS, { gate: LIMB_GATE }),
    // Width and hue: forwarded, ungated, and UNGATED ON PURPOSE. They reproduce the lab, which
    // writes them every frame regardless of `state.limbEnabled` and lets the strength do all the
    // switching. Gating them too would apply the decision twice and would leave a gated-off body
    // carrying the previous body's rim width behind a zero, which is invisible until something
    // reads them off-gate.
    uLimbExponent: optics.limbExponent,
    // `.slice()` because the returned array is handed to a settable vector by
    // src/worldengine/port/writePackUniforms.js:280 `if (target && typeof target.set === 'function') target.set(...v);`
    // — handing out a live array is how one body's rim hue follows another's.
    uLimbColor: optics.limbColor.slice(),
  };

  const meta = {
    air,
    gas: compositionClass(condition) === 'gas',
    limbExponent: optics.limbExponent,
    thickHaze: optics.thickHaze,
    hazeFraction: optics.hazeFraction,
    primordialFraction: optics.primordialFraction,
    columnFraction: optics.columnFraction,
  };

  return assertPackResult({ drivers, attributes: {}, meta }, 'limbDeckPack');
}

// ─────────────────────────────────────────────────────────────────────────────
// THE REGISTRY ENTRY
// ─────────────────────────────────────────────────────────────────────────────
/**
 * ⭐ EXPORTED AS A FROZEN ENTRY RATHER THAN ASSEMBLED AT THE REGISTRY, so composing it is one
 * import plus one array element at src/worldengine/drivers/index.js:100 `export const PACKS = Object.freeze([`
 * and the predicate cannot be retyped differently from the one this pack's own test gates.
 *
 * ⛔⛔ THE PREDICATE IS `compositionClass(condition) === 'gas'` AND IT MUST NOT BE `!!condition.atmosphere`,
 * even though the strength driver keys on exactly that. Admission runs through
 * src/objects/Planet.js:2192 `const packs = condition ? selectPacks(condition).map((e) => e.name) : [];`
 * into src/objects/Planet.js:2194 `admitted: flag.enabled && provenance.isWorldEngine && packs.length > 0,`
 * — so a broader predicate would ADMIT EVERY ROCKY AND ICY WORLD-ENGINE BODY to the lab material,
 * which is Step 9's population arriving unruled at Step 6. ⛔ IT USED TO BE CHARACTER-IDENTICAL TO
 * THE GAS DECK'S ENTRY AND IT IS NOT ANY MORE, 2026-08-21 (B3 leg 2, ledger R-07): that entry now
 * reads src/worldengine/drivers/index.js:115 `applies: (condition) => bandedEnvelopeOf(condition),`
 * — gas OR an opaque CO2 shroud — so the deck claims 130 rocky bodies this pack must NOT claim. This
 * predicate stays `compositionClass(condition) === 'gas'` and the pack's test now asserts it against
 * the COMPOSITION CLASS directly, with the deck asserted as a superset; comparing to the deck would
 * have re-scoped this pack to whatever the deck does next. The test asserts the SAME SET over a generated population —
 * membership, not a count, because Step 4 measured that a count-preserving permutation is
 * byte-identical to every instrument this program owns.
 */
export const LIMB_DECK_ENTRY = Object.freeze({
  name: 'limbDeck',
  applies: (condition) => compositionClass(condition) === 'gas',
  gates: Object.freeze([LIMB_GATE]),
  pack: limbDeckPack,
});

/** The uniform names this pack writes, as a frozen SET for the collision and membership gates. */
export const LIMB_UNIFORMS = Object.freeze(['uLimbStrength', 'uLimbExponent', 'uLimbColor']);
