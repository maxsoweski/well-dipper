import * as THREE from 'three';

/**
 * GalaxyCloud — renders the galaxy as layered transparent cloud planes.
 *
 * Same technique as Nebula.js: overlapping PlaneGeometry with domain-warped
 * FBM noise shaders + additive blending. But instead of random cloud shapes,
 * the shader computes spiral arm density from GalacticMap's model to drive
 * WHERE clouds form. Arms become bright, textured clouds; inter-arm regions
 * become transparent voids.
 *
 * The density model (arm positions, pitch angle, widths) is passed as uniforms.
 * The shader does the same spiral math as GalacticMap.spiralArmStrength().
 *
 * Multiple layers at slightly different positions create parallax depth.
 * Additive blending makes overlapping regions glow brighter naturally.
 */
export class GalaxyCloud {
  /**
   * @param {Object} armData — { arms, pitchK, barAngle, barCosA, barSinA }
   * @param {Object} [options]
   * @param {number} [options.radius=15] — galaxy radius in kpc
   * @param {number} [options.layerCount=7] — number of cloud layers
   * @param {number} [options.opacity=0.35] — per-layer opacity
   */
  constructor(armData, options = {}) {
    const {
      radius = 15,
      layerCount = 7,
      opacity = 0.35,
    } = options;

    this.mesh = new THREE.Group();
    this._layers = [];

    // Pack arm data into uniform arrays (up to 8 arms)
    const numArms = Math.min(armData.arms.length, 8);
    const armOffsets = new Float32Array(8);
    const armWidths = new Float32Array(8);
    const armStrengths = new Float32Array(8);
    for (let i = 0; i < numArms; i++) {
      armOffsets[i] = armData.arms[i].offset;
      armWidths[i] = armData.arms[i].width;
      armStrengths[i] = armData.arms[i].densityBoost / 2.5;
    }

    const size = radius * 2.4; // plane extends slightly beyond galaxy

    for (let i = 0; i < layerCount; i++) {
      // Each layer at a slightly different Y offset for depth
      const t = layerCount === 1 ? 0.5 : i / (layerCount - 1);
      const yOffset = (t - 0.5) * 0.6; // ±0.3 kpc vertical spread

      // Vertical fade: strongest at midplane
      const vertFade = Math.exp(-8 * yOffset * yOffset);

      // Unique noise seed per layer
      const noiseSeed = new THREE.Vector2(
        Math.sin(i * 7.3 + 0.5) * 50 + 50,
        Math.cos(i * 5.1 + 1.2) * 50 + 50,
      );

      // Slightly different noise scale per layer → multi-scale texture
      const noiseScale = 2.0 + i * 0.3;

      const geometry = new THREE.PlaneGeometry(size, size);
      const material = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,

        uniforms: {
          uTime: { value: 0 },
          uOpacity: { value: opacity * vertFade },
          uNoiseScale: { value: noiseScale },
          uNoiseSeed: { value: noiseSeed },
          uRadius: { value: radius },
          uArmOffsets: { value: armOffsets },
          uArmWidths: { value: armWidths },
          uArmStrengths: { value: armStrengths },
          uNumArms: { value: numArms },
          uPitchK: { value: armData.pitchK },
          uBarAngle: { value: armData.barAngle || 0 },
          uBarLength: { value: 2.2 },
          uBarWidth: { value: 0.7 },
          // Per-component lighting: [gain, gamma, 0] packed into vec3
          uCoreLight: { value: new THREE.Vector3(1.0, 0.6, 0) },
          uBarLight: { value: new THREE.Vector3(1.5, 0.5, 0) },
          uArmsLight: { value: new THREE.Vector3(3.0, 0.45, 0) },
          uDiskLight: { value: new THREE.Vector3(2.0, 0.5, 0) },
          // Per-component colors
          uCoreColor: { value: new THREE.Color(1.0, 0.88, 0.55) },
          uBarColor: { value: new THREE.Color(1.0, 0.82, 0.50) },
          uArmsColor: { value: new THREE.Color(0.75, 0.85, 1.0) },
          uDiskColor: { value: new THREE.Color(1.0, 0.92, 0.75) },
          // Global exposure + highlight compression
          uExposure: { value: 0.5 },
          uHighlightCompress: { value: 0.8 },
        },

        vertexShader: /* glsl */ `
          varying vec2 vUv;
          varying vec3 vWorldPos;
          void main() {
            vUv = uv;
            vec4 wp = modelMatrix * vec4(position, 1.0);
            vWorldPos = wp.xyz;
            gl_Position = projectionMatrix * viewMatrix * wp;
          }
        `,

        fragmentShader: /* glsl */ `
          uniform float uTime;
          uniform float uOpacity;
          uniform float uNoiseScale;
          uniform vec2 uNoiseSeed;
          uniform float uRadius;
          uniform float uArmOffsets[8];
          uniform float uArmWidths[8];
          uniform float uArmStrengths[8];
          uniform int uNumArms;
          uniform float uPitchK;
          uniform float uBarAngle;
          uniform float uBarLength;
          uniform float uBarWidth;
          // Per-component lighting: x = gain, y = gamma
          uniform vec3 uCoreLight;
          uniform vec3 uBarLight;
          uniform vec3 uArmsLight;
          uniform vec3 uDiskLight;
          // Per-component colors
          uniform vec3 uCoreColor;
          uniform vec3 uBarColor;
          uniform vec3 uArmsColor;
          uniform vec3 uDiskColor;
          uniform float uExposure;
          uniform float uHighlightCompress;
          varying vec2 vUv;
          varying vec3 vWorldPos;

          // ── Noise (same as Nebula.js) ──
          vec2 hash22(vec2 p) {
            p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
            return fract(sin(p) * 43758.5453);
          }
          float noise(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            vec2 u = f * f * (3.0 - 2.0 * f);
            float a = dot(hash22(i + vec2(0,0)) - 0.5, f - vec2(0,0));
            float b = dot(hash22(i + vec2(1,0)) - 0.5, f - vec2(1,0));
            float c = dot(hash22(i + vec2(0,1)) - 0.5, f - vec2(0,1));
            float d = dot(hash22(i + vec2(1,1)) - 0.5, f - vec2(1,1));
            return mix(mix(a, b, u.x), mix(c, d, u.x), u.y) + 0.5;
          }
          float fbm(vec2 p) {
            float v = 0.0, a = 0.5;
            for (int i = 0; i < 5; i++) {
              v += a * noise(p);
              p *= 2.0; a *= 0.5;
            }
            return v;
          }

          // ── Spiral arm density (same math as GalacticMap.spiralArmStrength) ──
          float armDensity(float R, float theta) {
            if (R < 0.5) return 0.0;
            float sinP = sin(atan(1.0 / uPitchK));
            float best = 0.0;
            for (int i = 0; i < 8; i++) {
              if (i >= uNumArms) break;
              float expected = uArmOffsets[i] + uPitchK * log(R / 4.0);
              float dt = mod(theta - expected + 3.14159, 6.28318) - 3.14159;
              float dist = abs(dt) * R * sinP;
              float g = exp(-0.5 * pow(dist / uArmWidths[i], 2.0));
              best = max(best, g * uArmStrengths[i]);
            }
            return best;
          }

          // ── Disk density (exponential falloff) ──
          float diskDensity(float R) {
            return exp(-R / 2.6);
          }

          // ── Bar density ──
          float barDensity(float R, float theta) {
            if (R > uBarLength * 1.5) return 0.0;
            float cosA = cos(uBarAngle), sinA = sin(uBarAngle);
            float gx = R * cos(theta), gz = R * sin(theta);
            float bx = gx * cosA + gz * sinA;
            float bz = -gx * sinA + gz * cosA;
            float sx = bx / uBarLength;
            float sz = bz / uBarWidth;
            return exp(-0.5 * (sx*sx + sz*sz)) * 2.0;
          }

          // Apply per-component gain + gamma
          float compBright(float raw, vec3 light) {
            return pow(raw * light.x, light.y);
          }

          void main() {
            float wx = vWorldPos.x;
            float wz = vWorldPos.z;
            float R = length(vec2(wx, wz));
            float theta = atan(wz, wx);

            // Galaxy boundary
            float edgeFade = 1.0 - smoothstep(uRadius * 0.8, uRadius, R);
            if (edgeFade < 0.01) discard;

            // ── Galaxy structure: separate components ──
            float disk = diskDensity(R);
            float arm = armDensity(R, theta);
            float barVal = barDensity(R, theta);

            // Arms fade in from R=0.5 to R=2 (bulge region has no arms)
            float armBlend = smoothstep(0.5, 2.0, R);

            // Decompose into 4 components (same split as GalaxyLuminosityRenderer):
            // Core = disk in the bulge region (R < 2)
            float coreDensity = disk * (1.0 - armBlend);
            // Bar = bar contribution
            float barDensity = barVal * disk;
            // Arms = disk * arm strength in arm regions
            float armsDensity = disk * arm * 2.0 * armBlend;
            // Disk = remaining inter-arm disk
            float diskDensity = disk * 0.1 * armBlend;

            // Apply per-component gain + gamma (independent tone mapping)
            float coreBright = compBright(coreDensity, uCoreLight) * edgeFade;
            float barBright = compBright(barDensity, uBarLight) * edgeFade;
            float armsBright = compBright(armsDensity, uArmsLight) * edgeFade;
            float diskBright = compBright(diskDensity, uDiskLight) * edgeFade;

            // Total density for cloud coverage threshold
            float density = coreBright + barBright + armsBright + diskBright;

            // ── Domain-warped FBM (the Nebula.js magic) ──
            vec2 noiseP = vec2(wx, wz) * uNoiseScale / uRadius + uNoiseSeed;

            vec2 q = vec2(
              fbm(noiseP + vec2(0.0, 0.0) + uTime * 0.01),
              fbm(noiseP + vec2(5.2, 1.3) + uTime * 0.008)
            );
            float warped = fbm(noiseP + 3.5 * q);

            // Cloud shape: threshold scales with density
            float coverage = min(1.0, density * 2.5);
            float lo = 0.1 + (1.0 - coverage) * 0.35;
            float hi = lo + 0.3;
            float cloud = smoothstep(lo, hi, warped);

            // Bulge core stays smooth (no voids)
            float coreSmooth = smoothstep(2.0, 0.5, R);
            cloud = mix(cloud, 1.0, coreSmooth);

            // ── Per-component color compositing ──
            // Each component contributes its color * brightness * cloud
            vec3 col = uCoreColor * coreBright
                     + uBarColor * barBright
                     + uArmsColor * armsBright
                     + uDiskColor * diskBright;
            col *= cloud;

            // Apply exposure (overall brightness dial)
            col *= uExposure;

            // Highlight compression: soft-clamp bright areas using
            // Reinhard tone mapping per-channel. At compress=1.0,
            // values are fully compressed (never exceed 1.0).
            // At compress=0.0, no compression (linear, can blow out).
            vec3 compressed = col / (1.0 + col);
            col = mix(col, compressed, uHighlightCompress);

            float alpha = length(col) * cloud * uOpacity;
            if (alpha < 0.003) discard;

            gl_FragColor = vec4(col * uOpacity, alpha);
          }
        `,
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.y = yOffset;
      mesh.rotation.x = -Math.PI / 2; // lay flat on XZ plane

      this._layers.push(mesh);
      this.mesh.add(mesh);
    }
  }

