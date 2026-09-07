/**
 * navPrismCull — the PRISM level's missing screen-bounds test.
 *
 * ── THE DEFECT ──────────────────────────────────────────────────────────────────────────────────
 *
 * `NavComputer._renderLocal` had exactly ONE rejection test: the Y-slab window at
 * `NavComputer.js:2019-2021`, which is a WORLD-space filter applied BEFORE projection and therefore
 * cannot know where anything lands on the glass. Everything that survived it was drawn.
 *
 * ── ⛔ AND THE SAVING IS ~0% TODAY. THE PREDECESSOR'S 84% DOES NOT REPRODUCE. ──────────────────
 *
 * The 2026-09-07 handoff's §4.5 reported "at the default zoom 143 markers are projected and 120 of
 * them (84%) are off canvas". Re-measured 2026-09-07 as a proper A/B — the real function against a
 * `() => true` stub, same scene, 1560x860, six view states — the saving is:
 *
 *     default zoom                      0%        rotY 45 deg (cube corners)        0%
 *     10.34 pc zoom ceiling             0%        rotY 45 + ceiling                 0%
 *     lateral pan, 3x radius            0%        ⭐ R/F vertical pan, 5x radius    13%  (31 of 237)
 *
 * ⭐ AND THE GEOMETRY SAYS WHY, WHICH IS WHY THIS IS NOT A FLAKY MEASUREMENT. The prism projects a
 * star's offset NORMALISED BY THE QUERY RADIUS — `x = cx + dx * halfW * 0.92` — and the query fetches
 * a block of that same radius. So |dx| <= 1 by construction and every queried star lands inside the
 * frame. The only axis that escapes is Y, which has its own window (`yWindowHalf`) rather than the
 * radius, so flying the view up or down with R/F is the one gesture that puts markers outside.
 *
 * ⭐⭐ SO WHY KEEP IT. Because the bound is `halfW`, and `halfW` IS THE CANVAS TODAY ONLY BECAUSE THE
 * PRISM OWNS THE WHOLE CANVAS. `nav-fullscreen-view-modes` gives the map a PANE: design 1's map is
 * 43 of 71 columns beside a ranked rail. The moment the pane is narrower than the frame the
 * projection and the query decouple and |dx| <= 1 stops bounding anything. This guard is cheap (four
 * comparisons), correct, and load-bearing the day a mode lands — not a performance win today.
 *
 * Per marker the loop still pays a dashed line, a plane dot, a star glyph, a distance hover test
 * and — for a real named star — a `_labelQueue` push. 212 markers at the default zoom, 437 at the
 * ceiling.
 *
 * ── ⛔ WHY THIS IS A SEGMENT TEST AND NOT A POINT TEST ──────────────────────────────────────────
 *
 * A marker is not a point. It draws a dashed line from `planeP` — its position projected ONTO the
 * galactic plane — to `starP`, its own position. Those are two independently projected points and
 * at a steep tilt they are far apart, so a star well above the top edge can still hang a line down
 * across the whole visible field. A `starP`-plus-margin test would cull it and take the line with
 * it, which is a VISIBLE change dressed as an optimisation.
 *
 * So the test is the **Cohen-Sutherland trivial reject**, and only the trivial reject: a segment
 * cannot intersect the rectangle if BOTH endpoints are outside the SAME edge. It is conservative by
 * construction — the classic diagonal case (both endpoints outside, on different edges, the segment
 * missing the rect anyway) returns `true` and is drawn. That is the correct direction to be wrong
 * in. ⚠ It is also why this must never be "improved" into an exact intersection test without a
 * measurement: exactness costs more per marker than the draws it would save.
 *
 * ── THE RECT IS `drawH`, NOT `h` ────────────────────────────────────────────────────────────────
 *
 * The prism's drawable rect is `[0, w] x [0, navDrawH(h)]`. The strip below `drawH` is the chrome
 * reserve the level tabs are painted into, and a marker there is behind them.
 *
 * ── THE MARGIN, AND EVERY EXTENT IT HAS TO COVER ────────────────────────────────────────────────
 *
 * A marker's ink reaches further than its point, so the rect is grown before the test. The extents,
 * all measured off the draw sites:
 *
 *     hover hit radius        12      NavComputer.js:2038  `hitDist`  ⭐ the largest, and the bound
 *     selected-star ring      11.5    :2139-2142           `10 * pulse`, pulse <= 1.15
 *     current-system ring     11.4    :2153-2156           `(baseRadius + 5) * pulse`, pulse <= 1.2
 *     glyph reach              7.7    :2302-2310           `drawR * 1.4` on the n>=2 dot patterns
 *     amber real-star ring     6.5    :2112                `baseRadius + 2`
 *     plane dot                1.5    :2085
 *
 * 12 is the bound and it is the hover radius, which is the one that MUST be covered for a reason
 * beyond ink: the mouse is always inside the canvas, so a marker further than `hitDist` outside it
 * can never be the hovered star, and culling it cannot change `_hoveredLocalStar`.
 *
 * ── ⭐ THE LABEL PUSH IS CULLED TOO, AND THAT IS THE POINT, NOT A SIDE EFFECT ───────────────────
 *
 * `placeLabels` (`labelPlacement.js:56-59`) gives each label a FIVE-slot vertical search window
 * against ONE global `occupied` pool, so a label anywhere in the frame can block another's five
 * tries. Off-screen stars compete for those slots; dropping their candidates is what turns a cull
 * from "fewer draw calls" into "more of the names you can see are legible".
 * ⚠ UNMEASURED HERE. The handoff's "100 of 139 labels faded at the ceiling" is inherited, and the
 * headless scene emits an EMPTY `_labelQueue` (no real-catalog stars merge in it), so this file has
 * not reproduced it either. Stated as the mechanism, not as a result.
 *
 * ⚠ SO THIS IS A VISIBLE CHANGE AND IT IS DELIBERATE. The case it removes: a real star just outside
 * the frame whose label could be nudged up to two line-heights back inside it — a name floating at
 * the edge with a leader line pointing at a star that is not drawn. That was never worth a slot.
 * ⛔ No formatter is shortened and no string becomes unproducible; a marker inside the frame emits
 * exactly what it emitted before. This is a drawn-or-not decision at the glass.
 *
 * ── WHAT IS DELIBERATELY *NOT* CULLED ───────────────────────────────────────────────────────────
 *
 * `projByName` (`NavComputer.js:2034-2035`) is built in its own loop over the UNCULLED projection,
 * so the co-membership tethers `_drawMembershipCues` draws still reach a wide companion that is off
 * the frame. That loop's own comment already fixes the intent — "an off-view co-member simply has
 * no entry -> no line" — and off-VIEW there means outside the Y-slab, a world-space idea. Screen
 * bounds must not quietly redefine it.
 */

