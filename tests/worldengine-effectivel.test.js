// tests/worldengine-effectivel.test.js — World Engine V2-2b-2b SLICE 1 (effectiveL threading — wet-stagnant world).
//
// AC-EFFECTIVEL + AC-WETSTAG-BASIS for the R-wetstag hand-up: classifyLidPath (lidResponse.js) and the composer
// Ybase (mixedInterior.js) read `effectiveL ?? L`, so a WET seeded-'stagnant' body routes to 'mixed' (not
// off-pilot) and pierces at the strong-but-piercable edge (a few pierces), NOT pervasively.
//
//   • AC-EFFECTIVEL — (a) a WET hand-built tuple (effectiveL 0.60) → 'mixed'; its effectiveL-stripped control
//     (raw L 0.16 < MIXED_LO) → 'off-pilot'; + one computeE1-DERIVED wet tuple (weights override forcing the
//     seeded-'stagnant' pick) proving the REAL machinery emits effectiveL and routes 'mixed' where raw L would
//     have fallen off-pilot. (b) a DRY synthetic tuple (effectiveL 0.65 ≥ L_STRONG, tidally quiet) → 'pure-strong'
//     — SYNTHETIC-ONLY (§8 risk 1: no real in-band body reaches effectiveL ≥ L_STRONG). (c) in the composer at
//     (effectiveL 0.60, Φ 0.42, n 6): Ybase ≈ 0.3413 (effectiveL) vs ≈ 0.0072 (raw L 0.16), pierceCount a small
//     handful under effectiveL vs pervasive (=== n) under raw L.
//   • AC-WETSTAG-BASIS — at the wet coordinate × seeds {1,2,3,7,42} at N=1500: TENT-family-DOMINANT primitiveId
//     histogram + a minority PIERCE presence; center-organized (|corr(structureMask, center predictor)| ≥ 0.40
//     AND cLat² < cCenter²); distinct per seed; and the wet histogram is measurably DIFFERENT from the Venus
//     composer coordinate {L 0.728, Φ 0.69, n 6} (the "not a re-rolled Venus" bar — measured on primitiveId).
//     [ADV-FIXED] We do NOT assert "Venus → 0 pierce / all TENT": Venus's Φ 0.69 > PHI_BREACH 0.45, so once
//     SLICE 2 lands breach can fire in the Venus build. The histogram-DIFFERENCE + the wet world's own minority
//     PIERCE presence hold regardless; the wet coordinate's Φ 0.42 < PHI_BREACH keeps the wet field SLICE-2-frozen.
//
// All headless. The composer helpers (centerPredictor / structureMask / latY / pearson) are COPIED from
// worldengine-mixed-composer.test.js:61-97 as the plan directs; the wet field == 2b-2a's verified (L 0.60,
// Φ 0.42, n 6) compound field by construction (Lyield = effectiveL ?? L = 0.60), so it is pre-characterized.
import { describe, it, expect } from 'vitest';
import { makeSphereField } from '../src/worldengine/base/sphereField.js';
import { buildIrregularSphere } from '../planet-lod-rivers.js';
import { writeMixedInteriorSphere } from '../src/worldengine/base/mixedInterior.js';
import { classifyLidPath } from '../src/worldengine/base/lidResponse.js';
import { computeE1, L_STRONG } from '../src/worldengine/base/e1Regime.js';

const SEEDS = [1, 2, 3, 7, 42];
const TARGET_N = 1500, LLOYD = 2;
let _mesh = null;
const meshOf = () => (_mesh || (_mesh = buildIrregularSphere(TARGET_N, LLOYD)));
const carrierOf = () => makeSphereField(meshOf());
const build = (e1, seed, tune = null) => {
  const c = carrierOf();
  const r = writeMixedInteriorSphere(c, { e1, rawTidal: 0, macroSeed: seed, tune });
  return { c, r };
};

// primitiveId enum values (a test-local copy — the composer emits these; the router owns the exported enum).
const ID_SHIELD = 1, ID_CALDERA = 2, ID_CORONA = 5, ID_TESSERA = 6, ID_RIFT = 7, ID_PLAIN = 8;
const PIERCE_FAM = new Set([ID_SHIELD, ID_CALDERA, 3, 4]);

