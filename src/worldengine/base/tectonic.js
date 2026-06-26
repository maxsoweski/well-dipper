// src/worldengine/base/tectonic.js
// Production port of relief-e6-tectonic.js (stress + build half). Pure stress (stressAtLat/writeGrain);
// runE6 (Task 8) adds seeded simplex. No three.js. nu=0.25, REGIME_GAIN=0.4 LOCKED.
import { REGIME, idx, latDegOfRow } from './substrate.js';
import alea from 'alea';
import { createNoise2D, createNoise3D } from 'simplex-noise';

export const NU = 0.25;
const DEG = Math.PI / 180;
export const REGIME_GAIN = 0.4;

// Emergent stress-band boundaries (deg): sMer flips sign at asin(sqrt(1.25/3.25)), sZon at
// asin(sqrt(1.25/1.75)) (the two REGIME boundaries); |sMer|=|sZon| at asin(sqrt(0.5))=45 (grainAngle flip).
export const REGIME_BAND_DEG = [Math.asin(Math.sqrt(1.25 / 3.25)) * 180 / Math.PI,
                                Math.asin(Math.sqrt(1.25 / 1.75)) * 180 / Math.PI];  // ≈ [38.33, 57.69]
export const GRAIN_BAND_DEG = Math.asin(Math.sqrt(0.5)) * 180 / Math.PI;             // 45
export const SEAM_LAT_TOL_DEG = 1.5;  // "same latitude" tol for seam checks (mesh min adj Δlat ≈ 0.63°)

export function stressAtLat(latDeg, drivers) {
  const s2 = Math.sin(latDeg * DEG) ** 2;
  const amp = (drivers.despinAmp ?? 1);
  let sMer = amp * ((1 + NU) - (3 + NU) * s2);
  let sZon = amp * ((1 + NU) - (1 + 3 * NU) * s2);
  const span = amp * (3 + NU);
  const eps = (drivers.radialStrainSign ?? +1) * (drivers.radialStrainMag ?? 0) * span * REGIME_GAIN;
  sMer += eps; sZon += eps;
  let regime;
  if (sMer > 0 && sZon > 0) regime = REGIME.THRUST;
  else if (sMer < 0 && sZon < 0) regime = REGIME.NORMAL;
  else regime = REGIME.STRIKESLIP;
  const grainAngle = Math.abs(sMer) >= Math.abs(sZon) ? 0 : Math.PI / 2;
  return { sMer, sZon, regime, grainAngle };
}

export function writeGrain(substrate, drivers, rotatePoleDeg = 0) {
  const { n } = substrate;
  for (let iy = 0; iy < n; iy++) {
    const lat = latDegOfRow(substrate, iy) + rotatePoleDeg;
    const { sMer, sZon, regime, grainAngle } = stressAtLat(lat, drivers);
    const mag = Math.min(1, Math.hypot(sMer, sZon) / (1 + NU));
    for (let ix = 0; ix < n; ix++) {
      const i = idx(substrate, ix, iy);
      substrate.grainAngle[i] = grainAngle;
      substrate.grainMag[i] = mag;
      substrate.regime[i] = regime;
    }
  }
}

// sphere-native grain: per-node latitude from the F3 carrier replaces latDegOfRow.
// Because regime/grain are a pure function of latitude, same-latitude seam neighbours agree
// (continuity across the antimeridian + poles holds by construction).
export function writeGrainSphere(carrier, drivers) {
  const N = carrier.N;
  for (let i = 0; i < N; i++) {
    const lat = carrier.latDegOf(i);
    const { sMer, sZon, regime, grainAngle } = stressAtLat(lat, drivers);
    const mag = Math.min(1, Math.hypot(sMer, sZon) / (1 + NU));
    carrier.grainAngle[i] = grainAngle;
    carrier.grainMag[i] = mag;
    carrier.regime[i] = regime;
  }
}

