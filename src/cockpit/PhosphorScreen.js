/**
 * PhosphorScreen — the one-ink drawing kit every cockpit panel paints with.
 *
 * Lane F, workstream `cockpit-screen-content-2026-07-28`, AC-PHOSPHOR-KIT.
 *
 * ── WHY THERE IS A KIT AT ALL ───────────────────────────────────────────────
 *
 * Three panel painters are about to be written — NAV, DRIVE/TARGET and INFO —
 * and all three have to obey the same three rules: one ink on black, type large
 * enough to read at fourteen degrees of arc, and warnings that work without
 * colour. Rules that live in a design doc are rules each of the three authors
 * has to REMEMBER. Rules that live in a module are rules each of the three
 * INHERITS by calling it, and can only break by deliberately not using it.
 *
 * So this file is where "Phosphor" stops being an aesthetic and becomes a piece
 * of code with a test around it. The single most important structural fact is
 * this: EVERY `fillStyle` AND `strokeStyle` ASSIGNMENT IN THIS FILE GOES THROUGH
 * `_ink()` OR `_back()`. There are exactly two colour literals in the module and
 * both live in `PHOSPHOR` at the top. That is what makes "one ink" checkable
 * rather than aspirational — the test records every style the kit sets while
 * exercising all six drawing calls, and the SET of values it saw must be exactly
 * those two. It also scans this file's own source for any other hex, `rgb(`,
 * `hsl(` or `0x` colour literal, because `colorHex: 0xff7b6b` — the full-screen
 * HUD's red, in the form three.js takes — contains no '#' and no colour word for
 * a naive scan to catch. (AlertCue.js's header makes the same argument about the
 * same value; this is that argument applied to the drawing side.)
 *
 * INVERSION IS NOT A SECOND HUE. A warning here is an ink-filled block with the
 * text knocked out of it in the background colour, optionally blinking. That is
 * the whole alert vocabulary. A CRT behind glass has one emitter colour, and the
 * moment a second one lands the conceit collapses; more practically, the panel
 * is ~220 screen pixels tall and a hue difference at that size is a smudge,
 * whereas an inverted block is unmistakable.
 *
 * ── THE TYPE SCALE, AND THE ARITHMETIC BEHIND IT ────────────────────────────
 *
 * Max looked at the screens at their measured size this session and ruled they
 * stay as they are — "let's make them work". So the SIZE IS SETTLED and the type
 * scale is the thing that has to give. Here is the sum the ratios come from:
 *
 *   - MEASURED 2026-07-29 off cockpit.glb, from the model's own Eye_Point, in
 *     cockpit-screens-lab.html — NOT assumed. The upper pair (Screen_UL/UR) sit
 *     0.800 m from the eye and subtend 14.25 degrees; the lower pair
 *     (Screen_LL/LR) sit 0.744 m and subtend 15.31 degrees.
 *   - On a 1080-tall display at a 70-degree vertical FOV that is 1080 / 70 ≈ 15
 *     screen pixels per degree.
 *   - So a panel occupies 220 SCREEN PIXELS (upper) or 236 (lower), top to
 *     bottom, no matter how many pixels its offscreen buffer has. The ratios
 *     below are sized against the WORST case, 220.
 *
 * This paragraph used to say "roughly 17 degrees ... about 260 screen pixels",
 * inherited from the brief and never checked. It was wrong in the direction that
 * matters: every tier rendered about 15% smaller than its own stated intent, and
 * the label tier landed at 9.2 screen pixels against a floor of 11 — i.e. under
 * its own floor before a single panel was authored. The lab now prints range,
 * subtense and screen pixels per panel so this can never again be a number
 * somebody remembered.
 *
 * That last clause is the whole reason `typeScale` takes the buffer height and
 * returns proportions of it rather than absolute pixels. The buffer resolution
 * is a quality knob — someone will raise it to 1024 to kill the aliasing — and
 * type written in absolute pixels SHRINKS ON THE GLASS every time that knob goes
 * up, because the same 24 px now covers a quarter as much of the same 220-pixel
 * patch. Anchoring to H means re-picking the resolution re-scales the type and
 * the panel looks identical, only sharper.
 *
 * Converting the ratios to what the pilot actually sees (multiply by 220):
 *
 *     display  H/6   ≈ 37 screen px   the one number a glance is for
 *     body     H/17  ≈ 13 screen px   values, the readout workhorse
 *     label    H/20  = 11 screen px   row labels: BODY, ATMO, MODE
 *     lead     H/11  ≈ 20 screen px   baseline-to-baseline; ~1.55x body
 *     pad      H/17  ≈ 13 screen px   margin from the glass edge, one body line
 *
 * Those right-hand numbers are the ORIGINAL design intent, unchanged. Only the
 * ratios moved, by 260/220 ≈ 1.18, so that the intent is what actually reaches
 * the eye. Seven INFO rows at lead H/11 span roughly 0.64H and still clear the
 * glass, which was checked in the lab rather than assumed — the previous scale
 * left roughly the bottom 40% of every panel empty.
 *
 * H/20 — about 11 screen pixels — IS THE FLOOR, and both text sizes are at or
 * above it. Eleven pixels of cap height is roughly where a bold monospace glyph
 * stops being a shape you read and becomes a shape you recognise; below that the
 * row labels stop being legible and start being decoration. The floor is pinned
 * by a test with the number written out literally in the test file, NOT imported
 * from here, so that lowering the constant in this file cannot also lower the
 * check. The failure it exists to catch is not malice, it is the reasonable-
 * sounding request: "just make it a bit smaller so one more row fits".
 *
 * `lead` at H/11 with `body` at H/17 gives 9 baselines between the margins —
 * exactly the heading, rule and seven INFO rows the budget was drawn for, with
 * today's INFO spending only seven of them. That budget WAS 10; raising the
 * glyph sizes to hit their own stated screen-pixel targets cost the spare one.
 * That is the trade made knowingly: glyph size is what Max actually looks at,
 * and the row count still covers everything INFO is specified to show. If a
 * tenth baseline is ever genuinely needed, drop a row — do not shrink the type,
 * which is the move MIN_TEXT_RATIO exists to block.
 *
 * The returned sizes are FRACTIONAL, not rounded to whole pixels. Rounding would
 * break exact proportionality — the property rule 2 tests — for the sake of
 * nothing, since Canvas2D takes a fractional font size perfectly happily.
 *
 * ── BLINK ───────────────────────────────────────────────────────────────────
 *
 * Once colour is gone, brightness-over-time is the only urgency channel left, so
 * the blink cadences are load-bearing rather than decorative and they are pinned:
 * slow is 1200 ms lit / 600 ms dark, fast is 300 / 150, steady never blinks.
 * `AlertCue.BLINK` hands out those three tier NAMES and deliberately hands out no
 * rates; this is where the names acquire milliseconds.
 *
 * `blinkOn(tier, tMs)` is a PURE function of a clock passed in. It does not call
 * `Date.now`, it does not call `performance.now`, and it holds no phase between
 * calls — which is why its test drives it with literal numbers instead of waiting
 * a second and a half, and why every panel blinking off the same `tMs` blinks in
 * step instead of drifting apart by however long each one has been alive.
 *
 * ── WHY THE CONTEXT IS A CONSTRUCTOR ARGUMENT ───────────────────────────────
 *
 * The kit never reaches for `document`, `window`, `OffscreenCanvas` or
 * `getContext`. It is handed a Canvas2D-shaped object and draws into it. That is
 * not abstraction for its own sake: this repo's vitest runs in plain node with no
 * jsdom, no happy-dom and no node-canvas, so a kit that made its own context
 * could not be tested at all, at any depth. Injection is the difference between
 * this file having a test and not having one.
 *
 * WHAT THE TEST DOES NOT COVER, said plainly: the test asserts what was drawn,
 * where, at what size, in what order and in which of the two colours. It cannot
 * and does not assert that the result LOOKS right — kerning, weight, the balance
 * of a panel, whether the inverted banner reads as alarming. There are no pixels
 * in the test environment to look at. Appearance is Max's eye, on the glass, at
 * the real angular size. This file only guarantees that what reaches his eye
 * obeys the three rules.
 *
 * ── DELIBERATE NON-GOALS ────────────────────────────────────────────────────
 *
 *   - NO 5x7 BITMAP ALPHABET. "Phosphor" here names the look, not the rendering
 *     technique. Bold monospace at a legible size is the agreed answer.
 *   - NO SCANLINES, BLOOM OR CURVATURE. Those are a shader pass over the whole
 *     panel texture, decided once for all four screens, not something a text
 *     drawing kit should be smuggling in per call.
 *   - NO CLOCK. The kit does not know what time it is; `blinkOn` is exported so
 *     a panel can ask "should this be lit this frame" and then simply not call
 *     `banner`. Keeping the decision outside the drawing call is what keeps the
 *     blink testable without a canvas.
 *   - NO WORD WRAP AND NO AUTO-SHRINK-TO-FIT. Both are how a 13-screen-pixel
 *     readout silently becomes an 8-pixel one. Text that does not fit is a
 *     content problem, solved at the source — see InfoReadout's
 *     INFO_VALUE_MAX_CHARS, which is a character budget for exactly this reason.
 */

