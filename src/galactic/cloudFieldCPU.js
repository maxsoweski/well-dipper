// cloudFieldCPU.js — the CPU twin of shaders/cloudField.glsl.js, and the reference integrator.
//
// Every function here has a GLSL counterpart with the same name and the same arithmetic (integer hash,
// quintic value noise, fBm + ridges, envelope, cavity, emission/extinction, exact per-step integration).
// Tests run against this file; live probes compare it with the GPU. Headless: no three.js.
//
// Frames and units: positions are in pc relative to the nebula centre, galactic axes. The pack's rotation
// takes them into the nebula-local frame where the noise, cavity and ionizing source live.

import { HASH_MUL_A, HASH_MUL_B, LUMA, FBM_STD, DEPTH_KNOTS } from './cloudConstants.js';

const LATTICE_BIAS = 1 << 20; // keeps lattice indices non-negative before the uint conversion

export function hashU(x) {
  x >>>= 0;
  x = (x ^ (x >>> 16)) >>> 0;
  x = Math.imul(x, HASH_MUL_A) >>> 0;
  x = (x ^ (x >>> 15)) >>> 0;
  x = Math.imul(x, HASH_MUL_B) >>> 0;
  x = (x ^ (x >>> 16)) >>> 0;
  return x;
}

function lattice(ix, iy, iz) {
  const h = hashU(((ix + LATTICE_BIAS) >>> 0) ^ hashU(((iy + LATTICE_BIAS) >>> 0) ^ hashU((iz + LATTICE_BIAS) >>> 0)));
  return (h >>> 8) / 16777216; // 24 bits: exact in float32
}

const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const mix = (a, b, t) => a + (b - a) * t;

