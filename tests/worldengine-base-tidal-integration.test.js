// tests/worldengine-base-tidal-integration.test.js
import { describe, it, expect } from 'vitest';
import { adaptL0 } from '../src/worldengine/base/adaptL0.js';
import { makeBaseStep } from '../src/worldengine/base/baseStep.js';
import { PlanetGenerator } from '../src/generation/PlanetGenerator.js';
import { tidalHeatingPlanet } from '../src/generation/PhysicsEngine.js';
import { SeededRandom } from '../src/generation/SeededRandom.js';

const grid = { n: 16, lat0Deg: 0, lat1Deg: 80, domainKm: 4000, seed: 'ti-1' };
const zones = { frostLine: 4.85, hzInner: 0.95, hzOuter: 1.67, starType: 'G',
                metallicity: 0.0, luminosity: 1.0, starMassSolar: 1.0, ageGyr: 4.5,
                hasExotic: false, sizeBias: 0 };

describe('worldengine base — F2 tidal integration (real generator)', () => {
  it('a tidally-heated body produces a larger tidal driver than a near-circular control; control ~= 0', () => {
    // CONTROL: real full generator, distant near-circular orbit -> D12 reads ~0
    const control = PlanetGenerator.generate(new SeededRandom('wd-ctl'), 5.0, null, zones);
    const controlDrive = makeBaseStep(adaptL0(control), grid).drivers.tidalHeat;

    // HEATED: real D12 kernel (the fn generate() calls), retained ecc + close orbit
    const heatedTidal = tidalHeatingPlanet(0.2, zones.starMassSolar, control.radiusEarth, 0.3);
    const heated = { ...control, tidalHeating: heatedTidal };
    const heatedDrive = makeBaseStep(adaptL0(heated), grid).drivers.tidalHeat;

    expect(heatedTidal).toBeGreaterThan(0);
    expect(controlDrive).toBeLessThan(0.05);          // control ~= 0
    expect(heatedDrive).toBeGreaterThan(controlDrive); // heated > control
    expect(heatedDrive).toBeGreaterThan(0);
  });
});
