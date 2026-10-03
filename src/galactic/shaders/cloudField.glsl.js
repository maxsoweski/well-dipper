// cloudField.glsl.js — THE GLSL source for the Galactic Engine cloud field and its integrator.
//
// This is the only file that holds cloud shader text (a test fences that). Its CPU twin is
// ../cloudFieldCPU.js: same names, same arithmetic, constants shared through ../cloudConstants.js.
// GLSL ES 3.00 (WebGL2) — the integer hash needs uint arithmetic.

import { HASH_MUL_A, HASH_MUL_B, LUMA, FBM_STD, MAX_STEPS, DEPTH_KNOTS, ATLAS_COLS, ATLAS_ROWS } from '../cloudConstants.js';

const u32 = (n) => `${n >>> 0}u`;
const f = (n) => (Number.isInteger(n) ? `${n}.0` : String(n));

/** Uniform block + field + integrator. Positions: pc, relative to the nebula centre, galactic axes. */
export const CLOUD_FIELD_GLSL = /* glsl */ `
uniform vec3 uObserverPc;
uniform mat3 uRot;
uniform float uRadius;
uniform float uBoundRadius;
uniform float uSoftness;
uniform vec3 uNoiseOffset;
uniform float uNoiseScale;
uniform float uGain;
uniform float uLacunarity;
uniform float uSigma;
uniform float uRidgeGain;
uniform int uOctaves;
uniform vec3 uCavityCentre;
uniform float uCavityRadius;
uniform float uCavityDepth;
uniform vec3 uIonCentre;
uniform float uGlowRadius;
uniform float uOiiiRadius;
uniform float uHardness;
uniform float uEmissionScale;
uniform vec3 uHa;
uniform vec3 uOiii;
uniform float uExtScale;
uniform vec3 uExtRGB;
uniform int uSteps;

const vec3 CLOUD_LUMA = vec3(${f(LUMA[0])}, ${f(LUMA[1])}, ${f(LUMA[2])});

uint hashU(uint x) {
  x ^= x >> 16u;
  x *= ${u32(HASH_MUL_A)};
  x ^= x >> 15u;
  x *= ${u32(HASH_MUL_B)};
  x ^= x >> 16u;
  return x;
}

float lattice(ivec3 c) {
  uvec3 u = uvec3(c + ivec3(1048576));
  uint h = hashU(u.x ^ hashU(u.y ^ hashU(u.z)));
  return float(h >> 8u) / 16777216.0;
}

float valueNoise(vec3 x) {
  vec3 fl = floor(x);
  ivec3 i = ivec3(fl);
  vec3 t = x - fl;
  vec3 u = t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
  float c000 = lattice(i);
  float c100 = lattice(i + ivec3(1, 0, 0));
  float c010 = lattice(i + ivec3(0, 1, 0));
  float c110 = lattice(i + ivec3(1, 1, 0));
  float c001 = lattice(i + ivec3(0, 0, 1));
  float c101 = lattice(i + ivec3(1, 0, 1));
  float c011 = lattice(i + ivec3(0, 1, 1));
  float c111 = lattice(i + ivec3(1, 1, 1));
  float x00 = mix(c000, c100, u.x), x10 = mix(c010, c110, u.x);
  float x01 = mix(c001, c101, u.x), x11 = mix(c011, c111, u.x);
  return mix(mix(x00, x10, u.y), mix(x01, x11, u.y), u.z);
}

float logStructure(vec3 pl) {
  vec3 q = pl / uNoiseScale;
  float sum = 0.0, amp = 0.5, freq = 1.0;
  for (int i = 0; i < 8; i++) {
    if (i >= uOctaves) break;
    sum += amp * (valueNoise(q * freq + uNoiseOffset) - 0.5);
    amp *= uGain;
    freq *= uLacunarity;
  }
  float r = 1.0 - abs(2.0 * valueNoise(q * 2.0 + uNoiseOffset.yzx) - 1.0);
  return uSigma * (sum / ${f(FBM_STD)}) + uRidgeGain * (r * r * r - 0.25) - 0.5 * uSigma * uSigma;
}

float cloudEnvelope(float r) {
  if (uSoftness <= 0.0) return r < uRadius ? 1.0 : 0.0;
  return 1.0 - smoothstep(1.0 - uSoftness, 1.0, r / uRadius);
}

float cloudDensity(vec3 p) {
  float env = cloudEnvelope(length(p));
  if (env <= 0.0) return 0.0;
  vec3 pl = uRot * p;
  float cav = uCavityRadius > 0.0
    ? mix(1.0 - uCavityDepth, 1.0, smoothstep(0.6 * uCavityRadius, uCavityRadius, distance(pl, uCavityCentre)))
    : 1.0;
  return env * cav * exp(logStructure(pl));
}

void sampleMedium(vec3 p, out vec3 j, out vec3 k) {
  float rho = cloudDensity(p);
  j = vec3(0.0);
  k = vec3(0.0);
  if (rho <= 0.0) return;
  vec3 pl = uRot * p;
  float ds = distance(pl, uIonCentre);
  float g = ds / uGlowRadius;
  float x = 0.25 + 0.75 * exp(-g * g);
  float w = uHardness * exp(-ds / uOiiiRadius);
  j = uEmissionScale * rho * x * mix(uHa, uOiii, w);
  k = uExtScale * rho * uExtRGB;
}

// One integrator for every view: radiance L and transmittance T along ro + t*rd, t in [0, inf) ∩ bounds.
// entry = max(entry, 0): a ray that starts inside the cloud needs no special case.
// tau: scalar dust optical depth (k = uExtScale·rho·uExtRGB, so T = exp(-tau·uExtRGB) exactly).
// G: cumulative fraction of tau reached at the DEPTH_KNOTS fractions of the chord (stars read it by distance).
void integrateCloud(vec3 ro, vec3 rd, out vec3 L, out vec3 T, out float tau, out vec4 G) {
  L = vec3(0.0);
  T = vec3(1.0);
  tau = 0.0;
  G = vec4(${DEPTH_KNOTS.map(f).join(', ')});
  float tc = -dot(ro, rd);
  vec3 h = ro + tc * rd;
  float d2 = dot(h, h);
  float R2 = uBoundRadius * uBoundRadius;
  if (d2 >= R2) return;
  float halfChord = sqrt(R2 - d2);
  float t0 = max(tc - halfChord, 0.0);
  float t1 = tc + halfChord;
  if (t1 <= t0) return;
  float dt = (t1 - t0) / float(uSteps);
  float extG = max(uExtRGB.g, 1e-6);
  vec4 knots = G * float(uSteps);
  vec4 acc = vec4(0.0);
  for (int i = 0; i < ${MAX_STEPS}; i++) {
    if (i >= uSteps) break;
    float s = t0 + (float(i) + 0.5) * dt - tc;
    vec3 j, k;
    sampleMedium(h + s * rd, j, k);
    vec3 a = exp(-k * dt);
    vec3 kSafe = max(k, vec3(1e-6));
    L += T * mix(j * dt, j * (1.0 - a) / kSafe, step(vec3(1e-6), k));
    T *= a;
    float fi = float(i);
    float tauNext = tau + (k.g / extG) * dt;
    vec4 inStep = step(vec4(fi), knots) * (1.0 - step(vec4(fi + 1.0), knots));
    acc += inStep * (tau + (tauNext - tau) * (knots - fi));
    tau = tauNext;
  }
  if (tau > 1e-12) G = acc / tau;
}
`;

