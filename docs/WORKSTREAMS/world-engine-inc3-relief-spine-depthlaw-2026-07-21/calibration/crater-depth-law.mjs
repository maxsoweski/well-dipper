// calibration/crater-depth-law.mjs — World Engine Inc-3 SLICE-2 STEP 0 (closed-form pre-check, BEFORE writer code).
//
// PURPOSE (BUILD-PLAN §2 / AC-DEPTHLAW / math-check cause #2): bombardment.js craterAmplitude currently reads
//   A(δ) = CRATER_DEPTH_N·(δ/D_REF_RAD)^DEPTH_POW = 0.18·(δ/0.5)^0.5   ⇒   d/D = A/δ = 0.2546·δ^-0.5
// which is 0.36 at the reference crater (2× the fresh-simple 0.20) and blows up to ~1.09 near the mesh floor —
// near-hemispherical pits, and INVERTED (smallest craters steepest, the exact opposite of reality). This harness
// (1) reproduces the inversion, (2) pins the SIMPLE-regime constant depth d/D = 0.20 (⇒ CRATER_DEPTH_N, DEPTH_POW),
// (3) SOLVES the simple→complex transition diameter law D_t(g) = K_DT/g against Earth/Mercury/Moon anchors, and
// (4) SOLVES the complex-crater roll-off exponent P_COMPLEX against the Moon depth anchors, then verifies the full
// law is monotone-non-increasing in D and never exceeds d/D 0.25. Pure `node`. Numbers reproduce.
//
// UNITS: craterAmplitude is keyed on ANGULAR diameter δ (radians) because normalized height is planet-relative
// (v2-6 §4). d/D = A/δ is dimensionless (chord ≈ δ on the unit sphere). The simple/complex TRANSITION is in KM
// (a real-diameter, gravity-set physical property), so the complex branch reads D_km + g (both in scope in the
// writer's stamp loop — forEachCrater yields D_km). Angular-only callers (unit tests, diag) get the SIMPLE branch.

import { KM_PER_EARTH_RADIUS, radPerKm } from '../../../../src/worldengine/base/baseStep.js';

// ── OLD law (transcribed from bombardment.js) — the convicted inversion ──────────────────────────────────────
const OLD_N = 0.18, OLD_POW = 0.5, D_REF_RAD = 0.50;
const oldAmp = (d) => OLD_N * Math.pow(d / D_REF_RAD, OLD_POW);
const oldDD  = (d) => oldAmp(d) / d;                          // = 0.2546·δ^-0.5
const MESH_FLOOR_RAD = 0.055;                                 // where MOST of the ~147 stamped craters sit

console.log('=== Inc-3 crater-depth-law STEP-0 closed-form pre-check ===\n');
console.log('DEFECT reproduced: OLD d/D = 0.2546·δ^-0.5 (rising to hemispherical at the small end):');
for (const d of [D_REF_RAD, 0.25, 0.12, MESH_FLOOR_RAD]) console.log(`  δ=${d.toFixed(3)}  A=${oldAmp(d).toFixed(3)}  d/D=${oldDD(d).toFixed(3)}`);
console.log(`  ⇒ 0.36 at δ=D_REF (2× too deep), ~${oldDD(MESH_FLOOR_RAD).toFixed(2)} at the mesh floor (near-hemispherical), trend INVERTED.\n`);

// ── NEW SIMPLE regime: d/D = 0.20 CONSTANT (Pike 1977 fresh-simple) ──────────────────────────────────────────
// A_simple(δ) = D_D_SIMPLE·δ. Kept in the (δ/D_REF_RAD)^POW form ⇒ DEPTH_POW = 1.0 and
// CRATER_DEPTH_N = D_D_SIMPLE·D_REF_RAD, so A(D_REF_RAD)=CRATER_DEPTH_N (the existing invariant) is preserved.
const D_D_SIMPLE   = 0.20;
const NEW_DEPTH_POW = 1.0;
const NEW_CRATER_DEPTH_N = D_D_SIMPLE * D_REF_RAD;            // = 0.10
const MIN_BASIN_DEPTH_N = 0.08;                              // legibility floor (kept): A(D_REF) = 0.10 ≥ 0.08 ✓
console.log('NEW SIMPLE regime: d/D = 0.20 constant');
console.log(`  DEPTH_POW: 0.5 → ${NEW_DEPTH_POW.toFixed(1)}   CRATER_DEPTH_N: 0.18 → ${NEW_CRATER_DEPTH_N.toFixed(2)}  (A(δ)=${D_D_SIMPLE}·δ; A(D_REF)=${NEW_CRATER_DEPTH_N.toFixed(2)} ≥ MIN_BASIN ${MIN_BASIN_DEPTH_N})`);
const simpleBasinOK = NEW_CRATER_DEPTH_N >= MIN_BASIN_DEPTH_N;

// ── SOLVE the simple→complex transition D_t(g) = K_DT / g (km) against Earth/Mercury/Moon (Pike 1980) ─────────
// least-squares K through the anchors: minimize Σ(D_t_i − K/g_i)²  ⇒  K = Σ(D_t_i/g_i)/Σ(1/g_i²).
const DT_ANCHORS = [{ n: 'Earth', g: 1.0, Dt: 3.5 }, { n: 'Mercury', g: 0.377, Dt: 10.0 }, { n: 'Moon', g: 0.165, Dt: 18.0 }];
let num = 0, den = 0;
for (const a of DT_ANCHORS) { num += a.Dt / a.g; den += 1 / (a.g * a.g); }
const K_DT_solved = num / den;
const K_DT = Number(K_DT_solved.toPrecision(2));             // legible constant the writer bakes
const D_t = (g) => K_DT / Math.max(g, 1e-6);
console.log(`\nSOLVED K_DT = ${K_DT_solved.toFixed(3)} → baked as ${K_DT} (km·g_earth);  D_t(g) = K_DT/g`);
for (const a of DT_ANCHORS) console.log(`  ${a.n.padEnd(8)} g=${a.g}  D_t=${D_t(a.g).toFixed(1)} km  (anchor ${a.Dt} km)`);

