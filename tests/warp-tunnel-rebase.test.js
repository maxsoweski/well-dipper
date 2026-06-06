// Regression: the warp HYPER tunnel intermittently failed to render ("black
// HYPER"), especially on repeat warps in a session and warps to far targets.
//
// LIVE DIAGNOSIS (2026-06-06, chrome-devtools GPU 9223) — this overturned the
// scoped hypothesis and is what these tests encode:
//
//   • The HYPER tunnel mesh (warpPortal._tunnel) is MICROSCOPIC — tunnelLength
//     ≈ 6.7e-5 scene units, radius ≈ 1.3e-7 (ship scale). It is only visible
//     because it SURROUNDS the camera; the streaming motion is texture-driven
//     (uScroll), not camera travel. The camera is effectively static during
//     HYPER (cameraForwardSpeed = _hyperSpeed ≈ 2.2e-5 u/s — covers the tiny
//     tunnel in HYPER_DUR), so it never crosses the rebase threshold.
//
//   • Therefore NO worldOrigin rebase fires during HYPER and worldOrigin is
//     CONSTANT across the whole HYPER window (measured: rebaseDuringHyper = 0).
//     The scoped "Face B = a rebase/resetWorldOrigin frame-shift orphans the
//     tunnel mid-HYPER" does NOT occur. `maybeRebase` would not orphan the
//     tunnel anyway: warpPortal.group is a top-level scene child, so the
//     per-frame scene-graph subtract carries it WITH the camera (test below).
//
//   • The actual orphan: the tunnel is anchored to the camera ONCE at swap,
//     and that single anchor is unreliable across the repeat-warp / fallback-
//     timer / teleport paths. When it lands even a little off, a microscopic
//     tunnel sitting hundreds of units from the camera does not surround it →
//     the camera sees straight through to the starfield → "black HYPER"
//     (measured camera→tunnel distance on broken repeat warps: 565–1921 u).
//
// THE FIX (continuous re-anchor): every HYPER frame, pin warpPortal.group to
// the camera and force INSIDE render mode. This makes the tunnel immune to
// which swap path ran, to traversal-state noise, AND — as a defensive bonus —
// to any worldOrigin change (rebase or reset), which is the invariant AC1 asks
// for. The production pin lives in main.js (not unit-importable, like the body
// rewrite); these tests pin the rule + the geometric invariant against the
// real WorldOrigin module, sibling to orbit-ring-rebase.test.js.

import { describe, test, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import {
  worldOrigin,
  maybeRebase,
  resetWorldOrigin,
} from '../src/core/WorldOrigin.js';

// The production per-frame rule the fix introduces (main.js HYPER block):
// the tunnel group's render position IS the camera's render position.
function pinTunnelToCamera(group, camera) {
  group.position.copy(camera.position);
}

// Camera→tunnel separation in the render frame. The tunnel only surrounds the
// camera (and so renders) when this is ~0; a microscopic tunnel any meaningful
// distance away is invisible.
function cameraRelativeOffset(group, camera) {
  return group.position.distanceTo(camera.position);
}

function freshScene() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera();
  scene.add(camera);
  const group = new THREE.Group(); // stand-in for warpPortal.group
  scene.add(group);
  return { scene, camera, group };
}

// Grow worldOrigin the way warp camera motion does: push the camera past the
// rebase threshold and let maybeRebase fold the offset into worldOrigin and
// subtract it from every top-level scene child.
function warpAccumulate(scene, camera, x, y, z) {
  camera.position.set(x, y, z);
  return maybeRebase(camera, scene);
}

