import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { FlightDynamics } from '../FlightDynamics.js';
import { FlightState, validateTransition } from '../FlightStates.js';
import { OrbitalMechanics } from '../../physics/OrbitalMechanics.js';

// ── Minimal GravityField mock ──
// We don't need the full GravityField (which requires systemData, meshes, etc.).
// Instead, we mock just the methods FlightDynamics calls:
//   - accelerationAt(position) -> { acceleration, dominantBody, dominantIndex, distToDominant, inSOI }
//   - bodies[] array

function createMockGravityField(options = {}) {
  const starMass = options.starMass ?? 1.0; // solar masses
  const starPosition = options.starPosition ?? new THREE.Vector3(0, 0, 0);

  const bodies = [
    {
      name: 'star',
      mass: starMass,
      soiRadius: Infinity,
      hillRadius: Infinity,
      parentIndex: -1,
      position: starPosition.clone(),
    },
  ];

  // Add extra bodies if provided
  if (options.extraBodies) {
    for (const b of options.extraBodies) {
      bodies.push(b);
    }
  }

  return {
    bodies,

    accelerationAt(position) {
      // Simple: gravity from the star only
      const dir = new THREE.Vector3().subVectors(starPosition, position);
      const dist = dir.length();
      const acc = new THREE.Vector3();

      if (dist > 0) {
        const magnitude = OrbitalMechanics.gravitationalAcceleration(starMass, dist);
        acc.copy(dir).normalize().multiplyScalar(magnitude);
      }

      return {
        acceleration: acc,
        dominantBody: bodies[0],
        dominantIndex: 0,
        distToDominant: dist,
        inSOI: true,
      };
    },
  };
}


