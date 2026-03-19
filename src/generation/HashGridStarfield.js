import { GalacticMap } from './GalacticMap.js';

/**
 * HashGridStarfield — deterministic hash-grid star generation.
 *
 * Instead of generating and caching star objects in sectors, each point
 * in the galaxy either has a star or doesn't, determined by hashing its
 * grid coordinates against the local gravitational density. No storage
 * needed — stars are computed on demand.
 *
 * Two tiers for different stellar populations:
 *   Tier 1 (coarse, 0.1 kpc): rare bright stars (O/B/A) visible to ~10 kpc
 *   Tier 2 (fine, 0.005 kpc): common dim stars (F/G/K/M) visible to ~0.15 kpc
 *
 * Every star is deterministic: same cell coordinates + same galaxy seed =
 * same star. Each star is a real warp target with a unique seed.
 *
 * The potential field (Φ) determines density. Features (Plummer wells)
 * raise local density → more cells accepted → cluster stars emerge naturally.
 */

// Spectral type data (same as StarfieldGenerator)
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
const TYPES_TIER1 = ['O', 'B', 'A'];
const TYPES_TIER2 = ['F', 'G', 'K', 'M'];
const ALL_TYPES = ['O', 'B', 'A', 'F', 'G', 'K', 'M'];

// Maximum distance (kpc) at which each type is visible (mag < threshold)
function maxVisibleDist(absMag, threshold = 6.5) {
  // m = M + 5*log10(d_pc/10), solve for d_pc: d_pc = 10^((threshold - M)/5) * 10
  const d_pc = Math.pow(10, (threshold - absMag) / 5) * 10;
  return d_pc / 1000; // convert to kpc
}

export class HashGridStarfield {

  // Grid cell sizes per tier
  static TIER1_CELL = 0.1;   // kpc (100 pc) — for O/B/A
  static TIER2_CELL = 0.005; // kpc (5 pc) — for F/G/K/M

  static VISIBILITY_THRESHOLD = 6.5;

