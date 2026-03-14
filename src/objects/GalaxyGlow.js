import * as THREE from 'three';

/**
 * GalaxyGlow — diffuse glow behind the starfield representing the
 * unresolved billions of stars in the galaxy.
 *
 * Uses the same rendering approach as Nebula.js: layered billboard
 * planes with FBM noise + domain warping + additive blending. This
 * already looks great in the game for nebulae, so it should work
 * well for the galactic glow too.
 *
 * Multiple glow layers are placed at the densest sky directions
 * (from the StarfieldGenerator's sky density grid). Each layer
 * billboards to face the camera, creating a soft volumetric glow.
 *
 * Renders in the starfieldScene behind the Starfield points.
 */
export class GalaxyGlow {
  /**
   * @param {Float32Array} skyGrid - density values [0-1], row-major (theta × phi)
   * @param {number} gridTheta - number of theta columns
   * @param {number} gridPhi - number of phi rows
   * @param {number} radius - sky sphere radius
   */
  constructor(skyGrid, gridTheta, gridPhi, radius = 490) {
    this.radius = radius;
    this.mesh = new THREE.Group();
    this._layers = [];
    this._createLayers(skyGrid, gridTheta, gridPhi);
  }

  _createLayers(skyGrid, gridTheta, gridPhi) {
    // Find the densest regions of the sky and place glow layers there.
    // Collect all grid cells with significant density, sorted by density.
    const cells = [];
    for (let ti = 0; ti < gridTheta; ti++) {
      for (let pi = 0; pi < gridPhi; pi++) {
        const density = skyGrid[ti * gridPhi + pi];
        if (density > 0.15) { // Only place glow where there's meaningful density
          const theta = ((ti + 0.5) / gridTheta) * Math.PI * 2;
          const phi = ((pi + 0.5) / gridPhi) * Math.PI;
          cells.push({ theta, phi, density });
        }
      }
    }
    cells.sort((a, b) => b.density - a.density);

    // Place 6-12 glow layers at the densest directions
    const layerCount = Math.min(Math.max(6, Math.floor(cells.length * 0.3)), 12);

    for (let i = 0; i < layerCount && i < cells.length; i++) {
      const cell = cells[i];

      // Direction on the sky sphere
      const dirX = Math.sin(cell.phi) * Math.cos(cell.theta);
      const dirY = Math.cos(cell.phi);
      const dirZ = Math.sin(cell.phi) * Math.sin(cell.theta);

      // Layer size scales with density (brighter regions = larger glow)
      const baseSize = 200 + cell.density * 300;

      // Color: warm tint for dense core regions, cooler for arm regions
      const warmth = cell.density;
      const r = 0.28 + warmth * 0.15;  // 0.28-0.43
      const g = 0.24 + warmth * 0.10;  // 0.24-0.34
      const b = 0.18 + warmth * 0.05;  // 0.18-0.23

      // Opacity: denser = more opaque, but keep it subtle
      const opacity = 0.08 + cell.density * 0.15; // 0.08-0.23

      const layer = this._createLayer(baseSize, [r, g, b], opacity, i * 7.3);

      // Position on sky sphere
      layer.position.set(
        dirX * this.radius,
        dirY * this.radius,
        dirZ * this.radius,
      );

      this.mesh.add(layer);
      this._layers.push(layer);
    }
  }

  _createLayer(size, color, opacity, seedOffset) {
    const geometry = new THREE.PlaneGeometry(size, size);

    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      side: THREE.FrontSide,

      uniforms: {
        uColor: { value: new THREE.Color(color[0], color[1], color[2]) },
        uOpacity: { value: opacity },
        uNoiseScale: { value: 2.5 },
        uNoiseSeed: { value: new THREE.Vector2(seedOffset, seedOffset * 0.7) },
      },

      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,

      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        uniform float uOpacity;
        uniform float uNoiseScale;
        uniform vec2 uNoiseSeed;
        varying vec2 vUv;

        // Hash-based noise (same as Nebula.js)
        vec2 hash22(vec2 p) {
          p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
          return fract(sin(p) * 43758.5453);
        }

        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          float a = dot(hash22(i + vec2(0.0, 0.0)) - 0.5, f - vec2(0.0, 0.0));
          float b = dot(hash22(i + vec2(1.0, 0.0)) - 0.5, f - vec2(1.0, 0.0));
          float c = dot(hash22(i + vec2(0.0, 1.0)) - 0.5, f - vec2(0.0, 1.0));
          float d = dot(hash22(i + vec2(1.0, 1.0)) - 0.5, f - vec2(1.0, 1.0));
          return mix(mix(a, b, u.x), mix(c, d, u.x), u.y) + 0.5;
        }

        // Fractal Brownian Motion
        float fbm(vec2 p) {
          float value = 0.0;
          float amplitude = 0.5;
          float frequency = 1.0;
          for (int i = 0; i < 4; i++) {
            value += amplitude * noise(p * frequency);
            frequency *= 2.0;
            amplitude *= 0.5;
          }
          return value;
        }

        void main() {
          vec2 uv = vUv;
          vec2 noiseP = uv * uNoiseScale + uNoiseSeed;

          // Domain warping for organic cloud shapes
          vec2 q = vec2(
            fbm(noiseP + vec2(0.0, 0.0)),
            fbm(noiseP + vec2(5.2, 1.3))
          );
          float warped = fbm(noiseP + 3.0 * q);

          // Cloud shape
          float cloud = smoothstep(0.15, 0.6, warped);

          // Radial falloff: soft circular fade
          float dist = length(uv - 0.5);
          float falloff = 1.0 - smoothstep(0.15, 0.5, dist);

          float alpha = cloud * falloff * uOpacity;

          if (alpha < 0.005) discard;

          gl_FragColor = vec4(uColor * alpha, alpha);
        }
      `,
    });

    return new THREE.Mesh(geometry, material);
  }

  /**
   * Billboard all layers to face the camera.
   * Same approach as Nebula.js — copy camera quaternion.
   */
  update(cameraPosition, camera) {
    this.mesh.position.copy(cameraPosition);
    if (camera) {
      for (const layer of this._layers) {
        layer.quaternion.copy(camera.quaternion);
      }
    }
  }

  addTo(scene) {
    scene.add(this.mesh);
  }

  dispose() {
    for (const layer of this._layers) {
      layer.geometry.dispose();
      layer.material.dispose();
    }
    this._layers = [];
  }
}