/** Colour-mode display transform (twin: applyColourMode). Luminance is preserved in both modes. */
export const CLOUD_COLOUR_GLSL = /* glsl */ `
uniform int uColourMode;   // 0 = photo, 1 = realistic
uniform vec3 uRealTint;
uniform vec4 uRealSat;     // satMin, satMax, lumLo, lumHi
vec3 applyColourMode(vec3 L) {
  if (uColourMode != 1) return L;
  float Y = dot(L, vec3(${f(LUMA[0])}, ${f(LUMA[1])}, ${f(LUMA[2])}));
  float sat = uRealSat.x + (uRealSat.y - uRealSat.x) * smoothstep(uRealSat.z, uRealSat.w, Y);
  return mix(Y * uRealTint, L, sat);
}
`;

export const FULLSCREEN_VERT = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

/** Volume pass: one ray per low-res sky pixel → L (target 0) and T (target 1). */
export const CLOUD_VOLUME_FRAG = /* glsl */ `
precision highp float;
precision highp int;
${CLOUD_FIELD_GLSL}
// Ray directions come from the field of view, never the inverse projection: the game's near plane is
// 1e-9, and in float32 the inverse projection's w at the far plane cancels to exactly 0 (every ray NaN).
uniform vec2 uTanHalf;     // (tan(fov/2) * aspect, tan(fov/2))
uniform mat4 uCameraWorld;
in vec2 vUv;
layout(location = 0) out vec4 outL;
layout(location = 1) out vec4 outT;
void main() {
  vec3 rd = normalize(mat3(uCameraWorld) * normalize(vec3((vUv * 2.0 - 1.0) * uTanHalf, -1.0)));
  vec3 L, T;
  float tau;
  vec4 G;
  integrateCloud(uObserverPc, rd, L, T, tau, G);
  outL = vec4(L, 1.0);
  outT = vec4(T, 1.0);
}
`;

