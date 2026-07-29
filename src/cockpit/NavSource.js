/**
 * NavSource — hosting the real nav computer on a cockpit CRT.
 *
 * Lane F, workstream `cockpit-screen-content-2026-07-28`, AC-NAV-BUFFER.
 *
 * ── WHAT THIS OWNS ─────────────────────────────────────────────────────────
 *
 * One `NavComputer`, one canvas of its own at the NAV panel's buffer size, and
 * the single piece of surgery that lets the first draw into the second FOREVER
 * rather than for about five seconds. It draws nothing itself and knows nothing
 * about Phosphor: the picture it produces is full colour, and what happens to it
 * afterwards is the NAV painter's business. (It used to be quantised to one ink
 * by `PhosphorDither`; Max ruled the monotone too crude for the nav view on
 * 2026-07-29 and NAV now goes to the glass in colour. Nothing in THIS file
 * changed with that, which is the point of the separation.) This file's only
 * subject is the buffer.
 *
 * ── THE TRAP, WHICH IS THE WHOLE REASON THIS FILE EXISTS ────────────────────
 *
 * `NavComputer.render()`'s FIRST statement is `this._resizeCanvas()`, and
 * `_resizeCanvas` is:
 *
 *     const rect = this._canvas.getBoundingClientRect();
 *     if (this._canvas.width !== rect.width || ...) {
 *       this._canvas.width = rect.width; this._canvas.height = rect.height;
 *     }
 *
 * That is correct for the full-screen overlay it was written for, where the
 * canvas is a laid-out page element and the rect is its CSS box. A PANEL canvas
 * is not a page element. It has no layout box, so `getBoundingClientRect()`
 * reports 0 x 0, and the very first thing every render does is set the drawing
 * buffer to ZERO BY ZERO.
 *
 * The specific shape of the failure is what makes it worth a whole acceptance
 * criterion. An implementation that sets `canvas.width = 614` once at setup
 * WORKS. It works on the first frame, it works when you screenshot it, and it
 * works when you evaluate the buffer size a moment later — because the size was
 * injected and the first render has not necessarily happened yet. It then
 * collapses to 0 x 0 with ZERO INK on the next render and stays there. A
 * one-sample check reads green; the panel is dead. AC-NAV-BUFFER's live check is
 * TWO SAMPLES FIVE SECONDS APART for exactly this reason.
 *
 * ── HOW IT IS NEUTRALISED, AND WHY THIS TECHNIQUE ───────────────────────────
 *
 * An OWN PROPERTY on the instance shadows the prototype method. So this class
 * assigns its own `_resizeCanvas` onto the NavComputer it is given, and that
 * function re-asserts the panel's buffer size instead of reading a layout box.
 * `render()` calls `this._resizeCanvas()` and gets ours, EVERY TIME — which is
 * the property that matters, because anything done once at setup is by
 * definition not done on the four-hundredth render.
 *
 * This is the same technique `PanelPointer` already uses on `_getCanvasPos`, and
 * for the same underlying reason: both prototype methods reach for
 * `getBoundingClientRect` on a canvas that has no box. Its header states the
 * general form of the argument; this is the second instance of it. The two are
 * deliberately NOT merged into one "de-DOM the nav computer" helper — they are
 * installed by different owners at different times (the pointer adapter attaches
 * and detaches around input; this one lives for as long as the panel does), and
 * a single installer would have to be both.
 *
 * WHAT IT IS NOT: it is not an edit to `src/ui/NavComputer.js`. That file is
 * live — the game's full-screen overlay is still built on it — and hosting it
 * must not require changing it. Every accommodation is made from OUT HERE.
 *
 * The override is also SELF-HEALING rather than merely one-time: it compares and
 * re-assigns on every call, so if anything else ever zeroes the canvas between
 * renders, the next render restores it. Only when the override is missing
 * altogether does the buffer collapse, and `render()` checks for exactly that
 * afterwards — see below.
 *
 * ── WHY THE NAV COMPUTER IS INJECTED AND NOT IMPORTED ───────────────────────
 *
 * This module does not import `NavComputer`. It takes an object shaped like one.
 * That is not abstraction for its own sake — it is the only way any of this can
 * be tested at all. `NavComputer`'s constructor calls `canvas.getContext('2d')`
 * and adds seven DOM event listeners, and this repo's vitest runs in plain node
 * with no jsdom, no happy-dom and no node-canvas. A real NavComputer therefore
 * CANNOT BE CONSTRUCTED IN A TEST, at any depth, by any arrangement. What can be
 * tested — and is — is that this class's override survives many renders against
 * a NavComputer-SHAPED STUB whose own `_resizeCanvas` would zero the buffer.
 *
 * Everything else about hosting the real thing is only verifiable live, on the
 * glass, and the report for this work says so in as many words.
 *
 * ── DELIBERATE NON-GOALS ────────────────────────────────────────────────────
 *
 *   - IT DOES NOT CALL `activate()`. `NavComputer.activate()` registers keydown
 *     and keyup on `document` in the CAPTURE phase and swallows W, A, S, D, R and
 *     F — which are the ship's own controls. A cockpit panel that is merely
 *     VISIBLE must not eat the pilot's throttle. Rendering needs none of it:
 *     `activate()` only wires input and opens the search overlay. (The overlay is
 *     a non-issue anyway — `_ensureSearchDom` returns early when the canvas has
 *     no `parentElement`, which a detached panel canvas never does. That is a
 *     happy accident, not a guarantee, so it is not relied on.)
 *   - IT DOES NOT DRIVE INPUT. `PanelPointer.PanelPointerAdapter` is the piece
 *     that turns a raycast hit into a press, a drag and a release on this same
 *     instance. Two files, two seams, neither reimplementing the other.
 *   - IT DECIDES NOTHING ABOUT PHOSPHOR. No palette, no threshold, no ink. The
 *     canvas it exposes is the nav computer's own full-colour picture.
 *   - IT SETS NO REPAINT RATE. `PanelHost` owns the repaint tier for all four
 *     panels at once, because four panels reading one snapshot must show one
 *     instant.
 */