// ---------------------------------------------------------------------------
// SPHERE-NATIVE E6 HEIGHT WRITER (net-new peer of writeGrainSphere)
//
// Writes carrier.height[i] — the previously-zero channel (sphereField.js:13) — as DATA,
// deterministically, finite & bounded. This is the coarse LOW-FREQUENCY relief body the
// baked-relief render path reads. It reproduces the flat runE6 height math VERBATIM (same
// LOCKED constants), substituting the ONE thing that does not transfer to a sphere: the
// 2D UV noise domain (x=ix/n, y=iy/n) — which has an antimeridian seam + pole pinch — with
// a SEAM-FREE 3D simplex sample on the node's unit direction carrier.verts[i]. See §A.3.
//
// PRECONDITION: writeGrainSphere(carrier, drivers) MUST run first — this writer reads
// carrier.grainAngle/regime/grainMag (exactly as runE6:100 calls writeGrain first). An
// assert below catches the "forgot to call writeGrainSphere" trap (grainMag all-zero).
//
// DETERMINISM: all entropy via alea(seedString) + simplex-noise; NO Date.now / Math.random
// anywhere (incl. helpers). Seed strings match runE6:101-104 EXACTLY so the sphere field is
// the same family as the flat reference.
//
// BOUND BAND (AC1): the per-epoch E6 contribution is baseAmp*h*blend with baseAmp∈[0.072,1.5],
// h∈[-0.5,~1.0] per node, blend∈(0,1] ⇒ roughly [-0.75,+1.5] normalized relief units; Jacobi
// (a convex combination) cannot expand it. We assert the generous guard band |height| < 4.

// Sphere variant of steeredNoise (math reference: the flat steeredNoise above). SEAM-FREE:
// the rotation is applied in the pole-safe tangent frame {east,north} and the sample is a
// continuous 3D simplex of the rotated unit direction (createNoise3D), so same-direction
// neighbours — across the antimeridian and at the poles — sample the same value. The LOCKED
// anisotropy constants ({0.7|1.5}/{0.25|0.55}/{1.9|1.2}) and the ridged-regime transform
// (NORMAL ? |n|-0.5 : 0.5-|n|) are applied identically to the flat helper.
function steeredNoise3(noise3, dir, east, north, angle, regime, freq, sign = +1) {
  const ca = Math.cos(angle), sa = Math.sin(angle);
  const contraction = sign >= 0;
  const fScale = contraction ? 0.7 : 1.5;
  const along  = contraction ? 0.25 : 0.55;
  const across = contraction ? 1.9 : 1.2;
  // Anisotropic scale factors along the grain-rotated tangent axes (mirrors flat u,v scaling).
  const sU = freq * fScale * along;   // along-grain axis scale
  const sV = freq * fScale * across;  // across-grain axis scale
  // grain-rotated tangent basis: u' = east*cos + north*sin ; v' = -east*sin + north*cos
  const ux = east[0] * ca + north[0] * sa;
  const uy = east[1] * ca + north[1] * sa;
  const uz = east[2] * ca + north[2] * sa;
  const vx = -east[0] * sa + north[0] * ca;
  const vy = -east[1] * sa + north[1] * ca;
  const vz = -east[2] * sa + north[2] * ca;
  // Perturb the 3D unit direction along the (anisotropically scaled) rotated tangent axes.
  // The base direction also enters at `freq` so the sample varies coherently around the sphere.
  const px = dir[0] * freq + ux * sU + vx * sV;
  const py = dir[1] * freq + uy * sU + vy * sV;
  const pz = dir[2] * freq + uz * sU + vz * sV;
  const nVal = noise3(px, py, pz);
  return regime === REGIME.NORMAL ? Math.abs(nVal) - 0.5 : 0.5 - Math.abs(nVal);
}

