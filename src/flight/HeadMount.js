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
  RECENTER_TAU: 0.25,       // s — eased recenter on release
  SNAP_EPS: 1e-3,           // rad (~0.06°) — snap-to-zero; sized so a full-deflection recenter completes < 2 s at RECENTER_TAU
};

export class HeadMount {
  constructor(tuning = {}) {
    this.tuning = { ...HEAD_TUNING, ...tuning };
    this.held = false;
    this.yaw = 0;
    this.pitch = 0;
    this._look = new THREE.Quaternion();
    this._euler = new THREE.Euler();
  }

  beginLook() { this.held = true; }
  endLook() { this.held = false; }

  /** Mouse-movement deltas, radians. Only while held (hold-to-look). */
  addLook(dyaw, dpitch) {
    if (!this.held) return;
    const t = this.tuning;
    this.yaw = THREE.MathUtils.clamp(this.yaw + dyaw, -t.MAX_YAW, t.MAX_YAW);
    this.pitch = THREE.MathUtils.clamp(this.pitch + dpitch, -t.MAX_PITCH, t.MAX_PITCH);
  }

  update(dt) {
    if (this.held) return;
    const f = Math.exp(-dt / this.tuning.RECENTER_TAU);
    this.yaw *= f; this.pitch *= f;
    if (Math.abs(this.yaw) < this.tuning.SNAP_EPS) this.yaw = 0;
    if (Math.abs(this.pitch) < this.tuning.SNAP_EPS) this.pitch = 0;
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
