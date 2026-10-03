/**
 * navDrill.js — what the nav DOES with `navGrid`'s answers: the drill, the default views, the PRISM
 * column, and the legacy look's grids (naming-prism-segments Phase 2, HOST lane; AC-3 / AC-4 / AC-5).
 *
 * Max's rule, verbatim (2026-10-02): *"each cell in the galaxy should represent a single sector …
 * Every cell in the sector view should be displaying a single region. Every cell in the region view
 * should be displaying a single prism."*
 *
 * `navGrid.js` answers "what is this cell / what does this screen frame" as pure arithmetic. This
 * file is the other half of the seam: it writes those answers into a NavComputer (`_viewStack`,
 * `_prismColumn`, `_localCenter`, the drill animation) and gives the legacy look its projection
 * and hover. Every entry path goes through it —
 *
 *   · a click on a 2D cell (NavComputer `_handleClick`, both the designs and the legacy look),
 *   · the default views built when the nav opens (`_setupViewStackForPlayer`), which SNAP to the
 *     player's own sector, region and column,
 *   · and the autopilot's drill (`AutopilotNavSequence`), which used to carry its own 8 × 8 / 44 kpc
 *     grid and an adaptive PRISM box and now calls `drillInto` with the cells `navGrid.drillPath`
 *     names — so the cells it highlights and flies to are the ones a pilot's clicks would.
 *
 * Why a module and not NavComputer methods: NavComputer.js is held at 4711 lines for its ~700
 * line-anchored citations (plan §7.3), so it gets call-site changes only.
 *
 * Deliberate non-goals · no grid arithmetic (that is `navGrid` / `GalaxyGrid`, and nothing here
 * re-derives a cell from a view's centre and size); no slab loading (Phase 3 owns the loader — PRISM
 * keeps today's loader, pointed at the column); no restyling of the legacy look (its grids are kept
 * correct, one cell = one place, in its existing colours).
 */
import * as navGrid from './navGrid.js';
import { navMapSize, navMapOriginY } from './navLayout.js';
import { simClockMs } from '../core/SimClock.js';
import { hereRowOf } from './navViewModes/starIdentity.js';

/** The PRISM camera's radius on entry, kpc (~5 light years). Inside the plan's zoom range. */
export const PRISM_ENTRY_RADIUS_KPC = 0.0015;

/** Drill durations, ms, by the level the click is made on (the shipped manual values). */
const DRILL_MS = [500, 400, 500];

/**
 * A view-stack entry for the screen at `level` about `address`'s parent at that level:
 * `{ center:{x,z}, size, address }` — the parent's exact square (`navGrid.viewForAddress`).
 * SECTOR entries also carry `sectorName` (the grid reference until Phase 4 gives sectors words).
 */
export function stackEntry(level, address) {
  const v = navGrid.viewForAddress(level, address);
  if (!v) return null;
  const e = { center: { x: v.cx, z: v.cz }, size: v.size, address: level === navGrid.GALAXY ? null : navGrid.parentOf(level, address) };
  if (level === navGrid.SECTOR) e.sectorName = navGrid.childRef(navGrid.GALAXY, e.address);
  return e;
}

/** The three 2D screens' default frames for a point: GALAXY, its sector, its region. */
export function stackFor(x, z) {
  const out = [stackEntry(navGrid.GALAXY, null)];
  for (let level = navGrid.SECTOR; level <= navGrid.REGION; level++) {
    const e = stackEntry(level, navGrid.parentAt(level, x, z));
    if (!e) break;
    out.push(e);
  }
  return out;
}

/** The column holding a point, as `navGrid.enterColumn` describes it (null off the map). */
export function columnAt(x, z) {
  const a = navGrid.parentAt(navGrid.PRISM, x, z);
  return a ? navGrid.enterColumn(a) : null;
}

/** The player's sector as the record the HUD and the legacy GALAXY overlay read (`id`, `name`,
 *  `centerX`, `centerZ`, `size`, `address`); null outside the 293 drawn sectors. */
export function sectorRecordAt(x, z) {
  const a = navGrid.parentAt(navGrid.SECTOR, x, z);
  const t = a && navGrid.hoverTile(navGrid.GALAXY, a);
  return t ? { id: t.ref, ...t.sector } : null;
}

