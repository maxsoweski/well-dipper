import { describe, it, expect } from 'vitest';
import { rectsOverlap, placeLabels } from '../labelPlacement.js';

/**
 * AC9 — the deferred label pass's PURE geometry (ac9-uat-findings.md finding #1):
 * greedy screen-space AABB placement with vertical stack offsets, leader-line
 * decision, and low-alpha fade when no slot frees. The canvas half (measureText
 * width, fillText, leader draw) lives in NavComputer and is exercised by the
 * live AC9 drive; this suite pins the placement geometry headless.
 */

// A helper: a label box at (x,y) sized w×h with a priority.
const L = (x, y, w, h, priority, extra = {}) => ({ x, y, w, h, priority, ...extra });

describe('rectsOverlap', () => {
  it('detects overlapping boxes', () => {
    expect(rectsOverlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 })).toBe(true);
  });
  it('treats edge-touching as non-overlapping', () => {
    // Right edge of A == left edge of B: allowed to sit flush.
    expect(rectsOverlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 10, h: 10 })).toBe(false);
    // Bottom edge of A == top edge of B.
    expect(rectsOverlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 0, y: 10, w: 10, h: 10 })).toBe(false);
  });
  it('detects fully separated boxes as non-overlapping', () => {
    expect(rectsOverlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 100, y: 100, w: 10, h: 10 })).toBe(false);
  });
});

describe('placeLabels — no contention', () => {
  it('leaves well-separated labels at their home slots, un-faded, no leaders', () => {
    const placed = placeLabels([
      L(0, 0, 40, 10, 1),
      L(0, 100, 40, 10, 1),
      L(0, 200, 40, 10, 1),
    ], { lineHeight: 12 });
    expect(placed.map((p) => p.y)).toEqual([0, 100, 200]);
    expect(placed.every((p) => p.faded === false && p.leader === false && p.dy === 0)).toBe(true);
  });

  it('preserves input order and passes extra fields through', () => {
    const placed = placeLabels([
      L(0, 0, 40, 10, 1, { name: 'Sol', anchorX: 5 }),
      L(0, 100, 40, 10, 1, { name: 'Vega', anchorX: 7 }),
    ]);
    expect(placed[0].name).toBe('Sol');
    expect(placed[0].anchorX).toBe(5);
    expect(placed[1].name).toBe('Vega');
  });
});

describe('placeLabels — overlap resolution & stacking', () => {
  it('stacks a colliding lower-priority label into the next slot (no overlap remains)', () => {
    const placed = placeLabels([
      L(0, 0, 40, 10, 2), // higher priority — keeps home slot y=0
      L(0, 2, 40, 10, 1), // overlaps the first at home; must step down
    ], { lineHeight: 12 });
    expect(placed[0].y).toBe(0);
    expect(placed[0].faded).toBe(false);
    expect(placed[1].y).not.toBe(2); // moved off its home slot
    // The two drawn boxes must not overlap.
    expect(rectsOverlap(
      { x: placed[0].x, y: placed[0].y, w: 40, h: 10 },
      { x: placed[1].x, y: placed[1].y, w: 40, h: 10 },
    )).toBe(false);
  });

  it('stacks three mutually-overlapping labels to three distinct non-overlapping slots', () => {
    const placed = placeLabels([
      L(0, 0, 40, 10, 3),
      L(0, 3, 40, 10, 2),
      L(0, 6, 40, 10, 1),
    ], { lineHeight: 12 });
    const boxes = placed.map((p) => ({ x: p.x, y: p.y, w: 40, h: 10 }));
    for (let a = 0; a < boxes.length; a++) {
      for (let b = a + 1; b < boxes.length; b++) {
        expect(rectsOverlap(boxes[a], boxes[b])).toBe(false);
      }
    }
    // Distinct y slots.
    expect(new Set(placed.map((p) => p.y)).size).toBe(3);
  });

  it('gives the home slot to the higher-priority label regardless of input order', () => {
    // Lower priority listed first; higher priority second. Higher must win home.
    const placed = placeLabels([
      L(0, 0, 40, 10, 1), // low priority, at home
      L(0, 4, 40, 10, 5), // high priority, overlaps — should claim ITS home (y=4)
    ], { lineHeight: 12 });
    expect(placed[1].y).toBe(4);   // high priority kept its home slot
    expect(placed[1].dy).toBe(0);
    expect(placed[0].y).not.toBe(0); // low priority stepped aside
  });
});

describe('placeLabels — leader-line decision', () => {
  it('flags a leader when displaced past the threshold', () => {
    const placed = placeLabels([
      L(0, 0, 40, 10, 2),
      L(0, 1, 40, 10, 1), // collides — steps a full lineHeight (12) > threshold 6
    ], { lineHeight: 12, leaderThreshold: 6 });
    expect(placed[1].leader).toBe(true);
    expect(Math.abs(placed[1].dy)).toBeGreaterThan(6);
  });

  it('does not flag a leader for a small displacement', () => {
    const placed = placeLabels([
      L(0, 0, 40, 10, 2),
      L(0, 1, 40, 10, 1),
    ], { lineHeight: 4, leaderThreshold: 6 }); // step of 4 < threshold 6
    expect(placed[1].leader).toBe(false);
  });
});

describe('placeLabels — fade fallback', () => {
  it('fades the lowest-priority losers when no slot frees', () => {
    // Four labels all stacked on the same column, but only the home slot is
    // offered (slotOffsets=[0]) — so three of four find no free slot and fade.
    const placed = placeLabels([
      L(0, 0, 40, 10, 4),
      L(0, 1, 40, 10, 3),
      L(0, 2, 40, 10, 2),
      L(0, 3, 40, 10, 1),
    ], { lineHeight: 12, slotOffsets: [0] });
    // Highest priority placed; the rest fade.
    expect(placed[0].faded).toBe(false);
    expect(placed.filter((p) => p.faded).length).toBe(3);
    // The faded ones are the three lowest priorities.
    expect(placed[1].faded).toBe(true);
    expect(placed[2].faded).toBe(true);
    expect(placed[3].faded).toBe(true);
  });

  it('drawn (non-faded) labels never overlap even under heavy contention', () => {
    // Ten labels crammed into a tight column; a limited slot set forces fades.
    const labels = [];
    for (let i = 0; i < 10; i++) labels.push(L(0, i, 60, 10, 10 - i));
    const placed = placeLabels(labels, { lineHeight: 12, slotOffsets: [0, 1, -1] });
    const drawn = placed.filter((p) => !p.faded).map((p) => ({ x: p.x, y: p.y, w: 60, h: 10 }));
    for (let a = 0; a < drawn.length; a++) {
      for (let b = a + 1; b < drawn.length; b++) {
        expect(rectsOverlap(drawn[a], drawn[b])).toBe(false);
      }
    }
    expect(drawn.length).toBeGreaterThan(0); // at least the top priorities drew
  });
});
