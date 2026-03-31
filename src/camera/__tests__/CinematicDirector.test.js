import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { CinematicDirector, CompositionState } from '../CinematicDirector.js';
import { CameraCompositions } from '../CameraCompositions.js';

// ── Minimal mock gravity field ──
// Mirrors the pattern from FlightDynamics.test.js

function createMockGravityField(options = {}) {
  const starPosition = options.starPosition ?? new THREE.Vector3(0, 0, 0);

  const bodies = [
    {
      name: 'star',
      mass: 1.0,
      soiRadius: Infinity,
      hillRadius: Infinity,
      parentIndex: -1,
      position: starPosition.clone(),
    },
  ];

  if (options.extraBodies) {
    for (const b of options.extraBodies) {
      bodies.push(b);
    }
  }

  return {
    bodies,

    dominantBodyAt(position) {
      // Find the nearest body whose SOI contains the position
      let best = bodies[0];
      let bestIndex = 0;
      let bestDist = position.distanceTo(best.position);

      for (let i = 1; i < bodies.length; i++) {
        const body = bodies[i];
        const dist = position.distanceTo(body.position);
        if (dist < body.soiRadius && body.soiRadius < best.soiRadius) {
          best = body;
          bestIndex = i;
          bestDist = dist;
        }
      }

      return {
        body: best,
        index: bestIndex,
        distance: bestDist,
        inSOI: true,
      };
    },
  };
}

// Minimal mock camera
function createMockCamera() {
  return {
    fov: 60,
    position: new THREE.Vector3(),
    lookAt() {},
  };
}


