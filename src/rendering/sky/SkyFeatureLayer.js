import * as THREE from 'three';

/**
 * SkyFeatureLayer — renders nearby galactic features as sky overlays.
 *
 * Queries GalacticMap for features near the player's position and renders
 * them as billboards / point groups in the sky. Each feature type has
 * a distinct visual treatment:
 *
 *   emission-nebula:   FBM noise billboard, H-alpha red + OIII teal, additive
 *   dark-nebula:       absorption billboard, dims glow + stars behind it
 *   open-cluster:      bright blue-white star points
 *   ob-association:    scattered bright blue-white points (larger spread)
 *   globular-cluster:  compact warm glow billboard
 *   supernova-remnant: ring-shaped billboard, green emission
 *
 * Features are positioned on the sky sphere based on their real galactic
 * position relative to the player. Angular size comes from physical size ÷ distance.
 */

// Max features to render at once (performance budget)
const MAX_FEATURES = 16;
// Sky sphere radius for feature placement (between glow and starfield)
const FEATURE_RADIUS = 499.5;
// Search radius for features (kpc) — features beyond this are too dim to see
const SEARCH_RADIUS = 3.0;

export class SkyFeatureLayer {
  /**
   * @param {{ min: number, max: number }} brightnessRange — output brightness limits
   */
  constructor(brightnessRange) {
    this._brightnessRange = brightnessRange;
    this._group = new THREE.Group();

    // Active feature meshes (disposed + recreated on position change)
    this._meshes = [];

    // Ambient tint when inside a feature (blended in composite shader later)
    this.ambientTint = null; // { r, g, b, strength } or null
  }

  get mesh() {
    return this._group;
  }

  /**
   * Update features for a new player position.
   * @param {Array} features — from GalacticMap.findNearbyFeatures()
   * @param {{ x: number, y: number, z: number }} playerPos — galactic position
   */
  setFeatures(features, playerPos) {
    this._clear();
    this.ambientTint = null;

    if (!features || features.length === 0) return;

    // Sort by angular size (biggest first) and take top N
    const scored = features
      .map(f => {
        const dist = Math.max(f.distance, 0.001); // prevent division by zero
        const angularRadius = f.radius / dist; // radians
        return { ...f, angularRadius, dist };
      })
      .sort((a, b) => b.angularRadius - a.angularRadius)
      .slice(0, MAX_FEATURES);

    for (const feature of scored) {
      // Skip features we're inside — don't render as a distant billboard.
      // The ambient tint handles the "you're inside this" indication.
      // Future: immersive mode wraps the feature around you instead.
      if (feature.insideFeature) {
        this.ambientTint = {
          r: feature.color[0],
          g: feature.color[1],
          b: feature.color[2],
          strength: 0.15,
        };
        continue;
      }

      // Direction from player to feature (in galactic coords → sky direction)
      const dx = feature.position.x - playerPos.x;
      const dy = feature.position.y - playerPos.y;
      const dz = feature.position.z - playerPos.z;
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (len < 0.0001) continue;

      const dirX = dx / len;
      const dirY = dy / len;
      const dirZ = dz / len;

      // Position on sky sphere
      const skyPos = new THREE.Vector3(
        dirX * FEATURE_RADIUS,
        dirY * FEATURE_RADIUS,
        dirZ * FEATURE_RADIUS
      );

      // Angular size → billboard size on sky sphere
      // At FEATURE_RADIUS=499.5, 1 radian = 499.5 units
      const skySize = Math.max(
        feature.angularRadius * FEATURE_RADIUS * 2,
        2.0 // minimum size so tiny features are still visible
      );

      // Distance-based brightness falloff
      const distFade = Math.min(1.0, 1.0 / (feature.dist * 2));
      const brightness = distFade * this._brightnessRange.max;

      const mesh = this._createFeatureMesh(feature, skyPos, skySize, brightness);
      if (mesh) {
        this._group.add(mesh);
        this._meshes.push(mesh);
      }
    }
  }

  _createFeatureMesh(feature, position, size, brightness) {
    switch (feature.type) {
      case 'emission-nebula':
        return this._createNebulaBillboard(feature, position, size, brightness, false);
      case 'dark-nebula':
        return this._createDarkNebulaBillboard(feature, position, size, brightness);
      case 'open-cluster':
      case 'ob-association':
        return this._createClusterPoints(feature, position, size, brightness);
      case 'globular-cluster':
        return this._createGlobularBillboard(feature, position, size, brightness);
      case 'supernova-remnant':
        return this._createRemnantBillboard(feature, position, size, brightness);
      default:
        return null;
    }
  }

