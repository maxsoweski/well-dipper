import { SeededRandom } from './SeededRandom.js';

/**
 * GalacticMap — the structural/navigational galaxy that the player lives inside.
 *
 * NOT the same as GalaxyGenerator.js, which renders visual galaxy particles
 * for deep-sky objects (what you see when you warp to a distant galaxy).
 * GalacticMap is the galaxy you're IN — it determines where stars are,
 * what properties they have, and what you encounter as you warp around.
 *
 * Architecture:
 *   Master seed → galaxy parameters (arms, bulge, disk)
 *   Galaxy → sectors (0.5 kpc cubes, cached with LRU)
 *   Sector → stars (5-30 per sector, positioned and seeded)
 *   Star → system seed + galaxy context (metallicity, age, star-type weights)
 *
 * The galaxy is deterministic: same master seed → same galaxy, always.
 * Same star at same position → same system, always.
 *
 * Science basis: see docs/RESEARCH_star-population-synthesis.md and
 * docs/RESEARCH_galaxy-generation.md
 *
 * See docs/GAME_BIBLE.md §12 for design context.
 */
export class GalacticMap {

  // ── Galaxy structure constants ──
  // Milky Way-inspired defaults. Could be seed-varied for different galaxies.
  static SECTOR_SIZE = 0.5;           // kpc per sector cube edge
  static MAX_STARS_PER_SECTOR = 30;   // cap for densest regions
  static MAX_CACHED_SECTORS = 64;     // LRU cache size

  // Disk geometry
  static DISK_SCALE_LENGTH = 2.6;     // kpc (radial exponential decay)
  static THIN_DISK_HEIGHT = 0.3;      // kpc (scale height)
  static THICK_DISK_HEIGHT = 0.9;     // kpc
  static THICK_DISK_NORM = 0.12;      // relative to thin disk

  // Bulge
  static BULGE_SCALE = 0.5;           // kpc (effective radius)
  static BULGE_FLATTENING = 0.5;      // axis ratio (oblate)
  static BULGE_NORM = 2.0;            // normalization

  // Halo
  static HALO_NORM = 0.005;           // very sparse
  static HALO_POWER = -3.5;           // power-law exponent
  static HALO_REF_RADIUS = 8.0;      // kpc (normalization radius)

  // Spiral arms
  static NUM_ARMS = 4;
  static ARM_PITCH_DEG = 12;
  static ARM_WIDTH = 0.6;             // kpc (half-width of Gaussian profile)
  static ARM_DENSITY_BOOST = 1.8;     // multiplier on disk density in arms

  // Navigable range
  static GALAXY_RADIUS = 15;          // kpc (visible disk)
  static GALAXY_HEIGHT = 3;           // kpc above/below plane

  // Player start (solar neighborhood)
  static SOLAR_R = 8.0;              // kpc from center
  static SOLAR_Z = 0.025;            // kpc above plane

  constructor(masterSeed = 'well-dipper-galaxy-1') {
    this.masterSeed = masterSeed;
    this.rng = new SeededRandom(masterSeed);

    // Galaxy-level parameters (could be varied per seed for different galaxies)
    this.numArms = GalacticMap.NUM_ARMS;
    this.pitchAngle = GalacticMap.ARM_PITCH_DEG * Math.PI / 180;
    this.pitchK = 1.0 / Math.tan(this.pitchAngle);

    // Arm starting angles (evenly spaced + small per-seed offsets)
    this.armOffsets = [];
    for (let i = 0; i < this.numArms; i++) {
      this.armOffsets.push(
        (i * 2 * Math.PI / this.numArms) + this.rng.range(-0.1, 0.1)
      );
    }

    // Sector cache (LRU)
    this._sectorCache = new Map();
  }

  // ════════════════════════════════════════════════════════════
  // HASHING — deterministic integer hash for sector/star seeds
  // ════════════════════════════════════════════════════════════

