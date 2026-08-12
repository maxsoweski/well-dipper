// tests/worldengine-v2-5-bombardment.test.js — bombardment writer + craterField host channel.
//
// RESTATED for World Engine V2-6 SLICE-2 (km-space SFD rewrite; BUILD-PLAN §0 FULL churn inventory, §1C). This
// file's V2-5 assertions are DECLARED LEGITIMATE CHURN — every restated assertion below carries the replacing
// physics derivation in a comment (hard-fence rule 9). The churn, by describe block:
//   • imports: K_GD / D_MIN_RAD / D_MAX_RAD / N_CRATERS_REF / K_AGE deleted (angular-band + K_GD-count constants
//     retired); F_REF / B_SFD / G_REF / K_GS / AGE_REF / craterSchedule fields / drawBoundedPareto / chronN added.
//   • moonCond fixture WIDENED with `radiusEarth: 0.38` — the km schedule reads cond.radiusEarth (R_km = 6371·R);
//     without it R_km is NaN. 0.38 is the canonical Moon/Mercury value.
//   • AC-CHANNEL "non-target all-zero" was Rocky (T_eq 288, P 1 bar) — under the continuous exposure physics
//     Rocky is now an impact surface that self-suppresses (t_exp ≈ 0.1 Ga by erosion) ⇒ RESTATED as a
//     deep-envelope non-target (P > P_SURF_MAX, all-zero) + a Rocky "sparse-by-erosion" assert.
//   • AC-POWERLAW fitDiff re-binned over the km band [L_trunc, D_HI] (converted at the fixture's R), not the
//     retired angular [D_MIN_RAD, D_MAX_RAD].
//   • AC-MULTIPLY gate FLIPS: ↓gravity no longer raises COUNT (K_GD removed — primary flux is g-independent,
//     dN/dg=0); it still raises SIZE (K_GS kept). "a non-target schedules nothing" restated with a deep-envelope
//     fixture. Count is now driven by AGE via the Neukum chronology (chronN).
//   • AC-0 import-allowlist "ONLY ./mathutil.js + alea" → the 4-module list ['./baseStep.js','./mathutil.js',
//     './surfaceMaterial.js','alea'] (baseStep = pure radPerKm scalar; surfaceMaterial = condition-pure erosion;
//     neither a dispatch/regime module — shadow-audit untouched).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import alea from 'alea';

import { makeSphereField } from '../src/worldengine/base/sphereField.js';
import { makeSubstrate } from '../src/worldengine/base/substrate.js';
import { buildIrregularSphere, writeBodyRelief, DEFAULT_GRAIN_DRIVERS } from '../planet-lod-rivers.js';
import {
  writeBombardment, craterSchedule, drawBoundedPareto, craterProfile, craterAmplitude,
  craterStampRadius, isImpactSurface, chronN,
  B_SFD, G_REF, K_GS, AGE_REF, F_REF, D_REF_RAD, MESH_FLOOR_RAD, MIN_BASIN_DEPTH_N, P_SURF_MAX,
} from '../src/worldengine/base/bombardment.js';
import { KM_PER_EARTH_RADIUS, radPerKm } from '../src/worldengine/base/baseStep.js';
import { DRIVER_PRESETS } from '../driver-presets.js';
import { buildNeutralBodyDrivers } from '../body-drivers.js';
import { deriveConditionVector } from '../src/worldengine/base/conditionVector.js';
import { deriveUniforms } from '../src/worldengine/base/labCore.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEEDS = [1, 2, 3, 7, 42];

