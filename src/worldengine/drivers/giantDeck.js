// src/worldengine/drivers/giantDeck.js
// ─────────────────────────────────────────────────────────────────────────────
// DRIVER PACK #1 — THE GAS DECK (PLAN §4 "Step 5", 5c/5d). F24 zonal belts + F25 jets & shear.
//
// The first pack under the §4 Step 5 contract:
//
//     giantDeckPack(condition, ctx) -> { drivers, attributes, meta }
//
// It composes four modules that were already pure and three-free under `src/worldengine/base/`:
//
//     giantRegimeOf  ->  drawGiantConditions  ->  deriveGiantDrivers  ->  bakeClimateE5Attributes
//
// and it is the ONLY definition of the F24/F25 driver law. The block that used to derive it inside
// `applyDrivers` + `rebakeE5Bands` in planet-lod-lab.html is deleted; the lab imports this instead.
//
// ⛔⛔ WHAT IS DELIBERATELY NOT HERE — read this before adding a uniform.
// ---------------------------------------------------------------------------------------------
//  · THE POLAR FAMILY IS NOT IN THIS PACK, and it is not an oversight. Ledger C19, measured: every
//    F29 polar field is written by `applyStormState` (planet-lod-lab.html:1811 `function applyStormState(){`,
//    which closes before planet-lod-lab.html:1933 `function applyDrivers(){`), and PLAN §7 fences
//    `applyStormState` out of pack #1 by name. `applyDrivers` writes NO polar field at all. A pack
//    that named `uPolarStrength` would be naming a uniform whose producer is out of scope.
//  · `uStormCount` and the whole `uStorm*` family are out for the same reason, and `aStorm` stays
//    zero-filled. This module never calls the storm writer; the lab still bakes `aStorm` at its own
//    call site from THIS pack's `meta.regime` / `meta.e5Drivers`, so the mask and the bands can never
//    be derived from different drivers — which is the coherence rule that made them one function in
//    the first place.
//  · `state.bandCount` is NOT here. It has no uniform at all — `uBandCount` was retired by
//    AC-ONECOUNT (tests/worldengine-atmo-deck-spiral-rhines.test.js asserts the token appears in no
//    GLSL, no uniform table and no lab code), and a pack whose contract is "a map keyed by uniform
//    name" cannot express a value with no uniform. It stays a lab-side state field.
//
// ⭐ THE DISPLAY POLICY IS CARRIED AND NOT CONSUMED, AND SAYING SO IS PART OF THE MEASUREMENT.
// `ctx.displayRadiusEarth` is validated on every call (via `assertDisplayPolicy`) because the
// contract requires it and because a front-end that forgets it must fail here rather than three
// steps later. But NOT ONE driver this pack emits is `sizeKm`-shaped, so the policy seam does no
// work for the gas deck. PLAN §4 Step 5's "policy-difference assertion — the same pack under the
// GAME's display policy differs on exactly the km-keyed uniforms and nowhere else" is therefore
// satisfied VACUOUSLY here: the km-keyed set is empty, the two policies agree on every driver, and
// that agreement is evidence about the SIZE OF THE SET, not about the seam working. The pack's own
// test asserts the emptiness rather than assuming it (`no driver is sizeKm-shaped`), so the day a
// km-keyed uniform joins the deck the vacuity ends loudly instead of silently.
//
// ⛔ THREE-FREE. The whole import closure is base/ + port/writePackUniforms.js, all of which are
// three-free; tests/pack-contract.test.js walks the graph and fails on any bare specifier.
// ⛔ NO `Math.random`, NO `Date.now`. The only entropy is `ctx.macroSeed` through the alea streams
// already owned by giant-drivers.js / climate-e5.js / band-flow.js.
// ─────────────────────────────────────────────────────────────────────────────
import { compositionClass, giantRegimeOf } from '../base/e1Regime.js';
import { drawGiantConditions, deriveGiantDrivers, giantDriverScalars } from '../base/giant-drivers.js';
import { bakeClimateE5Attributes } from '../base/climate-e5.js';
import { bandProxyUniforms, drawBandRoughness } from '../base/band-flow.js';
import {
  scalar, resolveDriver, isPackDriver,
  assertMacroSeed, assertDisplayPolicy, assertPackResult, PackContractError,
} from '../port/writePackUniforms.js';

