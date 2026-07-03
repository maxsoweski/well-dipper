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
import { bodyShellThickness, bodyRawTidal } from './src/worldengine/base/baseStep.js'; // BOTH helpers imported (Slice B)

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
  rawTidalIoRatio: derived?.tidalHeat ?? bodyRawTidal(fp), // D12 RAW, explicitly named + un-calibrated (m_hp source)
  shellThickness:  bodyShellThickness(fp),               // baseStep helper (Slice B) — raw scalar, NO d³ transform (R4)
  magneticField:   fp.magneticField,                     // D13 data-only (undefined for lab presets)
  metallicity:     fp.metallicity,                       // metallicity data-only (undefined for lab presets)
};}
