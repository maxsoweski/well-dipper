// tests/worldengine-base-stagnantlid-structure.test.js
// Increment #4b (world-engine-venus-stagnantlid): the STAGNANT-LID silicate relief writer
// (writeStagnantLidReliefSphere, stagnantLid.js) — sibling of plates.js / shellRelief.js / magmatism.js
// for Venus. Three-free, deterministic, generative-not-simulative; organizes relief about ONE seeded
// mantle-plume field (tessera plateaus + coronae + basaltic plains), REPLACING the sin^2(lat) fallback.
//
// SLICE A (this file, AC1-AC5): AC1 determinism / no-RNG / bounds / render-once; AC2 structure bar
// (plume-organized, tessera/plains fractions, elevation ordering, active/inactive morphology selector,
// activeFrac); AC3 latitude control (must FAIL); AC4 random-placement control (must FAIL); AC5 variety.
// SLICE B (appended below when the dispatch wiring lands): AC6 no-clobber + AC7 seam-fires.
// Anti-circularity: every predictor is rebuilt ARM'S-LENGTH from the PUBLISHED plumeCenters + node
// positions — NEVER from the writer's plumeProx or from U.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  writeStagnantLidReliefSphere, stagnantLidRegimeOf, STAGNANT_BOUND, RELAX_PASSES, DEFAULTS,
} from '../src/worldengine/base/stagnantLid.js';
import { makeSphereField } from '../src/worldengine/base/sphereField.js';
import { writeGrainSphere, writeHeightSphere } from '../src/worldengine/base/tectonic.js';
import { writePlateUpliftSphere } from '../src/worldengine/base/plates.js';
import { writeShellReliefSphere } from '../src/worldengine/base/shellRelief.js';
import { writeMagmatismSphere, magmaDriversToTune } from '../src/worldengine/base/magmatism.js';
import {
  buildIrregularSphere, writeBodyRelief, DEFAULT_GRAIN_DRIVERS,
} from '../planet-lod-rivers.js';
// PRESET_ARCHETYPE-retirement (2026-07-13): the four label-keyed predicates are gone; the AC6/AC7 dispatch
// callers migrate to condition-bearing bundles. stagnantLidRegimeOf (writer-module export) SURVIVES — kept.
import { DRIVER_PRESETS } from '../driver-presets.js';
import { buildNeutralBodyDrivers } from '../body-drivers.js';
import { deriveConditionVector } from '../body-condition-vector.js';
import { deriveUniforms } from '../planet-lod-lab-core.js';

// N=1500 (finer than the plate/magma siblings' 600): stagnant-lid ships MANY small clustered coronae +
// tessera — a finer structure than a few big plate/plume features — so it needs more nodes to resolve.
const TARGET_N = 1500, LLOYD = 2;
const SEEDS = [1, 2, 3, 7, 42];
const STAGNANT_SRC = readFileSync(fileURLToPath(new URL('../src/worldengine/base/stagnantLid.js', import.meta.url)), 'utf8');
const carrierOf = () => makeSphereField(buildIrregularSphere(TARGET_N, LLOYD));
const build = (macroSeed, control = false) => {
  const c = carrierOf();
  const diag = writeStagnantLidReliefSphere(c, {}, { macroSeed, randomPlacementControl: control });
  return { c, diag };
};

