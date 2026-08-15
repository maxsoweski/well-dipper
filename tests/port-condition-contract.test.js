/**
 * ════════════════════════════════════════════════════════════════════════════
 * STEP 1 GATE — the widened condition contract
 * docs/FEATURES/one-pipeline-two-frontends-PLAN.md, Step 1 (lines 172-196)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Step 1 widens what crosses the game→engine seam and claims the widening is
 * ADDITIVE: five new keys on the condition vector, and not one number that
 * already ships moves. This file is the machine check on that claim.
 *
 * ── WHY THE CLAIM NEEDS A MACHINE CHECK ─────────────────────────────────────
 * Nothing at this seam throws. Every divisor downstream is floored
 * (`craterUniforms.js:125,133-138,151`; `baseStep.js:99`), so a wrong input
 * does not produce an error — it produces a finite, plausible, wrong number
 * that renders. "I only added fields" is therefore unfalsifiable by looking at
 * the screen, and three of this program's four recorded drift instances were
 * introduced by someone who believed exactly that.
 *
 * ── THE FOUR-CHANNEL STRUCTURE ──────────────────────────────────────────────
 *  1. KEY SET      — the live vector's keys are exactly the pre-Step-1 set plus
 *                    the four this step adds. A fifth addition must edit this
 *                    file, which is the point.
 *  2. BIT EQUALITY — a FROZEN COPY of the pre-Step-1 adapter runs beside the
 *                    live one over ≥300 generated bodies and every pre-existing
 *                    key is compared with `Object.is`, not a tolerance.
 *  3. NO READER    — each new key is DELETED from a live condition and all eight
 *                    shipped laws are re-run. Identical output ⇒ nothing reads
 *                    it. This is stronger than channel 2: channel 2 proves the
 *                    old keys did not move, channel 3 proves the new ones cannot
 *                    move anything later without this test going red.
 *  4. PROVENANCE   — the record of measured-vs-defaulted is itself asserted,
 *                    including that it never lands on `planetData`.
 *
 * ⛔ THIS FILE IS NOT INSTRUMENT A, B OR C. It does not hash a body, it does not
 * count draws, and it does not diff a shipped uniform. Those three run
 * separately (`npm run check:instruments`) and Step 1's gate cites all of them.
 * This file covers what none of them can see: that a CONDITION KEY moved.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
// ⛔ THE PROVENANCE FENCE IS AN AST ANALYSIS, NOT A TEXT SCAN — see the block above
// `parseAdapterSource` for why the mechanism had to change. `@babel/parser` is a
// declared devDependency (`^7.29.3`, resolved 7.29.3). If it stops resolving, THIS
// IMPORT FAILS and the whole suite goes red by name; the fence must never degrade
// quietly to a regex.
import * as babelParser from '@babel/parser';

import { StarSystemGenerator } from '../src/generation/StarSystemGenerator.js';
import { generateSolarSystem } from '../src/generation/SolarSystemData.js';
import { deriveConditionVector, gravityRadiusRatio } from '../src/worldengine/base/conditionVector.js';
// The four helpers the FROZEN pre-Step-1 vector below calls. They are imported
// LIVE and that is the one thing the frozen copy cannot fence — see the residual
// note on the frozen-adapter block, and PRE_STEP1_VECTOR_GOLDEN, which closes it.
import { bodyShellThickness, bodyRawTidal, bodySurfaceGravity } from '../src/worldengine/base/baseStep.js';
import { compositionClass } from '../src/worldengine/base/e1Regime.js';
import { DRIVER_PRESETS } from '../driver-presets.js';
// The ONE consumer of the fp's `axialTilt` (planet-lod-lab-core.js:906-908).
// Imported so the domain gate below can measure what the READER produces, not
// only what the seam emits — the two are different claims and only the second
// was ever gated.
import { deriveUniforms } from '../src/worldengine/base/labCore.js';
import {
  conditionFromBody,
  atmosphereFromPlanet,
  axialTiltDegreesOf,
  effectiveObliquityDegreesOf,
  habitabilityScalarOf,
  surfaceTemperatureOf,
  densityToGramsPerCC,
  PROVENANCE_INPUTS,
  PROVENANCE_COVERAGE,
} from '../src/worldengine/port/conditionFromBody.js';

// The eight derivations that ALREADY SHIP on the game route. Five are baked onto
// planetData in the record literal and the assignments under it in `PlanetGenerator.generate`
// — PlanetGenerator.js `iceColor: ICE_ALBEDO` and `planetData.iceness = icenessOf(condition);`
// with its three siblings, cited symbol-only per PLAN §10 because that region grows every step.
// Three more are built per-material inside `_createSurface`:
// Planet.js:1597 `craterUniformsFrom(condition)`, Planet.js:1610 `const optics = atmosphereOpticsOf(condition);`
// and Planet.js:1617 `const bioCover = biosphereOf(condition);`. If Step 1 moved a pixel,
// it moved one of these.
import {
  surfacePaletteOf, icenessOf, biosphereOf, meltTemperatureOf, crustTemperatureOf,
} from '../src/worldengine/base/surfaceMaterial.js';
import { craterUniformsFrom } from '../src/worldengine/port/craterUniforms.js';
import { atmosphereOpticsOf } from '../src/worldengine/base/atmosphereOptics.js';
import { emissiveBlackbody } from '../src/worldengine/base/emission-e.js';
import { deriveGiantDrivers } from '../src/worldengine/base/giant-drivers.js';

// ─────────────────────────────────────────────────────────────────────────────
// THE FROZEN PRE-STEP-1 ADAPTER — AND, SINCE the adversarial review, THE FROZEN
// PRE-STEP-1 VECTOR TOO.
//
// ⛔ WHAT THIS BLOCK USED TO SAY, AND WHY IT WAS WRONG. It read: "A verbatim copy
// of `conditionFromPlanet` as it stood at b2ac455, calling the SAME live
// `deriveConditionVector`. That last part is deliberate: the vector's
// pre-existing lines were not edited, so if the fp is the same the old keys must
// come out bit-identical. Any difference is therefore attributable to the fp."
//
// The attribution argument is sound. The PREMISE it rests on — "the vector's
// pre-existing lines were not edited" — was never checked by anything, and the
// gate could not check it, because BOTH SIDES OF THE COMPARISON RAN THROUGH THE
// SAME LIVE VECTOR. Any edit inside `src/worldengine/base/conditionVector.js` moved `was` and
// `now` together and cancelled exactly.
//
// ⚠ MEASURED, NOT ARGUED — two injections into `src/worldengine/base/conditionVector.js`, each
// run against this file and then reverted:
//   · `rotationHours: fp.rotationHours ?? 24` → `?? 12`. Channel 2 GREEN. (The
//     whole file went red only by luck: an unrelated literal in the _provenance
//     block happens to assert 24. That is not this gate catching it.)
//   · `shellThickness: bodyShellThickness(fp)` → `… * 2`. ALL 47 TESTS GREEN —
//     a pre-existing condition key doubled on every body in the game, under a
//     gate whose stated wording (PLAN.md:189) is "every PRE-EXISTING condition
//     key is bit-equal".
//
// ── SO BOTH HALVES ARE FROZEN NOW. ──────────────────────────────────────────
// `legacyDeriveConditionVector` below is a verbatim copy of the vector's
// pre-Step-1 return literal (`git show b2ac455:body-condition-vector.js`).
// `was` is now frozen-fp + frozen-vector; `now` is live-fp + live-vector, so a
// vector-side regression shows up as a diff instead of cancelling. The four new
// keys the live vector legitimately adds are not false positives: channel 2
// iterates PRE_STEP1_KEYS only.
//
// ⚠ THE RESIDUAL, NAMED RATHER THAN LEFT IMPLICIT. The frozen vector still calls
// the LIVE `bodyShellThickness` / `bodyRawTidal` / `bodySurfaceGravity` /
// `compositionClass` / `gravityRadiusRatio`. A regression inside one of THOSE
// would still move both sides together. Freezing them too would mean copying
// most of `baseStep.js` into a test. That residual is closed from the other
// direction instead, by PRE_STEP1_VECTOR_GOLDEN below — literal numbers, no
// shared code with the live tree at all.
//
// ⚠ It is a COPY, not an import of an old version, and it will rot. That is
// accepted: its job is to pin ONE transition (Step 0 → Step 1) and it is dead
// weight afterwards. A copy that rots loudly beats a comparison that quietly
// stops comparing.
// ─────────────────────────────────────────────────────────────────────────────
function legacyAtmosphereFromPlanet(gameAtmosphere) {
  if (!gameAtmosphere) return null;
  const phys = gameAtmosphere.physics;
  if (!phys) return gameAtmosphere;           // ← the ABSENCE sniff Step 1 replaced
  if (phys.retained === false) return null;
  return {
    color: gameAtmosphere.color,
    retained: phys.retained,
    pressure: phys.pressure ?? 0,
    composition: phys.composition ?? 'none',
  };
}

function legacyFpFromPlanet(planetData) {
  const d = planetData || {};
  const comp = d.composition || {};
  const atmosphere = legacyAtmosphereFromPlanet(d.atmosphere);
  return {
    radiusEarth: d.radiusEarth ?? 1.0,
    massEarth: d.massEarth ?? 1.0,
    composition: {
      ironFraction: comp.ironFraction ?? 0.32,
      density: densityToGramsPerCC(comp.density),
      volatileFraction: comp.volatileFraction ?? 0.15,
      ...(comp.carbonToOxygen != null ? { carbonToOxygen: comp.carbonToOxygen } : {}),
    },
    age: d.age ?? 4.5,
    T_eq: surfaceTemperatureOf(d.T_eq ?? 288, atmosphere?.pressure),
    eccentricity: d.eccentricity ?? 0,
    tidalState: d.tidalState || { locked: false },
    atmosphere,
    surfaceHistory: d.surfaceHistory || { erosion: 0, bombardmentIntensity: 0, resurfacingRate: 0 },
    ...(d.rotationHours != null ? { rotationHours: d.rotationHours } : {}),
  };
}

/**
 * A verbatim copy of `deriveConditionVector`'s pre-Step-1 body
 * (`git show b2ac455:body-condition-vector.js`, lines 95-145). Comments dropped,
 * expressions untouched — every `??` fallback and every operand is the original
 * text. If a line here needs to change to make a test pass, that IS the finding.
 */
function legacyDeriveConditionVector(fp, derived, radiusEarth) {
  const _density     = fp.composition?.density ?? 5.5;
  const _composition = fp.composition ?? null;
  const _atmosphere  = fp.atmosphere ?? null;
  const _R_c   = fp.radiusEarth ?? 1.0;
  const _R     = radiusEarth ?? _R_c;
  const _class = compositionClass({ atmosphere: _atmosphere, composition: _composition, density: _density });
  return {
    density:         _density,
    composition:     _composition,
    age:             fp.age ?? 4.5,
    radiusEarth:     _R,
    eccentricity:    fp.eccentricity ?? 0,
    T_eq:            fp.T_eq ?? 288,
    surfaceGravity:  (derived?.surfaceGravity ?? bodySurfaceGravity(fp)) * gravityRadiusRatio(_R, _R_c, _class),
    atmosphere:      _atmosphere,
    tidalState:      { locked: !!(fp.tidalState && fp.tidalState.locked) },
    rotationHours:   fp.rotationHours ?? 24,
    rawTidalIoRatio: derived?.tidalHeat ?? bodyRawTidal(fp),
    shellThickness:  bodyShellThickness(fp),
    magneticField:   fp.magneticField,
    metallicity:     fp.metallicity,
  };
}

function legacyConditionFromPlanet(planetData) {
  const fp = legacyFpFromPlanet(planetData);
  return legacyDeriveConditionVector(fp, null, fp.radiusEarth);
}

// ─────────────────────────────────────────────────────────────────────────────
// THE KEY LEDGER
// ─────────────────────────────────────────────────────────────────────────────

/** Every key `deriveConditionVector` emitted before Step 1. */
const PRE_STEP1_KEYS = [
  'density', 'composition', 'age', 'radiusEarth', 'eccentricity', 'T_eq',
  'surfaceGravity', 'atmosphere', 'tidalState', 'rotationHours',
  'rawTidalIoRatio', 'shellThickness', 'magneticField', 'metallicity',
];

/** Every key Step 1 adds. */
const STEP1_KEYS = ['surfaceHistory', 'radiusEarthCanonical', 'habitability', 'axialTiltDeg'];

/**
 * The ONE pre-existing key Step 1 deliberately moves, and why the plan's own
 * gate wording has to be read carefully.
 *
 * PLAN.md:189 says "every PRE-EXISTING condition key is bit-equal". Taken
 * literally that gate cannot pass, because PLAN.md:46 lists `magneticField` as
 * one of the three things the port DROPS — "never set, though
 * body-condition-vector.js:156-157 declares them as vector keys" — and Step 1's
 * whole job is to stop dropping it. The key existed; its VALUE did not. It was
 * `undefined` on 100% of game bodies and is now a number.
 *
 * So the honest gate is: every pre-existing key that CARRIED A VALUE is
 * bit-equal, and the previously-undefined declared keys are enumerated here by
 * name. One name, not a category — `metallicity` is the other declared-but-unset
 * key and it must stay unset until Step 5 (see the metallicity fence below).
 *
 * ⭐ STEP 4 CHANGED THE SHAPE OF THIS LEDGER, NOT JUST ITS CONTENTS. It used to be
 * a NAME LIST consumed by a `continue`, i.e. a set of keys the bit-equality loop
 * SKIPPED. A skipped key is a key nothing checks: `rawTidalIoRatio` could have
 * stopped moving, or moved on 3 bodies instead of 469, and the loop below would
 * have been just as green. Step 4's no-surface guard adds a third mover (`T_eq`),
 * and adding a third name to a skip-list is exactly the "things changed, fine"
 * re-bless PLAN §11 and ledger C15 both name as the defect this program exists to
 * remove. So the ledger is now a TABLE OF EXACT POPULATIONS and the loop asserts
 * the whole table by value: an unexpected mover adds a key and reds it, a mover
 * that disappears drops a key and reds it, and a mover whose population shifts by
 * ONE body reds it too. Nothing is skipped any more.
 *
 * ⚠ EVERY NUMBER HERE WAS EXECUTED, NOT COPIED (PLAN §11.3.2). Measured over the
 * 526-planet corpus this file builds, uncapped — note that the `bitDiff` cap of 24
 * makes the raw failure output an UNDERCOUNT, which is how "25" reads out of a
 * red run that is really 205 bodies wide.
 *   magneticField    526/526  undefined → a finite number (Step 1; the whole population)
 *   rawTidalIoRatio  469/526  the fabricated 1 M☉-at-1-AU Io ratio → the body's own (Step 2)
 *   T_eq             205/526  the greenhouse-corrected surface temperature → the bare
 *                             radiative-balance number, on the bodies the no-surface
 *                             guard classifies as having no surface (Step 4). Strictly
 *                             DOWNWARD on all 205, and equal to the game's raw `d.T_eq`
 *                             on all 205 — both asserted below, because "it changed" and
 *                             "it is now the right number" are different claims.
 *   metallicity      526/526  undefined → the game's own dex, forwarded verbatim (Step 5e).
 *                             The SECOND declared-but-unset key to fill, and the last one:
 *                             with it, no key in this ledger is `undefined` on a generated
 *                             planet any more. Direction asserted below the same way
 *                             `magneticField`'s is — `Object.is` against `pd.metallicity`,
 *                             so a re-derivation that happens to be close fails.
 */
const EXPECTED_CONDITION_MOVERS = Object.freeze({
  magneticField:   526,
  rawTidalIoRatio: 469,
  T_eq:            205,   // 204 -> 205 at 2154de1 (break B7) — see the note under CORPUS_BODIES
  metallicity:     526,
});

/**
 * The corpus size, pinned. Every population above and below is a COUNT, and a count
 * only means something against a denominator — `T_eq: 205` is a different claim on a
 * 526-body corpus than on a 210-body one. If generation changes and the corpus
 * resizes, every number in this file is stale and the reader must be told that
 * rather than left to compare a fresh 205 against a remembered denominator.
 */
const CORPUS_BODIES = 526;

/**
 * ⭐ STEP 2 — THE DECLARED MOVERS, AND WHY THIS LIST IS NOT AN EXCUSE LIST.
 *
 * Step 2 is a DECLARED PIXEL-MOVING STEP (PLAN.md:203 "Gate — deliberately NOT
 * byte-identity", PLAN §11.3.6 "a pixel-moving step … publishes a committed delta
 * table that is non-zero on the named quantities"). So the honest form of channel 2
 * is NOT "nothing moved" and it is NOT "these names are exempt" either — an exempt
 * name is a name nothing checks, which is how a real regression rides in behind a
 * declared one. It is: **everything not named here is bit-equal, and everything
 * named here is asserted to have MOVED, by name, with its population and direction.**
 * The two named-mover tests below are the second half; without them this list is a
 * hole and channel 2 has been quietly narrowed.
 *
 * ⚠ MEASURED over the 526-planet corpus (`scratchpad` measurement re-run as the two
 * assertions below, so the numbers are executable rather than remembered):
 *   condition keys that move:   rawTidalIoRatio ONLY, on 469/526 (the other 57 are
 *                               ecc == 0 bodies where both arms give exactly 0)
 *   shipped law outputs:        meltTemperature 353, crustTemperature 353,
 *                               lavaGlowColor 352, lavaCrustColor 353 — on 353/526
 *                               bodies, and NOTHING ELSE. `palette`, `iceness`,
 *                               `biosphere`, `craters`, `optics` and the giant
 *                               triple are all bit-identical.
 *
 * ⚠ `lavaGlowColor` IS ONE BELOW `meltTemperature`, AND THAT IS NOT A ROUNDING
 * ARTEFACT — `emissiveBlackbody` saturates, so on exactly one body the melt point
 * moved and the colour it maps to did not. Recorded because a reader who assumed the
 * two counts must match would go looking for a bug that is not there.
 *
 * ⭐⭐ STEP 4 — THE RE-BLESS, AND THE PART OF IT THAT WAS NOT DECLARED ANYWHERE.
 *
 * Step 4's no-surface guard moves `T_eq` on 205 bodies, and `T_eq` is an input to
 * most of the shipped laws. So the declared-mover set widens. The plan
 * (`one-pipeline-two-frontends-PLAN.md`:247) names FOUR laws as the ones Step 4
 * touches. ⛔ MEASURED, THAT LIST IS WRONG IN BOTH DIRECTIONS at the uniform level
 * (`npm run port-uniform-delta:check`: `uTermStrength` and `uTermWidth` are named and
 * move on 0/526; eight uniforms move that the plan does not name), and it is wrong
 * here too. NINE of the ten shipped laws move, not four and not the eight a first
 * reading of the uniform delta suggests:
 *
 *   ⚠ `palette` IS THE NINTH, AND NOTHING DECLARED IT. `surfacePaletteOf` moves on
 *   149/526 bodies — the `uSedColor` / `uWeatheredColor` / `uFreshColor` /
 *   `uBioGroundColor` family in the uniform delta. It is a real, undeclared
 *   consequence of the guard, and pinning it by name here is the only place in the
 *   tree that says so.
 *
 * ⚠ EVERY NUMBER BELOW WAS EXECUTED OVER THIS FILE'S OWN 526-BODY CORPUS, not copied
 * from the plan or from a delta table (PLAN §11.3.2 — a pinned number taken from prose
 * has been wrong twice). They are LAW-OUTPUT populations and they deliberately do NOT
 * match the uniform-level populations in `port-uniform-delta`: `deriveUniforms` sits
 * between the two and quantises, clamps and drops. `palette` moving on 148 bodies and
 * `uSedColor` moving on 131 is not a contradiction; it is the two stages measured
 * separately, which is the point of having both instruments.
 */
const EXPECTED_LAW_MOVER_BODIES = Object.freeze({
  meltTemperature:  354,   // Step 2 + Step 4
  crustTemperature: 354,   // Step 2 + Step 4
  lavaCrustColor:   354,   // Step 2 + Step 4
  lavaGlowColor:    353,   // one below its melt point — emissiveBlackbody saturates
  optics:           194,   // Step 4 — the limb/terminator family (193 -> 194 at 2154de1)
  // ⭐ STEP 5e MOVED THIS ROW, 164 → 404, AND IT IS THE ONLY ROW THAT MOVED. Forwarding
  // `metallicity` turns `shellDepthFrac` from a saturated constant into a live channel
  // (340 bodies, was 343), and `dissipation` follows it through FORM 3 (164 → 201). Every other
  // row below is byte-unchanged, which is the check that nothing but the giant deck reads
  // the new key — the same claim channel 3 makes structurally, made here by population.
  giant:            401,   // Step 4 + Step 5e — shellDepthFrac 340, dissipation 201, internalHeat 11
  palette:          149,   // ⭐ Step 4, UNDECLARED — see the block above (148 -> 149 at 2154de1)
  iceness:           85,   // Step 4 (86 -> 85 at 2154de1)
  biosphere:         32,   // Step 4
});

/** The names alone, derived so the list and the populations can never disagree. */
const EXPECTED_LAW_MOVERS = Object.keys(EXPECTED_LAW_MOVER_BODIES);

/** The shipped-law bundle minus Step 2's declared movers — the surface that must still be bit-equal. */
const withoutLawMovers = (o) => Object.fromEntries(
  Object.entries(o).filter(([k]) => !EXPECTED_LAW_MOVERS.includes(k)),
);

const GIANT_TYPES = new Set(['gas-giant', 'hot-jupiter', 'sub-neptune']);

// ─────────────────────────────────────────────────────────────────────────────
// PRE_STEP1_VECTOR_GOLDEN — literal numbers, sharing NO CODE with the live tree.
//
// ⛔ WHY A GOLDEN WHEN THERE IS ALREADY A FROZEN VECTOR. The frozen copy above
// still calls the LIVE baseStep helpers, so a regression inside
// `deriveBodyScalars` would move `was` and `now` together and cancel — the same
// class of blindness, one level down. A table of hardcoded numbers cannot
// cancel with anything: it is the only fence here that survives an edit
// ANYWHERE beneath `deriveConditionVector`.
//
// Captured from the live vector at 0af246e (the known-good baseline). Every
// value is a full-precision JS literal, so `Object.is` is the right comparison
// and no tolerance is involved.
//
// ⚠ THE FIXTURES ARE HAND-AUTHORED, NOT GENERATED, ON PURPOSE. A golden seeded
// from `StarSystemGenerator` would move whenever generation moved, and would be
// re-recorded rather than read — which is how a golden stops being evidence.
//
// ⚠ AND THEY CARRY `ageNorm`, WHICH LOOKS REDUNDANT NEXT TO `age`. It is not.
// `baseStep.js:40` reads `d.ageNorm ?? (d.age ?? 0.5)` and treats the result as
// a 0..1 quantity, so an fp carrying only `age: 4.5` drives
// `shellThickness = clamp01(0.3 + … + 0.2*(1 − 4.5))` NEGATIVE and it clamps to
// exactly 0. The first cut of this table did that on 5 of 7 fixtures — a golden
// that would have recorded `shellThickness: 0` seven times and therefore could
// not have caught the `* 2` injection that motivated it (0 * 2 === 0). That is
// this codebase's signature failure, caught inside the fix for it. The
// degeneracy CONTROL test below is what keeps it caught.
// ─────────────────────────────────────────────────────────────────────────────
const PRE_STEP1_VECTOR_GOLDEN = {
  'rocky @canonical': {
    fp: { radiusEarth: 1, massEarth: 1, age: 4.5, ageNorm: 0.45, eccentricity: 0.017, T_eq: 288, rotationHours: 24, composition: { ironFraction: 0.32, density: 5.5, volatileFraction: 0.15 }, atmosphere: { retained: true, pressure: 1, composition: 'n2-o2' }, tidalState: { locked: false } },
    drawnRadius: 1,
    condition: {
      density: 5.5, age: 4.5, radiusEarth: 1, eccentricity: 0.017, T_eq: 288,
      surfaceGravity: 1, rotationHours: 24,
      rawTidalIoRatio: 0.001739731682543869, shellThickness: 0.41498676979442295,
      magneticField: undefined, metallicity: undefined,
    },
  },
  'rocky @1.6x drawn — the self-compression branch': {
    fp: { radiusEarth: 1, massEarth: 1, age: 4.5, ageNorm: 0.45, eccentricity: 0.017, T_eq: 288, rotationHours: 24, composition: { ironFraction: 0.32, density: 5.5, volatileFraction: 0.15 }, atmosphere: { retained: true, pressure: 1, composition: 'n2-o2' }, tidalState: { locked: false } },
    drawnRadius: 1.6,
    condition: {
      density: 5.5, age: 4.5, radiusEarth: 1.6, eccentricity: 0.017, T_eq: 288,
      surfaceGravity: 2.223330217241199, rotationHours: 24,
      rawTidalIoRatio: 0.001739731682543869, shellThickness: 0.41498676979442295,
      magneticField: undefined, metallicity: undefined,
    },
  },
  'icy sub-Earth, locked': {
    fp: { radiusEarth: 0.245, massEarth: 0.008, age: 4.5, ageNorm: 0.9, eccentricity: 0.009, T_eq: 102, composition: { ironFraction: 0.1, density: 1.9, volatileFraction: 0.5 }, atmosphere: null, tidalState: { locked: true } },
    drawnRadius: 0.245,
    condition: {
      density: 1.9, age: 4.5, radiusEarth: 0.245, eccentricity: 0.009, T_eq: 102,
      surfaceGravity: 0.13327780091628488, rotationHours: 24,
      rawTidalIoRatio: 4.3042736113539396e-7, shellThickness: 0.32,
      magneticField: undefined, metallicity: undefined,
    },
  },
  'gas h2-he — the non-rocky gravity branch': {
    fp: { radiusEarth: 11.2, massEarth: 317.8, age: 4.6, ageNorm: 0.2, eccentricity: 0.048, T_eq: 165, rotationHours: 9.9, composition: { ironFraction: 0.05, density: 1.33, volatileFraction: 0.9 }, atmosphere: { retained: true, pressure: 1000, composition: 'h2-he' }, tidalState: { locked: false } },
    drawnRadius: 11.2,
    condition: {
      density: 1.33, age: 4.6, radiusEarth: 11.2, eccentricity: 0.048, T_eq: 165,
      surfaceGravity: 2.5334821428571432, rotationHours: 9.9,
      rawTidalIoRatio: 2444.314127552803, shellThickness: 0.5321568624464101,
      magneticField: undefined, metallicity: undefined,
    },
  },
  'carbon C/O 1.2 @1.6x — the compositionClass branch': {
    fp: { radiusEarth: 1.1, massEarth: 1.4, age: 4.5, ageNorm: 0.6, eccentricity: 0.01, T_eq: 600, composition: { ironFraction: 0.3, density: 6, volatileFraction: 0.02, carbonToOxygen: 1.2 }, atmosphere: null, tidalState: { locked: false } },
    drawnRadius: 1.76,
    condition: {
      density: 6, age: 4.5, radiusEarth: 1.76, eccentricity: 0.01, T_eq: 600,
      surfaceGravity: 1.851239669421487, rotationHours: 24,
      rawTidalIoRatio: 0.0009695000941362381, shellThickness: 0.38850041055735407,
      magneticField: undefined, metallicity: undefined,
    },
  },
  'sparse — every fallback fires': {
    fp: {},
    drawnRadius: undefined,
    condition: {
      density: 5.5, age: 4.5, radiusEarth: 1, eccentricity: 0, T_eq: 288,
      surfaceGravity: 1, rotationHours: 24,
      rawTidalIoRatio: 0, shellThickness: 0.40498676979442294,
      magneticField: undefined, metallicity: undefined,
    },
  },
  'data-only keys carried': {
    fp: { radiusEarth: 1, ageNorm: 0.75, magneticField: 0.2238, metallicity: -0.473, composition: { ironFraction: 0.32, density: 5.5, volatileFraction: 0.15 } },
    drawnRadius: 1,
    condition: {
      density: 5.5, age: 4.5, radiusEarth: 1, eccentricity: 0, T_eq: 288,
      surfaceGravity: 1, rotationHours: 24,
      rawTidalIoRatio: 0, shellThickness: 0.35498676979442295,
      magneticField: 0.2238, metallicity: -0.473,
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// BIT EQUALITY — `Object.is` on every leaf, recursing structures.
//
// `Object.is` and not `===` because the two differ on exactly the values a
// physics pipeline produces at its edges: `Object.is(NaN, NaN)` is true (so a
// NaN that was already there does not read as a change) and
// `Object.is(0, -0)` is FALSE (so a sign flip through a zero is caught). A
// tolerance would hide both.
// ─────────────────────────────────────────────────────────────────────────────
function bitDiff(a, b, path, out) {
  if (out.length > 24) return out;
  if (Object.is(a, b)) return out;
  const bothObj = a && b && typeof a === 'object' && typeof b === 'object';
  if (!bothObj) { out.push(`${path}: ${JSON.stringify(a) ?? String(a)} → ${JSON.stringify(b) ?? String(b)}`); return out; }
  if (Array.isArray(a) !== Array.isArray(b)) { out.push(`${path}: array-ness changed`); return out; }
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])];
  for (const k of keys) bitDiff(a[k], b[k], `${path}.${k}`, out);
  return out;
}

/**
 * Every number the eight shipped derivations produce for one body, flattened.
 * This is the surface Step 1 promises not to touch — the actual pixels, not a
 * proxy for them.
 */
