/**
 * PhosphorDither — turning a full-colour picture into one ink on black.
 *
 * Lane F, workstream `cockpit-screen-content-2026-07-28`, AC-NAV-BUFFER (the H4
 * hosting fork).
 *
 * ── WHY THIS FILE EXISTS, AND WHAT IT IS ACTUALLY DECIDING ──────────────────
 *
 * `src/ui/NavComputer.js` is about 4,100 lines of drawing code that already
 * renders all seven navigation levels, the drill animations, the blinking
 * auto-cursor and the star picker. It is FULL COLOUR by design: per-spectral-
 * class star colours, a cyan you-are-here, a green selection, gold labels, and a
 * GPU-rendered galaxy density image. Phosphor law is ONE INK ON BLACK.
 *
 * The decision Max made — H4 — is NOT to re-author that drawing code. It is to
 * put the EXISTING canvas on the cockpit's glass through this function and then
 * LOOK AT IT. Whether a colour picture dithers down into something that reads as
 * a phosphor CRT, or into mud, is a judge-by-eye question that no argument
 * settles. It is his gate and no agent may close it. If it reads, ~3,900 lines
 * of drawing are saved. If it does not, the screens get re-authored one at a
 * time against a host that is already proven — and the plumbing is identical
 * either way, so nothing here is wasted work in either outcome.
 *
 * That is why this module is a KNOB and not a constant. The right setting is the
 * thing being judged, so the lab has to be able to sweep it while looking at the
 * glass.
 *
 * ── THE ONE-INK LAW IS INHERITED, NOT RESTATED ──────────────────────────────
 *
 * There is not a single colour literal in this file. The two output colours are
 * PARSED OUT OF `PHOSPHOR.INK` and `PHOSPHOR.BACK` at module load. That is
 * deliberate and it is the whole reason the law survives contact with a colour
 * source: a dither is exactly the kind of code that grows a "just a bit of grey
 * for the anti-aliasing" constant, and a grey is a THIRD COLOUR. The palette
 * lives in one place, this file reads it, and a test asserts over every output
 * pixel that only those two values were ever written.
 *
 * No greys, said plainly: the output is a two-valued image. Gradients survive as
 * TEXTURE — the pattern of lit and unlit pixels — which is what an ordered dither
 * buys and what a plain threshold does not.
 *
 * ── WHY ORDERED (BAYER) AND NOT A PLAIN THRESHOLD OR ERROR DIFFUSION ────────
 *
 * A plain threshold turns every smooth region into a hard edge: the galaxy's
 * density image becomes a few concentric blobs, and a star field of varying
 * brightness becomes "bright enough" and "gone". Most of the picture's
 * information is in those gradients, so most of it would be thrown away.
 *
 * Error diffusion (Floyd–Steinberg and friends) gives the best still image, and
 * it is the wrong tool here for a reason that only shows up in motion: the error
 * propagates along a scan path, so a one-pixel change anywhere causes pixels far
 * away to flip. On a panel redrawn ten-plus times a second while the nav view
 * pans, that reads as the whole screen CRAWLING. An ordered dither's threshold
 * depends only on (x, y), so a pixel that did not change does not flip, and the
 * texture stays PINNED TO THE GLASS the way a real CRT's phosphor mask is.
 * That stability is worth more than the extra fidelity of a still frame.
 *
 * 8x8 is the matrix size: 64 distinct levels, which is enough that a smooth ramp
 * reads as a ramp, over a tile small enough that the pattern reads as screen
 * texture rather than as wallpaper. It is GENERATED from the 2x2 recurrence
 * rather than written out as 64 numbers, because 64 hand-typed numbers is 64
 * chances to make a typo that nothing would catch — a slightly wrong Bayer
 * matrix does not error, it just dithers a little worse.
 *
 * ── THE KNOB, AND THE FORM THAT WAS REJECTED ────────────────────────────────
 *
 * Two numbers:
 *
 *   threshold — the BLACK POINT. Luminance at or below this lights nothing.
 *   gamma     — the mid-tone gain above that point. Below 1 lights more of the
 *               picture, above 1 lights less.
 *
 * The obvious parameterisation — a contrast pivot, `0.5 + (lum - pivot) * slope`
 * — was tried and REJECTED, and it is worth writing down why, because it looks
 * more natural and it breaks the single most important property here. With a
 * pivot below mid-grey, pure black maps to a POSITIVE signal, so an all-black
 * input comes out speckled. That is not a cosmetic loss: NavComputer's own
 * background is a near-black, it covers most of every frame at most levels, and
 * a background that speckles is precisely the "mud" outcome this fork exists to
 * test for. Whether the ink reads is a question worth asking; whether black
 * stays black is not.
 *
 * So the form below is a LEVELS curve — remap, clamp, then gamma — and it makes
 * both invariants unconditional, true at every setting of both knobs rather than
 * at the default:
 *
 *   luminance <= threshold  →  BACK, always
 *   luminance == 1          →  INK, always
 *
 * `threshold` earns its keep on the real input rather than in theory: the nav
 * background is about 3% luminance, not 0%, so with no black point at all every
 * frame would carry a light snow of ink across its whole area.
 *
 * ── LUMINANCE IS REC.709, WHICH MATTERS MORE HERE THAN USUAL ────────────────
 *
 * Not the average of the channels. Green carries about 71% of perceived
 * brightness and blue about 7%, so an average makes the nav computer's cyan
 * you-are-here marker and its gold labels come out at roughly the same
 * brightness as each other and as the deep-blue background — the three things a
 * pilot most needs to tell apart. Rec.709 is what keeps their ORDER right once
 * the hue is gone, which is the only channel left.
 *
 * ── PURE, AND WHY THAT IS THE TESTABILITY STORY ─────────────────────────────
 *
 * This function takes an ImageData-SHAPED object — `{width, height, data}`, where
 * `data` may be a plain Array — and never touches a canvas, a context, or
 * `document`. This repo's vitest runs in plain node with no jsdom, no happy-dom
 * and no node-canvas, so a dither that needed a canvas to run could not be tested
 * at any depth. Handed plain arrays it is completely checkable headlessly, and
 * the load-bearing assertion — that every output pixel is one of exactly two
 * colours — is one a real canvas would not make any easier to write.
 *
 * WHAT THE TEST CANNOT COVER, said plainly: whether the result LOOKS like a CRT.
 * There are no pixels in the test environment to look at, and no eye. The tests
 * pin the arithmetic and the two-colour law. The judgement is Max's, on the
 * glass, at the panel's real angular size.
 *
 * ── DELIBERATE NON-GOALS ────────────────────────────────────────────────────
 *
 *   - NO SCALING. Source and destination must be the same size. A dither that
 *     also resampled would be two decisions in one function and the resampling
 *     would silently soften the very texture the dither exists to create. The
 *     NAV source canvas is built at the panel's own buffer size for this reason.
 *   - NO BLUR, GLOW, SCANLINES OR CURVATURE. Those are a shader pass over the
 *     whole panel texture, decided once for all four screens, not something a
 *     per-pixel quantiser should be smuggling in.
 *   - NO SECOND INK AND NO GREY RAMP. See above; that is the law, not a setting.
 */

