import { GalacticMap } from '../generation/GalacticMap.js';

/**
 * GalaxyLuminosityRenderer — produces galaxy images from accumulated starlight.
 *
 * Architecture: Layer 4 (Rendering) — a read-only consumer of Layer 0 (GalacticMap).
 *
 * Per-component lighting: each galactic component (core, bar, arms, disk, halo)
 * is tone-mapped and colored independently, then composited. This prevents the
 * bright core from crushing arm detail, and allows each component to be tuned
 * for visual clarity at any zoom level.
 *
 * Pure CPU renderer (Canvas 2D ImageData). No Three.js dependency.
 */

// ── CPU noise functions (for cloud texture) ──

function _hash22(px, py) {
  const ax = Math.sin(px * 127.1 + py * 311.7) * 43758.5453;
  const ay = Math.sin(px * 269.5 + py * 183.3) * 43758.5453;
  return [ax - Math.floor(ax), ay - Math.floor(ay)];
}

function _noise(px, py) {
  const ix = Math.floor(px), iy = Math.floor(py);
  const fx = px - ix, fy = py - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const [ha0, ha1] = _hash22(ix, iy);
  const [hb0, hb1] = _hash22(ix + 1, iy);
  const [hc0, hc1] = _hash22(ix, iy + 1);
  const [hd0, hd1] = _hash22(ix + 1, iy + 1);
  const a = (ha0 - 0.5) * fx + (ha1 - 0.5) * fy;
  const b = (hb0 - 0.5) * (fx - 1) + (hb1 - 0.5) * fy;
  const c = (hc0 - 0.5) * fx + (hc1 - 0.5) * (fy - 1);
  const d = (hd0 - 0.5) * (fx - 1) + (hd1 - 0.5) * (fy - 1);
  const ab = a + (b - a) * ux, cd = c + (d - c) * ux;
  return ab + (cd - ab) * uy + 0.5;
}

function _fbm(px, py, octaves = 4) {
  let v = 0, a = 0.5;
  for (let i = 0; i < octaves; i++) {
    v += a * _noise(px, py);
    px *= 2; py *= 2; a *= 0.5;
  }
  return v;
}

function _smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// ── Default component lighting profiles ──
// Each component has: color [r,g,b], gain (pre-stretch multiplier),
// gamma (post-stretch power curve), stretch (asinh compression factor).
//
// These defaults produce a natural-looking galaxy. The render() options
// let you override any of them per-call, which is essential for
// sector drill-downs where you need different balance.

const DEFAULT_COMPONENTS = {
  core: {
    color: [1.0, 0.88, 0.55],   // warm golden — old K/M giant population
    gain: 1.0,
    gamma: 0.6,
    stretch: 50,                  // low stretch → preserves core's brightness peak
  },
  bar: {
    color: [1.0, 0.82, 0.50],   // slightly deeper amber than core
    gain: 1.5,
    gamma: 0.5,
    stretch: 100,
  },
  arms: {
    color: [0.75, 0.85, 1.0],   // blue-white — young O/B population
    gain: 3.0,                    // boost arms so they're visible next to core
    gamma: 0.45,
    stretch: 500,                 // high stretch → bring out faint outer arms
  },
  disk: {
    color: [1.0, 0.92, 0.75],   // warm yellow — F/G/K population
    gain: 2.0,
    gamma: 0.5,
    stretch: 300,
  },
  halo: {
    color: [0.85, 0.80, 0.90],  // faint cool lavender — old metal-poor population
    gain: 8.0,                    // needs big boost to be visible at all
    gamma: 0.4,
    stretch: 1000,                // extreme stretch for the very faint halo
  },
};

export class GalaxyLuminosityRenderer {

  /**
   * @param {import('../generation/GalacticMap.js').GalacticMap} galacticMap
   */
  constructor(galacticMap) {
    this._gm = galacticMap;
  }

