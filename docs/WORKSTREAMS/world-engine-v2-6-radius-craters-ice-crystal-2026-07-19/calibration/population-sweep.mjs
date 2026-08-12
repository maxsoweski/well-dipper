// calibration/population-sweep.mjs — World Engine V2-6 SLICE-6 acceptance harness (AC-POPSWEEP; §1G / Lens L20-L23).
//
// PURPOSE: AC-POPSWEEP judges the DRAWN POPULATION, not a boot state (INTENT FRAME "no defaults"). For every
// seed-varying archetype preset × N_SEEDS seeds it draws a radius through the SHARED draw law (driver-presets.js
// drawPresetRadius — the same symbol planet-lod-lab.html imports, grep-asserted below so the two can never drift),
// derives the condition vector at the DRAWN radius, runs the crater schedule, and (for impact-surface archetypes
// only — Lens L22) resolves a full stamped carrier on a ~10k-node mesh. It then gates the whole ensemble:
//
//   1. PHYSICS INVARIANTS (every seed):   surfaceGravity coheres as g_canonical·(R/R_c) bit-exact; the massEarthOf
//                                         round-trip g·R² reconstructs M_c·(R/R_c)³ within float64 ulp; no NaN in
//                                         the derived vector; resolved carriers are NaN-free (and non-flat where
//                                         the schedule stamps ≥1 crater).
//   2. COVERAGE BAND (the AC phrase, operationalized — Lens L5/L20): the closed-form drawn-population coverage
//                                         (craterSchedule.coverage = N_analytic·E[(δ/2)²]/4) lands in [10%,80%]
//                                         for ≥90% of MATURE impact-surface seeds. "MATURE impact-surface seed"
//                                         is PINNED: isImpactSurface(cond) && screen ≥ SCREEN_MATURE && t_exp ≥
//                                         K_EXP_MATURE·age (airless, substantially-exposed). Erosion-shortened
//                                         seeds (Rocky/Ocean/Eyeball — atmosphere ⇒ t_exp≈0.1 Ga ⇒ coverage≈0 BY
//                                         PHYSICS) are reported in a SEPARATE row, never counted against the band.
//   3. NONZERO VARIANCE (non-degeneracy): the drawn radius genuinely sweeps (Var(R)>0) for every swept preset, and
//                                         the coverage metric genuinely varies (Var(coverage)>0) over the MATURE set
//                                         — a guard that the seed actually drives distinct worlds, not a constant.
//   4. E1-REGIME DIVERSITY (Lens L23):    per preset, distinct computeE1 labels ≥ the PINNED k AND ⊆ the PINNED
//                                         allow-list. k + the allow-list were pinned from the first calibration
//                                         run (the printed table committed with this harness; values in BUILD-NOTES)
//                                         then HARD-CODED here — reruns are falsifiable, no "where physics allows"
//                                         escape hatch. A new label (physics changed) or lost diversity both FAIL.
//   5. GOLDENS STABLE:                    the byte-identity suite (tests/v2-0-byte-identity.test.js) is green at
//                                         this commit (spawned as a gate — the acceptance run covers the fence).
//   6. RUNTIME BUDGET:                    < 10 min single-threaded; per-preset wall time in the JSON summary.
//
// It also prints the Moon/Mercury boot's retained-crater count + the AC-LAB-LEGIBLE coverage envelope (the live
// legibility target working-Claude drives against) — recorded in BUILD-NOTES. Machine-readable JSON summary to
// population-sweep-summary.json; nonzero exit on ANY gate failure. Pure `node` (no dev server, no claude -p).

import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { bodySurfaceGravity } from '../../../../src/worldengine/base/baseStep.js';
import { craterSchedule, isImpactSurface, writeBombardment } from '../../../../src/worldengine/base/bombardment.js';
import { DRIVER_PRESETS, PRESET_ARCHETYPE, PRESET_NAMES, NAMED_BODY, drawPresetRadius } from '../../../../driver-presets.js';
import { deriveConditionVector, gravityRadiusShape } from '../../../../src/worldengine/base/conditionVector.js';
import { compositionClass } from '../../../../src/worldengine/base/e1Regime.js';
import { deriveUniforms } from '../../../../src/worldengine/base/labCore.js';
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
const MESH_N          = 10000;                 // full-carrier resolution mesh (~10k nodes; §1G)
const RUNTIME_BUDGET_MS = 10 * 60 * 1000;

// ── PINNED E1-regime allow-list + k (Lens L23) — captured from the first calibration run 2026-07-20, then
//    hard-coded so reruns are falsifiable. The full first-run table is in the committed summary + BUILD-NOTES.
//    Keyed by PRESET NAME (two presets share the 'sub-neptune'/'gas-giant' archetype — each is its own row).
//    k = the observed distinct-label count; a rerun must reach ≥ k AND stay ⊆ the listed labels. ──────────
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

// ── grep-assert: the lab consumes the SHARED draw law (Lens L21) so the harness and GUI never drift ──────
function assertSharedDrawLaw() {
  const lab = execSync('grep -c "drawPresetRadius" planet-lod-lab.html', { cwd: REPO }).toString().trim();
  const imports = execSync("grep -n \"import {.*drawPresetRadius.*} from './driver-presets.js'\" planet-lod-lab.html || true",
    { cwd: REPO }).toString().trim();
  const ok = Number(lab) >= 1 && imports.length > 0;
  return { ok, count: Number(lab), importLine: imports.split('\n')[0] || null };
}

