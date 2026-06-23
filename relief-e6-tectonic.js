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
