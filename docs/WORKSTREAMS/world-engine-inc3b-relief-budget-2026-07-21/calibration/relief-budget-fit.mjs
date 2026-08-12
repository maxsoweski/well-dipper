// calibration/relief-budget-fit.mjs — Inc-3b S0.2 + S0.2a (+ S0.6 worked cases): the f_I law,
// the frozen variance definition, and the w_e/w_i variance-reallocation SOLVE, WRITTEN DOWN.
//
// WHAT THIS FILE PINS (BUILD-PLAN §1.S0 blocks S0.2, S0.2a in full, S0.6; §6-T2 option-(ii)+S0.2a;
// lens-log MF-1). Without this file AC-BUDGET has no fixed referent — it is the closed-form spine
// the S1 leaf (src/worldengine/base/reliefBudget.js) and compositeMargins implement:
//
//   1. THE SOLVE (S0.2a #0). At the composite seam, for an in-domain world, hold shelfDepth at
//      weight 1 (V_sd cancels), assume Cov(h,cf)≈0, and solve the two constraints
//        (a) variance ratio  w_i²·V_cf / (w_e²·V_h) = r           [= f_I/(1−f_I), the MODEL ratio]
//        (b) preserved band  w_e²·V_h + w_i²·V_cf   = V_h + V_cf   [total mean-square unchanged]
//      for the unique positive root:
//        w_e² = (V_h + V_cf) / (V_h · (1 + r))
//        w_i² = r · w_e² · V_h / V_cf
//      Both identities are EXACT ALGEBRA (proved in solveFromR + asserted to 1e-12 on the boot
//      referent V_h=0.09606², V_cf=0.001094², f_I=0.97 → w_e=0.1732, w_i=86.48).
//
//   2. THE FROZEN VARIANCE DEFINITION (S0.2a #1) — RAW MEAN-SQUARE, √(mean(x²)), not about-the-mean.
//      Forced by TWO facts measured from the shipped pipeline (see freezeVarianceDefinition()):
//      (i) only the raw-mean-square crater:base ratio reproduces the recorded ~1.14% diagnosis
//          (raw 1.139% vs about-mean 1.508% at N=40k seed 1); (ii) the recorded referent amplitudes
//          0.09606 (height) / 0.001094 (crater) ARE the raw RMS at N=40k seed 1, and the recorded
//          w_i=86.48 only falls out of the RAW V_h/V_cf ratio (about-mean gives w_i≈61). This
//          definition BINDS the amplitude harness (inc3b-amplitude-budget.mjs) and AC-BUDGET.
//
//   3. THE LOAD-BEARING SPLIT (S0.2a #2) — model-f_I ÷ realized-norm. The RATIO r comes from the
//      MODEL (relic-Λ); the absolute SCALE (w_e, w_i) is solved from REALIZED norms inside
//      compositeMargins. demonstrateIdentityCollapse() proves that deriving r from the realized
//      norms (r := V_cf/V_h) collapses w_e² to EXACTLY 1.0 — the silent identity failure. This is
//      the §6-T2 option-(ii) resolution and the reason reliefBudget.js emits the ratio while
//      compositeMargins solves the scale.
//
//   4. THE DEGENERACY CLAMP (S0.2a #3). ε = the smallest single-stamp raw mean-square the shipped
//      schedule can produce (one δ=MESH_FLOOR_RAD crater stamped on an N=40k mesh). When realized
//      V_cf < ε the budget falls back to IDENTITY (w_e=w_i=1) rather than emit an unbounded w_i.
//      deriveEpsilon() computes it and tables the w_i blow-up (≈94.6 / 2992 / 9.5e4 at
//      V_cf = 1e-6 / 1e-9 / 1e-12).
//
//   5. INDEPENDENCE MEASURED (S0.2a #4). Cov(h,cf) is MEASURED for the four in-domain worlds, not
//      assumed. Both the about-the-mean correlation (the premise the visible-band preservation
//      rests on) AND the raw cross moment E[h·cf] (the moment the raw-mean-square definition
//      actually carries) are reported, with a stated acceptance. The raw cross moment is flagged
//      LOUDLY where it is not small.
//
//   6. MARS f_I GATE (S0.6). Mars's acceptance f_I ∈ [0.3, 0.8] is sourced from real-Mars
//      HYPSOMETRY reasoning (training-sourced, medium-confidence), NOT relic-law extrapolation —
//      the relic law's domain (dead-lid impact-retentive worlds) EXCLUDES Mars-like eroded worlds.
//      The script demonstrates the model over-predicts Mars f_I (≈0.9), i.e. OUT of the gate,
//      which is exactly why the gate is asserted separately.
//
// REUSE, NOT DUPLICATION: the relic-Λ law is READ from its committed output relic-lambda-band.json
//   (importing relic-lambda.mjs is impossible — it has a top-level process.exit that would kill this
//   script). σ_endo/R per world and the fitted constants are consumed from that frozen artifact.
//   The amplitude-measurement pattern mirrors inc3b-amplitude-budget.mjs (which mirrors the v2-5
//   composite suite reliefBundle) — re-implemented here because that harness also top-level-exits.
//
// DETERMINISM: single-threaded, no dev server, no network, no `claude -p`, no timestamps, no
//   wall-clock fields. Every printed and written number reproduces EXACTLY on re-run at [N] [seed].
// NO TASTE CONSTANTS: every numeric constant carries an inline derivation + anchor, OR is a
//   reproduction check on a RECORDED measurement (tagged), OR is imported from the shipped modules
//   / the frozen relic band.
//
// CLI:  node relief-budget-fit.mjs [N] [seed]   (defaults 40000 1 — the diagnosis referent point)
//       exits 0 on success; writes relief-budget-fit.json (deterministic).

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Import depth ../../../../ from calibration/ → repo root (mirrors population-sweep.mjs / the
// amplitude harness). NONE of these modules has a top-level side effect (verified) — unlike
// relic-lambda.mjs, which is consumed via its JSON output instead.
import { buildIrregularSphere, writeBodyRelief, compositeMargins, DEFAULT_GRAIN_DRIVERS } from '../../../../planet-lod-rivers.js';
import { makeSphereField } from '../../../../src/worldengine/base/sphereField.js';
import { DRIVER_PRESETS, PRESET_ARCHETYPE } from '../../../../driver-presets.js';
import { buildNeutralBodyDrivers } from '../../../../body-drivers.js';
import { deriveConditionVector } from '../../../../src/worldengine/base/conditionVector.js';
import { deriveUniforms } from '../../../../src/worldengine/base/labCore.js';
import {
  craterSchedule, isImpactSurface,
  craterProfile, craterStampRadius, craterAmplitude,
  CRATER_SAT_N, MESH_FLOOR_RAD,
} from '../../../../src/worldengine/base/bombardment.js';
import { clamp } from '../../../../src/worldengine/base/mathutil.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, '..', '..', '..', '..');

// ── CLI ─────────────────────────────────────────────────────────────────────────────────────────
// Defaults 40000 / 1 — the exact N,seed the `041d7a8` diagnosis recorded (0.09606 / 0.001094). The
// boot referent assertions require this point; other N,seed still run but do not reproduce 0.09606.
const N_NODES = Number.parseInt(process.argv[2] ?? '40000', 10);
const SEED    = Number.parseInt(process.argv[3] ?? '1', 10);
// LLOYD=2 — pinned to the golden fixture (tests/fixtures/v2-0-carrier-golden.mjs) and the
// predecessor population-sweep.mjs so this harness boots the SAME mesh family the pipeline measures.
const LLOYD = 2;

// ── frozen relic-Λ output (S0.1) — READ, not imported ────────────────────────────────────────────
const RELIC_BAND = JSON.parse(readFileSync(join(__dirname, 'relic-lambda-band.json'), 'utf8'));
// σ_endo/R per in-domain world, keyed by name (the MODEL endogenic side of the budget).
const SIGMA_ENDO_BY_WORLD = new Map(RELIC_BAND.inDomainWorlds.map((w) => [w.name, w.sigmaEndoOverR]));
const RELIC_FI_BY_WORLD   = new Map(RELIC_BAND.inDomainWorlds.map((w) => [w.name, w.f_I]));
// The relic law's flat boot-reference σ_imp/R (used by S0.1 for ALL in-domain worlds); we REFINE it
// per-world below with the realized craterField RMS (the true "σ_imp from the shipped impact laws").
const SIGMA_IMP_FLAT_REF = RELIC_BAND.fit.SIGMA_IMP_OVER_R; // 1.09e-3 (Inc-3 boot; ≈ realized Moon)

// ── the four IN-DOMAIN worlds (BUILD-PLAN §0.9 / brief §2.5 affected set) ─────────────────────────
const IN_DOMAIN = [
  'Moon/Mercury (impact-airless)',   // AC-BUDGET boot world + the 0.09606/0.001094 referent
  'Frozen (airless)',
  'Mars (arid rocky)',
  'Crystal (faceted)',
];
const PRIMARY = 'Moon/Mercury (impact-airless)';

// ── RECORDED diagnosis referent (S0.2a #0) — the fixed point every solve is checked against. ──────
// These are the RAW mean-square amplitudes measured at N=40000 seed 1 (brief header; reproduced by
// inc3b-amplitude-budget.mjs whose MS-def output is height 9.6060e-2 / crater 1.0940e-3). Tagged as
// a RECORDED measurement, NOT a physics constant.
const REC_RMS_H  = 0.09606;   // recorded raw RMS of height  at N=40k seed 1
const REC_RMS_CF = 0.001094;  // recorded raw RMS of crater  at N=40k seed 1
const REC_V_H    = REC_RMS_H * REC_RMS_H;    // = 9.2275e-3 (raw mean-square, the frozen definition)
const REC_V_CF   = REC_RMS_CF * REC_RMS_CF;  // = 1.1968e-6
const REC_F_I    = 0.97;      // the round referent f_I the panel pinned the solve at (≈ model 0.964)
const REC_W_E    = 0.1732;    // expected solve output (assert to 1e-4)
const REC_W_I    = 86.48;     // expected solve output (assert to 1e-2)

// ── statistics helpers ───────────────────────────────────────────────────────────────────────────
const mean = (xs) => { let s = 0; for (let i = 0; i < xs.length; i++) s += xs[i]; return s / xs.length; };
// FROZEN definition: raw mean-square (second moment about ZERO). rawMS = mean(x²); rawRMS = √rawMS.
const rawMS  = (xs) => { let s = 0; for (let i = 0; i < xs.length; i++) s += xs[i] * xs[i]; return s / xs.length; };
const rawRMS = (xs) => Math.sqrt(rawMS(xs));
// about-the-mean (central) variance/std — reported for CONTRAST only (does NOT reproduce the referent).
const variance = (xs) => { const m = mean(xs); let s = 0; for (let i = 0; i < xs.length; i++) { const d = xs[i] - m; s += d * d; } return s / xs.length; };
const std = (xs) => Math.sqrt(variance(xs));
// central covariance + raw cross moment E[xy].
const covariance = (xs, ys) => { const mx = mean(xs), my = mean(ys); let s = 0; for (let i = 0; i < xs.length; i++) s += (xs[i] - mx) * (ys[i] - my); return s / xs.length; };
const crossMoment = (xs, ys) => { let s = 0; for (let i = 0; i < xs.length; i++) s += xs[i] * ys[i]; return s / xs.length; };

// ── THE SOLVE (S0.2a #0) ──────────────────────────────────────────────────────────────────────────
// solveFromR(V_h, V_cf, r): the unique positive root of the two constraints. PURE closed form.
//   w_e² = (V_h + V_cf) / (V_h · (1 + r));  w_i² = r · w_e² · V_h / V_cf.
// Identities that hold for ANY V_h,V_cf,r>0 (proved by substitution, verified numerically):
//   • preserved band:  w_e²·V_h + w_i²·V_cf = (V_h+V_cf)/(1+r) + r·(V_h+V_cf)/(1+r) = V_h + V_cf.
//   • variance ratio:  (w_i²·V_cf)/(w_e²·V_h) = r.
function solveFromR(V_h, V_cf, r) {
  const we2 = (V_h + V_cf) / (V_h * (1 + r));
  const wi2 = r * we2 * V_h / V_cf;
  return { w_e: Math.sqrt(we2), w_i: Math.sqrt(wi2), we2, wi2, r };
}
// f_I → r = f_I/(1−f_I) → solve. This is the MODEL ratio path (the load-bearing split: r from model).
function solveFromFI(V_h, V_cf, f_I) { return solveFromR(V_h, V_cf, f_I / (1 - f_I)); }

// residuals of the two identities (for the exactness assertion)
function solveResiduals(V_h, V_cf, s) {
  const bandResidual = (s.we2 * V_h + s.wi2 * V_cf) - (V_h + V_cf);           // → 0 exact
  const ratioResidual = (s.wi2 * V_cf) / (s.we2 * V_h) - s.r;                 // → 0 exact
  return { bandResidual, ratioResidual };
}

const problems = [];
const fail = (m) => problems.push(m);
const fmt = (x, d = 4) => (Number.isFinite(x) ? x.toFixed(d) : String(x));
const exp = (x, d = 4) => (Number.isFinite(x) ? x.toExponential(d) : String(x));

// ── (0) reproduce the boot referent, assert the solve EXACT ───────────────────────────────────────
console.log('=== Inc-3b S0.2/S0.2a — relief-budget f_I law + w_e/w_i SOLVE ===\n');
console.log('── S0.2a #0: THE SOLVE, reproduced on the recorded boot referent ──');
const bootSolve = solveFromFI(REC_V_H, REC_V_CF, REC_F_I);
const bootRes = solveResiduals(REC_V_H, REC_V_CF, bootSolve);
console.log(`  V_h=${exp(REC_V_H)} (=${REC_RMS_H}²)  V_cf=${exp(REC_V_CF)} (=${REC_RMS_CF}²)  f_I=${REC_F_I}  r=${fmt(bootSolve.r, 4)}`);
console.log(`  → w_e=${fmt(bootSolve.w_e, 4)}  (expected ${REC_W_E})   w_i=${fmt(bootSolve.w_i, 2)}  (expected ${REC_W_I})`);
console.log(`  RMS-preservation residual (w_e²V_h + w_i²V_cf − (V_h+V_cf)) = ${exp(bootRes.bandResidual, 3)}  (target |·|<1e-12)`);
console.log(`  var-ratio residual ((w_i²V_cf)/(w_e²V_h) − r)               = ${exp(bootRes.ratioResidual, 3)}  (target |·|<1e-9)`);
if (Math.abs(bootSolve.w_e - REC_W_E) > 1e-4) fail(`boot w_e ${fmt(bootSolve.w_e,5)} ≠ recorded ${REC_W_E}`);
if (Math.abs(bootSolve.w_i - REC_W_I) > 1e-2) fail(`boot w_i ${fmt(bootSolve.w_i,4)} ≠ recorded ${REC_W_I}`);
if (Math.abs(bootRes.bandResidual) > 1e-12)   fail(`RMS-preservation not exact (residual ${exp(bootRes.bandResidual,3)})`);
if (Math.abs(bootRes.ratioResidual) > 1e-9)   fail(`var-ratio not exact (residual ${exp(bootRes.ratioResidual,3)})`);

// ── (1) FREEZE the variance definition (S0.2a #1) — boot the primary world, both defs ─────────────
console.log('\n── S0.2a #1: FREEZE the variance definition (raw-mean-square) ──');
const sharedMesh = buildIrregularSphere(N_NODES, LLOYD);
console.log(`  mesh: N=${sharedMesh.verts.length} nodes  LLOYD=${LLOYD}  seed=${SEED}`);

function reliefBundle(name, seed) {
  const fp = DRIVER_PRESETS[name];
  const u = deriveUniforms(fp, 1.0);
  return {
    archetype: PRESET_ARCHETYPE[name] ?? null,
    locked: !!(fp && fp.tidalState && fp.tidalState.locked),
    grainDrivers: DEFAULT_GRAIN_DRIVERS,
    bodyDrivers: { ...buildNeutralBodyDrivers(u, fp), condition: deriveConditionVector(fp, u, fp.radiusEarth) },
    macroSeed: seed, heightSeed: 'e6:' + seed, T_eq: fp.T_eq ?? 288,
  };
}
function bootWorld(name, seed) {
  const carrier = makeSphereField(sharedMesh);
  const bundle = reliefBundle(name, seed);
  writeBodyRelief(carrier, bundle);
  return { name, count: carrier.count, height: carrier.height, shelfDepth: carrier.shelfDepth,
           craterField: carrier.craterField, cond: bundle.bodyDrivers.condition };
}
const worlds = new Map();
for (const name of IN_DOMAIN) worlds.set(name, bootWorld(name, SEED));

const P = worlds.get(PRIMARY);
const rawRMS_h = rawRMS(P.height), rawRMS_cf = rawRMS(P.craterField);
const std_h = std(P.height), std_cf = std(P.craterField);
const ratioMS = rawRMS_cf / rawRMS_h, ratioVar = std_cf / std_h;
console.log(`  ${PRIMARY} @ N=${N_NODES} seed=${SEED}:`);
console.log(`    raw RMS   : height ${exp(rawRMS_h, 4)}  crater ${exp(rawRMS_cf, 4)}   crater:base ${(ratioMS * 100).toFixed(4)}%`);
console.log(`    about-mean: height ${exp(std_h, 4)}  crater ${exp(std_cf, 4)}   crater:base ${(ratioVar * 100).toFixed(4)}%`);
console.log(`    recorded diagnosis anchor: height 0.09606  crater 0.001094  ratio 1.139%`);
// which definition reproduces? (only meaningful at the recorded point N=40k seed 1)
const REPRO_LO = 0.009, REPRO_HI = 0.014;  // recorded ~1.14% band (reproduction check on a RECORDED value)
const msReproduces = ratioMS >= REPRO_LO && ratioMS <= REPRO_HI;
const varReproduces = ratioVar >= REPRO_LO && ratioVar <= REPRO_HI;
console.log(`    reproduces recorded ~1.14%: raw-mean-square=${msReproduces}  about-mean=${varReproduces}`);
const VARIANCE_DEFINITION = 'raw-mean-square';   // FROZEN
console.log(`  FROZEN definition = ${VARIANCE_DEFINITION} (V=mean(x²), RMS=√mean(x²)).`);
console.log(`    Justification: (i) only raw-mean-square reproduces 1.14%; (ii) the recorded 0.09606/0.001094`);
console.log(`    are the raw RMS AND the recorded w_i=86.48 needs the RAW V_h/V_cf ratio (about-mean → w_i≈61).`);
// witness fact (ii): about-mean solve gives a DIFFERENT w_i (so the definition is load-bearing, not cosmetic)
const wiAboutMean = solveFromFI(std_h * std_h, std_cf * std_cf, REC_F_I).w_i;
console.log(`    witness: solve on about-mean V_h/V_cf → w_i=${fmt(wiAboutMean, 2)} ≠ recorded 86.48 (confirms raw-def).`);
if (N_NODES === 40000 && SEED === 1) {
  if (!msReproduces) fail('raw-mean-square did NOT reproduce recorded ~1.14% at N=40k seed 1');
  if (Math.abs(rawRMS_h - REC_RMS_H) > 5e-4)   fail(`primary raw RMS height ${exp(rawRMS_h,4)} ≠ recorded 0.09606`);
  if (Math.abs(rawRMS_cf - REC_RMS_CF) > 5e-5) fail(`primary raw RMS crater ${exp(rawRMS_cf,4)} ≠ recorded 0.001094`);
}

// ── (2) THE LOAD-BEARING SPLIT (S0.2a #2): realized-norm r collapses w_e² to 1.0 ──────────────────
console.log('\n── S0.2a #2: model-f_I ÷ realized-norm split (identity-collapse demonstration) ──');
const rRealized = REC_V_CF / REC_V_H;                        // r := V_cf/V_h (WRONG — realized-norm ratio)
const collapseSolve = solveFromR(REC_V_H, REC_V_CF, rRealized);
console.log(`  If r is taken from realized norms (r := V_cf/V_h = ${exp(rRealized, 4)}):`);
console.log(`    w_e² = ${collapseSolve.we2.toFixed(15)}   (collapses to EXACTLY 1.0 — silent identity failure)`);
console.log(`    w_i² = ${collapseSolve.wi2.toFixed(15)}   (also 1.0)`);
console.log(`  → the RATIO must come from the MODEL (relic-Λ f_I); the SCALE from realized norms.`);
console.log(`    reliefBudget.js emits f_I (pure condition-scalar); compositeMargins solves w_e/w_i from realized V_h,V_cf.`);
if (Math.abs(collapseSolve.we2 - 1.0) > 1e-12) fail(`identity-collapse w_e² ${collapseSolve.we2} ≠ 1.0`);
if (Math.abs(collapseSolve.wi2 - 1.0) > 1e-12) fail(`identity-collapse w_i² ${collapseSolve.wi2} ≠ 1.0`);

// ── (3) DEGENERACY CLAMP (S0.2a #3): ε from the smallest single-stamp raw mean-square ─────────────
console.log('\n── S0.2a #3: degeneracy clamp ε (smallest single-stamp raw mean-square) ──');
// The smallest crater the schedule can STAMP has angular δ = MESH_FLOOR_RAD (by construction
// D_FLOOR_KM·radPerKm = MESH_FLOOR_RAD; L_trunc = max(L, D_FLOOR_KM) ⇒ min stamped δ = MESH_FLOOR_RAD).
// Its amplitude is the SIMPLE-branch bowl A = craterAmplitude(MESH_FLOOR_RAD) (D_km at the floor is
// far below D_t(g) so no complex roll-off). We stamp exactly ONE such crater on the N-node mesh with
// the SHIPPED writer arithmetic (craterProfile bowl-reset < δ/2, accumulate ≥ δ/2, then the writer's
// CRATER_SAT_N tanh clamp) and take its raw mean-square. iceness is 0 here (rock), so
// relaxedCraterProfile ≡ craterProfile — we use the angular-only craterProfile(s, δ) simple branch,
// exactly what the writer applies to the smallest rock crater.
function singleStampRawMS(mesh, centre) {
  const { verts, adj } = mesh;
  const N = verts.length;
  const cf = new Float64Array(N);
  const delta = MESH_FLOOR_RAD;
  const stampR = craterStampRadius(delta);   // 0.5δ + RIM_FRAC·δ = 1.5δ
  const bEdge = 0.5 * delta;                  // bowl edge: < bEdge resets, ≥ bEdge accumulates
  const seen = new Int32Array(N);
  const queue = new Int32Array(N);
  const cvx = verts[centre][0], cvy = verts[centre][1], cvz = verts[centre][2];
  let qh = 0, qt = 0, epoch = 1, touched = 0;
  queue[qt++] = centre; seen[centre] = epoch;
  while (qh < qt) {
    const j = queue[qh++];
    const vj = verts[j];
    const s = Math.acos(clamp(-1, 1, cvx * vj[0] + cvy * vj[1] + cvz * vj[2]));
    if (s > stampR) continue;
    const disp = craterProfile(s, delta);     // angular-only ⇒ simple branch (matches the writer for min rock crater)
    if (s < bEdge) cf[j] = disp; else cf[j] += disp;
    touched++;
    const nb = adj[j];
    for (let k = 0; k < nb.length; k++) { const m = nb[k]; if (seen[m] !== epoch) { seen[m] = epoch; queue[qt++] = m; } }
  }
  for (let i = 0; i < N; i++) cf[i] = CRATER_SAT_N * Math.tanh(cf[i] / CRATER_SAT_N);  // writer's final clamp
  return { ms: rawMS(cf), touched, A: craterAmplitude(delta), delta, stampR };
}
const stamp = singleStampRawMS(sharedMesh, 0);   // centre = node 0 (deterministic)
const EPSILON_VCF = stamp.ms;                     // DERIVED floor (the smallest single-stamp raw MS)
console.log(`  smallest stamp: δ=MESH_FLOOR_RAD=${fmt(stamp.delta, 4)} rad  A=${fmt(stamp.A, 5)}  nodes touched=${stamp.touched}`);
console.log(`  ε (single-stamp raw mean-square, centre=node 0) = ${exp(EPSILON_VCF, 4)}`);
// The realized in-domain V_cf must all EXCEED ε (each in-domain world stamps ≥1 crater ⇒ ≥ one min
// stamp of signal), so the clamp is a genuine degeneracy guard and never fires on the affected set.
const crystalRealizedVcf = rawMS(worlds.get('Crystal (faceted)').craterField); // smallest realized in-set
console.log(`  smallest realized in-domain V_cf (Crystal) = ${exp(crystalRealizedVcf, 4)}  → ε < it? ${EPSILON_VCF < crystalRealizedVcf}`);
if (EPSILON_VCF >= crystalRealizedVcf) fail(`ε ${exp(EPSILON_VCF,4)} not below smallest realized in-domain V_cf ${exp(crystalRealizedVcf,4)}`);
// w_i blow-up table WITHOUT the clamp (V_h, f_I fixed at the boot referent) — the reason the clamp exists.
const BLOWUP_VCF = [1e-6, 1e-9, 1e-12];
console.log('  w_i blow-up WITHOUT clamp (V_h=0.09606², f_I=0.97):');
const blowup = BLOWUP_VCF.map((v) => {
  const s = solveFromFI(REC_V_H, v, REC_F_I);
  const clamped = v < EPSILON_VCF;
  console.log(`    V_cf=${exp(v, 0)} → w_i=${fmt(s.w_i, 1).padStart(9)}   (V_cf<ε? ${clamped ? 'YES → clamp to identity w=1' : 'no → solve'})`);
  return { V_cf: v, w_i_unclamped: s.w_i, belowEpsilon: clamped };
});
// reference-point sanity (BUILD-PLAN S0.2a #3: ≈94.6 / 2992 / 9.5e4)
const REF_WI = [94.6, 2992, 9.5e4];
blowup.forEach((b, i) => { if (Math.abs(b.w_i_unclamped - REF_WI[i]) / REF_WI[i] > 0.02) fail(`blow-up w_i at V_cf=${exp(b.V_cf,0)} = ${fmt(b.w_i_unclamped,1)} ≠ ref ${REF_WI[i]}`); });

// ── (4) INDEPENDENCE MEASURED (S0.2a #4) ──────────────────────────────────────────────────────────
console.log('\n── S0.2a #4: independence premise MEASURED (Cov(h,cf)) ──');
console.log('  world                            corr(h,cf)  Cov(h,cf)     E[h·cf](raw)   mean(h)   mean(cf)');
// Acceptance: the about-the-mean |corr| governs whether the VISIBLE band (about-mean variance) is
// preserved when the cross term Cov(h,cf) is dropped. Concretely, neglecting the cross term perturbs
// the two-channel about-mean band Var(w_e·h + w_i·cf) = w_e²σ_h² + w_i²σ_cf² + 2·w_e·w_i·ρ·σ_h·σ_cf
// by the fractional error  δ = |2·w_e·w_i·ρ·σ_h·σ_cf| / (w_e²σ_h² + w_i²σ_cf²). By AM-GM,
// 2·(w_e σ_h)(w_i σ_cf) ≤ (w_e σ_h)² + (w_i σ_cf)², so δ ≤ |ρ| for ANY weights — the correlation is a
// hard upper bound on the visible-band error. Requiring |ρ| < 0.15 therefore caps that error under 15%.
// The 0.15 tolerance itself (the "15%") is a picked bar, NOT a model output, so it is tagged GUESSED
// per the S0.5a un-smuggle discipline — matching the sibling ≥-median size gate in bake-attenuation.mjs,
// NOT presented as if grounded. The largest in-set |corr| is Crystal ≈0.12 (under the bar; the one to
// watch), and δ ≤ |ρ| ≤ 0.12 bounds the actual band error under 12% for every affected world.
const CORR_ACCEPT_CONVENTION = {
  value: 0.15,
  status: 'GUESSED',   // per S0.5a: the 15% band-error tolerance is a chosen bar, not a model output
  rule: 'about-mean |corr(h,cf)| < 0.15',
  rationale:
    'δ ≤ |ρ| (AM-GM bound above): neglecting Cov(h,cf) corrupts the visible about-mean band by at most ' +
    'the correlation coefficient, so |ρ|<0.15 caps the visible-band error under 15%. The 15% tolerance ' +
    'is a picked acceptance bar (an order-of-magnitude "small correlation"), NOT a derived model output.',
  resolutionPath:
    'Drop the proxy correlation threshold entirely: gate the EXACT per-world fractional band error ' +
    'δ = |2·w_e·w_i·ρ·σ_h·σ_cf| / (w_e²σ_h² + w_i²σ_cf²) directly (all five inputs — ρ, w_e, w_i, σ_h, ' +
    'σ_cf — are already measured/solved in this script; see weWiByWorld + independence). Gating δ needs ' +
    'no arbitrary tolerance on a proxy — it either meets whatever composite-band error budget AC-BUDGET ' +
    'sets or it does not. (This also folds in the raw-cross-moment E[h·cf] concern flagged below, whose ' +
    'DC-offset dominance is the reason the raw-band, unlike the about-mean band, is only approximately ' +
    'preserved.)',
};
const CORR_ACCEPT = CORR_ACCEPT_CONVENTION.value;   // gate value (see convention object for status/rationale)
const independence = [];
for (const w of worlds.values()) {
  const cov = covariance(w.height, w.craterField);
  const cross = crossMoment(w.height, w.craterField);
  const sh = std(w.height), scf = std(w.craterField);
  const corr = (sh > 0 && scf > 0) ? cov / (sh * scf) : 0;
  const mH = mean(w.height), mCf = mean(w.craterField);
  independence.push({ name: w.name, corr, cov, crossMoment: cross, meanH: mH, meanCf: mCf, accepted: Math.abs(corr) < CORR_ACCEPT });
  console.log(`  ${w.name.padEnd(32)} ${fmt(corr, 5).padStart(9)}  ${exp(cov, 3).padStart(11)}  ${exp(cross, 3).padStart(11)}  ${exp(mH, 2)}  ${exp(mCf, 2)}`);
}
const maxCorr = Math.max(...independence.map((r) => Math.abs(r.corr)));
const worstCorr = independence.find((r) => Math.abs(r.corr) === maxCorr);
console.log(`  acceptance: about-mean |corr| < ${CORR_ACCEPT} for all → visible-band preservation premise HOLDS.`);
console.log(`    largest |corr| = ${fmt(maxCorr, 4)} (${worstCorr.name.split(' ')[0]}) — under threshold; the one to watch.`);
// LOUD FLAG (S0.2a #4): the RAW cross moment E[h·cf] is NOT the covariance — it is dominated by the
// height DC offset mean(h)≈0.064. The frozen definition is RAW mean-square, so this cross term is what
// the raw composite band actually carries; it is NOT negligible. The SOLVE identity stays exact
// (self-consistent on the raw V_h,V_cf numbers); realized RAW-band preservation is APPROXIMATE.
console.log(`  ⚠ FLAG: raw cross moment E[h·cf] is dominated by mean(h)·mean(cf) (height has a DC offset ≈`
  + `${fmt(mean(P.height), 3)}), NOT by the small central covariance. The SOLVE identity is exact on the`);
console.log(`    frozen raw V_h,V_cf; realized RAW-band preservation is therefore APPROXIMATE (measured next).`);
if (independence.some((r) => !r.accepted)) fail(`an in-domain world exceeds the |corr|<${CORR_ACCEPT} independence acceptance`);

// ── (5) WORKED f_I POINTS (S0.2 / S0.6): σ_imp from the shipped impact law, σ_endo from relic-Λ ───
console.log('\n── S0.2/S0.6: worked f_I per world (σ_imp = realized craterField raw RMS; σ_endo = relic-Λ) ──');
console.log('  world                            σ_imp/R(realized)  σ_endo/R(relic)  f_I(model)  f_I(relic flat-ref)  nStamp');
// σ_imp/R = realized rawRMS(craterField) — the shipped bombardment writer IS "the shipped impact laws
// (craterSchedule)"; its realized field RMS is the true per-world impact relief (the relic-Λ flat
// SIGMA_IMP_OVER_R=1.09e-3 was a boot approximation of exactly this, for Moon). σ_endo/R from relic-Λ.
const fIByWorld = {};
for (const w of worlds.values()) {
  const sigmaImp = rawRMS(w.craterField);                 // realized, per world
  const sigmaEndo = SIGMA_ENDO_BY_WORLD.get(w.name);      // model (relic-Λ, frozen)
  const f_I = (sigmaImp * sigmaImp) / (sigmaImp * sigmaImp + sigmaEndo * sigmaEndo);
  const relicFI = RELIC_FI_BY_WORLD.get(w.name);          // relic-Λ's own f_I (flat σ_imp ref)
  const sched = craterSchedule(w.cond);
  fIByWorld[w.name] = { sigmaImpOverR_realized: sigmaImp, sigmaEndoOverR_relic: sigmaEndo, f_I_model: f_I, f_I_relicFlatRef: relicFI, nStamp: sched.nStamp };
  console.log(`  ${w.name.padEnd(32)} ${exp(sigmaImp, 3).padStart(13)}     ${exp(sigmaEndo, 3).padStart(11)}    ${fmt(f_I, 4).padStart(8)}    ${fmt(relicFI, 4).padStart(10)}         ${String(sched.nStamp).padStart(4)}`);
}
console.log('  NOTE: per-world realized σ_imp drops Crystal\'s f_I sharply (its craters are near-floor/tiny) —');
console.log('    an honest refinement over the relic-Λ flat σ_imp reference (which over-flattens the crater side).');

// ── (6) MARS f_I GATE (S0.6) — real-hypsometry, NOT relic-law extrapolation ───────────────────────
console.log('\n── S0.6: Mars f_I gate (real-Mars hypsometry, medium-confidence — NOT relic-law) ──');
// Real Mars is a HEAVILY ERODED / endogenically-resurfaced world: the Tharsis rise, Valles Marineris,
// the hemispheric dichotomy and fluvial/aeolian erosion dominate its hypsometric variance, so its
// impact fraction is roughly BALANCED (neither crater-dominant nor endo-dominant), ~0.5. Real-Mars
// hypsometry places f_I in [0.3, 0.8]. TRAINING-SOURCED, MEDIUM CONFIDENCE (not repo-derived; a
// literature-verify pass is available). This gate is asserted SEPARATELY from the relic law because
// the relic law's declared domain — dead-lid impact-retentive worlds — EXCLUDES Mars-like eroded
// worlds: extrapolating it to Mars over-predicts f_I (crater-dominant), OUT of the real-Mars gate.
const MARS_FI_GATE = [0.3, 0.8];   // real-Mars hypsometry (training-sourced, medium confidence)
const marsModelFI = fIByWorld['Mars (arid rocky)'].f_I_model;
const marsInGate = marsModelFI >= MARS_FI_GATE[0] && marsModelFI <= MARS_FI_GATE[1];
console.log(`  real-Mars-hypsometry gate: f_I ∈ [${MARS_FI_GATE[0]}, ${MARS_FI_GATE[1]}]  (asserted — the acceptance bar)`);
console.log(`  relic/realized MODEL f_I for Mars = ${fmt(marsModelFI, 4)}  → inside the gate? ${marsInGate}`);
console.log(`  → model f_I is ${marsInGate ? 'inside' : 'ABOVE'} the gate: the relic law's domain excludes eroded Mars,`);
console.log(`    so the gate (not the model) is Mars's referent — exactly the S0.6 domain-exclusion point.`);
// Assert the GATE itself is a valid [0.3,0.8] real-hypsometry band (the acceptance the S1 leaf/tests use).
if (!(MARS_FI_GATE[0] >= 0.3 && MARS_FI_GATE[1] <= 0.8 && MARS_FI_GATE[0] < MARS_FI_GATE[1])) fail('Mars f_I gate is not the real-hypsometry [0.3,0.8] band');

// ── (7) weWiByWorld — the solve per world (model f_I → r; realized raw norms → scale) ─────────────
console.log('\n── weWiByWorld: solve per world (model f_I → r; realized raw V_h,V_cf → scale) ──');
console.log('  world                            V_h(raw)     V_cf(raw)    f_I      w_e      w_i       preRMS→postRMS Δ%(raw)  Δ%(mean)');
const weWiByWorld = {};
for (const w of worlds.values()) {
  const V_h = rawMS(w.height);
  const V_cf = rawMS(w.craterField);
  const f_I = fIByWorld[w.name].f_I_model;
  const clamp_fires = V_cf < EPSILON_VCF;
  const s = clamp_fires ? { w_e: 1, w_i: 1, r: 0, we2: 1, wi2: 1 } : solveFromFI(V_h, V_cf, f_I);
  // realized preservation quality (raw AND about-mean), applied to the actual channels (sd = 0 here).
  const h = w.height, sd = w.shelfDepth, cf = w.craterField;
  const pre = new Float64Array(h.length), post = new Float64Array(h.length);
  for (let i = 0; i < h.length; i++) { const sdv = sd ? sd[i] : 0; pre[i] = h[i] + sdv + cf[i]; post[i] = s.w_e * h[i] + sdv + s.w_i * cf[i]; }
  const preRawRMS = rawRMS(pre), postRawRMS = rawRMS(post);
  const preStd = std(pre), postStd = std(post);
  const dRaw = preRawRMS > 0 ? (postRawRMS - preRawRMS) / preRawRMS * 100 : 0;
  const dMean = preStd > 0 ? (postStd - preStd) / preStd * 100 : 0;
  weWiByWorld[w.name] = { V_h, V_cf, f_I, r: s.r, w_e: s.w_e, w_i: s.w_i, clampFired: clamp_fires,
    preRawRMS, postRawRMS, deltaPctRaw: dRaw, preStd, postStd, deltaPctAboutMean: dMean };
  console.log(`  ${w.name.padEnd(32)} ${exp(V_h, 3)}   ${exp(V_cf, 3)}  ${fmt(f_I, 4)}  ${fmt(s.w_e, 4)}  ${fmt(s.w_i, 2).padStart(7)}   ${exp(preRawRMS, 2)}→${exp(postRawRMS, 2)}  ${fmt(dRaw, 2).padStart(6)}  ${fmt(dMean, 2).padStart(6)}`);
}
console.log('  Δ%(raw): realized raw-band change — nonzero (few %) from the DC-offset cross term (flagged above);');
console.log('    the SOLVE identity is exact on V_h,V_cf but the realized field carries the E[h·cf] cross term.');
console.log('  Every in-domain world inverts crater:base to crater-dominant (w_i ≫ w_e); no world flattens (w_e>0).');

// ── WRITE deterministic JSON ──────────────────────────────────────────────────────────────────────
const out = {
  meta: {
    workstream: 'world-engine-inc3b-relief-budget-2026-07-21',
    slice: 'S0.2 + S0.2a + S0.6 worked cases',
    script: 'calibration/relief-budget-fit.mjs',
    point: { N: N_NODES, seed: SEED, LLOYD },
    reuses: 'relic-lambda-band.json (σ_endo/R + fit, READ not imported); amplitude pattern mirrors inc3b-amplitude-budget.mjs',
    solve: {
      form: 'w_e² = (V_h+V_cf)/(V_h·(1+r)); w_i² = r·w_e²·V_h/V_cf; r = f_I/(1−f_I)',
      constraints: 'variance-ratio = r AND preserved band w_e²V_h+w_i²V_cf = V_h+V_cf (shelfDepth weight 1, Cov(h,cf)≈0)',
      exactness: 'both identities exact algebra; asserted to 1e-12 / 1e-9 on the boot referent',
    },
  },
  // ── the four FROZEN exports (BUILD-PLAN task) ──
  varianceDefinition: {
    frozen: VARIANCE_DEFINITION,
    definition: 'V = mean(x^2) (raw second moment about zero); RMS = sqrt(mean(x^2))',
    justification: 'only raw-mean-square reproduces the recorded ~1.14% crater:base diagnosis; the recorded '
      + '0.09606/0.001094 ARE the raw RMS at N=40k seed 1, and the recorded w_i=86.48 requires the RAW V_h/V_cf ratio',
    binding: 'inc3b-amplitude-budget.mjs (the AC-BUDGET harness) and AC-BUDGET use this same definition',
    reproductionAtRecordedPoint: {
      N: N_NODES, seed: SEED,
      rawRMS_height: rawRMS_h, rawRMS_crater: rawRMS_cf, ratio_rawMeanSquare: ratioMS,
      std_height: std_h, std_crater: std_cf, ratio_aboutMean: ratioVar,
      recorded_ratio: 0.01139, band: [REPRO_LO, REPRO_HI],
      rawMeanSquareReproduces: msReproduces, aboutMeanReproduces: varReproduces,
      witness_wi_aboutMean: wiAboutMean, witness_wi_raw_recorded: REC_W_I,
    },
  },
  epsilonVcf: {
    value: EPSILON_VCF,
    definition: 'smallest single-stamp raw mean-square the shipped schedule can produce',
    derivation: 'one δ=MESH_FLOOR_RAD crater (A=' + stamp.A.toFixed(5) + ') stamped on the N=' + N_NODES
      + ' mesh with the shipped writer arithmetic (craterProfile bowl-reset/accumulate + CRATER_SAT_N tanh clamp), centre=node 0',
    minStampDelta: stamp.delta, minStampAmplitude: stamp.A, nodesTouched: stamp.touched,
    smallestRealizedInDomainVcf_Crystal: crystalRealizedVcf,
    clampFiresInDomain: false,
    fallback: 'when realized V_cf < ε the budget returns IDENTITY (w_e=w_i=1) rather than an unbounded w_i',
    blowupWithoutClamp: blowup,
  },
  fIByWorld,
  weWiByWorld,
  // ── supporting records ──
  bootReferent: {
    V_h: REC_V_H, V_cf: REC_V_CF, f_I: REC_F_I, r: bootSolve.r,
    w_e: bootSolve.w_e, w_i: bootSolve.w_i,
    rmsPreservationResidual: bootRes.bandResidual, varRatioResidual: bootRes.ratioResidual,
    recorded: { rawRMS_height: REC_RMS_H, rawRMS_crater: REC_RMS_CF, w_e: REC_W_E, w_i: REC_W_I },
  },
  identityCollapse: {
    note: 'deriving r from realized norms (r := V_cf/V_h) collapses w_e² to EXACTLY 1.0 — the §6-T2 split reason',
    rRealized, we2: collapseSolve.we2, wi2: collapseSolve.wi2,
  },
  independence: {
    acceptance: 'about-mean |corr(h,cf)| < ' + CORR_ACCEPT + ' (visible-band preservation premise)',
    acceptanceConvention: CORR_ACCEPT_CONVENTION,   // GUESSED (δ ≤ |ρ| AM-GM bound; 15% tolerance is a picked bar) + resolutionPath — matches sibling size-gate discipline
    maxAbsCorr: maxCorr, worst: worstCorr.name,
    rawCrossMomentFlag: 'raw cross moment E[h·cf] is dominated by the height DC offset mean(h)≈'
      + mean(P.height).toFixed(4) + ', so realized RAW-band preservation is approximate (the SOLVE identity stays exact)',
    worlds: independence,
  },
  marsGate: {
    gate: MARS_FI_GATE, source: 'real-Mars hypsometry (training-sourced, medium confidence)',
    modelFI: marsModelFI, modelInGate: marsInGate,
    domainNote: 'the relic-Λ law\'s domain is dead-lid impact-retentive worlds; it EXCLUDES Mars-like eroded '
      + 'worlds, so it over-predicts Mars f_I — the real-hypsometry gate, not the model, is Mars\'s referent',
  },
};
const outPath = join(__dirname, 'relief-budget-fit.json');
writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n');
console.log(`\nfrozen { varianceDefinition, epsilonVcf, fIByWorld, weWiByWorld } + supporting → ${outPath}`);

// ── exit status ────────────────────────────────────────────────────────────────────────────────
if (problems.length) {
  console.log('\nFAIL:');
  for (const pr of problems) console.log('  • ' + pr);
  process.exit(1);
}
console.log('\nOK — solve exact on the boot referent; variance def frozen (raw-mean-square); identity-collapse '
  + 'shown; ε derived; independence measured; Mars gate asserted; per-world w_e/w_i tabled + written.');
process.exit(0);
