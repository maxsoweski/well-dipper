// Pure reducers for the orrery-coherence workstream (docs/WORKSTREAMS/
// orrery-coherence-2026-07-15/intent.md + contract.json, AC1). The ratified
// holistic read (2026-07-15): "ORRERY is a god's-eye, player-driven
// contemplation of the system — nothing flies in ORRERY; things only view."
// Max, 2026-07-02: "I do not want/need autopilot for orrery. And I don't want
// these modes to mix." Max, 2026-07-01: "ORRERY is a player-driven feature."
//
// AC1 is a pure reducer LAYER answering, for ORRERY, that no input or timer may
// produce ship flight — while every HELM resolution byte-matches today's routing
// (documented per-seam in SEAM-MAP-2026-07-15.md). These tests pin the DECISIONS
// as hand-built expectation tables, independent of the implementation formula, so
// a routing regression fails loudly. They mirror modeOwnership.test.js's idiom:
// exhaustive orrery-vs-helm cells + garbage-input safe defaults.
import { describe, it, expect } from 'vitest';
import {
  bodyCycleAction,
  burnWorkflowAvailable,
  burnButtonRegimeVisible,
  navAutopilotToggleAction,
  autoWarpTimerFires,
  systemEntryStyle,
  tourRearmAllowed,
  bodyClickAction,
  navDispatchDuringWarp,
} from '../flightModes.js';

// -------------------------------------------------------------------------
// a. Body-cycle action (Tab / number keys; seam map §4).
//    ORRERY: view-only select (never flies). HELM+tour: today's tour-advance.
//    HELM no-tour: today's focus-fly. Garbage regime: safe view-only default.
// -------------------------------------------------------------------------
describe('bodyCycleAction — Tab/number keys cycle a VIEW in ORRERY, fly only in HELM', () => {
  it('ORRERY: view-only select, regardless of tourActive (nothing flies in ORRERY)', () => {
    expect(bodyCycleAction({ regime: 'orrery', tourActive: false })).toEqual({ action: 'view-select' });
    expect(bodyCycleAction({ regime: 'orrery', tourActive: true })).toEqual({ action: 'view-select' });
    // truthy/falsy garbage for tourActive must not change the ORRERY answer
    expect(bodyCycleAction({ regime: 'orrery', tourActive: undefined })).toEqual({ action: 'view-select' });
    expect(bodyCycleAction({ regime: 'orrery', tourActive: 1 })).toEqual({ action: 'view-select' });
  });

  it('HELM + tour active: today\'s autopilot branch (autoNav.advance) → tour-advance', () => {
    expect(bodyCycleAction({ regime: 'helm', tourActive: true })).toEqual({ action: 'tour-advance' });
    expect(bodyCycleAction({ regime: 'helm', tourActive: 1 })).toEqual({ action: 'tour-advance' });
  });

  it('HELM + no tour: today\'s normal branch (focusPlanet fly) → focus-fly', () => {
    expect(bodyCycleAction({ regime: 'helm', tourActive: false })).toEqual({ action: 'focus-fly' });
    expect(bodyCycleAction({ regime: 'helm', tourActive: undefined })).toEqual({ action: 'focus-fly' });
  });

  it('garbage/missing regime: safe view-only default (never a flight action)', () => {
    for (const bad of [undefined, null, '', 'nonsense', 'HELM', 'Orrery']) {
      expect(bodyCycleAction({ regime: bad, tourActive: true })).toEqual({ action: 'view-select' });
      expect(bodyCycleAction({ regime: bad, tourActive: false })).toEqual({ action: 'view-select' });
    }
    expect(bodyCycleAction()).toEqual({ action: 'view-select' });
    expect(bodyCycleAction({})).toEqual({ action: 'view-select' });
  });
});

