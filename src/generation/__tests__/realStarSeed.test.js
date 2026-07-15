// realStarSeed — the ONE canonical real-star seed (FIX-1 / AC1). Two guards:
//
//   1. BYTE-IDENTITY: the module reproduces the retired F1 twin
//      (hashCombine(round(x·1e4), hashCombine(round(y·1e4), round(z·1e4))))
//      exactly, for a spread of representative positions incl. negatives and
//      sub-bin offsets. A change to the module body that silently re-seeds
//      every real star trips here.
//   2. CATALOG-SITE PARITY: RealStarCatalog.findVisible emits realStarSeed(pos)
//      for every star it returns — the catalog derivation site now imports the
//      shared module rather than inlining the formula.
//
// The search site is proven in knownObjectSearch.test.js; both NavComputer merge
// branches (matched overwrite + unmatched add) in NavComputer.merge.test.js —
// together the four real-star seed derivations converge on this module.

import { describe, it, expect } from 'vitest';
import { realStarSeed } from '../realStarSeed.js';
import { RealStarCatalog } from '../RealStarCatalog.js';
import { GalacticMap } from '../GalacticMap.js';

// The retired formula, inlined verbatim as an INDEPENDENT reference (do not
// import realStarSeed here — that would make the guard tautological).
const retiredF1 = (x, y, z) =>
  GalacticMap.hashCombine(
    Math.round(x * 10000),
    GalacticMap.hashCombine(Math.round(y * 10000), Math.round(z * 10000)),
  );

// Representative positions: solar neighborhood, negatives on each axis, a
// sub-0.1-pc offset (proves the round() binning), and the origin edge.
const POSITIONS = [
  { x: 8.0, y: 0.025, z: 0.0 },
  { x: 7.9987, y: 0.0246, z: -0.0019 }, // Sirius-ish (the merge fixture pos)
  { x: -3.214, y: -0.113, z: 4.702 },
  { x: 8.00004, y: -0.00006, z: 0.00009 }, // sub-bin: rounds toward the 0.1 pc cell
  { x: 0, y: 0, z: 0 },
  { x: 12.5, y: 1.75, z: -9.9 },
];

describe('realStarSeed — canonical F1 (FIX-1 / AC1)', () => {
  it('is byte-identical to the retired F1 twin for representative positions', () => {
    for (const p of POSITIONS) {
      expect(realStarSeed(p.x, p.y, p.z)).toBe(retiredF1(p.x, p.y, p.z));
    }
  });

  it('returns an unsigned 32-bit integer', () => {
    for (const p of POSITIONS) {
      const s = realStarSeed(p.x, p.y, p.z);
      expect(Number.isInteger(s)).toBe(true);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(0xffffffff);
    }
  });

  it('bins to 0.1 pc — sub-bin offsets collapse to the same seed', () => {
    // round(x·1e4) bins at 0.0001 kpc = 0.1 pc. Two positions inside one cell
    // share a seed (this is the quantization that unifies real bound multiples).
    const a = realStarSeed(8.00001, 0.00002, -0.00003);
    const b = realStarSeed(8.00004, -0.00001, 0.00004);
    expect(a).toBe(b);
    // A neighbouring cell differs.
    expect(realStarSeed(8.0002, 0, 0)).not.toBe(a);
  });

  it('RealStarCatalog.findVisible emits the canonical seed for every star (catalog site)', () => {
    // Tiny in-memory catalog: findVisible needs x/y/z + absMag; player sits ~10
    // pc away so appMag ≈ absMag and all fixtures pass the magnitude cut.
    const player = { x: 8.0, y: 0.0, z: 0.0 };
    const stars = [
      { name: 'Fixture A', x: 8.01, y: 0.002, z: -0.003, spect: 'G', absMag: 4.5 },
      { name: 'Fixture B', x: 7.99, y: -0.004, z: 0.006, spect: 'K', absMag: 3.0 },
      { name: 'Fixture C', x: 8.008, y: 0.0, z: 0.004, spect: 'M', absMag: 5.5 },
    ];
    const cat = new RealStarCatalog();
    cat.ingestCatalogData(stars, null, null);

    const visible = cat.findVisible(player, 20);
    expect(visible.length).toBe(stars.length);
    for (const v of visible) {
      expect(v.seed).toBe(realStarSeed(v.worldX, v.worldY, v.worldZ));
    }
  });
});
