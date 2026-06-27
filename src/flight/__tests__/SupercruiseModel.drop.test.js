import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { SupercruiseModel, SC_TUNING } from '../SupercruiseModel.js';

const DT = 1 / 60;

function stepN(m, n, dt = DT) {
  for (let i = 0; i < n; i++) m.update(dt);
}

describe('SupercruiseModel — drive-idle / coast-on-drop (AC1)', () => {
  it('driveOn defaults to true (back-compat)', () => {
    const m = new SupercruiseModel();
    expect(m.driveOn).toBe(true);
  });

  it('setDrive toggles driveOn', () => {
    const m = new SupercruiseModel();
    m.setDrive(false);
    expect(m.driveOn).toBe(false);
    m.setDrive(true);
    expect(m.driveOn).toBe(true);
  });

  it('engage accelerates toward the capped target in open space', () => {
    const m = new SupercruiseModel(); // no bodies → cap = CAP_MAX
    m.setDrive(true);
    m.setThrottle(1);
    stepN(m, 60);
    expect(m.speed).toBeGreaterThan(0);
  });

  it('drop-out preserves momentum (does NOT snap to 0)', () => {
    const m = new SupercruiseModel(); // open space, no body to park us
    m.setDrive(true);
    m.setThrottle(1);
    stepN(m, 60);
    const v = m.speed;
    expect(v).toBeGreaterThan(0);
    m.setDrive(false);
    m.update(DT);
    expect(m.speed).toBeGreaterThan(v * 0.9); // coast, not zeroed
  });

  it('drop-out coasts position forward (open space)', () => {
    const m = new SupercruiseModel();
    m.orientation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.4);
    m.setDrive(true);
    m.setThrottle(1);
    stepN(m, 60);
    m.setDrive(false);
    const p0 = m.position.clone();
    stepN(m, 30);
    expect(m.position.distanceTo(p0)).toBeGreaterThan(0);
  });

  it('coasting does NOT pull toward the throttle target (throttle 0 keeps momentum)', () => {
    const m = new SupercruiseModel();
    m.setDrive(true);
    m.setThrottle(1);
    stepN(m, 60);
    const v = m.speed;
    // Drop out AND yank throttle to 0. With drive ON this would decay fast (ACCEL_TAU=0.6);
    // coasting must IGNORE the throttle target and decay only by the gentle COAST_TAU.
    m.setDrive(false);
    m.setThrottle(0);
    m.update(DT);
    // ACCEL_TAU decay over one frame would lose ~2.7% (k≈0.027); COAST_TAU=8 loses ~0.2%.
    // Assert the coast retained far more than the drive-on decay would have.
    const driveOnRetained = v * Math.exp(-DT / m.tuning.ACCEL_TAU);
    expect(m.speed).toBeGreaterThan(driveOnRetained);
  });

  it('coast decays gently by COAST_TAU over time', () => {
    const m = new SupercruiseModel();
    m.speed = 1000;
    m.setDrive(false);
    const before = m.speed;
    stepN(m, 60); // 1 second
    // exp(-1/8) ≈ 0.8825 — should be in the gentle-decay ballpark, not near 0
    expect(m.speed).toBeLessThan(before);
    expect(m.speed).toBeGreaterThan(before * 0.8);
  });

  it('near a body, speedCap parks you even while coasting', () => {
    const m = new SupercruiseModel();
    const body = { position: new THREE.Vector3(0, 0, 0), radius: 5 };
    m.setBodies([body]);
    m.position.set(body.radius + 0.1, 0, 0); // hugging the surface
    m.speed = 1000;                          // arrive fast
    m.setDrive(false);                       // coasting (dropped out)
    m.update(DT);
    const cap = m.speedCap();
    expect(m.speed).toBeLessThanOrEqual(cap + 1e-9); // clamped to the well cap = parked
  });

  it('anti-clip: re-engaging with nose toward a near body cannot exceed the cap (~parked)', () => {
    const m = new SupercruiseModel();
    const body = { position: new THREE.Vector3(0, 0, 0), radius: 5 };
    m.setBodies([body]);
    m.position.set(body.radius + 0.1, 0, 0);
    m.orientation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2); // nose toward -x ≈ body
    m.speed = 0;
    m.setDrive(true);
    m.setThrottle(1);
    stepN(m, 120);
    const cap = m.speedCap();
    expect(m.speed).toBeLessThanOrEqual(cap + 1e-9);
  });
});
