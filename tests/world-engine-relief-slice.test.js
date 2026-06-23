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

// append to tests/world-engine-relief-slice.test.js
import {
  zscore, hypsometricDistance, perCellRMS, regimeHistogramDistance,
  carveFraction, channelFraction, directionalAnisotropy,
} from '../relief-divergence.js';

describe('divergence metrics', () => {
  it('zscore yields mean ~0 and std ~1', () => {
    const z = zscore(Float32Array.from([1, 2, 3, 4, 5]));
    const mean = z.reduce((a, b) => a + b, 0) / z.length;
    const std = Math.sqrt(z.reduce((a, b) => a + b * b, 0) / z.length);
    expect(mean).toBeCloseTo(0, 6);
    expect(std).toBeCloseTo(1, 6);
  });
  it('hypsometricDistance ~0 for a pure amplitude rescale (the OLD coat-swap reads as no divergence)', () => {
    const a = Float32Array.from({ length: 400 }, (_, i) => Math.sin(i * 0.3));
    const b = Float32Array.from(a, (v) => v * 7.5);          // same shape, 7.5x amplitude
    expect(hypsometricDistance(a, b)).toBeLessThan(1e-6);
  });
  it('hypsometricDistance > 0 when the DISTRIBUTION SHAPE differs (skewed vs symmetric)', () => {
    const sym  = Float32Array.from({ length: 400 }, (_, i) => Math.sin(i * 0.3));            // ~symmetric
    const skew = Float32Array.from({ length: 400 }, (_, i) => Math.pow(Math.abs(Math.sin(i * 0.3)), 3)); // skewed
    expect(hypsometricDistance(sym, skew)).toBeGreaterThan(0.05);
  });
  it('perCellRMS is large for a reshuffle even when the distribution is identical', () => {
    const a = Float32Array.from({ length: 400 }, (_, i) => Math.sin(i * 0.3));
    const b = Float32Array.from(a).reverse();                // same multiset, different arrangement
    expect(hypsometricDistance(a, b)).toBeLessThan(0.05);    // distribution ~unchanged
    expect(perCellRMS(a, b)).toBeGreaterThan(0.5);           // but per-cell saturates (reseed-sensitive)
  });
  it('regimeHistogramDistance is 0 for identical class mixes, positive when classes shift', () => {
    const a = Uint8Array.from([0, 0, 1, 2]);
    const b = Uint8Array.from([0, 0, 1, 2]);
    const c = Uint8Array.from([2, 2, 2, 2]);
    expect(regimeHistogramDistance(a, b)).toBeCloseTo(0, 6);
    expect(regimeHistogramDistance(a, c)).toBeGreaterThan(0.4);
  });
  it('carveFraction counts incised cells', () => {
    expect(carveFraction(Float32Array.from([0, -0.01, -1e-9, -0.5]))).toBeCloseTo(0.5, 6);
  });
  it('channelFraction is in (0,1)', () => {
    const acc = Float32Array.from({ length: 100 }, (_, i) => i);
    const f = channelFraction(acc, 0.9);
    expect(f).toBeGreaterThan(0); expect(f).toBeLessThan(0.2);
  });
  it('directionalAnisotropy >> 1 when relief varies ACROSS strike but is smooth ALONG it', () => {
    // grain runs east (θ=0) → across-strike = the y-axis. Build a field that ripples in y (across)
    // and is constant in x (along): all gradient energy lands on the across-strike axis.
    const n = 32; const h = new Float32Array(n * n); const g = new Float32Array(n * n); // θ=0 everywhere
    for (let iy = 0; iy < n; iy++) for (let ix = 0; ix < n; ix++) h[iy * n + ix] = Math.sin(iy * 0.9);
    expect(directionalAnisotropy(h, g, n)).toBeGreaterThan(10);   // RED→GREEN: it detects the direction
  });
  it('directionalAnisotropy ≈ 1 for an isotropic (direction-free) field', () => {
    // Independent random heights have no preferred orientation → across ≈ along energy → ratio ≈ 1.
    const n = 48; const h = new Float32Array(n * n); const g = new Float32Array(n * n); // θ=0 everywhere
    let s = 12345; const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    for (let i = 0; i < h.length; i++) h[i] = rnd();
    const r = directionalAnisotropy(h, g, n);
    expect(r).toBeGreaterThan(0.7); expect(r).toBeLessThan(1.4);
  });
});

