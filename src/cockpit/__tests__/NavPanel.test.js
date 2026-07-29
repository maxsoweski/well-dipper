/**
 * NavPanel — lane F (cockpit-screen-content-2026-07-28), AC-NAV-BUFFER.
 *
 * ── WHAT CAN BE TESTED HERE, AND WHY MORE THAN YOU WOULD EXPECT ─────────────
 *
 * The NAV painter cannot render a real nav computer in this environment — that
 * needs a DOM this repo's vitest does not have, and `NavSource.test.js` says so
 * at length. What it CAN be driven with is a stand-in source and a stand-in kit,
 * because this painter reaches for nothing global: it is handed a
 * `PhosphorScreen`-shaped object and a `NavSource`-shaped object and does five
 * things with them in a fixed order.
 *
 * That order is the subject, and it is not bookkeeping. Three of the five steps
 * exist to stop a specific failure that has a name:
 *
 *   1. `clear()` COMES FIRST, before anything that can throw. `PanelHost` catches
 *      a painter's throw, logs it once naming the panel, and leaves that screen
 *      as it was. So a painter that cleared LAST would leave a failed NAV panel
 *      showing its last good nav map — still legible, no longer true, and
 *      indistinguishable at a glance from a working one. Clearing first turns
 *      that into a black panel with a cause in the log.
 *   2. THE KNOB IS READ EVERY PAINT. The dither setting is the thing Max is
 *      judging, swept while he watches the glass. A value captured at wiring time
 *      would make the control appear to do nothing — the one failure that would
 *      waste the whole exercise.
 *   3. THE SOURCE IS RESIZED FROM THE PANEL. `PanelHost` rebuilds its canvases
 *      when the buffer-height knob moves; the nav source is not rebuilt with them
 *      (building one means building a NavComputer) so it has to be told, every
 *      paint, from the panel's own current size.
 *
 * WHAT IS NOT HERE: whether the dithered nav computer reads as a CRT. That is the
 * whole question the H4 fork exists to answer, it is Max's gate, and there are no
 * pixels in this environment and no eye to judge them with.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { makeNavPainter } from '../panels/NavPanel.js';
import { PHOSPHOR_RGB } from '../PhosphorDither.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const MODULE_CODE = readFileSync(join(HERE, '..', 'panels', 'NavPanel.js'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

/**
 * Is this file disabling any of its own tests? At MODULE SCOPE and throwing —
 * measured on a sibling lane-F file, where an `it.only` made the run report GREEN
 * because the self-scan was one of the tests it skipped. Comments are stripped and
 * the pattern is assembled from fragments so this header cannot match itself.
 */
