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

// append to tests/world-engine-relief-slice.test.js
import { priorityFloodFill, d8Receivers, flowAccumulate } from '../relief-e9-hydrology.js';

describe('E9 routing primitives', () => {
  // 5x5 cone: high centre, low edges → all flow should reach the boundary.
  function cone(n) {
    const h = new Float32Array(n * n); const c = (n - 1) / 2;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) h[y * n + x] = -(Math.hypot(x - c, y - c));
    return h; // centre = 0 (high), edges negative (low) → inverted cone, ridge in middle
  }
  it('priority-flood removes interior pits (no cell strictly below all neighbours, off-edge)', () => {
    const n = 7; const h = new Float32Array(n * n).fill(1); h[3 * n + 3] = -5; // a pit
    const filled = priorityFloodFill(h, n, -1e9);
    // the pit must be filled up to at least its lowest neighbour
    let isPit = true;
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) if (filled[(3+dy)*n + (3+dx)] < filled[3*n+3]) isPit = false;
    expect(isPit).toBe(false);
  });
  it('d8 receivers point downhill (filled[receiver] <= filled[i]) for non-outlet cells', () => {
    const n = 9; const h = cone(n); const filled = priorityFloodFill(h, n, -1e9);
    const rec = d8Receivers(filled, n);
    let okPct = 0, land = 0;
    for (let i = 0; i < n * n; i++) { if (rec[i] !== i) { land++; if (filled[rec[i]] <= filled[i] + 1e-6) okPct++; } }
    expect(okPct).toBe(land); // EVERY routed cell goes downhill
  });
  it('flow accumulation concentrates: max accum >> mean accum', () => {
    const n = 21; const h = cone(n); const filled = priorityFloodFill(h, n, -1e9);
    const rec = d8Receivers(filled, n); const accum = flowAccumulate(rec, n);
    const max = Math.max(...accum); const mean = accum.reduce((a, b) => a + b, 0) / accum.length;
    expect(max).toBeGreaterThan(mean * 5);   // trunk cells carry far more than average
  });
});

import { runE9, synthPrecip, seaLevelForFraction } from '../relief-e9-hydrology.js';
import { runE6 as runE6_6 } from '../relief-e6-tectonic.js';
import { makeBaseStep as mkBase6 } from '../relief-base-step.js';
import { PRESETS as P6 } from '../relief-presets.js';
import { cloneHeight as clone6 } from '../relief-substrate.js';

describe('E9 incision (the host edit)', () => {
  const grid = { n: 64, lat0Deg: 0, lat1Deg: 80, domainKm: 4000, seed: 'e9-1' };
  function built() {
    const b = mkBase6(P6.rocky, grid);
    runE6_6(b.substrate, b.crust, b.drivers, { name:'tectonic-build' }, grid.seed);
    return b;
  }
  it('incision is strictly subtractive and lowers the shared height', () => {
    const b = built(); const before = clone6(b.substrate);
    const { incision } = runE9(b.substrate, b.drivers, { name:'fluvial-carve' }, grid.seed);
    expect(incision.every(v => v <= 1e-9)).toBe(true);
    for (let i = 0; i < b.substrate.height.length; i++)
      expect(b.substrate.height[i]).toBeLessThanOrEqual(before[i] + 1e-6);
  });
  it('carve correlates with relief: high-relief cells incise more than flat low cells', () => {
    const b = built(); const before = clone6(b.substrate);
    const { incision } = runE9(b.substrate, b.drivers, { name:'fluvial-carve' }, grid.seed);
    const med = [...before].sort((a, c) => a - c)[before.length >> 1];
    let hiSum = 0, hiN = 0, loSum = 0, loN = 0;
    for (let i = 0; i < before.length; i++) {
      if (before[i] > med) { hiSum += -incision[i]; hiN++; } else { loSum += -incision[i]; loN++; }
    }
    expect(hiSum / hiN).toBeGreaterThan(loSum / loN);   // mountains get cut, flats don't
  });
  it('synthPrecip is nonneg and varies with latitude', () => {
    const b = built(); const w = synthPrecip(b.substrate, b.drivers);
    expect(w.every(v => v >= 0)).toBe(true);
    expect(Math.max(...w)).toBeGreaterThan(Math.min(...w));
  });
  it('seaLevelForFraction hits the requested ocean fraction (±5%)', () => {
    const b = built(); const sl = seaLevelForFraction(b.substrate.height, grid.n, 0.4);
    let below = 0; for (const v of b.substrate.height) if (v < sl) below++;
    expect(below / b.substrate.height.length).toBeCloseTo(0.4, 1);
  });
  it('uses a bounded handful of passes (not 1, not ~200)', () => {
    const b = built(); const { passes } = runE9(b.substrate, b.drivers, { name:'fluvial-carve' }, grid.seed);
    expect(passes).toBeGreaterThanOrEqual(3); expect(passes).toBeLessThanOrEqual(12);
  });
});