/**
 * The rectangle grows by this before the test — the largest fixed extent any marker draws, which is
 * `hitDist` at `NavComputer.js:2038`. See the header table.
 */
export const PRISM_CULL_MARGIN = 12;

/**
 * Can this marker put ink on the glass? The Cohen-Sutherland trivial reject, and nothing more.
 *
 * @param {{x:number,y:number}} planeP the marker's galactic-plane point — one end of the dashed line
 * @param {{x:number,y:number}} starP  the marker's own point — the other end, and every glyph
 * @param {number} w      canvas width
 * @param {number} drawH  the drawable height, `navDrawH(h)` — NOT `h`
 * @param {number} [margin=PRISM_CULL_MARGIN]
 * @returns {boolean} false ONLY when the segment provably cannot reach the grown rect.
 *
 * ⚠ NaN-SAFE BY FALLING OPEN. A non-finite projection makes every comparison false, so the marker
 * is kept and drawn exactly as it is today. A cull is not the place to start rejecting bad numbers.
 */
export function prismMarkerMayShow(planeP, starP, w, drawH, margin = PRISM_CULL_MARGIN) {
  const minX = -margin, maxX = w + margin;
  const minY = -margin, maxY = drawH + margin;
  if (planeP.x < minX && starP.x < minX) return false;
  if (planeP.x > maxX && starP.x > maxX) return false;
  if (planeP.y < minY && starP.y < minY) return false;
  if (planeP.y > maxY && starP.y > maxY) return false;
  return true;
}
