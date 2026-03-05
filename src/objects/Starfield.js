import * as THREE from 'three';

/**
 * Creates a starfield — thousands of tiny points on a large sphere
 * surrounding the camera. The sphere moves WITH the camera so you
 * never fly past the stars (they're a backdrop, like a skybox).
 *
 * During warp transitions:
 * - Vertex shader folds stars toward screen center (vertical "slice")
 * - Stars elongate into horizontal streaks as they slide toward the fold
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
        varying float vStreakAmount;

        void main() {
          vColor = color;
          vSize = aSize;
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPos;

          // ── Warp fold + streak ──
          // Stars fold horizontally INTO the vertical rift pillar.
          // X compression is strong (stars slide sideways into the slit),
          // Y compression is gentle (keeps the vertical spread visible).
          vStreakAmount = 0.0;

          if (uFoldAmount > 0.0) {
            vec2 ndc = gl_Position.xy / gl_Position.w;
            vec2 toCenter = ndc - uRiftCenter;
            float distFromCenter = length(toCenter);

            // Fold: X compresses fully into the pillar, Y only 25%
            float foldStrength = uFoldAmount * uFoldAmount;
            vec2 folded = uRiftCenter + vec2(
              toCenter.x * (1.0 - foldStrength),
              toCenter.y * (1.0 - foldStrength * 0.25)
            );
            gl_Position.xy = folded * gl_Position.w;

            // Streak: based on horizontal distance (how far the star slides)
            vStreakAmount = uFoldAmount * min(abs(toCenter.x), 1.0);
          }

          // Point size: base size × streak elongation factor
          float baseSize = aSize > 5.0 ? aSize * 2.0 : aSize;
          float streakFactor = 1.0 + vStreakAmount * 5.0;
          gl_PointSize = baseSize * streakFactor;
        }
      `,

      fragmentShader: /* glsl */ `
        uniform float uBrightness;
        varying vec3 vColor;
        varying float vSize;
        varying float vStreakAmount;

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

          float dist;
          if (vStreakAmount > 0.01) {
            // ── Streak mode ──
            // Elongate horizontally: scale Y up so the distance grows
            // faster vertically → star becomes a wide horizontal line.
            float sf = 1.0 + vStreakAmount * 5.0;
            dist = length(vec2(center.x, center.y * sf));
          } else {
            // ── Normal mode ──
            if (vSize < 5.0) {
              dist = length(center);
            } else {
              dist = pow(abs(center.x), 0.6) + pow(abs(center.y), 0.6);
            }
          }

          float edge = vStreakAmount > 0.01
            ? smoothstep(0.3, 0.5, dist)
            : (vSize < 5.0
              ? smoothstep(0.3, 0.5, dist)
              : smoothstep(0.35, 0.55, dist));
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

  addTo(scene) {
    scene.add(this.mesh);
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
