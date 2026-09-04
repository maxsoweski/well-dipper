import * as THREE from 'three';
import { assignBodyName } from '../util/scene-naming.js';
import { HEIGHT_NOISE_GLSL, HEIGHT_NOISE_UNIFORMS_GLSL } from '../worldengine/shaders/heightNoise.glsl.js';
import { applyDriverPacks, selectPacks } from '../worldengine/drivers/index.js'; import { attachLabBake, disposeLabBake } from '../rendering/bake/labBakeHost.js'; import { registerStormAB, unregisterStormAB } from '../rendering/labStormAB.js'; import { registerRaysAB, unregisterRaysAB } from '../rendering/labRaysAB.js'; import { registerTermAB, unregisterTermAB } from '../rendering/labTermAB.js'; import { registerReliefAB, unregisterReliefAB } from '../rendering/labReliefAB.js';   // §4 Step 6a · ⭐ 2026-09-01 THE PROVINCE CUBE, 2026-09-02 THE WHOLE LAB BAKE (relief + crater + carve + ribbon) — RIDES THIS LINE (this file is symbol-cited to :2251; a new import line shifts every citation below it). The host runs the lab's dispatch over the shared carrier and bakes the four cubes on the body's first draw. ⭐ 2026-09-03 THE RAY A/B (key Y) RIDES THIS LINE TOO — same rule, same reason (workstream wire-ejecta-rays-lab-into-game).
import { gameDisplayRadiusEarth } from '../worldengine/port/writePackUniforms.js';
import { fnv1aString } from 'motion-test-kit/core/hash/fnv1a.js';          // the 5d macroSeed shape, numeric form
import {
  CRATER_RELIEF_GLSL,
  CRATER_RELIEF_UNIFORMS_GLSL,
} from '../worldengine/shaders/craterRelief.glsl.js'; import { RING_VERTEX_GLSL, RING_FRAGMENT_GLSL, ringUniformsFrom } from '../worldengine/shaders/ringRelief.glsl.js';   // ⛔ RIDES THIS LINE: F51's ring module, shared with the lab.
import { conditionFromBody } from '../worldengine/port/conditionFromBody.js';
import { atmosphereOpticsOf } from '../worldengine/base/atmosphereOptics.js'; import { terminatorOpticsOf } from '../worldengine/base/terminatorOptics.js';  // ⛔ B3-1 RIDES THIS LINE: a new import line would shift every line-anchored citation that points below it, in this lane and in the concurrent one.
import { biosphereOf, BIO_PIGMENT } from '../worldengine/base/surfaceMaterial.js';
import { craterUniformsFrom, CRATERS_OFF } from '../worldengine/port/craterUniforms.js'; import { craterRelevanceOf } from '../worldengine/base/bombardment.js'; import { chasmaRiftsFor, reliefAxesFor } from '../worldengine/base/labCore.js'; // ⛔ RIDES THIS LINE: a new import line shifts every cited line below (see :2085-2090)
import { updateLabPlanetMaterial, buildLabPlanetMaterial, ensureLabAttributes } from '../rendering/LabPlanetMaterial.js'; import { POSTERIZE_QUANTUM } from '../rendering/posterizeLevels.js'; // ⛔ B2P RIDES THIS LINE: a new import line shifts every cited line below it.

// ─────────────────────────────────────────────────────────────────────────────
// Fragment shader split into HEADER + per-category BODY + FOOTER.
// Each assembled variant stays well under 20KB (the monolithic was ~31KB,
// approaching Chrome/ANGLE's ~33KB compile limit).
// ─────────────────────────────────────────────────────────────────────────────

// ── Shared header: uniforms, varyings, noise, helpers ──
const FRAG_HEADER = /* glsl */ `
#include <logdepthbuf_pars_fragment>
uniform vec3 baseColor;  uniform vec2 uPosterizeLevels;   // B2P — the colour quantum as a vec2: .x = levels, .y = its CPU-carried float32 reciprocal. It is a vec2 and not a float so the reciprocal cannot be re-derived (and re-folded into a divide) by the shader compiler; see posterizeLevels.js 'POSTERIZE_QUANTUM'. ⛔ RIDES THIS LINE.
// ── World-engine land palette (V2-10 port slice 1). BEDROCK endmembers, condition-derived per body.
// NOT whole-body colours: oceans, ice caps, clouds and gas bands keep baseColor/accentColor.
uniform vec3 uFreshColor;      // unweathered rock — exposed on peaks and fresh scarps
uniform vec3 uWeatheredColor;  // the area-dominant weathered background
uniform vec3 uSedColor;        // sediment — that surface ground up and moved into the lows
uniform float uIcenessMix;     // icenessOf(cond) — how much of the ground is ice, not bedrock
uniform vec3 uIceColor;        // the ice tone the ground mixes toward (a display value, untransferred)
uniform vec3 uLavaGlow;        // blackbody chromaticity at the melt's liquidus — the crack CORE
uniform vec3 uLavaCrust;       // the same curve sampled at the chilled skin — the crack MARGIN
uniform vec3 accentColor;
uniform float noiseScale;
uniform float noiseDetail;
// ── World-engine relief (V2-10 port slice 3, first increment) ──
// The base surface term on the land path moves from a 2-octave simplex sum to the lab's
// analytic-derivative FBM. uReliefMix is the A/B dial and the safety valve: at 0.0 every land
// body renders byte-identically to slice 2, which is what makes the negative control a proof
// rather than a screenshot. uReliefGain rescales fbmd onto the OLD term's spread so the
// land/sea threshold does not move (pattern feeds height = pattern*0.5+0.5 against a fixed
// seaLevel — an unmatched spread would silently drown or beach every continent).
uniform float uReliefMix;        // 0 = legacy simplex base, 1 = analytic fbmd base
uniform float uReliefOctaves;    // fbmd octave count; the game pays this on EVERY planet at once
uniform float uReliefGain;       // fbmd -> legacy spread match, for the default/rocky/ocean base
uniform float uReliefGainCont;   // fbmd -> legacy spread match, for the terrestrial continent base
// Matching the VALUE spread does not match the GRADIENT spread — that also depends on the
// frequency content, which fbmd and the legacy 4-octave stack do not share. So the relief
// normal carries its own measured constant rather than inheriting uReliefGain.
uniform float uReliefNormalGain;
// ── World-engine impact record (port slice 3, rung 4) ──
// Declared in the shared header because perturbNormalAnalytic below reads the gate, but the crater
// FUNCTIONS are spliced into the ROCKY variant only — gas giants and exotics never call them and
// have no reason to pay ~4KB of cold compile each for them. Unused uniform declarations cost ~1KB
// and are stripped by the compiler.
${CRATER_RELIEF_UNIFORMS_GLSL}
// Craters carry their own gain for the same reason relief does: theirs is a TRUE dimensionless
// slope already (see craterRelief.glsl.js divergence 3), so it must not inherit uReliefNormalGain's
// deliberate 6x exaggeration by accident. 1.0 is the physically honest value.
uniform float uCraterReliefGain;
${HEIGHT_NOISE_UNIFORMS_GLSL}
uniform vec3 lightDir;
uniform vec3 lightDir2;
uniform vec3 starColor1;
uniform vec3 starColor2;
uniform float starBrightness1;
uniform float starBrightness2;
uniform float time;
uniform int planetType;
uniform float planetRadius;
uniform float hasClouds;
uniform vec3 cloudColor;
uniform float cloudDensity;
uniform float cloudScale;
uniform float atmosphereStrength;
uniform vec3 atmosphereColor;
// ── World-engine air optics (port: the limb / rim glow) ──
// The rim used to be a hard-coded pow(fresnel, 3.0) tinted by the game's whole-body atmosphereColor
// — the same narrow blue-line profile on Venus, Titan and Earth alike. These come from
// atmosphereOpticsOf(), the SAME module the lab imports, so the rim now reads the body's physics:
// Rayleigh blue for a clear column, tholin orange for a cold organic haze, sulfur cream for a hot
// thick shroud, and a fat detached halo (exponent -> 1.8) instead of a narrow line when the column
// is optically thick.
// uLimbMix is the A/B dial AND the safety valve: at 0.0 this body renders byte-identically to before.
uniform float uLimbMix;
uniform float uLimbExponent;
uniform vec3 uLimbColor;
// ── Terminator tint ──
// The hue a column TRANSMITS at grazing incidence, as opposed to what it scatters at the limb:
// clear air reddens (sunset), a cold organic haze transmits mauve, a thin dry wisp inverts to blue.
// Same shared module as the limb. Additive only — it never darkens — and uTermStrength = 0 skips
// the block entirely, which is the byte-identical off switch (the lab's own F35 contract).
uniform float uTermStrength;
uniform float uTermWidth;
uniform vec3 uTermColor;
// ── Biosphere ground cover ──
// uBioGroundCover = biosphereOf(condition): liquid water x atmosphere x volatiles x time x not-frozen.
// ⚠ Vegetation is DARKER than the rock it grows on (canopy albedo ~0.15-0.25), so a living world's
// disc gets DARKER, not greener — the opposite of what "add a green tint" would do. uBioGroundCover = 0
// leaves the land byte-identical.
uniform float uBioGroundCover;
uniform vec3 uBioGroundColor;
// Shadow casters
uniform vec3 starPos1;
uniform vec3 starPos2;
const int MAX_SHADOW_MOONS = 6;
uniform int shadowMoonCount;
uniform vec3 shadowMoonPos[6];
uniform float shadowMoonRadius[6];
const int MAX_SHADOW_PLANETS = 2;
uniform int shadowPlanetCount;
uniform vec3 shadowPlanetPos[2];
uniform float shadowPlanetRadius[2];
// LOD level for detail switching
uniform int lodLevel;

varying vec3 vNormal;
varying vec3 vPosition;
varying vec3 vWorldPos;
varying vec3 vViewDir;

// ── Simplex-like noise (GPU version) ──
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);

  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);

  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;

  i = mod289(i);
  vec4 p = permute(permute(permute(
    i.z + vec4(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0));

  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);

  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);

  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);

  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}

// ── 4x4 Bayer dithering threshold ──
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

// ── Edge-dithered posterization ──
vec3 posterize(vec3 color, vec2 levels, vec2 fragCoord, float edgeWidth) {
  float dither = bayerDither(fragCoord) - 0.5;
  vec3 dithered = color + dither * (edgeWidth * levels.y);  // ⭐ B2P — levels.y is the reciprocal CARRIED FROM THE CPU (posterizeLevels.js 'POSTERIZE_QUANTUM'), and THE INNER PARENTHESES ARE LOAD-BEARING. Pre-B2P was 'dither * edgeWidth / 6.0' with BOTH operands literal, which the compiler folds into ONE constant multiply; parity therefore needs one multiply by that same constant, which '(edgeWidth * levels.y)' reproduces and '(dither * edgeWidth) * levels.y' does not. MEASURED on ANGLE/SwiftShader Vulkan over 12,582,912 knife-edge samples (6,291,456 per edgeWidth): this form 0 divergences from the bed3235 programs at edgeWidth 0.4 AND 0.6. The two forms that FAIL: the round-2 'dither * edgeWidth * inv' = 4 divergences at 0.4 and 1 at 0.6, max byte delta 43; and a shader-DERIVED '1.0 / levels' with these same parentheses = 0 at 0.4 but 5 at 0.6, because the compiler re-folds 'edgeWidth * (1.0 / levels)' back into a divide. Runtime '1.0/6.0' is itself bit-exact (0x3e2aaaab); it is the RE-FOLDING an opaque uniform denies. Also 0 differing across the FULL input domain (8,388,608 float32 samples, both edgeWidths) and 0 bytes differing in unorm8; and gl-reach's seven whole programs each render 0 px differ vs bed3235. Scope: ANGLE/SwiftShader Vulkan — not proven on every driver. ⛔ RIDES THIS LINE.
  return floor(dithered * levels.x + 0.5) * levels.y;  // B2P — the SECOND divide. '* levels.y' is a plain reciprocal multiply by the carried constant, and matched pre-B2P's folded '/ 6.0' in every one of the 12,582,912 samples above. levels.x is the quantum itself; both components ride ONE uniform, so a level and its reciprocal cannot drift apart.
}

// ── Ray-sphere shadow test ──
// Returns 0.0 (full shadow) to 1.0 (no shadow)
float sphereShadow(vec3 fragPos, vec3 starPosition, vec3 casterPos, float casterRadius) {
  vec3 toStar = starPosition - fragPos;
  float distToStar = length(toStar);
  vec3 rayDir = toStar / distToStar;
  vec3 oc = casterPos - fragPos;
  float tca = dot(oc, rayDir);
  if (tca < 0.0) return 1.0;
  if (tca > distToStar) return 1.0;
  float d2 = dot(oc, oc) - tca * tca;
  if (d2 >= casterRadius * casterRadius * 1.3) return 1.0;
  return smoothstep(casterRadius * 0.85, casterRadius * 1.15, sqrt(d2));
}

// Total shadow factor for one star from all casters
float totalShadow(vec3 fragPos, vec3 starPosition) {
  float shadow = 1.0;
  for (int i = 0; i < MAX_SHADOW_MOONS; i++) {
    if (i >= shadowMoonCount) break;
    shadow *= sphereShadow(fragPos, starPosition, shadowMoonPos[i], shadowMoonRadius[i]);
  }
  for (int i = 0; i < MAX_SHADOW_PLANETS; i++) {
    if (i >= shadowPlanetCount) break;
    shadow *= sphereShadow(fragPos, starPosition, shadowPlanetPos[i], shadowPlanetRadius[i]);
  }
  return shadow;
}

// ── Aurora uniforms + function ──
// Physics-driven: requires atmosphere + magnetic field + stellar wind.
// Added as shared function so all planet categories can use it.
uniform float hasAurora;
uniform vec3 auroraColor;
uniform float auroraIntensity;
uniform float auroraRingLat;
uniform float auroraRingWidth;

vec3 applyAurora(vec3 color, vec3 pos, float pRadius, vec3 lDir, float diff) {
  if (hasAurora < 0.5) return color;
  // Night-side mask: aurora visible in darkness and twilight
  float nightMask = 1.0 - smoothstep(0.0, 0.25, diff);
  // Latitude from equator (object-space Y, normalized)
  float lat = abs(pos.y) / pRadius;
  // Ring shape: Gaussian band at the auroral latitude
  float ringDist = abs(lat - auroraRingLat);
  float ringMask = exp(-ringDist * ringDist / (2.0 * auroraRingWidth * auroraRingWidth));
  // Curtain-like structure from noise
  float azimuth = atan(pos.z, pos.x);
  float curtain = snoise(vec3(azimuth * 3.0, lat * 10.0, time * 0.3)) * 0.5 + 0.5;
  curtain += snoise(vec3(azimuth * 7.0, lat * 15.0, time * 0.5)) * 0.25;
  float rays = pow(max(curtain, 0.0), 2.0);
  // Combine
  float auroraMask = ringMask * rays * nightMask * auroraIntensity;
  // Subtle hue variation along the ring
  float hueShift = snoise(vec3(azimuth * 2.0, 0.0, time * 0.2)) * 0.15;
  vec3 auroraFinal = auroraColor;
  auroraFinal.r += hueShift;
  auroraFinal.g -= hueShift * 0.5;
  return color + auroraFinal * auroraMask * 0.6;
}

// ── Analytic-derivative height noise, transcribed from the world-engine lab ──
// hash3 / noised / fbmd, byte-identical to planet-lod-height.glsl.js and held that way by
// tests/height-noise-transcription.test.js. fbmd returns vec4(height, gradient.xyz).
${HEIGHT_NOISE_GLSL}

// The land path computes its base relief ONCE per fragment and both consumers read it here:
// getSurfacePattern takes .x for colour banding, the normal path takes .yzw for shading.
// Held RAW — each consumer applies its own measured gain, because the value spread, the
// continent spread and the gradient spread are three different calibrations and folding them
// into one constant would make none of them measurable. Zero on shader variants that never
// call fbmd, which is why the normal path gates on uReliefMix and not on this being non-zero.
vec4 gReliefD = vec4(0.0);

// ── Relief normal from fbmd's ANALYTIC gradient ──
// The legacy finite-difference path below pays 3 full computeHeight() evaluations — 12 snoise
// calls — to APPROXIMATE this gradient. fbmd already accumulated the exact one, chain-ruled
// per octave, so the land path gets a better normal for less work.
// Same construction as the finite-difference version: both remove the gradient's tangential
// component from N. The old one builds an explicit T/B frame and takes two directional
// derivatives; projecting out the normal component is that same operation with no frame to
// build, because T and B span exactly the plane being projected onto.
// ⚠ The gradient is divided by the base frequency, and that division is load-bearing.
// fbmd's gradient is d(height)/d(position), so it scales LINEARLY with frequency — and this
// game's noiseScale spans ~100x (generated bodies run 1.5-5.0; hand-authored KnownSystems
// bodies run 15-332 against a tiny object radius). Feeding the raw gradient through the
// legacy 0.025 constant deflects the normal 64deg on Ceres against legacy's 17deg: clamped,
// harsh, and wrong. Dividing by the base frequency makes the term a dimensionless SLOPE, which
// is what a normal perturbation actually wants, and one constant then fits every body.
//
// Why legacy hid this: perturbNormalFromNoise finite-differences with a fixed eps = 0.01 in
// OBJECT space, and Ceres' whole object radius is 0.00315. The step is larger than the planet,
// so legacy's "gradient" on those bodies is decorrelated noise, not slope. Its 17deg is an
// undersampling artifact. This path does not reproduce it — see the register.
//
// ⚠ craterSlope is NOT summed into grad before the division, and that is load-bearing. fbmd's
// gradient is d(height)/d(objectPos) and only becomes a slope after dividing by the base frequency;
// the crater gradient is ALREADY a slope, because uCraterAmp * uCraterScale == 1 exactly (see
// craterUniforms.js). Adding them early would rescale every crater by noiseScale, which spans ~100x
// across this game's bodies. The gate is a uniform, so at uCraterDensity 0 this function is
// bit-identical to the version that had no crater term at all — the negative control.
vec3 perturbNormalAnalytic(vec3 N, vec3 grad, vec3 craterSlope, float strength) {
  float baseFreq = uNoiseScale * 0.3 * uDispDomainScale;   // fbmd's octave-0 frequency
  vec3 gt = (grad - N * dot(grad, N)) / max(baseFreq, 1e-6);
  if (uCraterDensity > 0.0) {
    vec3 cs = craterSlope * uCraterReliefGain;
    gt += cs - N * dot(cs, N);
  }
  float scale = strength * 0.025 * uReliefNormalGain;
  vec3 perturbed = normalize(N - gt * scale);
  // Same 60deg clamp as the legacy path: a normal that flips away from the light reads as a
  // pure black patch, which is worse than under-shaded relief.
  float deviation = dot(perturbed, N);
  if (deviation < 0.5) {
    perturbed = normalize(mix(perturbed, N, 0.5));
  }
  return perturbed;
}

// ── Heightmap normal perturbation from procedural noise ──
// Multi-octave FBM "height" with large-scale impact basins and fine
// terrain detail. Sampled via finite differences along the tangent
// plane to produce perturbed normals for convincing relief.
float computeHeight(vec3 pos) {
  // Large-scale features: impact basins, hemispheric differences
  float h = snoise(pos * noiseScale * 0.3) * 0.5;
  // Medium terrain: mountain ranges, large craters
  h += snoise(pos * noiseScale) * 0.35;
  // Fine detail: small craters, ridges, roughness
  h += snoise(pos * noiseScale * 2.0) * 0.2;
  h += snoise(pos * noiseScale * 4.0) * 0.1;
  return h;
}

vec3 perturbNormalFromNoise(vec3 N, vec3 pos, float strength) {
  vec3 up = abs(N.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
  vec3 T = normalize(cross(up, N));
  vec3 B = cross(N, T);

  float eps = 0.01;
  float h0 = computeHeight(pos);
  float hT = computeHeight(pos + T * eps);
  float hB = computeHeight(pos + B * eps);

  // Raw gradient can be ~10-20 due to noise frequency; scale down
  // so strength 0.25 = visible relief, not flipped normals
  float dT = (hT - h0) / eps;
  float dB = (hB - h0) / eps;
  float scale = strength * 0.025;

  vec3 perturbed = normalize(N - T * dT * scale - B * dB * scale);
  // Clamp: perturbed normal must stay within ~60deg of geometric normal.
  // Prevents normals from flipping away from the light -> pure black patches.
  float deviation = dot(perturbed, N);
  if (deviation < 0.5) {
    perturbed = normalize(mix(perturbed, N, 0.5));
  }
  return perturbed;
}
`;

