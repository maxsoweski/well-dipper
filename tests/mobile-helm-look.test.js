// tests/mobile-helm-look.test.js
// In HELM, touch and gyro look must reach the COCKPIT HEAD, not the bypassed orbit controller.
//
// ⭐⭐ THE DEFECT, MEASURED LIVE ON THE DEPLOYED SITE BEFORE THE FIX. A ~540px one-finger drag in
// mobile HELM moved `cameraController.yaw` 3.401 → 4.373 while `smoothedYaw` — the value actually
// applied — stayed at 3.399, and the camera quaternion did not change. `controller.bypassed` was true
// throughout: in HELM the camera is driven from `scHead` (HeadMount), so the orbit controller is not
// read. The drag was recorded and discarded. The gyro wrote to the identical dead place.
//
// That is not a cosmetic gap. Max's framing: "the fine navigation will be entirely autopilot and the
// player is there to look around the cockpit and choose which planet/moon or system to go to next at
// most." With the flying automated, looking around IS the mode — and it was the one thing inert.
//
// The unit half drives the real ShipCameraSystem sink contract; the wiring half is a source scan,
// because main.js cannot be imported (zero exports, THREE + getElementById at module scope).
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { stripCommentsPreservingOffsets } from './helpers/source-scan.mjs';
import { HeadMount } from '../src/flight/HeadMount.js';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(resolve(REPO, rel), 'utf8');
const MAIN = stripCommentsPreservingOffsets(read('src/main.js'));
const CAM = stripCommentsPreservingOffsets(read('src/camera/ShipCameraSystem.js'), { blankLiteralText: true });
// ⚠ Strings-intact view. `typeof x === 'function'` compares against a STRING LITERAL, blanked in the
// view above — the fifth time this session a scan read the right file at the right place and matched
// nothing because the thing it wanted lived inside quotes. Structural matches use the blanked view;
// anything containing a literal uses this one.
const CAM_STRINGS = stripCommentsPreservingOffsets(read('src/camera/ShipCameraSystem.js'));

describe('the look sink contract', () => {
  it('⛔ a sink that does not claim is not consulted — ORRERY must keep its orbit drag', () => {
    // The whole risk of this seam is that it steals the input in the mode where the orbit drag is
    // CORRECT. claim() is asked per event precisely so ORRERY is untouched.
    const drag = CAM_STRINGS.match(/_sinkClaims\(\)\s*\{[\s\S]*?\n  \}/);
    expect(drag, '_sinkClaims found').toBeTruthy();
    expect(drag[0], 'it asks claim()').toMatch(/\.claim\(\)/);
    expect(drag[0], 'and requires an add() to exist before claiming').toMatch(/typeof\s+sk\.add\s*===\s*'function'/);
  });

  it('both look inputs — drag AND gyro — are offered to the sink', () => {
    // The gyro was inert for the SAME reason as the drag; fixing only the drag would have left the
    // gyro button doing nothing in HELM, which is how a half-fix reads as a broken control.
    const offers = CAM.match(/if \(this\._sinkClaims\(\)\)/g) || [];
    expect(offers.length, 'the drag path and the gyro path both offer').toBeGreaterThanOrEqual(2);
    const gyro = CAM.match(/_gyroHandler\s*=[\s\S]*?\n    \};/);
    expect(gyro, 'gyro handler found').toBeTruthy();
    expect(gyro[0], 'the gyro offers to the sink before writing its own yaw').toMatch(/_sinkClaims\(\)/);
  });

  it('deltas cross the seam in RADIANS, already scaled — never raw pixels', () => {
    // The two consumers clamp differently (85° in the camera system, 60° at the head mount), so
    // handing over pixels would make the sink guess the sender's sensitivity.
    const drag = CAM.match(/lookSink\.add\([^)]*\)/g) || [];
    expect(drag.length).toBeGreaterThanOrEqual(2);
    for (const call of drag) {
      expect(call, `"${call}" is sensitivity-scaled`).toMatch(/Sensitivity|sensitivity/);
    }
  });
});

