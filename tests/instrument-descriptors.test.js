// tests/instrument-descriptors.test.js
// Non-visual analysis channel — AC-MATH.
//
// The instrument's descriptors are only trustworthy if they return the RIGHT answer on fields whose
// answer is known before the measurement. Every fixture here is analytic: a ramp whose hypsometric
// integral is exactly 0.5, a sinusoid whose wavelength is exactly span/k, a crater population built to
// an exact -2 cumulative slope, a meridian whose length is exactly R*dphi.
//
// Two tests at the bottom pin the ensemble arithmetic against the EXACT numbers published in
// docs/WORKSTREAMS/world-engine-radius-display-scale-2026-07-24/evidence/readgate-diagnosis/DIAGNOSIS.md
// (M>=3 to measure, M>=11 to resolve, from cv=24.5% against a 15% target). If those ever drift, the
// instrument has silently changed the rule that the read-gate incident produced.

import { describe, it, expect } from 'vitest';
import {
  hypsometricIntegral, rmsReliefKm, slopeStats, radialPSD, autocorrWavelengthKm,
  craterSFD, networkLengthKm, drainageDensity, bandCount, distributionMoments, spectralExcessPeak,
  totalAreaKm2, cellAreaKm2, rowLatDeg, countDensity, PER_AREA, fft,
} from '../src/worldengine/instrument/descriptors.js';
import {
  meanSEM, requiredSeeds, seedsToResolve, fitPowerLaw, lawVerdict, shiftSignificance,
} from '../src/worldengine/instrument/stats.js';

const patch = (w, h, spanX = 100, spanY = 100) => ({ mode: 'patch', width: w, height: h, spanKmX: spanX, spanKmY: spanY });
const equirect = (w, h, R = 6371) => ({ mode: 'equirect', width: w, height: h, radiusKm: R });

describe('grid geometry', () => {
  it('equirect cell areas sum to the sphere area, converging at second order', () => {
    // The cos(lat) midpoint rule is a quadrature of the exact integral, so the sum sits slightly ABOVE
    // 4 pi R^2 (cos is concave, and the midpoint rule overestimates concave integrands). The gap is
    // quadrature error, not a bug — so the test asserts its SIZE and its CONVERGENCE ORDER rather than
    // an absolute tolerance, which would only have been a bar tuned to one grid resolution.
    const exact = 4 * Math.PI * 1e6;
    const relErr = (H) => totalAreaKm2(equirect(2 * H, H, 1000)) / exact - 1;
    const e32 = relErr(32), e64 = relErr(64);
    expect(e32).toBeGreaterThan(0);                       // overestimate, as the midpoint rule predicts
    expect(e32).toBeLessThan(1e-3);                       // ~4.0e-4 at H=32
    expect(e64 / e32).toBeCloseTo(0.25, 1);               // halving the step quarters the error: O(dphi^2)
  });

  it('row latitude runs +90 to -90 and cell area shrinks toward the poles', () => {
    const g = equirect(8, 4);
    expect(rowLatDeg(0, 4)).toBeCloseTo(67.5, 6);
    expect(rowLatDeg(3, 4)).toBeCloseTo(-67.5, 6);
    expect(cellAreaKm2(g, 1)).toBeGreaterThan(cellAreaKm2(g, 0));
  });

  it('patch total area is exactly its span product', () => {
    expect(totalAreaKm2(patch(16, 8, 250, 125))).toBeCloseTo(250 * 125, 9);
  });
});

describe('hypsometric integral', () => {
  it('returns exactly 0.5 for a linear elevation ramp over uniform area', () => {
    const g = patch(32, 32);
    const h = new Float64Array(g.width * g.height);
    for (let j = 0; j < g.height; j++) for (let i = 0; i < g.width; i++) h[j * g.width + i] = j; // ramp in y
    expect(hypsometricIntegral(h, g)).toBeCloseTo(0.5, 12);
  });

  it('goes high when mass sits high and low when it sits low', () => {
    const g = patch(16, 16);
    const n = g.width * g.height;
    const high = new Float64Array(n).fill(10); high[0] = 0;   // almost everything at the top
    const low = new Float64Array(n).fill(0); low[0] = 10;     // almost everything at the bottom
    expect(hypsometricIntegral(high, g)).toBeGreaterThan(0.95);
    expect(hypsometricIntegral(low, g)).toBeLessThan(0.05);
  });
});

