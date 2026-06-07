// CameraInterpolator: fixed-timestep render interpolation for the camera.
// The sim advances the camera at 60Hz; renderFrame blends prev/curr snapshots
// at the display refresh rate so motion is smooth between ticks. The blend
// ASSUMES continuous motion between snapshots — two discontinuities break that
// and must be announced: a world-origin rebase (shiftOnRebase) and a teleport
// (resync).
//
// Root cause these tests pin (2026-06-07 deep diagnosis of AC4 warp emergence):
// the warp swap teleport runs in an async microtask that lands AFTER a sim
// snapshot but BEFORE the next render. Without resync(), the very next render
// blends two stale (pre-teleport) snapshots and overwrites camera.position back
// to the pre-teleport value — erasing the teleport. The camera then never
// reaches the (correctly anchored) Portal B, so the OUTSIDE_B emergence crossing
// never fires and onComplete force-flips the mode every warp.
import { describe, test, expect } from 'vitest';
import * as THREE from 'three';
import { CameraInterpolator } from '../src/core/CameraInterpolator.js';

// Minimal camera stand-in: just the position + quaternion the interpolator reads
// and writes. No WebGL/DOM needed.
function makeCam(pos = new THREE.Vector3(), quat = new THREE.Quaternion()) {
  return { position: pos.clone(), quaternion: quat.clone() };
}

describe('CameraInterpolator: the alpha blend (normal continuous motion)', () => {
  test('applyTo lerps position and slerps orientation between prev and curr by alpha', () => {
    const interp = new CameraInterpolator();
    const cam = makeCam(new THREE.Vector3(0, 0, 0));
    interp.shift(cam);                       // init: prev = curr = (0,0,0)
    cam.position.set(0, 0, 10);              // sim advanced the camera
    interp.snapshot(cam);                    // curr = (0,0,10)

    interp.applyTo(cam, 0.5);                // render at half-way alpha
    expect(cam.position.z).toBeCloseTo(5, 6); // blended between prev(0) and curr(10)
  });

  test('a second tick shifts curr into prev so the next blend spans the new interval', () => {
    const interp = new CameraInterpolator();
    const cam = makeCam(new THREE.Vector3(0, 0, 0));
    interp.shift(cam); cam.position.set(0, 0, 10); interp.snapshot(cam);  // [0 -> 10]
    interp.shift(cam);                       // prev <- curr (10)
    cam.position.set(0, 0, 20); interp.snapshot(cam);                      // [10 -> 20]
    interp.applyTo(cam, 0.25);
    expect(cam.position.z).toBeCloseTo(12.5, 6); // between 10 and 20
  });
});

describe('CameraInterpolator: teleport discontinuity (AC4 root cause)', () => {
  test('without resync, a teleport landing after the snapshot is REVERTED by the blend', () => {
    // Characterizes the bug: prev/curr both hold the pre-teleport pose, so the
    // blend snaps the camera back, erasing the teleport.
    const interp = new CameraInterpolator();
    const cam = makeCam(new THREE.Vector3(0, 0, -13.8));
    interp.shift(cam); interp.snapshot(cam); // prev = curr = -13.8
    interp.shift(cam);                       // next tick: prev = curr = -13.8
    cam.position.set(0, 0, 2555.6);          // async swap teleport lands here
    interp.applyTo(cam, 0.92);               // render blends the stale snapshots
    expect(cam.position.z).toBeCloseTo(-13.8, 1); // teleport gone (the bug)
  });

  test('resync after a teleport makes the next blend a no-op so the teleport STICKS', () => {
    const interp = new CameraInterpolator();
    const cam = makeCam(new THREE.Vector3(0, 0, -13.8));
    interp.shift(cam); interp.snapshot(cam); interp.shift(cam);
    cam.position.set(0, 0, 2555.6);          // the teleport
    interp.resync(cam);                      // THE FIX — rebaseline both snapshots
    interp.applyTo(cam, 0.92);
    expect(cam.position.z).toBeCloseTo(2555.6, 6); // teleport preserved
    // and at any alpha (multiple renders per tick at 240Hz / 60Hz sim):
    interp.applyTo(cam, 0.17);
    expect(cam.position.z).toBeCloseTo(2555.6, 6);
  });

  test('resync also rebaselines orientation (the teleport re-aims the camera)', () => {
    const interp = new CameraInterpolator();
    const cam = makeCam(
      new THREE.Vector3(0, 0, 0),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0),
    );
    interp.shift(cam); interp.snapshot(cam); interp.shift(cam);
    // teleport re-aims 90° about Y (camera.lookAt(starPos) at the swap):
    const aimed = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
    cam.quaternion.copy(aimed);
    interp.resync(cam);
    interp.applyTo(cam, 0.5);
    expect(cam.quaternion.angleTo(aimed)).toBeCloseTo(0, 6); // no slerp-back
  });
});

describe('CameraInterpolator: rebase discontinuity (existing behavior, preserved)', () => {
  test('shiftOnRebase keeps a stationary world point fixed across a coordinate shift', () => {
    // Before rebase: camera true-world Z = 50 (local 50, origin 0). After a
    // rebase of offset 50, camera local = 0 but its TRUE position is unchanged.
    // The blend must not jump: shiftOnRebase subtracts the offset from both snaps.
    const interp = new CameraInterpolator();
    const cam = makeCam(new THREE.Vector3(0, 0, 50));
    interp.shift(cam); interp.snapshot(cam); // prev = curr = 50 (local)
    // rebase: world-origin += 50, camera recentered to 0.
    const offset = new THREE.Vector3(0, 0, 50);
    interp.shiftOnRebase(offset);
    cam.position.set(0, 0, 0);
    interp.applyTo(cam, 0.5);
    // Blended local stays at 0 (prev/curr both shifted to 0) — no visible jump.
    expect(cam.position.z).toBeCloseTo(0, 6);
  });
});
