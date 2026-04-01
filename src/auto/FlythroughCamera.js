import * as THREE from 'three';

/**
 * FlythroughCamera — cinematic camera that physically flies through space.
 *
 * Three states:
 * - DESCEND: initial entry, camera flies from above the system down to first body
 * - ORBIT:   circle the current body, looking AT it (body fills the screen)
 * - TRAVEL:  Hermite spline path from one body to the next
 *
 * During orbit the camera focuses on the body (fills 1/2-2/3 of FOV).
 * It does 1 full revolution for survey, then continues just far enough
 * to align the departure tangent with the transit path to the next body
 * (total: 1.0-2.0 revolutions at constant speed).
 *
 * Travel uses curved Hermite spline paths with double-smootherstep easing:
 * the camera lingers near the departing body, rockets through the empty
 * middle (where both objects are billboards), then decelerates gently
 * as the destination grows. Short trips (planet↔moon) use full 3D
 * tangents that recompute each frame to track orbiting moons.
 * At arrival, the curved path blends into a pre-orbit position
 * (gravitational capture). The camera smoothly pans from watching the
 * departing body recede → gazing forward → watching the destination grow.
 */

const State = { DESCEND: 0, ORBIT: 1, TRAVEL: 2, APPROACH: 3 };

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
    this._isShortTrip = false;                          // planet↔moon nearby trip
    this._arrivalOrbitDir = null;  // orbit direction from slingshot capture
    this._nearbyDeparture = false; // true when next body is nearby (skip stale departure alignment)

    // Arrival blend state (Hermite → pre-orbit)
    this._arrivalComputed = false;
    this._arrivalYaw = 0;
    this._arrivalDist = 10;
    this._arrivalPitch = 0.15;
    this._arrivalCaptureDir = 1;
    this._arrivalYawSpeed = 0.3;

    // Current orbit distance (saved each frame for short-trip detection)
    this._currentDist = 10;

    // Warp arrival mode (set by beginTravelFrom with warpArrival option)
    this._warpArrival = false;

    // ── APPROACH state (pause → close-in → transition to orbit) ──
    this._approachElapsed = 0;
    this._approachPauseDur = 1.5;    // seconds to hold before closing
    this._approachCloseDur = 3.0;    // seconds to close in
    this._approachStartDist = 10;    // distance at start of close phase
    this._approachTargetDist = 5;    // final distance (body fills ~60% of frame)
    this._approachBodyRef = null;
    this._approachBodyRadius = 1;
    this._approachOrbitDist = 10;    // orbit distance for subsequent orbit
    this._approachOrbitDuration = 75; // orbit duration after approach

    // Orbit speed scale (1.0 = normal autopilot, 0.2 = slow cinematic)
    this._orbitSpeedScale = 1.0;

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
  beginOrbit(bodyRef, orbitDistance, bodyRadius, duration, options = {}) {
    this.state = State.ORBIT;
    this.bodyRef = bodyRef;
    this.bodyRadius = bodyRadius;
    this.orbitDistance = orbitDistance;
    this.orbitDistBase = orbitDistance;
    // Slow orbit: 5× slower rotation, breathing, and pitch oscillation
    this._orbitSpeedScale = options.slowOrbit ? 0.2 : 1.0;
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
      const nextDist = bodyPos.distanceTo(nextPos);

      if (nextDist < Math.max(this.orbitDistance * 5, 30)) {
        // ── Nearby target (planet → moon, moon → moon) ──
        // The moon orbits its parent during our orbit, so any departure
        // alignment computed now would be stale by departure time.
        // Instead: do 1 revolution at constant speed, and _updateOrbit
        // will dynamically extend until the camera is on the moon's side.
        this.orbitYawSpeed = TWO_PI / this.orbitDuration;
        this._nearbyDeparture = true;
      } else {
        // ── Far target: departure-aligned orbit ──
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
        this._nearbyDeparture = false;
      }
    } else {
      // No next body known — do exactly 1 revolution
      this.orbitYawSpeed = TWO_PI / this.orbitDuration;
      this._nearbyDeparture = false;
    }

    this._orbitStartYaw = this.orbitYaw;
  }

  /**
   * Begin travelling from current position to the next body.
  /**
   * Begin the approach sequence: pause → close-in → auto-transition to orbit.
   * @param {THREE.Object3D} bodyRef — the body to approach
   * @param {number} orbitDist — orbit distance for the subsequent orbit
   * @param {number} bodyRadius — body radius (for approach target calculation)
   * @param {number} [orbitDuration=75] — seconds for one orbit rotation after approach
   */
  beginApproach(bodyRef, orbitDist, bodyRadius, orbitDuration = 75) {
    this.active = true;
    this.state = State.APPROACH;
    this._approachBodyRef = bodyRef;
    this._approachBodyRadius = bodyRadius;
    this._approachOrbitDist = orbitDist;
    this._approachOrbitDuration = orbitDuration;
    this._approachElapsed = 0;

    // Current distance from the body
    this._approachStartDist = this.camera.position.distanceTo(bodyRef.position);
    // Target: body fills ~60% of frame (2.6× radius), capped at orbit distance
    this._approachTargetDist = Math.max(bodyRadius * 2.6, 0.02);
    // Don't close in more than the orbit distance (stay outside for clean orbit entry)
    this._approachTargetDist = Math.min(this._approachTargetDist, orbitDist);
  }

  /**
   * Begin travel from current body to the next (during an active tour or manual tab-advance).
   * Long trips use tangential departure (perpendicular to orbit radius).
   * Short trips (planet↔moon) use direct 3D path to the destination.
   * Both use double-smootherstep easing for slow-fast-slow motion.
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
    // Longer trips so the slow-fast-slow easing has time to linger at each end.
    const dist = this.departurePos.distanceTo(nextBodyRef.position);
    // Short hops (planet↔moon, moon↔moon) get a shorter minimum travel time.
    // The "30" floor catches moon→moon trips where _currentDist is tiny
    // (moon camera orbit distances are only ~0.04-1.2 units).
    const isNearby = dist < Math.max((this._currentDist || 10) * 5, 30);
    const minDur = isNearby ? 4 : 8;
    this.travelDuration = Math.max(minDur, Math.min(15, 10 * Math.sqrt(dist / 500)));

    // ── Short-trip detection (planet ↔ moon, moon ↔ moon) ──
    const isShortTrip = dist < Math.max(this._currentDist * 5, 30);
    this._isShortTrip = isShortTrip;

    if (isShortTrip) {
      // ── Short trip: direct path to nearby destination ──
      // Point straight at the destination in full 3D — no Y zeroing.
      // Moons can be above/below the orbital plane (inclined orbits),
      // and flattening Y creates a visible horizontal-then-curve path.
      _v1.subVectors(nextBodyRef.position, this.departurePos).normalize();
      this._departureTangent.copy(_v1);

      // Small tangent magnitude = nearly straight path (no wide arc)
      const tangentMag = dist * 0.25;
      this._departTangentScaled.copy(this._departureTangent).multiplyScalar(tangentMag);
    } else {
      // ── Long trip: tangential departure with velocity matching ──
      // The tangent is perpendicular to the radius vector — exactly the
      // direction the camera was moving when we left orbit.
      const cp = Math.cos(this.orbitPitch);
      this._departureTangent.set(
        Math.cos(this.orbitYaw) * cp,
        0,
        -Math.sin(this.orbitYaw) * cp,
      ).multiplyScalar(this.orbitDirection).normalize();

      const tangentMag = dist * 0.6;
      this._departTangentScaled.copy(this._departureTangent).multiplyScalar(tangentMag);
      this._departTangentScaled.y = tangentMag * 0.03;
    }

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
  beginTravelFrom(nextBodyRef, nextOrbitDistance, nextBodyRadius, options = {}) {
    this.active = true;
    this.state = State.TRAVEL;
    this.nextBodyRef = nextBodyRef;
    this.nextOrbitDistance = nextOrbitDistance;
    this._warpArrival = options.warpArrival || false;

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
    this.travelElapsed = 0;

    // ── Travel duration ──
    if (this._warpArrival) {
      // Warp arrival: short 3s coast with leftover momentum feel
      this.travelDuration = 3;
    } else {
      // Normal: distance-based duration
      this.travelDuration = Math.max(8, Math.min(15, 10 * Math.sqrt(dist / 500)));
    }

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
   * Travel easing — slow departure, fast cruise, slow arrival.
   *
   * Double smootherstep: applies quintic easing twice for a much more
   * pronounced slow-fast-slow profile. The camera barely moves for the
   * first/last ~20% of travel time (lingering near each body), then
   * rockets through the middle ~60% at high speed.
   */
  _travelEase(t) {
    t = Math.max(0, Math.min(1, t));
    const s = this._ease(t);
    return this._ease(s);
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
      case State.APPROACH:
        return this._updateApproach(deltaTime);
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
    this.orbitYaw += this.orbitYawSpeed * this._orbitSpeedScale * this.orbitDirection * deltaTime;

    // Pitch: blend from entry pitch to oscillating orbit pitch
    const minPitch = 0.087;   // 5°
    const maxPitch = 0.436;   // 25°
    const midPitch = (minPitch + maxPitch) / 2;
    const ampPitch = (maxPitch - minPitch) / 2;
    const oscPitch = midPitch + ampPitch * Math.sin(this.orbitElapsed * 0.52 * this._orbitSpeedScale + this.orbitPitchPhase);
    this.orbitPitch = this._entryPitch + (oscPitch - this._entryPitch) * entryFactor;

    // Distance: blend from entry distance to breathing orbit distance
    const breathe = 1 + 0.05 * entryFactor * Math.sin(this.orbitElapsed * 0.785 * this._orbitSpeedScale + this.orbitDistPhase);
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

    // Save orbit distance for short-trip detection at departure
    this._currentDist = dist;

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

    let orbitComplete = this.orbitElapsed >= this.orbitDuration;

    // ── Dynamic departure gate for nearby targets ──
    // For nearby targets (moons), the departure alignment computed at orbit
    // start is stale because the moon moved during our orbit. Before allowing
    // orbit completion, check that the camera is on the correct side of the
    // body — within 90° of the next body's CURRENT direction. This prevents
    // the travel path from going through the body.
    // Cap extension at 1.5× base duration to prevent infinite orbits.
    if (orbitComplete && this._nearbyDeparture && this.nextBodyRef
        && this.orbitElapsed < this.orbitDuration * 1.5) {
      const nextPos = this.nextBodyRef.position;
      const moonAngle = Math.atan2(
        nextPos.x - bodyPos.x,
        nextPos.z - bodyPos.z,
      );
      const angDiff = Math.abs(Math.atan2(
        Math.sin(this.orbitYaw - moonAngle),
        Math.cos(this.orbitYaw - moonAngle),
      ));
      // If camera is more than 90° from the moon's direction, keep orbiting
      if (angDiff > Math.PI / 2) {
        orbitComplete = false;
      }
    }

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

  _updateApproach(deltaTime) {
    this._approachElapsed += deltaTime;
    const body = this._approachBodyRef;
    if (!body) return { orbitComplete: false, travelComplete: false, targetingReady: false };

    const bodyPos = body.position;
    const pauseDur = this._approachPauseDur;
    const closeDur = this._approachCloseDur;
    const totalDur = pauseDur + closeDur;

    if (this._approachElapsed < pauseDur) {
      // Pause phase: hold position, look at body
      this.camera.lookAt(bodyPos);
    } else if (this._approachElapsed < totalDur) {
      // Close phase: move radially toward body using smootherstep
      const closeT = (this._approachElapsed - pauseDur) / closeDur;
      const eased = this._ease(closeT);
      const dist = this._approachStartDist + (this._approachTargetDist - this._approachStartDist) * eased;

      // Move camera along the current direction to body at the interpolated distance
      _v1.subVectors(this.camera.position, bodyPos).normalize();
      this.camera.position.copy(bodyPos).addScaledVector(_v1, dist);
      this.camera.lookAt(bodyPos);
    } else {
      // Approach complete — transition to slow orbit
      this.beginOrbit(body, this._approachOrbitDist, this._approachBodyRadius,
        this._approachOrbitDuration, { slowOrbit: true });
      return { orbitComplete: false, travelComplete: false, targetingReady: false };
    }

    return { orbitComplete: false, travelComplete: false, targetingReady: false };
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

    // ── Arrival orbit state — computed once (random params stay stable) ──
    if (!this._arrivalComputed) {
      this._arrivalComputed = true;
      this._arrivalYaw = entryYaw;
      this._arrivalDist = this._travelToOrbitDist;
      this._arrivalPitch = entryPitch;
      this._arrivalCaptureDir = captureDir;
      this._arrivalYawSpeed = 0.25 + Math.random() * 0.15;
    }

    // ── Arrival tangent — recomputed each frame to track moving bodies ──
    // Moons orbit their parent during travel, so a stale tangent causes
    // the Hermite curve to distort as the endpoint drifts away from the
    // tangent direction. Recomputing is cheap (a few vector ops).
    const remDist = this._hermiteStartPos.distanceTo(_v1);

    if (this._isShortTrip) {
      // Short trip: arrive from full 3D approach direction.
      // Uses current start→endpoint direction so the tangent tracks
      // the moon's actual position, not where it was at trip start.
      const arrMag = remDist * 0.25;
      _v3.subVectors(_v1, this._hermiteStartPos).normalize();
      this._arrivalTangentScaled.copy(_v3).multiplyScalar(arrMag);
    } else {
      // Long trip: arrive tangent to orbit (graceful curved entry)
      const arrMag = remDist * 0.6;
      this._arrivalTangentScaled.set(arrTanX, 0, arrTanZ)
        .multiplyScalar(captureDir).normalize()
        .multiplyScalar(arrMag);
      this._arrivalTangentScaled.y = arrMag * -0.03;
    }

    // ── TRANSFER: Hermite curve with easing ──
    const transferT = Math.min(1, this.travelElapsed / this.travelDuration);
    // Warp arrival: ease-out (starts fast = leftover momentum, decelerates into orbit).
    // Normal travel: double-smootherstep (linger near bodies, rocket through the middle).
    const s = this._warpArrival
      ? 1 - (1 - transferT) * (1 - transferT)   // ease-out quadratic
      : this._travelEase(transferT);

    this._hermite(
      _v6, this._hermiteStartPos, this._departTangentScaled,
      _v1, this._arrivalTangentScaled, s,
    );
    this.camera.position.copy(_v6);

    // ── Arrival blend (last 3.5s): Hermite curve → pre-orbit ──
    // Gravitational capture: the curved cruise bends into orbit.
    const ARRIVE_BLEND = 3.5;
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

    // Weight: departing body (full at start, fades out).
    // Longer look-back to match the slow departure easing — the camera
    // lingers near the body so we should keep looking at it longer.
    const DEPART_LOOK_DUR = this._isShortTrip ? 3.0 : 5.0;
    const wDepart = fromBody
      ? 1 - this._ease(Math.min(1, this.travelElapsed / DEPART_LOOK_DUR))
      : 0;
    // Weight: arriving body (fades in from 35% to 70%).
    // Warp arrival: always look at the star (camera was already facing it).
    const wArrive = this._warpArrival
      ? 1
      : this._ease(Math.max(0, Math.min(1, (transferT - 0.35) / 0.35)));
    // Weight: forward heading (fills the gap — peaks mid-transfer)
    const wHeading = Math.max(0, 1 - wDepart - wArrive);

    // Compute forward heading direction: sample slightly ahead on the
    // Hermite curve to find which way the path is curving.
    const lookAheadT = Math.min(1, transferT + 0.05);
    const sAhead = this._travelEase(lookAheadT);
    this._hermite(
      _v4, this._hermiteStartPos, this._departTangentScaled,
      _v1, this._arrivalTangentScaled, sAhead,
    );

    // ── Direction-normalized lookAt blend ──
    // Blend unit DIRECTIONS, not positions. The old code blended raw
    // positions, but the forward heading was 1000 units away while the
    // departing body was only ~15 units away. This meant the forward
    // target completely dominated the blend, making the camera snap to
    // looking forward instantly despite weighted transitions.
    // By normalizing to unit directions first, the weights control the
    // actual angular blend correctly.
    this.lookAtTarget.set(0, 0, 0);
    if (fromBody && wDepart > 0.001) {
      _v2.subVectors(fromBody.position, this.camera.position).normalize();
      this.lookAtTarget.addScaledVector(_v2, wDepart);
    }
    if (wHeading > 0.001) {
      _v2.subVectors(_v4, this.camera.position).normalize();
      this.lookAtTarget.addScaledVector(_v2, wHeading);
    }
    if (wArrive > 0.001) {
      _v2.subVectors(nextPos, this.camera.position).normalize();
      this.lookAtTarget.addScaledVector(_v2, wArrive);
    }
    // Project blended direction back to a lookAt point
    this.lookAtTarget.normalize().multiplyScalar(100).add(this.camera.position);

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
