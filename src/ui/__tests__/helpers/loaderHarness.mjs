/**
 * loaderHarness — drive the PRISM slab loader (src/ui/prismLoader.js) on a bare NavComputer, with
 * the hash grid and the catalogue stubbed, so a test controls exactly which procedural and real
 * stars exist. naming-prism-segments Phase 3 (AC-6, AC-8).
 *
 * `HashGridStarfield.prismQuery` is replaced by a fake whose results are the given procedural stars
 * inside its (closed) box — the same contract the real query has — so both the slab scans and the
 * real stars' twin searches see the same fixture. Undo with `vi.restoreAllMocks()`.
 */
import { vi } from 'vitest';
import { NavComputer } from '../../NavComputer.js';
import { HashGridStarfield } from '../../../generation/HashGridStarfield.js';
import { GalacticMap } from '../../../generation/GalacticMap.js';
import { starKey } from '../../../generation/GalaxyGrid.js';
import * as navGrid from '../../navGrid.js';
import { prismLoadScheduler, loaderFor } from '../../prismLoader.js';

export const PLAYER = { x: 8.0, y: 0.025, z: 0.0 };

/** A procedural star record as the generator returns it. */
export function proc(x, y, z, ident, type = ident.tier) {
  return { worldX: x, worldY: y, worldZ: z, seed: 4242, type, dist: 0, ident, key: starKey(ident) };
}

/** Stub the query: results = fixture stars inside the closed box. */
export function stubGrid(procStars) {
  return vi.spyOn(HashGridStarfield, 'prismQuery').mockImplementation((gm, c, xzHalf, yHalf) => ({
    results: procStars.filter((s) => Math.abs(s.worldX - c.x) <= xzHalf && Math.abs(s.worldY - c.y) <= yHalf
      && Math.abs(s.worldZ - c.z) <= xzHalf).map((s) => ({ ...s })),
    featureRegions: () => [],
    step: () => true,
    cellsVisited: 0,
  }));
}

/** A closed-box catalogue over `realStars`, the RealStarCatalog.findInVolume contract. */
export function catalogue(realStars) {
  return {
    loaded: true,
    findInVolume: (c, xzHalf, yHalf) => realStars.filter((s) => s.x >= c.x - xzHalf && s.x <= c.x + xzHalf
      && s.y >= c.y - yHalf && s.y <= c.y + yHalf && s.z >= c.z - xzHalf && s.z <= c.z + xzHalf),
  };
}

/**
 * A bare NavComputer at PRISM on the column containing (x, z), camera at height y, with a fresh
 * galactic map (so the twin cache is cold). Manual frames on the shared scheduler.
 */
export function loaderNav({ x, y, z, realStars = [], player = PLAYER } = {}) {
  prismLoadScheduler.reset();
  prismLoadScheduler.configure({ requestFrame: null });
  const nav = Object.create(NavComputer.prototype);
  nav._localStars = [];
  nav._gm = new GalacticMap('well-dipper-galaxy-1');
  nav._playerX = player.x; nav._playerY = player.y; nav._playerZ = player.z;
  nav._realStarCatalog = catalogue(realStars);
  nav._levelIndex = 3;
  const col = navGrid.enterColumn(navGrid.parentAt(3, x, z));
  nav._prismColumn = col; nav._localCubeSize = col.halfWidth;
  nav._localCenter = { x: col.center.x, y, z: col.center.z };
  return nav;
}

/** Point the loader at the camera and run frames until it is idle. */
export function loadAll(nav) {
  nav._ensureStarsLoaded(nav._localCenter.x, nav._localCenter.y, nav._localCenter.z, 0);
  prismLoadScheduler.drain();
  return nav._localStars;
}

export { loaderFor, prismLoadScheduler };
