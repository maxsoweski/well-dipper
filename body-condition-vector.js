// body-condition-vector.js — the pure `_fp → condition vector` derivation (World Engine V2-0 Slice C).
//
// PURPOSE (BUILD-PLAN §2 Slice C / AC4): surface every body-condition scalar the V2-1 E1 regime
// selector will read (composition/density, age, radius, eccentricity, the RAW tidal Io-ratio as an
// explicitly-named field, shellThickness) as ONE nested `condition` sub-object attached to bodyDrivers.
// Importable by the lab (planet-lod-lab.html buildBodyDrivers), the AC1 byte-identity harness
// (tests/fixtures/v2-0-carrier-golden.mjs), the AC4 test, and — later — V2-1 E1 at the writeBodyRelief seam.
//
// SHADOW-MODE / BYTE-SAFETY: this vector is attached NESTED under bodyDrivers.condition, never as flat
// keys. The tune builders (driversToTune / magmaDriversToTune) read only flat keys and ignore unknown
// fields, so the widened bundle is inert — AC1 byte-identity (condition-less golden vs condition-bearing
// gate bundle) is the mechanical proof. R1: a FLAT `age` would re-drive magmaThermal (magmatism.js reads
// flat `d.age`); nesting keeps `condition.age` invisible to it. R4: shellThickness is surfaced AS-IS —
// NO d³ mantle-depth transform is baked here; the semantic split (z/D/d triple-duty) is V2-1's job.
import { bodyShellThickness, bodyRawTidal, bodySurfaceGravity } from './src/worldengine/base/baseStep.js'; // Slice B helpers + AC6 surfaceGravity

// deriveConditionVector(fp, derived, radiusEarth) — pure, no side effects.
//   fp           = the raw DRIVER_PRESETS entry (composition, age, radiusEarth, eccentricity, …).
//   derived      = deriveUniforms(fp, tier) uniforms (has surfaceGravity, tidalHeat[RAW]); the lab passes
//                  its live `u`, the harness passes the same fresh derive.
//   radiusEarth  = the DRAWN render radius (state.planetRadiusEarth in the lab; fp.radiusEarth headless
//                  fallback) — R5: canonical for NAMED_BODY, seeded for archetypes.
export function deriveConditionVector(fp, derived, radiusEarth) { return {
  density:         fp.composition?.density ?? 5.5,       // composition/density
  composition:     fp.composition ?? null,               // D2 volatile / D9 iron / D10 C:O passthrough
  age:             fp.age ?? 4.5,                        // D16 (age0 fallback)
  radiusEarth:     radiusEarth ?? fp.radiusEarth ?? 1.0, // radius (drawn value; fp fallback headless — R5)
  eccentricity:    fp.eccentricity ?? 0,                 // D12 input
  // ── V2-1 AC6 plumbing (gate-1 GAP-1/GAP-2): the two scalars E1's L/Φ/gMod need, missing today. ──
  T_eq:            fp.T_eq ?? 288,                        // SURFACE temperature (D3-MF2 — NOT equilibrium temp); raw-preset read (baseStep reads T_eq internally but never returns it). 288 = lab route default; fallback unreached (all 17 presets define T_eq).
  // D14 — gravity coherence (V2-6 §1A / AC-GCOHERE). g_c = today's expression unchanged (canonical-preset g,
  // EXPOSED from baseStep deriveBodyScalars g=M/R², never re-derived inline). The drawn radius R now scales it:
  // g = g_c·(R/R_c) — the normalized-at-canonical ratio form of M=(ρ/ρ⊕)·R³ per composition class (M_derived(R) =
  // M_c·(R/R_c)³ ⇒ g = M_derived/R² = g_c·(R/R_c)). R_c = fp.radiusEarth ?? 1.0 (canonical), R = the drawn 3rd arg
  // (radiusEarth ?? R_c). BYTE-EXACT at canonical: every golden/NAMED_BODY/headless path passes R === R_c, so
  // R/R_c = 1.0 exactly (float64 x/x) and g_c·1.0 === g_c bit-for-bit — no fixture re-capture (FENCE 1/2).
  surfaceGravity:  (derived?.surfaceGravity ?? bodySurfaceGravity(fp)) * ((radiusEarth ?? fp.radiusEarth ?? 1.0) / (fp.radiusEarth ?? 1.0)),
  // ── V2-1 Slice B addendum (compositionClass gas terminal): E1's Stage-A reads atmosphere.composition
  //    ('h2-he' → 'gas', BUILD-PLAN §4.4). GAP not enumerated by gate-1 (which only sized L's inputs), so
  //    Slice A did not plumb it; surfaced here as a THIRD nested passthrough (same byte-safe discipline as
  //    T_eq/surfaceGravity — nested under condition, invisible to the flat-key tune builders, AC1-inert).
  atmosphere:      fp.atmosphere ?? null,                // atmosphere passthrough (composition read by compositionClass; null for airless presets, handled by ?.composition)
  // ── V2-3 AC-PLUMB-RECONCILE (a): the writeBodyRelief dispatch's locked-awareness (eyeball-despun + T_ss)
  //    reads condition.tidalState.locked — the V2-1 BUILD-PLAN §4.5 gap. NESTED (byte-safe like T_eq /
  //    surfaceGravity — invisible to the flat-key tune builders → AC1-inert). computeE1 stays locked-BLIND;
  //    ONLY the dispatch layer reads this (as writeBodyRelief already reads a `locked` arg today). ──
  tidalState:      { locked: !!(fp.tidalState && fp.tidalState.locked) },
  // ── V2-4 Slice C5 (E2-figure descriptor) addendum: D8 rotationHours plumbed into the condition vector.
  //    Until now NO field carried spin HERE — the gas-band derivation reads the RAW `_fp.rotationHours` in
  //    the lab (planet-lod-lab.html), never this vector. NESTED (like T_eq / surfaceGravity / tidalState) ⇒
  //    invisible to the flat-key tune builders (driversToTune / magmaDriversToTune) and to computeE1, which
  //    read only named keys — so this widening is BYTE-INERT by the same V2-0 precedent the 75-golden proves
  //    (adding a nested key no path reads leaves every HASHED_FIELD untouched). The SOLE reader is
  //    bodyFigure.deriveFigureDescriptor (the E2-figure ω source); the write-path dispatch never reads it.
  //    Fallback 24 h = the driver-presets D8 default (terrestrial presets omit spin — inert here too).
  rotationHours:   fp.rotationHours ?? 24,               // D8 spin (hours) — figure ω source ONLY; never a tune-builder / computeE1 input
  rawTidalIoRatio: derived?.tidalHeat ?? bodyRawTidal(fp), // D12 RAW, explicitly named + un-calibrated (m_hp source)
  shellThickness:  bodyShellThickness(fp),               // baseStep helper (Slice B) — raw scalar, NO d³ transform (R4)
  magneticField:   fp.magneticField,                     // D13 data-only (undefined for lab presets)
  metallicity:     fp.metallicity,                       // metallicity data-only (undefined for lab presets)
};}