// -------------------------------------------------------------------------
// b. Burn commit-ACTION availability (seam map §5). The ACTION gate ONLY — "may
//    a commit-burn ACTION proceed?" — shared by the Space-commit and nav-computer
//    burn call sites (NOT the button; that is b2). HELM: available (runs the
//    ASSIST burn, as today). ORRERY: unavailable → the commit paths are inert, so
//    commitBurnSwapsToHelm's ORRERY-swap cell is never reached. This gate's HELM
//    answer (true) intentionally DIFFERS from the burn BUTTON's HELM answer
//    (hidden) — see b2 — so the two are pinned as separate reducers.
// -------------------------------------------------------------------------
describe('burnWorkflowAvailable — the burn commit-ACTION is available only in HELM', () => {
  it('HELM: available — commits the player-directed ASSIST burn, exactly as today', () => {
    expect(burnWorkflowAvailable({ regime: 'helm' })).toBe(true);
  });
  it('ORRERY: unavailable — commit paths inert, no silent swap to HELM', () => {
    expect(burnWorkflowAvailable({ regime: 'orrery' })).toBe(false);
  });
  it('garbage/missing regime: unavailable (safe default — no ship machinery leaks)', () => {
    for (const bad of [undefined, null, '', 'nonsense', 'HELM', 'Orrery']) {
      expect(burnWorkflowAvailable({ regime: bad })).toBe(false);
    }
    expect(burnWorkflowAvailable()).toBe(false);
    expect(burnWorkflowAvailable({})).toBe(false);
  });
});

// -------------------------------------------------------------------------
// b2. Burn BUTTON regime visibility (seam map §5, split out of
//    burnWorkflowAvailable per review round 1). Today `_updateCommitBurnButton`
//    (main.js:6736) folds `_scManual` into `burning`, so the BURN button is
//    ALREADY hidden in HELM and only ever rendered in ORRERY. AC4 removes the
//    ORRERY affordance too — so after AC4 NO regime renders the button. This
//    reducer pins that verdict (false = hidden by regime) so Increment-2 can
//    replace the bare `_scManual` suppressor with `!burnButtonRegimeVisible`
//    WITHOUT ever making HELM render a BURN button it never showed. The HELM
//    cell here (hidden) is the guard that catches the exact regression the review
//    flagged: wiring the button to burnWorkflowAvailable (true in HELM) instead.
// -------------------------------------------------------------------------
describe('burnButtonRegimeVisible — the BURN button renders in NO regime after AC4', () => {
  it('HELM: hidden — pins today\'s behavior (main.js:6736 suppresses it under _scManual)', () => {
    // AC4: "HELM still shows BURN exactly as today" = hidden. Wiring the button
    // to burnWorkflowAvailable (true in HELM) would REGRESS this to shown.
    expect(burnButtonRegimeVisible({ regime: 'helm' })).toBe(false);
  });
  it('ORRERY: hidden — AC4 "the button never renders for a selected body"', () => {
    expect(burnButtonRegimeVisible({ regime: 'orrery' })).toBe(false);
  });
  it('garbage/missing regime: hidden (safe default — no burn button leaks)', () => {
    for (const bad of [undefined, null, '', 'nonsense', 'HELM', 'Orrery']) {
      expect(burnButtonRegimeVisible({ regime: bad })).toBe(false);
    }
    expect(burnButtonRegimeVisible()).toBe(false);
    expect(burnButtonRegimeVisible({})).toBe(false);
  });
});

// -------------------------------------------------------------------------
// c. NavComputer AUTOPILOT toggle action (seam map §6). Inputs: regime, enable.
//    ORRERY: inert both directions (never arms/stops a tour there). HELM:
//    start (enable) / stop (disable), as today.
// -------------------------------------------------------------------------
describe('navAutopilotToggleAction — AUTOPILOT button arms a tour only in HELM', () => {
  it('ORRERY: inert, both enable=true and enable=false (no autopilot for orrery)', () => {
    expect(navAutopilotToggleAction({ regime: 'orrery', enable: true })).toEqual({ action: 'inert' });
    expect(navAutopilotToggleAction({ regime: 'orrery', enable: false })).toEqual({ action: 'inert' });
  });
  it('HELM: enable → start (startFlythrough), disable → stop (stopFlythrough)', () => {
    expect(navAutopilotToggleAction({ regime: 'helm', enable: true })).toEqual({ action: 'start' });
    expect(navAutopilotToggleAction({ regime: 'helm', enable: false })).toEqual({ action: 'stop' });
  });
  it('garbage/missing regime: inert (safe default — never arms a tour)', () => {
    for (const bad of [undefined, null, '', 'nonsense', 'HELM', 'Orrery']) {
      expect(navAutopilotToggleAction({ regime: bad, enable: true })).toEqual({ action: 'inert' });
      expect(navAutopilotToggleAction({ regime: bad, enable: false })).toEqual({ action: 'inert' });
    }
    expect(navAutopilotToggleAction()).toEqual({ action: 'inert' });
    expect(navAutopilotToggleAction({})).toEqual({ action: 'inert' });
  });
});

