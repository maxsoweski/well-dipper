// src/worldengine/base/surfaceMaterial.js — World Engine V2-6 condition-derived surface-material scalars.
//
// PURE, THREE-FREE, CONDITION-SCALARS-ONLY, IMPORTS NOTHING (Lens L2/L3: importing nothing keeps the module a
// leaf — bombardment.js imports FROM here with no transitive smuggling and no ESM cycle; the tiny clamp01/
// smoothstep helpers are inlined rather than pulled from mathutil so the "imports nothing" invariant holds).
// It reads ONLY condition-vector SCALARS (atmosphere.pressure, T_eq, …) and contains NO regime-dispatch
// substrings (incl. comments) — so the shadow-audit's blind-writer scan passes by construction, and it never
// reads a label / archetype / regime / PRESET_ARCHETYPE (AC-0 grep discipline).
//
// PHASED BUILD (BUILD-PLAN §1E/§1F, Lens L8): SLICE 2 created the module with `erosionOf` ONLY (the exposure-age
// erosion term bombardment.js's t_exp needs — footnote 13's erosion scalar); `icenessOf` + `deriveSurfaceMaterial`
// joined in SLICE 3; `crystallizationPotential(cond, schedule)` joins in SLICE 4 (schedule passed as an explicit
// PARAMETER — never an import — so the dependency stays strictly one-way, no ESM cycle).

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

// ── crystal priors (BUILD-PLAN §1F; SLICE 4). crystallizationPotential = the slow-crystallization endmember
//    signal: an airless crust that no rain erodes, no tides/heat repave, and few impacts churn keeps a pristine
//    growing lattice. Pure fn of condition scalars + the PASSED craterSchedule (explicit parameter — this module
//    imports nothing, so the bombardment dependency stays strictly one-way). N_BOMB_REF pinned by S4's
//    crystal-scalar.mjs decision-artifact table; the ranking conclusion below is N_BOMB_REF-invariant (clamp01
//    preserves order). ────────────────────────────────────────────────────────────────────────────────────────
export const P_AIR_REF   = 0.1;    // bar — above this the surface is no longer airless (crystallization stops)
export const K_RES_TD    = 1.0;    // tidal-resurfacing weight — high-tide worlds (Europa td≈137) repave the crust
export const K_RES_TH    = 1.0;    // thermal/young-crust resurfacing weight — a young crust is still re-forming
export const AGE_RES_REF = 4.5;    // Ga — reference surface age; younger crusts gain a thermal-resurfacing term
export const N_BOMB_REF  = 1.0e7;  // craterSchedule.nAnalytic count that reads as "fully bombarded" (pinned in
                                   // crystal-scalar.mjs; Crystal's 9.47e6 ⇒ intensity≈0.95, Moon's 2.14e6 ⇒ ≈0.21)

// airlessnessOf(cond) — 1 on a bare rock (null/zero atmosphere), → 0 once a real atmosphere exists.
export function airlessnessOf(cond) {
  const P = cond?.atmosphere?.pressure ?? 0;
  return 1 - smoothstep(0, P_AIR_REF, P);
}

// resurfacingRateOf(cond) — [0,1] how fast tides/internal heat repave the crust: a tidal td term (Io/Europa-class
// worlds repave fast) + a young-crust thermal term (a crust younger than AGE_RES_REF is still forming).
export function resurfacingRateOf(cond) {
  const td  = cond?.rawTidalIoRatio ?? 0;
  const age = cond?.age ?? AGE_RES_REF;
  const tidal   = K_RES_TD * (td / (1 + td));
  const thermal = K_RES_TH * clamp01(1 - age / AGE_RES_REF);
  return clamp01(tidal + thermal);
}

// bombardmentIntensityOf(schedule) — [0,1] drawn-impact churn from the PASSED craterSchedule.nAnalytic (§1C) — the
// closed-form drawn-population count. craterSchedule is the explicit parameter (no bombardment import ⇒ no cycle).
// dN/dg = 0 by design (K_GD removed — AC-GCOUNT); radiusEarth is the impact input that moves this term (nAnalytic
// ∝ R²), which is why S4's wiring spy perturbs radiusEarth, not gravity (Lens L10).
export function bombardmentIntensityOf(schedule) {
  const n = schedule?.nAnalytic ?? 0;
  return clamp01(n / N_BOMB_REF);
}

// crystallizationPotential(cond, schedule) — continuous [0,1] slow-crystallization endmember driver. Pure fn of
// condition scalars + the passed craterSchedule; the four factors are each [0,1] so the product stays [0,1]
// (continuity AC). A pristine airless crust (airless · un-eroded · un-resurfaced · little-bombarded) reads high;
// erosion, tides/heat, or heavy impacts each pull it toward 0. A downstream driver like fungal — NOT baked into
// any carrier array, NOT RNG.
//   RECORDED FOR ADJUDICATION (BUILD-PLAN §1F / Lens L9): the presets are condition-scalar DEGENERATE where the
//   old boolean discriminated. The count law N ∝ R²·chronN(age) makes Crystal (R 0.8) the MOST-impacted airless
//   world, so the honest (1−bombardmentIntensity) term drives Crystal's derived potential BELOW Moon/Frozen —
//   inverting the old-boolean ranking (Crystal was the sole boolean-TRUE). Carbon derives ≈max while boolean-false.
//   No condition scalar repairs the split (crystal-scalar.mjs prints the full 18-preset table). S4 ships the scalar
//   + that decision artifact; the extreme-agreement thresholds + the lab facet-wiring flip are
//   deferred-to-adjudication — NOT built around.
export function crystallizationPotential(cond, schedule) {
  const airlessness = airlessnessOf(cond);
  const erosion     = erosionOf(cond);
  const resurf      = resurfacingRateOf(cond);
  const bombard     = bombardmentIntensityOf(schedule);
  return clamp01(airlessness * (1 - erosion) * (1 - resurf) * (1 - bombard));
}

// deriveSurfaceMaterial(cond, schedule) — the material channel returned on relief.surfaceMaterial (a byte-inert
// return-object field, populated on EVERY dispatch path, drawing no RNG — the relief.figure precedent). SLICE-4
// SHAPE (restated per Lens L8, declared in-plan not a deviation): exactly
// { iceness, crystallizationPotential, regolithRoughness }. `schedule` is the craterSchedule output the
// composition site computes once and passes in (explicit PARAMETER — this module imports nothing, no cycle).
export function deriveSurfaceMaterial(cond, schedule) {
  return {
    iceness: icenessOf(cond),
    crystallizationPotential: crystallizationPotential(cond, schedule),
    regolithRoughness: schedule?.regolithRoughness ?? 0,
  };
}
