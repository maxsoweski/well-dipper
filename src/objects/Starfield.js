import * as THREE from 'three';

/**
 * Creates a starfield — thousands of tiny points on a large sphere
 * surrounding the camera. The sphere moves WITH the camera so you
 * never fly past the stars (they're a backdrop, like a skybox).
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

    // Vary star sizes — most are small, a few are bigger
    const sizes = new Float32Array(this.count);
    for (let i = 0; i < this.count; i++) {
      const roll = Math.random();
      if (roll < 0.01) sizes[i] = 5.0;       // 1% large
      else if (roll < 0.04) sizes[i] = 3.0;  // 3% medium
      else sizes[i] = 1.5;                    // 96% small
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));

    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false, // Backdrop — should never block anything in front
      vertexColors: true,

      vertexShader: /* glsl */ `
        attribute float aSize;
        varying vec3 vColor;
        varying float vSize;

        void main() {
          vColor = color;
          vSize = aSize;
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPos;
          // Large stars get a bigger quad so the pointed tips have room
          gl_PointSize = aSize > 2.0 ? aSize * 2.0 : aSize;
        }
      `,

      fragmentShader: /* glsl */ `
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

          // Small stars: circle (Euclidean distance)
          // Large stars: pointed star shape (superellipse with p < 1)
          //   pow < 1 pinches the diagonals inward, exaggerating the 4 tips
          //   Regular diamond (Manhattan) would be p=1.0, we use 0.6 for pointier
          float dist;
          if (vSize < 2.5) {
            dist = length(center);
          } else {
            dist = pow(abs(center.x), 0.6) + pow(abs(center.y), 0.6);
          }

          float edge = vSize < 2.5
            ? smoothstep(0.3, 0.5, dist)
            : smoothstep(0.35, 0.55, dist);
          if (edge > threshold) discard;

          gl_FragColor = vec4(vColor, 1.0);
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
