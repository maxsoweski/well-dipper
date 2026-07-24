// calibration/inc3b-amplitude-budget.mjs — Inc-3b THE CANONICAL amplitude-budget harness (AC-BUDGET, §0.9 / §2).
//
// WHY THIS FILE EXISTS (BUILD-PLAN §0.9 / R7): the `041d7a8` diagnosis harness that measured the
// "~1.14% crater:base" number lived in an ephemeral scratchpad and was NEVER committed. AC-BUDGET
// references a harness that is not in the tree, so the AC is unverifiable without it. This is that
// harness: a pure-`node` reproduction of the pre-budget amplitude measurement, with a self-check that
// re-derives the recorded ~1.14% crater:base ratio at N=40000 seed 1, plus the MEASURED independence
// premise (Cov(height, craterField)) the S0.2a w_e/w_i solve rests on, and a forward-compatible slot
// that reports the post-budget preserved-band check once S1 ships `src/worldengine/base/reliefBudget.js`.
//
// WHAT IT MEASURES (pre-budget, S0 — no code ship):
//   For the Moon/Mercury (impact-airless) preset booted headlessly through the REAL relief pipeline
//   (makeSphereField + writeBodyRelief + compositeMargins — the identical carrier-resolution pattern the
//   v2-5 composite suite and the predecessor population-sweep.mjs use), at N nodes / canonical radius / seed:
//     • height RMS, shelfDepth RMS, craterField RMS of the composited channels
//     • the crater:base ratio (craterField-vs-height amplitude) under BOTH variance definitions
//   For the four in-domain worlds {Moon/Mercury, Mars, Frozen, Crystal}:
//     • Cov(height, craterField) + correlation — the S0.2a "Cov(h,cf)≈0" premise MEASURED, not assumed.
//
// DETERMINISM: single-threaded, no dev server, no network, no `claude -p`, no timestamps, no wall-clock
// fields in any output. Every printed number reproduces EXACTLY on re-run at the same [N] [seed].
//
// NO TASTE CONSTANTS: every numeric constant below carries an inline derivation + anchor, OR is a
// reproduction-check band on a RECORDED measurement (tagged as such — not a physics constant).
//
// CLI:  node calibration/inc3b-amplitude-budget.mjs [N] [seed]     (defaults 40000 1 — the AC map's exact command)

import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

// Import depth mirrors the predecessor population-sweep.mjs: this file sits at
//   <repo>/docs/WORKSTREAMS/world-engine-inc3b-relief-budget-2026-07-21/calibration/
// so the repo root is four levels up (../../../../).
import { buildIrregularSphere, writeBodyRelief, compositeMargins, DEFAULT_GRAIN_DRIVERS } from '../../../../planet-lod-rivers.js';
import { makeSphereField } from '../../../../src/worldengine/base/sphereField.js';
import { DRIVER_PRESETS, PRESET_ARCHETYPE } from '../../../../driver-presets.js';
import { buildNeutralBodyDrivers } from '../../../../body-drivers.js';
import { deriveConditionVector } from '../../../../body-condition-vector.js';
import { deriveUniforms } from '../../../../planet-lod-lab-core.js';
import { craterSchedule, isImpactSurface } from '../../../../src/worldengine/base/bombardment.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, '..', '..', '..', '..');

// ── CLI ─────────────────────────────────────────────────────────────────────────────────────────────
// Defaults 40000 / 1: BUILD-PLAN §2 AC-BUDGET's exact verify command `node calibration/inc3b-amplitude-budget.mjs 40000 1`.
const N_NODES = Number.parseInt(process.argv[2] ?? '40000', 10);
const SEED    = Number.parseInt(process.argv[3] ?? '1', 10);

// LLOYD relaxation iters — pinned to 2, the value the golden harness (tests/fixtures/v2-0-carrier-golden.mjs:42
// LLOYD=2) and the predecessor population-sweep.mjs (buildIrregularSphere(MESH_N, 2)) both use, so this
// harness boots the SAME mesh family the shipped pipeline measures. NOT a tunable — a match to the fixture.
const LLOYD = 2;

