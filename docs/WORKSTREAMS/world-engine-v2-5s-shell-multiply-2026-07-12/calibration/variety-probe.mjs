// V2-5s calibration #4 — the FINAL AC-VARIETY + A1/A4 measurability design (post gain-probe learnings).
// Learnings that reshaped the AC tests (recorded in BUILD-PLAN §Calibration):
//   • A1 gravity is MULTIPLICATIVE — std(U) scales ~gFactor. Its absolute Δ-vs-floor is marginal at the
//     lowest-relief seed (0.051 vs floor 0.047), but the RATIO std(U)@min-g / std(U)@max-g ≈ 6.2× is
//     seed-INDEPENDENT and bulletproof. => A1 asserts the RATIO (>3), not an absolute floor.
//   • A4 chaos-area is seed-fragile: seed 42's stress field never coincides with cell interiors, so chaos
//     barely turns on even when warm. => A4 asserts the CHAOS_THRESH KNOB strictly (every seed) + chaos-area
//     non-decreasing/no-inversion (every seed) + measurable IN AGGREGATE (mean warm − mean REF > floor).
//   • Gravity alone does NOT move linN/cellCount/chaos (each axis owns its observable), so per-observable
//     floor-clearing for a single-axis pair is impossible. => AC-VARIETY uses a COMPOSITE floor-normalized
//     distance between two DISTINCT driver worlds (low-corner vs high-corner) > the seed-only-reroll distance
//     (the V2-2b-1 Shannon-entropy discipline, generalized to a 4-vector).
// Run FROM REPO ROOT:  node docs/WORKSTREAMS/world-engine-v2-5s-shell-multiply-2026-07-12/calibration/variety-probe.mjs
import { writeShellReliefSphere } from '/home/ax/projects/well-dipper/src/worldengine/base/shellRelief.js';
import { makeSphereField } from '/home/ax/projects/well-dipper/src/worldengine/base/sphereField.js';
import { buildIrregularSphere } from '/home/ax/projects/well-dipper/planet-lod-rivers.js';

const mesh = buildIrregularSphere(600, 2), carrierOf = () => makeSphereField(mesh);
const SEEDS = [1, 2, 3, 7, 42], KEYS = ['linFrac', 'stdU', 'chaosFrac', 'cellCount'];
const D = { CELL_MIN: 9, CREST_THRESH: 0.94, TENSILE_THRESH: 0.05, CHAOS_THRESH: 0.6, RIDGE_AMP: 1.4, CHAOS_AMP: 0.12, CHAOS_BASE: -0.04 };
const cl = (lo, hi, x) => Math.max(lo, Math.min(hi, x));
const IO = (0.0041 ** 2) * (317.8 ** 2) * 0.286 ** 5 / 66 ** 5, tid = (e, s, R, o) => (e * e * s * s * R ** 5 / o ** 5) / IO;
const REFS = {
  'icy-active': { massGravity: 0.28, volatileFraction: 0.5, tidalHeating: tid(0.1, 332946, 0.5, 2500), condition: { T_eq: 110 } },
  'volatile-cold': { massGravity: 0.15624999999999997, volatileFraction: 0.4, tidalHeating: tid(0.03, 332946, 0.4, 120000), condition: { T_eq: 94 } },
};
const G = { SPAN_DECADES: 6, K_CREST: 0.09, CREST_LO: 0.82, CREST_HI: 0.985, K_TENSILE: 0.03, TENSILE_LO: 0.01, TENSILE_HI: 0.12, K_CELL: 7, T_VIGOR_SPAN: 120, CELL_LO: 4, CELL_HI: 22, K_CHAOSTHRESH: 0.28, T_WARM_SPAN: 120, CHAOS_LO: 0.30, CHAOS_HI: 0.80 };
function tune(dr, r) {
  if (dr == null) return null; const REF = REFS[r];
  const g = dr.massGravity ?? REF.massGravity, vf = dr.volatileFraction ?? REF.volatileFraction, th = dr.tidalHeating ?? REF.tidalHeating, Te = dr.condition?.T_eq ?? REF.condition.T_eq;
  const gF = cl(0.4, 2.5, (g / REF.massGravity) ** -0.5), RA = D.RIDGE_AMP * gF, CA = D.CHAOS_AMP * gF, CB = D.CHAOS_BASE * gF;
  const td = cl(-1, 1, Math.log10(Math.max(th, 1e-30) / REF.tidalHeating) / G.SPAN_DECADES);
  const CT = cl(G.CREST_LO, G.CREST_HI, D.CREST_THRESH - G.K_CREST * td), TT = cl(G.TENSILE_LO, G.TENSILE_HI, D.TENSILE_THRESH - G.K_TENSILE * td);
  const vi = (Te - REF.condition.T_eq) / G.T_VIGOR_SPAN + (vf - REF.volatileFraction), CM = cl(G.CELL_LO, G.CELL_HI, Math.round(D.CELL_MIN + G.K_CELL * vi));
  const wd = (Te - REF.condition.T_eq) / G.T_WARM_SPAN, CH = cl(G.CHAOS_LO, G.CHAOS_HI, D.CHAOS_THRESH - G.K_CHAOSTHRESH * wd);
  if (CM === D.CELL_MIN && CT === D.CREST_THRESH && TT === D.TENSILE_THRESH && CH === D.CHAOS_THRESH && RA === D.RIDGE_AMP && CA === D.CHAOS_AMP && CB === D.CHAOS_BASE) return null;
  return { CELL_MIN: CM, CREST_THRESH: CT, TENSILE_THRESH: TT, CHAOS_THRESH: CH, RIDGE_AMP: RA, CHAOS_AMP: CA, CHAOS_BASE: CB };
}
const sd = a => { let m = 0; for (const x of a) m += x; m /= a.length; let v = 0; for (const x of a) v += (x - m) ** 2; return Math.sqrt(v / a.length); };
function obs(d) { let l = 0, c = 0; for (const x of d.lineamentNode) if (x) l++; for (const x of d.chaosMask) if (x > 1e-6) c++; const N = d.U.length; return { linFrac: l / N, stdU: sd(d.U), chaosFrac: c / N, cellCount: d.cellCount }; }
function b(s, r, dr) { return obs(writeShellReliefSphere(carrierOf(), dr ?? {}, { macroSeed: s, regime: r, tune: tune(dr, r) })); }
function floors(r) { const rows = SEEDS.map(s => b(s, r, null)), f = {}; for (const k of KEYS) { const v = rows.map(o => o[k]); f[k] = (Math.max(...v) - Math.min(...v)) || 1e-9; } return f; }
function dist(a, bb, f) { let s = 0; for (const k of KEYS) s += ((a[k] - bb[k]) / f[k]) ** 2; return Math.sqrt(s); }

