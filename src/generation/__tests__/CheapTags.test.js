import { describe, it, expect, vi } from 'vitest';
import { StarSystemGenerator } from '../StarSystemGenerator.js';
import { PlanetGenerator } from '../PlanetGenerator.js';
import { GalacticMap } from '../GalacticMap.js';
import { deriveSystemTags } from '../SystemTags.js';

// Seeds span binary / single / empty / populated systems (see CheapTags fixtures).
const SEEDS = ['fixture-0', 'fixture-1', 'fixture-3', 'fixture-5', 'fixture-12', 'fixture-30', 'fixture-77'];

describe('AC2 — deriveCheapTags (RNG-order-safe fast path)', () => {
  // The 4 early-determined fields (isBinary, both star types, archetype) are
  // drawn BEFORE the per-planet loop, so the cheap path knows them EXACTLY.
  // planetCount is the NOMINAL (pre-culling) count: the loop can break on the
  // orbit limit and migration / binary-stability culling (which need planet
  // types from the per-planet loop) only ever REMOVE planets, so cheap
  // planetCount is an exact-or-overcount upper bound on the final count.
  describe('cheap early fields equal full-generation values (null galaxyContext)', () => {
    for (const seed of SEEDS) {
      it(`matches for ${seed}`, () => {
        const full = deriveSystemTags(StarSystemGenerator.generate(seed));
        const cheap = StarSystemGenerator.deriveCheapTags(seed);
        expect(cheap.isBinary).toBe(full.isBinary);
        expect(cheap.primaryType).toBe(full.primaryType);
        expect(cheap.secondaryType).toBe(full.secondaryType);
        expect(cheap.archetype).toBe(full.archetype);
        // nominal count is an upper bound on the final (post-culling) count
        expect(cheap.planetCount).toBeGreaterThanOrEqual(full.planetCount);
      });
    }
  });

  it('nominal planetCount matches final for the common (no-culling) case', () => {
    // Across deterministic fixtures, the majority of systems are single-star,
    // non-migrating, and not orbit-capped — there the nominal count is exact.
    let exact = 0;
    for (const seed of SEEDS) {
      const full = deriveSystemTags(StarSystemGenerator.generate(seed));
      const cheap = StarSystemGenerator.deriveCheapTags(seed);
      if (cheap.planetCount === full.planetCount) exact++;
    }
    expect(exact).toBeGreaterThan(0);
  });

  describe('cheap early fields equal full values WITH a real galaxyContext + starTypeOverride', () => {
    const map = new GalacticMap('cheap-tags-test');
    const positions = [
      { x: 8.0, y: 0.0, z: 0.0 },
      { x: 4.2, y: 0.1, z: -3.7 },
      { x: 10.5, y: -0.2, z: 2.1 },
    ];
    for (const pos of positions) {
      it(`matches at (${pos.x},${pos.y},${pos.z})`, () => {
        const ctx = map.deriveGalaxyContext(pos);
        ctx.starTypeOverride = 'K';
        const seed = 'ctx-seed-42';
        const full = deriveSystemTags(StarSystemGenerator.generate(seed, ctx));
        const cheap = StarSystemGenerator.deriveCheapTags(seed, ctx);
        expect(cheap.isBinary).toBe(full.isBinary);
        expect(cheap.primaryType).toBe(full.primaryType);
        expect(cheap.secondaryType).toBe(full.secondaryType);
        expect(cheap.archetype).toBe(full.archetype);
        expect(cheap.planetCount).toBeGreaterThanOrEqual(full.planetCount);
        // starTypeOverride is honored: primary type is the override
        expect(cheap.primaryType).toBe('K');
      });
    }
  });

  it('does NOT invoke PlanetGenerator.generate (no per-planet loop)', () => {
    const spy = vi.spyOn(PlanetGenerator, 'generate');
    StarSystemGenerator.deriveCheapTags('fixture-1');
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('a cheap call does not perturb a subsequent full generate (RNG order preserved)', () => {
    const seed = 'fixture-12';
    const before = StarSystemGenerator.generate(seed);
    StarSystemGenerator.deriveCheapTags(seed);
    StarSystemGenerator.deriveCheapTags(seed); // twice, for good measure
    const after = StarSystemGenerator.generate(seed);
    // Identity fields must be byte-identical
    expect(after.seed).toBe(before.seed);
    expect(after.star.type).toBe(before.star.type);
    expect(after.isBinary).toBe(before.isBinary);
    expect(after.planets.length).toBe(before.planets.length);
    expect(after.planets.map(p => p.planetData.type)).toEqual(before.planets.map(p => p.planetData.type));
    expect(after.planets.map(p => p.planetData.rings != null)).toEqual(before.planets.map(p => p.planetData.rings != null));
  });

  it('cheap tags omit expensive (per-planet) tags — hasRings/hasHabitable are unknown', () => {
    const cheap = StarSystemGenerator.deriveCheapTags('fixture-3');
    // Expensive tags require full generation; cheap path marks them unknown (null).
    expect(cheap.hasRings).toBe(null);
    expect(cheap.hasHabitable).toBe(null);
  });
});

describe('AC2 — generator determinism preserved after refactor', () => {
  it('same seed + null ctx → identical identity fields across two calls', () => {
    for (const seed of SEEDS) {
      const a = StarSystemGenerator.generate(seed);
      const b = StarSystemGenerator.generate(seed);
      expect(a.star.type).toBe(b.star.type);
      expect(a.isBinary).toBe(b.isBinary);
      expect(a.planets.map(p => p.planetData.type)).toEqual(b.planets.map(p => p.planetData.type));
    }
  });
});
