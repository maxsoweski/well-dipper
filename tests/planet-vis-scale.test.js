// Radius display-scale (sVis) — pure-helper oracle.
// Workstream: world-engine-radius-display-scale-2026-07-24.
//
// Pins the DISPLAY-ONLY visual-scale math in planet-lod-lab-core.js: the same
// exports the lab HTML consumes (DRY — the lab imports these, tests pin them).
// Covers AC-VIS-MONO (mapping shape), AC-CLAMP (camera never enters the scaled
// sphere), and the AC-LOD-KEY keying identity (logical distance = state.distance/sVis).
// The fence + source-pin halves live in tests/vis-scale-fence.test.js.
import { describe, it, expect } from 'vitest';
import {
  visScaleOf,
  VIS_SCALE_EXP,
  minCameraDistance,
  CAMERA_CLEARANCE,
} from '../planet-lod-lab-core.js';

// The design range: 0.3 RE (Moon-class draws bottom out here) → 16 RE (Sub-Neptune ceiling).
const R_MIN = 0.3, R_MAX = 16;

describe('visScaleOf — AC-VIS-MONO (mapping shape)', () => {
  it('is the identity at the 1 RE reference (exact, zero-change property)', () => {
    // sVis(1)=1 exactly is what makes the whole increment bit-identical at radius 1.
    expect(visScaleOf(1)).toBe(1);
  });

  it('exponent knob is 0.5 (sqrt) as settled by default', () => {
    expect(VIS_SCALE_EXP).toBe(0.5);
  });

  it('matches the worked points 0.3 → 0.5477 and 16 → 4.0', () => {
    expect(visScaleOf(0.3)).toBeCloseTo(0.5477, 3);   // AC-VIS-MONO tolerance ±1e-3
    expect(visScaleOf(16)).toBeCloseTo(4.0, 9);        // AC-VIS-MONO tolerance ±1e-9
  });

  it('is strictly monotonic increasing over [0.3, 16] (200-point sweep) and finite', () => {
    const N = 200;
    let prev = -Infinity;
    for (let i = 0; i < N; i++) {
      const r = R_MIN + (R_MAX - R_MIN) * (i / (N - 1));
      const s = visScaleOf(r);
      expect(Number.isFinite(s)).toBe(true);
      expect(s).toBeGreaterThan(prev);   // strictly increasing — a bigger world is never smaller
      prev = s;
    }
  });
});

describe('minCameraDistance — AC-CLAMP (camera never enters the scaled sphere)', () => {
  it('clearance constant reproduces the lab wheel floor at sVis=1', () => {
    expect(CAMERA_CLEARANCE).toBe(1.1);
    expect(minCameraDistance(1)).toBe(1.1);            // == today's Math.max(1.1, …) floor
  });

  it('has margin above the scaled surface at every design radius (> sVis·1.05)', () => {
    for (const r of [0.3, 1, 4, 16]) {
      const s = visScaleOf(r);
      expect(minCameraDistance(s)).toBeGreaterThan(s * 1.05);   // AC-CLAMP observable
    }
  });

  it('worked points: 16 RE → 4.4, and the floor scales with the disc', () => {
    expect(minCameraDistance(visScaleOf(16))).toBeCloseTo(4.4, 9);   // sVis=4 → 4.4
    // 0.3 RE: sVis≈0.5477 → floor ≈0.6025, still clear of its 0.575 = sVis·1.05 bound.
    expect(minCameraDistance(visScaleOf(0.3))).toBeGreaterThan(visScaleOf(0.3) * 1.05);
  });
});

describe('AC-LOD-KEY — logical distance keying identity', () => {
  // The lab keys lodRampOf/lodHysteresis on logicalDist = state.distance / sVis so
  // detail tracks APPARENT size. This pins the reduction the source relies on.
  const logicalDist = (d, sVis) => d / sVis;

  it('reduces to state.distance exactly at sVis=1 (bit-identical to pre-increment)', () => {
    for (const d of [1.1, 2.6, 6, 18, 20, 22, 30]) {
      expect(logicalDist(d, visScaleOf(1))).toBe(d);   // exact — IEEE754 d/1 === d
    }
  });

  it('is state.distance/4 at sVis=visScaleOf(16)=4', () => {
    const s = visScaleOf(16);
    expect(s).toBeCloseTo(4, 9);
    expect(logicalDist(20, s)).toBeCloseTo(20 / 4, 9);
  });
});
