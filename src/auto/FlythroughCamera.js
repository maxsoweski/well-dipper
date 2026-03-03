import * as THREE from 'three';

/**
 * FlythroughCamera — cinematic camera that physically flies through space.
 *
 * Three states:
 * - DESCEND: initial entry, camera flies from above the system down to first body
 * - ORBIT:   circle the current body with varying speed and pitch
 * - TRAVEL:  smooth flight from one body to the next (smoothstep easing)
 *
 * Drives camera.position and camera.lookAt() directly each frame.
 * CameraController must be in bypass mode while this is active.
 */

const State = { DESCEND: 0, ORBIT: 1, TRAVEL: 2 };

// Reusable vectors to avoid per-frame allocations
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();

export class FlythroughCamera {
  constructor(camera) {
    this.camera = camera;
    this.active = false;
    this.state = State.ORBIT;

    // ── Current body ──
    this.bodyRef = null;       // Three.js mesh — position auto-updates
    this.bodyRadius = 1;
    this.orbitDistance = 10;

    // ── Next body (for departure steering and travel) ──
    this.nextBodyRef = null;
    this.nextOrbitDistance = 10;

    // ── ORBIT state ──
    this.orbitYaw = 0;
    this.orbitPitch = 0.2;        // radians
    this.orbitDirection = 1;       // 1 = CW, -1 = CCW
    this.orbitYawSpeed = 0.3;      // rad/s
    this.orbitPitchPhase = 0;      // random phase for pitch oscillation
    this.orbitDistBase = 10;       // base orbit distance (before breathing)
    this.orbitDistPhase = 0;       // phase for distance breathing
    this.orbitElapsed = 0;
    this.orbitDuration = 15;       // seconds to orbit before tour advances

    // ── TRAVEL state ──
    this.travelElapsed = 0;
    this.travelDuration = 10;
    this.departurePos = new THREE.Vector3();
    this.departureDir = new THREE.Vector3();  // camera forward at departure
    this.lookAtTarget = new THREE.Vector3();  // interpolated lookAt point

    // ── DESCEND state ──
    this.descendStart = new THREE.Vector3();
    this.descendElapsed = 0;
    this.descendDuration = 10;

    // ── Free-look offset (applied on top of computed position) ──
    this.freeLookYaw = 0;
    this.freeLookPitch = 0;
    this.freeLookDecay = 0.95;  // per-second decay factor
  }

  /**
   * Begin descending from above the system toward the first body.
   */
  beginDescend(bodyRef, orbitDistance, bodyRadius, outerOrbitRadius) {
    this.active = true;
    this.state = State.DESCEND;
    this.bodyRef = bodyRef;
    this.bodyRadius = bodyRadius;
    this.orbitDistance = orbitDistance;

    // Start position: above and slightly offset from the system center
    const height = outerOrbitRadius * 0.3;
    const offset = outerOrbitRadius * 0.15;
    this.descendStart.set(offset, height, offset);

    this.descendElapsed = 0;
    this.descendDuration = 10;

    this._randomizeOrbit();
  }

  /**
   * Begin orbiting the current body.
   */
  beginOrbit(bodyRef, orbitDistance, bodyRadius, duration) {
    this.state = State.ORBIT;
    this.bodyRef = bodyRef;
    this.bodyRadius = bodyRadius;
    this.orbitDistance = orbitDistance;
    this.orbitDistBase = orbitDistance;
    this.orbitElapsed = 0;
    this.orbitDuration = duration || 15;

    // Compute starting yaw from current camera position relative to body
    const bodyPos = bodyRef.position;
    const dx = this.camera.position.x - bodyPos.x;
    const dz = this.camera.position.z - bodyPos.z;
    this.orbitYaw = Math.atan2(dx, dz);

    this._randomizeOrbit();
  }

  /**
   * Begin travelling from current position to the next body.
   */
  beginTravel(nextBodyRef, nextOrbitDistance, nextBodyRadius) {
    this.state = State.TRAVEL;
    this.nextBodyRef = nextBodyRef;
    this.nextOrbitDistance = nextOrbitDistance;

    this.departurePos.copy(this.camera.position);

    // Store forward direction at departure for lookAt transition
    this.camera.getWorldDirection(this.departureDir);

    this.travelElapsed = 0;
    this.travelDuration = 10;

    // Pre-store current body for lookAt transition
    this._travelFromBody = this.bodyRef;
    this._travelToBody = nextBodyRef;
    this._travelToRadius = nextBodyRadius;
    this._travelToOrbitDist = nextOrbitDistance;
  }

