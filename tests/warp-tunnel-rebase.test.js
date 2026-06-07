// Pocket-traversal: the warp tunnel is a human-scale pocket the camera flies
// through. These tests pin the OUTSIDE_A -> INSIDE -> OUTSIDE_B mode sequence
// (AC2 entry, AC4 emergence) via the pure plane-crossing state machine, and
// the load-adaptive emergence gate (AC5). Replaces the camera-pin invariant
// tests (mechanism reverted in Task 0).
import { describe, test, expect } from 'vitest';
import * as THREE from 'three';
import { createTraversal, stepTraversal } from '../src/effects/portalTraversal.js';
import { WarpPortal } from '../src/effects/WarpPortal.js';
import {
  worldOrigin,
  getWorldTrue,
  fromWorldTrue,
  resetWorldOrigin,
} from '../src/core/WorldOrigin.js';

// Minimal fake standing in for a constructed WarpPortal so we can exercise the
// visibility logic in setTraversalMode/resetTraversal without a WebGL/DOM
// context (the real constructor builds canvas-textured strips). We invoke the
// real methods via .call() so the test pins actual behavior, not a copy.
function makeFakeNode() {
  return { visible: true, material: { stencilWrite: false, needsUpdate: false } };
}
function makeFakePortal(startMode = 'OUTSIDE_A') {
  return {
    _traversalMode: startMode,
    _trav: { mode: startMode },
    _tunnel: makeFakeNode(),
    _discA: makeFakeNode(), _discB: makeFakeNode(),
    _rimA: makeFakeNode(), _rimB: makeFakeNode(),
    _landingStrip: makeFakeNode(), _entryStrip: makeFakeNode(),
    onTraversal: null,
    setEntryStripProgress() {},
  };
}

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

describe('tunnel visibility lifecycle (no tunnel-follow in destination)', () => {
  // Bug A (2026-06-07): the tunnel mesh lives in warpPortal.group, the group is
  // rigidly re-anchored to the camera post-warp (main.js) so the player can look
  // back at Portal B — but the corridor was never hidden on emergence, so the
  // whole tunnel trailed the ship around the destination system.
  test('emerging into the destination (OUTSIDE_B) hides the tunnel', () => {
    const p = makeFakePortal('INSIDE');
    WarpPortal.prototype.setTraversalMode.call(p, 'OUTSIDE_B');
    expect(p._tunnel.visible).toBe(false);   // corridor is behind you — gone
    expect(p._discB.visible).toBe(true);     // Portal B ring stays as look-back anchor
    expect(p._rimB.visible).toBe(true);
    expect(p._discA.visible).toBe(false);
  });

  test('tunnel stays visible while approaching (OUTSIDE_A) and traversing (INSIDE)', () => {
    const a = makeFakePortal('INSIDE');
    WarpPortal.prototype.setTraversalMode.call(a, 'OUTSIDE_A');
    expect(a._tunnel.visible).toBe(true);

    const b = makeFakePortal('OUTSIDE_A');
    WarpPortal.prototype.setTraversalMode.call(b, 'INSIDE');
    expect(b._tunnel.visible).toBe(true);
  });

  test('resetTraversal re-shows the tunnel for the next warp after a prior OUTSIDE_B', () => {
    const p = makeFakePortal('OUTSIDE_B');
    p._tunnel.visible = false; // left hidden by the previous warp's emergence
    WarpPortal.prototype.resetTraversal.call(p);
    expect(p._traversalMode).toBe('OUTSIDE_A');
    expect(p._tunnel.visible).toBe(true);
  });
});