// A minimal synthetic impact-surface condition (the writer reads scalars only). WIDENED with radiusEarth (the
// km schedule reads cond.radiusEarth; 0.38 = the canonical Moon/Mercury value). Default age 4.5 fires ~147 stamps.
const moonCond = (g = 0.277, age = 4.5) => ({
  atmosphere: null, rawTidalIoRatio: 0, T_eq: 235, surfaceGravity: g, age, radiusEarth: 0.38,
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
// differential dN/dlogD fit over a KM band [lo,hi] (equal-log bins ⇒ dN/dlogD ∝ count; fit log10(count) vs log10 D).
const NBINS = 12;
function fitDiff(diams, lo, hi) {
  const l0 = Math.log(lo), l1 = Math.log(hi), w = (l1 - l0) / NBINS;
  const counts = new Array(NBINS).fill(0);
  for (const D of diams) { let b = Math.floor((Math.log(D) - l0) / w); if (b < 0) b = 0; if (b >= NBINS) b = NBINS - 1; counts[b]++; }
  const xs = [], ys = [];
  for (let b = 0; b < NBINS; b++) if (counts[b] > 0) { xs.push(Math.log10(Math.exp(l0 + (b + 0.5) * w))); ys.push(Math.log10(counts[b])); }
  return linfit(xs, ys);
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('V2-6 AC-CHANNEL — craterField is a distinct unhashed host on both carriers, byte-inert on height', () => {
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
    // craters are now ANGULAR δ ∈ [MESH_FLOOR_RAD, ~1 rad basin]; the profile shape is unchanged from V2-5.
    for (const D of [MESH_FLOOR_RAD, 1.0]) {
      const R = craterStampRadius(D);
      let pmin = Infinity, pmax = -Infinity;
      for (let k = 0; k <= 50; k++) { const v = craterProfile((k / 50) * R, D); if (v < pmin) pmin = v; if (v > pmax) pmax = v; }
      expect(pmin, `D=${D} floor`).toBeLessThan(0);
      expect(pmax, `D=${D} rim`).toBeGreaterThan(0);
    }
    // legibility floor (M-m3): a δ=D_REF_RAD basin renders deeper than MIN_BASIN_DEPTH_N.
    expect(craterAmplitude(D_REF_RAD)).toBeGreaterThanOrEqual(MIN_BASIN_DEPTH_N);
  });

  it('non-triviality (integrated ≈40k): stamped craters resolve — variance > 0 AND both signs present', () => {
    const carrier = makeSphereField(buildIrregularSphere(40000, 2));
    writeBodyRelief(carrier, reliefBundle('Frozen (airless)', 1));
    const cf = carrier.craterField;
    let mn = Infinity, mx = -Infinity, sum = 0;
    for (let i = 0; i < cf.length; i++) { const v = cf[i]; if (v < mn) mn = v; if (v > mx) mx = v; sum += v; }
    const mean = sum / cf.length; let variance = 0; for (let i = 0; i < cf.length; i++) { const d = cf[i] - mean; variance += d * d; } variance /= cf.length;
    expect(variance).toBeGreaterThan(0);
    expect(mn).toBeLessThan(0);   // bowl floors (RESET, negative)
    expect(mx).toBeGreaterThan(0); // rims / ejecta (accumulated, positive)
  }, 30000);

  it('deep-envelope non-target ⇒ all-zero craterField; a real gas giant does not fire (P > P_SURF_MAX)', () => {
    // RESTATE (gate FLIP): Rocky is no longer the all-zero exemplar — under continuous exposure it IS an impact
    // surface (see the erosion-sparse assert below). The all-zero case is now a DEEP ENVELOPE: an impactor
    // ablates/airbursts in a >P_SURF_MAX atmosphere with no reachable solid surface. Jovian (P=1000 bar) is the
    // real-pipeline exemplar (this is exactly the preset-composite Jovian null-composite pin).
    const jov = makeSphereField(buildIrregularSphere(2000, 2));
    writeBodyRelief(jov, reliefBundle('Gas giant (Jovian)', 1));
    for (let i = 0; i < jov.craterField.length; i++) expect(jov.craterField[i]).toBe(0);
    expect(isImpactSurface({ atmosphere: { pressure: P_SURF_MAX + 1 }, T_eq: 125, radiusEarth: 11.2 })).toBe(false);
  });

  it('Rocky is an impact surface but erosion-SPARSE: it fires the gate yet stamps far fewer craters than the Moon', () => {
    // RESTATE: the binary airless gate is retired ⇒ Rocky (P 1 bar, T_eq 288) is a cold solid surface with a
    // reachable ground, so it fires — but rain/wind erosion shortens its retained record to t_exp ≈ 0.1 Ga
    // (real Earth crater-retention age), collapsing the Neukum count so essentially NO crater survives above the
    // mesh floor. The physics, not a gate, keeps Rocky un-cratered.
    const fp = DRIVER_PRESETS['Rocky (Earthlike)']; const u = deriveUniforms(fp, 1.0);
    const rockyCond = deriveConditionVector(fp, u, fp.radiusEarth);
    const rocky = craterSchedule(rockyCond);
    const moon = craterSchedule(moonCond());
    expect(rocky.fired, 'Rocky IS an impact surface (cold + reachable solid surface)').toBe(true);
    expect(rocky.tExp, 'Rocky exposure age shortened by erosion (≪ its 4.5 Ga age)').toBeLessThan(1.0);
    expect(rocky.nStamp, 'Rocky stamps ≪ the Moon').toBeLessThan(moon.nStamp / 10);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// N_FIT: the SFD is a distributional property of the writer's bounded-Pareto sampler; its slope is what
// AC-POWERLAW asserts. Verified at a statistically-adequate per-seed sample over the KM stamp band converted at
// the fixture's R (RE-BINNED from the retired angular band). Cumulative N(>D) ∝ D^−B_SFD ⇒ dN/dlogD ∝ D^−B_SFD
// ⇒ a log-log slope of −B_SFD (= −2.0), invariant to the km↔angular unit choice (a constant log-shift).
const N_FIT = 16000;
describe('V2-6 AC-POWERLAW — the population is organized (differential dN/dlogD power law), not sprinkled', () => {
  const sched = craterSchedule(moonCond());
  const LO = sched.L_trunc, HI = sched.D_HI_KM;   // the km stamp band at the Moon fixture's R
  it('every seed: the writer SFD sampler dN/dlogD log-log slope ∈ [−2.2, −1.8] AND R² > 0.95 (km band)', () => {
    for (const seed of SEEDS) {
      const rng = alea('bombard:' + seed);
      const diams = []; for (let k = 0; k < N_FIT; k++) diams.push(drawBoundedPareto(rng(), LO, HI, B_SFD));
      const { slope, r2 } = fitDiff(diams, LO, HI);
      expect(slope, `seed ${seed} slope`).toBeGreaterThanOrEqual(-2.2);
      expect(slope, `seed ${seed} slope`).toBeLessThanOrEqual(-1.8);
      expect(r2, `seed ${seed} R²`).toBeGreaterThan(0.95);
    }
  });

  it('uniform-diameter null is clearly rejected: dN/dlogD slope ≥ 0 and OUTSIDE the band, every seed', () => {
    for (const seed of SEEDS) {
      const rng = alea('bombard-uniform:' + seed);
      const diams = []; for (let k = 0; k < N_FIT; k++) diams.push(LO + rng() * (HI - LO));
      const { slope } = fitDiff(diams, LO, HI);
      expect(slope, `uniform seed ${seed} slope ≥ 0`).toBeGreaterThanOrEqual(0);
      const inBand = slope >= -2.2 && slope <= -1.8;
      expect(inBand, `uniform seed ${seed} outside band`).toBe(false);
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('V2-6 AC-MULTIPLY — drivers schedule the population continuously (direct-writer, non-strict monotone)', () => {
  it('neutral reference: sizeMul = 1 exactly at g = G_REF (the π-group size-law normalization)', () => {
    const s = craterSchedule(moonCond(G_REF, 4.5));
    expect(s.sizeMul).toBeCloseTo(1, 10);
  });

  it('↓ gravity ⇒ ≥ SIZE (K_GS kept); COUNT is g-INDEPENDENT (K_GD removed — dN/dg = 0)', () => {
    // FLIP: primary impact flux does not depend on target surface gravity ⇒ N_analytic is invariant across the
    // g sweep at fixed (R, age). Only the crater SIZE scales with g (π-group law, K_GS).
    const gs = [3.0, 1.5, 0.85, 0.5, 0.3, 0.2, 0.1];   // decreasing gravity
    const nAn0 = craterSchedule(moonCond(gs[0], 4.5)).nAnalytic;
    let prevS = -Infinity;
    for (const g of gs) {
      const { nAnalytic, sizeMul } = craterSchedule(moonCond(g, 4.5));
      expect(sizeMul, `size non-decreasing as g↓ (g=${g})`).toBeGreaterThanOrEqual(prevS);
      expect(nAnalytic, `count g-independent (g=${g})`).toBeCloseTo(nAn0, 6);
      prevS = sizeMul;
    }
    expect(K_GS).toBeGreaterThan(0);
  });

  it('↑ age ⇒ ≥ COUNT via the Neukum chronology (chronN monotone); size age-independent', () => {
    const ages = [1.0, 2.0, 3.0, 4.0, 4.5];   // increasing age (below the AGE_MAX cap)
    let prevN = -Infinity; const sizes = new Set();
    for (const age of ages) {
      const { nAnalytic, sizeMul } = craterSchedule(moonCond(0.277, age));
      expect(nAnalytic, `count non-decreasing as age↑ (age=${age})`).toBeGreaterThanOrEqual(prevN);
      prevN = nAnalytic; sizes.add(sizeMul.toFixed(9));
    }
    expect(sizes.size, 'sizeMul constant across the age sweep').toBe(1);
    // chronN is strictly increasing on the exposed epoch (the count driver).
    expect(chronN(4.5)).toBeGreaterThan(chronN(4.0));
    expect(AGE_REF).toBe(4.0);
  });

  it('a deep-envelope condition schedules nothing (fired:false, counts 0); an airless cold world fires', () => {
    const deep = craterSchedule({ atmosphere: { pressure: 1000 }, rawTidalIoRatio: 0, T_eq: 125, surfaceGravity: 25, age: 4.5, radiusEarth: 11.2 });
    expect(deep.fired).toBe(false);
    expect(deep.nAnalytic).toBe(0);
    expect(deep.nStamp).toBe(0);
    expect(isImpactSurface({ atmosphere: null, rawTidalIoRatio: 0, T_eq: 235, radiusEarth: 0.38 })).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('V2-6 AC-DISTINCT — deterministic per seed; genuinely different across seeds and (g, age) pairs', () => {
  const mesh = buildIrregularSphere(4000, 2);
  const stampFor = (cond, seed) => { const c = makeSphereField(mesh); writeBombardment(c, cond, { macroSeed: seed }); return c.craterField; };

  // INC-3 S2 CHURN (hard-fence rule 9). The crater depth-law correction (bombardment.js, d/D ∝ δ^-0.5 → 0.20
  // simple / complex roll-off) makes every stamped Moon-fixture crater COMPLEX-shallowed — amplitudes drop ~32-41×
  // at this fixture — so the RAW field L2 collapses ~30-50× (inter-seed min 2.68 → 0.075, grid min 1.20 → 0.023).
  // The V2-6 absolute gate `√l2 > 0.5` was sized to the OLD deep amplitudes and now fails on the (unchanged)
  // populations. Replaced by an amplitude-INVARIANT relative distance relL2 = ‖a−b‖ / rms(a,b): identical fields ⇒
  // 0, near-disjoint populations ⇒ ~√2. This tests POPULATION distinctness independent of the depth scale — the
  // exact intent of AC-DISTINCT — and is immune to any future amplitude retune. Observed post-edit: inter-seed min
  // relL2 ≈ 1.35, grid min ≈ 1.26 (both ≫ the 0 same-seed repeat floor); gate set at 0.9 with margin.
  const relL2 = (a, b) => {
    let dd = 0, nn = 0; for (let k = 0; k < a.length; k++) { const d = a[k] - b[k]; dd += d * d; nn += a[k] * a[k] + b[k] * b[k]; }
    return nn > 0 ? Math.sqrt(dd) / Math.sqrt(0.5 * nn) : 0;
  };

  it('repeat-seed determinism: two runs at the same (condition, seed) are byte-equal', () => {
    const a = stampFor(moonCond(), 7), b = stampFor(moonCond(), 7);
    for (let i = 0; i < a.length; i++) expect(b[i]).toBe(a[i]);
  });

  it('inter-seed difference: distinct seeds give large pairwise relative field distance (≫ the 0 repeat floor)', () => {
    const fields = SEEDS.map((s) => stampFor(moonCond(), s));
    for (let i = 0; i < fields.length; i++) for (let j = i + 1; j < fields.length; j++) {
      expect(relL2(fields[i], fields[j]), `seeds ${SEEDS[i]} vs ${SEEDS[j]}`).toBeGreaterThan(0.9);
    }
  });

  it('(gravity, age) grid: different driver pairs yield visibly different populations', () => {
    // ages sampled in the firing window [4.2,4.6]: the Neukum chronology collapses N_stamp to 0 below ~4 Ga
    // (chron is dominated by the exp term near 4.5), so a young-age grid would compare all-zero fields.
    const grid = [moonCond(0.15, 4.6), moonCond(0.5, 4.4), moonCond(0.85, 4.2)];
    const fields = grid.map((c) => stampFor(c, 1));
    for (let i = 0; i < fields.length; i++) for (let j = i + 1; j < fields.length; j++) {
      expect(relL2(fields[i], fields[j]), `grid pair ${i},${j}`).toBeGreaterThan(0.9);
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('V2-6 AC-0 ch.1 — the writer is label-free, regime-blind, and imports no derived-dispatch module', () => {
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

  it('imports ONLY the 4-module allowlist: ./baseStep.js, ./mathutil.js, ./surfaceMaterial.js, alea', () => {
    // RESTATE (Lens L2): baseStep = pure radPerKm scalar (not dispatch); surfaceMaterial = condition-pure erosion
    // (a leaf that imports nothing — no transitive smuggling); neither is a regime/dispatch module ⇒ the
    // shadow-audit's blind-writer scan is untouched.
    const imports = [...src.matchAll(/import\s+.*?from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
    expect(imports.sort()).toEqual(['./baseStep.js', './mathutil.js', './surfaceMaterial.js', 'alea']);
  });

  it('reads the condition-vector scalars the driver-connectivity AC names (surfaceGravity + age + radiusEarth)', () => {
    expect(src.includes('condition.surfaceGravity')).toBe(true);
    expect(src.includes('condition.age')).toBe(true);
    expect(src.includes('condition.radiusEarth')).toBe(true);
  });
});
