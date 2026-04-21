import * as THREE from 'three';

/**
 * ShipChoreographer — the ship-axis layer on top of `NavigationSubsystem`.
 *
 * Authored 2026-04-21. Per SYSTEM_CONTRACTS.md §10.1 the autopilot state
 * is two orthogonal axes: ship (ENTRY/CRUISE/APPROACH/STATION) and camera
 * (ESTABLISHING/SHOWCASE/ROVING). This module owns the ship axis.
 *
 * **Responsibilities:**
 *   - Ship-axis phase tracking (ENTRY/CRUISE/APPROACH/STATION/IDLE).
 *   - Gravity-drive shake — **asymmetric log-impulse envelope** fired
 *     on continuous `|d|v|/dt|` onset-detection, per Bible §8H.
 *
 * ──────────────────────────────────────────────────────────────────
 *  Shake design (round-8 restoration of canon — 2026-04-21)
 * ──────────────────────────────────────────────────────────────────
 *
 * **Bible §8H, lines 1307–1309 (canon, unchanged):** The gravity drive's
 * coupling to the ether produces two *visibly asymmetric* physical
 * events — accel (ship pushing INTO the medium from rest: waves build,
 * then release) and decel (ship slamming into the wall of accumulated
 * medium: impact first, then rings out). Shake is the rider's felt
 * signature of that coupling.
 *
 * **Signal source (preserved from round-6):** shake is driven from
 * `d|v|/dt` — the scalar rate of change of ship speed — computed from
 * position deltas each frame. This signal is continuous and low-pass-
 * filtered (α=0.15) to reject per-frame noise. Max's round-5 verdict
 * fixed the signal source: shake fires from how the ship's speed is
 * changing, not from phase-boundary one-shots.
 *
 * **Envelope shape (restored from rounds 1–5, per Bible §8H):** when
 * the smoothed signal crosses an onset threshold from below, a single
 * discrete **impulse-train event** fires. The event runs a precomputed
 * envelope of 3–5 log-spaced bounces with log-decaying amplitude. The
 * sign of `dSpeed` at onset selects which envelope:
 *   - `sign > 0` (accel) → `ACCEL_AMPS` (crescendo-then-fade)
 *   - `sign < 0` (decel) → `DECEL_AMPS` (impact-then-decay)
 *
 * Once fired, the event's envelope runs to completion on frozen state
 * (axis, camera-to-target distance, sign, onset time). Subsequent
 * signal variation does not re-trigger mid-ringout. A new event can
 * fire only after the prior event completes AND the signal has been
 * below threshold for a refractory window.
 *
 * **Per-event peak amplitude:** `peakAmp = SHAKE_VIEW_ANGLE_MAX × cam2tgt`,
 * where `cam2tgt` is the camera-to-lookAt-target distance **frozen at
 * onset** (per round-4 drift-risk-2 guard). This makes the peak view-
 * angle uniform across body scales (moon=0.06 → star=40 in Sol).
 *
 * **Axes:** primary is world-Y (vertical bob — "boat-bob" per Max).
 * Secondary is the horizontal-perpendicular to ship velocity at onset,
 * carrying the same envelope at 20% amplitude (synchronized minor
 * companion). Both axes freeze at onset.
 *
 * **Why round-6/7 regressed and had to be reverted:** round-6 replaced
 * the envelope with a continuous `Math.sin(t × 6Hz)` carrier modulated
 * by the smoothed signal. This collapsed AC #2 (3–5 discrete bounces)
 * and AC #4 (accel/decel asymmetric) into a single symmetric continuous
 * bob. Round-7 tuned four constants simultaneously on top of the
 * regressed shape. Director audit 2026-04-21 and PM Path-A amendment
 * (commit 755000e) restore canon; this file is the round-8 restoration.
 *
 * Integration: main.js calls `shipChoreographer.update(dt, motionFrame)`
 * after `flythrough.update(dt)`; FlythroughCamera reads `shakeOffset`
 * via the provider hook and adds it to camera.position.
 */

export const ShipPhase = Object.freeze({
  IDLE:     'IDLE',
  ENTRY:    'ENTRY',
  CRUISE:   'CRUISE',
  APPROACH: 'APPROACH',
  STATION:  'STATION',
});

// ────────────────────────────────────────────────────────────────────────
//  SHAKE TUNABLES (Round 8 — canon-restored)
// ────────────────────────────────────────────────────────────────────────

// Signal smoothing (preserved from round-6).
const DSPEED_SMOOTHING = 0.15;

// Onset threshold on smoothed `|d|v|/dt|`. Above this, a new impulse-train
// event fires (subject to refractory and not-already-active checks).
// Below this, the event-active latch clears and the refractory timer
// starts. Value chosen to sit above typical orbit pitch/yaw modulation
// noise (observed ~5-30) and below mid-cruise Hermite peaks (observed
// ~100-180). scene-units/s².
const ONSET_THRESHOLD = 35.0;

