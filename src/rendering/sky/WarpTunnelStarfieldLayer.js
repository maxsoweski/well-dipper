import * as THREE from 'three';
import { assignName } from '../../util/scene-naming.js';
import { SKY_PIXEL_SCALE } from '../skyPixelScale.js';   // ⭐ stars keep a constant SCREEN size as the sky's grid coarsens; see that file for why the first low-res sky read as 3x-bigger stars.

/**
 * WarpTunnelStarfieldLayer — experimental variant of StarfieldLayer.
 *
 * EXPERIMENTAL. Used only by tunnel-lab.html. Not wired into the game.
 *
 * Same rendering idea as StarfieldLayer, but the vertex shader applies a
 * 3D coordinate warp BEFORE projection, bending the star distribution
 * into a cylindrical tunnel along a specified forward axis. The same
 * stars you would see normally end up arranged on the tunnel walls;
 * no procedural "tunnel stars" — the existing starfield is bent.
 *
 * Uniforms:
 *   uTunnelPhase   — 0 = identity (normal sky sphere) ... 1 = fully tunneled
 *   uTunnelScroll  — accumulated scroll distance along the tunnel axis
 *                    (stars stream past as this increases — HYPER motion)
 *   uTunnelForward — vec3, the axis the tunnel aligns to (camera forward,
 *                    fixed at warp start)
 *   uTunnelRadius  — cylinder radius (world units)
 *   uTunnelLength  — total length for scroll wrapping (world units)
 *
 * Phase shape for a typical 4-phase warp sequence:
 *   FOLD:  uTunnelPhase 0→1, uTunnelScroll 0 (stars converge into tunnel)
 *   ENTER: uTunnelPhase 1, uTunnelScroll ramps up from 0
 *   HYPER: uTunnelPhase 1, uTunnelScroll advances at constant rate
 *   EXIT:  uTunnelPhase 1→0, uTunnelScroll decays (tunnel opens back up
 *          into new system's star positions, which are loaded into the
 *          buffer between HYPER and EXIT)
 */
export class WarpTunnelStarfieldLayer {
  constructor(countOrData, radius, brightnessRange, seed) {
    this._brightnessRange = brightnessRange;
    this.radius = radius;

    if (typeof countOrData === 'object' && countOrData.positions) {
      this.count = countOrData.count;
      this.realStars = countOrData.realStars || [];
      this.mesh = this._buildMesh(countOrData.positions, countOrData.colors, countOrData.sizes);
      assignName(this.mesh, { category: 'sky', kind: 'starfield', id: 'warp-tunnel' });
    } else {
      this.count = typeof countOrData === 'number' ? countOrData : countOrData.count;
      this.realStars = [];
      this._seed = seed || (typeof countOrData === 'object' && countOrData.seed) ? countOrData.seed : null;
      this.mesh = this._createRandom(this._seed);
      assignName(this.mesh, { category: 'sky', kind: 'starfield', id: 'warp-tunnel' });
    }
  }

