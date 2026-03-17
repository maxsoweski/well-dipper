import * as THREE from 'three';
import { CameraPhysics } from './CameraPhysics.js';

/**
 * ShipCamera — velocity-based physics camera that feels like piloting a ship.
 *
 * Replaces the orbit-based CameraController with a state machine that uses
 * CameraPhysics for all movement. The camera always has mass: inputs apply
 * thrust/impulse, drag decays motion, and transitions between states
 * preserve velocity for smooth handoffs.
 *
 * States:
 *   IDLE        — gentle auto-drift, waiting for input
 *   FREE_FLIGHT — player-controlled: drag to steer, scroll to thrust
 *   APPROACH    — flying toward a clicked body (auto-thrust + deceleration)
 *   ORBIT       — velocity-maintained orbit around a body
 *   AUTOPILOT   — FlythroughCamera takes over (this.bypassed = true)
 *   WARP        — camera locked during warp transition
 *
 * Drop-in replacement for CameraController — exposes the same key methods:
 *   update(deltaTime), focusOn(target, distance), viewSystem(systemRadius),
 *   onResize(width, height), position getter, restoreFromWorldState(),
 *   bypassed flag, setTarget(), trackTarget(), etc.
 */

// ── State constants ──
const State = {
  IDLE: 'IDLE',
  FREE_FLIGHT: 'FREE_FLIGHT',
  APPROACH: 'APPROACH',
  ORBIT: 'ORBIT',
  AUTOPILOT: 'AUTOPILOT',
  WARP: 'WARP',
};

// Reusable scratch vectors to avoid per-frame allocations
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();

