// tests/worldengine-base-condition-vector.test.js — World Engine V2-0 AC4 condition-vector threading.
//
// Proves (BUILD-PLAN §2 Slice C / AC4):
//   1. deriveConditionVector emits every named field with _fp-derived (non-default) values for presets
//      that define them, and rawTidalIoRatio is the RAW Io-ratio (== deriveUniforms(fp).tidalHeat, NOT
//      the calibrated driver) so m_hp is computable on the production path (§2.3 heat-pipe margin).
//   2. The nested `condition` sub-object ARRIVES at the writeBodyRelief seam (instrumented spy over the
//      real writer, fed the SAME bundle the AC1 gate/lab build).
//   3. REQUIRED (load-bearing widened-bundle inertness, paired with the AC1 byte-identity gate): the tune
//      builders driversToTune / magmaDriversToTune return byte-equal outputs for a condition-BEARING
//      bundle and its null-condition twin — i.e. the nested vector is invisible to them (R1).
import { describe, it, expect } from 'vitest';

import { deriveConditionVector } from '../body-condition-vector.js';
import { DRIVER_PRESETS } from '../driver-presets.js';
import { buildNeutralBodyDrivers } from '../body-drivers.js';
import { deriveUniforms } from '../planet-lod-lab-core.js';
import { calibrateTidal } from '../src/worldengine/base/adaptL0.js';
import { bodyShellThickness, bodyRawTidal } from '../src/worldengine/base/baseStep.js';
import { D_EARTH, driversToTune } from '../src/worldengine/base/plates.js';
import { MAGMA_REF, magmaDriversToTune } from '../src/worldengine/base/magmatism.js';

// The gate bundle-builder + headless carrier pattern — the SAME source the AC1 byte-identity gate uses,
// so the seam spy observes exactly the bundle the lab's route() feeds writeBodyRelief (single source).
import { buildBundle, TARGET_N, LLOYD, QUALITY_TIER } from './fixtures/v2-0-carrier-golden.mjs';
import { makeSphereField } from '../src/worldengine/base/sphereField.js';
import { buildIrregularSphere, writeBodyRelief } from '../planet-lod-rivers.js';

const NAMED_FIELDS = ['density', 'composition', 'age', 'radiusEarth', 'eccentricity',
                      'rawTidalIoRatio', 'shellThickness', 'magneticField', 'metallicity'];

describe('V2-0 AC4 — deriveConditionVector emits _fp-derived named fields', () => {
  it('every named field is present on the vector (no missing key)', () => {
    const fp = DRIVER_PRESETS['Magma (K2-141b)'];
    const u = deriveUniforms(fp, QUALITY_TIER);
    const v = deriveConditionVector(fp, u, fp.radiusEarth);
    for (const k of NAMED_FIELDS) expect(v).toHaveProperty(k);
  });

  it('Magma (K2-141b): eccentricity 0.01 + density 8 come straight from _fp (non-default)', () => {
    const fp = DRIVER_PRESETS['Magma (K2-141b)'];
    const u = deriveUniforms(fp, QUALITY_TIER);
    const v = deriveConditionVector(fp, u, fp.radiusEarth);
    expect(v.eccentricity).toBe(0.01);          // fp.eccentricity, not the 0 default
    expect(v.density).toBe(8);                   // fp.composition.density, not the 5.5 default
    expect(v.radiusEarth).toBe(1.5);             // drawn radius arg (== fp.radiusEarth here)
    expect(v.composition).toBe(fp.composition);  // D2/D9/D10 passthrough (same object)
  });

  it('Europa (icy moon): shellThickness sits in the low-g band (baseStep helper, no d³ transform — R4)', () => {
    const fp = DRIVER_PRESETS['Europa (icy moon)'];
    const u = deriveUniforms(fp, QUALITY_TIER);
    const v = deriveConditionVector(fp, u, fp.radiusEarth);
    // surfaceGravity 0.28 (< 0.5 smoothstep floor) + ageNorm 0.5 ⇒ clamp01(0.3 + 0 + 0.1) = 0.4
    expect(v.shellThickness).toBeCloseTo(0.4, 10);
    expect(v.shellThickness).toBeLessThan(0.5);
    expect(v.shellThickness).toBe(bodyShellThickness(fp));   // raw helper output, unmodified
  });

  it('Ocean (temperate): age 3.0 comes from _fp (a preset that defines age — non-default)', () => {
    const fp = DRIVER_PRESETS['Ocean (temperate)'];
    const u = deriveUniforms(fp, QUALITY_TIER);
    const v = deriveConditionVector(fp, u, fp.radiusEarth);
    expect(v.age).toBe(3.0);                     // fp.age, not the 4.5 default
  });

  it('rawTidalIoRatio is the RAW Io-ratio (== deriveUniforms.tidalHeat), NOT calibrated', () => {
    for (const name of ['Magma (K2-141b)', 'Europa (icy moon)']) {
      const fp = DRIVER_PRESETS[name];
      const u = deriveUniforms(fp, QUALITY_TIER);
      const v = deriveConditionVector(fp, u, fp.radiusEarth);
      expect(v.rawTidalIoRatio).toBe(u.tidalHeat);                    // the raw, un-calibrated D12 Io-ratio
      expect(v.rawTidalIoRatio).not.toBe(calibrateTidal(v.rawTidalIoRatio)); // NOT the bounded [0,1) driver
      expect(v.rawTidalIoRatio).toBeGreaterThan(1);                   // raw ratios for these hot bodies are >> the calibrated [0,1)
    }
  });

  it('rawTidalIoRatio falls back to bodyRawTidal(fp) when derived uniforms are absent', () => {
    const fp = DRIVER_PRESETS['Europa (icy moon)'];
    const v = deriveConditionVector(fp, /* derived */ null, fp.radiusEarth);
    expect(v.rawTidalIoRatio).toBe(bodyRawTidal(fp));   // the imported helper fallback (no ReferenceError)
  });

  it('radiusEarth uses the drawn arg, and falls back to fp.radiusEarth when the arg is missing (R5)', () => {
    const fp = DRIVER_PRESETS['Magma (K2-141b)'];
    const u = deriveUniforms(fp, QUALITY_TIER);
    expect(deriveConditionVector(fp, u, 2.7).radiusEarth).toBe(2.7);          // drawn radius wins
    expect(deriveConditionVector(fp, u, undefined).radiusEarth).toBe(1.5);    // fp.radiusEarth fallback
  });

  it('data-only fields are undefined for lab presets (surfaced-not-consumed: D13 + metallicity)', () => {
    const fp = DRIVER_PRESETS['Rocky (Earthlike)'];
    const u = deriveUniforms(fp, QUALITY_TIER);
    const v = deriveConditionVector(fp, u, fp.radiusEarth);
    expect(v.magneticField).toBeUndefined();
    expect(v.metallicity).toBeUndefined();
  });
});

