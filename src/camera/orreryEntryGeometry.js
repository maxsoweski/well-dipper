// ORRERY entry geometry (orrery-entry-orbits-2026-07-20, AC3).
//
// Pure screen-space geometry for the ratified ORRERY entry rule (Max, 2026-07-20):
//
//   All planet orbits share ONE visibility factor. It is anchored on the
//   OUTERMOST planet's projected screen offset clearing the star's RENDERED
//   glow disc (a generous reading — the glow billboard's clamped screen size,
//   ~8..11 px, not the star's physical angular size). The factor reaches 1 once
//   the outermost ring sits comfortably outside that glow, fades across a short
//   band, and never pops. The arrival spawn sits just BEYOND the factor-zero
//   point, where the star is a bare billboard and no planet is distinct.
//
// No three.js imports — this is a headless, TDD-built numeric core. All tunables
// live at the top as exported constants (tests import them; no magic-number twins).
//
// Formula provenance (mirrored, not re-derived):
//   - Star glow clamp: StarFlare.js:145 (lumFactor) and :350 (targetPx clamp).
//   - Effective-outer walk: main.js:6410-6418 (sort + >5x gap break).

/**
 * Lower edge of the fade band, expressed as a ratio of the outermost ring's
 * screen offset to the star's glow-disc radius. At/below this the orbits are
 * fully faded out (factor 0) — the ring is not yet clear of the glow.
 * @type {number}
 */
export const FADE_BAND_LO = 1.0;

/**
 * Upper edge of the fade band (same ratio units). At/above this the orbits are
 * fully visible (factor 1). The band [LO, HI] is deliberately short so the fade
 * reads as a quick reveal, not a long dissolve.
 * @type {number}
 */
export const FADE_BAND_HI = 1.35;

/**
 * Multiplier applied to the factor-zero distance d0 to place the arrival spawn
 * just BEYOND it — far enough that no orbit line is rendered at spawn, close
 * enough that the zoom-in reads as ~1s. 1.2 = 20% past the vanish point.
 * @type {number}
 */
export const SPAWN_MARGIN = 1.2;

/**
 * Smoothstep with explicit edges. Clamps t to [0,1] so it returns EXACTLY 0
 * at/below `lo` and EXACTLY 1 at/above `hi` (the cubic evaluates to 0 at t=0
 * and 1 at t=1), with a symmetric Hermite ramp between (0.5 at the midpoint).
 * @param {number} lo
 * @param {number} hi
 * @param {number} x
 * @returns {number}
 */
function smoothstep(lo, hi, x) {
  let t = (x - lo) / (hi - lo);
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return t * t * (3 - 2 * t);
}

/**
 * Projected screen offset (in px) of a ring of radius `orbitRadius` seen head-on
 * from camera distance `camDist`, under a vertical FOV of `fovDeg` in a viewport
 * `viewportH` px tall. Standard perspective projection:
 *   px = (orbitRadius / camDist) / tan(fovDeg/2) * (viewportH / 2)
 *
 * @param {{orbitRadius:number, camDist:number, fovDeg:number, viewportH:number}} o
 * @returns {number} screen offset in px (>= 0 for finite positive inputs)
 */
export function screenOffsetPx({ orbitRadius, camDist, fovDeg, viewportH }) {
  const fovRad = (fovDeg * Math.PI) / 180;
  return ((orbitRadius / camDist) / Math.tan(fovRad / 2)) * (viewportH / 2);
}

/**
 * Rendered glow-disc RADIUS of a star of luminosity `luminosity` (Sol = 1), in
 * screen px. Mirrors StarFlare.js exactly:
 *   lumFactor = clamp(0.7 + 0.2*log10(L), 0.55, 2.0)              (StarFlare.js:145)
 *   targetPx  = max(16, min(22, 16 + 6*(lumFactor - 0.55)))       (StarFlare.js:350)
 *   radius    = targetPx / 2
 * The px clamp pins the glow DIAMETER to [16, 22] regardless of distance, so the
 * radius lives in [8, 11]. This radius is the denominator of the visibility rule.
 *
 * @param {number} luminosity solar luminosities (L / L_sun)
 * @returns {number} glow-disc radius in px, in [8, 11]
 */
