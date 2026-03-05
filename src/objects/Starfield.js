import * as THREE from 'three';

/**
 * Creates a starfield — thousands of tiny points on a large sphere
 * surrounding the camera. The sphere moves WITH the camera so you
 * never fly past the stars (they're a backdrop, like a skybox).
 *
 * During warp transitions:
 * - Vertex shader pinches stars radially toward rift center (360° fold)
 * - Close stars fold first, outer stars follow (distance-based pull)
 * - Fragment shader boosts brightness for the accumulation glow
 */
export class Starfield {
  constructor(count = 3000, radius = 500) {
    this.count = count;
    this.radius = radius;
    this.mesh = this._createStars();
  }

  _createStars() {
    // Each star needs x, y, z position and r, g, b color
    const positions = new Float32Array(this.count * 3);
    const colors = new Float32Array(this.count * 3);

    for (let i = 0; i < this.count; i++) {
      // Distribute points uniformly on a sphere surface.
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = this.radius;

      const i3 = i * 3;
      positions[i3]     = r * Math.sin(phi) * Math.cos(theta);
      positions[i3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i3 + 2] = r * Math.cos(phi);

      // Star colors: mostly white, some tinted
      const colorRoll = Math.random();
      if (colorRoll < 0.05) {
        colors[i3] = 0.7; colors[i3 + 1] = 0.8; colors[i3 + 2] = 1.0;
      } else if (colorRoll < 0.10) {
        colors[i3] = 1.0; colors[i3 + 1] = 0.6; colors[i3 + 2] = 0.4;
      } else if (colorRoll < 0.15) {
        colors[i3] = 1.0; colors[i3 + 1] = 0.95; colors[i3 + 2] = 0.7;
      } else {
        const brightness = 0.6 + Math.random() * 0.4;
        colors[i3] = brightness; colors[i3 + 1] = brightness; colors[i3 + 2] = brightness;
      }
    }

    // Vary star sizes
    const sizes = new Float32Array(this.count);
    for (let i = 0; i < this.count; i++) {
      const roll = Math.random();
      if (roll < 0.005) sizes[i] = 6.0;
      else if (roll < 0.03) sizes[i] = 4.0;
      else sizes[i] = 2.0;
    }

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
        uRiftCenter: { value: new THREE.Vector2(0.0, 0.0) },  // NDC space (-1 to 1)
      },

      vertexShader: /* glsl */ `
        attribute float aSize;
        uniform float uFoldAmount;
        uniform vec2 uRiftCenter;   // NDC space target point
        varying vec3 vColor;
        varying float vSize;

        void main() {
          vColor = color;
          vSize = aSize;
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPos;

          // ── Warp fold ──
          // Space pinches into a central point from all directions (360°).
          // Stars closest to center fold first, outer stars follow.
          float convergeFactor = 1.0;

          if (uFoldAmount > 0.0) {
            vec2 ndc = gl_Position.xy / gl_Position.w;
            vec2 toCenter = ndc - uRiftCenter;
            float dist = length(toCenter);

            // Distance-based pull: close stars fold first, far stars later.
            float pullStart = dist * 0.7;
            float pullEnd = pullStart + 0.35;
            float localFold = smoothstep(pullStart, pullEnd, uFoldAmount);

            // Compress radially toward center (360° pinch)
            vec2 folded = uRiftCenter + toCenter * (1.0 - localFold);
            gl_Position.xy = folded * gl_Position.w;

            // Stars grow as they converge (accumulation glow)
            convergeFactor = 1.0 + localFold * 3.0;
          }

          // Point size: base size × convergence growth
          float baseSize = aSize > 5.0 ? aSize * 2.0 : aSize;
          gl_PointSize = baseSize * convergeFactor;
        }
      `,

      fragmentShader: /* glsl */ `
        uniform float uBrightness;
        varying vec3 vColor;
        varying float vSize;

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
          float threshold = bayerDither(gl_FragCoord.xy);

          // Star shape: small stars are round, large stars are diamond-ish
          float dist;
          if (vSize < 5.0) {
            dist = length(center);
          } else {
            dist = pow(abs(center.x), 0.6) + pow(abs(center.y), 0.6);
          }

          float edge = vSize < 5.0
            ? smoothstep(0.3, 0.5, dist)
            : smoothstep(0.35, 0.55, dist);
          if (edge > threshold) discard;

          // Brightness boost during warp (stars accumulate as they fold)
          vec3 col = vColor * uBrightness;
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
    this.mesh.material.uniforms.uFoldAmount.value = foldAmount;
    this.mesh.material.uniforms.uBrightness.value = brightness;
    if (riftCenterNDC) {
      this.mesh.material.uniforms.uRiftCenter.value.copy(riftCenterNDC);
    }
  }

  /**
   * Find the nearest starfield point to a given ray direction.
   * Uses angular distance (dot product) — returns the direction to the
   * closest star within a 3° cone, or null if nothing's close enough.
   *
   * @param {THREE.Vector3} rayDirection — normalized world-space ray
   * @returns {THREE.Vector3|null} — normalized direction to nearest star
   */
  findNearestStar(rayDirection) {
    const positions = this.mesh.geometry.attributes.position.array;
    const cosThreshold = Math.cos(3 * Math.PI / 180); // 3° cone
    let bestDot = cosThreshold;
    let bestDir = null;

    const _dir = new THREE.Vector3();
    for (let i = 0; i < this.count; i++) {
      const i3 = i * 3;
      // Star positions are relative to mesh center (which follows camera),
      // so the position vector IS the direction from camera to star.
      _dir.set(positions[i3], positions[i3 + 1], positions[i3 + 2]).normalize();
      const dot = rayDirection.dot(_dir);
      if (dot > bestDot) {
        bestDot = dot;
        bestDir = _dir.clone();
      }
    }
    return bestDir;
  }

  /**
   * Pick a random star visible in the forward hemisphere.
   * Used for auto-selecting a warp target in screensaver mode.
   *
   * @param {THREE.Vector3} cameraForward — normalized camera forward direction
   * @returns {THREE.Vector3|null} — normalized direction to a random visible star
   */
  getRandomVisibleStar(cameraForward) {
    const positions = this.mesh.geometry.attributes.position.array;
    const candidates = [];
    const _dir = new THREE.Vector3();

    for (let i = 0; i < this.count; i++) {
      const i3 = i * 3;
      _dir.set(positions[i3], positions[i3 + 1], positions[i3 + 2]).normalize();
      // dot > 0.3 ≈ within ~72° of forward (roughly what's on screen)
      if (cameraForward.dot(_dir) > 0.3) {
        candidates.push(i);
      }
    }
    if (candidates.length === 0) return null;

    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    const p = pick * 3;
    return new THREE.Vector3(positions[p], positions[p + 1], positions[p + 2]).normalize();
  }

  addTo(scene) {
    scene.add(this.mesh);
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
