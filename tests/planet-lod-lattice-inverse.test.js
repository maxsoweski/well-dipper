// planet-lod-lattice-inverse.test.js — Section 3.2 closed-form O(1) lattice inverse.
//
// The two O(Nf²) killers (snapNearest in tributaries.js, the sampleHeight nearest-vert scan in
// tributary-patch.js) are replaced by snapToLattice: a closed-form triangular-lattice cell inverse
// that is O(1) per query. The make-or-break property is inverse(forward(k)) == k for EVERY k (the
// spec flags boundary cells as where a naive inverse diverges), plus near-nearest behaviour for
// arbitrary in-cap dirs (so the snap matches the old global-nearest linear scan closely enough that
// the growth topology is unchanged). This is what unblocks raising gridRes to ~448 (§3.2).
import { describe, it, expect } from 'vitest';
import { buildFineGrid, snapToLattice, localFrame } from '../planet-lod-tributaries.js';

const REGIONS = [
  { center: [0, 0, 1], angularRadius: 0.14 },          // ~8° cap, axis-aligned
  { center: [0.3, -0.6, 0.74], angularRadius: 0.14 },  // ~8° cap, off-axis frame
  { center: [0.3, -0.6, 0.74], angularRadius: 0.07 },  // ~4° tighter cap
];

describe('§3.2 snapToLattice — inverse(forward(k)) == k for EVERY fine vert', () => {
  for (const region of REGIONS) {
    for (const gridRes of [16, 56, 120]) {
      it(`center=${region.center} α=${region.angularRadius} gridRes=${gridRes}: all k round-trip`, () => {
        const grid = buildFineGrid(region, gridRes);
        let mismatches = 0;
        for (let k = 0; k < grid.fverts.length; k++) {
          if (snapToLattice(grid, grid.fverts[k]) !== k) mismatches++;
        }
        expect(mismatches).toBe(0);
      });
    }
  }
});

describe('§3.2 snapToLattice — matches the brute-force global nearest for arbitrary in-cap dirs', () => {
  const region = { center: [0.3, -0.6, 0.74], angularRadius: 0.14 };
  const gridRes = 80;
  const grid = buildFineGrid(region, gridRes);
  const { u, v, n } = localFrame(region.center);
  const R = Math.tan(region.angularRadius);

  // brute-force global nearest (the OLD linear scan) — ground truth.
  function bruteNearest(dir) {
    let best = -1, bestDot = -Infinity;
    for (let k = 0; k < grid.fverts.length; k++) {
      const f = grid.fverts[k];
      const d = dir[0] * f[0] + dir[1] * f[1] + dir[2] * f[2];
      if (d > bestDot) { bestDot = d; best = k; }
    }
    return best;
  }
  // deterministic pseudo-random in-cap dirs (planar offset within ±0.85R, lifted to the sphere).
  function mkDir(i) {
    const a = (i * 2.399963) % (2 * Math.PI);      // golden-angle spiral in the plane
    const rad = 0.85 * R * ((i * 0.6180339887) % 1.0);
    const su = rad * Math.cos(a), sv = rad * Math.sin(a);
    const p = [n[0] + u[0] * su + v[0] * sv, n[1] + u[1] * su + v[1] * sv, n[2] + u[2] * su + v[2] * sv];
    const L = Math.hypot(p[0], p[1], p[2]);
    return [p[0] / L, p[1] / L, p[2] / L];
  }

  it('snap result equals brute-force nearest (or is angularly within one cell of it) for 300 dirs', () => {
    let exact = 0, near = 0, far = 0;
    for (let i = 1; i <= 300; i++) {
      const dir = mkDir(i);
      const got = snapToLattice(grid, dir);
      const want = bruteNearest(dir);
      expect(got).toBeGreaterThanOrEqual(0);
      if (got === want) { exact++; continue; }
      // not identical: the snapped vert must still be within ~1.5 cells of the true nearest.
      const g = grid.fverts[got], w = grid.fverts[want];
      const chord = Math.hypot(g[0] - w[0], g[1] - w[1], g[2] - w[2]);
      if (chord <= 1.5 * grid.cell) near++; else far++;
    }
    // the closed-form inverse should be exact for the overwhelming majority; never grossly wrong.
    expect(far).toBe(0);
    expect(exact).toBeGreaterThan(270);   // >90% exact
  });
});

describe('§3.2 snapToLattice — exposes the lattice index + frame buildFineGrid now returns', () => {
  it('buildFineGrid returns indexAt, rowH, frame for the inverse', () => {
    const grid = buildFineGrid({ center: [0, 0, 1], angularRadius: 0.14 }, 32);
    expect(grid.indexAt).toBeTruthy();
    expect(typeof grid.rowH).toBe('number');
    expect(grid.frame).toBeTruthy();
    expect(grid.frame.u.length).toBe(3);
    expect(grid.frame.n.length).toBe(3);
  });

  it('a dir behind the cap returns -1', () => {
    const grid = buildFineGrid({ center: [0, 0, 1], angularRadius: 0.14 }, 32);
    expect(snapToLattice(grid, [0, 0, -1])).toBe(-1);
  });
});