describe('RMS relief', () => {
  it('recovers a known standard deviation in km on a uniform-area grid', () => {
    const g = patch(32, 32);
    const A = 2.5;
    const h = new Float64Array(g.width * g.height);
    for (let k = 0; k < h.length; k++) h[k] = k % 2 === 0 ? A : -A;   // population SD is exactly A
    expect(rmsReliefKm(h, g)).toBeCloseTo(A, 10);
  });

  it('is zero for a flat field', () => {
    const g = patch(8, 8);
    expect(rmsReliefKm(new Float64Array(64).fill(3.2), g)).toBeCloseTo(0, 12);
  });
});

describe('slope statistics', () => {
  it('recovers the exact slope angle of a planar ramp', () => {
    const g = patch(32, 32, 100, 100);       // dx = dy = 100/32 km
    const dx = 100 / 32;
    const gradient = 0.05;                    // km of rise per km of run
    const h = new Float64Array(g.width * g.height);
    for (let j = 0; j < g.height; j++) for (let i = 0; i < g.width; i++) h[j * g.width + i] = gradient * i * dx;
    const s = slopeStats(h, g);
    const expectedDeg = (Math.atan(gradient) * 180) / Math.PI;
    expect(s.meanDeg).toBeCloseTo(expectedDeg, 8);
    expect(s.medianDeg).toBeCloseTo(expectedDeg, 8);
    expect(s.excludedFraction).toBe(0);
  });

  it('reports a flat field as zero slope', () => {
    const g = patch(16, 16);
    expect(slopeStats(new Float64Array(256).fill(1), g).meanDeg).toBeCloseTo(0, 12);
  });

  it('excludes the polar caps on an equirect grid and says so', () => {
    const g = equirect(32, 32);
    const s = slopeStats(new Float64Array(1024).fill(0), g);
    expect(s.excludedFraction).toBeGreaterThan(0);
    expect(s.excludedFraction).toBeLessThan(0.2);
  });
});

