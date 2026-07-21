// tests/worldengine-inc3-depth-law.test.js — World Engine INCREMENT 3 SLICE-2 (crater depth-law correction).
// Data ACs, all headless (contract AC-DEPTHLAW + AC-FENCE; BUILD-PLAN §2/§3-S2/§5; MATH-CHECK cause #2).
//
//   AC-DEPTHLAW — the V2-5 law d/D = A/δ ∝ δ^-0.5 (0.36 at the reference crater, ~1.09 hemispherical at the mesh
//                 floor, INVERTED) is replaced by Pike-1977 physics: d/D = 0.20 CONSTANT in the simple-crater band,
//                 a COMPLEX roll-off above the gravity-set transition D_t(g) = K_DT/g, monotonically non-increasing
//                 with D, and no crater exceeds d/D 0.25. Degradation (ice relaxation) only ever shallows.
//   AC-FENCE (structural half) — the DRAW path (craterSchedule / forEachCrater) contains no craterAmplitude
//                 reference, so retuning the amplitude law cannot move the population; the empirical half is the
//                 committed pre/post population-invariance baseline (calibration/fence-population-invariance.mjs),
//                 gated here via runVerify().
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import {
  craterAmplitude, craterProfile, relaxedCraterProfile, transitionDiameterKm,
  CRATER_DEPTH_N, DEPTH_POW, D_D_SIMPLE, K_DT, P_COMPLEX, D_REF_RAD, MIN_BASIN_DEPTH_N,
} from '../src/worldengine/base/bombardment.js';
import { radPerKm } from '../src/worldengine/base/baseStep.js';
import { runVerify } from '../docs/WORKSTREAMS/world-engine-inc3-relief-spine-depthlaw-2026-07-21/calibration/fence-population-invariance.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dd = (delta, D_km, g) => craterAmplitude(delta, D_km, g) / delta;   // depth/diameter (d/D), dimensionless

