import { describe, it, expect } from 'vitest';
import { ExoticOverlay } from '../ExoticOverlay.js';
import { PlanetGenerator } from '../PlanetGenerator.js';
import { MoonGenerator } from '../MoonGenerator.js';
import { SeededRandom } from '../SeededRandom.js';

/**
 * WU7-1: when ExoticOverlay swaps a planet's type, the new type has a
 * different radius, so retained moons must be rescaled to the new parent
 * (otherwise they clip inside it or fling off), and the swapped planet's
 * moonCount must match the moons that actually survive the swap.
 */
describe('ExoticOverlay._swapPlanetType — moon rescale (WU7-1)', () => {
  // Build a real terrestrial planet with one real moon (no mocks).
  function makeEntryWithMoon() {
    const rng = new SeededRandom('wu7-1-seed');
    const planetData = PlanetGenerator.generate(rng, 1.0, null, null, 'terrestrial');
    const moon = MoonGenerator.generate(rng, planetData, 0, 1);
    return { planetData, orbitRadiusAU: 1.0, moons: [moon] };
  }

  it('scales moon orbit/size by the parent radius ratio after a type swap', () => {
    const entry = makeEntryWithMoon();
    const oldRadiusEarth = entry.planetData.radiusEarth;
    const oldRadiusMap = entry.planetData.radius;
    const m = entry.moons[0];
    const before = {
      radiusEarth: m.radiusEarth,
      radiusScene: m.radiusScene,
      orbitRadiusEarth: m.orbitRadiusEarth,
      orbitRadiusScene: m.orbitRadiusScene,
      radius: m.radius,
      orbitRadius: m.orbitRadius,
    };

    ExoticOverlay._swapPlanetType(entry, 'crystal', new SeededRandom('swap-rng'));

    const newData = entry.planetData;
    const kEarth = newData.radiusEarth / oldRadiusEarth;
    const kMap = newData.radius / oldRadiusMap;

    // Sanity: the swap must actually change the parent radius, or this test
    // proves nothing. If a future seed makes k===1, pick another seed.
    expect(kEarth).not.toBe(1);

    const moon = entry.moons[0];
    expect(moon.radiusEarth).toBeCloseTo(before.radiusEarth * kEarth, 6);
    expect(moon.radiusScene).toBeCloseTo(before.radiusScene * kEarth, 6);
    expect(moon.orbitRadiusEarth).toBeCloseTo(before.orbitRadiusEarth * kEarth, 6);
    expect(moon.orbitRadiusScene).toBeCloseTo(before.orbitRadiusScene * kEarth, 6);
    expect(moon.radius).toBeCloseTo(before.radius * kMap, 6);
    expect(moon.orbitRadius).toBeCloseTo(before.orbitRadius * kMap, 6);
  });

  it('sets moonCount on the swapped planet to the surviving moon count', () => {
    const entry = makeEntryWithMoon();
    ExoticOverlay._swapPlanetType(entry, 'crystal', new SeededRandom('swap-rng'));
    expect(entry.planetData.moonCount).toBe(entry.moons.length);
    expect(entry.planetData.moonCount).toBe(1);
  });

  it('does not throw when the planet has no moons', () => {
    const rng = new SeededRandom('wu7-1-nomoon');
    const planetData = PlanetGenerator.generate(rng, 1.0, null, null, 'terrestrial');
    const entry = { planetData, orbitRadiusAU: 1.0, moons: [] };
    expect(() => ExoticOverlay._swapPlanetType(entry, 'crystal', rng)).not.toThrow();
    expect(entry.planetData.moonCount).toBe(0);
  });
});

/**
 * Increment-3 binding input (b): _applyFungal crashed when a bloom roll
 * (10%) fired on a system with exactly ONE fungal candidate —
 * rng.int(2, Math.min(4, 1)) returns 2 (inverted range), so the colonize
 * loop indexed candidates[1] = undefined. D-class primaries (planetRange
 * [0,2]) make 1-candidate systems likelier, and the bulk overlay merge
 * makes D primaries reachable.
 */
describe('ExoticOverlay._applyFungal — 1-candidate bloom (Inc-3 input b)', () => {
  // Deterministically find a seed whose FIRST draw fires chance(0.10),
  // so the bloom branch is taken without mocking the rng.
  function bloomSeed() {
    for (let i = 0; i < 500; i++) {
      const s = `fungal-bloom-${i}`;
      if (new SeededRandom(s).float() < 0.10) return s;
    }
    throw new Error('no bloom-firing seed found in 500 tries');
  }

  function makeCandidate(seed) {
    const rng = new SeededRandom(seed);
    const planetData = PlanetGenerator.generate(rng, 1.0, null, null, 'terrestrial');
    return { planetData, orbitRadiusAU: 1.0, moons: [] };
  }

  const systemDataStub = { star: { type: 'M' } };

  it('does not crash with exactly one candidate; colonizes it and returns true', () => {
    const entry = makeCandidate('fungal-1cand-planet');
    const rng = new SeededRandom(bloomSeed());
    const result = ExoticOverlay._applyFungal(rng, [entry], systemDataStub, 0.5, 2.0);
    expect(result).toBe(true);
    expect(entry.planetData.type).toBe('fungal');
  });

  it('bloom with two candidates still colonizes exactly two (unchanged semantics)', () => {
    const a = makeCandidate('fungal-2cand-a');
    const b = makeCandidate('fungal-2cand-b');
    const rng = new SeededRandom(bloomSeed());
    const result = ExoticOverlay._applyFungal(rng, [a, b], systemDataStub, 0.5, 2.0);
    expect(result).toBe(true);
    expect(a.planetData.type).toBe('fungal');
    expect(b.planetData.type).toBe('fungal');
  });
});
