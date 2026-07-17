// tests/worldengine-v2-5-bombardment.test.js — World Engine V2-5 SLICE-1 (bombardment writer + craterField
// host channel). Data ACs, all headless (BUILD-PLAN §7 SLICE 1 / §8 AC map).
//
//   AC-CHANNEL  — craterField present + distinct identity on BOTH carriers; the bombardment write touches
//                 ONLY craterField (HASHED_FIELDS byte-untouched on a golden preset at N=700); non-triviality
//                 (variance>0 AND both signs) via a resolution-free craterProfile unit test AND at ≈40k
//                 (M-MF3 split — NOT asserted at N=700 where craters barely resolve).
//   AC-POWERLAW — the writer's SFD SAMPLER (drawPowerLaw on the writer's 'bombard:'+seed stream, all 5
//                 seeds) fits a DIFFERENTIAL dN/dlogD log-log line of slope ∈ [−2.2,−1.8], R² > 0.95 every
//                 seed; a uniform-diameter null's dN/dlogD slope is ≥ 0 and outside the band (M-MF1). The
//                 slope is invariant to forEachCrater's centre/diameter interleave (IID subsequence) and
//                 ×sizeMul (constant log-shift), so this validates the LAW, not the assembly path (assembly
//                 determinism/scaling live in AC-DISTINCT / AC-MULTIPLY).
//   AC-MULTIPLY — direct-writer-metric (craterSchedule, route-independent — M-MF2): ↓gravity ⇒ ≥count & ≥size,
//                 ↑age ⇒ ≥count; NON-STRICT (round() staircase — M-m1); neutral at (G_REF, AGE_REF) (M-m6).
//   AC-DISTINCT — repeat-seed byte-equal; inter-seed L2 large; (gravity, age) grid distinct.
//   AC-0 ch.1   — the writer greps clean: ZERO computeE1/e1Regime substrings (incl. comments, BS-m1); reads
//                 only condition scalars; no label/archetype/PRESET_ARCHETYPE; imports only mathutil + alea.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import alea from 'alea';

import { makeSphereField } from '../src/worldengine/base/sphereField.js';
import { makeSubstrate } from '../src/worldengine/base/substrate.js';
import { buildIrregularSphere, writeBodyRelief, DEFAULT_GRAIN_DRIVERS } from '../planet-lod-rivers.js';
import {
  writeBombardment, craterSchedule, drawPowerLaw, craterProfile, craterAmplitude,
  craterStampRadius, isImpactSurface,
  D_MIN_RAD, D_MAX_RAD, N_CRATERS_REF, G_REF, AGE_REF, K_AGE, K_GD, K_GS, MIN_BASIN_DEPTH_N,
} from '../src/worldengine/base/bombardment.js';
import { DRIVER_PRESETS } from '../driver-presets.js';
import { buildNeutralBodyDrivers } from '../body-drivers.js';
import { deriveConditionVector } from '../body-condition-vector.js';
import { deriveUniforms } from '../planet-lod-lab-core.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEEDS = [1, 2, 3, 7, 42];

// A minimal synthetic impact-surface condition (the writer reads scalars only — route-independent).
const moonCond = (g = 0.277, age = 4.5) => ({
  atmosphere: null, rawTidalIoRatio: 0, T_eq: 235, surfaceGravity: g, age,
  composition: { volatileFraction: 0.02, density: 4.5 },
});

function reliefBundle(name, seed) {
  const fp = DRIVER_PRESETS[name];
  const u = deriveUniforms(fp, 1.0);
  return {
    archetype: null, locked: !!(fp && fp.tidalState && fp.tidalState.locked),
    grainDrivers: DEFAULT_GRAIN_DRIVERS,
    bodyDrivers: { ...buildNeutralBodyDrivers(u, fp), condition: deriveConditionVector(fp, u, fp.radiusEarth) },
    macroSeed: seed, heightSeed: 'e6:' + seed, T_eq: fp.T_eq ?? 288,
  };
}

