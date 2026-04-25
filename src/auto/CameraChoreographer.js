import * as THREE from 'three';
import { CameraMode } from './CameraMode.js';

/**
 * CameraChoreographer — authored camera-axis dispatch for the autopilot.
 *
 * Per SYSTEM_CONTRACTS.md §10.1 and docs/FEATURES/autopilot.md §"V1
 * architectural affordances for V-later items," the camera axis is a
 * first-class concept independent of the ship axis. This module holds
 * the current CameraMode, dispatches per-frame camera-authoring work to
 * the mode's implementation, and emits `camera-mode-change` events on
 * transitions (§10.7).
 *
 * V1 exercises only `ESTABLISHING`. `SHOWCASE` and `ROVING` dispatch
 * branches exist and reference the OOI query interface (§10.9) — their
 * V1 behavior is fall-back-through-dispatch to ESTABLISHING so the
 * dispatch shape is exercised in test even when the authored mode is
 * unimplemented. V-later lights them up as replacements of the fallback,
 * not as a restructure of the dispatch.
 *
 * ──────────────────────────────────────────────────────────────────
 *  Integration
 * ──────────────────────────────────────────────────────────────────
 *
 *   main.js:
 *     const cameraChoreographer = new CameraChoreographer(
 *       shipChoreographer, navSubsystem, ooiRegistry, autopilotEvents);
 *     flythrough.setCameraChoreographer(cameraChoreographer);
 *
 *   FlythroughCamera.update(dt) calls:
 *     cameraChoreographer.update(dt, motionFrame);
 *     // reads .currentLookAtTarget for camera.lookAt()
 *
 * The choreographer produces the **target** for `camera.lookAt()` and any
 * framing-level overrides (V1: none exercised; V-later: FOV, roll, etc.).
 * It does NOT call `camera.lookAt` — that stays in `FlythroughCamera`
 * so the shake-composition ordering (position → lookAt → rot-blend →
 * shake multiply) from the just-shipped shake-redesign at `1bb5eb2` is
 * preserved untouched.
 *
 * Invariant: `camera.position` is NEVER written by the choreographer or
 * any mode. That's the subsystem's job (motion-produces pipeline, §5.3
 * / Principle 5).
 */

// ══════════════════════════════════════════════════════════════════════
//  AUTHORED TUNABLES — ESTABLISHING mode (V1 seeds, per feature doc)
//
//  Exposed at top-of-file for Max's review-time tuning per the "F12 +
//  reload + observe" loop that shipped with the shake-redesign round-10
//  §"How to tune" pattern.
// ══════════════════════════════════════════════════════════════════════

/**
 * Duration (seconds) ESTABLISHING lingers on a receding subject after
 * the ship leaves STATION. Per AC #5, must be greater than
 * `navigation.rotBlendDuration` (subsystem's ~1.0s for tour departures)
 * so the linger reads as authored rather than orientation-slerp
 * artifact. V1 seed 1.8s.
 */
const LINGER_DURATION = 1.8;

/**
 * Pan-ahead bias fraction during CRUISE. The lookAtTarget is lerp'd
 * from the subsystem's default target toward the next body's position
 * by this amount. 0 = no pan-ahead; 1 = fully on next body. V1 seed
 * 0.35 produces a visible pan-forward beat (AC #6) without abandoning
 * the subsystem's composed look direction.
 */
const PAN_AHEAD_FRACTION = 0.35;

/**
 * Smoothing rate for the pan-ahead lerp's RAMP-IN. The pan-ahead bias
 * grows from 0 → PAN_AHEAD_FRACTION over ~1/PAN_AHEAD_RAMP seconds so
 * the camera doesn't snap mid-cruise. Higher = faster ramp-in. V1 seed
 * 0.8 per second (ramp takes ~1.25s to reach full bias).
 */
const PAN_AHEAD_RAMP = 0.8;

/**
 * Smoothing rate for the pan-ahead lerp's RAMP-OUT when leaving CRUISE
 * (back toward subsystem default on APPROACH / STATION). Faster than
 * ramp-in so the camera re-centers on arrival quickly. V1 seed 2.0 per
 * second (ramp takes ~0.5s to clear).
 */
const PAN_AHEAD_DECAY = 2.0;

/**
 * Duration (seconds) of the camLookAt blend when framingState transitions
 * between states with different target-computation rules (TRACKING/
 * PANNING_AHEAD use `navPlanLookAt + bias`; LINGERING uses the cached
 * body center — these differ by ~100 units by design). Without blending,
 * the target snaps by that distance in one frame.
 *
 * V1 seed 0.4s — smooth enough to read as authored, fast enough that the
 * linger still reads as a deliberate beat rather than a slow wipe.
 */
