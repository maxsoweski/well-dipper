/**
 * GalaxyVolumeRenderer — pure JS galaxy ray-marcher.
 *
 * Renders the galaxy's diffuse glow by ray-marching through the density
 * model defined in GalacticMap.js. No Three.js dependency — works in both
 * Node.js (offline texture generation) and browser (future nav computer).
 *
 * This is a DISPLAY tool, not a source of truth. All density math must
 * match GalacticMap exactly — same potential model constants, same arm
 * definitions, same normalization.
 *
 * Multi-purpose:
 *   renderPanorama()    — equirectangular sky panorama (offline glow textures)
 *   renderProjection()  — arbitrary camera projection (future nav/cinematic)
 */
export class GalaxyVolumeRenderer {

  /**
   * @param {object} galacticMap — GalacticMap instance (source of truth)
   */
  constructor(galacticMap) {
    this._gm = galacticMap;

    // Cache arm data for tight inner loops
    this._arms = galacticMap.arms;
    this._pitchK = galacticMap.pitchK;
    this._pitchAngle = galacticMap.pitchAngle;
    this._sinPitch = Math.sin(galacticMap.pitchAngle);
    this._densityNorm = galacticMap._potentialDensityNorm;

    // Potential model constants (from GalacticMap statics)
    const GM = galacticMap.constructor;
    this._MN_A = GM.MN_A;
    this._MN_B = GM.MN_B;
    this._MN_GM = GM.MN_GM;
    this._HERNQUIST_A = GM.HERNQUIST_A;
    this._HERNQUIST_GM = GM.HERNQUIST_GM;
    this._NFW_RS = GM.NFW_RS;
    this._NFW_NORM = GM.NFW_NORM;

    // 4x4 Bayer matrix (flat array, 16 entries, normalized to [0,1))
    this._bayer = [
       0/16,  8/16,  2/16, 10/16,
      12/16,  4/16, 14/16,  6/16,
       3/16, 11/16,  1/16,  9/16,
      15/16,  7/16, 13/16,  5/16,
    ];
  }

  // ════════════════════════════════════════════════════════════
  // PUBLIC API
  // ════════════════════════════════════════════════════════════

  /**
   * Render an equirectangular panorama from a viewpoint.
   *
   * @param {{ x: number, y: number, z: number }} viewPos — galactic position in kpc
   * @param {number} width — texture width in pixels
   * @param {number} height — texture height in pixels
   * @param {object} [options]
   * @param {number} [options.samples=64] — ray-march samples per ray
   * @param {number} [options.maxDist=20] — max ray distance in kpc
   * @param {boolean} [options.retroEffects=true] — apply posterize + Bayer dither
   * @param {number} [options.chunkyScale=3] — retro pixel block size
   * @returns {Uint8ClampedArray} RGBA pixel data (width * height * 4)
   */
  renderPanorama(viewPos, width, height, options = {}) {
    const samples = options.samples ?? 64;
    const maxDist = options.maxDist ?? 20;
    const retroEffects = options.retroEffects !== false;
    const chunkyScale = options.chunkyScale ?? 3;

    // Global reference density — all panoramas normalize against the same
    // value so galactic center is bright and outer rim is dim (physically correct).
    const refDensity = this._computeReferenceDensity(samples, maxDist);

    // First pass: ray-march every pixel, apply Reinhard tone mapping
    const rawData = new Array(width * height);

    for (let py = 0; py < height; py++) {
      for (let px = 0; px < width; px++) {
        const u = (px + 0.5) / width;
        const v = (py + 0.5) / height;

        const theta = (u - 0.5) * 2 * Math.PI;
        const phi = (v - 0.5) * Math.PI;

        const cosPhi = Math.cos(phi);
        const dir = {
          x: Math.cos(theta) * cosPhi,
          y: -Math.sin(phi),
          z: Math.sin(theta) * cosPhi,
        };

        const result = this._rayMarch(viewPos, dir, samples, maxDist);
        const rgb = this._colorMap(result);

        // Reinhard tone mapping with global reference.
        // The thin disk envelope + high arm contrast handle the shape;
        // the tone mapper just needs to preserve the dynamic range.
        const L = result.density / refDensity;
        const mapped = L / (1 + L);

        // Gamma: preserve arm/inter-arm contrast
        const lifted = Math.pow(mapped, 0.9);


        rawData[py * width + px] = { brightness: lifted, rgb };
      }
    }

    const pixels = new Uint8ClampedArray(width * height * 4);

    for (let py = 0; py < height; py++) {
      for (let px = 0; px < width; px++) {
        const { brightness, rgb } = rawData[py * width + px];

        let r = rgb[0] * brightness;
        let g = rgb[1] * brightness;
        let b = rgb[2] * brightness;

        if (retroEffects) {
          // Posterize to N bands
          const bands = 12;
          r = Math.floor(r * bands + 0.5) / bands;
          g = Math.floor(g * bands + 0.5) / bands;
          b = Math.floor(b * bands + 0.5) / bands;

          // Bayer dither at chunky scale — creates retro stipple pattern.
          // Pixels below the dither threshold are discarded (black/transparent).
          const cx = Math.floor(px / chunkyScale) % 4;
          const cy = Math.floor(py / chunkyScale) % 4;
          const threshold = this._bayer[cy * 4 + cx];

          const lum = (r + g + b) / 3;
          // Softer dither: only cull very dim pixels. The 0.08 factor means
          // even moderate brightness survives all Bayer thresholds.
          if (lum < threshold * 0.08) {
            r = 0; g = 0; b = 0;
          }
        }

        const idx = (py * width + px) * 4;
        pixels[idx]     = Math.round(r * 255);
        pixels[idx + 1] = Math.round(g * 255);
        pixels[idx + 2] = Math.round(b * 255);
        pixels[idx + 3] = (r > 0 || g > 0 || b > 0) ? 255 : 0;
      }
    }

    return pixels;
  }

