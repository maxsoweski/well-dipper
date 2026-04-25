/**
 * AutopilotMotion — V1 per-leg motion evaluator.
 *
 * Replaces `NavigationSubsystem.js` (1117 lines, retired 2026-04-24
 * per Director ruling in the V1 STATION-hold redesign brief at
 * `docs/WORKSTREAMS/autopilot-station-hold-redesign-2026-04-24.md`).
 * The Hermite travel curves, three-target lookAt blends, seam-blend
 * machinery, and orbit-arc math that NavigationSubsystem authored
 * are dead under V1 by construction — `docs/FEATURES/autopilot.md`
 * §"Per-phase criteria — ship axis" (commit `20ef423`) collapses
 * the ship axis to CRUISE → APPROACH → STATION-A.
 *
 * V1 motion model:
 *
 *   - `CRUISE` — aim-once-at-intercept, fly straight. At CRUISE
 *     onset the ship aims at the target body's current position
 *     and writes the resulting forward direction onto the Ship
 *     object. The trajectory does not re-aim mid-flight (V-later
 *     concern only).
 *   - `APPROACH` — hard-onset deceleration when the ship reaches
 *     `10 × body.radius`. No ramp. Cubic-ease-out velocity profile
 *     scrubs cruise velocity to zero over `APPROACH_DURATION_SEC`.
 *   - `STATION-A` — held position, body-locked. Ship pose pinned
 *     to `body.position + holdOffset`; the offset is captured at
 *     STATION-A entry. Orientation re-aimed at body center (the
 *     one orientation discontinuity in the model — both ship and
 *     camera flip together so AC #5's invariant holds). Hold runs
 *     until the auto-advance timer fires (`STATION_HOLD_SEC`).
 *
 * Hold distance is felt-fill-derived per Max's interview Q2:
 * `body.radius / tan(0.30 × FOV)`. At 70° FOV this gives ~2.6×
 * radius — body subtends ~42° vertical, fills ~60% of frame.
 *
 * One-shot signals:
 *
 *   - `motionStarted` — first frame after `beginMotion()`.
 *   - `phaseChanged` — frame the phase enum transitions; use
 *     `prevPhase` + `phase` to discriminate CRUISE-onset (fire
 *     ACCEL shake), APPROACH-onset (fire DECEL shake), and
 *     STATION-A entry.
 *   - `motionComplete` — STATION-A hold timer expired; tour
 *     advance signal for the calling layer (autoNav).
 *
 * Per Principle 5 (Model Produces → Pipeline Carries → Renderer
 * Consumes): this module produces a motion plan + writes ship
 * orientation. It does NOT call `camera.lookAt()`, does NOT
 * touch `camera.quaternion`. The camera-side authoring lives in
 * `FlythroughCamera` + `CameraChoreographer`.
 */

import * as THREE from 'three';

const Phase = Object.freeze({
  IDLE:       'IDLE',
  CRUISE:     'CRUISE',
  APPROACH:   'APPROACH',
  STATION_A:  'STATION-A',
});

// Reusable scratch.
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();

// V1 motion-tunable defaults (Max-tunable per AC #2 / AC #3 within
// the parameter-tune budget; mechanism-class invariants stay).
//
// 10× body radius — Director's authored APPROACH onset rule
// (feature doc §APPROACH; Q4 of the 2026-04-24 interview).
const APPROACH_RADIUS_FACTOR = 10;
// Approach duration in seconds. Hard-onset deceleration; cubic-ease
// scrubs cruise velocity to zero within this window. The stub
// validated this shape at ~1.5–2s; V1 starts at 1.8s for AC #2
// cubic-ease tuning latitude.
const APPROACH_DURATION_SEC = 1.8;
// STATION-A hold duration before auto-advance. Feature doc §STATION-A
// says "held until the next mode activates — manually or
// automatically." V1 implements the "automatically" half with this
// timer. 8s gives Max enough beat to register the hold; tunable
// without scope-widening.
const STATION_HOLD_SEC = 8.0;
// Felt-fill fraction of vertical FOV at STATION-A. Q2 verbatim:
// "the object fills about 60% of the screen." AC #3's bound is
// 0.50–0.70; the seed lands middle.
const FELT_FILL_RATIO = 0.60;
// CRUISE target duration if computed naively from speed. The actual
// cruise duration is determined by initial distance and the cruise
// speed (which is itself derived from the desired total leg length);
// these constants size the result.
const CRUISE_TARGET_SEC = 4.5;
// Cruise duration floor — short legs still take this long.
const CRUISE_MIN_SEC = 2.0;
// Cruise duration ceiling — very long legs cap here.
const CRUISE_MAX_SEC = 12.0;

