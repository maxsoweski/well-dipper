import { SeededRandom } from './SeededRandom.js';
import { solarRadiiToScene } from '../core/ScaleConstants.js';

/**
 * NavigableNebulaGenerator — produces data for flyable nebulae.
 *
 * Unlike NebulaGenerator (billboard layers for distant viewing), this creates
 * data suitable for the VolumetricNebula renderer (Points-based gas cloud)
 * plus real Star objects that the camera can fly between.
 *
 * Two types:
 *   Planetary nebula: gas shell around a central white dwarf, compact
 *   Emission nebula: huge irregular gas cloud with multiple young hot stars
 *
 * Returns plain JS objects — no Three.js dependencies.
 */
export class NavigableNebulaGenerator {
  // Same palettes as NebulaGenerator (reuse for consistency)
  static PALETTE = {
    'h-alpha':    { r: [0.78, 1.0],  g: [0.18, 0.40], b: [0.22, 0.48] },
    'oiii':       { r: [0.18, 0.40], g: [0.60, 0.88], b: [0.55, 0.82] },
    'reflection': { r: [0.35, 0.58], g: [0.50, 0.72], b: [0.78, 1.0]  },
  };

  // Star properties (subset of StarSystemGenerator — just what we need)
  static STAR_TYPES = {
    // White dwarf (for planetary nebulae)
    WD: { color: [0.80, 0.85, 1.0], radiusSolar: 0.015, temp: 80000 },
    // Young hot stars (for emission nebulae)
    O:  { color: [0.61, 0.69, 1.0], radiusSolar: 12.0,  temp: 40000 },
    B:  { color: [0.67, 0.75, 1.0], radiusSolar: 5.0,   temp: 20000 },
    A:  { color: [0.79, 0.84, 1.0], radiusSolar: 1.8,   temp: 8750  },
  };

  /**
   * Generate navigable nebula data.
   * @param {string} seed — deterministic seed
   * @param {string} type — 'planetary-nebula' or 'emission-nebula'
   * @returns {Object} nebula data with gasCloud, stars, planets, radius
   */
  static generate(seed, type = 'emission-nebula') {
    const rng = new SeededRandom(seed);

    if (type === 'planetary-nebula') {
      return this._generatePlanetary(rng);
    }
    return this._generateEmission(rng);
  }

  // ── Planetary Nebula ──────────────────────────────────────────────

  static _generatePlanetary(rng) {
    const radius = rng.range(60000, 150000);  // 2-4x star system size
    const isBipolar = rng.chance(0.4);

    // ── Central white dwarf ──
    const wdProps = this.STAR_TYPES.WD;
    const wdRadiusSolar = wdProps.radiusSolar * rng.range(0.8, 1.2);
    const wdRadiusScene = solarRadiiToScene(wdRadiusSolar);

    const stars = [{
      type: 'WD',
      color: [...wdProps.color],
      radiusSolar: wdRadiusSolar,
      radiusScene: wdRadiusScene,
      // Render bigger so it's visible (white dwarfs are 0.07 scene units — invisible)
      renderRadius: radius * 0.002,
      temp: wdProps.temp,
      position: [0, 0, 0],
    }];

    // ── Gas cloud ──
    const particleCount = rng.int(12000, 22000);
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);
    const opacities = new Float32Array(particleCount);

    // Color theme: inner OIII teal, outer H-alpha red
    const innerPal = this.PALETTE['oiii'];
    const outerPal = this.PALETTE['h-alpha'];

    for (let i = 0; i < particleCount; i++) {
      let x, y, z;

      if (isBipolar) {
        // Hourglass / bipolar shape
        // Particles concentrated in two lobes along Y axis
        const lobe = rng.chance(0.5) ? 1 : -1;
        const t = rng.float();  // 0-1 along the lobe
        const lobeR = radius * 0.4 * Math.sin(t * Math.PI);  // widest at middle of lobe
        const angle = rng.range(0, 2 * Math.PI);

        x = lobeR * Math.cos(angle) + this._gaussian(rng) * radius * 0.05;
        y = lobe * t * radius * 0.6 + this._gaussian(rng) * radius * 0.03;
        z = lobeR * Math.sin(angle) + this._gaussian(rng) * radius * 0.05;
      } else {
        // Ring / torus shape — particles in a ring in the XZ plane
        const ringAngle = rng.range(0, 2 * Math.PI);
        const ringR = radius * rng.range(0.25, 0.65);
        const spread = radius * 0.12;

        x = Math.cos(ringAngle) * ringR + this._gaussian(rng) * spread;
        y = this._gaussian(rng) * spread * 0.4;
        z = Math.sin(ringAngle) * ringR + this._gaussian(rng) * spread;
      }

      positions[i * 3]     = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      // Color: blend from inner OIII to outer H-alpha based on distance from center
      const dist = Math.sqrt(x * x + y * y + z * z);
      const normalizedDist = Math.min(dist / radius, 1);
      const innerWeight = 1 - normalizedDist;

      const pal = innerWeight > 0.5 ? innerPal : outerPal;
      colors[i * 3]     = rng.range(pal.r[0], pal.r[1]);
      colors[i * 3 + 1] = rng.range(pal.g[0], pal.g[1]);
      colors[i * 3 + 2] = rng.range(pal.b[0], pal.b[1]);

      // Larger particles for soft cloud, some variation
      sizes[i] = rng.range(40, 200);
      // Denser near the shell, dimmer at edges
      opacities[i] = (0.3 + innerWeight * 0.5) * rng.range(0.4, 0.9);
    }

