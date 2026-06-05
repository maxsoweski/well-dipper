import { HashGridStarfield } from './HashGridStarfield.js';
import { resolveNavStar, generateFromNavStar } from './SystemResolver.js';
import { StarSystemGenerator } from './StarSystemGenerator.js';
import { deriveSystemTags } from './SystemTags.js';

/**
 * SystemProbe — aim a "probe" at an arbitrary galactic region and search the
 * (infinite-on-demand) universe there by tag.
 *
 * The universe is not enumerable, so search is region-scoped: a probe sweeps a
 * bounded volume via the hash-grid query primitives, derives tags per candidate
 * star, and returns the ones matching a tag filter.
 *
 * Scan depth (AC4):
 *   - 'shallow' : cheap tags only (no per-planet generation). Expensive tag
 *                 filters (hasRings/hasHabitable) cannot be evaluated, so they
 *                 are IGNORED — shallow returns the cheap-tag candidate set
 *                 (a superset / proxy for an expensive filter).
 *   - 'deep'    : cheap-filter the region first, then fully generate the
 *                 survivors to CONFIRM expensive tags (hasRings/hasHabitable).
 *
 * Every result is { navStarData, tags } where navStarData is the
 * {worldX,worldY,worldZ,seed,type} snapshot that reloads the IDENTICAL system.
 */

// Tags that require full per-planet generation to know.
export const EXPENSIVE_TAG_KEYS = ['hasRings', 'hasHabitable'];

/** Does a tag set satisfy every key in a filter (scalar equality)? */
function matchesFilter(tags, filter) {
  for (const key of Object.keys(filter)) {
    if (tags[key] !== filter[key]) return false;
  }
  return true;
}

/** Split a filter into cheap (early-knowable) and expensive (deep-only) parts. */
function splitFilter(filter) {
  const cheap = {}, expensive = {};
  for (const key of Object.keys(filter || {})) {
    if (EXPENSIVE_TAG_KEYS.includes(key)) expensive[key] = filter[key];
    else cheap[key] = filter[key];
  }
  return { cheap, expensive };
}

/** Sweep a region with the appropriate hash-grid primitive. */
function sweepRegion(galacticMap, region) {
  switch (region.shape) {
    case 'radius':
      return HashGridStarfield.findStarsInRadius(galacticMap, region.center, region.radiusKpc, region.maxResults ?? 500);
    case 'cube':
      return HashGridStarfield.findStarsInCube(galacticMap, region.center, region.halfSize, region.maxResults ?? 500);
    case 'prism':
      return HashGridStarfield.findStarsInPrism(galacticMap, region.center, region.xzHalf, region.yHalf, region.maxResults ?? 3000);
    default:
      throw new Error(`SystemProbe: unknown region shape "${region.shape}"`);
  }
}

/** A star record from the hash grid -> the canonical navStarData snapshot. */
function toNavStarData(star) {
  return { worldX: star.worldX, worldY: star.worldY, worldZ: star.worldZ, seed: star.seed, type: star.type };
}

/**
 * Probe a galactic region and return systems matching a tag filter.
 * @param {GalacticMap} galacticMap
 * @param {object} region — { shape:'radius'|'cube'|'prism', center, ... }
 * @param {object} filter — tag -> expected value (scalar equality)
 * @param {object} [options] — { scanDepth: 'shallow'|'deep' }
 * @returns {Array<{ navStarData, tags }>}
 */
export function probeRegion(galacticMap, region, filter = {}, options = {}) {
  const scanDepth = options.scanDepth || 'shallow';
  const { cheap, expensive } = splitFilter(filter);
  const hasExpensive = Object.keys(expensive).length > 0;

  const stars = sweepRegion(galacticMap, region);
  const results = [];

  for (const star of stars) {
    const navStarData = toNavStarData(star);
    const { seed, galaxyContext } = resolveNavStar(galacticMap, navStarData);

    // Cheap pre-filter (applies in both modes).
    const cheapTags = StarSystemGenerator.deriveCheapTags(seed, galaxyContext);
    if (!matchesFilter(cheapTags, cheap)) continue;

    if (scanDepth === 'deep' && hasExpensive) {
      // Confirm expensive tags by fully generating the survivor.
      const fullTags = deriveSystemTags(StarSystemGenerator.generate(seed, galaxyContext));
      if (!matchesFilter(fullTags, expensive)) continue;
      results.push({ navStarData, tags: fullTags });
    } else if (scanDepth === 'deep') {
      // Deep with no expensive filter: still surface full tags for accuracy.
      const fullTags = deriveSystemTags(StarSystemGenerator.generate(seed, galaxyContext));
      results.push({ navStarData, tags: fullTags });
    } else {
      // Shallow: cheap tags only; expensive filter (if any) is ignored.
      results.push({ navStarData, tags: cheapTags });
    }
  }

  return results;
}
