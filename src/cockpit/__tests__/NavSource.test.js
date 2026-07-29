/**
 * NavSource — lane F (cockpit-screen-content-2026-07-28), AC-NAV-BUFFER.
 *
 * ── THE ONE THING THIS FILE IS FOR ──────────────────────────────────────────
 *
 * `NavComputer.render()`'s first statement is `this._resizeCanvas()`, and that
 * method assigns `canvas.width` / `canvas.height` from
 * `getBoundingClientRect()`. On a panel canvas — which has no layout box — that
 * rect is 0 x 0, so the nav computer's first act every frame is to destroy its
 * own buffer.
 *
 * The failure this produces is the reason AC-NAV-BUFFER's live check takes TWO
 * SAMPLES FIVE SECONDS APART. An implementation that sets the size once at setup
 * reads correct on the first sample — non-zero buffer, ink on the glass — and
 * 0 x 0 with zero ink on the second. So the test below does not check that the
 * buffer is right; it checks that the buffer is STILL right after being rendered
 * hundreds of times, which is the only form of the question that can fail.
 *
 * ── WHY THE SUBJECT IS A STUB, AND WHY THAT IS NOT A DODGE ──────────────────
 *
 * A real `NavComputer` CANNOT be constructed here, by any arrangement. Its
 * constructor calls `canvas.getContext('2d')` and registers seven DOM event
 * listeners, and this repo's vitest runs in plain node with no jsdom, no
 * happy-dom and no node-canvas. That is a fact about the repo, not a choice made
 * in this file.
 *
 * So the subject is `NavComputerStub` below — a CLASS, so that `_resizeCanvas`
 * sits on the PROTOTYPE exactly where NavComputer's does, which is what makes
 * "an own property shadows it" a real claim rather than a shape coincidence. Its
 * `_resizeCanvas` is transcribed from NavComputer's, including the guard, and its
 * `render()` calls it first, as NavComputer's does. Its "drawing" writes an ink
 * count proportional to the buffer, so a collapsed buffer produces ZERO INK — the
 * same observable AC-NAV-BUFFER reads live.
 *
 * The NEGATIVE CONTROL is therefore load-bearing and comes first: the stub, left
 * alone, must collapse. Without that, every assertion about the override
 * surviving would be a test of a stub that never had the disease.
 *
 * ── WHAT IS ONLY VERIFIABLE LIVE, said plainly ──────────────────────────────
 *
 * That the real NavComputer draws anything at all through this class; that the
 * galaxy renderer, the star loading and the level tabs behave when the canvas is
 * detached; that any of it READS as a phosphor CRT once dithered. None of those
 * are here and none of them could be. They are Max's, on the glass.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { NavSource } from '../NavSource.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const MODULE_CODE = readFileSync(join(HERE, '..', 'NavSource.js'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

/**
 * Is this file disabling any of its own tests?
 *
 * At MODULE SCOPE and throwing, because that placement was measured rather than
 * assumed on a sibling lane-F file: an `it.only` made vitest report the run GREEN,
 * since the self-scan was one of the tests it skipped. Module scope runs during
 * collection, before any focus helper can be honoured. Comments are stripped and
 * the pattern is assembled from fragments so this header can discuss the helpers
 * without matching itself.
 */
