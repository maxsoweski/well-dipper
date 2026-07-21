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

import { RealSystemOverlay } from './RealSystemOverlay.js';
import { realStarSeed } from './realStarSeed.js';

// Default identity-match tolerance for findByPosition: 0.1 pc (0.0001 kpc).
// This MUST stay BELOW KnownSystems' MATCH_RADIUS (0.0005 kpc, see that
// file) — otherwise a teleport landing in the annulus between the two
// tolerances could spawn a procgen system wearing a known system's name
// (the inverse of the Sirius-swallow bug KnownSystems.MATCH_RADIUS guards
// against).
export const POSITION_MATCH_TOL = 0.0001; // kpc

// findVisible's self-exclusion epsilon: 1e-6 kpc ≈ 0.001 pc ≈ 206 AU.
// (BN5 of multistar-component-travel-2026-07-21, AC8.) This used to be a
// blanket 0.1 pc skip (the same 0.0001 literal as POSITION_MATCH_TOL —
// same number, DIFFERENT job), which hid every authored component sibling:
// the whole component-separation regime (ceiling ≈ 0.1 pc) sits inside it
// (Rigil↔Proxima is 0.0554 pc). Shrinking to an epsilon is safe because
// every arrival/teleport path lands playerGalacticPos EXACTLY on catalog/
// registry coords, so "self" is dist = 0; the 206 AU margin only absorbs
// float noise. Scope guards (pinned in starfieldHonesty.test.js):
//   - HashGridStarfield's 0.0001 near-origin skips must NOT shrink with
//     this (that would newly reveal procgen stars in every system's sky).
//   - POSITION_MATCH_TOL above must NOT shrink either (identity matching;
//     KnownSystems.MATCH_RADIUS ordering invariant).
export const SELF_SKIP_EPSILON_KPC = 1e-6;

// Blazing tier (BN5, AC8): apparent magnitudes below −3 get a dedicated
// top size tier + a wider-halo branch in StarfieldLayer's fragment shader,
// so a component-scene sibling (A+B from Proxima: appMag −6.90) reads as
// unmistakably blazing instead of pixel-identical to Sirius-from-Sol
// (−1.44; size buckets used to cap at 12 below appMag −1 and the shader
// clamps to white). Threshold ruling (working-Claude 2026-07-21, ruling 2):
// fires ONLY below −3, so every star at appMag ≥ −3 renders byte-identical
// to before — Sirius-from-Sol is pinned byte-identical in
// starfieldHonesty.test.js. Max judges the look at UAT.
export const BLAZING_MAG_THRESHOLD = -3;
// The aSize value that marks the blazing tier. Strictly above every legacy
// size bucket (max 12) so StarfieldLayer's shader can key its halo branch
// on it unambiguously (it interpolates BLAZING_SIZE into the GLSL).
export const BLAZING_SIZE = 20;

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
  D: [0.85, 0.9, 1.0], // Degenerate white dwarf (AC10) — blue-white; matches
                       //   StarSystemGenerator.STAR_PROPERTIES.D / the
                       //   WhiteDwarfStar core palette. Increment-3 future-proof.
};

export class RealStarCatalog {
  constructor() {
    this._stars = null;
    this._loaded = false;
    // The bulk real-universe overlay merge index (AC3/AC4). Constructed EMPTY
    // (not ready) here; populated by load() from the same Promise.all that loads
    // the stars, so any arrival that resolved a catalog star finds it ready
    // (design D5). main.js reads `catalog.overlay` at the two arrival call sites.
    this.overlay = new RealSystemOverlay();
  }

  get loaded() { return this._loaded; }
  get count() { return this._stars?.length ?? 0; }

  /**
   * Load the star catalog + the real-universe overlay data (design D5). ONE
   * Promise.all fetches hyg-stars.json, real-star-supplement.json, and
   * real-system-contents.json together. `_stars` becomes hyg ∪ supplement,
   * concatenated BEFORE this resolves — so the load().then() wiring in main.js
   * (StarfieldGenerator, KnownSystems.associate) sees the supplement stars as
   * findVisible/findInVolume/findByPosition targets. The contents are handed to
   * the overlay index. Call once at startup.
   */
  async load() {
    try {
      const [hyg, supplement, contents] = await Promise.all([
        this._fetchJson('./assets/data/hyg-stars.json'),
        this._fetchJson('./assets/data/real-star-supplement.json'),
        this._fetchJson('./assets/data/real-system-contents.json'),
      ]);
      if (!Array.isArray(hyg)) {
        console.warn('RealStarCatalog: hyg-stars.json missing or malformed; catalog not loaded');
        return;
      }
      this.ingestCatalogData(hyg, supplement, contents);
      const suppCount = supplement?.stars?.length ?? 0;
      const hostCount = contents?.hosts?.length ?? 0;
      console.log(
        `RealStarCatalog: loaded ${this._stars.length} real stars ` +
        `(${hyg.length} HYG + ${suppCount} supplement), ${hostCount} exoplanet hosts`,
      );
    } catch (e) {
      console.warn('RealStarCatalog: load error:', e.message);
    }
  }

  /**
   * Merge already-parsed catalog data and build the overlay index. This is the
   * ONE code path for the star concat + overlay index build (design D5); load()
   * is the browser fetch wrapper around it, and tests feed it fs-read JSON.
   *
   * @param {Array} hyg — hyg-stars.json (array of star records)
   * @param {object|null} supplement — real-star-supplement.json ({ stars })
   * @param {object|null} contents — real-system-contents.json ({ hosts })
   */
  ingestCatalogData(hyg, supplement = null, contents = null) {
    const supplementStars = supplement?.stars ?? [];
    const contentsHosts = contents?.hosts ?? [];
    // hyg ∪ supplement — supplement dim hosts become catalog stars (nav/sky/
    // arrival visible). Concat before _loaded flips so associate() sees them.
    this._stars = supplementStars.length ? hyg.concat(supplementStars) : hyg;
    this._loaded = true;
    this.overlay.setData({ contentsHosts, supplementStars, catalogStars: this._stars });
  }

  /** Fetch + parse a JSON asset, tolerating a missing/failed file (returns null)
   *  so one absent overlay file never aborts the whole catalog load. */
  async _fetchJson(url) {
    try {
      const resp = await fetch(url);
      if (!resp.ok) {
        console.warn(`RealStarCatalog: failed to load ${url}:`, resp.status);
        return null;
      }
      return await resp.json();
    } catch (e) {
      console.warn(`RealStarCatalog: fetch error ${url}:`, e.message);
      return null;
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
      // Skip self only — arrival/teleport puts the player exactly on catalog
      // coords (dist = 0). Component siblings sit inside 0.1 pc (Proxima is
      // 0.0554 pc from A+B) and MUST render — see SELF_SKIP_EPSILON_KPC.
      if (dist < SELF_SKIP_EPSILON_KPC) continue;

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
      if (appMag < BLAZING_MAG_THRESHOLD) size = BLAZING_SIZE; // blazing tier (component siblings)
      else if (appMag < -1) size = 12; // very brightest (Sirius, Canopus)
      else if (appMag < 0) size = 10;
      else if (appMag < 2) size = 8;
      else if (appMag < 4) size = 6;
      else if (appMag < 6) size = 4;
      else size = 3;

      // Generate a deterministic seed from position (canonical F1 — the ONE
      // shared real-star seed module; formerly inlined here, now imported).
      const seed = realStarSeed(s.x, s.y, s.z);

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
