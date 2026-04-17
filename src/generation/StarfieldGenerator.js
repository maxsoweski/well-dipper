import { SeededRandom } from './SeededRandom.js';
import { HashGridStarfield } from './HashGridStarfield.js';

/**
 * StarfieldGenerator — creates galaxy-aware starfield data arrays.
 *
 * Takes a player's galactic position and the GalacticMap, produces
 * position/color/size arrays compatible with Starfield.js.
 *
 * The starfield has two layers:
 * 1. "Real" nearby stars from HashGridStarfield — these are actual warp
 *    targets with deterministic seeds. Placed as specific bright points
 *    on the sky sphere.
 * 2. Background stars density-weighted by sampling GalacticMap along
 *    various sky directions. Creates the galaxy band effect: dense
 *    toward the galactic center/disk plane, sparse above/below.
 *
 * See docs/GAME_BIBLE.md §12 for galaxy-scale design.
 */
export class StarfieldGenerator {

  // Apparent magnitude pipeline — determines which stars are visible.
  // Absolute magnitude: intrinsic brightness (lower = brighter).
  // Apparent magnitude: how bright it looks from distance d.
  //   m = M + 5 × log10(d_pc / 10)
  // Naked-eye visibility threshold: ~6.5 magnitude.
  static SPECTRAL_ABS_MAG = {
    O: -5.0, B: -1.5, A: 1.5, F: 3.0, G: 5.0, K: 7.0, M: 10.0,
  };

  static SPECTRAL_COLOR = {
    O: [0.6, 0.7, 1.0],    // blue-white
    B: [0.7, 0.8, 1.0],    // blue-white
    A: [0.95, 0.95, 1.0],  // white
    F: [1.0, 0.95, 0.85],  // warm white
    G: [1.0, 0.9, 0.7],    // yellow-white
    K: [1.0, 0.75, 0.4],   // orange
    M: [1.0, 0.5, 0.2],    // red-orange
  };

  // Maximum distance (kpc) at which each type is visible (mag < 6.5)
  static SPECTRAL_MAX_DIST_KPC = {
    O: 10.0, B: 2.5, A: 0.4, F: 0.15, G: 0.04, K: 0.012, M: 0.003,
  };

  static VISIBILITY_THRESHOLD = 6.5; // naked-eye magnitude limit

  /**
   * Compute apparent magnitude from spectral type and distance.
   */
  static _apparentMagnitude(spectralType, distKpc) {
    const M = this.SPECTRAL_ABS_MAG[spectralType] ?? 10.0;
    const d_pc = Math.max(distKpc * 1000, 0.1); // parsecs, minimum 0.1 to avoid log(0)
    return M + 5 * Math.log10(d_pc / 10);
  }

  /**
   * Map apparent magnitude to point sprite size (pixels).
   */
  static _sizeFromMagnitude(appMag) {
    if (appMag < 0) return 10;
    if (appMag < 2) return 8;
    if (appMag < 4) return 6;
    if (appMag < 6) return 4;
    return 3;
  }

  /**
   * Map apparent magnitude to brightness multiplier.
   * Bright stars (negative magnitude) get values > 1.0 to ensure
   * they visually dominate. The shader clamps to [0,1] per channel,
   * so bright stars saturate to white — like real bright stars do.
   */
  static _brightnessFromMagnitude(appMag) {
    // Magnitude -5 → brightness 2.5, mag 0 → 1.5, mag 3 → 0.9, mag 6 → 0.15
    return Math.max(0.1, 1.5 - (appMag / 5.0));
  }

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
    const densities = galacticMap.potentialDerivedDensity(R, playerPos.y);
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

  // Reference to the loaded real star catalog (set from main.js)
  static realStarCatalog = null;

  /**
   * Async variant — defers to HashGridStarfield.generateAsync so the
   * 1+ second hash-grid search can be spread across frames. Call this
   * from the warp FOLD phase (via SkyRenderer.prepareForPositionAsync).
   */
  static async generateAsync(galacticMap, playerPos, baseCount = 6000, radius = 500) {
    const gridData = await HashGridStarfield.generateAsync(galacticMap, playerPos, radius);
    return this._finalizeFromGridData(galacticMap, playerPos, baseCount, radius, gridData);
  }

  static generate(galacticMap, playerPos, baseCount = 6000, radius = 500) {
    // ── Hash-grid star generation ──
    // Every visible star is deterministically computed from the gravitational
    // potential field. No sectors, no caching — just the density at each
    // grid point determining whether a star exists there.
    const gridData = HashGridStarfield.generate(galacticMap, playerPos, radius);
    return this._finalizeFromGridData(galacticMap, playerPos, baseCount, radius, gridData);
  }

