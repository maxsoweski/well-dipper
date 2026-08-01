/**
 * PhosphorDither — lane F (cockpit-screen-content-2026-07-28), AC-NAV-BUFFER.
 *
 * ── WHAT IS ACTUALLY UNDER TEST, AND WHAT IS NOT ────────────────────────────
 *
 * NOT under test, and no arrangement of this file could make it so: whether the
 * dithered nav computer LOOKS like a phosphor CRT. That is the entire question
 * the H4 fork exists to answer, it is Max's gate, and there are no pixels in this
 * environment to look at — this repo's vitest runs in plain node with no jsdom,
 * no happy-dom and no node-canvas. Nothing below substitutes for his eye and
 * nothing below claims to.
 *
 * Under test: the arithmetic and the law.
 *
 *   1. TWO COLOURS, OVER EVERY PIXEL. This is the load-bearing one. A dither is
 *      exactly the kind of code that grows a grey for the sake of a smoother
 *      edge, and a grey is a third colour. So the check is not a sample and not
 *      a set of the values seen — it is an assertion over every pixel of every
 *      image tried, including a field built from NavComputer's own palette.
 *   2. BLACK STAYS BLACK, WHITE GOES WHITE — AT EVERY KNOB SETTING, not merely
 *      the default. The module's header argues that a pivot-contrast curve was
 *      rejected precisely because it breaks the first of those at low pivots, so
 *      these are swept across the knob rather than spot-checked.
 *   3. THE KNOB REACHES THE GLASS. A uniform grey's ink RATIO is checked against
 *      an expectation this file computes itself from the Bayer construction, and
 *      then swept: raising either knob must light strictly less of the picture.
 *      A control that did nothing would pass a "does not throw" test forever.
 *   4. IT IS A DITHER AND NOT A THRESHOLD. A ramp comes out with many distinct
 *      ink densities, monotonically ordered. A plain threshold would produce
 *      exactly two, which is the failure mode "gradients survive as texture
 *      rather than banding" names.
 *   5. THE TEXTURE DOES NOT CRAWL. Changing one source pixel flips at most that
 *      one output pixel. That is the property that made an ordered dither the
 *      choice over error diffusion, and it only shows up in motion, so it is
 *      pinned here where it can be stated exactly.
 *
 * ── WHY THERE IS NO CANVAS ANYWHERE IN THIS FILE ────────────────────────────
 *
 * `ditherToPhosphor` takes an ImageData-SHAPED object and never touches a
 * canvas, a context or `document`. So every image below is a plain Array built
 * by a helper, and the module is exercised at full depth headlessly. That
 * injection-free purity is itself asserted by a source scan, rather than left as
 * an intention that the next edit can quietly drop.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  BAYER_ORDER, BAYER_THRESHOLDS, DEFAULT_DITHER, PHOSPHOR_RGB, REC709,
  ditherToPhosphor, luminance709,
} from '../PhosphorDither.js';
import { PHOSPHOR } from '../PhosphorScreen.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const MODULE_PATH = join(HERE, '..', 'PhosphorDither.js');

/**
 * Is this file disabling any of its own tests?
 *
 * Comments are stripped first — this header DISCUSSES the helpers being scanned
 * for — and the pattern is assembled from fragments, because a literal one would
 * match itself. The check is about code, not prose.
 *
 * THIS SITS AT MODULE SCOPE AND THROWS, and that placement is the whole point.
 * It was measured on the sibling ScreenUV.test.js, not assumed: putting `it.only`
 * on one test there made vitest report "1 passed | 6 skipped" and exit GREEN,
 * because the scan was one of the tests it skipped. A self-scan that only runs as
 * a test cannot see a helper that stops it running. Module scope executes during
 * COLLECTION, before the runner can honour any focus helper, so this fires
 * whatever the tests say. The it() further down is kept anyway, so the guarantee
 * appears by name in the report.
 */
const SELF_CODE = readFileSync(join(HERE, 'PhosphorDither.test.js'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');
const DISABLED_RE = new RegExp(
  ['describe', 'it', 'test'].flatMap((k) => [k + '\\.skip', k + '\\.only']).join('|'),
);
if (DISABLED_RE.test(SELF_CODE)) {
  throw new Error(
    'PhosphorDither.test.js disables one of its own tests (a skip or focus helper is present ' +
    'in its code). This file is the whole of the one-ink guarantee for the NAV panel, so a ' +
    'disabled test here reads as "the nav computer obeys the Phosphor law" when nothing was ' +
    'checked. Remove it.',
  );
}

/** The module's own source, comments stripped — the scan is of code, not prose. */
const MODULE_CODE = readFileSync(MODULE_PATH, 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

// ── Image helpers: plain arrays, no canvas ─────────────────────────────────

/** An RGBA surface whose every pixel comes from `fn(x, y)` → `[r, g, b]`. */
function image(width, height, fn) {
  const data = new Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b] = fn(x, y);
      const i = (y * width + x) * 4;
      data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255;
    }
  }
  return { width, height, data };
}

