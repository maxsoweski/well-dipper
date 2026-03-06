import { SeededRandom } from './SeededRandom.js';

/**
 * GalaxyGenerator — produces data for galaxies (spiral and elliptical).
 *
 * Spiral galaxies use logarithmic spiral arms with Gaussian scatter.
 * Elliptical galaxies use de Vaucouleurs R^1/4 profile (smooth ellipsoid).
 *
 * Returns plain JS objects — no Three.js dependencies.
 * Pattern matches StarSystemGenerator: static generate(), SeededRandom, pure data.
 */
export class GalaxyGenerator {
  /**
   * Generate galaxy data.
   * @param {string} seed — deterministic seed
   * @param {string} type — 'spiral-galaxy' or 'elliptical-galaxy'
   * @returns {Object} galaxy data (positions, colors, sizes, tourStops)
   */
  static generate(seed, type = 'spiral-galaxy') {
    const rng = new SeededRandom(seed);

    if (type === 'elliptical-galaxy') {
      return this._generateElliptical(rng);
    }
    return this._generateSpiral(rng);
  }

  // ── Spiral Galaxy ──────────────────────────────────────────────

  static _generateSpiral(rng) {
    // Core parameters (seed-driven variation)
    const armCount = rng.int(2, 5);
    const armTightness = rng.range(0.3, 0.8);
    const barLength = rng.chance(0.4) ? rng.range(0.1, 0.4) : 0;
    const bulgeSize = rng.range(0.15, 0.35);
    const diskThickness = rng.range(0.02, 0.06);
    const radius = rng.range(200, 400);
    const tiltX = rng.range(-0.6, 0.6);
    const tiltZ = rng.range(-0.4, 0.4);

    // Particle budget
    const armParticles = rng.int(45000, 65000);
    const bulgeParticles = rng.int(8000, 15000);
    const totalParticles = armParticles + bulgeParticles;

    const positions = new Float32Array(totalParticles * 3);
    const colors = new Float32Array(totalParticles * 3);
    const sizes = new Float32Array(totalParticles);

    let idx = 0;

    // ── Arm particles ──
    for (let i = 0; i < armParticles; i++) {
      const arm = i % armCount;
      const armAngle = arm * (2 * Math.PI / armCount);

      // Distance from center — pow(t, 0.6) concentrates toward center
      const t = rng.float();
      const r = radius * Math.pow(t, 0.6);

      // Logarithmic spiral spine angle
      let spineTheta = armAngle + Math.log(r / radius + 0.05) / armTightness;

      // Bar influence: straighten particles near center
      if (barLength > 0 && r < radius * barLength) {
        const barAngle = armAngle < Math.PI ? 0 : Math.PI;
        const barBlend = 1.0 - (r / (radius * barLength));
        spineTheta = spineTheta * (1 - barBlend) + barAngle * barBlend;
      }

      // Gaussian scatter perpendicular to arm (wider at edge)
      const armWidth = (0.12 + 0.08 * (r / radius)) * radius;
      const scatter = this._gaussian(rng) * armWidth;
      const theta = spineTheta + scatter / (r + 1);

      const x = r * Math.cos(theta);
      const z = r * Math.sin(theta);
      const y = this._gaussian(rng) * diskThickness * radius;

      positions[idx * 3] = x;
      positions[idx * 3 + 1] = y;
      positions[idx * 3 + 2] = z;

      // Color: gradual transition from warm core to blue arms.
      // Wide blend zone with per-particle randomness creates natural
      // intermingling — no hard boundary between gold and blue.
      const normalizedR = r / radius;
      const isHII = rng.chance(0.02); // rare pink star-forming knots
      if (isHII) {
        colors[idx * 3]     = rng.range(0.75, 0.9);
        colors[idx * 3 + 1] = rng.range(0.2, 0.35);
        colors[idx * 3 + 2] = rng.range(0.3, 0.45);
      } else {
        // Blend zone: warm colors dominate near center, blue in arms.
        // Per-particle jitter (±0.15) creates natural salt-and-pepper
        // mixing so the transition looks organic, not like a ring.
        const blendStart = bulgeSize * 0.3;
        const blendEnd = bulgeSize + 0.2;
        const rawBlend = (normalizedR - blendStart) / (blendEnd - blendStart);
        const blend = Math.max(0, Math.min(1, rawBlend + rng.range(-0.15, 0.15)));

        // Generate both color palettes, then interpolate
        const warmth = rng.range(0.8, 1.0);
        const wR = warmth;
        const wG = warmth * rng.range(0.7, 0.85);
        const wB = warmth * rng.range(0.4, 0.6);

        const blue = rng.range(0.6, 1.0);
        const aR = blue * rng.range(0.6, 0.8);
        const aG = blue * rng.range(0.7, 0.9);
        const aB = blue;

        colors[idx * 3]     = wR + (aR - wR) * blend;
        colors[idx * 3 + 1] = wG + (aG - wG) * blend;
        colors[idx * 3 + 2] = wB + (aB - wB) * blend;
      }

      // Size: mostly small, with rare brighter spots
      sizes[idx] = rng.chance(0.03) ? rng.range(3, 5) : rng.range(1, 2.5);
      idx++;
    }

    // ── Bulge particles (spherical, concentrated at center) ──
    for (let i = 0; i < bulgeParticles; i++) {
      // Concentrated spherical distribution
      const r = radius * bulgeSize * Math.pow(rng.float(), 1.5);
      const theta = rng.range(0, 2 * Math.PI);
      const phi = Math.acos(rng.range(-1, 1));

      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta) * 0.7; // slightly oblate
      const z = r * Math.cos(phi);

      positions[idx * 3] = x;
      positions[idx * 3 + 1] = y;
      positions[idx * 3 + 2] = z;

      // Warm yellow-orange (old stars in bulge)
      const warmth = rng.range(0.75, 1.0);
      colors[idx * 3]     = warmth;
      colors[idx * 3 + 1] = warmth * rng.range(0.65, 0.82);
      colors[idx * 3 + 2] = warmth * rng.range(0.35, 0.55);

      // Slightly larger in core for brightness
      sizes[idx] = rng.range(1.5, 3.5);
      idx++;
    }

