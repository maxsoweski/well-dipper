import * as THREE from 'three';

/**
 * ShipChoreographer — the ship-axis layer on top of `NavigationSubsystem`.
 *
 * Authored 2026-04-21 per WS 2 of the V1 autopilot sequence
 * (docs/WORKSTREAMS/autopilot-ship-axis-motion-2026-04-20.md).
 *
 * Per SYSTEM_CONTRACTS.md §10.1 Two-axis state machine, autopilot's state
 * is two orthogonal axes: ship (ENTRY/CRUISE/APPROACH/STATION) and camera
 * (ESTABLISHING/SHOWCASE/ROVING). This module owns the ship axis.
 *
 * The choreographer does NOT author ship position itself — the subsystem
 * (`NavigationSubsystem`) does that via its existing Hermite/orbit/
 * approach math. The choreographer is a thin layer ON TOP of the
 * subsystem's `MotionFrame`:
 *
 *   - **Ship-axis phase tracking** — maintains an `ENTRY/CRUISE/APPROACH/
 *     STATION/IDLE` state variable that is INDEPENDENT of the subsystem's
 *     internal `descending/traveling/approaching/orbiting` phase enum.
 *     The two vocabularies are orthogonal, not a rename. See brief's
 *     "Phase-name collision" drift risk.
 *
 *   - **Abruptness signal production** — computes d²x/dt² on ship
 *     position (read from subsystem's `MotionFrame.position`) and
 *     normalizes against a smoothing threshold. Per §10.8, the shake
 *     magnitude is a function of this signal; it is NOT authored
 *     per-phase-transition. The subsystem emits `abruptness: 0.0` as
 *     a stub; this module is the real producer.
 *
 *   - **Shake offset production** — additive perturbation vector the
 *     camera module applies to `camera.position` after the subsystem's
 *     authored position is written. Default motion is smooth → zero
 *     abruptness → zero shake. Abrupt motion (debug hook, or future
 *     unexpected avoidance) raises abruptness → non-zero shake offset.
 *
 * Integration (per main.js animation loop):
 *
 *   ```
 *   const frame = flythrough.update(dt);   // reads shake from THIS instance via setShakeProvider
 *   shipChoreographer.update(dt, frame);   // computes abruptness + next-frame shake
 *   ```
 *
 * The 1-frame shake latency (abruptness computed at frame N shows shake
 * at frame N+1) is imperceptible at 60 fps and keeps the API minimal:
 * `FlythroughCamera` reads shake as a public property, and does not
 * import or inspect the choreographer beyond that.
 *
 * Per AC #7, `FlythroughCamera` receives at most a setter
 * (`setShakeProvider`) and a single-line shake-offset add in `update()`.
 * Any other camera-side integration is a contract violation and an
 * escalation to Director.
 */

export const ShipPhase = Object.freeze({
  IDLE:     'IDLE',
  ENTRY:    'ENTRY',
  CRUISE:   'CRUISE',
  APPROACH: 'APPROACH',
  STATION:  'STATION',
});

export class ShipChoreographer {
  /**
   * @param {NavigationSubsystem} navSubsystem — the motion producer (read-only consumer of its MotionFrame)
   */
  constructor(navSubsystem) {
    this.nav = navSubsystem;

    this._phase = ShipPhase.IDLE;
    this._fromWarp = false;           // true during ENTRY leg; flips off on first tour-advance

    // ── Abruptness tracking (position second-derivative) ──
    this._prevPosition = new THREE.Vector3();
    this._prevVelocity = new THREE.Vector3();
    this._hasPrevSamples = 0;          // 0=no history, 1=have position, 2=have velocity
    this._abruptness = 0;              // normalized [0, 1]; consumed by shake
    this._abruptnessDebugBoost = 0;    // debug-hook additive (AC #5 shake-verify)

    // Thresholds — scene-units/s² (tune during recording review if needed).
    // Conservative defaults: normal cinematic motion has accelerations well
    // under 5 units/s². Debug hook overrides via _abruptnessDebugBoost.
    this._abruptnessThreshold = 5.0;
    this._abruptnessMax = 50.0;

    // ── Shake offset (additive perturbation vector) ──
    this._shakeOffset = new THREE.Vector3();
    this._shakeTime = 0;
    this._shakeMaxAmplitude = 0.5;     // scene-units at abruptness=1
    this._shakeFreq = 40;              // Hz — high-frequency buzz
  }

  /**
   * Is the choreographer tracking an active tour leg?
   * Mirrors nav.isActive semantics; used by call sites to gate idle timers etc.
   */
  get isActive() {
    return this._phase !== ShipPhase.IDLE;
  }

  /** Current ship-axis phase ('IDLE' | 'ENTRY' | 'CRUISE' | 'APPROACH' | 'STATION'). */
  get currentPhase() { return this._phase; }

  /** Normalized [0, 1] abruptness signal per §10.8. V1 producer. */
  get abruptness() { return this._abruptness; }

  /** Additive shake offset (THREE.Vector3) consumed by camera module. */
  get shakeOffset() { return this._shakeOffset; }

  /**
   * Kick off tour tracking. Call AFTER the first `navSubsystem.beginMotion`
   * in a tour (warp-exit pickup or tour engage).
   *
   * @param {Object} opts
   * @param {boolean} opts.fromWarp  true if this tour starts from a warp-exit
   *        handoff (the first leg is ENTRY). False if the first leg is CRUISE
   *        (tour engage from free camera, no warp involvement).
   */
  beginTour({ fromWarp }) {
    this._fromWarp = !!fromWarp;
    this._phase = fromWarp ? ShipPhase.ENTRY : ShipPhase.CRUISE;
    this._resetAbruptness();
  }

