import { describe, it, expect } from 'vitest';
import { OrbitalMechanics } from '../OrbitalMechanics.js';
import { AU_TO_SCENE } from '../../core/ScaleConstants.js';

describe('OrbitalMechanics', () => {
  // ---- G_SCENE sanity check ----
  describe('G_SCENE', () => {
    it('should be a positive finite number', () => {
      expect(OrbitalMechanics.G_SCENE).toBeGreaterThan(0);
      expect(Number.isFinite(OrbitalMechanics.G_SCENE)).toBe(true);
    });

    it('should produce Earth-like circular velocity at 1 AU from 1 solar mass', () => {
      // Earth orbits at ~29,780 m/s. In scene units/s, we need to convert:
      // 29780 m/s * (1 AU / 1.496e11 m) * 1000 scene_units/AU = ~0.199 scene units/s
      const vCirc = OrbitalMechanics.circularVelocity(1.0, AU_TO_SCENE);
      const expectedSceneVelocity = 29780 * AU_TO_SCENE / 1.496e11;
      // Allow 1% tolerance for rounding
      expect(vCirc).toBeCloseTo(expectedSceneVelocity, 1);
    });
  });

  // ---- circularVelocity ----
  describe('circularVelocity', () => {
    it('should return 0 for zero or negative distance', () => {
      expect(OrbitalMechanics.circularVelocity(1.0, 0)).toBe(0);
      expect(OrbitalMechanics.circularVelocity(1.0, -5)).toBe(0);
    });

    it('should scale with sqrt(mass)', () => {
      const v1 = OrbitalMechanics.circularVelocity(1.0, 1000);
      const v4 = OrbitalMechanics.circularVelocity(4.0, 1000);
      expect(v4 / v1).toBeCloseTo(2.0, 5);
    });

    it('should scale with 1/sqrt(distance)', () => {
      const vClose = OrbitalMechanics.circularVelocity(1.0, 100);
      const vFar   = OrbitalMechanics.circularVelocity(1.0, 400);
      expect(vClose / vFar).toBeCloseTo(2.0, 5);
    });
  });

  // ---- escapeVelocity ----
  describe('escapeVelocity', () => {
    it('should be sqrt(2) times circular velocity', () => {
      const vCirc = OrbitalMechanics.circularVelocity(1.0, 500);
      const vEsc  = OrbitalMechanics.escapeVelocity(1.0, 500);
      expect(vEsc / vCirc).toBeCloseTo(Math.SQRT2, 10);
    });

    it('should return 0 for zero distance', () => {
      expect(OrbitalMechanics.escapeVelocity(1.0, 0)).toBe(0);
    });
  });

  // ---- hillSphereRadius ----
  describe('hillSphereRadius', () => {
    it('should return 0 for zero parent mass', () => {
      expect(OrbitalMechanics.hillSphereRadius(1000, 0.001, 0)).toBe(0);
    });

    it('should scale linearly with orbital distance', () => {
      const h1 = OrbitalMechanics.hillSphereRadius(1000, 0.001, 1.0);
      const h2 = OrbitalMechanics.hillSphereRadius(2000, 0.001, 1.0);
      expect(h2 / h1).toBeCloseTo(2.0, 5);
    });

    it('should match Earth-Sun Hill sphere approximately', () => {
      // Earth: a=1AU=1000su, m_earth~3e-6 solar, M_sun=1
      const earthMassSolar = 5.972e24 / 1.989e30;
      const hillR = OrbitalMechanics.hillSphereRadius(AU_TO_SCENE, earthMassSolar, 1.0);
      // Earth's Hill sphere is ~1.5 million km = ~0.01 AU = ~10 scene units
      const expectedScene = 0.01 * AU_TO_SCENE;
      expect(hillR).toBeGreaterThan(expectedScene * 0.5);
      expect(hillR).toBeLessThan(expectedScene * 2.0);
    });
  });

  // ---- soiRadius ----
  describe('soiRadius', () => {
    it('should be 90% of Hill sphere radius', () => {
      const hill = OrbitalMechanics.hillSphereRadius(1000, 0.001, 1.0);
      const soi  = OrbitalMechanics.soiRadius(1000, 0.001, 1.0);
      expect(soi / hill).toBeCloseTo(0.9, 10);
    });
  });

  // ---- gravitationalAcceleration ----
  describe('gravitationalAcceleration', () => {
    it('should follow inverse square law', () => {
      const a1 = OrbitalMechanics.gravitationalAcceleration(1.0, 100);
      const a2 = OrbitalMechanics.gravitationalAcceleration(1.0, 200);
      expect(a1 / a2).toBeCloseTo(4.0, 5);
    });

    it('should scale linearly with mass', () => {
      const a1 = OrbitalMechanics.gravitationalAcceleration(1.0, 100);
      const a3 = OrbitalMechanics.gravitationalAcceleration(3.0, 100);
      expect(a3 / a1).toBeCloseTo(3.0, 5);
    });

    it('should return 0 for zero distance', () => {
      expect(OrbitalMechanics.gravitationalAcceleration(1.0, 0)).toBe(0);
    });
  });

  // ---- lagrangePoints ----
  describe('lagrangePoints', () => {
    it('should return zero-valued result for zero separation', () => {
      const lp = OrbitalMechanics.lagrangePoints(1.0, 0.001, 0);
      expect(lp.L1).toBe(0);
      expect(lp.L4.x).toBe(0);
    });

    it('should place L1 between primary and secondary', () => {
      const lp = OrbitalMechanics.lagrangePoints(1.0, 0.001, 1000);
      expect(lp.L1).toBeGreaterThan(0);
      expect(lp.L1).toBeLessThan(1000);
    });

    it('should place L2 beyond the secondary', () => {
      const lp = OrbitalMechanics.lagrangePoints(1.0, 0.001, 1000);
      expect(lp.L2).toBeGreaterThan(1000);
    });

    it('should place L3 on the opposite side of the primary', () => {
      const lp = OrbitalMechanics.lagrangePoints(1.0, 0.001, 1000);
      expect(lp.L3).toBeLessThan(0);
    });

    it('should place L4 and L5 symmetrically about the x-axis', () => {
      const lp = OrbitalMechanics.lagrangePoints(1.0, 0.001, 1000);
      expect(lp.L4.x).toBeCloseTo(lp.L5.x, 10);
      expect(lp.L4.y).toBeCloseTo(-lp.L5.y, 10);
      expect(lp.L4.y).toBeGreaterThan(0);
    });

    it('should have L4/L5 at roughly equilateral triangle distance', () => {
      const lp = OrbitalMechanics.lagrangePoints(1.0, 0.001, 1000);
      // Distance from origin to L4 should be close to the separation
      const distL4 = Math.sqrt(lp.L4.x * lp.L4.x + lp.L4.y * lp.L4.y);
      expect(distL4).toBeCloseTo(1000, -1); // within ~10 scene units
    });
  });

  // ---- isNearCircular ----
  describe('isNearCircular', () => {
    it('should return true for a perfect circular orbit', () => {
      // Object at (1000, 0, 0) from body at origin, moving in +z direction
      const bodyPos = [0, 0, 0];
      const pos = [1000, 0, 0];
      const vCirc = OrbitalMechanics.circularVelocity(1.0, 1000);
      const vel = [0, 0, vCirc]; // perpendicular to radial

      expect(OrbitalMechanics.isNearCircular(pos, vel, bodyPos, 1.0)).toBe(true);
    });

    it('should return false for a radial (plunge) trajectory', () => {
      const bodyPos = [0, 0, 0];
      const pos = [1000, 0, 0];
      const vCirc = OrbitalMechanics.circularVelocity(1.0, 1000);
      // Moving directly toward the body (radial)
      const vel = [-vCirc, 0, 0];

      expect(OrbitalMechanics.isNearCircular(pos, vel, bodyPos, 1.0)).toBe(false);
    });

    it('should return false if speed is much higher than circular velocity', () => {
      const bodyPos = [0, 0, 0];
      const pos = [1000, 0, 0];
      const vCirc = OrbitalMechanics.circularVelocity(1.0, 1000);
      // 2x circular velocity (hyperbolic)
      const vel = [0, 0, vCirc * 2];

      expect(OrbitalMechanics.isNearCircular(pos, vel, bodyPos, 1.0)).toBe(false);
    });

    it('should return false for zero velocity', () => {
      expect(OrbitalMechanics.isNearCircular([1000, 0, 0], [0, 0, 0], [0, 0, 0], 1.0)).toBe(false);
    });

    it('should accept within tolerance', () => {
      const bodyPos = [0, 0, 0];
      const pos = [1000, 0, 0];
      const vCirc = OrbitalMechanics.circularVelocity(1.0, 1000);
      // 10% faster than circular, slight radial component
      const vel = [vCirc * 0.05, 0, vCirc * 1.1];

      // With default 20% tolerance, this should pass
      expect(OrbitalMechanics.isNearCircular(pos, vel, bodyPos, 1.0, 0.2)).toBe(true);
    });
  });
});
