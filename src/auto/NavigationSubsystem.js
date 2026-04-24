import * as THREE from 'three';
import { VelocityBlend } from './VelocityBlend.js';

/**
 * NavigationSubsystem — produces motion plans for moving the ship toward a
 * target body and holding a stable orbit around it.
 *
 * Split from FlythroughCamera 2026-04-20 per WS 1 of the V1 autopilot
 * sequence (docs/WORKSTREAMS/autopilot-navigation-subsystem-split-2026-04-20.md).
 * The subsystem owns: position, velocity, Hermite-curve travel math, orbit
 * arc math, approach close-in math, descend path math, and the target-look
 * point produced by travel's three-target weighted blend. The camera module
 * consumes MotionFrame output (position + lookAtTarget) and authors
 * orientation (yaw/pitch/quaternion slerp/free-look/FOV) against it.
 *
 * Director sanity-check (same session, post-draft): one entry method
 * `beginMotion`, internal phase sequencing only, zero camera-ward references
 * (no `camera.quaternion`/`camera.lookAt`/`freeLook`). §10.3 invariant —
 * autopilot and manual-burn both pass through the same API. Four decisions
 * recorded:
 *   - `fromOrbitState` dropped: subsystem owns orbit state internally.
 *   - `warpExit` / `descentVector`: input-condition names, not behaviors.
 *   - `arrivalOptions`: separate bools (`holdOnly`, `slowOrbit`, `orbitDuration`),
 *     no `mode` enum (preserves slow-cinematic-not-held combo).
 *   - `abruptness`: V1 emits 0.0; V2 wires d²x/dt² math (§10.8 consumer).
 *
 * @typedef {Object} MotionFrame
 * @property {THREE.Vector3} position      — ship position this frame
 * @property {THREE.Vector3} velocity      — ship velocity this frame
 * @property {THREE.Vector3} lookAtTarget  — camera-module-consumed look point
 * @property {string} phase                — 'idle'|'descending'|'traveling'|'approaching'|'orbiting'
 * @property {boolean} motionStarted       — one-shot: first update() after beginMotion
 * @property {boolean} travelComplete      — one-shot: travel just ended
 * @property {boolean} orbitComplete       — one-shot: orbit cycle just ended
 * @property {boolean} targetingReady      — one-shot: ~4s before orbit end
 * @property {number} abruptness           — V1 = 0.0; V2 consumer of §10.8 shake
 * @property {boolean} isShortTrip         — true for legs below the short/long distance threshold
 * @property {boolean} warpExit            — true if this leg is the 3s warp-exit coast
 * @property {THREE.Vector3} shipVelocity  — per-frame ΔP/Δt, for continuity-workstream AC #7 telemetry
 * @property {boolean} velocityBlendActive — live-feedback loop (b): true while a seam's velocity blend is mid-window
 *
 * Public property `rotBlendDuration` is set per motion start. Camera reads
 * it to time its own orientation slerp from pre-motion quaternion → lookAt-
 * driven orientation. Tour departure (has lookback) = 1s; warp/manual burn
 * = proportional to travel duration, capped at 2.5s.
 */

// Internal phase enum (subsystem-private; never exposed in public API).
const Phase = { IDLE: 0, DESCENDING: 1, TRAVELING: 2, APPROACHING: 3, ORBITING: 4 };

// Reusable vectors to avoid per-frame allocations
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _v4 = new THREE.Vector3();
const _v5 = new THREE.Vector3();
const _v6 = new THREE.Vector3();

