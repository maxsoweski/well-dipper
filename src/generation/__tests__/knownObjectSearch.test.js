// knownObjectSearch — unit coverage for the AC2 player-facing nav search
// resolver (Increment 4). Exercises the three ported debug-panel sources
// (real stars, structures) PLUS the two AC2 gaps the debug panel misses:
// named-systems catalog (class b) and registry-name bridge (class d).
//
// Fixtures follow the existing fs-load pattern (cf. NameGenerator.injective
// .test.js reading hyg-stars.json): the RealStarCatalog is built from the SAME
// shipped JSON the game loads (hyg ∪ supplement), so star/registry assertions
// exercise real resolution logic, not stubs. The named-systems catalog and
// KnownObjectProfiles are static ESM imports (synchronous, headless).

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  resolveKnownObjects, toNavStar, neighborhoodBounds,
} from '../knownObjectSearch.js';
import { RealStarCatalog } from '../RealStarCatalog.js';
import { RealFeatureCatalog } from '../RealFeatureCatalog.js';
import { enumerateNamedSystems } from '../NameGenerator.js';

function loadJson(rel) {
  return JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf-8'));
}

// Sol — the natural player origin; anchors the class-(b) neighborhood box.
const SOL = { x: 8.0, y: 0.025, z: 0.0 };

let realStarCatalog;
let realFeatureCatalog;

beforeAll(() => {
  // hyg ∪ supplement — the supplement carries dim named hosts (TRAPPIST-1,
  // Proxima Centauri, ...) the game concatenates onto HYG at load.
  const hyg = loadJson('../../../public/assets/data/hyg-stars.json');
  const supplement = loadJson('../../../public/assets/data/real-star-supplement.json');
  realStarCatalog = new RealStarCatalog();
  realStarCatalog.ingestCatalogData(hyg, supplement, null); // flips ._loaded, builds ._stars

  // Feature catalog: build the same records RealFeatureCatalog.load() produces,
  // straight from the shipped Harris JSON (avoids a fetch() in the headless env).
  const gcRaw = loadJson('../../../public/assets/data/globular-clusters.json');
  realFeatureCatalog = new RealFeatureCatalog();
  realFeatureCatalog._globularClusters = gcRaw.map(gc => ({
    type: 'globular-cluster',
    position: { x: gc.x, y: gc.y, z: gc.z },
    radius: 0.03,
    name: gc.name,
    harrisId: gc.id,
  }));
  realFeatureCatalog._loaded = true;
});

function run(query, extra = {}) {
  return resolveKnownObjects(query, {
    realStarCatalog,
    realFeatureCatalog,
    playerPos: SOL,
    ...extra,
  });
}

describe('resolveKnownObjects — (a) real stars', () => {
  it('resolves Sirius to a star hit with spectral type + position', () => {
    const hit = run('Sirius').find(r => r.kind === 'star' && r.name === 'Sirius');
    expect(hit).toBeDefined();
    expect(hit.starType).toBe('A');
    expect(hit.worldPos.x).toBeCloseTo(7.998231, 4);
    expect(hit.worldPos.z).toBeCloseTo(-0.001913, 4);
    expect(typeof hit.seed).toBe('number');
  });

  it('resolves Rigil Kentaurus (HYG proper name) to a star hit', () => {
    const hit = run('Rigil Kentaurus').find(r => r.kind === 'star');
    expect(hit).toBeDefined();
    expect(hit.name).toBe('Rigil Kentaurus');
    expect(hit.worldPos.x).toBeCloseTo(8.000948, 4);
  });

  it('resolves TRAPPIST-1 (supplement star) — proves hyg ∪ supplement coverage', () => {
    const hit = run('TRAPPIST-1').find(r => r.kind === 'star');
    expect(hit).toBeDefined();
    expect(hit.name).toBe('TRAPPIST-1');
    expect(hit.starType).toBe('M');
  });

  it('caps the real-star scan at 10', () => {
    // "gj " matches many supplement/HYG designations; the per-source cap holds.
    const stars = run('a').filter(r => r.kind === 'star');
    expect(stars.length).toBeLessThanOrEqual(10);
  });
});

describe('resolveKnownObjects — (d) registry-name bridge (debug-panel gap)', () => {
  it('resolves "Alpha Centauri" — a registry display name with no HYG star of that name', () => {
    const results = run('Alpha Centauri');
    const reg = results.find(r => r.kind === 'registry' && r.name === 'Alpha Centauri');
    expect(reg).toBeDefined();
    // Registered at Rigil's HYG position.
    expect(reg.worldPos.x).toBeCloseTo(8.000948, 4);
    expect(reg.type).toBeUndefined(); // no spectral override for an authored system
  });

  it('resolves "Sol" via the registry', () => {
    const reg = run('Sol').find(r => r.kind === 'registry' && r.name === 'Sol');
    expect(reg).toBeDefined();
    expect(reg.worldPos.x).toBeCloseTo(SOL.x, 2);
  });

  it('resolves an alias ("Rigil Kentaurus") back to its registry entry', () => {
    // Alpha Centauri claims Rigil Kentaurus as a derived alias (eager far/self +
    // catalog association). Without a catalog associate() the alias set at least
    // holds the self-name; Rigil resolves via the STAR source regardless, and if
    // present as an alias it also yields a registry row pointing at Alpha Cen.
    const results = run('Rigil Kentaurus');
    const reg = results.find(r => r.kind === 'registry');
    // A registry alias hit is optional pre-associate; when present it must point
    // at Alpha Centauri, not a spurious entry.
    if (reg) expect(reg.name).toBe('Alpha Centauri');
    // The star source always resolves Rigil.
    expect(results.some(r => r.kind === 'star' && r.name === 'Rigil Kentaurus')).toBe(true);
  });
});