import { PHOSPHOR } from './PhosphorScreen.js';

/**
 * Rec.709 luminance weights. Exported so a caller reasoning about which of two
 * hues will survive the quantiser can do the sum without re-deriving it.
 */
export const REC709 = Object.freeze({ R: 0.2126, G: 0.7152, B: 0.0722 });

/** Side of the ordered-dither tile. See the header for why 8. */
export const BAYER_ORDER = 8;

/**
 * The default knob. NOT a settled answer — it is the starting point for the
 * sweep, and the lab exists to move it.
 *
 * `threshold` sits just above NavComputer's own background luminance (its
 * backdrop fill is a very dark blue, around 3%), so the empty parts of the frame
 * come out genuinely black rather than lightly snowed. `gamma` starts at 1, the
 * neutral setting, so the first thing Max sees is the picture's own tonal
 * distribution rather than one this file has already opinionated about.
 */
export const DEFAULT_DITHER = Object.freeze({ threshold: 0.06, gamma: 1 });

/**
 * Pull the three channels out of a `#rrggbb` string.
 *
 * Exists so this module can hold ZERO colour literals — see the header. A
 * malformed value throws at module load rather than at the first repaint,
 * because the failure would otherwise be four screens of NaN-coloured pixels,
 * which the canvas draws as fully transparent and nothing reports.
 */
