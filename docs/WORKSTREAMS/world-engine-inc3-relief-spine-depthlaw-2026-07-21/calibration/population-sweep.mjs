// calibration/population-sweep.mjs — World Engine Inc-3 SLICE-3 acceptance harness (AC-POPSWEEP).
//
// LINEAGE: this is the V2-6 SLICE-6 population-sweep harness (docs/WORKSTREAMS/world-engine-v2-6-.../calibration/
// population-sweep.mjs) copied into this workstream and EXTENDED with the Inc-3 ENVELOPE GATE (§3 S3-step-1). The
// V2-6 gates below are preserved VERBATIM (identical import depth ⇒ identical relative paths) so the Inc-3 run
// re-proves them at this commit — the depth-law edit (S2) is craterField-amplitude-only (does not move coverage/
// count/E1) and the envelope edit (S1) is render-side (does not move the carrier). AC-POPSWEEP for Inc-3 = all V2-6
// gates STILL green + the new envelope gate green.
//
// PURPOSE (V2-6, unchanged): AC-POPSWEEP judges the DRAWN POPULATION, not a boot state (INTENT FRAME "no defaults").
// For every seed-varying archetype preset × N_SEEDS seeds it draws a radius through the SHARED draw law
// (driver-presets.js drawPresetRadius — the same symbol world-engine-lab.html imports, grep-asserted below so the two
// can never drift), derives the condition vector at the DRAWN radius, runs the crater schedule, and (for
// impact-surface archetypes only) resolves a full stamped carrier on a ~10k-node mesh. It then gates the ensemble:
//
//   1. PHYSICS INVARIANTS (every seed):   surfaceGravity coheres as g_canonical·(R/R_c) bit-exact; the massEarthOf
//                                         round-trip g·R² reconstructs M_c·(R/R_c)³ within float64 ulp; no NaN in
//                                         the derived vector; resolved carriers are NaN-free (non-flat where ≥1 crater).
//   2. COVERAGE BAND (the AC phrase, operationalized): the closed-form drawn-population coverage lands in [10%,80%]
//                                         for ≥90% of MATURE impact-surface seeds. Erosion-shortened seeds are a
//                                         SEPARATE row, never counted against the band.
//   3. NONZERO VARIANCE (non-degeneracy): the drawn radius genuinely sweeps (Var(R)>0) for every swept preset, and
//                                         the coverage metric genuinely varies (Var(coverage)>0) over the MATURE set.
//   4. E1-REGIME DIVERSITY:               per preset, distinct computeE1 labels ≥ the PINNED k AND ⊆ the PINNED
//                                         allow-list (hard-coded from the V2-6 first run — reruns are falsifiable).
//   5. GOLDENS STABLE:                    the byte-identity suite (tests/v2-0-byte-identity.test.js) is green.
//   6. RUNTIME BUDGET:                    < 10 min single-threaded; per-preset wall time in the JSON summary.
//
//   7. ★ INC-3 ENVELOPE GATE (NEW, §3 S3-step-1 / AC-ENVELOPE population layer / lens physics MF1), EXTENDED by
//      world-engine-v2-relief-law-2026-07-28 with gate (d): across the SAME
//      drawn population, the EXACT relief MULTIPLIER reliefEnvelope(R_drawn, g_drawn) is
//        (a) BOUNDED — every drawn multiplier ≤ the Phobos strength ceiling PHOBOS_MULT (the g-floored cap
//            reliefEnvelope(_, 1e-3) ≈ 54.95): "no draw exceeds the most-extreme real body" — the exact, defensible
//            invariant that replaces the uncapped 1/R (which ran to ∞ as R→0);
//        (b) MONOTONE in g — sorted by drawn g ascending, the multiplier is non-increasing (sign preserved: lower g
//            ⇒ higher relief/R), the clamp permitting ties;
//        (c) RADIUS-INDEPENDENT — reliefEnvelope(R,g) === reliefEnvelope(R·k,g) for a perturbed k at the same g
//            (radius flows THROUGH g, the footnote-14 double-dip resolution — a structural spy, not a fit).
//            ★ v2 relief law: this gate is KEPT, not rewritten. The adopted two-branch form still carries no
//            radius term (the seam-normalising radius cancels identically along every trajectory), so (c) is a
//            TRUE and load-bearing statement about the v2 law, not a leftover from the v1 one.
//        (d) ★ v2 ABSOLUTE RELIEF — for each ROCKY-class preset with ≥3 seeded draws above the g = 1 seam, the
//            log-log slope of ABSOLUTE relief h = reliefEnvelope(R,g)·R against R must be -1.853 (= 1 - 1.70·
//            1.678235294117647, hand-written). This is the gate (a)-(c) cannot buy: (c) says the MULTIPLIER
//            ignores radius, which was equally true of the shipped pre-v2 law; only h = E·R can tell the two
//            apart. On the same Rocky (Earthlike) draws the shipped law measures +0.014 — that separation IS
//            the v2 relief law reaching the drawn population.
//      The `·REF_RELIEF` apparent band is reported as a SOFT ILLUSTRATIVE signal ONLY (lens physics MF1: the linear
//      model cannot reproduce the convicting 0.70 and is NOT the render proof). The in-band RENDER claim is the
//      coordinator's live AC-LAB-READ, NOT this gate. This gate proves the MULTIPLIER LAW the lab bakes is bounded.
//
// Machine-readable JSON summary → population-sweep-summary.json; nonzero exit on ANY gate failure. Pure `node`.