// Seconds the signal must be continuously below ONSET_THRESHOLD before
// a new event can fire. Prevents stutter-firing on noisy signals and
// gives each event a clean ringout window.
const ONSET_REFRACTORY = 0.15;

// Peak view-angle the impulse-train bob subtends at `peakAmp` (radians).
// 0.05 rad ≈ 2.86°. Per-impulse peak amplitude = this × cam2tgt (frozen
// at onset). Round-7 established this range; round-8 keeps it.
const SHAKE_VIEW_ANGLE_MAX = 0.05;

// Asymmetric envelope amplitude arrays (normalized to peakAmp=1).
// Accel: crescendo-then-fade (5 bounces) — ship pushing INTO medium.
// Decel: impact-then-decay (4 bounces) — ship slamming INTO wall.
const ACCEL_AMPS = [0.30, 1.00, 0.70, 0.35, 0.10];
const DECEL_AMPS = [1.00, 0.55, 0.30, 0.17];

// Log-spacing: gap[n] = IMPULSE_INITIAL_GAP × IMPULSE_SPACING_RATIO^n.
// Initial gap = seconds from onset to first peak. Subsequent gaps
// grow geometrically.
const IMPULSE_INITIAL_GAP = 0.08;
const IMPULSE_SPACING_RATIO = 1.8;

// Per-impulse bump width = IMPULSE_WIDTH_RATIO × leading-gap. Controls
// how sharp vs smeared each bump reads. Bumps overlap slightly at
// defaults (width 0.5×gap → ~2% bleed from neighbor at peak).
const IMPULSE_WIDTH_RATIO = 0.5;

// Secondary-axis amplitude as a fraction of primary. Synchronized
// companion per Max's round-2 direction ("minor shakes synchronized
// with the greatest disturbances across the y-axis").
const SECONDARY_AXIS_RATIO = 0.20;

// ────────────────────────────────────────────────────────────────────────

// Reusable vectors (avoid per-frame allocation)
const _velocity = new THREE.Vector3();
const _tmpVec = new THREE.Vector3();

// Module-scoped world-up for perpendicular computation
const _UP = new THREE.Vector3(0, 1, 0);

export class ShipChoreographer {
  /**
   * @param {NavigationSubsystem} navSubsystem
   */
  constructor(navSubsystem) {
    this.nav = navSubsystem;

    this._phase = ShipPhase.IDLE;
    this._fromWarp = false;

    // ── Signal tracking (position-delta velocity, scalar speed-derivative) ──
    this._prevPosition = new THREE.Vector3();
    this._prevSpeed = 0;
    this._hasPrev = 0;  // 0 = no history, 1 = have position, 2 = have speed
    this._smoothedAbsDSpeed = 0;
    this._signedDSpeed = 0;
    this._timeAccum = 0;

    // ── Impulse-train event state (frozen at onset; const through ringout) ──
    this._eventActive = false;
    this._shakeOnsetTime = 0;        // _timeAccum at event fire
    this._shakeOnsetCam2Tgt = 0;     // camera-to-target distance at onset
    this._shakeOnsetSign = 0;        // +1 accel, -1 decel
    this._shakePeakAmp = 0;          // view-angle × cam2tgt = scene-unit peak
    this._shakeAmps = null;          // which array (ACCEL_AMPS or DECEL_AMPS)
    this._shakeImpulseTimes = null;  // seconds-from-onset per peak
    this._shakeWidths = null;        // per-impulse Gaussian width
    this._shakeEventDuration = 0;    // event ends when t > this
    this._shakeSecondaryAxis = new THREE.Vector3(1, 0, 0);

    // ── Refractory timer ──
    // Time since signal last crossed below ONSET_THRESHOLD. Must exceed
    // ONSET_REFRACTORY before a new event can fire.
    this._subThresholdTime = ONSET_REFRACTORY;  // start ready-to-fire

    // ── Output ──
    this._shakeOffset = new THREE.Vector3();

    // ── Debug-hook: when non-null, the update loop consumes this as the
    //    next onset instead of waiting for the natural signal. ──
    this._pendingDebugFire = null;  // { sign: ±1, cam2tgt: number|null }
  }

  // ── Public surface ──

