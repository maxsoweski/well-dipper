// V2-5s calibration #3b — AC-ORDER anti-mush falsifier under tune.
// Verifies that at EVERY sweep point: (i) varExplainedByStress > varExplainedByLatitudeY AND
// > varExplainedByLatitudeW0, (ii) lineamentInteriorRatio > 1. Computes varExplainedByStress two ways:
//   (A) the shellProbe way — corr(U, diag.reliefStress) [writer's own published stress-geometric relief];
//   (B) the arm's-length structure-suite way — rebuild the steered double-ridge from PUBLISHED thetaTraj +
//       stressTensile, with the APPLIED-tune CREST/RIDGE constants (never reads U). Reports both so the
//       BUILD-PLAN can pick the predictor the multiply test uses.
// Run FROM REPO ROOT:  node docs/WORKSTREAMS/world-engine-v2-5s-shell-multiply-2026-07-12/calibration/order-probe.mjs
import { writeShellReliefSphere } from '/home/ax/projects/well-dipper/src/worldengine/base/shellRelief.js';
import { makeSphereField } from '/home/ax/projects/well-dipper/src/worldengine/base/sphereField.js';
import { buildIrregularSphere } from '/home/ax/projects/well-dipper/planet-lod-rivers.js';
import { createNoise3D } from 'simplex-noise';
import alea from 'alea';

