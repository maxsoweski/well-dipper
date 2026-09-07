/**
 * navLayout — the nav computer's chrome geometry, DERIVED from the canvas instead of typed.
 *
 * ── WHY THIS MODULE EXISTS ──────────────────────────────────────────────────────────────────────
 *
 * `NavComputer` draws in ABSOLUTE canvas pixels into a canvas whose size it never reasoned about.
 * That was harmless while its only surface was a ~1880x1040 DOM overlay. It stopped being harmless
 * on 2026-09-08, when AC-1 put the cockpit's NAV panel on the world's pixel grid: the same class now
 * also draws into **52 x 43**. Three numbers went negative there —
 *
 *     `const drawH = h - 50`            ->  -7   (four sites, one of them ungated)
 *     `Math.min(w, h) - 80`             ->  -37  (three sites: renderer, drag-pan, tile hover)
 *     `btnY = drawH - 52`               ->  off the glass entirely
 *
 * — and one went absurd rather than negative: `const tabH = 32` made the level-tab strip **74%** of
 * the panel. A negative extent does not throw; it draws an inverted, collapsed, unclickable map, so
 * the failure reads as "the nav computer looks wrong" rather than as an arithmetic bug.
 *
 * ── ⛔ THE CONTRACT THAT SHAPES EVERY FUNCTION HERE ─────────────────────────────────────────────
 *
 * **The DOM overlay's pixels must not move.** Every function below is written so that at overlay
 * sizes it returns the literal it replaced, EXACTLY:
 *
 *     navTabHeight(h)      === 32   for every h >= 160
 *     navChromeReserve(h)  === 50   for every h >= 160
 *     navMapInset(h)       === 80   for every h >= 160
 *     navMapOriginY(h)     === 10   for every h >= 160
 *     navCommitButton(w, drawH).h === 28 and .y === drawH - 52   for every h >= 160, w >= 184
 *
 * The overlay is ~1040 rows; the lab's largest buffers and every existing test fixture (614x512,
 * 800x600, 400x300) are all above 160. So the saturation threshold — not a flag, not a branch on the
 * host — is what guarantees byte-equality. ⚠ THAT IS ALSO WHY THE SATURATION IS PART OF THE
 * DERIVATION AND NOT AN OPTIMISATION: remove the clamps and the overlay moves.
 *
 * ── HOW EACH NUMBER IS DERIVED ──────────────────────────────────────────────────────────────────
 *
 * `tabH` — the level-tab strip. Bounded, not scaled freely:
 *   · UPPER 32, because that is what the overlay has always drawn.
 *   · LOWER 8, because AC-4's own observable fixes it: *"a click 8 rows above the panel's bottom
 *     edge changes level, and one 20 rows above it reaches the body picker"*. The first clause needs
 *     `tabH >= 8`; the second needs `tabH < 20`. On the 43-row panel `floor(43/5) = 8` sits on the
 *     bottom of that window, which is the right end to sit on — the strip is chrome and the map is
 *     the instrument.
 *   · `floor(h/5)` between them. One fifth is the largest fraction that keeps a 43-row panel inside
 *     AC-4's [8, 19] window while still saturating to 32 well below every overlay size.
 *
 * `footer` — the strip of air under the map and beside the tabs, where the one-line hints live.
 *   Derived FROM `tabH`, not from `h`, so the reserve saturates at the same threshold the tab strip
 *   does: 18 at tabH 32 (because 32 + 18 = the 50 the file has always reserved), floored at 5 — one
 *   cap height of the 5-row face, below which a footer row cannot carry a letter at all.
 *
 * `reserve` = `tabH + footer`. This is the old `h - 50`.
 *
 * `mapInset` — the old `Math.min(w, h) - 80`. 80 was never one number: it is the 10-row top margin
 *   plus the 50-row reserve plus 20 rows of slack between the map's bottom edge and the tab strip.
 *   All three are re-derived from the live reserve at the same 10:50:20 proportions, so the sum is
 *   exactly 80 wherever the reserve is exactly 50.
 *
 * `commitButton` — the `[ WARP ]` / `[ BURN ]` rectangle, which AC-4 requires the pilot to actually
 *   press. Two INDEPENDENT copies of `btnW = 180, btnH = 28, btnY = drawH - 52` existed (SYSTEM and
 *   PLANET DETAIL) publishing into ONE `_commitButtonRect` read by ONE hit-test. They are one
 *   function now: fixing warp without fixing burn is not representable.
 *
 * ⛔ NO IMPORTS, NO STATE, NO CANVAS. Pure functions of numbers so the whole geometry is testable
 * with no DOM, no GL and no NavComputer — which is what let the 43-row values above be checked
 * before a single draw site was touched.
 */

