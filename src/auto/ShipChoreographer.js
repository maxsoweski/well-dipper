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
 *
 *   - **Abruptness signal production** — per `docs/SYSTEM_CONTRACTS.md`
 *     §10.8 (post-shake-redesign refinement, 2026-04-21): the trigger is
 *     the **scalar speed derivative `d|v|/dt`**, NOT vector acceleration
 *     magnitude. Centripetal acceleration during constant-speed curves
 *     does NOT fire shake by design — turning at constant speed is not
 *     "cutting across the medium." The sign of `d|v|/dt` discriminates
 *     accel (>0) from decel (<0).
 *
 *   - **Single-axis logarithmic impulse-train shake** — per the
 *     shake-redesign brief (`docs/WORKSTREAMS/autopilot-shake-redesign-
 *     2026-04-21.md`), the shake-offset is a scalar × one fixed unit
 *     vector (perpendicular to ship velocity at impulse onset, frozen
 *     for the duration of the impulse event). The envelope is a train
 *     of 3–5 discrete bumps with logarithmically-spaced timing and
 *     logarithmically-decaying amplitudes. Accel and decel events produce
 *     temporally-mirrored amplitude sequences (accel: crescendo-then-fade;
 *     decel: impact-then-decay) per Max's "in reverse" verbatim.
 *
 * Integration (per main.js animation loop):
 *
 *   ```
 *   const frame = flythrough.update(dt);   // reads shake from THIS instance via setShakeProvider
 *   shipChoreographer.update(dt, frame);   // computes signal + next-frame shake
 *   ```
 *
 * Per AC #7 of WS 2, `FlythroughCamera` receives a single-line additive
 * shake-offset add; the shake *values* change across the redesign but
 * the camera-side plumbing does not.
 */

export const ShipPhase = Object.freeze({
  IDLE:     'IDLE',
  ENTRY:    'ENTRY',
  CRUISE:   'CRUISE',
  APPROACH: 'APPROACH',
  STATION:  'STATION',
});

// ────────────────────────────────────────────────────────────────────────
//  IMPULSE-TRAIN ENVELOPE PARAMETERS (tunable during recording review)
// ────────────────────────────────────────────────────────────────────────

// Log-spacing geometric ratio (Δt_n = Δt_0 · φ^n). φ > 1 → each gap
// grows relative to the last.  Range suggested in brief: 1.6–2.0.
const IMPULSE_SPACING_RATIO = 1.8;

// Initial impulse gap — time from onset to first impulse peak.
const IMPULSE_INITIAL_GAP = 0.08;  // seconds

// Per-impulse bump width as a fraction of its leading gap. Narrow keeps
// bumps from overlapping as gaps shrink early.
const IMPULSE_WIDTH_RATIO = 0.5;

// Accel envelope — "crescendo-then-fade." Ship pushes INTO the ether;
// waves build as it breaks through, release as it pulls ahead.
// Shape [small, large, medium, small, tiny].
const ACCEL_AMPS = [0.30, 1.00, 0.70, 0.35, 0.10];

// Decel envelope — "impact-then-decay." Ship slams into the wall of
// ether; largest impulse first, geometric decay (δ≈0.55) after.
// Shape [large, medium, small, tiny].
const DECEL_AMPS = [1.00, 0.55, 0.30, 0.17];

// Scale of the impulse-train peak (scene-units at full-strength event).
const SHAKE_MAX_AMPLITUDE = 0.6;

// Abruptness onset threshold — `_abruptness` must cross this from zero
// to trigger a new impulse train. Cross-threshold gates against smooth
// motion re-triggering shake during its own tail.
const ONSET_TRIGGER_THRESHOLD = 0.05;

// ────────────────────────────────────────────────────────────────────────

// Reusable vectors (avoid per-frame allocation)
const _tmpVec = new THREE.Vector3();
const _velocity = new THREE.Vector3();
const _perp = new THREE.Vector3();

