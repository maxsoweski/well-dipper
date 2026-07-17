/**
 * ShipCameraSystem integration tests.
 *
 * Verifies that the coordinator correctly:
 *   1. Works in orbit-only mode (no gravity) — same as CameraController
 *   2. Initializes and tears down the gravity subsystem
 *   3. Exposes the CameraController-compatible API surface
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';

// Mock window + document before importing ShipCameraSystem
// (it attaches event listeners to window in the constructor)
if (typeof globalThis.window === 'undefined') {
  globalThis.window = {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    screen: { orientation: { angle: 0 } },
  };
}
if (typeof globalThis.document === 'undefined') {
  globalThis.document = {
    addEventListener: vi.fn(),
  };
}
if (typeof globalThis.DeviceOrientationEvent === 'undefined') {
  globalThis.DeviceOrientationEvent = class {};
}

const { ShipCameraSystem, CameraMode } = await import('../ShipCameraSystem.js');

// Minimal mock canvas for event listeners
function mockCanvas() {
  const listeners = {};
  return {
    addEventListener: vi.fn((type, fn, opts) => {
      listeners[type] = fn;
    }),
    removeEventListener: vi.fn(),
    _listeners: listeners,
    style: {},
  };
}

// Minimal mock systemData for GravityField
function mockSystemData() {
  return {
    star: { radiusSolar: 1.0, radiusScene: 5 },
    isBinary: false,
    planets: [
      {
        planetData: {
          type: 'terrestrial',
          radiusEarth: 1.0,
          massEarth: 1.0,
          radiusScene: 0.05,
        },
        orbitRadiusAU: 1.0,
        orbitRadiusScene: 1000,
        orbitAngle: 0,
        orbitSpeed: 0.001,
        moons: [],
      },
    ],
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

describe('ShipCameraSystem', () => {
  let camera, canvas, sys;

  beforeEach(() => {
    camera = new THREE.PerspectiveCamera(70, 1, 0.01, 200000);
    canvas = mockCanvas();
    sys = new ShipCameraSystem(camera, canvas);
  });

  describe('toy box mode (no gravity)', () => {
    it('creates with default orbit state', () => {
      expect(sys.distance).toBe(8);
      expect(sys.bypassed).toBe(false);
      expect(sys._hasGravity).toBe(false);
      expect(sys.cameraMode).toBe(CameraMode.TOY_BOX);
    });

    it('update() moves camera to orbit position', () => {
      sys.target.set(0, 0, 0);
      sys.distance = 10;
      sys.yaw = 0;
      sys.pitch = 0;
      sys.smoothedYaw = 0;
      sys.smoothedPitch = 0;
      sys.smoothedDistance = 10;
      sys.update(1 / 60);
      // Camera should be near (0, 0, 10) looking at origin
      expect(camera.position.z).toBeGreaterThan(5);
    });

    it('update() is a no-op when bypassed', () => {
      sys.bypassed = true;
      const posBefore = camera.position.clone();
      sys.update(1 / 60);
      expect(camera.position.equals(posBefore)).toBe(true);
    });

    it('focusOn() snaps target and distance', () => {
      const pos = new THREE.Vector3(100, 0, 0);
      sys.focusOn(pos, 5);
      expect(sys.target.x).toBe(100);
      expect(sys.distance).toBe(5);
      // Pitch is derived from current camera position relative to target,
      // not preserved from the default
      expect(typeof sys.pitch).toBe('number');
      expect(Number.isFinite(sys.pitch)).toBe(true);
    });

    it('viewSystem() sets distance to 1.5x radius', () => {
      sys.viewSystem(100);
      expect(sys.distance).toBe(150);
      expect(sys.target.x).toBe(0);
    });

    // orrery-coherence-2026-07-15 AC5 → UAT round 2 (single-channel glide): glideFocus
    // is the VIEW-ONLY sibling of focusOn. The prior round eased THREE channels (pivot
    // @0.06 + yaw/pitch @0.08 + log-distance @0.08) which doglegged; round 2 replaces
    // that with ONE normalized t driving camera P_start→P_final and target T_start→body
    // on the same curve (re-derived from the body's LIVE position each frame). It must
    // arm a glide (not snap like focusOn) and converge the camera to the standoff on the
    // body. These asserts were rewritten from the old 3-channel contract in lockstep with
    // that redesign — see src/camera/__tests__/orreryGlide.test.js for the path/moving-body
    // guarantees.
    describe('glideFocus() — single-channel glide of the vantage (does not snap)', () => {
      it('arms a glide — sets glide state, does NOT snap the pose or move the camera yet', () => {
        // Settle a known orbit pose first (camera at ~(0,0,10) looking at origin).
        sys.target.set(0, 0, 0);
        sys.yaw = 0; sys.pitch = 0; sys.distance = 10;
        sys.smoothedYaw = 0; sys.smoothedPitch = 0; sys.smoothedDistance = 10;
        sys.update(1 / 60);
        const camBefore = sys.camera.position.clone();

        const pos = new THREE.Vector3(100, 0, 0);
        sys.glideFocus(pos, 5);

        // Glide armed — the single channel owns the move, so NO pivot ease.
        expect(sys._gliding).toBe(true);
        expect(sys._transitioning).toBe(false);
        expect(sys._glideStandoff).toBe(5);
        // Pivot GOAL is the body, but the live pivot has NOT jumped there.
        expect(sys._targetGoal.x).toBe(100);
        expect(sys.target.x).toBe(0);
        // Not a snap: camera unmoved and smoothedDistance untouched by glideFocus
        // (focusOn would snap both). The pre-glide settle's log-ease leaves a sub-ULP
        // residue on smoothedDistance, so assert closeness rather than bit-equality.
        expect(sys.camera.position.distanceTo(camBefore)).toBeLessThan(1e-9);
        expect(sys.smoothedDistance).toBeCloseTo(10, 6);
      });

      it('closes the camera toward the framed vantage monotonically over update() steps', () => {
        sys.target.set(0, 0, 0);
        sys.yaw = 0; sys.pitch = 0; sys.distance = 10;
        sys.smoothedYaw = 0; sys.smoothedPitch = 0; sys.smoothedDistance = 10;
        sys.update(1 / 60);

        const body = new THREE.Vector3(100, 0, 0);
        sys.glideFocus(body, 5);
        const d0 = sys.camera.position.distanceTo(body); // pre-move: full separation
        sys.update(1 / 60);
        const d1 = sys.camera.position.distanceTo(body);
        sys.update(1 / 60);
        const d2 = sys.camera.position.distanceTo(body);
        // Closing in: strictly decreasing, still short of the 5-unit standoff.
        expect(d1).toBeLessThan(d0);
        expect(d2).toBeLessThan(d1);
        expect(d2).toBeGreaterThan(5);
      });

      it('converges to the framed vantage (camera at standoff, pivot on body) after many steps', () => {
        sys.target.set(0, 0, 0);
        sys.yaw = 0; sys.pitch = 0; sys.distance = 10;
        sys.smoothedYaw = 0; sys.smoothedPitch = 0; sys.smoothedDistance = 10;
        sys.update(1 / 60);

        const body = new THREE.Vector3(100, 0, 0);
        sys.glideFocus(body, 5);
        for (let i = 0; i < 800; i++) sys.update(1 / 60);
        // Camera parked at the standoff from the body, pivot centered on the body.
        expect(sys.camera.position.distanceTo(body)).toBeCloseTo(5, 1);
        expect(sys.target.x).toBeCloseTo(100, 1);
        expect(sys._transitioning).toBe(false);
      });

      it('focusOn still SNAPS — glide is a separate method, snap semantics preserved', () => {
        const pos = new THREE.Vector3(50, 0, 0);
        sys.focusOn(pos, 7);
        expect(sys.distance).toBe(7);
        expect(sys.smoothedDistance).toBe(7); // snapped
        expect(sys.target.x).toBe(50);        // pivot snapped
        expect(sys._transitioning).toBe(false);
      });
    });

    it('restoreFromWorldState() reverse-computes orbit', () => {
      camera.position.set(0, 0, 20);
      camera.lookAt(0, 0, 0);
      sys.restoreFromWorldState(new THREE.Vector3(0, 0, 0));
      expect(sys.distance).toBeCloseTo(20);
      expect(sys.smoothedDistance).toBeCloseTo(20);
      expect(sys.bypassed).toBe(false);
    });

    it('setTarget() copies position', () => {
      sys.setTarget(new THREE.Vector3(5, 10, 15));
      expect(sys.target.x).toBe(5);
      expect(sys._targetGoal.y).toBe(10);
    });
  });

  describe('gravity subsystem', () => {
    it('initGravity() creates gravity subsystem but does not change camera mode', () => {
      sys.initGravity(mockSystemData(), mockBodyMeshes());
      expect(sys._hasGravity).toBe(true);
      expect(sys.gravityField).not.toBeNull();
      expect(sys.flight).not.toBeNull();
      expect(sys.director).not.toBeNull();
      // initGravity no longer auto-switches to Flight mode — the user
      // (or persisted localStorage) controls that independently.
      expect(sys.cameraMode).toBe(CameraMode.TOY_BOX);
    });

    it('clearGravity() tears down subsystem but preserves cameraMode intent', () => {
      sys.initGravity(mockSystemData(), mockBodyMeshes());
      sys.setCameraMode(CameraMode.FLIGHT);
      sys.clearGravity();
      expect(sys._hasGravity).toBe(false);
      expect(sys.gravityField).toBeNull();
      expect(sys.flight).toBeNull();
      expect(sys.director).toBeNull();
      // cameraMode is user intent — preserved through deep sky
      expect(sys.cameraMode).toBe(CameraMode.FLIGHT);
      // But effective state drops to non-flight because no gravity
      expect(sys.isFlightMode).toBe(false);
    });

    it('effective Flight mode resumes when gravity is re-initialized', () => {
      sys.initGravity(mockSystemData(), mockBodyMeshes());
      sys.setCameraMode(CameraMode.FLIGHT);
      sys.clearGravity();
      expect(sys.isFlightMode).toBe(false);
      sys.initGravity(mockSystemData(), mockBodyMeshes());
      expect(sys.cameraMode).toBe(CameraMode.FLIGHT);
      expect(sys.isFlightMode).toBe(true);
    });

    it('setCameraMode(FLIGHT) without gravity sets intent but effective state is not flight', () => {
      sys.setCameraMode(CameraMode.FLIGHT);
      expect(sys.cameraMode).toBe(CameraMode.FLIGHT);
      expect(sys.isFlightMode).toBe(false);
    });

    it('setCameraMode(FLIGHT) with gravity succeeds', () => {
      sys.initGravity(mockSystemData(), mockBodyMeshes());
      sys.setCameraMode(CameraMode.FLIGHT);
      expect(sys.cameraMode).toBe(CameraMode.FLIGHT);
      expect(sys.isFlightMode).toBe(true);
    });

    it('toggleCameraMode() flips between modes', () => {
      sys.initGravity(mockSystemData(), mockBodyMeshes());
      expect(sys.cameraMode).toBe(CameraMode.TOY_BOX);
      sys.toggleCameraMode();
      expect(sys.cameraMode).toBe(CameraMode.FLIGHT);
      sys.toggleCameraMode();
      expect(sys.cameraMode).toBe(CameraMode.TOY_BOX);
    });

    it('isMobile option forces TOY_BOX regardless of setCameraMode', () => {
      const mobileCanvas = mockCanvas();
      const mobileCam = new THREE.PerspectiveCamera(70, 1, 0.01, 200000);
      const mobileSys = new ShipCameraSystem(mobileCam, mobileCanvas, { isMobile: true });
      mobileSys.initGravity(mockSystemData(), mockBodyMeshes());
      mobileSys.setCameraMode(CameraMode.FLIGHT);
      expect(mobileSys.cameraMode).toBe(CameraMode.TOY_BOX);
    });

    it('update() with gravity ticks the field and flight', () => {
      sys.initGravity(mockSystemData(), mockBodyMeshes());
      // Should not throw
      sys.update(1 / 60);
      expect(sys.flight.lastGravResult).not.toBeNull();
    });

    it('focusOn() syncs flight position', () => {
      sys.initGravity(mockSystemData(), mockBodyMeshes());
      sys.focusOn(new THREE.Vector3(100, 0, 0), 5);
      expect(sys.flight.position.lengthSq()).toBeGreaterThan(0);
    });
  });

  describe('coordinator loop (Flight mode)', () => {
    it('flight.position is NOT overwritten by orbit math', () => {
      sys.initGravity(mockSystemData(), mockBodyMeshes());
      sys.setCameraMode(CameraMode.FLIGHT);

      // Set orbit to produce position near (0, 0, 8) — the default
      sys.target.set(0, 0, 0);
      sys.smoothedDistance = 8;
      sys.smoothedYaw = 0;
      sys.smoothedPitch = 0;

      // Set flight far away from where orbit would place it
      sys.flight.position.set(200, 0, 0);
      sys.flight.velocity.set(0, 0, 0);

      sys.update(1 / 60);

      // BUG: flight.position gets overwritten to orbit pos (~0, 0, 8)
      // CORRECT: flight.position stays near 200 (only moved by gravity)
      expect(sys.flight.position.x).toBeGreaterThan(100);
    });

    it('camera position follows flight, not orbit math', () => {
      sys.initGravity(mockSystemData(), mockBodyMeshes());
      sys.setCameraMode(CameraMode.FLIGHT);

      sys.target.set(0, 0, 0);
      sys.smoothedDistance = 8;
      sys.smoothedYaw = 0;
      sys.smoothedPitch = 0;

      // Flight is at (200, 0, 0), orbit would put camera at (0, 0, 8)
      sys.flight.position.set(200, 0, 0);
      sys.flight.velocity.set(0, 0, 0);

      sys.update(1 / 60);

      // Camera should be near flight position, not orbit position
      expect(camera.position.x).toBeGreaterThan(100);
    });

    it('director lookTarget controls camera orientation', () => {
      sys.initGravity(mockSystemData(), mockBodyMeshes());
      sys.setCameraMode(CameraMode.FLIGHT);
      sys.flight.position.set(50, 0, 0);
      sys.flight.velocity.set(0, 0, 0);

      sys.update(1 / 60);

      // Camera should be looking roughly toward the director's smoothed lookTarget
      const lookDir = new THREE.Vector3();
      camera.getWorldDirection(lookDir);

      const toLookTarget = new THREE.Vector3()
        .subVectors(sys.director._currentLookTarget, camera.position)
        .normalize();

      // Dot product > 0 means camera faces toward the look target
      expect(lookDir.dot(toLookTarget)).toBeGreaterThan(0);
    });

    it('without gravity, orbit math still drives camera', () => {
      // No initGravity — orbit-only mode
      sys.target.set(0, 0, 0);
      sys.distance = 10;
      sys.yaw = 0;
      sys.pitch = 0;
      sys.smoothedYaw = 0;
      sys.smoothedPitch = 0;
      sys.smoothedDistance = 10;
      sys.update(1 / 60);

      // Camera should be at orbit position (0, 0, 10)
      expect(camera.position.z).toBeCloseTo(10, 0);
    });

    it('camera position is continuous across gravity init', () => {
      // Set up orbit position first
      sys.target.set(0, 0, 0);
      sys.distance = 20;
      sys.yaw = 0;
      sys.pitch = 0;
      sys.smoothedYaw = 0;
      sys.smoothedPitch = 0;
      sys.smoothedDistance = 20;
      sys.update(1 / 60);

      const posBeforeGravity = camera.position.clone();

      // Init gravity — camera should not jump
      sys.initGravity(mockSystemData(), mockBodyMeshes());
      sys.update(1 / 60);

      const posAfterGravity = camera.position.clone();
      const jump = posBeforeGravity.distanceTo(posAfterGravity);

      // Allow small movement from physics integration but no large jump
      expect(jump).toBeLessThan(5);
    });
  });

  describe('API compatibility', () => {
    it('has all properties main.js accesses', () => {
      // Properties
      expect(sys).toHaveProperty('bypassed');
      expect(sys).toHaveProperty('smoothedDistance');
      expect(sys).toHaveProperty('smoothedYaw');
      expect(sys).toHaveProperty('smoothedPitch');
      expect(sys).toHaveProperty('distance');
      expect(sys).toHaveProperty('yaw');
      expect(sys).toHaveProperty('pitch');
      expect(sys).toHaveProperty('autoRotateActive');
      expect(sys).toHaveProperty('autoRotateSpeed');
      expect(sys).toHaveProperty('scrollSensitivity');
      expect(sys).toHaveProperty('forceFreeLook');
      expect(sys).toHaveProperty('isFreeLooking');
      expect(sys).toHaveProperty('isDragging');
      expect(sys).toHaveProperty('target');
      expect(sys).toHaveProperty('_targetGoal');
      expect(sys).toHaveProperty('_transitioning');
      expect(sys).toHaveProperty('_transitionSpeed');
      expect(sys).toHaveProperty('_returningToOrbit');
      expect(sys).toHaveProperty('_flightEnabled');
      expect(sys).toHaveProperty('_leftFreeLooking');
      expect(sys).toHaveProperty('gyroEnabled');
      expect(sys).toHaveProperty('zoomSpeed');
      expect(sys).toHaveProperty('dragSensitivity');
    });

    it('has all methods main.js calls', () => {
      expect(typeof sys.update).toBe('function');
      expect(typeof sys.restoreFromWorldState).toBe('function');
      expect(typeof sys.focusOn).toBe('function');
      expect(typeof sys.viewSystem).toBe('function');
      expect(typeof sys.setTarget).toBe('function');
      expect(typeof sys.trackTarget).toBe('function');
      expect(typeof sys.trackFreeLookAnchor).toBe('function');
      expect(typeof sys.killFlightVelocity).toBe('function');
      expect(typeof sys.setFlightInput).toBe('function');
      expect(typeof sys.enableGyro).toBe('function');
      expect(typeof sys.disableGyro).toBe('function');
      expect(typeof sys.enterFreeLook).toBe('function');
      expect(typeof sys.exitFreeLook).toBe('function');
    });

    it('has isFlying getter', () => {
      expect(typeof Object.getOwnPropertyDescriptor(
        ShipCameraSystem.prototype, 'isFlying'
      ).get).toBe('function');
    });

    it('has callback hooks', () => {
      expect(sys).toHaveProperty('onFreeLookEnd');
      expect(sys).toHaveProperty('hasFocusedBody');
    });
  });
});