// -------------------------------------------------------------------------
// d. Auto-warp timer gate (seam map §3). The title-end (~3:16), nebula-linger
//    (15s) warp-away, and mobile double-tap warp sites all consult this.
//    ORRERY: no timer may fire a warp (idles indefinitely). HELM: fires.
// -------------------------------------------------------------------------
describe('autoWarpTimerFires — auto-warp timers fire only in HELM', () => {
  it('HELM: fires (title-end / nebula-linger / mobile double-tap warp as today)', () => {
    expect(autoWarpTimerFires({ regime: 'helm' })).toBe(true);
  });
  it('ORRERY: never fires — ORRERY idles indefinitely', () => {
    expect(autoWarpTimerFires({ regime: 'orrery' })).toBe(false);
  });
  it('garbage/missing regime: no warp (safe default)', () => {
    for (const bad of [undefined, null, '', 'nonsense', 'HELM', 'Orrery']) {
      expect(autoWarpTimerFires({ regime: bad })).toBe(false);
    }
    expect(autoWarpTimerFires()).toBe(false);
    expect(autoWarpTimerFires({})).toBe(false);
  });
});

// -------------------------------------------------------------------------
// e. System-entry resolution (AC2 substrate, seam map §2). Consumed by
//    Increment 2. HELM: 'warp-cinematic' (today's portal + warpEffect + shake +
//    fly-in). ORRERY: 'instant-cut' (instant-spawn + viewSystem framing, no
//    warpEffect, no shake, no fly-in, pilot stays idle).
// -------------------------------------------------------------------------
describe('systemEntryStyle — HELM enters cinematic, ORRERY enters as an instant framed cut', () => {
  it('HELM: warp-cinematic (warpEffect + shake + fly-in; pilot NOT idle)', () => {
    expect(systemEntryStyle({ regime: 'helm' })).toEqual({
      style: 'warp-cinematic',
      warpEffect: true,
      cameraShake: true,
      flyIn: true,
      pilotIdle: false,
    });
  });
  it('ORRERY: instant-cut (no warpEffect, no shake, no fly-in; pilot stays idle)', () => {
    expect(systemEntryStyle({ regime: 'orrery' })).toEqual({
      style: 'instant-cut',
      warpEffect: false,
      cameraShake: false,
      flyIn: false,
      pilotIdle: true,
    });
  });
  it('garbage/missing regime: instant-cut (safe default — no cinematic, no fly-in)', () => {
    for (const bad of [undefined, null, '', 'nonsense', 'HELM', 'Orrery']) {
      expect(systemEntryStyle({ regime: bad })).toEqual({
        style: 'instant-cut',
        warpEffect: false,
        cameraShake: false,
        flyIn: false,
        pilotIdle: true,
      });
    }
    expect(systemEntryStyle()).toMatchObject({ style: 'instant-cut', flyIn: false });
    expect(systemEntryStyle({})).toMatchObject({ style: 'instant-cut', flyIn: false });
  });
});

