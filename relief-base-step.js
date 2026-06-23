// relief-base-step.js — minimal Tier-1 "expose + derive" base step for the relief slice.
// Pure: no three.js. Un-zeros D12 via the SAME tidal-heat math as planet-lod-lab-core.deriveUniforms
// (planet-lod-lab-core.js:516-529), so D12 is derived from the bundle's orbital params — NOT by
// editing PlanetGenerator core (its :565 zero is irrelevant to the lab).
import { makeSubstrate } from './relief-substrate.js';
import alea from 'alea';
import { createNoise2D } from 'simplex-noise';

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const smoothstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

export function makeBaseStep(bundle, { n, lat0Deg, lat1Deg, domainKm, seed = 'relief', discriminate = true }) {
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
  // L1: un-damped strain magnitude (0..1). Was capped *0.001 (regime-inert, the coat-swap). The
  // despin-span re-basing in relief-e6-tectonic.js keeps it band-SHIFTING, not saturating.
  const radialStrainMag = clamp01(Math.abs(contractionDrive - expansionDrive));

  // Despin amplitude proxy (E6 can pick PATTERN from latitude but needs an amplitude). Approximate from
  // age (more despin accumulated) + a shell-thickness term. Honest: not the true Δ(spin^2) (unavailable).
  const shellThickness = clamp01(0.3 + 0.5 * smoothstep(0.5, 9, surfaceGravity) + 0.2 * (1 - age));
  const despinAmp = clamp01(0.3 + 0.7 * age);

  // L4: liquidStability — canonical production gate, copied verbatim (NOT invented).
  //   temp + volatile gates: EXACT copy of planet-lod-lab-core.js:558-560 / :548.
  const T = d.T_eq ?? 280;
  const volatileFraction = d.composition?.volatileFraction ?? 0.15;
  const volatileGate = smoothstep(0.05, 0.2, volatileFraction);                       // D2
  const waterWindow   = smoothstep(248, 273, T) * (1 - smoothstep(373, 398, T));
  const methaneWindow = smoothstep(85, 90, T)   * (1 - smoothstep(112, 120, T));
  const tempWindow = Math.max(waterWindow, methaneWindow);                            // D1
  //   retention gate (D6): reconstruct retained/pressure via the Jeans chain (PhysicsEngine.js:96-100,
  //   :111, :184-187, :218-239). uvStripFactor DROPPED (documented, spec §6 — no luminosityRel/orbitAU).
  const T_exo = 3.5 * T;                                                              // PhysicsEngine.js:111
  const kB = 1.380649e-23, mp = 1.6726e-27, G = 6.674e-11, Mearth = 5.972e24, Rearth = 6.371e6;
  const massKg = (d.massEarth ?? 1) * Mearth, radM = (d.radiusEarth ?? 1) * Rearth;
  const vEsc2 = 2 * G * massKg / radM;
  const jeans = (molarMass) => (molarMass * mp * vEsc2) / (2 * kB * T_exo);           // λ for a species
  const retained = jeans(28) > 6;                                                     // N2, λ>6 (PE:184-187)
  const pressure = retained ? clamp01(0.3 + 0.8 * (d.massEarth ?? 1)) : 0;            // PE:218 secondary-atmo
  const retentionGate = retained ? smoothstep(0.05, 0.3, pressure) : 0;              // planet-lod-lab-core:546
  const liquidStability = clamp01(retentionGate * volatileGate * tempWindow);        // :561
  const liquidSpecies = methaneWindow > waterWindow ? 1 : 0;                          // :562 (0 water,1 methane)
  const rainFactor = (waterWindow > 0 && retained) ? 1.0 : (retained ? 0.2 : 0);      // proxy (spec §3 L4)

  // L3: physics discriminator — folds composition/regime into the seed so the LAYOUT is composition-keyed.
  // Derived from already-computed geophysics (never invented). TOGGLEABLE: the verifier runs it OFF to
  // measure the held-seed (L1+L2) baseline; ON adds the secondary reseed lift. NOT the decisive gate.
  const discriminator = String(radialStrainSign) + ':' + (rockyCrust > 0.5 ? 'sil' : 'ice');
  const useDiscriminator = !!discriminate;

  // Low-freq crustal-thickness blobs → plateau/tessera masks (E6 Step 4). Seeded simplex.
  const crustSeed = String(seed) + ':crust' + (useDiscriminator ? ':' + discriminator : '');
  const rng = alea(crustSeed);
  const noise = createNoise2D(rng);
  const thicknessBlob = (ix, iy, gn) => {
    const u = ix / gn, v = iy / gn;
    const a = 0.5 + 0.5 * noise(u * 2.5, v * 2.5);
    const b = 0.5 + 0.5 * noise(u * 5.0 + 11.3, v * 5.0 - 4.1);
    return clamp01(0.65 * a + 0.35 * b);
  };

  const substrate = makeSubstrate({ n, lat0Deg, lat1Deg, domainKm });
  const drivers = { tidalHeat, surfaceGravity, rockyCrust, surfaceHistory, age,
                    radialStrainSign, radialStrainMag, despinAmp,
                    discriminator, useDiscriminator, liquidStability, liquidSpecies, rainFactor };
  const crust = { shellThickness, thicknessBlob };
  return { drivers, crust, substrate };
}
