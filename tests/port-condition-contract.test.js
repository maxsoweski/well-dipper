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
  habitabilityScalarOf,
  surfaceTemperatureOf,
  densityToGramsPerCC,
  PROVENANCE_INPUTS,
  PROVENANCE_COVERAGE,
} from '../src/worldengine/port/conditionFromPlanet.js';

// The eight derivations that ALREADY SHIP on the game route. Five are baked onto
// planetData at PlanetGenerator.js:743-756; three are built per-material at
// Planet.js:1568-1591. If Step 1 moved a pixel, it moved one of these.
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
 * Effective obliquity, recomputed here from the physics rather than imported,
 * so this file is an independent check on the adapter and not a restatement of
 * it. Obliquity's seasonal effect is symmetric about 0° (sign is a spin-axis
 * convention) and about 90° (past 90° the spin is retrograde and the SEASONS
 * run back down again — Venus at 177.6° is a ~2.4°-effective world).
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
    expect(expectedEffectiveObliquity(1.5 * (180 / Math.PI) * (180 / Math.PI))).toBeCloseTo(64.21, 2);
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
    // Found while building this step; not previously recorded. PhysicsEngine.js:687
    // returns `{ score, factors }` while its own JSDoc at :637 says
    // "@returns {number} score 0-1".
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
    // MoonGenerator.js:192-196 emits exactly this for a terrestrial moon. Through
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
// THE PROVENANCE INPUT-LIST FENCE — DERIVED FROM THE ADAPTER'S SOURCE TEXT
//
// ⛔ WHAT THE OLD FENCE DID. It asserted `PROVENANCE_INPUTS.length === 13` and
// `Object.keys(_provenance) === PROVENANCE_INPUTS`. BOTH SIDES DERIVED FROM THE
// SAME CONSTANT. Nothing read the adapter, so nothing could notice the adapter
// growing an input — and the adapter had ALREADY grown one (`comp.carbonToOxygen`)
// before the assertion was written.
//
// ⚠ MEASURED, NOT ARGUED: injecting `starMassEarth: d.starMassEarth` — one of
// the three reads Step 2 adds next (PLAN.md:205) — into the fp literal left all
// 47 tests GREEN. Reverted.
//
// ── WHAT REPLACES IT ────────────────────────────────────────────────────────
// Strip the adapter's comments and strings, brace-match `conditionFromPlanet`'s
// own body out of the result, collect every `d.<field>` / `comp.<field>` in it,
// and require that set to equal the union of `PROVENANCE_COVERAGE`'s values. The
// two sides are now the ADAPTER'S CODE and a DECLARATION — independent things.
// This is the same source-text technique the axialTilt block above uses to pin
// the game's radian datum; it is reused rather than reinvented.
//
// ⛔ WHY THE FUNCTION BODY AND NOT THE WHOLE FILE. `provenanceOf` is in this file
// and reads exactly the fields it records. Scanning it would put the record back
// on both sides of the comparison — the original defect, restored.
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Comments and string bodies removed, in ONE pass, so that `//` inside a string
 * does not open a comment and a backtick inside a comment does not open a
 * template literal. Returns `endState` too: anything other than 'code' means the
 * file ends inside a string or comment, which is the signature of this
 * codebase's known GLSL-template trap (a prose backtick terminating a template
 * literal). Asserted below rather than assumed.
 *
 * ⚠ KNOWN LIMIT, STATED: regex literals are not tracked. `conditionFromPlanet.js`
 * contains none, and `endState` catches the case where one would desync the scan.
 */