export class ShipChoreographer {
  /**
   * @param {NavigationSubsystem} navSubsystem — the motion producer
   */
  constructor(navSubsystem) {
    this.nav = navSubsystem;

    this._phase = ShipPhase.IDLE;
    this._fromWarp = false;

    // ── Abruptness signal state (scalar d|v|/dt per §10.8 refinement) ──
    this._prevPosition = new THREE.Vector3();
    this._prevSpeed = 0;               // scalar |velocity| at prev frame
    this._hasPrevPos = false;
    this._hasPrevSpeed = false;
    this._dSpeedDt = 0;                // signed: + = accel, - = decel
    this._abruptness = 0;              // normalized [0, 1]; feeds shake onset

    // d|v|/dt scalar thresholds (TUNABLE during recording review).
    // Tuned empirically against the WS 2 primary recording post-refactor:
    //   - Smooth motion: |d|v|/dt| typically < 30 units/s²
    //   - Warp-exit transition (authored deceleration spike): >>300 units/s²
    //   - Centripetal during curved CRUISE: ~0 (velocity magnitude nearly
    //     constant even though direction changes sharply — this is the
    //     whole point of the signal change: direction change at constant
    //     speed does not shake).
    this._abruptnessThreshold = 10000.0;
    this._abruptnessMax = 100000.0;

    // ── Debug boost (AC #5 + AC #4 shake-verification hooks) ──
    // Debug hooks force an onset event without requiring a real signal
    // spike. The boost sets `_abruptness = 1.0` once, and forces the
    // next onset-check branch to use the chosen sign.
    this._abruptnessDebugBoost = 0;
    this._debugForcedSign = 0;         // +1 = accel, -1 = decel, 0 = none

    // ── Impulse-train state (precomputed at onset, read per frame) ──
    this._shakeActive = false;
    this._shakeOnsetTime = 0;           // absolute time at onset (accumulator seconds)
    this._shakeAxis = new THREE.Vector3();  // frozen perpendicular-to-velocity unit vector
    this._shakeScale = 0;               // overall magnitude scale for this train (0..1)
    this._shakeTimes = [];              // precomputed impulse peak times (relative to onset)
    this._shakeAmps = [];               // precomputed impulse peak amplitudes (normalized)
    this._shakeWidths = [];             // precomputed impulse bump widths

    this._timeAccum = 0;                // monotonic time accumulator

    // ── Output vector (camera consumes via setShakeProvider hook) ──
    this._shakeOffset = new THREE.Vector3();
  }

  /** Is the choreographer tracking an active tour leg? */
  get isActive() {
    return this._phase !== ShipPhase.IDLE;
  }

  /** Current ship-axis phase. */
  get currentPhase() { return this._phase; }

  /** Normalized [0, 1] abruptness signal per §10.8. */
  get abruptness() { return this._abruptness; }

  /** Additive shake offset (THREE.Vector3) consumed by camera module. */
  get shakeOffset() { return this._shakeOffset; }

  /**
   * Kick off tour tracking. Call AFTER the first `navSubsystem.beginMotion`.
   * @param {Object} opts
   * @param {boolean} opts.fromWarp  true if this tour starts from a warp-exit
   */
  beginTour({ fromWarp }) {
    this._fromWarp = !!fromWarp;
    this._phase = fromWarp ? ShipPhase.ENTRY : ShipPhase.CRUISE;
    this._resetSignal();
    this._endImpulseTrain();
  }

  /** Tour-advance handler — flips _fromWarp off after first post-ENTRY advance. */
  onLegAdvanced() {
    if (this._fromWarp) this._fromWarp = false;
  }

