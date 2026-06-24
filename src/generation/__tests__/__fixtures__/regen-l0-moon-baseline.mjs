// Regenerate the frozen WS1 L0 MOON baseline fixture.
//
// DANGER — do NOT run this in CI. Run ONLY when MoonGenerator output is
// INTENTIONALLY changed (e.g. a future task adds a new ADDITIVE moon key) and
// the moon additive-gate test in world-engine-l0-plumbing.test.js should bless
// the new shape:
//
//   node src/generation/__tests__/__fixtures__/regen-l0-moon-baseline.mjs
//
// It reuses the SAME generateMoonGrid() harness the test file imports, so the
// frozen fixture and the test always agree on the deterministic moon grid.
// After regenerating, eyeball `git diff` on l0-moon-baseline.json: only the
// keys you meant to add should be new, and NO PRE-EXISTING key (radiusEarth,
// type, orbit*, colors, …) should have changed value. If a pre-existing key
// drifted, that is a moon regression — do NOT commit the regen.
//
// Mirrors regen-l0-baseline.mjs (the planet gate); same usage discipline.

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { generateMoonGrid } from '../world-engine-l0-moon-grid.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.join(__dirname, 'l0-moon-baseline.json');

const grid = generateMoonGrid();
writeFileSync(outPath, JSON.stringify(grid, null, 2) + '\n');
console.log(`Wrote frozen moon baseline: ${grid.length} moons → ${outPath}`);
