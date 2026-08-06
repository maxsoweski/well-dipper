// Pure nose-orientation primitives shared by the autopilot pilot's HOLD look
// and Mode-B "align-on-select". No state — operates on caller-owned THREE objects.
import * as THREE from 'three';

const NEG_Z = new THREE.Vector3(0, 0, -1); // local nose
const _dir = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _local = new THREE.Vector3();
const _inv = new THREE.Quaternion();

// Quaternion that points local −Z at `to` from `from`. Writes + returns outQ.
export function faceQuaternion(from, to, outQ) {
  _dir.copy(to).sub(from).normalize();
  return outQ.setFromUnitVectors(NEG_Z, _dir);
}

// One exponential-slerp step toward facing `to` from `from`. tau seconds
// (smaller = snappier). Mutates + returns `orientation`.
export function alignStep(orientation, from, to, dt, tau = 0.16) {
  faceQuaternion(from, to, _q);
  orientation.slerp(_q, 1 - Math.exp(-dt / tau));
  return orientation;
}

// Nose-to-target alignment: −localZ component of the unit direction to `to`.
// 1 = dead-on. Compare against PILOT_TUNING.ALIGN_DOT (0.995).
export function alignDot(orientation, from, to) {
  _dir.copy(to).sub(from).normalize();
  _local.copy(_dir).applyQuaternion(_inv.copy(orientation).invert());
  return -_local.z;
}

// Steer-toward-body turn command in the ship-local frame — extracted verbatim
// from SupercruisePilot.update (:93-101). Direction (toBody − from) is rotated
// into local space by inverse(orientation); local −Z is the nose, x>0 ⇒ target
// to the right, y>0 ⇒ above. Pure: reads caller-owned THREE objects, mutates
// none of them; uses module scratch internally. Returns clamped −1..1 each;
// exact antiparallel (target dead astern) ⇒ yaw = 1 (the ALIGN-hang escape).
const _steerOut = { yaw: 0, pitch: 0 };
export function steerToward(orientation, from, toBody, steerGain, out = _steerOut) {
  _dir.copy(toBody).sub(from).normalize()
    .applyQuaternion(_inv.copy(orientation).invert());
  let yaw = THREE.MathUtils.clamp(-_dir.x * steerGain, -1, 1);
  const pitch = THREE.MathUtils.clamp(_dir.y * steerGain, -1, 1);
  // Exact antiparallel (target dead astern) → zero steering → permanent ALIGN hang.
  if (_dir.z > 0 && Math.hypot(_dir.x, _dir.y) < 1e-6) yaw = 1;
  out.yaw = yaw; out.pitch = pitch;
  return out;
}