  /**
   * Generate a random starfield. Accepts an optional seed string —
   * different seeds produce visually distinct star distributions
   * (different positions, different color mixes, different densities).
   * @param {string} [seed] — if provided, uses a seeded PRNG
   */
  _createRandom(seed) {
    // Simple seeded PRNG (mulberry32) so different seeds give
    // deterministic, visually distinct starfields.
    let rngState = 0;
    if (seed) {
      for (let i = 0; i < seed.length; i++) {
        rngState = ((rngState * 31) + seed.charCodeAt(i)) | 0;
      }
    }
    const rng = () => {
      if (!seed) return Math.random();
      rngState |= 0; rngState = rngState + 0x6D2B79F5 | 0;
      let t = Math.imul(rngState ^ rngState >>> 15, 1 | rngState);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };

    const positions = new Float32Array(this.count * 3);
    const colors = new Float32Array(this.count * 3);
    const sizes = new Float32Array(this.count);

    // Per-seed color palette bias so different starfields look distinct
    const paletteShift = seed ? rng() : 0;
    const warmBias = paletteShift > 0.5 ? 0.3 : 0;
    const coolBias = paletteShift <= 0.5 ? 0.3 : 0;

    for (let i = 0; i < this.count; i++) {
      const theta = rng() * Math.PI * 2;
      const phi = Math.acos(2 * rng() - 1);
      const i3 = i * 3;
      positions[i3]     = this.radius * Math.sin(phi) * Math.cos(theta);
      positions[i3 + 1] = this.radius * Math.sin(phi) * Math.sin(theta);
      positions[i3 + 2] = this.radius * Math.cos(phi);

      const colorRoll = rng();
      if (colorRoll < 0.05 + coolBias * 0.15) {
        colors[i3] = 0.5 + coolBias * 0.2; colors[i3 + 1] = 0.7 + coolBias * 0.1; colors[i3 + 2] = 1.0;
      } else if (colorRoll < 0.10 + warmBias * 0.15) {
        colors[i3] = 1.0; colors[i3 + 1] = 0.5 + warmBias * 0.1; colors[i3 + 2] = 0.3;
      } else if (colorRoll < 0.15) {
        colors[i3] = 1.0; colors[i3 + 1] = 0.95; colors[i3 + 2] = 0.7;
      } else {
        const b = 0.5 + rng() * 0.5;
        colors[i3] = b; colors[i3 + 1] = b; colors[i3 + 2] = b;
      }

      const sizeRoll = rng();
      if (sizeRoll < 0.005) sizes[i] = 8.0;
      else if (sizeRoll < 0.03) sizes[i] = 6.0;
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
        uSkyPixelScale: SKY_PIXEL_SCALE,   // ⭐ the SHARED object — one setter moves every live sky material (skyPixelScale.js)
        uBrightness: { value: 1.0 },
        // Tunnel warp
        uTunnelPhase:   { value: 0.0 },
        uTunnelScroll:  { value: 0.0 },
        uTunnelForward: { value: new THREE.Vector3(0.0, 0.0, -1.0) },
        uTunnelRadius:  { value: 300.0 },
        uTunnelLength:  { value: 2400.0 },
        // Split-tunnel crossover — when two layer instances are used for
        // outgoing-system / incoming-system transition during HYPER.
        // uClipSide = 0 (outgoing): renders stars where tunnelAlong < uCrossoverAlong
        // uClipSide = 1 (incoming): renders stars where tunnelAlong >= uCrossoverAlong
        // Setting uCrossoverAlong = +1e6 and uClipSide = 0 → full starfield visible.
        uCrossoverAlong: { value: 1.0e6 },
        uCrossoverAlongB: { value: 1.0e6 },
        uClipSide:       { value: 0 },
        // Tint multiplier — lets two layers use the same star data but
        // render with different colors (useful for visualizing the
        // crossover during testing).
        uTint: { value: new THREE.Vector3(1.0, 1.0, 1.0) },
      },

      vertexShader: /* glsl */ `
        attribute float aSize;
        uniform float uTunnelPhase;
        uniform float uTunnelScroll;
        uniform vec3  uTunnelForward;
        uniform float uTunnelRadius;
        uniform float uTunnelLength;
        uniform float uCrossoverAlong;
        uniform float uCrossoverAlongB;  // second boundary for range-clip (bridge layer)
        uniform int   uClipSide;         // 0=clip ahead of A, 1=clip behind A, 2=range [A,B]
        varying vec3 vColor;
        varying float vTunnelAmt;
        varying float vClipped;

        // Deterministic hash from vec3 — gives each star a stable pseudo-random
        // perp direction when its original perp is near the tunnel axis.
        float hash1(vec3 p) {
          return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
        }

        uniform float uSkyPixelScale;

        void main() {
          vColor = color;
          vTunnelAmt = uTunnelPhase;

          // ── Angular-to-depth tunnel warp ──
          // Instead of just collapsing the radial component (which makes a
          // flat disk), remap the sky sphere onto a cylinder by converting
          // each star's angular position relative to the tunnel forward
          // direction into a depth along the tunnel. Stars ahead map deep
          // into the tunnel, stars to the sides/behind map to the near walls.
          // This wallpapers the entire sky onto the tunnel interior.

          vec3 F = normalize(uTunnelForward);
          vec3 dir = normalize(position);
          float cosTheta = dot(dir, F);
          float theta = acos(clamp(cosTheta, -1.0, 1.0));

          // Build perpendicular direction (azimuthal position around tunnel)
          vec3 perp = dir - cosTheta * F;
          float perpLen = length(perp);
          vec3 perpDir;
          if (perpLen > 0.001) {
            perpDir = perp / perpLen;
          } else {
            // Star is on the tunnel axis — pick a stable arbitrary angle
            float h = hash1(position);
            float ang = h * 6.2831853;
            vec3 up = abs(F.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
            vec3 right = normalize(cross(F, up));
            vec3 fup = normalize(cross(right, F));
            perpDir = right * cos(ang) + fup * sin(ang);
          }

          // ── Angular-to-depth mapping ──
          // theta=0 (directly ahead) → far end of tunnel (tunnelLength/2)
          // theta=PI/2 (to the side) → near camera (0)
          // theta=PI (directly behind) → behind camera (-tunnelLength/4)
          // Using a nonlinear curve so more of the sky maps to visible wall
          float PI = 3.14159265;
          float L = uTunnelLength;
          float normalizedAngle = theta / PI;  // 0 = ahead, 1 = behind
          // Remap: ahead(0) → +L/2, side(0.5) → 0, behind(1.0) → -L/4
          float tunnelZ = mix(L * 0.5, -L * 0.25, normalizedAngle);

          // Apply scroll (stars stream past as the player travels)
          float scrolled = tunnelZ - uTunnelScroll;
          scrolled = mod(scrolled + L * 0.5, L) - L * 0.5;

          // ── Split-tunnel crossover clip ──
          // Mode 0: clip ahead of boundary A (origin layer — visible behind A)
          // Mode 1: clip behind boundary A (destination layer — visible ahead of A)
          // Mode 2: range clip — visible only between A and B (bridge layer)
          vClipped = 0.0;
          if (uTunnelPhase > 0.0) {
            float tw = 200.0;  // transition width
            if (uClipSide == 0) {
              float delta = scrolled - uCrossoverAlong;
              vClipped = smoothstep(-tw, tw, delta);
            } else if (uClipSide == 1) {
              float delta = scrolled - uCrossoverAlong;
              vClipped = 1.0 - smoothstep(-tw, tw, delta);
            } else {
              // Range clip: visible between A and B, clipped outside
              float clipA = smoothstep(-tw, tw, uCrossoverAlong - scrolled);  // clip behind A
              float clipB = smoothstep(-tw, tw, scrolled - uCrossoverAlongB); // clip ahead of B
              vClipped = max(clipA, clipB);
            }
          }

          // ── Tunnel wall radius with perspective taper ──
          // All stars go to the tunnel wall. Stars far ahead taper toward
          // the vanishing point (small radius). Stars near the camera are
          // at full tunnel radius.
          float taperStart = L * 0.15;
          float taperEnd   = L * 0.45;
          float ahead = max(scrolled, 0.0);
          float taper = 1.0 - smoothstep(taperStart, taperEnd, ahead) * 0.95;
          float warpedR = uTunnelRadius * taper;

          // Reconstruct tunnel position
          vec3 tunnelPos = perpDir * warpedR + F * scrolled;

          // Blend between original sky position and tunnel position
          vec3 finalPos = mix(position, tunnelPos, uTunnelPhase);

          vec4 mvPos = modelViewMatrix * vec4(finalPos, 1.0);
          gl_Position = projectionMatrix * mvPos;

          // ── Depth-based point size ──
          // Near stars are large (solid-feeling walls), far stars are tiny
          // (vanishing point convergence).
          float baseSize = aSize > 5.0 ? aSize * 2.0 : aSize;
          float depthScale = 1.0;
          if (uTunnelPhase > 0.0) {
            float depthNorm = clamp(scrolled / (L * 0.5), 0.0, 1.0);
            depthScale = mix(1.8, 0.12, depthNorm * depthNorm);
          }
          gl_PointSize = baseSize * (1.0 + uTunnelPhase * 0.3) * depthScale / uSkyPixelScale;   // ⭐ constant SCREEN size — see skyPixelScale.js
        }
      `,

      fragmentShader: /* glsl */ `
        uniform float uBrightness;
        uniform vec3 uTint;
        varying vec3 vColor;
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
          // Split-tunnel crossover clip: fade out clipped stars with a
          // soft transition so there's no hard seam at the plane.
          if (vClipped >= 0.99) discard;

          vec2 c = gl_PointCoord - 0.5;
          float d = length(c);
          float coreBright = 1.0 - smoothstep(0.0, 0.2, d);
          float glow = 1.0 - smoothstep(0.1, 0.5, d);
          float shape = coreBright * 0.6 + glow * 0.4;

          float threshold = bayerDither(floor(gl_FragCoord.xy / 3.0));
          if (shape < threshold * 0.5) discard;

          // During warp, brighten stars slightly — simulates energy.
          // Tint lets two layer instances render with distinguishable
          // colors for testing the crossover visually.
          vec3 col = vColor * uTint * uBrightness * shape * (1.0 + vTunnelAmt * 0.3);
          // Fade out as we approach the clip boundary
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

  // ── Warp-tunnel API (what a real WarpEffect would call) ──
  setTunnelPhase(v)  { this.mesh.material.uniforms.uTunnelPhase.value = v; }
  setTunnelScroll(v) { this.mesh.material.uniforms.uTunnelScroll.value = v; }
  setTunnelForward(vec3) {
    this.mesh.material.uniforms.uTunnelForward.value.copy(vec3);
  }
  setTunnelRadius(v) { this.mesh.material.uniforms.uTunnelRadius.value = v; }
  setTunnelLength(v) { this.mesh.material.uniforms.uTunnelLength.value = v; }
  setBrightness(v)   { this.mesh.material.uniforms.uBrightness.value = v; }

  // ── Split-tunnel crossover (for A + B outgoing/incoming pairs) ──
  /** Which side of the crossover plane this layer renders.
   *  0 = outgoing (near half, tunnelAlong < crossover)
   *  1 = incoming (far half, tunnelAlong >= crossover) */
  setClipSide(side)    { this.mesh.material.uniforms.uClipSide.value = side; }
  /** Position of the crossover plane along the tunnel axis.
   *  +1e6 = no clipping (single-layer use). During HYPER sweeps from
   *  +uTunnelLength/2 (all outgoing visible) to -uTunnelLength/2 (all incoming). */
  setCrossoverAlong(v) { this.mesh.material.uniforms.uCrossoverAlong.value = v; }
  /** Second crossover boundary for range-clip mode (clipSide=2). */
  setCrossoverAlongB(v) { this.mesh.material.uniforms.uCrossoverAlongB.value = v; }
  /** RGB multiplier on star color — lets A and B layers tint distinctly for testing. */
  setTint(r, g, b)     { this.mesh.material.uniforms.uTint.value.set(r, g, b); }

  // ── StarfieldLayer compatibility API ──
  // These methods let WarpTunnelStarfieldLayer drop in where StarfieldLayer
  // was used (SkyRenderer, warp targeting, nav computer).

  /** Legacy warp uniforms — maps fold effect to tunnel phase. */
  setWarpUniforms(foldAmount, brightness, _riftCenterNDC) {
    this.mesh.material.uniforms.uBrightness.value = brightness;
    // foldAmount drives tunnel phase when using the legacy API
    this.mesh.material.uniforms.uTunnelPhase.value = foldAmount;
  }

  /** Find the nearest starfield point to a given ray direction. */
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

  /** Pick a random star visible in the forward hemisphere. */
  getRandomVisibleStar(cameraForward) {
    const positions = this.mesh.geometry.attributes.position.array;
    const candidates = [];
    const _dir = new THREE.Vector3();
    for (let i = 0; i < this.count; i++) {
      const i3 = i * 3;
      _dir.set(positions[i3], positions[i3 + 1], positions[i3 + 2]).normalize();
      if (cameraForward.dot(_dir) > 0.3) candidates.push(i);
    }
    if (candidates.length === 0) return null;
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    const p = pick * 3;
    return {
      direction: new THREE.Vector3(positions[p], positions[p + 1], positions[p + 2]).normalize(),
      index: pick,
    };
  }

  /** Check if a starfield index maps to a real GalacticMap star (returns starData). */
  getGalaxyStarForIndex(index) {
    for (const entry of this.realStars) {
      if (entry.index === index) return entry.starData;
    }
    return null;
  }

  /** Get the full entry (index + starData) for a starfield index. */
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
