/**
 * CinematicDirector -- camera framing/composition layer.
 *
 * Runs independently from FlightDynamics. It receives the ship's
 * position, velocity, and flight state as inputs each frame, and decides
 * where the camera LOOKS (orientation + small positional offset).
 *
 * The camera position follows the ship; the director controls:
 *   1. lookTarget -- the point the camera aims at
 *   2. offset -- a small positional offset from the ship (for cinematic framing)
 *
 * It does NOT move the ship or change the flight state. It's purely visual.
 *
 * The director has its own state machine for composition:
 *   TRACKING_FORWARD  -- look ahead along velocity (fast FREE flight)
 *   BODY_PORTRAIT     -- frame the dominant body (ORBIT state)
 *   DEPARTURE_WATCH   -- look back at receding body after leaving orbit
 *   ARRIVAL_ANTICIPATION -- look at approaching body (APPROACH state)
 *   SCENIC_DRIFT      -- meditative slow rotation (IDLE / very slow)
 *   WARP_LOCK         -- orientation frozen during warp
 */

import * as THREE from 'three';
import { CameraCompositions } from './CameraCompositions.js';

// Composition states (the director's own state machine, separate from FlightState)
export const CompositionState = {
  TRACKING_FORWARD: 'TRACKING_FORWARD',
  BODY_PORTRAIT: 'BODY_PORTRAIT',
  DEPARTURE_WATCH: 'DEPARTURE_WATCH',
  ARRIVAL_ANTICIPATION: 'ARRIVAL_ANTICIPATION',
  SCENIC_DRIFT: 'SCENIC_DRIFT',
  WARP_LOCK: 'WARP_LOCK',
};

// Reusable scratch vectors
const _s1 = new THREE.Vector3();
const _s2 = new THREE.Vector3();

export class CinematicDirector {
  /**
   * @param {THREE.Camera} camera - the Three.js camera to orient
   * @param {import('../physics/GravityField.js').GravityField} gravityField - gravity service for body queries
   */
  constructor(camera, gravityField) {
    this.camera = camera;
    this.gravityField = gravityField;

    // ── Director state ──
    this.state = CompositionState.SCENIC_DRIFT;

    /** @type {THREE.Vector3} The point the camera should look at (world space) */
    this.lookTarget = new THREE.Vector3();

    /** @type {THREE.Vector3} Small offset from ship position for camera placement */
    this.offset = new THREE.Vector3();

    // ── Smooth blending (frame-rate independent exponential smoothing) ──
    // blendSpeed = seconds to reach ~63% of the target.
    // Formula each frame: current = lerp(current, target, 1 - exp(-dt / blendSpeed))
    this.blendSpeed = 1.5;

    // ── Internal state ──
    this._currentLookTarget = new THREE.Vector3(); // smoothed lookTarget
    this._currentOffset = new THREE.Vector3();     // smoothed offset
    this._previousFlightState = null;              // to detect flight state changes
    this._previousDominantIndex = -1;              // to detect SOI changes

    // DEPARTURE_WATCH tracking
    this._departureBodyPos = new THREE.Vector3();  // where we left orbit
    this._departureTimer = 0;                      // how long we've been watching departure
    this._departureDuration = 3.0;                 // seconds to look back

    // SCENIC_DRIFT tracking
    this._driftAngle = 0;                          // slowly rotating angle
    this._driftSpeed = 0.15;                       // radians per second (very slow)
    this._driftBodyIndex = -1;                     // which body we're currently framing

    // Speed threshold: above this, TRACKING_FORWARD kicks in
    this._trackingSpeedThreshold = 2.0;

    // Points of interest (updated each frame from nearby bodies)
    this._pois = [];
  }

  // ═══════════════════════════════════════════════════════════════════
  //  MAIN UPDATE
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Update the director's composition state and compute lookTarget + offset.
   *
   * Call this every frame AFTER FlightDynamics.update() and GravityField.tick().
   *
   * @param {number} dt - time step in seconds
   * @param {THREE.Vector3} shipPosition - current ship position
   * @param {THREE.Vector3} shipVelocity - current ship velocity
   * @param {string} flightState - current FlightState (e.g. 'FREE', 'ORBIT', etc.)
   * @param {object} [flightData] - optional extra data from FlightDynamics:
   *   {
   *     orbitBodyIndex?: number,   // index of body being orbited (ORBIT state)
   *     approachBodyIndex?: number, // index of body being approached (APPROACH state)
   *     lastGravResult?: object,    // last gravity query result
   *   }
   */
  update(dt, shipPosition, shipVelocity, flightState, flightData = {}) {
    // Clamp dt to avoid wild jumps on tab-switch
    const clampedDt = Math.min(dt, 0.1);

    // Update nearby points of interest
    this._updatePOIs(shipPosition);

    // Detect flight state transitions and update composition state
    this._updateCompositionState(flightState, flightData, shipVelocity);

    // Compute raw (unsmoothed) lookTarget and offset for the current composition state
    this._computeComposition(clampedDt, shipPosition, shipVelocity, flightState, flightData);

    // Smooth blend toward the target (skip during WARP_LOCK to freeze orientation)
    if (this.state !== CompositionState.WARP_LOCK) {
      const blendAlpha = 1 - Math.exp(-clampedDt / this.blendSpeed);
      this._currentLookTarget.lerp(this.lookTarget, blendAlpha);
      this._currentOffset.lerp(this.offset, blendAlpha);
    }

    // Store previous flight state for transition detection
    this._previousFlightState = flightState;
  }