  /**
   * Splitmix64-inspired 32-bit integer hash.
   * Combines two seeds into a single deterministic value.
   */
  static hashCombine(a, b) {
    let h = (a * 2654435761) ^ (b * 2246822519);
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
    h = Math.imul(h ^ (h >>> 13), 0x45d9f3b);
    h = (h ^ (h >>> 16)) >>> 0;
    return h;
  }

  /**
   * Derive a deterministic string seed for a sector from its grid coordinates.
   */
  sectorSeed(sx, sy, sz) {
    const h1 = GalacticMap.hashCombine(sx + 10000, sy + 10000);
    const h2 = GalacticMap.hashCombine(h1, sz + 10000);
    return this.masterSeed + '-sector-' + h2;
  }

  // ════════════════════════════════════════════════════════════
  // DENSITY MODEL — where stars are in the galaxy
  // ════════════════════════════════════════════════════════════

  /**
   * Galactic component densities at a given position.
   * Returns normalized weights (sum to 1) + total density.
   *
   * Based on Bland-Hawthorn & Gerhard 2016.
   * See RESEARCH_star-population-synthesis.md §6.
   *
   * @param {number} R_kpc - cylindrical radius from center
   * @param {number} z_kpc - height above/below disk plane
   * @returns {{ thin, thick, bulge, halo, totalDensity }}
   */
  componentDensities(R_kpc, z_kpc) {
    const absZ = Math.abs(z_kpc);

    // Thin disk: exponential in R and z
    const thin = Math.exp(-R_kpc / GalacticMap.DISK_SCALE_LENGTH)
               * Math.exp(-absZ / GalacticMap.THIN_DISK_HEIGHT);

    // Thick disk: broader, 12% normalization
    const thick = GalacticMap.THICK_DISK_NORM
                * Math.exp(-R_kpc / 3.6)
                * Math.exp(-absZ / GalacticMap.THICK_DISK_HEIGHT);

    // Bulge: flattened exponential
    const rBulge = Math.sqrt(R_kpc * R_kpc + (z_kpc / GalacticMap.BULGE_FLATTENING) ** 2);
    const bulge = GalacticMap.BULGE_NORM * Math.exp(-rBulge / GalacticMap.BULGE_SCALE);

    // Halo: power law with floor to prevent explosion at center
    // (bulge dominates the center, not the halo)
    const rHalo = Math.sqrt(R_kpc * R_kpc + z_kpc * z_kpc);
    const halo = GalacticMap.HALO_NORM
               * Math.pow(Math.max(rHalo, 2.0) / GalacticMap.HALO_REF_RADIUS, GalacticMap.HALO_POWER);

    const total = thin + thick + bulge + halo;
    if (total < 1e-10) {
      return { thin: 0.25, thick: 0.25, bulge: 0.25, halo: 0.25, totalDensity: 0 };
    }

    return {
      thin: thin / total,
      thick: thick / total,
      bulge: bulge / total,
      halo: halo / total,
      totalDensity: total,
    };
  }

