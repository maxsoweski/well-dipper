// tests/ring-particle-cloud.test.js
import { describe, it, expect } from 'vitest';
import { bakeRingCloud, makeRingCloudPoints } from '../ring-particle-cloud.js';
import * as THREE from 'three';

// Synthetic physics fixture: two ringlets (ice 4-5, rock 6-8) with a gap between.
const PHYSICS = {
  innerRadius: 4, outerRadius: 8,
  ringlets: [
    { innerR: 4, outerR: 5, opacity: 0.6, composition: 'ice' },
    { innerR: 6, outerR: 8, opacity: 0.5, composition: 'rock' },
  ],
  gaps: [{ radius: 5.5, width: 0.5 }],
  density: 1.0,
};

// Deterministic RNG (mulberry32) so tests are stable.
function seeded(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function radii(baked) {
  const out = [];
  for (let i = 0; i < baked.count; i++) {
    const x = baked.positions[i * 3], z = baked.positions[i * 3 + 2];
    out.push(Math.hypot(x, z));
  }
  return out;
}

describe('bakeRingCloud', () => {
  it('produces matching-length typed arrays', () => {
    const b = bakeRingCloud(PHYSICS, { count: 5000, R: 1, rng: seeded(1) });
    expect(b.positions.length).toBe(b.count * 3);
    expect(b.colors.length).toBe(b.count * 3);
    expect(b.sizes.length).toBe(b.count);
    expect(b.count).toBeGreaterThan(4000); // healthy density places ~all
  });

  it('keeps every particle inside the annulus radius bounds', () => {
    const b = bakeRingCloud(PHYSICS, { count: 5000, R: 1, rng: seeded(2) });
    for (const r of radii(b)) {
      expect(r).toBeGreaterThanOrEqual(4 - 1e-6);
      expect(r).toBeLessThanOrEqual(8 + 1e-6);
    }
  });

  it('keeps every particle within the disk thickness', () => {
    const b = bakeRingCloud(PHYSICS, { count: 5000, R: 1, thickness: 0.02, rng: seeded(3) });
    const yHalf = 0.02 * 4; // thickness * innerRadius*R
    for (let i = 0; i < b.count; i++) {
      expect(Math.abs(b.positions[i * 3 + 1])).toBeLessThanOrEqual(yHalf + 1e-6);
    }
  });

  it('clears the gap: far fewer particles in the gap band than a ringlet band', () => {
    const b = bakeRingCloud(PHYSICS, { count: 8000, R: 1, rng: seeded(4) });
    const rs = radii(b);
    const inGap = rs.filter(r => r > 5.25 && r < 5.75).length;     // gap center ±0.25
    const inRinglet = rs.filter(r => r > 6.5 && r < 7.0).length;   // rock ringlet
    expect(inGap).toBeLessThan(inRinglet * 0.15);
  });

  it('is deterministic for a fixed rng seed', () => {
    const a = bakeRingCloud(PHYSICS, { count: 1000, R: 1, rng: seeded(7) });
    const b = bakeRingCloud(PHYSICS, { count: 1000, R: 1, rng: seeded(7) });
    expect(a.positions[0]).toBe(b.positions[0]);
    expect(a.count).toBe(b.count);
  });

  it('tints particles by the composition of the ringlet they fall in', () => {
    const b = bakeRingCloud(PHYSICS, { count: 5000, R: 1, rng: seeded(9) });
    // ice ≈ (0.85,0.92,0.98); rock ≈ (0.35,0.32,0.30). Find an inner (ice) particle.
    for (let i = 0; i < b.count; i++) {
      const r = Math.hypot(b.positions[i * 3], b.positions[i * 3 + 2]);
      if (r > 4.2 && r < 4.8) { // inside ice ringlet
        expect(b.colors[i * 3]).toBeGreaterThan(0.7); // blue-white, high R
        break;
      }
    }
  });
});

describe('makeRingCloudPoints', () => {
  it('builds a THREE.Points with the baked attributes and LOD uniforms', () => {
    const baked = bakeRingCloud(PHYSICS, { count: 1000, R: 1, rng: seeded(11) });
    const pts = makeRingCloudPoints(baked, { dResolve: 4, dCull: 14, planetRadius: 1 });
    expect(pts).toBeInstanceOf(THREE.Points);
    expect(pts.geometry.getAttribute('position').count).toBe(baked.count);
    expect(pts.geometry.getAttribute('aColor').count).toBe(baked.count);
    expect(pts.geometry.getAttribute('aSize').count).toBe(baked.count);
    expect(pts.material.uniforms.uDResolve.value).toBe(4);
    expect(pts.material.uniforms.uDCull.value).toBe(14);
    expect(pts.material.transparent).toBe(true);
    expect(pts.material.depthWrite).toBe(false);
  });
});
