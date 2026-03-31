/**
 * RealFeatureCatalog — loads real galactic feature data from astronomical catalogs.
 *
 * Currently supports:
 *   - Harris globular cluster catalog (152 real clusters)
 *
 * Future:
 *   - NGC/Messier nebulae
 *   - Green's SNR catalog
 *   - Gaia open clusters
 *
 * Real features override procedural ones when integrated into GalacticMap.
 * They sit in the same potential field and use the same rendering pipeline.
 */

export class RealFeatureCatalog {
  constructor() {
    this._globularClusters = null;
    this._loaded = false;
  }

  get loaded() { return this._loaded; }
  get globularClusters() { return this._globularClusters || []; }

  /**
   * Load all feature catalogs.
   */
  async load() {
    try {
      await this._loadGlobularClusters();
      this._loaded = true;
    } catch (e) {
      console.warn('RealFeatureCatalog: load error:', e.message);
    }
  }

  async _loadGlobularClusters() {
    try {
      const resp = await fetch('./assets/data/globular-clusters.json');
      if (!resp.ok) {
        console.warn('RealFeatureCatalog: failed to load globular-clusters.json:', resp.status);
        return;
      }
      const data = await resp.json();
      // Convert to the same format as GalacticMap features
      this._globularClusters = data.map(gc => ({
        type: 'globular-cluster',
        position: { x: gc.x, y: gc.y, z: gc.z },
        // Real clusters have varying sizes — estimate radius from rGc
        // Average globular: 5-50 pc = 0.005-0.05 kpc
        radius: 0.03, // default 30 pc, could refine per-cluster
        seed: `harris-${gc.id}`,
        color: [1.0, 0.85, 0.5], // warm yellow-orange (old population)
        name: gc.name,
        harrisId: gc.id,
        rSun: gc.rSun,
        rGc: gc.rGc,
        context: {
          metallicity: -1.5, // typical globular metallicity
          age: 12.0, // typical globular age (Gyr)
          component: 'halo',
          armStrength: 0,
        },
        overrides: {
          starCountMultiplier: 10.0,
          metallicityOverride: -1.5,
          ageOverride: 12.0,
        },
        isReal: true,
      }));
      console.log(`RealFeatureCatalog: loaded ${this._globularClusters.length} real globular clusters`);
    } catch (e) {
      console.warn('RealFeatureCatalog: globular cluster load error:', e.message);
    }
  }

  /**
   * Find real features near a position.
   * @param {{ x, y, z }} position
   * @param {number} maxDistance — kpc
   * @returns {Array} features sorted by distance, with distance field added
   */
  findNearby(position, maxDistance = 3.0) {
    const results = [];
    const catalogs = [this._globularClusters];

    for (const catalog of catalogs) {
      if (!catalog) continue;
      for (const feat of catalog) {
        const dx = feat.position.x - position.x;
        const dy = feat.position.y - position.y;
        const dz = feat.position.z - position.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist < maxDistance + feat.radius) {
          results.push({
            ...feat,
            distance: dist,
            insideFeature: dist < feat.radius,
          });
        }
      }
    }

    results.sort((a, b) => a.distance - b.distance);
    return results;
  }
}
