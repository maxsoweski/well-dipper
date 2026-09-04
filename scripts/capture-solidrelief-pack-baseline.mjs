// scripts/capture-solidrelief-pack-baseline.mjs — every pack's RESOLVED drivers over the corpus and
// the 18 driver presets, captured at the PARENT commit before any src edit
// (workstream solid-relief-deck, AC-4 "nothing else moves").
//
//   node --import ./scripts/node-alias-motion-test-kit.mjs scripts/capture-solidrelief-pack-baseline.mjs [commit] \
//     > tests/fixtures/solidrelief-pack-drivers-baseline.json
//
// ⛔ WHY ANOTHER FIXTURE RATHER THAN A RE-CAPTURE. `tests/fixtures/pack-drivers-baseline.json` and
// `tests/fixtures/ray-pack-drivers-baseline.json` and `tests/fixtures/term-pack-drivers-baseline.json`
// are each a SHIPPED workstream's frozen artifact, pinned by `capturedFrom` in its own suite
// (tests/driver-pack-stormdeck.test.js:149 is the one that bites). Re-capturing any of them would
// silently rewrite a shipped suite's expectation inside a workstream whose whole claim is that
// nothing else moves. This workstream compares against its OWN parent capture; the three shipped
// fixtures are left byte-identical.
//
// ⛔ THE HARNESS IS IMPORTED, NEVER COPIED — `tests/fixtures/ray-pack-corpus.mjs` already pins the
// corpus, the mesh, the ctx shape and (critically) GATE_POLICY_ALL_ON, whose reason is written at its
// own call site: comparing HEAD against a fixture under a DIFFERENT gate policy would read a policy
// change as a code change. Using the same module on both sides is what makes the compare a compare
// of CODE. That file is a shipped workstream's harness and is not edited here.
import { execFileSync } from 'node:child_process';
import { corpus, resolvedPacks, presetRows, MESH, MESH_N } from '../tests/fixtures/ray-pack-corpus.mjs';
import { labPackCtx } from '../src/objects/Planet.js';

const commit = process.argv[2] || 'HEAD';
const sha = execFileSync('git', ['rev-parse', '--short', commit], { encoding: 'utf8' }).trim();

const CORPUS = corpus();

// ⚠ THE MESH-BEARING ctx, ALWAYS — pack #1's bakes read `ctx.mesh` and a null mesh silently empties
// the attribute maps, which would make this baseline agree with a broken HEAD.
const bodies = {};
for (const b of CORPUS) {
  const ctx = labPackCtx(b.d, b.cond, MESH);
  bodies[b.id] = { kind: b.kind, cls: b.cls, packs: resolvedPacks(b.cond, ctx) };
}

const presets = {};
for (const { name, cond, ctx } of presetRows()) presets[name] = resolvedPacks(cond, ctx);

// The claimed-name universe, recorded whole: AC-4's disjointness arm asserts the ELEVEN new names are
// absent from every pack here, and "measured absent at the parent" is a claim only a parent capture
// can carry. Same shape as the ray capture's ABSENT_NAMES block.
const NEW_NAMES = ['uMountainAmp', 'uChasmaDepth', 'uScarpStrength', 'uPlateauStrength',
  'uTesseraStrength', 'uLavaCoverage', 'uSubStrength', 'uKarstDensity', 'uDuneDensity',
  'uDustDepth', 'uMassWastDensity'];
const everyName = new Set();
for (const row of [...Object.values(bodies).map((b) => b.packs), ...Object.values(presets)]) {
  for (const p of Object.values(row)) for (const n of Object.keys(p.drivers)) everyName.add(n);
}
const collisions = NEW_NAMES.filter((n) => everyName.has(n));

process.stdout.write(JSON.stringify({
  capturedFrom: sha,
  capturedAt: new Date().toISOString(),
  note: 'solid-relief-deck AC-4 parent baseline. GATE_POLICY_ALL_ON, pinned by the imported harness.',
  meshN: MESH_N,
  corpusSize: CORPUS.length,
  presetCount: Object.keys(presets).length,
  packNamesEverSeen: [...everyName].sort(),
  newNamesAlreadyWritten: collisions,
  bodies,
  presets,
}, null, 1));
