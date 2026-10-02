// GalaxyGrid — the fixed option-D grid and star keys (naming-prism-segments
// AC-1, plan §0.4, §3.1, §3.3, §4.1).
//
// Every box is half-open (lower edge in, upper edge out) on every axis and at
// every level, so a point on a face, edge or corner has exactly ONE owner. The
// face/corner/slab tests below are the ones the contract names: closing the
// upper edge (sabotage) must turn them red.

import { describe, it, expect } from 'vitest';
import {
  SECTOR_KPC, REGION_DIV, PRISM_DIV, REGION_KPC, PRISM_KPC, GRID_OFFSET_KPC,
  GRID_MIN_KPC, GRID_MAX_KPC, SECTORS_PER_AXIS, SLAB_KPC,
  addressOf, boundsOf, sectorRef, regionRef, prismRef, slabRef, inNamingArea,
  starKey, realStarKey, knownSystemKey, slotOf,
} from '../GalaxyGrid.js';

// The next double below / above v — a point a hair inside the lower box.
const buf = new DataView(new ArrayBuffer(8));
function nextDown(v) {
  if (v === 0) return -Number.MIN_VALUE;
  buf.setFloat64(0, v);
  buf.setBigInt64(0, buf.getBigInt64(0) + (v > 0 ? -1n : 1n));
  return buf.getFloat64(0);
}

// Small deterministic PRNG so failures reproduce.
function lcg(seed) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

const refs = (a) => [sectorRef(a), regionRef(a), prismRef(a), slabRef(a)].join(' ');
const prismEdge = (p) => GRID_MIN_KPC + p * PRISM_KPC;

describe('GalaxyGrid constants (plan §0.4, frozen)', () => {
  it('are the exact option-D numbers', () => {
    expect(SECTOR_KPC).toBe(2);
    expect(REGION_DIV).toBe(16);
    expect(PRISM_DIV).toBe(16);
    expect(REGION_KPC).toBe(0.125);
    expect(PRISM_KPC).toBe(0.0078125);
    expect(PRISM_KPC).toBe(2 / 256);
    expect(GRID_OFFSET_KPC).toBe(1.00390625);
    expect(GRID_MIN_KPC).toBe(-18.99609375);
    expect(GRID_MAX_KPC).toBe(19.00390625);
    expect(SECTORS_PER_AXIS).toBe(19);
    expect(SLAB_KPC).toBe(0.1);
  });

  it('puts Sol (8, 0) and the galactic centre (0, 0) in the middle of a prism', () => {
    for (const [x, z] of [[8, 0], [0, 0]]) {
      const b = boundsOf(addressOf(x, 0.01, z));
      expect((b.min.x + b.max.x) / 2).toBe(x);
      expect((b.min.z + b.max.z) / 2).toBe(z);
      expect(b.max.x - b.min.x).toBe(PRISM_KPC);
    }
  });
});

describe('grid references — row 1 at the top (plan §4.1)', () => {
  it('Sol is sector N10 and the galactic centre J10', () => {
    expect(sectorRef(addressOf(8, 0.025, 0))).toBe('N10');
    expect(sectorRef(addressOf(0, 0, 0))).toBe('J10');
  });

  it('reproduces the plan §4.3 worked examples', () => {
    // Red dwarf beside Sol's column: sector N10, region I8, prism A14, slab N1.
    expect(refs(addressOf(8.005, 0.050, 0.027))).toBe('N10 I8 A14 N1');
    // Sol's own column: region H9, prism P1; 1.55 kpc up is slab N16.
    expect(refs(addressOf(8, 0.025, 0))).toBe('N10 H9 P1 N1');
    expect(slabRef(addressOf(8, 1.55, 0))).toBe('N16');
  });

  it('letters grow with X; row numbers grow as Z falls (A1 top-left, S19 bottom-right)', () => {
    expect(sectorRef(addressOf(GRID_MIN_KPC, 0, nextDown(GRID_MAX_KPC)))).toBe('A1');
    expect(sectorRef(addressOf(nextDown(GRID_MAX_KPC), 0, GRID_MIN_KPC))).toBe('S19');
    const a = addressOf(8, 0, 0), up = addressOf(8, 0, 2), right = addressOf(10, 0, 0);
    expect(up.sector.j).toBe(a.sector.j - 1);            // larger Z → smaller row number
    expect(right.sector.i).toBe(a.sector.i + 1);
    // Same rule inside a sector: the region and prism rows count from the top too.
    const b = boundsOf(addressOf(8, 0, 0));
    expect(addressOf(8, 0, b.max.z).prism.j).toBe((a.prism.j + PRISM_DIV - 1) % PRISM_DIV);
  });

  it('refs outside the 19 × 19 naming area are null; inside are labels', () => {
    expect(sectorRef(addressOf(GRID_MAX_KPC, 0, 0))).toBeNull();
    expect(sectorRef(addressOf(nextDown(GRID_MIN_KPC), 0, 0))).toBeNull();
    expect(inNamingArea(addressOf(0, 0, 0))).toBe(true);
    expect(inNamingArea(addressOf(25, 0, 0))).toBe(false);
    expect(regionRef({ i: 15, j: 15 })).toBe('P16');
    expect(prismRef({ i: 0, j: 0 })).toBe('A1');
    expect(slabRef({ hemi: 'S', n: 30 })).toBe('S30');
  });
});

