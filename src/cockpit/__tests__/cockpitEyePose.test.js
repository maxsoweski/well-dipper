// The cockpit must sit square in the pilot's frame no matter where the ship is
// pointed, and it must agree with HeadMount about where the pilot is looking.
//
// The regression these pin: increment 7 posed the cockpit camera from the WORLD
// camera (`shipOrientation × headLook`), so the ship's heading rotated the whole
// cabin around the pilot. Measured live at 119° of cabin rotation with the head
// dead-centre. Test 1 goes red against that code; test 2 goes red against any
// fix that gets the Euler order or the multiply order wrong.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { cockpitEyeQuat } from '../cockpitEyePose.js';
import { HeadMount } from '../../flight/HeadMount.js';

const IDENTITY = new THREE.Quaternion();

/** Angle between two orientations, degrees. */
function angleDeg(a, b) {
  return THREE.MathUtils.radToDeg(a.angleTo(b));
}

/** A few ship attitudes that are nothing like identity. */
const SHIP_ATTITUDES = [
  [0, 0, 0],
  [0, Math.PI * 0.66, 0],       // the 119° yaw that was measured in game
  [0, Math.PI, 0],              // flying due south
  [0.4, -2.1, 0.9],             // rolled, pitched and yawed
];

describe('cockpitEyeQuat', () => {
  it('is square to the cabin whenever the head is centred, on ANY heading', () => {
    const out = new THREE.Quaternion();
    for (const [x, y, z] of SHIP_ATTITUDES) {
      // The ship's attitude is deliberately not passed in — that is the point.
      // Building it here documents that the caller HAS one and it must not leak.
      const ship = new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z, 'YXZ'));
      expect(ship).toBeInstanceOf(THREE.Quaternion);
      cockpitEyeQuat(out, IDENTITY, 0, 0);
      expect(angleDeg(out, IDENTITY)).toBeLessThan(1e-4);
    }
  });

  it('reproduces the world camera when composed with the ship — so the canopy and the starfield agree', () => {
    const head = new HeadMount();
    const camera = new THREE.Object3D();
    const out = new THREE.Quaternion();
    const composed = new THREE.Quaternion();

    for (const [x, y, z] of SHIP_ATTITUDES) {
      const ship = new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z, 'YXZ'));
      for (const [yaw, pitch] of [[0, 0], [0.7, -0.3], [-1.2, 0.5]]) {
        head.held = true;
        head.yaw = yaw; head.pitch = pitch;
        head.applyTo(camera, new THREE.Vector3(), ship);

        cockpitEyeQuat(out, IDENTITY, head.yaw, head.pitch);
        composed.copy(ship).multiply(out);
        expect(angleDeg(composed, camera.quaternion)).toBeLessThan(1e-4);
      }
    }
  });

  it('honours an authored Eye_Point rotation rather than assuming -Z', () => {
    const eye = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, 0, 'YXZ'));
    const out = new THREE.Quaternion();
    cockpitEyeQuat(out, eye, 0, 0);
    expect(angleDeg(out, eye)).toBeLessThan(1e-4);

    // …and a head turn is applied IN THE EYE'S OWN FRAME, not the cabin's.
    // Pitching the head must raise the view. With the eye yawed 90°, composing
    // the other way round pitches about an axis the view already points down,
    // and the look does not move at all — so `forward.y` is the discriminator.
    // (A pure yaw would not catch it: two rotations about Y commute.)
    const PITCH = 0.5;
    cockpitEyeQuat(out, eye, 0, PITCH);
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(out);
    expect(forward.y).toBeCloseTo(Math.sin(PITCH), 5);
    expect(Math.abs(forward.x)).toBeCloseTo(Math.cos(PITCH), 5); // still yawed
    expect(forward.z).toBeCloseTo(0, 5);
  });
});