export class NavigationSubsystem {
  constructor() {
    this._phase = Phase.IDLE;

    // ── Current target context ──
    this.bodyRef = null;           // THREE.Object3D of body we're moving to / orbiting
    this.bodyRadius = 1;
    this.orbitDistance = 10;

    // Next target context (for departure-aligned orbit)
    this.nextBodyRef = null;
    this.nextOrbitDistance = 10;

    // ── Output: MotionFrame fields, updated each update(dt) call ──
    this._position = new THREE.Vector3();
    this._velocity = new THREE.Vector3();
    this._lookAtTarget = new THREE.Vector3();
    this._motionStartedOneShot = false;
    this._motionStartPending = false;
    this._travelCompleteOneShot = false;
    this._orbitCompleteOneShot = false;
    this._targetingReadyOneShot = false;
    this._abruptness = 0;

    // Public property: orientation-blend duration hint for camera module.
    // Set per motion in _beginTravel / _beginDescend based on trip profile.
    this.rotBlendDuration = 1.0;

    // ── ORBIT state ──
    this.orbitYaw = 0;
    this.orbitPitch = 0.2;
    this.orbitDirection = 1;
    this.orbitYawSpeed = 0.3;
    this.orbitPitchPhase = 0;
    this.orbitDistBase = 10;
    this.orbitDistPhase = 0;
    this.orbitElapsed = 0;
    this.orbitDuration = 15;
    this._entryPitch = 0.15;
    this._entryDist = 10;
    this._orbitSpeedScale = 1.0;
    this._holdOnly = false;
    this._targetingSignaled = false;
    this._orbitStartYaw = 0;

    // ── TRAVEL state ──
    this.travelElapsed = 0;
    this.travelDuration = 10;
    this.departurePos = new THREE.Vector3();
    this.departureDir = new THREE.Vector3();
    this._departureTangent = new THREE.Vector3();
    this._departTangentScaled = new THREE.Vector3();
    this._arrivalTangentScaled = new THREE.Vector3();
    this._hermiteStartPos = new THREE.Vector3();
    this._isShortTrip = false;
    this._nearbyDeparture = false;
    this._arrivalOrbitDir = null;
    this._travelFromBody = null;
    this._travelToBody = null;
    this._travelToRadius = 1;
    this._travelToOrbitDist = 10;
    this._currentDist = 10;
    this._warpArrival = false;
    this._telemetry = null;

    // Arrival blend state (Hermite → pre-orbit)
    this._arrivalComputed = false;
    this._arrivalYaw = 0;
    this._arrivalDist = 10;
    this._arrivalPitch = 0.15;
    this._arrivalCaptureDir = 1;
    this._arrivalYawSpeed = 0.3;

    // ── APPROACH state ──
    this._approachElapsed = 0;
    this._approachPauseDur = 1.5;
    this._approachCloseDur = 3.0;
    this._approachStartDist = 10;
    this._approachTargetDist = 5;
    this._approachBodyRef = null;
    this._approachBodyRadius = 1;
    this._approachOrbitDist = 10;
    this._approachOrbitDuration = 75;
    this._approachInitialDir = new THREE.Vector3();
    this._approachHoldOnly = false;

    // ── DESCEND state ──
    this.descendStart = new THREE.Vector3();
    this.descendElapsed = 0;
    this.descendDuration = 10;

    // ── Pending arrival spec (applied at internal phase transitions) ──
    this._pendingArrival = null;

    // ──────────────────────────────────────────────────────────────
    //  Phase-transition velocity continuity (continuity workstream
    //  2026-04-23). Three seams — STATION→CRUISE, TRAVEL→APPROACH,
    //  APPROACH→ORBIT — share one VelocityBlend helper. Each seam
    //  captures its leaving-phase terminal velocity, and the entering
    //  phase's update applies a position-space lerp from "captured
    //  velocity extrapolation" toward "natural phase formula" over
    //  the blend window. At blend end, the phase authors unblended.
    // ──────────────────────────────────────────────────────────────
    this._velocityBlend = new VelocityBlend();
    // Position at seam entry, needed as the anchor for the blend-position
    // formula during the blend window.
    this._seamEntryPosition = new THREE.Vector3();
    // Previous-frame position + delta-time (legacy — kept for terminal-velocity
    // computation; the live-feedback workstream's loop (b) does NOT consume it).
    this._prevPosition = new THREE.Vector3();
    this._prevDeltaTime = 1 / 60;
    // When true, a seam-1 (STATION→CRUISE) capture was taken at the
    // orbit-complete frame and is waiting for _beginTravel to consume.
    // Seam 1 straddles a module boundary (main.js:5934 calls beginMotion
    // on orbitComplete), so capture happens here and consumption happens
    // on the next beginMotion → _beginTravel — one frame later.
    this._pendingSeam1Capture = null;

    // Live-feedback workstream 2026-04-24 — loop (b): capture the body-ref
    // and its live position at seam entry, so the blend's "captured
    // extrapolation" target tracks the body's actual motion instead of
    // extrapolating via a T₀-snapshot velocity. Per Director's formula:
    //   capturedPos = _seamEntryPosition
    //               + (seamBody.position − _seamBodyPositionAtEntry) × elapsed/duration
    // At elapsed=0, capturedPos = _seamEntryPosition (continuous).
    // At elapsed=duration, capturedPos = _seamEntryPosition + full body delta
    // (ship tracks where the body has moved to). This resolves the
    // moon-motion reconciliation class of bug (continuity round-1 captured
    // a velocity at T₀ and applied it for Δ; moon moved during Δ).
    this._seamBodyRef = null;  // THREE.Object3D whose position changes live
    this._seamBodyPositionAtEntry = new THREE.Vector3();
    // AC #7: expose ship velocity to telemetry. Written at end of
    // update() via _prevPosition + deltaTime.
    this._shipVelocity = new THREE.Vector3();
  }

  // Seam-specific blend durations (tunable at top-of-file for Max's
  // F12-edit-reload-observe review loop, per the tuning-dashboard
  // pattern established by the shake-redesign work).
  // Seam 1 is the most visibly different velocity direction (orbit
  // pull-out radial vs Hermite flat tangent) — longest blend.
  // Seam 2 reconciles Hermite terminal tangent vs approach radial-in —
  // both non-zero magnitudes, short blend.
  // Seam 3 reconciles approach near-zero radial vs orbit tangential —
  // magnitudes small, direction reconciliation over 0.5 s.
  get _seam1Duration() { return 0.5; }
  get _seam2Duration() { return 0.3; }
  get _seam3Duration() { return 0.5; }

  get isActive() {
    return this._phase !== Phase.IDLE;
  }

  /**
   * Begin a motion plan.
   *
   * @param {Object} input
   * @param {THREE.Vector3} input.fromPosition       — current ship position
   * @param {THREE.Vector3} [input.fromVelocity]      — current ship velocity (optional)
   * @param {THREE.Quaternion} [input.fromOrientation] — caller's current camera quaternion (used
   *   only to seed the departureDir for the look-blend; subsystem does not mutate it).
   * @param {THREE.Object3D|null} [input.fromOrbitBody] — body currently orbiting (null = free/post-warp)
   * @param {THREE.Object3D} input.toBody             — target body (resolved mesh)
   * @param {number} input.toOrbitDistance            — orbit distance from toBody center
   * @param {number} input.toBodyRadius               — target body radius
   * @param {THREE.Object3D|null} [input.nextBody]    — hint: next tour stop (for departure-aligned orbit)
   * @param {number} [input.nextOrbitDistance=10]
   * @param {Object} [input.arrivalOptions]
   * @param {boolean} [input.arrivalOptions.approachFirst=false] — run approach phase before orbit
   *        (autopilot tour arrival). False = transition straight to orbit (manual burn hold).
   * @param {boolean} [input.arrivalOptions.holdOnly=false]      — clean circular orbit (no bob/breathe)
   * @param {boolean} [input.arrivalOptions.slowOrbit=false]     — 5× slower rotation
   * @param {number}  [input.arrivalOptions.orbitDuration=15]    — seconds per orbit cycle
   * @param {number}  [input.arrivalOptions.approachOrbitDuration=75] — orbit duration after approach
   * @param {Object} [input.launchOptions]
   * @param {boolean} [input.launchOptions.warpExit=false]       — post-warp coast profile (§10.5)
   * @param {THREE.Vector3} [input.launchOptions.descentVector]  — fixed start position for intro descent
   * @param {number}  [input.launchOptions.outerOrbitRadius]     — system outer radius (for descend height)
   */
  beginMotion(input) {
    // ── Capture target context + arrival spec ──
    this.bodyRef = input.toBody;
    this.bodyRadius = input.toBodyRadius;
    this.orbitDistance = input.toOrbitDistance;
    this.nextBodyRef = input.nextBody || null;
    this.nextOrbitDistance = input.nextOrbitDistance || 10;

    const arrival = input.arrivalOptions || {};
    this._pendingArrival = {
      approachFirst: !!arrival.approachFirst,
      holdOnly: !!arrival.holdOnly,
      slowOrbit: !!arrival.slowOrbit,
      orbitDuration: arrival.orbitDuration || 15,
      approachOrbitDuration: arrival.approachOrbitDuration || 75,
    };

    const launch = input.launchOptions || {};

    // Reset one-shots, arm motionStarted for next update()
    this._motionStartPending = true;
    this._travelCompleteOneShot = false;
    this._orbitCompleteOneShot = false;
    this._targetingReadyOneShot = false;
    this._targetingSignaled = false;

    // ── Phase selection ──
    // descentVector → DESCEND
    // otherwise → TRAVEL
    // (Approach + orbit are internal transitions after travel/descend complete.)
    if (launch.descentVector) {
      this._beginDescend(
        input.fromPosition,
        launch.descentVector,
        launch.outerOrbitRadius || 100,
      );
    } else {
      // Derive departure direction from fromOrientation if provided, else zero vector
      if (input.fromOrientation) {
        // Forward direction = quaternion × (0,0,-1)
        this.departureDir.set(0, 0, -1).applyQuaternion(input.fromOrientation);
      } else {
        this.departureDir.set(0, 0, -1);
      }
      this._beginTravel(
        input.fromPosition,
        input.fromOrbitBody || null,
        !!launch.warpExit,
      );
    }
  }

