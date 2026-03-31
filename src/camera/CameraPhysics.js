import * as THREE from 'three';

/**
 * CameraPhysics — standalone velocity-based physics module.
 *
 * Manages position, velocity, and rotational state for a camera that
 * behaves like "a ship with mass." All movement is impulse-driven:
 * thrust adds to velocity, drag decays it. No instant teleportation.
 *
 * Drag model: exponential decay — velocity *= (1 - drag * dt).
 * This means the camera coasts when you stop thrusting, gradually
 * losing speed. Higher drag = snappier stops. Lower = more floaty.
 *
 * Usage:
 *   const physics = new CameraPhysics();
 *   // Each frame:
 *   physics.applyThrust(direction, force, dt);
 *   physics.applyRotation(yawDelta, pitchDelta, dt);
 *   physics.update(dt);
 *   camera.position.copy(physics.position);
 */
export class CameraPhysics {
  constructor(options = {}) {
    // ── Linear motion ──
    this.position = new THREE.Vector3();
    this.velocity = new THREE.Vector3();

    // ── Rotational state ──
    // Yaw = rotation around world Y axis (left/right)
    // Pitch = rotation around local X axis (up/down)
    this.yaw = 0;
    this.pitch = 0;
    this.yawVelocity = 0;
    this.pitchVelocity = 0;

    // ── Tunable parameters ──

    // How much force a thrust impulse applies (units/s^2 equivalent).
    // Higher = more responsive. This gets multiplied by the force arg
    // in applyThrust, so it acts as a global sensitivity multiplier.
    this.thrustForce = options.thrustForce ?? 40;

    // Linear drag coefficient. Each frame: velocity *= (1 - drag * dt).
    // At 0.5 with 60fps, velocity halves in ~1.4 seconds.
    // At 2.0, velocity halves in ~0.35 seconds (snappy stops).
    this.dragCoefficient = options.dragCoefficient ?? 1.5;

    // Rotational drag — same model as linear drag but for yaw/pitch velocity.
    // Higher = camera stops turning sooner after you release the mouse.
    this.rotationalDrag = options.rotationalDrag ?? 4.0;

    // Speed caps to prevent runaway acceleration.
    this.maxSpeed = options.maxSpeed ?? 200;
    this.maxRotationalSpeed = options.maxRotationalSpeed ?? 3.0; // rad/s

    // Pitch limits (radians) — prevent flipping upside down.
    this.minPitch = options.minPitch ?? -Math.PI * 0.45; // ~81 degrees down
    this.maxPitch = options.maxPitch ?? Math.PI * 0.45;  // ~81 degrees up

    // ── Internal scratch vectors (avoid per-frame allocations) ──
    this._thrustVec = new THREE.Vector3();
  }

  /**
   * Apply a thrust impulse in a given direction.
   *
   * @param {THREE.Vector3} direction — unit vector for thrust direction
   *   (e.g., camera.getWorldDirection() for forward thrust)
   * @param {number} force — scalar multiplier (1.0 = normal thrust)
   * @param {number} deltaTime — frame time in seconds
   */
  applyThrust(direction, force, deltaTime) {
    this._thrustVec.copy(direction).normalize();
    this._thrustVec.multiplyScalar(this.thrustForce * force * deltaTime);
    this.velocity.add(this._thrustVec);
  }

  /**
   * Apply a rotational impulse (adds to yaw/pitch velocity).
   *
   * This is NOT direct angle manipulation — it adds angular velocity
   * that persists and decays over time. Feels like steering a ship:
   * small inputs build up momentum, releasing lets it coast and slow.
   *
   * @param {number} yawDelta — yaw impulse (radians, positive = turn right)
   * @param {number} pitchDelta — pitch impulse (radians, positive = look up)
   * @param {number} deltaTime — frame time in seconds
   */
  applyRotation(yawDelta, pitchDelta, deltaTime) {
    this.yawVelocity += yawDelta / deltaTime;
    this.pitchVelocity += pitchDelta / deltaTime;
  }

  /**
   * Set yaw/pitch velocity directly (for auto-rotation, orbit corrections, etc.).
   *
   * @param {number} yawVel — yaw angular velocity (rad/s)
   * @param {number} pitchVel — pitch angular velocity (rad/s)
   */
  setRotationalVelocity(yawVel, pitchVel) {
    this.yawVelocity = yawVel;
    this.pitchVelocity = pitchVel;
  }

