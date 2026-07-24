// Radius slider LOG-map — pure-helper oracle.
// Workstream: world-engine-radius-display-scale-2026-07-24 (Slice A — slider ergonomics).
//
// Pins the log-position proxy math in planet-lod-lab-core.js that the lab's radius slider
// is driven through: a [0,1] track `t` exp-maps onto planetRadiusEarth so the slider
// response is perceptually uniform (a constant multiplicative step per Δt) across the whole
// 0.3–16 RE span, instead of the old linear slider's 0.2 RE/px violent-then-flat response.
// The lab HTML imports these SAME exports (DRY — the lab consumes them, the tests pin them).
import { describe, it, expect } from 'vitest';
import {
  radiusFromT,
  tFromRadius,
  RADIUS_SLIDER_MIN,
  RADIUS_SLIDER_MAX,
} from '../planet-lod-lab-core.js';

describe('radiusFromT / tFromRadius — endpoints', () => {
  it('t=0 maps to the slider min (0.3 RE)', () => {
    expect(RADIUS_SLIDER_MIN).toBe(0.3);
    expect(radiusFromT(0)).toBeCloseTo(RADIUS_SLIDER_MIN, 12);
  });
  it('t=1 maps to the slider max (16 RE)', () => {
    expect(RADIUS_SLIDER_MAX).toBe(16);
    expect(radiusFromT(1)).toBeCloseTo(RADIUS_SLIDER_MAX, 12);
  });
  it('the 1 RE reference sits at an interior t and round-trips', () => {
    const t1 = tFromRadius(1);
    expect(t1).toBeGreaterThan(0);
    expect(t1).toBeLessThan(1);
    expect(radiusFromT(t1)).toBeCloseTo(1, 12);
  });
});

describe('radiusFromT / tFromRadius — round-trip inverse', () => {
  it('radiusFromT(tFromRadius(r)) === r across [0.3, 16] (200-pt sweep)', () => {
    const N = 200;
    for (let i = 0; i < N; i++) {
      const r = RADIUS_SLIDER_MIN + (RADIUS_SLIDER_MAX - RADIUS_SLIDER_MIN) * (i / (N - 1));
      expect(radiusFromT(tFromRadius(r))).toBeCloseTo(r, 9);
    }
  });
  it('tFromRadius(radiusFromT(t)) === t across [0, 1] (200-pt sweep)', () => {
    const N = 200;
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1);
      expect(tFromRadius(radiusFromT(t))).toBeCloseTo(t, 10);
    }
  });
});

describe('radiusFromT — strict monotonicity', () => {
  it('is strictly increasing and finite over a 200-point t sweep', () => {
    const N = 200;
    let prev = -Infinity;
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1);
      const r = radiusFromT(t);
      expect(Number.isFinite(r)).toBe(true);
      expect(r).toBeGreaterThan(prev);   // a step right on the track is never smaller
      prev = r;
    }
  });
});

describe('radiusFromT — perceptual uniformity (constant ratio per Δt)', () => {
  // The whole point of the log map: equal slider travel Δt is an equal MULTIPLICATIVE step
  // in radius, everywhere on the track. radiusFromT(t) = MIN·K^t (K=MAX/MIN), so
  // radiusFromT(t+dt)/radiusFromT(t) = K^dt, independent of t — the property the linear
  // slider lacked (violent at the low end, dead at the high end).
  const K = RADIUS_SLIDER_MAX / RADIUS_SLIDER_MIN;

  it('ratio radiusFromT(t+dt)/radiusFromT(t) is constant (= K^dt) across the track', () => {
    const dt = 0.01;
    const expectedRatio = Math.pow(K, dt);
    for (let i = 0; i <= 89; i++) {
      const t = i / 100;   // 0.00 .. 0.89, so t+dt stays in-range
      const ratio = radiusFromT(t + dt) / radiusFromT(t);
      expect(ratio).toBeCloseTo(expectedRatio, 9);
    }
  });

  it('the per-Δt % step is identical at both ends of the track', () => {
    const dt = 0.01;
    const lowStep  = radiusFromT(0 + dt) / radiusFromT(0) - 1;               // near t=0
    const highStep = radiusFromT(1) / radiusFromT(1 - dt) - 1;               // near t=1
    expect(lowStep).toBeCloseTo(highStep, 9);
    expect(lowStep).toBeCloseTo(Math.pow(K, dt) - 1, 9);
  });
});
