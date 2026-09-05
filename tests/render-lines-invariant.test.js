// ═══════════════════════════════════════════════════════════════════════════════════════════════
// THE RENDER-LINES INVARIANT.
//
// WHY THIS FILE EXISTS. Max, 2026-09-05, asked whether a 320x240 image was being stretched across
// his ultrawide. It never was — both axes were always divided by the same scalar — but the question
// exposed the real gap: the era's fixed quantity was the SCANLINE COUNT, and a divisor holds the
// magnification fixed instead, so vertical resolution moved every time the window did.
//
// The whole point of the change is one property: THE LINE COUNT IS WHAT THE SETTING SAYS, on any
// window, and the width carries the aspect. That property is invisible in the running game — you
// would have to resize the window and read a render target to see it break — so it is asserted here.
//
// ⚠ AND THE MIGRATION IS ASSERTED TOO, because it runs exactly once against Max's real stored value
// and there is no second chance to get it right. His 4.5 on a 1130-tall window must land on 240.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import {
  bufferForLines, migrateToRenderLines, clampRenderLines, describeRenderLines,
  RENDER_LINE_OPTIONS, RENDER_LINES_DEFAULT,
} from '../src/rendering/renderLines.js';

/** Windows worth caring about: Max's, a laptop, a superultrawide, and a genuine 4:3. */
const WINDOWS = [
  { name: "Max's viewport", w: 2205, h: 1130 },
  { name: '1080p',          w: 1920, h: 1080 },
  { name: '720p laptop',    w: 1280, h: 720 },
  { name: 'superultrawide', w: 3840, h: 1600 },
  { name: '4:3',            w: 1024, h: 768 },
  { name: 'portrait',       w: 800,  h: 1280 },
];

describe('bufferForLines', () => {
  it('makes the buffer height EXACTLY the line count, on every window and every mode', () => {
    for (const win of WINDOWS) {
      for (const lines of RENDER_LINE_OPTIONS) {
        const { height } = bufferForLines(win.w, win.h, lines);
        expect(height, `${win.name} @ ${lines}p`).toBe(lines);
      }
    }
  });

  it('preserves the window aspect to within a pixel of rounding', () => {
    for (const win of WINDOWS) {
      for (const lines of RENDER_LINE_OPTIONS) {
        const { width, height } = bufferForLines(win.w, win.h, lines);
        const bufAspect = width / height;
        const winAspect = win.w / win.h;
        // One pixel of width is the whole rounding budget; express the tolerance that way rather
        // than as a magic percentage, so it stays honest at 144p and at 720p alike.
        expect(Math.abs(bufAspect - winAspect), `${win.name} @ ${lines}p`).toBeLessThan(1 / height);
      }
    }
  });

  it('gives a 4:3 window exactly 320x240 at 240p — the real console mode', () => {
    // ⭐ NOT A COINCIDENCE AND WORTH PINNING: if the derivation is right, the canonical era
    // resolution falls out of a 4:3 window for free. If this line ever goes red the arithmetic has
    // drifted, whatever the other tests say.
    expect(bufferForLines(1024, 768, 240)).toMatchObject({ width: 320, height: 240 });
    expect(bufferForLines(1600, 1200, 240)).toMatchObject({ width: 320, height: 240 });
  });

  it('reports the magnification the shaders divide by', () => {
    // Every dither cell and point size divides by this; if it disagrees with the allocation you get
    // the 13.5px checker (pixelScaleUniform.js). Same source, so they cannot disagree.
    expect(bufferForLines(2205, 1130, 240).scale).toBeCloseTo(1130 / 240, 6);
    expect(bufferForLines(1280, 720, 240).scale).toBeCloseTo(3, 6);
  });

  it('never returns a zero dimension, which would be a silent black frame', () => {
    for (const [w, h, lines] of [[0, 0, 240], [1, 1, 240], [10, 4000, 144], [4000, 10, 720]]) {
      const b = bufferForLines(w, h, lines);
      expect(b.width).toBeGreaterThanOrEqual(1);
      expect(b.height).toBeGreaterThanOrEqual(1);
    }
  });

  it('changes magnification, not line count, as the window resizes', () => {
    // The property the divisor could not hold, stated directly.
    const sizes = WINDOWS.map((w) => bufferForLines(w.w, w.h, 240));
    expect([...new Set(sizes.map((s) => s.height))]).toEqual([240]);
    expect(new Set(sizes.map((s) => s.scale)).size).toBeGreaterThan(1);
  });
});

describe('migrateToRenderLines', () => {
  it("lands Max's stored 4.5 divisor on 240p, the mode he said he prefers", () => {
    // 1130 / 4.5 = 251.1, and the nearest offered mode is 240. This is THE case that matters.
    expect(migrateToRenderLines(undefined, 4.5, 1130)).toBe(240);
  });

  it('treats a value over 16 as lines and 16-or-under as a legacy divisor', () => {
    // Unambiguous by magnitude: the old setting was clamped to 8, a line count is never under 100.
    expect(migrateToRenderLines(288, 4.5, 1130)).toBe(288);   // new key wins
    expect(migrateToRenderLines(undefined, 3, 1440)).toBe(480); // 1440/3 = 480 exactly
    expect(migrateToRenderLines(undefined, 1, 1130)).toBe(720); // full-res divisor -> the top mode
  });

  it('falls back rather than throwing on junk, so a corrupt blob cannot black the screen', () => {
    for (const bad of [undefined, null, NaN, 'banana', {}, -5, 0, Infinity]) {
      expect(RENDER_LINE_OPTIONS).toContain(migrateToRenderLines(bad, bad, 1130));
    }
    expect(migrateToRenderLines(undefined, undefined, 1130)).toBe(RENDER_LINES_DEFAULT);
  });

  it('is idempotent — running it on its own output does not drift', () => {
    let v = migrateToRenderLines(undefined, 4.5, 1130);
    for (let i = 0; i < 5; i++) v = migrateToRenderLines(v, 4.5, 1130);
    expect(v).toBe(240);
  });
});

describe('clampRenderLines', () => {
  it('snaps to a real mode rather than accepting an arbitrary number', () => {
    expect(clampRenderLines(251)).toBe(240);
    expect(clampRenderLines(1)).toBe(144);
    expect(clampRenderLines(99999)).toBe(720);
    expect(RENDER_LINE_OPTIONS).toContain(clampRenderLines(NaN));
  });
});

describe('describeRenderLines', () => {
  it("reads as the numbers Max asked for", () => {
    // Max, 2026-09-06, on the divisor: "There is no measurement that says 4.5 only ratios like
    // 630x323." The readout has to name the mode AND the buffer.
    expect(describeRenderLines(240, 2205, 1130)).toBe('240p · 468×240');
    expect(describeRenderLines(240, 1024, 768)).toBe('240p · 320×240');
  });
});
