// tests/mobile-dock-mode-aware.test.js
// The dock carries what the CURRENT MODE does — and no action lives in two places.
//
// ⭐⭐ THE DEFECT THIS REPLACED. `autonav-toggle` sat at dock position 2 of 5, BETWEEN the ◀ ▶ pair it
// split, in the most thumb-reachable spot on the screen. Its entire ORRERY branch is one console.log —
// and ORRERY is what phones default to. So the best slot on the screen was a no-op for the default
// player, with no visible feedback that the tap even registered. The SAME action also sat in the speed
// dial: the only duplicated control in the set, spending 2 of 11 slots on one function that is
// meaningful in one mode.
//
// The invariant worth pinning is not "the button was moved" — it is the two properties that made the
// old arrangement wrong: (1) no dock slot is dead in the mode phones default to, and (2) no action
// appears in both the dock and the dial.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { stripCommentsPreservingOffsets } from './helpers/source-scan.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(resolve(REPO, rel), 'utf8');
const HTML = read('index.html');
// Strings intact: every action name here IS a string literal, invisible in a literal-blanked view.
const MAIN = stripCommentsPreservingOffsets(read('src/main.js'));

const actionsIn = (cls) => {
  const block = HTML.match(new RegExp(`<div class="${cls}">([\\s\\S]*?)</div>`));
  expect(block, `.${cls} block found`).toBeTruthy();
  return [...block[1].matchAll(/data-action="([a-z-]+)"/g)].map((m) => m[1]);
};