  /**
   * Advance motion plan by one frame. Returns MotionFrame.
   * @param {number} deltaTime — seconds since last tick
   * @returns {MotionFrame}
   */
  update(deltaTime) {
    // Clear previous-frame one-shots; raise motionStarted if a new plan is pending
    this._motionStartedOneShot = this._motionStartPending;
    this._motionStartPending = false;
    this._travelCompleteOneShot = false;
    this._orbitCompleteOneShot = false;
    this._targetingReadyOneShot = false;

    if (this._phase === Phase.IDLE) {
      return this.getCurrentPlan();
    }

    // Record the entry position for this tick so the per-phase update
    // methods can compute captured-velocity extrapolation during blend
    // windows. Note: _prevPosition persists across frames (not reset
    // per tick) so the delta is frame-to-frame, not intra-frame.
    switch (this._phase) {
      case Phase.DESCENDING:   this._updateDescend(deltaTime); break;
      case Phase.TRAVELING:    this._updateTravel(deltaTime); break;
      case Phase.APPROACHING:  this._updateApproach(deltaTime); break;
      case Phase.ORBITING:     this._updateOrbit(deltaTime); break;
    }

    // Apply velocity-blend position-space lerp if active.
    //
    // Option 4 (Director 2026-04-24, revising loop b's first pass). The
    // original single-anchor ramp-scaled formula
    //   capturedPos = _seamEntryPosition + bodyDelta × ramp
    // collapsed two independent continuities (C1-at-start, frame-lock-at-end)
    // into one scalar and produced a mid-window geometric artifact — at
    // ramp=0.5 the ship sat 4× farther from the body than it should
    // (AC #9 18 → 554 regression, record-scratch 0.068 → 0.078 / 13% → 30%).
    //
    // Option 4 blends two independent anchors explicitly:
    //   ship_extrap  = _seamEntryPosition + capturedVelocity × elapsed
    //                  (momentum prediction — C1-at-start by construction)
    //   body_tracked = _seamEntryPosition + (body.position − bodyAtEntry)
    //                  (full body-delta, NOT ramp-scaled — frame-lock at end)
    //   capturedPos  = ship_extrap + (body_tracked − ship_extrap) × ramp
    // Ramp controls only the mix; neither anchor is scaled by it. At
    // ramp=0 the ship sits on its momentum trajectory; at ramp=1 it is
    // frame-locked to the body. Seam 3's zero leaving-velocity degenerates
    // ship_extrap to _seamEntryPosition, so capturedPos reduces to pure
    // body-tracking — naturally correct for the zero-velocity seam.
    //
    // If no seam body is set (idle / descend / warp-exit edge cases),
    // body_tracked degenerates to _seamEntryPosition → capturedPos reduces
    // to pure ship_extrap, which is the correct continuation when there is
    // nothing to frame-lock to.
    if (this._velocityBlend.active) {
      this._velocityBlend.advance(deltaTime);
      const t = this._velocityBlend.blendT;
      const dur = Math.max(1e-6, this._velocityBlend.duration);
      const ramp = Math.min(1, this._velocityBlend.elapsed / dur);

      // ship_extrap = seamEntry + capturedVelocity × elapsed
      _v1.copy(this._seamEntryPosition)
        .addScaledVector(this._velocityBlend.capturedVelocity, this._velocityBlend.elapsed);

      // body_tracked = seamEntry + full body-delta (no ramp)
      if (this._seamBodyRef && this._seamBodyRef.position) {
        _v2.copy(this._seamBodyRef.position).sub(this._seamBodyPositionAtEntry)
          .add(this._seamEntryPosition);
      } else {
        _v2.copy(this._seamEntryPosition);
      }

      // capturedPos = ship_extrap + (body_tracked − ship_extrap) × ramp
      _v3.subVectors(_v2, _v1).multiplyScalar(ramp).add(_v1);

      // lerp(this, other, alpha): alpha=0 keeps this (natural), alpha=1 → other (captured)
      this._position.lerp(_v3, 1 - t);
    }

    // AC #7: expose current ship velocity + track prevPosition for
    // next-frame terminal-velocity computation at seam transitions.
    if (deltaTime > 1e-6) {
      this._shipVelocity
        .subVectors(this._position, this._prevPosition)
        .divideScalar(deltaTime);
    }
    this._prevPosition.copy(this._position);
    this._prevDeltaTime = deltaTime;

    return this.getCurrentPlan();
  }

