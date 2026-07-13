/**
 * knownObjectSearch — a pure, headless-testable resolver for the player-facing
 * nav-computer search (Increment 4 / AC2).
 *
 * It ports the three-source resolution logic from `DebugPanel.doSearch`
 * (src/ui/DebugPanel.js:582-711 — read-only reference, NOT modified) and closes
 * the two gaps AC2 requires that the debug panel misses:
 *
 *   (a) REAL STARS      — substring scan of `realStarCatalog._stars` on `.name`
 *                         (mirrors DebugPanel.js:595-600), capped.
 *   (b) NAMED SYSTEMS   — the settled/notable named-systems catalog, searched
 *                         NOWHERE today. Via `enumerateNamedSystems(bounds)` over
 *                         a PLAYER-CENTERED box (not galaxy-wide — it is O(N)),
 *                         then substring-filtered on the entry name. NEW GAP.
 *   (c) STRUCTURES      — `KnownObjectProfiles` (via `searchKnownObjects`) +
 *                         `RealFeatureCatalog` Harris globulars (mirrors
 *                         DebugPanel.js:604-634).
 *   (d) REGISTRY NAMES  — `KnownSystems.getAll()` display names + their derived
 *                         alias sets, so `Alpha Centauri` / `Sol` (registry names,
 *                         never a HYG `star.name` for Alpha Cen) RESOLVE. The debug
 *                         panel scans only HYG `_stars.name`, so it misses these.
 *                         NEW GAP.
 *
 * Intent: AC2 needs the same multi-source resolution as the debug panel, on a
 * NON-debug surface (the nav computer), plus the two gaps above. A shared pure
 * resolver is unit-testable headless (this file's test). Deliberately NOT here:
 * any UI, keyboard handling, warp arming, or `window._warpTarget` mutation — the
 * adapter only SHAPES data into the nav-star object main.js consumes; the UI
 * stage wires selection → warp through the supported `_setWarpTargetFromNavStar`
 * path.
 *
 * @typedef {Object} SearchResult
 * @property {string} name        Display name.
 * @property {{x:number,y:number,z:number}} worldPos  Galactic position, kpc.
 * @property {number} seed        Deterministic position seed (findVisible formula).
 * @property {'star'|'named'|'structure'|'registry'} kind  Source class.
 * @property {string} [starType]  Spectral class — ONLY for `kind:'star'` (drives
 *                                 the warp-arrival starTypeOverride). Absent for
 *                                 named/structure/registry so procgen/authored
 *                                 data decides the star type.
 * @property {string} [type]      DISPLAY type: spectral class (star), region
 *                                 (named), object type (structure).
 * @property {number} [mag]       Apparent magnitude (star only, display).
 * @property {string} [key]       Locator key (named), Harris ID (globular),
 *                                 profile key (structure), or display name (registry).
 * @property {string} [region]    Galactic region (named only, display).
 * @property {string} [harrisId]  Harris catalog id (globular only, display).
 * @property {number} [radius]    Structure radius, kpc (structure only, display).
 * @property {string} [matchedAlias]  The alias string that matched (registry only).
 */

import { enumerateNamedSystems } from './NameGenerator.js';
import { KnownSystems } from './KnownSystems.js';
import { GalacticMap } from './GalacticMap.js';
import { searchKnownObjects } from '../data/KnownObjectProfiles.js';

// Per-source result caps (mirror the debug panel's cap of 10 for stars/features).
const STAR_CAP = 10;
const NAMED_CAP = 10;
const STRUCTURE_CAP = 10;
// Default overall cap on the merged list returned to the caller.
const DEFAULT_LIMIT = 25;

// ── Class (b) bounds (design D3) ─────────────────────────────────────────────
// The named-systems catalog is searched only within a PLAYER-CENTERED box, never
// galaxy-wide (fact 5: `enumerateNamedSystems` is O(N) over ~48k rows and does no
// name matching itself). Chosen box: ±2.5 kpc on X/Z, ±0.5 kpc on Y.
//   • X/Z = ±2.5 kpc: a generous local-neighborhood bubble a player would
//     plausibly reach and name-search, holding ~3.3k catalog systems near Sol
//     (verified) — large enough to be useful, far short of the ±16 kpc disk that
//     fact 5 warns against, and the substring filter narrows it much further.
//   • Y = ±0.5 kpc: the settled/notable catalog hugs the thin disk (catalog Y
//     spans ~±2 kpc); ±0.5 kpc captures the local plane without dragging in
//     halo strays. A query that matches nothing in-box simply returns no named
//     rows — real stars and structures still resolve galaxy-wide by their own
//     catalogs.
const NAMED_HALF_XZ = 2.5; // kpc
const NAMED_HALF_Y = 0.5;  // kpc

