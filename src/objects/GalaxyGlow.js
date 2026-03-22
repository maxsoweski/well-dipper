import * as THREE from 'three';

/**
 * GalaxyGlow — full-sky analytical galaxy glow on a BackSide sphere.
 *
 * Renders the unresolved billions of stars as a diffuse glow behind the
 * point-star starfield. Uses the same density model as GalacticMap
 * (exponential disk + bulge + spiral arms) but computed entirely in the
 * fragment shader via ray integration along each view direction.
 *
 * IMPORTANT: This is a DISPLAY layer. It does not define galaxy structure.
 * All arm data (offsets, widths, strengths) comes from GalacticMap via
 * uniforms. GalacticMap is the single source of truth for galaxy structure.
 *
 * Key design:
 * - BackSide IcosahedronGeometry (detail 4) = sky dome that surrounds camera
 * - Analytical density model replicated in GLSL (matches GalacticMap.js)
 * - Per-arm width and strength from GalacticMap (2 major + 4 minor)
 * - Feature Plummer integration: nearby clusters/features brighten the glow
 * - Retro styling: chunky 3x Bayer dithering, posterized color bands
 * - Sin-based smooth noise for dust lanes (no hash grid artifacts)
 * - Brightness capped to always read dimmer than point stars
 *
 * Renders in the starfieldScene at full resolution, behind Starfield points.
 */