// append to tests/world-engine-relief-slice.test.js
import { runReliefSlice as runRS_L1 } from '../relief-slice.js';
import { PRESETS as P_L1 } from '../relief-presets.js';
import { makeBaseStep as mkBase_L1 } from '../relief-base-step.js';
import { regimeHistogramDistance as regDist_L1 } from '../relief-divergence.js';

describe('Layer 1 — regime un-damp', () => {
  const grid = { n: 96, lat0Deg: 0, lat1Deg: 80, domainKm: 4000, seed: 'L1' };
  it('radialStrainMag is no longer damped to inertness (>> 0.001)', () => {
    const { drivers } = mkBase_L1(P_L1.rocky, grid);
    expect(Math.abs(drivers.radialStrainMag)).toBeGreaterThan(0.05);
  });
  it('a contraction body (rocky, +1) and an extension body (europa, -1) diverge in regime mix', () => {
    const rocky  = runRS_L1(P_L1.rocky,  { ...grid, epoch2: false });
    const europa = runRS_L1(P_L1.europa, { ...grid, epoch2: false });
    // GATE METRIC (relative): cross-regime pair must differ in regime-class mix...
    const cross = regDist_L1(rocky.substrate.regime, europa.substrate.regime);
    // ...far more than the null baseline (same bundle vs itself = 0).
    const nullA = regDist_L1(rocky.substrate.regime, rocky.substrate.regime);
    expect(cross).toBeGreaterThan(0.1);
    expect(cross).toBeGreaterThan(nullA + 0.1);
  });
  it('rocky leans THRUST (compression) vs europa leans NORMAL (extension)', () => {
    const rocky  = runRS_L1(P_L1.rocky,  { ...grid, epoch2: false });
    const europa = runRS_L1(P_L1.europa, { ...grid, epoch2: false });
    const frac = (reg, k) => Array.from(reg).filter((r) => r === k).length / reg.length;
    expect(frac(rocky.substrate.regime, 2)).toBeGreaterThan(frac(europa.substrate.regime, 2));  // THRUST=2
    expect(frac(europa.substrate.regime, 0)).toBeGreaterThan(frac(rocky.substrate.regime, 0));  // NORMAL=0
  });
  it('europa (highest-mag preset) is NOT saturated to a single regime — REGIME_GAIN below its ceiling', () => {
    // Guard: at GAIN > ~0.44 europa collapses to 100% NORMAL, which would make L2 (regime-branched
    // geometry) degenerate. eps must SHIFT bands, never saturate — keep >=2 Anderson regime classes.
    const europa = runRS_L1(P_L1.europa, { ...grid, epoch2: false });
    expect(new Set(Array.from(europa.substrate.regime)).size).toBeGreaterThan(1);
  });
});

// append to tests/world-engine-relief-slice.test.js
import { runReliefSlice as runRS_L2 } from '../relief-slice.js';
import { PRESETS as P_L2 } from '../relief-presets.js';
import {
  hypsometricDistance as hypso_L2,
  directionalAnisotropy as aniso_L2,
} from '../relief-divergence.js';

