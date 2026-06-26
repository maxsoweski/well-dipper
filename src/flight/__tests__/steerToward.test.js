import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { steerToward } from '../aimAssist.js';

const GAIN = 3.0; // PILOT_TUNING.STEER_GAIN
const ID = () => new THREE.Quaternion();      // nose at local −Z
const V = (x, y, z) => new THREE.Vector3(x, y, z);

describe('steerToward — extracted from SupercruisePilot.update (:93-101)', () => {
  it('target dead ahead (−Z) ⇒ no turn command', () => {
    const out = steerToward(ID(), V(0, 0, 0), V(0, 0, -10), GAIN);
    expect(out.yaw).toBeCloseTo(0, 6);
    expect(out.pitch).toBeCloseTo(0, 6);
  });

  it('target to the right (+X) ⇒ yaw < 0 (the -localX·gain sign)', () => {
    const out = steerToward(ID(), V(0, 0, 0), V(10, 0, 0), GAIN);
    expect(out.yaw).toBeLessThan(0);
    expect(out.yaw).toBe(-1);          // clamp(-1 · 3.0) → -1
  });

  it('target above (+Y) ⇒ pitch > 0 (the +localY·gain sign)', () => {
    const out = steerToward(ID(), V(0, 0, 0), V(0, 10, 0), GAIN);
    expect(out.pitch).toBeGreaterThan(0);
    expect(out.pitch).toBe(1);
  });

  it('target dead astern (+Z, antiparallel) ⇒ yaw = 1 (escape, :100)', () => {
    const out = steerToward(ID(), V(0, 0, 0), V(0, 0, 10), GAIN);
    expect(out.yaw).toBe(1);           // would be 0 without the antiparallel escape
  });

  it('off-axis ⇒ clamped magnitude (never beyond ±1)', () => {
    const out = steerToward(ID(), V(0, 0, 0), V(5, 5, -1), GAIN);
    expect(out.yaw).toBeGreaterThanOrEqual(-1);
    expect(out.yaw).toBeLessThanOrEqual(1);
    expect(out.pitch).toBeGreaterThanOrEqual(-1);
    expect(out.pitch).toBeLessThanOrEqual(1);
  });

  it('does not mutate caller orientation / from / toBody', () => {
    const o = ID(); const from = V(0, 0, 0); const to = V(10, 0, 0);
    steerToward(o, from, to, GAIN);
    expect(o.equals(new THREE.Quaternion())).toBe(true);
    expect(from.equals(V(0, 0, 0))).toBe(true);
    expect(to.equals(V(10, 0, 0))).toBe(true);
  });

  it('writes into a provided out object and returns it', () => {
    const out = { yaw: 0, pitch: 0 };
    const r = steerToward(ID(), V(0, 0, 0), V(10, 0, 0), GAIN, out);
    expect(r).toBe(out);
    expect(out.yaw).toBe(-1);
  });
});