// ─────────────────────────────────────────────────────────────────────────────
// Category 1 — Gas Giants (types: gas-giant=1, hot-jupiter=6, eyeball=7, sub-neptune=10)
// Band patterns, swirls, thermal glow, polar darkening
// ─────────────────────────────────────────────────────────────────────────────
const GAS_BODY = /* glsl */ `
float getSurfacePattern(vec3 pos) {
  float n = snoise(pos * noiseScale);
  n += snoise(pos * noiseScale * 2.0) * noiseDetail * 0.5;

  if (planetType == 1) {
    // Gas giant: Jupiter-like with multiple bands, turbulence, storms
    float lat = pos.y * noiseScale;
    float bands = sin(lat * 3.5) * 0.5
                + sin(lat * 7.0 + 0.5) * 0.3
                + sin(lat * 13.0) * 0.12;
    float turb = snoise(pos * noiseScale * 2.0) * 0.35
               + snoise(pos * noiseScale * 4.0) * 0.15;
    bands += turb * (1.0 - abs(bands));
    float storm = snoise(pos * noiseScale * 0.5 + vec3(50.0, 0.0, 0.0));
    storm = pow(max(storm, 0.0), 4.0);
    n = bands * 0.5 + 0.5 + storm * 0.4;
  } else if (planetType == 6) {
    // Hot Jupiter: chaotic swirls, less banding than normal gas giant
    float lat = pos.y * noiseScale;
    float bands = sin(lat * 2.5) * 0.3 + sin(lat * 5.0) * 0.15;
    float swirl = snoise(pos * noiseScale * 1.5) * 0.5
                + snoise(pos * noiseScale * 3.0) * 0.25;
    n = bands + swirl;
  } else if (planetType == 7) {
    // Eyeball: concentric climate rings centered on the sub-stellar point
    float angDist = acos(clamp(dot(normalize(vWorldPos), lightDir), -1.0, 1.0));
    float ringNoise = snoise(pos * noiseScale * 2.0) * 0.15;
    n = angDist + ringNoise;
  } else if (planetType == 10) {
    // Sub-Neptune: very smooth, subtle banding, hazy appearance
    float lat = pos.y * noiseScale;
    float bands = sin(lat * 3.0) * 0.1 + sin(lat * 6.0) * 0.05;
    float haze = snoise(pos * noiseScale * 0.7) * 0.08;
    n = 0.5 + bands + haze;
  }

  return n;
}

void main() {
  #include <logdepthbuf_fragment>
  float pattern = getSurfacePattern(vPosition);

  // ── Surface color (type-dependent) ──
  vec3 surfaceColor;

  if (planetType == 1) {
    // Gas giant: zones, belts, storms
    float bandVal = pattern;
    float zoneMask = smoothstep(0.42, 0.58, bandVal);
    surfaceColor = mix(baseColor, accentColor, zoneMask);

    vec3 stormColor = baseColor * 0.5 + vec3(0.3, 0.1, 0.05);
    float stormMask = smoothstep(0.78, 0.88, bandVal);
    surfaceColor = mix(surfaceColor, stormColor, stormMask);

    float polarDark = smoothstep(0.6, 1.0, abs(vPosition.y) / planetRadius);
    surfaceColor *= 1.0 - polarDark * 0.3;
  } else if (planetType == 6) {
    // Hot Jupiter: dark base with glowing day-side heat
    float swirl = pattern * 0.5 + 0.5;
    surfaceColor = mix(baseColor, baseColor * 1.3, swirl);

    // Thermal glow: use world-space pos so it stays fixed toward the sun
    float starFacing = max(dot(normalize(vWorldPos), lightDir), 0.0);
    float hotspot = pow(starFacing, 3.0);
    vec3 glowColor = accentColor;
    surfaceColor += glowColor * hotspot * 0.8;

    // Night side thermal glow — very faint deep red
    float nightSide = max(-dot(normalize(vWorldPos), lightDir), 0.0);
    surfaceColor += vec3(0.15, 0.03, 0.01) * nightSide * 0.5;
  } else if (planetType == 7) {
    // Eyeball planet: concentric climate zones
    float angDist = pattern;

    vec3 oceanColor = baseColor;
    vec3 landColor = accentColor;
    vec3 iceColor = vec3(0.82, 0.85, 0.9);
    vec3 frozenColor = vec3(0.7, 0.72, 0.78);

    float oceanMask = 1.0 - smoothstep(0.3, 0.5, angDist);
    float landMask = smoothstep(0.3, 0.5, angDist) * (1.0 - smoothstep(0.8, 1.0, angDist));
    float iceMask = smoothstep(0.8, 1.0, angDist) * (1.0 - smoothstep(1.5, 1.8, angDist));
    float frozenMask = smoothstep(1.5, 1.8, angDist);

    surfaceColor = oceanColor * oceanMask
                 + landColor * landMask
                 + iceColor * iceMask
                 + frozenColor * frozenMask;
  } else {
    // Sub-Neptune (10): smooth, muted, hazy blend
    float val = pattern;
    surfaceColor = mix(baseColor, accentColor, val);
  }

  // ── Normal perturbation ──
  // Gas giants are cloud surfaces — no terrain relief. Skip perturbation.
  vec3 shadingNormal = vNormal;

  // ── Dual-star Lighting with Shadows ──
  float diff1 = max(dot(shadingNormal, lightDir), 0.0);
  float diff2 = max(dot(shadingNormal, lightDir2), 0.0);

  float shadow1 = totalShadow(vWorldPos, starPos1);
  float shadow2 = totalShadow(vWorldPos, starPos2);

  vec3 starLight = starColor1 * diff1 * starBrightness1 * shadow1
                 + starColor2 * diff2 * starBrightness2 * shadow2;
  float diffuse = diff1 * starBrightness1 * shadow1 + diff2 * starBrightness2 * shadow2;

  float ambient = 0.035;
  // Hot Jupiter: slightly more ambient from thermal glow
  if (planetType == 6) {
    ambient = 0.04;
  }

  vec3 finalColor = surfaceColor * (starLight + vec3(ambient));

  // Hot Jupiter: add emissive glow that doesn't depend on light
  if (planetType == 6) {
    float starFacing = max(dot(normalize(vWorldPos), lightDir), 0.0);
    float hotspot = pow(starFacing, 3.0);
    finalColor += accentColor * hotspot * 0.3;
    // Night side deep red emission
    float nightSide = max(-dot(normalize(vWorldPos), lightDir), 0.0);
    finalColor += vec3(0.12, 0.02, 0.0) * pow(nightSide, 0.8) * 0.4;
  }

  // ── Cloud layer (animated) ──
  if (hasClouds > 0.5) {
    float cloudSpeed = (planetType == 7) ? 0.005 : 0.017;
    vec3 cloudPos = vPosition * cloudScale + vec3(time * cloudSpeed, time * cloudSpeed * 0.4, 0.0);
    float cn = snoise(cloudPos);
    cn += snoise(cloudPos * 2.0) * 0.4;
    cn += snoise(cloudPos * 4.0) * 0.2;
    cn += snoise(cloudPos * 8.0) * 0.1;
    float cloudMask = smoothstep(0.05, 0.15, cn) * cloudDensity;
    float cloudLight = diffuse * 0.9;
    finalColor = mix(finalColor, cloudColor * cloudLight, cloudMask);
  }

  // ── Atmosphere rim glow (fresnel, lit side only) ──
  if (atmosphereStrength > 0.0) {
    vec3 viewDir = normalize(vViewDir);
    float fresnel = 1.0 - max(dot(vNormal, viewDir), 0.0);
    fresnel = pow(fresnel, mix(3.0, uLimbExponent, uLimbMix));
    float sunFacing = smoothstep(-0.1, 0.3, diffuse);

    // Sub-Neptune: atmosphere glow wraps further around
    if (planetType == 10) {
      sunFacing = smoothstep(-0.3, 0.2, diffuse);
    }

    finalColor += mix(atmosphereColor, uLimbColor, uLimbMix) * fresnel * atmosphereStrength * sunFacing * 0.5;
  }

  // ── Terminator tint (port: atmosphereOpticsOf termColor) ──
  // A gaussian centred on the day/night line: mu = 0 at the terminator, so exp(-tt*tt) peaks
  // exactly there and falls off into both the lit side and the night side. Additive only, per the
  // lab's rule that this channel never darkens. uTermStrength = 0 skips it entirely and is the
  // byte-identical off switch.
  if (uTermStrength > 0.0) {
    // SIGNED mu, geometric normal, primary star, unshadowed. Clamped diffuse is 0 across the
    // ENTIRE night hemisphere, which made this a half-gaussian anchored at PEAK over the whole
    // night side instead of a band at the day/night line. vNormal rather than shadingNormal keeps
    // the lab's rule that relief never bends twilight; no shadow term, so an eclipse umbra cannot
    // bloom it on the lit side; no starBrightness weighting, so a dim companion cannot widen the
    // band. This is the lab's mu = dot(N, uLightDir) in planet-lod-shaders.glsl.js.
    float muTerm = dot(vNormal, lightDir);
    float tt = muTerm / max(uTermWidth, 1e-3);
    finalColor += uTermColor * uTermStrength * exp(-tt * tt);
  }

  // ── Aurora (night-side glow near magnetic poles) ──
  finalColor = applyAurora(finalColor, vPosition, planetRadius, lightDir, diffuse);

  // ── Posterize with edge dithering ──
  finalColor = min(finalColor, vec3(1.0));
  finalColor = posterize(finalColor, uPosterizeLevels, gl_FragCoord.xy, 0.4);

  gl_FragColor = vec4(finalColor, 1.0);
}
`;