describe('rebase-proof pocket: Portal B stays reachable across teleport+reset+rebase (AC4)', () => {
  // Root cause (2026-06-07 second live diagnosis): warpSwapSystem teleports the
  // camera to a large coord and calls resetWorldOrigin() — which zeroes
  // worldOrigin but does NOT shift scene children. Because onSwapSystem is async,
  // its portal re-anchor races with the next frame's maybeRebase, so the group and
  // camera end up in different frames and Portal B sits 785-1730u away the whole
  // cruise (never reaching the 3u gate). The fix anchors the pocket in TRUE-WORLD
  // at the seam and rewrites group.position = anchorTrue - worldOrigin every warp
  // frame (the celestial-body pattern, main.js:6075). These tests pin that the
  // rewrite keeps Portal B at a fixed reachable distance across worldOrigin
  // changes, and that the OLD stale-placement (no rewrite) detaches it.
  //
  // Mirrors the main.js Step 4 per-frame placement: group local = anchor - wo.
  function placePocketLocal(anchorTrue, out) {
    return fromWorldTrue(anchorTrue, out); // == anchorTrue - worldOrigin
  }

  test('the rewrite keeps camera->PortalB local distance invariant under a rebase offset', () => {
    resetWorldOrigin();
    // Seam: camera teleported to a large destination-approach coord; pocket
    // origin (Portal A == camera) captured in true-world. Portal B is 60u ahead.
    const camTrue = new THREE.Vector3(3000, 0, 0);
    const axis = new THREE.Vector3(0, 0, -1);            // pocket runs down -Z
    worldOrigin.set(2950, 0, 0);                          // some pre-seam origin
    const camLocal = fromWorldTrue(camTrue, new THREE.Vector3());
    const anchorTrue = getWorldTrue(camLocal, new THREE.Vector3()); // == camTrue

    const groupLocal = placePocketLocal(anchorTrue, new THREE.Vector3());
    const portalBLocal0 = groupLocal.clone().addScaledVector(axis, 60);
    const dist0 = camLocal.distanceTo(portalBLocal0);
    expect(dist0).toBeCloseTo(60, 5);

    // A rebase fires: worldOrigin jumps, camera recenters to local origin. The
    // fix recomputes the group from the SAME true anchor.
    worldOrigin.set(3000, 0, 0);                          // camera recentered near 0
    const camLocalAfter = fromWorldTrue(camTrue, new THREE.Vector3()); // ~ (0,0,0)
    const groupLocalAfter = placePocketLocal(anchorTrue, new THREE.Vector3());
    const portalBLocalAfter = groupLocalAfter.clone().addScaledVector(axis, 60);
    const distAfter = camLocalAfter.distanceTo(portalBLocalAfter);

    expect(distAfter).toBeCloseTo(dist0, 5);              // reachable, unchanged
    resetWorldOrigin();
  });

  test('resetWorldOrigin (the swap path) does NOT detach a true-world-anchored Portal B', () => {
    resetWorldOrigin();
    const camTrue = new THREE.Vector3(1500, 200, -800);
    const axis = new THREE.Vector3(0, 0, -1);
    worldOrigin.set(1450, 180, -790);
    const anchorTrue = camTrue.clone();

    const groupBefore = placePocketLocal(anchorTrue, new THREE.Vector3());
    const portalBWorldBefore = getWorldTrue(
      groupBefore.clone().addScaledVector(axis, 60), new THREE.Vector3());

    // warpSwapSystem's resetWorldOrigin(): worldOrigin -> 0, children NOT shifted.
    resetWorldOrigin();
    // FIX: rewrite the group from the true anchor (not left stale).
    const groupAfter = placePocketLocal(anchorTrue, new THREE.Vector3());
    const portalBWorldAfter = getWorldTrue(
      groupAfter.clone().addScaledVector(axis, 60), new THREE.Vector3());

    // Portal B's TRUE-WORLD location is invariant — it did not teleport away.
    expect(portalBWorldAfter.distanceTo(portalBWorldBefore)).toBeLessThan(1e-6);
    resetWorldOrigin();
  });

  test('contrast: the OLD stale placement (group not rewritten) detaches Portal B after reset', () => {
    resetWorldOrigin();
    const camTrue = new THREE.Vector3(2000, 0, 0);
    const axis = new THREE.Vector3(0, 0, -1);
    worldOrigin.set(1950, 0, 0);
    const anchorTrue = camTrue.clone();

    // Group placed ONCE relative to the pre-swap origin, then left stale.
    const groupStale = placePocketLocal(anchorTrue, new THREE.Vector3()); // 50,0,0

    // Swap: camera teleports to true (2000,0,0) re-anchored... then resetWorldOrigin
    // zeroes worldOrigin WITHOUT shifting the stale group. Camera is now at local
    // ~ camTrue (worldOrigin 0), but the stale group is still at (50,0,0).
    resetWorldOrigin();
    const camLocalStale = fromWorldTrue(camTrue, new THREE.Vector3()); // (2000,0,0)
    const portalBStale = groupStale.clone().addScaledVector(axis, 60);
    const detached = camLocalStale.distanceTo(portalBStale);

    // The bug signature: Portal B is hundreds of units away, far past the 3u gate.
    expect(detached).toBeGreaterThan(700);
    resetWorldOrigin();
  });
});
