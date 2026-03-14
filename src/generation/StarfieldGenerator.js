import { SeededRandom } from './SeededRandom.js';

/**
 * StarfieldGenerator — creates galaxy-aware starfield data arrays.
 *
 * Takes a player's galactic position and the GalacticMap, produces
 * position/color/size arrays compatible with Starfield.js.
 *
 * The starfield has two layers:
 * 1. "Real" nearby stars from GalacticMap.findNearestStars() — these are
 *    actual warp targets with deterministic seeds. Placed as specific
 *    bright points on the sky sphere.
 * 2. Background stars density-weighted by sampling GalacticMap along
 *    various sky directions. Creates the galaxy band effect: dense
 *    toward the galactic center/disk plane, sparse above/below.
 *
 * See docs/GAME_BIBLE.md §12 for galaxy-scale design.
 */
export class StarfieldGenerator {

  /**
   * Generate starfield data arrays from a galactic position.
   *
   * @param {GalacticMap} galacticMap - the galaxy data source
   * @param {{ x, y, z }} playerPos - player's galactic position in kpc
   * @param {number} totalCount - total star count for the starfield
   * @param {number} radius - sky sphere radius (scene units)
   * @returns {{ positions, colors, sizes, realStars }}
   *   positions/colors/sizes: Float32Arrays for Starfield constructor
   *   realStars: array of { index, starData } mapping starfield indices to GalacticMap stars
   */
  static generate(galacticMap, playerPos, totalCount = 6000, radius = 500) {
    const rng = new SeededRandom(`starfield-${playerPos.x.toFixed(3)}-${playerPos.y.toFixed(3)}-${playerPos.z.toFixed(3)}`);

    // ── Layer 1: Real nearby stars (warp targets) ──
    const nearbyStars = galacticMap.findNearestStars(playerPos, 30);
    // Skip the very closest star (that's the one we're AT)
    const warpableStars = nearbyStars.filter(s => s.distSq > 0.001);
    const realStarCount = Math.min(warpableStars.length, 25);

    // ── Layer 2: Background star budget ──
    const bgCount = totalCount - realStarCount;

    // ── Allocate arrays ──
    const positions = new Float32Array(totalCount * 3);
    const colors = new Float32Array(totalCount * 3);
    const sizes = new Float32Array(totalCount);

    // Track which starfield indices map to real GalacticMap stars
    const realStarMap = [];

    // ── Place real stars ──
    for (let i = 0; i < realStarCount; i++) {
      const star = warpableStars[i];
      // Direction from player to this star
      const dx = star.worldX - playerPos.x;
      const dy = star.worldY - playerPos.y;
      const dz = star.worldZ - playerPos.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      // Place on sky sphere in that direction
      const i3 = i * 3;
      positions[i3]     = (dx / dist) * radius;
      positions[i3 + 1] = (dy / dist) * radius;
      positions[i3 + 2] = (dz / dist) * radius;

      // Color based on distance (closer = brighter) and region
      const brightness = Math.min(1.0, 0.5 + 0.5 / (dist * 2));
      // Derive rough star color from the galaxy context at that position
      const starCtx = galacticMap.deriveGalaxyContext({ x: star.worldX, y: star.worldY, z: star.worldZ });
      const col = this._starColorFromContext(rng, starCtx, brightness);
      colors[i3]     = col[0];
      colors[i3 + 1] = col[1];
      colors[i3 + 2] = col[2];

      // Real stars are brighter/larger
      sizes[i] = dist < 0.3 ? 6.0 : dist < 0.5 ? 4.0 : 3.0;

      realStarMap.push({ index: i, starData: star });
    }

    // ── Galactic geometry from player's perspective ──
    // The galactic plane is at y=0 in galactic coordinates.
    // The galactic center is at (0, 0, 0).
    const toCenterX = -playerPos.x;
    const toCenterY = -playerPos.y;
    const toCenterZ = -playerPos.z;
    const toCenterDist = Math.sqrt(toCenterX * toCenterX + toCenterY * toCenterY + toCenterZ * toCenterZ);
    const centerDirX = toCenterX / (toCenterDist || 1);
    const centerDirY = toCenterY / (toCenterDist || 1);
    const centerDirZ = toCenterZ / (toCenterDist || 1);

    // Player's R and density at current position (for relative scaling)
    const playerR = Math.sqrt(playerPos.x * playerPos.x + playerPos.z * playerPos.z);
    const localDensity = galacticMap.componentDensities(playerR, playerPos.y);

    // ── Fast density estimation per sky direction ──
    // Instead of expensive ray marching, use a simple geometric model:
    // Density along a direction depends on (a) how close that direction
    // stays to the galactic plane and (b) whether it points toward the
    // galactic center (where density is higher).
    //
    // This is approximate but 100x faster than ray marching and visually
    // produces the right result: a dense band along the disk plane with
    // a bright core toward the center.
    function quickDensity(dirX, dirY, dirZ) {
      // How much this direction aligns with the galactic plane
      // (y=0 is the plane, so |dirY| measures deviation from it)
      const planeFactor = 1.0 - Math.abs(dirY) * 1.5; // 1.0 in plane, negative above
      const planeWeight = Math.max(0, planeFactor);

      // How much this direction points toward the galactic center
      const centerDot = dirX * centerDirX + dirY * centerDirY + dirZ * centerDirZ;
      const centerWeight = Math.max(0, centerDot);

      // Combined: plane alignment + center direction + local density
      // The local density scales everything (sparse halo = sparse skybox)
      const baseDensity = localDensity.totalDensity;
      return (planeWeight * 0.7 + centerWeight * 0.3) * Math.min(baseDensity * 10, 1.0);
    }

    // ── Place background stars using density-weighted distribution ──
    let placed = 0;
    let attempts = 0;
    const maxAttempts = bgCount * 8;

    while (placed < bgCount && attempts < maxAttempts) {
      attempts++;

      // Random direction on sphere
      const theta = rng.range(0, Math.PI * 2);
      const phi = Math.acos(rng.range(-1, 1));
      const dirX = Math.sin(phi) * Math.cos(theta);
      const dirY = Math.sin(phi) * Math.sin(theta);
      const dirZ = Math.cos(phi);

      const density = quickDensity(dirX, dirY, dirZ);

      // Accept/reject: minimum 8% chance to avoid totally empty skies
      const acceptChance = 0.08 + 0.92 * density;
      if (rng.float() > acceptChance) continue;

      const idx = realStarCount + placed;
      const i3 = idx * 3;
      positions[i3]     = dirX * radius;
      positions[i3 + 1] = dirY * radius;
      positions[i3 + 2] = dirZ * radius;

      // Color: density-correlated
      // High density (disk/arms) → mix of warm and blue-white
      // Low density (halo direction) → dim whites
      const col = this._backgroundStarColor(rng, density, dirX, dirY, dirZ, centerDirX, centerDirY, centerDirZ);
      colors[i3]     = col[0];
      colors[i3 + 1] = col[1];
      colors[i3 + 2] = col[2];

      // Size: mostly small, occasional medium
      const sizeRoll = rng.float();
      if (sizeRoll < 0.003) sizes[idx] = 5.0;
      else if (sizeRoll < 0.02) sizes[idx] = 3.0;
      else sizes[idx] = 2.0;

      placed++;
    }

    // If we couldn't fill the budget (very sparse region), fill remainder as dim dots
    while (placed < bgCount) {
      const idx = realStarCount + placed;
      const i3 = idx * 3;
      const theta = rng.range(0, Math.PI * 2);
      const phi = Math.acos(rng.range(-1, 1));
      positions[i3]     = Math.sin(phi) * Math.cos(theta) * radius;
      positions[i3 + 1] = Math.sin(phi) * Math.sin(theta) * radius;
      positions[i3 + 2] = Math.cos(phi) * radius;
      colors[i3] = 0.3; colors[i3 + 1] = 0.3; colors[i3 + 2] = 0.3;
      sizes[idx] = 1.5;
      placed++;
    }

    return {
      positions,
      colors,
      sizes,
      count: totalCount,
      realStars: realStarMap,
    };
  }