const SELF_CODE = readFileSync(join(HERE, 'NavSource.test.js'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');
const DISABLED_RE = new RegExp(
  ['describe', 'it', 'test'].flatMap((k) => [k + '\\.skip', k + '\\.only']).join('|'),
);
if (DISABLED_RE.test(SELF_CODE)) {
  throw new Error(
    'NavSource.test.js disables one of its own tests (a skip or focus helper is present in its ' +
    'code). This file is the whole of the buffer guarantee for the NAV panel — the failure it ' +
    'guards reads perfectly on its first frame and dies seconds later — so a disabled test here ' +
    'reads as "the nav computer keeps drawing" when nothing was checked. Remove it.',
  );
}

// ── The NavComputer-shaped stub ────────────────────────────────────────────

/**
 * A canvas with NO LAYOUT BOX, which is what a panel canvas is.
 *
 * Two behaviours are modelled and both are real, not conveniences:
 *
 *  - `getBoundingClientRect()` returns 0 x 0. Not because this stub is being
 *    awkward — that is what a real detached canvas reports, and it is the single
 *    fact the whole module is shaped around.
 *  - ASSIGNING `width` OR `height` WIPES THE SURFACE. `ink` drops to zero on
 *    either assignment, because a real canvas resets every pixel and every
 *    context setting when its buffer size is written, even when the value written
 *    is the one it already had. That is the exact reason both size-setting paths
 *    in NavSource compare before they assign, so a stub with a plain data
 *    property would leave those guards untestable.
 */
function makeDetachedCanvas() {
  let width = 0;
  let height = 0;
  return {
    /** Ink laid down by the last "render". Zero means the panel is dark. */
    ink: 0,
    get width() { return width; },
    set width(v) { width = v; this.ink = 0; },
    get height() { return height; },
    set height(v) { height = v; this.ink = 0; },
    getBoundingClientRect() { return { left: 0, top: 0, width: 0, height: 0 }; },
    getContext() { return this._ctx ?? (this._ctx = { getImageData: () => ({}) }); },
  };
}

/**
 * Shaped like NavComputer where it matters, and no further.
 *
 * A class rather than an object literal, deliberately: `_resizeCanvas` has to be
 * a PROTOTYPE method for the own-property-shadowing claim to mean anything.
 */
class NavComputerStub {
  constructor(canvas) {
    this._canvas = canvas;
    /** Every frame's buffer size, in order — the record the assertions read. */
    this.frames = [];
    this.disposed = false;
  }

  /** Transcribed from NavComputer._resizeCanvas, guard included. */
  _resizeCanvas() {
    const rect = this._canvas.getBoundingClientRect();
    if (this._canvas.width !== rect.width || this._canvas.height !== rect.height) {
      this._canvas.width = rect.width;
      this._canvas.height = rect.height;
    }
  }

  /** As NavComputer's does, this calls _resizeCanvas FIRST and then draws. */
  render() {
    this._resizeCanvas();
    const w = this._canvas.width;
    const h = this._canvas.height;
    // "Ink": a zero-sized buffer can hold none, which is exactly the observable
    // AC-NAV-BUFFER reads live — ink coverage greater than zero on BOTH samples.
    this._canvas.ink = w * h;
    this.frames.push({ w, h, ink: this._canvas.ink });
  }

  dispose() { this.disposed = true; }
}

/** A stub plus its canvas, un-hosted. */
function makeStub() {
  const canvas = makeDetachedCanvas();
  return { canvas, nav: new NavComputerStub(canvas) };
}

/** A stub hosted by a NavSource at the given buffer size. */
function makeHosted(width = 614, height = 512) {
  const { canvas, nav } = makeStub();
  const source = new NavSource(nav, { width, height, canvas });
  return { canvas, nav, source };
}

// ── 0. The self-guard and the negative control ─────────────────────────────

describe('NavSource.test.js — this file does not disable itself', () => {
  it('contains no skip or focus helper (also enforced at module scope)', () => {
    expect(DISABLED_RE.test(SELF_CODE)).toBe(false);
  });
});

describe('the stub really has the disease — without this every test below is vacuous', () => {
  it('collapses to a zero buffer with zero ink on its very first render', () => {
    const { canvas, nav } = makeStub();
    canvas.width = 614;
    canvas.height = 512;          // somebody injected the size at setup…
    nav.render();                 // …and then one frame happened.
    expect(canvas.width).toBe(0);
    expect(canvas.height).toBe(0);
    expect(canvas.ink).toBe(0);
  });

  it('reads CORRECT if you only look before the first render — the trap, exactly', () => {
    // This is the shape of the mistake AC-NAV-BUFFER's two-sample check exists to
    // catch: sample the buffer at setup and everything looks right.
    const { canvas } = makeStub();
    canvas.width = 614;
    canvas.height = 512;
    expect([canvas.width, canvas.height]).toEqual([614, 512]);
  });
});

// ── 1. THE OVERRIDE SURVIVES REPEATED RENDERS ──────────────────────────────

describe('the buffer holds across many renders, which is the only form of the question', () => {
  it('never once collapses across 500 renders, and lays ink on every one', () => {
    const { canvas, nav, source } = makeHosted(614, 512);

    for (let i = 0; i < 500; i++) {
      source.render();
      // Asserted INSIDE the loop, not after. A check only at the end would pass
      // on an implementation that collapsed for 499 frames and happened to be
      // repaired on the last one.
      expect([canvas.width, canvas.height], `frame ${i}`).toEqual([614, 512]);
      expect(canvas.ink, `frame ${i} drew no ink`).toBeGreaterThan(0);
    }

    expect(nav.frames.length).toBe(500);
    // Every frame the nav computer itself saw was full-sized, too — the override
    // ran BEFORE the drawing, not after it.
    for (const f of nav.frames) expect([f.w, f.h, f.ink > 0]).toEqual([614, 512, true]);
  });

  it('installs the override as an OWN property, shadowing the prototype method', () => {
    const { nav } = makeHosted();
    expect(Object.prototype.hasOwnProperty.call(nav, '_resizeCanvas')).toBe(true);
    // The prototype's version is untouched: hosting must not require editing
    // NavComputer, and the full-screen overlay still depends on that method.
    expect(typeof NavComputerStub.prototype._resizeCanvas).toBe('function');
    expect(nav._resizeCanvas).not.toBe(NavComputerStub.prototype._resizeCanvas);
  });

  it('holds the buffer even after something else zeroes the canvas mid-flight', () => {
    // Self-healing, not merely once-installed. Anything that resets the canvas
    // between renders is undone by the next one.
    const { canvas, source } = makeHosted(320, 256);
    source.render();
    canvas.width = 0;
    canvas.height = 0;
    source.render();
    expect([canvas.width, canvas.height]).toEqual([320, 256]);
    expect(canvas.ink).toBeGreaterThan(0);
  });

  it('sizes the buffer before the first render, so frame one is not blank', () => {
    const { canvas } = makeHosted(200, 150);
    expect([canvas.width, canvas.height]).toEqual([200, 150]);
  });
});

// ── 2. THE OVERRIDE IS WHAT IS DOING IT ────────────────────────────────────

describe('the override is load-bearing, not incidental', () => {
  it('collapses again the moment dispose() takes it back off', () => {
    // The pair of this and the 500-render test is the actual proof: the buffer
    // holds with the override and dies without it, on the same stub.
    const { canvas, nav, source } = makeHosted(614, 512);
    source.render();
    expect(canvas.width).toBe(614);

    source.dispose();
    expect(Object.prototype.hasOwnProperty.call(nav, '_resizeCanvas')).toBe(false);

    nav.render();
    expect(canvas.width).toBe(0);
    expect(canvas.ink).toBe(0);
  });

  it('says so by name when the override has been removed under it', () => {
    // A collapsed buffer with a silent console is the hardest version of this bug
    // to find. PanelHost logs a painter's throw once, naming the panel, so this
    // message is the only place a cause is ever attached.
    const { nav, source } = makeHosted();
    delete nav._resizeCanvas;
    expect(() => source.render()).toThrow(/buffer collapsed to 0 x 0/);
  });

  it('restores an override that was already there, rather than deleting it', () => {
    const { canvas, nav } = makeStub();
    const previous = () => { canvas.width = 1; canvas.height = 1; };
    nav._resizeCanvas = previous;
    const source = new NavSource(nav, { width: 64, height: 64, canvas });
    expect(nav._resizeCanvas).not.toBe(previous);
    source.dispose();
    expect(nav._resizeCanvas).toBe(previous);
  });

  it('is idempotent on teardown, because teardown paths get called twice', () => {
    const { nav, source } = makeHosted();
    source.dispose();
    expect(() => source.dispose()).not.toThrow();
    expect(nav.disposed).toBe(true);
    expect(source.render()).toBe(false);
  });
});

// ── 3. RESIZE — the buffer-resolution knob ─────────────────────────────────

describe('resize moves the pin, because PanelHost rebuilds its canvases', () => {
  it('holds the NEW size across many renders after a resize', () => {
    const { canvas, source } = makeHosted(614, 512);
    for (let i = 0; i < 20; i++) source.render();
    expect(source.resize(1229, 1024)).toBe(true);
    for (let i = 0; i < 200; i++) {
      source.render();
      expect([canvas.width, canvas.height], `frame ${i} after resize`).toEqual([1229, 1024]);
    }
  });

  it('does nothing at all when handed the size it already has', () => {
    // Assigning canvas.width RESETS the canvas — every pixel and every context
    // setting — so a resize that fired unconditionally would blank the panel on
    // every paint, which reads as a flicker with no cause.
    const { canvas, source } = makeHosted(614, 512);
    source.render();
    const inkBefore = canvas.ink;
    expect(inkBefore, 'the stub drew nothing, so the check below would be vacuous').toBeGreaterThan(0);
    // The substantive claim comes first: the surface was not touched. The return
    // value is the corroborator, not the other way round.
    const changed = source.resize(614, 512);
    expect(canvas.ink, 'a same-size resize wiped the canvas').toBe(inkBefore);
    expect(changed).toBe(false);
  });

  it('refuses a zero or non-finite size rather than pinning the buffer to nothing', () => {
    const { source } = makeHosted();
    for (const bad of [[0, 512], [614, 0], [NaN, 512], [614, Infinity]]) {
      expect(() => source.resize(bad[0], bad[1]), JSON.stringify(bad)).toThrow(/positive and finite/);
    }
  });
});

// ── 4. CONSTRUCTION AND MOUNTING ───────────────────────────────────────────

describe('construction refuses the states that would leave a panel silently dark', () => {
  it('needs something with a render()', () => {
    expect(() => new NavSource(null, { width: 8, height: 8 })).toThrow(/render\(\)/);
    expect(() => new NavSource({ _canvas: {} }, { width: 8, height: 8 })).toThrow(/render\(\)/);
  });

  it('needs a canvas, from the instance or from the caller', () => {
    expect(() => new NavSource({ render() {} }, { width: 8, height: 8 })).toThrow(/no _canvas/);
  });

  it('needs a positive buffer size', () => {
    const { canvas, nav } = makeStub();
    expect(() => new NavSource(nav, { width: 0, height: 8, canvas })).toThrow(/positive and finite/);
  });

  it('mounts a canvas, builds the nav computer on it, and pins it', () => {
    const made = [];
    const source = NavSource.mount({
      width: 614,
      height: 512,
      makeCanvas: (w, h) => {
        const c = makeDetachedCanvas();
        c.width = w; c.height = h;
        made.push(c);
        return c;
      },
      makeNav: (canvas) => {
        // The size must already be right here: NavComputer's constructor is
        // handed the canvas, and anything it reads off it reads now.
        expect([canvas.width, canvas.height]).toEqual([614, 512]);
        return new NavComputerStub(canvas);
      },
    });

    expect(made.length).toBe(1);
    for (let i = 0; i < 100; i++) source.render();
    expect([made[0].width, made[0].height]).toEqual([614, 512]);
    expect(made[0].ink).toBeGreaterThan(0);
  });

  it('refuses a canvas factory that returned the wrong size', () => {
    expect(() => NavSource.mount({
      width: 614,
      height: 512,
      makeCanvas: () => { const c = makeDetachedCanvas(); c.width = 256; c.height = 256; return c; },
      makeNav: (canvas) => new NavComputerStub(canvas),
    })).toThrow(/expected 614 x 512/);
  });

  it('refuses to mount without a nav factory, rather than importing NavComputer itself', () => {
    expect(() => NavSource.mount({ width: 8, height: 8 })).toThrow(/makeNav/);
  });
});

// ── 5. THE SEAMS THAT KEEP IT TESTABLE AND OUT OF THE SHIP'S CONTROLS ──────

describe('what this module deliberately does not do', () => {
  it('never imports NavComputer, so a test can reach this file at all', () => {
    // A static import would drag four thousand lines and a DOM constructor into
    // every test that touches this module — and none of it could run.
    expect(MODULE_CODE).not.toMatch(/from\s+['"][^'"]*NavComputer/);
  });

  it('never calls activate(), which would eat the ship\'s W A S D R F keys', () => {
    // NavComputer.activate() registers keydown/keyup on `document` in the CAPTURE
    // phase and preventDefaults those six letters. A panel that is merely VISIBLE
    // must not take the pilot's throttle.
    expect(MODULE_CODE).not.toMatch(/\.activate\s*\(/);
    expect(MODULE_CODE).not.toMatch(/addEventListener/);
  });

  it('reads pixels through the canvas it pinned, at the pinned size', () => {
    const { canvas, source } = makeHosted(40, 30);
    const asked = [];
    canvas.getContext = () => ({ getImageData: (...a) => { asked.push(a); return { width: 40, height: 30 }; } });
    source.render();
    source.readPixels();
    expect(asked).toEqual([[0, 0, 40, 30]]);
  });

  it('says so when the pinned canvas has no 2d context to read', () => {
    const { canvas, source } = makeHosted();
    canvas.getContext = () => null;
    expect(() => source.readPixels()).toThrow(/no 2d context/);
  });
});
