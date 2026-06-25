/**
 * SpeedFormat — physically-true, three-tier speed readout for the supercruise HUD.
 *
 * The supercruise model carries speed in scene-units/sec. Near a small body that
 * is ~0.01–0.05 scene-u/s, so the old `speed.toFixed(0)` rendered "0" even while
 * the ship was clearly moving. The fix: never render raw scene-units — always
 * convert to a readable physical unit (km/s, Mm/s, or c) so the number is never
 * "0" while moving.
 *
 * Conversion anchor (from ScaleConstants): 1 scene-u/s = 149,597.8707 km/s ≈ 0.499 c.
 *
 * Pure module — no DOM, no side effects. Unit-tested in __tests__/SpeedFormat.test.js.
 */

import { METERS_PER_SCENE } from '../core/ScaleConstants.js';

// ── Derived unit constants ──
export const KM_PER_SCENE        = METERS_PER_SCENE / 1000;          // 149597.8707 km per scene-u
export const C_IN_SCENE_PER_S    = 299792.458 / KM_PER_SCENE;        // 2.00399… scene-u/s == 1 c
export const MM_S_IN_SCENE_PER_S = 1000 / KM_PER_SCENE;              // 0.0066847 scene-u/s == 1 Mm/s

// Mm/s → c crossover. The Mm/s tier runs up to 0.1 c, then we switch to c so the
// displayed number stays small/legible (Elite-style). 0.1 c keeps the "0.50 c"
// example from the spec table (and the c-under-100 → 2dp rule) consistent.
const C_TIER_THRESHOLD_SCENE_PER_S = 0.1 * C_IN_SCENE_PER_S;          // 0.1 c in scene-u/s

/** Insert thousands separators into the integer part of a numeric string. */
function withThousands(numStr) {
  const neg = numStr.startsWith('-');
  const body = neg ? numStr.slice(1) : numStr;
  const [intPart, fracPart] = body.split('.');
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const out = fracPart !== undefined ? `${grouped}.${fracPart}` : grouped;
  return neg ? `-${out}` : out;
}

/**
 * Format a scene-units/sec speed into a readable, physically-true string.
 * @param {number} sceneUPerSec speed in scene-units per second
 * @returns {{ value: string, unit: 'km/s'|'Mm/s'|'c', raw: number }}
 *   `value` is the formatted display number (with thousands separators),
 *   `unit` is the chosen tier, `raw` is the unrounded value in that unit.
 */
export function formatSpeed(sceneUPerSec) {
  const s = Math.abs(sceneUPerSec) || 0;

  if (s < MM_S_IN_SCENE_PER_S) {
    // km/s tier: integer when ≥ 100 (already big), else 1-dp so slow speeds
    // near a body never round to "0".
    const raw = s * KM_PER_SCENE;
    const value = raw >= 100
      ? withThousands(Math.round(raw).toString())
      : withThousands(raw.toFixed(1));
    return { value, unit: 'km/s', raw };
  }

  if (s < C_TIER_THRESHOLD_SCENE_PER_S) {
    // Mm/s tier: always 2-dp.
    const raw = (s * KM_PER_SCENE) / 1000;
    return { value: withThousands(raw.toFixed(2)), unit: 'Mm/s', raw };
  }

  // c tier: 2-dp under 100, else integer.
  const raw = s / C_IN_SCENE_PER_S;
  const value = raw < 100
    ? withThousands(raw.toFixed(2))
    : withThousands(Math.round(raw).toString());
  return { value, unit: 'c', raw };
}

// ── Log-scale speed bar ──
//
// The live speed range spans many decades (~0.0005 c near a body … 10000 c
// deep-space cap), so a linear bar would pin to one end. A log10 mapping over
// that window gives a usable fill fraction across the whole range.

export const SPEED_BAR_MIN_C = 0.0005;   // log10 ≈ -3.30 — bar empty at/below this
export const SPEED_BAR_MAX_C = 10000;    // log10 = 4.00  — bar full at/above this

/**
 * Map a scene-units/sec speed to a clamped [0, 1] bar fill fraction (log scale).
 * @param {number} sceneUPerSec speed in scene-units per second
 * @returns {number} fill fraction in [0, 1]
 */
export function speedToBarFrac(sceneUPerSec) {
  const cVal = Math.max(1e-9, sceneUPerSec / C_IN_SCENE_PER_S);
  const lo = Math.log10(SPEED_BAR_MIN_C), hi = Math.log10(SPEED_BAR_MAX_C);
  return Math.min(1, Math.max(0, (Math.log10(cVal) - lo) / (hi - lo)));
}
