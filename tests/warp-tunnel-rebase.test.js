// Pocket-traversal: the warp tunnel is a human-scale pocket the camera flies
// through. These tests pin the OUTSIDE_A -> INSIDE -> OUTSIDE_B mode sequence
// (AC2 entry, AC4 emergence) via the pure plane-crossing state machine, and
// the load-adaptive emergence gate (AC5). Replaces the camera-pin invariant
// tests (mechanism reverted in Task 0).
import { describe, test, expect } from 'vitest';
import * as THREE from 'three';
import { createTraversal, stepTraversal } from '../src/effects/portalTraversal.js';

// A 60u pocket on the -Z axis: Portal A at z=0 facing +Z, Portal B at z=-60
// facing -Z, disc radius 3 (matches the lab).
const A_POS = new THREE.Vector3(0, 0, 0);
const A_NRM = new THREE.Vector3(0, 0, 1);
const B_POS = new THREE.Vector3(0, 0, -60);
const B_NRM = new THREE.Vector3(0, 0, -1);
const R = 3;

function flyThrough(zSamples) {
  let state = createTraversal('OUTSIDE_A');
  const modes = [];
  for (const z of zSamples) {
    const cam = new THREE.Vector3(0, 0, z);
    state = stepTraversal(state, { camPos: cam, aPos: A_POS, aNrm: A_NRM, bPos: B_POS, bNrm: B_NRM, discRadius: R });
    modes.push(state.mode);
  }
  return modes;
}

describe('pocket traversal mode sequence (AC2 entry / AC4 emergence)', () => {
  test('flying forward down the axis goes OUTSIDE_A -> INSIDE -> OUTSIDE_B', () => {
    // Start in front of Portal A (z>0), fly to behind Portal B (z<-60).
    const modes = flyThrough([20, 5, 1, -1, -30, -59, -61, -70]);
    expect(modes[0]).toBe('OUTSIDE_A');
    expect(modes).toContain('INSIDE');
    expect(modes[modes.length - 1]).toBe('OUTSIDE_B');
    // Order: first INSIDE index < first OUTSIDE_B index.
    expect(modes.indexOf('INSIDE')).toBeLessThan(modes.indexOf('OUTSIDE_B'));
    expect(modes.indexOf('INSIDE')).toBeGreaterThan(0); // not forced at start
  });

  test('a crossing off-axis (outside disc radius) does NOT enter', () => {
    let state = createTraversal('OUTSIDE_A');
    const cam = new THREE.Vector3(10, 0, -1); // past the plane but lat=10 > R
    state = stepTraversal(state, { camPos: cam, aPos: A_POS, aNrm: A_NRM, bPos: B_POS, bNrm: B_NRM, discRadius: R });
    expect(state.mode).toBe('OUTSIDE_A');
  });

  test('non-axis-aligned pocket: gate uses true perpendicular distance, not world-XY', () => {
    // Portal A at an arbitrary world position, facing world +X (normal along X).
    // The pocket axis runs along X, so lateral offset is measured in the Y-Z plane.
    // The OLD lat() (sqrt(dx^2+dy^2), Z dropped) would mis-gate any Z offset.
    // Portal A faces +X, so OUTSIDE_A is the +X side; the camera enters by flying
    // in the -X direction (dotA goes positive -> negative, mirroring the +Z fixture).
    const aPos = new THREE.Vector3(1000, 500, -200);
    const aNrm = new THREE.Vector3(1, 0, 0);
    const bPos = new THREE.Vector3(940, 500, -200); // 60u down -X (the pocket axis)
    const bNrm = new THREE.Vector3(-1, 0, 0);

    // (a) On-axis forward fly-through (along -X, lateral = 0) enters: OUTSIDE_A -> INSIDE.
    let onAxis = createTraversal('OUTSIDE_A');
    const onAxisModes = [];
    for (const x of [1020, 1005, 1001, 999, 970]) {
      const cam = new THREE.Vector3(x, 500, -200);
      onAxis = stepTraversal(onAxis, { camPos: cam, aPos, aNrm, bPos, bNrm, discRadius: R });
      onAxisModes.push(onAxis.mode);
    }
    expect(onAxisModes[0]).toBe('OUTSIDE_A');
    expect(onAxisModes).toContain('INSIDE');

    // (b) Crossing past the plane but laterally beyond discRadius along WORLD Z
    // (the component the old XY-only lat() dropped) must NOT enter.
    // dz = -10 from axis => true lateral = 10 > R; old lat would compute 0 and wrongly enter.
    let offZ = createTraversal('OUTSIDE_A');
    offZ = stepTraversal(offZ, { camPos: new THREE.Vector3(1020, 500, -210), aPos, aNrm, bPos, bNrm, discRadius: R });
    offZ = stepTraversal(offZ, { camPos: new THREE.Vector3(999, 500, -210), aPos, aNrm, bPos, bNrm, discRadius: R });
    expect(offZ.mode).toBe('OUTSIDE_A');
  });

  test('entry is a real crossing, not a forced set', () => {
    // One step where the camera is already past the plane but we never called
    // a force-set: mode only flips because the plane was crossed between steps.
    let state = createTraversal('OUTSIDE_A');
    state = stepTraversal(state, { camPos: new THREE.Vector3(0,0,5), aPos:A_POS,aNrm:A_NRM,bPos:B_POS,bNrm:B_NRM,discRadius:R });
    expect(state.mode).toBe('OUTSIDE_A'); // seeds dot history, no crossing yet
    state = stepTraversal(state, { camPos: new THREE.Vector3(0,0,-1), aPos:A_POS,aNrm:A_NRM,bPos:B_POS,bNrm:B_NRM,discRadius:R });
    expect(state.mode).toBe('INSIDE'); // crossing detected
  });
});
