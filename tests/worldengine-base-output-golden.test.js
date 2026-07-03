// tests/worldengine-base-output-golden.test.js — World Engine V2-0 AC2 makeBaseStep VALUE-PRESERVATION GATE.
//
// Asserts the CURRENT makeBaseStep output equals the committed golden (tests/fixtures/v2-0-basestep-
// goldens.json, captured on the pre-change baseStep — untouched since ad156cc). Every drivers scalar and
// crust scalar deep-equals; crust.crustalThickness matches by SHA-256; and the raw tidal value is anchored
// via the calibrate oracle. Passes TRIVIALLY in this slice (between A and B — baseStep is unchanged); it
// becomes Slice B's REAL gate when the per-body scalar block is extracted into pure helpers that must keep
// {drivers,crust,substrate} byte-identical.
//
// This is the ONLY artifact that verifies AC2's "same values the grid op produced": the existing
// worldengine-base-* suites pin only determinism/relations/bounds (not exact scalars), the AC1 carrier
// goldens can't witness baseStep (dormant on the carrier path), and AC5 checks console errors only — so a
// value-preserving-in-monotonicity-but-wrong refactor, or silent worldengine-fieldviz.html numeric drift,
// would slip past everything else. Capture + gate share tests/fixtures/v2-0-basestep-golden.mjs so they
// cannot drift apart. See BUILD-PLAN §1 Slice B + §2 + R2.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { computeGoldens, BUNDLES, GRID, rawTidalOf } from './fixtures/v2-0-basestep-golden.mjs';
import { makeBaseStep, bodyRawTidal } from '../src/worldengine/base/baseStep.js';
import { calibrateTidal } from '../src/worldengine/base/adaptL0.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = JSON.parse(readFileSync(path.resolve(__dirname, 'fixtures', 'v2-0-basestep-goldens.json'), 'utf8'));

describe('V2-0 AC2 — makeBaseStep output matches the ad156cc golden', () => {
  const recomputed = computeGoldens();
  const names = Object.keys(BUNDLES);

  it('covers the 5 relief presets + the frozen adapter bundle', () => {
    expect(names).toEqual(['rocky', 'lava', 'magma', 'europa', 'terrestrial', 'adapter']);
    for (const name of names) expect(FIXTURE.goldens).toHaveProperty(name);
  });

  for (const name of Object.keys(BUNDLES)) {
    describe(`bundle "${name}"`, () => {
      const golden = FIXTURE.goldens[name];
      const got = recomputed[name];

      it('all 13 drivers scalars deep-equal the golden', () => {
        expect(got.drivers).toEqual(golden.drivers);
      });
      it('crust scalars {shellThickness, thermalState, loveK2} deep-equal the golden', () => {
        expect(got.crust).toEqual(golden.crust);
      });
      it('crustalThickness field matches by SHA-256', () => {
        expect(got.crustalThicknessSha256).toBe(golden.crustalThicknessSha256);
      });
      it('rawTidal matches the frozen golden value', () => {
        expect(got.rawTidal).toBe(golden.rawTidal);
      });
      it('calibrateTidal(rawTidal) === makeBaseStep(bundle).drivers.tidalHeat (raw-tidal oracle)', () => {
        // Anchors the stored raw value against the live calibrated output using the SAME calibrateTidal
        // Slice B's bodyRawTidal oracle will use — makeBaseStep returns only the calibrated tidalHeat.
        const tidalHeat = makeBaseStep(BUNDLES[name], GRID).drivers.tidalHeat;
        expect(calibrateTidal(golden.rawTidal)).toBe(tidalHeat);
        expect(rawTidalOf(BUNDLES[name])).toBe(golden.rawTidal);
      });
      it('bodyRawTidal(b) oracle: calibrateTidal(bodyRawTidal(b)) === frozen drivers.tidalHeat + raw pin', () => {
        // Slice B's actual bodyRawTidal helper (the one AC2 field with no returned makeBaseStep value,
        // since makeBaseStep returns calibrated tidalHeat). Oracle against the FROZEN ad156cc calibrated
        // value: calibrateTidal(bodyRawTidal(b)) must equal the golden's frozen drivers.tidalHeat. Plus a
        // forward-drift pin: bodyRawTidal(b) === the frozen raw value stored in the fixture.
        expect(calibrateTidal(bodyRawTidal(BUNDLES[name]))).toBe(golden.drivers.tidalHeat);
        expect(bodyRawTidal(BUNDLES[name])).toBe(golden.rawTidal);
      });
    });
  }
});
