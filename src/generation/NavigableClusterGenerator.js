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
    const radius = rng.range(120000, 300000);  // 4-8x star system size

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

      const x = clump.x + this._gaussian(rng) * clump.spread;
      const y = clump.y + this._gaussian(rng) * clump.spread * 0.3;
      const z = clump.z + this._gaussian(rng) * clump.spread;

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

    return {
      type: 'open-cluster',
      _destType: 'open-cluster',
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

  /** Box-Muller transform: two uniform randoms → one Gaussian (mean 0, std 1). */
  static _gaussian(rng) {
    const u1 = rng.float() || 0.0001;
    const u2 = rng.float();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }
}
