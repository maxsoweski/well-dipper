import { GalacticMap } from './GalacticMap.js';
import { starKey, addressOf, boundsOf, slotOf } from './GalaxyGrid.js';

/**
 * HashGridStarfield — realistic-scale deterministic star generation.
 *
 * The galaxy contains ~200 billion stars. Each point in the galaxy either
 * has a star or doesn't, determined by hashing grid coordinates against
 * the local gravitational density. Stars are computed on demand — nothing
 * is stored.
 *
 * Seven tiers, one per spectral type, each with a grid cell size tuned
 * so the search volume contains a manageable number of cells:
 *
 *   O: 100 pc grid, visible to 10 kpc    — rare blue supergiants
 *   B: 30 pc grid, visible to 2.5 kpc    — hot blue giants
 *   A: 8 pc grid, visible to 400 pc      — white main-sequence
 *   F: 3 pc grid, visible to 150 pc      — warm white
 *   G: 1 pc grid, visible to 40 pc       — Sun-like (yellow)
 *   K: 0.5 pc grid, visible to 12 pc     — orange dwarfs
 *   M: 0.2 pc grid, visible to 3 pc      — red dwarfs (most common)
 *
 * Every star is deterministic (same coordinates = same star), warpable,
 * and has a unique seed for system generation. The gravitational potential
 * field determines density — features (Plummer wells) raise local density
 * naturally.
 */

// Absolute magnitudes — main-sequence dwarfs AND evolved giants.
// Evolved stars (Kg, Gg, Mg) have evolved off the main sequence:
// same spectral color but 100-10,000x brighter. They make old
// populations (globular clusters, bulge) visible from far away.
const ABS_MAG = {
  O: -5.0, B: -1.5, A: 1.5, F: 3.0, G: 5.0, K: 7.0, M: 10.0,
  // Evolved tiers — same colors, much brighter
  Kg: -0.5,  // K-type red giant (RGB tip, ~200 L☉)
  Gg: 0.5,   // G-type giant (red clump / horizontal branch, ~50 L☉)
  Mg: -0.2,  // M-type AGB star (~300 L☉)
};

const SPECTRAL_COLOR = {
  O: [0.6, 0.7, 1.0],
  B: [0.7, 0.8, 1.0],
  A: [0.95, 0.95, 1.0],
  F: [1.0, 0.95, 0.85],
  G: [1.0, 0.9, 0.7],
  K: [1.0, 0.75, 0.4],
  M: [1.0, 0.5, 0.2],
  // Evolved stars — same spectral colors as their dwarf counterparts
  Kg: [1.0, 0.65, 0.3],   // orange giant (slightly redder than K dwarf)
  Gg: [1.0, 0.85, 0.5],   // yellow giant
  Mg: [1.0, 0.4, 0.15],   // deep red AGB
};

// Per-type configuration: cell size (kpc), max visible distance (kpc),
// acceptance normalization, and the population fraction this type represents.
// Cell sizes are chosen so each type searches ~50 cells radius max → ~500K cells.
//
// Evolved tiers (Kg, Gg, Mg) have low acceptance overall but are boosted
// in old populations (halo, bulge, globular clusters) via age-dependent
// acceptance in _searchType. In a 12 Gyr population, ~1-3% of stars are
// evolved giants, but they contribute 40-60% of the total luminosity.
// Cell sizes calibrated from real Milky Way population data:
// - Total galaxy: ~200 billion stars
// - Solar neighborhood density: ~0.14 stars/pc³
// - Population fractions from real IMF (initial mass function)
//
// Each type's cell size is set so that at solar density (0.14 stars/pc³),
// the correct fraction of that type is produced. The density model then
// naturally scales counts up (galactic center) or down (outer rim).
//
// maxDist is the maximum distance a star of this type is visible from
// (based on absolute magnitude vs visibility threshold of 6.5).
const TYPE_CONFIG = {
  O: { cell: 0.074, maxDist: 2.0,   acceptNorm: 0.08,  popFraction: 0.0000003 },
  B: { cell: 0.0056, maxDist: 0.2,  acceptNorm: 0.15,  popFraction: 0.0013 },
  A: { cell: 0.0033, maxDist: 0.1,  acceptNorm: 0.15,  popFraction: 0.006 },
  F: { cell: 0.0025, maxDist: 0.05, acceptNorm: 0.30,  popFraction: 0.03 },
  G: { cell: 0.0021, maxDist: 0.02, acceptNorm: 0.50,  popFraction: 0.076 },
  K: { cell: 0.0018, maxDist: 0.008, acceptNorm: 0.50, popFraction: 0.121 },
  M: { cell: 0.0011, maxDist: 0.002, acceptNorm: 0.70, popFraction: 0.765 },
  // Evolved giants — rare (~1-3% of old populations) but very bright.
  // Cell sizes kept larger since these are genuinely rare objects.
  // Age-dependent acceptance in _searchType boosts them in old populations.
  Kg: { cell: 0.050, maxDist: 0.25,  acceptNorm: 0.15,  popFraction: 0.002 },
  Gg: { cell: 0.050, maxDist: 0.16,  acceptNorm: 0.12,  popFraction: 0.001 },
  Mg: { cell: 0.060, maxDist: 0.22,  acceptNorm: 0.10,  popFraction: 0.0005 },
};