function stripCommentsAndStrings(src) {
  let out = '', i = 0, state = 'code';
  while (i < src.length) {
    const c = src[i], c2 = src[i + 1];
    if (state === 'code') {
      if (c === '/' && c2 === '/') { state = 'line'; i += 2; continue; }
      if (c === '/' && c2 === '*') { state = 'block'; i += 2; continue; }
      if (c === "'" || c === '"' || c === '`') { state = c; out += ' '; i++; continue; }
      out += c; i++; continue;
    }
    if (state === 'line') { if (c === '\n') { state = 'code'; out += '\n'; } i++; continue; }
    if (state === 'block') { if (c === '*' && c2 === '/') { state = 'code'; i += 2; } else { if (c === '\n') out += '\n'; i++; } continue; }
    if (c === '\\') { i += 2; continue; }
    if (c === state) { state = 'code'; i++; continue; }
    if (c === '\n') out += '\n';
    i++;
  }
  return { code: out, endState: state };
}

/** The brace-matched body of the function whose signature starts with `sig`. */
function functionBodyOf(code, sig) {
  const at = code.indexOf(sig);
  if (at < 0) return null;
  const open = code.indexOf('{', at);
  if (open < 0) return null;
  let depth = 0;
  for (let i = open; i < code.length; i++) {
    if (code[i] === '{') depth++;
    else if (code[i] === '}' && --depth === 0) return code.slice(open + 1, i);
  }
  return null;
}

/** Every `d.<field>` / `comp.<field>` read in a chunk of comment-free code. */
function planetDataReadsIn(body) {
  return new Set([...body.matchAll(/\b(d|comp)\.([A-Za-z_$][\w$]*)/g)].map((m) => `${m[1]}.${m[2]}`));
}

/** The adapter's own reads, extracted from disk. */
function adapterReads() {
  const src = readFileSync(
    fileURLToPath(new URL('../src/worldengine/port/conditionFromPlanet.js', import.meta.url)), 'utf8',
  );
  const { code, endState } = stripCommentsAndStrings(src);
  const body = functionBodyOf(code, 'export function conditionFromPlanet(planetData)');
  return { reads: body === null ? null : planetDataReadsIn(body), endState, body };
}