describe('V2-0 AC4 — the nested condition arrives at the writeBodyRelief seam', () => {
  // Instrumented spy: wrap the REAL writeBodyRelief, capture the bundle it destructures at the seam, then
  // delegate. This observes the exact `bodyDrivers` object the writer (and its tune builders) receive.
  let seamBundle = null;
  function instrumentedWriteBodyRelief(carrier, bundle) {
    seamBundle = bundle;                       // the seam: what writeBodyRelief's destructure consumes
    return writeBodyRelief(carrier, bundle);
  }

  it('bodyDrivers.condition (nested) reaches the seam and the real writer accepts the widened bundle', () => {
    const name = 'Magma (K2-141b)';
    const carrier = makeSphereField(buildIrregularSphere(TARGET_N, LLOYD));
    const bundle = buildBundle(name, 1);        // the SAME bundle the AC1 gate builds (condition attached)
    const diag = instrumentedWriteBodyRelief(carrier, bundle);

    expect(seamBundle.bodyDrivers).toBeTruthy();
    expect(seamBundle.bodyDrivers.condition).toBeTruthy();     // nested — NOT flat keys (R1)
    expect(seamBundle.bodyDrivers).not.toHaveProperty('age');  // no FLAT age (would re-drive magmaThermal)
    expect(seamBundle.bodyDrivers.condition.density).toBe(8);  // _fp-derived value threaded through
    expect(seamBundle.bodyDrivers.condition.eccentricity).toBe(0.01);
    expect(diag.path).toBeTruthy();             // the real writer ran on the widened bundle (volcanic path)
  });
});

describe('V2-0 AC4 — REQUIRED widened-bundle inertness: tune builders ignore condition', () => {
  // Load-bearing (paired with the AC1 byte-identity gate): adding the nested `condition` must NOT change
  // what driversToTune / magmaDriversToTune emit vs a null-condition bundle — they read only flat keys.
  const names = Object.keys(DRIVER_PRESETS);
  // Precompute per-preset tune pairs once (independent of test execution order).
  const rows = names.map((name) => {
    const fp = DRIVER_PRESETS[name];
    const u = deriveUniforms(fp, QUALITY_TIER);
    const nullCond = buildNeutralBodyDrivers(u, fp);                          // no condition (null-condition twin)
    const withCond = { ...nullCond, condition: deriveConditionVector(fp, u, fp.radiusEarth) };
    return { name, nullCond, withCond };
  });

  for (const { name, nullCond, withCond } of rows) {
    it(`"${name}": driversToTune/magmaDriversToTune unchanged vs a null-condition bundle`, () => {
      expect(driversToTune(withCond)).toEqual(driversToTune(nullCond));
      expect(magmaDriversToTune(withCond)).toEqual(magmaDriversToTune(nullCond));
    });
  }

  it('the equality is non-vacuous: at least one preset drives a non-null plate AND magma tune', () => {
    expect(rows.some((r) => driversToTune(r.nullCond) !== null)).toBe(true);
    expect(rows.some((r) => magmaDriversToTune(r.nullCond) !== null)).toBe(true);
  });

  it('the tune-null reference anchors still hold (D_EARTH / MAGMA_REF → null)', () => {
    expect(driversToTune(D_EARTH)).toBeNull();
    expect(magmaDriversToTune(MAGMA_REF)).toBeNull();
  });
});