function shippedLawOutputs(cond) {
  const melt = meltTemperatureOf(cond);
  const crust = crustTemperatureOf(cond);
  return {
    palette: surfacePaletteOf(cond),
    iceness: icenessOf(cond),
    biosphere: biosphereOf(cond),
    meltTemperature: melt,
    crustTemperature: crust,
    lavaGlowColor: emissiveBlackbody(melt),
    lavaCrustColor: emissiveBlackbody(crust),
    craters: craterUniformsFrom(cond),
    optics: atmosphereOpticsOf(cond),
    giant: deriveGiantDrivers(cond),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CORPUS — 120 seeded systems. Measured: 530+ planets, ~145 of them gas-class,
// which is the same population size PLAN.md:182 quotes for the metallicity
// measurement (144 gas bodies), so the numbers in that paragraph are checkable
// against this file rather than only against a session transcript.
// ─────────────────────────────────────────────────────────────────────────────
const SEEDS = Array.from({ length: 120 }, (_, i) => `pcc-${i}`);

let planets = [];
let moons = [];
/**
 * `seed#ordinal` for each entry of `planets`, same index. A COUNT is anonymous; the
 * no-surface domain tests below have to be able to name the body they are talking about,
 * both in a canary literal and in a failure message.
 *
 * ⛔ THE ORDINAL IS THE INDEX INTO `system.planets`, NOT `planetData._ordinal`, and the two
 * are NOT the same thing. MEASURED over this corpus: `_ordinal` is ABSENT on 6/526 bodies
 * and DISAGREES with the array position on another 6 (`pcc-107#0` carries `_ordinal 5`,
 * `pcc-116#1` carries `0`, …). A future editor who "tidies" this to read `_ordinal` would
 * silently re-point twelve rows of the canary table at different bodies while every
 * assertion stayed green, which is the exact failure the canary table exists to prevent.
 */
let bodyIds = [];

beforeAll(() => {
  for (const seed of SEEDS) {
    const s = StarSystemGenerator.generate(seed, null);
    (s.planets || []).forEach((e, ordinal) => {
      planets.push(e.planetData);
      bodyIds.push(`${seed}#${ordinal}`);
      for (const m of e.moons || []) moons.push(m);
    });
  }
});

// ═════════════════════════════════════════════════════════════════════════════

describe('Step 1 · the corpus is big enough to mean anything', () => {
  it('carries at least 300 generated planets and 200 bodies for the giant triple', () => {
    // PLAN.md:189-191 sizes both gates. A gate that runs on 12 bodies and passes
    // has not measured the population it claims to speak for.
    expect(planets.length).toBeGreaterThanOrEqual(300);
    expect(planets.length).toBeGreaterThanOrEqual(200);
    expect(moons.length).toBeGreaterThan(0);
  });
});

describe('Step 1 · channel 1 — the key set', () => {
  it('emits exactly the pre-Step-1 keys plus the four this step adds', () => {
    const live = Object.keys(conditionFromBody(planets[0])).sort();
    expect(live).toEqual([...PRE_STEP1_KEYS, ...STEP1_KEYS].sort());
  });

  it('emits the same key set on the LAB route, which never passes through the adapter', () => {
    // The vector is shared. A key added for the game silently appears on every
    // lab preset too, so the lab route is asserted rather than assumed —
    // otherwise "additive for the game" could be "a new law input for the lab".
    const expected = [...PRE_STEP1_KEYS, ...STEP1_KEYS].sort();
    for (const [name, fp] of Object.entries(DRIVER_PRESETS)) {
      const keys = Object.keys(deriveConditionVector(fp, null, fp.radiusEarth)).sort();
      expect(keys, `lab preset ${name}`).toEqual(expected);
    }
  });
});

describe('Step 1 · channel 2 — bit equality against the frozen pre-Step-1 adapter', () => {
  it('every pre-existing condition key that carried a value is BIT-equal, and the three that move do so on exactly their declared populations', () => {
    // ⛔ THIS TEST NO LONGER SKIPS ANYTHING. See EXPECTED_CONDITION_MOVERS for why the
    // skip-list shape had to go: a `continue` on a declared mover is an unchecked key,
    // and Step 4 adding a third name to a skip-list would have been a re-bless that
    // converts a gate into a shrug. All fourteen pre-existing keys are compared on all
    // 526 bodies; the eleven that must not move are pinned by their ABSENCE from the
    // table, the three that do are pinned by their exact population.
    //
    // ⛔ AND THE LOOP NO LONGER STOPS AT 24 DIFFS. The old `diffs.length <= 24` bound
    // (plus `bitDiff`'s own cap) meant the failure output was an undercount and no count
    // in it could be pinned: the pre-edit red run reported "25" for what is really 205
    // bodies. A capped list is fine for a gate that asserts EMPTY. It is useless for a
    // gate that asserts a population, so the population pass runs the whole corpus and
    // only the human-readable SAMPLES are capped.
    const movedOn = {};
    const samples = {};
    let bodiesTouched = 0;
    for (let i = 0; i < planets.length; i++) {
      const was = legacyConditionFromPlanet(planets[i]);
      const now = conditionFromBody(planets[i]);
      let any = false;
      for (const k of PRE_STEP1_KEYS) {
        if (bitDiff(was[k], now[k], k, []).length === 0) continue;
        movedOn[k] = (movedOn[k] || 0) + 1;
        if (!samples[k]) samples[k] = `${planets[i].type}[${i}].${k}: ${JSON.stringify(was[k]) ?? String(was[k])} → ${JSON.stringify(now[k]) ?? String(now[k])}`;
        any = true;
      }
      if (any) bodiesTouched++;
    }

    expect(planets.length, 'the corpus resized — every pinned population in this file is now stale')
      .toBe(CORPUS_BODIES);
    expect(movedOn, 'the set OR the population of moving pre-existing condition keys is not the '
      + 'declared one. A NEW key means a step moved a number it did not declare; a MISSING key means '
      + 'a declared step is not in the tree and the gates that subtract it are passing vacuously; a '
      + 'SHIFTED count means the blast radius changed size.\nfirst example of each mover:\n'
      + Object.values(samples).join('\n'))
      .toEqual({ ...EXPECTED_CONDITION_MOVERS });
    expect(bodiesTouched, 'magneticField fills on every body, so every body must show at least one move')
      .toBe(CORPUS_BODIES);

    // ── STEP 4's MOVER, IN BOTH DIRECTIONS ────────────────────────────────────────
    // Population alone is "it changed". These two say "it changed TO THE RIGHT THING",
    // which is the actual claim of the guard, and they are what stops a future
    // "equivalent" refactor from moving T_eq somewhere else on the same 205 bodies.
    let rawOnMovers = 0, strictlyDown = 0, greenhouseOnRest = 0;
    for (const pd of planets) {
      const was = legacyConditionFromPlanet(pd).T_eq;
      const now = conditionFromBody(pd).T_eq;
      if (Object.is(was, now)) {
        // The 322 bodies the guard does NOT classify must still get the greenhouse
        // conversion — otherwise "T_eq moved on 205" could be satisfied by a guard that
        // fires everywhere and a corpus that happens to agree elsewhere.
        if (Object.is(now, surfaceTemperatureOf(pd.T_eq ?? 288, atmosphereFromPlanet(pd.atmosphere)?.pressure))) greenhouseOnRest++;
        continue;
      }
      if (Object.is(now, pd.T_eq ?? 288)) rawOnMovers++;    // the BARE radiative number, not a new formula
      if (now < was) strictlyDown++;                        // removing a greenhouse can only cool
    }
    expect(rawOnMovers, 'a no-surface body must receive the game\'s own raw T_eq, not a third number')
      .toBe(EXPECTED_CONDITION_MOVERS.T_eq);
    expect(strictlyDown, 'dropping the greenhouse column can only lower T_eq — an upward move is a different bug')
      .toBe(EXPECTED_CONDITION_MOVERS.T_eq);
    expect(greenhouseOnRest, 'the bodies the guard does NOT classify must still get the greenhouse conversion')
      .toBe(CORPUS_BODIES - EXPECTED_CONDITION_MOVERS.T_eq);
  });

  it('magneticField is the ONE pre-existing key that moves, and it moves from nothing to something', () => {
    // Named, not blanket-excused. Before Step 1 the vector declared this key
    // (body-condition-vector.js:156) and the adapter never filled it — PLAN.md:46
    // calls that out as one of the three dropped inputs. Asserting the direction
    // means a future edit that makes it undefined again fails here.
    let filled = 0;
    for (const pd of planets) {
      expect(legacyConditionFromPlanet(pd).magneticField).toBeUndefined();
      const v = conditionFromBody(pd).magneticField;
      expect(Number.isFinite(v), `magneticField on a ${pd.type}`).toBe(true);
      expect(Object.is(v, pd.magneticField)).toBe(true);   // forwarded, not re-derived
      filled++;
    }
    expect(filled).toBe(planets.length);
  });

  it('the giant-driver triple {internalHeat, shellDepthFrac, dissipation} moves on exactly two of its three fields, on exactly their declared populations', () => {
    // PLAN.md:191 — "THIS is the assertion that actually means additive."
    // deriveGiantDrivers is the derivation most exposed to a widened contract:
    // its enrichment term (giant-drivers.js:122-131) explicitly prefers a
    // condition slot that Step 1 could have filled, and Step 5 will.
    //
    // ⭐ STEP 4 RE-BLESS. This was `toEqual([])` — byte-identity over the whole triple.
    // Step 4's `T_eq` move feeds two of the triple's three forms directly
    // (`internalHeat = IH0·(M/M0)^α·(age0/age)^β·(T0/T_eq)^γ` and
    // `dissipation = DIS0·(SDF/SDF0)^ε·(T_eq/T0)^ζ`), so byte-identity cannot hold.
    // ⛔ IT IS NOT WIDENED TO "the triple may move". It is widened to a per-field table,
    // and the third field — `shellDepthFrac`, whose form reads only the enrichment-Z
    // proxy and therefore has NO path to T_eq — is pinned to zero by name. That negative
    // half is the whole value of the test: it is what still catches Step 5 quietly
    // filling the enrichment slot.
    const movedOn = {};
    const samples = {};
    const fieldsSeen = new Set();
    let bodiesTouched = 0;
    for (let i = 0; i < planets.length; i++) {
      const was = deriveGiantDrivers(legacyConditionFromPlanet(planets[i]));
      const now = deriveGiantDrivers(conditionFromBody(planets[i]));
      let any = false;
      for (const k of new Set([...Object.keys(was), ...Object.keys(now)])) {
        fieldsSeen.add(k);
        if (bitDiff(was[k], now[k], k, []).length === 0) continue;
        movedOn[k] = (movedOn[k] || 0) + 1;
        if (!samples[k]) samples[k] = `${planets[i].type}[${i}].${k}: ${was[k]} → ${now[k]}`;
        any = true;
      }
      if (any) bodiesTouched++;
    }

    // ⛔ SHAPE CONTROL FIRST. Every assertion below is keyed by field name, so a field
    // that gets RENAMED or DROPPED would silently leave the compared surface instead of
    // failing. Pin the surface before measuring it.
    expect([...fieldsSeen].sort(), 'the giant triple is no longer a triple — the table below is comparing a different surface')
      .toEqual(['dissipation', 'internalHeat', 'shellDepthFrac']);

    expect(planets.length).toBe(CORPUS_BODIES);
    expect(movedOn, 'the giant triple\'s moving fields or their populations are not the declared ones\n'
      + Object.values(samples).join('\n'))
      .toEqual({ shellDepthFrac: 340, dissipation: 201, internalHeat: 11 });
    expect(bodiesTouched, 'bodies whose jet profile changes').toBe(401);  // 404 -> 401 at 2154de1 (break B7)

    // ⭐⭐ STEP 5e RE-BLESS — AND THE PIN THAT REDDED IS THE REASON THIS WORKED.
    //
    // What stood here asserted `[...sdfValues].toEqual([0.74])` and `movedOn.shellDepthFrac === 0`,
    // under a comment naming the exact event that would break it: "Step 5 forwarding `metallicity`
    // (present on 526/526 planetData records, forwarded on 0)". Step 5e forwards it. The pin went
    // RED, naming its own successor. ⛔ IT IS NOT WIDENED. A `toEqual([0.74])` replaced by
    // `.length > 1` would be the shrug PLAN §11 and ledger C15 exist to refuse; a distinct-COUNT
    // would be worse, because Step 4's own scar is that a count-preserving permutation passed every
    // instrument byte-identically. So the saturation pin is replaced by a MEMBERSHIP statement:
    // every body's `shellDepthFrac` is asserted against a closed form computed from THAT BODY'S OWN
    // `metallicity`, with literal constants and no code shared with the tree.
    //
    // ⚠ WHY A CLOSED FORM IS AVAILABLE AT ALL, and it is the whole finding of this step. On this
    // route `condition.regime` is undefined, so every body scores against the gas-giant anchors, and
    // the metallicity arm of `enrichmentRatio` returns BEFORE any density is read. `shellDepthFrac`
    // is therefore a pure function of one number the body carries — not of its mass, radius, age,
    // temperature, composition or seed. Measured: 115 distinct `metallicity` values across the
    // corpus map onto 21 distinct `shellDepthFrac` values, and NOT ONE metallicity value maps to two
    // shell depths. That many-to-one is the clamp, and it is measured below rather than described.
    const clampSdf = (v) => Math.min(0.86, Math.max(0.74, v));
    const closedForm = (dex) => clampSdf(0.80 * (1 - 0.95 * (10 ** (dex - 0.0) - 1)));
    let exact = 0;
    for (const pd of planets) {
      if (Object.is(deriveGiantDrivers(conditionFromBody(pd)).shellDepthFrac, closedForm(pd.metallicity))) exact++;
    }
    expect(exact, 'shellDepthFrac is no longer SDF0·(1 − δ·(10^Z − 1)) clamped to the gas-giant band — '
      + 'either the adapter stopped forwarding metallicity, or the law stopped reading it, or a '
      + 'THIRD input reached FORM 2').toBe(CORPUS_BODIES);

    // ⛔⛔ THE CONTROL THAT SEPARATES THIS FROM A COUNT GATE — Step 4's scar, executed rather
    // than remembered. Step 4 shipped a gate that pinned COUNTS, and a count-preserving PERMUTATION
    // passed every instrument byte-identically. So the permutation is run here: the same 526
    // metallicity values, dealt to different bodies. Every count below survives it unchanged — the
    // distinct-value count, the interior count, both bound counts — and the membership assertion
    // above is the only thing in this test that notices.
    // ⚠ THE PERMUTATION IS A HALF-CORPUS CYCLIC SHIFT, NOT `i+1`, AND THE CHOICE WAS MEASURED.
    // `i+1` leaves 442/526 bodies matching by luck, because adjacent entries are usually planets of
    // the SAME system and therefore carry the same metallicity — a control that barely moves. The
    // half-shift crosses systems on every row and leaves 174. Both are count-preserving; only the
    // second is a control worth having, and picking it by running both is the difference.
    const permuted = planets.map((_, i) => planets[(i + 263) % planets.length].metallicity);
    const permSdf = permuted.map((dex) => closedForm(dex));
    const liveSdf = planets.map((pd) => deriveGiantDrivers(conditionFromBody(pd)).shellDepthFrac);
    expect(new Set(permSdf).size, 'the permutation changed the VALUE SET — it is not count-preserving '
      + 'and proves nothing about membership').toBe(new Set(liveSdf).size);
    expect(permSdf.filter((v) => v > 0.74 && v < 0.86).length)
      .toBe(liveSdf.filter((v) => v > 0.74 && v < 0.86).length);
    expect(permSdf.filter((v) => v === 0.74).length).toBe(liveSdf.filter((v) => v === 0.74).length);
    expect(permSdf.filter((v) => v === 0.86).length).toBe(liveSdf.filter((v) => v === 0.86).length);
    // …and the membership check DOES see it. ⚠ MEASURED, AND THE NUMBER IS THE POINT: even the
    // strong permutation leaves 174 of 526 bodies matching by luck, because the clamp collapses 451
    // of them onto two values. So this control fires on 352 bodies, not on 526, and a reader must
    // not take "the membership gate catches a permutation" as "the membership gate is tight". It is
    // as tight as the clamp allows, which is a third of the corpus loose.
    const permExact = planets.filter((pd, i) => Object.is(
      deriveGiantDrivers(conditionFromBody(pd)).shellDepthFrac, closedForm(permuted[i]))).length;
    expect(permExact, 'the per-body membership assertion above cannot tell a permuted corpus from '
      + 'the real one — it is a count gate wearing a membership costume').toBeLessThan(CORPUS_BODIES);
    expect(permExact, 'recorded rather than left as an inequality, so the gate\'s LIMIT is on record '
      + 'with the construct that produced it').toBe(174);

    // ── THE DISTRIBUTION, PINNED BY VALUE, NOT BY SPREAD ────────────────────────────────
    // ⚠ THE HEADLINE IS NOT THE 21. It is that 451 of 526 bodies still sit ON a clamp bound:
    // δ = 0.95 against a band 0.12 wide about SDF0 = 0.80 means the interior window is
    // log10(1 ± 0.06/(0.95·0.80)) = −0.0357 … +0.0330 dex — 0.069 dex wide, against a corpus
    // spanning −0.5031 … +0.3645. So forwarding did not make this channel expressive on THIS route;
    // it made it a near-binary switch on the sign of the metallicity. That is the number Max asked
    // to see before ruling on whether it is "too uniform", and burying it under "21 distinct values"
    // would be the true-and-misleading form this file exists to refuse. (⛔ The per-REGIME route the
    // game actually renders through is a different and better measurement — see the Step 5e block in
    // conditionFromBody.js. This route is the gate's route, not the player's.)
    const sdfValues = planets.map((pd) => deriveGiantDrivers(conditionFromBody(pd)).shellDepthFrac);
    expect(new Set(sdfValues).size, 'the shellDepthFrac population changed shape').toBe(20);  // 21 -> 20 at 2154de1
    expect(sdfValues.filter((v) => v === 0.74).length, 'pinned at the band FLOOR (metal-rich)').toBe(186);  // 183 -> 186 at 2154de1
    expect(sdfValues.filter((v) => v === 0.86).length, 'pinned at the band CEILING (metal-poor)').toBe(270);  // 268 -> 270 at 2154de1
    expect(sdfValues.filter((v) => v > 0.74 && v < 0.86).length, 'strictly INTERIOR to the band').toBe(70);  // 75 -> 70 at 2154de1; 186+270+70 = 526
    // ⚠ AND THE ANCHOR IS EXACT, WHICH IS THE ONE VALUE WORTH NAMING. `MET0_DEX` is 0 by definition,
    // so a body at exactly 0 dex gets ratio 1 and lands on SDF0 to the bit. ⭐ SIX BODIES DID, AND
    // THIS COMMENT DIAGNOSED THE BUG BEFORE ANYONE FIXED IT: "all six are exotics (5 `crystal`,
    // 1 `shattered`) whose `metallicity` is PlanetGenerator.js:376's `|| 0` arm firing on an absent
    // `zones`." That absent `zones` was break B7, and 2154de1 gave those six their real system
    // metallicity — so the count is now ZERO. The pin STAYS, flipped: a fabricated input landing on
    // the anchor is invisible to a clamp gate, a distinctness gate and the round-trip alike.
    expect(sdfValues.filter((v) => v === 0.80).length, 'bodies sitting exactly on the D3 anchor').toBe(0);
    expect(planets.filter((pd) => pd.metallicity === 0).length).toBe(0);
    expect(planets.filter((pd) => pd.metallicity === 0).every((pd) => pd._systemSeed === undefined),
      'a body with a REAL solar metallicity appeared — the six anchor-sitters are no longer all '
      + 'the zones-less exotics and the fabrication argument above no longer holds').toBe(true);
    // ⛔ AND `_provenance` CALLS ALL SIX OF THEM 'measured', WHICH IS THE RECORD BEING WRONG.
    // Asserted rather than lamented in prose: the row exists to name fabrications, and this is the
    // one shape it structurally cannot name, because the fabrication arrives as a NUMBER. If a later
    // step teaches the generator to emit `undefined` instead of `|| 0`, this assertion reds and the
    // reader is told the hole closed rather than having to notice.
    for (const pd of planets.filter((p) => p.metallicity === 0)) {
      expect(conditionFromBody(pd)._provenance.metallicity,
        'the fabricated 0 is no longer reported as a measurement').toBe('measured');
    }

    // ⛔⛔ THE LIMIT OF EVERYTHING ABOVE, RECORDED WITH THE CONSTRUCT THAT PRODUCED IT.
    // Every shellDepthFrac number in this test is taken on the route `deriveGiantDrivers(
    // conditionFromBody(pd))` — condition straight from the adapter, `regime` UNDEFINED, no
    // `drawGiantConditions`. That is the right route for a CONTRACT gate (it isolates the adapter)
    // and it is NOT the route a rendered body takes: `giantDeckPack` classifies with `giantRegimeOf`
    // first, so a sub-neptune is scored against sdfBand [0.28, 0.44], not [0.74, 0.86]. The
    // per-regime population is measured — 204 gas-class bodies, 84 strictly interior, 110/110
    // same-system same-regime pairs sharing — and it is recorded in the Step 5e block in
    // `conditionFromBody.js`, NOT gated here. ⚠ SO A GREEN RUN OF THIS FILE IS NOT EVIDENCE ABOUT
    // THE PER-REGIME DISTRIBUTION. It is evidence that the adapter forwards and that FORM 2 reads it.
    expect(conditionFromBody(planets[0]).regime,
      'the adapter started emitting a regime — every band literal in this test is now wrong for some '
      + 'body and the closed form above is measuring the wrong anchors').toBeUndefined();

    // ── (d) THE NEGATIVE HALF: THE OTHER TWO FORMS KEEP THEIR OWN INPUTS ────────────────
    // ⛔ ISOLATED FROM STEP 4. The table above is legacy-vs-live and so mixes Step 4's `T_eq` move
    // into `internalHeat` and `dissipation`. To say anything about METALLICITY alone, the control is
    // live-vs-live with the one key withheld — same body, same T_eq, same everything else.
    let ihMoved = 0, disMoved = 0, sdfMoved = 0, disOutsideSdf = 0;
    for (const pd of planets) {
      const c = conditionFromBody(pd);
      const held = deriveGiantDrivers({ ...c, metallicity: undefined });
      const now = deriveGiantDrivers(c);
      const sm = !Object.is(held.shellDepthFrac, now.shellDepthFrac);
      const dm = !Object.is(held.dissipation, now.dissipation);
      if (!Object.is(held.internalHeat, now.internalHeat)) ihMoved++;
      if (dm) disMoved++;
      if (sm) sdfMoved++;
      if (dm && !sm) disOutsideSdf++;
    }
    expect(ihMoved, 'FORM 1 reads no enrichment term — internalHeat must be bit-identical with and '
      + 'without metallicity, on every body').toBe(0);
    expect(sdfMoved, 'metallicity ALONE, with T_eq held fixed, moves shellDepthFrac here').toBe(340);  // 343 -> 340 at 2154de1
    expect(disMoved, 'dissipation follows shellDepthFrac through FORM 3, on a SUBSET').toBe(133);  // 134 -> 133 at 2154de1
    expect(disOutsideSdf, 'dissipation moved on a body whose shellDepthFrac did not — FORM 3 has '
      + 'acquired a second path to the enrichment channel').toBe(0);
    // ⛔ AND THE CONTROL THAT MAKES THE 0 ABOVE MEAN SOMETHING. `ihMoved === 0` is only evidence if
    // this harness CAN see internalHeat move. It can — ×10 on the mass channel moves it on 60 bodies.
    //
    // ⚠⚠ AND THE CONTROL MEASURED SOMETHING THE STEP DID NOT SET OUT TO FIND, WHICH IS WHY THE
    // NUMBER IS 60 AND NOT 526. `internalHeat` IS ITSELF CLAMP-SATURATED on this route: it takes 8
    // distinct values across 526 bodies and 514 of them sit exactly on the FLOOR, IH0·0.88 =
    // 1.67·0.88 = 1.4696 (climate-e5.js:62 `  [E5_REGIME.GAS_GIANT]:   Object.freeze({ rotationRate: 1.00, radius: 1.00,  energyInput: 1.0000, internalHeat: 1.67, dissipation: 1.00, shellDepthFrac: 0.80, obliquityDeg: 3.1,  hazeMute: 0.0 }),`
    // is where the 1.67 comes from). ⛔ SO "internalHeat KEEPS ITS PER-BODY SPREAD" IS TRUE AND
    // NEARLY EMPTY, and saying only the true half would be this file's signature defect. What the
    // zero above actually establishes is that metallicity did not REACH FORM 1 — not that FORM 1 is
    // expressive. It is not, on this route, and that is a separate open question from Max's ruling.
    // (The first draft of this control used ×1.5 and read 12, which would have been "green" while
    // measuring almost nothing. It was caught by running it.)
    let ihControl = 0;
    for (const pd of planets) {
      const c = conditionFromBody(pd);
      const bumped = { ...c, surfaceGravity: c.surfaceGravity * 10 };
      if (!Object.is(deriveGiantDrivers(c).internalHeat, deriveGiantDrivers(bumped).internalHeat)) ihControl++;
    }
    expect(ihControl, 'the internalHeat comparison above cannot detect a change at all — its zero is '
      + 'a decoration').toBe(60);
    const ihValues = planets.map((pd) => deriveGiantDrivers(conditionFromBody(pd)).internalHeat);
    expect(new Set(ihValues).size, 'internalHeat\'s own spread, pinned so the sentence above cannot '
      + 'be read as "internalHeat is varied"').toBe(8);
    expect(ihValues.filter((v) => v === 1.67 * 0.88).length, 'bodies pinned at the internalHeat FLOOR')
      .toBe(514);

    // ── (c) THE PER-SYSTEM CONSEQUENCE, WHICH IS THE RULING MAX MADE, MEASURED ──────────
    // `metallicity` is drawn ONCE per system (StarSystemGenerator.js:362) and copied onto every
    // planet (PlanetGenerator.js:376), so `shellDepthFrac` — and with it the equatorial-jet SIGN —
    // stops being a per-BODY property. ⚠ THE HONEST FORM OF THIS IS NOT "it now collapses": before
    // this step it was saturated at 0.74 and ALL 111 multi-planet systems shared a value trivially.
    // After, 105 do — and the 6 that do NOT are exactly the systems carrying one of the zones-less
    // exotics above. So the sharing did not arrive with this step; what arrived is sharing that
    // MEANS something, plus six systems that now disagree for a reason that is a generator bug.
    const bySystem = new Map();
    planets.forEach((pd, i) => {
      const sys = bodyIds[i].split('#')[0];
      if (!bySystem.has(sys)) bySystem.set(sys, []);
      bySystem.get(sys).push(pd);
    });
    const multi = [...bySystem.values()].filter((xs) => xs.length >= 2);
    const sdfOf = (pd) => deriveGiantDrivers(conditionFromBody(pd)).shellDepthFrac;
    const oldSdfOf = (pd) => deriveGiantDrivers(legacyConditionFromPlanet(pd)).shellDepthFrac;
    expect(multi.length, 'systems carrying more than one planet').toBe(111);
    expect(multi.filter((xs) => new Set(xs.map(oldSdfOf)).size === 1).length,
      'BEFORE: every multi-planet system shared a shell depth, by saturation').toBe(111);
    expect(multi.filter((xs) => new Set(xs.map(sdfOf)).size === 1).length,
      'AFTER: shared by metallicity instead, on every system whose planets agree about it').toBe(111);
    // ⭐ THE SIX DISSENTERS WERE THE FABRICATION, AND 2154de1 REMOVED IT. This block used to read "…and the six
    // dissenters are the fabrication, named rather than left as a residue": six systems disagreed about
    // shellDepthFrac solely because their exotic-swapped planet carried a zones-less `metallicity === 0` (break B7).
    // With real zones all 111 agree. KEPT AS A GATE — a new dissenter means that fabrication, or one shaped like it, is back.
    const dissent = multi.filter((xs) => new Set(xs.map(sdfOf)).size > 1);
    expect(dissent.length, 'a multi-planet system disagrees about shellDepthFrac again').toBe(0);

    const gas = planets.filter((p) => GIANT_TYPES.has(p.type));
    expect(gas.length, 'the corpus must actually contain gas bodies').toBeGreaterThanOrEqual(100);
    // ⚠ 401 ≫ the gas population: `deriveGiantDrivers` is TOTAL and returns a triple for
    // every body, giant or not, so the count above is not bounded by the gas bodies and a
    // reader must not read it as "401 gas giants". Of the 340 shellDepthFrac movers, only
    // 82 are giant-typed; the other 258 are solids whose triple nothing renders.
    expect(gas.length, 'the mover count is corpus-wide, not gas-only — recorded so it is not misread')
      .toBeLessThan(401);
    expect(planets.filter((pd) => GIANT_TYPES.has(pd.type)
      && !Object.is(oldSdfOf(pd), sdfOf(pd))).length,
      'the giant-typed share of the shellDepthFrac movers').toBe(82);
  });

  it('every shipped law returns bit-identical output for the whole corpus', () => {
    // The broadest statement of "no pixel moved" this file can make without a
    // renderer: the five bakes PlanetGenerator writes and the three derivations
    // Planet.js builds per material, over every body.
    // ⛔ CONTROL FIRST — `withoutLawMovers` SUBTRACTS FROM THE COMPARED SURFACE, and a
    // subtraction that emptied it would make this whole test pass over anything. So the
    // surface that survives the filter is named, and its size pinned, before it is used.
    //
    // ⭐⭐ STEP 4 RE-BLESS, AND THE HONEST STATEMENT OF WHAT IT COST. Step 2 subtracted
    // four of the ten shipped laws and left six. Step 4 subtracts five more and leaves
    // ONE. This gate — channel 2's broadest "no pixel moved" statement — is now a
    // statement about `craters` and nothing else. That is a real narrowing and it is
    // written here rather than buried, because a reader who still believes this test
    // covers "the shipped surface" would be wrong by nine tenths.
    const surface = Object.keys(withoutLawMovers(shippedLawOutputs(conditionFromBody(planets[0])))).sort();
    expect(surface, 'the exclusion list emptied or reshaped the surface this gate compares')
      .toEqual(['craters']);

    // ⛔ NON-DEGENERACY OF WHAT IS LEFT. One key is a thin surface, and it would be
    // thinner still if that key were constant: `craterUniformsFrom` returns the frozen
    // CRATERS_OFF object for any body whose schedule does not fire, and comparing a
    // constant to itself 526 times is a gate pointed at nothing. Measured: craters are
    // LIVE on 8 bodies and the object takes 9 distinct values across the corpus. Both
    // are pinned, so if a later step turns craters off everywhere this test says so
    // instead of going quietly green.
    const craterRows = planets.map((pd) => craterUniformsFrom(conditionFromBody(pd)));
    expect(craterRows.filter((c) => (c.density ?? 0) > 0).length,
      'craters are live on too few bodies for this gate to mean anything').toBe(8);
    expect(new Set(craterRows.map((c) => JSON.stringify(c))).size,
      'the surviving surface is a constant — this gate is comparing nothing to itself').toBe(9);

    // ⛔ NON-VACUITY OF WHAT WAS SUBTRACTED. The subtraction is only safe if every name
    // taken out really does move; a name on the exclusion list that has stopped moving is
    // a hole, and it would leave this test green while the step it belongs to had silently
    // reverted. Asserted here, in the test that performs the subtraction, so the two
    // cannot drift apart. (The EXACT populations are the STEP 2/4 mover test below.)
    const subtractedThatMove = new Set();
    for (const pd of planets) {
      const was = shippedLawOutputs(legacyConditionFromPlanet(pd));
      const now = shippedLawOutputs(conditionFromBody(pd));
      for (const k of EXPECTED_LAW_MOVERS) {
        if (bitDiff(was[k], now[k], k, []).length) subtractedThatMove.add(k);
      }
    }
    expect([...subtractedThatMove].sort(), 'a law was subtracted from this gate\'s surface and then '
      + 'did not move anywhere in the corpus — that name is a hole, not an exclusion')
      .toEqual([...EXPECTED_LAW_MOVERS].sort());

    const diffs = [];
    for (let i = 0; i < planets.length && diffs.length <= 24; i++) {
      bitDiff(
        withoutLawMovers(shippedLawOutputs(legacyConditionFromPlanet(planets[i]))),
        withoutLawMovers(shippedLawOutputs(conditionFromBody(planets[i]))),
        `${planets[i].type}[${i}]`, diffs,
      );
    }
    expect(diffs, `${diffs.length} shipped law output(s) moved`).toEqual([]);
  });

  // ═══ STEP 2 · THE DECLARED MOVERS, ASSERTED TO HAVE MOVED ═════════════════════
  // ⛔ PLAN §11.3.6: "a byte-identity gate whose control never moved is
  // indistinguishable from a gate pointed at nothing". Step 2 subtracted two names
  // from channel 2 and four from the shipped-law diff; these two tests are the price
  // of that subtraction. If Step 2 were reverted — the fp literal stops forwarding
  // `d.tidalHeating` — the two tests above go GREEN and both of these go RED, which
  // is the only arrangement under which the narrowing is safe.

  it('STEP 2 · rawTidalIoRatio is the ONE condition key this step moves, and it moves off a fabrication', () => {
    // Same shape as the `magneticField` row above: named, not blanket-excused, with
    // the DIRECTION asserted so a future edit that reverts it fails here.
    let moved = 0, zeroBoth = 0;
    const ratios = [];
    for (const pd of planets) {
      const was = legacyConditionFromPlanet(pd).rawTidalIoRatio;
      const now = conditionFromBody(pd).rawTidalIoRatio;
      expect(Number.isFinite(now), `rawTidalIoRatio on a ${pd.type}`).toBe(true);
      // ⛔ THE NEW VALUE IS THE GAME'S OWN MEASUREMENT, FORWARDED — not re-derived.
      // This is the assertion that distinguishes "the number changed" from "the number
      // is now the right one", and it is the whole claim of the step.
      expect(Object.is(now, pd.tidalHeating), `${pd.type} did not receive its own tidalHeating`).toBe(true);
      if (!Object.is(was, now)) moved++;
      if (was === 0 && now === 0) zeroBoth++;
      if (was > 0 && now > 0) ratios.push(was > now ? was / now : now / was);
    }
    expect(moved, 'the declared mover did not move — Step 2 is not in the tree').toBe(469);
    expect(moved + zeroBoth).toBe(planets.length);   // the residue is fully accounted for
    // ⛔ AND THE MOVE IS NOT COSMETIC. The old value was the Io formula evaluated with
    // `starMassEarth ?? 332946` and `orbitRadiusEarth ?? 23455` — every body relocated
    // to 1 AU around a 1 M☉ star. Asserting the SIZE of the disagreement is what stops
    // a future "equivalent" refactor from re-introducing it under a tolerance.
    ratios.sort((a, b) => a - b);
    const median = ratios[Math.floor(ratios.length / 2)];
    expect(ratios.length).toBe(469);
    expect(median, 'the old and new tidal numbers agree too well to have been different quantities')
      .toBeGreaterThan(10);
    expect(Math.max(...ratios), 'the worst body should be orders out, not marginal').toBeGreaterThan(1e6);
    // The 1 M☉-at-1-AU fabrication produced a DISTINCT value per body — it is a formula
    // over the body's own eccentricity and radius, not a constant. So a distinctness
    // check could never have caught it, and this records that as a fact, not a footnote.
    const oldVals = new Set(planets.map((pd) => legacyConditionFromPlanet(pd).rawTidalIoRatio));
    expect(oldVals.size, 'the fabricated fallback was NOT a single repeated value').toBeGreaterThan(100);
  });

  it('STEP 2 + STEP 4 · exactly nine shipped law outputs move, and the tenth does not', () => {
    // The subtraction `withoutLawMovers` performs, stated as an assertion in the other
    // direction: each named key MOVES on a named population, and the count of bodies
    // touched is pinned. A future step that widens the blast radius fails here first.
    //
    // ⭐⭐ STEP 4 RE-BLESS — THE ONE MOST AT RISK OF BECOMING A SHRUG. The pre-Step-4
    // shape ("exactly four move, the other six do not") is a precise, strong, TWO-SIDED
    // claim, and the cheap way through it is `toContain` or a `>=`. It is widened here
    // and stays exact: exactly these NINE, on exactly these populations, and the tenth
    // (`craters`) pinned to zero by name. Nothing in this test is satisfiable by "more
    // things moved than we said".
    //
    // ⛔ NINE, NOT THE EIGHT THE PLAN'S UNIFORM-LEVEL DELTA IMPLIES. `palette` moves on
    // 148/526 and is named in no plan, no delta table and no ledger entry. See
    // EXPECTED_LAW_MOVER_BODIES.
    const perKey = {};
    const samples = {};
    let bodiesTouched = 0;
    const lawSurface = Object.keys(shippedLawOutputs(conditionFromBody(planets[0])));
    for (const pd of planets) {
      const a = shippedLawOutputs(legacyConditionFromPlanet(pd));
      const b = shippedLawOutputs(conditionFromBody(pd));
      let any = false;
      for (const k of lawSurface) {
        const d = bitDiff(a[k], b[k], k, []);
        if (d.length === 0) continue;
        perKey[k] = (perKey[k] || 0) + 1;
        if (!samples[k]) samples[k] = `${pd.type}: ${d[0]}`;
        any = true;
      }
      if (any) bodiesTouched++;
    }

    // ⛔ SHAPE CONTROL FIRST, same reason as the giant test: every claim below is keyed by
    // law name, so the set of names has to be pinned before it is used as an index.
    expect([...lawSurface].sort(), 'the shipped-law bundle changed shape — the populations below index a different surface')
      .toEqual(['biosphere', 'craters', 'crustTemperature', 'giant', 'iceness',
        'lavaCrustColor', 'lavaGlowColor', 'meltTemperature', 'optics', 'palette']);

    expect(planets.length).toBe(CORPUS_BODIES);
    expect(Object.keys(perKey).sort(), 'the set of moving shipped laws is not the declared nine — '
      + 'an EMPTY left side means the declared movers did not move (a step is not in the tree, and '
      + 'the byte-identity gate above is passing vacuously); a LONGER one means the blast radius grew; '
      + 'a SHORTER one means a step silently reverted\n' + Object.values(samples).join('\n'))
      .toEqual([...EXPECTED_LAW_MOVERS].sort());
    expect(perKey, 'a declared mover moved on a different number of bodies than it is pinned to')
      .toEqual({ ...EXPECTED_LAW_MOVER_BODIES });
    // ⭐ STEP 5e: 413 → 495, then → 494 at 2154de1. `giant` was the only row Step 5e touched,
    // so the 82 extra bodies are shellDepthFrac movers that were not already moving something else.
    expect(bodiesTouched, 'bodies that change what they render').toBe(494);

    // ── THE NEGATIVE HALF, KEPT ─────────────────────────────────────────────────────
    // "and the other N do not" is the half a re-bless is tempted to drop, because it is
    // the half that fails. It is asserted by NAME, not by counting: the non-movers are
    // derived from the pinned surface minus the pinned mover list, so widening the mover
    // list cannot silently empty this.
    const nonMovers = lawSurface.filter((k) => !EXPECTED_LAW_MOVERS.includes(k)).sort();
    expect(nonMovers, 'Step 4 consumed the last non-moving shipped law — if this is EMPTY the '
      + 'negative half of this gate no longer exists and the test must be reshaped, not re-blessed')
      .toEqual(['craters']);
    for (const k of nonMovers) {
      expect(perKey[k] ?? 0, `${k} is declared not to move and it moved`).toBe(0);
    }

    // ── SUB-FIELD BREAKDOWN OF THE TWO BROADEST NEW MOVERS ──────────────────────────
    // `optics` and `palette` are OBJECTS, so "optics moved on 193 bodies" is compatible
    // with wildly different blast radii inside it — one channel moving on 193, or all
    // seven. The shipped uniforms are the sub-fields, not the bundle, so the sub-fields
    // are where the claim has to be pinned. ⚠ `optics.columnFraction` does not move and
    // is pinned to zero: it is the negative control INSIDE the widest new mover.
    const subPop = (fn) => {
      const out = {};
      const seen = new Set();
      for (const pd of planets) {
        const a = fn(legacyConditionFromPlanet(pd));
        const b = fn(conditionFromBody(pd));
        for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
          seen.add(k);
          if (bitDiff(a[k], b[k], k, []).length) out[k] = (out[k] || 0) + 1;
        }
      }
      return { out, seen: [...seen].sort() };
    };

    const optics = subPop(atmosphereOpticsOf);
    expect(optics.seen, 'the optics bundle changed shape').toEqual(['columnFraction', 'hazeFraction',
      'limbColor', 'limbExponent', 'primordialFraction', 'termColor', 'thickHaze']);
    expect(optics.out, 'the optics sub-field blast radius is not the declared one').toEqual({
      limbColor: 194, termColor: 194, limbExponent: 184, thickHaze: 184, hazeFraction: 174, primordialFraction: 27,
    });
    expect(optics.out.columnFraction ?? 0, 'columnFraction is the negative control inside optics').toBe(0);

    const palette = subPop(surfacePaletteOf);
    expect(palette.seen, 'the palette bundle changed shape').toEqual(['craton', 'fresh', 'sediment', 'weathered']);
    expect(palette.out, 'the UNDECLARED palette family — pinned by sub-field so it cannot widen quietly')
      .toEqual({ craton: 141, weathered: 129, sediment: 129, fresh: 16 });  // weathered/sediment 128 -> 129 at 2154de1

    // ⚠ TWO OF THE FOUR STEP-2 MOVERS ARE BAKES `PlanetGenerator` WRITES ONTO THE BODY
    // RECORD (`lavaGlowColor`, `lavaCrustColor`), so that step reaches the shipped
    // uniforms through the bake route as well as the material route. That is expected and
    // declared; it is Instrument C's committed delta table that measures it.
    expect(EXPECTED_LAW_MOVERS).toContain('lavaGlowColor');
    expect(EXPECTED_LAW_MOVERS).toContain('lavaCrustColor');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// STEP 4 · THE NO-SURFACE GUARD'S **DOMAIN** — WHICH BODIES, NOT HOW MANY
//
// ⛔ WHY THIS BLOCK EXISTS, AND WHAT IT IS REPAIRING. Step 4's re-bless pinned the
// guard with four assertions and ALL FOUR ARE COUNTS OR CORPUS-WIDE PROPERTIES:
//   · `movedOn.T_eq === 205`                       — a count
//   · `rawOnMovers === 205`                        — "whoever moved got the raw number"
//   · `strictlyDown === 205`                       — "whoever moved got a smaller number"
//   · `greenhouseOnRest === 322`                   — "whoever did not move got the cooked one"
// Not one of them names a BODY, and Step 4's entire claim is *which* bodies have no
// surface. The last three look two-sided and are not: MEASURED, all 526 corpus bodies
// carry pressure > 0 (min 0.3086 bar, `pcc-35#4`; was 0.1133/`pcc-59#1` before 2154de1), so it is strictly
// warming on every one of them and "moved to the raw number, strictly downward" is
// satisfied by ANY 205-body subset of the corpus. The four assertions together pin a
// CARDINALITY, and the guard's domain is a SET.
//
// ⚠ THIS IS A RE-BLESS-INDUCED WEAKENING, NOT A PRE-EXISTING HOLE. Before Step 4 the
// membership was pinned trivially and absolutely — `T_eq` moved on the EMPTY set, and any
// body entering the domain reddened `movedOn`. The re-bless traded an exact (if trivial)
// membership pin for a count. That trade is what these two tests buy back.
//
// ⚠⚠ MEASURED COST OF THE HOLE, so nobody has to take the paragraph above on faith. A
// two-body permutation of the domain — drop `pcc-2#2` (rocky, raw T_eq 184.60965 K, which
// then wrongly receives a 147.90 K greenhouse correction) and adopt `pcc-0#2` (rocky, which
// then wrongly loses its 8.34 K correction) — preserves EVERY pinned count in this file
// exactly, leaves the whole 17-file suite green, and prints a BYTE-IDENTICAL verdict block
// from `node tools/port-uniform-delta.mjs --check`. A search over the corpus finds **1387**
// such count-preserving two-body permutations. The domain was, in effect, unpinned.
//
// ── THE TWO HALVES, AND WHY NEITHER ALONE CLOSES IT ─────────────────────────────────
//  1. PREDICATE CORRESPONDENCE (two-sided, per body, by id). For all 526 bodies: the
//     body's `T_eq` moved IF AND ONLY IF the no-surface predicate says it should.
//     `noSurfaceOf` is deliberately NOT exported (see conditionFromPlanet.js:149-155 —
//     exporting it would red this file's own module-export-list pin), so the predicate is
//     RECOMPUTED here from the same shim the adapter builds.
//     ⛔ AND THAT IS EXACTLY WHY IT IS NOT ENOUGH. Ledger C10: *a control derived from its
//     subject by one substitution is a control against ARITHMETIC drift, never against
//     EXTRACTION drift.* Recomputing the predicate echoes the implementation; if someone
//     changes what "no surface" MEANS, the echo changes with it and this half stays green.
//  2. A HAND-WRITTEN CANARY TABLE that shares no code with the tree — twelve bodies named
//     by literal `seed#ordinal`, six asserted IN and six OUT, each carrying the MEASURED
//     properties that made it a straddler. Those literals are the independent oracle. They
//     are read from the raw `planetData` record and from `conditionFromBody`'s output
//     only: no `atmosphereFromPlanet`, no `densityToGramsPerCC`, no `surfaceTemperatureOf`,
//     no `compositionClass`. Nothing in half 2 can move because half 1's helpers moved.
// ═════════════════════════════════════════════════════════════════════════════

/**
 * The no-surface predicate, RECOMPUTED. Mirrors conditionFromPlanet.js:671-684 line for
 * line: the flattened atmosphere, the three/four-key composition with the kg/m³→g/cc
 * conversion, and the three-key shim `{ atmosphere, composition, density }` handed to
 * `compositionClass`.
 *
 * ⚠ THIS IS AN ECHO AND IS LABELLED ONE. It re-uses the adapter's own exported helpers, so
 * it is a control against the guard being MIS-APPLIED (right rule, wrong bodies) and not
 * against the rule itself being redefined. The canary table below is the half that survives
 * a redefinition.
 */
function noSurfacePredicateOf(planetData) {
  const d = planetData || {};
  const comp = d.composition || {};
  const atmosphere = atmosphereFromPlanet(d.atmosphere);
  const composition = {
    ironFraction:     comp.ironFraction ?? 0.32,
    density:          densityToGramsPerCC(comp.density),
    volatileFraction: comp.volatileFraction ?? 0.15,
    ...(comp.carbonToOxygen != null ? { carbonToOxygen: comp.carbonToOxygen } : {}),
  };
  return compositionClass({ atmosphere, composition, density: composition.density ?? 5.5 }) === 'gas';
}

/** The game's own bare radiative number, read straight off the record. */
const rawTeqOf = (pd) => pd?.T_eq ?? 288;
/** What the greenhouse column would make of it — the value a body OUTSIDE the domain gets. */
const cookedTeqOf = (pd) => surfaceTemperatureOf(rawTeqOf(pd), atmosphereFromPlanet(pd?.atmosphere)?.pressure);

/**
 * ⭐ THE INDEPENDENT ORACLE. Twelve bodies, by literal `seed#ordinal`, hand-picked to
 * STRADDLE the classification boundary along every axis a reader might mistake for the
 * discriminator.
 *
 * ⛔ HOW THESE WERE CHOSEN, because "how" is the whole claim to independence. Each row was
 * picked by INSPECTING THE BODY'S MEASURED PROPERTIES — `planetData.type`,
 * `atmosphere.physics.composition`, `atmosphere.physics.pressure`, `composition.density`,
 * `T_eq` — and then WRITING DOWN the classification those properties demand. Not one row
 * was selected by asking the predicate, or the adapter, what it currently answers. The
 * physical rule being asserted is stated once, here, in English:
 *
 *     A body has no surface when its envelope is HYDROGEN-HELIUM. There is no ground for a
 *     pressure column to stand on, so the quoted `pressure` is an envelope DEPTH (generated
 *     giants quote 1000 bar) and the grey-greenhouse fit — solved on Earth's 1 bar and
 *     Venus's 92 — does not apply. Everything else, however thick, however thin, however
 *     hot, however light, HAS a surface and gets the correction.
 *
 * ⛔ AND THE `props` COLUMN IS A FENCE, NOT DECORATION. Every row asserts its measured
 * properties BEFORE it asserts its classification. A future editor who swaps an id (or a
 * generation change that re-shuffles ordinals) reds on the property row and is told the
 * FIXTURE moved — instead of silently re-pointing the oracle at a body that happens to
 * agree. `seed#ordinal` is a position in the corpus; the properties are the body.
 *
 * ⚠ MEASURED. `pressure` in bar, `density` in the GAME'S OWN kg/m³ (read from
 * `planetData.composition.density` with no conversion, so this table cannot be moved by an
 * edit to `densityToGramsPerCC`), `rawTeq` = `planetData.T_eq`, `gapK` = the greenhouse
 * correction at stake on that body — the number an IN body must NOT receive and an OUT body
 * MUST.
 */
const NO_SURFACE_CANARIES = Object.freeze([
  // ── IN: the guard fires. `condition.T_eq` must be the body's own raw radiative number. ──
  {
    id: 'pcc-2#4', expect: 'IN', gapK: 449.91,
    props: { type: 'gas-giant', composition: 'h2-he', pressure: 1000, density: 1939.9114475714557, rawTeq: 86.39812436249863 },
    why: 'THE ARCHETYPE. An h2-he giant quoting 1000 bar — an envelope depth, not a surface load. '
       + 'Handed to a fit anchored on 1 bar and 92 bar it manufactures a 449.91 K correction on an '
       + '86 K body. If any single body must be inside the domain, it is this one.',
  },
  {
    id: 'pcc-2#2', expect: 'IN', gapK: 147.90,
    props: { type: 'rocky', composition: 'h2-he', pressure: 11.203818899840723, density: 4377.237472142501, rawTeq: 184.60965032275448 },
    why: 'STRADDLER — TYPE SAYS ROCKY AND DENSITY SAYS ROCKY, AND BOTH ARE IRRELEVANT. '
       + '`planetData.type === "rocky"` and 4377 kg/m³ is the densest ROCKY-typed body in the h2-he population (next is 2339) — ⚠ NOT the densest h2-he body overall: it is rank 22 of 205, and `pcc-1#6` four rows below records 4675.87. Corrected 2026-08-09 after the claim was measured and failed; the straddler point it was written to make survives intact — '
       + 'yet the envelope is hydrogen, so there is no ground. Pinning this row is what stops the '
       + 'guard being "fixed" to key on `type` or on density. (It is also the body the measured '
       + 'count-preserving permutation above DROPS.)',
  },
  {
    id: 'pcc-47#4', expect: 'IN', gapK: 61.91,
    props: { type: 'ice', composition: 'h2-he', pressure: 10.313674220964193, density: 1721.325431958318, rawTeq: 81.06096494183693 },
    why: 'THE THINNEST h2-he ENVELOPE IN THE CORPUS, 10.31 bar. Read against `pcc-0#1` below — a '
       + '90 bar body that is OUT — this row is the proof that the discriminator is NOT a pressure '
       + 'threshold: 10.31 bar is inside the domain and 90 bar is outside it.',
  },
  {
    id: 'pcc-40#0', expect: 'IN', gapK: 325.79,
    props: { type: 'lava', composition: 'h2-he', pressure: 13.392195016138459, density: 4070.3233052222827, rawTeq: 367.91404669984087 },
    why: 'THE ONLY `lava`-TYPED BODY IN THE DOMAIN, at 367.9 K. ⚠ It is NOT the hottest — that is `pcc-81#0` at 438.65 K, this one is rank 8 of 205; corrected 2026-08-09 after measurement. The type uniqueness is the real reason to pin it: a guard rewritten around molten-surface heuristics reds here. Read against `pcc-59#1` below '
       + '(271.8 K and OUT) it shows the boundary is not a temperature ordering either.',
  },
  {
    id: 'pcc-1#6', expect: 'IN', gapK: 295.00,
    props: { type: 'sub-neptune', composition: 'h2-he', pressure: 50, density: 4675.871371298277, rawTeq: 174.81721707804073 },
    why: 'THE MIDDLE ENVELOPE PRESSURE, 50 bar — between the 10 bar of `pcc-47#4` and the 1000 bar '
       + 'of `pcc-2#4` — and the largest IN population (sub-neptunes, 95 of the 205). A guard that '
       + 'fired only at the extremes of the pressure range would still red here.',
  },
  {
    id: 'pcc-48#4', expect: 'IN', gapK: 36.27,
    props: { type: 'rocky', composition: 'h2-he', pressure: 10.444295905101825, density: 1416.2507688386422, rawTeq: 47.140519934226035 },
    why: 'A NEAR-LOWEST-DENSITY BODY IN THE DOMAIN, 1416 kg/m³ (rank 2 of 205; `pcc-7#5` is lower at 1408.71 — ⚠ this row claimed rank 1 until measured 2026-08-09) — which on the density smoothstep alone '
       + 'would read `icy`, not `gas`. Its partner is `pcc-98#3` below at 1461 kg/m³, 3.2% denser and '
       + 'OUT. Two bodies that agree on density to within 3% and classify OPPOSITELY: density cannot '
       + 'be the discriminator, and this pair is the assertion that says so.',
  },

  // ── OUT: the guard does not fire. `condition.T_eq` must carry the greenhouse column. ──
  {
    id: 'pcc-0#1', expect: 'OUT', gapK: 599.55, minGapK: 590,
    props: { type: 'venus', composition: 'co2', pressure: 90, density: 4112.043391887816, rawTeq: 277.2143692464735 },
    why: 'THE THICK-ATMOSPHERE ROCKY. 90 bar of CO₂ — 8.7× the pressure of the thinnest body INSIDE '
       + 'the domain — and it keeps its 599.55 K correction, because a Venus is the body the fit was '
       + 'solved on. This is the row that makes "no surface" mean no surface rather than "a lot of gas".',
  },
  {
    id: 'pcc-59#1', expect: 'OUT', gapK: 11.23, minGapK: 11,
    props: { type: 'crystal', composition: 'n2-o2', pressure: 0.32127303878953367, density: 4297.90275918853, rawTeq: 271.75996551323794 },
    why: 'A THIN-AIR CRYSTAL BODY THAT KEEPS ITS GROUND — 0.3213 bar of N₂-O₂, correction 11.23 K. '
       + '⛔ RE-MEASURED AT 2154de1 (break B7). This row used to read "0.1133 bar, the minimum over all 526" and "the HOTTEST body in the corpus at 607.7 K"; BOTH superlatives were artefacts of the exotic-swap defect, which derived this planet as if it orbited the Sun. It now holds neither — the minimum pressure is `pcc-35#4` at 0.3086 bar and the hottest body is `pcc-57#0` at 461.41 K. '
       + 'The row is KEPT because its classification never depended on either superlative: a thin '
       + 'atmosphere is still an atmosphere standing on ground, so a small correction must still '
       + 'arrive, and that is what OUT means here.',
  },
  {
    id: 'pcc-0#2', expect: 'OUT', gapK: 8.34, minGapK: 8.3,
    props: { type: 'rocky', composition: 'n2-o2', pressure: 0.3293951843808789, density: 4203.717273535055, rawTeq: 196.62865297240302 },
    why: 'THE ORDINARY THIN-AIR ROCKY, 0.33 bar of N₂-O₂ — the corpus\'s most common shape (180 of '
       + '526) and the body the measured count-preserving permutation ADOPTS. Its 8.34 K correction is '
       + 'small, which is exactly why losing it hides so well.',
  },
  {
    id: 'pcc-98#3', expect: 'OUT', gapK: 2.42, minGapK: 2.4,
    props: { type: 'rocky', composition: 'n2-o2', pressure: 0.31045654822477825, density: 1461.0320908561391, rawTeq: 60.664516855913725 },
    why: 'THE DENSITY COUNTEREXAMPLE, partner to `pcc-48#4`. 1461 kg/m³ against that body\'s 1416 — '
       + 'and this one is OUT. It carries the SMALLEST correction of any canary (2.42 K), so it is '
       + 'also the row that would notice a guard that swallowed the near-invisible cases.',
  },
  {
    id: 'pcc-8#2', expect: 'OUT', gapK: 35.41, minGapK: 35,
    props: { type: 'ice', composition: 'n2-o2', pressure: 1.701013784013877, density: 4487.663492676555, rawTeq: 168.50328916063657 },
    why: 'THE TYPE COUNTEREXAMPLE, partner to `pcc-47#4`. Both are `type: "ice"`; that one is IN and '
       + 'this one is OUT. `planetData.type` does not decide this and this pair is the proof.',
  },
  {
    id: 'pcc-32#2', expect: 'OUT', gapK: 128.30, minGapK: 128,
    props: { type: 'ocean', composition: 'n2-o2', pressure: 6.163584474813617, density: 4390.1150570821155, rawTeq: 230.66726502067405 },
    why: 'A NEAR-APPROACH ON THE PRESSURE AXIS FROM BELOW — 6.16 bar, the second-highest-pressure (`pcc-33#1` is 6.202; ⚠ this row claimed highest until measured 2026-08-09) '
       + 'non-h2-he body short of the Venuses, sitting just under the 10.31 bar of the thinnest IN '
       + 'body. If the boundary ever became a pressure cut, it would have to fall in this 6.16 … 10.31 '
       + 'bar gap, and this row plus `pcc-47#4` bracket it from both sides.',
  },
]);

describe('Step 4 · the no-surface guard\'s DOMAIN — which bodies, not how many', () => {
  it('HALF 1 · every body\'s T_eq moves IF AND ONLY IF the no-surface predicate classifies it — per body, named by id', () => {
    // ⛔ NON-DEGENERACY FIRST, because the iff below is only a statement about the domain on
    // bodies where the two branches DISAGREE. On a body with pressure 0 the greenhouse factor
    // is exactly 1 (`surfaceTemperatureOf`: tau = 0.84·0^1.124 = 0), so IN and OUT produce the
    // SAME number and the classification is unobservable at this seam. MEASURED: that happens
    // on 0 of 526 bodies. If it ever stops being 0, this test has quietly become partial on
    // those bodies and the reader is told so here rather than discovering it later.
    const unobservable = [];
    for (let i = 0; i < planets.length; i++) {
      if (Object.is(rawTeqOf(planets[i]), cookedTeqOf(planets[i]))) unobservable.push(bodyIds[i]);
    }
    expect(planets.length, 'the corpus resized — every pinned population in this file is now stale')
      .toBe(CORPUS_BODIES);
    expect(unobservable, 'bodies whose greenhouse correction is exactly zero: on these the guard\'s '
      + 'classification produces no observable difference, so the correspondence below says NOTHING '
      + 'about them. Measured at 0; a non-empty list means this gate is now partial.')
      .toEqual([]);

    // ── THE CORRESPONDENCE, BOTH DIRECTIONS, ONE BODY AT A TIME ─────────────────────────
    // `deniedCorrection`  — the predicate says NO SURFACE and the body was cooked anyway.
    // `fabricatedSurface` — the predicate says it HAS a surface and its greenhouse was dropped.
    // A count-preserving permutation of the domain necessarily produces one of each, so it
    // cannot pass through this loop the way it passes through a population table.
    const deniedCorrection = [];
    const fabricatedSurface = [];
    let classifiedNoSurface = 0;
    for (let i = 0; i < planets.length; i++) {
      const pd = planets[i];
      const id = bodyIds[i];
      const raw = rawTeqOf(pd);
      const cooked = cookedTeqOf(pd);
      const got = conditionFromBody(pd).T_eq;
      if (noSurfacePredicateOf(pd)) {
        classifiedNoSurface++;
        if (!Object.is(got, raw)) {
          deniedCorrection.push(`${id} (${pd.type}): classified NO-SURFACE but T_eq = ${got} — `
            + `expected the raw ${raw}, i.e. it wrongly received a ${(cooked - raw).toFixed(2)} K greenhouse`);
        }
      } else if (!Object.is(got, cooked)) {
        fabricatedSurface.push(`${id} (${pd.type}): classified HAS-SURFACE but T_eq = ${got} — `
          + `expected the greenhouse-corrected ${cooked}, i.e. it wrongly lost a ${(cooked - raw).toFixed(2)} K correction`);
      }
    }

    expect(deniedCorrection, 'a body the no-surface predicate classifies as having NO surface was '
      + 'given a greenhouse correction anyway — the guard\'s domain and the guard\'s effect have come '
      + `apart:\n${deniedCorrection.join('\n')}`).toEqual([]);
    expect(fabricatedSurface, 'a body the no-surface predicate classifies as HAVING a surface lost its '
      + 'greenhouse correction — the guard fired outside its own domain:\n'
      + fabricatedSurface.join('\n')).toEqual([]);

    // The population, tied to the same table the count-based gate uses, so the two can never
    // disagree about how big the domain is while agreeing about who is in it.
    expect(classifiedNoSurface, 'the predicate\'s own population is not the declared T_eq mover count')
      .toBe(EXPECTED_CONDITION_MOVERS.T_eq);
  });

  it('HALF 2 · twelve named bodies are classified as their MEASURED properties demand — literals, no shared code with the tree', () => {
    // ⛔ THIS TEST TOUCHES NO TREE HELPER. It reads `planetData` fields and
    // `conditionFromBody(...).T_eq`, and compares them to numbers typed into the table
    // above. `atmosphereFromPlanet`, `densityToGramsPerCC`, `surfaceTemperatureOf` and
    // `compositionClass` are all absent on purpose: half 1 is an echo of the implementation
    // (ledger C10) and an echo cannot catch a redefinition of the rule. This half can.
    const seen = new Set();
    for (const row of NO_SURFACE_CANARIES) {
      const i = bodyIds.indexOf(row.id);
      expect(i, `${row.id} is not in the corpus — generation moved and this canary has no body`)
        .toBeGreaterThanOrEqual(0);
      expect(seen.has(row.id), `${row.id} is listed twice`).toBe(false);
      seen.add(row.id);
      const pd = planets[i];

      // ── FIXTURE IDENTITY. The properties are the body; the id is only its address. ──
      const phys = pd.atmosphere?.physics;
      expect(phys, `${row.id} lost its atmosphere.physics block`).toBeTruthy();
      expect(pd.type, `${row.id} type`).toBe(row.props.type);
      expect(phys.composition, `${row.id} envelope composition`).toBe(row.props.composition);
      expect(phys.pressure, `${row.id} pressure (bar)`).toBeCloseTo(row.props.pressure, 9);
      expect(pd.composition?.density, `${row.id} density (kg/m³, the game's own unit)`)
        .toBeCloseTo(row.props.density, 9);
      expect(pd.T_eq, `${row.id} raw T_eq`).toBeCloseTo(row.props.rawTeq, 9);

      // ── THE CLASSIFICATION, THROUGH THE SHIPPED SEAM AND NOTHING ELSE. ──
      const got = conditionFromBody(pd).T_eq;
      if (row.expect === 'IN') {
        expect(Object.is(got, pd.T_eq), `${row.id} (${row.props.type}, ${row.props.composition} at `
          + `${row.props.pressure} bar) MUST be inside the no-surface domain and keep its own raw `
          + `T_eq. It received ${got} instead of ${pd.T_eq} — a fabricated greenhouse of about `
          + `${row.gapK} K on a body with no ground.\nWHY THIS BODY: ${row.why}`).toBe(true);
      } else {
        expect(got, `${row.id} (${row.props.type}, ${row.props.composition} at ${row.props.pressure} `
          + `bar) MUST be OUTSIDE the no-surface domain and receive its greenhouse column of about `
          + `${row.gapK} K. It got ${got} against a raw ${pd.T_eq}.\nWHY THIS BODY: ${row.why}`)
          .toBeGreaterThan(pd.T_eq + row.minGapK);
      }
    }
    expect(seen.size, 'the canary table shrank — a straddler was deleted rather than answered').toBe(12);
    expect(NO_SURFACE_CANARIES.filter((r) => r.expect === 'IN').length).toBe(6);
    expect(NO_SURFACE_CANARIES.filter((r) => r.expect === 'OUT').length).toBe(6);
  });

  it('HALF 2 · the canary pairs are genuine counterexamples — type, density and pressure each FAIL to separate IN from OUT', () => {
    // The table's straddling claim, asserted rather than described. Each pair is two bodies
    // that classify OPPOSITELY while agreeing on the axis named — so a red here says which
    // wrong discriminator someone reached for.
    const at = (id) => {
      const i = bodyIds.indexOf(id);
      expect(i, `${id} missing from the corpus`).toBeGreaterThanOrEqual(0);
      const pd = planets[i];
      return { pd, inDomain: Object.is(conditionFromBody(pd).T_eq, pd.T_eq) };
    };

    // TYPE is not the discriminator: two `rocky` bodies, and two `ice` bodies, split.
    for (const [a, b, axis] of [['pcc-2#2', 'pcc-0#2', 'rocky'], ['pcc-47#4', 'pcc-8#2', 'ice']]) {
      const A = at(a); const B = at(b);
      expect(A.pd.type, `${a} type`).toBe(axis);
      expect(B.pd.type, `${b} type`).toBe(axis);
      expect(A.inDomain, `${a} must be IN`).toBe(true);
      expect(B.inDomain, `${b} must be OUT`).toBe(false);
    }

    // DENSITY is not the discriminator: 1416 kg/m³ is IN, 1461 kg/m³ is OUT — 3.2% apart.
    const light = at('pcc-48#4'); const lighter = at('pcc-98#3');
    expect(Math.abs(light.pd.composition.density / lighter.pd.composition.density - 1),
      'the density counterexample pair drifted apart — it no longer shows density failing to separate '
      + 'the two classes').toBeLessThan(0.05);
    expect(light.inDomain, 'pcc-48#4 (1416 kg/m³, h2-he) must be IN').toBe(true);
    expect(lighter.inDomain, 'pcc-98#3 (1461 kg/m³, n2-o2) must be OUT').toBe(false);

    // PRESSURE is not the discriminator, and the failure is in BOTH directions: the OUT body
    // carries 8.7× the pressure of the IN body.
    const thinGas = at('pcc-47#4'); const thickRock = at('pcc-0#1');
    expect(thickRock.pd.atmosphere.physics.pressure)
      .toBeGreaterThan(thinGas.pd.atmosphere.physics.pressure * 5);
    expect(thinGas.inDomain, 'pcc-47#4 (10.31 bar, h2-he) must be IN').toBe(true);
    expect(thickRock.inDomain, 'pcc-0#1 (90 bar, co2) must be OUT').toBe(false);

    // TEMPERATURE is not the discriminator: the hottest OUT body (461.41 K, `pcc-57#0`) is hotter
    // than every IN body (max IN 438.65 K), and this IN body at 47.1 K is colder than every OUT body.
    // ⚠ 47.1 K is NOT the coldest IN body — that is pcc-89#4 at 38.17 K, this one is rank 6 of 205.
    // The sentence said "the coldest" until it was measured 2026-08-09. The ASSERTION below never
    // depended on the superlative, only on the ordering, which is why it held while the prose did not.
    const hotOut = at('pcc-59#1'); const coldIn = at('pcc-48#4');
    expect(hotOut.pd.T_eq).toBeGreaterThan(coldIn.pd.T_eq);
    expect(hotOut.inDomain, 'pcc-59#1 (271.8 K, n2-o2) must be OUT').toBe(false);
    expect(coldIn.inDomain, 'pcc-48#4 (47.1 K, h2-he) must be IN').toBe(true);
  });

  it('CONTROL · the two classifier branches this corpus does NOT exercise, pinned so their arrival is announced', () => {
    // ⛔ THE HONEST STATEMENT OF WHAT THE TABLE ABOVE CANNOT COVER. `compositionClass` has
    // three ways out — the h2-he envelope (⇒ gas), a C/O ratio above 1 (⇒ carbon) and the
    // density smoothstep (⇒ icy | rocky). The canaries exercise the first and the third.
    // They cannot exercise the second, and they cannot exercise a genuinely airless body,
    // because THIS CORPUS CONTAINS NEITHER. Measured, and asserted here so that the day one
    // appears the suite says "add a canary row" instead of staying green over a case nobody
    // ever looked at.
    const airless = planets.filter((pd) => pd.atmosphere == null);
    expect(airless.length, 'an AIRLESS planet has appeared in the corpus. The canary table has no row '
      + 'for one, and it needs a hand-written answer: an airless body has pressure 0, the greenhouse '
      + 'factor is exactly 1, and IN vs OUT therefore produce the SAME T_eq — so its classification is '
      + 'NOT observable through this seam and must be pinned some other way.').toBe(0);

    const carbonWorlds = planets.filter((pd) => (pd.composition?.carbonToOxygen ?? 0) > 1);
    expect(carbonWorlds.length, 'a C/O > 1 body has appeared in the corpus. e1Regime.js:68 returns '
      + '"carbon" for it BEFORE the density smoothstep and AFTER the h2-he test, so it is a third '
      + 'branch of the classifier with no canary row. Add one, both with and without an h2-he '
      + 'envelope — the ordering of those two tests is the behaviour at stake.').toBe(0);

    // And the fact the whole two-sided read rests on: every body in this corpus has a real,
    // strictly-warming greenhouse column, so "moved downward to the raw number" is satisfiable
    // by ANY subset and cannot pin membership on its own. That is the hole these tests close;
    // it is asserted rather than argued.
    expect(planets.filter((pd) => (pd.atmosphere?.physics?.pressure ?? 0) > 0).length,
      'not every body carries positive pressure any more — the argument for why the COUNT-based '
      + 'assertions were insufficient has changed, and this block\'s framing needs re-reading')
      .toBe(CORPUS_BODIES);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// CHANNEL 2b — THE VECTOR ITSELF, FROZEN AGAINST LITERAL NUMBERS
//
// ⛔ WHAT THIS BLOCK ASSERTS THAT CHANNEL 2 CANNOT. Channel 2 compares two
// derivations of the same body. Until the review it compared them through ONE
// shared vector, so a vector-side edit cancelled; it now runs a frozen copy, but
// that copy still calls the live baseStep helpers, so an edit one level further
// down would cancel again. This block compares the LIVE vector against numbers
// that were typed into this file. There is nothing for a regression to cancel
// with, at any depth.
// ═════════════════════════════════════════════════════════════════════════════
describe('Step 1 · channel 2b — the condition vector against a hardcoded golden', () => {
  it('CONTROL — the golden is non-degenerate: every pinned key varies across the fixtures', () => {
    // ⛔ READ THIS BEFORE TRUSTING THE GOLDEN BELOW. A golden that records the
    // same value on every fixture pins nothing: a law that multiplies it, zeroes
    // it or clamps it lands back on the recorded value and the golden stays
    // green. That is not hypothetical here — the first cut of this table
    // recorded `shellThickness: 0` on 5 of 7 fixtures (the fps carried `age` but
    // not `ageNorm`, and `baseStep.js:40` drove the clamp to its floor), which
    // would have been GREEN under the exact `* 2` injection that motivated the
    // fence. So the spread is asserted before the values are.
    const keys = Object.keys(Object.values(PRE_STEP1_VECTOR_GOLDEN)[0].condition);
    const rows = Object.values(PRE_STEP1_VECTOR_GOLDEN).map((g) => g.condition);
    for (const k of keys) {
      const distinct = new Set(rows.map((r) => String(r[k])));
      expect(distinct.size, `golden key ${k} takes only the value ${[...distinct][0]} on all ${rows.length} fixtures`)
        .toBeGreaterThan(1);
    }
    expect(rows.length).toBeGreaterThanOrEqual(7);
  });

  it('the LIVE vector still returns the pre-Step-1 numbers, bit-for-bit', () => {
    // MEASURED BLINDNESS THIS CLOSES: `shellThickness: bodyShellThickness(fp)`
    // → `… * 2` inside body-condition-vector.js left ALL 47 tests in this file
    // GREEN before this block existed, because every comparison in it ran both
    // sides through that same line.
    const diffs = [];
    for (const [name, g] of Object.entries(PRE_STEP1_VECTOR_GOLDEN)) {
      const live = deriveConditionVector(g.fp, null, g.drawnRadius);
      for (const [k, want] of Object.entries(g.condition)) {
        if (!Object.is(live[k], want)) diffs.push(`${name}.${k}: golden ${want} → live ${live[k]}`);
      }
    }
    expect(diffs, `${diffs.length} pre-Step-1 vector value(s) moved:\n${diffs.join('\n')}`).toEqual([]);
  });

  it('the frozen copy and the live vector agree on the pre-Step-1 keys for these fixtures', () => {
    // Ties the two fences together: if this fails while the golden passes, the
    // FROZEN COPY has rotted (someone edited it), not the live vector. Naming
    // which of the two moved is the whole point of running both.
    for (const [name, g] of Object.entries(PRE_STEP1_VECTOR_GOLDEN)) {
      const frozen = legacyDeriveConditionVector(g.fp, null, g.drawnRadius);
      const live = deriveConditionVector(g.fp, null, g.drawnRadius);
      for (const k of PRE_STEP1_KEYS) {
        expect(bitDiff(frozen[k], live[k], `${name}.${k}`, []), `${name}.${k}`).toEqual([]);
      }
    }
  });
});

describe('Step 1 · channel 3 — no law reads any of the new keys', () => {
  it('deleting each new key leaves all eight shipped laws bit-identical', () => {
    // The forward-looking half of the gate. Channel 2 says the old numbers did
    // not move TODAY; this says the new keys are genuinely inert, so a later step
    // that starts reading one cannot do it accidentally — it has to come here and
    // move the key out of STEP1_KEYS, which is a decision with a name on it.
    const sample = planets.filter((_, i) => i % 4 === 0).slice(0, 140);
    const diffs = [];
    for (const pd of sample) {
      const cond = conditionFromBody(pd);
      const base = shippedLawOutputs(cond);
      for (const k of STEP1_KEYS) {
        const stripped = { ...cond };
        delete stripped[k];
        bitDiff(base, shippedLawOutputs(stripped), `${pd.type} without ${k}`, diffs);
        if (diffs.length > 24) break;
      }
      if (diffs.length > 24) break;
    }
    expect(diffs, `a shipped law reads a Step-1 key: ${diffs.slice(0, 5).join(' | ')}`).toEqual([]);
  });

  it('the same holds on the LAB route, where the presets actually populate the new keys', () => {
    // On the game route `habitability` and `axialTiltDeg` are populated too, but
    // the LAB presets carry hand-authored values (driver-presets.js:27 habitability
    // 0.7, :109 axialTilt 25) — so the lab is where a law reading a new key would
    // produce the biggest, most obviously-wrong swing, and therefore where the
    // absence of a reader is worth the most.
    const diffs = [];
    for (const [name, fp] of Object.entries(DRIVER_PRESETS)) {
      const cond = deriveConditionVector(fp, null, fp.radiusEarth);
      const base = shippedLawOutputs(cond);
      for (const k of STEP1_KEYS) {
        const stripped = { ...cond };
        delete stripped[k];
        bitDiff(base, shippedLawOutputs(stripped), `${name} without ${k}`, diffs);
      }
    }
    expect(diffs, `a shipped law reads a Step-1 key on the lab route`).toEqual([]);
  });
});

describe('Step 1 · surfaceHistory is emitted at last', () => {
  it('was ALWAYS handed in, and now comes out the other side', () => {
    // PLAN.md:176 / §2: "surfaceHistory goes in and is not emitted — the loss is
    // in the vector, not the adapter."
    //
    // ⚠ THE FROZEN ADAPTER CANNOT DEMONSTRATE THE OLD DROP, and that is itself
    // the evidence for where the bug was. `legacyConditionFromPlanet` calls the
    // LIVE `deriveConditionVector`, so it now returns `surfaceHistory` too — the
    // pre-Step-1 fp was never the problem. What is asserted instead is the two
    // halves of the plan's sentence: the frozen fp carries it (it goes in), and
    // the live condition carries it (it comes out), as the SAME object both
    // times, so nothing along the way copied or defaulted it.
    for (const pd of planets) {
      expect(legacyFpFromPlanet(pd).surfaceHistory, 'the pre-Step-1 fp already had it')
        .toBe(pd.surfaceHistory);
      expect(conditionFromBody(pd).surfaceHistory).toBe(pd.surfaceHistory);
    }
  });

  it('reaches the condition on the LAB route too', () => {
    for (const [name, fp] of Object.entries(DRIVER_PRESETS)) {
      const sh = deriveConditionVector(fp, null, fp.radiusEarth).surfaceHistory;
      if (fp.surfaceHistory) expect(sh, `lab preset ${name}`).toBe(fp.surfaceHistory);
      else expect(sh, `lab preset ${name}`).toBeNull();
    }
  });

  it('KNOWN DEFECT, NAMED AND DEFERRED: the game spells it erosionLevel, the engine reads erosion', () => {
    // ⛔ THIS TEST ASSERTS A BUG IS STILL PRESENT. It is not a mistake and it must
    // not be "fixed" by editing this file.
    //
    //   game  PhysicsEngine.js:820-824 → { bombardmentIntensity, erosionLevel, resurfacingRate }
    //   lab   driver-presets.js:27     → { erosion, bombardmentIntensity, resurfacingRate }
    //   readers  baseStep.js:38 and planet-lod-lab-core.js:598 both spell it `erosion`
    //
    // So the engine reads a hard 0 for a quantity that really runs 0.015…1.000
    // across the game's bodies. This is the SAME SHAPE of bug as the
    // tidalHeat/tidalHeating name mismatch, and PLAN.md gives that one its own
    // step (Step 2) with a deliberately-NOT-byte-identity gate and a committed
    // delta table — because fixing a dropped input MOVES NUMBERS, and Step 1's
    // entire claim is that nothing moved. Renaming it here would land a real
    // behaviour change inside a step whose gate says there was none, and the gate
    // would still pass, because the three baseStep helpers the vector calls
    // happen not to read that scalar. That is this codebase's signature failure
    // and it is not being reproduced. Pinned here so it stays visible.
    let engineSpellingPresent = 0;
    let gameSpellingPresent = 0;
    for (const pd of planets) {
      const sh = conditionFromBody(pd).surfaceHistory;
      if (sh.erosion !== undefined) engineSpellingPresent++;
      if (typeof sh.erosionLevel === 'number') gameSpellingPresent++;
    }
    expect(engineSpellingPresent, 'if this is non-zero the rename happened — retire this test').toBe(0);
    expect(gameSpellingPresent).toBe(planets.length);
  });
});

describe('Step 1 · radiusEarthCanonical is distinct from the drawn radius', () => {
  it('equals the drawn radius on the GAME route, bit-for-bit', () => {
    // Step 2's recorded ruling (PLAN.md:216): the game has ONE radius per body and
    // must not be given a second. `gravityRadiusRatio` returning exactly 1.0 here
    // is CORRECT, not broken — the self-compression law expresses "what if this
    // body were a size other than its canonical one," which the game never asks.
    for (const pd of planets) {
      const c = conditionFromBody(pd);
      expect(Object.is(c.radiusEarthCanonical, c.radiusEarth), pd.type).toBe(true);
    }
  });

  it('differs on the LAB route, which is the whole reason the key exists', () => {
    const fp = DRIVER_PRESETS['Rocky (Earthlike)'];
    const drawn = fp.radiusEarth * 1.6;
    const c = deriveConditionVector(fp, null, drawn);
    expect(c.radiusEarth).toBe(drawn);
    expect(c.radiusEarthCanonical).toBe(fp.radiusEarth);
    expect(c.radiusEarthCanonical).not.toBe(c.radiusEarth);
  });
});

describe('Step 1 · the axialTilt unit conversion', () => {
  it('the GAME really does store radians — the evidence, asserted, not remembered', () => {
    // The direction of this conversion rests entirely on what unit the game
    // stores. PLAN.md:177 asserts the datum ("0.41 for 23.4°") and then asks for
    // a conversion pointing the other way, so the datum is pinned here against
    // the source rather than against the plan's prose.
    const src = readFileSync(
      fileURLToPath(new URL('../src/generation/SolarSystemData.js', import.meta.url)), 'utf8',
    );
    expect(src).toMatch(/axialTilt:\s*0\.41,\s*\/\/\s*23\.4°/);      // Earth, :180
    expect(src).toMatch(/axialTilt:\s*1\.71,\s*\/\/\s*~?97\.8°/);    // Uranus, :484
    // 0.41 rad = 23.49°, and 1.71 rad = 97.98°. Both agree with their comments to
    // within the rounding of two decimal places. Degrees would not.
    expect(axialTiltDegreesOf(0.41)).toBeCloseTo(23.4, 0);
    expect(axialTiltDegreesOf(1.71)).toBeCloseTo(97.8, 0);
  });

  it('the ENGINE really does read degrees — the other half of the evidence', () => {
    const labCore = readFileSync(
      fileURLToPath(new URL('../src/worldengine/base/labCore.js', import.meta.url)), 'utf8',
    );
    expect(labCore).toMatch(/axialTilt in degrees/);                       // :906
    expect(labCore).toMatch(/frostLatitudeBias\s*=\s*clamp01\(axialTilt \/ 90\)/); // :908
    const presets = readFileSync(
      fileURLToPath(new URL('../driver-presets.js', import.meta.url)), 'utf8',
    );
    expect(presets).toMatch(/axialTilt:25/);                               // Mars, :109 — 25 deg
  });

  it('converts RADIANS → DEGREES, which is the opposite of what PLAN.md:177 says', () => {
    // ⚠ DELIBERATE DIVERGENCE FROM THE PLAN'S PROSE, pinned so nobody "fixes" it
    // back. PLAN.md:177 says "convert to radians at the seam", citing as evidence
    // "the game stores 0.41 for 23.4°" — which is the proof the game's number is
    // ALREADY radians. Applying a degrees→radians conversion would divide by 57.3
    // a second time and hand Earth 0.00716: finite, plausible, and wrong by
    // exactly the factor the step exists to remove.
    expect(axialTiltDegreesOf(0.41)).toBe(0.41 * 180 / Math.PI);
    expect(axialTiltDegreesOf(0.41)).not.toBe(0.41);                 // not a passthrough
    expect(axialTiltDegreesOf(0.41)).not.toBeCloseTo(0.41 * Math.PI / 180, 6); // not the inverse
    // What the law downstream would read, on Earth: 0.26 rather than 0.0046.
    expect(Math.min(1, Math.max(0, axialTiltDegreesOf(0.41) / 90))).toBeCloseTo(0.261, 3);
  });

  it('absent stays absent — never a fabricated zero', () => {
    expect(axialTiltDegreesOf(undefined)).toBeUndefined();
    expect(axialTiltDegreesOf(null)).toBeUndefined();
    // Sol's moon records carry no axialTilt (surface-variation-beyond-mvp.md:790).
    expect(conditionFromBody({ radiusEarth: 0.273 }).axialTiltDeg).toBeUndefined();
  });

  it('lands every generated body inside a physically possible obliquity', () => {
    // PlanetGenerator.js:687 rolls ±1.5 rad. In degrees that is ±86°.
    // ⛔ THIS ASSERTION USED TO READ `Math.abs(deg) <= 180` AND WAS VACUOUS:
    // −85.7 and +177.6 both satisfy it, and both are exactly the values that
    // break the one consumer. The domain is now asserted for real in
    // `describe('Step 1 · the axialTiltDeg DOMAIN …')` below. What survives here
    // is the UNIT check, which the fold cannot carry (see the double-conversion
    // hazard test in that block).
    for (const pd of planets) {
      const deg = conditionFromBody(pd).axialTiltDeg;
      expect(Number.isFinite(deg), pd.type).toBe(true);
      expect(Object.is(deg, pd.axialTilt)).toBe(false);   // a passthrough would fail here
    }
  });

  it('leaves the LAB preset untouched, because it is already in degrees', () => {
    // The lab does not go through the adapter, so its 25 stays 25. One unit on the
    // vector, reached by two different routes — which is the point of converting
    // at the seam rather than at the reader.
    const fp = DRIVER_PRESETS['Mars (arid rocky)'];
    expect(deriveConditionVector(fp, null, fp.radiusEarth).axialTiltDeg).toBe(25);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// THE axialTiltDeg DOMAIN GATE
//
// ⛔ WHY A SECOND BLOCK, WHEN THE UNIT IS ALREADY GATED ABOVE. Step 1 got the
// UNIT right and the DOMAIN wrong, and every gate it shipped is blind to the
// difference, because a wrong-domain obliquity is still an obliquity: finite,
// in degrees, physically possible. Specifically —
//   · the assertion above used `Math.abs(deg) <= 180`, which −85.5 and +177.6
//     both satisfy, and which is exactly the pair that breaks the reader;
//   · Instruments A, B and C cannot see it. `axialTiltDeg` drives no shipped
//     uniform (C), is not on `planetData` (B), and no test went red (A);
//   · channel 3 above ("no reader") is what MAKES it invisible — it proves
//     nothing reads the key TODAY, which is true, and says nothing about the
//     value being fit for the reader that Steps 4/5/8 will attach.
//
// ⛔ WHAT THIS BLOCK ASSERTS THAT NOTHING ELSE DOES: the emitted value's DOMAIN
// over the real generated population, and the CONSUMER's output being
// non-degenerate over that same population. Both halves are needed. A domain
// assertion alone can be satisfied by a constant; a consumer assertion alone
// can be satisfied by a reader that silently repairs its input.
//
// ⛔ AND WHY THE READER IS DELIBERATELY LEFT UNGUARDED. `deriveUniforms` still
// computes `clamp01(axialTilt / 90)` with no fold of its own. Adding a
// defensive fold there would make the consumer half of this gate VACUOUS — it
// would pass for any producer, including the broken one. The reader is kept
// honest so that this measurement keeps a real subject.
// ═════════════════════════════════════════════════════════════════════════════

/**
 * ⚠ WHAT THIS PINS — AND, EXACTLY, WHAT IT DOES NOT (round 3 finding 5). These three
 * lines are CHARACTER-IDENTICAL to `effectiveObliquityDegreesOf`'s. The docstring here
 * used to say they were "recomputed from the physics rather than imported, so this file
 * is an independent check on the adapter and not a restatement of it" — which is false:
 * not imported is not the same as not the same maths, so the body-by-body test below
 * compares f(x) with f(x) and cannot fail on a wrong fold.
 *
 * What it DOES pin, and nothing else in this file does, is the ORDER OF THE COMPOSITION
 * inside the adapter: that `axialTiltDeg` is `fold(rad→deg)` — the conversion first,
 * then the fold — over every body in the population. Drop the fold, drop the
 * conversion, swap the two, or apply either twice, and every body diverges at once.
 * That is worth pinning body-by-body and it is the whole of what this function claims.
 *
 * The fold's MATHS is checked against the real `effectiveObliquityDegreesOf` in the
 * hazard block below, on the two inputs (>180° and the doubled conversion) that no
 * generated or Sol body reaches.
 */
function expectedEffectiveObliquity(deg) {
  let t = Math.abs(deg) % 360;
  if (t > 180) t = 360 - t;
  if (t > 90) t = 180 - t;
  return t;
}

/** The ONE consumer, run for real: planet-lod-lab-core.js:906-908. */
function frostLatitudeBiasFor(axialTiltDeg) {
  return deriveUniforms({
    T_eq: 60, composition: { volatileFraction: 0.3 }, axialTilt: axialTiltDeg,
  }).frostLatitudeBias;
}

describe('Step 1 · the axialTiltDeg DOMAIN, and the consumer it feeds', () => {
  it('CONTROL — the population genuinely exercises the domain, so the gate is not a tautology', () => {
    // If PlanetGenerator ever stops rolling a SIGNED tilt (:687 `rng.range(-1.5,1.5)`,
    // and the second roll at :560), the domain assertion below becomes true for a
    // reason that has nothing to do with the seam, and this codebase's signature
    // failure — a measurement that is entirely true and entirely misleading —
    // happens again inside the gate written to prevent it. So the input's spread
    // is asserted BEFORE the output's domain.
    const raw = planets.map((p) => p.axialTilt).filter((v) => typeof v === 'number');
    expect(raw.length).toBeGreaterThanOrEqual(300);
    expect(raw.filter((v) => v < 0).length).toBeGreaterThan(raw.length * 0.2);  // measured: 50.8%
    expect(new Set(raw).size).toBeGreaterThan(raw.length * 0.9);                // measured: 526/526 distinct
  });

  it('emits an obliquity inside [0°, 90°] for every body in the generated population', () => {
    // ⛔ THE REPLACEMENT FOR THE VACUOUS `Math.abs(deg) <= 180`. Measured before
    // the fold landed: 267 of 526 bodies (50.8%) emitted a NEGATIVE value,
    // range −85.543…+80.769. Every one of them is dimensionally correct.
    const degs = planets.map((pd) => conditionFromBody(pd).axialTiltDeg);
    const bad = degs.filter((d) => !(d >= 0 && d <= 90));
    expect(bad.length, `${bad.length}/${degs.length} outside [0,90]; e.g. ${bad.slice(0, 5)}`).toBe(0);
  });

  it('emits exactly the effective obliquity of the game\'s radian field — checked body by body', () => {
    // Independent recomputation from `planetData.axialTilt`, so this pins the
    // COMPOSITION (rad→deg, then fold) and not just the endpoints.
    for (const pd of planets) {
      if (typeof pd.axialTilt !== 'number') continue;
      expect(conditionFromBody(pd).axialTiltDeg)
        .toBeCloseTo(expectedEffectiveObliquity(pd.axialTilt * 180 / Math.PI), 10);
    }
  });

  it('does not collapse half the galaxy onto a single frost bias — the consumer, run for real', () => {
    // ⛔ THE DEFECT, STATED AS THE CONSUMER SEES IT. Before the fold, measured
    // over this exact corpus: 267/526 bodies read `frostLatitudeBias === 0`
    // and 260 distinct bias values existed across 526 bodies, because every
    // negative tilt clamped to the same floor. After: 0 and 526.
    const bias = planets
      .map((pd) => conditionFromBody(pd).axialTiltDeg)
      .filter(Number.isFinite)
      .map(frostLatitudeBiasFor);
    const zero = bias.filter((b) => b === 0).length;
    expect(zero / bias.length, `${zero}/${bias.length} bodies pinned at bias 0`).toBeLessThan(0.05);
    expect(new Set(bias).size).toBeGreaterThan(bias.length * 0.9);
  });

  it('CONTROL — the consumer still reports the two genuine extremes, so this is not "never 0, never 1"', () => {
    // A real zero-tilt world MUST read 0 and a real 90° world MUST read 1.
    // Without this, the assertion above could be satisfied by any function that
    // merely avoids the endpoints, and the gate would stop meaning "correct".
    expect(frostLatitudeBiasFor(0)).toBe(0);
    expect(frostLatitudeBiasFor(90)).toBe(1);
  });

  it('reads Sol\'s four retrograde bodies as the low-season worlds they are, not as maximal', () => {
    // ⭐ Sol renders through a DIFFERENT renderer and validates nothing about
    // procgen — but this is PURE-FUNCTION math over a real record, which is the
    // one thing Sol is a legitimate population for. It is also the ONLY
    // population in the game that carries an obliquity past 90°: the generator
    // tops out at ±1.5 rad (±86°), so without Sol the >90° half of the fold has
    // no witness at all.
    const sol = generateSolarSystem();
    const bodies = [];
    for (const e of sol.planets || []) {
      bodies.push(e.planetData);
      for (const m of e.moons || []) bodies.push(m.planetData || m);
    }
    const retro = bodies.filter((b) => typeof b.axialTilt === 'number' && b.axialTilt * 180 / Math.PI > 90);
    expect(retro.length, 'Sol must still carry retrograde bodies for this gate to mean anything').toBe(4);

    for (const b of retro) {
      const deg = conditionFromBody(b).axialTiltDeg;
      expect(deg).toBeGreaterThanOrEqual(0);
      expect(deg).toBeLessThanOrEqual(90);
      expect(frostLatitudeBiasFor(deg)).toBeLessThan(1);      // was exactly 1.000 on all four
    }

    // Venus, the sharpest case: 3.1 rad = 177.62°, physically a ~2.38°-effective
    // world that should hold tight polar caps. It read bias 1.000 — maximum
    // equator-ward frost spread — which is the most wrong a value in [0,1] can be.
    const venus = bodies.find((b) => b.axialTilt === 3.1);
    expect(venus, 'SolarSystemData.js still carries Venus at 3.1 rad').toBeTruthy();
    expect(conditionFromBody(venus).axialTiltDeg).toBeCloseTo(2.38, 2);
    expect(frostLatitudeBiasFor(conditionFromBody(venus).axialTiltDeg)).toBeCloseTo(0.026, 3);
  });

  it('folds on the physics identities, not on an implementation detail', () => {
    // A tilt and its mirror are the same obliquity; so are θ and 180−θ. These
    // are properties of the sky, so they hold whatever the adapter does inside.
    const deg = (r) => conditionFromBody({ axialTilt: r }).axialTiltDeg;
    const D2R = Math.PI / 180;
    expect(deg(-25 * D2R)).toBeCloseTo(deg(25 * D2R), 12);   // sign is a convention
    expect(deg(98 * D2R)).toBeCloseTo(deg(82 * D2R), 12);    // retrograde 98° ≡ prograde 82°
    expect(deg(177.62 * D2R)).toBeCloseTo(deg(2.38 * D2R), 10);
    expect(deg(0)).toBe(0);
    expect(deg(90 * D2R)).toBeCloseTo(90, 12);               // the pole-on maximum survives
  });

  it('⚠ NAMES THE HAZARD THE FOLD INTRODUCES: a double conversion now lands INSIDE the domain', () => {
    // ⛔ READ THIS BEFORE TRUSTING THE DOMAIN TEST. The old assertion caught a
    // twice-applied rad→deg conversion because it produced ~4900, far outside
    // ±180. The fold destroys that signal: 1.5 rad converted twice is 4924.2°,
    // which folds to 64.21° — a perfectly ordinary obliquity, inside [0,90],
    // invisible to every assertion above.
    //
    // ⛔ AND THIS LINE USED TO CALL `expectedEffectiveObliquity` — THIS FILE'S OWN
    // COPY (blocking item B2). The one assertion about the hazard this whole block
    // exists to name was a statement about the test, not about the adapter, so the
    // implementation path that handles it was never run. It calls the REAL function now.
    const doubled = 1.5 * (180 / Math.PI) * (180 / Math.PI);
    expect(doubled, 'the doubled conversion is still ~4924°').toBeCloseTo(4924.2, 1);
    expect(effectiveObliquityDegreesOf(doubled)).toBeCloseTo(64.21, 2);
    // The rounded literal is NOT the same input — 4924.2 folds to 64.2 and the true
    // doubled conversion 4924.213… folds to 64.213…. Pinned to 9 places each rather
    // than to a shared 2, because a tolerance wide enough to cover both would be wide
    // enough to cover a fold that is merely nearby.
    expect(effectiveObliquityDegreesOf(4924.2)).toBeCloseTo(64.2, 9);
    // and only NOW is the file's copy worth comparing to it — on this input, which is
    // the one the body-by-body test above can never reach.
    expect(effectiveObliquityDegreesOf(doubled)).toBeCloseTo(expectedEffectiveObliquity(doubled), 12);

    // ⛔ THE TWO LINES OF THE FOLD THAT NOTHING ELSE REACHES (B2, second half).
    // `Math.abs(t) % 360` and `if (t > 180) t = 360 − t` were DEAD under the whole
    // suite: the generated population runs −85.543…+80.769, Sol's largest is Venus at
    // 177.617, and every explicit input written anywhere in this file was one of
    // −25, 98, 177.62, 0, 90, NaN, undefined. Both `360 − t → t − 360` and deleting
    // `% 360` therefore survived every test.
    //
    // ⚠ WHICH INPUT CARRIES WHICH MUTANT — MEASURED, one process per mutant, because
    // "these inputs exercise the fold" is exactly the kind of claim that is true and
    // useless. Under BOTH mutants every pre-existing input above still reads correctly;
    // that is the finding, not a restatement of it.
    //   `360 − t → t − 360`  killed by 200, 300, 359, −200 and both 4924 inputs
    //   `% 360` deleted      killed by 380 and both 4924 inputs — and by NOTHING else
    //                        here, not even 360 (which folds to 0 either way). If the
    //                        4924 pair is ever loosened, 380 is the only line left.
    expect(effectiveObliquityDegreesOf(200)).toBeCloseTo(20, 12);    // 200 → 160 → 20
    expect(effectiveObliquityDegreesOf(300)).toBeCloseTo(60, 12);    // 300 → 60, no second fold
    expect(effectiveObliquityDegreesOf(359)).toBeCloseTo(1, 12);     // just short of a full turn
    expect(effectiveObliquityDegreesOf(-200)).toBeCloseTo(20, 12);   // sign is still a convention past 180°
    expect(effectiveObliquityDegreesOf(360)).toBeCloseTo(0, 12);     // a full turn is not a tilt
    expect(effectiveObliquityDegreesOf(380)).toBeCloseTo(20, 12);    // ⭐ the only wrap `% 360` alone can do
    // ⚠ AND THE FOLD MUST NOT SWALLOW THE UNIT BUG IT SITS DOWNSTREAM OF: it is the
    // composition that hides 4924.2, not either half alone, which is why the two
    // functions stay separate and `axialTiltDegreesOf` is pinned unfolded below.
    expect(effectiveObliquityDegreesOf(axialTiltDegreesOf(1.5))).toBeCloseTo(85.94, 2);
    // So the UNIT is gated separately and must stay gated: `axialTiltDegreesOf`
    // is deliberately left as a PURE rad→deg conversion with no fold in it, and
    // its endpoints are pinned above (0.41 → 23.4, 1.71 → 97.8). Deleting those
    // and relying on the domain test would silently reopen the unit bug.
    expect(axialTiltDegreesOf(1.71)).toBeCloseTo(97.98, 2);   // NOT folded — still the raw conversion
    expect(axialTiltDegreesOf(-0.5)).toBeCloseTo(-28.65, 2);  // NOT folded — still signed

    // ⛔ AND THE SECOND TEMPTATION: the fold must NOT swallow NaN into `undefined`.
    // `undefined` is a legitimate value at this seam (absent tilt), so laundering a
    // corrupt one into it would hand a downstream `?? default` a plausible world.
    // NaN stays NaN, which is loud (it reaches a uniform and the body renders black).
    expect(Number.isNaN(conditionFromBody({ axialTilt: NaN }).axialTiltDeg)).toBe(true);
    expect(conditionFromBody({ axialTilt: undefined }).axialTiltDeg).toBeUndefined();
  });
});

describe('Step 1 · the habitability shape normalisation', () => {
  it('the game emits an OBJECT and the lab emits a NUMBER under the same key', () => {
    // Found while building this step; not previously recorded.
    // PhysicsEngine.js:688 `return { score: Math.min(score, 1.0), factors };` returns an
    // object, while its own JSDoc at PhysicsEngine.js:637 `@returns {number} score 0-1`
    // says a number.
    expect(typeof planets[0].habitability).toBe('object');
    expect(typeof planets[0].habitability.score).toBe('number');
    expect(typeof DRIVER_PRESETS['Rocky (Earthlike)'].habitability).toBe('number');
  });

  it('forwarding the raw object would have produced NaN in the one law that reads it', () => {
    // planet-lod-lab-core.js:744 — `clamp01(d.habitability ?? 0)`. NaN is the one
    // failure mode here that is NOT quiet: it propagates into a uniform and the
    // body renders as a black frame.
    const clamp01 = (x) => Math.min(1, Math.max(0, x));
    expect(Number.isNaN(clamp01(planets[0].habitability))).toBe(true);
    expect(clamp01(conditionFromBody(planets[0]).habitability)).not.toBeNaN();
  });

  it('emits the scalar, from either side\'s shape', () => {
    for (const pd of planets) {
      const h = conditionFromBody(pd).habitability;
      expect(typeof h, pd.type).toBe('number');
      expect(Object.is(h, pd.habitability.score)).toBe(true);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThanOrEqual(1);
    }
    expect(habitabilityScalarOf(0.7)).toBe(0.7);
    expect(habitabilityScalarOf({ score: 0.35, factors: [] })).toBe(0.35);
    expect(habitabilityScalarOf(undefined)).toBeUndefined();
    expect(habitabilityScalarOf({ factors: [] })).toBeUndefined();   // no score ⇒ no claim
  });
});

describe('Step 1 · the atmosphere sniff became a positive shape validation', () => {
  it('a visual-only {color, strength} wrapper no longer returns a truthy atmosphere', () => {
    // PLAN.md:193's gate, stated as a behaviour rather than a diff.
    const visualOnly = { color: [0.4, 0.6, 1.0], strength: 0.3 };
    expect(legacyAtmosphereFromPlanet(visualOnly)).toBeTruthy();          // the bug
    expect(legacyAtmosphereFromPlanet(visualOnly).pressure).toBeUndefined(); // ...both halves of it
    expect(atmosphereFromPlanet(visualOnly)).toBeNull();                  // the fix
  });

  it('names why that mattered: one object, two contradictory answers', () => {
    // MoonGenerator.js:217 `atmosphere: type === 'terrestrial' ? {` emits exactly this
    // for a terrestrial moon (closed by MoonGenerator.js:220 `} : null,`). Through
    // the old seam the resulting condition said "has air" to every truthiness gate
    // and "vacuum" to every pressure gate, and nothing threw, because every
    // divisor downstream is floored.
    const moonLike = {
      radiusEarth: 0.27, massEarth: 0.012, T_eq: 250, age: 4.5,
      composition: { ironFraction: 0.2, density: 3300, volatileFraction: 0.2 },
      atmosphere: { color: [0.4, 0.6, 1.0], strength: 0.3 },
    };
    const was = legacyConditionFromPlanet(moonLike);
    expect(Boolean(was.atmosphere)).toBe(true);          // "has air"
    expect(was.atmosphere.pressure).toBeUndefined();     // "vacuum"

    const now = conditionFromBody(moonLike);
    expect(now.atmosphere).toBeNull();                   // one answer, and it is airless
    expect(now._provenance.atmosphere).toBe('defaulted'); // and it is labelled as a non-measurement
  });

  it('is MOON-ONLY: not one generated planet\'s atmosphere changes', () => {
    // PLAN.md:193 — "measured 177/177 generated planets carry {color, physics,
    // strength} and 0 lack .physics, so this change is moon-only. If this gate
    // DOES go red, it is a real regression, not expected churn." Re-measured here
    // over 500+ planets rather than trusted.
    let withAtmosphere = 0;
    for (const pd of planets) {
      const diffs = bitDiff(
        legacyConditionFromPlanet(pd).atmosphere,
        conditionFromBody(pd).atmosphere, `${pd.type}.atmosphere`, [],
      );
      expect(diffs).toEqual([]);
      if (pd.atmosphere) {
        withAtmosphere++;
        expect(pd.atmosphere.physics, 'a planet with a physics-less atmosphere').toBeTruthy();
      }
    }
    expect(withAtmosphere).toBeGreaterThan(100);
  });

  it('keeps an already-flat atmosphere as the SAME OBJECT, retained:false included', () => {
    // tests/port-limb-optics.test.js:47-49 feeds a flat `{retained:false, pressure:0}`
    // and asserts the optics still derive from it. Rebuilding it, or nulling it on
    // `retained === false`, would silently change that fixture's rim colour — so
    // the flat branch stays a passthrough of the identical object.
    const flat = { retained: false, pressure: 0, composition: 'none' };
    expect(atmosphereFromPlanet(flat)).toBe(flat);
    const retained = { color: [0.5, 0.6, 0.9], retained: true, pressure: 1.0, composition: 'n2-o2' };
    expect(atmosphereFromPlanet(retained)).toBe(retained);
    // Pressure alone is enough shape to be an atmosphere; colour alone is not.
    expect(atmosphereFromPlanet({ pressure: 0.006 })).toBeTruthy();
    expect(atmosphereFromPlanet({ color: [1, 1, 1] })).toBeNull();
    expect(atmosphereFromPlanet(null)).toBeNull();
  });

  it('forwards the wrapper\'s colour, which the physics block does not carry', () => {
    // PLAN.md:177 lists `atmosphere.color` as something to forward. It ALREADY was
    // (conditionFromBody.js, the `color:` line) — this is a regression fence on a
    // claim that was true before the step, not a new addition.
    const withPhysics = {
      color: [0.8, 0.5, 0.3], strength: 0.15,
      physics: { retained: true, pressure: 0.006, composition: 'co2' },
    };
    expect(atmosphereFromPlanet(withPhysics).color).toBe(withPhysics.color);
    for (const pd of planets) {
      if (!pd.atmosphere) continue;
      expect(conditionFromBody(pd).atmosphere.color).toBe(pd.atmosphere.color);
    }
  });
});

// ⭐⭐ THE FENCE THAT USED TO LIVE HERE IS RETIRED BY NAME, IN THE COMMIT THAT SPENDS IT.
//
// Its title was `Step 1 · metallicity is NOT forwarded — it lands in Step 5` and its first test was
// `stays undefined on every generated body`. It was a deliberate Step-1 guard against a defect in
// the LAW (a dex numerator over a g/cc denominator), Step 5e fixed the law, and Max ruled on
// 2026-08-09 to forward. ⛔ RETIRED IS NOT DELETED AND IS NOT RELAXED. The `undefined` assertion is
// replaced by its exact opposite — `metallicity` IS forwarded, verbatim, on every generated body,
// and it REACHES `enrichmentRatio`'s primary branch — so the same describe still fails if the
// forwarding is reverted, dropped, re-derived, or forwarded into a slot nothing reads. A guard
// removed leaves a hole; a guard inverted leaves a gate.
describe('Step 5e · metallicity IS forwarded — the Step 1 fence, spent and inverted', () => {
  it('is forwarded verbatim on every generated body, and NOT re-derived', () => {
    for (const pd of planets) {
      expect(typeof pd.metallicity, 'the game does carry one').toBe('number');
      const v = conditionFromBody(pd).metallicity;
      expect(Number.isFinite(v), `metallicity on a ${pd.type}`).toBe(true);
      // `Object.is`, not a tolerance: the claim is "the game's own number", and a re-derivation
      // that lands close would satisfy anything weaker. Same shape as the magneticField row.
      expect(Object.is(v, pd.metallicity), `${pd.type} — not the game's own value`).toBe(true);
    }
  });

  it('REACHES the enrichment branch — forwarding into a slot nothing reads would be no feature', () => {
    // ⛔ "The key is present" is not the claim. The claim is that `enrichmentRatio` takes its
    // PRIMARY arm because of it. Asserted against the branch's own closed form
    // (`10^(Z − MET0_DEX)`, MET0_DEX = 0) rather than against the function, so a change inside
    // `giant-drivers.js` that silently re-routed the branch would red here.
    let onPrimary = 0;
    for (const pd of planets) {
      const c = conditionFromBody(pd);
      const ratio = 10 ** pd.metallicity;
      const expected = Math.min(0.86, Math.max(0.74, 0.80 * (1 - 0.95 * (ratio - 1))));
      if (Object.is(deriveGiantDrivers(c).shellDepthFrac, expected)) onPrimary++;
    }
    expect(onPrimary, 'the forwarded metallicity is not what FORM 2 is reading — the density proxy '
      + 'is still winning, or a third term entered').toBe(planets.length);

    // AND THE CONTROL: withhold the key on the same live condition and the primary branch stops
    // being taken, everywhere. A gate whose control never moved is evidence of nothing.
    const withheld = new Set(planets.map((pd) => deriveGiantDrivers(
      { ...conditionFromBody(pd), metallicity: undefined }).shellDepthFrac));
    expect([...withheld], 'withholding metallicity no longer falls back to the saturated density '
      + 'proxy — the control that makes the assertion above meaningful has stopped moving')
      .toEqual([0.74]);
  });

  it('is inert on every population that carries none — moons, Sol, and the lab', () => {
    // ⛔ THE OTHER HALF OF "FORWARDED". `?? 0` would have been the obvious default and would have
    // been catastrophic: 0 dex is ratio 1, the exact D3 anchor, so every body with no metallicity
    // would have been silently declared solar AND switched onto the primary branch. The adapter
    // forwards `undefined` instead, which is what keeps these three populations on the density
    // proxy and makes this step byte-inert for them.
    expect(moons.length).toBeGreaterThan(0);
    expect(moons.filter((m) => m.metallicity != null).length, 'a moon acquired a metallicity — Step 8 '
      + 'owes this population a decision it has not made').toBe(0);
    for (const m of moons) expect(conditionFromBody(m).metallicity).toBeUndefined();

    const solBodies = (generateSolarSystem().planets || []).map((e) => e.planetData || e);
    expect(solBodies.length).toBeGreaterThan(0);
    expect(solBodies.filter((b) => b.metallicity != null).length,
      'Sol acquired a metallicity — the Sol route is no longer inert under this step').toBe(0);

    for (const [name, fp] of Object.entries(DRIVER_PRESETS)) {
      expect(deriveConditionVector(fp, null, fp.radiusEarth).metallicity,
        `lab preset ${name} — the lab route must stay on the density proxy`).toBeUndefined();
    }
  });

  it('MEASURES the trap, so the reason cannot rot into folklore', () => {
    // ⭐⭐ NAMED RE-BLESS 2026-08-09, PLAN §4 Step 5e — READ THIS BEFORE THE ASSERTIONS.
    // This test was written to measure a trap: `enrichmentZ` preferred `condition.metallicity`
    // (dex) while `canonicalZ0` was always the density proxy (g/cc), so forwarding metallicity
    // divided across two scales and pegged `shellDepthFrac` at a clamp bound. Step 5e CLOSED that
    // trap — `giant-drivers.js` now exposes `enrichmentRatio`, one scale-aware quantity, and the
    // metallicity branch is `10^(Z − MET0_DEX)`, the linear metal-abundance ratio, so the anchor is
    // exact at solar and the population no longer collapses.
    // ⛔ THE TEST IS NOT RELAXED AND IT IS NOT DELETED. It still measures the trap — by REPRODUCING
    // the pre-5e cross-scale form in-test — and it now also measures that the shipped law no longer
    // has it. That ordering matters: an assertion that only said "the new form is fine" would have
    // let the old reason rot into folklore, which is the exact thing this test's title exists for.
    // ⭐ SECOND RE-BLESS, SAME DAY, AND THE SENTENCE THIS REPLACES IS WHY THE FILE SAYS SO. It read
    // "AND THE ONE THING THAT DID NOT MOVE: the forwarding itself. `metallicity` is STILL not
    // forwarded by the adapter … so this is a measurement about the LAW, not about a live behaviour
    // change." Step 5e's FORWARDING half makes that false. It is corrected rather than deleted,
    // because a stale sentence in a test about not letting reasons rot is the failure it names.
    // ⚠ THE TWO ARMS THEREFORE SWAPPED SIDES. `held` is now the WITHHELD condition (built by
    // deleting the key the adapter supplies) and `forwarded` is the plain live one. The assertions
    // below are otherwise unchanged, and both arms still measure the same three populations.
    const gas = planets.filter((p) => GIANT_TYPES.has(p.type));
    expect(gas.length).toBeGreaterThanOrEqual(100);

    const dex = gas.map((p) => p.metallicity);
    expect(Math.min(...dex)).toBeLessThan(0);
    expect(dex.filter((m) => m < 0).length / dex.length).toBeGreaterThan(0.2);  // ~half, measured

    const held = gas.map((p) => deriveGiantDrivers(
      { ...conditionFromBody(p), metallicity: undefined }).shellDepthFrac);
    const forwarded = gas.map((p) => deriveGiantDrivers(conditionFromBody(p)).shellDepthFrac);
    // The PRE-5e law, reproduced here rather than cited, so the trap stays measured after the fix.
    // `regime` is left undefined exactly as the two calls above leave it, so all three lines speak
    // about the same body: gas-giant anchors, SDF0 0.80, band [0.74, 0.86].
    const SDF0 = 0.80, BAND = [0.74, 0.86], DELTA = 0.95, Z0_GCC = 1.33 + 0.03 + 0.04;
    const preFix = gas.map((p) => Math.max(BAND[0], Math.min(BAND[1],
      SDF0 * (1 - DELTA * (p.metallicity / Z0_GCC - 1)))));

    // Held back: one value across the whole population (the density proxy is
    // near-constant for the game's gas bodies). UNCHANGED by 5e — the density branch is bit-identical.
    expect(new Set(held.map((v) => v.toFixed(6))).size).toBe(1);
    expect(held[0]).toBe(0.74);
    // THE TRAP, still measured: under the pre-5e cross-scale division the forwarded population is a
    // single value, and the tell is that it is a clamp BOUND rather than a physical answer.
    expect(new Set(preFix.map((v) => v.toFixed(6))).size).toBe(1);
    expect(preFix[0]).toBe(BAND[1]);
    expect(preFix[0]).toBeGreaterThan(held[0]);
    // THE FIX, measured on the same bodies: the shipped law is no longer degenerate, and it is not
    // pinned to a bound. Floors rather than exact counts, because the count is a property of THIS
    // 120-seed corpus and a corpus change must not read as a law change.
    expect(new Set(forwarded.map((v) => v.toFixed(6))).size).toBeGreaterThan(1);
    expect(forwarded.some((v) => v > BAND[0] && v < BAND[1])).toBe(true);
    // …and it still MOVES relative to held — forwarding metallicity is a real change, not a no-op.
    expect(forwarded.some((v) => v !== held[0])).toBe(true);
    // ⚠ AND THE PART THAT IS NOT A WIN, ON THE SAME 130 GAS-TYPED BODIES, MEASURED: 14 distinct
    // values, 20 strictly interior, 48 at the floor and 62 at the ceiling. The floors above are
    // corpus-robust; these four are the actual shape and they say the channel is closer to a
    // sign-of-Z switch than to a spread. Recorded here because "no longer degenerate" is true and,
    // on its own, misleading — which is the failure mode this whole file is built around.
    expect(new Set(forwarded).size).toBe(14);
    expect(forwarded.filter((v) => v > BAND[0] && v < BAND[1]).length).toBe(20);
    expect(forwarded.filter((v) => v === BAND[0]).length).toBe(48);
    expect(forwarded.filter((v) => v === BAND[1]).length).toBe(62);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// THE PROVENANCE INPUT-LIST FENCE — AN AST WALK OVER THE ADAPTER
//
// ⛔ WHAT THE ORIGINAL FENCE DID. It asserted `PROVENANCE_INPUTS.length === 13`
// and `Object.keys(_provenance) === PROVENANCE_INPUTS`. BOTH SIDES DERIVED FROM
// THE SAME CONSTANT. Nothing read the adapter, so nothing could notice the
// adapter growing an input — and the adapter had ALREADY grown one
// (`comp.carbonToOxygen`) before the assertion was written.
//
// ⛔ WHAT THE SECOND FENCE DID, AND WHY IT IS ALSO GONE. It stripped the
// adapter's comments and strings, excised `provenanceOf`, and ran REGEXES over
// the remaining text: `\b(d|comp)\.(\w+)` for the reads, plus five detectors for
// the spellings that regex cannot see (`planetData.x`, `d?.x`, `d['x']`,
// `const {x} = d`, `const p = d`) and a sixth check at the call site for a helper
// taking `d` under another parameter name.
//
// It was written to close five measured bypasses. It closed six. An independent
// pass then found FOUR MORE, and proved each by injecting it into the real
// adapter with the real suite green:
//   G  `const { atmosphere: { pressure }, starMassEarth } = d;`
//         the destructure detector is `\{[^{}]*\}`, which cannot match a brace
//         INSIDE the pattern — so the whole statement, including its top-level
//         `starMassEarth`, matched nothing.
//   H  `let p;  p = d;  … p.tidalHeating`
//         the alias detector requires `const|let|var NAME = d`. A declaration
//         split from its assignment is two statements and matches neither.
//   I  `const all = { ...d };  … all.tidalHeating`
//         the initialiser is `{`, not `d`.
//   J  the read placed INSIDE `provenanceOf` and written outward to a
//         module-scope object. The excision that keeps the record off both sides
//         of the comparison does not stop that body from reading.
//
// ⛔ 5 CLOSED → 4 MORE IS THE WHACK-A-MOLE SIGNATURE §11.2 EXISTS TO END. A regex
// over source text cannot close the class "ways to read a property off an
// object", because that class is defined by the LANGUAGE GRAMMAR, not by a set of
// spellings; every closed spelling leaves the grammar's remainder open. So the
// mechanism changed rather than the pattern list growing again.
//
// ── WHAT REPLACES IT ────────────────────────────────────────────────────────
// The adapter is PARSED (`@babel/parser`, module source type) and walked, and the
// question "does this expression read the adapter's input?" is answered by
// RESOLVING BINDINGS rather than by matching text:
//
//   1. the adapter's first parameter is the input; so is any parameter spelled
//      `planetData`, so a copy-pasted second entry point is analysed too;
//   2. the ALIAS SET is grown to a FIXPOINT — through `const/let/var x = <alias>`,
//      bare `x = <alias>` with no initialiser (H), `<alias> ?? {}` / `|| {}` (the
//      file's own idiom), `{ ...<alias> }` (I), `(0, <alias>)`, a ternary's arms,
//      and the RETURN VALUE of any in-file helper that returns an alias. One pass
//      is not enough: measured, the real adapter needs 4;
//   3. a READ is any member expression on an alias (dot, computed, optional) and
//      any destructuring pattern whose init is an alias — nested (G), defaulted,
//      rest, and computed-with-a-literal-key included;
//   4. EVERY function in the module is covered, and a helper's parameter joins the
//      alias set when the helper is CALLED with an alias (A and F, and the file's
//      own `provenanceOf(d, comp)` / `atmosphereFromPlanet(d.atmosphere)` idiom);
//   5. much of what the walk cannot follow is reported rather than ignored: a bare
//      input handed to a callee not declared in this file, a computed field name
//      that is not a literal, `eval`, `for…in`/`for…of` over the input, the input
//      stored into an array or a property. Each is a named finding, not a silent
//      pass. ⛔ NOT ALL OF IT — read KNOWN LIMITS below before trusting a silence.
//
// ⛔ `provenanceOf` IS STILL PARTITIONED OFF — BUT IT IS NO LONGER A HOLE. Its
// reads do not COUNT as reads-needing-a-row (it reads exactly what it records, so
// counting them would put the record back on both sides of the comparison — the
// original defect, restored), and they are excluded from `stale` for the same
// reason. They are nonetheless required to resolve to an ALREADY-DECLARED row.
// The body is allowed to read; it is not allowed to read something undeclared.
// That is bypass J, closed without giving the excision up.
//
// ⚠ THE READ NAMESPACE IS THE COVERAGE MAP'S, WHICH MEANS TRUNCATION, DELIBERATELY.
// `PROVENANCE_COVERAGE` enumerates fields one level deep off `planetData` and two
// levels deep under `composition` (that is what `comp.` means). So a read of
// `d.atmosphere.physics.pressure` is attributed to the declared input
// `d.atmosphere` rather than reported as a fifth undeclared thing — which is what
// makes `atmosphereFromPlanet`'s three levels of nesting analysable at all. Reads
// under `d.composition` keep their second level, because the map does.
//
// ═════════════════════════════════════════════════════════════════════════════
// ⛔⛔ AND WHY THAT AST WALK, TOO, HAD TO BE INVERTED — THE ACTUAL DEFECT.
//
// The AST fence went 1/11 → 11/11 on the known bypass set and survived 49
// adversarial constructs. An independent pass then found FIVE MORE and proved
// every one on disk, with the full 56-test suite GREEN and the read proven LIVE
// (a getter planted on `tidalHeating` fired on each, while `_provenance` carried
// 14 rows and no `tidalHeating` row):
//
//   K  class static block   `let _sb; class _S { static { _sb = d.tidalHeating; } }`
//   L  logical assignment   `let _z = null; _z ||= d;  … _z.tidalHeating`
//   M  logical assignment   `let _z; _z ??= d;         … _z.tidalHeating`
//   N  logical assignment   `let _z = d; _z &&= d;     … _z.tidalHeating`
//   O  accessor property    `const b = { get inner(){ return d; } }; b.inner.x`
//   P  generator + yield    `function* g(x){ yield x; } g(d).next().value.x`
//
// ⛔ TWO ROUNDS FAILED THE SAME WAY, AND IT IS NOT REGEX-VS-AST. Both fences were
// FAIL-OPEN: they reported what they RECOGNISED, so every construct the analyser
// did not model contributed nothing and the gate stayed green. `StaticBlock` was
// never visited. `||=` fell into an `else` that read the LHS and dropped the
// binding. An object literal's accessor was entered and its return thrown away.
// A generator's call site returned `returnsOf(fn)`, which for a generator is the
// empty set because the return value is an iterator. Not one of those is a
// missing PATTERN; each is a missing RULE, and a fence that is silent about its
// own missing rules has the same defect as risk #9's HTML scrapers — it goes
// VACUOUS rather than RED.
//
// ── SO THE POLARITY IS INVERTED. THE FENCE IS FAIL-CLOSED. ───────────────────
// The analyser must now be able to say, at the end of a run, "I resolved every
// construct that could carry the adapter's input from one binding to another."
// It does that with a NODE-TYPE LEDGER that PARTITIONS the ECMAScript grammar —
// `NODE_TYPE_LEDGER` below — into exactly three buckets, and a COMPLETENESS
// SWEEP that walks the parsed module and reports, by name and line, any node
// type that is in none of them:
//
//   MODELLED           — there is a rule that follows the value (or proves it
//                        cannot move), and a control row that exercises it.
//   REJECTED-LOUD      — no rule. Two flavours, both loud:
//                        · on CONTACT — the walk visits it and any tracked value
//                          reaching it is a named finding (`yield`, `for…of`,
//                          an array literal, a tagged template);
//                        · on SIGHT  — the type has no rule at all, so merely
//                          appearing in the module is a finding. Every one of
//                          these is a proposal-stage or plugin-only construct
//                          `PARSE_OPTS` cannot even produce today; if the parse
//                          options ever grow a plugin, this reds instead of
//                          going quietly blind.
//   IGNORED-WITH-REASON— cannot carry a value, one line saying why.
//
// ⛔ THE LEDGER IS THE DELIVERABLE AS MUCH AS THE CODE IS. A reader checks this
// fence for completeness by reading the three buckets against the language's
// node-type list — not by trusting that somebody thought hard. The partition is
// asserted against `ESTREE_UNIVERSE` (transcribed from `@babel/types@7.29.0`),
// so a type in two buckets, or in none, fails the suite.
//
// ⚠ AND THE SWEEP IS NOT THE ONLY FAIL-CLOSED MECHANISM — a node type can be
// modelled in general and still meet a SHAPE the rule does not cover. Those get
// the same `unmodelled:` prefix and the same line number:
//   · a call into a `function*` / `async function` (its iterator/promise
//     plumbing is not modelled)                                          — P
//   · an accessor or method on an object/class whose RETURN carries the input
//     (taint through a property slot is not modelled)                    — O
//   · a function literal that escapes into a position the walk cannot route,
//     while its return carries the input
//   · a compound arithmetic assignment (`+=` …) of a tracked value, which
//     coerces through `valueOf`/`toString`
//   · a node type this ledger calls MODELLED that nevertheless reaches the
//     walk's `default:` branch — i.e. the ledger and the code disagree.
//
// ⚠ THE COST OF FAIL-CLOSED IS REAL AND IS MEASURED, NOT WAVED AT. The SHIPPED,
// unmodified adapter must produce ZERO `unmodelled:` hits, and the test below
// asserts exactly that number rather than merely asserting "no findings" — an
// over-rejecting fence is as useless as a blind one, and the only honest way to
// know which you have is to count.
// ═════════════════════════════════════════════════════════════════════════════

const PARSE_OPTS = { sourceType: 'module', ranges: false, attachComment: false };

/**
 * ⛔ THE NODE-TYPE LEDGER — THE BOUNDED COMPLETION CRITERION FOR THIS FENCE.
 *
 * Every ECMAScript/Babel node type that `PARSE_OPTS` could ever produce, in
 * exactly one bucket. `analyzeAdapterSource` sweeps the parsed module and emits
 * `unmodelled: <NodeType> at line N` for anything that appears here in none of
 * the three — so ADDING A CONSTRUCT TO THE ADAPTER THAT NOBODY HAS THOUGHT
 * ABOUT IS A RED, which is the whole inversion.
 *
 * The `reason` text is not decoration. For MODELLED it names the rule; for
 * REJECTED-LOUD it says what the walk cannot follow; for IGNORED it says why the
 * construct cannot carry a value. A row whose reason you cannot defend is a row
 * that should move buckets.
 */
const NODE_TYPE_LEDGER = Object.freeze({
  // ── MODELLED ───────────────────────────────────────────────────────────────
  // A rule follows the tracked value to its destination, or proves it stops here.
  MODELLED: Object.freeze({
    Program:                  'the module body; statements walked in the root scope',
    BlockStatement:           'statements walked in the enclosing function scope',
    ExpressionStatement:      'the expression is walked',
    VariableDeclaration:      'each declarator binds its pattern to the init\'s tags',
    VariableDeclarator:       'handled inside VariableDeclaration; a function init is entered by NAME so its call sites resolve',
    FunctionDeclaration:      'entered; its parameters receive tags at each CALL SITE',
    FunctionExpression:       'entered; escapes loudly if its return is tracked and the value leaves by a route the walk cannot route',
    ArrowFunctionExpression:  'as FunctionExpression, and a concise body counts as the return expression',
    ReturnStatement:          'the argument\'s tags join the enclosing function\'s return set',
    Identifier:               'VALUE path ONLY: resolved to the tags bound to that name in the nearest declaring scope (`declScopeOf`). ⛔ The CALLEE path does NOT use this resolution — KNOWN LIMITS #2',
    MemberExpression:         'THE READ: a static property off a tracked object is recorded; a non-literal computed key is a named finding',
    OptionalMemberExpression: 'as MemberExpression — `?.` changes whether the read HAPPENS, never what field it names',
    CallExpression:           'arguments flow into the callee\'s parameters and the callee\'s returns flow out; an unknown callee, a generator/async callee, a rest/extra parameter, a RESOLVABLE IN-FILE callee\'s use of `arguments`, and `eval`/`Function`/`.constructor` are each named findings. ⛔ The ADAPTER\'S OWN `arguments` object is NOT covered — KNOWN LIMITS #1',
    OptionalCallExpression:   'as CallExpression — `?.()` changes nothing about where arguments and returns go',
    NewExpression:            'as CallExpression; a constructor is never an in-file function here, so a tracked argument escapes loudly',
    Import:                   'the `import()` callee; the call itself has no in-file callee, so its arguments escape loudly',
    LogicalExpression:        'the value is either operand — the union of both sides',
    ConditionalExpression:    'the value is either arm — the union of both arms',
    SequenceExpression:       'the value is the last operand',
    ParenthesizedExpression:  'transparent — the parenthesised expression IS the value; only produced with createParenthesizedExpressions',
    AssignmentExpression:     '`=` and `||= &&= ??=` bind the left-hand pattern to the right\'s tags; a member target escapes loudly; `+=` and friends coerce and escape loudly',
    ObjectExpression:         'a spread propagates the spread object\'s tags; every other property VALUE escapes loudly; methods are entered and an accessor whose return is tracked is a named finding',
    ObjectProperty:           'handled inside ObjectExpression (value) and ObjectPattern (read)',
    ObjectMethod:             'entered; kind get/set with a tracked return is a named finding, because taint through a property SLOT is not modelled',
    ObjectPattern:            'DESTRUCTURING IS READING: every static key is recorded as a read and binds its sub-pattern',
    AssignmentPattern:        'the default expression is walked; the left pattern is bound',
    RestElement:              'in a pattern it binds the remainder; as a parameter it escapes loudly at the call site',
    SpreadElement:            'in an object literal it propagates; in a call or array literal it escapes loudly',
    StaticBlock:              'CLASS STATIC BLOCK — its statements are walked in the enclosing scope (bypass K)',
    ClassDeclaration:         'members entered, static blocks walked, computed keys walked, field initialisers escape loudly',
    ClassExpression:          'as ClassDeclaration — the same member walk, reached as an expression',
    ClassBody:                'container; handled by ClassDeclaration/ClassExpression',
    ClassMethod:              'as ObjectMethod — entered, and a tracked return out of an accessor is a named finding',
    ClassPrivateMethod:       'as ObjectMethod — `#m(){}` is reached the same way and gets the same rule',
    ClassProperty:            'the initialiser is walked and escapes loudly — a field is a property slot',
    ClassPrivateProperty:     'as ClassProperty — `#x = …` is still a property slot, and its initialiser escapes loudly',
    ThisExpression:           'carries no tags; `fn.call(d)` is caught at the CALL SITE instead, because the callee is not a resolvable in-file function',
    IfStatement:              'test and both branches walked',
    SwitchStatement:          'discriminant, every case test and every consequent walked',
    SwitchCase:               'handled inside SwitchStatement',
    ForStatement:             'init, test, update and body walked',
    WhileStatement:           'test and body walked; a loop cannot create a binding the fixpoint has not already seen',
    DoWhileStatement:         'test and body walked, as WhileStatement — the body simply runs at least once',
    TryStatement:             'block, handler body and finalizer walked',
    CatchClause:              'body walked; the caught binding is declared with NO tags — which is only sound because ThrowStatement is rejected loudly, see that row',
    LabeledStatement:         'the body is walked; a label steers control flow, never a value',
    TemplateLiteral:          'every interpolation is walked; the result is a string and carries nothing',
    BinaryExpression:         'both operands walked; `\'x\' in <tracked>` is recorded as a read of x; the result is a primitive',
    UnaryExpression:          'argument walked; the result is a primitive',
    UpdateExpression:         'argument walked; the result is a number',
    AwaitExpression:          'identity on a non-thenable, and EVERY route into an async function is rejected at its call site, so nothing can arrive here through one',
    ExportNamedDeclaration:   'the declaration is walked; the exported NAMES are pinned separately',
    ExportDefaultDeclaration: 'the declaration is walked',
  }),

  // ── REJECTED-LOUD ──────────────────────────────────────────────────────────
  // No rule. `onContact` types are visited and fire when a tracked value reaches
  // them; `onSight` types have no rule at all and fire on appearance.
  REJECTED_LOUD_ON_CONTACT: Object.freeze({
    ArrayExpression:           'an array SLOT is not a path this analysis can express; a tracked element is a named finding',
    ArrayPattern:              'array-destructuring treats the input as an ITERABLE, which no static property path describes',
    ForOfStatement:            'enumeration of a tracked value yields elements under no name the walk can follow',
    ForInStatement:            'as ForOfStatement, over keys rather than values — the same missing binding',
    TaggedTemplateExpression:  'the tag is an arbitrary function applied to the interpolations',
    WithStatement:             'unreachable in module source (strict); kept so it can never be silent',
    YieldExpression:           'a yielded value goes to the generator\'s CONSUMER, not to a binding this walk can see (bypass P)',
    ThrowStatement:            'a throw carries its value to a CATCH BINDING through the unwind; connecting the two needs a control-flow graph this file does not build (found by attacking this round\'s own fence — it was silent)',
  }),
  REJECTED_LOUD_ON_SIGHT: Object.freeze({
    ClassAccessorProperty:      '`accessor x = …` synthesises a getter/setter pair — taint through a property slot, with no syntax to attach a rule to',
    Decorator:                  'applies an arbitrary expression to the class or member at definition time',
    ImportExpression:           'dynamic `import()`; a module boundary this walk does not cross',
    BindExpression:             'proposal-stage `::` bind operator; binds a receiver to a function',
    DoExpression:               'proposal-stage `do {}` expression; a block whose completion value escapes',
    RecordExpression:           'proposal-stage `#{}` immutable record literal',
    TupleExpression:            'proposal-stage `#[]` immutable tuple literal',
    DecimalLiteral:             'proposal-stage decimal literal (`1.0m`); parser-plugin only',
    ModuleExpression:           'proposal-stage `module {}` block; a module boundary inside an expression',
    PipelineBareFunction:       'proposal-stage pipeline operator (`|>`); a call whose argument is implicit',
    PipelineTopicExpression:    'proposal-stage pipeline operator (`|>`); the piped value has no name',
    PipelinePrimaryTopicReference: 'proposal-stage pipeline operator (`|>`); refers to the piped value',
    TopicReference:             'proposal-stage topic reference (`%`); refers to a value under no binding',
    ArgumentPlaceholder:        'proposal-stage partial application `f(?)`; defers an argument to a later call',
    V8IntrinsicIdentifier:      'a V8 runtime intrinsic (`%Foo()`); parser-plugin only, and opaque by nature',
    Placeholder:                'a codegen placeholder, not real source; parser-plugin only',
    Noop:                       'a Babel-internal marker node, never produced from real source',
    VoidPattern:                'proposal-stage void binding pattern; discards a destructured slot',
  }),

  // ── IGNORED-WITH-REASON ────────────────────────────────────────────────────
  // Cannot carry a value from one binding to another. One line each, saying why.
  IGNORED_WITH_REASON: Object.freeze({
    StringLiteral:            'a literal is its own value; it can never BE the adapter\'s input',
    NumericLiteral:           'a literal is its own value; it can never BE the adapter\'s input',
    BooleanLiteral:           'a literal is its own value; it can never BE the adapter\'s input',
    NullLiteral:              'a literal is its own value; it can never BE the adapter\'s input',
    BigIntLiteral:            'a literal is its own value; it can never BE the adapter\'s input',
    RegExpLiteral:            'a literal is its own value; it can never BE the adapter\'s input',
    TemplateElement:          'the inert text between interpolations',
    Directive:                'a `\'use strict\'`-style prologue entry; a string with no operands',
    DirectiveLiteral:         'the string inside a Directive',
    InterpreterDirective:     'a `#!` shebang line; inert text before the first statement',
    EmptyStatement:           'a bare `;` — no operands at all, so nothing can pass through it',
    BreakStatement:           'transfers control, never a value',
    ContinueStatement:        'transfers control, never a value',
    DebuggerStatement:        'no operands; it can neither read nor carry a value',
    ImportDeclaration:        'binds MODULE names; the adapter\'s input is a parameter and can never arrive this way',
    ImportSpecifier:          'a name in an ImportDeclaration',
    ImportDefaultSpecifier:   'a name in an ImportDeclaration',
    ImportNamespaceSpecifier: 'a name in an ImportDeclaration',
    ImportAttribute:          'a `with { type: \'json\' }` clause — static metadata',
    ExportSpecifier:          'a name in an export clause; the export SURFACE is pinned separately',
    ExportDefaultSpecifier:   'a name in an export clause; the export SURFACE is pinned separately',
    ExportNamespaceSpecifier: 'a name in an export clause; the export SURFACE is pinned separately',
    ExportAllDeclaration:     're-exports another module; adds no binding to this scope, and the export surface is pinned separately',
    MetaProperty:             '`new.target` / `import.meta` — neither can be the adapter\'s parameter',
    PrivateName:              'a NAME, not a value; `#x in obj` is handled by the BinaryExpression rule',
    Super:                    'only legal inside a class; cannot be bound to the adapter\'s parameter',
    File:                     'the parse wrapper; the walk starts at `.program`',
  }),
});

/**
 * The node types `@babel/parser` can name. Transcribed 2026-08-08 from
 * `@babel/types@7.29.0` — `TYPES` filtered to nodes, minus every Flow, JSX,
 * TypeScript and enum alias, because `PARSE_OPTS` enables no plugin and so
 * cannot produce one. 106 rows.
 *
 * ⚠ ONE TRAP IN THAT DERIVATION, RECORDED BECAUSE IT BIT. Subtracting the whole
 * `TSEntityName` alias also subtracts `Identifier`, which is a member of it —
 * and `Identifier` is the single most load-bearing node type in this analysis.
 * The first cut of this list dropped it, and BOTH the transcription and the
 * script that checked the transcription made the same mistake, so they agreed
 * with each other and disagreed with the language. Only the ledger-vs-universe
 * partition assertion caught it, by reporting `Identifier` as bucketed-but-not-
 * in-the-universe. Two artefacts derived the same wrong way do not cross-check.
 *
 * ⚠ WHAT THIS LIST IS FOR, AND WHAT IT IS NOT FOR. It is the CHECKABILITY
 * artefact: the assertion below proves `NODE_TYPE_LEDGER` partitions it exactly,
 * so "is the ledger complete?" is answered by reading two lists against each
 * other rather than by trusting a claim. The FENCE does not depend on it — the
 * sweep reds any type outside the ledger whether or not it is written here, so a
 * Babel upgrade that invents a node type is fail-closed either way.
 *
 * ⛔⛔ KNOWN LIMITS — READ THIS BEFORE TRUSTING A SILENCE. ⛔⛔
 *
 * The sweep above closes the node-TYPE dimension of fail-open: a type nobody has
 * bucketed is a red. It CANNOT close the rule-SEMANTICS dimension — a WRONG RULE
 * for a RIGHT type is silent, because the type is bucketed and the sweep is
 * satisfied. Three adversarial rounds established this empirically; both limits
 * below are of exactly that shape, and were found only by attacking the fence.
 *
 *   #1 `arguments`. Inside `conditionFromBody`, `arguments[0]` IS `planetData`.
 *      `Identifier` is MODELLED, so the sweep is satisfied; the rule has no case
 *      for the name, so `arguments[0].tidalHeating` records no read and produces
 *      no finding. The `usesArguments` guard covers a resolvable in-file callee's
 *      arguments object, never the adapter's own — and it returns false for arrow
 *      functions, which inherit the enclosing `arguments`.
 *   #2 Callee resolution is not JavaScript's. `fnNamed` consults only `scope.fns`
 *      (FunctionDeclarations and `const f = <function literal>`), so a nearer
 *      binding of the same name that is NOT a function literal is invisible and
 *      the call MIS-resolves to an outer function — which is worse than failing
 *      to resolve, because the unknown-callee escape never fires.
 *
 * WHY THESE SHIP RATHER THAN BLOCK, and what that costs. Both require deliberate
 * evasion: writing `arguments[0]` where `planetData` is in scope, or shadowing a
 * function name with a non-function binding. Neither is an idiom this file uses.
 * PLAN §11.1's D clause was amended on 2026-08-08 to ask whether the next step's
 * move can be written past the gate BY AN AUTHOR FOLLOWING THE FILE'S OWN IDIOMS
 * — because the unamended question ("can it be written past at all?") is always
 * eventually YES for any static analysis, and cannot terminate. This fence is for
 * catching mistakes. It is NOT an adversarial boundary and must never be cited as
 * one: anyone willing to write `arguments[0]` to dodge it can equally edit it.
 * Ledger rows C5 and C6 carry both limits; closing them is a named follow-on.
 */
const ESTREE_UNIVERSE = Object.freeze([
  'ArgumentPlaceholder', 'ArrayExpression', 'ArrayPattern', 'ArrowFunctionExpression',
  'AssignmentExpression', 'AssignmentPattern', 'AwaitExpression', 'BigIntLiteral',
  'BinaryExpression', 'BindExpression', 'BlockStatement', 'BooleanLiteral',
  'BreakStatement', 'CallExpression', 'CatchClause', 'ClassAccessorProperty',
  'ClassBody', 'ClassDeclaration', 'ClassExpression', 'ClassMethod',
  'ClassPrivateMethod', 'ClassPrivateProperty', 'ClassProperty', 'ConditionalExpression',
  'ContinueStatement', 'DebuggerStatement', 'DecimalLiteral', 'Decorator',
  'Directive', 'DirectiveLiteral', 'DoExpression', 'DoWhileStatement',
  'EmptyStatement', 'ExportAllDeclaration', 'ExportDefaultDeclaration', 'ExportDefaultSpecifier',
  'ExportNamedDeclaration', 'ExportNamespaceSpecifier', 'ExportSpecifier', 'ExpressionStatement',
  'File', 'ForInStatement', 'ForOfStatement', 'ForStatement',
  'FunctionDeclaration', 'FunctionExpression', 'Identifier', 'IfStatement', 'Import',
  'ImportAttribute', 'ImportDeclaration', 'ImportDefaultSpecifier', 'ImportExpression',
  'ImportNamespaceSpecifier', 'ImportSpecifier', 'InterpreterDirective', 'LabeledStatement',
  'LogicalExpression', 'MemberExpression', 'MetaProperty', 'ModuleExpression',
  'NewExpression', 'Noop', 'NullLiteral', 'NumericLiteral',
  'ObjectExpression', 'ObjectMethod', 'ObjectPattern', 'ObjectProperty',
  'OptionalCallExpression', 'OptionalMemberExpression', 'ParenthesizedExpression', 'PipelineBareFunction',
  'PipelinePrimaryTopicReference', 'PipelineTopicExpression', 'Placeholder', 'PrivateName',
  'Program', 'RecordExpression', 'RegExpLiteral', 'RestElement',
  'ReturnStatement', 'SequenceExpression', 'SpreadElement', 'StaticBlock',
  'StringLiteral', 'Super', 'SwitchCase', 'SwitchStatement',
  'TaggedTemplateExpression', 'TemplateElement', 'TemplateLiteral', 'ThisExpression',
  'ThrowStatement', 'TopicReference', 'TryStatement', 'TupleExpression',
  'UnaryExpression', 'UpdateExpression', 'V8IntrinsicIdentifier', 'VariableDeclaration',
  'VariableDeclarator', 'VoidPattern', 'WhileStatement', 'WithStatement',
  'YieldExpression',
]);

const LEDGER_MODELLED = new Set(Object.keys(NODE_TYPE_LEDGER.MODELLED));
const LEDGER_ON_CONTACT = new Set(Object.keys(NODE_TYPE_LEDGER.REJECTED_LOUD_ON_CONTACT));
const LEDGER_ON_SIGHT = new Set(Object.keys(NODE_TYPE_LEDGER.REJECTED_LOUD_ON_SIGHT));
const LEDGER_IGNORED = new Set(Object.keys(NODE_TYPE_LEDGER.IGNORED_WITH_REASON));

/**
 * ⛔ THE LOUD-RED GUARD. `@babel/parser` is declared in package.json as a
 * devDependency (`^7.29.3`). If it ever fails to resolve, this fence must go
 * RED with its own name on it — it must never quietly fall back to a text scan,
 * because a degraded fence that still passes is exactly the failure this whole
 * file exists to stop. An unresolvable module fails the import above and takes
 * the suite with it; a resolvable module that is not a parser fails here.
 */
function parseAdapterSource(src) {
  const parse = babelParser && babelParser.parse;
  if (typeof parse !== 'function') {
    throw new Error(
      'PROVENANCE_FENCE_PARSER_UNAVAILABLE: `@babel/parser` did not resolve to a parse() function. '
      + 'This fence is an AST analysis and CANNOT degrade to a text scan — reinstall '
      + '`@babel/parser` (devDependency, ^7.29.3) rather than weakening the gate.',
    );
  }
  return parse(src, PARSE_OPTS);
}

const AST_SKIP_KEYS = new Set(['loc', 'start', 'end', 'range', 'extra',
  'leadingComments', 'trailingComments', 'innerComments', 'comments', 'tokens']);

/** Every child NODE of an AST node, whatever the field names are. */
function childNodes(node) {
  const out = [];
  for (const k of Object.keys(node)) {
    if (AST_SKIP_KEYS.has(k)) continue;
    const v = node[k];
    if (Array.isArray(v)) { for (const c of v) if (c && typeof c.type === 'string') out.push(c); }
    else if (v && typeof v.type === 'string') out.push(v);
  }
  return out;
}

const FN_TYPES = new Set(['FunctionDeclaration', 'FunctionExpression',
  'ArrowFunctionExpression', 'ObjectMethod', 'ClassMethod', 'ClassPrivateMethod']);
const isFn = (n) => FN_TYPES.has(n.type);

/**
 * A tainted value is identified by its PATH off the adapter's input: `''` is the
 * input object itself (`planetData` / `d`), `'composition'` is `comp`, and deeper
 * reads dot on. Only those two are "namespaces" whose FIELDS the coverage map
 * enumerates, so only those two matter when a value escapes the analysis.
 */
const INPUT_NAMESPACES = new Set(['', 'composition']);
const nsName = (t) => (t === '' ? '`planetData`' : '`planetData.composition`');

/** A read path in the coverage map's own namespace. See the truncation note above. */
function normalizeRead(path) {
  const parts = path.split('.');
  if (parts[0] === 'composition') return parts.length === 1 ? 'd.composition' : `comp.${parts[1]}`;
  return `d.${parts[0]}`;
}

/** The property name a member expression reads, or null if it is not statically known. */
function staticPropOf(node) {
  if (!node.computed) {
    if (node.property.type === 'Identifier') return node.property.name;
    if (node.property.type === 'PrivateName') return `#${node.property.id.name}`;
    return null;
  }
  const p = node.property;
  if (p.type === 'StringLiteral') return p.value;
  if (p.type === 'NumericLiteral') return String(p.value);
  if (p.type === 'TemplateLiteral' && p.expressions.length === 0 && p.quasis.length === 1) {
    return p.quasis[0].value.cooked;
  }
  return null;
}

/**
 * Scopes, at FUNCTION granularity. Block scopes are deliberately collapsed into
 * their enclosing function: that MERGES a block-level shadow with the outer name
 * instead of separating them, which can only ever over-report. A fence that
 * over-reports goes red and gets a rename; one that under-reports is the thing
 * this file exists to prevent.
 */
function buildScopes(program) {
  const scopeOfFn = new Map();
  const mk = (node, parent) => ({ node, parent, declared: new Set(), tags: new Map(), fns: new Map() });
  const rootScope = mk(program, null);
  scopeOfFn.set(program, rootScope);

  const declarePattern = (pat, scope) => {
    if (!pat) return;
    switch (pat.type) {
      case 'Identifier': scope.declared.add(pat.name); break;
      case 'ObjectPattern':
        for (const p of pat.properties) declarePattern(p.type === 'RestElement' ? p.argument : p.value, scope);
        break;
      case 'ArrayPattern': for (const e of pat.elements) declarePattern(e, scope); break;
      case 'AssignmentPattern': declarePattern(pat.left, scope); break;
      case 'RestElement': declarePattern(pat.argument, scope); break;
      default: break;
    }
  };

  const walk = (node, scope) => {
    let inner = scope;
    if (isFn(node)) {
      inner = mk(node, scope);
      scopeOfFn.set(node, inner);
      for (const p of node.params) declarePattern(p, inner);
      if (node.type === 'FunctionExpression' && node.id) inner.declared.add(node.id.name);
    }
    if (node.type === 'VariableDeclaration') for (const dcl of node.declarations) declarePattern(dcl.id, scope);
    if (node.type === 'FunctionDeclaration' && node.id) { scope.declared.add(node.id.name); scope.fns.set(node.id.name, node); }
    if ((node.type === 'ClassDeclaration' || node.type === 'ClassExpression') && node.id) scope.declared.add(node.id.name);
    if (node.type === 'ImportDeclaration') for (const sp of node.specifiers) scope.declared.add(sp.local.name);
    if (node.type === 'VariableDeclarator' && node.id.type === 'Identifier' && node.init && isFn(node.init)) {
      scope.fns.set(node.id.name, node.init);
    }
    if (node.type === 'CatchClause') declarePattern(node.param, scope);
    for (const c of childNodes(node)) walk(c, inner);
  };
  walk(program, rootScope);
  return { rootScope, scopeOfFn };
}

/** Does this function mention `arguments`, outside any nested non-arrow function? */
const ARGUMENTS_CACHE = new WeakMap();
function usesArguments(fn) {
  if (fn.type === 'ArrowFunctionExpression') return false;
  if (ARGUMENTS_CACHE.has(fn)) return ARGUMENTS_CACHE.get(fn);
  let found = false;
  (function scan(node, top) {
    if (found) return;
    if (!top && isFn(node) && node.type !== 'ArrowFunctionExpression') return;
    if (node.type === 'Identifier' && node.name === 'arguments') { found = true; return; }
    for (const c of childNodes(node)) scan(c, false);
  })(fn, true);
  ARGUMENTS_CACHE.set(fn, found);
  return found;
}

const declScopeOf = (name, scope) => {
  for (let s = scope; s; s = s.parent) if (s.declared.has(name)) return s;
  return null;
};
const fnNamed = (name, scope) => {
  for (let s = scope; s; s = s.parent) if (s.fns.has(name)) return s.fns.get(name);
  return null;
};

/**
 * THE ANALYSIS. Returns the reads OUTSIDE `provenanceOf`, the reads INSIDE it,
 * every place a bare input escaped the walk, and the module's export surface.
 */
function analyzeAdapterSource(src, opts = {}) {
  const adapterName = opts.adapter || 'conditionFromBody';
  const excisedName = opts.excised || 'provenanceOf';
  // ⛔ THE MUTATION LEVER (PLAN §11.3.1). `forgetTypes` drops node types out of the
  // ledger AT RUN TIME, so the completeness sweep can be shown to FIRE on a real
  // adapter instead of being asserted to work. A sweep that has never gone red is
  // not a sweep. It is only ever set by the control rows below.
  const forget = new Set(opts.forgetTypes || []);
  const modelled = new Set([...LEDGER_MODELLED].filter((t) => !forget.has(t)));
  const knownTypes = new Set([...modelled, ...LEDGER_ON_CONTACT, ...LEDGER_IGNORED]
    .filter((t) => !forget.has(t)));
  const program = parseAdapterSource(src).program;
  const { rootScope, scopeOfFn } = buildScopes(program);
  const lineOf = (n) => (n && n.loc ? n.loc.start.line : '?');

  // ── THE COMPLETENESS SWEEP. Independent of the taint walk, and deliberately so:
  // it answers "is there anything in this module I have no rule for?" without
  // needing a tracked value to reach it first. Anything outside the ledger — a
  // REJECTED-LOUD-on-sight type, or a type nobody has ever bucketed — is named
  // here with its line. This is the inversion: silence now has to be EARNED.
  const sweep = [];
  (function scan(node) {
    if (!knownTypes.has(node.type)) {
      sweep.push(`unmodelled: ${node.type} at line ${lineOf(node)} — this node type is in `
        + 'no NODE_TYPE_LEDGER bucket, so the walk has no rule for it and cannot claim it '
        + 'does not carry the adapter\'s input');
    }
    for (const c of childNodes(node)) scan(c);
  })(program);

  let adapterFn = null;
  let excisedFn = null;
  const allFns = [];
  const exportNames = new Set();
  (function find(node) {
    if (isFn(node)) {
      allFns.push(node);
      const nm = node.type === 'FunctionDeclaration' && node.id ? node.id.name : null;
      if (nm === adapterName) adapterFn = node;
      if (nm === excisedName) excisedFn = node;
    }
    if (node.type === 'VariableDeclarator' && node.id.type === 'Identifier' && node.init && isFn(node.init)) {
      if (node.id.name === adapterName) adapterFn = node.init;
      if (node.id.name === excisedName) excisedFn = node.init;
    }
    if (node.type === 'ExportNamedDeclaration') {
      for (const sp of node.specifiers || []) exportNames.add(sp.exported.name || sp.exported.value);
      const decl = node.declaration;
      if (decl && decl.id) exportNames.add(decl.id.name);
      if (decl && decl.type === 'VariableDeclaration') {
        for (const dcl of decl.declarations) if (dcl.id.type === 'Identifier') exportNames.add(dcl.id.name);
      }
    }
    if (node.type === 'ExportDefaultDeclaration') exportNames.add('default');
    if (node.type === 'ExportAllDeclaration') exportNames.add('*');
    for (const c of childNodes(node)) find(c);
  })(program);

  const paramTags = new Map();
  const returnTags = new Map();
  const paramsOf = (fn) => {
    if (!paramTags.has(fn)) paramTags.set(fn, fn.params.map(() => new Set()));
    return paramTags.get(fn);
  };
  const returnsOf = (fn) => {
    if (!returnTags.has(fn)) returnTags.set(fn, new Set());
    return returnTags.get(fn);
  };

  let reads; let provReads; let findings; let growth = 0;
  const addAll = (dst, more) => { for (const v of more) if (!dst.has(v)) { dst.add(v); growth++; } };

  function run() {
    reads = new Set(); provReads = new Set(); findings = new Set();
    const note = (msg) => findings.add(msg);
    const record = (path, inProv) => { (inProv ? provReads : reads).add(normalizeRead(path)); };
    const bindName = (name, tags, scope) => {
      if (!tags || tags.size === 0) return;
      const s = declScopeOf(name, scope) || scope;
      if (!s.tags.has(name)) s.tags.set(name, new Set());
      addAll(s.tags.get(name), tags);
    };
    /** A tainted value reaching somewhere the walk cannot follow. Only the two
     *  enumerated namespaces matter — deeper paths truncate onto a declared row. */
    const escapeCheck = (tags, what) => { for (const t of tags) if (INPUT_NAMESPACES.has(t)) note(`${what} ${nsName(t)}`); };

    /** Destructuring IS reading: `const { a: { b } } = d` reads d.a and d.a.b. */
    function bindPattern(pat, tags, scope, ctx) {
      if (!pat) return;
      switch (pat.type) {
        case 'Identifier': bindName(pat.name, tags, scope); return;
        // ⛔ A DEFAULT IS AN ALTERNATIVE SOURCE FOR THE BINDING, NOT DECORATION. Found by
        // attacking this round's own fence; both forms were silent:
        //     function h(x, y = x){ return y.tidalHeating; }   h(d)
        //     const { nope: { deep } = d } = {};               → reads d.deep
        // Round 2 evaluated `pat.right` (so a read INSIDE it was recorded) and then bound the
        // left to the INCOMING tags only, dropping the default's. The binding is the union:
        // may-alias, and "may" is the safe side.
        case 'AssignmentPattern': {
          const dflt = expr(pat.right, scope, ctx);
          bindPattern(pat.left, new Set([...tags, ...dflt]), scope, ctx);
          return;
        }
        case 'RestElement': bindPattern(pat.argument, tags, scope, ctx); return;
        case 'ArrayPattern':
          // Array-destructuring the input treats it as an ITERABLE, which no static
          // property path describes. Reported rather than bound to nothing.
          escapeCheck(tags, 'array-destructured (treated as iterable):');
          for (const e of pat.elements) bindPattern(e, new Set(), scope, ctx);
          return;
        case 'ObjectPattern': {
          for (const p of pat.properties) {
            if (p.type === 'RestElement') { bindPattern(p.argument, tags, scope, ctx); continue; }
            let key = null;
            if (!p.computed && p.key.type === 'Identifier') key = p.key.name;
            else if (p.key.type === 'StringLiteral') key = p.key.value;
            else if (p.key.type === 'NumericLiteral') key = String(p.key.value);
            else { expr(p.key, scope, ctx); for (const t of tags) note(`dynamic read: ${nsName(t)}[<computed>] in a destructuring pattern`); }
            const sub = new Set();
            if (key !== null) {
              for (const t of tags) { const np = t === '' ? key : `${t}.${key}`; record(np, ctx.inProv); sub.add(np); }
            }
            bindPattern(p.value, sub, scope, ctx);
          }
          return;
        }
        default:
          // ⛔ FAIL-CLOSED. A binding form with no rule cannot be allowed to bind
          // silently — that is exactly how `let p; p = d;` used to disappear.
          note(`unmodelled: ${pat.type} at line ${lineOf(pat)} in a BINDING position — `
            + 'the walk has no rule for this pattern form');
          escapeCheck(tags, `unmodelled binding pattern \`${pat.type}\` receives`);
      }
    }

    /**
     * ⛔ A METHOD OR ACCESSOR WHOSE RETURN CARRIES THE INPUT (bypass O).
     * `const b = { get inner(){ return d; } }; b.inner.x` — round 2 entered the getter,
     * collected `{''}` into its return set, and then dropped it on the floor, because taint
     * through an object PROPERTY SLOT is not modelled by this analysis and never has been.
     * The honest answer is not to model property slots (that is a different analysis); it is
     * to REFUSE the construct by name. Covers `get`/`set`, and plain methods too — a method
     * called as `b.m()` goes through the MemberExpression callee path, where `fnNamed` cannot
     * resolve it either.
     */
    function memberFnCheck(fn, where) {
      const key = fn.key && (fn.key.name || fn.key.value);
      const kind = fn.kind === 'get' || fn.kind === 'set' ? `accessor \`${fn.kind} ${key}\`` : `method \`${key}\``;
      escapeCheck(returnsOf(fn), `unmodelled: ${kind} on ${where} at line ${lineOf(fn)} — `
        + 'taint through a property slot is not modelled, and this returns');
    }

    function enterFn(fn, ctx) {
      const scope = scopeOfFn.get(fn);
      const pt = paramsOf(fn);
      const inner = { inProv: ctx.inProv || fn === excisedFn };
      fn.params.forEach((p, i) => bindPattern(p, pt[i] || new Set(), scope, inner));
      if (fn.body.type === 'BlockStatement') stmt(fn.body, scope, { ...inner, fn });
      else addAll(returnsOf(fn), expr(fn.body, scope, { ...inner, fn }));
    }

    function expr(node, scope, ctx) {
      if (!node) return new Set();
      switch (node.type) {
        case 'Identifier': {
          if (node.name === 'undefined' || node.name === 'NaN' || node.name === 'Infinity') return new Set();
          // ⛔ A FUNCTION USED AS A VALUE, WHOSE RETURN CARRIES THE INPUT. `const f = () => d;
          // foo(f);` — the walk routes `f()` but not `f`. Where an unknown callee decides to
          // invoke it is outside this analysis, so it is named rather than dropped. (The CALLEE
          // position never reaches this case: CallExpression resolves an Identifier callee itself.)
          const asValue = fnNamed(node.name, scope);
          if (asValue) {
            escapeCheck(returnsOf(asValue), `unmodelled: \`${node.name}\` at line ${lineOf(node)} `
              + 'is a function used as a VALUE — where it is later called is not modelled, and its return carries');
          }
          const s = declScopeOf(node.name, scope);
          const t = s && s.tags.get(node.name);
          return t ? new Set(t) : new Set();
        }
        case 'ThisExpression': case 'Super': case 'Import':
        case 'StringLiteral': case 'NumericLiteral': case 'BooleanLiteral':
        case 'NullLiteral': case 'RegExpLiteral': case 'BigIntLiteral':
          return new Set();
        case 'ParenthesizedExpression': case 'TSNonNullExpression': case 'TSAsExpression':
          return expr(node.expression, scope, ctx);
        case 'MemberExpression': case 'OptionalMemberExpression': {
          const objT = expr(node.object, scope, ctx);
          if (node.computed) expr(node.property, scope, ctx);
          if (objT.size === 0) return new Set();
          const prop = staticPropOf(node);
          if (prop === null) {
            for (const t of objT) note(`dynamic read: ${nsName(INPUT_NAMESPACES.has(t) ? t : '')}[<computed>] — the field name is not statically known`);
            return new Set();
          }
          const out = new Set();
          for (const t of objT) { const np = t === '' ? prop : `${t}.${prop}`; record(np, ctx.inProv); out.add(np); }
          return out;
        }
        case 'CallExpression': case 'OptionalCallExpression': case 'NewExpression': {
          let fn = null;
          let label = '<expression>';
          const callee = node.callee;
          // ⛔ SOURCE BUILT AT RUNTIME IS OUTSIDE EVERY STATIC ANALYSIS. Rejected on
          // sight rather than analysed: the string is parsed by nothing this can see.
          if ((callee.type === 'Identifier' && (callee.name === 'eval' || callee.name === 'Function'))
            || ((callee.type === 'MemberExpression' || callee.type === 'OptionalMemberExpression')
              && staticPropOf(callee) === 'constructor')) {
            note('escape: runtime-constructed source (`eval` / `new Function`) cannot be analysed');
          }
          if (callee.type === 'Identifier') { fn = fnNamed(callee.name, scope); label = `${callee.name}(…)`; }
          else if (callee.type === 'MemberExpression' || callee.type === 'OptionalMemberExpression') {
            expr(callee, scope, ctx);
            label = `${callee.object.type === 'Identifier' ? callee.object.name : '…'}.${staticPropOf(callee) ?? '[…]'}(…)`;
          } else if (callee.type === 'ArrowFunctionExpression' || callee.type === 'FunctionExpression') {
            // An IIFE. Its return IS this call's value, so it is ROUTED rather than
            // walked-and-discarded — `(() => d)().tidalHeating` used to lose the tag here.
            enterFn(callee, ctx);
            fn = callee;
            label = 'an immediately-invoked function expression(…)';
          } else expr(callee, scope, ctx);
          const argT = node.arguments.map((a) => expr(a.type === 'SpreadElement' ? a.argument : a, scope, ctx));
          // ⛔ A GENERATOR OR ASYNC CALLEE IS REJECTED, NOT ROUTED (bypass P). `g(d)` does not
          // return `returnsOf(g)` — it returns an ITERATOR (or a promise), and the input reaches
          // the caller through `.next().value` / `await`, a channel with no binding for the walk
          // to follow. The arguments are still bound to the parameters so reads INSIDE the body
          // are recorded; what is refused is the pretence that the call's VALUE is understood.
          const opaqueResult = !!fn && (fn.generator || fn.async);
          if (opaqueResult) {
            const how = `${fn.generator ? 'generator' : 'async'} function — its `
              + `${fn.generator ? 'iterator' : 'promise'} plumbing is not modelled`;
            for (const t of argT) {
              escapeCheck(t, `unmodelled: \`${label}\` at line ${lineOf(node)} is a ${how}, and it receives`);
            }
            // ⛔ AND THE RETURN SIDE, which the argument check does NOT cover. Found by
            // attacking this round's own fence: `const q = (async () => d)();` takes no
            // argument at all, so the loop above never fires, and the input still leaves
            // through the promise. `(await q).tidalHeating` was silent.
            escapeCheck(returnsOf(fn), `unmodelled: \`${label}\` at line ${lineOf(node)} is a ${how}, `
              + 'and its return leaves through that channel carrying');
          }
          if (fn) {
            const pt = paramsOf(fn);
            node.arguments.forEach((a, i) => {
              if (a.type === 'SpreadElement') { escapeCheck(argT[i], `spread argument into \`${label}\` carries`); return; }
              const p = fn.params[i];
              if (p && p.type !== 'RestElement') addAll(pt[i], argT[i]);
              else if (p) escapeCheck(argT[i], `rest parameter of \`${label}\` receives`);
              else escapeCheck(argT[i], `\`${label}\` receives, past its declared parameters,`);
              // `arguments` re-aliases every argument under a name no parameter carries.
              if (usesArguments(fn)) escapeCheck(argT[i], `\`${label}\` reads \`arguments\`, which re-aliases`);
            });
          } else argT.forEach((t) => escapeCheck(t, `escape: \`${label}\` receives`));
          return fn && !opaqueResult ? new Set(returnsOf(fn)) : new Set();
        }
        case 'LogicalExpression':
          return new Set([...expr(node.left, scope, ctx), ...expr(node.right, scope, ctx)]);
        case 'ConditionalExpression':
          expr(node.test, scope, ctx);
          return new Set([...expr(node.consequent, scope, ctx), ...expr(node.alternate, scope, ctx)]);
        case 'SequenceExpression': {
          let last = new Set();
          for (const e of node.expressions) last = expr(e, scope, ctx);
          return last;
        }
        case 'AssignmentExpression': {
          const rt = expr(node.right, scope, ctx);
          const op = node.operator;
          // ⛔ LOGICAL ASSIGNMENT BINDS (bypasses L / M / N). `_z ||= d`, `_z &&= d` and
          // `_z ??= d` all put the RIGHT operand's value into the LEFT binding on the branch
          // that assigns. Round 2 lumped them into the `else` below, which READ the left and
          // dropped the binding — so `_z.tidalHeating` afterwards resolved to nothing and the
          // fence was silent. `?? ||` conditionality does not matter: this analysis is a
          // may-alias analysis, and "may" is the safe side.
          if (op === '=' || op === '||=' || op === '&&=' || op === '??=') {
            if (node.left.type === 'MemberExpression' || node.left.type === 'OptionalMemberExpression') {
              expr(node.left, scope, ctx);
              escapeCheck(rt, 'stored into a property:');
            } else {
              if (op !== '=') expr(node.left, scope, ctx);   // a logical assignment READS the left first
              bindPattern(node.left, rt, scope, ctx);        // ← bypass H lives here
            }
          } else {
            // `+= -= *= …` force ToPrimitive on both operands, i.e. an implicit
            // `valueOf`/`toString` call on the tracked object. What that reads is decided at
            // run time by the prototype chain, so it is refused rather than guessed at.
            expr(node.left, scope, ctx);
            escapeCheck(rt, `unmodelled: compound assignment \`${op}\` at line ${lineOf(node)} `
              + 'coerces through valueOf/toString, which is a read path the walk cannot follow, of');
          }
          return rt;
        }
        case 'UnaryExpression': case 'UpdateExpression': expr(node.argument, scope, ctx); return new Set();
        case 'BinaryExpression': {
          if (node.left.type !== 'PrivateName') expr(node.left, scope, ctx);
          const r = expr(node.right, scope, ctx);
          // `'x' in d` is an existence probe, which is a read of x.
          if (node.operator === 'in' && r.size && node.left.type === 'StringLiteral') {
            for (const t of r) record(t === '' ? node.left.value : `${t}.${node.left.value}`, ctx.inProv);
          }
          return new Set();
        }
        case 'ObjectExpression': {
          const out = new Set();
          for (const p of node.properties) {
            if (p.type === 'SpreadElement') { for (const t of expr(p.argument, scope, ctx)) out.add(t); continue; }  // ← bypass I
            if (p.computed) expr(p.key, scope, ctx);
            if (p.type === 'ObjectMethod') { enterFn(p, ctx); memberFnCheck(p, 'an object literal'); continue; }
            escapeCheck(expr(p.value, scope, ctx), 'stored into an object literal:');
          }
          return out;
        }
        case 'ArrayExpression':
          for (const e of node.elements) {
            if (!e) continue;
            escapeCheck(expr(e.type === 'SpreadElement' ? e.argument : e, scope, ctx), 'stored into an array literal:');
          }
          return new Set();
        case 'ArrowFunctionExpression': case 'FunctionExpression':
          // A function literal reached as an EXPRESSION VALUE. `const f = () => d` never gets
          // here (the declaration case enters it by name, so its call sites resolve); what does
          // get here is a callback argument, a property value, a returned closure — positions
          // where the walk cannot say who calls it. If its return carries the input, say so.
          enterFn(node, ctx);
          escapeCheck(returnsOf(node), `unmodelled: a function literal at line ${lineOf(node)} `
            + 'escapes into a position the walk cannot route, and its return carries');
          return new Set();
        case 'ClassExpression': case 'ClassDeclaration': {
          if (node.superClass) expr(node.superClass, scope, ctx);
          for (const el of node.body.body) {
            // ⛔ CLASS STATIC BLOCK (bypass K). Round 2 never visited this node at all: it is
            // neither `isFn` nor does it have `.value`, so the whole block — statements,
            // assignments, reads and all — fell out of the analysis in complete silence.
            if (el.type === 'StaticBlock') { for (const s of el.body) stmt(s, scope, ctx); continue; }
            if (el.computed && el.key) expr(el.key, scope, ctx);
            if (isFn(el)) { enterFn(el, ctx); memberFnCheck(el, 'a class body'); continue; }
            if (el.value) escapeCheck(expr(el.value, scope, ctx), 'stored into a class field:');
          }
          return new Set();
        }
        case 'TemplateLiteral':
          for (const e of node.expressions) expr(e, scope, ctx);
          return new Set();
        case 'TaggedTemplateExpression':
          expr(node.tag, scope, ctx);
          for (const e of node.quasi.expressions) escapeCheck(expr(e, scope, ctx), 'escape: a tagged template receives');
          return new Set();
        // `await x` is the identity on a non-thenable, and EVERY route into an async
        // function is refused at its call site, so nothing tracked can arrive by one.
        case 'AwaitExpression': return expr(node.argument, scope, ctx);
        // ⛔ `yield` HANDS THE VALUE TO THE GENERATOR'S CONSUMER (bypass P). Round 2 treated it
        // as a passthrough, which is backwards twice over: the yielded value goes OUT through
        // `.next().value` (a channel with no binding here) and the expression's own value comes
        // IN from whatever the consumer passes to `next()`.
        case 'YieldExpression':
          escapeCheck(expr(node.argument, scope, ctx), `unmodelled: \`yield\` at line ${lineOf(node)} `
            + 'hands a value to the generator\'s consumer, which no binding in this walk names —');
          return new Set();
        default:
          // ⛔ FAIL-CLOSED SELF-AUDIT. Reaching here with a type the LEDGER calls MODELLED means
          // the ledger and the code disagree — the row claims a rule that is not written.
          if (modelled.has(node.type)) {
            note(`unmodelled: ${node.type} at line ${lineOf(node)} is listed MODELLED in `
              + 'NODE_TYPE_LEDGER but reached the expression walk\'s default branch — the rule it claims does not exist');
          }
          for (const c of childNodes(node)) escapeCheck(expr(c, scope, ctx), `unhandled syntax: ${node.type} receives`);
          return new Set();
      }
    }

    function stmt(node, scope, ctx) {
      if (!node) return;
      switch (node.type) {
        case 'VariableDeclaration':
          for (const d of node.declarations) {
            // `const f = () => …` / `const f = function () {…}` — `buildScopes` registered `f`
            // in `scope.fns`, so every `f(…)` resolves and the return value is ROUTED. Entering
            // it here rather than through the generic expression case is what keeps a perfectly
            // ordinary named helper from being reported as an escaping function literal.
            if (d.init && isFn(d.init) && d.id.type === 'Identifier') { enterFn(d.init, ctx); continue; }
            bindPattern(d.id, expr(d.init, scope, ctx), scope, ctx);
          }
          return;
        case 'FunctionDeclaration': enterFn(node, ctx); return;
        case 'ClassDeclaration': expr(node, scope, ctx); return;
        case 'ExpressionStatement': expr(node.expression, scope, ctx); return;
        case 'ReturnStatement': { const t = expr(node.argument, scope, ctx); if (ctx.fn) addAll(returnsOf(ctx.fn), t); return; }
        case 'Program': case 'BlockStatement': for (const s of node.body) stmt(s, scope, ctx); return;
        case 'IfStatement':
          expr(node.test, scope, ctx); stmt(node.consequent, scope, ctx); stmt(node.alternate, scope, ctx); return;
        case 'ForStatement':
          if (node.init) { if (node.init.type === 'VariableDeclaration') stmt(node.init, scope, ctx); else expr(node.init, scope, ctx); }
          expr(node.test, scope, ctx); expr(node.update, scope, ctx); stmt(node.body, scope, ctx); return;
        case 'ForOfStatement': case 'ForInStatement':
          escapeCheck(expr(node.right, scope, ctx), `enumeration: \`for…${node.type === 'ForOfStatement' ? 'of' : 'in'}\` over`);
          if (node.left.type === 'VariableDeclaration') bindPattern(node.left.declarations[0].id, new Set(), scope, ctx);
          else expr(node.left, scope, ctx);
          stmt(node.body, scope, ctx); return;
        case 'WhileStatement': case 'DoWhileStatement': expr(node.test, scope, ctx); stmt(node.body, scope, ctx); return;
        case 'TryStatement':
          stmt(node.block, scope, ctx);
          if (node.handler) {
            // ⛔ THE CATCH PARAMETER IS WALKED AS A PATTERN, not just declared. Found by
            // attacking this round's own fence: `catch ({ message = d })` puts a DEFAULT
            // expression inside the binding, and round 2 never visited `handler.param` at
            // all — so the default was neither evaluated nor bound. The caught value
            // itself carries no tags (ThrowStatement is rejected loudly instead), but the
            // pattern around it is ordinary syntax and gets the ordinary rule.
            bindPattern(node.handler.param, new Set(), scope, ctx);
            stmt(node.handler.body, scope, ctx);
          }
          stmt(node.finalizer, scope, ctx); return;
        case 'SwitchStatement':
          expr(node.discriminant, scope, ctx);
          for (const c of node.cases) { expr(c.test, scope, ctx); for (const s of c.consequent) stmt(s, scope, ctx); }
          return;
        // ⛔ FOUND BY ATTACKING THIS ROUND'S OWN FENCE, AND IT WAS SILENT.
        //     `let q; try { throw d; } catch (e) { q = e.tidalHeating; }`
        // and its across-a-function form `function boom(x){ throw x; } … catch (e)`.
        // A throw carries a value to a catch BINDING through the unwind, which this walk
        // has no representation for — `buildScopes` declares the catch parameter with no
        // tags, so the value arrived under a name the analysis believed was clean. Binding
        // the catch parameter to "everything thrown anywhere in the try" would be a second
        // fixpoint over a control-flow graph this file does not build, so the construct is
        // REFUSED instead: a tracked value reaching a `throw` is a named finding.
        case 'ThrowStatement':
          escapeCheck(expr(node.argument, scope, ctx), `unmodelled: \`throw\` at line ${lineOf(node)} `
            + 'unwinds a value into a catch binding the walk does not connect —');
          return;
        case 'LabeledStatement': stmt(node.body, scope, ctx); return;
        case 'ExportNamedDeclaration': case 'ExportDefaultDeclaration':
          if (node.declaration) {
            if (/Declaration$/.test(node.declaration.type)) stmt(node.declaration, scope, ctx);
            else expr(node.declaration, scope, ctx);
          }
          return;
        case 'ImportDeclaration': case 'ExportAllDeclaration': case 'EmptyStatement':
        case 'BreakStatement': case 'ContinueStatement': case 'DebuggerStatement':
          return;
        case 'WithStatement':   // unreachable in module source; kept so it is never silent
          escapeCheck(expr(node.object, scope, ctx), 'escape: `with` over');
          stmt(node.body, scope, ctx); return;
        default:
          // Same self-audit as the expression walk: a MODELLED row that lands here is a
          // rule the ledger claims and the code does not have.
          if (modelled.has(node.type)) {
            note(`unmodelled: ${node.type} at line ${lineOf(node)} is listed MODELLED in `
              + 'NODE_TYPE_LEDGER but reached the statement walk\'s default branch — the rule it claims does not exist');
          }
          for (const c of childNodes(node)) {
            if (/Statement|Declaration/.test(c.type)) stmt(c, scope, ctx);
            else escapeCheck(expr(c, scope, ctx), `unhandled syntax: ${node.type} receives`);
          }
      }
    }

    // ── SEEDING. The adapter's own first parameter IS the input; and so is any
    // parameter spelled `planetData`, so a copy-pasted SECOND entry point into this
    // seam is analysed rather than ignored. (A second entry point under a different
    // parameter name is not decidable from this file — that one is caught by pinning
    // the module's export surface, asserted below.)
    if (adapterFn) { const pt = paramsOf(adapterFn); if (pt.length) addAll(pt[0], new Set([''])); }
    for (const fn of allFns) {
      const pt = paramsOf(fn);
      fn.params.forEach((p, i) => { if (p.type === 'Identifier' && p.name === 'planetData') addAll(pt[i], new Set([''])); });
    }
    stmt(program, rootScope, { inProv: false, fn: null });
  }

  if (!adapterFn) {
    return { ok: false, why: `the adapter \`${adapterName}\` was not found in this source`,
      reads: new Set(), provReads: new Set(), findings: [...sweep].sort(), excisionFound: !!excisedFn,
      exportNames: [...exportNames].sort(), passes: 0 };
  }

  // ⛔ THE FIXPOINT. One pass cannot resolve a chain (`const a = d; const b = a;`
  // read in the other order, or a helper called before it is walked). Measured on
  // the real adapter: 4 passes. Non-convergence is a RED, never a truncated answer.
  let passes = 0;
  do { growth = 0; run(); passes++; } while (growth > 0 && passes < 24);
  const converged = growth === 0;
  // The type sweep is independent of the taint fixpoint and is folded in last, so an
  // unmodelled construct is reported whether or not the walk ever reached it with a value.
  for (const m of sweep) findings.add(m);
  return {
    ok: converged,
    why: converged ? null : 'the alias fixpoint did not converge in 24 passes',
    reads, provReads, findings: [...findings].sort(), excisionFound: !!excisedFn,
    exportNames: [...exportNames].sort(), passes,
  };
}

/** The fail-closed half of a result: everything the walk refused to model. */
const unmodelledHits = (f) => (f.findings || []).filter((m) => m.startsWith('unmodelled:'));

/**
 * THE WHOLE FENCE, as one function over source TEXT, so the CONTROL below runs the
 * REAL fence over synthetic adapters instead of a paraphrase that could drift from it.
 *
 * `undeclared` / `stale` are computed over the reads OUTSIDE `provenanceOf`;
 * `provUndeclared` is the one-directional check on the reads INSIDE it.
 */
function fenceFindings(src, declared, opts = {}) {
  let a;
  try { a = analyzeAdapterSource(src, opts); } catch (e) {
    return { ok: false, why: String(e && e.message), reads: new Set(), provReads: new Set(),
      undeclared: [], provUndeclared: [], stale: [], findings: [`fence error: ${e && e.message}`],
      excisionFound: false, exportNames: [], passes: 0 };
  }
  return {
    ...a,
    undeclared: [...a.reads].filter((r) => !declared.has(r)).sort(),
    provUndeclared: [...a.provReads].filter((r) => !declared.has(r)).sort(),
    stale: [...declared].filter((r) => !a.reads.has(r)).sort(),
  };
}

/** Every finding the fence produced, flattened — non-empty means CAUGHT. */
const caughtBy = (f) => [
  ...(f.ok ? [] : [`fence could not run: ${f.why}`]),
  ...f.undeclared.map((r) => `undeclared read ${r}`),
  ...f.provUndeclared.map((r) => `undeclared read ${r}`),
  ...f.findings,
];

const ADAPTER_SRC = () => readFileSync(
  fileURLToPath(new URL('../src/worldengine/port/conditionFromBody.js', import.meta.url)), 'utf8',
);

/** The adapter's own reads, extracted from disk. */
function adapterReads() {
  return analyzeAdapterSource(ADAPTER_SRC());
}

/**
 * The synthetic adapter every control row is built from. `provLine` injects INTO
 * `provenanceOf`, which is the only way to exercise the excision from both sides.
 */
const syntheticAdapter = ({ moduleScope = '', preamble = '', fpLine = '', provLine = '' }) => `
      ${moduleScope}
      export function conditionFromBody(planetData) {
        const d = planetData || {};
        const comp = d.composition || {};
        ${preamble}
        const fp = {
          radiusEarth: d.radiusEarth ?? 1.0,
          density: comp.density,
          ${fpLine}
        };
        return { fp, p: provenanceOf(d, comp) };
      }
      function provenanceOf(d, comp) {
        ${provLine}
        return { radiusEarth: d.radiusEarth != null, density: comp.density != null };
      }
    `;

describe('Step 1 · _provenance describes THE ADAPTER, not itself', () => {
  it('CONTROL — the fence finds a newly-added read, all SIXTEEN bypasses of it, and stays silent on five legitimate refactors', () => {
    // ⚠ WHY THIS TEST CARRIES SEVERAL CONTROLS RATHER THAN SPLITTING INTO SEVERAL
    // `it`s: Instrument A diffs PER-FILE TEST COUNTS, not only test IDs
    // (`scripts/test-baseline.mjs` — `if (fd.gone.length || fd.appeared.length ||
    // fd.changed.length) drift = true`). Measured: adding two `it` blocks here moved
    // 56 → 58 and Instrument A exited 1 with no test having changed status. Splitting
    // is a re-record, and the baseline is not being re-recorded for a widened gate.
    // Every assertion below names its own row, so attribution survives the merge.
    //
    // ⛔ WITHOUT THIS, THE FENCE BELOW IS UNFALSIFIABLE. An analysis that resolves
    // nothing produces an empty read set that trivially equals an empty declaration
    // and the test passes over any defect at all. So the analyser is run over a
    // SYNTHETIC adapter carrying an undeclared read and required to surface it.
    const synthetic = `
      export function conditionFromBody(planetData) {
        const d = planetData || {};
        const comp = d.composition || {};
        // a comment mentioning d.neverRead must NOT count
        const s = 'a string mentioning d.alsoNeverRead // and a fake comment';
        const fp = {
          radiusEarth: d.radiusEarth ?? 1.0,
          density: comp.density,
          tidalHeat: d.tidalHeating,      // <- Step 2's real next read
          starMassEarth: d.starMassEarth,
        };
        return { fp, s, p: provenanceOf(d, comp) };
      }
      function provenanceOf(d, comp) {
        return { onlyHere: d.excisedFromProvenance, density: comp.density != null };
      }
    `;
    const a = analyzeAdapterSource(synthetic);
    expect(a.ok, `the analysis must converge: ${a.why}`).toBe(true);
    expect([...a.reads].sort()).toEqual(
      ['comp.density', 'd.composition', 'd.radiusEarth', 'd.starMassEarth', 'd.tidalHeating'],
    );
    // ⛔ COMMENTS AND STRINGS ARE NOT STRIPPED ANY MORE — THEY ARE NOT NODES. The old
    // fence needed a hand-written stripper (and a known limit about regex literals);
    // a parser cannot mistake prose for code in the first place. Asserted, not assumed.
    expect(a.reads.has('d.neverRead')).toBe(false);
    expect(a.reads.has('d.alsoNeverRead')).toBe(false);
    // ⛔ AND THE PARTITION IS THE OTHER HALF. `provenanceOf` is the ONE function whose
    // reads do not COUNT as reads-needing-a-row; without this, "partition provenanceOf"
    // and "ignore everything" look identical.
    expect(a.reads.has('d.excisedFromProvenance'), 'provenanceOf\'s body leaked into the '
      + 'reads-needing-a-row set — the record would be on both sides of the fence again').toBe(false);
    expect(a.provReads.has('d.excisedFromProvenance'), 'the partition swallowed the read entirely — '
      + 'provenanceOf must still be REQUIRED to read only declared rows (bypass J)').toBe(true);
    expect(a.reads.has('d.tidalHeating'), 'a read OUTSIDE provenanceOf was partitioned away too').toBe(true);

    // ═══ THE CONTROL TABLE: SIXTEEN WAYS PAST A FENCE, ONE ADAPTER EACH ═══════════
    // ⛔ THIS TABLE IS THE EVIDENCE, KEPT EXECUTABLE (PLAN.md §11.3.1 — "a gate that
    // has never failed is not a gate"). Re-measured against four fences:
    //
    //   row                                    HEAD    round1   round2   round3
    //                                        (regex,  (regex,   (AST,    (AST,
    //                                       body-only)  5+1)  fail-open) fail-CLOSED)
    //   CONTROL · plain direct read            CAUGHT   CAUGHT   CAUGHT   CAUGHT
    //   A · helper taking `d`                  MISSED   CAUGHT   CAUGHT   CAUGHT
    //   B · optional chain `d?.x`              MISSED   CAUGHT   CAUGHT   CAUGHT
    //   C · destructuring `const {x} = d`      MISSED   CAUGHT   CAUGHT   CAUGHT
    //   D · computed access `d["x"]`           MISSED   CAUGHT   CAUGHT   CAUGHT
    //   E · bare alias `const p = d`           MISSED   CAUGHT   CAUGHT   CAUGHT
    //   F · helper, renamed param              MISSED   CAUGHT   CAUGHT   CAUGHT
    //   G · NESTED destructure                 MISSED   MISSED   CAUGHT   CAUGHT
    //   H · split declaration `let p; p = d`   MISSED   MISSED   CAUGHT   CAUGHT
    //   I · object spread `{ ...d }`           MISSED   MISSED   CAUGHT   CAUGHT
    //   J · read INSIDE provenanceOf           MISSED   MISSED   CAUGHT   CAUGHT
    //   K · class static block                 CAUGHT  CAUGHT†   MISSED   CAUGHT   ← read the note
    //   L · logical assignment `_z ||= d`      MISSED   MISSED   MISSED   CAUGHT
    //   M · logical assignment `_z ??= d`      MISSED   MISSED   MISSED   CAUGHT
    //   N · logical assignment `_z &&= d`      MISSED   MISSED   MISSED   CAUGHT
    //   O · accessor property `get inner()`    MISSED   MISSED   MISSED   CAUGHT
    //   P · generator + `yield`                MISSED   MISSED   MISSED   CAUGHT
    //   ───────────────────────────────────────────────────────────────────────────
    //   TOTAL                                  2 / 17  8† / 17  11 / 17  17 / 17
    //   CLEAN adapter (must be silent)         silent   silent   silent   silent
    //
    // ⚠ COLUMN PROVENANCE, because a table nobody can re-run is folklore. The HEAD
    // column was RE-EXECUTED this round: HEAD's extractor and its two assertions were
    // lifted out of `git show HEAD:` and run over all seventeen rows. round1 and
    // round2 are recorded by their own rounds against the same rows and are NOT
    // re-executed here — round 1 and round 2 were never committed, so there is
    // nothing left on disk to run. round3 is executed below, every row.
    //   † the one INFERRED cell in the table, marked rather than blended in. Round 1
    //     never ran row K (it did not exist yet). Its fence is a text scan strictly
    //     wider than HEAD's, and row K's bypass is invisible only to a walk that skips
    //     the node — so round 1 would have caught it. That is reasoning, not a
    //     measurement, and it is labelled so nobody later cites it as one.
    //
    // ⚠⚠ THE `HEAD` COLUMN IS CORRECTED TWICE OVER, AND THE SECOND CORRECTION IS THE
    // INTERESTING ONE.
    //   · It used to read 0/11. That was wrong: HEAD's THIRD `it` scans
    //     `conditionFromPlanet`'s BODY for `\bplanetData\.(\w+)` and requires it
    //     empty, which catches the plain-direct-read row. The prose beside the table
    //     was accurate about HEAD's EXTRACTOR; the ROW and the TOTAL are claims about
    //     HEAD's FILE, and against the file they overstated the delta.
    //   · And re-executing it turned up something the correction to 1 did not
    //     predict: HEAD ALSO CATCHES ROW K. A class static block is invisible to an
    //     AST WALK that never visits the node — but it is perfectly visible to a TEXT
    //     scan, which sees the characters `d.tidalHeating` inside the function body
    //     and does not care what syntax they sit in. The two mechanisms are blind in
    //     ORTHOGONAL directions, which is worth knowing and is the opposite of the
    //     "each fence strictly dominates the last" story the table used to tell.
    // 2 → 17 is still a control that moved. An overstated number inside this
    // program's own evidence is the navigational-rot class, and this is the one place
    // the program cannot afford to practise it.
    //
    // HEAD's extractor scans `conditionFromPlanet`'s BODY ALONE for `\b(d|comp)\.\w+`
    // with no bypass detectors. Round 1 added six detectors and closed six rows.
    // G/H/I/J are what a seventh through tenth detector would have had to be — the
    // reason the mechanism changed to an AST instead (PLAN.md §11.2: close the CLASS).
    // K/L/M/N/O/P are what beat the AST, and they are not more spellings: they are
    // constructs the walk had NO RULE FOR, which a fail-open analyser reports as
    // "nothing here". That is why round 3 changed the POLARITY rather than the
    // mechanism — see NODE_TYPE_LEDGER.
    const declared = new Set(['comp.density', 'd.composition', 'd.radiusEarth']);

    // ⛔ FIRST, THE LEDGER IS A PARTITION — the claim that makes "fail-closed"
    // checkable instead of aspirational. Every node type in exactly one bucket, and
    // the four buckets exactly covering the language. A type in two buckets, or in
    // none, fails here — which is how `Identifier` was caught missing from the
    // universe list (it is a member of Babel's `TSEntityName` alias, so subtracting
    // TypeScript wholesale subtracts it too).
    {
      const buckets = [['MODELLED', LEDGER_MODELLED], ['REJECTED-LOUD/on-contact', LEDGER_ON_CONTACT],
        ['REJECTED-LOUD/on-sight', LEDGER_ON_SIGHT], ['IGNORED-WITH-REASON', LEDGER_IGNORED]];
      const home = new Map();
      const dupes = [];
      for (const [name, set] of buckets) {
        for (const t of set) { if (home.has(t)) dupes.push(`${t}: ${home.get(t)} + ${name}`); home.set(t, name); }
      }
      expect(dupes, 'a node type is in two NODE_TYPE_LEDGER buckets').toEqual([]);
      const universe = new Set(ESTREE_UNIVERSE);
      expect([...universe].filter((t) => !home.has(t)).sort(),
        'node types the ledger does not bucket — the fence would red on sight, which is fail-closed, '
        + 'but the LEDGER is the deliverable and an unbucketed row is an unanswered question').toEqual([]);
      expect([...home.keys()].filter((t) => !universe.has(t)).sort(),
        'the ledger buckets a node type ESTREE_UNIVERSE does not list — one of the two is wrong').toEqual([]);
      expect(ESTREE_UNIVERSE.length, 'the universe list changed size without the ledger changing').toBe(106);
      // and every row carries a REASON, because a bucket without one is a guess.
      for (const [group, rows] of Object.entries(NODE_TYPE_LEDGER)) {
        for (const [t, reason] of Object.entries(rows)) {
          expect(typeof reason === 'string' && reason.length > 20, `${group}.${t} has no usable reason`).toBe(true);
        }
      }
    }

    const ROWS = [
      ['CONTROL · plain direct read — the form every fence should catch',
        { fpLine: 'tidalHeat: planetData.tidalHeating,' }, 'undeclared read d.tidalHeating'],
      ['A · read delegated to a module-scope helper taking `d` — the file\'s OWN idiom',
        { moduleScope: 'function tidalHeatOf(d) { return d.tidalHeating ?? 0; }', fpLine: 'tidalHeat: tidalHeatOf(d),' },
        'undeclared read d.tidalHeating'],
      ['B · optional chaining — `d` is not followed by `.`',
        { fpLine: 'starMass: d?.starMassEarth,' }, 'undeclared read d.starMassEarth'],
      ['C · destructuring — no member expression exists to match',
        { preamble: 'const { orbitRadiusEarth } = d;', fpLine: 'orbitRadiusEarth,' },
        'undeclared read d.orbitRadiusEarth'],
      ['D · computed access — the field name is a string',
        { fpLine: 'starMass: d[\'starMassEarth\'],' }, 'undeclared read d.starMassEarth'],
      ['E · a second bare alias — `p` is a name a text scan never scans',
        { preamble: 'const p = d;', fpLine: 'tidalHeat: p.tidalHeating,' }, 'undeclared read d.tidalHeating'],
      ['F · a helper that takes `d` under ANOTHER PARAMETER NAME',
        { moduleScope: 'function tidalHeatOf(pd) { return pd.tidalHeating ?? 0; }', fpLine: 'tidalHeat: tidalHeatOf(d),' },
        'undeclared read d.tidalHeating'],
      ['G · NESTED destructuring — a brace inside the pattern defeats `\\{[^{}]*\\}`',
        { preamble: 'const { atmosphere: { pressure }, starMassEarth } = d;', fpLine: 'pressure, starMassEarth,' },
        'undeclared read d.starMassEarth'],
      ['H · declaration split from assignment — `let p;` then `p = d;`',
        { preamble: 'let p; p = d;', fpLine: 'tidalHeat: p.tidalHeating,' }, 'undeclared read d.tidalHeating'],
      ['I · object spread — the initialiser is `{`, not `d`',
        { preamble: 'const all = { ...d };', fpLine: 'tidalHeat: all.tidalHeating,' }, 'undeclared read d.tidalHeating'],
      ['J · the read placed INSIDE provenanceOf and written outward',
        { moduleScope: 'const LEAK = {};', provLine: 'LEAK.tidalHeat = d.tidalHeating;' },
        'undeclared read d.tidalHeating'],
      // ═══ K–P: THE SIX THAT BEAT ROUND 2's AST WALK ════════════════════════════
      // Every one was proven on disk with all 56 tests green and the read proven LIVE
      // (a getter planted on `tidalHeating` fired while `_provenance` carried no row
      // for it). None of them is a new SPELLING of a member access — each is a node
      // the walk had no rule for, which is why the fix was to invert the polarity.
      ['K · a CLASS STATIC BLOCK — a node round 2 never visited at all',
        { preamble: 'let _sb; class _S { static { _sb = d.tidalHeating; } } void _S;', fpLine: 'tidalHeat: _sb,' },
        'undeclared read d.tidalHeating'],
      ['L · logical assignment `_z ||= d` — round 2 read the LHS and dropped the binding',
        { preamble: 'let _z = null; _z ||= d;', fpLine: 'tidalHeat: _z.tidalHeating,' },
        'undeclared read d.tidalHeating'],
      ['M · logical assignment `_z ??= d`',
        { preamble: 'let _z; _z ??= d;', fpLine: 'tidalHeat: _z.tidalHeating,' },
        'undeclared read d.tidalHeating'],
      ['N · logical assignment `_z &&= d`',
        { preamble: 'let _z = d; _z &&= d;', fpLine: 'tidalHeat: _z.tidalHeating,' },
        'undeclared read d.tidalHeating'],
      // O and P are caught as `unmodelled:` rather than as a read, and that IS the
      // round's thesis: the honest answer to a construct the analysis cannot follow
      // is to NAME IT, not to model it badly and not to stay quiet.
      ['O · an ACCESSOR PROPERTY handing the input out of a property slot',
        { preamble: 'const b = { get inner(){ return d; } };', fpLine: 'tidalHeat: b.inner.tidalHeating,' },
        'unmodelled: accessor `get inner` on an object literal at line 6 — taint through a property slot '
        + 'is not modelled, and this returns `planetData`'],
      ['P · a GENERATOR — the call returns an iterator, not the return value',
        { moduleScope: 'function* g(x){ yield x; }', preamble: 'const it = g(d).next().value;',
          fpLine: 'tidalHeat: it.tidalHeating,' },
        'unmodelled: `g(…)` at line 6 is a generator function — its iterator plumbing is not modelled, '
        + 'and it receives `planetData`'],
    ];

    for (const [label, shape, expected] of ROWS) {
      const f = fenceFindings(syntheticAdapter(shape), declared);
      expect(f.ok, `${label}: the analysis must converge`).toBe(true);
      expect(f.stale, `${label}: the synthetic must declare exactly what it legitimately reads, or `
        + '"caught" could be an artefact of the declaration rather than of the bypass').toEqual([]);
      expect(caughtBy(f), `${label}: WRITTEN PAST THE FENCE — this adapter reads an undeclared input `
        + 'and the fence returned nothing').not.toEqual([]);
      expect(caughtBy(f), `${label}: caught, but not by the mechanism this row exists to test`)
        .toContain(expected);
    }

    // ═══ THE OTHER DIRECTION — THE FALSE-RED CONTROLS ═════════════════════════════
    // ⛔ THESE ARE AS IMPORTANT AS THE CATCHES, AND MORE SO NOW THAN BEFORE. A
    // fail-closed fence buys its sensitivity with over-rejection risk, and a fence
    // that reds on legitimate code gets switched off by the third person who meets
    // it. Every row here is code somebody could reasonably write at this seam.
    const SILENT_ROWS = [
      ['a clean adapter — without this, every row above is satisfied by a smoke alarm',
        syntheticAdapter({})],
      // ⛔ THE UNCALLED HELPER. Round 2 nearly recorded a false "the fence is blind"
      // by writing this helper and forgetting the call site. TAINT ENTERS A HELPER AT
      // ITS CALL SITE OR NOT AT ALL, so an uncalled one reads nothing and a fence that
      // reported it would fire on every unused parameter in the file. Its called twin
      // is row A above; the pair is only meaningful pinned together.
      ['an UNCALLED helper that would read an undeclared field if anyone called it',
        `function tidalHeatOf(d) { return d.tidalHeating ?? 0; }\n${syntheticAdapter({})}`],
      // ⛔ THE LEGITIMATE REFACTOR. Round 1's regex fence produced TWO false reds on
      // this shape: an alias chain and a helper whose parameter is not spelled `d`.
      // Everything it reads is declared. It must stay silent under a fail-closed
      // fence too, or "fail-closed" just means "always red".
      ['a legitimate refactor — an alias CHAIN plus two helpers with renamed parameters',
        syntheticAdapter({
          moduleScope: 'function radiusOf(body) { return body.radiusEarth ?? 1.0; }\n'
            + 'function densityOf(matter) { return matter.density; }',
          preamble: 'const src = d; const alias = src; const c2 = comp; const c3 = alias.composition;',
          fpLine: 'r2: radiusOf(alias), dd: densityOf(c2), dd2: densityOf(c3),',
        })],
      // ⛔ AND THE PRECISION OF THE TWO NEWEST REJECTIONS. Row O reds an accessor
      // whose return carries the INPUT OBJECT. An accessor that reads a DECLARED
      // FIELD and returns the field's value carries nothing undeclared, and must not
      // red — otherwise "no accessors at this seam" is the real rule, which is not
      // what the ledger says.
      ['an accessor and a method that read only DECLARED fields',
        syntheticAdapter({
          preamble: 'const view = { get r(){ return d.radiusEarth; }, dens(){ return comp.density; } };',
          fpLine: 'r2: view.r, dd: view.dens(),',
        })],
      // ⛔ AND A SHADOWED PARAMETER SPELLED `d`, called with something else entirely.
      // A text scan cannot tell this from row A. A binding resolver must.
      ['an unrelated helper whose parameter is also spelled `d`, called with `{}`',
        syntheticAdapter({
          moduleScope: 'function unrelated(d) { return d.tidalHeating; }',
          preamble: 'const q = unrelated({});', fpLine: 'x: q,',
        })],
    ];
    for (const [label, src] of SILENT_ROWS) {
      const f = fenceFindings(src, declared);
      expect(f.ok, `${label}: the analysis must converge`).toBe(true);
      expect(caughtBy(f), `FALSE RED — ${label}`).toEqual([]);
      expect(unmodelledHits(f), `FALSE RED (unmodelled) — ${label}`).toEqual([]);
    }

    // ═══ AND THE COMPLETENESS SWEEP ITSELF, SHOWN FIRING ══════════════════════════
    // ⛔ THE SWEEP IS THE FAIL-CLOSED MECHANISM, SO IT NEEDS ITS OWN EXECUTED
    // MUTATION (PLAN.md §11.3.1) — asserting "the ledger is complete" proves nothing
    // about whether anything CHECKS it. `forgetTypes` drops a row out of the ledger at
    // run time; the sweep must then name that node type, by line, on an adapter that
    // is otherwise perfectly clean. This is the one control that fails if the sweep is
    // wired up but never consulted.
    const cleanSrc = syntheticAdapter({});
    expect(caughtBy(fenceFindings(cleanSrc, declared)), 'the mutation baseline must start silent').toEqual([]);
    for (const t of ['ObjectExpression', 'MemberExpression', 'VariableDeclaration', 'Identifier']) {
      const mutated = fenceFindings(cleanSrc, declared, { forgetTypes: [t] });
      const hits = unmodelledHits(mutated);
      expect(hits.length, `forgetting ${t} left the sweep silent — the ledger is not being consulted`)
        .toBeGreaterThan(0);
      expect(hits.every((h) => h.startsWith(`unmodelled: ${t} at line `)),
        `forgetting ${t} produced findings that do not name it with a line: ${hits.slice(0, 2)}`).toBe(true);
    }
    // ⛔ AND THE SELF-AUDIT INSIDE THE WALK: a row the ledger CALLS modelled whose
    // rule does not exist must also be named. `SwitchStatement` is handled by an
    // explicit case; forgetting it removes it from the sweep's known set AND from the
    // `modelled` set the default branch checks, so the type is reported. The point of
    // the pair is that neither mechanism can be quietly disconnected on its own.
    const withSwitch = syntheticAdapter({ preamble: 'let p; switch (1) { case 1: p = d; }', fpLine: 'x: p.radiusEarth,' });
    expect(caughtBy(fenceFindings(withSwitch, declared)), 'the switch baseline must start silent').toEqual([]);
    expect(unmodelledHits(fenceFindings(withSwitch, declared, { forgetTypes: ['SwitchStatement'] })).length)
      .toBeGreaterThan(0);
  });

  it('the adapter parses, and parses to something — not to an empty body', () => {
    // The second half of the anti-vacuity check, on the REAL file this time.
    const a = adapterReads();
    expect(a.ok, `the adapter could not be analysed: ${a.why}`).toBe(true);
    expect(a.excisionFound, '`provenanceOf` could not be located, so the partition is undefined').toBe(true);
    // ⛔ THE FIXPOINT MUST ACTUALLY ITERATE. A single-pass analysis cannot resolve a
    // chained alias or a helper called above its declaration; if this ever reads 1,
    // the walk has collapsed to a one-shot scan and H/I/A are invisible again.
    expect(a.passes, 'the alias analysis converged in one pass — it is not a fixpoint any more')
      .toBeGreaterThan(1);
    // ⚠ THIS FLOOR IS RAISED BY EVERY STEP THAT ADDS A READ, ON PURPOSE. It is not the
    // input count (17) — the coverage map declares 20 reads across those rows, because
    // `composition` is one row over four reads. Left at Step 1's 14 it would keep passing
    // while the analyser silently lost the three reads Step 2 added.
    expect(a.reads.size, 'the analyser found suspiciously few reads').toBeGreaterThanOrEqual(20);

    // ⛔ THE PRICE OF FAIL-CLOSED, COUNTED RATHER THAN WAVED AT. A fence that reds on
    // the file it guards is worse than no fence, because it gets switched off. So the
    // number of `unmodelled:` hits the SHIPPED, UNMODIFIED adapter produces is asserted
    // as a NUMBER — not as "no findings", which would let a future over-rejection hide
    // behind a differently-worded assertion. MEASURED 2026-08-08: 0, over 29 distinct
    // node types (`ArrayExpression`, `ArrowFunctionExpression`, `AssignmentExpression`,
    // `BinaryExpression`, `BlockStatement`, `BooleanLiteral`, `CallExpression`,
    // `ConditionalExpression`, `ExportNamedDeclaration`, `ExpressionStatement`,
    // `FunctionDeclaration`, `Identifier`, `IfStatement`, `ImportDeclaration`,
    // `ImportSpecifier`, `LogicalExpression`, `MemberExpression`, `NullLiteral`,
    // `NumericLiteral`, `ObjectExpression`, `ObjectProperty`, `OptionalMemberExpression`,
    // `Program`, `ReturnStatement`, `SpreadElement`, `StringLiteral`, `UnaryExpression`,
    // `VariableDeclaration`, `VariableDeclarator`). If this ever reads non-zero, read
    // the names before touching the ledger: either the fence has started over-rejecting,
    // or the adapter has genuinely grown a construct nobody has reasoned about.
    expect(unmodelledHits(a), 'the SHIPPED adapter produced `unmodelled:` hits — the fence is '
      + 'over-rejecting, or the adapter grew a construct with no rule. Read the node types before '
      + 'widening the ledger.').toEqual([]);
    expect(unmodelledHits(a).length).toBe(0);
    expect(a.reads.has('d.radiusEarth')).toBe(true);
    expect(a.reads.has('comp.carbonToOxygen')).toBe(true);
    // The reads that only exist because the walk crosses INTO module-scope helpers:
    // `atmosphereFromPlanet(d.atmosphere)` reads `.physics`, `.color`, `.retained`
    // and `.pressure` under a parameter called `gameAtmosphere`, three names away
    // from `d`. All of them attribute to the declared input.
    expect(a.reads.has('d.atmosphere')).toBe(true);

    // ⛔ THE EXPORT SURFACE, PINNED. The seeding rule taints the adapter's parameter
    // and anything spelled `planetData`; a SECOND entry point into this seam under
    // some other parameter name is not decidable from inside one function, so the
    // module's exports are pinned instead. A new export is a new seam and has to be
    // declared here on purpose.
    expect(a.exportNames).toEqual([
      'PROVENANCE_COVERAGE', 'PROVENANCE_INPUTS', 'TAU_EXP', 'TAU_REF',
      'atmosphereFromPlanet', 'axialTiltDegreesOf', 'conditionFromBody',
      'densityToGramsPerCC', 'effectiveObliquityDegreesOf', 'habitabilityScalarOf',
      'surfaceTemperatureOf',
    ]);

    // ⭐ A LIVE DECOY, not a synthetic one. The adapter's own PROSE contains a literal
    // `d.<field>` string for a read that does not exist yet. Under the old text scan a
    // hand-written comment stripper had to keep it out; under a parser it is not a node
    // at all. Asserted anyway, because the decoy is the cheapest possible check that the
    // thing being walked is CODE.
    //
    // ⛔ THE DECOY HAD TO MOVE AT STEP 2, AND THAT IS THE POINT OF IT, NOT A REPAIR.
    // Until Step 2 the decoys were `d.starMassEarth`, `d.tidalHeating` and
    // `d.orbitRadiusEarth` — Step 2's own three reads, named in prose. Step 2 turned all
    // three into CODE, so as decoys they are spent: `a.reads.has('d.tidalHeating')` is
    // now `true` and asserting `false` would be asserting the feature is absent. A decoy
    // is only a decoy while the read does not exist, so it re-points at the next
    // declared-but-unwritten read.
    //
    // ⭐ AND IT MOVED AGAIN AT STEP 5e, EXACTLY AS THE STEP-2 NOTE SAID IT WOULD HAVE TO.
    // The decoy was `d.metallicity` from Step 2 until this commit, which forwards it —
    // spending it the same way Step 2 spent the tidal triple. It now points at
    // `d._systemSeed`, and that is not a placeholder: the pack contract landed by Step 5's
    // sibling requires a NON-ZERO INTEGER macroSeed, the only seed a body carries is the
    // STRING `_systemSeed`, and `'pcc-0' | 0 === 0`. Measured over this corpus: present on
    // 520/526, `typeof 'string'` on all 520, so the coercion is 0 on every one — the same
    // silent-collapse shape the seam already catalogues eight of.
    // ⚠ THE ROTATION IS PERMANENT WORK. Whichever step forwards `_systemSeed` must move
    // this assertion AND the injection payloads below, together.
    const src = ADAPTER_SRC();
    expect(src, 'the decoy must actually be present for this to test anything').toContain('d._systemSeed');
    expect(a.reads.has('d._systemSeed'), 'a commented-out read was analysed as code').toBe(false);
    // ⛔ AND THE OTHER HALF, WHICH IS WHAT MAKES THE DECOY MEAN ANYTHING NOW. The four
    // strings that used to be decoys are the same shape in prose and are ALSO written as
    // code below it. If the walk were a text scan both facts would look identical; the
    // parser separates them, so all four read TRUE here while `d._systemSeed` reads
    // FALSE, from one file that contains all five strings.
    expect(src).toContain('d.tidalHeating');
    expect(a.reads.has('d.tidalHeating'), 'Step 2\'s tidal read is missing from the adapter').toBe(true);
    expect(a.reads.has('d.starMassEarth')).toBe(true);
    expect(a.reads.has('d.orbitRadiusEarth')).toBe(true);
    expect(src).toContain('d.metallicity');
    expect(a.reads.has('d.metallicity'), 'Step 5e\'s metallicity read is missing from the adapter')
      .toBe(true);
  });

  it('⛔ the adapter uses NONE of the bypass forms — with the injected controls that make that zero mean something', () => {
    // THE FENCE'S SECOND HALF, on the real file. Every route to an input that is not
    // a declared read is a real input with no provenance row AND invisible to the
    // provenance record — the blind spot rebuilt one level over.
    const declared = new Set(Object.values(PROVENANCE_COVERAGE).flat());
    const live = fenceFindings(ADAPTER_SRC(), declared);
    expect(live.findings, 'conditionFromBody.js reaches an input by a route this analysis cannot '
      + 'follow — write the read as an ordinary member access on `d` / `comp`').toEqual([]);
    expect(caughtBy(live), 'the real adapter, unmodified').toEqual([]);

    // ═══ AND THE CONTROLS THAT MAKE THAT ZERO WORTH SOMETHING ══════════════════════
    // ⛔ A ZERO WITH NO CONTROL THAT MOVED IS EVIDENCE OF NOTHING (PLAN.md §11.3.3).
    // Everything above reports zero over the real adapter. So the four constructs the
    // previous fence could not see are injected into the REAL source, in memory —
    // nothing on disk is touched and nothing is executed; only the text is read.
    //
    // ⚠ MEASURED, NOT ASSUMED — and the first draft of the previous control was wrong
    // in this codebase's signature way. It claimed provenanceOf's own
    // `d.atmosphere?.physics` would trip the optional-chain detector and so prove the
    // excision load-bearing. It did not (that detector matched `d?.`, not
    // `d.atmosphere?.`), the control read 0, and a 0-vs-0 pair would have been
    // recorded as "the excision matters". It was caught by RUNNING it. Kept, because
    // the next control is likelier to be wrong the same way than a new way.
    const src = ADAPTER_SRC();
    const inject = (text) => caughtBy(fenceFindings(text, declared));
    const ANCHOR = '  const condition = deriveConditionVector(fp, null, fp.radiusEarth);';
    expect(src, 'the injection anchor moved').toContain(ANCHOR);

    // ⛔⛔ WHY EVERY INJECTION BELOW NOW SMUGGLES `_systemSeed`, AND WHY THE PAYLOAD HAS
    // CHANGED TWICE. Until Step 2 these controls injected `d.tidalHeating` — Step 2's own
    // declared first move, which is exactly what PLAN §11.3.1 asks a mutant to be drawn from.
    // Step 2 LANDED that read and gave it a coverage row, so `d.tidalHeating` became DECLARED,
    // and an injection of a declared field produces no finding by design. Left as it was,
    // every row here would have gone green-because-vacuous — sixteen controls that cannot
    // fail, which is the D-class defect this fence exists to prevent, arriving through the
    // fence's own controls. So the payload re-pointed at `d.metallicity`.
    // ⭐ STEP 5e FORWARDS `metallicity`, so that payload is now spent in exactly the same way,
    // and every row below would have gone vacuous a SECOND time. It re-points at the next
    // declared-but-unwritten read, `d._systemSeed` — the seed the giant-deck pack contract
    // needs and cannot get (`giantDeck.js` asserts a non-zero INTEGER macroSeed; the body
    // carries the STRING `'pcc-0'`, which `| 0` collapses to 0 on 520/526 bodies).
    // ⚠ THIS ROTATION IS PERMANENT WORK, not a one-off — it has now been done twice: the
    // field named here must be swapped again by whichever step forwards `_systemSeed`, and the
    // decoy assertion above must move with it. They are two halves of one fact.
    // ⛔ VERIFIED NON-VACUOUS AT THIS ROTATION, not assumed — and the verification found that the
    // rotation matters for ELEVEN of the sixteen rows, not all of them. The eleven that assert
    // `toContain('undeclared read d.<field>')` name the field in the matcher, so a DECLARED field
    // produces nothing and they go silently green. The other five (O, P, Q, S and the
    // uncalled-helper negative) assert on a CONSTRUCT — `unmodelled: accessor …`,
    // `unmodelled: \`throw\` …` and so on — and are field-independent, so they survive any rotation.
    // EXECUTED: with the payload left at `metallicity` against the Step-5e adapter, the suite reds at
    // row H — `expected [] to include 'undeclared read d.metallicity'` — which is the first of the
    // eleven. They were re-pointed, not re-blessed.

    // H — a declaration split from its assignment. The regex fence required
    //     `const|let|var NAME = d` and matched NOTHING here.
    expect(inject(src.replace(ANCHOR, `  let p; p = d; const _t = p._systemSeed;\n${ANCHOR}`)))
      .toContain('undeclared read d._systemSeed');
    // I — object spread. The initialiser is `{`, not `d`.
    expect(inject(src.replace(ANCHOR, `  const all = { ...d }; const _t = all._systemSeed;\n${ANCHOR}`)))
      .toContain('undeclared read d._systemSeed');
    // G — nested destructuring. `\{[^{}]*\}` cannot match a brace inside the pattern,
    //     so the top-level name in the same statement escaped with it.
    expect(inject(src.replace(ANCHOR, `  const { atmosphere: { pressure }, _systemSeed } = d;\n${ANCHOR}`)))
      .toContain('undeclared read d._systemSeed');
    // A — the next step's declared move, written the way this file already writes
    //     things: a module-scope helper, CALLED with `d`. The pre-round-1 fence
    //     (which scanned `conditionFromPlanet`'s body alone) answered `false` here.
    //     ⚠ THE CALL IS PART OF THE INJECTION, DELIBERATELY. Adding the helper and
    //     not calling it correctly produces NOTHING: a dead function reads no input,
    //     and a fence that reported it would fire on every unused parameter in the
    //     file. Measured — the first cut of this control omitted the call and read 0,
    //     which would have been recorded as "the fence is blind" against a fence that
    //     was right. Taint enters a helper at its CALL SITE or not at all.
    expect(inject(`function systemSeedOf(d) { return d._systemSeed ?? 0; }\n`
      + src.replace(ANCHOR, `  const _t = systemSeedOf(d);\n${ANCHOR}`)))
      .toContain('undeclared read d._systemSeed');
    // and the other half of that pair: the helper WITHOUT the call is correctly silent
    expect(inject(`function systemSeedOf(d) { return d._systemSeed ?? 0; }\n${src}`),
      'an uncalled helper is not a read of the adapter\'s input').toEqual([]);

    // ═══ K–P INJECTED INTO THE REAL FILE — the six that beat round 2 ══════════════
    // ⛔ THE SYNTHETIC ROWS ABOVE ARE NOT ENOUGH ON THEIR OWN. A synthetic adapter is
    // 14 lines; the real one is 530, with a `provenanceOf` partition, an atmosphere
    // helper three names away from `d`, and an `Object.defineProperty` at the end.
    // Every one of these six was originally proven ON DISK, against the real file,
    // with all 56 tests green — so the real file is where the fix has to be shown
    // working. Injected in memory here; the on-disk runs are recorded in the round's
    // report, md5-guarded before and after.
    expect(inject(src.replace(ANCHOR, `  let _sb; class _S { static { _sb = d._systemSeed; } } void _sb; void _S;\n${ANCHOR}`)),
      'K — a class static block is invisible again').toContain('undeclared read d._systemSeed');
    expect(inject(src.replace(ANCHOR, `  let _z = null; _z ||= d; const _t = _z._systemSeed; void _t;\n${ANCHOR}`)),
      'L — `||=` drops the binding again').toContain('undeclared read d._systemSeed');
    expect(inject(src.replace(ANCHOR, `  let _z; _z ??= d; const _t = _z._systemSeed; void _t;\n${ANCHOR}`)),
      'M — `??=` drops the binding again').toContain('undeclared read d._systemSeed');
    expect(inject(src.replace(ANCHOR, `  let _z = d; _z &&= d; const _t = _z._systemSeed; void _t;\n${ANCHOR}`)),
      'N — `&&=` drops the binding again').toContain('undeclared read d._systemSeed');
    // O and P are named as `unmodelled:` rather than as a read — the round's whole
    // point. Matched on the prefix plus the construct, because the line number moves
    // with the anchor and pinning it would make this brittle for no gain.
    const oHit = inject(src.replace(ANCHOR, `  const _b = { get inner(){ return d; } }; const _t = _b.inner._systemSeed; void _t;\n${ANCHOR}`));
    expect(oHit.some((h) => h.startsWith('unmodelled: accessor `get inner` on an object literal at line ')),
      `O — an accessor hands the input out of a property slot unnoticed: ${oHit}`).toBe(true);
    const pSrc = `function* _g(x){ yield x; }\n`
      + src.replace(ANCHOR, `  const _t = _g(d).next().value._systemSeed; void _t;\n${ANCHOR}`);
    const pFindings = inject(pSrc);
    expect(pFindings.some((h) => h.startsWith('unmodelled: `_g(…)` at line ')
      && h.includes('generator function')), `P — a generator laundered the input: ${pFindings}`).toBe(true);

    // ⛔ AND THE FOUR THIS ROUND FOUND BY ATTACKING ITS OWN FENCE, on the real file.
    // Every one was silent when this round started, none is in the brief's list, and
    // none is a re-spelling of K–P — they are the residue the previous two rounds
    // would have shipped undisclosed. Q and T in particular are the same defect as
    // the original five: a NODE THE WALK NEVER VISITED (`handler.param`) and a CHANNEL
    // WITH NO BINDING (the unwind), not a pattern nobody had thought to match.
    const throwHit = inject(src.replace(ANCHOR, `  let _t; try { throw d; } catch (_e) { _t = _e._systemSeed; } void _t;\n${ANCHOR}`));
    expect(throwHit.some((h) => h.startsWith('unmodelled: `throw` at line ')),
      `Q — throw/catch smuggles the input past the walk: ${throwHit}`).toBe(true);
    expect(inject(`function _h(x, y = x){ return y._systemSeed; }\n`
      + src.replace(ANCHOR, `  const _t = _h(d); void _t;\n${ANCHOR}`)),
      'R — a parameter DEFAULT that re-aliases another parameter').toContain('undeclared read d._systemSeed');
    const asyncHit = inject(src.replace(ANCHOR, `  const _p = (async () => d)(); void _p;\n${ANCHOR}`));
    expect(asyncHit.some((h) => h.startsWith('unmodelled: `an immediately-invoked function expression(…)` at line ')),
      `S — an async IIFE with no arguments carries the input out through its promise: ${asyncHit}`).toBe(true);
    expect(inject(src.replace(ANCHOR, '  let _t3; try { _t3 = 1; } catch ({ message: _m = d }) '
      + `{ _t3 = _m._systemSeed; } void _t3;\n${ANCHOR}`)),
      'T — a DEFAULT inside a catch parameter; round 2 never walked `handler.param` at all')
      .toContain('undeclared read d._systemSeed');

    // ── J: THE PARTITION IS NOT A HOLE. A read inside `provenanceOf` still has to
    //    resolve to a declared row, so exfiltrating one from there is caught.
    const NEEDLE = 'function provenanceOf(d, comp) {';
    expect(src, 'the partition anchor moved — `provenanceOf` cannot be located').toContain(NEEDLE);
    expect(inject(src.replace(NEEDLE, `${NEEDLE}\n  const leaked = d?._systemSeed;`)),
      'a read inside provenanceOf is excused again — that is bypass J, reopened')
      .toContain('undeclared read d._systemSeed');

    // ── AND THE PARTITION IS STILL LOAD-BEARING IN THE OTHER DIRECTION. If
    //    provenanceOf's reads counted, `stale` could never fire: the record reads
    //    every declared field. Deleting one read from the ADAPTER must still name it.
    const MASS = '    massEarth:   d.massEarth ?? 1.0,';
    expect(src, 'the stale-control anchor moved').toContain(MASS);
    const staleCtl = fenceFindings(src.replace(MASS, '    massEarth:   1.0,'), declared);
    expect(staleCtl.stale, 'provenanceOf\'s own read of d.massEarth kept it out of `stale` — the '
      + 'partition has leaked and the stale direction is vacuous').toEqual(['d.massEarth']);
  });

  it('⛔ EVERY property the adapter reads off planetData has a provenance row', () => {
    // THE FENCE. Left side: the adapter's CODE, resolved. Right side: the coverage
    // declaration. Add a read without a row and this names the field.
    const { reads, provReads } = adapterReads();
    const declared = new Set(Object.values(PROVENANCE_COVERAGE).flat());
    const undeclared = [...reads].filter((r) => !declared.has(r)).sort();
    const stale = [...declared].filter((r) => !reads.has(r)).sort();
    expect(undeclared, `the adapter reads ${undeclared.join(', ')} with no PROVENANCE_COVERAGE row — `
      + 'add one, and a matching entry in provenanceOf').toEqual([]);
    expect(stale, `PROVENANCE_COVERAGE claims ${stale.join(', ')} but the adapter no longer reads it`).toEqual([]);
    // ⛔ AND THE PARTITIONED HALF. `provenanceOf`'s reads do not COUNT as reads
    // needing a row — they are the record, and counting them would put it back on
    // both sides of the comparison. They are still required to resolve to a row that
    // ALREADY EXISTS. Without this line, moving a read into that body hides it
    // (bypass J), which is precisely what the earlier excision let happen.
    const provUndeclared = [...provReads].filter((r) => !declared.has(r)).sort();
    expect(provUndeclared, `provenanceOf reads ${provUndeclared.join(', ')} with no `
      + 'PROVENANCE_COVERAGE row — the record may only describe declared inputs').toEqual([]);
  });

  it('the record\'s keys are exactly the coverage map\'s rows, each measured or defaulted', () => {
    // The link between the derived list and the record actually emitted. On its
    // own this is the self-referential assertion that was retired; it is only
    // worth anything because the test above independently ties one of its sides
    // to the adapter's code.
    const p = conditionFromBody(planets[0])._provenance;
    expect(Object.keys(p).sort()).toEqual([...PROVENANCE_INPUTS].sort());
    expect(PROVENANCE_INPUTS).toEqual(Object.keys(PROVENANCE_COVERAGE));
    for (const [k, v] of Object.entries(p)) {
      expect(['measured', 'defaulted'], `${k} = ${v}`).toContain(v);
    }
    expect(Object.isFrozen(p)).toBe(true);
  });

  it('names the FOURTEENTH input the old count missed, and why it is not cosmetic', () => {
    // `carbonToOxygen` was read and forwarded by the adapter while `_provenance`
    // reported 13 inputs. It is not a future field: two shipped consumers read
    // it TODAY and both supply `?? 0`, and 0 is the positive claim "not a carbon
    // world" rather than "unknown".
    expect(PROVENANCE_INPUTS).toContain('carbonToOxygen');

    const carbonish = {
      radiusEarth: 1.1, massEarth: 1.4, T_eq: 600, age: 4.5, atmosphere: null,
      composition: { ironFraction: 0.3, density: 6000, volatileFraction: 0.02, carbonToOxygen: 1.2 },
    };
    const bare = { ...carbonish, composition: { ironFraction: 0.3, density: 6000, volatileFraction: 0.02 } };
    expect(conditionFromBody(carbonish)._provenance.carbonToOxygen).toBe('measured');
    expect(conditionFromBody(bare)._provenance.carbonToOxygen).toBe('defaulted');
    // ...while the composition ROW stays 'measured' on both, which is the reason
    // this needed its own row instead of joining the density/iron/volatile group.
    expect(conditionFromBody(bare)._provenance.composition).toBe('measured');

    // surfaceMaterial.js:335, inside surfacePaletteOf — one of the five bakes.
    const lit = surfacePaletteOf(conditionFromBody(carbonish));
    const unlit = surfacePaletteOf(conditionFromBody(bare));
    expect(lit.fresh).not.toEqual(unlit.fresh);
    expect(unlit.fresh[0]).toBeGreaterThan(lit.fresh[0] * 1.5);   // measured 2.2x brighter
  });

  it('and reports it defaulted on the populations that actually lack it', () => {
    // Measured: 526/526 generated planets carry C/O, 0/39 Sol bodies do. So on
    // Sol the engine has always read a fabricated 0 for it, unrecorded.
    for (const pd of planets) expect(conditionFromBody(pd)._provenance.carbonToOxygen).toBe('measured');

    const sol = generateSolarSystem();
    const bodies = [];
    for (const e of sol.planets || []) {
      bodies.push(e.planetData);
      for (const m of e.moons || []) bodies.push(m.planetData || m);
    }
    expect(bodies.length).toBeGreaterThanOrEqual(30);
    const measured = bodies.filter((b) => conditionFromBody(b)._provenance.carbonToOxygen === 'measured');
    expect(measured.length, 'if Sol gains a C/O this becomes a real measurement — retire the claim above').toBe(0);
  });
});

describe('Step 1 · _provenance', () => {

  it('STEP 2 · the tidal triple has three rows, and each answers on its own terms', () => {
    // ⛔ THE ROWS ARE THE FENCE'S OTHER HALF. The coverage map proves the adapter's
    // three new reads are DECLARED; this proves the record actually ANSWERS for them,
    // which is a different claim — a row can be declared and then written as a constant.
    expect(PROVENANCE_INPUTS).toContain('tidalHeat');
    expect(PROVENANCE_INPUTS).toContain('starMassEarth');
    expect(PROVENANCE_INPUTS).toContain('orbitRadiusEarth');
    expect(PROVENANCE_COVERAGE.tidalHeat).toEqual(['d.tidalHeating']);
    expect(PROVENANCE_COVERAGE.starMassEarth).toEqual(['d.starMassEarth']);
    expect(PROVENANCE_COVERAGE.orbitRadiusEarth).toEqual(['d.orbitRadiusEarth']);

    // A body with real tidal heating, and the same body without — one field apart, so
    // nothing else can be responsible for the answer changing.
    const heated = {
      radiusEarth: 1.0, massEarth: 1.0, T_eq: 288, age: 4.5, eccentricity: 0.1, atmosphere: null,
      composition: { ironFraction: 0.3, density: 5500, volatileFraction: 0.15 },
      tidalHeating: 3.7, starMassEarth: 332946, orbitRadiusEarth: 23455,
    };
    const cold = { ...heated, tidalHeating: undefined, starMassEarth: undefined, orbitRadiusEarth: undefined };
    expect(conditionFromBody(heated)._provenance.tidalHeat).toBe('measured');
    expect(conditionFromBody(heated)._provenance.starMassEarth).toBe('measured');
    expect(conditionFromBody(heated)._provenance.orbitRadiusEarth).toBe('measured');
    expect(conditionFromBody(cold)._provenance.tidalHeat).toBe('defaulted');
    expect(conditionFromBody(cold)._provenance.starMassEarth).toBe('defaulted');
    expect(conditionFromBody(cold)._provenance.orbitRadiusEarth).toBe('defaulted');

    // ⛔ AND THE ROWS TRACK A REAL DIFFERENCE IN THE OUTPUT, not just the input's
    // presence: 'measured' means the D12 branch ran and the forwarded number came out
    // un-transformed; 'defaulted' means the Io formula ran instead.
    expect(conditionFromBody(heated).rawTidalIoRatio).toBe(3.7);
    expect(conditionFromBody(cold).rawTidalIoRatio).not.toBe(3.7);

    // ⚠ AND THE ROWS ARE INDEPENDENT, which is why they are three rows and not one. The
    // moon shape — an orbit radius with no star mass — is the case a compound row would
    // report as a single 'defaulted' while hiding WHICH half is missing.
    const moonish = { ...cold, orbitRadiusEarth: 60 };
    const mp = conditionFromBody(moonish)._provenance;
    expect([mp.tidalHeat, mp.starMassEarth, mp.orbitRadiusEarth])
      .toEqual(['defaulted', 'defaulted', 'measured']);
  });

  it('STEP 2 · reports the triple honestly on the populations the game actually generates', () => {
    // ⚠ MEASURED, AND IT IS NOT WHAT THE FIELD NAMES SUGGEST. `tidalHeating` is on every
    // generated body, so the Io-formula fallback is DEAD on generated data — which is
    // exactly why nobody noticed it running for the whole life of this seam. The star
    // mass is on NONE: `PlanetGenerator.generate` keeps `starMassSolar` as a local and
    // spends it on `tidalHeatingPlanet` rather than recording it.
    const pAll = planets.map((pd) => conditionFromBody(pd)._provenance);
    expect(pAll.filter((p) => p.tidalHeat === 'measured').length).toBe(planets.length);
    expect(pAll.filter((p) => p.starMassEarth === 'measured').length).toBe(0);
    expect(pAll.filter((p) => p.orbitRadiusEarth === 'measured').length).toBe(0);

    // Moons carry an orbit radius and no star mass — the incoherent pair named in the
    // adapter's tidal block. Inert today only because every moon also has a real
    // `tidalHeating`, so the branch that would read the pair never runs. If that first
    // assertion ever drops below 100%, the pair becomes live and Step 8 owes the fix.
    expect(moons.length).toBeGreaterThan(0);
    const mAll = moons.map((m) => conditionFromBody(m)._provenance);
    expect(mAll.filter((p) => p.tidalHeat === 'measured').length,
      'a moon lost its tidalHeating — the incoherent starMass/orbitRadius pair is now LIVE').toBe(moons.length);
    expect(mAll.filter((p) => p.orbitRadiusEarth === 'measured').length).toBe(moons.length);
    expect(mAll.filter((p) => p.starMassEarth === 'measured').length).toBe(0);
  });

  it('PLAN.md:192 — measured on a generated planet, defaulted on a bare radius', () => {
    expect(conditionFromBody(planets[0])._provenance.massEarth).toBe('measured');
    expect(conditionFromBody({ radiusEarth: 0.273 })._provenance.massEarth).toBe('defaulted');
  });

  it('names the fabrications on a Sol-shaped moon record, which is the point of it', () => {
    // `{radiusEarth: 0.273}` is the Moon, as SolarSystemData.js:196-198 stores it.
    // SIXTEEN of the seventeen inputs are invented (it was ten of thirteen when this
    // was written; Step 1 added four rows and Step 2 the tidal triple, and every one of
    // them lands on the 'defaulted' side for this record), every one of them silently,
    // and the
    // condition that comes out is a finite, plausible, entirely fictional body.
    const p = conditionFromBody({ radiusEarth: 0.273 })._provenance;
    expect(p.radiusEarth).toBe('measured');
    const defaulted = Object.entries(p).filter(([, v]) => v === 'defaulted').map(([k]) => k);
    expect(defaulted.length).toBeGreaterThanOrEqual(10);
    expect(defaulted).toContain('massEarth');
    expect(defaulted).toContain('composition');
    expect(defaulted).toContain('T_eq');
    expect(defaulted).toContain('atmosphere');
    expect(defaulted).toContain('surfaceHistory');
  });

  it('distinguishes an explicit null atmosphere (a measurement) from an absent one', () => {
    // PlanetGenerator.js:448 `let atmosphere = null;` and MoonGenerator.js:220 `} : null,`
    // both set it outright to mean "nothing retained". That IS the game's answer, and calling
    // it 'defaulted' would cry wolf on every airless body in the galaxy.
    expect(conditionFromBody({ atmosphere: null })._provenance.atmosphere).toBe('measured');
    expect(conditionFromBody({})._provenance.atmosphere).toBe('defaulted');
    expect(conditionFromBody({ atmosphere: { color: [1, 1, 1], strength: 0.3 } })
      ._provenance.atmosphere).toBe('defaulted');
    expect(conditionFromBody({ atmosphere: { retained: true, pressure: 1 } })
      ._provenance.atmosphere).toBe('measured');
  });

  it('calls a partly-populated composition defaulted, because that is the fabrication case', () => {
    const all = { ironFraction: 0.3, density: 5500, volatileFraction: 0.1 };
    expect(conditionFromBody({ composition: all })._provenance.composition).toBe('measured');
    const noDensity = { ironFraction: 0.3, volatileFraction: 0.1 };
    // Without density the body silently becomes 5500 kg/m³ ⇒ 5.5 g/cc, i.e. Earth,
    // and reads maximally rocky — which looks exactly like a real measurement.
    expect(conditionFromBody({ composition: noDensity })._provenance.composition).toBe('defaulted');
    expect(conditionFromBody({ composition: noDensity }).density).toBe(5.5);
  });

  it('reports rotationHours as defaulted on every generated planet, and says so out loud', () => {
    // Not a bug being asserted as correct — a measurement. The game emits
    // `rotationSpeed` (PlanetGenerator.js `rotationSpeed,` in the record literal —
    // symbol-only per PLAN §10; the integer form pointed at `noiseDetail` within a day),
    // never `rotationHours`, so
    // `condition.rotationHours` is the vector's 24 h fallback on 100% of bodies.
    // PLAN.md:403 makes a live gate out of exactly this kind of count at Step 8.
    let defaulted = 0;
    for (const pd of planets) if (conditionFromBody(pd)._provenance.rotationHours === 'defaulted') defaulted++;
    expect(defaulted).toBe(planets.length);
    expect(conditionFromBody(planets[0]).rotationHours).toBe(24);
  });

  it('is NON-ENUMERABLE, so it cannot enter a hash, a golden or a key-shape assertion', () => {
    const c = conditionFromBody(planets[0]);
    expect(c._provenance).toBeTruthy();
    expect(Object.keys(c)).not.toContain('_provenance');
    expect(JSON.parse(JSON.stringify(c))._provenance).toBeUndefined();
    expect({ ...c }._provenance).toBeUndefined();
    expect(Object.getOwnPropertyDescriptor(c, '_provenance').enumerable).toBe(false);
  });

  it('⛔ never lands on planetData, so no instrument exclusion list has to grow', () => {
    // The P1 defect Step 0 had to fix was a port OUTPUT sitting inside its own
    // instrument's matching key. `_provenance` is a port output. It rides on the
    // condition — which no instrument fingerprints — and the bake region at the bottom
    // of `PlanetGenerator.generate` (PlanetGenerator.js `planetData.iceness = icenessOf(condition);`
    // and its siblings, symbol-only per PLAN §10) writes only its five named bakes onto
    // the body record.
    for (const pd of planets.slice(0, 60)) {
      expect(Object.keys(pd)).not.toContain('_provenance');
      expect(Object.keys(pd)).not.toContain('radiusEarthCanonical');
      expect(Object.keys(pd)).not.toContain('axialTiltDeg');
      expect(Object.getOwnPropertyDescriptor(pd, '_provenance')).toBeUndefined();
    }
  });

  it('the shared WORLDENGINE_BAKES list is still the five bakes, unchanged by this step', () => {
    // Instruments B and C share this list by hand:
    // port-uniform-delta.mjs:756 `⛔ KEEP IN SYNC with` is C's half, over the list at
    // body-identity-fence.test.js:173 `const WORLDENGINE_BAKES` which is B's.
    // Step 1 adds no port output to planetData, so the list
    // must not have grown. If a later step DOES bake something, this fails and
    // points at both files.
    const five = ['iceColor', 'iceness', 'landPalette', 'lavaCrustColor', 'lavaGlowColor'];
    for (const rel of ['../tests/body-identity-fence.test.js', '../tools/port-uniform-delta.mjs']) {
      const src = readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
      const m = src.match(/WORLDENGINE_BAKES\s*=\s*\[([\s\S]*?)\]/);
      expect(m, `${rel} declares WORLDENGINE_BAKES`).toBeTruthy();
      const names = [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]).sort();
      expect(names, rel).toEqual(five);
      expect(names, `${rel} must not carry a Step-1 key`).not.toContain('_provenance');
    }
  });
});
