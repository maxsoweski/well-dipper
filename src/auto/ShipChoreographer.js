import * as THREE from 'three';
import { simRandom } from '../core/SimRandom.js';

/**
 * ShipChoreographer — the ship-axis layer on top of `NavigationSubsystem`.
 *
 * Per SYSTEM_CONTRACTS.md §10.1 the autopilot state is two orthogonal axes:
 * ship (ENTRY/CRUISE/APPROACH/STATION) and camera (ESTABLISHING/SHOWCASE/
 * ROVING). This module owns the ship axis.
 *
 * **Responsibilities:**
 *   - Ship-axis phase tracking (ENTRY/CRUISE/APPROACH/STATION/IDLE).
 *   - Gravity-drive shake — **rotation-only sustained tremor**, signal-gated
 *     to `phase === 'traveling' && !isShortTrip`, per Bible §8H round-10.
 *
 * ──────────────────────────────────────────────────────────────────
 *  Shake design (round-10, 2026-04-21 — tremor over carrier)
 * ──────────────────────────────────────────────────────────────────
 *
 * **Bible §8H (amended round-10):** the friction-against-ether event
 * renders as a **high-frequency small-amplitude sustained tremor**
 * during the sharp-motion window — not discrete bounces at phase
 * boundaries. The player's felt experience is aircraft turbulence:
 * a subtle 1–2s judder in the camera while the drive is cutting
 * across a density spike in the medium. Accel/decel asymmetry lives
 * in the **amplitude envelope shape** over the tremor's duration
 * (accel crescendo-then-fade, decel impact-then-decay), not in a
 * bounce count. The primary surface is camera **rotation** (pitch/
 * yaw/roll offsets applied to camera orientation), not camera
 * position — translating the camera moves every framed object, which
 * reads as the scene bouncing rather than the cockpit juddering.
 *
 * **Trigger model.** Continuous `|d|v|/dt|` signal derived from
 * position-delta per frame, smoothed α=0.15, phase-gated to
 * `motionFrame.phase === 'traveling' && !motionFrame.isShortTrip`.
 * Outside that gate, no signal derivation, no onset check. An event
 * fires when the smoothed signal crosses `SIGNAL_ONSET_THRESHOLD`.
 * Sign of `dSpeed` at onset picks `accel` vs `decel` envelope.
 * `motionFrame.warpExit === true` suppresses accel-side firing only
 * (the sharp-accel happened inside the portal). Between same-type
 * events on the same leg, `SIGNAL_EVENT_COOLDOWN` seconds of silence
 * is required so a single sharp window doesn't fire twice.
 *
 * **Envelope shape.** `amplitude(t) = env_curve(t) × peak_per_axis`
 * where `env_curve` is:
 *   - ACCEL: smoothstep ramp-in [0, 0.6 × dur] to peak, smoothstep
 *     ramp-out [0.6 × dur, dur] to 0 (crescendo-then-fade).
 *   - DECEL: smoothstep fast ramp-in [0, 0.1 × dur] to peak,
 *     exponential decay thereafter (impact-then-decay).
 *
 * **Carrier.** Three independent sinusoidal carriers, one per axis,
 * with slight frequency detuning (pitch 20Hz, yaw 22Hz, roll 19Hz)
 * AND random phase offsets at event onset. Detuning + phase scatter
 * prevents Lissajous lock-in that would read as mechanical wobble.
 *
 * **Surface.** Emits `shakeEuler = { pitch, yaw, roll }` in radians.
 * FlythroughCamera composes this onto `camera.quaternion` AFTER
 * `camera.lookAt()` has run — rotation in camera-local space, not
 * world space. **`camera.position` is NEVER mutated by the shake
 * mechanism** (AC #19 invariant — programmatically asserted).
 *
 * **Belt-and-suspenders phase gate.** Both trigger and sampling
 * surfaces check phase. If the ship transitions out of `traveling`
 * mid-event, the event aborts and shakeEuler resets to zero.
 *
 * **Retired from round-8/9:** ACCEL_AMPS, DECEL_AMPS,
 * IMPULSE_INITIAL_GAP, IMPULSE_SPACING_RATIO, SHAKE_VIEW_ANGLE_MAX,
 * `_shakeOnsetCam2Tgt`, `_shakeOnsetSign`, Gaussian-bump log-impulse
 * machinery, `debugImpulseAtOrbitDistance(c2t, sign)`. Surface changed
 * from `shakeOffset: Vector3` to `shakeEuler: {pitch, yaw, roll}`.
 *
 * Integration: main.js calls `shipChoreographer.update(dt, motionFrame)`
 * after `flythrough.update(dt)`; FlythroughCamera reads `shakeEuler`
 * via the provider hook and composes it onto camera.quaternion.
 */