  /**
   * Render a luminosity image with per-component lighting.
   *
   * @param {number} centerX — center X in kpc (galactic coordinates)
   * @param {number} centerZ — center Z in kpc
   * @param {number} extent — half-width in kpc (image covers ±extent from center)
   * @param {number} resolution — pixel width = height
   * @param {Object} [options]
   * @param {Object} [options.components] — per-component overrides (partial OK).
   *   e.g. { arms: { gain: 5.0 }, core: { gamma: 0.3 } }
   * @param {number} [options.noiseOctaves=5] — FBM noise octaves for cloud texture
   * @param {number} [options.noiseLayers=5] — number of domain-warped noise layers
   * @param {number} [options.noiseStrength=0.6] — how much noise modulates brightness (0=none, 1=full)
   * @param {number} [options.dustStrength=0.4] — dust lane absorption strength
   * @returns {HTMLCanvasElement}
   */
  render(centerX, centerZ, extent, resolution, options = {}) {
    const {
      components: componentOverrides = {},
      noiseOctaves = 5,
      noiseLayers = 5,
      noiseStrength = 0.6,
      dustStrength = 0.4,
    } = options;

    // Merge user overrides with defaults
    const comp = {};
    for (const key of Object.keys(DEFAULT_COMPONENTS)) {
      comp[key] = { ...DEFAULT_COMPONENTS[key], ...(componentOverrides[key] || {}) };
    }

    const RES = resolution;
    const gm = this._gm;
    const COMPONENTS = ['core', 'bar', 'arms', 'disk', 'halo'];

    // ── Pass 1: Compute per-component density grids ──
    // We store 5 absolute density values per pixel, plus arm strength.
    // This lets us tone-map each component against its OWN maximum,
    // not the global max (which is always the core).

    const grids = {};
    const maxVals = {};
    for (const c of COMPONENTS) {
      grids[c] = new Float64Array(RES * RES);
      maxVals[c] = 0;
    }

    for (let py = 0; py < RES; py++) {
      for (let px = 0; px < RES; px++) {
        const gx = centerX + (px / RES - 0.5) * extent * 2;
        const gz = centerZ - (py / RES - 0.5) * extent * 2;
        const R = Math.sqrt(gx * gx + gz * gz);
        const theta = Math.atan2(gz, gx);

        const d = gm.potentialDerivedDensity(R, 0, theta);
        const armStr = gm.spiralArmStrength(R, theta);

        const i = py * RES + px;

        // Core = bulge density (the spherical central mass)
        grids.core[i] = d.bulgeAbs;
        // Bar = the triaxial bar mass boost
        grids.bar[i] = d.barAbs;
        // Arms = thin disk density weighted by arm strength
        // armStr is 0-1 (how close to an arm center). We use it to
        // split the thin disk into "arm" and "inter-arm" contributions.
        grids.arms[i] = d.thinAbs * armStr;
        // Disk = thin disk inter-arm + thick disk (the smooth background)
        grids.disk[i] = d.thinAbs * (1 - armStr) + d.thickAbs;
        // Halo = NFW dark matter halo stellar population
        grids.halo[i] = d.haloAbs;

        for (const c of COMPONENTS) {
          if (grids[c][i] > maxVals[c]) maxVals[c] = grids[c][i];
        }
      }
    }

    // Safety: prevent division by zero for components that don't appear in view
    for (const c of COMPONENTS) {
      if (maxVals[c] < 1e-20) maxVals[c] = 1;
    }

    // ── Pass 2: Tone-map each component independently and composite ──
    // Each component is asinh-stretched against its own max, then gamma'd.
    // This is the key insight: the core's max doesn't affect arm brightness.

    // Float accumulation buffer (RGB, 0-1 range before clamping)
    const accR = new Float64Array(RES * RES);
    const accG = new Float64Array(RES * RES);
    const accB = new Float64Array(RES * RES);

    for (const c of COMPONENTS) {
      const { color, gain, gamma, stretch } = comp[c];
      const maxD = maxVals[c];
      const asinhMax = Math.asinh(maxD * stretch * gain);
      if (asinhMax < 1e-20) continue; // component not present in this view

      const grid = grids[c];
      for (let i = 0; i < RES * RES; i++) {
        const raw = grid[i] * gain;
        if (raw < 1e-20) continue;

        // Per-component asinh stretch + gamma
        let bright = Math.asinh(raw * stretch) / asinhMax;
        bright = Math.pow(bright, gamma);

        accR[i] += bright * color[0];
        accG[i] += bright * color[1];
        accB[i] += bright * color[2];
      }
    }

    // ── Pass 3: Apply noise texture (cloud structure) ──
    // Domain-warped FBM gives the nebula-like cloud texture.
    // Applied as a multiplier on top of the component-lit image.

    const canvas = document.createElement('canvas');
    canvas.width = RES;
    canvas.height = RES;
    const ctx = canvas.getContext('2d');
    const imgData = ctx.createImageData(RES, RES);

    for (let py = 0; py < RES; py++) {
      for (let px = 0; px < RES; px++) {
        const i = py * RES + px;
        let r = accR[i], g = accG[i], b = accB[i];

        if (r + g + b < 0.001) continue;

        // Cloud noise modulation
        if (noiseStrength > 0 && noiseLayers > 0) {
          const gx = centerX + (px / RES - 0.5) * extent * 2;
          const gz = centerZ - (py / RES - 0.5) * extent * 2;

          let cloudSum = 0;
          for (let layer = 0; layer < noiseLayers; layer++) {
            const seedX = Math.sin(layer * 7.3 + 0.5) * 50 + 50;
            const seedZ = Math.cos(layer * 5.1 + 1.2) * 50 + 50;
            const noiseScale = (1.0 + layer * 0.5) / Math.max(extent, 0.01);

            const npx = gx * noiseScale + seedX;
            const npy = gz * noiseScale + seedZ;
            const q0 = _fbm(npx, npy, noiseOctaves);
            const q1 = _fbm(npx + 5.2, npy + 1.3, noiseOctaves);
            const warped = _fbm(npx + 3.5 * q0, npy + 3.5 * q1, noiseOctaves);
            cloudSum += warped;
          }
          cloudSum /= noiseLayers;

          // Blend between 1.0 (no noise effect) and the cloud value
          const totalBright = r + g + b;
          const cloudCoverage = Math.min(1, totalBright * 3.0);
          const lo = 0.1 + (1 - cloudCoverage) * 0.35;
          const hi = lo + 0.3;
          const cloud = _smoothstep(lo, hi, cloudSum);
          const noiseMul = 1 - noiseStrength + noiseStrength * cloud;

          r *= noiseMul;
          g *= noiseMul;
          b *= noiseMul;
        }

        // Dust lane absorption
        if (dustStrength > 0) {
          const gx = centerX + (px / RES - 0.5) * extent * 2;
          const gz = centerZ - (py / RES - 0.5) * extent * 2;
          const R = Math.sqrt(gx * gx + gz * gz);
          const theta = Math.atan2(gz, gx);
          const dust = this._dustLane(R, theta);
          const absorption = 1 - dust * dustStrength;
          r *= absorption;
          g *= absorption;
          b *= absorption;
        }

        // Write pixel
        const idx = i * 4;
        imgData.data[idx]     = Math.min(255, Math.round(Math.max(0, r) * 255));
        imgData.data[idx + 1] = Math.min(255, Math.round(Math.max(0, g) * 255));
        imgData.data[idx + 2] = Math.min(255, Math.round(Math.max(0, b) * 255));
        imgData.data[idx + 3] = 255;
      }
    }

    ctx.putImageData(imgData, 0, 0);
    return canvas;
  }

  /**
   * Get the default component lighting profiles.
   * Useful for building UI controls — caller can read defaults,
   * let user adjust, then pass back as options.components.
   * @returns {Object} deep copy of default component settings
   */
  static getDefaultComponents() {
    const copy = {};
    for (const [key, val] of Object.entries(DEFAULT_COMPONENTS)) {
      copy[key] = { ...val, color: [...val.color] };
    }
    return copy;
  }

  /**
   * Dust lane strength at a position (inner trailing edge of arms).
   * @private
   */
  _dustLane(R, theta) {
    const gm = this._gm;
    const sinPitch = Math.sin(gm.pitchAngle);
    let best = 0;
    for (const arm of gm.arms) {
      const expected = arm.offset + gm.pitchK * Math.log(R / 4) - 0.08;
      let dt = ((theta - expected) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
      const dist = Math.abs(dt) * R * sinPitch;
      const w = arm.width * 0.35;
      const g = Math.exp(-0.5 * (dist / w) ** 2) * (arm.densityBoost / 2.5);
      if (g > best) best = g;
    }
    return best;
  }
}
