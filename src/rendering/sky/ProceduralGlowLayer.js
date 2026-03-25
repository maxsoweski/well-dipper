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
          if (R < 1.2) return 0.0;
          float bestStr = 0.0;
          // Fade arms in from bar tips (1.2 kpc) — fully visible by 2.5 kpc
          float armFade = smoothstep(1.2, 2.5, R);
          float logR = log(max(R, 0.01));

          float sinPitch = sin(12.0 * PI / 180.0);

          for (int i = 0; i < 8; i++) {
            if (i >= uArmCount) break;
            float armTheta = uArmOffsets[i] + uPitchK * logR;

            float dTheta = mod(theta - armTheta + 3.0 * PI, 2.0 * PI) - PI;
            float perpDist = abs(dTheta) * R * sinPitch;

            float armW = uArmWidths[i] * (0.3 + 0.06 * R);  // wide, diffuse arms
            float str = uArmBoosts[i] * exp(-0.5 * perpDist * perpDist / (armW * armW));
            // Minor arms visible but subdominant
            if (i >= 2) str *= 0.4;
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

          // Galactic bar — elongated, rotated by uBarAngle from Sun-center line.
          // Converts (R, theta) to bar-aligned coordinates for triaxial Gaussian.
          float cosBar = cos(uBarAngle);
          float sinBar = sin(uBarAngle);
          float gx = R * cos(theta);
          float gz = R * sin(theta);
          float bx = gx * cosBar + gz * sinBar;   // along bar axis
          float bz = -gx * sinBar + gz * cosBar;   // across bar axis
          // Compact bright bar — small relative to the galaxy
          float bulge = 5.0 * exp(-0.5 * (
            bx * bx / (1.5 * 1.5) +    // half-length 1.5 kpc (compact)
            bz * bz / (0.35 * 0.35) +  // half-width 350 pc (narrow)
            z * z / (0.3 * 0.3)         // vertical 300 pc
          ));

          // Spiral arm modulation — moderate contrast with soft transitions.
          // Arms brighten the band but don't create sharp bulges.
          float armStr = spiralArmStrength(R, theta);
          // Mild smoothing — preserve the difference between major and minor arms
          armStr = pow(max(armStr, 0.001), 0.7);
          float armMod = 0.5 + armStr * 2.0;  // inter-arm has faint glow (0.5), arms bright (2.5)

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

          // When above the disk (hasCrossing): only dense samples at the disk crossing.
          // No coarse samples — they can accidentally hit the disk at wrong (R,theta),
          // creating ghost arm artifacts.
          // When in the disk (!hasCrossing): uniform samples along the full ray.
          int numSamples = hasCrossing ? 8 : NUM_STEPS;

          for (int i = 0; i < NUM_STEPS; i++) {
            if (i >= numSamples) break;

            float t;
            float effStep;

            if (hasCrossing) {
              // Dense samples only: ±0.35 kpc around the disk crossing
              t = tCross + (float(i) - 3.5) * 0.1;
              effStep = 0.1;
            } else {
              // Uniform samples along the full ray
              t = (float(i) + 0.5) * (MAX_DIST / float(NUM_STEPS));
              effStep = MAX_DIST / float(NUM_STEPS);
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

          // ── Tone mapping ──
          // Brightness adapts to viewing angle.
          // From above: looking through full disk = bright.
          // From inside: looking along disk = moderate.
          float aboveFactor = abs(cam.y) > 0.5 ? 1.2 : 0.65;
          float brightness = glow * 6.0;
          brightness = 1.0 - exp(-brightness);
          brightness *= aboveFactor;

          if (brightness < 0.005) discard;

          // ── Color: warm center, silvery elsewhere ──
          vec3 toCenter = normalize(-cam);
          float centerDot = dot(dir, toCenter);
          float centerInfluence = smoothstep(0.6, 0.97, centerDot);
          vec3 color = mix(
            vec3(0.95, 0.93, 0.90),          // silvery white (disk)
            vec3(1.0, 0.78, 0.45),            // warm golden (center)
            centerInfluence * 0.45
          );

          // ── Retro dithering ──
          vec2 ditherCoord = floor(gl_FragCoord.xy / 3.0);
          float dither = bayerDither(ditherCoord);
          float levels = 8.0;
          brightness = floor(brightness * levels + dither) / levels;

          if (brightness < 0.01) discard;

          // Center marker
          if (uShowCenterMarker) {
            if (centerDot > 0.9998) { gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0); return; }
            if (centerDot > 0.999 && centerDot < 0.9995) { gl_FragColor = vec4(1.0, 0.3, 0.0, 0.8); return; }
          }

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
