// tests/worldengine-lid-disruption.test.js — World Engine V2-7d (SP-LID-DISRUPTION family).
//
// The lidDisruption.js FAMILY's unit ACs. Validation = STRUCTURE reproduction of each seed pattern on
// synthetic inputs with ENUMERATED statistics (gate-3 discipline) — explicitly NOT byte-match of any
// shipped world (new 'disrupt:' stream ⇒ different bytes by design). Every band is pinned from the §0
// calibration and re-demonstrated non-vacuous by running a perturbed control THROUGH THE MODULE.
//
// Harness mirrors the stagnant-structure sibling: meshes built ONCE (deterministic buildIrregularSphere),
// carriers re-wrapped per run via makeSphereField. All headless. The module writes NO carrier channel.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import alea from 'alea';
import { makeSphereField } from '../src/worldengine/base/sphereField.js';
import { buildIrregularSphere } from '../planet-lod-rivers.js';
import {
  PROFILE_DEFAULTS, profileActiveCorona, profileInactiveCorona, profileGroovedDiapir, DISRUPT_PROFILES,
  CELL_DEFAULTS, makeCellDisruption, FOCI_DEFAULTS, makeFociDisruption, evalFociDeformation,
} from '../src/worldengine/base/lidDisruption.js';
import { DEFAULTS as STAG_DEFAULTS } from '../src/worldengine/base/stagnantLid.js';
import { MIXED_DEFAULTS } from '../src/worldengine/base/mixedInterior.js';

const TARGET_N = 1500, N_LO = 600, LLOYD = 2;
const SEEDS = [1, 2, 3, 7, 42];
let _m1500 = null, _m600 = null;
const mesh1500 = () => (_m1500 || (_m1500 = buildIrregularSphere(TARGET_N, LLOYD)));
const mesh600 = () => (_m600 || (_m600 = buildIrregularSphere(N_LO, LLOYD)));
const carrier1500 = () => makeSphereField(mesh1500());
const carrier600 = () => makeSphereField(mesh600());

const arr = (a) => Array.from(a);
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
const readSrc = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
const MODULE_REL = '../src/worldengine/base/lidDisruption.js';
const SRC = readSrc(MODULE_REL);
const CODE = stripComments(SRC);
const STAG_SRC = readSrc('../src/worldengine/base/stagnantLid.js');
const MIXED_SRC = readSrc('../src/worldengine/base/mixedInterior.js');

// ── arm's-length helpers (own copies — never the module's) ────────────────────────────────────────────
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const mean = (a) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i]; return a.length ? s / a.length : 0; };
function quantile(sorted, q) {
  if (!sorted.length) return NaN;
  const idx = (sorted.length - 1) * q, lo = Math.floor(idx), hi = Math.ceil(idx);
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}
// TEST-owned synthetic proximity field (8 centers, squared-Gaussian belt 0.35 — the stagnant plume form).
// Drawn in a TEST namespace the module never sees.
function makeSyntheticField(seed) {
  const rng = alea('test:fociField:' + seed);
  const cs = [];
  for (let p = 0; p < 8; p++) {
    const z = 2 * rng() - 1, t = 2 * Math.PI * rng(), r = Math.sqrt(Math.max(0, 1 - z * z));
    cs.push([r * Math.cos(t), r * Math.sin(t), z]);
  }
  return (d) => {
    let best = 0;
    for (const c of cs) { const a = Math.acos(Math.max(-1, Math.min(1, dot3(d, c)))); const g = Math.exp(-(a / 0.35) * (a / 0.35)); if (g > best) best = g; }
    return best;
  };
}

// cell statistics from a published descriptor (arm's-length)
function cellStats(c, out) {
  let wall = 0, sumInt = 0;
  for (let i = 0; i < c.N; i++) { if (out.wallDist[i] === 0) wall++; sumInt += out.interiorness[i]; }
  const counts = new Array(out.cellCount).fill(0);
  for (let i = 0; i < c.N; i++) counts[out.cellId[i]]++;
  return { wallFrac: wall / c.N, meanInt: sumInt / c.N, counts, normSizes: counts.map((n) => n * out.cellCount / c.N) };
}