  /**
   * Seam-capture helper: snapshot the seam body ref + its live position
   * + ship position at the transition instant, and begin a blend.
   * Called from phase-end hooks for Seams 2 and 3 (internal transitions).
   * Seam 1 (STATION→CRUISE) captures via `_pendingSeam1Capture` at the
   * orbit-complete frame and consumes in the next `_beginTravel` call,
   * one frame later.
   *
   * Per loop (b)'s Option 4 revision (Director 2026-04-24): the blend
   * requires BOTH the leaving phase's terminal velocity (for ship_extrap,
   * the momentum anchor satisfying C1-at-start) AND the seam body's live
   * position (for body_tracked, the frame-lock anchor satisfying
   * frame-lock-at-end). Compute terminal velocity from _prevPosition /
   * _prevDeltaTime at the seam instant; capture body ref + its position.
   *
   * @param {number} duration — blend window in seconds.
   * @param {THREE.Object3D|null} bodyRef — body whose motion the blend tracks.
   */
  _captureSeamAndBegin(duration, bodyRef) {
    this._seamEntryPosition.copy(this._position);
    this._seamBodyRef = bodyRef || null;
    if (bodyRef && bodyRef.position) {
      this._seamBodyPositionAtEntry.copy(bodyRef.position);
    } else {
      this._seamBodyPositionAtEntry.set(0, 0, 0);
    }
    // Terminal velocity of the leaving phase: (P_now − P_prev) / Δt_prev.
    // Zero when _prevDeltaTime is sub-epsilon (IDLE→first-tick edge cases).
    if (this._prevDeltaTime > 1e-6) {
      _v1.subVectors(this._position, this._prevPosition)
        .divideScalar(this._prevDeltaTime);
    } else {
      _v1.set(0, 0, 0);
    }
    this._velocityBlend.begin(_v1, duration);
  }

  /** Peek current MotionFrame without advancing. */
  getCurrentPlan() {
    return {
      position:       this._position,
      velocity:       this._velocity,
      lookAtTarget:   this._lookAtTarget,
      phase:          this._phaseName(),
      motionStarted: this._motionStartedOneShot,
      travelComplete: this._travelCompleteOneShot,
      orbitComplete:  this._orbitCompleteOneShot,
      targetingReady: this._targetingReadyOneShot,
      abruptness:     this._abruptness,
      isShortTrip:    !!this._isShortTrip,
      warpExit:       !!this._warpArrival,
      shipVelocity:   this._shipVelocity,
      velocityBlendActive: this._velocityBlend.active,
    };
  }

  _phaseName() {
    switch (this._phase) {
      case Phase.DESCENDING:  return 'descending';
      case Phase.TRAVELING:   return 'traveling';
      case Phase.APPROACHING: return 'approaching';
      case Phase.ORBITING:    return 'orbiting';
      default:                return 'idle';
    }
  }

  /** Stop motion immediately. Clears plan. */
  stop() {
    this._phase = Phase.IDLE;
    this._pendingArrival = null;
    this._travelFromBody = null;
    this._travelToBody = null;
    this._telemetry = null;
  }

  // ════════════════════════════════════════════════════════════════════════
  //   PHASE STARTERS — internal; orchestrated by beginMotion() + phase
  //   transitions inside the _update* methods.
  // ════════════════════════════════════════════════════════════════════════

  /**
   * Begin descending from a fixed start position toward the first body.
   * Lifted from FlythroughCamera.beginDescend.
   */
  _beginDescend(fromPosition, descentVector, outerOrbitRadius) {
    this._phase = Phase.DESCENDING;

    // Start position is the descent vector (caller-supplied); legacy behavior
    // was to compute height/offset from outerOrbitRadius — preserve that if
    // caller passed a zero vector, else trust the caller's vector.
    if (descentVector && (descentVector.x !== 0 || descentVector.y !== 0 || descentVector.z !== 0)) {
      this.descendStart.copy(descentVector);
    } else {
      const height = outerOrbitRadius * 0.3;
      const offset = outerOrbitRadius * 0.15;
      this.descendStart.set(offset, height, offset);
    }

    this.descendElapsed = 0;
    this.descendDuration = 10;

    this._randomizeOrbit();

    // Initialize position output to the start position immediately
    this._position.copy(this.descendStart);
    this._velocity.set(0, 0, 0);
  }