  /**
   * Color for a real (warp-target) star based on its galaxy context.
   */
  static _starColorFromContext(rng, ctx, brightness) {
    // Arm = bluer, bulge = warmer, halo = dim white
    const arm = ctx.spiralArmStrength;
    const comp = ctx.component;

    if (comp === 'halo') {
      return [brightness * 0.9, brightness * 0.85, brightness * 0.8]; // Dim warm white
    }
    if (comp === 'bulge') {
      return [brightness, brightness * 0.85, brightness * 0.6]; // Orange-warm
    }
    if (arm > 0.5) {
      // Spiral arm — mix of blue-white and warm
      if (rng.chance(0.3)) {
        return [brightness * 0.7, brightness * 0.8, brightness]; // Blue-white
      }
      return [brightness, brightness * 0.95, brightness * 0.85]; // White
    }
    // General disk
    return [brightness, brightness, brightness * 0.9]; // Slightly warm white
  }

  /**
   * Color for a background (non-warp-target) star.
   * Density factor and direction relative to galactic center influence color.
   */
  static _backgroundStarColor(rng, densityFactor, dirX, dirY, dirZ, centerDirX, centerDirY, centerDirZ) {
    // How much this direction points toward the galactic center
    const centerDot = dirX * centerDirX + dirY * centerDirY + dirZ * centerDirZ;
    const towardCenter = Math.max(0, centerDot);

    // Base brightness: denser directions = brighter stars on average
    const baseBright = 0.3 + densityFactor * 0.5;
    const brightness = baseBright + rng.range(-0.15, 0.15);
    const b = Math.max(0.15, Math.min(1.0, brightness));

    // Color roll
    const roll = rng.float();

    // Toward galactic center: warmer (old bulge stars)
    if (towardCenter > 0.7 && roll < 0.3) {
      return [b, b * 0.8, b * 0.5]; // Warm yellow-orange
    }

    // High density regions: occasional blue (young arm stars)
    if (densityFactor > 0.5 && roll < 0.15) {
      return [b * 0.7, b * 0.8, b]; // Blue-white
    }

    // Occasional tinted stars for variety
    if (roll < 0.05) return [b, b * 0.6, b * 0.4]; // Orange
    if (roll < 0.08) return [b * 0.7, b * 0.8, b]; // Blue
    if (roll < 0.12) return [b, b * 0.95, b * 0.7]; // Warm yellow

    // Default: white with slight warmth
    return [b, b, b * 0.92];
  }
}
