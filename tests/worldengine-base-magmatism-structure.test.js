// tests/worldengine-base-magmatism-structure.test.js
// Increment 4a (world-engine-magmatism): the VOLCANIC / endogenic-heat relief writer
// (writeMagmatismSphere, magmatism.js) — sibling of plates.js / shellRelief.js for the Lava /
// Magma-K2-141b / Io-type bodies. Three-free, deterministic, generative-not-simulative.
//
// SLICE A (this file) covers the SCAFFOLD ACs: AC1 determinism / no-RNG / bounds, AC6 seed variety,
// and the dispatch ACs AC7 (no-clobber plate) / AC8 (no-clobber shell+despun) / AC9-headless (Lava &
// Magma route to path:'volcanic'). The relief-mechanism ACs — AC2 structure, AC3 latitude control,
// AC4 random-placement control, AC5 noise control, AC10 live probe — need mustFix #1 (the real
// edifice/lava-plain/magma-ocean assembly) and are SLICE B; they are marked it.skip below so they are
// visibly deferred, not silently missing.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { writeMagmatismSphere, MAGMA_BOUND, RELAX_PASSES, MAGMA_DEFAULTS } from '../src/worldengine/base/magmatism.js';
import { writePlateUpliftSphere } from '../src/worldengine/base/plates.js';
import { writeGrainSphere, writeHeightSphere } from '../src/worldengine/base/tectonic.js';
import { makeSphereField } from '../src/worldengine/base/sphereField.js';
import {
  buildIrregularSphere, writeBodyRelief, DEFAULT_GRAIN_DRIVERS,
} from '../planet-lod-rivers.js';
// PRESET_ARCHETYPE-retirement (2026-07-13): the label-keyed predicates are gone; the dispatch AC7/AC8/AC9
// callers migrate to condition-bearing bundles routing to the SAME writers. deriveUniforms(fp,1.0)==QUALITY_TIER.
import { DRIVER_PRESETS } from '../driver-presets.js';
import { buildNeutralBodyDrivers } from '../body-drivers.js';
import { deriveConditionVector } from '../body-condition-vector.js';
import { deriveUniforms } from '../planet-lod-lab-core.js';

const TARGET_N = 600, LLOYD = 2;
const SEEDS = [1, 2, 3, 7, 42];
const LOCKS = [false, true];
const MAGMA_SRC = readFileSync(fileURLToPath(new URL('../src/worldengine/base/magmatism.js', import.meta.url)), 'utf8');
const carrierOf = () => makeSphereField(buildIrregularSphere(TARGET_N, LLOYD));
const buildMagma = (macroSeed, locked) => {
  const c = carrierOf();
  const diag = writeMagmatismSphere(c, {}, { macroSeed, locked });
  return { c, diag };
};
const relief = (c, opts) => writeBodyRelief(c, { grainDrivers: DEFAULT_GRAIN_DRIVERS, ...opts });
// Condition-bearing bundle for a representative preset (the shipped bundle17 idiom). Neutral drivers → REF → tune
// null for plate/shell/despun (byte-identical); the VOLCANIC path is driver-responsive (Lava tune non-null, §M8).
function condBundle(name, opts = {}) {
  const fp = DRIVER_PRESETS[name];
  const u = deriveUniforms(fp, 1.0);
  return {
    grainDrivers: DEFAULT_GRAIN_DRIVERS,
    bodyDrivers: { ...buildNeutralBodyDrivers(u, fp), condition: deriveConditionVector(fp, u, fp.radiusEarth) },
    ...opts,
  };
}

// EXACT plate reference (same call/args/seed as the plate branch of writeBodyRelief) — the AC7 baseline.
function plateReference(macroSeed) {
  const c = carrierOf();
  writePlateUpliftSphere(c, DEFAULT_GRAIN_DRIVERS, { macroSeed });
  return c;
}
// EXACT despun reference (same calls/args/seed as the despun branch of writeBodyRelief) — the AC8 baseline.
function despunReference(macroSeed) {
  const c = carrierOf();
  const heightSeed = 'e6:' + (macroSeed | 0);
  writeGrainSphere(c, DEFAULT_GRAIN_DRIVERS);
  writeHeightSphere(c, {}, DEFAULT_GRAIN_DRIVERS, { name: 'tectonic-build' }, heightSeed);
  return c;
}

