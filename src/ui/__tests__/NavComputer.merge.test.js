// NavComputer real-star overlay merge — unit coverage for the AC1 D2 fix
// (real-universe-overlay Increment 5) and the canonical-seed unification
// (real-star-identity-unification FIX-1 / AC1). The prism's slab loader merges
// the real-star catalog onto the hash-grid stars. Interview ruling 1 (design
// fact 3) requires a MATCHED real star to render at its CATALOG position and
// player-relative distance — never the nearest hash-grid star's position.
//
// SEED IDENTITY (FIX-1, the loud guard): a real star must carry the ONE
// canonical F1 position-hash on EVERY path. On the matched branch the merge
// used to RETAIN the hash-grid star's seed; on the unmatched branch it used a
// degenerate x^z XOR. Both are now the F1 formula of the CATALOG position.
// These expectations inline F1 (via GalacticMap.hashCombine) rather than import
// the shared module, so this test pins the formula itself — a regression in the
// module cannot mask a regression here.
//
// These tests drive the slab loader (src/ui/prismLoader.js) on an Object.create'd
// instance through helpers/loaderHarness.mjs, with the hash grid's query and the
// catalogue stubbed to the fixture each test hands it. Pins both the matched
// (replace the twin) and unmatched (add as new) branches.

import { describe, it, expect, afterEach, vi } from 'vitest';
import { GalacticMap } from '../../generation/GalacticMap.js';

// F1 canonical real-star seed — inlined here as an INDEPENDENT pin of the
// formula the whole fix converges on (round to 0.1 pc bins, fold x,y,z through
// hashCombine). Intentionally NOT imported from realStarSeed.js.
const f1 = (x, y, z) =>
  GalacticMap.hashCombine(
    Math.round(x * 10000),
    GalacticMap.hashCombine(Math.round(y * 10000), Math.round(z * 10000)),
  );

// Player at Sol; offset from both stars so the recomputed distance is a clean,
// non-degenerate value.
const PLAYER = { x: 8.0, y: 0.025, z: 0.0 };

const dist = (a, b) =>
  Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);

// naming-prism-segments Phase 3 (AC-6, AC-8): the merge is now the slab loader's (prismLoader.js) —
// a real star REPLACES its twin (the nearest procedural star within 2 pc, decided by identity over a
// full 3D neighbourhood) rather than overwriting whichever loaded row was nearest. What these tests
// pin is unchanged: the real row renders at its CATALOG position with a player-relative distance and
// the canonical F1 seed, on both branches. The harness stubs the hash grid and the catalogue.
import { loaderNav, loadAll, stubGrid, proc } from './helpers/loaderHarness.mjs';

describe('the slab loader\'s real-star merge (AC1 D2, naming-prism-segments AC-8)', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('a MATCHED real star replaces its twin: catalog position, distance, and canonical F1 seed', () => {
    // Real catalog star at its TRUE position; a hash-grid star sits ~1.3 pc
    // away — inside MATCH_DIST (2 pc) — so it is the real star's twin.
    const realPos = { x: 7.9987, y: 0.0246, z: -0.0019 };
    const hashPos = { x: realPos.x + 0.001, y: realPos.y - 0.0005, z: realPos.z + 0.0008 };
    expect(dist(realPos, hashPos)).toBeLessThan(0.002); // inside MATCH_DIST
    stubGrid([proc(hashPos.x, hashPos.y, hashPos.z, { tier: 'K', cx: 1, cy: 2, cz: 3 })]);
    const nav = loaderNav({ ...realPos, realStars: [{ x: realPos.x, y: realPos.y, z: realPos.z, name: 'Sirius', spect: 'A' }] });

    loadAll(nav);

    expect(nav._localStars).toHaveLength(1); // replaced, not duplicated
    const s = nav._localStars[0];
    expect(s.isReal).toBe(true);
    expect(s.name).toBe('Sirius');
    expect(s.spectral).toBe('A');
    // Position comes from the CATALOG, not the hash grid (the D2 fix).
    expect(s.wx).toBe(realPos.x);
    expect(s.wy).toBe(realPos.y);
    expect(s.wz).toBe(realPos.z);
    expect(s.wx).not.toBe(hashPos.x);
    // Distance from the player to the REAL position.
    const expected = dist(realPos, PLAYER);
    expect(s.dist).toBeCloseTo(expected, 9);
    expect(s.distPc).toBe((expected * 1000).toFixed(0));
    // FIX-1: the canonical F1 seed of the CATALOG position — the same seed search/sky/arrival assign.
    expect(s.seed).toBe(f1(realPos.x, realPos.y, realPos.z));
    expect(s.seed).not.toBe(4242);
  });

  it('adds an UNMATCHED real star at its true position with the canonical F1 seed', () => {
    const realPos = { x: 8.0021, y: 0.03, z: 0.0011 };
    stubGrid([]);
    const nav = loaderNav({ ...realPos, realStars: [{ x: realPos.x, y: realPos.y, z: realPos.z, name: 'TRAPPIST-1', spect: 'M' }] });

    loadAll(nav);

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
    expect(s.seed).toBe(f1(realPos.x, realPos.y, realPos.z));
    // Prove the old XOR is gone: for this position F1 and XOR differ.
    expect(s.seed).not.toBe(Math.round(realPos.x * 10000) ^ Math.round(realPos.z * 10000));
  });

  it('assigns the SAME canonical seed on the matched and unmatched branches for one star', () => {
    const realPos = { x: 8.0011, y: -0.02, z: 0.0013 };
    const star = { x: realPos.x, y: realPos.y, z: realPos.z, name: 'Guniibuu', spect: 'K' };

    stubGrid([]);
    const navU = loaderNav({ ...realPos, realStars: [star] });
    loadAll(navU);
    const seedUnmatched = navU._localStars[0].seed;
    vi.restoreAllMocks();

    stubGrid([proc(realPos.x + 0.0005, realPos.y, realPos.z - 0.0005, { tier: 'G', cx: 9, cy: 9, cz: 9 })]);
    const navM = loaderNav({ ...realPos, realStars: [star] });
    loadAll(navM);
    expect(navM._localStars).toHaveLength(1);
    const seedMatched = navM._localStars[0].seed;

    expect(seedMatched).toBe(seedUnmatched);
    expect(seedMatched).toBe(f1(realPos.x, realPos.y, realPos.z));
  });
});
