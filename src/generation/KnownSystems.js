/**
 * KnownSystems — registry of handcrafted star systems at specific galactic positions.
 *
 * When the player warps to (or starts at) a position matching a known system,
 * the handcrafted data is used instead of procedural generation.
 *
 * Matching is by galactic position (within a tolerance), not by seed.
 * This means the same known system is always at the same place in the galaxy,
 * regardless of which hash grid star the player clicked.
 *
 * Usage:
 *   const override = KnownSystems.findAt(playerGalacticPos);
 *   if (override) {
 *     systemData = override.generate();
 *   }
 */

import { generateSolarSystem } from './SolarSystemData.js';
import { GalacticMap } from './GalacticMap.js';

// Match tolerance: 5 pc (0.005 kpc). Any star within 5 pc of a known
// system's center will trigger the override. This is generous enough
// to catch the nearest hash grid star to the known position.
const MATCH_RADIUS = 0.005; // kpc

/**
 * Registry of known systems.
 * Each entry has:
 *   - name: display name for the system
 *   - position: { x, y, z } galactic coordinates in kpc
 *   - generate: () => systemData (same format as StarSystemGenerator.generate())
 *   - names: { system, star, star2, planets: [{ name, moons }] } — pre-defined names
 */
const KNOWN_SYSTEMS = [
  {
    name: 'Sol',
    position: { x: GalacticMap.SOLAR_R, y: GalacticMap.SOLAR_Z, z: 0.0 },
    generate: () => {
      const data = generateSolarSystem();
      data._destType = 'star-system';
      data._isKnownSystem = true;
      data._knownSystemName = 'Sol';
      return data;
    },
    names: {
      system: 'Sol',
      star: 'Sol',
      star2: null,
      planets: [
        { name: 'Mercury', moons: [] },
        { name: 'Venus', moons: [] },
        { name: 'Earth', moons: ['Moon'] },
        { name: 'Mars', moons: ['Phobos', 'Deimos'] },
        { name: 'Ceres', moons: [] },
        { name: 'Jupiter', moons: ['Amalthea', 'Io', 'Europa', 'Ganymede', 'Callisto'] },
        { name: 'Saturn', moons: ['Mimas', 'Enceladus', 'Tethys', 'Dione', 'Rhea', 'Titan', 'Hyperion', 'Iapetus', 'Phoebe'] },
        { name: 'Uranus', moons: ['Miranda', 'Ariel', 'Umbriel', 'Titania', 'Oberon'] },
        { name: 'Neptune', moons: ['Proteus', 'Triton'] },
        { name: 'Pluto', moons: ['Charon'] },
        { name: 'Haumea', moons: [] },
        { name: 'Makemake', moons: [] },
        { name: 'Eris', moons: ['Dysnomia'] },
      ],
    },
  },
  // Future known systems go here:
  // { name: 'Alpha Centauri', position: {...}, generate: () => {...}, names: {...} },
];

export class KnownSystems {
  /**
   * Find a known system near the given galactic position.
   * @param {{ x, y, z }} pos — galactic coordinates in kpc
   * @returns {{ name, position, generate, names } | null}
   */
  static findAt(pos) {
    for (const ks of KNOWN_SYSTEMS) {
      const dx = pos.x - ks.position.x;
      const dy = (pos.y || 0) - (ks.position.y || 0);
      const dz = (pos.z || 0) - (ks.position.z || 0);
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist < MATCH_RADIUS) {
        return ks;
      }
    }
    return null;
  }

  /**
   * Get all known systems (for debug panel, nav computer display, etc.)
   */
  static getAll() {
    return KNOWN_SYSTEMS;
  }
}
