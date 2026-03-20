import { GalacticMap } from './GalacticMap.js';

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

const ABS_MAG = { O: -5.0, B: -1.5, A: 1.5, F: 3.0, G: 5.0, K: 7.0, M: 10.0 };

const SPECTRAL_COLOR = {
  O: [0.6, 0.7, 1.0],
  B: [0.7, 0.8, 1.0],
  A: [0.95, 0.95, 1.0],
  F: [1.0, 0.95, 0.85],
  G: [1.0, 0.9, 0.7],
  K: [1.0, 0.75, 0.4],
  M: [1.0, 0.5, 0.2],
};

// Per-type configuration: cell size (kpc), max visible distance (kpc),
// acceptance normalization, and the population fraction this type represents.
// Cell sizes are chosen so each type searches ~50 cells radius max → ~500K cells.
const TYPE_CONFIG = {
  O: { cell: 0.100, maxDist: 10.0,  acceptNorm: 0.08,  popFraction: 0.0001 },
  B: { cell: 0.030, maxDist: 2.5,   acceptNorm: 0.15,  popFraction: 0.001 },
  A: { cell: 0.008, maxDist: 0.4,   acceptNorm: 0.25,  popFraction: 0.006 },
  F: { cell: 0.003, maxDist: 0.15,  acceptNorm: 0.4,   popFraction: 0.03 },
  G: { cell: 0.001, maxDist: 0.04,  acceptNorm: 0.6,   popFraction: 0.08 },
  K: { cell: 0.0005, maxDist: 0.012, acceptNorm: 0.8,  popFraction: 0.12 },
  M: { cell: 0.0002, maxDist: 0.003, acceptNorm: 1.0,  popFraction: 0.76 },
};

const ALL_TYPES = ['O', 'B', 'A', 'F', 'G', 'K', 'M'];

export class HashGridStarfield {

  static VISIBILITY_THRESHOLD = 6.5;

  /**
   * Generate all visible stars from a position.
   * @param {GalacticMap} galacticMap
   * @param {{ x, y, z }} playerPos
   * @param {number} skyRadius — sky sphere radius for rendering
   * @returns {{ positions, colors, sizes, count, realStars }}
   */
  static generate(galacticMap, playerPos, skyRadius = 500) {
    const threshold = this.VISIBILITY_THRESHOLD;
    const stars = [];

    // Cache nearby features once (not per-cell)
    const cachedFeatures = galacticMap.findNearbyFeatures(playerPos, 12.0);

    // Search each spectral type independently at its own grid resolution
    for (const type of ALL_TYPES) {
      const cfg = TYPE_CONFIG[type];
      this._searchType(
        galacticMap, playerPos, stars, cachedFeatures,
        type, cfg, threshold
      );
    }

    // ── Build output arrays ──
    const count = stars.length;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const realStars = [];

    for (let i = 0; i < count; i++) {
      const s = stars[i];
      const dx = s.worldX - playerPos.x;
      const dy = s.worldY - playerPos.y;
      const dz = s.worldZ - playerPos.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist < 0.0001) continue;

      const i3 = i * 3;
      positions[i3]     = (dx / dist) * skyRadius;
      positions[i3 + 1] = (dy / dist) * skyRadius;
      positions[i3 + 2] = (dz / dist) * skyRadius;

      // Color from spectral type and brightness — no overrides.
      // Stars inside features look different because the PHYSICS
      // produces different spectral types there (old K/M in globulars,
      // young B/A in open clusters), not because we paint them.
      const baseCol = SPECTRAL_COLOR[s.type] || [1, 1, 1];
      const brightness = Math.max(0.1, 1.5 - (s.appMag / 5.0));
      colors[i3]     = baseCol[0] * brightness;
      colors[i3 + 1] = baseCol[1] * brightness;
      colors[i3 + 2] = baseCol[2] * brightness;

      if (s.appMag < 0) sizes[i] = 10;
      else if (s.appMag < 2) sizes[i] = 8;
      else if (s.appMag < 4) sizes[i] = 6;
      else if (s.appMag < 6) sizes[i] = 4;
      else sizes[i] = 3;

      realStars.push({
        index: i,
        starData: {
          worldX: s.worldX,
          worldY: s.worldY,
          worldZ: s.worldZ,
          seed: s.seed,
          featureContext: s.featureType ? {
            type: s.featureType,
          } : null,
        },
        estimatedType: s.type,
        apparentMagnitude: s.appMag,
      });
    }

    return { positions, colors, sizes, count, realStars };
  }

  /**
   * Search for visible stars of a single spectral type.
   */
  static _searchType(galacticMap, playerPos, results, cachedFeatures, type, cfg, threshold) {
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

            // Evaluate density
            const densities = galacticMap.potentialDerivedDensity(R, wy);
            const armStr = galacticMap.spiralArmStrength(R, Math.atan2(wz, wx));
            let totalDensity = densities.totalDensity * (1 + armStr * GalacticMap.ARM_DENSITY_BOOST);

            // Feature density
            totalDensity += this._featureDensityCached(cachedFeatures, wx, wy, wz);

            // Acceptance test
            const acceptProb = Math.min(0.95, totalDensity * cfg.acceptNorm);
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
            });
          }
        }
      }
    }
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
   * Deterministic cell hash.
   */
  static _hashCell(cx, cy, cz, typeOffset) {
    let h = GalacticMap.hashCombine(cx + 500000, cy + 500000);
    h = GalacticMap.hashCombine(h, cz + 500000);
    h = GalacticMap.hashCombine(h, typeOffset);
    return h;
  }
}