export class GalaxyGlow {
  /**
   * @param {number} radius - sky sphere radius (should be < starfield radius)
   * @param {object} [options] - configuration
   * @param {object} [options.playerPos] - {x,y,z} galactic position in kpc
   * @param {object} [options.galacticMap] - GalacticMap instance (source of truth for arms)
   * @param {Array}  [options.features] - nearby features [{x,y,z,type,radius,brightness}]
   */
  constructor(radius = 490, options = {}) {
    this.radius = radius;

    // Player galactic position (defaults to solar neighborhood)
    const pos = options.playerPos || { x: 8.0, y: 0.025, z: 0.0 };
    const gm = options.galacticMap;

    // ── Arm data from GalacticMap (single source of truth) ──
    // If no galacticMap provided, fall back to 4 equal arms (legacy/title screen)
    const MAX_ARMS = 8; // shader array size
    const armOffsets = new Array(MAX_ARMS).fill(0);
    const armWidths = new Array(MAX_ARMS).fill(0.6);
    const armStrengths = new Array(MAX_ARMS).fill(0);
    let armCount = 0;
    let pitchK = 1.0 / Math.tan(12 * Math.PI / 180);

    if (gm && gm.arms) {
      armCount = Math.min(gm.arms.length, MAX_ARMS);
      for (let i = 0; i < armCount; i++) {
        armOffsets[i] = gm.armOffsets[i];
        armWidths[i] = gm.armWidths[i];
        armStrengths[i] = gm.armStrengths[i];
      }
      pitchK = gm.pitchK;
    } else {
      // Legacy fallback: 4 equal arms
      armCount = 4;
      for (let i = 0; i < 4; i++) {
        armOffsets[i] = i * Math.PI / 2;
        armWidths[i] = 0.6;
        armStrengths[i] = 1.0;
      }
    }

    // Feature data for Plummer glow contributions
    const featureUniforms = this._packFeatures(options.features || [], pos);

    // Build the sky sphere
    const geometry = new THREE.IcosahedronGeometry(radius, 4);
    const material = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,

      uniforms: {
        uPlayerPos: { value: new THREE.Vector3(pos.x, pos.y, pos.z) },
        // Arm data — fed from GalacticMap, not defined here
        uArmOffsets: { value: armOffsets },
        uArmWidths: { value: armWidths },
        uArmStrengths: { value: armStrengths },
        uArmCount: { value: armCount },
        uPitchK: { value: pitchK },
        // Feature Plummer contributions (up to 8 features)
        uFeatureCount: { value: featureUniforms.count },
        uFeatureDirs: { value: featureUniforms.dirs },
        uFeatureParams: { value: featureUniforms.params },
        // Global controls
        uGlowIntensity: { value: 0.18 },
        uDustStrength: { value: 0.35 },
      },

      vertexShader: /* glsl */ `
        varying vec3 vWorldDir;
        void main() {
          vWorldDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,

      fragmentShader: /* glsl */ `
        #define PI 3.14159265359
        #define MAX_ARMS 8
        #define SIN_PITCH 0.2079

        uniform vec3 uPlayerPos;
        uniform float uArmOffsets[MAX_ARMS];
        uniform float uArmWidths[MAX_ARMS];
        uniform float uArmStrengths[MAX_ARMS];
        uniform int uArmCount;
        uniform float uPitchK;
        uniform int uFeatureCount;
        uniform vec2 uFeatureDirs[8];
        uniform vec2 uFeatureParams[8];
        uniform float uGlowIntensity;
        uniform float uDustStrength;

        varying vec3 vWorldDir;

        // ═══════════════════════════════════════════════════
        // Galaxy density model (matches GalacticMap.js)
        // ═══════════════════════════════════════════════════

        float galaxyDensity(float R, float z) {
          float absZ = abs(z);
          float thin = exp(-R / 2.6) * exp(-absZ / 0.3);
          float thick = 0.12 * exp(-R / 3.6) * exp(-absZ / 0.9);
          float rBulge = sqrt(R * R + (z / 0.5) * (z / 0.5));
          float bulge = 2.0 * exp(-rBulge / 0.5);
          float rHalo = sqrt(R * R + z * z);
          float halo = 0.005 * pow(max(rHalo, 2.0) / 8.0, -3.5);
          return thin + thick + bulge + halo;
        }

        // Spiral arm strength — reads per-arm width and strength from
        // GalacticMap uniforms. Mirrors GalacticMap.spiralArmStrength().
        float spiralArms(float R, float theta) {
          if (R < 0.5) return 0.0;

          float logR = log(R / 4.0);
          float maxStr = 0.0;

          for (int arm = 0; arm < MAX_ARMS; arm++) {
            if (arm >= uArmCount) break;

            float expectedTheta = uArmOffsets[arm] + uPitchK * logR;
            float dTheta = mod(theta - expectedTheta + 3.0 * PI, 2.0 * PI) - PI;
            // Perpendicular distance (sin(pitch) correction)
            float dist = abs(dTheta) * R * SIN_PITCH;
            // Per-arm Gaussian width from GalacticMap
            float armWidth = uArmWidths[arm];
            float strength = exp(-0.5 * (dist / armWidth) * (dist / armWidth));
            // Per-arm density strength from GalacticMap
            strength *= uArmStrengths[arm];

            maxStr = max(maxStr, strength);
          }
          return maxStr;
        }

        // ═══════════════════════════════════════════════════
        // Smooth noise for dust lanes (sin-based, no hash grid)
        // ═══════════════════════════════════════════════════

        float smoothNoise(vec2 p) {
          float n = sin(p.x * 1.7 + p.y * 2.3) * 0.5
                  + sin(p.x * 3.1 - p.y * 1.9) * 0.25
                  + sin(p.x * 5.7 + p.y * 4.3 + 1.7) * 0.125
                  + sin(p.x * 11.3 - p.y * 8.7 + 3.1) * 0.0625;
          return n * 0.5 + 0.5;
        }

        float dustLanes(float R, float theta, float z) {
          float zFade = exp(-abs(z) / 0.15);
          float n = smoothNoise(vec2(R * 2.0 + theta * 0.5, theta * 3.0 + R));
          float armStr = spiralArms(R, theta);
          float armEdge = armStr * (1.0 - armStr) * 4.0;
          float dustAmount = (0.3 + armEdge * 0.7) * n * zFade;
          float rFade = smoothstep(1.5, 3.0, R) * (1.0 - smoothstep(10.0, 14.0, R));
          return dustAmount * rFade * uDustStrength;
        }

        // ═══════════════════════════════════════════════════
        // Retro styling: Bayer dither + posterization
        // ═══════════════════════════════════════════════════

        float bayerDither4x4(vec2 coord) {
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

        vec3 posterize(vec3 col, float levels) {
          return floor(col * levels + 0.5) / levels;
        }

        // ═══════════════════════════════════════════════════
        // Feature Plummer glow (globular clusters, etc.)
        // ═══════════════════════════════════════════════════

        float featureGlow(vec3 viewDir) {
          float totalGlow = 0.0;
          for (int i = 0; i < 8; i++) {
            if (i >= uFeatureCount) break;
            float fTheta = uFeatureDirs[i].x;
            float fPhi = uFeatureDirs[i].y;
            float angRadius = uFeatureParams[i].x;
            float brightness = uFeatureParams[i].y;

            vec3 featureDir = vec3(
              sin(fPhi) * cos(fTheta),
              cos(fPhi),
              sin(fPhi) * sin(fTheta)
            );
            float cosAngle = dot(viewDir, featureDir);
            float angle = acos(clamp(cosAngle, -1.0, 1.0));

            // Plummer profile: I(r) = I0 / (1 + (r/a)^2)^2
            float ra = angle / max(angRadius, 0.001);
            float plummer = 1.0 / ((1.0 + ra * ra) * (1.0 + ra * ra));
            totalGlow += plummer * brightness;
          }
          return totalGlow;
        }

        // ═══════════════════════════════════════════════════
        // Main: ray-integrated galaxy glow
        // ═══════════════════════════════════════════════════

        void main() {
          vec3 dir = normalize(vWorldDir);

          // ── Ray integration along view direction ──
          float totalLight = 0.0;
          float totalDust = 0.0;
          float centerBrightness = 0.0;

          for (int s = 0; s < 6; s++) {
            float d = s == 0 ? 0.3 : s == 1 ? 0.8 : s == 2 ? 1.5 :
                      s == 3 ? 3.0 : s == 4 ? 6.0 : 12.0;
            float w = s == 0 ? 1.0 : s == 1 ? 0.7 : s == 2 ? 0.45 :
                      s == 3 ? 0.25 : s == 4 ? 0.12 : 0.05;

            vec3 samplePos = uPlayerPos + dir * d;
            float R = length(vec2(samplePos.x, samplePos.z));
            float z = samplePos.y;
            float theta = atan(samplePos.z, samplePos.x);

            if (R < 20.0 && abs(z) < 10.0) {
              float baseDensity = galaxyDensity(R, z);
              float armStr = spiralArms(R, theta);
              float density = baseDensity * (1.0 + armStr * 1.8);

              totalDust += dustLanes(R, theta, z) * w;
              totalLight += density * w;

              if (R < 2.0) centerBrightness += density * w * 0.5;
            }
          }

          // Apply dust absorption (Beer-Lambert)
          float transmission = exp(-totalDust * 2.0);
          totalLight *= transmission;

          // ── Normalize and shape ──
          float glowBrightness = totalLight * uGlowIntensity;

          // Soft cap with sqrt compression above threshold
          float capThreshold = 0.25;
          if (glowBrightness > capThreshold) {
            glowBrightness = capThreshold + sqrt(glowBrightness - capThreshold) * 0.15;
          }

          // ── Feature glow (Plummer contribution) ──
          float fGlow = featureGlow(dir);
          glowBrightness += fGlow * 0.12;

          // Hard max: glow should never exceed ~0.35 to preserve star hierarchy
          glowBrightness = min(glowBrightness, 0.35);

          // ── Color ──
          float warmth = centerBrightness / max(totalLight * uGlowIntensity, 0.001);
          warmth = clamp(warmth, 0.0, 1.0);

          vec3 warmColor = vec3(0.45, 0.35, 0.18);  // bulge gold
          vec3 coolColor = vec3(0.30, 0.30, 0.32);   // disk blue-white
          vec3 baseColor = mix(coolColor, warmColor, warmth);

          // Feature glow: slightly brighter and warmer
          if (fGlow > 0.01) {
            vec3 featureColor = vec3(0.40, 0.35, 0.25);
            float featureMix = clamp(fGlow * 3.0, 0.0, 0.5);
            baseColor = mix(baseColor, featureColor, featureMix);
          }

          // ── Retro styling ──
          vec2 chunkyCoord = floor(gl_FragCoord.xy / 3.0);
          vec3 color = baseColor * glowBrightness;
          color = posterize(color, 8.0);

          float dither = bayerDither4x4(chunkyCoord);
          float alpha = glowBrightness;

          // Smooth fade at edges instead of hard discard
          float edgeAlpha = smoothstep(0.0, 0.15, alpha);
          if (edgeAlpha < 0.01) discard;

          gl_FragColor = vec4(color, edgeAlpha);
        }
      `,
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.renderOrder = -1;
  }

  /**
   * Pack nearby feature data into uniform-friendly arrays.
   */
  _packFeatures(features, playerPos) {
    const MAX_FEATURES = 8;
    const dirs = [];
    const params = [];
    let count = 0;

    for (let i = 0; i < Math.min(features.length, MAX_FEATURES); i++) {
      const f = features[i];
      const dx = f.x - playerPos.x;
      const dy = f.y - playerPos.y;
      const dz = f.z - playerPos.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist < 0.001) continue;

      const theta = Math.atan2(dz, dx);
      const phi = Math.acos(Math.max(-1, Math.min(1, dy / dist)));
      const featureRadius = f.radius || 0.1;
      const angularRadius = Math.atan(featureRadius / dist);
      const brightness = (f.brightness || 1.0) * Math.min(1.0, 0.5 / dist);

      dirs.push(new THREE.Vector2(theta, phi));
      params.push(new THREE.Vector2(angularRadius, brightness));
      count++;
    }

    while (dirs.length < MAX_FEATURES) {
      dirs.push(new THREE.Vector2(0, 0));
      params.push(new THREE.Vector2(0, 0));
    }

    return { count, dirs, params };
  }

  /**
   * Update the glow sphere to follow the camera.
   */
  update(cameraPosition, camera) {
    this.mesh.position.copy(cameraPosition);
  }

  /**
   * Update player position, arm data, and features (called on warp arrival).
   * @param {object} playerPos - {x,y,z} galactic position in kpc
   * @param {object} [galacticMap] - GalacticMap instance for arm data
   * @param {Array} [features] - nearby features for Plummer glow
   */
  setGalacticPosition(playerPos, galacticMap, features) {
    const u = this.mesh.material.uniforms;
    u.uPlayerPos.value.set(playerPos.x, playerPos.y, playerPos.z);

    if (galacticMap && galacticMap.arms) {
      const max = 8;
      for (let i = 0; i < Math.min(galacticMap.arms.length, max); i++) {
        u.uArmOffsets.value[i] = galacticMap.armOffsets[i];
        u.uArmWidths.value[i] = galacticMap.armWidths[i];
        u.uArmStrengths.value[i] = galacticMap.armStrengths[i];
      }
      u.uArmCount.value = Math.min(galacticMap.arms.length, max);
      u.uPitchK.value = galacticMap.pitchK;
    }

    if (features) {
      const packed = this._packFeatures(features, playerPos);
      u.uFeatureCount.value = packed.count;
      u.uFeatureDirs.value = packed.dirs;
      u.uFeatureParams.value = packed.params;
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