// The four IN-DOMAIN worlds (BUILD-PLAN §0.9 / brief §2.5 affected set): dead-lid impact-retentive presets
// whose craterField populates. These are exactly the worlds the S0.2a independence premise is measured on.
const IN_DOMAIN = [
  'Moon/Mercury (impact-airless)',   // the AC-BUDGET boot world (primary)
  'Mars (arid rocky)',
  'Frozen (airless)',
  'Crystal (faceted)',
];
const PRIMARY = 'Moon/Mercury (impact-airless)';

// Reproduction-check band on the RECORDED diagnosis measurement (NOT a physics constant):
// the `041d7a8` scratchpad reported height RMS 0.09606 / craterField RMS 0.001094 → crater:base 1.139%
// (brief header + §2.1). [0.9%, 1.4%] brackets that recorded value with slack for the two RMS definitions.
// Tag: reproduction check, per BUILD-PLAN §0.9 self-check spec. If the mesh family or writer ever moves,
// THIS is the tripwire — a failed reproduction means the measured referent AC-BUDGET rests on has drifted.
const REPRO_LO = 0.009;   // 0.9%
const REPRO_HI = 0.014;   // 1.4%
const REPRO_ANCHOR = 0.01139;  // recorded 0.001094/0.09606 (brief) — printed for context, not asserted against directly

// ── statistics helpers ────────────────────────────────────────────────────────────────────────────────
const mean = (xs) => { let s = 0; for (let i = 0; i < xs.length; i++) s += xs[i]; return s / xs.length; };
// Var: variance ABOUT THE MEAN (central second moment). sqrt(Var) = std = "RMS about the mean".
const variance = (xs) => { const m = mean(xs); let s = 0; for (let i = 0; i < xs.length; i++) { const d = xs[i] - m; s += d * d; } return s / xs.length; };
const std = (xs) => Math.sqrt(variance(xs));
// MS: RAW mean-square (second moment about zero). sqrt(MS) = "raw RMS". Differs from std when mean ≠ 0.
const meanSquare = (xs) => { let s = 0; for (let i = 0; i < xs.length; i++) s += xs[i] * xs[i]; return s / xs.length; };
const rmsRaw = (xs) => Math.sqrt(meanSquare(xs));
// Cov ABOUT THE MEAN (central); correlation = Cov / (std·std). Independence premise ⇒ Cov ≈ 0.
const covariance = (xs, ys) => {
  const mx = mean(xs), my = mean(ys);
  let s = 0; for (let i = 0; i < xs.length; i++) s += (xs[i] - mx) * (ys[i] - my);
  return s / xs.length;
};

// ── the lab's route() bundle (condition-BEARING) — VERBATIM the pattern from
//    tests/worldengine-v2-5-preset-composite.test.js:reliefBundle, canonical radius (fp.radiusEarth). ──
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

// Build the mesh ONCE (geometry depends only on N + LLOYD, not the body) and reuse it across all worlds —
// the dominant fixed cost, exactly as population-sweep.mjs's meshLazy() shares one mesh. writeBodyRelief
// writes only the per-world carrier field arrays (makeSphereField allocates fresh ones); it never mutates
// mesh.verts/faces/adj, so sharing is byte-safe.
const sharedMesh = buildIrregularSphere(N_NODES, LLOYD);

// Boot one world through the REAL pipeline and return its channels + composited surface + condition.
function bootWorld(name, seed) {
  const carrier = makeSphereField(sharedMesh);
  const bundle = reliefBundle(name, seed);
  const relief = writeBodyRelief(carrier, bundle);
  const composited = compositeMargins(carrier);   // may be null if BOTH overlays all-zero (non-in-domain)
  return {
    name,
    count: carrier.count,
    height: carrier.height,
    shelfDepth: carrier.shelfDepth,
    craterField: carrier.craterField,
    composited,
    cond: bundle.bodyDrivers.condition,
    path: relief.path,
  };
}

// ── boot all four in-domain worlds ──────────────────────────────────────────────────────────────────
console.log('=== Inc-3b amplitude-budget harness (AC-BUDGET) ===');
console.log(`N=${N_NODES} (requested)  LLOYD=${LLOYD}  seed=${SEED}  mesh nodes=${sharedMesh.verts.length}\n`);