  /**
   * Generate all visible stars from a position using the hash grid.
   *
   * @param {GalacticMap} galacticMap
   * @param {{ x, y, z }} playerPos — galactic position in kpc
   * @param {number} skyRadius — sky sphere radius for rendering
   * @returns {{ positions, colors, sizes, count, realStars }}
   */
  static generate(galacticMap, playerPos, skyRadius = 500) {
    const threshold = this.VISIBILITY_THRESHOLD;
    const stars = [];

    // ── Tier 1: Bright stars (O/B/A) on coarse grid ──
    this._searchTier(
      galacticMap, playerPos, stars,
      this.TIER1_CELL, TYPES_TIER1, threshold, 'tier1'
    );

    // ── Tier 2: Dim stars (F/G/K/M) on fine grid ──
    this._searchTier(
      galacticMap, playerPos, stars,
      this.TIER2_CELL, TYPES_TIER2, threshold, 'tier2'
    );

    // ── Build output arrays ──
    const count = stars.length;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const realStars = [];

    for (let i = 0; i < count; i++) {
      const s = stars[i];
      // Direction from player to star on sky sphere
      const dx = s.worldX - playerPos.x;
      const dy = s.worldY - playerPos.y;
      const dz = s.worldZ - playerPos.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist < 0.0001) continue;

      const i3 = i * 3;
      positions[i3]     = (dx / dist) * skyRadius;
      positions[i3 + 1] = (dy / dist) * skyRadius;
      positions[i3 + 2] = (dz / dist) * skyRadius;

      // Color from spectral type × brightness
      const baseCol = SPECTRAL_COLOR[s.type] || [1, 1, 1];
      const brightness = Math.max(0.1, 1.5 - (s.appMag / 5.0));

      // Feature diagnostic coloring
      if (s.featureContext) {
        const fc = s.featureContext;
        if (fc.type === 'globular-cluster') {
          colors[i3]     = brightness * 1.2;
          colors[i3 + 1] = brightness * 0.7;
          colors[i3 + 2] = brightness * 0.2;
        } else if (fc.type === 'open-cluster') {
          colors[i3]     = brightness * 0.5;
          colors[i3 + 1] = brightness * 0.7;
          colors[i3 + 2] = brightness * 1.2;
        } else {
          colors[i3]     = baseCol[0] * brightness;
          colors[i3 + 1] = baseCol[1] * brightness;
          colors[i3 + 2] = baseCol[2] * brightness;
        }
      } else {
        colors[i3]     = baseCol[0] * brightness;
        colors[i3 + 1] = baseCol[1] * brightness;
        colors[i3 + 2] = baseCol[2] * brightness;
      }

      // Size from apparent magnitude
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
          featureContext: s.featureContext || null,
        },
        estimatedType: s.type,
        apparentMagnitude: s.appMag,
      });
    }

    return { positions, colors, sizes, count, realStars };
  }

  /**
   * Search a single tier of the hash grid.
   */
  static _searchTier(galacticMap, playerPos, results, cellSize, allowedTypes, threshold, tierName) {
    const px = playerPos.x, py = playerPos.y, pz = playerPos.z;

    // Cache nearby features ONCE (not per-cell)
    const cachedFeatures = galacticMap.findNearbyFeatures(playerPos, 12.0);

    // Grid coordinates of player
    const gcx = Math.floor(px / cellSize);
    const gcy = Math.floor(py / cellSize);
    const gcz = Math.floor(pz / cellSize);

    // Maximum search radius: furthest distance any allowed type is visible
    let maxDist = 0;
    for (const type of allowedTypes) {
      maxDist = Math.max(maxDist, maxVisibleDist(ABS_MAG[type], threshold));
    }
    const maxCells = Math.ceil(maxDist / cellSize);

    // Precompute the galaxy seed hash for this grid tier
    const seedBase = galacticMap.masterSeed.length + (tierName === 'tier1' ? 7 : 13);

    // Shell-based search with magnitude pre-filtering
    for (let r = 0; r <= maxCells; r++) {
      // Distance of this shell from player (minimum)
      const shellDist = Math.max(0, (r - 1)) * cellSize;

      // Can ANY allowed type be visible at this distance?
      let anyVisible = false;
      for (const type of allowedTypes) {
        const appMag = ABS_MAG[type] + 5 * Math.log10(Math.max(shellDist * 1000, 0.1) / 10);
        if (appMag < threshold + 1) { anyVisible = true; break; }
      }
      if (!anyVisible) break; // No point searching further

      // Iterate cells on the shell surface
      for (let dx = -r; dx <= r; dx++) {
        for (let dy = -r; dy <= r; dy++) {
          for (let dz = -r; dz <= r; dz++) {
            // Only process the outer shell
            if (Math.abs(dx) < r && Math.abs(dy) < r && Math.abs(dz) < r) continue;

            const cx = gcx + dx;
            const cy = gcy + dy;
            const cz = gcz + dz;

            // Cell center world position
            const wx = (cx + 0.5) * cellSize;
            const wy = (cy + 0.5) * cellSize;
            const wz = (cz + 0.5) * cellSize;

            // Quick bounds check
            const R = Math.sqrt(wx * wx + wz * wz);
            if (R > GalacticMap.GALAXY_RADIUS * 1.2) continue;
            if (Math.abs(wy) > GalacticMap.GALAXY_HEIGHT * 2) continue;

            // ── Hash this cell ──
            const h = this._hashCell(cx, cy, cz, seedBase);

            // ── Evaluate density at cell center ──
            const densities = galacticMap.potentialDerivedDensity(R, wy);
            const armStr = galacticMap.spiralArmStrength(R, Math.atan2(wz, wx));
            let totalDensity = densities.totalDensity * (1 + armStr * GalacticMap.ARM_DENSITY_BOOST);

            // Add feature Plummer density (from cached features)
            totalDensity += this._featureDensityCached(cachedFeatures, wx, wy, wz);

            // ── Acceptance test ──
            // Normalize: solar neighborhood density (~0.065) should give ~2% acceptance
            // at tier2 cell size (5pc), ~20% at tier1 cell size (100pc)
            const acceptNorm = tierName === 'tier1' ? 3.0 : 0.15;
            const acceptProb = Math.min(0.95, totalDensity * acceptNorm);
            const hashNorm = (h & 0xFFFF) / 65536;
            if (hashNorm > acceptProb) continue;

            // ── Star exists in this cell ──
            // Determine spectral type from hash + local component
            const comp = densities.bulge > densities.thin && densities.bulge > densities.halo
              ? 'bulge' : densities.halo > densities.thin ? 'halo' : 'thin';
            const type = this._pickType(h, comp, armStr, allowedTypes);

            // Position offset within cell (deterministic from hash)
            const offX = ((h >> 8) & 0xFF) / 255 - 0.5;
            const offY = ((h >> 16) & 0xFF) / 255 - 0.5;
            const offZ = ((h >> 24) & 0xFF) / 255 - 0.5;
            const starX = wx + offX * cellSize;
            const starY = wy + offY * cellSize;
            const starZ = wz + offZ * cellSize;

            // Distance to player
            const sdx = starX - px, sdy = starY - py, sdz = starZ - pz;
            const dist = Math.sqrt(sdx * sdx + sdy * sdy + sdz * sdz);
            if (dist < 0.0001) continue; // skip self

            // Apparent magnitude
            const d_pc = dist * 1000;
            const appMag = ABS_MAG[type] + 5 * Math.log10(d_pc / 10);
            if (appMag > threshold) continue;

            // Feature tagging: only check if feature density was significant
            // (avoids expensive findNearbyFeatures call for every cell)
            let featureContext = null;

            // Star seed from cell hash
            const seed = GalacticMap.hashCombine(h, cx * 31 + cz * 997);

            results.push({
              worldX: starX,
              worldY: starY,
              worldZ: starZ,
              type,
              appMag,
              seed,
              featureContext,
              tier: tierName,
            });
          }
        }
      }
    }
  }

  /**
   * Evaluate feature Plummer density at a point using pre-cached features.
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
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const eps = feat.radius;
      density += mult * Math.pow(1 + (dist * dist) / (eps * eps), -2.5);
    }
    return density;
  }

  /**
   * Deterministic cell hash.
   */
  static _hashCell(cx, cy, cz, seedBase) {
    let h = GalacticMap.hashCombine(cx + 500000, cy + 500000);
    h = GalacticMap.hashCombine(h, cz + 500000);
    h = GalacticMap.hashCombine(h, seedBase);
    return h;
  }

  /**
   * Pick spectral type from hash bits + local component weights.
   */
  static _pickType(hash, component, armStrength, allowedTypes) {
    // Weight distribution by component
    const weights = {};
    if (component === 'halo') {
      Object.assign(weights, { O: 0, B: 0, A: 0, F: 0.07, G: 0.18, K: 0.30, M: 0.45 });
    } else if (component === 'bulge') {
      Object.assign(weights, { O: 0.005, B: 0.015, A: 0.04, F: 0.10, G: 0.18, K: 0.28, M: 0.38 });
    } else if (armStrength > 0.3) {
      const boost = 1 + armStrength * 3;
      Object.assign(weights, { O: 0.05 * boost, B: 0.08 * boost, A: 0.13, F: 0.16, G: 0.20, K: 0.20, M: 0.18 });
    } else {
      Object.assign(weights, { O: 0.05, B: 0.08, A: 0.13, F: 0.16, G: 0.20, K: 0.20, M: 0.18 });
    }

    // Filter to allowed types and normalize
    let total = 0;
    for (const t of allowedTypes) total += (weights[t] || 0);
    if (total < 0.001) return allowedTypes[0];

    const roll = ((hash >> 4) & 0xFFF) / 4096;
    let cumulative = 0;
    for (const t of allowedTypes) {
      cumulative += (weights[t] || 0) / total;
      if (roll < cumulative) return t;
    }
    return allowedTypes[allowedTypes.length - 1];
  }
}
