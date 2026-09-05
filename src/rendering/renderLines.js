/**
 * RENDER_LINES — the render resolution expressed as a LINE COUNT, which is how the era expressed it.
 *
 * Max, 2026-09-05: *"this internal resolution was not always the exact same dimensions depending on
 * the screen ratio ... I just want to make sure we're not using the resolution calculated for like a
 * 320 by 240 screen size and stretching that across a widescreen monitor."*
 *
 * ── THE ANSWER TO THE LITERAL QUESTION WAS ALREADY YES ──────────────────────────────────────────
 *
 * Nothing was ever stretched. `RetroRenderer.resize()` divided BOTH axes by the same scalar, so the
 * buffer always carried the window's aspect with square pixels, and there is no 320x240 or 4:3
 * constant anywhere in the render path. That part was fine before this file existed.
 *
 * ── BUT HIS INSTINCT WAS RIGHT ABOUT THE MECHANISM, ON THE OTHER AXIS ───────────────────────────
 *
 * NTSC gave the PlayStation, N64 and Saturn ~240 ACTIVE SCANLINES and that number was fixed. What
 * varied per game was the HORIZONTAL sample count — the PSX alone could output 256, 320, 384, 512 or
 * 640 across — so a 256x240 game on a 4:3 set had genuinely non-square pixels, stretched sideways by
 * the hardware. Widescreen on that generation was almost always ANAMORPHIC: the same framebuffer
 * squeezed at render time and pulled back out by a 16:9 set, not extra horizontal pixels.
 *
 * ⭐ SO THE ERA'S INVARIANT IS THE LINE COUNT, AND A DIVISOR DOES NOT HOLD IT. Under the old setting
 * the vertical resolution was window height / N, so it moved every time the window did: 252 lines on
 * Max's 1130-tall viewport, some other number maximised or on another monitor. The thing that was
 * actually fixed on real hardware was the one thing we let float.
 *
 * Pinning lines and deriving width from the aspect fixes three things at once:
 *   1. it is faithful on the axis that genuinely was fixed;
 *   2. the picture no longer changes resolution when the window resizes;
 *   3. the number means something. Max, 2026-09-06, on the divisor: *"There is no measurement that
 *      says 4.5 only ratios like 630x323."* "240p" is a real thing; "4.5" never was.
 *
 * ⛔ THIS IS THE FIX THE index.html COMMENT ASKED FOR BY NAME. The half-step slider shipped
 * 2026-09-06 with its own verdict attached: "THIS IS A WORKAROUND FOR THE DIVISOR, NOT A FIX FOR IT:
 * the reachable set still changes with window size, which is the argument for locking render height
 * outright". Max approved doing it properly on 2026-09-05.
 *
 * ⚠ WIDTH IS DERIVED, AND ON AN ULTRAWIDE IT GOES WIDER THAN ANY REAL CONSOLE. At 240p on Max's
 * ~1.95:1 viewport the buffer is about 468x240. No fifth-generation machine ever produced that, and
 * pretending otherwise would mean either pillarboxing him or stretching a 4:3 image — both worse. An
 * honest anamorphic-widescreen reading of the era bar is the right call for a modern display.
 */

/**
 * The offered line counts. Discrete and named rather than a range, because these are REAL MODES and
 * the values between them are not more era-accurate for being reachable.
 * ⭐ 240 and 288 are the NTSC and PAL active-line counts; 480 is the progressive mode the N64 (and
 * the PSX at 512x480 interlaced) could reach. 144/180 are below the era and offered because Max
 * judges this by eye and asked for range; 360/720 are above it for the same reason.
 */
export const RENDER_LINE_OPTIONS = [144, 180, 240, 288, 360, 480, 720];

/** ⭐ Max, 2026-09-06: "I do like the 240p the most I think." NTSC active lines. */
export const RENDER_LINES_DEFAULT = 240;

/** Sky default follows the world; he is actively tuning the relationship, not inheriting it. */
export const SKY_RENDER_LINES_DEFAULT = 240;

export const RENDER_LINES_MIN = RENDER_LINE_OPTIONS[0];
export const RENDER_LINES_MAX = RENDER_LINE_OPTIONS[RENDER_LINE_OPTIONS.length - 1];

/**
 * Snap to the nearest offered mode. A stored value from a future/edited settings blob, or a
 * migrated divisor that lands between modes, resolves to a real one rather than being rejected.
 * @param {number} lines @returns {number}
 */
export function clampRenderLines(lines) {
  const n = Number(lines);
  if (!Number.isFinite(n)) return RENDER_LINES_DEFAULT;
  return RENDER_LINE_OPTIONS.reduce((best, o) => (Math.abs(o - n) < Math.abs(best - n) ? o : best), RENDER_LINE_OPTIONS[0]);
}

/**
 * ⭐ THE MIGRATION, AND IT IS UNAMBIGUOUS BY MAGNITUDE. The old setting stored a DIVISOR bounded at
 * 8; a line count is never under 100. So a stored value <= 16 is legacy and converts by the identity
 * that defined it — lines = window height / divisor — then snaps to the nearest real mode.
 *
 * ⛔ MAX'S SETTINGS ARE READ, NEVER RESET. His stored 4.5 on a 1130-tall window is 251 lines, which
 * snaps to 240 — the mode he already said he prefers — so the migration lands him on the value he
 * was aiming at rather than moving his picture out from under him. The legacy keys are left in
 * storage untouched, so nothing is destroyed and the old behaviour is recoverable.
 *
 * @param {number|undefined} stored the value under the new key, if any
 * @param {number|undefined} legacyDivisor the value under the old `pixelScale`/`skyPixelScale` key
 * @param {number} windowHeight
 * @param {number} fallback
 * @returns {number}
 */
export function migrateToRenderLines(stored, legacyDivisor, windowHeight, fallback = RENDER_LINES_DEFAULT) {
  const s = Number(stored);
  if (Number.isFinite(s) && s > 16) return clampRenderLines(s);
  const d = Number(legacyDivisor);
  if (Number.isFinite(d) && d > 0 && d <= 16 && Number.isFinite(windowHeight) && windowHeight > 0) {
    return clampRenderLines(windowHeight / d);
  }
  return clampRenderLines(fallback);
}

/**
 * The buffer for a given window and line count: height IS the line count, width carries the aspect.
 *
 * ⚠ `Math.round`, not `Math.ceil`, on the width. Ceil biases every buffer one pixel wide, which on a
 * 468-wide target is a 0.2% aspect error introduced for no reason; round splits it. Height is exact
 * by construction — that is the entire point of the mode.
 * ⚠ `Math.max(1, ...)` because a 0-dimension render target is a silent black frame.
 *
 * @param {number} windowWidth @param {number} windowHeight @param {number} lines
 * @returns {{width:number, height:number, scale:number}} scale = the magnification the shaders need
 */
export function bufferForLines(windowWidth, windowHeight, lines) {
  const h = Math.max(1, Math.round(lines));
  const w = Math.max(1, Math.round(windowWidth * (h / Math.max(1, windowHeight))));
  // The magnification every dither cell and point size divides by. Derived here so the allocation
  // and the shaders cannot disagree — that disagreement is what produced the 13.5px checker.
  const scale = Math.max(1e-6, windowHeight / h);
  return { width: w, height: h, scale };
}

/** Label for the settings readout: "240p · 468×240". */
export function describeRenderLines(lines, windowWidth, windowHeight) {
  const { width, height } = bufferForLines(windowWidth, windowHeight, lines);
  return `${height}p · ${width}×${height}`;
}
