/**
 * GravityField -- runtime gravity service for a star system.
 *
 * Initialized from systemData (star + planets + moons) and references
 * to their Three.js meshes. Each frame, call tick() to snapshot body
 * positions, then use accelerationAt() / dominantBodyAt() to query
 * the gravitational field at any point.
 *
 * Uses patched-conic approximation: at any point, gravity is dominated
 * by one body (the one whose SOI you're inside). Optional perturbation
 * from the next-strongest body is included for smoother transitions.
 *
 * Mass units: solar masses (consistent with OrbitalMechanics.G_SCENE).
 * Distance units: scene units (1 AU = 1000).
 */

import * as THREE from 'three';
import { OrbitalMechanics } from './OrbitalMechanics.js';
import { AU_TO_SCENE } from '../core/ScaleConstants.js';
import { estimateMassEarth } from '../generation/PhysicsEngine.js';

// Conversion factors for mass
const M_EARTH_KG = 5.972e24;
const M_SUN_KG   = 1.989e30;
const EARTH_TO_SOLAR = M_EARTH_KG / M_SUN_KG;  // ~3.003e-6

/**
 * @typedef {Object} BodyEntry
 * @property {string} name - human-readable label (e.g. "star", "planet-0", "moon-1-2")
 * @property {number} mass - mass in solar masses
 * @property {number} soiRadius - sphere-of-influence radius in scene units (0 for the star)
 * @property {number} hillRadius - Hill sphere radius in scene units (0 for the star)
 * @property {number} parentIndex - index of parent body (-1 for the star)
 * @property {THREE.Vector3} position - live position (updated each tick)
 * @property {THREE.Object3D|null} mesh - reference to the Three.js object (null = fixed at origin)
 */

export class GravityField {
  /** @type {BodyEntry[]} */
  bodies = [];

  /** Precomputed Lagrange points for significant body pairs (planet around star) */
  _lagrangeCache = new Map();

  /**
   * Build the gravity field from system generation data.
   *
   * @param {object} systemData - output of StarSystemGenerator.generate()
   * @param {object} bodyMeshes - map of mesh references:
   *   {
   *     star: THREE.Object3D,              // the star mesh (or group)
   *     star2?: THREE.Object3D,            // secondary star if binary
   *     planets: THREE.Object3D[],         // one per planet, in order
   *     moons: THREE.Object3D[][]          // moons[planetIndex][moonIndex]
   *   }
   *
   *   Each Object3D just needs a .position (Vector3) that gets updated
   *   by the animation loop before GravityField.tick() is called.
   */
  constructor(systemData, bodyMeshes) {
    this._systemData = systemData;
    this._bodyMeshes = bodyMeshes;

    this._buildBodies(systemData, bodyMeshes);
    this._computeLagrangePoints();
  }

