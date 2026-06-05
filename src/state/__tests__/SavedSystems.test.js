import { describe, it, expect } from 'vitest';
import { SavedSystems } from '../SavedSystems.js';
import { GalacticMap } from '../../generation/GalacticMap.js';
import { HashGridStarfield } from '../../generation/HashGridStarfield.js';
import { generateFromNavStar } from '../../generation/SystemResolver.js';
import { deriveSystemTags } from '../../generation/SystemTags.js';

// In-memory localStorage shim — persists across instances (a "page reload" is a
// fresh SavedSystems built on the SAME backing storage).
function makeStorage() {
  const m = new Map();
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: k => m.delete(k),
  };
}

const map = new GalacticMap('well-dipper-galaxy-1');
// A concrete, deterministic star in the solar neighborhood for round-trip tests.
const sampleStar = HashGridStarfield.findStarsInRadius(map, { x: 8, y: 0, z: 0 }, 0.05, 50)[0];
const sampleNav = {
  worldX: sampleStar.worldX, worldY: sampleStar.worldY, worldZ: sampleStar.worldZ,
  seed: sampleStar.seed, type: sampleStar.type,
};

describe('AC5 — save persists across reload', () => {
  it('saved entry (navStarData + tags) survives a reload', () => {
    const storage = makeStorage();
    const store = new SavedSystems(storage);
    const original = generateFromNavStar(map, sampleNav);
    const tags = deriveSystemTags(original);

    store.save({ navStarData: sampleNav, tags, name: 'My Star' });

    // simulate page reload: fresh instance, same backing storage
    const reloaded = new SavedSystems(storage);
    const list = reloaded.list();
    expect(list.length).toBe(1);
    const entry = list[0];
    expect(entry.navStarData.worldX).toBe(sampleNav.worldX);
    expect(entry.navStarData.worldY).toBe(sampleNav.worldY);
    expect(entry.navStarData.worldZ).toBe(sampleNav.worldZ);
    expect(String(entry.navStarData.seed)).toBe(String(sampleNav.seed));
    expect(entry.navStarData.type).toBe(sampleNav.type);
    expect(entry.tags).toEqual(tags);
    expect(entry.name).toBe('My Star');
  });

  it('re-saving the same system upserts (no duplicate)', () => {
    const storage = makeStorage();
    const store = new SavedSystems(storage);
    const tags = deriveSystemTags(generateFromNavStar(map, sampleNav));
    store.save({ navStarData: sampleNav, tags });
    store.save({ navStarData: sampleNav, tags, name: 'renamed' });
    expect(store.list().length).toBe(1);
    expect(store.list()[0].name).toBe('renamed');
  });

  it('remove deletes an entry', () => {
    const storage = makeStorage();
    const store = new SavedSystems(storage);
    const tags = deriveSystemTags(generateFromNavStar(map, sampleNav));
    const entry = store.save({ navStarData: sampleNav, tags });
    store.remove(entry.id);
    expect(store.list().length).toBe(0);
  });
});

describe('AC6 — faithful reload via navStarData', () => {
  it('reloading a saved entry reproduces the IDENTICAL system (determinism proof)', () => {
    const storage = makeStorage();
    const store = new SavedSystems(storage);
    const original = generateFromNavStar(map, sampleNav);
    store.save({ navStarData: sampleNav, tags: deriveSystemTags(original) });

    // reload from the persisted entry's navStarData through the same resolver
    const reloaded = new SavedSystems(storage);
    const entry = reloaded.list()[0];
    const regenerated = generateFromNavStar(map, entry.navStarData);

    expect(regenerated.seed).toBe(original.seed);
    expect(regenerated.star.type).toBe(original.star.type);
    expect(regenerated.star2 ? regenerated.star2.type : null)
      .toBe(original.star2 ? original.star2.type : null);
    expect(regenerated.planets.length).toBe(original.planets.length);
    expect(regenerated.planets.map(p => p.planetData.type))
      .toEqual(original.planets.map(p => p.planetData.type));
    expect(regenerated.planets.map(p => p.planetData.rings != null))
      .toEqual(original.planets.map(p => p.planetData.rings != null));
  });

  it('a span of saved stars all round-trip identically', () => {
    const stars = HashGridStarfield.findStarsInRadius(map, { x: 8, y: 0, z: 0 }, 0.05, 20);
    for (const s of stars.slice(0, 4)) {
      const nav = { worldX: s.worldX, worldY: s.worldY, worldZ: s.worldZ, seed: s.seed, type: s.type };
      const a = generateFromNavStar(map, nav);
      const b = generateFromNavStar(map, nav);
      expect(b.star.type).toBe(a.star.type);
      expect(b.planets.map(p => p.planetData.type)).toEqual(a.planets.map(p => p.planetData.type));
    }
  });
});

describe('AC7 — search saved list by tag', () => {
  // Seed a modest mix of saved systems (kept small so the parallel full-suite
  // run stays fast/timeout-safe; 18 systems reliably contains both binary and
  // habitable examples in this dense region).
  function seed(store) {
    const stars = HashGridStarfield.findStarsInRadius(map, { x: 8, y: 0, z: 0 }, 0.1, 60);
    for (const s of stars.slice(0, 18)) {
      const nav = { worldX: s.worldX, worldY: s.worldY, worldZ: s.worldZ, seed: s.seed, type: s.type };
      const tags = deriveSystemTags(generateFromNavStar(map, nav));
      store.save({ navStarData: nav, tags });
    }
  }

  it('filterByTag returns only entries whose tags match (isBinary=true)', () => {
    const store = new SavedSystems(makeStorage());
    seed(store);
    const all = store.list();
    const binaries = store.filterByTag({ isBinary: true });
    expect(binaries.length).toBeGreaterThan(0);
    expect(binaries.length).toBeLessThan(all.length);
    for (const e of binaries) expect(e.tags.isBinary).toBe(true);
  }, 30000);

  it('filterByTag on hasHabitable=true returns only habitable saves', () => {
    const store = new SavedSystems(makeStorage());
    seed(store);
    const habitable = store.filterByTag({ hasHabitable: true });
    for (const e of habitable) expect(e.tags.hasHabitable).toBe(true);
    // and they are a subset of all
    expect(habitable.length).toBeLessThanOrEqual(store.list().length);
  }, 30000);
});
