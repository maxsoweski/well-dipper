// docs/WORKSTREAMS/world-engine-v2-5-bombardment-2026-07-17/calibration/crater-drivers.mjs
// World Engine V2-5 (bombardment) — MULTIPLY driver-response calibration probe (BUILD-PLAN §7.3, §2c, §6c).
//
// PURPOSE: pin the neutral references (G_REF, AGE_REF) + the MULTIPLY exponents (K_AGE, K_GD, K_GS) and print:
//   • the count/size response to gravity + age sweeps (AC-MULTIPLY direction table; NON-STRICT monotone — the
//     round() staircase means flat steps, so ≤/≥ not </> — M-m1);
//   • the NORMALIZATION sanity check: both multipliers = 1 exactly at (G_REF, AGE_REF) (M-m6 — this confirms
//     the formula's own normalization, NOT an independent physical claim);
//   • the L-CROSSOVER per axis (§6c): the gravity / age at which the base route flips dead-lid→stagnant-lid
//     (lidStrength crosses L_STRONG) for the new preset — so the AC-LAB bounded demo window is grounded in the
//     observed number, not a guess. (The crater writer is gravity/age-INDEPENDENT of this flip: isImpactSurface
//     keeps firing; only the base terrain under the craters changes. Expected E1 physics, adjudicable — §9.)
//   • the LEGIBILITY check at the sweep EXTREMES (M-m4): the low-g/high-age corner stamps thousands of
//     overlapping craters — confirm the field stays a bounded, readable range (not runaway churn), so the
//     population is legible (AC-UAT), not merely monotone (AC-MULTIPLY).
//
// The scheduling + stamping here are TEXTUALLY the writer's; the vitest AC-MULTIPLY test re-measures the
// writer's own craterField, so calibration and writer cannot drift.
//
// METERED-SAFE: pure `node`, no `claude -p`.  Run:  node docs/WORKSTREAMS/.../calibration/crater-drivers.mjs
import alea from 'alea';
import { buildIrregularSphere } from '../../../../planet-lod-rivers.js';
import { computeE1, lidStrength, L_STRONG } from '../../../../src/worldengine/base/e1Regime.js';
import { deriveConditionVector } from '../../../../src/worldengine/base/conditionVector.js';
import { deriveUniforms } from '../../../../src/worldengine/base/labCore.js';

// ── pinned MULTIPLY constants ─────────────────────────────────────────────────────────────────────
const N_CRATERS_REF = 1800;    // crater-powerlaw.mjs
const G_REF = 0.5;             // neutral mid-body gravity (between Moon 0.165 and Earth 1.0)
const AGE_REF = 4.0;           // neutral mid surface age (Gyr)
const K_AGE = 0.5;             // older → more (√ exposure accumulation)
const K_GD = 0.7;              // lower-g → more (weaker relaxation/retention)
const K_GS = 0.17;             // lower-g → larger (physical gravity-regime scaling D ∝ g^−0.17)
// size band + profile (crater-scale.mjs / crater-powerlaw.mjs)
const D_MIN_RAD = 0.05, D_MAX_RAD = 0.50, B_SFD = 2.0;
const CRATER_DEPTH_N = 0.18, D_REF_RAD = 0.50, DEPTH_POW = 0.5;
const FLOOR_FRAC = 0.5, RIM_HEIGHT_FRAC = 0.20, EJECTA_FRAC = 0.05, RIM_W = 0.1, RIM_FRAC = 1.0;
// Bounded superposition (M-m4): the raw += churns to −1.5 (7.5× a basin depth) at the low-g/high-age corner;
// a soft tanh saturation caps the deepest overlaps to ±CRATER_SAT_N (models empirical crater saturation —
// the roughness plateau of a battered highland) while leaving isolated basins ~untouched and preserving sign
// + node ordering (so the #6 editor can still threshold floors). SAT ≈ 2.3× the despun p95−p5 span.
const CRATER_SAT_N = 0.5;
const saturate = (v) => CRATER_SAT_N * Math.tanh(v / CRATER_SAT_N);