  /**
   * Randomize orbit motion parameters for variety.
   */
  _randomizeOrbit() {
    this.orbitDirection = Math.random() < 0.5 ? 1 : -1;
    this.orbitYawSpeed = 0.25 + Math.random() * 0.15; // 0.25-0.4 rad/s
    this.orbitPitchPhase = Math.random() * Math.PI * 2;
    this.orbitDistPhase = Math.random() * Math.PI * 2;

    // Pitch starting value
    this.orbitPitch = 0.09 + Math.random() * 0.17; // 5°-15°
  }

  /**
   * Smoothstep easing: smooth acceleration and deceleration.
   * t: 0→1, returns 0→1 with ease-in-out
   */
  _smoothstep(t) {
    t = Math.max(0, Math.min(1, t));
    return t * t * (3 - 2 * t);
  }

  /**
   * Update camera position and lookAt. Call every frame.
   * Returns an object { orbitComplete, travelComplete } to signal state changes.
   */
  update(deltaTime) {
    if (!this.active) return { orbitComplete: false, travelComplete: false };

    // Decay free-look offset
    const decay = Math.pow(this.freeLookDecay, deltaTime);
    this.freeLookYaw *= decay;
    this.freeLookPitch *= decay;

    switch (this.state) {
      case State.DESCEND:
        return this._updateDescend(deltaTime);
      case State.ORBIT:
        return this._updateOrbit(deltaTime);
      case State.TRAVEL:
        return this._updateTravel(deltaTime);
    }
    return { orbitComplete: false, travelComplete: false };
  }

  _updateDescend(deltaTime) {
    this.descendElapsed += deltaTime;
    const t = Math.min(1, this.descendElapsed / this.descendDuration);
    const s = this._smoothstep(t);

    // End position: orbit entry point around first body
    const bodyPos = this.bodyRef.position;
    const entryYaw = this.orbitYaw;
    const entryPitch = this.orbitPitch;
    const cosPitch = Math.cos(entryPitch);

    _v1.set(
      bodyPos.x + this.orbitDistance * Math.sin(entryYaw) * cosPitch,
      bodyPos.y + this.orbitDistance * Math.sin(entryPitch),
      bodyPos.z + this.orbitDistance * Math.cos(entryYaw) * cosPitch,
    );

    // Interpolate position
    this.camera.position.lerpVectors(this.descendStart, _v1, s);

    // Arc: add height during middle of descent
    this.camera.position.y += this.descendStart.y * 0.3 * Math.sin(t * Math.PI);

    // LookAt: blend from system center toward the body
    _v2.set(0, 0, 0);
    _v3.copy(bodyPos);
    _v2.lerp(_v3, Math.min(1, s * 1.5)); // look at body earlier than arrival
    this._applyFreeLookAndLookAt(_v2);

    if (t >= 1) {
      // Transition to orbit
      this.beginOrbit(this.bodyRef, this.orbitDistance, this.bodyRadius, this.orbitDuration);
      return { orbitComplete: false, travelComplete: false };
    }

    return { orbitComplete: false, travelComplete: false };
  }

  _updateOrbit(deltaTime) {
    this.orbitElapsed += deltaTime;

    const bodyPos = this.bodyRef.position;

    // Advance yaw
    this.orbitYaw += this.orbitYawSpeed * this.orbitDirection * deltaTime;

    // Oscillate pitch between 5° and 25° (period ~12s)
    const minPitch = 0.087;   // 5°
    const maxPitch = 0.436;   // 25°
    const midPitch = (minPitch + maxPitch) / 2;
    const ampPitch = (maxPitch - minPitch) / 2;
    this.orbitPitch = midPitch + ampPitch * Math.sin(this.orbitElapsed * 0.52 + this.orbitPitchPhase);

    // Subtle distance breathing: ±5% over 8s cycle
    const breathe = 1 + 0.05 * Math.sin(this.orbitElapsed * 0.785 + this.orbitDistPhase);
    const dist = this.orbitDistBase * breathe;

    // Departure steering: last 3 seconds, steer yaw toward next body
    let steering = false;
    if (this.nextBodyRef && this.orbitElapsed > this.orbitDuration - 3) {
      steering = true;
      const nextPos = this.nextBodyRef.position;
      // Angle from current body to next body
      const toNext = Math.atan2(
        nextPos.x - bodyPos.x,
        nextPos.z - bodyPos.z,
      );
      // We want the next body on our horizon — camera looks at current body,
      // so "horizon" is roughly 90° from the camera-to-body direction.
      // Steer yaw so that toNext is about π/2 from our current yaw
      const targetYaw = toNext + (Math.PI / 2) * this.orbitDirection;

      // Blend toward target yaw over the 3 seconds
      const steerT = (this.orbitElapsed - (this.orbitDuration - 3)) / 3;
      const steerFactor = this._smoothstep(steerT) * 0.3; // gentle pull

      let yawDiff = targetYaw - this.orbitYaw;
      yawDiff = yawDiff - Math.PI * 2 * Math.round(yawDiff / (Math.PI * 2));
      this.orbitYaw += yawDiff * steerFactor * deltaTime * 2;
    }

    // Compute camera position
    const cosPitch = Math.cos(this.orbitPitch);
    this.camera.position.set(
      bodyPos.x + dist * Math.sin(this.orbitYaw) * cosPitch,
      bodyPos.y + dist * Math.sin(this.orbitPitch),
      bodyPos.z + dist * Math.cos(this.orbitYaw) * cosPitch,
    );

    this._applyFreeLookAndLookAt(bodyPos);

    const orbitComplete = this.orbitElapsed >= this.orbitDuration;
    return { orbitComplete, travelComplete: false };
  }

