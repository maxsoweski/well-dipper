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

// Secondary-axis amplitude as a fraction of primary. The primary axis
// (world Y, vertical) carries the main shake; the secondary axis (horizontal
// perpendicular to velocity) carries a minor synchronized companion shake.
// Per Max 2026-04-21: "the x-axis is going to be pretty consistent, maybe
// with minor shakes ... synchronized with the greatest disturbances across
// the y-axis."
const SECONDARY_AXIS_RATIO = 0.20;

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

    // ── Position tracking (used for velocity derivation at impulse onset) ──
    this._prevPosition = new THREE.Vector3();
    this._hasPrevPos = false;

    // Live shake intensity readout (envelope sample, normalized [0,1]).
    // Informational; future BGM/audio coupling reads this. NOT a gate.
    this._abruptness = 0;

    // ── Debug-hook flags (AC #4 + AC #5 — shake-verification recordings) ──
    this._abruptnessDebugBoost = 0;
    this._debugForcedSign = 0;          // +1 = accel, -1 = decel, 0 = none

    // ── Impulse-train state (precomputed at onset, read per frame) ──
    this._shakeActive = false;
    this._shakeOnsetTime = 0;            // absolute time at onset (accumulator seconds)
    // Primary axis = world Y (vertical bob — boat cuts up-down through water).
    // Frozen at onset for the duration of the impulse train.
    this._shakePrimaryAxis = new THREE.Vector3(0, 1, 0);
    // Secondary axis = horizontal perpendicular to velocity at onset (cross with Y).
    // Carries a minor synchronized companion shake at SECONDARY_AXIS_RATIO.
    this._shakeSecondaryAxis = new THREE.Vector3(1, 0, 0);
    this._shakeScale = 0;                // overall magnitude scale for this train (0..1)
    this._shakeTimes = [];               // precomputed impulse peak times (relative to onset)
    this._shakeAmps = [];                // precomputed impulse peak amplitudes (normalized)
    this._shakeWidths = [];              // precomputed impulse bump widths

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

    // ── Track velocity (still used for axis derivation at onset) ──
    const currPos = motionFrame.position;
    if (deltaTime > 1e-6 && this._hasPrevPos) {
      _velocity.set(
        (currPos.x - this._prevPosition.x) / deltaTime,
        (currPos.y - this._prevPosition.y) / deltaTime,
        (currPos.z - this._prevPosition.z) / deltaTime,
      );
    } else {
      _velocity.set(0, 0, 0);
    }
    this._prevPosition.copy(currPos);
    this._hasPrevPos = true;

    // ── Phase-boundary onset detection (per Max 2026-04-21 redesign) ──
    // Trigger shake at the MOMENTS where speed magnitude changes onset:
    //   - motionStarted entering 'traveling' = "just began accelerating"  → +1 sign
    //   - travelComplete one-shot           = "just began decelerating"  → -1 sign
    // These are the felt-experience moments — Max: "right when you're first
    // accelerating, and when you begin braking, or decelerating." Sustained
    // smooth motion in between does NOT shake; the discontinuity-onset is
    // the drive's compensation moment.
    if (motionFrame.motionStarted && motionFrame.phase === 'traveling') {
      // Begin acceleration impulse
      this._beginImpulseTrain(_velocity, +1, 1.0);
    } else if (motionFrame.travelComplete) {
      // Begin deceleration impulse (subsystem is internally about to enter
      // approach or orbit phase — the ship "hits the wall of ether")
      this._beginImpulseTrain(_velocity, -1, 1.0);
    }

    // ── Debug-hook boost (still bypasses for AC #4 + AC #5 recordings) ──
    if (this._abruptnessDebugBoost > 0) {
      const sign = this._debugForcedSign !== 0 ? this._debugForcedSign : -1;
      this._beginImpulseTrain(_velocity, sign, 1.0);
      this._abruptnessDebugBoost = 0;
      this._debugForcedSign = 0;
    }

    // Abruptness is now the live shake intensity (envelope sample), not a
    // gating signal. Useful for telemetry / future audio coupling.
    this._abruptness = this._shakeActive
      ? Math.min(1, this._shakeOffset.length() / SHAKE_MAX_AMPLITUDE)
      : 0;

    // ── Per-frame impulse-train sample ──
    if (this._shakeActive) {
      const tRel = this._timeAccum - this._shakeOnsetTime;
      const envelope = this._sampleImpulseTrain(tRel);

      if (envelope === null) {
        // Train exhausted; end
        this._endImpulseTrain();
      } else {
        // Primary axis (world Y) gets full envelope
        const primaryMag = envelope * this._shakeScale * SHAKE_MAX_AMPLITUDE;
        // Secondary axis (horizontal-perp) gets fractional envelope, same sign
        // → "synchronized minor shake" per Max's design intent
        const secondaryMag = primaryMag * SECONDARY_AXIS_RATIO;
        this._shakeOffset
          .copy(this._shakePrimaryAxis).multiplyScalar(primaryMag)
          .addScaledVector(this._shakeSecondaryAxis, secondaryMag);
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
   * Begin a new impulse-train event. Freezes the axes, sign, onset time;
   * precomputes the train's impulse times + amplitudes + widths.
   *
   * Axes (per Max 2026-04-21 redesign):
   *   - Primary axis = world Y (vertical). The boat-cuts-through-water
   *     analogy: forward motion is on the horizontal plane, the bob-shake
   *     is up-and-down. Frozen at world-up regardless of ship orientation.
   *   - Secondary axis = horizontal perpendicular to velocity. Carries a
   *     minor synchronized companion shake at SECONDARY_AXIS_RATIO of
   *     primary amplitude — the ship rolls slightly side-to-side as it
   *     bobs. If velocity is purely vertical (rare), secondary falls back
   *     to world-X.
   */
  _beginImpulseTrain(velocity, sign, scale) {
    // Primary: world Y (always)
    this._shakePrimaryAxis.set(0, 1, 0);

    // Secondary: horizontal perpendicular to ship's horizontal velocity component.
    // Project velocity onto the X-Z plane, then take cross with Y to get
    // a stable horizontal sideways vector.
    const horizSpeedSq = velocity.x * velocity.x + velocity.z * velocity.z;
    if (horizSpeedSq > 1e-6) {
      const horizMag = Math.sqrt(horizSpeedSq);
      _tmpVec.set(velocity.x / horizMag, 0, velocity.z / horizMag);
      _perp.crossVectors(_tmpVec, this._shakePrimaryAxis);  // perpendicular in X-Z plane
      _perp.normalize();
    } else {
      // No horizontal velocity — fall back to world-X
      _perp.set(1, 0, 0);
    }
    this._shakeSecondaryAxis.copy(_perp);

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
    this._prevPosition.set(0, 0, 0);
    this._abruptness = 0;
  }
}
