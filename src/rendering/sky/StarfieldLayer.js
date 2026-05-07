import * as THREE from 'three';
import { assignName } from '../../util/scene-naming.js';

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
      assignName(this.mesh, { category: 'sky', kind: 'starfield', id: 'main' });
    } else {
      this.count = countOrData;
      this.realStars = [];
      this.mesh = this._createRandom();
      assignName(this.mesh, { category: 'sky', kind: 'starfield', id: 'main' });
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

        // ── Tunnel warp (angular-to-depth remap onto a cylinder) ──
        // uTunnelPhase = 0 bypasses all tunnel code — rendering is identical
        // to the pre-port StarfieldLayer. Only when phase > 0 does the
        // vertex shader remap stars onto the tunnel walls.
        uTunnelPhase:   { value: 0.0 },
        uTunnelScroll:  { value: 0.0 },
        uTunnelForward: { value: new THREE.Vector3(0.0, 0.0, -1.0) },
        uTunnelRadius:  { value: 300.0 },
        uTunnelLength:  { value: 2400.0 },

        // ── Split-tunnel crossover (for dual-layer origin/destination) ──
        // uClipSide 0: visible behind crossoverAlong  (origin layer)
        // uClipSide 1: visible ahead of crossoverAlong (destination layer)
        // uClipSide 2: visible between [crossoverAlong, crossoverAlongB] (bridge)
        // Setting uCrossoverAlong = +1e6 with uClipSide=0 → full starfield.
        uCrossoverAlong:  { value: 1.0e6 },
        uCrossoverAlongB: { value: 1.0e6 },
        uClipSide:        { value: 0 },

        // Per-layer tint multiplier — lets origin/destination render with
        // distinguishable colors while debugging the crossover.
        uTint: { value: new THREE.Vector3(1.0, 1.0, 1.0) },
      },

      vertexShader: /* glsl */ `
        attribute float aSize;
        uniform float uFoldAmount;
        uniform vec2 uRiftCenter;

        // Tunnel warp
        uniform float uTunnelPhase;
        uniform float uTunnelScroll;
        uniform vec3  uTunnelForward;
        uniform float uTunnelRadius;
        uniform float uTunnelLength;

        // Split-tunnel crossover
        uniform float uCrossoverAlong;
        uniform float uCrossoverAlongB;
        uniform int   uClipSide;

        varying vec3 vColor;
        varying float vSize;
        varying float vConverge;
        varying float vTunnelAmt;
        varying float vClipped;

        // Stable pseudo-random from vec3 — gives on-axis stars a deterministic
        // azimuth when their perp component vanishes.
        float starTunnelHash(vec3 p) {
          return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
        }

        void main() {
          vColor = color;
          vSize = aSize;
          vTunnelAmt = uTunnelPhase;
          vClipped = 0.0;

          // ── Tunnel warp (angular-to-depth remap) ──
          // At phase=0 this branch is skipped entirely and finalPos = position,
          // matching pre-port behavior byte-for-byte.
          vec3 finalPos = position;
          float scrolled = 0.0;

          if (uTunnelPhase > 0.0) {
            vec3 F = normalize(uTunnelForward);
            vec3 dir = normalize(position);
            float cosTheta = dot(dir, F);
            float theta = acos(clamp(cosTheta, -1.0, 1.0));

            vec3 perp = dir - cosTheta * F;
            float perpLen = length(perp);
            vec3 perpDir;
            if (perpLen > 0.001) {
              perpDir = perp / perpLen;
            } else {
              float h = starTunnelHash(position);
              float ang = h * 6.2831853;
              vec3 up = abs(F.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
              vec3 right = normalize(cross(F, up));
              vec3 fup = normalize(cross(right, F));
              perpDir = right * cos(ang) + fup * sin(ang);
            }

            float PI = 3.14159265;
            float L = uTunnelLength;
            float normalizedAngle = theta / PI;
            float tunnelZ = mix(L * 0.5, -L * 0.25, normalizedAngle);
            scrolled = tunnelZ - uTunnelScroll;
            scrolled = mod(scrolled + L * 0.5, L) - L * 0.5;

            // Crossover clip — soft fade of stars across the boundary plane.
            float tw = 200.0;
            if (uClipSide == 0) {
              vClipped = smoothstep(-tw, tw, scrolled - uCrossoverAlong);
            } else if (uClipSide == 1) {
              vClipped = 1.0 - smoothstep(-tw, tw, scrolled - uCrossoverAlong);
            } else {
              float clipA = smoothstep(-tw, tw, uCrossoverAlong - scrolled);
              float clipB = smoothstep(-tw, tw, scrolled - uCrossoverAlongB);
              vClipped = max(clipA, clipB);
            }

            // Perspective taper — distant stars shrink toward vanishing point.
            float taperStart = L * 0.15;
            float taperEnd   = L * 0.45;
            float ahead = max(scrolled, 0.0);
            float taper = 1.0 - smoothstep(taperStart, taperEnd, ahead) * 0.95;
            float warpedR = uTunnelRadius * taper;

            vec3 tunnelPos = perpDir * warpedR + F * scrolled;
            finalPos = mix(position, tunnelPos, uTunnelPhase);
          }

          vec4 mvPos = modelViewMatrix * vec4(finalPos, 1.0);
          gl_Position = projectionMatrix * mvPos;

          // ── Legacy fold (NDC-space pull toward rift center) ──
          // Dormant during warp because WarpEffect sets foldAmount=0.
          // Kept for any non-warp caller that still passes a non-zero amount.
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
          float depthScale = 1.0;
          if (uTunnelPhase > 0.0) {
            float depthNorm = clamp(scrolled / (uTunnelLength * 0.5), 0.0, 1.0);
            depthScale = mix(1.8, 0.12, depthNorm * depthNorm);
          }
          gl_PointSize = baseSize * convergeFactor * (1.0 + uTunnelPhase * 0.3) * depthScale;
        }
      `,

      fragmentShader: /* glsl */ `
        uniform float uBrightness;
        uniform float uFoldAmount;
        uniform float uBrightnessMin;
        uniform float uBrightnessMax;
        uniform vec3  uTint;
        varying vec3 vColor;
        varying float vSize;
        varying float vConverge;
        varying float vTunnelAmt;
        varying float vClipped;

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
          // Crossover clip: discard fully clipped stars before any work.
          if (vClipped >= 0.99) discard;

          vec2 center = gl_PointCoord - 0.5;
          float dist = length(center);

          // Circular shape with soft glow falloff.
          // Bright core → soft edge. Reads as a point of light.
          float coreBright = 1.0 - smoothstep(0.0, 0.2, dist);   // bright center
          float glow = 1.0 - smoothstep(0.1, 0.5, dist);          // soft halo
          float shape = coreBright * 0.6 + glow * 0.4;

          // Dithered edge (retro feel)
          float threshold = bayerDither(floor(gl_FragCoord.xy / 3.0));
          float foldSmooth = clamp(uFoldAmount * 2.0, 0.0, 1.0);
          float cutoff = mix(threshold, 0.45, foldSmooth);
          if (shape < cutoff * 0.5) discard;

          // ── Direct brightness from vertex color ──
          // At rest (uTint=1, vTunnelAmt=0, vClipped=0) this collapses to the
          // pre-port expression: vColor * uBrightness * shape.
          vec3 col = vColor * uTint * uBrightness * shape * (1.0 + vTunnelAmt * 0.3);
          col *= (1.0 - vClipped);

          gl_FragColor = vec4(min(col, vec3(1.0)), 1.0);
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

  // ── Tunnel deformation (driven by warp loop during HYPER) ──
  setTunnelPhase(v)   { this.mesh.material.uniforms.uTunnelPhase.value = v; }
  setTunnelScroll(v)  { this.mesh.material.uniforms.uTunnelScroll.value = v; }
  setTunnelForward(vec3) {
    this.mesh.material.uniforms.uTunnelForward.value.copy(vec3);
  }
  setTunnelRadius(v)  { this.mesh.material.uniforms.uTunnelRadius.value = v; }
  setTunnelLength(v)  { this.mesh.material.uniforms.uTunnelLength.value = v; }

  // ── Split-tunnel crossover (origin/destination dual-layer transition) ──
  /** 0 = visible behind crossoverAlong (origin layer)
   *  1 = visible ahead of crossoverAlong (destination layer)
   *  2 = visible between crossoverAlong and crossoverAlongB (bridge layer) */
  setClipSide(side)        { this.mesh.material.uniforms.uClipSide.value = side; }
  setCrossoverAlong(v)     { this.mesh.material.uniforms.uCrossoverAlong.value = v; }
  setCrossoverAlongB(v)    { this.mesh.material.uniforms.uCrossoverAlongB.value = v; }
  /** Per-layer color tint — leave (1,1,1) unless debugging the crossover. */
  setTint(r, g, b)         { this.mesh.material.uniforms.uTint.value.set(r, g, b); }

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