function rgbFromHex(hex, where) {
  const m = /^#([0-9a-fA-F]{6})$/.exec(String(hex));
  if (!m) {
    throw new Error(
      `PhosphorDither: ${where} is ${JSON.stringify(hex)}, which is not a #rrggbb value. ` +
      `The two output colours are parsed out of PHOSPHOR so that this file holds no colour ` +
      `of its own; a shorthand or a named colour there needs this parser widened, not a ` +
      `literal added here.`,
    );
  }
  const n = parseInt(m[1], 16);
  return Object.freeze([(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]);
}

/** The only two colours this module can emit. Both come from PHOSPHOR. */
const INK_RGB = rgbFromHex(PHOSPHOR.INK, 'PHOSPHOR.INK');
const BACK_RGB = rgbFromHex(PHOSPHOR.BACK, 'PHOSPHOR.BACK');

/**
 * Build the Bayer matrix of a given power-of-two side, by the standard doubling
 * recurrence from [[0,2],[3,1]].
 *
 * Generated rather than transcribed: an 8x8 matrix is 64 numbers, a wrong one
 * produces no error and only a slightly worse picture, and "slightly worse
 * picture" is exactly the thing this whole fork is trying to judge. A generator
 * cannot have a typo in cell 43.
 */
function buildBayer(order) {
  let m = [[0, 2], [3, 1]];
  let n = 2;
  while (n < order) {
    const next = Array.from({ length: n * 2 }, () => new Array(n * 2));
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const v = m[y][x] * 4;
        next[y][x] = v;
        next[y][x + n] = v + 2;
        next[y + n][x] = v + 3;
        next[y + n][x + n] = v + 1;
      }
    }
    m = next;
    n *= 2;
  }
  return m;
}

/**
 * The matrix flattened to thresholds in the OPEN interval (0, 1).
 *
 * `(v + 0.5) / count` rather than `v / count` — and the half is load-bearing
 * twice over. Without it cell 0 would be exactly 0, so a signal of 0 (pure
 * black, the clamped floor) would fail `0 > 0` but any implementation using `>=`
 * would light it, and a black frame would carry one lit pixel per tile. Keeping
 * every threshold strictly inside (0, 1) means BOTH ends are unambiguous
 * whichever comparison is used, which is what makes the two invariants in the
 * header true by construction rather than by careful reading.
 */
export const BAYER_THRESHOLDS = Object.freeze(
  buildBayer(BAYER_ORDER).flat().map((v) => (v + 0.5) / (BAYER_ORDER * BAYER_ORDER)),
);

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * Validate the knob, loudly, once per call.
 *
 * Every one of these throws rather than substituting a default. A dither knob
 * that silently ignored a bad value would be a control that appears to do
 * nothing — and this control's entire job is to be swept while somebody watches
 * the glass, so "the slider does nothing" is the one failure that would waste
 * the judgement this whole file exists to enable.
 */
function readKnob(knob) {
  const threshold = knob?.threshold ?? DEFAULT_DITHER.threshold;
  const gamma = knob?.gamma ?? DEFAULT_DITHER.gamma;
  if (!Number.isFinite(threshold) || threshold < 0 || threshold >= 1) {
    throw new Error(
      `ditherToPhosphor: threshold must be a finite number in [0, 1), got ${threshold}. ` +
      `It is the black point — a value of 1 or more would light nothing at all, and the ` +
      `panel would be indistinguishable from one that is not being drawn.`,
    );
  }
  if (!Number.isFinite(gamma) || gamma <= 0) {
    throw new Error(
      `ditherToPhosphor: gamma must be a finite number greater than 0, got ${gamma}. ` +
      `A zero or negative exponent maps every non-black luminance to full ink, which is a ` +
      `white rectangle, not a picture.`,
    );
  }
  return { threshold, gamma };
}

/** Check an ImageData-shaped argument and return its dimensions. */
function readSurface(surface, where, expected) {
  const width = surface && surface.width;
  const height = surface && surface.height;
  const data = surface && surface.data;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error(
      `ditherToPhosphor: ${where} must carry a positive finite width and height, got ` +
      `${width} x ${height}. A zero here is the signature of an unlaid-out canvas, and it ` +
      `would quantise nothing while reporting success.`,
    );
  }
  if (!data || typeof data.length !== 'number' || data.length < width * height * 4) {
    throw new Error(
      `ditherToPhosphor: ${where}'s data holds ${data ? data.length : 'no'} entries, but a ` +
      `${width} x ${height} RGBA image needs ${width * height * 4}. A short buffer would be ` +
      `read past its end and produce undefined luminances over the bottom of the panel.`,
    );
  }
  if (expected && (width !== expected.width || height !== expected.height)) {
    throw new Error(
      `ditherToPhosphor: ${where} is ${width} x ${height} but the source is ` +
      `${expected.width} x ${expected.height}. This function does not resample — see the ` +
      `header. The NAV source canvas is built at the panel's own buffer size precisely so ` +
      `these always agree; a mismatch means one of the two was rebuilt and the other was not.`,
    );
  }
  return { width, height, data };
}

