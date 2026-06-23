// tests/world-engine-relief-slice.test.js
import { describe, it, expect } from 'vitest';
import { makeSubstrate, idx, latDegOfRow, cloneHeight, REGIME } from '../relief-substrate.js';

describe('ReliefSubstrate', () => {
  it('allocates co-registered typed arrays of n*n', () => {
    const s = makeSubstrate({ n: 64, lat0Deg: 0, lat1Deg: 80, domainKm: 4000 });
    expect(s.count).toBe(64 * 64);
    expect(s.height).toBeInstanceOf(Float32Array);
    expect(s.height.length).toBe(64 * 64);
    expect(s.regime).toBeInstanceOf(Uint8Array);
    expect(s.flowAccum.length).toBe(64 * 64);
  });
  it('indexes row-major', () => {
    const s = makeSubstrate({ n: 8, lat0Deg: 0, lat1Deg: 10, domainKm: 100 });
    expect(idx(s, 3, 2)).toBe(2 * 8 + 3);
  });
  it('maps rows to latitude linearly across the band', () => {
    const s = makeSubstrate({ n: 11, lat0Deg: 0, lat1Deg: 80, domainKm: 100 });
    expect(latDegOfRow(s, 0)).toBeCloseTo(0);
    expect(latDegOfRow(s, 10)).toBeCloseTo(80);
    expect(latDegOfRow(s, 5)).toBeCloseTo(40);
  });
  it('cloneHeight returns an independent copy', () => {
    const s = makeSubstrate({ n: 4, lat0Deg: 0, lat1Deg: 1, domainKm: 1 });
    s.height[0] = 5;
    const c = cloneHeight(s);
    s.height[0] = 9;
    expect(c[0]).toBe(5);
  });
  it('exposes the regime enum', () => {
    expect(REGIME.NORMAL).toBe(0); expect(REGIME.STRIKESLIP).toBe(1); expect(REGIME.THRUST).toBe(2);
  });
});

// append to tests/world-engine-relief-slice.test.js
import { makeBaseStep } from '../relief-base-step.js';
import { PRESETS } from '../relief-presets.js';

describe('base step', () => {
  const grid = { n: 32, lat0Deg: 0, lat1Deg: 80, domainKm: 4000, seed: 'rocky-1' };

  it('un-zeros D12: eccentric body gets nonzero tidalHeat; circular control is ~0', () => {
    const lava = makeBaseStep(PRESETS.lava, grid);
    const rocky = makeBaseStep(PRESETS.rocky, grid);
    expect(lava.drivers.tidalHeat).toBeGreaterThan(0);
    expect(lava.drivers.tidalHeat).toBeGreaterThan(rocky.drivers.tidalHeat);
  });
  it('derives a defined radial-strain sign (±1)', () => {
    const { drivers } = makeBaseStep(PRESETS.rocky, grid);
    expect(Math.abs(drivers.radialStrainSign)).toBe(1);
  });
  it('rockyCrust gates icy worlds toward 0 and silicate worlds toward 1', () => {
    const europa = makeBaseStep(PRESETS.europa, grid);
    const rocky = makeBaseStep(PRESETS.rocky, grid);
    expect(europa.drivers.rockyCrust).toBeLessThan(rocky.drivers.rockyCrust);
  });
  it('allocates a zero-initialised substrate of the requested size', () => {
    const { substrate } = makeBaseStep(PRESETS.rocky, grid);
    expect(substrate.count).toBe(32 * 32);
    expect(substrate.height.every(v => v === 0)).toBe(true);
  });
  it('crust thickness blob is a bounded 0..1 low-freq field', () => {
    const { crust } = makeBaseStep(PRESETS.rocky, grid);
    const v = crust.thicknessBlob(10, 12, 32);
    expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1);
  });
  it('does not throw on empty bundle', () => {
    expect(() => makeBaseStep({}, grid)).not.toThrow();
  });
});