import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { bodySurfaceGravity } from '../../../../src/worldengine/base/baseStep.js';
import { craterSchedule, isImpactSurface, writeBombardment } from '../../../../src/worldengine/base/bombardment.js';
import { DRIVER_PRESETS, PRESET_ARCHETYPE, PRESET_NAMES, NAMED_BODY, drawPresetRadius } from '../../../../driver-presets.js';
import { deriveConditionVector, gravityRadiusShape } from '../../../../src/worldengine/base/conditionVector.js';
import { compositionClass } from '../../../../src/worldengine/base/e1Regime.js';
import { deriveUniforms, reliefEnvelope, Q_RELIEF, Q_RELIEF_DERIVED, RELIEF_FLOOR, RELIEF_CEIL } from '../../../../src/worldengine/base/labCore.js';
import { computeE1 } from '../../../../src/worldengine/base/e1Regime.js';
import { buildIrregularSphere } from '../../../../planet-lod-rivers.js';
import { makeSphereField } from '../../../../src/worldengine/base/sphereField.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, '..', '..', '..', '..');

// ── acceptance constants ─────────────────────────────────────────────────────────────────────────────
const N_SEEDS         = 64;
const COV_LO          = 0.10, COV_HI = 0.80;   // AC-POPSWEEP bowl-coverage band
const COV_INBAND_MIN  = 0.90;                  // ≥90% of MATURE impact-surface seeds must land in-band
const SCREEN_MATURE   = 0.9;                   // MATURE denominator: substantially-unscreened (airless) surface
const K_EXP_MATURE    = 0.25;                  // MATURE denominator: t_exp ≥ 0.25·age (substantially exposed)
const MESH_N          = 10000;                 // full-carrier resolution mesh (~10k nodes)
const RUNTIME_BUDGET_MS = 10 * 60 * 1000;

// ── ★ INC-3 envelope-gate constants (§3 S3-step-1) ─────────────────────────────────────────────────────
// PHOBOS_MULT: the g-floored cap reliefEnvelope(_, 1e-3). The shipped reliefEnvelope floors g at 1e-3 before g^-Q,
// so NO g (however degenerate) can drive a multiplier past this — it is Phobos' real g=0.00058 already floored, and
// = the strength ceiling the calibration reports (relief-envelope.mjs). Assert every drawn multiplier ≤ this.
// ≈ 54.95408738576244 = (1e-3)^-0.58. HAND-COMPUTED, deliberately NOT reliefEnvelope(1, 1e-3): a gate whose
// threshold is produced by calling the function under test moves with that function and stops being a gate.
// g = 1e-3 is far BELOW the v2 seam at g = 1, so this rides the calibrated branch and the v2 relief law
// (world-engine-v2-relief-law-2026-07-28) leaves it exactly where it was.
const PHOBOS_MULT     = Math.pow(1e-3, -0.58);
const ENV_MULT_TOL    = 1e-9;                              // float slack on the ≤ bound (the function is clamped ⇒ exact)
const REF_RELIEF      = 0.003;                             // Earth rendered relief/R at multiplier 1.0 (ILLUSTRATIVE only)

// ── PINNED E1-regime allow-list + k — captured from the V2-6 first calibration run 2026-07-20, hard-coded so
//    reruns are falsifiable. UNCHANGED for Inc-3 (S1/S2 do not touch computeE1 or the draw stream). ────────
const REGIME_PIN = {
  'Rocky (Earthlike)':      { k: 3, labels: ['rocky/episodic', 'rocky/mobile', 'rocky/stagnant'] },
  'Lava (hot airless)':     { k: 1, labels: ['rocky/heat-pipe'] },
  'Ocean (temperate)':      { k: 3, labels: ['rocky/episodic', 'rocky/mobile', 'rocky/stagnant'] },
  'Frozen (airless)':       { k: 1, labels: ['icy/dead-lid'] },
  'Gas giant (Jovian)':     { k: 1, labels: ['gas/dead-lid'] },
  'Gas giant (Saturnian)':  { k: 1, labels: ['gas/dead-lid'] },
  'Ice giant (Neptunian)':  { k: 1, labels: ['gas/dead-lid'] },
  'Sub-Neptune (hazy)':     { k: 1, labels: ['gas/dead-lid'] },
  'Eyeball (locked temperate)': { k: 3, labels: ['rocky/episodic', 'rocky/mobile', 'rocky/stagnant'] },
  'Carbon (high C/O)':      { k: 1, labels: ['carbon/dead-lid'] },
  'Crystal (faceted)':      { k: 1, labels: ['icy/dead-lid'] },
};