/**
 * THE TWO COLOURS. Every style this module sets is one of these; there are no
 * other colour literals in the file and the test enforces that by scanning the
 * source as well as by watching what gets drawn.
 *
 * The ink is Well Dipper's Phosphor white — a WARM off-white, not pure #FFFFFF.
 * Pure white on black at this angular size glares and blooms; the warm value is
 * the one cockpit-lab.html's palette cycler already defaults to, so the lab and
 * the shipped panels cannot drift apart.
 */
import { FACE, drawPixelText, measurePixelText } from '../rendering/PixelText.js';

export const PHOSPHOR = Object.freeze({ INK: '#EDE8DE', BACK: '#000000' });

/**
 * Blink cadences, in milliseconds: [lit, dark]. `steady` is null rather than
 * some [Infinity, 0] fiction, so "does not blink" is a distinguishable case
 * rather than a cadence with a suspicious number in it.
 *
 * These three tiers are AlertCue.BLINK's three values, and the test asserts that
 * correspondence rather than this file importing it. Two reasons for the
 * duplication being the right call: a drawing kit that imports the alert
 * vocabulary cannot be reused by anything that is not the alert system, and a
 * test that checks the two agree fails loudly if either side adds a tier, which
 * an import would silently paper over on one side and not the other.
 *
 * The arrays are frozen individually. A shallow freeze on the outer object still
 * lets `BLINK_MS.fast[0] = 900` through, which would retune the alarm cadence
 * for every panel at once from anywhere in the codebase.
 */