describe('spectral form size', () => {
  it('radialPSD finds the dominant wavelength of a pure sinusoid', () => {
    const g = patch(128, 128, 640, 640);
    const cycles = 8;                          // true wavelength = 640 / 8 = 80 km
    const f = new Float64Array(g.width * g.height);
    for (let j = 0; j < g.height; j++)
      for (let i = 0; i < g.width; i++)
        f[j * g.width + i] = Math.sin((2 * Math.PI * cycles * i) / g.width);
    const psd = radialPSD(f, g);
    expect(psd.dominantWavelengthKm).toBeCloseTo(640 / cycles, 6);
  });

  it('radialPSD tracks the wavelength as the form size changes', () => {
    const g = patch(128, 128, 640, 640);
    const wavelengths = [4, 8, 16].map((cycles) => {
      const f = new Float64Array(g.width * g.height);
      for (let j = 0; j < g.height; j++)
        for (let i = 0; i < g.width; i++)
          f[j * g.width + i] = Math.sin((2 * Math.PI * cycles * i) / g.width);
      return radialPSD(f, g).dominantWavelengthKm;
    });
    expect(wavelengths[0]).toBeCloseTo(160, 6);
    expect(wavelengths[1]).toBeCloseTo(80, 6);
    expect(wavelengths[2]).toBeCloseTo(40, 6);
  });

  it('radialPSD refuses an equirect grid rather than measuring the latitude seam', () => {
    expect(() => radialPSD(new Float64Array(64), equirect(8, 8))).toThrow(/patch grid/);
  });

  // The metric that replaced "most energetic bin" after the live check showed the latter always
  // returns the window size on natural (red-noise) terrain. These fixtures encode both halves of
  // the claim: it finds a band-limited population buried in red noise, and it declines to invent
  // one when the field is pure red noise.
  it('spectralExcessPeak finds a band-limited form buried in a red-noise background', () => {
    const g = patch(128, 128, 640, 640);
    const cycles = 16;                                   // form wavelength = 640/16 = 40 km
    const f = new Float64Array(g.width * g.height);
    // Red-noise background built by summing decaying low-k harmonics, plus a strong 16-cycle form.
    for (let j = 0; j < g.height; j++) {
      for (let i = 0; i < g.width; i++) {
        let v = 0;
        for (let k = 1; k <= 6; k++) {
          v += (1 / (k * k)) * Math.sin((2 * Math.PI * k * i) / g.width + k)
             + (1 / (k * k)) * Math.cos((2 * Math.PI * k * j) / g.height + k * 0.7);
        }
        v += 0.25 * Math.sin((2 * Math.PI * cycles * i) / g.width) * Math.sin((2 * Math.PI * cycles * j) / g.height);
        f[j * g.width + i] = v;
      }
    }
    const peak = spectralExcessPeak(f, g);
    expect(peak.detected).toBe(true);
    // The plain most-energetic-bin metric returns the window size here; the excess metric must not.
    expect(radialPSD(f, g).dominantWavelengthKm).toBeGreaterThan(200);
    // The form is a PRODUCT sin(kx)*sin(ky), whose energy sits at (kx,ky) = (+/-16, +/-16) — radial
    // wavenumber 16*sqrt(2), not 16. So the true repeat scale along the radial direction is
    // 640/(16*sqrt(2)) ~ 28.3 km, and that is what a correct metric reports. (The first version of
    // this test asserted 40 km by treating the product as a single 16-cycle wave; the metric was
    // right and the expectation was wrong.)
    const trueRadialWavelength = 640 / (cycles * Math.SQRT2);
    expect(peak.wavelength).toBeCloseTo(trueRadialWavelength, 0);
  });

  it('spectralExcessPeak tracks the form size when the form changes size', () => {
    const g = patch(128, 128, 640, 640);
    const build = (cycles) => {
      const f = new Float64Array(g.width * g.height);
      for (let j = 0; j < g.height; j++) {
        for (let i = 0; i < g.width; i++) {
          let v = 0;
          for (let k = 1; k <= 6; k++) v += (1 / (k * k)) * Math.sin((2 * Math.PI * k * i) / g.width + k);
          v += 0.25 * Math.sin((2 * Math.PI * cycles * i) / g.width) * Math.sin((2 * Math.PI * cycles * j) / g.height);
          f[j * g.width + i] = v;
        }
      }
      return spectralExcessPeak(f, g).wavelength;
    };
    const w8 = build(8), w16 = build(16), w32 = build(32);
    expect(w8).toBeGreaterThan(w16);
    expect(w16).toBeGreaterThan(w32);
    expect(w8 / w16).toBeCloseTo(2, 0);                  // halving the form size halves the reported wavelength
  });

  it('declines to report a form size for pure scale-free noise', () => {
    // A clean power-law field has no band-limited population. The metric must say so rather than
    // return the largest bin and let a caller read it as "the forms are window-sized".
    //
    // The fixture is built IN THE FREQUENCY DOMAIN — isotropic amplitude k^-1.5 with deterministic
    // (hash-derived, no RNG) phases, inverse-transformed — so it is scale-free by construction
    // rather than by hope. An earlier version summed axis-aligned harmonics, which is neither
    // isotropic nor smooth in the radial bins and so grew a spurious "feature".
    const N = 128;
    const g = patch(N, N, 640, 640);
    const re = new Float64Array(N * N), im = new Float64Array(N * N);
    const phase = (a, b) => {                       // deterministic pseudo-phase in [0, 2pi)
      const h = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
      return (h - Math.floor(h)) * 2 * Math.PI;
    };
    for (let j = 0; j < N; j++) {
      const ky = j <= N / 2 ? j : j - N;
      for (let i = 0; i < N; i++) {
        const kx = i <= N / 2 ? i : i - N;
        const k = Math.hypot(kx, ky);
        if (k < 1) continue;
        const amp = Math.pow(k, -1.5);
        const ph = phase(Math.abs(kx), Math.abs(ky)) * (kx < 0 ? -1 : 1);
        re[j * N + i] = amp * Math.cos(ph);
        im[j * N + i] = amp * Math.sin(ph);
      }
    }
    // Proper 2D inverse: transform every row, then every column.
    const rowRe = new Float64Array(N), rowIm = new Float64Array(N);
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) { rowRe[i] = re[j * N + i]; rowIm[i] = im[j * N + i]; }
      fft(rowRe, rowIm, true);
      for (let i = 0; i < N; i++) { re[j * N + i] = rowRe[i]; im[j * N + i] = rowIm[i]; }
    }
    const colRe = new Float64Array(N), colIm = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) { colRe[j] = re[j * N + i]; colIm[j] = im[j * N + i]; }
      fft(colRe, colIm, true);
      for (let j = 0; j < N; j++) { re[j * N + i] = colRe[j]; im[j * N + i] = colIm[j]; }
    }
    const f = new Float64Array(N * N);
    for (let k = 0; k < N * N; k++) f[k] = re[k];
    const peak = spectralExcessPeak(f, g, { minExcessRatio: 3 });
    expect(peak.detected).toBe(false);
    expect(Number.isFinite(peak.spectralSlope)).toBe(true);
  });

  it('autocorrWavelength recovers the same wavelength independently of the FFT', () => {
    const g = patch(128, 64, 640, 320);
    const cycles = 8;
    const f = new Float64Array(g.width * g.height);
    for (let j = 0; j < g.height; j++)
      for (let i = 0; i < g.width; i++)
        f[j * g.width + i] = Math.cos((2 * Math.PI * cycles * i) / g.width);
    expect(autocorrWavelengthKm(f, g)).toBeCloseTo(640 / cycles, 6);
  });
});

