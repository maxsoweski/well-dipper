import * as THREE from 'three';

/**
 * StarfieldLayer — background stars on a sky sphere.
 *
 * Refactored from Starfield.js with brightness budgeting:
 * star colors are scaled so the dimmest stars sit at brightnessRange.min
 * (above galaxy glow max) and the brightest at brightnessRange.max.
 *
 * Supports both galaxy-aware mode (from StarfieldGenerator) and
 * legacy random mode (fallback).
 *
 * During warp: vertex shader folds stars toward rift center,
 * fragment shader boosts brightness for accumulation glow.
 */
export class StarfieldLayer {
  /**
   * @param {number|object} countOrData — star count (legacy) or StarfieldGenerator data
   * @param {number} radius — sky sphere radius
   * @param {{ min: number, max: number }} brightnessRange — output brightness limits
   */
  constructor(countOrData, radius, brightnessRange) {
    this._brightnessRange = brightnessRange;
    this.radius = radius;

    if (typeof countOrData === 'object' && countOrData.positions) {
      this.count = countOrData.count;
      this.realStars = countOrData.realStars || [];
      this.mesh = this._buildMesh(countOrData.positions, countOrData.colors, countOrData.sizes);
    } else {
      this.count = countOrData;
      this.realStars = [];
      this.mesh = this._createRandom();
    }
  }

  _createRandom() {
    const positions = new Float32Array(this.count * 3);
    const colors = new Float32Array(this.count * 3);

    for (let i = 0; i < this.count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const i3 = i * 3;
      positions[i3]     = this.radius * Math.sin(phi) * Math.cos(theta);
      positions[i3 + 1] = this.radius * Math.sin(phi) * Math.sin(theta);
      positions[i3 + 2] = this.radius * Math.cos(phi);

      const colorRoll = Math.random();
      if (colorRoll < 0.05) {
        colors[i3] = 0.7; colors[i3 + 1] = 0.8; colors[i3 + 2] = 1.0;
      } else if (colorRoll < 0.10) {
        colors[i3] = 1.0; colors[i3 + 1] = 0.6; colors[i3 + 2] = 0.4;
      } else if (colorRoll < 0.15) {
        colors[i3] = 1.0; colors[i3 + 1] = 0.95; colors[i3 + 2] = 0.7;
      } else {
        const b = 0.6 + Math.random() * 0.4;
        colors[i3] = b; colors[i3 + 1] = b; colors[i3 + 2] = b;
      }
    }

    const sizes = new Float32Array(this.count);
    for (let i = 0; i < this.count; i++) {
      const roll = Math.random();
      if (roll < 0.005) sizes[i] = 8.0;
      else if (roll < 0.03) sizes[i] = 6.0;
      else sizes[i] = 4.0;
    }

    return this._buildMesh(positions, colors, sizes);
  }