/**
 * Make `column` the one PRISM shows: the loader's box and the WASD clamp both read it.
 *
 * ⭐ AND THE COLUMN NEVER CHANGES ALONE (Astra phase-2 review, finding 1). When the column on the
 * glass becomes a DIFFERENT one, the rows loaded for the old one are dropped (they are not this
 * column's stars) and the camera is put inside the new one — on the player when the player stands in
 * it, else on its centre, keeping its height. ⛔ It used to write `_prismColumn` and nothing else, so
 * design 2's HERE at SECTOR/REGION swapped in the player's column while the camera stayed in the
 * column browsed before (5.7 kpc away), and Tab into PRISM showed an empty frame until WASD snapped
 * it back. Callers that place the camera themselves (the drill, `jumpTo`) simply overwrite it after.
 */
export function setColumn(nav, column) {
  const prev = nav._prismColumn;
  nav._prismColumn = column || null;
  if (!column) return;
  nav._localCubeSize = column.halfWidth;
  const changed = !prev || !navGrid.sameAddress(prev.address, column.address);
  if (changed && prev) {
    nav._localStars = [];
    if (typeof nav._resetPrismLoad === 'function') nav._resetPrismLoad();
  }
  keepCameraInColumn(nav, changed);
}

/**
 * The PRISM camera's orbit centre is inside the column on the glass. `recentre` (the column just
 * changed): the player's point (and height) when the player stands in the column, else the column's centre.
 * Otherwise a camera already inside is left alone and one outside is clamped to the nearest edge.
 */
export function keepCameraInColumn(nav, recentre = false) {
  const col = nav._prismColumn;
  if (!col || !col.bounds) return;
  const lc = nav._localCenter;
  const y = lc && Number.isFinite(lc.y) ? lc.y : (Number.isFinite(nav._playerY) ? nav._playerY : 0);
  const inside = (x, z) => Number.isFinite(x) && Number.isFinite(z)
    && x >= col.bounds.min.x && x <= col.bounds.max.x && z >= col.bounds.min.z && z <= col.bounds.max.z;
  if (recentre || !lc || !inside(lc.x, lc.z)) {
    if (recentre && inside(nav._playerX, nav._playerZ)) nav._localCenter = { x: nav._playerX, y: Number.isFinite(nav._playerY) ? nav._playerY : y, z: nav._playerZ };
    else if (recentre || !lc || !Number.isFinite(lc.x) || !Number.isFinite(lc.z)) nav._localCenter = { x: col.center.x, y, z: col.center.z };
    else { const c = navGrid.clampToColumn(col, lc.x, lc.z); nav._localCenter = { x: c.x, y, z: c.z }; }
  }
}

/** Is `a` inside (or equal to) the box `parent` names — every part `parent` has, `a` shares? */
function within(a, parent) {
  if (!parent) return true;
  if (!a || !a.sector || a.sector.i !== parent.sector.i || a.sector.j !== parent.sector.j) return false;
  if (parent.region && (!a.region || a.region.i !== parent.region.i || a.region.j !== parent.region.j)) return false;
  if (parent.prism && (!a.prism || a.prism.i !== parent.prism.i || a.prism.j !== parent.prism.j)) return false;
  return true;
}

/** The point a new descendant of `parent` is taken at: the player's, when the player stands in
 *  `parent`; else the parent's centre. */
function pointIn(nav, level, parent) {
  if (Number.isFinite(nav._playerX) && Number.isFinite(nav._playerZ)
      && within(navGrid.parentAt(level, nav._playerX, nav._playerZ), parent)) return { x: nav._playerX, z: nav._playerZ };
  const v = navGrid.viewForAddress(level, parent);
  return { x: v.cx, z: v.cz };
}

/**
 * ⭐ THE SAVED SCREENS BELOW `level` STAY INSIDE IT (Astra phase-2 review, finding 1). The tab strip,
 * Tab and ESC go back to `_viewStack[k]` and to `_prismColumn`; after the parent at `level` changes,
 * a deeper entry still naming the OLD parent's child is a screen that is not inside the one above it
 * (drill GALAXY → P8, Tab to REGION, and you were shown the player's N10 H9). Each deeper entry that
 * no longer lies inside its parent is replaced by the child holding the player, when the player is
 * in that parent, else the child at the parent's centre; then the column, the same way.
 */