describe('Layer 2 — geometry branch', () => {
  const grid = { n: 96, lat0Deg: 0, lat1Deg: 80, domainKm: 4000, seed: 'L2' };
  const n = grid.n;

  // PRIMARY L2-ATTRIBUTABLE GATE. directionalAnisotropy is the ONLY metric here that L2 (and not L1)
  // moves: L1 only flips the regime MIX (a hypsometric/distribution change), it does NOT orient relief
  // about the strike. L2's sign-branched steeredNoise is what makes contraction relief vary tightly
  // ACROSS strike (long ridges/scarps, high anisotropy) vs extension relief stay blockier (~isotropic).
  // Pre-L2 the geometry was regime-blind, so both bodies had the SAME along/across freq ratio and this
  // metric was identical across bundles → this assert would have failed (RED). Post-L2 it differs by sign.
  it('cross-regime anisotropy difference exceeds same-bundle reseed variation (the L2-only signal)', () => {
    // E9 OFF, SAME seed for both → only L1 regime + L2 geometry can move the field.
    const rocky  = runRS_L2(P_L2.rocky,  { ...grid, epoch2: false });   // contraction (sign +1)
    const europa = runRS_L2(P_L2.europa, { ...grid, epoch2: false });   // extension   (sign -1)
    const aRocky  = aniso_L2(rocky.substrate.height,  rocky.substrate.grainAngle,  n);
    const aEuropa = aniso_L2(europa.substrate.height, europa.substrate.grainAngle, n);
    const crossDiff = Math.abs(aRocky - aEuropa);
    // null baseline: SAME bundle, DIFFERENT seeds → how much this metric wiggles on a mere reshuffle.
    const a1 = runRS_L2(P_L2.rocky, { ...grid, seed: 'L2a', epoch2: false });
    const a2 = runRS_L2(P_L2.rocky, { ...grid, seed: 'L2b', epoch2: false });
    const reseedVar = Math.abs(
      aniso_L2(a1.substrate.height, a1.substrate.grainAngle, n) -
      aniso_L2(a2.substrate.height, a2.substrate.grainAngle, n)
    );
    // contraction should be MORE across-strike-organised (sharper ⟂ ridges) than extension.
    expect(aRocky).toBeGreaterThan(aEuropa);
    // and the body-type difference must dominate the reseed wobble — this is L2's contribution.
    expect(crossDiff).toBeGreaterThan(reseedVar);
  });

  it('held-seed hypsometric divergence of a cross-regime pair clears the reseed floor', () => {
    // RE-LABELED (honesty): this divergence is carried PRIMARILY by L1's regime flip, NOT by L2 — L1
    // already cleared the reseed floor pre-L2 (see task-3 report). Retained as a field-divergence sanity
    // check that the cross-regime pair still produces a real distribution change; it does NOT credit L2.
    const rocky  = runRS_L2(P_L2.rocky,  { ...grid, epoch2: false });
    const europa = runRS_L2(P_L2.europa, { ...grid, epoch2: false });
    const cross = hypso_L2(rocky.substrate.height, europa.substrate.height);
    // reseed floor: SAME bundle, DIFFERENT seed (a reshuffle of the same world).
    const a1 = runRS_L2(P_L2.rocky, { ...grid, seed: 'L2a', epoch2: false });
    const a2 = runRS_L2(P_L2.rocky, { ...grid, seed: 'L2b', epoch2: false });
    const floor = hypso_L2(a1.substrate.height, a2.substrate.height);
    expect(cross).toBeGreaterThan(floor);                  // physics beats a mere reseed
    expect(cross).toBeGreaterThan(0.02);
  });
});

// append to tests/world-engine-relief-slice.test.js
import { runReliefSlice as runRS_L3 } from '../relief-slice.js';
import { PRESETS as P_L3 } from '../relief-presets.js';
import { hypsometricDistance as hypso_L3, perCellRMS as rms_L3 } from '../relief-divergence.js';

