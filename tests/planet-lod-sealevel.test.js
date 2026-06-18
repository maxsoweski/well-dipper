// planet-lod-sealevel.test.js — AC3 (rivers-dendritic-drainage): sea level solved from the
// live height histogram (inverse-CDF to a target ocean fraction), replacing the FBM-era
// coverage formula that gave ~13% ocean on the positive-biased real combiner stack.
//
// Oracle: feed the solver representative h-distributions (symmetric + positive-skewed like
// the real stack) and assert the solved threshold yields the REQUESTED ocean fraction within
// tolerance, where the achieved fraction is measured the way the live code measures it:
// count(h < T) / N.
import { describe, it, expect } from 'vitest';
import { solveSeaLevel } from '../planet-lod-sealevel.js';

// achieved fraction, measured exactly as the live router does (count strictly below T)
function achievedFraction(heights, T) {
  let c = 0;
  for (let i = 0; i < heights.length; i++) if (heights[i] < T) c++;
  return c / heights.length;
}

// ── distribution generators (deterministic LCG so the suite is reproducible) ──
function lcg(seed) {
  let s = seed >>> 0;
  return () => { s = (1664525 * s + 1013904223) >>> 0; return s / 4294967296; };
}
function uniform(n, lo, hi, seed = 1) {
  const r = lcg(seed); const a = new Float64Array(n);
  for (let i = 0; i < n; i++) a[i] = lo + (hi - lo) * r();
  return a;
}
function symmetricBell(n, seed = 2) {
  // sum of 6 uniforms → approx-Gaussian, symmetric, centered 0, range ~[-3,3]
  const r = lcg(seed); const a = new Float64Array(n);
  for (let i = 0; i < n; i++) { let s = 0; for (let k = 0; k < 6; k++) s += r() - 0.5; a[i] = s; }
  return a;
}
function positiveSkewed(n, seed = 3) {
  // long RIGHT tail, mass concentrated low — like the real combiner stack biasing positive:
  // most land sits above a low sea, few deep points. range ~[-0.27, 0.70], median ~0.17.
  const r = lcg(seed); const a = new Float64Array(n);
  for (let i = 0; i < n; i++) { const u = r(); a[i] = -0.27 + 0.97 * Math.pow(u, 0.45); }
  return a;
}

describe('solveSeaLevel — inverse-CDF from height histogram', () => {
  const TOL = 0.02; // 2 percentage points

  it('hits the target fraction on a symmetric (uniform) distribution', () => {
    const h = uniform(40000, -1, 1, 11);
    const T = solveSeaLevel(h, 0.35);
    expect(achievedFraction(h, T)).toBeCloseTo(0.35, 1); // within 0.05
    expect(Math.abs(achievedFraction(h, T) - 0.35)).toBeLessThan(TOL);
  });

  it('hits the target fraction on a symmetric bell distribution', () => {
    const h = symmetricBell(40000, 22);
    const T = solveSeaLevel(h, 0.30);
    expect(Math.abs(achievedFraction(h, T) - 0.30)).toBeLessThan(TOL);
  });

  it('hits the target fraction on a positive-skewed distribution (the real-stack case)', () => {
    const h = positiveSkewed(40000, 33);
    for (const target of [0.25, 0.35, 0.45]) {
      const T = solveSeaLevel(h, target);
      expect(Math.abs(achievedFraction(h, T) - target)).toBeLessThan(TOL);
    }
  });

  it('is monotonic: a larger target fraction gives a higher threshold', () => {
    const h = positiveSkewed(40000, 44);
    const t25 = solveSeaLevel(h, 0.25);
    const t35 = solveSeaLevel(h, 0.35);
    const t45 = solveSeaLevel(h, 0.45);
    expect(t35).toBeGreaterThan(t25);
    expect(t45).toBeGreaterThan(t35);
  });

  it('clamps the degenerate ends (target 0 → no ocean, target 1 → all ocean)', () => {
    const h = positiveSkewed(2000, 55);
    expect(achievedFraction(h, solveSeaLevel(h, 0))).toBe(0);   // nothing strictly below
    expect(achievedFraction(h, solveSeaLevel(h, 1))).toBe(1);   // everything below
  });

  it('handles a flat distribution without NaN', () => {
    const h = new Float64Array(1000).fill(0.5);
    const T = solveSeaLevel(h, 0.35);
    expect(Number.isFinite(T)).toBe(true);
  });
});