export const BLINK_MS = Object.freeze({
  steady: null,
  slow: Object.freeze([1200, 600]),
  fast: Object.freeze([300, 150]),
});

/**
 * The type scale as fractions of the buffer height. See the header for the
 * 17-degrees-of-70 arithmetic these come out of.
 *
 * Exported so a panel author can reason about the scale without instantiating
 * anything. NOT the thing the legibility test compares against — that test
 * writes the numbers out itself, because a test that reads its expectations from
 * the file under test agrees with every future edit by construction.
 */
/**
 * The grid, in rows, BEFORE the resolution multiplier — and every tier is read off the LIVE face
 * rather than typed.
 *
 * ⛔ A FUNCTION, NOT A FROZEN OBJECT, AND THAT IS THE WHOLE POINT. It was `{ body: 5, lead: 6 }`
 * as literals, which is correct for exactly one face. `PixelText`'s header promises the faces are
 * switchable so they can be compared in the running game — and under literals, switching to the
 * 5x7 face would draw seven-row glyphs on six-row leading, colliding every line, with the layout
 * still believing it was five. The face is a shared MUTABLE object for the same reason
 * `RENDER_BUFFER` is: a build-time read strands every consumer on whichever face was live at boot.
 *
 *   display  two cells — the SAME face at integer scale 2, never a second face
 *   body     one cell
 *   label    ⭐ MERGED WITH BODY. A five-row face has no size between them; pretending otherwise
 *            put a second name on one number and invited a fractional one.
 *   pad      one grid unit
 *   lead     one cell plus one row of air
 */
export function typeUnits() {
  return Object.freeze({
    display: 2 * FACE.h,
    body: FACE.h,
    label: FACE.h,
    pad: 1,
    lead: FACE.h + 1,
  });
}

/**
 * Rows the design grid needs: `2*pad + body + 6*lead` — a heading line and six stacked rows.
 * On the shipped 5x5 face that is 2 + 5 + 36 = **43**, which is why the upper panel's measured
 * 42.84 rows is the number every cockpit figure comes off. On the 5x7 alternative it is 57, and
 * a 43-row panel then honestly reports five lines instead of seven — which is exactly the trade
 * `PixelText`'s header states, now computed rather than asserted.
 */
export function gridRows() {
  const u = typeUnits();
  return 2 * u.pad + u.body + 6 * u.lead;
}

/**
 * The smallest fraction of the buffer height any TEXT in this kit is allowed to
 * be. Both text sizes sit at or above it; `label` sits exactly on it.
 *
 * THIS IS ENFORCED, NOT ADVISORY, and it took a review to make it so. The floor
 * used to constrain only `typeScale`'s five sizes — but no panel is obliged to
 * use those. `text(str, x, y, { size: 3 })` is a perfectly ordinary-looking call
 * and it drew type at about 1.6 screen pixels, which is a smudge. So the floor
 * was documentation sitting one convenient argument away from being ignored,
 * and the exact scenario rule 3 exists to stop — "just make it a bit smaller so
 * one more row fits" — went straight past it without a word.
 *
 * `_checkSize` below is where the floor actually bites. Every text-drawing entry
 * point runs through it.
 */
export const MIN_TEXT_TEXELS = 1;

/**
 * Bold, because at 13 screen pixels a regular weight loses most of its stroke to
 * the downsample. Monospace, because these are readouts: a value that changes
 * from "9" to "10" must not shove the rest of the line sideways, and columns
 * that line up are readable at a glance in a way that ragged ones are not.
 *
 * The family is the generic `monospace` and not a named face on purpose. A named
 * face that is not installed falls back silently to something of a DIFFERENT
 * WIDTH, and every centred and right-aligned string on the panel moves — with no
 * error anywhere. Asking for the generic gets whatever the platform actually has.
 */
// ⛔ NO FONT. chrome-and-ui-at-240p: every string on a cockpit panel goes through `PixelText`,
// the one bitmap face in this repo. A vector face antialiases unconditionally and spends its
// detail on fractional edge coverage — which is exactly the wrong currency once the cockpit
// renders into the world buffer, where a panel is ~43 rows tall. Measured: dropping
// `cockpitTarget` to the world buffer with this kit still on `fillText` turned the INFO panel
// into a column of grey mush while the cabin geometry came out correct. The two halves are one
// change.

/**
 * Where the ink of a line sits relative to its baseline, as multiples of the
 * font size. Used to size the inverted block behind a warning.
 *
 * These are approximations, and they are honest ones: the exact ascent and
 * descent of the platform's monospace face are only knowable from
 * `measureText`'s font-box metrics, which are not uniformly available and which
 * the headless test cannot supply meaningfully anyway. 0.8 / 0.25 is the usual
 * shape of a monospace face and errs generous, so the block always covers the
 * glyphs rather than clipping them. A block a little too tall reads as intended;
 * a block that crops the descenders reads as broken.
 */
// ⛔ NO ASCENT/DESCENT. They were honest approximations of a vector monospace face's ink box,
// needed because `measureText` cannot report one portably. A bitmap face has no such uncertainty:
// its cap height IS `size`, it has no descenders, and the baseline is the bottom of the cell. So
// the ink box is exact and `top = y - size`.