describe('half-open boxes: faces, edges, corners (plan §3.1)', () => {
  // Prism edges at every level: a plain prism edge, a region edge (×16), a
  // sector edge (×256), including ones at negative coordinates.
  const EDGE_P = [1, 7, 16, 100, 256, 512, 2431, 2432, 3328, 3455, 3456, 4863, -1, -16, -256];

  it('an X or Z face belongs to the box above it; one ulp below belongs to the box below', () => {
    for (const p of EDGE_P) {
      const e = prismEdge(p);
      for (const axis of ['x', 'z']) {
        const at = axis === 'x' ? addressOf(e, 0.05, 0.3) : addressOf(0.3, 0.05, e);
        const below = axis === 'x' ? addressOf(nextDown(e), 0.05, 0.3) : addressOf(0.3, 0.05, nextDown(e));
        expect(boundsOf(at).min[axis]).toBe(e);
        expect(boundsOf(below).max[axis]).toBe(e);
        expect(below).not.toEqual(at);
      }
    }
  });

  it('a face on a sector edge changes the sector; a face on a region edge changes the region', () => {
    const sectorEdge = prismEdge(3328);                    // 13 × 256
    expect(addressOf(sectorEdge, 0, 0).sector.i).toBe(13);
    expect(addressOf(nextDown(sectorEdge), 0, 0).sector.i).toBe(12);
    expect(addressOf(nextDown(sectorEdge), 0, 0).region.i).toBe(15);
    expect(addressOf(nextDown(sectorEdge), 0, 0).prism.i).toBe(15);
    const regionEdge = prismEdge(3328 + 16);
    expect(addressOf(regionEdge, 0, 0).region.i).toBe(1);
    expect(addressOf(regionEdge, 0, 0).prism.i).toBe(0);
    expect(addressOf(nextDown(regionEdge), 0, 0).region.i).toBe(0);
  });

  it('slab faces: y = 0 is N1, just below is S1; every slab edge to ±N999 is lower-inclusive', () => {
    expect(slabRef(addressOf(8, 0, 0))).toBe('N1');
    expect(slabRef(addressOf(8, -0, 0))).toBe('N1');
    expect(slabRef(addressOf(8, nextDown(0), 0))).toBe('S1');
    expect(slabRef(addressOf(8, -0.1, 0))).toBe('S1');
    expect(slabRef(addressOf(8, nextDown(-0.1), 0))).toBe('S2');
    for (let k = -999; k <= 999; k++) {
      const e = boundsOf({ ...addressOf(8, 0, 0), slab: k >= 0 ? { hemi: 'N', n: k + 1 } : { hemi: 'S', n: -k } }).min.y;
      expect(boundsOf(addressOf(8, e, 0)).min.y).toBe(e);
      expect(boundsOf(addressOf(8, nextDown(e), 0)).max.y).toBe(e);
    }
  });

  it('a corner (x, y, z all on edges) has exactly one owner — the box whose min IS the corner', () => {
    for (const [px, pz, y] of [[3328, 2304, 0], [3456, 2431, 0.1], [0, 0, -0.3], [-256, 4864, 1.5]]) {
      const c = { x: prismEdge(px), y: boundsOf(addressOf(0, y, 0)).min.y, z: prismEdge(pz) };
      const owner = boundsOf(addressOf(c.x, c.y, c.z));
      expect(owner.min).toEqual(c);
      // The 8 boxes meeting at the corner are all different.
      const seen = new Set();
      for (const dx of [0, 1]) for (const dy of [0, 1]) for (const dz of [0, 1]) {
        const a = addressOf(dx ? nextDown(c.x) : c.x, dy ? nextDown(c.y) : c.y, dz ? nextDown(c.z) : c.z);
        seen.add(JSON.stringify(a));
      }
      expect(seen.size).toBe(8);
    }
  });

  it('negative coordinates use the same floor — no special case', () => {
    for (const [x, y, z] of [[-0.001, -0.05, -0.001], [-12.3, -2.71, -7.77], [-18.99, -0.0001, 18.9]]) {
      const b = boundsOf(addressOf(x, y, z));
      for (const [ax, v] of [['x', x], ['y', y], ['z', z]]) {
        expect(b.min[ax]).toBeLessThanOrEqual(v);
        expect(v).toBeLessThan(b.max[ax]);
      }
    }
  });
});

