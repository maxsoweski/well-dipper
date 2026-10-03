/**
 * navViewModes/slabBar.js — THE PRISM COLUMN'S 60 SLABS AS ONE GEOMETRY, AND THE ONE LAYER FUNCTION
 * (naming-prism-segments Phase 3, AC-7; plan §7.1–§7.3).
 *
 * Max (2026-10-02): *"you could see the un-highlighted segments in the nav bar and click or drag to a
 * new one quickly, or use existing R and F controls to slowly pan up or down"*; and (2026-10-03):
 * *"I still want to build in the capability to be able to jump between the different slices of the
 * prism … up and down the column."*
 *
 * ⭐ ONE GEOMETRY, TWO READERS. The segment bar is painted by the designs (`slabBar` in
 * `nav-240p-lab.html` → `designs.js`) and hit-tested by the driver (`index.js`). Both call `barRow` /
 * `barIndexAt` below over the rectangle the paint publishes (`S.slabBarRect`), so the cell the pilot
 * clicks is, by construction, the cell that was drawn there — never a second copy of the arithmetic.
 *
 * ⭐ ONE LAYER FUNCTION (plan §7.2). `prismNumbers` printed THIN under 0.3 kpc, THICK under 1.0 and
 * HALO otherwise, off `|y|`; the bar colours the same three layers per SLAB. Two spellings would
 * disagree at exactly the slab faces (y = −0.3 is S3, which `|y| < 0.3` called THICK), so both now
 * read `layerOfIndex` here: N1–N3 / S1–S3 thin, N4–N10 / S4–S10 thick, N11 and beyond halo.
 *
 * ⛔ SLAB ARITHMETIC IS GALAXYGRID'S. The index of a height goes through `GalaxyGrid.addressOf`, the
 * same half-open rule the loader (`prismLoader.js`) and `nav.slab` use, so y = 0 is N1 and a camera
 * on a face is in exactly one slab on every reader. k is the loader's index: N(k+1) for k ≥ 0, S(−k)
 * for k < 0.
 *
 * Deliberate non-goals · no drawing (the designs own every texel), no loading (the HOST's
 * `nav.jumpToSlab` / `nav.slabLoad` do that), no colours (inks live with the designs' INK table).
 */
import { addressOf, boundsOf, slabRef, SLAB_KPC } from '../../generation/GalaxyGrid.js';

/** Slabs per hemisphere on the bar: ±3 kpc = S30 … N30, the loader's own column (prismLoader SLAB_SPAN). */
export const BAR_HEMI = Math.round(3.0 / SLAB_KPC);        // 30
/** Cells on the bar, top (N30) to bottom (S30). */
export const BAR_CELLS = 2 * BAR_HEMI;                      // 60
/** The bar's painted width in texels — one character cell, like the fine gauge beside it. */
export const BAR_W = 6;
/** Texels kept clear at each end of the bar, as the fine gauge keeps (`gy + 2`, `gh - 4`). */
export const BAR_INSET = 2;
/** Plan §7.2's thresholds (`prismNumbers`, designs.js), in kpc of |height|. */
export const THIN_TOP_KPC = 0.3, THICK_TOP_KPC = 1.0;
const THIN_N = Math.round(THIN_TOP_KPC / SLAB_KPC);        // 3
const THICK_N = Math.round(THICK_TOP_KPC / SLAB_KPC);      // 10

/** The words each layer prints (`prismNumbers().region`). */
export const LAYER_NAME = Object.freeze({ thin: 'THIN DISK', thick: 'THICK DISK', halo: 'HALO' });