export function reconcileBelow(nav, level) {
  const stack = nav._viewStack;
  if (!stack) return;
  for (let k = Math.max(level + 1, navGrid.SECTOR); k <= navGrid.REGION; k++) {
    const up = k === navGrid.SECTOR ? null : stack[k - 1] && stack[k - 1].address;
    if (k > navGrid.SECTOR && !up) return;
    const e = stack[k];
    if (e && e.address && within(e.address, up)) continue;
    const pt = up ? pointIn(nav, k - 1, up) : null;
    if (!pt) continue;   // SECTOR with no GALAXY parent to reconcile against: nothing to do
    stack[k] = stackEntry(k, navGrid.parentAt(k, pt.x, pt.z));
  }
  const region = stack[navGrid.REGION] && stack[navGrid.REGION].address;
  const col = nav._prismColumn;
  if (region && (!col || !within(col.address, region))) {
    const pt = pointIn(nav, navGrid.REGION, region);
    setColumn(nav, navGrid.enterColumn(navGrid.parentAt(navGrid.PRISM, pt.x, pt.z)));
  }
}

/**
 * ⭐ THE DRILL — the one consequence of picking a child cell on a 2D screen, for every caller.
 * GALAXY / SECTOR: the child becomes the next screen's parent; its exact square is recorded in
 * `_viewStack[level + 1]` (with its address) and the view animates to it. REGION: the clicked prism
 * is the column PRISM shows (`_prismColumn`), the camera starts on its centre, and the view animates
 * into it. Returns `navGrid.nextView`'s answer, or null when the address is not a child here.
 *
 * opts · `duration` (ms) · `sound` (false: the caller plays its own) · PRISM only: `y` (camera
 * height, default the player's), `tiltTo` (the settle angle, default 0.5), `tiltStart` (default
 * null = the first frame), `rotY` (set the camera's azimuth; omitted = left alone).
 */
export function drillInto(nav, level, childAddress, opts = {}) {
  const nv = navGrid.nextView(level, childAddress);
  if (!nv) return null;
  const from = { x: nav._viewCenter.x, z: nav._viewCenter.z }, fromSize = nav._viewSize;
  const duration = Number.isFinite(opts.duration) ? opts.duration : DRILL_MS[level];
  if (opts.sound !== false && nav._onDrillSound) nav._onDrillSound(nv.level);
  if (nv.view) {
    const e = stackEntry(nv.level, nv.address);
    nav._viewStack[nv.level] = e;
    reconcileBelow(nav, nv.level);   // the deeper saved screens and the column follow the new parent
    nav._startDrillAnim(from, fromSize, { x: e.center.x, z: e.center.z }, e.size, nv.level, duration);
  } else {
    const col = nv.column;
    setColumn(nav, col);
    nav._localCenter = { x: col.center.x, y: Number.isFinite(opts.y) ? opts.y : nav._playerY, z: col.center.z };
    nav._localRadius = PRISM_ENTRY_RADIUS_KPC;
    nav._localGridCell = 0.001;
    nav._localStars = [];
    nav._resetPrismLoad();
    // Start top-down (matching the 2D screen it leaves), then settle to the camera's angle.
    nav._localRotX = Math.PI / 2;
    nav._tiltAnim = { startTime: opts.tiltStart ?? null, duration: 600, from: Math.PI / 2, to: Number.isFinite(opts.tiltTo) ? opts.tiltTo : 0.5 };
    if (Number.isFinite(opts.rotY)) nav._localRotY = opts.rotY;
    nav._startDrillAnim(from, fromSize, { x: col.center.x, z: col.center.z }, navGrid.easeSize(level, fromSize), nv.level, duration);
  }
  nav._hoveredTile = null;
  return nv;
}

/**
 * Put the nav straight onto a screen with no animation (the autopilot's styles that skip levels):
 * `_viewStack` is the address's own GALAXY → `level` chain, and the view frames `level`'s parent.
 * At PRISM it also enters the address's column (camera height `y`, default the player's).
 */