  get isActive() { return this._phase !== ShipPhase.IDLE; }
  get currentPhase() { return this._phase; }
  /** True while an impulse-train event is running; 0/1 for legacy telemetry. */
  get abruptness() { return this._eventActive ? 1 : 0; }
  get shakeOffset() { return this._shakeOffset; }
  /** Per-frame smoothed |d|v|/dt| (for telemetry). */
  get smoothedAbsDSpeed() { return this._smoothedAbsDSpeed; }
  /** Signed dSpeed (for telemetry — the discriminator before onset). */
  get signedDSpeed() { return this._signedDSpeed; }
  /** True when an impulse-train event is running. */
  get eventActive() { return this._eventActive; }
  /** Seconds since the current event fired (0 when no event). */
  get eventTime() {
    return this._eventActive ? (this._timeAccum - this._shakeOnsetTime) : 0;
  }
  /** Frozen cam-to-target at onset of current event (0 when no event). */
  get onsetCam2Tgt() { return this._eventActive ? this._shakeOnsetCam2Tgt : 0; }
  /** Frozen sign at onset of current event (+1 accel / -1 decel / 0 idle). */
  get onsetSign() { return this._eventActive ? this._shakeOnsetSign : 0; }

  beginTour({ fromWarp }) {
    this._fromWarp = !!fromWarp;
    this._phase = fromWarp ? ShipPhase.ENTRY : ShipPhase.CRUISE;
    this._resetSignal();
  }

  onLegAdvanced() {
    if (this._fromWarp) this._fromWarp = false;
  }

  /**
   * Per-frame tick. Call AFTER `flythrough.update(dt)`.
   * @param {number} deltaTime
   * @param {Object} motionFrame — MotionFrame from nav.update(dt)
   */
  update(deltaTime, motionFrame) {
    if (this._phase === ShipPhase.IDLE) {
      this._shakeOffset.set(0, 0, 0);
      return;
    }

    this._timeAccum += deltaTime;

    // Map subsystem phase → ship-axis phase
    const subPhase = motionFrame.phase;
    if (this._fromWarp) {
      this._phase = ShipPhase.ENTRY;
    } else {
      if (subPhase === 'traveling') this._phase = ShipPhase.CRUISE;
      else if (subPhase === 'approaching') this._phase = ShipPhase.APPROACH;
      else if (subPhase === 'orbiting') this._phase = ShipPhase.STATION;
      else this._phase = ShipPhase.IDLE;
    }

    // ── Compute |d|v|/dt| from position deltas ──
    const currPos = motionFrame.position;
    if (deltaTime > 1e-6 && this._hasPrev >= 1) {
      _velocity.set(
        (currPos.x - this._prevPosition.x) / deltaTime,
        (currPos.y - this._prevPosition.y) / deltaTime,
        (currPos.z - this._prevPosition.z) / deltaTime,
      );
      const currSpeed = _velocity.length();

      if (this._hasPrev >= 2) {
        const dSpeed = (currSpeed - this._prevSpeed) / deltaTime;
        this._signedDSpeed = dSpeed;
        const rawAbsDSpeed = Math.abs(dSpeed);
        this._smoothedAbsDSpeed += (rawAbsDSpeed - this._smoothedAbsDSpeed) * DSPEED_SMOOTHING;
      }
      this._prevSpeed = currSpeed;
    }
    this._prevPosition.copy(currPos);
    if (this._hasPrev < 2) this._hasPrev++;

    // ── Refractory timer: accumulate below-threshold time ──
    if (this._smoothedAbsDSpeed < ONSET_THRESHOLD) {
      this._subThresholdTime += deltaTime;
    } else {
      this._subThresholdTime = 0;
    }

    // ── Onset-detection: fire a new event if conditions align ──
    const lookAt = motionFrame.lookAtTarget;
    const dx = currPos.x - lookAt.x;
    const dy = currPos.y - lookAt.y;
    const dz = currPos.z - lookAt.z;
    const cam2tgt = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;

    if (this._pendingDebugFire !== null) {
      // Debug hook trumps natural onset gating.
      const sign = this._pendingDebugFire.sign;
      const c2t = this._pendingDebugFire.cam2tgt ?? cam2tgt;
      this._pendingDebugFire = null;
      this._startImpulseTrain(sign, c2t);
    } else if (
      !this._eventActive
      && this._smoothedAbsDSpeed >= ONSET_THRESHOLD
      && this._subThresholdTime >= ONSET_REFRACTORY
    ) {
      const sign = this._signedDSpeed >= 0 ? +1 : -1;
      this._startImpulseTrain(sign, cam2tgt);
    }

    // ── Sample envelope if an event is running ──
    if (this._eventActive) {
      const t = this._timeAccum - this._shakeOnsetTime;
      if (t > this._shakeEventDuration) {
        this._eventActive = false;
        this._shakeOffset.set(0, 0, 0);
      } else {
        // Sum Gaussian bumps: ∑ A[i] × exp(-((t - t_peak[i])/width[i])²)
        let envelope = 0;
        const times = this._shakeImpulseTimes;
        const amps = this._shakeAmps;
        const widths = this._shakeWidths;
        for (let i = 0; i < times.length; i++) {
          const diff = t - times[i];
          const w = widths[i];
          envelope += amps[i] * Math.exp(-(diff * diff) / (w * w));
        }
        const primaryMag = envelope * this._shakePeakAmp;

        // Primary: world-Y. Secondary: horizontal-perp axis frozen at onset.
        // Same envelope on both axes (synchronized companion).
        const secondaryMag = primaryMag * SECONDARY_AXIS_RATIO;
        this._shakeOffset
          .set(0, primaryMag, 0)
          .addScaledVector(this._shakeSecondaryAxis, secondaryMag);
      }
    } else {
      this._shakeOffset.set(0, 0, 0);
    }
  }

