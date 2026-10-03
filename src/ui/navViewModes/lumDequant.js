/**
 * navViewModes/lumDequant.js — the GPU density image's retro dither, averaged back out (batch 2, AC-16).
 *
 * Function · `dequantRGBA(src, W, H)` → a new RGBA byte array: every pixel the mean of the 8 x 8 window
 *   `[x-4, x+3] x [y-4, y+3]` around it, alpha opaque. ⭐ batch 2 fixup (Astra 10): AT AN EDGE THE WINDOW SLIDES
 *   INWARD (`[0, 7]`, `[W-8, W-1]`) instead of repeating the edge pixel — a clamped window weighted one dither
 *   phase several times and left a 106-116 spread in the 4-pixel border of a flat 109 field; a slid window is
 *   still eight real consecutive pixels, one whole period, so the border cancels exactly like the interior.
 * Intent · Max, g-sector (2026-10-03): *"I'm getting all of these little algorithm artifacts where things
 *   are looking square or looking like a screen door."* `NavGalaxyRenderer` quantises its brightness to 12
 *   levels through a 4 x 4 Bayer matrix laid on 2 x 2-pixel cells, so its 512² image carries a fixed
 *   lattice with an 8-pixel period; the 240p designs blit it nearest-neighbour at ~2.3-2.6 source pixels
 *   per texel, and the sampler picks a beat of that lattice — dots and 2 x 2 squares in a regular grid,
 *   strongest where the field is smooth (a whole sector, a whole region), where the dither IS the picture.
 * ⭐ AN 8 x 8 WINDOW IS EXACTLY ONE PERIOD: it holds each of the sixteen thresholds four times, so the
 *   mean is the brightness the dither encoded and the pattern CANCELS rather than blurs. ⚠ It IS also a box blur
 *   of the real picture (corrected in the batch 2 fixup — this said finer detail "was already gone", but the
 *   12-level quantisation is in brightness, not space): structure finer than ~8 source pixels (~3 texels on the
 *   glass at 2.3-2.6 px per texel) is softened. Accepted: the nearest-neighbour blit at that ratio already could
 *   not show it honestly, and what it showed was the lattice's beat.
 * Deliberate non-goals · no requantisation, no colour change, nothing about the renderer itself (the
 *   designs' blit is what has to resample honestly; legacy draws the same image bilinear at 3.2x).
 * ⚠ Pure: no DOM. The designs wrap it in a canvas (`dequantLum` in nav-240p-lab.html / designs.js), and
 *   the nav-240p lab imports this module under the same name, so the two pages run one filter.
 */
export const DEQUANT_RADIUS = 4;   // window [i-4, i+3]: eight pixels, the dither's own period

export function dequantRGBA(src, W, H) {
  const R = DEQUANT_RADIUS;
  const NX = Math.min(2 * R, W), NY = Math.min(2 * R, H);   // a picture narrower than one period averages all of it
  const tmp = new Float32Array(W * H * 3), out = new Uint8ClampedArray(W * H * 4);
  const pre = new Float64Array(Math.max(W, H) + 1);          // running sums: the window is any eight, so no sliding update
  for (let y = 0; y < H; y++) for (let c = 0; c < 3; c++) {          // horizontal pass
    for (let x = 0; x < W; x++) pre[x + 1] = pre[x] + src[(y * W + x) * 4 + c];
    for (let x = 0; x < W; x++) {
      const a = Math.max(0, Math.min(W - NX, x - R));                 // slid inward at the edges, never clamped
      tmp[(y * W + x) * 3 + c] = (pre[a + NX] - pre[a]) / NX;
    }
  }
  for (let x = 0; x < W; x++) for (let c = 0; c < 3; c++) {          // vertical pass
    for (let y = 0; y < H; y++) pre[y + 1] = pre[y] + tmp[(y * W + x) * 3 + c];
    for (let y = 0; y < H; y++) {
      const a = Math.max(0, Math.min(H - NY, y - R));
      out[(y * W + x) * 4 + c] = (pre[a + NY] - pre[a]) / NY;
    }
  }
  for (let i = 3; i < out.length; i += 4) out[i] = 255;
  return out;
}