/** A flat field of one colour. */
const solid = (width, height, rgb) => image(width, height, () => rgb);

/** Every pixel of a result as an `r,g,b,a` string, for exact-set assertions. */
function pixelSet(surface) {
  const seen = new Set();
  for (let i = 0; i < surface.width * surface.height * 4; i += 4) {
    seen.add(`${surface.data[i]},${surface.data[i + 1]},${surface.data[i + 2]},${surface.data[i + 3]}`);
  }
  return seen;
}

const INK_KEY = `${PHOSPHOR_RGB.INK[0]},${PHOSPHOR_RGB.INK[1]},${PHOSPHOR_RGB.INK[2]},255`;
const BACK_KEY = `${PHOSPHOR_RGB.BACK[0]},${PHOSPHOR_RGB.BACK[1]},${PHOSPHOR_RGB.BACK[2]},255`;

/** Is the pixel at index `i` (a byte offset) ink? */
const isInk = (surface, i) => surface.data[i] === PHOSPHOR_RGB.INK[0]
  && surface.data[i + 1] === PHOSPHOR_RGB.INK[1]
  && surface.data[i + 2] === PHOSPHOR_RGB.INK[2];

/** What fraction of the surface is lit. */
function inkFraction(surface) {
  let lit = 0;
  const n = surface.width * surface.height;
  for (let p = 0; p < n; p++) if (isInk(surface, p * 4)) lit += 1;
  return lit / n;
}

/**
 * The ink fraction this file expects for a UNIFORM luminance, derived here from
 * the Bayer construction rather than read out of the module.
 *
 * Written out independently on purpose. A test that asked the module what it
 * would produce and then checked it produced that would agree with every future
 * edit by construction and guard nothing. The count is exact — over a whole
 * number of tiles every one of the 64 thresholds is visited the same number of
 * times — so this is an equality, not a tolerance.
 */
function expectedInkFraction(lum, { threshold, gamma }) {
  const span = 1 - threshold;
  const clamped = Math.min(1, Math.max(0, (lum - threshold) / span));
  const signal = clamped ** gamma;
  const cells = BAYER_ORDER * BAYER_ORDER;
  let lit = 0;
  for (let k = 0; k < cells; k++) if (signal > (k + 0.5) / cells) lit += 1;
  return lit / cells;
}

/**
 * NavComputer's own palette, transcribed from `src/ui/NavComputer.js`.
 *
 * These are the actual colours the nav map draws with — the cyan you-are-here,
 * the green selection, the gold labels, the near-black backdrop, a warm star.
 * The two-colour law is checked over a field built from THESE rather than over
 * random noise, because random noise proves the law holds for colours nobody
 * will ever send, and these are the ones that will arrive on every frame.
 */
const NAV_PALETTE = [
  [5, 5, 8],        // #050508 — the backdrop fill in render()
  [0, 212, 255],    // #00d4ff — you-are-here
  [0, 255, 128],    // #00ff80 — selected
  [255, 200, 80],   // #ffc850 — labels
  [85, 255, 136],   // #55ff88 — corner brackets
  [255, 239, 176],  // #ffefb0 — a default star colour
  [255, 255, 255],
  [0, 0, 0],
];

// ── 0. The self-guard, by name ─────────────────────────────────────────────

describe('PhosphorDither.test.js — this file does not disable itself', () => {
  it('contains no skip or focus helper (also enforced at module scope)', () => {
    expect(DISABLED_RE.test(SELF_CODE)).toBe(false);
  });
});

// ── 1. ONE INK ON BLACK ────────────────────────────────────────────────────

