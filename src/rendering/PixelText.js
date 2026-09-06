/**
 * PixelText — THE bitmap face for everything the game draws into a low-resolution buffer.
 *
 * Max, 2026-09-06: *"I want the whole game to read as a 5th gen game ... so we simply need to
 * redesign anything that does not read properly at this new resolution."*
 *
 * ── WHY A BITMAP FACE AT ALL ────────────────────────────────────────────────────────────────────
 *
 * A vector glyph is described by outlines and rasterised with antialiasing, which spends its detail
 * on fractional coverage at the edges. That is exactly the wrong currency on a 240-line buffer that
 * is then magnified ~4.7x with NearestFilter: the fractional coverage becomes big flat grey blocks
 * and the letter loses its shape. A bitmap face spends nothing on edges — every texel is on or off,
 * authored at the size it is drawn — which is why the machines this game is imitating used them.
 *
 * ⚠ THE THING THAT MAKES THIS NECESSARY IS NOT SIZE, IT IS ROWS. Measured on the cockpit: a label
 * glyph is **2.14** buffer px tall, which magnifies to about 10 SCREEN px — very close to what it is
 * today. Its physical size is fine. What it does not have is enough pixel ROWS to be a letter, and
 * no amount of magnification adds rows. Five is the floor; this face is 5 tall.
 * ⛔ 2.14, NOT THE 2.4 THIS COMMENT FIRST SAID. The panel's row count is the PIXEL fraction
 * `(0.10/0.800)/tan(35 deg) x 240` = 42.84, not the ANGULAR fraction `14.25/70 x 240` = 48.9 — a
 * perspective projection is linear in tan, not in angle, and `panelPose.js:34-49` already warns
 * about exactly this under "PIXEL FRACTION, NOT ANGULAR FRACTION". Every panel figure derives from
 * 42.84.
 *
 * ── ⛔ EXACTLY ONE GLYPH SET IN THIS REPO ───────────────────────────────────────────────────────
 *
 * The HUD, the targeting reticle and the cockpit panels all need this, at different sizes and in
 * different buffers. They must NOT each grow their own. If a surface needs a larger face, add a 5x7
 * set to THIS module beside the 3x5 one; do not start a second module, and do not inline a private
 * glyph table in a consumer. Two faces that drift apart is how a game stops looking like one game.
 *
 * ── THE MISSING-GLYPH POLICY IS NOT ONE POLICY ──────────────────────────────────────────────────
 *
 * ⭐ Deliberate, and it is the one place callers must choose. The HUD draws FIXED LITERALS, so a
 * character this face cannot render is an authoring bug and should be loud — `onMissing: 'throw'`.
 * The reticle draws PROCEDURALLY GENERATED BODY NAMES, where an unexpected codepoint must not take
 * the whole overlay down; it gets `onMissing: 'tofu'` and draws a filled box, the way a real font
 * stack does. Defaulting to 'throw' means a caller has to think about which it is.
 */

/** Glyph cell, in texels, before `scale`. */
export const GLYPH_W = 3;
export const GLYPH_H = 5;
/** Pen advance per character: the cell plus one blank column. */
export const ADVANCE = 4;

/**
 * 3x5 uppercase face. Each entry is five row masks, most-significant bit = leftmost column,
 * so 0b111 is a full row and 0b101 is two posts.
 *
 * ⚠ THE COVERAGE LIST IS LOAD-BEARING AND IS SOURCED, NOT GUESSED. It must include every character
 * the existing call sites can emit:
 *   - A-Z and 0-9 and space — the obvious set.
 *   - `.` `,` `:` `/` `-` `%` — units, ratios and separators in the readouts.
 *   - U+2014 EM DASH — `AlertCue`'s 'TOO CLOSE — SUBLIGHT ONLY' carries exactly one, and it is an
 *     em dash rather than a hyphen. Dropping it would silently mangle an alert the pilot flies with.
 *   - `,` specifically because speeds are thousands-separated before they reach the drawing code.
 *   - `_` because the cockpit panel kit names things like T_EQ, and renaming call sites to dodge a
 *     missing glyph is a worse fix than having the glyph.
 */
