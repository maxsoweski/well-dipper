/**
 * Ship — first-class player-ship object.
 *
 * Per `docs/FEATURES/autopilot.md` §"Per-phase criterion — camera axis
 * (V1)" §Precondition (amended 2026-04-24):
 *
 *   "V1's camera reads the ship's forward vector. This requires the
 *    ship model to have a defined front/back/top/bottom orientation
 *    in the scene graph. The orientation does not have to be visible
 *    to the player (no chevrons, no decals required), but it must
 *    exist as an authored property of the ship object, not derived
 *    per-frame from motion direction."
 *
 * Per the V1 STATION-hold redesign brief AC #7
 * (`docs/WORKSTREAMS/autopilot-station-hold-redesign-2026-04-24.md`):
 *
 *   1. The ship object exposes a stable `forward` (Vector3, unit) and
 *      `up` (Vector3, unit) accessor. `right` derives from
 *      `forward × up`. Accessors are readable at all times — during
 *      CRUISE, during APPROACH, during STATION-A hold (where ship
 *      velocity = 0 and a motion-derived fallback would have no
 *      signal to read).
 *   2. The orientation is NOT derived from ship velocity or
 *      position. At rest, `forward` returns the authored forward
 *      axis. The autopilot SETS orientation by calling
 *      `setOrientation(forward, up)`; the ship holds the written
 *      orientation until the next write. Camera reads the SET
 *      orientation; orientation is not computed on-the-fly from
 *      velocity, and not inferred from motion state.
 *   3. The `CameraChoreographer` reads the accessors; it does not
 *      fall back to `normalize(velocity)` or
 *      `normalize(position - prevPosition)` at any code path.
 *   4. The ACCEL/DECEL shake mechanism reads the accessors to
 *      compute its perturbation axis; it does not fall back to
 *      motion-direction derivation.
 *
 * V1 scope: orientation only. Position remains on `camera.position`
 * for V1 simplicity — `camera.position` is the ship's effective
 * position (per PM brief §11 code-read at HEAD `690ea81`). Future
 * workstreams can migrate position onto this Ship object if a
 * proper ship-mesh / cockpit-render needs it; the AC #7 precondition
 * doesn't constrain that choice.
 *
 * Per Principle 2 (No Tack-On Systems): orientation is a property
 * of the ship, not of the autopilot or camera subsystem. This file
 * lives at `src/core/` (alongside `ScaleConstants.js`) because the
 * ship is a core game entity, not an in-system object spawned and
 * destroyed (those live at `src/objects/`).
 */

import * as THREE from 'three';

export class Ship {
  constructor() {
    // Default orientation: forward = world −Z, up = world +Y.
    // Matches three.js camera convention (camera looks down its
    // local −Z axis with +Y up). At construction the ship has no
    // motion state and no autopilot has set orientation yet — the
    // default ensures `forward`/`up` are valid Vec3 unit vectors
    // from frame 0.
    this._forward = new THREE.Vector3(0, 0, -1);
    this._up = new THREE.Vector3(0, 1, 0);
    // Reusable scratch for `right`'s lazy compute.
    this._right = new THREE.Vector3(1, 0, 0);
    this._rightDirty = false;
  }

  /**
   * Unit forward vector. Stable across all phases including
   * STATION-A rest. Mutating the returned reference will violate
   * the accessor contract — callers MUST treat it as read-only.
   * @returns {THREE.Vector3}
   */
  get forward() { return this._forward; }

  /**
   * Unit up vector. Same read-only contract as `forward`.
   * @returns {THREE.Vector3}
   */
  get up() { return this._up; }

  /**
   * Unit right vector, derived as `forward × up`. Lazy-computed
   * from the most recent orientation write. Read-only.
   * @returns {THREE.Vector3}
   */
  get right() {
    if (this._rightDirty) {
      this._right.crossVectors(this._forward, this._up).normalize();
      this._rightDirty = false;
    }
    return this._right;
  }

  /**
   * Set the ship's orientation from a forward vector (unit or
   * non-unit; will be normalized) and an optional up vector. If
   * `up` is omitted, the existing `up` is preserved and
   * re-orthogonalized against the new `forward`. The autopilot
   * calls this when the ship is at CRUISE-onset (aim once at
   * intercept), and during STATION-A entry (point at the held
   * body's center) — orientation is settable, NOT computed on the
   * fly from velocity.
   *
   * Up-vector orthogonalization: if the supplied up has any
   * component along forward, that component is projected away so
   * forward ⊥ up. If up becomes near-zero after projection (i.e.
   * up was nearly parallel to forward), the existing up is
   * preserved and re-orthogonalized instead.
   *
   * @param {THREE.Vector3} forward — desired forward direction
   * @param {THREE.Vector3} [up] — desired up; defaults to current up
   */
  setOrientation(forward, up) {
    if (!forward) return;
    this._forward.copy(forward);
    const fLen = this._forward.length();
    if (fLen < 1e-9) {
      // Degenerate forward; preserve previous (do not write zero).
      this._forward.set(0, 0, -1);
    } else {
      this._forward.divideScalar(fLen);
    }
    // Re-orthogonalize up against new forward. Use supplied up if
    // given, else preserve current.
    const upRef = up || this._up;
    const dot = upRef.dot(this._forward);
    const candidate = upRef.clone().addScaledVector(this._forward, -dot);
    const upLen = candidate.length();
    if (upLen < 1e-6) {
      // up was parallel to forward; pick a fallback that's
      // orthogonal — try world +Y, then world +X.
      const worldY = new THREE.Vector3(0, 1, 0);
      const dotY = worldY.dot(this._forward);
      const candY = worldY.addScaledVector(this._forward, -dotY);
      if (candY.length() > 1e-6) {
        this._up.copy(candY).normalize();
      } else {
        // forward was world ±Y; use world +X.
        this._up.set(1, 0, 0);
      }
    } else {
      this._up.copy(candidate).divideScalar(upLen);
    }
    this._rightDirty = true;
  }

  /**
   * Reset to the default orientation. Used when the autopilot
   * resets (tour start, scene change). Equivalent to constructor
   * defaults: forward = -Z, up = +Y.
   */
  reset() {
    this._forward.set(0, 0, -1);
    this._up.set(0, 1, 0);
    this._right.set(1, 0, 0);
    this._rightDirty = false;
  }
}