// ── The convective-vigor ramp ────────────────────────────────────────────────
// One T_eq ramp, 55 K -> 130 K, drives band contrast, band warp, jet shear-turbulence and jet
// festooning: a warm interior churns vivid scalloped bands (Jupiter), a cold CH4-haze ice giant goes
// near-bland blue (Neptune). The 0.08 floor keeps a ghost of banding on the coldest disc.
//
// ⚠ WRITTEN OUT RATHER THAN IMPORTED FROM mathutil, and that is a byte-identity decision, not a
// style one. The lab's local helper was `(x - e0) / (e1 - e0)` clamped to [0,1] then `t*t*(3-2t)`,
// which is `mathutil.smoothstep` character for character — verified by reading both. Importing it
// would be equally exact. The reason for the local constant block is that VIGOR_LO / VIGOR_HI are
// the calibrated numbers, and burying them inside a call argument is how a ramp gets retuned by
// someone who thought they were editing a generic helper.
export const VIGOR = Object.freeze({ LO: 55, HI: 130, T_FALLBACK: 288 });
const smoothstep01 = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
export function convectiveVigor(T_eq) {
  return smoothstep01(VIGOR.LO, VIGOR.HI, T_eq ?? VIGOR.T_FALLBACK);
}

// ── The F24 / F25 uniform laws, as named constants ───────────────────────────
// Each is `base + span * vigor`, except the jet drift amplitude, which is a clamped 1/rotation law.
// Budgets are in STRIPE units and were pre-checked against the "marble lesson" (a warp over ~1
// stripe smears bands into marble): warp peak 0.55, turbulence peak ~0.27, festoon peak ~0.40.
export const DECK_LAW = Object.freeze({
  CONTRAST: Object.freeze({ BASE: 0.08, SPAN: 0.92 }),
  WARP:     Object.freeze({ BASE: 0.12, SPAN: 0.43 }),
  SHEAR:    Object.freeze({ BASE: 0.05, SPAN: 0.25 }),
  FESTOON:  Object.freeze({ BASE: 0.00, SPAN: 0.45 }),
  JET_SPEED: Object.freeze({ NUM: 8, LO: 0.2, HI: 1.2 }),   // rad per flow phase, from D8 spin
  ROT_FALLBACK: 24,                                          // hours; the driver-presets D8 default
  JUPITER_RADIUS_EARTH: 11.2,                                // the Rhines normalisation, for reference
});

// ── Which drivers the LAB mirrors into `state` rather than writing straight to a uniform ─────────
// ⭐ THIS MAP IS THE "PACK-AUTHORING PATH" PLAN 5f ASKS FOR, and it exists because of a concrete
// hazard rather than for tidiness. The lab's ~200 `.listen()`-bound lil-gui controllers read and
// write `state.<field>`, and `frame()` copies `state -> uniforms` EVERY FRAME with the live enable
// gates and the live animation rate folded in. So a pack that wrote these uniforms directly in the
// lab would be overwritten on the very next frame by the stale `state` value, and the slider that
// appears to drive the feature would in fact be the only thing driving it. The lab therefore mirrors
// this subset into `state` (see `giantDeckLabState`) and lets its own frame loop do the writing; the
// GAME, which has no `state` and no sliders, writes all of them through `writePackUniforms`.
export const LAB_STATE_BINDING = Object.freeze({
  uBandStrength: 'bandStrength',
  uBandContrast: 'bandContrast',
  uBandWarp: 'bandWarp',
  uBandTint: 'bandTint',
  uBandRough: 'bandRough',
  uJetStrength: 'jetStrength',
  uJetSpeed: 'jetSpeed',
  uJetShearTurb: 'jetShearTurb',
  uJetFestoon: 'jetFestoon',
});

