// ═══════════════════════════════════════════════════════════════════════════════════════════════
// THE ONE GLYPH SET.
//
// `PixelText` is the bitmap face every low-resolution surface draws through — HUD, targeting
// reticle, and the cockpit panels when batch 2 lands. This file pins the two things that would
// otherwise fail SILENTLY and only in the running game:
//
//   1. COVERAGE. A character the face cannot render is either an exception mid-frame or a box on
//      screen. The alert strings and readouts are fixed literals, so the exact set they need is
//      knowable NOW rather than at the moment a pilot needs to read one.
//   2. THE TWO MISSING-GLYPH POLICIES, which are deliberately different. Fixed literals throw
//      (an authoring bug should be loud); procedurally generated body names draw tofu (an unexpected
//      codepoint must not take the whole overlay down).
//
// ⚠ NOT A LOOK TEST. Whether the face reads well at 240p is Max's eye. What is checkable here is
// that it renders the characters the game actually emits, at the geometry it claims.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import {
  drawPixelText, measurePixelText, pixelTextHeight, hasGlyph, GLYPH_W, GLYPH_H, ADVANCE,
} from '../src/rendering/PixelText.js';

/** Records fillRect calls so geometry can be asserted without a DOM. */
function recordingCtx() {
  const rects = [];
  return {
    rects,
    fillStyle: '',
    fillRect(x, y, w, h) { rects.push({ x, y, w, h }); },
  };
}

describe('PixelText coverage', () => {
  it('renders every character the shipped literals actually contain', () => {
    // ⭐ SOURCED, NOT GUESSED. These are the strings the HUD and alert cues emit verbatim, plus the
    // separators the readouts format with. If a literal changes, this list is where it gets caught.
    const LITERALS = [
      'TOO CLOSE — SUBLIGHT ONLY',   // ⚠ U+2014 EM DASH, not a hyphen
      'SAFE TO DROP',
      'MODE: SUPERCRUISE',
      'ALIGN',
      'THROTTLE',
      '0.34C', '1,250 KM/S', '99.9%', '-40', '12:04', 'A/B', '<>', '+1',
    ];
    const missing = new Set();
    for (const s of LITERALS) for (const ch of s) if (!hasGlyph(ch)) missing.add(ch);
    expect([...missing]).toEqual([]);
  });

  it('covers A-Z and 0-9 with no holes', () => {
    const missing = [];
    for (let c = 65; c <= 90; c++) if (!hasGlyph(String.fromCharCode(c))) missing.push(String.fromCharCode(c));
    for (let d = 0; d <= 9; d++) if (!hasGlyph(String(d))) missing.push(String(d));
    expect(missing).toEqual([]);
  });

  it('maps lowercase onto the uppercase face rather than failing', () => {
    expect(hasGlyph('a')).toBe(true);
    const upper = recordingCtx(), lower = recordingCtx();
    drawPixelText(upper, 'ABC', 0, 0);
    drawPixelText(lower, 'abc', 0, 0);
    expect(lower.rects).toEqual(upper.rects);
  });
});

describe('PixelText missing-glyph policy', () => {
  const EXOTIC = 'ZØRN';   // a body name the generator could plausibly produce

  it("throws on a fixed literal's unmappable character, because that is an authoring bug", () => {
    expect(() => drawPixelText(recordingCtx(), EXOTIC, 0, 0, { onMissing: 'throw' })).toThrow(/no glyph/);
  });

  it('defaults to throwing, so a caller has to choose deliberately', () => {
    expect(() => drawPixelText(recordingCtx(), EXOTIC, 0, 0)).toThrow(/no glyph/);
  });

  it('draws tofu instead of throwing for procedural text, and keeps drawing the rest', () => {
    // ⭐ THE FAILURE THIS PREVENTS: a throw inside the reticle's draw path takes the whole overlay
    // down, so the pilot loses every marker because one body had an unusual name.
    const ctx = recordingCtx();
    expect(() => drawPixelText(ctx, EXOTIC, 0, 0, { onMissing: 'tofu' })).not.toThrow();
    expect(ctx.rects.length).toBeGreaterThan(0);
    // The characters after the unmappable one still drew.
    const maxX = Math.max(...ctx.rects.map((r) => r.x));
    expect(maxX).toBeGreaterThanOrEqual(ADVANCE * (EXOTIC.length - 1));
  });

  it('restores fillStyle even when it throws, so a caller mid-frame is not left with our colour', () => {
    const ctx = recordingCtx();
    ctx.fillStyle = '#123456';
    expect(() => drawPixelText(ctx, EXOTIC, 0, 0, { onMissing: 'throw', color: '#ff0000' })).toThrow();
    expect(ctx.fillStyle).toBe('#123456');
  });
});

describe('PixelText geometry', () => {
  it('measures without a trailing inter-character gap', () => {
    expect(measurePixelText('', 1)).toBe(0);
    expect(measurePixelText('A', 1)).toBe(GLYPH_W);
    expect(measurePixelText('ABC', 1)).toBe(11);          // 3 cells + 2 gaps, no trailing gap
    expect(measurePixelText('ABC', 2)).toBe(22);
    expect(pixelTextHeight(1)).toBe(GLYPH_H);
  });

  it('draws only integer-aligned texels — a half-covered row is a grey smear once magnified', () => {
    const ctx = recordingCtx();
    drawPixelText(ctx, 'AZ09', 3.4, 7.6, { scale: 2 });
    expect(ctx.rects.length).toBeGreaterThan(0);
    for (const r of ctx.rects) {
      expect(Number.isInteger(r.x)).toBe(true);
      expect(Number.isInteger(r.y)).toBe(true);
      expect(r.w).toBe(2);
      expect(r.h).toBe(2);
    }
  });

  it('honours alignment against its own measurement', () => {
    const left = recordingCtx(), right = recordingCtx(), centre = recordingCtx();
    drawPixelText(left, 'ABC', 100, 0, { align: 'left' });
    drawPixelText(right, 'ABC', 100, 0, { align: 'right' });
    drawPixelText(centre, 'ABC', 100, 0, { align: 'center' });
    const minX = (c) => Math.min(...c.rects.map((r) => r.x));
    expect(minX(left)).toBe(100);
    expect(minX(right)).toBe(100 - measurePixelText('ABC', 1));
    // ⚠ round(x - w/2), NOT x - round(w/2): for an odd width those differ by one texel, and the
    // pen position is what must land on the grid — rounding the half-width first would put the
    // glyph on a half-texel and reintroduce exactly the smear this face exists to avoid.
    expect(minX(centre)).toBe(Math.round(100 - measurePixelText('ABC', 1) / 2));
  });

  it('stays inside the cell it claims, so a caller can lay out against measurePixelText', () => {
    const ctx = recordingCtx();
    const w = drawPixelText(ctx, 'MWX', 0, 0, { scale: 3 });
    const maxRight = Math.max(...ctx.rects.map((r) => r.x + r.w));
    const maxBottom = Math.max(...ctx.rects.map((r) => r.y + r.h));
    expect(maxRight).toBeLessThanOrEqual(w);
    expect(maxBottom).toBeLessThanOrEqual(pixelTextHeight(3));
  });

  it('never emits a rect for a blank — space draws nothing but still advances', () => {
    const ctx = recordingCtx();
    drawPixelText(ctx, ' ', 0, 0);
    expect(ctx.rects).toEqual([]);
    expect(measurePixelText(' ', 1)).toBe(GLYPH_W);
  });
});