const TRANSITION_BLEND_DURATION = 0.4;

// ══════════════════════════════════════════════════════════════════════

// Reusable vectors
const _tmpTarget = new THREE.Vector3();
const _tmpNext = new THREE.Vector3();

// ══════════════════════════════════════════════════════════════════════
//  EstablishingMode — the V1 authored camera mode.
//
//  State model is CAMERA-AXIS-ONLY (AC #8 invariant). The mode's
//  top-level update dispatches on `_framingState ∈ {TRACKING, LINGERING,
//  PANNING_AHEAD}`, NOT on ShipPhase. Ship phase is consulted as an
//  INPUT SIGNAL (e.g., "ship just left STATION — a linger is appropriate")
//  to drive transitions between the mode's own states.
//
//  Structure intentionally mirrors Principle 6 / drift-risk #2: the
//  ESTABLISHING update is NOT `switch(shipPhase)`. It's a camera-
//  timeline state machine that reads ship phase as a signal.
// ══════════════════════════════════════════════════════════════════════

const FramingState = Object.freeze({
  TRACKING:      'TRACKING',       // default — follow subsystem's lookAtTarget
  LINGERING:     'LINGERING',      // hold on a receding body after STATION→CRUISE
  PANNING_AHEAD: 'PANNING_AHEAD',  // bias target toward next body during CRUISE
});

class EstablishingMode {
  constructor() {
    this._framingState = FramingState.TRACKING;
    this._lingerTargetRef = null;  // body.group ref (updates position via .position)
    this._lingerElapsed = 0;
    this._prevShipPhase = 'IDLE';   // detect STATION → CRUISE transition edge
    // Round-2 (2026-04-23): cache the body the ship is currently orbiting
    // while `shipPhase === 'STATION'`. When the autopilot advances the leg,
    // `nav.bodyRef` is replaced BEFORE the STATION → CRUISE edge is detected,
    // so reading `nav.bodyRef` at transition time pins the linger to the NEXT
    // target (wrong body). This cached ref is always the body we were just
    // orbiting — the receding subject per AC #5. Per session 2026-04-23
    // diagnostic telemetry: without this cache, `camLookAt` jumped ~13500
    // scene units at the TRACKING→LINGERING frame.
    this._lastStationBodyRef = null;
    // Pan-ahead bias ramps smoothly — 0 when not panning, up to
    // PAN_AHEAD_FRACTION during CRUISE with a next-body target.
    this._panAheadBias = 0;
    // Output: final lookAtTarget for this frame.
    this._currentLookAtTarget = new THREE.Vector3();

    // Round-2 (2026-04-23): transition blend state. The raw target produced
    // by each framing-state's rule (body-center for LINGERING vs
    // navPlanLookAt+bias for TRACKING/PANNING_AHEAD) differs by ~100 units
    // by design. Snap-jumps between them read as "camera jumping weirdly."
    // Fix: capture the previous frame's camLookAt at each framing-state
    // transition and lerp from it toward the new rule's raw target over
    // TRANSITION_BLEND_DURATION seconds.
    this._blendFromTarget = new THREE.Vector3();
    this._blendElapsed = TRANSITION_BLEND_DURATION;  // start "blend already completed"
    this._prevRawTargetFrame = new THREE.Vector3();  // scratch for raw-target capture
  }

  get currentLookAtTarget() { return this._currentLookAtTarget; }
  get framingState() { return this._framingState; }
  get lingerElapsed() { return this._lingerElapsed; }
  get panAheadBias() { return this._panAheadBias; }

  reset() {
    this._framingState = FramingState.TRACKING;
    this._lingerTargetRef = null;
    this._lingerElapsed = 0;
    this._prevShipPhase = 'IDLE';
    this._lastStationBodyRef = null;
    this._panAheadBias = 0;
    this._blendElapsed = TRANSITION_BLEND_DURATION;
  }

