// src/flight/__tests__/SupercruisePilot.test.js
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { SupercruiseModel } from '../SupercruiseModel.js';
import { SupercruisePilot, PilotPhase, PILOT_TUNING } from '../SupercruisePilot.js';
import { steerToward } from '../aimAssist.js';

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
    // linger 4 s: HOLD entry now EASES from the capture point (~3τ ≈ 1.8 s),
    // so give the settle time to converge before measuring the hold distance.
    pilot.beginLeg({ toBody: body.mesh, bodyRadius: body.radius, linger: 4.0 });
    const frames = fly(pilot, model, 60 * 120);
    const last = frames[frames.length - 1];
    expect(last.motionComplete).toBe(true);
    expect(last.overshoot).toBeFalsy();
    // held at the felt-fill hold distance, body-locked (HOLD_VIEW_FRAC = 2.6)
    const holdDist = model.position.distanceTo(body.mesh.position);
    expect(holdDist).toBeCloseTo(body.radius * 2.6, 0);
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

  it('converges and completes an off-axis leg (pins steering signs)', () => {
    // A flipped yaw/pitch sign steers AWAY from the body — the leg never
    // converges and motionComplete never fires within the step budget.
    const model = new SupercruiseModel();
    const body = mkBody(3000, 1000, -4000, 5);
    model.setBodies([{ position: body.mesh.position, radius: body.radius }]);
    const pilot = new SupercruisePilot(model);
    pilot.beginLeg({ toBody: body.mesh, bodyRadius: body.radius, linger: 0.5 });
    const frames = fly(pilot, model, 60 * 180);
    const last = frames[frames.length - 1];
    expect(last.motionComplete).toBe(true);
    expect(last.overshoot).toBeFalsy();
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

  it('HOLD is body-locked: a moving body carries the ship at constant offset', () => {
    const model = new SupercruiseModel();
    const body = mkBody(0, 0, -5000, 5);
    model.setBodies([{ position: body.mesh.position, radius: body.radius }]);
    const pilot = new SupercruisePilot(model);
    pilot.beginLeg({ toBody: body.mesh, bodyRadius: body.radius, linger: 5 });
    // Fly the leg until HOLD is reached.
    for (let i = 0; i < 60 * 120 && pilot.phase !== PilotPhase.HOLD; i++) {
      pilot.update(DT);
      model.update(DT);
    }
    expect(pilot.phase).toBe(PilotPhase.HOLD);
    // HOLD entry now EASES toward the hold point (no snap), and the lerp
    // chases a moving hold point with a constant steady-state lag — so settle
    // WITH the body already moving until the lag converges, THEN snapshot.
    for (let i = 0; i < 900; i++) {
      body.mesh.position.x += 1;
      pilot.update(DT);
      model.update(DT);
    }
    const offset0 = model.position.clone().sub(body.mesh.position);
    const startPos = model.position.clone();
    // Keep dragging the body sideways; the ship must ride along, body-locked.
    for (let i = 0; i < 120; i++) {
      body.mesh.position.x += 1;
      const f = pilot.update(DT);
      model.update(DT);
      expect(f.phase).toBe(PilotPhase.HOLD);
      const offset = model.position.clone().sub(body.mesh.position);
      expect(offset.distanceTo(offset0)).toBeLessThan(1e-6);
    }
    expect(model.position.distanceTo(startPos)).toBeGreaterThan(100);
  });

  it('HOLD entry eases — no teleport snap across CRUISE→HOLD (live-found)', () => {
    // Old code copied the model to the hold offset in one frame — a visible
    // ~34u snap on the star leg. The settle ease must keep every HOLD-entry
    // step within the same order as normal cruise motion.
    const model = new SupercruiseModel();
    const body = mkBody(0, 0, -5000, 5);
    model.setBodies([{ position: body.mesh.position, radius: body.radius }]);
    const pilot = new SupercruisePilot(model);
    pilot.beginLeg({ toBody: body.mesh, bodyRadius: body.radius, linger: 5 });
    let maxCruiseStep = 0, maxHoldStep = 0, holdFrames = 0;
    const prev = model.position.clone();
    for (let i = 0; i < 60 * 120 && holdFrames < 120; i++) {
      const f = pilot.update(DT);
      model.update(DT);
      const step = model.position.distanceTo(prev);
      prev.copy(model.position);
      if (f.phase === PilotPhase.CRUISE) maxCruiseStep = Math.max(maxCruiseStep, step);
      // pilot.phase is the EXIT phase — includes the CRUISE→HOLD transition frame.
      if (pilot.phase === PilotPhase.HOLD) { maxHoldStep = Math.max(maxHoldStep, step); holdFrames++; }
    }
    expect(holdFrames).toBe(120);                 // reached HOLD + 2 s observed
    expect(maxCruiseStep).toBeGreaterThan(0);
    expect(maxHoldStep).toBeLessThanOrEqual(maxCruiseStep * 3); // no teleport
  });

  it('captures and completes at production-small radii (regression: live tour freeze)', () => {
    // Production radii are 1e-4..5, not ~5. With the old ABSOLUTE cap floor
    // (CAP_MIN=4), near-body speed converged to 3 u/s but capture needs
    // speed ≤ 4R — impossible for R < 0.75 → permanent overshoot limit cycle
    // (observed live: dist oscillating 26→1→26, tour frozen). The scale-free
    // 0.5R floor must make capture work at any radius.
    const model = new SupercruiseModel();
    const body = mkBody(0, 0, -30, 0.0163);
    model.setBodies([{ position: body.mesh.position, radius: body.radius }]);
    const pilot = new SupercruisePilot(model);
    pilot.beginLeg({ toBody: body.mesh, bodyRadius: body.radius, linger: 1 });
    const frames = fly(pilot, model, 60 * 120);
    const last = frames[frames.length - 1];
    expect(last.motionComplete).toBe(true);       // reached HOLD, lingered, completed
    expect(frames.some(f => f.overshoot)).toBe(false); // clean first-window capture, no limit cycle
    expect(frames.some(f => f.phase === PilotPhase.HOLD)).toBe(true);
    // parked inside the capture sphere, settling toward 2.6R
    expect(model.position.distanceTo(body.mesh.position))
      .toBeLessThanOrEqual(body.radius * 10);
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

  it('capture stays arithmetically possible across production radii (cap floor vs drop ceiling)', () => {
    // With CAP_MIN_ABS = 0.01 the ABSOLUTE floor governed near tiny bodies:
    // cruise speed at the drop sphere was 0.75 × 0.01 = 0.0075, but the drop
    // window needs speed ≤ 10R / DROP_ETA_MAX = 4R — impossible for
    // R < 0.001875 (observed live: Proteus R=0.0014058 limit-cycled forever).
    for (const R of [5, 0.48, 0.0163, 0.0014058, 4e-5]) {   // star..smallest moon
      const m = new SupercruiseModel();
      m.setBodies([{ position: new THREE.Vector3(0, 0, 0), radius: R }]);
      m.position.set(10 * R + R, 0, 0);                      // at the drop sphere
      const cruiseSpeedAtDrop = PILOT_TUNING.CRUISE_THROTTLE * m.speedCap();
      const dropMaxSpeed = (10 * R) / PILOT_TUNING.DROP_ETA_MAX;
      expect(cruiseSpeedAtDrop).toBeLessThanOrEqual(dropMaxSpeed);
    }
  });

  it('captures and completes at Proteus radius (regression: CAP_MIN_ABS limit cycle, live 2026-06-10)', () => {
    // Proteus (R=0.0014058) sits BELOW the old absolute floor's capturable
    // minimum (R=0.001875): 0.75 × 0.01 > 4R, so the pilot overshot, looped
    // back, overshot again — forever. Full-leg check that the 1e-5 floor
    // lets the leg capture cleanly and complete.
    const model = new SupercruiseModel();
    const body = mkBody(0, 0, -30, 0.0014058);
    model.setBodies([{ position: body.mesh.position, radius: body.radius }]);
    const pilot = new SupercruisePilot(model);
    pilot.beginLeg({ toBody: body.mesh, bodyRadius: body.radius, linger: 1 });
    const frames = fly(pilot, model, 60 * 150);
    const last = frames[frames.length - 1];
    expect(last.motionComplete).toBe(true);             // reached HOLD, lingered, completed
    expect(frames.some(f => f.overshoot)).toBe(false);  // no limit cycle — clean capture
    expect(frames.some(f => f.phase === PilotPhase.HOLD)).toBe(true);
    expect(model.position.distanceTo(body.mesh.position))
      .toBeLessThanOrEqual(body.radius * 10);
  });
});

describe('SupercruisePilot — steerToward parity (extraction is behavior-identical)', () => {
  it('ALIGN-phase turn input equals steerToward(orientation, position, body, STEER_GAIN)', () => {
    const model = new SupercruiseModel();
    model.position.set(0, 0, 0);
    // Off-axis body so yaw AND pitch are non-trivial and clamped under gain 3.0.
    const body = mkBody(0.4, 0.25, -2, 0.05);
    const pilot = new SupercruisePilot(model);
    pilot.beginLeg({ toBody: body.mesh, bodyRadius: body.radius });
    // Snapshot the PRE-rotation orientation/position the pilot actually fed into
    // steerToward this frame; pilot.update rotates model.orientation, so the
    // expected value must use the frame's input pose, not the post-rotation one.
    const orient0 = model.orientation.clone();
    const pos0 = model.position.clone();
    pilot.update(DT); // ALIGN frame sets model.turnInput via steerToward
    const expected = steerToward(orient0, pos0, body.mesh.position, PILOT_TUNING.STEER_GAIN);
    expect(model.turnInput.yaw).toBeCloseTo(expected.yaw, 12);
    expect(model.turnInput.pitch).toBeCloseTo(expected.pitch, 12);
  });
});
