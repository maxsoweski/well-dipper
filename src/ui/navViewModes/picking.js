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
 * ── ⭐ ONE MAP PROJECTION, `kind: 'grid'`, FOR BOTH DESIGNS AT ALL THREE 2D LEVELS ──────────────
 *
 * naming-prism-segments Phase 2 (AC-3). Both designs now draw GALAXY, SECTOR and REGION through the
 * lab's `gridScreen`, which publishes `{ x0, y0, sq, cx, cz, size, clip, parent, n }`: the frame
 * `size` kpc across the square `sq` texels at `(x0, y0)`, centred on `(cx, cz)`, +z UP, and `clip`
 * the rectangle actually painted. The three older kinds ('square', 'wide', 'block') are gone with
 * the view-relative grids they described; an unknown kind is "no pick", never a guess.
 *
 * ⭐ THE CELL UNDER THE POINTER IS `navGrid.cellAt` OF THE INVERTED POINT — the same function the
 * host's drill, the autopilot and the painter's own `childGrid` share — so a drawn cell, a picked
 * cell and a drilled cell are one box by construction, at any pan.
 *
 * ⛔ REJECT, NEVER CLAMP. Design 1's map REGION is wider than its square: the columns either side are
 * inside the region and outside the picture, and that is where its row numbers are printed. Clamping
 * a click there would drill the edge cell of a map the pilot did not click on. `projRect` is the
 * PICTURE (`clip`), never the pane.
 */
import { findStar } from './starIdentity.js';
import * as navGrid from '../navGrid.js';

/** Where each level's pick is written. `_handleClick` reads exactly these three fields. */
export const HOVER_FIELD = ['_hoveredTile', '_hoveredTile', '_hoveredTile',
                            '_hoveredLocalStar', '_hoveredBody'];

/** THE PICTURE'S RECTANGLE — the painted `clip`. `null` for a shape this file does not know. */
export function projRect(p) {
  if (!p || p.kind !== 'grid' || !p.clip) return null;
  return { x: p.clip.x, y: p.clip.y, w: p.clip.w, h: p.clip.h };
}

/**
 * This frame's map projection, or `null`.
 *
 * ⛔ THE `design` AND `level` STAMPS ARE THE WHOLE REASON THEY ARE PUBLISHED. A projection outlives
 * the frame that wrote it; a pick against last frame's rectangle after a level change lands on a
 * cell of a map that is no longer on the glass, and it looks exactly like a broken inverse.
 */
export function usableProj(S) {
  const p = S && S.mapProj;
  if (!p || p.design !== S.design || p.level !== S.level) return null;
  const r = projRect(p);
  if (!r || !Number.isFinite(r.x) || !Number.isFinite(r.y) || !(r.w > 0) || !(r.h > 0)) return null;
  if (!Number.isFinite(p.cx) || !Number.isFinite(p.cz)) return null;
  if (!Number.isFinite(p.x0) || !Number.isFinite(p.y0) || !(p.sq > 0)) return null;
  return (Number.isFinite(p.size) && p.size > 0) ? p : null;
}

/** Is the point on the DRAWN picture? Outside is a miss, never a clamp — see the header. */
export function insideProj(p, x, y) {
  const r = projRect(p);
  return !!r && x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
}

/** The world point under a pointer position, inverting the projection that drew it (+z UP):
 *  exactly `gridProj`'s `toX`/`toY` run backwards over the published numbers. */
export function worldAt(p, x, y) {
  if (!p || p.kind !== 'grid' || !(p.sq > 0)) return null;
  return {
    wx: p.cx + ((x - p.x0) / p.sq - 0.5) * p.size,
    wz: p.cz - ((y - p.y0) / p.sq - 0.5) * p.size,
  };
}

/** The child cell under a texel, as `navGrid.cellAt` answers it for this screen's parent; `null`
 *  off the picture, outside the parent (a dimmed neighbour) or on an undrawn GALAXY corner. */
export function gridCellAt(p, x, y) {
  if (!insideProj(p, x, y)) return null;
  const w = worldAt(p, x, y);
  if (!w || !Number.isFinite(w.wx) || !Number.isFinite(w.wz)) return null;
  return navGrid.cellAt(p.level, p.parent || null, w.wx, w.wz);
}

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
 * LEVELS 0-2 — the cell under the pointer, as the hover payload `_handleClick` drills
 * (`navGrid.hoverTile`: `{ level, address, ref, bounds, center, size, sector? }`).
 *
 * ⭐ ONE PICKER FOR THREE SCREENS (naming-prism-segments AC-3). GALAXY used to resolve a click by
 * CONTAINMENT in one of 775 irregular sectors under a plain 8x8 grid, so the cell and the sector
 * were different objects; SECTOR and REGION handed a view-relative `{col,row}` that stopped meaning
 * a region the moment the map was dragged. Now every cell is one child box, and the payload carries
 * that box's ADDRESS — the drill goes to exactly the clicked cell's bounds at any pan.
 */
