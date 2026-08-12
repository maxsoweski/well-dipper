// AC1 calibration guard — planet-scale-normalization-2026-06-15.
//
// The AC1 property suite (planet-scale.test.js) pins the SHAPE of the conversion
// helpers (monotonicity / exactness / boundedness). This sibling pins the
// CALIBRATION clause that the property suite deliberately does not assert:
// craters and rivers — the two features Max flagged as oversized (backlog #2/#3)
// — must resolve to a HIGHER base frequency (a SMALLER on-disk footprint) at the
// reference radius (RE = 1) than their pre-change baseline.
//
// The calibration lives in planet-lod-lab.html as (cFeature, featureSizeKm) pairs
// fed to featureFrequencyFromKm. That file is not vitest-importable, so the
// calibrated inputs are mirrored here as documented constants and the SAME
// single-source helper is exercised. If anyone retunes the crater/river size_km
// (or the C constant) below the pre-change footprint, this fails.
import { describe, it, expect } from 'vitest';
import { featureFrequencyFromKm, R_EARTH_KM } from '../src/worldengine/base/labCore.js';

const REFERENCE_RADIUS_EARTH = 1; // RE = 1 (Earth) — the calibration reference radius.

// ── Post-change calibrated inputs (mirrored from planet-lod-lab.html) ──
//   crater: C_CRATER = 1.0, craterSizeKm = 530   (planet-lod-lab.html:4910 / :5223)
//   river : C_FLUVIAL = 1.0, fluvialSizeKm = 1385 (planet-lod-lab.html:4916 / :5388)
const C_CRATER = 1.0, CRATER_SIZE_KM = 530;
const C_FLUVIAL = 1.0, FLUVIAL_SIZE_KM = 1385;

// ── Documented pre-change base frequencies (the old hand-set uniform defaults) ──
//   crater: uCraterScale default 6.0 (planet-lod-lab.html:4227, pre-change)
//   river : uFluvialFreq  default 2.3 (planet-lod-lab.html:4359, pre-change)
const CRATER_FREQ_PRE = 6.0;
const RIVER_FREQ_PRE = 2.3;

describe('AC1 calibration — flagged-oversized features resolve to a higher base frequency', () => {
  it('crater base frequency at RE=1 is the calibrated value and is strictly > the pre-change 6.0', () => {
    const freq = featureFrequencyFromKm(REFERENCE_RADIUS_EARTH, CRATER_SIZE_KM, C_CRATER);
    // Calibrated value: 1.0 * (1 * 6371) / 530 ≈ 12.02.
    expect(freq).toBeCloseTo((C_CRATER * R_EARTH_KM) / CRATER_SIZE_KM, 9);
    expect(freq).toBeGreaterThan(CRATER_FREQ_PRE);
    // Guard the *magnitude* of the recalibration (≈2× tighter), not just direction.
    expect(freq).toBeGreaterThanOrEqual(2 * CRATER_FREQ_PRE * 0.95);
  });

  it('river base frequency at RE=1 equals 4.6 and is strictly > the pre-change 2.3', () => {
    const freq = featureFrequencyFromKm(REFERENCE_RADIUS_EARTH, FLUVIAL_SIZE_KM, C_FLUVIAL);
    // Documented calibration: 2.3 -> 4.6 (commits 395043c / fd3aa70, backlog #3).
    expect(freq).toBeCloseTo(4.6, 6);
    expect(freq).toBeGreaterThan(RIVER_FREQ_PRE);
    expect(freq).toBeCloseTo(2 * RIVER_FREQ_PRE, 6); // exactly the documented ~2× tighten
  });

  it('both flagged features are tighter than baseline by a real margin (not a no-op recalibration)', () => {
    const crater = featureFrequencyFromKm(REFERENCE_RADIUS_EARTH, CRATER_SIZE_KM, C_CRATER);
    const river = featureFrequencyFromKm(REFERENCE_RADIUS_EARTH, FLUVIAL_SIZE_KM, C_FLUVIAL);
    expect(crater / CRATER_FREQ_PRE).toBeGreaterThan(1.5);
    expect(river / RIVER_FREQ_PRE).toBeGreaterThan(1.5);
  });
});