/** The default canvas factory: a real, offscreen canvas with no layout box. */
function domCanvas(width, height) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    throw new Error(
      'NavSource: no document to create a canvas from. Outside a browser you must pass ' +
      'opts.makeCanvas(width, height) — that seam is what makes this class testable at all, ' +
      'since NavComputer itself cannot be constructed without a DOM.',
    );
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

/** Reject a buffer size that would draw nothing. Zero is the value that matters. */
function readSize(width, height, where) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) {
    throw new Error(
      `${where}: buffer size must be positive and finite, got ${width} x ${height}. ` +
      `A zero here is the signature of an unlaid-out canvas — which is the exact state this ` +
      `whole class exists to keep the nav computer out of.`,
    );
  }
  return { width: Math.round(width), height: Math.round(height) };
}

/**
 * A nav computer drawing into a fixed-size buffer of its own.
 *
 * Built either by handing the constructor an existing instance, or through
 * `NavSource.mount()`, which makes the canvas and calls a factory you supply.
 */
export class NavSource {
  /**
   * @param {object} nav a NavComputer-shaped object: `_canvas` plus `render()`
   * @param {object} opts
   * @param {number} opts.width  the NAV panel's buffer width, in pixels
   * @param {number} opts.height the NAV panel's buffer height, in pixels
   * @param {object} [opts.canvas] the surface to pin; defaults to `nav._canvas`
   */
  constructor(nav, { width, height, canvas } = {}) {
    if (!nav || typeof nav.render !== 'function') {
      throw new Error(
        'NavSource: needs a NavComputer-shaped object with a render(). Without one there is ' +
        'nothing to host, and a panel bound to nothing would simply stay black.',
      );
    }
    const surface = canvas ?? nav._canvas;
    if (!surface) {
      throw new Error(
        'NavSource: the nav computer has no _canvas and none was supplied. That canvas is ' +
        'the buffer this class exists to pin — there is nothing to pin without it.',
      );
    }

    const size = readSize(width, height, 'NavSource');
    this.nav = nav;
    this.canvas = surface;
    this.width = size.width;
    this.height = size.height;
    this._disposed = false;

    // Remember what was there so `dispose()` can put the instance back exactly as
    // it was found — including the case where it already had an own override.
    this._hadOwn = Object.prototype.hasOwnProperty.call(nav, '_resizeCanvas');
    this._saved = this._hadOwn ? nav._resizeCanvas : undefined;

    // THE LINE THIS FILE EXISTS FOR. An own property shadows the prototype
    // method, so `render()`'s first statement gets this instead of the
    // getBoundingClientRect version — on every render, not once at setup.
    nav._resizeCanvas = () => this._holdBuffer();
    this._holdBuffer();
  }

