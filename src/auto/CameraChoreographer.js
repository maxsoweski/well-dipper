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

/**
 * Live-feedback loop (a) cycle 4 Attempt 1 — half-life of the
 * target-position critically-damped spring that smooths the raw
 * look-at target. Parameterized as "time for the filter to close half
 * the remaining gap to the raw setpoint" — at critical damping, ~63%
 * closure in one half-life and ~95% closure in ~3 half-lives. 0.35s
 * gives ~1s total settling on a framing-state flip, inside the
 * "Blue Danube" / 2001 station-dock musical-phrasing range (feature
 * doc §"Camera axis — ESTABLISHING" + Director §5.5).
 *
 * Replaces the cycle-1/2/3 angular-rate clamp class — "angular-rate
 * clamping on the camera's look direction does not appear as a
 * primary mechanism anywhere reputable. Where rate limits show up,
 * they're secondary safety nets on top of a damped target." (Dana,
 * research/autopilot-camera-motion-prior-art-2026-04-24.md, cited by
 * Director §5 closure at audit f63ec122...). One tuning knob in V1;
 * damping ratio ζ = 1.0 hardcoded critical.
 */
const TARGET_HALF_LIFE_SEC = 0.35;

/**
 * Live-feedback loop (a) cycle 2 — minimum permissible distance from
 * ship (= camera) position to the raw look-at target. Acts as a
 * geometric precondition on three.js `camera.lookAt()`: when the
 * target sits within a scene-unit-scale distance of the camera, the
 * lookAt-quaternion computation amplifies millimeter target wobbles
 * into large orientation swings. Pushing the target outward to this
 * minimum distance along its current direction keeps the
 * `normalize`-amplification effect contained.
 *
 * Director 2026-04-24 cycle 2: 2.0 scene units. Observed degenerate
 * clusters in the 450°/s clamp recording sat at distances of 0.30
 * (PANNING_AHEAD bias decay: pan-target-lerp landed on top of the
 * camera during APPROACH) and 0.46 (LINGERING: the orbit-body we
 * just left is still at orbit distance). 2.0 gives 4–6× margin and
 * keeps per-frame wobble below 1% of vector magnitude. Falsification
 * signal: LINGER framing on small moons visibly "looks past" the
 * body rather than at it — then reduce to 1.0 and re-capture.
 */
const MIN_TARGET_DISTANCE = 2.0;

// ══════════════════════════════════════════════════════════════════════

// Reusable vectors
const _tmpTarget = new THREE.Vector3();
const _tmpNext = new THREE.Vector3();
// Loop (a) distance-guard scratch.
const _loopATmpC = new THREE.Vector3();

/**
 * Loop (a) cycle 4 Attempt 1 — `spring_damper_exact` implementation
 * (Daniel Holden, "Spring-It-On: The Game Developer's Spring-Roll-
 * Call": https://theorangeduck.com/page/spring-roll-call).
 *
 * Analytical closed-form update of a critically-damped (ζ = 1.0)
 * second-order spring. Frame-rate independent by construction — the
 * closed-form solution integrates the ODE exactly over `deltaTime`,
 * unlike `lerp(x, goal, 0.1)`-style ad-hoc smoothing that loses
 * accuracy at high or variable framerates (Dana landmine #5).
 *
 * Mutates `position` and `velocity` IN PLACE. Operates on a Vector3
 * as three independent scalar spring updates (one per axis) —
 * mathematically equivalent to a spring on the 3D point for linear
 * vector spaces because critically-damped analytical updates commute
 * with linear composition.
 *
 * Holden's form (from the reference, with `v_goal = 0` specialized):
 *     y    = 2 · ln(2) / halfLife        (damping coefficient)
 *     j0   = x − x_goal                   (displacement)
 *     j1   = v + j0 · y                   (adjusted velocity)
 *     eydt = exp(−y · dt)
 *     x(t+dt) = eydt · (j0 + j1 · dt) + x_goal
 *     v(t+dt) = eydt · (v − j1 · y · dt)
 *
 * @param {THREE.Vector3} position — spring's current position state; mutated
 * @param {THREE.Vector3} velocity — spring's current velocity state; mutated
 * @param {THREE.Vector3} goal — setpoint (position the spring pulls toward)
 * @param {number} halfLife — decay half-life in seconds
 * @param {number} deltaTime — frame timestep in seconds
 */