// -------------------------------------------------------------------------
// f. Tour-complete re-arm gate (AC7 pure half, seam map §8). The onTourComplete
//    re-arm loop (warp onward + new tour) IS the screensaver — but only while
//    hands-off in HELM. Fires IFF regime === 'helm' AND handsOn === false.
//    ORRERY never; HELM hands-on never; garbage/missing anything → no re-arm.
// -------------------------------------------------------------------------
describe('tourRearmAllowed — the screensaver re-arm loop runs only hands-off in HELM', () => {
  it('HELM hands-off: re-arm fires (this IS the screensaver)', () => {
    expect(tourRearmAllowed({ regime: 'helm', handsOn: false })).toBe(true);
  });
  it('HELM hands-on: never re-arms (player took the stick)', () => {
    expect(tourRearmAllowed({ regime: 'helm', handsOn: true })).toBe(false);
  });
  it('ORRERY: never re-arms, whatever the hand-state', () => {
    expect(tourRearmAllowed({ regime: 'orrery', handsOn: false })).toBe(false);
    expect(tourRearmAllowed({ regime: 'orrery', handsOn: true })).toBe(false);
  });
  it('garbage/missing regime or hand-state: no re-arm (strict — only explicit HELM+false fires)', () => {
    for (const bad of [undefined, null, '', 'nonsense', 'HELM', 'Orrery']) {
      expect(tourRearmAllowed({ regime: bad, handsOn: false })).toBe(false);
    }
    // missing/garbage handsOn under HELM must NOT be read as hands-off
    for (const bad of [undefined, null, 0, '', 'no']) {
      expect(tourRearmAllowed({ regime: 'helm', handsOn: bad })).toBe(false);
    }
    expect(tourRearmAllowed()).toBe(false);
    expect(tourRearmAllowed({})).toBe(false);
  });
});

// -------------------------------------------------------------------------
// Cross-reducer invariant: the whole point of the layer. For regime 'orrery',
// NO reducer — under ANY other input — may resolve to a ship-flight routing.
// This is the single assertion that would catch a future reducer (or a tweak to
// one of these) quietly re-opening a flight path in ORRERY. "Nothing flies in
// ORRERY; things only view." (intent.md, ratified 2026-07-15.)
// -------------------------------------------------------------------------
describe('INVARIANT: no reducer ever yields a ship-flight routing for regime "orrery"', () => {
  const FLIGHT_TOKENS = new Set(['tour-advance', 'focus-fly', 'start', 'warp-cinematic']);

  it('bodyCycleAction never returns a flight action in ORRERY', () => {
    for (const tourActive of [true, false, undefined, 1, 0, null]) {
      const { action } = bodyCycleAction({ regime: 'orrery', tourActive });
      expect(FLIGHT_TOKENS.has(action)).toBe(false);
    }
  });

  it('navAutopilotToggleAction never arms a tour (start) in ORRERY', () => {
    for (const enable of [true, false, undefined, null, 1, 0]) {
      const { action } = navAutopilotToggleAction({ regime: 'orrery', enable });
      expect(FLIGHT_TOKENS.has(action)).toBe(false);
    }
  });

  it('systemEntryStyle never chooses the cinematic (with fly-in) in ORRERY', () => {
    const s = systemEntryStyle({ regime: 'orrery' });
    expect(FLIGHT_TOKENS.has(s.style)).toBe(false);
    expect(s.warpEffect).toBe(false);
    expect(s.flyIn).toBe(false);
    expect(s.cameraShake).toBe(false);
    expect(s.pilotIdle).toBe(true);
  });

  it('the boolean gates are all "off" in ORRERY (no burn action, no burn button, no auto-warp, no re-arm)', () => {
    expect(burnWorkflowAvailable({ regime: 'orrery' })).toBe(false);
    expect(burnButtonRegimeVisible({ regime: 'orrery' })).toBe(false);
    expect(autoWarpTimerFires({ regime: 'orrery' })).toBe(false);
    expect(tourRearmAllowed({ regime: 'orrery', handsOn: false })).toBe(false);
    expect(tourRearmAllowed({ regime: 'orrery', handsOn: true })).toBe(false);
  });
});

