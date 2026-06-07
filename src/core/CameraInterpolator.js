// Fixed-timestep render interpolation for the camera.
//
// The sim advances the camera at a fixed 60Hz; `renderFrame` runs every RAF
// (up to the display's ~240Hz) and blends the previous and current sim
// snapshots at a fractional `alpha` so motion is smooth between sim ticks.
// Per Glenn Fiedler "Fix Your Timestep" — sim on fixed dt, render interpolates.
//
// The blend ASSUMES the camera moves continuously between the two snapshots.
// Two discontinuities violate that and MUST be announced, or the blend will
// interpolate across the jump and produce a wrong (often wildly off) pose:
//
//   1. World-origin rebase — the rendering frame shifts under the camera.
//      Announce with `shiftOnRebase(offset)` (subtracts the offset from both
//      snapshots so they stay in the new frame).
//   2. Teleport — the camera is moved discontinuously (the warp system swap
//      teleports it to the destination). Announce with `resync(camera)`
//      (collapses both snapshots onto the new pose so the next blend is a
//      no-op and the teleport sticks).
//
// Why this exists as its own tested module: the camera interpolation used to
// live as private state inside main.js, untestable in isolation. That gap hid
// the 2026-06-07 AC4 bug — the async warp-swap teleport landed between a
// snapshot and the next render, and the blend silently reverted it (camera
// snapped back to its pre-teleport position, never reached Portal B, so the
// emergence crossing never fired). See tests/camera-interpolator.test.js.
import * as THREE from 'three';

export class CameraInterpolator {
  constructor() {
    this.prevPos = new THREE.Vector3();
    this.currPos = new THREE.Vector3();
    this.prevQuat = new THREE.Quaternion();
    this.currQuat = new THREE.Quaternion();
    this._scratchQuat = new THREE.Quaternion();
    this.initialized = false;
  }

  /**
   * Call BEFORE the sim tick: `prev <- curr` (the sim is about to advance the
   * authoritative state). The first call seeds both snapshots from the live
   * camera so the first render has a valid (zero-length) interval to blend.
   */
  shift(camera) {
    if (!this.initialized) {
      this.prevPos.copy(camera.position);
      this.currPos.copy(camera.position);
      this.prevQuat.copy(camera.quaternion);
      this.currQuat.copy(camera.quaternion);
      this.initialized = true;
      return;
    }
    this.prevPos.copy(this.currPos);
    this.prevQuat.copy(this.currQuat);
  }

  /**
   * Call AFTER the sim tick: `curr <- live` (capture the just-advanced
   * authoritative camera pose).
   */
  snapshot(camera) {
    this.currPos.copy(camera.position);
    this.currQuat.copy(camera.quaternion);
  }

  /**
   * Render: write the alpha-blended pose onto the camera. No-op until the first
   * `shift` has seeded the snapshots.
   */
  applyTo(camera, alpha) {
    if (!this.initialized) return;
    camera.position.lerpVectors(this.prevPos, this.currPos, alpha);
    this._scratchQuat.copy(this.prevQuat).slerp(this.currQuat, alpha);
    camera.quaternion.copy(this._scratchQuat);
  }

  /**
   * Discontinuity 1 — world-origin rebase. Subtract the rebase offset from both
   * snapshots so the blend stays in the new (recentred) frame and doesn't jump.
   */
  shiftOnRebase(offset) {
    this.prevPos.sub(offset);
    this.currPos.sub(offset);
  }

  /**
   * Discontinuity 2 — teleport. Collapse both snapshots onto the camera's new
   * pose so the next render blend is a no-op and the teleport is preserved
   * instead of being interpolated away. Call immediately after moving the
   * camera (e.g. the warp system-swap teleport).
   */
  resync(camera) {
    this.prevPos.copy(camera.position);
    this.currPos.copy(camera.position);
    this.prevQuat.copy(camera.quaternion);
    this.currQuat.copy(camera.quaternion);
    this.initialized = true;
  }
}