  /**
   * Finalize starfield data given pre-computed hash-grid data. Runs the
   * lightweight merge/pack work that both sync and async paths share.
   */
  static _finalizeFromGridData(galacticMap, playerPos, baseCount, radius, gridData) {

    // ── Real star overlay ──
    // If the HYG catalog is loaded, find visible real stars and merge them
    // with the hash-grid data. Real stars carry actual names and properties.
    let realOverlay = [];
    if (this.realStarCatalog?.loaded) {
      realOverlay = this.realStarCatalog.findVisible(playerPos, 6.5, radius);
    }

    // Start with the hash-grid stars, then append real stars + features + galaxies
    const realStarCount = gridData.count + realOverlay.length;
    const realStarMap = [...gridData.realStars];

    // ── Layer 3: Nearby galactic features as tagged sky points ──
    const nearbyFeatures = galacticMap.findNearbyFeatures(playerPos, 3.0)
      .filter(f => !f.insideFeature);
    const featureCount = Math.min(nearbyFeatures.length, 16);

    // ── Layer 4: External galaxies ──
    const externalGalaxies = galacticMap.getExternalGalaxies();
    const extGalaxyCount = externalGalaxies.length;

    // ── Merge into combined arrays ──
    const totalMax = realStarCount + featureCount + extGalaxyCount;
    const positions = new Float32Array(totalMax * 3);
    const colors = new Float32Array(totalMax * 3);
    const sizes = new Float32Array(totalMax);

    // Copy hash-grid star data
    const gridCount = gridData.count;
    for (let i = 0; i < gridCount * 3; i++) {
      positions[i] = gridData.positions[i];
      colors[i] = gridData.colors[i];
    }
    for (let i = 0; i < gridCount; i++) {
      sizes[i] = gridData.sizes[i];
    }

    // Append real catalog stars
    for (let r = 0; r < realOverlay.length; r++) {
      const rs = realOverlay[r];
      const idx = gridCount + r;
      const i3 = idx * 3;
      positions[i3]     = rs.skyX;
      positions[i3 + 1] = rs.skyY;
      positions[i3 + 2] = rs.skyZ;
      colors[i3]     = rs.color[0];
      colors[i3 + 1] = rs.color[1];
      colors[i3 + 2] = rs.color[2];
      sizes[idx] = rs.size;

      realStarMap.push({
        index: idx,
        starData: {
          worldX: rs.worldX,
          worldY: rs.worldY,
          worldZ: rs.worldZ,
          seed: rs.seed,
          name: rs.name,
          isRealStar: true,
          type: rs.type,
        },
        estimatedType: rs.type,
        apparentMagnitude: rs.appMag,
        name: rs.name,
      });
    }

    // ── Place galactic features as tagged sky points ──
    for (let f = 0; f < featureCount; f++) {
      const feature = nearbyFeatures[f];
      const dx = feature.position.x - playerPos.x;
      const dy = feature.position.y - playerPos.y;
      const dz = feature.position.z - playerPos.z;
      const dist = Math.max(feature.distance, 0.001);

      const idx = realStarCount + f;
      const i3 = idx * 3;
      positions[i3]     = (dx / dist) * radius;
      positions[i3 + 1] = (dy / dist) * radius;
      positions[i3 + 2] = (dz / dist) * radius;

      // Feature points are invisible — SkyFeatureLayer handles the visual.
      // These exist only as click targets (findNearestStar works on positions
      // in JS, not rendered size, so invisible points are still selectable).
      colors[i3]     = 0;
      colors[i3 + 1] = 0;
      colors[i3 + 2] = 0;
      sizes[idx] = 0.001; // effectively invisible

      // Tag as a feature in the star map so warp routing can distinguish it
      realStarMap.push({
        index: idx,
        starData: null,
        isFeature: true,
        featureType: feature.type,
        featureData: feature,
      });
    }

    // ── Place external galaxies as tagged sky points ──
    for (let g = 0; g < extGalaxyCount; g++) {
      const gal = externalGalaxies[g];
      const idx = realStarCount + featureCount + g;
      const i3 = idx * 3;
      positions[i3]     = gal.direction.x * radius;
      positions[i3 + 1] = gal.direction.y * radius;
      positions[i3 + 2] = gal.direction.z * radius;

      // Faint warm color — external galaxies appear as dim smudges
      colors[i3]     = 0.6 * gal.brightness;
      colors[i3 + 1] = 0.55 * gal.brightness;
      colors[i3 + 2] = 0.4 * gal.brightness;

      // Slightly larger than background stars so they're distinguishable
      sizes[idx] = 8.0;

      realStarMap.push({
        index: idx,
        starData: null,
        isFeature: false,
        isExternalGalaxy: true,
        galaxyData: gal,
      });
    }

    // ── Galactic geometry for glow shader ──
    const toCenterX = -playerPos.x;
    const toCenterY = -playerPos.y;
    const toCenterZ = -playerPos.z;
    const toCenterDist = Math.sqrt(toCenterX * toCenterX + toCenterY * toCenterY + toCenterZ * toCenterZ);
    const centerDirX = toCenterX / (toCenterDist || 1);
    const centerDirY = toCenterY / (toCenterDist || 1);
    const centerDirZ = toCenterZ / (toCenterDist || 1);

    // ── No background stars ──
    // Every visible point of light is a real GalacticMap star with a seed,
    // position, and spectral type. The galaxy glow layer handles the
    // unresolved diffuse background (billions of stars too dim to see individually).
    const actualCount = realStarCount + featureCount + extGalaxyCount;

    return {
      positions,
      colors,
      sizes,
      count: actualCount,
      realStars: realStarMap,
      // Galactic geometry for GalaxyGlow shader
      galCenterDir: { x: centerDirX, y: centerDirY, z: centerDirZ },
      playerHeight: Math.abs(playerPos.y),
      playerR: Math.sqrt(playerPos.x * playerPos.x + playerPos.z * playerPos.z),
      // Full player position + arm model params for analytical glow shader
      playerPos: { x: playerPos.x, y: playerPos.y, z: playerPos.z },
      armOffsets: galacticMap.armOffsets.slice(), // copy of the 4 arm starting angles
      armPitchK: galacticMap.pitchK,
      densityNorm: galacticMap._potentialDensityNorm,
    };
  }

}