export const ShipPhase = Object.freeze({
  IDLE:     'IDLE',
  ENTRY:    'ENTRY',
  CRUISE:   'CRUISE',
  APPROACH: 'APPROACH',
  STATION:  'STATION',
});

// ════════════════════════════════════════════════════════════════════════
//  SHAKE TUNABLES (Round 10 — rotation-only sustained tremor)
//
//  These are authored at top-of-file per Max's "configurable so we can
//  adjust" ask. Inline docs name each constant's role, suggested range,
//  and V1 seed. Max edits during review via F12.
// ════════════════════════════════════════════════════════════════════════

/**
 * Tremor event total duration in seconds.
 * Max's ask: 1-2 second shake, subtle. V1 seed = 1.5s.
 * Bounded [1.0, 2.0].
 */
const TREMOR_ENVELOPE_DURATION = 1.5;

/**
 * Minimum seconds of sub-threshold signal between two same-type events
 * on the same leg. Prevents stutter-firing within a single sharp window.
 * V1 seed = 0.5s. Bounded [0.3, 1.0].
 */
const SIGNAL_EVENT_COOLDOWN = 0.5;

/**
 * `|d|v|/dt|` magnitude that triggers a new event. Scene-units/s².
 * Sol tour typical peak during Hermite sharp-motion is ~180.
 * V1 seed 35 sits well above orbit pitch/breathe noise (~5-30) and
 * well below sharp-cruise peak (~180).
 */
const SIGNAL_ONSET_THRESHOLD = 35.0;

/**
 * Low-pass smoothing α per frame for the raw `|d|v|/dt|` signal.
 * α=1 → raw, α near 0 → very slow. 0.15 ≈ 6-frame time constant
 * at 60fps. Enough to reject per-frame jitter without lag.
 */
const SIGNAL_SMOOTHING = 0.15;

/**
 * Loop (c) — fraction of the running leg-max that the signal must pull
 * back by before a shake event is eligible to fire. 0.20 = 20% drop
 * from peak. 5% was too aggressive: it fired on the first small dip
 * of a double-humped decel envelope (capture 2026-04-24: decel event
 * fired at signal=1464 ≈ 95% of a local peak 1542, but the true
 * envelope peak was 2100 ≈ 500ms later — resulting in a 70%-of-peak
 * onset that leads the felt deceleration). 20% requires a meaningful
 * pullback so transient dips during multi-stage decel profiles
 * (e.g. Hermite terminal + arrival blend) don't prematurely fire.
 * Tradeoff: fires at ~80% of peak on descent, with ~200-400ms lag
 * from true peak, which is still imperceptible at 60fps but avoids
 * the pre-peak premature-fire failure mode.
 */
const PEAK_PULLBACK_FRAC = 0.20;

/**
 * Peak pitch (camera-local X) rotation amplitude at envelope max, in degrees.
 * V1 seed 1.0°; §A8 (2026-04-27) reduced to 0.2° per Max's verbatim
 * "reduce the intensity of the shaking effect by 80%". Head-nod axis.
 * AC #6.1 bounds peak amplitude post-§A8.
 */
const TREMOR_PITCH_PEAK_DEG = 0.2;

/**
 * Peak yaw (camera-local Y) rotation amplitude at envelope max, in degrees.
 * V1 seed 1.0°; §A8 (2026-04-27) reduced to 0.2° (×0.2). Head-shake axis.
 * AC #6.1 bounds peak amplitude post-§A8.
 */
