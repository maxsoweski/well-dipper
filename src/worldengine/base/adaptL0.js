// src/worldengine/base/adaptL0.js  (this task: constants + calibrateTidal only; Task 3 adds adaptL0)
import { clamp01 } from './mathutil.js';

// Tidal calibration: map the raw Io-ratio (0..∞, 1.0 = Io-grade) to a bounded [0,1) driver.
// tanh(log10(1+h)/KNEE): Earth-like (~1.7e-3) -> ~0; strictly monotone; never reaches exactly 1.0,
// so distinct heating levels never collapse to the same clamped extreme (the old clamp01(tidalHeat) bug).
// KNEE is the OPEN Io-anchor sub-question (smaller KNEE -> Io reads higher). 1.6 -> Io≈0.19 (top-end spread kept).
export const TIDAL_LOG_KNEE = 1.6;
export const AGE_NORM_DIVISOR = 10;          // Gyr -> [0,1] (~max system age; decision 5e: /~10)
export const DENSITY_KGM3_TO_GCM3 = 1 / 1000; // PhysicsEngine density is kg/m³; base step wants g/cm³
export const LOVE_K2_RANGE = { min: 0.02, max: 1.5 }; // F5 loveK2 written range (rigid small body .. fluid body)

export function calibrateTidal(rawIoRatio) {
  const h = Math.max(0, rawIoRatio || 0);
  return Math.tanh(Math.log10(1 + h) / TIDAL_LOG_KNEE);
}

// ── F2 adapter: WS1 planetData -> base-step bundle (pure; never mutates planetData) ──
export function adaptL0(planetData) {
  const p = planetData || {};
  const comp = p.composition || {};
  // density: PhysicsEngine emits kg/m³ (1000..8000); the base step's smoothstep(2.5,3.9,density)
  // expects g/cm³. Convert when it looks like kg/m³ (>100); pass through g/cm³ / default otherwise.
  const rawDensity = comp.density;
  const density = (rawDensity != null && rawDensity > 100)
    ? rawDensity * DENSITY_KGM3_TO_GCM3
    : (rawDensity ?? 5.5);
  return {
    // tidal: PREFER upstream D12 (single-source). undefined => base step recomputes via Io-formula.
    tidalHeat: (p.tidalHeating != null) ? p.tidalHeating : undefined,
    // age (Gyr) -> ageNorm [0,1]
    ageNorm: (p.age != null) ? clamp01(p.age / AGE_NORM_DIVISOR) : undefined,
    // data-only pass-throughs (eccentricity present but UNUSED by heat on the precedence path)
    magneticField: p.magneticField,
    metallicity: p.metallicity,
    eccentricity: p.eccentricity,
    systemContext: p.systemContext,
    // physical fields the base-step derivation reads
    radiusEarth: p.radiusEarth,
    massEarth: p.massEarth,
    T_eq: p.T_eq,
    composition: { ...comp, density },
    surfaceHistory: p.surfaceHistory ? { ...p.surfaceHistory } : undefined,
  };
}