export function starGlowRadiusPx(luminosity) {
  const lumFactor = Math.min(2.0, Math.max(0.55, 0.7 + 0.2 * Math.log10(luminosity)));
  const targetPx = Math.max(16, Math.min(22, 16 + 6 * (lumFactor - 0.55)));
  return targetPx / 2;
}

/**
 * Effective outermost orbit radius, ignoring a far captured companion. Mirrors
 * main.js:6410-6418 semantics: sort the radii ascending, start at the innermost,
 * and walk outward accepting each ring UNLESS it sits more than 5x beyond the
 * current effective outer — the first such >5x gap ends the walk (a wide binary's
 * far companion must not blow the framing out). Empty input -> 0.
 *
 * @param {number[]} radii orbit radii (any order)
 * @returns {number} effective outermost radius, or 0 for an empty array
 */
export function effectiveOuterOrbit(radii) {
  if (!radii || radii.length === 0) return 0;
  const sorted = [...radii].sort((a, b) => a - b);
  let eff = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] > eff * 5) break;
    eff = sorted[i];
  }
  return eff;
}

/**
 * The shared orbit-visibility factor in [0,1]. Gates fire FIRST:
 *   - userOrbitsOff -> 0 (the user's orbit toggle always wins), then
 *   - regime !== 'orrery' -> 0 (HELM etc. never show ORRERY orbits).
 * Otherwise: ratio = outermost ring's screen offset / glow-disc radius, faded
 * with a symmetric smoothstep across [FADE_BAND_LO, FADE_BAND_HI] — exactly 0
 * at/below LO, exactly 1 at/above HI, monotonic between.
 *
 * @param {{outermostOrbitRadius:number, camDist:number, fovDeg:number,
 *          viewportH:number, starGlowRadiusPx:number, userOrbitsOff?:boolean,
 *          regime?:string}} o
 *        `starGlowRadiusPx` is the glow-disc radius in px (from starGlowRadiusPx()).
 * @returns {number} visibility factor in [0,1]
 */
export function orbitVisibilityFactor({
  outermostOrbitRadius,
  camDist,
  fovDeg,
  viewportH,
  starGlowRadiusPx,
  userOrbitsOff = false,
  regime = 'orrery',
}) {
  if (userOrbitsOff) return 0;
  if (regime !== 'orrery') return 0;
  const offsetPx = screenOffsetPx({ orbitRadius: outermostOrbitRadius, camDist, fovDeg, viewportH });
  const ratio = offsetPx / starGlowRadiusPx;
  return smoothstep(FADE_BAND_LO, FADE_BAND_HI, ratio);
}

/**
 * Arrival spawn distance for an ORRERY entry: the camera distance that lands
 * just BEYOND the factor-zero point, where the star is a bare billboard and no
 * orbit line renders. d0 is the distance where the outermost ring's screen
 * offset equals glowRadius * FADE_BAND_LO (the vanish edge); solving
 * screenOffsetPx == glowRadius*LO for camDist gives:
 *   d0 = outermostOrbitRadius * viewportH / (2 * glowRadius * LO * tan(fov/2))
 * The spawn is d0 * SPAWN_MARGIN. NO far-plane clamping here — that is a wiring
 * concern (AC4), kept out of this pure geometry core.
 *
 * @param {{outermostOrbitRadius:number, fovDeg:number, viewportH:number,
 *          starGlowRadiusPx:number}} o
 * @returns {number} spawn distance in scene units (> d0)
 */
export function arrivalSpawnDistance({ outermostOrbitRadius, fovDeg, viewportH, starGlowRadiusPx }) {
  const fovRad = (fovDeg * Math.PI) / 180;
  const d0 =
    (outermostOrbitRadius * viewportH) /
    (2 * starGlowRadiusPx * FADE_BAND_LO * Math.tan(fovRad / 2));
  return d0 * SPAWN_MARGIN;
}

export default {
  FADE_BAND_LO,
  FADE_BAND_HI,
  SPAWN_MARGIN,
  screenOffsetPx,
  starGlowRadiusPx,
  effectiveOuterOrbit,
  orbitVisibilityFactor,
  arrivalSpawnDistance,
};
