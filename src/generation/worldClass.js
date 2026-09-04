// src/generation/worldClass.js — THE DERIVED CLASS. What a finished world IS, read off its physics.
//
// ⭐⭐ THE ONE SENTENCE. `PlanetGenerator.type` does two jobs with one name. It is a zone-weighted roll
// over real Kepler occurrence rates (so it is NOT "randomized" — it reads WHERE the planet is), but it
// is drawn FIRST and then CHOOSES the radius range, estimateMassEarth, the atmosphere strength, the
// cloud/ring chance, the max moon count and the legacy palette. It is UPSTREAM of the physics. So
// "make the label read the physics" is a LOOP, not a relabel: the physics cannot be the label's input
// while the label is the physics' input.
//
// The split, and it is the SAME SPLIT as iceFraction/volatileFraction the session before this one:
//   `type`       stays the FORMATION SEED   — it decides what forms. Unchanged, including its rates.
//   `worldClass` is the DERIVED CLASS       — computed from the finished body. Everything DESCRIPTIVE
//                                             reads this: the info panel, the orrery, the seed search.
//
// ⛔⛔ `worldClass` MUST NEVER BECOME AN INPUT TO PHYSICS. That rebuilds the exact loop this file
// exists to cut, and it would do it silently. It is written LAST, after every physical quantity on the
// record is final, and nothing upstream of that point may read it. If a law needs to know what kind of
// world it is on, it reads the CONDITION SCALARS — the same ones this file reads — never this label.
// That is the same rule conditionFromBody.js states for `type` at its own seam, for the same reason.
//
// ⛔ NO RNG, EVER. Not even a side draw. Instrument B counts draws on `SeededRandom.prototype.rng`
// across EVERY instance, so even a sub-rng that touches nothing on the shared stream moves the fence's
// per-yield profile (it moved 212 of 221 seeds once, with zero drawn values moved). This file is a pure
// function of the condition vector and needs no randomness at all.
//
// ── WHY EVERY THRESHOLD IS AN IMPORT AND NOT A NUMBER ────────────────────────────────────────────────
// Each gate below reads a constant the engine ALREADY names, used for the meaning it is already
// documented to have. A fresh hand-written bound here would be a second opinion about the same physics,
// which is how the codebase got `compositionClass` cutting carbon at C/O > 1.0 while `deriveComposition`
// cuts `surfaceType` at C/O > 0.8 — two carbon thresholds, one concept. Do not add a third of anything.
//
// ⚠ ONE THRESHOLD IS DELIBERATELY *NOT* surfaceMaterial's: T_MELT_LO (900 K) was tried for `lava` and
// rejected. Its own comment says it is "below this no melt sheen" — a RENDERING threshold for when melt
// glass starts showing on a hot surface, not the temperature rock is liquid at. Measured, it called 100
// of 476 bodies lava. `T_LIQUIDUS_BASALT` (1400 K, tholeiitic basalt liquidus) is the temperature an
// ordinary volcanic crust is actually molten at, and it is the one this file wants.

import { compositionClass } from '../worldengine/base/e1Regime.js';
import {
  biosphereOf,
  T_ICE_HI,            // 273 K — water ice melts
  BIO_T_LIMIT,         // 395 K — hyperthermophile ceiling; above this no surface life at all
  BIO_P_HI,            // 0.4 bar — at/above this a body has a real atmosphere, not a wisp
  T_LIQUIDUS_BASALT,   // 1400 K — tholeiitic basalt liquidus; at/above this the surface is molten
} from '../worldengine/base/surfaceMaterial.js';

// ── The habitable band. T and V are e1Regime's own BAND (its `BAND` literal is module-private, so the
//    values are restated with their provenance and pinned by worldClass.test.js against a live
//    inSeededBand() probe — if the engine's copy ever moves, that test fails rather than this file
//    drifting silently).
export const HAB_T_LO = 250;   // K, surface — e1Regime.js:53 BAND.T_LO
export const HAB_T_HI = 320;   // K, surface — e1Regime.js:53 BAND.T_HI
export const HAB_V_MIN = 0.12; // volatile fraction — e1Regime.js:53 BAND.V_MIN

// ⛔ NOT e1Regime's BAND.MASS_LO/MASS_HI (0.6–1.6 M⊕). Max ruled 2026-09-04 that a warm wet world two
// or three times Earth's mass COUNTS as habitable; the mass gate cuts the population from 14 to 5. The
// size bound is on RADIUS instead, at the radius valley (Fulton 2017 CKS gap, ~1.5–1.8 R⊕) that
// separates rocky super-Earths from gas-enveloped sub-Neptunes — the cut that physically decides
// whether a body has a surface to stand on. ⚠ IT IS NON-BINDING ON TODAY'S POPULATION: all 14 warm-wet
// worlds sit below 1.4 R⊕, so it excludes none of them. It is the stop on a FUTURE 2.5 R⊕ water world
// being called habitable, not a filter on the current galaxy. Do not read a zero off it as "it works".
export const HAB_R_MAX = 1.8;  // R⊕