  /**
   * Render an arbitrary camera projection (future: nav computer, cinematics).
   * Placeholder — will be implemented when nav computer is built.
   */
  renderProjection(viewPos, viewDir, fov, width, height, options = {}) {
    // TODO: implement for nav computer
    throw new Error('renderProjection not yet implemented');
  }

  // ════════════════════════════════════════════════════════════
  // DENSITY MODEL — must match GalacticMap.js exactly
  // ════════════════════════════════════════════════════════════

  /**
   * Miyamoto-Nagai + Hernquist + NFW density at (R, z).
   * Replicates GalacticMap.potentialDerivedDensity().
   */
  /**
   * Luminous density at (R, z) — disk + bulge only.
   * NFW halo is dark matter (doesn't emit light) so it's excluded
   * from the visual glow rendering.
   */
  _density(R, z) {
    const a = this._MN_A;
    const b = this._MN_B;
    const GM = this._MN_GM;

    // Miyamoto-Nagai disk — gravitational profile
    const zb = Math.sqrt(z * z + b * b);
    const azb = a + zb;
    const Rsq = R * R;
    const denom1 = Math.pow(Rsq + azb * azb, 2.5);
    const denom2 = Math.pow(z * z + b * b, 1.5);
    const diskDensity = (b * b * GM / (4 * Math.PI))
      * (a * Rsq + (a + 3 * zb) * azb * azb)
      / (denom1 * denom2);

    // Sharp vertical envelope for LUMINOUS emission.
    // The MN profile has fat z^-3 tails (all mass, including dark matter
    // in the disk). Real stellar light is concentrated in a much thinner
    // layer. This Gaussian envelope confines visible glow to ~0.3 kpc
    // scale height, so the galaxy looks like a flat disk from above
    // instead of a puffy cloud.
    const diskScaleHeight = 0.4; // kpc — thin stellar disk
    const zEnvelope = Math.exp(-0.5 * (z / diskScaleHeight) ** 2);
    const luminousDisk = diskDensity * zEnvelope;

    // Hernquist bulge — naturally concentrated, no extra envelope needed
    const r = Math.sqrt(Rsq + z * z);
    const rSafe = Math.max(r, 0.01);
    const bulgeDensity = this._HERNQUIST_GM * this._HERNQUIST_A
      / (2 * Math.PI * rSafe * Math.pow(rSafe + this._HERNQUIST_A, 3));

    // No NFW halo — dark matter doesn't glow
    return (luminousDisk + bulgeDensity) * this._densityNorm;
  }

