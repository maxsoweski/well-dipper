import { describe, it, expect } from 'vitest';
import { generateGrid, GRID, generateBody, SOL_ZONES } from './world-engine-l0-grid.js';
import { PlanetGenerator } from '../PlanetGenerator.js';
import { MoonGenerator } from '../MoonGenerator.js';
import { SeededRandom } from '../SeededRandom.js';
import { tidalHeatingPlanet } from '../PhysicsEngine.js';
import { StarSystemGenerator } from '../StarSystemGenerator.js';
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

describe('WS1 AC1 — tidal heating is real (moons + planets)', () => {
  // The Io-normalized PhysicsEngine.tidalHeating() was DEAD in production
  // (called only in tests). AC1 wires it for moons (where it physically
  // belongs) and computes stellar tidal heating for planets via the new
  // tidalHeatingPlanet() helper (consistent unit-mapping → Io-moon scale).
  // tidalHeating is SURFACED ONLY — it is NOT fed into computeSurfaceHistory
  // (consumption is WS2's job), so the additive gate (AC6) stays byte-identical.

  // Helper to generate a gas-giant body to parent moons.
  const giantBody = () => generateBody(GRID[7]); // 'we-giant', gas-giant

  it('an Io-like generated moon reports significant tidal heating', () => {
    // Innermost moon (index 0) of a gas giant = the Io slot (close orbit,
    // huge parent mass). With a seeded modest eccentricity it gets strong
    // tidal flexing. Force a fresh seed so the moon generator picks the
    // close, innermost slot.
    const giant = giantBody();
    const moon = MoonGenerator.generate(
      new SeededRandom('io-like-moon'), giant, 0, 3, 'outer', SOL_ZONES,
    );
    expect(moon.tidalHeating).toBeGreaterThan(0.1);
  });

  it('every generated moon reports a finite tidalHeating >= 0', () => {
    const giant = giantBody();
    for (let i = 0; i < 5; i++) {
      const moon = MoonGenerator.generate(
        new SeededRandom(`moon-finite-${i}`), giant, i, 5, 'outer', SOL_ZONES,
      );
      expect(Number.isFinite(moon.tidalHeating), `moon ${i} not finite`).toBe(true);
      expect(moon.tidalHeating, `moon ${i} negative`).toBeGreaterThanOrEqual(0);
    }
  });

  it('a temperate, circularized planet reports ~0 tidal heating', () => {
    // we-temperate-venus is a temperate world (T_eq~304K) close enough that
    // its orbit circularizes (e -> 0), so its REAL computed tidal heating is
    // ~0. This is the honest "temperate planet -> ~0" case.
    const body = generateBody(GRID[5]); // 'we-temperate-venus', 0.7 AU
    expect(body.tidalHeating).toBeLessThan(0.01);
  });

  it('the planet tidal-heating helper returns >0 for forced close+eccentric params', () => {
    // Direct unit anchor: a close-in (0.05 AU), eccentric (e=0.2), Earth-sized
    // planet around a Sun-mass star MUST register nonzero stellar tidal heating.
    const th = tidalHeatingPlanet(0.2, 1.0, 1.0, 0.05);
    expect(th).toBeGreaterThan(0);
  });

  it('the planet tidal-heating helper maps Earth (e=0.017, 1 AU) to ~0', () => {
    // Earth's REAL low eccentricity at 1 AU -> ~0 (the model is honest about
    // temperate worlds). Asserts the unit-mapping normalization, independent
    // of any particular generated body's seeded eccentricity.
    const th = tidalHeatingPlanet(0.017, 1.0, 1.0, 1.0);
    expect(th).toBeLessThan(0.01);
  });

  it('every generated planet reports a finite tidalHeating >= 0', () => {
    for (const body of generateGrid()) {
      expect(Number.isFinite(body.tidalHeating), `${body.type} not finite`).toBe(true);
      expect(body.tidalHeating, `${body.type} negative`).toBeGreaterThanOrEqual(0);
    }
  });

  it('surfaceHistory is unchanged (tidalHeating is surfaced, not consumed)', () => {
    // Explicit intent assertion (the AC6 baseline already guards this): adding
    // tidalHeating must NOT alter computeSurfaceHistory output.
    generateGrid().forEach((body, i) => {
      expect(body.surfaceHistory).toEqual(baseline[i].surfaceHistory);
    });
  });
});

