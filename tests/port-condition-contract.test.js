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
import { deriveConditionVector } from '../body-condition-vector.js';
import { DRIVER_PRESETS } from '../driver-presets.js';
import {
  conditionFromPlanet,
  atmosphereFromPlanet,
  axialTiltDegreesOf,
  habitabilityScalarOf,
  surfaceTemperatureOf,
  densityToGramsPerCC,
  PROVENANCE_INPUTS,
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
// THE FROZEN PRE-STEP-1 ADAPTER
//
// A verbatim copy of `conditionFromPlanet` as it stood at b2ac455, calling the
// SAME live `deriveConditionVector`. That last part is deliberate: the vector's
// pre-existing lines were not edited, so if the fp is the same the old keys must
// come out bit-identical. Any difference is therefore attributable to the fp —
// which is exactly the thing Step 1 changed.
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

function legacyConditionFromPlanet(planetData) {
  const fp = legacyFpFromPlanet(planetData);
  return deriveConditionVector(fp, null, fp.radiusEarth);
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
    // PlanetGenerator.js:687 rolls ±1.5 rad. In degrees that is ±86°, well inside
    // the ±180° an obliquity can take. If this ever reads ±0.0x, the conversion
    // was removed; if it reads ±4900, it was applied twice.
    for (const pd of planets) {
      const deg = conditionFromPlanet(pd).axialTiltDeg;
      expect(Number.isFinite(deg), pd.type).toBe(true);
      expect(Math.abs(deg)).toBeLessThanOrEqual(180);
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

describe('Step 1 · _provenance', () => {
  it('covers exactly 13 inputs, each measured or defaulted', () => {
    const p = conditionFromPlanet(planets[0])._provenance;
    expect(PROVENANCE_INPUTS.length).toBe(13);
    expect(Object.keys(p).sort()).toEqual([...PROVENANCE_INPUTS].sort());
    for (const [k, v] of Object.entries(p)) {
      expect(['measured', 'defaulted'], `${k} = ${v}`).toContain(v);
    }
    expect(Object.isFrozen(p)).toBe(true);
  });

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
