// src/worldengine/base/tectonic.js
// Production port of relief-e6-tectonic.js (stress + build half). Pure stress (stressAtLat/writeGrain);
// runE6 (Task 8) adds seeded simplex. No three.js. nu=0.25, REGIME_GAIN=0.4 LOCKED.
import { REGIME, idx, latDegOfRow } from './substrate.js';

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