  /**
   * @param {number} deltaTime
   * @param {Object} motionFrame — MotionFrame from NavigationSubsystem.
   * @param {string} shipPhase — INPUT SIGNAL only, not the selector.
   * @param {NavigationSubsystem} nav — access to bodyRef / nextBodyRef.
   */
  update(deltaTime, motionFrame, shipPhase, nav) {
    const prevFramingState = this._framingState;

    // ── Cache the currently-orbited body each STATION frame ──
    // Per round-2 diagnostic (2026-04-23): by the time STATION→CRUISE is
    // detected below, the autopilot has already advanced the leg and
    // `nav.bodyRef` points at the NEXT target. Caching the body each frame
    // the ship is in STATION gives us a stable handle to the receding
    // subject — the correct linger anchor per AC #5.
    if (shipPhase === 'STATION' && nav && nav.bodyRef) {
      this._lastStationBodyRef = nav.bodyRef;
    }

    // ── Transition detection (ship-phase-AS-INPUT-SIGNAL, not selector) ──
    // When the ship leaves STATION and begins CRUISE, queue a linger on
    // the body just left. This is the AC #5 linger-on-receding-subject.
    // Use the cached `_lastStationBodyRef` (captured while the ship was
    // actually in STATION), NOT the live `nav.bodyRef` (which by now has
    // been replaced with the next target by the leg-advance).
    if (this._prevShipPhase === 'STATION' && shipPhase === 'CRUISE') {
      if (this._lastStationBodyRef) {
        this._framingState = FramingState.LINGERING;
        this._lingerTargetRef = this._lastStationBodyRef;
        this._lingerElapsed = 0;
      }
    }

    // ── Round-2 transition blend: if framing state just changed, capture
    // the previous frame's camLookAt as the blend-from anchor so the new
    // state's raw target is lerped toward over TRANSITION_BLEND_DURATION.
    // Without this, LINGERING's body-center target and TRACKING/
    // PANNING_AHEAD's navPlanLookAt-based target differ by ~100 units
    // by design, producing a visible one-frame snap.
    if (this._framingState !== prevFramingState) {
      this._blendFromTarget.copy(this._currentLookAtTarget);
      this._blendElapsed = 0;
    }
    this._blendElapsed += deltaTime;

    // ── Primary dispatch: switch(_framingState), NOT switch(shipPhase) ──
    // Each branch writes its raw target into `_prevRawTargetFrame`. After
    // the switch, we blend from `_blendFromTarget` toward the raw target
    // by `_blendElapsed / TRANSITION_BLEND_DURATION` so framing-state
    // transitions (body-center vs navPlanLookAt) don't snap by ~100 units.
    let rawTargetWritten = true;
    switch (this._framingState) {
      case FramingState.LINGERING: {
        this._lingerElapsed += deltaTime;
        // Hold target on the receding body's current position (ship moves
        // away naturally; camera stays pinned on the body — that's the
        // visual reading of a "linger" per AC #5).
        if (this._lingerTargetRef && this._lingerTargetRef.position) {
          this._prevRawTargetFrame.copy(this._lingerTargetRef.position);
        } else {
          // Body ref was lost (e.g., system re-spawned mid-linger) — fall
          // through to TRACKING so we don't null-deref.
          this._framingState = FramingState.TRACKING;
          this._prevRawTargetFrame.copy(motionFrame.lookAtTarget);
        }
        // Pan-ahead bias decays during linger (we're not panning forward —
        // we're holding back on the receding subject).
        this._panAheadBias = Math.max(0, this._panAheadBias - PAN_AHEAD_DECAY * deltaTime);
        if (this._lingerElapsed >= LINGER_DURATION) {
          // Linger complete — transition to TRACKING AND fall through so
          // TRACKING's computation runs THIS FRAME (not next frame).
          // Capture the blend-from anchor as the linger's final raw target
          // so the fall-through's raw target is blended from there.
          this._blendFromTarget.copy(this._prevRawTargetFrame);
          this._blendElapsed = 0;
          this._framingState = FramingState.TRACKING;
          this._lingerTargetRef = null;
          this._lingerElapsed = 0;
          // Intentional fall-through — no break here.
        } else {
          break;
        }
        // falls through
      }

      case FramingState.TRACKING:
      case FramingState.PANNING_AHEAD: {
        // Default target: subsystem's composed lookAtTarget.
        _tmpTarget.copy(motionFrame.lookAtTarget);

        // Pan-ahead during CRUISE with a resolvable next body target.
        const shouldPanAhead = shipPhase === 'CRUISE' && nav && nav.nextBodyRef && nav.nextBodyRef.position;
        if (shouldPanAhead) {
          this._panAheadBias = Math.min(PAN_AHEAD_FRACTION, this._panAheadBias + PAN_AHEAD_RAMP * deltaTime);
          _tmpNext.copy(nav.nextBodyRef.position);
          _tmpTarget.lerp(_tmpNext, this._panAheadBias);
          this._framingState = FramingState.PANNING_AHEAD;
        } else {
          // Ramp out of pan-ahead smoothly on APPROACH / STATION / ENTRY.
          this._panAheadBias = Math.max(0, this._panAheadBias - PAN_AHEAD_DECAY * deltaTime);
          // If there's a residual bias still in effect (mid-ramp-out), keep
          // applying it — otherwise snap back to TRACKING.
          if (this._panAheadBias > 1e-4 && nav && nav.nextBodyRef && nav.nextBodyRef.position) {
            _tmpNext.copy(nav.nextBodyRef.position);
            _tmpTarget.lerp(_tmpNext, this._panAheadBias);
            this._framingState = FramingState.PANNING_AHEAD;
          } else {
            this._panAheadBias = 0;
            this._framingState = FramingState.TRACKING;
          }
        }
        this._prevRawTargetFrame.copy(_tmpTarget);
        break;
      }

      default: {
        // Unknown state — fail safe to subsystem default.
        this._framingState = FramingState.TRACKING;
        this._prevRawTargetFrame.copy(motionFrame.lookAtTarget);
        break;
      }
    }

    // ── Blend from pre-transition anchor toward raw target ──
    // During active blend (_blendElapsed < TRANSITION_BLEND_DURATION),
    // camLookAt = lerp(blendFromAnchor, rawTarget, smoothstep(t)). After
    // the blend window, camLookAt = rawTarget unconditionally.
    if (this._blendElapsed >= TRANSITION_BLEND_DURATION) {
      this._currentLookAtTarget.copy(this._prevRawTargetFrame);
    } else {
      const u = this._blendElapsed / TRANSITION_BLEND_DURATION;
      const smoothU = u * u * (3 - 2 * u);  // smoothstep for gentle ease
      this._currentLookAtTarget.copy(this._blendFromTarget).lerp(this._prevRawTargetFrame, smoothU);
    }

    // Save for next frame's transition detection.
    this._prevShipPhase = shipPhase;
  }
}

