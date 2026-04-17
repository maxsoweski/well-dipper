import * as THREE from 'three';
import { BAYER4, HASH22 } from '../rendering/shaders/common.glsl.js';

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
    // Simple emissive sphere + glow sprite — no need for full StarFlare
    // diffraction spikes or chromatic aberration at nebula scale.
    this._centralStar = null;
    if (nebulaData.centralStar) {
      this._centralStar = this._createCentralStar(nebulaData.centralStar);
      this.mesh.add(this._centralStar.group);
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
        depthTest: false,  // additive layers don't need depth — prevents z-fighting flicker
        blending: THREE.AdditiveBlending,
        side: THREE.FrontSide,  // billboarded = always facing camera, no need for DoubleSide

        uniforms: {
          uColor: { value: new THREE.Color(layerData.color[0], layerData.color[1], layerData.color[2]) },
          uOpacity: { value: layerData.opacity },
          uNoiseScale: { value: layerData.noiseScale },
          uNoiseSeed: { value: new THREE.Vector2(layerData.noiseSeed[0], layerData.noiseSeed[1]) },
          uTime: { value: 0 },
          uDomainWarpStrength: { value: layerData.domainWarpStrength ?? 3.5 },
          uDarkLaneStrength: { value: layerData.darkLaneStrength ?? 0.0 },
          uAsymmetry: { value: layerData.asymmetry ?? 0.0 },
          uBrightnessShape: { value: layerData.brightnessShape ?? 0 },
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
          uniform float uDomainWarpStrength;
          uniform float uDarkLaneStrength;
          uniform float uAsymmetry;
          uniform int uBrightnessShape;
          varying vec2 vUv;

          // ── Simplex-like noise (hash-based) ──
          ${HASH22}

          // ── 4×4 Bayer dither ──
          ${BAYER4}

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
            // uDomainWarpStrength controls how much the noise folds on itself
            // (higher = more stringy/filamentary structure)
            vec2 q = vec2(
              fbm(noiseP + vec2(0.0, 0.0) + uTime * 0.01),
              fbm(noiseP + vec2(5.2, 1.3) + uTime * 0.008)
            );
            float warped = fbm(noiseP + uDomainWarpStrength * q);

            // Cloud shape from warped noise
            float cloud = smoothstep(0.15, 0.55, warped);

            // Dark lane carving: high-frequency noise cuts dark channels
            // when uDarkLaneStrength > 0 (e.g. M42's dust lanes)
            if (uDarkLaneStrength > 0.0) {
              vec2 laneP = uv * uNoiseScale * 2.5 + uNoiseSeed * 1.7;
              float laneNoise = fbm(laneP + q * 0.5);
              // Carve dark channels where lane noise is low
              float lane = smoothstep(0.25, 0.45, laneNoise);
              cloud *= mix(1.0, lane, uDarkLaneStrength);
            }

            // Asymmetry: offset the radial falloff center so the nebula
            // isn't perfectly centered (e.g. M42's bright bar is off-center)
            vec2 falloffCenter = vec2(0.5) + vec2(uAsymmetry * 0.15, 0.0);
            float dist = length(uv - falloffCenter);

            // Radial falloff — shape depends on uBrightnessShape:
            //   0 = center-bright (default): gaussian-like center falloff
            //   1 = ring: bright ring with dim center (planetary nebulae)
            //   2 = scattered: flatter falloff for loose structures
            float falloff;
            if (uBrightnessShape == 1) {
              // Ring: peak brightness at dist ~0.25, dim at center and edges
              float ringDist = abs(dist - 0.25);
              falloff = 1.0 - smoothstep(0.0, 0.25, ringDist);
              falloff *= 1.0 - smoothstep(0.35, 0.5, dist); // still fade at outer edge
            } else if (uBrightnessShape == 2) {
              // Scattered: gentler falloff, more uniform brightness
              falloff = 1.0 - smoothstep(0.35, 0.5, dist);
            } else {
              // Center-bright (default): original behavior
              falloff = 1.0 - smoothstep(0.25, 0.5, dist);
            }

            float alpha = cloud * falloff * uOpacity;

            // 4×4 Bayer dithering on alpha edge
            float threshold = bayerDither(gl_FragCoord.xy);
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
          gl_PointSize = clamp(aSize * distScale, 0.5, 64.0);
        }
      `,

      fragmentShader: /* glsl */ `
        varying vec3 vColor;

        // 4×4 Bayer dithering
        ${BAYER4}

        void main() {
          vec2 p = gl_PointCoord - 0.5;
          float dist = length(p);

          // Core glow
          float alpha = 1.0 - smoothstep(0.0, 0.35, dist);

          // Diffraction spikes: 4 spikes (horizontal + vertical)
          float spikeH = exp(-abs(p.y) * 18.0) * exp(-abs(p.x) * 3.0);
          float spikeV = exp(-abs(p.x) * 18.0) * exp(-abs(p.y) * 3.0);
          float spikes = max(spikeH, spikeV) * 0.7;

          alpha = max(alpha, spikes);

          float threshold = bayerDither(gl_FragCoord.xy);
          if (alpha < threshold * 0.4) discard;

          gl_FragColor = vec4(vColor * alpha, alpha);
        }
      `,
    });

    return new THREE.Points(geometry, material);
  }

  /**
   * Create a simple central star for planetary nebulae.
   * Just an emissive sphere + additive glow sprite — bright colored dot,
   * no diffraction spikes or chromatic aberration needed.
   */
  _createCentralStar(starData) {
    const group = new THREE.Group();
    const [r, g, b] = starData.color;
    const color = new THREE.Color(r, g, b);
    const radius = starData.radius;

    // Emissive sphere core
    const sphereGeo = new THREE.IcosahedronGeometry(radius, 2);
    const sphereMat = new THREE.MeshBasicMaterial({ color });
    const sphere = new THREE.Mesh(sphereGeo, sphereMat);
    sphere.frustumCulled = false;
    group.add(sphere);

    // Additive glow sprite
    const glowScale = radius * 4;
    const glowMat = new THREE.SpriteMaterial({
      map: this._getGlowTexture(),
      color,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });
    const glow = new THREE.Sprite(glowMat);
    glow.scale.set(glowScale, glowScale, 1);
    group.add(glow);

    return { group, sphere, sphereGeo, sphereMat, glow, glowMat, glowScale };
  }

  /** Shared radial gradient glow texture (created once, cached on class). */
  _getGlowTexture() {
    if (Nebula._glowTexture) return Nebula._glowTexture;
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const cx = size / 2;
    const gradient = ctx.createRadialGradient(cx, cx, 0, cx, cx, cx);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
    gradient.addColorStop(0.15, 'rgba(255, 255, 255, 0.5)');
    gradient.addColorStop(0.35, 'rgba(255, 255, 255, 0.15)');
    gradient.addColorStop(0.6, 'rgba(255, 255, 255, 0.04)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    Nebula._glowTexture = new THREE.CanvasTexture(canvas);
    Nebula._glowTexture.magFilter = THREE.NearestFilter;
    return Nebula._glowTexture;
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
    // Scale central star glow to stay visible at distance
    if (this._centralStar && camera) {
      const cs = this._centralStar;
      const dist = camera.position.distanceTo(this.mesh.position);
      const minAngularSize = 0.012;
      const distScale = dist * minAngularSize;
      const scale = Math.max(cs.glowScale, distScale);
      cs.glow.scale.set(scale, scale, 1);
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
      const cs = this._centralStar;
      cs.sphereGeo.dispose();
      cs.sphereMat.dispose();
      cs.glowMat.dispose();
      // Don't dispose the shared glow texture
    }
  }
}