  /**
   * Tour-advance handler — call from main.js's orbitComplete tour-advance
   * site AFTER the next `navSubsystem.beginMotion` is invoked. Flips the
   * `_fromWarp` flag so subsequent phase mapping uses the CRUISE/APPROACH/
   * STATION 1:1 pattern (ENTRY covers the whole first-leg warp arrival).
   */
  onLegAdvanced() {
    // After the first advance, we're past ENTRY. Subsequent legs use the
    // per-leg CRUISE → APPROACH → STATION mapping.
    if (this._fromWarp) {
      this._fromWarp = false;
    }
  }

  /**
   * Per-frame tick. Call AFTER `flythrough.update(dt)` (and therefore
   * after `navSubsystem.update(dt)` has produced the current frame).
   *
   * @param {number} deltaTime
   * @param {Object} motionFrame — result of the latest `nav.update(dt)`
   *        (pass-through from `flythrough.update(dt)`'s return value).
   */
  update(deltaTime, motionFrame) {
    if (this._phase === ShipPhase.IDLE) {
      this._shakeOffset.set(0, 0, 0);
      return;
    }

    // ── Map subsystem phase → ship-axis phase ──
    const subPhase = motionFrame.phase;

    if (this._fromWarp) {
      // ENTRY covers the whole first leg (subsystem travel + approach +
      // orbit). Ship-axis ENTRY ends when main.js advances the tour (first
      // orbitComplete → beginMotion to next body → onLegAdvanced() flips
      // _fromWarp off).
      this._phase = ShipPhase.ENTRY;
    } else {
      // Post-ENTRY: 1:1 mapping.
      if (subPhase === 'traveling') this._phase = ShipPhase.CRUISE;
      else if (subPhase === 'approaching') this._phase = ShipPhase.APPROACH;
      else if (subPhase === 'orbiting') this._phase = ShipPhase.STATION;
      else this._phase = ShipPhase.IDLE;
    }

    // ── Compute abruptness from position-delta history ──
    const currPos = motionFrame.position;
    if (deltaTime > 1e-6) {
      if (this._hasPrevSamples >= 1) {
        const vx = (currPos.x - this._prevPosition.x) / deltaTime;
        const vy = (currPos.y - this._prevPosition.y) / deltaTime;
        const vz = (currPos.z - this._prevPosition.z) / deltaTime;

        if (this._hasPrevSamples >= 2) {
          const ax = (vx - this._prevVelocity.x) / deltaTime;
          const ay = (vy - this._prevVelocity.y) / deltaTime;
          const az = (vz - this._prevVelocity.z) / deltaTime;
          const accelMag = Math.sqrt(ax * ax + ay * ay + az * az);

          // Normalize [0, 1]: below threshold = 0, above = scales to 1 at max.
          const range = this._abruptnessMax - this._abruptnessThreshold;
          const normalized = Math.max(0, (accelMag - this._abruptnessThreshold) / range);
          this._abruptness = Math.min(1, normalized);
        }

        this._prevVelocity.set(vx, vy, vz);
      }
    }
    this._prevPosition.copy(currPos);
    if (this._hasPrevSamples < 2) this._hasPrevSamples++;

    // ── Debug boost (AC #5 shake-verification recording). Decays quickly. ──
    if (this._abruptnessDebugBoost > 0) {
      this._abruptness = Math.max(this._abruptness, this._abruptnessDebugBoost);
      this._abruptnessDebugBoost *= 0.90;
      if (this._abruptnessDebugBoost < 0.01) this._abruptnessDebugBoost = 0;
    }

    // ── Shake offset from abruptness ──
    // Pseudo-random triangle-like noise at high frequency, per-axis phase-
    // offset. Smooth, gated: abruptness=0 → zero offset.
    this._shakeTime += deltaTime;
    if (this._abruptness > 0.01) {
      const amp = this._abruptness * this._shakeMaxAmplitude;
      const f = this._shakeFreq;
      this._shakeOffset.set(
        amp * Math.sin(this._shakeTime * f * 1.0 + 0.0),
        amp * Math.sin(this._shakeTime * f * 1.3 + 1.2),
        amp * Math.sin(this._shakeTime * f * 0.7 + 2.4),
      );
    } else {
      this._shakeOffset.set(0, 0, 0);
    }
  }

  /**
   * Debug hook for AC #5's shake-verification recording.
   * Forces a one-time abruptness spike that decays over ~0.5s, producing
   * a visible shake without requiring an actual motion discontinuity.
   * Exposed via `window._autopilot.debugAbruptTransition()` (wired in
   * main.js).
   */
  debugAbruptTransition() {
    this._abruptnessDebugBoost = 1.0;
  }

  /** Stop choreographer. Clears phase + shake. Called on autopilot-off. */
  stop() {
    this._phase = ShipPhase.IDLE;
    this._fromWarp = false;
    this._abruptness = 0;
    this._abruptnessDebugBoost = 0;
    this._shakeOffset.set(0, 0, 0);
    this._resetAbruptness();
  }

  _resetAbruptness() {
    this._hasPrevSamples = 0;
    this._prevPosition.set(0, 0, 0);
    this._prevVelocity.set(0, 0, 0);
    this._abruptness = 0;
  }
}
