import * as THREE from 'three';
import { HASH22 } from '../rendering/shaders/common.glsl.js';

/**
 * GalaxyNebula — renders the galaxy using scattered nebula-style billboards.
 *
 * Instead of computing density in the shader, this places many individual
 * nebula layers (same shader as Nebula.js) at positions ALONG the spiral arms.
 * Each layer is a transparent PlaneGeometry with domain-warped FBM noise,
 * positioned and sized to cover a section of an arm.
 *
 * The galaxy's shape emerges from WHERE the layers are placed (from GalacticMap
 * arm positions), while the visual texture is pure nebula-style clouds.
 *
 * This is an experiment: does scattering the proven nebula shader along
 * the arm structure produce a good-looking galaxy?
 */
export class GalaxyNebula {
  /**
   * @param {Object} armData — { arms, pitchK, barAngle }
   * @param {Object} [options]
   * @param {number} [options.radius=15] — galaxy radius in kpc
   * @param {number} [options.layersPerArm=12] — nebula layers per arm
   * @param {number} [options.bulgeCount=8] — extra layers for the bulge
   */
  constructor(armData, options = {}) {
    const {
      radius = 15,
      layersPerArm = 12,
      bulgeCount = 8,
    } = options;

    this.mesh = new THREE.Group();
    this._layers = [];

    const pitchK = armData.pitchK;

    // ── Scatter nebula layers along each arm ──
    for (const arm of armData.arms) {
      for (let i = 0; i < layersPerArm; i++) {
        // Sample a position along the arm
        const t = (i + 0.5) / layersPerArm; // 0 to 1 along the arm
        const R = 1.5 + t * (radius - 2); // R from 1.5 to ~13 kpc
        const theta = arm.offset + pitchK * Math.log(R / 4.0);

        const x = R * Math.cos(theta);
        const z = R * Math.sin(theta);

        // Layer size scales with radius (bigger patches further out)
        // and arm width
        const layerSize = (arm.width * 2 + R * 0.15) * (1 + Math.sin(i * 3.7) * 0.3);

        // Scatter position slightly off the arm center
        const scatter = arm.width * 0.5;
        const offX = Math.sin(i * 7.3 + arm.offset) * scatter;
        const offZ = Math.cos(i * 5.1 + arm.offset) * scatter;

        // Color: bluer in inner arms, warmer in outer
        const armBlue = Math.max(0, 1 - t * 0.7);
        const color = arm.isMajor
          ? [0.6 + t * 0.3, 0.7 + t * 0.15, 0.85 + armBlue * 0.15]
          : [0.8, 0.78, 0.7 + armBlue * 0.2];

        // Opacity: major arms brighter
        const opacity = (arm.isMajor ? 0.4 : 0.25) * (arm.densityBoost / 2.5);

        this._addLayer({
          x: x + offX, y: 0, z: z + offZ,
          size: layerSize,
          color,
          opacity,
          noiseScale: 1.8 + Math.sin(i * 2.3) * 0.5,
          noiseSeed: [
            Math.sin(i * 3.7 + arm.offset * 10) * 50 + 50,
            Math.cos(i * 5.1 + arm.offset * 10) * 50 + 50,
          ],
          rotation: Math.sin(i * 4.1 + arm.offset) * 0.4,
        });
      }
    }

    // ── Bulge layers (warm golden center) ──
    for (let i = 0; i < bulgeCount; i++) {
      const angle = (i / bulgeCount) * Math.PI * 2;
      const r = 0.3 + Math.sin(i * 3.1) * 0.2;

      // Bar elongation
      const barAngle = armData.barAngle || 0;
      const bx = r * Math.cos(angle) * 1.5; // stretch along bar
      const bz = r * Math.sin(angle) * 0.8;
      const x = bx * Math.cos(barAngle) - bz * Math.sin(barAngle);
      const z = bx * Math.sin(barAngle) + bz * Math.cos(barAngle);

      this._addLayer({
        x, y: 0, z,
        size: 2.5 + Math.sin(i * 2.7) * 0.8,
        color: [1.0, 0.82, 0.5],
        opacity: 0.5,
        noiseScale: 2.0 + i * 0.2,
        noiseSeed: [i * 17.3 + 100, i * 11.7 + 100],
        rotation: i * 0.7,
      });
    }
  }

  _addLayer({ x, y, z, size, color, opacity, noiseScale, noiseSeed, rotation }) {
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
        uNoiseScale: { value: noiseScale },
        uNoiseSeed: { value: new THREE.Vector2(noiseSeed[0], noiseSeed[1]) },
        uTime: { value: 0 },
      },

      // Exact same shader as Nebula.js
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
        uniform float uTime;
        varying vec2 vUv;

        ${HASH22}

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

        float fbm(vec2 p) {
          float value = 0.0;
          float amplitude = 0.5;
          float frequency = 1.0;
          for (int i = 0; i < 5; i++) {
            value += amplitude * noise(p * frequency);
            frequency *= 2.0;
            amplitude *= 0.5;
          }
          return value;
        }

        void main() {
          vec2 uv = vUv;
          vec2 noiseP = uv * uNoiseScale + uNoiseSeed;

          // Domain warping: feed one FBM into another for organic swirls
          vec2 q = vec2(
            fbm(noiseP + vec2(0.0, 0.0) + uTime * 0.01),
            fbm(noiseP + vec2(5.2, 1.3) + uTime * 0.008)
          );
          float warped = fbm(noiseP + 3.5 * q);

          // Cloud shape from warped noise
          float cloud = smoothstep(0.15, 0.55, warped);

          // Radial falloff: fade out toward edges of the plane
          float dist = length(uv - 0.5);
          float falloff = 1.0 - smoothstep(0.25, 0.5, dist);

          float alpha = cloud * falloff * uOpacity;
          if (alpha < 0.003) discard;

          gl_FragColor = vec4(uColor * alpha, alpha);
        }
      `,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.rotation.x = -Math.PI / 2; // flat on XZ plane
    mesh.rotation.z = rotation || 0;

    this._layers.push(mesh);
    this.mesh.add(mesh);
  }

  update(deltaTime, camera) {
    for (const layer of this._layers) {
      layer.material.uniforms.uTime.value += deltaTime;
      // Billboard: face camera (like Nebula.js does)
      if (camera) {
        layer.quaternion.copy(camera.quaternion);
      }
    }
  }

  addTo(scene) { scene.add(this.mesh); }
  removeFrom(scene) { scene.remove(this.mesh); }

  dispose() {
    for (const layer of this._layers) {
      layer.geometry.dispose();
      layer.material.dispose();
    }
  }
}
