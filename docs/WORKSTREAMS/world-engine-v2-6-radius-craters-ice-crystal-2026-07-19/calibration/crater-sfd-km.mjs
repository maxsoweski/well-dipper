// calibration/crater-sfd-km.mjs — World Engine V2-6 SLICE-2 STEP 0 (closed-form pre-check, BEFORE writer code).
//
// PURPOSE (BUILD-PLAN §1C(iii) restructure / §2 SLICE 2 step 0, Lens L5/L11/L20): the km-space SFD rewrite
// replaces V2-5's angular power-law + K_GD count with a CLOSED-FORM analytic population whose priors must be
// pinned against the AC-POPSWEEP [10%,80%] bowl-coverage gate BEFORE the writer is finalized — the v1 plan's
// looped `min(N_DRAW_CAP,…)` capped coverage near ~5% (cap saturated, R-sweep flattened). This harness runs
// the analytic coverage/N_stamp/screen closed forms for the MATURE airless presets + an R sweep and SOLVES
// F_REF against the coverage band, so the writer bakes numbers this pre-check validated. It is pure `node`
// (no dev server, no claude -p). Re-run after any prior move; its printed F_REF is the source of truth the
// writer's F_REF comment cites.
//
// MODEL (the exact closed forms the writer will implement — §1C):
//   R_km      = KM_PER_EARTH_RADIUS · cond.radiusEarth
//   D_ATMO_KM = C_ATMO_KM · P^P_ATMO_EXP            (graded atmo floor; P = atmosphere.pressure ?? 0 bar)
//   D_LO_KM   = max(D_SFD_MIN_KM, D_ATMO_KM)        (D_SFD_MIN_KM is a SCREENING anchor — Lens L13)
//   D_HI_KM   = C_BASIN · R_km                       (SPA/disruption limit — a TARGET property)
//   sizeMul   = (G_REF/g)^K_GS                        (π-group size scaling, kept exactly from V2-5)
//   L, H      = D_LO_KM·sizeMul ,  min(D_HI_KM·sizeMul, C_BASIN·R_km) = C_BASIN·R_km  (upper edge capped)
//   screen    = (D_SFD_MIN_KM / D_LO_KM)^B_SFD        (atmo screening: raised floor ⇒ fewer craters exist)
//   chron(t)  = A_NEU·(exp(LAMBDA_NEU·t)−1) + B_NEU·t (Neukum lunar chronology SHAPE)
//   chronN(t) = chron(t)/chron(AGE_REF)              (normalized at AGE_REF)
//   t_exp     = min(age, T_RESURF_TIDAL/max(td,EPS_TD), T_RESURF_ERODE/max(erosion,EPS_ER))
//   N_analytic= F_REF · R² · chronN(t_exp) · screen  (CLOSED-FORM drawn population; never looped)
//   E[D²]     = 2·L²·ln(H/L)/(1−(L/H)²)              (bounded-Pareto B=2 second moment)
//   coverage  = N_analytic · E[(δ/2)²]/4 = N_analytic · radPerKm² · E[D²] / 16   (small-angle drawn-coverage metric)
//   D_FLOOR_KM= MESH_FLOOR_RAD / radPerKm(R)          (angular mesh floor in km, ∝ R)
//   P_STAMP   = min(1, (max(L,D_FLOOR_KM≥L? L : L) …) ) — bounded-Pareto tail fraction above the mesh floor:
//               = min(1, (L / D_FLOOR_KM)^B_SFD)      (fraction of the drawn SFD with D ≥ mesh floor)
//   N_stamp   = round(N_analytic · P_STAMP)           (the ONLY loop count)

import { KM_PER_EARTH_RADIUS, radPerKm } from '../../../../src/worldengine/base/baseStep.js';
import { DRIVER_PRESETS } from '../../../../driver-presets.js';
import { deriveConditionVector } from '../../../../body-condition-vector.js';
import { deriveUniforms } from '../../../../planet-lod-lab-core.js';