// ── arm's-length predictor + stats helpers (rebuilt from PUBLISHED diag.plumeCenters only) ────────────
const mean = (a) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i]; return a.length ? s / a.length : 0; };
function pearson(x, y) {
  const n = x.length, mx = mean(x), my = mean(y);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { const dx = x[i] - mx, dy = y[i] - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy; }
  const den = Math.sqrt(sxx * syy); return den < 1e-12 ? 0 : sxy / den;
}
const varExplained = (x, y) => { const r = pearson(x, y); return r * r; };   // r^2
const v3dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// SQUARED Gaussian (matches the writer's proxAt exactly — Pearson is not invariant under the linear form).
function plumePredictor(c, centers, BELT) {
  const N = c.N, verts = c.verts;
  const pred = new Float64Array(N);
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
// structure membership (tessera ∪ corona-cover) as a 0/1 field — the causal target of the plume field.
function structureMask(diag) {
  const N = diag.U.length, m = new Float64Array(N);
  for (let i = 0; i < N; i++) m[i] = (diag.isTessera[i] || diag.coronaCoverMask[i]) ? 1 : 0;
  return m;
}
// The plume-organization signal: |Pearson(structureMask, plumePredictor)|. We use |corr| (not r^2)
// because structureMask is a ~17%-ones BINARY point-biserial against a continuous predictor — r^2>=0.5
// (|r|>=0.71) is structurally unreachable for a sparse binary mask (measured ceiling ~0.46). This mirrors
// the magmatism sibling, which also correlates with |corr| and leans on the real-vs-random control (AC4)
// as the rigorous, seed-robust falsifier. See the workstream BUILD-PLAN "AC2(a) calibration" note.
function structureCorr(c, diag) {
  const pred = plumePredictor(c, diag.plumeCenters, diag.PLUME_BELT);
  return Math.abs(pearson(structureMask(diag), pred));
}
// sin^2(lat about +y) predictor.
function latY(c) {
  const N = c.N, l = new Float64Array(N);
  for (let i = 0; i < N; i++) { const y = Math.max(-1, Math.min(1, c.verts[i][1])); l[i] = y * y; }
  return l;
}
// the LOW mask for the elevation ordering: {inRift} ∪ {active-corona TRENCH annulus 0.8<=rho<=1.05}.
function riftTrenchMask(c, diag) {
  const N = c.N, m = new Uint8Array(N);
  for (let i = 0; i < N; i++) if (diag.inRift[i]) m[i] = 1;
  for (let cc = 0; cc < diag.coronaCount; cc++) {
    if (!diag.coronaActive[cc]) continue;
    const ctr = diag.coronaCenters[cc], Rc = diag.coronaRadius[cc] || 1e-6;
    for (let i = 0; i < N; i++) {
      const rho = Math.acos(Math.max(-1, Math.min(1, v3dot(c.verts[i], ctr)))) / Rc;
      if (rho >= 0.8 && rho <= 1.05) m[i] = 1;
    }
  }
  return m;
}
const meanOverMask = (U, mask) => { let s = 0, n = 0; for (let i = 0; i < U.length; i++) if (mask[i]) { s += U[i]; n++; } return n ? s / n : NaN; };
const meanPlains = (diag) => { let s = 0, n = 0; for (let i = 0; i < diag.U.length; i++) if (!diag.isTessera[i] && !diag.inRift[i] && !diag.coronaCoverMask[i]) { s += diag.U[i]; n++; } return n ? s / n : NaN; };
const meanTessera = (diag) => { let s = 0, n = 0; for (let i = 0; i < diag.U.length; i++) if (diag.isTessera[i]) { s += diag.U[i]; n++; } return n ? s / n : NaN; };

// ── AC1 — determinism / no-RNG / bounds / render-once ─────────────────────────────────────────────────
describe('stagnant-lid — AC1 determinism + no-RNG + bounds + render-once', () => {
  it('no-RNG static source guard: no Math.random / Date.now', () => {
    expect(STAGNANT_SRC).not.toMatch(/Math\.random\s*\(/);
    expect(STAGNANT_SRC).not.toMatch(/Date\.now\s*\(/);
  });

  it('render-once: fixed relaxation bound, ZERO while-loops (analytic rift, no BFS), no convergence loop', () => {
    const { diag } = build(1);
    expect(diag.relaxPasses).toBe(RELAX_PASSES);
    expect(Number.isInteger(RELAX_PASSES)).toBe(true);
    expect(RELAX_PASSES).toBeGreaterThan(0);
    expect(RELAX_PASSES).toBeLessThanOrEqual(12);
    expect(STAGNANT_SRC).toMatch(/for\s*\(let pass = 0; pass < PASSES;/);
    const whileCount = (STAGNANT_SRC.match(/while\s*\(/g) || []).length;
    expect(whileCount).toBe(0);   // rift distance is ANALYTIC point-to-arc — no BFS, no while-loop anywhere
    expect(STAGNANT_SRC).not.toMatch(/while\s*\([^)]*(tol|eps|converg|residual|delta)/i);
  });

  it("uses the disjoint 'stagnant:' alea namespace (never plates:/shell:/e6:/magma:)", () => {
    expect(STAGNANT_SRC).toMatch(/alea\('stagnant:/);
    expect(STAGNANT_SRC).not.toMatch(/alea\('plates:/);
    expect(STAGNANT_SRC).not.toMatch(/alea\('shell:/);
    expect(STAGNANT_SRC).not.toMatch(/alea\('e6:/);
    expect(STAGNANT_SRC).not.toMatch(/alea\('magma:/);
  });

  it('byte-identical determinism across seeds (fresh carrier, run twice)', () => {
    for (const s of SEEDS) {
      const bm = () => { const c = carrierOf(); const diag = writeStagnantLidReliefSphere(c, {}, { macroSeed: s }); return { c, diag }; };
      const a = bm(), b = bm();
      const tag = `seed ${s}`;
      expect(Array.from(a.c.height), `${tag}: carrier.height`).toEqual(Array.from(b.c.height));
      expect(Array.from(a.c.grainAngle), `${tag}: carrier.grainAngle`).toEqual(Array.from(b.c.grainAngle));
      expect(Array.from(a.c.faultDensity), `${tag}: carrier.faultDensity`).toEqual(Array.from(b.c.faultDensity));
      expect(Array.from(a.diag.U), `${tag}: U`).toEqual(Array.from(b.diag.U));
      expect(Array.from(a.diag.resurfAge), `${tag}: resurfAge`).toEqual(Array.from(b.diag.resurfAge));
      expect(Array.from(a.diag.isTessera), `${tag}: isTessera`).toEqual(Array.from(b.diag.isTessera));
      expect(Array.from(a.diag.coronaActive), `${tag}: coronaActive`).toEqual(Array.from(b.diag.coronaActive));
      expect(a.diag.plumeCount, `${tag}: plumeCount`).toBe(b.diag.plumeCount);
      expect(a.diag.coronaCount, `${tag}: coronaCount`).toBe(b.diag.coronaCount);
    }
  });

  it('REPLACE: carrier.height === returned U; carrier.regime untouched (all zero, ∈ {0,1,2})', () => {
    const { c, diag } = build(1);
    expect(Array.from(c.height)).toEqual(Array.from(diag.U));
    for (let i = 0; i < c.regime.length; i++) expect(c.regime[i] === 0 || c.regime[i] === 1 || c.regime[i] === 2).toBe(true);
  });

  it('finite + bounded (|U| < STAGNANT_BOUND) + non-trivial, every seed', () => {
    for (const s of SEEDS) {
      const { diag } = build(s);
      let maxAbs = 0, finite = true;
      for (let i = 0; i < diag.U.length; i++) { const v = diag.U[i]; if (!Number.isFinite(v)) { finite = false; break; } maxAbs = Math.max(maxAbs, Math.abs(v)); }
      expect(finite, `seed ${s}: finite`).toBe(true);
      expect(maxAbs, `seed ${s}: maxAbs=${maxAbs.toFixed(3)} < ${STAGNANT_BOUND}`).toBeLessThan(STAGNANT_BOUND);
      expect(maxAbs, `seed ${s}: non-trivial`).toBeGreaterThan(0);
    }
  });

  it('DEFAULTS frozen; plumeCount band [PLUME_MIN, +SPAN)', () => {
    expect(Object.isFrozen(DEFAULTS)).toBe(true);
    for (const s of SEEDS) {
      const { diag } = build(s);
      expect(diag.plumeCount).toBeGreaterThanOrEqual(DEFAULTS.PLUME_MIN);
      expect(diag.plumeCount).toBeLessThan(DEFAULTS.PLUME_MIN + DEFAULTS.PLUME_SPAN);
    }
  });
});

// ── AC2 — structure bar (must PASS) ───────────────────────────────────────────────────────────────────
describe('stagnant-lid — AC2 structure bar', () => {
  it('(a) structure is plume-organized: |corr(structureMask, plumePredictor)| >= 0.40, every seed', () => {
    for (const s of SEEDS) {
      const { c, diag } = build(s);
      const r = structureCorr(c, diag);
      expect(r, `seed ${s}: |corr|=${r.toFixed(3)} (structure vs arm's-length plume field)`).toBeGreaterThanOrEqual(0.40);
    }
  });

  it('(b) tesseraFrac in [0.06,0.10] AND plainsFrac in [0.65,0.85], every seed', () => {
    for (const s of SEEDS) {
      const { diag } = build(s);
      expect(diag.tesseraFrac, `seed ${s}: tesseraFrac=${diag.tesseraFrac.toFixed(3)}`).toBeGreaterThanOrEqual(0.06);
      expect(diag.tesseraFrac, `seed ${s}: tesseraFrac=${diag.tesseraFrac.toFixed(3)}`).toBeLessThanOrEqual(0.10);
      expect(diag.plainsFrac, `seed ${s}: plainsFrac=${diag.plainsFrac.toFixed(3)}`).toBeGreaterThanOrEqual(0.65);
      expect(diag.plainsFrac, `seed ${s}: plainsFrac=${diag.plainsFrac.toFixed(3)}`).toBeLessThanOrEqual(0.85);
    }
  });

  it('(c) elevation ordering mean(tessera) > mean(plains) > mean(rift/active-trench low mask), every seed', () => {
    for (const s of SEEDS) {
      const { c, diag } = build(s);
      const mT = meanTessera(diag), mP = meanPlains(diag), mL = meanOverMask(diag.U, riftTrenchMask(c, diag));
      expect(mT, `seed ${s}: meanTessera=${mT.toFixed(4)} > meanPlains=${mP.toFixed(4)}`).toBeGreaterThan(mP);
      expect(mP, `seed ${s}: meanPlains=${mP.toFixed(4)} > meanRiftTrench=${mL.toFixed(4)}`).toBeGreaterThan(mL);
    }
  });

  it('(d) active/inactive morphology SELECTOR present (coronaContrib profile signs), pooled over seeds', () => {
    // active: interior dome (rho<0.5) > 0 > trench annulus (0.8<=rho<=1.05).
    // inactive: interior depression (rho<0.5) < 0 < raised rim (0.85<=rho<=1.05).
    let aInt = [], aTr = [], iInt = [], iRim = [];
    for (const s of SEEDS) {
      const { c, diag } = build(s);
      for (let cc = 0; cc < diag.coronaCount; cc++) {
        const ctr = diag.coronaCenters[cc], Rc = diag.coronaRadius[cc] || 1e-6, active = diag.coronaActive[cc];
        for (let i = 0; i < c.N; i++) {
          const rho = Math.acos(Math.max(-1, Math.min(1, v3dot(c.verts[i], ctr)))) / Rc;
          if (active) { if (rho < 0.5) aInt.push(diag.coronaContrib[i]); else if (rho >= 0.8 && rho <= 1.05) aTr.push(diag.coronaContrib[i]); }
          else { if (rho < 0.5) iInt.push(diag.coronaContrib[i]); else if (rho >= 0.85 && rho <= 1.05) iRim.push(diag.coronaContrib[i]); }
        }
      }
    }
    expect(mean(aInt), `active interior mean=${mean(aInt).toFixed(3)} > 0 (dome)`).toBeGreaterThan(0);
    expect(mean(aTr), `active trench-annulus mean=${mean(aTr).toFixed(3)} < 0 (trench)`).toBeLessThan(0);
    expect(mean(aInt), `active dome > active trench`).toBeGreaterThan(mean(aTr));
    expect(mean(iInt), `inactive interior mean=${mean(iInt).toFixed(3)} < 0 (depression)`).toBeLessThan(0);
    expect(mean(iRim), `inactive rim mean=${mean(iRim).toFixed(3)} > 0 (raised rim)`).toBeGreaterThan(0);
  });

  it('(e) activeFrac ~= CORONA_ACTIVE_FRAC (0.65) +/- 0.12, pooled over seeds', () => {
    let act = 0, tot = 0;
    for (const s of SEEDS) { const { diag } = build(s); for (let cc = 0; cc < diag.coronaCount; cc++) { act += diag.coronaActive[cc]; tot++; } }
    const frac = tot ? act / tot : 0;
    expect(frac, `pooled activeFrac=${frac.toFixed(3)} (n=${tot}) within 0.65 +/- 0.12`).toBeGreaterThan(0.53);
    expect(frac, `pooled activeFrac=${frac.toFixed(3)}`).toBeLessThan(0.77);
  });
});

// ── AC3 — latitude control (must FAIL) ────────────────────────────────────────────────────────────────
describe('stagnant-lid — AC3 latitude control (must FAIL to explain)', () => {
  it('varExplainedByLatitude < 0.15 AND < the plume signal, every seed', () => {
    for (const s of SEEDS) {
      const { c, diag } = build(s);
      const veLat = varExplained(latY(c), Array.from(diag.U));
      const vePlume = structureCorr(c, diag) ** 2;   // r^2 of the plume signal, same footing as veLat
      expect(veLat, `seed ${s}: veLatitude=${veLat.toFixed(3)}`).toBeLessThan(0.15);
      expect(veLat, `seed ${s}: veLat(${veLat.toFixed(3)}) < plume r^2(${vePlume.toFixed(3)})`).toBeLessThan(vePlume);
    }
  });
});

// ── AC4 — random-placement control (must FAIL) ────────────────────────────────────────────────────────
describe('stagnant-lid — AC4 random-placement control (must FAIL)', () => {
  // The rigorous, seed-robust falsifier: the real writer's structure is CAUSALLY plume-organized while the
  // random-placement control (tessera thresholded on independent noise + coronae accepted uniformly)
  // collapses. Real >> control is what proves it isn't a tautology.
  it('control collapses (|corr| < 0.15) and the real writer beats it decisively (>= 0.40 AND > 2x control), every seed', () => {
    for (const s of SEEDS) {
      const real = build(s, false), ctrl = build(s, true);
      const rR = structureCorr(real.c, real.diag), rC = structureCorr(ctrl.c, ctrl.diag);
      expect(rR, `seed ${s}: real |corr|=${rR.toFixed(3)} >= 0.40`).toBeGreaterThanOrEqual(0.40);
      expect(rC, `seed ${s}: control |corr|=${rC.toFixed(3)} < 0.15`).toBeLessThan(0.15);
      expect(rR, `seed ${s}: real(${rR.toFixed(3)}) > 2x control(${rC.toFixed(3)})`).toBeGreaterThan(2 * rC);
    }
  });
});

// ── AC5 — variety (distinct per world) ────────────────────────────────────────────────────────────────
describe('stagnant-lid — AC5 variety (plume + corona layout moves with the seed)', () => {
  const runs = SEEDS.map((s) => { const { diag } = build(s); return { s, plumeCount: diag.plumeCount, coronaCount: diag.coronaCount, isTessera: diag.isTessera }; });

  it('coronaCount is not-all-equal across the seed set (high-entropy variety)', () => {
    const set = new Set(runs.map((r) => r.coronaCount));
    expect(set.size, `coronaCounts = ${runs.map((r) => r.coronaCount).join(',')}`).toBeGreaterThan(1);
  });

  it('plumeCount shows variety across the seed set (not-all-equal)', () => {
    const set = new Set(runs.map((r) => r.plumeCount));
    expect(set.size, `plumeCounts = ${runs.map((r) => r.plumeCount).join(',')}`).toBeGreaterThan(1);
  });

  it('tessera pattern differs: < 0.2 node-overlap for at least one seed pair', () => {
    let minOverlap = 1;
    for (let i = 0; i < runs.length; i++) for (let j = i + 1; j < runs.length; j++) {
      const A = runs[i].isTessera, B = runs[j].isTessera;
      let inter = 0, uni = 0;
      for (let k = 0; k < A.length; k++) { if (A[k] && B[k]) inter++; if (A[k] || B[k]) uni++; }
      const overlap = uni ? inter / uni : 0; // Jaccard
      minOverlap = Math.min(minOverlap, overlap);
    }
    expect(minOverlap, `min tessera Jaccard overlap across pairs=${minOverlap.toFixed(3)}`).toBeLessThan(0.2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════════
// SLICE B — dispatch + seam (integration via writeBodyRelief / stagnantLidRegimeOf). The stagnant-lid
// branch is checked AFTER plate + shell + volcanic, so all three must stay byte-identical (zero-clobber).
// ═══════════════════════════════════════════════════════════════════════════════════════════════════
const relief = (c, opts) => writeBodyRelief(c, { grainDrivers: DEFAULT_GRAIN_DRIVERS, ...opts });
// Condition-bearing bundle for a representative preset (the shipped bundle17 idiom). deriveUniforms(fp,1.0)==QUALITY_TIER.
function condBundle(name, opts = {}) {
  const fp = DRIVER_PRESETS[name];
  const u = deriveUniforms(fp, 1.0);
  return {
    grainDrivers: DEFAULT_GRAIN_DRIVERS,
    bodyDrivers: { ...buildNeutralBodyDrivers(u, fp), condition: deriveConditionVector(fp, u, fp.radiusEarth) },
    ...opts,
  };
}
// The Lava-neutral drivers + its magma tune: the derived volcanic path is DRIVER-RESPONSIVE post-flip (V2-5s made
// the endogenic-heat writers driver-responsive), so a condition-bearing Lava carries a NON-null tune. The volcanic
// no-clobber reference below therefore applies that tune (the old tune-null reference was a condition-less artifact).
const LAVA_FP = DRIVER_PRESETS['Lava (hot airless)'];
const LAVA_NEUTRAL = buildNeutralBodyDrivers(deriveUniforms(LAVA_FP, 1.0), LAVA_FP);
const LAVA_TUNE = magmaDriversToTune(LAVA_NEUTRAL);

// EXACT references — same underlying writer + args + seed each dispatch branch uses.
function plateReference(macroSeed) { const c = carrierOf(); writePlateUpliftSphere(c, DEFAULT_GRAIN_DRIVERS, { macroSeed }); return c; }
function shellReference(macroSeed) { const c = carrierOf(); writeShellReliefSphere(c, DEFAULT_GRAIN_DRIVERS, { macroSeed, regime: 'icy-active' }); return c; }
function volcanicReference(macroSeed) { const c = carrierOf(); writeMagmatismSphere(c, LAVA_NEUTRAL, { macroSeed, locked: true, T_ss: 0, tune: LAVA_TUNE }); return c; }
function despunReference(macroSeed) { const c = carrierOf(); writeGrainSphere(c, DEFAULT_GRAIN_DRIVERS); writeHeightSphere(c, {}, DEFAULT_GRAIN_DRIVERS, { name: 'tectonic-build' }, 'e6:' + (macroSeed | 0)); return c; }

describe('stagnant-lid — AC6 no-clobber (plate / shell / volcanic / despun byte-identical; stagnantDiag null)', () => {
  it('terrestrial (Rocky) => path:plate, byte-identical, stagnantDiag null', () => {
    const s = 1; const ref = plateReference(s); const c = carrierOf();
    const out = relief(c, condBundle('Rocky (Earthlike)', { macroSeed: s, heightSeed: 'e6:' + s }));   // M12
    expect(out.path).toBe('plate');
    expect(out.stagnantDiag).toBe(null);
    expect(out.plateDiag).toBeTruthy();
    expect(Array.from(c.height)).toEqual(Array.from(ref.height));
  });
  it('ice (Europa) => path:shell, byte-identical, stagnantDiag null', () => {
    const s = 5; const ref = shellReference(s); const c = carrierOf();
    const out = relief(c, condBundle('Europa (icy moon)', { macroSeed: s, heightSeed: 'e6:' + s }));   // M12
    expect(out.path).toBe('shell');
    expect(out.stagnantDiag).toBe(null);
    expect(out.shellDiag).toBeTruthy();
    expect(out.shellDiag.regime).toBe('icy-active');
    expect(Array.from(c.height)).toEqual(Array.from(ref.height));
  });
  it('lava (Lava) => path:volcanic, byte-identical to the driver-responsive writer, stagnantDiag null', () => {
    // M12: Lava is intrinsically locked (no unlocked-lava preset); T_eq unset → T_ss=0. The volcanic field is
    // driver-responsive → byte-identical to volcanicReference (which applies LAVA_TUNE), not to a tune-null call.
    const s = 9; const ref = volcanicReference(s); const c = carrierOf();
    const out = relief(c, condBundle('Lava (hot airless)', { macroSeed: s, heightSeed: 'e6:' + s }));
    expect(out.path).toBe('volcanic');
    expect(out.stagnantDiag).toBe(null);
    expect(out.magmaDiag).toBeTruthy();
    expect(Array.from(c.height)).toEqual(Array.from(ref.height));
  });
  it('gas-giant (Jovian) => path:despun, byte-identical, stagnantDiag null', () => {
    const s = 3; const ref = despunReference(s); const c = carrierOf();
    const out = relief(c, condBundle('Gas giant (Jovian)', { macroSeed: s, heightSeed: 'e6:' + s }));   // M12
    expect(out.path).toBe('despun');
    expect(out.stagnantDiag).toBe(null);
    expect(Array.from(c.height)).toEqual(Array.from(ref.height));
  });
  it('carrier.regime stays in {0,1,2} on the stagnant-lid path (no 4th regime constant)', () => {
    const c = carrierOf();
    relief(c, condBundle('Venus (sulfuric shroud)', { macroSeed: 1, heightSeed: 'e6:1' }));   // M13
    for (let i = 0; i < c.regime.length; i++) expect(c.regime[i] === 0 || c.regime[i] === 1 || c.regime[i] === 2).toBe(true);
  });
});

describe('stagnant-lid — AC7 seam fires + single-coverage fragility (key-based, not locked-gated)', () => {
  it('stagnantLidRegimeOf: key-based, NOT locked-gated', () => {
    expect(stagnantLidRegimeOf('stagnant-lid', false)).toBe('venus-stagnant-lid');
    expect(stagnantLidRegimeOf('stagnant-lid', true)).toBe('venus-stagnant-lid');   // fires regardless of locked
    expect(stagnantLidRegimeOf('venus', false)).toBe('venus-stagnant-lid');          // long alias
    expect(stagnantLidRegimeOf(null)).toBe(null);
    expect(stagnantLidRegimeOf('terrestrial')).toBe(null);
    expect(stagnantLidRegimeOf('lava')).toBe(null);
  });
  // (R7, PRESET_ARCHETYPE-retirement) the `isStagnantLidPath fires only on the key` predicate truth-table `it`
  // is RETIRED with the four label-keyed predicates; the stagnantLidRegimeOf key-based `it` above SURVIVES
  // (its resolver is a writer-module export the intent explicitly blesses for test-oracle use).
  it('a body with the Venus condition routes to path:stagnant-lid (pure-strong lid → writeStagnantLidReliefSphere)', () => {
    // MIGRATED (PRESET_ARCHETYPE-retirement, was condition-less `archetype:'stagnant-lid'`): Venus → cls rocky,
    // no heat-pipe, unlocked, isUnbrokenLidPath → rule (3c) → router pure-strong → regime 'venus-stagnant-lid'.
    const c = carrierOf();
    const out = relief(c, condBundle('Venus (sulfuric shroud)', { macroSeed: 5, heightSeed: 'e6:5' }));
    expect(out.path).toBe('stagnant-lid');
    expect(out.stagnantDiag).toBeTruthy();
    expect(out.stagnantDiag.regime).toBe('venus-stagnant-lid');
    expect(out.plateDiag).toBe(null);
    expect(out.shellDiag).toBe(null);
    expect(out.magmaDiag).toBe(null);
    expect(c.height).not.toBeUndefined();
  });
  // (PRESET_ARCHETYPE-retirement) the `WITHOUT the PRESET_ARCHETYPE line ... => path:despun` single-coverage-
  // fragility `it` is RETIRED: it exercised the condition-LESS bridge fallback (null archetype → despun), which
  // is exactly the dispatch bridge being retired — post-retirement a condition-less caller THROWS, so there is
  // no condition-bearing analog (a null-archetype condition-bearing Venus routes to stagnant-lid, not despun).
  // PRESET_ARCHETYPE's SURVIVING load-bearing role (radius selection) is guarded by the dispatch-oracle GARBLE test.
});