const ALL_TYPES = ['O', 'B', 'A', 'F', 'G', 'K', 'M', 'Kg', 'Gg', 'Mg'];
const EVOLVED_TYPES = new Set(['Kg', 'Gg', 'Mg']);

// Each tier's cell size, frozen alongside GalaxyGrid (plan §3.3): a star's
// slot number counts cells of this size, so changing one renames that tier.
export const TIER_CELL_KPC = Object.freeze(Object.fromEntries(ALL_TYPES.map(t => [t, TYPE_CONFIG[t].cell])));

// Star identity (plan §3.2, naming-prism-segments AC-1): every star record
// carries `ident` = its generating (tier, cell) slot, taken from the loop that
// made it — NEVER recomputed from position (an offset-byte-255 star sits on
// the next cell's face, so floor(pos / cell) would name the wrong cell) — and
// `key` = starKey(ident). Consumers compare `key`, never the 32-bit seed.
// Keys are stamped after the sort/truncate so dropped stars cost no string.
function stampKeys(results) {
  for (const s of results) s.key = starKey(s.ident);
  return results;
}

// Frame-aligned yield: resume the next work slice at the start of the next
// animation frame so the browser actually PAINTS between slices. Plain
// macrotask yields (scheduler.yield / MessageChannel / setTimeout) don't
// guarantee that — Chrome batches a dozen 8ms slices between paints, which
// measured as ~105ms frames during warp FOLD (2026-06-10). The setTimeout
// race keeps generation from deadlocking where rAF doesn't fire (hidden
// tab, node/vitest).
function yieldToBrowser() {
  return new Promise(resolve => {
    let done = false;
    const fin = () => { if (!done) { done = true; resolve(); } };
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(fin);
      setTimeout(fin, 100);
    } else {
      setTimeout(fin, 0);
    }
  });
}

export class HashGridStarfield {

  static VISIBILITY_THRESHOLD = 6.5;

  /**
   * Generate all visible stars from a position.
   * @param {GalacticMap} galacticMap
   * @param {{ x, y, z }} playerPos
   * @param {number} skyRadius — sky sphere radius for rendering
   * @returns {{ positions, colors, sizes, count, realStars }}
   */
  // Reference to real feature catalog (set from main.js)
  static realFeatureCatalog = null;

  static generate(galacticMap, playerPos, skyRadius = 500) {
    const iter = this._generateIterator(galacticMap, playerPos, skyRadius);
    let r = iter.next();
    while (!r.done) r = iter.next();
    return r.value;
  }

  /**
   * Async variant — yields to the browser on a time budget so frames keep
   * rendering during warp FOLD. The iterator yields whenever more than
   * `pacing.budgetMs` (default 8ms) of grid iteration has elapsed since the
   * last yield; this driver awaits an unclamped macrotask between slices.
   */
  static async generateAsync(galacticMap, playerPos, skyRadius = 500, pacing = null) {
    const iter = this._generateIterator(galacticMap, playerPos, skyRadius, pacing);
    let r = iter.next();
    while (!r.done) {
      await yieldToBrowser();
      r = iter.next();
    }
    return r.value;
  }

  static *_generateIterator(galacticMap, playerPos, skyRadius = 500, pacing = null) {
    const threshold = this.VISIBILITY_THRESHOLD;
    const stars = [];

    // Cache nearby features once (not per-cell).
    // Combines procedural features from GalacticMap with real features
    // from astronomical catalogs (Harris globular clusters, etc.).
    const proceduralFeatures = galacticMap.findNearbyFeatures(playerPos, 1.0);
    const realFeatures = this.realFeatureCatalog?.loaded
      ? this.realFeatureCatalog.findNearby(playerPos, 1.0)
      : [];
    const cachedFeatures = [...proceduralFeatures, ...realFeatures];

    // Search each spectral type independently at its own grid resolution.
    // Delegate to the iterator form so its time-budget yields bubble up —
    // a single type (O-stars at 10 kpc) can otherwise dominate a chunk.
    for (const type of ALL_TYPES) {
      yield;
      const cfg = TYPE_CONFIG[type];
      yield* this._searchTypeIterator(
        galacticMap, playerPos, stars, cachedFeatures,
        type, cfg, threshold, pacing
      );
    }

    // ── Build output arrays ──
    // Allocate at capacity, but compact with a write cursor `w` so skipped
    // near-origin stars don't leave zero-init slots (WU7-5). `count` reports
    // the number of emitted stars, and realStars.index matches the position
    // buffer slot — downstream offsetting (StarfieldGenerator._finalizeFromGridData)
    // and getGalaxyStarForIndex rely on that alignment.
    const capacity = stars.length;
    const positions = new Float32Array(capacity * 3);
    const colors = new Float32Array(capacity * 3);
    const sizes = new Float32Array(capacity);
    const realStars = [];

    let w = 0;
    for (let i = 0; i < capacity; i++) {
      const s = stars[i];
      const dx = s.worldX - playerPos.x;
      const dy = s.worldY - playerPos.y;
      const dz = s.worldZ - playerPos.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist < 0.0001) continue;

      const w3 = w * 3;
      positions[w3]     = (dx / dist) * skyRadius;
      positions[w3 + 1] = (dy / dist) * skyRadius;
      positions[w3 + 2] = (dz / dist) * skyRadius;

      // Color from spectral type and brightness — no overrides.
      // Stars inside features look different because the PHYSICS
      // produces different spectral types there (old K/M in globulars,
      // young B/A in open clusters), not because we paint them.
      const baseCol = SPECTRAL_COLOR[s.type] || [1, 1, 1];
      const brightness = Math.max(0.1, 1.5 - (s.appMag / 5.0));
      colors[w3]     = baseCol[0] * brightness;
      colors[w3 + 1] = baseCol[1] * brightness;
      colors[w3 + 2] = baseCol[2] * brightness;

      if (s.appMag < 0) sizes[w] = 10;
      else if (s.appMag < 2) sizes[w] = 8;
      else if (s.appMag < 4) sizes[w] = 6;
      else if (s.appMag < 6) sizes[w] = 4;
      else sizes[w] = 3;

      realStars.push({
        index: w,
        starData: {
          worldX: s.worldX,
          worldY: s.worldY,
          worldZ: s.worldZ,
          seed: s.seed,
          type: s.type,
          ident: s.ident,
          key: starKey(s.ident),
          featureContext: s.featureType ? {
            type: s.featureType,
          } : null,
        },
        estimatedType: s.type,
        apparentMagnitude: s.appMag,
      });

      w++;
    }

