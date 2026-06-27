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
 */
// Canonical field list/order of a PilotFrame — the named arrival/Frame contract.
export const PILOT_FRAME_FIELDS = Object.freeze([
  'phase', 'prevPhase', 'phaseChanged', 'motionComplete', 'overshoot', 'decelStarted',
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
  DROP_ETA_MAX: 2.5,         // s — dropMaxSpeed = 10R / DROP_ETA_MAX
  DECEL_CUE_FACTOR: 15,      // decelStarted one-shot at 15R (AC6 shake cue)
  HOLD_VIEW_FRAC: 2.6,       // hold distance ≈ 2.6R (today's felt-fill)
  HOLD_SETTLE_TAU: 0.6,      // s — exponential ease from capture point to hold point (kills HOLD-entry snap)
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
    this._prevPhase = PilotPhase.IDLE;
    this._toTarget = new THREE.Vector3();
    this._local = new THREE.Vector3();
    this._invQ = new THREE.Quaternion();
    this._holdQ = new THREE.Quaternion();
    this._steerOut = { yaw: 0, pitch: 0 };
  }

  get isActive() { return this.phase !== PilotPhase.IDLE; }

  beginLeg({ toBody, bodyRadius, linger = 8 }) {
    this._target = { mesh: toBody, radius: bodyRadius, linger };
    this.phase = PilotPhase.ALIGN;
    this._holdTimer = 0;
    this._alignTimer = 0;
    this._decelCued = false;
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
      overshoot: false, decelStarted: false,
    };
    this._prevPhase = this.phase;
    if (this.phase === PilotPhase.IDLE || !this._target) return frame;

    const m = this.model, t = this.tuning, tgt = this._target;
    const bodyPos = tgt.mesh.position;
    this._toTarget.copy(bodyPos).sub(m.position);
    const dist = this._toTarget.length();
    const dropRadius = tgt.radius * t.DROP_RADIUS_FACTOR;
    const dropMaxSpeed = dropRadius / t.DROP_ETA_MAX;

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
      m.setThrottle(t.CRUISE_THROTTLE);
      if (!this._decelCued && dist <= tgt.radius * t.DECEL_CUE_FACTOR) {
        this._decelCued = true; frame.decelStarted = true;
      }
      if (dist <= dropRadius) {
        if (m.speed <= dropMaxSpeed) {
          // Capture: enter the body-locked hold at felt-fill distance.
          this._holdOffset.copy(m.position).sub(bodyPos)
            .normalize().multiplyScalar(Math.max(tgt.radius * t.HOLD_VIEW_FRAC, tgt.radius * 1.05)); // scale-free: ×1.05 inside-body guard, no absolute term
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
