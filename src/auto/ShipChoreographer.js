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
 *   - Gravity-drive shake — **continuous-amplitude, velocity-change-driven**.
 *
 * **Shake design (round-6, 2026-04-21 — Max's final guidance):**
 *
 *   *"This should be an effect that is applied based on how quickly the
 *   velocity of the ship changes."*
 *
 * The shake magnitude is a direct function of `|d|v|/dt|` (scalar speed
 * derivative) — smoothed slightly to reject frame-to-frame noise. No
 * impulse trains, no phase-boundary triggers, no log-spaced envelopes.
 * When the ship accelerates or decelerates, shake amplitude rises
 * proportionally. When the ship is at constant speed (orbit, coast,
 * stationary), shake amplitude is zero.
 *
 * The shake itself is a sinusoidal **vertical bob** (world-Y primary
 * axis) with a minor synchronized horizontal-perpendicular companion
 * (20% of primary), per Max's "boat cuts through water: vertical
 * bob, minor side roll synchronized with the disturbances."
 *
 * Earlier iterations (rounds 1–5) used an impulse-train model that
 * fired on phase boundaries. Those failed successive recording
 * reviews because (a) the discrete-event timing read as disconnected
 * from the ship's actual motion, and (b) alternating-bump signs with
 * view-angle amplification read as "violent camera whip." Round-6
 * abandons the impulse-train model in favor of continuous-amplitude
 * driven directly by the signal Max named.
 *
 * **View-angle bounding.** At an orbit of distance `d`, a world-Y
 * shake of magnitude `s` causes a view-angle swing of `atan(s/d) ≈
 * s/d` radians (camera.lookAt(target) re-pivots). To keep the swing
 * perceptually stable across body classes (Sol orbits span 0.06 →
 * 40 scene units), the shake magnitude is scaled by `orbitDistance`
 * so view-angle = (fraction of orbit) / 1 = roughly constant radian
 * target. The tunable `SHAKE_VIEW_ANGLE_MAX` caps the view-angle at
 * its peak.
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
//  SHAKE TUNABLES (Round 6)
// ────────────────────────────────────────────────────────────────────────

// Scalar `|d|v|/dt|` below this is considered "smooth" — zero shake.
// Units: scene-units/s². Typical Sol-tour values: 0 during orbit
// (constant speed, only direction changes), ~20-100 during Hermite
// travel mid-curve, much higher at abrupt moments.
const DSPEED_DEADZONE = 20.0;

// Scalar |d|v|/dt| that produces full-amplitude shake. Above this,
// amplitude clamps. Keep above typical cruise-mid peaks so steady
// travel doesn't saturate.
const DSPEED_FULL_SCALE = 300.0;

// Low-pass filter α per frame — how fast smoothed speed-derivative
// tracks the raw signal. α=1 → no smoothing (raw); α near 0 → very
// slow tracking. 0.15 ≈ ~6-frame time constant at 60fps — enough
// to reject per-frame noise but still responsive to real changes.
const DSPEED_SMOOTHING = 0.15;

// Peak view-angle for the shake bob (radians). At full-scale speed
// change, the vertical bob subtends this much view angle. Tunable.
// 0.02 rad ≈ 1.15° — visible tremor, below whipsaw territory.
const SHAKE_VIEW_ANGLE_MAX = 0.02;

// Vertical-bob carrier frequency (Hz). Boat-bob register: too slow
// reads as sea-sick heave; too fast reads as buzzy vibration. 6 Hz
// ≈ pond-ripple / small-boat-rocking tempo.
const BOB_FREQUENCY = 6.0;

// Secondary-axis amplitude as a fraction of primary. Per Max
// 2026-04-21: "x-axis mostly consistent, minor shakes synchronized
// with the greatest disturbances across the y-axis."
const SECONDARY_AXIS_RATIO = 0.20;

// Hard ceiling on shake offset in scene units (for star-class bodies
// where orbitDistance is large). Prevents view-breaking offsets at
// huge framings even if SHAKE_VIEW_ANGLE_MAX were tuned aggressive.
const SHAKE_MAX_AMPLITUDE = 2.0;

// ────────────────────────────────────────────────────────────────────────

// Reusable vectors (avoid per-frame allocation)
const _velocity = new THREE.Vector3();
const _tmpVec = new THREE.Vector3();
const _perp = new THREE.Vector3();

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
    // Smoothed |d|v|/dt| — the signal driving shake amplitude.
    this._smoothedAbsDSpeed = 0;
    // Signed dSpeed/dt (for debug telemetry; not used as a gate anymore)
    this._signedDSpeed = 0;
    // Normalized [0, 1] shake drive (for telemetry + debug UI)
    this._shakeDrive = 0;

    // ── Debug-hook injection (AC #4 — rolls the smoothed signal) ──
    // Debug hooks temporarily inject a speed-derivative spike so Max
    // can eyeball the effect without waiting for a natural phase.
    this._debugInjectedAbsDSpeed = 0;

    // ── Shake bob state ──
    this._timeAccum = 0;
    // Horizontal-perpendicular axis: recomputed per frame from current
    // velocity (cheap; no need to freeze — the axis only mattered in the
    // impulse-train model where events were discrete).
    this._secondaryAxis = new THREE.Vector3(1, 0, 0);
    this._shakeOffset = new THREE.Vector3();
  }

  // ── Public surface ──

  get isActive() { return this._phase !== ShipPhase.IDLE; }
  get currentPhase() { return this._phase; }
  get abruptness() { return this._shakeDrive; }  // normalized [0,1]; legacy name preserved
  get shakeOffset() { return this._shakeOffset; }

  /** Per-frame smoothed |d|v|/dt| (for telemetry). */
  get smoothedAbsDSpeed() { return this._smoothedAbsDSpeed; }

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
      this._shakeDrive = 0;
      return;
    }

    this._timeAccum += deltaTime;

    // Map subsystem phase → ship-axis phase (unchanged from round-3+)
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
    let rawAbsDSpeed = 0;
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
        rawAbsDSpeed = Math.abs(dSpeed);
      }
      this._prevSpeed = currSpeed;
    }
    this._prevPosition.copy(currPos);
    if (this._hasPrev < 2) this._hasPrev++;

    // ── Debug-hook injection (decays quickly) ──
    if (this._debugInjectedAbsDSpeed > 0) {
      rawAbsDSpeed = Math.max(rawAbsDSpeed, this._debugInjectedAbsDSpeed);
      this._debugInjectedAbsDSpeed *= 0.85;  // decay ~6-frame half-life
      if (this._debugInjectedAbsDSpeed < 1) this._debugInjectedAbsDSpeed = 0;
    }

    // ── Low-pass filter the raw signal ──
    this._smoothedAbsDSpeed += (rawAbsDSpeed - this._smoothedAbsDSpeed) * DSPEED_SMOOTHING;

    // ── Normalize to [0, 1] shake drive ──
    if (this._smoothedAbsDSpeed <= DSPEED_DEADZONE) {
      this._shakeDrive = 0;
    } else {
      const range = DSPEED_FULL_SCALE - DSPEED_DEADZONE;
      this._shakeDrive = Math.min(1, (this._smoothedAbsDSpeed - DSPEED_DEADZONE) / range);
    }

    // ── Compute shake amplitude (view-angle bounded, orbit-scale-coupled) ──
    // Target view angle swings from 0 at shakeDrive=0 to SHAKE_VIEW_ANGLE_MAX
    // at shakeDrive=1. Shake-offset magnitude = view-angle * orbitDistance
    // (inverse of the `atan(offset/d) ≈ offset/d` amplification that
    // round-5's Director audit surfaced). Capped at SHAKE_MAX_AMPLITUDE
    // absolute ceiling for star-class bodies.
    const viewAngleRad = this._shakeDrive * SHAKE_VIEW_ANGLE_MAX;
    const orbitDist = this.nav.orbitDistance || 1;
    const shakeAmp = Math.min(viewAngleRad * orbitDist, SHAKE_MAX_AMPLITUDE);

    // ── Emit the offset ──
    if (shakeAmp <= 1e-6) {
      this._shakeOffset.set(0, 0, 0);
    } else {
      // Primary: world-Y vertical bob via sinusoidal carrier.
      const carrier = Math.sin(this._timeAccum * BOB_FREQUENCY * Math.PI * 2);
      const primaryMag = shakeAmp * carrier;

      // Secondary: horizontal-perpendicular to current velocity.
      // Synchronized sign with primary (same carrier) but reduced amplitude.
      const horizSpeedSq = _velocity.x * _velocity.x + _velocity.z * _velocity.z;
      if (horizSpeedSq > 1e-6) {
        const hm = Math.sqrt(horizSpeedSq);
        _tmpVec.set(_velocity.x / hm, 0, _velocity.z / hm);
        this._secondaryAxis.crossVectors(_tmpVec, _UP).normalize();
      } else {
        this._secondaryAxis.set(1, 0, 0);
      }
      const secondaryMag = primaryMag * SECONDARY_AXIS_RATIO;

      this._shakeOffset.set(0, primaryMag, 0)
        .addScaledVector(this._secondaryAxis, secondaryMag);
    }
  }

  // ── Debug hooks (AC #4 + AC #5) ──

  /**
   * Force a brief speed-derivative spike so the shake effect is visible
   * on demand (for AC #5 verification recording). The injected value
   * rolls into the raw |d|v|/dt| each frame and decays quickly.
   */
  debugAbruptTransition() {
    this._debugInjectedAbsDSpeed = DSPEED_FULL_SCALE * 1.5;
  }

  // Round-4 API surface preserved for backward compat with existing
  // callers in main.js; all three just call debugAbruptTransition now.
  debugAccelImpulse() { this.debugAbruptTransition(); }
  debugDecelImpulse() { this.debugAbruptTransition(); }

  /**
   * AC #11 round-4 (preserved): force a speed-change spike scaled to a
   * specified orbit distance. Previously fired a decel-envelope at a
   * specified scale; in round-6 it's equivalent to `debugAbruptTransition`
   * since scale-coupling happens automatically per-frame via nav.orbitDistance.
   */
  debugImpulseAtOrbitDistance(/* orbitDistance, sign */) {
    this.debugAbruptTransition();
  }

  stop() {
    this._phase = ShipPhase.IDLE;
    this._fromWarp = false;
    this._resetSignal();
    this._shakeOffset.set(0, 0, 0);
    this._debugInjectedAbsDSpeed = 0;
  }

  _resetSignal() {
    this._prevPosition.set(0, 0, 0);
    this._prevSpeed = 0;
    this._hasPrev = 0;
    this._smoothedAbsDSpeed = 0;
    this._signedDSpeed = 0;
    this._shakeDrive = 0;
  }
}

// Module-scoped world-up for perpendicular computation (avoids per-call alloc)
const _UP = new THREE.Vector3(0, 1, 0);
