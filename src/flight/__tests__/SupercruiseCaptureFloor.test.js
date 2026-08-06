// src/flight/__tests__/SupercruiseCaptureFloor.test.js
//
// tour-reliability-corrections-2026-07-01 — AC4-tiny-body-capture-floor.
//
// IMPORTANT SCOPE NOTE (added after adversarial review, 2026-07-01): main.js
// (:8150-8159) registers EVERY moon as its own gravity body, every tick, with
// its own radius — so in the live tour the pilot's tiny target is normally
// SELF-governed. When that's true, dropMaxSpeed = 4R is provably sufficient
// with NO floor at all (see SupercruisePilot.test.js "capture stays
// arithmetically possible across production radii" — self-governed cap at
// the drop sphere is <= ~3.3R < 4R at every production radius down to 4e-5).
// The 'AC4(a) — self-governed' test below locks this in as a regression:
// with the target registered exactly as main.js registers it, floor=0 and
// the shipped floor are BYTE-IDENTICAL — RC4 changes NOTHING for that case,
// because nothing needs changing there.
//
// RC4 only ever matters when something ELSE sets the local cap near the tiny
// target ABOVE its own naive 4R window (a bigger nearby body, a coarser
// tracked reference, ...) — hand-built below as a separate "governor" body.
// Measured with the real classes (see 'AC4(a2)' and 'AC4-known-limit'
// below): the shipped 0.1 floor genuinely rescues governor radii up to
// ~0.2 (within the documented 1e-4..5 production range) but NOT beyond
// ~0.21 — past that the leg still fails to reach HOLD, though it now
// terminates via the RC1 cap-relative stall-abort (skip-and-continue)
// rather than an unbounded silent fly-through. Whether real live geometry
// (sibling moons/planets near a tiny target) falls inside or outside that
// rescued range is NOT established by these unit tests — that is exactly
// what AC6/AC7's live monitored tour gate (deferred to Max) exists to show.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { SupercruiseModel } from '../SupercruiseModel.js';
import { SupercruisePilot, PilotPhase } from '../SupercruisePilot.js';

const DT = 1 / 60;