// C/O above which a body is carbon-bearing. `deriveComposition`'s OWN cut for surfaceType 'carbon'
// (PhysicsEngine.js:596), not compositionClass's 1.0 — see the two-thresholds note above; this file
// follows the generator that actually produced the number it is reading.
// ⚠ MEASURED: C/O tops out at 0.769 across 200 seeds, so this gate fires on NOTHING in the current
// galaxy, while the formation roll labels 126 bodies `carbon`. That is not a bug in this file — it is
// the roll naming a composition the body does not have. Recorded in DEVIATIONS.md.
export const CARBON_CO = 0.8;

// The exotic/civilized overlays. NOT physical classes — ExoticOverlay applies them AFTER natural
// generation (it regenerates the body through PlanetGenerator.generate with forceType, so the record
// this file sees is already the exotic one). A fungal world is physically still an ocean world, so
// `worldClass` derives the PHYSICS and displayClassOf below keeps the overlay name for display: it is
// strictly more informative, and finding one is the whole point of the overlay.
export const EXOTIC_TYPES = Object.freeze([
  'fungal', 'hex', 'machine', 'city-lights', 'ecumenopolis', 'crystal', 'shattered',
]);

/**
 * The derived class of a finished body, from its condition vector alone.
 *
 * @param {object} condition - a condition vector (conditionFromBody / deriveConditionVector)
 * @returns {string|null} one of ocean | terrestrial | ice | lava | venus | carbon | rocky,
 *                        or `null` for a gas body — see the gas carve-out below.
 */
export function worldClassOf(condition) {
  const c = condition || {};

  // ── GAS: the roll is left alone, deliberately. ──────────────────────────────────────────────────
  // A carve-out, not an oversight. (a) No acceptance criterion needs it: gas-giant / hot-jupiter /
  // sub-neptune are formation OUTCOMES the roll gets right from orbit and size, and none of them is
  // contradicted by its own physics the way `ocean` (dry), `lava` (cold) and `ice` (boiling) are.
  // (b) The engine's own derived giant classifier, giantRegimeOf(), returns GIANT_ANCHOR's key set —
  // measured over 200 seeds it emits only sub-neptune / saturnian / neptunian, never `gas-giant` or
  // `hot-jupiter`. Adopting it would rename every gas giant into a vocabulary the UI has no copy for.
  // Reclassifying giants is its own workstream. Logged in DEVIATIONS.md.
  if (compositionClass(c) === 'gas') return null;

  const T = c.T_eq ?? 288;                                  // SURFACE temperature — the seam's greenhouse
  const V = c.composition?.volatileFraction ?? 0.15;        //   correction already applied. NOT equilibrium.
  const R = c.radiusEarth ?? 1;
  const P = c.atmosphere?.pressure ?? 0;
  const CO = c.composition?.carbonToOxygen ?? 0;

  // Order is load-bearing and reads outermost-constraint-first: what the body is MADE OF, then whether
  // its surface is molten, then whether it is a runaway greenhouse, then the habitable claim, then
  // frozen, then the fallback.
  if (CO > CARBON_CO) return 'carbon';
  if (T >= T_LIQUIDUS_BASALT) return 'lava';
  if (T >= BIO_T_LIMIT && P >= BIO_P_HI) return 'venus';

  // ⚠ THE HABITABLE TEST SITS ABOVE THE FROZEN TEST ON PURPOSE, and the two overlap on 250–273 K.
  // A wet, Earth-sized body at 260 K is a marginal habitable world (brines, greenhouse) — that is
  // exactly why e1Regime's own band opens at 250 and not at 273. A wet body that small or cold and NOT
  // Earth-sized falls through to `ice`. Flipping this order re-breaks AC-2: it renames the coldest
  // habitable worlds back out of the habitable set.
  if (T >= HAB_T_LO && T <= HAB_T_HI && V >= HAB_V_MIN && R <= HAB_R_MAX) {
    // Life or no life is the only honest ocean/terrestrial split available from condition scalars, and
    // biosphereOf is the law the SHADER already uses to paint ground cover — so the name and the
    // pigment on the planet agree by construction instead of by coincidence.
    return biosphereOf(c) > 0 ? 'terrestrial' : 'ocean';
  }

  if (T < T_ICE_HI && V >= HAB_V_MIN) return 'ice';   // there is water, and it is frozen
  return 'rocky';
}

/**
 * What a DESCRIPTIVE surface should show for a body — the info panel, the orrery, the seed search.
 * The one function every UI reads, so the exotic and gas carve-outs live in exactly one place.
 *
 * @param {object} planetData - a generated planet record
 * @returns {string} a key valid for PLANET_TYPE_NAMES / the orrery colour tables
 */
export function displayClassOf(planetData) {
  const d = planetData || {};
  if (EXOTIC_TYPES.includes(d.type)) return d.type;   // the overlay name outranks the physics
  return d.worldClass ?? d.type;                      // ?? d.type: gas bodies, and any hand-authored
}                                                     //   record (SolarSystemData) with no derived class

/** Is this body one a player would call habitable? The seed search's question. */
export function isHabitableClass(planetData) {
  const k = planetData?.worldClass;
  return k === 'ocean' || k === 'terrestrial';
}