describe('Step 1 · _provenance describes THE ADAPTER, not itself', () => {
  it('CONTROL — the extractor finds a newly-added read, so a green result means something', () => {
    // ⛔ WITHOUT THIS, THE FENCE BELOW IS UNFALSIFIABLE. A regex that matches
    // nothing, or a brace-matcher that returns an empty body, produces an empty
    // set that trivially equals an empty declaration and the test passes over
    // any defect at all. So the extractor is run over a SYNTHETIC adapter that
    // carries an undeclared fifteenth read and is required to surface it —
    // proving the mechanism bites without editing the real file.
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
        return { fp, s };
      }
    `;
    const { code, endState } = stripCommentsAndStrings(synthetic);
    expect(endState, 'the stripper must finish in code state').toBe('code');
    const found = planetDataReadsIn(functionBodyOf(code, 'export function conditionFromPlanet(planetData)'));
    expect([...found].sort()).toEqual(
      ['comp.density', 'd.composition', 'd.radiusEarth', 'd.starMassEarth', 'd.tidalHeating'],
    );
    // and the two decoys stayed out — comments and strings are genuinely stripped
    expect(found.has('d.neverRead')).toBe(false);
    expect(found.has('d.alsoNeverRead')).toBe(false);
  });

  it('the adapter parses, and parses to something — not to an empty body', () => {
    // The second half of the anti-vacuity check, on the REAL file this time.
    const { reads, endState, body } = adapterReads();
    expect(endState, 'conditionFromPlanet.js ends inside a string or comment — the GLSL-backtick trap').toBe('code');
    expect(body, 'conditionFromPlanet could not be located in its own source').not.toBeNull();
    expect(body.length).toBeGreaterThan(400);
    expect(reads.size, 'the extractor found suspiciously few reads').toBeGreaterThanOrEqual(14);
    expect(reads.has('d.radiusEarth')).toBe(true);
    expect(reads.has('comp.carbonToOxygen')).toBe(true);

    // ⭐ A LIVE DECOY, not a synthetic one. The adapter's own PROSE now contains
    // the literal strings `d.starMassEarth`, `d.tidalHeating` and
    // `d.orbitRadiusEarth` (the block explaining what Step 2 will add). If the
    // comment stripper ever stops working, these appear as undeclared reads and
    // the fence below fires on a file nobody changed — a false red that would
    // teach the next reader to distrust it. So the decoys are asserted absent
    // here, where the failure names the stripper instead of the adapter.
    const src = readFileSync(
      fileURLToPath(new URL('../src/worldengine/port/conditionFromPlanet.js', import.meta.url)), 'utf8',
    );
    expect(src, 'the decoy must actually be present for this to test anything').toContain('d.starMassEarth');
    expect(reads.has('d.starMassEarth'), 'a commented-out read leaked past the stripper').toBe(false);
    expect(reads.has('d.tidalHeating')).toBe(false);
    expect(reads.has('d.orbitRadiusEarth')).toBe(false);
  });

  it('⛔ the fence\'s ONE assumption: every read goes through the `d` / `comp` aliases', () => {
    // The extractor matches `d.<field>` and `comp.<field>`. A future edit that
    // reached for `planetData.tidalHeating` directly would be a real input with
    // no provenance row AND invisible to the fence — the blind spot rebuilt one
    // level over. The adapter binds `planetData` exactly once, to `d`; that is
    // asserted here so the bypass cannot be opened silently.
    const { body } = adapterReads();
    const direct = [...body.matchAll(/\bplanetData\.([A-Za-z_$][\w$]*)/g)].map((m) => m[0]);
    expect(direct, `conditionFromPlanet reads ${direct.join(', ')} off planetData directly, bypassing the `
      + '`d` alias the provenance fence scans for — route it through `d`').toEqual([]);
    expect(body, 'the `d` alias itself').toMatch(/const\s+d\s*=\s*planetData\s*\|\|\s*\{\s*\}/);
    expect(body, 'the `comp` alias itself').toMatch(/const\s+comp\s*=\s*d\.composition\s*\|\|\s*\{\s*\}/);
  });

  it('⛔ EVERY property the adapter reads off planetData has a provenance row', () => {
    // THE FENCE. Left side: the adapter's source text. Right side: the coverage
    // declaration. Add a read without a row and this names the field.
    const { reads } = adapterReads();
    const declared = new Set(Object.values(PROVENANCE_COVERAGE).flat());
    const undeclared = [...reads].filter((r) => !declared.has(r)).sort();
    const stale = [...declared].filter((r) => !reads.has(r)).sort();
    expect(undeclared, `the adapter reads ${undeclared.join(', ')} with no PROVENANCE_COVERAGE row — `
      + 'add one, and a matching entry in provenanceOf').toEqual([]);
    expect(stale, `PROVENANCE_COVERAGE claims ${stale.join(', ')} but the adapter no longer reads it`).toEqual([]);
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
    // PlanetGenerator.js:448 and MoonGenerator.js:196 both set `atmosphere = null`
    // outright to mean "nothing retained". That IS the game's answer, and calling
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
    // `rotationSpeed` (PlanetGenerator.js:782), never `rotationHours`, so
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
    // condition — which no instrument fingerprints — and PlanetGenerator.js:743-756
    // writes only its five named bakes onto the body record.
    for (const pd of planets.slice(0, 60)) {
      expect(Object.keys(pd)).not.toContain('_provenance');
      expect(Object.keys(pd)).not.toContain('radiusEarthCanonical');
      expect(Object.keys(pd)).not.toContain('axialTiltDeg');
      expect(Object.getOwnPropertyDescriptor(pd, '_provenance')).toBeUndefined();
    }
  });

  it('the shared WORLDENGINE_BAKES list is still the five bakes, unchanged by this step', () => {
    // Instruments B and C share this list by hand (tools/port-uniform-delta.mjs:674
    // says "KEEP IN SYNC"). Step 1 adds no port output to planetData, so the list
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
