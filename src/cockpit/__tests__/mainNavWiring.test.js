/**
 * The GAME's nav-computer wiring — callbacks, appliers, autopilot, screensaver.
 *
 * Increment 7, `cockpit-into-helm-2026-07-30`, step 7. Supports
 * AC-AUTOPILOT-BUTTON-TOGGLES, AC-COMMIT-FIRES-THE-WARP,
 * AC-AUTOPILOT-ALWAYS-HAS-A-COCKPIT and AC-SCREENSAVER-LOOP-STAYS-CLOSED.
 *
 * ── WHY A SOURCE SCAN, AGAIN ────────────────────────────────────────────────
 *
 * Same reason as `mainPointerRouting.test.js`: `src/main.js` builds a WebGL
 * renderer, a GLTF loader, an audio engine and a galaxy at module scope, and is
 * not imported anywhere in this suite.
 *
 * But this file guards a sharper class of defect. Every one of the four things
 * below was found by the design review as a wiring that LOOKS right and does
 * nothing, or does something destructive, with no error and no failing test:
 *
 *   1. COMMIT mirrored from the overlay stores an action and never reads it,
 *      because the close it delegates to returns at its first line when there
 *      is no overlay open.
 *   2. `openToCurrentSystem` had exactly one caller, `openNavComputer`, which
 *      the cockpit's instance never goes through — so `_systemData` stays null
 *      on the glass forever and every warp leaves it describing the last system.
 *   3. `setPlayerPosition` is destructive, so wiring it to the focus sites wipes
 *      a PRISM selection on every Tab.
 *   4. Nothing closes the DOM overlay when the regime flips, so ORRERY's
 *      autopilot button leaves a full-screen overlay on top of the cockpit.
 *
 * None of these throws. All four are silent. A scan that pins the SHAPE of the
 * fix is the only cheap thing standing between them and a future good-faith
 * session that "simplifies" one back.
 *
 * ⚠ This proves the wiring is present and shaped right. Whether the warp fires
 * is live, and is the ACs' own observable.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const SRC = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../main.js'), 'utf8');

function at(needle, from = 0) {
  const i = SRC.indexOf(needle, from);
  expect(i, `src/main.js no longer contains \`${needle}\` — this scan is stale, not passing`).toBeGreaterThan(-1);
  return i;
}
/** The body of a top-level `function name(...)`, by brace balance. */
function fnBody(name) {
  const start = at(`function ${name}(`);
  let depth = 0; let seen = false;
  for (let i = start; i < SRC.length; i++) {
    if (SRC[i] === '{') { depth++; seen = true; }
    else if (SRC[i] === '}') { depth--; if (seen && depth === 0) return SRC.slice(start, i + 1); }
  }
  throw new Error(`unbalanced braces reading ${name}`);
}

describe('both nav computers get the same four callbacks', () => {
  it('CONTROL: fnBody actually extracts a body, and at() can fail', () => {
    expect(fnBody('_applyNavFocus')).toContain('setCurrentBody');
    expect(() => at('_notAnIdentifierInMainJs')).toThrow();
  });

  it('one installer, and BOTH instances go through it', () => {
    // Two installers is how increment 6 shipped a cockpit NAV whose autopilot
    // button reported true on every press: not a defect in the panel, an
    // instance the game had never wired.
    expect(fnBody('_initNavComputer')).toContain('_installNavCallbacks(_domNavComputer);');
    const factory = SRC.slice(at('makeNav: (surface) => {'));
    expect(factory.slice(0, factory.indexOf('  },'))).toContain('_installNavCallbacks(nav);');
  });

  it('COMMIT dispatches EXPLICITLY off the glass, not through a close that never happens', () => {
    const install = fnBody('_installNavCallbacks');
    // The overlay path may delegate — it really does close. The glass path must
    // read-null-dispatch itself, or COMMIT lights up, sounds, retracts, and does
    // nothing at all.
    expect(install).toContain('_dispatchPendingNavAction(nav);');
    const glass = install.slice(install.indexOf('setCommitCallback'));
    expect(glass.indexOf('_dispatchPendingNavAction(nav);')).toBeGreaterThan(-1);
    // ...and it is gated so the overlay branch cannot swallow it.
    expect(install).toContain('if (nav === _domNavComputer && _navComputerOpen)');
    // The sound has its own home now — it used to arrive via closeNavComputer.
    expect(glass).toContain("soundEngine.play('navClose')");
  });

  it('the dispatch helper reads, nulls, THEN dispatches', () => {
    const fn = fnBody('_dispatchPendingNavAction');
    const read = fn.indexOf('nav._pendingAction || null');
    const nulled = fn.indexOf('nav._pendingAction = null');
    const sent = fn.indexOf('dispatchNavAction(action)');
    expect(read).toBeGreaterThan(-1);
    expect(nulled).toBeGreaterThan(read);
    expect(sent).toBeGreaterThan(nulled);
  });

  it('the autopilot toggle arms WITH a cockpit rather than bare', () => {
    expect(fnBody('_installNavCallbacks')).toContain('_armAutopilotWithCockpit();');
  });

  it('and turning it OFF from the glass keeps the cockpit', () => {
    // `stopFlythrough()` ends with `setScManual(false)` — it drops to ORRERY.
    // From a button ON the cockpit's own panel that ejects the pilot from the
    // ship and takes the panel they just pressed off screen, so the label
    // AC-AUTOPILOT-BUTTON-TOGGLES asks to see "return" has nowhere to return to.
    expect(fnBody('_installNavCallbacks')).toContain('else if (nav === _cockpitNavComputer) _disarmAutopilotKeepingCockpit();');
    const off = fnBody('_disarmAutopilotKeepingCockpit');
    expect(off).toContain('stopFlythrough();');
    // Re-entered through the game's own canonical hands-on door, not by hand.
    expect(off).toContain('if (wasHelm && !_scManual) _enterFlightInternal();');
  });
});

