/**
 * GalaxyGrid — the ONE fixed galaxy grid, and the ONE key namespace for stars
 * (naming-prism-segments, plan §0.4 option D, §3, §4.1; Phase 1 = AC-1).
 *
 * Pure arithmetic, no THREE, no density model. Every screen, loader and namer
 * that needs "which box is this position in" calls addressOf(); nobody computes
 * a box themselves (plan §3.1: 0.1 kpc is not exact in binary, so the only way
 * every caller agrees on an edge is to share the arithmetic).
 *
 *   SECTOR   2 kpc square, edges at GRID_OFFSET_KPC + k × 2 kpc
 *     REGION   the sector's 16 × 16 grid, 125 pc
 *       PRISM    the region's 16 × 16 grid, 7.8125 pc (a full-height column)
 *         SLAB     a 100 pc height band: N1, N2 … above the plane, S1, S2 … below
 *
 * ⛔ FROZEN. Once names are built on this grid (Phase 5), changing ANY constant
 * here renames every procedural star. 2/256 kpc and 1.00390625 kpc are exact in
 * binary; the rounded "7.81 pc" / "3.9 pc" of early drafts must never appear.
 *
 * Rules (plan §3.1):
 *   • Every box is HALF-OPEN on every axis: the lower edge (smaller coordinate)
 *     belongs to it, the upper edge to the next box. Negatives use the same
 *     floor, so −0.1 kpc ≤ y < 0 is slab S1 and y = 0 exactly is N1.
 *   • Edges are the exact doubles boundsOf() returns, and addressOf() is
 *     corrected against those doubles, so address → bounds → address is exact
 *     and a point on an edge has exactly one owner.
 *   • All three levels come from ONE floor at prism resolution, so a prism can
 *     never disagree with its own region or sector about an edge.
 *
 * Grid references (plan §4.1): letters left → right with increasing X; numbers
 * top → bottom, ROW 1 AT THE LARGEST Z — the existing drill's direction
 * (NavComputer.js:4657: row 0 is at the view's top, centre.z + extent). So an
 * address's {i, j} is {column from the left, row from the top}, both 0-based,
 * and the edge label is letter(i) + (j + 1). Sol (8, 0) is sector N10 and the
 * galactic centre J10.
 *
 * Star keys (plan §3.2, §3.4): consumers compare star.key, never the 32-bit
 * seed. Three disjoint namespaces, told apart by the first character:
 *   p:<tier>:<cx>:<cy>:<cz>   procedural — the generating (tier, cell) slot,
 *                             carried from HashGridStarfield, never recomputed
 *   r:<name>@<x>,<y>,<z>      real catalogue star (the catalogue has no id
 *                             field; name + catalogue position is unique)
 *   k:<name>                  KnownSystems entry
 */

export const SECTOR_KPC = 2;
export const REGION_DIV = 16;                              // regions per sector, per axis
export const PRISM_DIV = 16;                               // prisms per region, per axis
export const REGION_KPC = SECTOR_KPC / REGION_DIV;         // 0.125
export const PRISM_KPC = REGION_KPC / PRISM_DIV;           // 0.0078125 = 2/256, exact
export const GRID_OFFSET_KPC = 1.00390625;                 // 1 kpc + half a prism: Sol and the centre sit mid-prism
export const SECTORS_PER_AXIS = 19;                        // the 19 × 19 naming area (plan §4.5)
export const GRID_MIN_KPC = GRID_OFFSET_KPC - 10 * SECTOR_KPC;                  // −18.99609375
export const GRID_MAX_KPC = GRID_MIN_KPC + SECTORS_PER_AXIS * SECTOR_KPC;       // +19.00390625
export const SLAB_KPC = 0.1;

const PRISMS_PER_SECTOR = REGION_DIV * PRISM_DIV;                         // 256
const PRISM_ROWS = SECTORS_PER_AXIS * PRISMS_PER_SECTOR;                  // 4864
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

// Exact for any realistic coordinate: p × 2^-7 is exact and the sum is a
// multiple of 2^-8 well inside 53 bits.
const prismEdge = (p) => GRID_MIN_KPC + p * PRISM_KPC;
const slabEdge = (k) => k * SLAB_KPC;
const mod = (a, n) => ((a % n) + n) % n;

// floor((v − origin) / size), then nudged by one if the division's rounding put
// v on the wrong side of the exact edge double. Makes each box exactly
// [edge(p), edge(p + 1)) on doubles.
function prismIndex(v) {
  let p = Math.floor((v - GRID_MIN_KPC) / PRISM_KPC);
  if (v < prismEdge(p)) p--; else if (v >= prismEdge(p + 1)) p++;
  return p;
}
function slabIndex(y) {
  let k = Math.floor(y / SLAB_KPC);
  if (y < slabEdge(k)) k--; else if (y >= slabEdge(k + 1)) k++;
  return k;
}

