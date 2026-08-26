// src/worldengine/drivers/solidOptics.js
// ─────────────────────────────────────────────────────────────────────────────
// DRIVER PACK #5 — THE SOLID-BODY OPTICS. Ledger rows P-11 and P-05.
//
//     solidOpticsPack(condition, ctx) -> { drivers, attributes, meta }
//
// It composes two modules that are pure, three-free and SHARED, and derives NOTHING of its own:
//
//     atmosphereOpticsOf ─┐
//     terminatorOpticsOf ─┼─> the limb pair + the terminator triple (P-11, 5 uniforms)
//     auroraOpticsOf ─────┴─> the auroral oval (P-05, 4 uniforms)
//
// ⭐ WHY A FIFTH PACK RATHER THAN A WIDENED limbDeck. limbDeck's predicate is
// src/worldengine/drivers/limbDeck.js:193 `  applies: (condition) => compositionClass(condition) === 'gas',`
// and its own header records that the narrow predicate is load-bearing: admission to the lab
// material runs through src/objects/Planet.js:2197
// `    const packs = condition ? selectPacks(condition).map((e) => e.name) : [];` into the
// `packs.length > 0` test one line below, so widening a predicate MOVES BODIES between materials.
// This pack's predicate is the exact complement, `!== 'gas'`, which is character-identical to
// rockySurface's — so every body it claims is a body rockySurface ALREADY claims, and the swapped
// population does not move by a single record. That is asserted over a generated population in the
// pack's test, not inferred from these two source lines.
//
// ⛔ WHAT THIS PACK DOES NOT WRITE, AND THE CONSEQUENCE, STATED RATHER THAN LEFT TO BE DISCOVERED.
// It does NOT write `uLimbStrength`. That name is the lab material's rim MASTER GATE — the shader
// at src/worldengine/shaders/planetShaders.glsl.js:939
// `        float limb = pow(1.0 - max(dot(N, V), 0.0), uLimbExponent) * uLimbStrength * (diff + 0.15);`
// makes it a bare multiplicand on the whole term — and it defaults to 0.0 at
// src/worldengine/shaders/uniforms.js:40 `      uLimbStrength:   { value: 0.0 },   // limb/atmosphere rim glow`.
// ⚠ SO THE LIMB PAIR THIS PACK WRITES IS INERT ON PIXELS TODAY: the swapped solid body now carries
// the game's exponent and hue, and renders no rim, because nothing turns the rim on for non-gas.
// That is deliberate and it is NOT an oversight:
//   · P-11's subject list is exactly the five names below. `uLimbStrength` is not in it, and the
//     game's own solid material has no counterpart for it either — the game gates its rim on the
//     differently-named `uLimbMix` (src/objects/Planet.js:1642 `        uLimbMix: { value: LIMB_MIX },`).
//   · Turning the rim on for 1000+ solid bodies is a VISIBLE change to every one of them, which is
//     a UAT decision, not a wiring one. Wiring commits do not make those.
// The row closes on the uniform VALUES agreeing, which is what the ledger measures. The pixel
// question is named here so the next reader does not rediscover it as a bug.
//
// ⛔ THE TERMINATOR LAW IS FORWARDED, NEVER RE-AUTHORED. It reaches this file through
// src/worldengine/base/terminatorOptics.js, the module the B3-1 repair extracted out of the game
// material for exactly this purpose. Its header records why the magnitude may not be re-derived:
// the value was 0.5, it "swamped the surface into a heavy orange BELT on every atmospheric world
// (Max-reported, all planet types)", and a later port shipped `columnFraction` — which saturates to
// exactly 1.0 above 0.3 bar, 6.7x the tamed value — as the magnitude and reproduced the artifact.
import { compositionClass } from '../base/e1Regime.js';
import { atmosphereOpticsOf } from '../base/atmosphereOptics.js';
import { terminatorOpticsOf } from '../base/terminatorOptics.js';
import { auroraOpticsOf } from '../base/auroraOptics.js';
import { scalar, assertDisplayPolicy, assertPackResult, resolveDriver, PackContractError } from '../port/writePackUniforms.js';

// ── The gate names this pack's drivers key on ────────────────────────────────
// Both mirror a real lab checkbox, and both are placed on the ONE uniform the lab's own per-frame
// writer gates, never on the whole family — because the lab writes the shape/hue every frame
// regardless of its checkbox and lets the magnitude do all the switching:
//   world-engine-lab.html:5044 `      uniforms.uTermStrength.value = state.terminatorEnabled ? state.termStrength : 0.0;   // ✓ enable gate`
//   world-engine-lab.html:5053 `      uniforms.uAuroraIntensity.value = state.auroraEnabled ? state.auroraIntensity : 0.0;   // ✓ enable gate`
// Gating the siblings too would apply the decision twice and would leave a gated-off body carrying
// the previous body's ring width behind a zero — invisible until something reads them off-gate.
export const TERMINATOR_GATE = 'terminator';
export const AURORA_GATE = 'aurora';