describe('the two appliers stay split', () => {
  it('ARRIVAL owns the destructive calls', () => {
    const arrival = fnBody('_applyNavArrival');
    expect(arrival).toContain('setPlayerPosition');
    expect(arrival).toContain('openToCurrentSystem');
    expect(arrival).toContain('_currentSystemName');
  });

  it('FOCUS owns setCurrentBody and NOTHING destructive', () => {
    const focus = fnBody('_applyNavFocus');
    expect(focus).toContain('setCurrentBody');
    // The whole point of the split. setPlayerPosition empties _localStars, runs
    // _resetPrismLoad() and nulls _selectedNavStar — on every Tab, on an
    // always-live instance, that is the pilot's selection gone mid-drill, and
    // inside AutopilotNavSequence's retry it dead-ends the screensaver silently.
    expect(focus).not.toContain('setPlayerPosition');
    expect(focus).not.toContain('openToCurrentSystem');
    expect(focus).not.toContain('setExternalTarget');
  });

  it('the focus SITE calls the focus applier, for both instances', () => {
    const sync = fnBody('_syncNavBody');
    expect(sync).toContain('_applyNavFocus(_domNavComputer)');
    // Unguarded by _navComputerOpen: the glass is always live, zoomed or not.
    expect(sync).toContain('if (_cockpitNavComputer) _applyNavFocus(_cockpitNavComputer);');
    expect(sync).not.toContain('_applyNavArrival');
  });

  it('ARRIVAL is called at system arrival, over the registry', () => {
    // The fix for `_systemData` being null on the glass forever.
    // ⚠ NOT via fnBody: spawnSystem is 620 lines of template literals whose
    // braces defeat a brace counter. Range-slice between two stable anchors.
    const start = at('function spawnSystem({');
    const spawn = SRC.slice(start, at(' * Spawn a deep sky destination', start));
    expect(spawn).toContain('for (const nav of _navComputers()) _applyNavArrival(nav);');
    // ⭐ AND ABOVE `if (forWarp) return;` — THIS IS THE ASSERTION THAT MATTERS.
    // A tail placement passed every structural check and fired zero times on
    // the only path that changes system: a warp arrival returns early there, so
    // the glass kept `_playerX === 8, _currentSystemName === ''` through a full
    // boot and warp. Measured, not reasoned about. Ordering, not presence.
    // Matched as a STATEMENT, not as text: the comment above the applier quotes
    // the early return verbatim, and an indexOf found the quote instead of the
    // code — a locator that answered the wrong question, one layer up from the
    // bug it was written for.
    const guard = spawn.search(/^\s*if \(forWarp\) return;/m);
    expect(guard).toBeGreaterThan(-1);
    expect(spawn.indexOf('for (const nav of _navComputers()) _applyNavArrival(nav);')).toBeLessThan(guard);
  });

  it('OPENING the glass is not ARRIVING — the destructive applier stays out', () => {
    const open = fnBody('_openCockpitNav');
    // The CALL, not the word — the body names it in a comment saying why not.
    expect(open).not.toMatch(/_applyNavArrival\(/);
    expect(open).not.toMatch(/setPlayerPosition\(/);
    expect(open).toContain('setAutopilotState');
    expect(open).toContain("mover.zoom('NAV'");
  });
});

describe('the nav door redirects to whichever surface is live', () => {
  it('openNavComputer prefers the glass, before it touches the overlay element', () => {
    const open = fnBody('openNavComputer');
    const redirect = open.indexOf('_openCockpitNav(); return;');
    expect(redirect).toBeGreaterThan(-1);
    expect(redirect).toBeLessThan(open.indexOf("getElementById('nav-computer-overlay')"));
    expect(open).toContain('_cockpitShouldRender()');
  });

  it('the overlay path still uses the destructive applier — that IS its home', () => {
    expect(fnBody('openNavComputer')).toContain('_applyNavArrival(_domNavComputer);');
  });

  it('closeNavComputer retracts the glass when no overlay is up', () => {
    const close = fnBody('closeNavComputer');
    expect(close).toContain('if (_cockpitNavZoomed()) {');
    expect(close).toContain('_cockpitRig.mover.dismiss();');
    expect(close).toContain('_dispatchPendingNavAction(_cockpitNavComputer);');
    // The overlay branch comes first and returns — it is what the pilot sees.
    expect(close.indexOf('if (_navComputerOpen)')).toBeLessThan(close.indexOf('if (_cockpitNavZoomed())'));
  });

  it('the toggle treats a zoomed panel as open', () => {
    expect(fnBody('toggleNavComputer')).toContain('if (_navComputerOpen || _cockpitNavZoomed())');
  });
});

describe('autopilot always has a cockpit, and the screensaver stays closed', () => {
  it('the HELM-entry applier closes the DOM overlay on the regime flip', () => {
    // Nothing else does. ORRERY's autopilot button would otherwise leave a
    // full-screen overlay on top of the cockpit, with its own render loop still
    // driving the OTHER instance.
    const arm = fnBody('_armAutopilotWithCockpit');
    expect(arm).toContain('if (_navComputerOpen) closeNavComputer();');
    expect(arm).toContain('setScManual(true);');
    expect(arm).toContain('_beginHandsOffTour();');
    // Guarded, so pressing autopilot in HELM does not re-seed the pose.
    expect(arm).toContain('if (!_scManual) {');
  });

  it('all four paths to startFlythrough go through it', () => {
    // Enumerated, not assumed from each other — Max asked for all four.
    const bare = [...SRC.matchAll(/^\s*startFlythrough\(\);\s*$/gm)];
    const armed = [...SRC.matchAll(/_armAutopilotWithCockpit\(\)/g)];
    expect(armed.length, 'four call sites plus the definition and one in the installer').toBeGreaterThanOrEqual(5);
    // The three that remain are already in HELM by construction and are NOT
    // regime-flip paths: the `beginAutopilotTour` scenario helper (test-only),
    // the boot/idle re-arm inside its own `_scManual &&` guard, and
    // `_beginHandsOffTour` itself, which is what `_armAutopilotWithCockpit`
    // calls. A FOURTH bare call is a new unrouted path and this goes red.
    expect(bare.length, `bare startFlythrough() sites changed — a new one is an unrouted path:\n${bare.map((m) => m[0].trim()).join('\n')}`).toBe(3);
  });

  it('the screensaver sequence is handed the LIVE instance, twice', () => {
    // Once at construction and once per tour completion — the regime can flip
    // between the two, and a sequence performing on the overlay's instance in
    // HELM is a 671-line performance nobody can see.
    expect(SRC).toContain('navComputer: liveNavComputer(),');
    expect(SRC).toContain('_autopilotNavSequence._nav = liveNavComputer();');
    expect(SRC).toContain('if (!liveNavComputer()) _initNavComputer();');
  });

  it('the on-glass autopilot mirror is re-synced every frame', () => {
    // `_autopilotActive` is written only by setAutopilotState. The overlay could
    // push it at open; the glass is always visible and has no open.
    const loop = SRC.slice(at('if (_cockpitShouldRender()) {'), at('retroRenderer.setCockpit(_cockpitRig.scene'));
    expect(loop).toContain('_cockpitNavComputer.setAutopilotState(autoNav.isActive || _autopilotEnabled)');
  });
});