/** Slab index k of a height, GalaxyGrid's half-open rule (y = 0 is N1, k = 0). Non-finite → 0. */
export function slabIndexOfY(y) {
  const s = addressOf(0, Number.isFinite(y) ? y : 0, 0).slab;
  return s.hemi === 'N' ? s.n - 1 : -s.n;
}
/** k → { hemi, n }. */
export function slabOfIndex(k) { return k >= 0 ? { hemi: 'N', n: k + 1 } : { hemi: 'S', n: -k }; }
/** k → 'N16' / 'S3'. */
export function refOfIndex(k) { return slabRef(slabOfIndex(k)); }
/** k → [yMin, yMax) in kpc — the exact doubles `GalaxyGrid.boundsOf` (and so the loader) uses. */
export function slabYRange(k) {
  const b = boundsOf({ sector: { i: 0, j: 0 }, slab: slabOfIndex(k) });
  return [b.min.y, b.max.y];
}
/** 'N16' | { hemi, n } → k, or null when malformed. */
export function indexOfRef(ref) {
  let hemi, n;
  if (ref && typeof ref === 'object') ({ hemi, n } = ref);
  else {
    const m = /^\s*([NnSs])\s*(\d+)\s*$/.exec(String(ref ?? ''));
    if (!m) return null;
    hemi = m[1].toUpperCase(); n = Number(m[2]);
  }
  if ((hemi !== 'N' && hemi !== 'S') || !Number.isInteger(n) || n < 1) return null;
  return hemi === 'N' ? n - 1 : -n;
}

/** ⭐ THE ONE LAYER FUNCTION — 'thin' | 'thick' | 'halo' for slab index k (plan §7.2). */
export function layerOfIndex(k) {
  const n = k >= 0 ? k + 1 : -k;
  return n <= THIN_N ? 'thin' : n <= THICK_N ? 'thick' : 'halo';
}
/** The layer of a height: the layer of the slab it is in, so the readout and the bar never disagree. */
export function layerOfY(y) { return layerOfIndex(slabIndexOfY(y)); }

/** Bar row i (0 = top = N30 … 59 = bottom = S30) ↔ slab index k. */
export function indexOfRow(i) { return BAR_HEMI - 1 - i; }
export function rowOfIndex(k) { return BAR_HEMI - 1 - k; }

/**
 * Row i's texel span [y0, y1) inside a bar whose cells run from `top` for `span` texels. Integer
 * edges with the remainder spread (3.6 texels a cell do not exist), so 60 rows tile the span exactly
 * — no texel belongs to two cells and none to no cell.
 */
export function barRow(i, top, span) {
  return [top + Math.floor((i * span) / BAR_CELLS), top + Math.floor(((i + 1) * span) / BAR_CELLS)];
}

/** The cell span of a published bar rectangle `{ x, y, w, h }`: `[top, span]` inside the end insets. */
export function barSpan(r) { return [r.y + BAR_INSET, r.h - 2 * BAR_INSET]; }

/**
 * ⭐ THE HIT-TEST: the slab index under texel row `py` of a published bar, clamped to the end cells
 * (a drag that runs off either end stays on N30 / S30), or null when no bar is published.
 * Exactly the inverse of `barRow` — the same floor arithmetic, searched, not re-derived.
 */
export function barIndexAt(r, py) {
  if (!r || !Number.isFinite(py) || !(r.h > 2 * BAR_INSET)) return null;
  const [top, span] = barSpan(r);
  let i = Math.floor(((py - top) * BAR_CELLS) / span);
  i = Math.max(0, Math.min(BAR_CELLS - 1, i));
  while (i > 0 && py < barRow(i, top, span)[0]) i--;
  while (i < BAR_CELLS - 1 && py >= barRow(i, top, span)[1]) i++;
  return indexOfRow(i);
}

/**
 * Is the texel (x, y) on a published bar's click area? The paint rectangle plus one texel of skirt
 * each side (the fine gauge's own allowance, `index.js` `gaugeGrab`). ⛔ The bar is tested BEFORE the
 * gauge, and the gauge's test excludes this area, so where two skirts would meet each texel answers
 * exactly one widget (plan §7.3: "every widget gets its own non-overlapping … click rectangle").
 */
export function onBar(r, x, y) {
  return !!r && Number.isFinite(x) && Number.isFinite(y)
    && x >= r.x - 1 && x < r.x + r.w + 1 && y >= r.y && y < r.y + r.h;
}