const nCratersOf = (g, age) => Math.round(N_CRATERS_REF * Math.pow(age / AGE_REF, K_AGE) * Math.pow(G_REF / g, K_GD));
const sizeMulOf = (g) => Math.pow(G_REF / g, K_GS);
const ageMul = (age) => Math.pow(age / AGE_REF, K_AGE);
const gdMul = (g) => Math.pow(G_REF / g, K_GD);

// candidate stamping (for the extreme-corner legibility check)
const RATIO_POW = Math.pow(D_MIN_RAD / D_MAX_RAD, B_SFD);
const drawPowerLaw = (rng) => D_MIN_RAD * Math.pow(1 - rng() * (1 - RATIO_POW), -1 / B_SFD);
const craterAmplitude = (D) => CRATER_DEPTH_N * Math.pow(D / D_REF_RAD, DEPTH_POW);
function craterProfile(s, D) {
  const A = craterAmplitude(D), r = 0.5 * D, floorEdge = FLOOR_FRAC * r;
  const rimH = RIM_HEIGHT_FRAC * A, ejH = EJECTA_FRAC * A, rimEnd = r + RIM_W * D, ejEnd = r + RIM_FRAC * D;
  if (s < floorEdge) return -A;
  if (s < r) { const t = (s - floorEdge) / (r - floorEdge); return -A + t * (A + rimH); }
  if (s < rimEnd) { const t = (s - r) / (rimEnd - r); return rimH + t * (ejH - rimH); }
  if (s < ejEnd) { const t = (s - rimEnd) / (ejEnd - rimEnd); return ejH * (1 - t); }
  return 0;
}
function stampField(mesh, g, age, seed) {
  const { verts, adj } = mesh; const N = verts.length;
  const field = new Float64Array(N);
  const rng = alea('bombard:' + (seed | 0));
  const n = nCratersOf(g, age), sizeMul = sizeMulOf(g);
  const seen = new Int32Array(N); let epoch = 0;
  const queue = new Int32Array(N);
  for (let c = 0; c < n; c++) {
    const centre = Math.floor(rng() * N);
    const D = drawPowerLaw(rng) * sizeMul;
    const R = 0.5 * D + RIM_FRAC * D;
    const cv = verts[centre];
    epoch++; let qh = 0, qt = 0; queue[qt++] = centre; seen[centre] = epoch;
    while (qh < qt) {
      const j = queue[qh++]; const vj = verts[j];
      let dot = cv[0]*vj[0]+cv[1]*vj[1]+cv[2]*vj[2]; dot = dot > 1 ? 1 : dot < -1 ? -1 : dot;
      const s = Math.acos(dot);
      if (s > R) continue;
      field[j] += craterProfile(s, D);
      for (const nb of adj[j]) if (seen[nb] !== epoch) { seen[nb] = epoch; queue[qt++] = nb; }
    }
  }
  for (let i = 0; i < N; i++) field[i] = saturate(field[i]);   // bounded superposition (M-m4)
  let mn = Infinity, mx = -Infinity, sum = 0; for (let i = 0; i < N; i++) { const v = field[i]; if (v < mn) mn = v; if (v > mx) mx = v; sum += v; }
  const mean = sum / N; let v = 0; for (let i = 0; i < N; i++) { const d = field[i] - mean; v += d * d; } v /= N;
  return { n, sizeMul, min: mn, max: mx, variance: v, std: Math.sqrt(v) };
}