// ── arm's-length stats helpers — COPIED VERBATIM from worldengine-mixed-composer.test.js:60-97 ──────────────
const mean = (a) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i]; return a.length ? s / a.length : 0; };
function pearson(x, y) {
  const n = x.length, mx = mean(x), my = mean(y);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { const dx = x[i] - mx, dy = y[i] - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy; }
  const den = Math.sqrt(sxx * syy); return den < 1e-12 ? 0 : sxy / den;
}
const v3dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
function centerPredictor(c, centers, BELT) {
  const N = c.N, verts = c.verts, pred = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    let best = 0;
    for (let p = 0; p < centers.length; p++) {
      const a = Math.acos(Math.max(-1, Math.min(1, v3dot(verts[i], centers[p]))));
      const g = Math.exp(-(a / BELT) * (a / BELT));
      if (g > best) best = g;
    }
    pred[i] = best;
  }
  return pred;
}
function structureMask(c, primitiveId) {
  const N = c.N, m = new Float64Array(N);
  for (let i = 0; i < N; i++) m[i] = (primitiveId[i] === ID_SHIELD || primitiveId[i] === ID_CALDERA
    || primitiveId[i] === ID_CORONA || primitiveId[i] === ID_TESSERA) ? 1 : 0;
  return m;
}
function latY(c) {
  const N = c.N, l = new Float64Array(N);
  for (let i = 0; i < N; i++) { const y = Math.max(-1, Math.min(1, c.verts[i][1])); l[i] = y * y; }
  return l;
}

// ── histogram helpers (for the TENT-dominance + minority-pierce + not-a-re-rolled-Venus assertions) ─────────
function hist(primitiveId) { const H = {}; for (const v of primitiveId) H[v] = (H[v] || 0) + 1; return H; }
const histSig = (pid) => { const H = hist(pid); return Object.keys(H).sort((a, b) => a - b).map((k) => `${k}:${H[k]}`).join(' '); };
function tvd(pidA, pidB) {
  const NA = pidA.length, NB = pidB.length, a = hist(pidA), b = hist(pidB);
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  let s = 0;
  for (const k of keys) s += Math.abs((a[k] || 0) / NA - (b[k] || 0) / NB);
  return s / 2;
}
const fracInFamily = (pid, fam) => { let n = 0; for (const v of pid) if (fam.has(v)) n++; return n / pid.length; };

