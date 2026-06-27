// src/flight/HeadMount.js
//
// Head/camera mount for supercruise (AC2/AC4). ROTATION-ONLY, computed math —
// deliberately NOT an Object3D parented under the camera/scene: WorldOrigin's
// rebase assumes an unparented camera (src/core/WorldOrigin.js:148-150).
// The future cockpit parents to the SHIP transform; this mount stays the
// player's head on top of it.
import * as THREE from 'three';

export const HEAD_TUNING = {
  MAX_YAW: Math.PI * 0.75,  // ±135°
  MAX_PITCH: Math.PI / 3,   // ±60°
  // §free-look-interaction-redesign-2026-06-27, Part 2 step 4: the head no longer
  // recenters merely because the look is released — it HOLDS where you dragged it.
  // Recenter is now EXPLICIT (beginRecenter()), fired only on free-look EXIT (F off).
  // EXIT_RECENTER_TAU is that return's time-constant — snappy-but-graceful (~150-250ms
  // feel; a single tunable Max/working-Claude can dial live afterward). It's an
  // exponential ease, so ~63% of the return is done in 1τ and ~95% in 3τ (~0.5 s at
  // τ=0.18) — perceptually settled in well under a second; the tiny SNAP_EPS tail
  // (last ~0.06°) is imperceptible. Lower τ for a snappier return, raise for slower.
  EXIT_RECENTER_TAU: 0.18,  // s — eased recenter on free-look EXIT (fast but graceful)
  SNAP_EPS: 1e-3,           // rad (~0.06°) — snap-to-zero so the ease terminates cleanly
};

export class HeadMount {
  constructor(tuning = {}) {
    this.tuning = { ...HEAD_TUNING, ...tuning };
    this.held = false;
    // Hold-vs-recenter (Part 2 step 4): when the look is released the view HOLDS
    // (no ease) UNLESS a recenter has been explicitly requested (free-look exit).
    this.recentering = false;
    this.yaw = 0;
    this.pitch = 0;
    this._look = new THREE.Quaternion();
    this._euler = new THREE.Euler();
  }

  // Grabbing the view (LMB-down in free-look, or the middle-mouse peek) cancels
  // any in-flight recenter so you can re-aim mid-return.
  beginLook() { this.held = true; this.recentering = false; }
  endLook() { this.held = false; }

  /** Request the eased return to nose-forward (free-look EXIT only). */
  beginRecenter() { this.recentering = true; }

  /** Mouse-movement deltas, radians. Only while held (hold-to-look). */
  addLook(dyaw, dpitch) {
    if (!this.held) return;
    const t = this.tuning;
    this.yaw = THREE.MathUtils.clamp(this.yaw + dyaw, -t.MAX_YAW, t.MAX_YAW);
    this.pitch = THREE.MathUtils.clamp(this.pitch + dpitch, -t.MAX_PITCH, t.MAX_PITCH);
  }

  update(dt) {
    // Held → frozen (you're actively looking). Released-but-not-recentering →
    // HOLD the current view (the Part 2 change: no auto-ease just because !held).
    // Only an explicit recenter (free-look exit) eases yaw/pitch → 0.
    if (this.held || !this.recentering) return;
    const f = Math.exp(-dt / this.tuning.EXIT_RECENTER_TAU);
    this.yaw *= f; this.pitch *= f;
    if (Math.abs(this.yaw) < this.tuning.SNAP_EPS) this.yaw = 0;
    if (Math.abs(this.pitch) < this.tuning.SNAP_EPS) this.pitch = 0;
    if (this.yaw === 0 && this.pitch === 0) this.recentering = false; // arrived
  }

  get centered() { return this.yaw === 0 && this.pitch === 0; }

  /** Write the camera pose: AT the ship position, ship orientation × look.
   *  Cockpit offset arrives with the cockpit arc, not here. */
  applyTo(camera, shipPos, shipQuat) {
    camera.position.copy(shipPos);
    this._look.setFromEuler(this._euler.set(this.pitch, this.yaw, 0, 'YXZ'));
    camera.quaternion.copy(shipQuat).multiply(this._look);
  }
}