/**
 * Rec.709 luminance of one 0..255 RGB triple, as 0..1.
 *
 * Exported because it is the rule that decides which of two hues survives, and a
 * caller asking "will the cyan marker read brighter than the gold label" should
 * be able to ask this rather than reimplement the weights.
 *
 * Deliberately NOT gamma-corrected to linear light first. The nav computer's
 * colours were chosen by eye against a monitor, in sRGB, so the ordering this
 * has to preserve is the PERCEPTUAL one — and doing the sum on the sRGB values
 * keeps that ordering, where linearising first would push the mid-tones down and
 * darken exactly the labels and markers that most need to stay visible.
 *
 * @param {number} r 0..255
 * @param {number} g 0..255
 * @param {number} b 0..255
 * @returns {number} 0..1
 */
export function luminance709(r, g, b) {
  return (REC709.R * r + REC709.G * g + REC709.B * b) / 0xff;
}

/**
 * Quantise a full-colour RGBA image to Phosphor's two colours.
 *
 * @param {{width:number, height:number, data:ArrayLike<number>}} source RGBA, 0..255
 * @param {{threshold?:number, gamma?:number}} [knob] the taste knob; see DEFAULT_DITHER
 * @param {{width:number, height:number, data:{length:number}}} [out] a surface to
 *        write into — an `ImageData` from `ctx.createImageData` on the hot path, so
 *        a 60 Hz panel is not allocating a megabyte a frame. Omit and one is made.
 * @returns {{width:number, height:number, data:ArrayLike<number>}} `out`, or a new surface
 */
export function ditherToPhosphor(source, knob = DEFAULT_DITHER, out = null) {
  const { threshold, gamma } = readKnob(knob);
  const src = readSurface(source, 'the source', null);
  const { width, height } = src;

  // THE CALLER'S OWN OBJECT IS RETURNED when one was supplied, not a wrapper
  // around its data. The panel hands in an `ImageData` and then passes THAT to
  // `putImageData`, so an identical-looking copy would work by accident today and
  // break the moment anyone used the return value instead — the two would share a
  // data array but only one of them would be a real ImageData.
  let dst;
  if (out) {
    readSurface(out, 'the output surface', src);
    dst = out;
  } else {
    // A plain Array when there is no Uint8ClampedArray to be had. The typed array
    // is what a canvas wants; the plain one is what keeps this function runnable
    // in a test environment with no canvas at all.
    dst = {
      width,
      height,
      data: typeof Uint8ClampedArray === 'function'
        ? new Uint8ClampedArray(width * height * 4)
        : new Array(width * height * 4).fill(0),
    };
  }

  const span = 1 - threshold;
  const sd = src.data;
  const dd = dst.data;

  for (let y = 0; y < height; y++) {
    // The tile threshold depends ONLY on (x, y) — that is the whole reason this
    // is an ordered dither and not error diffusion. See the header: it is what
    // stops the texture crawling when the picture underneath it moves.
    const rowBase = (y % BAYER_ORDER) * BAYER_ORDER;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;

      // The levels curve. Remap from the black point, clamp, then gamma. Both of
      // the header's invariants live in these two lines: a luminance at or below
      // the threshold clamps to 0 and cannot beat any tile threshold, and a
      // luminance of 1 gives exactly 1, which beats all of them.
      const lum = luminance709(sd[i], sd[i + 1], sd[i + 2]);
      const signal = clamp01((lum - threshold) / span) ** gamma;

      const lit = signal > BAYER_THRESHOLDS[rowBase + (x % BAYER_ORDER)];
      const rgb = lit ? INK_RGB : BACK_RGB;
      dd[i] = rgb[0];
      dd[i + 1] = rgb[1];
      dd[i + 2] = rgb[2];
      // Opaque, always. The panel's canvas is what a CanvasTexture samples, and a
      // partially transparent CRT would let the cockpit's unlit interior show
      // through the black — which reads as a hole in the instrument, not as a
      // screen that is off.
      dd[i + 3] = 0xff;
    }
  }

  return dst;
}

/**
 * The two colours this module can emit, as `[r, g, b]`, for a test that wants to
 * state the two-colour law over every pixel without reparsing the palette.
 *
 * Exported rather than left private because the assertion it serves is the
 * load-bearing one in the whole file, and a test that re-derived these from the
 * hex would be re-implementing the thing under test.
 */
export const PHOSPHOR_RGB = Object.freeze({ INK: INK_RGB, BACK: BACK_RGB });

export default ditherToPhosphor;
