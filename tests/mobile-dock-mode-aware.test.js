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
  });

  it('⭐ it is re-labelled on the UNIVERSAL regime flip, not at one call site', () => {
    // setScManual's own comment calls itself "THE universal regime-flip point". Hooking anywhere else
    // would leave some HELM<->ORRERY path showing the wrong button — which is how the minimap bug at
    // :13xx happened before (entered HELM, never came back).
    const fn = MAIN.match(/function setScManual\(on\)\s*\{[\s\S]*?\n\}/);
    expect(fn, 'setScManual found').toBeTruthy();
    expect(fn[0], 'the mode slot re-syncs on every regime flip').toMatch(/_syncModeDockButton\(/);
    // …and once at wiring time, because nothing has flipped yet at boot.
    expect(MAIN.match(/_syncModeDockButton\(\)/g)?.length ?? 0,
      'called at boot as well as on flip').toBeGreaterThanOrEqual(2);
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
