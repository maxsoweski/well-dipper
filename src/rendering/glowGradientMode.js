/**
 * GLOW_GRADIENT_MODE — how an emissive glow renders its FALLOFF once the buffer is 240p.
 *
 * Max, 2026-09-07, on the hard-edged halo that replaced the checkerboard: *"it looks bad. Dithering
 * accomplishes a simple transparency/glow gradient, we just need one that works with this
 * resolution. It reads pasted-on now."*
 *
 * ── WHY DITHER CANNOT BE THAT TECHNIQUE AT 240p ─────────────────────────────────────────────────
 *
 * A Bayer stipple encodes a gradient in COVERAGE: it lights a varying FRACTION of the pixels and
 * lets the eye average them. That trade only works while the cell is small enough on screen to
 * average. At 240p the composite magnifies with NearestFilter, so one buffer pixel is 4.5 SCREEN
 * pixels and a 4x4 cell is an 18-screen-pixel block. Nothing averages it — it reads as a literal
 * checkerboard, which is what he saw across the whole R*30 flare quad.
 *
 * ⭐ SO THE GRADIENT HAS TO MOVE FROM COVERAGE INTO VALUE. The material is already AdditiveBlending
 * with alpha 1, so the framebuffer computes `src.rgb + dst.rgb` — the falloff is ALREADY carried by
 * the magnitude of `color`, and the dither was only punching holes in it. Deleting the stipple does
 * not remove a gradient, it stops destroying one.
 *
 * ── WHY BANDED IS THE DEFAULT AND NOT SMOOTH ────────────────────────────────────────────────────
 *
 * A bare additive falloff is a correct gradient but a modern-looking one: smooth to 8 bits, which no
 * fifth-generation machine could hold. Quantising it puts the gradient back in the era WITHOUT
 * reintroducing a screen-space pattern, because the steps live in brightness, not in pixels — so it
 * is resolution-independent by construction and does not decay as the buffer coarsens.
 *
 * ⭐ AND THE STEP COUNT IS NOT A NEW TUNING CONSTANT. It is POSTERIZE_QUANTUM, the colour-depth
 * number Max already owns and has already ruled on (31 = RGB555). That also hands the mode its
 * termination for free: anything below one quantum floors to zero and is discarded, so the glow ends
 * where the colour depth says it ends rather than at an invented threshold. This is the one surface
 * where re-including the emissive term in posterisation is deliberate — `planetShaders.glsl.js:203`
 * exempts emissive on purpose, and that exemption is still right for a lit surface.
 *
 * ⛔ NOT A SETTING, AN A/B INSTRUMENT. The `[` key cycles these so the choice can be judged in
 * motion against the live star, per his standing rule that a static artifact cannot carry a
 * look that depends on movement. BANDED is the shipped answer; the other three exist to be
 * compared against it, including BAYER, which is the defect itself kept as the reference point.
 */

/** The pre-2026-09-07 behaviour: full Bayer stipple. THE DEFECT — kept so the A/B has a floor. */
export const GLOW_MODE_BAYER = 0;
/** cc06693: threshold flattened to 0.5. De-checkers the star, cuts the halo to a hard disc. */
export const GLOW_MODE_HARD = 1;
/** No cut at all — the raw additive falloff. Correct, but smooth to 8 bits and reads modern. */
export const GLOW_MODE_SMOOTH = 2;
/** The additive falloff quantised to the colour-depth setting. Era-correct and resolution-free. */
export const GLOW_MODE_BANDED = 3;

export const GLOW_MODE_NAMES = ['BAYER (pre-fix)', 'HARD CUT', 'SMOOTH', 'BANDED'];

/** ⭐ Max, 2026-09-07 — the answer to "one that works with this resolution". */
export const GLOW_GRADIENT_MODE_DEFAULT = GLOW_MODE_BANDED;

/**
 * THE SHARED OBJECT. Same argument as `posterizeLevels.js` and `pixelScaleUniform.js`: these
 * materials are built once per star and mutated, so a build-time read would strand every
 * already-mounted flare at whatever the mode was when it spawned. three reads `.value` each draw,
 * so one write moves every live star. ⛔ Do not clone the uniform map of anything that takes it.
 */
export const GLOW_GRADIENT_MODE = { value: GLOW_GRADIENT_MODE_DEFAULT };

/** @param {number} mode @returns {number} the clamped, applied value */
export function clampGlowGradientMode(mode) {
  const n = Math.round(Number(mode));
  if (!Number.isFinite(n)) return GLOW_GRADIENT_MODE_DEFAULT;
  return Math.min(GLOW_MODE_BANDED, Math.max(GLOW_MODE_BAYER, n));
}

/**
 * The only writer. A non-finite argument leaves the picture alone rather than making the uniform a
 * NaN, which would fail every branch comparison and discard the entire flare.
 * @param {number} mode @returns {number}
 */
export function setGlowGradientMode(mode) {
  const n = Number(mode);
  if (!Number.isFinite(n)) return GLOW_GRADIENT_MODE.value;
  GLOW_GRADIENT_MODE.value = clampGlowGradientMode(n);
  return GLOW_GRADIENT_MODE.value;
}

/** Advance to the next mode, wrapping. Returns `{ mode, name }` for the on-screen readout. */
export function cycleGlowGradientMode() {
  const mode = setGlowGradientMode((GLOW_GRADIENT_MODE.value + 1) % GLOW_MODE_NAMES.length);
  return { mode, name: GLOW_MODE_NAMES[mode] };
}