export function smoothstep(e0, e1, x) {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/** 3D value noise in [0,1). */
export function valueNoise(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const ux = fade(x - ix), uy = fade(y - iy), uz = fade(z - iz);
  const c000 = lattice(ix, iy, iz), c100 = lattice(ix + 1, iy, iz);
  const c010 = lattice(ix, iy + 1, iz), c110 = lattice(ix + 1, iy + 1, iz);
  const c001 = lattice(ix, iy, iz + 1), c101 = lattice(ix + 1, iy, iz + 1);
  const c011 = lattice(ix, iy + 1, iz + 1), c111 = lattice(ix + 1, iy + 1, iz + 1);
  const x00 = mix(c000, c100, ux), x10 = mix(c010, c110, ux);
  const x01 = mix(c001, c101, ux), x11 = mix(c011, c111, ux);
  return mix(mix(x00, x10, uy), mix(x01, x11, uy), uz);
}

/** Log of the structure factor at a nebula-local point (pc): lognormal fBm plus ridged filaments. */
export function logStructure(pl, pack) {
  const n = pack.noise;
  const qx = pl[0] / n.scalePc, qy = pl[1] / n.scalePc, qz = pl[2] / n.scalePc;
  let sum = 0, amp = 0.5, freq = 1;
  for (let i = 0; i < n.octaves; i++) {
    sum += amp * (valueNoise(qx * freq + n.offset[0], qy * freq + n.offset[1], qz * freq + n.offset[2]) - 0.5);
    amp *= n.gain;
    freq *= n.lacunarity;
  }
  // Ridged noise at 2x the base frequency, on a decorrelated offset: thin sheets/threads where it peaks.
  const r = 1 - Math.abs(2 * valueNoise(qx * 2 + n.offset[1], qy * 2 + n.offset[2], qz * 2 + n.offset[0]) - 1);
  return n.sigma * (sum / FBM_STD) + n.ridgeGain * (r * r * r - 0.25) - 0.5 * n.sigma * n.sigma;
}

function toLocal(p, m) {
  // column-major mat3 * vec3
  return [
    m[0] * p[0] + m[3] * p[1] + m[6] * p[2],
    m[1] * p[0] + m[4] * p[1] + m[7] * p[2],
    m[2] * p[0] + m[5] * p[1] + m[8] * p[2],
  ];
}

function envelope(r, pack) {
  const s = pack.envelopeSoftness;
  if (s <= 0) return r < pack.radiusPc ? 1 : 0;
  return 1 - smoothstep(1 - s, 1, r / pack.radiusPc);
}

const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** Gas density (dimensionless, ~1 = mean) at a point p (pc, galactic axes, relative to the centre). */
export function density(p, pack) {
  const env = envelope(Math.hypot(p[0], p[1], p[2]), pack);
  if (env <= 0) return 0;
  const pl = toLocal(p, pack.rotation);
  const c = pack.cavity;
  const cav = c.radiusPc > 0 ? mix(1 - c.depth, 1, smoothstep(0.6 * c.radiusPc, c.radiusPc, dist3(pl, c.centrePc))) : 1;
  return env * cav * Math.exp(logStructure(pl, pack));
}

/** Emission (RGB per pc) and extinction (RGB per pc) at p. Colours are luminance-normalised, so the line mix
 *  changes hue only. */
export function sampleMedium(p, pack) {
  const rho = density(p, pack);
  if (rho <= 0) return { j: [0, 0, 0], k: [0, 0, 0] };
  const pl = toLocal(p, pack.rotation);
  const ion = pack.ionizing;
  const ds = dist3(pl, ion.centrePc);
  const g = ds / ion.glowRadiusPc;
  const x = 0.25 + 0.75 * Math.exp(-g * g);
  const w = ion.hardness * Math.exp(-ds / ion.oiiiRadiusPc);
  const e = pack.emission.scale * rho * x;
  const ex = pack.extinction.scale * rho;
  const ha = pack.emission.ha, o3 = pack.emission.oiii, kr = pack.extinction.rgb;
  return {
    j: [e * mix(ha[0], o3[0], w), e * mix(ha[1], o3[1], w), e * mix(ha[2], o3[2], w)],
    k: [ex * kr[0], ex * kr[1], ex * kr[2]],
  };
}

/** Ray vs the bounding sphere, robust at kpc distances (closest-approach form). Returns null or {tc, h, t0, t1}. */
export function rayBounds(ro, rd, boundRadius) {
  const tc = -(ro[0] * rd[0] + ro[1] * rd[1] + ro[2] * rd[2]);
  const h = [ro[0] + tc * rd[0], ro[1] + tc * rd[1], ro[2] + tc * rd[2]];
  const d2 = h[0] * h[0] + h[1] * h[1] + h[2] * h[2];
  const R2 = boundRadius * boundRadius;
  if (d2 >= R2) return null;
  const half = Math.sqrt(R2 - d2);
  return { tc, h, t0: tc - half, t1: tc + half };
}

/**
 * March a ray through the cloud over [tMin, tMax] ∩ bounds (entry clamped at 0, so starting inside needs no
 * special case). Each step treats the medium as constant over dt and integrates it EXACTLY:
 *   L += T * j * (1 - e^{-k dt}) / k,   T *= e^{-k dt}.
 * Also returns the scalar dust optical depth `tau` (extinction is k = scale·rho·rgb, so T_c = e^{-tau·rgb_c}
 * exactly) and `G` — the cumulative fraction of tau reached at DEPTH_KNOTS of the chord [t0, t1] (twin of the
 * GLSL integrateCloud; the sky bake stores it so stars are dimmed only by the dust in front of them).
 * @returns {{L: number[], T: number[], t0: number, t1: number, tau: number, G: number[]}}
 */
export function integrateRay(pack, ro, rd, steps = 64, tMin = 0, tMax = Infinity) {
  const L = [0, 0, 0], T = [1, 1, 1];
  const G = DEPTH_KNOTS.slice();
  const b = rayBounds(ro, rd, pack.boundRadiusPc);
  if (!b) return { L, T, t0: 0, t1: 0, tau: 0, G };
  const t0 = Math.max(b.t0, tMin, 0);
  const t1 = Math.min(b.t1, tMax);
  if (t1 <= t0) return { L, T, t0, t1, tau: 0, G };
  const dt = (t1 - t0) / steps;
  const extG = Math.max(pack.extinction.rgb[1], 1e-6);
  const knots = DEPTH_KNOTS.map((f) => f * steps);
  const acc = [0, 0, 0, 0];
  let tau = 0;
  for (let i = 0; i < steps; i++) {
    const s = t0 + (i + 0.5) * dt - b.tc; // position along the ray, measured from the closest-approach point
    const p = [b.h[0] + s * rd[0], b.h[1] + s * rd[1], b.h[2] + s * rd[2]];
    const { j, k } = sampleMedium(p, pack);
    for (let c = 0; c < 3; c++) {
      const a = Math.exp(-k[c] * dt);
      L[c] += T[c] * (k[c] > 1e-6 ? (j[c] * (1 - a)) / k[c] : j[c] * dt);
      T[c] *= a;
    }
    const tauNext = tau + (k[1] / extG) * dt;
    for (let q = 0; q < 4; q++) {
      if (knots[q] >= i && knots[q] < i + 1) acc[q] += tau + (tauNext - tau) * (knots[q] - i);
    }
    tau = tauNext;
  }
  const g = tau > 1e-12 ? acc.map((v) => v / tau) : DEPTH_KNOTS.slice();
  return { L, T, t0, t1, tau, G: g };
}

/** Segment composition: near then far along one ray. */
export function composeSegments(near, far) {
  return {
    L: near.L.map((l, c) => l + near.T[c] * far.L[c]),
    T: near.T.map((t, c) => t * far.T[c]),
  };
}

export const luminance = (rgb) => rgb[0] * LUMA[0] + rgb[1] * LUMA[1] + rgb[2] * LUMA[2];

/** Display transform for the colour mode. Realistic mixes toward a grey-teal of the SAME luminance, with
 *  saturation only above the colour-vision threshold; luminance is preserved exactly in both modes. */
export function applyColourMode(L, pack) {
  if (pack.colourMode !== 'realistic') return L.slice();
  const r = pack.realistic;
  const Y = luminance(L);
  const sat = r.satMin + (r.satMax - r.satMin) * smoothstep(r.lumLo, r.lumHi, Y);
  return [0, 1, 2].map((c) => mix(Y * r.tint[c], L[c], sat));
}

/** A homogeneous, hard-edged emitting/absorbing sphere — the analytic test subject.
 *  Radiance along a chord ℓ is j/k (1 - e^{-kℓ}); transmittance e^{-kℓ}. */
export function homogeneousSpherePack({ radiusPc = 10, j = [0.02, 0.01, 0.005], k = [0.05, 0.08, 0.12] } = {}) {
  return {
    version: 0,
    featureId: 'test:homogeneous-sphere',
    colourMode: 'photo',
    radiusPc,
    boundRadiusPc: radiusPc,
    envelopeSoftness: 0,
    rotation: [1, 0, 0, 0, 1, 0, 0, 0, 1],
    noise: { scalePc: 1, octaves: 1, gain: 0.5, lacunarity: 2, sigma: 0, ridgeGain: 0, offset: [200, 300, 400] },
    cavity: { centrePc: [0, 0, 0], radiusPc: 0, depth: 0 },
    ionizing: { centrePc: [0, 0, 0], glowRadiusPc: 1e9, oiiiRadiusPc: 1, hardness: 0 },
    emission: { scale: 1, ha: j.slice(), oiii: j.slice() },
    extinction: { scale: 1, rgb: k.slice() },
    realistic: { tint: [1, 1, 1], satMin: 0, satMax: 0.5, lumLo: 0.1, lumHi: 0.3 },
  };
}