export function jumpTo(nav, level, address, { y } = {}) {
  const deepest = Math.min(level, navGrid.REGION);
  const stack = [stackEntry(navGrid.GALAXY, null)];
  for (let l = navGrid.SECTOR; l <= deepest; l++) stack.push(stackEntry(l, address));
  nav._viewStack = stack;
  const top = stack[deepest];
  nav._viewCenter = { x: top.center.x, z: top.center.z };
  nav._viewSize = top.size;
  nav._levelIndex = level;
  nav._hoveredTile = null;
  nav._localStars = [];
  nav._resetPrismLoad();
  if (level === navGrid.PRISM) {
    const col = navGrid.enterColumn(address);
    setColumn(nav, col);
    nav._localCenter = { x: col.center.x, y: Number.isFinite(y) ? y : nav._playerY, z: col.center.z };
    nav._localRadius = PRISM_ENTRY_RADIUS_KPC;
    nav._localGridCell = 0.001;
  }
}

/**
 * Light a cell the way a pilot's click would, for a drill the pilot did not make (the autopilot):
 * `_hoveredTile` for the legacy look's hover frame, and — under a 240p design — the driver's
 * `S.pick`, the clicked-cell highlight the designs paint (they draw no hover frame at 2D).
 */
export function showPick(nav, level, childAddress, { holdMs } = {}) {
  nav._hoveredTile = navGrid.hoverTile(level, childAddress);
  const now = simClockMs();
  // ⭐ THE HIGHLIGHT LASTS THROUGH THE HOVER AND THE ZOOM (Astra phase-2 review, finding 5). The
  //    autopilot hovers 800 / 700 ms and then drills for 500-600 ms, but a design's pick expired after
  //    its 700 ms backstop and legacy GALAXY's paint replaced it with the physical pointer's cell. So
  //    the pick carries its own lifetime (`holdMs`), the design's backstop honours it, and while it
  //    runs the pointer does not repaint the hover (`pickHeld`). The level change still ends it.
  const hold = Number.isFinite(holdMs) && holdMs > 0 ? holdMs : 0;
  nav._pickHoldUntil = hold ? now + hold : 0;
  const S = nav.viewMode && nav._viewDriverInst && nav._viewDriverInst.S;
  if (S && nav._hoveredTile) S.pick = { level, address: nav._hoveredTile.address, tMs: now, ...(hold ? { holdMs: hold } : {}) };
  return nav._hoveredTile;
}

/** Is a performed pick (the autopilot's) still on the glass? While it is, the pointer's hover does
 *  not replace it. */
export function pickHeld(nav) {
  return !!nav && Number.isFinite(nav._pickHoldUntil) && nav._pickHoldUntil > 0 && simClockMs() < nav._pickHoldUntil;
}

/** The world point's texel on whichever map is on the glass: a design's published `S.mapProj`
 *  when one is drawn, else the legacy map square. For the autopilot's cursor. */
