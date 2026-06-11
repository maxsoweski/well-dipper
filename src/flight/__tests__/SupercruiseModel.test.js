import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { SupercruiseModel, SC_TUNING } from '../SupercruiseModel.js';

const DT = 1 / 60;

describe('SupercruiseModel — nose-vector flight + throttle', () => {
  it('advances only along the nose vector', () => {
    const m = new SupercruiseModel();
    m.orientation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.7);
    m.setThrottle(1);
    for (let i = 0; i < 120; i++) {
      const before = m.position.clone();
      m.update(DT);
      const delta = m.position.clone().sub(before);
      if (delta.lengthSq() === 0) continue;
      const nose = m.nose(new THREE.Vector3());
      expect(delta.normalize().dot(nose)).toBeCloseTo(1, 6);
    }
    expect(m.speed).toBeGreaterThan(0);
  });

  it('speed approaches throttle × cap asymptotically — bounded accel, no step change', () => {
    const m = new SupercruiseModel(); // no bodies → cap = CAP_MAX
    m.setThrottle(1);
    let prev = 0; let prevDelta = Infinity;
    for (let i = 0; i < 600; i++) {
      m.update(DT);
      const delta = m.speed - prev;
      expect(delta).toBeGreaterThanOrEqual(0);          // monotonic toward target
      expect(delta).toBeLessThanOrEqual(prevDelta + 1e-9); // decreasing increments (exponential ease)
      prev = m.speed; prevDelta = delta;
    }
    expect(m.speed).toBeLessThan(SC_TUNING.CAP_MAX);     // asymptote, never overshoots
    expect(m.speed).toBeGreaterThan(SC_TUNING.CAP_MAX * 0.9);
  });

  it('throttle 0 decays speed smoothly toward 0', () => {
    const m = new SupercruiseModel();
    m.speed = 100; m.setThrottle(0);
    for (let i = 0; i < 600; i++) m.update(DT);
    expect(m.speed).toBeLessThan(1);
  });
});

describe('SupercruiseModel — gravity-well cap + turn rate (AC1)', () => {
  it('speed cap is monotonically increasing with distance from the dominant body', () => {
    const m = new SupercruiseModel();
    const body = { position: new THREE.Vector3(0, 0, 0), radius: 5 };
    m.setBodies([body]);
    let prevCap = 0;
    for (const d of [10, 50, 200, 1000, 10000, 100000]) {
      m.position.set(d, 0, 0);
      const cap = m.speedCap();
      expect(cap).toBeGreaterThanOrEqual(prevCap);
      prevCap = cap;
    }
    expect(m.speedCap()).toBeLessThanOrEqual(SC_TUNING.CAP_MAX);
    m.position.set(body.radius + 0.1, 0, 0);
    expect(m.speedCap()).toBe(SC_TUNING.CAP_MIN); // floor at the surface
  });

  it('crawls near a planet, runs enormous in deep space (end-to-end)', () => {
    const m = new SupercruiseModel();
    m.setBodies([{ position: new THREE.Vector3(), radius: 5 }]);
    m.setThrottle(1);
    m.position.set(60, 0, 0);                    // near body
    for (let i = 0; i < 300; i++) m.update(DT);
    const nearSpeed = m.speed;
    m.position.set(120000, 0, 0); m.speed = 0;   // deep space
    for (let i = 0; i < 1200; i++) m.update(DT);
    expect(m.speed).toBeGreaterThan(nearSpeed * 100);
  });

  it('achieved turn rate never exceeds the cap, and the cap tightens with speed', () => {
    const m = new SupercruiseModel();
    m.setTurnInput(1, 0);
    m.speed = 0;
    const slowCap = m.turnRateCap();
    const q0 = m.orientation.clone();
    m.update(DT);
    expect(q0.angleTo(m.orientation)).toBeLessThanOrEqual(slowCap * DT + 1e-9);
    m.speed = m.speedCap();                      // full local speed
    expect(m.turnRateCap()).toBeLessThan(slowCap);
    expect(m.turnRateCap()).toBeCloseTo(SC_TUNING.TURN_RATE_MAX * SC_TUNING.TURN_RATE_MIN_FRAC, 6);
  });
});
