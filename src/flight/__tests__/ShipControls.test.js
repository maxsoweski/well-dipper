import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { SupercruiseModel, SC_TUNING } from '../SupercruiseModel.js';
import { SupercruisePilot } from '../SupercruisePilot.js';
import { HeadMount } from '../HeadMount.js';
import { ShipControls } from '../ShipControls.js';
import { STICK_TUNING } from '../stickCurve.js';

const DT = 1 / 60;
const mkBody = (x, y, z, r) => ({ mesh: { position: new THREE.Vector3(x, y, z) }, radius: r });

function mk(host = {}) {
  const model = new SupercruiseModel();
  const pilot = new SupercruisePilot(model);
  const head = new HeadMount();
  const controls = new ShipControls({ model, pilot, head, host });
  return { model, pilot, head, controls };
}

describe('ShipControls — construction + ownership', () => {
  it('owns model, pilot, head', () => {
    const { model, pilot, head, controls } = mk();
    expect(controls.model).toBe(model);
    expect(controls.pilot).toBe(pilot);
    expect(controls.head).toBe(head);
  });

  it('references the passed stickTuning object (single source, no copy)', () => {
    // In-game main.js passes the live module-scoped _scStickTuning so the UAT
    // knob and the input-gate share ONE object. A spread/copy here (ShipControls
    // .js:39) would silently break that guarantee — pin reference identity.
    const model = new SupercruiseModel();
    const pilot = new SupercruisePilot(model);
    const head = new HeadMount();
    const t = { DEADZONE: 0.1, EXPO: 0.2 };
    const controls = new ShipControls({ model, pilot, head, stickTuning: t });
    expect(controls.tuning).toBe(t);               // same object, not a copy
  });

  it('with no stickTuning, owns a default COPY (not the shared STICK_TUNING)', () => {
    const { controls } = mk();
    expect(controls.tuning).not.toBe(STICK_TUNING); // owns its own copy…
    expect(controls.tuning).toEqual(STICK_TUNING);  // …with the default values
  });
});

describe('setThrottle — reverse is real', () => {
  it('setThrottle(-0.5) ⇒ model.throttle === -0.5 (clamp at SupercruiseModel.js:42)', () => {
    const { model, controls } = mk();
    controls.setThrottle(-0.5);
    expect(model.throttle).toBe(-0.5);
  });
  it('setThrottle(1) and setThrottle(-1) clamp at the rails', () => {
    const { model, controls } = mk();
    controls.setThrottle(5); expect(model.throttle).toBe(1);
    controls.setThrottle(-5); expect(model.throttle).toBe(-1);
  });
});

describe('steer — casing fix + negated turn-input + deflection sync', () => {
  it('runs the shaped curve and applies the NEGATED turn-input convention', () => {
    const { model, controls } = mk();
    // Large stick well outside the 0.06 deadzone; expect non-zero shaped output,
    // stored as setTurnInput(-x,-y) (the live joystick convention, main.js:9277).
    controls.steer(0.8, 0.0);
    expect(model.turnInput.yaw).toBeLessThan(0);   // -shaped.x, shaped.x>0
    // -shaped.y with shaped.y === 0 is -0 (the live setTurnInput(-s.x,-s.y)
    // convention, main.js:9277 — model clamp preserves -0). -0 === 0 for all
    // flight math; assert numeric-zero, not Object.is(+0).
    expect(model.turnInput.pitch === 0).toBe(true);
  });

  it('fixes the casing bug: a non-default DEADZONE actually changes shaped output', () => {
    // A tiny stick deflection (0.05) is INSIDE the default 0.06 deadzone ⇒ 0.
    const { model, controls } = mk();
    controls.steer(0.05, 0);
    expect(model.turnInput.yaw === 0).toBe(true); // -0 (deadzone kills shaped.x) === 0
    // Lowering DEADZONE to 0.0 should now let 0.05 through (proves tuning takes
    // effect — today it is silently ignored because shapeMagnitude reads
    // lowercase {deadzone,expo} but the tuning is uppercase {DEADZONE,EXPO}).
    controls.tuning.DEADZONE = 0.0;
    controls.steer(0.05, 0);
    expect(model.turnInput.yaw).toBeLessThan(0);   // 0.05 now passes the deadzone
  });

  it('calls host.setDeflection with the UN-negated shaped {x,y}', () => {
    const setDeflection = vi.fn();
    const { controls } = mk({ setDeflection });
    controls.steer(0.8, 0.0);
    expect(setDeflection).toHaveBeenCalledTimes(1);
    const arg = setDeflection.mock.calls[0][0];
    expect(arg.x).toBeGreaterThan(0);   // un-negated
    expect(arg.y).toBe(0);
  });

  it('no host ⇒ steer is a clean no-op on the (absent) deflection sink', () => {
    const { controls } = mk();   // no host.setDeflection
    expect(() => controls.steer(0.8, 0)).not.toThrow();
  });
});