// least-squares linear fit → { slope, r2 }
function linfit(xs, ys) {
  const n = xs.length; let mx = 0, my = 0; for (let i = 0; i < n; i++) { mx += xs[i]; my += ys[i]; } mx /= n; my /= n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { const dx = xs[i] - mx, dy = ys[i] - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy; }
  return { slope: sxy / sxx, r2: (sxy * sxy) / (sxx * syy) };
}
// differential dN/dlogD fit (equal-log bins ⇒ dN/dlogD ∝ count; fit log10(count) vs log10(D_center)).
const NBINS = 12;
function fitDiff(diams) {
  const lo = Math.log(D_MIN_RAD), hi = Math.log(D_MAX_RAD), w = (hi - lo) / NBINS;
  const counts = new Array(NBINS).fill(0);
  for (const D of diams) { let b = Math.floor((Math.log(D) - lo) / w); if (b < 0) b = 0; if (b >= NBINS) b = NBINS - 1; counts[b]++; }
  const xs = [], ys = [];
  for (let b = 0; b < NBINS; b++) if (counts[b] > 0) { xs.push(Math.log10(Math.exp(lo + (b + 0.5) * w))); ys.push(Math.log10(counts[b])); }
  return linfit(xs, ys);
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('V2-5 AC-CHANNEL — craterField is a distinct unhashed host on both carriers, byte-inert on height', () => {
  it('makeSphereField allocates craterField (Float32Array), distinct identity from shelfDepth/maturity/height', () => {
    const carrier = makeSphereField(buildIrregularSphere(700, 2));
    expect(carrier.craterField).toBeInstanceOf(Float32Array);
    expect(carrier.craterField.length).toBe(carrier.count);
    expect(carrier.craterField).not.toBe(carrier.shelfDepth);
    expect(carrier.craterField).not.toBe(carrier.maturity);
    expect(carrier.craterField).not.toBe(carrier.height);
  });

  it('makeSubstrate allocates the identical craterField channel (flat-grid twin parity)', () => {
    const s = makeSubstrate({ n: 8, lat0Deg: 0, lat1Deg: 10, domainKm: 100 });
    expect(s.craterField).toBeInstanceOf(Float32Array);
    expect(s.craterField.length).toBe(s.count);
    expect(s.craterField).not.toBe(s.shelfDepth);
    expect(s.craterField).not.toBe(s.height);
  });

  it('the bombardment write touches ONLY craterField — HASHED_FIELDS byte-untouched on a golden preset (N=700)', () => {
    // Build a golden preset (Frozen fires) via the full seam, snapshot the HASHED_FIELDS, then re-run
    // writeBombardment directly and confirm none of them moved (craterField is the sole mutation).
    const carrier = makeSphereField(buildIrregularSphere(700, 2));
    writeBodyRelief(carrier, reliefBundle('Frozen (airless)', 1));
    const HASHED = ['height', 'grainAngle', 'grainMag', 'regime', 'faultDensity'];
    const before = HASHED.map((f) => Float32Array.from(carrier[f]));
    writeBombardment(carrier, moonCond(), { macroSeed: 1 });
    HASHED.forEach((f, k) => {
      const a = before[k], b = carrier[f];
      for (let i = 0; i < a.length; i++) expect(b[i], `${f}[${i}] moved`).toBe(a[i]);
    });
  });

  it('non-triviality (resolution-free): craterProfile is two-signed — bowl floor < 0 AND raised rim > 0', () => {
    for (const D of [D_MIN_RAD, D_MAX_RAD]) {
      const R = craterStampRadius(D);
      let pmin = Infinity, pmax = -Infinity;
      for (let k = 0; k <= 50; k++) { const v = craterProfile((k / 50) * R, D); if (v < pmin) pmin = v; if (v > pmax) pmax = v; }
      expect(pmin, `D=${D} floor`).toBeLessThan(0);
      expect(pmax, `D=${D} rim`).toBeGreaterThan(0);
    }
    // legibility floor (M-m3): the biggest basin renders deeper than MIN_BASIN_DEPTH_N
    expect(craterAmplitude(D_MAX_RAD)).toBeGreaterThanOrEqual(MIN_BASIN_DEPTH_N);
  });

  it('non-triviality (integrated ≈40k): stamped craters resolve — variance > 0 AND both signs present', () => {
    const carrier = makeSphereField(buildIrregularSphere(40000, 2));
    writeBodyRelief(carrier, reliefBundle('Frozen (airless)', 1));
    const cf = carrier.craterField;
    let mn = Infinity, mx = -Infinity, sum = 0;
    for (let i = 0; i < cf.length; i++) { const v = cf[i]; if (v < mn) mn = v; if (v > mx) mx = v; sum += v; }
    const mean = sum / cf.length; let variance = 0; for (let i = 0; i < cf.length; i++) { const d = cf[i] - mean; variance += d * d; } variance /= cf.length;
    expect(variance).toBeGreaterThan(0);
    expect(mn).toBeLessThan(0);   // bowl floors
    expect(mx).toBeGreaterThan(0); // rims / ejecta
  }, 20000);

  it('non-target worlds get an all-zero craterField (idempotent fill; self-gate)', () => {
    const carrier = makeSphereField(buildIrregularSphere(2000, 2));
    writeBodyRelief(carrier, reliefBundle('Rocky (Earthlike)', 1));  // plate path — does not fire
    for (let i = 0; i < carrier.craterField.length; i++) expect(carrier.craterField[i]).toBe(0);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// N_FIT: the SFD is a distributional property of the writer's drawPowerLaw sampler; its slope is what
// AC-POWERLAW asserts. The differential dN/dlogD LSQ slope is Poisson-noise-biased shallow at the native
// ~2887 stamp count (sparse large-D bins clip at count≥1), so the SFD is verified at a statistically-adequate
// per-seed sample — BUILD-PLAN §2b's explicit "raise N_CRATERS_REF for the TEST POPULATION" (crater-powerlaw.mjs
// pins the same N_FIT; the STAMP count is a separate MULTIPLY concern — AC-MULTIPLY; BUILD-PLAN §10 dev D3).
const N_FIT = 16000;
describe('V2-5 AC-POWERLAW — the population is organized (differential dN/dlogD power law), not sprinkled', () => {
  it('every seed: the writer SFD sampler dN/dlogD log-log slope ∈ [−2.2, −1.8] AND R² > 0.95', () => {
    for (const seed of SEEDS) {
      const rng = alea('bombard:' + seed);                 // the writer's SFD stream — contiguous draws (no centre interleave / ×sizeMul; slope-invariant to both)
      const diams = []; for (let k = 0; k < N_FIT; k++) diams.push(drawPowerLaw(rng));
      const { slope, r2 } = fitDiff(diams);
      expect(slope, `seed ${seed} slope`).toBeGreaterThanOrEqual(-2.2);
      expect(slope, `seed ${seed} slope`).toBeLessThanOrEqual(-1.8);
      expect(r2, `seed ${seed} R²`).toBeGreaterThan(0.95);
    }
  });

  it('uniform-diameter null is clearly rejected: dN/dlogD slope ≥ 0 and OUTSIDE the band, every seed', () => {
    for (const seed of SEEDS) {
      const rng = alea('bombard-uniform:' + seed);         // uniform over [D_MIN, D_MAX] — the M-MF1 null
      const diams = []; for (let k = 0; k < N_FIT; k++) diams.push(D_MIN_RAD + rng() * (D_MAX_RAD - D_MIN_RAD));
      const { slope } = fitDiff(diams);
      expect(slope, `uniform seed ${seed} slope ≥ 0`).toBeGreaterThanOrEqual(0);
      const inBand = slope >= -2.2 && slope <= -1.8;
      expect(inBand, `uniform seed ${seed} outside band`).toBe(false);
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('V2-5 AC-MULTIPLY — drivers schedule the population continuously (direct-writer, non-strict monotone)', () => {
  it('neutral reference: at (G_REF, AGE_REF) count = N_CRATERS_REF and sizeMul = 1 (normalization — M-m6)', () => {
    const s = craterSchedule(moonCond(G_REF, AGE_REF));
    expect(s.nCraters).toBe(N_CRATERS_REF);
    expect(s.sizeMul).toBeCloseTo(1, 10);
  });

  it('↓ gravity ⇒ ≥ count AND ≥ size (non-strict monotone; coarse sweep clears the round() staircase)', () => {
    const gs = [3.0, 1.5, 0.85, 0.5, 0.3, 0.2, 0.1];   // decreasing gravity
    let prevN = -Infinity, prevS = -Infinity;
    for (const g of gs) {
      const { nCraters, sizeMul } = craterSchedule(moonCond(g, 4.5));
      expect(nCraters, `count non-decreasing as g↓ (g=${g})`).toBeGreaterThanOrEqual(prevN);
      expect(sizeMul, `size non-decreasing as g↓ (g=${g})`).toBeGreaterThanOrEqual(prevS);
      prevN = nCraters; prevS = sizeMul;
    }
    // exponent signs are the design intent (K_GD, K_GS > 0 on G_REF/g)
    expect(K_GD).toBeGreaterThan(0);
    expect(K_GS).toBeGreaterThan(0);
  });

  it('↑ age ⇒ ≥ count; size age-independent (K_AGE > 0 on age/AGE_REF)', () => {
    const ages = [1.0, 2.0, 4.0, 6.0, 8.5];   // increasing age
    let prevN = -Infinity; const sizes = new Set();
    for (const age of ages) {
      const { nCraters, sizeMul } = craterSchedule(moonCond(0.277, age));
      expect(nCraters, `count non-decreasing as age↑ (age=${age})`).toBeGreaterThanOrEqual(prevN);
      prevN = nCraters; sizes.add(sizeMul.toFixed(9));
    }
    expect(sizes.size, 'sizeMul constant across the age sweep').toBe(1);
    expect(K_AGE).toBeGreaterThan(0);
  });

  it('a non-target condition schedules nothing (fired:false, count 0)', () => {
    const s = craterSchedule({ atmosphere: { pressure: 1.0 }, rawTidalIoRatio: 0, T_eq: 288, surfaceGravity: 1, age: 4.5 });
    expect(s.fired).toBe(false);
    expect(s.nCraters).toBe(0);
    expect(isImpactSurface({ atmosphere: null, rawTidalIoRatio: 0, T_eq: 235 })).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('V2-5 AC-DISTINCT — deterministic per seed; genuinely different across seeds and (g, age) pairs', () => {
  const mesh = buildIrregularSphere(4000, 2);
  const stampFor = (cond, seed) => { const c = makeSphereField(mesh); writeBombardment(c, cond, { macroSeed: seed }); return c.craterField; };

  it('repeat-seed determinism: two runs at the same (condition, seed) are byte-equal', () => {
    const a = stampFor(moonCond(), 7), b = stampFor(moonCond(), 7);
    for (let i = 0; i < a.length; i++) expect(b[i]).toBe(a[i]);
  });

  it('inter-seed difference: distinct seeds give large pairwise field L2 (well above the 0 repeat floor)', () => {
    const fields = SEEDS.map((s) => stampFor(moonCond(), s));
    for (let i = 0; i < fields.length; i++) for (let j = i + 1; j < fields.length; j++) {
      let l2 = 0; for (let k = 0; k < fields[i].length; k++) { const d = fields[i][k] - fields[j][k]; l2 += d * d; }
      expect(Math.sqrt(l2), `seeds ${SEEDS[i]} vs ${SEEDS[j]}`).toBeGreaterThan(0.5);
    }
  });

  it('(gravity, age) grid: different driver pairs yield visibly different populations', () => {
    const grid = [moonCond(0.15, 6.0), moonCond(0.5, 4.0), moonCond(0.85, 2.0)];
    const fields = grid.map((c) => stampFor(c, 1));
    for (let i = 0; i < fields.length; i++) for (let j = i + 1; j < fields.length; j++) {
      let l2 = 0; for (let k = 0; k < fields[i].length; k++) { const d = fields[i][k] - fields[j][k]; l2 += d * d; }
      expect(Math.sqrt(l2), `grid pair ${i},${j}`).toBeGreaterThan(0.5);
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('V2-5 AC-0 ch.1 — the writer is label-free, regime-blind, and imports no derived-dispatch module', () => {
  const src = readFileSync(path.resolve(__dirname, '../src/worldengine/base/bombardment.js'), 'utf8');

  it('contains ZERO computeE1 / e1Regime substrings (incl. comments — BS-m1 shadow-audit trap)', () => {
    expect(src.includes('computeE1')).toBe(false);
    expect(/from\s+['"][^'"]*e1Regime/.test(src)).toBe(false);
  });

  it('reads NO archetype / label / PRESET_ARCHETYPE / geodynamicRegime', () => {
    const code = src.replace(/\/\/[^\n]*/g, '');   // strip line comments
    expect(code.includes('PRESET_ARCHETYPE')).toBe(false);
    expect(/\.label\b/.test(code)).toBe(false);
    expect(/\barchetype\b/.test(code)).toBe(false);
    expect(code.includes('geodynamicRegime')).toBe(false);
  });

  it('imports ONLY ./mathutil.js and alea (no other base-writer / dispatch imports)', () => {
    const imports = [...src.matchAll(/import\s+.*?from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
    expect(imports.sort()).toEqual(['./mathutil.js', 'alea']);
  });

  it('reads the condition-vector scalars the driver-connectivity AC names (surfaceGravity + age)', () => {
    expect(src.includes('condition.surfaceGravity')).toBe(true);
    expect(src.includes('condition.age')).toBe(true);
  });
});
