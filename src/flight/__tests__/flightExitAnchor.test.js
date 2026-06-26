import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { flightExitAnchor } from '../flightExitAnchor.js';

// Camera distance range, mirrored from ShipCameraSystem (minDistance/maxDistance).
// These are the ACTUAL constants the live adoptCurrentPose clamps against; the
// test asserts the pose-preservation invariant survives that clamp. (Values are
// duplicated here, not imported, to keep this a pure headless unit test with no
// THREE-camera/DOM dependency — if the real constants change, this stays a
// faithful model of the clamp behavior.)
const MIN_DISTANCE = 0.01;
const MAX_DISTANCE = 50000;

// Inline re-implementation of ShipCameraSystem.adoptCurrentPose(anchor) +
// _applyOrbit(), reduced to the pose-relevant math. Returns the reconstructed
// camera position and look (forward) direction the live orbit would produce.
//   adoptCurrentPose:  offset = cameraPos - anchor
//                      yaw   = atan2(offset.x, offset.z)
//                      pitch = asin(clamp(offset.y/|offset|, -1, 1))
//                      dist  = clamp(|offset|, min, max)
//                      target = cameraPos - dist * unit(offset)   (for |offset|>1e-6)
//   _applyOrbit:       pos  = target + dist * sphericalDir(yaw, pitch)
//                      look = unit(target - pos)   (camera.lookAt(target))
function reconstructPose(cameraPos, anchor, minD = MIN_DISTANCE, maxD = MAX_DISTANCE) {
  const offset = new THREE.Vector3().copy(cameraPos).sub(anchor);
  const rawDist = offset.length();
  const yaw = Math.atan2(offset.x, offset.z);
  const pitch = Math.asin(Math.max(-1, Math.min(1, offset.y / (rawDist || 1))));
  const dist = Math.max(minD, Math.min(maxD, rawDist));

  const target = new THREE.Vector3();
  if (rawDist > 1e-6) {
    const dir = offset.clone().divideScalar(rawDist); // unit(offset)
    target.copy(cameraPos).addScaledVector(dir, -dist);
  } else {
    target.copy(anchor);
  }

  // _applyOrbit reconstruction: pos = target + dist * sphericalDir(yaw, pitch).
  const cosPitch = Math.cos(pitch);
  const pos = new THREE.Vector3(
    target.x + dist * Math.sin(yaw) * cosPitch,
    target.y + dist * Math.sin(pitch),
    target.z + dist * Math.cos(yaw) * cosPitch,
  );
  // camera.lookAt(target) → forward (world −Z) points from pos toward target.
  const look = new THREE.Vector3().copy(target).sub(pos).normalize();

  return { pos, look, dist, rawDist };
}

function expectVecClose(a, b, eps = 1e-6) {
  expect(a.x).toBeCloseTo(b.x, 6);
  expect(a.y).toBeCloseTo(b.y, 6);
  expect(a.z).toBeCloseTo(b.z, 6);
  // explicit magnitude check so the eps tolerance is documented, not just the
  // 6-decimal toBeCloseTo default.
  expect(a.distanceTo(b)).toBeLessThan(eps);
}

// A spread of camera poses + forwards (forwards normalized, as getWorldDirection
// returns). Distances chosen to land both inside [min,max] and outside (clamped).
const CASES = [
  { name: 'origin, +X look, mid distance', pos: [0, 0, 0], fwd: [1, 0, 0], d: 12 },
  { name: 'origin, -Z look, mid distance', pos: [0, 0, 0], fwd: [0, 0, -1], d: 8 },
  { name: 'offset pose, diagonal look', pos: [100, -50, 300], fwd: [0.6, 0.48, -0.64], d: 25 },
  { name: 'far pose, downward-ish look', pos: [-4200, 1800, 950], fwd: [-0.3, -0.9, 0.31622776601683794], d: 42 },
  { name: 'pose with tilted look up', pos: [7, 7, 7], fwd: [0, 0.7071067811865476, -0.7071067811865476], d: 16 },
];

describe('flightExitAnchor — value', () => {
  it('returns cameraPos + forward * distance', () => {
    const a = flightExitAnchor({ x: 1, y: 2, z: 3 }, { x: 0, y: 0, z: -1 }, 10);
    expect(a).toEqual({ x: 1, y: 2, z: -7 });
  });

  it('accepts THREE.Vector3-like inputs (reads x/y/z)', () => {
    const a = flightExitAnchor(new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 0, 0), 5);
    expect(a.x).toBeCloseTo(5, 6);
    expect(a.y).toBeCloseTo(0, 6);
    expect(a.z).toBeCloseTo(0, 6);
  });
});