describe('main.js wires the sink to the cockpit head', () => {
  it('the sink exists and claims on the REGIME, not on the cockpit mesh', () => {
    const sink = MAIN.match(/cameraController\.lookSink\s*=\s*\{[\s\S]*?\n\};/);
    expect(sink, 'lookSink assigned').toBeTruthy();
    expect(sink[0], 'claims in HELM').toMatch(/claim:\s*\(\)\s*=>\s*_scManual/);
    // ⛔ NOT _cockpitShouldRender(): in HELM the camera is head-driven whether or not the cockpit GLB
    // loaded, so gating on the mesh would leave a GLB failure with a dead drag AND no cockpit — two
    // failures where the regime question gives one correct answer.
    expect(sink[0], 'does not gate on the cockpit mesh').not.toMatch(/_cockpitShouldRender/);
  });

  it('⭐ it drives scHead.addLook — the SAME sink the desktop mouse reaches', () => {
    const sink = MAIN.match(/cameraController\.lookSink\s*=\s*\{[\s\S]*?\n\};/);
    expect(sink[0], 'writes the head, not the controller').toMatch(/scHead\.addLook\(/);
    expect(sink[0], 'and holds the head first, since addLook is a no-op unless held')
      .toMatch(/scHead\.beginLook\(\)/);
    // The desktop path must still exist and go to the same place — two implementations of "turn your
    // head" would drift the moment either is tuned.
    expect(MAIN, 'the desktop mouse path still feeds the same head').toMatch(/scHead\.addLook\(-e\.movementX/);
  });

  it('⭐ the head is released on BOTH touchend and touchcancel, before any early return', () => {
    // A drag exits the touchend handler at the 20px tap-slop check, so releasing further down would
    // leave `held` set after the first look — and every later gesture would accumulate from where
    // that one stopped, with no boundary between them.
    // ⚠ WIDE WINDOW ON PURPOSE — comments are preserved as same-length whitespace, and the release
    // carries a six-line note explaining why it must precede the tap-slop return.
    // ⛔ ANCHORED ON `canvas.` — the bare pattern matched the SPLASH SCREEN's touchend listener
    // 9,600 lines earlier and asserted against the wrong handler entirely. There are 19
    // addEventListener('touchend') sites in this file; a scan that does not say WHICH is not a scan.
    const end = MAIN.match(/canvas\.addEventListener\('touchend'[\s\S]{0,2200}/);
    expect(end, 'the CANVAS touchend handler found').toBeTruthy();
    const releaseIdx = end[0].indexOf('scHead.endLook()');
    expect(releaseIdx, 'the head is released in touchend').toBeGreaterThan(-1);
    // ⛔ COMPARED AGAINST THE FIRST `return`, NOT AGAINST THE SLOP CONSTANT — and that distinction is
    // not pedantry, it is a hole this assertion ALREADY HAD. The first version compared the release
    // position against indexOf('400'). Moving the release to sit after the changedTouches guard but
    // still a few lines above the literal 400 left it PASSING while the behaviour was broken: a
    // multi-touch end would return before ever releasing the head. Sabotage caught it; the ordering
    // that matters is "before anything can leave this function".
    const firstReturn = end[0].indexOf('return;');
    expect(firstReturn, 'the handler has an early return to be ahead of').toBeGreaterThan(-1);
    expect(releaseIdx, 'and BEFORE the first early return of any kind').toBeLessThan(firstReturn);
    // iOS fires touchcancel instead of touchend when a call or the app switcher interrupts.
    expect(MAIN, 'touchcancel releases too')
      .toMatch(/canvas\.addEventListener\('touchcancel'[\s\S]{0,200}endLook\(/);
  });
});

describe('HeadMount honours what the sink sends', () => {
  it('addLook does nothing unless held — which is why the sink calls beginLook', () => {
    const h = new HeadMount();
    h.addLook(0.5, 0.2);
    expect(h.yaw, 'ignored while not held').toBe(0);
    h.beginLook();
    h.addLook(0.5, 0.2);
    expect(h.yaw).toBeCloseTo(0.5, 6);
    expect(h.pitch).toBeCloseTo(0.2, 6);
  });

  it('⭐ releasing HOLDS the view rather than snapping back — what a phone wants', () => {
    // Look left, let go, keep looking left. HeadMount.update only eases to centre on an explicit
    // beginRecenter, which the touch path deliberately never calls.
    const h = new HeadMount();
    h.beginLook(); h.addLook(0.6, 0.1); h.endLook();
    for (let i = 0; i < 60; i++) h.update(1 / 60);
    expect(h.yaw, 'still looking where you left it').toBeCloseTo(0.6, 6);
  });

  it('CONTROL — the clamps are real, so a long swipe cannot spin the head off its limits', () => {
    const h = new HeadMount();
    h.beginLook();
    for (let i = 0; i < 500; i++) h.addLook(0.5, 0.5);
    expect(Math.abs(h.yaw)).toBeLessThanOrEqual(Math.PI * 0.75 + 1e-9);
    expect(Math.abs(h.pitch)).toBeLessThanOrEqual(Math.PI / 3 + 1e-9);
  });
});