// ── SOLVE the complex roll-off exponent P_COMPLEX against Moon depth anchors: d/D = 0.20·(D_t/D)^P for D>D_t ───
// Pike complex law d ∝ D^0.3 ⇒ d/D ∝ D^-0.7; anchored on South Pole–Aitken (the deepest-surveyed lunar basin).
const MOON_G = 0.165, DtMoon = D_t(MOON_G);
const CX_ANCHORS = [
  { n: 'SPA (Moon)',        D: 2500, dd: 0.008 },
  { n: 'Copernicus (Moon)', D: 93,   dd: 0.040 },
];
// solve P from the SINGLE cleanest anchor (SPA), cross-check the other.
const spa = CX_ANCHORS[0];
const P_solved = Math.log(spa.dd / D_D_SIMPLE) / Math.log(DtMoon / spa.D);
const P_COMPLEX = Number(P_solved.toPrecision(2));
console.log(`\nSOLVED P_COMPLEX = ${P_solved.toFixed(3)} → baked as ${P_COMPLEX}  (d/D = 0.20·(D_t/D)^P above D_t; Pike d∝D^0.3 ⇒ P≈0.7)`);
const ddComplex = (D_km, g) => { const dt = D_t(g); return D_km <= dt ? D_D_SIMPLE : D_D_SIMPLE * Math.pow(dt / D_km, P_COMPLEX); };
for (const c of CX_ANCHORS) console.log(`  ${c.n.padEnd(18)} D=${c.D}km  d/D=${ddComplex(c.D, MOON_G).toFixed(4)}  (anchor ${c.dd})`);

// ── THE FULL NEW AMPLITUDE LAW (what bombardment.js will bake) ────────────────────────────────────────────────
// A(δ, D_km, g) = D_D_SIMPLE·δ · shallow(D_km,g);  shallow = D_km>D_t ? (D_t/D_km)^P_COMPLEX : 1.
function newAmp(delta, D_km, g) {
  const simple = D_D_SIMPLE * delta;
  if (D_km == null || g == null) return simple;             // angular-only callers ⇒ simple regime (tests, diag)
  const dt = D_t(g);
  const shallow = D_km > dt ? Math.pow(dt / D_km, P_COMPLEX) : 1;
  return simple * shallow;
}
const newDD = (delta, D_km, g) => newAmp(delta, D_km, g) / delta;

// ── VERIFY across the RENDERED Moon crater range (mesh floor → basin), monotone + bounded, and SHALLOWER ───────
const R_moon = 0.273, rpk = radPerKm(R_moon);               // Moon: only δ ≥ MESH_FLOOR_RAD render
console.log('\nMoon rendered range (δ ≥ mesh floor), NEW law vs OLD (d/D):');
console.log('  δ        D_km     new d/D   old d/D   note');
let mono = true, prevDD = Infinity, maxDD = 0, fail = false;
for (const delta of [0.055, 0.10, 0.20, 0.35, 0.552]) {
  const D_km = delta / rpk;
  const nd = newDD(delta, D_km, MOON_G), od = oldDD(delta);
  if (nd > prevDD + 1e-9) mono = false;                     // must be non-increasing with D
  prevDD = nd; maxDD = Math.max(maxDD, nd);
  const note = delta === 0.055 ? '← where the OLD law was ~1.09 (hemispherical)' : (D_km > DtMoon ? 'complex' : 'simple');
  console.log(`  ${delta.toFixed(3)}   ${D_km.toFixed(0).padStart(5)}    ${nd.toFixed(4)}    ${od.toFixed(4)}   ${note}`);
}
console.log(`\nmonotone non-increasing d/D with D:  ${mono ? 'OK' : 'FAIL'}`);
console.log(`max rendered d/D = ${maxDD.toFixed(4)} ≤ 0.25:  ${maxDD <= 0.25 ? 'OK' : 'FAIL'}`);
console.log(`simple-regime basin legibility (A(D_REF) ≥ MIN_BASIN):  ${simpleBasinOK ? 'OK' : 'FAIL'}`);
// small-crater sanity: a tiny LOW-g body keeps craters SIMPLE (D_t huge ⇒ bowl-covered, Mimas-like read)
const gTiny = 0.0065, DtTiny = D_t(gTiny);
console.log(`tiny low-g body (g=${gTiny}): D_t=${DtTiny.toFixed(0)}km ⇒ rendered craters stay SIMPLE bowls (d/D=0.20) — the Mimas/Vesta lumpy-but-cratered read, NOT molten`);
if (!mono || maxDD > 0.25 || !simpleBasinOK) fail = true;

console.log(`\n${fail ? 'FAIL — depth-law constants need adjustment' : 'ALL PASS — depth law pinned: CRATER_DEPTH_N=' + NEW_CRATER_DEPTH_N.toFixed(2) + ', DEPTH_POW=' + NEW_DEPTH_POW.toFixed(1) + ', K_DT=' + K_DT + ', P_COMPLEX=' + P_COMPLEX + ' (simple d/D=0.20, complex roll-off above D_t=K_DT/g)'}`);
process.exit(fail ? 1 : 0);
