// Regenerate the frozen WS1 L0 plumbing baseline fixture.
//
// Run ONLY when generate() output is INTENTIONALLY changed (e.g. a WS1 task
// adds a new ADDITIVE key) and the additive-gate test in
// world-engine-l0-plumbing.test.js should bless the new shape:
//
//   node src/generation/__tests__/__fixtures__/regen-l0-baseline.mjs
//
// It reuses the SAME generateGrid() harness the test file exports, so the
// frozen fixture and the test always agree on the deterministic grid. After
// regenerating, eyeball `git diff` on l0-baseline.json: only the keys you
// meant to add should be new, and NO existing key should have changed value.
// If an existing key drifted, that is a regression — do NOT commit the regen.

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { generateGrid } from '../world-engine-l0-grid.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.join(__dirname, 'l0-baseline.json');

const grid = generateGrid();
writeFileSync(outPath, JSON.stringify(grid, null, 2) + '\n');
console.log(`Wrote frozen baseline: ${grid.length} bodies → ${outPath}`);
