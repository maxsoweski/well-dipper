// src/flight/__tests__/SupercruisePilot.test.js
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { SupercruiseModel } from '../SupercruiseModel.js';
import { SupercruisePilot, PilotPhase } from '../SupercruisePilot.js';

const DT = 1 / 60;
const mkBody = (x, y, z, r) => ({
  mesh: { position: new THREE.Vector3(x, y, z) }, radius: r,
});

function fly(pilot, model, maxSteps) {
  const frames = [];
  for (let i = 0; i < maxSteps; i++) {
    const f = pilot.update(DT);
    model.update(DT);
    frames.push({ ...f, speed: model.speed });
    if (f.motionComplete || f.overshoot) break;
  }
  return frames;
}

describe('SupercruisePilot', () => {
  it('flies a leg: aligns, cruises, drops in-window, holds for linger, completes', () => {
    const model = new SupercruiseModel();
    const body = mkBody(0, 0, -5000, 5);
    model.setBodies([{ position: body.mesh.position, radius: body.radius }]);
    const pilot = new SupercruisePilot(model);
    pilot.beginLeg({ toBody: body.mesh, bodyRadius: body.radius, linger: 1.0 });
    const frames = fly(pilot, model, 60 * 120);
    const last = frames[frames.length - 1];
    expect(last.motionComplete).toBe(true);
    expect(last.overshoot).toBeFalsy();
    // held at the felt-fill hold distance, body-locked
    const holdDist = model.position.distanceTo(body.mesh.position);
    expect(holdDist).toBeLessThan(body.radius * 12);
    // phases were traversed in order
    const seq = [...new Set(frames.map(f => f.phase))];
    expect(seq).toEqual([PilotPhase.ALIGN, PilotPhase.CRUISE, PilotPhase.HOLD]);
  });

  it('pilot inputs respect the same caps a player has', () => {
    const model = new SupercruiseModel();
    const body = mkBody(3000, 1000, -4000, 5);
    model.setBodies([{ position: body.mesh.position, radius: body.radius }]);
    const pilot = new SupercruisePilot(model);
    pilot.beginLeg({ toBody: body.mesh, bodyRadius: body.radius, linger: 0.5 });
    for (let i = 0; i < 600; i++) {
      pilot.update(DT);
      expect(Math.abs(model.turnInput.yaw)).toBeLessThanOrEqual(1);
      expect(Math.abs(model.turnInput.pitch)).toBeLessThanOrEqual(1);
      expect(model.throttle).toBeGreaterThanOrEqual(0);
      expect(model.throttle).toBeLessThanOrEqual(1);
      model.update(DT);
    }
  });

  it('emits decelStarted once per leg (the AC6 shake trigger)', () => {
    const model = new SupercruiseModel();
    const body = mkBody(0, 0, -5000, 5);
    model.setBodies([{ position: body.mesh.position, radius: body.radius }]);
    const pilot = new SupercruisePilot(model);
    pilot.beginLeg({ toBody: body.mesh, bodyRadius: body.radius, linger: 0.5 });
    const frames = fly(pilot, model, 60 * 120);
    expect(frames.filter(f => f.decelStarted).length).toBe(1);
    expect(frames.filter(f => f.phaseChanged && f.phase === PilotPhase.CRUISE).length).toBe(1);
  });

  it('a too-hot crossing overshoots: no capture, flies past', () => {
    const model = new SupercruiseModel();
    const body = mkBody(0, 0, -200, 5);
    // No setBodies: simulate a manual run where the cap never reins speed in.
    const pilot = new SupercruisePilot(model);
    pilot.beginLeg({ toBody: body.mesh, bodyRadius: body.radius, linger: 1 });
    model.speed = 800; model.orientation.identity(); // barreling at it, nose -Z
    pilot.update(DT); // let the pilot see phase state
    const frames = fly(pilot, model, 60 * 10);
    expect(frames.some(f => f.overshoot)).toBe(true);
    expect(frames.some(f => f.motionComplete)).toBe(false);
    // it passed the body
    expect(model.position.z).toBeLessThan(body.mesh.position.z);
  });

  it('stop() goes IDLE and stops issuing inputs', () => {
    const model = new SupercruiseModel();
    const body = mkBody(0, 0, -5000, 5);
    const pilot = new SupercruisePilot(model);
    pilot.beginLeg({ toBody: body.mesh, bodyRadius: body.radius, linger: 1 });
    pilot.update(DT);
    pilot.stop();
    expect(pilot.phase).toBe(PilotPhase.IDLE);
    model.setTurnInput(0.5, 0.5);
    pilot.update(DT);
    expect(model.turnInput.yaw).toBe(0.5); // untouched — pilot is hands-off
  });

  it('linger: Infinity holds forever — motionComplete never fires', () => {
    const model = new SupercruiseModel();
    const body = mkBody(0, 0, -5000, 5);
    model.setBodies([{ position: body.mesh.position, radius: body.radius }]);
    const pilot = new SupercruisePilot(model);
    pilot.beginLeg({ toBody: body.mesh, bodyRadius: body.radius, linger: Infinity });
    // Fly the leg until HOLD is reached.
    for (let i = 0; i < 60 * 120 && pilot.phase !== PilotPhase.HOLD; i++) {
      pilot.update(DT);
      model.update(DT);
    }
    expect(pilot.phase).toBe(PilotPhase.HOLD);
    // ≥ 60 simulated seconds in HOLD — never completes, never leaves HOLD.
    for (let i = 0; i < 3600; i++) {
      const f = pilot.update(DT);
      model.update(DT);
      expect(f.motionComplete).toBe(false);
      expect(f.phase).toBe(PilotPhase.HOLD);
    }
  });
});