// The identity context for the lab mirror: every gate ON, animation rate 1, no relevance factor.
// The lab applies its OWN live gates (`state.bandsEnabled` / `state.jetsEnabled`) and its own
// `_animRate` in `frame()`, so mirroring an already-gated value would apply each gate twice — a
// gated-off feature would still read 0, and a gated-ON one would read `strength * animRate²`.
const LAB_MIRROR_CTX = Object.freeze({
  displayRadiusEarth: 1, animRate: 1, relevance: {},
  gates: Object.freeze({ bands: true, jets: true }),
});

// ─────────────────────────────────────────────────────────────────────────────
// THE PACK
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @param {object} condition  a body condition vector (deriveConditionVector / conditionFromPlanet).
 * @param {object} ctx
 *   THE FIVE CONTRACT FIELDS (PLAN 5a):
 *   @param {number} ctx.macroSeed           integer, non-zero — see `assertMacroSeed` and 5d below.
 *   @param {number} ctx.displayRadiusEarth  the front-end's display policy. Carried, not consumed.
 *   @param {number} ctx.animRate            writer-side animation rate (uJetSpeed rides it).
 *   @param {object} ctx.gates               { bands, jets } — an ABSENT key throws, it is not "off".
 *   @param {object} ctx.relevance           per-feature relevance; unused by this pack today.
 *   PACK-SPECIFIC, each documented at its read site:
 *   @param {number} [ctx.rotationHours]     the DRAWN spin. The condition vector carries only the
 *                                           preset/canonical spin, so a front-end that draws
 *                                           rotation per body must pass it or the Rhines band count
 *                                           and the jet drift silently answer the canonical body.
 *   @param {number} [ctx.rotationScale]     front-end rotation multiplier (lab GUI knob; 1 in game).
 *   @param {number} [ctx.obliquityDeg]      >0 overrides the regime default obliquity.
 *   @param {object} [ctx.e5DriverOverrides] front-end overrides merged LAST into the E5 bundle.
 *   @param {object} [ctx.mesh]              { positions, count, radius } — omit for a uniform-only
 *                                           call; `attributes` is then `{}` and `meta.baked` false.
 * @returns {{drivers: object, attributes: object, meta: object}}
 */
