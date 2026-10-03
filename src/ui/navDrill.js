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
import { findStar } from './navViewModes/starIdentity.js';

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

/** Make `column` the one PRISM shows: the loader's box and the WASD clamp both read it. */
export function setColumn(nav, column) {
  nav._prismColumn = column || null;
  if (column) nav._localCubeSize = column.halfWidth;
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
export function showPick(nav, level, childAddress) {
  nav._hoveredTile = navGrid.hoverTile(level, childAddress);
  const S = nav.viewMode && nav._viewDriverInst && nav._viewDriverInst.S;
  if (S && nav._hoveredTile) S.pick = { level, address: nav._hoveredTile.address, tMs: simClockMs() };
  return nav._hoveredTile;
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
 * The legacy prism's "here" row: on the PLAYER'S column, the loaded row that is the player's own star
 * (identity rule, `findStar` at the player's position), else the row carrying the current system's
 * name; on any other column, none — never the nearest browsed row (plan §6; NavComputer.js:2052).
 */
export function hereStar(nav, rows) {
  if (!onPlayerColumn(nav) || !rows || !rows.length) return null;
  const P = { wx: nav._playerX, wy: Number.isFinite(nav._playerY) ? nav._playerY : 0, wz: nav._playerZ };
  return findStar(rows, P) || (nav._currentSystemName ? rows.find((s) => s.name === nav._currentSystemName) || null : null);
}

/** Distance from the player, kpc — what a nav row's `dist` means (plan §6), not the query centre's. */
export function playerDistKpc(nav, x, y, z) {
  return Math.hypot(x - nav._playerX, y - (Number.isFinite(nav._playerY) ? nav._playerY : 0), z - nav._playerZ);
}
