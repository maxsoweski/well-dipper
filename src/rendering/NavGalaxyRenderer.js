import * as THREE from 'three';
import { BAYER4 } from './shaders/common.glsl.js';

/**
 * NavGalaxyRenderer — GPU-accelerated top-down galaxy view for the nav computer.
 *
 * Uses the same density model as ProceduralGlowLayer (Miyamoto-Nagai disk,
 * spiral arms, bar/bulge, dust) but renders a top-down orthographic view
 * by integrating density vertically through the disk at each (x,z) pixel.
 *
 * Renders to an offscreen WebGLRenderTarget, then copies to a Canvas 2D
 * element that NavComputer can drawImage() into its own canvas.
 */
export class NavGalaxyRenderer {
  /**
   * @param {THREE.WebGLRenderer} renderer — shared Three.js renderer
   * @param {object} galacticMap — GalacticMap instance for arm data
   */
  constructor(renderer, galacticMap) {
    this._renderer = renderer;
    this._resolution = 512;

    // Extract arm data
    const arms = galacticMap.arms || [];
    const armOffsets = new Float32Array(8);
    const armWidths = new Float32Array(8);
    const armBoosts = new Float32Array(8);
    for (let i = 0; i < Math.min(arms.length, 8); i++) {
      armOffsets[i] = arms[i].offset;
      armWidths[i] = arms[i].width;
      armBoosts[i] = arms[i].densityBoost;
    }

    // Offscreen render target
    this._rt = new THREE.WebGLRenderTarget(this._resolution, this._resolution, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      type: THREE.UnsignedByteType,
    });