// append to tests/world-engine-relief-slice.test.js
import { makeSubstrate as mkSub2, REGIME as RG, latDegOfRow as latRow } from '../relief-substrate.js';
import { stressAtLat, writeGrain } from '../relief-e6-tectonic.js';

describe('E6 Melosh latitude stress', () => {
  const drivers = { radialStrainSign: +1, radialStrainMag: 0, despinAmp: 1, surfaceGravity: 1 };
  it('equator → thrust (both horizontal stresses compressive)', () => {
    const r = stressAtLat(0, drivers);
    expect(r.regime).toBe(RG.THRUST);
  });
  it('pole → normal (both tensile)', () => {
    const r = stressAtLat(85, drivers);
    expect(r.regime).toBe(RG.NORMAL);
  });
  it('mid-latitude (~48°) → strike-slip (stresses straddle zero)', () => {
    const r = stressAtLat(48, drivers);
    expect(r.regime).toBe(RG.STRIKESLIP);
  });
  it('contraction sign biases toward thrust vs expansion toward normal at the same latitude', () => {
    const lat = 50;
    const contract = stressAtLat(lat, { ...drivers, radialStrainSign:+1, radialStrainMag:0.3 });
    const expand   = stressAtLat(lat, { ...drivers, radialStrainSign:-1, radialStrainMag:0.3 });
    // more compression under contraction → regime index >= expansion's (THRUST=2 > STRIKESLIP=1 > NORMAL=0)
    expect(contract.regime).toBeGreaterThanOrEqual(expand.regime);
  });
  it('writeGrain fills regime that varies across the latitude band', () => {
    const s = mkSub2({ n: 32, lat0Deg: 0, lat1Deg: 85, domainKm: 4000 });
    writeGrain(s, drivers);
    const regimes = new Set(Array.from(s.regime));
    expect(regimes.size).toBeGreaterThan(1);            // not a single regime everywhere
    expect(s.grainMag.some(v => v > 0)).toBe(true);
  });
});

import { runE6 } from '../relief-e6-tectonic.js';
import { makeBaseStep as mkBase4 } from '../relief-base-step.js';
import { PRESETS as P4 } from '../relief-presets.js';

describe('E6 runE6 builds relief', () => {
  const grid = { n: 48, lat0Deg: 0, lat1Deg: 80, domainKm: 4000, seed: 'e6-1' };
  it('writes nonzero, finite, varied relief', () => {
    const { substrate, crust, drivers } = mkBase4(P4.rocky, grid);
    runE6(substrate, crust, drivers, { name: 'tectonic-build' }, grid.seed);
    expect(substrate.height.every(Number.isFinite)).toBe(true);
    const min = Math.min(...substrate.height), max = Math.max(...substrate.height);
    expect(max - min).toBeGreaterThan(0);
  });
  it('low-gravity body gets larger relief amplitude than high-gravity (isostatic 1/√g cap)', () => {
    const lowG  = mkBase4({ ...P4.rocky, massEarth: 0.1, radiusEarth: 0.5 }, grid);   // g≈0.4
    const highG = mkBase4({ ...P4.rocky, massEarth: 4.0, radiusEarth: 1.2 }, grid);   // g≈2.8
    runE6(lowG.substrate, lowG.crust, lowG.drivers, { name:'tectonic-build' }, grid.seed);
    runE6(highG.substrate, highG.crust, highG.drivers, { name:'tectonic-build' }, grid.seed);
    const amp = (s) => Math.max(...s.height) - Math.min(...s.height);
    expect(amp(lowG.substrate)).toBeGreaterThan(amp(highG.substrate));
  });
  it('is deterministic for a fixed seed', () => {
    const a = mkBase4(P4.rocky, grid), b = mkBase4(P4.rocky, grid);
    runE6(a.substrate, a.crust, a.drivers, { name:'tectonic-build' }, 'seedX');
    runE6(b.substrate, b.crust, b.drivers, { name:'tectonic-build' }, 'seedX');
    expect(Array.from(a.substrate.height)).toEqual(Array.from(b.substrate.height));
  });
});