// ── helpers ──────────────────────────────────────────────────────────────────────────────────────────
const closeRel = (a, b, relEps = 1e-12) =>
  Math.abs(a - b) <= relEps * Math.max(Math.abs(a), Math.abs(b), Number.MIN_VALUE);
const mean = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;
const variance = (xs) => { const m = mean(xs); return xs.reduce((s, x) => s + (x - m) ** 2, 0) / xs.length; };
const finiteAll = (obj) => Object.values(obj).every((v) =>
  v == null || typeof v !== 'number' || Number.isFinite(v));

// The set the harness sweeps: archetype presets whose radius genuinely draws (NAMED_BODY presets lock canonical
// ⇒ zero radius variance ⇒ not a "population"). Moon/Mercury/Mars/Titan/Europa/Venus/Magma are NAMED_BODY.
const SWEPT = PRESET_NAMES.filter((n) => PRESET_ARCHETYPE[n] && !NAMED_BODY.has(n));

const condAt = (fp, R) => deriveConditionVector(fp, deriveUniforms(fp, 1.0), R);

// A carrier mesh is shared across all impact-surface resolutions (built once — the dominant fixed cost).
let mesh = null;
const meshLazy = () => (mesh ??= buildIrregularSphere(MESH_N, 2));

// ── grep-assert: the lab consumes the SHARED draw law so the harness and GUI never drift ────────────────
function assertSharedDrawLaw() {
  const lab = execSync('grep -c "drawPresetRadius" world-engine-lab.html', { cwd: REPO }).toString().trim();
  const imports = execSync("grep -n \"import {.*drawPresetRadius.*} from './driver-presets.js'\" world-engine-lab.html || true",
    { cwd: REPO }).toString().trim();
  const ok = Number(lab) >= 1 && imports.length > 0;
  return { ok, count: Number(lab), importLine: imports.split('\n')[0] || null };
}

// ── grep-assert (INC-3): the lab consumes reliefEnvelope on uPerturb (the one envelope application, §0.2/§1.2) so
//    the baked multiplier and this harness's gate can never drift. Also asserts the reliefNorm FUNCTION DEFINITION
//    is retired (S1) — the structural proof the double-application is gone. NOTE: we count `function reliefNorm`,
//    NOT bare `reliefNorm(`, because the plan deliberately KEPT/updated comment references to the retired symbol
//    (documenting the old law + the edifice change); comment text is not a live consumer. With zero definitions,
//    no `reliefNorm(` token can resolve to a call. ────────────────────────────────────────────────────────────
function assertEnvelopeWiring() {
  const uPerturbEnv = execSync(
    "grep -c 'uPerturb.value = state.perturb \\* reliefEnvelope' world-engine-lab.html || true",
    { cwd: REPO }).toString().trim();
  const imports = execSync("grep -c 'reliefEnvelope' world-engine-lab.html || true", { cwd: REPO }).toString().trim();
  // reliefNorm FUNCTION DEFINITIONS remaining in the lab (S1 retired it); expect 0 ⇒ no call can resolve.
  const normDefs = execSync("grep -c 'function reliefNorm' world-engine-lab.html || true", { cwd: REPO }).toString().trim();
  const ok = Number(uPerturbEnv) >= 1 && Number(imports) >= 1 && Number(normDefs) === 0;
  return { ok, uPerturbEnv: Number(uPerturbEnv), reliefEnvelopeRefs: Number(imports), reliefNormDefs: Number(normDefs) };
}

// ── main sweep ───────────────────────────────────────────────────────────────────────────────────────
const t0 = Date.now();
const failures = [];
const presetRows = [];
const matureCoverages = [];   // (name, seed, coverage) over the MATURE denominator
const erosionSuppressed = [];
const envPoints = [];         // ★ INC-3: {name, seed, R, g, mult} over the WHOLE drawn population

