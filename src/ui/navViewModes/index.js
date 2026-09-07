/**
 * navViewModes — the full-screen nav computer's switchable view modes.
 *
 * Max, 2026-09-06, reversing the order of work: *"we need to begin by making these nav computer
 * screens work in fullscreen first (the N menu) then figure out how to represent that in the
 * diegetic screens."* Then, against the rendered lab: *"I love both 1 and 2 for both; I want all of
 * these modes!"*
 *
 * ── ⭐ THE FULL-SCREEN NAV WAS NEVER AT THE GAME'S RESOLUTION, SO THIS IS PLUMBING FIRST ────────
 *
 * `NavComputer._resizeCanvas` sizes the backing store from `getBoundingClientRect()` — about
 * 1560x860 on Max's display, **3.58x the world's line count** — and the class imports nothing from
 * `renderBuffer.js`. A mode here takes the store from `resolveRenderBuffer` instead and lets CSS
 * stretch it, which is the idiom `SupercruiseHud._syncBuffer` (:114-129) and
 * `TargetingReticle._resize` (:213-226) already use, with the `image-rendering` pair from
 * `style.css:38-40`.
 *
 * ⭐ AND THE MOUSE MAPPING NEEDS NO CHANGE. `_getCanvasPos` multiplies by `canvas.width /
 * rect.width`, and every draw site in `NavComputer` works in backing-store units too, so both sides
 * scale by the same 0.274 and cancel. A click at the CSS centre of a 1560x860 box lands at
 * (213.5, 120) — the centre of a 427x240 buffer.
 *
 * ── ⛔ `null` IS TODAY'S NAV, BYTE-FOR-BYTE, BY CONSTRUCTION ────────────────────────────────────
 *
 * With no mode selected `NavComputer.render()` returns before any code here and `_resizeCanvas`
 * keeps its `rect.width` path, so the overlay Max has today is unchanged the way `pixelType: null`
 * leaves the overlay's type unchanged — not by inspection, by never entering. That is what makes the
 * mode key an honest A/B: mode 0 is the real product, not a fourth thing nobody designed.
 *
 * ⭐ WHICH IS ALSO WHY `navLayout`'S SATURATION IS NOT TOUCHED, against the predecessor handoff's
 * §4.7. It called that "the single biggest thing to fix", on the premise that a 240p fullscreen nav
 * would be built on the existing renderer and inherit its desktop chrome — reproduced exactly:
 * `navTabHeight(240) = 32`, 13.3% of the rows, and `navMapSize(427,240) = 160`, a 25% square in a
 * 427-wide frame. Both designs below draw their OWN chrome and never call those functions. §4.7
 * reopens the day anything asks the LEGACY renderer into a low-res buffer.
 *
 * ── ⛔ THE MODE IS PER-INSTANCE AND CANNOT REACH THE COCKPIT GLASS ──────────────────────────────
 *
 * The panel and the overlay are TWO SEPARATE `NavComputer`s — `main.js:4700` builds the cockpit's,
 * `main.js:5895` builds `_domNavComputer` — so writing `viewMode` on the DOM instance is structurally
 * unable to change the panel Max already passed. ⛔ NOT keyed off `_bare`: `NavPanel.js:222` writes
 * `chromeless = false` every paint under his 2026-08-01 ruling, so `_bare` is permanently FALSE on
 * the panel and a mode keyed off it would be a no-op that looks exactly like a wiring failure.
 */

import { resolveRenderBuffer } from '../../rendering/renderBuffer.js';
import { makeViewState } from './state.js';
import { makeDesigns } from './designs.js';

/**
 * The cycle the mode key walks. `null` first, so the default is today's nav and the first press
 * moves OFF it.
 * ⛔ Design 3 is absent deliberately — all three judges killed it for deriving the fullscreen from
 * the 52x43 cockpit panel, the exact inverse of Max's ruling. Do not add it.
 */
export const NAV_VIEW_MODES = [null, 'rail', 'bars'];

/** What each mode is called where Max can see it. */
export const NAV_VIEW_MODE_LABELS = { null: 'CURRENT', rail: 'RAIL (design 1)', bars: 'BARS (design 2)' };

/** localStorage key — the choice has to survive closing and reopening the nav. */
export const NAV_VIEW_MODE_KEY = 'well-dipper-nav-view-mode';

/** The design number `designs.js` expects for a mode name. */
const DESIGN_OF = { rail: 1, bars: 2 };

/**
 * Build the driver for one NavComputer instance.
 *
 * ⛔ ONE `makeViewState()` AND ONE `makeDesigns()` PER INSTANCE, BOTH HERE. The design closures
 * capture `S` and `D` by identity; building a second pair would give the painters a state object
 * nobody updates. See the "mutate, never replace" note in `state.js`.
 */