export class ShipCamera {
  constructor(camera, canvas) {
    this.camera = camera;
    this.canvas = canvas;
    this.state = State.IDLE;

    // ── Physics engine ──
    this.physics = new CameraPhysics({
      thrustForce: 40,
      dragCoefficient: 1.5,
      rotationalDrag: 4.0,
      maxSpeed: 200,
      maxRotationalSpeed: 3.0,
    });

    // ── Orbit target (the body we're orbiting or approaching) ──
    this.target = new THREE.Vector3(0, 0, 0);
    this._targetGoal = new THREE.Vector3(0, 0, 0);
    this._orbitBodyRef = null;      // Three.js mesh of the body we're orbiting
    this._orbitRadius = 8;          // desired orbit distance
    this._orbitYaw = 0;             // current angle in orbit
    this._orbitDirection = 1;       // 1 = CW, -1 = CCW
    this._orbitYawSpeed = 0.3;      // rad/s for orbit corrections

    // ── Approach state ──
    this._approachTarget = null;    // body mesh to fly toward
    this._approachDist = 8;         // comfortable orbit distance at arrival
    this._approachWaypoint = new THREE.Vector3();

    // ── Idle state ──
    this._idleAutoYawSpeed = 0.012; // rad/s — very gentle drift
    this._idleTimer = 0;            // time with no input
    this._idleTimeout = 20;         // seconds before autopilot kicks in

    // ── Input tracking ──
    this._lastInputTime = 0;        // timestamp of last player input
    this.isDragging = false;
    this._lastMouseX = 0;
    this._lastMouseY = 0;
    this.dragSensitivity = 0.003;

    // ── Scroll thrust ──
    this._scrollImpulse = 0;        // accumulated scroll impulse
    this.scrollSensitivity = 1.5;

    // ── Smoothed values (for API compatibility with CameraController) ──
    this.smoothedYaw = 0;
    this.smoothedPitch = 0;
    this.smoothedDistance = 8;

    // ── Orbit zoom (for scroll in ORBIT state) ──
    this.distance = 8;
    this.minDistance = 0.01;
    this.maxDistance = 50000;
    this.zoomSpeed = 0;
    this.zoomDamping = 0.88;

    // ── Bypass mode (for FlythroughCamera / autopilot) ──
    this.bypassed = false;

    // ── Flags for compatibility with CameraController API ──
    this.forceFreeLook = false;
    this.isFreeLooking = false;
    this.autoRotateActive = true;
    this.autoRotateSpeed = 0.67;
    this._leftFreeLooking = false;
    this.gyroEnabled = false;

    // ── Callbacks (same as CameraController) ──
    this.onFreeLookEnd = null;
    this.hasFocusedBody = null;

    // ── Autopilot idle callback ──
    // Set by main.js — called when idle timeout triggers autopilot.
    this.onIdleTimeout = null;

    // ── Escape orbit threshold ──
    // If thrust away from orbit exceeds this, break into FREE_FLIGHT.
    this._escapeThreshold = 15;

    // ── Touch state ──
    this._lastTouchX = 0;
    this._lastTouchY = 0;
    this._lastPinchDist = 0;
    this._touchCount = 0;

    // ── Transition state ──
    this._transitioning = false;
    this._transitionSpeed = 0.06;

    // ── Return-to-orbit state (compatibility) ──
    this._returningToOrbit = false;

    this._setupListeners();

    // Initialize physics from camera
    this.physics.syncFromCamera(camera);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  PUBLIC API — drop-in compatible with CameraController
  // ═══════════════════════════════════════════════════════════════════

  /**
   * The Three.js camera's position (read-only convenience getter).
   */
  get position() {
    return this.camera.position;
  }

  /**
   * Main update loop — call once per frame.
   * Dispatches to the current state's update handler.
   *
   * @param {number} deltaTime — seconds since last frame
   */
  update(deltaTime) {
    if (this.bypassed) return;

    // Clamp deltaTime to prevent physics explosions on tab-switch
    const dt = Math.min(deltaTime, 0.1);

    switch (this.state) {
      case State.IDLE:
        this._updateIdle(dt);
        break;
      case State.FREE_FLIGHT:
        this._updateFreeFlight(dt);
        break;
      case State.APPROACH:
        this._updateApproach(dt);
        break;
      case State.ORBIT:
        this._updateOrbit(dt);
        break;
      case State.WARP:
        // Camera locked — no physics updates
        break;
      case State.AUTOPILOT:
        // FlythroughCamera handles updates
        break;
    }

    // Update smoothed values for API compatibility
    this.smoothedYaw = this.physics.yaw;
    this.smoothedPitch = this.physics.pitch;
    if (this._orbitBodyRef) {
      this.smoothedDistance = this.camera.position.distanceTo(
        this._orbitBodyRef.position
      );
    } else {
      this.smoothedDistance = this.distance;
    }
  }

  /**
   * Focus on a target body — triggers APPROACH state.
   * The camera will fly toward the target and settle into orbit.
   *
   * @param {THREE.Vector3} position — world position of the body
   * @param {number} viewDistance — comfortable orbit distance
   */
  focusOn(position, viewDistance = 8) {
    this.target.copy(position);
    this._targetGoal.copy(position);
    this._approachDist = viewDistance;
    this.distance = viewDistance;

    // Compute a waypoint near the target at the orbit distance.
    // Approach from the camera's current direction for a natural path.
    _v1.subVectors(this.physics.position, position).normalize();
    this._approachWaypoint.copy(position).addScaledVector(_v1, viewDistance);

    this._transitionTo(State.APPROACH);
  }

  /**
   * Zoom out to see the whole system.
   *
   * @param {number} systemRadius — radius of the outermost orbit
   */
  viewSystem(systemRadius) {
    const viewDist = systemRadius * 1.5;
    this.target.set(0, 0, 0);
    this._targetGoal.set(0, 0, 0);
    this.distance = viewDist;
    this._approachDist = viewDist;

    // Approach the origin from current direction
    _v1.subVectors(this.physics.position, this.target).normalize();
    this._approachWaypoint.copy(this.target).addScaledVector(_v1, viewDist);

    this._transitionTo(State.APPROACH);
  }

  /**
   * Handle window resize. Updates camera aspect ratio and projection.
   *
   * @param {number} width — new viewport width
   * @param {number} height — new viewport height
   */
  onResize(width, height) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Set the orbit target instantly (no animation).
   * API-compatible with CameraController.setTarget().
   */
  setTarget(position) {
    this.target.copy(position);
    this._targetGoal.copy(position);
    this._transitioning = false;
    this._returningToOrbit = false;
  }

  /**
   * Update the target position for a moving body (called every frame).
   * API-compatible with CameraController.trackTarget().
   *
   * In ORBIT state, this moves the orbit center to follow the body.
   * In other states, it just updates the stored target.
   */
  trackTarget(position) {
    this._targetGoal.copy(position);

    if (this.state === State.ORBIT && this._orbitBodyRef) {
      // Move orbit center to follow the body's motion
      this.target.copy(position);
    } else if (!this._transitioning) {
      this.target.copy(position);
    }
  }

  /**
   * Track free-look anchor (compatibility with CameraController).
   * In the ship camera, free-look is just FREE_FLIGHT state.
   */
  trackFreeLookAnchor(bodyPosition) {
    // In ship camera, body tracking during free flight is handled
    // by trackTarget. This is here for API compatibility.
    if (this.state === State.FREE_FLIGHT || this.state === State.ORBIT) {
      this.target.copy(bodyPosition);
    }
  }

  /**
   * Reverse-compute state from camera's current world position.
   * Used for seamless handoff from FlythroughCamera back to ship control.
   *
   * @param {THREE.Vector3} targetPosition — what the camera should orbit
   */
  restoreFromWorldState(targetPosition) {
    this.bypassed = false;

    // Sync physics from current camera state
    this.physics.syncFromCamera(this.camera);

    // Set up orbit around the target
    this.target.copy(targetPosition);
    this._targetGoal.copy(targetPosition);
    this._transitioning = false;
    this._returningToOrbit = false;

    const offset = this.camera.position.clone().sub(targetPosition);
    const dist = offset.length();

    this.distance = dist;
    this.smoothedDistance = dist;
    this._orbitRadius = dist;
    this._orbitYaw = Math.atan2(offset.x, offset.z);
    this.smoothedYaw = this._orbitYaw;
    this.smoothedPitch = Math.asin(
      Math.max(-1, Math.min(1, offset.y / (dist || 1)))
    );

    this.physics.yaw = this.smoothedYaw;
    this.physics.pitch = this.smoothedPitch;

    this.zoomSpeed = 0;
    this.state = State.ORBIT;
  }

  /**
   * Enter free-look mode (compatibility with CameraController).
   */
  enterFreeLook() {
    this.isFreeLooking = true;
    this._transitionTo(State.FREE_FLIGHT);
  }

  /**
   * Exit free-look mode (compatibility with CameraController).
   */
  exitFreeLook(resumeOrbit = false) {
    this.isFreeLooking = false;
    if (!resumeOrbit && this.onFreeLookEnd) {
      this.onFreeLookEnd();
    }
  }

  /**
   * Enable gyroscope (compatibility stub).
   */
  async enableGyro() {
    this.gyroEnabled = true;
    return true;
  }

  /**
   * Disable gyroscope (compatibility stub).
   */
  disableGyro() {
    this.gyroEnabled = false;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  AUTOPILOT INTERFACE
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Enter autopilot mode — FlythroughCamera takes over.
   * Sets bypassed = true so update() becomes a no-op.
   */
  enterAutopilot() {
    this.state = State.AUTOPILOT;
    this.bypassed = true;
    this.physics.halt();
  }

  /**
   * Exit autopilot — inherit position/velocity from FlythroughCamera.
   * Provides a smooth handoff: the ship camera picks up wherever
   * the flythrough left the camera, with momentum.
   *
   * @param {THREE.Camera} flythroughCamera — the flythrough's camera ref
   *   (usually the same camera object, just need its current state)
   */
  exitAutopilot() {
    this.bypassed = false;
    this.physics.syncFromCamera(this.camera);
    // Carry some forward momentum from the flythrough for continuity
    const fwd = new THREE.Vector3();
    this.camera.getWorldDirection(fwd);
    this.physics.velocity.copy(fwd.multiplyScalar(2)); // gentle drift
    this.state = State.FREE_FLIGHT;
  }

  /**
   * Enter warp state — locks camera, blocks input.
   */
  enterWarp() {
    this.state = State.WARP;
    this.physics.halt();
  }

  /**
   * Exit warp state — resume in the given state.
   *
   * @param {string} [resumeState='FREE_FLIGHT']
   */
  exitWarp(resumeState = State.FREE_FLIGHT) {
    this.physics.syncFromCamera(this.camera);
    this.state = resumeState;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  STATE UPDATES (private)
  // ═══════════════════════════════════════════════════════════════════

  /**
   * IDLE — camera drifts slowly with auto-rotation.
   * Any player input transitions to FREE_FLIGHT.
   * After _idleTimeout seconds, triggers autopilot.
   */
  _updateIdle(dt) {
    // Apply gentle auto-rotation as rotational velocity
    this.physics.yawVelocity = this._idleAutoYawSpeed;
    this.physics.pitchVelocity = 0;

    // Physics step (drift + drag)
    this.physics.update(dt);
    this.physics.applyToCamera(this.camera);

    // Track idle time for autopilot trigger
    this._idleTimer += dt;
    if (this._idleTimer >= this._idleTimeout && this.onIdleTimeout) {
      this.onIdleTimeout();
    }
  }

  /**
   * FREE_FLIGHT — player-controlled movement.
   * Left-drag: rotational impulse (yaw/pitch velocity builds, decays).
   * Scroll: forward/backward thrust along camera facing direction.
   */
  _updateFreeFlight(dt) {
    // Process accumulated scroll impulse as thrust
    if (Math.abs(this._scrollImpulse) > 0.01) {
      const fwd = this.physics.getForward(_v1);
      // Negative scroll = forward thrust (scroll down = zoom in = fly forward)
      this.physics.applyThrust(fwd, -this._scrollImpulse * 5, dt);
      this._scrollImpulse *= 0.85; // decay scroll accumulator
    }

    // Physics step
    this.physics.update(dt);
    this.physics.applyToCamera(this.camera);

    // Check for transition to IDLE: velocity below threshold, no recent input
    const timeSinceInput = performance.now() / 1000 - this._lastInputTime;
    const isStill = this.physics.getSpeed() < 0.1 &&
                    this.physics.getRotationalSpeed() < 0.01;

    if (isStill && timeSinceInput > 5) {
      this._transitionTo(State.IDLE);
    }
  }

  /**
   * APPROACH — auto-fly toward a clicked body.
   * Each frame: thrust toward waypoint, decelerate as we approach.
   * Transition to ORBIT when close enough and slow enough.
   */
  _updateApproach(dt) {
    // Recompute waypoint if we have a body ref (it might be orbiting)
    if (this._approachTarget) {
      _v1.subVectors(this.physics.position, this._approachTarget.position)
        .normalize();
      this._approachWaypoint.copy(this._approachTarget.position)
        .addScaledVector(_v1, this._approachDist);
      this.target.copy(this._approachTarget.position);
    }

    // Vector from camera to waypoint
    _v2.subVectors(this._approachWaypoint, this.physics.position);
    const distToWaypoint = _v2.length();
    _v2.normalize();

    // ── Thrust toward waypoint with deceleration ──
    // Far away: full thrust. Close: gentle thrust to avoid overshooting.
    // The deceleration curve uses sqrt(distance) so it slows gradually.
    const brakingDist = this._approachDist * 2;
    const thrustScale = distToWaypoint > brakingDist
      ? 1.0
      : Math.sqrt(distToWaypoint / brakingDist);

    this.physics.applyThrust(_v2, thrustScale * 2.0, dt);

    // ── Steer camera to face the waypoint ──
    // Compute desired yaw/pitch toward the waypoint
    const desiredYaw = Math.atan2(_v2.x, _v2.z);
    const desiredPitch = Math.asin(Math.max(-1, Math.min(1, _v2.y)));

    // Apply rotational impulse toward desired orientation
    let yawDiff = desiredYaw - this.physics.yaw;
    // Shortest arc
    if (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
    if (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
    const pitchDiff = desiredPitch - this.physics.pitch;

    // Steering strength — stronger when far, gentler when close
    const steerStrength = 3.0;
    this.physics.yawVelocity += yawDiff * steerStrength * dt;
    this.physics.pitchVelocity += pitchDiff * steerStrength * dt;

    // Physics step
    this.physics.update(dt);
    this.physics.applyToCamera(this.camera);

    // ── Transition to ORBIT when close enough and slow enough ──
    const orbitThreshold = this._approachDist * 1.5;
    const speed = this.physics.getSpeed();

    if (distToWaypoint < orbitThreshold && speed < 5) {
      this._orbitRadius = this._approachDist;
      this._orbitBodyRef = this._approachTarget;
      this._orbitYaw = Math.atan2(
        this.physics.position.x - this.target.x,
        this.physics.position.z - this.target.z,
      );
      this._orbitDirection = 1;
      this._orbitYawSpeed = 0.3;
      this._transitionTo(State.ORBIT);
    }
  }

  /**
   * ORBIT — velocity-maintained orbit around a target body.
   *
   * Instead of placing the camera on a sphere (like CameraController),
   * we apply small thrust corrections each frame to maintain a circular
   * orbit. This means:
   * - Left-drag adds rotational impulse (shifts orbit plane)
   * - Scroll adjusts orbit radius (thrust outward/inward)
   * - Orbiting has inertia — it coasts if you stop interacting
   * - Thrusting hard away escapes the orbit → FREE_FLIGHT
   */
  _updateOrbit(dt) {
    // ── Update orbit center from target body's current position ──
    const orbitCenter = this.target;

    // ── Orbit yaw advance ──
    this._orbitYaw += this._orbitYawSpeed * this._orbitDirection * dt;

    // ── Handle scroll zoom — adjust orbit radius ──
    if (Math.abs(this.zoomSpeed) > 0.001) {
      this._orbitRadius *= Math.exp(this.zoomSpeed * dt * 0.3);
      this._orbitRadius = Math.max(this.minDistance, Math.min(this.maxDistance, this._orbitRadius));
      this.zoomSpeed *= Math.pow(this.zoomDamping, dt * 60);
    }

    // ── Compute desired orbit position ──
    const cosPitch = Math.cos(this.physics.pitch);
    _v1.set(
      orbitCenter.x + this._orbitRadius * Math.sin(this._orbitYaw) * cosPitch,
      orbitCenter.y + this._orbitRadius * Math.sin(this.physics.pitch),
      orbitCenter.z + this._orbitRadius * Math.cos(this._orbitYaw) * cosPitch,
    );

    // ── Apply correction thrust toward desired orbit position ──
    // This is what makes the orbit "velocity-maintained" instead of
    // being snapped to a sphere. The camera drifts toward the orbit
    // point each frame, creating the feeling of centripetal force.
    _v2.subVectors(_v1, this.physics.position);
    const orbitError = _v2.length();

    if (orbitError > 0.001) {
      _v2.normalize();
      // Correction strength scales with error — small error = gentle nudge,
      // large error (e.g., just entered orbit) = stronger pull.
      const correctionForce = Math.min(orbitError * 3, 10);
      this.physics.applyThrust(_v2, correctionForce, dt);
    }

    // ── Maintain orbit velocity tangent ──
    // Apply tangential thrust to keep orbiting at the right speed.
    // Without this, drag would slow the orbit to a stop.
    const tangent = _v3.set(
      Math.cos(this._orbitYaw),
      0,
      -Math.sin(this._orbitYaw),
    ).multiplyScalar(this._orbitDirection);

    const desiredSpeed = this._orbitYawSpeed * this._orbitRadius;
    const currentTangentSpeed = this.physics.velocity.dot(tangent);
    const speedError = desiredSpeed - currentTangentSpeed;

    if (Math.abs(speedError) > 0.01) {
      this.physics.applyThrust(tangent, speedError * 2, dt);
    }

    // ── Physics step ──
    this.physics.update(dt);

    // ── Camera look-at: always face the orbit center ──
    this.camera.position.copy(this.physics.position);
    this.camera.lookAt(orbitCenter);

    // Update distance for API compatibility
    this.distance = this.camera.position.distanceTo(orbitCenter);
    this.smoothedDistance = this.distance;

    // ── Escape detection ──
    // If the player thrusts hard enough away, break out of orbit
    const toCenter = _v1.subVectors(orbitCenter, this.physics.position).normalize();
    const awaySpeed = -this.physics.velocity.dot(toCenter); // positive = moving away
    if (awaySpeed > this._escapeThreshold) {
      this._transitionTo(State.FREE_FLIGHT);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  STATE TRANSITIONS (private)
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Transition to a new state. Handles exit/enter logic.
   */
  _transitionTo(newState) {
    const oldState = this.state;

    // ── Exit current state ──
    switch (oldState) {
      case State.ORBIT:
        // Leaving orbit: keep current velocity (coasting away)
        break;
      case State.IDLE:
        this._idleTimer = 0;
        break;
    }

    this.state = newState;

    // ── Enter new state ──
    switch (newState) {
      case State.IDLE:
        this._idleTimer = 0;
        // Don't halt — let existing velocity coast and decay
        break;
      case State.FREE_FLIGHT:
        // Inherit current velocity from whatever state we came from
        break;
      case State.APPROACH:
        // Keep momentum but start steering toward target
        break;
      case State.ORBIT:
        // Orbit corrections will smoothly capture the camera
        this.zoomSpeed = 0;
        break;
    }
  }

  /**
   * Record that the player did something (for idle timeout tracking).
   */
  _recordInput() {
    this._lastInputTime = performance.now() / 1000;
    this._idleTimer = 0;

    // Any input in IDLE → FREE_FLIGHT
    if (this.state === State.IDLE) {
      this._transitionTo(State.FREE_FLIGHT);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  INPUT HANDLING (private)
  // ═══════════════════════════════════════════════════════════════════

  _setupListeners() {
    // ── Mouse: left-click drag for rotation ──
    this.canvas.addEventListener('mousedown', (e) => {
      if (this.state === State.WARP) return;
      if (this.bypassed) return;

      if (e.button === 0) {
        this.isDragging = true;
        this._lastMouseX = e.clientX;
        this._lastMouseY = e.clientY;
        this._recordInput();
        this.autoRotateActive = false;
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this.isDragging = false;
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      if (this.state === State.WARP) return;
      if (this.bypassed) return;

      // Movement delta → rotational impulse
      const dx = e.movementX * this.dragSensitivity;
      const dy = e.movementY * this.dragSensitivity;

      // Apply as rotational impulse (builds up velocity, decays with drag).
      // In FREE_FLIGHT: steers the ship.
      // In ORBIT: shifts the orbit plane / adjusts viewing angle.
      this.physics.applyRotation(-dx, dy, 1 / 60); // assume ~60fps for impulse scaling

      this._recordInput();
    });

    // ── Scroll wheel: thrust impulse ──
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (this.state === State.WARP) return;
      if (this.bypassed) return;

      this._recordInput();

      if (this.state === State.ORBIT) {
        // In orbit: scroll adjusts orbit radius (zoom in/out)
        this.zoomSpeed += Math.sign(e.deltaY) * this.scrollSensitivity;
      } else {
        // In free flight / idle: scroll applies forward/back thrust
        this._scrollImpulse += Math.sign(e.deltaY) * this.scrollSensitivity;
      }
    }, { passive: false });

    // ── Touch controls ──
    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (this.state === State.WARP) return;
      if (this.bypassed) return;

      this._touchCount = e.touches.length;
      if (e.touches.length === 1) {
        this.isDragging = true;
        this._lastTouchX = e.touches[0].clientX;
        this._lastTouchY = e.touches[0].clientY;
        this._recordInput();
        this.autoRotateActive = false;
      } else if (e.touches.length === 2) {
        this.isDragging = false;
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        this._lastPinchDist = Math.sqrt(dx * dx + dy * dy);
      }
    }, { passive: false });

    this.canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (this.state === State.WARP) return;
      if (this.bypassed) return;

      if (e.touches.length === 1 && this.isDragging) {
        const x = e.touches[0].clientX;
        const y = e.touches[0].clientY;
        const dx = (x - this._lastTouchX) * this.dragSensitivity;
        const dy = (y - this._lastTouchY) * this.dragSensitivity;

        this.physics.applyRotation(-dx, dy, 1 / 60);

        this._lastTouchX = x;
        this._lastTouchY = y;
        this._recordInput();
      } else if (e.touches.length === 2) {
        // Pinch zoom → thrust forward/back or orbit radius
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (this._lastPinchDist > 0) {
          const scale = this._lastPinchDist / dist;
          if (this.state === State.ORBIT) {
            this._orbitRadius *= scale;
            this._orbitRadius = Math.max(this.minDistance, Math.min(this.maxDistance, this._orbitRadius));
          } else {
            const impulse = (scale - 1) * 10;
            this._scrollImpulse += impulse;
          }
        }
        this._lastPinchDist = dist;
        this._recordInput();
      }
    }, { passive: false });

    this.canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      this.isDragging = false;
      this._lastPinchDist = 0;
      this._touchCount = e.touches.length;
    }, { passive: false });

    // Prevent middle-click browser defaults
    this.canvas.addEventListener('auxclick', (e) => {
      if (e.button === 1) e.preventDefault();
    });
  }
}


// ═══════════════════════════════════════════════════════════════════════
//  AutopilotTourOrder — computes the tour visit order for autopilot.
//
//  Order: Star first → closest/most-massive planet → its moons
//  (planet → moon → back to planet → next moon → back to planet)
//  → next planet → repeat → warp out.
//
//  This is a pure function: give it a system, get back an ordered
//  list of tour stops. AutoNavigator.buildQueue() can use this
//  instead of its current inner-to-outer ordering.
// ═══════════════════════════════════════════════════════════════════════

/**
 * Build an autopilot tour order for the given star system.
 *
 * The visit pattern ensures the camera stays near each planet while
 * exploring its moons, reducing long cross-system flights:
 *
 *   1. Star (or stars if binary)
 *   2. For each planet (sorted by mass DESC, distance ASC as tiebreak):
 *      a. Fly to planet
 *      b. For each moon of that planet:
 *         - Fly to moon
 *         - Return to planet (so the next moon trip is short)
 *      c. Move to next planet
 *   3. After all planets: warp out
 *
 * @param {Object} system — the system data object
 * @returns {Array} — ordered array of tour stop descriptors:
 *   { type: 'star'|'planet'|'moon', planetIndex, moonIndex, starIndex }
 */
export function buildAutopilotTourOrder(system) {
  const stops = [];

  // ── 1. Star(s) first ──
  stops.push({ type: 'star', starIndex: 0 });
  if (system.isBinary && system.star2) {
    stops.push({ type: 'star', starIndex: 1 });
  }

  // ── 2. Sort planets by mass (descending), distance as tiebreak ──
  // "Closest/most-massive" — prioritize the big interesting ones,
  // but use orbital distance as tiebreak so nearby planets come first
  // when masses are similar.
  const planetIndices = system.planets.map((_, i) => i);

  planetIndices.sort((a, b) => {
    const pA = system.planets[a].planet.data;
    const pB = system.planets[b].planet.data;

    // Mass (or radius as proxy if mass isn't available)
    const massA = pA.mass ?? pA.radius ?? 1;
    const massB = pB.mass ?? pB.radius ?? 1;

    // Primary sort: mass descending
    if (Math.abs(massB - massA) > 0.01) {
      return massB - massA;
    }

    // Tiebreak: orbital distance ascending (closer first)
    const distA = pA.orbitRadius ?? pA.distance ?? 0;
    const distB = pB.orbitRadius ?? pB.distance ?? 0;
    return distA - distB;
  });

  // ── 3. Visit each planet and its moons ──
  for (const pi of planetIndices) {
    const entry = system.planets[pi];

    // Visit the planet
    stops.push({ type: 'planet', planetIndex: pi });

    // Visit each moon, returning to the planet between each.
    // This keeps travel distances short: planet → moon → planet → next moon.
    if (entry.moons && entry.moons.length > 0) {
      for (let mi = 0; mi < entry.moons.length; mi++) {
        stops.push({ type: 'moon', planetIndex: pi, moonIndex: mi });
        // Return to planet after each moon (except after the last one,
        // since we'll be leaving for the next planet anyway)
        if (mi < entry.moons.length - 1) {
          stops.push({ type: 'planet', planetIndex: pi, _isReturn: true });
        }
      }
    }
  }

  return stops;
}
