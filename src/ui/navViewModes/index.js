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
import { makeViewState, SORT_KEYS } from './state.js';
import { makeDesigns } from './designs.js';
import { railGeometry, barsGeometry, tabIndexAt } from './geometry.js';
import { pickSector, pickTile, pickPrismStar, pickBody, bodyIdentity,
         usableProj, gridNFallback, tileOf, HOVER_FIELD } from './picking.js';
import { makeSearch } from './search.js';
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
  /**
   * The buffer the last frame was painted into.
   *
   * ⚠ THE KEYS ARRIVE BETWEEN FRAMES AND HAVE NO CANVAS. `tabLevel` has to place a synthetic click
   * inside the DESIGN'S tab strip, and the strip's geometry is a function of `(w, h)`. Reading
   * `nav._canvas.width` instead would be right in production and wrong in exactly the case that
   * matters — a resize between the paint and the keypress — so the remembered pair is the honest
   * source, with the canvas as a fallback for a key pressed before the first frame.
   */
  let lastW = 0, lastH = 0;
  /** ⛔ ONE PER INSTANCE, over the SAME `S` the designs captured — see the "mutate, never replace"
   *  note in `state.js`. It owns no state of its own: the query lives on `S.search` and the results
   *  and the cursor live on the instrument, exactly where `_activateSearchHighlight` reads them. */
  const search = makeSearch(nav, S);
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
    // ⛔⛔ MEASURED 2026-09-08: THIS IS NEVER REACHED ON THE WAY OUT OF A MODE, WHICH IS A DEFECT
    //    AND NOT THIS FILE'S TO FIX. `_resizeCanvas` (:613) reads
    //    `this.viewMode ? drv.bufferFor(...) : rect`, so cycling `V` back to CURRENT calls nothing
    //    here — and `applySurface` below is the ONLY caller of the class toggle, so `nav-lowres`
    //    NEVER COMES OFF: today's nav keeps the full-bleed panel, the pixelated upscale, and
    //    `style.css:1289`, which hides the DOM search overlay outright. That last one matters here:
    //    style.css says of the hidden widget "Searching by name is reachable in today's nav (V back
    //    to CURRENT)", and as shipped it is not. The fix is one statement folded onto :613 BEFORE
    //    its trailing `//` comment (a poisoned fold target — see the note on :349).
    applySurface(canvasEl, !!nav.viewMode);
    const world = resolveRenderBuffer(
      typeof window !== 'undefined' ? window.innerWidth : rect.width,
      typeof window !== 'undefined' ? window.innerHeight : rect.height);
    const lines = Math.max(1, world.height | 0);
    const w = Math.max(1, Math.round((rect.width / Math.max(1, rect.height)) * lines));
    return { width: w, height: lines, lines };
  }

  /**
   * Everything the PAINT publishes, cleared before it paints.
   *
   * ⛔ SAME REASON `resetRegions()` EXISTS, AND IT WAS LEARNED THE HARD WAY THERE: with a stale map
   * the guard could not tell "never declared this frame" from "declared last frame", so a design
   * asserted happily against the OTHER design's rectangle. A hit-test has the identical failure and
   * a worse consequence — a projection that outlives its frame does not report anything, it just
   * picks the wrong tile, and it looks exactly like a broken inverse. Cleared here, republished by
   * the draw code, read by the tail below: one frame's worth, every frame.
   */
  function resetPicks() {
    S.mapProj = null; S.listGeom = null; S.tabRects = null; S.chipRect = null;
    S.searchGeom = null;
    S.prismHits = []; S.bodyHits = []; S.railTiles = [];
  }

  /** Paint one frame in the active mode. Returns false if the mode is unknown — caller draws legacy. */
  function render(ctx, w, h) {
    const design = DESIGN_OF[nav.viewMode];
    if (!design) return false;
    S.design = design;
    lastW = w; lastH = h;
    refresh(nav, { width: w, height: h, lines: h });
    if (!D.ready) return false;
    violations.length = 0;
    designs.resetViolations();
    designs.resetRegions();
    resetPicks();
    // ⭐ THE FIELD'S ROWS ARE RE-READ OFF THE INSTRUMENT EVERY FRAME IT IS OPEN, not only when a key
    // moves them. `_searchResults` / `_searchHighlight` are ordinary NavComputer state and anything
    // else may write them — `activate()` calls `_showSearch()`, which resets both — so mirroring on
    // keystrokes alone would let the drawn list and the list `Enter` acts on drift apart silently.
    if (S.search.open) search.mirror();
    if (design === 1) designs.drawDesign1(ctx, w, h);
    else designs.drawDesign2(ctx, w, h);
    // ⭐ PUBLISH THE COMMIT RECTANGLE INTO THE FIELD THE SHIPPED HANDLER ALREADY TESTS. `_handleClick`
    // fires `_onCommit(this._commitAction)` for a click inside `_commitButtonRect`; overwriting that
    // rect with the design's own is the entire wiring, and it means WARP and BURN cannot diverge —
    // which is the exact defect AC-4 found, as two independent copies of one button.
    // ⛔ AND IT COMES FROM THE PAINT — WHICH THE COMMENT HERE ALREADY CLAIMED WHILE THE CODE DID
    // NOT. It read "Taken from `regions()`, so it comes OUT of the paint rather than being restated
    // here", and design 1's branch did; design 2's quietly took `chipX`/`chipY`/`chipW` out of
    // `geometry.js` — a restatement of numbers that live inside verbatim draw code, which is the
    // AC-4 defect shape appearing in the very block written to avoid it. `S.chipRect` is now first:
    // the rectangle the design filled, from the draw site that filled it, with `armed` carried
    // alongside so the button that LOOKS live and the button that IS live cannot come apart.
    // `regions().commit` (design 1's full-width row, genuinely declared by the paint) is second, and
    // the geometry restatement is now only a floor for a design that publishes neither.
    const chip = S.chipRect;
    const r = designs.regions()[design === 1 ? 'commit' : 'botbar'];
    if (chip && Number.isFinite(chip.x) && Number.isFinite(chip.w)) {
      nav._commitButtonRect = { x: chip.x, y: chip.y, w: chip.w, h: chip.h };
    } else if (r) {
      const g2 = geo(w, h);
      nav._commitButtonRect = design === 1
        ? { x: r.x, y: r.y, w: r.w, h: r.h }
        : { x: g2.chipX, y: g2.chipY, w: g2.chipW, h: g2.BAR };
    }
    // ⛔ AND THE LEGACY PASS'S OTHER TWO HIT REGIONS ARE WITHDRAWN, for the reason the tab strip
    // already is. `_renderHUD` republishes `_autopilotButtonRect` every frame — 140x24 at (8, h-64),
    // which on a 240p buffer is 3.3% of the screen sitting in the middle-left of design 1's map pane
    // and design 2's full-bleed map — and `_handleClick` tests it FIRST and returns. Neither design
    // draws an autopilot toggle, so under a mode that rectangle is five invisible live pixels' worth
    // of exactly the defect AC-4 named on the cockpit panel, and it eats clicks meant for a star, a
    // tile or a planet. `_farChipRects` is the same shape at SYSTEM: `_renderSystem` publishes far-
    // companion chips the designs do not draw, and a click inside one returns without drilling.
    // ⭐ NOTHING VISIBLE IS LOST — each design's first act is an opaque full-canvas fill, so neither
    // control is on the glass to begin with; this only stops the click from finding it anyway.
    nav._autopilotButtonRect = null;
    if (nav._farChipRects) nav._farChipRects = [];
    // ⭐⭐ AND HERE, LAST, THE HOVER — see `resolveHover`. This line is the workstream's single
    // highest-value change: the legacy painters ran ten calls ago and rewrote all three hover fields
    // from the LEGACY projection, so anything resolved before now has already been overwritten.
    resolveHover(nav._mouseX, nav._mouseY, w, h);
    return true;
  }

  /** The design's own layout for the frame just painted. Rebuilt per query — it is pure arithmetic. */
  function geo(w, h) {
    return nav.viewMode === 'bars'
      ? barsGeometry(w, h, FACE, measurePixelText, designs.LEVELS)
      : railGeometry(w, h, FACE);
  }

  /**
   * Which list row is under y? `-1` for none. The rail (design 1) and the `L` list (design 2).
   *
   * ⭐ THE GRID COMES OUT OF THE PAINT NOW. `S.listGeom` is published by `d1Rail` at every level and
   * by `d2List` ONLY in list mode — which is itself the discriminator: design 2 at PRISM with the
   * map showing publishes none, so there is no list to pick off and the question answers itself
   * without this file knowing that `L` exists. `rows` is what was DRAWN rather than what would fit,
   * and the two differ at the end of the catalogue — the difference being rows the pilot can click
   * that carry nobody.
   *
   * ⚠ The `geometry.js` formulas below it are the FALLBACK, for a frame that has not painted yet.
   */
  function listRowAt(g2, x, y, bars) {
    const lg = S.listGeom;
    if (lg && Number.isFinite(lg.top) && lg.lead > 0 && lg.rows > 0) {
      if (x < lg.x0 || x > lg.x1) return -1;
      const i = Math.round((y - lg.top - lg.lead) / lg.lead);
      return i >= 0 && i < lg.rows ? i : -1;
    }
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
   * WHICH ROW OF THE PUBLISHED LIST IS DRAWN ROW `row`?
   *
   * ⛔ THE OFFSET COMES FROM THE PAINT, NOT FROM `S.listOffset`. `page()` WRITES `S.listOffset`; the
   * design READS it when it slices, and publishes what it actually sliced as `S.listGeom.offset`.
   * Reading the driver's own intention here instead would desynchronise the picker from the glass
   * for exactly as long as the lab has not yet honoured the field — and a picker that is off by a
   * page is worse than a pager that does nothing, because it looks like it worked. Same split as
   * `S.ladderScroll` / `S.ladderStops`: the control writes, the paint publishes, the hit-test reads
   * the paint.
   */
  function rowBase() {
    const o = S.listGeom && S.listGeom.offset;
    return Number.isFinite(o) ? o : 0;
  }

  /** The pick a DRAWN list row resolves to, in the shape `_handleClick` reads. `null` for none. */
  function pickFromRow(row) {
    const i = rowBase() + row;
    if (S.level === 0) {
      const r = D.sectorRows[i];
      return r ? { sector: r.s } : null;          // the shape `_handleClick`'s level-0 branch reads
    }
    if (S.level === 1 || S.level === 2) {
      // ⭐ AC-4's TWO HOLES. Rows 1-27 are drawn at SECTOR and REGION and clicking them did nothing
      // at all — `hover()` answered {L0:true, L1:false, L2:false, L3:true, L4:true}. The tiles come
      // from `S.railTiles`, which the paint publishes from the SAME `d1TileRows(v, v.n)` call it
      // drew the rows from and has ALREADY sliced to the drawn count, so this indexes it directly.
      const t = (S.railTiles || [])[row];
      if (!t || !Number.isFinite(t.i) || !Number.isFinite(t.j)) return null;
      const p = usableProj(S);
      const n = (p && p.n > 0) ? p.n : gridNFallback(S.level);
      return tileOf(t.i, t.j, n);
    }
    if (S.level === 3) {
      const s = D.starRows[i];
      if (!s) return null;
      // `_handleClick` drills `this._hoveredLocalStar.star`, and the star it wants is the one in
      // `_localStars` — not the ranked COPY the adapter made. Match by seed.
      const live = (nav._localStars || []).find((t) => t && t.seed === s.seed) || s;
      return { star: live, sx: 0, sy: 0 };
    }
    return bodyIdentity(nav, D.bodies[i]);
  }

  /** The pick the MAP PANE resolves to at this level. Every one reads geometry the paint published. */
  function pickFromMap(x, y) {
    const mapR = designs.regions().map;
    if (S.level === 0) return pickSector(nav, S, x, y);
    if (S.level === 1 || S.level === 2) return pickTile(S, x, y);
    if (S.level === 3) return pickPrismStar(nav, S, x, y, mapR);
    return pickBody(nav, S, x, y, mapR);
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
   * ── ⛔⛔ AND IT RUNS AT THE TAIL OF `render()`, WHICH IS WHERE THE REAL DEFECT WAS ─────────────
   *
   * The legacy painters run FIRST under every mode frame — deliberately, because they are also the
   * lazy loaders — and they rewrite all three fields on their way past. `_renderLocal` NULLS
   * `_hoveredLocalStar` (:2037) and re-derives it from `_mouseX`/`_mouseY` against the LEGACY
   * projection (:2164-2167); `_renderSystem` does the same for `_hoveredBody` (:2751/:2836);
   * `_renderSectorOverlay` writes `_hoveredTile` (:1851) with no `else`, so it clobbers only when
   * the cursor happens to land in a legacy sector rect — stochastic, which is the worst kind.
   *
   * Measured on the running game, design 1 at PRISM, hovering rail row 2: after `hover()` the field
   * held `XND J3DK8MQE-RLZ16U6`, the correct `D.starRows[2]`; after ONE `render()` it held
   * `XND J3DJFN6W+A2AFBIA` — a different star, and that is the one the click drilled. The shipped
   * list picker was acting on the wrong star, and the suite could not see it because it renders
   * BEFORE the mousemove and never between the mousemove and the click.
   *
   * ⭐ Resolving here wins BY CONSTRUCTION rather than by gating: this is the last statement of the
   * last painter, so no later writer exists, and it always reads THIS frame's published candidates.
   * `_handleMouseMove` keeps calling it too — that is the cheap path for a pointer that moves
   * between frames, and it needs no edit to a line-frozen file.
   *
   * ⛔ A MISS WRITES `null`. With a picker covering most of the screen, "leave the last pick alone"
   * is not conservative — it is a target that survives the cursor leaving it, and combined with the
   * legacy writes above it means a click on the hint row drills whatever the legacy pass last
   * guessed. Under a mode the driver OWNS the level's hover field for the whole frame.
   *
   * @returns {boolean} true if something was picked (the shape `_handleMouseMove` consumes).
   */
  function resolveHover(x, y, w, h) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
    // ⛔ WHILE THE DRAWN FIELD IS OPEN THE LEVEL'S HOVER FIELD IS NULL, NOT STALE. The field covers
    //    the rail in design 1 and the whole map in design 2, and `remapClick` consumes every click
    //    that lands on it — so a live `_hoveredTile` underneath would be a target the pilot can
    //    neither see nor reach, sitting armed for the moment the field closes. Same reasoning as the
    //    "a miss writes null" rule below, one layer up.
    if (S.search.open) { nav[HOVER_FIELD[S.level] || '_hoveredTile'] = null; return false; }
    const bars = nav.viewMode === 'bars';
    const g2 = geo(w, h);
    const row = listRowAt(g2, x, y, bars);
    let hit = row >= 0 ? pickFromRow(row) : null;
    if (hit && S.level === 3) { hit.sx = x; hit.sy = y; }
    if (!hit) hit = pickFromMap(x, y);
    nav[HOVER_FIELD[S.level] || '_hoveredTile'] = hit || null;
    return !!hit;
  }

  /** The entry `NavComputer._handleMouseMove` calls. Kept working; the render tail is the authority. */
  function hover(x, y, w, h) { return resolveHover(x, y, w, h); }

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
    // ⛔ AND WHILE THE DRAWN FIELD IS OPEN, `,` AND `.` ARE TEXT. See `searchOpen`'s note: the
    //    ladder clause is folded onto `NavComputer.js:349` AHEAD of the search-routing clause, so it
    //    reaches these two keys first and would eat them — a period typed into a search box would
    //    scroll a ladder the pilot cannot see. The clause hands them here, so here is where they can
    //    still be recovered, and this is the recovery.
    if (S.search.open) { search.key({ code: dir > 0 ? 'Period' : 'Comma', key: dir > 0 ? '.' : ',' }); return; }
    const stops = S.ladderStops || [], cur = S.ladderScroll || 0, max = S.ladderMax || 0;
    const next = dir > 0 ? stops.find((v) => v > cur) : [...stops].reverse().find((v) => v < cur);
    S.ladderScroll = Math.max(0, Math.min(max, next == null ? (dir > 0 ? max : 0) : next));
  }

  // ══════════════════════════════════════════════════════════════════════════════════════════════
  // THE METHODS THE KEY HANDLER CALLS.  Signatures fixed by INTERFACE.md §3; `NavComputer`'s clauses
  // call every one of them OPTIONALLY (`drv.tabLevel?.(…)`), so a missing method is an inert key and
  // never a throw — a throw out of a key handler under `PanelHost` stops the uploads and freezes the
  // glass on the last good frame, which still looks alive.
  // ══════════════════════════════════════════════════════════════════════════════════════════════

  /** The centre of tab `idx` in the DESIGN'S own strip, in buffer texels. */
  function tabPoint(idx, w, h) {
    const rects = S.tabRects;
    const r = Array.isArray(rects) ? rects[idx] : null;
    if (r && Number.isFinite(r.x) && Number.isFinite(r.w) && Number.isFinite(r.y) && Number.isFinite(r.h)) {
      return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
    }
    const g2 = geo(w, h);
    if (nav.viewMode === 'bars') {
      const t = g2.tabs && g2.tabs[idx];
      return t ? { x: t.x + t.w / 2, y: g2.BAR / 2 } : null;
    }
    return { x: (idx + 0.5) * g2.tabW, y: g2.tabY + g2.LEAD / 2 };
  }

  /**
   * TAB / SHIFT+TAB — one level along, THROUGH THE SHIPPED CLICK HANDLER (AC-6).
   *
   * ⛔ IT MUST NOT SET `_levelIndex`. The tab-strip branch of `_handleClick` (:4440-4485) is inline
   * and carries the drill animation, the `_viewStack` push, `_onDrillSound`, the level-4
   * auto-select-nearest-star, the `_densityCacheKey` bust and the `_localStars` reset on the way out
   * of PRISM. A level-setter reimplements none of that and looks like it works until the first drill
   * lands on an empty star list.
   *
   * ⛔ AND THE SYNTHESISED POINT MUST BE IN THE DESIGN'S STRIP, NOT THE LEGACY ONE. `remapClick`
   * resets `_modeTabIdx = -1` on entry and only sets it inside the design's own strip; `_handleClick`
   * then stands the legacy tab test down unless `_modeTabIdx >= 0`. So a point taken from the legacy
   * subdivision (full width / 5, in the bottom `navTabHeight(h)` rows) is silently EATEN — it fails
   * the design's strip test, `_modeTabIdx` stays -1, and the branch that would have changed the
   * level never runs. The coordinates come from `S.tabRects` / `geo()` for that reason.
   *
   * ⚠ AND THEY ARE INVERTED BACK THROUGH `_getCanvasPos` (:4334-4340), which multiplies by
   * `canvas.width / rect.width`. Handing buffer texels straight in as `clientX`/`clientY` is correct
   * only while the CSS box happens to equal the backing store; in the running game a mode's buffer
   * is 427x240 inside a ~1560x860 box and the point would land a quarter of the way across.
   */
  function tabLevel(dir) {
    const cur = nav._levelIndex | 0;
    // ⭐ AND IT WRAPS, BECAUSE A CLAMPED TAB IS A DEAD KEY ON ONE OF THE FIVE LEVELS. Measured live
    // on the running game after phase 1: pressing Tab from GALAXY walked 3 -> 4 and then STOPPED,
    // `[3, 4, 4, 4]`, while design 1's hint row goes on saying `TAB LEVEL` at SYSTEM. A hint that
    // names a key which does nothing where it is printed is exactly the class of lie AC-10 sweeps
    // for. Five levels in a ring: forward off SYSTEM lands on GALAXY, back off GALAXY lands on
    // SYSTEM, and the drill path is unchanged — see the two ⛔ notes below.
    const idx = dir > 0 ? (cur + 1) % 5 : (cur + 4) % 5;
    if (idx === cur) return;
    const w = lastW || nav._canvas?.width || 0, h = lastH || nav._canvas?.height || 0;
    if (!(w > 0 && h > 0)) return;
    const pt = tabPoint(idx, w, h);
    if (!pt) return;
    let rect = { left: 0, top: 0, width: w, height: h };
    try { rect = nav._canvas.getBoundingClientRect() || rect; } catch (e) { /* no layout box */ }
    const sx = (rect.width || w) / w, sy = (rect.height || h) / h;
    nav._handleClick({
      clientX: rect.left + pt.x * sx, clientY: rect.top + pt.y * sy, button: 0,
      preventDefault() {}, stopPropagation() {},
    });
  }

  /**
   * ENTER — commit (AC-7). Two different mechanisms, and only one of them existed.
   *
   * · **`_commitAction` WINS WHEREVER IT IS SET**, and this fires exactly what
   *   `_handleClick`:4503-4510 fires for the `[ WARP ]` / `[ BURN ]` button — the same sound, the
   *   same payload — so the key and the button cannot diverge, which is AC-7's whole observable.
   *   ⚠ IT IS TESTED ON `_commitAction`, NOT ON THE LEVEL. Gating this branch to level 4 would have
   *   been safe on today's paths — `_selectedBody` is only written there — but it makes the guard a
   *   restatement of an assumption about where the action comes from rather than a test of whether
   *   one exists, and the day something else arms it below SYSTEM the key and the button part ways.
   * · **When nothing is armed**, `_commitAction` is `null` — at GALAXY through PRISM it is
   *   permanently so, because `_selectedBody` is never written outside level-4 paths — yet both
   *   designs draw a `WARP TO … ENTER` row at every level. The mechanism that already arms a warp
   *   with no `_selectedBody` is `_selectSearchResult`'s tail (:866-876); this is that tail, sourcing
   *   the star from `_selectedNavStar` and falling back to `_externalTarget`.
   *   ⛔ EXCEPT AT SYSTEM, where an unarmed Enter is a NO-OP: there the `[ BURN ]` button is dead
   *   too, and a key that commits where the button will not is the divergence read backwards.
   *
   * ⛔ NEVER hand-set `window._warpTarget` and never use the debug teleport. `_onCommit` is the
   *   supported contract and `main.js`'s warp branch reads `action.star`'s native shape off it.
   */
  function commit() {
    if (nav._commitAction) {
      let isCurrent = false;
      try { isCurrent = !!(nav._isCurrentSystem && nav._isCurrentSystem()); } catch (e) { isCurrent = false; }
      if (nav._onSound) nav._onSound(isCurrent ? 'warpLockOn' : 'warpTarget');
      if (nav._onCommit) nav._onCommit(nav._commitAction);
      return true;
    }
    if (nav._levelIndex === 4) return false;
    const sel = nav._selectedNavStar;
    const ext = nav._externalTarget;
    const star = sel || (ext ? { wx: ext.x, wy: ext.y, wz: ext.z, seed: ext.seed ?? 0,
                                 name: ext.name || '', spectral: undefined } : null);
    if (!star) return false;
    if (nav._onSound) nav._onSound('warpTarget');
    if (nav._onCommit) {
      nav._onCommit({
        type: 'warp', target: 'star',
        star: { wx: star.wx, wy: star.wy, wz: star.wz,
                seed: star.seed, name: star.name, spectral: star.spectral },
      });
    }
    return true;
  }

  /**
   * `[` / `]` — walk the active level's sort keys (AC-8).
   *
   * ⛔ THE KEYS ARE `[` AND `]` AND THE PAGER'S ARE `-` AND `=`, because two different controls
   * cannot both be spelled `[ ]` on one screen — the hint row says `[ ] SORT` at every level, so
   * SORT keeps the spelling that is repeated most and the pager's label is corrected in the lab.
   * The re-order itself happens in `state.js`, against the arrays the PAINT reads.
   */
  function cycleSort(dir) {
    const keys = SORT_KEYS[S.level] || [];
    if (keys.length < 2) return;
    S.sortIdx = (((S.sortIdx | 0) + (dir > 0 ? 1 : -1)) % keys.length + keys.length) % keys.length;
    S.sortLabel = keys[S.sortIdx].label;
    S.listOffset = 0;   // page 4 of a list you just re-ordered names nothing you were looking at
  }

  /** How many rows of the ranked list are on the glass, and how many there are in total. */
  function listBounds(w, h) {
    const lg = S.listGeom;
    const g2 = geo(w, h);
    const rows = Number.isFinite(lg && lg.rows) ? lg.rows : (g2.listRows | 0);
    const totals = [D.sectorRows.length, 64, 256, D.starRows.length, D.bodies.length];
    const total = Number.isFinite(lg && lg.total) ? lg.total : (totals[S.level] || 0);
    return { rows, total };
  }

  /**
   * `-` / `=` — one page of the ranked list, clamped at both ends (AC-9).
   *
   * The rail's pager reads `1-27 OF 27524` and there has been no way to see the 28th. This writes
   * the offset; the PAINT slices by it and publishes what it sliced as `S.listGeom`, which is what
   * `rowBase()` then reads — so the pager, the drawn rows and the row picker cannot disagree. Same
   * split as `S.ladderScroll`.
   */
  function page(dir) {
    const w = lastW || nav._canvas?.width || 0, h = lastH || nav._canvas?.height || 0;
    if (!(w > 0 && h > 0)) return;
    const { rows, total } = listBounds(w, h);
    if (!(rows > 0)) return;
    const maxOff = Math.max(0, total - rows);
    S.listOffset = Math.max(0, Math.min(maxOff, (S.listOffset | 0) + (dir > 0 ? rows : -rows)));
  }

  /**
   * `/` — THE DRAWN SEARCH (AC-11). The state and the routing; the DRAWING is in the lab, and the
   * pipeline is `NavComputer`'s own — see `search.js`, which is where all three of those meet.
   *
   * ⭐ NOTHING HERE RESOLVES A NAME. `search.run()` types the query into `nav._runSearch`, which
   * calls `resolveKnownObjects` over the real catalog and its dedup aliases, the KnownSystems
   * registry and ITS alias sets, the named-systems box and the structures; `Enter` reaches
   * `nav._activateSearchHighlight()`, which arms the warp through the SAME supported `_onCommit`
   * contract the COMMIT button uses. The DOM presentation was the only part that had to go.
   *
   * ⛔ IT DOES NOT SET `nav._searchFocused`, AGAINST INTERFACE §3's PARENTHETICAL, AND THE SHIPPED
   * HANDLER IS WHY. `_onKeyDown` opens with `if (this._searchFocused) return;` (:349) — the guard
   * that keeps the DOM input's letters out of the pan handler — and every view-mode clause, INCLUDING
   * the `searchKey` one, is folded onto that same line AFTER it. Setting the flag would therefore
   * make the drawn field unreachable by the keyboard the instant it opened, Escape included, and the
   * pilot would be locked inside it. The stated GOAL is met anyway and by a shorter route:
   * `searchKey` consumes the pan letters itself, so they never reach `_heldKeys`.
   *
   * ── ⛔⛔ THREE KEYS REACH THE FIELD SECOND-HAND, AND ONE DOES NOT REACH IT AT ALL — MEASURED ───
   *
   * `NavComputer.js:349` is a single frozen line and the clauses on it run in written order:
   *
   *     `_searchFocused` guard · `,` / `.` ladder · `V` / `L` mode · **searchKey** · Tab · Enter ·
   *     `[` `]` · `-` `=` · `/`
   *
   * So the ladder clause and the mode clause both see a keystroke BEFORE the drawn field does. That
   * is not theoretical: typing `alph` produced `aph` and flipped design 2 into list mode, because
   * `L` is design 2's list toggle. `SOL`, `ALPHA`, `POLARIS` and `VOLANS` all carry an `L`.
   *
   * ⭐ THREE OF THE FOUR ARE RECOVERABLE FROM HERE, BECAUSE THOSE CLAUSES CALL DRIVER METHODS THIS
   * FILE OWNS: `scrollLadder` and `toggleList` type their key into the field instead of acting, so
   * `,` `.` and `L` all arrive intact. ⛔ `V` CANNOT BE: its clause sets `this.viewMode` inline,
   * calls `nextViewMode` / `saveViewMode` (which have no canvas) and then `_resizeCanvas` (which
   * skips this driver entirely when the mode is null), so nothing this owner controls ever sees it.
   * What it does instead is measured and pinned in `navSearch.test.js`: the query SURVIVES the
   * design switch, and on CURRENT the field eats nothing because every clause is gated on
   * `this.viewMode`. ⚠ THE REAL FIX IS ONE REORDER ON LINE 349 — move the searchKey clause ahead of
   * the ladder and mode clauses. It changes no line count and it is not this owner's file.
   */
  function searchOpen() { return search.open(); }
  function searchActive() { return search.active(); }
  function searchKey(e) { return search.key(e); }

  function remapClick(p, w, h) {
    const bars = nav.viewMode === 'bars';
    const g2 = geo(w, h);
    nav._modeTabIdx = -1;
    // ── ⭐ THE DRAWN SEARCH TAKES THE CLICK FIRST, AND IT TAKES ALL OF THEM ────────────────────
    // The DOM widget bound `mousedown` on every result row — deliberately, so the selection fired
    // before the input's blur could tear the list down — and losing the ability to click a result
    // would be a plain regression from the thing this replaces. `S.searchGeom` is the grid the PAINT
    // published, so design 1's rail rows and design 2's full-width rows are picked by one arithmetic.
    // ⛔ AND A CLICK THAT MISSES THE ROWS CLOSES THE FIELD RATHER THAN FALLING THROUGH. Falling
    //    through would drill the map underneath a field that is drawn over it — in design 2 the rows
    //    ARE the map — which is the "invisible live button" defect this workstream has now found
    //    three times. Closing is also what the DOM widget did, by blur.
    if (S.search.open) {
      const row = search.rowAt(p.x, p.y);
      if (row >= 0) search.activate(search.resultIndexOf(row));
      else search.close();
      return null;
    }
    // ── the ladder's two "..." end caps, at SYSTEM in design 1 ────────────────────────────────
    // ⛔ THE ZONE IS THE MARK PLUS A TEXEL, AND IT USED TO BE FOUR TEXELS WIDER THAN THAT — WHICH
    // ATE THE LAST BODY ON THE AXIS. `d1Ladder` draws the caps as three 1x1 texels at `x1-5, x1-3,
    // x1-1` and `x0, x0+2, x0+4`, but the test was `>= x1 - 10` / `<= x0 + 10`. The virtual axis
    // puts the FURTHEST body at `vpx(auMax) = winW - 4` by construction, which lands it at exactly
    // `x1 - 8` — inside the old zone and outside the drawn mark — so on any ladder that overflows at
    // all, the outermost planet could not be clicked: the click scrolled instead, by the four texels
    // of overflow, and the planet stayed where it was. Found by measurement, 2026-09-08, on a
    // three-body system whose overflow was 4 texels. ⚠ `CAP_GRAB` is 6, not 5, so the mark keeps a
    // one-texel skirt; anything wider starts taking pixels the pilot can see a planet in.
    const caps = S.ladderCaps, CAP_GRAB = 6;
    if (!bars && S.level === 4 && caps && (S.ladderMax || 0) > 0
        && p.y >= caps.axisY - 6 && p.y <= caps.axisY + 6) {
      if ((S.ladderScroll || 0) > 0 && p.x <= caps.x0 + CAP_GRAB) { scrollLadder(-1); return null; }
      if ((S.ladderScroll || 0) < S.ladderMax && p.x >= caps.x1 - CAP_GRAB) { scrollLadder(1); return null; }
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
    S, D, render, bufferFor, applySurface, hover, resolveHover, remapClick, geo, scrollLadder,
    tabLevel, commit, cycleSort, page, searchOpen, searchActive, searchKey,
    regions: designs.regions,
    violations: () => violations.slice(),
    /**
     * Design 2's list mode — its one answer to the comparison problem.
     *
     * ⛔ AND WHILE THE DRAWN FIELD IS OPEN, `L` IS A LETTER. Same defect and same recovery as
     * `scrollLadder`'s, and this one is the expensive half of it: the `KeyL` clause is folded onto
     * `NavComputer.js:349` AHEAD of the search-routing clause, so typing SOL, ALPHA, POLARIS or
     * VOLANS into the field flipped design 2 into list mode and dropped the letter. Measured: the
     * query `alph` came out as `aph` with the map replaced by a star table. The clause routes `L`
     * to this method, so this method can put it where it belongs. See `searchOpen`.
     */
    toggleList: () => {
      if (S.search.open) { search.key({ code: 'KeyL', key: 'l' }); return; }
      S.list = !S.list;
    },
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