/** Sky-bake atlas mapping (twin: ../cubeAtlas.js). Six cube faces in a ${ATLAS_COLS} x ${ATLAS_ROWS} grid of N x N cells;
 *  edge-inclusive texel centres, so shared face edges hold identical rays and filtering is seamless. */
export const CLOUD_ATLAS_GLSL = /* glsl */ `
vec3 cloudFaceDirection(int face, vec2 ab) {
  int m = face / 2;
  float s = (face - 2 * m) == 1 ? -1.0 : 1.0;
  vec3 d = m == 0 ? vec3(s, ab.x, ab.y) : (m == 1 ? vec3(ab.y, s, ab.x) : vec3(ab.x, ab.y, s));
  return normalize(d);
}
// Atlas pixel (gl_FragCoord.xy, pixel centres at .5) → the ray that texel stores.
vec3 cloudAtlasDirection(vec2 fragCoord, float N) {
  vec2 px = floor(fragCoord);
  vec2 cell = floor(px / N);
  int face = int(cell.y) * ${ATLAS_COLS} + int(cell.x);
  vec2 ij = px - cell * N;
  return cloudFaceDirection(face, -1.0 + 2.0 * ij / (N - 1.0));
}
// Direction → atlas UV (bilinear between texel centres; never leaves the face's cell).
vec2 cloudAtlasUV(vec3 d, float N) {
  vec3 ad = abs(d);
  int face;
  vec2 ab;
  if (ad.x >= ad.y && ad.x >= ad.z) { face = d.x < 0.0 ? 1 : 0; ab = d.yz / ad.x; }
  else if (ad.y >= ad.z) { face = d.y < 0.0 ? 3 : 2; ab = vec2(d.z, d.x) / ad.y; }
  else { face = d.z < 0.0 ? 5 : 4; ab = d.xy / ad.z; }
  vec2 xy = clamp((ab + 1.0) * 0.5 * (N - 1.0), 0.0, N - 1.0);
  int row = face / ${ATLAS_COLS};
  vec2 cell = vec2(float(face - row * ${ATLAS_COLS}), float(row));
  return (cell * N + xy + 0.5) / vec2(${f(ATLAS_COLS)} * N, ${f(ATLAS_ROWS)} * N);
}
// Piecewise-linear optical-depth CDF through (0,0), the DEPTH_KNOTS, (1,1) (twin: depthCDF).
float cloudDepthCDF(vec4 G, float f) {
  float x = clamp(f, 0.0, 1.0) * 5.0;
  if (x < 1.0) return G.x * x;
  if (x < 2.0) return mix(G.x, G.y, x - 1.0);
  if (x < 3.0) return mix(G.y, G.z, x - 2.0);
  if (x < 4.0) return mix(G.z, G.w, x - 3.0);
  return mix(G.w, 1.0, x - 4.0);
}
`;

/** Bake pass: one ray per atlas texel (rendered in viewport/scissor tiles) → (L, tau) and the depth CDF G. */
export const CLOUD_BAKE_FRAG = /* glsl */ `
precision highp float;
precision highp int;
${CLOUD_FIELD_GLSL}
${CLOUD_ATLAS_GLSL}
uniform float uAtlasN;
layout(location = 0) out vec4 outLT;
layout(location = 1) out vec4 outG;
void main() {
  vec3 rd = cloudAtlasDirection(gl_FragCoord.xy, uAtlasN);
  vec3 L, T;
  float tau;
  vec4 G;
  integrateCloud(uObserverPc, rd, L, T, tau, G);
  outLT = vec4(L, tau);
  outG = G;
}
`;