// ═══ AC-EFFECTIVEL — effectiveL routes + yields the wet-stagnant world ══════════════════════════════════════
describe('V2-2b-2b AC-EFFECTIVEL — effectiveL ROUTES (classifyLidPath) the wet body to \'mixed\'', () => {
  // (a) a WET seeded-'stagnant' E1 tuple (effectiveL ≈ 0.60, raw L 0.16 < MIXED_LO 0.35).
  const wet = { compositionClass: 'rocky', geodynamicRegime: 'stagnant', m_hp: -0.45, L: 0.16, effectiveL: 0.60 };

  it('(a) WET hand-built tuple (effectiveL 0.60) → \'mixed\'; effectiveL-stripped control (raw L 0.16) → \'off-pilot\'', () => {
    expect(classifyLidPath(wet, 0), `wet ${JSON.stringify(wet)}`).toBe('mixed');
    const control = { ...wet, effectiveL: undefined };   // raw L 0.16 < MIXED_LO → the without-effectiveL fallback
    expect(classifyLidPath(control, 0), `control ${JSON.stringify(control)}`).toBe('off-pilot');
  });

  it('(a) computeE1-DERIVED wet tuple (weights {mobile:0,episodic:0,stagnant:1}) emits effectiveL + routes \'mixed\'', () => {
    // A real temperate-wet Earth-mass rocky body, forced onto the seeded-'stagnant' pick via the lab-only weights
    // override — proving the REAL machinery (e1Regime.js, UNEDITED) emits effectiveL, not just a hand tuple.
    const wetCv = {
      density: 5.5, T_eq: 300, surfaceGravity: 1.0, radiusEarth: 1.0, age: 4.5, rawTidalIoRatio: 0,
      composition: { volatileFraction: 0.15, carbonToOxygen: 0.5 },
    };
    const e1 = computeE1(wetCv, 1, { weights: { mobile: 0, episodic: 0, stagnant: 1 } });
    expect(e1.geodynamicRegime, `regime — ${JSON.stringify(e1)}`).toBe('stagnant');
    expect(e1.effectiveL, `real machinery emitted effectiveL — ${JSON.stringify(e1)}`).toBeDefined();
    expect(e1.effectiveL).toBeGreaterThanOrEqual(0.60);
    expect(e1.effectiveL).toBeLessThan(L_STRONG);          // wet ⇒ piercable lower edge, never pure-strong
    expect(e1.L, `raw L is below MIXED_LO so the effectiveL read did the routing — ${JSON.stringify(e1)}`).toBeLessThan(0.35);
    expect(classifyLidPath(e1, wetCv.rawTidalIoRatio), `real wet body routes mixed — ${JSON.stringify(e1)}`).toBe('mixed');
    // control: the SAME body read on its raw L (effectiveL stripped) would have fallen off-pilot.
    expect(classifyLidPath({ ...e1, effectiveL: undefined }, wetCv.rawTidalIoRatio)).toBe('off-pilot');
  });

  it('(b) DRY synthetic tuple (effectiveL 0.65 ≥ L_STRONG, tidally quiet) → \'pure-strong\' [SYNTHETIC-ONLY, §8 risk 1]', () => {
    // §8 risk 1: no REAL in-band body reaches effectiveL ≥ L_STRONG (inSeededBand needs V≥0.12 ⇒ effectiveL ≤ 0.6275).
    // This is a valid unit test of the classifier's effectiveL read at the TOP of the [0.60,0.66] band only.
    const dry = { compositionClass: 'rocky', geodynamicRegime: 'stagnant', m_hp: -0.45, L: 0.20, effectiveL: 0.65 };
    expect(classifyLidPath(dry, 0), `dry ${JSON.stringify(dry)}`).toBe('pure-strong');
  });
});

describe('V2-2b-2b AC-EFFECTIVEL — effectiveL YIELDS the pierce split (composer Ybase reads effectiveL ?? L)', () => {
  it('(c) at (effectiveL 0.60, Φ 0.42, n 6): Ybase ≈ 0.3413 vs raw-L 0.16 ≈ 0.0072; pierce a handful vs pervasive', () => {
    const wetC = { L: 0.16, effectiveL: 0.60, Φ: 0.42, n: 6 };
    const stripC = { L: 0.16, Φ: 0.42, n: 6 };            // effectiveL-stripped ⇒ Ybase reads raw L 0.16
    for (const seed of [1, 2]) {
      const w = build(wetC, seed), s = build(stripC, seed);
      const tag = `seed ${seed}`;
      // Ybase is seed-independent (a function of Lyield only): effectiveL edge vs raw-L edge.
      expect(w.r.mixedDiag.Ybase, `${tag}: Ybase(effectiveL 0.60)`).toBeCloseTo(0.3413, 4);
      expect(s.r.mixedDiag.Ybase, `${tag}: Ybase(raw L 0.16)`).toBeCloseTo(0.0072, 4);
      expect(w.r.mixedDiag.effectiveL, `${tag}: mixedDiag.effectiveL = Lyield`).toBeCloseTo(0.60, 6);
      expect(s.r.mixedDiag.effectiveL, `${tag}: stripped ⇒ Lyield === raw L`).toBeCloseTo(0.16, 6);
      // pierceCount: a small handful under effectiveL (strong-but-piercable edge) vs pervasive (=== n) under raw L.
      expect(w.r.mixedDiag.pierceCount, `${tag}: wet pierce a handful (≥1, < n)`).toBeGreaterThanOrEqual(1);
      expect(w.r.mixedDiag.pierceCount, `${tag}: wet pierce < n (not pervasive)`).toBeLessThan(wetC.n);
      expect(s.r.mixedDiag.pierceCount, `${tag}: raw-L pierces pervasively (=== n)`).toBe(stripC.n);
    }
  });
});