const SELF_CODE = readFileSync(join(HERE, 'NavPanel.test.js'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');
const DISABLED_RE = new RegExp(
  ['describe', 'it', 'test'].flatMap((k) => [k + '\\.skip', k + '\\.only']).join('|'),
);
if (DISABLED_RE.test(SELF_CODE)) {
  throw new Error(
    'NavPanel.test.js disables one of its own tests (a skip or focus helper is present in its ' +
    'code). A disabled test here reads as "the NAV panel draws the real nav computer, one ink, ' +
    'and fails visibly" when nothing was checked. Remove it.',
  );
}

// ── Stand-ins ──────────────────────────────────────────────────────────────

/**
 * A PhosphorScreen-shaped kit that records what was done to it, in order.
 *
 * `clear` is recorded rather than performed, because the assertion is about the
 * ORDER of the calls — that is the thing that decides what a failed panel looks
 * like — not about pixels this environment has no way to show.
 */
function makeScreen(width = 64, height = 48) {
  const log = [];
  return {
    width,
    height,
    log,
    clear() { log.push({ op: 'clear' }); },
    ctx: {
      createImageData(w, h) {
        log.push({ op: 'createImageData', w, h });
        return { width: w, height: h, data: new Array(w * h * 4).fill(0) };
      },
      putImageData(surface, x, y) {
        log.push({ op: 'putImageData', surface, x, y });
      },
    },
  };
}

/** A NavSource-shaped stand-in over a fixed picture. */
function makeSource(width = 64, height = 48, shade = (x, y) => [(x * 4) % 256, (y * 4) % 256, 128]) {
  const log = [];
  const src = {
    width,
    height,
    log,
    resize(w, h) { log.push({ op: 'resize', w, h }); src.width = w; src.height = h; return true; },
    render() { log.push({ op: 'render' }); },
    readPixels() {
      log.push({ op: 'readPixels' });
      const data = new Array(src.width * src.height * 4);
      for (let y = 0; y < src.height; y++) {
        for (let x = 0; x < src.width; x++) {
          const [r, g, b] = shade(x, y);
          const i = (y * src.width + x) * 4;
          data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255;
        }
      }
      return { width: src.width, height: src.height, data };
    },
  };
  return src;
}

/** The ops of a log, as a list of names. */
const names = (log) => log.map((e) => e.op);

/** What fraction of a put surface is ink. */
function inkFraction(surface) {
  let lit = 0;
  const n = surface.width * surface.height;
  for (let p = 0; p < n; p++) if (surface.data[p * 4] === PHOSPHOR_RGB.INK[0]) lit += 1;
  return lit / n;
}

// ── 0. Self-guard ──────────────────────────────────────────────────────────

describe('NavPanel.test.js — this file does not disable itself', () => {
  it('contains no skip or focus helper (also enforced at module scope)', () => {
    expect(DISABLED_RE.test(SELF_CODE)).toBe(false);
  });
});

// ── 1. THE ORDER ───────────────────────────────────────────────────────────

describe('the paint, in the order the failure modes require', () => {
  it('clears, sizes the source from the panel, renders, reads and puts', () => {
    const screen = makeScreen(64, 48);
    const source = makeSource(32, 24);          // deliberately the wrong size
    makeNavPainter(source)(screen, null, 0);

    expect(names(screen.log)).toEqual(['clear', 'createImageData', 'putImageData']);
    expect(names(source.log)).toEqual(['resize', 'render', 'readPixels']);
    // The size came off the PANEL, never a constant — that is what carries the
    // measured-from-the-mesh buffer shape through to the nav picture.
    expect(source.log[0]).toMatchObject({ w: 64, h: 48 });
  });

  it('clears the glass BEFORE anything that can throw, so a failed panel goes black', () => {
    // The alternative leaves a legible, out-of-date nav map on the glass, which
    // is the failure this workstream keeps guarding against: a panel that looks
    // like it is working.
    const screen = makeScreen();
    const source = makeSource();
    source.render = () => { throw new Error('galaxy renderer is gone'); };

    expect(() => makeNavPainter(source)(screen, null, 0)).toThrow(/galaxy renderer is gone/);
    expect(names(screen.log)).toEqual(['clear']);
  });

  it('lets the throw out rather than catching it, because PanelHost does the reporting', () => {
    // A catch here would swallow the error before the one place that logs it ever
    // saw it, and the host would then mark the panel painted and re-upload an
    // unchanged texture forever with nothing on the console.
    const source = makeSource();
    source.readPixels = () => { throw new Error('no 2d context'); };
    expect(() => makeNavPainter(source)(makeScreen(), null, 0)).toThrow(/no 2d context/);
    // A catch STATEMENT — `catch (err)` or `catch {` — not the bare word, which
    // appears in an error message that explains PanelHost's catch. Comments are
    // stripped from the scan but strings are not, and they should not be: a
    // message that names the mechanism is exactly what we want kept.
    expect(MODULE_CODE, 'the painter catches its own errors').not.toMatch(/\bcatch\s*[({]/);
  });
});

// ── 2. THE KNOB REACHES THE GLASS ──────────────────────────────────────────

describe('the dither knob is read fresh every paint', () => {
  it('changes what is drawn when the knob moves between paints', () => {
    // The whole point of the control is that Max sweeps it while looking at the
    // glass. A setting captured at wiring time is a slider that does nothing.
    const screen = makeScreen(64, 48);
    const source = makeSource(64, 48, () => [128, 128, 128]);
    let knob = { threshold: 0, gamma: 0.5 };
    const paint = makeNavPainter(source, () => knob);

    paint(screen, null, 0);
    const bright = inkFraction(screen.log.at(-1).surface);

    knob = { threshold: 0, gamma: 4 };
    paint(screen, null, 16);
    const dark = inkFraction(screen.log.at(-1).surface);

    expect(bright, 'the knob did not reach the glass').toBeGreaterThan(dark);
    expect(dark).toBeGreaterThan(0);
  });

  it('refuses a knob that is not a function, at wiring time', () => {
    expect(() => makeNavPainter(makeSource(), { threshold: 0.2 })).toThrow(/must be a function/);
  });

  it('refuses to wire without a source, rather than failing on the first repaint', () => {
    expect(() => makeNavPainter(null)).toThrow(/needs a NavSource/);
    expect(() => makeNavPainter({ render() {} })).toThrow(/needs a NavSource/);
  });
});

// ── 3. THE OUTPUT SURFACE ──────────────────────────────────────────────────

describe('the dithered surface is reused, and remade when the panel is', () => {
  it('allocates once across many paints at one size', () => {
    // A full RGBA buffer the size of the panel, allocated per repaint, is real
    // garbage on the paint path for a buffer that is overwritten every time.
    const screen = makeScreen(64, 48);
    const source = makeSource(64, 48);
    const paint = makeNavPainter(source);
    for (let i = 0; i < 25; i++) paint(screen, null, i * 80);
    expect(screen.log.filter((e) => e.op === 'createImageData').length).toBe(1);
    expect(screen.log.filter((e) => e.op === 'putImageData').length).toBe(25);
  });

  it('makes a new one when the panel is rebuilt at another buffer height', () => {
    // A cache that only asked "have we made one yet" would hand back a surface of
    // the old size, and the dither would reject it — correctly, but only after the
    // panel had already stopped drawing.
    const source = makeSource(64, 48);
    const paint = makeNavPainter(source);

    const small = makeScreen(64, 48);
    paint(small, null, 0);
    const large = makeScreen(128, 96);
    paint(large, null, 80);

    expect(large.log.filter((e) => e.op === 'createImageData')).toEqual([
      { op: 'createImageData', w: 128, h: 96 },
    ]);
    expect(large.log.at(-1).surface.width).toBe(128);
  });

  it('says so when the panel context cannot make one', () => {
    const screen = makeScreen();
    screen.ctx.createImageData = undefined;
    expect(() => makeNavPainter(makeSource())(screen, null, 0)).toThrow(/createImageData/);
  });
});

// ── 4. ONE INK ─────────────────────────────────────────────────────────────

describe('what reaches the glass is one ink on black', () => {
  it('puts a surface holding nothing but the two Phosphor colours', () => {
    const screen = makeScreen(64, 48);
    const paint = makeNavPainter(makeSource(64, 48));
    paint(screen, null, 0);

    const { surface } = screen.log.at(-1);
    const seen = new Set();
    for (let i = 0; i < surface.width * surface.height * 4; i += 4) {
      seen.add(`${surface.data[i]},${surface.data[i + 1]},${surface.data[i + 2]},${surface.data[i + 3]}`);
    }
    const ink = `${PHOSPHOR_RGB.INK.join(',')},255`;
    const back = `${PHOSPHOR_RGB.BACK.join(',')},255`;
    expect([...seen].sort()).toEqual([back, ink].sort());
  });

  it('carries no colour literal and sets no canvas style of its own', () => {
    expect(MODULE_CODE, 'a hex colour literal').not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(MODULE_CODE, 'an rgb()/hsl() literal').not.toMatch(/\b(rgba?|hsla?)\s*\(/);
    expect(MODULE_CODE, 'a 0x colour literal').not.toMatch(/0x[0-9a-fA-F]{6}/);
    expect(MODULE_CODE, 'sets a canvas style directly').not.toMatch(/fillStyle|strokeStyle/);
  });

  it('puts pixels rather than drawing an image, so nothing is smoothed into grey', () => {
    // drawImage would blend neighbouring ink and background under any smoothing or
    // transform, and a blend of the two colours is a THIRD colour.
    expect(MODULE_CODE).toMatch(/putImageData/);
    expect(MODULE_CODE).not.toMatch(/drawImage/);
  });

  it('shows no holding card and reads nothing from the snapshot', () => {
    // A plausible-looking placeholder on NAV is exactly how "the nav computer is
    // live from the first frame" gets ticked off by mistake, and a painter that
    // wrote nav state from the snapshot would be calling setPlayerPosition — which
    // resets the prism's star loading — on the drawing path.
    const screen = makeScreen();
    const source = makeSource();
    const paint = makeNavPainter(source);
    const snapshot = { nav: { level: 'prism' }, system: { name: 'Nowhere' } };
    paint(screen, snapshot, 0);
    expect(names(screen.log)).toEqual(['clear', 'createImageData', 'putImageData']);
    expect(MODULE_CODE).not.toMatch(/snapshot\s*[.?[]/);
  });
});