describe('stop — idle vs takeover', () => {
  it('idle (default) zeroes throttle AND idles the pilot', () => {
    const { model, pilot, controls } = mk();
    pilot.beginLeg({ toBody: mkBody(0, 0, -2, 0.05).mesh, bodyRadius: 0.05 });
    controls.setThrottle(0.7);
    controls.stop();          // default 'idle'
    expect(model.throttle).toBe(0);
    expect(pilot.phase).toBe('IDLE');
    expect(pilot._target).toBe(null);
  });
  it('takeover leaves throttle latched (Elite semantics, pilot.js:53-57)', () => {
    const { model, pilot, controls } = mk();
    pilot.beginLeg({ toBody: mkBody(0, 0, -2, 0.05).mesh, bodyRadius: 0.05 });
    controls.setThrottle(0.7);
    controls.stop('takeover');
    expect(model.throttle).toBe(0.7);   // latched
    expect(pilot.phase).toBe('IDLE');
    expect(pilot._target).toBe(null);
  });
});

describe('step — encapsulated pilot.update → model.update order', () => {
  it('active pilot ⇒ pilot.update runs BEFORE model.update; returns the frame', () => {
    const { model, pilot, controls } = mk();
    pilot.beginLeg({ toBody: mkBody(0, 0, -2, 0.05).mesh, bodyRadius: 0.05 });
    const order = [];
    const pu = pilot.update.bind(pilot);
    const mu = model.update.bind(model);
    vi.spyOn(pilot, 'update').mockImplementation((dt) => { order.push('pilot'); return pu(dt); });
    vi.spyOn(model, 'update').mockImplementation((dt) => { order.push('model'); return mu(dt); });
    const frame = controls.step(DT);
    expect(order).toEqual(['pilot', 'model']);
    expect(frame).not.toBeNull();
    expect(frame.phase).toBe('ALIGN');
  });
  it('inactive pilot ⇒ only model.update runs; returns null', () => {
    const { model, pilot, controls } = mk();
    expect(pilot.isActive).toBe(false);
    const muSpy = vi.spyOn(model, 'update');
    const frame = controls.step(DT);
    expect(muSpy).toHaveBeenCalledTimes(1);
    expect(frame).toBe(null);
  });
});