describe('FlightDynamics', () => {
  let gf;
  let fd;

  beforeEach(() => {
    gf = createMockGravityField();
    fd = new FlightDynamics(gf);
  });

  // ═══════════════════════════════════════════════════════════════════
  //  Basic gravity
  // ═══════════════════════════════════════════════════════════════════

  describe('gravity causes acceleration toward body', () => {
    it('should accelerate a stationary ship toward the star', () => {
      // Place ship at 100 scene units from star along +X
      fd.position.set(100, 0, 0);
      fd.velocity.set(0, 0, 0);
      fd.state = FlightState.FREE;

      fd.update(1 / 60);

      // Velocity should now point toward the star (-X direction)
      expect(fd.velocity.x).toBeLessThan(0);
      // Y and Z should be negligible
      expect(Math.abs(fd.velocity.y)).toBeLessThan(1e-10);
      expect(Math.abs(fd.velocity.z)).toBeLessThan(1e-10);
    });

    it('should accelerate more strongly when closer to the body', () => {
      // Ship at 50 units
      fd.position.set(50, 0, 0);
      fd.velocity.set(0, 0, 0);
      fd.state = FlightState.FREE;
      fd.update(1 / 60);
      const velClose = fd.velocity.length();

      // Reset and ship at 200 units
      const fd2 = new FlightDynamics(gf);
      fd2.position.set(200, 0, 0);
      fd2.velocity.set(0, 0, 0);
      fd2.state = FlightState.FREE;
      fd2.update(1 / 60);
      const velFar = fd2.velocity.length();

      // Closer ship should have gained more speed (gravity ~ 1/r^2)
      expect(velClose).toBeGreaterThan(velFar);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  //  Circular orbit stability
  // ═══════════════════════════════════════════════════════════════════

  describe('circular orbit stability', () => {
    it('should maintain roughly constant distance from body over many frames', () => {
      // Set up a circular orbit at 500 scene units from the star.
      // Circular velocity = sqrt(G_SCENE * M / r).
      const orbitRadius = 500;
      const vCirc = OrbitalMechanics.circularVelocity(1.0, orbitRadius);

      fd.position.set(orbitRadius, 0, 0);
      // Velocity perpendicular to radial (along +Z for orbit in XZ plane)
      fd.velocity.set(0, 0, vCirc);
      fd.state = FlightState.FREE;

      // Simulate 1000 frames at 60fps (~16.7 seconds of flight)
      const dt = 1 / 60;
      let minDist = Infinity;
      let maxDist = -Infinity;

      for (let i = 0; i < 1000; i++) {
        fd.update(dt);
        const dist = fd.position.length(); // distance from star at origin
        minDist = Math.min(minDist, dist);
        maxDist = Math.max(maxDist, dist);
      }

      // With symplectic Euler and very low drag, the orbit should stay
      // within ~10% of the initial radius. Drag will cause slow decay,
      // but 16 seconds is short enough that it should be minimal.
      const driftFraction = (maxDist - minDist) / orbitRadius;
      expect(driftFraction).toBeLessThan(0.15);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  //  Thrust effects
  // ═══════════════════════════════════════════════════════════════════

  describe('thrust in prograde direction increases orbital energy', () => {
    it('should increase speed when thrusting prograde', () => {
      const orbitRadius = 500;
      const vCirc = OrbitalMechanics.circularVelocity(1.0, orbitRadius);

      fd.position.set(orbitRadius, 0, 0);
      fd.velocity.set(0, 0, vCirc);
      fd.state = FlightState.FREE;

      const speedBefore = fd.velocity.length();

      // Apply prograde thrust (along velocity direction = +Z)
      fd.thrustVector.set(0, 0, 20);
      fd.update(1 / 60);

      const speedAfter = fd.velocity.length();
      expect(speedAfter).toBeGreaterThan(speedBefore);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  //  State transitions
  // ═══════════════════════════════════════════════════════════════════

  describe('state transitions', () => {
    it('should detect ORBIT when velocity matches circular orbit', () => {
      const orbitRadius = 500;
      const vCirc = OrbitalMechanics.circularVelocity(1.0, orbitRadius);

      fd.position.set(orbitRadius, 0, 0);
      fd.velocity.set(0, 0, vCirc);
      fd.state = FlightState.FREE;

      // Run a few frames for state detection to kick in
      for (let i = 0; i < 10; i++) {
        fd.update(1 / 60);
      }

      expect(fd.state).toBe(FlightState.ORBIT);
    });

    it('should detect orbit escape when speed exceeds escape velocity', () => {
      const orbitRadius = 500;
      const vCirc = OrbitalMechanics.circularVelocity(1.0, orbitRadius);

      // Start in orbit
      fd.position.set(orbitRadius, 0, 0);
      fd.velocity.set(0, 0, vCirc);
      fd.state = FlightState.ORBIT;
      fd._orbitBodyIndex = 0;
      fd._orbitRadius = orbitRadius;

      // Apply a massive prograde burn to exceed escape velocity
      const vEsc = OrbitalMechanics.escapeVelocity(1.0, orbitRadius);
      fd.velocity.set(0, 0, vEsc * 1.5);

      fd.update(1 / 60);

      expect(fd.state).toBe(FlightState.FREE);
    });

    it('IDLE -> FREE when ship starts moving', () => {
      fd.state = FlightState.IDLE;
      fd.position.set(1000, 0, 0);
      // Give a significant velocity
      fd.velocity.set(5, 0, 0);

      fd.update(1 / 60);

      expect(fd.state).toBe(FlightState.FREE);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  //  Drag is very low
  // ═══════════════════════════════════════════════════════════════════

  describe('drag is very low', () => {
    it('should barely change velocity over short time without gravity', () => {
      // Use a mock gravity field that returns zero acceleration
      const noGravGF = {
        bodies: [{
          name: 'star', mass: 0, soiRadius: Infinity, hillRadius: Infinity,
          parentIndex: -1, position: new THREE.Vector3(0, 0, 0),
        }],
        accelerationAt() {
          return {
            acceleration: new THREE.Vector3(0, 0, 0),
            dominantBody: this.bodies[0],
            dominantIndex: 0,
            distToDominant: 10000,
            inSOI: true,
          };
        },
      };

      const fdNoDrag = new FlightDynamics(noGravGF, { dragCoefficient: 0.02 });
      fdNoDrag.position.set(10000, 0, 0);
      fdNoDrag.velocity.set(100, 0, 0);
      fdNoDrag.state = FlightState.FREE;

      const initialSpeed = fdNoDrag.velocity.length();

      // Simulate 1 second (60 frames)
      for (let i = 0; i < 60; i++) {
        fdNoDrag.update(1 / 60);
      }

      const finalSpeed = fdNoDrag.velocity.length();
      const speedLoss = 1 - (finalSpeed / initialSpeed);

      // With drag=0.02, after 1 second: v ≈ v0 * e^(-0.02) ≈ 0.98 * v0
      // So speed loss should be ~2%
      expect(speedLoss).toBeLessThan(0.05);  // less than 5% loss in 1 second
      expect(speedLoss).toBeGreaterThan(0);   // some drag exists
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  //  WARP state
  // ═══════════════════════════════════════════════════════════════════

  describe('WARP state freezes position/velocity', () => {
    it('should not change position or velocity during WARP', () => {
      fd.position.set(100, 50, 200);
      fd.velocity.set(10, 5, -3);
      fd.state = FlightState.WARP;

      const posBefore = fd.position.clone();
      const velBefore = fd.velocity.clone();

      // Simulate many frames
      for (let i = 0; i < 100; i++) {
        fd.update(1 / 60);
      }

      expect(fd.position.x).toBe(posBefore.x);
      expect(fd.position.y).toBe(posBefore.y);
      expect(fd.position.z).toBe(posBefore.z);
      expect(fd.velocity.x).toBe(velBefore.x);
      expect(fd.velocity.y).toBe(velBefore.y);
      expect(fd.velocity.z).toBe(velBefore.z);
    });

    it('enterWarp() sets state to WARP', () => {
      fd.state = FlightState.FREE;
      fd.enterWarp();
      expect(fd.state).toBe(FlightState.WARP);
    });

    it('exitWarp() resumes at new position with FREE state', () => {
      fd.state = FlightState.WARP;
      const newPos = new THREE.Vector3(500, 100, -300);
      const newVel = new THREE.Vector3(2, 0, 1);

      fd.exitWarp(newPos, newVel);

      expect(fd.position.x).toBe(500);
      expect(fd.position.y).toBe(100);
      expect(fd.position.z).toBe(-300);
      expect(fd.velocity.x).toBe(2);
      expect(fd.velocity.y).toBe(0);
      expect(fd.velocity.z).toBe(1);
      expect(fd.state).toBe(FlightState.FREE);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  //  approachBody
  // ═══════════════════════════════════════════════════════════════════

  describe('approachBody', () => {
    it('should compute a reasonable braking distance', () => {
      // Ship moving at speed 50
      fd.velocity.set(50, 0, 0);
      fd.position.set(1000, 0, 0);
      fd.state = FlightState.FREE;

      // Add a planet to approach
      gf.bodies.push({
        name: 'planet-0',
        mass: 0.001,
        soiRadius: 50,
        hillRadius: 55,
        parentIndex: 0,
        position: new THREE.Vector3(200, 0, 0),
      });

      const brakeDist = fd.approachBody(1);

      // Braking distance = v^2 / (2 * a) where a = 0.8 * thrustForce = 32
      // = 2500 / 64 ≈ 39
      expect(brakeDist).toBeGreaterThan(0);
      expect(brakeDist).toBeLessThan(200); // reasonable for this speed
      expect(fd.state).toBe(FlightState.APPROACH);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  //  Commands: circularize and escape
  // ═══════════════════════════════════════════════════════════════════

  describe('circularize', () => {
    it('should set velocity to circular orbit speed', () => {
      fd.position.set(500, 0, 0);
      fd.velocity.set(3, 1, -2); // some random velocity
      fd.state = FlightState.FREE;

      // Run one frame to populate lastGravResult
      fd.update(1 / 60);

      const deltaV = fd.circularize();
      expect(deltaV).toBeGreaterThan(0);

      // After circularize, speed should be close to circular velocity
      const vCirc = OrbitalMechanics.circularVelocity(1.0, fd.position.length());
      const speedRatio = fd.velocity.length() / vCirc;
      expect(speedRatio).toBeCloseTo(1.0, 1); // within 10%

      expect(fd.state).toBe(FlightState.ORBIT);
    });
  });

  describe('escape', () => {
    it('should set velocity above escape speed', () => {
      const orbitRadius = 500;
      const vCirc = OrbitalMechanics.circularVelocity(1.0, orbitRadius);

      fd.position.set(orbitRadius, 0, 0);
      fd.velocity.set(0, 0, vCirc);
      fd.state = FlightState.ORBIT;
      fd._orbitBodyIndex = 0;

      // Run one frame to populate lastGravResult
      fd.update(1 / 60);
      // Force back to ORBIT since update may have changed state
      fd.state = FlightState.ORBIT;

      const deltaV = fd.escape();
      expect(deltaV).toBeGreaterThan(0);

      const vEsc = OrbitalMechanics.escapeVelocity(1.0, fd.position.length());
      expect(fd.velocity.length()).toBeGreaterThan(vEsc * 0.99);
      expect(fd.state).toBe(FlightState.FREE);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  //  FlightStates
  // ═══════════════════════════════════════════════════════════════════

  describe('FlightStates validation', () => {
    it('should allow valid transitions', () => {
      expect(validateTransition(FlightState.IDLE, FlightState.FREE)).toBe(true);
      expect(validateTransition(FlightState.FREE, FlightState.ORBIT)).toBe(true);
      expect(validateTransition(FlightState.ORBIT, FlightState.FREE)).toBe(true);
      expect(validateTransition(FlightState.WARP, FlightState.FREE)).toBe(true);
    });

    it('should reject invalid transitions', () => {
      // Can't go directly from ORBIT to IDLE (must go through FREE first)
      expect(validateTransition(FlightState.ORBIT, FlightState.IDLE)).toBe(false);
      // Can't go from APPROACH to IDLE directly
      expect(validateTransition(FlightState.APPROACH, FlightState.IDLE)).toBe(false);
    });
  });
});
