import * as THREE from 'three';

/**
 * FlythroughCamera — orientation-authoring layer for the cinematic camera.
 *
 * Thinned 2026-04-20 per WS 1 of the V1 autopilot sequence
 * (docs/WORKSTREAMS/autopilot-navigation-subsystem-split-2026-04-20.md).
 * Position / velocity / Hermite / orbit-arc / approach / descend all moved to
 * `NavigationSubsystem`. This module now owns ONLY:
 *
 *   - Reading the subsystem's `MotionFrame` each update tick.
 *   - Writing `camera.position` = frame.position.
 *   - Authoring camera orientation: `camera.lookAt()` with free-look offset
 *     applied, and pre-motion → lookAt-driven orientation slerp for the
 *     first ~1s of motion (so manual burns don't snap).
 *   - Free-look offset state (yaw/pitch), exposed via `addFreeLook` /
 *     `clearFreeLook` for middle-mouse drag during flythrough.
 *
 * The split line per §10.3: motion plan is produced (subsystem) →
 * camera consumes. No motion math here — none.
 */

// Reusable vectors to avoid per-frame allocations
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();

export class FlythroughCamera {
  /**
   * @param {THREE.Camera} camera                     — the Three.js camera
   * @param {NavigationSubsystem} navigationSubsystem — motion producer
   */
  constructor(camera, navigationSubsystem) {
    this.camera = camera;
    this.navigation = navigationSubsystem;

    // ── Orientation-blend state ──
    // Snapshot of camera.quaternion at motion start; the slerp pulls the
    // camera orientation BACK toward this initial quat for the first
    // `navigation.rotBlendDuration` seconds, so motion starts feel like
    // a smooth turn rather than an instant snap.
    this._initialQuat = new THREE.Quaternion();
    this._rotBlendElapsed = 0;
    this._rotBlendDuration = 0;

    // ── Free-look offset (middle-mouse drag) ──
    this.freeLookYaw = 0;
    this.freeLookPitch = 0;
  }

  /**
   * Is motion currently planned / executing?
   * Mirrors the legacy `active` field used by callers to gate idle timers,
   * HUD visibility, etc. Derived from subsystem state.
   */
  get active() {
    return this.navigation.isActive;
  }

  /**
   * Compatibility setter used by legacy call sites that wrote
   * `flythrough.active = false` to abort. Route through stop().
   */
  set active(value) {
    if (!value) this.stop();
  }

  /**
   * Per-frame tick. Advances the subsystem, applies the resulting
   * motion frame to the camera (position + lookAt), and handles the
   * orientation blend on motion start.
   *
   * @param {number} deltaTime
   * @returns {Object} MotionFrame — pass-through from subsystem so callers
   *          (main.js autopilot loop) can read one-shot signals like
   *          `travelComplete` / `orbitComplete` / `targetingReady`.
   */
  update(deltaTime) {
    const frame = this.navigation.update(deltaTime);

    if (!this.navigation.isActive) {
      return frame;
    }

    // On motion start: snapshot current orientation + read blend duration hint.
    if (frame.motionStarted) {
      this._initialQuat.copy(this.camera.quaternion);
      this._rotBlendElapsed = 0;
      this._rotBlendDuration = this.navigation.rotBlendDuration;
    } else {
      this._rotBlendElapsed += deltaTime;
    }

    // Write position from subsystem plan.
    this.camera.position.copy(frame.position);

    // Author orientation: free-look-applied lookAt toward the subsystem's
    // target-look point.
    this._applyFreeLookAndLookAt(frame.lookAtTarget);

    // Orientation-blend slerp — pull the just-authored orientation BACK
    // toward the pre-motion quaternion for the first rotBlendDuration,
    // eased with classic inOutSine (gentler than quintic for camera turns).
    if (this._rotBlendDuration > 0 && this._rotBlendElapsed < this._rotBlendDuration) {
      const blendT = this._rotBlendElapsed / this._rotBlendDuration;
      const eased = 0.5 * (1 - Math.cos(Math.PI * blendT));
      // slerp(initialQuat, 1 - eased): eased=0 → full pull to initial;
      // eased=1 → no pull, stays at lookAt result.
      this.camera.quaternion.slerp(this._initialQuat, 1 - eased);
    }

    return frame;
  }

  /** Apply free-look offset and call camera.lookAt with the given target. */
  _applyFreeLookAndLookAt(target) {
    if (Math.abs(this.freeLookYaw) > 0.001 || Math.abs(this.freeLookPitch) > 0.001) {
      _v1.copy(target).sub(this.camera.position).normalize();

      const cosY = Math.cos(this.freeLookYaw);
      const sinY = Math.sin(this.freeLookYaw);
      const rx = _v1.x * cosY - _v1.z * sinY;
      const rz = _v1.x * sinY + _v1.z * cosY;
      _v1.x = rx;
      _v1.z = rz;

      _v1.y += this.freeLookPitch;
      _v1.normalize();

      _v2.copy(this.camera.position).add(_v1);
      this.camera.lookAt(_v2);
    } else {
      this.camera.lookAt(target);
    }
  }

  /** Add free-look offset (from middle-mouse drag during flythrough). */
  addFreeLook(dyaw, dpitch) {
    this.freeLookYaw += dyaw;
    this.freeLookPitch += dpitch;
    this.freeLookYaw = Math.max(-0.8, Math.min(0.8, this.freeLookYaw));
    this.freeLookPitch = Math.max(-0.5, Math.min(0.5, this.freeLookPitch));
  }

  /** Clear free-look offset (when middle-mouse released). */
  clearFreeLook() {
    this.freeLookYaw = 0;
    this.freeLookPitch = 0;
  }

  /** Stop motion (via subsystem). */
  stop() {
    this.navigation.stop();
  }
}
