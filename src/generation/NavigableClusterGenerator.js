import { SeededRandom } from './SeededRandom.js';
import { solarRadiiToScene } from '../core/ScaleConstants.js';

/**
 * NavigableClusterGenerator — produces data for flyable open clusters.
 *
 * Unlike ClusterGenerator (distant particle cloud), this creates individual
 * Star objects that the camera can fly between and select as warp targets.
 *
 * Open clusters: 5-20 young stars (mostly B/A/F types) scattered in a
 * loose grouping with 2-5 sub-clumps. No gas cloud, no planets (too young).
 *
 * Returns plain JS objects — no Three.js dependencies.
 */
export class NavigableClusterGenerator {
  // Young star types weighted by frequency
  // Open clusters are dominated by bright blue-white stars
  static STAR_TYPES = {
    O: { color: [0.61, 0.69, 1.0], radiusSolar: 12.0, temp: 40000, weight: 0.05 },
    B: { color: [0.67, 0.75, 1.0], radiusSolar: 5.0,  temp: 20000, weight: 0.25 },
    A: { color: [0.79, 0.84, 1.0], radiusSolar: 1.8,  temp: 8750,  weight: 0.30 },
    F: { color: [0.97, 0.97, 1.0], radiusSolar: 1.3,  temp: 6750,  weight: 0.25 },
    G: { color: [1.0, 0.96, 0.92], radiusSolar: 1.0,  temp: 5600,  weight: 0.10 },
    K: { color: [1.0, 0.82, 0.63], radiusSolar: 0.7,  temp: 4450,  weight: 0.05 },
  };

  /**
   * Generate navigable open cluster data.
   * @param {string} seed — deterministic seed
   * @returns {Object} cluster data with stars, radius
   */
  static generate(seed) {
    const rng = new SeededRandom(seed);
    const radius = rng.range(8000, 20000);  // comparable to a star system

    // ── Create sub-clumps for irregular shape ──
    const clumpCount = rng.int(2, 5);
    const clumps = [];
    for (let c = 0; c < clumpCount; c++) {
      clumps.push({
        x: this._gaussian(rng) * radius * 0.25,
        y: this._gaussian(rng) * radius * 0.08,  // somewhat flattened
        z: this._gaussian(rng) * radius * 0.25,
        spread: rng.range(0.1, 0.3) * radius,
      });
    }

    // ── Stars: 5-20, assigned to clumps ──
    // Minimum separation = 5% of radius — keeps stars visually distinct.
    // For a 15K cluster that's 750 units apart.
    const minSep = radius * 0.05;
    const starCount = rng.int(5, 20);
    const stars = [];

    for (let s = 0; s < starCount; s++) {
      // Pick star type by weighted random
      const sType = this._pickStarType(rng);
      const props = this.STAR_TYPES[sType];
      const radiusSolar = props.radiusSolar * rng.range(0.7, 1.3);
      const radiusScene = solarRadiiToScene(radiusSolar);

      // Assign to a random clump
      const clump = clumps[s % clumpCount];

      // Place star with rejection sampling to enforce minimum separation
      let x, y, z;
      let placed = false;
      for (let attempt = 0; attempt < 20; attempt++) {
        x = clump.x + this._gaussian(rng) * clump.spread;
        y = clump.y + this._gaussian(rng) * clump.spread * 0.3;
        z = clump.z + this._gaussian(rng) * clump.spread;

        // Check distance to all existing stars
        let tooClose = false;
        for (const existing of stars) {
          const dx = x - existing.position[0];
          const dy = y - existing.position[1];
          const dz = z - existing.position[2];
          if (dx * dx + dy * dy + dz * dz < minSep * minSep) {
            tooClose = true;
            break;
          }
        }
        if (!tooClose) { placed = true; break; }
      }
      // If all attempts failed, place it anyway (edge case with many stars)
      if (!placed) {
        x = clump.x + this._gaussian(rng) * clump.spread * 1.5;
        y = clump.y + this._gaussian(rng) * clump.spread * 0.5;
        z = clump.z + this._gaussian(rng) * clump.spread * 1.5;
      }

      stars.push({
        type: sType,
        color: [
          props.color[0] * rng.range(0.9, 1.0),
          props.color[1] * rng.range(0.9, 1.0),
          props.color[2] * rng.range(0.9, 1.0),
        ],
        radiusSolar,
        radiusScene,
        renderRadius: null,  // use actual radiusScene
        temp: props.temp,
        position: [x, y, z],
      });
    }

    // ── Reflection nebulosity layers (Nebula-compatible cloud planes) ──
    // Pleiades-style wispy gas concentrated around the star clumps
    const gasLayers = this._generateGasLayers(rng, radius, clumps);

    return {
      type: 'open-cluster',
      _destType: 'open-cluster',
      gasLayers,
      stars,
      planets: [],   // open clusters are too young for planets
      radius,
    };
  }

