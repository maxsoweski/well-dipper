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
  /**
   * Compute how many total stars to render based on local galactic density.
   * Dense disk regions get more stars; sparse halo gets fewer.
   * The emptiness of sparse regions IS the visual experience.
   *
   * @param {GalacticMap} galacticMap
   * @param {{ x, y, z }} playerPos
   * @param {number} baseCount — nominal count for average density (solar neighborhood)
   * @returns {number} total star count for this position
   */
  static _computeStarBudget(galacticMap, playerPos, baseCount) {
    const R = Math.sqrt(playerPos.x * playerPos.x + playerPos.z * playerPos.z);
    const absY = Math.abs(playerPos.y);
    const densities = galacticMap.componentDensities(R, playerPos.y);
    // Solar neighborhood (R≈8, y≈0) has totalDensity ≈ 0.05-0.10
    // Galactic center has totalDensity ≈ 2-4
    // Halo (R=4, y=6) has totalDensity ≈ 0.001-0.005
    // Normalize: solar neighborhood density → 1.0
    const solarDensity = 0.07; // approximate at R=8, y=0
    const relativeDensity = densities.totalDensity / solarDensity;

    // Scale star count: sqrt so dense regions don't explode the count
    // min 200 (even deep halo has SOME stars), max 2× baseCount
    const scaled = baseCount * Math.sqrt(Math.min(relativeDensity, 4.0));
    return Math.max(200, Math.min(baseCount * 2, Math.round(scaled)));
  }

  static generate(galacticMap, playerPos, baseCount = 6000, radius = 500) {
    const rng = new SeededRandom(`starfield-${playerPos.x.toFixed(3)}-${playerPos.y.toFixed(3)}-${playerPos.z.toFixed(3)}`);

    // ── Dynamic star count based on local density ──
    // Sparse regions get fewer stars — the emptiness is part of the experience
    const totalCount = this._computeStarBudget(galacticMap, playerPos, baseCount);

    // ── Layer 1: Real nearby stars (all GalacticMap stars within search volume) ──
    // Search wider (up to ~3.5 kpc) to get more real stars.
    // Every found star becomes a real point — no arbitrary cap.
    const _t0 = typeof performance !== 'undefined' ? performance.now() : 0;
    const nearbyStars = galacticMap.findNearestStars(playerPos, 500);
    const _t1 = typeof performance !== 'undefined' ? performance.now() : 0;
    const warpableStars = nearbyStars.filter(s => s.distSq > 0.001);
    // Use all found stars (up to half the budget, to leave room for background)
    const realStarCount = Math.min(warpableStars.length, Math.floor(totalCount * 0.5));
    if (typeof performance !== 'undefined') {
      console.log(`StarfieldGen: findNearestStars(500)=${(_t1-_t0).toFixed(0)}ms, found=${nearbyStars.length}, using=${realStarCount}, totalBudget=${totalCount}`);
    }

    // ── Layer 2: Background star budget ──
    const bgCount = totalCount - realStarCount;

    // ── Allocate arrays ──
    const positions = new Float32Array(totalCount * 3);
    const colors = new Float32Array(totalCount * 3);
    const sizes = new Float32Array(totalCount);

    // Track which starfield indices map to real GalacticMap stars
    const realStarMap = [];

    // ── Place real stars ──
    const _t2 = typeof performance !== 'undefined' ? performance.now() : 0;
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

      // Color based on distance (closer = brighter) and region.
      // Use lightweight density + arm queries instead of full deriveGalaxyContext()
      // which is ~8ms per call (500 calls = 4+ seconds).
      const brightness = Math.min(1.0, 0.5 + 0.5 / (dist * 2));
      const starR = Math.sqrt(star.worldX * star.worldX + star.worldZ * star.worldZ);
      const starTheta = Math.atan2(star.worldZ, star.worldX);
      const densities = galacticMap.componentDensities(starR, star.worldY);
      const armStr = galacticMap.spiralArmStrength(starR, starTheta);
      // Determine dominant component cheaply
      const comp = densities.bulge > densities.thin && densities.bulge > densities.halo ? 'bulge'
        : densities.halo > densities.thin ? 'halo' : 'thin';
      const col = this._starColorFromContext(rng, { spiralArmStrength: armStr, component: comp }, brightness);
      colors[i3]     = col[0];
      colors[i3 + 1] = col[1];
      colors[i3 + 2] = col[2];

      // Real stars are brighter/larger (min 4px for chunky retro look)
      sizes[i] = dist < 0.3 ? 8.0 : dist < 0.5 ? 6.0 : 4.0;

      realStarMap.push({ index: i, starData: star });
    }

    if (typeof performance !== 'undefined') {
      console.log(`StarfieldGen: placeRealStars=${(performance.now()-_t2).toFixed(0)}ms (${realStarCount} stars, ${realStarCount} deriveGalaxyContext calls)`);
    }

    // ── Galactic geometry from player's perspective ──
    const toCenterX = -playerPos.x;
    const toCenterY = -playerPos.y;
    const toCenterZ = -playerPos.z;
    const toCenterDist = Math.sqrt(toCenterX * toCenterX + toCenterY * toCenterY + toCenterZ * toCenterZ);
    const centerDirX = toCenterX / (toCenterDist || 1);
    const centerDirY = toCenterY / (toCenterDist || 1);
    const centerDirZ = toCenterZ / (toCenterDist || 1);

    // ── Arm strength using same model as GalaxyGlow shader ──
    // Narrow arms (0.15 + 0.025*R), sin(pitch)-corrected perpendicular distance
    const ARM_WIDTH_BASE = 0.15;
    const ARM_WIDTH_SLOPE = 0.025;
    const sinPitch = Math.sin(galacticMap.pitchAngle);
    function narrowArmStrength(R, theta) {
      if (R < 0.5) return 0;
      const logR = Math.log(R / 4.0);
      const armWidth = ARM_WIDTH_BASE + ARM_WIDTH_SLOPE * R;
      let maxStr = 0;
      for (let arm = 0; arm < galacticMap.numArms; arm++) {
        const expectedTheta = galacticMap.armOffsets[arm] + galacticMap.pitchK * logR;
        let dTheta = ((theta - expectedTheta) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
        const dist = Math.abs(dTheta) * R * sinPitch;
        const str = Math.exp(-0.5 * (dist / armWidth) ** 2);
        if (str > maxStr) maxStr = str;
      }
      return maxStr;
    }

    // ── Surface density at a point on the galactic plane (y=0) ──
    // Same model as GalaxyGlow shader — used for face-on star placement
    const VISUAL_SCALE_LENGTH = 4.0;
    function surfaceDensity(R, theta) {
      const disk = Math.exp(-R / VISUAL_SCALE_LENGTH);
      const thick = 0.12 * Math.exp(-R / 5.0);
      const bulge = 2.0 * Math.exp(-R / 0.5);
      const base = disk + thick + bulge;
      const armStr = narrowArmStrength(R, theta);
      const bulgeBlend = Math.min(1, Math.max(0, (R - 0.5) / 1.5));
      const armFactor = 1.0 + (0.10 + armStr * 2.40 - 1.0) * bulgeBlend;
      // Smooth edge taper
      const edgeFade = R < 15 * 0.7 ? 1.0 : Math.max(0, 1.0 - (R - 15 * 0.7) / (15 * 0.4));
      return base * armFactor * edgeFade;
    }

    // ── Pre-compute sky density grid ──
    // Uses two methods depending on player height:
    // ABOVE DISK (|y| > 1): face-on projection to galactic plane — gives spiral arm structure
    // IN DISK (|y| < 1): ray march along view directions — gives Milky Way band
    // Transition zone (1-2 kpc): blend between both
    const GRID_THETA = 32;
    const GRID_PHI = 16;
    const skyGrid = new Float32Array(GRID_THETA * GRID_PHI);
    let maxGridDensity = 0;

    const absPlayerHeight = Math.abs(playerPos.y);
    const aboveBlend = Math.min(1, Math.max(0, (absPlayerHeight - 1.0) / 1.0)); // 0 at |y|<1, 1 at |y|>2

    for (let ti = 0; ti < GRID_THETA; ti++) {
      const theta = (ti / GRID_THETA) * Math.PI * 2;
      for (let pi = 0; pi < GRID_PHI; pi++) {
        const phi = ((pi + 0.5) / GRID_PHI) * Math.PI;
        const dirX = Math.sin(phi) * Math.cos(theta);
        const dirY = Math.cos(phi);
        const dirZ = Math.sin(phi) * Math.sin(theta);

        let totalDensity = 0;

        // ── Face-on projection (from above the disk) ──
        if (aboveBlend > 0.01) {
          let faceDensity = 0;
          if (Math.abs(dirY) > 0.01) {
            const t = -playerPos.y / dirY;
            if (t > 0) {
              const hitX = playerPos.x + dirX * t;
              const hitZ = playerPos.z + dirZ * t;
              const R = Math.sqrt(hitX * hitX + hitZ * hitZ);
              if (R <= 15 * 1.1) {
                const hitTheta = Math.atan2(hitZ, hitX);
                faceDensity = surfaceDensity(R, hitTheta);
                // Distance falloff (perspective)
                faceDensity /= (t * 0.05 + 1.0);
              }
            }
          }
          totalDensity += faceDensity * aboveBlend;
        }

        // ── Ray march (from inside the disk) ──
        if (aboveBlend < 0.99) {
          let marchDensity = 0;
          for (const dist of [0.3, 0.8, 1.5, 3.0, 5.0, 8.0, 12.0]) {
            const sampleX = playerPos.x + dirX * dist;
            const sampleY = playerPos.y + dirY * dist;
            const sampleZ = playerPos.z + dirZ * dist;
            const R = Math.sqrt(sampleX * sampleX + sampleZ * sampleZ);
            if (R > 20 || Math.abs(sampleY) > 10) continue;
            const dens = galacticMap.componentDensities(R, sampleY);
            const sampleTheta = Math.atan2(sampleZ, sampleX);
            const armStr = narrowArmStrength(R, sampleTheta);
            const bulgeBlendLocal = Math.min(1, Math.max(0, (R - 0.5) / 1.5));
            const armFactor = 1.0 + (0.10 + armStr * 2.40 - 1.0) * bulgeBlendLocal;
            const distWeight = 1.0 / (dist * 0.4 + 1.0);
            marchDensity += dens.totalDensity * armFactor * distWeight;
          }
          totalDensity += marchDensity * (1.0 - aboveBlend);
        }

        const gridIdx = ti * GRID_PHI + pi;
        skyGrid[gridIdx] = totalDensity;
        if (totalDensity > maxGridDensity) maxGridDensity = totalDensity;
      }
    }

    // Normalize grid to [0, 1]
    if (maxGridDensity > 0) {
      for (let i = 0; i < skyGrid.length; i++) {
        skyGrid[i] /= maxGridDensity;
      }
    }

    // Fast lookup: direction → grid density (bilinear interpolation)
    function lookupDensity(dirX, dirY, dirZ) {
      // Convert direction to continuous grid coordinates
      const theta = Math.atan2(dirZ, dirX);
      const phi = Math.acos(Math.max(-1, Math.min(1, dirY)));
      const tf = ((theta + Math.PI) / (Math.PI * 2)) * GRID_THETA;
      const pf = (phi / Math.PI) * GRID_PHI - 0.5; // center on cell

      // Integer and fractional parts for bilinear interpolation
      const ti0 = Math.floor(tf);
      const pi0 = Math.floor(pf);
      const ft = tf - ti0; // fractional theta
      const fp = pf - pi0; // fractional phi

      // Wrap theta (circular), clamp phi (poles)
      const t0 = ((ti0 % GRID_THETA) + GRID_THETA) % GRID_THETA;
      const t1 = (t0 + 1) % GRID_THETA;
      const p0 = Math.max(0, Math.min(GRID_PHI - 1, pi0));
      const p1 = Math.max(0, Math.min(GRID_PHI - 1, pi0 + 1));

      // Sample 4 corners
      const d00 = skyGrid[t0 * GRID_PHI + p0];
      const d10 = skyGrid[t1 * GRID_PHI + p0];
      const d01 = skyGrid[t0 * GRID_PHI + p1];
      const d11 = skyGrid[t1 * GRID_PHI + p1];

      // Bilinear blend
      return (d00 * (1 - ft) * (1 - fp) +
              d10 * ft * (1 - fp) +
              d01 * (1 - ft) * fp +
              d11 * ft * fp);
    }

    // ── Direct density evaluation per-star (no grid aliasing) ──
    // Evaluates the same density model as the glow shader for each
    // random direction. This ensures stars follow the exact same spiral
    // arm pattern as the glow at full angular resolution.
    function directDensity(dirX, dirY, dirZ) {
      let density = 0;

      if (aboveBlend > 0.01) {
        // Face-on: project to galactic plane
        if (Math.abs(dirY) > 0.01) {
          const t = -playerPos.y / dirY;
          if (t > 0) {
            const hitX = playerPos.x + dirX * t;
            const hitZ = playerPos.z + dirZ * t;
            const R = Math.sqrt(hitX * hitX + hitZ * hitZ);
            if (R <= 15 * 1.1) {
              const hitTheta = Math.atan2(hitZ, hitX);
              let sd = surfaceDensity(R, hitTheta);
              sd /= (t * 0.05 + 1.0);
              density += sd * aboveBlend;
            }
          }
        }
      }

      if (aboveBlend < 0.99) {
        // Ray march from inside
        let marchDensity = 0;
        for (const dist of [0.3, 0.8, 1.5, 3.0, 5.0, 8.0, 12.0]) {
          const sampleX = playerPos.x + dirX * dist;
          const sampleY = playerPos.y + dirY * dist;
          const sampleZ = playerPos.z + dirZ * dist;
          const R = Math.sqrt(sampleX * sampleX + sampleZ * sampleZ);
          if (R > 20 || Math.abs(sampleY) > 10) continue;
          const dens = galacticMap.componentDensities(R, sampleY);
          const sampleTheta = Math.atan2(sampleZ, sampleX);
          const armStr = narrowArmStrength(R, sampleTheta);
          const bulgeBlendLocal = Math.min(1, Math.max(0, (R - 0.5) / 1.5));
          const armFactor = 1.0 + (0.10 + armStr * 2.40 - 1.0) * bulgeBlendLocal;
          const distWeight = 1.0 / (dist * 0.4 + 1.0);
          marchDensity += dens.totalDensity * armFactor * distWeight;
        }
        density += marchDensity * (1.0 - aboveBlend);
      }

      return density;
    }

    // Find max density for normalization (sample 200 directions)
    let maxDirectDensity = 0.001;
    for (let s = 0; s < 200; s++) {
      const th = (s / 200) * Math.PI * 2;
      const ph = Math.acos(1 - 2 * (s + 0.5) / 200);
      const dx = Math.sin(ph) * Math.cos(th);
      const dy = Math.cos(ph);
      const dz = Math.sin(ph) * Math.sin(th);
      const d = directDensity(dx, dy, dz);
      if (d > maxDirectDensity) maxDirectDensity = d;
    }

    // ── Place background stars using direct density evaluation ──
    let placed = 0;
    let attempts = 0;
    const maxAttempts = bgCount * 15;

    while (placed < bgCount && attempts < maxAttempts) {
      attempts++;

      // Random direction on sphere
      const theta = rng.range(0, Math.PI * 2);
      const phi = Math.acos(rng.range(-1, 1));
      const dirX = Math.sin(phi) * Math.cos(theta);
      const dirY = Math.cos(phi);
      const dirZ = Math.sin(phi) * Math.sin(theta);

      const rawDensity = directDensity(dirX, dirY, dirZ);
      const density = rawDensity / maxDirectDensity; // normalize to [0, 1]

      // Accept/reject: minimum 2% chance (sparse halo background)
      const acceptChance = 0.02 + 0.98 * density;
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
      if (sizeRoll < 0.003) sizes[idx] = 8.0;
      else if (sizeRoll < 0.02) sizes[idx] = 6.0;
      else sizes[idx] = 4.0;

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
      sizes[idx] = 3.0;
      placed++;
    }

    return {
      positions,
      colors,
      sizes,
      count: totalCount,
      realStars: realStarMap,
      // Sky density grid for the galactic glow layer
      skyGrid,
      skyGridTheta: GRID_THETA,
      skyGridPhi: GRID_PHI,
      // Galactic geometry for GalaxyGlow shader
      galCenterDir: { x: centerDirX, y: centerDirY, z: centerDirZ },
      playerHeight: Math.abs(playerPos.y),
      playerR: Math.sqrt(playerPos.x * playerPos.x + playerPos.z * playerPos.z),
      // Full player position + arm model params for analytical glow shader
      playerPos: { x: playerPos.x, y: playerPos.y, z: playerPos.z },
      armOffsets: galacticMap.armOffsets.slice(), // copy of the 4 arm starting angles
      armPitchK: galacticMap.pitchK,
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
