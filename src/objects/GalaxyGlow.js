import * as THREE from 'three';

/**
 * GalaxyGlow — diffuse glow behind the starfield representing the
 * unresolved billions of stars in the galaxy.
 *
 * Uses a sky sphere with a fully analytical shader. Two rendering modes
 * blend based on player height above the galactic plane:
 *
 * FROM INSIDE THE DISK: Ray-marches along view directions, integrating
 * density to produce the Milky Way band effect.
 *
 * FROM ABOVE/BELOW: Projects each view direction onto the galactic plane,
 * evaluating surface density at the intersection point. This reveals
 * the face-on spiral arm structure.
 */
export class GalaxyGlow {
  constructor(radius = 498, playerPos, armOffsets, armPitchK) {
    this.radius = radius;

    const px = playerPos?.x ?? 8;
    const py = playerPos?.y ?? 0;
    const pz = playerPos?.z ?? 0;
    const toCenterX = -px;
    const toCenterY = -py;
    const toCenterZ = -pz;
    const gcLen = Math.sqrt(toCenterX * toCenterX + toCenterY * toCenterY + toCenterZ * toCenterZ) || 1;

    const offsets = armOffsets || [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2];

    const geometry = new THREE.IcosahedronGeometry(radius, 16);
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,

      uniforms: {
        uPlayerPos: { value: new THREE.Vector3(px, py, pz) },
        uGalCenterDir: { value: new THREE.Vector3(toCenterX / gcLen, toCenterY / gcLen, toCenterZ / gcLen) },
        uArmOffsets: { value: new THREE.Vector4(offsets[0], offsets[1], offsets[2], offsets[3]) },
        uArmPitchK: { value: armPitchK ?? (1.0 / Math.tan(12 * Math.PI / 180)) },
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
        #define NUM_ARMS 4
        #define ARM_WIDTH_BASE 0.15
        #define ARM_WIDTH_SLOPE 0.025
        #define SIN_PITCH 0.2079
        #define VISUAL_SCALE_LENGTH 4.0
        #define THIN_DISK_HEIGHT 0.3
        #define THICK_DISK_HEIGHT 0.9
        #define THICK_DISK_NORM 0.12
        #define BULGE_SCALE 0.5
        #define BULGE_FLATTENING 0.5
        #define BULGE_NORM 2.0
        #define GALAXY_RADIUS 15.0
        #define DISK_SCALE_LENGTH 2.6

        uniform vec3 uPlayerPos;
        uniform vec3 uGalCenterDir;
        uniform vec4 uArmOffsets;
        uniform float uArmPitchK;

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

        // ── Hash noise for dust lanes ──
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
        float dustNoise(vec2 p) {
          return (hashNoise(p * 2.5) + 0.5 * hashNoise(p * 5.0 + 17.0)) / 1.5;
        }

        // ── Spiral arm strength ──
        float spiralArmStrength(float R, float theta) {
          if (R < 0.5) return 0.0;
          float logR = log(R / 4.0);
          float armWidth = ARM_WIDTH_BASE + ARM_WIDTH_SLOPE * R;
          float maxStr = 0.0;
          float offsets[4];
          offsets[0] = uArmOffsets.x;
          offsets[1] = uArmOffsets.y;
          offsets[2] = uArmOffsets.z;
          offsets[3] = uArmOffsets.w;
          for (int i = 0; i < NUM_ARMS; i++) {
            float expectedTheta = offsets[i] + uArmPitchK * logR;
            float dTheta = mod(theta - expectedTheta + 3.0 * PI, 2.0 * PI) - PI;
            float dist = abs(dTheta) * R * SIN_PITCH;
            float str = exp(-0.5 * (dist / armWidth) * (dist / armWidth));
            maxStr = max(maxStr, str);
          }
          return maxStr;
        }

        // ── Wide spiral arm strength (for in-disk band glow) ──
        // Arms are 3x wider — smooths out pillar artifacts from discrete
        // sampling. Physically motivated: from inside the disk, projection
        // effects, dust, and overlapping arm halos blur arm features.
        float spiralArmStrengthWide(float R, float theta) {
          if (R < 0.5) return 0.0;
          float logR = log(R / 4.0);
          float armWidth = (ARM_WIDTH_BASE + ARM_WIDTH_SLOPE * R) * 3.0;
          float maxStr = 0.0;
          float offsets[4];
          offsets[0] = uArmOffsets.x;
          offsets[1] = uArmOffsets.y;
          offsets[2] = uArmOffsets.z;
          offsets[3] = uArmOffsets.w;
          for (int i = 0; i < NUM_ARMS; i++) {
            float expectedTheta = offsets[i] + uArmPitchK * logR;
            float dTheta = mod(theta - expectedTheta + 3.0 * PI, 2.0 * PI) - PI;
            float dist = abs(dTheta) * R * SIN_PITCH;
            float str = exp(-0.5 * (dist / armWidth) * (dist / armWidth));
            maxStr = max(maxStr, str);
          }
          return maxStr;
        }

        // ── Surface density (smooth — for in-disk band glow) ──
        float surfaceDensitySmooth(float R, float theta) {
          float disk = exp(-R / VISUAL_SCALE_LENGTH);
          float thick = THICK_DISK_NORM * exp(-R / 5.0);
          float bulge = BULGE_NORM * exp(-R / BULGE_SCALE);
          float base = disk + thick + bulge;

          float armStr = spiralArmStrengthWide(R, theta);
          float bulgeBlend = clamp((R - 0.5) / 1.5, 0.0, 1.0);
          float armFactor = mix(1.0, 0.10 + armStr * 2.40, bulgeBlend);

          return base * armFactor;
        }

        // ── Surface density (face-on view from above) ──
        float surfaceDensity(float R, float theta) {
          float disk = exp(-R / VISUAL_SCALE_LENGTH);
          float thick = THICK_DISK_NORM * exp(-R / 5.0);
          float bulge = BULGE_NORM * exp(-R / BULGE_SCALE);
          float base = disk + thick + bulge;

          float armStr = spiralArmStrength(R, theta);
          float bulgeBlend = clamp((R - 0.5) / 1.5, 0.0, 1.0);
          float armFactor = mix(1.0, 0.10 + armStr * 2.40, bulgeBlend);

          return base * armFactor;
        }

        // ── Volume density (ray march from inside disk) ──
        float volumeDensity(vec3 pos) {
          float R = length(pos.xz);
          float absY = abs(pos.y);
          float thin = exp(-R / DISK_SCALE_LENGTH) * exp(-absY / THIN_DISK_HEIGHT);
          float thick = THICK_DISK_NORM * exp(-R / 3.6) * exp(-absY / THICK_DISK_HEIGHT);
          float rBulge = sqrt(R * R + (pos.y / BULGE_FLATTENING) * (pos.y / BULGE_FLATTENING));
          float bulge = BULGE_NORM * exp(-rBulge / BULGE_SCALE);
          float base = thin + thick + bulge;

          float theta = atan(pos.z, pos.x);
          float armStr = spiralArmStrength(R, theta);
          float bulgeBlend = clamp((R - 0.5) / 1.5, 0.0, 1.0);
          float armFactor = mix(1.0, 0.10 + armStr * 2.40, bulgeBlend);

          return base * armFactor;
        }

        // ── Face-on: project to galactic plane ──
        // Returns density AND radius at hit point (for color mapping)
        vec2 faceOnDensityAndR(vec3 dir) {
          float py = uPlayerPos.y;
          if (abs(dir.y) < 0.01) return vec2(0.0);
          float t = -py / dir.y;
          if (t < 0.0) return vec2(0.0);
          vec3 hitPoint = uPlayerPos + dir * t;
          float R = length(hitPoint.xz);
          // Smooth taper at galaxy edge instead of hard cutoff
          float edgeFade = 1.0 - smoothstep(GALAXY_RADIUS * 0.7, GALAXY_RADIUS * 1.1, R);
          if (edgeFade < 0.001) return vec2(0.0);
          float theta = atan(hitPoint.z, hitPoint.x);
          float sd = surfaceDensity(R, theta);
          float distFade = 1.0 / (t * 0.05 + 1.0);
          return vec2(sd * distFade * edgeFade, R);
        }

        // ── Analytical band (in-disk view) ──
        // Two-part approach to avoid pillar artifacts:
        //   1. SMOOTH BASE: exponential disk (no arms) sampled along sightline
        //      — this is perfectly smooth because exp(-R/h) varies gently
        //   2. ARM MODULATION: evaluated at 2 representative points (near + far)
        //      averaged to smooth out spiral crossings
        // Returns vec3(density, avgRadius, avgArmStr).
        vec3 analyticalBandDensity(vec3 dir) {
          vec2 planeDir = normalize(dir.xz + vec2(0.00001));

          // 1. Smooth base — exponential disk WITHOUT arm modulation
          float baseDensity = 0.0;
          float weightedR = 0.0;
          float totalWeight = 0.0;

          for (int i = 0; i < 12; i++) {
            float fi = float(i);
            float t = 0.3 + fi * 1.2; // 0.3 to 13.5 kpc
            vec2 sampleXZ = uPlayerPos.xz + planeDir * t;
            float R = length(sampleXZ);
            if (R > GALAXY_RADIUS * 1.1) continue;
            float edgeFade = 1.0 - smoothstep(GALAXY_RADIUS * 0.7, GALAXY_RADIUS * 1.1, R);
            // Pure exponential disk + bulge, no arm structure
            float disk = exp(-R / VISUAL_SCALE_LENGTH);
            float thick = THICK_DISK_NORM * exp(-R / 5.0);
            float bulge = BULGE_NORM * exp(-R / BULGE_SCALE);
            float sd = (disk + thick + bulge) * edgeFade;
            float w = 1.0 / (t * 0.3 + 1.0);
            baseDensity += sd * w;
            weightedR += R * sd * w;
            totalWeight += sd * w;
          }

          float avgR = (totalWeight > 0.001) ? weightedR / totalWeight : length(uPlayerPos.xz);

          // No arm modulation — the starfield particles already show arm
          // structure. The glow is the smooth unresolved background.
          // Any discrete arm evaluation creates visible banding artifacts
          // from inside the disk.
          float armStr = 0.0;

          // 3. Vertical profile — disk band + spherical bulge
          float sinElev = abs(dir.y);
          // Thin disk band (narrow Gaussian)
          float diskWidth = 0.08 + smoothstep(8.0, 2.0, avgR) * 0.12;
          float diskFalloff = exp(-sinElev * sinElev / (2.0 * diskWidth * diskWidth));
          // Spherical bulge (very wide — visible overhead at center)
          float bulgeR = length(uPlayerPos.xz);
          float bulgeStrength = smoothstep(4.0, 0.3, bulgeR); // strong at center, gone by R=4
          float bulgeFalloff = exp(-sinElev * sinElev / (2.0 * 0.8 * 0.8)); // wide: ~50° half-width
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
            // Compute arm strength at hit point for color mapping
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
            // Blend color info so in-disk view gets proper color variation
            float bandR = bandResult.y;
            float bandArm = bandResult.z;
            hitR = mix(bandR, hitR, aboveBlend);
            armStrAtHit = mix(bandArm, armStrAtHit, aboveBlend);
          }

          // Tone mapping — sqrt compresses dynamic range
          // Cap at 0.7 to simulate eye/camera adaptation: even at the
          // galactic center, individual stars should be visible through
          // the glow (your eyes would adjust to the brightness)
          density = sqrt(clamp(density, 0.0, 1.0));
          density = min(density, 0.7);

          if (density < 0.01) discard;

          // ── Dust lanes (inside disk only) ──
          // DISABLED: hashNoise grid creates rectangular cell artifacts.
          // TODO: replace with smooth noise or pre-baked texture if dust
          // lanes are desired. For now the starfield provides visual texture.
          // if (aboveBlend < 0.5) { ... }

          // ── Color mapping — physically motivated ──
          vec3 bulgeColor = vec3(0.70, 0.58, 0.35);  // warm yellow-white
          vec3 diskColor = vec3(0.45, 0.40, 0.35);    // warm white
          vec3 armColor = vec3(0.40, 0.48, 0.65);     // blue-white (young OB stars)
          vec3 armCoreColor = vec3(0.65, 0.62, 0.55); // bright white core of arms
          vec3 nebulaColor = vec3(0.60, 0.28, 0.35);  // reddish-pink (H-II regions)

          // Wider bulge: strong at R<2, fades by R=5
          float bulgeWeight = smoothstep(5.0, 0.5, hitR);
          // Arm color: blue tint in outer disk arms
          float armBlend = armStrAtHit * smoothstep(1.5, 4.0, hitR);
          // Arm core brightness: white glow at arm centers (density of overlapping stars)
          float armCoreWeight = pow(armStrAtHit, 3.0) * smoothstep(1.5, 3.0, hitR) * 0.4;
          // Nebula patches: noise-driven splotches within arms (lower threshold = more visible)
          float nebulaStrength = 0.0;
          if (armStrAtHit > 0.2) {
            float nebNoise = hashNoise(dir.xz * 6.0 + vec2(31.7, 5.3));
            nebulaStrength = smoothstep(0.4, 0.65, nebNoise) * armStrAtHit * smoothstep(1.5, 4.0, hitR) * 0.3;
          }

          // Build final color
          vec3 baseColor = diskColor;
          baseColor = mix(baseColor, bulgeColor, bulgeWeight);
          baseColor = mix(baseColor, armColor, armBlend * 0.5);
          baseColor = mix(baseColor, armCoreColor, armCoreWeight);
          baseColor = mix(baseColor, nebulaColor, nebulaStrength);

          // Bulge brightness boost — wider and more intense
          float bulgeBrightness = 1.0 + bulgeWeight * 3.0; // up to 4x at center

          // ── Posterize — 12 bands for smooth gradation ──
          float numBands = 12.0;
          float band = floor(density * numBands) / numBands;
          float nextBand = min(1.0, band + 1.0 / numBands);
          float bandFrac = fract(density * numBands);

          // ── Bayer dithering (chunky — match retro pixel grid) ──
          float threshold = bayerDither(floor(gl_FragCoord.xy / 3.0));
          float finalDensity = (bandFrac > threshold) ? nextBand : band;

          if (finalDensity < 0.02) discard;

          // Output with bulge brightness boost
          float brightness = finalDensity * 0.5 * bulgeBrightness;
          gl_FragColor = vec4(baseColor * brightness, 1.0);
        }
      `,
    });

    this._sphere = new THREE.Mesh(geometry, material);
    this.mesh = this._sphere;
  }

  update(cameraPosition, camera) {
    this.mesh.position.copy(cameraPosition);
  }

  addTo(scene) {
    scene.add(this.mesh);
  }

  dispose() {
    this._sphere.geometry.dispose();
    this._sphere.material.dispose();
  }
}
