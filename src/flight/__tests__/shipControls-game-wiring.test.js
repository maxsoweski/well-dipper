import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { SupercruiseModel } from '../SupercruiseModel.js';
import { SupercruisePilot } from '../SupercruisePilot.js';
import { HeadMount } from '../HeadMount.js';
import { ShipControls } from '../ShipControls.js';

function makeControls() {
  const model = new SupercruiseModel();
  const pilot = new SupercruisePilot(model);
  const head = new HeadMount();
  return { model, pilot, controls: new ShipControls({ model, pilot, head }) };
}

describe('ShipControls game-wiring contract (Task 3 consolidation invariants)', () => {
  it('flyTo sets the pilot leg via beginLeg (in-game intent-setter, no self-step)', () => {
    const { model, pilot, controls } = makeControls();
    const body = new THREE.Object3D();
    body.position.set(0, 0, -50);
    const p0 = model.position.clone();
    controls.flyTo({ toBody: body, bodyRadius: 5, linger: 8, selfStep: false });
    // beginLeg armed the pilot onto the body, did NOT advance the model itself.
    expect(pilot.isActive).toBe(true);
    // Read the named accessor on the SURFACE (ShipControls.get target → pilot._target).
    // NOTE: SupercruisePilot has NO public `target` getter — only the private `_target`
    // field — so `pilot.target` would be undefined. The contract's accessor lives on
    // ShipControls (contract §1), so assert through `controls.target`.
    expect(controls.target?.mesh).toBe(body);
    expect(model.position.equals(p0)).toBe(true); // in-game flyTo does not step the model
  });

  it('flyTo passes linger straight through to the leg', () => {
    const { controls } = makeControls();
    const body = new THREE.Object3D();
    controls.flyTo({ toBody: body, bodyRadius: 3, linger: Infinity, selfStep: false });
    expect(controls.target?.linger).toBe(Infinity); // surface accessor, not pilot.target (no such getter)
  });

  it('step runs pilot.update BEFORE model.update and returns the frame when active', () => {
    const { model, pilot, controls } = makeControls();
    const body = new THREE.Object3D();
    body.position.set(0, 0, -50);
    controls.flyTo({ toBody: body, bodyRadius: 5, linger: 8, selfStep: false });
    const order = [];
    const realPilotUpdate = pilot.update.bind(pilot);
    const realModelUpdate = model.update.bind(model);
    pilot.update = (dt) => { order.push('pilot'); return realPilotUpdate(dt); };
    model.update = (dt) => { order.push('model'); return realModelUpdate(dt); };
    const frame = controls.step(1 / 60);
    expect(order).toEqual(['pilot', 'model']);   // pilot ALWAYS before model
    expect(frame).not.toBeNull();                 // active leg → returns the PilotFrame
  });

  it('step runs model.update only and returns null when the pilot is idle', () => {
    const { model, pilot, controls } = makeControls();
    expect(pilot.isActive).toBe(false);
    const order = [];
    const realModelUpdate = model.update.bind(model);
    model.update = (dt) => { order.push('model'); return realModelUpdate(dt); };
    const frame = controls.step(1 / 60);
    expect(order).toEqual(['model']);
    expect(frame).toBeNull();
  });
});

describe('ShipControls engage/disengage/selection delegation (Task 3 Option-A)', () => {
  function hostControls(host) {
    const model = new SupercruiseModel();
    const pilot = new SupercruisePilot(model);
    const head = new HeadMount();
    return { model, pilot, controls: new ShipControls({ model, pilot, head, host }) };
  }

  it('engage(type) calls host.enterFlight with the explicit type (the F-on path)', () => {
    const enterFlight = vi.fn();
    const { controls } = hostControls({ enterFlight });
    controls.engage('assist');
    expect(enterFlight).toHaveBeenCalledWith('assist');
  });

  it('engage() with no type reads host.readFlightType() (Settings-selected type)', () => {
    const enterFlight = vi.fn();
    const readFlightType = vi.fn(() => 'align');
    const { controls } = hostControls({ enterFlight, readFlightType });
    controls.engage();
    expect(readFlightType).toHaveBeenCalledTimes(1);
    expect(enterFlight).toHaveBeenCalledWith('align');
  });

  it('disengage() calls host.exitFlight() — the no-snap exit delegate (F-off path)', () => {
    const exitFlight = vi.fn();
    const { pilot, controls } = hostControls({ exitFlight });
    const body = new THREE.Object3D(); body.position.set(0, 0, -50);
    controls.flyTo({ toBody: body, bodyRadius: 5, linger: 8, selfStep: false });
    controls.disengage();
    expect(exitFlight).toHaveBeenCalledTimes(1);
    expect(pilot.phase).toBe('IDLE');   // pilot.stop() ran (idempotent w/ exitFlight's own stop)
  });

  it('selectTarget / deselect delegate to the LOW-LEVEL host impls (no surface re-entry)', () => {
    const selectTarget = vi.fn();
    const deselectTarget = vi.fn();
    const { controls } = hostControls({ selectTarget, deselectTarget });
    const t = { kind: 'planet', mesh: new THREE.Object3D(), radius: 5 };
    controls.selectTarget(t);
    controls.deselect();
    expect(selectTarget).toHaveBeenCalledWith(t);
    expect(deselectTarget).toHaveBeenCalledTimes(1);
  });

  it('getState().mode reads host.flightMode() (null while idle, the §4 semantic)', () => {
    let engaged = false;
    const flightMode = vi.fn(() => (engaged ? 'manual' : null));
    const { controls } = hostControls({ flightMode });
    expect(controls.getState().mode).toBe(null);   // idle → null
    engaged = true;
    expect(controls.getState().mode).toBe('manual');
  });

  it('get target exposes pilot._target (the accessor the 6081/6083/8378 reads migrate to)', () => {
    const { controls } = hostControls({});
    const body = new THREE.Object3D(); body.position.set(0, 0, -50);
    controls.flyTo({ toBody: body, bodyRadius: 5, linger: 8, selfStep: false });
    expect(controls.target?.mesh).toBe(body);
    expect(controls.target?.radius).toBe(5);
  });
});