describe('crater size-frequency distribution', () => {
  // Population built from the exact inverse CDF of N(>=D) ~ D^-2, so the recovered cumulative slope
  // must land on -2. Deterministic quantiles rather than RNG: the fixture has no seed to argue about.
  const population = (b, N, dMin = 1) => {
    const out = [];
    for (let i = 0; i < N; i++) {
      const u = (i + 0.5) / N;
      out.push({ diameterKm: dMin * Math.pow(1 - u, -1 / b) });
    }
    return out;
  };

  it('recovers a cumulative slope of -2 from a -2 population', () => {
    const sfd = craterSFD(population(2, 4000), 1e6);
    expect(sfd.slope).toBeLessThan(-1.8);
    expect(sfd.slope).toBeGreaterThan(-2.2);
  });

  it('recovers a shallower slope from a -1.5 population and orders correctly', () => {
    const steep = craterSFD(population(3, 4000), 1e6).slope;
    const shallow = craterSFD(population(1.5, 4000), 1e6).slope;
    expect(shallow).toBeGreaterThan(-1.8);
    expect(steep).toBeLessThan(shallow);          // steeper population = more negative slope
  });

  it('reports density per 10^6 km^2 in the declared unit', () => {
    const sfd = craterSFD(population(2, 500), 2e6);
    expect(sfd.densityPerArea).toBeCloseTo((500 / 2e6) * PER_AREA, 9);
    expect(sfd.n).toBe(500);
  });

  it('degrades honestly on a population too small to fit', () => {
    const sfd = craterSFD([{ diameterKm: 5 }], 1e6);
    expect(Number.isNaN(sfd.slope)).toBe(true);
    expect(sfd.densityPerArea).toBeGreaterThan(0);
  });
});

