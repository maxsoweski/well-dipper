// tests/instrument-review-fixes.test.js
// Regression tests for the 7 defects confirmed by the adversarial review workflow (2026-07-25).
//
// Every one of these was a bug in code written the same week, and every one returned a PLAUSIBLE
// NUMBER rather than throwing — the standing lesson of this workstream
// (feedback_measurement-channels-need-planted-defects). Each test below fails against the code as it
// was written and passes against the fix, so the fixes cannot be silently undone.
//
// The review's sharpest observation: the null test for spectralExcessPeak passed only because it
// hand-overrode the threshold, while the live caller used the default. So these tests exercise the
// SHIPPED DEFAULTS, never a convenient override.

import { describe, it, expect } from 'vitest';
import { spectralExcessPeak, fft } from '../src/worldengine/instrument/descriptors.js';
import { fitPowerLaw, lawVerdict, shiftSignificance, tCritical95 } from '../src/worldengine/instrument/stats.js';

// ── a deterministic scale-free field with NO band-limited population ────────────────────────────────
const N = 128;
const GRID = { mode: 'patch', width: N, height: N, spanKmX: 2000, spanKmY: 2000 };
const u = (a, b, s) => {
  const h = Math.sin(a * 127.1 + b * 311.7 + s * 74.7) * 43758.5453;
  return Math.min(0.999999, Math.max(1e-6, h - Math.floor(h)));
};
function ifft2(re, im) {
  const rr = new Float64Array(N), ri = new Float64Array(N);
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) { rr[i] = re[j * N + i]; ri[i] = im[j * N + i]; }
    fft(rr, ri, true);
    for (let i = 0; i < N; i++) { re[j * N + i] = rr[i]; im[j * N + i] = ri[i]; }
  }
  const cr = new Float64Array(N), ci = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) { cr[j] = re[j * N + i]; ci[j] = im[j * N + i]; }
    fft(cr, ci, true);
    for (let j = 0; j < N; j++) { re[j * N + i] = cr[j]; im[j * N + i] = ci[j]; }
  }
  return Float64Array.from(re);
}
/** Pure power-law field (Rayleigh amplitudes, hashed phases); optionally plus a band-limited form. */
function field(seed, cycles = 0, amp = 0) {
  const re = new Float64Array(N * N), im = new Float64Array(N * N);
  for (let j = 0; j < N; j++) {
    const ky = j <= N / 2 ? j : j - N;
    for (let i = 0; i < N; i++) {
      const kx = i <= N / 2 ? i : i - N;
      const k = Math.hypot(kx, ky);
      if (k < 1) continue;
      const A = Math.pow(k, -1.95) * Math.sqrt(-Math.log(u(Math.abs(kx), Math.abs(ky), seed)));
      const ph = 2 * Math.PI * u(Math.abs(kx) + 7, Math.abs(ky) + 13, seed);
      re[j * N + i] = A * Math.cos(ph); im[j * N + i] = A * Math.sin(ph);
    }
  }
  const f = ifft2(re, im);
  if (cycles) {
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        f[j * N + i] += amp * Math.sin((2 * Math.PI * cycles * i) / N) * Math.sin((2 * Math.PI * cycles * j) / N);
      }
    }
  }
  return f;
}

describe('spectralExcessPeak — false positives on featureless terrain (HIGH, confirmed)', () => {
  it('does NOT detect a form population in scale-free noise, at the SHIPPED DEFAULTS', () => {
    // The original code detected on 40/40 such fields: OLS residuals sum to zero so excessRatio >= 1
    // always, and the shipped minExcessRatio of 1.05 sat below the measured null floor (1.29-5.21).
    let detected = 0;
    const sigmas = [];
    for (let s = 0; s < 24; s++) {
      const p = spectralExcessPeak(field(s), GRID);     // NO options — the live call shape
      expect(Number.isFinite(p.peakSigma)).toBe(true);  // a NaN sigma would make this test vacuous
      if (p.detected) detected++;
      sigmas.push(p.peakSigma);
    }
    expect(detected).toBe(0);
    expect(Math.max(...sigmas)).toBeLessThan(4.5);
  });

  it('still detects a genuine band-limited population, at the same defaults', () => {
    for (let s = 0; s < 8; s++) {
      const p = spectralExcessPeak(field(s, 20, 0.35), GRID);
      expect(p.detected).toBe(true);
      // Radial wavenumber is 20*sqrt(2) = 28.28, but peaks land on INTEGER bins, so the achievable
      // answers near here are 2000/28 = 71.43 and 2000/29 = 68.97. Assert within one bin rather than
      // to an absolute tolerance the metric's own resolution cannot deliver.
      const truth = 2000 / (20 * Math.SQRT2);
      expect(Math.abs(p.wavelength / truth - 1)).toBeLessThan(0.03);
    }
  });

  it('detects a WEAK population too — the threshold buys specificity, not deafness', () => {
    const p = spectralExcessPeak(field(3, 20, 0.08), GRID);
    expect(p.detected).toBe(true);
  });

  it('marks the wavelength as meaningless when nothing was detected', () => {
    // The null's favourite bin must not be readable as a form size.
    const p = spectralExcessPeak(field(11), GRID);
    expect(p.detected).toBe(false);
    expect(p.wavelengthMeaningful).toBe(false);
  });

  it('does not let low-wavenumber bins win the argmax on noise alone', () => {
    // The unweighted argmax put 74% of null peaks at k<=3 (>= 667 km on a 2000 km window), recreating
    // the window-size artefact this function exists to eliminate.
    let lowK = 0;
    for (let s = 0; s < 24; s++) {
      const p = spectralExcessPeak(field(s), GRID);
      if (p.wavelength >= 667) lowK++;
    }
    expect(lowK / 24).toBeLessThan(0.4);
  });
});