describe('one ink on black — the law, over every pixel', () => {
  it('emits nothing but PHOSPHOR.INK and PHOSPHOR.BACK, on the nav computer\'s own palette', () => {
    // A field that cycles the real palette in both axes, so every colour meets
    // every cell of the 8x8 Bayer tile — the arrangement most likely to shake
    // out a mid-value if one existed.
    const src = image(64, 64, (x, y) => NAV_PALETTE[(x + y * 3) % NAV_PALETTE.length]);

    for (const knob of [
      DEFAULT_DITHER,
      { threshold: 0, gamma: 1 },
      { threshold: 0.5, gamma: 0.4 },
      { threshold: 0.9, gamma: 3 },
    ]) {
      const out = ditherToPhosphor(src, knob);
      const seen = [...pixelSet(out)].sort();
      // A subset check would pass on an all-black output, so the assertion is
      // that both colours were used AND nothing else was.
      expect(seen, `knob ${JSON.stringify(knob)} emitted a colour outside the palette`)
        .toEqual([BACK_KEY, INK_KEY].sort());
    }
  });

  it('takes both colours from PHOSPHOR rather than holding its own', () => {
    // The palette has exactly one home. This is what makes retinting the whole
    // cockpit one edit rather than two that can drift.
    const hex = (rgb) => `#${rgb.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
    expect(hex(PHOSPHOR_RGB.INK).toLowerCase()).toBe(PHOSPHOR.INK.toLowerCase());
    expect(hex(PHOSPHOR_RGB.BACK).toLowerCase()).toBe(PHOSPHOR.BACK.toLowerCase());
  });

  it('carries no colour literal in its own source, in any spelling', () => {
    // The draw path only shows colours on branches that RAN. This shows the ones
    // that did not — and it is stated in every spelling because `0xff7b6b`, the
    // full-screen HUD's red in the form three.js takes, contains no '#' and no
    // colour word for a naive scan to catch.
    expect(MODULE_CODE, 'a hex colour literal').not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(MODULE_CODE, 'an rgb()/hsl() literal').not.toMatch(/\b(rgba?|hsla?)\s*\(/);
    expect(MODULE_CODE, 'a 0x colour literal').not.toMatch(/0x[0-9a-fA-F]{6}/);
  });

  it('reaches for no canvas, context or document, so it is testable at all', () => {
    for (const forbidden of ['document', 'getContext', 'OffscreenCanvas', 'createImageData']) {
      expect(MODULE_CODE, `the module reaches for ${forbidden}`).not.toMatch(new RegExp(`\\b${forbidden}\\b`));
    }
  });

  it('leaves every pixel fully opaque', () => {
    // A partially transparent CRT lets the cockpit's unlit interior show through
    // the black, which reads as a hole in the instrument rather than a dark screen.
    const out = ditherToPhosphor(image(24, 24, (x) => [x * 10, 0, 0]), DEFAULT_DITHER);
    for (let i = 3; i < out.data.length; i += 4) expect(out.data[i]).toBe(255);
  });
});

// ── 2. BLACK STAYS BLACK, WHITE GOES WHITE — AT EVERY SETTING ──────────────

describe('the two invariants hold at every knob setting, not just the default', () => {
  const KNOBS = [
    DEFAULT_DITHER,
    { threshold: 0, gamma: 1 },
    { threshold: 0, gamma: 0.25 },
    { threshold: 0.001, gamma: 0.1 },
    { threshold: 0.5, gamma: 1 },
    { threshold: 0.99, gamma: 8 },
  ];

  it('an all-black frame lights nothing, at any threshold or gamma', () => {
    // The reason this is swept rather than spot-checked: the rejected
    // pivot-contrast form passes at threshold 0.5 and FAILS at low thresholds,
    // speckling a black frame. NavComputer's background covers most of every
    // frame, so that failure is the "mud" outcome, not an edge case.
    const black = solid(32, 32, [0, 0, 0]);
    for (const knob of KNOBS) {
      const out = ditherToPhosphor(black, knob);
      expect([...pixelSet(out)], `knob ${JSON.stringify(knob)} lit a black frame`).toEqual([BACK_KEY]);
    }
  });

  it('an all-white frame lights everything, at any threshold or gamma', () => {
    const white = solid(32, 32, [255, 255, 255]);
    for (const knob of KNOBS) {
      const out = ditherToPhosphor(white, knob);
      expect([...pixelSet(out)], `knob ${JSON.stringify(knob)} left a white frame dark`).toEqual([INK_KEY]);
    }
  });

  it('keeps a near-black backdrop black once the threshold clears it', () => {
    // NavComputer fills every frame with #050508 first — about 3% luminance, not
    // zero. That is the value DEFAULT_DITHER's black point was chosen against,
    // and this is the assertion that says so.
    const backdrop = solid(32, 32, [5, 5, 8]);
    expect(inkFraction(ditherToPhosphor(backdrop, DEFAULT_DITHER))).toBe(0);
    // …and with no black point at all it snows, which is why the knob exists.
    expect(inkFraction(ditherToPhosphor(backdrop, { threshold: 0, gamma: 1 }))).toBeGreaterThan(0);
  });
});

// ── 3. THE KNOB REACHES THE GLASS ──────────────────────────────────────────

describe('the knob moves how much of the picture lights up', () => {
  it('lights a uniform grey at exactly the fraction the Bayer tile predicts', () => {
    // Whole tiles in both axes, so every one of the 64 thresholds is visited the
    // same number of times and the fraction is exact rather than approximate.
    for (const v of [32, 64, 128, 192, 224]) {
      const src = solid(BAYER_ORDER * 4, BAYER_ORDER * 4, [v, v, v]);
      const out = ditherToPhosphor(src, DEFAULT_DITHER);
      expect(inkFraction(out), `grey ${v}`).toBeCloseTo(expectedInkFraction(v / 255, DEFAULT_DITHER), 10);
    }
  });

  it('lights strictly less as gamma rises, and strictly less as the black point rises', () => {
    const src = solid(BAYER_ORDER * 8, BAYER_ORDER * 8, [128, 128, 128]);

    const byGamma = [0.25, 0.5, 1, 2, 4]
      .map((gamma) => inkFraction(ditherToPhosphor(src, { threshold: 0, gamma })));
    for (let i = 1; i < byGamma.length; i++) {
      expect(byGamma[i], `gamma step ${i} did not darken: ${byGamma.join(' → ')}`)
        .toBeLessThan(byGamma[i - 1]);
    }

    const byThreshold = [0, 0.1, 0.25, 0.4]
      .map((threshold) => inkFraction(ditherToPhosphor(src, { threshold, gamma: 1 })));
    for (let i = 1; i < byThreshold.length; i++) {
      expect(byThreshold[i], `threshold step ${i} did not darken: ${byThreshold.join(' → ')}`)
        .toBeLessThan(byThreshold[i - 1]);
    }
  });

  it('refuses a knob it cannot honour rather than quietly substituting a default', () => {
    // A dither control that ignored a bad value would be a slider that appears to
    // do nothing — the one failure that would waste the judgement it exists for.
    const src = solid(8, 8, [128, 128, 128]);
    for (const bad of [{ threshold: 1 }, { threshold: 1.5 }, { threshold: -0.1 }, { threshold: NaN }]) {
      expect(() => ditherToPhosphor(src, bad), JSON.stringify(bad)).toThrow(/threshold/);
    }
    for (const bad of [{ gamma: 0 }, { gamma: -2 }, { gamma: Infinity }]) {
      expect(() => ditherToPhosphor(src, bad), JSON.stringify(bad)).toThrow(/gamma/);
    }
  });
});

// ── 4. A DITHER, NOT A THRESHOLD ───────────────────────────────────────────

describe('gradients survive as texture rather than as banding', () => {
  it('turns a ramp into many distinct ink densities, monotonically ordered', () => {
    // A plain threshold produces exactly TWO densities — 0 and 1 — with one hard
    // edge between them. That is the failure this whole choice of dither exists
    // to avoid, and this is where the difference is measurable without an eye.
    const W = 256, H = 64;
    const ramp = image(W, H, (x) => [x, x, x]);
    const out = ditherToPhosphor(ramp, { threshold: 0, gamma: 1 });

    const bands = [];
    for (let b = 0; b * BAYER_ORDER < W; b++) {
      let lit = 0;
      for (let y = 0; y < H; y++) {
        for (let x = b * BAYER_ORDER; x < (b + 1) * BAYER_ORDER; x++) {
          if (isInk(out, (y * W + x) * 4)) lit += 1;
        }
      }
      bands.push(lit / (BAYER_ORDER * H));
    }

    expect(new Set(bands).size, `only ${new Set(bands).size} distinct densities — that is banding`)
      .toBeGreaterThanOrEqual(16);
    for (let i = 1; i < bands.length; i++) {
      expect(bands[i], `density fell at band ${i}: ${bands[i - 1]} → ${bands[i]}`)
        .toBeGreaterThanOrEqual(bands[i - 1]);
    }
    expect(bands[0]).toBe(0);
    // Not exactly 1: the last band spans luminances 248/255 up to 1, and only the
    // single fully-white column beats the highest tile threshold. That the very
    // top of the scale is solid ink is the all-white assertion's job, not this
    // one's — here the point is only that the ramp reaches the bright end.
    expect(bands[bands.length - 1]).toBeGreaterThan(0.95);
  });

  it('uses 64 distinct tile thresholds, all strictly inside (0, 1)', () => {
    // Strictly inside is what makes both invariants true by construction: a
    // threshold of exactly 0 would light one pixel per tile on a black frame.
    expect(BAYER_THRESHOLDS.length).toBe(BAYER_ORDER * BAYER_ORDER);
    expect(new Set(BAYER_THRESHOLDS).size).toBe(BAYER_ORDER * BAYER_ORDER);
    for (const t of BAYER_THRESHOLDS) {
      expect(t).toBeGreaterThan(0);
      expect(t).toBeLessThan(1);
    }
  });
});

// ── 5. THE TEXTURE DOES NOT CRAWL ──────────────────────────────────────────

describe('an ordered dither, so a moving picture does not crawl', () => {
  it('flips only the pixel whose source changed', () => {
    // This is the whole reason error diffusion was rejected. Under Floyd-Steinberg
    // the error propagates along the scan path, so one changed pixel flips others
    // far away — which on a panel redrawn ten-plus times a second reads as the
    // screen crawling. Here the tile threshold is a function of (x, y) alone.
    const src = image(32, 32, () => [100, 100, 100]);
    const before = ditherToPhosphor(src, DEFAULT_DITHER);

    const target = (17 * 32 + 11) * 4;
    src.data[target] = 255; src.data[target + 1] = 255; src.data[target + 2] = 255;
    const after = ditherToPhosphor(src, DEFAULT_DITHER);

    const moved = [];
    for (let p = 0; p < 32 * 32; p++) {
      if (isInk(before, p * 4) !== isInk(after, p * 4)) moved.push(p * 4);
    }
    expect(moved).toEqual([target]);
  });

  it('is deterministic — the same frame twice is the same picture twice', () => {
    const src = image(40, 40, (x, y) => NAV_PALETTE[(x * 5 + y) % NAV_PALETTE.length]);
    const a = ditherToPhosphor(src, DEFAULT_DITHER);
    const b = ditherToPhosphor(src, DEFAULT_DITHER);
    expect([...a.data]).toEqual([...b.data]);
  });
});

// ── 6. LUMINANCE ───────────────────────────────────────────────────────────

describe('Rec.709 luminance, which is what keeps the nav map\'s hues in order', () => {
  it('weights green far above red and red above blue', () => {
    // The average-of-channels form would put the cyan you-are-here, the gold
    // labels and the deep-blue backdrop at nearly the same brightness — the three
    // things a pilot most needs to tell apart once the hue is gone.
    expect(luminance709(0, 255, 0)).toBeGreaterThan(luminance709(255, 0, 0));
    expect(luminance709(255, 0, 0)).toBeGreaterThan(luminance709(0, 0, 255));
    expect(REC709.R + REC709.G + REC709.B).toBeCloseTo(1, 10);
  });

  it('maps black to 0 and white to 1', () => {
    expect(luminance709(0, 0, 0)).toBe(0);
    expect(luminance709(255, 255, 255)).toBeCloseTo(1, 12);
  });

  it('ranks the nav computer\'s markers above its backdrop', () => {
    const lum = (rgb) => luminance709(rgb[0], rgb[1], rgb[2]);
    const backdrop = lum([5, 5, 8]);
    for (const marker of [[0, 212, 255], [0, 255, 128], [255, 200, 80], [255, 239, 176]]) {
      expect(lum(marker), `marker ${marker} would not out-read the backdrop`).toBeGreaterThan(backdrop);
    }
  });
});

// ── 7. THE OUTPUT SURFACE ──────────────────────────────────────────────────

describe('the reusable output surface', () => {
  it('writes into the buffer it is handed and returns that same buffer', () => {
    // The panel keeps one of these for the life of a buffer size, so a paint that
    // allocated instead of writing would quietly put a megabyte per repaint on
    // the floor.
    const src = solid(16, 16, [200, 200, 200]);
    const out = { width: 16, height: 16, data: new Array(16 * 16 * 4).fill(0) };
    const got = ditherToPhosphor(src, DEFAULT_DITHER, out);
    expect(got).toBe(out);
    expect(inkFraction(out)).toBeGreaterThan(0);
  });

  it('refuses an output surface of the wrong size rather than resampling', () => {
    const src = solid(16, 16, [200, 200, 200]);
    const wrong = { width: 8, height: 8, data: new Array(8 * 8 * 4).fill(0) };
    expect(() => ditherToPhosphor(src, DEFAULT_DITHER, wrong)).toThrow(/does not resample/);
  });

  it('refuses a source that is zero-sized or short of pixels', () => {
    expect(() => ditherToPhosphor({ width: 0, height: 8, data: [] }, DEFAULT_DITHER))
      .toThrow(/positive finite width and height/);
    expect(() => ditherToPhosphor({ width: 8, height: 8, data: new Array(10).fill(0) }, DEFAULT_DITHER))
      .toThrow(/needs 256/);
  });
});
