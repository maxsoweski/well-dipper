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

/**
 * ── ⭐ THE FACE IS 5x5, AND THE 3x5 IT REPLACED WAS MEASURABLY UNREADABLE ──────────────────────
 *
 * Max, 2026-09-07: *"this font is no longer a good fit for this resolution"* and *"all in-game,
 * meaning the hud and the font on the nav screen/panels; all should be consistent"*.
 *
 * ⛔ THE DEFECT WAS CELL WIDTH, NOT RESOLUTION, which is why it read wrong the moment it was seen
 * in situ rather than in a spec. Three columns cannot hold the letters that are distinguished by
 * their MIDDLE. Counting glyph pairs that differ by two lit pixels or fewer — the metric is in
 * `tests/pixel-text.test.js` and it gates this file now:
 *
 *     3x5 (the old face)   12 confusable pairs.  M/N differed by ONE pixel of fifteen, and so did
 *                          M/H, N/W, W/H, H/K, U/V and K/X. "MODE: MANUAL" was a row of blobs.
 *     5x5 (this face)      ONE pair — D/O, near-identical in every typeface ever cut. ⛔ My FIRST
 *                          5x5 draft scored ten, losing S/5, 6/8 and 8/9, and I reported the size
 *                          as disqualified on that basis. Wrong: redrawing six glyphs fixed it. A
 *                          measurement of my draft was not a measurement of the cell.
 *     5x7                  Also one pair on the same population, at 40% more height. Kept as the
 *                          A/B alternative; Max asked for "about 30% smaller" than it.
 *
 * ⚠ ROWS ARE THE SCARCE RESOURCE AND THAT IS WHY 5x5 WINS. The cockpit panel is 42.84 rows total
 * (`panelPose.js:34-49`): a 5-row line fits about eight lines there, a 7-row line about five. Since
 * both faces score the same on the legibility gate, the shorter one is strictly better — it buys
 * batch 2 three more lines per panel for nothing.
 *
 * ⛔ THE FACES ARE SWITCHABLE ONLY SO THEY CAN BE COMPARED IN THE RUNNING GAME. 5x5 is the shipped
 * face; 5x7 is the taller alternative and 3x5 is kept as the reference the gate proves FAILS. Do not add a third without running the
 * confusability gate on it, and do not let a consumer pick a face per-surface — Max's ruling is that
 * the HUD, the reticle and the cockpit panels are ONE face.
 */

/** The live face. ⭐ A SHARED MUTABLE OBJECT, never copied — same argument as `RENDER_BUFFER` and
 * `pixelScaleUniform`: consumers are constructed once at boot, so a build-time read of `w`/`h`
 * would strand them on whichever face was active when they mounted. */
export const FACE = { name: '', w: 0, h: 0, advance: 0 };

