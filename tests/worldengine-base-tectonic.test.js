// tests/worldengine-base-tectonic.test.js
import { describe, it, expect } from 'vitest';
import { stressAtLat, writeGrain, NU } from '../src/worldengine/base/tectonic.js';
import { makeSubstrate, REGIME, idx } from '../src/worldengine/base/substrate.js';

const neutral = { despinAmp: 1, radialStrainSign: 1, radialStrainMag: 0 };

describe('worldengine base — F4 stress/regime oracle', () => {
  it('regime follows the latitude band oracle at neutral strain', () => {
    expect(stressAtLat(0, neutral).regime).toBe(REGIME.THRUST);     // equator
    expect(stressAtLat(48, neutral).regime).toBe(REGIME.STRIKESLIP);// mid-lat (between 38.4 and 57.3)
    expect(stressAtLat(85, neutral).regime).toBe(REGIME.NORMAL);    // pole
  });
  it('contraction (+1) biases THRUST vs expansion (-1) at fixed latitude', () => {
    const c = stressAtLat(50, { despinAmp: 1, radialStrainSign: +1, radialStrainMag: 0.3 });
    const e = stressAtLat(50, { despinAmp: 1, radialStrainSign: -1, radialStrainMag: 0.3 });
    expect(c.regime).toBeGreaterThanOrEqual(e.regime); // THRUST(2) >= ... toward thrust under contraction
    // whole-field fractions
    const sC = makeSubstrate({ n: 64, lat0Deg: 0, lat1Deg: 90, domainKm: 1 });
    const sE = makeSubstrate({ n: 64, lat0Deg: 0, lat1Deg: 90, domainKm: 1 });
    writeGrain(sC, { despinAmp: 1, radialStrainSign: +1, radialStrainMag: 0.3 });
    writeGrain(sE, { despinAmp: 1, radialStrainSign: -1, radialStrainMag: 0.3 });
    const frac = (s, r) => Array.from(s.regime).filter(v => v === r).length / s.regime.length;
    expect(frac(sC, REGIME.THRUST)).toBeGreaterThan(frac(sE, REGIME.THRUST));
    expect(frac(sE, REGIME.NORMAL)).toBeGreaterThan(frac(sC, REGIME.NORMAL));
  });
});

describe('worldengine base — F4 grain', () => {
  it('grainAngle is quantized 0 / pi/2 per the |sMer|>=|sZon| rule (flips at 45deg)', () => {
    const a = stressAtLat(10, neutral);
    expect(a.grainAngle).toBe(Math.abs(a.sMer) >= Math.abs(a.sZon) ? 0 : Math.PI / 2);
    expect(stressAtLat(30, neutral).grainAngle).toBe(Math.PI / 2); // below 45deg: |sZon| dominates
    expect(stressAtLat(60, neutral).grainAngle).toBe(0);           // above 45deg: |sMer| dominates
  });
  it('grainMag in [0,1] tracking hypot(sMer,sZon)/(1+NU); >=2 distinct regimes per field', () => {
    const s = makeSubstrate({ n: 48, lat0Deg: 0, lat1Deg: 90, domainKm: 1 });
    writeGrain(s, neutral);
    for (let i = 0; i < s.grainMag.length; i++) {
      expect(s.grainMag[i]).toBeGreaterThanOrEqual(0); expect(s.grainMag[i]).toBeLessThanOrEqual(1);
    }
    const distinct = new Set(Array.from(s.regime));
    expect(distinct.size).toBeGreaterThanOrEqual(2);
    // spot-check the formula at one row
    const { sMer, sZon } = stressAtLat(0, neutral);
    expect(s.grainMag[idx(s, 0, 0)]).toBeCloseTo(Math.min(1, Math.hypot(sMer, sZon) / (1 + NU)), 5);
  });
  it('is deterministic: writeGrain twice -> byte-identical arrays', () => {
    const mk = () => { const s = makeSubstrate({ n: 40, lat0Deg: 0, lat1Deg: 80, domainKm: 1 }); writeGrain(s, neutral); return s; };
    const a = mk(), b = mk();
    expect(Array.from(a.grainAngle)).toEqual(Array.from(b.grainAngle));
    expect(Array.from(a.grainMag)).toEqual(Array.from(b.grainMag));
    expect(Array.from(a.regime)).toEqual(Array.from(b.regime));
  });
  it('builds >=2 regimes, quantized grain, bounded grainMag, byte-identical for the 5 presets', async () => {
    const { makeBaseStep } = await import('../src/worldengine/base/baseStep.js');
    const { PRESETS } = await import('../relief-presets.js');
    const grid = { n: 40, lat0Deg: 0, lat1Deg: 80, domainKm: 4000, seed: 'tec-presets' };
    for (const name of ['rocky', 'lava', 'magma', 'europa', 'terrestrial']) {
      const mk = () => { const o = makeBaseStep(PRESETS[name], grid); writeGrain(o.substrate, o.drivers); return o.substrate; };
      const s1 = mk(), s2 = mk();
      expect(new Set(Array.from(s1.regime)).size).toBeGreaterThanOrEqual(2);
      for (let i = 0; i < s1.grainAngle.length; i++) expect([0, Math.fround(Math.PI / 2)]).toContain(s1.grainAngle[i]); // grainAngle is read back from a Float32Array, so compare against the fround'd pi/2
      for (let i = 0; i < s1.grainMag.length; i++) { expect(s1.grainMag[i]).toBeGreaterThanOrEqual(0); expect(s1.grainMag[i]).toBeLessThanOrEqual(1); }
      expect(Array.from(s1.regime)).toEqual(Array.from(s2.regime));
      expect(Array.from(s1.grainAngle)).toEqual(Array.from(s2.grainAngle));
    }
  });
});
