/**
 * PhosphorScreen — lane F (cockpit-screen-content-2026-07-28), AC-PHOSPHOR-KIT.
 *
 * ── WHAT IS ACTUALLY UNDER TEST, AND WHAT IS NOT ────────────────────────────
 *
 * NOT under test: whether the panels LOOK right. There are no pixels here to
 * look at — this repo's vitest runs in plain node with no jsdom, no happy-dom and
 * no node-canvas, so there is no Canvas2D anywhere in the test environment.
 * Kerning, weight, the balance of a panel, whether the inverted banner reads as
 * alarming rather than as a printing error: all of that is Max's eye, on the
 * glass, at the real angular size. Nothing below can substitute for that and
 * nothing below claims to.
 *
 * Under test: the three rules the kit exists to make mechanical, plus the
 * placement arithmetic that a panel author will build on without reading the
 * source.
 *
 *   1. ONE INK. Every colour the kit ever sets is PHOSPHOR.INK or PHOSPHOR.BACK.
 *      Checked two independent ways, because either alone has a hole. Watching
 *      the drawing catches a colour set on a path that ran; scanning the source
 *      catches a colour sitting on a path this test happens not to exercise.
 *   2. THE TYPE SCALE IS ANCHORED TO THE BUFFER HEIGHT. Proportionality is
 *      checked at two very different heights, and the legibility floor is
 *      checked against numbers WRITTEN OUT IN THIS FILE rather than imported —
 *      a test that reads its expectations from the module it guards agrees with
 *      every future edit by construction and guards nothing.
 *   3. BLINK IS A PURE FUNCTION OF A CLOCK PASSED IN. Driven with literal
 *      milliseconds, including the negative and non-finite cases that a naive
 *      implementation gets exactly backwards.
 *
 * ── HOW YOU TEST DRAWING CODE WITH NO CANVAS ────────────────────────────────
 *
 * The kit takes its context as a constructor argument and never reaches for
 * `document`, `window`, `OffscreenCanvas` or `getContext`. That injection is the
 * only reason any of this is testable, so it is itself asserted (by source scan)
 * rather than left as an intention.
 *
 * `makeRecordingCtx()` below is a Canvas2D-shaped object that writes every call
 * and every style assignment into a log. The style assignments are captured with
 * real property SETTERS, which is the only way `ctx.fillStyle = x` can be seen at
 * all — a plain object property would swallow it silently and rule 1 would be
 * uncheckable. Every assertion here then reads the log: which strings were drawn,
 * where, at what size, in what order, under which of the two colours.
 *
 * Lane F owns this file. Lane E's tests/cockpit-geometry.test.js is untouched,
 * and its describe.skipIf pattern is deliberately NOT copied.
 */
import { describe, it, expect } from 'vitest';
import { decodePixelText, measurePixelText, FACE } from '../../rendering/PixelText.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  PHOSPHOR, BLINK_MS, TYPE_RATIOS, MIN_TEXT_RATIO,
  blinkOn, typeScale, PhosphorScreen,
} from '../PhosphorScreen.js';
import { BLINK } from '../../ui/AlertCue.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const MODULE_PATH = join(HERE, '..', 'PhosphorScreen.js');

/**
 * Is this file disabling any of its own tests?
 *
 * Comments are stripped first: this file DISCUSSES lane E's skipIf in its header,
 * and the pattern is assembled from fragments because a literal one would match
 * itself. Either would fail a file that is in fact clean. The check is about code,
 * not prose.
 *
 * `.only` is scanned alongside `.skip` — the same failure wearing a friendlier
 * name. And this sits at MODULE SCOPE and throws rather than living only inside an
 * it(), because that was MEASURED on the sibling ScreenUV.test.js: putting
 * `it.only` on one test there made vitest report "1 passed | 6 skipped" and exit
 * GREEN, since the scan was one of the tests it skipped. A self-scan that only
 * runs as a test cannot see a helper that stops it running. Module scope executes
 * during collection, before the runner can honour any focus helper, so the throw
 * below fires whatever the tests say. The it() further down is kept anyway, so the
 * guarantee shows up by name in the report.
 */
