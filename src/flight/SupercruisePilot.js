// src/flight/SupercruisePilot.js
//
// Autopilot driver for SupercruiseModel (AC5). Issues the SAME controls a
// player has — setThrottle / setTurnInput — plus a body-locked HOLD that
// reproduces today's STATION-A linger (AutopilotMotion.js:583-642).
// Frame idiom copied from AutopilotMotion: one-shots polled by main.js.
import * as THREE from 'three';
import { alignStep, steerToward } from './aimAssist.js';

const NEG_Z = new THREE.Vector3(0, 0, -1); // local nose; setFromUnitVectors doesn't mutate args

export const PilotPhase = Object.freeze({
  IDLE: 'IDLE', ALIGN: 'ALIGN', CRUISE: 'CRUISE', HOLD: 'HOLD',
});

/**
 * @typedef {Object} PilotFrame   one-shot returned by SupercruisePilot.update(dt)
 * @property {('IDLE'|'ALIGN'|'CRUISE'|'HOLD')} phase        ENTRY phase that drove THIS frame
 * @property {('IDLE'|'ALIGN'|'CRUISE'|'HOLD')} prevPhase    phase on the prior frame
 * @property {boolean} phaseChanged    phase !== prevPhase (stamped in _stamp())
 * @property {boolean} motionComplete  HOLD linger timer elapsed (level-triggered past linger)
 * @property {boolean} overshoot       entered capture sphere too hot — flew past, stayed CRUISE
 * @property {boolean} decelStarted    one-shot AC6 shake cue at 15R (DECEL_CUE_FACTOR)
 * @property {boolean} stallAborted    CRUISE made no net progress for CRUISE_STALL_WINDOW s — leg aborted (WS-1 no-freeze guard)
 */
// Canonical field list/order of a PilotFrame — the named arrival/Frame contract.
export const PILOT_FRAME_FIELDS = Object.freeze([
  'phase', 'prevPhase', 'phaseChanged', 'motionComplete', 'overshoot', 'decelStarted', 'stallAborted',
]);

