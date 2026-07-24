// calibration/domain-predicate.mjs — Inc-3b S0.3: the relief-variance-budget DOMAIN / CONTINUITY
// predicate, stated in CONDITION SCALARS ONLY, + the near-cliff enumeration + the committed
// affected-set table. Pure `node` ESM, runnable from any cwd, single-threaded, no dev server, no
// network, no RNG in any printed/written number. Every number reproduces EXACTLY on re-run.
//
// ── ANCHORS (read this session, verified file:symbol, NOT inferred from the brief) ────────────────
//   BUILD-PLAN §1.S0 block S0.3  — the predicate phrasing + the committed 147/132/147/104 table +
//                                  the Titan/Europa near-cliff assertion targets.
//   BUILD-PLAN §0.6              — bombardment seams: isImpactSurface (bombardment.js:143),
//                                  craterSchedule (bombardment.js:155), the domain-predicate scalars
//                                  {fired,nStamp,tExp,coverage}, and the degeneracy guard :183.
//   grounding-relief-budget-2026-07-21.md §1 P5 / §0-header — the affected set
//                                  {Moon/Mercury 147, Mars 132, Frozen 147, Crystal 104} and the
//                                  true null-path list; §A3 — "domain in condition scalars, continuous
//                                  or bit-exact-1 outside; the composite's null topology is an
//                                  implementation fact, not the physical predicate."
//
// ── WHAT THE BUDGET DOMAIN IS (condition-scalar predicate; the S0.3 deliverable) ──────────────────
//   A world is IN the relief-variance-budget domain (its craterField is reweighted at the composite
//   seam, w_e≈0.17 / w_i≈O(90)) iff ALL of the following hold on its CONDITION VECTOR — the exact
//   scalars craterSchedule already reads (radiusEarth, surfaceGravity, age, atmosphere.pressure,
//   T_eq, rawTidalIoRatio), NOTHING else:
//
//     inDomain(cond) ≡
//         isImpactSurface(cond)            // cold (T_eq < CRATER_T_MAX=450 K) AND solid-surface
//                                          //   (atmosphere.pressure < P_SURF_MAX=200 bar) — bombardment.js:143
//       ∧ craterSchedule(cond).fired       // == isImpactSurface (the schedule's own gate); stated
//                                          //   explicitly so the predicate reads as the brief writes it
//       ∧ craterSchedule(cond).nStamp > 0  // "impact-retentive tExp-band": nStamp≥1 is TRUE exactly when
//                                          //   the schedule is non-degenerate — tExp>0 AND the km size
//                                          //   band L<H AND L_trunc<H (bombardment.js:183) AND at least
//                                          //   one crater lands above the angular mesh floor. nStamp≥1
//                                          //   ⇒ craterField populates ⇒ the "has-...-crater" overlay
//                                          //   channel the budget reallocates is nonzero.
//
//   The S0.3 phrasing "impact-retentive tExp-band AND fired AND nStamp>0 AND has-shelf-or-crater"
//   collapses to (isImpactSurface ∧ nStamp>0) on the condition vector: the tExp-band is what makes
//   nStamp≥1 possible (the degenerate guard forces nStamp=0 whenever tExp≤0), and for the CRATER
//   channel the budget targets, "has-crater" ⇔ nStamp>0. A shelf-only world (Rocky/Ocean: plate
//   shelfDepth present but nStamp=0) satisfies "has-shelf" and so the composite RUNS on it, but it is
//   NOT in the budget domain — it takes the bit-exact identity path w_e=w_i=1.0 (see below). That is
//   why "has-shelf-or-crater" is a composite-RUNS precondition, not the budget-membership test.
//
// ── OUTSIDE THE DOMAIN: bit-exact identity, NOT a topology cliff ──────────────────────────────────
//   For every cond with inDomain(cond)=false the budget returns w_e=w_i=1.0 and compositeMargins
//   reduces to the LITERAL pre-budget loop out[i]=h[i]+sd[i]+(cf?cf[i]:0) — byte-for-byte the shipped
//   output (1.0·x===x exact in IEEE-754). Continuity holds at the boundary: as nStamp→0 the domain is
//   LEFT (weights snap to 1.0) but the reallocated quantity (craterField) is itself →0 there, so the
//   composited field is continuous — no visible seam. This is the A3 "continuous or bit-exact-1
//   outside" guarantee.
//
// ── THE COMPOSITE'S NULL-RETURN TOPOLOGY IS AN IMPLEMENTATION FACT, NOT THE PREDICATE ─────────────
//   compositeMargins(carrier) early-outs to `null` when BOTH overlay channels (shelfDepth AND
//   craterField) are all-zero (planet-lod-rivers.js:212-216). That null is a realized-ARRAY property
//   read at composite time — it depends on what got written into the Float32Arrays, not on the body's
//   physics. The budget domain MUST NOT be defined by "compositeMargins returned null": doing so would
//   (a) invert the dependency (the predicate would be downstream of the very step it gates), and
//   (b) mis-classify shelf-only worlds (non-null return, yet identity budget) and any future channel.
//   The physical predicate above is computed from CONDITION SCALARS at writeBodyRelief time, BEFORE
//   the composite runs, and is the sole authority on domain membership. The null topology is recorded
//   here only as the orthogonal implementation cross-check it is.
//
// ── DETERMINISM / SEED NOTE ───────────────────────────────────────────────────────────────────────
//   nStamp, tExp, coverage are CLOSED-FORM (craterSchedule never draws) and the stamp count is
//   R-INVARIANT by the scale-free theorem (nAnalytic∝R², P_STAMP=(L/D_FLOOR)² with D_FLOOR∝R —
//   bombardment.js:184/:192/:178), so the enumeration is both seed-independent AND radius-independent
//   within a preset's condition class. We enumerate at each preset's CANONICAL radius (fp.radiusEarth)
//   and pin SEED below purely to (i) document the value a stamp draw WOULD use and (ii) prove the
//   NAMED_BODY canonical lock (drawPresetRadius(name,SEED)===canonical) on the affected-set named
//   bodies. No printed or written number depends on SEED.