// ─────────────────────────────────────────────────────────────────────────────
// Category 2 — Rocky/Terrestrial (types: rocky=0, ice=2, lava=3, ocean=4,
//              terrestrial=5, venus=8, carbon=9)
// Terrain noise, cracks, continents, seas, volcanic glow
// ─────────────────────────────────────────────────────────────────────────────
const ROCKY_BODY = /* glsl */ `
${CRATER_RELIEF_GLSL}

// The impact record's own accumulator. Separate from gReliefD because the two gradients live in
// different spaces — see perturbNormalAnalytic. Height is in planet radii; slope is dimensionless.
// Zero on every body whose world-engine schedule keeps no crater record, which is most of them.
float gCraterH = 0.0;
vec3  gCraterSlope = vec3(0.0);

float getSurfacePattern(vec3 pos) {
  // ── Slice 3: the analytic-derivative base, computed ONCE for both consumers ──
  // Deliberately does NOT replace this function. Each per-type branch below carries real
  // character — lava ridging, ice cracking, continents, venus banding, carbon facets — and
  // flattening them into one lab-style combiner chain would be a large uncommanded visual
  // regression. Slice 3's first increment swaps only what each branch uses as its BASE.
  // Both sides are gated on uReliefMix rather than blended unconditionally. The branch is on a
  // UNIFORM, so it is perfectly coherent across the draw and costs nothing on the GPU — and it
  // is what makes the A/B honest: at mix 0 the shader pays the legacy cost and NOT fbmd's, at
  // mix 1 it pays fbmd's and not the legacy stack's. Blending would have had every planet pay
  // for both fields forever and would have compared new+old against new+old.
  gReliefD = (uReliefMix > 0.001) ? fbmd(pos, uReliefOctaves, 0.0) : vec4(0.0);

  // ── Rung 4, first landform: the impact record. ──
  // Its own domain (the unit direction, because the crater law is ANGULAR — uCraterScale is crater
  // diameters per planet RADIUS) and its own accumulator. The gate is the derived density, so a body
  // the world engine says kept no craters costs exactly one uniform compare. Deliberately NOT folded
  // into n: craters here are relief, and relief in this game is read as SHADING — n also carries
  // the land/sea threshold, and pushing metre-scale crater depth through uReliefGain would move it.
  if (uCraterDensity > 0.0) {
    initProvinces(normalize(pos)); craterEjectaCombiner(normalize(pos), gCraterH, gCraterSlope);   // ⭐ initProvinces WAS LIFTED OUT OF THE COMBINER, 2026-08-26, so the combiner body can be the ONE SHARED SOURCE for lab and game — Max: "we need to converge; I need to be able to stop saying this, that the lab and game need to have the same rendering system". The lab has always initialised the province field once per fragment BEFORE its feature combiners (planetShaders.glsl.js:209, planet-lod-rivers.js:329); the game did it INSIDE craterEjectaCombiner, and that single call was the last host-specific line in the body. It is pure in its argument and both calls take the same normalize(pos), so NO PIXEL MOVES — which is exactly why the render cannot prove the change landed, and why crater-uniform-law.test.js carries a structural arm that reds if the call goes back inside. ⛔ NO NAMED TEMP, AND TWO STATEMENTS ON ONE LINE WITH THE COMMENT LAST, ON PURPOSE, TWICE OVER: this file carries symbol-anchored citations down to line 2251 of itself and adding a line here broke 149 of them on the first attempt; and this is inside a GLSL template literal, where a // comment swallows every statement after it on the line. ⛔ NO BACKTICK MAY APPEAR IN THIS COMMENT — one ends the literal early and silently un-collects the suite, which is how the first attempt failed. ⭐ AND normalize(pos) IS WRITTEN TWICE RATHER THAN BOUND TO A TEMP, DELIBERATELY: a local here lands in the shared-region name set that material-parity-list.test.js pins, and it tripped that ratchet at 26 -> 27. The ratchet is right to fire and the handoff's rule is that an addition is REMOVED rather than re-blessed unless it earns a ledger row; a temp for one normalize does not. The duplicate costs one normalize per fragment against the 27 hash33 evaluations this pass already pays, which is noise.
  }

  float n;
  if (uReliefMix >= 0.999) {
    n = gReliefD.x * uReliefGain;
  } else {
    float nOld = snoise(pos * noiseScale);
    nOld += snoise(pos * noiseScale * 2.0) * noiseDetail * 0.5;
    n = mix(nOld, gReliefD.x * uReliefGain, uReliefMix);
  }

  if (planetType == 3) {
    // Lava: sharp glowing cracks
    n = 1.0 - abs(n);
    n = pow(n, 2.0);
  } else if (planetType == 2) {
    // Ice: subtle cracks overlaid on smooth surface
    float cracks = 1.0 - abs(snoise(pos * noiseScale * 3.0));
    cracks = pow(cracks, 4.0);
    n = n * 0.3 + 0.5 + cracks * 0.3;
  } else if (planetType == 5) {
    // Terrestrial: continent-like shapes with ragged coastlines.
    // This 4-octave stack IS terrestrial's base — it overwrites n entirely — so it is what
    // slice 3 has to replace here. Swapping only the shared n above would leave every
    // terrestrial world, the one type where sea level is actually visible, on legacy relief.
    // Its own gain: this stack is wider than the 2-octave default base, and the sea-level
    // threshold sits directly on it, so an unmatched spread drowns or beaches the continents.
    float continent;
    if (uReliefMix >= 0.999) {
      continent = gReliefD.x * uReliefGainCont;
    } else {
      float cOld = snoise(pos * noiseScale * 0.7);
      cOld += snoise(pos * noiseScale * 1.5) * 0.3;
      cOld += snoise(pos * noiseScale * 3.0) * 0.15;
      cOld += snoise(pos * noiseScale * 6.0) * 0.08;
      continent = mix(cOld, gReliefD.x * uReliefGainCont, uReliefMix);
    }
    n = continent;
  } else if (planetType == 8) {
    // Venus: very subtle, slow-moving banding beneath thick clouds
    float lat = pos.y * noiseScale;
    float bands = sin(lat * 2.0) * 0.15 + sin(lat * 4.0) * 0.08;
    float swirl = snoise(pos * noiseScale * 0.8) * 0.12;
    n = 0.5 + bands + swirl;
  } else if (planetType == 9) {
    // Carbon: dark surface with occasional bright crystalline facets
    float base = snoise(pos * noiseScale) * 0.3;
    float crystal = snoise(pos * noiseScale * 5.0);
    crystal = pow(max(crystal, 0.0), 8.0);
    n = base * 0.5 + 0.4 + crystal * 0.6;
  }
  // rocky (0) and ocean (4) use the default n from above

  return n;
}

void main() {
  #include <logdepthbuf_fragment>
  float pattern = getSurfacePattern(vPosition);

  // ── Surface color (type-dependent) ──
  vec3 surfaceColor;

  // Track land vs water for perturbation masking (terrestrial/ocean types)
  float terrainLandMask = 1.0; // default: everything is "land" (gets perturbation)

  if (planetType == 5) {
    // Terrestrial: ocean + varied terrain with elevation zones
    float height = pattern * 0.5 + 0.5;
    float seaLevel = 0.45;
    float landMask = step(seaLevel, height);
    terrainLandMask = landMask; // store for perturbation masking

    // Ocean: depth-based color gradient
    vec3 deepOcean = baseColor * 0.8;
    float oceanDepth = smoothstep(seaLevel - 0.3, seaLevel, height);
    vec3 shallowOcean = baseColor * 1.1;
    vec3 ocean = mix(deepOcean, shallowOcean, oceanDepth);

    // Land: elevation-based terrain zones
    float landElev = smoothstep(seaLevel, seaLevel + 0.35, height);
    // Coastal lowlands. WAS commented "green vegetation" and set to accentColor — a per-planet
    // random colour standing in for a biosphere, on every terrestrial world whether or not one
    // could live there. The actual cover is now derived below from uBioGroundCover; this stays as the
    // low-elevation base tone.
    vec3 lowland = accentColor;
    // Mid-elevation: sediment — the weathered surface ground up and moved downhill. Derived, so it
    // inherits this world's oxidation state (a rusty world gets pale rusty basins, not beige ones).
    vec3 midland = uSedColor;
    // Highland: the weathered bedrock background. WAS a hard-coded vec3(0.42,0.38,0.34) shared by
    // every planet in the game — the same defect the lab retired for uWeatheredColor.
    vec3 highland = uWeatheredColor;
    // Peaks: fresh unweathered rock, exposed where erosion strips the weathering rind. WAS a
    // hard-coded vec3(0.6,0.58,0.55).
    vec3 peak = uFreshColor;

    // Blend through zones
    vec3 land = lowland;
    land = mix(land, midland, smoothstep(0.2, 0.45, landElev));
    land = mix(land, highland, smoothstep(0.5, 0.75, landElev));
    land = mix(land, peak, smoothstep(0.8, 0.95, landElev));

    // ── Biosphere ground cover (port: biosphereOf) ──
    // Applied AFTER the terrain zones — it grows on whatever crust is there — but BEFORE the ocean
    // mix and the ice caps, so open water covers it and a polar cap still wins on top of it. That
    // ordering is the lab's, and it is the reason this sits here rather than at the end.
    // vegElev is a treeline: cover thins with altitude. The lab also modulates by slope (a steep
    // face sheds soil faster than it forms) and by basin enrichment (water collects in the sinks);
    // this branch has neither a slope nor a province term, so both are DEFERRED rather than faked.
    if (uBioGroundCover > 0.0) {
      float vegElev = 1.0 - smoothstep(0.55, 0.9, landElev);
      land = mix(land, uBioGroundColor, clamp(uBioGroundCover * vegElev, 0.0, 1.0));
    }

    // Add local variation so terrain isn't pure bands
    float terrainNoise = snoise(vPosition * noiseScale * 4.0) * 0.08;
    land += vec3(terrainNoise, terrainNoise * 0.8, terrainNoise * 0.5);

    surfaceColor = mix(ocean, land, landMask);

    // Ice caps at planet's rotational poles (object-space Y, not world Y)
    float latitude = abs(vPosition.y) / planetRadius;
    float iceNoise = snoise(vPosition * noiseScale * 2.0) * 0.15;
    float iceMask = smoothstep(0.55, 0.7, latitude + iceNoise);
    vec3 iceColor = vec3(0.85, 0.88, 0.92);
    surfaceColor = mix(surfaceColor, iceColor, iceMask);
  } else if (planetType == 4) {
    // Ocean world: mostly water with sparse islands
    float height = pattern * 0.5 + 0.5;
    float seaLevel = 0.55;
    terrainLandMask = smoothstep(seaLevel - 0.01, seaLevel + 0.03, height);

    // Ocean depth gradient
    vec3 deepOcean = baseColor * 0.75;
    float oceanDepth = smoothstep(seaLevel - 0.3, seaLevel, height);
    vec3 ocean = mix(deepOcean, baseColor * 1.1, oceanDepth);

    // Sparse island land
    float landElev = smoothstep(seaLevel, seaLevel + 0.2, height);
    vec3 land = mix(accentColor, accentColor * 0.7 + vec3(0.12, 0.1, 0.06), landElev);

    surfaceColor = mix(ocean, land, terrainLandMask);
  } else if (planetType == 8) {
    // Venus: nearly featureless, low-contrast cream/yellow clouds
    float val = pattern;
    surfaceColor = mix(baseColor, accentColor, val);
  } else if (planetType == 9) {
    // Carbon: very dark with rare bright diamond glints
    float val = pattern;
    surfaceColor = mix(baseColor, accentColor, smoothstep(0.3, 0.6, val));

    // Diamond glints: bright white specular points
    float glint = smoothstep(0.85, 0.95, val);
    surfaceColor += vec3(0.8, 0.85, 0.9) * glint;
  } else if (planetType == 0 || planetType == 2) {
    // Rocky AND ice share ONE condition-derived path. This branch used to be rocky-only, with ice
    // falling through to the legacy mix(baseColor, accentColor) below; merging them DELETES a type
    // branch rather than adding one, which is the whole point of the condition-first engine.
    //
    // The ground is the derived bedrock palette — weathered background, fresh rock where relief
    // exposes it, sediment pooling in the lows — and then uIcenessMix (= icenessOf(cond)) decides how
    // much of that ground is ICE instead. Nothing here asks what the planet is CALLED: a cold,
    // volatile-rich, low-density body reads icy because of its density, volatile budget and
    // temperature, and a body labelled 'ice' sitting at 1100 K correctly reads as bare hot rock.
    // Same construction as the lab's Stage-6 mix(albedoCol, uIcenessAlbedo, uIcenessMix).
    // (No backticks in this comment on purpose: it lives inside a JS template literal, and a stray
    // one terminates the shader string and breaks the whole module with a bare SyntaxError.)
    float h = pattern * 0.5 + 0.5;
    vec3 rock = mix(uWeatheredColor, uFreshColor, smoothstep(0.45, 0.8, h));
    vec3 ground = mix(uSedColor, rock, smoothstep(0.15, 0.42, h));
    surfaceColor = mix(ground, uIceColor, uIcenessMix);
  } else if (planetType == 3) {
    // Lava: dark crust cut by incandescent cracks. Both colours are now derived.
    //
    // The CRUST is the same bedrock palette every other rocky surface uses — and it needs no special
    // darkening here, because surfaceMaterial's melt stage already mixes the whole palette toward
    // quenched melt glass above 900 K, so a genuinely molten world's rock arrives dark on its own.
    //
    // The CRACKS are the blackbody curve sampled TWICE — uLavaCrust at the chilled skin on the crack
    // margin, uLavaGlow at the liquidus in its core — replacing a 15-entry hand-picked table that
    // offered violet, magenta, cyan and green "lava". Two samples because the measured between-world
    // melt spread is tiny; the range that reads as lava is the one across a single crack. The crack
    // MASK is the legacy curve, unchanged, so this swaps hue without moving the pattern.
    float h = pattern * 0.5 + 0.5;
    vec3 crust = mix(uWeatheredColor, uFreshColor, smoothstep(0.45, 0.8, h));
    vec3 melt = mix(uLavaCrust, uLavaGlow, smoothstep(0.62, 0.95, h));
    surfaceColor = mix(crust, melt, smoothstep(0.3, 0.7, h));
  } else {
    // Default: smooth blend between base and accent (any rocky-family type not derived above)
    float mixFactor = smoothstep(0.3, 0.7, pattern * 0.5 + 0.5);
    surfaceColor = mix(baseColor, accentColor, mixFactor);
  }

  // ── Normal perturbation ──
  // Rocky/airless: strong relief. Atmospheric: softer. Water: none.
  float perturbStrength = 0.25; // rocky, ice, carbon — airless, cratered
  if (planetType == 3) perturbStrength = 0.20;  // lava: visible but not dominant
  if (planetType == 4) perturbStrength = 0.20;  // ocean: land parts only (masked below)
  if (planetType == 5) perturbStrength = 0.20;  // terrestrial: land parts only (masked below)
  if (planetType == 8) perturbStrength = 0.0;   // venus: hidden by thick clouds
  // Water is flat from space — only perturb land areas
  perturbStrength *= terrainLandMask;
  // Slice 3: on the land path the relief normal comes from fbmd's analytic gradient, already
  // accumulated by getSurfacePattern. The legacy finite-difference call stays reachable at
  // uReliefMix 0 — that is the negative control, and it is also the fallback if a body ever
  // renders this variant without having run the fbmd base.
  vec3 shadingNormal;
  if (perturbStrength <= 0.001) {
    shadingNormal = vNormal;
  } else if (uReliefMix > 0.001) {
    shadingNormal = perturbNormalAnalytic(vNormal, gReliefD.yzw, gCraterSlope, perturbStrength);
  } else {
    shadingNormal = perturbNormalFromNoise(vNormal, vPosition, perturbStrength);
  }

  // ── Dual-star Lighting with Shadows ──
  float diff1 = max(dot(shadingNormal, lightDir), 0.0);
  float diff2 = max(dot(shadingNormal, lightDir2), 0.0);

  float shadow1 = totalShadow(vWorldPos, starPos1);
  float shadow2 = totalShadow(vWorldPos, starPos2);

  vec3 starLight = starColor1 * diff1 * starBrightness1 * shadow1
                 + starColor2 * diff2 * starBrightness2 * shadow2;
  float diffuse = diff1 * starBrightness1 * shadow1 + diff2 * starBrightness2 * shadow2;

  float ambient = 0.035;

  vec3 finalColor = surfaceColor * (starLight + vec3(ambient));

  // Carbon: diamond glints are emissive (glow in shadow too)
  if (planetType == 9) {
    float crystal = snoise(vPosition * noiseScale * 5.0);
    crystal = pow(max(crystal, 0.0), 8.0);
    float glint = smoothstep(0.85, 0.95, crystal * 0.6 + 0.4 + snoise(vPosition * noiseScale) * 0.15);
    finalColor += vec3(0.5, 0.55, 0.6) * glint * 0.3;
  }

  // Lava: the cracks are SELF-LUMINOUS, so they survive into the night side (same construction as the
  // carbon glints above). Deriving the crack colour from a melt temperature and then only showing it
  // in sunlight would be incoherent — incandescence is exactly the thing that does not need a star.
  // Gated on the same crack mask the surface colour uses, so the glow lands on the cracks and nowhere
  // else, and kept subtle enough that the day side still reads as lit rock rather than a light bulb.
  if (planetType == 3) {
    float h = pattern * 0.5 + 0.5;
    float crackGlow = smoothstep(0.55, 0.95, h);
    finalColor += mix(uLavaCrust, uLavaGlow, smoothstep(0.62, 0.95, h)) * crackGlow * 0.45;
  }

  // ── Cloud / weather layer (animated) ──
  if (hasClouds > 0.5) {
    float cloudSpeed = 0.005;

    if (planetType == 5) {
      // ── Terrestrial weather system ──
      // Latitude-dependent cloud bands (Earth-like circulation)
      float lat = abs(vPosition.y) / planetRadius;

      // ITCZ near equator (0-10°), storm tracks (30-60°), polar (70+°)
      float itcz = exp(-lat * lat / (2.0 * 0.08 * 0.08)) * 0.6;
      float stormTrack = exp(-(lat - 0.55) * (lat - 0.55) / (2.0 * 0.15 * 0.15)) * 0.8;
      float polar = smoothstep(0.65, 0.85, lat) * 0.4;
      float latBias = itcz + stormTrack + polar;

      // Base cloud noise with domain warping for swirling patterns
      vec3 cloudPos = vPosition * cloudScale + vec3(time * cloudSpeed, 0.0, 0.0);
      // Domain warp: offset the sampling position by noise → creates swirls
      float warpX = snoise(cloudPos * 0.5 + vec3(0.0, 0.0, time * 0.002)) * 0.3;
      float warpZ = snoise(cloudPos * 0.5 + vec3(50.0, 0.0, time * 0.002)) * 0.3;
      vec3 warpedPos = cloudPos + vec3(warpX, 0.0, warpZ);

      float cn = snoise(warpedPos);
      cn += snoise(warpedPos * 2.0) * 0.4;
      cn += snoise(warpedPos * 4.0) * 0.15;

      // Combine FBM with latitude bias
      float cloudMask = smoothstep(-0.1, 0.25, cn + latBias * 0.3) * cloudDensity;

      // Clouds are brighter on the sun-facing side, dimmer in shadow
      float cloudLight = max(diffuse * 0.85, 0.06);
      finalColor = mix(finalColor, cloudColor * cloudLight, cloudMask);

    } else if (planetType == 0) {
      // ── Rocky planet dust clouds (Mars-like) ──
      // Large regional dust storms, very thin, patchy
      vec3 dustPos = vPosition * cloudScale * 0.6 + vec3(time * 0.002, 0.0, 0.0);
      float dust = snoise(dustPos * 0.5);
      dust += snoise(dustPos * 1.0) * 0.4;
      // Only the densest patches show — mostly clear
      float dustMask = smoothstep(0.3, 0.6, dust) * cloudDensity;
      float dustLight = max(diffuse * 0.9, 0.04);
      finalColor = mix(finalColor, cloudColor * dustLight, dustMask);

    } else {
      // ── Generic clouds (Venus surface view, other types) ──
      vec3 cloudPos = vPosition * cloudScale + vec3(time * 0.017, time * 0.007, 0.0);
      float cn = snoise(cloudPos);
      cn += snoise(cloudPos * 2.0) * 0.4;
      cn += snoise(cloudPos * 4.0) * 0.2;
      cn += snoise(cloudPos * 8.0) * 0.1;
      float cloudMask = smoothstep(0.05, 0.15, cn) * cloudDensity;
      float cloudLight = max(diffuse * 0.9, 0.04);
      finalColor = mix(finalColor, cloudColor * cloudLight, cloudMask);
    }
  }

  // ── Atmosphere rim glow (fresnel, lit side only) ──
  if (atmosphereStrength > 0.0) {
    vec3 viewDir = normalize(vViewDir);
    float fresnel = 1.0 - max(dot(vNormal, viewDir), 0.0);
    fresnel = pow(fresnel, mix(3.0, uLimbExponent, uLimbMix));
    float sunFacing = smoothstep(-0.1, 0.3, diffuse);

    // Venus: atmosphere glow wraps further around
    if (planetType == 8) {
      sunFacing = smoothstep(-0.3, 0.2, diffuse);
    }

    finalColor += mix(atmosphereColor, uLimbColor, uLimbMix) * fresnel * atmosphereStrength * sunFacing * 0.5;
  }

  // ── Terminator tint (port: atmosphereOpticsOf termColor) ──
  // A gaussian centred on the day/night line: mu = 0 at the terminator, so exp(-tt*tt) peaks
  // exactly there and falls off into both the lit side and the night side. Additive only, per the
  // lab's rule that this channel never darkens. uTermStrength = 0 skips it entirely and is the
  // byte-identical off switch.
  if (uTermStrength > 0.0) {
    // SIGNED mu, geometric normal, primary star, unshadowed. Clamped diffuse is 0 across the
    // ENTIRE night hemisphere, which made this a half-gaussian anchored at PEAK over the whole
    // night side instead of a band at the day/night line. vNormal rather than shadingNormal keeps
    // the lab's rule that relief never bends twilight; no shadow term, so an eclipse umbra cannot
    // bloom it on the lit side; no starBrightness weighting, so a dim companion cannot widen the
    // band. This is the lab's mu = dot(N, uLightDir) in planet-lod-shaders.glsl.js.
    float muTerm = dot(vNormal, lightDir);
    float tt = muTerm / max(uTermWidth, 1e-3);
    finalColor += uTermColor * uTermStrength * exp(-tt * tt);
  }

  // ── Aurora (night-side glow near magnetic poles) ──
  finalColor = applyAurora(finalColor, vPosition, planetRadius, lightDir, diffuse);

  // ── Posterize with edge dithering ──
  finalColor = min(finalColor, vec3(1.0));
  finalColor = posterize(finalColor, uPosterizeLevels, gl_FragCoord.xy, 0.4);

  gl_FragColor = vec4(finalColor, 1.0);
}
`;

