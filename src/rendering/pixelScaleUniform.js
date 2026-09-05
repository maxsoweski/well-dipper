/**
 * PIXEL_SCALE — the WORLD's resolution divisor, as a shared uniform object.
 *
 * Max, 2026-09-06, after setting Pixel Scale to 4.5 for the first time: *"this has also broken the
 * billboards for planets/moons/the main stars and the galaxy glow no longer appears"*, and *"the huge
 * galactic structures like nebulas have some kind of dithering going on that breaks at this
 * resolution, looks checkerboarded"*.
 *
 * ── ONE BUG, FOUR SYMPTOMS ──────────────────────────────────────────────────────────────────────
 *
 * Every one of those surfaces dithers with a cell size written as a bare literal:
 * `floor(gl_FragCoord.xy / 3.0)`. ⭐ `gl_FragCoord` IS IN BUFFER PIXELS, NOT SCREEN PIXELS. The 3
 * was correct exactly once — when the buffer was the screen over 3 — and it silently became a lie the
 * moment the divisor could be anything else. At pixel scale 4.5 a "3-pixel" dither cell is 3 buffer
 * pixels = **13.5 SCREEN pixels**: a giant Bayer checkerboard laid over the nebulae, and for anything
 * faint (the galaxy glow) the raised threshold discards most of it, so it reads as GONE rather than
 * as coarse.
 *
 * ⛔ THIS IS NOT A REGRESSION FROM THE SKY WORK, AND SAYING SO IS NOT AN EXCUSE. It is a latent
 * defect the inventory already found and named — "pixelScale has ten hardcoded copies" — which was
 * unreachable while the slider capped at 5 and stepped by 1. Raising the cap to 8 and the step to 0.5
 * is what made it reachable. Enabling the setting that exposes a bug makes the bug yours.
 *
 * ⭐ THE FIX IS A CELL SIZE IN SCREEN TERMS: a cell of N buffer pixels covers N x scale screen
 * pixels, so to hold ~3 screen pixels the divisor must be 3 / scale, floored at 1 because a cell
 * cannot be smaller than one buffer pixel. Identity at scale 3, which is what shipped, so nothing
 * moves at the old default.
 *
 * ⚠ TWO OBJECTS, NOT ONE — this and SKY_PIXEL_SCALE. The sky and the world are separate buffers with
 * separate divisors (Max's ruling: they get separate knobs), so a shader must take the one belonging
 * to the pass it is drawn in. Scene-side: StarFlare, PlanetBillboard, StarRenderer. Sky-side:
 * StarfieldLayer, WarpTunnelStarfieldLayer, SkyFeatureLayer, ProceduralGlowLayer.
 *
 * ⭐ SHARED OBJECT for the same reason as posterizeLevels.js: materials are built once and mutated,
 * so a build-time read strands every already-mounted material at boot's value.
 */

/** The shipped default — and the value at which every `/ 3.0` literal this replaces was correct. */
export const PIXEL_SCALE_DEFAULT = 3;

/** THE SHARED OBJECT. Hand it in, never a copy. */
export const PIXEL_SCALE = { value: PIXEL_SCALE_DEFAULT };

/**
 * The only writer. A non-finite argument is ignored rather than making every dither divisor a NaN,
 * which would discard whole surfaces rather than merely mis-size their cells.
 * @param {number} scale
 * @returns {number}
 */
export function setPixelScale(scale) {
  const n = Number(scale);
  if (!Number.isFinite(n) || n <= 0) return PIXEL_SCALE.value;
  PIXEL_SCALE.value = n;
  return PIXEL_SCALE.value;
}
