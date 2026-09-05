/**
 * SKY_PIXEL_SCALE — the sky's own resolution divisor, as a shared uniform object.
 *
 * Max, 2026-09-06, after judging the first attempt: *"I don't want to abandon the sky resolution
 * question, just noted that the application we just tested is not the solution we'll want to go with.
 * There have to be ways of getting a consistent resolution for the starfield without it looking like
 * that."* He was right, and the reason the first attempt looked like that is a bug, not a limit.
 *
 * ── WHY THE FIRST LOW-RES SKY LOOKED "SUPER CHUNKY" ─────────────────────────────────────────────
 *
 * `gl_PointSize` is in DEVICE PIXELS OF THE TARGET BEING DRAWN INTO, and every star's size was an
 * absolute literal with no reference to that target: `StarfieldLayer.js` draws 4.0 / 12.0 / 16.0.
 * Render the same points into a 1/3-size buffer and each star is still 4 buffer pixels — which the
 * composite's NearestFilter magnify then blows up to **12 SCREEN pixels**. The rare bright ones went
 * 16 → 48. So switching the sky to the world's resolution did not merely coarsen the starfield, it
 * made every star THREE TIMES BIGGER. That is what he rejected, and it was never the question we
 * meant to ask him.
 *
 * ⭐ THE FIX IS TO HOLD SCREEN SIZE CONSTANT AND LET ONLY THE GRID COARSEN. Dividing the point size
 * by this scale means a star occupies the same fraction of the SCREEN at every setting; what changes
 * is how coarse the lattice it lands on is. That is the actual variable Max wants to judge —
 * "consistent resolution", not "bigger stars".
 *
 * ⚠ AND IT HAS A REAL FLOOR, WHICH IS THE HONEST LIMIT OF THE IDEA. A 4-screen-pixel star at sky
 * scale 4 is a 1-buffer-pixel star; past that it is sub-pixel and starts to drop out and twinkle as
 * the camera moves, because a point sample either lands in a texel or does not. Nothing here can fix
 * that — it is what a point cloud does on a coarse grid, and it is why the real machines drew their
 * starfields AT native resolution as individual pixels rather than downsampling a dense field.
 * Numbers, per setting, are in the settings label.
 *
 * ⭐ SHARED OBJECT, NOT A NUMBER — the same argument as `posterizeLevels.js` and for the same reason:
 * these materials are built once and mutated, so a build-time read would strand every already-built
 * layer at whatever the value was when it mounted. three reads `.value` off the object each draw, so
 * one setter moves every live sky material. ⛔ Do not clone the uniform map of anything that takes it.
 */

/** Full resolution — the shipped default, and Max's standing ruling on the starfield. */
export const SKY_PIXEL_SCALE_DEFAULT = 1;

/** Below 1 the sky would render LARGER than the screen (pure cost, no visible gain); 8 matches the world's slider. */
export const SKY_PIXEL_SCALE_MIN = 1;
export const SKY_PIXEL_SCALE_MAX = 8;

/**
 * THE SHARED OBJECT. Consumed by every point-drawing sky layer to keep stars a constant
 * SCREEN size: StarfieldLayer, WarpTunnelStarfieldLayer, and SkyFeatureLayer's two point programs.
 * ⚠ Mesh layers (ProceduralGlowLayer, SkyFeatureLayer's nebula shells, GalaxyGlowLayer) do NOT take
 * it and must not — a mesh is an AREA and scales with the target on its own; dividing its size would
 * shrink the nebula rather than coarsen it.
 */
export const SKY_PIXEL_SCALE = { value: SKY_PIXEL_SCALE_DEFAULT };

/** @param {number} scale @returns {number} the clamped, applied value */
export function clampSkyPixelScale(scale) {
  const n = Number(scale);
  if (!Number.isFinite(n)) return SKY_PIXEL_SCALE_DEFAULT;
  return Math.min(SKY_PIXEL_SCALE_MAX, Math.max(SKY_PIXEL_SCALE_MIN, n));
}

/**
 * The only writer. A non-finite argument leaves the picture alone rather than making every
 * `gl_PointSize` a NaN, which would silently drop the entire starfield.
 * @param {number} scale
 * @returns {number}
 */
export function setSkyPixelScale(scale) {
  const n = Number(scale);
  if (!Number.isFinite(n)) return SKY_PIXEL_SCALE.value;
  SKY_PIXEL_SCALE.value = clampSkyPixelScale(n);
  return SKY_PIXEL_SCALE.value;
}
