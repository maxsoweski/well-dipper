// calibration/fence-population-invariance.mjs — World Engine Inc-3 SLICE-2 FENCE PROOF (AC-FENCE, BUILD-PLAN §5.2).
//
// CLAIM PROVEN: the crater-depth-law edit (S2) changes ONLY the per-crater amplitude/profile — it CANNOT move the
// drawn population. At a fixed worldSeed + fixed impact-surface condition the crater POPULATION (count, centres,
// km diameters, formation times, closed-form coverage) is byte-for-byte invariant pre/post; only the craterField
// AMPLITUDE values differ. This is the empirical half of §5 (the structural half — craterSchedule/forEachCrater
// contain no craterAmplitude reference — is asserted in tests/worldengine-inc3-depth-law.test.js).
//
// STRUCTURE (MINOR-3 schema): the committed baseline JSON (fence-baseline.json), captured at the PRE-edit S1 head,
// carries the sorted {centre, D_km, tI} tuples + nStamp + coverage AND a pre-edit craterField reference (full-array
// hash + a fixed set of exemplar {index,value} pairs). verify() re-runs the CURRENT writer and asserts the
// population tuples/count/coverage are byte-identical while the craterField hash + exemplars DIFFER (amplitudes
// changed). Also asserts the touched-node FOOTPRINT (the set of nonzero indices) is invariant — crater geometry
// (stampR) is amplitude-free, so only the values inside a fixed footprint move.
//
// USAGE:
//   node fence-population-invariance.mjs --capture   # writes fence-baseline.json (run PRE the depth edit, commit)
//   node fence-population-invariance.mjs              # verify: fresh run vs the committed baseline (PASS/FAIL, exit)
// Also exports runVerify() so the vitest S2 test can gate it in CI.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { makeSphereField } from '../../../../src/worldengine/base/sphereField.js';
import { buildIrregularSphere } from '../../../../planet-lod-rivers.js';
import { writeBombardment, forEachCrater } from '../../../../src/worldengine/base/bombardment.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASELINE = path.resolve(__dirname, 'fence-baseline.json');

// Fixed rig: a Moon/Mercury-class impact surface (iceness≈0 ⇒ ε≡0) whose stamped craters all sit ABOVE D_t (every
// stamp is complex-shallowed by the new law ⇒ the amplitude change is unambiguous), at a fixed mesh + macroSeed.
const MESH_N = 4000, MESH_SUBDIV = 2, MACRO_SEED = 7;
const COND = {
  atmosphere: null, rawTidalIoRatio: 0, T_eq: 235, surfaceGravity: 0.277, age: 4.5, radiusEarth: 0.38,
  composition: { volatileFraction: 0.02, density: 4.5 },
};

// deterministic 32-bit rolling hash over the exact float32 bit patterns of the whole craterField.
function hashField(cf) {
  const bytes = new Uint8Array(cf.buffer, cf.byteOffset, cf.byteLength);
  let h = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) { h ^= bytes[i]; h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16).padStart(8, '0');
}

// run the CURRENT writer at the fixed rig → { tuples (sorted), nStamp, coverage, footprint, fieldHash, exemplars }
function measure() {
  const mesh = buildIrregularSphere(MESH_N, MESH_SUBDIV);
  const carrier = makeSphereField(mesh);
  const N = carrier.verts.length;

  // population tuples — forEachCrater yields (centre, delta, tI, D_km); the depth edit touches none of these.
  const tuples = [];
  const sched = forEachCrater(COND, MACRO_SEED, N, (centre, _delta, tI, D_km) => tuples.push({ centre, D_km, tI }));
  tuples.sort((a, b) => (a.centre - b.centre) || (a.D_km - b.D_km) || (a.tI - b.tI));

  // craterField (production write, tanh-clamped) — the amplitude carrier the edit MOVES.
  writeBombardment(carrier, COND, { macroSeed: MACRO_SEED });
  const cf = carrier.craterField;
  const footprint = [];
  for (let i = 0; i < cf.length; i++) if (cf[i] !== 0) footprint.push(i);
  const exemplars = footprint.slice(0, 16).map((i) => ({ index: i, value: cf[i] }));

  return {
    nStamp: sched.nStamp,
    coverage: sched.coverage,
    tuples,
    footprint,
    fieldHash: hashField(cf),
    exemplars,
  };
}

export function capture() {
  const m = measure();
  const baseline = {
    meta: { mesh_n: MESH_N, mesh_subdiv: MESH_SUBDIV, macroSeed: MACRO_SEED, cond: COND,
      capturedAt: 'S1 head (pre depth-law edit)', note: 'AC-FENCE population-invariance reference; do NOT re-capture post-edit.' },
    nStamp: m.nStamp, coverage: m.coverage, tuples: m.tuples,
    footprint: m.footprint, craterFieldHash: m.fieldHash, craterFieldExemplars: m.exemplars,
  };
  writeFileSync(BASELINE, JSON.stringify(baseline, null, 0) + '\n');
  return baseline;
}