describe('round trip and containment', () => {
  it('address → bounds → address is exact at both ends of every box', () => {
    const rnd = lcg(1234);
    const int = (n) => Math.floor(rnd() * n);
    for (let t = 0; t < 3000; t++) {
      const a = {
        sector: { i: int(23) - 2, j: int(23) - 2 },
        region: { i: int(16), j: int(16) },
        prism: { i: int(16), j: int(16) },
        slab: { hemi: rnd() < 0.5 ? 'N' : 'S', n: 1 + int(999) },
      };
      const b = boundsOf(a);
      expect(addressOf(b.min.x, b.min.y, b.min.z)).toEqual(a);
      expect(addressOf(nextDown(b.max.x), nextDown(b.max.y), nextDown(b.max.z))).toEqual(a);
      expect(addressOf(b.max.x, b.min.y, b.min.z)).not.toEqual(a);
      expect(addressOf(b.min.x, b.max.y, b.min.z)).not.toEqual(a);
      expect(addressOf(b.min.x, b.min.y, b.max.z)).not.toEqual(a);
    }
  });

  it('every sampled position lies inside its own box (min ≤ p < max)', () => {
    const rnd = lcg(99);
    for (let t = 0; t < 20000; t++) {
      const p = { x: (rnd() - 0.5) * 50, y: (rnd() - 0.5) * 8, z: (rnd() - 0.5) * 50 };
      const b = boundsOf(addressOf(p.x, p.y, p.z));
      for (const ax of ['x', 'y', 'z']) {
        expect(b.min[ax] <= p[ax] && p[ax] < b.max[ax]).toBe(true);
      }
    }
  });

  it('partial addresses give the sector, region and column boxes', () => {
    const a = addressOf(8, 0.025, 0);
    const s = boundsOf({ sector: a.sector });
    const r = boundsOf({ sector: a.sector, region: a.region });
    const c = boundsOf({ sector: a.sector, region: a.region, prism: a.prism });
    expect(s.max.x - s.min.x).toBe(SECTOR_KPC);
    expect(r.max.z - r.min.z).toBe(REGION_KPC);
    expect(c.max.x - c.min.x).toBe(PRISM_KPC);
    expect(c.min.y).toBe(-Infinity);
    // Sol sits about 1 kpc from every sector edge (plan §0.4), exactly.
    expect(8 - s.min.x).toBe(0.99609375);
    expect(s.max.x - 8).toBe(1.00390625);
    expect(s.max.z).toBe(1.00390625);
    expect(s.min.z).toBe(-0.99609375);
  });

  it('rejects malformed input instead of guessing', () => {
    expect(() => addressOf(NaN, 0, 0)).toThrow();
    expect(() => addressOf(0, undefined, 0)).toThrow();
    expect(() => boundsOf({ sector: { i: 0, j: 0 }, region: { i: 16, j: 0 } })).toThrow();
    expect(() => boundsOf({ sector: { i: 0, j: 0 }, prism: { i: 0, j: 0 } })).toThrow();
    expect(() => boundsOf({ sector: { i: 0, j: 0 }, slab: { hemi: 'N', n: 0 } })).toThrow();
  });
});

