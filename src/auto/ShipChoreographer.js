import * as THREE from 'three';

/**
 * ShipChoreographer — the ship-axis layer on top of `NavigationSubsystem`.
 *
 * Per SYSTEM_CONTRACTS.md §10.1 the autopilot state is two orthogonal axes:
 * ship (ENTRY/CRUISE/APPROACH/STATION) and camera (ESTABLISHING/SHOWCASE/
 * ROVING). This module owns the ship axis.
 *
 * **Responsibilities:**
 *   - Ship-axis phase tracking (ENTRY/CRUISE/APPROACH/STATION/IDLE).
 *   - Gravity-drive shake — **phase-boundary triggered impulse events**,
 *     gated on `!isShortTrip`, with a warp-exit carve-out on the accel side.
 *
 * ──────────────────────────────────────────────────────────────────
 *  Shake design (round-9, 2026-04-21 — Max's event-based ruling)
 * ──────────────────────────────────────────────────────────────────
 *
 * **Max's ruling (2026-04-21):** shake fires ONLY when the ship is
 * accelerating or decelerating dramatically between distant objects.
 * Never during settled orbit (pitch/breathe modulation is authored
 * cinematography, not a motion-abruptness event). Never on short hops
 * between close-together bodies. On warp exit: no accel (portal already
 * handed the ship its cruise velocity); decel fires when the ship brakes
 * into the first body's orbit.
 *
 * **Bible §8H (lines 1290-1316, unchanged):** shake is the rider's
 * signature of the drive coupling with the ether. Two asymmetric
 * physical events: accel (crescendo-then-fade — ship pushing INTO the
 * medium from rest) and decel (impact-then-decay — ship slamming INTO
 * the accumulated medium wall). §8H line 1303 already names "warp-exit
 * velocity mismatch" and "a transition that exceeds the drive's
 * smoothing capacity" — phase boundaries on long legs ARE those
 * transitions. §8H line 1309: "the friction-against-ether event is
 * the arrival event itself." Round-9 is the more faithful reading.
 *
 * **Trigger surface.** Events fire on NavigationSubsystem's phase
 * transition one-shots read from the MotionFrame each update():
 *
 * | Trigger | Gate | Event |
 * |---|---|---|
 * | `motionStarted && phase === 'traveling'` | `!isShortTrip && !warpExit` | ACCEL envelope |
 * | `travelComplete` | `!isShortTrip` (any leg) | DECEL envelope |
 * | Any transition | `isShortTrip === true` | No event |
 * | Any orbit/station frame | — | No event, by construction |
 *
 * No continuous signal detection. No `|d|v|/dt|` threshold. Rounds 6–8
 * used signal-onset detection which fired on legitimate-but-not-
 * dramatic speed changes (orbit pitch modulation, distance breathe,
 * Hermite cruise ramp). Round-9 retires that mechanism entirely —
 * the envelope shape from round-8 is preserved verbatim, but the
 * trigger comes from NavigationSubsystem's phase-transition one-shots.
 *
 * **Preserved from round-8:**
 *   - `ACCEL_AMPS = [0.30, 1.00, 0.70, 0.35, 0.10]` (5 crescendo-fade peaks)
 *   - `DECEL_AMPS = [1.00, 0.55, 0.30, 0.17]` (4 impact-decay peaks)
 *   - Log-spaced impulse timing (`0.08 × 1.8^n` seconds from onset)
 *   - Gaussian bump shape per peak, `width = 0.5 × leading-gap`
 *   - Atomic `_startImpulseTrain()` freezes `cam2tgt` + sign + onset-time
 *     + secondary axis at event fire. Envelope runs on frozen state
 *     through ringout (round-4 drift-risk-2 invariant).
 *   - Per-event peak amplitude = `SHAKE_VIEW_ANGLE_MAX × cam2tgt` (at onset)
 *   - `debugAccelImpulse()` / `debugDecelImpulse()` — both ignore the
 *     short-hop/warp-exit gates (debug fire is unconditional).
 *
 * **Removed from round-8:**
 *   - `ONSET_THRESHOLD`, `ONSET_REFRACTORY`, `DSPEED_SMOOTHING` constants
 *   - `_smoothedAbsDSpeed` / `_signedDSpeed` / `_prevPosition` /
 *     `_prevSpeed` / `_hasPrev` / `_subThresholdTime` state
 *   - Position-delta velocity / speed / `|d|v|/dt|` computation loop
 *   - Signal-driven auto-onset branch (`if dSpeed >= threshold → fire`)
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
//  SHAKE TUNABLES (Round 9 — phase-boundary trigger, envelope unchanged)
// ────────────────────────────────────────────────────────────────────────

// Peak view-angle each impulse-train event subtends at its crest.
// Per-event peak amplitude in scene units = this × cam2tgt frozen at onset.
// 0.05 rad ≈ 2.86°. Round-7 range preserved.
const SHAKE_VIEW_ANGLE_MAX = 0.05;

// Asymmetric envelope amplitude arrays (normalized to peakAmp = 1).
// Accel: crescendo-then-fade (5 bounces) — ship pushing INTO medium.
// Decel: impact-then-decay (4 bounces) — ship slamming INTO wall.
const ACCEL_AMPS = [0.30, 1.00, 0.70, 0.35, 0.10];
const DECEL_AMPS = [1.00, 0.55, 0.30, 0.17];

// Log-spacing: gap[n] = IMPULSE_INITIAL_GAP × IMPULSE_SPACING_RATIO^n.
const IMPULSE_INITIAL_GAP = 0.08;
const IMPULSE_SPACING_RATIO = 1.8;

// Per-impulse bump width = IMPULSE_WIDTH_RATIO × leading-gap (Gaussian σ-like).
const IMPULSE_WIDTH_RATIO = 0.5;

// Secondary-axis amplitude as a fraction of primary. Synchronized companion.
const SECONDARY_AXIS_RATIO = 0.20;

// ────────────────────────────────────────────────────────────────────────

// Reusable vectors (avoid per-frame allocation)
const _tmpVec = new THREE.Vector3();
const _velTmp = new THREE.Vector3();

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

    // ── Frame bookkeeping ──
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

    // ── Output ──
    this._shakeOffset = new THREE.Vector3();

    // ── Debug-hook: when non-null, the update loop consumes this on the
    //    next tick and fires immediately, bypassing short-hop/warp-exit gates. ──
    this._pendingDebugFire = null;  // { sign: ±1, cam2tgt: number|null }
  }

  // ── Public surface ──

  get isActive() { return this._phase !== ShipPhase.IDLE; }
  get currentPhase() { return this._phase; }
  /** 0/1 for legacy telemetry; 1 while an event is ringing out. */
  get abruptness() { return this._eventActive ? 1 : 0; }
  get shakeOffset() { return this._shakeOffset; }
  get eventActive() { return this._eventActive; }
  /** Seconds since the current event fired (0 when no event). */
  get eventTime() {
    return this._eventActive ? (this._timeAccum - this._shakeOnsetTime) : 0;
  }
  /** Frozen cam-to-target at onset of current event (0 when no event). */
  get onsetCam2Tgt() { return this._eventActive ? this._shakeOnsetCam2Tgt : 0; }
  /** Frozen sign at onset (+1 accel / -1 decel / 0 idle). */
  get onsetSign() { return this._eventActive ? this._shakeOnsetSign : 0; }

  beginTour({ fromWarp }) {
    this._fromWarp = !!fromWarp;
    this._phase = fromWarp ? ShipPhase.ENTRY : ShipPhase.CRUISE;
    this._resetEventState();
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

    // ── Phase-boundary trigger checks (authoritative event source) ──
    //
    // 1. Debug hooks fire unconditionally (ignore short-hop/warp-exit gates).
    // 2. Natural accel: motionStarted && phase==='traveling' && !isShortTrip && !warpExit.
    // 3. Natural decel: travelComplete && !isShortTrip (warp-exit arrival included).
    //
    // No signal thresholds. Orbit-phase `|d|v|/dt|` cannot fire events — the
    // code path to consume that signal no longer exists.

    if (this._pendingDebugFire !== null) {
      const cam2tgtNow = this._computeCam2Tgt(motionFrame);
      const sign = this._pendingDebugFire.sign;
      const c2t = this._pendingDebugFire.cam2tgt ?? cam2tgtNow;
      this._pendingDebugFire = null;
      this._startImpulseTrain(sign, c2t, motionFrame);
    } else if (
      motionFrame.motionStarted
      && subPhase === 'traveling'
      && !motionFrame.isShortTrip
      && !motionFrame.warpExit
    ) {
      const cam2tgt = this._computeCam2Tgt(motionFrame);
      this._startImpulseTrain(+1, cam2tgt, motionFrame);
    } else if (
      motionFrame.travelComplete
      && !motionFrame.isShortTrip
    ) {
      const cam2tgt = this._computeCam2Tgt(motionFrame);
      this._startImpulseTrain(-1, cam2tgt, motionFrame);
    }

    // ── Sample envelope if an event is running ──
    if (this._eventActive) {
      const t = this._timeAccum - this._shakeOnsetTime;
      if (t > this._shakeEventDuration) {
        this._eventActive = false;
        this._shakeOffset.set(0, 0, 0);
      } else {
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
        const secondaryMag = primaryMag * SECONDARY_AXIS_RATIO;
        this._shakeOffset
          .set(0, primaryMag, 0)
          .addScaledVector(this._shakeSecondaryAxis, secondaryMag);
      }
    } else {
      this._shakeOffset.set(0, 0, 0);
    }
  }

  // ── Internal helpers ──

  _computeCam2Tgt(motionFrame) {
    const p = motionFrame.position;
    const la = motionFrame.lookAtTarget;
    const dx = p.x - la.x, dy = p.y - la.y, dz = p.z - la.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
  }

  /**
   * Fire a new impulse-train event. Atomically freezes:
   *   - sign (selects ACCEL_AMPS vs DECEL_AMPS)
   *   - cam-to-target distance (sets per-event peak amplitude)
   *   - onset time (envelope x-axis zero)
   *   - secondary axis (horizontal-perpendicular to velocity at this instant)
   *
   * Values const for the ringout duration per round-4 drift-risk-2 guard.
   */
  _startImpulseTrain(sign, cam2tgtAtOnset, motionFrame) {
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
    this._shakeEventDuration = times[n - 1] + 4 * widths[n - 1];

    // Freeze horizontal-perpendicular axis from MotionFrame velocity if
    // available; else from fallback.
    const v = motionFrame?.velocity;
    const vx = v?.x || 0, vz = v?.z || 0;
    const hsq = vx * vx + vz * vz;
    if (hsq > 1e-6) {
      const hm = Math.sqrt(hsq);
      _tmpVec.set(vx / hm, 0, vz / hm);
      this._shakeSecondaryAxis.crossVectors(_tmpVec, _UP).normalize();
    } else {
      this._shakeSecondaryAxis.set(1, 0, 0);
    }
  }

  // ── Debug hooks ──

  /**
   * Fire an accel-envelope event next update. Ignores short-hop/warp-exit
   * gates — debug fire is unconditional.
   */
  debugAccelImpulse() {
    this._pendingDebugFire = { sign: +1, cam2tgt: null };
  }

  /**
   * Fire a decel-envelope event next update. Ignores short-hop/warp-exit
   * gates — debug fire is unconditional.
   */
  debugDecelImpulse() {
    this._pendingDebugFire = { sign: -1, cam2tgt: null };
  }

  /**
   * Generic spike (sign defaults to decel). Retained for back-compat with
   * callers in main.js that used the round-6 `debugAbruptTransition` API.
   */
  debugAbruptTransition() {
    this._pendingDebugFire = { sign: -1, cam2tgt: null };
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
    this._resetEventState();
    this._shakeOffset.set(0, 0, 0);
    this._pendingDebugFire = null;
  }

  _resetEventState() {
    this._timeAccum = 0;
    this._eventActive = false;
    this._shakeOnsetTime = 0;
    this._shakeOnsetCam2Tgt = 0;
    this._shakeOnsetSign = 0;
    this._shakePeakAmp = 0;
  }
}
