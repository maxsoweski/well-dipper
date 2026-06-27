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

  it('throttle 0 (drive ON) decays speed DOWN to the MIN_CRUISE floor, not to 0', () => {
    // Reversed 2026-06-27: the drive ON now floors at MIN_CRUISE — you can't crawl
    // to a stop in supercruise. Throttle 0 in open space cruises at MIN_CRUISE.
    const m = new SupercruiseModel(); // no bodies → cap ≫ MIN_CRUISE
    m.speed = 100; m.setThrottle(0);
    for (let i = 0; i < 1800; i++) m.update(DT); // 30 s — past the ACCEL_TAU settle
    expect(m.speed).toBeCloseTo(SC_TUNING.MIN_CRUISE, 5); // settled onto the floor
    expect(m.speed).toBeGreaterThan(0);                   // never crawls to a stop
  });
});

describe('SupercruiseModel — throttle clamps + no reverse in supercruise', () => {
  it('setThrottle clamps into [-1, 1]', () => {
    const m = new SupercruiseModel();
    m.setThrottle(-0.5);
    expect(m.throttle).toBe(-0.5);
    m.setThrottle(-2);
    expect(m.throttle).toBe(-1);
    m.setThrottle(2);
    expect(m.throttle).toBe(1);
  });

  it('throttle -1 (drive ON) does NOT reverse — speed is floored at MIN_CRUISE forward', () => {
    // Reversed 2026-06-27: target is clamped ≥ floorEff (= min(MIN_CRUISE, cap)) > 0,
    // so reverse-while-in-supercruise is removed by design ("can't crawl/stop in SC").
    const m = new SupercruiseModel(); // open space → floorEff = MIN_CRUISE
    m.orientation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.7);
    m.setThrottle(-1);
    const before = m.position.clone();
    for (let i = 0; i < 600; i++) m.update(DT);
    expect(m.speed).toBeGreaterThan(0);          // never goes negative in SC
    expect(m.speed).toBeCloseTo(SC_TUNING.MIN_CRUISE, 6);
    const delta = m.position.clone().sub(before);
    expect(delta.lengthSq()).toBeGreaterThan(0);
    const nose = m.nose(new THREE.Vector3());
    expect(delta.clone().normalize().dot(nose)).toBeCloseTo(1, 6); // still moves FORWARD along nose
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
    // floor at the surface: scale-free radius-fraction floor governs (2.5 for R=5)
    expect(m.speedCap()).toBe(Math.max(SC_TUNING.CAP_MIN_ABS, body.radius * SC_TUNING.CAP_MIN_FRAC));
  });

  it('speed cap takes the min over multiple bodies — nearest body governs', () => {
    const m = new SupercruiseModel();
    const bodyA = { position: new THREE.Vector3(0, 0, 0), radius: 5 };
    const bodyB = { position: new THREE.Vector3(100000, 0, 0), radius: 10 };
    m.setBodies([bodyA, bodyB]);
    const floor = (b) => Math.max(SC_TUNING.CAP_MIN_ABS, b.radius * SC_TUNING.CAP_MIN_FRAC);
    m.position.set(100060, 0, 0);                // near B, far from A
    expect(m.speedCap()).toBeCloseTo(Math.max(floor(bodyB), (60 - bodyB.radius) / SC_TUNING.ETA_K), 9);
    m.position.set(60, 0, 0);                    // near A, far from B
    expect(m.speedCap()).toBeCloseTo(Math.max(floor(bodyA), (60 - bodyA.radius) / SC_TUNING.ETA_K), 9);
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