// ── priors (the writer will bake these; the pre-check may move F_REF only) ──────────────────────────
const C_BASIN       = 1.0;      // SPA/disruption diameter limit as a fraction of R_km
const C_ATMO_KM     = 0.16;     // graded atmo-floor scale (km); anchored Venus 92 bar → ~3 km, Mars 0.01 bar → ~8 m
const P_ATMO_EXP    = 0.65;
const D_SFD_MIN_KM  = 1.0;      // SCREENING anchor (NOT a stamp floor — Lens L13)
const B_SFD         = 2.0;      // cumulative SFD exponent (kept from V2-5)
const G_REF         = 0.5;
const K_GS          = 0.17;     // gravity size law (kept from V2-5)
const MESH_FLOOR_RAD = 0.055;   // 3·meanEdgeAngle at the lab display N (~12k nodes ⇒ meanEdge ≈ 2/√N ≈ 0.0183)
const N_STAMP_SAFETY = 5000;
// Neukum chronology
const A_NEU = 5.44e-14, LAMBDA_NEU = 6.93, B_NEU = 8.38e-4, AGE_REF = 4.0;
// continuous exposure
const T_RESURF_TIDAL = 0.7, EPS_TD = 1e-6, T_RESURF_ERODE = 0.1, EPS_ER = 1e-6;
// deep-envelope / cold gate
const P_SURF_MAX = 200, CRATER_T_MAX = 450;
// erosion (mirrors surfaceMaterial.erosionOf — cond-pure)
const P_ER_REF = 0.5, DRY_ER_FLOOR = 0.1;

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const smoothstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const chron = (t) => A_NEU * (Math.exp(LAMBDA_NEU * t) - 1) + B_NEU * t;
const chronN = (t) => chron(t) / chron(AGE_REF);
function erosionOf(cond) {
  const P = cond.atmosphere?.pressure ?? 0, T = cond.T_eq ?? 288;
  const waterWindow = smoothstep(248, 273, T) * (1 - smoothstep(373, 398, T));
  return clamp01(smoothstep(0, P_ER_REF, P) * Math.max(waterWindow, DRY_ER_FLOOR));
}
function isImpactSurface(cond) {
  const P = cond.atmosphere?.pressure ?? 0;
  return (cond.T_eq ?? 288) < CRATER_T_MAX && P < P_SURF_MAX;
}
// closed forms, F_REF as a free coefficient (coverage/N_analytic linear in F_REF)
function analytics(cond, F_REF) {
  const R = cond.radiusEarth ?? 1.0;
  const R_km = KM_PER_EARTH_RADIUS * R;
  const g = Math.max(1e-6, cond.surfaceGravity ?? G_REF);
  const age = Math.max(0, cond.age ?? AGE_REF);
  const td = cond.rawTidalIoRatio ?? 0;
  const erosion = erosionOf(cond);
  const P = cond.atmosphere?.pressure ?? 0;
  const D_ATMO_KM = C_ATMO_KM * Math.pow(P, P_ATMO_EXP);
  const D_LO_KM = Math.max(D_SFD_MIN_KM, D_ATMO_KM);
  const sizeMul = Math.pow(G_REF / g, K_GS);
  const L = D_LO_KM * sizeMul;
  const H = C_BASIN * R_km;                        // upper edge capped at the disruption limit
  const screen = Math.pow(D_SFD_MIN_KM / D_LO_KM, B_SFD);
  const tExp = Math.min(age, T_RESURF_TIDAL / Math.max(td, EPS_TD), T_RESURF_ERODE / Math.max(erosion, EPS_ER));
  const nAnalytic = F_REF * R * R * chronN(tExp) * screen;
  const rpk = radPerKm(R);
  const ED2 = 2 * L * L * Math.log(H / L) / (1 - Math.pow(L / H, 2));
  const coverage = nAnalytic * rpk * rpk * ED2 / 16;
  const D_FLOOR_KM = MESH_FLOOR_RAD / rpk;
  const P_STAMP = Math.min(1, Math.pow(L / D_FLOOR_KM, B_SFD));
  const nStamp = Math.round(nAnalytic * P_STAMP);
  return { R, R_km, g, age, td, erosion, P, D_LO_KM, D_HI_KM: H, sizeMul, screen, tExp, nAnalytic, coverage, D_FLOOR_KM, P_STAMP, nStamp };
}

// ── real conditions from presets ───────────────────────────────────────────────────────────────────
function condOf(name) {
  const fp = DRIVER_PRESETS[name];
  const u = deriveUniforms(fp, 1.0);
  return deriveConditionVector(fp, u, fp.radiusEarth);
}
// MATURE airless set: airless, substantially exposed (t_exp ≈ age) — the coverage-gate denominator.
const MATURE = ['Moon/Mercury (impact-airless)', 'Frozen (airless)', 'Crystal (faceted)'];

// Solve F_REF so the MATURE set's coverages centre in [10%,80%] (geometric mean → ~40%).
// coverage is linear in F_REF ⇒ pick F_REF so the geo-mean coverage hits TARGET.
const TARGET = 0.40;
const covAtOne = MATURE.map((n) => analytics(condOf(n), 1).coverage);
const geoMean1 = Math.exp(covAtOne.reduce((s, c) => s + Math.log(c), 0) / covAtOne.length);
let F_REF = TARGET / geoMean1;
// round F_REF to a legible 3-sig-fig constant, then re-verify the band holds
F_REF = Number(F_REF.toPrecision(3));