import { craterSchedule, isImpactSurface } from '../../../../src/worldengine/base/bombardment.js';
import { DRIVER_PRESETS, PRESET_NAMES, NAMED_BODY, drawPresetRadius } from '../../../../driver-presets.js';
import { deriveConditionVector } from '../../../../body-condition-vector.js';
import { deriveUniforms } from '../../../../planet-lod-lab-core.js';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── pinned seed (documentary; no printed/written number depends on it — see header) ───────────────
const SEED = 1;   // the canonical macroSeed the predecessor harnesses pin; craterSchedule is closed-form.

// ── the COMMITTED affected-set table (BUILD-PLAN §1.S0.3 + brief §1 P5) ────────────────────────────
// These are the plan's committed measured stamp counts. NOT taste constants: the script RE-DERIVES
// each from craterSchedule(canonical cond).nStamp below and asserts equality (a falsifiable
// self-check — if the shipped physics moved, the delta prints loudly and the script exits nonzero).
const EXPECTED_NSTAMP = {
  'Moon/Mercury (impact-airless)': 147,   // brief §1 P5 "Moon/Mercury 147"; canonical R=0.38 R⊕
  'Mars (arid rocky)':             132,   // brief §0-header "Mars nStamp=132"; canonical R=0.53 R⊕
  'Frozen (airless)':              147,   // brief "Frozen 147 = Moon/Mercury 147"; canonical R=0.50 R⊕
  'Crystal (faceted)':             104,   // brief "Crystal 104"; canonical R=0.80 R⊕
};