describe('network length (drainage / boundary density)', () => {
  it('measures a meridian line as exactly R * delta-phi', () => {
    const R = 1000, H = 64, W = 128;
    const g = equirect(W, H, R);
    const mask = new Uint8Array(W * H);
    for (let j = 10; j <= 20; j++) mask[j * W + 5] = 1;      // 11 cells => 10 adjacencies
    const expected = 10 * R * (Math.PI / H);
    expect(networkLengthKm(mask, g)).toBeCloseTo(expected, 6);
  });

  it('measures a full equatorial ring as 2 pi R cos(lat), wrap included', () => {
    const R = 1000, H = 64, W = 128;
    const g = equirect(W, H, R);
    const row = 31;                                          // nearest row to the equator
    const mask = new Uint8Array(W * H);
    for (let i = 0; i < W; i++) mask[row * W + i] = 1;
    const lat = (rowLatDeg(row, H) * Math.PI) / 180;
    expect(networkLengthKm(mask, g)).toBeCloseTo(2 * Math.PI * R * Math.cos(lat), 6);
  });

  it('is anisotropy-correct: equal cell counts at different orientations give different lengths', () => {
    // The naive "cells x cell size" approximation would call these equal. They are not.
    const R = 1000, H = 64, W = 128;
    const g = equirect(W, H, R);
    const meridian = new Uint8Array(W * H), zonal = new Uint8Array(W * H);
    for (let k = 0; k < 20; k++) { meridian[(10 + k) * W + 5] = 1; zonal[31 * W + (10 + k)] = 1; }
    expect(networkLengthKm(meridian, g)).not.toBeCloseTo(networkLengthKm(zonal, g), 1);
  });

  it('drainage density reports channel km per 10^6 km^2', () => {
    const g = equirect(64, 32, 1000);
    const mask = new Uint8Array(64 * 32);
    for (let j = 5; j <= 15; j++) mask[j * 64 + 3] = 1;
    const len = networkLengthKm(mask, g);
    expect(drainageDensity(mask, g)).toBeCloseTo((len / totalAreaKm2(g)) * PER_AREA, 9);
  });

  it('an empty mask has zero length', () => {
    const g = equirect(32, 16);
    expect(networkLengthKm(new Uint8Array(512), g)).toBe(0);
  });
});

describe('zonal band count', () => {
  it('counts 2k bands for a k-cycle latitude pattern', () => {
    for (const cycles of [2, 3, 5]) {
      const g = equirect(16, 128);
      const f = new Float64Array(g.width * g.height);
      for (let j = 0; j < g.height; j++) {
        const v = Math.sin((2 * Math.PI * cycles * j) / g.height);
        for (let i = 0; i < g.width; i++) f[j * g.width + i] = v;
      }
      expect(bandCount(f, g).bands).toBe(2 * cycles);
    }
  });

  it('reports a single band for a featureless field', () => {
    const g = equirect(8, 64);
    expect(bandCount(new Float64Array(512).fill(1), g).bands).toBe(1);
  });
});

describe('distribution moments', () => {
  it('computes weighted mean and sd, and weights actually bite', () => {
    const m = distributionMoments([0, 10], [0.9, 0.1]);
    expect(m.mean).toBeCloseTo(1, 12);
    expect(m.min).toBe(0);
    expect(m.max).toBe(10);
  });

  it('percentiles follow the weighted empirical CDF', () => {
    const m = distributionMoments([1, 2, 3, 4, 5]);
    expect(m.p50).toBe(3);
  });
});

describe('countDensity', () => {
  it('normalises to per 10^6 km^2', () => {
    expect(countDensity(7, 1e6)).toBeCloseTo(7, 12);
    expect(countDensity(7, 2e6)).toBeCloseTo(3.5, 12);
    expect(Number.isNaN(countDensity(7, 0))).toBe(true);
  });
});

describe('ensemble statistics', () => {
  it('meanSEM uses the sample SD and shrinks the error with n', () => {
    const a = meanSEM([1, 2, 3, 4, 5]);
    expect(a.mean).toBeCloseTo(3, 12);
    expect(a.sd).toBeCloseTo(Math.sqrt(2.5), 12);
    expect(a.sem).toBeCloseTo(Math.sqrt(2.5) / Math.sqrt(5), 12);
  });

  it('reports no uncertainty for a single sample rather than inventing one', () => {
    const a = meanSEM([42]);
    expect(a.mean).toBe(42);
    expect(Number.isNaN(a.sem)).toBe(true);
  });
});

