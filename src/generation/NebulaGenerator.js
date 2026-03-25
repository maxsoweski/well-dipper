import { SeededRandom } from './SeededRandom.js';

/**
 * NebulaGenerator — produces data for nebulae (emission and planetary).
 *
 * Emission nebulae: large billowing clouds of ionized gas (H-alpha red, OIII teal).
 *   Rendered as layered billboard planes with noise shaders.
 * Planetary nebulae: compact ring/bipolar shells around dying stars.
 *   Same renderer but with structured layer placement + central white dwarf.
 *
 * Returns plain JS objects — no Three.js dependencies.
 */
export class NebulaGenerator {
  // Emission line color palettes (approximate RGB, 0–1 range)
  static PALETTE = {
    'h-alpha':    { r: [0.78, 1.0],  g: [0.18, 0.40], b: [0.22, 0.48] }, // deep red-pink
    'oiii':       { r: [0.18, 0.40], g: [0.60, 0.88], b: [0.55, 0.82] }, // teal / blue-green
    'reflection': { r: [0.35, 0.58], g: [0.50, 0.72], b: [0.78, 1.0]  }, // cool blue
  };

  /**
   * Generate nebula data.
   * @param {string} seed — deterministic seed
   * @param {string} type — 'emission-nebula' or 'planetary-nebula'
   * @returns {Object} nebula data (layers, embedded stars, tourStops)
   */
  static generate(seed, type = 'emission-nebula') {
    const rng = new SeededRandom(seed);

    if (type === 'planetary-nebula') {
      return this._generatePlanetary(rng);
    }
    return this._generateEmission(rng);
  }

  // ── Emission Nebula ─────────────────────────────────────────────

  static _generateEmission(rng) {
    const radius = rng.range(200, 450);
    const layerCount = rng.int(5, 9);

    // Decide overall color theme: mostly H-alpha or mostly OIII
    const theme = rng.chance(0.6) ? 'h-alpha-dominant' : 'oiii-dominant';

    const layers = [];
    for (let i = 0; i < layerCount; i++) {
      // Pick color type based on theme
      let colorType;
      if (theme === 'h-alpha-dominant') {
        colorType = rng.chance(0.6) ? 'h-alpha' : (rng.chance(0.7) ? 'oiii' : 'reflection');
      } else {
        colorType = rng.chance(0.5) ? 'oiii' : (rng.chance(0.7) ? 'h-alpha' : 'reflection');
      }

      const pal = this.PALETTE[colorType];
      layers.push({
        position: [
          this._gaussian(rng) * radius * 0.25,
          this._gaussian(rng) * radius * 0.15,
          this._gaussian(rng) * radius * 0.25,
        ],
        size: radius * rng.range(0.5, 1.4),
        rotation: [
          rng.range(-0.5, 0.5),
          rng.range(0, Math.PI * 2),
          rng.range(-0.3, 0.3),
        ],
        color: [
          rng.range(pal.r[0], pal.r[1]),
          rng.range(pal.g[0], pal.g[1]),
          rng.range(pal.b[0], pal.b[1]),
        ],
        noiseSeed: [rng.float() * 100, rng.float() * 100],
        noiseScale: rng.range(1.5, 3.5),
        opacity: rng.range(0.25, 0.65),
        // Shape-specific parameters for procedural variety
        domainWarpStrength: rng.range(0.3, 1.0),
        darkLaneStrength: rng.range(0, 0.3), // emission nebulae can have dust lanes
        asymmetry: rng.range(0, 0.4),
        brightnessShape: 0, // emission nebulae are center-bright
      });
    }

    // Embedded star particles (young blue-white stars born in the nebula)
    const starCount = rng.int(500, 2000);
    const starPositions = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);
    const starSizes = new Float32Array(starCount);

    for (let i = 0; i < starCount; i++) {
      // Scattered within the nebula volume
      starPositions[i * 3]     = this._gaussian(rng) * radius * 0.4;
      starPositions[i * 3 + 1] = this._gaussian(rng) * radius * 0.3;
      starPositions[i * 3 + 2] = this._gaussian(rng) * radius * 0.4;

      // Blue-white (young hot stars)
      const blue = rng.range(0.7, 1.0);
      starColors[i * 3]     = blue * rng.range(0.7, 0.9);
      starColors[i * 3 + 1] = blue * rng.range(0.8, 0.95);
      starColors[i * 3 + 2] = blue;

      starSizes[i] = rng.chance(0.05) ? rng.range(3, 6) : rng.range(1, 2.5);
    }

    const tourStops = [
      { name: 'Approach',  position: [0, radius * 0.3, radius * 0.8], orbitDistance: radius * 1.2, bodyRadius: radius, linger: 40 },
      { name: 'Interior',  position: [0, 0, 0],                        orbitDistance: radius * 0.3, bodyRadius: radius * 0.2, linger: 35 },
      { name: 'Star Knot', position: [radius * 0.2, 0, radius * 0.15], orbitDistance: radius * 0.15, bodyRadius: radius * 0.08, linger: 30 },
      { name: 'Drift Out',  position: [-radius * 0.5, 0, -radius * 0.3], orbitDistance: radius * 0.8, bodyRadius: radius * 0.4, linger: 25 },
    ];

