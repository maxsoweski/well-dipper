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
const _euler = new THREE.Euler();
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

    // ── Shake provider hook (WS 2 — gravity-drive shake per §10.8) ──
    // Optional. If set, `update()` reads `provider.shakeEuler` ({pitch,
    // yaw, roll} in radians) and composes it onto `camera.quaternion`
    // AFTER `camera.lookAt()` has run — rotation in camera-local space.
    // V1 provider is ShipChoreographer; default is smooth motion (provider
    // emits zero rotation). Round-10 rotation-only surface: `camera.position`
    // is NEVER mutated by the shake mechanism (AC #19 invariant).
    this._shakeProvider = null;
    // Reusable quaternion for shake composition
    this._shakeQuat = new THREE.Quaternion();

    // ── Camera choreographer hook (WS 3 — camera-axis dispatch per §10.1) ──
    // Optional. If set, `update()` calls `choreographer.update(dt, frame)`
    // and reads `choreographer.currentLookAtTarget` for the camera's
    // look target instead of `frame.lookAtTarget`. The choreographer
    // authors the framing (ESTABLISHING linger / pan-forward / SHOWCASE /
    // ROVING); this module stays the orientation-write surface —
    // `camera.lookAt` is called here, never in the mode objects. That
    // preserves the shake-composition ordering from the round-10 shake
    // redesign (position → lookAt → rot-blend → shake) — WS 3 AC #3.
    this._cameraChoreographer = null;
  }

  /** Optional: set a shake-offset provider (e.g., ShipChoreographer). */
  setShakeProvider(provider) { this._shakeProvider = provider; }

  /** Optional: set a camera-mode dispatch provider (e.g., CameraChoreographer). */
  setCameraChoreographer(choreographer) { this._cameraChoreographer = choreographer; }

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
    // Reset blend counter so the subsequent `+= deltaTime` lands at exactly
    // deltaTime on this first frame — matching pre-refactor's `travelElapsed`
    // semantics (pre-refactor `_updateTravel` increments its elapsed counter
    // at the top of its body before consulting for the slerp). Off-by-one
    // here produced ~1e-6 quat deltas at motion start caught by
    // tests/refactor-verification/autopilot-navigation-subsystem-split.html.
    if (frame.motionStarted) {
      this._initialQuat.copy(this.camera.quaternion);
      this._rotBlendElapsed = 0;
      this._rotBlendDuration = this.navigation.rotBlendDuration;
    }

    // Advance blend timer every frame (including the motionStarted frame, so
    // blendT = deltaTime / rotBlendDuration on frame 0, matching pre-refactor).
    this._rotBlendElapsed += deltaTime;

    // Write position from subsystem plan. Round-10 invariant: shake does
    // NOT mutate position. WS 3 invariant: choreographer does NOT mutate
    // position either — that's the motion-produces pipeline (§5.3 /
    // Principle 5). Pinned geometry stays pinned in world-space; only
    // camera orientation jitters below.
    this.camera.position.copy(frame.position);

    // WS 3: advance camera choreographer and use its authored target.
    // Fallback to subsystem's lookAtTarget when no choreographer is set
    // (e.g., during early init or if disabled).
    let lookTarget = frame.lookAtTarget;
    if (this._cameraChoreographer) {
      this._cameraChoreographer.update(deltaTime, frame);
      lookTarget = this._cameraChoreographer.currentLookAtTarget;
    }

    // Author orientation: free-look-applied lookAt toward the
    // choreographer's (or subsystem's fallback) target-look point.
    this._applyFreeLookAndLookAt(lookTarget);

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

    // Shake composition — rotation-only, applied LAST in camera-local space
    // (post-multiply onto camera.quaternion so pitch/yaw/roll live in the
    // camera's own axes, not world axes). Round-10 surface per Bible §8H
    // amendment and AC #19. Default provider emits zero rotation.
    if (this._shakeProvider && this._shakeProvider.shakeEuler) {
      const { pitch, yaw, roll } = this._shakeProvider.shakeEuler;
      if (pitch !== 0 || yaw !== 0 || roll !== 0) {
        // Euler XYZ order: pitch (camera-local X), yaw (Y), roll (Z)
        _euler.set(pitch, yaw, roll, 'XYZ');
        this._shakeQuat.setFromEuler(_euler);
        this.camera.quaternion.multiply(this._shakeQuat);
      }
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