function finite(v, what) {
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new TypeError(`GalaxyGrid: ${what} must be a finite number, got ${v}`);
  return v;
}

/**
 * Position (galactic kpc) → address. Sector {i, j} may fall outside 0..18 for
 * a position outside the 19 × 19 naming area; region and prism are always 0..15.
 * @returns {{ sector:{i,j}, region:{i,j}, prism:{i,j}, slab:{hemi:'N'|'S', n:number} }}
 */
export function addressOf(x, y, z) {
  const px = prismIndex(finite(x, 'x'));
  const rt = PRISM_ROWS - 1 - prismIndex(finite(z, 'z'));   // prism rows counted from the top
  const k = slabIndex(finite(y, 'y'));
  return {
    sector: { i: Math.floor(px / PRISMS_PER_SECTOR), j: Math.floor(rt / PRISMS_PER_SECTOR) },
    region: { i: mod(Math.floor(px / PRISM_DIV), REGION_DIV), j: mod(Math.floor(rt / PRISM_DIV), REGION_DIV) },
    prism: { i: mod(px, PRISM_DIV), j: mod(rt, PRISM_DIV) },
    slab: k >= 0 ? { hemi: 'N', n: k + 1 } : { hemi: 'S', n: -k },
  };
}

function cell16(c, what) {
  if (!c || !Number.isInteger(c.i) || !Number.isInteger(c.j) || c.i < 0 || c.i > 15 || c.j < 0 || c.j > 15) {
    throw new RangeError(`GalaxyGrid: ${what} must be {i, j} with integers 0..15`);
  }
  return c;
}

/**
 * Address → its box, { min:{x,y,z}, max:{x,y,z} } in kpc; min is inside, max is
 * the next box's min. Partial addresses are allowed, finest level wins: a
 * sector alone gives the sector's square, + region the region's, + prism the
 * column's. Without a slab the box is the full-height column (y ±Infinity).
 */
export function boundsOf(address) {
  const s = address?.sector;
  if (!s || !Number.isInteger(s.i) || !Number.isInteger(s.j)) throw new RangeError('GalaxyGrid: address.sector must be {i, j} integers');
  // Range of prism columns [cLo, cHi) and prism rows-from-top [rLo, rHi).
  let cLo = s.i * PRISMS_PER_SECTOR, rLo = s.j * PRISMS_PER_SECTOR, span = PRISMS_PER_SECTOR;
  if (address.region) {
    const r = cell16(address.region, 'address.region');
    cLo += r.i * PRISM_DIV; rLo += r.j * PRISM_DIV; span = PRISM_DIV;
    if (address.prism) {
      const p = cell16(address.prism, 'address.prism');
      cLo += p.i; rLo += p.j; span = 1;
    }
  } else if (address.prism) {
    throw new RangeError('GalaxyGrid: address.prism needs address.region');
  }
  const cHi = cLo + span, rHi = rLo + span;
  let yMin = -Infinity, yMax = Infinity;
  if (address.slab) {
    const { hemi, n } = address.slab;
    if ((hemi !== 'N' && hemi !== 'S') || !Number.isInteger(n) || n < 1) throw new RangeError('GalaxyGrid: address.slab must be {hemi: N|S, n >= 1}');
    const k = hemi === 'N' ? n - 1 : -n;
    yMin = slabEdge(k); yMax = slabEdge(k + 1);
  }
  return {
    // Rows count down from the top, so the row range maps to z flipped.
    min: { x: prismEdge(cLo), y: yMin, z: prismEdge(PRISM_ROWS - rHi) },
    max: { x: prismEdge(cHi), y: yMax, z: prismEdge(PRISM_ROWS - rLo) },
  };
}

// Edge label for an {i, j} cell: letter(i) + (j + 1). `count` bounds the grid.
function ref(c, count) {
  if (!c || !Number.isInteger(c.i) || !Number.isInteger(c.j)) return null;
  if (c.i < 0 || c.i >= count || c.j < 0 || c.j >= count) return null;
  return LETTERS[c.i] + (c.j + 1);
}

/** "N10" — the sector's GALAXY edge label (A–S, 1–19); null outside the naming area.
 *  Takes an address or a bare {i, j}. */
