// Unit tests for voronoi3d() — the KEYSTONE shared primitive (integration-index §1).
// Three Stage-C domains route through it (relief craters F2, cryo pits/polygons,
// exotic hex/crystal/shatter), so its correctness is load-bearing. This is the
// CPU oracle the GLSL voronoi3d() is transcribed from; seam-freeness on the sphere
// is verified VISUALLY on :9223 (a 3D-domain property no CPU test can assert).
//
// Risk #1 spike (index §5): the analytic gradient of F1 is the exact silent-bug
// class the relief doc §5.4 flags — so we pin it against finite-difference here
// BEFORE trusting the shader normal.
import { describe, it, expect } from 'vitest';
import { voronoi3d } from '../src/worldengine/base/labCore.js';

// deterministic-ish sample points spread across the noise domain
const SAMPLES = [
  [0.3, 0.7, 1.4], [2.1, -0.6, 0.2], [-1.3, 3.7, -2.2], [5.5, 5.5, 5.5],
  [0.05, 0.05, 0.05], [-4.2, 1.1, 2.9], [10.3, -7.1, 0.8], [0.91, 0.49, 0.51],
];

describe('voronoi3d — basic invariants', () => {
  it('returns f2 >= f1 (second-nearest is never closer than nearest)', () => {
    for (const p of SAMPLES) {
      const v = voronoi3d(p, 27);
      expect(v.f2).toBeGreaterThanOrEqual(v.f1);
    }
  });

  it('is deterministic — same input, same output', () => {
    const a = voronoi3d([1.234, 5.678, 9.012], 27);
    const b = voronoi3d([1.234, 5.678, 9.012], 27);
    expect(b.f1).toBe(a.f1);
    expect(b.f2).toBe(a.f2);
    expect(b.cellId).toEqual(a.cellId);
  });

  it('nearest cell id is integer-valued (the lattice cell hosting the nearest center)', () => {
    const v = voronoi3d([3.3, -2.7, 0.4], 27);
    expect(v.cellId.every(Number.isInteger)).toBe(true);
  });

  it('F1 is non-negative (it is a distance)', () => {
    for (const p of SAMPLES) expect(voronoi3d(p, 27).f1).toBeGreaterThanOrEqual(0);
  });
});

describe('voronoi3d — analytic gradient of F1 (the relief-normal correctness gate)', () => {
  const EPS = 1e-4;

  // grad F1 = normalize(p - nearestCenter) within a cell → must be unit length.
  it('gradient is unit length in cell interiors', () => {
    for (const p of SAMPLES) {
      const v = voronoi3d(p, 27);
      if (v.f2 - v.f1 < 0.15) continue;             // skip near-border points (grad discontinuous there)
      const mag = Math.hypot(...v.grad);
      expect(mag).toBeCloseTo(1.0, 3);
    }
  });

  it('analytic gradient matches central finite-difference of F1 (interior points)', () => {
    let checked = 0;
    for (const p of SAMPLES) {
      const v = voronoi3d(p, 27);
      if (v.f2 - v.f1 < 0.15) continue;             // interior only — border has a gradient kink
      for (let ax = 0; ax < 3; ax++) {
        const pp = [...p], pm = [...p];
        pp[ax] += EPS; pm[ax] -= EPS;
        const fd = (voronoi3d(pp, 27).f1 - voronoi3d(pm, 27).f1) / (2 * EPS);
        expect(v.grad[ax]).toBeCloseTo(fd, 2);
      }
      checked++;
    }
    expect(checked).toBeGreaterThan(0);             // guard: the test actually ran assertions
  });
});

describe('voronoi3d — cell-count knob (qualityTier 27↔9, index §1 / spec §2.E)', () => {
  it('the full 27-neighbourhood never finds a FARTHER nearest than a reduced search', () => {
    // 27 searches the complete 3×3×3 lattice neighbourhood → the true global nearest.
    // A reduced (cheap/mobile) search can only tie or do worse. This pins the
    // cost/quality tradeoff: the cheap path is lossy, never closer.
    for (const p of SAMPLES) {
      const full = voronoi3d(p, 27);
      const cheap = voronoi3d(p, 9);
      expect(full.f1).toBeLessThanOrEqual(cheap.f1 + 1e-9);
    }
  });

  it('honours the requested neighbourhood (27 and 9 are both valid, finite)', () => {
    for (const cells of [9, 27]) {
      const v = voronoi3d([0.4, 0.6, 0.8], cells);
      expect(Number.isFinite(v.f1)).toBe(true);
      expect(Number.isFinite(v.f2)).toBe(true);
    }
  });
});
