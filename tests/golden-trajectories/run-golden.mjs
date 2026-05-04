#!/usr/bin/env node
// Golden-trajectory CLI for AC #15 of welldipper-fixed-timestep-
// migration-2026-05-03. Modes:
//   default (no args) — verify the scenario against the committed
//                       golden file. Exits 0 on PASS, 1 on FAIL.
//   --record           — re-bless: regenerate the golden file. Use only
//                       when the scenario itself is intentionally
//                       changed (then commit the new golden alongside
//                       the change). Existing file is overwritten.
//
// Designed for `npm run verify-golden`. Targets <30 wall-clock seconds
// per brief AC #15 verifiable; in practice runs in under 1 second.

import { recordGolden, verifyAgainstGolden } from '../../vendor/motion-test-kit/core/hash/golden-trajectory.js';
import { nodeFsWriter } from '../../vendor/motion-test-kit/adapters/node/fs-writer.js';
import { nodeFsReader } from '../../vendor/motion-test-kit/adapters/node/fs-reader.js';
import { runScenario, scenarioName } from './canonical-scenario.js';

const HERE = new URL('.', import.meta.url).pathname;
const GOLDEN_PATH = HERE + 'canonical-scenario.golden.json';
const TOLERANCE = 1e-6;

const isRecord = process.argv.includes('--record');

const t0 = performance.now();

if (isRecord) {
  const golden = await recordGolden({
    scenario: runScenario,
    scenarioName,
    outputPath: GOLDEN_PATH,
    writer: nodeFsWriter,
    tolerance: TOLERANCE,
  });
  const elapsed = performance.now() - t0;
  console.log(`[golden] re-blessed ${scenarioName}`);
  console.log(`  hash: ${golden.hashHex} (uint32 ${golden.hash})`);
  console.log(`  samples: ${golden.sampleCount}`);
  console.log(`  tolerance: ${golden.tolerance}`);
  console.log(`  output: ${GOLDEN_PATH}`);
  console.log(`  recorded in ${elapsed.toFixed(1)} ms`);
  process.exit(0);
}

const result = await verifyAgainstGolden({
  scenario: runScenario,
  goldenPath: GOLDEN_PATH,
  reader: nodeFsReader,
});
const elapsed = performance.now() - t0;

if (result.passed) {
  console.log(`[golden] PASS — ${scenarioName} matches golden ${result.golden.hashHex}`);
  console.log(`  samples: ${result.current.sampleCount} (golden: ${result.golden.sampleCount})`);
  console.log(`  verified in ${elapsed.toFixed(1)} ms`);
  process.exit(0);
}

// FAIL path — emit per-frame mismatch diagnostics per brief AC #15.
console.error(`[golden] FAIL — ${scenarioName} diverged from golden`);
console.error(`  golden hash:  ${result.golden.hashHex}`);
console.error(`  current hash: ${result.current.hashHex}`);
console.error(`  lengthMatch:  ${result.lengthMatch}`);
console.error(`    golden samples:  ${result.golden.sampleCount}`);
console.error(`    current samples: ${result.current.sampleCount}`);
console.error(`  firstMismatchFrame: ${result.firstMismatchFrame}`);
console.error(`  mismatchCount: ${result.mismatchCount}`);
if (result.firstMismatchFrame !== null && result.firstMismatchFrame >= 0) {
  const around = 3;
  const start = Math.max(0, result.firstMismatchFrame - around);
  const end = Math.min(result.current.perFrameHashes.length, result.firstMismatchFrame + around + 1);
  console.error('  per-frame neighborhood (frame: golden-hash | current-hash):');
  for (let i = start; i < end; i++) {
    const g = result.golden.perFrameHashes[i];
    const c = result.current.perFrameHashes[i];
    if (!g || !c) continue;
    const flag = g.hash !== c.hash ? '  ←' : '';
    console.error(`    ${String(c.frame).padStart(5)}: ${String(g.hash).padStart(11)} | ${String(c.hash).padStart(11)}${flag}`);
  }
}
console.error(`  verified in ${elapsed.toFixed(1)} ms`);
console.error('');
console.error('  If the divergence is intentional (the scenario itself was deliberately');
console.error('  changed), re-bless the golden via: node tests/golden-trajectories/run-golden.mjs --record');
console.error('  and commit the updated canonical-scenario.golden.json alongside the change.');
process.exit(1);