describe('Layer 3 — toggleable seed discriminator', () => {
  const grid = { n: 96, lat0Deg: 0, lat1Deg: 80, domainKm: 4000, seed: 'L3' };
  it('discriminator ON changes the field layout vs OFF for the same bundle+seed', () => {
    const on  = runRS_L3(P_L3.rocky, { ...grid, epoch2: false, discriminate: true });
    const off = runRS_L3(P_L3.rocky, { ...grid, epoch2: false, discriminate: false });
    expect(rms_L3(on.substrate.height, off.substrate.height)).toBeGreaterThan(0.3); // layout reshuffled
  });
  it('discriminator OFF is reproducible (held-seed baseline is stable)', () => {
    const a = runRS_L3(P_L3.rocky, { ...grid, epoch2: false, discriminate: false });
    const b = runRS_L3(P_L3.rocky, { ...grid, epoch2: false, discriminate: false });
    expect(Array.from(a.substrate.height)).toEqual(Array.from(b.substrate.height));
  });
  it('two different bundles draw different streams when ON (composition-keyed layout)', () => {
    const rocky  = runRS_L3(P_L3.rocky,  { ...grid, epoch2: false, discriminate: true });
    const europa = runRS_L3(P_L3.europa, { ...grid, epoch2: false, discriminate: true });
    expect(rms_L3(rocky.substrate.height, europa.substrate.height)).toBeGreaterThan(0.3);
  });
  it('GUARD: a reseed alone (discriminator) must NOT be what carries the held-seed hypsometric gate', () => {
    // The anti-"coat-swap-of-a-different-color" guard, made RELATIVE instead of a fixed threshold. A pure
    // reseed (same bundle, discriminator ON vs OFF) only reshuffles the ARRANGEMENT of one world's heights; it
    // leaves the height DISTRIBUTION almost untouched. A genuine cross-regime pair (two different-regime
    // bundles, both held-seed) moves that distribution more. We measure BOTH in-run and assert the reshuffle
    // is a fraction of the cross divergence, so the bar tracks the field's actual scale rather than a magic
    // constant. Why this beats the old fixed `< 0.05`: a 15-seed sweep at n=96 found rocky reshuffle ranging
    // 0.0212–0.1458 (mean 0.0594) — already ABOVE 0.05, i.e. the old test only passed on a lucky pinned seed.
    // Run at n=192 for cleaner distribution statistics.
    //
    // SCOPE NOTE (honesty — do not overstate): this relative form is NOT seed-universal. A 15-seed sweep at
    // n=192 showed reshuffle/cross ratio ranging 0.117–1.446 (mean 0.42); ~6/15 seeds exceed 0.4 because on a
    // few seeds the rocky-OFF and europa-OFF height DISTRIBUTIONS genuinely converge (cross collapses to
    // reshuffle scale — e.g. seed "qq": cross 0.082, reshuffle 0.119). Averaging either/both sides over extra
    // held-seeds did not rescue those outliers. So this is a DETERMINISTIC single-seed assertion on the pinned
    // committed seed (L3, n=192: reshuffle 0.0368, cross 0.1540, ratio 0.239 → 1.7× headroom under 0.4), which
    // is a strict, in-run-scaled improvement over the old fixed-0.05 — NOT a claim that every seed clears 0.4.
    // See task-4-report.md for the full multi-seed table. Revisit if a seed-universal GUARD is needed (would
    // require a noise-floor estimate, not a single cross-pair).
    const gridHi = { ...grid, n: 192 };
    const rockyOn  = runRS_L3(P_L3.rocky,  { ...gridHi, epoch2: false, discriminate: true });
    const rockyOff = runRS_L3(P_L3.rocky,  { ...gridHi, epoch2: false, discriminate: false });
    const europaOff = runRS_L3(P_L3.europa, { ...gridHi, epoch2: false, discriminate: false });
    const reshuffle = hypso_L3(rockyOn.substrate.height, rockyOff.substrate.height);  // same bundle, ON vs OFF
    const cross     = hypso_L3(rockyOff.substrate.height, europaOff.substrate.height); // cross-regime, both held-seed
    expect(reshuffle).toBeLessThan(0.4 * cross); // a reseed reshuffles arrangement, not the height distribution
  });
});
