/**
 * RENDER_BUFFER — the world buffer's live dimensions, as a shared mutable object.
 *
 * Max, 2026-09-06: *"I want the whole game to read as a 5th gen game ... so we simply need to
 * redesign anything that does not read properly at this new resolution."* Chrome that is going to
 * share the world's pixel grid has to KNOW that grid, and three separate consumers need it —
 * `TargetingReticle`, `SupercruiseHud`/`SystemMap`, and `cabinMask`.
 *
 * ⭐ SHARED OBJECT, NOT A NUMBER, and the argument is `posterizeLevels.js`'s verbatim: all three are
 * constructed ONCE at boot and mutated thereafter, so a build-time read would strand each of them on
 * whatever the buffer was when it mounted — and the buffer now moves on every window resize as well
 * as on the setting. Hand this object over; never copy its fields into a consumer.
 *
 * ⛔ EXACTLY ONE WRITER, AND IT IS `RetroRenderer.resize()`. That function is the only place that
 * knows both the resolution setting and the window, which is the same argument its own comment makes
 * about `setPixelScale`. A second derivation anywhere else is precisely what produced the 13.5-pixel
 * checker (see `pixelScaleUniform.js`) — the allocation and the consumers disagreeing about a number
 * they each computed separately.
 */
import { bufferForLines, RENDER_LINES_DEFAULT } from './renderLines.js';

/**
 * THE SHARED OBJECT. `width`/`height` are the world render target's dimensions; `scale` is the
 * magnification the composite applies (screen px per buffer px). Zero until the first resize.
 */
export const RENDER_BUFFER = { width: 0, height: 0, scale: 1 };

/**
 * The only writer. Non-finite or sub-1 arguments leave the object alone rather than handing a
 * consumer a 0-dimension buffer — a canvas sized 0 throws on `getContext('2d')` draws, and a
 * division by a 0 scale is an Infinity that silently blanks whatever it reaches.
 * @param {number} width @param {number} height @param {number} scale
 * @returns {{width:number, height:number, scale:number}}
 */
export function setRenderBuffer(width, height, scale) {
  const w = Number(width), h = Number(height), s = Number(scale);
  if (Number.isFinite(w) && w >= 1) RENDER_BUFFER.width = Math.round(w);
  if (Number.isFinite(h) && h >= 1) RENDER_BUFFER.height = Math.round(h);
  if (Number.isFinite(s) && s > 0) RENDER_BUFFER.scale = s;
  return RENDER_BUFFER;
}

/**
 * The buffer, or a sane stand-in when nothing has resized yet.
 *
 * ⚠ THIS EXISTS FOR THE HOSTS THAT ARE NOT THE GAME. A consumer constructed before the first
 * `resize()` — the world-engine lab, a test host, a screenshot harness — would otherwise read
 * `{0, 0}` and size a canvas to nothing. Returning the default-resolution buffer for the window it
 * finds is wrong by at most one setting and never wrong by a crash.
 *
 * @param {number} windowWidth @param {number} windowHeight
 * @returns {{width:number, height:number, scale:number}}
 */
export function resolveRenderBuffer(windowWidth, windowHeight) {
  if (RENDER_BUFFER.width >= 1 && RENDER_BUFFER.height >= 1) return RENDER_BUFFER;
  return bufferForLines(windowWidth, windowHeight, RENDER_LINES_DEFAULT);
}
