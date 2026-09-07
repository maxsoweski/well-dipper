/**
 * navViewModes/picking.js — THE HIT TESTS, AND EVERY ONE OF THEM READS GEOMETRY THE PAINT PUBLISHED.
 *
 * ── ⭐ THE RULE THIS FILE EXISTS TO OBEY ────────────────────────────────────────────────────────
 *
 * `INTERFACE.md` §1: **hit-test geometry comes OUT of the paint.** The precedent is `d1Ladder`,
 * which already writes `S.ladderStops` / `ladderMax` / `ladderCaps` / `ladderVisible` from its own
 * draw site, so the thing that moves the window and the thing that draws it cannot disagree.
 * Restating a layout in a hit-test is the AC-4 defect shape — two copies of one geometry, one of them
 * silently wrong — and `designs.js` is lifted verbatim, so any restatement here is a copy of numbers
 * this workstream is contractually not allowed to edit at their source.
 *
 * So nothing below computes where anything is. Every function takes a rectangle, a projection or a
 * list of marks that the DESIGN wrote onto `S` while it was drawing them, and inverts it.
 *
 * ── ⛔ AND EVERY ONE DEGRADES TO "NO PICK" RATHER THAN THROWING ─────────────────────────────────
 *
 * The lab publishes these fields; the driver reads them. The two land in separate commits by
 * separate owners, so for a window the fields are simply absent — and a `null` dereference inside a
 * picker called from the tail of `render()` is not a blank pick, it is a frozen instrument:
 * `PanelHost` catches a throw ONCE and then stops uploading, so the glass keeps showing the last
 * good frame and looks alive. Every entry point here answers `null` for anything it cannot read.
 *
 * ── ⚠ THE THREE MAP PROJECTIONS ARE GENUINELY DIFFERENT, AND THE `kind` TAG IS LOAD-BEARING ─────
 *
 * `INTERFACE.md` §1d, and the lab publishes each one in ITS OWN TERMS rather than in a common
 * normalised form — which is right, because the common form would be a fourth restatement written
 * at neither draw site:
 *
 *   | kind     | site                | published                                  |
 *   |----------|---------------------|--------------------------------------------|
 *   | 'square' | `d1TwoD`, levels 0-2| `ox, oy, sq, n, cell, cx, cz, size`         |
 *   | 'wide'   | `d2TwoD`, level 0   | `ox, oy, kpc, cx, cz, clip{x,y,w,h}`        |
 *   | 'block'  | `d2TwoD`, levels 1-2| `bx, by, blk, n, cell, cx, cz, size`        |
 *
 * They are not one projection with three parameter sets. The 'wide' kind renders the square at the
 * WIDE extent and crops the middle band, so its vertical field is only ±`(mapH/2)·kpc` — about half
 * the disc is off the glass BY CONSTRUCTION and there is no `size`-over-height to invert; it is an
 * origin and a scale. The 'block' kind lays `blk` texels over the same `v.size` kpc that the density
 * BEHIND it spends the full `W` on, so a picker built on design 2's `toX`/`toY` — which that branch
 * never even calls — drills a tile roughly TWICE the size the pilot clicked, and it looks like an
 * off-by-one in the grid rather than the wrong projection.
 *
 * So `projRect` / `projWorld` / `projCell` below branch on `kind` ONCE, in one place, and everything
 * above them is kind-agnostic.
 *
 * ⛔ REJECT, NEVER CLAMP. Design 1's map REGION is 258 texels wide and its square is 216 at `ox=21`:
 * the columns between are inside the region and outside the picture. Clamping a click there would
 * drill the edge tile of a map the pilot did not click on. `projRect` is the PICTURE, never the pane.
 */

/** Where each level's pick is written. `_handleClick` reads exactly these three fields. */
export const HOVER_FIELD = ['_hoveredTile', '_hoveredTile', '_hoveredTile',
                            '_hoveredLocalStar', '_hoveredBody'];

/**
 * The grid subdivision at a 2D level, used ONLY when this frame published no `mapProj` to take it
 * from. `NavComputer.gridNForLevel` (:71) is the authority and these are its two constants; the
 * rail picker needs `n` for the z-flip below and refusing the pick outright would make AC-4 depend
 * on a field the rail does not itself need.
 */
export function gridNFallback(level) { return level === 2 ? 16 : 8; }

