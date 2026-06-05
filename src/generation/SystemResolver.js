import { StarSystemGenerator } from './StarSystemGenerator.js';

/**
 * SystemResolver — the single, canonical way to turn a navStarData snapshot
 * ({worldX,worldY,worldZ,seed,type}) into the deterministic inputs (seed +
 * galaxyContext) that regenerate the IDENTICAL system.
 *
 * This mirrors the warp resolution Priority-1 path (main.js ~2944-2956):
 *   position -> deriveGalaxyContext -> starTypeOverride = type -> seed = String(seed)
 *
 * Sharing one resolver across the probe (search), the saved-system reload, and
 * (optionally) the warp path is what makes "a saved system reloads to the SAME
 * system, not a near-miss" true by construction rather than by luck.
 */

/**
 * Resolve the deterministic generation inputs for a navStarData snapshot.
 * @param {GalacticMap} galacticMap
 * @param {{worldX:number,worldY:number,worldZ:number,seed:(string|number),type?:string}} navStarData
 * @returns {{ seed: string, galaxyContext: object, position: {x,y,z} }}
 */
export function resolveNavStar(galacticMap, navStarData) {
  const position = { x: navStarData.worldX, y: navStarData.worldY, z: navStarData.worldZ };
  const galaxyContext = galacticMap.deriveGalaxyContext(position);
  // Hash grid already determined this star's spectral type — pass it through so
  // the generator uses it instead of re-rolling from weights (same as warp).
  if (navStarData.type) {
    galaxyContext.starTypeOverride = navStarData.type;
  }
  const seed = String(navStarData.seed);
  return { seed, galaxyContext, position };
}

/**
 * Fully (and deterministically) regenerate the system for a navStarData snapshot.
 * @returns {object} systemData
 */
export function generateFromNavStar(galacticMap, navStarData) {
  const { seed, galaxyContext } = resolveNavStar(galacticMap, navStarData);
  return StarSystemGenerator.generate(seed, galaxyContext);
}

/**
 * Derive the cheap (loop-free) tags for a navStarData snapshot.
 * @returns {object} cheap tags (hasRings / hasHabitable are null — deep-only)
 */
export function cheapTagsFromNavStar(galacticMap, navStarData) {
  const { seed, galaxyContext } = resolveNavStar(galacticMap, navStarData);
  return StarSystemGenerator.deriveCheapTags(seed, galaxyContext);
}