describe('getState — live telemetry read', () => {
  it('returns the ordered { speed, commandedSpeed, throttle, mode, phase, dropState }', () => {
    const { controls } = mk();
    controls.setThrottle(0.5);
    const s = controls.getState();
    expect(Object.keys(s)).toEqual(['speed', 'commandedSpeed', 'throttle', 'mode', 'phase', 'dropState']);
    expect(s.throttle).toBe(0.5);
    expect(s.phase).toBe('IDLE');             // pilot.phase
    expect(s.mode).toBe(null);                // no host ⇒ not in flight
    expect(s.dropState).toEqual({ state: 'none', d: null, captureSphere: null, dropMaxSpeed: null });
    expect(typeof s.speed).toBe('number');
    // Independently-known: no bodies ⇒ speedCap() === CAP_MAX, so commandedSpeed
    // is throttle(0.5) × CAP_MAX (not a re-derivation of getState's own expr).
    expect(s.commandedSpeed).toBeCloseTo(0.5 * SC_TUNING.CAP_MAX, 9);
  });

  it('with a host: mode = host.readFlightType() and dropState = host.dropState() (delegation, not fallback)', () => {
    const hostDrop = { state: 'approach', d: 5, captureSphere: 9, dropMaxSpeed: 4 };
    const { controls } = mk({
      readFlightType: () => 'assist',
      dropState: () => hostDrop,
    });
    const s = controls.getState();
    expect(s.mode).toBe('assist');        // delegated flight TYPE, not the null fallback
    expect(s.dropState).toBe(hostDrop);   // the host-returned object, not the inert default
  });

  it('commandedSpeed reflects a body-shrunk cap (throttle × speedCap, not CAP_MAX)', () => {
    const { model, controls } = mk();
    // Park a body close enough that the gravity-well cap shrinks below CAP_MAX,
    // so commandedSpeed must track the shrunk cap — exercises the non-trivial branch.
    const bodyPos = new THREE.Vector3(0, 0, -100);
    model.setBodies([{ position: bodyPos, radius: 1 }]);
    controls.setThrottle(0.5);
    const cap = model.speedCap();
    expect(cap).toBeLessThan(SC_TUNING.CAP_MAX);     // cap actually shrank
    const s = controls.getState();
    expect(s.commandedSpeed).toBeCloseTo(0.5 * cap, 9);
  });
});

describe('get target — named accessor over pilot._target', () => {
  it('null when idle; the leg target after beginLeg', () => {
    const { pilot, controls } = mk();
    expect(controls.target).toBe(null);
    const body = mkBody(0, 0, -2, 0.05);
    pilot.beginLeg({ toBody: body.mesh, bodyRadius: body.radius, linger: 8 });
    expect(controls.target).toBe(pilot._target);
    expect(controls.target.mesh).toBe(body.mesh);
    expect(controls.target.radius).toBe(0.05);
    expect(controls.target.linger).toBe(8);
  });
});

describe('flyTo — arrival signal (lab/headless self-stepping)', () => {
  it('flies a real leg and resolves with the motionComplete PilotFrame', async () => {
    const { model, controls } = mk();
    // Body ahead at a capturable scale (matches SupercruisePilot.test fixtures).
    const body = mkBody(0, 0, -2, 0.05);
    // REQUIRED: register the body so model.speedCap() shrinks near it
    // (SupercruiseModel.js:57-64). With NO bodies, speedCap stays CAP_MAX (20000)
    // and the ship never decelerates → capture never fires → motionComplete never
    // sets → the leg runs to the maxSteps cap and REJECTS. Mirrors labVerbs.test.js.
    model.setBodies([{ position: body.mesh.position, radius: body.radius }]);
    // Self-step (lab/headless) resolves SYNCHRONOUSLY inside flyTo (the fixed-step
    // loop runs to motionComplete before returning — see Arrival.js NOTE), so
    // arrival.done is already true on return. (The `done===false`-on-return state
    // belongs to the in-game selfStep:false path, not this headless leg.)
    const arrival = controls.flyTo({ toBody: body.mesh, bodyRadius: 0.05, linger: 1 });
    expect(arrival.done).toBe(true);
    const frame = await arrival.promise;
    expect(arrival.done).toBe(true);
    expect(frame.motionComplete).toBe(true);
    expect(frame.phase).toBe('HOLD');
  });

  it('then(cb) is sugar over the promise (callback style)', async () => {
    const { model, controls } = mk();
    const body = mkBody(0, 0, -2, 0.05);
    model.setBodies([{ position: body.mesh.position, radius: body.radius }]); // see note above: required for capture
    let arrivedFrame = null;
    const arrival = controls.flyTo({ toBody: body.mesh, bodyRadius: 0.05, linger: 1 });
    arrival.then((f) => { arrivedFrame = f; });
    await arrival.promise;
    expect(arrivedFrame).not.toBeNull();
    expect(arrivedFrame.motionComplete).toBe(true);
  });

  it('a leg that never completes within the step cap rejects/resolves timed-out (no infinite loop)', async () => {
    const { controls } = mk();
    // Body absurdly far so the fixed-cap loop hits its ceiling before HOLD-complete.
    const body = mkBody(0, 0, -1e9, 1);
    const arrival = controls.flyTo({ toBody: body.mesh, bodyRadius: 1, linger: 1, maxSteps: 600 });
    // The cap-hit path calls arrival.cancel() (Step 23), which rejects with
    // `new Error('arrival cancelled')` (Step 19). Match that actual message — do
    // NOT assert /timed out|step cap/, which the cancel() error does not contain.
    await expect(arrival.promise).rejects.toThrow(/cancel/i);
  });
});