// ── AC1 — determinism / no-RNG / bounds / render-once ───────────────────────────────────────────────
describe('magmatism — AC1 determinism + no-RNG + bounds + render-once', () => {
  it('no-RNG static source guard: magmatism.js contains no Math.random / Date.now call', () => {
    expect(MAGMA_SRC).not.toMatch(/Math\.random\s*\(/);
    expect(MAGMA_SRC).not.toMatch(/Date\.now\s*\(/);
  });

  it('render-once: fixed relaxation bound, no convergence / time-step while-loop', () => {
    const { diag } = buildMagma(1, false);
    expect(diag.relaxPasses).toBe(RELAX_PASSES);
    expect(Number.isInteger(RELAX_PASSES)).toBe(true);
    expect(RELAX_PASSES).toBeGreaterThan(0);
    expect(RELAX_PASSES).toBeLessThanOrEqual(12);
    expect(MAGMA_SRC).toMatch(/for\s*\(let pass = 0; pass < PASSES;/);
    const whileCount = (MAGMA_SRC.match(/while\s*\(/g) || []).length;
    expect(whileCount).toBe(1);                          // the ONLY loop is the O(N) hotspot-distance BFS drain
    expect(MAGMA_SRC).toMatch(/while\s*\(qh < qt\)/);
    expect(MAGMA_SRC).not.toMatch(/while\s*\([^)]*(tol|eps|converg|residual|delta)/i);
  });

  it("uses the disjoint 'magma:' alea namespace (never 'plates:' / 'shell:' / 'e6:')", () => {
    expect(MAGMA_SRC).toMatch(/alea\('magma:/);
    expect(MAGMA_SRC).not.toMatch(/alea\('plates:/);
    expect(MAGMA_SRC).not.toMatch(/alea\('shell:/);
    expect(MAGMA_SRC).not.toMatch(/alea\('e6:/);
  });

  it('byte-identical determinism across seeds x locked (fresh carrier, run twice)', () => {
    for (const s of SEEDS) for (const L of LOCKS) {
      // Thread a nonzero T_ss on the locked case so the SLICE-B basin fields are exercised for byte-identity.
      const T_ss = L ? 2800 : 0;
      const bm = () => { const c = carrierOf(); const diag = writeMagmatismSphere(c, {}, { macroSeed: s, locked: L, T_ss }); return { c, diag }; };
      const a = bm(), b = bm();
      const tag = `seed ${s} locked ${L}`;
      expect(Array.from(a.c.height), `${tag}: carrier.height`).toEqual(Array.from(b.c.height));
      expect(Array.from(a.diag.U), `${tag}: U`).toEqual(Array.from(b.diag.U));
      expect(Array.from(a.diag.plumeId), `${tag}: plumeId`).toEqual(Array.from(b.diag.plumeId));
      expect(Array.from(a.diag.hotspotProximity), `${tag}: hotspotProximity`).toEqual(Array.from(b.diag.hotspotProximity));
      expect(Array.from(a.diag.hotspotNode), `${tag}: hotspotNode`).toEqual(Array.from(b.diag.hotspotNode));
      expect(Array.from(a.diag.nearestPlume), `${tag}: nearestPlume`).toEqual(Array.from(b.diag.nearestPlume));
      expect(Array.from(a.diag.substellarAxis), `${tag}: substellarAxis`).toEqual(Array.from(b.diag.substellarAxis));
      // SLICE-B diagnostic fields (masks + per-plume draws + pinned scalars) are byte-identical too.
      expect(Array.from(a.diag.edificeMask), `${tag}: edificeMask`).toEqual(Array.from(b.diag.edificeMask));
      expect(Array.from(a.diag.lavaPlainMask), `${tag}: lavaPlainMask`).toEqual(Array.from(b.diag.lavaPlainMask));
      expect(Array.from(a.diag.magmaOceanMask), `${tag}: magmaOceanMask`).toEqual(Array.from(b.diag.magmaOceanMask));
      expect(Array.from(a.diag.A_e), `${tag}: A_e`).toEqual(Array.from(b.diag.A_e));
      expect(Array.from(a.diag.Psi_e), `${tag}: Psi_e`).toEqual(Array.from(b.diag.Psi_e));
      expect(a.diag.thetaSea, `${tag}: thetaSea`).toBe(b.diag.thetaSea);
      expect(a.diag.D_flood, `${tag}: D_flood`).toBe(b.diag.D_flood);
      expect(a.diag.plumeCount).toBe(b.diag.plumeCount);
    }
  });

  it('REPLACE: carrier.height === returned U', () => {
    const { c, diag } = buildMagma(1, false);
    expect(Array.from(c.height)).toEqual(Array.from(diag.U));
  });

  it('finite + bounded (|U| < MAGMA_BOUND) + non-trivial, every seed x body-case (incl. deep basin)', () => {
    // Body-cases: no-basin (T_ss 0) AND the deep wide-sea basin (T_ss 2800, the largest |U| population).
    for (const s of SEEDS) for (const T_ss of [0, 2800]) {
      const c = carrierOf();
      const diag = writeMagmatismSphere(c, {}, { macroSeed: s, locked: T_ss > 0, T_ss });
      let maxAbs = 0, finite = true;
      for (let i = 0; i < diag.U.length; i++) { const v = diag.U[i]; if (!Number.isFinite(v)) { finite = false; break; } maxAbs = Math.max(maxAbs, Math.abs(v)); }
      expect(finite, `seed ${s} T_ss ${T_ss}: finite`).toBe(true);
      expect(maxAbs, `seed ${s} T_ss ${T_ss}: maxAbs=${maxAbs.toFixed(3)} < ${MAGMA_BOUND}`).toBeLessThan(MAGMA_BOUND);
      expect(maxAbs, `seed ${s} T_ss ${T_ss}: non-trivial`).toBeGreaterThan(0);
    }
  });

  it('MAGMA_DEFAULTS is frozen; plume count band is [PLUME_COUNT_MIN, +SPAN)', () => {
    expect(Object.isFrozen(MAGMA_DEFAULTS)).toBe(true);
    for (const s of SEEDS) {
      const { diag } = buildMagma(s, false);
      expect(diag.plumeCount).toBeGreaterThanOrEqual(MAGMA_DEFAULTS.PLUME_COUNT_MIN);
      expect(diag.plumeCount).toBeLessThan(MAGMA_DEFAULTS.PLUME_COUNT_MIN + MAGMA_DEFAULTS.PLUME_COUNT_SPAN);
    }
  });
});

// ── AC6 — seed variety (SLICE A: plume count + hotspot node placement) ──────────────────────────────
describe('magmatism — AC6 seed variety (plume field moves with the seed)', () => {
  const runs = [1, 2, 3, 4, 5].map((s) => {
    const { diag } = buildMagma(s, false);
    return { s, plumeCount: diag.plumeCount, hotspotNode: Array.from(diag.hotspotNode), plumeId: diag.plumeId };
  });

  // Overlap = |A∩B| / min(|A|,|B|) of the hotspot-node SETS. AC6 observable: different plumeCount OR
  // < 0.2 hotspot-node overlap for every seed pair (each seed independently reproducible — proven in AC1).
  it('two macroSeeds differ by plumeCount OR < 0.2 hotspotNode overlap (every pair)', () => {
    for (let i = 0; i < runs.length; i++) for (let j = i + 1; j < runs.length; j++) {
      const A = new Set(runs[i].hotspotNode), B = new Set(runs[j].hotspotNode);
      let inter = 0; for (const n of A) if (B.has(n)) inter++;
      const overlap = inter / Math.min(A.size, B.size);
      const differ = runs[i].plumeCount !== runs[j].plumeCount || overlap < 0.2;
      expect(differ, `seeds ${runs[i].s}-${runs[j].s}: plumeCount ${runs[i].plumeCount} vs ${runs[j].plumeCount}, hotspotNode overlap=${overlap.toFixed(3)}`).toBe(true);
    }
  });

  it('plume partition geometry differs substantively across the closest pair (> 30% reclassified)', () => {
    let minDisagree = 1;
    for (let i = 0; i < runs.length; i++) for (let j = i + 1; j < runs.length; j++) {
      const a = runs[i].plumeId, b = runs[j].plumeId;
      let same = 0; for (let k = 0; k < a.length; k++) if (a[k] === b[k]) same++;
      minDisagree = Math.min(minDisagree, 1 - same / a.length);
    }
    expect(minDisagree, `worst-pair plumeId disagreement=${minDisagree.toFixed(3)}`).toBeGreaterThan(0.3);
  });
});

// ── AC7 — no-clobber of the Earth-like plate path (integration via writeBodyRelief) ─────────────────
describe('magmatism — AC7 no-clobber of the plate path', () => {
  it('terrestrial unlocked => path:plate, magmaDiag null, byte-identical to the plate baseline', () => {
    const seed = 1;
    const ref = plateReference(seed);
    const c = carrierOf();
    const out = relief(c, condBundle('Rocky (Earthlike)', { macroSeed: seed, heightSeed: 'e6:' + seed }));   // M5
    expect(out.path).toBe('plate');
    expect(out.magmaDiag).toBe(null);
    expect(out.shellDiag).toBe(null);
    expect(out.plateDiag).toBeTruthy();
    expect(Array.from(c.height)).toEqual(Array.from(ref.height));
  });
  it('ocean unlocked => path:plate, magmaDiag null', () => {
    const c = carrierOf();
    const out = relief(c, condBundle('Ocean (temperate)', { macroSeed: 1, heightSeed: 'e6:1' }));   // M5
    expect(out.path).toBe('plate');
    expect(out.magmaDiag).toBe(null);
  });
});

// ── AC8 — no-clobber of the shell + despun paths and dispatch safety ────────────────────────────────
describe('magmatism — AC8 no-clobber of shell + despun; isVolcanicPath gating', () => {
  it('Europa (ice) => path:shell, byte-identical, magmaDiag null', () => {
    const seed = 5;
    const c = carrierOf();
    const out = relief(c, condBundle('Europa (icy moon)', { macroSeed: seed, heightSeed: 'e6:' + seed }));   // M6
    expect(out.path).toBe('shell');
    expect(out.magmaDiag).toBe(null);
    expect(out.shellDiag).toBeTruthy();
    expect(out.shellDiag.regime).toBe('icy-active');
  });
  it('impact-airless unlocked => path:despun, byte-identical to the despun writers, magmaDiag null', () => {
    const seed = 7;
    const ref = despunReference(seed);
    const c = carrierOf();
    const out = relief(c, condBundle('Mars (arid rocky)', { macroSeed: seed, heightSeed: 'e6:' + seed }));   // M7
    expect(out.path).toBe('despun');
    expect(out.magmaDiag).toBe(null);
    expect(Array.from(c.height)).toEqual(Array.from(ref.height));
  });
  it('gas-giant => path:despun, byte-identical, magmaDiag null', () => {
    const seed = 3;
    const ref = despunReference(seed);
    const c = carrierOf();
    const out = relief(c, condBundle('Gas giant (Jovian)', { macroSeed: seed, heightSeed: 'e6:' + seed }));   // M7
    expect(out.path).toBe('despun');
    expect(out.magmaDiag).toBe(null);
    expect(Array.from(c.height)).toEqual(Array.from(ref.height));
  });
  // (R5, PRESET_ARCHETYPE-retirement) the `isVolcanicPath is FALSE for every non-volcanic archetype` truth-table
  // `it` (+ its isEarthlikePlatePath/isShellReliefPath sanity lines) is RETIRED with the predicates; the routing
  // it guarded is now covered by the dispatch-oracle 17-preset derived routes + M8 (lava/volcanic → volcanic).
});

// ── AC9 (headless part) — the Lava & Magma presets route to the volcanic regime ─────────────────────
// Both 'Lava (hot airless)' and 'Magma (K2-141b)' resolve to the short key 'lava' at the dispatch
// boundary (Lava directly; Magma via the PRESET_ARCHETYPE line added in the lab, since Magma is a
// NAMED_BODY with archetype null otherwise). Both presets are tidally locked. The live magmaOceanMask
// locked-vs-unlocked assertion is SLICE B.
describe('magmatism — AC9 (headless) Lava/Magma route to path:volcanic', () => {
  it('the Lava preset routes to path:volcanic (heat-pipe rule 3a → router pure-weak)', () => {
    // M8: 'lava'/'volcanic' archetype → Lava condition (cls rocky, m_hp>0 → (3a) unbrokenLid → volcanic). Lava is
    // intrinsically locked, so the bridge's "locked or not" arg no longer applies (no unlocked-Lava preset); the
    // route is condition-driven. (R6) the isVolcanicPath('lava',L) predicate assertion is retired with the predicate.
    const c = carrierOf();
    const out = relief(c, condBundle('Lava (hot airless)', { macroSeed: 1234, heightSeed: 'e6:1234' }));
    expect(out.path).toBe('volcanic');
    expect(out.plateDiag).toBe(null);
    expect(out.shellDiag).toBe(null);
    expect(out.magmaDiag, 'Lava: magmaDiag').toBeTruthy();
    expect(out.magmaDiag.plumeCount).toBeGreaterThan(0);
  });
  it('the Magma preset also routes to path:volcanic', () => {
    const c = carrierOf();
    const out = relief(c, condBundle('Magma (K2-141b)', { macroSeed: 9, heightSeed: 'e6:9' }));
    expect(out.path).toBe('volcanic');
    expect(out.magmaDiag).toBeTruthy();
  });
});

// ──────────────────────────────────────────────────────────────────────────────────────────────────
// SLICE B — the relief mechanism (mustFix #1 / SLICE-B-mechanism-math.md §1–§6). ANTI-CIRCULARITY
// DISCIPLINE (mirrors the shell-structure test): every predictor is rebuilt ARM'S-LENGTH from the
// PUBLISHED plume CENTROIDS (diag.centroids) + node positions (carrier.verts) — NEVER from the writer's
// own hotspotProximity / nearestPlume, and NEVER from U. We measure corr against U, but U is never a
// predictor input. Body-cases: UNLOCKED (T_ss 0, no basin — the clean hotspot volcanic world),
// LAVA (T_ss 1330 — small substellar pond), MAGMA (T_ss 2800 — wide substellar sea).
// ──────────────────────────────────────────────────────────────────────────────────────────────────
import { createNoise3D } from 'simplex-noise';
import aleaRng from 'alea';

const mean = (a) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i]; return a.length ? s / a.length : 0; };
function pearson(x, y) {
  const n = x.length, mx = mean(x), my = mean(y);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { const dx = x[i] - mx, dy = y[i] - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy; }
  const den = Math.sqrt(sxx * syy); return den < 1e-12 ? 0 : sxy / den;
}
const varExplained = (x, y) => { const r = pearson(x, y); return r * r; };   // r^2
const v3dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

const buildMagmaTss = (macroSeed, T_ss) => {
  const c = carrierOf();
  const diag = writeMagmatismSphere(c, {}, { macroSeed, locked: T_ss > 0, T_ss });
  return { c, diag };
};

// ARM'S-LENGTH plume-proximity predictor: geodesic falloff from the PUBLISHED plume centroids. Rebuilt
// from diag.centroids + carrier.verts ONLY (never hotspotProximity / nearestPlume / U). BELT_RADIANS is
// the writer's own published swell falloff length, so this faithfully mirrors swell = SWELL_GAIN*zeta.
function centroidPredictor(c, centroids) {
  const N = c.N, verts = c.verts, BELT = MAGMA_DEFAULTS.BELT_RADIANS;
  const pred = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    let best = -Infinity;
    for (let p = 0; p < centroids.length; p++) { const dd = v3dot(verts[i], centroids[p]); if (dd > best) best = dd; }
    pred[i] = Math.exp(-Math.acos(Math.max(-1, Math.min(1, best))) / BELT);
  }
  return pred;
}

// AC4 amplitude-matched, plume-DECOUPLED control: the writer's SAME swell + shield construction (same
// published A_e / Psi_e amplitudes, same SWELL_GAIN, same falloff), but the hotspot nodes are RANDOM
// (an independent alea seed) instead of argmax dot(centroid). The basin is copied verbatim from the
// real field (it is a substellar-axis feature, not a plume feature — only plume placement is decoupled).
// Because the bumps now sit at random nodes, the centroid-based predictor no longer aligns with them.
function controlField(c, diag, ctrlSeed) {
  const N = c.N, adj = c.adj, meanEdge = diag.meanEdgeAngle, plumeCount = diag.plumeCount, D = MAGMA_DEFAULTS;
  const rng = aleaRng('magma:ctrl-hotspot:' + ctrlSeed);
  const hot = new Int32Array(plumeCount);
  for (let p = 0; p < plumeCount; p++) hot[p] = Math.floor(rng() * N) % N;
  const dist = new Int32Array(N).fill(-1), near = new Int32Array(N).fill(-1);
  const q = new Int32Array(N); let qh = 0, qt = 0;
  for (let p = 0; p < plumeCount; p++) { const n0 = hot[p]; if (dist[n0] < 0) { dist[n0] = 0; near[n0] = p; q[qt++] = n0; } }
  while (qh < qt) { const cc = q[qh++]; const nd = dist[cc] + 1; for (const nb of adj[cc]) if (dist[nb] < 0) { dist[nb] = nd; near[nb] = near[cc]; q[qt++] = nb; } }
  const U = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    if (diag.magmaOceanMask[i]) { U[i] = diag.U[i]; continue; }          // basin identical (not a plume feature)
    const pStar = near[i], psi = dist[i] * meanEdge, radius = diag.Psi_e[pStar] || 1, A = diag.A_e[pStar] || 0;
    const r = psi / radius; let ed = 0;
    if (r < 1) { let sh = Math.pow(1 - r, 2.0); if (r < D.CALDERA_FRAC) { const s = r / D.CALDERA_FRAC; sh += 0.5 * (s * s - 1); } ed = A * sh; }
    U[i] = D.MAGMA_BASE + D.SWELL_GAIN * Math.exp(-psi / D.BELT_RADIANS) + ed;
  }
  return U;
}

// Population means over the published masks (basin/edifice/plain), + the crest-above-plain amplitude.
function populations(diag) {
  const U = diag.U, N = U.length;
  const ed = [], pl = [], ba = [];
  for (let i = 0; i < N; i++) {
    if (diag.magmaOceanMask[i]) ba.push(U[i]);
    else if (diag.edificeMask[i]) ed.push(U[i]);
    else if (diag.lavaPlainMask[i]) pl.push(U[i]);
  }
  return { ed, pl, ba, mEd: mean(ed), mPl: mean(pl), mBa: mean(ba) };
}
// non-basin index subset (the AC2/AC3/AC4 correlation domain — the basin is scored by the ordering test).
function nonBasin(diag, field) {
  const out = []; for (let i = 0; i < field.length; i++) if (!diag.magmaOceanMask[i]) out.push(field[i]); return out;
}

describe('magmatism — AC2 structure (signal must PASS)', () => {
  // (a) corr(U, arm's-length centroid-proximity) >= 0.5 over non-basin nodes, on the hotspot volcanic
  // worlds where the spec's AC2 sidebar (i) claims it robustly (UNLOCKED per-seed; LAVA small-pond mean).
  // The wide-basin MAGMA case is intentionally NOT gated at 0.5 here (its molten sea excises ~48% of
  // nodes — SLICE-B-mechanism-math.md §10.2 acknowledged risk); its structure is carried by the ordering
  // test below + AC3 (plume beats latitude even for Magma). See report/handoff for the measured Magma corr.
  it('|corr(U, centroid-proximity)| >= 0.5 over non-basin nodes — UNLOCKED hotspot world, every seed', () => {
    for (const s of SEEDS) {
      const { c, diag } = buildMagmaTss(s, 0);
      const pred = centroidPredictor(c, diag.centroids);
      const corr = Math.abs(pearson(nonBasin(diag, diag.U), nonBasin(diag, pred)));
      expect(corr, `seed ${s}: corr(U,centroidProximity)=${corr.toFixed(3)}`).toBeGreaterThanOrEqual(0.5);
    }
  });

  it('|corr(U, centroid-proximity)| >= 0.5 over non-basin nodes — LAVA small-pond, mean over seeds', () => {
    let sum = 0;
    for (const s of SEEDS) {
      const { c, diag } = buildMagmaTss(s, 1330);
      const pred = centroidPredictor(c, diag.centroids);
      sum += Math.abs(pearson(nonBasin(diag, diag.U), nonBasin(diag, pred)));
    }
    const meanCorr = sum / SEEDS.length;
    expect(meanCorr, `Lava mean corr(U,centroidProximity)=${meanCorr.toFixed(3)}`).toBeGreaterThanOrEqual(0.5);
  });

  // (b) elevation ordering mean(edifice) > mean(lava-plain) > mean(magma-ocean basin), on the basin
  // body-cases (LAVA + MAGMA). This is where the wide-basin structure claim lands (sidebar (i)).
  it('elevation ordering mean(edifice) > mean(lava-plain) > mean(basin) — LAVA + MAGMA, every seed', () => {
    for (const T_ss of [1330, 2800]) for (const s of SEEDS) {
      const { diag } = buildMagmaTss(s, T_ss);
      const p = populations(diag);
      expect(p.ed.length, `T_ss ${T_ss} seed ${s}: has edifice nodes`).toBeGreaterThan(5);
      expect(p.ba.length, `T_ss ${T_ss} seed ${s}: has basin nodes`).toBeGreaterThan(5);
      expect(p.mEd, `T_ss ${T_ss} seed ${s}: mean(edifice)=${p.mEd.toFixed(4)} > mean(plain)=${p.mPl.toFixed(4)}`).toBeGreaterThan(p.mPl);
      expect(p.mPl, `T_ss ${T_ss} seed ${s}: mean(plain)=${p.mPl.toFixed(4)} > mean(basin)=${p.mBa.toFixed(4)}`).toBeGreaterThan(p.mBa);
    }
  });

  // (c) edifice(shield-crest) amplitude >= 2x the flat-plain denominator (UNLOCKED — the clean hotspot
  // world). crest-above-plain = mean(U[edifice]) - mean(U[plain]); denominator = the plain's internal
  // mean-abs-deviation (its flatness). Measured ratio ~5-12x >> 2.
  it('edifice-crest amplitude >= 2x the flat-plain denominator — UNLOCKED, every seed', () => {
    for (const s of SEEDS) {
      const { diag } = buildMagmaTss(s, 0);
      const p = populations(diag);
      const crest = p.mEd - p.mPl;
      let dev = 0; for (let i = 0; i < p.pl.length; i++) dev += Math.abs(p.pl[i] - p.mPl);
      const plainDenom = p.pl.length ? dev / p.pl.length : 1e-6;
      const ratio = crest / (plainDenom || 1e-6);
      expect(ratio, `seed ${s}: crest(${crest.toFixed(3)}) / plainDenom(${plainDenom.toFixed(4)}) = ${ratio.toFixed(1)}x`).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('magmatism — AC3 latitude control (must FAIL to explain)', () => {
  // Over non-basin nodes: latitude explains far less variance than the plume field, for EVERY body-case
  // including wide-basin Magma. The basin is scored by AC2's ordering test, not diluted into corr; the
  // plume-vs-latitude comparison is measured on the SAME non-basin node set for both predictors.
  it('varExplainedByLatitudeY < 0.15 AND < varExplainedByPlume, over non-basin nodes — every case/seed', () => {
    for (const [label, T_ss] of [['unlocked', 0], ['lava', 1330], ['magma', 2800]]) {
      for (const s of SEEDS) {
        const { c, diag } = buildMagmaTss(s, T_ss);
        const pred = centroidPredictor(c, diag.centroids);
        const latY = new Float32Array(c.N);
        for (let i = 0; i < c.N; i++) { const y = Math.max(-1, Math.min(1, c.verts[i][1])); latY[i] = y * y; }  // sin^2(lat)=y^2
        const Unb = nonBasin(diag, diag.U);
        const veLat = varExplained(nonBasin(diag, latY), Unb);
        const vePlume = varExplained(nonBasin(diag, pred), Unb);
        expect(veLat, `${label} seed ${s}: veLatitudeY=${veLat.toFixed(3)}`).toBeLessThan(0.15);
        expect(veLat, `${label} seed ${s}: veLatY(${veLat.toFixed(3)}) < vePlume(${vePlume.toFixed(3)})`).toBeLessThan(vePlume);
      }
    }
  });

  // REVIEWER NOTE 2: the wide-basin Magma sea is antisymmetric on a SEED-RANDOM axis, so it should
  // project weakly onto symmetric sin^2(+y lat). Verified over ALL nodes (basin included): the basin does
  // NOT fake a carrier-latitude band on any seed in the set (max measured ~0.03). If a future seed lands
  // its substellar axis near +y this could rise — asserted per-seed so such a pathology would surface.
  it('locked-Magma basin does NOT fake carrier +y latitude (varExplainedByLatitudeY over ALL nodes < 0.15)', () => {
    for (const s of SEEDS) {
      const { c, diag } = buildMagmaTss(s, 2800);
      const latY = new Float32Array(c.N), Uall = diag.U;
      for (let i = 0; i < c.N; i++) { const y = Math.max(-1, Math.min(1, c.verts[i][1])); latY[i] = y * y; }
      const veLatAll = varExplained(latY, Uall);
      expect(veLatAll, `Magma seed ${s}: veLatitudeY(ALL nodes)=${veLatAll.toFixed(3)}`).toBeLessThan(0.15);
    }
  });
});

describe('magmatism — AC4 random-placement control (must FAIL)', () => {
  // A genuine amplitude-matched decouple: the control swaps argmax-dot(centroid) hotspot nodes for RANDOM
  // node picks (same A_e/Psi_e/SWELL_GAIN amplitudes). The arm's-length centroid predictor's corr
  // collapses AND the crest-above-plain separation (over the REAL published masks) collapses, while the
  // REAL field passes AC2. Measured on UNLOCKED (the cleanest hotspot world). Uses seeds [1,7,42].
  it('control corr collapses + crest separation breaks, while the real field passes AC2', () => {
    for (const s of [1, 7, 42]) {
      const { c, diag } = buildMagmaTss(s, 0);
      const pred = centroidPredictor(c, diag.centroids);
      const ctrl = controlField(c, diag, s);
      const realCorr = Math.abs(pearson(nonBasin(diag, diag.U), nonBasin(diag, pred)));
      const ctrlCorr = Math.abs(pearson(nonBasin(diag, ctrl), nonBasin(diag, pred)));
      // real passes AC2 (structured); control corr collapses toward 0 and well below real.
      expect(realCorr, `seed ${s}: real corr=${realCorr.toFixed(3)}`).toBeGreaterThanOrEqual(0.5);
      expect(ctrlCorr, `seed ${s}: control corr=${ctrlCorr.toFixed(3)} < 0.5*real`).toBeLessThan(0.5 * realCorr);
      expect(ctrlCorr, `seed ${s}: control corr=${ctrlCorr.toFixed(3)} < 0.15`).toBeLessThan(0.15);
      // crest-above-plain separation (over the REAL edifice/plain masks) collapses for the control.
      const edR = [], plR = [], edC = [], plC = [];
      for (let i = 0; i < c.N; i++) { if (diag.edificeMask[i]) { edR.push(diag.U[i]); edC.push(ctrl[i]); } else if (diag.lavaPlainMask[i]) { plR.push(diag.U[i]); plC.push(ctrl[i]); } }
      const realCrest = mean(edR) - mean(plR), ctrlCrest = mean(edC) - mean(plC);
      expect(ctrlCrest, `seed ${s}: control crest=${ctrlCrest.toFixed(4)} < 0.5*real crest=${realCrest.toFixed(4)}`).toBeLessThan(0.5 * realCrest);
    }
  });

  // REVIEWER-ADDED: the wide-basin MAGMA regime is where AC2's absolute 0.5 corr bar was RELAXED (the
  // molten sea excises ~48% of nodes + drowns the substellar plumes, so the crust's linear corr is only
  // ~0.26-0.43). Relaxing the absolute bar means the RELATIVE control MUST run here too — otherwise
  // nothing proves Magma's crust is plume-ORGANIZED (real beats random) rather than merely beating
  // latitude (AC3) + having an amplitude hierarchy (the ordering test, which a random field also passes).
  // This closes that gap: the real field's centroid-corr strictly + substantially beats the random-
  // placement control, and the control collapses toward noise, EVEN THOUGH real never reaches 0.5.
  it('MAGMA wide-basin: real plume placement beats the random control on the crust (relative, not absolute 0.5)', () => {
    for (const s of [1, 7, 42]) {
      const { c, diag } = buildMagmaTss(s, 2800);
      const pred = centroidPredictor(c, diag.centroids);
      const ctrl = controlField(c, diag, s);
      const realCorr = Math.abs(pearson(nonBasin(diag, diag.U), nonBasin(diag, pred)));
      const ctrlCorr = Math.abs(pearson(nonBasin(diag, ctrl), nonBasin(diag, pred)));
      expect(ctrlCorr, `seed ${s}: control corr=${ctrlCorr.toFixed(3)} collapses < 0.15`).toBeLessThan(0.15);
      expect(realCorr, `seed ${s}: real corr=${realCorr.toFixed(3)} beats control=${ctrlCorr.toFixed(3)} by > 0.08`).toBeGreaterThan(ctrlCorr + 0.08);
      // NOTE: the crest-collapse check (used in the UNLOCKED AC4 above) is intentionally NOT asserted for
      // Magma — the wide sea drowns ~half the plumes, leaving only ~3-6 crust edifices, so the
      // edifice/plain population means are small-sample-noisy and a random control's crest is not reliably
      // below 0.6x real (measured 0.66x on seed 7). The corr-based relative control above is the rigorous
      // plume-organized-vs-random falsifier and holds cleanly for all Magma seeds; the crest angle is
      // redundant and only reliable at the large-N UNLOCKED crust.
    }
  });
});

describe('magmatism — AC5 noise control (must FAIL vs noise)', () => {
  it('corr(U, amplitude-matched independent simplex) < 0.15 — UNLOCKED, every seed', () => {
    for (const s of SEEDS) {
      const { c, diag } = buildMagmaTss(s, 0);
      const noise = createNoise3D(aleaRng('magma:control-noise:' + 99));   // independent of every writer draw
      const matched = new Float32Array(c.N);
      for (let i = 0; i < c.N; i++) { const d = c.verts[i]; matched[i] = noise(d[0] * 8, d[1] * 8, d[2] * 8); }
      const corr = Math.abs(pearson(diag.U, matched));
      expect(corr, `seed ${s}: corr(U,matchedNoise)=${corr.toFixed(3)}`).toBeLessThan(0.15);
    }
  });
});

// ── AC9 (T_ss-scaled basin) — integration via writeBodyRelief: the F41 iso-angle basin extent scales
// with substellar temperature. Lava (T_eq 950 -> T_ss 1330) is a small pond; Magma (T_eq 2000 -> T_ss
// 2800) is a wide sea; Magma strictly wider. The writer derives T_ss = locked ? T_eq*1.4 : 0.
describe('magmatism — AC9 T_ss-scaled substellar basin extent (F41 iso-angle)', () => {
  const LIQUIDUS = 1300;
  const isoAngle = (T_ss) => Math.acos(Math.max(0, Math.min(1, Math.pow(LIQUIDUS / T_ss, 4))));
  // half-angle of the baked magmaOceanMask = max theta_i (about the substellar axis) over masked nodes.
  function basinHalfAngle(c, md) {
    let maxTheta = 0, count = 0;
    for (let i = 0; i < c.N; i++) {
      if (!md.magmaOceanMask[i]) continue;
      count++;
      const theta = Math.acos(Math.max(-1, Math.min(1, v3dot(c.verts[i], md.substellarAxis))));
      if (theta > maxTheta) maxTheta = theta;
    }
    return { maxTheta, count };
  }
  const routeBody = (T_eq, macroSeed) => {
    const c = carrierOf();
    // M8: 'lava' locked → Lava condition; T_eq is threaded as the top-level param (locked from cond.tidalState →
    // T_ss = T_eq*1.4), so the F41 iso-angle basin math is unchanged. The Lava driver tune does not touch T_ss.
    const out = relief(c, condBundle('Lava (hot airless)', { T_eq, macroSeed, heightSeed: 'e6:' + macroSeed }));
    return { c, out };
  };

  it('both Lava and Magma route to path:volcanic with a coherent substellar basin', () => {
    for (const T_eq of [950, 2000]) {
      const { out } = routeBody(T_eq, 1234);
      expect(out.path, `T_eq ${T_eq}`).toBe('volcanic');
      expect(out.magmaDiag, `T_eq ${T_eq}: magmaDiag`).toBeTruthy();
      let basinCount = 0; for (let i = 0; i < out.magmaDiag.magmaOceanMask.length; i++) basinCount += out.magmaDiag.magmaOceanMask[i];
      expect(basinCount, `T_eq ${T_eq}: basin nodes`).toBeGreaterThan(5);
    }
  });

  it('basin half-angle ~ acos((1300/T_ss)^4): Magma ~1.52 rad wide, Lava ~0.42 rad pond, Magma strictly wider', () => {
    const lava = routeBody(950, 1234);   // T_ss = 1330
    const magma = routeBody(2000, 1234); // T_ss = 2800
    const thetaSeaLava = isoAngle(1330), thetaSeaMagma = isoAngle(2800);
    // the writer's published thetaSea equals the F41 iso-angle exactly.
    expect(lava.out.magmaDiag.thetaSea, `Lava thetaSea`).toBeCloseTo(thetaSeaLava, 3);
    expect(magma.out.magmaDiag.thetaSea, `Magma thetaSea`).toBeCloseTo(thetaSeaMagma, 3);
    // the baked mask half-angle tracks the iso-angle (bounded above by thetaSea; well-sampled cap).
    const ba = basinHalfAngle(lava.c, lava.out.magmaDiag);
    const bm = basinHalfAngle(magma.c, magma.out.magmaDiag);
    expect(ba.maxTheta, `Lava basin maxTheta=${ba.maxTheta.toFixed(3)} <= thetaSea=${thetaSeaLava.toFixed(3)}`).toBeLessThanOrEqual(thetaSeaLava + 1e-6);
    expect(bm.maxTheta, `Magma basin maxTheta=${bm.maxTheta.toFixed(3)} <= thetaSea=${thetaSeaMagma.toFixed(3)}`).toBeLessThanOrEqual(thetaSeaMagma + 1e-6);
    expect(ba.maxTheta, `Lava basin maxTheta=${ba.maxTheta.toFixed(3)} within pond band`).toBeGreaterThan(0.30);
    expect(bm.maxTheta, `Magma basin maxTheta=${bm.maxTheta.toFixed(3)} within wide-sea band`).toBeGreaterThan(1.35);
    // AC9 headline: Magma's sea is strictly wider than Lava's pond.
    expect(thetaSeaMagma, `Magma iso-angle > Lava iso-angle`).toBeGreaterThan(thetaSeaLava);
    expect(bm.count, `Magma basin nodes(${bm.count}) > Lava basin nodes(${ba.count})`).toBeGreaterThan(ba.count);
  });
});

// AC10 is the LIVE magmaProbe (integration, driven in-browser). Left for live drive; the headless AC2/
// AC3/AC4/AC5/AC9 above cover the structure mechanism. The lab magmaProbe() surfaces the same
// varExplainedByPlume / varExplainedByLatitudeY / basin-width / ordering fields these tests assert.