// Moon/Mercury condition (§5 preset — constructed inline; NOT yet in DRIVER_PRESETS, added in SLICE 2)
const MOON_FP = {
  radiusEarth: 0.38, massEarth: 0.04, eccentricity: 0.05, starMassEarth: 332946, orbitRadiusEarth: 117275,
  composition: { ironFraction: 0.4, density: 4.5, volatileFraction: 0.02 }, age: 4.5, T_eq: 235,
  tidalState: { locked: false }, atmosphere: null, habitability: 0,
  surfaceHistory: { erosion: 0.05, bombardmentIntensity: 0.9, resurfacingRate: 0.05 },
};
const MOON_U = deriveUniforms(MOON_FP, 1.0);
const baseCV = () => deriveConditionVector(MOON_FP, MOON_U, MOON_FP.radiusEarth);
const MOON_G = MOON_FP.massEarth / (MOON_FP.radiusEarth * MOON_FP.radiusEarth);

const out = [];
const p = (s) => out.push(s);
p('══════════════════════════════════════════════════════════════════════════════════════════════════');
p('  V2-5 BOMBARDMENT — MULTIPLY driver-response calibration  (crater-drivers.mjs — BUILD-PLAN §7.3)');
p(`  G_REF=${G_REF} AGE_REF=${AGE_REF}  K_AGE=${K_AGE} K_GD=${K_GD} K_GS=${K_GS}  N_CRATERS_REF=${N_CRATERS_REF}`);
p(`  new-preset native point: g=${MOON_G.toFixed(3)}  age=${MOON_FP.age}`);
p('══════════════════════════════════════════════════════════════════════════════════════════════════');

// (0) normalization sanity
p('');
p('── NORMALIZATION (M-m6 — the formula\'s own normalization, not a physical claim) ────────────────────');
p(`  at (G_REF, AGE_REF): ageMul=${ageMul(AGE_REF).toFixed(4)}  gdMul=${gdMul(G_REF).toFixed(4)}  sizeMul=${sizeMulOf(G_REF).toFixed(4)}  nCraters=${nCratersOf(G_REF, AGE_REF)}  (all ≈1 / =N_CRATERS_REF)`);

// (1) gravity sweep (age = MOON native)
p('');
p('── GRAVITY sweep (age fixed at new-preset native; ↓g ⇒ ↑count & ↑size — non-strict monotone) ───────');
p('     g      nCraters   sizeMul');
let gMonoOK = true; let prevN = Infinity, prevS = Infinity;
for (const g of [0.10, 0.20, 0.30, 0.50, 0.85, 1.5, 3.0]) {
  const n = nCratersOf(g, MOON_FP.age), s = sizeMulOf(g);
  if (n > prevN + 1e-9 || s > prevS + 1e-9) gMonoOK = false;   // must be non-increasing as g↑
  prevN = n; prevS = s;
  p(`   ${g.toFixed(2).padStart(5)}   ${String(n).padStart(7)}   ${s.toFixed(4)}`);
}
p(`  ASSERT non-increasing count & size as g↑ : ${gMonoOK ? 'PASS' : 'FAIL'}`);

// (2) age sweep (g = MOON native)
p('');
p('── AGE sweep (g fixed at new-preset native; ↑age ⇒ ↑count; size age-independent) ───────────────────');
p('    age     nCraters   sizeMul');
let ageMonoOK = true; prevN = -Infinity;
for (const age of [1.0, 2.0, 4.0, 6.0, 8.5, 10.0]) {
  const n = nCratersOf(MOON_G, age), s = sizeMulOf(MOON_G);
  if (n < prevN - 1e-9) ageMonoOK = false;   // must be non-decreasing as age↑
  prevN = n;
  p(`   ${age.toFixed(1).padStart(5)}   ${String(n).padStart(7)}   ${s.toFixed(4)}`);
}
p(`  ASSERT non-decreasing count as age↑ : ${ageMonoOK ? 'PASS' : 'FAIL'}`);

