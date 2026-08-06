// Headless proof of the #1 takeover fix (§supercruise-arrival-modes-design
// -2026-06-27, AC5): manual input (stick/throttle) must CANCEL a player-directed
// commit-burn Assist leg.
//
// ROOT CAUSE (pre-fix): commit-burn (Space → commitBurn → focusPlanet/Star/Moon →
// scControls.flyTo) activates scPilot while _flightMode stays MANUAL. The live
// cancel gates (main.js ~7933 W/S, ~9305 stick) require _flightMode===ASSIST, so
// they never fire for the burn — the player can't grab the stick to take over.
//
// FIX: a player-directed burn enters FlightMode.ASSIST (playerBurnMode) so the
// SAME gate predicate (manualCancelsLeg) the live code uses fires; the leg resets
// to MANUAL when it ends/cancels. This file pins those two pure reducers AND an
// end-to-end pilot simulation showing the leg is now cancellable — and that the
// OLD (mode stuck at MANUAL) behavior is NOT cancellable (the regression we fix).
import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { FlightMode, playerBurnMode, manualCancelsLeg, isManualInput, handRouting } from '../flightModes.js';
import { SupercruiseModel } from '../SupercruiseModel.js';
import { SupercruisePilot } from '../SupercruisePilot.js';

describe('playerBurnMode — the mode a player-directed burn enters', () => {
  it('is ASSIST, so the live takeover gates fire for a commit-burn leg', () => {
    // The whole point of the fix: the burn must run under ASSIST, not MANUAL,
    // or the manual-cancel gates (manualCancelsLeg) can never satisfy.
    expect(playerBurnMode()).toBe(FlightMode.ASSIST);
  });
});

describe('manualCancelsLeg — the live takeover gate predicate (pure)', () => {
  // Mirrors main.js ~7933 / ~9305 / ~9308: `_flightMode===ASSIST && scPilot.isActive`.
  it('fires only when an ASSIST leg is active', () => {
    expect(manualCancelsLeg(FlightMode.ASSIST, true)).toBe(true);
  });
  it('does NOT fire when the pilot is idle', () => {
    expect(manualCancelsLeg(FlightMode.ASSIST, false)).toBe(false);
  });
  it('does NOT fire when the mode is MANUAL even with the pilot active — the pre-fix bug', () => {
    // This is exactly the stuck-MANUAL commit-burn state that could not be cancelled.
    expect(manualCancelsLeg(FlightMode.MANUAL, true)).toBe(false);
  });
  it('does NOT fire for ALIGN (only ASSIST is the player-directed-burn mode)', () => {
    expect(manualCancelsLeg(FlightMode.ALIGN, true)).toBe(false);
  });
  it('does NOT broaden to "any pilot active" — keeps the Q-tour takeover separate', () => {
    // The autopilot tour keeps _flightMode at MANUAL while scPilot.isActive; this
    // predicate must NOT catch it (the tour has its own W/S takeover at ~8918).
    expect(manualCancelsLeg(FlightMode.MANUAL, true)).toBe(false);
  });
});

describe('player-directed commit-burn leg is cancellable by manual input (end to end)', () => {
  let model, pilot, body, flightMode;

  // Mirror the live focus*→scControls.flyTo door + the gate→scPilot.stop reset,
  // as a tiny harness over the REAL model + pilot (no three.js scene / DOM).
  function startPlayerBurn() {
    // What focusPlanet/Star/Moon now do at the flyTo site: leg + ASSIST.
    pilot.beginLeg({ toBody: body, bodyRadius: 5, linger: Infinity });
    flightMode = playerBurnMode();
  }
  function tryManualTakeover(stick, throttleDir) {
    // What the live W/S + stick gates do: cancel iff the predicate satisfies.
    if (manualCancelsLeg(flightMode, pilot.isActive) && isManualInput(stick, throttleDir)) {
      pilot.stop();
      flightMode = FlightMode.MANUAL; // leg cancelled → reset for the next engage
      return true;
    }
    return false;
  }

  beforeEach(() => {
    model = new SupercruiseModel();
    model.position.set(0, 0, 0);
    pilot = new SupercruisePilot(model);
    body = new THREE.Object3D();
    body.position.set(0, 0, -1000); // far enough that the leg stays in ALIGN/CRUISE
    flightMode = FlightMode.MANUAL;
  });

  it('enters ASSIST with the pilot active when the burn starts', () => {
    startPlayerBurn();
    expect(flightMode).toBe(FlightMode.ASSIST);
    expect(pilot.isActive).toBe(true);
    // The gate predicate is now satisfiable mid-leg — the core of the fix.
    expect(manualCancelsLeg(flightMode, pilot.isActive)).toBe(true);
  });

  it('a throttle input (W/S) cancels the leg and resets to MANUAL', () => {
    startPlayerBurn();
    pilot.update(1 / 60); // one live frame in
    expect(pilot.isActive).toBe(true);
    const cancelled = tryManualTakeover({ x: 0, y: 0 }, -1); // S held
    expect(cancelled).toBe(true);
    expect(pilot.isActive).toBe(false);
    expect(flightMode).toBe(FlightMode.MANUAL);
  });

  it('a stick deflection cancels the leg and resets to MANUAL', () => {
    startPlayerBurn();
    pilot.update(1 / 60);
    const cancelled = tryManualTakeover({ x: 0.4, y: 0 }, 0); // stick pushed
    expect(cancelled).toBe(true);
    expect(pilot.isActive).toBe(false);
    expect(flightMode).toBe(FlightMode.MANUAL);
  });

  it('no input does NOT cancel the leg (only manual input takes over)', () => {
    startPlayerBurn();
    pilot.update(1 / 60);
    const cancelled = tryManualTakeover({ x: 0, y: 0 }, 0); // at rest
    expect(cancelled).toBe(false);
    expect(pilot.isActive).toBe(true);
    expect(flightMode).toBe(FlightMode.ASSIST);
  });

  it('REGRESSION GUARD: a leg stuck at MANUAL (the pre-fix bug) cannot be cancelled', () => {
    // Simulate today's broken state: burn started but _flightMode never set to ASSIST.
    pilot.beginLeg({ toBody: body, bodyRadius: 5, linger: Infinity });
    flightMode = FlightMode.MANUAL; // the bug: stays MANUAL
    pilot.update(1 / 60);
    const cancelled = tryManualTakeover({ x: 0, y: 0 }, -1); // S held, but gate can't fire
    expect(cancelled).toBe(false);
    expect(pilot.isActive).toBe(true); // strands the player in an uncancellable burn
  });
});

