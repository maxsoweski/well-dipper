/**
 * navGrid.js — the ONE answer to "what does each nav screen show, and which cell is under this point"
 * (naming-prism-segments Phase 2, AC-3 / AC-4 / AC-5; plan §0, §4.1, §6).
 *
 * Max's rule, verbatim (2026-10-02): *"each cell in the galaxy should represent a single sector …
 * Every cell in the sector view should be displaying a single region. Every cell in the region view
 * should be displaying a single prism."*
 *
 * So every screen is one PARENT box cut into its exact CHILD boxes, and both are boxes of the frozen
 * grid in `GalaxyGrid.js` — never a subdivision of whatever the view happens to frame:
 *
 *   level 0  GALAXY   parent = the 19 × 19 naming area     children = sectors  (2 kpc)
 *   level 1  SECTOR   parent = one sector                  children = regions  (125 pc, 16 × 16)
 *   level 2  REGION   parent = one region                  children = prisms   (7.8125 pc, 16 × 16)
 *   level 3  PRISM    parent = one prism column            (no children: the stars)
 *
 * ⛔ PURE ARITHMETIC OVER `GalaxyGrid` — no view state, no canvas, no density model. The designs'
 * painters and pickers, NavComputer's drill / default view / legacy grids, the autopilot and the
 * here-resolver all call THESE functions; nobody re-derives a cell from a view's centre and size.
 * Before this file the GALAXY grid, the SECTOR/REGION tiles, the autopilot's 8 × 8 / 44 kpc grid and
 * the legacy grid were four separate subdivisions, and a click could land somewhere the cell under
 * the pointer did not name.
 *
 * ⭐ ADDRESSES are `GalaxyGrid` addresses, truncated to the level they name:
 *   sector `{ sector:{i,j} }` · region `{ sector, region }` · prism column `{ sector, region, prism }`.
 * `{i, j}` is {column from the left, row from the TOP}; row 1 is the LARGEST z (GalaxyGrid §4.1).
 * A screen therefore draws +z UP — the same direction as legacy's map and the luminosity image.
 *
 * Deliberate non-goals · no slabs (Phase 3's loader and segment bar own the height), no names
 * (Phase 4/5 give sectors words; until then a sector's name is its grid reference), no loading.
 */
import {
  addressOf, boundsOf, sectorRef, regionRef, prismRef,
  SECTOR_KPC, REGION_KPC, PRISM_KPC, REGION_DIV, PRISM_DIV, SECTORS_PER_AXIS, GRID_MIN_KPC, GRID_MAX_KPC,
} from '../generation/GalaxyGrid.js';

export const GALAXY = 0, SECTOR = 1, REGION = 2, PRISM = 3;

/** Plan §0.4: the 293 sectors that touch R ≤ 18 kpc are drawn; the 68 corners do not and are not.
 *  18 kpc is the starfield's own rim (`HashGridStarfield` rejects cells whose centre is beyond it). */
export const DISC_R_KPC = 18;

/** PRISM zoom, plan §6: from 0.0015 kpc up to max(0.01 kpc, 2 × column width) — no longer tied to
 *  the old density tile. The camera radius, not the column, is what the wheel moves. */
export const PRISM_ZOOM_MIN_KPC = 0.0015;
export const PRISM_ZOOM_MAX_KPC = Math.max(0.01, 2 * PRISM_KPC);   // 0.015625

const LETTERS = 'ABCDEFGHIJKLMNOPQRS';

/** Cells per axis on a screen: 19 sectors across GALAXY, 16 regions / 16 prisms below. */
export function childCount(level) {
  if (level === GALAXY) return SECTORS_PER_AXIS;
  if (level === SECTOR) return REGION_DIV;
  if (level === REGION) return PRISM_DIV;
  return 0;
}

/** Width of one child cell in kpc at a screen level (2, 0.125, 0.0078125). */
export function childKpc(level) {
  if (level === GALAXY) return SECTOR_KPC;
  if (level === SECTOR) return REGION_KPC;
  if (level === REGION) return PRISM_KPC;
  return 0;
}

