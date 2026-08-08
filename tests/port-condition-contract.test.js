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
import { deriveConditionVector, gravityRadiusRatio } from '../body-condition-vector.js';
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
import { deriveUniforms } from '../planet-lod-lab-core.js';
import {
  conditionFromPlanet,
  atmosphereFromPlanet,
  axialTiltDegreesOf,
  effectiveObliquityDegreesOf,
  habitabilityScalarOf,
  surfaceTemperatureOf,
  densityToGramsPerCC,
  PROVENANCE_INPUTS,
  PROVENANCE_COVERAGE,
} from '../src/worldengine/port/conditionFromPlanet.js';

// The eight derivations that ALREADY SHIP on the game route. Five are baked onto
// planetData in the record literal and the assignments under it in `PlanetGenerator.generate`
// — PlanetGenerator.js `iceColor: ICE_ALBEDO` and `planetData.iceness = icenessOf(condition);`
// with its three siblings, cited symbol-only per PLAN §10 because that region grows every step.
// Three more are built per-material inside `_createSurface`:
// Planet.js:1571 `craterUniformsFrom(condition)`, Planet.js:1584 `const optics = atmosphereOpticsOf(condition);`
// and Planet.js:1591 `const bioCover = biosphereOf(condition);`. If Step 1 moved a pixel,
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
// SAME LIVE VECTOR. Any edit inside `body-condition-vector.js` moved `was` and
// `now` together and cancelled exactly.
//
// ⚠ MEASURED, NOT ARGUED — two injections into `body-condition-vector.js`, each
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
 */
const EXPECTED_MOVERS = ['magneticField'];

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

