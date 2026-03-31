/**
 * OrbitalMechanics -- pure math helper functions for orbital physics.
 *
 * All methods are static and have no dependencies on Three.js or game state.
 * They operate in scene units (1 AU = 1000 scene units) using a pre-computed
 * gravitational constant G_SCENE that makes the math work at scene scale.
 *
 * Used by GravityField for runtime gravity queries, and eventually by the
 * gravity-aware camera system.
 */

import { AU_TO_SCENE } from '../core/ScaleConstants.js';

// ---- Real-world constants ----
const G_REAL = 6.674e-11;       // m^3 / (kg * s^2)
const M_SUN  = 1.989e30;        // kg
const AU_M   = 1.496e11;        // meters per AU

/**
 * Derive the scene-scale gravitational constant.
 *
 * In real units:  a = G * M / r^2    (meters, kg, seconds)
 *
 * We want to work in scene units where 1 AU = AU_TO_SCENE (1000).
 * If we measure distance in scene units and mass in solar masses:
 *
 *   r_scene = r_meters / AU_M * AU_TO_SCENE
 *   M_solar = M_kg / M_SUN
 *
 * Then:  G_SCENE = G_REAL * M_SUN / (AU_M / AU_TO_SCENE)^3  ...but we also
 * need to pick a time unit. We use seconds, which means velocities come out
 * in scene-units/second and accelerations in scene-units/second^2.
 *
 * G_SCENE = G_REAL * M_SUN * AU_TO_SCENE^3 / AU_M^3
 *
 * This way:  a_scene = G_SCENE * M_solar / r_scene^2
 * and:       v_circ  = sqrt(G_SCENE * M_solar / r_scene)
 */
function computeGScene() {
  // G_REAL * M_SUN gives us m^3/s^2 for 1 solar mass
  // Dividing by (AU_M / AU_TO_SCENE)^3 converts m^3 -> scene_units^3
  const metersPerSceneUnit = AU_M / AU_TO_SCENE;
  return (G_REAL * M_SUN) / Math.pow(metersPerSceneUnit, 3);
}

export class OrbitalMechanics {
  /**
   * Scene-scale gravitational constant.
   * Units: scene_units^3 / (solar_masses * s^2)
   *
   * Usage: acceleration = G_SCENE * mass_solar / distance_scene^2
   */
  static G_SCENE = computeGScene();

  /**
   * Circular orbital velocity at distance r from a body of mass M.
   * @param {number} mass - body mass in solar masses
   * @param {number} distance - distance in scene units
   * @returns {number} velocity in scene units per second
   */
  static circularVelocity(mass, distance) {
    if (distance <= 0) return 0;
    return Math.sqrt(this.G_SCENE * mass / distance);
  }

  /**
   * Escape velocity at distance r from a body of mass M.
   * Always sqrt(2) times the circular velocity.
   * @param {number} mass - body mass in solar masses
   * @param {number} distance - distance in scene units
   * @returns {number} velocity in scene units per second
   */
  static escapeVelocity(mass, distance) {
    if (distance <= 0) return 0;
    return Math.sqrt(2 * this.G_SCENE * mass / distance);
  }

  /**
   * Hill sphere radius -- the region where a body's gravity dominates
   * over its parent's gravity.
   *
   * Formula: R_hill = a * (m / (3 * M))^(1/3)
   *
   * @param {number} orbitalDistance - semi-major axis (scene units)
   * @param {number} bodyMass - mass of the orbiting body (solar masses)
   * @param {number} parentMass - mass of the parent body (solar masses)
   * @returns {number} Hill sphere radius in scene units
   */
  static hillSphereRadius(orbitalDistance, bodyMass, parentMass) {
    if (parentMass <= 0 || orbitalDistance <= 0) return 0;
    return orbitalDistance * Math.cbrt(bodyMass / (3 * parentMass));
  }

  /**
   * Sphere of influence radius -- practical gravitational boundary.
   * 90% of the Hill sphere, which is where orbits are actually stable.
   *
   * @param {number} orbitalDistance - semi-major axis (scene units)
   * @param {number} bodyMass - mass of the orbiting body (solar masses)
   * @param {number} parentMass - mass of the parent body (solar masses)
   * @returns {number} SOI radius in scene units
   */
  static soiRadius(orbitalDistance, bodyMass, parentMass) {
    return 0.9 * this.hillSphereRadius(orbitalDistance, bodyMass, parentMass);
  }

