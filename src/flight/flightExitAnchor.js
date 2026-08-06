// Pure orbit-anchor primitive for the no-snap flight EXIT (F-off).
//
// On disengage we hand the camera's live world pose to the existing
// ShipCameraSystem.adoptCurrentPose(anchor). To leave the camera EXACTLY
// where it is — position AND look direction — the anchor must sit on the
// camera's OWN forward ray. This module computes that one point. No state,
// no mutation; operates on plain {x,y,z} or THREE.Vector3-like inputs (reads
// .x/.y/.z only), mirroring aimAssist.js's dependency-light style.
//
// ── POSE-PRESERVATION CONTRACT (asserted in __tests__/flightExitAnchor.test.js) ──
// Given adoptCurrentPose's reconstruction:
//     offset = cameraPos - anchor
//     yaw    = atan2(offset.x, offset.z)
//     pitch  = asin(offset.y / |offset|)
//     dist   = clamp(|offset|, minDistance, maxDistance)
//     target = cameraPos - dist * unit(offset)
//   then _applyOrbit reconstructs:
//     pos    = target + dist * sphericalDir(yaw, pitch)
//     look   = unit(target - pos)              // camera.lookAt(target)
// Anchoring on the camera's own forward ray:
//     anchor = cameraPos + forward * distance
// makes offset = -forward*distance, so unit(offset) = -forward and
// |offset| = distance. Therefore:
//     target = cameraPos + dist * forward
//     sphericalDir(yaw, pitch) == unit(offset) == -forward
//     pos    = (cameraPos + dist*forward) + dist*(-forward) == cameraPos  (EXACT)
//     look   = unit(target - cameraPos) == unit(dist*forward) == forward  (EXACT)
// The clamp on `dist` cancels out of the position, so the invariant holds
// even when `distance` is clamped above maxDistance or below minDistance.
// `distance` only sets the post-exit orbit-pivot scale (a sensible body
// distance to zoom around); it never moves the camera.
//
// `forward` is expected normalized (camera.getWorldDirection()); the contract
// derivation assumes |forward| ≈ 1.

/**
 * Orbit anchor for a no-snap exit: a point `distance` units ahead of the
 * camera along its forward direction. Returns a fresh {x,y,z}; inputs are
 * never mutated.
 *
 * @param {{x:number,y:number,z:number}} cameraPos - camera world position
 * @param {{x:number,y:number,z:number}} forward   - camera forward (world −Z), normalized
 * @param {number} distance - ray length (orbit-pivot scale); use the clamped body distance
 * @returns {{x:number,y:number,z:number}} anchor = cameraPos + forward * distance
 */
export function flightExitAnchor(cameraPos, forward, distance) {
  return {
    x: cameraPos.x + forward.x * distance,
    y: cameraPos.y + forward.y * distance,
    z: cameraPos.z + forward.z * distance,
  };
}
