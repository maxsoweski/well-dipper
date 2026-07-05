// tests/worldengine-mixed-pierce.test.js — World Engine V2-2b-2a Slice A.
//
// AC-PIERCE — the per-center pierce boolean, the anti-mush lynchpin (gate-2 / §2.4 / delegable #2):
//   For each seeded center p, PIERCE iff  strength_p·Φ > Ybase(L)·(1 + SPREAD·(2·y_p − 1)),  Ybase = Y0·exp(Y_K·L).
//   The boolean is SHARP (a center is a shield OR it is not — no partial-pierce blend). This suite:
//     • recomputes the boolean ARM'S-LENGTH from the published strength / yield diag arrays (independent
//       gate-2 constants) and asserts it matches diag.pierce bit-for-bit → every center resolves to exactly
//       PIERCE or TENT;
//     • asserts the gate-2 calibrated COUNTS at pinned vectors — ENSEMBLE over {1,2,3,7,42} (MF5, not a
//       single unvetted seed): the mean pierce count at Tharsis lands in a band around 1.45, every seed in
//       [1,3], + a pinned seed verified in [1,3]; and Venus-strong → 0 (hard single check, P(≥1)=0.000 robust);
//     • asserts the pierce count is monotone correct-sign across a MIXED sweep at FIXED n (raising Φ never
//       DECREASES the count; raising L never INCREASES it) — no inversion.
import { describe, it, expect } from 'vitest';
import { makeSphereField } from '../src/worldengine/base/sphereField.js';
import { buildIrregularSphere } from '../planet-lod-rivers.js';
import { writeMixedInteriorSphere } from '../src/worldengine/base/mixedInterior.js';

const TARGET_N = 1500, LLOYD = 2;
let _mesh = null;
const meshOf = () => (_mesh || (_mesh = buildIrregularSphere(TARGET_N, LLOYD)));
const carrierOf = () => makeSphereField(meshOf());
const SEEDS = [1, 2, 3, 7, 42];

// ARM'S-LENGTH gate-2 constants (independent of the module — the genuine external predictor). gate-2:32-33.
const Y0 = 0.001759, Y_K = 8.78, SPREAD = 0.30;
const YbaseOf = (L) => Y0 * Math.exp(Y_K * L);

const tharsisE1 = { compositionClass: 'rocky', geodynamicRegime: 'dead-lid', m_hp: -0.45, L: 0.551, Φ: 0.27, n: 6 };
const venusStrongE1 = { compositionClass: 'rocky', geodynamicRegime: 'stagnant', m_hp: -0.45, L: 0.728, Φ: 0.69, n: 6 };

const build = (e1, seed) => {
  const c = carrierOf();
  const r = writeMixedInteriorSphere(c, { e1, rawTidal: 0, macroSeed: seed });
  return r;
};
// independent recompute of the pierce boolean from the published diag + the coordinate.
function predictPierce(diag, L, PHI) {
  const { strength, yield: ys } = diag;
  const Yb = YbaseOf(L), out = new Uint8Array(strength.length);
  for (let p = 0; p < strength.length; p++) {
    const localYield = Yb * (1 + SPREAD * (2 * ys[p] - 1));
    out[p] = (strength[p] * PHI > localYield) ? 1 : 0;
  }
  return out;
}
const count = (u) => { let s = 0; for (let i = 0; i < u.length; i++) s += u[i]; return s; };