/** Today's tab strip, and the value every overlay-sized canvas must keep. */
export const NAV_TAB_H_MAX = 32;
/** AC-4's floor: a click 8 rows above the bottom edge has to land on a tab. */
export const NAV_TAB_H_MIN = 8;
/** Today's reserve minus today's tab strip: `50 - 32`. */
export const NAV_FOOTER_MAX = 18;
/** One cap height of the 5-row face — below this a footer row cannot carry a letter. */
export const NAV_FOOTER_MIN = 5;
/** The reserve the overlay has always had, and the sum this module reproduces there. */
export const NAV_RESERVE_MAX = NAV_TAB_H_MAX + NAV_FOOTER_MAX; // 50
/** `Math.min(w, h) - 80` — the inset the 2D levels have always used. */
export const NAV_MAP_INSET_MAX = 80;
/** The header indent every title has always been drawn at: `ctx.fillText(title, 16, …)`. */
export const NAV_TEXT_INSET_MAX = 16;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/**
 * Height of the level-tab strip, in canvas pixels.
 * ⭐ THIS IS THE NUMBER THAT MUST MOVE IN THREE PLACES AT ONCE — the tab renderer, the autopilot
 * button's vertical placement, and the CLICK HIT-TEST. They were three literals; shrinking one and
 * not the others is five buttons that are drawn where they cannot be pressed.
 */
export function navTabHeight(h) {
  if (!Number.isFinite(h) || h <= 0) return NAV_TAB_H_MAX;
  return clamp(Math.floor(h / 5), NAV_TAB_H_MIN, NAV_TAB_H_MAX);
}

/**
 * The left margin of a header line — the old literal `16` in `ctx.fillText(title, 16, 24)`.
 *
 * ⛔ SATURATES AT 208 COLUMNS, which is a long way below the narrowest canvas the overlay or the
 * test corpus has (400x300 is the smallest fixture in the repo, the DOM overlay is ~1880 wide), so
 * every existing surface keeps its 16 exactly. On the 52-column panel it is 4 — a margin, not a
 * third of the glass. A FIXED pixel indent eats a different fraction of the panel at every
 * resolution (31% / 16% / 10% across the three shipped buffers), which is the same class of bug as
 * the 32-row tab strip: a number that was a margin on the overlay and is furniture on the panel.
 */
export function navTextInset(w) {
  if (!Number.isFinite(w) || w <= 0) return NAV_TEXT_INSET_MAX;
  return clamp(Math.floor(w / 13), 1, NAV_TEXT_INSET_MAX);
}

/** The one-line hint band under the map, derived from the tab strip so both saturate together. */
export function navFooterBand(h) {
  const t = navTabHeight(h);
  return clamp(Math.round((t * NAV_FOOTER_MAX) / NAV_TAB_H_MAX), NAV_FOOTER_MIN, NAV_FOOTER_MAX);
}

/** The bottom chrome reserve — the old literal `50`. */
export function navChromeReserve(h) {
  return navTabHeight(h) + navFooterBand(h);
}

/**
 * The drawable height above the chrome — the old `h - 50`.
 * ⚠ CLAMPED TO 1, not allowed to go negative. A negative `drawH` does not throw; it inverts every
 * projection derived from it and draws a collapsed smear, and `PanelHost` would report nothing.
 */
export function navDrawH(h) {
  if (!Number.isFinite(h)) return 0;
  return Math.max(1, h - navChromeReserve(h));
}

/** Top margin of the 2D map — the old literal `oy = 10`. */
export function navMapOriginY(h) {
  return Math.max(1, Math.round((navChromeReserve(h) * 10) / NAV_RESERVE_MAX));
}

/** Slack between the map's bottom edge and the tab strip — the 20 hidden inside the old `80`. */
export function navMapSlack(h) {
  return Math.max(1, Math.round((navChromeReserve(h) * 20) / NAV_RESERVE_MAX));
}

/**
 * The total vertical inset of the 2D map — the old literal `80` in `Math.min(w, h) - 80`.
 * ⭐ THREE CALL SITES: the renderer, the drag-pan scale and the tile-hover hit-test. `_hoveredTile`
 * is written by the hover site alone and read by the click drill alone, so a renderer that moves
 * without them is a map you can see and cannot click.
 */
export function navMapInset(h) {
  return navMapOriginY(h) + navChromeReserve(h) + navMapSlack(h);
}

/** The square extent of the 2D map — the old `Math.min(w, h) - 80`, floored so it cannot invert. */
export function navMapSize(w, h) {
  return Math.max(1, Math.min(w, h) - navMapInset(h));
}

/**
 * The COMMIT rectangle — `[ WARP ]` at SYSTEM and `[ BURN ]` at PLANET DETAIL, which were two
 * independent copies of the same three numbers feeding one hit-test.
 *
 * @param {number} w canvas width
 * @param {number} drawH the drawable height (`navDrawH(h)`, or `h` on a bare frame)
 * @param {number} h canvas height — the reserve is derived from the CANVAS, not from `drawH`
 * @returns {{x:number,y:number,w:number,h:number,labelDy:number}}
 */
export function navCommitButton(w, drawH, h) {
  const reserve = navChromeReserve(h);
  const bh = clamp(Math.round((reserve * 28) / NAV_RESERVE_MAX), 7, 28);
  const gap = clamp(Math.round((reserve * 24) / NAV_RESERVE_MAX), 2, 24);
  const bw = Math.max(12, Math.min(180, w - 4));
  return {
    // ⛔ NOT rounded: the overlay has always centred on the raw half, and a canvas of odd width
    // would land half a pixel away from where it does today if this rounded.
    x: (w - bw) / 2,
    y: drawH - bh - gap,
    w: bw,
    h: bh,
    // The label's baseline inside the box: 19 of 28 on the overlay.
    labelDy: Math.max(2, Math.round((bh * 19) / 28)),
  };
}
