// scripts/capture-term-pack-baseline.mjs — every pack's RESOLVED drivers over the corpus and the
// presets, captured at the PARENT commit before the gate policy learns a ruling
// (workstream wire-terminator-gradient-lab-into-game, AC-1 and AC-2).
//
//   node --import ./scripts/node-alias-motion-test-kit.mjs scripts/capture-term-pack-baseline.mjs [commit] \
//     > tests/fixtures/term-pack-drivers-baseline.json
//
// ⭐ IT IS BOTH HALVES OF THE MEASUREMENT IN ONE FILE, and that is the point. At the parent
// `gatesFor(entry)` IS `GATE_POLICY_ALL_ON`, so this snapshot is simultaneously
//   · AC-2's "nothing else moves" reference — every driver of every claiming pack, and
//   · AC-1's CHANGE-SET control — the `uTermStrength` the packs answered before the ruling reached them.
// After the build, HEAD resolves the same corpus TWICE: under an explicit ALL_ON, which must
// deep-equal this file entirely, and under the new default RULED, which must differ from it on
// `uTermStrength` and on NOTHING ELSE. One fixture decides both, and neither can pass by the other's
// silence.
//
// ⛔ WHY THIS IS A NEW FIXTURE AND NOT A RE-CAPTURE of `tests/fixtures/pack-drivers-baseline.json` or
// of `tests/fixtures/ray-pack-drivers-baseline.json`. Both are frozen artifacts of SHIPPED
// workstreams and both are cross-commit controls: the storm suite pins `capturedFrom === '520f2c0'`
// (tests/driver-pack-stormdeck.test.js:149) and the ray suite pins `'dc03fc6'`
// (tests/driver-pack-ejectarays.test.js:460). Re-capturing either at HEAD would compare HEAD to
// HEAD — it would turn two live controls into tautologies, and the diff would carry F3's three ray
// names as well as this workstream's one, so the "the diff is EXACTLY uTermStrength" claim could not
// be made against them anyway. The same reasoning F3 wrote at capture-ray-pack-baseline.mjs:8.
// Recorded as a deviation on the contract.
//
// ⚠ THE HARNESS IS SHARED WITH F3 (`tests/fixtures/ray-pack-corpus.mjs`) rather than re-transcribed,
// for the reason that module's own header gives: a second copy of the corpus builder or of the
// resolve loop would put a harness difference inside a number the contract reads as a code
// difference. ⛔ `resolvedPacks` there calls `gatesFor(entry)` with NO policy argument — which is
// exactly what this capture wants at the parent, and exactly what must NOT be used for HEAD's ALL_ON
// arm once the default moves. HEAD's arms pass their policy explicitly.
import { execFileSync } from 'node:child_process';
import { corpus, resolvedPacks, presetRows, MESH, MESH_N } from '../tests/fixtures/ray-pack-corpus.mjs';
import { labPackCtx } from '../src/objects/Planet.js';

const commit = process.argv[2] || 'HEAD';
const sha = execFileSync('git', ['rev-parse', '--short', commit], { encoding: 'utf8' }).trim();

const CORPUS = corpus();
const bodies = {};
for (const b of CORPUS) bodies[b.id] = resolvedPacks(b.cond, labPackCtx(b.d, b.cond, MESH));
const presets = {};
for (const row of presetRows()) presets[row.name] = resolvedPacks(row.cond, row.ctx);

// ── The change set, indexed so it can be read without walking the whole snapshot ─────────────────
// ⚠ RECORDED AS A SET OF BODIES WITH THEIR OWN VALUES, never as a magnitude. 0.15 is the CEILING of
// `columnFraction × TERM_STRENGTH` (terminatorOptics.js:58, :95), not the population's constant —
// a thin-column world resolves lower, and an assertion written as "0.15 everywhere" would be a
// claim about a number the law does not make.
const TERM_NAME = 'uTermStrength';
const termStrength = {};
for (const [id, packs] of Object.entries(bodies)) {
  for (const [pack, r] of Object.entries(packs)) {
    if (TERM_NAME in r.drivers) termStrength[id] = { pack, value: r.drivers[TERM_NAME] };
  }
}
const termStrengthPresets = {};
for (const [name, packs] of Object.entries(presets)) {
  for (const [pack, r] of Object.entries(packs)) {
    if (TERM_NAME in r.drivers) termStrengthPresets[name] = { pack, value: r.drivers[TERM_NAME] };
  }
}
const nonZero = Object.entries(termStrength).filter(([, r]) => r.value > 0);
const nonZeroPresets = Object.entries(termStrengthPresets).filter(([, r]) => r.value > 0);

process.stdout.write(JSON.stringify({
  capturedFrom: sha,
  capturedAt: new Date().toISOString().slice(0, 10),
  gatePolicy: 'gatesFor(entry) with no policy argument — GATE_POLICY_ALL_ON at this commit',
  meshN: MESH_N,
  summary: {
    bodies: CORPUS.length,
    presets: Object.keys(presets).length,
    bodiesEmittingUTermStrength: Object.keys(termStrength).length,
    bodiesWithUTermStrengthAboveZero: nonZero.length,
    presetsWithUTermStrengthAboveZero: nonZeroPresets.length,
    distinctNonZeroValues: [...new Set(nonZero.map(([, r]) => r.value))].sort((a, b) => a - b),
  },
  changeSet: { bodies: nonZero.map(([id]) => id).sort(), presets: nonZeroPresets.map(([n]) => n).sort() },
  termStrength,
  termStrengthPresets,
  bodies,
  presets,
}, null, 1));
