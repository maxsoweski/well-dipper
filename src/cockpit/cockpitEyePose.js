// src/cockpit/cockpitEyePose.js
//
// The cockpit camera's ORIENTATION, in the cockpit's own space.
//
// ⭐ WHY THIS EXISTS AS ITS OWN FUNCTION. The cockpit model is static at
// identity inside `CockpitRig.scene` — nothing ever rotates it. So the ONLY
// thing that can turn the cockpit on screen is the cockpit camera's own
// quaternion, and the frame of reference that quaternion is expressed in is the
// SHIP's, not the world's.
//
// Increment 7 posed it with `_cockpitCamera.quaternion.copy(camera.quaternion)`,
// i.e. the WORLD camera's absolute orientation — which is
// `shipOrientation × headLook`. With the head dead-centre and the ship on any
// heading but due-north that is a pure ship-heading rotation applied to a
// stationary cabin: fly a 119° turn and the whole cockpit swings 119° around the
// pilot, so screen-forward (where the ship actually goes) points out of the side
// wall. Measured live 2026-07-30: head 0°, cockpit camera 119.0° off-axis,
// ship 119.5° off-axis.
//
// The ship's heading must NOT appear here. The pilot's head does, because that
// is the one thing that genuinely turns inside the cabin. `eyeQuat` is the
// authored `Eye_Point`'s own world rotation (identity in today's GLB, captured
// since increment 2 and until now unused) so a future model that seats the pilot
// facing something other than -Z still lands square.
import * as THREE from 'three';

const _euler = new THREE.Euler(0, 0, 0, 'YXZ');
const _look = new THREE.Quaternion();

/**
 * Cockpit-space orientation for the pilot's eye.
 *
 * The Euler order is 'YXZ' and the argument order is (pitch, yaw) to match
 * `HeadMount.applyTo` exactly — the two must agree or the world seen through
 * the canopy and the canopy itself disagree about where the pilot is looking.
 * `cockpitEyePose.test.js` pins that agreement rather than trusting the comment.
 *
 * @param {THREE.Quaternion} out  written in place and returned
 * @param {THREE.Quaternion} eyeQuat  the rig's authored Eye_Point rotation
 * @param {number} yaw    head yaw, radians (0 = nose-forward)
 * @param {number} pitch  head pitch, radians
 */
export function cockpitEyeQuat(out, eyeQuat, yaw, pitch) {
  _look.setFromEuler(_euler.set(pitch, yaw, 0, 'YXZ'));
  return out.copy(eyeQuat).multiply(_look);
}