const okCell = (c, n) => !!c && Number.isInteger(c.i) && Number.isInteger(c.j) && c.i >= 0 && c.j >= 0 && c.i < n && c.j < n;
const okSector = (s) => !!s && Number.isInteger(s.i) && Number.isInteger(s.j);

/** Copy an address down to the parts a level names (null for GALAXY, or for an address too short). */
function truncate(address, parts) {
  if (parts === 0) return null;
  if (!address || !okSector(address.sector)) return null;
  const out = { sector: { i: address.sector.i, j: address.sector.j } };
  if (parts >= 2) { if (!okCell(address.region, REGION_DIV)) return null; out.region = { i: address.region.i, j: address.region.j }; }
  if (parts >= 3) { if (!okCell(address.prism, PRISM_DIV)) return null; out.prism = { i: address.prism.i, j: address.prism.j }; }
  return out;
}

/** The PARENT a screen at `level` is about, from any address deep enough (GALAXY → null). */
export function parentOf(level, address) {
  return truncate(address, level);
}

/** The CHILD address a cell at `level` names, from any address deep enough. */
export function childOf(level, address) {
  return truncate(address, level + 1);
}

/** The parent a screen at `level` would show for the point (x, z) — e.g. the player's sector at
 *  level 1, the player's region at level 2, the player's column at level 3. GALAXY → null. */
export function parentAt(level, x, z) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
  return truncate(addressOf(x, 0, z), level);
}

/** Same box? Compares only the parts both levels share; null === null (the galaxy). */
export function sameAddress(a, b) {
  if (!a || !b) return !a && !b;
  const eq = (p, q) => (!p && !q) || (!!p && !!q && p.i === q.i && p.j === q.j);
  return eq(a.sector, b.sector) && eq(a.region, b.region) && eq(a.prism, b.prism);
}

/** "N10" / "N10 H9" / "N10 H9 P1" — a printable, unique key for an address (null → "GALAXY"). */
export function addressKey(a) {
  if (!a) return 'GALAXY';
  const parts = [sectorRef(a) ?? `(${a.sector.i},${a.sector.j})`];
  if (a.region) parts.push(regionRef(a));
  if (a.prism) parts.push(prismRef(a));
  return parts.join(' ');
}

/** The edge label a child cell carries on its own screen: A–S1–19 on GALAXY, A–P1–16 below. */
export function childRef(level, childAddress) {
  if (!childAddress) return null;
  if (level === GALAXY) return sectorRef(childAddress);
  if (level === SECTOR) return regionRef(childAddress);
  if (level === REGION) return prismRef(childAddress);
  return null;
}

/** The labels down the edges of a screen: letters across (left → right), numbers down (top → bottom). */
export function axisLabels(level) {
  const n = childCount(level);
  return { cols: Array.from({ length: n }, (_, i) => LETTERS[i]), rows: Array.from({ length: n }, (_, j) => String(j + 1)) };
}

/** The galaxy's own box — the 19 × 19 naming area. */
function galaxyBounds() {
  return { min: { x: GRID_MIN_KPC, y: -Infinity, z: GRID_MIN_KPC }, max: { x: GRID_MAX_KPC, y: Infinity, z: GRID_MAX_KPC } };
}

/** The box a level's PARENT occupies ({min, max} in kpc, exact GalaxyGrid doubles). */
export function parentBounds(level, parentAddress) {
  if (level === GALAXY) return galaxyBounds();
  const p = truncate(parentAddress, level);
  return p ? boundsOf(p) : null;
}

/**
 * ⭐ SEAM — the exact frame the screen at `level` shows for `address`'s parent at that level:
 * `{ cx, cz, size }` in kpc, the parent's own square. GALAXY ignores the address and frames the
 * whole 19 × 19 naming area (38 kpc). PRISM frames the column's footprint (7.8125 pc).
 * `null` for an address too short for the level.
 */