export const PILOT_TUNING = {
  ALIGN_DOT: 0.995,          // nose alignment to open the throttle (clean on-axis path)
  ALIGN_DOT_RELAXED: 0.985,  // looser gate — proceed to CRUISE once "close enough"; CRUISE keeps steering, so
                             //   perfect pre-alignment isn't required. Lets an orbiting moon (steady tracking lag
                             //   ~just under 0.995) leave ALIGN instead of hanging.
  ALIGN_TIMEOUT: 8.0,        // s — hard ALIGN cap. If neither dot gate is met within this window (e.g. a fast
                             //   orbit whose lag never settles), proceed to CRUISE anyway so the leg can't hang.
  CRUISE_THROTTLE: 0.75,     // Elite blue-zone
  STEER_GAIN: 3.0,           // local-offset → turn-input proportional gain
  DROP_RADIUS_FACTOR: 10,    // capture sphere = 10R (today's APPROACH onset)
  DROP_ETA_MAX: 2.5,         // s — dropMaxSpeed = max(10R / DROP_ETA_MAX, DROP_MAX_SPEED_FLOOR)
  // RC4 (tour-reliability-corrections, 2026-07-01): absolute floor under dropMaxSpeed. The
  // radius-scaled window (10R/DROP_ETA_MAX = 4R) is provably sufficient WHEN the target body's
  // own gravity well is what governs the ship's speed all the way in (cap at the capture sphere
  // is ≤ 3R there, always under 4R — see SupercruisePilot.test.js "capture stays arithmetically
  // possible"). It stops being sufficient the moment something ELSE sets the local cap near a
  // very small body (a bigger nearby mass, a coarser tracked reference, ...): 4R shrinks to a
  // near-zero target while the ship's actual crawl speed there does not, and it flies through
  // uncaptured. CONSTRAINT the floor value must satisfy: bigger than ordinary near-body crawl
  // speeds (a small fraction of a u/s) so tiny bodies still capture, yet far below 4R for any
  // body radius that isn't itself minute (radius ≳ 0.03) — so it can only ever WIDEN the tiny-
  // body window and never touches the existing large-body threshold (AC4: R=0.48 ⇒ unchanged).
  // SCOPE (adversarial review, 2026-07-01 — SupercruiseCaptureFloor.test.js AC4(a)/AC4(a2)/
  // AC4-known-limit): main.js registers every moon as its OWN gravity body every tick, so the
  // live tour's target is normally self-governed — this floor is then a byte-identical no-op
  // (self-governed capture already works with NO floor, at any production radius). This floor
  // only earns its keep for an EXTERNALLY-governed tiny target (a nearby body sets the local cap
  // above the target's own 4R window): measured sufficient for governor radii up to ~0.2, NOT
  // beyond ~0.21 (that case still fails to reach HOLD, though it now cleanly stall-aborts via
  // RC1 instead of hanging). Whether real live geometry needs the >0.21 case is unresolved by
  // unit tests alone — deferred to the AC6/AC7 live monitored-tour gate.
  DROP_MAX_SPEED_FLOOR: 0.1, // u/s — floor under dropMaxSpeed; see constraint above
  DECEL_CUE_FACTOR: 15,      // decelStarted one-shot at 15R (AC6 shake cue)
  HOLD_VIEW_FRAC: 2.6,       // hold distance ≈ 2.6R (today's felt-fill)
  HOLD_SETTLE_TAU: 0.6,      // s — exponential ease from capture point to hold point (kills HOLD-entry snap)
  // WS-1 CRUISE stall-detector (no-freeze guard). CRUISE has no natural timeout; a leg blocked by the
  // star (wedge), pinned at a collision barrier, or chasing an uncatchable fast-orbiting moon would
  // stay in CRUISE forever. CAP-RELATIVE (corrected 2026-07-01, tour-reliability-corrections RC1 —
  // replaces an earlier absolute "2% of the leg's initial distance" quota that killed every long leg
  // in its terminal crawl, since near-body absolute progress-per-window collapses as the speed cap
  // shrinks approaching a body): 'stuck' is judged against what the CURRENT model.speedCap() permits,
  // not the leg's absolute distance. Each CRUISE frame, dist-to-target must beat its running best by
  // CRUISE_STALL_CAP_FRAC * speedCap() * (time since that best was last set) — i.e. sustained closing
  // progress below a small fraction of the achievable speed — or the no-progress clock keeps running;
  // CRUISE_STALL_WINDOW seconds of that aborts the leg (frame.stallAborted). A leg genuinely crawling
  // AT the cap near a body (absolute speed tiny, but that IS the locally achievable speed) always
  // clears this — the check only trips a leg making LESS progress than its own well permits (wedged,
  // barrier-pinned at speed~0 while the cap is meaningfully positive, or a fast-orbit that never closes
  // even though the cap stays high). Only the CRUISE phase is watched — a HOLD park (linger:∞) never is.
  CRUISE_STALL_WINDOW: 12.0,     // s — no-sufficient-progress window before abort
  CRUISE_STALL_CAP_FRAC: 0.1,    // k — required closing rate, as a fraction of the CURRENT speedCap()
};

export class SupercruisePilot {
  constructor(model, tuning = {}) {
    this.model = model;
    this.tuning = { ...PILOT_TUNING, ...tuning };
    this.phase = PilotPhase.IDLE;
    this._target = null;       // { mesh, radius, linger }
    this._holdOffset = new THREE.Vector3();
    this._holdPoint = new THREE.Vector3();
    this._holdTimer = 0;
    this._alignTimer = 0;
    this._decelCued = false;
    this._cruiseStallTimer = 0;   // WS-1: s since dist-to-target last beat its cap-relative-required best
    this._cruiseBestDist = Infinity; // WS-1: dist-to-target ratchet — the reference the next required-progress check is measured against
    this._prevPhase = PilotPhase.IDLE;
    this._toTarget = new THREE.Vector3();
    this._local = new THREE.Vector3();
    this._invQ = new THREE.Quaternion();
    this._holdQ = new THREE.Quaternion();
    this._steerOut = { yaw: 0, pitch: 0 };
  }

  get isActive() { return this.phase !== PilotPhase.IDLE; }