describe('star keys (plan §3.2)', () => {
  it('starKey has the documented shape and is injective over a sampled volume, across tiers', () => {
    expect(starKey({ tier: 'Kg', cx: -3, cy: 0, cz: 12 })).toBe('p:Kg:-3:0:12');
    const tiers = ['O', 'B', 'A', 'F', 'G', 'K', 'M', 'Kg', 'Gg', 'Mg'];
    const keys = new Set();
    let n = 0;
    for (const tier of tiers) {
      for (let cx = -6; cx <= 6; cx++) for (let cy = -6; cy <= 6; cy++) for (let cz = -6; cz <= 6; cz++) {
        keys.add(starKey({ tier, cx: cx * 1013, cy, cz: cz * 7 })); n++;
      }
    }
    expect(keys.size).toBe(n);
  });

  it('rejects a tier that could make keys ambiguous, and non-integer cells', () => {
    expect(() => starKey({ tier: 'M:1', cx: 0, cy: 0, cz: 0 })).toThrow();
    expect(() => starKey({ tier: 'M', cx: 0.5, cy: 0, cz: 0 })).toThrow();
  });

  it('the three namespaces are disjoint', () => {
    expect(starKey({ tier: 'G', cx: 1, cy: 2, cz: 3 }).startsWith('p:')).toBe(true);
    expect(realStarKey({ name: 'Sirius', x: 7.998231, y: 0.024592, z: -0.001913 })).toBe('r:Sirius@7.998231,0.024592,-0.001913');
    expect(knownSystemKey('Sol')).toBe('k:Sol');
    // Two catalogue entries share a name (HYG has 12 such) but not a position.
    expect(realStarKey({ name: 'Iot Cnc', x: 7.92155, y: 0.08545, z: -0.022322 }))
      .not.toBe(realStarKey({ name: 'Iot Cnc', x: 7.933891, y: 0.075929, z: -0.018801 }));
  });
});

describe('slot numbers inside a box (plan §3.3)', () => {
  it('numbers every candidate cell once, height first, coarse cells that only touch the box included', () => {
    const box = boundsOf(addressOf(8, 0.025, 0));                  // one 7.8125 × 100 × 7.8125 pc slab
    // Can cell c put a star in [lo, hi)? Use the generator's own placement
    // formula (HashGridStarfield: centre + (byte/255 − 0.5) · cell) over all
    // 256 offset bytes, so float rounding at the faces is the real one.
    const reaches = (c, cell, lo, hi) => {
      for (let k = 0; k < 256; k++) { const v = (c + 0.5) * cell + (k / 255 - 0.5) * cell; if (v >= lo && v < hi) return true; }
      return false;
    };
    for (const cell of [0.0011, 0.0021, 0.05, 0.074]) {            // M, G, Kg, O
      const seen = new Set();
      let count = 0, reachable = 0, touchingOnly = 0;
      const cx0 = Math.floor(box.min.x / cell) - 2, cx1 = Math.floor(box.max.x / cell) + 2;
      const cy0 = Math.floor(box.min.y / cell) - 2, cy1 = Math.floor(box.max.y / cell) + 2;
      const cz0 = Math.floor(box.min.z / cell) - 2, cz1 = Math.floor(box.max.z / cell) + 2;
      for (let cx = cx0; cx <= cx1; cx++) for (let cy = cy0; cy <= cy1; cy++) for (let cz = cz0; cz <= cz1; cz++) {
        const ident = { tier: 'T', cx, cy, cz };
        const can = reaches(cx, cell, box.min.x, box.max.x) && reaches(cy, cell, box.min.y, box.max.y) && reaches(cz, cell, box.min.z, box.max.z);
        let r = null;
        try { r = slotOf(ident, cell, box); } catch { /* not a candidate */ }
        if (can) {
          // Every cell that can place a star in the box MUST have a slot.
          expect(r).not.toBeNull();
          reachable++;
          const centre = [(cx + 0.5) * cell, (cy + 0.5) * cell, (cz + 0.5) * cell];
          if (centre[0] < box.min.x || centre[0] >= box.max.x || centre[2] < box.min.z || centre[2] >= box.max.z) touchingOnly++;
        }
        if (!r) continue;
        count = r.count;
        expect(r.slot).toBeGreaterThanOrEqual(0);
        expect(r.slot).toBeLessThan(r.count);
        seen.add(r.slot);
      }
      expect(seen.size).toBe(count);                               // dense: 0 … count−1, no gaps or repeats
      expect(count).toBeGreaterThanOrEqual(reachable);
      if (cell >= 0.05) expect(touchingOnly).toBeGreaterThan(0);   // coarse: centres outside the column still count
    }
  });

  it('a higher cell gets a bigger slot; within a layer, rows from the top then columns left to right', () => {
    const box = boundsOf(addressOf(8, 0.025, 0));
    const c = 0.0011;
    const mid = (lo, hi) => Math.floor((lo + hi) / 2 / c);
    const base = { tier: 'M', cx: mid(box.min.x, box.max.x), cy: mid(box.min.y, box.max.y), cz: mid(box.min.z, box.max.z) };
    const s = (d) => slotOf({ ...base, ...d }, c, box).slot;
    expect(s({ cy: base.cy + 1 })).toBeGreaterThan(s({ cx: base.cx + 3, cz: base.cz - 3 }));
    expect(s({ cz: base.cz + 1 })).toBeLessThan(s({}));            // larger Z = nearer the top = earlier
    expect(s({ cx: base.cx + 1 })).toBe(s({}) + 1);
  });
});