/**
 * The player-centered bounding box used for class-(b) named-system enumeration.
 * Exported so callers (and tests) can reproduce exactly which slice of the
 * catalog the search covers.
 * @param {{x:number,y:number,z:number}} playerPos
 * @returns {{xMin,xMax,yMin,yMax,zMin,zMax:number}}
 */
export function neighborhoodBounds(playerPos) {
  const p = playerPos || { x: 0, y: 0, z: 0 };
  return {
    xMin: p.x - NAMED_HALF_XZ, xMax: p.x + NAMED_HALF_XZ,
    yMin: (p.y || 0) - NAMED_HALF_Y, yMax: (p.y || 0) + NAMED_HALF_Y,
    zMin: p.z - NAMED_HALF_XZ, zMax: p.z + NAMED_HALF_XZ,
  };
}

/**
 * Deterministic position seed — byte-for-byte the same formula
 * `RealStarCatalog.findVisible` uses (RealStarCatalog.js:248-251), so a real-star
 * hit here carries the identical seed the sky/nav pipeline would assign it, and
 * every other class gets a stable, position-derived seed for procgen at arrival.
 * @param {number} x @param {number} y @param {number} z
 * @returns {number}
 */
function seedFromPos(x, y, z) {
  return GalacticMap.hashCombine(
    Math.round(x * 10000),
    GalacticMap.hashCombine(Math.round(y * 10000), Math.round(z * 10000)),
  );
}

/**
 * Resolve a query against all four known-object sources.
 *
 * @param {string} query
 * @param {Object} opts
 * @param {Object} opts.realStarCatalog   Loaded RealStarCatalog instance (reads `._stars`).
 * @param {Object} [opts.realFeatureCatalog]  Loaded RealFeatureCatalog instance (reads `.globularClusters`).
 * @param {Object} [opts.knownSystems=KnownSystems]  Registry (defaults to the module singleton class).
 * @param {{x,y,z}} [opts.playerPos]  Player galactic position — anchors the class-(b) box.
 * @param {Object} [opts.bounds]  Override the class-(b) box (defaults to neighborhoodBounds(playerPos)).
 * @param {number} [opts.limit=25]  Cap on the merged result list.
 * @returns {SearchResult[]}
 */