/** The accepted `align` spellings, mapped to the one the code works in. */
const ALIGNMENTS = Object.freeze({
  left: 'left',
  right: 'right',
  center: 'center',
  centre: 'center', // Max writes British; a typo'd align must not silently left-align
});

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/**
 * Is this blink tier lit at time `tMs`?
 *
 * Pure: same arguments, same answer, forever. No clock is read here and no phase
 * is remembered between calls, which is what lets the test walk the whole cycle
 * with literal numbers instead of sleeping through it.
 *
 * TWO GUARDS, both defending a specific way a blinking SAFETY cue goes wrong:
 *
 *  1. THE NEGATIVE-TIME MODULO. JavaScript's `%` keeps the sign of its left
 *     operand, so the obvious `tMs % period < on` reads -100 ms as -100, which is
 *     less than 1200 and therefore "lit". The truth is that -100 ms is 1700 ms
 *     into an 1800 ms cycle, which is the DARK phase. A clock zeroed mid-session
 *     — a panel that starts counting from the frame it was created, a paused sim
 *     resuming — hands out small negative values routinely, and the naive form
 *     gets the phase exactly backwards there. `((t % p) + p) % p` is the fix.
 *
 *  2. A BROKEN CLOCK FAILS LIT, NOT DARK. A NaN or Infinity `tMs` compares false
 *     against everything, so the naive form would return "dark" forever — and
 *     the specific consequence of that is TOO CLOSE — SUBLIGHT ONLY never
 *     appearing on the glass at all. A warning stuck lit is a visible fault the
 *     pilot can report; a warning stuck dark is indistinguishable from safety.
 *     So a non-finite clock returns true. It is a silent degradation, which is
 *     why the test pins it by name.
 *
 * An unknown tier THROWS, naming it, rather than defaulting to steady — same
 * reasoning as AlertCue's unknown-dropState throw. A tier renamed on one side of
 * the seam would otherwise turn every alarm into a calm unblinking line, which
 * is precisely the reading the tier exists to prevent.
 *
 * @param {'steady'|'slow'|'fast'} tier which cadence
 * @param {number} tMs the clock, in milliseconds
 * @returns {boolean} whether the thing should be drawn this frame
 */
export function blinkOn(tier, tMs) {
  if (!Object.prototype.hasOwnProperty.call(BLINK_MS, tier)) {
    throw new Error(
      `blinkOn: unknown blink tier ${JSON.stringify(tier)}. ` +
      `Known tiers: ${Object.keys(BLINK_MS).join(', ')}. ` +
      `These are AlertCue.BLINK's values — if a tier was renamed there, rename it ` +
      `here too rather than letting an alarm quietly stop blinking.`,
    );
  }

  const cadence = BLINK_MS[tier];
  if (cadence === null) return true;             // 'steady' — lit, always
  if (!Number.isFinite(tMs)) return true;        // broken clock fails LIT (guard 2)

  const [litMs, darkMs] = cadence;
  const period = litMs + darkMs;
  const phase = ((tMs % period) + period) % period;   // sign-safe (guard 1)
  return phase < litMs;
}

/**
 * The type scale for a buffer of this pixel height.
 *
 * Everything is a fraction of H, never an absolute pixel count — see the header
 * for why, and for where the individual ratios come from.
 *
 * Throws on a non-positive or non-finite height. Zero is the value that matters:
 * it is what an unlaid-out canvas reports, and a scale derived from it makes
 * every font size 0, which draws nothing and reports no error. A blank panel with
 * a clean console is the hardest kind of bug to find, so it gets an exception
 * with the number in it instead.
 *
 * The result is frozen. A panel that "just nudges" `type.body` down for its own
 * layout would be nudging it for every panel sharing the scale, and the whole
 * point of the module is that the scale is one decision.
 *
 * @param {number} bufferHeightPx height of the drawing buffer, in pixels
 * @returns {{display:number, body:number, label:number, pad:number, lead:number}}
 */
export function typeScale(bufferHeightPx) {
  const h = bufferHeightPx;
  if (!Number.isFinite(h) || h <= 0) {
    throw new Error(
      `typeScale: buffer height must be positive and finite, got ${h}. ` +
      `A zero here is the signature of an unlaid-out canvas, and every size ` +
      `derived from it would be 0 — a panel that draws nothing and says nothing.`,
    );
  }
  // ⭐ AN INTEGER UNIT, NOT A FRACTION OF THE HEIGHT. Ratios cannot land a bitmap face on whole
  // rows, and snapping five of them independently makes the character budget wander with the
  // resolution — the panel would be a different layout at every setting instead of the same
  // picture, only sharper. One integer `unit` scales the whole grid; nothing else moves.
  // ⚠ `Math.max(1, …)` so a buffer below one grid-height still draws (chunkier, honestly
  // degraded) rather than collapsing every size to 0, which is the blank-panel-clean-console
  // failure the throw above exists to prevent.
  const unit = Math.max(1, Math.floor(h / gridRows()));
  const u = typeUnits();
  return Object.freeze({
    display: u.display * unit,
    body: u.body * unit,
    label: u.label * unit,
    pad: u.pad * unit,
    lead: u.lead * unit,
    /** The grid unit itself — what `hair`, insets and tick lengths are measured in. */
    unit,
    /** How many `lead`-spaced rows fit under a heading. Painters must not run off the glass. */
    lines: Math.max(1, Math.floor((h - 2 * u.pad * unit - u.body * unit)
      / (u.lead * unit)) + 1),
  });
}

