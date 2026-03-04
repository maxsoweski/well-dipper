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
 * Travel uses curved Hermite spline paths — elliptical transfer orbits
 * tangent to both departure and arrival orbits, like Hohmann transfers.
 * At departure, the orbit spiral blends smoothly into the curved cruise.
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
    this._hermiteStartPos = new THREE.Vector3();      // where escape spiral ends / Hermite begins
    this._escapeComplete = false;                     // has the escape spiral finished?
    this._escapeDuration = 6;                         // dynamic, set per-travel
    this._escapeWidening = 2.0;                       // dynamic, scales with trip distance
    this._orbitStartYaw = 0;                          // yaw at orbit start (for revolution counting)
    this._arrivalOrbitDir = null;  // orbit direction from slingshot capture

    // Departure blend state (spiral continuation → Hermite)
    this._departYaw = 0;
    this._departDist = 10;
    this._departSpeedFactor = 1;
    this._departPitch = 0.15;

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

    // Override yaw speed to achieve exactly 3 revolutions with gradual
    // speed ramp from 1× to 2.5× (quadratic ease-in: t²). Ease-in means
    // the speed is STILL accelerating at orbit end — no plateau before
    // the escape, just one continuous buildup from survey to escape velocity.
    // Average of (1 + t²×1.5) over [0,1] = 1 + 1.5/3 = 1.5.
    this.orbitYawSpeed = 3 * 2 * Math.PI / (this.orbitDuration * 1.5);
    this._orbitStartYaw = this.orbitYaw;

    // Phase-align pitch oscillation so it starts from the actual camera pitch
    // (oscillation grows smoothly from entry value, no random jump)
    const midPitch = (0.087 + 0.436) / 2;
    const ampPitch = (0.436 - 0.087) / 2;
    const pitchRatio = Math.max(-1, Math.min(1, (this._entryPitch - midPitch) / ampPitch));
    this.orbitPitchPhase = Math.asin(pitchRatio);

    // After slingshot arrival, use capture direction as the authoritative
    // orbit direction. The travel phase chose the arrival edge to match
    // the predicted optimal departure direction, so don't override it —
    // overriding would cause a visible direction reversal at arrival.
    if (this._arrivalOrbitDir !== null) {
      this.orbitDirection = this._arrivalOrbitDir;
      this._arrivalOrbitDir = null;
    }
    // Only predict orbit direction from scratch when there's no slingshot
    // arrival (e.g. after descend, or first orbit). When the slingshot
    // chose an arrival side, that side IS the correct direction.
    else if (this.nextBodyRef) {
      const nextPos = this.nextBodyRef.position;
      const toNextAngle = Math.atan2(nextPos.x - bodyPos.x, nextPos.z - bodyPos.z);

      // After 3 full revolutions the camera returns to its starting angle,
      // so the departure tangent is perpendicular to the radius at orbitYaw.
      const tangentCW  = this.orbitYaw + Math.PI / 2;
      const tangentCCW = this.orbitYaw - Math.PI / 2;

      const diffCW  = Math.abs(Math.atan2(
        Math.sin(toNextAngle - tangentCW), Math.cos(toNextAngle - tangentCW),
      ));
      const diffCCW = Math.abs(Math.atan2(
        Math.sin(toNextAngle - tangentCCW), Math.cos(toNextAngle - tangentCCW),
      ));

      this.orbitDirection = diffCW <= diffCCW ? 1 : -1;
    }
  }

  /**
   * Begin travelling from current position to the next body.
   * The escape phase (first 4s of travel) continues the orbit spiral with
   * aggressive widening until the camera "breaks free." The Hermite transfer
   * curve then picks up from wherever the spiral ends.
   */
  beginTravel(nextBodyRef, nextOrbitDistance, nextBodyRadius) {
    this.state = State.TRAVEL;
    this.nextBodyRef = nextBodyRef;
    this.nextOrbitDistance = nextOrbitDistance;

    this.departurePos.copy(this.camera.position);

    // Store forward direction at departure for smooth lookAt blend
    this.camera.getWorldDirection(this.departureDir);

    // Snapshot departure spiral state so the escape phase can continue the
    // orbit spiral forward in time from exactly where we left off.
    this._departYaw = this.orbitYaw;
    this._departDist = this._currentDist;
    this._departSpeedFactor = this._currentSpeedFactor;
    this._departPitch = this.orbitPitch;

    this._arrivalComputed = false; // computed on first frame of travel
    this._escapeComplete = false;  // escape spiral runs first
    this.travelElapsed = 0;

    // ── Distance-based travel duration ──
    // Sqrt scaling: doubling distance adds ~40% time. Feels natural.
    const dist = this.departurePos.distanceTo(nextBodyRef.position);
    this.travelDuration = Math.max(12, Math.min(25, 18 * Math.sqrt(dist / 500)));

    // ── Dynamic escape duration ──
    // Proportional to travel time (25%), clamped 3-7s. Short trips
    // (planet → its own moon) get a quick escape; long interplanetary
    // trips get more time to spiral away naturally.
    this._escapeDuration = Math.max(3, Math.min(7, this.travelDuration * 0.25));

    // ── Distance-scaled escape widening ──
    // For short trips, the escape orbit shouldn't widen past ~35% of the
    // trip distance — otherwise the camera spirals past the destination.
    // For long trips, full widening (2×) gives a dramatic escape spiral.
    const maxEscapeDist = dist * 0.35;
    this._escapeWidening = Math.max(0.3, Math.min(2.0, maxEscapeDist / this._departDist - 1));

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
    this._escapeComplete = true; // no orbit to escape from
    this._hermiteStartPos.copy(this.departurePos); // Hermite starts here
    this.travelElapsed = 0;

    // ── Distance-based travel duration ──
    this.travelDuration = Math.max(12, Math.min(25, 18 * Math.sqrt(dist / 500)));

    // No from-body — escape phase will be skipped in _updateTravel
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
   * Travel easing — gradual ramp-up, cruise, gradual deceleration.
   *
   * Cubic: e(t) = (v₀-2)t³ + (3-2v₀)t² + v₀t
   * v₀ = initial velocity factor (0 → smoothstep, higher → more momentum)
   *
   * With v₀=0.2: starts slow, ramps up to "cruise speed" mid-flight,
   * then gradually decelerates toward destination (gravitational capture).
   */
  _travelEase(t) {
    t = Math.max(0, Math.min(1, t));
    const v0 = 0.2;
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

    // ── Gradual speed ramp (entire orbit, ease-in) ──
    // Quadratic ease-in (t²): starts slow, continuously accelerates,
    // and is STILL speeding up when the escape phase begins — no plateau
    // or sudden jump at the transition. One smooth curve from first
    // survey orbit through escape velocity.
    const rampT = Math.min(1, this.orbitElapsed / this.orbitDuration);
    let speedFactor = 1 + rampT * rampT * 1.5; // ease-in: 1× → 2.5×

    // Advance yaw — continuous, same direction throughout.
    this.orbitYaw += this.orbitYawSpeed * this.orbitDirection * deltaTime * speedFactor;

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

    // ── Stepped orbit widening (discrete altitude raises) ──
    // Track actual revolutions via accumulated yaw (not elapsed time,
    // since orbit speed varies with the ramp). Close survey for 1.5
    // revolutions, then step wider, then wider again approaching departure.
    const revolutions = Math.abs(this.orbitYaw - this._orbitStartYaw) / (2 * Math.PI);
    let altMult;
    if (revolutions < 1.5) {
      altMult = 1.0; // close survey orbits
    } else if (revolutions < 2.5) {
      altMult = 1.0 + this._ease(revolutions - 1.5) * 0.35; // step to 1.35×
    } else {
      altMult = 1.35 + this._ease(Math.min(1, revolutions - 2.5)) * 0.35; // step to 1.7×
    }
    dist *= altMult;

    // Save frame state for departure blend snapshot
    this._currentDist = dist;
    this._currentSpeedFactor = speedFactor;

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
   * Continue the departure orbit spiral forward in time.
   * Used during the escape phase — the camera continues its orbit with
   * eased widening (slow at first, then accelerating) until it "breaks free."
   * The easing makes the spiral unfurl naturally: tight at first, opening
   * up as the camera gains escape velocity, then settling as it enters
   * the transfer trajectory.
   */
  _computeSpiralPos(elapsed, bodyPos, out) {
    const t = Math.min(1, elapsed / this._escapeDuration);
    const easedT = this._ease(t);

    // Angular acceleration: eased, reaches 1.3× at escape end.
    // Combined with the 2.5× departure speed factor, the orbit
    // continues accelerating seamlessly through the escape.
    const accel = 1 + easedT * 0.3;
    const yaw = this._departYaw
      + this.orbitYawSpeed * this.orbitDirection * elapsed * this._departSpeedFactor * accel;

    // Eased widening — orbit opens up slowly at first, then accelerates.
    // Smootherstep has zero derivative at endpoints, so the widening
    // starts gently (orbit barely changes) and the radial velocity
    // returns to zero at escape end (smooth handoff to Hermite).
    const dist = this._departDist * (1 + easedT * this._escapeWidening);

    const cp = Math.cos(this._departPitch);
    out.set(
      bodyPos.x + dist * Math.sin(yaw) * cp,
      bodyPos.y + dist * Math.sin(this._departPitch),
      bodyPos.z + dist * Math.cos(yaw) * cp,
    );
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

      // For no-escape case, compute arrival tangent now (departure tangent
      // was already set in beginTravelFrom).
      if (this._escapeComplete) {
        const remDist = this._hermiteStartPos.distanceTo(_v1);
        const arrMag = remDist * 0.6;
        this._arrivalTangentScaled.set(arrTanX, 0, arrTanZ)
          .multiplyScalar(captureDir).normalize()
          .multiplyScalar(arrMag);
        this._arrivalTangentScaled.y = arrMag * -0.03;
      }
    }

    // ── ESCAPE PHASE: widening spiral away from departing body ──
    // The orbit continues naturally with increasing speed and aggressive
    // widening. The camera stays focused on the departing body as it
    // "breaks free" of gravity. No direction change — just the orbit
    // opening up until the camera escapes into the transfer curve.
    const ESCAPE_DUR = this._escapeDuration;
    const hasEscape = !!this._travelFromBody;

    if (hasEscape && !this._escapeComplete) {
      // Continue orbit spiral with increasing speed and widening
      this._computeSpiralPos(this.travelElapsed, this._travelFromBody.position, _v6);
      this.camera.position.copy(_v6);

      // When escape phase ends, capture position and compute Hermite tangents
      if (this.travelElapsed >= ESCAPE_DUR) {
        this._escapeComplete = true;
        this._hermiteStartPos.copy(this.camera.position);

        // Compute spiral tangent at escape end (orbit tangent at this yaw).
        // accel must match _computeSpiralPos at t=1: 1 + ease(1) * 0.3 = 1.3
        const accel = 1.3;
        const escapeYaw = this._departYaw
          + this.orbitYawSpeed * this.orbitDirection * ESCAPE_DUR
          * this._departSpeedFactor * accel;
        const cp = Math.cos(this._departPitch);
        this._departureTangent.set(
          Math.cos(escapeYaw) * cp,
          0,
          -Math.sin(escapeYaw) * cp,
        ).multiplyScalar(this.orbitDirection).normalize();

        // Scale both tangents based on remaining distance
        const remDist = this._hermiteStartPos.distanceTo(_v1);
        const tangentMag = remDist * 0.6;
        this._departTangentScaled.copy(this._departureTangent).multiplyScalar(tangentMag);
        this._departTangentScaled.y = tangentMag * 0.03;

        this._arrivalTangentScaled.set(arrTanX, 0, arrTanZ)
          .multiplyScalar(captureDir).normalize()
          .multiplyScalar(tangentMag);
        this._arrivalTangentScaled.y = tangentMag * -0.03;
      }

      // LookAt during escape: watch departing body recede
      this._applyFreeLookAndLookAt(this._travelFromBody.position);

    } else {
      // ── TRANSFER PHASE: Hermite curve from escape end to arrival ──
      // The Hermite starts from wherever the escape spiral ended (or from
      // departurePos if no escape). Tangent matches the spiral's direction
      // at escape end, so there's no direction change — just a smooth
      // transition from spiraling outward to curving toward destination.
      const transferStart = hasEscape ? ESCAPE_DUR : 0;
      const transferDur = this.travelDuration - transferStart;
      const transferT = Math.min(1,
        (this.travelElapsed - transferStart) / transferDur);
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

      // Weight: departing body (full at start of transfer, fades out by 35%)
      const wDepart = fromBody
        ? 1 - this._ease(Math.max(0, Math.min(1, transferT / 0.35)))
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
    }

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