export class AutopilotMotion {
  constructor() {
    this._phase = Phase.IDLE;
    this._prevPhase = Phase.IDLE;
    this._lastEmittedPhase = Phase.IDLE;

    // ── Target context ──
    this._target = null;          // THREE.Object3D (mesh)
    this._targetRadius = 1;
    this._holdDistance = 1;       // computed at beginMotion() from FOV + radius

    // ── Trajectory state ──
    this._startPos = new THREE.Vector3();
    this._cruiseDir = new THREE.Vector3();   // unit, set at CRUISE onset
    this._approachStartPos = new THREE.Vector3();
    this._holdEndpoint = new THREE.Vector3(); // captured at APPROACH onset
    this._holdOffset = new THREE.Vector3();   // captured at STATION-A entry
    this._cruiseSpeed = 0;
    this._cruiseDistance = 0;     // distance from startPos to approachStart
    this._approachElapsed = 0;
    this._holdTimer = 0;

    // ── Output: position written each frame ──
    this._position = new THREE.Vector3();

    // ── Ship orientation reference (set in beginMotion) ──
    // The autopilot WRITES `_ship.setOrientation(...)` at phase
    // boundaries. The Ship object holds the written orientation
    // until the next write (no per-frame motion-direction
    // derivation — AC #7 contract item 2).
    this._ship = null;

    // ── One-shot signals ──
    this._motionStartPending = false;
    this._motionStartedOneShot = false;
    this._phaseChangedOneShot = false;
    this._motionCompleteOneShot = false;

    // ── Camera FOV reference (for felt-fill hold distance) ──
    // Captured at beginMotion() so the held distance reflects the
    // FOV in effect at that moment. If FOV changes during hold, V1
    // does not re-derive (settings change is not a tour event).
    this._fovRadians = (70 * Math.PI) / 180;  // default; overwritten in beginMotion
  }

  // ── Public surface ──

  get isActive() { return this._phase !== Phase.IDLE; }
  get currentPhase() { return this._phase; }
  /** The body the ship is currently traveling to or holding at. Read-only. */
  get bodyRef() { return this._target; }
  /** Hold distance (at STATION-A); 0 before beginMotion is called. */
  get holdDistance() { return this._holdDistance; }
  /** Body radius at last beginMotion. Reused by main.js telemetry. */
  get bodyRadius() { return this._targetRadius; }