describe('CinematicDirector', () => {
  let gf;
  let camera;
  let director;

  beforeEach(() => {
    gf = createMockGravityField({
      extraBodies: [
        {
          name: 'planet-0',
          mass: 0.001,
          soiRadius: 50,
          hillRadius: 55,
          parentIndex: 0,
          position: new THREE.Vector3(500, 0, 0),
        },
        {
          name: 'moon-0-0',
          mass: 0.00001,
          soiRadius: 5,
          hillRadius: 6,
          parentIndex: 1,
          position: new THREE.Vector3(520, 0, 0),
        },
      ],
    });
    camera = createMockCamera();
    director = new CinematicDirector(camera, gf);
  });

  // ═══════════════════════════════════════════════════════════════════
  //  State transitions follow flight state changes
  // ═══════════════════════════════════════════════════════════════════

  describe('state transitions follow flight state changes', () => {
    it('should enter BODY_PORTRAIT when flight state is ORBIT', () => {
      const shipPos = new THREE.Vector3(500, 0, 50);
      const shipVel = new THREE.Vector3(0, 0, 5);

      director.update(1 / 60, shipPos, shipVel, 'ORBIT', { orbitBodyIndex: 1 });

      expect(director.state).toBe(CompositionState.BODY_PORTRAIT);
    });

    it('should enter TRACKING_FORWARD when FREE and moving fast', () => {
      const shipPos = new THREE.Vector3(500, 0, 0);
      const shipVel = new THREE.Vector3(10, 0, 5); // speed ~11, above threshold

      director.update(1 / 60, shipPos, shipVel, 'FREE', {});

      expect(director.state).toBe(CompositionState.TRACKING_FORWARD);
    });

    it('should enter SCENIC_DRIFT when IDLE', () => {
      const shipPos = new THREE.Vector3(500, 0, 0);
      const shipVel = new THREE.Vector3(0, 0, 0);

      director.update(1 / 60, shipPos, shipVel, 'IDLE', {});

      expect(director.state).toBe(CompositionState.SCENIC_DRIFT);
    });

    it('should enter WARP_LOCK when flight state is WARP', () => {
      const shipPos = new THREE.Vector3(500, 0, 0);
      const shipVel = new THREE.Vector3(0, 0, 0);

      director.update(1 / 60, shipPos, shipVel, 'WARP', {});

      expect(director.state).toBe(CompositionState.WARP_LOCK);
    });

    it('should enter ARRIVAL_ANTICIPATION when APPROACH', () => {
      const shipPos = new THREE.Vector3(200, 0, 0);
      const shipVel = new THREE.Vector3(5, 0, 0);

      director.update(1 / 60, shipPos, shipVel, 'APPROACH', { approachBodyIndex: 1 });

      expect(director.state).toBe(CompositionState.ARRIVAL_ANTICIPATION);
    });

    it('should enter DEPARTURE_WATCH when transitioning from ORBIT to FREE', () => {
      const shipPos = new THREE.Vector3(500, 0, 50);
      const shipVel = new THREE.Vector3(0, 0, 5);

      // First frame: in orbit
      director.update(1 / 60, shipPos, shipVel, 'ORBIT', { orbitBodyIndex: 1 });
      expect(director.state).toBe(CompositionState.BODY_PORTRAIT);

      // Second frame: now FREE (just escaped orbit)
      director.update(1 / 60, shipPos, new THREE.Vector3(0, 0, 20), 'FREE', {});
      expect(director.state).toBe(CompositionState.DEPARTURE_WATCH);
    });

    it('should enter SCENIC_DRIFT when FREE but very slow', () => {
      const shipPos = new THREE.Vector3(500, 0, 0);
      const shipVel = new THREE.Vector3(0.1, 0, 0.1); // speed ~0.14, below threshold

      director.update(1 / 60, shipPos, shipVel, 'FREE', {});

      expect(director.state).toBe(CompositionState.SCENIC_DRIFT);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  //  BODY_PORTRAIT produces a lookAt near the dominant body
  // ═══════════════════════════════════════════════════════════════════

  describe('BODY_PORTRAIT produces a lookAt near the dominant body', () => {
    it('should look near the orbited body, not at the ship', () => {
      const shipPos = new THREE.Vector3(500, 0, 50);
      const shipVel = new THREE.Vector3(0, 0, 5);
      const bodyPos = gf.bodies[1].position; // planet at (500, 0, 0)

      // Run several frames to let smoothing converge
      for (let i = 0; i < 120; i++) {
        director.update(1 / 60, shipPos, shipVel, 'ORBIT', { orbitBodyIndex: 1 });
      }

      const lookTarget = director.getLookTarget();

      // The look target should be closer to the body than to the ship
      const distToBody = lookTarget.distanceTo(bodyPos);
      const distToShip = lookTarget.distanceTo(shipPos);

      expect(distToBody).toBeLessThan(distToShip);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  //  TRACKING_FORWARD lookAt is ahead of velocity direction
  // ═══════════════════════════════════════════════════════════════════

  describe('TRACKING_FORWARD lookAt is ahead of velocity direction', () => {
    it('should look in the direction of travel', () => {
      const shipPos = new THREE.Vector3(100, 0, 0);
      const shipVel = new THREE.Vector3(20, 0, 0); // moving along +X

      // Run several frames to let smoothing converge
      for (let i = 0; i < 120; i++) {
        director.update(1 / 60, shipPos, shipVel, 'FREE', {});
      }

      const lookTarget = director.getLookTarget();

      // The look target should be ahead of the ship (+X direction)
      expect(lookTarget.x).toBeGreaterThan(shipPos.x);
    });

    it('should look ahead along -Z when moving in -Z direction', () => {
      const shipPos = new THREE.Vector3(100, 0, 100);
      const shipVel = new THREE.Vector3(0, 0, -15); // moving along -Z

      for (let i = 0; i < 120; i++) {
        director.update(1 / 60, shipPos, shipVel, 'FREE', {});
      }

      const lookTarget = director.getLookTarget();

      // Look target should have Z < ship position (ahead in -Z)
      expect(lookTarget.z).toBeLessThan(shipPos.z);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  //  Smooth blending doesn't snap
  // ═══════════════════════════════════════════════════════════════════

  describe('smooth blending', () => {
    it('two consecutive updates produce close results (no snapping)', () => {
      const shipPos = new THREE.Vector3(500, 0, 50);
      const shipVel = new THREE.Vector3(10, 0, 0);

      // First update
      director.update(1 / 60, shipPos, shipVel, 'FREE', {});
      const lookAfter1 = director.getLookTarget().clone();

      // Second update
      director.update(1 / 60, shipPos, shipVel, 'FREE', {});
      const lookAfter2 = director.getLookTarget().clone();

      // The two look targets should be close to each other (no sudden snap)
      const delta = lookAfter1.distanceTo(lookAfter2);
      expect(delta).toBeLessThan(50); // reasonable threshold for one frame's worth of smoothing
    });

    it('should converge toward the raw target over many frames', () => {
      const shipPos = new THREE.Vector3(500, 0, 50);
      const shipVel = new THREE.Vector3(10, 0, 0);

      // Set initial look target far away
      director._currentLookTarget.set(0, 0, 0);

      // Run many frames
      for (let i = 0; i < 300; i++) {
        director.update(1 / 60, shipPos, shipVel, 'FREE', {});
      }

      const lookTarget = director.getLookTarget();
      const rawTarget = director.lookTarget.clone();

      // After 300 frames (~5 seconds), smoothed target should be close to raw target.
      // The raw target itself can shift slightly each frame as POIs update,
      // so we allow a moderate tolerance.
      const dist = lookTarget.distanceTo(rawTarget);
      expect(dist).toBeLessThan(30);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  //  SCENIC_DRIFT slowly changes look direction
  // ═══════════════════════════════════════════════════════════════════

  describe('SCENIC_DRIFT slowly changes look direction', () => {
    it('should gradually change the look target over time', () => {
      const shipPos = new THREE.Vector3(500, 0, 0);
      const shipVel = new THREE.Vector3(0, 0, 0);

      // Run some frames to initialize
      for (let i = 0; i < 30; i++) {
        director.update(1 / 60, shipPos, shipVel, 'IDLE', {});
      }
      const lookEarly = director.getLookTarget().clone();

      // Run many more frames (simulating several seconds)
      for (let i = 0; i < 300; i++) {
        director.update(1 / 60, shipPos, shipVel, 'IDLE', {});
      }
      const lookLater = director.getLookTarget().clone();

      // The look target should have changed (slow drift)
      const drift = lookEarly.distanceTo(lookLater);
      expect(drift).toBeGreaterThan(0.01); // should have moved at least a tiny bit
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  //  WARP_LOCK doesn't change orientation
  // ═══════════════════════════════════════════════════════════════════

  describe('WARP_LOCK', () => {
    it('should not change lookTarget or offset during WARP', () => {
      const shipPos = new THREE.Vector3(500, 0, 0);
      const shipVel = new THREE.Vector3(10, 0, 0);

      // First, establish a look target in FREE state
      for (let i = 0; i < 60; i++) {
        director.update(1 / 60, shipPos, shipVel, 'FREE', {});
      }

      // Enter warp
      director.update(1 / 60, shipPos, shipVel, 'WARP', {});
      const lookAtWarpStart = director.getLookTarget().clone();
      const offsetAtWarpStart = director.getOffset().clone();

      // Run many frames in WARP
      for (let i = 0; i < 100; i++) {
        director.update(1 / 60, shipPos, shipVel, 'WARP', {});
      }

      const lookAfterWarp = director.getLookTarget();
      const offsetAfterWarp = director.getOffset();

      // During WARP_LOCK, smoothing is frozen -- orientation should be identical
      expect(lookAfterWarp.distanceTo(lookAtWarpStart)).toBeLessThan(0.001);
      expect(offsetAfterWarp.distanceTo(offsetAtWarpStart)).toBeLessThan(0.001);
    });
  });
});


// ═══════════════════════════════════════════════════════════════════
//  CameraCompositions unit tests
// ═══════════════════════════════════════════════════════════════════

describe('CameraCompositions', () => {
  describe('framePlanetPortrait', () => {
    it('should return a point near the body position', () => {
      const bodyPos = new THREE.Vector3(100, 0, 0);
      const cameraPos = new THREE.Vector3(0, 0, 0);
      const mockCamera = { fov: 60 };

      const lookAt = CameraCompositions.framePlanetPortrait(
        bodyPos, 5, cameraPos, mockCamera, 0.5
      );

      // Should be close to the body, not at the camera
      const distToBody = lookAt.distanceTo(bodyPos);
      const distToCamera = lookAt.distanceTo(cameraPos);
      expect(distToBody).toBeLessThan(distToCamera);
    });

    it('should return body center when body is very far away (tiny angular size)', () => {
      const bodyPos = new THREE.Vector3(10000, 0, 0);
      const cameraPos = new THREE.Vector3(0, 0, 0);
      const mockCamera = { fov: 60 };

      const lookAt = CameraCompositions.framePlanetPortrait(
        bodyPos, 0.1, cameraPos, mockCamera, 0.5
      );

      // Very small body very far away -> should just look at body center
      expect(lookAt.distanceTo(bodyPos)).toBeLessThan(0.01);
    });
  });

  describe('leadingSpace', () => {
    it('should return a zero vector when velocity is near zero', () => {
      const vel = new THREE.Vector3(0.001, 0, 0);
      const camPos = new THREE.Vector3(0, 0, 0);

      const offset = CameraCompositions.leadingSpace(vel, camPos, 0.1);

      expect(offset.length()).toBeLessThan(0.01);
    });

    it('should return an offset opposite to velocity direction', () => {
      const vel = new THREE.Vector3(20, 0, 0); // moving in +X
      const camPos = new THREE.Vector3(0, 0, 0);

      const offset = CameraCompositions.leadingSpace(vel, camPos, 0.1);

      // Offset should be in -X direction (camera sits behind ship)
      expect(offset.x).toBeLessThan(0);
    });

    it('should increase offset with speed', () => {
      const camPos = new THREE.Vector3(0, 0, 0);

      const offsetSlow = CameraCompositions.leadingSpace(
        new THREE.Vector3(5, 0, 0), camPos, 0.1
      );
      const offsetFast = CameraCompositions.leadingSpace(
        new THREE.Vector3(30, 0, 0), camPos, 0.1
      );

      expect(offsetFast.length()).toBeGreaterThan(offsetSlow.length());
    });
  });

  describe('frameWithBackground', () => {
    it('should return primary body position when no background bodies', () => {
      const primary = { position: new THREE.Vector3(100, 0, 0), radius: 5 };
      const cameraPos = new THREE.Vector3(0, 0, 0);

      const lookAt = CameraCompositions.frameWithBackground(primary, [], cameraPos);

      expect(lookAt.distanceTo(primary.position)).toBeLessThan(0.01);
    });

    it('should blend toward background bodies when present', () => {
      const primary = { position: new THREE.Vector3(100, 0, 0), radius: 5 };
      const bg = [{ position: new THREE.Vector3(200, 50, 0), radius: 10 }];
      const cameraPos = new THREE.Vector3(0, 0, 0);

      const lookAt = CameraCompositions.frameWithBackground(primary, bg, cameraPos);

      // Should be between primary and background (closer to primary due to 70/30 blend)
      expect(lookAt.x).toBeGreaterThan(primary.position.x);
      expect(lookAt.x).toBeLessThan(bg[0].position.x);
    });
  });

  describe('frameRingSystem', () => {
    it('should return a point near the body', () => {
      const bodyPos = new THREE.Vector3(100, 0, 0);
      const ringNormal = new THREE.Vector3(0, 1, 0); // rings in XZ plane
      const cameraPos = new THREE.Vector3(0, 0, 0);

      const lookAt = CameraCompositions.frameRingSystem(bodyPos, ringNormal, cameraPos);

      // Should be near the body
      expect(lookAt.distanceTo(bodyPos)).toBeLessThan(50);
    });
  });
});