// ── main sweep ───────────────────────────────────────────────────────────────────────────────────────
const t0 = Date.now();
const failures = [];
const presetRows = [];
const matureCoverages = [];   // (name, seed, coverage) over the MATURE denominator
const erosionSuppressed = [];

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

    // E1 regime label ─────────────────────────────────────────────────────────
    const e1 = computeE1(cond, s);
    labels.set(e1.label, (labels.get(e1.label) || 0) + 1);

    // MATURE denominator classification (PINNED) ───────────────────────────────
    const isMature = impact && sched.screen >= SCREEN_MATURE && sched.tExp >= K_EXP_MATURE * (cond.age ?? 4.5);
    if (impact && !isMature) {
      erosionSuppressed.push({ name, seed: s, coverage: sched.coverage, screen: sched.screen, tExp: sched.tExp });
    }
    if (isMature) { matureCoverages.push({ name, seed: s, coverage: sched.coverage }); matureSeenThisPreset++; }

    // full stamped carrier ONLY for impact-surface archetypes (Lens L22) ───────
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

// ── AC-LAB-LEGIBLE envelope + Moon/Mercury boot retained count (§1G, for BUILD-NOTES) ──────────────────
function bootLegibility() {
  const fp = DRIVER_PRESETS['Moon/Mercury (impact-airless)'];
  const cond = condAt(fp, fp.radiusEarth ?? 0.38);         // canonical lock (NAMED_BODY)
  const sched = craterSchedule(cond);
  const c = makeSphereField(meshLazy());
  const r = writeBombardment(c, cond, { macroSeed: 0, collectDiag: true });
  return { coverage: sched.coverage, nAnalytic: sched.nAnalytic, nStamp: sched.nStamp, nRetained: r.diag?.nRetained ?? null };
}
const boot = bootLegibility();
// the AC-LAB-LEGIBLE coverage envelope = the MATURE-set coverage spread working-Claude drives against
const matureCovVals = matureCoverages.map((m) => m.coverage);
const labLegibleEnvelope = matureN
  ? { covMinPct: Math.min(...matureCovVals) * 100, covMaxPct: Math.max(...matureCovVals) * 100, covMeanPct: mean(matureCovVals) * 100 }
  : null;

// 4b/5. shared-draw-law grep + golden byte suite ───────────────────────────────
const drawLaw = assertSharedDrawLaw();
if (!drawLaw.ok) failures.push(`shared-draw-law grep: lab does not import drawPresetRadius from ./driver-presets.js (count=${drawLaw.count})`);

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
console.log('=== V2-6 population-sweep acceptance harness (AC-POPSWEEP) ===');
console.log(`N_SEEDS=${N_SEEDS}  swept presets=${SWEPT.length}  mesh N=${MESH_N}  total=${(totalMs / 1000).toFixed(1)}s\n`);
console.log('preset                              arch          impact  R∈[min,max]        covMean  covVar     E1(k):labels                                   carrier  ms');
for (const r of presetRows) {
  console.log(
    `${r.name.padEnd(35)} ${(r.archetype ?? '').padEnd(13)} ${(r.impact ? 'yes' : 'no ').padEnd(6)} ` +
    `[${r.R.min.toFixed(2)},${r.R.max.toFixed(2)}]`.padEnd(18) +
    ` ${(r.coverage.mean * 100).toFixed(1).padStart(5)}%  ${r.coverage.variance.toExponential(1).padStart(8)}  ` +
    `${(r.e1.distinct + ':' + r.e1.labels.join('|')).padEnd(46)} ${(r.carrier.resolved + '/' + r.carrier.naN + '/' + r.carrier.flatBad).padStart(7)}  ${r.ms}`,
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

console.log(`\nMoon/Mercury boot (AC-LAB-LEGIBLE envelope, recorded in BUILD-NOTES):`);
console.log(`  coverage=${(boot.coverage * 100).toFixed(1)}%  nAnalytic=${boot.nAnalytic.toExponential(2)}  nStamp=${boot.nStamp}  nRetained=${boot.nRetained}`);
if (labLegibleEnvelope) console.log(`  MATURE coverage envelope: [${labLegibleEnvelope.covMinPct.toFixed(1)}%, ${labLegibleEnvelope.covMaxPct.toFixed(1)}%] mean ${labLegibleEnvelope.covMeanPct.toFixed(1)}%`);

console.log(`\nShared draw law: lab imports drawPresetRadius from ./driver-presets.js — ${drawLaw.ok ? 'OK' : 'MISSING'} (grep count=${drawLaw.count})`);
console.log(`Goldens: ${goldens.note} — ${goldens.ok ? 'OK' : 'FAIL'}`);

// ── machine-readable summary ───────────────────────────────────────────────────────────────────────
const summary = {
  meta: { generated: new Date().toISOString(), nSeeds: N_SEEDS, sweptPresets: SWEPT.length, meshN: MESH_N, totalMs, budgetMs: RUNTIME_BUDGET_MS },
  gates: {
    physicsInvariants: !failures.some((f) => /surfaceGravity|massEarthOf|non-finite|NaN|flat/.test(f)),
    coverageBand: matureN > 0 && matureInBandFrac >= COV_INBAND_MIN,
    variance: presetRows.every((r) => r.R.variance > 0) && matureCovVar > 0,
    e1Diversity: !failures.some((f) => /E1 diversity|E1 label|REGIME_PIN/.test(f)),
    goldensStable: goldens.ok,
    sharedDrawLaw: drawLaw.ok,
    runtimeBudget: totalMs <= RUNTIME_BUDGET_MS,
  },
  coverage: { band: [COV_LO, COV_HI], inBandMin: COV_INBAND_MIN, matureN, matureInBand, matureInBandFrac, matureCovVariance: matureCovVar },
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
console.log('\nALL GATES GREEN — drawn-population acceptance passes.');
process.exit(0);