// ─────────────────────────────────────────────────────────────────────────────
// Category 3 — Exotic (types: hex=11, shattered=12, crystal=13, fungal=14,
//              machine=15, city-lights=16, ecumenopolis=17)
// Special visual effects, geometric patterns, bioluminescence
// ─────────────────────────────────────────────────────────────────────────────
const EXOTIC_BODY = /* glsl */ `
// ── Hex grid helper ──
vec3 hexGrid(vec2 p) {
  const vec2 s = vec2(1.0, 1.7320508);
  vec2 a = mod(p, s) - s * 0.5;
  vec2 b = mod(p - s * 0.5, s) - s * 0.5;
  bool useA = dot(a, a) < dot(b, b);
  vec2 gv = useA ? a : b;
  vec2 id = p - gv;
  float edgeDist = 0.5 - max(abs(gv.x), dot(abs(gv), vec2(0.5, 0.86602540)));
  float cellHash = fract(sin(dot(floor(id * 2.0 + 0.5), vec2(127.1, 311.7))) * 43758.5453);
  float border = 1.0 - smoothstep(0.0, 0.05, edgeDist);
  return vec3(border, cellHash, edgeDist);
}

float getSurfacePattern(vec3 pos) {
  float n = snoise(pos * noiseScale);
  n += snoise(pos * noiseScale * 2.0) * noiseDetail * 0.5;

  if (planetType == 11) {
    // Hex: tessellated hexagonal plates (dominant-axis cube projection)
    float scale = noiseScale * 5.0;
    vec3 an = abs(normalize(pos));
    vec2 uv;
    if (an.x > an.y && an.x > an.z) {
      uv = pos.yz;
    } else if (an.y > an.z) {
      uv = pos.xz;
    } else {
      uv = pos.xy;
    }
    vec3 h = hexGrid(uv * scale);
    float border = h.x;
    float cellHash = h.y;
    n = cellHash * 0.5 + border * 0.5;
  } else if (planetType == 12) {
    // Shattered: wide blue-white fracture lines on dark rock
    float crack1 = 1.0 - abs(snoise(pos * noiseScale * 1.5));
    float crack2 = 1.0 - abs(snoise(pos * noiseScale * 0.7 + vec3(50.0)));
    crack1 = pow(crack1, 1.5);
    crack2 = pow(crack2, 1.5);
    float cracks = max(crack1, crack2 * 0.8);
    float node = crack1 * crack2;
    node = pow(node, 0.8);
    n = cracks + node * 0.5;
  } else if (planetType == 13) {
    // Crystal: angular Voronoi facets with gemstone coloring
    vec3 scaledPos = pos * noiseScale * 2.5;
    vec3 cellBase = floor(scaledPos);
    float minDist = 10.0;
    float cellValue = 0.0;
    for (int dx = -1; dx <= 1; dx++) {
      for (int dy = -1; dy <= 1; dy++) {
        for (int dz = -1; dz <= 1; dz++) {
          vec3 neighbor = cellBase + vec3(float(dx), float(dy), float(dz));
          vec3 point = neighbor + fract(sin(vec3(
            dot(neighbor, vec3(127.1, 311.7, 74.7)),
            dot(neighbor, vec3(269.5, 183.3, 246.1)),
            dot(neighbor, vec3(113.5, 271.9, 124.6))
          )) * 43758.5453) * 0.8 + 0.1;
          float d = length(scaledPos - point);
          if (d < minDist) {
            minDist = d;
            cellValue = fract(sin(dot(neighbor, vec3(43.34, 85.17, 67.89))) * 4758.5);
          }
        }
      }
    }
    n = cellValue;
  } else if (planetType == 14) {
    // Fungal: dark base with bioluminescent glow-spot clusters
    float terrain = snoise(pos * noiseScale) * 0.3 + 0.3;
    float spots1 = snoise(pos * noiseScale * 4.0);
    float spots2 = snoise(pos * noiseScale * 6.0 + vec3(100.0));
    float clusterMask = snoise(pos * noiseScale * 0.8) * 0.5 + 0.5;
    clusterMask = smoothstep(0.3, 0.7, clusterMask);
    float glow = max(spots1, spots2);
    glow = pow(max(glow, 0.0), 3.0) * clusterMask;
    n = terrain + glow * 1.5;
  } else if (planetType == 15) {
    // Machine: rectangular circuit grid with lit/dark cells
    vec3 gridPos = pos * noiseScale * 4.0;
    vec3 f = fract(gridPos);
    float lineX = min(f.x, 1.0 - f.x);
    float lineY = min(f.y, 1.0 - f.y);
    float lineZ = min(f.z, 1.0 - f.z);
    float line = min(min(lineX, lineY), lineZ);
    float grid = 1.0 - smoothstep(0.0, 0.06, line);
    float secondLine = min(max(lineX, lineY), max(min(lineX, lineY), lineZ));
    float intersection = grid * (1.0 - smoothstep(0.0, 0.06, secondLine));
    vec3 cellId = floor(gridPos);
    float cellHash = fract(sin(dot(cellId, vec3(12.9898, 78.233, 45.164))) * 43758.5453);
    float cellLit = step(0.55, cellHash);
    n = grid * 0.7 + intersection * 0.3 + cellLit * 0.15;
  } else if (planetType == 16) {
    // City-lights: same continent shapes as terrestrial
    float continent = snoise(pos * noiseScale * 0.7);
    continent += snoise(pos * noiseScale * 1.5) * 0.3;
    continent += snoise(pos * noiseScale * 3.0) * 0.15;
    continent += snoise(pos * noiseScale * 6.0) * 0.08;
    n = continent;
  } else if (planetType == 17) {
    // Ecumenopolis: fine city-block grid covering the whole surface
    vec3 gridPos1 = pos * noiseScale * 6.0;
    vec3 f1 = fract(gridPos1);
    float lx1 = min(f1.x, 1.0 - f1.x);
    float ly1 = min(f1.y, 1.0 - f1.y);
    float lz1 = min(f1.z, 1.0 - f1.z);
    float grid1 = 1.0 - smoothstep(0.0, 0.04, min(min(lx1, ly1), lz1));
    vec3 gridPos2 = pos * noiseScale * 1.5;
    vec3 f2 = fract(gridPos2);
    float lx2 = min(f2.x, 1.0 - f2.x);
    float ly2 = min(f2.y, 1.0 - f2.y);
    float lz2 = min(f2.z, 1.0 - f2.z);
    float grid2 = 1.0 - smoothstep(0.0, 0.06, min(min(lx2, ly2), lz2));
    vec3 cellId = floor(gridPos2);
    float district = fract(sin(dot(cellId, vec3(12.9898, 78.233, 45.164))) * 43758.5453);
    n = grid1 * 0.5 + grid2 * 0.3 + district * 0.2;
  }

  return n;
}

void main() {
  #include <logdepthbuf_fragment>
  float pattern = getSurfacePattern(vPosition);

  // ── Surface color (type-dependent) ──
  vec3 surfaceColor;

  if (planetType == 11) {
    // Hex: cell interior varies per cell, borders are bright accent
    float border = smoothstep(0.4, 0.55, pattern);
    float cellShade = pattern * 2.0 * (1.0 - border);
    surfaceColor = mix(baseColor * 0.7, baseColor * 1.3, cellShade);
    surfaceColor = mix(surfaceColor, accentColor, border);
  } else if (planetType == 12) {
    // Shattered: dark rock with glowing cool-colored fracture lines
    float crackIntensity = smoothstep(0.2, 0.6, pattern);
    surfaceColor = mix(baseColor, accentColor, crackIntensity);
    float hotCrack = smoothstep(0.7, 0.9, pattern);
    surfaceColor += vec3(0.5, 0.5, 0.6) * hotCrack;
  } else if (planetType == 13) {
    // Crystal: flat-shaded facets with bright gemstone highlights
    float facetShade = pattern;
    surfaceColor = mix(baseColor, accentColor, facetShade);
    float highlight = smoothstep(0.8, 0.95, facetShade);
    surfaceColor += vec3(0.6, 0.5, 0.7) * highlight;
  } else if (planetType == 14) {
    // Fungal: dark terrain with bright bioluminescent glow spots
    float terrain = clamp(pattern, 0.0, 0.5);
    float glowAmount = max(pattern - 0.5, 0.0) * 2.0;
    surfaceColor = mix(baseColor * 0.8, baseColor, terrain * 2.0);
    surfaceColor += accentColor * glowAmount;
  } else if (planetType == 15) {
    // Machine: dark metallic base with glowing grid lines
    float gridLine = smoothstep(0.3, 0.5, pattern);
    surfaceColor = mix(baseColor, accentColor, gridLine);
    float bright = smoothstep(0.7, 0.9, pattern);
    surfaceColor += accentColor * 0.5 * bright;
  } else if (planetType == 16) {
    // City-lights: same land/ocean coloring as terrestrial (type 5)
    float height = pattern * 0.5 + 0.5;
    float seaLevel = 0.45;
    float landMask = step(seaLevel, height);
    vec3 deepOcean = baseColor * 0.7;
    float oceanDepth = smoothstep(seaLevel - 0.25, seaLevel, height);
    vec3 ocean = mix(deepOcean, baseColor, oceanDepth);
    float landHeight = smoothstep(seaLevel, seaLevel + 0.3, height);
    vec3 highland = accentColor * 0.6 + vec3(0.15, 0.12, 0.08);
    vec3 land = mix(accentColor, highland, landHeight);
    surfaceColor = mix(ocean, land, landMask);
  } else if (planetType == 17) {
    // Ecumenopolis: steel/concrete surface with warm-toned districts
    float gridLine = smoothstep(0.3, 0.45, pattern);
    float district = clamp(pattern * 1.5, 0.0, 1.0);
    surfaceColor = mix(baseColor * 0.8, baseColor * 1.2, district);
    surfaceColor = mix(surfaceColor, baseColor * 1.5, gridLine * 0.4);
  } else {
    // Fallback
    float mixFactor = smoothstep(0.3, 0.7, pattern * 0.5 + 0.5);
    surfaceColor = mix(baseColor, accentColor, mixFactor);
  }

  // ── Normal perturbation ──
  // Exotic bodies: organic noise relief doesn't fit geometric aesthetics.
  // TODO: type-specific perturbation (hex grid relief, crystal facets, etc.)
  // For now, only shattered and fungal get noise relief (organic shapes fit them).
  float perturbStrength = 0.0;
  if (planetType == 12) perturbStrength = 0.20; // shattered: fractured terrain
  if (planetType == 14) perturbStrength = 0.15; // fungal: organic growth relief
  if (planetType == 16) perturbStrength = 0.18; // city-lights: terrestrial terrain
  vec3 shadingNormal = perturbStrength > 0.001
    ? perturbNormalFromNoise(vNormal, vPosition, perturbStrength)
    : vNormal;

  // ── Dual-star Lighting with Shadows ──
  float diff1 = max(dot(shadingNormal, lightDir), 0.0);
  float diff2 = max(dot(shadingNormal, lightDir2), 0.0);

  float shadow1 = totalShadow(vWorldPos, starPos1);
  float shadow2 = totalShadow(vWorldPos, starPos2);

  vec3 starLight = starColor1 * diff1 * starBrightness1 * shadow1
                 + starColor2 * diff2 * starBrightness2 * shadow2;
  float diffuse = diff1 * starBrightness1 * shadow1 + diff2 * starBrightness2 * shadow2;

  // Emissive exotic types: slightly more ambient (hex=11 and crystal=13 are not emissive)
  float ambient = 0.035;
  if (planetType == 12 || planetType == 14 || planetType == 15 || planetType == 16 || planetType == 17) {
    ambient = 0.04;
  }

  vec3 finalColor = surfaceColor * (starLight + vec3(ambient));

  // Shattered: fracture lines glow on dark side
  if (planetType == 12) {
    float crack1 = 1.0 - abs(snoise(vPosition * noiseScale * 1.5));
    float crack2 = 1.0 - abs(snoise(vPosition * noiseScale * 0.7 + vec3(50.0)));
    float crackGlow = max(pow(crack1, 1.5), pow(crack2, 1.5) * 0.8);
    finalColor += accentColor * crackGlow * 0.25;
  }

  // Fungal: bioluminescent spots glow in darkness
  if (planetType == 14) {
    float spots1 = snoise(vPosition * noiseScale * 4.0);
    float spots2 = snoise(vPosition * noiseScale * 6.0 + vec3(100.0));
    float clusterMask = smoothstep(0.3, 0.7, snoise(vPosition * noiseScale * 0.8) * 0.5 + 0.5);
    float emGlow = pow(max(max(spots1, spots2), 0.0), 3.0) * clusterMask;
    finalColor += accentColor * emGlow * 0.35;
  }

  // Machine: grid lines glow like city lights
  if (planetType == 15) {
    vec3 gridPos = vPosition * noiseScale * 4.0;
    vec3 gf = fract(gridPos);
    float glX = min(gf.x, 1.0 - gf.x);
    float glY = min(gf.y, 1.0 - gf.y);
    float glZ = min(gf.z, 1.0 - gf.z);
    float gLine = min(min(glX, glY), glZ);
    float emGrid = 1.0 - smoothstep(0.0, 0.06, gLine);
    vec3 gCellId = floor(gridPos);
    float gCellHash = fract(sin(dot(gCellId, vec3(12.9898, 78.233, 45.164))) * 43758.5453);
    float gCellLit = step(0.55, gCellHash);
    finalColor += accentColor * (emGrid * 0.2 + gCellLit * 0.08);
  }

  // City-lights: scattered warm lights on night-side land masses
  if (planetType == 16) {
    float nightMask = 1.0 - smoothstep(0.0, 0.15, diffuse);
    float continent = snoise(vPosition * noiseScale * 0.7);
    continent += snoise(vPosition * noiseScale * 1.5) * 0.3;
    continent += snoise(vPosition * noiseScale * 3.0) * 0.15;
    float landMask = step(0.45, continent * 0.5 + 0.5);
    float cities = snoise(vPosition * noiseScale * 8.0);
    cities += snoise(vPosition * noiseScale * 16.0) * 0.5;
    float cityMask = smoothstep(0.2, 0.6, cities) * landMask;
    float coastDist = abs(continent * 0.5 + 0.5 - 0.45);
    float coastBoost = 1.0 + smoothstep(0.15, 0.0, coastDist) * 0.8;
    vec3 cityColor = vec3(0.95, 0.75, 0.3);
    finalColor += cityColor * cityMask * coastBoost * nightMask * 0.3;
  }

  // Ecumenopolis: entire surface glows on night side
  if (planetType == 17) {
    float nightMask = 1.0 - smoothstep(0.0, 0.15, diffuse);
    vec3 gp = vPosition * noiseScale * 6.0;
    vec3 gf2 = fract(gp);
    float glx = min(gf2.x, 1.0 - gf2.x);
    float gly = min(gf2.y, 1.0 - gf2.y);
    float glz = min(gf2.z, 1.0 - gf2.z);
    float cityGrid = 1.0 - smoothstep(0.0, 0.04, min(min(glx, gly), glz));
    vec3 districtId = floor(vPosition * noiseScale * 1.5);
    float districtBright = fract(sin(dot(districtId, vec3(12.9898, 78.233, 45.164))) * 43758.5453);
    districtBright = 0.4 + districtBright * 0.6;
    float areaGlow = 0.5 + cityGrid * 0.5;
    finalColor += accentColor * areaGlow * districtBright * nightMask * 0.45;
  }

  // ── Cloud layer (animated) ──
  if (hasClouds > 0.5) {
    float cloudSpeed = (planetType == 16) ? 0.005 : 0.017;
    vec3 cloudPos = vPosition * cloudScale + vec3(time * cloudSpeed, time * cloudSpeed * 0.4, 0.0);
    float cn = snoise(cloudPos);
    cn += snoise(cloudPos * 2.0) * 0.4;
    cn += snoise(cloudPos * 4.0) * 0.2;
    cn += snoise(cloudPos * 8.0) * 0.1;
    float cloudMask = smoothstep(0.05, 0.15, cn) * cloudDensity;
    float cloudLight = diffuse * 0.9;
    finalColor = mix(finalColor, cloudColor * cloudLight, cloudMask);
  }

  // ── Atmosphere rim glow (fresnel, lit side only) ──
  if (atmosphereStrength > 0.0) {
    vec3 viewDir = normalize(vViewDir);
    float fresnel = 1.0 - max(dot(vNormal, viewDir), 0.0);
    fresnel = pow(fresnel, mix(3.0, uLimbExponent, uLimbMix));
    float sunFacing = smoothstep(-0.1, 0.3, diffuse);

    finalColor += mix(atmosphereColor, uLimbColor, uLimbMix) * fresnel * atmosphereStrength * sunFacing * 0.5;
  }

  // ── Terminator tint (port: atmosphereOpticsOf termColor) ──
  // A gaussian centred on the day/night line: mu = 0 at the terminator, so exp(-tt*tt) peaks
  // exactly there and falls off into both the lit side and the night side. Additive only, per the
  // lab's rule that this channel never darkens. uTermStrength = 0 skips it entirely and is the
  // byte-identical off switch.
  if (uTermStrength > 0.0) {
    // SIGNED mu, geometric normal, primary star, unshadowed. Clamped diffuse is 0 across the
    // ENTIRE night hemisphere, which made this a half-gaussian anchored at PEAK over the whole
    // night side instead of a band at the day/night line. vNormal rather than shadingNormal keeps
    // the lab's rule that relief never bends twilight; no shadow term, so an eclipse umbra cannot
    // bloom it on the lit side; no starBrightness weighting, so a dim companion cannot widen the
    // band. This is the lab's mu = dot(N, uLightDir) in planet-lod-shaders.glsl.js.
    float muTerm = dot(vNormal, lightDir);
    float tt = muTerm / max(uTermWidth, 1e-3);
    finalColor += uTermColor * uTermStrength * exp(-tt * tt);
  }

  // ── Aurora (night-side glow near magnetic poles) ──
  finalColor = applyAurora(finalColor, vPosition, planetRadius, lightDir, diffuse);

  // ── Posterize with edge dithering ──
  finalColor = min(finalColor, vec3(1.0));
  finalColor = posterize(finalColor, uPosterizeLevels, gl_FragCoord.xy, 0.4);

  gl_FragColor = vec4(finalColor, 1.0);
}
`;