// ══════════════════════════════════════════════════════════════════════
//  CameraChoreographer — top-level dispatch
// ══════════════════════════════════════════════════════════════════════

export class CameraChoreographer {
  /**
   * @param {ShipChoreographer} shipChoreographer — for current ship phase.
   * @param {NavigationSubsystem} nav — for body refs (current + next target).
   * @param {OOIRegistry} ooiRegistry — for §10.9 stub interface.
   * @param {AutopilotEvents} events — for §10.7 camera-mode-change emission.
   */
  constructor(shipChoreographer, nav, ooiRegistry, events) {
    this._shipChoreographer = shipChoreographer;
    this._nav = nav;
    this._ooi = ooiRegistry;
    this._events = events;

    this._mode = CameraMode.ESTABLISHING;
    this._establishing = new EstablishingMode();

    // V1 STATION-hold redesign (2026-04-25). When a Ship reference
    // is set via setShip(), V1 ESTABLISHING collapses to "look down
    // ship-forward" — no framing-state machinery, no linger/pan-
    // ahead/arc. Per feature doc §"Per-phase criterion — camera axis
    // (V1)" + drift-risk #7. AC #5: camera-forward ≡ ship-forward
    // dot ≥ 0.9999. The legacy framing-state path remains for
    // non-V1 callers (warp-arrival, manual-burn through
    // NavigationSubsystem) until the retire-followup workstream.
    this._ship = null;

    // V1 output: the lookAtTarget for FlythroughCamera to consume.
    this._currentLookAtTarget = new THREE.Vector3();
  }

  /**
   * Set the Ship reference for V1 collapse. When non-null, the
   * V1 ESTABLISHING path is taken (camera.lookAt = camera.position
   * + ship.forward × 100). When null, legacy framing-state path is
   * taken. V1 path callers should call this once at autopilot
   * start; legacy callers should not call it.
   */
  setShip(ship) { this._ship = ship; }

  get currentMode() { return this._mode; }
  get currentLookAtTarget() { return this._currentLookAtTarget; }
  /** ESTABLISHING's internal framing-state (for telemetry / debug). */
  get framingState() { return this._establishing.framingState; }
  get lingerElapsed() { return this._establishing.lingerElapsed; }
  get panAheadBias() { return this._establishing.panAheadBias; }

  /**
   * Set the current camera mode. Idempotent: setting the same mode emits
   * NO event. Mode transitions emit a single `camera-mode-change` event
   * with `{ from, to }` payload per §10.7.
   *
   * @param {string} newMode — a CameraMode enum value.
   */
  setCameraMode(newMode) {
    if (!Object.values(CameraMode).includes(newMode)) {
      console.warn(`[CameraChoreographer] setCameraMode: unknown mode '${newMode}' — ignored`);
      return;
    }
    if (this._mode === newMode) return;  // idempotent per AC #2
    const from = this._mode;
    this._mode = newMode;
    // Reset establishing state when transitioning TO ESTABLISHING so linger
    // state doesn't leak across re-entries. SHOWCASE / ROVING fall back
    // through dispatch to ESTABLISHING in V1; their own state reset will
    // land when V-later authors them.
    if (newMode === CameraMode.ESTABLISHING) {
      this._establishing.reset();
    }
    if (this._events) {
      this._events.emit('camera-mode-change', { from, to: newMode });
    }
  }

