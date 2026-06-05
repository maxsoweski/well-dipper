import { describe, it, expect } from 'vitest';
import { GalacticMap } from '../GalacticMap.js';
import { probeRegion } from '../SystemProbe.js';
import { generateFromNavStar } from '../SystemResolver.js';

const map = new GalacticMap('well-dipper-galaxy-1');
const CENTER = { x: 8.0, y: 0.0, z: 0.0 };
const RADIUS = 0.03; // kpc — dense solar-neighborhood region. Small radius keeps
// the hash-grid sweep cheap (~0.4s vs ~4.5s at 0.07) while still hitting the
// 500-star cap with the same mix (~190 binary, ~30 G-type) — the neighborhood is
// dense enough that the nearest 500 stars all fall within 0.03 kpc.
// Cap the sweep so each probe generates a bounded number of systems — keeps the
// suite fast and timeout-safe under the parallel full-suite run (the dense
// region still yields plenty of binaries / G-types within the cap).
const MAXR = 120;

function withinRadius(nav, center, r) {
  const dx = nav.worldX - center.x, dy = nav.worldY - center.y, dz = nav.worldZ - center.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz) <= r + 1e-9;
}

describe('AC3 — probeRegion shallow search', () => {
  const region = { shape: 'radius', center: CENTER, radiusKpc: RADIUS, maxResults: MAXR };

  it('returns systems matching a cheap-tag filter (isBinary=true)', () => {
    const results = probeRegion(map, region, { isBinary: true }, { scanDepth: 'shallow' });
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      expect(r.tags.isBinary).toBe(true);
    }
  }, 30000);

  it('is deterministic — two identical probes return the identical result list', () => {
    const a = probeRegion(map, region, { isBinary: true }, { scanDepth: 'shallow' });
    const b = probeRegion(map, region, { isBinary: true }, { scanDepth: 'shallow' });
    expect(b).toEqual(a);
  }, 30000);

  it('every result lies within the requested volume', () => {
    const results = probeRegion(map, region, { isBinary: true }, { scanDepth: 'shallow' });
    for (const r of results) {
      expect(withinRadius(r.navStarData, CENTER, RADIUS)).toBe(true);
    }
  }, 30000);

  it('each result carries a navStarData snapshot + its tags', () => {
    const results = probeRegion(map, region, { isBinary: true }, { scanDepth: 'shallow' });
    expect(results.length).toBeGreaterThan(0);
    const r = results[0];
    expect(typeof r.navStarData.worldX).toBe('number');
    expect(typeof r.navStarData.worldY).toBe('number');
    expect(typeof r.navStarData.worldZ).toBe('number');
    expect(r.navStarData.seed).toBeDefined();
    expect(typeof r.navStarData.type).toBe('string');
    expect(r.tags).toBeDefined();
    expect(typeof r.tags.isBinary).toBe('boolean');
  }, 30000);

  it('filters on a cheap scalar tag (primaryType=G)', () => {
    const results = probeRegion(map, region, { primaryType: 'G' }, { scanDepth: 'shallow' });
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) expect(r.tags.primaryType).toBe('G');
  }, 30000);

  it('supports cube and prism region shapes', () => {
    const cube = probeRegion(map, { shape: 'cube', center: CENTER, halfSize: 0.03, maxResults: MAXR }, { isBinary: true }, { scanDepth: 'shallow' });
    const prism = probeRegion(map, { shape: 'prism', center: CENTER, xzHalf: 0.03, yHalf: 0.06, maxResults: MAXR }, { isBinary: true }, { scanDepth: 'shallow' });
    expect(Array.isArray(cube)).toBe(true);
    expect(Array.isArray(prism)).toBe(true);
    for (const r of cube) expect(r.tags.isBinary).toBe(true);
    for (const r of prism) expect(r.tags.isBinary).toBe(true);
  }, 30000);

  it('an empty filter returns every star in the region (each with cheap tags)', () => {
    const all = probeRegion(map, region, {}, { scanDepth: 'shallow' });
    const binaries = probeRegion(map, region, { isBinary: true }, { scanDepth: 'shallow' });
    expect(all.length).toBeGreaterThan(binaries.length);
  }, 30000);
});

describe('AC4 — scan depth (shallow vs deep)', () => {
  // Deep fully-generates every swept survivor, so cap the sweep tighter to keep
  // generation bounded (and fast/timeout-safe under the parallel suite). The
  // expensive hasRings filter exercises the shallow-superset vs deep-confirmed
  // distinction; ~20% of systems have a ringed planet, so the deep subset is
  // reliably non-empty and strictly smaller than the shallow superset.
  const region = { shape: 'radius', center: CENTER, radiusKpc: RADIUS, maxResults: 80 };
  const filter = { hasRings: true };

  it('shallow ignores the expensive (hasRings) filter — returns the cheap candidate superset', () => {
    const shallow = probeRegion(map, region, filter, { scanDepth: 'shallow' });
    expect(shallow.length).toBeGreaterThan(0);
    // hasRings is unknown in shallow (cannot be evaluated without full generation)
    for (const r of shallow) expect(r.tags.hasRings).toBe(null);
  }, 60000);

  it('deep confirms hasRings by full generation — a strict subset of shallow', () => {
    const shallow = probeRegion(map, region, filter, { scanDepth: 'shallow' });
    const deep = probeRegion(map, region, filter, { scanDepth: 'deep' });
    expect(deep.length).toBeGreaterThan(0);
    expect(deep.length).toBeLessThan(shallow.length);
    // every deep result really has a ringed planet (re-generate to verify)
    for (const r of deep) {
      expect(r.tags.hasRings).toBe(true);
      const sys = generateFromNavStar(map, r.navStarData);
      expect(sys.planets.some(p => p.planetData.rings != null)).toBe(true);
    }
  }, 60000);

  it('deep is deterministic', () => {
    const a = probeRegion(map, region, filter, { scanDepth: 'deep' });
    const b = probeRegion(map, region, filter, { scanDepth: 'deep' });
    expect(b).toEqual(a);
  }, 60000);
});