  /**
   * Make the canvas, build the nav computer on it, and pin it.
   *
   * `makeNav(canvas)` is injected rather than this module importing NavComputer,
   * for the reason in the header: the class cannot be constructed without a DOM,
   * so a static import would make every test that touches this file drag in four
   * thousand lines it can never run.
   *
   * @param {object} opts
   * @param {(canvas:object) => object} opts.makeNav builds the nav computer
   * @param {number} opts.width  panel buffer width
   * @param {number} opts.height panel buffer height
   * @param {(w:number,h:number)=>object} [opts.makeCanvas] surface factory
   * @returns {NavSource}
   */
  static mount({ makeNav, width, height, makeCanvas = domCanvas } = {}) {
    if (typeof makeNav !== 'function') {
      throw new Error(
        'NavSource.mount: needs makeNav(canvas) — the caller builds the nav computer, because ' +
        'this module deliberately does not import it. See the header.',
      );
    }
    const size = readSize(width, height, 'NavSource.mount');
    const canvas = makeCanvas(size.width, size.height);
    if (!canvas || canvas.width !== size.width || canvas.height !== size.height) {
      throw new Error(
        `NavSource.mount: makeCanvas returned a ${canvas && canvas.width} x ` +
        `${canvas && canvas.height} surface, expected ${size.width} x ${size.height}. A buffer ` +
        `that is not the size it was asked for draws the nav map at the wrong shape, and ` +
        `nothing downstream can tell.`,
      );
    }
    // The size is set BEFORE the nav computer is built, so that anything its
    // constructor reads off the canvas already sees the real buffer.
    const nav = makeNav(canvas);
    return new NavSource(nav, { width: size.width, height: size.height, canvas });
  }

  /**
   * Re-assert the pinned buffer size. This is what `nav._resizeCanvas` becomes.
   *
   * The comparison before the assignment is not a micro-optimisation, it is
   * correctness: assigning to `canvas.width` RESETS THE CANVAS — it clears every
   * pixel and every context setting — so an unconditional assignment on every
   * render would be an extra full clear per frame, and worse, would wipe the
   * frame between any two draws that happened to straddle it. NavComputer's own
   * `_resizeCanvas` guards the same way, for the same reason.
   * @private
   */
  _holdBuffer() {
    const c = this.canvas;
    if (c.width !== this.width) c.width = this.width;
    if (c.height !== this.height) c.height = this.height;
  }

  /** The 2D context of the pinned canvas, or null if the surface has none. */
  get ctx() {
    return typeof this.canvas.getContext === 'function' ? this.canvas.getContext('2d') : null;
  }

  /** Whether `dispose()` has run. */
  get disposed() {
    return this._disposed;
  }

