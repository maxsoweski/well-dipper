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
      dustStrength = 0.5,
      noiseStrength = 0.5,
      gamma = 0.45,
      stretch = 500,
    } = options;

    const RES = resolution;
    const gm = this._gm;

    // ── Pass 1: Compute luminosity and color grids ──

    const lumGrid = new Float64Array(RES * RES);
    const colorR = new Float64Array(RES * RES);
    const colorG = new Float64Array(RES * RES);
    const colorB = new Float64Array(RES * RES);
    let maxLum = 0;

    // Pre-query Layer 1 features for the entire view (once, not per pixel)
    const viewFeatures = extent < 10
      ? gm.findNearbyFeatures({ x: centerX, y: 0, z: centerZ }, extent * 1.5)
      : [];

    for (let py = 0; py < RES; py++) {
      for (let px = 0; px < RES; px++) {
        const gx = centerX + (px / RES - 0.5) * extent * 2;
        const gz = centerZ - (py / RES - 0.5) * extent * 2; // Y-flip: top = +Z

        const R = Math.sqrt(gx * gx + gz * gz);
        const theta = Math.atan2(gz, gx);

        // Query Layer 0 — disk truncation, spiral arms, and bar are all
        // built into potentialDerivedDensity when theta is provided.
        // No separate bar/arm calculations needed here.
        const densities = gm.potentialDerivedDensity(R, 0, theta);
        const armStr = gm.spiralArmStrength(R, theta);
        const armInfo = gm.nearestArmInfo(R, theta);
        const totalDensity = densities.totalDensity;

        // Sum luminosity contributions from all spectral types.
        // Uses REAL IMF population fractions (not cinematic weights) blended
        // by the component fractions from the gravitational potential.
        // This produces physically correct integrated colors:
        //   - Arms: B-dominated luminosity → blue-white
        //   - Inter-arm: F/G-dominated → warm white
        //   - Bulge: evolved giants → golden-orange
        let totalLum = 0;
        let cr = 0, cg = 0, cb = 0;

        // Main-sequence types
        for (const type of MS_TYPES) {
          // Blend real population fractions by component weight
          let frac = 0;
          frac += (REAL_POP_FRACTIONS.thin[type] || 0) * (densities.thin || 0);
          frac += (REAL_POP_FRACTIONS.thick[type] || 0) * (densities.thick || 0);
          frac += (REAL_POP_FRACTIONS.bulge[type] || 0) * (densities.bulge || 0);
          frac += (REAL_POP_FRACTIONS.halo[type] || 0) * (densities.halo || 0);

          // Arm boost for young types in thin disk regions
          if (armStr > 0.1 && densities.thin > 0.2) {
            frac *= 1 + armStr * ((ARM_BOOST[type] || 1) - 1);
          }

          const lum = totalDensity * frac * TYPE_LUMINOSITY[type];
          totalLum += lum;
          const col = SPECTRAL_COLOR[type];
          cr += lum * col[0];
          cg += lum * col[1];
          cb += lum * col[2];
        }

        // Evolved types: fraction of their base type's population
        for (const { type, base } of EVOLVED_TYPES) {
          let baseFrac = 0;
          baseFrac += (REAL_POP_FRACTIONS.thin[base] || 0) * (densities.thin || 0);
          baseFrac += (REAL_POP_FRACTIONS.thick[base] || 0) * (densities.thick || 0);
          baseFrac += (REAL_POP_FRACTIONS.bulge[base] || 0) * (densities.bulge || 0);
          baseFrac += (REAL_POP_FRACTIONS.halo[base] || 0) * (densities.halo || 0);

          // Evolved fraction increases in old populations (bulge/halo have more giants)
          const oldBoost = 1 + (densities.bulge + densities.halo) * 3;
          const lum = totalDensity * baseFrac * EVOLVED_FRACTION[type] * oldBoost * TYPE_LUMINOSITY[type];
          totalLum += lum;
          const col = SPECTRAL_COLOR[type];
          cr += lum * col[0];
          cg += lum * col[1];
          cb += lum * col[2];
        }

        // ── Layer 1 features: bright spots from nebulae, clusters, OB assoc ──
        // Pre-queried once for the entire view, iterated per pixel.
        if (viewFeatures.length > 0) {
          for (const feat of viewFeatures) {
            const fdx = gx - feat.position.x;
            const fdz = gz - feat.position.z;
            const fdist = Math.sqrt(fdx * fdx + fdz * fdz);
            const fRadius = feat.radius || 0.05;
            if (fdist > fRadius * 3) continue;

            // Plummer-like brightness profile
            const plummer = 1 / (1 + (fdist / fRadius) ** 2);

            // Feature type determines luminosity and color contribution
            let fLum = plummer * totalDensity * 50; // features are locally bright
            let fColor;
            switch (feat.type) {
              case 'emission-nebula':
                fColor = [0.9, 0.3, 0.4]; // H-alpha pink
                fLum *= 3;
                break;
              case 'open-cluster':
              case 'ob-association':
                fColor = [0.6, 0.7, 1.0]; // young blue
                fLum *= 5;
                break;
              case 'globular-cluster':
                fColor = [1.0, 0.8, 0.5]; // old golden
                fLum *= 2;
                break;
              default:
                fColor = [0.8, 0.8, 0.9];
                fLum *= 1;
            }

            totalLum += fLum;
            cr += fLum * fColor[0];
            cg += fLum * fColor[1];
            cb += fLum * fColor[2];
          }
        }

        // Normalize color by total luminosity
        if (totalLum > 0) {
          cr /= totalLum;
          cg /= totalLum;
          cb /= totalLum;
        }

        const i = py * RES + px;
        lumGrid[i] = totalLum;
        colorR[i] = cr;
        colorG[i] = cg;
        colorB[i] = cb;
        if (totalLum > maxLum) maxLum = totalLum;
      }
    }

    if (maxLum < 1e-20) maxLum = 1;

    // ── Pass 2: Nebula-style layered compositing ──
    //
    // Instead of smooth density → pixel, use domain-warped FBM noise to
    // create cloud-like texture (same technique as Nebula.js).
    // The density model drives WHERE clouds form (arms, bulge) while the
    // noise creates HOW they look (bright knots, dark voids, filaments).
    //
    // Multiple noise layers are composited additively — each layer uses
    // a different noise seed and scale, creating depth and complexity.

    const canvas = document.createElement('canvas');
    canvas.width = RES;
    canvas.height = RES;
    const ctx = canvas.getContext('2d');

    // Start with black — transparent regions stay dark
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, RES, RES);

    const asinhDenom = Math.asinh(maxLum * stretch);

    // Number of cloud layers — more layers = richer texture, slower render
    const NUM_LAYERS = 5;

    for (let layer = 0; layer < NUM_LAYERS; layer++) {
      const imgData = ctx.createImageData(RES, RES);

      // Each layer gets a unique noise seed for variation
      const seedX = Math.sin(layer * 7.3 + 0.5) * 50 + 50;
      const seedZ = Math.cos(layer * 5.1 + 1.2) * 50 + 50;

      // Each layer has a slightly different noise scale for multi-scale texture
      const noiseScale = (1.5 + layer * 0.4) / Math.max(extent, 0.01);

      // Layer opacity — distribute evenly, sum to ~1
      const layerOpacity = 1.0 / NUM_LAYERS;

      for (let py = 0; py < RES; py++) {
        for (let px = 0; px < RES; px++) {
          const i = py * RES + px;
          const lum = lumGrid[i];
          const cr = colorR[i], cg = colorG[i], cb = colorB[i];

          const gx = centerX + (px / RES - 0.5) * extent * 2;
          const gz = centerZ - (py / RES - 0.5) * extent * 2;
          const R = Math.sqrt(gx * gx + gz * gz);

          // ── Tone-map the luminosity ──
          let brightness = Math.asinh(lum * stretch) / asinhDenom;
          brightness = Math.pow(Math.max(0, brightness), gamma);

          // ── Domain-warped FBM cloud shape (Nebula.js recipe) ──
          // This is what creates the textured, photographic look
          const npx = gx * noiseScale + seedX;
          const npy = gz * noiseScale + seedZ;

          // Domain warping: feed one FBM into another → organic swirls
          const q0 = _fbm(npx, npy, 5);
          const q1 = _fbm(npx + 5.2, npy + 1.3, 5);
          const warped = _fbm(npx + 3.5 * q0, npy + 3.5 * q1, 5);

          // Cloud shape: smoothstep threshold creates distinct bright/dark regions
          // Low threshold = more cloud coverage, high = more voids
          // Scale threshold by density — dense regions have more cloud, sparse have more void
          const densityNorm = Math.min(1, brightness * 3);
          const cloudThreshLow = 0.15 + (1 - densityNorm) * 0.25; // sparse = higher threshold = less cloud
          const cloudThreshHigh = cloudThreshLow + 0.35;
          let cloud = _smoothstep(cloudThreshLow, cloudThreshHigh, warped);

          // Core stays smooth and bright (no dark voids in the bulge)
          const coreBlend = R < 1 ? 1 : R < 3 ? 1 - (R - 1) / 2 : 0;
          cloud = cloud * (1 - coreBlend) + coreBlend;

          // ── Dust lane absorption ──
          if (dustStrength > 0 && R > 3) {
            const theta = Math.atan2(gz, gx);
            const dustStr = this._dustLane(R, theta);
            const dustNoise = _fbm(gx * 1.5 + 77, gz * 1.5 + 77);
            const dustAmt = dustStr * Math.max(0, (dustNoise - 0.25) / 0.35);
            cloud *= 1 - Math.min(dustAmt * dustStrength, 0.85);
          }

          // ── Final alpha: brightness × cloud shape × layer opacity ──
          const alpha = brightness * cloud * layerOpacity;
          if (alpha < 0.002) continue; // skip transparent pixels

          // Premultiplied alpha (additive compositing)
          const idx = i * 4;
          imgData.data[idx]     = Math.min(255, Math.round(cr * alpha * 255));
          imgData.data[idx + 1] = Math.min(255, Math.round(cg * alpha * 255));
          imgData.data[idx + 2] = Math.min(255, Math.round(cb * alpha * 255));
          imgData.data[idx + 3] = Math.round(Math.min(1, alpha) * 255);
        }
      }

      // Composite this layer additively onto the canvas
      const layerCanvas = document.createElement('canvas');
      layerCanvas.width = RES;
      layerCanvas.height = RES;
      const layerCtx = layerCanvas.getContext('2d');
      layerCtx.putImageData(imgData, 0, 0);

      // Use 'lighter' composite mode = additive blending (like THREE.AdditiveBlending)
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(layerCanvas, 0, 0);
    }

    ctx.globalCompositeOperation = 'source-over'; // reset
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
