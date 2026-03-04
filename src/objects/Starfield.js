import * as THREE from 'three';

/**
 * Creates a starfield — thousands of tiny points on a large sphere
 * surrounding the camera. The sphere moves WITH the camera so you
 * never fly past the stars (they're a backdrop, like a skybox).
 *
 * During warp transitions, the vertex shader can fold all stars
 * toward screen center (creating a "slice" in space) and the
 * fragment shader boosts brightness for the accumulation glow.
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
      // The math: pick a random direction in 3D, then normalize to the sphere radius.
      // Using spherical coordinates with uniform distribution.
      const theta = Math.random() * Math.PI * 2;       // 0 to 360 degrees
      const phi = Math.acos(2 * Math.random() - 1);    // uniform distribution on sphere
      const r = this.radius;

      const i3 = i * 3;
      positions[i3]     = r * Math.sin(phi) * Math.cos(theta);  // x
      positions[i3 + 1] = r * Math.sin(phi) * Math.sin(theta);  // y
      positions[i3 + 2] = r * Math.cos(phi);                     // z

      // Most stars are white-ish, but some have a slight color tint.
      // This mimics real star colors (blue = hot, red = cool, yellow = sun-like).
      const colorRoll = Math.random();
      if (colorRoll < 0.05) {
        // Blue-white (hot star) — 5% chance
        colors[i3]     = 0.7;
        colors[i3 + 1] = 0.8;
        colors[i3 + 2] = 1.0;
      } else if (colorRoll < 0.10) {
        // Red-orange (cool star) — 5% chance
        colors[i3]     = 1.0;
        colors[i3 + 1] = 0.6;
        colors[i3 + 2] = 0.4;
      } else if (colorRoll < 0.15) {
        // Yellow (sun-like) — 5% chance
        colors[i3]     = 1.0;
        colors[i3 + 1] = 0.95;
        colors[i3 + 2] = 0.7;
      } else {
        // White — 85% of stars
        const brightness = 0.6 + Math.random() * 0.4; // vary brightness
        colors[i3]     = brightness;
        colors[i3 + 1] = brightness;
        colors[i3 + 2] = brightness;
      }
    }

    // Vary star sizes — most are small points, a few are bigger.
    // These sizes are in pixels at FULL screen resolution (the starfield
    // renders at full res, not the low retro res), so 2.0 = a 2×2 pixel point.
    const sizes = new Float32Array(this.count);
    for (let i = 0; i < this.count; i++) {
      const roll = Math.random();
      if (roll < 0.005) sizes[i] = 6.0;       // 0.5% large (pointed star shape)
      else if (roll < 0.03) sizes[i] = 4.0;   // 2.5% medium
      else sizes[i] = 2.0;                     // 97% small points
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));

    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false, // Backdrop — should never block anything in front
      vertexColors: true,

      uniforms: {
        uFoldAmount: { value: 0.0 },     // 0 = normal, 1 = fully folded to center
        uBrightness: { value: 1.0 },     // brightness multiplier (glow during fold)
      },

      vertexShader: /* glsl */ `
        attribute float aSize;
        uniform float uFoldAmount;
        varying vec3 vColor;
        varying float vSize;

        void main() {
          vColor = color;
          vSize = aSize;
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPos;

          // ── Warp fold effect ──
          // During warp, stars slide toward the vertical center line of the screen.
          // Stars far from center move more; stars near center barely move.
          // This creates a bright vertical "slice" — a rift in space.
          if (uFoldAmount > 0.0) {
            // Work in NDC (clip space / w)
            float ndcX = gl_Position.x / gl_Position.w;
            // Fold: compress X toward 0. Outer stars fold more.
            float foldStrength = uFoldAmount * uFoldAmount; // ease-in for dramatic acceleration
            float folded = ndcX * (1.0 - foldStrength);
            gl_Position.x = folded * gl_Position.w;
          }

          // Large stars (6px) get a bigger quad so the pointed tips have room.
          // Medium (4px) and small (2px) render at natural size.
          gl_PointSize = aSize > 5.0 ? aSize * 2.0 : aSize;
        }
      `,

      fragmentShader: /* glsl */ `
        uniform float uBrightness;
        varying vec3 vColor;
        varying float vSize;

        // Same 4x4 Bayer matrix as Planet.js
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

          // Small/medium stars: circle (Euclidean distance)
          // Large stars (6px): pointed star shape (superellipse with p < 1)
          //   pow < 1 pinches the diagonals inward, exaggerating the 4 tips
          //   Regular diamond (Manhattan) would be p=1.0, we use 0.6 for pointier
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

          // Apply brightness boost during warp (stars accumulate as they fold)
          vec3 col = vColor * uBrightness;
          gl_FragColor = vec4(min(col, vec3(1.0)), 1.0);
        }
      `,
    });

    return new THREE.Points(geometry, material);
  }

  /**
   * Call this every frame to keep the starfield centered on the camera.
   * Since it's a skybox-like backdrop, it should never appear to move.
   */
  update(cameraPosition) {
    this.mesh.position.copy(cameraPosition);
  }

  /**
   * Set warp-related uniforms (called by main.js during warp).
   * @param {number} foldAmount  0 = normal, 1 = fully folded to center
   * @param {number} brightness  1 = normal, higher = brighter (glow during fold)
   */
  setWarpUniforms(foldAmount, brightness) {
    this.mesh.material.uniforms.uFoldAmount.value = foldAmount;
    this.mesh.material.uniforms.uBrightness.value = brightness;
  }

  /**
   * Add the starfield to a Three.js scene.
   */
  addTo(scene) {
    scene.add(this.mesh);
  }

  /**
   * Clean up GPU resources. Call this when removing the starfield
   * (e.g., when swapping star systems during warp).
   * Without this, old geometry/materials stay in GPU memory = memory leak.
   */
  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
