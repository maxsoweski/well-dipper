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
 * It does 1 full revolution for survey, then continues just far enough
 * to align the departure tangent with the transit path to the next body
 * (total: 1.0-2.0 revolutions at constant speed).
 *
 * Travel uses curved Hermite spline paths — elliptical transfer orbits
 * tangent to both departure and arrival orbits, like Hohmann transfers.
 * The Hermite's initial velocity (v₀) is matched to the orbit's exit
 * speed, so the camera peels off tangentially with no speed change.
 * At arrival, the curved path blends into a pre-orbit position
 * (gravitational capture). The camera smoothly pans from watching the
 * departing body recede → gazing forward → watching the destination grow.
 *
 * All transitions use smootherstep (quintic) easing for gentle ramp-up/down.
 */

const State = { DESCEND: 0, ORBIT: 1, TRAVEL: 2 };

// Reusable vectors to avoid per-frame allocations
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _v4 = new THREE.Vector3();
const _v5 = new THREE.Vector3();
const _v6 = new THREE.Vector3();

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
    this._entryPitch = 0.15;       // camera pitch at orbit entry (for smooth blend)
    this._entryDist = 10;          // camera distance at orbit entry (for smooth blend)

    // ── TRAVEL state ──
    this.travelElapsed = 0;
    this.travelDuration = 10;
    this.departurePos = new THREE.Vector3();
    this.departureDir = new THREE.Vector3();  // camera forward at departure
    this.lookAtTarget = new THREE.Vector3();  // interpolated lookAt point
    this._departureTangent = new THREE.Vector3(); // slingshot release direction
    this._departTangentScaled = new THREE.Vector3(); // Hermite tangent (scaled by distance)
    this._arrivalTangentScaled = new THREE.Vector3(); // Hermite arrival tangent (scaled)
    this._hermiteStartPos = new THREE.Vector3();      // Hermite curve start position (= departurePos)
    this._orbitStartYaw = 0;                          // yaw at orbit start (for revolution counting)
    this._travelV0 = 0.2;                             // dynamic initial velocity for Hermite easing
    this._arrivalOrbitDir = null;  // orbit direction from slingshot capture

    // Arrival blend state (Hermite → pre-orbit)
    this._arrivalComputed = false;
    this._arrivalYaw = 0;
    this._arrivalDist = 10;
    this._arrivalPitch = 0.15;
    this._arrivalCaptureDir = 1;
    this._arrivalYawSpeed = 0.3;

    // Current orbit frame state (saved each frame for departure snapshot)
    this._currentDist = 10;
    this._currentSpeedFactor = 1;

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
   *
   * The orbit does 1 full revolution for survey, then continues just far
   * enough to align the camera's tangent direction with the transit path
   * to the next body. Total orbit: 1.0-2.0 revolutions at constant speed.
   * This means the camera naturally peels off toward the next destination
   * when the orbit ends — no direction change at departure.
   */
  beginOrbit(bodyRef, orbitDistance, bodyRadius, duration) {
    this.state = State.ORBIT;
    this.bodyRef = bodyRef;
    this.bodyRadius = bodyRadius;
    this.orbitDistance = orbitDistance;
    this.orbitDistBase = orbitDistance;
    this.orbitElapsed = 0;
    this.orbitDuration = duration || 15;
    this._targetingSignaled = false;

    // Compute ALL starting orbit parameters from camera's actual position.
    // This prevents any snap at the slingshot → orbit transition — the orbit
    // starts exactly where the camera is and smoothly evolves from there.
    const bodyPos = bodyRef.position;
    const dx = this.camera.position.x - bodyPos.x;
    const dy = this.camera.position.y - bodyPos.y;
    const dz = this.camera.position.z - bodyPos.z;
    const actualDist = Math.sqrt(dx * dx + dy * dy + dz * dz) || orbitDistance;

    this.orbitYaw = Math.atan2(dx, dz);
    this._entryPitch = Math.asin(Math.max(-1, Math.min(1, dy / actualDist)));
    this._entryDist = actualDist;
    this.orbitPitch = this._entryPitch;

    this._randomizeOrbit();

    // Phase-align pitch oscillation so it starts from the actual camera pitch
    // (oscillation grows smoothly from entry value, no random jump)
    const midPitch = (0.087 + 0.436) / 2;
    const ampPitch = (0.436 - 0.087) / 2;
    const pitchRatio = Math.max(-1, Math.min(1, (this._entryPitch - midPitch) / ampPitch));
    this.orbitPitchPhase = Math.asin(pitchRatio);

    // ── Departure-aligned orbit ──
    // If we know the next body, compute the yaw angle where our orbit
    // tangent points toward it. The orbit does 1 full revolution (survey)
    // plus whatever extra angle is needed to reach that departure yaw.
    // This means the camera naturally faces the transit direction at the
    // moment it leaves orbit — seamless departure, no direction change.
    //
    // Orbit tangent directions:
    //   CW  (dir= 1): tangent angle = yaw + π/2
    //   CCW (dir=-1): tangent angle = yaw - π/2
    // So for tangent to point at targetAngle:
    //   CW  departure yaw = targetAngle - π/2
    //   CCW departure yaw = targetAngle + π/2

    // After slingshot arrival, use capture direction as the authoritative
    // orbit direction — overriding would cause a visible direction reversal.
    const directionForced = this._arrivalOrbitDir !== null;
    if (directionForced) {
      this.orbitDirection = this._arrivalOrbitDir;
      this._arrivalOrbitDir = null;
    }

    const TWO_PI = 2 * Math.PI;

    if (this.nextBodyRef) {
      const nextPos = this.nextBodyRef.position;
      const targetAngle = Math.atan2(nextPos.x - bodyPos.x, nextPos.z - bodyPos.z);

      // Departure yaw where orbit tangent points toward next body
      const departYawCW = targetAngle - Math.PI / 2;
      const departYawCCW = targetAngle + Math.PI / 2;

      // Extra yaw after 1 revolution to reach departure angle
      let extraCW = ((departYawCW - this.orbitYaw) % TWO_PI + TWO_PI) % TWO_PI;
      let extraCCW = ((this.orbitYaw - departYawCCW) % TWO_PI + TWO_PI) % TWO_PI;

      if (directionForced) {
        // Slingshot set the direction — compute speed for that direction
        const extra = this.orbitDirection === 1 ? extraCW : extraCCW;
        this.orbitYawSpeed = (TWO_PI + extra) / this.orbitDuration;
      } else {
        // Pick direction with fewer total revolutions
        if (extraCW <= extraCCW) {
          this.orbitDirection = 1;
          this.orbitYawSpeed = (TWO_PI + extraCW) / this.orbitDuration;
        } else {
          this.orbitDirection = -1;
          this.orbitYawSpeed = (TWO_PI + extraCCW) / this.orbitDuration;
        }
      }
    } else {
      // No next body known — do exactly 1 revolution
      this.orbitYawSpeed = TWO_PI / this.orbitDuration;
    }

    this._orbitStartYaw = this.orbitYaw;
  }

  /**
   * Begin travelling from current position to the next body.
   * The Hermite transfer curve starts directly from the orbit exit position
   * with velocity-matched v₀ — the camera peels off the orbit tangentially
   * at exactly the speed it was orbiting. No separate escape spiral.
   */
  beginTravel(nextBodyRef, nextOrbitDistance, nextBodyRadius) {
    this.state = State.TRAVEL;
    this.nextBodyRef = nextBodyRef;
    this.nextOrbitDistance = nextOrbitDistance;

    this.departurePos.copy(this.camera.position);

    // Store forward direction at departure for smooth lookAt blend
    this.camera.getWorldDirection(this.departureDir);

    this._arrivalComputed = false;
    this._hermiteStartPos.copy(this.departurePos);
    this.travelElapsed = 0;

    // ── Distance-based travel duration ──
    const dist = this.departurePos.distanceTo(nextBodyRef.position);
    this.travelDuration = Math.max(12, Math.min(25, 18 * Math.sqrt(dist / 500)));

    // ── Departure tangent: orbit velocity direction at current yaw ──
    // The tangent is perpendicular to the radius vector — exactly the
    // direction the camera was moving when we left orbit.
    const cp = Math.cos(this.orbitPitch);
    this._departureTangent.set(
      Math.cos(this.orbitYaw) * cp,
      0,
      -Math.sin(this.orbitYaw) * cp,
    ).multiplyScalar(this.orbitDirection).normalize();

    // ── Short-trip detection (planet → nearby moon) ──
    // Blend orbit tangent toward destination so the curve arcs directly
    // at the moon instead of continuing away in the orbit circle.
    const isShortTrip = dist < this._currentDist * 5;
    if (isShortTrip) {
      _v1.subVectors(nextBodyRef.position, this.departurePos);
      _v1.y = 0;
      _v1.normalize();
      this._departureTangent.lerp(_v1, 0.6).normalize();
    }

    // ── Scale departure tangent for Hermite curve ──
    const tangentMag = dist * 0.6;
    this._departTangentScaled.copy(this._departureTangent).multiplyScalar(tangentMag);
    this._departTangentScaled.y = tangentMag * 0.03;

    // ── Velocity-matched v₀ ──
    // The orbit exits at: orbitLinearSpeed = dist × yawSpeed × speedFactor
    // The Hermite speed at t=0 is: |T₀| × v₀ / travelDuration
    // Solve for v₀ so they match — continuous speed across the transition.
    const orbitLinearSpeed = this._currentDist * this.orbitYawSpeed * this._currentSpeedFactor;
    this._travelV0 = Math.min(2.5, orbitLinearSpeed * this.travelDuration / tangentMag);

    // Pre-store current body for lookAt transition
    this._travelFromBody = this.bodyRef;
    this._travelToBody = nextBodyRef;
    this._travelToRadius = nextBodyRadius;
    this._travelToOrbitDist = nextOrbitDistance;
  }

  /**
   * Begin travelling from an arbitrary camera position (no prior orbit).
   * Used when engaging autopilot from anywhere — the departure tangent
   * comes from the camera's current forward direction instead of orbit state.
   * The departure blend is skipped since there's no orbit spiral to blend from.
   */
  beginTravelFrom(nextBodyRef, nextOrbitDistance, nextBodyRadius) {
    this.active = true;
    this.state = State.TRAVEL;
    this.nextBodyRef = nextBodyRef;
    this.nextOrbitDistance = nextOrbitDistance;

    this.departurePos.copy(this.camera.position);
    this.camera.getWorldDirection(this.departureDir);

    // Departure tangent: camera forward direction (no orbit to derive from)
    this._departureTangent.copy(this.departureDir);
    this._departureTangent.y = 0;
    this._departureTangent.normalize();

    // If camera points away from destination, blend toward it to prevent loops
    _v1.subVectors(nextBodyRef.position, this.departurePos);
    _v1.y = 0;
    _v1.normalize();
    const alignment = this._departureTangent.x * _v1.x + this._departureTangent.z * _v1.z;
    if (alignment < 0.2) {
      this._departureTangent.lerp(_v1, 0.5).normalize();
    }

    // ── Scale departure tangent for Hermite curve ──
    const dist = this.departurePos.distanceTo(nextBodyRef.position);
    const tangentMag = dist * 0.6;
    this._departTangentScaled.copy(this._departureTangent).multiplyScalar(tangentMag);
    this._departTangentScaled.y = tangentMag * 0.03;

    this._arrivalComputed = false;
    this._hermiteStartPos.copy(this.departurePos);
    this._travelV0 = 0.2; // slow start (no orbit speed to match)
    this.travelElapsed = 0;

    // ── Distance-based travel duration ──
    this.travelDuration = Math.max(12, Math.min(25, 18 * Math.sqrt(dist / 500)));

    this._travelFromBody = null;
    this._travelToBody = nextBodyRef;
    this._travelToRadius = nextBodyRadius;
    this._travelToOrbitDist = nextOrbitDistance;
  }

  /**
   * Randomize orbit motion parameters for variety.
   */
  _randomizeOrbit() {
    this.orbitDirection = Math.random() < 0.5 ? 1 : -1;
    this.orbitYawSpeed = 0.35 + Math.random() * 0.15; // 0.35-0.50 rad/s
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
   * Travel easing — velocity-matched departure, cruise, deceleration.
   *
   * Cubic: e(t) = (v₀-2)t³ + (3-2v₀)t² + v₀t
   * v₀ = initial velocity factor, dynamically matched to orbit exit speed.
   *
   * When departing from orbit, v₀ is computed so the Hermite starts at
   * orbit speed (typically 0.4-0.8). The cubic naturally decelerates
   * toward zero at t=1, where the arrival blend takes over.
   * For beginTravelFrom (no prior orbit), v₀ defaults to 0.2 (slow start).
   */
  _travelEase(t) {
    t = Math.max(0, Math.min(1, t));
    const v0 = this._travelV0;
    return (v0 - 2) * t * t * t + (3 - 2 * v0) * t * t + v0 * t;
  }

  /**
   * Update camera position and lookAt. Call every frame.
   * Returns { orbitComplete, travelComplete, targetingReady }.
   * targetingReady fires once, 2s before orbit ends, to trigger
   * the "now targeting" minimap animation.
   */
  update(deltaTime) {
    if (!this.active) return { orbitComplete: false, travelComplete: false, targetingReady: false };

    switch (this.state) {
      case State.DESCEND:
        return this._updateDescend(deltaTime);
      case State.ORBIT:
        return this._updateOrbit(deltaTime);
      case State.TRAVEL:
        return this._updateTravel(deltaTime);
    }
    return { orbitComplete: false, travelComplete: false, targetingReady: false };
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

    // ── Entry blend (first 2s): smooth transition from arrival ──
    const entryDur = 2;
    const entryFactor = this.orbitElapsed < entryDur
      ? this._ease(this.orbitElapsed / entryDur)
      : 1;

    // ── Constant speed orbit ──
    // Slow, relaxed pace — no acceleration. The orbit does ~1-2
    // revolutions (aligned to departure angle) at constant speed.
    this.orbitYaw += this.orbitYawSpeed * this.orbitDirection * deltaTime;

    // Pitch: blend from entry pitch to oscillating orbit pitch
    const minPitch = 0.087;   // 5°
    const maxPitch = 0.436;   // 25°
    const midPitch = (minPitch + maxPitch) / 2;
    const ampPitch = (maxPitch - minPitch) / 2;
    const oscPitch = midPitch + ampPitch * Math.sin(this.orbitElapsed * 0.52 + this.orbitPitchPhase);
    this.orbitPitch = this._entryPitch + (oscPitch - this._entryPitch) * entryFactor;

    // Distance: blend from entry distance to breathing orbit distance
    const breathe = 1 + 0.05 * entryFactor * Math.sin(this.orbitElapsed * 0.785 + this.orbitDistPhase);
    let dist = this._entryDist + (this.orbitDistBase * breathe - this._entryDist) * entryFactor;

    // ── Gentle pull-out near departure ──
    // In the last 25% of the orbit, ease the distance out to 1.25×.
    // This gives a subtle "drifting away" feel before the Hermite takes
    // over — the departure feels like a natural continuation of pulling out.
    const orbitT = this.orbitElapsed / this.orbitDuration;
    if (orbitT > 0.75) {
      const pullT = (orbitT - 0.75) / 0.25; // 0→1 over last 25%
      dist *= 1 + this._ease(pullT) * 0.25;  // up to 1.25× at departure
    }

    // Save frame state for departure velocity matching
    this._currentDist = dist;
    this._currentSpeedFactor = 1; // constant speed

    // Compute camera position (spherical orbit around body)
    const cosPitch = Math.cos(this.orbitPitch);
    this.camera.position.set(
      bodyPos.x + dist * Math.sin(this.orbitYaw) * cosPitch,
      bodyPos.y + dist * Math.sin(this.orbitPitch),
      bodyPos.z + dist * Math.cos(this.orbitYaw) * cosPitch,
    );

    // ── LookAt: always track the current body ──
    // The camera stays focused here throughout the entire orbit.
    // The turn toward the next body happens during the travel phase.
    this._applyFreeLookAndLookAt(bodyPos);

    // "Now targeting" signal — fires once, 4s before orbit ends
    let targetingReady = false;
    if (!this._targetingSignaled && this.orbitElapsed >= this.orbitDuration - 4) {
      this._targetingSignaled = true;
      targetingReady = true;
    }

    const orbitComplete = this.orbitElapsed >= this.orbitDuration;
    return { orbitComplete, travelComplete: false, targetingReady };
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

  /**
   * Compute where the arrival orbit would be if it had already started.
   * Used during the arrival blend so the camera smoothly decelerates
   * into orbit — no dead stop at the transition.
   */
  _computePreOrbitPos(elapsed, bodyPos, out) {
    const yaw = this._arrivalYaw
      + this._arrivalYawSpeed * this._arrivalCaptureDir * elapsed;
    const cp = Math.cos(this._arrivalPitch);
    out.set(
      bodyPos.x + this._arrivalDist * Math.sin(yaw) * cp,
      bodyPos.y + this._arrivalDist * Math.sin(this._arrivalPitch),
      bodyPos.z + this._arrivalDist * Math.cos(yaw) * cp,
    );
  }

  _updateTravel(deltaTime) {
    this.travelElapsed += deltaTime;
    const t = Math.min(1, this.travelElapsed / this.travelDuration);

    // ── Destination: orbit entry point around next body ──
    // Recomputed each frame because the body is orbiting its parent.
    const nextPos = this._travelToBody.position;
    const approachDir = Math.atan2(
      nextPos.x - this.departurePos.x,
      nextPos.z - this.departurePos.z,
    );
    // Enter from the side (90° offset from approach) for orbit-ready arrival.
    // Which side? If we know the next-next body, predict which orbit direction
    // will be best for departing toward it, then arrive at the corresponding edge.
    let entryYaw;
    if (this.nextBodyRef) {
      const nnPos = this.nextBodyRef.position;
      const toNextAngle = Math.atan2(nnPos.x - nextPos.x, nnPos.z - nextPos.z);

      // Estimate orbit yaw travel (mid-range speed × typical linger)
      const estYawTravel = 0.325 * 18; // ~5.85 rad ≈ 0.93 revolutions

      // Departure tangent heading for CW vs CCW
      const tangentCW  = approachDir + estYawTravel;
      const tangentCCW = approachDir - estYawTravel;

      // Pick direction whose departure tangent is closer to next-next body
      const diffCW  = Math.abs(Math.atan2(
        Math.sin(toNextAngle - tangentCW), Math.cos(toNextAngle - tangentCW),
      ));
      const diffCCW = Math.abs(Math.atan2(
        Math.sin(toNextAngle - tangentCCW), Math.cos(toNextAngle - tangentCCW),
      ));

      entryYaw = diffCW <= diffCCW
        ? approachDir - Math.PI / 2   // CW orbit → arrive at right edge
        : approachDir + Math.PI / 2;  // CCW orbit → arrive at left edge
    } else {
      entryYaw = approachDir + Math.PI / 2;
    }
    const entryPitch = 0.15;
    const cosPitch = Math.cos(entryPitch);

    // Arrival point (orbit entry position around destination)
    _v1.set(
      nextPos.x + this._travelToOrbitDist * Math.sin(entryYaw) * cosPitch,
      nextPos.y + this._travelToOrbitDist * Math.sin(entryPitch),
      nextPos.z + this._travelToOrbitDist * Math.cos(entryYaw) * cosPitch,
    );

    // ── Cache arrival orbit state on first frame ──
    // (Can't precompute in beginTravel because target body moves)
    const arrTanX = Math.cos(entryYaw) * cosPitch;
    const arrTanZ = -Math.sin(entryYaw) * cosPitch;
    const appX = Math.sin(approachDir);
    const appZ = Math.cos(approachDir);
    const dotArr = arrTanX * appX + arrTanZ * appZ;
    const captureDir = dotArr > 0 ? 1 : -1;

    if (!this._arrivalComputed) {
      this._arrivalComputed = true;
      this._arrivalYaw = entryYaw;
      this._arrivalDist = this._travelToOrbitDist;
      this._arrivalPitch = entryPitch;
      this._arrivalCaptureDir = captureDir;
      this._arrivalYawSpeed = 0.25 + Math.random() * 0.15;

      // Compute arrival tangent (departure tangent was set in beginTravel).
      const remDist = this._hermiteStartPos.distanceTo(_v1);
      const arrMag = remDist * 0.6;
      this._arrivalTangentScaled.set(arrTanX, 0, arrTanZ)
        .multiplyScalar(captureDir).normalize()
        .multiplyScalar(arrMag);
      this._arrivalTangentScaled.y = arrMag * -0.03;
    }

    // ── TRANSFER: velocity-matched Hermite curve ──
    // The Hermite starts directly from the orbit exit position with v₀
    // matched to the orbit speed. No escape spiral, no blending —
    // the camera peels off tangentially and the cubic easing naturally
    // decelerates from orbit speed to cruise.
    const transferT = Math.min(1, this.travelElapsed / this.travelDuration);
    const s = this._travelEase(transferT);

    this._hermite(
      _v6, this._hermiteStartPos, this._departTangentScaled,
      _v1, this._arrivalTangentScaled, s,
    );
    this.camera.position.copy(_v6);

    // ── Arrival blend (last 4.0s): Hermite curve → pre-orbit ──
    // Gravitational capture: the curved cruise bends into orbit.
    const ARRIVE_BLEND = 4.0;
    const arriveStart = this.travelDuration - ARRIVE_BLEND;
    if (this.travelElapsed > arriveStart) {
      const blend = this._ease(
        (this.travelElapsed - arriveStart) / ARRIVE_BLEND
      );
      const arriveElapsed = this.travelElapsed - arriveStart;
      this._computePreOrbitPos(arriveElapsed, nextPos, _v5);
      this.camera.position.lerp(_v5, blend);
    }

    // ── Smooth cinematic LookAt (weighted blend) ──
    // Three targets blended with overlapping S-curves — no hard boundaries.
    // Departing body → forward heading → arriving body.
    const fromBody = this._travelFromBody;

    // Weight: departing body (full at start, fades out over 3 seconds)
    const DEPART_LOOK_DUR = 3.0;
    const wDepart = fromBody
      ? 1 - this._ease(Math.min(1, this.travelElapsed / DEPART_LOOK_DUR))
      : 0;
    // Weight: arriving body (fades in from 40% to 75%)
    const wArrive = this._ease(
      Math.max(0, Math.min(1, (transferT - 0.40) / 0.35)));
    // Weight: forward heading (fills the gap — peaks mid-transfer)
    const wHeading = Math.max(0, 1 - wDepart - wArrive);

    // Compute forward heading target: sample slightly ahead on the Hermite
    // curve and extend that direction to a distant point. Creates the
    // sensation of gazing out the front window during coast.
    const lookAheadT = Math.min(1, transferT + 0.05);
    const sAhead = this._travelEase(lookAheadT);
    this._hermite(
      _v4, this._hermiteStartPos, this._departTangentScaled,
      _v1, this._arrivalTangentScaled, sAhead,
    );
    _v3.subVectors(_v4, this.camera.position).normalize().multiplyScalar(1000);
    _v3.add(this.camera.position);

    // Weighted blend of the three targets
    this.lookAtTarget.set(0, 0, 0);
    if (fromBody && wDepart > 0.001) {
      this.lookAtTarget.addScaledVector(fromBody.position, wDepart);
    }
    if (wHeading > 0.001) {
      this.lookAtTarget.addScaledVector(_v3, wHeading);
    }
    if (wArrive > 0.001) {
      this.lookAtTarget.addScaledVector(nextPos, wArrive);
    }
    const totalW = wDepart + wHeading + wArrive;
    if (totalW > 0.001) {
      this.lookAtTarget.divideScalar(totalW);
    }

    this._applyFreeLookAndLookAt(this.lookAtTarget);

    if (t >= 1) {
      // Store entry yaw and capture direction for seamless orbit start
      this.orbitYaw = this._arrivalYaw;
      this._arrivalOrbitDir = this._arrivalCaptureDir;
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