    return { positions, colors, sizes, count: w, realStars };
  }

  /**
   * Search for visible stars of a single spectral type — synchronous wrapper
   * for non-async callers. Drives the generator form to completion.
   */
  static _searchType(galacticMap, playerPos, results, cachedFeatures, type, cfg, threshold) {
    const iter = this._searchTypeIterator(galacticMap, playerPos, results, cachedFeatures, type, cfg, threshold);
    while (!iter.next().done) { /* spin until done */ }
  }

  /**
   * Generator form of _searchType. Yields on a time budget — whenever more
   * than `pacing.budgetMs` has elapsed since the last yield, checked per
   * surface cell — so async callers get frame-rate breathing room even when
   * a single shell costs hundreds of ms (shell surface grows as r²).
   * All star data is written into `results` by reference (iterator's
   * return value is not used — the yields are for pacing only).
   */
  static *_searchTypeIterator(galacticMap, playerPos, results, cachedFeatures, type, cfg, threshold, pacing = null) {
    const budgetMs = pacing?.budgetMs ?? 8;
    const now = pacing?.now ?? (() => performance.now());
    let lastYield = now();
    const px = playerPos.x, py = playerPos.y, pz = playerPos.z;
    const cellSize = cfg.cell;
    const maxDist = cfg.maxDist;

    // Grid coordinates of player
    const gcx = Math.floor(px / cellSize);
    const gcy = Math.floor(py / cellSize);
    const gcz = Math.floor(pz / cellSize);

    const maxCells = Math.ceil(maxDist / cellSize);
    // Cap at 100 cells radius to prevent extreme searches
    const searchRadius = Math.min(maxCells, 100);

    // Seed offset per type so different types don't correlate
    const typeOffset = ALL_TYPES.indexOf(type) * 100003;

    for (let r = 0; r <= searchRadius; r++) {
      // Distance of this shell
      const shellDist = Math.max(0, (r - 1)) * cellSize;

      // Can this type be visible at this distance?
      const d_pc = Math.max(shellDist * 1000, 0.1);
      const bestMag = ABS_MAG[type] + 5 * Math.log10(d_pc / 10);
      if (bestMag > threshold + 1) break;

      // Iterate shell surface
      for (let dx = -r; dx <= r; dx++) {
        for (let dy = -r; dy <= r; dy++) {
          for (let dz = -r; dz <= r; dz++) {
            if (Math.abs(dx) < r && Math.abs(dy) < r && Math.abs(dz) < r) continue;

            if (now() - lastYield >= budgetMs) {
              yield;
              lastYield = now();
            }

            const cx = gcx + dx;
            const cy = gcy + dy;
            const cz = gcz + dz;

            const wx = (cx + 0.5) * cellSize;
            const wy = (cy + 0.5) * cellSize;
            const wz = (cz + 0.5) * cellSize;

            const R = Math.sqrt(wx * wx + wz * wz);
            if (R > GalacticMap.GALAXY_RADIUS * 1.2) continue;
            if (Math.abs(wy) > GalacticMap.GALAXY_HEIGHT * 2) continue;

            // Hash this cell
            const h = this._hashCell(cx, cy, cz, typeOffset);

            // Evaluate density at cell center.
            // theta is passed so density includes spiral arm + bar perturbation
            // from the gravitational potential (Cox & Gomez + Dehnen models).
            const armTheta = Math.atan2(wz, wx || 1e-10);
            const densities = galacticMap.potentialDerivedDensity(R, wy, armTheta);
            // Arm strength is still queried separately for two purposes:
            // 1. starTypeDensityMultiplier uses it to boost O/B fractions in arms
            //    (population effect, independent of density perturbation)
            // 2. nearestArmInfo identifies which arm for major/minor distinction
            const armStr = galacticMap.spiralArmStrength(R, armTheta);
            const armInfo = galacticMap.nearestArmInfo(R, armTheta);
            const typeMultiplier = galacticMap.starTypeDensityMultiplier(type, densities, armStr, armInfo);
            let totalDensity = densities.totalDensity * typeMultiplier;

            // Feature density
            totalDensity += this._featureDensityCached(cachedFeatures, wx, wy, wz);

            // Acceptance test
            let acceptProb = Math.min(1.0, totalDensity * cfg.acceptNorm);

            // Evolved star tiers: acceptance depends on local population age.
            // Old populations (halo, bulge, globular clusters) have more giants.
            // This is physics flowing through the pipeline: the potential model
            // determines component weights → old fraction → giant probability.
            if (EVOLVED_TYPES.has(type)) {
              const haloWeight = densities.halo || 0;
              const bulgeWeight = densities.bulge || 0;
              const oldFraction = haloWeight + bulgeWeight * 0.8;

              // Feature density boost: if near a globular cluster, giants are
              // concentrated there (globulars are packed with evolved stars)
              let featureGiantBoost = 1.0;
              for (const feat of cachedFeatures) {
                if (feat.type !== 'globular-cluster') continue;
                const fdx = wx - feat.position.x, fdy = wy - feat.position.y, fdz = wz - feat.position.z;
                const fdistSq = fdx * fdx + fdy * fdy + fdz * fdz;
                if (fdistSq < feat.radius * feat.radius * 9) { // within 3× radius
                  featureGiantBoost = Math.max(featureGiantBoost, 15.0);
                }
              }

              // Scale acceptance: thin disk (young) = very few giants,
              // halo/bulge (old) = many giants, globular cluster = packed.
              // The 0.1 base ensures SOME giants even in the disk (old disk stars).
              acceptProb *= (0.1 + oldFraction * 5.0) * featureGiantBoost;
              acceptProb = Math.min(1.0, acceptProb);
            }

            const hashNorm = (h & 0xFFFF) / 65536;
            if (hashNorm > acceptProb) continue;

            // Star exists — compute position and magnitude
            const offX = ((h >> 8) & 0xFF) / 255 - 0.5;
            const offY = ((h >> 16) & 0xFF) / 255 - 0.5;
            const offZ = ((h >> 24) & 0xFF) / 255 - 0.5;
            const starX = wx + offX * cellSize;
            const starY = wy + offY * cellSize;
            const starZ = wz + offZ * cellSize;

            const sdx = starX - px, sdy = starY - py, sdz = starZ - pz;
            const dist = Math.sqrt(sdx * sdx + sdy * sdy + sdz * sdz);
            if (dist < 0.0001) continue;

            const appMag = ABS_MAG[type] + 5 * Math.log10(dist * 1000 / 10);
            if (appMag > threshold) continue;

            // Check if inside a feature (cheap: just distance check against cached features)
            let featureType = null;
            for (const feat of cachedFeatures) {
              if (!feat.radius) continue;
              const fdx = starX - feat.position.x;
              const fdy = starY - feat.position.y;
              const fdz = starZ - feat.position.z;
              if (fdx * fdx + fdy * fdy + fdz * fdz < feat.radius * feat.radius) {
                featureType = feat.type;
                break;
              }
            }

            const seed = GalacticMap.hashCombine(h, cx * 31 + cz * 997);

            results.push({
              worldX: starX, worldY: starY, worldZ: starZ,
              type, appMag, seed, featureType,
              ident: { tier: type, cx, cy, cz },
            });
          }
        }
      }
    }
  }

  /**
   * Find all stars within a radius of a position.
   * Used by the nav computer to show navigable stars.
   * Unlike generate(), this ignores visibility thresholds — it returns
   * every star the hash grid produces, regardless of apparent magnitude.
   *
   * @param {GalacticMap} galacticMap
   * @param {{ x, y, z }} center — galactic position in kpc
   * @param {number} radiusKpc — search radius in kpc
   * @param {number} [maxResults=500] — cap on returned stars
   * @returns {Array<{ worldX, worldY, worldZ, seed, type, dist }>}
   */
  static findStarsInRadius(galacticMap, center, radiusKpc, maxResults = 500) {
    const cx = center.x, cy = center.y || 0, cz = center.z || 0;
    const radiusSq = radiusKpc * radiusKpc;
    const results = [];

    // Cache nearby features once
    const proceduralFeatures = galacticMap.findNearbyFeatures(center, Math.max(radiusKpc, 0.5));
    const realFeatures = this.realFeatureCatalog?.loaded
      ? this.realFeatureCatalog.findNearby(center, Math.max(radiusKpc, 0.5))
      : [];
    const cachedFeatures = [...proceduralFeatures, ...realFeatures];

    for (let ti = 0; ti < ALL_TYPES.length; ti++) {
      const type = ALL_TYPES[ti];
      const cfg = TYPE_CONFIG[type];
      const cellSize = cfg.cell;

      const maxCells = Math.ceil(radiusKpc / cellSize);
      // Skip types whose cell grid would be too dense for the search radius.
      // At 100 cells per axis, the cube is 8M cells — upper bound for performance.
      if (maxCells > 100) continue;

      const gcx = Math.floor(cx / cellSize);
      const gcy = Math.floor(cy / cellSize);
      const gcz = Math.floor(cz / cellSize);

      for (let dx = -maxCells; dx <= maxCells; dx++) {
        for (let dy = -maxCells; dy <= maxCells; dy++) {
          for (let dz = -maxCells; dz <= maxCells; dz++) {
            const cellX = gcx + dx;
            const cellY = gcy + dy;
            const cellZ = gcz + dz;

            const wx = (cellX + 0.5) * cellSize;
            const wy = (cellY + 0.5) * cellSize;
            const wz = (cellZ + 0.5) * cellSize;

            // Quick distance check on cell center
            const cdx = wx - cx, cdy = wy - cy, cdz = wz - cz;
            if (cdx * cdx + cdy * cdy + cdz * cdz > radiusSq * 1.5) continue;

            const R = Math.sqrt(wx * wx + wz * wz);
            if (R > GalacticMap.GALAXY_RADIUS * 1.2) continue;

            // Hash + acceptance test (same as _searchType)
            const typeOffset = ti * 100003;
            const h = this._hashCell(cellX, cellY, cellZ, typeOffset);
            const armTheta = Math.atan2(wz, wx || 1e-10);
            const densities = galacticMap.potentialDerivedDensity(R, wy, armTheta);
            const armStr = galacticMap.spiralArmStrength(R, armTheta);
            const armInfo = galacticMap.nearestArmInfo(R, armTheta);
            const typeMultiplier = galacticMap.starTypeDensityMultiplier(type, densities, armStr, armInfo);
            let totalDensity = densities.totalDensity * typeMultiplier;
            totalDensity += this._featureDensityCached(cachedFeatures, wx, wy, wz);

            let acceptProb = Math.min(1.0, totalDensity * cfg.acceptNorm);

            // Evolved star age-dependent acceptance (same as _searchType)
            if (EVOLVED_TYPES.has(type)) {
              const haloWeight = densities.halo || 0;
              const bulgeWeight = densities.bulge || 0;
              const oldFraction = haloWeight + bulgeWeight * 0.8; // match render path (_searchTypeIterator) — WU7-5
              let featureGiantBoost = 1.0;
              for (const feat of cachedFeatures) {
                if (feat.type !== 'globular-cluster') continue;
                const fdx = wx - feat.position.x, fdy = wy - feat.position.y, fdz = wz - feat.position.z;
                if (fdx * fdx + fdy * fdy + fdz * fdz < feat.radius * feat.radius * 9) {
                  featureGiantBoost = Math.max(featureGiantBoost, 15.0);
                }
              }
              acceptProb *= (0.1 + oldFraction * 5.0) * featureGiantBoost;
              acceptProb = Math.min(1.0, acceptProb);
            }

            const hashNorm = (h & 0xFFFF) / 65536;
            if (hashNorm > acceptProb) continue;

            // Star position (same offset logic as _searchType)
            const offX = ((h >> 8) & 0xFF) / 255 - 0.5;
            const offY = ((h >> 16) & 0xFF) / 255 - 0.5;
            const offZ = ((h >> 24) & 0xFF) / 255 - 0.5;
            const starX = wx + offX * cellSize;
            const starY = wy + offY * cellSize;
            const starZ = wz + offZ * cellSize;

            // Precise distance check on actual star position
            const sdx = starX - cx, sdy = starY - cy, sdz = starZ - cz;
            const distSq = sdx * sdx + sdy * sdy + sdz * sdz;
            if (distSq > radiusSq) continue;

            const seed = GalacticMap.hashCombine(h, cellX * 31 + cellZ * 997);

            results.push({
              worldX: starX, worldY: starY, worldZ: starZ,
              seed, type, dist: Math.sqrt(distSq),
              ident: { tier: type, cx: cellX, cy: cellY, cz: cellZ },
            });
          }
        }
      }
    }

    // Sort by distance and truncate
    results.sort((a, b) => a.dist - b.dist);
    if (results.length > maxResults) results.length = maxResults;
    return stampKeys(results);
  }

  /**
   * Find all stars within a cube centered on a position.
   * Used by the nav computer local view — cube matches the visible volume.
   *
   * @param {GalacticMap} galacticMap
   * @param {{ x, y, z }} center — center of cube in kpc
   * @param {number} halfSize — half the cube side length in kpc
   * @param {number} [maxResults=500]
   * @returns {Array<{ worldX, worldY, worldZ, seed, type, dist }>}
   */
  static findStarsInCube(galacticMap, center, halfSize, maxResults = 500) {
    const cx = center.x, cy = center.y || 0, cz = center.z || 0;
    const results = [];

    const proceduralFeatures = galacticMap.findNearbyFeatures(center, Math.max(halfSize * 1.5, 0.5));
    const realFeatures = this.realFeatureCatalog?.loaded
      ? this.realFeatureCatalog.findNearby(center, Math.max(halfSize * 1.5, 0.5))
      : [];
    const cachedFeatures = [...proceduralFeatures, ...realFeatures];

    for (let ti = 0; ti < ALL_TYPES.length; ti++) {
      const type = ALL_TYPES[ti];
      const cfg = TYPE_CONFIG[type];
      const cellSize = cfg.cell;

      const maxCells = Math.ceil(halfSize / cellSize);
      if (maxCells > 200) continue;

      const gcx = Math.floor(cx / cellSize);
      const gcy = Math.floor(cy / cellSize);
      const gcz = Math.floor(cz / cellSize);

      for (let dx = -maxCells; dx <= maxCells; dx++) {
        for (let dy = -maxCells; dy <= maxCells; dy++) {
          for (let dz = -maxCells; dz <= maxCells; dz++) {
            const cellX = gcx + dx;
            const cellY = gcy + dy;
            const cellZ = gcz + dz;

            const wx = (cellX + 0.5) * cellSize;
            const wy = (cellY + 0.5) * cellSize;
            const wz = (cellZ + 0.5) * cellSize;

            // Cube bounds check on cell center
            if (Math.abs(wx - cx) > halfSize * 1.1) continue;
            if (Math.abs(wy - cy) > halfSize * 1.1) continue;
            if (Math.abs(wz - cz) > halfSize * 1.1) continue;

            const R = Math.sqrt(wx * wx + wz * wz);
            if (R > GalacticMap.GALAXY_RADIUS * 1.2) continue;

            const typeOffset = ti * 100003;
            const h = this._hashCell(cellX, cellY, cellZ, typeOffset);
            const armTheta = Math.atan2(wz, wx || 1e-10);
            const densities = galacticMap.potentialDerivedDensity(R, wy, armTheta);
            const armStr = galacticMap.spiralArmStrength(R, armTheta);
            const armInfo = galacticMap.nearestArmInfo(R, armTheta);
            const typeMultiplier = galacticMap.starTypeDensityMultiplier(type, densities, armStr, armInfo);
            let totalDensity = densities.totalDensity * typeMultiplier;
            totalDensity += this._featureDensityCached(cachedFeatures, wx, wy, wz);

            let acceptProb = Math.min(1.0, totalDensity * cfg.acceptNorm);

            if (EVOLVED_TYPES.has(type)) {
              const haloWeight = densities.halo || 0;
              const bulgeWeight = densities.bulge || 0;
              const oldFraction = haloWeight + bulgeWeight * 0.8; // match render path (_searchTypeIterator) — WU7-5
              let featureGiantBoost = 1.0;
              for (const feat of cachedFeatures) {
                if (feat.type !== 'globular-cluster') continue;
                const fdx = wx - feat.position.x, fdy = wy - feat.position.y, fdz = wz - feat.position.z;
                if (fdx * fdx + fdy * fdy + fdz * fdz < feat.radius * feat.radius * 9) {
                  featureGiantBoost = Math.max(featureGiantBoost, 15.0);
                }
              }
              acceptProb *= (0.1 + oldFraction * 5.0) * featureGiantBoost;
              acceptProb = Math.min(1.0, acceptProb);
            }

            const hashNorm = (h & 0xFFFF) / 65536;
            if (hashNorm > acceptProb) continue;

            const offX = ((h >> 8) & 0xFF) / 255 - 0.5;
            const offY = ((h >> 16) & 0xFF) / 255 - 0.5;
            const offZ = ((h >> 24) & 0xFF) / 255 - 0.5;
            const starX = wx + offX * cellSize;
            const starY = wy + offY * cellSize;
            const starZ = wz + offZ * cellSize;

            // Precise cube check on star position
            if (Math.abs(starX - cx) > halfSize) continue;
            if (Math.abs(starY - cy) > halfSize) continue;
            if (Math.abs(starZ - cz) > halfSize) continue;

            const sdx = starX - cx, sdy = starY - cy, sdz = starZ - cz;
            const seed = GalacticMap.hashCombine(h, cellX * 31 + cellZ * 997);

            results.push({
              worldX: starX, worldY: starY, worldZ: starZ,
              seed, type, dist: Math.sqrt(sdx * sdx + sdy * sdy + sdz * sdz),
              ident: { tier: type, cx: cellX, cy: cellY, cz: cellZ },
            });
          }
        }
      }
    }

    results.sort((a, b) => a.dist - b.dist);
    if (results.length > maxResults) results.length = maxResults;
    return stampKeys(results);
  }

  /**
   * Find all stars in a prism: bounded XZ (block edges), tall Y (full disk).
   *
   * @param {GalacticMap} galacticMap
   * @param {{ x, y, z }} center
   * @param {number} xzHalf — half-size in X and Z (kpc)
   * @param {number} yHalf — half-size in Y (kpc), typically much larger
   * @param {number} [maxResults=3000]
   */
  static findStarsInPrism(galacticMap, center, xzHalf, yHalf, maxResults = 3000) {
    // naming-prism-segments AC-6: ONE body for the whole query and for the sliced loader — this is
    // `prismQuery` run to completion in a single call, then sorted and truncated exactly as before,
    // so the Phase 1 regression baselines (identity test) pin both paths at once.
    const q = this.prismQuery(galacticMap, center, xzHalf, yHalf);
    q.step(null);
    const results = q.results;
    results.sort((a, b) => a.dist - b.dist);
    if (results.length > maxResults) results.length = maxResults;
    return results;   // keys were stamped by the query
  }

  /**
   * ⭐ naming-prism-segments AC-6 — the prism query as a RESUMABLE object (plan §8, PHASE0 §7.1).
   *
   * `step(stop)` visits cells until `stop()` returns true (checked every 32 cell visits, ≈ 0.1 ms
   * at ~3 µs per density call in Chrome), saves its cursor (tier, x, y, z) and returns false; call
   * it again to resume exactly where it stopped. `step(null)` runs to the end in one go. It returns
   * true once every cell has been visited; `results` then holds the stars in visiting order, each
   * with `key` stamped (unsorted, untruncated — the caller decides).
   *
   * The per-cell arithmetic is the one `findStarsInPrism` has always used, operation for operation,
   * so a star found by both is the same record.
   *
   * @param {object} [opts]
   * @param {boolean} [opts.extent=false] keep a cell when its star's possible EXTENT reaches the
   *   box, not when its centre is inside 1.1 × the box — the bright-star fix (plan §8 "Bright-star
   *   defect"): an O or giant cell is 50–74 pc, so in a 7.8 pc column its centre is almost never
   *   inside and its star was dropped even when it sat in the box. The generated star is unchanged;
   *   only which cells are visited differs. Off by default so `findStarsInPrism` stays byte-identical.
   *
   * The feature list is gathered on the first `step()` (GalacticMap.findNearbyFeatures around the
   * centre). A sliced caller builds any missing feature regions first, one per slice
   * (`featureRegions()` + GalacticMap.prefetchFeatureRegion), so that call is all cache hits.
   */
  static prismQuery(galacticMap, center, xzHalf, yHalf, opts = {}) {
    return new PrismQuery(this, galacticMap, center, xzHalf, yHalf, opts);
  }

  /**
   * Feature Plummer density from cached feature list.
   */
  static _featureDensityCached(cachedFeatures, wx, wy, wz) {
    let density = 0;
    for (const feat of cachedFeatures) {
      const spec = GalacticMap.FEATURE_TYPES[feat.type];
      if (!spec) continue;
      const mult = spec.contextOverrides.starCountMultiplier || 1;
      if (mult <= 1) continue;
      const dx = wx - feat.position.x;
      const dy = wy - feat.position.y;
      const dz = wz - feat.position.z;
      const distSq = dx * dx + dy * dy + dz * dz;
      const epsSq = feat.radius * feat.radius;
      // Quick skip: if far from feature, Plummer density is negligible
      if (distSq > epsSq * 100) continue;
      density += mult * Math.pow(1 + distSq / epsSq, -2.5);
    }
    return density;
  }

  /**
   * A procedural star's one owner (plan §3.1, §3.3): the box comes from its
   * POSITION (half-open, so a point has exactly one), the slot from its
   * CARRIED ident — counted among every cell of its tier that can place a
   * star in that box, coarse tiers' boundary-touching cells included.
   * @param {{ worldX, worldY, worldZ, ident }} star — a record this class returned
   * @returns {{ address, slot:number, count:number }}
   */
  static ownerOf(star) {
    const address = addressOf(star.worldX, star.worldY, star.worldZ);
    const { slot, count } = slotOf(star.ident, TIER_CELL_KPC[star.ident.tier], boundsOf(address));
    return { address, slot, count };
  }

  /**
   * Deterministic cell hash.
   */
  static _hashCell(cx, cy, cz, typeOffset) {
    let h = GalacticMap.hashCombine(cx + 500000, cy + 500000);
    h = GalacticMap.hashCombine(h, cz + 500000);
    h = GalacticMap.hashCombine(h, typeOffset);
    return h;
  }
}

