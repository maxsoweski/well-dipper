// tests/worldengine-base-adaptl0.test.js
import { describe, it, expect } from 'vitest';
import { adaptL0, AGE_NORM_DIVISOR } from '../src/worldengine/base/adaptL0.js';
import { makeBaseStep } from '../src/worldengine/base/baseStep.js';

const grid = { n: 16, lat0Deg: 0, lat1Deg: 80, domainKm: 4000, seed: 'ad-1' };

// WS1 planetData (PhysicsEngine shape): density in kg/m³, age in Gyr, the six WS1 keys present.
const planetData = Object.freeze({
  radiusEarth: 1.0, massEarth: 1.0, T_eq: 288,
  composition: Object.freeze({ ironFraction: 0.32, density: 5500, volatileFraction: 0.15 }), // kg/m³!
  surfaceHistory: Object.freeze({ erosion: 0.4, resurfacing: 0.1, bombardment: 0.5 }),
  age: 4.5, metallicity: 0.0, magneticField: 0.32, eccentricity: 0.05, tidalHeating: 0.7,
  systemContext: Object.freeze({ siblings: [], moons: [],
    resonancePartners: [Object.freeze({ partnerIndex: 2, ratio: '2:1' })], companionClass: null }),
});

describe('worldengine base — F2 adaptL0', () => {
  it('maps all six WS1 keys with the right role; drops none', () => {
    const b = adaptL0(planetData);
    expect(b.tidalHeat).toBe(0.7);                          // <- tidalHeating
    expect(b.ageNorm).toBeCloseTo(4.5 / AGE_NORM_DIVISOR);  // <- age (Gyr) normalized
    expect(b.magneticField).toBe(planetData.magneticField); // === (single source)
    expect(b.metallicity).toBe(0.0);
    expect(b.eccentricity).toBe(0.05);                      // present (unused by heat)
    expect(b.systemContext).toBeDefined();
  });
  it('converts density kg/m³ -> g/cm³ so rockyCrust gates correctly', () => {
    const b = adaptL0(planetData);
    expect(b.composition.density).toBeCloseTo(5.5, 6);      // 5500/1000
    // and it actually flows: a silicate body reads rockyCrust ~1
    expect(makeBaseStep(b, grid).drivers.rockyCrust).toBeGreaterThan(0.9);
  });
  it('is pure/deterministic: two runs deep-equal; input not mutated; new nested objects', () => {
    const b1 = adaptL0(planetData); const b2 = adaptL0(planetData);
    expect(b1).toEqual(b2);
    expect(b1.composition).not.toBe(planetData.composition);   // new object -> bundle writes can't reach input
    expect(b1.surfaceHistory).not.toBe(planetData.surfaceHistory);
    expect(() => adaptL0(planetData)).not.toThrow();
  });
  it('systemContext round-trips through JSON; partnerIndex stays positional (number)', () => {
    const b = adaptL0(planetData);
    const round = JSON.parse(JSON.stringify(b.systemContext));
    expect(round).toEqual(b.systemContext);
    expect(typeof b.systemContext.resonancePartners[0].partnerIndex).toBe('number');
  });
  it('CALIBRATION: Earth~=0; all tidal in [0,1); strictly ordered Earth<Io<inner-moon<lava; no collapse', () => {
    const probes = { Earth: 1.74e-3, Io: 1.0, innerMoon: 249, lava: 7.82e5 };
    const cal = (h) => makeBaseStep(adaptL0({ ...planetData, tidalHeating: h }), grid).drivers.tidalHeat;
    const e = cal(probes.Earth), io = cal(probes.Io), im = cal(probes.innerMoon), lv = cal(probes.lava);
    expect(e).toBeLessThan(0.05);                 // Earth ~ 0
    for (const v of [e, io, im, lv]) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1); } // never exactly 1
    expect(e).toBeLessThan(io); expect(io).toBeLessThan(im); expect(im).toBeLessThan(lv); // strictly ordered
    expect(lv).not.toBe(im); expect(lv).not.toBe(1);          // no collapse to the same clamped extreme
  });
  it('AGE: young vs old differ (not both clamped); ageNorm in [0,1]', () => {
    const young = adaptL0({ ...planetData, age: 0.5 });
    const old = adaptL0({ ...planetData, age: 13.0 });
    expect(young.ageNorm).toBeGreaterThanOrEqual(0); expect(old.ageNorm).toBeLessThanOrEqual(1);
    expect(young.ageNorm).toBeLessThan(old.ageNorm);
    const dy = makeBaseStep(young, grid).drivers.despinAmp;
    const doo = makeBaseStep(old, grid).drivers.despinAmp;
    expect(dy).not.toBeCloseTo(doo, 3);          // despinAmp tracks age, not both saturated
  });
});