  /**
   * Begin travel to the target body. Unified path for:
   *   - autopilot tour between stops (fromOrbitBody set → orbit-tangential departure)
   *   - manual burn (fromOrbitBody null → direct-to-target tangent)
   *   - warp arrival (warpExit true → flattened-forward tangent + 3s coast)
   * Lifted from FlythroughCamera.beginTravel + beginTravelFrom.
   */
  _beginTravel(fromPosition, fromOrbitBody, warpExit) {
    this._phase = Phase.TRAVELING;
    this._warpArrival = warpExit;

    // Seam 1 (STATION→CRUISE) blend consumption. The orbit-complete frame
    // captured the terminal velocity + position in _pendingSeam1Capture;
    // consume it here so the Hermite's first 0.5s blends from orbit's
    // pull-out radial-outward velocity toward the Hermite's flat-tangent
    // start. Not applicable for warp-exit (no prior orbit) or when the
    // capture is stale (e.g., idle before motion).
    if (this._pendingSeam1Capture && !warpExit) {
      const cap = this._pendingSeam1Capture;
      this._seamEntryPosition.set(cap.px, cap.py, cap.pz);
      this._seamBodyRef = cap.bodyRef || null;
      this._seamBodyPositionAtEntry.set(cap.bodyX || 0, cap.bodyY || 0, cap.bodyZ || 0);
      // Option 4 restores capturedVelocity: vx/vy/vz were captured in
      // _updateOrbit at orbit-complete as the orbit-phase terminal velocity.
      _v1.set(cap.vx || 0, cap.vy || 0, cap.vz || 0);
      this._velocityBlend.begin(_v1, this._seam1Duration);
    }
    this._pendingSeam1Capture = null;

    const nextBodyRef = this.bodyRef;
    const nextOrbitDistance = this.orbitDistance;

    this.departurePos.copy(fromPosition);
    this._position.copy(fromPosition);

    this._telemetry = [];
    this._arrivalComputed = false;
    this._hermiteStartPos.copy(this.departurePos);
    this.travelElapsed = 0;

    const dist = this.departurePos.distanceTo(nextBodyRef.position);

    if (fromOrbitBody) {
      // ── Orbit-tangential departure (autopilot tour case) ──
      // Tangent derived from current orbit state (yaw/pitch/direction owned by
      // this subsystem since it owned the prior orbit phase).
      const isNearby = dist < Math.max((this._currentDist || 10) * 5, 30);
      const minDur = isNearby ? 4 : 8;
      this.travelDuration = Math.max(minDur, Math.min(15, 10 * Math.sqrt(dist / 500)));

      const isShortTrip = dist < Math.max(this._currentDist * 5, 30);
      this._isShortTrip = isShortTrip;

      if (isShortTrip) {
        _v1.subVectors(nextBodyRef.position, this.departurePos).normalize();
        this._departureTangent.copy(_v1);
        const tangentMag = dist * 0.1;
        this._departTangentScaled.copy(this._departureTangent).multiplyScalar(tangentMag);
      } else {
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

      this._travelFromBody = fromOrbitBody;
      this.rotBlendDuration = 1.0; // tour departure has lookback, gentler blend
    } else if (warpExit) {
      // ── Warp-arrival coast ──
      this._departureTangent.copy(this.departureDir);
      this._departureTangent.y = 0;
      this._departureTangent.normalize();

      _v1.subVectors(nextBodyRef.position, this.departurePos);
      _v1.y = 0;
      _v1.normalize();
      const alignment = this._departureTangent.x * _v1.x + this._departureTangent.z * _v1.z;
      if (alignment < 0.2) {
        this._departureTangent.lerp(_v1, 0.5).normalize();
      }

      const tangentMag = dist * 0.6;
      this._departTangentScaled.copy(this._departureTangent).multiplyScalar(tangentMag);
      this._departTangentScaled.y = tangentMag * 0.03;
      this._isShortTrip = false;

      this._travelFromBody = null;
      this.travelDuration = 3; // short 3s coast with leftover momentum
      this.rotBlendDuration = Math.min(this.travelDuration * 0.4, 2.5);
    } else {
      // ── In-system burn (manual commit + autopilot engage from free camera) ──
      _v1.subVectors(nextBodyRef.position, this.departurePos).normalize();
      this._departureTangent.copy(_v1);
      const tangentMag = dist * 0.1;
      this._departTangentScaled.copy(this._departureTangent).multiplyScalar(tangentMag);
      this._isShortTrip = true;

      this._travelFromBody = null;
      this.travelDuration = Math.max(4, Math.min(15, 10 * Math.sqrt(dist / 500)));
      this.rotBlendDuration = Math.min(this.travelDuration * 0.4, 2.5);
    }

    this._travelToBody = nextBodyRef;
    this._travelToRadius = this.bodyRadius;
    this._travelToOrbitDist = nextOrbitDistance;
  }

  /**
   * Begin approach sequence (pause → close-in → auto-transition to orbit).
   * Called internally after travel completes (if pendingArrival.approachFirst).
   * Lifted from FlythroughCamera.beginApproach.
   */
  _beginApproach(bodyRef, orbitDist, bodyRadius, orbitDuration, holdOnly) {
    this._phase = Phase.APPROACHING;
    this._approachBodyRef = bodyRef;
    this._approachBodyRadius = bodyRadius;
    this._approachOrbitDist = orbitDist;
    this._approachOrbitDuration = orbitDuration;
    this._approachHoldOnly = !!holdOnly;
    this._approachElapsed = 0;

    this._approachInitialDir.subVectors(this._position, bodyRef.position);
    this._approachStartDist = this._approachInitialDir.length();
    if (this._approachStartDist > 1e-6) {
      this._approachInitialDir.divideScalar(this._approachStartDist);
    } else {
      this._approachInitialDir.set(0, 0, 1);
      this._approachStartDist = Math.max(orbitDist, 0.02);
    }
    this._approachTargetDist = Math.max(orbitDist, 0.02);
  }

  /**
   * Begin orbiting the current body.
   * Called internally from _updateDescend (after descent) or _updateTravel
   * (after travel if no approach) or _updateApproach (after close-in).
   * Lifted from FlythroughCamera.beginOrbit.
   */
  _beginOrbit(bodyRef, orbitDistance, bodyRadius, duration, slowOrbit, holdOnly) {
    this._phase = Phase.ORBITING;
    this.bodyRef = bodyRef;
    this.bodyRadius = bodyRadius;
    this.orbitDistance = orbitDistance;
    this.orbitDistBase = orbitDistance;
    this._orbitSpeedScale = slowOrbit ? 0.2 : 1.0;
    this._holdOnly = !!holdOnly;
    this.orbitElapsed = 0;
    this.orbitDuration = duration || 15;
    this._targetingSignaled = false;

    // Compute starting orbit parameters from current ship position (prevents snap
    // at the slingshot → orbit transition).
    const bodyPos = bodyRef.position;
    const dx = this._position.x - bodyPos.x;
    const dy = this._position.y - bodyPos.y;
    const dz = this._position.z - bodyPos.z;
    const actualDist = Math.sqrt(dx * dx + dy * dy + dz * dz) || orbitDistance;

    this.orbitYaw = Math.atan2(dx, dz);
    this._entryPitch = Math.asin(Math.max(-1, Math.min(1, dy / actualDist)));
    this._entryDist = actualDist;
    this.orbitPitch = this._entryPitch;

    this._randomizeOrbit();

    // Phase-align pitch oscillation so it starts from the actual entry pitch.
    const midPitch = (0.087 + 0.436) / 2;
    const ampPitch = (0.436 - 0.087) / 2;
    const pitchRatio = Math.max(-1, Math.min(1, (this._entryPitch - midPitch) / ampPitch));
    this.orbitPitchPhase = Math.asin(pitchRatio);

    // ── Departure-aligned orbit ──
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
        // Nearby target: do 1 revolution at constant speed, extend dynamically.
        this.orbitYawSpeed = TWO_PI / this.orbitDuration;
        this._nearbyDeparture = true;
      } else {
        // Far target: departure-aligned orbit.
        const targetAngle = Math.atan2(nextPos.x - bodyPos.x, nextPos.z - bodyPos.z);
        const departYawCW = targetAngle - Math.PI / 2;
        const departYawCCW = targetAngle + Math.PI / 2;
        let extraCW = ((departYawCW - this.orbitYaw) % TWO_PI + TWO_PI) % TWO_PI;
        let extraCCW = ((this.orbitYaw - departYawCCW) % TWO_PI + TWO_PI) % TWO_PI;

        if (directionForced) {
          const extra = this.orbitDirection === 1 ? extraCW : extraCCW;
          this.orbitYawSpeed = (TWO_PI + extra) / this.orbitDuration;
        } else {
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
      this.orbitYawSpeed = TWO_PI / this.orbitDuration;
      this._nearbyDeparture = false;
    }

    this._orbitStartYaw = this.orbitYaw;
  }

  // ════════════════════════════════════════════════════════════════════════
  //   PHASE UPDATERS — per-frame advance.
  // ════════════════════════════════════════════════════════════════════════

  _updateDescend(deltaTime) {
    this.descendElapsed += deltaTime;
    const t = Math.min(1, this.descendElapsed / this.descendDuration);
    const s = this._ease(t);

    const bodyPos = this.bodyRef.position;
    const entryYaw = this.orbitYaw;
    const entryPitch = this.orbitPitch;
    const cosPitch = Math.cos(entryPitch);

    _v1.set(
      bodyPos.x + this.orbitDistance * Math.sin(entryYaw) * cosPitch,
      bodyPos.y + this.orbitDistance * Math.sin(entryPitch),
      bodyPos.z + this.orbitDistance * Math.cos(entryYaw) * cosPitch,
    );

    this._position.lerpVectors(this.descendStart, _v1, s);
    this._position.y += this.descendStart.y * 0.3 * Math.sin(t * Math.PI);

    this._lookAtTarget.copy(bodyPos);

    if (t >= 1) {
      this._beginOrbit(this.bodyRef, this.orbitDistance, this.bodyRadius,
        this.orbitDuration, false, false);
    }
  }

  _updateOrbit(deltaTime) {
    this.orbitElapsed += deltaTime;

    const bodyPos = this.bodyRef.position;

    if (this._holdOnly) {
      const HOLD_YAW_RATE = (2 * Math.PI) / 120;
      this.orbitYaw += HOLD_YAW_RATE * this.orbitDirection * deltaTime;
      const cosP = Math.cos(this._entryPitch);
      this._position.set(
        bodyPos.x + this.orbitDistBase * Math.sin(this.orbitYaw) * cosP,
        bodyPos.y + this.orbitDistBase * Math.sin(this._entryPitch),
        bodyPos.z + this.orbitDistBase * Math.cos(this.orbitYaw) * cosP,
      );
      this._currentDist = this.orbitDistBase;
      this._lookAtTarget.copy(bodyPos);
      return;
    }

    // Entry blend (first 2s): smooth transition from arrival
    const entryDur = 2;
    const entryFactor = this.orbitElapsed < entryDur
      ? this._ease(this.orbitElapsed / entryDur)
      : 1;

    this.orbitYaw += this.orbitYawSpeed * this._orbitSpeedScale * this.orbitDirection * deltaTime;

    const minPitch = 0.087;
    const maxPitch = 0.436;
    const midPitch = (minPitch + maxPitch) / 2;
    const ampPitch = (maxPitch - minPitch) / 2;
    const oscPitch = midPitch + ampPitch * Math.sin(this.orbitElapsed * 0.52 * this._orbitSpeedScale + this.orbitPitchPhase);
    this.orbitPitch = this._entryPitch + (oscPitch - this._entryPitch) * entryFactor;

    const breatheAmp = 0.05 * this._orbitSpeedScale;
    const breathe = 1 + breatheAmp * entryFactor * Math.sin(this.orbitElapsed * 0.785 * this._orbitSpeedScale + this.orbitDistPhase);
    let dist = this._entryDist + (this.orbitDistBase * breathe - this._entryDist) * entryFactor;

    // Gentle pull-out near departure (last 25% → ease to 1.25×)
    const orbitT = this.orbitElapsed / this.orbitDuration;
    if (orbitT > 0.75) {
      const pullT = (orbitT - 0.75) / 0.25;
      dist *= 1 + this._ease(pullT) * 0.25;
    }

    this._currentDist = dist;

    const cosPitch = Math.cos(this.orbitPitch);
    this._position.set(
      bodyPos.x + dist * Math.sin(this.orbitYaw) * cosPitch,
      bodyPos.y + dist * Math.sin(this.orbitPitch),
      bodyPos.z + dist * Math.cos(this.orbitYaw) * cosPitch,
    );

    this._lookAtTarget.copy(bodyPos);

    // Targeting-ready signal — 4s before orbit ends
    if (!this._targetingSignaled && this.orbitElapsed >= this.orbitDuration - 4) {
      this._targetingSignaled = true;
      this._targetingReadyOneShot = true;
    }

    let orbitComplete = this.orbitElapsed >= this.orbitDuration;

    // Nearby-departure gate (moons orbit parent during our orbit)
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
      if (angDiff > Math.PI / 2) {
        orbitComplete = false;
      }
    }

    if (orbitComplete) {
      this._orbitCompleteOneShot = true;
      // Seam 1 (STATION→CRUISE) capture: main.js:5934 calls beginMotion
      // on orbitComplete with fromPosition = camera.position.clone().
      // The next _beginTravel call will consume this pending capture to
      // start the Hermite travel with a velocity-blend from orbit's
      // pull-out radial velocity toward the Hermite's flat-tangent start.
      // Loop (b): capture the STATION body ref and its live position at
      // orbit-complete. The blend-application will track this body's
      // motion during the 0.5s blend window as the ship departs — so the
      // Hermite's first frames blend from "anchored to the body we just
      // left (which is still moving)" to "Hermite's authored trajectory."
      // Velocity fields (vx/vy/vz) preserved informational-only.
      if (this._prevDeltaTime > 1e-6 && this.bodyRef && this.bodyRef.position) {
        const velX = (this._position.x - this._prevPosition.x) / this._prevDeltaTime;
        const velY = (this._position.y - this._prevPosition.y) / this._prevDeltaTime;
        const velZ = (this._position.z - this._prevPosition.z) / this._prevDeltaTime;
        this._pendingSeam1Capture = {
          vx: velX, vy: velY, vz: velZ,
          px: this._position.x, py: this._position.y, pz: this._position.z,
          bodyRef: this.bodyRef,
          bodyX: this.bodyRef.position.x,
          bodyY: this.bodyRef.position.y,
          bodyZ: this.bodyRef.position.z,
        };
      }
    }
  }