export function giantDeckPack(condition, ctx = {}) {
  if (condition == null || typeof condition !== 'object') {
    throw new PackContractError('giantDeckPack: condition vector is missing.');
  }
  // The display policy is checked FIRST and unconditionally — see the header on why a pack with no
  // km-shaped driver still refuses a context without one.
  assertDisplayPolicy(ctx);

  // ── 5d. THE macroSeed SHAPE, ASSERTED IN THE PACK ──────────────────────────────────────────────
  // ⛔ THE NUMERIC `fnv1aString`, NEVER `toHex(...)`. `resolveParams` (climate-e5.js) does
  // `macroSeed | 0`, and `'da81e221' | 0 === 0`. A hex string therefore collapses to seed 0 SILENTLY:
  // every gas giant in the galaxy gets identical band phases, and not one gate on driver ALGEBRA
  // moves, because the algebra carries no seeded term — `phaseJet`, `phaseMush`, `ampJitter` and
  // `obliquity` are the only seeded quantities. The ONLY assertion that can catch it is a hash over
  // the seeded FIELD (`aBand`), which is why the pack test carries one.
  const macroSeed = assertMacroSeed(ctx.macroSeed);

  const gas = compositionClass(condition) === 'gas';
  const T_eq = condition.T_eq;
  const vigor = convectiveVigor(T_eq);
  // The DRAWN spin, with the same fallback chain the front-ends already use.
  const rotationHours = ctx.rotationHours ?? condition.rotationHours ?? DECK_LAW.ROT_FALLBACK;

  // ── F24/F25 laws that run on EVERY body, gas or not ────────────────────────────────────────────
  // ⚠ THE UNGATED ONES ARE UNGATED ON PURPOSE and this reproduces the lab exactly. `applyDrivers`
  // writes contrast / warp / jetSpeed / shearTurb / festoon on every preset and lets the two master
  // gates (`uBandStrength`, `uJetStrength`) do the switching. Deriving them only on gas bodies would
  // leave the previous body's values in place on a gas -> solid change, which is invisible while the
  // gate is 0 and wrong the moment anything reads them off-gate.
  const drivers = {
    // The two master gates. An h2-he envelope IS the visible surface, so the deck is fully on for a
    // gas world and fully off for every solid one — no partial gas.
    uBandStrength: scalar(gas ? 1.0 : 0.0, { gate: 'bands' }),
    uJetStrength:  scalar(gas ? 1.0 : 0.0, { gate: 'jets' }),
    uBandContrast: DECK_LAW.CONTRAST.BASE + DECK_LAW.CONTRAST.SPAN * vigor,
    uBandWarp:     DECK_LAW.WARP.BASE + DECK_LAW.WARP.SPAN * vigor,
    uJetShearTurb: DECK_LAW.SHEAR.BASE + DECK_LAW.SHEAR.SPAN * vigor,
    uJetFestoon:   DECK_LAW.FESTOON.BASE + DECK_LAW.FESTOON.SPAN * vigor,
    // Drift amplitude from D8 spin: fast rotation ⇒ stronger zonal organization ⇒ faster apparent
    // shear. `animRate: true` is the writer-side context PLAN 5c names explicitly — the lab's
    // `uJetSpeed = state.jetSpeed * _animRate` is now a property of the DRIVER, not of the frame loop.
    uJetSpeed: scalar(
      Math.min(DECK_LAW.JET_SPEED.HI, Math.max(DECK_LAW.JET_SPEED.LO, DECK_LAW.JET_SPEED.NUM / rotationHours)),
      { animRate: true },
    ),
  };

  const attributes = {};
  const meta = {
    gas, regime: null, vigor, rotationHours,
    e5Drivers: null, drawnCondition: null, bandParams: null,
    bandCount: null, eqSign: null, peakU: null, baked: false,
  };

  if (!gas) {
    // ⚠ NOTHING ELSE IS EMITTED ON A SOLID BODY, and the omissions are the behaviour, not a shortcut.
    // `uBandTint` is omitted because the lab never resets it either — a solid preset keeps whatever
    // deck colour was last drawn, behind a 0 gate, and zeroing it here would be a new behaviour
    // wearing the byte-identity gate's clothes. The six band-PROXY uniforms and `uBandRough` are
    // omitted because their producer (the E5 bake) does not run on a solid body at all.
    return assertPackResult({ drivers, attributes, meta }, 'giantDeckPack');
  }

  // ── The E5 chain ───────────────────────────────────────────────────────────────────────────────
  // ⛔ ORDER — CLASSIFY THE UN-PERTURBED CONDITION. `drawGiantConditions` rewrites `surfaceGravity`,
  // `T_eq` AND `density` before `deriveGiantDrivers` reads them, and those are exactly the fields
  // `giantRegimeOf` keys on. Classifying its OUTPUT flips the label on 63/2000 draws (3.15%) across
  // the five preset rows — at macroSeed 0 the Jovian row would silently bake `saturnian` bands.
  // ⛔ AND IT IS NOT GATEABLE OVER THE PINNED SWEEP_SEEDS: those 12 flip 0/60, so a gate written over
  // them would be vacuous. The pack test pins seed 0 for that reason.
  const regime = giantRegimeOf(condition);
  const drawnCondition = drawGiantConditions(regime, condition, macroSeed);
  const triple = deriveGiantDrivers(drawnCondition);       // { shellDepthFrac, internalHeat, dissipation }

  // The E5 bundle `resolveParams` merges over the frozen DRIVER_BUNDLES. The per-seed triple comes
  // first so the front-end override (below) can still win, and `giantDriverScalars` is the SINGLE
  // source of the Jupiter-normalised rotation/radius wire — the two lab call sites used to compute
  // it separately and diverged.
  const e5Drivers = {
    ...triple,
    ...giantDriverScalars(condition.radiusEarth, rotationHours, ctx.rotationScale ?? 1),
    // ⭐ The front-end's own E5 overrides, merged LAST. The lab passes its pinned live-radius
    // expression through here; the value is provably identical to `giantDriverScalars`' own (both
    // are `(drawn radius)/11.2`), so this is a guard the lab keeps, not a second law.
    ...(ctx.e5DriverOverrides || {}),
  };
  if ((ctx.obliquityDeg ?? 0) > 0) e5Drivers.obliquityDeg = ctx.obliquityDeg;   // else regime default

  meta.regime = regime;
  meta.drawnCondition = drawnCondition;
  meta.e5Drivers = e5Drivers;

  // Deck tint straight from the atmosphere colour (tan / pale-gold / blue). `.slice()` because the
  // condition's array is shared with the record it came from and the writer hands it to a settable
  // vector; handing out the live array is how one body's tint follows another's.
  const tint = condition.atmosphere && condition.atmosphere.color;
  if (Array.isArray(tint)) drivers.uBandTint = tint.slice();

  // Per-seed GLOBAL band-edge roughness, drawn on the append-only `bandFlow:rough:<regime>:<seed>`
  // alea stream (disjoint from every climateE5:/stormE:/giantD: stream, so it shifts no draw order).
  drivers.uBandRough = drawBandRoughness(regime, macroSeed | 0);

  // ── The per-vertex bake ────────────────────────────────────────────────────────────────────────
  const mesh = ctx.mesh;
  if (mesh && mesh.positions && mesh.count) {
    const bake = bakeClimateE5Attributes(mesh.positions, mesh.count, mesh.radius ?? 1.0, {
      regime, drivers: e5Drivers, macroSeed: macroSeed | 0,
    });
    attributes.aBand = bake.aBand;
    attributes.aShear = bake.aShear;
    attributes.aMush = bake.aMush;
    // ⚠ `aStorm` IS NOT SET HERE. See the header: its producer is the storm slice, fenced out of
    // pack #1 by PLAN §7. It stays zero-filled, and a reader must be able to see that the pack
    // never touched it rather than having to prove a negative.
    meta.baked = true;
    meta.bandParams = bake.params;
    meta.bandCount = bake.bandCount;
    meta.eqSign = bake.eqSign;
    meta.peakU = bake.peakU;
    // The six render-side band-PROXY uniforms, reconstructed analytically from the resolved P so the
    // storm swirl and ink advection DEFLECT the primary band instead of pasting a decal. Single-
    // sourced through `bandProxyUniforms` — this pack does not re-derive DEFLECT_SCALE.
    Object.assign(drivers, bandProxyUniforms(bake.params));
  }

  return assertPackResult({ drivers, attributes, meta }, 'giantDeckPack');
}