  // ── Internal: atomic event-onset freeze ──

  /**
   * Fire a new impulse-train event. Atomically freezes:
   *   - sign (selects ACCEL_AMPS vs DECEL_AMPS)
   *   - cam-to-target distance (sets per-event peak amplitude)
   *   - onset time (envelope x-axis zero)
   *   - secondary axis (horizontal-perpendicular to velocity at this instant)
   *
   * These values are const for the duration of the event's ringout, per
   * round-4 drift-risk guards (axis frozen, scale frozen).
   */
  _startImpulseTrain(sign, cam2tgtAtOnset) {
    this._eventActive = true;
    this._shakeOnsetTime = this._timeAccum;
    this._shakeOnsetSign = sign;
    this._shakeOnsetCam2Tgt = cam2tgtAtOnset;
    this._shakePeakAmp = SHAKE_VIEW_ANGLE_MAX * cam2tgtAtOnset;
    this._shakeAmps = (sign >= 0) ? ACCEL_AMPS : DECEL_AMPS;

    // Log-spaced impulse peaks
    const n = this._shakeAmps.length;
    const times = new Array(n);
    const widths = new Array(n);
    let gap = IMPULSE_INITIAL_GAP;
    let t = 0;
    for (let i = 0; i < n; i++) {
      t += gap;
      times[i] = t;
      widths[i] = gap * IMPULSE_WIDTH_RATIO;
      gap *= IMPULSE_SPACING_RATIO;
    }
    this._shakeImpulseTimes = times;
    this._shakeWidths = widths;
    // Event duration: last peak + 4σ of its Gaussian tail = negligible after
    this._shakeEventDuration = times[n - 1] + 4 * widths[n - 1];

    // Freeze horizontal-perpendicular axis
    const hsq = _velocity.x * _velocity.x + _velocity.z * _velocity.z;
    if (hsq > 1e-6) {
      const hm = Math.sqrt(hsq);
      _tmpVec.set(_velocity.x / hm, 0, _velocity.z / hm);
      this._shakeSecondaryAxis.crossVectors(_tmpVec, _UP).normalize();
    } else {
      this._shakeSecondaryAxis.set(1, 0, 0);
    }

    // Reset refractory so we can't immediately re-fire after this event ends
    this._subThresholdTime = 0;
  }

  // ── Debug hooks ──

  /**
   * Fire an accel-envelope event (crescendo-then-fade) next update.
   * Uses current cam2tgt unless overridden via debugImpulseAtOrbitDistance.
   */
  debugAccelImpulse() {
    this._pendingDebugFire = { sign: +1, cam2tgt: null };
  }

  /**
   * Fire a decel-envelope event (impact-then-decay) next update.
   */
  debugDecelImpulse() {
    this._pendingDebugFire = { sign: -1, cam2tgt: null };
  }

  /**
   * Generic spike that picks sign from current signal. Retained for
   * back-compat with round-6's `debugAbruptTransition` caller in main.js.
   */
  debugAbruptTransition() {
    const sign = this._signedDSpeed >= 0 ? +1 : -1;
    this._pendingDebugFire = { sign, cam2tgt: null };
  }

  /**
   * Fire at a specified cam2tgt scale (for per-body-class verification).
   * AC #11 preserved from round-4.
   */
  debugImpulseAtOrbitDistance(orbitDistance, sign) {
    const s = (sign === undefined || sign === null) ? -1 : (sign >= 0 ? +1 : -1);
    this._pendingDebugFire = { sign: s, cam2tgt: orbitDistance };
  }

  stop() {
    this._phase = ShipPhase.IDLE;
    this._fromWarp = false;
    this._resetSignal();
    this._shakeOffset.set(0, 0, 0);
    this._pendingDebugFire = null;
  }

  _resetSignal() {
    this._prevPosition.set(0, 0, 0);
    this._prevSpeed = 0;
    this._hasPrev = 0;
    this._smoothedAbsDSpeed = 0;
    this._signedDSpeed = 0;
    this._timeAccum = 0;
    this._eventActive = false;
    this._subThresholdTime = ONSET_REFRACTORY;
    this._shakeOnsetTime = 0;
    this._shakeOnsetCam2Tgt = 0;
    this._shakeOnsetSign = 0;
    this._shakePeakAmp = 0;
  }
}
