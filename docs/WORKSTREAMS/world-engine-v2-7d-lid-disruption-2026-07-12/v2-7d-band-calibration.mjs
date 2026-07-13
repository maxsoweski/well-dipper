// v2-7d-band-calibration.mjs — STATISTIC-BAND CALIBRATION probe for V2-7d (SP-LID-DISRUPTION).
//
// The R2 anti-vacuous-bands discipline (contract AC-STRUCT-CELLS / AC-STRUCT-FOCI): before the
// lidDisruption.js module exists, drive the REAL reference writers and extract the reference
// statistics the module's structure tests will band-pin, PLUS perturbed controls proving each
// band is discriminating (excludes a wrong-config run), not vacuous.
//
//   (a) shellRelief STEP-2 (the cell seed): cellCount, wall-node fraction, normalized cell-size
//       quantiles, interiorness distribution (recomputed ARM'S-LENGTH from published cellId via
//       the same BFS + falloff formula — the writer does not publish cellInteriorness).
//   (b) stagnantLid corona construction (the foci seed): coverage fraction (two mesh densities),
//       radius-law quantiles (u-hat = inverse of the R_c law), active/inactive type split,
//       accepted-center field-bias vs the randomPlacementControl constant-accept control.
//
// HEADLESS: node docs/WORKSTREAMS/world-engine-v2-7d-lid-disruption-2026-07-12/v2-7d-band-calibration.mjs
// Read-only over shipped writers (tune-only perturbations); writes nothing; COMMITS nothing.

import { buildIrregularSphere } from '../../../planet-lod-rivers.js';
import { makeSphereField } from '../../../src/worldengine/base/sphereField.js';
import { writeShellReliefSphere } from '../../../src/worldengine/base/shellRelief.js';
import { writeStagnantLidReliefSphere, DEFAULTS as STAG_DEFAULTS } from '../../../src/worldengine/base/stagnantLid.js';