describe('SupercruisePilot — absolute floor under the capture window (tour-reliability-corrections RC4)', () => {
  it('AC4(a) — self-governed: a tiny (R=0.004) moon registered exactly as main.js registers it (its own radius, every tick) already captures with NO floor — RC4 is a no-op here, by design', () => {
    // Matches main.js:8150-8159's actual per-moon registration: the target
    // moon IS the (only) gravity body, registered fresh every tick with its
    // own radius — not an artificial "governor" stand-in. Regression per the
    // scope note above: floor=0 and the shipped floor must behave IDENTICALLY.
    const moonR = 0.004;
    const moonPos = new THREE.Vector3(0, 0, -3000);
    const moonMesh = { position: moonPos };

    function fly(tuningOverride) {
      const m = new SupercruiseModel();
      const pilot = new SupercruisePilot(m, tuningOverride);
      pilot.beginLeg({ toBody: moonMesh, bodyRadius: moonR, linger: 1 });
      let complete = false, aborted = false, minDist = Infinity, i = 0;
      for (; i < 60 * 300 && complete === false && aborted === false; i++) {
        m.setBodies([{ position: moonPos, radius: moonR }]); // self-governed, re-registered every tick
        const frame = pilot.update(DT);
        m.update(DT);
        minDist = Math.min(minDist, m.position.distanceTo(moonPos));
        if (frame.stallAborted) aborted = true;
        if (frame.motionComplete) complete = true;
      }
      return { complete, aborted, minDist, finalPhase: pilot.phase, speed: m.speed };
    }

    const noFloor = fly({ DROP_MAX_SPEED_FLOOR: 0 });
    const shippedFloor = fly(undefined);

    // Already captures fine WITHOUT any floor (the physics guarantees it).
    expect(noFloor.aborted).toBe(false);
    expect(noFloor.complete).toBe(true);
    expect(noFloor.finalPhase).toBe(PilotPhase.HOLD);

    // The floor changes NOTHING for this (the common live) configuration.
    expect(shippedFloor).toEqual(noFloor);
  });

  it('AC4(a2) — externally governed: a modest nearby body (R=0.18, within the production range) sets the local cap above the moon\'s own 4R window; the shipped 0.1 floor genuinely rescues capture', () => {
    // A "gravity-governing" body (NOT the pilot's target — whatever coarser
    // reference/sibling body is actually setting the local cap near a tiny
    // satellite) sits near the tiny target moon, offset clear of its own
    // collision barrier. The moon itself is not in model.setBodies() at all
    // — the only speed cap in effect is the governor's, which settles to a
    // near-body "crawl" well above the moon's own naive 4R = 0.016 u/s
    // window. Chosen so the shipped 0.1 floor is LOAD-BEARING here (unlike a
    // smaller governor, where any floor >= ~0.05 would pass regardless of
    // the shipped value — see AC4-known-limit for the boundary beyond which
    // even 0.1 stops being enough).
    const governorR = 0.18;
    const governor = { position: new THREE.Vector3(0, 0, 0), radius: governorR };
    const moonR = 0.004;
    const offset = governorR * 1.05 + 0.05; // clear of the governor's 1.05*R collision barrier
    const moonPos = new THREE.Vector3(offset, 0, 0);
    const moonMesh = { position: moonPos };
    const shipStart = new THREE.Vector3(offset, 0, 3000); // straight approach along -Z, at the moon's x/y

    function fly(tuningOverride) {
      const m = new SupercruiseModel();
      m.position.copy(shipStart);
      const pilot = new SupercruisePilot(m, tuningOverride);
      pilot.beginLeg({ toBody: moonMesh, bodyRadius: moonR, linger: 1 });
      let complete = false, aborted = false, minDist = Infinity, i = 0;
      for (; i < 60 * 300 && complete === false && aborted === false; i++) {
        m.setBodies([governor]); // ONLY the governor is gravity-registered — not the moon
        const frame = pilot.update(DT);
        m.update(DT);
        minDist = Math.min(minDist, m.position.distanceTo(moonPos));
        if (frame.stallAborted) aborted = true;
        if (frame.motionComplete) complete = true;
      }
      return { complete, aborted, minDist, finalPhase: pilot.phase };
    }

    // Pre-fix (today, no floor): reproduces the measured failure — flies
    // through to ~distance 0, never reaches HOLD.
    const preFix = fly({ DROP_MAX_SPEED_FLOOR: 0 });
    expect(preFix.complete).toBe(false);
    expect(preFix.minDist).toBeLessThan(moonR); // passed through the body itself, uncaptured

    // Post-fix (the shipped default tuning): the same approach now captures.
    const postFix = fly(undefined);
    expect(postFix.aborted).toBe(false);
    expect(postFix.complete).toBe(true);
    expect(postFix.finalPhase).toBe(PilotPhase.HOLD);
    expect(postFix.minDist).toBeLessThanOrEqual(moonR * 10); // captured within the drop sphere, not after overshoot
  });

  it('AC4-known-limit — a larger nearby governor (R=0.3) exceeds even the shipped floor; capture still fails, but the leg cleanly stall-aborts (RC1) instead of hanging forever', () => {
    // Documents the honest boundary of RC4 (medium-severity adversarial
    // review finding, 2026-07-01): raising DROP_MAX_SPEED_FLOOR further
    // would start altering capture behavior for legitimately large bodies
    // (AC4(b) requires those unchanged), so the floor cannot be made
    // universally sufficient. This asserts the backstop still holds — the
    // tour skips-and-continues rather than getting stuck — even in a case
    // RC4 alone cannot rescue.
    const governorR = 0.3;
    const governor = { position: new THREE.Vector3(0, 0, 0), radius: governorR };
    const moonR = 0.004;
    const offset = governorR * 1.05 + 0.05;
    const moonPos = new THREE.Vector3(offset, 0, 0);
    const moonMesh = { position: moonPos };
    const shipStart = new THREE.Vector3(offset, 0, 3000);

    const m = new SupercruiseModel();
    m.position.copy(shipStart);
    const pilot = new SupercruisePilot(m);
    pilot.beginLeg({ toBody: moonMesh, bodyRadius: moonR, linger: 1 });
    let complete = false, aborted = false, i = 0;
    for (; i < 60 * 300 && complete === false && aborted === false; i++) {
      m.setBodies([governor]);
      const frame = pilot.update(DT);
      m.update(DT);
      if (frame.stallAborted) aborted = true;
      if (frame.motionComplete) complete = true;
    }
    expect(complete).toBe(false);   // known limit: RC4 alone doesn't rescue this governor size
    expect(aborted).toBe(true);     // but RC1's backstop still ends the leg — no infinite hang
  });

  it('AC4(b) — a large body (R=0.48) captures identically with or without the floor', () => {
    // The floor only ever WIDENS the window for bodies small enough that
    // 4R would fall below it; for R=0.48 (4R=1.92 >> the floor) the entire
    // frame-by-frame trajectory must be untouched.
    function fly(tuningOverride) {
      const model = new SupercruiseModel();
      const bodyR = 0.48;
      const body = { position: new THREE.Vector3(0, 0, -30) };
      model.setBodies([{ position: body.position, radius: bodyR }]);
      const pilot = new SupercruisePilot(model, tuningOverride);
      pilot.beginLeg({ toBody: body, bodyRadius: bodyR, linger: 1 });
      const frames = [];
      for (let i = 0; i < 60 * 120; i++) {
        const f = pilot.update(DT);
        model.update(DT);
        frames.push({ phase: f.phase, dist: model.position.distanceTo(body.position) });
        if (f.motionComplete || f.stallAborted) break;
      }
      return frames;
    }

    const today = fly({ DROP_MAX_SPEED_FLOOR: 0 });     // no floor — today's behavior
    const withFloor = fly(undefined);                   // shipped default tuning

    expect(withFloor.length).toBe(today.length);
    for (let i = 0; i < today.length; i++) {
      expect(withFloor[i].phase).toBe(today[i].phase);
      expect(withFloor[i].dist).toBeCloseTo(today[i].dist, 9);
    }
  });
});
