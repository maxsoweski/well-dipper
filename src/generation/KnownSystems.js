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

// Match tolerance: 0.5 pc (0.0005 kpc). Every intentional route to a known
// system (debug presets, splash-skip, Shift+L, integration suite) passes the
// exact registered position, so the radius only needs to absorb float noise.
// It MUST stay below the distance to the nearest real catalog star — Rigil
// Kentaurus at 1.32 pc — or arrivals at real stars get swallowed by the Sol
// override (Sirius at 2.64 pc spawned the solar system under the old 5 pc
// radius; 12 named HYG stars sat inside it).
// It must ALSO stay above RealStarCatalog's POSITION_MATCH_TOL (see that
// file) — otherwise a teleport landing in the annulus between the two
// tolerances could spawn a procgen system wearing a known system's name.
export const MATCH_RADIUS = 0.0005; // kpc

// Join-time positional belt for findByAlias. DELIBERATELY looser than
// MATCH_RADIUS — do NOT "tighten" this to match it. The NAME gate runs first,
// so the belt never rejects unrelated NEIGHBORS (Sirius near Sol fails the
// name gate, not the belt); it only separates same-named INSTANCES reached
// far away. Floor = the nav overlay's 2 pc rename window (NavComputer.js
// MATCH_DIST = 0.002 kpc keeps GRID coords, so a nav-picked known arrival sits
// up to ~2 pc from the registered position). 3 pc = 2 pc + margin; far
// duplicates (Iot Pic 3.03 pc, Omi Oph 7.8 pc, ...) are correctly rejected,
// tight binary components (Rigil/Toliman 0.001 pc apart) both pass (desired).
export const NAME_JOIN_RADIUS = 0.003; // kpc (3 pc)

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

// Derived alias index: exact catalog display-name string -> entry.
// Seeded EAGERLY at module load with each entry's own display name, so
// findByAlias reproduces today's name-equality join (Sol -> Sol) BEFORE any
// catalog loads — zero async dependency for the registered-name case.
const _aliasIndex = new Map();
for (const ks of KNOWN_SYSTEMS) {
  ks.aliases = new Set([ks.name]);
  ks.claimedStars = [];
  _aliasIndex.set(ks.name, ks);
}

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

  /**
   * Associate the real-star catalog: each entry claims every catalog star
   * within MATCH_RADIUS of its position; those stars' names become derived
   * aliases. Call once after the catalog finishes loading. Idempotent
   * (Set/Map re-adds are no-ops). Self-heals to catalog renames/regens because
   * both sides of the arrival join (this index AND warpTarget.name) derive from
   * the same catalog. claimedStars retains the true-position catalog objects for
   * the future real-universe overlay.
   */
  static associate(catalog) {
    if (!catalog || !catalog.loaded) return; // no throw; eager self-name aliases remain
    for (const ks of KNOWN_SYSTEMS) {
      ks.claimedStars = catalog.findAllWithin(ks.position, MATCH_RADIUS);
      for (const s of ks.claimedStars) {
        if (!s.name || s.name === '"') continue; // skip unnamed + legacy '"' artifact
        ks.aliases.add(s.name);
        const existing = _aliasIndex.get(s.name);
        if (existing && existing !== ks) { // cross-entry duplicate-name guard (belt-and-suspenders)
          console.warn(`[KnownSystems] alias "${s.name}" claimed by both ${existing.name} and ${ks.name}; keeping ${existing.name}`);
          continue;
        }
        _aliasIndex.set(s.name, ks);
      }
    }
  }

  /**
   * Resolve a warp arrival to a known system by the star's display name, gated
   * by a positional BELT on the arrival position. Name gate = catalog-derived
   * alias index (Rigil Kentaurus / Toliman -> Alpha Centauri). Belt rejects a
   * same-named star reached far from the registered position (duplicate-name
   * safety). pos optional; when omitted the belt is skipped (name-only).
   * @param {string} name  @param {{x,y,z}|null} pos
   */
  static findByAlias(name, pos = null) {
    if (!name) return null;
    const ks = _aliasIndex.get(name);
    if (!ks) return null;
    if (pos && ks.position) {
      const dx = pos.x - ks.position.x;
      const dy = (pos.y || 0) - (ks.position.y || 0);
      const dz = (pos.z || 0) - (ks.position.z || 0);
      if (Math.sqrt(dx*dx + dy*dy + dz*dz) > NAME_JOIN_RADIUS) return null;
    }
    return ks;
  }
}