// ── the near-cliff worlds to assert (BUILD-PLAN §1.S0.3 / brief §A3) ───────────────────────────────
// Both FIRE isImpactSurface (cold + solid surface) yet schedule ZERO above-floor stamps → identity
// path. They sit at the two distinct edges of the retentive band:
//   Titan  — tExp≈1.0 Ga (erosion-limited, T_RESURF_ERODE/erosion), but its 1.5-bar atmo screen +
//            small R put every retained crater below the mesh floor ⇒ nStamp=0 (a MESH-FLOOR cliff).
//   Europa — tExp≈0.005 Ga (tidal-resurfacing-limited, T_RESURF_TIDAL/td): the record is wiped
//            before any above-floor population accumulates ⇒ nStamp=0 (an EXPOSURE-AGE cliff).
const NEAR_CLIFF = {
  'Titan (methane seas)': { tExp: 1.0,   tExpTol: 5e-3 },  // T_RESURF_ERODE(0.1)/erosion → assert ≈1.0
  'Europa (icy moon)':    { tExp: 0.005, tExpTol: 5e-4 },  // T_RESURF_TIDAL/td → assert ≈0.005
};

// ── condition vector at a given radius (mirrors population-sweep.mjs / frozen-ice-trace.mjs) ───────
const condAt = (fp, R) => deriveConditionVector(fp, deriveUniforms(fp, 1.0), R);

// ── the domain predicate, condition scalars ONLY ──────────────────────────────────────────────────
function inBudgetDomain(cond, sched) {
  return isImpactSurface(cond)   // cold (T_eq<450K) AND solid-surface (P<200bar) — bombardment.js:143
      && sched.fired             // == isImpactSurface; explicit (schedule's own gate)
      && sched.nStamp > 0;       // impact-retentive tExp-band ⇒ has-crater overlay channel
}

// ── enumerate ALL presets at canonical radius ─────────────────────────────────────────────────────
const rows = [];
for (const name of PRESET_NAMES) {
  const fp = DRIVER_PRESETS[name];
  const Rcanonical = fp.radiusEarth ?? 1.0;
  const cond = condAt(fp, Rcanonical);
  const sched = craterSchedule(cond);
  const iis = isImpactSurface(cond);
  rows.push({
    preset: name,
    named: NAMED_BODY.has(name),
    Rcanonical,
    g: cond.surfaceGravity,
    T_eq: cond.T_eq,
    pressure: cond.atmosphere?.pressure ?? 0,
    isImpactSurface: iis,
    fired: sched.fired,
    nStamp: sched.nStamp,
    tExp: sched.tExp,
    coverage: sched.coverage,
    inDomain: inBudgetDomain(cond, sched),
  });
}

// ── classify into the three sets ──────────────────────────────────────────────────────────────────
const affected = rows.filter((r) => r.inDomain);                        // fired ∧ nStamp>0
const gateYesNoStamp = rows.filter((r) => r.fired && r.nStamp === 0);   // gate=Y but zero stamps
const nullGate = rows.filter((r) => !r.fired);                          // gate=N (gas/hot/deep-envelope)
// full null-path set per S0.3 = the gas/hot worlds (gate=N) + the gate=Y-but-nStamp=0 worlds
const nullPath = [...gateYesNoStamp, ...nullGate];

// ── report ────────────────────────────────────────────────────────────────────────────────────────
const failures = [];
const pad = (s, n) => String(s).padEnd(n);
const padL = (s, n) => String(s).padStart(n);

console.log('=== Inc-3b S0.3 — relief-variance-budget domain predicate + near-cliff enumeration ===\n');
console.log('DOMAIN PREDICATE (condition scalars only):  isImpactSurface(cond) ∧ schedule.fired ∧ nStamp>0');
console.log('OUTSIDE: bit-exact identity w_e=w_i=1.0 (compositeMargins reduces to h+sd+cf, byte-for-byte).\n');
console.log(`${pad('preset', 33)} ${pad('named', 6)} ${pad('R⊕', 6)} ${pad('g', 7)} ${pad('T_eq', 6)} ${pad('P(bar)', 8)} ${pad('impact', 7)} ${pad('nStamp', 7)} ${pad('tExp', 10)} ${pad('coverage', 11)} inDomain`);
for (const r of rows) {
  console.log(
    `${pad(r.preset, 33)} ${pad(r.named ? 'yes' : 'no', 6)} ${padL(r.Rcanonical.toFixed(2), 6)} ` +
    `${padL(r.g.toFixed(3), 7)} ${padL(r.T_eq, 6)} ${padL(r.pressure, 8)} ${pad(r.isImpactSurface ? 'yes' : 'no', 7)} ` +
    `${padL(r.nStamp, 7)} ${padL(r.tExp.toExponential(2), 10)} ${padL(r.coverage.toExponential(2), 11)} ${r.inDomain ? 'YES' : '·'}`,
  );
}

