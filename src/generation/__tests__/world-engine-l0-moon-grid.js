import { MoonGenerator } from '../MoonGenerator.js';
import { SeededRandom } from '../SeededRandom.js';
import { generateBody, GRID, SOL_ZONES } from './world-engine-l0-grid.js';

// ════════════════════════════════════════════════════════════════════════
// World-Engine WS1 — deterministic L0 MOON generation harness
//
// Sibling to world-engine-l0-grid.js (the PLANET harness). The planet gate
// (l0-baseline.json) is planet-only; WS1 also touched the MoonGenerator path
// (it now surfaces a real `tidalHeating`). WS1's moon diff is already proven
// additive by code-reading — MoonGenerator._computeTidalHeating draws from a
// DEDICATED sub-rng (MoonGenerator.js:257-263) and makes ZERO draws on the
// passed-in moon `rng`, so every PRE-EXISTING moon field is unchanged.
//
// This harness + its frozen fixture (__fixtures__/l0-moon-baseline.json) are
// FORWARD regression protection: they freeze the CURRENT moon output so a
// later workstream (WS2+) cannot silently perturb moons. The gate test asserts
// every PRE-EXISTING moon key (radiusEarth, type, orbit*, colors, …) is
// byte-identical to the fixture; the new additive `tidalHeating` key is simply
// absent from that comparison set and ignored (mirrors the planet gate).
//
// Like the planet harness, this is a non-test module (no JSON import) so the
// regen script (__fixtures__/regen-l0-moon-baseline.mjs) can reuse generateMoonGrid()
// WITHOUT the chicken-and-egg of importing a fixture that does not yet exist.
//
// Determinism: MoonGenerator.generate(rng, parent, idx, total, zone, zones, parentOrbitAU)
// is a pure function of its inputs. ⭐ The 7th param arrived in C3 (`0b329da`): the parent's
// REAL orbit in AU, default null, threaded for 8a's T_eq and 8b's hardcoded-1-AU fix, and
// read by NOTHING yet. Parent = GRID[7], byte-frozen by the planet gate, so this grid repeats.
// ════════════════════════════════════════════════════════════════════════

// Fixed parent: the gas-giant grid body. Gas giants can host the full moon
// variety (volcanic Io-slot, ice, rocky, planet-class), so it exercises the
// widest moon code path. Frozen by the planet gate, so it never drifts.
export function moonParent() {
  return generateBody(GRID[7]); // 'we-giant', gas-giant
}

// Each row: [seed, moonIndex, totalMoons, parentZone]. Seeds + indices are
// fixed so the grid spans the close (volcanic) slot through outer ice/rocky
// slots across a few zones. Picked to land on REGULAR moons (a flat shape) so
// the byte-identical gate is straightforward.
export const MOON_GRID = [
  ['wm-0', 0, 5, 'outer'],
  ['wm-1', 1, 5, 'outer'],
  ['wm-2', 2, 5, 'outer'],
  ['wm-3', 3, 5, 'hz'],
  ['wm-4', 4, 5, 'transition'],
];

/**
 * Generate a single moon deterministically from one grid row + the fixed parent.
 * Fresh SeededRandom per call so output depends only on inputs.
 */
export function generateMoon([seed, moonIndex, totalMoons, parentZone], parent = moonParent()) {
  return MoonGenerator.generate(
    new SeededRandom(seed), parent, moonIndex, totalMoons, parentZone, SOL_ZONES,
  );
}

/**
 * Deterministically produce the full moon grid. Same seeds → same moons.
 */
export function generateMoonGrid() {
  const parent = moonParent();
  return MOON_GRID.map((row) => generateMoon(row, parent));
}