describe('flightExitAnchor — pose-preservation contract (vs adoptCurrentPose)', () => {
  for (const c of CASES) {
    it(`reconstructs EXACT camera pos & forward — ${c.name}`, () => {
      const cameraPos = new THREE.Vector3(...c.pos);
      const forward = new THREE.Vector3(...c.fwd).normalize();

      const anchor = flightExitAnchor(cameraPos, forward, c.d);
      const { pos, look } = reconstructPose(cameraPos, new THREE.Vector3(anchor.x, anchor.y, anchor.z));

      expectVecClose(pos, cameraPos);          // position preserved exactly
      expectVecClose(look, forward);           // look/forward preserved exactly
    });
  }

  it('holds when distance > maxDistance (clamped high) — pos & forward still exact', () => {
    const cameraPos = new THREE.Vector3(123, -45, 678);
    const forward = new THREE.Vector3(0.2, -0.3, 0.9).normalize();
    const farD = MAX_DISTANCE * 3; // 150000 → clamps to 50000

    const anchor = flightExitAnchor(cameraPos, forward, farD);
    const { pos, look, dist, rawDist } = reconstructPose(cameraPos, new THREE.Vector3(anchor.x, anchor.y, anchor.z));

    expect(rawDist).toBeCloseTo(farD, 3);      // un-clamped raw distance == d
    expect(dist).toBeCloseTo(MAX_DISTANCE, 6); // clamp engaged
    expectVecClose(pos, cameraPos);            // clamp cancels out of position
    expectVecClose(look, forward);             // look direction unaffected by clamp
  });

  it('holds when distance < minDistance (clamped low) — pos & forward still exact', () => {
    const cameraPos = new THREE.Vector3(-10, 20, -30);
    const forward = new THREE.Vector3(-0.5, 0.5, -0.7071067811865476).normalize();
    const tinyD = MIN_DISTANCE / 5; // 0.002 → clamps up to 0.01

    const anchor = flightExitAnchor(cameraPos, forward, tinyD);
    const { pos, look, dist, rawDist } = reconstructPose(cameraPos, new THREE.Vector3(anchor.x, anchor.y, anchor.z));

    expect(rawDist).toBeCloseTo(tinyD, 6);     // un-clamped raw distance == d
    expect(dist).toBeCloseTo(MIN_DISTANCE, 6); // clamp engaged (up to min)
    expectVecClose(pos, cameraPos);            // clamp cancels out of position
    expectVecClose(look, forward);             // look direction unaffected by clamp
  });

  // Spec §2 "minor edge": Toy-Box lookAt is level, so the reconstructed forward
  // is exact but any pre-exit ROLL is dropped (a small bank change, not a
  // teleport). Position + forward are what the contract guarantees; documented
  // here so the level-out is an asserted, expected property, not a surprise.
  it('preserves forward exactly regardless of pre-exit roll (roll is leveled, not teleported)', () => {
    const cameraPos = new THREE.Vector3(50, 0, -50);
    const forward = new THREE.Vector3(0.1, 0.2, -0.97).normalize();

    const anchor = flightExitAnchor(cameraPos, forward, 20);
    const { pos, look } = reconstructPose(cameraPos, new THREE.Vector3(anchor.x, anchor.y, anchor.z));

    expectVecClose(pos, cameraPos);
    expectVecClose(look, forward); // forward (the look axis) is preserved; roll about it is not represented here
  });
});

describe('flightExitAnchor — purity', () => {
  it('does not mutate its inputs', () => {
    const cameraPos = { x: 3, y: -4, z: 5 };
    const forward = { x: 0, y: 0, z: -1 };
    const camSnapshot = { ...cameraPos };
    const fwdSnapshot = { ...forward };

    const result = flightExitAnchor(cameraPos, forward, 99);

    expect(cameraPos).toEqual(camSnapshot);    // camera position untouched
    expect(forward).toEqual(fwdSnapshot);      // forward untouched
    expect(result).not.toBe(cameraPos);        // returns a fresh object
    expect(result).not.toBe(forward);
  });

  it('does not mutate THREE.Vector3 inputs', () => {
    const cameraPos = new THREE.Vector3(1, 1, 1);
    const forward = new THREE.Vector3(0, 1, 0);
    flightExitAnchor(cameraPos, forward, 7);
    expect(cameraPos.x).toBe(1); expect(cameraPos.y).toBe(1); expect(cameraPos.z).toBe(1);
    expect(forward.x).toBe(0); expect(forward.y).toBe(1); expect(forward.z).toBe(0);
  });
});