// ── ASSERT 1: the committed affected-set stamp counts ─────────────────────────────────────────────
console.log('\n── AFFECTED SET — committed stamp-count table (BUILD-PLAN §1.S0.3) ──');
for (const [name, expected] of Object.entries(EXPECTED_NSTAMP)) {
  const row = rows.find((r) => r.preset === name);
  if (!row) { failures.push(`affected-set: preset "${name}" not found in PRESET_NAMES`); continue; }
  const got = row.nStamp;
  const ok = got === expected && row.inDomain;
  console.log(`  ${pad(name, 33)} expected nStamp=${padL(expected, 4)}  got=${padL(got, 4)}  inDomain=${row.inDomain}  ${ok ? 'OK' : 'MISMATCH'}`);
  if (got !== expected) failures.push(`AFFECTED-SET DELTA: "${name}" nStamp expected ${expected}, got ${got} (Δ=${got - expected}) — the shipped crater physics moved; re-adjudicate the committed table.`);
  if (!row.inDomain) failures.push(`AFFECTED-SET: "${name}" is not inDomain (fired=${row.fired}, nStamp=${got}) — the predicate excludes a committed affected world.`);
}

// ── ASSERT 2: the near-cliff worlds (Titan, Europa) ───────────────────────────────────────────────
console.log('\n── NEAR-CLIFF WORLDS — fired isImpactSurface yet nStamp=0 (identity path) ──');
for (const [name, exp] of Object.entries(NEAR_CLIFF)) {
  const row = rows.find((r) => r.preset === name);
  if (!row) { failures.push(`near-cliff: preset "${name}" not found`); continue; }
  const nStampOK = row.fired === true && row.nStamp === 0 && row.inDomain === false;
  const tExpOK = Math.abs(row.tExp - exp.tExp) <= exp.tExpTol;
  console.log(`  ${pad(name, 22)} fired=${row.fired}  nStamp=${row.nStamp}  tExp=${row.tExp.toFixed(6)} (expect ≈${exp.tExp})  inDomain=${row.inDomain}  ${nStampOK && tExpOK ? 'OK' : 'MISMATCH'}`);
  if (!nStampOK) failures.push(`NEAR-CLIFF: "${name}" expected {fired:true, nStamp:0, inDomain:false}, got {fired:${row.fired}, nStamp:${row.nStamp}, inDomain:${row.inDomain}}`);
  if (!tExpOK) failures.push(`NEAR-CLIFF: "${name}" tExp expected ≈${exp.tExp} (±${exp.tExpTol}), got ${row.tExp}`);
}

