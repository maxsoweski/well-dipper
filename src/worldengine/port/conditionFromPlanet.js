// src/worldengine/port/conditionFromPlanet.js — the GAME-SIDE adapter into the world engine.
//
// The game's PlanetGenerator output and the lab's DRIVER_PRESETS entries are nearly the same shape
// already (both carry radiusEarth / massEarth / composition / T_eq / age / tidalState / atmosphere /
// surfaceHistory), which is why this file is thin. Its job is to normalise the few differences and to
// be the ONE named seam where game data enters the engine — so the coupling is greppable instead of
// scattered through call sites.
//
// ⚠ THIS ADAPTER READS `type` FOR NOTHING. That is deliberate and load-bearing. The whole point of the
// condition-first engine is that laws key off physical scalars, never a type label. If a future edit
// needs `planetData.type` in here to make something come out right, that is a signal the LAW is
// underspecified — go add the missing condition scalar, do not smuggle the label across this seam.
//
// Field notes:
//  - `massEarth` reaches the condition vector only through surfaceGravity (g = M/R^2); the engine never
//    reads mass directly.
//  - `atmosphere` is the game's computeAtmosphere() result. Only `pressure` and `composition` are read
//    downstream (erosion / iceness / biosphere / crater gates / the optics column term).
//  - `surfaceHistory.erosion` is NOT read by the palette chain — surfaceMaterial.js derives erosion
//    itself from pressure + temperature, precisely so it stays condition-pure.

import { deriveConditionVector } from '../../../body-condition-vector.js';

// ── THE GREENHOUSE CORRECTION — the seam's one non-trivial job. ────────────────────────────────────
// ⚠ THE TWO SIDES DISAGREE ABOUT WHAT `T_eq` MEANS, and the names do not warn you.
//   game  PlanetGenerator.T_eq = equilibriumTemperature(luminosityRel, orbitAU) — a bare radiative
//                                balance. No greenhouse. There is no surface-temperature field
//                                anywhere in the game's planet data.
//   engine condition.T_eq       = SURFACE temperature (body-condition-vector.js says so explicitly,
//                                and driver-presets.js sets Venus to 737, its surface value).
// Passing the game's number straight through therefore hands every temperature-gated law the WRONG
// PHYSICAL QUANTITY, silently: a game Venus would arrive at ~329 K instead of 737 K, and the erosion
// water-window, iceness, biosphere, crater and atmosphere-optics gates would all read it as temperate.
//
// So the adapter converts. Grey-greenhouse, the standard form:
//     T_surf = T_eq * (1 + 0.75*tau)^0.25,   tau = TAU_REF * P^TAU_EXP
// TAU_REF and TAU_EXP are solved from Earth (1 bar, 255 -> 288 K) and Venus (92 bar, 232 -> 737 K).
// Checked against four bodies that were NOT fitted, including two zero-pressure controls:
//     Mars 0.006 bar 210 K -> 210.1 (+0.1%)   Titan 1.5 bar 94 K -> 97.4 (+3.7%)
//     Moon 0 bar 270 K -> 270.0 (0%)          Europa 0 bar 102 K -> 102.0 (0%)
// Airless bodies are exact by construction (P = 0 => tau = 0 => factor 1), which is what keeps the
// airless presets' behaviour identical on both sides of the seam.
export const TAU_REF = 0.84;
export const TAU_EXP = 1.124;

export function surfaceTemperatureOf(T_eq, pressureBar) {
  const P = Math.max(pressureBar ?? 0, 0);
  const tau = TAU_REF * Math.pow(P, TAU_EXP);
  return T_eq * Math.pow(1 + 0.75 * tau, 0.25);
}

// ── THE DENSITY UNIT CONVERSION — the seam's second silent-disagreement fix. ───────────────────────
// ⚠ THE TWO SIDES USE DIFFERENT UNITS FOR `density`, and again the names do not warn you.
//   game   deriveComposition() returns `density` in kg/m^3 (PhysicsEngine.js: 3500 + iron*5000 - ...,
//          clamped to 1000..8000).
//   engine surfaceMaterial.js compares density against DENS_ICE_HI = 2.0 and DENS_ROCK_LO = 3.5,
//          i.e. g/cc, and driver-presets.js writes 5.5 for Earth.
// A factor of 1000. Passed straight through, EVERY game body reads as maximally rocky and the icy
// gate never opens. Measured on a genuinely icy body (volatileFraction 0.5, 110 K):
//     density 2000 (game units)  -> icenessOf = 0.000   <- total gate failure
//     density 2.0  (engine units) -> icenessOf = 1.000
// That gate feeds the bombardment ice-relaxation term and the uIcenessMix albedo uniform, so the bug
// is not cosmetic. Converting here rather than changing PhysicsEngine keeps the game's own physics
// (which uses kg/m^3 consistently elsewhere) untouched.
const KG_M3_TO_G_CC = 1e-3;

export function densityToGramsPerCC(gameDensity) {
  return (gameDensity ?? 5500) * KG_M3_TO_G_CC;
}

export function conditionFromPlanet(planetData) {
  const d = planetData || {};
  const comp = d.composition || {};
  // fp-shaped view of the game body. Defaults mirror driver-presets.js so a partially-populated body
  // degrades to the same place a sparse preset would, instead of throwing.
  const fp = {
    radiusEarth: d.radiusEarth ?? 1.0,
    massEarth:   d.massEarth ?? 1.0,
    composition: {
      ironFraction:     comp.ironFraction ?? 0.32,
      // NOT comp.density — see densityToGramsPerCC above. The game stores kg/m^3, the engine wants g/cc.
      density:          densityToGramsPerCC(comp.density),
      volatileFraction: comp.volatileFraction ?? 0.15,
      ...(comp.carbonToOxygen != null ? { carbonToOxygen: comp.carbonToOxygen } : {}),
    },
    age:           d.age ?? 4.5,
    // NOT d.T_eq — see surfaceTemperatureOf above. The engine wants SURFACE temperature.
    T_eq:          surfaceTemperatureOf(d.T_eq ?? 288, d.atmosphere?.pressure),
    eccentricity:  d.eccentricity ?? 0,
    tidalState:    d.tidalState || { locked: false },
    atmosphere:    d.atmosphere ?? null,
    surfaceHistory: d.surfaceHistory || { erosion: 0, bombardmentIntensity: 0, resurfacingRate: 0 },
    ...(d.rotationHours != null ? { rotationHours: d.rotationHours } : {}),
  };
  return deriveConditionVector(fp, null, fp.radiusEarth);
}