// ── Category routing ──
// ── Per-body relief seed (V2-10 port slice 3) ──
// fbmd's macro/detail offsets are what make two planets' relief differ rather than every world
// wearing the same mountains. They have to be deterministic — same body, same relief on every
// load — and they must NOT draw from PlanetGenerator's shared rng stream: one extra draw there
// shifts every downstream value and rewrites the whole generated universe, which is exactly what
// that file's additive-gate discipline protects (and what would churn l0-baseline.json). So the
// seed is derived display-side from scalars the body already carries.
function reliefOffsets(d) {
  // Fold EVERY stable per-body scalar into one accumulator before hashing, so two bodies that
  // happen to share a field (many share noiseScale) still land on different relief.
  const fields = [
    d.noiseScale, d.noiseDetail, d.radiusEarth, d.massEarth,
    d.T_eq, d.axialTilt, d.metallicity, d.eccentricity,
  ];
  let acc = 0;
  for (let i = 0; i < fields.length; i++) {
    const v = Number.isFinite(fields[i]) ? fields[i] : 0;
    acc = acc * 1.618033988749895 + v * (i + 1) * 7.13;
  }
  // Same fract(sin(x)*c) idiom the GLSL side uses. Range is wide enough to decorrelate the
  // octave bands but small enough that hash3's sin() keeps its precision.
  const h = (salt) => {
    const x = Math.sin(acc * 12.9898 + salt * 78.233) * 43758.5453;
    return (x - Math.floor(x)) * 400.0 - 200.0;
  };
  // The crater field needs its own offset for the same reason fbmd does — two worlds that share a
  // noiseScale would otherwise wear the same craters in the same places. Held to a quarter of the
  // relief range: the crater domain is dir * uCraterScale + offset with uCraterScale as low as ~4,
  // so a large offset spends float32 mantissa on magnitude that the voronoi lattice then needs for
  // cell-local precision.
  const hc = (salt) => h(salt) * 0.25;
  return {
    macro: new THREE.Vector3(h(1), h(2), h(3)),
    detail: new THREE.Vector3(h(4), h(5), h(6)),
    crater: new THREE.Vector3(hc(7), hc(8), hc(9)),
  };
}

// ── Relief calibration constants (V2-10 port slice 3) ──
// MEASURED, not guessed. fbmd and the legacy simplex stacks have different spreads, and the
// land/sea threshold sits directly on that spread — an unmatched gain silently drowns or
// beaches every continent. See docs/FEATURES/surface-variation-beyond-mvp.md for the numbers.
const RELIEF_MIX = 1.0;           // 0 = legacy base (the negative control), 1 = analytic fbmd
const RELIEF_OCTAVES = 4.0;       // matches the legacy stack's octave count; the game pays it per planet
// Measured over 462 generated bodies covering all 7 land types (see the register for the run).
// fbmd's octave amplitudes (0.5, 0.25, 0.125, ...) sum to a spread ~3.6x NARROWER than raw
// simplex, and that ratio is a property of the amplitude series, not of the frequency — it held
// flat across a 5x domain-scale sweep. Ship it uncalibrated and the land/sea threshold moves:
// terrestrial land fraction goes 0.571 -> 0.818, beaching a quarter of every ocean.
const RELIEF_GAIN = 3.648;        // fbmd -> default/rocky/ocean base spread (median of 462)
const RELIEF_GAIN_CONT = 3.744;   // fbmd -> terrestrial continent spread    (median of 462)
// The GRADIENT needs its own constant: matching the value spread does not match the gradient
// spread, which also depends on frequency content. Calibrated on DEFLECTION ANGLE rather than
// on raw gradient magnitude, because the angle is what the eye reads as relief strength.
//
// ⭐ RAISED 6.54 -> 39.24 (6x) 2026-07-30. 6.54 was the PARITY value: it held the analytic path
// at legacy's deflection so the fbmd swap could ship without moving anything uncommanded. That
// was step one and it is done. This is step two, and it is a DELIBERATE, VISIBLE increase — the
// fix for the band-collapse item, where ~31% of generated bodies come out with
// landPalette.fresh EXACTLY EQUAL to landPalette.weathered (erosion ~1 kills oxidation, which
// rides 1 - erosion) so the palette gives the surface no elevation separation at all. Colour
// cannot carry that separation on those bodies; shading has to.
//
// WHY 6x, measured over 60 bodies (5 collapsed + 5 intact x 6 land types), as mean local
// luminance gradient over the lit disc with the silhouette eroded 3px — LOCAL contrast, because
// a global luminance SD is dominated by the disc-scale terminator ramp and does not move at all
// when relief changes (measured: it is flat to 12x, which is why it is the wrong gate):
//
//   type              x1 (6.54)   6x (39.24)   lift
//   ice/intact           2.58        5.67      +120%   <- flattest, helped most
//   rocky/intact         2.91        4.99       +71%
//   terrestrial         10.01       11.70       +17%
//   ocean                6.63        7.15        +8%   <- already varied, barely moves
//   lava                 8.22        8.91        +8%
//   carbon               3.38        3.20        -5%   <- inert; overwrites n with its own stack
//
// The gain SELF-LIMITS, and that is the reason to prefer it over a flat brightness/contrast
// lever: on types whose colour stacks already supply contrast (lava ridging, coastlines,
// continents) relief shading is a small addition, so they move ~8-17%; on the flat ones it is
// most of what is there, so they roughly double. It lifts what is flat and leaves alone what
// is not.
//
// SAFETY, measured in-shader by instrumenting the clamp on a throwaway material clone: the 60deg
// clamp in perturbNormalAnalytic fires on 0.000% of land pixels at 6x — and still 0.000% at 12x.
// At 6x the deflection runs median 8.5-10.6deg, p99 16-22deg, max 27.6deg, against a 60deg limit.
// There is headroom left; 8x is the next stop if this reads too subtle.
// ⚠ Tied to RELIEF_DOMAIN_SCALE — perturbNormalAnalytic divides by the base frequency
// it implies, so changing one without re-measuring the other moves every planet's relief.
// The A/B dial is unchanged: uReliefMix 0 still renders the legacy finite-difference normal.
const RELIEF_NORMAL_GAIN = 39.24; // 6x the 6.54 legacy-parity value — see the calibration above
// fbmd computes freq = uNoiseScale * 0.3 * uDispDomainScale. The game wants fbmd's FIRST octave
// to land exactly on the legacy base frequency (noiseScale * 1.0), so the swap changes the noise
// LAW without changing feature size — 1/0.3 does that. It also tightens how well one gain fits
// the population (spread across bodies 4.86 -> 3.15), because on the game's small map-radius
// spheres the un-multiplied first octaves span less than one lattice cell edge to edge.
const RELIEF_DOMAIN_SCALE = 1.0 / 0.3;

// ── Crater relief gain (port slice 3, rung 4) ──
// 1.0 = the physically honest value, and unlike RELIEF_NORMAL_GAIN it needs no population fit,
// because the crater slope is body-independent: uCraterAmp * uCraterScale == 1 EXACTLY (the
// amplitude is the characteristic crater's angular diameter and the scale is its reciprocal), so
// craterEjectaCombiner's gradient reduces to profile'(r) / craterRadius — a pure aspect ratio, the
// same on Ceres as on a super-Earth. That is one calibration this seam does NOT get to fight over.
// It is a separate uniform from uReliefNormalGain on purpose: that one carries a deliberate 6x
// exaggeration of fbmd's terrain, and craters must not inherit it silently.
const CRATER_RELIEF_GAIN = 1.0;

// Desktop 3x3x3 voronoi. 9 (centre slab only) is the lossy mobile path; the game has no quality tier
// wired here yet, so it takes the seam-free one.
const CRATER_VORO_CELLS = 27;

// ── Air-optics A/B dial ─────────────────────────────────────────────────────────────────────────
// 1.0 = the world engine's condition-derived limb. 0.0 = the pre-port hard-coded rim
// (pow(fresnel, 3.0) tinted by atmosphereColor), byte-identical. Kept as a named constant rather
// than inlined so the negative control is one edit, and so a bisect has something to grep for.
const LIMB_MIX = 1.0;

// ── Terminator: THE LAW MOVED, 2026-08-21 (block B3, leg 1) ────────────────────────────────────
// `TERM_STRENGTH` and `termWidthFor` used to be DEFINED here, module-private and unexported, and
// that is exactly why ledger row P-11 could not close: nothing under src/worldengine/ could import
// them, so no driver pack could forward the band to a swapped body and the three `uTerm*` names
// were written by this material and by nothing else. Both now live in
// src/worldengine/base/terminatorOptics.js, imported BACK on the import line at the top of this
// file, so game and world engine call ONE function object — atmosphereOptics.js's shape.
//
// ⛔ THIS BLOCK IS A POINTER STONE AND ITS LINE COUNT IS LOAD-BEARING. It occupies the same number
// of lines the two definitions occupied, because line-anchored citations across this repo point
// BELOW here in Planet.js, and a second lane is editing the same `uniforms:` literal further down.
// Deleting the block outright would have moved every one of those refs and rotted both lanes'
// citations in a single commit. Do not compress it. (An earlier draft put a COUNT on those refs;
// re-measuring gave a different answer, so it is WITHDRAWN, not re-guessed. `wc -l` is the check.)
//
// ⭐ The values did not move. `terminatorOpticsOf(condition)` returns the same
// `(columnFraction ?? 0) * TERM_STRENGTH` and the same log-pressure ramp, character for
// character. The call site is :1610 and the three uniform lines are :1653-1655.

const GAS_TYPES = new Set(['gas-giant', 'hot-jupiter', 'eyeball', 'sub-neptune']);
const ROCKY_TYPES = new Set(['rocky', 'ice', 'lava', 'ocean', 'terrestrial', 'venus', 'carbon']);
// Everything else → EXOTIC

// ── The surface vertex shader ───────────────────────────────────────────────────────────────────
// Hoisted to module scope (was inline in _createSurface) so the warm-up path can build a material
// from the SAME SOURCE STRING the real bodies use. three caches GPU programs by shader source, so
// "same source" is the whole mechanism — a warm-up that retyped this shader would compile a second
// program and warm nothing.
const SURFACE_VERTEX = /* glsl */ `
        #include <common>
        #include <logdepthbuf_pars_vertex>
        varying vec3 vNormal;
        varying vec3 vPosition;
        varying vec3 vWorldPos;
        varying vec3 vViewDir;

        void main() {
          // World-space normal (independent of camera rotation)
          vNormal = normalize(mat3(modelMatrix) * normal);
          vPosition = position;  // object space — for noise sampling
          vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;  // world space — for lighting
          vViewDir = cameraPosition - vWorldPos;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          #include <logdepthbuf_vertex>
        }
      `;

/**
 * The three planet-surface shader variants, by source.
 *
 * Every planet in the game renders one of these three programs — 18 planet TYPES collapse to 3
 * programs because the type only chooses which fragment BODY is concatenated onto the shared
 * header. That is why warming three programs warms the whole game.
 *
 * Source only, deliberately: no uniforms, no geometry, no THREE objects. The consumer that wants a
 * material builds one; the consumer that wants to measure a compile does not need one.
 */
export const PLANET_SHADER_VARIANTS = {
  gas: { vertexShader: SURFACE_VERTEX, fragmentShader: FRAG_HEADER + GAS_BODY },
  rocky: { vertexShader: SURFACE_VERTEX, fragmentShader: FRAG_HEADER + ROCKY_BODY },
  exotic: { vertexShader: SURFACE_VERTEX, fragmentShader: FRAG_HEADER + EXOTIC_BODY },
};

/**
 * Which of the three programs a body of this type will render.
 * Mirrors the branch in _createSurface — keep the two in step.
 * @param {string} type — planetData.type
 * @returns {'gas'|'rocky'|'exotic'}
 */
export function shaderVariantFor(type) {
  if (GAS_TYPES.has(type)) return 'gas';
  if (ROCKY_TYPES.has(type)) return 'rocky';
  return 'exotic';
}

/**
 * The shader source a body of this variant renders, with the measurement cache-bust applied.
 *
 * ⛔ WHY THE CACHE-BUST EXISTS. Chrome keeps a shader DISK cache that serves previously linked
 * binaries across GL contexts *and across page loads*. Any before/after compile-cost measurement on
 * unmodified source therefore times the cache, not the compiler, and will report a warm-up as
 * "free" whether or not it works. Setting window.__shaderCacheBust to anything unique, before
 * the bodies are built prepends a comment to the source, which makes the program genuinely cold.
 *
 * It is read HERE, in the one place both the real bodies and ShaderWarmup's probes go through, so a
 * measurement run cannot accidentally bust one and not the other — which would have the warm-up
 * link a program nothing ever draws, and look like a total failure.
 *
 * Off unless explicitly set; costs one property read per material.
 * ⚠ Assembled with concatenation, not a template literal: the backtick audit on this file
 * (grep -c for backtick LINES, expected 14) exists because a stray backtick inside the GLSL literals
 * breaks the module, and a new literal here would move the number for an unrelated reason.
 *
 * @param {'gas'|'rocky'|'exotic'} variantKey
 * @returns {{vertexShader: string, fragmentShader: string}}
 */
export function planetShaderSource(variantKey) {
  const variant = PLANET_SHADER_VARIANTS[variantKey];
  const bust = (typeof window !== 'undefined' && window.__shaderCacheBust) || null;
  if (!bust) return variant;
  return {
    vertexShader: variant.vertexShader,
    fragmentShader: '// cachebust ' + bust + '\n' + variant.fragmentShader,
  };
}

/**
 * Planet — a sphere with a procedural noise-based surface, optional
 * cloud layer, atmosphere rim glow, and ring system.
 *
 * Uses a THREE.Group as the root (this.mesh) so that:
 * - The surface sphere rotates on its axis
 * - The ring stays fixed (just tilted with axial tilt)
 * - main.js can still use planet.mesh.position etc.
 */
export class Planet {
  constructor(planetData, starInfo = null) {
    this.data = planetData;
    this.mesh = new THREE.Group();
    assignBodyName(this.mesh, 'planet', planetData);
    this._lightDir = new THREE.Vector3(...planetData.sunDirection).normalize();
    this._lightDir2 = new THREE.Vector3(0, 0, 0); this._shadowCast = { starPos1: new THREE.Vector3(), starPos2: new THREE.Vector3(), moonCount: 0, moonPos: [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()], moonRadius: new Float32Array(6), planetCount: 0, planetPos: [new THREE.Vector3(), new THREE.Vector3()], planetRadius: new Float32Array(2) };  // second star (binary systems)   // ⭐⭐ B4-2 (ledger P-03) — THE BODY'S OWN WORLD-SPACE CASTER RECORD, and it exists because the game's caster writes are GUARDED ON THE GAME'S UNIFORM NAMES. src/main.js:11377 if (pu.shadowMoonCount) and its neighbours write straight into the material's uniform bag; a lab material declares none of those names, so every one of those writes is a silent no-op and the feature leaves without throwing. That guard is CORRECT and is not being removed — an unguarded write there once stopped the render loop permanently (see the note at src/main.js:11410). So the caster data is ALSO written here, into plain fields that exist on every Planet whatever material it is wearing, and the lab seam reads them on the render tick. ⛔ ALLOCATED ONCE IN THE CONSTRUCTOR AND MUTATED IN PLACE FOREVER AFTER, exactly like _lightDir above: this is read every frame for every body in the system and a per-frame object literal here would be ~850 allocations a frame on the measured corpus. ⚠ WORLD SPACE HERE, OBJECT SPACE AT THE SHADER — the transform is the seam's job, not this record's, because it depends on the mesh's live world matrix and this record is filled on the SIM tick. ⛔ RIDES THIS LINE — the handoff gate is "every citation-bearing file N added / N deleted" and this file carries symbol-anchored citations down to :2251.

    // Star color/brightness for dual lighting
    this._starColor1 = starInfo?.color1 || [1, 1, 1];
    this._starColor2 = starInfo?.color2 || [0, 0, 0];
    this._starBrightness1 = starInfo?.brightness1 ?? 1.0;
    this._starBrightness2 = starInfo?.brightness2 ?? 0.0;

    // Surface sphere
    this.surface = this._createSurface();
    this.mesh.add(this.surface);

    // Ring system (if any)
    this.ring = this._createRing();
    if (this.ring) {
      if (planetData.rings.tiltX) this.ring.rotation.x += planetData.rings.tiltX;
      if (planetData.rings.tiltZ) this.ring.rotation.z += planetData.rings.tiltZ;
      this.mesh.add(this.ring);
    }

    // Axial tilt applies to the whole group
    this.mesh.rotation.z = this.data.axialTilt;
  }

