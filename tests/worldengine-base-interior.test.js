// tests/worldengine-base-interior.test.js
import { describe, it, expect } from 'vitest';
import { makeBaseStep } from '../src/worldengine/base/baseStep.js';
import { runE6 } from '../src/worldengine/base/tectonic.js';
import { makeSubstrate, idx } from '../src/worldengine/base/substrate.js';
import { LOVE_K2_RANGE } from '../src/worldengine/base/adaptL0.js';

const grid = { n: 32, lat0Deg: 0, lat1Deg: 80, domainKm: 4000, seed: 'f5-1' };

describe('worldengine base — F5 interior fields', () => {
  it('crustalThickness field is finite, in [0,1], and low-frequency for all 5 presets', async () => {
    const { PRESETS } = await import('../relief-presets.js');
    for (const name of ['rocky','lava','magma','europa','terrestrial']) {
      const { crust } = makeBaseStep(PRESETS[name], grid);
      const ct = crust.crustalThickness;
      expect(ct).toBeInstanceOf(Float32Array); expect(ct.length).toBe(32 * 32);
      let maxNeighborDelta = 0;
      for (let iy = 0; iy < 32; iy++) for (let ix = 0; ix < 32; ix++) {
        const v = ct[iy * 32 + ix];
        expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1);
        if (ix < 31) maxNeighborDelta = Math.max(maxNeighborDelta, Math.abs(v - ct[iy * 32 + ix + 1]));   // horizontal
        if (iy < 31) maxNeighborDelta = Math.max(maxNeighborDelta, Math.abs(v - ct[(iy + 1) * 32 + ix])); // vertical
      }
      expect(maxNeighborDelta).toBeLessThan(0.35); // low-freq: no high-frequency jumps in either axis
    }
  });
  it('interior scalars are bounded against written ranges and physically ordered', () => {
    const young = makeBaseStep({ radiusEarth: 1.2, massEarth: 1.5, ageNorm: 0.05, tidalHeat: 1.0, composition: { density: 5.5 } }, grid);
    const old = makeBaseStep({ radiusEarth: 0.6, massEarth: 0.3, ageNorm: 0.95, tidalHeat: 0, composition: { density: 2.0 } }, grid);
    // shellThickness rises with gravity, falls with age
    expect(young.crust.shellThickness).toBeGreaterThan(old.crust.shellThickness);
    // thermalState(young+heated) > thermalState(old+cold)
    expect(young.crust.thermalState).toBeGreaterThan(old.crust.thermalState);
    expect(young.crust.thermalState).toBeGreaterThanOrEqual(0); expect(young.crust.thermalState).toBeLessThanOrEqual(1);
    // loveK2 within declared [min,max]
    for (const r of [young, old]) {
      expect(r.crust.loveK2).toBeGreaterThanOrEqual(LOVE_K2_RANGE.min);
      expect(r.crust.loveK2).toBeLessThanOrEqual(LOVE_K2_RANGE.max);
    }
    // shellThickness gravity dependence isolated (hold age fixed, vary gravity strongly)
    const hiG = makeBaseStep({ radiusEarth: 1, massEarth: 8, ageNorm: 0.5, composition: { density: 5.5 } }, grid);
    const loG = makeBaseStep({ radiusEarth: 1, massEarth: 0.3, ageNorm: 0.5, composition: { density: 5.5 } }, grid);
    expect(hiG.crust.shellThickness).toBeGreaterThan(loG.crust.shellThickness);
  });
  it('interior fields are deterministic (byte-identical across two builds)', () => {
    const a = makeBaseStep({ radiusEarth: 1, massEarth: 1, ageNorm: 0.4, tidalHeat: 0.3, composition: { density: 5.5 } }, grid);
    const b = makeBaseStep({ radiusEarth: 1, massEarth: 1, ageNorm: 0.4, tidalHeat: 0.3, composition: { density: 5.5 } }, grid);
    expect(Array.from(a.crust.crustalThickness)).toEqual(Array.from(b.crust.crustalThickness));
    expect(a.crust.loveK2).toBe(b.crust.loveK2); expect(a.crust.thermalState).toBe(b.crust.thermalState);
  });
});

describe('worldengine base — F5 crust drives E6 (integration)', () => {
  it('higher crustalThickness -> higher post-E6 plateau height, all else equal', () => {
    const drivers = { despinAmp: 1, radialStrainSign: +1, radialStrainMag: 0, surfaceGravity: 1, rockyCrust: 1,
                      useDiscriminator: false, discriminator: '1:sil' };
    const mk = (thick) => {
      const s = makeSubstrate({ n: 32, lat0Deg: 0, lat1Deg: 10, domainKm: 1 });
      const crust = { shellThickness: 0.5, thicknessBlob: () => thick };  // constant high vs low thickness
      runE6(s, crust, drivers, { name: 'tectonic-build' }, 'e6-fixed');
      let sum = 0; for (let i = 0; i < s.height.length; i++) sum += s.height[i];
      return sum / s.height.length;
    };
    expect(mk(0.95)).toBeGreaterThan(mk(0.40)); // thick crust uplifts (plateau term), thin does not
  });
});