for (const name of SWEPT) {
  const tp = Date.now();
  const fp = DRIVER_PRESETS[name];
  const R_c = fp.radiusEarth ?? 1.0;
  const canon = condAt(fp, R_c);
  const impact = isImpactSurface(canon);
  const gCanon = deriveConditionVector(fp, deriveUniforms(fp, 1.0), R_c).surfaceGravity;
  const M_c = gCanon * R_c * R_c;

  const radii = [], coverages = [];
  const labels = new Map();
  let carrierResolved = 0, carrierNaN = 0, carrierFlatBad = 0;
  let matureSeenThisPreset = 0;
  const mults = [];             // ★ INC-3: per-seed relief multipliers for this preset

  for (let s = 1; s <= N_SEEDS; s++) {
    const R = drawPresetRadius(name, s);
    radii.push(R);
    const cond = condAt(fp, R);
    const sched = craterSchedule(cond);
    coverages.push(sched.coverage);

    // 1. physics invariants ──────────────────────────────────────────────────
    // gravity-selfcompression-2026-07-28: the law this invariant pins is no longer the plain ratio.
    // It is g = g_c·f(R)/f(R_c) with f piecewise in ABSOLUTE R (R^(4/3) below 1, R^1.70 above), on the
    // ROCKY class only. Re-derived from the shipped shape rather than re-implemented inline, so this
    // harness cannot drift from production again the way it just did.
    const gExpected = gCanon * (compositionClass(cond) === 'rocky'
      ? gravityRadiusShape(R) / gravityRadiusShape(R_c)
      : R / R_c);
    if (cond.surfaceGravity !== gExpected)
      failures.push(`${name} seed ${s}: surfaceGravity ${cond.surfaceGravity} !== g_canon·f(R)/f(R_c) ${gExpected}`);
    const massRoundTrip = cond.surfaceGravity * cond.radiusEarth * cond.radiusEarth;
    // gravity-selfcompression-2026-07-28: massEarthOf = g·R² carries the gravity exponent PLUS 2,
    // so on the rocky branch the implied mass law is M_c·(R/R_c)^3.7 above 1 R⊕ and ^(10/3) below,
    // not a flat ^3. Derived from the same shipped shape as the gravity check above.
    const _shape = compositionClass(cond) === 'rocky'
      ? gravityRadiusShape(R) / gravityRadiusShape(R_c)
      : R / R_c;
    const mDerived = M_c * _shape * (R / R_c) ** 2;
    if (!closeRel(massRoundTrip, mDerived))
      failures.push(`${name} seed ${s}: massEarthOf round-trip ${massRoundTrip} !≈ M_c·f(R)/f(R_c)·(R/R_c)² ${mDerived}`);
    if (!finiteAll(cond))
      failures.push(`${name} seed ${s}: non-finite field in condition vector`);
    if (!Number.isFinite(sched.coverage) || !Number.isFinite(sched.nAnalytic))
      failures.push(`${name} seed ${s}: non-finite schedule (coverage/nAnalytic)`);

    // ★ INC-3 envelope multiplier over the drawn point ─────────────────────────
    const mult = reliefEnvelope(R, cond.surfaceGravity);
    if (!Number.isFinite(mult)) failures.push(`${name} seed ${s}: reliefEnvelope non-finite (R=${R}, g=${cond.surfaceGravity})`);
    mults.push(mult);
    envPoints.push({ name, seed: s, R, g: cond.surfaceGravity, mult, cls: compositionClass(cond) });

    // E1 regime label ─────────────────────────────────────────────────────────
    const e1 = computeE1(cond, s);
    labels.set(e1.label, (labels.get(e1.label) || 0) + 1);

    // MATURE denominator classification (PINNED) ───────────────────────────────
    const isMature = impact && sched.screen >= SCREEN_MATURE && sched.tExp >= K_EXP_MATURE * (cond.age ?? 4.5);
    if (impact && !isMature) {
      erosionSuppressed.push({ name, seed: s, coverage: sched.coverage, screen: sched.screen, tExp: sched.tExp });
    }
    if (isMature) { matureCoverages.push({ name, seed: s, coverage: sched.coverage }); matureSeenThisPreset++; }

    // full stamped carrier ONLY for impact-surface archetypes ──────────────────
    if (impact) {
      const c = makeSphereField(meshLazy());
      writeBombardment(c, cond, { macroSeed: s });
      carrierResolved++;
      let hasNaN = false, allZero = true;
      const cf = c.craterField;
      for (let i = 0; i < cf.length; i++) { if (Number.isNaN(cf[i])) { hasNaN = true; break; } if (cf[i] !== 0) allZero = false; }
      if (hasNaN) { carrierNaN++; failures.push(`${name} seed ${s}: NaN in resolved craterField`); }
      if (allZero && sched.nStamp >= 1) { carrierFlatBad++; failures.push(`${name} seed ${s}: flat craterField despite nStamp=${sched.nStamp}`); }
    }
  }

  const rVar = variance(radii), covVar = variance(coverages);
  // 3. nonzero radius variance for every swept preset ──────────────────────────
  if (!(rVar > 0)) failures.push(`${name}: drawn-radius variance is zero (seed does not drive distinct worlds)`);

  // 4. E1-regime diversity vs the PINNED allow-list ────────────────────────────
  const pin = REGIME_PIN[name];
  const distinct = [...labels.keys()].sort();
  if (!pin) {
    failures.push(`${name}: no REGIME_PIN entry (unpinned preset — pin it from this run)`);
  } else {
    if (distinct.length < pin.k)
      failures.push(`${name}: E1 diversity ${distinct.length} < pinned k ${pin.k} [${distinct.join(', ')}]`);
    const stray = distinct.filter((l) => !pin.labels.includes(l));
    if (stray.length)
      failures.push(`${name}: E1 label(s) outside pinned allow-list: ${stray.join(', ')} (physics changed — re-adjudicate the pin)`);
  }

  presetRows.push({
    name, archetype: PRESET_ARCHETYPE[name], impact,
    R: { min: Math.min(...radii), max: Math.max(...radii), variance: rVar },
    coverage: { mean: mean(coverages), variance: covVar },
    matureSeeds: matureSeenThisPreset,
    e1: { distinct: distinct.length, labels: distinct, counts: Object.fromEntries(labels) },
    carrier: { resolved: carrierResolved, naN: carrierNaN, flatBad: carrierFlatBad },
    // ★ INC-3 envelope stats for this preset (multiplier = gate; apparent = soft illustrative)
    env: { multMin: Math.min(...mults), multMax: Math.max(...mults),
           apparentMin: REF_RELIEF * Math.min(...mults), apparentMax: REF_RELIEF * Math.max(...mults) },
    ms: Date.now() - tp,
  });
}

