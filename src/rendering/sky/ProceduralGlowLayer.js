import * as THREE from 'three';
import { BAYER4 } from '../shaders/common.glsl.js';

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
    this._galacticMap = galacticMap;

    // Derive a stable per-galaxy seed offset for the cloud field so two
    // galaxies with different master seeds get different cloud layouts.
    // Hash the master seed string into three float offsets.
    let hashX = 0, hashY = 0, hashZ = 0;
    const seedStr = (galacticMap && galacticMap.masterSeed) || 'default';
    for (let i = 0; i < seedStr.length; i++) {
      const c = seedStr.charCodeAt(i);
      hashX = ((hashX * 31) + c * 7) | 0;
      hashY = ((hashY * 37) + c * 11) | 0;
      hashZ = ((hashZ * 41) + c * 13) | 0;
    }
    this._cloudSeed = {
      x: (hashX % 1000) * 0.13,
      y: (hashY % 1000) * 0.17,
      z: (hashZ % 1000) * 0.19,
    };

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
        uShowCenterMarker: { value: false },  // debug: show galactic center indicator
        uBarAngle: { value: galacticMap.barAngle || (28.0 * Math.PI / 180.0) },
        uTargetPos: { value: new THREE.Vector3(0, 0, 0) },
        uShowTarget: { value: false },
        // Feature absorption — up to 8 nearby features dim the glow
        uFeaturePositions: { value: Array.from({ length: 8 }, () => new THREE.Vector3()) },
        uFeatureRadii: { value: new Float32Array(8) },
        uFeatureAbsorption: { value: new Float32Array(8) },
        uFeatureCount: { value: 0 },
        // Molecular clouds — discrete list from GalacticMap.findCloudsInVolume
        // xyz = center (kpc), w = max semi-axis (bounding radius)
        uClouds: { value: Array.from({ length: 16 }, () => new THREE.Vector4(0, 0, 0, 0)) },
        // xy = arm tangent direction in (X, Z), z = halfLong, w = halfPerp
        uCloudAxes: { value: Array.from({ length: 16 }, () => new THREE.Vector4(0, 0, 0, 0)) },
        // x = density, y = seed, z = halfVert, w reserved
        uCloudProps: { value: Array.from({ length: 16 }, () => new THREE.Vector4(0, 0, 0, 0)) },
        uCloudCount: { value: 0 },
        uCloud: { value: 0.0 },
        uCloudScale: { value: 1.0 },
        uCloudArmBias: { value: 1.0 },
        uCloudSeedX: { value: 0.0 },
        uCloudSeedY: { value: 0.0 },
        uCloudSeedZ: { value: 0.0 },
        uCloudDebug: { value: 0 },
        // ── Tunnel deformation (for warp transitions) ──
        // At phase=0 the icosphere is a normal sky sphere. At phase=1 every
        // vertex collapses onto a cylinder of radius uTunnelRadius aligned
        // with uTunnelForward, stretching the galaxy band onto the tunnel
        // walls. Glow is diffuse — no scroll, no taper, just radial pull.
        uTunnelPhase:   { value: 0.0 },
        uTunnelForward: { value: new THREE.Vector3(0.0, 0.0, -1.0) },
        uTunnelRadius:  { value: 300.0 },
      },

      vertexShader: /* glsl */ `
        uniform float uTunnelPhase;
        uniform vec3  uTunnelForward;
        uniform float uTunnelRadius;
        varying vec3 vWorldDir;

        // Stable pseudo-random from vec3 — used to give on-axis vertices
        // a deterministic azimuth when their perpendicular component vanishes.
        float glowTunnelHash(vec3 p) {
          return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
        }

        void main() {
          vec3 finalPos = position;

          if (uTunnelPhase > 0.0) {
            vec3 F = normalize(uTunnelForward);
            float along = dot(position, F);
            vec3 perp = position - along * F;
            float perpLen = length(perp);
            vec3 perpDir;
            if (perpLen > 0.001) {
              perpDir = perp / perpLen;
            } else {
              float h = glowTunnelHash(position);
              float ang = h * 6.2831853;
              vec3 up = abs(F.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
              vec3 right = normalize(cross(F, up));
              vec3 fup = normalize(cross(right, F));
              perpDir = right * cos(ang) + fup * sin(ang);
            }
            vec3 tunnelPos = perpDir * uTunnelRadius + F * along;
            finalPos = mix(position, tunnelPos, uTunnelPhase);
          }

          vWorldDir = finalPos;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(finalPos, 1.0);
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
        uniform vec3 uTargetPos;
        uniform bool uShowTarget;

        // Feature absorption uniforms kept for potential future use but
        // no longer read by the shader — nebula billboards handle absorption
        // via premultiplied alpha blending now.
        uniform int uFeatureCount;

        // Molecular cloud discrete-list pass
        // Up to 16 nearby clouds from GalacticMap.findCloudsInVolume, uploaded
        // as arrays. xyz = cloud center in galactic coords, w = cloud radius.
        // uCloudProps[i].x = density, .y = shape seed, .zw reserved.
        // Cloud list uniforms removed from GLSL — the continuous-field
        // approach doesn't use per-cloud data. The JS code still uploads
        // them (Three.js silently ignores uploads to non-existent
        // uniforms) so the CPU-side cloud list remains intact for future
        // nav-map use without shader bloat.
        uniform float uCloud;          // 0 = disabled, 1 = default opacity
        uniform float uCloudScale;     // FBM frequency multiplier
        uniform float uCloudArmBias;   // arm envelope strength
        uniform float uCloudSeedX;     // per-galaxy seed offset
        uniform float uCloudSeedY;
        uniform float uCloudSeedZ;
        uniform int uCloudDebug;       // 0=off, 1=show density field, 2=show shaped density

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

        // ── Continuous molecular cloud field ──
        //
        // A 3D density field sampled at each ray-march sample. Features
        // stretch along spiral arms because the FBM is sampled in
        // arm-local coordinates (alongArm, perpArm, z) with different
        // frequencies per axis. Gated by arm strength, midplane, and
        // radial (molecular ring) envelopes — same physics-driven gates
        // as before, just now driving a continuous field instead of
        // a discrete cloud list.
        //
        // Seed uniform keeps the field distinct per-galaxy. Continuous
        // sampling means the field naturally has fractal substructure
        // at all scales, so adjacent dense regions merge, filaments
        // branch, and outlines are irregular — no smooth ellipsoids.
        float cloudFieldDensity(vec3 p, float R, float z, float theta, float armStr) {
          if (R < 1.0 || R > 14.5) return 0.0;

          // Midplane envelope — dust is thin, ~100 pc scale height
          float zEnv = exp(-z * z / (2.0 * DUST_HEIGHT * DUST_HEIGHT * 2.5));
          if (zEnv < 0.02) return 0.0;

          // Radial envelope — Gaussian around the molecular ring peak
          float ringDist = R - 5.0;
          float radialEnv = exp(-0.5 * ringDist * ringDist / 10.0);
          radialEnv *= smoothstep(14.5, 11.0, R);
          if (radialEnv < 0.02) return 0.0;

          // Arm envelope — strongly biased toward arms but non-zero between
          float armEnv = 0.25 + max(armStr, 0.0) * uCloudArmBias * 1.4;

          // ── Compute arm-local coordinates ──
          // For each arm, project the position onto its spiral path to get
          // (alongArm, perpArm). Use the arm whose perp distance is smallest.
          float logR = log(max(R, 0.01));
          float sinPitch = sin(12.0 * PI / 180.0);
          float bestPerp = 1000.0;
          float bestAlong = 0.0;
          float absBestPerp = 1000.0;
          for (int i = 0; i < 8; i++) {
            if (i >= uArmCount) break;
            float armTheta = uArmOffsets[i] + uPitchK * logR;
            float dTheta = mod(theta - armTheta + 3.0 * PI, 2.0 * PI) - PI;
            float perpDist = dTheta * R * sinPitch;
            if (abs(perpDist) < absBestPerp) {
              absBestPerp = abs(perpDist);
              bestPerp = perpDist;
              // Along-arm arc length — roughly R × theta for the logarithmic spiral
              bestAlong = R * theta;
            }
          }

          // ── Hierarchical density field: two scales composed ──
          //
          // LOW-FREQUENCY "complex" field (ridged noise) — defines the
          // large-scale backbone of cloud complexes as sharp curving
          // filaments. Ridged noise (1 - abs(2*fbm - 1)) converts
          // blob-shaped isosurfaces into ridge-shaped ones, giving
          // filament backbones rather than cheetah spots.
          //
          // HIGH-FREQUENCY "core" field (standard FBM) — modulates the
          // complex field at ~4x smaller scale to produce clumpy dense
          // cores within the filaments. Without this, the complex field
          // alone would be too uniform in texture.
          //
          // Density = complex_ridge × (floor + core_variation)
          //
          // This gives hierarchical structure: large filaments at the
          // complex scale, clumpy cores at the core scale, with the core
          // field's floor preventing the filament from vanishing in
          // regions where core noise is low.

          // Arm-local coordinates with per-galaxy seed offset
          vec3 q = vec3(bestAlong * 0.4, bestPerp * 1.9, z * 14.0);
          q *= uCloudScale;
          q += vec3(uCloudSeedX, uCloudSeedY, uCloudSeedZ);

          // Domain warp for organic, flowing structure
          vec3 warp = vec3(
            noise3D(q * 0.8 + vec3(17.3, 0.0, 0.0)),
            noise3D(q * 0.8 + vec3(0.0, 13.7, 0.0)),
            noise3D(q * 0.8 + vec3(0.0, 0.0, 21.1))
          );
          warp = (warp - 1.5) / 1.5;
          vec3 qw = q + warp * 1.3;

          // ── Complex field (low frequency — defines where complexes exist) ──
          float fbmC = fbm(qw, 3) / 3.0;
          float complexField = smoothstep(0.48, 0.76, fbmC);

          // ── Core field (high frequency — clumps within complexes) ──
          vec3 qCore = qw * 4.5;
          float fbmK = fbm(qCore, 2) / 3.0;
          float coreField = smoothstep(0.45, 0.68, fbmK);

          // Combine hierarchically: complex gates WHERE clouds exist,
          // core modulates the density within those regions.
          float density = complexField * (0.3 + coreField * 0.85);

          return density * radialEnv * zEnv * armEnv;
        }

        // ── Discrete molecular clouds (DEPRECATED — kept as stub) ──
        //
        // Clouds are a CPU-side list driven by GalacticMap.getClouds(). This
        // shader receives up to 16 nearest clouds as uniform arrays. Each ray
        // tests against each cloud in two modes:
        //
        //   1. Volumetric (close clouds, or ray enters the cloud):
        //      Ray-march between entry and exit points, sampling a local FBM
        //      anchored to the cloud's center. This gives the wispy,
        //      Coalsack-style filamentary detail you see when a cloud is
        //      close enough to spatially resolve.
        //
        //   2. Flat occlusion (far clouds the ray merely passes through):
        //      Single ray-sphere intersection, attenuation proportional to
        //      path length through the sphere. Used when the cloud is too
        //      far for per-cloud detail to matter — it's just a darker
        //      patch on the integrated stellar glow.
        //
        // Both modes use the same (center, radius, density, seed) data so
        // nothing is inconsistent between near and far views.

        // Ray-sphere intersection — returns vec2(tNear, tFar).
        // If no hit, tFar < tNear (signals miss).
        vec2 raySphereIntersect(vec3 ro, vec3 rd, vec3 center, float radius) {
          vec3 oc = ro - center;
          float b = dot(oc, rd);
          float c = dot(oc, oc) - radius * radius;
          float h = b * b - c;
          if (h < 0.0) return vec2(1.0, -1.0);  // miss
          h = sqrt(h);
          return vec2(-b - h, -b + h);
        }

        // Ray-ellipsoid intersection in world coords.
        // The ellipsoid is defined by:
        //   center
        //   tangent2D — unit vector in the (X, Z) galactic plane, long-axis direction
        //   halfLong — semi-axis along tangent2D
        //   halfPerp — semi-axis perpendicular to tangent in the disk plane
        //   halfVert — semi-axis along Y (galactic vertical)
        //
        // Transform the ray into ellipsoid-local space where the ellipsoid
        // becomes a unit sphere, do ray-sphere intersection, then return
        // the (tNear, tFar) in ORIGINAL (unscaled) world units. Local
        // sphere has unit radius, but the transform preserves t only
        // approximately — we renormalize by the world-space ray direction
        // after intersection.
        vec2 rayEllipsoidIntersect(
          vec3 ro, vec3 rd, vec3 center,
          vec2 tangent2D, float halfLong, float halfPerp, float halfVert
        ) {
          // Local basis in world-space. Long axis in disk plane, perp axis
          // in disk plane (rotated 90° from tangent), vertical axis is Y.
          vec3 T = vec3(tangent2D.x, 0.0, tangent2D.y);
          vec3 P = vec3(-tangent2D.y, 0.0, tangent2D.x);
          vec3 V = vec3(0.0, 1.0, 0.0);

          // World → ellipsoid-local transform: dot with basis, then scale
          // by inverse semi-axes so the ellipsoid becomes a unit sphere.
          vec3 oc = ro - center;
          vec3 localRo = vec3(
            dot(oc, T) / halfLong,
            dot(oc, V) / halfVert,
            dot(oc, P) / halfPerp
          );
          vec3 localRd = vec3(
            dot(rd, T) / halfLong,
            dot(rd, V) / halfVert,
            dot(rd, P) / halfPerp
          );
          float rdLen = length(localRd);
          if (rdLen < 1e-6) return vec2(1.0, -1.0);
          vec3 localRdN = localRd / rdLen;

          // Unit sphere intersection in local space
          float b = dot(localRo, localRdN);
          float c = dot(localRo, localRo) - 1.0;
          float h = b * b - c;
          if (h < 0.0) return vec2(1.0, -1.0);
          h = sqrt(h);
          // Convert local t → world t by dividing out the scale factor
          // introduced by normalizing localRd.
          return vec2((-b - h) / rdLen, (-b + h) / rdLen);
        }

        // Per-cloud local density field — called during volumetric pass.
        // "local" is the sample position relative to cloud center, in kpc.
        // "cloudRadius" gates the falloff; "seed" picks a unique FBM offset
        // per cloud so no two clouds look identical.
        //
        // Produces wispy filamentary structure via a domain-warped FBM,
        // smoothstep-shaped to make the edges feathered rather than hard.
        // Multiplied by a radial falloff so density smoothly reaches zero
        // at the cloud's bounding sphere surface.
        float cloudLocalDensity(vec3 local, float cloudRadius, float seed) {
          // Radial falloff: 1 near center, fading to 0 at bounding sphere.
          // The core (inner 60%) stays at full density so the cloud has a
          // solid-looking center; the outer 40% fades with a warped edge
          // for wispy silhouettes.
          float r = length(local);
          if (r >= cloudRadius) return 0.0;

          // Per-cloud FBM offset so each cloud has its own shape.
          // Frequency of 7 cycles per cloud radius — small enough cells
          // (~14% of radius = ~6 pc for a 45 pc cloud) that adjacent rays
          // genuinely see different noise values, breaking up the silhouette.
          float invRad = 1.0 / max(cloudRadius, 0.01);
          vec3 q = local * invRad * 7.0 * uCloudScale + vec3(seed * 7.17, seed * 3.41, seed * 11.73);

          // Domain warp for filamentary edges
          vec3 warp = vec3(
            noise3D(q * 1.5 + vec3(17.3, 0.0, 0.0)),
            noise3D(q * 1.5 + vec3(0.0, 13.7, 0.0)),
            noise3D(q * 1.5 + vec3(0.0, 0.0, 21.1))
          );
          warp = (warp - 1.5) / 1.5;

          // FBM in [0,1] roughly, normalized so its mean is ~0.48
          float base = fbm(q + warp * 1.2, 3) / 3.0;

          // Aggressive edge warping — the FBM shifts the "effective radius"
          // by up to 90% of the cloud size, so some rays see a much bigger
          // cloud (wispy extension) and others see a much smaller one
          // (indentation). This is what breaks up the circular silhouette.
          float edgeNoise = (base - 0.48) * 2.0;
          float effectiveR = r + edgeNoise * cloudRadius * 0.45;

          // Soft radial falloff on the warped radius — dense core, feathered edge
          float density = 1.0 - smoothstep(cloudRadius * 0.40, cloudRadius * 1.05, effectiveR);

          // Interior variation: toned-down FBM-modulated density so the
          // cloud core isn't a uniform block
          float interiorVariation = 0.55 + smoothstep(0.35, 0.70, base) * 0.45;
          return density * interiorVariation;
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
        ${BAYER4}

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
          // Cloud transmittance accumulates across samples. Each sample's
          // stellar contribution is scaled by the running transmittance so
          // stars behind dust are correctly occluded.
          float cloudTransmittance = 1.0;
          float cloudAccum = 0.0;
          // Per-ray weighted average of cloud color, so we can paint the
          // cloud with a hue that varies per sample based on local density
          // and local arm strength (more blue near young-star regions).
          vec3 cloudColorAccum = vec3(0.0);
          float cloudColorWeight = 0.0;

          // Find disk plane crossing: cam.y + dir.y * t = 0
          // Only use adaptive sampling when clearly above/below the disk
          // (not when in the plane looking horizontally — uniform steps work fine there)
          float tCross = (abs(dir.y) > 0.01) ? (-cam.y / dir.y) : -1.0;
          bool hasCrossing = tCross > NEAR_FADE && tCross < MAX_DIST && abs(cam.y) > 0.5;

          // When above the disk (hasCrossing): 16 dense samples tightly
          // concentrated at the disk crossing. Tight 40 pc spacing means
          // each ray gets 4–6 samples inside the ~160 pc dust layer,
          // enough to resolve continuous cloud structure instead of
          // sparse leopard spots.
          // When in the disk (!hasCrossing): uniform samples along the full ray.
          int numSamples = NUM_STEPS;

          for (int i = 0; i < NUM_STEPS; i++) {
            if (i >= numSamples) break;

            float t;
            float effStep;

            if (hasCrossing) {
              // Dense samples at the crossing: ±0.32 kpc, 40 pc spacing.
              // This is tight enough that the dust layer is resolved even
              // from straight-overhead viewpoints.
              t = tCross + (float(i) - 7.5) * 0.04;
              effStep = 0.04;
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

            // ── Continuous cloud density ──
            // Evaluate the arm-warped FBM field at this sample point.
            // Multiply per-sample stellar contribution by the running
            // cloud transmittance so clouds correctly occlude distant
            // stars in depth order.
            if (uCloud > 0.0) {
              float cloudD = cloudFieldDensity(p, R, z, theta, armStr);
              // Extinction coefficient tuned so dense regions block ~75%
              // of the glow behind them over a typical 0.1 kpc sample.
              float extinction = cloudD * effStep * 14.0 * uCloud;
              cloudAccum += cloudD * cloudTransmittance * effStep;
              cloudTransmittance *= exp(-extinction);
              // Clamp minimum transmittance so no ray ever fully blacks
              // out — real clouds always scatter some light through.
              cloudTransmittance = max(cloudTransmittance, 0.10);

              // Per-sample cloud color based on local density.
              // Low-density: warm cream (slight reddening of starlight)
              // Medium-density: rust/amber (moderate reddening)
              // High-density: deep red-brown (heavy reddening, opaque core)
              // Plus a blue reflection hint where arm strength is high
              // (young hot stars illuminating the dust from outside).
              vec3 colThin  = vec3(0.95, 0.80, 0.58);  // warm cream
              vec3 colMed   = vec3(0.85, 0.38, 0.12);  // amber rust
              vec3 colDense = vec3(0.40, 0.08, 0.03);  // deep red-brown
              vec3 colRefl  = vec3(0.40, 0.58, 1.00);  // blue reflection
              vec3 c1 = mix(colThin, colMed, smoothstep(0.15, 0.5, cloudD));
              vec3 c2 = mix(c1, colDense, smoothstep(0.5, 0.85, cloudD));
              // Blue reflection mixed in where stellar density is high AND
              // cloud density is low-to-medium (reflecting light, not buried)
              float reflMix = smoothstep(0.3, 0.9, armStr) * (1.0 - smoothstep(0.3, 0.7, cloudD)) * 0.25;
              vec3 sampleCloudColor = mix(c2, colRefl, reflMix);
              // Weight by density × transmittance so dense nearby clouds
              // dominate the color more than wispy distant ones
              float cw = cloudD * cloudTransmittance * effStep;
              cloudColorAccum += sampleCloudColor * cw;
              cloudColorWeight += cw;
            }

            float contribution = density * nearFade * effStep * cloudTransmittance;
            glow += contribution;

            // Color weighted by contribution and bulge luminosity
            vec3 sColor = stellarColor(R, z, armStr);
            float bulgeR2 = sqrt(R * R + z * z * 8.0);
            float bulgeProximity = exp(-bulgeR2 * bulgeR2 / (2.0 * 1.2 * 1.2));
            float lumWeight = 1.0 + bulgeProximity * 15.0;
            colorAccum += sColor * contribution * lumWeight;
            weightAccum += contribution * lumWeight;
          }

          // ── Smooth dust column for above-disk views ──
          // Computed here (before tone mapping uses it) so the variable
          // is declared before its first use in GLSL.
          float smoothDustDim = 1.0;
          if (hasCrossing && uCloud > 0.0) {
            vec3 crossP = cam + dir * tCross;
            float crossR = sqrt(crossP.x * crossP.x + crossP.z * crossP.z);
            float crossTheta = atan(crossP.z, crossP.x + 0.0001);
            float smoothDust = dustDensitySimple(crossR, 0.0, crossTheta);
            smoothDustDim = exp(-smoothDust * 0.16 * uCloud * 3.0);
            smoothDustDim = max(smoothDustDim, 0.15);
          }

          // ── Tone mapping ──
          // Brightness adapts to viewing angle.
          // From above: looking through full disk = bright.
          // From inside: looking along disk = moderate.
          float aboveFactor = abs(cam.y) > 0.5 ? 1.2 : 0.65;
          float brightness = glow * 6.0;
          brightness = 1.0 - exp(-brightness);
          brightness *= aboveFactor;
          // Smooth dust dimming — pure brightness reduction, no color shift
          brightness *= smoothDustDim;

          // Cloud transmittance was accumulated inline in the stellar
          // ray march above. No separate cloud pass — the continuous
          // field is sampled at the same points as stellar density so
          // depth-ordering is correct and clouds properly occlude stars
          // behind them.

          // ── Smooth dust column boost for above-disk views ──
          //
          // From inside the disk, the 18 kpc ray path integrates through
          // many clouds and accumulates rich extinction. From above the
          // disk, the ray only crosses ~160 pc of dust — 100× less path
          // length, so 100× less extinction. Physically correct, but
          // visually wrong: real face-on galaxy photos show prominent
          // dust lanes because the column density is high.
          //
          // Fix: when hasCrossing is true (above-disk view), add the
          // smooth arm-correlated dust column from dustDensitySimple at
          // the crossing point. This represents the STATISTICAL AVERAGE
          // extinction through the full disk thickness that the FBM
          // samples are too sparse to capture. It fills in between the
          // clumpy FBM features so the galaxy looks "full of dust" from
          // above without changing the in-disk view at all (hasCrossing
          // is false in-disk, so this term never fires there).
          // (smooth dust dim already computed above, before tone mapping)

          // Debug visualization: show accumulated cloud field
          if (uCloudDebug == 2) {
            gl_FragColor = vec4(vec3(1.0 - cloudTransmittance), 1.0);
            return;
          }

          // Feature absorption removed — nebula billboards now handle their own
          // glow blocking via premultiplied alpha + Beer-Lambert transmittance.
          // The old shader-based dimming is no longer needed.

          // Per-ray weighted average cloud color. If no cloud along the
          // ray, this is black and doesn't contribute.
          vec3 avgCloudColor = cloudColorWeight > 0.0
            ? cloudColorAccum / cloudColorWeight
            : vec3(0.0);

          // Cloud self-emission: dense clouds get a small brightness
          // floor so silhouettes don't vanish. Scaled by the amount of
          // absorption (1 - transmittance) so clear rays get no glow.
          float cloudSelfBright = clamp((1.0 - cloudTransmittance) * 0.22, 0.0, 0.22);
          float totalBright = brightness + cloudSelfBright;
          if (totalBright < 0.005) discard;

          // ── Stellar color ──
          vec3 toCenter = normalize(-cam);
          float centerDot = dot(dir, toCenter);
          float centerInfluence = smoothstep(0.6, 0.97, centerDot);
          vec3 stellarColor = mix(
            vec3(0.95, 0.93, 0.90),          // silvery white (disk)
            vec3(1.0, 0.78, 0.45),            // warm golden (center)
            centerInfluence * 0.45
          );

          // ── Blend stellar color toward the per-ray cloud color ──
          // Where cloud absorption is high, cloud color dominates.
          // Where absorption is low, stellar color dominates.
          // Because avgCloudColor varies per-ray based on local density,
          // adjacent rays get different hues → no uniform rust tint.
          float tintAmount = clamp(1.0 - cloudTransmittance, 0.0, 0.92);
          vec3 color = mix(stellarColor, avgCloudColor, tintAmount);

          brightness = totalBright;

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

          // Target reticle — thin green corner brackets
          if (uShowTarget) {
            vec3 toTarget = normalize(uTargetPos - cam);
            // Project dir onto a plane perpendicular to toTarget
            // to get 2D coordinates for bracket drawing
            float targetDot = dot(dir, toTarget);
            if (targetDot > 0.95) {
              // Build a local 2D frame around the target direction
              vec3 up = abs(toTarget.y) < 0.99 ? vec3(0, 1, 0) : vec3(1, 0, 0);
              vec3 right = normalize(cross(up, toTarget));
              vec3 localUp = cross(toTarget, right);
              // 2D offset from target center
              float u = dot(dir - toTarget * targetDot, right);
              float v = dot(dir - toTarget * targetDot, localUp);
              // Bracket size (angular) — ~2° half-size
              float bSize = 0.035;
              float lineW = 0.002;  // thin lines
              float cornerLen = bSize * 0.4;  // bracket arm length
              float au = abs(u);
              float av = abs(v);
              // Check if pixel is on any of the 4 corner brackets
              bool onBracket = false;
              // Corner at (+bSize, +bSize) and mirrors
              if (au > bSize - cornerLen && au < bSize + lineW && av > bSize - lineW && av < bSize + lineW) onBracket = true;
              if (av > bSize - cornerLen && av < bSize + lineW && au > bSize - lineW && au < bSize + lineW) onBracket = true;
              if (onBracket) {
                gl_FragColor = vec4(0.0, 0.9, 0.3, 0.8);
                return;
              }
            }
          }

          gl_FragColor = vec4(color * brightness * uBrightnessMax, brightness * uOpacity);
        }
      `,
    });

    this._sphere = new THREE.Mesh(geometry, material);
    this.mesh = this._sphere;
  }

  /**
   * Update camera position (galactic coordinates in kpc). Also refreshes
   * the cloud list so nearby clouds are uploaded to the shader.
   * @param {{ x, y, z }} galacticPos
   */
  setPlayerPosition(galacticPos) {
    this._sphere.material.uniforms.uPlayerPos.value.set(
      galacticPos.x, galacticPos.y, galacticPos.z
    );
    // Upload seed offsets and enable clouds.
    const u = this._sphere.material.uniforms;
    u.uCloudSeedX.value = this._cloudSeed.x;
    u.uCloudSeedY.value = this._cloudSeed.y;
    u.uCloudSeedZ.value = this._cloudSeed.z;

    // Auto-enable clouds on first position update
    if (u.uCloud.value === 0) {
      u.uCloud.value = 1.0;
    }

    // Cloud list upload (continuous field doesn't need this data but
    // keeps the CPU-side list populated for future nav-map use).
    try {
      if (this._galacticMap && this._galacticMap.findCloudsInVolume) {
        const clouds = this._galacticMap.findCloudsInVolume(galacticPos, 20.0, 16);
        this._uploadClouds(clouds);
      }
    } catch (e) {
      console.warn('[GLOW] Cloud list upload failed:', e.message);
    }
  }

  _uploadClouds(clouds) {
    const u = this._sphere.material.uniforms;
    const uClouds = u.uClouds.value;
    const uProps = u.uCloudProps.value;
    const uAxes = u.uCloudAxes.value;
    const count = Math.min(clouds.length, 16);
    for (let i = 0; i < 16; i++) {
      if (i < count) {
        const c = clouds[i];
        // xyz = center, w = max semi-axis (conservative bounding radius)
        const maxAxis = Math.max(c.halfLong, c.halfPerp, c.halfVert);
        uClouds[i].set(c.center.x, c.center.y, c.center.z, maxAxis);
        // xy = tangent direction (in XZ plane), z = halfLong, w = halfPerp
        uAxes[i].set(c.tangent.x, c.tangent.z, c.halfLong, c.halfPerp);
        // x = density, y = seed, z = halfVert, w reserved
        uProps[i].set(c.density, c.seed, c.halfVert, 0);
      } else {
        uClouds[i].set(0, 0, 0, 0);
        uAxes[i].set(0, 0, 0, 0);
        uProps[i].set(0, 0, 0, 0);
      }
    }
    u.uCloudCount.value = count;
  }

  setOpacity(opacity) {
    this._sphere.material.uniforms.uOpacity.value = opacity;
  }

  setBrightnessMax(max) {
    this._brightnessRange.max = max;
    this._sphere.material.uniforms.uBrightnessMax.value = max;
  }

  /** Overall molecular cloud opacity (0 = disabled, 1 = default, 2 = heavy). */
  setCloudOpacity(v) {
    this._sphere.material.uniforms.uCloud.value = v;
  }

  /** FBM frequency multiplier — higher values give smaller cloud structures. */
  setCloudScale(v) {
    this._sphere.material.uniforms.uCloudScale.value = v;
  }

  /** How strongly spiral arms boost cloud probability. */
  setCloudArmBias(v) {
    this._sphere.material.uniforms.uCloudArmBias.value = v;
  }

  /** Debug: 0=off, 1=show raw FBM (blue=low, gray=mid, red=high), 2=show shaped density. */
  setCloudDebug(v) {
    this._sphere.material.uniforms.uCloudDebug.value = v;
  }

  /** Warp tunnel deformation phase (0 = sphere, 1 = cylinder). */
  setTunnelPhase(v) {
    this._sphere.material.uniforms.uTunnelPhase.value = v;
  }

  /** Tunnel forward axis (world space, normalized by shader). */
  setTunnelForward(vec3) {
    this._sphere.material.uniforms.uTunnelForward.value.copy(vec3);
  }

  /** Tunnel cylinder radius in world units (defaults to 300). */
  setTunnelRadius(v) {
    this._sphere.material.uniforms.uTunnelRadius.value = v;
  }

  update(cameraPosition) {
    this.mesh.position.copy(cameraPosition);
  }

  /** Toggle the galactic center debug marker. */
  setShowCenterMarker(show) {
    this._sphere.material.uniforms.uShowCenterMarker.value = show;
  }

  /** Set a target marker (green reticle) pointing at a galactic position. */
  setTargetMarker(pos) {
    if (pos) {
      this._sphere.material.uniforms.uTargetPos.value.set(pos.x, pos.y || 0, pos.z || 0);
      this._sphere.material.uniforms.uShowTarget.value = true;
    } else {
      this._sphere.material.uniforms.uShowTarget.value = false;
    }
  }

  /**
   * Set nearby galactic features for glow absorption.
   * The glow shader dims itself where the ray passes through a feature volume,
   * so nebulae partially replace background glow with their own color
   * rather than just adding light additively on top.
   *
   * @param {Array} features — from GalacticMap.findNearbyFeatures()
   */
  setFeatureAbsorption(features) {
    // Absorption strength by feature type — sole absorption system now
    // (mesh-based absorption disabled). These dim the glow where nebulae/dust
    // block background starlight, so emission features show their own color.
    const absorptionByType = {
      'emission-nebula': 0.5,
      'dark-nebula': 0.7,
      'planetary-nebula': 0.35,
      'reflection-nebula': 0.3,
      'supernova-remnant': 0.3,
      'open-cluster': 0.15,
      'ob-association': 0.12,
      'globular-cluster': 0.1,
    };

    const uniforms = this._sphere.material.uniforms;
    const count = Math.min(features.length, 8);

    for (let i = 0; i < 8; i++) {
      if (i < count) {
        const f = features[i];
        uniforms.uFeaturePositions.value[i].set(f.position.x, f.position.y, f.position.z);
        uniforms.uFeatureRadii.value[i] = f.radius;
        uniforms.uFeatureAbsorption.value[i] = absorptionByType[f.type] ?? 0.1;
      } else {
        uniforms.uFeaturePositions.value[i].set(0, 0, 0);
        uniforms.uFeatureRadii.value[i] = 0;
        uniforms.uFeatureAbsorption.value[i] = 0;
      }
    }
    uniforms.uFeatureCount.value = count;
    if (count > 0) {
      console.log(`[GLOW] Feature absorption: ${count} features loaded. First: pos=(${features[0].position.x.toFixed(2)}, ${features[0].position.y.toFixed(2)}, ${features[0].position.z.toFixed(2)}), r=${features[0].radius.toFixed(4)}, type=${features[0].type}`);
    } else {
      console.log('[GLOW] Feature absorption: no features nearby');
    }
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
