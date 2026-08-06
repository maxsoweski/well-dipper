// src/flight/ShipControls.js
//
// The single named ship-control surface (contract supercruise-control-harness
// -2026-06-26). Owns model + pilot + head; the player, the autopilot, the
// attract tour, and the lab/tests all act on the ship THROUGH this object.
//
// PORTABLE core (runs identically in lab + game): the command verbs, the
// steer-shaping (with the casing fix), the flyTo→arrival driver, getState, and
// the safe pilot→model step order. HOST-coupled steps (camera-mode toggle,
// Settings read, reticle/focus pipeline, no-snap exit, the _scDeflection write,
// the drop-state read) arrive as a `host` object of thin callbacks so this
// class never imports main.js. Absent host callback ⇒ that step is a no-op
// (the lab/headless case).
import { shapeStick, STICK_TUNING } from './stickCurve.js';
import { makeArrival } from './Arrival.js';

// Re-export the named PilotFrame contract from the single surface module so
// consumers (the lab, labVerbs.test.js, Task 2 Step 12) can import BOTH
// ShipControls and PILOT_FRAME_FIELDS from this one file. Pure passthrough,
// no behavior — PILOT_FRAME_FIELDS is DEFINED on SupercruisePilot.js (Step 13).
export { PILOT_FRAME_FIELDS } from './SupercruisePilot.js';

const INERT_DROP = Object.freeze({ state: 'none', d: null, captureSphere: null, dropMaxSpeed: null });

export class ShipControls {
  constructor({ model, pilot, head, host = {}, stickTuning = null }) {
    this.model = model;
    this.pilot = pilot;
    this.head = head;
    this.host = host;
    // Live stick deadzone+expo tuning (UPPERCASE keys, as STICK_TUNING ships).
    // steer() lowercases these into shapeStick's opts so they actually apply.
    // SINGLE SOURCE: in-game, main.js passes the live module-scoped
    // _scStickTuning object (= window._sc.stickTuning) as `stickTuning`, and we
    // REFERENCE it (no spread/copy) so controls.tuning === _scStickTuning — the
    // same object the live `_deflected` input-gate reads (shapeStick(nx,ny,
    // _scStickTuning), main.js:9270). Mutating one UAT knob then moves both.
    // Lab/headless (no stickTuning) ⇒ own default copy so the lab still works.
    this.tuning = stickTuning ?? { ...STICK_TUNING };
    this._arrival = null;       // the in-flight Arrival being polled (flyTo)
  }

  // ── Throttle (reverse is real — model clamps −1..1) ──
  setThrottle(t) { this.model.setThrottle(t); }

  // ── Shaped steer (casing fix + negated turn-input + deflection sync) ──
  steer(x, y) {
    // Casing reconcile: shapeMagnitude reads lowercase { deadzone, expo }
    // (stickCurve.js:7) but the tuning exposes uppercase { DEADZONE, EXPO }.
    // Pass the lowercased opts so runtime tuning is no longer silently ignored.
    const shaped = shapeStick(x, y, { deadzone: this.tuning.DEADZONE, expo: this.tuning.EXPO });
    // Live joystick convention: setTurnInput(-x,-y), store un-negated deflection.
    this.model.setTurnInput(-shaped.x, -shaped.y);
    this.host.setDeflection?.({ x: shaped.x, y: shaped.y });
  }

  // ── Selection (host pipeline) ──
  selectTarget(target) { this.host.selectTarget?.(target); }
  deselect() { this.host.deselectTarget?.(); }

  // ── Stop: idle (zero throttle) vs takeover (throttle latched) ──
  stop(mode = 'idle') {
    // pilot.stop() zeroes turn input + phase + target but does NOT touch
    // model.throttle (SupercruisePilot.js:53-56 — Elite "latched" semantics), so
    // 'takeover' leaves the player's commanded throttle latched at its value.
    this.pilot.stop();                       // zeroes turn input, phase→IDLE, target=null
    if (mode === 'idle') this.model.setThrottle(0); // 'takeover' leaves throttle latched
  }

  // ── Named accessor over the cross-boundary pilot._target read ──
  get target() { return this.pilot._target; }

  // ── Live telemetry ──
  getState() {
    const m = this.model;
    return {
      speed: m.speed,
      commandedSpeed: m.throttle * m.speedCap(),
      throttle: m.throttle,
      // mode: the host's live flight TYPE, gated on engagement — null while idle
      // (contract §4: `_scManual ? _flightMode : null`, main.js:8420). The host's
      // flightMode() delegate IS that expression; readFlightType() (un-gated) is
      // still used by engage() to PICK the type, but getState reports null-when-idle.
      // No host (lab/headless) ⇒ no flightMode delegate ⇒ `?? null` ⇒ mode === null.
      mode: this.host.flightMode?.() ?? null,
      phase: this.pilot.phase,
      dropState: this.host.dropState?.() ?? { ...INERT_DROP },
    };
  }

  // ── Safe stepping: pilot.update ALWAYS before model.update ──
  step(dt) {
    if (this.pilot.isActive) {
      const frame = this.pilot.update(dt);
      this.model.update(dt);
      if (this._arrival) this._arrival.poll(frame);
      return frame;
    }
    this.model.update(dt);
    return null;
  }

  // ── flyTo: begin a pilot leg, return the named Arrival ──
  // LAB/HEADLESS: self-steps the model at fixed 60 Hz (the flyFromRest pattern,
  //   main.js:628-632) and resolves on motionComplete — pass { selfStep: true }
  //   (the default OUTSIDE a live 60 Hz loop). A maxSteps safety cap prevents
  //   an infinite loop on a leg that never completes.
  // IN-GAME: pass { selfStep: false } — flyTo only calls pilot.beginLeg and
  //   returns the Arrival; the live sim loop owns stepping and feeds frames to
  //   arrival.poll() via this.step().
  // Increment 1 (autopilot-standoff-routing): `standoff` (per-leg hold distance)
  // and `toPosition` (a fixed go-around waypoint, no mesh) are forwarded through
  // to beginLeg. Both default to null → byte-for-byte today's leg. Assist legs
  // (no standoff, no toPosition) are unaffected.
  flyTo({ toBody, bodyRadius, linger = 8, standoff = null, toPosition = null, selfStep = true, maxSteps = 100000, dt = 1 / 60 } = {}) {
    this.pilot.beginLeg({ toBody, bodyRadius, linger, standoff, toPosition });
    const arrival = makeArrival();
    this._arrival = arrival;
    if (!selfStep) return arrival;            // in-game: the loop polls via step()
    // Headless: drive the model ourselves until the leg completes or we cap out.
    for (let i = 0; i < maxSteps; i++) {
      const frame = this.pilot.update(dt);
      this.model.update(dt);
      if (arrival.poll(frame)) return arrival;
    }
    arrival.cancel();                          // step cap hit → reject (timed out)
    this._arrival = null;
    return arrival;
  }

  // ── engage: the F-on toggle made callable (host owns camera/Settings/seed) ──
  engage(type) {
    const t = type ?? this.host.readFlightType?.() ?? 'manual';
    this.host.enterFlight?.(t);   // camera→FLIGHT, seed model from camera, _enterFlightMode(t)
  }

  // ── disengage: the F-off toggle — host runs the no-snap Toy-Box exit ──
  disengage() {
    this.host.exitFlight?.();     // flightExitAnchor + adoptCurrentPose + cameraInterp.resync
    this.pilot.stop();            // momentary; throttle latched (host clears its own align state)
  }
}