  /**
   * Build the body registry from systemData.
   */
  _buildBodies(systemData, meshes) {
    const bodies = this.bodies;

    // ---- Star (index 0) ----
    // Star mass: stored in zones.starMassSolar, or derive from radius
    const starMassSolar = systemData.zones?.starMassSolar
      ?? systemData.formation?.diskMass  // fallback heuristic
      ?? Math.pow(systemData.star.radiusSolar, 1.25);  // M-R relation from StarSystemGenerator

    // Actually, starMassSolar lives directly in the formation context or can be
    // recomputed. The generator uses: starMassSolar = radiusSolar^1.25
    // Let's use the same formula to be consistent.
    const starMass = Math.pow(systemData.star.radiusSolar, 1.25);

    bodies.push({
      name: 'star',
      mass: starMass,
      soiRadius: Infinity,   // star's SOI covers the whole system
      hillRadius: Infinity,
      parentIndex: -1,
      position: new THREE.Vector3(),
      mesh: meshes.star ?? null,
    });

    const starIndex = 0;

    // ---- Secondary star (index 1, if binary) ----
    if (systemData.isBinary && systemData.star2) {
      const star2Mass = Math.pow(systemData.star2.radiusSolar, 1.25);
      const binarySepScene = systemData.binarySeparationScene
        || systemData.binarySeparationAU * AU_TO_SCENE;

      bodies.push({
        name: 'star2',
        mass: star2Mass,
        soiRadius: OrbitalMechanics.soiRadius(binarySepScene, star2Mass, starMass),
        hillRadius: OrbitalMechanics.hillSphereRadius(binarySepScene, star2Mass, starMass),
        parentIndex: starIndex,
        position: new THREE.Vector3(),
        mesh: meshes.star2 ?? null,
      });
    }

    // ---- Planets ----
    const planets = systemData.planets || [];
    for (let i = 0; i < planets.length; i++) {
      const p = planets[i];
      const pd = p.planetData;

      // Planet mass in solar masses
      // planetData.massEarth is computed by PlanetGenerator via estimateMassEarth()
      const massEarth = pd.massEarth ?? estimateMassEarth(pd.radiusEarth, pd.type);
      const massSolar = massEarth * EARTH_TO_SOLAR;

      // Orbital distance in scene units
      const orbitScene = p.orbitRadiusScene ?? (p.orbitRadiusAU * AU_TO_SCENE);

      const hillR = OrbitalMechanics.hillSphereRadius(orbitScene, massSolar, starMass);
      const soiR = 0.9 * hillR;

      bodies.push({
        name: `planet-${i}`,
        mass: massSolar,
        soiRadius: soiR,
        hillRadius: hillR,
        parentIndex: starIndex,
        position: new THREE.Vector3(),
        mesh: (meshes.planets && meshes.planets[i]) ?? null,
      });

      const planetBodyIndex = bodies.length - 1;

      // ---- Moons of this planet ----
      const moons = p.moons || [];
      for (let m = 0; m < moons.length; m++) {
        const moon = moons[m];

        // Moon mass: estimate from radiusEarth and type
        // Moons don't have massEarth in their data, so we estimate
        const moonMassEarth = this._estimateMoonMass(moon);
        const moonMassSolar = moonMassEarth * EARTH_TO_SOLAR;

        // Moon orbital distance from planet (scene units)
        const moonOrbitScene = moon.orbitRadiusScene ?? 0;

        const moonHillR = moonOrbitScene > 0
          ? OrbitalMechanics.hillSphereRadius(moonOrbitScene, moonMassSolar, massSolar)
          : 0;
        const moonSoiR = 0.9 * moonHillR;

        bodies.push({
          name: `moon-${i}-${m}`,
          mass: moonMassSolar,
          soiRadius: moonSoiR,
          hillRadius: moonHillR,
          parentIndex: planetBodyIndex,
          position: new THREE.Vector3(),
          mesh: (meshes.moons && meshes.moons[i] && meshes.moons[i][m]) ?? null,
        });
      }
    }
  }

  /**
   * Estimate moon mass from its radiusEarth and type.
   * Uses the same estimateMassEarth from PhysicsEngine for rocky bodies,
   * or a simpler radius^3 * density model for captured bodies.
   */
  _estimateMoonMass(moonData) {
    const r = moonData.radiusEarth ?? 0.01;
    if (moonData.type === 'terrestrial') {
      // Terrestrial moons have higher density (planet-class)
      return estimateMassEarth(r, 'rocky');
    }
    // Regular and captured moons: lower density ice/rock mix
    // Rough: M ~ R^2.5 (less dense than rocky planets)
    return Math.pow(r, 2.5) * 0.5;
  }

  /**
   * Precompute Lagrange points for each planet orbiting the star.
   * Only computes for direct children of the star (planets, not moons).
   */
  _computeLagrangePoints() {
    const star = this.bodies[0];
    for (let i = 1; i < this.bodies.length; i++) {
      const body = this.bodies[i];
      if (body.parentIndex !== 0) continue; // only star's direct children

      // Need the orbital distance (current position to star)
      // At init time, positions may not be set yet, so use systemData orbits
      const planet = this._systemData.planets?.find((_, pi) => {
        return this.bodies.indexOf(body) === this._planetBodyIndex(pi);
      });
      if (!planet) continue;

      const sepScene = planet.orbitRadiusScene ?? (planet.orbitRadiusAU * AU_TO_SCENE);
      if (sepScene <= 0) continue;

      const lp = OrbitalMechanics.lagrangePoints(star.mass, body.mass, sepScene);
      this._lagrangeCache.set(i, lp);
    }
  }

  /**
   * Get the body index for planet i (accounting for star, optional star2, and preceding moons).
   */
  _planetBodyIndex(planetIndex) {
    // Star is index 0, optional star2 is index 1
    let idx = this._systemData.isBinary && this._systemData.star2 ? 2 : 1;
    const planets = this._systemData.planets || [];
    for (let p = 0; p < planetIndex; p++) {
      idx++; // the planet itself
      idx += (planets[p].moons?.length ?? 0); // its moons
    }
    return idx; // this is the planet's index
  }

  /**
   * Update body positions from their meshes. Call once per frame,
   * after the animation loop has updated mesh positions.
   */
  tick() {
    for (const body of this.bodies) {
      if (body.mesh && body.mesh.position) {
        body.position.copy(body.mesh.position);
      }
      // If no mesh, position stays at whatever it was set to (default origin for star)
    }
  }