export function sectorRef(a) { return ref(a?.sector ?? a, SECTORS_PER_AXIS); }
/** "H9" — the region's SECTOR-screen label (A–P, 1–16). Takes an address or {i, j}. */
export function regionRef(a) { return ref(a?.region ?? a, REGION_DIV); }
/** "P1" — the prism's REGION-screen label (A–P, 1–16). Takes an address or {i, j}. */
export function prismRef(a) { return ref(a?.prism ?? a, PRISM_DIV); }
/** "N1" / "S3" — the slab label. Takes an address or a bare {hemi, n}. */
export function slabRef(a) {
  const s = a?.slab ?? a;
  return s && (s.hemi === 'N' || s.hemi === 'S') && Number.isInteger(s.n) && s.n >= 1 ? s.hemi + s.n : null;
}
/** True when the address's sector is one of the 361 named squares (plan §4.5). */
export function inNamingArea(a) { return sectorRef(a) !== null; }

/**
 * The procedural star key — 'p:<tier>:<cx>:<cy>:<cz>'. Injective by
 * construction: integers print uniquely and no tier contains ':'.
 * @param {{ tier:string, cx:number, cy:number, cz:number }} ident
 */
export function starKey(ident) {
  const { tier, cx, cy, cz } = ident || {};
  if (typeof tier !== 'string' || !tier || tier.includes(':')) throw new TypeError(`GalaxyGrid.starKey: bad tier ${tier}`);
  if (!Number.isInteger(cx) || !Number.isInteger(cy) || !Number.isInteger(cz)) throw new TypeError('GalaxyGrid.starKey: cell must be integers');
  return `p:${tier}:${cx}:${cy}:${cz}`;
}

/** A real catalogue star's key — 'r:<name>@<x>,<y>,<z>' from the catalogue record. */
export function realStarKey(rs) {
  return `r:${rs.name}@${rs.x},${rs.y},${rs.z}`;
}

/** A KnownSystems entry's key — 'k:<name>'. */
export function knownSystemKey(name) {
  return `k:${name}`;
}

// The generator's own placement arithmetic, operation for operation
// (HashGridStarfield: the cell centre (c + 0.5)·cell plus (byte/255 − 0.5)·cell
// for an offset byte 0…255), so "can this cell put a star in the box" is
// answered with the very doubles the generator produces — no tolerance. A
// tolerance once admitted a cell whose LOWEST star sits exactly on the box's
// excluded upper face (Astra 2026-10-02, finding 4: 16 slots for 12 reachable
// cells in Sol's N1 prism at the 0.05 kpc tier).
function placedAt(c, cell, byte) {
  return (c + 0.5) * cell + (byte / 255 - 0.5) * cell;
}

/** True when cell c can place a star in [lo, hi): some offset byte lands there (placement rises with the byte). */
function canPlace(c, cell, lo, hi) {
  for (let b = 0; b < 256; b++) {
    const p = placedAt(c, cell, b);
    if (p >= hi) return false;
    if (p >= lo) return true;
  }
  return false;
}

function slotRange(lo, hi, cell) {
  // Start one whole cell outside each face (unreachable by construction) and
  // walk in to the first and last cell that can place a star in [lo, hi).
  const top = Math.floor(hi / cell) + 1;
  let a = Math.floor(lo / cell) - 2;
  while (a <= top && !canPlace(a, cell, lo, hi)) a++;
  let b = top;
  while (b >= a && !canPlace(b, cell, lo, hi)) b--;
  return [a, b];
}

/**
 * Slot number of a generating cell inside its owning box (plan §3.3): the
 * cell's index among ALL that tier's cells that can place a star inside the
 * half-open box — including coarse-tier cells whose centre lies outside it, and
 * EXCLUDING a cell that can only reach the excluded upper face — counted in a
 * fixed mixed-radix order: HEIGHT first (a bigger number is higher up), then
 * rows from the top (largest Z first), then columns left to right (the same
 * reading order as the grid references).
 *
 * @param {{ tier, cx, cy, cz }} ident  the carried generator slot
 * @param {number} cellKpc               that tier's frozen cell size
 * @param {{ min, max }} box             boundsOf() of a full address (with slab)
 * @returns {{ slot:number, count:number }}
 */
export function slotOf(ident, cellKpc, box) {
  const [xa, xb] = slotRange(box.min.x, box.max.x, cellKpc);
  const [ya, yb] = slotRange(box.min.y, box.max.y, cellKpc);
  const [za, zb] = slotRange(box.min.z, box.max.z, cellKpc);
  const { cx, cy, cz } = ident;
  if (cx < xa || cx > xb || cy < ya || cy > yb || cz < za || cz > zb) {
    throw new RangeError(`GalaxyGrid.slotOf: cell ${starKey(ident)} cannot place a star in this box`);
  }
  const nX = xb - xa + 1, nY = yb - ya + 1, nZ = zb - za + 1;
  return { slot: ((cy - ya) * nZ + (zb - cz)) * nX + (cx - xa), count: nX * nY * nZ };
}
