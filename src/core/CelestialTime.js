/**
 * CelestialTime — realism factors for orbital + rotational motion.
 *
 * Per workstream brief
 * `docs/WORKSTREAMS/realistic-celestial-motion-2026-04-27.md`.
 *
 * Generation-side authoring uses these factors so each body is *born*
 * with realistic angular rates. The consumer side (`main.js` →
 * `entry.planet.update(celestialDt)` etc.) scales the realistic baseline
 * by the user's `celestialTimeMultiplier` setting per frame.
 *
 * Two factors because the legacy code used different "speedup" conventions
 * for orbits vs. rotations — orbits were ~6280× too fast at MAP_BASE
 * (Earth-equivalent at `keplerSpeed = 0.00125` rad/s), rotations were 24×
 * too fast (Earth-equivalent at `0.1 deg/s`). To bring both to real
 * physical periods, the legacy values multiply by these factors at
 * generation time.
 *
 * Reference periods (real Earth + real Moon):
 *
 *   - Earth orbit: 1 year = 365.25 × 86400 s = 31,557,600 s
 *     → 2π / 31,557,600 ≈ 1.991 × 10⁻⁷ rad/s
 *     legacy `0.00125 × 1/6280` ≈ 1.991 × 10⁻⁷ ✓
 *
 *   - Earth axial rotation: 1 sidereal day ≈ 86,400 s (rounding
 *     to civil day for Game-Bible-cinematic register)
 *     → 360° / 86,400 ≈ 4.167 × 10⁻³ deg/s
 *     legacy `0.1 × 1/24` ≈ 4.167 × 10⁻³ ✓
 *
 *   - Moon axial rotation: 27.3 days = 2.36 × 10⁶ s (tidally locked)
 *     → 360° / 2.36 × 10⁶ ≈ 1.525 × 10⁻⁴ deg/s
 *     legacy `0.167 × 1/1100` ≈ 1.518 × 10⁻⁴ ✓
 *
 * The constants are intentionally module-level — Principle 5
 * (Model→Pipeline→Renderer): generation produces realistic data,
 * the consumer scales by a per-frame multiplier, the renderer
 * never multiplies by realism factors before drawing.
 */

/**
 * Multiply a legacy-accelerated orbital angular speed (rad/s) by this
 * factor at generation time to land on a realistic value. Derived from
 * Earth at `keplerSpeed(MAP_BASE) = 0.00125` rad/s vs. real Earth
 * angular speed `1.991e-7` rad/s.
 */
export const ORBIT_REALISM_FACTOR = 1 / 6280;

/**
 * Multiply a legacy-accelerated planetary axial rotation rate (deg/sec)
 * by this factor at generation time to land on a realistic value.
 * Derived from Earth-equivalent legacy `0.1 deg/s` vs. real Earth
 * `4.167e-3 deg/s` (24-hour civil day).
 */
export const ROTATION_REALISM_FACTOR = 1 / 24;

/**
 * Multiply a legacy-accelerated lunar axial rotation rate (deg/sec) by
 * this factor at generation time to land on a realistic value. Derived
 * from `Moon.js` legacy hardcoded `0.167 deg/s` vs. real Moon
 * `1.525e-4 deg/s` (27.3-day tidally-locked period).
 *
 * Currently applied as a single global factor because `MoonGenerator`
 * does not emit per-moon `rotationSpeed` data. A future workstream
 * could author per-moon rotation periods (and tidal-lock invariants);
 * this constant becomes the fallback default in that world.
 */
export const MOON_ROTATION_REALISM_FACTOR = 1 / 1100;

/**
 * Default realistic moon rotation in deg/s, used by `Moon.js` when
 * `data.rotationSpeed` is absent. Equivalent to the legacy `0.167`
 * scaled by `MOON_ROTATION_REALISM_FACTOR`.
 */
export const MOON_ROTATION_DEFAULT_DEG_PER_SEC = 0.167 * MOON_ROTATION_REALISM_FACTOR;

/**
 * Scale a legacy orbital angular speed to its realistic baseline.
 * Use at generation time so the data on each body is born realistic.
 */
export function realisticOrbitSpeed(legacyValue) {
  return legacyValue * ORBIT_REALISM_FACTOR;
}

/**
 * Scale a legacy planetary axial rotation rate (deg/s) to its realistic
 * baseline. Use at generation time.
 */
export function realisticRotationSpeed(legacyValue) {
  return legacyValue * ROTATION_REALISM_FACTOR;
}