const SELF_CODE = readFileSync(join(HERE, 'PhosphorScreen.test.js'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');
const DISABLED_RE = new RegExp(
  ['describe', 'it', 'test'].flatMap((k) => [k + '\\.skip', k + '\\.only']).join('|'),
);
const SELF_DISABLES_TESTS = DISABLED_RE.test(SELF_CODE);
if (SELF_DISABLES_TESTS) {
  throw new Error(
    'PhosphorScreen.test.js disables one of its own tests (a skip or focus helper is present in ' +
    'its code). This file is the whole of the one-ink and legibility guarantee, so a disabled ' +
    'test here reads as "the panels obey the Phosphor rules" when nothing was checked. Remove it.',
  );
}

/**
 * The module's own source, with comments stripped.
 *
 * Stripped because the header DISCUSSES the things being scanned for — it names
 * `document`, `getContext`, `Date.now` and the full-screen HUD's red — and a scan
 * that fired on prose would make honest documentation impossible. Comments do not
 * render on the glass; code does. This is a scan of code.
 */
const MODULE_CODE = readFileSync(MODULE_PATH, 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

// ── The recording stub context ──────────────────────────────────────────────

/**
 * A width per character, as a fraction of the font size. Any plausible constant
 * does — what matters is that `measureText` returns a finite number that SCALES
 * WITH THE FONT SIZE, because that is what makes a measurement taken under the
 * wrong font come out with the wrong width and trip the ordering test below.
 */
const STUB_CHAR_W = 0.6;

/**
 * The size `measureText` assumes when no font has been set yet. Deliberately not
 * equal to any size the kit uses, so a measurement taken before the font is set
 * produces a width that matches nothing and is caught rather than absorbed.
 */
const STUB_NO_FONT_SIZE = 10;

const FONT_SIZE_RE = /(\d+(?:\.\d+)?)px/;

/** What the stub would report for this string at this size. */
// ⛔ THE STUB WIDTH MODEL IS GONE. It approximated a vector monospace face at 0.6em per character
// because `measureText` in a headless context can only ever be a guess. The bitmap face is
// fixed-width and measures by arithmetic, so the test can ask the REAL function — which means
// these assertions now check the actual layout instead of agreeing with a stub.
const stubWidth = (str, size) => measurePixelText(str, Math.max(1, Math.round(size / FACE.h)));

/**
 * A Canvas2D-shaped recorder.
 *
 * Two things about it are deliberate and worth stating, because they make the
 * test HARSHER than a real canvas rather than more forgiving:
 *
 *  - `save()`/`restore()` are recorded but do NOT restore any state. So the kit
 *    is being exercised in a world where nothing it sets is ever put back. If it
 *    ever starts relying on `restore()` to undo a style or a font, the log shows
 *    the leaked value instead of a tidy fiction.
 *  - Nothing is ever reset between calls. `fillStyle`, `font`, `textAlign` and
 *    `textBaseline` all persist exactly as a shared real context's would, which
 *    is the whole reason the kit sets them explicitly every time.
 *
 * The stroke methods are present although the kit does not use them today. That
 * is not dead weight: it means a future edit that reaches for a stroked hairline
 * is RECORDED and caught by the one-ink assertions, rather than crashing with
 * "beginPath is not a function" and being fixed by adding it to the stub.
 */

// ── ⭐ TEXT IS READ BACK OUT OF THE TEXELS NOW ─────────────────────────────────────────────────
// chrome-and-ui-at-240p moved the cockpit kit onto the repo's bitmap face, so nothing calls
// `ctx.fillText` any more and the first argument these tests used to read no longer exists.
// ⛔ THE REPLACEMENT IS NOT A SELF-REPORT. `decodePixelText` reconstructs each string from the
// `fillRect` texels actually recorded, so every assertion below still asks the GLASS what it says
// — and asks it harder than before: a dropped glyph row or a fractional scale now fails, where a
// `fillText` string argument would have read perfectly either way.
function decodedText(log) {
  const rects = log.filter((e) => e.op === 'fillRect');
  return decodePixelText(rects).map((d) => {
    const px = d.scale * FACE.h;
    // ⚠ ANY texel of the run, not the one at (x, y): a glyph's first lit pixel is rarely its
    // top-left corner, so an exact-corner lookup returned undefined and reported `fillStyle: null`
    // — which read as "text drawn with no colour set" in the one-ink checks.
    const src = rects.find((r) => r.x >= d.x && r.x < d.x + d.text.length * FACE.advance * d.scale
      && r.y >= d.y && r.y < d.y + FACE.h * d.scale && r.w === d.scale);
    return {
      // ⭐ THE BASELINE, NOT THE TOP. `drawPixelText` takes a top and `decodePixelText` returns
      // one, but `text()`/`row()`/`banner()` have always taken a BASELINE and every assertion in
      // this file is written against that. Converting here keeps the contract these tests were
      // written for — the ink box is exact on a bitmap face, so baseline = top + cap height.
      op: 'fillText', text: d.text, x: d.x, y: d.y + px, size: px,
      // `font` is synthesised so the existing FONT_SIZE_RE size readers keep working unchanged.
      font: `${px}px bitmap`, fillStyle: src ? src.fillStyle : null,
    };
  });
}

function makeRecordingCtx() {
  const log = [];
  const state = {
    fillStyle: null, strokeStyle: null, font: null,
    textAlign: null, textBaseline: null, lineWidth: null,
  };

  const ctx = {
    get log() { return log; },
    fillRect(x, y, w, h) {
      log.push({ op: 'fillRect', x, y, w, h, fillStyle: state.fillStyle });
    },
    fillText(text, x, y) {
      log.push({
        op: 'fillText', text, x, y,
        fillStyle: state.fillStyle, font: state.font,
        textAlign: state.textAlign, textBaseline: state.textBaseline,
      });
    },
    measureText(text) {
      const m = FONT_SIZE_RE.exec(state.font || '');
      const size = m ? Number(m[1]) : STUB_NO_FONT_SIZE;
      log.push({ op: 'measureText', text, font: state.font });
      return { width: stubWidth(text, size) };
    },
    beginPath() { log.push({ op: 'beginPath' }); },
    moveTo(x, y) { log.push({ op: 'moveTo', x, y }); },
    lineTo(x, y) { log.push({ op: 'lineTo', x, y }); },
    stroke() { log.push({ op: 'stroke', strokeStyle: state.strokeStyle }); },
    save() { log.push({ op: 'save' }); },
    restore() { log.push({ op: 'restore' }); },
  };

  // Property setters, not plain fields. `ctx.fillStyle = '#f00'` on a plain
  // object is invisible to any observer, and rule 1 would be uncheckable.
  for (const prop of ['fillStyle', 'strokeStyle', 'font', 'textAlign', 'textBaseline', 'lineWidth']) {
    Object.defineProperty(ctx, prop, {
      get() { return state[prop]; },
      set(value) { state[prop] = value; log.push({ op: 'set', prop, value }); },
    });
  }
  return ctx;
}

const ops = (log, op) => (op === 'fillText' ? decodedText(log) : log.filter((e) => e.op === op));
const styleSets = (log) =>
  log.filter((e) => e.op === 'set' && (e.prop === 'fillStyle' || e.prop === 'strokeStyle'));

/** A panel and its recorder, at a size with round numbers. */
function makeScreen(width = 480, height = 400) {
  const ctx = makeRecordingCtx();
  return { ctx, screen: new PhosphorScreen(ctx, { width, height }) };
}

/**
 * One frame that uses every drawing method the kit has.
 *
 * This is the fixture rule 1 stands on, so its coverage matters more than its
 * looks: if a method is missing here, a colour that only that method sets goes
 * unwatched and the one-ink assertion passes vacuously. The test right below it
 * asserts the exercise really did reach all six.
 */
function drawEverything(screen) {
  screen.clear();
  screen.text('0.50 c', 24, 80, { size: screen.type.display });
  screen.text('SLOW DOWN', 240, 130, { align: 'centre', invert: true });
  screen.row('ATMO', 'co2-n2 0.85 bar', 170);
  screen.rule(190);
  screen.bar(24, 210, 432, 28, 0.6, { ticks: [{ frac: 0.8 }], pin: 0.4 });
  screen.bar(24, 260, 432, 28, -0.5, { bipolar: true, ticks: [{ frac: 0.9 }], pin: 0.2 });
  screen.banner('TOO CLOSE — SUBLIGHT ONLY', 330);
}

// ── Rule 1: one ink ─────────────────────────────────────────────────────────

describe('PhosphorScreen — ONE INK ON BLACK (rule 1)', () => {
  it('sets exactly two colours across a frame that uses every drawing method', () => {
    const { ctx, screen } = makeScreen();
    drawEverything(screen);

    const assignments = styleSets(ctx.log);

    // Vacuity guard first. If the exercise above stopped drawing — a rename, a
    // signature change, a throw swallowed somewhere — the SET below would be
    // empty and would trivially be "a subset of the two allowed colours".
    expect(
      assignments.length,
      'no fillStyle/strokeStyle was ever set — the exercise drew nothing and this assertion is vacuous',
    ).toBeGreaterThan(10);

    const seen = new Set(assignments.map((e) => e.value));
    expect(
      [...seen].sort(),
      `the kit set colours outside the Phosphor palette: ${[...seen].join(', ')}`,
    ).toEqual([PHOSPHOR.BACK, PHOSPHOR.INK].sort());

    // And BOTH were used, so a kit that had quietly stopped drawing any
    // background — losing inversion entirely — cannot pass by using one colour.
    expect(seen.has(PHOSPHOR.INK)).toBe(true);
    expect(seen.has(PHOSPHOR.BACK)).toBe(true);
  });

  it('reached every drawing method, so the palette check above is not vacuous', () => {
    const { ctx, screen } = makeScreen();
    drawEverything(screen);

    const rects = ops(ctx.log, 'fillRect');
    const texts = ops(ctx.log, 'fillText');

    // clear + one inverted block + two bar frames (4 each) + fills + marks + rule
    // + the banner block. The exact count is not the point; the point is that a
    // method quietly becoming a no-op drops below these.
    expect(rects.length).toBeGreaterThanOrEqual(18);

    const drawn = texts.map((t) => t.text);
    expect(drawn).toContain('0.50 c');          // text()
    expect(drawn).toContain('SLOW DOWN');       // text(), inverted
    expect(drawn).toContain('ATMO');            // row(), label
    expect(drawn).toContain('co2-n2 0.85 bar'); // row(), value
    expect(drawn).toContain('TOO CLOSE — SUBLIGHT ONLY'); // banner()
  });

  it('never leaves a draw running under an unset or foreign colour', () => {
    const { ctx, screen } = makeScreen();
    drawEverything(screen);

    // Every fill records the colour in force at the moment it ran. A null here
    // means something drew before setting a style, which on a real canvas paints
    // in the context default (opaque black) and reads as "that element vanished".
    for (const e of [...ops(ctx.log, 'fillRect'), ...ops(ctx.log, 'fillText')]) {
      expect(
        [PHOSPHOR.INK, PHOSPHOR.BACK],
        `a ${e.op} ran under fillStyle ${JSON.stringify(e.fillStyle)}`,
      ).toContain(e.fillStyle);
    }
  });

  it('draws with fills only — no stroked hairlines, which rasterise grey', () => {
    const { ctx, screen } = makeScreen();
    drawEverything(screen);

    // A canvas stroke is centred on its path, so a 1px line at an integer
    // coordinate straddles two pixel rows and renders at half intensity in each.
    // Grey is not one of our two colours in any sense the eye recognises, and at
    // ~260 screen pixels a smeared rule reads as a dirty screen.
    expect(ops(ctx.log, 'stroke')).toHaveLength(0);
    expect(ctx.log.filter((e) => e.op === 'set' && e.prop === 'strokeStyle')).toHaveLength(0);
  });

  it('carries no colour literal anywhere in its source but the two ink values', () => {
    // The drawing watch above only sees paths this test happened to run. This
    // sees the whole file, including a colour parked on a branch nothing here
    // reaches.
    const hexes = MODULE_CODE.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
    const strays = hexes.filter((h) => h.toUpperCase() !== PHOSPHOR.INK.toUpperCase()
      && h.toUpperCase() !== PHOSPHOR.BACK.toUpperCase());
    expect(strays, `stray hex colours in PhosphorScreen.js: ${strays.join(', ')}`).toEqual([]);

    // The palette values really are in there, so a file that lost them entirely
    // (and therefore trivially has no strays) cannot pass this.
    expect(hexes.length).toBeGreaterThanOrEqual(2);

    expect(MODULE_CODE, 'rgb()/rgba() colour in PhosphorScreen.js').not.toMatch(/rgba?\s*\(/);
    expect(MODULE_CODE, 'hsl()/hsla() colour in PhosphorScreen.js').not.toMatch(/hsla?\s*\(/);

    // 0xff7b6b is the full-screen HUD's red in the form three.js takes. It has no
    // '#', no 'rgb(' and no colour word, so only a scan that names this shape
    // catches it — the same argument AlertCue.js makes about the same value.
    expect(MODULE_CODE, 'a 0x-form colour literal in PhosphorScreen.js')
      .not.toMatch(/0x[0-9a-fA-F]{6}/);
  });
});

// ── The injection rule, which is what makes any of this testable ────────────

describe('PhosphorScreen — takes its context, never makes one', () => {
  it('touches no DOM global and no clock in its source', () => {
    for (const forbidden of ['document', 'window', 'OffscreenCanvas', 'getContext']) {
      expect(
        MODULE_CODE,
        `PhosphorScreen.js reaches for ${forbidden}. The context must be injected — ` +
        `vitest here has no jsdom, no happy-dom and no node-canvas, so a kit that ` +
        `makes its own drawing surface cannot be tested at all.`,
      ).not.toContain(forbidden);
    }
    for (const forbidden of ['Date.now', 'performance.now']) {
      expect(
        MODULE_CODE,
        `PhosphorScreen.js reads ${forbidden}. blinkOn must be a pure function of the ` +
        `clock it is handed, or its cadence can only be tested by waiting for it.`,
      ).not.toContain(forbidden);
    }
  });

  it('names the missing method when handed a canvas instead of a context', () => {
    // The overwhelmingly likely mistake: passing `canvas` rather than
    // `canvas.getContext('2d')`. It has a width and a height, so it looks right.
    expect(() => new PhosphorScreen({ width: 480, height: 400 }, { width: 480, height: 400 }))
      .toThrow(/no fillRect/);
    expect(() => new PhosphorScreen(makeRecordingCtx(), { width: 0, height: 400 }))
      .toThrow(/width must be positive/);
    expect(() => new PhosphorScreen(makeRecordingCtx(), { width: 480, height: 0 }))
      .toThrow(/buffer height must be positive/);
  });
});

// ── Rule 2: the type scale is anchored to the buffer height ────────────────

describe('PhosphorScreen — the type scale is proportional to the buffer (rule 2)', () => {
  it('scales every size by the same ratio at two very different heights', () => {
    const small = typeScale(256);
    const large = typeScale(1024);
    const ratio = 256 / 1024;

    const keys = ['display', 'body', 'label', 'pad', 'lead'];
    expect(Object.keys(small).sort()).toEqual([...keys].sort());

    for (const k of keys) {
      expect(small[k], `${k} is 0 or missing at H=256`).toBeGreaterThan(0);
      expect(
        small[k] / large[k],
        `${k} did not scale with the buffer height: ${small[k]} at H=256 vs ${large[k]} at ` +
        `H=1024. Any size written in absolute pixels SHRINKS ON THE GLASS every time the ` +
        `panel resolution is raised, because the panel still occupies the same ~260 screen px.`,
      ).toBeCloseTo(ratio, 12);
    }
  });

  it('freezes the scale, so one panel cannot re-tune the type for all of them', () => {
    const t = typeScale(400);
    expect(Object.isFrozen(t)).toBe(true);
    const before = t.body;
    try { t.body = 4; } catch { /* strict mode throws; sloppy mode is silent */ }
    expect(t.body).toBe(before);
  });

  it('refuses a zero or non-finite height instead of silently sizing everything to 0', () => {
    expect(() => typeScale(0)).toThrow(/positive and finite/);
    expect(() => typeScale(-10)).toThrow(/positive and finite/);
    expect(() => typeScale(NaN)).toThrow(/positive and finite/);
    expect(() => typeScale(undefined)).toThrow(/positive and finite/);
  });
});

// ── Rule 3: it reads at seventeen degrees ──────────────────────────────────

describe('PhosphorScreen — the legibility floor (rule 3)', () => {
  /**
   * THE NUMBERS BELOW ARE WRITTEN OUT HERE ON PURPOSE.
   *
   * Importing them from TYPE_RATIOS would make this test agree with any future
   * edit automatically, which is the same as not having it. Written out, an edit
   * to the module has to come here and change the literal too — which is the
   * moment somebody reads the arithmetic and decides on purpose.
   *
   * The arithmetic, restated so it is next to the numbers it justifies: the
   * panels subtend ~17 deg of a 70 deg vertical FOV; on a 1080-tall display that
   * is ~15 screen px per degree; so one panel is about 260 SCREEN pixels tall
   * regardless of its buffer resolution. Multiply each ratio by 220 to get what
   * the pilot's eye actually receives.
   */
  const H = 480;
  const SCREEN_PX_PER_PANEL = 220;   // MEASURED off cockpit.glb from Eye_Point, not assumed

  it('holds body text at H/20 and every text size at or above the H/24 floor', () => {
    const t = typeScale(H);

    // The floor CONSTANT is pinned first, and to a literal. Measured while
    // building this test: lowering MIN_TEXT_RATIO on its own broke nothing at
    // all, because it changes no size — it is documentation the module hands to
    // panel authors as "the floor". Without this line, moving the floor and then
    // moving the type down to meet it is a two-step edit whose first step is
    // silent, which is exactly how a floor stops being one.
    expect(MIN_TEXT_RATIO, 'the legibility floor itself was moved').toBeCloseTo(1 / 20, 12);

    expect(t.body, 'body text must be H/17 — about 13 screen px')
      .toBeCloseTo(H / 17, 10);
    expect(t.label, 'row labels must be H/20 — about 11 screen px, the floor')
      .toBeCloseTo(H / 20, 10);
    expect(t.display, 'the display size must be H/6 — about 37 screen px')
      .toBeCloseTo(H / 6, 10);

    // The floor, stated as an inequality so the WHY travels with the failure.
    for (const k of ['display', 'body', 'label']) {
      expect(
        t[k],
        `${k} is ${t[k]} px in a ${H} px buffer, which is ${(t[k] / H * SCREEN_PX_PER_PANEL).toFixed(1)} ` +
        `screen pixels at 14.25 degrees of a 70 degree FOV. The floor is H/20 (~11 screen px), below ` +
        `which a bold monospace glyph stops being read and starts being guessed. If this failed ` +
        `because one more row was needed, drop a row — do not shrink the type.`,
      ).toBeGreaterThanOrEqual(H * MIN_TEXT_RATIO - 1e-9);
      expect(t[k]).toBeGreaterThanOrEqual(H / 20 - 1e-9);
    }
  });

  it('leaves leading loose enough for INFO’s seven rows plus a heading and a rule', () => {
    const t = typeScale(H);

    // lead must clear the body size or consecutive lines collide.
    expect(t.lead, 'leading is tighter than the body text it separates').toBeGreaterThan(t.body);
    expect(t.lead / t.body, 'leading is under 1.4x body — cramped at this angular size')
      .toBeGreaterThanOrEqual(1.4);

    // INFO has seven rows. Heading + rule + 7 rows = 9 lines, and they must fit
    // between the top and bottom margins. This is the budget that was checked
    // before the ratios were picked, pinned so a later lead change re-checks it.
    //
    // The bound was 10 until 2026-07-29 and is now 9. The panels were MEASURED in
    // the lab as subtending 14.25 degrees rather than the 17 this file's arithmetic
    // had assumed, so every glyph was reaching the eye about 15% under its own
    // stated target and the label tier sat below its own floor. Raising the sizes
    // to meet those targets spent the spare baseline. Nine still covers everything
    // INFO is specified to show, and today's INFO uses seven. The trade is
    // deliberate: glyph size is the thing that decides whether a readout is read.
    const linesThatFit = Math.floor((H - t.pad * 2) / t.lead);
    expect(
      linesThatFit,
      `only ${linesThatFit} baselines fit in a ${H} px panel at lead ${t.lead}. INFO needs 9 ` +
      `(a heading, a rule, and seven rows). If the type grew again, drop a row rather than ` +
      `tightening the lead — cramped rows and small glyphs fail the same glance.`,
    ).toBeGreaterThanOrEqual(9);
  });

  it('refuses to DRAW below the floor, not just to derive a size below it', () => {
    // ADDED IN REVIEW, and this is the hole it closes. Everything else in this
    // describe block constrains `typeScale`. But no panel is obliged to use
    // typeScale's sizes — `text(str, x, y, { size: 3 })` is an ordinary-looking
    // call, and before this guard it drew type at about 1.6 screen pixels with
    // nothing anywhere objecting. Measured: the floor was documentation sitting
    // one convenient argument away from being ignored, so the exact request rule
    // 3 exists to stop — "just make it a bit smaller so one more row fits" —
    // went straight past it.
    const { ctx, screen } = makeScreen(480, H);

    expect(() => screen.text('ONE MORE ROW', 20, 100, { size: 3 }))
      .toThrow(/below the legibility floor/);
    expect(() => screen.banner('TOO CLOSE', 100, { size: 3 }))
      .toThrow(/below the legibility floor/);
    // Just under the floor is refused too — this is a floor, not a rough hint.
    expect(() => screen.text('X', 20, 100, { size: H / 24 - 0.5 })).toThrow(/legibility floor/);

    // Nothing was drawn on the way to any of those throws. A guard that refuses
    // the text but has already painted its inverted block is not a guard.
    expect(ops(ctx.log, 'fillRect'), 'a refused draw still painted').toHaveLength(0);
    expect(ops(ctx.log, 'fillText'), 'a refused draw still drew text').toHaveLength(0);

    // And the floor does NOT reject the scale's own smallest size. `label` sits
    // exactly on H/24, so an off-by-a-float here would break every INFO row.
    expect(() => screen.text('BODY', 20, 100, { size: screen.type.label })).not.toThrow();
    expect(() => screen.row('BODY', 'Kepler-16b', 100)).not.toThrow();
  });

  it('keeps the hairline a whole pixel on a small buffer, where the floor bites', () => {
    // ADDED IN REVIEW. `hair` is body/8 floored at one pixel, and the module's
    // own comment argues the floor matters — a sub-pixel fillRect rasterises as
    // a grey smear, and grey is not one of our two colours. But the floor only
    // BINDS below H = 160, and every other test here builds a 400 px buffer
    // where body/8 is 2.5. Measured: deleting `Math.max(1, ...)` left all 43
    // tests green. This builds the small screen that makes the guard bite.
    const small = new PhosphorScreen(makeRecordingCtx(), { width: 144, height: 120 });
    expect(typeScale(120).body / 8, 'H=120 must be small enough to need the floor')
      .toBeLessThan(1);
    expect(small.hair, 'a sub-pixel hairline rasterises grey, which is a third colour')
      .toBeGreaterThanOrEqual(1);

    // Proportional above the floor, so it has not simply been pinned to 1.
    const large = new PhosphorScreen(makeRecordingCtx(), { width: 1229, height: 1024 });
    expect(large.hair).toBeCloseTo(typeScale(1024).body / 8, 9);
  });

  it('exposes the ratios it actually uses, so a panel author can plan a layout', () => {
    expect(Object.isFrozen(TYPE_RATIOS)).toBe(true);
    const t = typeScale(H);
    for (const k of Object.keys(TYPE_RATIOS)) {
      expect(t[k], `typeScale ignored TYPE_RATIOS.${k}`).toBeCloseTo(H * TYPE_RATIOS[k], 10);
    }
  });
});

// ── Rule 4: blink is time-driven and pure ──────────────────────────────────

describe('PhosphorScreen — blinkOn is a pure function of the clock (rule 4)', () => {
  it('pins the signed-off cadences: slow 1200/600, fast 300/150, steady never', () => {
    // These are an attention grammar Max signed off on, not a render-cadence
    // convenience. Retuning them to land on frame boundaries changes what the
    // panel is SAYING about urgency.
    expect(BLINK_MS.steady).toBe(null);
    expect([...BLINK_MS.slow]).toEqual([1200, 600]);
    expect([...BLINK_MS.fast]).toEqual([300, 150]);
    expect(Object.isFrozen(BLINK_MS)).toBe(true);
    expect(Object.isFrozen(BLINK_MS.fast), 'the cadence arrays must be frozen individually — a ' +
      'shallow freeze still lets BLINK_MS.fast[0] = 900 retune every alarm at once').toBe(true);
  });

  it('is always lit on steady, at every clock value including broken ones', () => {
    for (const t of [0, 1, 599, 1200, 1e9, -5000, NaN, Infinity]) {
      expect(blinkOn('steady', t), `steady went dark at t=${t}`).toBe(true);
    }
  });

  it('walks the slow and fast cycles by the clock alone', () => {
    const cases = [
      // slow: 1200 lit, 600 dark, period 1800
      ['slow', 0, true], ['slow', 1, true], ['slow', 1199.9, true],
      ['slow', 1200, false], ['slow', 1799.9, false],
      ['slow', 1800, true], ['slow', 3000, false], ['slow', 3600, true],
      // fast: 300 lit, 150 dark, period 450
      ['fast', 0, true], ['fast', 299.9, true],
      ['fast', 300, false], ['fast', 449.9, false],
      ['fast', 450, true], ['fast', 900, true],
      ['fast', 1050, true],   // 1050 mod 450 = 150, still inside the 300 ms lit phase
      ['fast', 1250, false],  // 1250 mod 450 = 350, inside the 150 ms dark phase
    ];
    for (const [tier, t, want] of cases) {
      expect(blinkOn(tier, t), `${tier} at t=${t}`).toBe(want);
    }
  });

  it('gets the phase right for a negative clock', () => {
    // JavaScript's % keeps the sign of its left operand, so the obvious
    // `t % period < lit` reads -100 as -100, which is less than 1200 and
    // therefore "lit". The truth is that -100 ms is 1700 ms into an 1800 ms
    // cycle — the DARK phase. A clock zeroed mid-session (a panel counting from
    // the frame it was created; a paused sim resuming) hands out small negative
    // values routinely, so this is not a curiosity.
    expect(blinkOn('slow', -100), '-100 ms is 1700 into the 1800 ms cycle: dark').toBe(false);
    expect(blinkOn('slow', -601), '-601 ms is 1199 into the cycle: lit').toBe(true);
    expect(blinkOn('slow', -1800), 'a whole cycle back is the start of the cycle: lit').toBe(true);
    expect(blinkOn('fast', -100), '-100 ms is 350 into the 450 ms cycle: dark').toBe(false);
    expect(blinkOn('fast', -160), '-160 ms is 290 into the cycle: lit').toBe(true);
  });

  it('fails LIT on a broken clock, never dark', () => {
    // A NaN compares false against everything, so the unguarded form returns
    // "dark" forever — and the concrete consequence is TOO CLOSE — SUBLIGHT ONLY
    // never reaching the glass at all. A warning stuck lit is a visible fault a
    // pilot can report; a warning stuck dark is indistinguishable from safety.
    for (const t of [NaN, Infinity, -Infinity, undefined, null]) {
      expect(blinkOn('fast', t), `a ${String(t)} clock must fail lit, not dark`).toBe(true);
      expect(blinkOn('slow', t), `a ${String(t)} clock must fail lit, not dark`).toBe(true);
    }
  });

  it('is pure — same arguments, same answer, no phase carried between calls', () => {
    const first = [0, 700, 1300, 2500].map((t) => blinkOn('slow', t));
    // Interleave unrelated calls that would corrupt any internal phase.
    for (const t of [17, 999, 123456]) { blinkOn('fast', t); blinkOn('steady', t); }
    const second = [0, 700, 1300, 2500].map((t) => blinkOn('slow', t));
    expect(second).toEqual(first);
  });

  it('throws on an unknown tier rather than defaulting to a calm steady line', () => {
    expect(() => blinkOn('urgent', 0)).toThrow(/unknown blink tier/);
    expect(() => blinkOn('URGENT', 0)).toThrow(/"URGENT"/);
    expect(() => blinkOn(undefined, 0)).toThrow(/unknown blink tier/);
    // Not inherited from Object.prototype, either.
    expect(() => blinkOn('toString', 0)).toThrow(/unknown blink tier/);
  });

  it('knows a cadence for every tier AlertCue hands out, and no others', () => {
    // The seam. AlertCue.BLINK names the tiers and deliberately quotes no rates;
    // this is where the names acquire milliseconds. The two are checked against
    // each other here rather than imported into one another, so adding a tier on
    // either side fails loudly instead of half-landing.
    expect(Object.keys(BLINK_MS).sort()).toEqual(Object.values(BLINK).sort());
    for (const tier of Object.values(BLINK)) {
      expect(() => blinkOn(tier, 0), `AlertCue hands out ${tier} and blinkOn rejects it`).not.toThrow();
    }
  });
});

// ── The drawing itself, asserted from the log ──────────────────────────────

describe('PhosphorScreen — text placement', () => {
  it('clears the whole buffer to black before anything else', () => {
    const { ctx, screen } = makeScreen(480, 400);
    screen.clear();
    const rects = ops(ctx.log, 'fillRect');
    expect(rects).toHaveLength(1);
    expect(rects[0]).toMatchObject({ x: 0, y: 0, w: 480, h: 400, fillStyle: PHOSPHOR.BACK });
  });

  it('places left, centred and right text off its own measurement', () => {
    const { ctx, screen } = makeScreen(480, 400);
    const size = screen.type.body;
    const s = 'MODE: ORBIT';
    const w = stubWidth(s, size);

    screen.text(s, 40, 100, { size, align: 'left' });
    screen.text(s, 240, 140, { size, align: 'centre' });
    screen.text(s, 240, 180, { size, align: 'center' });
    screen.text(s, 440, 220, { size, align: 'right' });

    const [left, centreBritish, centreAmerican, right] = ops(ctx.log, 'fillText');
    expect(left.x).toBeCloseTo(40, 9);
    expect(centreBritish.x).toBeCloseTo(240 - w / 2, 9);
    expect(centreAmerican.x).toBeCloseTo(240 - w / 2, 9);
    expect(right.x).toBeCloseTo(440 - w, 9);

    // The baseline is passed straight through — y is a baseline, not a top.
    expect(left.y).toBe(100);
    expect(right.y).toBe(220);
  });

  it('sets font, textAlign and textBaseline explicitly on every draw', () => {
    const { ctx, screen } = makeScreen();
    // A hostile context: another drawer has left both placement modes set to
    // something else. On a real shared canvas this persists, and a kit that
    // relies on the defaults shifts every string by half its width — on the
    // frames after that other code ran, and not before.
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    drawEverything(screen);

    for (const t of ops(ctx.log, 'fillText')) {
      expect(t.textAlign, `"${t.text}" drew under textAlign ${t.textAlign}`).toBe('left');
      expect(t.textBaseline, `"${t.text}" drew under textBaseline ${t.textBaseline}`).toBe('alphabetic');
      expect(t.font, `"${t.text}" drew with no font set`).toMatch(/^700 [\d.]+px monospace$/);
    }
  });

  it('measures under the font it is about to draw with, not the previous one', () => {
    const { ctx, screen } = makeScreen(480, 400);
    // Draw big first so a stale font would be conspicuously wrong, then ask for
    // a right-aligned label. If the measurement were taken before the font was
    // set, the width would be the display size's and the label would hang off
    // the left edge — a layout that looks deliberate and is simply wrong.
    screen.text('0.50 c', 24, 80, { size: screen.type.display });
    screen.text('LABEL', 440, 120, { size: screen.type.label, align: 'right' });

    const label = ops(ctx.log, 'fillText')[1];
    expect(label.x).toBeCloseTo(440 - stubWidth('LABEL', screen.type.label), 9);

    const measures = ops(ctx.log, 'measureText');
    const labelMeasure = measures.find((m) => m.text === 'LABEL');
    expect(labelMeasure.font).toContain(`${screen.type.label}px`);
  });

  it('draws nothing at all for an empty string, inverted or not', () => {
    const { ctx, screen } = makeScreen();
    expect(screen.text('', 10, 10)).toBe(null);
    expect(screen.text('', 10, 10, { invert: true })).toBe(null);
    expect(screen.text(null, 10, 10, { invert: true })).toBe(null);
    expect(screen.text(undefined, 10, 10, { invert: true })).toBe(null);

    // The inverted case is the one that matters. Without the guard it paints a
    // bare ink block with no text in it, which on a one-ink panel is
    // indistinguishable from a deliberate marker — and InfoReadout hands out
    // empty values routinely by design ("missing means blank"), so this WILL
    // happen rather than might.
    expect(ops(ctx.log, 'fillRect'), 'an empty string painted something').toHaveLength(0);
    expect(ops(ctx.log, 'fillText'), 'an empty string drew text').toHaveLength(0);
  });

  it('refuses an unrecognised alignment instead of quietly left-aligning', () => {
    const { screen } = makeScreen();
    expect(() => screen.text('X', 10, 10, { align: 'middle' })).toThrow(/unknown align/);
    expect(() => screen.text('X', 10, 10, { align: 'start' })).toThrow(/known: left/i);
  });
});

describe('PhosphorScreen — inversion is the whole alert vocabulary', () => {
  it('paints an ink block and knocks the glyphs out of it in the background colour', () => {
    const { ctx, screen } = makeScreen(480, 400);
    const size = screen.type.body;
    screen.text('SLOW DOWN', 40, 200, { size, invert: true });

    const rects = ops(ctx.log, 'fillRect');
    const texts = ops(ctx.log, 'fillText');
    expect(rects).toHaveLength(1);
    expect(texts).toHaveLength(1);

    // Block in ink, text in the background colour. Not a second hue — there is
    // no third value anywhere in this module for it to be.
    expect(rects[0].fillStyle).toBe(PHOSPHOR.INK);
    expect(texts[0].fillStyle).toBe(PHOSPHOR.BACK);

    // Order matters: the block has to land before the glyphs or it covers them.
    const blockIdx = ctx.log.indexOf(rects[0]);
    const textIdx = ctx.log.indexOf(texts[0]);
    expect(blockIdx, 'the ink block was painted over its own text').toBeLessThan(textIdx);

    // And the block actually covers the glyphs, with room on both sides.
    const w = stubWidth('SLOW DOWN', size);
    expect(rects[0].x).toBeLessThan(40);
    expect(rects[0].x + rects[0].w).toBeGreaterThan(40 + w);
    expect(rects[0].y).toBeLessThan(200);                 // above the baseline
    expect(rects[0].y + rects[0].h).toBeGreaterThan(200); // and below it, for descenders
  });

  it('spans a banner edge to edge, ignoring the margins', () => {
    const { ctx, screen } = makeScreen(480, 400);
    screen.banner('TOO CLOSE — SUBLIGHT ONLY', 300);

    const block = ops(ctx.log, 'fillRect')[0];
    const text = ops(ctx.log, 'fillText')[0];

    // Full width is the point: at this angular size an inverted band across the
    // whole glass is recognisable before any of its letters are, which is the
    // entire job of an alert on a screen you glance at. Inset to the margins it
    // would read as one more row.
    expect(block).toMatchObject({ x: 0, w: 480, fillStyle: PHOSPHOR.INK });
    expect(text.fillStyle).toBe(PHOSPHOR.BACK);

    // Centred across the full width, not across the text area.
    const w = stubWidth('TOO CLOSE — SUBLIGHT ONLY', screen.type.body);
    expect(text.x).toBeCloseTo((480 - w) / 2, 9);
  });

  it('paints no bare block when the measurement fails mid-banner', () => {
    // ADDED IN REVIEW. `banner` used to paint its ink block and THEN measure the
    // string. `_measure` throws on a non-finite width, so a broken context left
    // an inverted band on the glass with no words in it — which is precisely
    // what `text` refuses to draw for an empty string, arriving by another door.
    // On a one-ink panel a wordless block is indistinguishable from a deliberate
    // marker, so it is a wrong reading rather than a missing one.
    const ctx = makeRecordingCtx();
    ctx.measureText = () => ({ width: NaN });
    const screen = new PhosphorScreen(ctx, { width: 480, height: 400 });

    expect(() => screen.banner('TOO CLOSE — SUBLIGHT ONLY', 300)).toThrow(/non-numeric width/);
    expect(ops(ctx.log, 'fillRect'), 'the ink block was painted before the banner could finish')
      .toHaveLength(0);
  });

  it('draws no banner block for an empty warning', () => {
    const { ctx, screen } = makeScreen();
    expect(screen.banner('', 100)).toBe(null);
    expect(ops(ctx.log, 'fillRect')).toHaveLength(0);
  });

  it('does not blink anything itself — the clock stays outside the drawing call', () => {
    // Keeping the decision in blinkOn is what lets the cadence be tested with
    // literal numbers and lets all four panels blink in step off one clock.
    const { ctx, screen } = makeScreen();
    screen.banner('SLOW DOWN', 100);
    screen.banner('SLOW DOWN', 100);
    expect(ops(ctx.log, 'fillText')).toHaveLength(2);   // identical calls, identical output
  });
});

describe('PhosphorScreen — rows and rules', () => {
  it('pushes the label hard left and the value hard right on one baseline', () => {
    const { ctx, screen } = makeScreen(480, 400);
    const y = 220;
    screen.row('ATMO', 'co2-n2 0.85 bar', y);

    const [label, value] = ops(ctx.log, 'fillText');
    expect(label.text).toBe('ATMO');
    expect(value.text).toBe('co2-n2 0.85 bar');

    // One baseline. This is why y is a baseline and not a top: two different
    // sizes on one line need no arithmetic at all.
    expect(label.y).toBe(y);
    expect(value.y).toBe(y);

    // Opposite margins. The shared right edge is what makes a column of rows
    // scannable without reading the labels — the only way seven rows work at
    // eleven screen pixels.
    expect(label.x).toBeCloseTo(screen.type.pad, 9);
    expect(value.x + stubWidth(value.text, screen.type.body))
      .toBeCloseTo(480 - screen.type.pad, 9);

    // Labels smaller than values: the value is the thing being read.
    expect(label.font).toContain(`${screen.type.label}px`);
    expect(value.font).toContain(`${screen.type.body}px`);
  });

  it('keeps a blank row’s label and its line, drawing no value', () => {
    const { ctx, screen } = makeScreen();
    const result = screen.row('T_EQ', '', 220);

    // InfoReadout's rule arriving intact at the glass: a row that vanishes when
    // its value is missing makes every row below it jump up the screen, and a
    // pilot glancing at a moving readout misreads it.
    const texts = ops(ctx.log, 'fillText');
    expect(texts).toHaveLength(1);
    expect(texts[0].text).toBe('T_EQ');
    expect(result.value).toBe(null);
    expect(result.label).not.toBe(null);
  });

  it('draws a rule as a filled bar inset to the margins', () => {
    const { ctx, screen } = makeScreen(480, 400);
    screen.rule(150);
    const rects = ops(ctx.log, 'fillRect');
    expect(rects).toHaveLength(1);
    expect(rects[0].x).toBeCloseTo(screen.type.pad, 9);
    expect(rects[0].w).toBeCloseTo(480 - screen.type.pad * 2, 9);
    expect(rects[0].fillStyle).toBe(PHOSPHOR.INK);
    expect(rects[0].h, 'a sub-pixel rule rasterises as a grey smear').toBeGreaterThanOrEqual(1);
  });
});

describe('PhosphorScreen — the bar', () => {
  const X = 24, Y = 200, W = 432, H = 28;

  /** Rects drawn by one bar call, in order. */
  function barRects(opts, frac = 0.6, size = { width: 480, height: 400 }) {
    const ctx = makeRecordingCtx();
    const screen = new PhosphorScreen(ctx, size);
    screen.bar(X, Y, W, H, frac, opts);
    return { rects: ops(ctx.log, 'fillRect'), screen };
  }

  it('always draws its frame, so an instrument with no reading still exists', () => {
    const { rects } = barRects({}, NaN);
    // Four sides and nothing else: no fill. Clamping a NaN to 0 would claim the
    // ship is stopped; skipping the frame would claim there is no instrument.
    expect(rects).toHaveLength(4);
    for (const r of rects) expect(r.fillStyle).toBe(PHOSPHOR.INK);
  });

  it('fills from the left in proportion to frac, unipolar', () => {
    const empty = barRects({}, 0).rects;
    const half = barRects({}, 0.5).rects;
    const full = barRects({}, 1).rects;

    expect(empty).toHaveLength(4);            // a zero fill draws no rectangle
    expect(half).toHaveLength(5);
    expect(full).toHaveLength(5);

    const halfFill = half[4], fullFill = full[4];
    expect(halfFill.x).toBeCloseTo(fullFill.x, 9);          // same left edge
    expect(halfFill.w).toBeCloseTo(fullFill.w / 2, 9);      // half the width
    expect(halfFill.x).toBeGreaterThan(X);                  // inside the frame
    expect(halfFill.x + halfFill.w).toBeLessThan(X + W);
  });

  it('clamps out-of-range fractions rather than drawing past the frame', () => {
    const over = barRects({}, 5).rects[4];
    const full = barRects({}, 1).rects[4];
    expect(over.w).toBeCloseTo(full.w, 9);
    const under = barRects({}, -3).rects;
    expect(under, 'a negative unipolar frac drew a backwards bar').toHaveLength(4);
  });

  it('grows from the centre on a bipolar bar, left for reverse', () => {
    // sublightBarFrac returns a SIGNED fraction precisely so a reversing ship
    // reads as reverse. A bar that treated it as unipolar would clamp every
    // reverse speed to empty while the number beside it said REV 0.50 c.
    const rev = barRects({ bipolar: true }, -0.5).rects;
    const fwd = barRects({ bipolar: true }, 0.5).rects;
    const centreX = X + W / 2;

    // frame(4) + fill + the zero mark
    expect(rev).toHaveLength(6);
    expect(fwd).toHaveLength(6);

    const revFill = rev[4], fwdFill = fwd[4];
    expect(revFill.x, 'reverse must fill to the LEFT of centre').toBeLessThan(centreX);
    expect(revFill.x + revFill.w).toBeCloseTo(centreX, 9);
    expect(fwdFill.x).toBeCloseTo(centreX, 9);
    expect(fwdFill.x + fwdFill.w, 'forward must fill to the RIGHT of centre')
      .toBeGreaterThan(centreX);
    expect(revFill.w).toBeCloseTo(fwdFill.w, 9);   // symmetric about zero
  });

  it('marks zero on a bipolar bar, so "stopped" is not "no reading"', () => {
    const stopped = barRects({ bipolar: true }, 0).rects;
    const noReading = barRects({ bipolar: true }, NaN).rects;
    expect(stopped).toHaveLength(5);      // frame + the zero mark
    expect(noReading).toHaveLength(4);    // frame only
    const mark = stopped[4];
    expect(mark.x + mark.w / 2).toBeCloseTo(X + W / 2, 9);
  });

  it('hangs ticks below the bar and puts the pin above it, never inside', () => {
    const plain = barRects({}, 0.6).rects;
    const marked = barRects({ ticks: [{ frac: 0.8 }], pin: 0.4 }, 0.6).rects;

    const extra = marked.slice(plain.length);
    expect(extra, 'a tick and a pin should add exactly two rectangles').toHaveLength(2);
    const [tick, pin] = extra;

    // THE ONE-INK CONSTRAINT BITING. A tick drawn inside the bar disappears the
    // instant the fill reaches it — same ink, no edge — and the drop-ceiling tick
    // is the exact mark the pilot needs to watch the fill approach. Outside the
    // frame the background is always black, so both marks always read.
    expect(tick.y, 'the tick is inside the bar, where the fill swallows it')
      .toBeGreaterThanOrEqual(Y + H);
    expect(pin.y + pin.h, 'the pin is inside the bar, where the fill swallows it')
      .toBeLessThanOrEqual(Y);

    // And they are at different fractions, in the bar's own domain.
    expect(tick.x).toBeGreaterThan(pin.x);
  });

  it('skips a tick with no usable fraction instead of drawing it at zero', () => {
    // FlightReadout hands dropTickFrac as null when there is no target or no
    // computed ceiling. A tick at the empty end of the scale reads as a real
    // limit of zero — "you must be stopped" — which is a wrong safety cue.
    const plain = barRects({}, 0.6).rects;
    const nullish = barRects({ ticks: [{ frac: null }, {}, { frac: NaN }], pin: null }, 0.6).rects;
    expect(nullish).toHaveLength(plain.length);
  });

  it('reads ticks and the pin in whatever domain the bar itself is in', () => {
    // Mixing a signed bar with an unsigned marker is a caller-side mistake this
    // kit refuses to paper over: the same frac must land in the same place as the
    // fill's edge does.
    const { rects, screen } = barRects({ bipolar: true, pin: -0.5 }, -0.5);
    const fill = rects[4];
    const pin = rects[rects.length - 1];
    expect(pin.x + pin.w / 2).toBeCloseTo(fill.x, 9);
    expect(screen.type.body).toBeGreaterThan(0);   // the screen really was built
  });
});

describe('PhosphorScreen — the file does not disable its own tests', () => {
  it('contains no skip or focus helper', () => {
    // The real guarantee is the module-scope throw at the top of this file, which
    // runs during collection and therefore cannot itself be skipped. This it()
    // exists so the guarantee appears by name in the test report.
    expect(SELF_DISABLES_TESTS).toBe(false);
  });
});