describe('mobile dock — mode-aware, and nothing duplicated', () => {
  it('the dock is five buttons and ◀ ▶ are ADJACENT', () => {
    const dock = actionsIn('mobile-dock');
    expect(dock.length, 'five dock slots').toBe(5);
    const i = dock.indexOf('prev'), j = dock.indexOf('next');
    expect(i, 'prev present').toBeGreaterThan(-1);
    expect(Math.abs(i - j), 'prev and next are neighbours — nothing splits the pair').toBe(1);
  });

  it('⭐ NO ACTION APPEARS IN BOTH THE DOCK AND THE DIAL', () => {
    // The old arrangement had autonav in both. This is the property that makes eleven slots hold
    // eleven things rather than ten things and a copy.
    const dock = actionsIn('mobile-dock');
    const dial = actionsIn('mobile-speed-dial');
    const both = dock.filter((a) => dial.includes(a));
    expect(both, 'no action is duplicated across dock and dial').toEqual([]);
  });

  it('the centre slot is the mode-aware one, and it is not hard-coded to a mode', () => {
    const dock = actionsIn('mobile-dock');
    expect(HTML, 'the mode slot carries an id the syncer can find').toMatch(/id="mobile-mode-slot"/);
    // ⛔ `autonav-toggle` must NOT be baked into the markup: it is what the syncer sets in HELM only.
    // If it reappears as a literal here, the ORRERY dead-button defect is back.
    expect(dock, 'autonav is not hard-coded into the dock markup').not.toContain('autonav-toggle');
  });

  it('⛔ the syncer sets ONLY actions the dock handler already knows', () => {
    // The button changes identity, not the dispatch path. A third value would silently become a dead
    // button again — the exact defect this replaced — because no handler branch would match it.
    const fn = MAIN.match(/function _syncModeDockButton\(\)\s*\{[\s\S]*?\n\}/);
    expect(fn, '_syncModeDockButton found').toBeTruthy();
    const assigned = [...fn[0].matchAll(/dataset\.action\s*=\s*[^;]*?'([a-z-]+)'\s*:\s*'([a-z-]+)'/g)];
    expect(assigned.length, 'the action is assigned from a two-way choice').toBe(1);
    const [, helmAction, orreryAction] = assigned[0];
    for (const a of [helmAction, orreryAction]) {
      expect(MAIN, `the dock handler has a branch for "${a}"`)
        .toMatch(new RegExp(`action === '${a}'`));
    }
    expect(orreryAction, 'ORRERY gets the orbit-line toggle').toBe('orbits');
    expect(helmAction, 'HELM gets the autopilot').toBe('autonav-toggle');
    // ⭐ AND THE CONDITION ITSELF IS PINNED, which it was not. Capturing the two action strings said
    // nothing about WHICH regime gets which. The realistic mutation is not flipping === to !== — it is
    // a future edit substituting the raw `_scManual` flag for `_effectiveRegime()`, and main.js's own
    // comment records that exact substitution having already "silently downgraded a HELM boot to an
    // ORRERY instant-cut" once. _scManual is DISHONEST during the boot window; _effectiveRegime is not.
    expect(fn[0], 'the regime is read through _effectiveRegime, never the raw _scManual flag')
      .toMatch(/_effectiveRegime\(\)\s*===\s*'helm'/);
    expect(fn[0], 'and not from the boot-window-dishonest flag directly').not.toMatch(/\b_scManual\b/);
  });

  it('⭐ it is re-labelled on the UNIVERSAL regime flip, not at one call site', () => {
    // setScManual's own comment calls itself "THE universal regime-flip point". Hooking anywhere else
    // would leave some HELM<->ORRERY path showing the wrong button — which is how the minimap bug at
    // :13xx happened before (entered HELM, never came back).
    const fn = MAIN.match(/function setScManual\(on\)\s*\{[\s\S]*?\n\}/);
    expect(fn, 'setScManual found').toBeTruthy();
    expect(fn[0], 'the mode slot re-syncs on every regime flip').toMatch(/_syncModeDockButton\(/);
    // ⛔ AND THE CALL COUNT IS MATCHED ON REAL CALL SITES ONLY. The first version of this clause
    // counted `/_syncModeDockButton\(\)/g`, which matches the FUNCTION'S OWN DECLARATION — so deleting
    // every call site still left a count of 1 and the clause could never fall below its threshold in
    // the way that mattered. Require the statement form.
    const calls = MAIN.match(/[^n]\s*_syncModeDockButton\(\);/g) || [];
    expect(calls.length, 'at least the regime-flip hook and the boot-pick hook').toBeGreaterThanOrEqual(2);
    // ⭐⭐ THE BOOT-PICK HOOK, and it is here because its absence was a REAL BUG found by review.
    // _pickBootMode records the chosen station and goes straight to the intro; the next re-label was
    // setScManual at the END of the whole ceremony. So a HELM pick showed "Orbit lines" on the most
    // reachable slot for the entire intro — and the dock sits ABOVE the splash and title in z-order, so
    // it is tappable throughout. The title screen spawns a system, so toggleOrbits' `if (!system)`
    // guard does not apply and one stray tap sets _orbitsUserOverride permanently, killing the
    // mode-driven orbit default for the whole session.
    const pick = MAIN.match(/function _pickBootMode\(mode\)\s*\{[\s\S]*?\n\}/);
    expect(pick, '_pickBootMode found').toBeTruthy();
    expect(pick[0], 'the slot is re-labelled the moment a station is picked')
      .toMatch(/_syncModeDockButton\(\)/);
  });

  it('the HUD toggle finally has a touch path', () => {
    expect(actionsIn('mobile-speed-dial'), 'hud is in the dial').toContain('hud');
    expect(MAIN, 'and the handler runs the same two lines the H key does')
      .toMatch(/action === 'hud'[\s\S]{0,400}_applyHudVisibility\(/);
  });

  it('CONTROL — the scans are live', () => {
    expect(HTML.length).toBeGreaterThan(5000);
    expect(MAIN.length).toBeGreaterThan(100000);
    // The dial parse must be finding real buttons, or every membership assertion above is vacuous.
    expect(actionsIn('mobile-speed-dial').length, 'the dial parse found buttons').toBeGreaterThan(3);
  });
});