  /**
   * Emission nebula — FBM noise billboard with H-alpha + OIII colors.
   */
  _createNebulaBillboard(feature, position, size, brightness) {
    const geo = new THREE.PlaneGeometry(size, size);
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: {
        uColor: { value: new THREE.Vector3(feature.color[0], feature.color[1], feature.color[2]) },
        uBrightness: { value: brightness },
        uSeed: { value: this._hashSeed(feature.seed) },
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
        uniform float uBrightness;
        uniform float uSeed;
        varying vec2 vUv;

        // Simple hash-based noise
        float hash(vec2 p) {
          p = fract(p * vec2(123.34, 456.21));
          p += dot(p, p + 45.32);
          return fract(p.x * p.y);
        }
        float noise(vec2 p) {
          vec2 i = floor(p); vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          float a = hash(i); float b = hash(i + vec2(1,0));
          float c = hash(i + vec2(0,1)); float d = hash(i + vec2(1,1));
          return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);
        }
        float fbm(vec2 p) {
          float v = 0.0, a = 0.5;
          for (int i = 0; i < 4; i++) {
            v += a * noise(p);
            p *= 2.1; a *= 0.5;
          }
          return v;
        }

        // 4x4 Bayer dithering
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
          vec2 centered = vUv - 0.5;
          float dist = length(centered);
          // Circular falloff
          float falloff = 1.0 - smoothstep(0.2, 0.5, dist);
          if (falloff < 0.01) discard;

          // FBM noise for nebula structure
          vec2 noiseCoord = centered * 4.0 + vec2(uSeed, uSeed * 0.7);
          float n = fbm(noiseCoord);
          // Domain warp for organic shapes
          vec2 warp = vec2(fbm(noiseCoord + 1.3), fbm(noiseCoord + 2.7));
          n = fbm(noiseCoord + warp * 0.8);

          float density = n * falloff;

          // Dither (chunky to match retro pixel grid)
          float threshold = bayerDither(floor(gl_FragCoord.xy / 3.0));
          if (density < threshold * 0.8) discard;

          // Color: blend between primary and secondary (OIII teal for emission nebulae)
          vec3 oiiiColor = vec3(0.2, 0.7, 0.6);
          float colorMix = smoothstep(0.3, 0.7, n);
          vec3 col = mix(uColor, oiiiColor, colorMix * 0.4);

          gl_FragColor = vec4(col * uBrightness * density, 1.0);
        }
      `,
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(position);
    // Billboard: face the origin (camera is always at sky sphere center)
    mesh.lookAt(0, 0, 0);
    return mesh;
  }

  /**
   * Dark nebula — absorption patch that dims things behind it.
   * Uses subtractive blending effect via a semi-opaque dark billboard.
   */
  _createDarkNebulaBillboard(feature, position, size, brightness) {
    const geo = new THREE.PlaneGeometry(size, size);
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: false,
      // Normal blending with alpha — will darken what's behind it
      blending: THREE.NormalBlending,
      side: THREE.DoubleSide,
      uniforms: {
        uSeed: { value: this._hashSeed(feature.seed) },
        uOpacity: { value: Math.min(0.7, brightness * 3) }, // how much it absorbs
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uSeed;
        uniform float uOpacity;
        varying vec2 vUv;

        float hash(vec2 p) {
          p = fract(p * vec2(123.34, 456.21));
          p += dot(p, p + 45.32);
          return fract(p.x * p.y);
        }
        float noise(vec2 p) {
          vec2 i = floor(p); vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          float a = hash(i); float b = hash(i + vec2(1,0));
          float c = hash(i + vec2(0,1)); float d = hash(i + vec2(1,1));
          return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);
        }
        float fbm(vec2 p) {
          float v = 0.0, a = 0.5;
          for (int i = 0; i < 4; i++) {
            v += a * noise(p);
            p *= 2.1; a *= 0.5;
          }
          return v;
        }

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
          vec2 centered = vUv - 0.5;
          float dist = length(centered);
          float falloff = 1.0 - smoothstep(0.15, 0.45, dist);
          if (falloff < 0.01) discard;

          vec2 noiseCoord = centered * 3.0 + vec2(uSeed, uSeed * 0.7);
          float n = fbm(noiseCoord);
          float density = n * falloff;

          float threshold = bayerDither(floor(gl_FragCoord.xy / 3.0));
          if (density < threshold) discard;

          // Output dark pixels with alpha — absorbs light behind
          float alpha = density * uOpacity;
          gl_FragColor = vec4(0.02, 0.015, 0.01, alpha);
        }
      `,
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(position);
    mesh.lookAt(0, 0, 0);
    return mesh;
  }

  /**
   * Open cluster / OB association — bright star points.
   */
  _createClusterPoints(feature, position, size, brightness) {
    const isOB = feature.type === 'ob-association';
    const count = isOB ? 15 : 30;
    const spread = size * 0.3;

    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);

    const seedHash = this._hashSeed(feature.seed);
    for (let i = 0; i < count; i++) {
      // Seeded pseudo-random scatter
      const fx = this._seededRand(seedHash + i * 3.1) - 0.5;
      const fy = this._seededRand(seedHash + i * 7.3) - 0.5;
      const fz = this._seededRand(seedHash + i * 11.7) - 0.5;
      positions[i * 3] = position.x + fx * spread;
      positions[i * 3 + 1] = position.y + fy * spread;
      positions[i * 3 + 2] = position.z + fz * spread;

      // Blue-white color with slight variation
      const warm = this._seededRand(seedHash + i * 13.1);
      colors[i * 3] = feature.color[0] + warm * 0.2;
      colors[i * 3 + 1] = feature.color[1] + warm * 0.1;
      colors[i * 3 + 2] = feature.color[2];

      sizes[i] = (this._seededRand(seedHash + i * 17.9) < 0.1 ? 8 : 5) * brightness * 3;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));

    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: false,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uBrightness: { value: brightness },
      },
      vertexShader: /* glsl */ `
        attribute float aSize;
        varying vec3 vColor;
        void main() {
          vColor = color;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = max(2.0, aSize);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uBrightness;
        varying vec3 vColor;
        void main() {
          float dist = length(gl_PointCoord - 0.5);
          if (dist > 0.5) discard;
          float glow = 1.0 - smoothstep(0.0, 0.5, dist);
          gl_FragColor = vec4(vColor * uBrightness * glow, 1.0);
        }
      `,
    });

    return new THREE.Points(geo, mat);
  }

  /**
   * Globular cluster — compact warm glow billboard.
   */
  _createGlobularBillboard(feature, position, size, brightness) {
    const geo = new THREE.PlaneGeometry(size, size);
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: {
        uColor: { value: new THREE.Vector3(feature.color[0], feature.color[1], feature.color[2]) },
        uBrightness: { value: brightness },
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
        uniform float uBrightness;
        varying vec2 vUv;

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
          vec2 centered = vUv - 0.5;
          float dist = length(centered);

          // Compact radial falloff (King profile approximation)
          float core = exp(-dist * dist / 0.01);  // bright core
          float halo = exp(-dist * dist / 0.06);   // diffuse halo
          float density = core * 0.6 + halo * 0.4;

          float falloff = 1.0 - smoothstep(0.35, 0.5, dist);
          density *= falloff;

          float threshold = bayerDither(floor(gl_FragCoord.xy / 3.0));
          if (density < threshold * 0.6) discard;

          gl_FragColor = vec4(uColor * uBrightness * density, 1.0);
        }
      `,
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(position);
    mesh.lookAt(0, 0, 0);
    return mesh;
  }

  /**
   * Supernova remnant — ring-shaped billboard with green emission.
   */
  _createRemnantBillboard(feature, position, size, brightness) {
    const geo = new THREE.PlaneGeometry(size, size);
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: {
        uColor: { value: new THREE.Vector3(feature.color[0], feature.color[1], feature.color[2]) },
        uBrightness: { value: brightness },
        uSeed: { value: this._hashSeed(feature.seed) },
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
        uniform float uBrightness;
        uniform float uSeed;
        varying vec2 vUv;

        float hash(vec2 p) {
          p = fract(p * vec2(123.34, 456.21));
          p += dot(p, p + 45.32);
          return fract(p.x * p.y);
        }
        float noise(vec2 p) {
          vec2 i = floor(p); vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          float a = hash(i); float b = hash(i + vec2(1,0));
          float c = hash(i + vec2(0,1)); float d = hash(i + vec2(1,1));
          return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);
        }

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
          vec2 centered = vUv - 0.5;
          float dist = length(centered);

          // Ring shape
          float ringRadius = 0.3;
          float ringWidth = 0.08;
          float ring = exp(-pow(dist - ringRadius, 2.0) / (2.0 * ringWidth * ringWidth));

          // Noise for filamentary structure
          float angle = atan(centered.y, centered.x);
          float n = noise(vec2(angle * 3.0 + uSeed, dist * 8.0));
          ring *= 0.5 + 0.5 * n;

          float threshold = bayerDither(floor(gl_FragCoord.xy / 3.0));
          if (ring < threshold * 0.5) discard;

          gl_FragColor = vec4(uColor * uBrightness * ring, 1.0);
        }
      `,
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(position);
    mesh.lookAt(0, 0, 0);
    return mesh;
  }

  // ── Utility ──

  _hashSeed(seedStr) {
    let h = 0;
    for (let i = 0; i < seedStr.length; i++) {
      h = ((h << 5) - h + seedStr.charCodeAt(i)) | 0;
    }
    return (h >>> 0) / 4294967295;
  }

  _seededRand(n) {
    return (Math.sin(n * 127.1 + 311.7) * 43758.5453) % 1;
  }

  update(cameraPosition) {
    // Billboard facing: sky features are on the sky sphere, which
    // follows the camera. Each billboard was set to lookAt(0,0,0)
    // at creation time (relative to sky sphere center = camera pos).
    // Moving the group with the camera keeps them positioned correctly.
    this._group.position.copy(cameraPosition);
  }

  _clear() {
    for (const m of this._meshes) {
      this._group.remove(m);
      m.geometry.dispose();
      m.material.dispose();
    }
    this._meshes = [];
  }

  dispose() {
    this._clear();
  }
}
