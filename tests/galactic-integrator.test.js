// Galactic Engine S1 — the ONE integrator (CPU reference), AC-2.
// Analytic sphere, near/far segment composition, and distance-independent surface brightness.
import { describe, it, expect } from 'vitest';
import { integrateRay, composeSegments, homogeneousSpherePack } from '../src/galactic/cloudFieldCPU.js';
import { featureHistory } from '../src/galactic/featureHistory.js';
import { renderPack } from '../src/galactic/renderPacks.js';
import { findCloudSubjects } from '../src/galactic/subjects.js';
import { GalacticMap } from '../src/generation/GalacticMap.js';

const relErr = (a, b) => Math.abs(a - b) / Math.max(Math.abs(b), 1e-12);
const within = (got, want, tol) => got.every((g, c) => relErr(g, want[c]) <= tol);

const gm = new GalacticMap('well-dipper-galaxy-1');
const cloud = renderPack(featureHistory(findCloudSubjects(gm).procedural), { overrides: {} });

describe('analytic emitting/absorbing sphere', () => {
  const R = 10;
  const j = [0.02, 0.01, 0.005], k = [0.05, 0.08, 0.12];
  const pack = homogeneousSpherePack({ radiusPc: R, j, k });
  const analytic = (chord) => ({
    L: j.map((jc, c) => (jc / k[c]) * (1 - Math.exp(-k[c] * chord))),
    T: k.map((kc) => Math.exp(-kc * chord)),
  });

  for (const b of [0, 3, 7, 9.5]) {
    it(`impact parameter ${b} pc from outside: L and T within 1%`, () => {
      const r = integrateRay(pack, [b, 0, 50], [0, 0, -1], 64);
      const want = analytic(2 * Math.sqrt(R * R - b * b));
      expect(within(r.L, want.L, 0.01)).toBe(true);
      expect(within(r.T, want.T, 0.01)).toBe(true);
    });
  }

  it('from inside (at the centre) the ray starts at t = 0 with no special case', () => {
    const r = integrateRay(pack, [0, 0, 0], [0, 0, -1], 64);
    const want = analytic(R);
    expect(within(r.L, want.L, 0.01)).toBe(true);
    expect(within(r.T, want.T, 0.01)).toBe(true);
  });

  it('BROKEN CONTROL: a Riemann sum without per-step attenuation misses the analytic answer', () => {
    // L += j*dt with no T or exp — what a naive "add up the glow" march does. Must FAIL the 1% check.
    const chord = 2 * R;
    const naive = j.map((jc) => jc * chord);
    expect(within(naive, analytic(chord).L, 0.01)).toBe(false);
  });
});

describe('segment composition: L = Lnear + Tnear*Lfar, T = Tnear*Tfar', () => {
  const ro = [3, -2, 120], rd = [0, 0, -1];
  const full = integrateRay(cloud, ro, rd, 512);
  const tm = (full.t0 + full.t1) / 2;
  const near = integrateRay(cloud, ro, rd, 256, 0, tm);
  const far = integrateRay(cloud, ro, rd, 256, tm, Infinity);

  it('composed near+far equals one full march within 1%', () => {
    const c = composeSegments(near, far);
    expect(within(c.L, full.L, 0.01)).toBe(true);
    expect(within(c.T, full.T, 0.01)).toBe(true);
  });

  it('BROKEN CONTROL: adding segments without Tnear fails', () => {
    const wrong = near.L.map((l, c) => l + far.L[c]);
    expect(within(wrong, full.L, 0.01)).toBe(false);
  });
});

describe('surface brightness does not depend on distance', () => {
  // Average over one pixel's angular footprint (a small cone of rays) aimed at the centre.
  function pixelMean(pack, d, halfAngle, n = 5) {
    const acc = [0, 0, 0];
    for (let iy = 0; iy < n; iy++) for (let ix = 0; ix < n; ix++) {
      const ax = ((ix + 0.5) / n * 2 - 1) * halfAngle, ay = ((iy + 0.5) / n * 2 - 1) * halfAngle;
      const rd = [Math.sin(ax), Math.sin(ay), -1];
      const len = Math.hypot(...rd);
      const { L } = integrateRay(pack, [0, 0, d], rd.map((v) => v / len), 96);
      for (let c = 0; c < 3; c++) acc[c] += L[c] / (n * n);
    }
    return acc;
  }
  const PIXEL = (0.19 * Math.PI) / 180 / 2; // half of one game pixel (~0.19°)

  it('uniform cloud: central pixel at d and d/2 equal within 5%', () => {
    const pack = homogeneousSpherePack({ radiusPc: 10 });
    const a = pixelMean(pack, 400, PIXEL), b = pixelMean(pack, 200, PIXEL);
    expect(within(b, a, 0.05)).toBe(true);
  });

  it('structured cloud: the exact central ray is identical at any outside distance', () => {
    const a = integrateRay(cloud, [0, 0, 2000], [0, 0, -1], 96).L;
    const b = integrateRay(cloud, [0, 0, 1000], [0, 0, -1], 96).L;
    expect(within(b, a, 1e-6)).toBe(true);
  });

  it('BROKEN CONTROL: an inverse-square "brightness" fails the 5% check', () => {
    const pack = homogeneousSpherePack({ radiusPc: 10 });
    const a = pixelMean(pack, 400, PIXEL).map((v) => v / 400 ** 2);
    const b = pixelMean(pack, 200, PIXEL).map((v) => v / 200 ** 2);
    expect(within(b, a, 0.05)).toBe(false);
  });
});