// ═══ AC-0 — spine conformance (condition-blind, three-free) ════════════════════════════════════════════
describe('lid-disruption — AC-0 spine conformance (condition-blind, three-free)', () => {
  it('imports only alea / simplex-noise / ./mathutil.js (three-free import allowlist)', () => {
    const specifiers = [...CODE.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
    expect(specifiers.length, 'exactly three imports').toBe(3);
    const allowed = new Set(['alea', 'simplex-noise', './mathutil.js']);
    for (const s of specifiers) expect(allowed.has(s), `import '${s}' on the three-free allowlist`).toBe(true);
  });

  it('reads no D-vector / E1 / taxonomy token (condition-blind grep)', () => {
    expect(CODE, 'no bodyDrivers').not.toMatch(/\bbodyDrivers\b/);
    expect(CODE, 'no condition read').not.toMatch(/\bcondition\b/);
    expect(CODE, 'no computeE1').not.toMatch(/computeE1/);
    expect(CODE, 'no e1. read').not.toMatch(/\be1\./);
    expect(CODE, 'no archetype token').not.toMatch(/\barchetype\b/);
    expect(CODE, 'no carrier channel read/write').not.toMatch(/carrier\.(height|grainAngle|faultDensity|regime)/);
  });

  it("DEFAULTS objects are frozen and match the seed writers' values", () => {
    expect(Object.isFrozen(PROFILE_DEFAULTS)).toBe(true);
    expect(Object.isFrozen(CELL_DEFAULTS)).toBe(true);
    expect(Object.isFrozen(FOCI_DEFAULTS)).toBe(true);
    expect(Object.isFrozen(DISRUPT_PROFILES)).toBe(true);
    for (const p of DISRUPT_PROFILES) expect(Object.isFrozen(p)).toBe(true);
    // corona amplitudes value-identical to BOTH shipped seed writers
    for (const k of ['A_DOME', 'A_TRENCH', 'A_RISE', 'A_DEP', 'A_RIM']) {
      expect(PROFILE_DEFAULTS[k], `PROFILE_DEFAULTS.${k} === STAG_DEFAULTS.${k}`).toBe(STAG_DEFAULTS[k]);
      expect(PROFILE_DEFAULTS[k], `PROFILE_DEFAULTS.${k} === MIXED_DEFAULTS.${k}`).toBe(MIXED_DEFAULTS[k]);
    }
    // cell count band value-identical to the shell seed
    expect(CELL_DEFAULTS.CELL_MIN).toBe(9);
    expect(CELL_DEFAULTS.CELL_SPAN).toBe(9);
  });
});

// ═══ AC-DET — determinism + namespace isolation ═══════════════════════════════════════════════════════
describe('lid-disruption — AC-DET determinism + namespace isolation', () => {
  it('same macroSeed ⇒ byte-identical cells outputs (two fresh runs, seeds 1/7/42)', () => {
    for (const s of [1, 7, 42]) {
      const a = makeCellDisruption(carrier1500(), { macroSeed: s });
      const b = makeCellDisruption(carrier1500(), { macroSeed: s });
      const tag = `seed ${s}`;
      expect(a.cellCount, `${tag}: cellCount`).toBe(b.cellCount);
      expect(arr(a.cellId), `${tag}: cellId`).toEqual(arr(b.cellId));
      expect(arr(a.interiorness), `${tag}: interiorness`).toEqual(arr(b.interiorness));
      expect(arr(a.wallDist), `${tag}: wallDist`).toEqual(arr(b.wallDist));
      expect(a.centers, `${tag}: centers`).toEqual(b.centers);
    }
  });

  it('same macroSeed ⇒ byte-identical foci + eval outputs (two fresh runs, seeds 1/7/42)', () => {
    for (const s of [1, 7, 42]) {
      const f = makeSyntheticField(s);
      const a = makeFociDisruption(carrier1500(), { macroSeed: s, acceptWeightAt: f });
      const b = makeFociDisruption(carrier1500(), { macroSeed: s, acceptWeightAt: f });
      const tag = `seed ${s}`;
      expect(a.count, `${tag}: count`).toBe(b.count);
      expect(a.centers, `${tag}: centers`).toEqual(b.centers);
      expect(arr(a.radii), `${tag}: radii`).toEqual(arr(b.radii));
      expect(arr(a.typeIds), `${tag}: typeIds`).toEqual(arr(b.typeIds));
      expect(arr(a.alive), `${tag}: alive`).toEqual(arr(b.alive));
      const ea = evalFociDeformation(carrier1500(), a), eb = evalFociDeformation(carrier1500(), b);
      expect(arr(ea.contrib), `${tag}: contrib`).toEqual(arr(eb.contrib));
      expect(arr(ea.coverMask), `${tag}: coverMask`).toEqual(arr(eb.coverMask));
    }
  });

  it('static greps: no Math.random / Date.now / convergence while; exactly one bounded BFS drain', () => {
    expect(CODE, 'no Math.random').not.toMatch(/Math\.random\s*\(/);
    expect(CODE, 'no Date.now').not.toMatch(/Date\.now\s*\(/);
    expect((CODE.match(/while\s*\(/g) || []).length, 'exactly one while (the BFS drain)').toBe(1);
    expect(CODE, 'no relax/Jacobi pass').not.toMatch(/for\s*\(\s*let\s+pass/);
  });

  it("draws only in 'disrupt:'; no shipped namespace literal; seedKey guard throws on foreign prefix", () => {
    const aleaTotal = (CODE.match(/alea\(/g) || []).length;
    const aleaSeed = (CODE.match(/alea\(\s*seedKey/g) || []).length;
    expect(aleaTotal, 'every alea() call is seedKey-derived').toBe(aleaSeed);
    expect(aleaTotal, 'three alea streams total').toBe(3);
    // RAW source: no quoted shipped-namespace literal (even in a comment)
    expect(SRC, 'no quoted shipped namespace').not.toMatch(/['"´`](magma:|stagnant:|shell:|plates:|lid:|e1:)/);
    // structural namespace exclusivity: the guard throws on a foreign prefix
    expect(() => makeCellDisruption(carrier1500(), { macroSeed: 1, seedKey: 'shell:cells:' })).toThrow();
    expect(() => makeFociDisruption(carrier1500(), { macroSeed: 1, seedKey: 'stagnant:corona:' })).toThrow();
  });

  it('never writes any carrier channel', () => {
    const c = carrier1500();
    const h0 = arr(c.height), g0 = arr(c.grainAngle), f0 = arr(c.faultDensity), r0 = arr(c.regime);
    const cells = makeCellDisruption(c, { macroSeed: 3 });
    const foci = makeFociDisruption(c, { macroSeed: 3, acceptWeightAt: makeSyntheticField(3) });
    evalFociDeformation(c, foci);
    void cells;
    expect(arr(c.height), 'carrier.height untouched').toEqual(h0);
    expect(arr(c.grainAngle), 'carrier.grainAngle untouched').toEqual(g0);
    expect(arr(c.faultDensity), 'carrier.faultDensity untouched').toEqual(f0);
    expect(arr(c.regime), 'carrier.regime untouched').toEqual(r0);
  });
});

// ═══ AC-STRUCT-CELLS — pinned bands (gate-3 discipline) ════════════════════════════════════════════════
describe('lid-disruption — AC-STRUCT-CELLS (pinned bands, gate-3 discipline)', () => {
  it('space-filling partition + count band + interiorness invariants, every seed', () => {
    for (const s of SEEDS) {
      const c = carrier1500();
      const out = makeCellDisruption(c, { macroSeed: s });
      const tag = `seed ${s}`;
      // C1: count band [CELL_MIN, CELL_MIN+CELL_SPAN)
      expect(out.cellCount, `${tag}: cellCount ∈ [9,18)`).toBeGreaterThanOrEqual(CELL_DEFAULTS.CELL_MIN);
      expect(out.cellCount, `${tag}: cellCount ∈ [9,18)`).toBeLessThan(CELL_DEFAULTS.CELL_MIN + CELL_DEFAULTS.CELL_SPAN);
      // C-inv: every node assigned a valid id; all K cells non-empty (space-filling)
      const seen = new Set();
      for (let i = 0; i < c.N; i++) {
        expect(out.cellId[i], `${tag}: valid cellId`).toBeGreaterThanOrEqual(0);
        expect(out.cellId[i], `${tag}: valid cellId`).toBeLessThan(out.cellCount);
        seen.add(out.cellId[i]);
      }
      expect(seen.size, `${tag}: all ${out.cellCount} cells non-empty`).toBe(out.cellCount);
      // C-inv: interiorness ∈ [0,1], exactly 0 on wall nodes, monotone-nondecreasing in wallDist
      const byDist = new Map();
      for (let i = 0; i < c.N; i++) {
        const v = out.interiorness[i];
        expect(v, `${tag}: interiorness ∈ [0,1]`).toBeGreaterThanOrEqual(0);
        expect(v, `${tag}: interiorness ∈ [0,1]`).toBeLessThanOrEqual(1);
        if (out.wallDist[i] === 0) expect(v, `${tag}: interiorness 0 on wall`).toBe(0);
        else expect(v, `${tag}: interiorness > 0 off wall`).toBeGreaterThan(0);
        if (!byDist.has(out.wallDist[i])) byDist.set(out.wallDist[i], v);
        else expect(v, `${tag}: interiorness constant per wallDist`).toBe(byDist.get(out.wallDist[i]));
      }
      const dists = [...byDist.keys()].sort((a, b) => a - b);
      for (let k = 1; k < dists.length; k++) {
        expect(byDist.get(dists[k]), `${tag}: monotone-nondecreasing in wallDist`).toBeGreaterThanOrEqual(byDist.get(dists[k - 1]));
      }
    }
  });

  it('C2/C3: wall-node fraction and mean interiorness within pinned bands, every seed', () => {
    for (const s of SEEDS) {
      const c = carrier1500();
      const st = cellStats(c, makeCellDisruption(c, { macroSeed: s }));
      const tag = `seed ${s}`;
      expect(st.wallFrac, `${tag}: wallFrac ∈ [0.25,0.50] (=${st.wallFrac.toFixed(3)})`).toBeGreaterThanOrEqual(0.25);
      expect(st.wallFrac, `${tag}: wallFrac ∈ [0.25,0.50]`).toBeLessThanOrEqual(0.50);
      expect(st.meanInt, `${tag}: meanInt ∈ [0.45,0.70] (=${st.meanInt.toFixed(3)})`).toBeGreaterThanOrEqual(0.45);
      expect(st.meanInt, `${tag}: meanInt ∈ [0.45,0.70]`).toBeLessThanOrEqual(0.70);
    }
  });

  it('C4/C5: pooled cell-size spread and min within pinned bands', () => {
    const pooled = [];
    for (const s of SEEDS) { const c = carrier1500(); pooled.push(...cellStats(c, makeCellDisruption(c, { macroSeed: s })).normSizes); }
    pooled.sort((a, b) => a - b);
    const spread = quantile(pooled, 0.9) - quantile(pooled, 0.1);
    expect(spread, `pooled q90−q10 ∈ [0.70,1.80] (=${spread.toFixed(3)})`).toBeGreaterThanOrEqual(0.70);
    expect(spread, `pooled q90−q10 ∈ [0.70,1.80]`).toBeLessThanOrEqual(1.80);
    expect(pooled[0], `pooled min ≤ 0.55 (=${pooled[0].toFixed(3)})`).toBeLessThanOrEqual(0.55);
  });

  it('anti-vacuous: every perturbed control falls OUTSIDE its band (K down/K up/warp up/belt x4)', () => {
    // K down → C1 below, C2 below, C3 above, C4 below + C5 above
    const kdownPooled = [];
    for (const s of SEEDS) {
      const c = carrier1500();
      const out = makeCellDisruption(c, { macroSeed: s, tune: { CELL_MIN: 3, CELL_SPAN: 1 } });
      const st = cellStats(c, out);
      expect(out.cellCount, `K-down seed ${s}: below C1`).toBeLessThan(CELL_DEFAULTS.CELL_MIN);
      expect(st.wallFrac, `K-down seed ${s}: below C2`).toBeLessThan(0.25);
      expect(st.meanInt, `K-down seed ${s}: above C3`).toBeGreaterThan(0.70);
      kdownPooled.push(...st.normSizes);
    }
    kdownPooled.sort((a, b) => a - b);
    const kdownSpread = quantile(kdownPooled, 0.9) - quantile(kdownPooled, 0.1);
    expect(kdownSpread, 'K-down: below C4 spread').toBeLessThan(0.70);
    expect(kdownPooled[0], 'K-down: above C5 min').toBeGreaterThan(0.55);
    // K up → C1 above, C2 above
    for (const s of SEEDS) {
      const c = carrier1500();
      const out = makeCellDisruption(c, { macroSeed: s, tune: { CELL_MIN: 36, CELL_SPAN: 1 } });
      const st = cellStats(c, out);
      expect(out.cellCount, `K-up seed ${s}: above C1`).toBeGreaterThanOrEqual(CELL_DEFAULTS.CELL_MIN + CELL_DEFAULTS.CELL_SPAN);
      expect(st.wallFrac, `K-up seed ${s}: above C2`).toBeGreaterThan(0.50);
    }
    // warp up → C2 above
    for (const s of SEEDS) {
      const c = carrier1500();
      const st = cellStats(c, makeCellDisruption(c, { macroSeed: s, tune: { WARP_AMP: 0.9 } }));
      expect(st.wallFrac, `warp-up seed ${s}: above C2`).toBeGreaterThan(0.50);
    }
    // belt x4 → C3 below
    for (const s of SEEDS) {
      const c = carrier1500();
      const st = cellStats(c, makeCellDisruption(c, { macroSeed: s, tune: { BELT_RADIANS: 0.24 } }));
      expect(st.meanInt, `belt-x4 seed ${s}: below C3`).toBeLessThan(0.45);
    }
  });
});

// ═══ AC-STRUCT-FOCI — pinned bands (synthetic field) ══════════════════════════════════════════════════
describe('lid-disruption — AC-STRUCT-FOCI (pinned bands, synthetic field)', () => {
  // pooled foci statistics at one density
  function fociPool(carrierFn) {
    let totalType1 = 0, totalCount = 0, coverSum = 0;
    const uhat = [];
    for (const s of SEEDS) {
      const c = carrierFn();
      const foci = makeFociDisruption(c, { macroSeed: s, acceptWeightAt: makeSyntheticField(s) });
      const { coverMask } = evalFociDeformation(c, foci);
      let cover = 0; for (let i = 0; i < c.N; i++) cover += coverMask[i];
      coverSum += cover / c.N;
      totalCount += foci.count;
      for (let i = 0; i < foci.count; i++) {
        totalType1 += foci.typeIds[i];
        uhat.push((foci.radii[i] / foci.meanEdgeAngle - FOCI_DEFAULTS.RC_MIN_NODES) / FOCI_DEFAULTS.RC_SPAN_NODES);
      }
    }
    return { coverFrac: coverSum / SEEDS.length, type1Frac: totalCount ? totalType1 / totalCount : 0, uhat, totalCount };
  }

  it('F1: accepted count within band at N=1500, every seed', () => {
    for (const s of SEEDS) {
      const c = carrier1500();
      const foci = makeFociDisruption(c, { macroSeed: s, acceptWeightAt: makeSyntheticField(s) });
      expect(foci.count, `seed ${s}: count ∈ [5,28] (=${foci.count})`).toBeGreaterThanOrEqual(5);
      expect(foci.count, `seed ${s}: count ∈ [5,28]`).toBeLessThanOrEqual(28);
    }
  });

  it('F2: pooled coverage in band at BOTH densities; cross-density ratio in band (resolution invariance)', () => {
    const hi = fociPool(carrier1500), lo = fociPool(carrier600);
    expect(hi.coverFrac, `N=1500 cover ∈ [0.02,0.12] (=${hi.coverFrac.toFixed(4)})`).toBeGreaterThanOrEqual(0.02);
    expect(hi.coverFrac, `N=1500 cover ∈ [0.02,0.12]`).toBeLessThanOrEqual(0.12);
    expect(lo.coverFrac, `N=600 cover ∈ [0.02,0.12] (=${lo.coverFrac.toFixed(4)})`).toBeGreaterThanOrEqual(0.02);
    expect(lo.coverFrac, `N=600 cover ∈ [0.02,0.12]`).toBeLessThanOrEqual(0.12);
    const ratio = hi.coverFrac / lo.coverFrac;
    expect(ratio, `cross-density ratio ∈ [0.5,2.0] (=${ratio.toFixed(2)})`).toBeGreaterThanOrEqual(0.5);
    expect(ratio, `cross-density ratio ∈ [0.5,2.0]`).toBeLessThanOrEqual(2.0);
  });

  it('F3: radius law heavy-tailed — pooled u-hat median in band', () => {
    const { uhat } = fociPool(carrier1500);
    uhat.sort((a, b) => a - b);
    const med = quantile(uhat, 0.5);
    expect(med, `pooled û median ∈ [0.08,0.35] (=${med.toFixed(3)})`).toBeGreaterThanOrEqual(0.08);
    expect(med, `pooled û median ∈ [0.08,0.35]`).toBeLessThanOrEqual(0.35);
  });

  it('F4: type split ~= TYPE_FRAC — pooled activeFrac in band', () => {
    const { type1Frac } = fociPool(carrier1500);
    expect(type1Frac, `pooled type1 frac ∈ [0.50,0.80] (=${type1Frac.toFixed(3)})`).toBeGreaterThanOrEqual(0.50);
    expect(type1Frac, `pooled type1 frac ∈ [0.50,0.80]`).toBeLessThanOrEqual(0.80);
  });

  it('F5: field bias real — biased mean > null-control mean every seed/density, margins at N=1500', () => {
    let pooledReal = 0, pooledCtrl = 0, nReal = 0, nCtrl = 0;
    for (const [carrierFn, density] of [[carrier1500, 1500], [carrier600, 600]]) {
      for (const s of SEEDS) {
        const field = makeSyntheticField(s);
        const c1 = carrierFn(), c2 = carrierFn();
        const real = makeFociDisruption(c1, { macroSeed: s, acceptWeightAt: field });
        const ctrl = makeFociDisruption(c2, { macroSeed: s, acceptWeightAt: null });
        let rSum = 0; for (let i = 0; i < real.count; i++) rSum += field(real.centers[i]);
        let cSum = 0; for (let i = 0; i < ctrl.count; i++) cSum += field(ctrl.centers[i]);
        const rMean = real.count ? rSum / real.count : 0, cMean = ctrl.count ? cSum / ctrl.count : 0;
        expect(rMean, `density ${density} seed ${s}: biased > control`).toBeGreaterThan(cMean);
        if (density === 1500) {
          expect(rMean / cMean, `density ${density} seed ${s}: per-seed ratio ≥ 1.3`).toBeGreaterThanOrEqual(1.3);
          pooledReal += rSum; nReal += real.count; pooledCtrl += cSum; nCtrl += ctrl.count;
        }
      }
    }
    const pooledRatio = (pooledReal / nReal) / (pooledCtrl / nCtrl);
    expect(pooledRatio, `N=1500 pooled ratio ≥ 2.0 (=${pooledRatio.toFixed(2)})`).toBeGreaterThanOrEqual(2.0);
  });

  it('F6: small-pool grace — POOL:3 + accept-floor yields exactly 3 features, cleanly evaluated', () => {
    for (const s of SEEDS) {
      const c = carrier1500();
      const foci = makeFociDisruption(c, { macroSeed: s, tune: { POOL: 3, POOL_REF_N: 1500 }, acceptWeightAt: () => 1 });
      expect(foci.count, `seed ${s}: exactly 3 features`).toBe(3);
      const { coverMask } = evalFociDeformation(c, foci);
      let cover = 0; for (let i = 0; i < c.N; i++) cover += coverMask[i];
      expect(cover, `seed ${s}: nonzero cover`).toBeGreaterThan(0);
    }
  });

  it('anti-vacuous: every perturbed control falls OUTSIDE its band (pool x4 / pool /4 / skew=1 / typeFrac)', () => {
    // pool x4 → F2 above
    let cover480 = 0;
    for (const s of SEEDS) {
      const c = carrier1500();
      const foci = makeFociDisruption(c, { macroSeed: s, tune: { POOL: 480 }, acceptWeightAt: makeSyntheticField(s) });
      const { coverMask } = evalFociDeformation(c, foci);
      let cover = 0; for (let i = 0; i < c.N; i++) cover += coverMask[i]; cover480 += cover / c.N;
    }
    expect(cover480 / SEEDS.length, 'pool x4: above F2').toBeGreaterThan(0.12);
    // pool /4 → F2 below
    let cover30 = 0;
    for (const s of SEEDS) {
      const c = carrier1500();
      const foci = makeFociDisruption(c, { macroSeed: s, tune: { POOL: 30 }, acceptWeightAt: makeSyntheticField(s) });
      const { coverMask } = evalFociDeformation(c, foci);
      let cover = 0; for (let i = 0; i < c.N; i++) cover += coverMask[i]; cover30 += cover / c.N;
    }
    expect(cover30 / SEEDS.length, 'pool /4: below F2').toBeLessThan(0.02);
    // skew=1 → F3 above (radius law de-skewed)
    const uhat = [];
    for (const s of SEEDS) {
      const c = carrier1500();
      const foci = makeFociDisruption(c, { macroSeed: s, tune: { SIZE_SKEW: 1 }, acceptWeightAt: makeSyntheticField(s) });
      for (let i = 0; i < foci.count; i++) uhat.push((foci.radii[i] / foci.meanEdgeAngle - FOCI_DEFAULTS.RC_MIN_NODES) / FOCI_DEFAULTS.RC_SPAN_NODES);
    }
    uhat.sort((a, b) => a - b);
    expect(quantile(uhat, 0.5), 'skew=1: above F3').toBeGreaterThan(0.35);
    // typeFrac → F4 below
    let t1 = 0, tot = 0;
    for (const s of SEEDS) {
      const c = carrier1500();
      const foci = makeFociDisruption(c, { macroSeed: s, tune: { TYPE_FRAC: 0.35 }, acceptWeightAt: makeSyntheticField(s) });
      for (let i = 0; i < foci.count; i++) { t1 += foci.typeIds[i]; tot++; }
    }
    expect(tot ? t1 / tot : 0, 'typeFrac: below F4').toBeLessThan(0.50);
  });
});

// ═══ AC-PROFILE-EQ — the one legitimate 1:1 extraction ════════════════════════════════════════════════
describe('lid-disruption — AC-PROFILE-EQ (the one legitimate 1:1 extraction)', () => {
  // re-inlined copies of the shipped expressions (character-for-character; amplitudes from each writer's DEFAULTS)
  const stagActive = (rho) => {
    const { A_DOME, A_TRENCH, A_RISE } = STAG_DEFAULTS;
    const dome = A_DOME * Math.max(0, 1 - (rho / 0.75) * (rho / 0.75));
    const trench = A_TRENCH * Math.exp(-((rho - 0.95) / 0.12) * ((rho - 0.95) / 0.12));
    const rise = A_RISE * Math.exp(-((rho - 1.25) / 0.18) * ((rho - 1.25) / 0.18));
    return dome - trench + rise;
  };
  const mixActive = (rho) => {
    const { A_DOME, A_TRENCH, A_RISE } = MIXED_DEFAULTS;
    const dome = A_DOME * Math.max(0, 1 - (rho / 0.75) * (rho / 0.75));
    const trench = A_TRENCH * Math.exp(-((rho - 0.95) / 0.12) * ((rho - 0.95) / 0.12));
    const rise = A_RISE * Math.exp(-((rho - 1.25) / 0.18) * ((rho - 1.25) / 0.18));
    return dome - trench + rise;
  };
  const stagInactive = (rho) => {
    const { A_DEP, A_RIM } = STAG_DEFAULTS;
    const dep = A_DEP * Math.max(0, 1 - (rho / 0.85) * (rho / 0.85));
    const rim = A_RIM * Math.exp(-((rho - 0.95) / 0.10) * ((rho - 0.95) / 0.10));
    return -dep + rim;
  };
  const mixInactive = (rho) => {
    const { A_DEP, A_RIM } = MIXED_DEFAULTS;
    const dep = A_DEP * Math.max(0, 1 - (rho / 0.85) * (rho / 0.85));
    const rim = A_RIM * Math.exp(-((rho - 0.95) / 0.10) * ((rho - 0.95) / 0.10));
    return -dep + rim;
  };
  // dense ρ grid + exact boundary/segment points
  const grid = [];
  for (let i = 0; i <= 340; i++) grid.push(i * 0.005);
  for (const b of [0, 0.75, 0.85, 0.95, 1.25, 1.3, 1.6]) grid.push(b);

  it('profileActiveCorona === stagnantLid STEP-3 arithmetic AND mixedInterior STEP-7 duplicate, exact FP, dense rho grid', () => {
    for (const rho of grid) {
      const v = profileActiveCorona(rho, PROFILE_DEFAULTS);
      expect(v, `active vs stagnant @ρ=${rho}`).toBe(stagActive(rho));
      expect(v, `active vs mixed @ρ=${rho}`).toBe(mixActive(rho));
    }
  });

  it('profileInactiveCorona === both shipped copies, exact FP, dense rho grid', () => {
    for (const rho of grid) {
      const v = profileInactiveCorona(rho, PROFILE_DEFAULTS);
      expect(v, `inactive vs stagnant @ρ=${rho}`).toBe(stagInactive(rho));
      expect(v, `inactive vs mixed @ρ=${rho}`).toBe(mixInactive(rho));
    }
  });

  it('PROFILE_DEFAULTS amplitudes === STAG_DEFAULTS === MIXED_DEFAULTS values; shipped sources still contain the inline formulas', () => {
    for (const k of ['A_DOME', 'A_TRENCH', 'A_RISE', 'A_DEP', 'A_RIM']) {
      expect(PROFILE_DEFAULTS[k]).toBe(STAG_DEFAULTS[k]);
      expect(PROFILE_DEFAULTS[k]).toBe(MIXED_DEFAULTS[k]);
    }
    // the premise "the inline copies still exist unmodified" — fails loudly if a future edit moves them
    for (const src of [STAG_SRC, MIXED_SRC]) {
      expect(src).toMatch(/\(rho \/ 0\.75\) \* \(rho \/ 0\.75\)/);
      expect(src).toMatch(/\(rho - 0\.95\) \/ 0\.12/);
      expect(src).toMatch(/\(rho - 1\.25\) \/ 0\.18/);
      expect(src).toMatch(/\(rho \/ 0\.85\) \* \(rho \/ 0\.85\)/);
      expect(src).toMatch(/\(rho - 0\.95\) \/ 0\.10/);
    }
  });
});

// ═══ AC-CONSUMER-SEAM — V2-9a pluggability + V2-7 editor split ════════════════════════════════════════
describe('lid-disruption — AC-CONSUMER-SEAM (V2-9a pluggability + V2-7 editor split)', () => {
  const P = PROFILE_DEFAULTS;
  const GROOVE = { fn: profileGroovedDiapir, support: P.GROOVE_SUPPORT };
  const PROFILES3 = [...DISRUPT_PROFILES, GROOVE];   // typeId 2 = grooved

  it('(a) grooved profile: ring count + spacing + trough<flanks ordering on the rho profile (pure)', () => {
    // dense grid; strict local minima in (0.05, GROOVE_SUPPORT)
    const step = 0.001, lo = 0.05, hi = P.GROOVE_SUPPORT;
    const xs = [], ys = [];
    for (let r = lo; r <= hi + 1e-9; r += step) { xs.push(r); ys.push(profileGroovedDiapir(r, P)); }
    const minIdx = [];
    for (let j = 1; j < xs.length - 1; j++) if (ys[j] < ys[j - 1] && ys[j] < ys[j + 1]) minIdx.push(j);
    expect(minIdx.length, `exactly ${P.GROOVE_RINGS} ring minima`).toBe(P.GROOVE_RINGS);
    // each minimum near rk = R0 + k·DR (within DR/4); prominence ≥ 0.05
    for (let k = 0; k < minIdx.length; k++) {
      const rk = P.GROOVE_R0 + k * P.GROOVE_DR;
      expect(Math.abs(xs[minIdx[k]] - rk), `ring ${k} within DR/4 of ${rk}`).toBeLessThanOrEqual(P.GROOVE_DR / 4);
      const leftLo = k === 0 ? 0 : minIdx[k - 1];
      const rightHi = k === minIdx.length - 1 ? xs.length - 1 : minIdx[k + 1];
      let leftMax = -Infinity, rightMax = -Infinity;
      for (let j = leftLo; j <= minIdx[k]; j++) leftMax = Math.max(leftMax, ys[j]);
      for (let j = minIdx[k]; j <= rightHi; j++) rightMax = Math.max(rightMax, ys[j]);
      const prom = Math.min(leftMax, rightMax) - ys[minIdx[k]];
      expect(prom, `ring ${k} prominence ≥ 0.05 (=${prom.toFixed(3)})`).toBeGreaterThanOrEqual(0.05);
    }
    // consecutive-minima spacing = DR ± DR/4
    for (let k = 1; k < minIdx.length; k++) {
      const sp = xs[minIdx[k]] - xs[minIdx[k - 1]];
      expect(Math.abs(sp - P.GROOVE_DR), `spacing ${k} = DR ± DR/4`).toBeLessThanOrEqual(P.GROOVE_DR / 4);
    }
    // MF1: adjacent-midpoint ordering — each ring centre sits below BOTH flanking midpoints (robust)
    for (let k = 0; k < P.GROOVE_RINGS; k++) {
      const rk = P.GROOVE_R0 + k * P.GROOVE_DR;
      const atRing = profileGroovedDiapir(rk, P);
      expect(atRing, `ring ${k}: trough < lower flank`).toBeLessThan(profileGroovedDiapir(rk - P.GROOVE_DR / 2, P));
      expect(atRing, `ring ${k}: trough < upper flank`).toBeLessThan(profileGroovedDiapir(rk + P.GROOVE_DR / 2, P));
    }
  });

  it('(a) grooved profile renders through evalFociDeformation — per-node exact-equality + cover set (big-radius focus)', () => {
    const c = carrier1500();
    const foci = makeFociDisruption(c, { macroSeed: 7, acceptWeightAt: makeSyntheticField(7) });
    expect(foci.count, 'have at least one focus').toBeGreaterThan(0);
    // isolate ONE big-radius grooved focus
    for (let i = 0; i < foci.count; i++) foci.alive[i] = 0;
    foci.alive[0] = 1; foci.typeIds[0] = 2; foci.radii[0] = 0.5;
    const { contrib, coverMask } = evalFociDeformation(c, foci, PROFILES3, P);
    const ctr = foci.centers[0], Rc = 0.5;
    let covered = 0;
    for (let i = 0; i < c.N; i++) {
      const rho = Math.acos(Math.max(-1, Math.min(1, dot3(c.verts[i], ctr)))) / Rc;
      if (rho > P.GROOVE_SUPPORT) {
        expect(coverMask[i], `node ${i} outside support uncovered`).toBe(0);
        expect(contrib[i], `node ${i} outside support zero`).toBe(0);
      } else {
        covered++;
        expect(coverMask[i], `node ${i} inside support covered`).toBe(1);
        expect(contrib[i], `node ${i} grooved contrib exact`).toBe(Math.fround(profileGroovedDiapir(rho, P)));
      }
    }
    expect(covered, 'grooved focus covers a nonzero node set').toBeGreaterThan(0);
  });

  it('(b) deactivate one focus + re-eval: change localized to its support, bytes elsewhere identical', () => {
    const c = carrier1500();
    const foci = makeFociDisruption(c, { macroSeed: 42, acceptWeightAt: makeSyntheticField(42) });
    expect(foci.count, 'need ≥2 foci for a localized-change test').toBeGreaterThan(1);
    const base = evalFociDeformation(c, foci);
    const j = 0;   // deactivate focus 0
    const ctrJ = foci.centers[j], RcJ = foci.radii[j] || 1e-6, supJ = DISRUPT_PROFILES[foci.typeIds[j]].support;
    // per-node cover count from the OTHER foci (to know where j was the sole coverer)
    foci.alive[j] = 0;
    const after = evalFociDeformation(c, foci);
    let changedInside = 0;
    for (let i = 0; i < c.N; i++) {
      const rhoJ = Math.acos(Math.max(-1, Math.min(1, dot3(c.verts[i], ctrJ)))) / RcJ;
      if (rhoJ > supJ) {
        // outside j's support: j contributed nothing either way ⇒ byte-identical
        expect(after.contrib[i], `node ${i} outside j support unchanged`).toBe(base.contrib[i]);
        expect(after.coverMask[i], `node ${i} outside j cover unchanged`).toBe(base.coverMask[i]);
      } else {
        if (after.contrib[i] !== base.contrib[i]) changedInside++;
        if (after.coverMask[i] === 0) expect(after.contrib[i], `node ${i} now uncovered ⇒ zero`).toBe(0);
      }
    }
    expect(changedInside, 'deactivation changed contribution inside j support').toBeGreaterThan(0);
  });

  it('(b) retype one focus to grooved + re-eval: change localized, draw streams untouched', () => {
    const c = carrier1500();
    const foci = makeFociDisruption(c, { macroSeed: 3, acceptWeightAt: makeSyntheticField(3) });
    expect(foci.count, 'need ≥1 focus').toBeGreaterThan(0);
    const base = evalFociDeformation(c, foci, PROFILES3, P);
    const k = 0;
    const ctrK = foci.centers[k], RcK = foci.radii[k] || 1e-6;
    const oldSup = PROFILES3[foci.typeIds[k]].support, newSup = GROOVE.support;
    const maxSup = Math.max(oldSup, newSup);
    // capture descriptor identity to prove no redraw happened (eval takes no rng)
    const centersRef = foci.centers, radiiSnap = arr(foci.radii);
    foci.typeIds[k] = 2;   // retype to grooved (a pure descriptor mutation)
    const after = evalFociDeformation(c, foci, PROFILES3, P);
    for (let i = 0; i < c.N; i++) {
      const rhoK = Math.acos(Math.max(-1, Math.min(1, dot3(c.verts[i], ctrK)))) / RcK;
      if (rhoK > maxSup) expect(after.contrib[i], `node ${i} outside k old∪new support unchanged`).toBe(base.contrib[i]);
    }
    // descriptor untouched by eval (no placement redraw): centers ref + radii bytes identical
    expect(foci.centers, 'centers array identity preserved (no redraw)').toBe(centersRef);
    expect(arr(foci.radii), 'radii unchanged by eval').toEqual(radiiSnap);
  });
});

// ═══ AC-ZERO-WIRING — no production importer ══════════════════════════════════════════════════════════
describe('lid-disruption — AC-ZERO-WIRING', () => {
  it('no src/ file (nor planet-lod-rivers.js) imports lidDisruption.js', () => {
    const root = fileURLToPath(new URL('..', import.meta.url));
    const offenders = [];
    const walk = (dir) => {
      for (const ent of readdirSync(dir, { withFileTypes: true })) {
        if (ent.name === 'node_modules' || ent.name === '.git') continue;
        const full = dir.endsWith('/') ? dir + ent.name : dir + '/' + ent.name;
        if (ent.isDirectory()) walk(full);
        else if (ent.name.endsWith('.js') && !full.endsWith('/src/worldengine/base/lidDisruption.js')) {
          if (/lidDisruption/.test(readFileSync(full, 'utf8'))) offenders.push(full);
        }
      }
    };
    walk(root + 'src');
    // planet-lod-rivers.js (top-level dispatch) explicitly checked
    if (/lidDisruption/.test(readFileSync(root + 'planet-lod-rivers.js', 'utf8'))) offenders.push(root + 'planet-lod-rivers.js');
    expect(offenders, `no src/ importer of lidDisruption (found: ${offenders.join(', ')})`).toEqual([]);
  });
});
