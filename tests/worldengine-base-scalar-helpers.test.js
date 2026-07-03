// tests/worldengine-base-scalar-helpers.test.js — World Engine V2-0 AC2 scalar-helper WIRING PROOF.
//
// Proves that makeBaseStep is actually WIRED to the extracted helpers: each thin named helper
// (bodyShellThickness, bodyThermalState, bodyRadialStrain, bodyLiquidStability, bodySurfaceGravity,
// bodyAgeNorm, bodyRawTidal) returns the SAME value makeBaseStep emits in its {drivers,crust} return,
// and deriveBodyScalars is the single source both consult. This is TAUTOLOGICAL for value-preservation
// by design (both sides resolve to deriveBodyScalars(b).<field>) — its job is to catch a makeBaseStep
// that stops calling the helpers / recomputes a formula inline (drift). The value-preservation gate is
// the separate ad156cc golden (tests/worldengine-base-output-golden.test.js). See BUILD-PLAN §2 Slice B.
import { describe, it, expect } from 'vitest';
import {
  makeBaseStep,
  deriveBodyScalars,
  bodyRawTidal,
  bodyShellThickness,
  bodyThermalState,
  bodyRadialStrain,
  bodyLiquidStability,
  bodySurfaceGravity,
  bodyAgeNorm,
} from '../src/worldengine/base/baseStep.js';
import { calibrateTidal } from '../src/worldengine/base/adaptL0.js';
import { PRESETS } from '../relief-presets.js';

const GRID = { n: 32, lat0Deg: 0, lat1Deg: 80, domainKm: 4000, seed: 'helpers-1' };
const NAMES = ['rocky', 'lava', 'magma', 'europa', 'terrestrial'];

describe('V2-0 AC2 — scalar helpers are wired into makeBaseStep', () => {
  for (const name of NAMES) {
    describe(`preset "${name}"`, () => {
      const b = PRESETS[name];
      const out = makeBaseStep(b, GRID);

      it('bodyShellThickness(b) === makeBaseStep(b).crust.shellThickness', () => {
        expect(bodyShellThickness(b)).toBe(out.crust.shellThickness);
      });
      it('bodyThermalState(b) === makeBaseStep(b).crust.thermalState', () => {
        expect(bodyThermalState(b)).toBe(out.crust.thermalState);
      });
      it('bodyRadialStrain(b) === { sign, mag } from makeBaseStep(b).drivers', () => {
        expect(bodyRadialStrain(b)).toEqual({
          sign: out.drivers.radialStrainSign,
          mag: out.drivers.radialStrainMag,
        });
      });
      it('bodyLiquidStability(b) === makeBaseStep(b).drivers.liquidStability', () => {
        expect(bodyLiquidStability(b)).toBe(out.drivers.liquidStability);
      });
      it('bodySurfaceGravity(b) === makeBaseStep(b).drivers.surfaceGravity', () => {
        expect(bodySurfaceGravity(b)).toBe(out.drivers.surfaceGravity);
      });
      it('bodyAgeNorm(b) === makeBaseStep(b).drivers.age', () => {
        expect(bodyAgeNorm(b)).toBe(out.drivers.age);
      });
      it('calibrateTidal(bodyRawTidal(b)) === makeBaseStep(b).drivers.tidalHeat (raw-tidal oracle)', () => {
        // makeBaseStep returns only the CALIBRATED tidalHeat; bodyRawTidal exposes the raw pre-calibrate
        // Io-ratio, so its returned-field oracle is via calibrateTidal (the same fn makeBaseStep uses).
        expect(calibrateTidal(bodyRawTidal(b))).toBe(out.drivers.tidalHeat);
      });
      it('deriveBodyScalars(b) covers every scalar makeBaseStep emits', () => {
        const s = deriveBodyScalars(b);
        // drivers scalars
        expect(s.tidalHeat).toBe(out.drivers.tidalHeat);
        expect(s.surfaceGravity).toBe(out.drivers.surfaceGravity);
        expect(s.rockyCrust).toBe(out.drivers.rockyCrust);
        expect(s.surfaceHistory).toBe(out.drivers.surfaceHistory);
        expect(s.ageNorm).toBe(out.drivers.age);
        expect(s.radialStrainSign).toBe(out.drivers.radialStrainSign);
        expect(s.radialStrainMag).toBe(out.drivers.radialStrainMag);
        expect(s.despinAmp).toBe(out.drivers.despinAmp);
        expect(s.discriminator).toBe(out.drivers.discriminator);
        expect(s.useDiscriminator).toBe(out.drivers.useDiscriminator);
        expect(s.liquidStability).toBe(out.drivers.liquidStability);
        expect(s.liquidSpecies).toBe(out.drivers.liquidSpecies);
        expect(s.rainFactor).toBe(out.drivers.rainFactor);
        // crust scalars
        expect(s.shellThickness).toBe(out.crust.shellThickness);
        expect(s.thermalState).toBe(out.crust.thermalState);
        expect(s.loveK2).toBe(out.crust.loveK2);
      });
    });
  }
});
