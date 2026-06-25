// src/worldengine/base/tectonic.js
// Production port of relief-e6-tectonic.js (stress + build half). Pure stress (stressAtLat/writeGrain);
// runE6 (Task 8) adds seeded simplex. No three.js. nu=0.25, REGIME_GAIN=0.4 LOCKED.
import { REGIME, idx, latDegOfRow } from './substrate.js';
import alea from 'alea';
import { createNoise2D } from 'simplex-noise';

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