    // ── Tour stops ──
    // Pick a point along an arm for the "arm visit" stop
    const armVisitAngle = rng.range(0, 2 * Math.PI);
    const armVisitR = radius * 0.5;
    const armPos = [
      armVisitR * Math.cos(armVisitAngle),
      0,
      armVisitR * Math.sin(armVisitAngle),
    ];

    const tourStops = [
      { name: 'Overview', position: [0, radius * 0.6, radius * 0.8], orbitDistance: radius * 1.3, bodyRadius: radius, linger: 45 },
      { name: 'Core',     position: [0, 0, 0],                        orbitDistance: radius * 0.25, bodyRadius: radius * bulgeSize, linger: 35 },
      { name: 'Arm',      position: armPos,                            orbitDistance: radius * 0.15, bodyRadius: radius * 0.1, linger: 30 },
      { name: 'Edge-on',  position: [radius * 0.8, 0, 0],             orbitDistance: radius * 1.2, bodyRadius: radius, linger: 30 },
    ];

    return {
      type: 'spiral-galaxy',
      positions,
      colors,
      sizes,
      particleCount: totalParticles,
      radius,
      tiltX,
      tiltZ,
      armCount,
      tourStops,
    };
  }

  // ── Elliptical Galaxy ──────────────────────────────────────────

  static _generateElliptical(rng) {
    const radius = rng.range(150, 350);
    const tiltX = rng.range(-0.3, 0.3);
    const tiltZ = rng.range(-0.3, 0.3);

    // Ellipticity: axis ratios (1.0 = sphere, <1.0 = oblate/prolate)
    const axisRatioY = rng.range(0.5, 1.0);
    const axisRatioZ = rng.range(0.6, 1.0);

    const particleCount = rng.int(30000, 50000);
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      // de Vaucouleurs-like concentration: pow(random, 1.8) clusters toward center
      const r = radius * Math.pow(rng.float(), 1.8);
      const theta = rng.range(0, 2 * Math.PI);
      const phi = Math.acos(rng.range(-1, 1));

      positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * axisRatioY;
      positions[i * 3 + 2] = r * Math.cos(phi) * axisRatioZ;

      // Uniformly warm: orange to red-orange (old stellar population)
      const warmth = rng.range(0.7, 1.0);
      const normalizedR = r / radius;
      // Slight gradient: redder at center, slightly less red at edge
      const gradientShift = normalizedR * 0.1;
      colors[i * 3]     = warmth;
      colors[i * 3 + 1] = warmth * rng.range(0.55, 0.72) + gradientShift;
      colors[i * 3 + 2] = warmth * rng.range(0.3, 0.45) + gradientShift;

      sizes[i] = rng.range(1.0, 3.0);
    }

    const tourStops = [
      { name: 'Overview', position: [0, radius * 0.5, radius * 0.7], orbitDistance: radius * 1.2, bodyRadius: radius, linger: 40 },
      { name: 'Core',     position: [0, 0, 0],                        orbitDistance: radius * 0.3, bodyRadius: radius * 0.2, linger: 35 },
      { name: 'Outer',    position: [radius * 0.6, 0, 0],             orbitDistance: radius * 0.8, bodyRadius: radius * 0.5, linger: 30 },
    ];

    return {
      type: 'elliptical-galaxy',
      positions,
      colors,
      sizes,
      particleCount,
      radius,
      tiltX,
      tiltZ,
      tourStops,
    };
  }

  // ── Utility ────────────────────────────────────────────────────

  /** Box-Muller transform: two uniform randoms → one Gaussian (mean 0, std 1). */
  static _gaussian(rng) {
    const u1 = rng.float() || 0.0001; // avoid log(0)
    const u2 = rng.float();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }
}