  _updateTravel(deltaTime) {
    this.travelElapsed += deltaTime;
    const t = Math.min(1, this.travelElapsed / this.travelDuration);
    const s = this._smoothstep(t);

    // End position: orbit entry point around next body (recomputed each frame
    // because the body is orbiting its star)
    const nextPos = this._travelToBody.position;
    // Pick an entry yaw from the approach direction
    const approachDir = Math.atan2(
      nextPos.x - this.departurePos.x,
      nextPos.z - this.departurePos.z,
    );
    // Offset 90° so we enter from the side (orbit path)
    const entryYaw = approachDir + Math.PI / 2;
    const entryPitch = 0.15;
    const cosPitch = Math.cos(entryPitch);

    _v1.set(
      nextPos.x + this._travelToOrbitDist * Math.sin(entryYaw) * cosPitch,
      nextPos.y + this._travelToOrbitDist * Math.sin(entryPitch),
      nextPos.z + this._travelToOrbitDist * Math.cos(entryYaw) * cosPitch,
    );

    // Interpolate position from departure to entry point
    this.camera.position.lerpVectors(this.departurePos, _v1, s);

    // Gentle arc above the orbital plane — 5% of travel distance
    const travelDist = this.departurePos.distanceTo(_v1);
    this.camera.position.y += travelDist * 0.05 * Math.sin(t * Math.PI);

    // LookAt transition:
    // First 20%: look back at old body
    // 20%-50%: smooth turn toward new body
    // 50%+: locked on new body
    if (this._travelFromBody) {
      const fromPos = this._travelFromBody.position;
      if (t < 0.2) {
        this._applyFreeLookAndLookAt(fromPos);
      } else if (t < 0.5) {
        const blend = (t - 0.2) / 0.3; // 0→1 over the transition
        this.lookAtTarget.lerpVectors(fromPos, nextPos, this._smoothstep(blend));
        this._applyFreeLookAndLookAt(this.lookAtTarget);
      } else {
        this._applyFreeLookAndLookAt(nextPos);
      }
    } else {
      this._applyFreeLookAndLookAt(nextPos);
    }

    if (t >= 1) {
      // Store entry yaw for orbit start
      this.orbitYaw = entryYaw;
      return { orbitComplete: false, travelComplete: true };
    }

    return { orbitComplete: false, travelComplete: false };
  }

  /**
   * Apply free-look offset and call camera.lookAt with the given target.
   */
  _applyFreeLookAndLookAt(target) {
    if (Math.abs(this.freeLookYaw) > 0.001 || Math.abs(this.freeLookPitch) > 0.001) {
      // Rotate the lookAt direction by the free-look offset
      _v1.copy(target).sub(this.camera.position).normalize();

      // Apply yaw rotation around world Y
      const cosY = Math.cos(this.freeLookYaw);
      const sinY = Math.sin(this.freeLookYaw);
      const rx = _v1.x * cosY - _v1.z * sinY;
      const rz = _v1.x * sinY + _v1.z * cosY;
      _v1.x = rx;
      _v1.z = rz;

      // Apply pitch rotation
      _v1.y += this.freeLookPitch;
      _v1.normalize();

      _v2.copy(this.camera.position).add(_v1);
      this.camera.lookAt(_v2);
    } else {
      this.camera.lookAt(target);
    }
  }

  /**
   * Add free-look offset (from mouse movement during flythrough).
   */
  addFreeLook(dyaw, dpitch) {
    this.freeLookYaw += dyaw;
    this.freeLookPitch += dpitch;
    // Clamp
    this.freeLookYaw = Math.max(-0.5, Math.min(0.5, this.freeLookYaw));
    this.freeLookPitch = Math.max(-0.3, Math.min(0.3, this.freeLookPitch));
  }

  stop() {
    this.active = false;
  }
}