describe('V2-2b-2a AC-PIERCE — the SHARP per-center pierce boolean (gate-2 localYield form)', () => {
  it('the published diag.pierce matches an ARM\'S-LENGTH recompute bit-for-bit — every center exactly PIERCE or TENT', () => {
    for (const e1 of [tharsisE1, venusStrongE1, { ...tharsisE1, L: 0.60, Φ: 0.42 }]) {
      for (const s of SEEDS) {
        const diag = build(e1, s).mixedDiag;
        const pred = predictPierce(diag, e1.L, e1.Φ);
        for (let p = 0; p < diag.pierce.length; p++) {
          expect(diag.pierce[p] === 0 || diag.pierce[p] === 1, 'pierce is a SHARP boolean (no partial)').toBe(true);
          expect(diag.pierce[p], `L=${e1.L} Φ=${e1.Φ} seed=${s} center ${p}: matches arm's-length predictor`).toBe(pred[p]);
        }
      }
    }
  });

  it('Ybase(L) reproduces the gate-2 pinned checks (0.551 ≈ 0.220, 0.728 ≈ 1.05)', () => {
    expect(YbaseOf(0.551)).toBeCloseTo(0.220, 2);
    expect(YbaseOf(0.728)).toBeCloseTo(1.05, 1);
  });

  it('THARSIS ensemble: mean pierce count over {1,2,3,7,42} lands in a band around 1.45; every seed ∈ [1,3] (MF5)', () => {
    const counts = SEEDS.map((s) => build(tharsisE1, s).mixedDiag.pierceCount);
    const meanCount = counts.reduce((a, v) => a + v, 0) / counts.length;
    // ENSEMBLE assert (gate-2's [1,3] is a 400-seed MEAN piercē 1.45; a single-seed hard-assert is flaky ~1/4).
    expect(meanCount, `mean pierce over seeds = ${meanCount} (band around gate-2's 1.45), counts=[${counts}]`).toBeGreaterThanOrEqual(1.0);
    expect(meanCount, `mean pierce over seeds = ${meanCount} (band around gate-2's 1.45), counts=[${counts}]`).toBeLessThanOrEqual(3.0);
    // the empirical P(1-3) over the set (here 1.0) — every seed lands in gate-2's [1,3] band.
    for (let i = 0; i < SEEDS.length; i++) {
      expect(counts[i], `seed ${SEEDS[i]}: pierce ${counts[i]} ∈ [1,3]`).toBeGreaterThanOrEqual(1);
      expect(counts[i], `seed ${SEEDS[i]}: pierce ${counts[i]} ∈ [1,3]`).toBeLessThanOrEqual(3);
    }
  });

  it('a PINNED, pre-verified seed (1) lands in [1,3] at Tharsis', () => {
    const c = build(tharsisE1, 1).mixedDiag.pierceCount;
    expect(c, `pinned seed 1 pierce ${c} ∈ [1,3]`).toBeGreaterThanOrEqual(1);
    expect(c).toBeLessThanOrEqual(3);
  });

  it('VENUS-STRONG (L 0.728, Φ 0.69) → 0 pierce, every seed (hard single check; P(≥1)=0.000 is robust)', () => {
    for (const s of SEEDS) {
      const pc = build(venusStrongE1, s).mixedDiag.pierceCount;
      expect(pc, `Venus-strong seed ${s}: 0 pierce`).toBe(0);
    }
  });

  it('monotone correct-sign: raising Φ never DECREASES the pierce count (fixed L=0.55, n=6), every seed', () => {
    const phiSweep = [0.15, 0.24, 0.30, 0.40, 0.55];
    for (const s of SEEDS) {
      const counts = phiSweep.map((PHI) => build({ compositionClass: 'rocky', m_hp: -0.45, L: 0.55, Φ: PHI, n: 6 }, s).mixedDiag.pierceCount);
      for (let i = 1; i < counts.length; i++) {
        expect(counts[i], `seed ${s}: Φ↑ non-decreasing at step ${i} (counts=[${counts}])`).toBeGreaterThanOrEqual(counts[i - 1]);
      }
    }
  });

  it('monotone correct-sign: raising L never INCREASES the pierce count (fixed Φ=0.35, n=6), every seed', () => {
    const lSweep = [0.40, 0.45, 0.50, 0.55, 0.62];
    for (const s of SEEDS) {
      const counts = lSweep.map((L) => build({ compositionClass: 'rocky', m_hp: -0.45, L, Φ: 0.35, n: 6 }, s).mixedDiag.pierceCount);
      for (let i = 1; i < counts.length; i++) {
        expect(counts[i], `seed ${s}: L↑ non-increasing at step ${i} (counts=[${counts}])`).toBeLessThanOrEqual(counts[i - 1]);
      }
    }
  });
});