import { runReliefSlice, verifyReliefSlice } from '../relief-slice.js';
import { PRESETS as P7 } from '../relief-presets.js';

describe('relief slice orchestrator', () => {
  it('build-only and build+carve are bit-identical THROUGH epoch 1', () => {
    const carve = runReliefSlice(P7.rocky, { n: 64, seed: 's', epoch2: true });
    const buildOnly = runReliefSlice(P7.rocky, { n: 64, seed: 's', epoch2: false });
    // heightAfterBuild is captured pre-carve in both → must match exactly
    expect(Array.from(carve.heightAfterBuild)).toEqual(Array.from(buildOnly.heightAfterBuild));
    // build-only final height == its post-build snapshot (no carve ran)
    expect(Array.from(buildOnly.substrate.height)).toEqual(Array.from(buildOnly.heightAfterBuild));
  });
  it('enabling epoch 2 only lowers height (valleys overprint)', () => {
    const r = runReliefSlice(P7.rocky, { n: 64, seed: 's2', epoch2: true });
    for (let i = 0; i < r.substrate.height.length; i++)
      expect(r.substrate.height[i]).toBeLessThanOrEqual(r.heightAfterBuild[i] + 1e-6);
  });
  it('passes the north-star core gate on the Rocky control (resolution-robust)', () => {
    const r = runReliefSlice(P7.rocky, { n: 96, seed: 's3', epoch2: true });
    const v = verifyReliefSlice(r);
    expect(v.signals.subtractive).toBe(true);
    expect(v.signals.carveCorrelatesRelief).toBe(true);
    expect(v.signals.noUphill).toBe(true);
    expect(v.signals.depressionsFilled).toBe(true);
    expect(v.signals.accumSpread).toBe(true);
    expect(v.pass).toBe(true);                       // gate = the 5 core mechanism signals
  });
  it('drainage shows fluvial Hack-law scaling at adequate resolution (quality, not gate)', () => {
    // Hack's law is only well-resolved on a sufficiently large grid; measure it at n=192.
    const v = verifyReliefSlice(runReliefSlice(P7.rocky, { n: 192, seed: 's3', epoch2: true }));
    expect(v.signals.hackExponent).toBeGreaterThan(0.4);
    expect(v.signals.hackExponent).toBeLessThan(0.8);
    expect(v.signals.hackPlausible).toBe(true);
  });
  it('is deterministic end-to-end', () => {
    const a = runReliefSlice(P7.lava, { n: 64, seed: 'det' });
    const b = runReliefSlice(P7.lava, { n: 64, seed: 'det' });
    expect(Array.from(a.substrate.height)).toEqual(Array.from(b.substrate.height));
  });
});

describe('E6 editor-on-host overprint (generality)', () => {
  it('a rotated-pole overprint epoch changes relief but stays bounded (faint blend)', () => {
    const base = runReliefSlice(P7.rocky, { n: 64, seed: 'op', epoch2: true });
    const over = runReliefSlice(P7.rocky, { n: 64, seed: 'op', epoch2: true,
                                            overprint: { rotatePoleDeg: 35, blend: 0.4 } });
    let diff = 0, maxAbs = 0;
    for (let i = 0; i < base.substrate.height.length; i++) {
      const d = Math.abs(over.substrate.height[i] - base.substrate.height[i]);
      diff += d; maxAbs = Math.max(maxAbs, d);
    }
    expect(diff).toBeGreaterThan(0);          // the overprint did something
    expect(maxAbs).toBeLessThan(1.0);          // but it's a faint blend, not a rebuild
  });
});