const TARGET_N = 600, LLOYD = 2, SEEDS = [1, 2, 3, 7, 42];
const mesh = buildIrregularSphere(TARGET_N, LLOYD);
const carrierOf = () => makeSphereField(mesh);
const D = { CELL_MIN: 9, CREST_THRESH: 0.94, TENSILE_THRESH: 0.05, CHAOS_THRESH: 0.6, RIDGE_AMP: 1.4, CHAOS_AMP: 0.12, CHAOS_BASE: -0.04 };
const clamp = (lo, hi, x) => Math.max(lo, Math.min(hi, x));
const IO_TIDAL_REF = (0.0041 * 0.0041) * (317.8 * 317.8) * Math.pow(0.286, 5) / Math.pow(66, 5);
const tid = (e, s, R, o) => (e * e * s * s * Math.pow(R, 5) / Math.pow(o, 5)) / IO_TIDAL_REF;
const SHELL_REFS = {
  'icy-active':     { massGravity: 0.28,                 volatileFraction: 0.5,  tidalHeating: tid(0.1, 332946, 0.5, 2500),    condition: { T_eq: 110 } },
  'volatile-cold':  { massGravity: 0.15624999999999997,  volatileFraction: 0.4,  tidalHeating: tid(0.03, 332946, 0.4, 120000), condition: { T_eq: 94 } },
  'eyeball-despun': { massGravity: 1,                     volatileFraction: 0.25, tidalHeating: tid(0.01, 332946, 1, 23455),     condition: { T_eq: 270 } },
};
const G = { SPAN_DECADES: 6, K_CREST: 0.09, CREST_LO: 0.82, CREST_HI: 0.985, K_TENSILE: 0.03, TENSILE_LO: 0.01, TENSILE_HI: 0.12, K_CELL: 7, T_VIGOR_SPAN: 120, CELL_LO: 4, CELL_HI: 22, K_CHAOSTHRESH: 0.28, T_WARM_SPAN: 120, CHAOS_LO: 0.30, CHAOS_HI: 0.80 };
function shellDriversToTune(drivers, regime) {
  if (drivers == null) return null;
  const REF = SHELL_REFS[regime] || SHELL_REFS['icy-active'];
  const g = drivers.massGravity ?? REF.massGravity, vf = drivers.volatileFraction ?? REF.volatileFraction, th = drivers.tidalHeating ?? REF.tidalHeating, Teq = drivers.condition?.T_eq ?? REF.condition.T_eq;
  const gFactor = clamp(0.4, 2.5, Math.pow(g / REF.massGravity, -0.5));
  const RIDGE_AMP = D.RIDGE_AMP * gFactor, CHAOS_AMP = D.CHAOS_AMP * gFactor, CHAOS_BASE = D.CHAOS_BASE * gFactor;
  const tidalDev = clamp(-1, 1, Math.log10(Math.max(th, 1e-30) / REF.tidalHeating) / G.SPAN_DECADES);
  const CREST_THRESH = clamp(G.CREST_LO, G.CREST_HI, D.CREST_THRESH - G.K_CREST * tidalDev);
  const TENSILE_THRESH = clamp(G.TENSILE_LO, G.TENSILE_HI, D.TENSILE_THRESH - G.K_TENSILE * tidalDev);
  const vigor = (Teq - REF.condition.T_eq) / G.T_VIGOR_SPAN + (vf - REF.volatileFraction);
  const CELL_MIN = clamp(G.CELL_LO, G.CELL_HI, Math.round(D.CELL_MIN + G.K_CELL * vigor));
  const warmDev = (Teq - REF.condition.T_eq) / G.T_WARM_SPAN;
  const CHAOS_THRESH = clamp(G.CHAOS_LO, G.CHAOS_HI, D.CHAOS_THRESH - G.K_CHAOSTHRESH * warmDev);
  if (CELL_MIN === D.CELL_MIN && CREST_THRESH === D.CREST_THRESH && TENSILE_THRESH === D.TENSILE_THRESH && CHAOS_THRESH === D.CHAOS_THRESH && RIDGE_AMP === D.RIDGE_AMP && CHAOS_AMP === D.CHAOS_AMP && CHAOS_BASE === D.CHAOS_BASE) return null;
  return { CELL_MIN, CREST_THRESH, TENSILE_THRESH, CHAOS_THRESH, RIDGE_AMP, CHAOS_AMP, CHAOS_BASE };
}
// ── stats + arm's-length predictor (structure-suite verbatim, but CREST/RIDGE parameterized by the tune) ──
const mean = (a) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i]; return s / a.length; };
function pearson(x, y) { const n = x.length, mx = mean(x), my = mean(y); let sxy = 0, sxx = 0, syy = 0; for (let i = 0; i < n; i++) { const dx = x[i] - mx, dy = y[i] - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy; } const den = Math.sqrt(sxx * syy); return den < 1e-12 ? 0 : sxy / den; }
const varExplained = (x, y) => { const r = pearson(x, y); return r * r; };
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const smoothstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
function steeredNoise3T(noise3, dir, east, north, angle, freq) {
  const ca = Math.cos(angle), sa = Math.sin(angle), fScale = 0.7, along = 0.25, across = 1.9;
  const sU = freq * fScale * along, sV = freq * fScale * across;
  const ux = east[0] * ca + north[0] * sa, uy = east[1] * ca + north[1] * sa, uz = east[2] * ca + north[2] * sa;
  const vx = -east[0] * sa + north[0] * ca, vy = -east[1] * sa + north[1] * ca, vz = -east[2] * sa + north[2] * ca;
  const px = dir[0] * freq + ux * sU + vx * sV, py = dir[1] * freq + uy * sU + vy * sV, pz = dir[2] * freq + uz * sU + vz * sV;
  return 0.5 - Math.abs(noise3(px, py, pz));
}
// rebuild with the APPLIED CREST/SHOULDER/TROUGH/RIDGE constants (SHOULDER/TROUGH are load-bearing, untuned)
function stressPredictor(c, diag, seed, tune) {
  const N = c.N, ridgeNoise = createNoise3D(alea('shell:ridge:' + seed));
  const CREST = tune ? tune.CREST_THRESH : D.CREST_THRESH, SHOULDER = 1.2, TROUGH = 0.55, RIDGE_FREQ = 7.0;
  const raw = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const { east, north } = c.tangentFrameAt(i);
    const R = steeredNoise3T(ridgeNoise, c.verts[i], east, north, diag.thetaTraj[i] + Math.PI / 2, RIDGE_FREQ) + 0.5;
    const t = clamp01((R - CREST) / (1 - CREST));
    const dr = SHOULDER * 4 * t * (1 - t) - TROUGH * smoothstep(0.6, 1.0, t);
    raw[i] = Math.max(0, diag.stressTensile[i]) * dr;
  }
  const cur = raw.slice(), tmp = new Float32Array(N);
  for (let pass = 0; pass < 4; pass++) { for (let i = 0; i < N; i++) { let s = cur[i], cnt = 1; const nb = c.adj[i]; for (let k = 0; k < nb.length; k++) { s += cur[nb[k]]; cnt++; } tmp[i] = cur[i] * 0.5 + (s / cnt) * 0.5; } cur.set(tmp); }
  return cur;
}
function lineamentInteriorRatio(diag) {
  const U = diag.U, lin = diag.lineamentNode, N = U.length, m = mean(U);
  let ls = 0, lc = 0, qs = 0, qc = 0;
  for (let i = 0; i < N; i++) { const a = Math.abs(U[i] - m); if (lin[i]) { ls += a; lc++; } else { qs += a; qc++; } }
  const lm = lc ? ls / lc : 0, qm = qc ? qs / qc : 1e-6;
  return qm > 0 ? lm / qm : Infinity;
}
function build(seed, regime, drivers) { const c = carrierOf(); const tune = shellDriversToTune(drivers, regime); const diag = writeShellReliefSphere(c, drivers ?? {}, { macroSeed: seed, regime, tune }); return { c, diag, tune }; }