/**
 * The resumable prism query (see `HashGridStarfield.prismQuery`). Cursor = (tier index, cell x,
 * cell y, cell z); the loop order is the original's (x outer, y, z inner) so `results` comes out in
 * the same order `findStarsInPrism` always produced before its stable sort.
 */
class PrismQuery {
  constructor(HGS, gm, center, xzHalf, yHalf, { extent = false } = {}) {
    this.HGS = HGS; this.gm = gm;
    this.cx = center.x; this.cy = center.y || 0; this.cz = center.z || 0;
    this.center = { x: this.cx, y: this.cy, z: this.cz };
    this.xzHalf = xzHalf; this.yHalf = yHalf; this.extent = !!extent;
    this.featureRadius = Math.max(Math.max(xzHalf, yHalf) * 1.5, 0.5);
    this.features = null;
    this.results = [];
    this.done = false;
    this.cellsVisited = 0;
    // Per-tier cell ranges, fixed up front. Same skip rule as always: a tier with more than 200
    // cells per half-axis is skipped (the guard that drops M dwarfs from very tall queries).
    const pad = this.extent ? 1 : 0;
    this.tiers = [];
    for (let ti = 0; ti < ALL_TYPES.length; ti++) {
      const type = ALL_TYPES[ti];
      const cfg = TYPE_CONFIG[type];
      const cellSize = cfg.cell;
      const xzCells = Math.ceil(xzHalf / cellSize);
      const yCells = Math.ceil(yHalf / cellSize);
      if (xzCells > 200) continue;
      if (yCells > 200) continue;
      const gcx = Math.floor(this.cx / cellSize), gcy = Math.floor(this.cy / cellSize), gcz = Math.floor(this.cz / cellSize);
      this.tiers.push({ ti, type, cfg, cellSize,
        xLo: gcx - xzCells - pad, xHi: gcx + xzCells + pad,
        yLo: gcy - yCells - pad, yHi: gcy + yCells + pad,
        zLo: gcz - xzCells - pad, zHi: gcz + xzCells + pad });
    }
    this.t = 0; this.ix = null; this.iy = 0; this.iz = 0;
  }

