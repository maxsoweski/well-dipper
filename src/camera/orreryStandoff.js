// ORRERY standoff table (orrery-coherence-2026-07-15, UAT round 2, fix B).
//
// One flat `radius * 6` framed every kind the same, but a StarFlare's glow radius
// is ~3x its geometric radius (StarFlare.js), so a star at 6R filled the frame
// while a flare-less planet at 6R sat too far. This maps each body KIND to the
// radius multiple that frames it consistently:
//
//   star   15R — pulls back for the ~3R glow (StarFlare glow + spike quads)
//   planet  4R — a comfortable framed vantage for a bare sphere
//   moon  2.6R — mirrors HELM's approved close-hold feel (SupercruisePilot
//                HOLD_VIEW_FRAC max(2.6R, 1.05R)), so a moon frames close
//
// A tiny absolute floor (0.002 scene units) is a degenerate-radius backstop only —
// a ~zero-radius body must not collapse the standoff to 0. It is NOT a general
// minimum: any real body's radius*multiple dominates it — the smallest real moons
// are ~0.001 scene units, so their 2.6R (0.0026) clears the floor. (An earlier
// 0.02 floor dominated every moon under 0.0077 and re-parked them ~10R out — the
// exact defect this table exists to fix.)
export const ORRERY_STANDOFF = Object.freeze({ star: 15, planet: 4, moon: 2.6 });

const STANDOFF_FLOOR = 0.002;

/**
 * Pure standoff resolver: the camera vantage distance from a body of `kind`
 * (star|planet|moon) with scene-scale `radius`. Unknown kinds fall back to the
 * planet multiple. Non-finite/negative radii are treated as 0 → the floor.
 *
 * @param {string} kind   'star' | 'planet' | 'moon'
 * @param {number} radius scene-scale geometric radius
 * @returns {number} standoff distance in scene units (>= STANDOFF_FLOOR)
 */
export function orreryStandoff(kind, radius) {
  const mult = ORRERY_STANDOFF[kind] ?? ORRERY_STANDOFF.planet;
  const r = Number.isFinite(radius) && radius > 0 ? radius : 0;
  return Math.max(r * mult, STANDOFF_FLOOR);
}

export default orreryStandoff;