// ── the three sets, printed ────────────────────────────────────────────────────────────────────────
console.log(`\n── SET PARTITION (all ${rows.length} presets) ──`);
console.log(`  AFFECTED (inDomain, budget reweights):  ${affected.map((r) => `${r.preset.replace(/ \(.*/, '')}(${r.nStamp})`).join(', ')}`);
console.log(`  NULL-PATH gate=Y but nStamp=0 (identity): ${gateYesNoStamp.map((r) => r.preset.replace(/ \(.*/, '')).join(', ')}`);
console.log(`  NULL-PATH gate=N (gas/hot/deep-envelope): ${nullGate.map((r) => r.preset.replace(/ \(.*/, '')).join(', ')}`);

// ── cross-check: NAMED_BODY canonical lock on the named affected-set worlds (SEED-inert draw) ─────
console.log('\n── NAMED_BODY canonical-lock cross-check (drawPresetRadius(name,SEED) === canonical) ──');
for (const name of ['Moon/Mercury (impact-airless)', 'Mars (arid rocky)']) {
  const canonical = DRIVER_PRESETS[name].radiusEarth;
  const drawn = drawPresetRadius(name, SEED);
  const ok = drawn === canonical;
  console.log(`  ${pad(name, 33)} canonical=${canonical}  drawn(SEED=${SEED})=${drawn}  ${ok ? 'LOCKED' : 'LEAK'}`);
  if (!ok) failures.push(`NAMED_BODY lock: drawPresetRadius("${name}",${SEED})=${drawn} !== canonical ${canonical}`);
}

// ── sanity: the partition covers every preset exactly once ─────────────────────────────────────────
if (affected.length + nullPath.length !== rows.length)
  failures.push(`partition: affected(${affected.length}) + nullPath(${nullPath.length}) !== ${rows.length} presets`);

// ── committed table → JSON (deterministic: no timestamps, no timing, no RNG) ───────────────────────
const table = {
  workstream: 'world-engine-inc3b-relief-budget-2026-07-21',
  slice: 'S0.3',
  seed: SEED,
  domainPredicate: {
    statement: 'isImpactSurface(cond) AND craterSchedule(cond).fired AND craterSchedule(cond).nStamp > 0',
    conditionScalars: ['T_eq', 'atmosphere.pressure', 'radiusEarth', 'surfaceGravity', 'age', 'rawTidalIoRatio'],
    outsideDomain: 'w_e = w_i = 1.0 (bit-exact identity; compositeMargins reduces to h+sd+cf byte-for-byte)',
    nullTopologyNote: "compositeMargins returns null iff BOTH shelfDepth AND craterField are all-zero — a realized-array implementation fact read at composite time, NOT the physical predicate. Domain membership is decided from condition scalars at writeBodyRelief time, before the composite runs.",
    constants: { CRATER_T_MAX_K: 450, P_SURF_MAX_bar: 200 },
  },
  affectedSet: affected.map((r) => ({
    preset: r.preset, Rcanonical: r.Rcanonical, g: r.g, nStamp: r.nStamp, tExp: r.tExp, coverage: r.coverage,
    expectedNStamp: EXPECTED_NSTAMP[r.preset] ?? null,
  })),
  nearCliff: Object.keys(NEAR_CLIFF).map((name) => {
    const r = rows.find((x) => x.preset === name);
    return { preset: name, fired: r.fired, nStamp: r.nStamp, tExp: r.tExp, inDomain: r.inDomain };
  }),
  nullPath: {
    gateYesNoStamp: gateYesNoStamp.map((r) => ({ preset: r.preset, fired: r.fired, nStamp: r.nStamp, tExp: r.tExp })),
    gateNo: nullGate.map((r) => ({ preset: r.preset, T_eq: r.T_eq, pressure: r.pressure })),
  },
  allPresets: rows,
  assertions: {
    affectedCountsMatch: Object.entries(EXPECTED_NSTAMP).every(([n, e]) => rows.find((r) => r.preset === n)?.nStamp === e),
    nearCliffMatch: Object.keys(NEAR_CLIFF).every((n) => { const r = rows.find((x) => x.preset === n); return r?.fired === true && r?.nStamp === 0; }),
    partitionComplete: affected.length + nullPath.length === rows.length,
    failures,
  },
};
const outPath = join(__dirname, 'domain-predicate-table.json');
writeFileSync(outPath, JSON.stringify(table, null, 2) + '\n');
console.log(`\ncommitted table → ${outPath}`);

if (failures.length) {
  console.log(`\nFAIL — ${failures.length} assertion violation(s):`);
  for (const f of failures) console.log(`  • ${f}`);
  process.exit(1);
}
console.log('\nALL ASSERTIONS GREEN — domain predicate + affected-set table + near-cliff enumeration reproduce.');
process.exit(0);
