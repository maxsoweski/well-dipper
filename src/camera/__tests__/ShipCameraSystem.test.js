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

const { ShipCameraSystem } = await import('../ShipCameraSystem.js');

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

  describe('orbit mode (no gravity)', () => {
    it('creates with default orbit state', () => {
      expect(sys.distance).toBe(8);
      expect(sys.bypassed).toBe(false);
      expect(sys._gravityMode).toBe(false);
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

    it('focusOn() snaps target and resets pitch', () => {
      const pos = new THREE.Vector3(100, 0, 0);
      sys.focusOn(pos, 5);
      expect(sys.target.x).toBe(100);
      expect(sys.distance).toBe(5);
      expect(sys.pitch).toBeCloseTo(0.15);
    });

    it('viewSystem() sets distance to 1.5x radius', () => {
      sys.viewSystem(100);
      expect(sys.distance).toBe(150);
      expect(sys.target.x).toBe(0);
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

  describe('gravity mode', () => {
    it('initGravity() creates gravity subsystem', () => {
      sys.initGravity(mockSystemData(), mockBodyMeshes());
      expect(sys._gravityMode).toBe(true);
      expect(sys.gravityField).not.toBeNull();
      expect(sys.flight).not.toBeNull();
      expect(sys.director).not.toBeNull();
    });

    it('clearGravity() tears down subsystem', () => {
      sys.initGravity(mockSystemData(), mockBodyMeshes());
      sys.clearGravity();
      expect(sys._gravityMode).toBe(false);
      expect(sys.gravityField).toBeNull();
      expect(sys.flight).toBeNull();
      expect(sys.director).toBeNull();
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