export function viewForAddress(level, address) {
  const b = parentBounds(level, address);
  if (!b) return null;
  return { cx: (b.min.x + b.max.x) / 2, cz: (b.min.z + b.max.z) / 2, size: b.max.x - b.min.x };
}

/** Is a sector one of the 293 drawn ones — does its square touch R ≤ 18 kpc? */
export function sectorLive(address) {
  const s = address?.sector;
  if (!okCell(s, SECTORS_PER_AXIS)) return false;
  const b = boundsOf({ sector: s });
  const nx = Math.max(b.min.x, Math.min(0, b.max.x)), nz = Math.max(b.min.z, Math.min(0, b.max.z));
  return Math.hypot(nx, nz) <= DISC_R_KPC;
}

/**
 * ⭐ SEAM — the child cell of `parentAddress` under the world point (x, z), at `level`, or null.
 * Null when the point is outside the parent (a neighbouring parent is not this screen's cell), off
 * the naming area, or — on GALAXY — in one of the 68 undrawn corner sectors.
 */
export function cellAt(level, parentAddress, x, z) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
  if (level < GALAXY || level > REGION) return null;
  const a = addressOf(x, 0, z);
  if (level === GALAXY) {
    const c = { sector: a.sector };
    return sectorLive(c) ? c : null;
  }
  const parent = truncate(parentAddress, level);
  if (!parent || !sameAddress(parent, truncate(a, level))) return null;
  return truncate(a, level + 1);
}

/**
 * ⭐ SEAM — every child cell of a screen, n × n, in reading order (rows from the top, then columns
 * left → right): `{ address, ref, i, j, bounds, live }`. `bounds` is exactly `GalaxyGrid.boundsOf`
 * of the child. `live` is false only for GALAXY's 68 undrawn corners; painters skip those and
 * `cellAt` never answers one. `[]` for a level with no grid or a parent too short.
 */
export function childGrid(level, parentAddress) {
  const n = childCount(level);
  if (!n) return [];
  const parent = level === GALAXY ? null : truncate(parentAddress, level);
  if (level !== GALAXY && !parent) return [];
  const out = [];
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      let address;
      if (level === GALAXY) address = { sector: { i, j } };
      else if (level === SECTOR) address = { sector: { ...parent.sector }, region: { i, j } };
      else address = { sector: { ...parent.sector }, region: { ...parent.region }, prism: { i, j } };
      out.push({ address, ref: childRef(level, address), i, j, bounds: boundsOf(address),
                 live: level === GALAXY ? sectorLive(address) : true });
    }
  }
  return out;
}

/** One child cell, as `childGrid` would list it (null for an address that is not a child here). */
export function childCell(level, childAddress) {
  const a = truncate(childAddress, level + 1);
  if (!a || level < GALAXY || level > REGION) return null;
  const c = level === GALAXY ? a.sector : level === SECTOR ? a.region : a.prism;
  if (level === GALAXY && !okCell(c, SECTORS_PER_AXIS)) return null;
  return { address: a, ref: childRef(level, a), i: c.i, j: c.j, bounds: boundsOf(a),
           live: level === GALAXY ? sectorLive(a) : true };
}

/**
 * ⭐ SEAM — entering PRISM: the ONE fixed column for a prism address.
 * `{ address, center:{x, z}, halfWidth, bounds, zoomMin, zoomMax }`. The column is 7.8125 pc wide
 * everywhere; WASD clamps the camera inside it (`clampToColumn`), and the zoom range is the plan's,
 * so pulling back can show past the column's edge without moving it.
 */
export function enterColumn(address) {
  const a = truncate(address, 3);
  if (!a) return null;
  const b = boundsOf(a);
  return {
    address: a, bounds: b,
    center: { x: (b.min.x + b.max.x) / 2, z: (b.min.z + b.max.z) / 2 },
    halfWidth: PRISM_KPC / 2,
    zoomMin: PRISM_ZOOM_MIN_KPC, zoomMax: PRISM_ZOOM_MAX_KPC,
  };
}

