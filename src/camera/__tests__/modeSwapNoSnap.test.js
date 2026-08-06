/**
 * No-snap guard for the ORRERY <-> HELM peer-mode swap (§supercruise-arrival
 * -modes-design-2026-06-27, #2). Swapping stations with M must NOT snap the
 * camera onto a body — neither HELM->ORRERY nor ORRERY->HELM may teleport the
 * camera or re-anchor its look on a body center.
 *
 * This exercises the REAL ShipCameraSystem through the SAME camera-side calls
 * the live swap handlers make:
 *   HELM->ORRERY (the pose-preserving exit, _exitFlightInternal):
 *       setCameraMode(TOY_BOX) -> adoptCurrentPose(forward-ray anchor) -> update()
 *   ORRERY->HELM (the enter, _enterFlightInternal):
 *       setCameraMode(FLIGHT) + bypassed=true   (pilot/HeadMount writes the
 *       camera afterwards; the swap itself must not move it)
 *
 * The forward-ray anchor is flightExitAnchor(cameraPos, forward, d) — the SAME
 * primitive the live exit uses (main.js ~8459-8469). The 2026-06-25 regression
 * (re-anchoring on the BODY center → camera.lookAt(body) → a visible jump) must
 * stay absent: we assert the orbit target lands on the camera's forward ray, NOT
 * on the body center.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';

// Mock window/document before importing ShipCameraSystem (it attaches listeners).
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

const { ShipCameraSystem, CameraMode } = await import('../ShipCameraSystem.js');
const { flightExitAnchor } = await import('../../flight/flightExitAnchor.js');

function mockCanvas() {
  const listeners = {};
  return {
    addEventListener: vi.fn((type, fn) => { listeners[type] = fn; }),
    removeEventListener: vi.fn(),
    _listeners: listeners,
    style: {},
  };
}

function mockSystemData() {
  return {
    star: { radiusSolar: 1.0, radiusScene: 5 },
    isBinary: false,
    planets: [{
      planetData: { type: 'terrestrial', radiusEarth: 1.0, massEarth: 1.0, radiusScene: 0.05 },
      orbitRadiusAU: 1.0, orbitRadiusScene: 1000, orbitAngle: 0, orbitSpeed: 0.001, moons: [],
    }],
    asteroidBelts: [],
  };
}

function mockBodyMeshes() {
  return {
    star: { position: new THREE.Vector3(0, 0, 0) },
    planets: [{ position: new THREE.Vector3(1000, 0, 0) }],
    moons: [[]],
  };
}

// Replicates _exitFlightInternal's CAMERA-side sequence (main.js ~8449-8470):
// leave FLIGHT, anchor the orbit on the camera's OWN forward ray, adopt the
// pose. Returns the anchor used so the test can assert it's on the forward ray.
function swapToOrrery(sys, camera, bodyPos) {
  sys.setCameraMode(CameraMode.TOY_BOX);
  const fwd = new THREE.Vector3();
  camera.getWorldDirection(fwd);
  const rawD = bodyPos ? camera.position.distanceTo(bodyPos) : 100;
  const d = Math.max(sys.minDistance, Math.min(sys.maxDistance, rawD));
  const anchor = flightExitAnchor(camera.position, fwd, d);
  sys.adoptCurrentPose(new THREE.Vector3(anchor.x, anchor.y, anchor.z));
  sys.bypassed = false; // adoptCurrentPose already clears it; explicit for clarity
  return anchor;
}

// Replicates _enterFlightInternal's CAMERA-side calls (main.js 8421/8428): the
// pilot/HeadMount drives the camera afterwards, so the swap itself bypasses the
// orbit math and must NOT move the camera this frame.
function swapToHelm(sys) {
  sys.setCameraMode(CameraMode.FLIGHT);
  sys.bypassed = true;
}

describe('ORRERY <-> HELM swap — no-snap (real ShipCameraSystem)', () => {
  let camera, canvas, sys;

  beforeEach(() => {
    camera = new THREE.PerspectiveCamera(70, 1, 0.01, 200000);
    canvas = mockCanvas();
    sys = new ShipCameraSystem(camera, canvas);
    sys.initGravity(mockSystemData(), mockBodyMeshes());
  });

  it('HELM -> ORRERY preserves camera position and orientation (quatDot ~ 1.0)', () => {
    // Put the camera at an arbitrary in-flight pose looking off-axis (NOT at any
    // body) so a body-center re-anchor would be detectable as a rotation snap.
    camera.position.set(120, -40, 350);
    camera.lookAt(180, 10, -200); // off to the side, away from the body at (1000,0,0)
    camera.updateMatrixWorld(true);

    // In HELM: FLIGHT effective, pilot bypasses the orbit (camera owned externally).
    sys.setCameraMode(CameraMode.FLIGHT);
    sys.bypassed = true;
    expect(sys.isFlightMode).toBe(true);

    const posBefore = camera.position.clone();
    const quatBefore = camera.quaternion.clone();

    // Swap to ORRERY via the pose-preserving exit. THIS is the no-snap moment:
    // adoptCurrentPose sets smoothed == raw, so the very next _applyOrbit
    // reconstructs the EXACT pose. (Auto-rotate is a separate, deliberate slow
    // drift the orbit applies on subsequent frames — not a swap snap — so we
    // disable it to measure the swap fidelity itself; the JUMP/SNAP diagnostics
    // below confirm the first live frame is also clean.)
    sys.autoRotateActive = false;
    const bodyPos = new THREE.Vector3(1000, 0, 0);
    swapToOrrery(sys, camera, bodyPos);
    sys.update(1 / 60);

    // Position preserved exactly (forward-ray anchor cancels the orbit math).
    expect(camera.position.distanceTo(posBefore)).toBeLessThan(1e-3);

    // Orientation preserved: quaternion dot ~ 1.0 (no ROTATION_SNAP). lookAt
    // levels roll, but yaw/pitch (the look axis) are reproduced exactly here.
    const quatDot = Math.abs(camera.quaternion.dot(quatBefore));
    expect(quatDot).toBeGreaterThan(0.9999);

    expect(sys.cameraMode).toBe(CameraMode.TOY_BOX);
  });

  it('HELM -> ORRERY logs no JUMP or ROTATION_SNAP anomaly across the swap frame', () => {
    // The FrameDiagnostics ring buffer flags a teleport (posDelta > 100) or an
    // orientation snap (quatDot < 0.95). The 2026-06-25 body-center re-anchor
    // would surface here as a ROTATION_SNAP. Drive a few quiet frames after the
    // swap and assert the diagnostics stay clean.
    camera.position.set(200, 60, -140);
    camera.lookAt(-50, -20, 400);
    camera.updateMatrixWorld(true);

    sys.setCameraMode(CameraMode.FLIGHT);
    sys.bypassed = true;
    sys.autoRotateActive = false;
    sys._diagnostics.reset();

    const bodyPos = new THREE.Vector3(1000, 0, 0);
    swapToOrrery(sys, camera, bodyPos);
    for (let i = 0; i < 4; i++) sys.update(1 / 60);

    const summary = sys._diagnostics.getSummary();
    expect(summary.jumpCount).toBe(0);
    expect(summary.snapCount).toBe(0);
  });

  it('HELM -> ORRERY anchors the orbit on the forward ray, NOT the body center (2026-06-25 regression guard)', () => {
    camera.position.set(50, 0, 200);
    camera.lookAt(50, 0, -400); // looking down -Z, body is at +X (1000,0,0)
    camera.updateMatrixWorld(true);

    sys.setCameraMode(CameraMode.FLIGHT);
    sys.bypassed = true;

    const bodyPos = new THREE.Vector3(1000, 0, 0);
    swapToOrrery(sys, camera, bodyPos);

    // The orbit target must lie on the camera's forward ray (target = camera +
    // d*forward), i.e. roughly straight ahead — NOT pulled toward the body at
    // +X. If it had re-anchored on the body, target.x would be driven toward
    // 1000 and the forward-ray colinearity would break.
    const fwd = new THREE.Vector3();
    camera.getWorldDirection(fwd);
    const toTarget = new THREE.Vector3().subVectors(sys.target, camera.position).normalize();
    // colinear with forward → dot ~ 1
    expect(toTarget.dot(fwd)).toBeGreaterThan(0.9999);
    // and decidedly NOT pointing at the body (which is off to +X)
    const toBody = new THREE.Vector3().subVectors(bodyPos, camera.position).normalize();
    expect(toTarget.dot(toBody)).toBeLessThan(0.9);
  });

  it('ORRERY -> HELM does not move the camera on the swap (pilot owns it afterwards)', () => {
    // Start in ORRERY at an arbitrary pose.
    camera.position.set(-300, 80, 120);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld(true);
    sys.setCameraMode(CameraMode.TOY_BOX);
    // Seed orbit state from the live pose so a stray TOY_BOX frame wouldn't move it.
    sys.restoreFromWorldState(new THREE.Vector3(0, 0, 0));

    const posBefore = camera.position.clone();
    const quatBefore = camera.quaternion.clone();

    // Swap to HELM: enter FLIGHT, bypass. The camera write is deferred to the
    // pilot/HeadMount; update() while bypassed is a no-op (no snap on swap).
    swapToHelm(sys);
    sys.update(1 / 60);

    expect(camera.position.distanceTo(posBefore)).toBeLessThan(1e-6);
    const quatDot = Math.abs(camera.quaternion.dot(quatBefore));
    expect(quatDot).toBeGreaterThan(0.999999);
    expect(sys.cameraMode).toBe(CameraMode.FLIGHT);
    expect(sys.bypassed).toBe(true);
  });

  it('round-trip HELM -> ORRERY -> HELM leaves the camera where it started (no accumulated snap)', () => {
    camera.position.set(77, -12, 256);
    camera.lookAt(120, 30, -90);
    camera.updateMatrixWorld(true);

    sys.setCameraMode(CameraMode.FLIGHT);
    sys.bypassed = true;
    sys.autoRotateActive = false; // isolate swap fidelity from the orbit's slow drift

    const pos0 = camera.position.clone();
    const quat0 = camera.quaternion.clone();

    const bodyPos = new THREE.Vector3(1000, 0, 0);
    // HELM -> ORRERY
    swapToOrrery(sys, camera, bodyPos);
    sys.update(1 / 60);
    // ORRERY -> HELM
    swapToHelm(sys);
    sys.update(1 / 60); // bypassed → no-op

    expect(camera.position.distanceTo(pos0)).toBeLessThan(1e-3);
    expect(Math.abs(camera.quaternion.dot(quat0))).toBeGreaterThan(0.9999);
  });
});
