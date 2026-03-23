import { GalacticMap } from '../generation/GalacticMap.js';

/**
 * GalaxyLuminosityRenderer — produces galaxy images from accumulated starlight.
 *
 * Architecture: Layer 4 (Rendering) — a read-only consumer of Layer 0 (GalacticMap).
 *
 * At each pixel, computes the total luminosity from all spectral type populations,
 * weighted by their absolute magnitude. O/B stars contribute vastly more light
 * despite being rare, which naturally produces:
 *   - Blue-white arms (O/B concentrate there via starTypeDensityMultiplier)
 *   - Warm inter-arm regions (dim K/M don't contribute, remaining G/F are warm)
 *   - Golden bulge (old population, evolved giants dominate)
 *
 * Colors emerge from physics — no hand-tuned color blending.
 *
 * Pure CPU renderer (Canvas 2D ImageData). No Three.js dependency.
 */

// ── Constants from HashGridStarfield (the authoritative source) ──

const ABS_MAG = {
  O: -5.0, B: -1.5, A: 1.5, F: 3.0, G: 5.0, K: 7.0, M: 10.0,
  Kg: -0.5, Gg: 0.5, Mg: -0.2,
};

const SPECTRAL_COLOR = {
  O: [0.6, 0.7, 1.0],
  B: [0.7, 0.8, 1.0],
  A: [0.95, 0.95, 1.0],
  F: [1.0, 0.95, 0.85],
  G: [1.0, 0.9, 0.7],
  K: [1.0, 0.75, 0.4],
  M: [1.0, 0.5, 0.2],
  Kg: [1.0, 0.65, 0.3],
  Gg: [1.0, 0.85, 0.5],
  Mg: [1.0, 0.4, 0.15],
};

// Fraction of each base type's population that are evolved giants.
// In old populations (bulge, halo), evolved giants are rare by count
// but contribute disproportionate luminosity (100-1000× brighter).
const EVOLVED_FRACTION = {
  Kg: 0.02,   // ~2% of K stars are RGB giants
  Gg: 0.015,  // ~1.5% are G-type giants
  Mg: 0.005,  // ~0.5% are AGB stars
};

// Pre-compute luminosity in solar units for each type: L = 10^(-0.4 × M)
const TYPE_LUMINOSITY = {};
for (const [type, mag] of Object.entries(ABS_MAG)) {
  TYPE_LUMINOSITY[type] = Math.pow(10, -0.4 * mag);
}

// Real IMF population fractions (Kroupa 2001).
// These are the actual number fractions of each spectral type in a
// stellar population — NOT the cinematic weights used for gameplay.
// The cinematic weights (5% O stars) make for fun star systems to visit,
// but produce wildly wrong colors when computing integrated light.
// For a luminosity image (what a camera would see), we need real fractions.
const REAL_POP_FRACTIONS = {
  thin:  { O: 0.0000003, B: 0.0013, A: 0.006, F: 0.03,  G: 0.076, K: 0.121, M: 0.765 },
  thick: { O: 0,         B: 0,      A: 0.001, F: 0.02,   G: 0.076, K: 0.180, M: 0.723 },
  bulge: { O: 0,         B: 0.0001, A: 0.002, F: 0.015,  G: 0.070, K: 0.200, M: 0.713 },
  halo:  { O: 0,         B: 0,      A: 0,     F: 0.005,  G: 0.050, K: 0.200, M: 0.745 },
};

// Arm boost factors for young types (same physics as starTypeDensityMultiplier
// but applied to real fractions). O/B concentrate in arms because that's where
// star formation happens — short-lived stars haven't had time to spread out.
const ARM_BOOST = { O: 5.0, B: 4.0, A: 2.0, F: 1.2, G: 1.0, K: 1.0, M: 1.0 };

// Main-sequence types for the primary luminosity loop
const MS_TYPES = ['O', 'B', 'A', 'F', 'G', 'K', 'M'];
// Evolved types and their base counterparts
const EVOLVED_TYPES = [
  { type: 'Kg', base: 'K' },
  { type: 'Gg', base: 'G' },
  { type: 'Mg', base: 'M' },
];

// ── CPU noise functions (for post-processing texture) ──

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

export class GalaxyLuminosityRenderer {

  /**
   * @param {import('../generation/GalacticMap.js').GalacticMap} galacticMap
   */
  constructor(galacticMap) {
    this._gm = galacticMap;
  }