  /**
   * Get the smoothed lookAt target (what the camera should aim at).
   * @returns {THREE.Vector3}
   */
  getLookTarget() {
    return this._currentLookTarget;
  }

  /**
   * Get the smoothed camera offset from the ship position.
   * @returns {THREE.Vector3}
   */
  getOffset() {
    return this._currentOffset;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  COMPOSITION STATE TRANSITIONS
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Decide which composition state to be in based on flight state and velocity.
   *
   * The mapping is:
   *   WARP flight state           -> WARP_LOCK
   *   ORBIT flight state          -> BODY_PORTRAIT
   *   APPROACH flight state       -> ARRIVAL_ANTICIPATION
   *   ORBIT->FREE transition      -> DEPARTURE_WATCH (temporary, then TRACKING_FORWARD)
   *   FREE + fast                 -> TRACKING_FORWARD
   *   IDLE or FREE + very slow    -> SCENIC_DRIFT
   */
  _updateCompositionState(flightState, flightData, shipVelocity) {
    const speed = shipVelocity.length();
    const prevState = this._previousFlightState;

    // WARP always wins
    if (flightState === 'WARP') {
      this.state = CompositionState.WARP_LOCK;
      return;
    }

    // Detect ORBIT -> FREE transition (departure)
    if (prevState === 'ORBIT' && flightState === 'FREE') {
      this.state = CompositionState.DEPARTURE_WATCH;
      this._departureTimer = 0;

      // Remember where the dominant body was when we left
      const dom = this.gravityField.dominantBodyAt
        ? this.gravityField.dominantBodyAt(this._currentLookTarget)
        : null;
      if (dom && dom.body) {
        this._departureBodyPos.copy(dom.body.position);
      }
      return;
    }

    // DEPARTURE_WATCH is temporary -- after duration, transition out
    if (this.state === CompositionState.DEPARTURE_WATCH) {
      if (this._departureTimer < this._departureDuration) {
        return; // stay in departure watch
      }
      // Timer expired -- fall through to normal state selection below
    }

    // ORBIT -> BODY_PORTRAIT
    if (flightState === 'ORBIT') {
      this.state = CompositionState.BODY_PORTRAIT;
      this.blendSpeed = 1.5;
      return;
    }

    // APPROACH -> ARRIVAL_ANTICIPATION
    if (flightState === 'APPROACH') {
      this.state = CompositionState.ARRIVAL_ANTICIPATION;
      this.blendSpeed = 1.5;
      return;
    }

    // FREE + fast -> TRACKING_FORWARD
    if (flightState === 'FREE' && speed > this._trackingSpeedThreshold) {
      this.state = CompositionState.TRACKING_FORWARD;
      this.blendSpeed = 1.5;
      return;
    }

    // IDLE or slow FREE -> SCENIC_DRIFT
    this.state = CompositionState.SCENIC_DRIFT;
    this.blendSpeed = 3.5; // very slow blend for meditative feel
  }

  // ═══════════════════════════════════════════════════════════════════
  //  COMPOSITION COMPUTATION (per-state)
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Compute the raw lookTarget and offset for the current composition state.
   * These get smoothed in update() before being exposed.
   */
  _computeComposition(dt, shipPosition, shipVelocity, flightState, flightData) {
    switch (this.state) {
      case CompositionState.TRACKING_FORWARD:
        this._computeTrackingForward(dt, shipPosition, shipVelocity);
        break;
      case CompositionState.BODY_PORTRAIT:
        this._computeBodyPortrait(dt, shipPosition, flightData);
        break;
      case CompositionState.DEPARTURE_WATCH:
        this._computeDepartureWatch(dt, shipPosition, shipVelocity);
        break;
      case CompositionState.ARRIVAL_ANTICIPATION:
        this._computeArrivalAnticipation(dt, shipPosition, flightData);
        break;
      case CompositionState.SCENIC_DRIFT:
        this._computeScenicDrift(dt, shipPosition);
        break;
      case CompositionState.WARP_LOCK:
        // Don't change lookTarget or offset -- camera orientation stays frozen
        break;
    }
  }

  /**
   * TRACKING_FORWARD: look ahead along velocity vector.
   *
   * The camera looks in the direction of travel, with a small perpendicular
   * offset for cinematic asymmetry (subject isn't dead center).
   */
  _computeTrackingForward(dt, shipPosition, shipVelocity) {
    const speed = shipVelocity.length();
    if (speed < 0.01) return;

    // Look ahead: a point along the velocity direction, ahead of the ship
    const lookDistance = Math.max(speed * 2, 20); // look 2 seconds ahead, minimum 20 units
    const velocityDir = _s1.copy(shipVelocity).normalize();

    this.lookTarget.copy(shipPosition).addScaledVector(velocityDir, lookDistance);

    // Leading space offset: shift camera slightly behind travel direction
    this.offset.copy(CameraCompositions.leadingSpace(shipVelocity, shipPosition, 0.08));

    // Add a small perpendicular offset for cinematic feel
    // Use cross product with up to get a "right" direction
    const right = _s2.crossVectors(velocityDir, THREE.Object3D.DEFAULT_UP);
    if (right.lengthSq() > 0.001) {
      right.normalize();
      // Small offset to the right (about 5% of look distance)
      this.offset.addScaledVector(right, lookDistance * 0.03);
    }
  }

  /**
   * BODY_PORTRAIT: frame the dominant body with rule-of-thirds composition.
   *
   * Finds the body we're orbiting, computes a lookAt that puts it at
   * a 1/3 offset, and gently orbits the look direction for variety.
   */
  _computeBodyPortrait(dt, shipPosition, flightData) {
    // Find the body we're orbiting
    const bodyIndex = flightData.orbitBodyIndex ?? -1;
    const body = bodyIndex >= 0 ? this.gravityField.bodies[bodyIndex] : null;

    if (!body) {
      // Fallback: look at the nearest body
      const dom = this._getNearestBody(shipPosition);
      if (dom) {
        this.lookTarget.copy(dom.position);
      }
      this.offset.set(0, 0, 0);
      return;
    }

    // Use portrait framing (rule of thirds)
    const bodyRadius = this._estimateBodyRadius(body);
    this.lookTarget.copy(
      CameraCompositions.framePlanetPortrait(
        body.position, bodyRadius, shipPosition, this.camera, 0.5
      )
    );

    // Check for background bodies to include in the composition
    const backgrounds = this._getBackgroundBodies(body, shipPosition);
    if (backgrounds.length > 0) {
      const bgLookAt = CameraCompositions.frameWithBackground(
        { position: body.position, radius: bodyRadius },
        backgrounds,
        shipPosition
      );
      // Blend: 80% portrait, 20% background influence
      this.lookTarget.lerp(bgLookAt, 0.2);
    }

    // Gentle orbital rotation of the offset for variety
    this._driftAngle += dt * 0.1; // very slow rotation
    const dist = shipPosition.distanceTo(body.position);
    const orbitOffset = dist * 0.05; // 5% of distance
    this.offset.set(
      Math.cos(this._driftAngle) * orbitOffset,
      Math.sin(this._driftAngle * 0.7) * orbitOffset * 0.3, // less vertical movement
      Math.sin(this._driftAngle) * orbitOffset
    );
  }

  /**
   * DEPARTURE_WATCH: look back at the receding body, then pan forward.
   *
   * For the first ~3 seconds after leaving orbit, the camera watches the
   * body recede. Then it slowly pans toward the travel direction.
   */
  _computeDepartureWatch(dt, shipPosition, shipVelocity) {
    this._departureTimer += dt;

    // Blend factor: 0 = looking at body, 1 = looking forward
    const t = Math.min(this._departureTimer / this._departureDuration, 1);

    // Smootherstep for natural pan: slow start, fast middle, slow end
    const smooth = t * t * t * (t * (t * 6 - 15) + 10);

    // Where we're going (forward along velocity)
    const speed = shipVelocity.length();
    const lookAhead = Math.max(speed * 2, 20);
    const forwardTarget = _s1.copy(shipPosition)
      .addScaledVector(_s2.copy(shipVelocity).normalize(), lookAhead);

    // Blend between body and forward
    this.lookTarget.lerpVectors(this._departureBodyPos, forwardTarget, smooth);

    // Offset shrinks as we transition
    this.offset.set(0, 0, 0);
  }

  /**
   * ARRIVAL_ANTICIPATION: look at the destination body as it grows.
   *
   * The camera watches the body you're approaching. As you get closer,
   * the body fills more of the frame naturally.
   */
  _computeArrivalAnticipation(dt, shipPosition, flightData) {
    const bodyIndex = flightData.approachBodyIndex ?? -1;
    const body = bodyIndex >= 0 ? this.gravityField.bodies[bodyIndex] : null;

    if (!body) {
      // Fallback to nearest body
      const dom = this._getNearestBody(shipPosition);
      if (dom) {
        this.lookTarget.copy(dom.position);
      }
      this.offset.set(0, 0, 0);
      return;
    }

    // Look at the approaching body with portrait framing
    const bodyRadius = this._estimateBodyRadius(body);
    this.lookTarget.copy(
      CameraCompositions.framePlanetPortrait(
        body.position, bodyRadius, shipPosition, this.camera, 0.4
      )
    );

    // Small offset for cinematic asymmetry
    const dist = shipPosition.distanceTo(body.position);
    const maxOffset = dist * 0.03;
    this.offset.set(maxOffset, maxOffset * 0.5, 0);
  }

  /**
   * SCENIC_DRIFT: slowly rotate to find beautiful compositions.
   *
   * Picks the nearest interesting body and slowly cycles the view angle
   * around it. Very slow blend speed creates a meditative feel.
   */
  _computeScenicDrift(dt, shipPosition) {
    this._driftAngle += dt * this._driftSpeed;

    // Pick a body to frame (nearest interesting one)
    const target = this._pickDriftTarget(shipPosition);

    if (!target) {
      // No bodies nearby -- look in a slowly rotating direction
      const lookDistance = 100;
      this.lookTarget.set(
        shipPosition.x + Math.cos(this._driftAngle) * lookDistance,
        shipPosition.y + Math.sin(this._driftAngle * 0.3) * lookDistance * 0.2,
        shipPosition.z + Math.sin(this._driftAngle) * lookDistance
      );
      this.offset.set(0, 0, 0);
      return;
    }

    // Look at the target body
    this.lookTarget.copy(target.position);

    // Very gentle offset that rotates around the view axis
    const dist = shipPosition.distanceTo(target.position);
    const maxOffset = Math.min(dist * 0.08, 30); // cap at 30 scene units
    this.offset.set(
      Math.cos(this._driftAngle) * maxOffset,
      Math.sin(this._driftAngle * 0.5) * maxOffset * 0.2,
      Math.sin(this._driftAngle) * maxOffset
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  //  HELPERS
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Update the list of nearby points of interest (bodies within range).
   */
  _updatePOIs(shipPosition) {
    this._pois = [];
    const bodies = this.gravityField.bodies;

    for (let i = 0; i < bodies.length; i++) {
      const body = bodies[i];
      const dist = shipPosition.distanceTo(body.position);
      this._pois.push({ index: i, body, distance: dist });
    }

    // Sort by distance (nearest first)
    this._pois.sort((a, b) => a.distance - b.distance);
  }

  /**
   * Get the nearest body to the ship (excluding bodies at distance 0).
   */
  _getNearestBody(shipPosition) {
    for (const poi of this._pois) {
      if (poi.distance > 0.01) {
        return poi.body;
      }
    }
    return this._pois.length > 0 ? this._pois[0].body : null;
  }

  /**
   * Get background bodies suitable for composition (not the primary body,
   * within reasonable range).
   */
  _getBackgroundBodies(primaryBody, cameraPosition) {
    const backgrounds = [];
    for (const poi of this._pois) {
      if (poi.body === primaryBody) continue;
      if (poi.distance > 0.01) {
        backgrounds.push({
          position: poi.body.position,
          radius: this._estimateBodyRadius(poi.body),
        });
      }
      if (backgrounds.length >= 3) break; // limit to 3 background bodies
    }
    return backgrounds;
  }

  /**
   * Pick a body for SCENIC_DRIFT to slowly frame.
   * Prefers nearby non-star bodies; falls back to the star.
   */
  _pickDriftTarget(shipPosition) {
    // Prefer the nearest non-star body if within reasonable range
    for (const poi of this._pois) {
      if (poi.distance < 0.01) continue;
      if (poi.body.name !== 'star') {
        return poi.body;
      }
    }
    // Fall back to the star
    for (const poi of this._pois) {
      if (poi.distance > 0.01) {
        return poi.body;
      }
    }
    return null;
  }

  /**
   * Estimate a body's visual radius from its data.
   *
   * We don't have direct radius data on the BodyEntry, but we can
   * estimate from the SOI radius (which is proportional to orbit distance
   * and mass ratio). For display, we use a rough heuristic.
   */
  _estimateBodyRadius(body) {
    if (body.name === 'star') {
      // Stars are big -- use a fraction of their first child's SOI
      return body.soiRadius === Infinity ? 50 : body.soiRadius * 0.01;
    }
    // Planets/moons: SOI is much larger than the body.
    // Rough: body radius ~ soiRadius / 100 (very approximate)
    if (body.soiRadius && body.soiRadius !== Infinity) {
      return Math.max(body.soiRadius * 0.01, 0.5);
    }
    return 1; // fallback
  }
}