    return {
      type: 'emission-nebula',
      layers,
      starPositions,
      starColors,
      starSizes,
      starCount,
      radius,
      tourStops,
    };
  }

  // ── Planetary Nebula ──────────────────────────────────────────────

  static _generatePlanetary(rng) {
    const radius = rng.range(60, 160);

    // Shape: ring (face-on) or bipolar (hourglass)
    const isBipolar = rng.chance(0.4);
    const layerCount = rng.int(3, 5);

    const layers = [];
    for (let i = 0; i < layerCount; i++) {
      let position, rotation;

      if (isBipolar) {
        // Hourglass: layers offset along Y axis (bipolar lobes)
        const lobe = rng.chance(0.5) ? 1 : -1;
        position = [
          this._gaussian(rng) * radius * 0.05,
          lobe * radius * rng.range(0.2, 0.5),
          this._gaussian(rng) * radius * 0.05,
        ];
        rotation = [
          rng.range(-0.2, 0.2),
          rng.range(0, Math.PI * 2),
          rng.range(-0.2, 0.2),
        ];
      } else {
        // Ring: layers clustered in a ring formation (X-Z plane)
        const angle = rng.range(0, 2 * Math.PI);
        const ringR = radius * rng.range(0.3, 0.6);
        position = [
          Math.cos(angle) * ringR + this._gaussian(rng) * radius * 0.05,
          this._gaussian(rng) * radius * 0.05,
          Math.sin(angle) * ringR + this._gaussian(rng) * radius * 0.05,
        ];
        rotation = [
          rng.range(-0.3, 0.3),
          rng.range(0, Math.PI * 2),
          rng.range(-0.3, 0.3),
        ];
      }

      // Inner layers: OIII (teal), outer layers: H-alpha (red)
      const isInner = i < layerCount / 2;
      const colorType = isInner ? 'oiii' : 'h-alpha';
      const pal = this.PALETTE[colorType];

      layers.push({
        position,
        size: radius * rng.range(0.4, 0.9),
        rotation,
        color: [
          rng.range(pal.r[0], pal.r[1]),
          rng.range(pal.g[0], pal.g[1]),
          rng.range(pal.b[0], pal.b[1]),
        ],
        noiseSeed: [rng.float() * 100, rng.float() * 100],
        noiseScale: rng.range(2.0, 4.0),
        opacity: rng.range(0.3, 0.7),
        // Planetary nebulae: ring brightness, low warp, no dark lanes
        domainWarpStrength: rng.range(0.3, 0.6),
        darkLaneStrength: 0,
        asymmetry: rng.range(0, 0.2),
        brightnessShape: 1, // ring falloff
      });
    }

    // Central white dwarf star (small, hot, blue-white)
    const centralStar = {
      color: [0.8, 0.85, 1.0],
      radius: radius * 0.02,  // tiny
      luminosity: 1.0,
    };

    // Few scattered particles around the shell
    const starCount = rng.int(100, 400);
    const starPositions = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);
    const starSizes = new Float32Array(starCount);

    for (let i = 0; i < starCount; i++) {
      // Scattered in a shell around the center
      const r = radius * rng.range(0.3, 0.8);
      const theta = rng.range(0, 2 * Math.PI);
      const phi = Math.acos(rng.range(-1, 1));
      starPositions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      starPositions[i * 3 + 2] = r * Math.cos(phi);

      // Mixed warm colors (field stars around the nebula)
      starColors[i * 3]     = rng.range(0.7, 1.0);
      starColors[i * 3 + 1] = rng.range(0.6, 0.9);
      starColors[i * 3 + 2] = rng.range(0.5, 0.8);

      starSizes[i] = rng.range(1.0, 2.5);
    }

    const tourStops = [
      { name: 'Approach', position: [0, radius * 0.4, radius * 0.7], orbitDistance: radius * 1.3, bodyRadius: radius, linger: 40 },
      { name: 'Shell',    position: [0, 0, radius * 0.4],             orbitDistance: radius * 0.5, bodyRadius: radius * 0.3, linger: 30 },
      { name: 'Center',   position: [0, 0, 0],                        orbitDistance: radius * 0.15, bodyRadius: radius * 0.05, linger: 35 },
    ];

    return {
      type: 'planetary-nebula',
      layers,
      centralStar,
      starPositions,
      starColors,
      starSizes,
      starCount,
      radius,
      isBipolar,
      tourStops,
    };
  }

  // ── Utility ────────────────────────────────────────────────────

  static _gaussian(rng) {
    const u1 = rng.float() || 0.0001;
    const u2 = rng.float();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }
}