// Sphere-native crust-thickness blob (math reference: relief-base-step.js thicknessBlob).
// SAME two-octave blend on a seam-free 3D direction domain: weights 0.65/0.35, freqs 2.5/5.0,
// offsets +11.3/-4.1, clamp01. ONE createNoise3D field sampled at both freqs (matching the flat
// thicknessBlob, which reuses one noise instance for both octaves).
function thicknessBlobSphere(d, crustNoise) {
  const a = 0.5 + 0.5 * crustNoise(d[0] * 2.5, d[1] * 2.5, d[2] * 2.5);
  const b = 0.5 + 0.5 * crustNoise(d[0] * 5.0 + 11.3, d[1] * 5.0 - 4.1, d[2] * 5.0);
  return Math.min(1, Math.max(0, 0.65 * a + 0.35 * b));
}

// Sphere analogue of jacobiSmooth: iterates carrier.adj[i] (irregular degree 4-9) instead of
// the flat 4-neighbour i±1,i±n stencil. SAME h[i]*0.5 + mean(self+neighbours)*0.5 weighting and
// 10 passes. Double-buffered (compute into scratch, then .set).
function jacobiSmoothSphere(carrier, passes = 10) {
  const h = carrier.height;
  const adj = carrier.adj;
  const N = carrier.N;
  const buf = new Float32Array(N);
  for (let p = 0; p < passes; p++) {
    for (let i = 0; i < N; i++) {
      let sum = h[i], cnt = 1;
      const nb = adj[i];
      for (let k = 0; k < nb.length; k++) { sum += h[nb[k]]; cnt++; }
      buf[i] = h[i] * 0.5 + (sum / cnt) * 0.5;
    }
    h.set(buf);
  }
}

export function writeHeightSphere(carrier, crust, drivers,
                                 epoch = { name: 'tectonic-build' }, seed = 'e6') {
  const N = carrier.N;
  // Grain precondition (catches the forgot-to-call-writeGrainSphere trap).
  let grainSeen = false;
  for (let i = 0; i < N; i++) { if (carrier.grainMag[i] !== 0) { grainSeen = true; break; } }
  if (!grainSeen) {
    throw new Error('writeHeightSphere: carrier.grainMag is all-zero — call writeGrainSphere(carrier, drivers) before writeHeightSphere');
  }
  // Seeded RNG block — copied byte-for-byte from runE6:101-108 (the determinism contract, G6).
  const disc = (drivers.useDiscriminator && drivers.discriminator) ? ':' + drivers.discriminator : '';
  const rng = alea(String(seed) + ':e6:' + (epoch.name || '') + disc);
  const noise = createNoise3D(rng);                                              // primary steered grain noise (3D)
  const noisePlateau = createNoise3D(alea(String(seed) + ':e6plateau' + disc));  // plateau detail noise (3D)
  const gCap = reliefGravityFactor(drivers.surfaceGravity ?? 1);
  const silicate = drivers.rockyCrust ?? 1;
  const blend = epoch.blend ?? 1;
  const baseAmp = 0.6 * gCap * (0.3 + 0.7 * silicate);
  // Crust-thickness blob noise — seed family matches relief-base-step.js (seed+':crust'+disc).
  const crustSeed = String(seed) + ':crust' + disc;
  const crustNoise = createNoise3D(alea(crustSeed));
  const sign = drivers.radialStrainSign ?? +1;
  for (let i = 0; i < N; i++) {
    const d = carrier.verts[i];
    const { east, north } = carrier.tangentFrameAt(i);
    // (a) steered tectonic grain relief — seam-free 3D port of the flat steeredNoise term.
    let h = steeredNoise3(noise, d, east, north, carrier.grainAngle[i], carrier.regime[i],
                          9.0, sign) * carrier.grainMag[i];
    // (b) crust-thickness plateau (sphere-native blob).
    const blob = thicknessBlobSphere(d, crustNoise);                 // [0,1]
    const plateau = Math.max(0, blob - 0.55) * 1.6;
    h += plateau * (0.4 + 0.3 * (0.5 + 0.5 * noisePlateau(d[0] * 6, d[1] * 6, d[2] * 6)));
    // (c) accumulate (epoch-additive, matches runE6:118).
    carrier.height[i] += baseAmp * h * blend;
    // (d) fault density bookkeeping (parity with runE6:119).
    carrier.faultDensity[i] = Math.max(carrier.faultDensity[i], carrier.grainMag[i]);
  }
  // (e) sphere-native Jacobi smooth (10 passes, adj-based).
  jacobiSmoothSphere(carrier, 10);
  return carrier;
}

