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
import { railGeometry, barsGeometry, tabIndexAt } from './geometry.js';
import { FACE, measurePixelText } from '../../rendering/PixelText.js';

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
    // ⭐ PUBLISH THE COMMIT RECTANGLE INTO THE FIELD THE SHIPPED HANDLER ALREADY TESTS. `_handleClick`
    // fires `_onCommit(this._commitAction)` for a click inside `_commitButtonRect`; overwriting that
    // rect with the design's own is the entire wiring, and it means WARP and BURN cannot diverge —
    // which is the exact defect AC-4 found, as two independent copies of one button.
    // ⛔ Taken from `regions()`, so it comes OUT of the paint rather than being restated here.
    const r = designs.regions()[design === 1 ? 'commit' : 'botbar'];
    if (r) {
      const g2 = geo(w, h);
      nav._commitButtonRect = design === 1
        ? { x: r.x, y: r.y, w: r.w, h: r.h }
        : { x: g2.chipX, y: g2.chipY, w: g2.chipW, h: g2.BAR };
    }
    return true;
  }

  /** The design's own layout for the frame just painted. Rebuilt per query — it is pure arithmetic. */
  function geo(w, h) {
    return nav.viewMode === 'bars'
      ? barsGeometry(w, h, FACE, measurePixelText, designs.LEVELS)
      : railGeometry(w, h, FACE);
  }

  /** Which list row is under y? `-1` for none. The rail (design 1) and the `L` list (design 2). */
  function listRowAt(g2, x, y, bars) {
    if (bars) {
      if (!S.list || S.level === 4) return -1;
      const i = Math.round((y - g2.listTop - g2.LEAD) / g2.LEAD);
      return i >= 0 && i < g2.listRows ? i : -1;
    }
    if (x < g2.railX || x > g2.railX + g2.railW) return -1;
    const i = Math.round((y - g2.rowY(0)) / g2.LEAD);
    return i >= 0 && i < g2.listRows ? i : -1;
  }

  /**
   * Resolve hover from the ACTIVE DESIGN'S geometry, into the three fields the SHIPPED click handler
   * already reads.
   *
   * ⭐⭐ THIS IS THE WHOLE REASON THE MODES ARE OPERABLE FOR SO LITTLE CODE. `_handleClick` never
   * looks at a coordinate for a drill: it reads `_hoveredTile` at the 2D levels, `_hoveredLocalStar`
   * at PRISM and `_hoveredBody` at SYSTEM, and everything after that — the zoom animation, the view
   * stack push, the drill sound, the system resolution — is already written and already correct.
   * Writing those three fields buys all of it. ⛔ Reimplementing the drill instead would have been
   * ~150 lines of the most consequence-carrying code in the class, duplicated.
   *
   * ⚠ THE MAP PANE IS DELIBERATELY NOT A PICKER YET, IN EITHER DESIGN. Each design projects its own
   * map — design 1 into a square inset beside the rail, design 2 full-bleed with a cropped square —
   * and inverting those here would be a THIRD copy of a projection I am not allowed to edit at its
   * source. The list is a complete picker for every level, so the walk is whole without it; the map
   * picker wants the projections lifted out of `designs.js` first, which is a separate change.
   */
  function hover(x, y, w, h) {
    const bars = nav.viewMode === 'bars';
    const g2 = geo(w, h);
    const row = listRowAt(g2, x, y, bars);
    if (row < 0) return false;
    if (S.level === 0) {
      const r = D.sectorRows[row];
      if (!r) return false;
      nav._hoveredTile = { sector: r.s };        // the shape `_handleClick`'s level-0 branch reads
      return true;
    }
    if (S.level === 3) {
      const s = D.starRows[row];
      if (!s) return false;
      // `_handleClick` drills `this._hoveredLocalStar.star`, and the star it wants is the one in
      // `_localStars` — not the ranked COPY the adapter made. Match by seed.
      const live = nav._localStars.find((t) => t.seed === s.seed) || s;
      nav._hoveredLocalStar = { star: live, sx: x, sy: y };
      return true;
    }
    if (S.level === 4) {
      const b = D.bodies[row];
      if (!b || b.pIdx == null) return false;
      nav._hoveredBody = b.kind === 'moon' ? { type: 'moon', index: b.mIdx } : { type: 'planet', index: b.pIdx };
      return true;
    }
    return false;   // levels 1-2 pick by tile, which is the map picker above
  }

  /**
   * Translate a click in the design's chrome into the coordinate the SHIPPED handler expects.
   *
   * Only the TAB STRIP needs this. Design 1 lays five equal `tabW` cells from the left edge and
   * design 2 spaces them by label width, while `_handleClick` divides the FULL WIDTH by five in a
   * strip `navTabHeight(h)` tall — so the index has to be recomputed and re-expressed. The commit
   * button does not need it: `render()` publishes the design's own rectangle straight into
   * `_commitButtonRect`, which is the very field the handler tests.
   *
   * ⛔ AND IT ALSO PUBLISHES `_modeTabIdx`, WHICH IS NOT BOOKKEEPING — IT CLOSES A REAL DEFECT.
   * The legacy strip is `navTabHeight(h)` tall: **32 rows of a 240-row buffer**, five live buttons
   * across the bottom eighth of the screen. Design 1's COMMIT row sits at the very last row, inside
   * it. So a click on `[ WARP ]` reached the tab test first and CHANGED LEVEL instead of warping —
   * the same defect AC-4 found on the cockpit panel ("five INVISIBLE LIVE BUTTONS across the
   * bottom"), arriving from the other direction. `-1` says "a mode is on and this was not a tab", and
   * the tab test in `_handleClick` stands down.
   *
   * @returns {?{x:number,y:number}} the point to hand `_handleClick`; unchanged if it is not a tab,
   *   and `null` when the mode CONSUMED the click (a ladder "..." cap) and the handler must stand down.
   */
  /**
   * Step the SYSTEM ladder one body left or right.
   *
   * ⛔ THE STOPS COME FROM THE PAINT (`S.ladderStops`, written by `d1Ladder`), NOT FROM A SECOND
   * LAYOUT PASS HERE. Recomputing the separation arithmetic in the control is the AC-4 defect shape
   * — two copies of one geometry, one of them silently wrong — and it would land as a window that
   * scrolls to a position with no body in it.
   */
  function scrollLadder(dir) {
    const stops = S.ladderStops || [], cur = S.ladderScroll || 0, max = S.ladderMax || 0;
    const next = dir > 0 ? stops.find((v) => v > cur) : [...stops].reverse().find((v) => v < cur);
    S.ladderScroll = Math.max(0, Math.min(max, next == null ? (dir > 0 ? max : 0) : next));
  }

  function remapClick(p, w, h) {
    const bars = nav.viewMode === 'bars';
    const g2 = geo(w, h);
    nav._modeTabIdx = -1;
    // ── the ladder's two "..." end caps, at SYSTEM in design 1 ────────────────────────────────
    const caps = S.ladderCaps;
    if (!bars && S.level === 4 && caps && (S.ladderMax || 0) > 0
        && p.y >= caps.axisY - 6 && p.y <= caps.axisY + 6) {
      if ((S.ladderScroll || 0) > 0 && p.x <= caps.x0 + 10) { scrollLadder(-1); return null; }
      if ((S.ladderScroll || 0) < S.ladderMax && p.x >= caps.x1 - 10) { scrollLadder(1); return null; }
    }
    const inStrip = bars ? (p.y >= 0 && p.y < g2.BAR) : (p.y >= g2.tabY && p.y < g2.tabY + g2.LEAD);
    if (!inStrip) return p;
    const i = tabIndexAt(g2, p.x, bars);
    if (i < 0) return p;
    nav._modeTabIdx = i;
    // The handler only asks `p.y >= h - navTabHeight(h)`, so the bottom row is inside the strip at
    // every buffer without this file needing to know what navTabHeight returns.
    return { x: (i + 0.5) * (w / 5), y: h - 1 };
  }

  return {
    S, D, render, bufferFor, applySurface, hover, remapClick, geo, scrollLadder,
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