const LOW = { massGravity: 1.75, volatileFraction: 0.05, tidalHeating: 1e-3, condition: { T_eq: 60 } };   // subdued corner
const HIGH = { massGravity: 0.0448, volatileFraction: 1.0, tidalHeating: 1e6, condition: { T_eq: 330 } };  // busy corner

console.log('#### AC-VARIETY — composite floor-normalized distance: driver-corner vs seed-only-reroll ####');
let ok = true;
for (const r of ['icy-active', 'volatile-cold']) {
  const f = floors(r);
  let minDriver = Infinity, maxSeed = 0;
  for (const s of SEEDS) minDriver = Math.min(minDriver, dist(b(s, r, LOW), b(s, r, HIGH), f));
  for (let i = 0; i < SEEDS.length; i++) for (let j = i + 1; j < SEEDS.length; j++) maxSeed = Math.max(maxSeed, dist(b(SEEDS[i], r, null), b(SEEDS[j], r, null), f));
  const pass = minDriver > maxSeed && minDriver > 1.5;
  ok = ok && pass;
  console.log(`  ${r.padEnd(15)} min driver-dist=${minDriver.toFixed(3)}  max seed-only-dist=${maxSeed.toFixed(3)}  PASS=${pass}`);
}
console.log('\n#### A1 headline — low-g/high-g std(U) RATIO per seed (icy-active) ####');
{ let minR = Infinity; for (const s of SEEDS) { const lo = b(s, 'icy-active', { massGravity: 0.0448 }).stdU, hi = b(s, 'icy-active', { massGravity: 1.75 }).stdU; minR = Math.min(minR, lo / hi); } console.log(`  min ratio across seeds = ${minR.toFixed(2)}  (>3 => ${minR > 3})`); ok = ok && minR > 3; }
console.log('\n#### A4 aggregate — mean chaos-area @T_eq=290 − @REF (icy-active) vs floor ####');
{ const f = floors('icy-active'); const mR = SEEDS.reduce((a, s) => a + b(s, 'icy-active', null).chaosFrac, 0) / SEEDS.length; const mW = SEEDS.reduce((a, s) => a + b(s, 'icy-active', { condition: { T_eq: 290 } }).chaosFrac, 0) / SEEDS.length; console.log(`  mean REF=${mR.toFixed(4)} mean warm=${mW.toFixed(4)} Δ=${(mW - mR).toFixed(4)} floor=${f.chaosFrac.toFixed(4)}  measurable=${mW - mR > f.chaosFrac}`); ok = ok && (mW - mR > f.chaosFrac); }
console.log(`\n#### ALL FINAL MEASURABILITY CHECKS PASS: ${ok} ####`);