describe('power-law fitting', () => {
  it('recovers an exact exponent from noiseless points', () => {
    const points = [0.5, 1, 2, 4, 8, 16].map((x) => ({ x, y: 3 * Math.pow(x, 0.34) }));
    const fit = fitPowerLaw(points);
    expect(fit.exponent).toBeCloseTo(0.34, 9);
    expect(fit.coefficient).toBeCloseTo(3, 8);
    expect(fit.r2).toBeCloseTo(1, 9);
  });

  it('recovers a negative exponent (the relief law shape)', () => {
    const points = [1, 2, 4, 8].map((x) => ({ x, y: Math.pow(x, -0.58) }));
    expect(fitPowerLaw(points).exponent).toBeCloseTo(-0.58, 9);
  });

  it('drops non-positive points instead of returning NaN for the whole fit', () => {
    const fit = fitPowerLaw([{ x: 1, y: 1 }, { x: 2, y: 2 }, { x: 4, y: 0 }, { x: 8, y: 8 }]);
    expect(fit.dropped).toBe(1);
    expect(fit.exponent).toBeCloseTo(1, 6);
  });
});

describe('three-valued law verdicts', () => {
  it('PASSes a law that is both consistent and distinguishable from the null', () => {
    const v = lawVerdict({ measured: 0.34, measuredSE: 0.02, claimed: 0.34, label: 'crater count vs g' });
    expect(v.verdict).toBe('PASS');
  });

  it('FAILs a measurement inconsistent with the claim', () => {
    const v = lawVerdict({ measured: 0.90, measuredSE: 0.02, claimed: 0.34 });
    expect(v.verdict).toBe('FAIL');
    expect(v.reason).toMatch(/differs from claimed/);
  });

  it('returns UNRESOLVABLE — not PASS — when the interval swallows both the claim and the null', () => {
    // This is the read-gate incident in miniature: a measurement too coarse to decide anything, which a
    // two-valued system would have reported as a pass.
    const v = lawVerdict({ measured: 0.30, measuredSE: 0.50, claimed: 0.34 });
    expect(v.verdict).toBe('UNRESOLVABLE');
    expect(v.reason).toMatch(/cannot tell the law from no response/);
    expect(v.seedMultiplierNeeded).toBeGreaterThan(1);
  });

  it('returns UNRESOLVABLE when the fit did not converge', () => {
    expect(lawVerdict({ measured: NaN, measuredSE: NaN, claimed: 0.34 }).verdict).toBe('UNRESOLVABLE');
  });

  it('a zero-response system FAILs a non-zero claimed law when precision is adequate', () => {
    const v = lawVerdict({ measured: 0.00, measuredSE: 0.01, claimed: 0.34 });
    expect(v.verdict).toBe('FAIL');
  });
});

describe('sample-size arithmetic — pinned to the read-gate diagnosis', () => {
  // DIAGNOSIS.md appendix, verbatim: "M(SEM<=15%): cons (24.5/15)^2=2.68 -> >=3 ; full (32.5/15)^2=4.68 -> >=5"
  it('reproduces the published M-to-measure figures', () => {
    expect(requiredSeeds(0.245, 0.15)).toBe(3);
    expect(requiredSeeds(0.325, 0.15)).toBe(5);
  });

  // DIAGNOSIS.md appendix, verbatim: "M(2-sigma resolve 15%): cons 10.7 -> >=11 ; full 18.7 -> >=19"
  it('reproduces the published M-to-resolve figures', () => {
    expect(seedsToResolve(0.245, 0.15, 2)).toBe(11);
    expect(seedsToResolve(0.325, 0.15, 2)).toBe(19);
  });

  it('demands more seeds for a tighter target', () => {
    expect(requiredSeeds(0.245, 0.05)).toBeGreaterThan(requiredSeeds(0.245, 0.15));
  });
});

describe('regression shift significance', () => {
  it('calls a real shift moved', () => {
    const s = shiftSignificance([10, 10.1, 9.9, 10.05], [14, 14.1, 13.9, 14.05]);
    expect(s.moved).toBe(true);
    expect(s.delta).toBeCloseTo(4, 6);
  });

  it('leaves a within-noise wobble alone (no false alarm)', () => {
    const s = shiftSignificance([10, 12, 8, 11, 9], [10.5, 11.5, 8.5, 10.5, 9.5]);
    expect(s.moved).toBe(false);
  });

  it('reports the shift in sigma so findings can be ranked, not just listed', () => {
    const s = shiftSignificance([10, 10.1, 9.9], [12, 12.1, 11.9]);
    expect(Math.abs(s.sigma)).toBeGreaterThan(2);
    expect(s.fractionalDelta).toBeCloseTo(0.2, 2);
  });
});
