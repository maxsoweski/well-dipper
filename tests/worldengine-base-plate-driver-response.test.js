// tests/worldengine-base-plate-driver-response.test.js
// Increment 2 (plate driver-response) — SLICE A + SLICE B coverage.
//
//   AC1  determinism + purity + bounded — driversToTune is pure; writePlateUpliftSphere with
//        tune:driversToTune(D) is reproducible; |U| < U_BOUND.
//   AC2  EARTH BYTE-IDENTITY (the load-bearing guard) — driversToTune(D_EARTH) is empty, so the
//        `tune ? {...DEFAULTS, ...tune} : DEFAULTS` ternary takes the untouched DEFAULTS branch and
//        the Earth field is byte-identical to a DEFAULTS-only baseline.
//   AC3  MONOTONE, CORRECT-SIGN driver response (SLICE B; replaces the SLICE-A transient invariant) —
//        each driver, swept with the others held at D_EARTH, moves its mapped plate parameter
//        monotonically in its documented physical direction, and off-Earth differs from the baseline.
//   (D16 age was DESCOPED — Max UAT 2026-06-28. driversToTune accepts but IGNORES age; its real home
//   is the epoch model (#6) + weathering (#7). A guard block below asserts age has no effect.)
//   AC5  NO-CLOBBER (durable across slices) — threading bodyDrivers through writeBodyRelief leaves
//        the shell + despun relief paths byte-identical (bodyDrivers only ever affects the plate path).
//
// AC6 (live probe), AC7 (UAT) are integration/UAT, covered live / by Max.
import { describe, it, expect } from 'vitest';
import { makeSphereField } from '../src/worldengine/base/sphereField.js';
import { writePlateUpliftSphere, driversToTune, D_EARTH, DEFAULTS, U_BOUND } from '../src/worldengine/base/plates.js';
import { writeBodyRelief, buildIrregularSphere, DEFAULT_GRAIN_DRIVERS } from '../planet-lod-rivers.js';
// PRESET_ARCHETYPE-retirement (2026-07-13): the AC5 no-clobber `it`s migrate to condition-bearing bundles.
import { DRIVER_PRESETS } from '../driver-presets.js';
import { buildNeutralBodyDrivers } from '../body-drivers.js';
import { deriveConditionVector } from '../body-condition-vector.js';
import { deriveUniforms } from '../planet-lod-lab-core.js';

const SHARED_MESH = buildIrregularSphere(800, 2);
// Condition-bearing bundle for a representative preset (mirrors the dispatch-oracle bundle17). SHARED_MESH is
// this suite's own mesh; despun() never reads bodyDrivers, so the no-clobber invariant is exact.
function condBundle(name, opts = {}) {
  const fp = DRIVER_PRESETS[name];
  const u = deriveUniforms(fp, 1.0);
  return {
    grainDrivers: DEFAULT_GRAIN_DRIVERS,
    bodyDrivers: { ...buildNeutralBodyDrivers(u, fp), condition: deriveConditionVector(fp, u, fp.radiusEarth) },
    ...opts,
  };
}
const SEEDS = [1, 2, 7, 42];
// Wider seed pool for the AC3 direction sweeps: the per-plate continental/oceanic split is a discrete
// threshold (rngType() < CONTINENTAL_FRACTION), so single-seed monotonicity is noisy. Averaging the
// observable over several seeds turns AC3 into an unambiguous DIRECTION test (its intent), not a
// per-seed precision test.
const SWEEP_SEEDS = [1, 2, 7, 42, 11, 23];
// A representative OFF-Earth driver vector (heavy, volatile-rich, tidally-hot, young). AC3 asserts THIS
// vector diverges from the Earth baseline.
const D_OFF = Object.freeze({ massGravity: 2.5, volatileFraction: 0.5, tidalHeating: 0.8, age: 1.0 });

