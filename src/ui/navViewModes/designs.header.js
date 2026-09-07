/**
 * navViewModes/designs.js — DESIGN 1 AND DESIGN 2, LIFTED VERBATIM OUT OF `nav-240p-lab.html`.
 *
 * ── ⛔ THIS FILE WAS EXTRACTED BY SCRIPT, NOT RETYPED, AND THAT IS THE POINT ────────────────────
 *
 * Max ruled on two PICTURES, not on two descriptions: *"I love both 1 and 2 for both; I want all of
 * these modes!"*, said against `nav-240p-lab.html` (`b7c8155`) rendering at exactly 427x240 with the
 * shipped face and the game's own data. Any hand-transcription of ~500 lines of texel-exact draw
 * code is a chance to ship a picture he did not rule on, and the drift would be invisible — it looks
 * like a design decision, not like a typo. So the bodies below are byte-identical to the lab's, and
 * the diff against it is the audit.
 *
 * ⭐ WHAT MADE THAT POSSIBLE IS THE LAB'S OWN SHAPE. Every design function reads exactly two
 * module-level objects — `S` (what the view is showing) and `D` (the data behind it) — and calls a
 * handful of primitives. Nothing reads a DOM node, a key handler or a canvas directly. So the whole
 * block drops into a FACTORY: the caller passes `S` and `D` in, they become closure variables under
 * the same names, and not one line of the design code has to know it moved.
 *
 * ⛔ WHICH MEANS `S` AND `D` MUST BE MUTATED, NEVER REPLACED. The closures captured those two
 * identities once. `buildViewState` writes fields onto the same objects every frame; assigning a
 * fresh object would leave every design drawing the state of the frame the factory was built on —
 * a stale picture that repaints happily and never updates.
 *
 * ⛔ DESIGN 3 IS NOT HERE AND MUST NOT BE ADDED. All three judges killed it for deriving the
 * fullscreen layout from the 52x43 cockpit panel, which is the exact inverse of Max's ruling that
 * the fullscreen nav is the SOURCE and the panel is a representation of it. Its central mechanism
 * also does not exist: it needs `__navFit` to abbreviate `[ WARP ]` to `WRP`, and `__navFit`
 * truncates from the right.
 *
 * ── THE FOUR DELIBERATE DEPARTURES FROM THE LAB, ALL OF THEM PLUMBING ───────────────────────────
 *
 *  1. `fire()` reports through an injected `onViolation` instead of `console.error`, so a headless
 *     test can assert the guard fired rather than scrape a console.
 *  2. `lumImage`'s async CPU fallback no longer calls the lab's `draw()`. The nav repaints
 *     continuously, so filling the cache is enough; calling a redraw would be a second animation
 *     loop fighting the first.
 *  3. `zoomIdx` moved onto `S` — in the lab it was a module-level key-handler variable.
 *  4. `PixelText` and the face arrive as parameters rather than imports, so a test can drive the
 *     designs against a recording context with no module graph.
 *
 * ⭐ THE GUARD CAME WITH THEM, AND IT IS THE REASON THIS PORT CAN BE TRUSTED. `assertFits` /
 * `assertClear` were proved by sabotage in the lab and caught four real defects before that. A
 * layout that overflows its region LOOKS fine on a canvas, because the canvas clips the overflow for
 * free — the guard is the only thing between "this design fits" and "this design was cropped".
 */

import { FACE as DEFAULT_FACE, drawPixelText as defaultDraw, measurePixelText as defaultMeasure } from '../../rendering/PixelText.js';

/** `NavComputer.js:69`, verbatim — the density model's stars-per-pc^3 conversion. */
const DENSITY_TO_STARS_PER_PC3 = 0.14 / 0.065;

/** The sabotage string, kept from the lab: `S.sabotage` appends it to each design's longest single
 *  line and hands the UNCLIPPED result to `assertFits`, so the guard is PROVED to fire on demand
 *  rather than asserted to work. ⛔ A guard that has never been made to fail is not yet a guard. */
const SAB = '   SABOTAGE: THIS STRING IS DELIBERATELY LONGER THAN THE ROW IT IS DRAWN INTO AND THE GUARD MUST SAY SO';

/**
 * Build the design painters over one `S` / `D` pair.
 *
 * @param {object}   io
 * @param {object}   io.S  view state — MUTATED in place each frame, never replaced
 * @param {object}   io.D  data bundle — likewise
 * @param {Function} [io.onViolation]  called with a message when the layout guard fires
 * @param {object}   [io.face]  the PixelText face (defaults to the shipped one)
 */
export function makeDesigns({ S, D, onViolation = null, face = DEFAULT_FACE,
                              drawPixelText = defaultDraw, measurePixelText = defaultMeasure }) {
  const FACE = face;