// (3) L-crossover per axis (§6c) — where does the base route flip dead-lid → stagnant?
p('');
p('── L-CROSSOVER (§6c — base route flip; craters keep firing, only the terrain UNDER them changes) ───');
function regimeAt(mut) { const cv = baseCV(); Object.assign(cv, mut); return { L: lidStrength(cv), regime: computeE1(cv, 1).geodynamicRegime }; }
p(`  L_STRONG = ${L_STRONG}`);
p('  gravity axis (age native):  g → L, regime');
let gCross = null;
for (const g of [0.10, 0.30, 0.50, 0.70, 0.85, 1.0, 1.2, 1.5, 2.0, 3.0]) {
  const { L, regime } = regimeAt({ surfaceGravity: g });
  if (gCross === null && regime !== 'dead-lid') gCross = g;
  p(`     g=${g.toFixed(2)}  L=${L.toFixed(3)}  ${regime}`);
}
p(`  age axis (g native):  age → L, regime`);
let ageCross = null;
for (const age of [1.0, 2.0, 4.0, 6.0, 8.0, 8.5, 9.0, 10.0]) {
  const { L, regime } = regimeAt({ age });
  if (ageCross === null && regime !== 'dead-lid') ageCross = age;
  p(`     age=${age.toFixed(1)}  L=${L.toFixed(3)}  ${regime}`);
}
p(`  ⇒ dead-lid window (native other-scalars): gravity < ${gCross ?? '>3.0'}  ,  age < ${ageCross ?? '>10'}`);
p(`  ⇒ AC-LAB bounded demo sweep (BUILD-PLAN §6c): gravity ≈ [0.1, 0.85], age ≈ [1, 8.5] (inside the window)`);

// (4) legibility at the sweep extremes (M-m4)
p('');
p('── LEGIBILITY at the sweep extremes (M-m4 — bounded, readable range; not runaway churn) ────────────');
const legMesh = buildIrregularSphere(8000, 2);
const corners = [
  { name: 'low-g / high-age (max craters)', g: 0.10, age: 8.5 },
  { name: 'native (Moon/Mercury)         ', g: MOON_G, age: MOON_FP.age },
  { name: 'high-g / low-age (min craters)', g: 1.50, age: 1.0 },
];
p('   corner                              nCraters  sizeMul   fieldMin   fieldMax   std      |min|/A(Dmax)');
let legOK = true;
for (const c of corners) {
  const r = stampField(legMesh, c.g, c.age, 1);
  const ratio = Math.abs(r.min) / craterAmplitude(D_MAX_RAD * r.sizeMul);
  // legible = finite AND the deepest overlap is within a few basin-depths (bounded superposition, not churn)
  const ok = Number.isFinite(r.min) && Number.isFinite(r.max) && ratio < 6;
  legOK = legOK && ok;
  p(`   ${c.name}   ${String(r.n).padStart(7)}   ${r.sizeMul.toFixed(4)}   ${r.min.toFixed(4).padStart(8)}   ${r.max.toFixed(4).padStart(7)}   ${r.std.toFixed(4)}   ${ratio.toFixed(2)}  ${ok ? 'OK' : 'CHURN'}`);
}
p(`  ASSERT field bounded/legible at both extremes : ${legOK ? 'PASS' : 'FAIL — cap superposition or lower N_CRATERS_REF'}`);

p('');
p('── BAKED CONSTANTS (copy into src/worldengine/base/bombardment.js) ─────────────────────────────────');
p(`  G_REF          = ${G_REF}`);
p(`  AGE_REF        = ${AGE_REF}`);
p(`  K_AGE          = ${K_AGE}`);
p(`  K_GD           = ${K_GD}`);
p(`  K_GS           = ${K_GS}`);
p(`  CRATER_SAT_N   = ${CRATER_SAT_N}`);
p('');
p(`  OVERALL: ${gMonoOK && ageMonoOK && legOK ? 'ALL PASS' : 'FAIL — retune'}`);
p('══════════════════════════════════════════════════════════════════════════════════════════════════');
process.stdout.write(out.join('\n') + '\n');
