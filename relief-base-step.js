// relief-base-step.js — minimal Tier-1 "expose + derive" base step for the relief slice.
// Pure: no three.js. Un-zeros D12 via the SAME tidal-heat math as planet-lod-lab-core.deriveUniforms
// (planet-lod-lab-core.js:516-529), so D12 is derived from the bundle's orbital params — NOT by
// editing PlanetGenerator core (its :565 zero is irrelevant to the lab).
import { makeSubstrate } from './relief-substrate.js';
import alea from 'alea';
import { createNoise2D } from 'simplex-noise';

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const smoothstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

export function makeBaseStep(bundle, { n, lat0Deg, lat1Deg, domainKm, seed = 'relief' }) {
  const d = bundle || {};
  const radiusEarth = d.radiusEarth ?? 1.0;
  const massEarth = d.massEarth ?? 1.0;
  const surfaceGravity = massEarth / (radiusEarth * radiusEarth);

  // D12 tidalHeat — identical Io-normalised form to deriveUniforms (ecc^2 * Mstar^2 * R^5 / a^5).
  const ecc = d.eccentricity ?? 0;
  const starMassEarth = d.starMassEarth ?? 332946;
  const orbitRadiusEarth = d.orbitRadiusEarth ?? 23455;
  const ioRef = (0.0041 * 0.0041) * (317.8 * 317.8) * Math.pow(0.286, 5) / Math.pow(66, 5);
  const tidalHeat = orbitRadiusEarth > 0
    ? (ecc * ecc * starMassEarth * starMassEarth * Math.pow(radiusEarth, 5) / Math.pow(orbitRadiusEarth, 5)) / ioRef
    : 0;

  const density = d.composition?.density ?? 5.5;
  const rockyCrust = smoothstep(2.5, 3.9, density);           // silicate↔ice gate (mirrors core:557)
  const surfaceHistory = d.surfaceHistory?.erosion ?? 0;
  const age = d.age ?? 0.5;

  // Radial-strain SIGN (contraction vs expansion). Cooling/old/large → net contraction (+1, scarps);
  // strong tidal heating/young → net expansion (-1, grabens). Derived from D12/age/gravity (E6 dossier:
  // sign flips the whole feature set; must be DERIVED, never undefined).
  const expansionDrive = clamp01(Math.log10(1 + tidalHeat) / 2);   // tidal heating pushes expansion
  const contractionDrive = clamp01(0.4 + 0.6 * age) * clamp01(surfaceGravity / 1.5); // cooling/age/size
  const radialStrainSign = contractionDrive >= expansionDrive ? +1 : -1;
  const radialStrainMag = clamp01(Math.abs(contractionDrive - expansionDrive)) * 0.001; // ~0.05-0.1% areal

  // Despin amplitude proxy (E6 can pick PATTERN from latitude but needs an amplitude). Approximate from
  // age (more despin accumulated) + a shell-thickness term. Honest: not the true Δ(spin^2) (unavailable).
  const shellThickness = clamp01(0.3 + 0.5 * smoothstep(0.5, 9, surfaceGravity) + 0.2 * (1 - age));
  const despinAmp = clamp01(0.3 + 0.7 * age);

  // Low-freq crustal-thickness blobs → plateau/tessera masks (E6 Step 4). Seeded simplex.
  const rng = alea(String(seed) + ':crust');
  const noise = createNoise2D(rng);
  const thicknessBlob = (ix, iy, gn) => {
    const u = ix / gn, v = iy / gn;
    const a = 0.5 + 0.5 * noise(u * 2.5, v * 2.5);
    const b = 0.5 + 0.5 * noise(u * 5.0 + 11.3, v * 5.0 - 4.1);
    return clamp01(0.65 * a + 0.35 * b);
  };

  const substrate = makeSubstrate({ n, lat0Deg, lat1Deg, domainKm });
  const drivers = { tidalHeat, surfaceGravity, rockyCrust, surfaceHistory, age,
                    radialStrainSign, radialStrainMag, despinAmp };
  const crust = { shellThickness, thicknessBlob };
  return { drivers, crust, substrate };
}