/**
 * @param {object} condition  the body condition vector.
 * @param {object} ctx        the Step-5a pack context (display policy + gate map).
 */
export function solidOpticsPack(condition, ctx) {
  if (condition == null) {
    throw new PackContractError('solidOpticsPack: condition vector is missing.');
  }
  // Checked FIRST and unconditionally, exactly as giantDeck and limbDeck do and for the reason
  // src/worldengine/port/writePackUniforms.js:107 `export function assertDisplayPolicy(ctx) {` gives:
  // a missing display policy fails silently and plausibly, so it is refused eagerly even by a pack
  // with no km-keyed driver.
  assertDisplayPolicy(ctx);

  // ⭐ THE SHARED LAWS, CALLED — NOT COPIED. The legacy game material calls the first two on the
  // same body at src/objects/Planet.js:1610
  // `    const optics = atmosphereOpticsOf(condition); const term = terminatorOpticsOf(condition);   // ⛔ B3-1 RIDES THIS LINE (see :1403). \`term\` is the SHARED module the packs read, not a second law.`
  // so a future change to either law lands on both front-ends at once. The pack's test pins that by
  // asserting the swapped body's values EQUAL the legacy material's on the same body — which a
  // transcription would satisfy today and break the first time the law moved.
  const optics = atmosphereOpticsOf(condition);
  const term = terminatorOpticsOf(condition);
  const aurora = auroraOpticsOf(condition);

  const drivers = {
    // ── P-11 · limb (2) ──────────────────────────────────────────────────────
    // Ungated, matching limbDeck's treatment of the identical pair: the master gate is
    // `uLimbStrength`, which this pack deliberately does not claim (see the ⛔ in the header).
    uLimbExponent: optics.limbExponent,
    // `.slice()` because the returned array is handed to a settable vector by
    // src/worldengine/port/writePackUniforms.js:280 `      if (target && typeof target.set === 'function') target.set(...v);`
    // — handing out a live array is how one body's hue follows another's.
    uLimbColor: optics.limbColor.slice(),

    // ── P-11 · terminator (3) ────────────────────────────────────────────────
    // The magnitude carries the gate; width and hue are written unconditionally, as the lab does.
    uTermStrength: scalar(term.termStrength, { gate: TERMINATOR_GATE }),
    uTermWidth: term.termWidth,
    uTermColor: term.termColor.slice(),

    // ── P-05 · aurora (4) ────────────────────────────────────────────────────
    uAuroraIntensity: scalar(aurora.auroraIntensity, { gate: AURORA_GATE }),
    uAuroraColor: aurora.auroraColor.slice(),
    uAuroraRingLat: aurora.auroraRingLat,
    uAuroraRingWidth: aurora.auroraRingWidth,
  };

  const meta = {
    gas: compositionClass(condition) === 'gas',
    limbExponent: optics.limbExponent,
    columnFraction: optics.columnFraction,
    termStrength: term.termStrength,
    termWidth: term.termWidth,
    auroraIntensity: aurora.auroraIntensity,
    auroraLive: aurora.auroraIntensity > 0,
  };

  return assertPackResult({ drivers, attributes: {}, meta }, 'solidOpticsPack');
}

// ─────────────────────────────────────────────────────────────────────────────
// THE REGISTRY ENTRY
// ─────────────────────────────────────────────────────────────────────────────
/**
 * ⭐ EXPORTED AS A FROZEN ENTRY RATHER THAN ASSEMBLED AT THE REGISTRY, so composing it is one
 * import plus one array element and the predicate cannot be retyped differently from the one this
 * pack's own test gates.
 *
 * ⛔⛔ THE PREDICATE IS THE COMPLEMENT OF GAS AND IT IS CHARACTER-IDENTICAL TO rockySurface's,
 * src/worldengine/drivers/rockySurface.js:349 `  applies: (condition) => compositionClass(condition) !== 'gas',`.
 * That is what makes registration population-neutral: `selectPacks` already returns a non-empty
 * list for every body this claims, so `packs.length > 0` cannot flip for any record and no body
 * moves between materials. A DIFFERENT non-gas predicate — `!!condition.atmosphere`, say — would
 * be narrower and would leave a subset of rockySurface's bodies without limb optics while looking
 * correct; the pack test asserts SET MEMBERSHIP against rockySurface's own predicate over a
 * generated population rather than comparing the two source lines by eye.
 *
 * ⛔ COLLISION. src/worldengine/drivers/index.js's collision guard throws if two APPLICABLE packs
 * write the same uniform name on one body. The only pack that co-applies here is rockySurface, and
 * the two emitted sets are disjoint by name — asserted by lookup in the test, so the day either set
 * grows into the other it reds instead of throwing at a player.
 */