function f32Equal(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
const isEmptyTune = (t) => t === null || t === undefined || (typeof t === 'object' && Object.keys(t).length === 0);

// ── AC3 observable helpers (read the existing plate diag shape) ────────────────────────────────────
function buildField(D, macroSeed) {
  const c = makeSphereField(SHARED_MESH);
  return writePlateUpliftSphere(c, D, { macroSeed, tune: driversToTune(D) });
}
const maxAbsU = (diag) => { let m = 0; for (const v of diag.U) m = Math.max(m, Math.abs(v)); return m; };
// continental signal: mean per-node base elevation (continental plates ride at BASE_CONT > BASE_OCEAN),
// a smoother proxy for "continental fraction" than the raw plateType count across seeds.
const meanBase = (diag) => { let s = 0; for (const v of diag.baseElevField) s += v; return s / diag.baseElevField.length; };
const avgOver = (D, fn) => SWEEP_SEEDS.reduce((s, seed) => s + fn(buildField(D, seed)), 0) / SWEEP_SEEDS.length;
// strictly increasing / decreasing across a numeric series
const strictlyDown = (xs) => xs.every((x, i) => i === 0 || x < xs[i - 1]);
const nonDecreasing = (xs) => xs.every((x, i) => i === 0 || x >= xs[i - 1]);

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

describe('AC5 — NO-CLOBBER of the despun path (durable)', () => {
  // (R1, PRESET_ARCHETYPE-retirement) the shell-path no-clobber `it` is RETIRED: D_OFF's massGravity/
  // volatileFraction/tidalHeating are EXACTLY the fields shellDriversToTune reads, and the derived shell()
  // helper now computes the tune UNCONDITIONALLY (V2-5s made shell driver-responsive by design), so a
  // condition-bearing D_OFF changes shell bytes — the old "bodyDrivers inert on shell" premise was a
  // bridge-gate artifact. Byte-safe-at-REF-regardless-of-driver-bundle is owned by shell-multiply call-site-1.
  it('despun path (Mars) is byte-identical whether or not extra bodyDrivers are merged (despun never reads them)', () => {
    for (const macroSeed of SEEDS) {
      const cA = makeSphereField(SHARED_MESH), cB = makeSphereField(SHARED_MESH);
      // M1: 'impact-airless' → Mars condition (dead-lid rocky → despun). despun() reads only grainDrivers +
      // heightSeed, never bodyDrivers, so merging D_OFF onto the condition-bearing bundle is byte-inert forever.
      const bundle = condBundle('Mars (arid rocky)', { macroSeed });
      writeBodyRelief(cA, bundle);
      writeBodyRelief(cB, { ...bundle, bodyDrivers: { ...bundle.bodyDrivers, ...D_OFF } });
      expect(f32Equal(cA.height, cB.height)).toBe(true);
    }
  });
});

describe('AC3 — monotone, correct-sign per-driver response (each swept with others at D_EARTH)', () => {
  it('gravity ↑ → relief amplitude DOWN (max|U| ∝ 1/g: isostasy + crustal yield strength)', () => {
    const gs = [0.4, 0.9, 1.5, 2.5];
    const amps = gs.map((g) => avgOver({ ...D_EARTH, massGravity: g }, maxAbsU));
    expect(strictlyDown(amps)).toBe(true);
    // off-Earth differs measurably from the Earth baseline at the sweep extremes
    expect(Math.abs(amps[0] - amps[1])).toBeGreaterThan(0.05);   // low-g vs Earth-g
    expect(Math.abs(amps[3] - amps[1])).toBeGreaterThan(0.05);   // high-g vs Earth-g
  });

  it('volatiles ↑ → continental fraction DOWN (a larger volatile budget drowns continental crust)', () => {
    const vfs = [0.02, 0.15, 0.35, 0.5];
    const cont = vfs.map((vf) => avgOver({ ...D_EARTH, volatileFraction: vf }, meanBase));
    expect(strictlyDown(cont)).toBe(true);
    expect(Math.abs(cont[0] - cont[3])).toBeGreaterThan(0.05);   // dry vs ocean-rich are different worlds
  });

  it('tidal heating ↑ → plate count UP (more internal heat → thinner lithosphere → more plates)', () => {
    const ths = [0.0, 0.25, 0.5, 0.75, 1.0];
    const counts = ths.map((th) => avgOver({ ...D_EARTH, tidalHeating: th }, (d) => d.plateCount));
    expect(nonDecreasing(counts)).toBe(true);                    // discrete count: monotone non-decreasing
    expect(counts[counts.length - 1]).toBeGreaterThan(counts[0]); // calm vs tidally-hot are different worlds
  });
});

describe('age DESCOPED (Inc.2, Max UAT 2026-06-28) — accepted but IGNORED, no effect on the tune', () => {
  it('changing age alone does NOT change driversToTune output (a younger and an older Earth-like are identical)', () => {
    const young = driversToTune({ ...D_EARTH, volatileFraction: 0.3, age: 1.0 });
    const old = driversToTune({ ...D_EARTH, volatileFraction: 0.3, age: 10.0 });
    expect(young).toEqual(old);
  });
  it('an age-less body equals an age-bearing body (age field is never read)', () => {
    const ageless = driversToTune({ massGravity: D_EARTH.massGravity, volatileFraction: 0.3, tidalHeating: D_EARTH.tidalHeating });
    const aged = driversToTune({ massGravity: D_EARTH.massGravity, volatileFraction: 0.3, tidalHeating: D_EARTH.tidalHeating, age: 7.0 });
    expect(ageless).toEqual(aged);
  });
  it('CONTINENTAL_FRACTION is now purely volatile-driven (no age term)', () => {
    const tune = driversToTune({ ...D_EARTH, volatileFraction: 0.3 });
    expect(tune.CONTINENTAL_FRACTION).toBeCloseTo(0.5 + 1.0 * (D_EARTH.volatileFraction - 0.3), 12);
  });
});
