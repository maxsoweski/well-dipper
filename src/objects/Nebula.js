import * as THREE from 'three';
import { Star } from './Star.js';

/**
 * Nebula — renders nebulae as layered semi-transparent planes with noise shaders.
 *
 * Used for: emission nebulae and planetary nebulae.
 * Each layer is a tilted plane with a procedural noise cloud texture.
 * Overlapping layers at different angles create a volumetric illusion.
 * At 1/3 retro resolution + dithering, the flat planes look convincingly 3D.
 *
 * Also includes embedded star particles (young stars born in the nebula).
 */
export class Nebula {
  constructor(nebulaData) {
    this.data = nebulaData;
    this.mesh = new THREE.Group();

    // Create cloud layers
    this._layers = this._createLayers(nebulaData.layers);
    for (const layer of this._layers) {
      this.mesh.add(layer);
    }

    // Create embedded star particles
    this._stars = this._createStars(nebulaData);
    this.mesh.add(this._stars);

    // Create central white dwarf for planetary nebulae
    this._centralStar = null;
    if (nebulaData.centralStar) {
      this._centralStar = new Star({
        color: nebulaData.centralStar.color,
        radius: nebulaData.centralStar.radius,
        luminosity: nebulaData.centralStar.luminosity,
      });
      this._centralStar.addTo(this.mesh);
    }
  }

  _createLayers(layersData) {
    return layersData.map(layerData => {
      // Each layer is a large plane with noise-based cloud shader
      const size = layerData.size;
      const geometry = new THREE.PlaneGeometry(size, size);

      const material = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.FrontSide,  // billboarded = always facing camera, no need for DoubleSide

        uniforms: {
          uColor: { value: new THREE.Color(layerData.color[0], layerData.color[1], layerData.color[2]) },
          uOpacity: { value: layerData.opacity },
          uNoiseScale: { value: layerData.noiseScale },
          uNoiseSeed: { value: new THREE.Vector2(layerData.noiseSeed[0], layerData.noiseSeed[1]) },
          uTime: { value: 0 },
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
          uniform float uTime;
          varying vec2 vUv;

          // ── Simplex-like noise (hash-based) ──
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

          // Fractal Brownian Motion (layered noise)
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

            // 4×4 Bayer dithering on alpha edge
            vec2 p = mod(floor(gl_FragCoord.xy), 4.0);
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
            float threshold = t / 16.0;
            if (alpha < threshold * 0.5) discard;

            gl_FragColor = vec4(uColor * alpha, alpha);
          }
        `,
      });

      const mesh = new THREE.Mesh(geometry, material);

      // Position and rotate each layer for parallax depth
      mesh.position.set(layerData.position[0], layerData.position[1], layerData.position[2]);
      mesh.rotation.set(layerData.rotation[0], layerData.rotation[1], layerData.rotation[2]);

      return mesh;
    });
  }

  _createStars(data) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(data.starPositions, 3));
    geometry.setAttribute('aColor', new THREE.Float32BufferAttribute(data.starColors, 3));
    geometry.setAttribute('aSize', new THREE.Float32BufferAttribute(data.starSizes, 1));

    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,

      vertexShader: /* glsl */ `
        attribute vec3 aColor;
        attribute float aSize;
        varying vec3 vColor;

        void main() {
          vColor = aColor;
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPos;
          float distScale = 300.0 / max(-mvPos.z, 1.0);
          gl_PointSize = clamp(aSize * distScale, 0.5, 32.0);
        }
      `,

      fragmentShader: /* glsl */ `
        varying vec3 vColor;

        void main() {
          float dist = length(gl_PointCoord - 0.5);
          if (dist > 0.5) discard;
          float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
          gl_FragColor = vec4(vColor * alpha, alpha);
        }
      `,
    });

    return new THREE.Points(geometry, material);
  }

  /**
   * Update animation (slow gas drift) and billboard layers toward camera.
   * @param {number} deltaTime — seconds since last frame
   * @param {THREE.Camera} [camera] — if provided, layers face the camera
   */
  update(deltaTime, camera) {
    for (const layer of this._layers) {
      layer.material.uniforms.uTime.value += deltaTime;

      // Billboard: make each layer always face the camera so the flat
      // planes aren't obvious when you orbit around the nebula. Each
      // layer keeps its own position offset (creating parallax depth),
      // only the orientation matches the camera.
      if (camera) {
        layer.quaternion.copy(camera.quaternion);
      }
    }
  }

  addTo(scene) {
    scene.add(this.mesh);
  }

  removeFrom(scene) {
    scene.remove(this.mesh);
  }

  dispose() {
    for (const layer of this._layers) {
      layer.geometry.dispose();
      layer.material.dispose();
    }
    if (this._stars) {
      this._stars.geometry.dispose();
      this._stars.material.dispose();
    }
    if (this._centralStar) {
      this._centralStar.dispose();
    }
  }
}