  /**
   * Render a luminosity image for a given spatial region.
   *
   * @param {number} centerX — center X in kpc (galactic coordinates)
   * @param {number} centerZ — center Z in kpc
   * @param {number} extent — half-width in kpc (image covers ±extent from center)
   * @param {number} resolution — pixel width = height
   * @param {Object} [options]
   * @param {number} [options.dustStrength=0.5] — dust lane absorption strength
   * @param {number} [options.noiseStrength=0.5] — FBM noise texture strength
   * @param {number} [options.gamma=0.5] — tone mapping gamma
   * @param {number} [options.stretch=500] — asinh stretch factor (higher = brighter faint regions)
   * @returns {HTMLCanvasElement}
   */
  render(centerX, centerZ, extent, resolution, options = {}) {
    const {
      gamma = 0.5,
      stretch = 500,
    } = options;

    const RES = resolution;
    const gm = this._gm;

    // ── Compute density grid (Layer 0 query) ──
    const densityGrid = new Float64Array(RES * RES);
    let maxDensity = 0;

    for (let py = 0; py < RES; py++) {
      for (let px = 0; px < RES; px++) {
        const gx = centerX + (px / RES - 0.5) * extent * 2;
        const gz = centerZ - (py / RES - 0.5) * extent * 2;
        const R = Math.sqrt(gx * gx + gz * gz);
        const theta = Math.atan2(gz, gx);
        const d = gm.potentialDerivedDensity(R, 0, theta).totalDensity;
        densityGrid[py * RES + px] = d;
        if (d > maxDensity) maxDensity = d;
      }
    }
    if (maxDensity < 1e-20) maxDensity = 1;

    // ── Nebula-style layered cloud rendering ──
    //
    // Same technique as Nebula.js: multiple transparent layers with
    // domain-warped FBM noise, composited additively.
    // Density from the gravitational model drives WHERE clouds form.
    // Noise drives HOW they look (bright knots, dark voids, filaments).
    //
    // Simple warm-white light for now — luminosity coloring comes later.

    const canvas = document.createElement('canvas');
    canvas.width = RES;
    canvas.height = RES;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, RES, RES);

    const NUM_LAYERS = 7;
    const baseColor = [0.9, 0.85, 0.75]; // warm white

    for (let layer = 0; layer < NUM_LAYERS; layer++) {
      const imgData = ctx.createImageData(RES, RES);

      // Unique noise seed per layer
      const seedX = Math.sin(layer * 7.3 + 0.5) * 50 + 50;
      const seedZ = Math.cos(layer * 5.1 + 1.2) * 50 + 50;

      // Multi-scale: each layer at a different noise frequency
      const noiseScale = (1.0 + layer * 0.5) / Math.max(extent, 0.01);

      // Per-layer opacity
      const layerOpacity = 0.7 / NUM_LAYERS;

      for (let py = 0; py < RES; py++) {
        for (let px = 0; px < RES; px++) {
          const i = py * RES + px;
          const density = densityGrid[i];

          const gx = centerX + (px / RES - 0.5) * extent * 2;
          const gz = centerZ - (py / RES - 0.5) * extent * 2;

          // Normalize density (asinh stretch)
          let bright = Math.asinh(density * stretch) / Math.asinh(maxDensity * stretch);
          bright = Math.pow(Math.max(0, bright), gamma);

          // ── Domain-warped FBM (the Nebula.js recipe) ──
          const npx = gx * noiseScale + seedX;
          const npy = gz * noiseScale + seedZ;

          const q0 = _fbm(npx, npy, 5);
          const q1 = _fbm(npx + 5.2, npy + 1.3, 5);
          const warped = _fbm(npx + 3.5 * q0, npy + 3.5 * q1, 5);

          // Cloud shape: smoothstep creates bright clouds / dark voids
          // Dense regions → low threshold → more cloud
          // Sparse regions → high threshold → more void
          const cloudCoverage = Math.min(1, bright * 2.5);
          const lo = 0.1 + (1 - cloudCoverage) * 0.35;
          const hi = lo + 0.3;
          const cloud = _smoothstep(lo, hi, warped);

          // Final alpha
          const alpha = bright * cloud * layerOpacity;
          if (alpha < 0.001) continue;

          // Premultiplied color (additive)
          const idx = i * 4;
          imgData.data[idx]     = Math.min(255, Math.round(baseColor[0] * alpha * 255));
          imgData.data[idx + 1] = Math.min(255, Math.round(baseColor[1] * alpha * 255));
          imgData.data[idx + 2] = Math.min(255, Math.round(baseColor[2] * alpha * 255));
          imgData.data[idx + 3] = Math.round(Math.min(1, alpha) * 255);
        }
      }

      // Composite additively
      const layerCanvas = document.createElement('canvas');
      layerCanvas.width = RES;
      layerCanvas.height = RES;
      layerCanvas.getContext('2d').putImageData(imgData, 0, 0);
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(layerCanvas, 0, 0);
    }

    ctx.globalCompositeOperation = 'source-over';
    return canvas;
  }

  /**
   * Dust lane strength at a position (inner trailing edge of arms).
   * Same formula used in GalaxyGlow shader and previous NavComputer renderer.
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