  /**
   * How strongly a position is inside a spiral arm (0 = inter-arm, 1 = arm center).
   * Uses logarithmic spiral model with Gaussian cross-section.
   *
   * See RESEARCH_star-population-synthesis.md §6.
   *
   * @param {number} R_kpc - cylindrical radius
   * @param {number} theta_rad - angle in disk plane
   * @returns {number} 0 to 1
   */
  spiralArmStrength(R_kpc, theta_rad) {
    if (R_kpc < 0.5) return 0; // No arms in the very center (bulge dominates)

    let maxStrength = 0;
    for (let arm = 0; arm < this.numArms; arm++) {
      // Expected angle at this radius for this arm
      const expectedTheta = this.armOffsets[arm] + this.pitchK * Math.log(R_kpc / 4.0);
      // Angular distance (wrapped to [-pi, pi])
      let dTheta = ((theta_rad - expectedTheta) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
      // Convert to linear distance in kpc
      const dist = Math.abs(dTheta) * R_kpc;
      // Gaussian profile
      const strength = Math.exp(-0.5 * (dist / GalacticMap.ARM_WIDTH) ** 2);
      if (strength > maxStrength) maxStrength = strength;
    }
    return maxStrength;
  }

  // ════════════════════════════════════════════════════════════
  // SECTOR GENERATION — deterministic star placement
  // ════════════════════════════════════════════════════════════

  /**
   * Convert world coordinates to sector grid indices.
   */
  worldToSector(x, y, z) {
    const S = GalacticMap.SECTOR_SIZE;
    return {
      sx: Math.floor(x / S),
      sy: Math.floor(y / S),
      sz: Math.floor(z / S),
    };
  }

  /**
   * Get the sector key string for cache lookup.
   */
  getSectorKey(sx, sy, sz) {
    return `${sx},${sy},${sz}`;
  }

  /**
   * Generate or retrieve a sector from cache.
   * A sector is a 0.5 kpc cube containing 0-30 stars.
   *
   * @param {number} sx - sector grid X
   * @param {number} sy - sector grid Y
   * @param {number} sz - sector grid Z
   * @returns {{ key, stars: Array, deepSkyObjects: Array }}
   */
  getSector(sx, sy, sz) {
    const key = this.getSectorKey(sx, sy, sz);

    // Check cache
    if (this._sectorCache.has(key)) {
      const sector = this._sectorCache.get(key);
      // Move to end (most recently used)
      this._sectorCache.delete(key);
      this._sectorCache.set(key, sector);
      return sector;
    }

    // Generate
    const sector = this._generateSector(sx, sy, sz);

    // Cache with LRU eviction
    this._sectorCache.set(key, sector);
    if (this._sectorCache.size > GalacticMap.MAX_CACHED_SECTORS) {
      // Delete oldest (first key in Map iteration order)
      const oldestKey = this._sectorCache.keys().next().value;
      this._sectorCache.delete(oldestKey);
    }

    return sector;
  }

  /**
   * Internal: generate a new sector.
   */
  _generateSector(sx, sy, sz) {
    const S = GalacticMap.SECTOR_SIZE;
    const seed = this.sectorSeed(sx, sy, sz);
    const rng = new SeededRandom(seed);

    // Sector center in world coordinates
    const centerX = (sx + 0.5) * S;
    const centerY = (sy + 0.5) * S;
    const centerZ = (sz + 0.5) * S;

    // Density at sector center (cylindrical coords)
    const R = Math.sqrt(centerX * centerX + centerZ * centerZ);
    const theta = Math.atan2(centerZ, centerX);
    const densities = this.componentDensities(R, centerY);
    const armStr = this.spiralArmStrength(R, theta);

    // Star count: normalize density relative to solar neighborhood,
    // then scale to a target count. Solar neighborhood (~0.06 density)
    // should yield ~8-15 stars per sector for interesting navigation.
    const solarDensity = 0.065; // approximate density at R=8, z=0
    const normalizedDensity = densities.totalDensity / solarDensity;
    const targetAtSolar = 12; // stars per sector in solar neighborhood
    const densityWithArms = normalizedDensity * (1 + armStr * GalacticMap.ARM_DENSITY_BOOST);
    const starCount = Math.min(
      Math.max(Math.round(densityWithArms * targetAtSolar), 0),
      GalacticMap.MAX_STARS_PER_SECTOR,
    );

    // Place stars
    const stars = [];
    for (let i = 0; i < starCount; i++) {
      const localX = rng.range(0, S);
      const localY = rng.range(0, S);
      const localZ = rng.range(0, S);
      const worldX = sx * S + localX;
      const worldY = sy * S + localY;
      const worldZ = sz * S + localZ;

      // Each star gets a unique seed derived from sector + index
      const starSeed = GalacticMap.hashCombine(
        GalacticMap.hashCombine(sx + 10000, sy + 10000),
        GalacticMap.hashCombine(sz + 10000, i),
      );

      stars.push({
        localX, localY, localZ,
        worldX, worldY, worldZ,
        seed: starSeed,
        index: i,
      });
    }

    // Deep sky objects (future — Phase 4)
    const deepSkyObjects = [];

    return {
      key: this.getSectorKey(sx, sy, sz),
      sx, sy, sz,
      stars,
      deepSkyObjects,
      armStrength: armStr,
      densities,
    };
  }

  // ════════════════════════════════════════════════════════════
  // GALAXY CONTEXT — derive star properties from position
  // ════════════════════════════════════════════════════════════

  /**
   * Derive the full galaxy context for a position.
   * This is what gets passed to StarSystemGenerator.generate().
   *
   * @param {{ x, y, z }} position - world coords in kpc
   * @returns {GalaxyContext}
   */
  deriveGalaxyContext(position) {
    const { x, y, z } = position;
    const R = Math.sqrt(x * x + z * z);
    const theta = Math.atan2(z, x);

    const densities = this.componentDensities(R, y);
    const armStr = this.spiralArmStrength(R, theta);

    // Pick dominant component
    const componentEntries = [
      ['thin', densities.thin],
      ['thick', densities.thick],
      ['bulge', densities.bulge],
      ['halo', densities.halo],
    ];
    componentEntries.sort((a, b) => b[1] - a[1]);
    const component = componentEntries[0][0];

    // Use a position-derived RNG for scatter
    const contextRng = new SeededRandom(`ctx-${x.toFixed(4)}-${y.toFixed(4)}-${z.toFixed(4)}`);

    const metallicity = this._deriveMetallicity(contextRng, component, R, y);
    const age = this._deriveAge(contextRng, component, armStr);
    const starWeights = this._deriveStarWeights(component, armStr);
    const binaryMod = this._deriveBinaryModifier(component);

    return {
      component,
      componentWeights: { ...densities },
      spiralArmStrength: armStr,
      metallicity,
      age,
      starWeights,
      binaryModifier: binaryMod,
      starDensity: densities.totalDensity,
      R_kpc: R,
      z_kpc: y,
      theta_rad: theta,
      position: { x, y, z },
    };
  }

  /**
   * Metallicity from galactic position.
   * Disk: radial + vertical gradient. Bulge: bimodal. Halo: low.
   *
   * See RESEARCH_star-population-synthesis.md §3.
   */
  _deriveMetallicity(rng, component, R_kpc, z_kpc) {
    let mean, sigma;

    switch (component) {
      case 'thin':
        // Radial gradient: -0.06 dex/kpc from solar position
        // Vertical gradient: -0.3 dex/kpc from plane
        mean = -0.06 * (R_kpc - 8.0) - 0.3 * Math.abs(z_kpc);
        sigma = 0.18;
        break;
      case 'thick':
        mean = -0.6 - 0.04 * (R_kpc - 8.0);
        sigma = 0.25;
        break;
      case 'bulge':
        // Bimodal: 60% metal-rich, 40% metal-poor
        if (rng.chance(0.6)) {
          mean = 0.3; sigma = 0.2;
        } else {
          mean = -0.3; sigma = 0.3;
        }
        break;
      case 'halo':
        mean = -1.2 - 0.02 * Math.max(0, R_kpc - 15);
        sigma = 0.5;
        break;
      default:
        mean = 0.0; sigma = 0.2;
    }

    return rng.gaussianClamped(mean, sigma, -4.0, 0.5);
  }

  /**
   * Age from galactic component and spiral arm strength.
   *
   * See RESEARCH_star-population-synthesis.md §4.
   */
  _deriveAge(rng, component, armStrength) {
    switch (component) {
      case 'thin':
        // Spiral arms: mostly young
        if (armStrength > 0.5 && rng.chance(0.8)) {
          return rng.gaussianClamped(0.3, 0.3, 0.01, 1.0);
        }
        // General disk: exponential distribution favoring older
        return rng.gaussianClamped(5.0, 3.0, 0.1, 10.0);
      case 'thick':
        return rng.gaussianClamped(10.0, 1.5, 8.0, 13.0);
      case 'bulge':
        // 85% old, 15% young
        if (rng.chance(0.85)) {
          return rng.gaussianClamped(10.0, 1.5, 7.0, 13.0);
        }
        return rng.range(0.1, 5.0);
      case 'halo':
        return rng.gaussianClamped(12.0, 1.0, 10.0, 13.5);
      default:
        return rng.gaussianClamped(4.5, 2.5, 0.1, 12.0);
    }
  }

  /**
   * Adjusted star type weights by galactic component and arm strength.
   * Returns an array matching StarSystemGenerator.STAR_WEIGHTS format.
   *
   * Key rules from research:
   * - Halo/thick disk: no O/B/A (they've all died — too old)
   * - Spiral arms: O/B boosted 5-10x (active star formation)
   * - Bulge: shift toward K/M
   */
  _deriveStarWeights(component, armStrength) {
    // Base cinematic weights (from StarSystemGenerator)
    const base = {
      M: 0.18, K: 0.20, G: 0.20, F: 0.16, A: 0.13, B: 0.08, O: 0.05,
    };

    let weights;

    switch (component) {
      case 'thin':
        weights = { ...base };
        // Boost O/B in spiral arms (star formation regions)
        // Moderate boost — arms have more massive stars but M/K still dominate
        if (armStrength > 0.3) {
          const boost = 1 + armStrength * 3; // up to 4x in arm center
          weights.O *= boost;
          weights.B *= boost;
          weights.A *= (1 + armStrength);
        }
        break;
      case 'thick':
        // Old population: no O/B, very few A, shift to K/M
        weights = { M: 0.40, K: 0.30, G: 0.18, F: 0.10, A: 0.02, B: 0, O: 0 };
        break;
      case 'bulge':
        // Mix: mostly old, some young near center
        weights = { M: 0.38, K: 0.28, G: 0.18, F: 0.10, A: 0.04, B: 0.015, O: 0.005 };
        break;
      case 'halo':
        // Ancient: only long-lived stars survive
        weights = { M: 0.45, K: 0.30, G: 0.18, F: 0.07, A: 0, B: 0, O: 0 };
        break;
      default:
        weights = { ...base };
    }

    // Normalize
    const total = Object.values(weights).reduce((s, v) => s + v, 0);
    const result = [];
    for (const [type, weight] of Object.entries(weights)) {
      result.push({ type, weight: weight / total });
    }
    return result;
  }

  /**
   * Binary star fraction modifier by component.
   * Multiplied with the base binary chance per star type.
   */
  _deriveBinaryModifier(component) {
    const mods = { thin: 1.0, thick: 0.8, halo: 0.8, bulge: 0.65 };
    return mods[component] || 1.0;
  }

  // ════════════════════════════════════════════════════════════
  // NAVIGATION — finding nearby stars
  // ════════════════════════════════════════════════════════════

  /**
   * Find the N nearest stars to a galactic position.
   * Searches a 3x3x3 neighborhood of sectors (27 sectors).
   *
   * @param {{ x, y, z }} position - world coords in kpc
   * @param {number} count - how many to return
   * @returns {Array} sorted by distance, closest first
   */
  findNearestStars(position, count = 20) {
    const { sx, sy, sz } = this.worldToSector(position.x, position.y, position.z);

    const candidates = [];
    // Search 3x3x3 neighborhood
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          const sector = this.getSector(sx + dx, sy + dy, sz + dz);
          for (const star of sector.stars) {
            const distX = star.worldX - position.x;
            const distY = star.worldY - position.y;
            const distZ = star.worldZ - position.z;
            const distSq = distX * distX + distY * distY + distZ * distZ;
            candidates.push({ ...star, distSq });
          }
        }
      }
    }

    // Sort by distance, return top N
    candidates.sort((a, b) => a.distSq - b.distSq);
    return candidates.slice(0, count);
  }

  /**
   * Get the default starting position (solar neighborhood).
   */
  getStartPosition() {
    return {
      x: GalacticMap.SOLAR_R,
      y: GalacticMap.SOLAR_Z,
      z: 0.0,
    };
  }
}
