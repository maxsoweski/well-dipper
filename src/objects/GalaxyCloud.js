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
          uDustStrength: { value: 0.5 },
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
          uniform float uDustStrength;
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

          // ── Dust lane density (inner trailing edge of arms) ──
          float dustLane(float R, float theta) {
            if (R < 3.0) return 0.0; // no dust near core
            float sinP = sin(atan(1.0 / uPitchK));
            float best = 0.0;
            for (int i = 0; i < 8; i++) {
              if (i >= uNumArms) break;
              // Offset inward from arm center (trailing edge)
              float expected = uArmOffsets[i] + uPitchK * log(R / 4.0) - 0.08;
              float dt = mod(theta - expected + 3.14159, 6.28318) - 3.14159;
              float dist = abs(dt) * R * sinP;
              // Narrower than arm — dust is concentrated
              float w = uArmWidths[i] * 0.35;
              float g = exp(-0.5 * pow(dist / w, 2.0));
              best = max(best, g * uArmStrengths[i]);
            }
            return best;
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

          void main() {
            float wx = vWorldPos.x;
            float wz = vWorldPos.z;
            float R = length(vec2(wx, wz));
            float theta = atan(wz, wx);

            // Galaxy boundary
            float edgeFade = 1.0 - smoothstep(uRadius * 0.8, uRadius, R);
            if (edgeFade < 0.01) discard;

            // ── Galaxy structure (used as a MASK, not as the shape) ──
            float disk = diskDensity(R);
            float arm = armDensity(R, theta);
            float bar = barDensity(R, theta);
            float armBlend = smoothstep(0.5, 2.0, R);

            // How much cloud is ALLOWED here (0 = no cloud, 1 = full cloud possible)
            // Arms allow lots of cloud, inter-arm allows very little
            float armPermit = (0.05 + arm * 1.5) * armBlend + (1.0 - armBlend);
            float barPermit = bar;
            float permit = min(1.0, (armPermit + barPermit) * disk * 3.0) * edgeFade;

            // Bulge: always permitted (bright core)
            float corePermit = smoothstep(3.0, 0.3, R);
            permit = max(permit, corePermit * disk * 2.0);

            if (permit < 0.01) discard;

            // ── Domain-warped FBM — THE shape (same recipe as Nebula.js) ──
            vec2 noiseP = vec2(wx, wz) * uNoiseScale / uRadius + uNoiseSeed;

            // Strong domain warping → billowing, organic swirls
            vec2 q = vec2(
              fbm(noiseP + uTime * 0.008),
              fbm(noiseP + vec2(5.2, 1.3) + uTime * 0.006)
            );
            float warped = fbm(noiseP + 3.5 * q);

            // Cloud shape from noise — same smoothstep as Nebula.js
            // permit controls the threshold: high permit = low threshold = more cloud
            float lo = 0.15 + (1.0 - permit) * 0.4;
            float hi = lo + 0.4;
            float cloud = smoothstep(lo, hi, warped);

            if (cloud < 0.01) discard;

            // ── Dust lane shadows ──
            if (uDustStrength > 0.0 && R > 3.0) {
              float dust = dustLane(R, theta);
              vec2 dustP = vec2(wx, wz) * 1.8 / uRadius + uNoiseSeed * 1.7 + 77.0;
              vec2 dq = vec2(
                fbm(dustP + vec2(3.1, 7.2)),
                fbm(dustP + vec2(8.4, 2.8))
              );
              float dustWarped = fbm(dustP + 3.0 * dq);
              float dustShape = smoothstep(0.2, 0.5, dustWarped);
              cloud *= 1.0 - min(dust * dustShape * uDustStrength, 0.85);
            }

            // ── Alpha: cloud shape × permit envelope × opacity ──
            float alpha = cloud * permit * uOpacity;
            if (alpha < 0.003) discard;

            // ── Color ──
            vec3 bulgeCol = vec3(1.0, 0.82, 0.5);
            vec3 armCol = vec3(0.7, 0.8, 1.0);
            vec3 diskCol = vec3(0.9, 0.85, 0.75);
            float bf = smoothstep(2.5, 0.0, R);
            vec3 col = mix(
              mix(diskCol, armCol, smoothstep(0.2, 0.7, arm * armBlend)),
              bulgeCol,
              bf
            );

            gl_FragColor = vec4(col * alpha, alpha);
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

  setDustStrength(val) {
    for (const layer of this._layers) {
      layer.material.uniforms.uDustStrength.value = val;
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
