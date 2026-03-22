import * as THREE from 'three';

/**
 * GlowTextureManager — loads and caches pre-computed galaxy glow panoramas.
 *
 * The panoramas are organized on a cylindrical grid (R, z, theta) throughout
 * the galaxy. Given a player position, this manager finds the nearest grid
 * point and loads the corresponding PNG texture.
 *
 * Caches textures in an LRU map so warping back to visited regions is instant.
 */
export class GlowTextureManager {
  constructor() {
    this._manifest = null;
    this._manifestLoading = null;
    this._cache = new Map();     // filename → THREE.Texture
    this._maxCache = 12;         // keep up to 12 textures in memory
    this._loader = new THREE.TextureLoader();
    this._basePath = 'assets/glow/';
  }

  /**
   * Load the glow panorama nearest to a galactic position.
   * Returns a Promise<THREE.Texture>.
   *
   * @param {{ x: number, y: number, z: number }} pos — galactic position in kpc
   * @returns {Promise<THREE.Texture>}
   */
  async loadForPosition(pos) {
    const manifest = await this._ensureManifest();
    if (!manifest || !manifest.grid) return null;

    const filename = this._findNearest(pos, manifest);
    if (!filename) return null;

    return this._loadTexture(filename);
  }

  /**
   * Find the nearest grid panorama filename for a position.
   */
  _findNearest(pos, manifest) {
    const { R: gridR, z: gridZ, theta: gridTheta } = manifest.grid;

    // Convert position to cylindrical coordinates
    const R = Math.sqrt(pos.x * pos.x + pos.z * pos.z);
    const z = pos.y;
    const theta = Math.atan2(pos.z, pos.x);
    // Normalize theta to [0, 2π)
    const thetaNorm = ((theta % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);

    // Find nearest R index
    const ri = this._nearestIndex(gridR, R);

    // Find nearest z index
    const zi = this._nearestIndex(gridZ, z);

    // Find nearest theta index
    // Special case: R=0 only has theta index 0 (isotropic at center)
    let ti = 0;
    if (gridR[ri] > 0) {
      ti = this._nearestAngleIndex(gridTheta, thetaNorm);
    }

    // Build the grid key
    const key = `R${String(ri).padStart(2, '0')}-Z${String(zi).padStart(2, '0')}-T${String(ti).padStart(2, '0')}`;
    return manifest.files[key] || null;
  }

  /**
   * Find the index of the nearest value in a sorted array.
   */
  _nearestIndex(arr, value) {
    let best = 0;
    let bestDist = Math.abs(arr[0] - value);
    for (let i = 1; i < arr.length; i++) {
      const dist = Math.abs(arr[i] - value);
      if (dist < bestDist) {
        best = i;
        bestDist = dist;
      }
    }
    return best;
  }

  /**
   * Find the nearest angle index, accounting for wraparound.
   */
  _nearestAngleIndex(arr, angle) {
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < arr.length; i++) {
      let diff = Math.abs(arr[i] - angle);
      if (diff > Math.PI) diff = 2 * Math.PI - diff;
      if (diff < bestDist) {
        best = i;
        bestDist = diff;
      }
    }
    return best;
  }

  /**
   * Load the manifest JSON (once, cached).
   */
  async _ensureManifest() {
    if (this._manifest) return this._manifest;
    if (this._manifestLoading) return this._manifestLoading;

    this._manifestLoading = fetch(this._basePath + 'glow-manifest.json')
      .then(r => r.json())
      .then(data => {
        this._manifest = data;
        return data;
      })
      .catch(err => {
        console.warn('GlowTextureManager: failed to load manifest', err);
        this._manifest = { grid: null, files: {} };
        return this._manifest;
      });

    return this._manifestLoading;
  }

  /**
   * Load a texture by filename (with LRU caching).
   */
  _loadTexture(filename) {
    // Check cache
    if (this._cache.has(filename)) {
      // Move to end (most recently used)
      const tex = this._cache.get(filename);
      this._cache.delete(filename);
      this._cache.set(filename, tex);
      return Promise.resolve(tex);
    }

    // Load new texture
    return new Promise((resolve) => {
      this._loader.load(
        this._basePath + filename,
        (texture) => {
          // Evict oldest if at capacity
          if (this._cache.size >= this._maxCache) {
            const oldest = this._cache.keys().next().value;
            const oldTex = this._cache.get(oldest);
            oldTex.dispose();
            this._cache.delete(oldest);
          }
          this._cache.set(filename, texture);
          resolve(texture);
        },
        undefined,
        (err) => {
          console.warn('GlowTextureManager: failed to load', filename, err);
          resolve(null);
        }
      );
    });
  }

  dispose() {
    for (const tex of this._cache.values()) {
      tex.dispose();
    }
    this._cache.clear();
  }
}