  _updateApproach(deltaTime) {
    this._approachElapsed += deltaTime;
    const body = this._approachBodyRef;
    if (!body) return;

    const bodyPos = body.position;
    const pauseDur = this._approachPauseDur;
    const closeDur = this._approachCloseDur;
    const totalDur = pauseDur + closeDur;
    const dir = this._approachInitialDir;

    if (this._approachElapsed < pauseDur) {
      this._position.copy(bodyPos).addScaledVector(dir, this._approachStartDist);
      this._lookAtTarget.copy(bodyPos);
    } else if (this._approachElapsed < totalDur) {
      const closeT = (this._approachElapsed - pauseDur) / closeDur;
      const eased = this._ease(closeT);
      const d = this._approachStartDist + (this._approachTargetDist - this._approachStartDist) * eased;
      this._position.copy(bodyPos).addScaledVector(dir, d);
      this._lookAtTarget.copy(bodyPos);
    } else {
      // Approach complete → transition to slow orbit (Seam 3: APPROACH→ORBIT).
      // Loop (b): track the approach body's motion during the blend window
      // so orbit's frame-1 tangential composition doesn't pull the ship
      // off a live-moving target.
      this._captureSeamAndBegin(this._seam3Duration, body);
      this._beginOrbit(body, this._approachOrbitDist, this._approachBodyRadius,
        this._approachOrbitDuration, true /* slowOrbit */, this._approachHoldOnly);
    }
  }

