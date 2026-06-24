import { describe, it, expect } from 'vitest';
import { generateGrid, GRID, generateBody, SOL_ZONES } from './world-engine-l0-grid.js';
import { generateMoonGrid, MOON_GRID } from './world-engine-l0-moon-grid.js';
import { PlanetGenerator } from '../PlanetGenerator.js';
import { MoonGenerator } from '../MoonGenerator.js';
import { SeededRandom } from '../SeededRandom.js';
import { tidalHeatingPlanet } from '../PhysicsEngine.js';
import { StarSystemGenerator } from '../StarSystemGenerator.js';
import baseline from './__fixtures__/l0-baseline.json';
import moonBaseline from './__fixtures__/l0-moon-baseline.json';

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
// HOW TO REGENERATE the frozen baseline — DANGER, read first:
//   Regenerate ONLY when an EXISTING baseline key's value is INTENTIONALLY
//   changed (WS1 never does this — WS1 is purely additive). Regenerating
//   re-bakes whatever generate() currently emits into the fixture, which
//   DESTROYS drift detection for those keys.
//
//   Adding a NEW key MUST NOT trigger a regen. The additive gate compares
//   only against BASELINE_KEYS (the keys frozen in the fixture); any new key
//   a WS1 task adds is simply absent from that list and is ignored by design.
//   So an additive change needs ZERO fixture churn — that's the whole point.
//
//   If (and only if) an existing key's value legitimately changes:
//     node src/generation/__tests__/__fixtures__/regen-l0-baseline.mjs
//   (see that script's header). The additive-gate test below must stay GREEN
//   through every WS1 task that only ADDS keys, with NO regen.
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
    // EXACT equality (AC4 is a pure pass-through of the system value — no float
    // arithmetic): the surfaced key must be the SAME number, not merely close.
    expect(body.age).toBe(SOL_ZONES.ageGyr); // 4.5 Gyr
    expect(body.metallicity).toBe(SOL_ZONES.metallicity); // 0.0 dex
  });

  it('surfaced drivers track non-default system values', () => {
    // Prove the keys carry the SYSTEM value, not a hardcoded default: drive
    // the real generate() entry with a distinct age + metallicity and assert
    // the surfaced keys echo them.
    const [seed, orbitAU, forceType] = GRID[3];
    const zones = { ...SOL_ZONES, ageGyr: 8.2, metallicity: 0.45 };
    const body = PlanetGenerator.generate(new SeededRandom(seed), orbitAU, null, zones, forceType);
    // EXACT equality (pure pass-through, no float arithmetic).
    expect(body.age).toBe(8.2);
    expect(body.metallicity).toBe(0.45);
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
    // EXACT equality: the surfaced value is the SINGLE canonical computation,
    // and expectedField() re-evaluates the byte-identical production expression,
    // so they must be exactly equal (not merely close).
    expect(body.magneticField).toBe(expectedField(body));
  });

  it('magneticField equals the aurora-block field expression for every grid body', () => {
    // Strongest single-source check: across hot/locked/temperate/giant/cold
    // bodies, the surfaced value always matches the aurora block's expression.
    for (const body of generateGrid()) {
      expect(body.magneticField, `magneticField mismatch for ${body.type}`)
        .toBe(expectedField(body));
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

  it('eccentricity is a function of (orbit, zone params) — NOT the planet rng seed', () => {
    // Documents the ACTUAL eccSeed behavior (keeps code + the adjacent comment
    // honest, ITEM D2): eccentricity is drawn from a dedicated sub-rng keyed on
    // `ecc:${orbitAU}:${metallicity}:${starMassSolar}:${starType}` — it carries
    // NO system seed and NO per-body planet rng. Consequences, asserted here:
    //
    //   (a) two bodies at the SAME orbit + SAME zones get the SAME eccentricity
    //       EVEN with different planet seeds AND different forced types (the
    //       eccSeed ignores both) — proving e is NOT a function of the seed.
    //   (b) changing the orbit (with zones held) CHANGES the eccentricity.
    const a = PlanetGenerator.generate(new SeededRandom('seed-A'), 3.0, null, SOL_ZONES, 'rocky');
    const b = PlanetGenerator.generate(new SeededRandom('seed-B'), 3.0, null, SOL_ZONES, 'ice');
    expect(a.eccentricity).toBe(b.eccentricity); // same orbit+zones → same e

    const moved = PlanetGenerator.generate(new SeededRandom('seed-A'), 4.0, null, SOL_ZONES, 'rocky');
    expect(moved.eccentricity).not.toBe(a.eccentricity); // different orbit → different e
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

  it('a GENERATED planet reports nonzero tidalHeating wired THROUGH generate()', () => {
    // PIN (regression-defect guard, added 2026-06-24): every other planet-side
    // tidalHeating check above is either a direct helper call (tidalHeatingPlanet)
    // or a ~0 case. If generate() were ever changed to emit a literal 0 for
    // tidalHeating, ALL of those would still pass — and tidalHeating is NOT a
    // baseline-gate key, so the AC6 additive gate would not catch it either.
    // This pins the nonzero value as it flows through the REAL generate() entry.
    //
    // The grid's close-in bodies (0.04-0.12 AU) circularize to e≈0 → th=0, so the
    // genuinely-heated slots are the moderately-distant ones that RETAIN
    // eccentricity. GRID[6] = 'we-outer-subnep' (2 AU, e≈0.28) is the largest.
    const SUBNEP_IDX = 6;
    const grid = generateGrid();
    const body = grid[SUBNEP_IDX];
    const [, orbitAU] = GRID[SUBNEP_IDX];

    // (1) it must actually be nonzero — the assertion that a literal-0 regression
    //     would FAIL (this is the RED-if-zeroed guard the bare helper test lacks).
    expect(body.type).toBe('sub-neptune'); // guard: the grid row hasn't drifted
    expect(body.tidalHeating, 'generated sub-neptune should retain real tidal heat')
      .toBeGreaterThan(0);

    // (2) value pin: the surfaced number must EQUAL the helper recomputed from
    //     the body's OWN eccentricity + star mass + radius + orbit (the exact
    //     production call). Exact equality — same deterministic computation path.
    const expected = tidalHeatingPlanet(
      body.eccentricity, SOL_ZONES.starMassSolar, body.radiusEarth, orbitAU,
    );
    expect(body.tidalHeating).toBe(expected);
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

describe('WS1 AC5 — resonancePartners survive the binary-stability cull', () => {
  // REGRESSION (correctness defect found 2026-06-24): detectResonances() runs
  // BEFORE the binary-stability cull (StarSystemGenerator.js: resonances ~:443,
  // cull ~:461) and returns innerIdx/outerIdx into the PRE-cull planets array.
  // The cull then filters + re-packs `planets`, shifting/removing indices. The
  // systemContext post-pass reused those PRE-cull indices against the FINAL
  // (post-cull) array. The existence guard `planets[r.outerIdx]` only catches
  // OUT-OF-RANGE indices, never a wrong-but-present one — so in a binary +
  // resonant + culled system, resonancePartners attached the WRONG partner /
  // wrong ratio, and a pair whose endpoint was culled (now out of range) was
  // silently dropped instead of resolved.
  //
  // Trigger seed discovered by scanning the real generator (scan-{0..5000}):
  //   'scan-2606' — binary (F companion), resonant chain, 4 final planets after
  //   the cull removed inner planet(s) so the pre-cull chain indices (2-3 @5:3,
  //   3-4 @2:1) no longer line up with the final array.
  const SEED_CULLED_BINARY = 'scan-2606';

  it('points at the body whose ACTUAL period ratio matches the stated ratio (cull-safe)', () => {
    const sys = StarSystemGenerator.generate(SEED_CULLED_BINARY);
    // Guard the fixture: this seed must still be the binary+resonant+culled case
    // that exercises the bug, else the test would pass vacuously.
    expect(sys.isBinary).toBe(true);
    expect(sys.resonanceChain && sys.resonanceChain.isResonant).toBe(true);
    // The pre-cull chain references an index >= the final planet count — proof a
    // chain member was culled (the exact precondition for the defect).
    const chainMaxIdx = sys.resonanceChain.resonances.reduce(
      (m, r) => Math.max(m, r.innerIdx, r.outerIdx), 0);
    expect(chainMaxIdx).toBeGreaterThanOrEqual(sys.planets.length);

    const planets = sys.planets;
    const ratioVal = (s) => { const [n, d] = s.split(':').map(Number); return n / d; };

    // CORRECTNESS INVARIANT: for every surfaced resonance partner, the partner
    // index must point at a body whose REAL period ratio (Kepler) with this body
    // equals the stated ratio (within snap tolerance). On the buggy code the
    // partner is wrong, so the period ratio won't match → this FAILS (RED).
    let checked = 0;
    planets.forEach((entry, idx) => {
      for (const rp of entry.planetData.systemContext.resonancePartners) {
        const partner = planets[rp.partnerIndex];
        expect(partner, `idx ${idx} partner ${rp.partnerIndex} missing`).toBeDefined();
        const a1 = entry.orbitRadiusAU;
        const a2 = partner.orbitRadiusAU;
        const periodRatio = Math.pow(Math.max(a1, a2) / Math.min(a1, a2), 1.5);
        expect(periodRatio, `idx ${idx}->${rp.partnerIndex} ratio ${rp.ratio} but actual period ratio ${periodRatio.toFixed(4)}`)
          .toBeCloseTo(ratioVal(rp.ratio), 2);
        checked++;
      }
    });
    // The surviving chain must still expose real partners (not all dropped).
    expect(checked).toBeGreaterThan(0);
  });

  it('reciprocity holds: if A lists B then B lists A with the same ratio', () => {
    const sys = StarSystemGenerator.generate(SEED_CULLED_BINARY);
    const planets = sys.planets;
    planets.forEach((entry, idx) => {
      for (const rp of entry.planetData.systemContext.resonancePartners) {
        const back = planets[rp.partnerIndex].planetData.systemContext.resonancePartners;
        const reciprocal = back.find((b) => b.partnerIndex === idx && b.ratio === rp.ratio);
        expect(reciprocal, `idx ${idx}<->${rp.partnerIndex} ratio ${rp.ratio} not reciprocated`).toBeDefined();
      }
    });
  });

  it('resolves the exact post-cull partner set for scan-2606', () => {
    // Hand-derived from the FINAL array's period ratios:
    //   final idx1<->idx2 = 5:3 (1.6667), final idx2<->idx3 = 2:1 (2.0000).
    const sys = StarSystemGenerator.generate(SEED_CULLED_BINARY);
    const expected = [
      [],
      [{ partnerIndex: 2, ratio: '5:3' }],
      [{ partnerIndex: 1, ratio: '5:3' }, { partnerIndex: 3, ratio: '2:1' }],
      [{ partnerIndex: 2, ratio: '2:1' }],
    ];
    sys.planets.forEach((entry, idx) => {
      expect(entry.planetData.systemContext.resonancePartners).toEqual(expected[idx]);
    });
  });
});

describe('WS1 L0 plumbing — MOON additive gate (forward regression)', () => {
  // The planet gate (l0-baseline.json) is planet-only. WS1 ALSO touched the
  // MoonGenerator path (it now surfaces a real `tidalHeating`). That diff is
  // already proven additive by code-reading — MoonGenerator._computeTidalHeating
  // uses a DEDICATED sub-rng and makes ZERO draws on the moon `rng`. This gate
  // is FORWARD protection: it freezes the CURRENT moon output (a fixed parent +
  // 5 moon seeds) so a later workstream (WS2+) cannot silently perturb moons.
  // It mirrors the planet gate's structure (compare PRE-EXISTING keys only; the
  // new additive `tidalHeating` is absent from MOON_BASELINE_KEYS and ignored).
  const MOON_BASELINE_KEYS = Object.keys(moonBaseline[0]).filter((k) => k !== 'tidalHeating');

  it('moon baseline fixture matches the moon-grid length', () => {
    expect(moonBaseline).toHaveLength(generateMoonGrid().length);
    expect(moonBaseline).toHaveLength(MOON_GRID.length);
  });

  it('the gate compares pre-existing moon keys, excluding the additive tidalHeating', () => {
    // Guards the gate itself: tidalHeating must be the ONLY new key (it must be
    // present on the fixture but excluded from the byte-identical comparison).
    expect(Object.keys(moonBaseline[0])).toContain('tidalHeating');
    expect(MOON_BASELINE_KEYS).not.toContain('tidalHeating');
    // A non-trivial set of frozen keys (radiusEarth, type, orbit*, colors, …).
    expect(MOON_BASELINE_KEYS.length).toBeGreaterThanOrEqual(10);
  });

  it('pre-existing moon keys are byte-identical to the frozen baseline', () => {
    const grid = generateMoonGrid();
    grid.forEach((moon, i) => {
      for (const k of MOON_BASELINE_KEYS) {
        expect(moon[k], `moon[${i}].${k} drifted from frozen moon baseline`)
          .toEqual(moonBaseline[i][k]);
      }
    });
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

describe('WS1 — closeout', () => {
  // End-to-end proof that WS1's six additive outputs are all present AND the
  // additive gate held the whole way: the 23 baseline keys are still
  // byte-identical to the frozen fixture.
  //
  // The six new keys split across TWO production paths, so they are asserted
  // on TWO surfaces (NOT one):
  //   • FIVE in-generate() keys — eccentricity, tidalHeating, magneticField,
  //     age, metallicity — are added inside PlanetGenerator.generate(), so they
  //     appear on every generateGrid() body (the harness calls generate()).
  //   • systemContext is added by a POST-PASS in StarSystemGenerator AFTER the
  //     system graph exists. generateGrid() calls generate() directly and so
  //     intentionally has NO systemContext. It is therefore asserted on a body
  //     from a REAL StarSystemGenerator system (the resonant seed Task 6 uses).
  const IN_GENERATE_KEYS = [
    'eccentricity',
    'tidalHeating',
    'magneticField',
    'age',
    'metallicity',
  ];
  const SEED_RESONANT = 'rscan-7'; // same single/resonant system Task 6 used

  it('the five in-generate keys are present + finite on every grid body, and all 23 baseline keys are byte-identical', () => {
    generateGrid().forEach((body, i) => {
      // (1) the five additive in-generate keys are present and sane.
      for (const k of IN_GENERATE_KEYS) {
        expect(body[k], `body[${i}].${k} missing`).toBeDefined();
        expect(Number.isFinite(body[k]), `body[${i}].${k} not finite`).toBe(true);
      }
      // (2) the additive gate, restated end-to-end: every frozen baseline key
      //     is still exactly equal to the fixture (additivity proven).
      for (const k of BASELINE_KEYS) {
        expect(body[k], `body[${i}].${k} drifted from frozen baseline`)
          .toEqual(baseline[i][k]);
      }
    });
  });

  it('systemContext is present + well-formed on bodies from a real StarSystemGenerator system', () => {
    // systemContext is NOT on generateGrid() bodies by design (post-pass lives
    // in StarSystemGenerator). Prove it exists + is well-formed on real bodies.
    const sys = StarSystemGenerator.generate(SEED_RESONANT);
    expect(sys.planets.length).toBeGreaterThanOrEqual(3);

    for (const entry of sys.planets) {
      const ctx = entry.planetData.systemContext;
      expect(ctx, 'systemContext missing on a system body').toBeDefined();
      // Flat, serialization-safe shape: arrays of primitive summaries + a
      // nullable companionClass (the four fields the post-pass writes).
      expect(Array.isArray(ctx.siblings)).toBe(true);
      expect(Array.isArray(ctx.moons)).toBe(true);
      expect(Array.isArray(ctx.resonancePartners)).toBe(true);
      expect(
        ctx.companionClass === null || typeof ctx.companionClass === 'string',
      ).toBe(true);
      // siblings = every OTHER planet, summarized to primitives.
      expect(ctx.siblings.length).toBe(sys.planets.length - 1);
    }
  });
});