/** Composite into the sky target, premultiplied: sky * T (multiply pass, BEFORE the stars) then + L (after).
 *  uSource 0 = the live low-res L/T target (debug reference); 1 = the baked atlas, sampled per low-res sky
 *  pixel in SCREEN space (rays from the FOV, never the inverse projection). Any dither happens here, after
 *  sampling — never per face. */
export const CLOUD_COMPOSITE_FRAG = /* glsl */ `
precision highp float;
${CLOUD_COLOUR_GLSL}
${CLOUD_ATLAS_GLSL}
uniform sampler2D uL;
uniform sampler2D uT;
uniform sampler2D uAtlasLT;
uniform float uAtlasN;
uniform int uSource;
uniform vec3 uCompExtRGB;
uniform vec2 uCompTanHalf;
uniform mat4 uCompCameraWorld;
uniform vec2 uLowRes;
uniform float uDitherAmp;
uniform int uPass;          // 0 = multiply by T, 1 = add L
in vec2 vUv;
layout(location = 0) out vec4 outColor;
float cloudBayer4(vec2 p) {
  vec2 q = mod(floor(p), 4.0);
  int i = int(q.x) + 4 * int(q.y);
  float m[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
  return (m[i] + 0.5) / 16.0;
}
void main() {
  vec3 L, T;
  vec2 cellUv = (floor(vUv * uLowRes) + 0.5) / uLowRes;
  if (uSource == 0) {
    L = texture(uL, vUv).rgb;
    T = texture(uT, vUv).rgb;
  } else {
    vec3 rd = normalize(mat3(uCompCameraWorld) * normalize(vec3((cellUv * 2.0 - 1.0) * uCompTanHalf, -1.0)));
    vec4 lt = textureLod(uAtlasLT, cloudAtlasUV(rd, uAtlasN), 0.0);
    L = lt.rgb;
    T = exp(-lt.a * uCompExtRGB);
  }
  if (uPass == 0) {
    outColor = vec4(T, 1.0);
  } else {
    vec3 c = applyColourMode(L);
    if (uDitherAmp > 0.0) c += (cloudBayer4(floor(vUv * uLowRes)) - 0.5) * uDitherAmp;
    outColor = vec4(max(c, vec3(0.0)), 0.0);
  }
}
`;

/** Star dust: injected into StarfieldLayer's vertex shader (only when the Galactic Engine is mounted). Each star
 *  is dimmed and reddened by the dust between the observer and THE STAR'S OWN DISTANCE: the bake's total tau
 *  times the optical-depth CDF at the star's fraction of the chord through the cloud's bounding sphere.
 *  Stars nearer than the sphere get exactly 1. Twin: ../cubeAtlas.js starTransmittance. */
export const CLOUD_STAR_DUST_GLSL = /* glsl */ `
uniform float uDustOn;
uniform sampler2D uDustLT;
uniform sampler2D uDustG;
uniform float uDustN;
uniform vec3 uDustObserverPc;
uniform float uDustBound;
uniform vec3 uDustExtRGB;
attribute float aDistPc;
varying vec3 vDustT;
${CLOUD_ATLAS_GLSL}
vec3 cloudStarTransmittance(vec3 dir, float distPc) {
  if (uDustOn < 0.5) return vec3(1.0);
  float tc = -dot(uDustObserverPc, dir);
  vec3 h = uDustObserverPc + tc * dir;
  float d2 = dot(h, h);
  float R2 = uDustBound * uDustBound;
  if (d2 >= R2) return vec3(1.0);
  float halfChord = sqrt(R2 - d2);
  float t0 = max(tc - halfChord, 0.0);
  float t1 = tc + halfChord;
  if (t1 <= t0) return vec3(1.0);
  vec2 uv = cloudAtlasUV(dir, uDustN);
  float tau = textureLod(uDustLT, uv, 0.0).a;
  float g = cloudDepthCDF(textureLod(uDustG, uv, 0.0), (distPc - t0) / (t1 - t0));
  return exp(-tau * g * uDustExtRGB);
}
`;