  /**
   * Move to a new buffer size — the NAV panel was rebuilt at a different
   * resolution.
   *
   * `PanelHost` creates its canvases at bind time, so the lab's buffer-height
   * control (and any future quality setting) tears every panel down and builds a
   * new one. The NAV SOURCE is not rebuilt with them — building one means
   * building a NavComputer, which regenerates sectors and reloads a prism's worth
   * of stars — so it has to be told. Without this, the nav picture would keep
   * being drawn at the old size and either letterbox itself inside the new panel
   * or overflow it, on a panel that otherwise looks completely normal.
   *
   * A no-op when the size has not changed, because the assignment inside
   * `_holdBuffer` would otherwise blank the canvas on every call.
   *
   * @param {number} width new buffer width
   * @param {number} height new buffer height
   * @returns {boolean} whether the buffer actually changed
   */
  resize(width, height) {
    const size = readSize(width, height, 'NavSource.resize');
    if (size.width === this.width && size.height === this.height) return false;
    this.width = size.width;
    this.height = size.height;
    this._holdBuffer();
    return true;
  }

  /**
   * Draw one nav frame into the pinned buffer.
   *
   * THE CHECK AFTERWARDS IS NOT DEFENSIVE PADDING. It is the assertion that the
   * override in the constructor is still installed and still doing its job, made
   * at the one moment it can be made cheaply and truthfully — right after the
   * only code path that would break it has run. Two comparisons per repaint.
   *
   * It THROWS rather than silently re-pinning, and the trade is worth stating.
   * `PanelHost` catches a painter's throw and logs it ONCE, naming the panel; the
   * NAV painter clears the glass before it calls anything that can throw, so the
   * visible result is a BLACK panel with a named cause on the console. Silently
   * repairing instead would give a panel that flickers black every other frame
   * with nothing anywhere to say why — the same class of bug this file was
   * written to remove, wearing a disguise.
   *
   * @returns {boolean} true if a frame was drawn; false if disposed
   */
  render() {
    if (this._disposed) return false;
    this.nav.render();
    if (this.canvas.width !== this.width || this.canvas.height !== this.height) {
      throw new Error(
        `NavSource: the nav computer's buffer collapsed to ${this.canvas.width} x ` +
        `${this.canvas.height} during render (expected ${this.width} x ${this.height}). ` +
        `NavComputer.render() calls this._resizeCanvas() first, and the prototype version of ` +
        `that reads getBoundingClientRect() — which is 0 x 0 on a canvas with no layout box. ` +
        `The own-property override installed by this class is the only thing standing between ` +
        `the panel and a zero-sized buffer, so something has removed or replaced it.`,
      );
    }
    return true;
  }

  /**
   * The pinned buffer's pixels, as an ImageData for the dither to quantise.
   *
   * A fresh allocation each call, because `getImageData` has no reuse form in the
   * DOM API — there is no version that fills a buffer you already own. That is
   * one panel's worth of RGBA per repaint, and `PanelHost`'s ambient tier is
   * about twelve repaints a second, not sixty. The DITHER's output buffer, which
   * this code does control, IS reused; see the NAV painter.
   *
   * @returns {{width:number, height:number, data:ArrayLike<number>}}
   */
  readPixels() {
    const ctx = this.ctx;
    if (!ctx || typeof ctx.getImageData !== 'function') {
      throw new Error(
        'NavSource.readPixels: the pinned canvas has no 2d context to read from. A null ' +
        'context accepts every drawing call and reports nothing, so the nav computer would ' +
        'have appeared to render into a surface that never existed.',
      );
    }
    return ctx.getImageData(0, 0, this.width, this.height);
  }

  /**
   * Put the instance back the way it was found and release the nav computer.
   *
   * Idempotent, because teardown paths get called twice. The override is removed
   * rather than left in place: a NavSource that has been disposed is no longer
   * pinning anything, and leaving a closure that captures a dead `this` on a live
   * NavComputer would keep the panel's buffer size welded to a panel that no
   * longer exists.
   */
  dispose() {
    if (this._disposed) return;
    this._disposed = true;
    if (this._hadOwn) this.nav._resizeCanvas = this._saved;
    else delete this.nav._resizeCanvas;
    this.nav.dispose?.();
  }
}

export default NavSource;