export function resolveKnownObjects(query, {
  realStarCatalog,
  realFeatureCatalog,
  knownSystems = KnownSystems,
  playerPos,
  bounds,
  limit = DEFAULT_LIMIT,
} = {}) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return [];

  const stars = [];
  const registry = [];
  const named = [];
  const structures = [];

  // ── (a) REAL STARS — substring on _stars.name (mirror DebugPanel.js:595-600) ──
  const catalog = realStarCatalog;
  if (catalog?.loaded && Array.isArray(catalog._stars)) {
    for (const star of catalog._stars) {
      if (star.name && star.name.toLowerCase().includes(q)) {
        stars.push({
          name: star.name,
          worldPos: { x: star.x, y: star.y, z: star.z },
          seed: seedFromPos(star.x, star.y, star.z),
          kind: 'star',
          starType: star.spect,
          type: star.spect,
          mag: star.mag,
        });
        if (stars.length >= STAR_CAP) break;
      }
    }
  }

  // ── (d) REGISTRY-NAME BRIDGE — getAll() display names + alias sets (NEW GAP) ──
  // Mirrors the catalog-derived alias index KnownSystems maintains: match the
  // query against each entry's display name AND every derived alias (Rigil
  // Kentaurus / Toliman / Proxima → Alpha Centauri). A registry hit resolves to
  // the entry's own position; warp arrival then applies the authored/merged
  // system via the known-system override (position + name), so no spectral type
  // is carried.
  const registrySeen = new Set();
  for (const ks of knownSystems.getAll()) {
    let matchedAlias = null;
    if (ks.name && ks.name.toLowerCase().includes(q)) {
      matchedAlias = ks.name;
    } else if (ks.aliases) {
      for (const alias of ks.aliases) {
        if (alias && alias.toLowerCase().includes(q)) { matchedAlias = alias; break; }
      }
    }
    if (matchedAlias && !registrySeen.has(ks.name)) {
      registrySeen.add(ks.name);
      const pos = ks.position || { x: 0, y: 0, z: 0 };
      registry.push({
        name: ks.name,
        worldPos: { x: pos.x, y: pos.y || 0, z: pos.z || 0 },
        seed: seedFromPos(pos.x, pos.y || 0, pos.z || 0),
        kind: 'registry',
        type: undefined,
        key: ks.name,
        matchedAlias,
      });
    }
  }

  // ── (b) NAMED SYSTEMS — player-centered box, substring on name (NEW GAP) ──
  if (playerPos) {
    const box = bounds || neighborhoodBounds(playerPos);
    const entries = enumerateNamedSystems(box);
    for (const entry of entries) {
      if (entry.name && entry.name.toLowerCase().includes(q)) {
        const pos = entry.position;
        named.push({
          name: entry.name,
          worldPos: { x: pos.x, y: pos.y, z: pos.z },
          seed: seedFromPos(pos.x, pos.y, pos.z),
          kind: 'named',
          type: entry.region,
          key: entry.key,
          region: entry.region,
        });
        if (named.length >= NAMED_CAP) break;
      }
    }
  }

  // ── (c) STRUCTURES — globulars then KnownObjectProfiles (mirror DebugPanel.js:604-634) ──
  const featureCatalog = realFeatureCatalog;
  if (featureCatalog?.loaded) {
    for (const gc of featureCatalog.globularClusters) {
      const nameHit = gc.name && gc.name.toLowerCase().includes(q);
      const idHit = gc.harrisId && gc.harrisId.toLowerCase().includes(q);
      if (nameHit || idHit) {
        const pos = gc.position;
        structures.push({
          name: gc.name || gc.harrisId,
          worldPos: { x: pos.x, y: pos.y, z: pos.z },
          seed: seedFromPos(pos.x, pos.y, pos.z),
          kind: 'structure',
          type: gc.type || 'globular-cluster',
          key: gc.harrisId,
          harrisId: gc.harrisId,
          radius: gc.radius,
        });
        if (structures.length >= STRUCTURE_CAP) break;
      }
    }
  }

  // KnownObjectProfiles (Messier/NGC deep-sky), deduped against globulars by name
  // (mirror DebugPanel.js:621-622).
  for (const km of searchKnownObjects(q)) {
    if (structures.length >= STRUCTURE_CAP) break;
    const isDup = structures.some(s => s.name?.toLowerCase() === km.profile.name.toLowerCase());
    if (isDup) continue;
    const pos = km.profile.galacticPos;
    structures.push({
      name: km.profile.name,
      worldPos: { x: pos.x, y: pos.y, z: pos.z },
      seed: seedFromPos(pos.x, pos.y, pos.z),
      kind: 'structure',
      type: km.profile.type,
      key: km.key,
      radius: km.profile.radius,
    });
  }

  // Merge order: stars, registry, named, structures (most-specific identity
  // first). Slice to the overall limit.
  return [...stars, ...registry, ...named, ...structures].slice(0, limit);
}

/**
 * Shape a SearchResult into the nav-star object `main.js._setWarpTargetFromNavStar`
 * consumes (main.js:2939-2979 → `warpTarget.navStarData`). Field names match
 * exactly what that function reads and what `NavComputer.getSelectedStar()`
 * returns: `{ worldX, worldY, worldZ, seed, name, type }`.
 *
 * `type` is carried ONLY from `starType` (spectral class, star hits) so warp
 * arrival's `starTypeOverride` (main.js:3540-3542) gets a valid spectral class;
 * for named/structure/registry hits `type` is undefined so procgen or the
 * known-system override decides the star type. This function ONLY shapes data —
 * it never touches `window._warpTarget`.
 *
 * @param {SearchResult} result
 * @returns {{worldX:number,worldY:number,worldZ:number,seed:number,name:string,type:(string|undefined)}}
 */
export function toNavStar(result) {
  return {
    worldX: result.worldPos.x,
    worldY: result.worldPos.y,
    worldZ: result.worldPos.z,
    seed: result.seed,
    name: result.name,
    type: result.starType,
  };
}