/** THE PICTURE'S RECTANGLE, per kind. `null` for a shape this file does not know. */
export function projRect(p) {
  if (!p) return null;
  if (p.kind === 'square') return { x: p.ox, y: p.oy, w: p.sq, h: p.sq };
  if (p.kind === 'block') return { x: p.bx, y: p.by, w: p.blk, h: p.blk };
  if (p.kind === 'wide') return p.clip
    ? { x: p.clip.x, y: p.clip.y, w: p.clip.w, h: p.clip.h } : null;
  return null;
}

/**
 * This frame's map projection, or `null`.
 *
 * ⛔ THE `design` AND `level` STAMPS ARE THE WHOLE REASON THEY ARE PUBLISHED. A projection outlives
 * the frame that wrote it; a pick against last frame's rectangle after a level change lands on a
 * tile of a map that is no longer on the glass, and it looks exactly like a broken inverse.
 * (Design 2 nulls the whole set at the head of its own paint for the same reason, and the driver
 * clears them for both designs — three layers, because a stale pick is silent.)
 */
export function usableProj(S) {
  const p = S && S.mapProj;
  if (!p || p.design !== S.design || p.level !== S.level) return null;
  const r = projRect(p);
  if (!r || !Number.isFinite(r.x) || !Number.isFinite(r.y) || !(r.w > 0) || !(r.h > 0)) return null;
  if (!Number.isFinite(p.cx) || !Number.isFinite(p.cz)) return null;
  const scale = p.kind === 'wide' ? p.kpc : p.size;
  return (Number.isFinite(scale) && scale > 0) ? p : null;
}

/** Is the point on the DRAWN picture? Outside is a miss, never a clamp — see the header. */
export function insideProj(p, x, y) {
  const r = projRect(p);
  return !!r && x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
}

/** The world point under a texel, inverting whichever projection actually drew it. */
export function worldAt(p, x, y) {
  // 'wide' is isotropic about its own centre: one world pixel is one texel in BOTH axes, so the
  // inverse is an origin and a scale and there is no height to divide by.
  if (p.kind === 'wide') return { wx: p.cx + (x - p.ox) * p.kpc, wz: p.cz + (y - p.oy) * p.kpc };
  const r = projRect(p);
  if (!r) return null;
  return {
    wx: p.cx + ((x - r.x) / r.w - 0.5) * p.size,
    wz: p.cz + ((y - r.y) / r.h - 0.5) * p.size,
  };
}

/** Which drawn grid cell, in the LAB's indexing (`j` counts +z DOWNWARD). `null` off the grid. */
export function cellAt(p, x, y) {
  const n = p.n | 0;
  const r = projRect(p);
  if (!r || n <= 0) return null;
  // `cell` is published because the paint ROUNDS its grid lines to `bx + round(cell*i)`; taking it
  // rather than recomputing `w / n` keeps the hit-test on the same divisions the glass shows.
  const cell = (Number.isFinite(p.cell) && p.cell > 0) ? p.cell : r.w / n;
  const i = Math.floor((x - r.x) / cell);
  const j = Math.floor((y - r.y) / cell);
  return (i >= 0 && i < n && j >= 0 && j < n) ? { i, j, n } : null;
}

/**
 * ⛔ `row` IS Z-FLIPPED AND THIS IS THE ONLY PLACE THAT KNOWS IT.
 *
 * The lab's `j` counts +z DOWNWARD (`toY(z) = mapY + ((z - cz)/size + 0.5)*sq`, so a larger z is a
 * larger y). `NavComputer._handleClick`:4656 counts +z UPWARD:
 * `newCz = viewCenter.z + ext - (row + 0.5) * tileSize`. Equating the two gives `row = n - 1 - j`,
 * `col = i`. Handing raw `j` through drills into the MIRRORED tile — a defect that looks like a
 * plausible drill, which is why it is worth a named function.
 */
export function tileOf(i, j, n) { return { col: i, row: n - 1 - j }; }

/**
 * The nearest published mark within its OWN radius, scanned in reverse draw order.
 *
 * ⛔ BOUNDED, BECAUSE `_handleClick`'s LEVEL-3 BRANCH HAS NO "CLICKED EMPTY SPACE" PATH. It drills
 * whatever `_hoveredLocalStar` holds, so an unbounded nearest-scan turns every click anywhere in the
 * pane into a drill into some star on the far side of the map.
 *
 * ⭐ REVERSE, because the designs draw nearest-first and a farther star therefore paints OVER a
 * nearer one. Scanning backwards makes the pick agree with the topmost pixel, which is the mark the
 * pilot believes he is clicking.
 */