  /**
   * Per-frame tick. Call AFTER `flythrough.update(dt)`.
   * @param {number} deltaTime
   * @param {Object} motionFrame — result of `nav.update(dt)`
   */
  update(deltaTime, motionFrame) {
    if (this._phase === ShipPhase.IDLE) {
      this._shakeOffset.set(0, 0, 0);
      return;
    }

    this._timeAccum += deltaTime;

    // ── Map subsystem phase → ship-axis phase ──
    const subPhase = motionFrame.phase;
    if (this._fromWarp) {
      this._phase = ShipPhase.ENTRY;
    } else {
      if (subPhase === 'traveling') this._phase = ShipPhase.CRUISE;
      else if (subPhase === 'approaching') this._phase = ShipPhase.APPROACH;
      else if (subPhase === 'orbiting') this._phase = ShipPhase.STATION;
      else this._phase = ShipPhase.IDLE;
    }

    // ── Compute d|v|/dt (scalar speed derivative) per §10.8 ──
    const currPos = motionFrame.position;
    let signedDSpeed = 0;  // signed d|v|/dt this frame
    if (deltaTime > 1e-6) {
      if (this._hasPrevPos) {
        // Velocity vector (for axis derivation + speed magnitude)
        _velocity.set(
          (currPos.x - this._prevPosition.x) / deltaTime,
          (currPos.y - this._prevPosition.y) / deltaTime,
          (currPos.z - this._prevPosition.z) / deltaTime,
        );
        const currSpeed = _velocity.length();

        if (this._hasPrevSpeed) {
          signedDSpeed = (currSpeed - this._prevSpeed) / deltaTime;
          this._dSpeedDt = signedDSpeed;

          // Normalize |d|v|/dt| to [0, 1] via threshold/max tuning.
          const absDSpeed = Math.abs(signedDSpeed);
          const range = this._abruptnessMax - this._abruptnessThreshold;
          const normalized = Math.max(0, (absDSpeed - this._abruptnessThreshold) / range);
          this._abruptness = Math.min(1, normalized);
        }

        this._prevSpeed = currSpeed;
        this._hasPrevSpeed = true;
      }
      this._prevPosition.copy(currPos);
      this._hasPrevPos = true;
    }

    // ── Debug boost (forces onset regardless of real signal) ──
    if (this._abruptnessDebugBoost > 0) {
      this._abruptness = Math.max(this._abruptness, this._abruptnessDebugBoost);
      this._abruptnessDebugBoost = 0;  // one-shot; consumed here
    }

    // ── Onset detection: new impulse train if _abruptness crosses trigger ──
    // Re-trigger only if we're NOT currently in an active shake (events don't
    // stack) OR if a new debug boost just forced a higher onset.
    if (!this._shakeActive && this._abruptness >= ONSET_TRIGGER_THRESHOLD) {
      let sign;
      if (this._debugForcedSign !== 0) {
        sign = this._debugForcedSign;
        this._debugForcedSign = 0;  // consumed
      } else {
        sign = signedDSpeed >= 0 ? 1 : -1;
      }
      this._beginImpulseTrain(_velocity, sign, this._abruptness);
    }

    // ── Per-frame impulse-train sample ──
    if (this._shakeActive) {
      const tRel = this._timeAccum - this._shakeOnsetTime;
      const envelope = this._sampleImpulseTrain(tRel);

      if (envelope === null) {
        // Train exhausted; end
        this._endImpulseTrain();
      } else {
        this._shakeOffset.copy(this._shakeAxis).multiplyScalar(
          envelope * this._shakeScale * SHAKE_MAX_AMPLITUDE,
        );
      }
    }

    if (!this._shakeActive) {
      this._shakeOffset.set(0, 0, 0);
    }
  }

  // ────────────────────────────────────────────────────────────────────
  //  Impulse-train internals
  // ────────────────────────────────────────────────────────────────────

  /**
   * Begin a new impulse-train event. Freezes the axis, sign, onset time;
   * precomputes the train's impulse times + amplitudes + widths per
   * the log envelope parameters.
   */
  _beginImpulseTrain(velocity, sign, scale) {
    // ── Pick perpendicular-to-velocity axis (stable, in the world-up plane) ──
    // `velocity × worldUp` gives a horizontal sideways vector. If velocity
    // is nearly parallel to world-up, fall back to a world-X perpendicular.
    const speed = velocity.length();
    if (speed > 1e-4) {
      _tmpVec.copy(velocity).divideScalar(speed);  // unit velocity
      _perp.crossVectors(_tmpVec, new THREE.Vector3(0, 1, 0));
      if (_perp.lengthSq() < 1e-6) {
        // Velocity parallel to Y — use X-axis fallback
        _perp.crossVectors(_tmpVec, new THREE.Vector3(1, 0, 0));
      }
      _perp.normalize();
    } else {
      // No velocity known — default to world-X (imparts a left-right shake)
      _perp.set(1, 0, 0);
    }
    this._shakeAxis.copy(_perp);

    // ── Pick amplitude sequence per sign ──
    const amps = sign >= 0 ? ACCEL_AMPS : DECEL_AMPS;

    // ── Precompute impulse times + widths ──
    // Δt_0 = IMPULSE_INITIAL_GAP; each next gap Δt_n = Δt_0 · φ^n.
    // Peak time is cumulative: t_n = Σ_{k=0..n} Δt_k (at k=0 → Δt_0).
    const times = [];
    const widths = [];
    let t = 0;
    let gap = IMPULSE_INITIAL_GAP;
    for (let n = 0; n < amps.length; n++) {
      t += gap;
      times.push(t);
      widths.push(gap * IMPULSE_WIDTH_RATIO);
      gap *= IMPULSE_SPACING_RATIO;
    }

    this._shakeActive = true;
    this._shakeOnsetTime = this._timeAccum;
    this._shakeScale = scale;
    this._shakeTimes = times;
    this._shakeAmps = amps.slice();
    this._shakeWidths = widths;
  }

