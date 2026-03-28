import * as THREE from 'three';

/**
 * LODColorExtractor — derives LOD1 procedural shader parameters from LOD2 textures.
 *
 * Why this exists:
 *   When a body has NASA textures at LOD2, the procedural shader at LOD1 should
 *   approximate the same look — so zooming in/out doesn't produce a jarring color pop.
 *   This utility samples the diffuse texture to extract dominant colors and derives
 *   noise parameters from the heightmap's frequency content.
 *
 * How it works:
 *   1. Loads the diffuse texture into a tiny offscreen canvas (32x16)
 *   2. Samples all pixels to build a brightness histogram
 *   3. Splits into "dark" and "light" populations → accentColor and baseColor
 *   4. Optionally samples heightmap for noise frequency estimation
 *
 * For procedural bodies (no textures), this is never called — the procedural
 * params ARE the source of truth, and LOD2 would be generated FROM them (future).
 *
 * Usage:
 *   const params = await LODColorExtractor.extract(profile);
 *   // params = { baseColor: [r,g,b], accentColor: [r,g,b], noiseScale: number }
 */

const SAMPLE_WIDTH = 32;
const SAMPLE_HEIGHT = 16;

export class LODColorExtractor {

  /**
   * Extract LOD1 shader parameters from a body profile's textures.
   * Returns a promise that resolves to { baseColor, accentColor, noiseScale }.
   *
   * @param {object} profile — from KnownBodyProfiles (must have textures.diffuse)
   * @returns {Promise<{baseColor: number[], accentColor: number[], noiseScale: number}>}
   */
  static async extract(profile) {
    if (!profile?.textures?.diffuse) {
      return null;
    }

    const diffusePixels = await LODColorExtractor._loadToCanvas(profile.textures.diffuse);
    const colors = LODColorExtractor._extractDominantColors(diffusePixels);

    let noiseScale = 4.0; // default
    if (profile.textures.heightmap) {
      const heightPixels = await LODColorExtractor._loadToCanvas(profile.textures.heightmap);
      noiseScale = LODColorExtractor._estimateNoiseScale(heightPixels);
    }

    return {
      baseColor: colors.baseColor,
      accentColor: colors.accentColor,
      noiseScale,
    };
  }

  /**
   * Synchronous version using pre-computed values from the profile.
   * If the profile has `lod1Overrides`, returns those directly.
   * This avoids async texture loading — the values were computed offline
   * (or during a previous session) and baked into the profile.
   *
   * @param {object} profile
   * @returns {object|null} { baseColor, accentColor, noiseScale } or null
   */
  static getPrecomputed(profile) {
    return profile?.lod1Overrides || null;
  }

  /**
   * Load an image URL into an offscreen canvas and return pixel data.
   * @private
   */
  static _loadToCanvas(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = SAMPLE_WIDTH;
        canvas.height = SAMPLE_HEIGHT;
        const ctx = canvas.getContext('2d');
        // Draw scaled down — browser does the filtering for us
        ctx.drawImage(img, 0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT);
        const imageData = ctx.getImageData(0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT);
        resolve(imageData.data); // Uint8ClampedArray [r,g,b,a, r,g,b,a, ...]
      };
      img.onerror = () => reject(new Error(`Failed to load texture: ${url}`));
      img.src = url;
    });
  }

  /**
   * Analyze pixel data to find two dominant color clusters.
   *
   * Strategy: split pixels by brightness into "dark" and "light" groups.
   * For moon-like bodies, this separates maria (dark basaltic plains)
   * from highlands (bright anorthosite). Average each group.
   *
   * The "baseColor" (highlands/light) goes to the procedural shader's baseColor,
   * and "accentColor" (maria/dark) goes to accentColor — matching Moon.js's
   * convention where rocky moons mix between accent (dark maria) and base
   * (bright highlands) using noise.
   *
   * @private
   * @param {Uint8ClampedArray} pixels
   * @returns {{ baseColor: number[], accentColor: number[] }}
   */
  static _extractDominantColors(pixels) {
    const pixelCount = pixels.length / 4;

    // Collect brightness + color for each pixel
    const entries = [];
    for (let i = 0; i < pixelCount; i++) {
      const r = pixels[i * 4] / 255;
      const g = pixels[i * 4 + 1] / 255;
      const b = pixels[i * 4 + 2] / 255;
      // Perceptual brightness (ITU-R BT.709)
      const brightness = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      entries.push({ r, g, b, brightness });
    }

    // Sort by brightness to find median
    entries.sort((a, b) => a.brightness - b.brightness);
    const median = entries[Math.floor(pixelCount / 2)].brightness;

    // Split into dark and light clusters
    let darkR = 0, darkG = 0, darkB = 0, darkCount = 0;
    let lightR = 0, lightG = 0, lightB = 0, lightCount = 0;

    for (const e of entries) {
      if (e.brightness <= median) {
        darkR += e.r; darkG += e.g; darkB += e.b;
        darkCount++;
      } else {
        lightR += e.r; lightG += e.g; lightB += e.b;
        lightCount++;
      }
    }

    // Average each cluster
    const baseColor = lightCount > 0
      ? [lightR / lightCount, lightG / lightCount, lightB / lightCount]
      : [0.6, 0.58, 0.55]; // fallback

    const accentColor = darkCount > 0
      ? [darkR / darkCount, darkG / darkCount, darkB / darkCount]
      : [0.45, 0.43, 0.40]; // fallback

    return { baseColor, accentColor };
  }

  /**
   * Estimate a noiseScale value from heightmap frequency content.
   *
   * Strategy: compute average absolute difference between neighboring pixels.
   * High-frequency heightmaps (lots of small craters) → higher noiseScale.
   * Low-frequency (smooth terrain) → lower noiseScale.
   *
   * The output is mapped to a reasonable range for Moon.js's simplex noise.
   *
   * @private
   * @param {Uint8ClampedArray} pixels
   * @returns {number} noiseScale (typically 2.0 - 8.0)
   */
  static _estimateNoiseScale(pixels) {
    let totalDiff = 0;
    let comparisons = 0;

    for (let y = 0; y < SAMPLE_HEIGHT; y++) {
      for (let x = 0; x < SAMPLE_WIDTH - 1; x++) {
        const idx = (y * SAMPLE_WIDTH + x) * 4;
        const nextIdx = (y * SAMPLE_WIDTH + x + 1) * 4;
        const h1 = pixels[idx] / 255;
        const h2 = pixels[nextIdx] / 255;
        totalDiff += Math.abs(h2 - h1);
        comparisons++;
      }
    }

    // Also sample vertical neighbors
    for (let y = 0; y < SAMPLE_HEIGHT - 1; y++) {
      for (let x = 0; x < SAMPLE_WIDTH; x++) {
        const idx = (y * SAMPLE_WIDTH + x) * 4;
        const belowIdx = ((y + 1) * SAMPLE_WIDTH + x) * 4;
        const h1 = pixels[idx] / 255;
        const h2 = pixels[belowIdx] / 255;
        totalDiff += Math.abs(h2 - h1);
        comparisons++;
      }
    }

    const avgDiff = totalDiff / comparisons;

    // Map average difference to noiseScale range:
    // Low frequency (avgDiff ~0.02) → noiseScale 2.5
    // High frequency (avgDiff ~0.15) → noiseScale 8.0
    // Moon typically falls around 0.05-0.08 → noiseScale 3.5-5.0
    const noiseScale = 2.5 + (avgDiff / 0.15) * 5.5;
    return Math.max(2.5, Math.min(8.0, noiseScale));
  }
}