beforeAll(() => {
  for (const seed of SEEDS) {
    const s = StarSystemGenerator.generate(seed, null);
    for (const e of s.planets || []) {
      planets.push(e.planetData);
      for (const m of e.moons || []) moons.push(m);
    }
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
    const live = Object.keys(conditionFromPlanet(planets[0])).sort();
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
  it('every pre-existing condition key that carried a value is BIT-equal', () => {
    const diffs = [];
    for (let i = 0; i < planets.length && diffs.length <= 24; i++) {
      const was = legacyConditionFromPlanet(planets[i]);
      const now = conditionFromPlanet(planets[i]);
      for (const k of PRE_STEP1_KEYS) {
        if (EXPECTED_MOVERS.includes(k)) continue;
        bitDiff(was[k], now[k], `${planets[i].type}[${i}].${k}`, diffs);
      }
    }
    expect(diffs, `${diffs.length} pre-existing condition value(s) moved`).toEqual([]);
  });

  it('magneticField is the ONE pre-existing key that moves, and it moves from nothing to something', () => {
    // Named, not blanket-excused. Before Step 1 the vector declared this key
    // (body-condition-vector.js:156) and the adapter never filled it — PLAN.md:46
    // calls that out as one of the three dropped inputs. Asserting the direction
    // means a future edit that makes it undefined again fails here.
    let filled = 0;
    for (const pd of planets) {
      expect(legacyConditionFromPlanet(pd).magneticField).toBeUndefined();
      const v = conditionFromPlanet(pd).magneticField;
      expect(Number.isFinite(v), `magneticField on a ${pd.type}`).toBe(true);
      expect(Object.is(v, pd.magneticField)).toBe(true);   // forwarded, not re-derived
      filled++;
    }
    expect(filled).toBe(planets.length);
  });

  it('the giant-driver triple {internalHeat, shellDepthFrac, dissipation} is byte-identical', () => {
    // PLAN.md:191 — "THIS is the assertion that actually means additive."
    // deriveGiantDrivers is the derivation most exposed to a widened contract:
    // its enrichment term (giant-drivers.js:122-131) explicitly prefers a
    // condition slot that Step 1 could have filled, and Step 5 will.
    const diffs = [];
    for (let i = 0; i < planets.length && diffs.length <= 24; i++) {
      bitDiff(
        deriveGiantDrivers(legacyConditionFromPlanet(planets[i])),
        deriveGiantDrivers(conditionFromPlanet(planets[i])),
        `${planets[i].type}[${i}]`, diffs,
      );
    }
    expect(diffs, `giant triple moved on ${diffs.length} body/bodies`).toEqual([]);

    const gas = planets.filter((p) => GIANT_TYPES.has(p.type));
    expect(gas.length, 'the corpus must actually contain gas bodies').toBeGreaterThanOrEqual(100);
  });

  it('every shipped law returns bit-identical output for the whole corpus', () => {
    // The broadest statement of "no pixel moved" this file can make without a
    // renderer: the five bakes PlanetGenerator writes and the three derivations
    // Planet.js builds per material, over every body.
    const diffs = [];
    for (let i = 0; i < planets.length && diffs.length <= 24; i++) {
      bitDiff(
        shippedLawOutputs(legacyConditionFromPlanet(planets[i])),
        shippedLawOutputs(conditionFromPlanet(planets[i])),
        `${planets[i].type}[${i}]`, diffs,
      );
    }
    expect(diffs, `${diffs.length} shipped law output(s) moved`).toEqual([]);
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
      const cond = conditionFromPlanet(pd);
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
      expect(conditionFromPlanet(pd).surfaceHistory).toBe(pd.surfaceHistory);
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
      const sh = conditionFromPlanet(pd).surfaceHistory;
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
      const c = conditionFromPlanet(pd);
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
      fileURLToPath(new URL('../planet-lod-lab-core.js', import.meta.url)), 'utf8',
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
    expect(conditionFromPlanet({ radiusEarth: 0.273 }).axialTiltDeg).toBeUndefined();
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
      const deg = conditionFromPlanet(pd).axialTiltDeg;
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
    const degs = planets.map((pd) => conditionFromPlanet(pd).axialTiltDeg);
    const bad = degs.filter((d) => !(d >= 0 && d <= 90));
    expect(bad.length, `${bad.length}/${degs.length} outside [0,90]; e.g. ${bad.slice(0, 5)}`).toBe(0);
  });

  it('emits exactly the effective obliquity of the game\'s radian field — checked body by body', () => {
    // Independent recomputation from `planetData.axialTilt`, so this pins the
    // COMPOSITION (rad→deg, then fold) and not just the endpoints.
    for (const pd of planets) {
      if (typeof pd.axialTilt !== 'number') continue;
      expect(conditionFromPlanet(pd).axialTiltDeg)
        .toBeCloseTo(expectedEffectiveObliquity(pd.axialTilt * 180 / Math.PI), 10);
    }
  });

  it('does not collapse half the galaxy onto a single frost bias — the consumer, run for real', () => {
    // ⛔ THE DEFECT, STATED AS THE CONSUMER SEES IT. Before the fold, measured
    // over this exact corpus: 267/526 bodies read `frostLatitudeBias === 0`
    // and 260 distinct bias values existed across 526 bodies, because every
    // negative tilt clamped to the same floor. After: 0 and 526.
    const bias = planets
      .map((pd) => conditionFromPlanet(pd).axialTiltDeg)
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
      const deg = conditionFromPlanet(b).axialTiltDeg;
      expect(deg).toBeGreaterThanOrEqual(0);
      expect(deg).toBeLessThanOrEqual(90);
      expect(frostLatitudeBiasFor(deg)).toBeLessThan(1);      // was exactly 1.000 on all four
    }

    // Venus, the sharpest case: 3.1 rad = 177.62°, physically a ~2.38°-effective
    // world that should hold tight polar caps. It read bias 1.000 — maximum
    // equator-ward frost spread — which is the most wrong a value in [0,1] can be.
    const venus = bodies.find((b) => b.axialTilt === 3.1);
    expect(venus, 'SolarSystemData.js still carries Venus at 3.1 rad').toBeTruthy();
    expect(conditionFromPlanet(venus).axialTiltDeg).toBeCloseTo(2.38, 2);
    expect(frostLatitudeBiasFor(conditionFromPlanet(venus).axialTiltDeg)).toBeCloseTo(0.026, 3);
  });

  it('folds on the physics identities, not on an implementation detail', () => {
    // A tilt and its mirror are the same obliquity; so are θ and 180−θ. These
    // are properties of the sky, so they hold whatever the adapter does inside.
    const deg = (r) => conditionFromPlanet({ axialTilt: r }).axialTiltDeg;
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
    expect(Number.isNaN(conditionFromPlanet({ axialTilt: NaN }).axialTiltDeg)).toBe(true);
    expect(conditionFromPlanet({ axialTilt: undefined }).axialTiltDeg).toBeUndefined();
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
    expect(clamp01(conditionFromPlanet(planets[0]).habitability)).not.toBeNaN();
  });

  it('emits the scalar, from either side\'s shape', () => {
    for (const pd of planets) {
      const h = conditionFromPlanet(pd).habitability;
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
    // MoonGenerator.js:193 `atmosphere: type === 'terrestrial' ? {` emits exactly this
    // for a terrestrial moon (closed by MoonGenerator.js:196 `} : null,`). Through
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

    const now = conditionFromPlanet(moonLike);
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
        conditionFromPlanet(pd).atmosphere, `${pd.type}.atmosphere`, [],
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
    // (conditionFromPlanet.js, the `color:` line) — this is a regression fence on a
    // claim that was true before the step, not a new addition.
    const withPhysics = {
      color: [0.8, 0.5, 0.3], strength: 0.15,
      physics: { retained: true, pressure: 0.006, composition: 'co2' },
    };
    expect(atmosphereFromPlanet(withPhysics).color).toBe(withPhysics.color);
    for (const pd of planets) {
      if (!pd.atmosphere) continue;
      expect(conditionFromPlanet(pd).atmosphere.color).toBe(pd.atmosphere.color);
    }
  });
});

describe('Step 1 · metallicity is NOT forwarded — it lands in Step 5', () => {
  it('stays undefined on every generated body', () => {
    for (const pd of planets) {
      expect(typeof pd.metallicity, 'the game does carry one').toBe('number');
      expect(conditionFromPlanet(pd).metallicity, `${pd.type} — forwarded too early`).toBeUndefined();
    }
  });

  it('MEASURES the trap, so the reason cannot rot into folklore', () => {
    // PLAN.md:182. `giant-drivers.js:124-125` reads `condition.metallicity` as its
    // declared PRIMARY enrichment term, but `canonicalZ0` (:136-138) is ALWAYS the
    // density proxy — a weighted sum in g/cc — while generated metallicity is a
    // DEX value that is roughly half negative. Forwarding it switches the
    // numerator's branch across a unit mismatch the denominator does not follow.
    const gas = planets.filter((p) => GIANT_TYPES.has(p.type));
    expect(gas.length).toBeGreaterThanOrEqual(100);

    const dex = gas.map((p) => p.metallicity);
    expect(Math.min(...dex)).toBeLessThan(0);
    expect(dex.filter((m) => m < 0).length / dex.length).toBeGreaterThan(0.2);  // ~half, measured

    const held = gas.map((p) => deriveGiantDrivers(conditionFromPlanet(p)).shellDepthFrac);
    const forwarded = gas.map((p) => {
      const c = { ...conditionFromPlanet(p), metallicity: p.metallicity };
      return deriveGiantDrivers(c).shellDepthFrac;
    });

    // Held back: one value across the whole population (the density proxy is
    // near-constant for the game's gas bodies).
    expect(new Set(held.map((v) => v.toFixed(6))).size).toBe(1);
    // Forwarded: also one value — but a DIFFERENT one, pegged at the clamp
    // ceiling. Degenerate either way, which is why a "did it change?" eyeball on
    // one body would not have caught it.
    expect(new Set(forwarded.map((v) => v.toFixed(6))).size).toBe(1);
    expect(forwarded[0]).not.toBe(held[0]);
    expect(forwarded[0]).toBeGreaterThan(held[0]);
    // And the tell: it is pinned to a clamp bound, not to a physical answer.
    expect(forwarded.every((v) => v === forwarded[0])).toBe(true);
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
 *   #1 `arguments`. Inside `conditionFromPlanet`, `arguments[0]` IS `planetData`.
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
  const adapterName = opts.adapter || 'conditionFromPlanet';
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
  fileURLToPath(new URL('../src/worldengine/port/conditionFromPlanet.js', import.meta.url)), 'utf8',
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
      export function conditionFromPlanet(planetData) {
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
      export function conditionFromPlanet(planetData) {
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
    expect(a.reads.size, 'the analyser found suspiciously few reads').toBeGreaterThanOrEqual(14);

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
      'atmosphereFromPlanet', 'axialTiltDegreesOf', 'conditionFromPlanet',
      'densityToGramsPerCC', 'effectiveObliquityDegreesOf', 'habitabilityScalarOf',
      'surfaceTemperatureOf',
    ]);

    // ⭐ A LIVE DECOY, not a synthetic one. The adapter's own PROSE contains the
    // literal strings `d.starMassEarth`, `d.tidalHeating` and `d.orbitRadiusEarth`
    // (the block explaining what Step 2 will add). Under the old text scan those
    // needed a hand-written comment stripper to stay out; under a parser they are
    // not nodes at all. Asserted anyway, because the decoys are the cheapest possible
    // check that the thing being walked is CODE.
    const src = ADAPTER_SRC();
    expect(src, 'the decoy must actually be present for this to test anything').toContain('d.starMassEarth');
    expect(a.reads.has('d.starMassEarth'), 'a commented-out read was analysed as code').toBe(false);
    expect(a.reads.has('d.tidalHeating')).toBe(false);
    expect(a.reads.has('d.orbitRadiusEarth')).toBe(false);
  });

  it('⛔ the adapter uses NONE of the bypass forms — with the injected controls that make that zero mean something', () => {
    // THE FENCE'S SECOND HALF, on the real file. Every route to an input that is not
    // a declared read is a real input with no provenance row AND invisible to the
    // provenance record — the blind spot rebuilt one level over.
    const declared = new Set(Object.values(PROVENANCE_COVERAGE).flat());
    const live = fenceFindings(ADAPTER_SRC(), declared);
    expect(live.findings, 'conditionFromPlanet.js reaches an input by a route this analysis cannot '
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

    // H — a declaration split from its assignment. The regex fence required
    //     `const|let|var NAME = d` and matched NOTHING here.
    expect(inject(src.replace(ANCHOR, `  let p; p = d; const _t = p.tidalHeating;\n${ANCHOR}`)))
      .toContain('undeclared read d.tidalHeating');
    // I — object spread. The initialiser is `{`, not `d`.
    expect(inject(src.replace(ANCHOR, `  const all = { ...d }; const _t = all.tidalHeating;\n${ANCHOR}`)))
      .toContain('undeclared read d.tidalHeating');
    // G — nested destructuring. `\{[^{}]*\}` cannot match a brace inside the pattern,
    //     so the top-level `starMassEarth` in the same statement escaped with it.
    expect(inject(src.replace(ANCHOR, `  const { atmosphere: { pressure }, starMassEarth } = d;\n${ANCHOR}`)))
      .toContain('undeclared read d.starMassEarth');
    // A — Step 2's declared first move, written the way this file already writes
    //     things: a module-scope helper, CALLED with `d`. The pre-round-1 fence
    //     (which scanned `conditionFromPlanet`'s body alone) answered `false` here.
    //     ⚠ THE CALL IS PART OF THE INJECTION, DELIBERATELY. Adding the helper and
    //     not calling it correctly produces NOTHING: a dead function reads no input,
    //     and a fence that reported it would fire on every unused parameter in the
    //     file. Measured — the first cut of this control omitted the call and read 0,
    //     which would have been recorded as "the fence is blind" against a fence that
    //     was right. Taint enters a helper at its CALL SITE or not at all.
    expect(inject(`function tidalHeatOf(d) { return d.tidalHeating ?? 0; }\n`
      + src.replace(ANCHOR, `  const _t = tidalHeatOf(d);\n${ANCHOR}`)))
      .toContain('undeclared read d.tidalHeating');
    // and the other half of that pair: the helper WITHOUT the call is correctly silent
    expect(inject(`function tidalHeatOf(d) { return d.tidalHeating ?? 0; }\n${src}`),
      'an uncalled helper is not a read of the adapter\'s input').toEqual([]);

    // ═══ K–P INJECTED INTO THE REAL FILE — the six that beat round 2 ══════════════
    // ⛔ THE SYNTHETIC ROWS ABOVE ARE NOT ENOUGH ON THEIR OWN. A synthetic adapter is
    // 14 lines; the real one is 530, with a `provenanceOf` partition, an atmosphere
    // helper three names away from `d`, and an `Object.defineProperty` at the end.
    // Every one of these six was originally proven ON DISK, against the real file,
    // with all 56 tests green — so the real file is where the fix has to be shown
    // working. Injected in memory here; the on-disk runs are recorded in the round's
    // report, md5-guarded before and after.
    expect(inject(src.replace(ANCHOR, `  let _sb; class _S { static { _sb = d.tidalHeating; } } void _sb; void _S;\n${ANCHOR}`)),
      'K — a class static block is invisible again').toContain('undeclared read d.tidalHeating');
    expect(inject(src.replace(ANCHOR, `  let _z = null; _z ||= d; const _t = _z.tidalHeating; void _t;\n${ANCHOR}`)),
      'L — `||=` drops the binding again').toContain('undeclared read d.tidalHeating');
    expect(inject(src.replace(ANCHOR, `  let _z; _z ??= d; const _t = _z.tidalHeating; void _t;\n${ANCHOR}`)),
      'M — `??=` drops the binding again').toContain('undeclared read d.tidalHeating');
    expect(inject(src.replace(ANCHOR, `  let _z = d; _z &&= d; const _t = _z.tidalHeating; void _t;\n${ANCHOR}`)),
      'N — `&&=` drops the binding again').toContain('undeclared read d.tidalHeating');
    // O and P are named as `unmodelled:` rather than as a read — the round's whole
    // point. Matched on the prefix plus the construct, because the line number moves
    // with the anchor and pinning it would make this brittle for no gain.
    const oHit = inject(src.replace(ANCHOR, `  const _b = { get inner(){ return d; } }; const _t = _b.inner.tidalHeating; void _t;\n${ANCHOR}`));
    expect(oHit.some((h) => h.startsWith('unmodelled: accessor `get inner` on an object literal at line ')),
      `O — an accessor hands the input out of a property slot unnoticed: ${oHit}`).toBe(true);
    const pSrc = `function* _g(x){ yield x; }\n`
      + src.replace(ANCHOR, `  const _t = _g(d).next().value.tidalHeating; void _t;\n${ANCHOR}`);
    const pFindings = inject(pSrc);
    expect(pFindings.some((h) => h.startsWith('unmodelled: `_g(…)` at line ')
      && h.includes('generator function')), `P — a generator laundered the input: ${pFindings}`).toBe(true);

    // ⛔ AND THE FOUR THIS ROUND FOUND BY ATTACKING ITS OWN FENCE, on the real file.
    // Every one was silent when this round started, none is in the brief's list, and
    // none is a re-spelling of K–P — they are the residue the previous two rounds
    // would have shipped undisclosed. Q and T in particular are the same defect as
    // the original five: a NODE THE WALK NEVER VISITED (`handler.param`) and a CHANNEL
    // WITH NO BINDING (the unwind), not a pattern nobody had thought to match.
    const throwHit = inject(src.replace(ANCHOR, `  let _t; try { throw d; } catch (_e) { _t = _e.tidalHeating; } void _t;\n${ANCHOR}`));
    expect(throwHit.some((h) => h.startsWith('unmodelled: `throw` at line ')),
      `Q — throw/catch smuggles the input past the walk: ${throwHit}`).toBe(true);
    expect(inject(`function _h(x, y = x){ return y.tidalHeating; }\n`
      + src.replace(ANCHOR, `  const _t = _h(d); void _t;\n${ANCHOR}`)),
      'R — a parameter DEFAULT that re-aliases another parameter').toContain('undeclared read d.tidalHeating');
    const asyncHit = inject(src.replace(ANCHOR, `  const _p = (async () => d)(); void _p;\n${ANCHOR}`));
    expect(asyncHit.some((h) => h.startsWith('unmodelled: `an immediately-invoked function expression(…)` at line ')),
      `S — an async IIFE with no arguments carries the input out through its promise: ${asyncHit}`).toBe(true);
    expect(inject(src.replace(ANCHOR, '  let _t3; try { _t3 = 1; } catch ({ message: _m = d }) '
      + `{ _t3 = _m.tidalHeating; } void _t3;\n${ANCHOR}`)),
      'T — a DEFAULT inside a catch parameter; round 2 never walked `handler.param` at all')
      .toContain('undeclared read d.tidalHeating');

    // ── J: THE PARTITION IS NOT A HOLE. A read inside `provenanceOf` still has to
    //    resolve to a declared row, so exfiltrating one from there is caught.
    const NEEDLE = 'function provenanceOf(d, comp) {';
    expect(src, 'the partition anchor moved — `provenanceOf` cannot be located').toContain(NEEDLE);
    expect(inject(src.replace(NEEDLE, `${NEEDLE}\n  const leaked = d?.starMassEarth;`)),
      'a read inside provenanceOf is excused again — that is bypass J, reopened')
      .toContain('undeclared read d.starMassEarth');

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
    const p = conditionFromPlanet(planets[0])._provenance;
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
    expect(conditionFromPlanet(carbonish)._provenance.carbonToOxygen).toBe('measured');
    expect(conditionFromPlanet(bare)._provenance.carbonToOxygen).toBe('defaulted');
    // ...while the composition ROW stays 'measured' on both, which is the reason
    // this needed its own row instead of joining the density/iron/volatile group.
    expect(conditionFromPlanet(bare)._provenance.composition).toBe('measured');

    // surfaceMaterial.js:335, inside surfacePaletteOf — one of the five bakes.
    const lit = surfacePaletteOf(conditionFromPlanet(carbonish));
    const unlit = surfacePaletteOf(conditionFromPlanet(bare));
    expect(lit.fresh).not.toEqual(unlit.fresh);
    expect(unlit.fresh[0]).toBeGreaterThan(lit.fresh[0] * 1.5);   // measured 2.2x brighter
  });

  it('and reports it defaulted on the populations that actually lack it', () => {
    // Measured: 526/526 generated planets carry C/O, 0/39 Sol bodies do. So on
    // Sol the engine has always read a fabricated 0 for it, unrecorded.
    for (const pd of planets) expect(conditionFromPlanet(pd)._provenance.carbonToOxygen).toBe('measured');

    const sol = generateSolarSystem();
    const bodies = [];
    for (const e of sol.planets || []) {
      bodies.push(e.planetData);
      for (const m of e.moons || []) bodies.push(m.planetData || m);
    }
    expect(bodies.length).toBeGreaterThanOrEqual(30);
    const measured = bodies.filter((b) => conditionFromPlanet(b)._provenance.carbonToOxygen === 'measured');
    expect(measured.length, 'if Sol gains a C/O this becomes a real measurement — retire the claim above').toBe(0);
  });
});

describe('Step 1 · _provenance', () => {

  it('PLAN.md:192 — measured on a generated planet, defaulted on a bare radius', () => {
    expect(conditionFromPlanet(planets[0])._provenance.massEarth).toBe('measured');
    expect(conditionFromPlanet({ radiusEarth: 0.273 })._provenance.massEarth).toBe('defaulted');
  });

  it('names the fabrications on a Sol-shaped moon record, which is the point of it', () => {
    // `{radiusEarth: 0.273}` is the Moon, as SolarSystemData.js:196-198 stores it.
    // Ten of the thirteen inputs are invented, every one of them silently, and the
    // condition that comes out is a finite, plausible, entirely fictional body.
    const p = conditionFromPlanet({ radiusEarth: 0.273 })._provenance;
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
    // PlanetGenerator.js:448 `let atmosphere = null;` and MoonGenerator.js:196 `} : null,`
    // both set it outright to mean "nothing retained". That IS the game's answer, and calling
    // it 'defaulted' would cry wolf on every airless body in the galaxy.
    expect(conditionFromPlanet({ atmosphere: null })._provenance.atmosphere).toBe('measured');
    expect(conditionFromPlanet({})._provenance.atmosphere).toBe('defaulted');
    expect(conditionFromPlanet({ atmosphere: { color: [1, 1, 1], strength: 0.3 } })
      ._provenance.atmosphere).toBe('defaulted');
    expect(conditionFromPlanet({ atmosphere: { retained: true, pressure: 1 } })
      ._provenance.atmosphere).toBe('measured');
  });

  it('calls a partly-populated composition defaulted, because that is the fabrication case', () => {
    const all = { ironFraction: 0.3, density: 5500, volatileFraction: 0.1 };
    expect(conditionFromPlanet({ composition: all })._provenance.composition).toBe('measured');
    const noDensity = { ironFraction: 0.3, volatileFraction: 0.1 };
    // Without density the body silently becomes 5500 kg/m³ ⇒ 5.5 g/cc, i.e. Earth,
    // and reads maximally rocky — which looks exactly like a real measurement.
    expect(conditionFromPlanet({ composition: noDensity })._provenance.composition).toBe('defaulted');
    expect(conditionFromPlanet({ composition: noDensity }).density).toBe(5.5);
  });

  it('reports rotationHours as defaulted on every generated planet, and says so out loud', () => {
    // Not a bug being asserted as correct — a measurement. The game emits
    // `rotationSpeed` (PlanetGenerator.js `rotationSpeed,` in the record literal —
    // symbol-only per PLAN §10; the integer form pointed at `noiseDetail` within a day),
    // never `rotationHours`, so
    // `condition.rotationHours` is the vector's 24 h fallback on 100% of bodies.
    // PLAN.md:403 makes a live gate out of exactly this kind of count at Step 8.
    let defaulted = 0;
    for (const pd of planets) if (conditionFromPlanet(pd)._provenance.rotationHours === 'defaulted') defaulted++;
    expect(defaulted).toBe(planets.length);
    expect(conditionFromPlanet(planets[0]).rotationHours).toBe(24);
  });

  it('is NON-ENUMERABLE, so it cannot enter a hash, a golden or a key-shape assertion', () => {
    const c = conditionFromPlanet(planets[0]);
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
