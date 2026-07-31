/**
 * AC-OVERLAYS-RETIRE-IN-HELM, the 320² slot half.
 *
 * The slot used to host TWO scenes that retired differently. As of 2026-07-30
 * it hosts ONE: the MINIMAP, which goes in HELM (the cockpit's NAV panel
 * replaces it) and stays in ORRERY, which has no cockpit to host anything.
 * The GRAVITY WELL is retired in BOTH modes — see the guard below for why that
 * reverses this morning's ruling and why "both" rather than "HELM only".
 *
 * ── THE DEFECT THIS PINS ───────────────────────────────────────────────────
 *
 * Five separate places used to push a scene into the slot, and one of them —
 * `spawnSystem` — runs on EVERY ARRIVAL. A regime gate written at the other
 * four would look correct, pass a live check, and then put the minimap straight
 * back on top of the cockpit at the next warp. The contract's own verify step
 * calls that out by name. So the shape of the fix is the thing worth guarding:
 * ONE decision point, and no `setHud` anywhere else.
 *
 * A source scan, because `src/main.js` builds a WebGL renderer at module scope
 * and is not importable here — same standing reason as `mainNavWiring.test.js`.
 * Comments are stripped before matching: a previous guard in this lane went red
 * on its own prose, and an earlier one went GREEN on a comment quoting the code
 * it was hunting.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const RAW = readFileSync(resolve(HERE, '../../main.js'), 'utf8');
/** Code only — block and line comments removed. */
const SRC = RAW.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