  /** The feature-region index triples the first step will read (GalacticMap.featureRegionsAround). */
  featureRegions() {
    return typeof this.gm.featureRegionsAround === 'function' ? this.gm.featureRegionsAround(this.center) : [];
  }

  _gatherFeatures() {
    const HGS = this.HGS;
    const proceduralFeatures = this.gm.findNearbyFeatures(this.center, this.featureRadius);
    const realFeatures = HGS.realFeatureCatalog?.loaded
      ? HGS.realFeatureCatalog.findNearby(this.center, this.featureRadius)
      : [];
    this.features = [...proceduralFeatures, ...realFeatures];
  }

  /** @param {(() => boolean) | null} stop  @returns {boolean} true when the query is complete */
  step(stop) {
    if (this.done) return true;
    if (this.features === null) {
      this._gatherFeatures();
      if (stop !== null && stop()) return false;
    }
    const tiers = this.tiers;
    let n = 0;
    for (; this.t < tiers.length; this.t++, this.ix = null) {
      const T = tiers[this.t];
      if (this.ix === null) { this.ix = T.xLo; this.iy = T.yLo; this.iz = T.zLo; }
      let ix = this.ix, iy = this.iy, iz = this.iz;
      for (; ix <= T.xHi; ix++, iy = T.yLo) {
        for (; iy <= T.yHi; iy++, iz = T.zLo) {
          for (; iz <= T.zHi; iz++) {
            if (stop !== null && (++n & 31) === 0 && stop()) {
              this.ix = ix; this.iy = iy; this.iz = iz;
              return false;
            }
            this.cellsVisited++;
            this._cell(T, ix, iy, iz);
          }
        }
      }
    }
    stampKeys(this.results);
    this.done = true;
    return true;
  }

