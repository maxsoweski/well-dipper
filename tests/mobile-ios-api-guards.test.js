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
// ⚠ A SECOND VIEW WITH STRING LITERALS INTACT, and it is needed for a reason that has now bitten three
// separate assertions in this session: `blankLiteralText: true` blanks the INTERIOR of every string, so
// an EVENT NAME — 'webglcontextlost', 'touchmove', a module path — is invisible in that view. The
// blanked view stays correct for everything structural (a brace or an identifier cannot hide inside a
// string); anything matching a literal must use this one. Same two-view split as
// tests/deep-link-boot-wiring.test.js and tests/mobile-navcomputer-touch.test.js.
const MAIN_STRINGS = stripCommentsPreservingOffsets(read('src/main.js'));

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

  it('⭐⭐ WebGL context loss is handled, and preventDefault is called — the one line that decides recoverability', () => {
    // The spec makes restoration CONDITIONAL on cancelling the event: a webglcontextlost handler that
    // does not call preventDefault means the browser will NEVER fire webglcontextrestored, and the
    // context is gone for the life of the page. So "there is a handler" is not the property worth
    // pinning — "the handler cancels the event" is. On a phone this is routine, not exotic: iOS
    // reclaims GPU memory from backgrounded tabs, so app-switching is the ordinary way to hit it.
    const lost = MAIN_STRINGS.match(/addEventListener\([\s\S]{0,40}webglcontextlost[\s\S]{0,900}/);
    expect(lost, 'a webglcontextlost listener exists').toBeTruthy();
    expect(lost[0], 'it calls preventDefault — without this there is no restore, ever')
      .toMatch(/preventDefault\s*\(/);
    expect(lost[0], 'and it stops the render loop rather than drawing into a dead context')
      .toMatch(/_animateController\.stop\(/);

    // ⚠ THE WINDOW IS WIDE ON PURPOSE, AND IT HAS NOW CAUGHT ME FOUR TIMES IN ONE SESSION.
    // stripCommentsPreservingOffsets PRESERVES OFFSETS: a stripped comment is not removed, it becomes
    // whitespace of the SAME LENGTH. These handlers are heavily commented — deliberately, because the
    // reasoning is the part worth keeping — so a window sized to the CODE lands inside blanked comment
    // and matches nothing, while reading exactly the right file at exactly the right place. Every scan
    // in this repo over an offset-preserving view needs a window sized to the comments, not the code.
    const restored = MAIN_STRINGS.match(/addEventListener\([\s\S]{0,40}webglcontextrestored[\s\S]{0,2400}/);
    expect(restored, 'a webglcontextrestored listener exists').toBeTruthy();
    // The render targets are ours and are dead after a loss; resize() disposes and rebuilds every one.
    expect(restored[0], 'render targets are rebuilt on restore').toMatch(/retroRenderer\.resize\(/);
    expect(restored[0], 'the loop is restarted').toMatch(/_animateController\.start\(/);
    // ⚠ And the failure path is honest: nobody here can prove a silent auto-restore works on every
    // device, so a throw must leave a reload the player can actually use, not a resumed loop that
    // renders nothing while logging success.
    expect(restored[0], 'a failed rebuild is caught rather than assumed away').toMatch(/catch/);
  });

  it('the context-loss overlay exists in the document it is supposed to cover', () => {
    const html = read('index.html');
    expect(html, 'overlay element present').toMatch(/id="gl-lost-overlay"/);
    expect(html, 'it carries a message slot the handler writes').toMatch(/data-gl-lost-msg/);
    expect(html, 'and a reload the player can tap when recovery fails').toMatch(/data-gl-lost-reload/);
    const css = read('src/style.css');
    expect(css, 'hidden by default in CSS, shown by the handler').toMatch(/#gl-lost-overlay\s*\{[^}]*display:\s*none/);
  });

  it('CONTROL — the scan is live and reading code, not blanked comment', () => {
    // Every assertion above is a NEGATIVE match, and a negative match over an empty string passes.
    // Without this, a broken path or an empty strip would report a clean bill of health.
    expect(MAIN.length).toBeGreaterThan(100000);
    expect(MAIN, 'the scan can see fullscreen code at all').toMatch(/toggleFullscreen/);
    expect(MAIN, 'and can see the guarded helper in use').toMatch(/isFullscreen\(document\)/);
    // The strings-intact view is the only one that can see an event name, so its liveness is its own
    // question — a blank MAIN_STRINGS would make every listener assertion above fail for the wrong reason.
    expect(MAIN_STRINGS.length).toBeGreaterThan(100000);
    expect(MAIN_STRINGS, 'the strings view can see event names at all')
      .toMatch(/addEventListener\(\s*['"]resize['"]/);
  });
});