  /**
   * Integrate physics one step. Call once per frame.
   *
   * 1. Apply drag to velocity (exponential decay)
   * 2. Clamp speed to maxSpeed
   * 3. Integrate position += velocity * dt
   * 4. Same for rotational state
   * 5. Clamp pitch to prevent gimbal flip
   *
   * @param {number} deltaTime — frame time in seconds
   */
  update(deltaTime) {
    // ── Linear drag and integration ──
    // Exponential decay: multiplying by (1 - drag * dt) each frame.
    // For small dt this approximates e^(-drag * dt), which gives
    // smooth frame-rate-independent decay.
    const linearDamp = Math.max(0, 1 - this.dragCoefficient * deltaTime);
    this.velocity.multiplyScalar(linearDamp);

    // Clamp speed
    const speed = this.velocity.length();
    if (speed > this.maxSpeed) {
      this.velocity.multiplyScalar(this.maxSpeed / speed);
    }

    // Integrate position
    this.position.addScaledVector(this.velocity, deltaTime);

    // ── Rotational drag and integration ──
    const rotDamp = Math.max(0, 1 - this.rotationalDrag * deltaTime);
    this.yawVelocity *= rotDamp;
    this.pitchVelocity *= rotDamp;

    // Clamp rotational speed
    this.yawVelocity = Math.max(
      -this.maxRotationalSpeed,
      Math.min(this.maxRotationalSpeed, this.yawVelocity)
    );
    this.pitchVelocity = Math.max(
      -this.maxRotationalSpeed,
      Math.min(this.maxRotationalSpeed, this.pitchVelocity)
    );

    // Integrate rotation
    this.yaw += this.yawVelocity * deltaTime;
    this.pitch += this.pitchVelocity * deltaTime;

    // Clamp pitch to prevent flip
    this.pitch = Math.max(this.minPitch, Math.min(this.maxPitch, this.pitch));

    // Normalize yaw to [-PI, PI] to prevent floating point drift
    if (this.yaw > Math.PI) this.yaw -= Math.PI * 2;
    if (this.yaw < -Math.PI) this.yaw += Math.PI * 2;
  }

  /**
   * Get the current speed (magnitude of velocity vector).
   * @returns {number}
   */
  getSpeed() {
    return this.velocity.length();
  }

  /**
   * Get the current rotational speed (combined yaw + pitch).
   * @returns {number}
   */
  getRotationalSpeed() {
    return Math.sqrt(
      this.yawVelocity * this.yawVelocity +
      this.pitchVelocity * this.pitchVelocity
    );
  }

  /**
   * Zero out all velocities (linear + rotational). Used for hard stops
   * like entering warp or resetting state.
   */
  halt() {
    this.velocity.set(0, 0, 0);
    this.yawVelocity = 0;
    this.pitchVelocity = 0;
  }

  /**
   * Copy full state from another CameraPhysics instance.
   * Used for seamless handoffs between camera modes.
   */
  copyFrom(other) {
    this.position.copy(other.position);
    this.velocity.copy(other.velocity);
    this.yaw = other.yaw;
    this.pitch = other.pitch;
    this.yawVelocity = other.yawVelocity;
    this.pitchVelocity = other.pitchVelocity;
  }

  /**
   * Set position and orientation from a Three.js camera.
   * Derives yaw/pitch from the camera's forward direction.
   * Velocity is zeroed — call setVelocity() separately if needed.
   *
   * @param {THREE.Camera} camera
   */
  syncFromCamera(camera) {
    this.position.copy(camera.position);

    // Extract yaw/pitch from camera's forward direction
    const fwd = new THREE.Vector3();
    camera.getWorldDirection(fwd);
    // fwd points where the camera looks. Yaw = rotation around Y,
    // pitch = elevation angle.
    this.pitch = Math.asin(Math.max(-1, Math.min(1, fwd.y)));
    const cosPitch = Math.cos(this.pitch);
    if (Math.abs(cosPitch) > 0.001) {
      this.yaw = Math.atan2(fwd.x, fwd.z);
    }

    this.velocity.set(0, 0, 0);
    this.yawVelocity = 0;
    this.pitchVelocity = 0;
  }

  /**
   * Apply the physics state to a Three.js camera.
   * Sets position and computes lookAt from yaw/pitch.
   *
   * @param {THREE.Camera} camera
   */
  applyToCamera(camera) {
    camera.position.copy(this.position);

    // Compute look-at point from yaw/pitch
    const cosPitch = Math.cos(this.pitch);
    const lookX = this.position.x + Math.sin(this.yaw) * cosPitch;
    const lookY = this.position.y + Math.sin(this.pitch);
    const lookZ = this.position.z + Math.cos(this.yaw) * cosPitch;
    camera.lookAt(lookX, lookY, lookZ);
  }

  /**
   * Get the forward direction vector (unit) based on current yaw/pitch.
   * @param {THREE.Vector3} [out] — optional output vector
   * @returns {THREE.Vector3}
   */
  getForward(out) {
    const v = out || new THREE.Vector3();
    const cosPitch = Math.cos(this.pitch);
    v.set(
      Math.sin(this.yaw) * cosPitch,
      Math.sin(this.pitch),
      Math.cos(this.yaw) * cosPitch,
    );
    return v;
  }

  /**
   * Get the right direction vector (unit) based on current yaw.
   * @param {THREE.Vector3} [out] — optional output vector
   * @returns {THREE.Vector3}
   */
  getRight(out) {
    const v = out || new THREE.Vector3();
    v.set(
      Math.cos(this.yaw),
      0,
      -Math.sin(this.yaw),
    );
    return v;
  }
}
