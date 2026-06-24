import { describe, it, expect } from 'vitest';
import { generateGrid, GRID, generateBody, SOL_ZONES } from './world-engine-l0-grid.js';
import { PlanetGenerator } from '../PlanetGenerator.js';
import { SeededRandom } from '../SeededRandom.js';
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

describe('WS1 AC4 — age + metallicity surfaced', () => {
  it('age and metallicity appear on planetData equal to the system values', () => {
    // Any grid row is generated under SOL_ZONES (ageGyr 4.5, metallicity 0.0),
    // and generate() surfaces the SAME system drivers it generated with.
    const body = generateBody(GRID[3]); // 'we-temperate-terra', a stable terrestrial
    expect(body.age).toBeCloseTo(SOL_ZONES.ageGyr); // 4.5 Gyr
    expect(body.metallicity).toBeCloseTo(SOL_ZONES.metallicity); // 0.0 dex
  });

  it('surfaced drivers track non-default system values', () => {
    // Prove the keys carry the SYSTEM value, not a hardcoded default: drive
    // the real generate() entry with a distinct age + metallicity and assert
    // the surfaced keys echo them.
    const [seed, orbitAU, forceType] = GRID[3];
    const zones = { ...SOL_ZONES, ageGyr: 8.2, metallicity: 0.45 };
    const body = PlanetGenerator.generate(new SeededRandom(seed), orbitAU, null, zones, forceType);
    expect(body.age).toBeCloseTo(8.2);
    expect(body.metallicity).toBeCloseTo(0.45);
  });
});

describe('WS1 AC3 — magneticField surfaced, single source', () => {
  // The aurora block (PlanetGenerator.js:~423-424) computes its field strength
  // as `composition.ironFraction * (isLocked ? 0.2 : 1.0)` where
  // `isLocked = tidalState.locked && tidalState.lockType === 'synchronous'`.
  // AC3 hoists that SINGLE computation to a `magneticField` const surfaced on
  // planetData; the aurora block reads it instead of recomputing. The test
  // mirrors the aurora block's EXACT lock check + formula (NOT bare
  // `tidalState.locked`) so it validates byte-identical behavior.
  const expectedField = (body) => {
    const isLocked = body.tidalState.locked && body.tidalState.lockType === 'synchronous';
    return body.composition.ironFraction * (isLocked ? 0.2 : 1.0);
  };

  it('magneticField is present and equals ironFraction*(isLocked?0.2:1.0)', () => {
    const body = generateBody(GRID[3]); // a stable terrestrial
    expect(body.magneticField).toBeCloseTo(expectedField(body));
  });

  it('magneticField equals the aurora-block field expression for every grid body', () => {
    // Strongest single-source check: across hot/locked/temperate/giant/cold
    // bodies, the surfaced value always matches the aurora block's expression.
    for (const body of generateGrid()) {
      expect(body.magneticField, `magneticField mismatch for ${body.type}`)
        .toBeCloseTo(expectedField(body));
    }
  });
});

describe('WS1 AC2 — eccentricity computed', () => {
  // Eccentricity is COMPUTED (orbits are circular by construction; circularize()
  // was dead). generate() seeds a deterministic initial eccentricity from a
  // DEDICATED sub-rng (derived from the body's stable identity), then damps it
  // via circularize(e0, ageGyr, orbitAU, massParentSolar). The dedicated sub-rng
  // guarantees ZERO draws from the shared planet rng, so the additive gate (AC6)
  // stays byte-identical regardless of how the system threads its rng.
  it('eccentricity is present, in [0,1), and deterministic', () => {
    const a = generateBody(GRID[3]); // a stable terrestrial
    const b = generateBody(GRID[3]); // regenerate same body
    expect(a.eccentricity).toBeGreaterThanOrEqual(0);
    expect(a.eccentricity).toBeLessThan(1);
    expect(a.eccentricity).toBe(b.eccentricity); // deterministic across generations
  });

  it('every grid body has eccentricity in [0,1)', () => {
    for (const body of generateGrid()) {
      expect(body.eccentricity, `eccentricity out of range for ${body.type}`)
        .toBeGreaterThanOrEqual(0);
      expect(body.eccentricity, `eccentricity out of range for ${body.type}`)
        .toBeLessThan(1);
    }
  });

  it('close-in bodies circularize lower than distant ones (same seed family)', () => {
    // Same seed + same zones, differing only in orbit: circularization timescale
    // tau ∝ orbitAU^6.5, so a close-in body damps far more of its initial e than
    // a distant one. Using a fixed seed isolates the orbit→eccentricity effect.
    const close = PlanetGenerator.generate(new SeededRandom('ecc-fam'), 0.1, null, SOL_ZONES, 'rocky');
    const distant = PlanetGenerator.generate(new SeededRandom('ecc-fam'), 12.0, null, SOL_ZONES, 'rocky');
    expect(close.eccentricity).toBeLessThan(distant.eccentricity);
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
