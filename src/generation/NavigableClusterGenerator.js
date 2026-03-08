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

  /**
   * Generate Nebula-compatible cloud layers for reflection nebulosity.
   * Positioned around sub-clumps with blue-white colors, ragged placement.
   */
  static _generateGasLayers(rng, radius, clumps) {
    const layers = [];
    for (let c = 0; c < clumps.length; c++) {
      const clump = clumps[c];
      const layerCount = rng.int(2, 4);
      for (let l = 0; l < layerCount; l++) {
        // Scatter layers well beyond the clump center for ragged coverage
        const offsetScale = clump.spread * 0.6;
        layers.push({
          position: [
            clump.x + this._gaussian(rng) * offsetScale,
            clump.y + this._gaussian(rng) * offsetScale * 0.2,
            clump.z + this._gaussian(rng) * offsetScale,
          ],
          // Varied sizes — some large diffuse wisps, some tight patches
          size: clump.spread * rng.range(0.6, 2.0),
          rotation: [
            rng.range(-0.6, 0.6),
            rng.range(0, Math.PI * 2),
            rng.range(-0.4, 0.4),
          ],
          color: [
            rng.range(0.35, 0.58),
            rng.range(0.50, 0.72),
            rng.range(0.78, 1.0),
          ],
          noiseSeed: [rng.float() * 100, rng.float() * 100],
          // High noise scale = fine detail = wispier, more holes
          noiseScale: rng.range(3.5, 6.0),
          opacity: rng.range(0.20, 0.50),
        });
      }
    }
    return layers;
  }

  /**
   * Generate ragged reflection nebulosity gas cloud data (volumetric).
   * Concentrated around star clumps with filamentary tendrils — not spherical.
   * Currently unused but kept for future experimentation.
   */
  static _generateGasCloud(rng, radius, clumps, stars) {
    // Particles around star clumps + filamentary tendrils between them
    const clumpParticles = 6000;
    const tendrilParticles = 3000;
    const diffuseParticles = 1000;
    const particleCount = clumpParticles + tendrilParticles + diffuseParticles;

    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);
    const opacities = new Float32Array(particleCount);

    // Reflection nebula palette: cool blue-white (starlight scattered by dust)
    const palR = [0.45, 0.70];
    const palG = [0.55, 0.78];
    const palB = [0.80, 1.00];

    let idx = 0;

    // ── Clump gas: concentrated around each star sub-clump ──
    // Each clump gets an irregular shape via per-clump stretch axes
    for (let i = 0; i < clumpParticles; i++) {
      const clump = clumps[i % clumps.length];

      // Random stretch direction per clump (seeded by clump index)
      // This makes each gas concentration elongated in a different direction
      const stretchAngle = (i % clumps.length) * 1.618 * Math.PI;
      const stretchFactor = 1.8;

      let x = this._gaussian(rng) * clump.spread * 0.8;
      let y = this._gaussian(rng) * clump.spread * 0.25;
      let z = this._gaussian(rng) * clump.spread * 0.8;

      // Stretch along the clump's unique direction
      const cosA = Math.cos(stretchAngle);
      const sinA = Math.sin(stretchAngle);
      const rx = x * cosA - z * sinA;
      const rz = x * sinA + z * cosA;
      x = rx * stretchFactor;
      z = rz;

      // Rotate back
      x = x * cosA + z * sinA;
      z = -x * sinA + z * cosA;

      positions[idx * 3]     = clump.x + x;
      positions[idx * 3 + 1] = clump.y + y;
      positions[idx * 3 + 2] = clump.z + z;

      colors[idx * 3]     = rng.range(palR[0], palR[1]);
      colors[idx * 3 + 1] = rng.range(palG[0], palG[1]);
      colors[idx * 3 + 2] = rng.range(palB[0], palB[1]);

      sizes[idx] = rng.range(400, 1200);
      // Denser near clump center
      const distFromClump = Math.sqrt(x * x + y * y + z * z);
      const normDist = Math.min(distFromClump / (clump.spread * 1.5), 1);
      opacities[idx] = (1 - normDist * 0.7) * rng.range(0.03, 0.10);
      idx++;
    }

    // ── Tendrils: filaments connecting clumps ──
    // Pick random clump pairs and scatter particles along the line between them
    for (let i = 0; i < tendrilParticles; i++) {
      const c1 = clumps[rng.int(0, clumps.length - 1)];
      const c2 = clumps[rng.int(0, clumps.length - 1)];

      // Lerp between the two clumps with Gaussian scatter perpendicular
      const t = rng.float();
      const baseX = c1.x + (c2.x - c1.x) * t;
      const baseY = c1.y + (c2.y - c1.y) * t;
      const baseZ = c1.z + (c2.z - c1.z) * t;

      // Perpendicular scatter — thinner than clump gas
      const scatter = radius * 0.06;
      positions[idx * 3]     = baseX + this._gaussian(rng) * scatter;
      positions[idx * 3 + 1] = baseY + this._gaussian(rng) * scatter * 0.3;
      positions[idx * 3 + 2] = baseZ + this._gaussian(rng) * scatter;

      colors[idx * 3]     = rng.range(palR[0], palR[1]) * 0.8;
      colors[idx * 3 + 1] = rng.range(palG[0], palG[1]) * 0.8;
      colors[idx * 3 + 2] = rng.range(palB[0], palB[1]) * 0.8;

      sizes[idx] = rng.range(300, 900);
      opacities[idx] = rng.range(0.02, 0.06);
      idx++;
    }

    // ── Diffuse: sparse ambient particles across the volume ──
    for (let i = 0; i < diffuseParticles; i++) {
      const r = radius * Math.cbrt(rng.float()) * 0.4;
      const theta = rng.range(0, 2 * Math.PI);
      const phi = Math.acos(rng.range(-1, 1));

      positions[idx * 3]     = r * Math.sin(phi) * Math.cos(theta);
      positions[idx * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.25;
      positions[idx * 3 + 2] = r * Math.cos(phi);

      colors[idx * 3]     = rng.range(palR[0], palR[1]) * 0.6;
      colors[idx * 3 + 1] = rng.range(palG[0], palG[1]) * 0.6;
      colors[idx * 3 + 2] = rng.range(palB[0], palB[1]) * 0.6;

      sizes[idx] = rng.range(500, 1500);
      opacities[idx] = rng.range(0.01, 0.03);
      idx++;
    }

    return { positions, colors, sizes, opacities, particleCount };
  }

  /** Box-Muller transform: two uniform randoms → one Gaussian (mean 0, std 1). */
  static _gaussian(rng) {
    const u1 = rng.float() || 0.0001;
    const u2 = rng.float();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }
}