  /**
   * Spiral arm strength at (R, theta).
   * Replicates GalacticMap.spiralArmStrength().
   */
  _armStrength(R, theta) {
    if (R < 0.5) return 0;

    let maxStr = 0;
    for (const arm of this._arms) {
      const expectedTheta = arm.offset + this._pitchK * Math.log(R / 4.0);
      let dTheta = ((theta - expectedTheta) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
      const dist = Math.abs(dTheta) * R * this._sinPitch;
      const gaussStr = Math.exp(-0.5 * (dist / arm.width) ** 2);
      const str = gaussStr * (arm.densityBoost / 2.5);
      if (str > maxStr) maxStr = str;
    }
    return maxStr;
  }

  /**
   * Smooth sin-based noise for dust lanes (no hash grid artifacts).
   */
  _dustNoise(R, theta) {
    const p0 = R * 2.0 + theta * 0.5;
    const p1 = theta * 3.0 + R;
    let n = Math.sin(p0 * 1.7 + p1 * 2.3) * 0.5
          + Math.sin(p0 * 3.1 - p1 * 1.9) * 0.25
          + Math.sin(p0 * 5.7 + p1 * 4.3 + 1.7) * 0.125
          + Math.sin(p0 * 11.3 - p1 * 8.7 + 3.1) * 0.0625;
    return n * 0.5 + 0.5;
  }

  // ════════════════════════════════════════════════════════════
  // RAY-MARCHING
  // ════════════════════════════════════════════════════════════

  /**
   * March a ray from origin along direction, integrating galaxy density.
   *
   * @returns {{ density, avgR, avgArmStr, bulgeWeight, dustTransmission }}
   */
  _rayMarch(origin, dir, samples, maxDist) {
    let totalDensity = 0;
    let weightedR = 0;
    let weightedArmStr = 0;
    let weightedBulgeW = 0;
    let totalWeight = 0;
    let totalDust = 0;

    // Start march at 0.3 kpc — close enough to capture the dense midplane
    // material that gives the Milky Way band its cohesive shape, while still
    // avoiding the immediate local neighborhood (which would fog everything).
    const tMin = 0.3;

    for (let i = 0; i < samples; i++) {
      // Linearly spaced with mild exponential bias toward far end
      const frac = i / (samples - 1);
      const t = tMin + (maxDist - tMin) * (frac * 0.7 + frac * frac * 0.3);
      const dt = (maxDist - tMin) / samples; // step length for volume integration

      const sx = origin.x + dir.x * t;
      const sy = origin.y + dir.y * t;
      const sz = origin.z + dir.z * t;

      const R = Math.sqrt(sx * sx + sz * sz);
      const z = sy;

      // Skip samples outside the galaxy
      if (R > 20 || Math.abs(z) > 10) continue;

      const density = this._density(R, z);
      const theta = Math.atan2(sz, sx);
      const armStr = this._armStrength(R, theta);

      // Arm modulation: high contrast so arms are distinct structures.
      // Inter-arm regions are dim (0.1), arm centers are bright (1.0+).
      // Inside the bulge (R < 2), arms fade out (isotropic center).
      const bulgeBlend = Math.max(0, Math.min(1, (R - 0.5) / 1.5));
      const interArmFloor = 0.1;
      const armFactor = (interArmFloor + armStr * (1.0 - interArmFloor + 2.0)) * bulgeBlend
                       + (1.0 - bulgeBlend);

      // Emission model: density × step_length (no distance weighting)
      const emission = density * armFactor * dt;
      totalDensity += emission;
      weightedR += R * emission;
      weightedArmStr += armStr * emission;
      totalWeight += emission;

      // Bulge weight for color mapping
      const bw = R < 3 ? Math.max(0, 1 - R / 3) : 0;
      weightedBulgeW += bw * emission;

      // Dust lanes — concentrated in thin disk, near arm edges
      if (Math.abs(z) < 0.5 && R > 1.5 && R < 14) {
        const dustN = this._dustNoise(R, theta);
        const armEdge = armStr * (1 - armStr) * 4;
        const zFade = Math.exp(-Math.abs(z) / 0.15);
        const rFade = this._smoothstep(1.5, 3.0, R) * (1 - this._smoothstep(10, 14, R));
        totalDust += (0.3 + armEdge * 0.7) * dustN * zFade * rFade * dt;
      }
    }

    // Beer-Lambert dust absorption — gentle enough that dust creates
    // subtle dark lanes without splitting the band into two halves.
    const dustTransmission = Math.exp(-totalDust * 0.5);
    totalDensity *= dustTransmission;

    const avgR = totalWeight > 0.001 ? weightedR / totalWeight : 8;
    const avgArmStr = totalWeight > 0.001 ? weightedArmStr / totalWeight : 0;
    const bulgeWeight = totalWeight > 0.001 ? weightedBulgeW / totalWeight : 0;

    return { density: totalDensity, avgR, avgArmStr, bulgeWeight, dustTransmission };
  }

  // ════════════════════════════════════════════════════════════
  // COLOR MAPPING
  // ════════════════════════════════════════════════════════════

  /**
   * Map ray-march result to RGB color [0-1].
   */
  _colorMap(result) {
    const { avgR, avgArmStr, bulgeWeight } = result;

    // Colors inspired by real Milky Way photography
    const bulgeColor = [1.00, 0.85, 0.50];   // warm gold (bright!)
    const diskColor  = [0.85, 0.80, 0.72];   // warm white
    const armColor   = [0.70, 0.80, 1.00];   // blue-white star-forming regions
    const coreColor  = [0.95, 0.92, 0.85];   // bright white arm cores

    // Start with disk
    let r = diskColor[0], g = diskColor[1], b = diskColor[2];

    // Mix toward bulge
    r = this._lerp(r, bulgeColor[0], bulgeWeight);
    g = this._lerp(g, bulgeColor[1], bulgeWeight);
    b = this._lerp(b, bulgeColor[2], bulgeWeight);

    // Mix toward arm color
    const armBlend = avgArmStr * this._smoothstep(1.5, 4.0, avgR);
    r = this._lerp(r, armColor[0], armBlend * 0.5);
    g = this._lerp(g, armColor[1], armBlend * 0.5);
    b = this._lerp(b, armColor[2], armBlend * 0.5);

    // Arm core brightness
    const coreW = Math.pow(avgArmStr, 3) * this._smoothstep(1.5, 3.0, avgR) * 0.4;
    r = this._lerp(r, coreColor[0], coreW);
    g = this._lerp(g, coreColor[1], coreW);
    b = this._lerp(b, coreColor[2], coreW);

    return [r, g, b];
  }

  // ════════════════════════════════════════════════════════════
  // MATH UTILITIES
  // ════════════════════════════════════════════════════════════

  /**
   * Compute the reference density for normalization.
   * Ray-march from the galactic center along the disk plane — this is
   * roughly the brightest sightline in the galaxy. All panoramas
   * normalize against this value so they share a consistent brightness scale.
   */
  _computeReferenceDensity(samples, maxDist) {
    if (this._cachedRefDensity) return this._cachedRefDensity;
    // Reference: looking from solar neighborhood TANGENT to the disk
    // (90° from center). This is a moderate-brightness sightline —
    // the ray travels through disk material but doesn't hit the bulge.
    // Brighter sightlines (toward center) will clip to white, which is
    // correct — the bulge IS dazzlingly bright from the outer disk.
    const origin = { x: 8.0, y: 0, z: 0 };
    const dir = { x: 0, y: 0, z: 1 }; // tangent to disk, perpendicular to center
    const result = this._rayMarch(origin, dir, samples, maxDist);
    this._cachedRefDensity = result.density;
    return this._cachedRefDensity;
  }

  _smoothstep(edge0, edge1, x) {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
  }

  _lerp(a, b, t) {
    return a + (b - a) * t;
  }
}