describe('warp tunnel anchoring under coordinate-frame shifts (AC1)', () => {
  beforeEach(() => {
    resetWorldOrigin();
  });

  // ── The core fix invariant ────────────────────────────────────────────────
  test('a per-frame camera-pinned tunnel stays at the camera across a maybeRebase shift', () => {
    const { scene, camera, group } = freshScene();

    // Tunnel anchored at the camera (HYPER start).
    camera.position.set(0, 0, 0);
    pinTunnelToCamera(group, camera);
    expect(cameraRelativeOffset(group, camera)).toBeCloseTo(0, 6);

    // A maybeRebase-style frame shift fires (camera past threshold). The next
    // frame re-pins the tunnel to the (recentered) camera.
    expect(warpAccumulate(scene, camera, 250, 8, -120)).toBe(true);
    pinTunnelToCamera(group, camera);

    expect(cameraRelativeOffset(group, camera)).toBeCloseTo(0, 6);
  });

  test('a per-frame camera-pinned tunnel stays at the camera across a resetWorldOrigin zeroing', () => {
    const { scene, camera, group } = freshScene();

    // Grow worldOrigin (warp camera motion), then anchor the tunnel.
    warpAccumulate(scene, camera, 250, 8, -120);
    expect(worldOrigin.length()).toBeGreaterThan(1);
    pinTunnelToCamera(group, camera);
    expect(cameraRelativeOffset(group, camera)).toBeCloseTo(0, 6);

    // resetWorldOrigin zeroes worldOrigin and does NOT touch scene children.
    resetWorldOrigin();
    expect(worldOrigin.lengthSq()).toBeCloseTo(0, 10);
    // The per-frame pin re-anchors regardless — offset stays 0.
    pinTunnelToCamera(group, camera);

    expect(cameraRelativeOffset(group, camera)).toBeCloseTo(0, 6);
  });

  test('a per-frame camera-pinned tunnel follows the camera when it moves (no orphan)', () => {
    const { camera, group } = freshScene();

    camera.position.set(0, 0, 0);
    pinTunnelToCamera(group, camera);

    // The swap teleports the camera to the destination approach position.
    camera.position.set(0, 2, 2800);
    pinTunnelToCamera(group, camera); // fix: re-pin every frame

    expect(cameraRelativeOffset(group, camera)).toBeCloseTo(0, 6);
  });

  // ── Characterization: the bug (single anchor, no per-frame pin) ────────────
  test('characterization: a tunnel anchored ONCE is orphaned when the camera then moves (microscopic tunnel → black HYPER)', () => {
    const { camera, group } = freshScene();

    // Single anchor at swap (the pre-fix behavior).
    camera.position.set(0, 0, 0);
    pinTunnelToCamera(group, camera);

    // Camera moves/teleports; the tunnel is NOT re-pinned.
    camera.position.set(0, 2, 2800);

    // The microscopic tunnel is now ~2800 u from the camera — nowhere near
    // surrounding it. This is the orphan that renders as black HYPER.
    expect(cameraRelativeOffset(group, camera)).toBeCloseTo(2800.0007, 2);
    expect(cameraRelativeOffset(group, camera)).toBeGreaterThan(1);
  });

  // ── Pins the live finding that refutes the scoped Face-B ───────────────────
  test('maybeRebase does NOT orphan a scene-child tunnel (refutes "rebase shifts the frame out from under the tunnel")', () => {
    const { scene, camera, group } = freshScene();

    // Anchor the tunnel at the camera; both are top-level scene children, and
    // both sit at the same threshold-crossing position (as they do mid-HYPER
    // once the tunnel is pinned to the camera).
    camera.position.set(250, 8, -120);
    group.position.copy(camera.position);
    expect(cameraRelativeOffset(group, camera)).toBeCloseTo(0, 6);

    // A rebase fires WITHOUT any per-frame re-pin. maybeRebase recenters the
    // camera to (0,0,0) and subtracts the SAME offset from the group (a scene
    // child), so the camera-relative offset is preserved entirely on its own —
    // rebase is not the orphan source.
    expect(maybeRebase(camera, scene)).toBe(true);
    expect(camera.position.lengthSq()).toBeCloseTo(0, 6); // camera recentered
    expect(group.position.lengthSq()).toBeCloseTo(0, 6);  // group followed
    expect(cameraRelativeOffset(group, camera)).toBeCloseTo(0, 6);
  });

  // ── resetWorldOrigin desyncs a never-re-pinned tunnel from the bodies ──────
  test('characterization: resetWorldOrigin desyncs a single-anchored tunnel from the per-frame-rebased bodies', () => {
    const { scene, camera, group } = freshScene();

    // Warp grows worldOrigin; anchor the tunnel once in that frame.
    warpAccumulate(scene, camera, 250, 8, -120);
    const wo = worldOrigin.clone();
    group.position.copy(camera.position);
    const tunnelPosBeforeReset = group.position.clone();

    // A body renders at trueOffset - worldOrigin (here trueOffset = barycenter
    // 0). resetWorldOrigin zeroes worldOrigin, so the body jumps by +worldOrigin
    // while the once-anchored tunnel does not move → they desync by worldOrigin.
    const bodyBeforeReset = new THREE.Vector3(0, 0, 0).sub(worldOrigin);
    resetWorldOrigin();
    const bodyAfterReset = new THREE.Vector3(0, 0, 0).sub(worldOrigin);

    const bodyJump = bodyAfterReset.distanceTo(bodyBeforeReset);
    expect(bodyJump).toBeCloseTo(wo.length(), 5);
    // The tunnel, anchored once, did NOT move across the reset (resetWorldOrigin
    // touches no scene children) — so without a per-frame re-pin it desyncs from
    // the jumped bodies by exactly worldOrigin. (The fix re-pins, so it tracks.)
    expect(group.position.distanceTo(tunnelPosBeforeReset)).toBeCloseTo(0, 6);
    expect(bodyJump).toBeGreaterThan(1);
  });
});
