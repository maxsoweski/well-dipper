// src/worldengine/base/fieldViz.js
// Interim field-viz paint functions (pure; headless-testable). The page (worldengine-fieldviz.html)
// renders these onto a 2D canvas; this module decides nothing about the base step (read-only).
import { REGIME } from './substrate.js';

// regime legend: NORMAL=blue (extension), STRIKESLIP=green (shear), THRUST=red (compression)
export const REGIME_LEGEND = {
  [REGIME.NORMAL]: [60, 120, 220],
  [REGIME.STRIKESLIP]: [60, 190, 90],
  [REGIME.THRUST]: [210, 70, 60],
};
export function regimeColor(regime) { return REGIME_LEGEND[regime] || [128, 128, 128]; }

// grain streak: unit direction at the grain angle (radians). atan2(dy,dx) === angle.
export function grainStreak(grainAngle) { return { dx: Math.cos(grainAngle), dy: Math.sin(grainAngle) }; }

// thickness heatmap: dark (thin) -> bright warm (thick), bounded 0..255 per channel.
export function thicknessHeat(t) {
  const x = Math.max(0, Math.min(1, t));
  return [Math.round(40 + 215 * x), Math.round(30 + 160 * x), Math.round(60 * (1 - x))];
}

export function paintField(output) {
  const sub = output.carrier || output.substrate;
  const crust = output.crust || {};
  const N = sub.regime.length;
  const regimeColors = new Array(N), streaks = new Array(N), thicknessColors = new Array(N);
  const ct = crust.crustalThickness;
  for (let i = 0; i < N; i++) {
    regimeColors[i] = regimeColor(sub.regime[i]);
    streaks[i] = grainStreak(sub.grainAngle[i]);
    thicknessColors[i] = thicknessHeat(ct ? ct[i] : 0);
  }
  return { regimeColors, streaks, thicknessColors };
}