const GLYPHS = Object.freeze({
  ' ': [0b000, 0b000, 0b000, 0b000, 0b000],
  A: [0b010, 0b101, 0b111, 0b101, 0b101],
  B: [0b110, 0b101, 0b110, 0b101, 0b110],
  C: [0b011, 0b100, 0b100, 0b100, 0b011],
  D: [0b110, 0b101, 0b101, 0b101, 0b110],
  E: [0b111, 0b100, 0b110, 0b100, 0b111],
  F: [0b111, 0b100, 0b110, 0b100, 0b100],
  G: [0b011, 0b100, 0b101, 0b101, 0b011],
  H: [0b101, 0b101, 0b111, 0b101, 0b101],
  I: [0b111, 0b010, 0b010, 0b010, 0b111],
  J: [0b001, 0b001, 0b001, 0b101, 0b010],
  K: [0b101, 0b101, 0b110, 0b101, 0b101],
  L: [0b100, 0b100, 0b100, 0b100, 0b111],
  M: [0b101, 0b111, 0b111, 0b101, 0b101],
  N: [0b101, 0b111, 0b111, 0b111, 0b101],
  O: [0b010, 0b101, 0b101, 0b101, 0b010],
  P: [0b110, 0b101, 0b110, 0b100, 0b100],
  Q: [0b010, 0b101, 0b101, 0b111, 0b011],
  R: [0b110, 0b101, 0b110, 0b101, 0b101],
  S: [0b011, 0b100, 0b010, 0b001, 0b110],
  T: [0b111, 0b010, 0b010, 0b010, 0b010],
  U: [0b101, 0b101, 0b101, 0b101, 0b011],
  V: [0b101, 0b101, 0b101, 0b101, 0b010],
  W: [0b101, 0b101, 0b111, 0b111, 0b101],
  X: [0b101, 0b101, 0b010, 0b101, 0b101],
  Y: [0b101, 0b101, 0b010, 0b010, 0b010],
  Z: [0b111, 0b001, 0b010, 0b100, 0b111],
  0: [0b111, 0b101, 0b101, 0b101, 0b111],
  1: [0b010, 0b110, 0b010, 0b010, 0b111],
  2: [0b110, 0b001, 0b010, 0b100, 0b111],
  3: [0b110, 0b001, 0b010, 0b001, 0b110],
  4: [0b101, 0b101, 0b111, 0b001, 0b001],
  5: [0b111, 0b100, 0b110, 0b001, 0b110],
  6: [0b011, 0b100, 0b111, 0b101, 0b111],
  7: [0b111, 0b001, 0b010, 0b010, 0b010],
  8: [0b111, 0b101, 0b111, 0b101, 0b111],
  9: [0b111, 0b101, 0b111, 0b001, 0b110],
  '.': [0b000, 0b000, 0b000, 0b000, 0b010],
  ',': [0b000, 0b000, 0b000, 0b010, 0b100],
  ':': [0b000, 0b010, 0b000, 0b010, 0b000],
  '-': [0b000, 0b000, 0b111, 0b000, 0b000],
  '—': [0b000, 0b000, 0b111, 0b000, 0b000],   // EM DASH — AlertCue's alert carries one
  '/': [0b001, 0b001, 0b010, 0b100, 0b100],
  '%': [0b101, 0b001, 0b010, 0b100, 0b101],
  '+': [0b000, 0b010, 0b111, 0b010, 0b000],
  '_': [0b000, 0b000, 0b000, 0b000, 0b111],   // the cockpit kit has identifiers like T_EQ; adding the glyph beats a rename cascade
  '<': [0b001, 0b010, 0b100, 0b010, 0b001],
  '>': [0b100, 0b010, 0b001, 0b010, 0b100],
});

/** The tofu box: a filled cell, what a real font stack draws for an unmapped codepoint. */
const TOFU = [0b111, 0b101, 0b101, 0b101, 0b111];

/** @param {string} str @param {number} [scale] @returns {number} width in texels, no trailing gap */
export function measurePixelText(str, scale = 1) {
  const n = String(str).length;
  return n === 0 ? 0 : n * ADVANCE * scale - scale;
}

/** @returns {number} cap height in texels */
export function pixelTextHeight(scale = 1) { return GLYPH_H * scale; }

/** @param {string} ch @returns {boolean} whether the face can render it */
export function hasGlyph(ch) {
  return Object.prototype.hasOwnProperty.call(GLYPHS, String(ch).toUpperCase());
}

/**
 * Draw a string as hard texels.
 *
 * ⚠ `fillRect` ONLY, AND INTEGER COORDINATES ONLY. A `stroke()` of width 1 at an integer coordinate
 * straddles it and lands as two half-covered rows — on a buffer magnified 4.7x that is a nine-screen-
 * pixel grey smear where one crisp texel was intended. There is no stroke path here on purpose.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} str
 * @param {number} x left edge, in texels
 * @param {number} y TOP edge, in texels — not a baseline; a bitmap face has no descenders here
 * @param {{color?:string, scale?:number, align?:'left'|'center'|'right', onMissing?:'throw'|'tofu'|'skip'}} [opts]
 * @returns {number} the width drawn, in texels
 */
export function drawPixelText(ctx, str, x, y, opts = {}) {
  const { color = '#ffffff', scale = 1, align = 'left', onMissing = 'throw' } = opts;
  const s = String(str);
  const w = measurePixelText(s, scale);
  let px = Math.round(align === 'center' ? x - w / 2 : align === 'right' ? x - w : x);
  const py = Math.round(y);
  const prev = ctx.fillStyle;
  ctx.fillStyle = color;
  for (const raw of s) {
    const ch = raw.toUpperCase();
    let rows = GLYPHS[ch];
    if (!rows) {
      if (onMissing === 'throw') {
        ctx.fillStyle = prev;
        throw new Error(`PixelText: no glyph for ${JSON.stringify(raw)} (U+${raw.codePointAt(0).toString(16).toUpperCase()}) in ${JSON.stringify(s)}`);
      }
      if (onMissing === 'skip') { px += ADVANCE * scale; continue; }
      rows = TOFU;
    }
    for (let r = 0; r < GLYPH_H; r++) {
      const mask = rows[r];
      if (!mask) continue;
      for (let c = 0; c < GLYPH_W; c++) {
        if (mask & (1 << (GLYPH_W - 1 - c))) {
          ctx.fillRect(px + c * scale, py + r * scale, scale, scale);
        }
      }
    }
    px += ADVANCE * scale;
  }
  ctx.fillStyle = prev;
  return w;
}
