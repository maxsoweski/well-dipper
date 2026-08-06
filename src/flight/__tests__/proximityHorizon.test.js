import { describe, it, expect } from 'vitest';
import { starMassKgFromSceneRadius, forcedDropRadiusScene } from '../proximityHorizon.js';
import { solarRadiiToScene } from '../../core/ScaleConstants.js';
import { SC_TUNING } from '../SupercruiseModel.js';

describe('proximityHorizon', () => {
  it('a 1-solar-radius star derives ≈1 solar mass (1.989e30 kg)', () => {
    const sceneR = solarRadiiToScene(1); // 4.65 scene-u
    const m = starMassKgFromSceneRadius(sceneR);
    expect(m).toBeGreaterThan(1.9e30);
    expect(m).toBeLessThan(2.1e30);
  });

  it('a more massive (larger) star derives a larger mass', () => {
    const big = starMassKgFromSceneRadius(solarRadiiToScene(10));
    const small = starMassKgFromSceneRadius(solarRadiiToScene(1));
    expect(big).toBeGreaterThan(small);
  });

  it('the G-star horizon is ~4.2 stellar radii (~19-20 scene-u)', () => {
    const sceneR = solarRadiiToScene(1);
    const massKg = starMassKgFromSceneRadius(sceneR);
    const d = forcedDropRadiusScene(massKg, SC_TUNING.SUBLIGHT_CAP);
    expect(d / sceneR).toBeGreaterThan(3.5);
    expect(d / sceneR).toBeLessThan(5.0);
  });

  it('zero / missing mass → zero horizon', () => {
    expect(forcedDropRadiusScene(0, SC_TUNING.SUBLIGHT_CAP)).toBe(0);
    expect(forcedDropRadiusScene(undefined, SC_TUNING.SUBLIGHT_CAP)).toBe(0);
  });
});