// 2. coverage band over the MATURE denominator ─────────────────────────────────
const matureN = matureCoverages.length;
const matureInBand = matureCoverages.filter((m) => m.coverage >= COV_LO && m.coverage <= COV_HI).length;
const matureInBandFrac = matureN ? matureInBand / matureN : 0;
if (matureN === 0) failures.push('coverage gate: MATURE denominator is EMPTY (no airless substantially-exposed seed)');
else if (matureInBandFrac < COV_INBAND_MIN)
  failures.push(`coverage gate: only ${(matureInBandFrac * 100).toFixed(1)}% of ${matureN} MATURE seeds in [${COV_LO},${COV_HI}] (need ≥${COV_INBAND_MIN * 100}%)`);
// 3b. coverage metric genuinely varies over the MATURE set ─────────────────────
const matureCovVar = matureN ? variance(matureCoverages.map((m) => m.coverage)) : 0;
if (!(matureCovVar > 0)) failures.push('variance gate: MATURE-set coverage variance is zero (metric collapsed)');

// ── ★ INC-3 ENVELOPE GATE (§3 S3-step-1) ───────────────────────────────────────────────────────────────
// (a) bounded ≤ PHOBOS_MULT ; (b) monotone in g ; (c) radius-independent (structural spy).
const envMults = envPoints.map((p) => p.mult);
const envMaxMult = Math.max(...envMults);
const envMinMult = Math.min(...envMults);
// (a) bound
const envOverCap = envPoints.filter((p) => p.mult > PHOBOS_MULT + ENV_MULT_TOL);
if (envOverCap.length) {
  const w = envOverCap.sort((a, b) => b.mult - a.mult)[0];
  failures.push(`envelope gate (bound): ${envOverCap.length} drawn multiplier(s) exceed PHOBOS_MULT ${PHOBOS_MULT.toFixed(4)} (worst ${w.name} seed ${w.seed}: ${w.mult.toFixed(4)} at g=${w.g.toFixed(4)})`);
}
// (b) monotone in g (non-increasing as g rises), clamp permitting ties
const envByG = [...envPoints].sort((a, b) => a.g - b.g);
let envMonoViolations = 0, worstMono = null;
for (let i = 1; i < envByG.length; i++) {
  // strictly higher g must NOT yield a strictly higher multiplier (allow float ties within tol)
  if (envByG[i].g > envByG[i - 1].g && envByG[i].mult > envByG[i - 1].mult + ENV_MULT_TOL) {
    envMonoViolations++;
    if (!worstMono) worstMono = { lo: envByG[i - 1], hi: envByG[i] };
  }
}
if (envMonoViolations) {
  failures.push(`envelope gate (monotone): ${envMonoViolations} pair(s) where higher g gave higher multiplier (sign broken) — e.g. g ${worstMono.lo.g.toFixed(4)}→${worstMono.hi.g.toFixed(4)} mult ${worstMono.lo.mult.toFixed(4)}→${worstMono.hi.mult.toFixed(4)}`);
}
// (c) radius-independence (structural): perturb R at the SAME g, multiplier must be bit-identical (radius via g).
let envRadiusLeaks = 0, worstLeak = null;
for (const p of envPoints) {
  const perturbed = reliefEnvelope(p.R * 7.3 + 1.0, p.g);   // a very different R, identical g
  if (perturbed !== p.mult) {
    envRadiusLeaks++;
    if (!worstLeak) worstLeak = { ...p, perturbed };
  }
}
if (envRadiusLeaks) {
  failures.push(`envelope gate (radius-independence): ${envRadiusLeaks} point(s) where reliefEnvelope changed when only R moved (radius leak — footnote-14 double-dip NOT resolved) — e.g. ${worstLeak.name} seed ${worstLeak.seed}: ${worstLeak.mult} vs ${worstLeak.perturbed}`);
}
// (d) ★ v2 ABSOLUTE RELIEF: h = mult·R must fall as R^-1.853 along each rocky preset's own above-seam draws.
//     ABS_EXP is HAND-WRITTEN (= 1 - 1.70·1.678235294117647); deriving it from the shipped constants would let a
//     joint retune move the claim and the measurement together, which is the defect this workstream keeps hitting.
const ABS_EXP = -1.853, ABS_TOL = 1e-6, ABS_MIN_PTS = 3;
function logLogSlope(pts) {                       // unweighted least squares on (log R, log h)
  const n = pts.length;
  const lx = pts.map((p) => Math.log(p.R)), ly = pts.map((p) => Math.log(p.h));
  const mx = lx.reduce((a, b) => a + b, 0) / n, my = ly.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (lx[i] - mx) * (ly[i] - my); den += (lx[i] - mx) ** 2; }
  return den > 0 ? num / den : NaN;
}
const absRows = [];
for (const name of SWEPT) {
  // Above the seam AND on the rocky SUPER branch (R > 1): the ruled exponent is stated for R^1.70 gravity, and
  // a fit straddling the R = 1 join would measure the blend — the same discipline the LAW_REGISTRY entries use.
  const pts = envPoints.filter((p) => p.name === name && p.cls === 'rocky' && p.g >= 1 && p.R > 1)
                       .map((p) => ({ R: p.R, h: p.mult * p.R }));
  if (pts.length < ABS_MIN_PTS) { absRows.push({ name, n: pts.length, slope: null, skipped: true }); continue; }
  const slope = logLogSlope(pts);
  absRows.push({ name, n: pts.length, slope, skipped: false });
  if (!(Math.abs(slope - ABS_EXP) <= ABS_TOL))
    failures.push(`envelope gate (absolute relief): ${name} absolute-relief slope ${slope.toFixed(6)} != ${ABS_EXP} (tol ${ABS_TOL}) over ${pts.length} above-seam rocky draws`);
}
const absQualified = absRows.filter((r) => !r.skipped);
// NON-VACUITY: a gate that silently qualifies zero presets passes forever. Assert at least one measured.
if (absQualified.length === 0)
  failures.push(`envelope gate (absolute relief): NO preset had >=${ABS_MIN_PTS} above-seam rocky draws — the gate measured nothing`);