  /**
   * Per-frame tick. Call from FlythroughCamera.update() after the motion
   * frame is produced by the navigation subsystem.
   *
   * @param {number} deltaTime
   * @param {Object} motionFrame — from navigation.update(dt).
   */
  update(deltaTime, motionFrame) {
    const shipPhase = this._shipChoreographer ? this._shipChoreographer.currentPhase : 'IDLE';

    // ── First-class dispatch (§10.1 / feature-doc §133) ──
    // Selector is the CameraMode value; not an if-branch inside ESTABLISHING.
    // SHOWCASE and ROVING branches reference the OOI stub interface (§10.9)
    // before falling back through the dispatch to ESTABLISHING. The
    // interface call exists so V-later wire-up is replacement-of-fallback,
    // not restructure.
    switch (this._mode) {
      case CameraMode.SHOWCASE: {
        // §10.9 stub consumption — V1 gets [] back, falls through to
        // ESTABLISHING behavior via the dispatch (not around it).
        const candidates = this._ooi ? this._ooi.getNearbyOOIs(null, 100) : [];
        const events = this._ooi ? this._ooi.getActiveEvents(0, 30) : [];
        if (candidates.length === 0 && events.length === 0) {
          // Nothing to showcase — fall back through dispatch to ESTABLISHING.
          this._establishing.update(deltaTime, motionFrame, shipPhase, this._nav);
          this._currentLookAtTarget.copy(this._establishing.currentLookAtTarget);
        } else {
          // V-later: author SHOWCASE framing using candidates/events.
          // V1: unreachable (stub returns empty).
          this._establishing.update(deltaTime, motionFrame, shipPhase, this._nav);
          this._currentLookAtTarget.copy(this._establishing.currentLookAtTarget);
        }
        break;
      }

      case CameraMode.ROVING: {
        // §10.9 stub consumption — same pattern as SHOWCASE.
        const candidates = this._ooi ? this._ooi.getNearbyOOIs(null, 200) : [];
        if (candidates.length === 0) {
          this._establishing.update(deltaTime, motionFrame, shipPhase, this._nav);
          this._currentLookAtTarget.copy(this._establishing.currentLookAtTarget);
        } else {
          // V-later: author ROVING framing toward a nearby OOI.
          this._establishing.update(deltaTime, motionFrame, shipPhase, this._nav);
          this._currentLookAtTarget.copy(this._establishing.currentLookAtTarget);
        }
        break;
      }

      case CameraMode.ESTABLISHING:
      default: {
        if (this._ship && motionFrame && motionFrame.target) {
          // §A4 ESTABLISHING (camera/ship decoupled): camera looks
          // at the autopilot target body's current position each
          // frame (pursuit-curve). Replaces the §A3 "look down
          // ship.forward × 100" rule. AC #5a: dot(camera.forward,
          // normalize(target.pos - camera.pos)) ≥ 0.9999 pre-shake.
          // Ship.forward is now driven by predicted-intercept and
          // is structurally different from camera.forward —
          // measurement against ship.forward is no longer the
          // contract.
          this._currentLookAtTarget.copy(motionFrame.target.position);
        } else if (this._ship) {
          // V1 §A4 caller without a target in the frame — fall back
          // to the legacy framing-state path. Should not happen for
          // autopilot tour (frame.target is always set when V1
          // active); this branch guards against partial wiring.
          this._establishing.update(deltaTime, motionFrame, shipPhase, this._nav);
          this._currentLookAtTarget.copy(this._establishing.currentLookAtTarget);
        } else {
          // Legacy framing-state path for warp-arrival + manual-burn
          // callers. Retire when those paths migrate to AutopilotMotion.
          this._establishing.update(deltaTime, motionFrame, shipPhase, this._nav);
          this._currentLookAtTarget.copy(this._establishing.currentLookAtTarget);
        }
        break;
      }
    }
  }

  /** Reset mode state (call on tour start or scene change). */
  reset() {
    this._establishing.reset();
    // Mode itself stays as-is (ESTABLISHING by default) — resetting to
    // ESTABLISHING mid-session could inadvertently emit a camera-mode-change.
  }
}
