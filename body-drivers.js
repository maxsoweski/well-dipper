// body-drivers.js — the lab's NEUTRAL (no-slider-override) body-driver construction, extracted
// verbatim from world-engine-lab.html (World Engine V2-0 Slice A). Shared by the lab's runtime
// buildBodyDrivers (which overlays slider overrides on top of this base) and the headless AC1
// byte-identity harness, so both exercise the SAME neutral path (no duplication, no drift).
import { magmaThermal } from './src/worldengine/base/magmatism.js'; // exact import path per lab (:163)

// presetDriverDefaults(u, fp) — verbatim relocation of world-engine-lab.html:2858-2866.
// { gravity, volatiles, tidal, thermal } derived from the already-derived uniforms (u) + raw preset (fp).
export function presetDriverDefaults(u, fp){
  return {
    gravity: u.surfaceGravity,
    volatiles: (fp.composition && fp.composition.volatileFraction != null) ? fp.composition.volatileFraction : 0.15,
    tidal: u.tidalHeat,
    // Inc.4-M: the preset's derived endogenic thermal drive H (raw Io tidal saturates via clamp01).
    thermal: magmaThermal({ tidalHeating: u.tidalHeat, age: (fp.age != null ? fp.age : 4.5) }),
  };
}

// buildNeutralBodyDrivers(u, fp) — the buildBodyDrivers path with every slider override forced off
// (useOv() ≡ false). The base the lab overlays touched-slider values onto; identical output for
// untouched fields (thermalState left undefined ⇒ magmaThermal's raw-tidal fallback in the writer).
export function buildNeutralBodyDrivers(u, fp) {
  const d = presetDriverDefaults(u, fp);
  return {
    massGravity: d.gravity, volatileFraction: d.volatiles, tidalHeating: d.tidal, thermalState: undefined,
    // AC-PLATECOMP: the FLAT mirror of the preset's authored R_core/R. Flat because driversToTune is
    // fenced from reading drivers.condition (tests/worldengine-base-condition-vector.test.js:199).
    // `undefined` when the preset does not author the field ⇒ driversToTune's `?? D_EARTH` fallback
    // resolves to the anchor ⇒ compFactor exactly 1 ⇒ that preset is byte-identical.
    coreRadiusFraction: (fp.composition && fp.composition.coreRadiusFraction != null)
      ? fp.composition.coreRadiusFraction : undefined,
  };
}
