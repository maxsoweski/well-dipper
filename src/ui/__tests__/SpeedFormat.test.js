import { describe, it, expect } from 'vitest';
import {
  formatSpeed,
  speedToBarFrac,
  KM_PER_SCENE,
  C_IN_SCENE_PER_S,
  MM_S_IN_SCENE_PER_S,
  SPEED_BAR_MIN_C,
  SPEED_BAR_MAX_C,
} from '../SpeedFormat.js';

describe('SpeedFormat — derived constants', () => {
  it('matches the spec anchor values', () => {
    expect(KM_PER_SCENE).toBeCloseTo(149597.8707, 3);
    expect(C_IN_SCENE_PER_S).toBeCloseTo(2.00399, 4);
    expect(MM_S_IN_SCENE_PER_S).toBeCloseTo(0.0066847, 6);
  });
});

describe('SpeedFormat — formatSpeed tiers + values', () => {
  it('0.02 scene-u/s → Mm/s ≈ 2.99', () => {
    const r = formatSpeed(0.02);
    expect(r.unit).toBe('Mm/s');
    expect(r.raw).toBeCloseTo(2.99, 2);
    expect(Number(r.value.replace(/,/g, ''))).toBeCloseTo(2.99, 2);
  });

  it('0.001 scene-u/s → km/s ≈ 150 (NEVER "0")', () => {
    const r = formatSpeed(0.001);
    expect(r.unit).toBe('km/s');
    expect(r.raw).toBeCloseTo(149.6, 1);
    expect(Number(r.value.replace(/,/g, ''))).toBeCloseTo(150, 0);
    expect(r.value).not.toBe('0');
  });

  it('1 scene-u/s → c ≈ 0.50', () => {
    const r = formatSpeed(1);
    expect(r.unit).toBe('c');
    expect(r.raw).toBeCloseTo(0.499, 3);
    expect(Number(r.value.replace(/,/g, ''))).toBeCloseTo(0.50, 2);
  });

  it('20000 scene-u/s → c ≈ 9980 (integer, thousands-separated)', () => {
    const r = formatSpeed(20000);
    expect(r.unit).toBe('c');
    expect(r.raw).toBeCloseTo(9980, 0);
    expect(r.value).toBe('9,980');
    expect(Number(r.value.replace(/,/g, ''))).toBeCloseTo(9980, 0);
  });

  it('never renders "0" across small moving speeds', () => {
    for (const s of [0.0001, 0.0005, 0.001, 0.005, 0.01, 0.05, 0.5]) {
      const r = formatSpeed(s);
      expect(r.value).not.toBe('0');
      expect(Number(r.value.replace(/,/g, ''))).toBeGreaterThan(0);
    }
  });

  it('km/s tier: ≥100 km/s renders as integer (no decimal)', () => {
    // Just under 1 Mm/s → still km/s, ~999 km/s → integer, no comma yet (<1000).
    const r = formatSpeed(MM_S_IN_SCENE_PER_S * 0.999);
    expect(r.unit).toBe('km/s');
    expect(r.value).not.toContain('.');
    expect(Number(r.value)).toBe(Math.round(r.raw));
  });
});

describe('SpeedFormat — tier boundaries pick the right unit', () => {
  it('crossing the km/s ↔ Mm/s boundary (1 Mm/s)', () => {
    const justBelow = formatSpeed(MM_S_IN_SCENE_PER_S * 0.999);
    const atOrAbove = formatSpeed(MM_S_IN_SCENE_PER_S * 1.001);
    expect(justBelow.unit).toBe('km/s');
    expect(atOrAbove.unit).toBe('Mm/s');
    // exactly 1 Mm/s reads as 1.00 Mm/s
    const exact = formatSpeed(MM_S_IN_SCENE_PER_S);
    expect(exact.unit).toBe('Mm/s');
    expect(exact.raw).toBeCloseTo(1.0, 6);
  });

  it('crossing the Mm/s ↔ c boundary (0.1 c)', () => {
    const cThreshold = 0.1 * C_IN_SCENE_PER_S;
    const justBelow = formatSpeed(cThreshold * 0.999);
    const atOrAbove = formatSpeed(cThreshold * 1.001);
    expect(justBelow.unit).toBe('Mm/s');
    expect(atOrAbove.unit).toBe('c');
  });
});

describe('SpeedFormat — speedToBarFrac', () => {
  const atMin = SPEED_BAR_MIN_C * C_IN_SCENE_PER_S;   // scene-u/s at min-c
  const atMax = SPEED_BAR_MAX_C * C_IN_SCENE_PER_S;   // scene-u/s at max-c

  it('≈0 at/below min, ≈1 at/above max, always clamped to [0,1]', () => {
    expect(speedToBarFrac(atMin)).toBeCloseTo(0, 6);
    expect(speedToBarFrac(atMin * 0.001)).toBe(0);     // far below → clamped
    expect(speedToBarFrac(0)).toBe(0);
    expect(speedToBarFrac(atMax)).toBeCloseTo(1, 6);
    expect(speedToBarFrac(atMax * 1000)).toBe(1);      // far above → clamped
  });

  it('stays within [0,1] across the whole range', () => {
    for (let cExp = -6; cExp <= 6; cExp += 0.5) {
      const sceneU = Math.pow(10, cExp) * C_IN_SCENE_PER_S;
      const f = speedToBarFrac(sceneU);
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThanOrEqual(1);
    }
  });

  it('is monotonic non-decreasing in speed', () => {
    let prev = -Infinity;
    for (let cExp = -5; cExp <= 5; cExp += 0.25) {
      const sceneU = Math.pow(10, cExp) * C_IN_SCENE_PER_S;
      const f = speedToBarFrac(sceneU);
      expect(f).toBeGreaterThanOrEqual(prev - 1e-12);
      prev = f;
    }
  });

  it('lands ~midway in log-space at the geometric mean of the window', () => {
    const midC = Math.sqrt(SPEED_BAR_MIN_C * SPEED_BAR_MAX_C);
    expect(speedToBarFrac(midC * C_IN_SCENE_PER_S)).toBeCloseTo(0.5, 6);
  });
});
