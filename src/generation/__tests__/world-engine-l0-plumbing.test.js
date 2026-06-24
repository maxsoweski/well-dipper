import { describe, it, expect } from 'vitest';
import { generateGrid, GRID } from './world-engine-l0-grid.js';
import baseline from './__fixtures__/l0-baseline.json';

// ════════════════════════════════════════════════════════════════════════
// World-Engine WS1 — L0 plumbing regression harness (AC6 foundation)
//
// WS1 makes the L0 body generator surface real physics drivers as PURELY
// ADDITIVE outputs. This file is the FOUNDATION: a deterministic generation
// harness + a frozen baseline of the CURRENT generate() output, plus an
// "additive-gate" regression test, so every later WS1 task can prove it
// changed NOTHING but its own new key.
//
// The deterministic harness (generateGrid / GRID / SOL_ZONES) lives in the
// sibling ./world-engine-l0-grid.js so the fixture-regen script can reuse it
// WITHOUT importing this file's frozen-baseline JSON (which does not exist on
// the first capture). See that harness for the determinism rationale.
//
// HOW TO REGENERATE the frozen baseline (only when generate() output is
// INTENTIONALLY changed — e.g. a WS1 task adds a new key):
//   node src/generation/__tests__/__fixtures__/regen-l0-baseline.mjs
// (see that script's header). The additive-gate test below must stay GREEN
// through every WS1 task that only ADDS keys.
// ════════════════════════════════════════════════════════════════════════

// The keys present on generate() output TODAY (PlanetGenerator.js:660-688).
// Derived programmatically from the frozen fixture rather than hardcoded, so
// the gate compares against whatever was actually frozen.
const BASELINE_KEYS = Object.keys(baseline[0]);

describe('WS1 L0 plumbing — determinism', () => {
  it('generateGrid is deterministic for fixed seeds', () => {
    expect(generateGrid()).toEqual(generateGrid());
  });

  it('produces the expected number of bodies spanning all zones', () => {
    const grid = generateGrid();
    expect(grid).toHaveLength(GRID.length);
    expect(grid.length).toBeGreaterThanOrEqual(8);
    // spans hot → cold
    const temps = grid.map((b) => b.T_eq);
    expect(Math.max(...temps)).toBeGreaterThan(700); // a scorching world
    expect(Math.min(...temps)).toBeLessThan(120); // a frozen outer world
    // includes a giant and at least one tidally-locked body
    expect(grid.some((b) => b.type === 'gas-giant')).toBe(true);
    expect(grid.some((b) => b.tidalState.locked)).toBe(true);
  });
});

describe('WS1 L0 plumbing — additive gate (AC6)', () => {
  it('baseline fixture matches the grid length', () => {
    expect(baseline).toHaveLength(generateGrid().length);
  });

  it('records the 23 existing generate() keys in the frozen baseline', () => {
    // Guards the gate itself: if generate() ever drops a key, the regen would
    // shrink this list and silently weaken the regression. 23 keys today.
    expect(BASELINE_KEYS).toHaveLength(23);
  });

  it('existing generate() keys are byte-identical to the frozen baseline', () => {
    const grid = generateGrid();
    grid.forEach((body, i) => {
      for (const k of BASELINE_KEYS) {
        // Existing keys must be unchanged; any NEW key a WS1 task adds is
        // simply not in BASELINE_KEYS, so it is ignored here (additive).
        expect(body[k], `body[${i}].${k} drifted from frozen baseline`)
          .toEqual(baseline[i][k]);
      }
    });
  });
});
