// NavComputer real-star overlay merge — unit coverage for the AC1 D2 fix
// (real-universe-overlay Increment 5). The prism's _queryYRange merges the
// real-star catalog onto the hash-grid stars. Interview ruling 1 (design
// fact 3) requires a MATCHED real star to render at its CATALOG position and
// player-relative distance — never the nearest hash-grid star's position.
//
// These tests drive the merge branch directly on an Object.create'd instance
// (the DOM-bound constructor — canvas/renderers/GalacticSectors — is out of
// scope headless; the node test env has no `window`). HashGridStarfield
// .findStarsInPrism is stubbed to [] so the merge operates only on the
// synthetic hash-grid + catalog fixture we hand it. Pins both the matched
// (overwrite) and unmatched (add-as-new, unchanged legacy path) branches.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NavComputer } from '../NavComputer.js';
import { HashGridStarfield } from '../../generation/HashGridStarfield.js';

// Player at Sol; offset from both stars so the recomputed distance is a clean,
// non-degenerate value.
const PLAYER = { x: 8.0, y: 0.025, z: 0.0 };

const dist = (a, b) =>
  Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);

// Bare NavComputer carrying only the fields _queryYRange reads.
function makeNav(realStars) {
  const nav = Object.create(NavComputer.prototype);
  nav._localStars = [];
  nav._loadedSeen = new Set();
  nav._loadedYMin = null;
  nav._loadedYMax = null;
  nav._loadBlockCenter = { x: PLAYER.x, z: PLAYER.z };
  nav._loadBlockHalf = 0.01; // 10 pc — the volume half-extent passed to findInVolume
  nav._playerX = PLAYER.x;
  nav._playerY = PLAYER.y;
  nav._playerZ = PLAYER.z;
  nav._realStarCatalog = { loaded: true, findInVolume: () => realStars };
  return nav;
}

describe('NavComputer._queryYRange real-star merge (AC1 D2)', () => {
  beforeEach(() => {
    // No procedural hash-grid stars: isolate the overlay branch so the merge
    // operates only on whatever we pre-seed into _localStars.
    vi.spyOn(HashGridStarfield, 'findStarsInPrism').mockReturnValue([]);
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it('overwrites a MATCHED entry with the catalog position and player-relative distance', () => {
    // Real catalog star at its TRUE position; a hash-grid star sits ~1.5 pc
    // away — inside MATCH_DIST (2 pc) — so the two merge.
    const realPos = { x: 7.9987, y: 0.0246, z: -0.0019 };
    const hashPos = { x: realPos.x + 0.001, y: realPos.y - 0.0005, z: realPos.z + 0.0008 };
    expect(dist(realPos, hashPos)).toBeLessThan(0.002); // inside MATCH_DIST

    const nav = makeNav([{ x: realPos.x, y: realPos.y, z: realPos.z, name: 'Sirius', spect: 'A' }]);
    // Pre-seed the procgen (hash-grid) star the real one should merge onto.
    nav._localStars.push({
      wx: hashPos.x, wy: hashPos.y, wz: hashPos.z,
      name: 'Procgen ABC', spectral: 'K', color: '#ff9664',
      seed: 4242,
      dist: dist(hashPos, PLAYER),
      distPc: (dist(hashPos, PLAYER) * 1000).toFixed(0),
    });

    nav._queryYRange(realPos.y - 0.005, realPos.y + 0.005);

    expect(nav._localStars).toHaveLength(1); // merged, not duplicated
    const s = nav._localStars[0];
    expect(s.isReal).toBe(true);
    expect(s.name).toBe('Sirius');
    expect(s.spectral).toBe('A');
    // Position now comes from the CATALOG, not the hash grid (the D2 fix).
    expect(s.wx).toBe(realPos.x);
    expect(s.wy).toBe(realPos.y);
    expect(s.wz).toBe(realPos.z);
    expect(s.wx).not.toBe(hashPos.x);
    // Distance recomputed from the player to the REAL position.
    const expected = dist(realPos, PLAYER);
    expect(s.dist).toBeCloseTo(expected, 9);
    expect(s.distPc).toBe((expected * 1000).toFixed(0));
    // Seed retained from the hash-grid star (arrival identity rides name).
    expect(s.seed).toBe(4242);
  });

  it('adds an UNMATCHED real star at its true position (unchanged legacy path)', () => {
    // No nearby hash-grid star → the real star is appended as a new entry.
    const realPos = { x: 8.05, y: 0.03, z: 0.04 };
    const nav = makeNav([{ x: realPos.x, y: realPos.y, z: realPos.z, name: 'TRAPPIST-1', spect: 'M' }]);

    nav._queryYRange(realPos.y - 0.005, realPos.y + 0.005);

    expect(nav._localStars).toHaveLength(1);
    const s = nav._localStars[0];
    expect(s.isReal).toBe(true);
    expect(s.name).toBe('TRAPPIST-1');
    expect(s.spectral).toBe('M');
    expect(s.wx).toBe(realPos.x);
    expect(s.wy).toBe(realPos.y);
    expect(s.wz).toBe(realPos.z);
    const expected = dist(realPos, PLAYER);
    expect(s.dist).toBeCloseTo(expected, 9);
    expect(s.distPc).toBe((expected * 1000).toFixed(0));
    // Position-derived seed for a net-new real star (legacy formula).
    expect(s.seed).toBe(Math.round(realPos.x * 10000) ^ Math.round(realPos.z * 10000));
  });
});
