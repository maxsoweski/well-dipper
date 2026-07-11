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

// Default identity-match tolerance for findByPosition: 0.1 pc (0.0001 kpc).
// This MUST stay BELOW KnownSystems' MATCH_RADIUS (0.0005 kpc, see that
// file) — otherwise a teleport landing in the annulus between the two
// tolerances could spawn a procgen system wearing a known system's name
// (the inverse of the Sirius-swallow bug KnownSystems.MATCH_RADIUS guards
// against).
export const POSITION_MATCH_TOL = 0.0001; // kpc

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
   * Find all real stars within an axis-aligned bounding box.
   *
   * @param {{ x, y, z }} center — center of the box in galactic kpc
   * @param {number} xzHalf — half-size on X and Z axes (kpc)
   * @param {number} yHalf — half-size on Y axis (kpc)
   * @returns {Array<{ x, y, z, name, spect, absMag, lum, ci }>}
   */
  findInVolume(center, xzHalf, yHalf) {
    if (!this._stars) return [];

    const xMin = center.x - xzHalf, xMax = center.x + xzHalf;
    const yMin = center.y - yHalf,  yMax = center.y + yHalf;
    const zMin = center.z - xzHalf, zMax = center.z + xzHalf;

    const results = [];
    for (let i = 0; i < this._stars.length; i++) {
      const s = this._stars[i];
      if (s.x >= xMin && s.x <= xMax &&
          s.y >= yMin && s.y <= yMax &&
          s.z >= zMin && s.z <= zMax) {
        results.push(s);
      }
    }
    return results;
  }

  /**
   * Find the real star AT a galactic position (identity lookup) — the nearest
   * catalog star within `tolKpc`, or null. Used by teleport arrivals to carry
   * the real star's name into the spawned system, mirroring how warp arrivals
   * resolve identity from the clicked sky entry. Nearest-not-first matters:
   * close binaries (61 Cygni A/B, ~0.0004 pc apart) both sit inside the
   * default 0.1 pc tolerance.
   *
   * @param {{ x, y, z }} pos — galactic position in kpc
   * @param {number} tolKpc — match tolerance in kpc (default POSITION_MATCH_TOL = 0.1 pc)
   * @returns {{ x, y, z, name, spect, absMag, lum, ci } | null}
   */
  findByPosition(pos, tolKpc = POSITION_MATCH_TOL) {
    if (!this._stars) return null;
    let best = null;
    let bestDist = tolKpc;
    for (let i = 0; i < this._stars.length; i++) {
      const s = this._stars[i];
      const dx = s.x - pos.x;
      const dy = s.y - pos.y;
      const dz = s.z - pos.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist < bestDist) {
        best = s;
        bestDist = dist;
      }
    }
    return best;
  }

  /**
   * Find all real stars within radiusKpc (sphere) of pos. Used by
   * KnownSystems.associate to derive a known system's catalog aliases.
   * @param {{x,y,z}} pos  @param {number} radiusKpc
   * @returns {Array<catalogStar>}
   */
  findAllWithin(pos, radiusKpc) {
    if (!this._stars) return [];
    const out = [], r2 = radiusKpc * radiusKpc;
    for (let i = 0; i < this._stars.length; i++) {
      const s = this._stars[i];
      const dx = s.x - pos.x, dy = s.y - pos.y, dz = s.z - pos.z;
      if (dx*dx + dy*dy + dz*dz < r2) out.push(s);
    }
    return out;
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