describe('WS1 AC5 — systemContext reachable + serialization-safe', () => {
  // systemContext is a FLAT, derived summary of a body's place in the system.
  // It CANNOT be built inside PlanetGenerator.generate() (each body is finalized
  // BEFORE the system graph — moons, resonances, companion — exists). It is
  // attached by a post-pass in StarSystemGenerator AFTER the graph is assembled.
  // Therefore systemContext is tested via a REAL StarSystemGenerator system, NOT
  // the harness grid (which calls generate() directly and intentionally has none).
  //
  // Seeds were discovered empirically against the real generator:
  //   SEED_RESONANT = single (companionClass null), resonant (chain 2-3, 3-4),
  //                   6 planets, has moons.
  //   SEED_BINARY   = binary (companion class F), resonant, 5 planets.
  const SEED_RESONANT = 'rscan-7';
  const SEED_BINARY = 'scan-7';

  it('a body can resolve siblings, its own moons, resonance partners, companion', () => {
    const sys = StarSystemGenerator.generate(SEED_RESONANT);
    expect(sys.planets.length).toBeGreaterThanOrEqual(3);

    const entry = sys.planets[1];
    const body = entry.planetData;

    // siblings = every OTHER planet, summarized to primitives.
    expect(Array.isArray(body.systemContext.siblings)).toBe(true);
    expect(body.systemContext.siblings.length).toBe(sys.planets.length - 1);
    for (const s of body.systemContext.siblings) {
      expect(typeof s.type).toBe('string');
      expect(typeof s.orbitAU).toBe('number');
    }

    // moons = THIS body's own moons (planets[i].moons), summarized.
    expect(Array.isArray(body.systemContext.moons)).toBe(true);
    expect(body.systemContext.moons.length).toBe(entry.moons.length);

    // companionClass is null for a single star.
    expect(body.systemContext.companionClass).toBeNull();
  });

  it('resonancePartners on a chain body match the system resonanceChain', () => {
    const sys = StarSystemGenerator.generate(SEED_RESONANT);
    expect(sys.resonanceChain).not.toBeNull();
    expect(sys.resonanceChain.isResonant).toBe(true);

    // Derive the expected partner set for each planet index straight from the
    // chain, then assert every body's systemContext.resonancePartners matches.
    const expectedFor = (idx) => {
      const partners = [];
      for (const r of sys.resonanceChain.resonances) {
        if (r.innerIdx === idx) partners.push({ partnerIndex: r.outerIdx, ratio: r.ratio });
        if (r.outerIdx === idx) partners.push({ partnerIndex: r.innerIdx, ratio: r.ratio });
      }
      return partners;
    };

    sys.planets.forEach((entry, idx) => {
      expect(entry.planetData.systemContext.resonancePartners).toEqual(expectedFor(idx));
    });

    // And at least one chain body actually has a partner (guards the assertion
    // above from passing vacuously on an all-empty set).
    const anyPartners = sys.planets.some(
      (p) => p.planetData.systemContext.resonancePartners.length > 0,
    );
    expect(anyPartners).toBe(true);
  });

  it('companionClass is the secondary star class in a binary system', () => {
    const sys = StarSystemGenerator.generate(SEED_BINARY);
    expect(sys.isBinary).toBe(true);
    expect(sys.star2).not.toBeNull();
    for (const entry of sys.planets) {
      expect(entry.planetData.systemContext.companionClass).toBe(sys.star2.type);
    }
  });

  it('the whole system still JSON-serializes (no circular ref introduced)', () => {
    // Pre-change, JSON.stringify(system) already succeeds (verified: no
    // pre-existing cycle). The flat systemContext must keep it that way — it
    // copies ONLY primitives, never a planet/system/parent reference.
    const sys = StarSystemGenerator.generate(SEED_RESONANT);
    expect(() => JSON.stringify(sys)).not.toThrow();
    // Belt-and-suspenders: the systemContext objects are themselves acyclic.
    for (const entry of sys.planets) {
      expect(() => JSON.stringify(entry.planetData.systemContext)).not.toThrow();
    }
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