const TREMOR_YAW_PEAK_DEG = 0.2;

/**
 * Peak roll (camera-local Z) rotation amplitude at envelope max, in degrees.
 * V1 seed 0.5°; §A8 (2026-04-27) reduced to 0.1° (×0.2). Cockpit-banking
 * cue; smaller default since large roll reads as ship tilt rather than
 * pilot tremor. AC #6.1 bounds peak amplitude post-§A8.
 */
const TREMOR_ROLL_PEAK_DEG = 0.1;

/**
 * Per-axis carrier frequencies in Hz. Slight detuning across axes
 * prevents Lissajous-lock patterns (three identical freqs would
 * trace a repeating figure that reads as mechanical wobble).
 * V1 seeds roughly 20Hz ± a few.
 */
const PITCH_FREQ_HZ = 20;
const YAW_FREQ_HZ   = 22;
const ROLL_FREQ_HZ  = 19;

// Convenience conversions
const DEG_TO_RAD = Math.PI / 180;
const TWO_PI = Math.PI * 2;

// ────────────────────────────────────────────────────────────────────────
//  Envelope curves — amplitude(t) shapes per event type
// ────────────────────────────────────────────────────────────────────────

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Accel envelope: crescendo-then-fade.
 * Slow ramp-in to peak, then fade out.
 * env(0) = 0, env(0.6·dur) ≈ 1, env(dur) = 0.
 */
function accelEnvelope(t, duration) {
  const u = t / duration;
  if (u <= 0 || u >= 1) return 0;
  // Crescendo: smoothstep 0→1 over [0, 0.6]
  // Fade:      smoothstep 1→0 over [0.6, 1]
  const crescendo = smoothstep(0, 0.6, u);
  const fade = 1 - smoothstep(0.6, 1, u);
  return crescendo * fade;
}

/**
 * Decel envelope: impact-then-decay.
 * Fast ramp-in to peak, then exponential ring-out.
 * env(0) = 0, env(0.1·dur) ≈ 1, env(dur) → small.
 */
function decelEnvelope(t, duration) {
  const u = t / duration;
  if (u <= 0 || u >= 1) return 0;
  if (u < 0.1) {
    return smoothstep(0, 0.1, u);
  }
  // Exponential decay with time constant chosen so env(1.0) ≈ 0.03
  return Math.exp(-3.5 * (u - 0.1));
}

// ────────────────────────────────────────────────────────────────────────