  // One cell — the original findStarsInPrism body, unchanged arithmetic.
  _cell(T, cellX, cellY, cellZ) {
    const HGS = this.HGS, galacticMap = this.gm, cachedFeatures = this.features;
    const { ti, type, cfg, cellSize } = T;
    const cx = this.cx, cy = this.cy, cz = this.cz, xzHalf = this.xzHalf, yHalf = this.yHalf;

    const wx = (cellX + 0.5) * cellSize;
    const wy = (cellY + 0.5) * cellSize;
    const wz = (cellZ + 0.5) * cellSize;

    if (this.extent) {
      // The star sits within half a cell of the centre (offset bytes 0…255), so this keeps every
      // cell whose star could pass the precise test below, and only those (plus a 1e-12 margin).
      const reach = cellSize * 0.5 + 1e-12;
      if (Math.abs(wx - cx) > xzHalf + reach) return;
      if (Math.abs(wy - cy) > yHalf + reach) return;
      if (Math.abs(wz - cz) > xzHalf + reach) return;
    } else {
      if (Math.abs(wx - cx) > xzHalf * 1.1) return;
      if (Math.abs(wy - cy) > yHalf * 1.1) return;
      if (Math.abs(wz - cz) > xzHalf * 1.1) return;
    }

    const R = Math.sqrt(wx * wx + wz * wz);
    if (R > GalacticMap.GALAXY_RADIUS * 1.2) return;

    const typeOffset = ti * 100003;
    const h = HGS._hashCell(cellX, cellY, cellZ, typeOffset);
    const armTheta = Math.atan2(wz, wx || 1e-10);
    const densities = galacticMap.potentialDerivedDensity(R, wy, armTheta);
    const armStr = galacticMap.spiralArmStrength(R, armTheta);
    const armInfo = galacticMap.nearestArmInfo(R, armTheta);
    const typeMultiplier = galacticMap.starTypeDensityMultiplier(type, densities, armStr, armInfo);
    let totalDensity = densities.totalDensity * typeMultiplier;
    totalDensity += HGS._featureDensityCached(cachedFeatures, wx, wy, wz);

    let acceptProb = Math.min(1.0, totalDensity * cfg.acceptNorm);

    if (EVOLVED_TYPES.has(type)) {
      const haloWeight = densities.halo || 0;
      const bulgeWeight = densities.bulge || 0;
      const oldFraction = haloWeight + bulgeWeight * 0.8; // match render path (_searchTypeIterator) — WU7-5
      let featureGiantBoost = 1.0;
      for (const feat of cachedFeatures) {
        if (feat.type !== 'globular-cluster') continue;
        const fdx = wx - feat.position.x, fdy = wy - feat.position.y, fdz = wz - feat.position.z;
        if (fdx * fdx + fdy * fdy + fdz * fdz < feat.radius * feat.radius * 9) {
          featureGiantBoost = Math.max(featureGiantBoost, 15.0);
        }
      }
      acceptProb *= (0.1 + oldFraction * 5.0) * featureGiantBoost;
      acceptProb = Math.min(1.0, acceptProb);
    }

    const hashNorm = (h & 0xFFFF) / 65536;
    if (hashNorm > acceptProb) return;

    const offX = ((h >> 8) & 0xFF) / 255 - 0.5;
    const offY = ((h >> 16) & 0xFF) / 255 - 0.5;
    const offZ = ((h >> 24) & 0xFF) / 255 - 0.5;
    const starX = wx + offX * cellSize;
    const starY = wy + offY * cellSize;
    const starZ = wz + offZ * cellSize;

    if (Math.abs(starX - cx) > xzHalf) return;
    if (Math.abs(starY - cy) > yHalf) return;
    if (Math.abs(starZ - cz) > xzHalf) return;

    const sdx = starX - cx, sdy = starY - cy, sdz = starZ - cz;
    const seed = GalacticMap.hashCombine(h, cellX * 31 + cellZ * 997);

    this.results.push({
      worldX: starX, worldY: starY, worldZ: starZ,
      seed, type, dist: Math.sqrt(sdx * sdx + sdy * sdy + sdz * sdz),
      ident: { tier: type, cx: cellX, cy: cellY, cz: cellZ },
    });
  }
}