  /**
   * Pick a star type using the weight distribution.
   */
  static _pickStarType(rng) {
    const types = Object.entries(this.STAR_TYPES);
    const totalWeight = types.reduce((sum, [, props]) => sum + props.weight, 0);
    let roll = rng.float() * totalWeight;

    for (const [type, props] of types) {
      roll -= props.weight;
      if (roll <= 0) return type;
    }
    return 'A';  // fallback
  }

  // Gas color palettes — reflection (blue), H-alpha (red), mixed
  static GAS_PALETTES = {
    reflection: { r: [0.35, 0.58], g: [0.50, 0.72], b: [0.78, 1.0]  },
    'h-alpha':  { r: [0.78, 1.0],  g: [0.18, 0.40], b: [0.22, 0.48] },
    warm:       { r: [0.80, 1.0],  g: [0.55, 0.75], b: [0.30, 0.50] },
  };

  /**
   * Generate Nebula-compatible cloud layers for reflection nebulosity.
   * Positioned around sub-clumps with varied colors and density.
   *
   * Gas density distribution:
   *   ~30% light gas (2-3 layers per clump)
   *   ~40% moderate gas (3-5 layers per clump)
   *   ~20% heavy gas (5-8 layers per clump — dense, spectacular)
   *   ~10% minimal/no gas
   *
   * Color themes:
   *   ~50% reflection (blue-white — Pleiades-style)
   *   ~25% H-alpha (red-pink — star-forming regions)
   *   ~15% warm (amber/gold — dust-scattered starlight)
   *   ~10% mixed (layers of different colors)
   */
  static _generateGasLayers(rng, radius, clumps) {
    // Density roll: how much gas this cluster has
    const densityRoll = rng.float();
    let layersPerClump;
    if (densityRoll < 0.10) return [];                    // 10% minimal
    else if (densityRoll < 0.40) layersPerClump = [2, 3]; // 30% light
    else if (densityRoll < 0.80) layersPerClump = [3, 5]; // 40% moderate
    else layersPerClump = [5, 8];                         // 20% heavy

    // Color theme roll
    const colorRoll = rng.float();
    let palette;
    let isMixed = false;
    if (colorRoll < 0.50) palette = this.GAS_PALETTES.reflection;
    else if (colorRoll < 0.75) palette = this.GAS_PALETTES['h-alpha'];
    else if (colorRoll < 0.90) palette = this.GAS_PALETTES.warm;
    else isMixed = true;

    const palettes = Object.values(this.GAS_PALETTES);

    const layers = [];
    for (let c = 0; c < clumps.length; c++) {
      const clump = clumps[c];
      const layerCount = rng.int(layersPerClump[0], layersPerClump[1]);
      for (let l = 0; l < layerCount; l++) {
        // Mixed mode: each layer picks a random palette
        const pal = isMixed ? palettes[rng.int(0, palettes.length - 1)] : palette;

        const offsetScale = clump.spread * 0.6;
        layers.push({
          position: [
            clump.x + this._gaussian(rng) * offsetScale,
            clump.y + this._gaussian(rng) * offsetScale * 0.2,
            clump.z + this._gaussian(rng) * offsetScale,
          ],
          size: clump.spread * rng.range(0.6, 2.0),
          rotation: [
            rng.range(-0.6, 0.6),
            rng.range(0, Math.PI * 2),
            rng.range(-0.4, 0.4),
          ],
          color: [
            rng.range(pal.r[0], pal.r[1]),
            rng.range(pal.g[0], pal.g[1]),
            rng.range(pal.b[0], pal.b[1]),
          ],
          noiseSeed: [rng.float() * 100, rng.float() * 100],
          noiseScale: rng.range(3.5, 6.0),
          opacity: rng.range(0.20, 0.50),
        });
      }
    }
    return layers;
  }

  /** Box-Muller transform: two uniform randoms → one Gaussian (mean 0, std 1). */
  static _gaussian(rng) {
    const u1 = rng.float() || 0.0001;
    const u2 = rng.float();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }
}
