import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { faceQuaternion, alignStep, alignDot } from '../aimAssist.js';

const NEG_Z = new THREE.Vector3(0, 0, -1);

describe('faceQuaternion', () => {
  it('rotates the local nose (−Z) onto the direction to the target', () => {
    const q = new THREE.Quaternion();
    faceQuaternion(new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 0, 0), q); // target to +X
    const nose = NEG_Z.clone().applyQuaternion(q);
    expect(nose.x).toBeCloseTo(1, 6); expect(nose.y).toBeCloseTo(0, 6); expect(nose.z).toBeCloseTo(0, 6);
  });
});

describe('alignDot', () => {
  it('is 1 when already facing the target and < 1 when off-axis', () => {
    const facing = faceQuaternion(new THREE.Vector3(), new THREE.Vector3(1, 0, 0), new THREE.Quaternion());
    expect(alignDot(facing, new THREE.Vector3(), new THREE.Vector3(1, 0, 0))).toBeCloseTo(1, 6);
    const identity = new THREE.Quaternion(); // nose points −Z, target +X → orthogonal
    expect(alignDot(identity, new THREE.Vector3(), new THREE.Vector3(1, 0, 0))).toBeCloseTo(0, 6);
  });
});

describe('alignStep', () => {
  it('eases an off-axis orientation toward the target (monotone, converges to ~1)', () => {
    const o = new THREE.Quaternion(); // start nose at −Z
    const from = new THREE.Vector3(), to = new THREE.Vector3(1, 0, 0);
    let prev = alignDot(o, from, to);
    for (let i = 0; i < 200; i++) { alignStep(o, from, to, 1 / 60, 0.16); const d = alignDot(o, from, to); expect(d).toBeGreaterThanOrEqual(prev - 1e-9); prev = d; }
    expect(prev).toBeGreaterThan(0.999);
  });
});
