// Pocket-traversal: the warp tunnel is a human-scale pocket the camera flies
// through. These tests pin the OUTSIDE_A -> INSIDE -> OUTSIDE_B mode sequence
// (AC2 entry, AC4 emergence) via the pure plane-crossing state machine, and
// the load-adaptive emergence gate (AC5). Replaces the camera-pin invariant
// tests (mechanism reverted in Task 0).
import { describe, test, expect } from 'vitest';
import * as THREE from 'three';
import { createTraversal, stepTraversal, parkBackDepth } from '../src/effects/portalTraversal.js';
import { WarpPortal } from '../src/effects/WarpPortal.js';
import { WarpEffect } from '../src/effects/WarpEffect.js';
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
function makeFakeNode(uniforms = {}) {
  return {
    visible: true,
    scale: { _v: 1, setScalar(s) { this._v = s; } },
    material: { stencilWrite: false, needsUpdate: false, transparent: false, uniforms },
  };
}
function makeFakePortal(startMode = 'OUTSIDE_A') {
  const p = {
    _traversalMode: startMode,
    _trav: { mode: startMode },
    _radius: 8,
    _closing: false,
    _closeT: 0,
    _tunnel: makeFakeNode({ uFade: { value: 1 } }),
    _discA: makeFakeNode(), _discB: makeFakeNode(),
    _rimA: makeFakeNode({ uIntensity: { value: 1 } }),
    _rimB: makeFakeNode({ uIntensity: { value: 1 } }),
    _landingStrip: makeFakeNode(), _entryStrip: makeFakeNode(),
    group: { visible: true },
    onTraversal: null,
    setEntryStripProgress() {},
  };
  // Bind the real prototype methods the close-tween exercises, so the tests
  // pin actual behavior (not a copy) when invoked as p.startClose()/updateClose().
  for (const m of ['setRadius', 'setRimIntensity', 'setTunnelFade', 'close', 'startClose', 'updateClose']) {
    if (WarpPortal.prototype[m]) p[m] = WarpPortal.prototype[m];
  }
  return p;
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

describe('portal close-tween on emergence (AC8)', () => {
  // The arrival reads as flying OUT through Portal B: the tunnel + ring stay
  // VISIBLE on emergence and then shrink+fade over ~3s (a look-back during exit
  // shows them closing, not already gone). Reverts the 2026-06-07 stopgap that
  // force-hid the tunnel the instant the mode flipped to OUTSIDE_B.
  test('emerging into the destination (OUTSIDE_B) leaves the tunnel VISIBLE', () => {
    const p = makeFakePortal('INSIDE');
    WarpPortal.prototype.setTraversalMode.call(p, 'OUTSIDE_B');
    expect(p._tunnel.visible).toBe(true);    // NOT force-hidden — the tween closes it
    expect(p._discB.visible).toBe(true);     // Portal B ring is the look-back anchor
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

  test('updateClose drives radius, rim, and fade monotonically to ~0 over ~3s', () => {
    const p = makeFakePortal('OUTSIDE_B');
    p.startClose();
    expect(p._closing).toBe(true);
    expect(p._tunnel.material.transparent).toBe(true); // alpha lever armed

    let prevScale = p._discA.scale._v;
    let prevRim = p._rimA.material.uniforms.uIntensity.value;
    let prevFade = p._tunnel.material.uniforms.uFade.value;
    // Drive ~2.9s in 0.1s steps; tunnel must stay VISIBLE the whole time.
    for (let i = 0; i < 29; i++) {
      p.updateClose(0.1);
      expect(p._tunnel.visible).toBe(true);            // visible while closing
      expect(p._discA.scale._v).toBeLessThanOrEqual(prevScale + 1e-9);
      expect(p._rimA.material.uniforms.uIntensity.value).toBeLessThanOrEqual(prevRim + 1e-9);
      expect(p._tunnel.material.uniforms.uFade.value).toBeLessThanOrEqual(prevFade + 1e-9);
      prevScale = p._discA.scale._v;
      prevRim = p._rimA.material.uniforms.uIntensity.value;
      prevFade = p._tunnel.material.uniforms.uFade.value;
    }
    expect(p._tunnel.material.uniforms.uFade.value).toBeLessThan(0.1); // nearly gone
  });

  test('the tunnel hides ONLY when the tween completes (not at the mode flip)', () => {
    const p = makeFakePortal('OUTSIDE_B');
    p.startClose();
    p.updateClose(1.5);                  // halfway
    expect(p.group.visible).toBe(true);  // still open mid-close
    p.updateClose(2.0);                  // past CLOSE_DUR (3s total)
    expect(p._closing).toBe(false);
    expect(p.group.visible).toBe(false); // close() fired at completion
  });

  test('resetTraversal cancels a close and restores fade/radius/visibility for the next warp', () => {
    const p = makeFakePortal('OUTSIDE_B');
    p.startClose();
    p.updateClose(1.5);
    WarpPortal.prototype.resetTraversal.call(p);
    expect(p._traversalMode).toBe('OUTSIDE_A');
    expect(p._closing).toBe(false);
    expect(p._tunnel.visible).toBe(true);
    expect(p._tunnel.material.uniforms.uFade.value).toBe(1);
    expect(p._discA.scale._v).toBe(1);   // radius restored to full (s = _radius/_radius)
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

describe('load-adaptive emergence gate (AC5)', () => {
  // Emergence is withheld until the destination is ready (spawn + shader
  // pre-compile), while a minimum cruise is always honored. A slow load extends
  // the cruise; a fast load lasts exactly the minimum. (onSwapSystem is null in
  // these unit instances, so the swap callback is a no-op — we drive the gate
  // logic directly via destinationReady.)
  function runHyper(we, { readyAt, dt = 0.1, maxT = 60 }) {
    we.state = 'hyper'; we.elapsed = 0; we.destinationReady = false;
    let t = 0;
    while (we.state === 'hyper' && t < maxT) {
      t += dt;
      if (t >= readyAt) we.destinationReady = true;
      we.update(dt);
    }
    return t;
  }

  test('slow load extends the cruise past the minimum', () => {
    const we = new WarpEffect();
    const min = we.HYPER_MIN_CRUISE;
    const t = runHyper(we, { readyAt: min + 2.0 });
    expect(t).toBeGreaterThan(min + 1.9);
  });

  test('fast load: the cruise lasts ~exactly the minimum', () => {
    const we = new WarpEffect();
    const min = we.HYPER_MIN_CRUISE;
    const t = runHyper(we, { readyAt: 0.05 });
    expect(t).toBeGreaterThanOrEqual(min);
    expect(t).toBeLessThan(min + 0.25);
  });

  test('a never-ready load still leaves HYPER via the safety ceiling (no infinite cruise)', () => {
    const we = new WarpEffect();
    const t = runHyper(we, { readyAt: Infinity, maxT: 60 });
    // Bounded by the safety ceiling, not the 60s loop cap.
    expect(t).toBeLessThan(60);
    expect(we.state).not.toBe('hyper');
  });
});

describe('cruise wall-motion has ONE source: camera flight (Max decision 2026-06-09)', () => {
  // Root cause of "walls reverse halfway through the cruise": two opposing
  // motion sources. Real parallax (camera flying through the cylinder) runs
  // one way; the per-frame `uScroll += dt*0.5` drift in update() ran the
  // other. When the AC5 park-back dead-stopped the camera mid-cruise, the
  // drift became the only motion and the flow visibly REVERSED. The drift was
  // a holdover from starfield-cylinder-lab.html's static-orbit camera (where
  // it was the sole motion source) — never valid alongside a flying camera.
  // Max's call: wall streaming comes ONLY from real flight; uScroll stays put.
  function makeUpdateFake() {
    return {
      group: { visible: true },
      _tunnel: makeFakeNode({ uTime: { value: 0 }, uScroll: { value: 0 } }),
      _rimA: makeFakeNode({ uTime: { value: 0 } }),
      _rimB: makeFakeNode({ uTime: { value: 0 } }),
    };
  }

  test('update() does NOT drift uScroll — no camera-independent wall motion', () => {
    const p = makeUpdateFake();
    WarpPortal.prototype.update.call(p, 1.0);
    expect(p._tunnel.material.uniforms.uScroll.value).toBe(0);
  });

  test('update() still advances uTime — twinkle shimmers even when the camera is slow', () => {
    const p = makeUpdateFake();
    WarpPortal.prototype.update.call(p, 1.0);
    expect(p._tunnel.material.uniforms.uTime.value).toBeCloseTo(1.0, 9);
    expect(p._rimA.material.uniforms.uTime.value).toBeCloseTo(1.0, 9);
    expect(p._rimB.material.uniforms.uTime.value).toBeCloseTo(1.0, 9);
  });
});

describe('soft-creep park depth (replaces the mid-cruise dead-stop)', () => {
  // The old AC5 park-back clamped the camera to a FIXED 20u short of Portal B
  // for the whole gated cruise — a dead stop, which is what exposed the
  // opposing-drift reversal. The fix: the hold depth EASES from maxBack to
  // minBack over the min-cruise, so the camera always inches forward (one
  // coherent motion source, never frozen, never reversed). Pure function so
  // the depth math is unit-testable outside the render loop.
  const MIN_CRUISE = 3.5, MAX_BACK = 20, MIN_BACK = 6;

  test('at cruise start the hold depth is maxBack', () => {
    expect(parkBackDepth(0, MIN_CRUISE, MAX_BACK, MIN_BACK)).toBe(MAX_BACK);
  });

  test('at min-cruise the hold depth has eased to minBack', () => {
    expect(parkBackDepth(MIN_CRUISE, MIN_CRUISE, MAX_BACK, MIN_BACK)).toBe(MIN_BACK);
  });

  test('past min-cruise (slow load) it holds at minBack — never below, never negative', () => {
    expect(parkBackDepth(MIN_CRUISE * 3, MIN_CRUISE, MAX_BACK, MIN_BACK)).toBe(MIN_BACK);
    expect(parkBackDepth(1000, MIN_CRUISE, MAX_BACK, MIN_BACK)).toBeGreaterThanOrEqual(0);
  });

  test('strictly decreasing across the cruise — the camera always has room to creep', () => {
    let prev = parkBackDepth(0, MIN_CRUISE, MAX_BACK, MIN_BACK);
    for (let t = 0.1; t <= MIN_CRUISE + 1e-9; t += 0.1) {
      const d = parkBackDepth(t, MIN_CRUISE, MAX_BACK, MIN_BACK);
      expect(d).toBeLessThan(prev);
      prev = d;
    }
  });

  test('negative elapsed clamps to maxBack (no overshoot past the start)', () => {
    expect(parkBackDepth(-1, MIN_CRUISE, MAX_BACK, MIN_BACK)).toBe(MAX_BACK);
  });

  // Live telemetry 2026-06-09: the swap can drop the camera in SHALLOWER than
  // maxBack (measured ~14.7u from Portal B vs maxBack=20 — the Task B distB
  // variance). An ease that starts at maxBack then sits BEHIND the camera, so
  // max(0, axisToB - parkBackEff) clamps to 0 and the camera freezes until the
  // ease catches up (~1.3s of dead-stop, the exact thing this fix removes).
  // The hold must start AT the camera's actual entry depth, never behind it.
  describe('entry-depth cap (camera spawns shallower than maxBack)', () => {
    const ENTRY = 14.7;

    test('at cruise start the hold depth equals the entry depth, not maxBack', () => {
      expect(parkBackDepth(0, MIN_CRUISE, MAX_BACK, MIN_BACK, ENTRY)).toBe(ENTRY);
    });

    test('still eases to minBack by min-cruise', () => {
      expect(parkBackDepth(MIN_CRUISE, MIN_CRUISE, MAX_BACK, MIN_BACK, ENTRY)).toBe(MIN_BACK);
    });

    test('strictly decreasing from entry depth — never a frozen frame', () => {
      let prev = parkBackDepth(0, MIN_CRUISE, MAX_BACK, MIN_BACK, ENTRY);
      for (let t = 0.1; t <= MIN_CRUISE + 1e-9; t += 0.1) {
        const d = parkBackDepth(t, MIN_CRUISE, MAX_BACK, MIN_BACK, ENTRY);
        expect(d).toBeLessThan(prev);
        prev = d;
      }
    });

    test('a DEEP entry (beyond maxBack) keeps the maxBack start — unchanged behavior', () => {
      expect(parkBackDepth(0, MIN_CRUISE, MAX_BACK, MIN_BACK, 31.6)).toBe(MAX_BACK);
    });

    test('entry already inside minBack: holds flat at minBack (never pushes backward)', () => {
      expect(parkBackDepth(0, MIN_CRUISE, MAX_BACK, MIN_BACK, 4)).toBe(MIN_BACK);
      expect(parkBackDepth(MIN_CRUISE, MIN_CRUISE, MAX_BACK, MIN_BACK, 4)).toBe(MIN_BACK);
    });

    test('omitted entry depth behaves exactly as before (backward compatible)', () => {
      expect(parkBackDepth(0, MIN_CRUISE, MAX_BACK, MIN_BACK)).toBe(MAX_BACK);
    });
  });
});

describe('HYPER begins at the swap — the cruise gets the full pocket (Task B blocker)', () => {
  // Root cause of "distB at cruise start is ~15-32u, not 60" (live-confirmed
  // 2026-06-09: swap at ENTER elapsed=0.25 → first HYPER frame distB=23.3):
  // the swap fires at the geometric Portal A crossing DURING enter, re-anchors
  // the pocket with B 60u ahead — and then the remainder of ENTER (up to 1.5s
  // at 22.5→45 u/s, ~50u) flies the camera into the fresh pocket BEFORE the
  // gated HYPER cruise starts. hyperTraversalScenePerSec's contract ("HYPER
  // covers exactly the tunnel length") assumes HYPER starts at full depth.
  // Fix: once the swap has fired, ENTER's job is done — transition to HYPER
  // immediately, so the cruise deterministically starts at the full pocket
  // length. (Also shrinks the transition speed snap: ~26→20 instead of 45→20.)
  test('enter transitions to hyper on the update after the swap fires', () => {
    const we = new WarpEffect();
    we.state = 'enter'; we.elapsed = 0.25; we.progress = 0.17;
    we._swapFired = true;
    we.update(1 / 60);
    expect(we.state).toBe('hyper');
    expect(we.cameraForwardSpeed).toBe(we._hyperSpeed);
  });

  test('without a swap, enter still runs its full duration (legacy / fallback path)', () => {
    const we = new WarpEffect();
    we.state = 'enter'; we.elapsed = 0; we._swapFired = false;
    let t = 0;
    while (we.state === 'enter' && t < we.ENTER_DUR - 0.1) { t += 1 / 60; we.update(1 / 60); }
    expect(we.state).toBe('enter');               // no early exit without the swap
    while (we.state === 'enter' && t < we.ENTER_DUR + 0.5) { t += 1 / 60; we.update(1 / 60); }
    expect(we.state).toBe('hyper');               // natural duration exit intact
  });
});

describe('emergence-driven exit: the crossing, not the min-cruise timer, ends HYPER (AC4)', () => {
  // Root cause #2 (2026-06-07 post-teleport-fix diagnosis): the AC5 clamp parks
  // the camera ~0.5u short of Portal B during the whole min-cruise. The min-cruise
  // TIMER-exit in _updateHyper (`elapsed >= HYPER_MIN_CRUISE`) fires the SAME frame
  // the AC5 gate releases, flipping HYPER->EXIT before the camera can advance the
  // final 0.5u and cross. EXIT then decelerates forward speed to ~0, so the
  // geometric INSIDE->OUTSIDE_B crossing never fires and onComplete force-flips the
  // mode every warp. The dual-portal path must let the CROSSING drive EXIT (the
  // stated design, main.js onTraversal): `emergenceCrossingDrivesExit` suppresses
  // the min-cruise timer-exit, leaving the safety ceiling as the only backstop.
  function runHyperFlagged(we, { readyAt, dt = 0.1, maxT = 60 }) {
    we.emergenceCrossingDrivesExit = true;
    we.state = 'hyper'; we.elapsed = 0; we.destinationReady = false;
    let t = 0;
    while (we.state === 'hyper' && t < maxT) {
      t += dt;
      if (t >= readyAt) we.destinationReady = true;
      we.update(dt);
    }
    return t;
  }

  test('with the flag set, HYPER does NOT timer-exit at min-cruise — it waits for the crossing', () => {
    const we = new WarpEffect();
    we.emergenceCrossingDrivesExit = true;
    we.state = 'hyper'; we.elapsed = 0; we.destinationReady = true;
    let t = 0;
    const watchUntil = we.HYPER_MIN_CRUISE + 2.0; // past min-cruise, below the 12s ceiling
    while (we.state === 'hyper' && t < watchUntil) { t += 0.1; we.update(0.1); }
    expect(we.state).toBe('hyper');                  // still cruising — timer did NOT exit
    expect(t).toBeGreaterThan(we.HYPER_MIN_CRUISE + 1.9);
  });

  test('the safety ceiling still bounds HYPER if the crossing never fires (no infinite cruise)', () => {
    const we = new WarpEffect();
    const t = runHyperFlagged(we, { readyAt: 0.05, maxT: 60 });
    expect(t).toBeLessThan(60);                       // left via the safety ceiling
    expect(t).toBeGreaterThan(we.HYPER_DUR * 4 - 0.5); // ~12s, not the 3.5s min-cruise
    expect(we.state).not.toBe('hyper');
  });

  test('default (flag unset): the min-cruise timer-exit still fires (legacy / unit path)', () => {
    const we = new WarpEffect();
    expect(we.emergenceCrossingDrivesExit).toBeFalsy(); // default off
    we.state = 'hyper'; we.elapsed = 0; we.destinationReady = true;
    let t = 0;
    while (we.state === 'hyper' && t < 30) { t += 0.1; we.update(0.1); }
    expect(we.state).toBe('exit');
    expect(t).toBeLessThan(we.HYPER_MIN_CRUISE + 0.3); // left at ~min-cruise, not the ceiling
  });
});
