// tests/mobile-navcomputer-touch.test.js
// The star map must be reachable with a finger.
//
// THE DEFECT. The nav computer's canvas carried SIX input listeners — mousemove, mousedown, mouseup,
// mouseleave, click, wheel — and not one touch event. On a phone the map opened and then could not be
// moved: no pan, no orbit, no zoom. iOS synthesizes a click from a tap, so SELECTING a tile appeared to
// work, which is precisely what hid the problem: the one thing that worked was the one thing synthesis
// covers, and everything needing a DRAG or a WHEEL had no path at all.
//
// This is a source scan because the alternative is a DOM harness for a 4,400-line canvas UI, and the
// thing worth pinning is narrow: the listeners exist, they are non-passive so preventDefault works, and
// the gesture code reuses the mouse model rather than reimplementing it.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { stripCommentsPreservingOffsets } from './helpers/source-scan.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const NAV = stripCommentsPreservingOffsets(
  readFileSync(resolve(REPO, 'src/ui/NavComputer.js'), 'utf8'), { blankLiteralText: true },
);
// A second view with string literals intact — event NAMES are string literals, so the blanked view
// cannot see them. (The same two-view lesson as tests/deep-link-boot-wiring.test.js.)
const NAV_STRINGS = stripCommentsPreservingOffsets(
  readFileSync(resolve(REPO, 'src/ui/NavComputer.js'), 'utf8'),
);

describe('nav computer star map — a finger can move it', () => {
  it('the canvas listens for the whole touch lifecycle', () => {
    for (const ev of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) {
      expect(NAV_STRINGS, `canvas listens for ${ev}`)
        .toMatch(new RegExp(`addEventListener\\(\\s*['"]${ev}['"]`));
    }
  });

  it('⭐ touchstart and touchmove are NON-passive, or preventDefault is ignored', () => {
    // A passive touchmove listener cannot cancel the browser's own scroll/rubber-band, so the page
    // would slide around underneath the map while you tried to drag it. This is the difference between
    // "there is a handler" and "the handler can do its job".
    for (const ev of ['touchstart', 'touchmove']) {
      const m = NAV_STRINGS.match(new RegExp(`addEventListener\\(\\s*['"]${ev}['"][^;]*`));
      expect(m, `${ev} registration found`).toBeTruthy();
      expect(m[0], `${ev} is { passive: false }`).toMatch(/passive:\s*false/);
    }
  });

  it('touch reuses the mouse drag model instead of reimplementing it', () => {
    // A Touch carries clientX/clientY exactly as a MouseEvent does, so the pan/orbit maths is shared.
    // Two implementations of the same drag would drift the moment either is tuned.
    expect(NAV, 'touchstart delegates to the mousedown path').toMatch(/_handleTouchStart[\s\S]{0,900}_handleMouseDown\(/);
    expect(NAV, 'touchmove delegates to the mousemove path').toMatch(/_handleTouchMove[\s\S]{0,900}_handleMouseMove\(/);
    expect(NAV, 'touchend delegates to the mouseup path').toMatch(/_handleTouchEnd[\s\S]{0,600}_handleMouseUp\(/);
  });

  it('pinch zoom exists and shares the wheel\'s clamps to the digit', () => {
    expect(NAV, 'a pinch spread is measured').toMatch(/_touchSpread/);
    expect(NAV, 'a continuous zoom law exists').toMatch(/_zoomByRatio/);
    // The clamps are the identity that matters: pinch must not be able to reach a zoom the wheel cannot.
    const zoom = NAV.match(/_zoomByRatio\(r\)\s*\{[\s\S]*?\n  \}/);
    expect(zoom, '_zoomByRatio body found').toBeTruthy();
    expect(zoom[0], 'prism clamp matches the wheel').toMatch(/0\.002/);
    expect(zoom[0], 'system zoom clamps match the wheel').toMatch(/0\.3/);
    expect(zoom[0], 'system zoom upper clamp matches the wheel').toMatch(/5\.0/);
  });

  it('⛔ the WHEEL still uses its own literal constants — no silent desktop drift', () => {
    // 1.15 and 0.87 are NOT exact reciprocals (1/1.15 = 0.869565…), so routing the wheel through the
    // continuous law would have moved desktop zoom by ~0.05% per notch: invisible, undeclared, and a
    // change to shipped behaviour made for tidiness. The wheel keeps its literals deliberately.
    const wheel = NAV.match(/_handleWheel\(e\)\s*\{[\s\S]*?\n  \}/);
    expect(wheel, '_handleWheel body found').toBeTruthy();
    expect(wheel[0], 'wheel keeps 1.15').toMatch(/1\.15/);
    expect(wheel[0], 'wheel keeps 0.87').toMatch(/0\.87/);
    expect(wheel[0], 'wheel does not route through the pinch law').not.toMatch(/_zoomByRatio/);
  });

  it('search result rows are tappable, not only mouse-clickable', () => {
    // The rows used mousedown only, leaning on iOS synthesis — while calling preventDefault, which can
    // suppress the very synthesized click it was relying on.
    expect(NAV_STRINGS, 'rows listen for touchend').toMatch(/row\.addEventListener\(\s*['"]touchend['"]/);
  });

  it('CONTROL — the scan is live and reading this file', () => {
    expect(NAV.length).toBeGreaterThan(50000);
    expect(NAV, 'the mouse handlers this builds on are visible').toMatch(/_handleMouseDown\(e\)\s*\{/);
    expect(NAV_STRINGS, 'the strings view can see event names at all')
      .toMatch(/addEventListener\(\s*['"]mousedown['"]/);
  });
});
