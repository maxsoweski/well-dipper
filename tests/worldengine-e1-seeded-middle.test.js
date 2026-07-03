// tests/worldengine-e1-seeded-middle.test.js — World Engine V2-1 AC5 (Slice B).
//
// The seeded-multistable temperate-wet Earth-mass middle (BUILD-PLAN §4.5 / §2.4 #3):
//   • bodies in the band draw geodynamicRegime from alea('e1:regime:'+macroSeed) with FROZEN base weights
//     nudged by V (↑ → mobile) and T_surf (↑ → stagnant);
//   • a seeded-'stagnant' pick sets effectiveL inside the strong-mixed band [0.60,0.66], wetter → lower edge;
//   • identical seeds → identical picks; the pick VARIES across seeds within the band;
//   • the lab-only weight override (opts.weights, mirrors _driverAbMode) changes the distribution while the
//     FROZEN default is restored simply by omitting it.
import { describe, it, expect } from 'vitest';
import { computeE1, E1_REGIME_WEIGHTS, regimeWeights } from '../src/worldengine/base/e1Regime.js';

// An Earth-mass temperate-wet in-band vector (mass = g·R² = 1.0; T 285 = band center; V 0.25 = nudge center).
// density 5.5 ⇒ rocky; no h2-he ⇒ not gas; no C/O ⇒ not carbon. Squarely in [0.6,1.6]×[250,320]×V≥0.12.
const bandVec = ({ T = 285, V = 0.25 } = {}) => ({
  T_eq: T, composition: { volatileFraction: V, density: 5.5 }, density: 5.5,
  surfaceGravity: 1.0, radiusEarth: 1.0, age: 4.5, rawTidalIoRatio: 0, atmosphere: { composition: 'n2-o2' },
});

const NSEEDS = 400;
function sweep(vec, { weights } = {}) {
  const counts = { mobile: 0, episodic: 0, stagnant: 0 };
  const effLs = [];
  for (let s = 0; s < NSEEDS; s++) {
    const e = computeE1(vec, s, weights ? { weights } : undefined);
    counts[e.geodynamicRegime] = (counts[e.geodynamicRegime] || 0) + 1;
    if (e.geodynamicRegime === 'stagnant') effLs.push(e.effectiveL);
  }
  return { counts, effLs, frac: (k) => counts[k] / NSEEDS };
}

describe('V2-1 AC5 — distribution matches the frozen nudged weights', () => {
  it('at V=0.25,T=285 the pick fractions ≈ base weights {mobile .45, episodic .25, stagnant .30} (±0.08)', () => {
    const { frac, counts } = sweep(bandVec());
    // sanity: every draw resolved to one of the three seeded picks (no edge leak inside the band)
    expect(counts.mobile + counts.episodic + counts.stagnant).toBe(NSEEDS);
    expect(frac('mobile')).toBeCloseTo(0.45, 1);      // toBeCloseTo(x,1) ⇒ |Δ| < 0.05
    expect(frac('stagnant')).toBeCloseTo(0.30, 1);
    expect(frac('episodic')).toBeCloseTo(0.25, 1);
  });

  it('the pick actually VARIES within the band (all three regimes appear across the seed sweep)', () => {
    const { counts } = sweep(bandVec());
    expect(counts.mobile).toBeGreaterThan(0);
    expect(counts.episodic).toBeGreaterThan(0);
    expect(counts.stagnant).toBeGreaterThan(0);
  });
});

describe('V2-1 AC5 — determinism', () => {
  it('identical (vector, macroSeed) → identical pick + positionWithinRegime', () => {
    const v = bandVec();
    for (const s of [0, 1, 5, 99, 250, 399]) {
      const a = computeE1(v, s), b = computeE1(v, s);
      expect(a.geodynamicRegime).toBe(b.geodynamicRegime);
      expect(a.positionWithinRegime).toBe(b.positionWithinRegime);
      expect(a.effectiveL).toBe(b.effectiveL);
    }
  });
});

describe('V2-1 AC5 — directional nudges (V↑ → mobile ; T↑ → stagnant)', () => {
  it('wetter → MORE mobile picks (V 0.40 vs V 0.15)', () => {
    expect(sweep(bandVec({ V: 0.40 })).frac('mobile')).toBeGreaterThan(sweep(bandVec({ V: 0.15 })).frac('mobile'));
  });

  it('hotter → MORE stagnant picks (T 315 vs T 260)', () => {
    expect(sweep(bandVec({ T: 315 })).frac('stagnant')).toBeGreaterThan(sweep(bandVec({ T: 260 })).frac('stagnant'));
  });

  it('the nudge is present in the weight function itself (unit check around the centers)', () => {
    expect(regimeWeights(0.40, 285).mobile).toBeGreaterThan(regimeWeights(0.10, 285).mobile);
    expect(regimeWeights(0.25, 315).stagnant).toBeGreaterThan(regimeWeights(0.25, 260).stagnant);
  });
});

describe('V2-1 AC5 — effectiveL on every seeded-stagnant pick', () => {
  it('every stagnant pick carries effectiveL in the strong-mixed band [0.60,0.66]', () => {
    const { effLs } = sweep(bandVec());
    expect(effLs.length).toBeGreaterThan(0);
    for (const L of effLs) {
      expect(L).toBeGreaterThanOrEqual(0.60);
      expect(L).toBeLessThanOrEqual(0.66);
    }
  });

  it('non-stagnant picks carry NO effectiveL (conditional tuple member)', () => {
    const v = bandVec();
    for (let s = 0; s < NSEEDS; s++) {
      const e = computeE1(v, s);
      if (e.geodynamicRegime !== 'stagnant') expect(e.effectiveL).toBeUndefined();
    }
  });

  it('wetter nudges effectiveL toward the piercable lower edge (0.60): mean(V0.40) < mean(V0.15)', () => {
    const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
    const wet = sweep(bandVec({ V: 0.40 })).effLs, dry = sweep(bandVec({ V: 0.15 })).effLs;
    expect(wet.length).toBeGreaterThan(0);
    expect(dry.length).toBeGreaterThan(0);
    expect(mean(wet)).toBeLessThan(mean(dry));
  });
});

describe('V2-1 AC5 — lab-only weight override (mirrors _driverAbMode)', () => {
  it('opts.weights overrides the base → different distribution; omitting it restores the FROZEN default', () => {
    const v = bandVec();
    const overridden = sweep(v, { weights: { mobile: 0.10, episodic: 0.10, stagnant: 0.80 } });
    const def = sweep(v);
    expect(overridden.frac('stagnant')).toBeGreaterThan(def.frac('stagnant') + 0.3); // clearly stagnant-heavy
    expect(def.frac('mobile')).toBeGreaterThan(def.frac('stagnant'));                 // default is mobile-leaning
    // the frozen default object is untouched by exercising the override
    expect(E1_REGIME_WEIGHTS).toEqual({ mobile: 0.45, episodic: 0.25, stagnant: 0.30 });
    expect(Object.isFrozen(E1_REGIME_WEIGHTS)).toBe(true);
  });
});