  _createSurface() {
    // ⭐ SPHERE, NOT ICOSPHERE — the limb is the whole reason. `IcosahedronGeometry(r, 5)` shipped
    // here since March and is 720 triangles: a ~40-gon limb far away that COLLAPSES to 12.8 sides at
    // the 1.05-radius zoom floor (`ShipCameraSystem.js:859`), because the visible cap shrinks as the
    // camera closes while the disc grows. Measured threshold: the game crosses 1 render pixel of limb
    // error at ≈2.6 body radii, so everything inside the autopilot survey stop (`radius * 2.8`) is
    // visibly faceted. The lab has never had this — `world-engine-lab.html:280` is
    // `SphereGeometry(R, 256, 256)`, commented "256 for surface-skimming silhouette".
    //
    // ⛔ THE OBVIOUS FIX — raising the icosphere detail — IS THE WORST OPTION, and the reason is not
    // obvious: `IcosahedronGeometry` is NON-INDEXED. Its 2160 attribute slots carry only 362 distinct
    // positions (6x duplication), so every per-vertex bake runs 2160 times for 362 answers. Measured:
    // an indexed `SphereGeometry(r, 64, 32)` is 2145 verts — FIFTEEN FEWER than what shipped — and
    // still 3.3x the limb quality. `ico d10` needs 3.4x the vertices to match that. 96x48 is chosen
    // for headroom: 4753 verts (2.2x), limb error 0.879 -> 0.118 render px at 2.8 radii, i.e.
    // sub-pixel across the ENTIRE reachable range, at 7% of the lab's vertex cost.
    //
    // Safe because BOTH uv paths derive from position, not from the geometry attribute — the
    // procedural shader builds triplanar uv at `:978` (`pos.yz`/`pos.xz`/`pos.xy`) and the
    // NASA-textured path calls `equirectUV(dir)` at `TexturedBodyShader.js:246`. Nothing reads the
    // sphere's own uv, so the seam and the poles are inert and Sol's 18 textures cannot shift.
    //
    // ⛔ DELIBERATE NON-GOAL: this is NOT geometric LOD. Vertex count is still FIXED at every
    // distance — no tier swaps the mesh, here or anywhere in `src/rendering/`. It cannot be, because
    // neither vertex shader displaces `position` (`:1445`, `:1773`), so vertices buy silhouette and
    // nothing else. Frame cost is unmoved: relief is fragment-side, and tessellation does not change
    // fragment count. The one real cost is spawn-time per-vertex bakes, ~0.62 -> ~1.05 ms per body.
    const geometry = new THREE.SphereGeometry(this.data.radius, 96, 48);
    const d = this.data;
    const reliefSeed = reliefOffsets(d);

    // ── The impact record (port slice 3, rung 4) ────────────────────────────────────────────────
    // Derived HERE rather than in PlanetGenerator so that hand-authored bodies get it too: Sol's
    // Mercury, Moon, Callisto and Ceres never pass through the generator, and they are the bodies in
    // this game that actually keep a crater record (37/39 Sol bodies do; measured 0/504 generated
    // ones do, because every rocky body the game generates retains an atmosphere — see the register).
    // Display-side derivation also means no draw from PlanetGenerator's shared rng stream, the same
    // discipline reliefOffsets follows. Pure arithmetic, once per material.
    // ⭐ STEP 9b — THE GATE IS THE CONDITION, NOT THE `type` LABEL. `ROCKY_TYPES` still picks the
    // shader VARIANT at :1474 and only ROCKY_BODY calls the crater code, so the two now AND together.
    // ⚠ The label gate used to SUPPRESS the derivation; this one does not. Sol's Jupiter (`gas-giant`
    // label, `atmosphere: null` ⇒ 'rocky' condition) now derives density 1.0 into an inert uniform.
    // Derived ONCE and shared by both consumers below. It used to be computed inline inside the
    // crater ternary, i.e. only for rocky bodies; the air optics need it for every body that has an
    // atmosphere at all, gas giants very much included. conditionFromBody is pure, so hoisting it
    // is inert for the crater path.
    const condition = conditionFromBody(d);

    const craters = craterRelevanceOf(condition) > 0
      ? craterUniformsFrom(condition)
      : CRATERS_OFF;

    // ── Air optics (port slice: the limb) ────────────────────────────────────────────────────────
    // atmosphereOpticsOf is not a new module and not a transcription — it is the SAME file the lab
    // imports (world-engine-lab.html:177). The game simply never called it. That is the whole shape of
    // this port: the game becomes a second consumer of what the lab already uses, so a future change
    // to the optics law lands in both without anyone porting anything.
    // ⚠ It returns a CONTINUOUS limbExponent (3.5 - 1.7*thickHaze). ⭐ THE LAB'S BINARY OVERRIDE IS
    // GONE, 2026-08-22, Max's ruling: the lab now takes this module's value at
    // world-engine-lab.html:2478 `state.limbExponent = _atmoOptics.limbExponent;`. This block used to
    // read "a live drift between the lab and the module it imports", and to say reconciling the lab
    // "is NOT done here" — it IS done, and both front-ends now render one limb law. ⛔ Its old ref
    const optics = atmosphereOpticsOf(condition); const term = terminatorOpticsOf(condition);   // ⛔ B3-1 RIDES THIS LINE (see :1403). `term` is the SHARED module the packs read, not a second law.

    // ── Biosphere cover (port: biosphereOf) ────────────────────────────────────────────────────
    // Another module the game already imported and never called. Pure, and every input it reads —
    // atmosphere.pressure, composition.volatileFraction, T_eq, age, icenessOf — is already on the
    // condition vector. Only terrestrial worlds get it: the branch that consumes it is the
    // ocean/land one, and biosphereOf returns ~0 for anything dry or airless anyway.
    const bioCover = biosphereOf(condition);
    const labSurface = Planet._createLabSurface(geometry, d, condition, this._lightDir, this._lightDir2, { color1: this._starColor1, color2: this._starColor2, brightness1: this._starBrightness1, brightness2: this._starBrightness2 });  // PLAN §4 Step 6a/6d/6e   // ⭐ B4-1 — THE DROP THAT WAS P-01 AND P-02, CLOSED HERE. The constructor resolves all four star fields and `_lightDir2` a few dozen lines above, hands them to the legacy material, and used to hand the lab material only `_lightDir`. The record passed is the constructor's ALREADY-RESOLVED values, not the raw starInfo, so a body built with starInfo = null passes (white, black, 1.0, 0.0) — the same identity the builder would have defaulted to. ⛔ RIDES THIS LINE — the handoff gate is "every citation-bearing file N added / N deleted" and this file carries symbol-anchored citations down to :2251.
    if (labSurface) return labSurface;      // world-engine pack bodies leave HERE, flag ON (6e)
    const variant = planetShaderSource(shaderVariantFor(d.type));  // legacy: 3 programs, by type

    const material = new THREE.ShaderMaterial({
      uniforms: {
        baseColor: { value: new THREE.Vector3(...d.baseColor) }, uPosterizeLevels: POSTERIZE_QUANTUM, // B2P — THE SHARED OBJECT ITSELF, never a copy: materials are built once and mutated, so a copy would strand every already-mounted body at its build-time value. ⛔ RIDES THIS LINE.
        accentColor: { value: new THREE.Vector3(...d.accentColor) },
        // World-engine land palette. Falls back to the legacy hard-coded constants when a body
        // predates the derive (e.g. a hand-authored fixture), so nothing renders black.
        uFreshColor: { value: new THREE.Vector3(...(d.landPalette?.fresh || [0.6, 0.58, 0.55])) },
        uWeatheredColor: { value: new THREE.Vector3(...(d.landPalette?.weathered || [0.42, 0.38, 0.34])) },
        uSedColor: { value: new THREE.Vector3(...(d.landPalette?.sediment || [0.48, 0.42, 0.30])) },
        // Slice-2 surface material. Fallbacks keep a hand-authored fixture (one with no world-engine
        // fields) rendering exactly as it did: iceness 0 => the pure bedrock ramp, and the lava glow
        // falls back to accentColor, which is what the legacy lava branch used.
        uIcenessMix: { value: d.iceness ?? 0.0 },
        uIceColor: { value: new THREE.Vector3(...(d.iceColor || [0.86, 0.90, 0.95])) },
        uLavaGlow: { value: new THREE.Vector3(...(d.lavaGlowColor || d.accentColor || [1.0, 0.42, 0.10])) },
        uLavaCrust: { value: new THREE.Vector3(...(d.lavaCrustColor || d.accentColor || [1.0, 0.18, 0.05])) },
        noiseScale: { value: d.noiseScale },
        noiseDetail: { value: d.noiseDetail },
        // ── World-engine air optics ──
        // uLimbMix is the dial and the safety valve; at 0.0 the rim is byte-identical to pre-port.
        uLimbMix: { value: LIMB_MIX },
        uLimbExponent: { value: optics.limbExponent },
        uLimbColor: { value: new THREE.Vector3(...optics.limbColor) },
        // Terminator. The HUE is the shared module's — that is what atmosphereOptics.js owns and
        // says it owns ("derives the limb and terminator hue from condition scalars").
        // STRENGTH and WIDTH are the lab's own laws, and since B3-1 they live in the SHARED module
        // src/worldengine/base/terminatorOptics.js rather than in this file. They were portable all
        // along: they read only atmosphere.pressure and atmosphere.retained, so neither needed
        // anything out of the un-extracted applyDrivers. columnFraction stays as the airless GATE —
        // 0 for airless, ~1 for a full atmosphere — which is what atmosphereOptics.js owns, and it is
        // no longer doing double duty as the magnitude, which is what made the band 6.7x too strong.
        uTermStrength: { value: term.termStrength },
        uTermWidth: { value: term.termWidth },
        uTermColor: { value: new THREE.Vector3(...optics.termColor) },
        // Biosphere. BIO_PIGMENT is the module's own pigment constant, not a colour picked here.
        uBioGroundCover: { value: bioCover },
        // The DISPLAY-TRANSFERRED pigment, not raw BIO_PIGMENT. PlanetGenerator carries it through
        // applyAlbedoTransfer's opts.extra so it rides the same scale as the ground endmembers it
        // is mixed into; pushing the raw physical albedo here made the canopy ~4x darker than the
        // rock it replaces. The fallback is the raw constant only for bodies generated before this
        // field existed, which is a wrong-but-not-crashing path rather than a supported one.
        //
        // NAME: uBioGroundCover / uBioGroundColor, matching planet-lod-uniforms.js:144-145. The
        // lab's uBioColor is F46 BIOLUMINESCENT EMISSIVE (0.30, 0.95, 0.55) — opposite physics on a
        // near-identical name. The first port called this pair uBioCover/uBioColor, which would
        // have had Step 3's by-name driver write a dark daylight canopy albedo into a night-side
        // emissive channel and produce a plausible-looking wrong render.
        uBioGroundColor: { value: new THREE.Vector3(...(d.landPalette?.pigment || BIO_PIGMENT)) },
        // ── World-engine relief (port slice 3) ──
        // uReliefMix is both the A/B dial and the safety valve: at 0.0 this body renders
        // byte-identically to slice 2.
        uReliefMix: { value: RELIEF_MIX },
        uReliefOctaves: { value: RELIEF_OCTAVES },
        uReliefGain: { value: RELIEF_GAIN },
        uReliefGainCont: { value: RELIEF_GAIN_CONT },
        uReliefNormalGain: { value: RELIEF_NORMAL_GAIN },
        // fbmd's own inputs. uNoiseScale mirrors the game's per-body noiseScale — the lab's
        // fbmd reads that name, and the two mean the same thing (base feature frequency).
        // uDispDomainScale is the lab's global domain multiplier; the game is identity.
        uNoiseScale: { value: d.noiseScale },
        uDispDomainScale: { value: RELIEF_DOMAIN_SCALE },
        uFwClamp: { value: 1 },   uCoarseCut: { value: 0.0 },
        uMacroOffset: { value: reliefSeed.macro },
        uDetailOffset: { value: reliefSeed.detail },
        // ── Impact record. uCraterDensity is the gate AND the negative control: at 0.0 the shader
        // early-outs and this body renders byte-identically to the build before rung 4.
        uCraterDensity: { value: craters.density },
        uCraterComplexD: { value: craters.complexD },
        uCraterRelaxation: { value: craters.relaxation },
        uTerraceCount: { value: craters.terraceCount },
        uCraterScale: { value: craters.scale },
        uCraterAmp: { value: craters.amp },
        uCraterOffset: { value: reliefSeed.crater },
        uEjectaStrength: { value: craters.ejectaStrength },
        uEjectaRampart: { value: craters.ejectaRampart },
        uEjectaAmp: { value: craters.ejectaAmp },
        uEjectaLump: { value: craters.ejectaLump },
        // ⭐ 2026-08-25, Max's ruling: the GAME ADOPTS THE LAB'S VERSION of province gating on
        // craters. 1.0 is the lab's own dial default (uniforms.js:469, world-engine-lab.html:918),
        // so the two front-ends now weight craters by the same terrain-region field instead of
        // this path pinning it neutral. 0.0 restores the pre-ruling look exactly.
        uProvinceWeight: { value: 1.0 },
        uVoroCells: { value: CRATER_VORO_CELLS },
        uCraterReliefGain: { value: CRATER_RELIEF_GAIN },
        lightDir: { value: this._lightDir },
        lightDir2: { value: this._lightDir2 },
        starColor1: { value: new THREE.Vector3(...this._starColor1) },
        starColor2: { value: new THREE.Vector3(...this._starColor2) },
        starBrightness1: { value: this._starBrightness1 },
        starBrightness2: { value: this._starBrightness2 },
        time: { value: 0 },
        planetType: { value: this._typeIndex() },
        planetRadius: { value: d.radius },
        // Clouds
        hasClouds: { value: d.clouds ? 1.0 : 0.0 },
        cloudColor: { value: new THREE.Vector3(...(d.clouds?.color || [1, 1, 1])) },
        cloudDensity: { value: d.clouds?.density || 0.0 },
        cloudScale: { value: d.clouds?.scale || 3.0 },
        // Atmosphere
        atmosphereStrength: { value: d.atmosphere?.strength || 0.0 },
        atmosphereColor: { value: new THREE.Vector3(...(d.atmosphere?.color || [0.5, 0.5, 0.8])) },
        // Aurora (physics-driven: atmosphere + magnetic field + stellar wind)
        hasAurora: { value: d.aurora ? 1.0 : 0.0 },
        auroraColor: { value: new THREE.Vector3(...(d.aurora?.color || [0.3, 0.8, 0.4])) },
        auroraIntensity: { value: d.aurora?.intensity || 0.0 },
        auroraRingLat: { value: d.aurora?.ringLatitude || 0.75 },
        auroraRingWidth: { value: d.aurora?.ringWidth || 0.08 },
        // Shadow casters
        starPos1: { value: new THREE.Vector3() },
        starPos2: { value: new THREE.Vector3() },
        shadowMoonCount: { value: 0 },
        shadowMoonPos: { value: Array.from({ length: 6 }, () => new THREE.Vector3()) },
        shadowMoonRadius: { value: new Float32Array(6) },
        shadowPlanetCount: { value: 0 },
        shadowPlanetPos: { value: [new THREE.Vector3(), new THREE.Vector3()] },
        shadowPlanetRadius: { value: new Float32Array(2) },
        // LOD level: 1=orbital (default), 2=close-up (enhanced detail)
        lodLevel: { value: 1 },
      },

      vertexShader: variant.vertexShader,
      fragmentShader: variant.fragmentShader,
    });

    const surface = new THREE.Mesh(geometry, material);
    // ── Instrument E item 4 — the back-link (PLAN §12.3 E-3) ────────────────────────────────────
    // ⛔ THE SCENE WALK YIELDS A BARE MESH AND `d` IS UNREACHABLE FROM IT. `conditionFromBody(d)`
    // above is a local; this method returns a Mesh; the surface is an UNNAMED child of the
    // `body.planet.*` group (named at `assignBodyName(this.mesh, 'planet', planetData);`), so
    // neither the group nor BodyRenderer exposes a path back to the data that produced it. Every
    // instrument that wants to say WHICH body it just measured — E's `resolveBody`, its
    // reproduction line, Step 5's `previewPack`, which must evaluate `pack(condition, ctx)` for
    // THIS body — has to re-derive the condition or guess. Two lines here fix it once, for all of
    // them, rather than each of them re-deriving and drifting.
    // ⚠ `planetData` and not a copy: the freeze hooks write `data.rotationSpeed`, and a snapshot
    // here would make the back-link disagree with the live body the moment anything moved.
    // ⚠ Spread-preserving, matching `assignName`'s own idiom, because LOD and lighting flags are
    // written into `userData` elsewhere and a bare assignment would drop them.
    surface.userData = { ...(surface.userData || {}), wd: { planetData: d, condition } };
    return surface;
  }