  /**
   * Begin a per-leg motion. Resets state and sizes the trajectory.
   *
   * @param {Object} input
   * @param {THREE.Vector3} input.fromPosition — current ship position (= camera.position).
   * @param {THREE.Object3D} input.toBody       — target body mesh (must have .position; data.radius read separately).
   * @param {number} input.bodyRadius           — target body's radius in scene units.
   * @param {Ship}   input.ship                 — the Ship object whose orientation the autopilot writes.
   * @param {number} [input.fovDegrees=70]      — camera FOV used to compute hold distance.
   */
  beginMotion(input) {
    this._target = input.toBody;
    this._targetRadius = input.bodyRadius || 1;
    this._ship = input.ship || null;
    this._fovRadians = ((input.fovDegrees || 70) * Math.PI) / 180;

    // Hold distance from felt-fill: 2 atan(r / d) = ratio × FOV → d = r / tan(0.5 × ratio × FOV)
    this._holdDistance = this._targetRadius / Math.tan(0.5 * FELT_FILL_RATIO * this._fovRadians);

    // Capture trajectory anchors. Aim once at the body's current
    // position; the trajectory does not re-aim mid-flight (V1
    // canonical aim-once-at-intercept rule, feature doc §CRUISE).
    this._startPos.copy(input.fromPosition);
    const targetPos = this._target.position;

    // Cruise direction = unit vector from startPos toward target.
    _v1.subVectors(targetPos, this._startPos);
    const totalDistToBody = _v1.length();
    if (totalDistToBody < 1e-6) {
      // Already at the body. Skip cruise + approach; go straight to
      // STATION-A. Edge case for back-to-back beginMotion calls or
      // legs starting essentially on top of the next subject.
      this._enterStationA(targetPos);
      return;
    }
    this._cruiseDir.copy(_v1).divideScalar(totalDistToBody);

    // Approach onset = point on the cruise line at 10R from body.
    // approachStart = body.position - cruiseDir × (10R)  [NOTE: cruiseDir points TOWARD body]
    const approachRadius = this._targetRadius * APPROACH_RADIUS_FACTOR;
    this._approachStartPos.copy(targetPos)
      .addScaledVector(this._cruiseDir, -approachRadius);

    // Cruise distance = how far the ship travels during CRUISE
    // before APPROACH onset.
    this._cruiseDistance = this._startPos.distanceTo(this._approachStartPos);
    if (this._cruiseDistance < 1e-3) {
      // Already inside the 10R sphere. Skip cruise; go directly to
      // APPROACH from current position.
      this._enterApproach(this._startPos);
      this._motionStartPending = true;
      return;
    }

    // Cruise speed sized to hit a target total leg duration.
    const targetDuration = Math.max(
      CRUISE_MIN_SEC,
      Math.min(CRUISE_MAX_SEC, CRUISE_TARGET_SEC * Math.sqrt(this._cruiseDistance / 1000)),
    );
    this._cruiseSpeed = this._cruiseDistance / targetDuration;

    // Set ship forward at CRUISE onset — aim-once write per AC #1.
    if (this._ship) {
      this._ship.setOrientation(this._cruiseDir);
    }

    this._position.copy(this._startPos);
    this._phase = Phase.CRUISE;
    this._motionStartPending = true;
    this._approachElapsed = 0;
    this._holdTimer = 0;
  }

  /**
   * Per-frame update. Returns the motion plan for this frame.
   *
   * @param {number} deltaTime
   * @returns {Object}
   */
  update(deltaTime) {
    // Clear one-shots from previous frame.
    this._motionStartedOneShot = this._motionStartPending;
    this._motionStartPending = false;
    this._phaseChangedOneShot = (this._phase !== this._lastEmittedPhase);
    this._prevPhase = this._lastEmittedPhase;
    this._lastEmittedPhase = this._phase;
    this._motionCompleteOneShot = false;

    if (this._phase === Phase.IDLE) {
      return this._emitFrame();
    }

    switch (this._phase) {
      case Phase.CRUISE:    this._tickCruise(deltaTime);    break;
      case Phase.APPROACH:  this._tickApproach(deltaTime);  break;
      case Phase.STATION_A: this._tickStationA(deltaTime);  break;
    }

    return this._emitFrame();
  }

  /** Stop the autopilot motion. Returns to IDLE. */
  stop() {
    this._phase = Phase.IDLE;
    this._target = null;
    this._motionStartPending = false;
  }

  // ── Internal: phase tickers ──

  _tickCruise(deltaTime) {
    // Linear translate along cruise direction.
    const distThisFrame = this._cruiseSpeed * deltaTime;
    this._position.addScaledVector(this._cruiseDir, distThisFrame);

    // APPROACH-onset gate. Primary rule (AC #2): distance to body ≤
    // 10R (feature doc §APPROACH). Fallback: ship has traveled the
    // planned cruise distance — handles the case where the body
    // drifts laterally during cruise (V1 aim-once-at-intercept rule
    // does not re-aim) and the ship misses the 10R sphere on the
    // initial trajectory. Without this fallback, missed-sphere legs
    // sit in CRUISE indefinitely. Director-named drift-risk-class:
    // "drift-from-aim-once" — V1 acceptable as a guard, V-later
    // proper fix is per-frame re-aim or predicted-intercept.
    _v1.subVectors(this._target.position, this._position);
    const distToBody = _v1.length();
    const approachRadius = this._targetRadius * APPROACH_RADIUS_FACTOR;
    const distTraveled = this._startPos.distanceTo(this._position);
    if (distToBody <= approachRadius || distTraveled >= this._cruiseDistance) {
      this._enterApproach(this._position);
    }
  }