  /**
   * Core query: what gravitational acceleration does a point feel?
   *
   * Uses patched conic: finds the dominant body (whose SOI we're in),
   * computes gravity from it, then optionally adds perturbation from
   * the next-strongest body for smoother transitions.
   *
   * @param {THREE.Vector3} position - query point in scene units
   * @returns {{
   *   acceleration: THREE.Vector3,
   *   dominantBody: BodyEntry,
   *   dominantIndex: number,
   *   distToDominant: number,
   *   inSOI: boolean
   * }}
   */
  accelerationAt(position) {
    const dom = this.dominantBodyAt(position);
    const acc = new THREE.Vector3();

    if (!dom) {
      return { acceleration: acc, dominantBody: null, dominantIndex: -1, distToDominant: 0, inSOI: false };
    }

    // Direction from position toward dominant body
    const dir = new THREE.Vector3().subVectors(dom.body.position, position);
    const dist = dir.length();

    if (dist > 0) {
      const magnitude = OrbitalMechanics.gravitationalAcceleration(dom.body.mass, dist);
      acc.copy(dir).normalize().multiplyScalar(magnitude);
    }

    // Perturbation from the parent of the dominant body (if not the star)
    if (dom.body.parentIndex >= 0) {
      const parent = this.bodies[dom.body.parentIndex];
      const parentDir = new THREE.Vector3().subVectors(parent.position, position);
      const parentDist = parentDir.length();
      if (parentDist > 0) {
        const parentMag = OrbitalMechanics.gravitationalAcceleration(parent.mass, parentDist);
        acc.add(parentDir.normalize().multiplyScalar(parentMag));
      }
    }

    return {
      acceleration: acc,
      dominantBody: dom.body,
      dominantIndex: dom.index,
      distToDominant: dom.distance,
      inSOI: dom.inSOI,
    };
  }

  /**
   * Which body's SOI is this position inside?
   *
   * Search from most-specific (moons) to least-specific (star).
   * A point is "in" a body's SOI if it's within soiRadius of that body
   * AND within the parent's SOI.
   *
   * @param {THREE.Vector3} position - query point in scene units
   * @returns {{ body: BodyEntry, index: number, mass: number, meshPosition: THREE.Vector3, soiRadius: number, hillRadius: number, distance: number, inSOI: boolean } | null}
   */
  dominantBodyAt(position) {
    // Start with the star as default dominant
    let bestBody = this.bodies[0];
    let bestIndex = 0;
    let bestDist = position.distanceTo(bestBody.position);
    let inSOI = true; // always in the star's SOI

    // Check all non-star bodies from most specific to least
    // We iterate and pick the smallest SOI that contains the position
    for (let i = 1; i < this.bodies.length; i++) {
      const body = this.bodies[i];
      const dist = position.distanceTo(body.position);

      if (dist < body.soiRadius) {
        // We're inside this body's SOI. If it's more specific than
        // the current best (smaller SOI), prefer it.
        if (body.soiRadius < bestBody.soiRadius) {
          bestBody = body;
          bestIndex = i;
          bestDist = dist;
          inSOI = true;
        }
      }
    }

    return {
      body: bestBody,
      index: bestIndex,
      mass: bestBody.mass,
      meshPosition: bestBody.position.clone(),
      soiRadius: bestBody.soiRadius,
      hillRadius: bestBody.hillRadius,
      distance: bestDist,
      inSOI,
    };
  }

  /**
   * Get precomputed Lagrange points for a body (by its index in this.bodies).
   *
   * @param {number} bodyIndex - index into this.bodies
   * @returns {{ L1: number, L2: number, L3: number, L4: {x: number, y: number}, L5: {x: number, y: number} } | null}
   */
  getLagrangePoints(bodyIndex) {
    return this._lagrangeCache.get(bodyIndex) ?? null;
  }

  /**
   * Circular orbit velocity at this position around the dominant body.
   *
   * @param {THREE.Vector3} position - query point in scene units
   * @returns {number} speed in scene units per second
   */
  circularVelocityAt(position) {
    const dom = this.dominantBodyAt(position);
    if (!dom) return 0;
    return OrbitalMechanics.circularVelocity(dom.body.mass, dom.distance);
  }

  /**
   * Escape velocity at this position from the dominant body.
   *
   * @param {THREE.Vector3} position - query point in scene units
   * @returns {number} speed in scene units per second
   */
  escapeVelocityAt(position) {
    const dom = this.dominantBodyAt(position);
    if (!dom) return 0;
    return OrbitalMechanics.escapeVelocity(dom.body.mass, dom.distance);
  }
}
