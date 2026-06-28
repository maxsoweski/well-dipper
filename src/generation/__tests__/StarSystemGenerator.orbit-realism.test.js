import { describe, it, expect } from 'vitest';
import { StarSystemGenerator } from '../StarSystemGenerator.js';

/**
 * Procedural orbital speeds must be physically realistic — anchored on the
 * Mercury reference (0.387 AU = 88-day period), NOT on the per-system visual
 * map base. Regression for the 2026-06-28 bug where `orbitSpeed` was anchored
 * on `adjustedInnerAU` (a visual-layout quantity), making planets orbit
 * 1.6×–100× too fast depending on stellar luminosity/binarity, so a parked
 * sublight ship saw planets visibly drift away (Sol, hand-authored, was fine).
 *
 * Realistic Kepler period (Sun-mass): P(years) = a(AU)^1.5.
 * sim period (real seconds at multiplier 1) = 2π / orbitSpeed.
 */
const YEAR_S = 365.25 * 86400;

describe('StarSystemGenerator — orbital speeds are physically realistic', () => {
  // Seeds chosen to span luminosity + binarity (the bug's worst cases were
  // high-luminosity and binary systems, where adjustedInnerAU is far from 0.387).
  const seeds = ['alpha', 'bravo', 'charlie', 'echo', 'foxtrot', 'golf', 'hotel', 'india'];

  it('every procedural planet orbits within ±~30% of its real Kepler period', () => {
    let checked = 0;
    for (const seed of seeds) {
      const sys = StarSystemGenerator.generate(seed);
      for (const p of sys.planets || []) {
        const periodYr = (2 * Math.PI) / Math.abs(p.orbitSpeed) / YEAR_S;
        const keplerYr = Math.pow(p.orbitRadiusAU, 1.5);
        const ratio = periodYr / keplerYr;
        // ±20% per-planet jitter in the generator → allow [0.7, 1.4].
        expect(
          ratio,
          `seed=${seed} AU=${p.orbitRadiusAU.toFixed(3)} sim=${periodYr.toFixed(2)}yr kepler=${keplerYr.toFixed(2)}yr ratio=${ratio.toFixed(2)}`,
        ).toBeGreaterThan(0.7);
        expect(ratio).toBeLessThan(1.4);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(5); // ensure we actually exercised planets
  });
});