describe('the HUD slot has exactly one decision point', () => {
  it('CONTROL: the decision point and its two readers still exist', () => {
    // If these are renamed away, every assertion below is stale, not passing.
    expect(SRC, 'no _hudSlotScene — this scan is stale').toMatch(/function _hudSlotScene\(\)/);
    expect(SRC, 'no _applyHudSlot — this scan is stale').toMatch(/function _applyHudSlot\(\)/);
    expect(SRC, 'no _minimapLive — the click gates lost their predicate').toMatch(/function _minimapLive\(\)/);
  });

  it('every retroRenderer.setHud call lives in _applyHudSlot or _blankHudSlot', () => {
    // Two intents, two functions. `_applyHudSlot` DECIDES; `_blankHudSlot`
    // SUPPRESSES for the warp fold and the object gallery, where `system` is
    // still set and a re-decide would put the minimap back over a system that
    // is no longer on screen. Anything else is a third decision point.
    const decideStart = SRC.indexOf('function _applyHudSlot()');
    const decideEnd = SRC.indexOf('function _blankHudSlot()', decideStart);
    const blankStart = decideEnd;
    const blankEnd = SRC.indexOf('function _minimapLive()', blankStart);
    expect(decideStart).toBeGreaterThan(-1);
    expect(blankEnd).toBeGreaterThan(blankStart);

    const all = [...SRC.matchAll(/retroRenderer\.setHud\(/g)].map((m) => m.index);
    const outside = all.filter(
      (i) => !(i > decideStart && i < decideEnd) && !(i > blankStart && i < blankEnd),
    );
    expect(
      outside.length,
      `setHud called from ${outside.length} site(s) outside the two — a second `
      + 'decision point is how the minimap comes back after a warp',
    ).toBe(0);
    // 2026-07-30: was 4 — three deciding branches plus the blank. The gravity
    // well's branch went with the surface, so the decision point is now
    // minimap / nothing, plus the blank.
    expect(all.length, 'two deciding branches plus one blank').toBe(3);

    // …and the blank really is a blank, not a smuggled second decision.
    expect(SRC.slice(blankStart, blankEnd)).toMatch(/setHud\(null, null\)/);
    expect(SRC.slice(blankStart, blankEnd)).not.toMatch(/scene/);
  });

  // ⭐ REWRITTEN 2026-07-30, NOT FLIPPED. This guard used to assert the exact
  // opposite of what it asserts now — that the `'well'` line does NOT mention
  // `_scManual`, on the rationale that the gravity well had no cockpit
  // replacement so gating it off in HELM would delete it outright. That
  // reasoning held. Its PREMISE did not survive contact with the pilot: Max,
  // after flying it, *"We need to retire the gravity wells minimap; doesn't
  // make sense non-diagetically anymore. We can return to it later and
  // implement diagetically somehow."* He accepted the trade the old guard
  // existed to prevent.
  //
  // A guard whose premise has changed is STALE, NOT WRONG, and this lane's
  // convention is to rewrite the rationale rather than quietly invert an
  // assertion — otherwise the file records a conclusion with no argument, and
  // the next session cannot tell a ruling from a typo.
  it('the gravity well is GONE from the slot, and the minimap survives in ORRERY', () => {
    const scene = SRC.slice(SRC.indexOf('function _hudSlotScene()'), SRC.indexOf('function _applyHudSlot()'));
    // ⚠ `SRC` IS ALREADY COMMENT-STRIPPED at module scope, and here that is
    // load-bearing rather than tidy: `_hudSlotScene`'s doc block now quotes Max
    // saying "retire the gravity wells" and explains the `'well'` branch that
    // used to be there. Matched against RAW this guard would go red on its own
    // rationale — the exact failure this file's header records.
    expect(scene, 'no branch may put the gravity well in the slot, in EITHER mode').not.toMatch(/'well'/);
    // CONTROL: the decision point still decides something, or the assertion
    // above is satisfied by a function that was emptied out.
    const mapLine = scene.split('\n').find((l) => l.includes("'minimap'"));
    expect(mapLine, 'the minimap retires in HELM and is ORRERY\'s only slot scene').toMatch(/!_scManual/);
  });

  it('and the affordances went with it — no key, no toggle, no mobile button', () => {
    // A retired surface with live controls reads as a bug, not a decision. All
    // four callers of `toggleGravityWell` are gone and so is the function.
    expect(SRC, 'toggleGravityWell was deleted with the surface it toggled')
      .not.toMatch(/toggleGravityWell\s*\(/);
    const HTML = readFileSync(resolve(HERE, '../../../index.html'), 'utf8');
    expect(HTML.toLowerCase(), 'the V-key row, the settings checkbox and the mobile speed-dial button')
      .not.toMatch(/gravity/);
  });

  it('spawnSystem re-decides on arrival — the warp trap', () => {
    // The arrival path must go through the decision point, not set the slot
    // itself. Anchored on ORDER: the re-decide has to come after the SystemMap
    // is (re)built, or it decides against the previous system's map.
    const spawn = SRC.indexOf('systemMap = new SystemMap(');
    expect(spawn).toBeGreaterThan(-1);
    const after = SRC.slice(spawn, spawn + 700);
    expect(after, 'no _applyHudSlot() after the SystemMap is rebuilt').toMatch(/_applyHudSlot\(\);/);
  });

  it('a regime flip re-decides — the minimap must come BACK in ORRERY', () => {
    // Found live 2026-07-30: gating the minimap on `_scManual` made the regime
    // an INPUT to the decision, and nothing re-decided when the regime flipped.
    // So it vanished on entering HELM and never returned on leaving — the
    // retirement worked and the restoration silently did not. `setScManual` is
    // the file's own "THE universal regime-flip point" and already hooks the
    // mode-swap button and the orbit lines for exactly this reason.
    const start = SRC.indexOf('function setScManual(on)');
    expect(start, 'setScManual renamed — this scan is stale').toBeGreaterThan(-1);
    const body = SRC.slice(start, SRC.indexOf('\n}', start));
    expect(body, 'no re-decide on the regime flip').toMatch(/_applyHudSlot\(\)/);
  });

  it('the two retired DOM surfaces are driven from the same flip point', () => {
    // BodyInfo and FlightModeToast own their own suppression; main.js only says
    // which station we are at. Gated at the eleven `bodyInfo.show*` call sites
    // instead, one of them gets forgotten — which is the whole reason the
    // classes grew a `setSuppressed` rather than main.js growing eleven `if`s.
    const start = SRC.indexOf('function setScManual(on)');
    const body = SRC.slice(start, SRC.indexOf('\n}', start));
    expect(body).toMatch(/_syncRetiredOverlaysToMode\(\)/);

    const sync = SRC.indexOf('function _syncRetiredOverlaysToMode()');
    expect(sync, 'the sync fn is gone — this scan is stale').toBeGreaterThan(-1);
    const syncBody = SRC.slice(sync, SRC.indexOf('\n}', sync));
    expect(syncBody).toMatch(/bodyInfo\.setSuppressed\(_scManual\)/);
    expect(syncBody).toMatch(/flightModeToast\.setSuppressed\(_scManual\)/);

    // The third, added 2026-07-31, and the only NARROW one: #debug-hud keeps its
    // developer rows and loses exactly the three the INFO panel took over. It
    // rides the same flip point rather than growing its own, because the failure
    // this whole test guards against is a surface whose gate is written somewhere
    // main.js does not re-decide on.
    expect(syncBody).toMatch(/debugPanel\.setSurveySuppressed\(_scManual\)/);
  });

  it('CONTROL: the BURN button was ALREADY correct', () => {
    // On the retire list and needed no change on 2026-07-30. Pinned so a later
    // edit cannot quietly undo what was verified by reading.
    const burn = SRC.indexOf('function _updateCommitBurnButton()');
    const burnBody = SRC.slice(burn, burn + 1600);
    expect(burnBody, 'the DOM BURN affordance is back beside the cockpit COMMIT')
      .toMatch(/const burning = [^;]*_scManual/);
  });

  // ⭐ REWRITTEN 2026-07-30 (item 4), NOT FLIPPED — same treatment as the
  // gravity-well guard above. This used to pin `(!_isMobile || _scManual)`,
  // i.e. "shown on desktop always, on mobile only in HELM", with the rationale
  // that #mode-swap-btn must survive on mobile because it is mobile-HELM's only
  // tour exit and mobile is hard-locked out of hands-on flight, so there is no
  // keyboard fallback. ⭐ THAT HALF IS UNCHANGED AND STILL THE REASON THE
  // ELEMENT EXISTS. What changed is the desktop half. Max: *"Now that there's
  // this stark difference between helm and orrery modes we don't need the
  // constant label in the upper-right of the screen."*
  //
  // So the label retires on DESKTOP, where M swaps and the Options-menu item
  // still does, and survives on MOBILE-HELM, where it is the only way out.
  // Retiring the element outright — the reading of "we don't need the label"
  // that takes one more step than he asked for — strands mobile players in a
  // tour they cannot leave.
  it('the mode label is gone on desktop and SURVIVES on mobile-HELM', () => {
    const start = SRC.indexOf('function _updateModeSwapButton()');
    expect(start, '_updateModeSwapButton renamed — this scan is stale').toBeGreaterThan(-1);
    const body = SRC.slice(start, SRC.indexOf('\n}', start));
    expect(body, 'the desktop label must be gated OFF, not merely relabelled')
      .toMatch(/_isMobile && _scManual/);
    expect(body, 'the old always-on-desktop form is what Max asked to retire')
      .not.toMatch(/!_isMobile \|\| _scManual/);
    // CONTROL: the element and its label are still built for mobile-HELM. An
    // assertion that only says "the old expression is gone" passes against a
    // function whose body was deleted, which is the failure mode that strands
    // mobile players.
    expect(body, 'mobile-HELM still gets a labelled, displayable button')
      .toMatch(/btn\.textContent = _scManual \? 'HELM' : 'ORRERY'/);
    expect(body).toMatch(/btn\.style\.display = swappable \? 'block' : 'none'/);
  });

  it('the click and drag dead zones ask the same question the renderer asked', () => {
    // Otherwise HELM keeps a live 320² hole that eats clicks meant for the
    // world over a minimap that is not being drawn.
    const readers = [...SRC.matchAll(/_minimapLive\(\)/g)].length;
    expect(readers, 'expected the definition plus the click and drag gates').toBeGreaterThanOrEqual(3);
    expect(
      SRC,
      'a hand-rolled minimap-visibility test survives somewhere — it will drift from _hudSlotScene',
    ).not.toMatch(/systemMap && minimapVisible && !gravityWellVisible/);
  });
});
