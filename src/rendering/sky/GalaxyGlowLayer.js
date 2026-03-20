import * as THREE from 'three';

/**
 * GalaxyGlowLayer — diffuse glow representing billions of unresolved stars.
 *
 * DISPLAY LAYER ONLY — does not define galaxy structure.
 * All arm data (offsets, widths, strengths) comes from GalacticMap via
 * uniforms. GalacticMap is the single source of truth.
 *
 * Features:
 * - Potential-derived density model (Miyamoto-Nagai + Hernquist + NFW)
 * - Per-arm width and strength from GalacticMap (2 major + minor arms)
 * - Sin-based smooth dust lanes (no hash grid artifacts)
 * - Feature Plummer integration (nearby clusters brighten the glow)
 * - Chunky 3x Bayer dithering, posterized color bands (retro aesthetic)
 * - Brightness-budgeted output (never overpowers starfield)
 *
 * Two rendering modes blend based on player height:
 *   FROM INSIDE: ray-march along sightlines → Milky Way band
 *   FROM ABOVE:  project to galactic plane → face-on spiral arms
 */
export class GalaxyGlowLayer {
  /**
   * @param {number} radius — sky sphere radius (should be < starfield radius)
   * @param {{ x: number, y: number, z: number }} playerPos — galactic position in kpc
   * @param {object} galacticMap — GalacticMap instance (source of truth for arms)
   * @param {{ min: number, max: number }} brightnessRange — output brightness limits
   * @param {Array} [features] — nearby features [{x,y,z,type,radius,brightness}]
   */
  constructor(radius, playerPos, galacticMap, brightnessRange, features) {
    this.radius = radius;
    this._brightnessRange = brightnessRange;

    const px = playerPos?.x ?? 8;
    const py = playerPos?.y ?? 0;
    const pz = playerPos?.z ?? 0;

    // ── Arm data from GalacticMap (single source of truth) ──
    const MAX_ARMS = 8;
    const armOffsets = new Array(MAX_ARMS).fill(0);
    const armWidths = new Array(MAX_ARMS).fill(0.6);
    const armStrengths = new Array(MAX_ARMS).fill(0);
    let armCount = 0;
    let pitchK = 1.0 / Math.tan(12 * Math.PI / 180);

    if (galacticMap && galacticMap.arms) {
      armCount = Math.min(galacticMap.arms.length, MAX_ARMS);
      for (let i = 0; i < armCount; i++) {
        armOffsets[i] = galacticMap.armOffsets[i];
        armWidths[i] = galacticMap.armWidths[i];
        armStrengths[i] = galacticMap.armStrengths[i];
      }
      pitchK = galacticMap.pitchK;
    } else {
      // Legacy fallback
      armCount = 4;
      for (let i = 0; i < 4; i++) {
        armOffsets[i] = i * Math.PI / 2;
        armWidths[i] = 0.6;
        armStrengths[i] = 1.0;
      }
    }

    // Feature Plummer data
    const featureUniforms = this._packFeatures(features || [], { x: px, y: py, z: pz });

    const geometry = new THREE.IcosahedronGeometry(radius, 16);
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,

      uniforms: {
        uPlayerPos: { value: new THREE.Vector3(px, py, pz) },
        // Per-arm data from GalacticMap
        uArmOffsets: { value: armOffsets },
        uArmWidths: { value: armWidths },
        uArmStrengths: { value: armStrengths },
        uArmCount: { value: armCount },
        uPitchK: { value: pitchK },
        // Brightness budget
        uBrightnessMax: { value: brightnessRange.max },
        uDensityNorm: { value: 1.0 },
        // Feature Plummer
        uFeatureCount: { value: featureUniforms.count },
        uFeatureDirs: { value: featureUniforms.dirs },
        uFeatureParams: { value: featureUniforms.params },
        // Dust control
        uDustStrength: { value: 0.35 },
      },

      vertexShader: /* glsl */ `
        varying vec3 vWorldDir;
        void main() {
          vWorldDir = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,

      fragmentShader: /* glsl */ `
        #define PI 3.14159265359
        #define MAX_ARMS 8
        #define SIN_PITCH 0.2079
        #define GALAXY_RADIUS 15.0

        // ── Potential model constants (must match GalacticMap.js) ──
        #define MN_A 3.0
        #define MN_B 0.28
        #define MN_GM 1.0
        #define HERNQUIST_A 0.6
        #define HERNQUIST_GM 0.50
        #define NFW_RS 12.0
        #define NFW_NORM 0.0003

        uniform vec3 uPlayerPos;
        uniform float uArmOffsets[MAX_ARMS];
        uniform float uArmWidths[MAX_ARMS];
        uniform float uArmStrengths[MAX_ARMS];
        uniform int uArmCount;
        uniform float uPitchK;
        uniform float uBrightnessMax;
        uniform float uDensityNorm;
        uniform int uFeatureCount;
        uniform vec2 uFeatureDirs[8];
        uniform vec2 uFeatureParams[8];
        uniform float uDustStrength;

        varying vec3 vWorldDir;

        // ── 4x4 Bayer dithering ──
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

        // ── Hash noise (for nebula patches in color mapping) ──
        float hash21(vec2 p) {
          p = fract(p * vec2(123.34, 456.21));
          p += dot(p, p + 45.32);
          return fract(p.x * p.y);
        }
        float hashNoise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          float a = hash21(i);
          float b = hash21(i + vec2(1.0, 0.0));
          float c = hash21(i + vec2(0.0, 1.0));
          float d = hash21(i + vec2(1.0, 1.0));
          return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }

