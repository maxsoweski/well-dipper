/**
 * labelPlacement — pure greedy screen-space AABB label placement (AC9 of
 * real-star-identity-unification-2026-07-15; mechanism designed in
 * ac9-uat-findings.md finding #1).
 *
 * WHAT: given a list of labels — each carrying a HOME axis-aligned bounding box
 * ({x,y} top-left + {w,h}) and a `priority` — place them so drawn labels never
 * overlap. Highest priority claims its home slot; a lower-priority label that
 * would collide steps to the next free vertical stack slot (±1, ±2 line-heights,
 * …); if no tried slot frees, it is FADED (drawn at low alpha, not stacked) so a
 * dense field degrades by dimming losers rather than piling illegible text.
 *
 * WHY PURE + SEPARATE MODULE: the placement is O(n²) geometry with no canvas
 * dependency, so it is unit-tested headless (overlap resolution, stacking, fade,
 * leader decision). NavComputer measures text widths (canvas) and draws; this
 * module owns only the geometry. The `y` field is the box TOP-LEFT in screen
 * pixels — the caller converts to/from a text baseline.
 *
 * DELIBERATE NON-GOALS: no drawing, no font metrics (caller supplies w/h), no
 * horizontal nudging (vertical stacking only, per the finding), no marker/dot
 * movement (labels are draw-only; positions come from the caller unchanged).
 */

/**
 * AABB overlap test. Edge-touching does NOT count as overlap (strict inequality)
 * so labels that only share a boundary are allowed to sit flush.
 *
 * @param {{x:number,y:number,w:number,h:number}} a
 * @param {{x:number,y:number,w:number,h:number}} b
 * @returns {boolean}
 */
export function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/**
 * Place labels greedily by priority, resolving overlaps with vertical stack
 * offsets, fading the labels that find no free slot.
 *
 * Input order is preserved in the output (each output label corresponds to the
 * input at the same index); placement PRIORITY is independent of input order.
 *
 * @param {Array<{x:number,y:number,w:number,h:number,priority:number}>} labels
 *   Each carries its HOME box (top-left x,y + w,h) and a `priority` (higher =
 *   placed first / keeps its home slot). Any extra fields pass through untouched.
 * @param {object} [opts]
 * @param {number} [opts.lineHeight=12] — vertical step per stack slot (px)
 * @param {number[]} [opts.slotOffsets=[0,1,-1,2,-2]] — stack slots to try, in
 *   order, as multiples of lineHeight (0 = home slot)
 * @param {number} [opts.leaderThreshold] — |vertical displacement| beyond which
 *   the label gets a leader line back to its dot (default lineHeight/2)
 * @returns {Array<object>} one entry per input label (same order), each the
 *   input spread with: final `y` (top-left, post-stacking), `faded` (bool),
 *   `leader` (bool — displaced past the threshold), `dy` (px moved from home).
 */
export function placeLabels(labels, opts = {}) {
  const lineHeight = opts.lineHeight ?? 12;
  const slotOffsets = opts.slotOffsets ?? [0, 1, -1, 2, -2];
  const leaderThreshold = opts.leaderThreshold ?? lineHeight / 2;

  // Placement order: priority desc, original index asc as a stable tiebreak.
  const order = labels
    .map((l, i) => ({ l, i }))
    .sort((a, b) => (b.l.priority - a.l.priority) || (a.i - b.i));

  const occupied = []; // AABBs of already-placed (non-faded) labels
  const out = new Array(labels.length);

  for (const { l, i } of order) {
    let chosen = null;
    for (const k of slotOffsets) {
      const dy = k * lineHeight;
      const cand = { x: l.x, y: l.y + dy, w: l.w, h: l.h };
      if (!occupied.some((p) => rectsOverlap(cand, p))) {
        chosen = { y: cand.y, dy };
        occupied.push(cand);
        break;
      }
    }
    if (chosen) {
      out[i] = {
        ...l,
        y: chosen.y,
        faded: false,
        leader: Math.abs(chosen.dy) > leaderThreshold,
        dy: chosen.dy,
      };
    } else {
      // No free slot in the tried set — fade the loser at its home slot. It is
      // NOT added to `occupied`: it is the acknowledged overflow, drawn dim, and
      // excluded from the "zero overlaps among drawn labels" invariant.
      out[i] = { ...l, y: l.y, faded: true, leader: false, dy: 0 };
    }
  }
  return out;
}
