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

    // Galactic features cache — Level 1 in the generation hierarchy.
    // Features are generated per "feature region" (4 kpc cubes) and cached.
    // Each region contains 0-N positioned features (nebulae, clusters, etc.)
    this._featureRegionCache = new Map();
    this._featureRegionSize = 4.0; // kpc — 8× sector size, covers many sectors
    this._maxFeatureRegions = 32;
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
      // Perpendicular distance to the spiral arm in kpc.
      // The spiral crosses the radial direction at the pitch angle,
      // so perpendicular distance = arc_distance * sin(pitch_angle).
      const sinPitch = Math.sin(this.pitchAngle);
      const dist = Math.abs(dTheta) * R_kpc * sinPitch;
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

    // Galactic features overlapping this sector (Level 1 → Level 2 cascade)
    const overlappingFeatures = this.findFeaturesOverlappingSector(sx, sy, sz);

    // ── Generate additional stars inside features ──
    // Features have their own stellar populations. A globular cluster has
    // thousands of densely packed stars; an open cluster has hundreds.
    // These are real GalacticMap stars — warpable, visible in nav computer.
    for (const feat of overlappingFeatures) {
      const spec = GalacticMap.FEATURE_TYPES[feat.type];
      if (!spec) continue;
      const multiplier = spec.contextOverrides.starCountMultiplier;
      if (!multiplier || multiplier <= 1) continue; // no extra stars for this type

      // How many stars to add for this feature in this sector.
      // Scale by how much of the feature's volume overlaps this sector.
      const featR = feat.radius;
      // Approximate overlap: if feature center is in this sector, full count.
      // If feature center is in adjacent sector, partial count.
      const cx = feat.position.x - sx * S;
      const cy = feat.position.y - sy * S;
      const cz = feat.position.z - sz * S;
      const centerInSector = cx >= 0 && cx < S && cy >= 0 && cy < S && cz >= 0 && cz < S;
      const overlapFraction = centerInSector ? 1.0 : 0.3;

      // Star count based on the feature's own density, NOT sector volume ratio.
      // A globular cluster has ~100K-1M stars in reality; we generate a
      // representative sample that makes the starfield visibly dense.
      // Scale with radius: bigger features = more stars.
      const featureStarBudget = {
        'globular-cluster': 400,  // dense ball
        'open-cluster': 150,      // loose group
        'ob-association': 80,     // scattered giants
        'emission-nebula': 60,    // modest star-forming boost
        'supernova-remnant': 20,  // few extra
      };
      const budget = featureStarBudget[feat.type] || Math.round(multiplier * 30);
      // Scale budget by feature radius relative to typical size
      const typicalRadius = (spec.sizeRange[0] + spec.sizeRange[1]) / 2;
      const radiusScale = Math.max(0.3, Math.min(3.0, featR / typicalRadius));
      const featureStarCount = Math.round(budget * radiusScale * overlapFraction);

      const featRng = new SeededRandom(`${seed}-feat-${feat.seed}`);

      for (let fi = 0; fi < featureStarCount; fi++) {
        // Place stars using the feature's density profile
        let worldX, worldY, worldZ, distFromCenter;

        if (feat.type === 'globular-cluster') {
          // King profile: dense core, sparse halo
          // r = R_feat * pow(random, 0.5) gives r^(-2) density
          const r = featR * Math.sqrt(featRng.float());
          const theta = featRng.range(0, Math.PI * 2);
          const phi = Math.acos(featRng.range(-1, 1));
          worldX = feat.position.x + Math.sin(phi) * Math.cos(theta) * r;
          worldY = feat.position.y + Math.cos(phi) * r;
          worldZ = feat.position.z + Math.sin(phi) * Math.sin(theta) * r;
          distFromCenter = r;
        } else if (feat.type === 'open-cluster') {
          // Gaussian distribution with sub-clumps
          const sigma = featR * 0.4;
          worldX = feat.position.x + featRng.gaussian() * sigma;
          worldY = feat.position.y + featRng.gaussian() * sigma * 0.3; // flattened
          worldZ = feat.position.z + featRng.gaussian() * sigma;
          distFromCenter = Math.sqrt(
            (worldX - feat.position.x) ** 2 +
            (worldY - feat.position.y) ** 2 +
            (worldZ - feat.position.z) ** 2
          );
        } else {
          // Default: uniform within feature radius
          const r = featR * Math.cbrt(featRng.float());
          const theta = featRng.range(0, Math.PI * 2);
          const phi = Math.acos(featRng.range(-1, 1));
          worldX = feat.position.x + Math.sin(phi) * Math.cos(theta) * r;
          worldY = feat.position.y + Math.cos(phi) * r;
          worldZ = feat.position.z + Math.sin(phi) * Math.sin(theta) * r;
          distFromCenter = r;
        }

        // Only include stars that fall within THIS sector's bounds
        const lx = worldX - sx * S;
        const ly = worldY - sy * S;
        const lz = worldZ - sz * S;
        if (lx < 0 || lx >= S || ly < 0 || ly >= S || lz < 0 || lz >= S) continue;

        const starSeed = GalacticMap.hashCombine(
          GalacticMap.hashCombine(sx + 20000, fi),
          GalacticMap.hashCombine(sz + 20000, Math.round(feat.position.x * 1000)),
        );

        stars.push({
          localX: lx, localY: ly, localZ: lz,
          worldX, worldY, worldZ,
          seed: starSeed,
          index: stars.length,
          featureContext: {
            type: feat.type,
            featureSeed: feat.seed,
            metallicity: feat.context.metallicity,
            age: feat.context.age,
            overrides: feat.overrides,
            featureRadius: featR,
            distFromCenter,
          },
        });
      }
    }

    // Mark regular (non-feature) stars that happen to be inside a feature
    for (const star of stars) {
      if (star.featureContext) continue; // already tagged (feature-generated star)
      star.featureContext = null;
      for (const feat of overlappingFeatures) {
        const dx = star.worldX - feat.position.x;
        const dy = star.worldY - feat.position.y;
        const dz = star.worldZ - feat.position.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist < feat.radius) {
          star.featureContext = {
            type: feat.type,
            featureSeed: feat.seed,
            metallicity: feat.context.metallicity,
            age: feat.context.age,
            overrides: feat.overrides,
            featureRadius: feat.radius,
            distFromCenter: dist,
          };
          break;
        }
      }
    }

    return {
      key: this.getSectorKey(sx, sy, sz),
      sx, sy, sz,
      stars,
      features: overlappingFeatures,
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

    let metallicity = this._deriveMetallicity(contextRng, component, R, y);
    let age = this._deriveAge(contextRng, component, armStr);
    let starWeights = this._deriveStarWeights(component, armStr);
    const binaryMod = this._deriveBinaryModifier(component);

    // Check if this position is inside any galactic feature.
    // Uses a small search radius (0.5 kpc) — only catches features we're actually inside.
    // Feature regions are cached, so repeated calls in the same area are fast.
    const nearbyFeatures = this.findNearbyFeatures({ x, y, z }, 0.3);
    let featureContext = null;
    for (const feat of nearbyFeatures) {
      if (feat.insideFeature) {
        featureContext = {
          type: feat.type,
          seed: feat.seed,
          metallicity: feat.context.metallicity,
          age: feat.context.age,
          overrides: feat.overrides,
          radius: feat.radius,
          distance: feat.distance,
        };
        // Override star generation parameters based on feature
        if (feat.overrides.ageMax != null) {
          age = Math.min(age, feat.overrides.ageMax);
        }
        if (feat.overrides.ageOverride != null) {
          age = feat.overrides.ageOverride;
        }
        if (feat.overrides.metallicityOverride != null) {
          metallicity = feat.overrides.metallicityOverride;
        }
        if (feat.overrides.metallicityBoost) {
          metallicity += feat.overrides.metallicityBoost;
        }
        if (feat.overrides.obBoost) {
          // Re-derive star weights with O/B boost
          starWeights = this._deriveStarWeightsWithBoost(component, armStr, feat.overrides.obBoost);
        }
        break; // First feature wins
      }
    }

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
      featureContext,
    };
  }

  /**
   * Derive star weights with an additional O/B boost (for features like nebulae).
   */
  _deriveStarWeightsWithBoost(component, armStrength, obBoost) {
    const weights = this._deriveStarWeights(component, armStrength);
    // Apply additional boost to O and B types
    for (const entry of weights) {
      if (entry.type === 'O' || entry.type === 'B') {
        entry.weight *= obBoost;
      }
    }
    // Renormalize
    const total = weights.reduce((s, e) => s + e.weight, 0);
    for (const entry of weights) {
      entry.weight /= total;
    }
    return weights;
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
  // GALACTIC FEATURES — Level 1 in generation hierarchy
  // Positioned nebulae, clusters, OB associations.
  // Generated per "feature region" (4 kpc cubes), cached like sectors.
  // Features exist at specific positions for specific physical reasons.
  // See GAME_BIBLE.md §12 for full design.
  // ════════════════════════════════════════════════════════════

  /**
   * Feature types with generation parameters.
   * probability: base chance per feature candidate point
   * sizeRange: [min, max] radius in kpc
   * conditions: what galactic context makes this feature possible
   */
  static FEATURE_TYPES = {
    'emission-nebula': {
      sizeRange: [0.03, 0.1],  // 30-100 pc
      color: [0.8, 0.2, 0.1], // H-alpha red
      conditions: (ctx) => ctx.component === 'thin' && ctx.spiralArmStrength > 0.5,
      probability: 0.35,
      contextOverrides: {
        ageMax: 0.05,          // 50 Myr — very young stars
        metallicityBoost: 0.1, // slightly enriched
        obBoost: 3.0,          // O/B stars boosted
      },
    },
    'dark-nebula': {
      sizeRange: [0.005, 0.05],  // 5-50 pc
      color: [0.05, 0.04, 0.03], // absorption (dark)
      conditions: (ctx) => ctx.component === 'thin' && ctx.spiralArmStrength > 0.4,
      probability: 0.25,
      contextOverrides: {
        ageMax: 0.01,           // pre-star-formation
        starCountMultiplier: 0.3, // few stars inside (it's dark for a reason)
      },
    },
    'open-cluster': {
      sizeRange: [0.002, 0.02],  // 2-20 pc
      color: [0.6, 0.7, 1.0],    // hot blue-white stars
      conditions: (ctx) => ctx.component === 'thin' && ctx.spiralArmStrength > 0.3 && ctx.age < 2.0,
      probability: 0.40,
      contextOverrides: {
        starCountMultiplier: 3.0,
        metallicityScatter: 0.02, // tight metallicity (born together)
        ageScatter: 0.01,         // tight age (born together)
      },
    },
    'ob-association': {
      sizeRange: [0.05, 0.3],   // 50-300 pc
      color: [0.5, 0.6, 1.0],   // scattered hot stars
      conditions: (ctx) => ctx.component === 'thin' && ctx.spiralArmStrength > 0.6,
      probability: 0.15,
      contextOverrides: {
        ageMax: 0.03,
        obBoost: 5.0,
      },
    },
    'globular-cluster': {
      sizeRange: [0.01, 0.1],   // 10-100 pc
      color: [1.0, 0.85, 0.5],  // old yellow-orange stars
      conditions: (ctx) => {
        // Halo or bulge, very old
        const isHaloish = ctx.componentWeights.halo > 0.2 || ctx.componentWeights.bulge > 0.3;
        return isHaloish && ctx.age > 8.0;
      },
      probability: 0.08,
      contextOverrides: {
        starCountMultiplier: 10.0, // very dense
        metallicityOverride: -1.5, // very metal poor
        ageOverride: 12.0,
      },
    },
    'supernova-remnant': {
      sizeRange: [0.001, 0.03],  // 1-30 pc
      color: [0.3, 0.8, 0.4],    // oxygen emission green
      conditions: (ctx) => ctx.component === 'thin' && ctx.age > 0.003, // need dead massive stars
      probability: 0.12,
      contextOverrides: {
        centralRemnant: true, // has neutron star or black hole at center
      },
    },
  };

  /**
   * Get feature region grid indices from world coordinates.
   */
  _featureRegionIndices(x, y, z) {
    const S = this._featureRegionSize;
    return {
      rx: Math.floor(x / S),
      ry: Math.floor(y / S),
      rz: Math.floor(z / S),
    };
  }

  /**
   * Get or generate a feature region.
   * @returns {Array} features in this region
   */
  _getFeatureRegion(rx, ry, rz) {
    const key = `fr:${rx},${ry},${rz}`;
    if (this._featureRegionCache.has(key)) {
      const region = this._featureRegionCache.get(key);
      this._featureRegionCache.delete(key);
      this._featureRegionCache.set(key, region);
      return region;
    }

    const features = this._generateFeatureRegion(rx, ry, rz);

    this._featureRegionCache.set(key, features);
    if (this._featureRegionCache.size > this._maxFeatureRegions) {
      const oldestKey = this._featureRegionCache.keys().next().value;
      this._featureRegionCache.delete(oldestKey);
    }

    return features;
  }

  /**
   * Generate features for a region.
   * Samples candidate positions within the region and rolls for feature placement.
   */
  _generateFeatureRegion(rx, ry, rz) {
    const S = this._featureRegionSize;
    const seed = this.masterSeed + `-feat-${rx},${ry},${rz}`;
    const rng = new SeededRandom(seed);

    const features = [];

    // Sample candidate positions in a grid within the region
    // 4 kpc region → 8 candidate points per axis = 512 candidates (most will be rejected)
    const samples = 8;
    const step = S / samples;

    for (let ix = 0; ix < samples; ix++) {
      for (let iy = 0; iy < samples; iy++) {
        for (let iz = 0; iz < samples; iz++) {
          const x = rx * S + (ix + rng.float()) * step;
          const y = ry * S + (iy + rng.float()) * step;
          const z = rz * S + (iz + rng.float()) * step;

          const R = Math.sqrt(x * x + z * z);
          const theta = Math.atan2(z, x);
          if (R > GalacticMap.GALAXY_RADIUS || Math.abs(y) > GalacticMap.GALAXY_HEIGHT) continue;

          const densities = this.componentDensities(R, y);
          const armStr = this.spiralArmStrength(R, theta);

          // Derive context for this candidate position
          const ctxRng = new SeededRandom(`${seed}-ctx-${ix}-${iy}-${iz}`);
          const component = this._dominantComponent(densities);
          const metallicity = this._deriveMetallicity(ctxRng, component, R, y);
          const age = this._deriveAge(ctxRng, component, armStr);

          const ctx = {
            component,
            componentWeights: densities,
            spiralArmStrength: armStr,
            metallicity,
            age,
            totalDensity: densities.totalDensity,
          };

          // Roll for each feature type
          for (const [type, spec] of Object.entries(GalacticMap.FEATURE_TYPES)) {
            if (!spec.conditions(ctx)) continue;

            // Probability scaled by local density (denser regions → more features)
            // Target: ~100-500 features galaxy-wide across all types
            // ~64 feature regions in galactic plane, 512 candidates each
            // Want ~2-8 features per region → perCandidate ≈ 0.005-0.015
            const densityScale = Math.min(densities.totalDensity * 15, 2.0);
            const perCandidateProb = spec.probability * densityScale * 0.02;

            if (!rng.chance(perCandidateProb)) continue;

            const featureRng = rng.child(`${type}-${ix}-${iy}-${iz}`);
            const radius = featureRng.range(...spec.sizeRange);

            features.push({
              type,
              position: { x, y, z },
              radius,
              seed: `${seed}-${type}-${ix}-${iy}-${iz}`,
              color: [...spec.color],
              context: {
                metallicity: spec.contextOverrides.metallicityOverride ?? metallicity + (spec.contextOverrides.metallicityBoost || 0),
                age: spec.contextOverrides.ageOverride ?? Math.min(age, spec.contextOverrides.ageMax || age),
                component,
                armStrength: armStr,
              },
              overrides: spec.contextOverrides,
              // Precomputed for spatial queries
              R_kpc: R,
              z_kpc: y,
            });
          }
        }
      }
    }

    return features;
  }

  /**
   * Get dominant component name from density weights.
   */
  _dominantComponent(densities) {
    const entries = [
      ['thin', densities.thin], ['thick', densities.thick],
      ['bulge', densities.bulge], ['halo', densities.halo],
    ];
    entries.sort((a, b) => b[1] - a[1]);
    return entries[0][0];
  }

  /**
   * Find all galactic features near a position.
   * Searches the 3x3x3 neighborhood of feature regions.
   * @param {{ x, y, z }} position
   * @param {number} maxDistance - max distance in kpc (default 2.0)
   * @returns {Array} features sorted by distance
   */
  findNearbyFeatures(position, maxDistance = 2.0) {
    const { rx, ry, rz } = this._featureRegionIndices(position.x, position.y, position.z);
    const results = [];

    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          const features = this._getFeatureRegion(rx + dx, ry + dy, rz + dz);
          for (const f of features) {
            const distX = f.position.x - position.x;
            const distY = f.position.y - position.y;
            const distZ = f.position.z - position.z;
            const dist = Math.sqrt(distX * distX + distY * distY + distZ * distZ);
            if (dist < maxDistance + f.radius) {
              results.push({ ...f, distance: dist, insideFeature: dist < f.radius });
            }
          }
        }
      }
    }

    results.sort((a, b) => a.distance - b.distance);
    return results;
  }

  /**
   * Find features that overlap a specific sector.
   * Used by _generateSector to determine feature context for stars.
   * @param {number} sx, sy, sz - sector grid coords
   * @returns {Array} overlapping features
   */
  findFeaturesOverlappingSector(sx, sy, sz) {
    const S = GalacticMap.SECTOR_SIZE;
    const centerX = (sx + 0.5) * S;
    const centerY = (sy + 0.5) * S;
    const centerZ = (sz + 0.5) * S;
    // Sector diagonal ≈ 0.5 * √3 ≈ 0.87 kpc
    const sectorDiag = S * Math.sqrt(3) / 2;
    return this.findNearbyFeatures(
      { x: centerX, y: centerY, z: centerZ },
      sectorDiag, // only features that actually overlap
    );
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

    // Search radius scales with requested count:
    // count ≤ 30  → 3x3x3 = 27 sectors (fast, ~1.5 kpc)
    // count ≤ 200 → 5x5x5 = 125 sectors (~2.5 kpc)
    // count > 200 → 7x7x7 = 343 sectors (~3.5 kpc)
    const halfR = count <= 30 ? 1 : count <= 200 ? 2 : 3;

    const candidates = [];
    for (let dx = -halfR; dx <= halfR; dx++) {
      for (let dy = -halfR; dy <= halfR; dy++) {
        for (let dz = -halfR; dz <= halfR; dz++) {
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
   * Get external galaxies visible from this galaxy.
   * These are fixed objects at enormous distances — their sky positions
   * barely change regardless of where you are within the home galaxy.
   * Generated deterministically from the galaxy seed.
   *
   * @returns {Array<{ name, type, direction: {x,y,z}, angularSize, brightness, seed }>}
   */
  getExternalGalaxies() {
    if (this._externalGalaxies) return this._externalGalaxies;

    const rng = new SeededRandom(this.masterSeed + '-external-galaxies');
    const galaxies = [];

    // Generate 5-8 external galaxies at fixed sky positions
    const count = rng.int(5, 8);
    const types = ['spiral', 'elliptical', 'irregular', 'dwarf'];
    const typeWeights = [0.35, 0.30, 0.15, 0.20];

    for (let i = 0; i < count; i++) {
      // Random direction on sphere (fixed per galaxy seed)
      const theta = rng.range(0, Math.PI * 2);
      const phi = Math.acos(rng.range(-1, 1));
      const dirX = Math.sin(phi) * Math.cos(theta);
      const dirY = Math.cos(phi);
      const dirZ = Math.sin(phi) * Math.sin(theta);

      // Avoid the galactic plane (Zone of Avoidance — dust blocks visibility)
      // Re-roll if too close to the disk plane
      if (Math.abs(dirY) < 0.15) continue;

      // Pick type
      let roll = rng.float();
      let type = 'spiral';
      let cumulative = 0;
      for (let t = 0; t < types.length; t++) {
        cumulative += typeWeights[t];
        if (roll < cumulative) { type = types[t]; break; }
      }

      // Angular size: very small (these are millions of light-years away)
      // Largest (Andromeda-equivalent): ~0.02 radians (~1 degree)
      // Most: ~0.003-0.008 radians
      const isLarge = i === 0; // first one is the "Andromeda" — largest
      const angularSize = isLarge
        ? rng.range(0.015, 0.025)
        : rng.range(0.002, 0.008);

      // Brightness: faint smudges
      const brightness = isLarge ? 0.12 : rng.range(0.03, 0.08);

      // Name
      const nameRng = rng.child(`name-${i}`);
      const prefixes = ['NGC', 'IC', 'M', 'UGC', 'PGC'];
      const prefix = nameRng.pick(prefixes);
      const num = nameRng.int(100, 9999);

      galaxies.push({
        name: `${prefix} ${num}`,
        type,
        direction: { x: dirX, y: dirY, z: dirZ },
        angularSize,
        brightness,
        seed: `${this.masterSeed}-extgal-${i}`,
      });
    }

    this._externalGalaxies = galaxies;
    return galaxies;
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