  _buildMesh(positions, colors, sizes) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));

    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      vertexColors: true,

      uniforms: {
        uFoldAmount: { value: 0.0 },
        uBrightness: { value: 1.0 },
        uRiftCenter: { value: new THREE.Vector2(0.0, 0.0) },
        uBrightnessMin: { value: this._brightnessRange.min },
        uBrightnessMax: { value: this._brightnessRange.max },
      },

      vertexShader: /* glsl */ `
        attribute float aSize;
        uniform float uFoldAmount;
        uniform vec2 uRiftCenter;
        varying vec3 vColor;
        varying float vSize;
        varying float vConverge;

        void main() {
          vColor = color;
          vSize = aSize;
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPos;

          float convergeFactor = 1.0;

          if (uFoldAmount > 0.0) {
            vec2 ndc = gl_Position.xy / gl_Position.w;
            vec2 toCenter = ndc - uRiftCenter;
            float dist = length(toCenter);

            float pullStart = dist * 0.7;
            float pullEnd = pullStart + 0.35;
            float localFold = smoothstep(pullStart, pullEnd, uFoldAmount);

            vec2 folded = uRiftCenter + toCenter * (1.0 - localFold);
            gl_Position.xy = folded * gl_Position.w;

            convergeFactor = 1.0 + localFold * 3.0;
          }

          vConverge = convergeFactor;

          float baseSize = aSize > 5.0 ? aSize * 2.0 : aSize;
          gl_PointSize = baseSize * convergeFactor;
        }
      `,

      fragmentShader: /* glsl */ `
        uniform float uBrightness;
        uniform float uFoldAmount;
        uniform float uBrightnessMin;
        uniform float uBrightnessMax;
        varying vec3 vColor;
        varying float vSize;
        varying float vConverge;

        float bayerDither(vec2 coord) {
          vec2 p = mod(floor(coord), 4.0);
          float t = 0.0;
          if (p.y < 0.5) {
            t = (p.x < 0.5) ? 0.0 : (p.x < 1.5) ? 8.0 : (p.x < 2.5) ? 2.0 : 10.0;
          } else if (p.y < 1.5) {
            t = (p.x < 0.5) ? 12.0 : (p.x < 1.5) ? 4.0 : (p.x < 2.5) ? 14.0 : 6.0;
          } else if (p.y < 2.5) {
            t = (p.x < 0.5) ? 3.0 : (p.x < 1.5) ? 11.0 : (p.x < 2.5) ? 1.0 : 9.0;
          } else {
            t = (p.x < 0.5) ? 15.0 : (p.x < 1.5) ? 7.0 : (p.x < 2.5) ? 13.0 : 5.0;
          }
          return t / 16.0;
        }

        void main() {
          vec2 center = gl_PointCoord - 0.5;

          float dist;
          if (vSize < 5.0) {
            dist = length(center);
          } else {
            dist = pow(abs(center.x), 0.6) + pow(abs(center.y), 0.6);
          }

          float edge = vSize < 5.0
            ? smoothstep(0.3, 0.5, dist)
            : smoothstep(0.35, 0.55, dist);

          float threshold = bayerDither(floor(gl_FragCoord.xy / 3.0));
          float foldSmooth = clamp(uFoldAmount * 2.0, 0.0, 1.0);
          float cutoff = mix(threshold, 0.45, foldSmooth);
          if (edge > cutoff) discard;

          // ── Brightness-budgeted output ──
          // Scale vertex colors into [brightnessMin, brightnessMax] range.
          // This ensures stars always read brighter than galaxy glow beneath.
          vec3 col = vColor * uBrightness;
          float lum = max(0.001, dot(col, vec3(0.299, 0.587, 0.114)));
          // Remap: dim stars → brightnessMin, bright stars → brightnessMax
          float remapped = uBrightnessMin + clamp(lum, 0.0, 1.0) * (uBrightnessMax - uBrightnessMin);
          vec3 finalCol = col * (remapped / lum);

          gl_FragColor = vec4(min(finalCol, vec3(1.0)), 1.0);
        }
      `,
    });

    return new THREE.Points(geometry, material);
  }

  update(cameraPosition) {
    this.mesh.position.copy(cameraPosition);
  }

  setWarpUniforms(foldAmount, brightness, riftCenterNDC) {
    const u = this.mesh.material.uniforms;
    u.uFoldAmount.value = foldAmount;
    u.uBrightness.value = brightness;
    if (riftCenterNDC) {
      u.uRiftCenter.value.copy(riftCenterNDC);
    }
  }

  /**
   * Find the nearest starfield point to a given ray direction.
   * @param {THREE.Vector3} rayDirection — normalized world-space ray
   * @returns {{ direction: THREE.Vector3, index: number }|null}
   */
  findNearestStar(rayDirection) {
    const positions = this.mesh.geometry.attributes.position.array;
    const cosThreshold = Math.cos(3 * Math.PI / 180);
    let bestDot = cosThreshold;
    let bestDir = null;
    let bestIndex = -1;

    const _dir = new THREE.Vector3();
    for (let i = 0; i < this.count; i++) {
      const i3 = i * 3;
      _dir.set(positions[i3], positions[i3 + 1], positions[i3 + 2]).normalize();
      const dot = rayDirection.dot(_dir);
      if (dot > bestDot) {
        bestDot = dot;
        bestDir = _dir.clone();
        bestIndex = i;
      }
    }
    return bestDir ? { direction: bestDir, index: bestIndex } : null;
  }

  /**
   * Pick a random star visible in the forward hemisphere.
   * @param {THREE.Vector3} cameraForward — normalized camera forward direction
   * @returns {{ direction: THREE.Vector3, index: number }|null}
   */
  getRandomVisibleStar(cameraForward) {
    const positions = this.mesh.geometry.attributes.position.array;
    const candidates = [];
    const _dir = new THREE.Vector3();

    for (let i = 0; i < this.count; i++) {
      const i3 = i * 3;
      _dir.set(positions[i3], positions[i3 + 1], positions[i3 + 2]).normalize();
      if (cameraForward.dot(_dir) > 0.3) {
        candidates.push(i);
      }
    }
    if (candidates.length === 0) return null;

    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    const p = pick * 3;
    return {
      direction: new THREE.Vector3(positions[p], positions[p + 1], positions[p + 2]).normalize(),
      index: pick,
    };
  }

  /**
   * Check if a starfield index maps to a real GalacticMap star.
   * @param {number} index
   * @returns {object|null} starData, or null for background/feature stars
   */
  getGalaxyStarForIndex(index) {
    for (const entry of this.realStars) {
      if (entry.index === index) return entry.starData;
    }
    return null;
  }

  /**
   * Get the full starfield entry for an index — including feature data.
   * @param {number} index
   * @returns {{ starData?, isFeature?, featureType?, featureData? }|null}
   */
  getEntryForIndex(index) {
    for (const entry of this.realStars) {
      if (entry.index === index) return entry;
    }
    return null;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