const envAbsGreen = absQualified.length > 0 && absQualified.every((r) => Math.abs(r.slope - ABS_EXP) <= ABS_TOL);

const envGateGreen = envOverCap.length === 0 && envMonoViolations === 0 && envRadiusLeaks === 0 && envAbsGreen;

// ── AC-LAB-LEGIBLE envelope + Moon/Mercury boot retained count (for BUILD-NOTES) ────────────────────────
function bootLegibility() {
  const fp = DRIVER_PRESETS['Moon/Mercury (impact-airless)'];
  const cond = condAt(fp, fp.radiusEarth ?? 0.38);         // canonical lock (NAMED_BODY)
  const sched = craterSchedule(cond);
  const c = makeSphereField(meshLazy());
  const r = writeBombardment(c, cond, { macroSeed: 0, collectDiag: true });
  return { coverage: sched.coverage, nAnalytic: sched.nAnalytic, nStamp: sched.nStamp, nRetained: r.diag?.nRetained ?? null,
           reliefMult: reliefEnvelope(cond.radiusEarth, cond.surfaceGravity), g: cond.surfaceGravity };
}
const boot = bootLegibility();
const matureCovVals = matureCoverages.map((m) => m.coverage);
const labLegibleEnvelope = matureN
  ? { covMinPct: Math.min(...matureCovVals) * 100, covMaxPct: Math.max(...matureCovVals) * 100, covMeanPct: mean(matureCovVals) * 100 }
  : null;

// 4b/5. shared-draw-law grep + envelope-wiring grep + golden byte suite ─────────
const drawLaw = assertSharedDrawLaw();
if (!drawLaw.ok) failures.push(`shared-draw-law grep: lab does not import drawPresetRadius from ./driver-presets.js (count=${drawLaw.count})`);
const envWiring = assertEnvelopeWiring();
if (!envWiring.ok) failures.push(`envelope-wiring grep: lab uPerturb.value must consume reliefEnvelope and the reliefNorm function definition must be retired (uPerturbEnv=${envWiring.uPerturbEnv}, reliefEnvelopeRefs=${envWiring.reliefEnvelopeRefs}, reliefNormDefs=${envWiring.reliefNormDefs})`);

let goldens = { ok: false, note: '' };
try {
  execSync('npx vitest run tests/v2-0-byte-identity.test.js --reporter=dot', { cwd: REPO, stdio: 'pipe' });
  goldens = { ok: true, note: 'tests/v2-0-byte-identity.test.js green' };
} catch (e) {
  goldens = { ok: false, note: 'byte-identity suite FAILED (goldens moved)' };
  failures.push('goldens gate: tests/v2-0-byte-identity.test.js NOT green at this commit');
}

const totalMs = Date.now() - t0;
if (totalMs > RUNTIME_BUDGET_MS) failures.push(`runtime ${(totalMs / 1000).toFixed(1)}s exceeds the ${RUNTIME_BUDGET_MS / 1000}s budget`);