/**
 * A Phosphor drawing surface: one ink, black behind it, type anchored to the
 * buffer height.
 *
 * VERTICAL COORDINATES ARE BASELINES, not tops. `text`, `row` and `banner` all
 * take the y of the text's baseline, which is Canvas2D's own native convention
 * and the one that makes a row of mixed sizes trivially correct — a small label
 * and a larger value sitting on the same y sit on the same line, with no
 * arithmetic. Stack rows by adding `type.lead`.
 */
export class PhosphorScreen {
  /**
   * @param {object} ctx a CanvasRenderingContext2D, or anything shaped like one
   * @param {{width:number, height:number}} size the drawing buffer's pixel size
   */
  constructor(ctx, { width, height } = {}) {
    // Named checks rather than a duck-typed shrug. The overwhelmingly likely
    // mistake is passing the CANVAS instead of `canvas.getContext('2d')` — an
    // object that has a width and a height and therefore looks plausible, but
    // has no fillRect. Without this the first failure is "fillRect is not a
    // function" from somewhere three calls deep in a render loop.
    for (const name of ['fillRect', 'fillText', 'measureText']) {
      if (!ctx || typeof ctx[name] !== 'function') {
        throw new Error(
          `PhosphorScreen: the context has no ${name}(). This class draws through ` +
          `a Canvas2D-shaped object — passing the canvas element itself instead of ` +
          `its 2d context is the usual cause, since a canvas has width and height ` +
          `and looks right until the first draw.`,
        );
      }
    }
    if (!Number.isFinite(width) || width <= 0) {
      throw new Error(
        `PhosphorScreen: width must be positive and finite, got ${width}. ` +
        `A zero-width buffer draws nothing and reports no error.`,
      );
    }

    this.ctx = ctx;
    this.width = width;
    this.height = height;

    /** The scale every draw here defaults to. Frozen; see typeScale. */
    this.type = typeScale(height);

    /**
     * The thickness of a rule, a bar frame, a tick, a pin. Proportional like
     * everything else: at H = 1024 this is 6.4 buffer pixels, which over a panel
     * that occupies ~220 screen pixels lands at about 1.3 screen pixels — a
     * visible hairline rather than a line that vanishes at one resolution and
     * turns into a bar at another.
     *
     * Floored at one whole pixel because a sub-pixel fillRect does not render as
     * a thin line, it renders as a grey smear, and grey is not one of our two
     * colours in any sense a pilot would recognise. The floor only BITES on a
     * small buffer — below H = 160 the proportional value drops under a pixel —
     * which is why the test that defends it builds a deliberately small screen.
     * Every test at the usual 400 px buffer passes with the floor deleted.
     */
    // ⭐ ONE GRID UNIT, AND AN INTEGER. It was `body / 8`, a fraction that lands between texels —
    // and a sub-pixel fillRect does not render as a thin line, it renders as a grey smear. Grey is
    // not one of our two colours in any sense a pilot would recognise. At the grid unit a hairline
    // is exactly one texel at 240p and scales up whole at every higher setting.
    this.hair = this.type.unit;
  }

  /**
   * Refuse a text size below the legibility floor.
   *
   * The trap this defends against, stated plainly: the type scale is only a
   * suggestion to anything that can pass its own `size`. Rule 3's whole point is
   * that "just make it a bit smaller so one more row fits" has to TRIP, and the
   * request arrives as an argument to `text`, not as an edit to `typeScale`. So
   * the check belongs here, at the draw, where the size is finally known.
   *
   * It throws rather than clamping. A clamp would silently redraw the panel to a
   * layout the author did not ask for and did not get told about, and the
   * overlapping text would look like a different bug entirely.
   * @private
   */
  _checkSize(size, where) {
    // ⭐ AN ABSOLUTE TEXEL COUNT, NOT A FRACTION OF THE HEIGHT. `H/20` was the old floor, and once
    // the buffer IS the display grid a fractional floor can only be wrong at some resolution: at
    // H=43 it demands 2.15 px, which no whole number of cells satisfies below 5, and at H=1024 it
    // demands 51.2, which rejects the legal 50. The floor that actually means anything is "at
    // least one whole cell of the face".
    const floor = FACE.h * MIN_TEXT_TEXELS;
    if (!Number.isFinite(size) || size < floor - 1e-9) {
      throw new Error(
        `PhosphorScreen.${where}: text size ${size} is below the legibility floor of ` +
        `${floor} px — one whole ${FACE.w}x${FACE.h} cell — in a ${this.height} px buffer. ` +
        `A bitmap face cannot be drawn at a fraction of a cell; it would be a smear, not a ` +
        `letter. If this fired because one more row was needed, drop a row — do not shrink ` +
        `the type.`,
      );
    }
  }

  /**
   * A px size to the face's integer scale.
   *
   * ⛔ INTEGER, AND FLOORED AT 1. A bitmap face drawn at 1.4x is resampled by the canvas into
   * exactly the grey fringe this whole workstream removes. `typeScale` only ever produces exact
   * multiples of the cell, so this rounds nothing in practice — it exists for the caller that
   * passes its own `size`, which `_checkSize` has already held to a whole cell.
   * @private
   */
  _scaleFor(size) { return Math.max(1, Math.round(size / FACE.h)); }

