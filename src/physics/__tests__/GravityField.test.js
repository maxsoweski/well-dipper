import { describe, it, expect, beforeEach } from 'vitest';
import { GravityField } from '../GravityField.js';
import { OrbitalMechanics } from '../OrbitalMechanics.js';
import { AU_TO_SCENE } from '../../core/ScaleConstants.js';
import * as THREE from 'three';

/**
 * Minimal systemData fixture that mimics StarSystemGenerator output.
 * One sun-like star with two planets (a rocky inner and a gas giant outer).
 */
function makeTestSystem() {
  return {
    star: {
      type: 'G',
      radiusSolar: 1.0,
      radiusScene: 4.65,
      color: [1, 0.96, 0.92],
      temp: 5600,
      luminosity: 1.0,
    },
    star2: null,
    isBinary: false,
    binarySeparationAU: 0,
    binarySeparationScene: 0,
    planets: [
      {
        planetData: {
          type: 'rocky',
          radiusEarth: 1.0,
          massEarth: 1.0,
          radiusScene: 0.0426,
        },
        orbitRadiusAU: 1.0,
        orbitRadiusScene: AU_TO_SCENE,
        orbitAngle: 0,
        moons: [],
      },
      {
        planetData: {
          type: 'gas-giant',
          radiusEarth: 11.2,
          massEarth: 317.8,
          radiusScene: 0.477,
        },
        orbitRadiusAU: 5.2,
        orbitRadiusScene: 5200,
        orbitAngle: Math.PI / 2,
        moons: [
          {
            type: 'regular',
            radiusEarth: 0.286,
            radiusScene: 0.012,
            orbitRadiusEarth: 66,
            orbitRadiusScene: 2.81,
          },
        ],
      },
    ],
    zones: { starMassSolar: 1.0 },
    formation: { diskMass: 0.03 },
  };
}

function makeMeshes(system) {
  const starMesh = new THREE.Object3D();
  starMesh.position.set(0, 0, 0);

  const planets = system.planets.map((p, i) => {
    const mesh = new THREE.Object3D();
    // Place at orbit distance along x-axis for simplicity
    const x = Math.cos(p.orbitAngle) * p.orbitRadiusScene;
    const z = Math.sin(p.orbitAngle) * p.orbitRadiusScene;
    mesh.position.set(x, 0, z);
    return mesh;
  });

  // One moon on the gas giant
  const moonMesh = new THREE.Object3D();
  const jupiterPos = planets[1].position;
  moonMesh.position.set(jupiterPos.x + 2.81, 0, jupiterPos.z);

  const moons = [
    [],        // rocky planet has no moons
    [moonMesh] // gas giant has one moon
  ];

  return { star: starMesh, planets, moons };
}