// ─────────────────────────────────────────────────────────────────────────────
// THE TWO FRONT-END HELPERS
// ─────────────────────────────────────────────────────────────────────────────
/**
 * The subset of a pack result the LAB mirrors into `state`, resolved with every gate ON and an
 * animation rate of 1 — see `LAB_MIRROR_CTX` for why double-gating is the hazard this avoids.
 * Returns a plain object of `state` field name -> value, containing ONLY the keys the pack actually
 * emitted (so a solid body yields the four ungated fields and does not clobber the deck tint).
 */
export function giantDeckLabState(deck) {
  const out = {};
  for (const [uName, stateField] of Object.entries(LAB_STATE_BINDING)) {
    if (!(uName in deck.drivers)) continue;
    out[stateField] = resolveDriver(uName, deck.drivers[uName], LAB_MIRROR_CTX);
  }
  return out;
}

/**
 * The complement: the drivers the lab writes STRAIGHT to uniforms, because its frame loop does not
 * own them. Today that is exactly the six band-proxy uniforms, and it is derived by SUBTRACTION from
 * `LAB_STATE_BINDING` rather than listed, so a new pack driver defaults to being written — a
 * forgotten entry shows up as a uniform that moves, not as a uniform that silently never does.
 */
export function giantDeckDirectDrivers(deck) {
  const out = {};
  for (const [uName, d] of Object.entries(deck.drivers)) {
    if (uName in LAB_STATE_BINDING) continue;
    out[uName] = d;
  }
  return out;
}

/** True iff any driver in the map is km-shaped. Used by the pack's own vacuity assertion. */
export function hasKmShapedDriver(drivers) {
  return Object.values(drivers).some((d) => isPackDriver(d) && d.featureSizeKm !== undefined);
}