    const gasCloud = { positions, colors, sizes, opacities, particleCount };

    // ── Planets (0-2 remnant rocky/carbon) ──
    // Placeholder: no planets for now (Phase 9D will handle spawning them)
    const planets = [];

    return {
      type: 'planetary-nebula',
      _destType: 'planetary-nebula',
      gasCloud,
      stars,
      planets,
      radius,
      isBipolar,
    };
  }

  // ── Emission Nebula ──────────────────────────────────────────────

  static _generateEmission(rng) {
    const radius = rng.range(200000, 500000);  // 6-12x star system size (biggest!)
    const theme = rng.chance(0.6) ? 'h-alpha-dominant' : 'oiii-dominant';

    // ── Stars: 2-5 young hot stars scattered through the volume ──
    const starCount = rng.int(2, 5);
    const starTypes = ['O', 'B', 'B', 'A', 'A'];  // weighted toward B-class
    const stars = [];

    for (let s = 0; s < starCount; s++) {
      const sType = starTypes[rng.int(0, starTypes.length - 1)];
      const props = this.STAR_TYPES[sType];
      const radiusSolar = props.radiusSolar * rng.range(0.7, 1.3);
      const radiusScene = solarRadiiToScene(radiusSolar);

      // Scatter stars through the inner half of the nebula volume
      const r = radius * rng.range(0.05, 0.4);
      const theta = rng.range(0, 2 * Math.PI);
      const phi = Math.acos(rng.range(-1, 1));

      stars.push({
        type: sType,
        color: [...props.color],
        radiusSolar,
        radiusScene,
        renderRadius: null,  // use actual radiusScene (hot stars are big enough to see)
        temp: props.temp,
        position: [
          r * Math.sin(phi) * Math.cos(theta),
          r * Math.sin(phi) * Math.sin(theta) * 0.4,  // somewhat flattened
          r * Math.cos(phi),
        ],
      });
    }

    // ── Gas cloud: irregular 3D clumps ──
    const particleCount = rng.int(18000, 30000);
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);
    const opacities = new Float32Array(particleCount);

    // Create 3-6 sub-clumps for irregular shape
    const clumpCount = rng.int(3, 6);
    const clumps = [];
    for (let c = 0; c < clumpCount; c++) {
      clumps.push({
        x: this._gaussian(rng) * radius * 0.25,
        y: this._gaussian(rng) * radius * 0.12,
        z: this._gaussian(rng) * radius * 0.25,
        spread: rng.range(0.15, 0.4) * radius,
      });
    }

    for (let i = 0; i < particleCount; i++) {
      // Pick a random clump
      const clump = clumps[i % clumpCount];

      const x = clump.x + this._gaussian(rng) * clump.spread;
      const y = clump.y + this._gaussian(rng) * clump.spread * 0.35;
      const z = clump.z + this._gaussian(rng) * clump.spread;

      positions[i * 3]     = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      // Color based on theme
      let colorType;
      if (theme === 'h-alpha-dominant') {
        colorType = rng.chance(0.6) ? 'h-alpha' : (rng.chance(0.7) ? 'oiii' : 'reflection');
      } else {
        colorType = rng.chance(0.5) ? 'oiii' : (rng.chance(0.7) ? 'h-alpha' : 'reflection');
      }

      const pal = this.PALETTE[colorType];
      colors[i * 3]     = rng.range(pal.r[0], pal.r[1]);
      colors[i * 3 + 1] = rng.range(pal.g[0], pal.g[1]);
      colors[i * 3 + 2] = rng.range(pal.b[0], pal.b[1]);

      // Larger particles for nebula gas, more variation
      sizes[i] = rng.range(80, 400);
      // Opacity: denser near clump centers
      const distFromClump = Math.sqrt(
        Math.pow(x - clump.x, 2) +
        Math.pow(y - clump.y, 2) +
        Math.pow(z - clump.z, 2)
      );
      const normalizedDist = Math.min(distFromClump / clump.spread, 1);
      opacities[i] = (1 - normalizedDist * 0.6) * rng.range(0.3, 0.7);
    }

    const gasCloud = { positions, colors, sizes, opacities, particleCount };

    return {
      type: 'emission-nebula',
      _destType: 'emission-nebula',
      gasCloud,
      stars,
      planets: [],  // emission nebulae are too young for planets
      radius,
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