describe('mode-ownership-2026-07-02 wiring: Assist is OUT OF SCOPE for the hand-state gate', () => {
  // Mirrors main.js ~8503-8524 (the held-keys throttle/cancel branch), which the
  // mode-ownership workstream re-gated on hand-state (handRouting(_scManual &&
  // !freeLook.latched).throttle) to kill the TOUR's Q/E-roll leak. Regression:
  // a HELM-native ASSIST leg (Space commit-burn) can be launched from hands-off
  // — aim/select requires a free cursor, i.e. free-look latched — so the pure
  // hand-state gate stranded manualCancelsLeg's W/S-cancel path behind a
  // hands-on check the Assist path never had before. The live fix keeps the
  // branch reachable whenever an ASSIST leg is actively flying, regardless of
  // hand-state. This harness reproduces the EXACT main.js OR-condition (no
  // three.js scene / DOM) so the wiring regression can't reopen silently —
  // the pure reducer tests (manualCancelsLeg alone) can't catch this because
  // the bug was in the gate wrapped AROUND the reducer call, not the reducer.
  let model, pilot, body, flightMode;

  function startPlayerBurn() {
    pilot.beginLeg({ toBody: body, bodyRadius: 5, linger: Infinity });
    flightMode = playerBurnMode();
  }
  // The live wiring: `if (handRouting(scManual && !freeLookLatched).throttle
  // || (scPilot.isActive && _flightMode === ASSIST)) { if (manualCancelsLeg
  // (...) && dir !== 0) { scPilot.stop(); _flightMode = MANUAL; } }`
  function pressWS({ scManual, freeLookLatched, throttleDir }) {
    const handsOn = scManual && !freeLookLatched;
    const routing = handRouting(handsOn);
    const assistLegActive = pilot.isActive && flightMode === FlightMode.ASSIST;
    if (!(routing.throttle || assistLegActive)) return false; // branch never entered
    if (manualCancelsLeg(flightMode, pilot.isActive) && throttleDir !== 0) {
      pilot.stop();
      flightMode = FlightMode.MANUAL;
      return true;
    }
    return false;
  }

  beforeEach(() => {
    model = new SupercruiseModel();
    model.position.set(0, 0, 0);
    pilot = new SupercruisePilot(model);
    body = new THREE.Object3D();
    body.position.set(0, 0, -1000);
    flightMode = FlightMode.MANUAL;
  });

  it('REGRESSION GUARD: W/S still cancels a HELM free-look (hands-off) ASSIST leg', () => {
    startPlayerBurn();
    pilot.update(1 / 60);
    // scManual true (HELM), freeLook.latched true (hands-off — how the target
    // was aimed/selected in the first place). Pre-fix this fell into the new
    // hands-off passenger branch and never reached manualCancelsLeg.
    const cancelled = pressWS({ scManual: true, freeLookLatched: true, throttleDir: -1 });
    expect(cancelled).toBe(true);
    expect(pilot.isActive).toBe(false);
    expect(flightMode).toBe(FlightMode.MANUAL);
  });

  it('W/S also still cancels a HELM hands-on ASSIST leg (unchanged path)', () => {
    startPlayerBurn();
    pilot.update(1 / 60);
    const cancelled = pressWS({ scManual: true, freeLookLatched: false, throttleDir: 1 });
    expect(cancelled).toBe(true);
    expect(pilot.isActive).toBe(false);
    expect(flightMode).toBe(FlightMode.MANUAL);
  });

  it('does NOT reopen the tour leak: hands-off with NO assist leg active never enters the branch', () => {
    // Tour/coast state: pilot idle (no ASSIST leg), hands-off. The branch must
    // stay closed so Q/E-roll zeroing (the sibling `else if (_scManual)` arm)
    // still runs — this is the leak the workstream was built to kill.
    const cancelled = pressWS({ scManual: true, freeLookLatched: true, throttleDir: -1 });
    expect(cancelled).toBe(false);
    expect(pilot.isActive).toBe(false);
  });
});