export const SOLID_OPTICS_ENTRY = Object.freeze({
  name: 'solidOptics',
  applies: (condition) => compositionClass(condition) !== 'gas',
  gates: Object.freeze([TERMINATOR_GATE, AURORA_GATE]),
  pack: solidOpticsPack,
});

/**
 * The uniform names this pack writes, as a frozen SET for the collision, scope and membership
 * gates. Exported so the test can assert the emitted set by MEMBERSHIP rather than by count — Step
 * 4 measured that a count-preserving permutation is byte-identical to every instrument this program
 * owns, so a `length === 9` gate would pass a commit that swapped `uTermWidth` for `uLimbStrength`.
 */
export const SOLID_OPTICS_UNIFORMS = Object.freeze([
  'uLimbExponent', 'uLimbColor',
  'uTermStrength', 'uTermWidth', 'uTermColor',
  'uAuroraIntensity', 'uAuroraColor', 'uAuroraRingLat', 'uAuroraRingWidth',
]);

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// THE LAB SEAM — the mirror the lab imports back.
//
// ⭐ NINE NAMES ACROSS THREE FAMILIES, and the map lives here so it is written ONCE. The lab used to
// author all nine inline off `_atmoOptics`, `terminatorOpticsOf` and its own aurora block; two
// hand-written spellings of one uniform→field map is the two-routes disease this pack exists to end.
//
// ⛔ `uLimbStrength` IS ABSENT AND THAT IS DELIBERATE, not an omission. This pack does not claim the
// limb MASTER GATE — `limbDeck.js` owns it on gas bodies, and on non-gas the lab keeps authoring it.
// A mirror that invented it here would hand back a field this pack never emits.
export const SOLID_OPTICS_LAB_BINDING = Object.freeze({
  uLimbExponent: 'limbExponent',
  uLimbColor: 'limbColor',
  uTermStrength: 'termStrength',
  uTermWidth: 'termWidth',
  uTermColor: 'termColor',
  uAuroraIntensity: 'auroraIntensity',
  uAuroraColor: 'auroraColor',
  uAuroraRingLat: 'auroraRingLat',
  uAuroraRingWidth: 'auroraRingWidth',
});

/**
 * ⛔⛔ EVERY GATE ON, for the reason solidFeatures.js:301 gives. The lab re-applies its OWN ✓
 * checkboxes at the per-frame writer — `state.terminatorEnabled ? state.termStrength : 0.0` and
 * `state.auroraEnabled ? state.auroraIntensity : 0.0` — so the values this mirror puts into `state`
 * must be the UNGATED ones, or the decision is applied twice.
 *
 * ⚠ ZERO IS A LEGAL VALUE FOR BOTH GATED NAMES, which is why double-gating would be SILENT rather
 * than loud: a body with no retained atmosphere reads termStrength 0 legitimately, and aurora is 0
 * on every body under the field gate. A double-gated body is indistinguishable from a correct one.
 */
const LAB_MIRROR_CTX = Object.freeze({
  displayRadiusEarth: 1, animRate: 1, relevance: {},
  gates: Object.freeze({ [TERMINATOR_GATE]: true, [AURORA_GATE]: true }),
});

/**
 * The subset of a pack result the LAB mirrors into `state`, resolved with every gate ON.
 *
 * ⚠ SKIPS WHAT THE PACK DID NOT EMIT rather than defaulting it — a gas body returns empty `drivers`
 * from this pack's non-gas predicate, and writing `undefined` into nine live `.listen()`-bound
 * fields would be a NEW behaviour wearing the byte-identity gate's clothes.
 *
 * @param {{drivers: object}} pack  a `solidOpticsPack` result
 * @returns {object} `state` field name -> value, containing ONLY the keys the pack actually emitted
 */
export function solidOpticsLabState(pack) {
  const out = {};
  for (const [uName, stateField] of Object.entries(SOLID_OPTICS_LAB_BINDING)) {
    if (!(uName in pack.drivers)) continue;
    out[stateField] = resolveDriver(uName, pack.drivers[uName], LAB_MIRROR_CTX);
  }
  return out;
}
