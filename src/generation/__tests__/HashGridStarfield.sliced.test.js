// HashGridStarfield.prismQuery — the resumable prism query (naming-prism-segments Phase 3, AC-6).
//
// The PRISM loader runs the cell scan in slices under a frame deadline. Slicing must change NOTHING
// about what is generated: a query stopped and resumed at arbitrary points returns the very records
// an unsliced run returns, in the same order, and `findStarsInPrism` (now the query run in one go)
// still hashes to the Phase 1 baselines (HashGridStarfield.identity.test.js). The `extent` option
// (the bright-star fix) only visits MORE cells: every star it adds is inside the box, and every
// star the default finds, it finds too.

import { describe, it, expect } from 'vitest';
import { GalacticMap } from '../GalacticMap.js';
import { HashGridStarfield } from '../HashGridStarfield.js';

const gm = new GalacticMap('well-dipper-galaxy-1');
const rec = (s) => [s.worldX, s.worldY, s.worldZ, s.seed, s.type, s.dist, s.key];

/** Run a query, stopping every `every`-th deadline check (a pseudo-random stop pattern). */
function sliced(center, xzHalf, yHalf, opts, every) {
  const q = HashGridStarfield.prismQuery(gm, center, xzHalf, yHalf, opts);
  let calls = 0, slices = 0;
  const stop = () => (++calls % every) === 0;
  while (!q.step(stop)) slices++;
  return { q, slices };
}

const CASES = [
  ['Sol slab N1', { x: 8.00000, y: 0.05, z: 0 }, 0.00390625, 0.05],
  ['inner slab S2', { x: 1.5, y: -0.15, z: 0.2 }, 0.00390625, 0.05],
  ['rim', { x: -11.7678, y: 0.05, z: -12.2816 }, 0.00390625, 0.05],
];

describe('prismQuery: slicing changes nothing', () => {
  for (const [name, c, xz, y] of CASES) {
    it(`${name}: stopped and resumed at arbitrary points = one unsliced run (both cell tests)`, () => {
      for (const extent of [false, true]) {
        const whole = HashGridStarfield.prismQuery(gm, c, xz, y, { extent });
        expect(whole.step(null)).toBe(true);
        for (const every of [1, 2, 7, 53]) {
          const { q, slices } = sliced(c, xz, y, { extent }, every);
          expect(slices, 'the query never stopped — the case is vacuous').toBeGreaterThan(every === 53 ? 5 : 50);
          expect(q.results.map(rec)).toEqual(whole.results.map(rec));
          expect(q.cellsVisited).toBe(whole.cellsVisited);
        }
      }
    }, 60000);
  }

  it('findStarsInPrism IS the query run to completion, then sorted and truncated', () => {
    const [, c, xz, y] = CASES[0];
    const q = HashGridStarfield.prismQuery(gm, c, xz, y); q.step(null);
    const expected = q.results.slice().sort((a, b) => a.dist - b.dist).map(rec);
    expect(HashGridStarfield.findStarsInPrism(gm, c, xz, y, 50000).map(rec)).toEqual(expected);
    expect(HashGridStarfield.findStarsInPrism(gm, c, xz, y, 10).map(rec)).toEqual(expected.slice(0, 10));
  }, 60000);
});

describe('prismQuery extent mode (the bright-star fix, plan §8)', () => {
  it('finds every star the default finds, adds only stars inside the box, and does add coarse-tier stars', () => {
    let added = 0, coarseAdded = 0;
    // a column of slabs at the inner galaxy, where O / giant cells (50–74 pc) are common
    for (let k = -6; k < 6; k++) {
      const c = { x: 1.5, y: (k + 0.5) * 0.1, z: 0.2 };
      const a = HashGridStarfield.prismQuery(gm, c, 0.00390625, 0.05); a.step(null);
      const b = HashGridStarfield.prismQuery(gm, c, 0.00390625, 0.05, { extent: true }); b.step(null);
      const bk = new Set(b.results.map((s) => s.key));
      for (const s of a.results) expect(bk.has(s.key), `${s.key} lost by the extent test`).toBe(true);
      const ak = new Set(a.results.map((s) => s.key));
      for (const s of b.results) {
        expect(Math.abs(s.worldX - c.x) <= 0.00390625 && Math.abs(s.worldY - c.y) <= 0.05 && Math.abs(s.worldZ - c.z) <= 0.00390625).toBe(true);
        if (!ak.has(s.key)) { added++; if (['O', 'Kg', 'Gg', 'Mg', 'B'].includes(s.type)) coarseAdded++; }
      }
    }
    expect(added, 'the extent test found nothing the centre test missed — the case is vacuous').toBeGreaterThan(0);
    expect(coarseAdded, 'no bright / coarse-tier star was recovered').toBeGreaterThan(0);
  }, 60000);
});