  /**
   * How many characters fit between the margins at a size.
   *
   * ⭐ THE NUMBER EVERY PANEL NEEDS AND NONE OF THEM SHOULD DERIVE ITSELF. A run of n characters is
   * `n * advance * scale - scale` texels wide — the last one carries no trailing gap — so the fit
   * is `(usable + scale) / (advance * scale)`. A painter that computes this itself is a painter
   * that will be wrong the first time the face or the padding changes, silently, by overflowing
   * the glass rather than by throwing.
   *
   * ⚠ ON THE REAL PANELS THIS IS 8 AND 9. The upper pair (NAV, DRIVE) measures 51.41 texels across
   * at 240 lines and the lower pair (INFO, TARGET) 55.28 — see `chrome-240p-BATCH-PLANS.md` §0.5,
   * which also records that the plan's own 12/13 were the OLD 3x5 face's numbers, and that the
   * same arithmetic reproduces them at `advance` 4, which is what validates it.
   *
   * @param {number} [size] a size from `this.type`; defaults to body
   * @returns {number} whole characters, never below 0
   */
  colsAt(size = this.type.body) {
    const scale = this._scaleFor(size);
    const usable = this.width - 2 * this.type.pad;
    return Math.max(0, Math.floor((usable + scale) / (FACE.advance * scale)));
  }

  // ── The only two places a colour is ever set ──────────────────────────────
  // Every drawing method below goes through these. That is what makes "one ink"
  // a property of the file rather than a promise each method keeps.

  /** @private */ _ink() { this.ctx.fillStyle = PHOSPHOR.INK; }
  /** @private */ _back() { this.ctx.fillStyle = PHOSPHOR.BACK; }

  /**
   * Set the font, and set the text placement modes EXPLICITLY.
   *
   * The explicit part is the point. A Canvas2D context is shared and stateful:
   * `textAlign` and `textBaseline` keep whatever the last drawer left on them.
   * If some other code sets `textAlign = 'center'` and this kit relies on the
   * default, every string on the panel shifts half its width to the left, on the
   * frames after that other code ran and not before. Setting both every time
   * costs nothing and removes an entire category of "it only does it sometimes".
   *
   * Alignment is computed here in the kit and the context is always told 'left',
   * rather than handing `textAlign` the job. Two reasons: the inverted block
   * behind a warning has to be positioned from the same measurement the text is,
   * so the measurement has to exist in this code either way; and it means the
   * placement can be asserted from the drawing log without the test having to
   * reimplement canvas alignment.
   * @private
   */
  // ⛔ `_setFont` IS GONE. There is no font: `drawPixelText` writes texels with `fillRect` and
  // touches neither `ctx.font` nor `textAlign`/`textBaseline`. The whole class of "a shared
  // stateful context left textAlign somewhere else" cannot arise, because the kit no longer
  // depends on any of that state.

  /**
   * Width of a string at a size, in buffer pixels.
   *
   * THE FONT IS SET BEFORE MEASURING, and that ordering is load-bearing:
   * `measureText` reports against whatever font the context currently has, so
   * measuring first and setting the font afterwards returns the width of the
   * PREVIOUS drawer's size. Every centred and right-aligned string then sits off
   * by the ratio between the two sizes — a layout that looks deliberate and is
   * simply wrong.
   *
   * A non-finite width throws rather than propagating. It is what a stub or a
   * broken context hands back, and it turns into NaN coordinates that fillText
   * accepts in silence, drawing nothing at all.
   * @private
   */
  _measure(str, size) {
    // ⭐ ARITHMETIC, NOT `measureText`. The face is fixed-width, so a string's width is exactly
    // `n * advance * scale - scale`. That removes the ordering hazard this comment used to warn
    // about (measure-before-set-font returning the PREVIOUS drawer's size) by removing the shared
    // state it depended on, and it makes the headless tests measure the real thing instead of a
    // stub's guess.
    const w = measurePixelText(str, this._scaleFor(size));
    if (!Number.isFinite(w)) {
      throw new Error(
        `PhosphorScreen: measureText returned a non-numeric width (${w}) for ` +
        `${JSON.stringify(str)}. Every placement below is derived from it, and a ` +
        `NaN x is a fillText that succeeds and draws nothing.`,
      );
    }
    return w;
  }

  /**
   * Where the left edge of a string goes, given its anchor and alignment.
   * Unknown alignments throw: a mistyped 'centre'/'middle' that quietly
   * left-aligned would move text without producing a single error.
   * @private
   */
  _leftEdge(x, w, align) {
    const mode = ALIGNMENTS[align];
    if (!mode) {
      throw new Error(
        `PhosphorScreen: unknown align ${JSON.stringify(align)}. ` +
        `Known: ${Object.keys(ALIGNMENTS).join(', ')}. An unrecognised alignment ` +
        `silently falling back to left is a layout bug with no error attached.`,
      );
    }
    if (mode === 'center') return x - w / 2;
    if (mode === 'right') return x - w;
    return x;
  }

