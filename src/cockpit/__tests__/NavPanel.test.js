/**
 * NavPanel — lane F (cockpit-screen-content-2026-07-28), AC-NAV-BUFFER,
 * AC-NAV-CHROMELESS-SYSTEM, AC-NAV-FULL-COLOUR. AC-NAV-LEVEL-POLICY is no longer
 * this file's: the SYSTEM-only gate moved into `NavComputer` on 2026-07-29 and is
 * tested in `src/ui/__tests__/NavComputer.chromeless.test.js`.
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
 *   2. THE CHROME-LESS INTENT IS STATED EVERY PAINT, UNCONDITIONALLY, and before
 *      the source renders. It says "this host wants a bare screen wherever bare
 *      makes sense"; WHICH frames are bare is settled inside `NavComputer` at draw
 *      time. The painter used to decide that itself, from `nav.level`, and that was
 *      unsound: `render()` moves the level part-way through the frame, so the gate
 *      was fixed from a level the frame had already left behind and the first
 *      SYSTEM frame of a zoom drew fully chromed. A level read here is therefore a
 *      REGRESSION, and one of the module-scope claims below is that there is none.
 *   3. THE SOURCE IS RESIZED FROM THE PANEL. `PanelHost` rebuilds its canvases
 *      when the buffer-height knob moves; the nav source is not rebuilt with them
 *      (building one means building a NavComputer) so it has to be told, every
 *      paint, from the panel's own current size.
 *
 * ── WHAT THE ONE-INK TESTS BECAME ──────────────────────────────────────────
 *
 * This file used to assert that what reached the glass held nothing but the two
 * Phosphor colours. Max looked at the dithered nav computer on 2026-07-29 and
 * ruled it too crude for this view, so NAV — alone among the four panels — is
 * full colour now. The set-equality test is gone rather than loosened, and its
 * replacement asserts the opposite property: that the SOURCE'S OWN PIXELS reach
 * the glass unaltered. `PhosphorDither` and its test are untouched; three panels
 * still use it.
 *
 * WHAT IS NOT HERE: whether a full-colour NAV beside three one-ink panels reads
 * as one instrument or as two different devices. That is Max's gate, there are no
 * pixels in this environment and no eye to judge them with.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { makeNavPainter } from '../panels/NavPanel.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const MODULE_CODE = readFileSync(join(HERE, '..', 'panels', 'NavPanel.js'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

/**
 * Is this file disabling any of its own tests? At MODULE SCOPE and throwing —
 * measured on a sibling lane-F file, where a focus helper made the run report GREEN
 * because the self-scan was one of the tests it skipped. Comments are stripped and
 * the pattern is assembled from fragments so this header cannot match itself.
 *
 * THE PATTERN HAS TEETH IT DID NOT HAVE BEFORE. It used to be the concatenation of
 * six fixed strings, which matched `it.only` and missed everything vitest also
 * honours: the CHAINED forms above all — `it.concurrent.only`, `describe.each.only`,
 * `it.extend(...).only` — plus `todo` and `fails`. Measured, not argued: with the
 * flag write deleted from NavPanel.js and one `concurrent` focus helper on a test
 * in this file, the run reported one passed and twenty skipped, GREEN, with the
 * feature entirely absent. So the middle of the chain is now `[\w.]*` and the tail
 * is the full set of vitest's own disabling suffixes.
 */