const worlds = new Map();
for (const name of IN_DOMAIN) worlds.set(name, bootWorld(name, SEED));

console.log('per-world boot (auditable node counts + dispatch path):');
for (const w of worlds.values()) {
  const sched = craterSchedule(w.cond);
  console.log(
    `  ${w.name.padEnd(32)} nodes=${String(w.count).padStart(6)}  path=${(w.path ?? '?').padEnd(12)} ` +
    `impact=${isImpactSurface(w.cond) ? 'yes' : 'no '}  nStamp=${String(sched.nStamp).padStart(4)}  ` +
    `craterField ${anyNonzero(w.craterField) ? 'populated' : 'ALL-ZERO'}  composited=${w.composited ? 'non-null' : 'null'}`,
  );
}

function anyNonzero(arr) { for (let i = 0; i < arr.length; i++) if (arr[i] !== 0) return true; return false; }

// ── PRIMARY (Moon/Mercury) channel amplitudes — BOTH variance definitions ────────────────────────────
const p = worlds.get(PRIMARY);

// per-channel, both definitions
const ch = {
  height:      { std: std(p.height),      rms: rmsRaw(p.height),      mean: mean(p.height) },
  shelfDepth:  { std: std(p.shelfDepth),  rms: rmsRaw(p.shelfDepth),  mean: mean(p.shelfDepth) },
  craterField: { std: std(p.craterField), rms: rmsRaw(p.craterField), mean: mean(p.craterField) },
};

console.log(`\n── ${PRIMARY} composited-channel amplitudes (seed ${SEED}) ──`);
console.log('  channel        Var-def (std, about-mean)   MS-def (raw RMS)         channel mean');
for (const [k, v] of Object.entries(ch)) {
  console.log(`  ${k.padEnd(12)}   ${v.std.toExponential(4).padStart(12)}            ${v.rms.toExponential(4).padStart(12)}            ${v.mean.toExponential(3)}`);
}

// crater:base ratio (craterField amplitude ÷ height amplitude) under each definition.
const ratioVar = ch.craterField.std / ch.height.std;   // about-the-mean (std ratio)
const ratioMS  = ch.craterField.rms / ch.height.rms;    // raw mean-square (raw-RMS ratio)

console.log(`\ncrater:base ratio (craterField ÷ height):`);
console.log(`  Var-def (std/std, about-mean) : ${(ratioVar * 100).toFixed(4)}%`);
console.log(`  MS-def  (rawRMS/rawRMS)       : ${(ratioMS * 100).toFixed(4)}%`);
console.log(`  recorded diagnosis anchor     : ${(REPRO_ANCHOR * 100).toFixed(3)}%  (0.001094 / 0.09606, brief header)`);

// SELF-CHECK: which definition REPRODUCES the recorded ~1.14%? Assert at least one lands in the recorded
// reproduction band [0.9%, 1.4%] (a check on a RECORDED measurement — tagged above — NOT a physics constant).
const varIn = ratioVar >= REPRO_LO && ratioVar <= REPRO_HI;
const msIn  = ratioMS  >= REPRO_LO && ratioMS  <= REPRO_HI;
const reproducers = [];
if (varIn) reproducers.push('Var-def (std, about-mean)');
if (msIn)  reproducers.push('MS-def (raw mean-square)');

console.log(`\nSELF-CHECK (reproduction of recorded ~1.14% crater:base at N=40k seed 1, band [${(REPRO_LO * 100).toFixed(1)}%, ${(REPRO_HI * 100).toFixed(1)}%]):`);
if (reproducers.length) {
  console.log(`  REPRODUCED by: ${reproducers.join(' AND ')}`);
} else {
  console.log(`  NEITHER definition lands in the reproduction band — measured referent has DRIFTED.`);
}