// ── report ─────────────────────────────────────────────────────────────────────────────────────────
console.log('=== Inc-3 population-sweep acceptance harness (AC-POPSWEEP + envelope gate) ===');
console.log(`N_SEEDS=${N_SEEDS}  swept presets=${SWEPT.length}  mesh N=${MESH_N}  total=${(totalMs / 1000).toFixed(1)}s\n`);
console.log('preset                              arch          impact  R∈[min,max]        covMean  covVar     mult∈[min,max]    E1(k)  carrier  ms');
for (const r of presetRows) {
  console.log(
    `${r.name.padEnd(35)} ${(r.archetype ?? '').padEnd(13)} ${(r.impact ? 'yes' : 'no ').padEnd(6)} ` +
    `[${r.R.min.toFixed(2)},${r.R.max.toFixed(2)}]`.padEnd(18) +
    ` ${(r.coverage.mean * 100).toFixed(1).padStart(5)}%  ${r.coverage.variance.toExponential(1).padStart(8)}  ` +
    `[${r.env.multMin.toFixed(2)},${r.env.multMax.toFixed(2)}]`.padEnd(17) +
    ` ${String(r.e1.distinct).padStart(2)}   ${(r.carrier.resolved + '/' + r.carrier.naN + '/' + r.carrier.flatBad).padStart(7)}  ${r.ms}`,
  );
}

console.log(`\nMATURE impact-surface denominator (isImpactSurface && screen≥${SCREEN_MATURE} && t_exp≥${K_EXP_MATURE}·age):`);
console.log(`  ${matureN} seeds; ${matureInBand} in [${COV_LO * 100}%,${COV_HI * 100}%] = ${(matureInBandFrac * 100).toFixed(1)}% (need ≥${COV_INBAND_MIN * 100}%); coverage variance ${matureCovVar.toExponential(2)}`);
const bySource = {};
for (const m of matureCoverages) bySource[m.name] = (bySource[m.name] || 0) + 1;
console.log(`  contributing presets: ${Object.entries(bySource).map(([k, v]) => `${k}×${v}`).join(', ')}`);
console.log(`\nErosion-suppressed impact-surface seeds (reported, NOT counted against the band): ${erosionSuppressed.length}`);
const esBy = {};
for (const e of erosionSuppressed) esBy[e.name] = (esBy[e.name] || 0) + 1;
console.log(`  ${Object.entries(esBy).map(([k, v]) => `${k}×${v} (t_exp≈${erosionSuppressed.find((e) => e.name === k).tExp.toFixed(2)}Ga)`).join(', ')}`);

console.log(`\n★ INC-3 ENVELOPE GATE (exact multiplier reliefEnvelope(R,g)=clamp(g^-${Q_RELIEF} for g<1 | g^-${Q_RELIEF_DERIVED} for g>=1, ${RELIEF_FLOOR}, ${RELIEF_CEIL})):`);
console.log(`  drawn multiplier ∈ [${envMinMult.toFixed(4)}, ${envMaxMult.toFixed(4)}]  over ${envPoints.length} points (${SWEPT.length} presets × ${N_SEEDS} seeds)`);
console.log(`  (a) bound     : max ${envMaxMult.toFixed(4)} ≤ PHOBOS_MULT ${PHOBOS_MULT.toFixed(4)} ⇒ ${envOverCap.length === 0 ? 'OK' : `FAIL (${envOverCap.length} over)`}`);
console.log(`  (b) monotone  : ${envMonoViolations} sign violation(s) (higher g ⇒ higher mult) ⇒ ${envMonoViolations === 0 ? 'OK' : 'FAIL'}`);
console.log(`  (c) R-indep   : ${envRadiusLeaks} radius leak(s) (mult moved when only R moved) ⇒ ${envRadiusLeaks === 0 ? 'OK' : 'FAIL'}`);
console.log(`  (d) absolute  : h = mult·R vs R over above-seam ROCKY draws, claim ${ABS_EXP} (tol ${ABS_TOL}) ⇒ ${envAbsGreen ? 'OK' : 'FAIL'}`);
for (const r of absRows) {
  console.log(`        ${r.name.padEnd(30)} ${r.skipped ? `n=${r.n} (skipped, <${ABS_MIN_PTS} above-seam rocky draws)` : `n=${r.n} slope=${r.slope.toFixed(6)}`}`);
}
console.log(`  soft/illustrative apparent (REF_RELIEF=${REF_RELIEF}·mult, NOT a gate — lens physics MF1): ∈ [${(REF_RELIEF * envMinMult).toFixed(4)}, ${(REF_RELIEF * envMaxMult).toFixed(4)}]`);
console.log(`  in-band RENDER claim = coordinator's live AC-LAB-READ, NOT this gate.`);

