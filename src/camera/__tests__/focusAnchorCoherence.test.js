/**
 * Focus-anchor coherence — orrery-zoom-into-star-2026-08-11.
 *
 * THE BUG (Max, verbatim): "The camera keeps getting placed in the star whenever I
 * zoom all the way in after clicking twice on a planet or moon."
 *
 * MEASURED LIVE at HEAD 85f227f, seed lab-procedural-6, ORRERY, bypassed:false:
 *   camera 0.0511 from the STAR's centre, star radius 4.7200865750410586.
 *   0.0511 / 1.05 = 0.04867 — a MOON's radius. The zoom floor came from the body
 *   that was CLICKED; the orbit pivot came from the stale global focusIndex.
 *
 * ROOT CAUSE. Two writers own "the body the camera is dealing with" and only one is
 * re-issued every frame:
 *   - the FLOOR:  main.js selectTarget (:10011) and the click-2 glide branch
 *                 (:13987) → setFocusMinDistance(radius) → minDistance = r * 1.05.
 *   - the PIVOT:  the per-frame tracker (main.js:12367-12395) → trackTarget(pos),
 *                 read from focusIndex/focusMoonIndex/focusStarIndex — a triple NO
 *                 click path writes or clears (verified: no writer line falls inside
 *                 selectTarget or either click branch).
 * The two-phase glide masks it while it runs (_gliding pins this.target on the
 * clicked body), which is why the gesture LOOKS right until the wheel is touched.
 * The first wheel tick calls _endGlideToOrbit, both guards drop, and trackTarget
 * teleports the pivot onto the focus-index body — while `distance` keeps falling to
 * the CLICKED body's floor. Camera ends up inside whatever the focus index names.
 *
 * ⚠ REPRO PRECONDITION — a cold ORRERY entry CANNOT reproduce this.
 * _frameSystemForOrrery clears the triple to -1 (main.js:9499-9501) and resets the
 * floor via viewSystem → resetFocusMinDistance. The tracker must be ARMED first
 * (e.g. run and stop the autopilot tour: stopFlythrough → findClosestBody, whose
 * first probe is the star → focusIndex = -2). F1 below arms it explicitly; a test
 * that omits the trackTarget calls proves nothing.
 *
 * THE INVARIANT UNDER TEST: minDistance and the identity of the body it was derived
 * from are written by one function and only that function, and the orbit pivot may
 * only be re-anchored onto that same body.
 *
 * IDIOM: mirrors orreryGlide.test.js / ShipCameraSystem.test.js — window/document
 * mocks before import, mockCanvas(), real ShipCameraSystem driven headless.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';

if (typeof globalThis.window === 'undefined') {
  globalThis.window = {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    screen: { orientation: { angle: 0 } },
  };
}
if (typeof globalThis.document === 'undefined') {
  globalThis.document = { addEventListener: vi.fn() };
}
if (typeof globalThis.DeviceOrientationEvent === 'undefined') {
  globalThis.DeviceOrientationEvent = class {};
}

const { ShipCameraSystem } = await import('../ShipCameraSystem.js');

function mockCanvas() {
  const listeners = {};
  return {
    addEventListener: vi.fn((type, fn) => { listeners[type] = fn; }),
    removeEventListener: vi.fn(),
    _listeners: listeners,
    style: {},
  };
}

// Max's measured numbers, so a failure prints the real bug rather than a toy one.
const R_STAR = 4.7200865750410586;
const R_MOON = 0.0487;

describe('focus-anchor coherence (orrery-zoom-into-star-2026-08-11)', () => {
  let camera, canvas, sys;
  // Live position objects, held by reference exactly as main.js holds mesh.position.
  let STAR, MOON;

  beforeEach(() => {
    camera = new THREE.PerspectiveCamera(70, 1, 1e-9, 200000);
    canvas = mockCanvas();
    sys = new ShipCameraSystem(camera, canvas);
    sys.autoRotateActive = false;
    STAR = new THREE.Vector3(0, 0, 0);
    MOON = new THREE.Vector3(500, 0, 0);
  });

  function seatOrbit({ dist, yaw, pitch, target }) {
    sys.target.copy(target);
    sys._targetGoal.copy(target);
    sys._transitioning = false;
    sys.yaw = yaw; sys.pitch = pitch; sys.distance = dist;
    sys.smoothedYaw = yaw; sys.smoothedPitch = pitch; sys.smoothedDistance = dist;
    sys.update(1 / 60);
  }

  // One simStep, faithful to main.js: the tracker writes BOTH before and after
  // cameraController.update() in the same frame (main.js:12392 then :12478).
  function frame(trackedBody) {
    sys.trackTarget(trackedBody);
    sys.update(1 / 60);
    sys.trackTarget(trackedBody);
  }

  function wheelIn(n) {
    for (let i = 0; i < n; i++) {
      canvas._listeners.wheel({ preventDefault() {}, deltaY: -120 });
      frame(STAR);
    }
  }

  it('F1 — a stale per-frame tracker on the STAR cannot steal the pivot from the clicked moon', () => {
    // ORRERY overview: pivot on the star, which is ALSO what focusIndex === -2 names.
    seatOrbit({ dist: 1000, yaw: 0, pitch: 0.4, target: STAR });

    // The click, verbatim from main.js:13987 + :13991 (the click-2 glide branch).
    sys.setFocusMinDistance(R_MOON, MOON);
    sys.glideFocus(MOON, R_MOON * 2.6);

    // simStep keeps re-issuing the STALE star anchor for the whole gesture.
    for (let i = 0; i < 600; i++) frame(STAR);   // glide runs to completion
    wheelIn(400);                                // then zoom all the way in

    // The pivot must be the body that was CLICKED, not the one focusIndex names.
    expect(sys.target.distanceTo(MOON)).toBeLessThan(1e-6);
    // ⭐ THE SYMPTOM. At HEAD this prints ≈ 0.0511 against a 4.7201 star radius.
    expect(camera.position.distanceTo(STAR)).toBeGreaterThan(R_STAR);
    // …and fix C still works: you can still get to 1.05 R of the moon.
    expect(camera.position.distanceTo(MOON)).toBeGreaterThanOrEqual(R_MOON * 1.05 - 1e-6);
    expect(camera.position.distanceTo(MOON)).toBeLessThan(R_MOON * 1.05 + 1e-3);
  });

  it('F2 — the floor and its anchor are one fact: re-anchoring to a non-body clears both', () => {
    seatOrbit({ dist: 1000, yaw: 0, pitch: 0.4, target: STAR });
    sys.setFocusMinDistance(R_MOON, MOON);
    expect(sys.minDistance).toBeCloseTo(R_MOON * 1.05, 12);

    // stopFlythrough → findClosestBody → restoreFromWorldState: a NEW pivot that
    // carries no radius. A moon floor must not survive it, or the guard would
    // refuse the tracker forever and freeze the pivot on a dead point.
    sys.restoreFromWorldState(STAR);
    expect(sys.minDistance).toBe(0.01);
    expect(sys._focusAnchor).toBe(null);

    // With the anchor cleared the tracker is authoritative again.
    for (let i = 0; i < 10; i++) frame(STAR);
    expect(sys.target.distanceTo(STAR)).toBeLessThan(1e-9);
  });

  it('F3 — the tracker is NOT refused when it names the same body that owns the floor', () => {
    seatOrbit({ dist: 1000, yaw: 0, pitch: 0.4, target: STAR });
    sys.setFocusMinDistance(R_MOON, MOON);

    // focusIndex agrees with the click (e.g. Tab-cycle, or a tour stop on the same
    // body). The pivot must FOLLOW the moon as it orbits — the guard must not fire.
    for (let i = 0; i < 200; i++) frame(MOON);
    MOON.set(500, 0, 37);                       // the moon moves along its orbit
    for (let i = 0; i < 200; i++) frame(MOON);

    expect(sys.target.distanceTo(MOON)).toBeLessThan(1e-6);
  });

  it('F4 — the legacy one-argument form keeps its exact floor and leaves the guard inert', () => {
    sys.setFocusMinDistance(R_MOON);
    expect(sys.minDistance).toBeCloseTo(R_MOON * 1.05, 12);
    expect(sys._focusAnchor).toBe(null);

    seatOrbit({ dist: 1000, yaw: 0, pitch: 0.4, target: STAR });
    for (let i = 0; i < 10; i++) frame(STAR);
    expect(sys.target.distanceTo(STAR)).toBeLessThan(1e-9); // unguarded, as before
  });

  it('F5 — minDistance is written in exactly two places in the source', async () => {
    // The grep-checkable proof of the invariant. If this fails, someone added a
    // third writer and the floor can drift from its anchor again.
    const fs = await import('node:fs');
    const url = await import('node:url');
    const src = fs.readFileSync(
      url.fileURLToPath(new URL('../ShipCameraSystem.js', import.meta.url)), 'utf8',
    );
    const writes = src.match(/this\.minDistance\s*=/g) || [];
    expect(writes.length).toBe(2); // constructor + _setFocusAnchor
  });
});
