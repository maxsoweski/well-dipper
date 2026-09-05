/**
 * GLOW_GRADIENT_MODE — how an emissive glow renders its FALLOFF once the buffer is 240p.
 *
 * Max, 2026-09-07, across three judgements in one session, each of which retired the answer before
 * it: the Bayer stipple was a checkerboard; flattening its threshold "reads pasted-on"; quantising
 * the falloff left the "star surrounded by a bunch of discs ... just get rid of those discs".
 * The requirement, in his words, never moved: *"Dithering accomplishes a simple transparency/glow
 * gradient, we just need one that works with this resolution."*
 *
 * ── WHY NO STIPPLE CAN BE THAT TECHNIQUE AT 240p ────────────────────────────────────────────────
 *
 * A Bayer stipple encodes a gradient in COVERAGE: it lights a varying FRACTION of the pixels and
 * lets the eye average them. That trade needs a cell small enough on screen to average. At 240p the
 * composite magnifies with NearestFilter, so one buffer pixel is 4.5 SCREEN pixels and a 4x4 cell is
 * an 18-screen-pixel block. Nothing averages it — it reads as a literal checkerboard across the
 * whole R*30 flare quad, which is what he saw.
 *
 * ── ⭐⭐⭐ WHAT THE STIPPLE WAS ACTUALLY DOING, WHICH TOOK TWO WRONG ANSWERS TO SEE ────────────────
 *
 * The line is `if (dither > brightness) discard`. It lights a pixel with probability `brightness`
 * and, when lit, writes `brightness`. Its EXPECTED VALUE over the cell is therefore
 * `brightness * brightness`. The dither was never only a texture — it was a GAMMA, and it is what
 * held every faint feature down.
 *
 * That explains both failed answers as one mistake. Deleting the stipple LINEARISES the falloff, so
 * the lens-ghost ring at 4R (alpha 0.15) and the outer halo — features that had always been there,
 * rendered as sparse speckle — get drawn SOLID. Those are the discs. Quantising on top of that
 * added steps to an already-too-bright field and made it worse, and flattening the threshold to 0.5
 * went the other way and AMPUTATED the halo outright, since the entire glow sits under 0.5.
 *
 * ⭐ SO THE HONEST TRANSLATION OF A COVERAGE DITHER INTO VALUE IS ITS EXPECTED VALUE: multiply by
 * brightness. One multiply. It reproduces exactly what the stipple averaged to, at ANY resolution,
 * with no screen-space pattern and no threshold — which is the requirement as he stated it. The core
 * (brightness ~1) is untouched; only the faint regions come back down, which is precisely where the
 * discs were.
 *
 * ⚠ AND THE DISCARD HAS TO SIT BELOW ONE 8-BIT LEVEL. A cut at 0.01 is 2.5/255 — small but not
 * zero, so it draws a faint hard-edged circle where the glow stops, magnified 4.5x. Cutting at
 * 1/255 puts the boundary below the smallest value the framebuffer can hold, so there is nothing
 * left to see. That is in StarFlare.js, not here.
 *
 * ⛔ NOT A SETTING, AN A/B INSTRUMENT. The left-bracket key cycles these so the choice is judged in
 * motion against a live star, per his standing rule that a static artifact cannot carry a look that
 * depends on movement. COVERAGE ships; the other three are the three rejected answers, kept so the
 * comparison has a floor and so nobody re-proposes one of them.
 */


/** The pre-2026-09-07 behaviour: full Bayer stipple. THE DEFECT — kept so the A/B has a floor. */
export const GLOW_MODE_BAYER = 0;
/** cc06693: threshold flattened to 0.5. De-checkers the star, cuts the halo to a hard disc. */
export const GLOW_MODE_HARD = 1;
/** The raw additive falloff, no correction. THE ONE THAT GREW THE DISCS — kept as the reference. */
export const GLOW_MODE_LINEAR = 2;
/** SHIPPED: the stipple's expected value (brightness squared). Pattern-free at any resolution. */
export const GLOW_MODE_COVERAGE = 3;

export const GLOW_MODE_NAMES = ['BAYER (checkerboard)', 'HARD CUT (no halo)', 'LINEAR (discs)', 'COVERAGE'];

/** ⭐ Max, 2026-09-07 — the answer to "one that works with this resolution". */
export const GLOW_GRADIENT_MODE_DEFAULT = GLOW_MODE_COVERAGE;

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
  return Math.min(GLOW_MODE_COVERAGE, Math.max(GLOW_MODE_BAYER, n));
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
