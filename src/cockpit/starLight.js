// src/cockpit/starLight.js
//
// WHERE THE SYSTEM'S STAR IS, EXPRESSED IN THE COCKPIT'S OWN SPACE.
//
// Max, 2026-07-30: lighting for the cockpit and canopy glass — the models lit
// by the system's star. The cockpit renders as its own pass with its own scene,
// origin-anchored and static, so a light inside it knows nothing about the
// world unless something carries the direction across. This is that carry, and
// it is one line of quaternion algebra with one trap in it.
//
// ⭐ THE TRAP, AND IT IS THE EXACT INVERSE OF `cockpitEyePose.js`.
//
// That module exists because the ship's HEADING MUST NOT APPEAR in the cockpit
// camera's orientation: the cabin does not rotate around the pilot when the
// ship turns, and posing the camera with the world camera's absolute quaternion
// swung the whole cockpit 119° on a 119° turn.
//
// The star light is the opposite. The star DOES move relative to the cabin when
// the ship turns — that is the entire point of the feature, the thing that
// makes a turn feel like a turn from inside. So the heading MUST appear here.
//
// Two neighbouring functions, one frame problem, opposite answers. Getting them
// the same way round is the plausible mistake: a cabin whose lighting is welded
// to the hull looks *lit*, raises no error, and simply never changes.
//
//     d_cockpit = eyeQuat × shipOrientation⁻¹ × normalize(starWorld − shipWorld)
//
// ⭐ AND THE PILOT'S HEAD IS ABSENT, DELIBERATELY. Turning your head does not
// move where the sunlight falls on the dashboard. Routing this through the two
// CAMERAS instead — world-camera-inverse then cockpit-camera — algebraically
// cancels the head and lands on the same answer, but only because both cameras
// carry the same look term. That cancellation is a coincidence of today's
// implementation, not a property of the problem, and it would break silently the
// first time head decoupling gives the two cameras different look terms. Taking
// the SHIP and the EYE directly is head-independent by construction.
//
// `eyeQuat` is the authored `Eye_Point`'s own rotation — identity in today's
// GLB, and carried for the same reason `cockpitEyePose` carries it: a future
// model that seats the pilot facing something other than −Z still lands square.
import * as THREE from 'three';

const _q = new THREE.Quaternion();

/**
 * The direction FROM the pilot TOWARD the star, in cockpit-scene space.
 *
 * @param {THREE.Vector3} out written in place and returned
 * @param {THREE.Vector3} starWorld the star's position, scene space
 * @param {THREE.Vector3} shipWorld the ship's position, the SAME scene space
 * @param {THREE.Quaternion} shipOrientation the hull's orientation (`scModel.orientation`)
 * @param {THREE.Quaternion} eyeQuat the rig's authored `Eye_Point` rotation
 * @returns {THREE.Vector3|null} `out`, unit length — or **null** when the ship
 *   is sitting exactly on the star and there is no direction to give. A
 *   normalised zero vector is silently (0,0,0) in three, which a
 *   DirectionalLight reads as "target and position coincide" and renders as an
 *   unlit scene with no error anywhere. The caller must decide what to do about
 *   that; this cannot decide for it.
 */
export function starDirInCockpit(out, starWorld, shipWorld, shipOrientation, eyeQuat) {
  out.subVectors(starWorld, shipWorld);
  if (out.lengthSq() === 0) return null;
  out.normalize();
  // World → hull-relative. The heading appears HERE, and that is the feature.
  _q.copy(shipOrientation).invert();
  out.applyQuaternion(_q);
  // Hull-relative → the cabin's own frame, for a seat that may not face −Z.
  out.applyQuaternion(eyeQuat);
  return out;
}

/**
 * A star's `data.color` triple as something a THREE.Light will take.
 *
 * `StarSystemGenerator` stores spectral colour as `[r, g, b]` floats in 0..1 —
 * O and B come out blue-white, K and M amber. Feeding that straight to the key
 * light is what makes a red-dwarf system feel like a different place from a
 * blue-giant one, and it is the cheapest half of this whole feature.
 *
 * ⚠ RETURNS null RATHER THAN A DEFAULT for anything malformed. A default here
 * would be a second, invisible place where the cabin's key colour is decided,
 * and the rig already has one it can fall back to on purpose.
 */
export function starLightColor(data) {
  const c = data && data.color;
  if (!Array.isArray(c) || c.length < 3) return null;
  if (!c.slice(0, 3).every((v) => Number.isFinite(v))) return null;
  return { r: c[0], g: c[1], b: c[2] };
}
