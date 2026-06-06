// Unit tests for planet-lod-lab-core.js — the pure CPU-side foundation math
// that later grafts into production PlanetGenerator. Shader/visual behaviour is
// verified separately via chrome-devtools (:9223), not here.
import { describe, it, expect } from 'vitest';
import { lodRampOf, autoOctaves, lodHysteresis } from '../planet-lod-lab-core.js';

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
