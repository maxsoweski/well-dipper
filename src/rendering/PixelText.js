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
 * ── ⭐ THE FACE IS 5x7, AND THE 3x5 IT REPLACED WAS MEASURABLY UNREADABLE ──────────────────────
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
 *     5x5                  10 pairs. Fixes the letters and then loses the DIGITS: S/5, 6/8 and 8/9
 *                          all land within two pixels. Disqualifying for a speed readout — it is a
 *                          false economy, and it is why the row budget below did not win.
 *     5x7 (this face)       2 pairs, and both are honest: D/O are near-identical in every typeface
 *                          ever cut, and `-` vs U+2014 are MEANT to differ only in length.
 *
 * ⚠ THE COST IS ROWS, AND IT LANDS ON BATCH 2, NOT HERE. A 7-row cap makes the HUD cluster ~38 of
 * 240 rows instead of 30 — fine. The cockpit panel is 42.84 rows total (`panelPose.js:34-49`), so a
 * 7-row line fits about FIVE lines where a 5-row line fit eight. That is a decision about what the
 * panels should SAY, and the answer is fewer, larger lines — not a face whose digits blur.
 *
 * ⛔ THE FACES ARE SWITCHABLE ONLY SO THEY CAN BE COMPARED IN THE RUNNING GAME. 5x7 is the shipped
 * face; 3x5 is kept purely as the A/B reference. Do not add a third without running the
 * confusability gate on it, and do not let a consumer pick a face per-surface — Max's ruling is that
 * the HUD, the reticle and the cockpit panels are ONE face.
 */

/** The live face. ⭐ A SHARED MUTABLE OBJECT, never copied — same argument as `RENDER_BUFFER` and
 * `pixelScaleUniform`: consumers are constructed once at boot, so a build-time read of `w`/`h`
 * would strand them on whichever face was active when they mounted. */
export const FACE = { name: '', w: 0, h: 0, advance: 0 };

const FACES = Object.freeze({
  /**
   * ⛔ KEPT ONLY AS THE A/B REFERENCE. This is the face Max rejected; see the table above for the
   * measurement. Do not route a surface at it.
   */
  '3x5': Object.freeze({
    w: 3, h: 5, advance: 4, glyphs: Object.freeze({
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
    }),
  }),
  /**
   * THE SHIPPED FACE. Five columns is the width at which a letter can be distinguished by its
   * middle rather than only by its outline, and seven rows is what lets G, R, S and the digits keep
   * their counters. Uppercase only, by design — every 5th-gen HUD this is imitating was.
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

setPixelFace('5x7');

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