describe('fitPowerLaw — zero degrees of freedom (MEDIUM, confirmed)', () => {
  it('refuses to report an uncertainty for a 2-point fit', () => {
    // Previously returned exponentSE ~ 1e-16 and lawVerdict then rendered an absolutely confident
    // FAIL on a line that had never been tested at all.
    const fit = fitPowerLaw([{ x: 1, y: 10 }, { x: 2, y: 14 }]);
    expect(fit.n).toBe(2);
    expect(fit.dof).toBe(0);
    expect(Number.isNaN(fit.exponentSE)).toBe(true);
    expect(Number.isFinite(fit.exponent)).toBe(true);        // the slope is still the best estimate
  });

  it('makes lawVerdict report UNRESOLVABLE for that fit rather than FAIL', () => {
    const fit = fitPowerLaw([{ x: 1, y: 10 }, { x: 2, y: 14 }]);
    const v = lawVerdict({ measured: fit.exponent, measuredSE: fit.exponentSE, claimed: 2 });
    expect(v.verdict).toBe('UNRESOLVABLE');
  });
});

describe('fitPowerLaw — mixed weight scales (HIGH, confirmed)', () => {
  it('does not silently annihilate a point that lacks an SEM', () => {
    // A literal weight of 1 is not on the 1/sigma^2 scale: beside real weights of ~4e5 the point is
    // effectively deleted, while n and dropped still report it as fully included.
    const pts = [
      { x: 1, y: 10, sem: 0.05 }, { x: 2, y: 20, sem: 0.1 },
      { x: 4, y: 40, sem: 0.2 }, { x: 8, y: 60 },            // no SEM, and off the y=10x line
    ];
    const fit = fitPowerLaw(pts);
    expect(fit.weighting).toMatch(/uniform/);
    expect(fit.n).toBe(4);
    // With the off-line point actually counted, the exponent must move well away from the 1.0 that
    // the old code returned by ignoring it.
    expect(fit.exponent).toBeLessThan(0.95);
  });

  it('uses inverse-variance weighting when every point has an SEM', () => {
    const fit = fitPowerLaw([
      { x: 1, y: 10, sem: 0.05 }, { x: 2, y: 20, sem: 0.1 }, { x: 4, y: 40, sem: 0.2 },
    ]);
    expect(fit.weighting).toBe('inverse-variance');
  });
});

describe('coverage: z=2 is not 95% at small dof (MEDIUM, confirmed)', () => {
  it('supplies the Student-t multiplier for the dof the fit actually has', () => {
    expect(tCritical95(1)).toBeCloseTo(12.706, 3);
    expect(tCritical95(4)).toBeCloseTo(2.776, 3);
    expect(tCritical95(100)).toBeCloseTo(1.96, 2);
  });

  it('a three-point sweep does not FAIL an exactly-true law that z=2 would have failed', () => {
    // The census sweep ran three radii (dof = 1). A Monte-Carlo showed an exactly-true law reported
    // FAIL 34% of the time there at z=2. With the correct multiplier the same data is consistent.
    const pts = [
      { x: 4, y: 10 * Math.pow(4, 0.5), sem: 0.05 },
      { x: 8, y: 10 * Math.pow(8, 0.5) * 1.02, sem: 0.4 },
      { x: 16, y: 10 * Math.pow(16, 0.5) * 0.97, sem: 0.7 },
    ];
    const fit = fitPowerLaw(pts);
    expect(fit.dof).toBe(1);
    const withZ2 = lawVerdict({ measured: fit.exponent, measuredSE: fit.exponentSE, claimed: 0.5, z: 2 });
    const withT = lawVerdict({ measured: fit.exponent, measuredSE: fit.exponentSE, claimed: 0.5, dof: fit.dof });
    expect(withT.z).toBeCloseTo(12.706, 2);
    expect(withT.z).toBeGreaterThan(withZ2.z);
    expect(withT.verdict).not.toBe('FAIL');
  });
});

describe('shiftSignificance — unknown uncertainty treated as zero (MEDIUM, confirmed x2)', () => {
  it('refuses to test a shift when either side has a single sample', () => {
    // `(NaN || 0)` made an unknown SEM into a zero SEM, so two single draws differing by 1e-8 came
    // back moved:true at sigma Infinity.
    const s = shiftSignificance([10.0], [10.0000001]);
    expect(s.moved).toBe(null);
    expect(Number.isNaN(s.sigma)).toBe(true);
    expect(s.reason).toMatch(/fewer than 2 samples|undecidable/i);
  });

  it('refuses the mixed case, where the wrong answer looked plausible', () => {
    const s = shiftSignificance([10, 10.1, 9.9, 10.05], [10.2]);
    expect(s.moved).toBe(null);        // previously moved:true at sigma 4.39
  });

  it('still decides normally when both ensembles have real spread', () => {
    expect(shiftSignificance([10, 10.1, 9.9, 10.05], [14, 14.1, 13.9, 14.05]).moved).toBe(true);
    expect(shiftSignificance([10, 12, 8, 11, 9], [10.5, 11.5, 8.5, 10.5, 9.5]).moved).toBe(false);
  });
});