        // ── Smooth noise for dust lanes (sin-based, no cell artifacts) ──
        float smoothNoise(vec2 p) {
          float n = sin(p.x * 1.7 + p.y * 2.3) * 0.5
                  + sin(p.x * 3.1 - p.y * 1.9) * 0.25
                  + sin(p.x * 5.7 + p.y * 4.3 + 1.7) * 0.125
                  + sin(p.x * 11.3 - p.y * 8.7 + 3.1) * 0.0625;
          return n * 0.5 + 0.5;
        }

        // ── Spiral arm strength — reads per-arm data from GalacticMap ──
        float spiralArmStrength(float R, float theta) {
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

        // ── Potential-derived density ──
        float potentialDensity(float R, float z) {
          float zb = sqrt(z * z + MN_B * MN_B);
          float azb = MN_A + zb;
          float Rsq = R * R;
          float denom1 = pow(Rsq + azb * azb, 2.5);
          float denom2 = pow(z * z + MN_B * MN_B, 1.5);
          float diskDensity = (MN_B * MN_B * MN_GM / (4.0 * PI))
            * (MN_A * Rsq + (MN_A + 3.0 * zb) * azb * azb)
            / (denom1 * denom2);

          float r = max(sqrt(Rsq + z * z), 0.01);
          float ra = r + HERNQUIST_A;
          float bulgeDensity = HERNQUIST_GM * HERNQUIST_A / (2.0 * PI * r * ra * ra * ra);

          float x = r / NFW_RS;
          float haloDensity = NFW_NORM / (x * (1.0 + x) * (1.0 + x));

          return (diskDensity + bulgeDensity + haloDensity) * uDensityNorm;
        }

        // ── Dust lanes ──
        float dustLanes(float R, float theta, float z) {
          float zFade = exp(-abs(z) / 0.15);
          float n = smoothNoise(vec2(R * 2.0 + theta * 0.5, theta * 3.0 + R));
          float armStr = spiralArmStrength(R, theta);
          float armEdge = armStr * (1.0 - armStr) * 4.0;
          float dustAmount = (0.3 + armEdge * 0.7) * n * zFade;
          float rFade = smoothstep(1.5, 3.0, R) * (1.0 - smoothstep(10.0, 14.0, R));
          return dustAmount * rFade * uDustStrength;
        }

        // ── Feature Plummer glow ──
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
            float ra = angle / max(angRadius, 0.001);
            float plummer = 1.0 / ((1.0 + ra * ra) * (1.0 + ra * ra));
            totalGlow += plummer * brightness;
          }
          return totalGlow;
        }

        // ── Surface density (face-on view from above) ──
        float surfaceDensity(float R, float theta) {
          float base = potentialDensity(R, 0.0);
          float armStr = spiralArmStrength(R, theta);
          float bulgeBlend = clamp((R - 0.5) / 1.5, 0.0, 1.0);
          float armFactor = mix(1.0, 0.10 + armStr * 2.40, bulgeBlend);
          return base * armFactor;
        }

        // ── Face-on: project to galactic plane ──
        vec2 faceOnDensityAndR(vec3 dir) {
          float py = uPlayerPos.y;
          if (abs(dir.y) < 0.01) return vec2(0.0);
          float t = -py / dir.y;
          if (t < 0.0) return vec2(0.0);
          float closeFade = smoothstep(0.0, 0.2, t);
          if (closeFade < 0.01) return vec2(0.0);
          vec3 hitPoint = uPlayerPos + dir * t;
          float R = length(hitPoint.xz);
          float edgeFade = 1.0 - smoothstep(GALAXY_RADIUS * 0.7, GALAXY_RADIUS * 1.1, R);
          if (edgeFade < 0.001) return vec2(0.0);
          float theta = atan(hitPoint.z, hitPoint.x);
          float sd = surfaceDensity(R, theta);
          float distFade = 1.0 / (t * 0.05 + 1.0);
          return vec2(sd * distFade * edgeFade * closeFade, R);
        }

        // ── Analytical band (in-disk view) ──
        vec3 analyticalBandDensity(vec3 dir) {
          vec2 planeDir = normalize(dir.xz + vec2(0.00001));

          float baseDensity = 0.0;
          float weightedR = 0.0;
          float totalWeight = 0.0;
          float totalDust = 0.0;

          for (int i = 0; i < 12; i++) {
            float fi = float(i);
            float t = 0.3 + fi * 1.2;
            vec2 sampleXZ = uPlayerPos.xz + planeDir * t;
            float R = length(sampleXZ);
            if (R > GALAXY_RADIUS * 1.1) continue;
            float edgeFade = 1.0 - smoothstep(GALAXY_RADIUS * 0.7, GALAXY_RADIUS * 1.1, R);
            float sd = potentialDensity(R, 0.0) * edgeFade;
            float w = 1.0 / (t * 0.3 + 1.0);
            baseDensity += sd * w;
            weightedR += R * sd * w;
            totalWeight += sd * w;
            // Accumulate dust along the sightline
            float theta = atan(sampleXZ.y, sampleXZ.x);
            totalDust += dustLanes(R, theta, 0.0) * w;
          }

          // Apply dust absorption (Beer-Lambert)
          float transmission = exp(-totalDust * 2.0);
          baseDensity *= transmission;

          float avgR = (totalWeight > 0.001) ? weightedR / totalWeight : length(uPlayerPos.xz);
          float armStr = 0.0;

          float sinElev = abs(dir.y);
          float diskWidth = 0.08 + smoothstep(8.0, 2.0, avgR) * 0.12;
          float diskFalloff = exp(-sinElev * sinElev / (2.0 * diskWidth * diskWidth));
          float bulgeR = length(uPlayerPos.xz);
          float bulgeStrength = smoothstep(4.0, 0.3, bulgeR);
          float bulgeFalloff = exp(-sinElev * sinElev / (2.0 * 0.8 * 0.8));
          float verticalFalloff = mix(diskFalloff, max(diskFalloff, bulgeFalloff), bulgeStrength);

          return vec3(baseDensity * verticalFalloff, avgR, armStr);
        }

        void main() {
          vec3 dir = normalize(vWorldDir);

          float absHeight = abs(uPlayerPos.y);
          float aboveBlend = smoothstep(0.8, 3.0, absHeight);

          float density = 0.0;
          float hitR = 8.0;
          float armStrAtHit = 0.0;

          if (aboveBlend > 0.01) {
            vec2 faceResult = faceOnDensityAndR(dir);
            float faceDensity = faceResult.x;
            hitR = max(faceResult.y, 0.1);
            density += (faceDensity / 2.5) * aboveBlend;
            float py = uPlayerPos.y;
            if (abs(dir.y) > 0.01) {
              float t = -py / dir.y;
              if (t > 0.0) {
                vec3 hp = uPlayerPos + dir * t;
                armStrAtHit = spiralArmStrength(length(hp.xz), atan(hp.z, hp.x));
              }
            }
          }

          if (aboveBlend < 0.99) {
            vec3 bandResult = analyticalBandDensity(dir);
            float bandDensity = bandResult.x;
            density += (bandDensity / 1.5) * (1.0 - aboveBlend);
            float bandR = bandResult.y;
            float bandArm = bandResult.z;
            hitR = mix(bandR, hitR, aboveBlend);
            armStrAtHit = mix(bandArm, armStrAtHit, aboveBlend);
          }

          // Tone mapping
          density = sqrt(clamp(density, 0.0, 1.0));
          density = min(density, 0.7);

          if (density < 0.01) discard;

          // ── Feature glow (Plummer contribution) ──
          float fGlow = featureGlow(dir);
          density += fGlow * 0.12;
          density = min(density, 0.7);

          // ── Color mapping ──
          vec3 bulgeColor = vec3(0.70, 0.58, 0.35);
          vec3 diskColor = vec3(0.45, 0.40, 0.35);
          vec3 armColor = vec3(0.40, 0.48, 0.65);
          vec3 armCoreColor = vec3(0.65, 0.62, 0.55);
          vec3 nebulaColor = vec3(0.60, 0.28, 0.35);

          float bulgeWeight = smoothstep(5.0, 0.5, hitR);
          float armBlend = armStrAtHit * smoothstep(1.5, 4.0, hitR);
          float armCoreWeight = pow(armStrAtHit, 3.0) * smoothstep(1.5, 3.0, hitR) * 0.4;
          float nebulaStrength = 0.0;
          if (armStrAtHit > 0.2) {
            float nebNoise = hashNoise(dir.xz * 6.0 + vec2(31.7, 5.3));
            nebulaStrength = smoothstep(0.4, 0.65, nebNoise) * armStrAtHit * smoothstep(1.5, 4.0, hitR) * 0.3;
          }

          // Feature glow tints slightly warmer
          if (fGlow > 0.01) {
            vec3 featureColor = vec3(0.40, 0.35, 0.25);
            float featureMix = clamp(fGlow * 3.0, 0.0, 0.5);
            diskColor = mix(diskColor, featureColor, featureMix);
          }

          vec3 baseColor = diskColor;
          baseColor = mix(baseColor, bulgeColor, bulgeWeight);
          baseColor = mix(baseColor, armColor, armBlend * 0.5);
          baseColor = mix(baseColor, armCoreColor, armCoreWeight);
          baseColor = mix(baseColor, nebulaColor, nebulaStrength);

          float bulgeBrightness = 1.0 + bulgeWeight * 3.0;

          // ── Posterize — 12 bands ──
          float numBands = 12.0;
          float band = floor(density * numBands) / numBands;
          float nextBand = min(1.0, band + 1.0 / numBands);
          float bandFrac = fract(density * numBands);

          // ── Bayer dithering (chunky 3x3 — match retro pixel grid) ──
          float threshold = bayerDither(floor(gl_FragCoord.xy / 3.0));
          float finalDensity = (bandFrac > threshold) ? nextBand : band;

          if (finalDensity < 0.02) discard;

          // ── Brightness-budgeted output ──
          float rawBrightness = finalDensity * 0.5 * bulgeBrightness;
          float brightness = rawBrightness * uBrightnessMax;
          gl_FragColor = vec4(baseColor * brightness, 1.0);
        }
      `,
    });

    this._sphere = new THREE.Mesh(geometry, material);
    this.mesh = this._sphere;
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

  update(cameraPosition) {
    this.mesh.position.copy(cameraPosition);
  }

  setBrightnessMax(max) {
    this._brightnessRange.max = max;
    this._sphere.material.uniforms.uBrightnessMax.value = max;
  }

  dispose() {
    this._sphere.geometry.dispose();
    this._sphere.material.dispose();
  }
}
