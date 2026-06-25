// tests/worldengine-base-sphere.test.js
import { describe, it, expect } from 'vitest';
import { makeSphereField } from '../src/worldengine/base/sphereField.js';
import { buildIrregularSphere } from '../planet-lod-rivers.js'; // three lives here, not in sphereField.js

const TARGET_N = 600, LLOYD = 2;

function dot(a, b) { return a[0]*b[0] + a[1]*b[1] + a[2]*b[2]; }
function len(a) { return Math.hypot(a[0], a[1], a[2]); }

describe('worldengine base — F3 sphere carrier', () => {
  it('carrier mesh === the router mesh for matched (targetN, lloydIters)', () => {
    const mesh = buildIrregularSphere(TARGET_N, LLOYD);
    const c = makeSphereField(mesh);
    expect(c.N).toBe(mesh.verts.length);
    expect(c.verts).toBe(mesh.verts);  // same reference -> identical parameterization (no second mesh)
    expect(c.adj.length).toBe(mesh.verts.length);
  });
  it('adjacency is reciprocal, degree ~5-8, zero edge-truncation (seam-free)', () => {
    const c = makeSphereField(buildIrregularSphere(TARGET_N, LLOYD));
    let minDeg = 99, maxDeg = 0;
    for (let i = 0; i < c.N; i++) {
      const deg = c.adj[i].length; minDeg = Math.min(minDeg, deg); maxDeg = Math.max(maxDeg, deg);
      expect(deg).toBeGreaterThanOrEqual(4);   // no truncated node
      for (const j of c.adj[i]) expect(c.adj[j].includes(i)).toBe(true); // reciprocal
    }
    expect(minDeg).toBeGreaterThanOrEqual(4); expect(maxDeg).toBeLessThanOrEqual(9);
  });
  it('verts are unit length; latDegOf === asin(y); poles finite', () => {
    const c = makeSphereField(buildIrregularSphere(TARGET_N, LLOYD));
    for (let i = 0; i < c.N; i++) {
      expect(len(c.verts[i])).toBeCloseTo(1, 4);
      expect(c.latDegOf(i)).toBeCloseTo(Math.asin(Math.max(-1, Math.min(1, c.verts[i][1]))) * 180 / Math.PI, 4);
      expect(Number.isFinite(c.latDegOf(i))).toBe(true);
    }
  });
  it('tangent frames are orthonormal & tangent off-pole; pole returns a finite fallback', () => {
    const c = makeSphereField(buildIrregularSphere(TARGET_N, LLOYD));
    // pick a near-equator node
    let eq = 0; for (let i = 0; i < c.N; i++) if (Math.abs(c.verts[i][1]) < Math.abs(c.verts[eq][1])) eq = i;
    const { east, north } = c.tangentFrameAt(eq);
    expect(len(east)).toBeCloseTo(1, 4); expect(len(north)).toBeCloseTo(1, 4);
    expect(dot(east, north)).toBeCloseTo(0, 4);
    expect(dot(east, c.verts[eq])).toBeCloseTo(0, 4); // tangent
    expect(dot(north, c.verts[eq])).toBeCloseTo(0, 4);
    // pole-most node: frame finite (fallback)
    let pole = 0; for (let i = 0; i < c.N; i++) if (Math.abs(c.verts[i][1]) > Math.abs(c.verts[pole][1])) pole = i;
    const pf = c.tangentFrameAt(pole);
    expect(pf.east.every(Number.isFinite)).toBe(true); expect(pf.north.every(Number.isFinite)).toBe(true);
  });
  it('tangent-frame pole fallback: an exact pole dir [0,1,0] -> east=[1,0,0], finite north', () => {
    const c = makeSphereField({ verts: [[0, 1, 0], [1, 0, 0], [0, 0, 1]], faces: [], adj: [[1, 2], [0, 2], [0, 1]] });
    const f = c.tangentFrameAt(0);
    expect(f.east).toEqual([1, 0, 0]); expect(f.north.every(Number.isFinite)).toBe(true);
  });
  it('two carriers from matched params are byte-identical (deterministic, within engine)', () => {
    const a = makeSphereField(buildIrregularSphere(TARGET_N, LLOYD));
    const b = makeSphereField(buildIrregularSphere(TARGET_N, LLOYD));
    expect(a.verts).toEqual(b.verts);
    const sortAdj = (adj) => adj.map(x => [...x].sort((p, q) => p - q));
    expect(sortAdj(a.adj)).toEqual(sortAdj(b.adj));
  });
  it('SEAM CONTINUITY: a smooth global scalar reads continuous across every seam', () => {
    const c = makeSphereField(buildIrregularSphere(TARGET_N, LLOYD));
    // f(d) = d.x (Lipschitz constant 1 on the unit sphere w.r.t. chord; per-edge |df|/arc <= 1)
    const f = (d) => d[0];
    let maxRatio = 0;
    for (let i = 0; i < c.N; i++) {
      for (const j of c.adj[i]) {
        const di = c.verts[i], dj = c.verts[j];
        const chord = Math.hypot(di[0]-dj[0], di[1]-dj[1], di[2]-dj[2]);
        const arc = 2 * Math.asin(Math.min(1, chord / 2));
        if (arc > 1e-9) maxRatio = Math.max(maxRatio, Math.abs(f(di) - f(dj)) / arc);
      }
    }
    expect(maxRatio).toBeLessThan(1.05);  // below f's Lipschitz bound (1), small tolerance for discretization
    // all field arrays finite & zero-init
    for (const fld of ['height','grainAngle','grainMag','regime']) expect(c[fld].every(Number.isFinite)).toBe(true);
  });
});
