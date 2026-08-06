import { describe, it, expect } from 'vitest';
import { STICK_TUNING, shapeMagnitude, shapeStick } from '../stickCurve.js';

const { DEADZONE, EXPO } = STICK_TUNING;

describe('shapeMagnitude — deadzone + rescale + cubic blend (Item 2)', () => {
  it('exports the approved tuning defaults', () => {
    expect(DEADZONE).toBe(0.06);
    expect(EXPO).toBe(0.30);
  });

  it('maps 0 → 0 and 1 → 1 exactly (endpoints preserved so turnRateCap shrink stays intact)', () => {
    expect(shapeMagnitude(0)).toBe(0);
    expect(shapeMagnitude(1)).toBeCloseTo(1, 12);
  });

  it('is zero at and below the deadzone, and continuous (→0) from above', () => {
    expect(shapeMagnitude(DEADZONE)).toBe(0);
    expect(shapeMagnitude(DEADZONE - 0.01)).toBe(0);
    expect(shapeMagnitude(0)).toBe(0);
    // continuous: just above dz the output is a tiny positive value, not a jump
    expect(shapeMagnitude(DEADZONE + 1e-4)).toBeGreaterThan(0);
    expect(shapeMagnitude(DEADZONE + 1e-4)).toBeLessThan(1e-3);
  });

  it('is monotonically increasing on [0, 1]', () => {
    let prev = -Infinity;
    for (let i = 0; i <= 200; i++) {
      const r = i / 200;
      const out = shapeMagnitude(r);
      expect(out).toBeGreaterThanOrEqual(prev - 1e-12);
      prev = out;
    }
  });

  it('has center slope ≈ (1−expo)/(1−dz) just above the deadzone (no mushy dead spot)', () => {
    const h = 1e-5;
    const x0 = DEADZONE + 1e-4;
    const slope = (shapeMagnitude(x0 + h) - shapeMagnitude(x0)) / h;
    const expected = (1 - EXPO) / (1 - DEADZONE);
    expect(slope).toBeCloseTo(expected, 3);
  });

  it('reduces to the linear-after-deadzone rescale when expo = 0', () => {
    const opts = { deadzone: DEADZONE, expo: 0 };
    for (const r of [0.06, 0.1, 0.25, 0.5, 0.75, 1]) {
      const expected = r <= DEADZONE ? 0 : (r - DEADZONE) / (1 - DEADZONE);
      expect(shapeMagnitude(r, opts)).toBeCloseTo(expected, 12);
    }
  });
});

describe('shapeStick — radial shaping preserves direction (Item 2)', () => {
  it('returns {0,0} below the precision floor', () => {
    expect(shapeStick(0, 0)).toEqual({ x: 0, y: 0 });
    expect(shapeStick(1e-9, 1e-9)).toEqual({ x: 0, y: 0 });
  });

  it('preserves the input direction on a diagonal (out.x/out.y == in.x/in.y)', () => {
    const inx = 0.5, iny = 0.5;
    const out = shapeStick(inx, iny);
    // direction ratio identical → diagonal not distorted (never per-axis)
    expect(out.x / out.y).toBeCloseTo(inx / iny, 12);
  });

  it('output magnitude equals shapeMagnitude(|in|)', () => {
    const inx = 0.5, iny = 0.5;
    const out = shapeStick(inx, iny);
    const inMag = Math.hypot(inx, iny);
    const outMag = Math.hypot(out.x, out.y);
    expect(outMag).toBeCloseTo(shapeMagnitude(inMag), 12);
  });

  it('preserves direction on an asymmetric diagonal too', () => {
    const inx = 0.3, iny = 0.7;
    const out = shapeStick(inx, iny);
    expect(out.x / out.y).toBeCloseTo(inx / iny, 12);
    expect(Math.hypot(out.x, out.y)).toBeCloseTo(shapeMagnitude(Math.hypot(inx, iny)), 12);
  });
});