  /**
   * Gravitational acceleration magnitude toward a body at a given distance.
   * Caller handles direction (subtract positions, normalize, multiply by this).
   *
   * @param {number} mass - body mass in solar masses
   * @param {number} distance - distance in scene units
   * @returns {number} acceleration magnitude in scene units per second^2
   */
  static gravitationalAcceleration(mass, distance) {
    if (distance <= 0) return 0;
    return this.G_SCENE * mass / (distance * distance);
  }

  /**
   * Lagrange point positions for a two-body system.
   *
   * L1, L2, L3 lie on the line between the two bodies.
   * L4, L5 form equilateral triangles with both bodies.
   *
   * All positions are returned as offsets from the primary body,
   * along the axis from primary toward secondary.
   *
   * @param {number} primaryMass - mass of primary (solar masses)
   * @param {number} secondaryMass - mass of secondary (solar masses)
   * @param {number} separation - distance between bodies (scene units)
   * @returns {{ L1: number, L2: number, L3: number, L4: {x: number, y: number}, L5: {x: number, y: number} }}
   *   L1/L2/L3: signed distance from primary along primary->secondary axis
   *   L4/L5: {x, y} offset from primary (x along axis, y perpendicular)
   */
  static lagrangePoints(primaryMass, secondaryMass, separation) {
    if (separation <= 0 || primaryMass <= 0) {
      return { L1: 0, L2: 0, L3: 0, L4: { x: 0, y: 0 }, L5: { x: 0, y: 0 } };
    }

    const mu = secondaryMass / (primaryMass + secondaryMass);
    const a = separation;

    // L1: between the bodies, closer to the secondary
    // Approximate: r_L1 = a * (1 - (mu/3)^(1/3))
    const cubertMuOver3 = Math.cbrt(mu / 3);
    const L1 = a * (1 - cubertMuOver3);

    // L2: beyond the secondary (away from primary)
    // Approximate: r_L2 = a * (1 + (mu/3)^(1/3))
    const L2 = a * (1 + cubertMuOver3);

    // L3: beyond the primary (opposite side from secondary)
    // Approximate: r_L3 = -a * (1 + (5*mu/12))
    const L3 = -a * (1 + (5 * mu / 12));

    // L4 and L5: equilateral triangle points
    // At 60 degrees ahead/behind the secondary in its orbit
    const L4x = a * 0.5;   // halfway along axis
    const L4y = a * (Math.sqrt(3) / 2);  // perpendicular offset

    return {
      L1,
      L2,
      L3,
      L4: { x: L4x, y: L4y },
      L5: { x: L4x, y: -L4y },
    };
  }

  /**
   * Check if a velocity vector describes a roughly circular orbit.
   *
   * Two conditions must hold:
   * 1. Speed is close to circular velocity (within tolerance)
   * 2. Velocity is roughly perpendicular to the radial direction
   *
   * @param {number[]} position - [x, y, z] of the orbiting object (scene units)
   * @param {number[]} velocity - [vx, vy, vz] of the orbiting object (scene units/s)
   * @param {number[]} bodyPosition - [x, y, z] of the central body (scene units)
   * @param {number} bodyMass - mass of the central body (solar masses)
   * @param {number} tolerance - fractional tolerance (0.2 = 20%)
   * @returns {boolean} true if orbit is approximately circular
   */
  static isNearCircular(position, velocity, bodyPosition, bodyMass, tolerance = 0.2) {
    // Radial vector from body to object
    const rx = position[0] - bodyPosition[0];
    const ry = position[1] - bodyPosition[1];
    const rz = position[2] - bodyPosition[2];
    const dist = Math.sqrt(rx * rx + ry * ry + rz * rz);
    if (dist <= 0) return false;

    // Speed
    const speed = Math.sqrt(
      velocity[0] * velocity[0] +
      velocity[1] * velocity[1] +
      velocity[2] * velocity[2]
    );
    if (speed <= 0) return false;

    // Condition 1: speed close to circular velocity
    const vCirc = this.circularVelocity(bodyMass, dist);
    if (vCirc <= 0) return false;
    const speedRatio = speed / vCirc;
    if (Math.abs(speedRatio - 1) > tolerance) return false;

    // Condition 2: velocity roughly perpendicular to radial
    // dot(velocity, radial_unit) should be near zero
    const radialDot = (velocity[0] * rx + velocity[1] * ry + velocity[2] * rz) / (dist * speed);
    // radialDot is cos(angle between v and r). For perpendicular, cos = 0.
    // Allow some deviation: |cos| < tolerance
    if (Math.abs(radialDot) > tolerance) return false;

    return true;
  }
}
