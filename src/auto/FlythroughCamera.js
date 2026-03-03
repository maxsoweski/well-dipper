import * as THREE from 'three';

/**
 * FlythroughCamera — cinematic camera that physically flies through space.
 *
 * Three states:
 * - DESCEND: initial entry, camera flies from above the system down to first body
 * - ORBIT:   circle the current body, looking AT it (body fills the screen)
 * - TRAVEL:  gravity-assist slingshot from one body to the next
 *
 * During orbit the camera focuses on the body (fills 1/2-2/3 of FOV).
 * As the orbit nears its end, the orbit radius widens (breaking free of
 * gravity) and the lookAt shifts toward the next destination.
 *
 * Travel uses Hermite spline interpolation for curved slingshot paths.
 * The departure tangent follows the orbit tangent (camera is "flung" from
 * orbit), and the arrival tangent curves into the destination orbit
 * (camera is "captured" by gravity). This creates the asymmetric,
 * gravitational-looking curves of real spaceflight maneuvers.
 *
 * All transitions use smootherstep (quintic) easing for gentle ramp-up/down.
 */

const State = { DESCEND: 0, ORBIT: 1, TRAVEL: 2 };

// Reusable vectors to avoid per-frame allocations
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _v4 = new THREE.Vector3();

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
    this._departureTangent = new THREE.Vector3(); // slingshot release direction
    this._arrivalOrbitDir = null;  // orbit direction from slingshot capture

    // ── DESCEND state ──
    this.descendStart = new THREE.Vector3();
    this.descendElapsed = 0;
    this.descendDuration = 10;

    // ── Free-look offset (middle mouse only) ──
    this.freeLookYaw = 0;
    this.freeLookPitch = 0;
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

    // After slingshot arrival, use capture direction for seamless orbit start
    if (this._arrivalOrbitDir !== null) {
      this.orbitDirection = this._arrivalOrbitDir;
      this._arrivalOrbitDir = null;
    }
  }

  /**
   * Begin travelling from current position to the next body.
   * Computes the slingshot departure tangent from the current orbit state.
   */
  beginTravel(nextBodyRef, nextOrbitDistance, nextBodyRadius) {
    this.state = State.TRAVEL;
    this.nextBodyRef = nextBodyRef;
    this.nextOrbitDistance = nextOrbitDistance;

    this.departurePos.copy(this.camera.position);

    // Store forward direction at departure for smooth lookAt blend
    this.camera.getWorldDirection(this.departureDir);

    // ── Slingshot departure tangent ──
    // The orbit tangent is the direction the camera was moving when it
    // "broke free" of the body's gravity. Derivative of spherical orbit
    // position w.r.t. yaw: (cos(yaw)*cos(pitch), 0, -sin(yaw)*cos(pitch))
    const cosPitch = Math.cos(this.orbitPitch);
    this._departureTangent.set(
      Math.cos(this.orbitYaw) * cosPitch,
      0,
      -Math.sin(this.orbitYaw) * cosPitch,
    ).multiplyScalar(this.orbitDirection).normalize();

    // Ensure the tangent has enough cross-component relative to the
    // departure→destination direction. If it's too aligned (straight shot)
    // or too opposed (U-turn), rotate it to guarantee visible curvature.
    const destPos = nextBodyRef.position;
    const toDestX = destPos.x - this.departurePos.x;
    const toDestZ = destPos.z - this.departurePos.z;
    const toDestLen = Math.sqrt(toDestX * toDestX + toDestZ * toDestZ) || 1;
    const toDestNX = toDestX / toDestLen;
    const toDestNZ = toDestZ / toDestLen;

    // Cross product (2D) = how perpendicular the tangent is to the approach
    const cross = this._departureTangent.x * toDestNZ - this._departureTangent.z * toDestNX;
    // Dot product = how aligned
    const dot = this._departureTangent.x * toDestNX + this._departureTangent.z * toDestNZ;

    if (Math.abs(cross) < 0.3 || dot < -0.3) {
      // Too straight or pointing backward — rotate 40° for slingshot curve
      const rotAngle = (Math.PI / 4.5) * (cross >= 0 ? 1 : -1);
      const cosR = Math.cos(rotAngle);
      const sinR = Math.sin(rotAngle);
      const rx = this._departureTangent.x * cosR - this._departureTangent.z * sinR;
      const rz = this._departureTangent.x * sinR + this._departureTangent.z * cosR;
      this._departureTangent.x = rx;
      this._departureTangent.z = rz;
    }

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
   * Smootherstep easing (quintic, C2 continuous).
   * Zero velocity AND zero acceleration at both endpoints —
   * much gentler ramp-up/down than regular smoothstep.
   */
  _ease(t) {
    t = Math.max(0, Math.min(1, t));
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  /**
   * Update camera position and lookAt. Call every frame.
   * Returns { orbitComplete, travelComplete } to signal state changes.
   */
  update(deltaTime) {
    if (!this.active) return { orbitComplete: false, travelComplete: false };

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
    const s = this._ease(t);

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

    // Look at the body we're descending toward
    this._applyFreeLookAndLookAt(bodyPos);

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

    // ── Departure steering (last 5 seconds) ──
    // Position camera roughly perpendicular to the A→B line so that
    // the travel path to the next body is clean (doesn't clip through A).
    const steerDuration = 5;
    const steerStart = this.orbitDuration - steerDuration;
    let steerBlend = 0;
    let nextPos = null;

    if (this.nextBodyRef && this.orbitElapsed > steerStart) {
      nextPos = this.nextBodyRef.position;
      const toNext = Math.atan2(
        nextPos.x - bodyPos.x,
        nextPos.z - bodyPos.z,
      );
      // Camera perpendicular to A→B line — pick the closer side
      const option1 = toNext + Math.PI / 2;
      const option2 = toNext - Math.PI / 2;
      let diff1 = option1 - this.orbitYaw;
      diff1 -= Math.PI * 2 * Math.round(diff1 / (Math.PI * 2));
      let diff2 = option2 - this.orbitYaw;
      diff2 -= Math.PI * 2 * Math.round(diff2 / (Math.PI * 2));
      const targetYaw = Math.abs(diff1) < Math.abs(diff2) ? option1 : option2;

      const steerT = (this.orbitElapsed - steerStart) / steerDuration;
      steerBlend = this._ease(steerT);

      let yawDiff = targetYaw - this.orbitYaw;
      yawDiff -= Math.PI * 2 * Math.round(yawDiff / (Math.PI * 2));
      this.orbitYaw += yawDiff * steerBlend * deltaTime * 4;
    }

    // Advance yaw (reduce orbit speed during steering for smoother look)
    const orbitSpeedFactor = 1 - steerBlend * 0.8;
    this.orbitYaw += this.orbitYawSpeed * this.orbitDirection * deltaTime * orbitSpeedFactor;

    // Oscillate pitch between 5° and 25° (period ~12s)
    const minPitch = 0.087;   // 5°
    const maxPitch = 0.436;   // 25°
    const midPitch = (minPitch + maxPitch) / 2;
    const ampPitch = (maxPitch - minPitch) / 2;
    this.orbitPitch = midPitch + ampPitch * Math.sin(this.orbitElapsed * 0.52 + this.orbitPitchPhase);

    // Subtle distance breathing: ±5% over 8s cycle
    const breathe = 1 + 0.05 * Math.sin(this.orbitElapsed * 0.785 + this.orbitDistPhase);
    let dist = this.orbitDistBase * breathe;

    // ── Slingshot widening (last 2s of steering): orbit radius increases
    // as if the camera is breaking free of the body's gravity ──
    if (steerBlend > 0.6) {
      const unwindT = (steerBlend - 0.6) / 0.4; // 0→1 over last 40% of steering
      dist *= (1 + unwindT * 0.25); // up to 25% wider orbit
    }

    // Compute camera position (spherical orbit around body)
    const cosPitch = Math.cos(this.orbitPitch);
    this.camera.position.set(
      bodyPos.x + dist * Math.sin(this.orbitYaw) * cosPitch,
      bodyPos.y + dist * Math.sin(this.orbitPitch),
      bodyPos.z + dist * Math.cos(this.orbitYaw) * cosPitch,
    );

    // ── LookAt: focus on the body (it fills the screen) ──
    // Last 3 seconds: gently shift lookAt toward next body so the current
    // body slides to one side, hinting at the upcoming travel direction.
    const shiftDuration = 3;
    const shiftStart = this.orbitDuration - shiftDuration;

    if (nextPos && this.orbitElapsed > shiftStart) {
      const shiftT = (this.orbitElapsed - shiftStart) / shiftDuration;
      const shiftBlend = this._ease(shiftT);
      // Direction from body to next body
      _v3.copy(nextPos).sub(bodyPos).normalize();
      // Shift lookAt: body slides off-center (angular shift ~15° at peak)
      _v2.copy(bodyPos).addScaledVector(_v3, this.orbitDistBase * shiftBlend * 0.3);
      this._applyFreeLookAndLookAt(_v2);
    } else {
      this._applyFreeLookAndLookAt(bodyPos);
    }

    const orbitComplete = this.orbitElapsed >= this.orbitDuration;
    return { orbitComplete, travelComplete: false };
  }

  /**
   * Cubic Hermite spline interpolation.
   * Creates curved paths defined by positions and tangent directions at
   * both endpoints — used for gravity-assist slingshot trajectories.
   *
   * H(t) = h00·P0 + h10·T0 + h01·P1 + h11·T1
   * where h00 = 2t³-3t²+1, h10 = t³-2t²+t, h01 = -2t³+3t², h11 = t³-t²
   */
  _hermite(out, P0, T0, P1, T1, t) {
    const t2 = t * t;
    const t3 = t2 * t;
    const h00 = 2 * t3 - 3 * t2 + 1;  // start position weight
    const h10 = t3 - 2 * t2 + t;       // start tangent weight
    const h01 = -2 * t3 + 3 * t2;      // end position weight
    const h11 = t3 - t2;               // end tangent weight

    out.set(
      h00 * P0.x + h10 * T0.x + h01 * P1.x + h11 * T1.x,
      h00 * P0.y + h10 * T0.y + h01 * P1.y + h11 * T1.y,
      h00 * P0.z + h10 * T0.z + h01 * P1.z + h11 * T1.z,
    );
    return out;
  }

  _updateTravel(deltaTime) {
    this.travelElapsed += deltaTime;
    const t = Math.min(1, this.travelElapsed / this.travelDuration);
    const s = this._ease(t);

    // ── Destination: orbit entry point around next body ──
    // Recomputed each frame because the body is orbiting its parent.
    // This makes the slingshot curve adapt to the moving target —
    // like a real spacecraft adjusting trajectory to intercept.
    const nextPos = this._travelToBody.position;
    const approachDir = Math.atan2(
      nextPos.x - this.departurePos.x,
      nextPos.z - this.departurePos.z,
    );
    // Enter from the side (90° offset from approach) for orbit-ready arrival
    const entryYaw = approachDir + Math.PI / 2;
    const entryPitch = 0.15;
    const cosPitch = Math.cos(entryPitch);

    // Arrival point (orbit entry position around destination)
    _v1.set(
      nextPos.x + this._travelToOrbitDist * Math.sin(entryYaw) * cosPitch,
      nextPos.y + this._travelToOrbitDist * Math.sin(entryPitch),
      nextPos.z + this._travelToOrbitDist * Math.cos(entryYaw) * cosPitch,
    );

    // ── Hermite spline tangent vectors ──
    // The tangent magnitude controls how "wide" the curve is.
    // Longer journeys get wider curves — proportional to distance.
    const travelDist = this.departurePos.distanceTo(_v1);
    const tangentScale = travelDist * 0.4;

    // Departure tangent: orbit tangent direction (slingshot release).
    // The camera was flung from its orbit — this tangent defines the
    // initial curve direction, creating the asymmetric slingshot shape.
    _v2.copy(this._departureTangent).multiplyScalar(tangentScale);
    // Slight upward arc at departure
    _v2.y += travelDist * 0.04;

    // Arrival tangent: orbit tangent at entry point (gravitational capture).
    // The camera curves into orbit as if caught by the body's gravity.
    const arrTanX = Math.cos(entryYaw) * cosPitch;
    const arrTanZ = -Math.sin(entryYaw) * cosPitch;

    // Pick capture direction: orbit direction where the tangent aligns
    // with the approach direction (camera arrives "with" the orbit flow,
    // not against it — like a real gravitational capture).
    const appX = Math.sin(approachDir);
    const appZ = Math.cos(approachDir);
    const dotArr = arrTanX * appX + arrTanZ * appZ;
    const captureDir = dotArr > 0 ? 1 : -1;

    _v3.set(
      arrTanX * captureDir * tangentScale,
      -travelDist * 0.03, // slight downward into orbital plane
      arrTanZ * captureDir * tangentScale,
    );

    // ── Evaluate slingshot curve ──
    this._hermite(this.camera.position, this.departurePos, _v2, _v1, _v3, s);

    // ── LookAt ──
    // First 20%: turn from departure view toward destination (watching
    // the old body shrink behind us as we're flung away).
    // Remaining 80%: lock onto destination (being drawn in by gravity).
    if (t < 0.2) {
      const blend = this._ease(t / 0.2);
      _v4.copy(this.camera.position).addScaledVector(this.departureDir, 100);
      this.lookAtTarget.lerpVectors(_v4, nextPos, blend);
      this._applyFreeLookAndLookAt(this.lookAtTarget);
    } else {
      this._applyFreeLookAndLookAt(nextPos);
    }

    if (t >= 1) {
      // Store entry yaw and capture direction for seamless orbit start
      this.orbitYaw = entryYaw;
      this._arrivalOrbitDir = captureDir;
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
   * Add free-look offset (from middle mouse drag during flythrough).
   */
  addFreeLook(dyaw, dpitch) {
    this.freeLookYaw += dyaw;
    this.freeLookPitch += dpitch;
    // Clamp
    this.freeLookYaw = Math.max(-0.8, Math.min(0.8, this.freeLookYaw));
    this.freeLookPitch = Math.max(-0.5, Math.min(0.5, this.freeLookPitch));
  }

  /**
   * Clear free-look offset (when middle mouse released).
   */
  clearFreeLook() {
    this.freeLookYaw = 0;
    this.freeLookPitch = 0;
  }

  stop() {
    this.active = false;
  }
}
