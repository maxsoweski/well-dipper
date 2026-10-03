/**
 * navViewModes/lumDequant.js — the GPU density image's retro dither, averaged back out (batch 2, AC-16).
 *
 * Function · `dequantRGBA(src, W, H)` → a new RGBA byte array: every pixel the mean of the 8 x 8 window
 *   `[x-4, x+3] x [y-4, y+3]` around it (edges clamped), alpha opaque.
 * Intent · Max, g-sector (2026-10-03): *"I'm getting all of these little algorithm artifacts where things
 *   are looking square or looking like a screen door."* `NavGalaxyRenderer` quantises its brightness to 12
 *   levels through a 4 x 4 Bayer matrix laid on 2 x 2-pixel cells, so its 512² image carries a fixed
 *   lattice with an 8-pixel period; the 240p designs blit it nearest-neighbour at ~2.3-2.6 source pixels
 *   per texel, and the sampler picks a beat of that lattice — dots and 2 x 2 squares in a regular grid,
 *   strongest where the field is smooth (a whole sector, a whole region), where the dither IS the picture.
 * ⭐ AN 8 x 8 WINDOW IS EXACTLY ONE PERIOD: it holds each of the sixteen thresholds four times, so the
 *   mean is the brightness the dither encoded and the pattern CANCELS rather than blurs. Detail finer than
 *   8 pixels was already gone to the 12-level quantisation.
 * Deliberate non-goals · no requantisation, no colour change, nothing about the renderer itself (the
 *   designs' blit is what has to resample honestly; legacy draws the same image bilinear at 3.2x).
 * ⚠ Pure: no DOM. The designs wrap it in a canvas (`dequantLum` in nav-240p-lab.html / designs.js), and
 *   the nav-240p lab imports this module under the same name, so the two pages run one filter.
 */
export const DEQUANT_RADIUS = 4;   // window [i-4, i+3]: eight pixels, the dither's own period

export function dequantRGBA(src, W, H) {
  const R = DEQUANT_RADIUS, N = 2 * R;
  const tmp = new Float32Array(W * H * 3), out = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let c = 0; c < 3; c++) {          // horizontal pass
    let acc = 0;
    for (let k = -R; k < R; k++) acc += src[(y * W + Math.max(0, Math.min(W - 1, k))) * 4 + c];
    for (let x = 0; x < W; x++) {
      tmp[(y * W + x) * 3 + c] = acc / N;
      acc += src[(y * W + Math.min(W - 1, x + R)) * 4 + c] - src[(y * W + Math.max(0, x - R)) * 4 + c];
    }
  }
  for (let x = 0; x < W; x++) for (let c = 0; c < 3; c++) {          // vertical pass
    let acc = 0;
    for (let k = -R; k < R; k++) acc += tmp[(Math.max(0, Math.min(H - 1, k)) * W + x) * 3 + c];
    for (let y = 0; y < H; y++) {
      out[(y * W + x) * 4 + c] = acc / N;
      acc += tmp[(Math.min(H - 1, y + R) * W + x) * 3 + c] - tmp[(Math.max(0, y - R) * W + x) * 3 + c];
    }
  }
  for (let i = 3; i < out.length; i += 4) out[i] = 255;
  return out;
}
