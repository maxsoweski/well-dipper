// src/worldengine/base/baseStep.js
// Production port of relief-base-step.js — the Tier-1 "expose + derive" base step.
// Pure: no three.js. Imports only alea + simplex-noise (deterministic; no Math.random/Date.now).
import { makeSubstrate } from './substrate.js';
import { clamp01, smoothstep } from './mathutil.js';
import { calibrateTidal, LOVE_K2_RANGE } from './adaptL0.js';
import alea from 'alea';
import { createNoise2D } from 'simplex-noise';

// ── deriveBodyScalars — the grid-free per-body scalar computation (V2-0 AC2). ──
// SINGLE SOURCE for every per-body scalar makeBaseStep emits. It allocates no grid, no Float32Array,
// no substrate — it takes only the driver bundle (+ the discriminate flag, which selects whether the
// crust seed keys on the discriminator). makeBaseStep calls this once, then does ONLY the grid loop
// (crustalThickness), the substrate build, and object reassembly. The thin named helpers below each
// return one field of this object, so every formula lives in exactly ONE place (no drift).
export function deriveBodyScalars(bundle, discriminate = true) {
  const d = bundle || {};
  const radiusEarth = d.radiusEarth ?? 1.0;
  const massEarth = d.massEarth ?? 1.0;
  const surfaceGravity = massEarth / (radiusEarth * radiusEarth);

  // ── tidal precedence + calibration (single-source) ──
  // Prefer the upstream D12 value (d.tidalHeat, from adaptL0 <- planetData.tidalHeating).
  // When absent, fall back to the lab self-derivation: the Io-normalised formula.
  const ecc = d.eccentricity ?? 0;
  const starMassEarth = d.starMassEarth ?? 332946;
  const orbitRadiusEarth = d.orbitRadiusEarth ?? 23455;
  const ioRef = (0.0041 * 0.0041) * (317.8 * 317.8) * Math.pow(0.286, 5) / Math.pow(66, 5);
  const rawTidalIoRatio = (d.tidalHeat != null)   // D12 raw Io-ratio, PRE-calibrateTidal
    ? d.tidalHeat
    : (orbitRadiusEarth > 0
        ? (ecc * ecc * starMassEarth * starMassEarth * Math.pow(radiusEarth, 5) / Math.pow(orbitRadiusEarth, 5)) / ioRef
        : 0);
  const tidalHeat = calibrateTidal(rawTidalIoRatio);   // bounded [0,1) driver

  const density = d.composition?.density ?? 5.5;
  const rockyCrust = smoothstep(2.5, 3.9, density);
  const surfaceHistory = d.surfaceHistory?.erosion ?? 0;
  // age: prefer the normalized ageNorm (from adaptL0); fall back to d.age (relief presets omit -> 0.5)
  const ageNorm = d.ageNorm ?? (d.age ?? 0.5);

  // radial strain: contraction (+1, scarps) vs expansion (-1, grabens)
  const expansionDrive = tidalHeat;   // calibrated tidal heating pushes expansion
  const contractionDrive = clamp01(0.4 + 0.6 * ageNorm) * clamp01(surfaceGravity / 1.5);
  const radialStrainSign = contractionDrive >= expansionDrive ? +1 : -1;
  const radialStrainMag = clamp01(Math.abs(contractionDrive - expansionDrive));

  const shellThickness = clamp01(0.3 + 0.5 * smoothstep(0.5, 9, surfaceGravity) + 0.2 * (1 - ageNorm));
  const despinAmp = clamp01(0.3 + 0.7 * ageNorm);

  // ── L4 liquidStability (verbatim port of the lab gate chain) ──
  const T = d.T_eq ?? 280;
  const volatileFraction = d.composition?.volatileFraction ?? 0.15;
  const volatileGate = smoothstep(0.05, 0.2, volatileFraction);
  const waterWindow   = smoothstep(248, 273, T) * (1 - smoothstep(373, 398, T));
  const methaneWindow = smoothstep(85, 90, T)   * (1 - smoothstep(112, 120, T));
  const tempWindow = Math.max(waterWindow, methaneWindow);
  const T_exo = 3.5 * T;
  const kB = 1.380649e-23, mp = 1.6726e-27, G = 6.674e-11, Mearth = 5.972e24, Rearth = 6.371e6;
  const massKg = (d.massEarth ?? 1) * Mearth, radM = (d.radiusEarth ?? 1) * Rearth;
  const vEsc2 = 2 * G * massKg / radM;
  const jeans = (molarMass) => (molarMass * mp * vEsc2) / (2 * kB * T_exo);
  const retained = jeans(28) > 6;
  const pressure = retained ? clamp01(0.3 + 0.8 * (d.massEarth ?? 1)) : 0;
  const retentionGate = retained ? smoothstep(0.05, 0.3, pressure) : 0;
  const liquidStability = clamp01(retentionGate * volatileGate * tempWindow);
  const liquidSpecies = methaneWindow > waterWindow ? 1 : 0;   // 0 water, 1 methane
  const rainFactor = (waterWindow > 0 && retained) ? 1.0 : (retained ? 0.2 : 0);

  const discriminator = String(radialStrainSign) + ':' + (rockyCrust > 0.5 ? 'sil' : 'ice');
  const useDiscriminator = !!discriminate;

  // ── F5 interior proxies (bounded, ordered, written ranges) ──
  const thermalState = clamp01(0.5 * tidalHeat + 0.5 * (1 - ageNorm));   // young+heated high, old+cold low
  const loveK2 = LOVE_K2_RANGE.min + (LOVE_K2_RANGE.max - LOVE_K2_RANGE.min)
    * clamp01(0.25 + 0.55 * thermalState + 0.30 * (1 - rockyCrust) - 0.25 * shellThickness);

  return {
    surfaceGravity, rawTidalIoRatio, tidalHeat, ageNorm, density, rockyCrust,
    surfaceHistory, shellThickness, despinAmp, radialStrainSign, radialStrainMag,
    thermalState, loveK2, liquidStability, liquidSpecies, rainFactor,
    discriminator, useDiscriminator,
  };
}