// ── independence premise MEASURED: Cov(height, craterField) for the four in-domain worlds (S0.2a #4) ──
console.log(`\n── S0.2a independence premise MEASURED (Cov(height, craterField) ≈ 0 assumed by the w_e/w_i solve) ──`);
console.log('  world                            Cov(h,cf)        corr(h,cf)     std(h)       std(cf)');
const covRows = [];
for (const w of worlds.values()) {
  const cov = covariance(w.height, w.craterField);
  const sh = std(w.height), scf = std(w.craterField);
  const corr = (sh > 0 && scf > 0) ? cov / (sh * scf) : 0;
  covRows.push({ name: w.name, cov, corr, stdH: sh, stdCf: scf });
  console.log(`  ${w.name.padEnd(32)} ${cov.toExponential(4).padStart(12)}   ${corr.toFixed(5).padStart(10)}   ${sh.toExponential(3)}   ${scf.toExponential(3)}`);
}

// ── POST-BUDGET preserved-band + crater-dominance check (S1 has wired reliefBudget.js) ────────────────
// Pre-budget path above does NOT depend on this. Guarded dynamic import so the harness still runs standalone.
//
// API NOTE (BUILD-PLAN §6-T2 option (ii)+S0.2a, ADOPTED): the S1 leaf emits ONLY the condition-pure RATIO
// target f_I (a realized-norm f_I collapses the budget to identity — relief-budget-fit.json.identityCollapse);
// the RMS-preserving w_e/w_i SCALE is solved inside compositeMargins from the REALIZED raw-mean-square norms.
// The pre-S1 forward-compat stub here GUESSED the leaf would emit w_e/w_i and read them off the object — that
// mismatches the adopted API (the leaf returns the identity defaults w_e=w_i=1). FIXED HERE (harness = ours,
// per the S1 task): derive w_e/w_i via the SAME S0.2a closed form compositeMargins uses (frozen RAW mean-square
// definition, ε_Vcf identity clamp), report them, and confirm the SHIPPED compositeMargins(carrier, budget)
// produces the identical post array. Reports f_I, w_e/w_i, the preserved channel raw-MS band, and the inverted
// crater share. NO leaf edit was made to fit this harness.
const EPSILON_VCF = 1.1814295123540973e-8;   // relief-budget-fit.json.epsilonVcf (smallest single-stamp raw-MS the schedule can produce)
const RELIEF_BUDGET_PATH = join(REPO, 'src', 'worldengine', 'base', 'reliefBudget.js');
console.log(`\n── post-budget preserved-band + crater-dominance check (S0.2a solve; frozen RAW-MS definition) ──`);
let budgetOk = true;
let budgetSection = null;
if (existsSync(RELIEF_BUDGET_PATH)) {
  const mod = await import(pathToFileURL(RELIEF_BUDGET_PATH).href);
  const deriveReliefBudget = mod.deriveReliefBudget;
  if (typeof deriveReliefBudget !== 'function') {
    console.log(`  reliefBudget.js exists but exports no deriveReliefBudget(cond, schedule) — cannot report f_I.`);
    budgetOk = false;
  } else {
    console.log('  world                            inDomain   f_I       w_e       w_i        sumΔ%     preShare    postShare   inv?');
    budgetSection = [];
    for (const w of worlds.values()) {
      const budget = deriveReliefBudget(w.cond, craterSchedule(w.cond));
      const inDomain = !!(budget && budget.inDomain);
      const f_I = budget?.f_I ?? 0;
      const h = w.height, sd = w.shelfDepth, cf = w.craterField;
      // realized RAW mean-square norms (the FROZEN variance definition) — exactly what compositeMargins reads.
      const V_h = meanSquare(h), V_cf = meanSquare(cf);
      // S0.2a closed-form solve, with the ε_Vcf identity clamp (V_cf→0 blow-up guard). Ill-posed ⇒ identity.
      let w_e = 1, w_i = 1;
      if (inDomain && V_cf >= EPSILON_VCF && V_h > 0 && f_I > 0 && f_I < 1) {
        const r = f_I / (1 - f_I);
        w_e = Math.sqrt((V_h + V_cf) / (V_h * (1 + r)));
        w_i = Math.sqrt(r * w_e * w_e * V_h / V_cf);
      }
      // preserved channel raw-MS band: w_e²V_h + w_i²V_cf vs V_h + V_cf (the exact S0.2a identity).
      const sumPre = V_h + V_cf, sumPost = w_e * w_e * V_h + w_i * w_i * V_cf;
      const sumDeltaPct = sumPre > 0 ? (sumPost - sumPre) / sumPre * 100 : 0;
      // crater share (raw-MS): pre = V_cf/(V_h+V_cf) (the ~1.5% diagnosis); post = w_i²V_cf/sumPost (== f_I in-domain).
      const preShare = sumPre > 0 ? V_cf / sumPre : 0;
      const postShare = sumPost > 0 ? (w_i * w_i * V_cf) / sumPost : 0;
      // "inverted" = variance reallocated UPWARD toward craters, achieving the model ratio target f_I.
      // Dead-lid worlds land crater-DOMINANT (postShare>0.5); Mars deliberately lands at its [0.3,0.8]
      // hypsometry-gated f_I (~0.43, "cratered highlands Mars, not Moon"), so dominance is NOT the bar —
      // the bar is: share grew from the ~0 endo-dominated pre-state to exactly f_I.
      const inverted = inDomain ? (postShare > preShare && Math.abs(postShare - f_I) < 1e-9) : (postShare === preShare);
      // confirm the SHIPPED seam produces the identical post array (end-to-end, not a re-implementation).
      const carrierLike = { count: w.count, height: h, shelfDepth: sd, craterField: cf };
      const seamOut = compositeMargins(carrierLike, budget);
      let seamMatch = true;
      if (inDomain && V_cf >= EPSILON_VCF && V_h > 0 && f_I > 0 && f_I < 1) {
        for (let i = 0; i < h.length; i++) {
          if (seamOut[i] !== Math.fround(w_e * h[i] + (sd ? sd[i] : 0) + w_i * (cf ? cf[i] : 0))) { seamMatch = false; break; }
        }
      }
      if (inDomain && (!(Math.abs(sumDeltaPct) < 1e-6) || !inverted || !seamMatch)) budgetOk = false;
      budgetSection.push({ name: w.name, inDomain, f_I, w_e, w_i, sumDeltaPct, preShare, postShare, inverted, seamMatch });
      console.log(
        `  ${w.name.padEnd(32)} ${(inDomain ? 'yes' : 'no ').padEnd(8)} ` +
        `${f_I.toFixed(4).padStart(7)}  ${w_e.toFixed(4).padStart(7)}  ${w_i.toFixed(3).padStart(8)}  ` +
        `${sumDeltaPct.toExponential(2).padStart(9)}  ${preShare.toExponential(3)}  ${postShare.toFixed(4).padStart(8)}   ${inverted ? 'YES' : 'no'}`,
      );
    }
    // the BOOT WORKED POINT (Moon/Mercury, PRIMARY) must land crater-DOMINANT (the ~1.5% diagnosis inverted).
    const primaryRow = budgetSection.find((b) => b.name === PRIMARY);
    const primaryDominant = !!(primaryRow && primaryRow.inDomain && primaryRow.postShare > 0.5);
    if (!primaryDominant) budgetOk = false;
    console.log(`\n  boot worked point ${PRIMARY}: post crater share ${primaryRow ? primaryRow.postShare.toFixed(4) : '?'} > 0.5 (crater-DOMINANT): ${primaryDominant ? 'YES' : 'NO'}`);
    console.log(`  (sumΔ% = preserved channel raw-MS band; postShare = crater share of the reallocated channel-sum, == f_I in-domain;`);
    console.log(`   the shipped compositeMargins(carrier, budget) post array matched the S0.2a solve for every in-domain world: ${budgetSection.every((b) => b.seamMatch)}.)`);
  }
} else {
  console.log(`  budget not wired — src/worldengine/base/reliefBudget.js does not exist.`);
  budgetOk = false;
}

// ── exit ──────────────────────────────────────────────────────────────────────────────────────────────
if (reproducers.length === 0) {
  console.log(`\nFAIL — the recorded ~1.14% crater:base ratio was NOT reproduced under either variance definition.`);
  process.exit(1);
}
if (!budgetOk) {
  console.log(`\nFAIL — post-budget preserved-band / crater-dominance check did not hold (see the table above).`);
  process.exit(1);
}
console.log(`\nOK — recorded crater:base ratio reproduced (${reproducers.join(', ')}); independence measured; post-budget band preserved + crater-dominance inverted.`);
process.exit(0);
