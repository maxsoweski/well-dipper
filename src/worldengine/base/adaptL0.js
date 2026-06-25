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