  // Increment 1 (autopilot-standoff-routing): beginLeg now accepts an optional
  // per-leg `standoff` hold distance and an optional `toPosition` (a fixed
  // point/waypoint) target instead of only a mesh. `standoff` overrides the
  // hardcoded bodyRadius*HOLD_VIEW_FRAC (2.6R) at capture so the tour can park
  // OUTSIDE a star's gravity well; absent it, capture is byte-for-byte today's
  // 2.6R. `toPosition` lets the tour fly a pass-through go-around waypoint (no
  // mesh) — wrapped in a { position } shim so the whole update() path is unchanged.
  beginLeg({ toBody, bodyRadius, linger = 8, standoff = null, toPosition = null }) {
    // A position/waypoint target is wrapped so tgt.mesh.position still resolves.
    const mesh = toPosition != null ? { position: toPosition } : toBody;
    this._target = { mesh, radius: bodyRadius, linger, standoff };
    this.phase = PilotPhase.ALIGN;
    this._holdTimer = 0;
    this._alignTimer = 0;
    this._decelCued = false;
    this._cruiseStallTimer = 0;      // WS-1: fresh no-progress window per leg
    this._cruiseBestDist = Infinity;
  }

  stop() {
    this.model.setTurnInput(0, 0); // momentary control; throttle stays — latched setting (Elite semantics)
    this.phase = PilotPhase.IDLE;
    this._target = null;
  }