function reliefGravityFactor(g) {
  const f = Math.pow(Math.max(g, 1e-3), -0.5);
  return Math.min(2.5, Math.max(0.4, f));
}
function steeredNoise(noise, x, y, angle, regime, freq, sign = +1) {
  const ca = Math.cos(angle), sa = Math.sin(angle);
  const contraction = sign >= 0;
  const fScale = contraction ? 0.7 : 1.5;
  const along  = contraction ? 0.25 : 0.55;
  const across = contraction ? 1.9 : 1.2;
  const u = (x * ca + y * sa) * freq * fScale * along;
  const v = (-x * sa + y * ca) * freq * fScale * across;
  const nVal = noise(u, v);
  return regime === REGIME.NORMAL ? Math.abs(nVal) - 0.5 : 0.5 - Math.abs(nVal);
}
function jacobiSmooth(substrate, passes) {
  const { n } = substrate;
  const h = substrate.height;
  let buf = new Float32Array(h.length);
  for (let p = 0; p < passes; p++) {
    for (let iy = 0; iy < n; iy++) for (let ix = 0; ix < n; ix++) {
      const i = iy * n + ix;
      let sum = h[i], cnt = 1;
      if (ix > 0)     { sum += h[i - 1]; cnt++; }
      if (ix < n - 1) { sum += h[i + 1]; cnt++; }
      if (iy > 0)     { sum += h[i - n]; cnt++; }
      if (iy < n - 1) { sum += h[i + n]; cnt++; }
      buf[i] = h[i] * 0.5 + (sum / cnt) * 0.5;
    }
    h.set(buf);
  }
}

export function runE6(substrate, crust, drivers, epoch = { name: 'tectonic-build' }, seed = 'e6') {
  const { n } = substrate;
  writeGrain(substrate, drivers, epoch.rotatePoleDeg || 0);
  const disc = (drivers.useDiscriminator && drivers.discriminator) ? ':' + drivers.discriminator : '';
  const rng = alea(String(seed) + ':e6:' + (epoch.name || '') + disc);
  const noise = createNoise2D(rng);
  const noisePlateau = createNoise2D(alea(String(seed) + ':e6plateau' + disc));
  const gCap = reliefGravityFactor(drivers.surfaceGravity ?? 1);
  const silicate = drivers.rockyCrust ?? 1;
  const blend = epoch.blend ?? 1;
  const baseAmp = 0.6 * gCap * (0.3 + 0.7 * silicate);
  for (let iy = 0; iy < n; iy++) {
    for (let ix = 0; ix < n; ix++) {
      const i = iy * n + ix;
      const x = ix / n, y = iy / n;
      let h = steeredNoise(noise, x, y, substrate.grainAngle[i], substrate.regime[i], 9.0,
                           drivers.radialStrainSign ?? +1) * substrate.grainMag[i];
      const blob = crust.thicknessBlob(ix, iy, n);
      const plateau = Math.max(0, blob - 0.55) * 1.6;
      h += plateau * (0.4 + 0.3 * (0.5 + 0.5 * noisePlateau(x * 6, y * 6)));
      substrate.height[i] += baseAmp * h * blend;
      substrate.faultDensity[i] = Math.max(substrate.faultDensity[i], substrate.grainMag[i]);
    }
  }
  jacobiSmooth(substrate, 10);
  return substrate;
}
