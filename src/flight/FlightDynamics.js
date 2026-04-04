/**
 * FlightDynamics -- gravity-driven ship position system.
 *
 * Owns the ship's position and velocity. Every frame it:
 *   1. Queries GravityField.accelerationAt(position) for gravitational pull
 *   2. Adds player thrust (if any)
 *   3. Integrates with symplectic Euler (velocity first, then position)
 *   4. Applies minimal drag (space is nearly frictionless -- gravity provides braking)
 *   5. Detects state transitions (orbit capture, escape, idle)
 *
 * This replaces the manual drag-based movement in ShipCamera with physically
 * motivated motion. The camera will eventually read position/velocity from
 * this class instead of computing its own.
 *
 * Units:
 *   Position: scene units (1 AU = 1000)
 *   Velocity: scene units per second
 *   Mass: solar masses (consistent with OrbitalMechanics.G_SCENE)
 */

import * as THREE from 'three';
import { OrbitalMechanics } from '../physics/OrbitalMechanics.js';
import { FlightState, validateTransition } from './FlightStates.js';

// Reusable scratch vectors to avoid per-frame allocations
const _scratch1 = new THREE.Vector3();
const _scratch2 = new THREE.Vector3();

export class FlightDynamics {
  /**
   * @param {import('../physics/GravityField.js').GravityField} gravityField
   * @param {object} [options]
   * @param {number} [options.thrustForce=40]       - max thrust acceleration (scene units/s^2)
   * @param {number} [options.dragCoefficient=0.02]  - very low drag (space is frictionless)
   * @param {number} [options.maxSpeed=500]          - speed cap to prevent physics explosions
   * @param {number} [options.idleSpeedThreshold=0.5]  - below this speed, consider idle
   * @param {number} [options.idleTimeRequired=3]    - seconds below threshold before IDLE
   * @param {number} [options.orbitTolerance=0.2]    - fractional tolerance for orbit detection
   */
  constructor(gravityField, options = {}) {
    this.gravityField = gravityField;

    // Kinematic state
    this.position = new THREE.Vector3();
    this.velocity = new THREE.Vector3();

    // Tuning
    this.thrustForce = options.thrustForce ?? 40;
    this.dragCoefficient = options.dragCoefficient ?? 0.02;
    this.maxSpeed = options.maxSpeed ?? 500;
    this.idleSpeedThreshold = options.idleSpeedThreshold ?? 0.5;
    this.idleTimeRequired = options.idleTimeRequired ?? 3;
    this.orbitTolerance = options.orbitTolerance ?? 0.2;

    // Player thrust input -- set by the caller each frame, then cleared
    this.thrustVector = new THREE.Vector3();

    // State machine
    this.state = FlightState.IDLE;

    // Orbit tracking (populated when state === ORBIT)
    this._orbitBodyIndex = -1;     // index into gravityField.bodies
    this._orbitRadius = 0;         // current orbital radius

    // Approach tracking (populated when state === APPROACH)
    this._approachBodyIndex = -1;
    this._approachBrakeDistance = 0;

    // Idle detection timer
    this._idleTimer = 0;

    // Last gravity query result (exposed for external consumers like HUD)
    this.lastGravResult = null;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  MAIN UPDATE
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Advance the simulation by dt seconds.
   *
   * Uses symplectic Euler integration (update velocity first, then position).
   * This is more stable than naive Euler for orbital mechanics because it
   * conserves energy better over long time spans.
   *
   * @param {number} dt - time step in seconds
   */
  update(dt) {
    // Clamp dt to prevent physics explosions on tab-switch
    const clampedDt = Math.min(dt, 0.1);

    // WARP state freezes everything
    if (this.state === FlightState.WARP) {
      return;
    }

    // 0. Run approach auto-thrust (sets thrustVector before it's consumed below)
    if (this.state === FlightState.APPROACH) {
      this._updateApproach(clampedDt);
    }

    // 1. Query gravity at current position
    const gravResult = this.gravityField.accelerationAt(this.position);
    this.lastGravResult = gravResult;

    // 2. Compute total acceleration = gravity + thrust
    const acceleration = _scratch1.copy(gravResult.acceleration);

    // Add player thrust (clamped to thrustForce magnitude)
    if (this.thrustVector.lengthSq() > 0) {
      const thrustMag = Math.min(this.thrustVector.length(), this.thrustForce);
      const thrustDir = _scratch2.copy(this.thrustVector).normalize();
      acceleration.addScaledVector(thrustDir, thrustMag);
    }

    // 3. Apply drag (very light -- models solar wind / micrometeorite friction)
    // Drag force = -dragCoefficient * velocity
    // This gives exponential decay: v(t) = v0 * e^(-drag*t)
    // With drag=0.02, speed halves every ~35 seconds -- barely noticeable
    acceleration.addScaledVector(this.velocity, -this.dragCoefficient);

    // 4. Symplectic Euler integration
    //    velocity += acceleration * dt  (update velocity FIRST)
    //    position += velocity * dt       (then use NEW velocity for position)
    this.velocity.addScaledVector(acceleration, clampedDt);

    // 5. Speed cap
    const speed = this.velocity.length();
    if (speed > this.maxSpeed) {
      this.velocity.multiplyScalar(this.maxSpeed / speed);
    }

    // 6. Update position using the new velocity
    this.position.addScaledVector(this.velocity, clampedDt);

    // 7. State detection
    this._updateState(gravResult);

    // 8. Clear thrust input (caller must set it again next frame)
    this.thrustVector.set(0, 0, 0);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  STATE DETECTION (private)
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Detect and execute state transitions based on current physics.
   *
   * The logic:
   * - If speed is near circular velocity AND velocity is perpendicular
   *   to the radial direction, we're in orbit -> ORBIT
   * - If in ORBIT and speed exceeds escape velocity -> FREE (escape)
   * - If speed is below idle threshold for N seconds -> IDLE
   * - Otherwise -> FREE
   */
  _updateState(gravResult) {
    if (!gravResult.dominantBody) return;

    const speed = this.velocity.length();
    const body = gravResult.dominantBody;
    const bodyIndex = gravResult.dominantIndex;
    const dist = gravResult.distToDominant;

    // Get orbital reference velocities
    const vCirc = OrbitalMechanics.circularVelocity(body.mass, dist);
    const vEsc = OrbitalMechanics.escapeVelocity(body.mass, dist);

    // ── ORBIT detection ──
    // Check if we're in a roughly circular orbit using OrbitalMechanics
    const posArr = [this.position.x, this.position.y, this.position.z];
    const velArr = [this.velocity.x, this.velocity.y, this.velocity.z];
    const bodyPosArr = [body.position.x, body.position.y, body.position.z];

    const isCircular = OrbitalMechanics.isNearCircular(
      posArr, velArr, bodyPosArr, body.mass, this.orbitTolerance
    );

    if (this.state === FlightState.ORBIT) {
      // Currently in orbit -- check for escape
      if (speed >= vEsc) {
        this._transitionTo(FlightState.FREE);
        this._orbitBodyIndex = -1;
        this._orbitRadius = 0;
      } else {
        // Update orbit tracking
        this._orbitRadius = dist;
      }
    } else if (this.state === FlightState.FREE || this.state === FlightState.IDLE) {
      // Not in orbit -- check if we've been captured
      if (isCircular && dist < (body.soiRadius ?? Infinity)) {
        this._transitionTo(FlightState.ORBIT);
        this._orbitBodyIndex = bodyIndex;
        this._orbitRadius = dist;
      }
    }

    // ── IDLE detection ──
    // If speed is very low for a sustained period, transition to IDLE
    if (this.state === FlightState.FREE) {
      if (speed < this.idleSpeedThreshold) {
        this._idleTimer += 0.016; // approximate frame time
        if (this._idleTimer >= this.idleTimeRequired) {
          this._transitionTo(FlightState.IDLE);
          this._idleTimer = 0;
        }
      } else {
        this._idleTimer = 0;
      }
    }

    // ── IDLE -> FREE when moving ──
    if (this.state === FlightState.IDLE && speed > this.idleSpeedThreshold * 2) {
      this._transitionTo(FlightState.FREE);
    }
  }

  /**
   * Attempt a state transition. Only proceeds if the transition is valid.
   *
   * @param {string} newState - target FlightState
   * @returns {boolean} true if transition occurred
   */
  _transitionTo(newState) {
    if (this.state === newState) return false;
    if (!validateTransition(this.state, newState)) return false;

    this.state = newState;
    return true;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  COMMANDS (called by player actions or autopilot)
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Adjust velocity to achieve a perfect circular orbit around the
   * current dominant body.
   *
   * Computes the delta-v needed: sets speed to exactly circular velocity,
   * directed perpendicular to the radial vector (tangent to the orbit).
   *
   * @returns {number} delta-v magnitude applied (scene units/s)
   */
  circularize() {
    if (!this.lastGravResult || !this.lastGravResult.dominantBody) return 0;

    const body = this.lastGravResult.dominantBody;
    const dist = this.lastGravResult.distToDominant;

    // Compute radial direction (position - body center)
    const radial = _scratch1.subVectors(this.position, body.position).normalize();

    // Compute tangent direction: perpendicular to radial in the current orbital plane.
    // We use the cross product of radial with the "up" hint (Y axis), then cross again
    // to get a tangent that lies in the orbital plane defined by position + velocity.
    //
    // If velocity is non-zero, we prefer the tangent that aligns with current motion
    // (prograde circularization rather than retrograde).
    let tangent;
    if (this.velocity.lengthSq() > 0.001) {
      // Project velocity onto the plane perpendicular to radial
      const radialComponent = radial.clone().multiplyScalar(this.velocity.dot(radial));
      tangent = _scratch2.copy(this.velocity).sub(radialComponent);
      if (tangent.lengthSq() < 0.0001) {
        // Velocity is purely radial -- pick an arbitrary perpendicular
        tangent.set(-radial.z, 0, radial.x).normalize();
      } else {
        tangent.normalize();
      }
    } else {
      // No velocity -- pick arbitrary tangent
      tangent = _scratch2.set(-radial.z, 0, radial.x).normalize();
    }

    // Target velocity: circular speed in the tangent direction
    const vCirc = OrbitalMechanics.circularVelocity(body.mass, dist);
    const targetVelocity = tangent.clone().multiplyScalar(vCirc);

    // Delta-v
    const deltaV = targetVelocity.clone().sub(this.velocity);
    const deltaVMag = deltaV.length();

    // Apply
    this.velocity.copy(targetVelocity);

    // Update state
    this._orbitBodyIndex = this.lastGravResult.dominantIndex;
    this._orbitRadius = dist;
    this._transitionTo(FlightState.ORBIT);

    return deltaVMag;
  }

  /**
   * Apply delta-v to reach escape velocity from the current dominant body.
   *
   * The escape burn is applied in the given direction. If no direction is
   * provided, it burns prograde (along current velocity).
   *
   * @param {THREE.Vector3} [direction] - desired escape direction (will be normalized)
   * @returns {number} delta-v magnitude applied (scene units/s)
   */
  escape(direction) {
    if (!this.lastGravResult || !this.lastGravResult.dominantBody) return 0;

    const body = this.lastGravResult.dominantBody;
    const dist = this.lastGravResult.distToDominant;
    const vEsc = OrbitalMechanics.escapeVelocity(body.mass, dist);

    // Determine burn direction
    let burnDir;
    if (direction && direction.lengthSq() > 0) {
      burnDir = _scratch1.copy(direction).normalize();
    } else if (this.velocity.lengthSq() > 0.001) {
      // Prograde -- along current velocity
      burnDir = _scratch1.copy(this.velocity).normalize();
    } else {
      // No velocity, no direction -- burn radially outward
      burnDir = _scratch1.subVectors(this.position, body.position).normalize();
    }

    // Current speed in the burn direction
    const currentSpeedInDir = this.velocity.dot(burnDir);

    // We need at least escape velocity in this direction
    // Add a small margin (5%) to ensure we actually escape
    const targetSpeed = vEsc * 1.05;
    const deltaVNeeded = targetSpeed - currentSpeedInDir;

    if (deltaVNeeded <= 0) {
      // Already at escape velocity in this direction
      this._transitionTo(FlightState.FREE);
      return 0;
    }

    this.velocity.addScaledVector(burnDir, deltaVNeeded);

    this._orbitBodyIndex = -1;
    this._orbitRadius = 0;
    this._transitionTo(FlightState.FREE);

    return deltaVNeeded;
  }

  /**
   * Begin an automated approach to a body.
   *
   * Sets the APPROACH state and computes an initial braking distance.
   * The approach logic in update() will apply thrust toward the body
   * and decelerate as it gets close.
   *
   * @param {number} bodyIndex - index into gravityField.bodies
   * @returns {number} estimated braking distance (scene units)
   */
  approachBody(bodyIndex) {
    const body = this.gravityField.bodies[bodyIndex];
    if (!body) return 0;

    this._approachBodyIndex = bodyIndex;

    // Compute braking distance using kinematic equation:
    // d = v^2 / (2 * a_brake)
    // where a_brake = thrustForce (we can decelerate at full thrust)
    const speed = this.velocity.length();
    const brakingDecel = this.thrustForce * 0.8; // use 80% thrust for margin
    this._approachBrakeDistance = brakingDecel > 0
      ? (speed * speed) / (2 * brakingDecel)
      : 0;

    this._transitionTo(FlightState.APPROACH);

    return this._approachBrakeDistance;
  }

  /**
   * Update the approach: thrust toward target, brake when close.
   * Called from update() when state === APPROACH.
   *
   * @param {number} dt - time step in seconds
   */
  _updateApproach(dt) {
    if (this._approachBodyIndex < 0) return;

    const body = this.gravityField.bodies[this._approachBodyIndex];
    if (!body) {
      this._transitionTo(FlightState.FREE);
      return;
    }

    // Vector toward target body
    const toBody = _scratch1.subVectors(body.position, this.position);
    const distance = toBody.length();
    toBody.normalize();

    // Recompute braking distance each frame (speed changes)
    const speed = this.velocity.length();
    const brakingDecel = this.thrustForce * 0.8;
    this._approachBrakeDistance = brakingDecel > 0
      ? (speed * speed) / (2 * brakingDecel)
      : 0;

    // Decide thrust direction: toward body if far, or brake if close
    const arrivalDist = (body.soiRadius ?? 10) * 0.3; // stop at 30% of SOI
    const minArrival = 5; // minimum arrival distance
    const targetDist = Math.max(arrivalDist, minArrival);

    if (distance > this._approachBrakeDistance + targetDist) {
      // Far away: thrust toward body
      this.thrustVector.copy(toBody).multiplyScalar(this.thrustForce);
    } else if (distance > targetDist) {
      // In braking zone: thrust against velocity (decelerate)
      if (speed > 0.5) {
        const brakeDir = _scratch2.copy(this.velocity).normalize().negate();
        // Scale braking force with how much we need to slow down
        const brakeFraction = Math.min(speed / 2, 1);
        this.thrustVector.copy(brakeDir).multiplyScalar(this.thrustForce * brakeFraction);
      }
    } else {
      // Arrived: try to circularize
      this._approachBodyIndex = -1;
      this.circularize();
      return;
    }
  }

  /**
   * Enter warp state. Position and velocity are frozen.
   */
  enterWarp() {
    this._transitionTo(FlightState.WARP);
  }

  /**
   * Exit warp at a new position with a new velocity.
   * Resumes in FREE state.
   *
   * @param {THREE.Vector3} position - new position after warp
   * @param {THREE.Vector3} [velocity] - new velocity (defaults to zero)
   */
  exitWarp(position, velocity) {
    if (position) {
      this.position.copy(position);
    }
    if (velocity) {
      this.velocity.copy(velocity);
    } else {
      this.velocity.set(0, 0, 0);
    }
    // WARP -> FREE is a valid transition
    this.state = FlightState.WARP; // ensure we're in WARP before transitioning
    this._transitionTo(FlightState.FREE);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  UTILITY
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Current speed (magnitude of velocity).
   * @returns {number}
   */
  getSpeed() {
    return this.velocity.length();
  }

  /**
   * Get info about the current orbit (only meaningful in ORBIT state).
   * @returns {{ bodyIndex: number, radius: number, body: object|null }}
   */
  getOrbitInfo() {
    if (this.state !== FlightState.ORBIT || this._orbitBodyIndex < 0) {
      return { bodyIndex: -1, radius: 0, body: null };
    }
    return {
      bodyIndex: this._orbitBodyIndex,
      radius: this._orbitRadius,
      body: this.gravityField.bodies[this._orbitBodyIndex] ?? null,
    };
  }

  /**
   * Teleport to a position with optional velocity. Resets state to FREE.
   *
   * @param {THREE.Vector3} position
   * @param {THREE.Vector3} [velocity]
   */
  setPositionVelocity(position, velocity) {
    this.position.copy(position);
    if (velocity) {
      this.velocity.copy(velocity);
    } else {
      this.velocity.set(0, 0, 0);
    }
    this.state = FlightState.FREE;
    this._orbitBodyIndex = -1;
    this._orbitRadius = 0;
    this._idleTimer = 0;
  }
}
