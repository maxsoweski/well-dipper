import * as THREE from 'three';

/**
 * ProceduralGlowLayer — real-time galaxy glow from density integration.
 *
 * For each pixel on the sky sphere, ray-marches through the galactic
 * density model, accumulating:
 *   - Stellar glow: integrated starlight from unresolved stars
 *   - Dust opacity: integrated absorption with arm-space FBM noise
 *     for filamentary dark-lane structure
 *
 * Works from any viewpoint: inside the disk (Milky Way band),
 * above (spiral structure), far away (full galaxy with dust lanes).
 *
 * The glow is always a "distance effect" — nearby regions (within
 * ~500 pc) are transparent because their stars are individually
 * resolved by the starfield renderer.
 */
export class ProceduralGlowLayer {
  /**
   * @param {number} radius — sky sphere radius
   * @param {{ min: number, max: number }} brightnessRange
   * @param {object} galacticMap — GalacticMap instance for arm data
   */
  constructor(radius, brightnessRange, galacticMap) {
    this.radius = radius;
    this._brightnessRange = brightnessRange;

    // Extract arm data from GalacticMap
    const arms = galacticMap.arms || [];
    const armOffsets = new Float32Array(8);
    const armWidths = new Float32Array(8);
    const armBoosts = new Float32Array(8);
    for (let i = 0; i < Math.min(arms.length, 8); i++) {
      armOffsets[i] = arms[i].offset;
      armWidths[i] = arms[i].width;
      armBoosts[i] = arms[i].densityBoost;
    }

    const geometry = new THREE.IcosahedronGeometry(radius, 5);

    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,

      uniforms: {
        // Camera's galactic position (kpc)
        uPlayerPos: { value: new THREE.Vector3(8.0, 0.025, 0.0) },
        // Brightness
        uBrightnessMax: { value: Math.max(brightnessRange.max, 0.35) },
        uOpacity: { value: 1.0 },
        // Galaxy model parameters
        uArmOffsets: { value: armOffsets },
        uArmWidths: { value: armWidths },
        uArmBoosts: { value: armBoosts },
        uArmCount: { value: Math.min(arms.length, 8) },
        uPitchK: { value: 1.0 / Math.tan(12.0 * Math.PI / 180.0) },
        // Time for subtle animation
        uTime: { value: 0.0 },
        uShowCenterMarker: { value: true },  // debug: show galactic center indicator
        uBarAngle: { value: galacticMap.barAngle || (28.0 * Math.PI / 180.0) },
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
        #define NUM_STEPS 16
        #define MAX_DIST 18.0   // kpc — max ray-march distance
        #define NEAR_FADE 0.5   // kpc — glow fades within this distance (resolved stars zone)
        #define GALAXY_R 15.0
        #define DUST_HEIGHT 0.08 // kpc — dust scale height (tighter than stellar disk)

        uniform vec3 uPlayerPos;
        uniform float uBrightnessMax;
        uniform float uOpacity;
        uniform float uArmOffsets[8];
        uniform float uArmWidths[8];
        uniform float uArmBoosts[8];
        uniform int uArmCount;
        uniform float uPitchK;
        uniform float uTime;
        uniform bool uShowCenterMarker;
        uniform float uBarAngle;

        varying vec3 vWorldDir;

        // ── Simplex-like hash noise (GPU friendly) ──
        vec3 hash33(vec3 p) {
          p = fract(p * vec3(0.1031, 0.1030, 0.0973));
          p += dot(p, p.yxz + 33.33);
          return fract((p.xxy + p.yxx) * p.zyx);
        }

        float noise3D(vec3 p) {
          vec3 i = floor(p);
          vec3 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          float a = dot(hash33(i), vec3(1.0));
          float b = dot(hash33(i + vec3(1, 0, 0)), vec3(1.0));
          float c = dot(hash33(i + vec3(0, 1, 0)), vec3(1.0));
          float d = dot(hash33(i + vec3(1, 1, 0)), vec3(1.0));
          float e = dot(hash33(i + vec3(0, 0, 1)), vec3(1.0));
          float f2 = dot(hash33(i + vec3(1, 0, 1)), vec3(1.0));
          float g = dot(hash33(i + vec3(0, 1, 1)), vec3(1.0));
          float h = dot(hash33(i + vec3(1, 1, 1)), vec3(1.0));
          return mix(
            mix(mix(a, b, f.x), mix(c, d, f.x), f.y),
            mix(mix(e, f2, f.x), mix(g, h, f.x), f.y),
            f.z
          );
        }

        // FBM with domain warping for filamentary structure
        float fbm(vec3 p, int octaves) {
          float val = 0.0;
          float amp = 0.5;
          float freq = 1.0;
          for (int i = 0; i < 5; i++) {
            if (i >= octaves) break;
            val += amp * noise3D(p * freq);
            freq *= 2.0;
            amp *= 0.5;
          }
          return val;
        }

        // ── Miyamoto-Nagai disk density (analytical) ──
        float diskDensity(float R, float z, float a, float b, float GM) {
          float zsq = z * z;
          float bsq = b * b;
          float zb = sqrt(zsq + bsq);
          float azb = a + zb;
          float denom = pow(R * R + azb * azb, 2.5);
          // Analytical density from MN potential (Binney & Tremaine eq 2.69)
          float rho = (GM / (4.0 * PI)) * (a * R * R + (a + 3.0 * zb) * azb * azb)
                      / (denom * zb * zb * zb / (bsq * zb));
          // Simplified: just use the potential shape as density proxy
          return GM * azb / (pow(R * R + azb * azb, 1.5) * max(zb, 0.01));
        }

        // ── Spiral arm strength at a position ──
        float spiralArmStrength(float R, float theta) {
          // Arms start at the end of the bar (~2.5 kpc) and wind outward.
          // No arm structure inside the bar radius.
          if (R < 2.0) return 0.0;
          float bestStr = 0.0;
          // Fade arms in from 2.0 to 3.5 kpc (bar-to-arm transition)
          float armFade = smoothstep(2.0, 3.5, R);
          float logR = log(max(R, 0.01));

          float sinPitch = sin(12.0 * PI / 180.0);

          for (int i = 0; i < 2; i++) {
            // Only the 2 major arms for the glow
            float armTheta = uArmOffsets[i] + uPitchK * logR;

            // Simple angular distance — mod to [-π, π]
            float dTheta = mod(theta - armTheta + 3.0 * PI, 2.0 * PI) - PI;
            float perpDist = abs(dTheta) * R * sinPitch;

            float armW = uArmWidths[i] * (0.15 + 0.04 * R);
            float str = uArmBoosts[i] * exp(-0.5 * perpDist * perpDist / (armW * armW));
            str *= armFade;
            bestStr = max(bestStr, str);
          }
          return bestStr;
        }

        // ── Arm-space coordinates for noise ──
        // Returns (along-arm, across-arm) for the nearest arm
        vec2 armSpaceCoords(float R, float theta) {
          if (R < 0.5) return vec2(0.0);
          float logR = log(max(R, 0.01));
          float bestDist = 100.0;
          float bestAlong = 0.0;

          for (int i = 0; i < 8; i++) {
            if (i >= uArmCount) break;
            float armTheta = uArmOffsets[i] + uPitchK * logR;
            float dTheta = mod(theta - armTheta + 3.0 * PI, 2.0 * PI) - PI;
            float sinPitch = sin(12.0 * PI / 180.0);
            float perpDist = dTheta * R * sinPitch;
            if (abs(perpDist) < abs(bestDist)) {
              bestDist = perpDist;
              // Along-arm coordinate: arc length along the spiral
              bestAlong = R * (theta - uArmOffsets[i]);
            }
          }
          return vec2(bestAlong, bestDist);
        }

        // ── Total density at a point (simplified for shader) ──
        float totalDensity(float R, float z, float theta) {
          // Gaussian profiles — genuinely reach zero, no infinite tails.

          // Thin disk
          float thin = exp(-R * R / (2.0 * 4.0 * 4.0))   // radial: ~4 kpc
                     * exp(-z * z / (2.0 * 0.08 * 0.08));  // vertical: ~80 pc

          // Bulge/bar — only slightly wider than the disk, compact
          // Reference photo shows the center barely swells above the band.
          float barR = sqrt(R * R + z * z * 8.0);  // strongly compressed vertically
          float bulge = 2.0 * exp(-barR * barR / (2.0 * 1.2 * 1.2));

          // Spiral arm modulation — moderate contrast with soft transitions.
          // Arms brighten the band but don't create sharp bulges.
          float armStr = spiralArmStrength(R, theta);
          // Mild smoothing — preserve the difference between major and minor arms
          armStr = pow(max(armStr, 0.001), 0.7);
          float armMod = 0.2 + armStr * 3.0;  // inter-arm very dim (0.2), arm center bright (3.2)

          // Disk truncation
          float trunc = smoothstep(GALAXY_R, GALAXY_R - 1.5, R);

          return thin * armMod * trunc + bulge;
        }

        // ── Dust density (concentrated in midplane + arms) ──
        // Cheap version: smooth density, no FBM noise (for performance).
        // Filamentary structure will be added back with optimized noise later.
        float dustDensitySimple(float R, float z, float theta) {
          // Base dust: very thin disk, concentrated in midplane
          float dustR = exp(-R / 4.0);
          float dustZ = exp(-z * z / (2.0 * DUST_HEIGHT * DUST_HEIGHT));
          float base = dustR * dustZ;

          // Arm concentration: dust is stronger on the leading edge of arms
          float armStr = spiralArmStrength(R, theta);
          float armDust = 0.5 + armStr * 3.0;

          // Molecular ring (R = 3-7 kpc)
          float ring = exp(-0.5 * pow((R - 5.0) / 2.0, 2.0));
          float ringBoost = 1.0 + ring * 1.5;

          // Disk truncation
          float trunc = smoothstep(13.0, 11.0, R);

          return base * armDust * ringBoost * trunc;
        }

        // ── Stellar population color ──
        vec3 stellarColor(float R, float z, float armStr) {
          // Bulge: rich golden-amber (old K/M giants dominate)
          // Arms: blue-tinged white (young O/B mixed with F/G)
          // General disk: warm cream (F/G/K mix)
          // Bulge weight for color — matches tighter density bulge
          float bulgeWR = sqrt(R * R + z * z * 8.0);
          float bulgeW = exp(-bulgeWR * bulgeWR / (2.0 * 1.2 * 1.2));
          // Arm weight: proportional to arm strength
          float armW = clamp(armStr * 0.4, 0.0, 0.5);
          // Disk weight: everything else
          float diskW = max(0.0, 1.0 - bulgeW - armW);

          vec3 bulgeCol = vec3(1.0, 0.75, 0.40);    // warm amber (only at very center)
          vec3 armCol = vec3(0.85, 0.88, 1.0);       // cool blue tint in arms
          vec3 diskCol = vec3(0.95, 0.93, 0.90);     // silvery white (matches reference)

          return bulgeCol * bulgeW + armCol * armW + diskCol * diskW;
        }

        // ── Bayer dithering (4x4, chunky retro) ──
        float bayerDither(vec2 pos) {
          int x = int(mod(pos.x, 4.0));
          int y = int(mod(pos.y, 4.0));
          // 4x4 Bayer matrix / 16
          int idx = x + y * 4;
          float bayer[16];
          bayer[0]  =  0.0/16.0; bayer[1]  =  8.0/16.0; bayer[2]  =  2.0/16.0; bayer[3]  = 10.0/16.0;
          bayer[4]  = 12.0/16.0; bayer[5]  =  4.0/16.0; bayer[6]  = 14.0/16.0; bayer[7]  =  6.0/16.0;
          bayer[8]  =  3.0/16.0; bayer[9]  = 11.0/16.0; bayer[10] =  1.0/16.0; bayer[11] =  9.0/16.0;
          bayer[12] = 15.0/16.0; bayer[13] =  7.0/16.0; bayer[14] = 13.0/16.0; bayer[15] =  5.0/16.0;
          for (int i = 0; i < 16; i++) {
            if (i == idx) return bayer[i];
          }
          return 0.0;
        }

        void main() {
          vec3 dir = normalize(vWorldDir);

          #ifdef DEBUG_SOLID
            gl_FragColor = vec4(0.5 + dir * 0.5, 1.0);
            return;
          #endif

          // DEBUG_ARMS: show the arm pattern at the nearest disk point along the ray.
          #ifdef DEBUG_ARMS
            float tDbg;
            if (abs(dir.y) > 0.001) {
              tDbg = clamp(-cam.y / dir.y, 0.5, MAX_DIST);
            } else {
              tDbg = 5.0;
            }
            vec3 pDbg = cam + dir * tDbg;
            float Rdbg = sqrt(pDbg.x * pDbg.x + pDbg.z * pDbg.z);
            float thetaDbg = atan(pDbg.z, pDbg.x + 0.0001);
            if (Rdbg > GALAXY_R) discard;
            float armDbg = spiralArmStrength(Rdbg, thetaDbg);
            // SOLID debug output — fully opaque
            float diskFade = exp(-pDbg.y * pDbg.y / (2.0 * 0.5 * 0.5));
            float inDisk = smoothstep(GALAXY_R, GALAXY_R - 2.0, Rdbg) * diskFade;
            // Blue = disk, white = arms, black = outside
            vec3 c = mix(vec3(0.0, 0.0, 0.3), vec3(1.0), clamp(armDbg, 0.0, 1.0));
            gl_FragColor = vec4(c * max(inDisk, 0.01), 1.0);
            return;
          #endif

          // Camera position in galactic coords
          vec3 cam = uPlayerPos;

          // ── Ray-march through the galaxy ──
          // Adaptive sampling: find where the ray crosses the disk plane (y=0)
          // and sample densely there. The thin disk is only 80 pc thick —
          // uniform steps from far away would skip it entirely.

          float glow = 0.0;
          vec3 colorAccum = vec3(0.0);
          float weightAccum = 0.0;

          // Find disk plane crossing: cam.y + dir.y * t = 0
          // Only use adaptive sampling when clearly above/below the disk
          // (not when in the plane looking horizontally — uniform steps work fine there)
          float tCross = (abs(dir.y) > 0.01) ? (-cam.y / dir.y) : -1.0;
          bool hasCrossing = tCross > NEAR_FADE && tCross < MAX_DIST && abs(cam.y) > 0.5;

          // Sample array: 8 dense samples around disk crossing + 8 coarse samples
          for (int i = 0; i < NUM_STEPS; i++) {
            float t;
            float effStep;

            if (hasCrossing && i < 8) {
              // Dense samples: ±0.35 kpc around the disk crossing, 0.1 kpc apart
              t = tCross + (float(i) - 3.5) * 0.1;
              effStep = 0.1;
            } else {
              // Coarse samples: spread across the full range
              int ci = hasCrossing ? (i - 8) : i;
              int totalCoarse = hasCrossing ? 8 : NUM_STEPS;
              t = (float(ci) + 0.5) * (MAX_DIST / float(totalCoarse));
              effStep = MAX_DIST / float(totalCoarse);
            }

            if (t < 0.0 || t > MAX_DIST) continue;

            // Near fade: skip nearby region (resolved stars)
            float nearFade = smoothstep(NEAR_FADE, NEAR_FADE * 3.0, t);

            // Sample position along ray
            vec3 p = cam + dir * t;
            float R = sqrt(p.x * p.x + p.z * p.z);
            float z = p.y;
            float theta = atan(p.z, p.x + 0.0001);

            // Stellar density → glow
            float density = totalDensity(R, z, theta);
            float armStr = spiralArmStrength(R, theta);

            float contribution = density * nearFade * effStep;
            glow += contribution;

            // Color weighted by contribution and bulge luminosity
            vec3 sColor = stellarColor(R, z, armStr);
            float bulgeR2 = sqrt(R * R + z * z * 8.0);
            float bulgeProximity = exp(-bulgeR2 * bulgeR2 / (2.0 * 1.2 * 1.2));
            float lumWeight = 1.0 + bulgeProximity * 15.0;
            colorAccum += sColor * contribution * lumWeight;
            weightAccum += contribution * lumWeight;
          }

          // Tone mapping — preserve more dynamic range so center is clearly brighter.
          // Use pow() instead of sqrt() for steeper contrast curve.
          float brightness = glow * 6.0;
          brightness = 1.0 - exp(-brightness);
          brightness = pow(brightness, 0.7);  // steeper than sqrt, preserves center/edge contrast

          // Scale for transparency — brighter toward galactic center
          vec3 toCenterDir2 = normalize(-cam);
          float centerBright = smoothstep(0.2, 0.9, dot(dir, toCenterDir2));
          brightness *= 0.55 + centerBright * 0.35;  // 0.55 at edges, up to 0.90 at center

          // ── Edge patchiness ──
          // Subtle noise only at the fringes of the band.
          // Creates uneven edges that the dithering turns into stippled pattern.
          // NO noise in dark sky regions — only where there's already glow.
          if (brightness > 0.02) {
            vec3 noiseDir1 = dir * 25.0;  // ~8° features
            float edgeNoise = noise3D(noiseDir1);
            // Only affect the transition zone (edges of the band)
            float edgeFactor = smoothstep(0.03, 0.25, brightness);
            float noiseAmt = (1.0 - edgeFactor) * 0.12;  // up to 12% at edges, 0% in core
            brightness += (edgeNoise - 0.5) * noiseAmt;
          }

          if (brightness < 0.008) discard;

          // Final color from weighted stellar populations
          vec3 color = weightAccum > 0.001 ? colorAccum / weightAccum : vec3(1.0, 0.88, 0.65);

          // Direction-based color shift toward galactic center.
          // Looking toward center = more evolved giants = warmer/golden.
          // This is a real physical effect — the bulge's old stellar population
          // dominates the integrated light in that direction.
          vec3 toCenterDir = normalize(-cam);
          float centerDot = dot(dir, toCenterDir);
          float centerInfluence = smoothstep(0.6, 0.97, centerDot);  // tight — only near dead center
          vec3 warmShift = vec3(1.0, 0.78, 0.45);  // warm golden
          color = mix(color, warmShift, centerInfluence * 0.45);  // up to 45% golden at center

          // ── Retro aesthetic ──
          vec2 ditherCoord = floor(gl_FragCoord.xy / 3.0);
          float dither = bayerDither(ditherCoord);

          // Posterize to 8 levels (more subtle gradation for the glow)
          float levels = 8.0;
          brightness = floor(brightness * levels + dither) / levels;

          if (brightness < 0.01 && !uShowCenterMarker) discard;

          // Debug: galactic center marker (red crosshair)
          if (uShowCenterMarker) {
            // Direction from camera to galactic center (0, 0, 0)
            vec3 toCenterDir = normalize(-cam);
            float dotCenter = dot(dir, toCenterDir);
            // Crosshair at center direction
            if (dotCenter > 0.9998) {
              gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
              return;
            }
            // Ring around center
            if (dotCenter > 0.999 && dotCenter < 0.9995) {
              gl_FragColor = vec4(1.0, 0.3, 0.0, 0.8);
              return;
            }
            // Wider ring at ~5 degrees
            if (abs(dotCenter - 0.996) < 0.0005) {
              gl_FragColor = vec4(0.5, 0.2, 0.0, 0.4);
              return;
            }
          }

          if (brightness < 0.01) discard;

          gl_FragColor = vec4(color * brightness * uBrightnessMax, brightness * uOpacity);
        }
      `,
    });

    this._sphere = new THREE.Mesh(geometry, material);
    this.mesh = this._sphere;
  }

  /**
   * Update camera position (galactic coordinates in kpc).
   * @param {{ x, y, z }} galacticPos
   */
  setPlayerPosition(galacticPos) {
    this._sphere.material.uniforms.uPlayerPos.value.set(
      galacticPos.x, galacticPos.y, galacticPos.z
    );
  }

  setOpacity(opacity) {
    this._sphere.material.uniforms.uOpacity.value = opacity;
  }

  setBrightnessMax(max) {
    this._brightnessRange.max = max;
    this._sphere.material.uniforms.uBrightnessMax.value = max;
  }

  update(cameraPosition) {
    this.mesh.position.copy(cameraPosition);
  }

  /** Toggle the galactic center debug marker. */
  setShowCenterMarker(show) {
    this._sphere.material.uniforms.uShowCenterMarker.value = show;
  }

  /**
   * Debug: test glow from a different galactic position without
   * regenerating the starfield (avoids the hang at extreme positions).
   * Call from console: window._glowLayer.debugSetPosition(x, y, z)
   */
  debugSetPosition(x, y, z) {
    this._sphere.material.uniforms.uPlayerPos.value.set(x, y, z);
    console.log(`[GLOW DEBUG] Position set to (${x}, ${y}, ${z})`);
  }

  dispose() {
    this._sphere.geometry.dispose();
    this._sphere.material.dispose();
  }
}
