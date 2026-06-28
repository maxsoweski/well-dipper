// tests/worldengine-base-plate-driver-response.test.js
// Increment 2 (plate driver-response) — SLICE A coverage: the driver→tune seam is wired end-to-end
// and proven byte-identical BEFORE any calibration lands.
//
//   AC1  determinism + purity + bounded — driversToTune is pure; writePlateUpliftSphere with
//        tune:driversToTune(D) is reproducible; |U| < U_BOUND.
//   AC2  EARTH BYTE-IDENTITY (the load-bearing guard) — driversToTune(D_EARTH) is empty, so the
//        `tune ? {...DEFAULTS, ...tune} : DEFAULTS` ternary takes the untouched DEFAULTS branch and
//        the Earth field is byte-identical to a DEFAULTS-only baseline.
//   AC5  NO-CLOBBER (durable across slices) — threading bodyDrivers through writeBodyRelief leaves
//        the shell + despun relief paths byte-identical (bodyDrivers only ever affects the plate path).
//
// AC3 (monotone driver response), AC4 (age surfaced), AC6 (live probe), AC7 (UAT) land in SLICE B.
import { describe, it, expect } from 'vitest';
import { makeSphereField } from '../src/worldengine/base/sphereField.js';
import { writePlateUpliftSphere, driversToTune, D_EARTH, U_BOUND } from '../src/worldengine/base/plates.js';
import { writeBodyRelief, buildIrregularSphere } from '../planet-lod-rivers.js';

const SHARED_MESH = buildIrregularSphere(800, 2);
const SEEDS = [1, 2, 7, 42];
// A representative OFF-Earth driver vector (heavy, volatile-rich, tidally-hot, young). In SLICE A the
// stub maps it to null (byte-identical); SLICE B's AC3 asserts THIS vector diverges from the baseline.
const D_OFF = Object.freeze({ massGravity: 2.5, volatileFraction: 0.5, tidalHeating: 0.8, age: 1.0 });

function f32Equal(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
const isEmptyTune = (t) => t === null || t === undefined || (typeof t === 'object' && Object.keys(t).length === 0);

describe('AC1 — determinism, purity, bounded', () => {
  it('driversToTune is a pure function (same input → equal output)', () => {
    expect(driversToTune(D_EARTH)).toEqual(driversToTune(D_EARTH));
    expect(driversToTune(D_OFF)).toEqual(driversToTune(D_OFF));
  });
  it('writePlateUpliftSphere with tune:driversToTune(D) is reproducible + bounded', () => {
    for (const macroSeed of SEEDS) {
      const cA = makeSphereField(SHARED_MESH), cB = makeSphereField(SHARED_MESH);
      const a = writePlateUpliftSphere(cA, D_EARTH, { macroSeed, tune: driversToTune(D_EARTH) }).U;
      const b = writePlateUpliftSphere(cB, D_EARTH, { macroSeed, tune: driversToTune(D_EARTH) }).U;
      expect(f32Equal(a, b)).toBe(true);
      for (let i = 0; i < a.length; i++) expect(Math.abs(a[i])).toBeLessThan(U_BOUND);
    }
  });
});

describe('AC2 — EARTH byte-identity (the load-bearing identity guard)', () => {
  it('driversToTune(D_EARTH) is an empty/null override (takes the DEFAULTS branch)', () => {
    expect(isEmptyTune(driversToTune(D_EARTH))).toBe(true);
  });
  it('Earth-point field is byte-identical to a DEFAULTS-only baseline, every seed', () => {
    for (const macroSeed of SEEDS) {
      const cBase = makeSphereField(SHARED_MESH), cEarth = makeSphereField(SHARED_MESH);
      const base = writePlateUpliftSphere(cBase, {}, { macroSeed }).U;                                   // DEFAULTS path (no tune)
      const earth = writePlateUpliftSphere(cEarth, D_EARTH, { macroSeed, tune: driversToTune(D_EARTH) }).U;
      expect(f32Equal(base, earth)).toBe(true);
    }
  });
});

describe('AC5 — NO-CLOBBER of the shell + despun paths (durable)', () => {
  it('shell path (icy-active) is byte-identical whether or not bodyDrivers is passed', () => {
    for (const macroSeed of SEEDS) {
      const cA = makeSphereField(SHARED_MESH), cB = makeSphereField(SHARED_MESH);
      writeBodyRelief(cA, { archetype: 'ice', macroSeed });
      writeBodyRelief(cB, { archetype: 'ice', bodyDrivers: D_OFF, macroSeed });
      expect(f32Equal(cA.height, cB.height)).toBe(true);
    }
  });
  it('despun path (unlocked impact-airless) is byte-identical whether or not bodyDrivers is passed', () => {
    for (const macroSeed of SEEDS) {
      const cA = makeSphereField(SHARED_MESH), cB = makeSphereField(SHARED_MESH);
      writeBodyRelief(cA, { archetype: 'impact-airless', macroSeed });
      writeBodyRelief(cB, { archetype: 'impact-airless', bodyDrivers: D_OFF, macroSeed });
      expect(f32Equal(cA.height, cB.height)).toBe(true);
    }
  });
});

describe('SLICE-A transient invariant (SLICE B replaces with AC3 divergence)', () => {
  it('stub: the plate field is byte-identical regardless of bodyDrivers', () => {
    for (const macroSeed of SEEDS) {
      const cA = makeSphereField(SHARED_MESH), cB = makeSphereField(SHARED_MESH);
      writeBodyRelief(cA, { archetype: 'terrestrial', macroSeed });
      writeBodyRelief(cB, { archetype: 'terrestrial', bodyDrivers: D_OFF, macroSeed });
      expect(f32Equal(cA.height, cB.height)).toBe(true);
    }
  });
});