console.log('=== V2-6 crater-sfd-km STEP-0 closed-form pre-check ===');
console.log(`MESH_FLOOR_RAD = ${MESH_FLOOR_RAD} (3·meanEdgeAngle at lab display N≈12k; meanEdge≈2/√N≈0.0183)`);
console.log(`SOLVED F_REF = ${F_REF}  (target geo-mean coverage ${(TARGET * 100).toFixed(0)}% over MATURE set)\n`);

let fail = false;
console.log('MATURE airless coverage band [10%,80%]:');
for (const n of MATURE) {
  const a = analytics(condOf(n), F_REF);
  const ok = a.coverage >= 0.10 && a.coverage <= 0.80;
  const stampOk = a.nStamp <= N_STAMP_SAFETY && a.nStamp >= 1;
  if (!ok || !stampOk) fail = true;
  console.log(`  ${n.padEnd(30)} R=${a.R.toFixed(2)} g=${a.g.toFixed(3)} tExp=${a.tExp.toFixed(2)} screen=${a.screen.toFixed(3)} ` +
    `N_an=${a.nAnalytic.toExponential(2)} cov=${(a.coverage * 100).toFixed(1)}% D_FLOOR=${a.D_FLOOR_KM.toFixed(0)}km N_stamp=${a.nStamp} ${ok && stampOk ? 'OK' : 'FAIL'}`);
}

console.log('\nR sweep (Moon-class cond, R ∈ [0.2,2.0]): N_analytic ∝ R² strict, coverage log-drift, N_stamp R-invariant:');
const moon = condOf('Moon/Mercury (impact-airless)');
let prevN = null, prevPerR2 = null;
for (const R of [0.2, 0.38, 0.5, 0.8, 1.2, 2.0]) {
  const a = analytics({ ...moon, radiusEarth: R, surfaceGravity: (moon.surfaceGravity / moon.radiusEarth) * R }, F_REF);
  const perR2 = a.nAnalytic / (R * R);
  if (prevPerR2 !== null && Math.abs(perR2 - prevPerR2) / prevPerR2 > 1e-9) { console.log('  !! N_analytic/R² not constant — R² law broken'); fail = true; }
  prevPerR2 = perR2;
  console.log(`  R=${R.toFixed(2)} N_an=${a.nAnalytic.toExponential(3)} N_an/R²=${perR2.toExponential(3)} cov=${(a.coverage * 100).toFixed(1)}% N_stamp=${a.nStamp}`);
  prevN = a.nAnalytic;
}

console.log('\nAtmo screening (LIVE wiring — Lens L13): Venus-class screen<1, Mars-class screen≈1:');
for (const [label, P] of [['Venus-class', 92], ['Mars-class', 0.01], ['airless', 0]]) {
  const D_ATMO = C_ATMO_KM * Math.pow(P, P_ATMO_EXP);
  const D_LO = Math.max(D_SFD_MIN_KM, D_ATMO);
  const screen = Math.pow(D_SFD_MIN_KM / D_LO, B_SFD);
  console.log(`  ${label.padEnd(12)} P=${P} bar  D_ATMO=${D_ATMO.toFixed(3)}km  D_LO=${D_LO.toFixed(3)}km  screen=${screen.toFixed(3)}`);
}

console.log('\nComposition cross-check (declared density vs M/R³ implied — documented, not "fixed"):');
for (const n of ['Moon/Mercury (impact-airless)', 'Frozen (airless)', 'Crystal (faceted)']) {
  const fp = DRIVER_PRESETS[n];
  const declared = fp.composition?.density;
  const implied = (fp.massEarth / Math.pow(fp.radiusEarth, 3)) * 5.51;  // Earth mean density 5.51 g/cc as the M/R³ unit
  console.log(`  ${n.padEnd(30)} declared=${declared} g/cc   M/R³-implied≈${implied.toFixed(2)} g/cc`);
}

console.log(`\nDeep-envelope gate check (P_SURF_MAX=${P_SURF_MAX}): Jovian/Neptunian NOT impact surfaces:`);
for (const n of ['Gas giant (Jovian)', 'Ice giant (Neptunian)', 'Rocky (Earthlike)']) {
  const c = condOf(n);
  console.log(`  ${n.padEnd(30)} P=${c.atmosphere?.pressure ?? 0} bar T_eq=${c.T_eq} isImpactSurface=${isImpactSurface(c)}`);
}

console.log(`\n${fail ? 'FAIL — priors need adjustment' : 'ALL PASS — priors pinned; writer may bake F_REF=' + F_REF}`);
process.exit(fail ? 1 : 0);