const SEEDS = [1, 2, 3, 7, 42];
const clamp = (lo, hi, x) => Math.max(lo, Math.min(hi, x));
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const mean = (a) => { let s = 0; for (const v of a) s += v; return a.length ? s / a.length : NaN; };
const quantile = (arr, q) => {
  const a = Float64Array.from(arr).sort();
  if (!a.length) return NaN;
  const pos = (a.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
  return a[lo] + (a[hi] - a[lo]) * (pos - lo);
};
const f = (x, d = 3) => Number.isFinite(x) ? x.toFixed(d) : String(x);

// Meshes are deterministic (fibonacci + Lloyd); build once per density, re-wrap per run.
console.log('building meshes…');
const MESH_1500 = buildIrregularSphere(1500, 2);
const MESH_600 = buildIrregularSphere(600, 2);

// ── (a) CELLS — shellRelief STEP-2 reference ─────────────────────────────────────────────────────
// Arm's-length interiorness recompute from PUBLISHED cellId (the writer's own BFS + falloff formula;
// the module will publish interiorness directly — this pins the reference distribution).
function cellStats(mesh, diag, beltRadians) {
  const N = mesh.verts.length, adj = mesh.adj;
  const { cellId, cellCount, meanEdgeAngle } = diag;
  // wall nodes = any differing-cellId neighbor; multi-source BFS (the plates/shell idiom)
  const wallDist = new Int32Array(N).fill(-1);
  const q = new Int32Array(N); let qh = 0, qt = 0;
  for (let i = 0; i < N; i++) {
    const nb = adj[i];
    for (let k = 0; k < nb.length; k++) { if (cellId[nb[k]] !== cellId[i]) { wallDist[i] = 0; q[qt++] = i; break; } }
  }
  const wallFrac = qt / N;
  if (qt === 0) wallDist.fill(0);
  else while (qh < qt) { const c = q[qh++]; const nd = wallDist[c] + 1; for (const nb of adj[c]) { if (wallDist[nb] < 0) { wallDist[nb] = nd; q[qt++] = nb; } } }
  const inter = new Float64Array(N);
  for (let i = 0; i < N; i++) inter[i] = clamp01(1 - Math.exp(-(wallDist[i] * meanEdgeAngle) / beltRadians));
  // monotone in wallDist + exactly 0 on walls (sanity of the invariant the module test asserts)
  let maxD = 0; for (let i = 0; i < N; i++) if (wallDist[i] > maxD) maxD = wallDist[i];
  const byD = new Array(maxD + 1).fill(null).map(() => []);
  for (let i = 0; i < N; i++) byD[wallDist[i]].push(inter[i]);
  let monotone = true, prev = -1;
  for (let d = 0; d <= maxD; d++) { if (!byD[d].length) continue; const m = mean(byD[d]); if (m < prev) monotone = false; prev = m; }
  const wallZero = byD[0].every((v) => v === 0);
  // normalized cell sizes: nodes-per-cell × cellCount / N (mean 1 by construction)
  const sizes = new Array(cellCount).fill(0);
  for (let i = 0; i < N; i++) sizes[cellId[i]]++;
  const nsz = sizes.map((s) => s * cellCount / N);
  const spaceFilling = sizes.every((s) => s > 0);
  return {
    cellCount, wallFrac, spaceFilling, monotone, wallZero,
    meanInter: mean(inter), interP90: quantile(inter, 0.9),
    szQ10: quantile(nsz, 0.10), szQ50: quantile(nsz, 0.50), szQ90: quantile(nsz, 0.90),
    szMin: Math.min(...nsz), maxD,
  };
}

function runCells(label, tune, beltOverride = null) {
  const belt = beltOverride ?? (tune && tune.BELT_RADIANS) ?? 0.06;
  const rows = [];
  const pooledSizes = [];
  for (const s of SEEDS) {
    const c = makeSphereField(MESH_1500);
    const diag = writeShellReliefSphere(c, {}, { macroSeed: s, regime: 'icy-active', tune });
    rows.push({ seed: s, ...cellStats(MESH_1500, diag, belt) });
    // pooled normalized sizes across seeds (per-seed cell counts ~10 are too small for stable quantiles)
    const sizes = new Array(diag.cellCount).fill(0);
    for (let i = 0; i < MESH_1500.verts.length; i++) sizes[diag.cellId[i]]++;
    for (const sz of sizes) pooledSizes.push(sz * diag.cellCount / MESH_1500.verts.length);
  }
  console.log(`\nCELLS [${label}] (N=1500, seeds ${SEEDS.join(',')})`);
  console.log('  seed  K   wallFrac  spaceFill  mono  wall0  meanInt  intP90  szQ10  szQ50  szQ90  szMin');
  for (const r of rows) {
    console.log(`  ${String(r.seed).padStart(4)}  ${String(r.cellCount).padStart(2)}  ${f(r.wallFrac)}     ${r.spaceFilling}       ${r.monotone}  ${r.wallZero}   ${f(r.meanInter)}    ${f(r.interP90)}   ${f(r.szQ10, 2)}   ${f(r.szQ50, 2)}   ${f(r.szQ90, 2)}   ${f(r.szMin, 2)}`);
  }
  const agg = (k) => ({ min: Math.min(...rows.map((r) => r[k])), max: Math.max(...rows.map((r) => r[k])) });
  const summary = {
    label,
    cellCount: agg('cellCount'), wallFrac: agg('wallFrac'), meanInter: agg('meanInter'),
    szQ10: agg('szQ10'), szQ50: agg('szQ50'), szQ90: agg('szQ90'), szMin: agg('szMin'),
    pooled: {
      nCells: pooledSizes.length,
      szQ10: quantile(pooledSizes, 0.10), szQ50: quantile(pooledSizes, 0.50), szQ90: quantile(pooledSizes, 0.90),
      szMin: Math.min(...pooledSizes),
    },
  };
  console.log(`  → ranges: K [${summary.cellCount.min},${summary.cellCount.max}]  wallFrac [${f(summary.wallFrac.min)},${f(summary.wallFrac.max)}]  meanInt [${f(summary.meanInter.min)},${f(summary.meanInter.max)}]  szQ10 [${f(summary.szQ10.min, 2)},${f(summary.szQ10.max, 2)}]  szQ90 [${f(summary.szQ90.min, 2)},${f(summary.szQ90.max, 2)}]  szMin [${f(summary.szMin.min, 2)},${f(summary.szMin.max, 2)}]`);
  console.log(`  → pooled sizes (${summary.pooled.nCells} cells): q10 ${f(summary.pooled.szQ10, 2)}  q50 ${f(summary.pooled.szQ50, 2)}  q90 ${f(summary.pooled.szQ90, 2)}  min ${f(summary.pooled.szMin, 2)}`);
  return summary;
}

// ── (b) FOCI — stagnantLid corona construction reference ────────────────────────────────────────
// Arm's-length plume predictor (UNwarped squared Gaussian over published plumeCenters — the shipped
// structure-test idiom, worldengine-base-stagnantlid-structure.test.js plumePredictor).
function predictorAt(dir, centers, belt) {
  let best = 0;
  for (const c of centers) {
    const a = Math.acos(clamp(-1, 1, dot(dir, c)));
    const g = Math.exp(-(a / belt) * (a / belt));
    if (g > best) best = g;
  }
  return best;
}

function fociStats(diag) {
  const N = diag.U.length;
  let cov = 0; for (let i = 0; i < N; i++) cov += diag.coronaCoverMask[i];
  const uhat = Array.from(diag.coronaRadius).map((rc) =>
    ((rc / diag.meanEdgeAngle) - STAG_DEFAULTS.CORONA_RC_MIN_NODES) / STAG_DEFAULTS.CORONA_RC_SPAN_NODES);
  const bias = Array.from(diag.coronaCenters).map((ctr) => predictorAt(ctr, diag.plumeCenters, diag.PLUME_BELT));
  let act = 0; for (const a of diag.coronaActive) act += a;
  return {
    count: diag.coronaCount, coverage: cov / N,
    uQ25: quantile(uhat, 0.25), uQ50: quantile(uhat, 0.50), uQ75: quantile(uhat, 0.75), uQ90: quantile(uhat, 0.90),
    activeCount: act, meanBias: mean(bias),
  };
}

function runFoci(label, mesh, tune) {
  const rows = [];
  for (const s of SEEDS) {
    const cR = makeSphereField(mesh);
    const dR = writeStagnantLidReliefSphere(cR, {}, { macroSeed: s, tune });
    const cC = makeSphereField(mesh);
    const dC = writeStagnantLidReliefSphere(cC, {}, { macroSeed: s, tune, randomPlacementControl: true });
    rows.push({ seed: s, real: fociStats(dR), ctrl: fociStats(dC) });
  }
  const N = mesh.verts.length;
  console.log(`\nFOCI [${label}] (N=${N}, seeds ${SEEDS.join(',')})`);
  console.log('  seed  n(real)  coverage  uQ25   uQ50   uQ75   uQ90   biasReal  n(ctrl)  covCtrl  biasCtrl  bias ratio');
  for (const r of rows) {
    const ratio = r.real.meanBias / (r.ctrl.meanBias || 1e-9);
    console.log(`  ${String(r.seed).padStart(4)}  ${String(r.real.count).padStart(4)}     ${f(r.real.coverage)}     ${f(r.real.uQ25, 2)}   ${f(r.real.uQ50, 2)}   ${f(r.real.uQ75, 2)}   ${f(r.real.uQ90, 2)}   ${f(r.real.meanBias)}     ${String(r.ctrl.count).padStart(4)}     ${f(r.ctrl.coverage)}    ${f(r.ctrl.meanBias)}     ${f(ratio, 2)}`);
  }
  const pooledAct = rows.reduce((a, r) => a + r.real.activeCount, 0);
  const pooledN = rows.reduce((a, r) => a + r.real.count, 0);
  const allU = [];
  // pooled u-hat quantiles across seeds (per-seed corona counts are small → pool for the radius law)
  for (const s of SEEDS) {
    const c = makeSphereField(mesh);
    const d = writeStagnantLidReliefSphere(c, {}, { macroSeed: s, tune });
    for (const rc of d.coronaRadius) allU.push(((rc / d.meanEdgeAngle) - STAG_DEFAULTS.CORONA_RC_MIN_NODES) / STAG_DEFAULTS.CORONA_RC_SPAN_NODES);
  }
  const agg = (fn) => ({ min: Math.min(...rows.map(fn)), max: Math.max(...rows.map(fn)) });
  const summary = {
    label, N,
    count: agg((r) => r.real.count), coverage: agg((r) => r.real.coverage),
    biasReal: agg((r) => r.real.meanBias), biasCtrl: agg((r) => r.ctrl.meanBias),
    biasRatio: agg((r) => r.real.meanBias / (r.ctrl.meanBias || 1e-9)),
    activeFracPooled: pooledN ? pooledAct / pooledN : NaN,
    uQ50pooled: quantile(allU, 0.5), uQ90pooled: quantile(allU, 0.9),
  };
  console.log(`  → ranges: n [${summary.count.min},${summary.count.max}]  coverage [${f(summary.coverage.min)},${f(summary.coverage.max)}]  biasReal [${f(summary.biasReal.min)},${f(summary.biasReal.max)}]  biasCtrl [${f(summary.biasCtrl.min)},${f(summary.biasCtrl.max)}]  ratio [${f(summary.biasRatio.min, 2)},${f(summary.biasRatio.max, 2)}]`);
  console.log(`  → pooled: activeFrac ${f(summary.activeFracPooled)} (n=${pooledN})  u-hat q50 ${f(summary.uQ50pooled, 3)}  q90 ${f(summary.uQ90pooled, 3)}`);
  return summary;
}

// ══ CELLS: reference + perturbed controls ══
const cellsRef = runCells('REFERENCE (defaults)', null);
runCells('PERTURB count↓ {CELL_MIN:3,CELL_SPAN:1}', { CELL_MIN: 3, CELL_SPAN: 1 });
runCells('PERTURB count↑ {CELL_MIN:36,CELL_SPAN:1}', { CELL_MIN: 36, CELL_SPAN: 1 });
runCells('PERTURB warp↑ {WARP_AMP:0.9}', { WARP_AMP: 0.9 });
runCells('PERTURB warp0 {WARP_AMP:0}', { WARP_AMP: 0.0 });
runCells('PERTURB belt×4 {BELT_RADIANS:0.24}', { BELT_RADIANS: 0.24 });

// ══ FOCI: reference at two densities + perturbed controls ══
const fociRef1500 = runFoci('REFERENCE (defaults)', MESH_1500, null);
const fociRef600 = runFoci('REFERENCE (defaults)', MESH_600, null);
runFoci('PERTURB pool×4 {CORONA_POOL:480}', MESH_1500, { CORONA_POOL: 480 });
runFoci('PERTURB pool÷4 {CORONA_POOL:30}', MESH_1500, { CORONA_POOL: 30 });
runFoci('PERTURB skew=1 {CORONA_SIZE_SKEW:1}', MESH_1500, { CORONA_SIZE_SKEW: 1.0 });
runFoci('PERTURB typeFrac {CORONA_ACTIVE_FRAC:0.35}', MESH_1500, { CORONA_ACTIVE_FRAC: 0.35 });
runFoci('SMALL-POOL grace {CORONA_POOL:20}', MESH_1500, { CORONA_POOL: 20 });

console.log('\nDONE — reference summaries:');
console.log(JSON.stringify({ cellsRef, fociRef1500, fociRef600 }, null, 1));