const SWEEP = {
  'icy-active': [
    { l: 'REF', d: null }, { l: 'low-g', d: { massGravity: 0.07 } }, { l: 'high-g', d: { massGravity: 0.70 } },
    { l: 'hi-tidal', d: { tidalHeating: 136.745 * 10000 } }, { l: 'lo-tidal', d: { tidalHeating: 1.0 } },
    { l: 'warm', d: { condition: { T_eq: 290 } } }, { l: 'wet', d: { volatileFraction: 1.4 } },
    { l: 'combo', d: { massGravity: 0.07, volatileFraction: 0.9, tidalHeating: 5000, condition: { T_eq: 250 } } },
  ],
  'volatile-cold': [
    { l: 'REF', d: null }, { l: 'low-g', d: { massGravity: 0.05 } }, { l: 'hi-tidal', d: { tidalHeating: 100 } }, { l: 'warm', d: { condition: { T_eq: 230 } } },
  ],
  'eyeball-despun': [
    { l: 'REF', d: null }, { l: 'low-g', d: { massGravity: 0.3 } }, { l: 'hi-tidal', d: { tidalHeating: 10 } },
  ],
};

let worstMarginProbe = Infinity, worstMarginRelief = Infinity, minRatio = Infinity, anyFail = false;
for (const regime of Object.keys(SWEEP)) {
  console.log(`\n#### ${regime} ####`);
  for (const { l, d } of SWEEP[regime]) {
    for (const seed of SEEDS) {
      const { c, diag, tune } = build(seed, regime, d);
      const N = c.N;
      const latY = new Float64Array(N), latW = new Float64Array(N);
      for (let i = 0; i < N; i++) { const y = Math.max(-1, Math.min(1, c.verts[i][1])); latY[i] = 1 - y * y; const cw = Math.max(-1, Math.min(1, c.verts[i][0] * diag.w0[0] + c.verts[i][1] * diag.w0[1] + c.verts[i][2] * diag.w0[2])); latW[i] = 1 - cw * cw; }
      const veStressRelief = varExplained(diag.reliefStress, diag.U);   // shellProbe way
      const veStressPred = varExplained(stressPredictor(c, diag, seed, tune), diag.U); // arm's-length way
      const veLatY = varExplained(latY, diag.U), veLatW = varExplained(latW, diag.U);
      const ratio = lineamentInteriorRatio(diag);
      const marginProbe = veStressPred - Math.max(veLatY, veLatW);
      const marginRelief = veStressRelief - Math.max(veLatY, veLatW);
      worstMarginProbe = Math.min(worstMarginProbe, marginProbe);
      worstMarginRelief = Math.min(worstMarginRelief, marginRelief);
      minRatio = Math.min(minRatio, ratio);
      const fail = veStressPred <= veLatY || veStressPred <= veLatW || ratio <= 1;
      if (fail) { anyFail = true; console.log(`  FAIL ${l} seed${seed}: vePred=${veStressPred.toFixed(3)} veRelief=${veStressRelief.toFixed(3)} latY=${veLatY.toFixed(3)} latW=${veLatW.toFixed(3)} ratio=${ratio.toFixed(2)}`); }
    }
    // one representative print per sweep point (seed 7)
    const { c, diag, tune } = build(7, regime, d);
    const N = c.N; const latY = new Float64Array(N), latW = new Float64Array(N);
    for (let i = 0; i < N; i++) { const y = Math.max(-1, Math.min(1, c.verts[i][1])); latY[i] = 1 - y * y; const cw = Math.max(-1, Math.min(1, c.verts[i][0] * diag.w0[0] + c.verts[i][1] * diag.w0[1] + c.verts[i][2] * diag.w0[2])); latW[i] = 1 - cw * cw; }
    console.log(`  ${l.padEnd(9)} seed7: vePred=${varExplained(stressPredictor(c, diag, 7, tune), diag.U).toFixed(3)} veRelief=${varExplained(diag.reliefStress, diag.U).toFixed(3)} latY=${varExplained(latY, diag.U).toFixed(3)} latW=${varExplained(latW, diag.U).toFixed(3)} ratio=${lineamentInteriorRatio(diag).toFixed(2)}`);
  }
}
console.log(`\n#### SUMMARY ####`);
console.log(`  worst margin (arm's-length pred - max latitude): ${worstMarginProbe.toFixed(4)}  (must be > 0)`);
console.log(`  worst margin (reliefStress   - max latitude): ${worstMarginRelief.toFixed(4)}`);
console.log(`  min lineamentInteriorRatio across all points/seeds: ${minRatio.toFixed(3)}  (must be > 1)`);
console.log(`  ANY FALSIFIER FAILURE: ${anyFail}`);
