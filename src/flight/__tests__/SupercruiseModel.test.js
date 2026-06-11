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
