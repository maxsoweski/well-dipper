// tests/mobile-ios-api-guards.test.js
// No un-guarded Fullscreen API call may return to src/main.js.
//
// THE DEFECT THIS FENCES. Three call sites were written as
//     document.documentElement.requestFullscreen().catch(() => {});
// On iPhone Safari there is no element-level Fullscreen API, so `requestFullscreen` is undefined and
// that line throws a TypeError SYNCHRONOUSLY, while evaluating the call — before a promise exists and
// therefore before its own `.catch` can run. It reads as handled and is not. One of the three sat behind
// a button the stylesheet shows ONLY on touch devices, and which blinks.
//
// ⭐ THE POINT OF A SOURCE SCAN HERE: the correct guarded shape ALREADY EXISTED in main.js (toggleFullscreen)
// while three siblings used the bare one. The problem was never that nobody knew the right form — it was
// that both forms lived in the same file and a new call site could copy either. So the fence is not "is
// there a guard somewhere", it is "is the bare form absent everywhere".
//
// ⛔ SCANNED WITH COMMENTS STRIPPED. This file's subject is described in prose at each call site, and a
// raw grep would be satisfied by the documentation of the thing it is checking.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { stripCommentsPreservingOffsets } from './helpers/source-scan.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(resolve(REPO, rel), 'utf8');
const MAIN = stripCommentsPreservingOffsets(read('src/main.js'), { blankLiteralText: true });

describe('iOS API guards — main.js never calls the Fullscreen API bare', () => {
  it('⛔ no un-guarded requestFullscreen / exitFullscreen call remains', () => {
    // The bare form: a direct call on a member expression, with no capability check in front of it.
    expect(MAIN, 'no bare documentElement.requestFullscreen()')
      .not.toMatch(/documentElement\.requestFullscreen\s*\(/);
    expect(MAIN, 'no bare document.exitFullscreen()')
      .not.toMatch(/\bdocument\.exitFullscreen\s*\(/);
  });

  it('every fullscreen-state READ goes through the both-spellings helper', () => {
    // The settings checkbox read only document.fullscreenElement, so a browser exposing only the
    // prefixed property reported "not fullscreen" while fullscreen — and the next toggle tried to ENTER
    // again rather than exit. There must be no remaining unprefixed-only read.
    expect(MAIN, 'no bare document.fullscreenElement read')
      .not.toMatch(/(?<!webkit)\bdocument\.fullscreenElement\b/);
  });

  it('main.js imports the guarded helpers from the single source', () => {
    const strings = stripCommentsPreservingOffsets(read('src/main.js'));
    const imp = strings.match(/import\s*\{[^}]*\}\s*from\s*['"][^'"]*util\/fullscreen\.js['"]/s);
    expect(imp, 'an import from util/fullscreen.js exists').toBeTruthy();
    for (const sym of ['fullscreenAvailable', 'isFullscreen']) {
      expect(imp[0], `${sym} imported`).toMatch(new RegExp(`\\b${sym}\\b`));
    }
  });

  it('⭐ the controls that cannot work HIDE themselves rather than offering a dead tap', () => {
    // A blinking mobile-only button that throws is worse than an absent one: it teaches the player the
    // game is broken on the first screen. All three fullscreen affordances self-hide when the capability
    // is absent — the title button, the speed-dial button, and the settings row.
    const hides = MAIN.match(/fullscreenAvailable\(document\)/g) || [];
    expect(hides.length, 'capability is checked at every affordance (title, dial, settings row)')
      .toBeGreaterThanOrEqual(3);
  });

  it('CONTROL — the scan is live and reading code, not blanked comment', () => {
    // Every assertion above is a NEGATIVE match, and a negative match over an empty string passes.
    // Without this, a broken path or an empty strip would report a clean bill of health.
    expect(MAIN.length).toBeGreaterThan(100000);
    expect(MAIN, 'the scan can see fullscreen code at all').toMatch(/toggleFullscreen/);
    expect(MAIN, 'and can see the guarded helper in use').toMatch(/isFullscreen\(document\)/);
  });
});
