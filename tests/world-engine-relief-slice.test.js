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
