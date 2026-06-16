// AC1 oracle — planet-scale-normalization-2026-06-15.
// Pins the real-units (km) -> unit-sphere shader-uniform conversion helpers in
// planet-lod-lab-core.js. These are PURE functions; this suite asserts the AC1
// properties (monotonicity, exactness, boundedness) — NOT a particular constant.
import { describe, it, expect } from 'vitest';
import {
  R_EARTH_KM,
  featureFrequencyFromKm,
  reliefAmplitudeFromKm,
  reliefGravityFactor,
  animationRateFactor,
} from '../planet-lod-lab-core.js';

// Bounds the implementation documents (kept in sync with the helpers' comments).
const GRAV_FLOOR = 0.4, GRAV_CEIL = 2.5;
const RATE_FLOOR = 0.1, RATE_CEIL = 3.0;

const finite = (x) => Number.isFinite(x);

describe('R_EARTH_KM', () => {
  it('is Earth radius in km', () => {
    expect(R_EARTH_KM).toBe(6371);
  });
});

describe('featureFrequencyFromKm', () => {
  it('= cFeature * (radiusEarth * R_EARTH_KM) / featureSizeKm', () => {
    // exact form check
    expect(featureFrequencyFromKm(1, 100, 2)).toBeCloseTo(2 * (1 * 6371) / 100, 9);
    expect(featureFrequencyFromKm(0.53, 50, 1)).toBeCloseTo(1 * (0.53 * 6371) / 50, 9);
  });

  it('strictly increases with radiusEarth (size/c fixed)', () => {
    const sizeKm = 80, c = 1.5;
    const radii = [0.3, 0.53, 1.0, 2.0, 3.9, 11.2, 16];
    for (let i = 1; i < radii.length; i++) {
      const lo = featureFrequencyFromKm(radii[i - 1], sizeKm, c);
      const hi = featureFrequencyFromKm(radii[i], sizeKm, c);
      expect(hi).toBeGreaterThan(lo);
    }
  });

  it('strictly decreases with featureSizeKm (radius/c fixed)', () => {
    const radiusEarth = 1.0, c = 1.5;
    const sizes = [5, 20, 50, 100, 250, 600];
    for (let i = 1; i < sizes.length; i++) {
      const big = featureFrequencyFromKm(radiusEarth, sizes[i - 1], c);
      const small = featureFrequencyFromKm(radiusEarth, sizes[i], c);
      expect(small).toBeLessThan(big);
    }
  });

  it('stays finite + positive across a radius/size sweep', () => {
    for (const r of [0.3, 1, 4, 16]) {
      for (const s of [1, 50, 500]) {
        const f = featureFrequencyFromKm(r, s, 1.2);
        expect(finite(f)).toBe(true);
        expect(f).toBeGreaterThan(0);
      }
    }
  });
});

describe('reliefAmplitudeFromKm', () => {
  it('exactly equals height_km / (radiusEarth * R_EARTH_KM)', () => {
    const cases = [
      [10, 1.0],   // ~Everest on Earth
      [25, 0.53],  // ~Olympus Mons on Mars
      [3, 0.25],   // small body
      [0.5, 11.2], // shallow relief on a giant
    ];
    for (const [h, r] of cases) {
      expect(reliefAmplitudeFromKm(h, r)).toBeCloseTo(h / (r * 6371), 12);
    }
  });

  it('stays finite across extremes', () => {
    expect(finite(reliefAmplitudeFromKm(50, 0.05))).toBe(true);
    expect(finite(reliefAmplitudeFromKm(0.01, 16))).toBe(true);
  });
});

describe('reliefGravityFactor', () => {
  it('strictly decreases as surfaceGravity increases', () => {
    const gravs = [0.13, 0.38, 0.5, 0.9, 1.0, 2.0, 5.0, 12.0];
    for (let i = 1; i < gravs.length; i++) {
      const lowG = reliefGravityFactor(gravs[i - 1]);
      const highG = reliefGravityFactor(gravs[i]);
      expect(highG).toBeLessThan(lowG);
    }
  });

  it('stays within [floor, ceil] across the gravity sweep + extremes', () => {
    for (const g of [1e-4, 0.01, 0.13, 0.38, 1.0, 5.0, 50, 1e6]) {
      const f = reliefGravityFactor(g);
      expect(finite(f)).toBe(true);
      expect(f).toBeGreaterThanOrEqual(GRAV_FLOOR);
      expect(f).toBeLessThanOrEqual(GRAV_CEIL);
    }
  });

  it('low-g world gets a larger factor than a high-g world', () => {
    expect(reliefGravityFactor(0.13)).toBeGreaterThan(reliefGravityFactor(2.0));
  });
});

describe('animationRateFactor', () => {
  it('strictly decreases as radiusEarth increases', () => {
    const radii = [0.3, 0.53, 1.0, 2.0, 3.9, 11.2];
    for (let i = 1; i < radii.length; i++) {
      const small = animationRateFactor(radii[i - 1]);
      const big = animationRateFactor(radii[i]);
      expect(big).toBeLessThan(small);
    }
  });

  it('is ~ refRadius/radius in its unclamped band', () => {
    // At radius 2 with ref 1 -> 0.5 (well inside [0.1,3]).
    expect(animationRateFactor(2.0, 1.0)).toBeCloseTo(0.5, 9);
  });

  it('stays within [floor, ceil] across radius extremes', () => {
    for (const r of [1e-3, 0.05, 0.3, 1, 4, 16, 1e6]) {
      const f = animationRateFactor(r);
      expect(finite(f)).toBe(true);
      expect(f).toBeGreaterThanOrEqual(RATE_FLOOR);
      expect(f).toBeLessThanOrEqual(RATE_CEIL);
    }
  });
});