/**
 * Keep a camera point inside a column (WASD stops at its edge). Clamps to the CLOSED footprint:
 * the upper face is the next column's, but a camera resting on it frames this column — it is a
 * camera, not a star, so it needs no owner.
 */
export function clampToColumn(column, x, z) {
  const b = column && column.bounds;
  if (!b) return { x, z };
  return { x: Math.max(b.min.x, Math.min(b.max.x, x)), z: Math.max(b.min.z, Math.min(b.max.z, z)) };
}

/** Is the world point inside a box's x/z footprint (half-open, the grid's own ownership rule)? */
export function inFootprint(bounds, x, z) {
  return !!bounds && x >= bounds.min.x && x < bounds.max.x && z >= bounds.min.z && z < bounds.max.z;
}

/**
 * ⭐ SEAM — the hover payload a 2D screen hands NavComputer for a child cell (`_hoveredTile`):
 * `{ level, address, ref, bounds, center, size, sector? }`. `address` is the CHILD's; the drill goes
 * to `nextView(level, address)`. At GALAXY it also carries `sector: { centerX, centerZ, size, name }`
 * — the exact sector square — the shape the shipped level-0 drill already reads.
 */
export function hoverTile(level, childAddress) {
  const c = childCell(level, childAddress);
  if (!c || (level === GALAXY && !c.live)) return null;
  const b = c.bounds;
  const center = { x: (b.min.x + b.max.x) / 2, z: (b.min.z + b.max.z) / 2 };
  const size = b.max.x - b.min.x;
  const out = { level, address: c.address, ref: c.ref, bounds: b, center, size };
  if (level === GALAXY) out.sector = { centerX: center.x, centerZ: center.z, size, name: c.ref, address: c.address };
  return out;
}

/**
 * ⭐ SEAM — where clicking a child at `level` goes: `{ level: level + 1, address, view }` for
 * GALAXY / SECTOR (the child becomes the next screen's parent and `view` is its exact frame), and
 * `{ level: 3, address, column }` for REGION (the clicked prism is the column entered).
 */
export function nextView(level, childAddress) {
  const a = truncate(childAddress, level + 1);
  if (!a || level < GALAXY || level > REGION) return null;
  if (level === GALAXY && !sectorLive(a)) return null;
  if (level === REGION) return { level: PRISM, address: a, column: enterColumn(a) };
  return { level: level + 1, address: a, view: viewForAddress(level + 1, a) };
}

/**
 * ⭐ SEAM — the drill a pilot (or the autopilot) makes from GALAXY to the column holding (x, z):
 * one step per screen, `{ level, parent, view, child, ref }`, ending with `{ level: 3, column }`.
 * Each step's `child` is the cell the screen highlights and clicks; the autopilot shows exactly these.
 */
export function drillPath(x, z) {
  const full = Number.isFinite(x) && Number.isFinite(z) ? addressOf(x, 0, z) : null;
  if (!full || !sectorLive({ sector: full.sector })) return null;
  const steps = [];
  for (let level = GALAXY; level <= REGION; level++) {
    const parent = truncate(full, level), child = truncate(full, level + 1);
    steps.push({ level, parent, view: viewForAddress(level, parent), child, ref: childRef(level, child) });
  }
  const col = enterColumn(full);
  steps.push({ level: PRISM, parent: col.address, view: viewForAddress(PRISM, col.address), column: col });
  return steps;
}

/**
 * The zoom window a 2D screen eases to or from when it hands over to PRISM or SYSTEM: half a child
 * cell of the frame it is in. One spelling for the inbound ease (navViewModes/state.js) and the
 * outbound one (NavComputer's `_viewEase`), so the two are mirror images.
 */
export function easeSize(level, viewSize) {
  const n = childCount(level) || 16;
  return viewSize / (n * 2);
}
