// tests/worldengine-base-interface.test.js
import { describe, it, expect } from 'vitest';
import { makeBaseStep } from '../src/worldengine/base/baseStep.js';
import { calibrateTidal } from '../src/worldengine/base/adaptL0.js';

const grid = { n: 32, lat0Deg: 0, lat1Deg: 80, domainKm: 4000, seed: 'iface-1' };
const DRIVER_KEYS = ['tidalHeat','surfaceGravity','rockyCrust','surfaceHistory','age',
  'radialStrainSign','radialStrainMag','despinAmp','discriminator','useDiscriminator',
  'liquidStability','liquidSpecies','rainFactor'];

// a WS1-shaped planetData fixture in *bundle* form (already adapted) — the base step reads these
const bundleFixture = {
  radiusEarth: 1.0, massEarth: 1.0, eccentricity: 0.05, starMassEarth: 332946,
  orbitRadiusEarth: 1200, age: 0.45, T_eq: 288,
  composition: { density: 5.5, volatileFraction: 0.15 }, surfaceHistory: { erosion: 0.4 },
};

describe('worldengine base — F1 interface', () => {
  it('downstream stub destructures every driver + crust + substrate field with no undefined', () => {
    const { drivers, crust, substrate } = makeBaseStep(bundleFixture, grid);
    for (const k of DRIVER_KEYS) expect(drivers[k]).toBeDefined();
    // types
    for (const k of ['tidalHeat','surfaceGravity','rockyCrust','surfaceHistory','age','radialStrainMag','despinAmp','liquidStability']) {
      expect(typeof drivers[k]).toBe('number'); expect(Number.isFinite(drivers[k])).toBe(true);
    }
    expect([1, -1]).toContain(drivers.radialStrainSign);
    expect(typeof drivers.discriminator).toBe('string');
    expect(typeof drivers.useDiscriminator).toBe('boolean');
    expect([0, 1]).toContain(drivers.liquidSpecies);
    // crust accessor is a FUNCTION returning [0,1]
    expect(typeof crust.shellThickness).toBe('number');
    const blob = crust.thicknessBlob(10, 12, 32);
    expect(blob).toBeGreaterThanOrEqual(0); expect(blob).toBeLessThanOrEqual(1);
    // substrate fields readable
    for (const f of ['height','grainAngle','grainMag','regime','faultDensity','flowAccum','baseLevel','standing','maturity']) {
      expect(substrate[f].length).toBe(32 * 32);
    }
  });
  it('does not throw on an empty bundle (all ?? defaults)', () => {
    expect(() => makeBaseStep({}, grid)).not.toThrow();
    expect(() => makeBaseStep(undefined, grid)).not.toThrow();
  });
  it('bounded drivers sit in [0,1]; radialStrainSign in {-1,+1}; over 5 presets + empty', async () => {
    const { PRESETS } = await import('../relief-presets.js');
    for (const b of [PRESETS.rocky, PRESETS.lava, PRESETS.magma, PRESETS.europa, PRESETS.terrestrial, {}]) {
      const { drivers } = makeBaseStep(b, grid);
      for (const k of ['tidalHeat','rockyCrust','radialStrainMag','despinAmp','liquidStability']) {
        expect(drivers[k]).toBeGreaterThanOrEqual(0); expect(drivers[k]).toBeLessThanOrEqual(1);
      }
      expect([1, -1]).toContain(drivers.radialStrainSign);
    }
  });
  it('TIDAL PRECEDENCE: present tidalHeat traces to it (calibrated), invariant to ecc/orbit', () => {
    const base = { ...bundleFixture, eccentricity: 0.3, orbitRadiusEarth: 200 }; // Io-formula would be large
    const a = makeBaseStep({ ...base, tidalHeat: 1.0 }, grid).drivers.tidalHeat;
    const b = makeBaseStep({ ...base, tidalHeat: 10.0 }, grid).drivers.tidalHeat;
    expect(a).toBeCloseTo(calibrateTidal(1.0), 10);   // traces to upstream, ignores ecc/orbit
    expect(b).toBeGreaterThan(a);                       // monotonic in upstream value
  });
  it('TIDAL FALLBACK: absent tidalHeat -> finite, >=0, no throw (Io-formula self-derivation)', () => {
    const r = makeBaseStep({ ...bundleFixture, tidalHeat: undefined }, grid).drivers.tidalHeat;
    expect(Number.isFinite(r)).toBe(true); expect(r).toBeGreaterThanOrEqual(0);
  });
});