  update(deltaTime) {
    for (const layer of this._layers) {
      layer.material.uniforms.uTime.value += deltaTime;
    }
  }

  setOpacity(val) {
    for (const layer of this._layers) {
      layer.material.uniforms.uOpacity.value = val;
    }
  }

  /**
   * Set per-component lighting: gain and gamma.
   * @param {string} component — 'core', 'bar', 'arms', or 'disk'
   * @param {number} gain — brightness multiplier
   * @param {number} gamma — power curve (< 1 = brighter midtones)
   */
  setComponentLight(component, gain, gamma) {
    const key = {
      core: 'uCoreLight', bar: 'uBarLight',
      arms: 'uArmsLight', disk: 'uDiskLight',
    }[component];
    if (!key) return;
    for (const layer of this._layers) {
      layer.material.uniforms[key].value.set(gain, gamma, 0);
    }
  }

  /**
   * Set per-component color.
   * @param {string} component — 'core', 'bar', 'arms', or 'disk'
   * @param {number} r — red 0-1
   * @param {number} g — green 0-1
   * @param {number} b — blue 0-1
   */
  setExposure(val) {
    for (const layer of this._layers) {
      layer.material.uniforms.uExposure.value = val;
    }
  }

  setHighlightCompress(val) {
    for (const layer of this._layers) {
      layer.material.uniforms.uHighlightCompress.value = val;
    }
  }

  setComponentColor(component, r, g, b) {
    const key = {
      core: 'uCoreColor', bar: 'uBarColor',
      arms: 'uArmsColor', disk: 'uDiskColor',
    }[component];
    if (!key) return;
    for (const layer of this._layers) {
      layer.material.uniforms[key].value.set(r, g, b);
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