  _enterApproach(positionAtOnset) {
    // Capture approach trajectory: from current position, decelerate
    // to holdEndpoint over APPROACH_DURATION_SEC. holdEndpoint is
    // the body's CURRENT position + holdDistance × cruiseDir-reverse.
    this._approachStartPos.copy(positionAtOnset);
    _v2.subVectors(this._target.position, positionAtOnset).normalize();
    // Approach direction from current position toward body. Use this
    // for hold endpoint computation. (Since trajectory continues
    // along cruiseDir, the two should match closely; difference is
    // body drift during cruise — small at realistic speeds.)
    this._holdEndpoint.copy(this._target.position).addScaledVector(_v2, -this._holdDistance);
    this._approachElapsed = 0;
    this._phase = Phase.APPROACH;
    // ship.forward already pointing along cruiseDir (set at CRUISE
    // onset); APPROACH inherits — same trajectory line, no re-aim
    // (AC #1 path-linearity).
  }

  _tickApproach(deltaTime) {
    this._approachElapsed += deltaTime;
    const t = Math.min(1, this._approachElapsed / APPROACH_DURATION_SEC);
    // Cubic ease-out: position progresses fast then slow → high
    // initial velocity decelerating to zero. p(t) = 1 - (1-t)³.
    const eased = 1 - Math.pow(1 - t, 3);
    this._position.lerpVectors(this._approachStartPos, this._holdEndpoint, eased);

    if (t >= 1) {
      this._enterStationA(this._target.position);
    }
  }

  _enterStationA(bodyPos) {
    // Capture body-relative offset at the moment of entry. From now
    // on, position = body.position + holdOffset (body-locked hold).
    // If there's a slight discrepancy between current position and
    // (body + holdEndpoint-style offset), the offset captures the
    // current geometric reality so there's no snap.
    _v1.subVectors(this._position, bodyPos);
    const len = _v1.length();
    if (len < 1e-6) {
      // Degenerate; use cruiseDir reversed × holdDistance as a
      // sane default offset.
      _v1.copy(this._cruiseDir).multiplyScalar(-this._holdDistance);
    } else if (len < this._holdDistance * 0.5 || len > this._holdDistance * 1.5) {
      // Re-anchor to exact holdDistance along current direction
      // (handles edge cases like beginMotion already inside 10R or
      // approach overshoot from numerical artifacts). One-frame
      // small snap; body-lock holds stable from here.
      _v1.divideScalar(len).multiplyScalar(this._holdDistance);
    }
    this._holdOffset.copy(_v1);
    this._position.copy(bodyPos).add(this._holdOffset);

    // Re-aim ship.forward at body center for the held pose.
    // Camera will follow ship.forward (AC #5), so this is the one
    // orientation update on the leg after CRUISE-onset.
    if (this._ship) {
      _v2.subVectors(bodyPos, this._position).normalize();
      this._ship.setOrientation(_v2);
    }

    this._phase = Phase.STATION_A;
    this._holdTimer = 0;
  }

  _tickStationA(deltaTime) {
    // Body-relative hold. Camera/ship moves with body.
    this._position.copy(this._target.position).add(this._holdOffset);
    // Re-aim each frame at body's current position. Body-locked
    // means body is at constant offset from us, so the direction
    // stays the same; this write is mathematically a no-op but
    // keeps the contract explicit (orientation IS settable each
    // frame — re-asserting it is fine and guards against external
    // writes drifting the orientation).
    if (this._ship) {
      _v2.subVectors(this._target.position, this._position).normalize();
      this._ship.setOrientation(_v2);
    }
    this._holdTimer += deltaTime;
    if (this._holdTimer >= STATION_HOLD_SEC) {
      this._motionCompleteOneShot = true;
      this._phase = Phase.IDLE;
    }
  }

  _emitFrame() {
    return {
      position: this._position,
      phase: this._phase,
      prevPhase: this._prevPhase,
      motionStarted: this._motionStartedOneShot,
      phaseChanged: this._phaseChangedOneShot,
      motionComplete: this._motionCompleteOneShot,
    };
  }
}
