// tests/worldengine-v2-6-craters.test.js — World Engine V2-6 SLICE-2 (bombardment km-space SFD rewrite).
// Data ACs, all headless (BUILD-PLAN §1C / §3 AC map).
//
//   AC-GCOUNT     — primary impact FLUX is gravity-INDEPENDENT: a g sweep at fixed (R, age, seed) leaves
//                   N_analytic invariant (dN/dg = 0 — the population count IS the contract's count). K_GD is
//                   grep-ABSENT from src; K_GS === 0.17 kept. The STAMPED count may shift with g solely through
//                   sizeMul's band shift vs the fixed mesh floor — that is the K_GS SIZE law, not a count law.
//   AC-RADIUS-LAW — km-space size wiring: N_analytic ∝ R² asserted STRICTLY on the pre-round analytic value
//                   (no cap, no round ties); median ANGULAR crater size ∝ 1/R (falls as R grows); closed-form
//                   drawn coverage stays inside the step-0-pinned band across the R sweep (log-drift only).
//   AC-EQUILIB    — obliteration equilibrium: a seed-batch-averaged age sweep shows retained crater count
//                   non-decreasing with a plateau, and the retention FRACTION non-increasing (the N_ret =
//                   N_eq·(1−exp(−N_prod/N_eq)) signature — production rises, a shrinking fraction survives);
//                   clean floors (zero younger overlap) are float-EXACT pre-clamp; all floors are
//                   order-thresholdable post-clamp (the tanh safety clamp is monotone).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { makeSphereField } from '../src/worldengine/base/sphereField.js';
import { buildIrregularSphere } from '../planet-lod-rivers.js';
import {
  writeBombardment, craterSchedule, craterAmplitude, drawBoundedPareto,
  K_GS, B_SFD, CRATER_SAT_N,
} from '../src/worldengine/base/bombardment.js';
import { radPerKm } from '../src/worldengine/base/baseStep.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// A synthetic airless impact-surface condition, parameterized by (g, R, age).
const cond = ({ g = 0.277, R = 0.38, age = 4.5 } = {}) => ({
  atmosphere: null, rawTidalIoRatio: 0, T_eq: 235, surfaceGravity: g, age, radiusEarth: R,
  composition: { volatileFraction: 0.02, density: 4.5 },
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('V2-6 AC-GCOUNT — impact flux is gravity-independent (K_GD removed); K_GS size law kept', () => {
  it('g sweep at fixed (R, age): N_analytic is invariant (dN/dg = 0)', () => {
    const gs = [0.05, 0.15, 0.277, 0.5, 1.0, 2.5];
    const base = craterSchedule(cond({ g: gs[0] })).nAnalytic;
    for (const g of gs) {
      const s = craterSchedule(cond({ g }));
      expect(s.nAnalytic, `N_analytic invariant at g=${g}`).toBeCloseTo(base, 6);
    }
    expect(base).toBeGreaterThan(0);
  });

  it('the STAMPED count shifts with g ONLY through sizeMul (the K_GS size law), never a count law', () => {
    // lower g ⇒ larger craters (sizeMul↑) ⇒ a larger fraction clears the fixed mesh floor ⇒ more STAMPS, even
    // though N_analytic is identical. This is the size law acting on a g-independent population.
    const lo = craterSchedule(cond({ g: 0.1 })), hi = craterSchedule(cond({ g: 2.5 }));
    expect(lo.nAnalytic).toBeCloseTo(hi.nAnalytic, 6);   // same count
    expect(lo.sizeMul).toBeGreaterThan(hi.sizeMul);        // bigger craters at low g
    expect(lo.nStamp).toBeGreaterThan(hi.nStamp);          // ⇒ more clear the floor
  });

  it('K_GD is grep-ABSENT from bombardment.js; K_GS === 0.17 is kept exactly', () => {
    const src = readFileSync(path.resolve(__dirname, '../src/worldengine/base/bombardment.js'), 'utf8');
    expect(src.includes('K_GD')).toBe(false);
    expect(K_GS).toBe(0.17);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('V2-6 AC-RADIUS-LAW — count ∝ R² (analytic, strict), size ∝ 1/R, coverage in the pinned band', () => {
  const Rs = [0.2, 0.38, 0.5, 0.8, 1.2, 2.0];
  // coherent gravity across the sweep: g = g_c·(R/R_c) (the S1 gravity-coherence law), R_c = 0.38, g_c = 0.277.
  const R_c = 0.38, g_c = 0.277;
  const schedFor = (R) => craterSchedule(cond({ g: g_c * (R / R_c), R }));

  it('N_analytic ∝ R² STRICTLY (pre-round analytic value; no cap, no round ties)', () => {
    let perR2 = null;
    for (const R of Rs) {
      const s = schedFor(R);
      const q = s.nAnalytic / (R * R);
      if (perR2 !== null) expect(Math.abs(q - perR2) / perR2, `N/R² constant at R=${R}`).toBeLessThan(1e-9);
      perR2 = q;
    }
  });

  it('median ANGULAR crater size falls as R grows (∝ 1/R at fixed km diameter — measured on the DRAWN population)', () => {
    // The 1/R size wiring lives in the ANALYTIC drawn population (BUILD-PLAN §1C honesty note / Lens L27): its
    // low band edge L = D_LO_KM·sizeMul is R-INDEPENDENT (D_LO is a screening anchor, not the R-scaling mesh
    // floor), so the km median is pinned near L ⇒ angular median = km-median·radPerKm(R) ∝ 1/R. (The TRUNCATED
    // STAMPED band [D_FLOOR∝R, D_HI∝R] is angular-scale-invariant by that same theorem — deliberately NOT the
    // population measured here; a global-disk A/B reads scale-invariant BY REAL PHYSICS.)
    const medAng = [];
    for (const R of Rs) {
      const s = schedFor(R);
      const L = s.D_LO_KM * s.sizeMul, H = s.D_HI_KM;
      const medKm = drawBoundedPareto(0.5, L, H, B_SFD);   // closed-form median of the full bounded-Pareto draw
      medAng.push(medKm * radPerKm(R));
    }
    for (let i = 1; i < medAng.length; i++) {
      expect(medAng[i], `median angular size falls: R=${Rs[i]} (${medAng[i].toExponential(3)}) < R=${Rs[i - 1]} (${medAng[i - 1].toExponential(3)})`).toBeLessThan(medAng[i - 1]);
    }
  });

  it('closed-form drawn coverage stays inside the step-0-pinned band [10%,80%] across the R sweep', () => {
    for (const R of Rs) {
      const cov = schedFor(R).coverage;
      expect(cov, `coverage in band at R=${R}`).toBeGreaterThanOrEqual(0.10);
      expect(cov, `coverage in band at R=${R}`).toBeLessThanOrEqual(0.80);
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('V2-6 AC-EQUILIB — obliteration equilibrium is emergent (retention plateaus; floors thresholdable)', () => {
  const mesh = buildIrregularSphere(2500, 2);
  const BATCH = [1, 2, 3, 4];
  const batchMean = (age) => {
    let nStamp = 0, nRet = 0;
    for (const s of BATCH) { const c = makeSphereField(mesh); const r = writeBombardment(c, cond({ age }), { macroSeed: s, collectDiag: true }); nStamp += r.diag.nStamp; nRet += r.diag.nRetained; }
    return { nStamp: nStamp / BATCH.length, nRet: nRet / BATCH.length };
  };

  it('retained count is non-decreasing with age (young surfaces are visibly sparser)', () => {
    const ages = [4.0, 4.2, 4.4, 4.5, 4.6];
    let prev = -Infinity;
    for (const age of ages) {
      const { nRet } = batchMean(age);
      expect(nRet, `retained non-decreasing at age=${age}`).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = nRet;
    }
  }, 60000);

  it('retention FRACTION is non-increasing with age — the obliteration signature (production rises, fewer survive)', () => {
    const young = batchMean(4.3), old = batchMean(4.6);
    const fYoung = young.nRet / Math.max(1, young.nStamp);
    const fOld = old.nRet / Math.max(1, old.nStamp);
    expect(old.nStamp, 'older schedules MORE production').toBeGreaterThan(young.nStamp);
    expect(fOld, 'a smaller fraction survives at old age (equilibrium plateau)').toBeLessThan(fYoung);
    // plateau: retained grows far slower than production (N_ret sub-linear in N_prod).
    const dRet = old.nRet - young.nRet, dStamp = old.nStamp - young.nStamp;
    expect(dRet, 'retained grows sub-linearly vs production').toBeLessThan(dStamp);
  }, 60000);

  it('clean floors (zero younger overlap) are float-EXACT pre-clamp; all floors are order-thresholdable post-clamp', () => {
    const c = makeSphereField(buildIrregularSphere(4000, 2));
    const r = writeBombardment(c, cond({ age: 4.5 }), { macroSeed: 7, collectDiag: true });
    const clean = r.diag.craters.filter((cr) => cr.cleanFloor);
    expect(clean.length, 'some craters retain a clean floor').toBeGreaterThan(0);
    // (1) clean floor value is EXACTLY −A at float32 (craterField is a Float32Array; the reset stores fround).
    // INC-3 S2: the writer stamps the COMPLEX amplitude craterAmplitude(δ, D_km, g); the diag stores that
    // actually-stamped value as cr.A. Compare to −cr.A, NOT a re-derived angular-only A(δ) (which would be the
    // simple-branch amplitude and no longer match the complex-shallowed floor the writer actually wrote).
    for (const cr of clean) {
      expect(cr.floorValuePreClamp, `clean floor δ=${cr.delta.toFixed(3)}`).toBe(Math.fround(-cr.A));
    }
    // (2) order-thresholdable post-clamp: the tanh safety clamp is monotone ⇒ ordering + sign survive it. Sort
    //     clean floors by pre-clamp value; their post-clamp values must be in the SAME order and still negative.
    const rows = clean.map((cr) => {
      const j = cr.floorNodes[0];
      return { pre: r.diag.preClamp[j], post: c.craterField[j] };
    }).sort((a, b) => a.pre - b.pre);
    for (let i = 0; i < rows.length; i++) {
      expect(rows[i].post, 'floor still negative post-clamp').toBeLessThan(0);
      expect(rows[i].post, 'post-clamp = monotone tanh image of pre-clamp').toBeCloseTo(Math.fround(CRATER_SAT_N * Math.tanh(rows[i].pre / CRATER_SAT_N)), 6);
      if (i > 0) expect(rows[i].post, 'ordering preserved post-clamp').toBeGreaterThanOrEqual(rows[i - 1].post - 1e-9);
    }
  }, 30000);
});
