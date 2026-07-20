// src/worldengine/base/surfaceMaterial.js — World Engine V2-6 condition-derived surface-material scalars.
//
// PURE, THREE-FREE, CONDITION-SCALARS-ONLY, IMPORTS NOTHING (Lens L2/L3: importing nothing keeps the module a
// leaf — bombardment.js imports FROM here with no transitive smuggling and no ESM cycle; the tiny clamp01/
// smoothstep helpers are inlined rather than pulled from mathutil so the "imports nothing" invariant holds).
// It reads ONLY condition-vector SCALARS (atmosphere.pressure, T_eq, …) and contains NO regime-dispatch
// substrings (incl. comments) — so the shadow-audit's blind-writer scan passes by construction, and it never
// reads a label / archetype / regime / PRESET_ARCHETYPE (AC-0 grep discipline).
//
// PHASED BUILD (BUILD-PLAN §1E/§1F, Lens L8): SLICE 2 creates the module with `erosionOf` ONLY (the exposure-age
// erosion term bombardment.js's t_exp needs — footnote 13's erosion scalar); `icenessOf` + `deriveSurfaceMaterial`
// join in SLICE 3; `crystallizationPotential(cond, schedule)` joins in SLICE 4 (schedule passed as an explicit
// PARAMETER — never an import — so the dependency stays strictly one-way).

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const smoothstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// ── erosion priors (condition-pure; the waterWindow constants are RESTATED from deriveBodyScalars, cited not
//    imported, so the module stays a leaf). erosion = how fast rain+wind work the surface (footnote 13). ──────
export const P_ER_REF     = 0.5;   // bar — pressure at which wind/rain erosion is fully engaged
export const DRY_ER_FLOOR = 0.1;   // a thin dry-wind erosion floor once an atmosphere exists at all

// erosionOf(cond) — continuous [0,1] surface-erosion rate from condition scalars only.
//   pressure gate  · max(liquid-water window, dry-wind floor)
//   waterWindow = smoothstep(248,273,T)·(1−smoothstep(373,398,T)) — the deriveBodyScalars liquid-water band,
//   restated from cond scalars (NOT imported — keeps this module import-free). Airless (P=0) ⇒ erosion 0 ⇒ the
//   exposure-age erosion term never binds (Moon/Frozen/Crystal expose their full age); atmospheric worlds
//   (Rocky/Ocean/Titan) get a short crater-retention age BY EROSION, not by a binary gate.
export function erosionOf(cond) {
  const P = cond?.atmosphere?.pressure ?? 0;
  const T = cond?.T_eq ?? 288;
  const waterWindow = smoothstep(248, 273, T) * (1 - smoothstep(373, 398, T));
  return clamp01(smoothstep(0, P_ER_REF, P) * Math.max(waterWindow, DRY_ER_FLOOR));
}

// ── iceness priors (BUILD-PLAN §1E; calibration/surface-material.mjs pins them against the 18-preset table so
//    Frozen/Europa/Titan read HIGH, Crystal reads nonzero-LOW ≈0.065 (Lens L7 — its Frozen-pairing driver is
//    crystallizationPotential, S4, not iceness), and Moon/Mercury/Mars read ≈0). A low MEAN density, a volatile
//    budget, and a COLD surface together make an icy material; high-density rock or a warm surface ⇒ 0. ─────────
export const DENS_ICE_HI   = 2.0;   // g/cc — at/below this the mean density reads fully icy
export const DENS_ROCK_LO  = 3.5;   // g/cc — at/above this it reads fully rocky (the density term → 0)
export const VOL_LO        = 0.1;   // volatile-fraction low edge (below ⇒ only the dry-icy floor survives)
export const VOL_HI        = 0.5;   // volatile-fraction high edge (full volatile budget)
export const ICE_VOL_FLOOR = 0.25;  // a dry-but-icy floor — a low-density cold body can be icy without a big volatile budget
export const T_ICE_LO      = 200;   // K — below this the surface is fully frozen
export const T_ICE_HI      = 273;   // K — water ice melts; above this the cold gate → 0

// icenessOf(cond) — continuous [0,1] icy-material fraction from condition scalars only. Consumed by (1) the
// bombardment ice-relaxation gate (ε × iceness, §1D) and (2) the render-side uIcenessMix albedo uniform (§1E).
// Reads composition.density (falling back to the top-level condition-vector `density` field) + volatileFraction
// + T_eq — no label / archetype / dispatch read.
export function icenessOf(cond) {
  const density = cond?.composition?.density ?? cond?.density ?? 5.5;
  const vf = cond?.composition?.volatileFraction ?? 0;
  const T = cond?.T_eq ?? 288;
  const dens = 1 - smoothstep(DENS_ICE_HI, DENS_ROCK_LO, density);   // low density ⇒ icy
  const vol  = Math.max(smoothstep(VOL_LO, VOL_HI, vf), ICE_VOL_FLOOR);
  const cold = 1 - smoothstep(T_ICE_LO, T_ICE_HI, T);
  return clamp01(dens * vol * cold);
}

// deriveSurfaceMaterial(cond, schedule) — the material channel returned on relief.surfaceMaterial (a byte-inert
// return-object field, populated on EVERY dispatch path, drawing no RNG — the relief.figure precedent). SLICE-3
// SHAPE: exactly { iceness, regolithRoughness } (Lens L8). `crystallizationPotential` joins in SLICE 4 and the
// shape assert restates there — declared in-plan, not a deviation. `schedule` is the craterSchedule output the
// composition site computes once and passes in (explicit PARAMETER — this module imports nothing, no cycle).
export function deriveSurfaceMaterial(cond, schedule) {
  return {
    iceness: icenessOf(cond),
    regolithRoughness: schedule?.regolithRoughness ?? 0,
  };
}