  // ⭐⭐ F51 — THE GAME NO LONGER HAS ITS OWN RING. This method used to carry a whole ShaderMaterial:
  // two hardcoded sine waves, sin(t*30.0) and sin(t*12.0), over a Cassini gap at a fixed fraction of
  // the annulus — the same ring on every planet in the galaxy, keyed to nothing: not composition, not
  // age, not moons. src/worldengine/shaders/ringRelief.glsl.js is now the ONE ring program and the LAB
  // draws the same module, so F51 moves from GAME-has-its-own to shared, and a change to the ring is a
  // change to one file.
  //
  // ⛔ THE OLD PROGRAM IS NEUTRALISED IN PLACE BELOW RATHER THAN DELETED — this repo's own convention
  // for line-cited files, not padding. Planet.js carries symbol-anchored citations down to line 2251;
  // deleting this 132-line block broke 183 of them on my first attempt, 53 of those ambiguously, and
  // the citation instrument warns in its own words that a ref repaired to a second wrong line is worse
  // than a stale one because it reads as freshly verified. world-engine-lab.html states the same rule
  // for the same reason. So this replacement is line-neutral and every citation below still resolves.
  //
  // ⚠ WHAT CHANGES VISUALLY, stated plainly because it is not nothing: rings gain real resonance gaps
  // (empty on 33 of 33 ringed planets until 2026-08-27), colour from what the ring is MADE of rather
  // than a generated palette, and a band-limit clamp that fades fine structure to tone at grazing
  // angles — Max's >= 4 render px ruling, measured for rings before any of this was built.
  _createRing() {
    const d = this.data;
    if (!d.rings) return null;

    const innerR = d.radius * d.rings.innerRadius;
    const outerR = d.radius * d.rings.outerRadius;
    const geometry = new THREE.RingGeometry(innerR, outerR, 64);
    geometry.rotateX(Math.PI / 2);   // RingGeometry is in XY; rotate to XZ so it wraps the equator

    const material = new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      uniforms: ringUniformsFrom({
        physics: d.rings.physics, planetRadius: d.radius,
        innerR, outerR, opacity: d.rings.opacity,
        lightDir: this._lightDir, posterizeQuantum: POSTERIZE_QUANTUM,
      }),
      vertexShader: RING_VERTEX_GLSL,
      fragmentShader: RING_FRAGMENT_GLSL,
    });

    return new THREE.Mesh(geometry, material);
  }
  /* ── DEAD SINCE 2026-08-27, KEPT FOR LINE STABILITY — the game's former ring program ──
    _createRing() {
      const d = this.data;
      if (!d.rings) return null;
  
      const innerR = d.radius * d.rings.innerRadius;
      const outerR = d.radius * d.rings.outerRadius;
      const geometry = new THREE.RingGeometry(innerR, outerR, 64);
  
      // RingGeometry is in XY plane — rotate to XZ so it wraps the equator
      geometry.rotateX(Math.PI / 2);
  
      const material = new THREE.ShaderMaterial({
        side: THREE.DoubleSide,
        uniforms: {
          ringColor1: { value: new THREE.Vector3(...d.rings.color1) }, uPosterizeLevels: POSTERIZE_QUANTUM, // B2P — the ring is its OWN program with its OWN posterize copy, so it needs its own entry; wired to the same object so a disc and its ring never quantise differently. ⛔ RIDES THIS LINE.
          ringColor2: { value: new THREE.Vector3(...d.rings.color2) },
          ringOpacity: { value: d.rings.opacity },
          innerRadius: { value: innerR },
          outerRadius: { value: outerR },
          lightDir: { value: this._lightDir },
          planetRadius: { value: d.radius },
          // Moon-cleared gaps (shepherd moon effect)
          moonGapCount: { value: 0 },
          moonGapRadii: { value: new Float32Array(6) },
          moonGapWidths: { value: new Float32Array(6) },
        },
  
        vertexShader: / * glsl * / `
          #include <common>
          #include <logdepthbuf_pars_vertex>
          varying vec3 vPos;
          varying vec3 vRelWorldPos;
  
          void main() {
            vPos = position;
            // Planet-relative world position: extract planet center from modelMatrix
            // and subtract it so shadow math works regardless of orbital position
            vec4 worldPos = modelMatrix * vec4(position, 1.0);
            vec3 planetCenter = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
            vRelWorldPos = worldPos.xyz - planetCenter;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            #include <logdepthbuf_vertex>
          }
        `,
  
        fragmentShader: / * glsl * / `
          #include <logdepthbuf_pars_fragment>
          uniform vec3 ringColor1;
          uniform vec3 ringColor2;
          uniform float ringOpacity;
          uniform float innerRadius;
          uniform float outerRadius;
          uniform vec3 lightDir;
          uniform float planetRadius;  uniform vec2 uPosterizeLevels;   // B2P — the colour quantum as a vec2: .x = levels, .y = its CPU-carried float32 reciprocal. It is a vec2 and not a float so the reciprocal cannot be re-derived (and re-folded into a divide) by the shader compiler; see posterizeLevels.js 'POSTERIZE_QUANTUM'. ⛔ RIDES THIS LINE.
          // Moon-cleared gaps
          const int MAX_MOON_GAPS = 6;
          uniform int moonGapCount;
          uniform float moonGapRadii[6];
          uniform float moonGapWidths[6];
  
          varying vec3 vPos;
          varying vec3 vRelWorldPos;
  
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
  
          vec3 posterize(vec3 color, vec2 levels, vec2 fragCoord, float edgeWidth) {
            float dither = bayerDither(fragCoord) - 0.5;
            vec3 dithered = color + dither * (edgeWidth * levels.y);  // ⭐ B2P — levels.y is the reciprocal CARRIED FROM THE CPU (posterizeLevels.js 'POSTERIZE_QUANTUM'), and THE INNER PARENTHESES ARE LOAD-BEARING. Pre-B2P was 'dither * edgeWidth / 6.0' with BOTH operands literal, which the compiler folds into ONE constant multiply; parity therefore needs one multiply by that same constant, which '(edgeWidth * levels.y)' reproduces and '(dither * edgeWidth) * levels.y' does not. MEASURED on ANGLE/SwiftShader Vulkan over 12,582,912 knife-edge samples (6,291,456 per edgeWidth): this form 0 divergences from the bed3235 programs at edgeWidth 0.4 AND 0.6. The two forms that FAIL: the round-2 'dither * edgeWidth * inv' = 4 divergences at 0.4 and 1 at 0.6, max byte delta 43; and a shader-DERIVED '1.0 / levels' with these same parentheses = 0 at 0.4 but 5 at 0.6, because the compiler re-folds 'edgeWidth * (1.0 / levels)' back into a divide. Runtime '1.0/6.0' is itself bit-exact (0x3e2aaaab); it is the RE-FOLDING an opaque uniform denies. Also 0 differing across the FULL input domain (8,388,608 float32 samples, both edgeWidths) and 0 bytes differing in unorm8; and gl-reach's seven whole programs each render 0 px differ vs bed3235. Scope: ANGLE/SwiftShader Vulkan — not proven on every driver. ⛔ RIDES THIS LINE.
            return floor(dithered * levels.x + 0.5) * levels.y;  // B2P — the SECOND divide. '* levels.y' is a plain reciprocal multiply by the carried constant, and matched pre-B2P's folded '/ 6.0' in every one of the 12,582,912 samples above. levels.x is the quantum itself; both components ride ONE uniform, so a level and its reciprocal cannot drift apart.
          }
  
          void main() {
            #include <logdepthbuf_fragment>
            float dist = length(vPos.xz);
            float t = (dist - innerRadius) / (outerRadius - innerRadius);
  
            float band1 = sin(t * 30.0) * 0.5 + 0.5;
  */
  /**
   * Set ring gaps at moon orbital radii (shepherd moon effect).
   * Call after creating moons, passing the moon data array.
   */
  setRingGaps(moonDataArray) {
    if (!this.ring) return;
    const innerR = this.data.radius * this.data.rings.innerRadius;
    const outerR = this.data.radius * this.data.rings.outerRadius;
    const mat = this.ring.material;
    let gapCount = 0;

    for (const moon of moonDataArray) {
      if (gapCount >= 6) break;
      // Check if moon orbits within the ring bounds
      if (moon.orbitRadius >= innerR && moon.orbitRadius <= outerR) {
        mat.uniforms.moonGapRadii.value[gapCount] = moon.orbitRadius;
        // Gap width scales with moon size — larger moons clear wider gaps
        mat.uniforms.moonGapWidths.value[gapCount] = moon.radius * 4;
        gapCount++;
      }
    }
    mat.uniforms.moonGapCount.value = gapCount;
  }

  /** Map type string to integer for the shader */
  _typeIndex() {
    const types = [
      'rocky', 'gas-giant', 'ice', 'lava', 'ocean', 'terrestrial',
      'hot-jupiter', 'eyeball', 'venus', 'carbon', 'sub-neptune',
      'hex', 'shattered', 'crystal', 'fungal', 'machine',
      'city-lights', 'ecumenopolis',
    ];
    return types.indexOf(this.data.type);
  }

  /**
   * Sim-tick advance (axial rotation of surface + ring). Per Phase 3 wrap
   * decomposition (welldipper-fixed-timestep-migration-2026-05-03 AC #10):
   * orbit/rotation advance is sim-classified — must run on fixed sim dt
   * inside the accumulator's simUpdate callback so the autopilot path-
   * planner sees deterministic body orientations.
   *
   * @param {number} simDt  fixed sim dt (16.667 ms @ 60 Hz).
   * @param {number} [celestialDt=simDt]  simDt × celestialTimeMultiplier per
   *   workstream realistic-celestial-motion-2026-04-27.
   */
  updateSim(simDt, celestialDt = simDt) {
    this.surface.rotation.y += this.data.rotationSpeed * (Math.PI / 180) * celestialDt;

    if (this.ring) {
      this.ring.rotation.y += this.data.rotationSpeed * 0.3 * (Math.PI / 180) * celestialDt;
    }
  }

  /**
   * Render-tick advance (shader animation uniforms). Time-based shader
   * effects (cloud drift, surface noise scroll) are render-classified —
   * they advance at display refresh rate so the visible animation looks
   * smooth on high-refresh displays instead of stair-stepped at 60 Hz.
   *
   * @param {number} renderDt  variable real wall-clock dt.
   */
  updateRender(renderDt) {
    const mat = this.surface.material;
    if (mat.uniforms.time) {
      mat.uniforms.time.value += renderDt;
      // Wrap to prevent float32 precision loss after hours of runtime.
      // 10000s ≈ 2.8 h — noise patterns tile seamlessly at this scale.
      if (mat.uniforms.time.value > 10000) mat.uniforms.time.value -= 10000;
    }
    // ── LAYER 2 items 2 + 3 — the lab material's per-frame half ──
    // ⛔ THIS IS WHY THE GUARD ABOVE WAS NOT ENOUGH. The game's clock uniform is `time`; the lab's
    // is `uTime`. When tryLabShader swaps the lab material onto this surface, `mat.uniforms.time`
    // is undefined, the branch silently does nothing, and every time-driven effect in a 363 KB
    // shader evaluates at t = 0 forever. A no-op guard on a differently-named uniform is
    // indistinguishable from a shader that simply has no animation.
    // The seam also puts the light into OBJECT space, which is what uLightDir has always claimed
    // to be — see updateLabPlanetMaterial for the full note. No-ops on the game's own material.
    updateLabPlanetMaterial(mat, {
      mesh: this.surface,
      lightDirWorld: this._lightDir, lightDirWorld2: this._lightDir2, shadowCast: this._shadowCast,   // ⭐ B4-1 — the second star, per render tick. It has to be re-transformed every frame for exactly the reason the primary does: uLightDir2 is OBJECT space, the body spins, and a direction written once at build would counter-rotate with the crust into one false terminator sweep per body-day. src/main.js re-copies `_lightDir2` in place every sim tick inside its binary branch, so this reads the live vector by reference. ⛔ RIDES THIS LINE — the handoff gate is "every citation-bearing file N added / N deleted" and this file carries symbol-anchored citations down to :2251.   ⭐ B4-2 (ledger P-03) — the caster record, per render tick, for the same reason the second light is re-sent every tick: the seam turns it into OBJECT space and the body spins, so a set of casters transformed once at build would counter-rotate with the crust. Passed BY REFERENCE to the live object src/main.js fills on the sim tick, so nothing is copied here.
      renderDt,
    });
  }

  /**
   * Convenience orchestrator: invokes updateSim + updateRender with the
   * same dt for both. Use the split methods directly for sim/render-
   * decoupled call paths (per Phase 3 migration); use this for legacy
   * call sites that consume a single dt (e.g., gallery preview mode).
   *
   * @param {number} deltaTime
   * @param {number} [celestialDt=deltaTime]
   */
  update(deltaTime, celestialDt = deltaTime) {
    this.updateSim(deltaTime, celestialDt);
    this.updateRender(deltaTime);
  }

  addTo(scene) {
    scene.add(this.mesh);
  }

  dispose() {
    this.surface.geometry.dispose();
    this.surface.material.dispose(); disposeLabBake(this.surface); unregisterStormAB(this.surface); unregisterRaysAB(this.surface); unregisterTermAB(this.surface); unregisterReliefAB(this.surface);   // ⭐ 2026-09-01 — releases the four cube render targets and the ribbon child this body owns (idempotent; a legacy-material body has no record and this is a no-op). RIDES THIS LINE.   // ⭐ 2026-09-03 — the ray A/B's registry is released on the same line for the same reason (idempotent; a legacy-material body has no record).
    if (this.ring) {
      this.ring.geometry.dispose();
      this.ring.material.dispose();
    }
  }

  /**
   * ⭐ THE LAB-PIPELINE BRANCH — PLAN §4 Step 6a (packs), 6d (exclude Sol in CODE), 6e (off-by-
   * default flag). Returns a finished surface Mesh, or `null` = "this body keeps the legacy
   * material", the fall-through. ⛔ STATIC: PLAN Step 10's src/objects/Moon.js calls it too.
   *
   * ⛔ WHY THE MATERIAL IS CHOSEN HERE AND NOT SWAPPED LATER. This selects at material-CREATION
   * time, so for a swapped body the legacy `THREE.ShaderMaterial` below is never constructed at
   * all. That is the reason PLAN 6e says the flag IS Instrument E's OFF twin and
   * `_lab.restoreGameMaterial()` is NOT: there is no registry entry to restore, because there is no
   * legacy material. The OFF frame is the FLAG off plus a reload.
   *
   * ⛔ AND IT IS WHY `labGasBodiesFlag()` IS EXPORTED WITH ITS SOURCE. §12.5 fact 6 requires the
   * flag's live value in every E caption: a visual gate reported as passing in the default
   * configuration is a shot of the code that was not written, and the default here is OFF.
   */
  static _createLabSurface(geometry, d, condition, lightDir, lightDir2 = null, starInfo = null) {   // ⭐ B4-1 — two new OPTIONAL parameters, defaulted to the pre-B4 behaviour so an old three-arg call still builds the identical material. They exist because the constructor two frames up ALREADY HOLDS BOTH and was dropping them at the call site: the lab material then rendered 846 bodies and 632 moons under an implicit white light with no second star (parity-ledger P-01 / P-02). ⛔ RIDES THIS LINE — the handoff gate is "every citation-bearing file N added / N deleted" and this file carries symbol-anchored citations down to :2251.
    const decision = labPipelineAdmits(d, condition);
    if (!decision.admitted) return null;

    // The lab's own material, from the lab's own shader + uniform factory. `bodyRadius` is
    // `d.radius` because src/objects/Planet.js:1549 builds the geometry at exactly that radius —
    // omit it and the noise domain is 23-78x too small, one of the three sufficient causes of the
    // "flat orange" this port already chased once.
    const built = buildLabPlanetMaterial({ lightDir, lightDir2, starInfo, bodyRadius: d.radius });   // B4-1 — lightDir2 + starInfo forwarded. Both are identity when null (factory white x 1.0, zero second direction), so the lab's own route through here is unchanged. ⛔ RIDES THIS LINE — the handoff gate is "every citation-bearing file N added / N deleted" and this file carries symbol-anchored citations down to :2251.
    const material = built.material;

    const pos = geometry.getAttribute('position');
    const packs = applyDriverPacks(material, condition, labPackCtx(d, condition, {
      positions: pos.array, count: pos.count, radius: d.radius,
    }));

    // ⚠ ORDER IS LOAD-BEARING. The bake's arrays go on FIRST and the zero-fill runs SECOND:
    // `ensureLabAttributes` never overwrites an attribute that already exists (that is its own
    // documented contract), so this way the pack owns aBand/aShear/aMush and the zero-fill supplies
    // only aStorm — whose producer PLAN §5 fences out of pack #1 by name. Reversed, the pack's
    // arrays would still land, but "which of these four is a real bake" would stop being readable
    // from the code, and aStorm's zero would stop being a decision.
    for (const name of Object.keys(packs.attributes)) {
      geometry.setAttribute(name, new THREE.BufferAttribute(packs.attributes[name], 1));
    }
    const zeroFilled = ensureLabAttributes(geometry);

    const surface = new THREE.Mesh(geometry, material);
    // The §12.3 E-3 back-link, in the SAME shape the legacy path writes at the end of
    // `_createSurface` — a scene walk yields a bare mesh and `d` is unreachable from it, so an
    // instrument that could name a legacy body but not a swapped one would go blind on exactly the
    // bodies this step ships. `lab` carries what an E caption has to print: the flag AND its source
    // (fact 6), which packs ran, and which attributes are real vs zero-filled.
    surface.userData = {
      ...(surface.userData || {}),
      wd: {
        planetData: d,
        condition,
        lab: {
          isLabPipeline: true,
          flag: decision.flag,
          provenance: decision.provenance,
          packsApplied: packs.applied,
          packsSkipped: packs.skipped,
          uniformsWritten: packs.uniformsWritten,
          gates: packs.gates,
          bakedAttributes: Object.keys(packs.attributes),
          zeroFilledAttributes: zeroFilled.added,
          bodyRadius: built.bodyRadius, starColor1: built.starColor1, starColor2: built.starColor2, starBrightness1: built.starBrightness1, starBrightness2: built.starBrightness2, lightDir2: built.lightDir2,   // ⭐ B4-1 — the star set lands in the E-3 back-link for the same reason the flag and its source do (§12.5 fact 6): a shot that shows a red star and a white-lit planet is the P-01 defect in one frame, and the caption has to be able to PRINT the star colour the body was built with rather than have a reader judge it off the pixels. ⛔ RIDES THIS LINE — the handoff gate is "every citation-bearing file N added / N deleted" and this file carries symbol-anchored citations down to :2251.
          meta: packs.meta,
        },
      },
    };
    attachLabBake(surface, { condition, macroSeed: labMacroSeed(d), T_eq: condition.T_eq, radiusEarth: condition.radiusEarth ?? d.radiusEarth ?? 1 }); registerStormAB(surface, { condition, ctx: labPackCtx(d, condition, null), packs }); registerRaysAB(surface, { condition, ctx: labPackCtx(d, condition, null), packs }); registerTermAB(surface, { condition, ctx: labPackCtx(d, condition, null), packs }); registerReliefAB(surface, { condition, ctx: labPackCtx(d, condition, null), packs }); return surface;   // ⭐ 2026-09-03 THE RAY A/B (key Y) RIDES THIS LINE TOO — it registers EVERY swapped material (planets, moons AND gas), unlike the storm A/B beside it, because the crater driver block runs on both packs so `uRayBrightness` exists on all of them: AC-4's air-bearing and gas 0-px controls are admissible only if `_labRays.record(surface)` comes back NON-NULL on them. // ⭐ 2026-09-03 THE STORM A/B (key I) RIDES THIS LINE TOO — registers the gas material with its pack ctx so `_labStorms` can toggle / sabotage / read back the five uStorm* slots; a no-op on every body stormDeck did not run on (solid bodies). // ⭐ 2026-09-01 THE PROVINCE CUBE, 2026-09-02 THE WHOLE LAB BAKE — RIDES THIS LINE, and it sits AFTER the userData block on purpose: publish() writes the record into userData.wd.lab.province, and the assignment above REPLACES `wd` wholesale, so an earlier attach would be erased. Deferred to first draw (surface.onBeforeRender carries the renderer); solid bodies only (compositionClass !== "gas", condition-derived); Sol never reaches here (labPipelineAdmits refused it above).
  }
}

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// PLAN §4 STEP 6d + 6e — WHO IS ADMITTED TO THE PACK PATH, AND THE FLAG THAT HOLDS IT SHUT
//
// ⛔ EVERYTHING IN THIS FILE'S EDIT FOR STEP 6 LANDS BELOW THE LAST CITED LINE, AND THE THREE NEW
// IMPORTS RIDE AN EXISTING LINE. 50 distinct symbol-anchored `Planet.js:NNN` refs resolve into this
// file from the plan, the carried ledger, the adapter and four test suites; the deepest is :1943 and
// every one of them was verified byte-identical to HEAD after this edit. A four-line import block
// at the top shifts every one of them and `npm run check:instruments` reports them BROKEN. That is
// the instrument working, and the answer is not to bump the integers. The same rule is already
// recorded at e1Regime.js:122 `Three files this lane may not edit cite this module by LINE`.
//
// ⭐ THE ADMISSION TEST IS ONE FUNCTION, AND THAT IS THE POINT OF 6a. Two routes reach
// `_createSurface`: BodyRenderer's planets, and planet-class moons, which are built directly at
// src/main.js:7764 `const planetMoon = new Planet(scenePMData, pmStarInfo);` and never touch
// BodyRenderer. If the branch condition were written inline it would be written once and apply to
// both by luck; when Step 10 added the plain-moon branch — in `src/objects/Moon.js`, not in
// `BodyRenderer.createMoon` as this note predicted — an inline condition would have become a
// SECOND copy of the Sol test. §12.4/E-2 records planet-class moons as the shape that gets missed.
// ═════════════════════════════════════════════════════════════════════════════════════════════════

