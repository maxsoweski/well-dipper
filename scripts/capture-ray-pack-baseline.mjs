// scripts/capture-ray-pack-baseline.mjs — every pack's RESOLVED drivers + the two crater-block packs'
// per-body resolve TIME, captured at the parent commit before any src edit
// (workstream wire-ejecta-rays-lab-into-game, AC-3 and AC-6).
//
//   node --import ./scripts/node-alias-motion-test-kit.mjs scripts/capture-ray-pack-baseline.mjs [commit] \
//     > tests/fixtures/ray-pack-drivers-baseline.json
//
// ⛔ WHY THIS IS A NEW FIXTURE AND NOT A RE-CAPTURE OF `tests/fixtures/pack-drivers-baseline.json`.
// That file is a SHIPPED workstream's frozen artifact: `tests/driver-pack-stormdeck.test.js:149`
// pins `capturedFrom === '520f2c0'` and its :162 arm asserts that `stormDeck` is the one pack name
// ABSENT from it on every gas body. Re-capturing it at the parent would move both of those, i.e. it
// would silently rewrite a shipped suite's expectation while this workstream claims "nothing else
// moves". So the parent baseline this workstream compares against is its OWN file, captured with
// stormDeck included — a strictly wider compare than the one it replaces, and the storm suite is
// left byte-identical. Recorded as a deviation on the contract.
//
// ⚠ TIMING IS CAPTURED IN THE SAME RUN AS THE VALUES, per AC-6, and the two sides use the SAME
// harness module (`tests/fixtures/ray-pack-corpus.mjs`) so a harness difference cannot land inside
// the +10 % gate.
//
// ⛔⛔ AND THE RUNNER IS PART OF THAT HARNESS — MEASURED, NOT ASSUMED. The identical module on the
// identical commit reads 0.00414 ms/body under bare node and 0.00646 ms under the test runner
// (`rockySurfacePack`, 156 bodies), a 56 % gap belonging entirely to how the two evaluate the module
// graph. AC-6's HEAD arm runs INSIDE vitest, so a node-captured parent would have failed a +10 %
// gate on the runner alone. The fixture therefore carries BOTH: `timingsBareNode` is this script's
// own numbers, and `timings` is the parent measured UNDER VITEST in a clean worktree —
//
//   git worktree add --detach /tmp/wd-parent dc03fc6 && ln -s "$PWD/node_modules" /tmp/wd-parent/node_modules
//   cp tests/fixtures/ray-pack-corpus.mjs /tmp/wd-parent/tests/fixtures/
//   # /tmp/wd-parent/tests/zz-parent-timing.test.js: one `it` that calls timeBothPacks(corpus())
//   # and writes the result to $WD_TIMING_OUT
//   WD_TIMING_OUT=… npx vitest run --root /tmp/wd-parent /tmp/wd-parent/tests/zz-parent-timing.test.js
//
// — repeated 4 times, folded into the fixture as the ELEMENT-WISE MINIMUM, which is both the honest
// reading of the work and the STRICTEST bar for HEAD. ⛔ Never `cd` into a worktree you then remove.
import { execFileSync } from 'node:child_process';
import { corpus, resolvedPacks, presetRows, timeBothPacks, MESH, MESH_N, TIMING } from '../tests/fixtures/ray-pack-corpus.mjs';
import { labPackCtx } from '../src/objects/Planet.js';

const commit = process.argv[2] || 'HEAD';
const sha = execFileSync('git', ['rev-parse', '--short', commit], { encoding: 'utf8' }).trim();

const CORPUS = corpus();

// ⚠ THE MESH-BEARING ctx, ALWAYS. Pack #1's bakes read `ctx.mesh`, and a null mesh silently empties
// `attributes` — a fixture captured without it would compare an empty set and report zero diffs.
const bodies = {};
for (const b of CORPUS) bodies[b.id] = resolvedPacks(b.cond, labPackCtx(b.d, b.cond, MESH));

const presets = {};
for (const row of presetRows()) presets[row.name] = resolvedPacks(row.cond, row.ctx);

const timings = timeBothPacks(CORPUS);

process.stdout.write(JSON.stringify({
  capturedFrom: sha,
  capturedAt: new Date().toISOString().slice(0, 10),
  meshN: MESH_N,
  timingMethod: { ...TIMING, note: 'per-body ms = min over passes of (mean over reps); mean/p95 taken over the 156 per-body values' },
  timings,
  bodyClasses: Object.fromEntries(CORPUS.map((b) => [b.id, b.cls])),
  bodies,
  presets,
}, null, 1));
