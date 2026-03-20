/**
 * RealStarCatalog — loads and indexes real star data from the HYG catalog.
 *
 * The HYG v4.0 database contains ~15,600 naked-eye stars with real names,
 * positions, spectral types, and magnitudes. These stars are placed at
 * their real galactic coordinates and override procedural hash-grid stars
 * at nearby positions.
 *
 * Usage:
 *   const catalog = new RealStarCatalog();
 *   await catalog.load(); // fetches hyg-stars.json
 *   const visibleRealStars = catalog.findVisible(playerPos, threshold);
 */

import { GalacticMap } from './GalacticMap.js';

// Spectral type → color (same as HashGridStarfield)
const SPECTRAL_COLOR = {
  O: [0.6, 0.7, 1.0],
  B: [0.7, 0.8, 1.0],
  A: [0.95, 0.95, 1.0],
  F: [1.0, 0.95, 0.85],
  G: [1.0, 0.9, 0.7],
  K: [1.0, 0.75, 0.4],
  M: [1.0, 0.5, 0.2],
  W: [0.5, 0.6, 1.0],  // Wolf-Rayet
  C: [1.0, 0.4, 0.1],  // Carbon star
  S: [1.0, 0.5, 0.3],  // S-type
};

export class RealStarCatalog {
  constructor() {
    this._stars = null;
    this._loaded = false;
  }

  get loaded() { return this._loaded; }
  get count() { return this._stars?.length ?? 0; }

  /**
   * Load the star catalog from the static JSON file.
   * Call once at startup.
   */
  async load() {
    try {
      const resp = await fetch('./assets/data/hyg-stars.json');
      if (!resp.ok) {
        console.warn('RealStarCatalog: failed to load hyg-stars.json:', resp.status);
        return;
      }
      this._stars = await resp.json();
      this._loaded = true;
      console.log(`RealStarCatalog: loaded ${this._stars.length} real stars`);
    } catch (e) {
      console.warn('RealStarCatalog: load error:', e.message);
    }
  }

  /**
   * Find all real stars visible from a position.
   * Returns stars with apparent magnitude below the threshold.
   *
   * @param {{ x, y, z }} playerPos — galactic position in kpc
   * @param {number} magThreshold — apparent magnitude limit (default 6.5)
   * @param {number} skyRadius — sky sphere radius for rendering
   * @returns {Array<{ worldX, worldY, worldZ, type, appMag, seed, name, color, size }>}
   */
  findVisible(playerPos, magThreshold = 6.5, skyRadius = 500) {
    if (!this._stars) return [];

    const px = playerPos.x, py = playerPos.y, pz = playerPos.z;
    const results = [];

    for (let i = 0; i < this._stars.length; i++) {
      const s = this._stars[i];

      // Distance from player to this real star
      const dx = s.x - px;
      const dy = s.y - py;
      const dz = s.z - pz;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist < 0.0001) continue; // skip self

      // Apparent magnitude from the catalog's absolute magnitude
      const d_pc = dist * 1000;
      const appMag = s.absMag + 5 * Math.log10(d_pc / 10);

      if (appMag > magThreshold) continue;

      // Sky position
      const skyX = (dx / dist) * skyRadius;
      const skyY = (dy / dist) * skyRadius;
      const skyZ = (dz / dist) * skyRadius;

      // Color from spectral type
      const baseCol = SPECTRAL_COLOR[s.spect] || [1, 1, 1];
      const brightness = Math.max(0.1, 1.5 - (appMag / 5.0));

      // Size from magnitude
      let size;
      if (appMag < -1) size = 12; // very brightest (Sirius, Canopus)
      else if (appMag < 0) size = 10;
      else if (appMag < 2) size = 8;
      else if (appMag < 4) size = 6;
      else if (appMag < 6) size = 4;
      else size = 3;

      // Generate a deterministic seed from position
      const seed = GalacticMap.hashCombine(
        Math.round(s.x * 10000),
        GalacticMap.hashCombine(Math.round(s.y * 10000), Math.round(s.z * 10000))
      );

      results.push({
        worldX: s.x,
        worldY: s.y,
        worldZ: s.z,
        skyX, skyY, skyZ,
        type: s.spect,
        appMag,
        absMag: s.absMag,
        seed,
        name: s.name,
        lum: s.lum,
        color: [baseCol[0] * brightness, baseCol[1] * brightness, baseCol[2] * brightness],
        size,
        isRealStar: true,
      });
    }

    // Sort by brightness (brightest first)
    results.sort((a, b) => a.appMag - b.appMag);
    return results;
  }
}
