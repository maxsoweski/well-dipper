import { SeededRandom } from './SeededRandom.js';

/**
 * ClusterGenerator — produces data for star clusters (globular and open).
 *
 * Globular: dense sphere of warm-colored old stars, King profile density.
 * Open: loose irregular grouping of blue-white young stars.
 *
 * Returns plain JS objects — no Three.js dependencies.
 */
export class ClusterGenerator {
  /**
   * Generate cluster data.
   * @param {string} seed — deterministic seed
   * @param {string} type — 'globular-cluster' or 'open-cluster'
   * @returns {Object} cluster data (positions, colors, sizes, tourStops)
   */
  static generate(seed, type = 'globular-cluster') {
    const rng = new SeededRandom(seed);

    if (type === 'open-cluster') {
      return this._generateOpen(rng);
    }
    return this._generateGlobular(rng);
  }

  // ── Globular Cluster ────────────────────────────────────────────

  static _generateGlobular(rng) {
    const radius = rng.range(8000, 18000);    // large enough to be visually impressive
    const coreRadius = radius * rng.range(0.08, 0.15);  // dense core
    const tidalRadius = radius;               // where stars end

    const particleCount = rng.int(15000, 35000);
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);

    // Pre-compute atan for King profile sampling
    const maxAngle = Math.atan(tidalRadius / coreRadius);

    for (let i = 0; i < particleCount; i++) {
      // King profile approximation: tan mapping concentrates toward core
      const r = coreRadius * Math.tan(rng.float() * maxAngle);

      // Uniform direction on sphere
      const theta = rng.range(0, 2 * Math.PI);
      const phi = Math.acos(rng.range(-1, 1));

      positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);

      // Warm yellow-orange palette (old Population II stars)
      // Outer particles fade out to prevent additive-blending "shell" at edges
      // Core particles dim to prevent additive saturation → white-out sphere
      const normalizedR = r / radius;
      const edgeFade = normalizedR < 0.5 ? 1.0 : Math.max(0.15, 1.0 - (normalizedR - 0.5) * 1.4);
      const coreDim = normalizedR < 0.1 ? 0.3 + normalizedR * 7.0 : 1.0;
      const warmth = rng.range(0.75, 1.0) * edgeFade * coreDim;
      colors[i * 3]     = warmth;
      colors[i * 3 + 1] = warmth * rng.range(0.7, 0.88);
      colors[i * 3 + 2] = warmth * rng.range(0.4, 0.6);

      // Smaller in the dense core, slightly larger at edges (resolved stars)
      // Sized for Galaxy shader distScale (300/z) at typical viewing distances
      // Edge particles also smaller to reduce shell visibility
      sizes[i] = normalizedR < 0.3
        ? rng.range(25, 60)
        : rng.range(20, 60) * edgeFade;
    }

    const tourStops = [
      { name: 'Overview',   position: [0, radius * 0.3, radius * 0.6], orbitDistance: radius * 1.2, bodyRadius: radius, linger: 40 },
      { name: 'Core',       position: [0, 0, 0],                        orbitDistance: radius * 0.15, bodyRadius: coreRadius, linger: 35 },
      { name: 'Through',    position: [0, 0, -radius * 0.4],            orbitDistance: radius * 0.5, bodyRadius: radius * 0.3, linger: 25 },
    ];

    return {
      type: 'globular-cluster',
      positions,
      colors,
      sizes,
      particleCount,
      radius,
      tiltX: 0,
      tiltZ: 0,
      tourStops,
    };
  }

  // ── Open Cluster ─────────────────────────────────────────────────

  static _generateOpen(rng) {
    const radius = rng.range(4000, 10000);
    const particleCount = rng.int(200, 800);

    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);

    // Create a few random sub-clumps for irregular shape
    const clumpCount = rng.int(2, 5);
    const clumps = [];
    for (let c = 0; c < clumpCount; c++) {
      clumps.push({
        x: this._gaussian(rng) * radius * 0.3,
        y: this._gaussian(rng) * radius * 0.1,  // flattened
        z: this._gaussian(rng) * radius * 0.3,
        spread: rng.range(0.3, 0.7) * radius,
      });
    }

    for (let i = 0; i < particleCount; i++) {
      // Pick a random clump
      const clump = clumps[i % clumpCount];

      positions[i * 3]     = clump.x + this._gaussian(rng) * clump.spread;
      positions[i * 3 + 1] = clump.y + this._gaussian(rng) * clump.spread * 0.3;
      positions[i * 3 + 2] = clump.z + this._gaussian(rng) * clump.spread;

      // Blue-white colors (young stars), with occasional red giant
      // Boosted toward white so they're visible against the black background
      if (rng.chance(0.08)) {
        // Red giant — bright warm
        colors[i * 3]     = 1.0;
        colors[i * 3 + 1] = rng.range(0.6, 0.8);
        colors[i * 3 + 2] = rng.range(0.3, 0.5);
      } else {
        // Blue-white — push toward bright white with a blue tint
        const brightness = rng.range(0.85, 1.0);
        colors[i * 3]     = brightness * rng.range(0.85, 1.0);
        colors[i * 3 + 1] = brightness * rng.range(0.9, 1.0);
        colors[i * 3 + 2] = brightness;
      }

      // Varied sizes — some prominent stars dominate
      // Sized for Galaxy shader distScale (300/z) at typical viewing distances
      sizes[i] = rng.chance(0.15) ? rng.range(40, 100) : rng.range(20, 50);
    }

    const tourStops = [
      { name: 'Overview', position: [0, radius * 0.3, radius * 0.5], orbitDistance: radius * 1.3, bodyRadius: radius, linger: 35 },
      { name: 'Center',   position: [0, 0, 0],                        orbitDistance: radius * 0.4, bodyRadius: radius * 0.3, linger: 30 },
    ];

    return {
      type: 'open-cluster',
      positions,
      colors,
      sizes,
      particleCount,
      radius,
      tiltX: 0,
      tiltZ: 0,
      tourStops,
    };
  }

  // ── Utility ────────────────────────────────────────────────────

  /** Box-Muller transform: two uniform randoms → one Gaussian (mean 0, std 1). */
  static _gaussian(rng) {
    const u1 = rng.float() || 0.0001;
    const u2 = rng.float();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }
}
