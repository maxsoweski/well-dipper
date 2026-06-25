// tests/worldengine-base-substrate.test.js
import { describe, it, expect } from 'vitest';
import { clamp01, clamp, smoothstep, mix } from '../src/worldengine/base/mathutil.js';
import { REGIME, makeSubstrate, idx, latDegOfRow, cloneHeight } from '../src/worldengine/base/substrate.js';

describe('worldengine base — mathutil', () => {
  it('clamp01 clamps to [0,1]', () => {
    expect(clamp01(-3)).toBe(0); expect(clamp01(0.5)).toBe(0.5); expect(clamp01(9)).toBe(1);
  });
  it('smoothstep is 0 below, 1 above, 0.5 at midpoint', () => {
    expect(smoothstep(2.5, 3.9, 1)).toBe(0); expect(smoothstep(2.5, 3.9, 9)).toBe(1);
    expect(smoothstep(0, 1, 0.5)).toBeCloseTo(0.5, 6);
  });
  it('mix lerps', () => { expect(mix(2, 4, 0.5)).toBe(3); });
  it('clamp clamps value to [lo,hi] (arg order lo,hi,x)', () => {
    expect(clamp(0, 10, 15)).toBe(10); expect(clamp(0, 10, -1)).toBe(0); expect(clamp(0, 10, 5)).toBe(5);
  });
});

describe('worldengine base — substrate', () => {
  it('exposes the regime enum', () => {
    expect(REGIME.NORMAL).toBe(0); expect(REGIME.STRIKESLIP).toBe(1); expect(REGIME.THRUST).toBe(2);
  });
  it('allocates co-registered typed arrays of n*n with correct dtypes, zero-init', () => {
    const s = makeSubstrate({ n: 64, lat0Deg: 0, lat1Deg: 80, domainKm: 4000 });
    expect(s.count).toBe(64 * 64);
    for (const f of ['height','grainAngle','grainMag','faultDensity','flowAccum','baseLevel','maturity']) {
      expect(s[f]).toBeInstanceOf(Float32Array); expect(s[f].length).toBe(64 * 64);
      expect(s[f].every(v => v === 0)).toBe(true);
    }
    expect(s.regime).toBeInstanceOf(Uint8Array); expect(s.standing).toBeInstanceOf(Uint8Array);
    expect(s.regime.every(v => v === 0)).toBe(true);
    expect(s.standing.every(v => v === 0)).toBe(true);
    expect(s.count).toBe(s.n * s.n);
  });
  it('indexes row-major: idx(s,ix,iy) === iy*n+ix', () => {
    const s = makeSubstrate({ n: 8, lat0Deg: 0, lat1Deg: 10, domainKm: 100 });
    expect(idx(s, 3, 2)).toBe(2 * 8 + 3);
  });
  it('maps rows to latitude linearly: row0->lat0, lastRow->lat1', () => {
    const s = makeSubstrate({ n: 11, lat0Deg: 0, lat1Deg: 80, domainKm: 100 });
    expect(latDegOfRow(s, 0)).toBeCloseTo(0); expect(latDegOfRow(s, 10)).toBeCloseTo(80);
    expect(latDegOfRow(s, 5)).toBeCloseTo(40);
  });
  it('cloneHeight returns an independent deep copy', () => {
    const s = makeSubstrate({ n: 4, lat0Deg: 0, lat1Deg: 1, domainKm: 1 });
    s.height[0] = 5; const c = cloneHeight(s); s.height[0] = 9;
    expect(c[0]).toBe(5); expect(c).toBeInstanceOf(Float32Array);
  });
});