describe('GravityField', () => {
  let system, meshes, field;

  beforeEach(() => {
    system = makeTestSystem();
    meshes = makeMeshes(system);
    field = new GravityField(system, meshes);
    field.tick(); // snapshot positions from meshes
  });

  describe('constructor', () => {
    it('should register the star, 2 planets, and 1 moon = 4 bodies', () => {
      expect(field.bodies.length).toBe(4);
      expect(field.bodies[0].name).toBe('star');
      expect(field.bodies[1].name).toBe('planet-0');
      expect(field.bodies[2].name).toBe('planet-1');
      expect(field.bodies[3].name).toBe('moon-1-0');
    });

    it('should give the star infinite SOI', () => {
      expect(field.bodies[0].soiRadius).toBe(Infinity);
    });

    it('should give planets finite positive SOI', () => {
      expect(field.bodies[1].soiRadius).toBeGreaterThan(0);
      expect(Number.isFinite(field.bodies[1].soiRadius)).toBe(true);
      expect(field.bodies[2].soiRadius).toBeGreaterThan(0);
    });

    it('should give the gas giant a larger SOI than the rocky planet', () => {
      // Jupiter-mass at 5.2 AU vs Earth-mass at 1 AU
      expect(field.bodies[2].soiRadius).toBeGreaterThan(field.bodies[1].soiRadius);
    });
  });

  describe('tick', () => {
    it('should copy mesh positions into body entries', () => {
      meshes.star.position.set(1, 2, 3);
      field.tick();
      expect(field.bodies[0].position.x).toBe(1);
      expect(field.bodies[0].position.y).toBe(2);
      expect(field.bodies[0].position.z).toBe(3);
    });
  });

  describe('dominantBodyAt', () => {
    it('should return the star for a point far from all planets', () => {
      const farPoint = new THREE.Vector3(20000, 0, 0); // 20 AU out
      const dom = field.dominantBodyAt(farPoint);
      expect(dom.body.name).toBe('star');
    });

    it('should return the rocky planet for a point very close to it', () => {
      const earthPos = meshes.planets[0].position.clone();
      const nearEarth = earthPos.clone().add(new THREE.Vector3(0.1, 0, 0));
      const dom = field.dominantBodyAt(nearEarth);
      expect(dom.body.name).toBe('planet-0');
    });

    it('should return the gas giant for a point within its SOI', () => {
      const jupPos = meshes.planets[1].position.clone();
      // A point 1 scene unit from Jupiter (well within its SOI)
      const nearJup = jupPos.clone().add(new THREE.Vector3(1, 0, 0));
      const dom = field.dominantBodyAt(nearJup);
      expect(dom.body.name).toBe('planet-1');
    });
  });

  describe('accelerationAt', () => {
    it('should return acceleration pointing toward the dominant body', () => {
      // A point in deep space, should feel gravity toward the star
      const point = new THREE.Vector3(5000, 0, 0);
      const result = field.accelerationAt(point);

      // Acceleration should point in -x direction (toward star at origin)
      expect(result.acceleration.x).toBeLessThan(0);
      expect(result.dominantBody.name).toBe('star');
    });

    it('should produce stronger acceleration closer to the star', () => {
      const close = new THREE.Vector3(500, 0, 0);
      const far   = new THREE.Vector3(2000, 0, 0);
      const accClose = field.accelerationAt(close).acceleration.length();
      const accFar   = field.accelerationAt(far).acceleration.length();
      expect(accClose).toBeGreaterThan(accFar);
    });

    it('should return zero acceleration at the exact position of a body', () => {
      // Acceleration from a body at its own center is 0 (distance = 0)
      const starPos = new THREE.Vector3(0, 0, 0);
      const result = field.accelerationAt(starPos);
      // The dominant body acceleration is 0 (dist=0), but parent perturbation
      // doesn't apply for the star, so total should be 0
      expect(result.acceleration.length()).toBe(0);
    });
  });

  describe('circularVelocityAt', () => {
    it('should return a positive velocity for a point in space', () => {
      // Use 3 AU out on x-axis (not coinciding with any planet mesh)
      const point = new THREE.Vector3(3000, 0, 0);
      const v = field.circularVelocityAt(point);
      expect(v).toBeGreaterThan(0);
    });
  });

  describe('escapeVelocityAt', () => {
    it('should be sqrt(2) times the circular velocity', () => {
      const point = new THREE.Vector3(5000, 0, 0);
      const vCirc = field.circularVelocityAt(point);
      const vEsc  = field.escapeVelocityAt(point);
      expect(vEsc / vCirc).toBeCloseTo(Math.SQRT2, 5);
    });
  });

  describe('getLagrangePoints', () => {
    it('should return Lagrange points for planets', () => {
      // Planet-0 is body index 1 (star=0, planet-0=1)
      const lp = field.getLagrangePoints(1);
      expect(lp).not.toBeNull();
      if (lp) {
        expect(lp.L1).toBeGreaterThan(0);
        expect(lp.L2).toBeGreaterThan(0);
        expect(lp.L3).toBeLessThan(0);
      }
    });

    it('should return null for bodies without cached Lagrange points', () => {
      // Moons don't get Lagrange points cached
      const lp = field.getLagrangePoints(3); // moon-1-0
      expect(lp).toBeNull();
    });
  });
});