export function screenPointOf(nav, x, z) {
  const mp = nav.viewMode && nav._viewDriverInst && nav._viewDriverInst.S && nav._viewDriverInst.S.mapProj;
  if (mp && mp.kind === 'grid' && mp.size > 0) {
    const k = mp.sq / mp.size;
    return { x: mp.x0 + mp.sq / 2 + (x - mp.cx) * k, y: mp.y0 + mp.sq / 2 - (z - mp.cz) * k };
  }
  const P = legacyProj(nav);
  return { x: P.toX(x), y: P.toY(z) };
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// THE LEGACY LOOK — kept correct (one cell = one place), not restyled.
// ════════════════════════════════════════════════════════════════════════════════════════════════

/** The legacy 2D map's projection (`_render2DLevel`'s own: `navMapSize` square, +z up). */
export function legacyProj(nav, w = nav._canvas.width, h = nav._canvas.height) {
  const drawSize = navMapSize(w, h), ox = (w - drawSize) / 2, oy = navMapOriginY(h);
  const cx = nav._viewCenter.x, cz = nav._viewCenter.z, size = nav._viewSize, ext = size / 2;
  const k = drawSize / size;
  return {
    ox, oy, drawSize, k,
    toX: (x) => ox + (x - cx + ext) * k,
    toY: (z) => oy + (-(z - cz) + ext) * k,
    toWorld: (px, py) => ({ x: cx - ext + (px - ox) / k, z: cz + ext - (py - oy) / k }),
  };
}

/** The parent a legacy 2D screen is about: the address the view stack recorded, else the parent
 *  under the frame's centre (the same rule the designs' driver uses). */
export function legacyParent(nav, level) {
  if (level < navGrid.SECTOR || level > navGrid.REGION) return null;
  const st = nav._viewStack && nav._viewStack[level];
  return (st && st.address && navGrid.parentOf(level, st.address))
    || navGrid.parentAt(level, nav._viewCenter.x, nav._viewCenter.z);
}

/** The legacy hover at a 2D level: the child of the screen's parent under the pointer, as a
 *  `navGrid.hoverTile` payload (null off the parent, or on an undrawn GALAXY corner). */
export function legacyHoverAt(nav, level, px, py) {
  const P = legacyProj(nav);
  if (px < P.ox || px > P.ox + P.drawSize || py < P.oy || py > P.oy + P.drawSize) return null;
  const wpt = P.toWorld(px, py);
  const c = navGrid.cellAt(level, legacyParent(nav, level), wpt.x, wpt.z);
  return c ? navGrid.hoverTile(level, c) : null;
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// "HERE" — WORKED OUT FROM THE PLAYER (AC-5)
// ════════════════════════════════════════════════════════════════════════════════════════════════

/** Is the column on the glass the player's own? (`GalaxyGrid.addressOf` of the player's position.) */
export function onPlayerColumn(nav) {
  const col = nav._prismColumn;
  if (!col || !Number.isFinite(nav._playerX) || !Number.isFinite(nav._playerZ)) return false;
  return navGrid.sameAddress(navGrid.parentAt(navGrid.PRISM, nav._playerX, nav._playerZ), col.address);
}

/**
 * Is the screen a legacy level shows the PLAYER'S OWN PLACE at that level? The galaxy always; the
 * player's own sector / region (`legacyParent` against the parent under the player); the player's
 * column (`onPlayerColumn`); the system the ship is in (`_isCurrentSystem`).
 * ⭐ batch 2 fixup (AC-15) — the legacy tab strip wears CURRENT on exactly these, the rule the 240p
 * designs' `onPlayerPlace` (designs.js) already draws; browsing anywhere else is not "current".
 */
export function onPlayerPlace(nav, level) {
  if (level === navGrid.GALAXY) return true;
  if (level === navGrid.SECTOR || level === navGrid.REGION) {
    if (!Number.isFinite(nav._playerX) || !Number.isFinite(nav._playerZ) || !nav._viewCenter) return false;
    return navGrid.sameAddress(navGrid.parentAt(level, nav._playerX, nav._playerZ), legacyParent(nav, level));
  }
  if (level === navGrid.PRISM) return onPlayerColumn(nav);
  return typeof nav._isCurrentSystem === 'function' && !!nav._isCurrentSystem();
}

/**
 * The legacy prism's "here" row: on the PLAYER'S column, the loaded row that IS the player's own star
 * (`hereRowOf` — the one resolver both designs and the self-warp guard use); on any other column,
 * none — never the nearest browsed row (plan §6; NavComputer.js:2052).
 * ⛔ No name fallback any more (Astra phase-2 review, finding 2): "any row in the column with the
 * current system's name" took a same-name star 2 pc away as the player's. When the player's own row
 * is not loaded the player marker stands in, as it always has.
 */
export function hereStar(nav, rows) {
  if (!onPlayerColumn(nav) || !rows || !rows.length) return null;
  return hereRowOf(nav, rows);
}

/** Distance from the player, kpc — what a nav row's `dist` means (plan §6), not the query centre's. */
export function playerDistKpc(nav, x, y, z) {
  return Math.hypot(x - nav._playerX, y - (Number.isFinite(nav._playerY) ? nav._playerY : 0), z - nav._playerZ);
}