describe('selectTarget / deselect — host selection delegation', () => {
  it('selectTarget(t) calls host.selectTarget with the target descriptor', () => {
    const selectTarget = vi.fn();
    const { controls } = mk({ selectTarget });
    const t = { kind: 'planet', mesh: {}, radius: 0.05 };
    controls.selectTarget(t);
    expect(selectTarget).toHaveBeenCalledTimes(1);
    expect(selectTarget).toHaveBeenCalledWith(t);
  });

  it('deselect() calls host.deselectTarget()', () => {
    const deselectTarget = vi.fn();
    const { controls } = mk({ deselectTarget });
    controls.deselect();
    expect(deselectTarget).toHaveBeenCalledTimes(1);
  });

  it('no host ⇒ selectTarget/deselect are clean no-ops (lab path)', () => {
    const { controls } = mk();
    expect(() => controls.selectTarget({ kind: 'planet', mesh: {}, radius: 1 })).not.toThrow();
    expect(() => controls.deselect()).not.toThrow();
  });
});

describe('engage / disengage — host delegation (no-snap exit preserved in host)', () => {
  it('engage(type) calls host.enterFlight with the explicit type', () => {
    const enterFlight = vi.fn();
    const { controls } = mk({ enterFlight });
    controls.engage('assist');
    expect(enterFlight).toHaveBeenCalledWith('assist');
  });

  it('engage() with no type reads host.readFlightType()', () => {
    const enterFlight = vi.fn();
    const readFlightType = vi.fn(() => 'align');
    const { controls } = mk({ enterFlight, readFlightType });
    controls.engage();
    expect(readFlightType).toHaveBeenCalledTimes(1);
    expect(enterFlight).toHaveBeenCalledWith('align');
  });

  it('disengage() calls host.exitFlight() (no-snap), stops the pilot, clears target, leaves throttle latched', () => {
    const exitFlight = vi.fn();
    const { model, pilot, controls } = mk({ exitFlight });
    pilot.beginLeg({ toBody: mkBody(0, 0, -2, 0.05).mesh, bodyRadius: 0.05 });
    controls.setThrottle(0.7);
    controls.disengage();
    expect(exitFlight).toHaveBeenCalledTimes(1);
    expect(pilot.phase).toBe('IDLE');   // pilot.stop() ran
    expect(controls.target).toBe(null); // _target cleared by pilot.stop()
    expect(model.throttle).toBe(0.7);   // throttle latched (Elite semantics, ShipControls.js:136)
  });

  it('no host ⇒ engage/disengage are clean no-ops (lab path)', () => {
    const { controls } = mk();
    expect(() => controls.engage('manual')).not.toThrow();
    expect(() => controls.disengage()).not.toThrow();
  });
});