const FACES = Object.freeze({
  /**
   * ⭐ THE SHIPPED FACE. Five columns is the width at which a letter can be distinguished by its
   * MIDDLE rather than only by its outline; five rows is as short as that can be carried.
   *
   * ⛔ AND MY FIRST 5x5 DRAFT WAS THE REASON I WRONGLY CALLED THIS SIZE IMPOSSIBLE. I measured a
   * hastily-cut 5x5 at ten confusable pairs — S/5, 6/8 and 8/9 among them — and reported the CELL
   * as a false economy. It was the CUTTING that was false. Max asked for "about 30% smaller"
   * anyway, and a careful redraw of six glyphs (F, M, N, P, 5, 6, 9) brings it to ONE pair, which
   * is exactly what the 5x7 scores. Same legibility, 29% less height.
   * ⚠ The lesson is the session's fourth of its shape: a measurement of MY draft is not a
   * measurement of the design space.
   */
  '5x5': Object.freeze({
    w: 5, h: 5, advance: 6, glyphs: Object.freeze({
  A: [0b01110, 0b10001, 0b11111, 0b10001, 0b10001],
  B: [0b11110, 0b10001, 0b11110, 0b10001, 0b11110],
  C: [0b01111, 0b10000, 0b10000, 0b10000, 0b01111],
  D: [0b11110, 0b10001, 0b10001, 0b10001, 0b11110],
  E: [0b11111, 0b10000, 0b11110, 0b10000, 0b11111],
  F: [0b11111, 0b10000, 0b11110, 0b10000, 0b10000],
  G: [0b01111, 0b10000, 0b10011, 0b10001, 0b01111],
  H: [0b10001, 0b10001, 0b11111, 0b10001, 0b10001],
  I: [0b11111, 0b00100, 0b00100, 0b00100, 0b11111],
  J: [0b00111, 0b00010, 0b00010, 0b10010, 0b01100],
  K: [0b10001, 0b10010, 0b11100, 0b10010, 0b10001],
  L: [0b10000, 0b10000, 0b10000, 0b10000, 0b11111],
  M: [0b10001, 0b11011, 0b10101, 0b10001, 0b10001],
  N: [0b11001, 0b10101, 0b10101, 0b10011, 0b10001],
  O: [0b01110, 0b10001, 0b10001, 0b10001, 0b01110],
  P: [0b11110, 0b10001, 0b10001, 0b11110, 0b10000],
  Q: [0b01110, 0b10001, 0b10101, 0b10010, 0b01101],
  R: [0b11110, 0b10001, 0b11110, 0b10010, 0b10001],
  S: [0b01111, 0b10000, 0b01110, 0b00001, 0b11110],
  T: [0b11111, 0b00100, 0b00100, 0b00100, 0b00100],
  U: [0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
  V: [0b10001, 0b10001, 0b10001, 0b01010, 0b00100],
  W: [0b10001, 0b10001, 0b10101, 0b10101, 0b01010],
  X: [0b10001, 0b01010, 0b00100, 0b01010, 0b10001],
  Y: [0b10001, 0b01010, 0b00100, 0b00100, 0b00100],
  Z: [0b11111, 0b00010, 0b00100, 0b01000, 0b11111],
  0: [0b01110, 0b10011, 0b10101, 0b11001, 0b01110],
  1: [0b00100, 0b01100, 0b00100, 0b00100, 0b01110],
  2: [0b11110, 0b00001, 0b01110, 0b10000, 0b11111],
  3: [0b11110, 0b00001, 0b01110, 0b00001, 0b11110],
  4: [0b10010, 0b10010, 0b11111, 0b00010, 0b00010],
  5: [0b11111, 0b10000, 0b11100, 0b00010, 0b11100],
  6: [0b00110, 0b01000, 0b11110, 0b10001, 0b01110],
  7: [0b11111, 0b00010, 0b00100, 0b01000, 0b01000],
  8: [0b01110, 0b10001, 0b01110, 0b10001, 0b01110],
  9: [0b01110, 0b10001, 0b01111, 0b00010, 0b01100],
  ' ': [0b00000, 0b00000, 0b00000, 0b00000, 0b00000],
  '.': [0b00000, 0b00000, 0b00000, 0b00000, 0b00100],
  ',': [0b00000, 0b00000, 0b00000, 0b00100, 0b01000],
  ':': [0b00000, 0b00100, 0b00000, 0b00100, 0b00000],
  '-': [0b00000, 0b00000, 0b01110, 0b00000, 0b00000],
  '\u2014': [0b00000, 0b00000, 0b11111, 0b00000, 0b00000],
  '/': [0b00001, 0b00010, 0b00100, 0b01000, 0b10000],
  '%': [0b11001, 0b11010, 0b00100, 0b01011, 0b10011],
  '+': [0b00000, 0b00100, 0b01110, 0b00100, 0b00000],
  '_': [0b00000, 0b00000, 0b00000, 0b00000, 0b11111],
  '<': [0b00010, 0b00100, 0b01000, 0b00100, 0b00010],
  '>': [0b01000, 0b00100, 0b00010, 0b00100, 0b01000],
  // ── ⭐ ADDED FOR THE COCKPIT AND NAV PANELS (batch 2 step 1) ──────────────────────────────
  // ⚠ SOURCED BY SCANNING THE DRAWN LITERALS, not guessed and not taken from the batch plan,
  // whose list named five characters no cockpit source emits and missed five that do.
  // `drawPixelText` defaults to onMissing:'throw' and NavPanel CLEARS the screen before drawing,
  // so an unmapped codepoint here is a BLACK PANEL, not a missing character.
  '!': [0b00100, 0b00100, 0b00100, 0b00000, 0b00100],
  "'": [0b00100, 0b00100, 0b00000, 0b00000, 0b00000],
  '(': [0b00010, 0b00100, 0b00100, 0b00100, 0b00010],
  ')': [0b01000, 0b00100, 0b00100, 0b00100, 0b01000],
  '*': [0b00100, 0b10101, 0b01110, 0b10101, 0b00100],
  '=': [0b00000, 0b11111, 0b00000, 0b11111, 0b00000],
  '?': [0b01110, 0b10001, 0b00110, 0b00000, 0b00100],
  '[': [0b01110, 0b01000, 0b01000, 0b01000, 0b01110],
  ']': [0b01110, 0b00010, 0b00010, 0b00010, 0b01110],
  '`': [0b01000, 0b00100, 0b00000, 0b00000, 0b00000],
  '|': [0b00100, 0b00100, 0b00100, 0b00100, 0b00100],
  '\u00b0': [0b01110, 0b01010, 0b01110, 0b00000, 0b00000],
  '\u00b7': [0b00000, 0b00000, 0b00100, 0b00000, 0b00000],
  '\u2295': [0b01110, 0b10101, 0b11111, 0b10101, 0b01110],
    }),
  }),
  /**
   * The taller cut, kept as the A/B alternative. Seven rows give G, R, S and the digits roomier
   * counters, at 40% more height — which is a real cost on a 42.84-row cockpit panel.
   * Uppercase only, by design — every 5th-gen HUD this is imitating was.
   */
  '5x7': Object.freeze({
    w: 5, h: 7, advance: 6, glyphs: Object.freeze({
  A: [0b01110, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001],
  B: [0b11110, 0b10001, 0b10001, 0b11110, 0b10001, 0b10001, 0b11110],
  C: [0b01110, 0b10001, 0b10000, 0b10000, 0b10000, 0b10001, 0b01110],
  D: [0b11110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b11110],
  E: [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b11111],
  F: [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b10000],
  G: [0b01110, 0b10001, 0b10000, 0b10111, 0b10001, 0b10001, 0b01111],
  H: [0b10001, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001],
  I: [0b01110, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110],
  J: [0b00111, 0b00010, 0b00010, 0b00010, 0b00010, 0b10010, 0b01100],
  K: [0b10001, 0b10010, 0b10100, 0b11000, 0b10100, 0b10010, 0b10001],
  L: [0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b11111],
  M: [0b10001, 0b11011, 0b10101, 0b10101, 0b10001, 0b10001, 0b10001],
  N: [0b10001, 0b11001, 0b11001, 0b10101, 0b10011, 0b10011, 0b10001],
  O: [0b01110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
  P: [0b11110, 0b10001, 0b10001, 0b11110, 0b10000, 0b10000, 0b10000],
  Q: [0b01110, 0b10001, 0b10001, 0b10001, 0b10101, 0b10010, 0b01101],
  R: [0b11110, 0b10001, 0b10001, 0b11110, 0b10100, 0b10010, 0b10001],
  S: [0b01111, 0b10000, 0b10000, 0b01110, 0b00001, 0b00001, 0b11110],
  T: [0b11111, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100],
  U: [0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
  V: [0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01010, 0b00100],
  W: [0b10001, 0b10001, 0b10001, 0b10101, 0b10101, 0b10101, 0b01010],
  X: [0b10001, 0b10001, 0b01010, 0b00100, 0b01010, 0b10001, 0b10001],
  Y: [0b10001, 0b10001, 0b01010, 0b00100, 0b00100, 0b00100, 0b00100],
  Z: [0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b10000, 0b11111],
  0: [0b01110, 0b10001, 0b10011, 0b10101, 0b11001, 0b10001, 0b01110],
  1: [0b00100, 0b01100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110],
  2: [0b01110, 0b10001, 0b00001, 0b00010, 0b00100, 0b01000, 0b11111],
  3: [0b11111, 0b00010, 0b00100, 0b00010, 0b00001, 0b10001, 0b01110],
  4: [0b00010, 0b00110, 0b01010, 0b10010, 0b11111, 0b00010, 0b00010],
  5: [0b11111, 0b10000, 0b11110, 0b00001, 0b00001, 0b10001, 0b01110],
  6: [0b00110, 0b01000, 0b10000, 0b11110, 0b10001, 0b10001, 0b01110],
  7: [0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b01000, 0b01000],
  8: [0b01110, 0b10001, 0b10001, 0b01110, 0b10001, 0b10001, 0b01110],
  9: [0b01110, 0b10001, 0b10001, 0b01111, 0b00001, 0b00010, 0b01100],
  ' ': [0b00000, 0b00000, 0b00000, 0b00000, 0b00000, 0b00000, 0b00000],
  '.': [0b00000, 0b00000, 0b00000, 0b00000, 0b00000, 0b00000, 0b00100],
  ',': [0b00000, 0b00000, 0b00000, 0b00000, 0b00000, 0b00100, 0b01000],
  ':': [0b00000, 0b00000, 0b00100, 0b00000, 0b00100, 0b00000, 0b00000],
  '-': [0b00000, 0b00000, 0b00000, 0b01110, 0b00000, 0b00000, 0b00000],
  '\u2014': [0b00000, 0b00000, 0b00000, 0b11111, 0b00000, 0b00000, 0b00000],
  '/': [0b00001, 0b00001, 0b00010, 0b00100, 0b01000, 0b10000, 0b10000],
  '%': [0b11001, 0b11010, 0b00010, 0b00100, 0b01000, 0b01011, 0b10011],
  '+': [0b00000, 0b00100, 0b00100, 0b11111, 0b00100, 0b00100, 0b00000],
  '_': [0b00000, 0b00000, 0b00000, 0b00000, 0b00000, 0b00000, 0b11111],
  '<': [0b00010, 0b00100, 0b01000, 0b10000, 0b01000, 0b00100, 0b00010],
  '>': [0b01000, 0b00100, 0b00010, 0b00001, 0b00010, 0b00100, 0b01000],
  // ── ⭐ ADDED FOR THE COCKPIT AND NAV PANELS (batch 2 step 1) ──────────────────────────────
  // ⚠ SOURCED BY SCANNING THE DRAWN LITERALS, not guessed and not taken from the batch plan,
  // whose list named five characters no cockpit source emits and missed five that do.
  // `drawPixelText` defaults to onMissing:'throw' and NavPanel CLEARS the screen before drawing,
  // so an unmapped codepoint here is a BLACK PANEL, not a missing character.
  '!': [0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b00000, 0b00100],
  "'": [0b00100, 0b00100, 0b00100, 0b00000, 0b00000, 0b00000, 0b00000],
  '(': [0b00010, 0b00100, 0b01000, 0b01000, 0b01000, 0b00100, 0b00010],
  ')': [0b01000, 0b00100, 0b00010, 0b00010, 0b00010, 0b00100, 0b01000],
  '*': [0b00000, 0b00100, 0b10101, 0b01110, 0b10101, 0b00100, 0b00000],
  '=': [0b00000, 0b00000, 0b11111, 0b00000, 0b11111, 0b00000, 0b00000],
  '?': [0b01110, 0b10001, 0b00001, 0b00010, 0b00100, 0b00000, 0b00100],
  '[': [0b01110, 0b01000, 0b01000, 0b01000, 0b01000, 0b01000, 0b01110],
  ']': [0b01110, 0b00010, 0b00010, 0b00010, 0b00010, 0b00010, 0b01110],
  '`': [0b01000, 0b00100, 0b00000, 0b00000, 0b00000, 0b00000, 0b00000],
  '|': [0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100],
  '\u00b0': [0b01110, 0b01010, 0b01110, 0b00000, 0b00000, 0b00000, 0b00000],
  '\u00b7': [0b00000, 0b00000, 0b00000, 0b00100, 0b00000, 0b00000, 0b00000],
  '\u2295': [0b00000, 0b01110, 0b10101, 0b11111, 0b10101, 0b01110, 0b00000],
    }),
  }),
});

let _active = null;

/** @returns {string[]} the faces that exist, for an A/B */
export function pixelFaceNames() { return Object.keys(FACES); }

/**
 * Swap the face for the WHOLE GAME. There is no per-surface face and there must not be: two faces
 * that drift apart is how a game stops looking like one game.
 * @param {string} name @returns {typeof FACE}
 */
export function setPixelFace(name) {
  const f = FACES[name];
  if (!f) throw new Error(`PixelText: no face ${JSON.stringify(name)}; have ${Object.keys(FACES).join(', ')}`);
  _active = f;
  FACE.name = name; FACE.w = f.w; FACE.h = f.h; FACE.advance = f.advance;
  return FACE;
}

setPixelFace('5x5');

/**
 * The tofu box: a hollow cell, what a real font stack draws for an unmapped codepoint.
 * Built from the ACTIVE face's cell so it is the right size in either face, rather than a frozen
 * table that would be the wrong shape the moment the face changed.
 */
function tofu() {
  const full = (1 << _active.w) - 1;               // ##### — a solid row
  const posts = (1 << (_active.w - 1)) | 1;        // #...# — the two side walls
  const rows = new Array(_active.h);
  for (let r = 0; r < _active.h; r++) rows[r] = (r === 0 || r === _active.h - 1) ? full : posts;
  return rows;
}

/** @param {string} str @param {number} [scale] @returns {number} width in texels, no trailing gap */
export function measurePixelText(str, scale = 1) {
  const n = String(str).length;
  return n === 0 ? 0 : n * _active.advance * scale - scale;
}

/** @returns {number} cap height in texels */
export function pixelTextHeight(scale = 1) { return _active.h * scale; }

/** @param {string} ch @returns {boolean} whether the face can render it */
export function hasGlyph(ch) {
  return Object.prototype.hasOwnProperty.call(_active.glyphs, String(ch).toUpperCase());
}

/**
 * Draw a string as hard texels.
 *
 * ⚠ `fillRect` ONLY, AND INTEGER COORDINATES ONLY. A `stroke()` of width 1 at an integer coordinate
 * straddles it and lands as two half-covered rows — on a buffer magnified ~4.3x that is a nine-
 * screen-pixel grey smear where one crisp texel was intended. There is no stroke path here on purpose.
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
  const { w: GW, h: GH, advance: ADV, glyphs } = _active;
  let px = Math.round(align === 'center' ? x - w / 2 : align === 'right' ? x - w : x);
  const py = Math.round(y);
  const prev = ctx.fillStyle;
  ctx.fillStyle = color;
  for (const raw of s) {
    const ch = raw.toUpperCase();
    let rows = glyphs[ch];
    if (!rows) {
      if (onMissing === 'throw') {
        ctx.fillStyle = prev;
        throw new Error(`PixelText: no glyph for ${JSON.stringify(raw)} (U+${raw.codePointAt(0).toString(16).toUpperCase()}) in ${JSON.stringify(s)}`);
      }
      if (onMissing === 'skip') { px += ADV * scale; continue; }
      rows = tofu();
    }
    for (let r = 0; r < GH; r++) {
      const mask = rows[r];
      if (!mask) continue;
      for (let c = 0; c < GW; c++) {
        if (mask & (1 << (GW - 1 - c))) {
          ctx.fillRect(px + c * scale, py + r * scale, scale, scale);
        }
      }
    }
    px += ADV * scale;
  }
  ctx.fillStyle = prev;
  return w;
}

// ── ⛔ TEMPORARY INSTRUMENT — DELETE ONCE MAX HAS PICKED A FACE ────────────────────────────────
// `;` cycles the face in the running game. It lives HERE, not in main.js, for one reason: ~700
// line-anchored citations ride main.js and a new keydown handler there would be an INSERTION that
// shifts every one of them. Max does not use the browser console, so an A/B he can actually run has
// to be a key. Guarded because this module is imported by tests that have no window.
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('keydown', (e) => {
    if (e.key !== ';' || e.ctrlKey || e.metaKey || e.altKey) return;
    const names = pixelFaceNames();
    const next = names[(names.indexOf(FACE.name) + 1) % names.length];
    setPixelFace(next);
    console.log(`[PIXEL-FACE] ${next} (${FACE.w}x${FACE.h})`);
  });
}

/**
 * Read strings back OUT of recorded `fillRect` calls.
 *
 * ⭐ WHY THIS EXISTS. Every test in this repo that asks "what did the panel say?" did it by
 * recording `ctx.fillText` and reading its first argument. Bitmap text reaches the context as
 * anonymous texels, so that question became unanswerable the moment the cockpit moved onto the
 * world's pixel grid — and the tempting replacement is a class SELF-REPORT ("the painter says it
 * drew X"), which is exactly what this lane refuses elsewhere, because a self-report agrees with
 * the code rather than checking it.
 *
 * Decoding restores the original standard and raises it: the assertion now depends on the actual
 * texels landing in the actual positions, so a face whose draw path dropped a row, or a caller
 * that scaled text off the grid, fails where a `fillText` string argument would still have read
 * perfectly. It answers "what is ON THE GLASS", never "what did the code intend".
 *
 * ⚠ IT DECODES AGAINST THE ACTIVE FACE. Switch faces and re-run; do not cache the result.
 *
 * @param {Array<{x:number,y:number,w:number,h:number}>} rects every fillRect the context saw
 * @returns {Array<{text:string, x:number, y:number, scale:number}>} runs, in reading order
 */
export function decodePixelText(rects) {
  const { w: GW, h: GH, advance: ADV, glyphs } = _active;
  const byKey = new Map();
  for (const ch of Object.keys(glyphs)) byKey.set(glyphs[ch].join(','), ch);

  // A glyph texel is always a SQUARE of the scale. Bars, frames, ticks and pins are not, which is
  // what keeps panel furniture out of the decode.
  const square = (rects || []).filter((r) => r && r.w === r.h && r.w > 0
    && Number.isInteger(r.x) && Number.isInteger(r.y));
  const out = [];

  for (const s of [...new Set(square.map((r) => r.w))].sort((a, b) => a - b)) {
    const pool = square.filter((r) => r.w === s);
    const at = new Set(pool.map((r) => `${r.x},${r.y}`));
    const claimed = new Set();

    for (const y0 of [...new Set(pool.map((r) => r.y))].sort((a, b) => a - b)) {
      if (claimed.has(y0)) continue;
      // A band is the GH rows starting at y0, on the scale's own row pitch.
      const band = pool.filter((r) => r.y >= y0 && r.y < y0 + GH * s && (r.y - y0) % s === 0);
      if (!band.length) continue;

      // ⭐ SPLIT THE BAND INTO RUNS BEFORE DECODING, AND RE-ANCHOR THE CELL GRID ON EACH.
      // A label hard-left and its value hard-right share one baseline, and the value's glyphs are
      // NOT on the label's 6-texel cell lattice — decoding the whole band on one origin turned
      // "ERIS" into five replacement characters. The gap threshold is two full cells: one space
      // inside a word is at most `2*ADV - (GW-1)` texels of clear air, two spaces are strictly
      // more, so words survive and columns separate.
      const columns = [...new Set(band.map((r) => r.x))].sort((a2, b2) => a2 - b2);
      const runs = [];
      for (const x of columns) {
        const last = runs[runs.length - 1];
        if (last && x - last[last.length - 1] <= 2 * ADV * s) last.push(x);
        else runs.push([x]);
      }

      let bandHadText = false;
      for (const run of runs) {
        const x0 = run[0];
        const cells = Math.floor((run[run.length - 1] - x0) / (ADV * s)) + 1;
        let text = '';
        for (let c = 0; c < cells; c++) {
          const cx = x0 + c * ADV * s;
          const rows = [];
          for (let r = 0; r < GH; r++) {
            let mask = 0;
            for (let col = 0; col < GW; col++) {
              if (at.has(`${cx + col * s},${y0 + r * s}`)) mask |= 1 << (GW - 1 - col);
            }
            rows.push(mask);
          }
          const key = rows.join(',');
          text += byKey.has(key) ? byKey.get(key) : (rows.some(Boolean) ? '\uFFFD' : ' ');
        }
        // ⛔ A RUN OF PURE FURNITURE IS NOT A STRING. If nothing matched a glyph, these were
        // square fills that happened to line up — report nothing rather than a row of U+FFFD.
        if (!/[^\s\uFFFD]/.test(text)) continue;
        bandHadText = true;
        out.push({ text: text.trimEnd(), x: x0, y: y0, scale: s });
      }
      if (bandHadText) for (let r = 0; r < GH; r++) claimed.add(y0 + r * s);
    }
  }
  return out.sort((a, b) => (a.y - b.y) || (a.x - b.x));
}
