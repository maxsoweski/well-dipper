import { describe, it, expect } from 'vitest';
import { deriveSystemTags } from '../SystemTags.js';
import { StarSystemGenerator } from '../StarSystemGenerator.js';
import { generateSolarSystem } from '../SolarSystemData.js';

// Fixtures discovered empirically (deterministic seeds):
//   fixture-1 → binary G+G, 6 planets, has a habitable world, archetype spread-giant
//   fixture-3 → has a ringed (ice) planet
//   fixture-0 → empty system (0 planets), not binary
const BINARY_SEED = 'fixture-1';
const RINGED_SEED = 'fixture-3';
const EMPTY_SEED = 'fixture-0';

describe('AC1 — deriveSystemTags', () => {
  describe('Sol (KnownSystems / hand-authored fixture)', () => {
    const sol = generateSolarSystem();
    const tags = deriveSystemTags(sol);

    it('is not binary, primary type G, no secondary', () => {
      expect(tags.isBinary).toBe(false);
      expect(tags.primaryType).toBe('G');
      expect(tags.secondaryType).toBe(null);
    });

    it('planetCount equals the actual planets array length (13 incl. dwarf planets)', () => {
      // NOTE: contract AC1 illustratively said "8" (Sol's major planets); the
      // principled rule is planets.length, which for Sol is 13 (incl. dwarfs).
      expect(tags.planetCount).toBe(sol.planets.length);
      expect(tags.planetCount).toBe(13);
    });

    it('hasRings is true (Saturn etc.) and hasHabitable is true (Earth)', () => {
      expect(tags.hasRings).toBe(true);
      expect(tags.hasHabitable).toBe(true);
    });

    it('archetype is null when the system data carries none', () => {
      expect(tags.archetype).toBe(null);
    });
  });

  describe('procedural binary fixture', () => {
    const sys = StarSystemGenerator.generate(BINARY_SEED);
    const tags = deriveSystemTags(sys);

    it('reports the binary with both star types', () => {
      expect(tags.isBinary).toBe(true);
      expect(tags.primaryType).toBe(sys.star.type);
      expect(tags.secondaryType).toBe(sys.star2.type);
      expect(typeof tags.secondaryType).toBe('string');
    });

    it('archetype is the system archetype string', () => {
      expect(tags.archetype).toBe(sys.archetype);
      expect(tags.archetype).toBe('spread-giant');
    });
  });

  describe('procedural ringed fixture', () => {
    const sys = StarSystemGenerator.generate(RINGED_SEED);
    const tags = deriveSystemTags(sys);

    it('hasRings reflects a ringed planet in the system', () => {
      expect(tags.hasRings).toBe(true);
      expect(tags.hasRings).toBe(sys.planets.some(p => p.planetData.rings != null));
    });
  });

  describe('empty system fixture', () => {
    const sys = StarSystemGenerator.generate(EMPTY_SEED);
    const tags = deriveSystemTags(sys);

    it('planetCount 0, no rings, not habitable', () => {
      expect(tags.planetCount).toBe(0);
      expect(tags.hasRings).toBe(false);
      expect(tags.hasHabitable).toBe(false);
    });
  });

  describe('tag consistency with source systemData (general invariant)', () => {
    for (const seed of ['fixture-5', 'fixture-12', 'fixture-30', 'fixture-77']) {
      it(`tags match systemData contents for ${seed}`, () => {
        const sys = StarSystemGenerator.generate(seed);
        const tags = deriveSystemTags(sys);
        expect(tags.isBinary).toBe(sys.isBinary);
        expect(tags.primaryType).toBe(sys.star.type);
        expect(tags.secondaryType).toBe(sys.star2 ? sys.star2.type : null);
        expect(tags.planetCount).toBe(sys.planets.length);
        expect(tags.hasRings).toBe(sys.planets.some(p => p.planetData.rings != null));
      });
    }
  });
});

import { tagSummary, isShallowTags } from '../SystemTags.js';

describe('isShallowTags', () => {
  it('flags a cheap-tag set (rings/hab unknown) as shallow', () => {
    expect(isShallowTags({ isBinary: true, primaryType: 'K', secondaryType: 'K', planetCount: 3, hasRings: null, hasHabitable: null })).toBe(true);
  });
  it('does not flag a fully-confirmed set', () => {
    expect(isShallowTags({ isBinary: false, primaryType: 'G', secondaryType: null, planetCount: 8, hasRings: true, hasHabitable: true })).toBe(false);
  });
});

describe('tagSummary', () => {
  it('renders a confirmed single-star set with rings/hab suffixes', () => {
    expect(tagSummary({ isBinary: false, primaryType: 'G', secondaryType: null, planetCount: 8, hasRings: true, hasHabitable: true }))
      .toBe('G · 8p · rings · hab');
  });
  it('renders a confirmed binary', () => {
    expect(tagSummary({ isBinary: true, primaryType: 'K', secondaryType: 'K', planetCount: 3, hasRings: true, hasHabitable: true }))
      .toBe('K+K · bin · 3p · rings · hab');
  });
  it('marks a shallow set and omits the unconfirmed rings/hab', () => {
    expect(tagSummary({ isBinary: true, primaryType: 'K', secondaryType: 'K', planetCount: 3, hasRings: null, hasHabitable: null }))
      .toBe('~K+K · bin · 3p');
  });
});
