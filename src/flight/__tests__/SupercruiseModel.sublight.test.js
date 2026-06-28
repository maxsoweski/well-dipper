import { describe, it, expect } from 'vitest';
import { SupercruiseModel, SC_TUNING } from '../SupercruiseModel.js';

const DT = 1 / 60;
const stepN = (m, n) => { for (let i = 0; i < n; i++) m.update(DT); };

describe('SupercruiseModel — sublight (drive OFF) propulsion', () => {
  it('OFF + full throttle accelerates toward +SUBLIGHT_CAP (no bodies)', () => {
    const m = new SupercruiseModel();
    m.setDrive(false);
    m.setThrottle(1);
    stepN(m, 300); // ~5s, well past SUBLIGHT_TAU
    expect(m.speed).toBeGreaterThan(0);
    expect(m.speed).toBeCloseTo(SC_TUNING.SUBLIGHT_CAP, 6);
  });

  it('OFF + zero throttle settles to a full STOP', () => {
    const m = new SupercruiseModel();
    m.setDrive(false);
    m.speed = SC_TUNING.SUBLIGHT_CAP; // moving
    m.setThrottle(0);
    stepN(m, 400);
    expect(m.speed).toBeCloseTo(0, 9);
  });

  it('OFF + negative throttle reverses toward -SUBLIGHT_CAP', () => {
    const m = new SupercruiseModel();
    m.setDrive(false);
    m.setThrottle(-1);
    stepN(m, 300);
    expect(m.speed).toBeLessThan(0);
    expect(m.speed).toBeCloseTo(-SC_TUNING.SUBLIGHT_CAP, 6);
  });

  it('OFF dropout from cruise with throttle 0 still sheds ≈all momentum (~1.5s)', () => {
    const m = new SupercruiseModel();
    m.setDrive(true); m.setThrottle(1); stepN(m, 120);
    const cruise = m.speed;
    m.setDrive(false); m.setThrottle(0);
    stepN(m, 90);
    expect(m.speed / cruise).toBeLessThan(0.03);
  });
});