// -------------------------------------------------------------------------
// g. Body-CLICK action (AC5, seam map §9). Click 1 selects; click 2 on the SAME
//    body glides the VIEW (ORRERY only). ORRERY new body → select; HELM (any) →
//    select (click semantics unchanged); garbage → select.
// -------------------------------------------------------------------------
describe('bodyClickAction — click-2 on the same body glides the view, ORRERY only', () => {
  // Mirror of the cross-reducer invariant for the Increment-3 additions: neither
  // 'glide-view' nor 'select' is a ship-flight routing — in ORRERY the click moves
  // the VIEW (glide-view) or nothing (select), never the ship.
  const FLIGHT_TOKENS = new Set(['tour-advance', 'focus-fly', 'start', 'warp-cinematic']);
  it('never yields a flight routing in ORRERY (glide-view/select move the VIEW or nothing)', () => {
    for (const same of [true, false, undefined, 1, 0, null]) {
      const { action } = bodyClickAction({ regime: 'orrery', sameAsSelected: same });
      expect(FLIGHT_TOKENS.has(action)).toBe(false);
    }
  });
  it('ORRERY + same body clicked again → glide-view (the AC5 vantage glide)', () => {
    expect(bodyClickAction({ regime: 'orrery', sameAsSelected: true })).toEqual({ action: 'glide-view' });
  });
  it('ORRERY + a new/different body → select (click 1 selects only)', () => {
    expect(bodyClickAction({ regime: 'orrery', sameAsSelected: false })).toEqual({ action: 'select' });
    expect(bodyClickAction({ regime: 'orrery', sameAsSelected: undefined })).toEqual({ action: 'select' });
    expect(bodyClickAction({ regime: 'orrery', sameAsSelected: 0 })).toEqual({ action: 'select' });
  });
  it('HELM → always select, even on a repeat click (HELM click semantics unchanged)', () => {
    expect(bodyClickAction({ regime: 'helm', sameAsSelected: true })).toEqual({ action: 'select' });
    expect(bodyClickAction({ regime: 'helm', sameAsSelected: false })).toEqual({ action: 'select' });
  });
  it('garbage/missing regime → select (safe: a plain select moves neither ship nor vantage)', () => {
    for (const bad of [undefined, null, '', 'nonsense', 'HELM', 'Orrery']) {
      expect(bodyClickAction({ regime: bad, sameAsSelected: true })).toEqual({ action: 'select' });
      expect(bodyClickAction({ regime: bad, sameAsSelected: false })).toEqual({ action: 'select' });
    }
    expect(bodyClickAction()).toEqual({ action: 'select' });
    expect(bodyClickAction({})).toEqual({ action: 'select' });
  });
});

// -------------------------------------------------------------------------
// h. Nav-dispatch-during-warp decision (AC6, seam map §7). A nav warp the player
//    dispatches while the boot warp is in flight must win. no warp → normal
//    (byte-unchanged); pre-FOLD → overwrite (player's warpTarget write wins the
//    snapshot); post-FOLD → stash (redirect at the reveal seam).
// -------------------------------------------------------------------------
describe('navDispatchDuringWarp — a mid-warp nav selection wins (overwrite pre-FOLD, stash post-FOLD)', () => {
  it('no warp in flight → normal (today\'s behavior; HELM normal warp untouched)', () => {
    expect(navDispatchDuringWarp({ warpInFlight: false, foldSnapshotTaken: false })).toEqual({ action: 'normal' });
    expect(navDispatchDuringWarp({ warpInFlight: false, foldSnapshotTaken: true })).toEqual({ action: 'normal' });
  });
  it('warp in flight, pre-FOLD → overwrite (player write lands before the snapshot)', () => {
    expect(navDispatchDuringWarp({ warpInFlight: true, foldSnapshotTaken: false })).toEqual({ action: 'overwrite' });
  });
  it('warp in flight, post-FOLD → stash (generation committed; redirect at reveal)', () => {
    expect(navDispatchDuringWarp({ warpInFlight: true, foldSnapshotTaken: true })).toEqual({ action: 'stash' });
  });
  it('garbage/missing inputs → normal (safe default = identical to today)', () => {
    expect(navDispatchDuringWarp()).toEqual({ action: 'normal' });
    expect(navDispatchDuringWarp({})).toEqual({ action: 'normal' });
    for (const bad of [undefined, null, 0, '']) {
      expect(navDispatchDuringWarp({ warpInFlight: bad, foldSnapshotTaken: true })).toEqual({ action: 'normal' });
    }
    // truthy-garbage warpInFlight still routes by the FOLD flag (coerced)
    expect(navDispatchDuringWarp({ warpInFlight: 1, foldSnapshotTaken: 1 })).toEqual({ action: 'stash' });
    expect(navDispatchDuringWarp({ warpInFlight: 1, foldSnapshotTaken: 0 })).toEqual({ action: 'overwrite' });
  });
});