  /** Black over the whole buffer. Every frame starts here. */
  clear() {
    this._back();
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  /**
   * Draw one string.
   *
   * An EMPTY string draws absolutely nothing and returns null — including in
   * invert mode, where the naive version paints a bare ink block with no text in
   * it. On a one-ink panel that block is indistinguishable from a deliberate
   * marker, and InfoReadout hands out empty values routinely by design ("missing
   * means blank"), so this is a case that WILL occur rather than one that might.
   *
   * @param {string} str the text
   * @param {number} x anchor, interpreted per `align`
   * @param {number} y the BASELINE, not the top
   * @param {{size?:number, align?:'left'|'center'|'centre'|'right', invert?:boolean}} [opts]
   * @returns {{x:number, y:number, w:number, h:number}|null} the ink box, or null
   */
  text(str, x, y, opts = {}) {
    const s = String(str ?? '');
    if (!s) return null;

    const size = opts.size ?? this.type.body;
    const align = opts.align ?? 'left';
    const invert = !!opts.invert;
    this._checkSize(size, 'text');

    const w = this._measure(s, size);
    const left = Math.round(this._leftEdge(x, w, align));
    // The baseline is the BOTTOM of the cell: a bitmap face has no descenders, so the ink box is
    // exact rather than the old ASCENT/DESCENT approximation.
    const top = Math.round(y) - size;
    const h = size;

    if (invert) {
      // Ink block first, then the glyphs knocked out of it in the background
      // colour. This is the entire alert vocabulary — no second hue exists.
      const padX = this.hair;
      this._ink();
      this.ctx.fillRect(left - padX, top, w + padX * 2, h);
    }
    // ⛔ COLOUR PASSED EXPLICITLY, ALWAYS. `drawPixelText` saves and restores `ctx.fillStyle` and
    // its own default is the literal '#ffffff' — which would put a THIRD value on the context
    // without appearing anywhere in this file, and this file's source is what the one-ink scan
    // inspects. Inverted text is knocked out in the background colour; everything else is ink.
    drawPixelText(this.ctx, s, left, top, {
      color: invert ? PHOSPHOR.BACK : PHOSPHOR.INK,
      scale: this._scaleFor(size),
      onMissing: 'tofu',
    });

    return { x: left, y: top, w, h };
  }

  /**
   * A label/value line — the INFO and DRIVE workhorse.
   *
   * Label hard left at the margin in the smaller size, value hard right at the
   * margin in body size, both on the one baseline. Pushing them to opposite
   * edges is what makes a column of rows scannable: the eye finds the values by
   * their shared right edge without reading the labels at all, which is the only
   * way seven rows are usable at eleven screen pixels.
   *
   * A BLANK VALUE STILL DRAWS ITS LABEL, and the row still occupies its line.
   * That is InfoReadout's rule arriving intact at the glass — "a blank line holds
   * its place", because a row that vanishes makes every row below it jump up the
   * screen and a pilot glancing at a moving readout misreads it.
   *
   * @param {string} label the row's name
   * @param {string} value the row's value; may be blank
   * @param {number} y the shared BASELINE
   * @param {{invert?:boolean}} [opts]
   * @returns {{label:object|null, value:object|null}} the two ink boxes
   */
  row(label, value, y, opts = {}) {
    const invert = !!opts.invert;
    const pad = this.type.pad;
    return {
      label: this.text(label, pad, y, { size: this.type.label, align: 'left', invert }),
      value: this.text(value, this.width - pad, y, { size: this.type.body, align: 'right', invert }),
    };
  }

  /**
   * A horizontal separator, inset to the margins.
   *
   * fillRect and not a stroked path, deliberately. A canvas stroke is CENTRED on
   * the path, so a 1-pixel line at an integer y straddles two pixel rows and the
   * rasteriser renders it as two rows at half intensity — a grey smear. Grey is
   * not one of our colours, and at this angular size a smeared rule reads as a
   * dirty screen rather than as a line. A filled rectangle lands on exact pixel
   * boundaries and stays one ink.
   *
   * @param {number} y top edge of the rule
   */
  rule(y) {
    const pad = this.type.pad;
    this._ink();
    this.ctx.fillRect(pad, y, this.width - pad * 2, this.hair);
  }

  /**
   * A bar: an ink frame, a fill inside it, optional ticks and an optional pin.
   *
   * ── TWO FRACTION DOMAINS, AND THEY ARE NOT THE SAME ──
   *
   *   unipolar (default) — `frac` runs 0..1 and fills from the left edge. This is
   *     SpeedFormat.speedToBarFrac's output: a clamped log-scale supercruise
   *     fraction.
   *   bipolar — `frac` runs -1..+1 and fills from the CENTRE outward, left for
   *     negative. This is SpeedFormat.sublightBarFrac's output, which is signed
   *     precisely so a reversing ship reads as reverse.
   *
   * `ticks` and `pin` are read in WHICHEVER domain the bar is in. That mismatch
   * is not hypothetical and this kit cannot detect it: it is handed a number and
   * has no way to know which rule produced it. FlightReadout used to compute
   * `commandedFrac` with `speedToBarFrac` unconditionally, so a reversing
   * sublight ship handed an unsigned log fraction to a signed linear bar and the
   * pin sat at DEAD CENTRE — reading "full stop" — while the fill said half
   * astern. It is fixed in the caller, which is the only place it can be fixed;
   * see FlightReadout's header, divergence 2. src/ui/SupercruiseHud.js, the
   * full-screen overlay, still has it.
   *
   * A NON-FINITE `frac` DRAWS THE FRAME AND NO FILL. An empty bar reads as "no
   * reading", which is the truth. The alternatives are both lies: clamping NaN to
   * 0 claims the ship is stopped, and skipping the frame too claims there is no
   * such instrument.
   *
   * ── WHY TICKS HANG BELOW AND THE PIN SITS ABOVE ──
   *
   * This is the one-ink constraint biting hardest. A tick drawn INSIDE the bar
   * disappears the instant the fill reaches it — same ink, no edge — and the
   * drop-ceiling tick is the exact mark the pilot needs to watch the fill
   * approach. So the marks live outside the frame where the background is always
   * black: ticks below, pin above. Two channels, unambiguous, no second colour.
   *
   * @param {number} x left edge
   * @param {number} y top edge
   * @param {number} w width
   * @param {number} h height
   * @param {number} frac fill fraction, domain per `opts.bipolar`
   * @param {{bipolar?:boolean, ticks?:Array<{frac:number}>, pin?:number}} [opts]
   */
  bar(x, y, w, h, frac, opts = {}) {
    const bipolar = !!opts.bipolar;
    const c = this.ctx;
    const hair = this.hair;
    const inset = hair * 2;

    // The frame. Four fills rather than a stroked rectangle, for the same
    // half-pixel reason `rule` gives.
    this._ink();
    c.fillRect(x, y, w, hair);                    // top
    c.fillRect(x, y + h - hair, w, hair);         // bottom
    c.fillRect(x, y, hair, h);                    // left
    c.fillRect(x + w - hair, y, hair, h);         // right

    const fillY = y + inset;
    const fillH = Math.max(0, h - inset * 2);

    if (Number.isFinite(frac)) {
      if (bipolar) {
        const centreX = x + w / 2;
        const end = this._fracToX(frac, x, w, true);
        const from = Math.min(centreX, end);
        const span = Math.abs(end - centreX);
        if (span > 0) c.fillRect(from, fillY, span, fillH);
        // The zero mark. Without it a bipolar bar at rest is visually identical
        // to a bipolar bar with no reading at all, and "stopped" and "no data"
        // are very different things to tell a pilot.
        // ⛔ FULL INNER HEIGHT, NOT `fillH`, AND THE REASON IS AN INVARIANT RATHER THAN TASTE.
        // `decodePixelText` tells glyph texels from bar furniture by one rule, stated in its own
        // header: "a glyph texel is always a SQUARE of the scale. Bars, frames, ticks and pins are
        // not." At `fillH` this mark broke that rule the moment a bar became a body-tall grid slot
        // — `fillH = h - 4*hair`, so a `5*hair` bar gives a mark exactly `hair` by `hair`, and the
        // decoder read the throttle's zero mark as a character and returned tofu in the middle of
        // the panel's text. Spanning the inner height is both non-square and the better mark: at
        // 240p it is three texels of centre tick instead of one.
        c.fillRect(centreX - hair / 2, y + hair, hair, Math.max(hair, h - hair * 2));
      } else {
        const span = clamp(frac, 0, 1) * (w - inset * 2);
        if (span > 0) c.fillRect(x + inset, fillY, span, fillH);
      }
    }

    const markLen = hair * 2;
    const ticks = Array.isArray(opts.ticks) ? opts.ticks : [];
    for (const t of ticks) {
      // A tick with no usable fraction is skipped, not drawn at zero. A tick at
      // the empty end of the scale reads as a real limit of zero.
      if (!t || !Number.isFinite(t.frac)) continue;
      const tx = this._fracToX(t.frac, x, w, bipolar);
      c.fillRect(tx - hair / 2, y + h, hair, markLen);      // below
    }

    if (Number.isFinite(opts.pin)) {
      const px = this._fracToX(opts.pin, x, w, bipolar);
      c.fillRect(px - hair / 2, y - markLen, hair, markLen); // above
    }
  }

  /**
   * Fraction to an x inside the bar's inner track. The insets keep a full-scale
   * marker off the frame itself, where it would merge with it.
   * @private
   */
  _fracToX(frac, x, w, bipolar) {
    const inset = this.hair * 2;
    if (bipolar) return x + w / 2 + clamp(frac, -1, 1) * (w / 2 - inset);
    return x + inset + clamp(frac, 0, 1) * (w - inset * 2);
  }

  /**
   * A full-width inverted line: the alert form.
   *
   * Full width — edge to edge, ignoring the margins — because the point of a
   * banner is that it is not one of the rows. At the panel's real angular size an
   * inverted block spanning the whole glass is recognisable before any of its
   * letters are, which is the entire job of an alert on a screen you glance at.
   *
   * The kit does NOT blink it. Whether this frame is a lit one is `blinkOn`'s
   * answer, asked by the panel, which then either calls this or does not. Keeping
   * the clock out of the drawing call is what lets the cadence be tested with
   * numbers and lets every panel blink in step.
   *
   * @param {string} str the warning
   * @param {number} y the BASELINE
   * @param {{size?:number}} [opts]
   * @returns {{x:number, y:number, w:number, h:number}|null}
   */
  banner(str, y, opts = {}) {
    const s = String(str ?? '');
    if (!s) return null;                 // never paint a bare block; see `text`

    const size = opts.size ?? this.type.body;
    this._checkSize(size, 'banner');
    const top = Math.round(y) - size;
    const h = size;

    // MEASURE BEFORE PAINTING, and the order is the point. Measuring afterwards
    // reads better but leaves a failure mode: `_measure` throws on a non-finite
    // width, and by then the ink block is already on the glass. The pilot gets a
    // bare inverted band with no words in it — which is exactly the thing `text`
    // refuses to draw for an empty string, arriving by a different door. Nothing
    // is painted until everything needed to finish the banner is in hand.
    const w = this._measure(s, size);

    this._ink();
    this.ctx.fillRect(0, top, this.width, h);
    drawPixelText(this.ctx, s, Math.round((this.width - w) / 2), top, {
      color: PHOSPHOR.BACK, scale: this._scaleFor(size), onMissing: 'tofu',
    });

    return { x: 0, y: top, w: this.width, h };
  }
}