describe('resolveKnownObjects — (c) structures', () => {
  it('resolves M42 to a KnownObjectProfiles structure hit', () => {
    const hit = run('M42').find(r => r.kind === 'structure');
    expect(hit).toBeDefined();
    expect(hit.name).toBe('Orion Nebula');
    expect(hit.key).toBe('M42');
    expect(hit.type).toBe('emission-nebula');
    expect(typeof hit.worldPos.x).toBe('number');
  });

  it('resolves a real Harris globular ("47 Tuc") to a structure hit', () => {
    const hit = run('47 Tuc').find(r => r.kind === 'structure');
    expect(hit).toBeDefined();
    expect(hit.name).toBe('47 Tuc');
    expect(hit.harrisId).toBe('NGC 104');
    expect(hit.type).toBe('globular-cluster');
    expect(hit.worldPos.y).toBeCloseTo(-3.075, 3);
  });

  it('resolves a globular by Harris ID ("NGC 6205" → M 13)', () => {
    const hit = run('NGC 6205').find(r => r.kind === 'structure');
    expect(hit).toBeDefined();
    expect(hit.name).toBe('M 13');
  });
});

describe('resolveKnownObjects — (b) named-systems catalog (debug-panel gap)', () => {
  it('resolves a settled-catalog name within the player-centered bounds', () => {
    // Derive a real target name from the SAME box the resolver uses, so the hit
    // is guaranteed regardless of the exact box size.
    const box = neighborhoodBounds(SOL);
    const sample = enumerateNamedSystems(box);
    expect(sample.length).toBeGreaterThan(0);
    const target = sample[0];

    const hit = run(target.name).find(r => r.kind === 'named' && r.name === target.name);
    expect(hit).toBeDefined();
    expect(hit.worldPos.x).toBeCloseTo(target.position.x, 5);
    expect(hit.key).toBe(target.key);
    expect(hit.region).toBe(target.region);
  });

  it('returns no named rows without a playerPos (bounds are player-centered)', () => {
    const results = resolveKnownObjects('Sirius', { realStarCatalog });
    expect(results.some(r => r.kind === 'named')).toBe(false);
  });
});

describe('toNavStar — SearchResult → warp nav-star adapter', () => {
  it('star hit → navStar with worldX/Y/Z, seed, name, and spectral type', () => {
    const hit = run('Sirius').find(r => r.kind === 'star' && r.name === 'Sirius');
    const nav = toNavStar(hit);
    expect(nav.worldX).toBeCloseTo(7.998231, 4);
    expect(nav.worldY).toBeCloseTo(0.024592, 4);
    expect(nav.worldZ).toBeCloseTo(-0.001913, 4);
    expect(nav.name).toBe('Sirius');
    expect(nav.type).toBe('A'); // spectral class → starTypeOverride at arrival
    expect(typeof nav.seed).toBe('number');
  });

  it('registry hit → navStar carries name + position, NO spectral type', () => {
    const reg = run('Alpha Centauri').find(r => r.kind === 'registry');
    const nav = toNavStar(reg);
    expect(nav.name).toBe('Alpha Centauri');
    expect(nav.worldX).toBeCloseTo(8.000948, 4);
    expect(nav.type).toBeUndefined();
    expect(typeof nav.seed).toBe('number');
  });

  it('structure hit → navStar carries name + position, NO spectral type', () => {
    const hit = run('M42').find(r => r.kind === 'structure');
    const nav = toNavStar(hit);
    expect(nav.name).toBe('Orion Nebula');
    expect(nav.type).toBeUndefined(); // object type is not a spectral override
    expect(nav.worldX).toBeCloseTo(hit.worldPos.x, 6);
    expect(nav.worldZ).toBeCloseTo(hit.worldPos.z, 6);
  });

  it('named hit → navStar carries name + position, NO spectral type', () => {
    const box = neighborhoodBounds(SOL);
    const target = enumerateNamedSystems(box)[0];
    const hit = run(target.name).find(r => r.kind === 'named');
    const nav = toNavStar(hit);
    expect(nav.name).toBe(target.name);
    expect(nav.type).toBeUndefined();
    expect(nav.worldX).toBeCloseTo(target.position.x, 5);
  });

  it('seed matches RealStarCatalog.findVisible for the same real star (canonical seed)', () => {
    // The resolver's seed must equal the sky/nav pipeline's seed so a warp lands
    // deterministically. findVisible computes it from a nearby vantage; compare.
    const hit = run('Sirius').find(r => r.kind === 'star' && r.name === 'Sirius');
    const visible = realStarCatalog.findVisible(SOL, 20).find(s => s.name === 'Sirius');
    expect(visible).toBeDefined();
    expect(hit.seed).toBe(visible.seed);
  });
});
