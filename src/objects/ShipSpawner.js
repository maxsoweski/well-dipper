import * as THREE from 'three';
import { loadManifest, availableArchetypes, loadShipModel } from './ShipLoader.js';

/**
 * ShipSpawner — places procedural ships as flavor objects in star systems.
 *
 * Ships orbit near planets at a fixed distance, slowly rotating.
 * They're tiny compared to planets (fighter-scale), purely decorative.
 *
 * Usage:
 *   const spawner = new ShipSpawner();
 *   await spawner.init();                      // load manifest once
 *   spawner.spawnForSystem(scene, systemData, planetEntries, rng);
 *   // in animate loop:
 *   spawner.update(deltaTime);
 *   // on system change:
 *   spawner.clear(scene);
 */

const SHIP_SCALE_FACTOR = 0.003;  // ships are tiny relative to scene units (planet radii ~0.01-3.5)

export class ShipSpawner {
  constructor() {
    this.ready = false;
    this.ships = [];  // { mesh, orbitCenter, orbitRadius, orbitAngle, orbitSpeed, orbitInclination, rotSpeed }
  }

  async init() {
    const manifest = await loadManifest();
    this.ready = manifest !== null && availableArchetypes().length > 0;
    if (this.ready) {
      console.log(`ShipSpawner: ${availableArchetypes().length} archetypes available`);
    } else {
      console.log('ShipSpawner: no ship models available');
    }
  }

  /**
   * Spawn ships for a star system.
   * Places 1-3 ships near each inhabited-looking planet (50% chance per planet).
   *
   * @param {THREE.Scene} scene
   * @param {Object} systemData - from StarSystemGenerator
   * @param {Array} planetEntries - the system.planets array (with .planet.mesh, .orbitRadius, etc.)
   * @param {function} rng - seeded random function returning 0-1
   */
  async spawnForSystem(scene, systemData, planetEntries, rng) {
    if (!this.ready || planetEntries.length === 0) return;

    const archetypes = availableArchetypes();
    if (archetypes.length === 0) return;

    for (let i = 0; i < planetEntries.length; i++) {
      const entry = planetEntries[i];
      const roll = rng();

      // 50% of planets get ships nearby
      if (roll > 0.5) continue;

      // 1-3 ships per planet
      const shipCount = Math.floor(rng() * 3) + 1;

      for (let s = 0; s < shipCount; s++) {
        const archetype = archetypes[Math.floor(rng() * archetypes.length)];
        const model = await loadShipModel(archetype, undefined, rng);
        if (!model) continue;

        // Scale the ship to be visible but small relative to planets.
        // Planet scene radii range from ~0.004 (small moons) to ~3.5 (gas giants).
        // We want ships at roughly 1/10 to 1/5 of the planet radius.
        const planetRadius = entry.planet.data?.radius || 0.5;
        const shipSize = Math.max(0.002, planetRadius * (0.05 + rng() * 0.1));
        model.scale.setScalar(shipSize);

        // Enable flat shading on all materials in the model for retro look
        model.traverse(child => {
          if (child.isMesh && child.material) {
            child.material.flatShading = true;
            child.material.needsUpdate = true;
          }
        });

        // Orbit parameters: ship orbits near the planet
        const orbitRadius = planetRadius * (2.5 + rng() * 3.0);
        const orbitAngle = rng() * Math.PI * 2;
        const orbitSpeed = (0.15 + rng() * 0.3) * (rng() < 0.5 ? 1 : -1);
        const orbitInclination = (rng() - 0.5) * 0.3;  // slight random tilt
        const rotSpeed = (0.5 + rng() * 1.5) * (rng() < 0.5 ? 1 : -1);

        scene.add(model);

        this.ships.push({
          mesh: model,
          planetIndex: i,
          orbitRadius,
          orbitAngle,
          orbitSpeed,
          orbitInclination,
          rotSpeed,
        });
      }
    }

    if (this.ships.length > 0) {
      console.log(`ShipSpawner: placed ${this.ships.length} ships`);
    }
  }

  /**
   * Update ship positions — orbit around their parent planet.
   * @param {number} deltaTime
   * @param {Array} planetEntries - current system.planets for live planet positions
   */
  update(deltaTime, planetEntries) {
    for (const ship of this.ships) {
      // Advance orbit
      ship.orbitAngle += ship.orbitSpeed * deltaTime;

      // Get parent planet's current world position
      const entry = planetEntries[ship.planetIndex];
      if (!entry) continue;
      const pp = entry.planet.mesh.position;

      // Position ship in orbit around the planet
      const r = ship.orbitRadius;
      const a = ship.orbitAngle;
      const incl = ship.orbitInclination;
      ship.mesh.position.set(
        pp.x + Math.cos(a) * r,
        pp.y + Math.sin(incl) * Math.sin(a) * r,
        pp.z + Math.cos(incl) * Math.sin(a) * r,
      );

      // Spin the ship slowly
      ship.mesh.rotation.y += ship.rotSpeed * deltaTime;
    }
  }

  /**
   * Remove all ships from the scene and dispose resources.
   * @param {THREE.Scene} scene
   */
  clear(scene) {
    for (const ship of this.ships) {
      scene.remove(ship.mesh);
      ship.mesh.traverse(child => {
        if (child.isMesh) {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(m => m.dispose());
            } else {
              child.material.dispose();
            }
          }
        }
      });
    }
    this.ships = [];
  }
}