    // Fullscreen quad scene
    this._scene = new THREE.Scene();
    this._camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    this._material = new THREE.ShaderMaterial({
      uniforms: {
        uCenter: { value: new THREE.Vector2(0, 0) },    // center of view (kpc)
        uExtent: { value: 22.0 },                        // half-width of view (kpc)
        uArmOffsets: { value: armOffsets },
        uArmWidths: { value: armWidths },
        uArmBoosts: { value: armBoosts },
        uArmCount: { value: Math.min(arms.length, 8) },
        uPitchK: { value: 1.0 / Math.tan(12.0 * Math.PI / 180.0) },
        uBarAngle: { value: galacticMap.barAngle || (28.0 * Math.PI / 180.0) },
        uPlayerPos: { value: new THREE.Vector2(8, 0) },  // player marker position
      },

      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,

      fragmentShader: /* glsl */ `
        #define PI 3.14159265359
        #define GALAXY_R 15.0

        uniform vec2 uCenter;
        uniform float uExtent;
        uniform float uArmOffsets[8];
        uniform float uArmWidths[8];
        uniform float uArmBoosts[8];
        uniform int uArmCount;
        uniform float uPitchK;
        uniform float uBarAngle;
        uniform vec2 uPlayerPos;

        varying vec2 vUv;

        // ── Spiral arm strength (same model as ProceduralGlowLayer) ──
        float spiralArmStrength(float R, float theta) {
          if (R < 1.2) return 0.0;
          float bestStr = 0.0;
          float armFade = smoothstep(1.2, 2.5, R);
          float logR = log(max(R, 0.01));
          float sinPitch = sin(12.0 * PI / 180.0);

          for (int i = 0; i < 8; i++) {
            if (i >= uArmCount) break;
            float armTheta = uArmOffsets[i] + uPitchK * logR;
            float dTheta = mod(theta - armTheta + 3.0 * PI, 2.0 * PI) - PI;
            float perpDist = abs(dTheta) * R * sinPitch;
            float armW = uArmWidths[i] * (0.3 + 0.06 * R);
            float str = uArmBoosts[i] * exp(-0.5 * perpDist * perpDist / (armW * armW));
            if (i >= 2) str *= 0.4;
            str *= armFade;
            bestStr = max(bestStr, str);
          }
          return bestStr;
        }

        // ── Vertical density integration at (x, z) ──
        // Integrates stellar density through the disk height (Y axis)
        // to produce a surface brightness for the top-down view.
        float integratedDensity(float gx, float gz) {
          float R = sqrt(gx * gx + gz * gz);
          float theta = atan(gz, gx + 0.0001);

          // Disk truncation
          float trunc = smoothstep(GALAXY_R, GALAXY_R - 1.5, R);
          if (trunc < 0.001) return 0.0;

          // Thin disk (vertical Gaussian, sigma=80pc → integrate analytically)
          // Integral of exp(-z²/(2σ²)) dz from -∞ to ∞ = σ√(2π)
          // So surface brightness ∝ radial profile × σ × sqrt(2π)
          float thinRadial = exp(-R * R / (2.0 * 4.0 * 4.0));
          float thinSB = thinRadial * 0.08 * 2.507; // σ√(2π) ≈ 0.08 * 2.507

          // Spiral arm modulation
          float armStr = spiralArmStrength(R, theta);
          armStr = pow(max(armStr, 0.001), 0.7);
          float armMod = 0.5 + armStr * 2.0;

          // Galactic bar/bulge (triaxial Gaussian)
          float cosBar = cos(uBarAngle);
          float sinBar = sin(uBarAngle);
          float bx = gx * cosBar + gz * sinBar;
          float bz = -gx * sinBar + gz * cosBar;
          // Integrate bulge vertically: ∝ exp(-bx²/σx² - bz²/σz²) × σy√(2π)
          float bulgeXZ = exp(-0.5 * (bx * bx / (1.5 * 1.5) + bz * bz / (0.35 * 0.35)));
          float bulgeSB = 5.0 * bulgeXZ * 0.3 * 2.507; // σy=0.3 kpc

          return (thinSB * armMod + bulgeSB) * trunc;
        }

        // ── Dust lane density (top-down) ──
        float dustDensity(float gx, float gz) {
          float R = sqrt(gx * gx + gz * gz);
          float theta = atan(gz, gx + 0.0001);

          float dustR = exp(-R / 4.0);
          float armStr = spiralArmStrength(R, theta);
          float armDust = 0.5 + armStr * 3.0;
          float ring = exp(-0.5 * pow((R - 5.0) / 2.0, 2.0));
          float ringBoost = 1.0 + ring * 1.5;
          float trunc = smoothstep(13.0, 11.0, R);

          return dustR * armDust * ringBoost * trunc * 0.08; // thin dust disk
        }

        // ── Stellar population color (same as ProceduralGlowLayer) ──
        vec3 stellarColor(float R, float armStr) {
          float bulgeW = exp(-R * R / (2.0 * 1.2 * 1.2));
          float armW = clamp(armStr * 0.4, 0.0, 0.5);
          float diskW = max(0.0, 1.0 - bulgeW - armW);

          vec3 bulgeCol = vec3(1.0, 0.75, 0.40);
          vec3 armCol = vec3(0.85, 0.88, 1.0);
          vec3 diskCol = vec3(0.95, 0.93, 0.90);

          return bulgeCol * bulgeW + armCol * armW + diskCol * diskW;
        }

        // ── Bayer dithering (retro aesthetic) ──
        ${BAYER4}

        void main() {
          // Map UV to galactic coordinates
          // +Z = top of screen (matches nav computer's sector overlay convention)
          float gx = uCenter.x + (vUv.x - 0.5) * uExtent * 2.0;
          float gz = uCenter.y + (vUv.y - 0.5) * uExtent * 2.0;

          // Surface brightness from vertical integration
          float sb = integratedDensity(gx, gz);
          if (sb < 0.001) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }

          // Dust absorption
          float dust = dustDensity(gx, gz);
          sb *= exp(-dust * 3.0);

          // Color from stellar population
          float R = sqrt(gx * gx + gz * gz);
          float theta = atan(gz, gx + 0.0001);
          float armStr = spiralArmStrength(R, theta);
          vec3 color = stellarColor(R, armStr);

          // Tone mapping (asinh-like)
          float brightness = 1.0 - exp(-sb * 12.0);

          // Retro dithering
          vec2 ditherCoord = floor(gl_FragCoord.xy / 2.0);
          float dither = bayerDither(ditherCoord);
          float levels = 12.0;
          brightness = floor(brightness * levels + dither) / levels;

          gl_FragColor = vec4(color * brightness, 1.0);
        }
      `,
    });

    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this._material);
    this._scene.add(quad);

    // Output canvas for drawImage()
    this._outputCanvas = document.createElement('canvas');
    this._outputCanvas.width = this._resolution;
    this._outputCanvas.height = this._resolution;
    this._outputCtx = this._outputCanvas.getContext('2d');

    // Cache
    this._cache = new Map(); // key → { canvas, lastUsed }
    this._cacheMax = 8;
  }

  /**
   * Render the galaxy for a given view region.
   * Returns a Canvas element suitable for drawImage().
   *
   * @param {number} cx - center X (kpc)
   * @param {number} cz - center Z (kpc)
   * @param {number} extent - half-width (kpc)
   * @returns {HTMLCanvasElement}
   */
  render(cx, cz, extent) {
    // Quantize key to avoid re-rendering for tiny view shifts
    const qcx = Math.round(cx * 10) / 10;
    const qcz = Math.round(cz * 10) / 10;
    const qext = Math.round(extent * 100) / 100;
    const key = `${qcx},${qcz},${qext}`;

    if (this._cache.has(key)) {
      const entry = this._cache.get(key);
      entry.lastUsed = Date.now();
      return entry.canvas;
    }

    // Set uniforms
    const u = this._material.uniforms;
    u.uCenter.value.set(cx, cz);
    u.uExtent.value = extent;

    // Save renderer state and render to our target
    const prevRT = this._renderer.getRenderTarget();
    this._renderer.setRenderTarget(this._rt);
    this._renderer.render(this._scene, this._camera);
    this._renderer.setRenderTarget(prevRT);

    // Read pixels into our output canvas
    const pixels = new Uint8Array(this._resolution * this._resolution * 4);
    this._renderer.readRenderTargetPixels(this._rt, 0, 0, this._resolution, this._resolution, pixels);

    const imgData = this._outputCtx.createImageData(this._resolution, this._resolution);
    // WebGL pixels are bottom-up, Canvas is top-down — flip Y
    for (let y = 0; y < this._resolution; y++) {
      const srcRow = (this._resolution - 1 - y) * this._resolution * 4;
      const dstRow = y * this._resolution * 4;
      for (let x = 0; x < this._resolution * 4; x++) {
        imgData.data[dstRow + x] = pixels[srcRow + x];
      }
    }
    this._outputCtx.putImageData(imgData, 0, 0);

    // Cache a copy
    const cached = document.createElement('canvas');
    cached.width = this._resolution;
    cached.height = this._resolution;
    cached.getContext('2d').drawImage(this._outputCanvas, 0, 0);

    this._cache.set(key, { canvas: cached, lastUsed: Date.now() });

    // Evict oldest if over limit
    if (this._cache.size > this._cacheMax) {
      let oldest = null, oldestTime = Infinity;
      for (const [k, v] of this._cache) {
        if (v.lastUsed < oldestTime) { oldest = k; oldestTime = v.lastUsed; }
      }
      if (oldest) this._cache.delete(oldest);
    }

    return cached;
  }

  dispose() {
    this._rt.dispose();
    this._material.dispose();
  }
}