const _SPRING_LN2 = Math.log(2);
const _springJ0 = new THREE.Vector3();
const _springJ1 = new THREE.Vector3();
function _springDamperExact(position, velocity, goal, halfLife, deltaTime) {
  if (halfLife < 1e-6) {
    position.copy(goal);
    velocity.set(0, 0, 0);
    return;
  }
  const y = (2 * _SPRING_LN2) / halfLife;
  const eydt = Math.exp(-y * deltaTime);
  // j0 = x − goal
  _springJ0.subVectors(position, goal);
  // j1 = v + j0 · y
  _springJ1.copy(velocity).addScaledVector(_springJ0, y);
  // position = eydt · (j0 + j1 · dt) + goal
  position.copy(goal)
    .addScaledVector(_springJ0, eydt)
    .addScaledVector(_springJ1, eydt * deltaTime);
  // velocity = eydt · (v − j1 · y · dt)
  //          = eydt · v − eydt · j1 · y · dt
  velocity.multiplyScalar(eydt)
    .addScaledVector(_springJ1, -eydt * y * deltaTime);
}

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

    // Loop (a) — first-frame guard for the distance guard's
    // degenerate-fallback chain (if both the raw and prior directions
    // are too short to be a valid anchor, we need to know if the
    // prior exists at all before using it). Also gates the spring
    // filter's "snap on ESTABLISHING entry" path (see below).
    this._hasValidPriorTarget = false;

    // Loop (a) cycle 4 Attempt 1 — spring filter state.
    //
    // Director cycle-4 Attempt-1 post-guard re-audit (2026-04-24)
    // switched the filter's state surface from a world-space target
    // POINT to a ship-relative OFFSET. `_filteredOffset` = the
    // smoothed `(rawTarget − shipPos)` vector; at consumption the
    // world-space look-at target is reconstructed as
    // `shipPos + _filteredOffset`.
    //
    // Rationale: a lagging world-space target can be OVERTAKEN by the
    // moving ship, flipping the direction 180° in a single frame —
    // the failure mode that surfaced in the post-guard capture (707
    // rad/s spike). A ship-relative offset cannot be "overtaken" by
    // the ship that carries the filter state; when the ship moves,
    // the offset naturally moves with it. The overtake class is
    // precluded by construction.
    //
    // Velocity state remains a time-derivative of the offset vector
    // in world-axes (Director: "do NOT rotate velocity into ship-
    // local frame on framing-state flips — that's the coupling §587
    // feared, and it stays foreclosed").
    //
    // Both fields persist across framing-state flips (TRACKING ↔
    // LINGERING ↔ PANNING_AHEAD) — no reset on flip. Director §5.4
    // + §6a M5. `_hasInitializedFilter` gates the first-frame "snap
    // to raw-guarded offset" initialization path.
    this._filteredOffset = new THREE.Vector3();
    this._filteredTargetVelocity = new THREE.Vector3();
    this._hasInitializedFilter = false;
    // Scratch: reconstructed world-space target = shipPos + _filteredOffset.
    // Held as a field so the post-filter guard and the blend can share it.
    this._filteredTarget = new THREE.Vector3();
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
    this._hasValidPriorTarget = false;
    this._filteredOffset.set(0, 0, 0);
    this._filteredTargetVelocity.set(0, 0, 0);
    this._filteredTarget.set(0, 0, 0);
    this._hasInitializedFilter = false;
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
          //
          // ⚠ DECLARED LIMIT — ANCHOR MISMATCH WITH THE GENERIC TRANSITION BLEND,
          // LEFT IN PLACE DELIBERATELY. Recorded 2026-08-10.
          //
          // WHAT DIFFERS. The generic framing-state-change blend above
          // (`if (this._framingState !== prevFramingState)`) anchors on
          // `_currentLookAtTarget` — the POST-spring, post-blend point the camera
          // actually looked at last frame. This site anchors on
          // `_prevRawTargetFrame` — the PRE-spring raw target. The spring lags the
          // raw target by TARGET_HALF_LIFE_SEC, so these are two different points,
          // and the LINGERING→TRACKING hand-off therefore starts its blend from
          // somewhere the camera was never looking.
          //
          // MEASURED, not inferred: a one-frame look-at pop of 6.7°–19.2°, which is
          // 10–25× the surrounding per-frame angular delta. Causation is pinned by a
          // half-life sweep — the pop scales with TARGET_HALF_LIFE_SEC and vanishes
          // when the spring is effectively disabled: 0.35 s → 35.4 units, 0.10 s →
          // 11.5, 1e-6 s → 0.000.
          //
          // ⛔ UNREACHABLE TODAY, which is why it is documented rather than changed.
          // LINGERING is entered ONLY on the STATION→CRUISE edge above, and
          // ShipPhase.STATION is produced ONLY by ShipChoreographer.update's
          // subPhase mapping (`else if (subPhase === 'orbiting')`), which is dead
          // while its `_phase === ShipPhase.IDLE` early return holds. The one live
          // entry into NavigationSubsystem — commitBurn → focusShip →
          // `navSubsystem.beginMotion({…})` in main.js — runs `stopFlythrough()`
          // first, and that calls `shipChoreographer.stop()`, which sets
          // `_phase = IDLE`. Independently, that ship-lock leg is `holdOnly` with
          // `orbitDuration: 99999`, so even a non-IDLE choreographer would never see
          // 'orbiting' hand back to 'traveling'. No STATION ⇒ no STATION→CRUISE ⇒
          // no LINGERING.
          //
          // NOT A DELIBERATE ASYMMETRY — AN INCIDENTAL IDENTITY THAT GOT SPLIT.
          // Before 92614e5 the blend consumed the raw target directly
          // (`this._currentLookAtTarget.copy(this._prevRawTargetFrame)` at that
          // revision), so once a blend had completed the two expressions named the
          // SAME point — and at THIS site the prior blend has ALWAYS completed,
          // since LINGER_DURATION (1.8 s) ≫ TRANSITION_BLEND_DURATION (0.4 s).
          // 92614e5 inserted the spring and introduced `_filteredTarget`, making
          // `_currentLookAtTarget` post-filter and splitting an identity nobody had
          // chosen. Treat the mismatch as a leftover, not as a design.
          //
          // THE REPAIR, NAMED: change this line to copy `this._currentLookAtTarget`
          // — the same expression the generic blend uses — at which point this
          // special case does exactly what the generic transition blend already does
          // and can go away entirely.
          //
          // WHY IT IS NOT APPLIED NOW: the path is unreachable, so there is no live
          // behaviour to regress the change against and no live symptom to fix; and
          // 92614e5, the commit that created the split, is itself un-UAT'd work that
          // was committed to clear a long-dirty tree. Apply the repair in the same
          // change that first makes LINGERING reachable, and gate it on Max's eyes
          // then — a look-at pop is a UAT-layer judgement, not a unit assertion.
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

    // ── Loop (a) cycle 2 — target-distance guard ──
    // three.js `camera.lookAt(target)` is numerically unstable when
    // |target − cameraPos| is small (millimeter perturbations on a
    // short relative vector produce wild quaternion swings after
    // normalization). Cycle-1's angular-rate clamp on the raw-target
    // direction did not bound this because the instability lives
    // DOWNSTREAM of the raw-target pipe, inside the lookAt call. The
    // guard is the Principle-5-compliant fix: push the target outward
    // to MIN_TARGET_DISTANCE before the clamp, so the lookAt input is
    // always in the stable regime.
    //
    // Degenerate fallback chain (per Director 2026-04-24):
    //   1. If |target − shipPos| >= MIN_TARGET_DISTANCE → no-op.
    //   2. If |target − shipPos| in (ε, MIN_TARGET_DISTANCE) → push
    //      outward to MIN_TARGET_DISTANCE along the current direction.
    //   3. If |target − shipPos| < ε (direction numerically zero) →
    //      fall back to the prior-frame _currentLookAtTarget direction.
    //   4. If that too is degenerate → fall back to WORLD −Z: the literal
    //      vector (0, 0, -1), in world axes. NOT camera-forward.
    //
    // ⚠ STEP 4 READ "camera forward
    // ((0,0,-1).applyQuaternion(camera.quaternion))" until 2026-08-10.
    // That was a STALE PROMISE in the header, NOT a defect in the code
    // below, and the header is what was corrected. This mode holds no
    // camera reference and never has: `EstablishingMode`'s constructor
    // takes no arguments, and its update signature is
    // `(deltaTime, motionFrame, shipPhase, nav)`. That is the AC #8
    // camera-axis-only invariant stated in the block comment above the
    // class, and it is the same split the file header declares — the
    // choreographer produces the TARGET and never calls `camera.lookAt`,
    // which stays in FlythroughCamera. So `applyQuaternion(camera
    // .quaternion)` is not a missing line here; it is architecturally
    // unavailable, and threading a camera reference in to satisfy the old
    // wording would break the invariant this module exists to hold.
    //
    // What world −Z actually buys: it is camera-forward on the canonical
    // identity orientation, and it is only ever reached when two
    // successive frames BOTH put the target on top of the ship. At that
    // point every unit vector is equally defensible — step 4's job is to
    // hand `camera.lookAt` SOME finite, non-degenerate target, not a
    // correct one.
    //
    // FOUR SITES, NOT TWO. This chain's steps 3–4 are duplicated verbatim
    // by the POST-filter distance guard further down, so `set(0, 0, -1)`
    // appears twice here and twice there, all four with this meaning. Any
    // future rewording has to move all four together.
    {
      const shipPos = motionFrame.position;
      _loopATmpC.subVectors(this._prevRawTargetFrame, shipPos);
      const dist = _loopATmpC.length();
      if (dist < MIN_TARGET_DISTANCE) {
        if (dist > 1e-6) {
          _loopATmpC.divideScalar(dist);
        } else if (this._hasValidPriorTarget) {
          _loopATmpC.subVectors(this._currentLookAtTarget, shipPos);
          const priorDist = _loopATmpC.length();
          if (priorDist > 1e-6) {
            _loopATmpC.divideScalar(priorDist);
          } else {
            // Step 4 — last-resort fallback: WORLD −Z. Camera-forward
            // on the canonical identity orientation only; this mode
            // holds no camera reference, so the live orientation is
            // not available here and is not consulted (see the chain
            // header above). Practically unreachable — priorDist would
            // need to also be zero, which implies back-to-back frames
            // both had the target on top of the ship.
            _loopATmpC.set(0, 0, -1);
          }
        } else {
          // First-frame-before-any-prior case. Same world −Z as step 4,
          // for the same reason: no prior anchor exists yet, and no
          // camera orientation is reachable from this mode.
          _loopATmpC.set(0, 0, -1);
        }
        this._prevRawTargetFrame.copy(shipPos).addScaledVector(_loopATmpC, MIN_TARGET_DISTANCE);
      }
    }

    // ── Loop (a) cycle 4 Attempt 1 (Q) — ship-relative offset spring ──
    // Smooths the SHIP-RELATIVE offset `(rawTarget − shipPos)` rather
    // than the world-space target point. At consumption, the world-
    // space target is reconstructed as `shipPos + _filteredOffset`.
    // This precludes the ship-overtake-target pathology by
    // construction: a ship-relative offset cannot be overtaken by the
    // ship that carries the filter state.
    //
    // On the FIRST frame after EstablishingMode becomes active, snap
    // the filter state to the raw-guarded offset (no transient catch-
    // up — AC #7 initialization rule / Director §6a M5). From the
    // second frame onward, `springDamperExact` drives the state.
    // Filter state PERSISTS across framing-state flips — no reset
    // (Director §5.4 + §6a M5). Velocity stays as the offset's
    // time-derivative in world-axes (Director: "do NOT rotate
    // velocity into ship-local frame on framing-state flips").
    {
      const shipPos = motionFrame.position;
      _loopATmpC.subVectors(this._prevRawTargetFrame, shipPos);  // raw offset
      if (!this._hasInitializedFilter) {
        this._filteredOffset.copy(_loopATmpC);
        this._filteredTargetVelocity.set(0, 0, 0);
        this._hasInitializedFilter = true;
      } else if (deltaTime > 1e-6) {
        _springDamperExact(
          this._filteredOffset,
          this._filteredTargetVelocity,
          _loopATmpC,
          TARGET_HALF_LIFE_SEC,
          deltaTime,
        );
      }
      // Reconstruct world-space target for downstream consumption.
      this._filteredTarget.copy(shipPos).add(this._filteredOffset);
    }

    // ── Loop (a) cycle 4 Attempt 1 — POST-filter distance guard ──
    // Numerical-tiny-step defense. With ship-relative offset
    // filtering (Q), the ship-overtake class is precluded by
    // construction, so this guard's residual role is catching the
    // small-offset edge where `|_filteredOffset| < MIN_TARGET_DISTANCE`
    // (e.g., approach-phase close-in where the raw offset itself
    // approaches the body surface). Expected to fire rarely.
    //
    // NOT a rate clamp. Director §5.7's foreclosure stands; this is
    // the cycle-2 geometric precondition `camera.lookAt` requires.
    {
      const shipPos = motionFrame.position;
      _loopATmpC.subVectors(this._filteredTarget, shipPos);
      const dist = _loopATmpC.length();
      if (dist < MIN_TARGET_DISTANCE) {
        if (dist > 1e-6) {
          _loopATmpC.divideScalar(dist);
        } else if (this._hasValidPriorTarget) {
          _loopATmpC.subVectors(this._currentLookAtTarget, shipPos);
          const priorDist = _loopATmpC.length();
          if (priorDist > 1e-6) {
            _loopATmpC.divideScalar(priorDist);
          } else {
            // Sites 3 and 4 of the four named in the pre-filter guard's
            // chain header: WORLD −Z, not camera-forward. Same reason —
            // EstablishingMode holds no camera reference, so the live
            // orientation cannot be applied here.
            _loopATmpC.set(0, 0, -1);
          }
        } else {
          _loopATmpC.set(0, 0, -1);
        }
        this._filteredTarget.copy(shipPos).addScaledVector(_loopATmpC, MIN_TARGET_DISTANCE);
      }
    }

    // ── Blend from pre-transition anchor toward filtered target ──
    // The transition blend is a separate smoothing stage that handles
    // framing-state flips (LINGERING ↔ TRACKING ↔ PANNING_AHEAD) over
    // TRANSITION_BLEND_DURATION. It composes ON TOP of the spring's
    // output — the spring handles frame-to-frame smoothness, the
    // blend handles inter-state hand-off shape. Both consume the
    // post-filter signal (`_filteredTarget`), not the raw target.
    if (this._blendElapsed >= TRANSITION_BLEND_DURATION) {
      this._currentLookAtTarget.copy(this._filteredTarget);
    } else {
      const u = this._blendElapsed / TRANSITION_BLEND_DURATION;
      const smoothU = u * u * (3 - 2 * u);  // smoothstep for gentle ease
      this._currentLookAtTarget.copy(this._blendFromTarget).lerp(this._filteredTarget, smoothU);
    }
    this._hasValidPriorTarget = true;

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

    // Per the 2026-04-25 lhokon amendment, AutopilotMotion is the
    // single source of truth for the camera's authored look
    // direction. The previous in-CRUISE direction-nlerp lived here
    // — it produced the AC #5a FAIL by smoothing during ship-burn,
    // which the brief forbade. The smoothing now lives in
    // AutopilotMotion._tickLhokon, gated by a phase that runs while
    // the ship is stationary (AC #13). This module reads
    // motionFrame.cameraLookDir each frame and places the lookAt
    // point along that direction. Scratch vector for distance-to-
    // target placement.
    this._tgtVecScratch = new THREE.Vector3();
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
          // §A4 ESTABLISHING + 2026-04-25 lhokon amendment: the
          // camera applies the authored look direction supplied by
          // AutopilotMotion on the motion frame. During CRUISE /
          // APPROACH / STATION-A this equals the pursuit-curve
          // direction (unit(target.position − camPos)) — i.e.,
          // strict per-frame body-tracking per AC #5a. During
          // LHOKON this is the in-flight nlerp output, smoothly
          // converging to the new pursuit-curve direction over
          // LHOKON_TIMEOUT_SEC while the ship is anchored.
          //
          // Output: lookAt = camPos + cameraLookDir × tgtLen, where
          // tgtLen is the camPos→target distance. The placement
          // distance doesn't affect the look direction (camera.lookAt
          // normalizes anyway) but keeps the world-space look point
          // on or near the target's surface for any downstream
          // consumer that reads currentLookAtTarget directly.
          const camPos = motionFrame.position;
          this._tgtVecScratch.subVectors(motionFrame.target.position, camPos);
          const tgtLen = this._tgtVecScratch.length();
          const lookDir = motionFrame.cameraLookDir;
          if (lookDir) {
            this._currentLookAtTarget.copy(camPos).addScaledVector(lookDir, Math.max(tgtLen, 1));
          } else {
            // Fallback: AutopilotMotion didn't supply cameraLookDir
            // (e.g., partial wiring). Apply strict pursuit-curve
            // direction directly — matches AC #5a's "every frame,
            // camera.lookAt(target.current_position)" by construction.
            this._currentLookAtTarget.copy(motionFrame.target.position);
          }
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
