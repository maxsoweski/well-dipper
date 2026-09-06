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
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
import {
  drawPixelText, measurePixelText, pixelTextHeight, hasGlyph,
  FACE, setPixelFace, pixelFaceNames,
} from '../src/rendering/PixelText.js';

// ⛔ READ LIVE, NEVER DESTRUCTURED. The face is switchable (there is an in-game A/B), so a
// `const { w } = FACE` at import would freeze these at whichever face loaded first — the exact
// bug the module's own header warns about for its consumers.
const GW = () => FACE.w, GH = () => FACE.h, ADV = () => FACE.advance;

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
    expect(maxX).toBeGreaterThanOrEqual(ADV() * (EXOTIC.length - 1));
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
    expect(measurePixelText('A', 1)).toBe(GW());
    // 3 cells + 2 gaps, no trailing gap — derived from the live face, because the numbers were
    // 11 and 22 on the 3x5 face and are 17 and 34 on the 5x7 one.
    expect(measurePixelText('ABC', 1)).toBe(3 * ADV() - 1);
    expect(measurePixelText('ABC', 2)).toBe(3 * ADV() * 2 - 2);
    expect(pixelTextHeight(1)).toBe(GH());
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
    expect(measurePixelText(' ', 1)).toBe(GW());
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// ⭐ THE CONFUSABILITY GATE — the measurement that condemned the 3x5 face.
//
// Max, 2026-09-07: *"this font is no longer a good fit for this resolution"*. The cause was not the
// resolution, it was CELL WIDTH: three columns cannot hold the letters distinguished by their
// MIDDLE. Counting pairs of glyphs that differ by two lit pixels or fewer put a number on it —
// 3x5 had TWELVE such pairs, M/N among them differing by a single pixel of fifteen.
//
// This is a legibility floor, not a look test. Whether the face reads WELL is Max's eye.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
describe('PixelText legibility floor', () => {
  /** Every pair of glyphs within `limit` lit pixels of each other, drawn through the real API. */
  function confusablePairs(limit = 2) {
    // ⭐ RENDERED, NOT READ OFF THE TABLE. Asking `drawPixelText` what it draws means the gate
    // measures what reaches the glass; a scan of the glyph object would pass a face whose draw
    // path dropped rows.
    const bitmapOf = (ch) => {
      const rects = [];
      drawPixelText({ fillStyle: '', fillRect: (x, y) => rects.push(`${x},${y}`) }, ch, 0, 0, {});
      return new Set(rects);
    };
    const chars = [];
    for (let c = 65; c <= 90; c++) chars.push(String.fromCharCode(c));
    for (let d = 0; d <= 9; d++) chars.push(String(d));
    const bmp = new Map(chars.map((c) => [c, bitmapOf(c)]));
    const out = [];
    for (let i = 0; i < chars.length; i++) {
      for (let j = i + 1; j < chars.length; j++) {
        const a = bmp.get(chars[i]), b = bmp.get(chars[j]);
        let d = 0;
        for (const k of a) if (!b.has(k)) d++;
        for (const k of b) if (!a.has(k)) d++;
        if (d <= limit) out.push(`${chars[i]}/${chars[j]}=${d}px`);
      }
    }
    return out;
  }

  it('the SHIPPED face keeps every letter and digit apart', () => {
    setPixelFace('5x5');
    const pairs = confusablePairs(2);
    // D/O are near-identical in every typeface ever cut; that one is honest and is the only
    // letter-pair allowed through. Any NEW entry here is a glyph that needs redrawing.
    expect(pairs, `confusable at <=2px on the ${FACE.name} face: ${pairs.join(' ')}`).toEqual(['D/O=2px']);
  });

  it('the gate is not vacuous — loosen the threshold and it finds plenty', () => {
    // ⛔ THE NON-VACUITY CHECK, AND IT NO LONGER HAS A BAD FACE TO LEAN ON. It used to assert the
    // 3x5 face failed at <=2px; that face is deleted (Max rejected it twice and it was a
    // maintenance tax on every glyph addition). Widening the threshold proves the same thing
    // without keeping a face nobody ships: if `confusablePairs` had stopped measuring similarity,
    // it would return nothing at ANY threshold.
    setPixelFace('5x5');
    expect(confusablePairs(2)).toEqual(['D/O=2px']);
    expect(confusablePairs(6).length).toBeGreaterThan(10);
  });

  it('the taller A/B alternative clears the same bar, so the choice is size and not legibility', () => {
    setPixelFace('5x7');
    expect(confusablePairs(2)).toEqual(['D/O=2px']);
    setPixelFace('5x5');
  });

  it('every face renders the same character set, so the A/B cannot throw on one of them', () => {
    // The in-game `;` A/B swaps the face under live draw calls that pass onMissing:'throw'.
    const LITERALS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,:-\u2014/%+_<>';
    for (const face of pixelFaceNames()) {
      setPixelFace(face);
      const missing = [...LITERALS].filter((ch) => !hasGlyph(ch));
      expect(missing, `${face} cannot render ${missing.join('')}`).toEqual([]);
    }
    setPixelFace('5x5');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// ⭐ COCKPIT + NAV COVERAGE (chrome-and-ui-at-240p batch 2, step 1)
//
// ⛔ A MISSING GLYPH HERE IS A BLACK PANEL, NOT A MISSING CHARACTER. `drawPixelText` defaults to
// `onMissing: 'throw'`, `PanelHost` catches a painter throw ONCE and then leaves that screen
// frozen, and `NavPanel` clears the screen before it draws — so the pilot loses the whole panel.
//
// ⚠ SCANNED, NOT LISTED. The batch plan carried a hand-written list of missing characters; five of
// them appear in no cockpit source at all and it missed five that do (`!` `=` `*` `|` and the
// middle dot). A list goes stale silently the first time somebody edits a literal. This reads the
// sources.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
describe('PixelText covers what the cockpit and nav actually draw', () => {
  // ⚠ Every path is guarded by `existsSync` below, and that guard has already earned its keep:
  // it caught `AlertCue.js` listed under src/cockpit when it lives in src/ui. A scan over a file
  // that is not there reports ZERO missing characters, which is the most dangerous possible pass.
  const SOURCES = [
    'src/ui/NavComputer.js', 'src/ui/AlertCue.js',
    'src/cockpit/PhosphorScreen.js', 'src/cockpit/InfoReadout.js', 'src/cockpit/FlightReadout.js',
    'src/cockpit/panels/NavPanel.js', 'src/cockpit/panels/DrivePanel.js',
    'src/cockpit/panels/InfoPanel.js', 'src/cockpit/panels/TargetPanel.js',
  ];

  /** Every character reachable from a drawn string literal in these files. */
  function drawnCharacters() {
    const found = new Map();
    for (const rel of SOURCES) {
      const abs = resolve(HERE, '..', rel);
      if (!existsSync(abs)) throw new Error(`coverage scan points at a file that moved: ${rel}`);
      const code = readFileSync(abs, 'utf8');
      const re = /(?:fillText|strokeText|\.text|\.banner|drawPixelText)\(\s*(?:[A-Za-z_$][\w$.]*\s*,\s*)?(['`"])((?:\\.|(?!\1)[^\\])*)\1/g;
      let m;
      while ((m = re.exec(code))) {
        // ⚠ Strip `${…}` spans first. Their contents are EXPRESSIONS, not glyphs — requiring a
        // face to render `$`, `{` and `.` because a template interpolates would be nonsense.
        const literal = m[2].replace(/\$\{[^}]*\}/g, '');
        for (const ch of literal) if (!found.has(ch)) found.set(ch, rel);
      }
    }
    return found;
  }

  it('finds real literals to check, so the assertion below cannot pass by scanning nothing', () => {
    const found = drawnCharacters();
    expect(found.size).toBeGreaterThan(30);
    expect(found.has('A') || found.has('a')).toBe(true);
  });

  it('every face renders every character the cockpit and nav draw', () => {
    const found = drawnCharacters();
    for (const face of pixelFaceNames()) {
      setPixelFace(face);
      const missing = [...found.entries()].filter(([ch]) => !hasGlyph(ch));
      expect(missing.map(([ch, src]) => `${JSON.stringify(ch)} (${src})`),
        `${face} cannot render these — each one is a black panel`).toEqual([]);
    }
    setPixelFace('5x5');
  });
});
