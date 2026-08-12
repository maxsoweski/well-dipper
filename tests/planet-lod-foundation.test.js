// Unit tests for planet-lod-lab-core.js — the pure CPU-side foundation math
// that later grafts into production PlanetGenerator. Shader/visual behaviour is
// verified separately via chrome-devtools (:9223), not here.
import { describe, it, expect } from 'vitest';
import { lodRampOf, autoOctaves, lodHysteresis, qualityKnobs, deriveUniforms } from '../src/worldengine/base/labCore.js';

describe('lodRampOf', () => {
  it('is 0 at/over the far edge (>=20 radii)', () => {
    expect(lodRampOf(20)).toBe(0);
    expect(lodRampOf(30)).toBe(0);
  });
  it('is 1 at/under the near edge (<=6 radii)', () => {
    expect(lodRampOf(6)).toBe(1);
    expect(lodRampOf(1.1)).toBe(1);
  });
  it('rises monotonically as distance shrinks', () => {
    expect(lodRampOf(10)).toBeGreaterThan(lodRampOf(15));
  });
});

describe('autoOctaves', () => {
  it('is 4 at far (lodRamp 0)', () => expect(autoOctaves(0)).toBe(4));
  it('is 9 at near (lodRamp 1, full quality)', () => expect(autoOctaves(1, 1.0)).toBe(9));
  it('trims LOD2 octaves at low qualityTier', () => {
    expect(autoOctaves(1, 0.0)).toBe(4);          // no LOD2 octaves on weakest GPU
    expect(autoOctaves(1, 0.5)).toBeCloseTo(6.5); // half the ramp
  });
});

describe('lodHysteresis (enter 18 / exit 22 radii)', () => {
  it('activates only inside 18 when previously inactive', () => {
    expect(lodHysteresis(19, false)).toBe(false); // in dead-band, stays off
    expect(lodHysteresis(17, false)).toBe(true);  // crossed enter threshold
  });
  it('stays active through the dead-band until past 22', () => {
    expect(lodHysteresis(20, true)).toBe(true);   // in dead-band, holds on
    expect(lodHysteresis(23, true)).toBe(false);  // crossed exit threshold
  });
  it('has a non-flickering dead-band: same distance, opposite states', () => {
    expect(lodHysteresis(20, true)).toBe(true);
    expect(lodHysteresis(20, false)).toBe(false);
  });
});

describe('qualityKnobs (graceful-mobile scalar)', () => {
  it('full desktop tier → 27-cell craters, raymarch atmosphere, 9 octaves', () => {
    const k = qualityKnobs(1.0);
    expect(k.craterCells).toBe(27);
    expect(k.atmosphereModel).toBe('raymarch');
    expect(k.maxOctaves).toBe(9);
  });
  it('low tier → 9-cell craters, fresnel atmosphere, 4 octaves', () => {
    const k = qualityKnobs(0.0);
    expect(k.craterCells).toBe(9);
    expect(k.atmosphereModel).toBe('fresnel');
    expect(k.maxOctaves).toBe(4);
  });
});

describe('deriveUniforms (physics drivers → semantic uniforms, no type branch)', () => {
  const hotAirless = { composition: { ironFraction: 0.7, density: 7 }, T_eq: 900, tidalState: { locked: true, lockType: 'synchronous' }, atmosphere: null, habitability: 0, surfaceHistory: { erosion: 0 } };
  const oceanWorld = { composition: { ironFraction: 0.3, density: 5 }, T_eq: 290, tidalState: { locked: false }, atmosphere: { color: [0.5, 0.5, 0.8] }, habitability: 0.8, surfaceHistory: { erosion: 0.6 } };

  it('hot body emits; cool body does not', () => {
    // The flat `emissive` is a faint thermal FLOOR — since F8 the lava glow is SPATIAL
    // (the crack-mask term driven by lavaActivity), so a hot body still emits (>0) but
    // the magnitude moved to the crack channel. Cool bodies stay dark.
    expect(deriveUniforms(hotAirless).emissive).toBeGreaterThan(0);
    expect(deriveUniforms(oceanWorld).emissive).toBeLessThan(0.1);
  });
  it('airless body has no limb glow; atmo body does', () => {
    expect(deriveUniforms(hotAirless).limbStrength).toBe(0);
    expect(deriveUniforms(oceanWorld).limbStrength).toBeGreaterThan(0);
  });
  it('liquid-water temperature + atmosphere → strong specular', () => {
    expect(deriveUniforms(oceanWorld).specStrength).toBeGreaterThan(0.5);
    expect(deriveUniforms(hotAirless).specStrength).toBeLessThan(0.2);
  });
  it('tidal lock cuts aurora (magnetic-field proxy)', () => {
    const locked = deriveUniforms({ ...oceanWorld, tidalState: { locked: true, lockType: 'synchronous' } });
    const free = deriveUniforms(oceanWorld);
    expect(locked.auroraIntensity).toBeLessThan(free.auroraIntensity);
  });
  it('erosion softens relief amplitude', () => {
    expect(deriveUniforms(oceanWorld).reliefAmplitude).toBeLessThan(deriveUniforms(hotAirless).reliefAmplitude);
  });
  it('passes qualityTier knobs through', () => {
    expect(deriveUniforms(oceanWorld, 0.0).craterCells).toBe(9);
    expect(deriveUniforms(oceanWorld, 1.0).craterCells).toBe(27);
  });
  it('does not throw on an empty/partial driver bundle', () => {
    expect(() => deriveUniforms({})).not.toThrow();
    expect(() => deriveUniforms(null)).not.toThrow();
  });
});