// verify() — returns { pass, checks[], detail }. Throws only on a missing baseline.
export function runVerify() {
  const base = JSON.parse(readFileSync(BASELINE, 'utf8'));
  const now = measure();
  const checks = [];
  const eq = (name, a, b) => { const ok = a === b; checks.push({ name, ok, a, b }); return ok; };

  // (1) POPULATION INVARIANT — count, coverage, and the full sorted tuple set are byte-identical.
  eq('nStamp invariant', now.nStamp, base.nStamp);
  eq('coverage invariant (float-exact)', now.coverage, base.coverage);
  const sameLen = eq('tuple count invariant', now.tuples.length, base.tuples.length);
  let tuplesIdentical = sameLen;
  if (sameLen) {
    for (let i = 0; i < now.tuples.length; i++) {
      const A = now.tuples[i], B = base.tuples[i];
      if (A.centre !== B.centre || A.D_km !== B.D_km || A.tI !== B.tI) { tuplesIdentical = false; break; }
    }
  }
  checks.push({ name: 'every {centre,D_km,tI} tuple byte-identical', ok: tuplesIdentical });

  // (2) FOOTPRINT INVARIANT — the set of touched (nonzero) nodes is unchanged (crater geometry is amplitude-free).
  let footprintIdentical = now.footprint.length === base.footprint.length;
  if (footprintIdentical) for (let i = 0; i < now.footprint.length; i++) if (now.footprint[i] !== base.footprint[i]) { footprintIdentical = false; break; }
  checks.push({ name: 'nonzero-node footprint invariant (geometry unchanged)', ok: footprintIdentical });

  // (3) AMPLITUDES DID CHANGE — the full-array hash differs AND ≥1 exemplar value moved at a fixed index.
  const hashChanged = now.fieldHash !== base.craterFieldHash;
  checks.push({ name: 'craterField hash CHANGED (amplitudes moved)', ok: hashChanged, a: now.fieldHash, b: base.craterFieldHash });
  const nowByIdx = new Map(now.exemplars.map((e) => [e.index, e.value]));
  let anyExemplarMoved = false, allExemplarsShallower = base.craterFieldExemplars.length > 0;
  for (const e of base.craterFieldExemplars) {
    const v = nowByIdx.get(e.index);
    if (v === undefined) { allExemplarsShallower = false; continue; }
    if (v !== e.value) anyExemplarMoved = true;
    // the new law is shallower ⇒ every stamped-floor exemplar shrinks in magnitude (|new| ≤ |old|).
    if (!(Math.abs(v) <= Math.abs(e.value) + 1e-9)) allExemplarsShallower = false;
  }
  checks.push({ name: '≥1 exemplar amplitude moved at a fixed index', ok: anyExemplarMoved });
  checks.push({ name: 'every exemplar shallower-or-equal (|new| ≤ |old|)', ok: allExemplarsShallower });

  const pass = checks.every((c) => c.ok);
  return { pass, checks, base, now };
}

// ── CLI ────────────────────────────────────────────────────────────────────────────────────────────
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  if (process.argv.includes('--capture')) {
    const b = capture();
    console.log(`=== Inc-3 fence baseline CAPTURED (pre-edit) → ${path.basename(BASELINE)} ===`);
    console.log(`  nStamp=${b.nStamp}  coverage=${b.coverage.toFixed(6)}  tuples=${b.tuples.length}  footprint=${b.footprint.length}  fieldHash=${b.craterFieldHash}`);
    console.log(`  exemplars[0..2]:`, b.craterFieldExemplars.slice(0, 3));
    process.exit(0);
  }
  const { pass, checks, base, now } = runVerify();
  console.log('=== Inc-3 fence population-invariance verify (post-edit run vs pre-edit baseline) ===');
  console.log(`  population: nStamp ${now.nStamp} (base ${base.nStamp})  coverage ${now.coverage.toFixed(6)} (base ${base.coverage.toFixed(6)})  tuples ${now.tuples.length}`);
  console.log(`  craterField: hash ${now.fieldHash} vs baseline ${base.craterFieldHash}`);
  console.log(`  exemplar[0]: now ${now.exemplars[0]?.value} vs baseline ${base.craterFieldExemplars[0]?.value}`);
  for (const c of checks) console.log(`  [${c.ok ? 'OK ' : 'FAIL'}] ${c.name}`);
  console.log(pass ? '\nALL PASS — population invariant, only craterField amplitudes changed.' : '\nFAIL — see above.');
  process.exit(pass ? 0 : 1);
}
