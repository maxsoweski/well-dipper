// Time-budget pacing for HashGridStarfield generation (warp FOLD stutter fix).
//
// The destination sky starfield is generated during warp FOLD via
// generateAsync(). The iterator used to yield only every 4 radial shells,
// and one 4-shell chunk of potentialDerivedDensity work costs ~250ms —
// producing 14-16 frames of 250-270ms during every FOLD. The fix paces
// yields by elapsed time instead of shell count: the iterator checks an
// injectable clock per surface cell and yields whenever more than
// `budgetMs` has elapsed since the last yield.
import { describe, it, expect } from 'vitest';
import { HashGridStarfield } from '../src/generation/HashGridStarfield.js';

const ORIGIN = { x: 0, y: 0, z: 0 };
// Small custom search: 10 shells, every cell inside galaxy bounds.
const CFG = { cell: 0.2, maxDist: 2, acceptNorm: 0.5 };
const THRESHOLD = 30; // generous, so the magnitude break never ends the search early

function makeFakeMap(onDensity) {
  return {
    findNearbyFeatures: () => [],
    potentialDerivedDensity: () => {
      onDensity?.();
      return { totalDensity: 0.14, halo: 0, bulge: 0 };
    },
    spiralArmStrength: () => 0,
    nearestArmInfo: () => null,
    starTypeDensityMultiplier: () => 1,
  };
}

describe('HashGridStarfield time-budget pacing', () => {
  it('yields within a shell once the time budget is exceeded', () => {
    let t = 0;
    const map = makeFakeMap(() => { t += 5; }); // each density eval costs 5 fake-ms
    const pacing = { budgetMs: 8, now: () => t };
    const iter = HashGridStarfield._searchTypeIterator(
      map, ORIGIN, [], [], 'G', CFG, THRESHOLD, pacing
    );
    const yieldGaps = [];
    let lastYieldT = 0;
    while (!iter.next().done) {
      yieldGaps.push(t - lastYieldT);
      lastYieldT = t;
    }
    // Many yields — pacing fires inside shells, not just at shell boundaries
    expect(yieldGaps.length).toBeGreaterThan(10);
    // No gap exceeds the budget by more than one in-flight cell's cost
    expect(Math.max(...yieldGaps)).toBeLessThanOrEqual(8 + 5);
  });

  it('does not yield at all when work stays under budget', () => {
    const pacing = { budgetMs: 8, now: () => 0 }; // clock never advances
    const iter = HashGridStarfield._searchTypeIterator(
      makeFakeMap(), ORIGIN, [], [], 'G', CFG, THRESHOLD, pacing
    );
    let yields = 0;
    while (!iter.next().done) yields++;
    expect(yields).toBe(0);
  });

  it('generateAsync returns the same stars as synchronous generate', async () => {
    const pos = { x: 8, y: 0, z: 0 };
    const sync = HashGridStarfield.generate(makeFakeMap(), pos, 500);
    const async_ = await HashGridStarfield.generateAsync(makeFakeMap(), pos, 500);
    expect(async_.count).toBe(sync.count);
    expect(Array.from(async_.positions)).toEqual(Array.from(sync.positions));
  });
});
