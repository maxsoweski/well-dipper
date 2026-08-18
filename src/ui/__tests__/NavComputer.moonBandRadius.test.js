import { describe, it, expect } from 'vitest';
import { moonBandRadius } from '../NavComputer.js';

/**
 * Regression guard for a bug that shipped for a long time and read as correct.
 *
 * The system view computed a moon's drawn distance as
 *     moonOrbitWorld * ((baseR + 6 + m*4) / (moonOrbitWorld * projScale))
 * in which `moonOrbitWorld` — the ONLY term carrying the moon's real orbit radius —
 * cancels exactly, leaving a function of the parent's radius and the moon's INDEX.
 * The comment above it said "use actual orbit data", so reading the code near the
 * top of the block confirmed the intent rather than the arithmetic.
 *
 * These tests fail on the cancelling form and pass on the band form.
 */
describe('moonBandRadius — the real orbit radius must not cancel', () => {
  const baseR = 8, projScale = 2;

  it('two moons at the SAME INDEX but different orbits draw at different distances', () => {
    // This is the assertion the old form could not satisfy at any index.
    const near = [{ orbitRadiusEarth: 6 }, { orbitRadiusEarth: 75 }];
    const far  = [{ orbitRadiusEarth: 70 }, { orbitRadiusEarth: 75 }];
    expect(moonBandRadius(near, 0, baseR, projScale))
      .not.toBeCloseTo(moonBandRadius(far, 0, baseR, projScale), 6);
  });

  it('preserves order: an outer moon never draws inside an inner one', () => {
    const moons = [{ orbitRadiusEarth: 6 }, { orbitRadiusEarth: 20 }, { orbitRadiusEarth: 75 }];
    const r = moons.map((_, i) => moonBandRadius(moons, i, baseR, projScale));
    expect(r[0]).toBeLessThan(r[1]);
    expect(r[1]).toBeLessThan(r[2]);
  });

  it('spacing is proportional to the real orbit, not to the index', () => {
    // Equal index steps, wildly unequal orbits => unequal drawn gaps.
    const moons = [{ orbitRadiusEarth: 4 }, { orbitRadiusEarth: 9 }, { orbitRadiusEarth: 400 }];
    const r = moons.map((_, i) => moonBandRadius(moons, i, baseR, projScale));
    expect(r[2] - r[1]).toBeGreaterThan((r[1] - r[0]) * 2);
  });

  it('the outermost moon lands where index-based drawing put it (extent unchanged)', () => {
    const moons = [{ orbitRadiusEarth: 6 }, { orbitRadiusEarth: 20 }, { orbitRadiusEarth: 75 }];
    const legacyOutermost = (baseR + 6 + (moons.length - 1) * 4) / projScale;
    expect(moonBandRadius(moons, moons.length - 1, baseR, projScale)).toBeCloseTo(legacyOutermost, 9);
  });

  it('every moon is drawn clear of the planet dot', () => {
    const moons = [{ orbitRadiusEarth: 0.001 }, { orbitRadiusEarth: 75 }];
    for (let i = 0; i < moons.length; i++) {
      expect(moonBandRadius(moons, i, baseR, projScale) * projScale).toBeGreaterThan(baseR);
    }
  });

  it('falls back without throwing when orbitRadiusEarth is missing', () => {
    const moons = [{}, {}, {}];
    const r = moons.map((_, i) => moonBandRadius(moons, i, baseR, projScale));
    r.forEach((v) => expect(Number.isFinite(v)).toBe(true));
    expect(r[0]).toBeLessThan(r[2]);
  });
});