export function nearestHit(hits, x, y, fallbackR = 4) {
  if (!Array.isArray(hits) || hits.length === 0) return null;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  let best = null, bestD = Infinity;
  for (let k = hits.length - 1; k >= 0; k--) {
    const hp = hits[k];
    if (!hp || !Number.isFinite(hp.x) || !Number.isFinite(hp.y)) continue;
    const r = (Number.isFinite(hp.r) && hp.r > 0) ? hp.r : fallbackR;
    const d = Math.hypot(x - hp.x, y - hp.y);
    if (d > r || d >= bestD) continue;
    bestD = d; best = hp;
  }
  return best;
}

/** Is the point inside the rectangle the paint declared for its map pane? Absent region ⇒ yes. */
export function inRegion(rgn, x, y) {
  if (!rgn) return true;
  return x >= rgn.x && x < rgn.x + rgn.w && y >= rgn.y && y < rgn.y + rgn.h;
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// THE FIVE LEVEL PICKERS. Each returns the exact object `_handleClick` reads, or `null` for no pick.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

/**
 * LEVEL 0 — the sector under the pointer.
 *
 * ⚠ THE MAP DRAWS A GALAXY GRID, NOT SECTORS. Design 1 draws an 8x8 subdivision of the 44 kpc disc
 * and design 2 draws one dot per ranked sector; there are 775 sectors and they are an irregular
 * density-adaptive quadtree. So neither the grid cell nor a nearest-centre scan over the dots is the
 * sector identity — CONTAINMENT is, and `getSectorAt` is the same call the adapter already makes for
 * `D.playerSector`. It returns `null` outside the disc, which is a miss.
 */
export function pickSector(nav, S, x, y) {
  const p = usableProj(S);
  if (!p || !insideProj(p, x, y)) return null;
  const w = worldAt(p, x, y);
  if (!w || !Number.isFinite(w.wx) || !Number.isFinite(w.wz)) return null;
  const { wx, wz } = w;
  let sec = null;
  try { sec = nav._sectors && nav._sectors.getSectorAt ? nav._sectors.getSectorAt({ x: wx, z: wz }) : null; }
  catch (e) { sec = null; }
  return sec ? { sector: sec } : null;
}

/** LEVELS 1-2 — the tile under the pointer, in `_handleClick`'s own `{col,row}` vocabulary. */
export function pickTile(S, x, y) {
  const p = usableProj(S);
  if (!p || !insideProj(p, x, y)) return null;
  const c = cellAt(p, x, y);
  return c ? tileOf(c.i, c.j, c.n) : null;
}

/**
 * LEVEL 3 — the star glyph under the pointer.
 *
 * ⛔ THE STAR HANDED ON IS THE LIVE `_localStars` ENTRY, MATCHED BY SEED, not the ranked copy the
 * adapter made. `_handleClick` stores it as `_systemStar` / `_selectedNavStar` and the rest of the
 * class compares those by identity against `_localStars` (`handleEscape`'s binary stash, for one).
 * The shipped list-row picker already does exactly this; the map picker must not diverge from it.
 */
/**
 * ⭐⭐ A CLICK ON A LABEL BELONGS TO THE OBJECT THE LABEL NAMES, AND IT IS TESTED FIRST.
 *
 * ⛔ THIS IS A LIVE MIS-SELECTION FIX, NOT AN EXTRA AFFORDANCE. `plated()` knocks out a BG rect
 * before drawing, so a label's texels are the label's by construction — nothing underneath is
 * visible there to click. But the mark lists do not know that, so before this, a numeral sitting on
 * a planet it did not name resolved to THAT planet. Measured over 120 frames per case on the old
 * placement: **4,854 labels were sitting on a foreign mark**, about 8 of Sol's ~11 drawn numerals
 * every frame. The placer now refuses those slots, so the count is 0 — and this ordering is what
 * makes the remaining labels correct rather than merely harmless, because a label is still allowed
 * to sit near its OWN mark, where the two answers agree.
 *
 * ⚠ RECT CONTAINMENT, NOT NEAREST-DISTANCE. `nearestHit` takes the closest candidate within a
 * radius, which is right for a point-like mark and wrong for a plate: a click 2 texels outside a
 * label is not a click on it, and a plate has real edges the pilot can see.
 */
export function pickLabel(S, x, y) {
  const hits = S.labelHits;
  if (!hits || !hits.length) return null;
  // Last drawn wins: later plates paint over earlier ones, so the topmost is the one the pilot sees.
  for (let i = hits.length - 1; i >= 0; i--) {
    const h = hits[i];
    if (!h || !h.ref) continue;
    if (x >= h.x && x < h.x + h.w && y >= h.y && y < h.y + h.h) return h;
  }
  return null;
}

export function pickPrismStar(nav, S, x, y, mapRegion) {
  if (!inRegion(mapRegion, x, y)) return null;
  // ⛔ THE LABEL FIRST — see `pickLabel`. Its plate has already erased whatever lies under it.
  //    ⚠ BRANCH ON THE PUBLISHED `kind`, never on the shape of `ref`: guessing "it has a `seed`, so
  //    it must be a star" is a second copy of the paint's own classification, and the AC-4 defect
  //    shape. `index` is design 1's numbered tag, `star` is design 2's placed name.
  const lab = pickLabel(S, x, y);
  const hp = (lab && (lab.kind === 'index' || lab.kind === 'star'))
    ? lab : nearestHit(S.prismHits, x, y);
  if (!hp || !hp.ref) return null;
  const live = (nav._localStars || []).find((t) => t && t.seed === hp.ref.seed) || hp.ref;
  return { star: live, sx: hp.x, sy: hp.y };
}

/**
 * LEVEL 4 — the body under the pointer, mapped to an identity the shipped handler can consume.
 *
 * ⛔ A MOON PIP MAPS TO ITS PARENT PLANET IN SYSTEM MODE. `_handleClick` consumes a moon pick only
 * while `_systemMode === 'planet'` (:4512-4520); in `'system'` mode — the mode the orrery and the
 * ladder are drawn in — a moon hover falls through to `_clearCommitSelection()` (:4594), so
 * publishing a moon pip AS a moon makes clicking one CLEAR the selection. Mapping to the parent
 * drills into planet detail, where the moons become individually pickable by the same mechanism.
 * That is a walk; the other is a dead click. In planet detail the moon IS consumable, but only
 * against `_selectedPlanetIdx` — a moon of any other planet would select the wrong moon, so it too
 * falls back to its parent.
 *
 * ⛔ A BELT HAS NO DOWNSTREAM IDENTITY in either build. It is published as a candidate so the picker
 * can RECOGNISE it, and answers "no pick" — which clears, rather than leaving a stale body armed.
 *
 * ⛔ THE INDEX IS `ref.pIdx` / `ref.mIdx`, NEVER A LOOP INDEX. `state.js`'s `buildBodies` skips a
 * planet with no `planetData`, so the flat list's position and `_systemData.planets`' index diverge
 * the moment one is skipped — and sorting `D.bodies` (AC-8) breaks the correspondence outright.
 */
export function pickBody(nav, S, x, y, mapRegion) {
  if (!inRegion(mapRegion, x, y)) return null;
  // ⛔ THE LABEL FIRST — see `pickLabel`. A numeral's plate has erased the mark beneath it, so the
  //    pilot cannot be clicking that mark. ⚠ A body tag names the BODY, never one of its moon pips:
  //    the pips sit at `x + 4 + m*2` and the tag's own slot starts at the same `x + 4`, so without
  //    `moon: -1` a tag adjacent to its parent's pips would resolve to a moon it does not name.
  //    ⚠ And branch on the published `kind`, not on the shape of `ref` — see `pickPrismStar`.
  const lab = pickLabel(S, x, y);
  const hp = (lab && lab.kind === 'body') ? { ...lab, moon: -1, star: false }
                                          : nearestHit(S.bodyHits, x, y);
  if (!hp) return null;
  if (hp.star) return { type: 'star', index: 0 };
  return bodyIdentity(nav, hp.ref, hp.moon);
}

/**
 * One body row (from a map pip or from a rail row) as `{type,index}`, or `null` for "no identity".
 * @param {object} nav
 * @param {?object} ref  a `D.bodies` row
 * @param {number} [moonIdx]  the moon's index within that body, or `-1`/undefined for the body itself
 */
export function bodyIdentity(nav, ref, moonIdx = -1) {
  if (!ref || ref.kind === 'belt') return null;
  const isMoon = ref.kind === 'moon' ? true : (moonIdx != null && moonIdx >= 0);
  const pIdx = ref.pIdx;
  if (!Number.isFinite(pIdx)) return null;
  if (!isMoon) return { type: 'planet', index: pIdx };
  const mIdx = ref.kind === 'moon' ? ref.mIdx : moonIdx;
  if (nav._systemMode === 'planet' && nav._selectedPlanetIdx === pIdx && Number.isFinite(mIdx)) {
    return { type: 'moon', index: mIdx };
  }
  return { type: 'planet', index: pIdx };
}