  /**
   * Sample the impulse train at relative time tRel (seconds since onset).
   * Returns envelope value in [-1, 1] (signed half-sine bump); null if
   * past the train's end.
   */
  _sampleImpulseTrain(tRel) {
    if (this._shakeTimes.length === 0) return null;

    // Find the impulse currently active (if any). Each impulse bump spans
    // [t_n - width/2, t_n + width/2]; outside those windows, envelope = 0.
    for (let n = 0; n < this._shakeTimes.length; n++) {
      const center = this._shakeTimes[n];
      const halfWidth = this._shakeWidths[n] * 0.5;
      const start = center - halfWidth;
      const end = center + halfWidth;

      if (tRel >= start && tRel <= end) {
        // Half-sine bump, peaks at center
        const bumpT = (tRel - start) / (end - start);  // 0..1
        const bumpAmp = this._shakeAmps[n] * Math.sin(Math.PI * bumpT);
        // Alternate bump direction for visible "skipping" — each bump
        // swings the opposite way of the previous. Keeps the shake
        // visibly oscillating across zero (like a pebble bouncing
        // above/below the water surface).
        const swingSign = (n % 2 === 0) ? 1 : -1;
        return bumpAmp * swingSign;
      }
    }

    // Past the last impulse? End the train.
    const lastEnd = this._shakeTimes[this._shakeTimes.length - 1]
      + this._shakeWidths[this._shakeWidths.length - 1] * 0.5;
    if (tRel > lastEnd) return null;

    // In a gap between impulses
    return 0;
  }

  _endImpulseTrain() {
    this._shakeActive = false;
    this._shakeScale = 0;
    this._shakeTimes.length = 0;
    this._shakeAmps.length = 0;
    this._shakeWidths.length = 0;
    this._shakeOffset.set(0, 0, 0);
  }

  // ────────────────────────────────────────────────────────────────────
  //  Debug hooks (AC #4 + AC #5 — shake-verification recordings)
  // ────────────────────────────────────────────────────────────────────

  /**
   * Force an accel-envelope impulse event. Bypasses the signal threshold
   * via `_abruptnessDebugBoost`; next onset-detection branch uses +1 sign.
   * Exposed via `window._autopilot.debugAccelImpulse()`.
   */
  debugAccelImpulse() {
    this._abruptnessDebugBoost = 1.0;
    this._debugForcedSign = 1;
    // If a shake is already active (e.g., rapid re-trigger), end it so
    // this new event gets a clean onset.
    if (this._shakeActive) this._endImpulseTrain();
  }

  /**
   * Force a decel-envelope impulse event. Mirror of debugAccelImpulse with
   * -1 sign → the impact-then-decay amplitude sequence.
   * Exposed via `window._autopilot.debugDecelImpulse()`.
   */
  debugDecelImpulse() {
    this._abruptnessDebugBoost = 1.0;
    this._debugForcedSign = -1;
    if (this._shakeActive) this._endImpulseTrain();
  }

  /**
   * Legacy debug hook from WS 2 shake-verify recording. Retained as an
   * alias for debugDecelImpulse (closest to the warp-exit deceleration
   * scenario it was originally written against). Callers in recordings /
   * external tools don't break.
   */
  debugAbruptTransition() {
    this.debugDecelImpulse();
  }

  /** Stop choreographer. Called on autopilot-off. */
  stop() {
    this._phase = ShipPhase.IDLE;
    this._fromWarp = false;
    this._endImpulseTrain();
    this._abruptnessDebugBoost = 0;
    this._debugForcedSign = 0;
    this._resetSignal();
  }

  _resetSignal() {
    this._hasPrevPos = false;
    this._hasPrevSpeed = false;
    this._prevPosition.set(0, 0, 0);
    this._prevSpeed = 0;
    this._dSpeedDt = 0;
    this._abruptness = 0;
  }
}