/** The system seed `generateSolarSystem` stamps on every Sol body. src/generation/SolarSystemData.js:111 `export function generateSolarSystem() {`. */
export const SOL_SYSTEM_SEED = 'sol';

/**
 * World-engine provenance for one `planetData`. PLAN 6d says the branch must not be
 * `d.type === 'gas-giant'` and must key on provenance — "absence of `profileId`".
 *
 * ⚠⚠ ABSENCE OF `profileId` IS NOT, BY ITSELF, A SOL TEST, AND SAYING SO HERE IS THE POINT.
 * Measured against `generateSolarSystem()` on 2026-08-09: Sol carries 39 bodies and only 16 have a
 * `profileId`. FOUR SOL PLANETS HAVE NONE — the 0.074 R⊕ rocky body and three ice bodies at 0.130 /
 * 0.112 / 0.182 R⊕ — and neither do 19 of Sol's moons. Today none of those four is admitted anyway
 * (their `compositionClass` is 'rocky'/'icy', so no pack claims them), which is exactly the kind of
 * accidental safety that stops being true at Step 9, when a rocky pack claims all of them at once.
 * So the test here is a CONJUNCTION and the second clause is the one that closes it:
 *
 *   1. no `profileId`      — PLAN 6d's clause. Excludes Sol's 16 profiled bodies, INCLUDING Uranus
 *                            and Neptune, which are the two Sol planets whose condition really does
 *                            read `compositionClass === 'gas'`. (Jupiter and Saturn do NOT: their
 *                            `atmosphere` is null in SolarSystemData, so the condition-derived
 *                            predicate calls them 'rocky' while their `type` says 'gas-giant'.
 *                            That inversion is why 6d forbids the type branch.)
 *   2. `_systemSeed` present and not `'sol'` — excludes the other 23. It reaches planet-class moons
 *                            too, because src/main.js:7757 `_systemSeed: systemData.seed,` stamps
 *                            the parent system's seed onto `scenePMData` before `new Planet`.
 *
 * ⛔ CORRECTED 2026-08-19 — THE NOTE THAT STOOD HERE WAS FALSE IN BOTH HALVES. It said a PLAIN moon
 * carries neither stamp and that Step 10 would therefore ADMIT SOL'S MOONS. `MoonGenerator` indeed
 * stamps nothing, but `StarSystemGenerator` stamps `_systemSeed`/`_ordinal` onto every plain moon
 * in the very next statement, and `SolarSystemData` stamps `'sol'` on Sol's directly. Condition 2
 * therefore already refuses Sol's plain moons — MEASURED: 0 of 25 admitted with the flag forced ON.
 * Step 10 needs no Sol branch and no Sol test here. Do not act on the note that used to say it did.
 *
 * `_ordinal` is required for a third reason, and it is not about Sol: it is half of the 5d
 * `macroSeed` string. A body missing either half hashes `'undefined:undefined'`, which is one
 * constant seed for the whole population — the 5d hex-collapse defect wearing different clothes,
 * and equally invisible to every gate on driver algebra.
 */
export function worldEngineProvenance(d) {
  const profileId = (d && d.profileId) || null;
  const systemSeed = d && d._systemSeed != null ? d._systemSeed : null;
  const ordinal = d && d._ordinal != null ? d._ordinal : null;
  const blockers = [];
  if (profileId) blockers.push('profileId=' + String(profileId));
  if (systemSeed === null) blockers.push('no _systemSeed');
  else if (String(systemSeed) === SOL_SYSTEM_SEED) blockers.push('_systemSeed=' + SOL_SYSTEM_SEED);
  if (ordinal === null) blockers.push('no _ordinal');
  return { isWorldEngine: blockers.length === 0, profileId, systemSeed, ordinal, blockers };
}

// ── 6e. The flag ─────────────────────────────────────────────────────────────────────────────────
// ⭐⭐ ON BY DEFAULT SINCE B7 / STEP 12, 2026-08-21 — the one node in this program that reaches a player. ⛔⛔ AND STEP 12's OTHER HALF, "delete the legacy `GAS_BODY` branch", IS STRUCK RATHER THAN DEFERRED AGAIN: these three lines used to promise it. It cannot happen. Admission requires `provenance.isWorldEngine` (:2194, "never Sol"), so SOL NEVER ENTERS THIS PIPELINE AT ANY FLAG VALUE — and Sol's 2 `gas-giant` + 2 `sub-neptune` all route through `GAS_TYPES` (:1422) to `PLANET_SHADER_VARIANTS.gas`, i.e. to `GAS_BODY`. Deleting it leaves Jupiter, Saturn, Uranus and Neptune with no fragment shader; `Moon.js`'s legacy shader is load-bearing for Sol's 18 ice + 7 captured moons the same way.
// ⭐ SO THE LEGACY PATH IS PERMANENT RATHER THAN TRANSITIONAL, and calling it a "fallback" is the word that made it look deletable — it is SOL'S RENDERER. Max ruled the strike 2026-08-21. ⛔ RIDES THESE THREE LINES rather than adding any: this file is pinned at 2304 lines and carries the densest citation refs in the tree.
// ⚠ AND THE PRECEDENCE BELOW IS NOW A TRAP WORTH NAMING: a browser carrying `wd.labGasBodies = '0'` from before this commit OUTRANKS the new default and silently keeps the legacy look. CLEARING the key is what follows the default; setting it to '0' is what pins against it.
// Three sources, most explicit first, and every read reports WHICH one answered, because "the flag
// was on" and "the flag defaulted off and the shot shows legacy" are the same picture otherwise.
// `localStorage` is in the list because 6e's OFF frame is "the flag OFF plus a RELOAD at a restored
// camera pose" — a value that does not survive the reload cannot be the twin of one that does.
export const LAB_GAS_BODIES_KEY = 'wd.labGasBodies';
export const LAB_GAS_BODIES_DEFAULT = true;    // ⭐ B7: false -> true. 846 of 852 planets and 632 moons move onto the lab shader.
let _labGasBodiesOverride = null;

/** Force the flag (tests, and the E harness's ON/OFF pair). `null` restores environment reading. */
export function setLabGasBodiesOverride(v) {
  _labGasBodiesOverride = (v === null || v === undefined) ? null : !!v;
}

/** @returns {{enabled: boolean, source: string, default: boolean}} — the live value AND its origin. */
export function labGasBodiesFlag() {
  if (_labGasBodiesOverride !== null) {
    return { enabled: _labGasBodiesOverride, source: 'override', default: LAB_GAS_BODIES_DEFAULT };
  }
  const w = typeof window !== 'undefined' ? window : null;
  if (w && typeof w.__wdLabGasBodies === 'boolean') {
    return { enabled: w.__wdLabGasBodies, source: 'window.__wdLabGasBodies', default: LAB_GAS_BODIES_DEFAULT };
  }
  try {
    const raw = w && w.localStorage ? w.localStorage.getItem(LAB_GAS_BODIES_KEY) : null;
    if (raw === '1' || raw === '0') {
      return { enabled: raw === '1', source: 'localStorage:' + LAB_GAS_BODIES_KEY, default: LAB_GAS_BODIES_DEFAULT };
    }
  } catch (e) { /* private-mode storage throws on read; the default below is the answer */ }
  return { enabled: LAB_GAS_BODIES_DEFAULT, source: 'default', default: LAB_GAS_BODIES_DEFAULT };
}

/** Convenience for call sites that only need the boolean. */
export function labGasBodiesEnabled() { return labGasBodiesFlag().enabled; }

/**
 * The single admission test. THREE independent conditions, each of which can refuse alone:
 *   · the 6e flag is ON,
 *   · the body carries world-engine provenance (6d — never Sol),
 *   · at least one pack's CONDITION-DERIVED predicate claims the body (6a).
 * The third is what makes this grow by an array entry at Steps 9 and 10 instead of by a branch.
 */
export function labPipelineAdmits(d, condition) {
  const flag = labGasBodiesFlag();
  const provenance = worldEngineProvenance(d);
  const packs = condition ? selectPacks(condition).map((e) => e.name) : [];
  return {
    admitted: flag.enabled && provenance.isWorldEngine && packs.length > 0,
    flag, provenance, packs,
  };
}

// ── The game's writer-side context, named here rather than inside the pack ───────────────────────
// PLAN §5c: "Name the game's `animRate` and relevance source explicitly NOW, not at the byte-identity
// gate." Both are properties of the FRONT-END, and the game's answers are degenerate today, which is
// precisely why they are constants with names instead of literals at a call site.
export const GAME_ANIM_RATE = 1.0;         // the lab's `_animRate` GUI knob has no counterpart here
export const GAME_RELEVANCE = Object.freeze({});   // pack #1 keys no per-feature relevance
export const GAME_ROTATION_SCALE = 1.0;    // the lab's rotation multiplier; the game draws 1:1
/** FNV-1a's offset basis — the substitute for an impossible zero hash. See `labMacroSeed`. */
const FNV_OFFSET_BASIS = 0x811c9dc5;

/**
 * The DRAWN spin, in hours, from the game's stored `rotationSpeed` (deg/sec).
 *
 * ⛔ THE PACK ASKS FOR THE DRAWN SPIN AND THE CONDITION VECTOR CANNOT ANSWER IT. `condition
 * .rotationHours` is the preset/canonical value — measured 24 on every generated giant sampled —
 * while the game draws a real per-body rate at src/generation/PlanetGenerator.js:698
 * `rotationSpeed = rot(rng.range(0.033, 0.167) * (rng.chance(0.15) ? -1 : 1));`. Pass the canonical
 * one and every giant in the galaxy takes the same Rhines band count and the same jet drift, which
 * is a distinctness failure no algebraic gate catches because the algebra is correct.
 *
 * The inverse of src/core/CelestialTime.js:68 `export const ROTATION_REALISM_FACTOR = 1 / 24;`:
 * legacy 0.1 deg/s x 1/24 = 4.1667e-3 deg/s is one 24-hour turn, so hours = 360 / (deg/s x 3600).
 * Sign is dropped — a retrograde giant spins at the same RATE, and the pack's `8 / rotationHours`
 * would otherwise clamp to its floor on every retrograde body.
 *
 * @returns {number|null} hours, or null for a tidally-locked body (`rotationSpeed === 0`), which is
 *   NOT a spin of zero hours; null lets the pack's own `?? condition.rotationHours ?? 24` chain
 *   answer, rather than this function inventing a period it has no input for.
 */
export function rotationHoursFromSpeed(rotationSpeedDegPerSec) {
  const s = Math.abs(rotationSpeedDegPerSec ?? 0);
  if (!Number.isFinite(s) || s <= 0) return null;
  return 360 / (s * 3600);
}

/**
 * The 5d `macroSeed`, in the NUMERIC `fnv1aString` shape and never the hex one — `'da81e221' | 0`
 * is 0, `resolveParams` does `macroSeed | 0`, and a zero seed gives every gas giant in the galaxy
 * identical band phases while every gate on driver ALGEBRA still passes.
 * The string is systemSeed:ordinal, the same key the inspection layer already hashes for the body's
 * NAME — scene-naming.js:73 `const fullHex = toHex(fnv1aString(` — so a body's bands and its id
 * cannot come from two different seeds. ⚠ That call takes `toHex` and this one deliberately does
 * NOT: the hex form is the 5d collapse.
 */
export function labMacroSeed(d) {
  return fnv1aString(String(d && d._systemSeed) + ':' + String(d && d._ordinal)) || FNV_OFFSET_BASIS;
}

/** The full Step-5a pack context for one game body. `gates` is deliberately absent — the policy owns it. */
export function labPackCtx(d, condition, mesh) {
  return {
    macroSeed: labMacroSeed(d),
    displayRadiusEarth: gameDisplayRadiusEarth(condition.radiusEarth ?? d.radiusEarth ?? 1),
    animRate: GAME_ANIM_RATE,
    relevance: GAME_RELEVANCE,
    rotationHours: rotationHoursFromSpeed(d.rotationSpeed),
    rotationScale: GAME_ROTATION_SCALE,
    mesh,
    // ⭐ P-13 — THE THREE DOMAIN OFFSETS, CARRIED AT THE ctx LAYER AND NEVER SYNTHESISED IN A PACK.
    // `uMacroOffset` / `uDetailOffset` / `uCraterOffset` default to (0,0,0) on the lab material
    // (src/worldengine/shaders/uniforms.js:158 `uMacroOffset:  { value: new THREE.Vector3() },`), so
    // EVERY body swapped onto it draws its surface field from the SAME noise domain — one relief,
    // repainted. There is no shared seed→vec3 transform to reach for: `reliefOffsets` above and the
    // lab's own scalar sin-hash are two DIFFERENT private laws, and a pack synthesising a third from
    // `macroSeed` would agree with neither while every algebraic gate stayed green. So the FRONT-END
    // answers, exactly as it does for the display policy — and the game's answer is the one it
    // already renders at :1684, :1685 and :1694. Byte-identical to the legacy material BY
    // CONSTRUCTION rather than by measurement.
    // ⛔ APPENDED BELOW `mesh` ON PURPOSE. Live citations from
    // src/worldengine/drivers/polarDeck.js:88 and from the rocky-surface pack's DECISION 1 note
    // point INTO the lines above; inserting anywhere among them rots refs that are correct today,
    // and a repair-by-offset is how a citation stops meaning anything.
    ...labReliefOffsets(d), ...chasmaRiftsFor(labMacroSeed(d)), ...reliefAxesFor(labMacroSeed(d)),   // ⭐ solid-relief-deck 2026-09-04: the FOUR seeded axis families (orogeny/scarp/tessera/lava) RIDE THIS LINE for the identical reason the rift pair does — a condition carries no `seed`, so a pack deriving them would put the whole galaxy on the seed-0 orientation (solidFeatures.js measured that at 1484/1484 and refused F10's axes on it). ⭐ B3-3: F4's rift pair RIDES THIS LINE — appended below `mesh`, never inserted, for the citation reason above; the pack tree cannot answer it because a condition carries no `seed`.
  };
}

/**
 * `reliefOffsets(d)`'s three vectors in the ONLY shape a driver pack may consume — PLAIN 3-ARRAYS,
 * never `THREE.Vector3`.
 *
 * ⛔ THE ARRAY SHAPE IS THE CONTRACT, NOT A CONVENIENCE. The pack tree is fenced out of the renderer
 * (src/worldengine/drivers/index.js:40 `// ⛔ NO RENDERER IN THE CLOSURE — and that is a NARROWER claim than "three-free", deliberately.`),
 * and handing a pack a `Vector3` through `ctx` would put a renderer object in its closure by the
 * back door — invisible to the import-set gate, which reads specifiers and not values. A plain array
 * is also what the writer already accepts
 * (src/worldengine/port/writePackUniforms.js:280 `if (target && typeof target.set === 'function') target.set(...v);`).
 *
 * ⚠ MEASURED ON MOON RECORDS BEFORE THIS SHIPPED, because Step 10 swaps moons and `reliefOffsets`
 * keys on eight `d` scalars a moon record was never guaranteed to carry. Over `lab-procedural-0…199`
 * (852 planets, 665 moons): planets carry all eight; moons carry `noiseScale` and `radiusEarth` on
 * 665/665 and `massEarth`/`T_eq` on 632/665, and carry `noiseDetail`, `axialTilt`, `metallicity` and
 * `eccentricity` on NONE. The four absent ones fold in as 0 through the `Number.isFinite` guard, so
 * there is no NaN and no shared constant: all 665 moons — including the 33 with neither mass nor
 * temperature — come out with distinct macro/detail/crater triples, because `noiseScale` alone is
 * drawn per moon. ⛔ THE DEGENERATE CASE IS REAL AND IS NOT THIS ONE: a record carrying NONE of the
 * eight folds to acc = 0 and every such body shares one triple. That is a fact about a record with
 * no physical fields at all, which is not a body either front-end can render.
 */
export function labReliefOffsets(d) {
  const o = reliefOffsets(d);
  return {
    macroOffset: o.macro.toArray(),
    detailOffset: o.detail.toArray(),
    craterOffset: o.crater.toArray(),
  };
}