// Reusable vectors
const _velTmp = new THREE.Vector3();

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

    // ── Signal tracking (position-delta velocity, scalar dSpeed) ──
    this._prevPosition = new THREE.Vector3();
    this._prevSpeed = 0;
    this._hasPrev = 0;  // 0 = no history, 1 = have pos, 2 = have speed
    this._smoothedAbsDSpeed = 0;
    this._signedDSpeed = 0;
    // Live-feedback loop (c): per-sign leg-max pullback peak detector
    // for the shake onset gate. Each sign of signedDSpeed (positive =
    // accelerating, negative = decelerating) has its own running
    // maximum; each max updates only while the current sign matches.
    // A shake event fires when the current signal has pulled back by
    // `PEAK_PULLBACK_FRAC` from the running max of its matching sign.
    //
    // Director 2026-04-24 cycle-4 ruling chose per-sign separation over
    // a single `_signalLegMax`. Prior iterations:
    //   cycle 1 (3-point trailing peak): noise-sensitive, fired on
    //     sub-unit wobbles during the rise.
    //   cycle 2 (single legMax, 5% pullback): single-hump envelopes
    //     worked (94% of peak, +232ms lag), double-hump envelopes
    //     failed (fired on first small dip at 70% of true peak).
    //   cycle 3 (single legMax, 20% pullback): 7/8 events healthy,
    //     but one decel fired at 6.4% of peak because the preceding
    //     big acceleration envelope on the same leg left
    //     `_signalLegMax = 2118` while accel budget was already spent;
    //     the eventual decel sign-flip fired immediately on the stale
    //     accel peak's pullback predicate.
    // Per-sign separation: one scalar was being asked to represent
    // the peak of two distinct physical envelopes that can coexist
    // above threshold on the same leg. Per-sign maxes make each
    // envelope's peak detectable independently.
    this._accelLegMax = 0;
    this._decelLegMax = 0;

    // ── Cooldown state (separate per event type so accel + decel can
    //    fire on the same leg without blocking each other) ──
    this._lastAccelEndTime = -Infinity;
    this._lastDecelEndTime = -Infinity;

    // ── Current event state (frozen at onset; const through ringout) ──
    this._eventActive = false;
    this._eventType = null;       // 'accel' | 'decel'
    this._eventOnsetTime = 0;
    this._eventDuration = 0;
    this._pitchPhase = 0;
    this._yawPhase = 0;
    this._rollPhase = 0;

    // ── Output (rotation-only; position is NEVER mutated) ──
    this._shakeEuler = { pitch: 0, yaw: 0, roll: 0 };

    // ── Debug-hook: when non-null, bypasses phase/short-hop/warp-exit gates. ──
    this._pendingDebugFire = null;  // { type: 'accel' | 'decel' }
    // Current event's provenance — natural (signal-triggered) vs debug
    // (test scaffolding bypassing gates). AC #17 (signal-coincidence)
    // only evaluates natural events; debug events intentionally fire
    // outside the signal window so Max can eyeball shape on demand.
    this._eventIsDebug = false;

    // Per-leg fire budget (round-11, AC #20). Max's stated model is
    // "once when the burn commences, once to take us out of cruise" —
    // i.e., at most 1 accel + 1 decel per TRAVELING phase of a leg.
    // The Hermite arrival-blend window produces two distinct |d|v|/dt|
    // peaks during decel (blend-start and blend-complete); the 0.5s
    // cooldown alone isn't enough to suppress the second. Per-leg budget
    // is the authoritative gate; cooldown stays as belt-and-suspenders
    // against noise re-firing. Debug fires bypass this budget
    // (unconditional, per scaffolding convention).
    this._firedThisLeg = { accel: false, decel: false };
  }

  // ── Public surface ──

  get isActive() { return this._phase !== ShipPhase.IDLE; }
  get currentPhase() { return this._phase; }
  /** Rotation-only output per round-10. Read-only externally. */
  get shakeEuler() { return this._shakeEuler; }
  /** Legacy property kept as identity Vector3 for any residual callers;
   *  shake is rotation-only in round-10. AC #19 requires position be
   *  untouched by shake. */
  get shakeOffset() { return _ZERO_V3; }
  /** Telemetry: true while a tremor event is running. */
  get eventActive() { return this._eventActive; }
  get eventType() { return this._eventActive ? this._eventType : null; }
  get eventOnsetTime() { return this._eventOnsetTime; }
  get eventDuration() { return this._eventDuration; }
  /** True when the current event was debug-fired (bypasses gates). */
  get eventIsDebug() { return this._eventActive && this._eventIsDebug; }
  get eventTime() {
    return this._eventActive ? (this._timeAccum - this._eventOnsetTime) : 0;
  }
  get smoothedAbsDSpeed() { return this._smoothedAbsDSpeed; }
  get signedDSpeed() { return this._signedDSpeed; }
  /** 0/1 for legacy telemetry code that reads `abruptness`. */
  get abruptness() { return this._eventActive ? 1 : 0; }

  beginTour({ fromWarp }) {
    this._fromWarp = !!fromWarp;
    this._phase = fromWarp ? ShipPhase.ENTRY : ShipPhase.CRUISE;
    this._resetState();
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
      this._zeroShake();
      return;
    }

    this._timeAccum += deltaTime;

    // Round-11: reset per-leg fire budget on new-leg one-shot. A single
    // beginMotion → TRAVELING → APPROACHING → ORBITING cycle constitutes
    // one leg; each new leg gets a fresh accel + decel budget.
    if (motionFrame.motionStarted) {
      this._firedThisLeg.accel = false;
      this._firedThisLeg.decel = false;
    }

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

    // ════════════════════════════════════════════════════════════════════
    //  BELT-AND-SUSPENDERS PHASE GATE (sampling side)
    //
    //  If the ship is not in `traveling` phase, silence any in-flight
    //  event immediately. Catches any stale ringout that trigger-side
    //  can't touch (e.g., event started correctly but phase transitioned
    //  before its envelope completed). AC #13 + #16 invariant.
    // ════════════════════════════════════════════════════════════════════
    if (subPhase !== 'traveling') {
      if (this._eventActive) {
        this._eventActive = false;
        this._eventType = null;
        this._eventIsDebug = false;
      }
      // Debug-fires still honored (they bypass gates), but even so:
      // we reset the output and only fire if a pending debug is present.
      this._zeroShake();
      if (this._pendingDebugFire !== null) {
        const { type } = this._pendingDebugFire;
        this._pendingDebugFire = null;
        this._startTremorEvent(type, /* isDebug */ true);
      }
      // Fall through to sample envelope if a debug fire is now active
      if (!this._eventActive) return;
    }

    // ════════════════════════════════════════════════════════════════════
    //  SIGNAL DERIVATION + ONSET DETECTION (trigger-side gate)
    //
    //  Only runs if phase === 'traveling' AND !isShortTrip. Outside this
    //  gate, no signal is derived and no event fires.
    // ════════════════════════════════════════════════════════════════════
    const insideTriggerGate = (subPhase === 'traveling') && !motionFrame.isShortTrip;

    if (insideTriggerGate) {
      // Derive |d|v|/dt| from position deltas
      const currPos = motionFrame.position;
      let rawAbsDSpeed = 0;
      if (deltaTime > 1e-6 && this._hasPrev >= 1) {
        _velTmp.set(
          (currPos.x - this._prevPosition.x) / deltaTime,
          (currPos.y - this._prevPosition.y) / deltaTime,
          (currPos.z - this._prevPosition.z) / deltaTime,
        );
        const currSpeed = _velTmp.length();
        if (this._hasPrev >= 2) {
          const dSpeed = (currSpeed - this._prevSpeed) / deltaTime;
          this._signedDSpeed = dSpeed;
          rawAbsDSpeed = Math.abs(dSpeed);
        }
        this._prevSpeed = currSpeed;
      }
      this._prevPosition.copy(currPos);
      if (this._hasPrev < 2) this._hasPrev++;

      // Smooth
      this._smoothedAbsDSpeed += (rawAbsDSpeed - this._smoothedAbsDSpeed) * SIGNAL_SMOOTHING;

      // Live-feedback loop (c): per-sign leg-max pullback peak detection.
      // Each sign of signedDSpeed tracks its own running max, updated
      // only while the current sign matches. Falling below threshold
      // resets BOTH maxes (disarm between event rounds on the same leg).
      if (this._smoothedAbsDSpeed < SIGNAL_ONSET_THRESHOLD) {
        this._accelLegMax = 0;
        this._decelLegMax = 0;
      }
      const sign = this._signedDSpeed;
      if (sign >= 0 && this._smoothedAbsDSpeed > this._accelLegMax) {
        this._accelLegMax = this._smoothedAbsDSpeed;
      } else if (sign < 0 && this._smoothedAbsDSpeed > this._decelLegMax) {
        this._decelLegMax = this._smoothedAbsDSpeed;
      }

      // Peak-pullback predicate per sign. Fire type comes from which
      // sign's max triggered the pullback — NOT from the current sign
      // of signedDSpeed, which may flicker near zero during transitions.
      const accelPullback =
        this._accelLegMax >= SIGNAL_ONSET_THRESHOLD &&
        this._smoothedAbsDSpeed <= this._accelLegMax * (1 - PEAK_PULLBACK_FRAC);
      const decelPullback =
        this._decelLegMax >= SIGNAL_ONSET_THRESHOLD &&
        this._smoothedAbsDSpeed <= this._decelLegMax * (1 - PEAK_PULLBACK_FRAC);

      // Onset detection: fire a new event if
      //   - no event currently active
      //   - an accel-side OR decel-side peak has pulled back
      //   - cooldown window has passed for the firing type
      //   - accel-side: warpExit === false
      //   - per-leg fire budget (AC #20) not yet spent for that type
      // If both sides qualify on the same frame, prefer the one whose
      // peak magnitude is larger — that's the stronger physical event.
      if (!this._eventActive && (accelPullback || decelPullback)) {
        let type = null;
        if (accelPullback && decelPullback) {
          type = this._accelLegMax >= this._decelLegMax ? 'accel' : 'decel';
        } else if (accelPullback) {
          type = 'accel';
        } else {
          type = 'decel';
        }
        const lastEnd = (type === 'accel') ? this._lastAccelEndTime : this._lastDecelEndTime;
        const cooldownOk = (this._timeAccum - lastEnd) >= SIGNAL_EVENT_COOLDOWN;
        const warpExitOk = (type === 'decel') || !motionFrame.warpExit;
        const budgetOk = !this._firedThisLeg[type];
        if (cooldownOk && warpExitOk && budgetOk) {
          this._startTremorEvent(type, /* isDebug */ false);
          // Disarm the firing sign's detector; the OTHER sign's max is
          // preserved so a subsequent opposite-sign envelope on the
          // same leg can still fire its own peak.
          if (type === 'accel') this._accelLegMax = 0;
          else                  this._decelLegMax = 0;
        }
      }
    } else {
      // Outside the trigger gate — keep signal state frozen (we'll re-init
      // position tracking on next gate entry). Reset history so first frame
      // after re-entering the gate doesn't compute a spurious spike.
      this._hasPrev = 0;
      // Do NOT zero smoothedAbsDSpeed here — we want telemetry to show it
      // decaying naturally if a recent signal window just ended. But also
      // we don't want stale values — practical compromise: reset to 0.
      this._smoothedAbsDSpeed = 0;
      this._signedDSpeed = 0;
      // Loop (c): reset both per-sign maxes so a new leg's peaks are
      // tracked fresh.
      this._accelLegMax = 0;
      this._decelLegMax = 0;
    }

    // ════════════════════════════════════════════════════════════════════
    //  DEBUG-HOOK CONSUMPTION
    //
    //  Debug fires bypass all gates. They fire even outside 'traveling'
    //  phase so Max can eyeball envelope shape from a reference state
    //  (typically in orbit around a body at a known distance). The
    //  belt-and-suspenders phase gate above ALREADY handled this case
    //  for outside-traveling. Here we handle the inside-traveling case.
    // ════════════════════════════════════════════════════════════════════
    if (this._pendingDebugFire !== null && subPhase === 'traveling') {
      const { type } = this._pendingDebugFire;
      this._pendingDebugFire = null;
      // Debug fires replace any active event
      this._startTremorEvent(type, /* isDebug */ true);
    }

    // ════════════════════════════════════════════════════════════════════
    //  SAMPLE ENVELOPE × CARRIER
    // ════════════════════════════════════════════════════════════════════
    if (this._eventActive) {
      const t = this._timeAccum - this._eventOnsetTime;
      if (t >= this._eventDuration) {
        // Event completed — record end time for cooldown and go idle
        if (this._eventType === 'accel') {
          this._lastAccelEndTime = this._timeAccum;
        } else {
          this._lastDecelEndTime = this._timeAccum;
        }
        this._eventActive = false;
        this._eventType = null;
        this._eventIsDebug = false;
        this._zeroShake();
      } else {
        const envValue = (this._eventType === 'accel')
          ? accelEnvelope(t, this._eventDuration)
          : decelEnvelope(t, this._eventDuration);

        // Per-axis sinusoidal carriers, phase-scattered at onset,
        // frequency-detuned across axes to prevent Lissajous lock.
        const pitchCarrier = Math.sin(TWO_PI * PITCH_FREQ_HZ * t + this._pitchPhase);
        const yawCarrier   = Math.sin(TWO_PI * YAW_FREQ_HZ   * t + this._yawPhase);
        const rollCarrier  = Math.sin(TWO_PI * ROLL_FREQ_HZ  * t + this._rollPhase);

        this._shakeEuler.pitch = envValue * TREMOR_PITCH_PEAK_DEG * DEG_TO_RAD * pitchCarrier;
        this._shakeEuler.yaw   = envValue * TREMOR_YAW_PEAK_DEG   * DEG_TO_RAD * yawCarrier;
        this._shakeEuler.roll  = envValue * TREMOR_ROLL_PEAK_DEG  * DEG_TO_RAD * rollCarrier;
      }
    } else {
      this._zeroShake();
    }
  }

  // ── Internal helpers ──

  _zeroShake() {
    this._shakeEuler.pitch = 0;
    this._shakeEuler.yaw = 0;
    this._shakeEuler.roll = 0;
  }

  /**
   * Fire a new tremor event. Atomically freezes type, onset time,
   * duration, and per-axis carrier phases at onset.
   *
   * Envelope duration is clamped to fit within remaining TRAVELING-phase
   * time (AC #18 invariant). If remaining < 0.5s, the event is suppressed
   * entirely (a tremor shorter than 0.5s won't read as turbulence).
   *
   * @param {'accel'|'decel'} type
   * @param {boolean} isDebug — true if fired from debug hook (bypass gates)
   */
  _startTremorEvent(type, isDebug) {
    let duration = TREMOR_ENVELOPE_DURATION;

    // AC #18: clamp to fit remaining traveling-phase time (if we're in one).
    // Debug fires from outside 'traveling' bypass this — they always use
    // the full authored duration since there's no traveling-phase window
    // to overflow.
    if (this._phase === ShipPhase.CRUISE && this.nav && typeof this.nav.travelDuration === 'number') {
      const remaining = this.nav.travelDuration - (this.nav.travelElapsed || 0);
      if (remaining > 0 && remaining < duration) {
        if (remaining < 0.5) {
          // Don't fire a sub-0.5s tremor — too brief to read as turbulence
          return;
        }
        duration = remaining;
      }
    }

    this._eventActive = true;
    this._eventType = type;
    this._eventIsDebug = !!isDebug;
    this._eventOnsetTime = this._timeAccum;
    this._eventDuration = duration;

    // Round-11 AC #20: natural fires consume the per-leg budget.
    // Debug fires leave the budget untouched (unconditional scaffolding).
    if (!isDebug) {
      this._firedThisLeg[type] = true;
    }

    // Randomize per-axis phases so consecutive events don't pattern-match
    this._pitchPhase = simRandom() * TWO_PI;
    this._yawPhase   = simRandom() * TWO_PI;
    this._rollPhase  = simRandom() * TWO_PI;
  }

  // ── Debug hooks (bypass all gates) ──

  /** Fire an accel tremor event next update. */
  debugAccelImpulse() {
    this._pendingDebugFire = { type: 'accel' };
  }

  /** Fire a decel tremor event next update. */
  debugDecelImpulse() {
    this._pendingDebugFire = { type: 'decel' };
  }

  /** Back-compat — fire a decel tremor. */
  debugAbruptTransition() {
    this._pendingDebugFire = { type: 'decel' };
  }

  stop() {
    this._phase = ShipPhase.IDLE;
    this._fromWarp = false;
    this._resetState();
    this._zeroShake();
    this._pendingDebugFire = null;
  }

  _resetState() {
    this._timeAccum = 0;
    this._prevPosition.set(0, 0, 0);
    this._prevSpeed = 0;
    this._hasPrev = 0;
    this._smoothedAbsDSpeed = 0;
    this._signedDSpeed = 0;
    this._accelLegMax = 0;
    this._decelLegMax = 0;
    this._eventActive = false;
    this._eventType = null;
    this._eventIsDebug = false;
    this._eventOnsetTime = 0;
    this._eventDuration = 0;
    this._lastAccelEndTime = -Infinity;
    this._lastDecelEndTime = -Infinity;
    this._firedThisLeg.accel = false;
    this._firedThisLeg.decel = false;
  }
}

// Legacy compat — a zero-vector singleton returned by `shakeOffset` getter
// in case any call site still reads it. Round-10 shake is rotation-only;
// this exists only to keep the old property name from returning undefined.
const _ZERO_V3 = new THREE.Vector3(0, 0, 0);
