/**
 * navViewModes/geometry.js — where each design's CONTROLS are, so a click can find them.
 *
 * ── ⛔ THE DEFECT THIS FILE EXISTS TO AVOID, BY NAME ────────────────────────────────────────────
 *
 * AC-4 of the previous workstream shipped a cockpit nav panel with `btnY = drawH - 52` written as
 * TWO INDEPENDENT COPIES — one in SYSTEM, one in PLANET DETAIL — publishing into ONE hit-test rect.
 * Fixing warp without fixing burn was not even representable. The same shape is available here and
 * is worse, because `designs.js` is lifted verbatim and computes its layout INLINE: any geometry
 * restated here is a second copy of numbers I am contractually not allowed to edit at the source.
 *
 * ── ⭐ SO MOST OF THE GEOMETRY IS NOT RESTATED — IT IS PUBLISHED BY THE PAINT ────────────────────
 *
 * Every design already declares its bands as it draws them (`region('tabs', …)`, `region('commit',
 * …)`, `region('rail', …)`, `region('map', …)`), and those rectangles come OUT of the draw code, so
 * they cannot disagree with it. The hit-test takes every vertical band from there.
 *
 * What is left, and all this file restates, is the HORIZONTAL subdivision inside a band — which of
 * five tabs, which rail row. Two short formulas per design, and `navViewModes.test.js` pins them
 * against the paint itself: it finds the highlight rectangle the design draws under the ACTIVE tab
 * and asserts the derived band contains it. A drift in either copy fails that test.
 *
 * ── ⚠ AND TWO OF THEM ARE NOW A FALLBACK, NOT THE SOURCE ───────────────────────────────────────
 *
 * `S.tabRects` and `S.chipRect` are published by the paint (INTERFACE §1), and `index.js` prefers
 * them: `tabLevel` places its synthetic click on `S.tabRects[i]` and `render()` publishes
 * `S.chipRect` into `_commitButtonRect`. `tabW` / `tabs[]` / `chipX` below are what those degrade
 * to for the window in which the lab has not published them yet, and for `listRowAt`, which has no
 * published counterpart. ⛔ Nothing here should GROW: every new rectangle belongs at its draw site.
 *
 * ── ⛔ AND THE CLICK ITSELF IS NOT REIMPLEMENTED ────────────────────────────────────────────────
 *
 * `NavComputer._handleClick` drives off HOVER STATE, not coordinates: `_hoveredTile` at the 2D
 * levels, `_hoveredLocalStar` at PRISM, `_hoveredBody` at SYSTEM. So a mode does not need its own
 * drill, its own animation, its own stack push or its own sound — it needs only to write those three
 * fields from its own geometry, and 150 lines of shipped click handling work unchanged. That is the
 * seam, and finding it is why this file is short.
 */

/** Design 1 — "the 71x40". The character grid every one of its rectangles is a multiple of. */
export function railGeometry(W, H, FACE) {
  const CELL = FACE.advance, LEAD = FACE.h + 1;
  const cols = Math.floor((W + 1) / CELL), rows = Math.floor(H / LEAD);
  const railC = Math.min(26, Math.max(10, Math.round(cols * 0.366)));
  const mapC = cols - railC - 2;
  const rowCount = rows - 4;
  return {
    CELL, LEAD, cols, rows,
    mapW: mapC * CELL, mapY: LEAD, mapH: (rows - 3) * LEAD - LEAD,
    railX: (cols - railC) * CELL, railW: railC * CELL - 1, railC,
    // The tab strip: five equal cells of `tabW`, left-aligned — NOT the full width divided by five,
    // which is what the legacy strip does and why a click cannot simply be passed through.
    tabW: Math.floor(Math.min(8, Math.floor(cols * 0.11)) * CELL),
    tabY: (rows - 2) * LEAD, commitY: (rows - 1) * LEAD,
    // `d1Rail` draws row i at `y + (i+1)*LEAD`, and shows `max(2, rowCount - 9)` of them.
    listRows: Math.max(2, rowCount - 9), rowY: (i) => LEAD + (i + 1) * LEAD,
  };
}

/** Design 2 — "two bars and a sky". Tabs are proportionally spaced, so their widths come from the face. */
export function barsGeometry(W, H, FACE, measure, LEVELS) {
  const BAR = Math.max(7, FACE.h + 3);
  const tabs = [];
  let tx = 4;
  for (const n of LEVELS) { const w = measure(n); tabs.push({ x: tx - 2, w: w + 4 }); tx += w + 6; }
  const chipW = measure('[WARP]') + 6;
  return {
    BAR, mapY: BAR, mapH: H - BAR * 2, tabs,
    chipX: W - chipW - 2, chipW, chipY: H - BAR,
    // `d2List` draws its header at `mapY + 4` and row i at `mapY + 4 + (i+1)*LEAD`.
    LEAD: FACE.h + 1, listTop: BAR + 4,
    listRows: Math.floor((H - BAR * 2 - 4) / (FACE.h + 1)) - 1,
  };
}

/** Which of the five tabs does this x fall in? `-1` for none. Both designs, one call. */
export function tabIndexAt(geo, x, isBars) {
  if (isBars) {
    for (let i = 0; i < geo.tabs.length; i++) {
      const t = geo.tabs[i];
      if (x >= t.x && x < t.x + t.w) return i;
    }
    return -1;
  }
  const i = Math.floor(x / geo.tabW);
  return i >= 0 && i < 5 ? i : -1;
}
