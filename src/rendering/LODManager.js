import * as THREE from 'three';

/**
 * LODManager — centralized LOD evaluation for all system bodies.
 *
 * Each frame, evaluates camera distance to every registered body
 * and assigns the appropriate LOD tier:
 *
 *   Tier 0 — Billboard: colored pixel dot (body is sub-pixel)
 *   Tier 1 — Orbital: sphere mesh with procedural shader (current level)
 *   Tier 2 — Close-up: enhanced detail (terrain, atmosphere, craters)
 *
 * Tier thresholds are based on camera distance ÷ body radius:
 *   distance > farThreshold × radius  → Tier 0 (billboard)
 *   distance < nearThreshold × radius → Tier 2 (close-up)
 *   else                               → Tier 1 (orbital)
 *
 * The LODManager doesn't create/destroy meshes — it calls
 * bodyRenderer.setLOD(tier) and lets the renderer handle transitions.
 * Billboard.js handles Tier 0 externally (existing system).
 *
 * Usage:
 *   const lod = new LODManager(camera);
 *   lod.register(bodyRenderer);
 *   // each frame:
 *   lod.update();
 */

// Default thresholds (distance / body radius)
const DEFAULT_FAR_THRESHOLD = 500;   // > 500× radius → billboard
const DEFAULT_NEAR_THRESHOLD = 20;   // < 20× radius → close-up

export class LODManager {
  /**
   * @param {THREE.Camera} camera
   * @param {object} [options]
   * @param {number} [options.farThreshold=500] — distance/radius for billboard
   * @param {number} [options.nearThreshold=20] — distance/radius for close-up
   */
  constructor(camera, options = {}) {
    this._camera = camera;
    this._farThreshold = options.farThreshold ?? DEFAULT_FAR_THRESHOLD;
    this._nearThreshold = options.nearThreshold ?? DEFAULT_NEAR_THRESHOLD;

    /** @type {Set<import('./objects/BodyRenderer.js').BodyRenderer>} */
    this._bodies = new Set();

    // Reusable vector for distance calculation
    this._tempVec = new THREE.Vector3();
  }

  /**
   * Register a body for LOD management.
   * @param {import('./objects/BodyRenderer.js').BodyRenderer} body
   */
  register(body) {
    this._bodies.add(body);
  }

  /**
   * Unregister a body.
   * @param {import('./objects/BodyRenderer.js').BodyRenderer} body
   */
  unregister(body) {
    this._bodies.delete(body);
  }

  /**
   * Clear all registered bodies (call on system disposal).
   */
  clear() {
    this._bodies.clear();
  }

  /**
   * Evaluate LOD for all registered bodies.
   * Call once per frame.
   */
  update() {
    const camPos = this._camera.position;

    for (const body of this._bodies) {
      if (!body.mesh?.matrixWorld) continue;
      // Get world position of body mesh
      this._tempVec.setFromMatrixPosition(body.mesh.matrixWorld);
      const distance = camPos.distanceTo(this._tempVec);
      const ratio = distance / Math.max(body.radius, 0.001);

      let targetTier;
      if (ratio > this._farThreshold) {
        targetTier = 0; // billboard
      } else if (ratio < this._nearThreshold) {
        targetTier = 2; // close-up
      } else {
        targetTier = 1; // orbital
      }

      body.setLOD(targetTier);
    }
  }

  /**
   * Get the current LOD tier for a body (for debug display).
   * @param {import('./objects/BodyRenderer.js').BodyRenderer} body
   * @returns {number} 0, 1, or 2
   */
  getLOD(body) {
    return body.currentLOD;
  }

  /**
   * Update thresholds at runtime (e.g. from settings).
   */
  setThresholds(far, near) {
    if (far !== undefined) this._farThreshold = far;
    if (near !== undefined) this._nearThreshold = near;
  }
}