  /** Step the driver. Returns the one-shot frame; caller then steps the model. */
  update(dt) {
    const frame = {
      phase: this.phase, prevPhase: this._prevPhase,
      phaseChanged: false, motionComplete: false,
      overshoot: false, decelStarted: false, stallAborted: false,
    };
    this._prevPhase = this.phase;
    if (this.phase === PilotPhase.IDLE || !this._target) return frame;

    const m = this.model, t = this.tuning, tgt = this._target;
    const bodyPos = tgt.mesh.position;
    this._toTarget.copy(bodyPos).sub(m.position);
    const dist = this._toTarget.length();
    const dropRadius = tgt.radius * t.DROP_RADIUS_FACTOR;
    const dropMaxSpeed = Math.max(dropRadius / t.DROP_ETA_MAX, t.DROP_MAX_SPEED_FLOOR);

    if (this.phase === PilotPhase.HOLD) {
      // Body-locked hold (today's STATION-A): ease toward the (moving) hold
      // point — exponential settle from the capture point (≤10R) instead of a
      // one-frame teleport. Converges in ~3τ ≈ 1.8 s, then chases the moving
      // hold point with sub-visual steady-state lag.
      const k = 1 - Math.exp(-dt / t.HOLD_SETTLE_TAU);
      this._holdPoint.copy(bodyPos).add(this._holdOffset);
      m.position.lerp(this._holdPoint, k);
      m.speed = 0; m.setThrottle(0); m.setTurnInput(0, 0);
      this._lookAtBody(bodyPos, dt);
      // Linger timing starts at HOLD entry (simpler than settle-gating, and a
      // moving body can never stall the timer); ~1.8 s of the linger is settle.
      this._holdTimer += dt;
      if (this._holdTimer >= tgt.linger) frame.motionComplete = true;
      return this._stamp(frame);
    }

    // Steer toward the body via the shared aimAssist.steerToward helper
    // (extracted from this block; behavior-identical). It reads the body's CURRENT
    // (moving) position every frame — so the aim already leads an orbiting target;
    // no stale capture. _local is still computed for the ALIGN_DOT check below
    // (−localZ = nose-to-target alignment).
    this._local.copy(this._toTarget).normalize()
      .applyQuaternion(this._invQ.copy(m.orientation).invert());
    const { yaw: yawIn, pitch: pitchIn } = steerToward(m.orientation, m.position, bodyPos, t.STEER_GAIN, this._steerOut);
    m.setTurnInput(yawIn, pitchIn);
    const noseDot = -this._local.z;

    if (this.phase === PilotPhase.ALIGN) {
      m.setThrottle(0);
      this._alignTimer += dt;
      // Proceed once "close enough" (relaxed gate) OR after the timeout — so an
      // orbiting moon whose tracking lag asymptotes just under ALIGN_DOT can't
      // hang ALIGN forever. CRUISE keeps steering at the (moving) target, so it
      // closes the residual error in flight; perfect pre-alignment isn't needed.
      if (noseDot >= t.ALIGN_DOT_RELAXED || this._alignTimer >= t.ALIGN_TIMEOUT) {
        this.phase = PilotPhase.CRUISE;
      }
    } else if (this.phase === PilotPhase.CRUISE) {
      // WS-1 no-freeze guard: watch dist-to-target while in CRUISE. CAP-RELATIVE — the
      // ship must beat its running-best dist by at least CRUISE_STALL_CAP_FRAC (k) of
      // the CURRENT speedCap(), sustained for the time since that best was set; failing
      // that for CRUISE_STALL_WINDOW seconds (wedged behind the star, barrier-pinned, or
      // chasing an uncatchable fast moon) aborts the leg — the caller skips-and-continues
      // (tour) or drops out (Assist). A leg crawling AT the cap near a body (tiny absolute
      // speed, but that's the achievable speed there) always beats this and never trips; a
      // HOLD park is a different phase and is never watched here.
      if (frame.prevPhase !== PilotPhase.CRUISE) {
        this._cruiseBestDist = dist;   // first CRUISE frame — seed the ratchet
        this._cruiseStallTimer = 0;
      } else {
        this._cruiseStallTimer += dt;
        // Distance the ship should have closed by now if moving at just k×cap for the
        // whole no-progress window — recomputed off the CURRENT cap each frame, so a
        // shrinking near-body cap only ever makes this MORE lenient, never less (biasing
        // toward "don't abort a real leg", never toward a false abort).
        const need = t.CRUISE_STALL_CAP_FRAC * m.speedCap() * this._cruiseStallTimer;
        if (this._cruiseBestDist - dist >= need) {
          this._cruiseBestDist = dist; // real cap-relative progress — restart the window
          this._cruiseStallTimer = 0;
        }
        if (this._cruiseStallTimer >= t.CRUISE_STALL_WINDOW) {
          frame.stallAborted = true;
          m.setTurnInput(0, 0);
          this.phase = PilotPhase.IDLE;
          this._target = null;
          return this._stamp(frame);
        }
      }
      m.setThrottle(t.CRUISE_THROTTLE);
      if (!this._decelCued && dist <= tgt.radius * t.DECEL_CUE_FACTOR) {
        this._decelCued = true; frame.decelStarted = true;
      }
      if (dist <= dropRadius) {
        if (m.speed <= dropMaxSpeed) {
          // Capture: enter the body-locked hold. Hold distance = the per-leg
          // standoff when supplied (Increment 1 — parks the star OUTSIDE its
          // gravity well), else today's felt-fill 2.6R. The ×1.05 inside-body
          // guard is scale-free and applies to both (a standoff below 1.05R
          // would still clear the surface).
          const holdDist = tgt.standoff != null
            ? Math.max(tgt.standoff, tgt.radius * 1.05)
            : Math.max(tgt.radius * t.HOLD_VIEW_FRAC, tgt.radius * 1.05);
          this._holdOffset.copy(m.position).sub(bodyPos)
            .normalize().multiplyScalar(holdDist);
          this.phase = PilotPhase.HOLD;
          this._holdTimer = 0;
        } else {
          frame.overshoot = true; // too hot — fly past, stay in CRUISE
        }
      }
    }
    return this._stamp(frame);
  }

  _lookAtBody(bodyPos, dt) {
    // During HOLD keep the nose on the body so the resumed leg departs cleanly.
    alignStep(this.model.orientation, this.model.position, bodyPos, dt, 0.16);
  }

  _stamp(frame) {
    // Report the ENTRY phase — the phase that drove this frame's behavior.
    // (Stamping the exit phase double-fires phaseChanged — once on the
    // transition frame, again on the next — and hides one-frame phases
    // like an instant on-axis ALIGN.)
    frame.phaseChanged = frame.phase !== frame.prevPhase;
    return frame;
  }
}
