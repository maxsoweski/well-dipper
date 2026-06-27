// Headless proof of #2 "Esc de-mode" (§supercruise-arrival-modes-design
// -2026-06-27): Esc must NEVER switch modes (ORRERY <-> HELM). The old Esc
// cascade ended with an EXIT-FLIGHT-to-Toybox step (main.js ~8602-8613: if
// (_scManual) { freeLook.exit(); scModel.setDrive(false); _exitFlightInternal();
// return }). That step is REMOVED. Leaving HELM is now ONLY via the swap key /
// HUD button / Options item — never Esc.
//
// New cascade order (top to bottom): close any open overlay (debug/pretext/
// sound/nav/settings/keybinds) -> deselect a selected body -> otherwise NOTHING.
// Mashing Esc can at most drop your selection; it can never strand you in or out
// of a mode. This file pins the pure reducer `escCascadeAction` that mirrors the
// live Esc handler so the "no mode switch" invariant can't silently regress.
import { describe, it, expect } from 'vitest';
import { escCascadeAction, escFocusResetFires } from '../flightModes.js';

// A fully-quiet state: no overlay open, nothing selected, regardless of regime.
const QUIET = {
  overlayOpen: false,
  hasSelection: false,
  scManual: true, // in HELM — the regime that USED to exit on Esc
};

describe('escCascadeAction — the Esc cascade order (pure)', () => {
  it('closes an open overlay first (highest priority)', () => {
    expect(escCascadeAction({ ...QUIET, overlayOpen: true })).toBe('dismiss-overlay');
    // Overlay wins even if a body is also selected.
    expect(escCascadeAction({ ...QUIET, overlayOpen: true, hasSelection: true })).toBe('dismiss-overlay');
  });

  it('deselects a selected body when no overlay is open', () => {
    expect(escCascadeAction({ ...QUIET, hasSelection: true })).toBe('deselect');
  });

  it('does NOTHING when nothing is open or selected — even in HELM (scManual)', () => {
    // THE CORE OF #2: in HELM with a quiet HUD, Esc is a no-op. Pre-fix this
    // returned an exit-flight-to-ORRERY action; that step is gone.
    expect(escCascadeAction({ ...QUIET, scManual: true })).toBe('none');
    expect(escCascadeAction({ ...QUIET, scManual: false })).toBe('none');
  });

  it('NEVER returns a mode-switch / exit-flight action in any state', () => {
    // Exhaustively cross the three inputs; assert no result ever switches modes.
    for (const overlayOpen of [false, true]) {
      for (const hasSelection of [false, true]) {
        for (const scManual of [false, true]) {
          const action = escCascadeAction({ overlayOpen, hasSelection, scManual });
          expect(['dismiss-overlay', 'deselect', 'none']).toContain(action);
          expect(action).not.toBe('exit-flight');
          expect(action).not.toBe('swap-mode');
        }
      }
    }
  });
});

describe('escFocusResetFires — the late ORRERY focus-reset gate (pure)', () => {
  // The quiet-HUD Esc fall-through (main.js ~8979) now reaches focusPlanet(-1)
  // because the early exit-flight step is gone. It must stay ORRERY-only so Esc
  // is a true no-op in HELM.
  it('fires the ORRERY system-overview reset on Esc in ORRERY (scManual=false)', () => {
    expect(escFocusResetFires({ code: 'Escape', scManual: false })).toBe(true);
  });
  it('does NOT fire on Esc in HELM (scManual=true) — Esc does NOTHING in HELM', () => {
    // The core HELM no-op invariant: no camera disturbance, no mode change.
    expect(escFocusResetFires({ code: 'Escape', scManual: true })).toBe(false);
  });
  it('Backquote (dev shortcut) keeps its prior unconditional reach in both regimes', () => {
    expect(escFocusResetFires({ code: 'Backquote', scManual: false })).toBe(true);
    expect(escFocusResetFires({ code: 'Backquote', scManual: true })).toBe(true);
  });
});