  _updateTravel(deltaTime) {
    this.travelElapsed += deltaTime;
    const t = Math.min(1, this.travelElapsed / this.travelDuration);

    const nextPos = this._travelToBody.position;
    const approachDir = Math.atan2(
      nextPos.x - this.departurePos.x,
      nextPos.z - this.departurePos.z,
    );

    let entryYaw;
    if (this.nextBodyRef) {
      const nnPos = this.nextBodyRef.position;
      const toNextAngle = Math.atan2(nnPos.x - nextPos.x, nnPos.z - nextPos.z);
      const estYawTravel = 0.325 * 18;
      const tangentCW = approachDir + estYawTravel;
      const tangentCCW = approachDir - estYawTravel;
      const diffCW = Math.abs(Math.atan2(
        Math.sin(toNextAngle - tangentCW), Math.cos(toNextAngle - tangentCW),
      ));
      const diffCCW = Math.abs(Math.atan2(
        Math.sin(toNextAngle - tangentCCW), Math.cos(toNextAngle - tangentCCW),
      ));
      entryYaw = diffCW <= diffCCW
        ? approachDir - Math.PI / 2
        : approachDir + Math.PI / 2;
    } else {
      entryYaw = approachDir + Math.PI / 2;
    }
    const entryPitch = 0.15;
    const cosPitch = Math.cos(entryPitch);

    _v1.set(
      nextPos.x + this._travelToOrbitDist * Math.sin(entryYaw) * cosPitch,
      nextPos.y + this._travelToOrbitDist * Math.sin(entryPitch),
      nextPos.z + this._travelToOrbitDist * Math.cos(entryYaw) * cosPitch,
    );

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
    }

    const remDist = this._hermiteStartPos.distanceTo(_v1);

    if (this._isShortTrip) {
      const arrMag = remDist * 0.05;
      _v3.subVectors(_v1, this._hermiteStartPos).normalize();
      this._arrivalTangentScaled.copy(_v3).multiplyScalar(arrMag);
    } else {
      const arrMag = remDist * 0.25;
      this._arrivalTangentScaled.set(arrTanX, 0, arrTanZ)
        .multiplyScalar(captureDir).normalize()
        .multiplyScalar(arrMag);
      this._arrivalTangentScaled.y = arrMag * -0.03;
    }

    const transferT = Math.min(1, this.travelElapsed / this.travelDuration);
    const s = this._warpArrival
      ? 1 - (1 - transferT) * (1 - transferT)
      : this._travelEase(transferT);

    this._hermite(
      _v6, this._hermiteStartPos, this._departTangentScaled,
      _v1, this._arrivalTangentScaled, s,
    );
    this._position.copy(_v6);

    // Arrival blend (Hermite → pre-orbit)
    const ARRIVE_BLEND = Math.max(2, Math.min(3.5, this.travelDuration * 0.4));
    const arriveStart = this.travelDuration - ARRIVE_BLEND;
    if (this.travelElapsed > arriveStart) {
      const blend = this._ease(
        (this.travelElapsed - arriveStart) / ARRIVE_BLEND
      );
      const arriveElapsed = this.travelElapsed - arriveStart;
      this._computePreOrbitPos(arriveElapsed, nextPos, _v5);
      this._position.lerp(_v5, blend);
    }

