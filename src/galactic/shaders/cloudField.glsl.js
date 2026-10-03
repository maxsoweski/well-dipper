// cloudField.glsl.js — THE GLSL source for the Galactic Engine cloud field and its integrator.
//
// This is the only file that holds cloud shader text (a test fences that). Its CPU twin is
// ../cloudFieldCPU.js: same names, same arithmetic, constants shared through ../cloudConstants.js.
// GLSL ES 3.00 (WebGL2) — the integer hash needs uint arithmetic.

import { HASH_MUL_A, HASH_MUL_B, LUMA, FBM_STD, MAX_STEPS } from '../cloudConstants.js';

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
void integrateCloud(vec3 ro, vec3 rd, out vec3 L, out vec3 T) {
  L = vec3(0.0);
  T = vec3(1.0);
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
  for (int i = 0; i < ${MAX_STEPS}; i++) {
    if (i >= uSteps) break;
    float s = t0 + (float(i) + 0.5) * dt - tc;
    vec3 j, k;
    sampleMedium(h + s * rd, j, k);
    vec3 a = exp(-k * dt);
    vec3 kSafe = max(k, vec3(1e-6));
    L += T * mix(j * dt, j * (1.0 - a) / kSafe, step(vec3(1e-6), k));
    T *= a;
  }
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
  integrateCloud(uObserverPc, rd, L, T);
  outL = vec4(L, 1.0);
  outT = vec4(T, 1.0);
}
`;

/** Composite into the sky target, premultiplied: sky * T (multiply pass) then + L (additive pass). */
export const CLOUD_COMPOSITE_FRAG = /* glsl */ `
precision highp float;
${CLOUD_COLOUR_GLSL}
uniform sampler2D uL;
uniform sampler2D uT;
uniform int uPass;          // 0 = multiply by T, 1 = add L
in vec2 vUv;
layout(location = 0) out vec4 outColor;
void main() {
  if (uPass == 0) outColor = vec4(texture(uT, vUv).rgb, 1.0);
  else outColor = vec4(applyColourMode(texture(uL, vUv).rgb), 0.0);
}
`;