// ── Thin named helpers (AC2) — each returns one field of deriveBodyScalars; zero formula duplication. ──
export function bodyRawTidal(bundle)        { return deriveBodyScalars(bundle).rawTidalIoRatio; }   // D12 raw Io-ratio (was :23-27, PRE-calibrateTidal)
export function bodyShellThickness(bundle)  { return deriveBodyScalars(bundle).shellThickness; }    // was :42
export function bodyThermalState(bundle)    { return deriveBodyScalars(bundle).thermalState; }      // was :85
export function bodyRadialStrain(bundle)    { const s = deriveBodyScalars(bundle); return { sign: s.radialStrainSign, mag: s.radialStrainMag }; } // was :39-40
export function bodyLiquidStability(bundle) { return deriveBodyScalars(bundle).liquidStability; }   // was :45-60
export function bodySurfaceGravity(bundle)  { return deriveBodyScalars(bundle).surfaceGravity; }    // was :14 (size/vigor ingredient for Φ)
export function bodyAgeNorm(bundle)         { return deriveBodyScalars(bundle).ageNorm; }           // was :34 (radiogenic ingredient for Φ)

// ── V2-6 §1B — shared km→angular derivation (radPerKm). Pure, byte-inert (new export; nothing existing reads it). ──
// Angular size of a D_km surface feature: δ = D_km · radPerKm(R) ⇒ ∝ 1/R at fixed D_km. The single km-to-angular
// conversion every radius law consumes (bombardment.js gains its import in V2-6 slice 2). Math.max floor guards 1/0.
export const KM_PER_EARTH_RADIUS = 6371;
export function radPerKm(radiusEarth) { return 1 / (KM_PER_EARTH_RADIUS * Math.max(radiusEarth ?? 1.0, 1e-6)); }

export function makeBaseStep(bundle, { n, lat0Deg, lat1Deg, domainKm, seed = 'worldengine', discriminate = true }) {
  const s = deriveBodyScalars(bundle, discriminate);

  // ── crust: shellThickness + thicknessBlob (seeded low-freq simplex) ──
  // KNOWN BEHAVIOR (faithful port of relief-base-step.js): the crust seed keys the thickness LAYOUT on
  // discriminator = (radialStrainSign, sil/ice), NOT on full preset identity. So two worlds in the same
  // class at the same grid seed get a BYTE-IDENTICAL crustalThickness field (e.g. lava ≡ magma both '-1:sil';
  // rocky ≡ terrestrial both '1:sil') — their regime/grain still differ (driven by despinAmp/radialStrainMag).
  // By design (layout is composition-class-keyed; amplitude varies). If WS4 needs same-class worlds to have
  // distinct thickness layouts, fold more identity into the seed. See KNOWN-BEHAVIORS.md (workstream dir).
  const crustSeed = String(seed) + ':crust' + (s.useDiscriminator ? ':' + s.discriminator : '');
  const rng = alea(crustSeed);
  const noise = createNoise2D(rng);
  const thicknessBlob = (ix, iy, gn) => {
    const u = ix / gn, v = iy / gn;
    const a = 0.5 + 0.5 * noise(u * 2.5, v * 2.5);
    const b = 0.5 + 0.5 * noise(u * 5.0 + 11.3, v * 5.0 - 4.1);
    return clamp01(0.65 * a + 0.35 * b);
  };

  // materialized crustalThickness field (per-texel, [0,1], low-freq) over the flat grid
  const crustalThickness = new Float32Array(n * n);
  for (let iy = 0; iy < n; iy++) for (let ix = 0; ix < n; ix++) {
    crustalThickness[iy * n + ix] = thicknessBlob(ix, iy, n);
  }

  const substrate = makeSubstrate({ n, lat0Deg, lat1Deg, domainKm });
  const drivers = { tidalHeat: s.tidalHeat, surfaceGravity: s.surfaceGravity, rockyCrust: s.rockyCrust,
                    surfaceHistory: s.surfaceHistory, age: s.ageNorm,
                    radialStrainSign: s.radialStrainSign, radialStrainMag: s.radialStrainMag, despinAmp: s.despinAmp,
                    discriminator: s.discriminator, useDiscriminator: s.useDiscriminator,
                    liquidStability: s.liquidStability, liquidSpecies: s.liquidSpecies, rainFactor: s.rainFactor };
  const crust = { shellThickness: s.shellThickness, thicknessBlob, crustalThickness, loveK2: s.loveK2, thermalState: s.thermalState };
  return { drivers, crust, substrate };
}