    // Smooth cinematic LookAt — three-target weighted blend (output to camera layer)
    const fromBody = this._travelFromBody;
    const DEPART_LOOK_DUR = this._isShortTrip ? 3.0 : 5.0;
    const wDepart = fromBody
      ? 1 - this._ease(Math.min(1, this.travelElapsed / DEPART_LOOK_DUR))
      : 0;
    const wArrive = (this._warpArrival || !fromBody)
      ? 1
      : this._ease(Math.max(0, Math.min(1, (transferT - 0.35) / 0.35)));
    const wHeading = Math.max(0, 1 - wDepart - wArrive);

    const lookAheadT = Math.min(1, transferT + 0.05);
    const sAhead = this._travelEase(lookAheadT);
    this._hermite(
      _v4, this._hermiteStartPos, this._departTangentScaled,
      _v1, this._arrivalTangentScaled, sAhead,
    );

    this._lookAtTarget.set(0, 0, 0);
    if (fromBody && wDepart > 0.001) {
      _v2.subVectors(fromBody.position, this._position).normalize();
      this._lookAtTarget.addScaledVector(_v2, wDepart);
    }
    if (wHeading > 0.001) {
      _v2.subVectors(_v4, this._position).normalize();
      this._lookAtTarget.addScaledVector(_v2, wHeading);
    }
    if (wArrive > 0.001) {
      _v2.subVectors(nextPos, this._position).normalize();
      this._lookAtTarget.addScaledVector(_v2, wArrive);
    }
    this._lookAtTarget.normalize().multiplyScalar(100).add(this._position);

    // Telemetry (preserved from FlythroughCamera)
    if (this._telemetry) {
      const distToTarget = this._position.distanceTo(nextPos);
      this._telemetry.push({
        t: this.travelElapsed.toFixed(3),
        dist: distToTarget.toFixed(4),
        wH: wHeading.toFixed(3),
        wA: wArrive.toFixed(3),
      });
    }

    if (t >= 1) {
      // Travel done — set orbit state from arrival + transition per pendingArrival
      this.orbitYaw = this._arrivalYaw;
      this._arrivalOrbitDir = this._arrivalCaptureDir;

      if (this._telemetry && this._telemetry.length > 0) {
        const dists = this._telemetry.map(r => parseFloat(r.dist));
        let oscillations = 0;
        for (let i = 2; i < dists.length; i++) {
          if (dists[i] > dists[i - 1] && dists[i - 1] < dists[i - 2]) oscillations++;
        }
        const minD = Math.min(...dists).toFixed(4);
        const maxD = Math.max(...dists).toFixed(4);
        const finalD = dists[dists.length - 1].toFixed(4);
        console.log(`[TRAVEL TELEMETRY] ${this._telemetry.length} frames, `
          + `dist: ${maxD} → ${minD} (final: ${finalD}), `
          + `oscillations: ${oscillations}, `
          + `short: ${this._isShortTrip}, duration: ${this.travelDuration.toFixed(1)}s`);
        if (oscillations > 0) {
          console.warn(`[TRAVEL TELEMETRY] ⚠️ ${oscillations} distance oscillation(s) detected`);
          console.table(this._telemetry);
        }
        window._lastTravelTelemetry = this._telemetry;
      }
      this._telemetry = null;
      this._travelCompleteOneShot = true;

      // Transition per pendingArrival. Capture Hermite's terminal velocity
      // for the seam-specific blend before starting the next phase:
      //   approachFirst === true  → Seam 2 (TRAVEL→APPROACH): blend approach's
      //                              radial-in against Hermite's terminal tangent.
      //   approachFirst === false → Seam 3-variant (TRAVEL→ORBIT directly,
      //                              manual-burn hold): blend orbit's tangential
      //                              against Hermite's terminal tangent.
      const pa = this._pendingArrival || { approachFirst: false, holdOnly: false, slowOrbit: false, orbitDuration: 15, approachOrbitDuration: 75 };
      // Loop (b): track the target body's motion during the blend window.
      if (pa.approachFirst) {
        this._captureSeamAndBegin(this._seam2Duration, this._travelToBody);
        this._beginApproach(this._travelToBody, this._travelToOrbitDist,
          this._travelToRadius, pa.approachOrbitDuration, pa.holdOnly);
      } else {
        this._captureSeamAndBegin(this._seam3Duration, this._travelToBody);
        this._beginOrbit(this._travelToBody, this._travelToOrbitDist,
          this._travelToRadius, pa.orbitDuration, pa.slowOrbit, pa.holdOnly);
      }
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  //   HELPERS — lifted from FlythroughCamera verbatim.
  // ════════════════════════════════════════════════════════════════════════

  _randomizeOrbit() {
    this.orbitDirection = Math.random() < 0.5 ? 1 : -1;
    this.orbitYawSpeed = 0.35 + Math.random() * 0.15;
    this.orbitPitchPhase = Math.random() * Math.PI * 2;
    this.orbitDistPhase = Math.random() * Math.PI * 2;
    this.orbitPitch = 0.09 + Math.random() * 0.17;
  }

  _ease(t) {
    t = Math.max(0, Math.min(1, t));
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  _travelEase(t) {
    t = Math.max(0, Math.min(1, t));
    const s = this._ease(t);
    return this._ease(s);
  }

  _hermite(out, P0, T0, P1, T1, t) {
    const t2 = t * t;
    const t3 = t2 * t;
    const h00 = 2 * t3 - 3 * t2 + 1;
    const h10 = t3 - 2 * t2 + t;
    const h01 = -2 * t3 + 3 * t2;
    const h11 = t3 - t2;

    out.set(
      h00 * P0.x + h10 * T0.x + h01 * P1.x + h11 * T1.x,
      h00 * P0.y + h10 * T0.y + h01 * P1.y + h11 * T1.y,
      h00 * P0.z + h10 * T0.z + h01 * P1.z + h11 * T1.z,
    );
    return out;
  }

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
}
