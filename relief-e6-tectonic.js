// relief-e6-tectonic.js — E6 Lithospheric-stress / tectonic-grain. Pure: no three.js.
// Closed-form despun-shell stress (Melosh 1977 "Global tectonics of a despun planet"; Vening
// Meinesz 1947). Constant-thickness thin-shell idealization, ν=0.25. The two horizontal membrane
// principal stresses for a slowing (despinning) planet follow the standard rotational coefficients:
//   sMer (meridional) ∝ (1+ν) - (3+ν) sin²φ        → sign change near 38°
//   sZon (azimuthal)  ∝ (1+ν) - (1+3ν) sin²φ        → sign change near 57°
// giving equator→thrust, mid-lat→strike-slip, pole→normal (the documented band pattern; the
// strike-slip band ~38–57° brackets the ~48° boundary the verify pass cites). Positive = compressive.
import { REGIME, idx, latDegOfRow } from './relief-substrate.js';

const NU = 0.25;
const DEG = Math.PI / 180;

export function stressAtLat(latDeg, drivers) {
  const s2 = Math.sin(latDeg * DEG) ** 2;
  const amp = (drivers.despinAmp ?? 1);
  let sMer = amp * ((1 + NU) - (3 + NU) * s2);
  let sZon = amp * ((1 + NU) - (1 + 3 * NU) * s2);
  // Isotropic radial strain: contraction (+1) adds compression everywhere (scarps); expansion (-1)
  // adds tension (grabens). Shifts the regime boundaries — E6 dossier: sign flips the feature set.
  const eps = (drivers.radialStrainSign ?? +1) * (drivers.radialStrainMag ?? 0) * (3 + NU) * 0.5;
  sMer += eps; sZon += eps;
  // Anderson regime from the two horizontal principal stresses (surface vertical stress ≈ 0).
  let regime;
  if (sMer > 0 && sZon > 0) regime = REGIME.THRUST;
  else if (sMer < 0 && sZon < 0) regime = REGIME.NORMAL;
  else regime = REGIME.STRIKESLIP;
  // Grain (lineament strike): faults strike perpendicular to the most extreme horizontal stress.
  // Dominant axis = larger |stress|; meridional acts N-S, zonal acts E-W (here +x = "east").
  const grainAngle = Math.abs(sMer) >= Math.abs(sZon) ? 0 : Math.PI / 2;
  return { sMer, sZon, regime, grainAngle };
}

export function writeGrain(substrate, drivers) {
  const { n } = substrate;
  for (let iy = 0; iy < n; iy++) {
    const lat = latDegOfRow(substrate, iy);
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

// ── append to relief-e6-tectonic.js ──
import alea from 'alea';
import { createNoise2D } from 'simplex-noise';

// Isostatic gravity cap — same form as planet-lod-lab-core.reliefGravityFactor (clamp(g^-0.5, 0.4, 2.5)).
function reliefGravityFactor(g) {
  const f = Math.pow(Math.max(g, 1e-3), -0.5);
  return Math.min(2.5, Math.max(0.4, f));
}

// Anisotropic steered noise: sample simplex in a frame rotated to the grain angle, stretched along
// strike (lineaments are long). Ridged (1-|n|) for compressional grain, billow (|n|) otherwise.
function steeredNoise(noise, x, y, angle, regime, freq) {
  const ca = Math.cos(angle), sa = Math.sin(angle);
  const u = (x * ca + y * sa) * freq * 0.35;   // along strike: lower freq (elongated)
  const v = (-x * sa + y * ca) * freq * 1.6;    // across strike: higher freq (tight ridges)
  const nVal = noise(u, v);
  return regime === REGIME.NORMAL ? Math.abs(nVal) - 0.5 : 0.5 - Math.abs(nVal); // ridges vs grabens
}

export function runE6(substrate, crust, drivers, epoch = { name: 'tectonic-build' }, seed = 'e6') {
  const { n } = substrate;
  writeGrain(substrate, drivers);                                  // Steps 1-2
  const rng = alea(String(seed) + ':e6:' + (epoch.name || ''));
  const noise = createNoise2D(rng);
  const noisePlateau = createNoise2D(alea(String(seed) + ':e6plateau'));
  const gCap = reliefGravityFactor(drivers.surfaceGravity ?? 1);
  const silicate = drivers.rockyCrust ?? 1;                        // icy worlds → muted silicate relief
  const blend = epoch.blend ?? 1;                                  // Task 9 overprint uses <1
  const baseAmp = 0.6 * gCap * (0.3 + 0.7 * silicate);

  for (let iy = 0; iy < n; iy++) {
    for (let ix = 0; ix < n; ix++) {
      const i = iy * n + ix;
      const x = ix / n, y = iy / n;
      // Step 3: steered grain relief.
      let h = steeredNoise(noise, x, y, substrate.grainAngle[i], substrate.regime[i], 9.0)
                * substrate.grainMag[i];
      // Step 4: plateau/tessera — isostatic uplift on thick-crust blobs, capped by 1/√g.
      const blob = crust.thicknessBlob(ix, iy, n);
      const plateau = Math.max(0, blob - 0.55) * 1.6;             // only thick blobs uplift
      h += plateau * (0.4 + 0.3 * (0.5 + 0.5 * noisePlateau(x * 6, y * 6)));
      substrate.height[i] += baseAmp * h * blend;
      substrate.faultDensity[i] = Math.max(substrate.faultDensity[i], substrate.grainMag[i]);
    }
  }
  // Step 5: bounded Jacobi smoothing (cosmetic; non-convergent — short wavelengths only).
  jacobiSmooth(substrate, 10);
  return substrate;
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
      buf[i] = h[i] * 0.5 + (sum / cnt) * 0.5;   // gentle, weighted toward original
    }
    h.set(buf);
  }
}