console.log(`\nMoon/Mercury boot (AC-LAB-LEGIBLE envelope, recorded in BUILD-NOTES):`);
console.log(`  coverage=${(boot.coverage * 100).toFixed(1)}%  nAnalytic=${boot.nAnalytic.toExponential(2)}  nStamp=${boot.nStamp}  nRetained=${boot.nRetained}  reliefMult=${boot.reliefMult.toFixed(3)} (g=${boot.g.toFixed(3)})`);
if (labLegibleEnvelope) console.log(`  MATURE coverage envelope: [${labLegibleEnvelope.covMinPct.toFixed(1)}%, ${labLegibleEnvelope.covMaxPct.toFixed(1)}%] mean ${labLegibleEnvelope.covMeanPct.toFixed(1)}%`);

console.log(`\nShared draw law: lab imports drawPresetRadius from ./driver-presets.js — ${drawLaw.ok ? 'OK' : 'MISSING'} (grep count=${drawLaw.count})`);
console.log(`Envelope wiring: uPerturb=reliefEnvelope ${envWiring.uPerturbEnv}× / reliefEnvelope refs ${envWiring.reliefEnvelopeRefs} / reliefNorm defs ${envWiring.reliefNormDefs} — ${envWiring.ok ? 'OK' : 'FAIL'}`);
console.log(`Goldens: ${goldens.note} — ${goldens.ok ? 'OK' : 'FAIL'}`);

// ── machine-readable summary ───────────────────────────────────────────────────────────────────────
const summary = {
  meta: { generated: new Date().toISOString(), workstream: 'world-engine-inc3-relief-spine-depthlaw-2026-07-21',
          nSeeds: N_SEEDS, sweptPresets: SWEPT.length, meshN: MESH_N, totalMs, budgetMs: RUNTIME_BUDGET_MS },
  gates: {
    physicsInvariants: !failures.some((f) => /surfaceGravity|massEarthOf|non-finite|NaN|flat/.test(f)),
    coverageBand: matureN > 0 && matureInBandFrac >= COV_INBAND_MIN,
    variance: presetRows.every((r) => r.R.variance > 0) && matureCovVar > 0,
    e1Diversity: !failures.some((f) => /E1 diversity|E1 label|REGIME_PIN/.test(f)),
    envelope: envGateGreen,                    // ★ INC-3
    goldensStable: goldens.ok,
    sharedDrawLaw: drawLaw.ok,
    envelopeWiring: envWiring.ok,              // ★ INC-3
    runtimeBudget: totalMs <= RUNTIME_BUDGET_MS,
  },
  coverage: { band: [COV_LO, COV_HI], inBandMin: COV_INBAND_MIN, matureN, matureInBand, matureInBandFrac, matureCovVariance: matureCovVar },
  envelope: {                                  // ★ INC-3
    law: `reliefEnvelope(R,g)=clamp(g^-${Q_RELIEF} for g<1 (CALIBRATION) | g^-${Q_RELIEF_DERIVED} for g>=1 (DERIVATION), ${RELIEF_FLOOR}, ${RELIEF_CEIL}); radiusEarth argument accepted but UNUSED (radius via g)`,
    Q_RELIEF, Q_RELIEF_DERIVED, RELIEF_FLOOR, RELIEF_CEIL, phobosMult: PHOBOS_MULT, refReliefIllustrative: REF_RELIEF,
    nPoints: envPoints.length, multMin: envMinMult, multMax: envMaxMult,
    apparentMinIllustrative: REF_RELIEF * envMinMult, apparentMaxIllustrative: REF_RELIEF * envMaxMult,
    boundOK: envOverCap.length === 0, monotoneViolations: envMonoViolations, radiusLeaks: envRadiusLeaks,
    absoluteRelief: { claimedExponent: ABS_EXP, tol: ABS_TOL, minPoints: ABS_MIN_PTS, ok: envAbsGreen, rows: absRows },
    wiring: envWiring,
    note: 'The MULTIPLIER bound+monotone+radius-independence is the exact defensible invariant. The apparent band is illustrative only (lens physics MF1); the in-band RENDER claim is the coordinator live AC-LAB-READ.',
  },
  matureDenominator: { screenMature: SCREEN_MATURE, kExpMature: K_EXP_MATURE, definition: 'isImpactSurface(cond) && screen>=SCREEN_MATURE && t_exp>=K_EXP_MATURE*age', bySource },
  erosionSuppressed: { count: erosionSuppressed.length, bySource: esBy },
  regimePin: REGIME_PIN,
  boot: { moonMercury: boot, labLegibleEnvelope },
  presets: presetRows,
  failures,
};
const outPath = join(__dirname, 'population-sweep-summary.json');
writeFileSync(outPath, JSON.stringify(summary, null, 2));
console.log(`\nsummary → ${outPath}`);

if (failures.length) {
  console.log(`\nFAIL — ${failures.length} gate violation(s):`);
  for (const f of failures.slice(0, 40)) console.log(`  • ${f}`);
  process.exit(1);
}
console.log('\nALL GATES GREEN — drawn-population acceptance + envelope gate pass.');
process.exit(0);
