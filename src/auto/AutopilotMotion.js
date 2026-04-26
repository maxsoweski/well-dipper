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
  // Camera-convergence beat between STATION-A and CRUISE. Ship is
  // stationary at the STATION-A position; camera rotates from
  // old-target-direction toward new-target-direction. CRUISE begins
  // only after the camera is centered on the new target. Lowercase
  // 'lhokon' preserved verbatim per the 2026-04-25 amendment.
  LHOKON:     'lhokon',
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
// lhokon dot-gate threshold (per amendment 2026-04-25 §"CRUISE-entry
// gate"). When the camera's authored look direction reaches this
// dot-product with the unit vector toward the new target's current
// position, lhokon completes and CRUISE begins. Default matches AC
// #5a's bound; PM-tunable to 0.99996 if APPROACH-side FP precision
// needs the relaxation pathway from AC #5b.
const LHOKON_DOT_THRESHOLD = 0.9999;
// lhokon timeout (per amendment 2026-04-25 §"CRUISE-entry gate"). If
// the dot-gate hasn't fired by this elapsed time, lhokon exits on
// timeout — safety net against degenerate-geometry hangs (near-
// antiparallel start/end directions). Telemetry pipeline records a
// lhokon_timeout flag; firing under realistic conditions is a flag
// for feature-doc review, not an automatic AC failure.
const LHOKON_TIMEOUT_SEC = 1.5;

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
    // The autopilot WRITES `_ship.setOrientation(...)` each frame
    // during CRUISE under the §A4 redesign (predicted-intercept
    // re-aim). Camera no longer reads ship.forward; the shake
    // module is the only consumer (AC #7 with consumer-set narrowed).
    this._ship = null;

    // ── Body velocity callback (§A4 predicted-intercept solver) ──
    // Returns the autopilot target's world-frame velocity. Set per
    // beginMotion. Analytical (Path A): orbital model exposes
    // r·ω·tangent for planets and parent_velocity + r·ω·tangent for
    // moons. main.js wires this. If null, solver falls back to
    // aim-at-body's-current-position (AC #5b graceful fallback).
    this._getBodyVelocity = null;
    this._velocityScratch = new THREE.Vector3();

    // ── One-shot signals ──
    this._motionStartPending = false;
    this._motionStartedOneShot = false;
    this._phaseChangedOneShot = false;
    this._motionCompleteOneShot = false;
    // Fires once per leg when STATION-A's hold timer expires.
    // Stays in Phase.STATION_A until the external caller invokes
    // beginMotion() for the next leg; that call detects the
    // station-hold-complete flag and transitions to LHOKON.
    this._stationHoldComplete = false;

    // ── Camera authoring (V1 §A4 + 2026-04-25 lhokon amendment) ──
    // The autopilot is now the single source of truth for the
    // camera's authored look direction. CameraChoreographer reads
    // motionFrame.cameraLookDir and applies it directly. During
    // CRUISE/APPROACH/STATION-A this equals unit(target.position −
    // ship.position) — the pursuit-curve direction. During LHOKON
    // this is the in-flight nlerp output from old-direction toward
    // new-direction, smoothly converging to the new pursuit-curve
    // direction over LHOKON_TIMEOUT_SEC.
    this._cameraLookDir = new THREE.Vector3(0, 0, -1);
    // Captured once at lhokon onset — direction the camera was
    // pointing on the last STATION-A frame. nlerp source.
    this._lhokonStartLookDir = new THREE.Vector3(0, 0, -1);
    // Anchor position for lhokon — captured at lhokon onset, held
    // throughout. AC #13 enforces |ship.velocity| ≈ 0 during lhokon
    // by having _tickLhokon NOT write _position.
    this._lhokonAnchorPos = new THREE.Vector3();
    this._lhokonElapsed = 0;
    this._lhokonTimeoutFlag = false;

    // Instance-tunable lhokon parameters. Defaults match production
    // (the module-level constants above); the autopilot-lab.html harness
    // mutates these live to A/B different felt-experience configurations
    // without rebuilding. AC bounds (#12 dot-gate, #14 boundary continuity)
    // hold for any sane combination, but felt-experience tuning is Max's
    // call. If Max picks different defaults, update LHOKON_DOT_THRESHOLD /
    // LHOKON_TIMEOUT_SEC / the smoothstep curve below to match — this
    // surface is for iteration, not for permanent runtime overrides.
    this.lhokonDotThreshold = LHOKON_DOT_THRESHOLD;
    this.lhokonTimeoutSec = LHOKON_TIMEOUT_SEC;
    // Ease curve: takes raw progress t ∈ [0, 1], returns eased ∈ [0, 1].
    // Default = smoothstep (slope 0 at both boundaries — AC #14 by
    // construction). Lab swaps in cubic-ease-out / sinusoidal / etc.
    this.lhokonEaseFn = (t) => t * t * (3 - 2 * t);

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
   * @param {Function} [input.getBodyVelocity]  — () => Vector3, body's world-frame velocity. §A4 predicted-intercept solver. Null → aim-at-current-position fallback.
   */
  beginMotion(input) {
    // Inter-leg detection (per amendment 2026-04-25 §"In scope" —
    // smoothing migration from CRUISE-entry to lhokon). If a target
    // was already set and the motion is currently parked at STATION-A
    // (timer elapsed), this beginMotion is the next leg's call.
    // Route through lhokon instead of direct CRUISE so the camera
    // converges on the new target while the ship stays put.
    const isInterLegSwap = (this._target !== null && this._phase === Phase.STATION_A);
    if (isInterLegSwap) {
      // Capture pre-swap look direction (current authored value)
      // and current world-space position as lhokon anchors. _position
      // here is the body-locked STATION-A pose for the OLD target;
      // we freeze it in world space for the lhokon duration so the
      // ship is genuinely stationary (AC #13).
      this._lhokonStartLookDir.copy(this._cameraLookDir);
      this._lhokonAnchorPos.copy(this._position);
    }

    this._target = input.toBody;
    this._targetRadius = input.bodyRadius || 1;
    this._ship = input.ship || null;
    // Velocity callback is persistent across legs — main.js binds
    // once at init via direct assignment. Only overwrite when the
    // caller explicitly passes one in (per-leg override path).
    if (input.getBodyVelocity) {
      this._getBodyVelocity = input.getBodyVelocity;
    }
    this._fovRadians = ((input.fovDegrees || 70) * Math.PI) / 180;

    // Hold distance from felt-fill: 2 atan(r / d) = ratio × FOV → d = r / tan(0.5 × ratio × FOV)
    this._holdDistance = this._targetRadius / Math.tan(0.5 * FELT_FILL_RATIO * this._fovRadians);

    // Cruise prep is computed from the actual start of CRUISE motion.
    // For an initial leg, that's input.fromPosition. For an inter-leg
    // swap, the ship doesn't move during lhokon — so CRUISE begins
    // from the lhokon anchor. (The fromPosition value passed in for
    // an inter-leg call should equal _position anyway, but the
    // anchor is the authoritative source.)
    const cruiseStartPos = isInterLegSwap ? this._lhokonAnchorPos : input.fromPosition;
    this._startPos.copy(cruiseStartPos);
    const targetPos = this._target.position;

    // Initial cruise direction = unit vector from cruiseStartPos
    // toward target's current position. Per-frame re-aim updates
    // this each tick (§A4 mechanism). Sized at beginMotion only for
    // cruise-distance + cruise-speed computation.
    _v1.subVectors(targetPos, this._startPos);
    const totalDistToBody = _v1.length();
    if (totalDistToBody < 1e-6) {
      this._enterStationA(targetPos);
      return;
    }
    this._cruiseDir.copy(_v1).divideScalar(totalDistToBody);

    const approachRadius = this._targetRadius * APPROACH_RADIUS_FACTOR;
    this._approachStartPos.copy(targetPos)
      .addScaledVector(this._cruiseDir, -approachRadius);
    this._cruiseDistance = this._startPos.distanceTo(this._approachStartPos);
    if (this._cruiseDistance < 1e-3) {
      this._enterApproach(this._startPos);
      this._motionStartPending = true;
      return;
    }

    const targetDuration = Math.max(
      CRUISE_MIN_SEC,
      Math.min(CRUISE_MAX_SEC, CRUISE_TARGET_SEC * Math.sqrt(this._cruiseDistance / 1000)),
    );
    this._cruiseSpeed = this._cruiseDistance / targetDuration;

    // Initial ship.forward = aim toward target's current position.
    // _tickCruise re-aims per frame at predicted intercept (§A4).
    // Note: during LHOKON, this orientation is the pre-converged
    // aim — the camera is rotating independently to converge on the
    // new target. Ship orientation is reasserted per frame.
    if (this._ship) {
      this._ship.setOrientation(this._cruiseDir);
    }

    if (isInterLegSwap) {
      // Enter lhokon. Ship anchored in world space; camera rotates.
      // _position stays at the lhokon anchor; _tickLhokon does NOT
      // write _position (AC #13). Cruise prep above is staged for
      // _exitLhokonToCruise() to consume on completion.
      this._lhokonElapsed = 0;
      this._lhokonTimeoutFlag = false;
      this._stationHoldComplete = false;
      this._phase = Phase.LHOKON;
      // Don't fire motionStartPending until CRUISE actually begins
      // (shake module fires ACCEL on motionStarted/CRUISE-onset; that
      // should remain anchored to the ship-burn boundary, not the
      // camera-convergence boundary).
    } else {
      // Initial leg. Existing flow.
      this._position.copy(this._startPos);
      this._phase = Phase.CRUISE;
      this._motionStartPending = true;
      this._approachElapsed = 0;
      this._holdTimer = 0;
    }
  }

  /**
   * Solve predicted-intercept time t. Closed-form quadratic per
   * Director audit §A4: |R + V·t|² = (s·t)².
   *   (V·V - s²)·t² + 2(R·V)·t + R·R = 0
   *
   * @param {THREE.Vector3} R — body.position - ship.position
   * @param {THREE.Vector3} V — body.velocity (world frame)
   * @param {number}        s — ship cruise speed (scalar)
   * @returns {number} t — predicted intercept time. Returns -1 if
   *   unreachable (discriminant < 0 or no positive root) — caller
   *   treats as fallback (aim at body's current position).
   */
  _solveInterceptTime(R, V, s) {
    const a = V.dot(V) - s * s;
    const b = 2 * R.dot(V);
    const c = R.dot(R);
    if (Math.abs(a) < 1e-9) {
      // Degenerate: linear in t. b·t + c = 0 → t = -c/b.
      if (Math.abs(b) < 1e-9) return -1;
      const tLin = -c / b;
      return tLin > 0 ? tLin : -1;
    }
    const disc = b * b - 4 * a * c;
    if (disc < 0) return -1;
    const sqrtDisc = Math.sqrt(disc);
    const t1 = (-b - sqrtDisc) / (2 * a);
    const t2 = (-b + sqrtDisc) / (2 * a);
    if (t1 > 0 && t2 > 0) return Math.min(t1, t2);
    if (t1 > 0) return t1;
    if (t2 > 0) return t2;
    return -1;
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
      case Phase.LHOKON:    this._tickLhokon(deltaTime);    break;
    }

    return this._emitFrame();
  }

  /** Stop the autopilot motion. Returns to IDLE. */
  stop() {
    this._phase = Phase.IDLE;
    this._target = null;
    this._motionStartPending = false;
    this._stationHoldComplete = false;
    this._lhokonElapsed = 0;
    this._lhokonTimeoutFlag = false;
  }

  // ── Internal: phase tickers ──

  _tickCruise(deltaTime) {
    // Per-frame pursuit re-aim. Each frame: aim ship at body's
    // current position; translate along that direction. Per-frame
    // movement is CAPPED to (distToBody - approachRadius) so ship
    // cannot overshoot the approach sphere, even for tiny bodies
    // where cruiseSpeed × dt would naively exceed the entire 10R
    // gap in one frame. Without this cap, ship blows past the body
    // and the camera direction flips 180° at APPROACH onset.
    const bodyPos = this._target.position;
    const shipPos = this._position;
    _v1.subVectors(bodyPos, shipPos);
    const distToBody = _v1.length();
    const approachRadius = this._targetRadius * APPROACH_RADIUS_FACTOR;

    if (distToBody < 1e-6 || distToBody <= approachRadius) {
      this._enterApproach(this._position);
      return;
    }
    _v1.divideScalar(distToBody);  // _v1 is now the unit aim direction

    if (this._ship) {
      this._ship.setOrientation(_v1);
    }
    this._cruiseDir.copy(_v1);

    // Cap movement so we land at most exactly at the approach radius.
    const wantMove = this._cruiseSpeed * deltaTime;
    const maxMove = distToBody - approachRadius;
    const actualMove = Math.min(wantMove, maxMove);
    this._position.addScaledVector(_v1, actualMove);

    // §T2 fix: camera-authored direction must be sourced from the
    // ship's POST-MOVE position, not pre-move. Camera reads
    // motionFrame.position (= post-move _position) and
    // motionFrame.cameraLookDir each frame; if cameraLookDir is
    // computed from pre-move geometry, the camera's direction lags
    // the camera's position by `displacement / distance`. Catches
    // on small-body APPROACH where displacement/dist is large.
    // AC #5a's `dot ≥ 0.9999` requires the post-move pursuit-curve
    // direction. Ship-axis `_v1` (orientation, _cruiseDir) is
    // intentionally pre-move per §A4 (re-aim toward where the body
    // IS, then traverse along that aim).
    _v2.subVectors(this._target.position, this._position);
    const postMoveDist = _v2.length();
    if (postMoveDist > 1e-6) {
      this._cameraLookDir.copy(_v2).divideScalar(postMoveDist);
    } else {
      this._cameraLookDir.copy(_v1);
    }

    // APPROACH-onset gate. We hit it if movement was capped by the
    // approach radius, OR by the cruise-distance ceiling fallback.
    const distTraveled = this._startPos.distanceTo(this._position);
    if (actualMove >= maxMove - 1e-9 || distTraveled >= this._cruiseDistance) {
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

    // §A7 fix: re-derive _holdEndpoint each frame from body's
    // CURRENT position. Original §A4 captured _holdEndpoint at
    // APPROACH onset; for fast-orbiting moons the body drifts
    // during the 1.8s approach, causing the lerp to land at a stale
    // position (AC #1 overshoot up to 7%). Re-deriving each frame
    // makes the endpoint track the moving body. Direction (body -
    // ship's current position) is recomputed so the ship pursues.
    _v2.subVectors(this._target.position, this._position);
    const dlen = _v2.length();
    if (dlen > 1e-6) {
      _v2.divideScalar(dlen);
      this._holdEndpoint.copy(this._target.position).addScaledVector(_v2, -this._holdDistance);
    }
    this._position.lerpVectors(this._approachStartPos, this._holdEndpoint, eased);

    // §T2 fix: source camera-authored direction from POST-MOVE
    // position. APPROACH compresses ship-to-body distance over its
    // duration; pre-move source produced angular lag that AC #5a
    // caught (worst case ~4.3° at sub-0.015u distances). The
    // _holdEndpoint computation above intentionally still uses
    // pre-move geometry to plan the deceleration trajectory; only
    // the camera's authored direction is post-move.
    _v2.subVectors(this._target.position, this._position);
    const postMoveDist = _v2.length();
    if (postMoveDist > 1e-6) {
      this._cameraLookDir.copy(_v2).divideScalar(postMoveDist);
    }

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
    _v2.subVectors(this._target.position, this._position).normalize();
    if (this._ship) {
      this._ship.setOrientation(_v2);
    }
    this._cameraLookDir.copy(_v2);
    this._holdTimer += deltaTime;
    // STATION-A → motionComplete fires ONCE when the hold timer
    // expires. Phase stays STATION_A; the external caller (autoNav)
    // sees motionComplete and invokes beginMotion() for the next
    // leg, which detects this state and routes through LHOKON.
    // _stationHoldComplete prevents the one-shot from re-firing
    // each frame after the timer expires.
    if (this._holdTimer >= STATION_HOLD_SEC && !this._stationHoldComplete) {
      this._motionCompleteOneShot = true;
      this._stationHoldComplete = true;
    }
  }

  /**
   * lhokon — camera-convergence beat between STATION-A and CRUISE
   * (per amendment 2026-04-25 §"In scope"). Ship is anchored in
   * world space (AC #13: |ship.velocity| ≈ 0). Camera direction is
   * a normalized lerp from `_lhokonStartLookDir` (last STATION-A
   * frame) toward the unit vector pointing at the new target's
   * current position. End-direction is re-derived each frame so
   * the lerp tracks an orbiting body. Cubic ease-out on lerp
   * progress matches the prior in-CRUISE smoothing curve.
   *
   * Exit: dot-gate primary (≥ LHOKON_DOT_THRESHOLD), timeout
   * fallback (≥ LHOKON_TIMEOUT_SEC). Per amendment §"CRUISE-entry
   * gate" option (c).
   */
  _tickLhokon(deltaTime) {
    this._lhokonElapsed += deltaTime;

    // _position stays at the lhokon anchor — write it explicitly so
    // any external mutation between frames is corrected. AC #13's
    // bound is `|ship.position − ship.position_at_lhokon_onset| ≤
    // 0.0001`; this assignment makes the bound exact.
    this._position.copy(this._lhokonAnchorPos);

    // End direction: unit vector from anchor toward new target's
    // current position. Re-derived each frame to track orbital
    // motion of the new body.
    _v1.subVectors(this._target.position, this._position);
    const tgtLen = _v1.length();
    if (tgtLen > 1e-6) {
      _v1.divideScalar(tgtLen);
    } else {
      _v1.set(0, 0, -1);
    }

    // Ease progress is computed from instance-tunable timeout +
    // ease-curve. Default smoothstep `t² × (3−2t)` has slope 0 at
    // BOTH boundaries by construction, satisfying AC #14 entry AND
    // exit continuity (§T2 caught that cubic-ease-out had slope 3
    // at t=0, blowing AC #14's 0.5° entry bound for swaps > ~15°).
    // The lab harness can swap in cubic-out / sinusoidal / etc. to
    // A/B felt experience.
    const t = Math.min(1, this._lhokonElapsed / this.lhokonTimeoutSec);
    const eased = this.lhokonEaseFn(t);

    // Normalized lerp from start direction toward end direction.
    // Use _v2 as scratch so we can both compute the lerp output and
    // dot it against _v1 (the end direction) without aliasing.
    _v2.copy(this._lhokonStartLookDir).lerp(_v1, eased);
    const len = _v2.length();
    if (len > 1e-6) {
      _v2.divideScalar(len);
    } else {
      _v2.copy(_v1);
    }
    this._cameraLookDir.copy(_v2);

    // Reassert ship orientation each frame so external readers
    // (shake) have a stable forward axis. Anchor it on the cruise
    // direction we computed at lhokon onset; ship doesn't burn yet.
    if (this._ship) {
      this._ship.setOrientation(this._cruiseDir);
    }

    // Exit gates.
    const dot = _v2.dot(_v1);
    if (dot >= this.lhokonDotThreshold) {
      this._exitLhokonToCruise(_v1);
      return;
    }
    if (this._lhokonElapsed >= this.lhokonTimeoutSec) {
      this._lhokonTimeoutFlag = true;
      // Snap to the perfect end direction so AC #5a's first CRUISE
      // frame passes by construction. AC #14's exit-continuity bound
      // (≤ 0.5°) is preserved because the ease-out has driven the
      // lerp output to within FP-noise of _v1 by t=1 anyway; the
      // snap is a numerical clean-up, not a visible jump.
      this._cameraLookDir.copy(_v1);
      this._exitLhokonToCruise(_v1);
      return;
    }
  }

  /**
   * Transition LHOKON → CRUISE. Called from _tickLhokon when one of
   * the two exit gates fires. The cruise prep state (_startPos,
   * _cruiseDir, _cruiseDistance, _cruiseSpeed, _approachStartPos)
   * was staged in beginMotion() at lhokon onset; this method just
   * flips the phase and fires the motionStart one-shot so the shake
   * module's CRUISE-onset event lands on the actual ship-burn frame.
   *
   * @param {THREE.Vector3} finalDir — the unit dir-to-target on the
   *   exit frame. Used to refresh _cruiseDir so the first CRUISE
   *   tick begins from the converged direction (mostly a no-op
   *   since _tickCruise re-derives every frame, but explicit here
   *   for AC #14 exit continuity).
   */
  _exitLhokonToCruise(finalDir) {
    this._cruiseDir.copy(finalDir);
    if (this._ship) {
      this._ship.setOrientation(finalDir);
    }
    this._phase = Phase.CRUISE;
    this._motionStartPending = true;
    this._approachElapsed = 0;
    this._holdTimer = 0;
  }

  _emitFrame() {
    return {
      position: this._position,
      phase: this._phase,
      prevPhase: this._prevPhase,
      motionStarted: this._motionStartedOneShot,
      phaseChanged: this._phaseChangedOneShot,
      motionComplete: this._motionCompleteOneShot,
      // §A4: camera reads target body's current position (pursuit-
      // curve), no longer derived from ship.forward.
      target: this._target,
      // 2026-04-25 lhokon amendment: autopilot is the single source
      // of truth for camera authored direction. CameraChoreographer
      // applies camPos + cameraLookDir × tgtLen each frame. Always
      // a unit vector. During LHOKON this is the in-flight nlerp
      // output; during all other phases it equals the pursuit-curve
      // direction (= unit(target.position − position)).
      cameraLookDir: this._cameraLookDir,
      // Telemetry-only — surfaces the lhokon timer + timeout flag
      // for AC #11 / #12 / #13 / #14 verification harnesses.
      lhokonElapsed: this._lhokonElapsed,
      lhokonTimeoutFlag: this._lhokonTimeoutFlag,
    };
  }
}