export function makeViewModeDriver(nav) {
  const { S, D, refresh } = makeViewState();
  const violations = [];
  const designs = makeDesigns({
    S, D,
    onViolation: (line, detail) => {
      violations.push(detail);
      // eslint-disable-next-line no-console
      console.error(line);
    },
  });

  /**
   * The backing store a mode wants: the world's own low-res buffer at the OVERLAY'S aspect.
   *
   * ⚠ THE LINE COUNT COMES FROM THE WORLD, THE WIDTH FROM THIS BOX, and the two are not the same
   * rectangle: the overlay panel is `calc(100vw-40px) x calc(100vh-40px)`. Taking the world's buffer
   * wholesale would stretch a 900-row-derived width into an 860-row-tall box and put non-square
   * texels on the glass. Deriving width from the box at the world's line count keeps texels square
   * and within ~5% of the world's size, which is the same thing `bufferForLines` does for the world
   * itself — and in the low-res modes the panel is full-bleed anyway, so the two converge.
   */
  function bufferFor(rect, canvasEl) {
    applySurface(canvasEl, !!nav.viewMode);
    const world = resolveRenderBuffer(
      typeof window !== 'undefined' ? window.innerWidth : rect.width,
      typeof window !== 'undefined' ? window.innerHeight : rect.height);
    const lines = Math.max(1, world.height | 0);
    const w = Math.max(1, Math.round((rect.width / Math.max(1, rect.height)) * lines));
    return { width: w, height: lines, lines };
  }

  /** Paint one frame in the active mode. Returns false if the mode is unknown — caller draws legacy. */
  function render(ctx, w, h) {
    const design = DESIGN_OF[nav.viewMode];
    if (!design) return false;
    S.design = design;
    refresh(nav, { width: w, height: h, lines: h });
    if (!D.ready) return false;
    violations.length = 0;
    designs.resetViolations();
    designs.resetRegions();
    if (design === 1) designs.drawDesign1(ctx, w, h);
    else designs.drawDesign2(ctx, w, h);
    return true;
  }

  return {
    S, D, render, bufferFor, applySurface,
    regions: designs.regions,
    violations: () => violations.slice(),
    /** Design 2's list mode — its one answer to the comparison problem. */
    toggleList: () => { S.list = !S.list; },
  };
}

/**
 * Put the canvas and its panel into (or out of) low-resolution dress.
 *
 * ⭐ THE PIXELATION IS CSS, NOT THE BUFFER. Shrinking the backing store alone gets you a small image
 * BILINEARLY smeared up to the box — the smear is the browser's default and it is the whole failure
 * this pair of declarations prevents. Same two properties in the same order as `#canvas`
 * (`style.css:22-23`) and `#supercruise-hud, #targeting-overlay` (`:38-40`), which is deliberate:
 * three surfaces sharing the world's grid should not each spell it differently.
 *
 * ⛔ AND THE PANEL GOES FULL-BLEED, which is a real change to the overlay's look and is Max's call,
 * taken 2026-09-07. Design 2's stated property is that the map reaches all four edges; the shipped
 * overlay sits inside `calc(100vw - 40px)`, a 20px black letterbox that contradicts it. The border
 * goes with it — a 1px hairline is a third of a texel at 240p, which is not a line, it is a smudge.
 * ⚠ Today's nav (`viewMode === null`) keeps its inset and its border: this runs with `on = false`
 * and removes nothing that was not added here.
 */
export function applySurface(canvasEl, on) {
  if (!canvasEl || !canvasEl.classList) return;
  canvasEl.classList.toggle('nav-lowres', on);
  const panel = canvasEl.parentElement;
  if (panel && panel.classList) panel.classList.toggle('nav-lowres', on);
}

/**
 * Advance the mode cycle. Exported separately from the driver because the KEY HANDLER lives on
 * `NavComputer` and must work before a driver exists (the first press is what creates one).
 */
export function nextViewMode(current) {
  const i = NAV_VIEW_MODES.indexOf(current ?? null);
  return NAV_VIEW_MODES[(i + 1) % NAV_VIEW_MODES.length];
}

/** Read the stored choice, tolerating a private window, cleared site data, or a throwing accessor. */
export function loadViewMode() {
  try {
    const v = globalThis.localStorage?.getItem(NAV_VIEW_MODE_KEY);
    return NAV_VIEW_MODES.includes(v) ? v : null;
  } catch (e) { return null; }
}

/** Persist the choice. Silent on failure — a remembered mode is a convenience, not state. */
export function saveViewMode(mode) {
  try {
    if (mode) globalThis.localStorage?.setItem(NAV_VIEW_MODE_KEY, mode);
    else globalThis.localStorage?.removeItem(NAV_VIEW_MODE_KEY);
  } catch (e) { /* private window, or site data blocked */ }
}