export function pickCell(S, x, y) {
  const p = usableProj(S);
  if (!p) return null;
  const a = gridCellAt(p, x, y);
  return a ? navGrid.hoverTile(p.level, a) : null;
}
/** GALAXY's name for the same pick; the payload also carries `sector` (the shipped level-0 drill). */
export function pickSector(nav, S, x, y) { return S && S.level === 0 ? pickCell(S, x, y) : null; }
/** SECTOR / REGION's name for the same pick. */
export function pickTile(S, x, y) { return S && (S.level === 1 || S.level === 2) ? pickCell(S, x, y) : null; }

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
  // ⛔ BY IDENTITY, NEVER THE SEED (naming-prism-segments AC-2): two marks can share a seed.
  const live = findStar(nav._localStars, hp.ref) || hp.ref;
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
/**
 * ⭐ AC-2 — THE ORBIT RING UNDER THE POINTER, at level 4 in design 2.
 *
 * Max: *"anything on screen should be clickable."* A ring is the largest inert thing this orrery
 * draws, and it names its body by construction — one ellipse per body, drawn from that body's own
 * AU. So a click on the ring is a click on the body.
 *
 * ⛔ IT IS THE LAST CANDIDATE TESTED, NOT THE FIRST, AND THAT ORDERING IS THE WHOLE SAFETY OF IT.
 * A ring passes within a texel or two of marks it does not name — every inner planet's mark sits
 * inside every outer planet's ellipse, and at low tilt the rings crowd — so a ring that could beat
 * a body mark or a label would turn a precise click into a wrong selection. It answers only where
 * nothing better did.
 *
 * ⚠ THE GAP IS MEASURED IN TEXELS, ALONG THE RAY, NOT IN THE ELLIPSE'S NORMALISED UNITS. `n` is the
 * point's radius in units of the ellipse, so `n = 1` is on it — but "0.1 of an ellipse away" is 20
 * texels on the outer ring and 2 on the inner one, which would make the grab band grow with the
 * orbit. Projecting the point onto the ray's crossing and measuring the leftover distance keeps the
 * band a constant width on the glass, exact on both axes and conservative in between (it reads
 * slightly long off-axis on an eccentric ring, so the band narrows there rather than widening —
 * it never claims texels the pilot cannot see a ring in).
 *
 * ⛔ NEAREST RING WINS. At the sqrt(AU) spacing the outer rings crowd to within a few texels of each
 * other, so a band that returned the FIRST match would answer with whichever body happened to be
 * earlier in `D.bodies` — an order that `[` / `]` re-sorts.
 *
 * @param {object} S
 * @param {number} x
 * @param {number} y
 * @param {number} [grab=3]  half-width of the grab band, in texels
 * @returns {?{cx:number,cy:number,rx:number,ry:number,ref:object}}
 */
export function pickOrbitRing(S, x, y, grab = 3) {
  const rings = S && S.orbitRings;
  if (!Array.isArray(rings) || rings.length === 0) return null;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  let best = null, bestD = Infinity;
  for (let k = rings.length - 1; k >= 0; k--) {
    const r = rings[k];
    if (!r || !(r.rx > 0) || !(r.ry > 0)) continue;
    const dx = x - r.cx, dy = y - r.cy;
    const n = Math.hypot(dx / r.rx, dy / r.ry);
    // Dead centre is the star's own mark, which has already had its chance; there is no ray there.
    if (!(n > 0) || !Number.isFinite(n)) continue;
    const d = Math.abs(1 - 1 / n) * Math.hypot(dx, dy);
    if (d > grab || d >= bestD) continue;
    bestD = d; best = r;
  }
  return best;
}

/* Function · `pickBody`'s optional sixth argument, `out`, is a caller-supplied object the picker
 *   fills with the RAW candidate it found — `{ ref, moon, star, x, y }` — alongside the collapsed
 *   identity it returns.
 * Intent · AC-1 (SEAM §1). `S.hover` must carry the `D.bodies` ROW so a callout can print the
 *   planet's type, radius, AU, temperature and moon count; `bodyIdentity` deliberately throws all of
 *   that away, and answers `null` for a belt — which is right for a CLICK (a belt has no downstream
 *   identity and the selection must clear) and wrong for a HOVER, where the belt is plainly the
 *   thing under the pointer.
 * Deliberate non-goals · this is NOT a second picker. It is the same scan, the same candidate, the
 *   same order — a second entry point would be two copies of one hit test, which is the AC-4 defect
 *   shape this file exists to refuse. The returned identity is byte-identical with or without `out`.
 */