// ═══ AC-WETSTAG-BASIS — structurally not-Venus + plume-organized + distinct-per-seed ════════════════════════
describe('V2-2b-2b AC-WETSTAG-BASIS — wet-stagnant world is TENT-dominant + minority-pierce + center-organized', () => {
  const wetE1 = { compositionClass: 'rocky', geodynamicRegime: 'stagnant', m_hp: -0.45, L: 0.16, effectiveL: 0.60, Φ: 0.42, n: 6 };
  const venusComposerE1 = { L: 0.728, Φ: 0.69, n: 6 };   // the pure-strong Venus composer reference (§SLICE-1)

  it('TENT-family DOMINANT histogram with a minority PIERCE presence, every seed', () => {
    for (const s of SEEDS) {
      const { r } = build(wetE1, s);
      const tentFrac = fracInFamily(r.primitiveId, new Set([ID_CORONA, ID_TESSERA, ID_RIFT, ID_PLAIN]));
      const pierceFrac = fracInFamily(r.primitiveId, PIERCE_FAM);
      const tag = `seed ${s}: tentFrac=${tentFrac.toFixed(3)} pierceFrac=${pierceFrac.toFixed(4)} pierceCount=${r.mixedDiag.pierceCount}`;
      expect(tentFrac, `${tag}: TENT family dominant`).toBeGreaterThan(0.80);
      expect(pierceFrac, `${tag}: a minority PIERCE presence (> 0)`).toBeGreaterThan(0);
      expect(pierceFrac, `${tag}: PIERCE is a MINORITY (not pervasive)`).toBeLessThan(0.15);
      expect(r.mixedDiag.pierceCount, `${tag}: ≥1 piercing center`).toBeGreaterThanOrEqual(1);
    }
  });

  it('center-organized not latitude-banded: |corr(structureMask, center predictor)| ≥ 0.40 AND cLat² < cCenter², every seed', () => {
    for (const s of SEEDS) {
      const { c, r } = build(wetE1, s);
      const pred = centerPredictor(c, r.mixedDiag.centers, r.mixedDiag.beltScale);
      const mask = structureMask(c, r.primitiveId);
      const lat = latY(c);
      const cCenter = Math.abs(pearson(mask, pred));
      const cLat = Math.abs(pearson(mask, lat));
      const tag = `seed ${s}: |corr(mask,center)|=${cCenter.toFixed(3)} |corr(mask,lat)|=${cLat.toFixed(3)}`;
      expect(cCenter, `${tag}: center signal ≥ 0.40`).toBeGreaterThanOrEqual(0.40);
      expect(cCenter, `${tag}: center ≫ latitude`).toBeGreaterThan(cLat);
      expect(cLat * cLat, `${tag}: varExplainedByLatitude < byCenter`).toBeLessThan(cCenter * cCenter);
    }
  });

  it('distinct per seed: the primitiveId histograms are all distinct across {1,2,3,7,42}', () => {
    const sigs = SEEDS.map((s) => histSig(build(wetE1, s).r.primitiveId));
    expect(new Set(sigs).size, `distinct histograms across seeds — ${sigs.join(' | ')}`).toBe(SEEDS.length);
  });

  it('histogram-DIFFERENCE: the wet histogram is measurably ≠ the Venus composer coordinate, every seed (not a re-rolled Venus)', () => {
    // [ADV-FIXED] measured on primitiveId; NOT "Venus → 0 pierce / all TENT" (Venus Φ 0.69 > PHI_BREACH ⇒ SLICE-2
    // breach can fire there). TVD floor 0.01 sits well below the measured wet-vs-Venus separation (≥ 0.027) and
    // survives the small SLICE-2 Venus perturbation; the wet coordinate (Φ 0.42 < PHI_BREACH) is SLICE-2-frozen.
    for (const s of SEEDS) {
      const wet = build(wetE1, s).r.primitiveId;
      const venus = build(venusComposerE1, s).r.primitiveId;
      const d = tvd(wet, venus);
      const tag = `seed ${s}: TVD(wet, venus)=${d.toFixed(4)}`;
      expect(histSig(wet) !== histSig(venus), `${tag}: histograms not identical`).toBe(true);
      expect(d, `${tag}: measurably different (TVD ≥ 0.01)`).toBeGreaterThanOrEqual(0.01);
    }
  });
});
