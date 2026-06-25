export const STICK_TUNING = {
  DEADZONE: 0.06,   // radial deadzone (matches the prior per-axis 0.06)
  EXPO: 0.30,       // cubic-blend expo, [0, 0.6]
};

// Curved magnitude for a normalized radial magnitude m_raw ≥ 0. Deadzone + rescale + cubic blend.
export function shapeMagnitude(mRaw, { deadzone = STICK_TUNING.DEADZONE, expo = STICK_TUNING.EXPO } = {}) {
  const dz = deadzone;
  const r = Math.min(1, Math.max(0, mRaw));
  if (r <= dz) return 0;
  const m = (r - dz) / (1 - dz);              // rescaled 0..1
  return (1 - expo) * m + expo * m * m * m;   // cubic blend
}

// Radial deadzone+expo on a 2D stick vector; preserves direction (NEVER per-axis → diagonals stay correct).
// Returns { x, y } with magnitude = shapeMagnitude(|in|).
export function shapeStick(x, y, opts = {}) {
  const mag = Math.hypot(x, y);
  if (mag < 1e-6) return { x: 0, y: 0 };
  const curved = shapeMagnitude(mag, opts);
  const k = curved / mag;
  return { x: x * k, y: y * k };
}
