// World-origin rebasing — keeps camera near scene origin so float32 precision
// is sufficient for ship-scale (10⁻⁷ scene unit) per-frame motion.
//
// Per docs/PLAN_world-origin-rebasing.md and docs/WORKSTREAMS/world-origin-
// rebasing-2026-05-01.md. Root cause this fixes: float32 (~7 sig figs) loses
// ship-scale precision once the camera drifts past ~1000 scene units from
// origin. `camera.position.addScaledVector(forward, 1e-7 * dt)` rounds to
// zero at world coord ~32,000 (precision there ≈ 4e-3). Warp's FOLD/ENTER
// camera motion was the user-visible symptom; rebasing makes it visible
// regardless of where the camera is in the world.
//
// Mechanical summary (Plan §"What rebasing does"):
//   Every frame past `REBASE_THRESHOLD_SQ`, subtract the camera's world
//   position from every position-tracked top-level scene child, accumulate
//   the offset in `worldOrigin`, reset the camera to (0,0,0). Listeners
//   (camera controllers with cached target Vector3s, shaders carrying
//   spawn-time world positions) get notified so they can apply the same
//   subtraction to their state. Tracked Vector3s are auto-shifted by the
//   internal listener.
//
// Visually identical every frame; numerically all nearby objects live at
// small coordinates and ship-scale precision is preserved.

import * as THREE from 'three';

// 100 scene units = 100 × 149,598 km ≈ 15 M km (~0.1 AU). Plan-suggested
// value. Aggressive enough that the camera doesn't accumulate large
// coordinates within a system; loose enough that rebase doesn't fire on
// every frame during normal motion.
export const REBASE_THRESHOLD_SQ = 100 * 100;

// Accumulated offset between the rendering origin and "true" world origin.
// `world_true = scene_local + worldOrigin`. Code that needs absolute world
// position reads via `getWorldTrue(localPos)`; most code operates on
// relative positions and is rebase-transparent.
export const worldOrigin = new THREE.Vector3();

// Listeners notified after each rebase event with `(offset, worldOrigin)`.
// Use for controllers that hold cached Vector3 state needing the same
// subtraction the scene-graph received.
const _listeners = [];

// Auto-tracked Vector3s. Each rebase event applies `vec.sub(offset)` so
// callers don't have to write the subscription themselves. Use for simple
// cached positions (target vectors, look-at points, captured starts).
const _trackedVectors = [];

// Scratch to avoid allocating per-frame.
const _scratchOffset = new THREE.Vector3();

/**
 * Subscribe to rebase events. Listener is called with `(offset, worldOrigin)`
 * after the camera + scene-graph subtraction has been applied. Return value
 * is an unsubscribe function.
 *
 * @param {(offset: THREE.Vector3, worldOrigin: THREE.Vector3) => void} fn
 * @returns {() => void} unsubscribe
 */
export function onRebase(fn) {
  _listeners.push(fn);
  return () => {
    const i = _listeners.indexOf(fn);
    if (i >= 0) _listeners.splice(i, 1);
  };
}

/**
 * Track a Vector3 to receive automatic `.sub(offset)` on rebase events.
 * For cached positions in controllers / state objects. Returns an
 * untrack function to remove the tracking when the vector is no longer
 * live (e.g., when a controller resets its state).
 *
 * @param {THREE.Vector3} vec
 * @returns {() => void} untrack
 */
export function trackForRebase(vec) {
  _trackedVectors.push(vec);
  return () => {
    const i = _trackedVectors.indexOf(vec);
    if (i >= 0) _trackedVectors.splice(i, 1);
  };
}

/**
 * Resolve a local (rebased) position to its true world position. Useful
 * for telemetry, logging, save-game, networking — anywhere that needs the
 * coordinate stable across rebase events. Mutates `out` if provided.
 *
 * @param {THREE.Vector3} localPos
 * @param {THREE.Vector3} [out]
 * @returns {THREE.Vector3}
 */
export function getWorldTrue(localPos, out) {
  out = out || new THREE.Vector3();
  return out.copy(localPos).add(worldOrigin);
}

/**
 * Inverse of `getWorldTrue`: convert a true world position into the
 * current rebased frame. Useful when external systems (galactic map,
 * save-game load, spawn-anchor logic) provide world coords that need to
 * land in the current rendering frame. Mutates `out` if provided.
 *
 * @param {THREE.Vector3} worldPos
 * @param {THREE.Vector3} [out]
 * @returns {THREE.Vector3}
 */
export function fromWorldTrue(worldPos, out) {
  out = out || new THREE.Vector3();
  return out.copy(worldPos).sub(worldOrigin);
}

/**
 * Per-frame rebase check. Call once per frame, AFTER the camera has been
 * positioned for this frame (camera-controller / autopilot / warp updates)
 * and BEFORE per-frame logic that consumes object world positions (sky
 * uniforms, shader writes, traversal checks, render).
 *
 * If `camera.position.lengthSq() < REBASE_THRESHOLD_SQ`, returns false and
 * does nothing. Otherwise:
 *   1. Captures the camera's current position as `offset`.
 *   2. Adds offset to `worldOrigin`.
 *   3. Resets `camera.position` to (0, 0, 0).
 *   4. Subtracts offset from every top-level child of `scene` (descendants
 *      inherit via the parent transform). Skips the camera itself if it's
 *      attached to the scene.
 *   5. Subtracts offset from every tracked Vector3.
 *   6. Calls each listener with `(offset, worldOrigin)`.
 *
 * Returns true if a rebase happened this frame.
 *
 * @param {THREE.Camera} camera
 * @param {THREE.Scene} scene
 * @returns {boolean} whether a rebase fired this frame
 */
export function maybeRebase(camera, scene) {
  if (camera.position.lengthSq() < REBASE_THRESHOLD_SQ) return false;
  const offset = _scratchOffset.copy(camera.position);
  worldOrigin.add(offset);
  camera.position.set(0, 0, 0);
  // Top-level scene children get the offset subtracted. Descendants are
  // automatically correct because their world transform is parent ⊗ local;
  // we shifted the parent.
  for (const child of scene.children) {
    if (child === camera) continue;
    child.position.sub(offset);
  }
  // Camera ancestors (rare — most projects don't parent camera to anything)
  // not handled here; if camera has a parent that isn't `scene`, the rebase
  // assumption breaks. Audit during integration if this ever applies.
  for (const v of _trackedVectors) v.sub(offset);
  for (const fn of _listeners) fn(offset, worldOrigin);
  return true;
}

/**
 * Reset the worldOrigin to (0, 0, 0). For use at system swap (warp arrival)
 * or any other moment where the engine is moving the camera to a new place
 * via teleport rather than continuous motion. Resetting after a teleport
 * keeps the worldOrigin meaningful for code reading `getWorldTrue` and
 * avoids carrying drift forward across discontinuities.
 *
 * Does NOT touch scene children — the caller is responsible for placing
 * objects in the new frame.
 */
export function resetWorldOrigin() {
  worldOrigin.set(0, 0, 0);
}

// Debug accessor — current rebase state. Useful for HUD overlays and
// telemetry. Not part of the runtime API; call sites should use
// `worldOrigin` / `getWorldTrue` directly.
export function _debugState() {
  return {
    worldOrigin: [worldOrigin.x, worldOrigin.y, worldOrigin.z],
    threshold: Math.sqrt(REBASE_THRESHOLD_SQ),
    listeners: _listeners.length,
    trackedVectors: _trackedVectors.length,
  };
}
