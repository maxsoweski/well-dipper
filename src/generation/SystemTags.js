/**
 * SystemTags — derive a glanceable, searchable tag set from a generated
 * star system. This is the seam a Phase 2 player-facing share/search UI will
 * consume; Phase 1 uses it on the debug/QA surface.
 *
 * Two derivation paths exist:
 *   - deriveSystemTags(systemData): full, exact — needs a fully generated
 *     system (so it can see per-planet rings/habitability).
 *   - StarSystemGenerator.deriveCheapTags(seed, ctx): cheap fast-path that
 *     replays only the early RNG draws (no per-planet loop). See AC2.
 *
 * Tag shape:
 *   {
 *     isBinary:      boolean,
 *     primaryType:   string,        // primary star spectral class (O/B/A/F/G/K/M)
 *     secondaryType: string | null, // companion class, or null if single
 *     planetCount:   number,        // planets.length (incl. dwarf planets for Sol)
 *     hasRings:      boolean,       // any planet carries rings
 *     hasHabitable:  boolean,       // any planet is habitable (see isPlanetHabitable)
 *     archetype:     string | null, // 'compact-rocky' | 'mixed' | 'spread-giant' | null
 *   }
 */

// Planet types that count as habitable when richer scoring is unavailable
// (hand-authored fixtures like Sol carry no habitabilityScore object).
const HABITABLE_TYPES = ['terrestrial', 'ocean', 'eyeball'];

/**
 * Is a single planet habitable?
 * Procedural planets carry a habitability object from PhysicsEngine; the
 * principled signal is the 'liquid-water' factor (atmosphere retained AND a
 * temperate equilibrium temperature). Hand-authored fixtures lack that object,
 * so we fall back to the planet's habitable-class type.
 * @param {object} planetData
 * @returns {boolean}
 */
export function isPlanetHabitable(planetData) {
  if (!planetData) return false;
  const h = planetData.habitability;
  if (h && Array.isArray(h.factors)) {
    return h.factors.includes('liquid-water');
  }
  return HABITABLE_TYPES.includes(planetData.type);
}

/**
 * Does a single planet have rings?
 * @param {object} planetData
 * @returns {boolean}
 */
export function planetHasRings(planetData) {
  return !!(planetData && planetData.rings != null);
}

/**
 * Derive the full tag set from a fully generated systemData.
 * @param {object} systemData — output of StarSystemGenerator.generate / generateSolarSystem
 * @returns {object} tags
 */
export function deriveSystemTags(systemData) {
  const planets = systemData.planets || [];
  return {
    isBinary: !!systemData.isBinary,
    primaryType: systemData.star ? systemData.star.type : null,
    secondaryType: systemData.star2 ? systemData.star2.type : null,
    planetCount: planets.length,
    hasRings: planets.some(p => planetHasRings(p.planetData)),
    hasHabitable: planets.some(p => isPlanetHabitable(p.planetData)),
    archetype: systemData.archetype != null ? systemData.archetype : null,
  };
}