const SELF_CODE = readFileSync(join(HERE, 'NavPanel.test.js'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');
const RUNNERS = ['describe', 'it', 'test'];
const DISABLERS = ['only', 'skip', 'todo', 'fails'];
const DISABLED_RE = new RegExp(
  '\\b(?:' + RUNNERS.join('|') + ')\\b(?:[\\w.]|\\([^()]*\\))*\\.(?:' + DISABLERS.join('|') + ')\\s*\\(',
);
if (DISABLED_RE.test(SELF_CODE)) {
  throw new Error(
    'NavPanel.test.js disables one of its own tests (a skip or focus helper is present in its ' +
    'code). A disabled test here reads as "the NAV panel draws the real nav computer, full ' +
    'colour, chrome-less at SYSTEM, and fails visibly" when nothing was checked. Remove it.',
  );
}

/**
 * ── THE SUBJECT IS PRESENT, CHECKED AT COLLECTION ──────────────────────────
 *
 * This file had no module-scope claim about NAVPANEL.JS ITSELF, only about its own
 * focus helpers, and that was the hole a focus helper walked through: every claim
 * about the subject lived inside an `it()`, so skipping the tests skipped the
 * subject too. A test file whose subject has been deleted must not be able to
 * report green, and "must not be able to" means the check has to run during
 * COLLECTION, before any skip or focus helper is honoured.
 *
 * These are the four things about `NavPanel.js` that, if they went missing, would
 * leave every remaining test in this file still passing while the feature was gone:
 *
 *   1. The intent is actually written. Without it `NavComputer.chromeless` stays at
 *      its constructor default and NAV draws with all its chrome — the symptom
 *      being "the panel looks exactly as it did before", which is the one symptom
 *      nobody investigates.
 *   2. It is written UNCONDITIONALLY. The literal `true`, not an expression: the
 *      whole correction of 2026-07-29 is that this side does not get to compute it.
 *   3. It reads no level. A `.level` read here is the race back — the value would be
 *      taken before `render()`, and `render()` moves the level mid-frame.
 *   4. It carries no second copy of the SYSTEM-only rule. There is one definition,
 *      in `NavComputer.js`, where it is applied at draw time. A copy here is a copy
 *      that can drift, and drift reads as "the file you open says one thing and the
 *      file that runs says another".
 */
const SUBJECT_CLAIMS = [
  {
    what: 'writes the chrome-less intent onto the nav computer at all',
    re: /nav\.chromeless\s*=/,
    why: 'without it the flag keeps its constructor default and NAV draws fully chromed, which ' +
      'looks exactly like the panel before this workstream existed',
  },
  {
    what: 'derives the intent from the ZOOM STATE and from nothing else',
    re: /nav\.chromeless\s*=\s*!zoomed\s*;/,
    why: 'AMENDED 2026-07-29 for increment 6. This used to pin the literal `true`, and the ' +
      'principle behind that pin is unchanged: the panel STATES an intent and never computes ' +
      'the LEVEL gate, which stays inside NavComputer and is resolved at draw time. What ' +
      'changed is which intent. Zooming has to clear chrome-lessness — Max zooms the panel in ' +
      'order to press the tab strip and the BURN button, and those hit regions are withdrawn ' +
      'while bare, which is right at rest and wrong the moment the screen is at his eye. Zoom ' +
      'state is a property of the HOST, not of the nav level, so reading it here is on the ' +
      'correct side of the render boundary in a way a level read never is',
  },
  {
    what: 'takes the zoom state from an injected accessor, not from a mover it imports',
    re: /zoomed\s*=\s*!!\s*isZoomed\s*\(\s*\)/,
    why: 'the same dependency-injection seam the nav source already uses. A painter that ' +
      'imported PanelMover would drag the scene graph into a module whose whole job is pixels, ' +
      'and would be untestable in plain node for exactly the reason NavSource documents',
  },
];
const SUBJECT_PROHIBITIONS = [
  {
    what: 'reads a level',
    re: /\.level\b/,
    why: 'NavComputer.render() moves `_levelIndex` to 4 part-way through the frame, so any level ' +
      'read taken here is fixed from the level the frame has already left — the first SYSTEM ' +
      'frame of a zoom then draws fully chromed, autopilot button rectangle and all',
  },
  {
    what: 'keeps a second copy of the SYSTEM-only rule',
    re: /navChromelessForLevel/,
    why: 'there is one definition, in NavComputer.js, where the gate is applied at draw time',
  },
  {
    what: 'imports the mover',
    re: /PanelMover/,
    why: 'the zoom state arrives as an injected accessor. Importing the mover would couple the ' +
      'painter to the scene graph and put three.js in a module that only ever touches pixels',
  },
];
{
  const missing = SUBJECT_CLAIMS.filter((c) => !c.re.test(MODULE_CODE));
  const present = SUBJECT_PROHIBITIONS.filter((c) => c.re.test(MODULE_CODE));
  if (missing.length > 0 || present.length > 0) {
    throw new Error(
      'NavPanel.js no longer matches what NavPanel.test.js is testing:\n  - ' +
      [
        ...missing.map((c) => `it no longer ${c.what} — ${c.why}`),
        ...present.map((c) => `it ${c.what} again — ${c.why}`),
      ].join('\n  - ') +
      '\n\nThis check runs at module scope, during collection, so that it cannot be turned off by ' +
      'a focus or skip helper on some other test in this file. A test file whose subject has been ' +
      'deleted must go RED, not report the tests that happen to survive.',
    );
  }
}

// ── Stand-ins ──────────────────────────────────────────────────────────────

/**
 * A PhosphorScreen-shaped kit that records what was done to it, in order.
 *
 * `clear` is recorded rather than performed, because the assertion is about the
 * ORDER of the calls — that is the thing that decides what a failed panel looks
 * like — not about pixels this environment has no way to show.
 *
 * It still offers `createImageData`, even though the painter no longer has any
 * reason to call it. That is deliberate: an intermediate surface reintroduced by
 * accident would then SHOW UP in the log rather than being invisible, and one of
 * the tests below asserts it never appears.
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

/**
 * Hang a NavComputer-shaped stub off a source, recording every write of
 * `chromeless` INTO THE SOURCE'S OWN LOG — so the assertion can be about ordering
 * against `render`, which is the property that matters. An intent written after the
 * frame has drawn arrives one paint late, and one paint late is invisible on a
 * 12.5 Hz ambient repaint.
 *
 * It also exposes `level` as a THROWING getter and a real `_bare` gate. Both are
 * traps for the same regression, from opposite sides. The painter must not read the
 * level — the value is not stable across `render()` — and it must not read the gate
 * either: the gate is the nav computer's answer about the frame it is drawing, not
 * an input to the frame. If either is ever touched again, this stub says so by
 * name instead of leaving a passing test.
 */
function withNav(source, level = 'galaxy') {
  const nav = {
    _level: level,
    _chromeless: false,
    get level() {
      throw new Error(
        'NavPanel read nav.level. The level is NOT stable across the render boundary — ' +
        'NavComputer.render() moves _levelIndex to 4 part-way through the frame — so a gate ' +
        'computed here is computed from a level the frame has already left behind.',
      );
    },
    get _bare() { return nav._chromeless && nav._level === 'system'; },
    get chromeless() { return nav._chromeless; },
    set chromeless(v) { source.log.push({ op: 'setChromeless', v }); nav._chromeless = v; },
  };
  source.nav = nav;
  return nav;
}

/** The ops of a log, as a list of names. */
const names = (log) => log.map((e) => e.op);

/** Every distinct RGBA tuple in a put surface. */
function coloursIn(surface) {
  const seen = new Set();
  for (let i = 0; i < surface.width * surface.height * 4; i += 4) {
    seen.add(`${surface.data[i]},${surface.data[i + 1]},${surface.data[i + 2]},${surface.data[i + 3]}`);
  }
  return seen;
}

// ── 0. Self-guard ──────────────────────────────────────────────────────────

describe('NavPanel.test.js — this file does not disable itself', () => {
  it('contains no skip or focus helper (also enforced at module scope)', () => {
    expect(DISABLED_RE.test(SELF_CODE)).toBe(false);
  });

  it('recognises the CHAINED focus helpers, which are the ones that got through', () => {
    // Negative controls for the instrument itself. The predecessor of this pattern
    // was six fixed strings; `it.concurrent.only` matched none of them, and that
    // one omission was enough to make this file report GREEN with the flag write
    // deleted from NavPanel.js.
    // ASSEMBLED, NEVER WRITTEN OUT. A literal here would sit in this file's own
    // source, where the module-scope scan reads it — strings are deliberately kept
    // in that view — and the file would refuse to collect while accusing itself.
    const CHAINS = ['', '.concurrent', '.sequential', '.each([1])', '.concurrent.shuffle'];
    for (const runner of RUNNERS) {
      for (const chain of CHAINS) {
        for (const suffix of DISABLERS) {
          const bad = `${runner}${chain}.${suffix}(`;
          expect(DISABLED_RE.test(bad), bad).toBe(true);
          expect(DISABLED_RE.test(`  ${bad.slice(0, -1)} (x)`), bad + ' with a space').toBe(true);
        }
      }
    }
    // And it does not fire on the ordinary shapes this file is written in, which is
    // what stops it being disabled later as a nuisance.
    for (const fine of [
      'it(', 'describe(', 'test(', 'RE.test(', 'expect(x).toBe(',
      `it${'.each([1])'}(`, 'expect(RE.test(sample), sample).toBe(true)',
      'onlySkip.todo', 'audit(fails)',
    ]) {
      expect(DISABLED_RE.test(fine), fine).toBe(false);
    }
  });

  it('goes red when its subject loses the intent write (also enforced at module scope)', () => {
    // The module-scope block above is the enforcement; this restates it by name in
    // the report and, more usefully, proves the CLAIMS THEMSELVES have teeth by
    // running them against a NavPanel.js with the write taken out.
    // ⚠ THE GUTTING PATTERN HAS TO TRACK THE SUBJECT. It was
    // `nav.chromeless = true;` before increment 6 made the intent conditional on
    // zoom. Updating a pinned-source claim is indistinguishable in a diff from
    // quietly WEAKENING one, so this control is the thing that tells them apart:
    // the amended claims must still fail against a NavPanel.js with the write
    // removed. AC-BASELINE-GREEN requires exactly this.
    const gutted = MODULE_CODE.replace(/if\s*\(\s*nav\s*\)\s*nav\.chromeless\s*=\s*!zoomed\s*;/, '');
    expect(gutted, 'the deletion did not take, so this control proves nothing').not.toBe(MODULE_CODE);
    expect(SUBJECT_CLAIMS.every((c) => c.re.test(gutted))).toBe(false);
    // And the real file satisfies every one of them.
    for (const c of SUBJECT_CLAIMS) expect(MODULE_CODE, c.what).toMatch(c.re);
    for (const c of SUBJECT_PROHIBITIONS) expect(MODULE_CODE, c.what).not.toMatch(c.re);
  });
});

// ── 1. THE ORDER ───────────────────────────────────────────────────────────

describe('the paint, in the order the failure modes require', () => {
  it('clears, sizes the source from the panel, renders, reads and puts', () => {
    const screen = makeScreen(64, 48);
    const source = makeSource(32, 24);          // deliberately the wrong size
    makeNavPainter(source)(screen, null, 0);

    expect(names(screen.log)).toEqual(['clear', 'putImageData']);
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

  it('refuses to wire without a source, rather than failing on the first repaint', () => {
    expect(() => makeNavPainter(null)).toThrow(/needs a NavSource/);
    expect(() => makeNavPainter({ render() {} })).toThrow(/needs a NavSource/);
  });
});

// ── 2. THE LEVEL GATE IS NOT HERE (AC-NAV-LEVEL-POLICY) ────────────────────
//
// There used to be a `navChromelessForLevel` in NavPanel.js and a block of tests
// here for it. Both are gone, and the deletion is the fix rather than a tidy-up.
// The gate has to be evaluated at DRAW time, inside NavComputer, because
// `render()` moves `_levelIndex` to 4 part-way through the frame — so a gate this
// file computed was computed from the level the frame had already left, and the
// first SYSTEM frame of a prism-to-system zoom drew fully chromed.
//
// The gate and its policy are now tested where they live:
// `src/ui/__tests__/NavComputer.chromeless.test.js`, against the real class and
// its real `get level()`. What is left HERE is the only claim this file can still
// make honestly: that the painter states an intent, unconditionally, before the
// frame draws, and reads nothing it has no business reading.

// ── 3. THE INTENT REACHES THE NAV COMPUTER (AC-NAV-CHROMELESS-SYSTEM) ──────

describe('the chrome-less intent is stated every paint, before the frame draws', () => {
  it('states it whatever level the computer happens to be on', () => {
    // Unconditional is the point. The panel is not claiming this frame is bare —
    // it is claiming this HOST wants bare wherever bare makes sense, and the nav
    // computer decides where that is. A conditional here is the race back.
    const screen = makeScreen(64, 48);
    for (const level of ['system', 'prism', 'region', 'sector', 'galaxy', 'unknown']) {
      const source = makeSource(64, 48);
      const nav = withNav(source, level);
      makeNavPainter(source)(screen, null, 0);
      expect(nav.chromeless, level).toBe(true);
    }
  });

  it('reads neither the level nor the gate — the stub throws if it ever does again', () => {
    // Two traps, from opposite sides. `level` is not stable across the render
    // boundary. `_bare` is the nav computer's ANSWER about the frame it is drawing,
    // so reading it here would be reading a result as though it were an input, one
    // frame stale by construction.
    const source = makeSource(64, 48);
    const nav = withNav(source, 'prism');
    let bareReads = 0;
    Object.defineProperty(nav, '_bare', { get() { bareReads++; return false; } });
    expect(() => makeNavPainter(source)(makeScreen(64, 48), null, 0)).not.toThrow();
    expect(bareReads, 'the painter read the draw-time gate').toBe(0);
  });

  it('writes it on EVERY paint, not just once at wiring time', () => {
    // The same NavComputer instance is the game's full-screen overlay under
    // main.js's future wiring, and whoever hands it over is entitled to clear the
    // flag. Re-stating it per paint means the cockpit's intent cannot be silently
    // lost between frames.
    const source = makeSource(64, 48);
    const nav = withNav(source, 'system');
    const paint = makeNavPainter(source);
    const screen = makeScreen(64, 48);
    for (let i = 0; i < 3; i++) {
      nav._chromeless = false;                 // somebody else cleared it
      paint(screen, null, i * 80);
      expect(nav.chromeless, `paint ${i}`).toBe(true);
    }
    expect(source.log.filter((e) => e.op === 'setChromeless').length).toBe(3);
  });

  it('writes it BEFORE render, so the frame it affects is this one', () => {
    // One paint late is invisible at the host's 12.5 Hz ambient repaint, and it
    // would show up as the panel keeping its chrome for one frame after entering
    // SYSTEM — which reads as a flicker nobody can reproduce.
    const source = makeSource(64, 48);
    withNav(source, 'system');
    makeNavPainter(source)(makeScreen(64, 48), null, 0);
    expect(names(source.log)).toEqual(['setChromeless', 'resize', 'render', 'readPixels']);
  });

  it('survives the level moving mid-frame, because it never looked at the level', () => {
    // THE REGRESSION THIS FILE'S HALF OF THE FIX EXISTS FOR. `render()` flips the
    // level to SYSTEM part-way through drawing. The painter has already run; if it
    // had fixed a boolean from the pre-transition level, that boolean would now be
    // wrong for the frame being drawn. An unconditional intent cannot be.
    const source = makeSource(64, 48);
    const nav = withNav(source, 'prism');
    source.render = () => {
      source.log.push({ op: 'render' });
      nav._level = 'system';                   // the mid-frame transition
      // The gate is re-read here, as NavComputer re-reads it per draw call.
      source.log.push({ op: 'bareMidFrame', v: nav._bare });
    };
    makeNavPainter(source)(makeScreen(64, 48), null, 0);
    const mid = source.log.find((e) => e.op === 'bareMidFrame');
    expect(mid.v, 'the frame that became SYSTEM mid-draw kept its chrome').toBe(true);
    expect(nav.chromeless, 'the intent changed because the level did').toBe(true);
  });

  it('paints a source that carries no nav computer at all, rather than throwing', () => {
    // `source.nav` is a public field on NavSource but it is NOT part of the duck
    // type the factory guards, and the stand-ins here go without one. No nav means
    // nothing to write the flag on, and since the flag is additive and default-off
    // that is the correct no-op — a throw would take out the panel over a
    // presentation detail.
    const screen = makeScreen(64, 48);
    const source = makeSource(64, 48);
    expect(() => makeNavPainter(source)(screen, null, 0)).not.toThrow();
    expect(names(screen.log)).toEqual(['clear', 'putImageData']);
  });
});

// ── 4. FULL COLOUR (AC-NAV-FULL-COLOUR) ────────────────────────────────────

describe('what reaches the glass is the nav computer\'s own picture, unaltered', () => {
  it('puts the very ImageData the source handed back', () => {
    // Identity, not equivalence. Anything in between — a quantiser, a tint, a
    // copy — is a place the picture can be changed without the change being
    // visible in a diff of this file.
    const screen = makeScreen(64, 48);
    const source = makeSource(64, 48);
    makeNavPainter(source)(screen, null, 0);

    const put = screen.log.at(-1);
    expect(put.op).toBe('putImageData');
    expect(put.x).toBe(0);
    expect(put.y).toBe(0);

    const again = source.readPixels();
    expect(put.surface.width).toBe(again.width);
    expect(put.surface.height).toBe(again.height);
    expect([...put.surface.data]).toEqual([...again.data]);
  });

  it('carries far more than two colours through, which is the whole reversal', () => {
    // The predecessor of this test asserted set-equality against the two Phosphor
    // colours. Max ruled the monotone too crude for this view on 2026-07-29, so
    // the assertion is inverted rather than relaxed: if this ever collapses to two
    // colours again, the dither has crept back onto NAV.
    const screen = makeScreen(64, 48);
    makeNavPainter(makeSource(64, 48))(screen, null, 0);
    expect(coloursIn(screen.log.at(-1).surface).size).toBeGreaterThan(2);
  });

  it('makes no intermediate surface — there is nothing left to write into one', () => {
    const screen = makeScreen(64, 48);
    const paint = makeNavPainter(makeSource(64, 48));
    for (let i = 0; i < 5; i++) paint(screen, null, i * 80);
    expect(screen.log.filter((e) => e.op === 'createImageData')).toEqual([]);
    expect(screen.log.filter((e) => e.op === 'putImageData').length).toBe(5);
  });

  it('says so when the source\'s pixels are not the panel\'s size', () => {
    // The dither used to compare the two and throw a named error. putImageData
    // does not: hand it the wrong size and it writes the overlap and returns,
    // leaving a nav map anchored to the top-left with black down two sides. That
    // reads as "the nav computer is drawing badly", which is the wrong place to
    // start looking, so the check is kept explicitly at the seam that lost it.
    const screen = makeScreen(64, 48);
    const source = makeSource(64, 48);
    source.resize = () => true;                       // a resize that does not take
    source.readPixels = () => ({ width: 32, height: 24, data: new Array(32 * 24 * 4).fill(0) });
    expect(() => makeNavPainter(source)(screen, null, 0)).toThrow(/32 x 24 .* 64 x 48/);
  });

  it('carries no colour literal and sets no canvas style of its own', () => {
    // The nav computer owns every colour on this panel. A literal here would be a
    // second opinion about what the map looks like, in the one file whose job is
    // to move pixels rather than choose them.
    expect(MODULE_CODE, 'a hex colour literal').not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(MODULE_CODE, 'an rgb()/hsl() literal').not.toMatch(/\b(rgba?|hsla?)\s*\(/);
    expect(MODULE_CODE, 'a 0x colour literal').not.toMatch(/0x[0-9a-fA-F]{6}/);
    expect(MODULE_CODE, 'sets a canvas style directly').not.toMatch(/fillStyle|strokeStyle/);
  });

  it('puts pixels rather than drawing an image, so nothing is resampled', () => {
    // drawImage would blur the nav computer's one-pixel orbit ellipses and its
    // smallest type at any scale but exactly 1:1, and the size guard above is what
    // makes 1:1 a fact rather than an assumption.
    expect(MODULE_CODE).toMatch(/putImageData/);
    expect(MODULE_CODE).not.toMatch(/drawImage/);
  });

  it('no longer reaches for the dither, and takes no knob to pretend it does', () => {
    // A parameter that is accepted and ignored is exactly the failure its own
    // doc-comment used to warn about — a control that appears to do nothing —
    // with the evidence hidden. It was removed, not defaulted.
    expect(MODULE_CODE).not.toMatch(/PhosphorDither|ditherToPhosphor|DEFAULT_DITHER/);
    expect(makeNavPainter.length, 'makeNavPainter still takes a second argument').toBe(1);
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
    expect(names(screen.log)).toEqual(['clear', 'putImageData']);
    expect(MODULE_CODE).not.toMatch(/snapshot\s*[.?[]/);
  });
});

// ── ZOOM CLEARS THE CHROME (cockpit-zoom-to-panel-2026-07-29) ──────────────

/**
 * Max zooms the NAV panel in order to PRESS things — the level tabs, the SYSTEM
 * sub-views, the autopilot toggle, [ BURN ] / [ WARP ]. Every one of those hit
 * regions is withdrawn while the panel is bare. That withdrawal is correct at
 * rest, where a glanceable corner screen must not carry invisible live buttons,
 * and it is exactly wrong once the screen is at his eye.
 *
 * So the zoomed state has to CLEAR `chromeless`, not merely move the mesh. These
 * tests are behavioural; the source pins above only prove the line is present.
 */
describe('the zoom clears the chrome-less intent', () => {
  it('asks for a BARE panel while at rest', () => {
    const screen = makeScreen(8, 6);
    const source = makeSource(8, 6);
    const nav = withNav(source);
    makeNavPainter(source, { isZoomed: () => false })(screen, null, 0);
    expect(nav.chromeless).toBe(true);
  });

  it('asks for a CHROMED panel while zoomed', () => {
    const screen = makeScreen(8, 6);
    const source = makeSource(8, 6);
    const nav = withNav(source);
    makeNavPainter(source, { isZoomed: () => true })(screen, null, 0);
    expect(nav.chromeless, 'the zoomed panel would have no tabs and no BURN button')
      .toBe(false);
  });

  it('defaults to bare when no accessor is supplied, so existing callers are unchanged', () => {
    const screen = makeScreen(8, 6);
    const source = makeSource(8, 6);
    const nav = withNav(source);
    makeNavPainter(source)(screen, null, 0);
    expect(nav.chromeless).toBe(true);
  });

  it('re-reads the zoom state on EVERY paint, never captures it', () => {
    // The panel is zoomed and dismissed between paints; that is the entire
    // feature. A boolean read once at wiring time freezes the panel in whichever
    // state it happened to be built in — and since it is built at rest, the
    // symptom is a zoomed panel with no controls, which reads as "the click
    // forwarding does not work" and is nothing of the sort.
    const screen = makeScreen(8, 6);
    const source = makeSource(8, 6);
    const nav = withNav(source);
    let zoomed = false;
    const paint = makeNavPainter(source, { isZoomed: () => zoomed });

    paint(screen, null, 0);
    expect(nav.chromeless).toBe(true);
    zoomed = true;
    paint(screen, null, 16);
    expect(nav.chromeless, 'the zoom state was captured at wiring time').toBe(false);
    zoomed = false;
    paint(screen, null, 32);
    expect(nav.chromeless, 'the panel never went back to bare').toBe(true);
  });

  it('writes the intent BEFORE the frame renders, zoomed as well as at rest', () => {
    // The existing ordering guarantee, re-asserted on the new path. An intent
    // written after `render()` arrives one paint late, and one paint late is
    // invisible at the 12.5 Hz ambient repaint — the panel simply shows the
    // previous state's chrome, intermittently.
    for (const zoomed of [false, true]) {
      const screen = makeScreen(8, 6);
      const source = makeSource(8, 6);
      withNav(source);
      makeNavPainter(source, { isZoomed: () => zoomed })(screen, null, 0);
      const ops = names(source.log);
      expect(ops.indexOf('setChromeless'), `zoomed=${zoomed}`).toBeGreaterThanOrEqual(0);
      expect(ops.indexOf('setChromeless'), `zoomed=${zoomed}: intent written after the frame drew`)
        .toBeLessThan(ops.indexOf('render'));
    }
  });

  it('coerces whatever the accessor returns to a real boolean', () => {
    // `chromeless` is read by `get _bare()`, which the previous workstream made
    // total specifically so a host assigning `undefined` could not hand every
    // guard a value one refactor away from being read as "not yet known".
    const screen = makeScreen(8, 6);
    const source = makeSource(8, 6);
    const nav = withNav(source);
    for (const junk of [undefined, null, 0, '', 'yes', 1, NaN]) {
      makeNavPainter(source, { isZoomed: () => junk })(screen, null, 0);
      expect(typeof nav.chromeless, `isZoomed returned ${JSON.stringify(junk)}`).toBe('boolean');
      expect(nav.chromeless).toBe(!junk);
    }
  });

  it('refuses a non-function accessor, naming it', () => {
    const source = makeSource(8, 6);
    expect(() => makeNavPainter(source, { isZoomed: true })).toThrow(/isZoomed must be a function/);
    expect(() => makeNavPainter(source, { isZoomed: 'yes' })).toThrow(/isZoomed/);
  });

  it('still reads no level and no gate on the zoomed path either', () => {
    // `withNav`'s `level` getter throws and `_bare` is the nav computer's answer
    // about the frame it is drawing, not an input to it. Both traps have to hold
    // in the zoomed state too — that is the state the whole level-gate correction
    // of 2026-07-29 was about, and it is the one nobody had exercised.
    const screen = makeScreen(8, 6);
    const source = makeSource(8, 6);
    const nav = withNav(source, 'system');
    let bareReads = 0;
    Object.defineProperty(nav, '_bare', { get() { bareReads++; return false; } });
    expect(() => makeNavPainter(source, { isZoomed: () => true })(screen, null, 0)).not.toThrow();
    expect(bareReads, 'the painter read the nav computer\'s own draw-time verdict').toBe(0);
  });
});