// The three gravity anchors the transition law was least-squares fit against (Pike 1980).
const ANCHORS = [{ n: 'Earth', g: 1.0 }, { n: 'Mercury', g: 0.377 }, { n: 'Moon', g: 0.165 }];

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('INC-3 AC-DEPTHLAW — the depth/diameter constants match the pinned calibration', () => {
  it('constants are the crater-depth-law.mjs step-0 solution (0.10 / 1.0 / 0.20 / 3.1 / 0.66)', () => {
    expect(CRATER_DEPTH_N).toBe(0.10);
    expect(DEPTH_POW).toBe(1.0);
    expect(D_D_SIMPLE).toBe(0.20);
    expect(K_DT).toBe(3.1);
    expect(P_COMPLEX).toBe(0.66);
    // the simple-regime invariant A(D_REF)=CRATER_DEPTH_N is preserved AND legible (≥ the basin floor).
    expect(craterAmplitude(D_REF_RAD)).toBeCloseTo(CRATER_DEPTH_N, 12);
    expect(craterAmplitude(D_REF_RAD)).toBeGreaterThanOrEqual(MIN_BASIN_DEPTH_N);
  });

  it('reproduces the calibration complex anchors (SPA d/D≈0.008, Copernicus residual ≈0.070 flagged)', () => {
    const gMoon = 0.165;
    // SPA (D=2500 km) is the fit anchor → d/D ≈ 0.008; Copernicus (D=93 km) reads ~0.070 (single-anchor residual,
    // flagged in BUILD-PLAN §2.2 / risk 3 — shape + extremes correct, mid-complex tightening deferred).
    expect(dd(0.2, 2500, gMoon)).toBeCloseTo(0.0079, 4);
    expect(dd(0.2, 93, gMoon)).toBeGreaterThan(0.06);
    expect(dd(0.2, 93, gMoon)).toBeLessThan(0.08);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('INC-3 AC-DEPTHLAW — d/D = 0.20 CONSTANT across the simple-crater band', () => {
  it('angular-only calls (D_km/g omitted) ⇒ d/D === 0.20 exactly, flat across δ (within ±0.02)', () => {
    for (const delta of [0.02, 0.055, 0.10, 0.20, 0.35, 0.50]) {
      expect(Math.abs(dd(delta) - 0.20), `d/D flat at δ=${delta}`).toBeLessThanOrEqual(0.02);
      expect(dd(delta)).toBeCloseTo(0.20, 12);   // in fact exact (A = D_D_SIMPLE·δ)
    }
  });

  it('below the transition (D_km ≤ D_t) ⇒ still d/D = 0.20 — a tiny low-g body keeps simple bowls (Mimas/Vesta read)', () => {
    const gTiny = 0.0065, DtTiny = transitionDiameterKm(gTiny);   // ~477 km
    expect(DtTiny).toBeGreaterThan(400);
    for (const D_km of [1, 50, 200, 470]) {   // all < D_t ⇒ simple
      expect(D_km).toBeLessThan(DtTiny);
      expect(dd(0.20, D_km, gTiny), `simple at D_km=${D_km}`).toBeCloseTo(0.20, 12);
    }
    // exactly at D_t the strict `D_km > D_t` gate is false ⇒ still simple.
    expect(dd(0.20, DtTiny, gTiny)).toBeCloseTo(0.20, 12);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('INC-3 AC-DEPTHLAW — complex roll-off above D_t(g) at the three gravity anchors', () => {
  it('D_t(g) = K_DT/g at Earth/Mercury/Moon (3.1 / 8.2 / 18.8 km)', () => {
    expect(transitionDiameterKm(1.0)).toBeCloseTo(3.1, 10);
    expect(transitionDiameterKm(0.377)).toBeCloseTo(3.1 / 0.377, 6);
    expect(transitionDiameterKm(0.165)).toBeCloseTo(3.1 / 0.165, 6);
  });

  it('above D_t the bowl shallows (d/D < 0.20) and keeps falling with D — at each anchor', () => {
    for (const a of ANCHORS) {
      const Dt = transitionDiameterKm(a.g);
      expect(dd(0.20, Dt * 0.5, a.g), `${a.n} below D_t`).toBeCloseTo(0.20, 12);   // simple below
      const d2 = dd(0.20, Dt * 2, a.g), d5 = dd(0.20, Dt * 5, a.g), d20 = dd(0.20, Dt * 20, a.g);
      expect(d2, `${a.n} shallows above D_t`).toBeLessThan(0.20);
      expect(d5, `${a.n} roll-off monotone`).toBeLessThan(d2);
      expect(d20, `${a.n} roll-off monotone`).toBeLessThan(d5);
      // the roll-off is the fit exponent: d/D(k·D_t) = 0.20·k^-P_COMPLEX.
      expect(d2).toBeCloseTo(0.20 * Math.pow(2, -P_COMPLEX), 12);
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('INC-3 AC-DEPTHLAW — monotone non-increasing, bounded ≤ 0.25, inversion gone, relaxation only shallows', () => {
  it('across the RENDERED Moon range (δ ≥ mesh floor) d/D is monotone non-increasing and ≤ 0.25 (vs the OLD ~1.09)', () => {
    // mirror calibration/crater-depth-law.mjs: Moon R=0.273, g=0.165; all rendered craters sit above D_t ⇒ complex.
    const R = 0.273, g = 0.165, rpk = radPerKm(R);
    let prev = Infinity, maxDD = 0;
    for (const delta of [0.055, 0.10, 0.20, 0.35, 0.552]) {
      const D_km = delta / rpk;
      const d = dd(delta, D_km, g);
      expect(d, `monotone non-increasing at δ=${delta}`).toBeLessThanOrEqual(prev + 1e-9);
      prev = d; maxDD = Math.max(maxDD, d);
    }
    expect(maxDD, 'max rendered d/D ≤ 0.25 (was ~1.09 hemispherical under the OLD law)').toBeLessThanOrEqual(0.25);
  });

  it('property: sweeping D_km at fixed g, d/D is non-increasing and never exceeds 0.25 (no inversion anywhere)', () => {
    for (const a of ANCHORS) {
      let prev = Infinity;
      for (let D_km = 0.5; D_km <= 5000; D_km *= 1.5) {
        const d = dd(0.20, D_km, a.g);
        expect(d, `${a.n} d/D ≤ 0.25 at D_km=${D_km.toFixed(1)}`).toBeLessThanOrEqual(0.25 + 1e-12);
        expect(d, `${a.n} non-increasing at D_km=${D_km.toFixed(1)}`).toBeLessThanOrEqual(prev + 1e-12);
        prev = d;
      }
    }
  });

  it('degradation only ever shallows: an ice-relaxed floor is less deep than the fresh bowl (ε>0)', () => {
    // relaxedCraterProfile floor at ε>0 domes UP toward +A·DOME_FRAC ⇒ strictly less negative than the fresh −A.
    for (const [delta, D_km, g] of [[0.20, 200, 0.165], [0.10, 96, 0.277]]) {
      const fresh = craterProfile(0, delta, D_km, g);            // fresh floor (negative)
      const relaxed = relaxedCraterProfile(0, delta, 0.5, 0.1, D_km, g);   // partially relaxed floor
      expect(fresh, 'fresh floor is a bowl (negative)').toBeLessThan(0);
      expect(relaxed, 'relaxation shallows (floor rises toward the dome)').toBeGreaterThan(fresh);
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('INC-3 AC-FENCE — the depth edit cannot move the drawn population', () => {
  const src = readFileSync(path.resolve(__dirname, '../src/worldengine/base/bombardment.js'), 'utf8');
  const bodyOf = (name) => {
    const start = src.indexOf('export function ' + name + '(');
    const open = src.indexOf('{', start);
    let depth = 0, i = open;
    for (; i < src.length; i++) { if (src[i] === '{') depth++; else if (src[i] === '}') { depth--; if (depth === 0) break; } }
    return src.slice(start, i + 1);
  };

  it('structural: craterSchedule and forEachCrater bodies contain NO craterAmplitude reference (draw is amplitude-free)', () => {
    expect(bodyOf('craterSchedule').includes('craterAmplitude')).toBe(false);
    expect(bodyOf('forEachCrater').includes('craterAmplitude')).toBe(false);
  });

  it('empirical: population invariant vs the pre-edit baseline; only craterField amplitudes changed', () => {
    const { pass, checks } = runVerify();
    for (const c of checks) expect(c.ok, c.name).toBe(true);
    expect(pass).toBe(true);
  });
});