export function pickBody(nav, S, x, y, mapRegion, out) {
  if (!inRegion(mapRegion, x, y)) return null;
  // ⛔ THE LABEL FIRST — see `pickLabel`. A numeral's plate has erased the mark beneath it, so the
  //    pilot cannot be clicking that mark. ⚠ A body tag names the BODY, never one of its moon pips:
  //    the pips sit at `x + 4 + m*2` and the tag's own slot starts at the same `x + 4`, so without
  //    `moon: -1` a tag adjacent to its parent's pips would resolve to a moon it does not name.
  //    ⚠ And branch on the published `kind`, not on the shape of `ref` — see `pickPrismStar`.
  const lab = pickLabel(S, x, y);
  const hp = (lab && lab.kind === 'body') ? { ...lab, moon: -1, star: false }
                                          : nearestHit(S.bodyHits, x, y);
  // ⭐ AC-2 — AND THE RING LAST OF ALL, only where no mark and no label answered. See `pickOrbitRing`.
  //    ⚠ A BELT'S RING GOES THROUGH `bodyIdentity` LIKE ANY OTHER, which answers `null` for a belt —
  //    the same "no identity, clear the selection" its centre mark already gives. That is the point
  //    of routing it through the shared function rather than filtering belts out here: one place
  //    decides what a belt means, and the ring cannot drift from the mark.
  if (!hp) {
    const ring = pickOrbitRing(S, x, y);
    if (ring && out) { out.ref = ring.ref; out.moon = -1; out.star = false; out.x = x; out.y = y; }
    return ring ? bodyIdentity(nav, ring.ref, -1, S) : null;
  }
  if (out) { out.ref = hp.ref || null; out.moon = Number.isFinite(hp.moon) ? hp.moon : -1;
             out.star = !!hp.star; out.x = hp.x; out.y = hp.y; }
  if (hp.star) return { type: 'star', index: 0 };
  return bodyIdentity(nav, hp.ref, hp.moon, S);
}

/**
 * One body row (from a map pip or from a rail row) as `{type,index}`, or `null` for "no identity".
 * @param {object} nav
 * @param {?object} ref  a `D.bodies` row
 * @param {number} [moonIdx]  the moon's index within that body, or `-1`/undefined for the body itself
 * @param {?object} [S]  the view state, for the design-side sub-view below. Absent ⇒ collapse.
 */
/* Function · AC-4's HOVER row (SEAM §2) — the fourth argument, and the one clause that reads it.
 * Intent · in the DESIGN-SIDE moon sub-view a moon IS the pick. The collapse above is right for the
 *   whole-system picture and says so in its own note ("a moon click in that mode would CLEAR the
 *   selection, so map it to the parent and the click drills into detail instead") — but inside the
 *   sub-view the detail is already open, the moons are drawn on their own orbits, and a callout or a
 *   click that named the parent would be the glass refusing the only thing on it. `S.sysView` is
 *   what legacy's `nav._systemMode === 'planet'` is, in the place a design is allowed to keep it.
 * Deliberate non-goals · it does NOT widen the legacy clause and it does not replace it: legacy's
 *   own planet detail keeps answering on `_systemMode` exactly as before, byte for byte, and a
 *   design that has not opened a sub-view keeps collapsing (SEAM: "it may keep collapsing in the
 *   whole-system view"). It also refuses a moon of ANY OTHER planet, for the same reason the legacy
 *   clause pins `_selectedPlanetIdx`: `_buildCommitAction` pairs `moonIndex` with a planet index,
 *   and a foreign moon would arm a burn to a body that does not exist. */
export function bodyIdentity(nav, ref, moonIdx = -1, S = null) {
  if (!ref || ref.kind === 'belt') return null;
  const isMoon = ref.kind === 'moon' ? true : (moonIdx != null && moonIdx >= 0);
  const pIdx = ref.pIdx;
  if (!Number.isFinite(pIdx)) return null;
  if (!isMoon) return { type: 'planet', index: pIdx };
  const mIdx = ref.kind === 'moon' ? ref.mIdx : moonIdx;
  if (nav._systemMode === 'planet' && nav._selectedPlanetIdx === pIdx && Number.isFinite(mIdx)) {
    return { type: 'moon', index: mIdx };
  }
  if (S && S.sysView === 'planet' && S.detailPlanet === pIdx && Number.isFinite(mIdx)) {
    return { type: 'moon', index: mIdx };
  }
  return { type: 'planet', index: pIdx };
}
