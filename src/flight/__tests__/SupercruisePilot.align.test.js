// src/flight/__tests__/SupercruisePilot.align.test.js
//
// AC8 — Assist ALIGN must converge against a MOVING target (an orbiting moon
// like Dione). The old gate held throttle 0 until nose-dot ≥ ALIGN_DOT (0.995)
// against the target's *current* position. While the ship sits still in ALIGN
// (throttle 0), a body orbiting at a moderate angular rate makes the nose chase
// with a steady tracking lag that asymptotes JUST below 0.995 — it never crosses
// the gate, so ALIGN hangs forever (live: an orbiting moon froze the Assist leg).
//
// Reproduction below: a body orbiting the (stationary) ship at d=3000, ω=0.5 rad/s
// starting 90° off the nose hangs in ALIGN for >60 s on the old strict gate.
//
// The fix relaxes the gate (dot ≥ ALIGN_DOT_RELAXED) OR times ALIGN out
// (ALIGN_TIMEOUT ≈ 8 s) so the leg always reaches CRUISE (which keeps steering),
// without flipping to a different target.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { SupercruiseModel } from '../SupercruiseModel.js';
import { SupercruisePilot, PilotPhase } from '../SupercruisePilot.js';

const DT = 1 / 60;

// A target orbiting the origin (where the ALIGN-phase ship sits) in the X/-Z
// plane. ang = π/2 starts it at +X — 90° off the ship's −Z nose, so a real slew
// is required; the orbit then keeps it moving so the strict gate can never settle.
function makeOrbitingMoon(d, omega, r, ang0 = Math.PI / 2) {
  let ang = ang0;
  const mesh = { position: new THREE.Vector3() };
  const set = () => mesh.position.set(d * Math.sin(ang), 0, -d * Math.cos(ang));
  set();
  return {
    mesh,
    radius: r,
    advance(dt) { ang += omega * dt; set(); },
  };
}

describe('SupercruisePilot — ALIGN against a moving target (AC8)', () => {
  it('leaves ALIGN within a bounded time and does not flip target', () => {
    const model = new SupercruiseModel();
    // d=3000, ω=0.5 rad/s — the steady-tracking-lag case that hangs the old gate.
    const tgt = makeOrbitingMoon(3000, 0.5, 5);
    model.setBodies([{ position: tgt.mesh.position, radius: tgt.radius }]);
    const pilot = new SupercruisePilot(model);
    pilot.beginLeg({ toBody: tgt.mesh, bodyRadius: tgt.radius, linger: 1 });

    // Step at most ~8 s of ALIGN (the timeout cap) plus a small margin; advance
    // the orbiting moon every step.
    const maxSteps = Math.ceil(8.5 * 60);
    let i = 0;
    for (; i < maxSteps && pilot.phase === PilotPhase.ALIGN; i++) {
      tgt.advance(DT);
      pilot.update(DT);
      model.update(DT);
    }

    // Converged out of ALIGN within the bound — no hang.
    expect(pilot.phase).not.toBe(PilotPhase.ALIGN);
    expect(i).toBeLessThan(maxSteps);
    // Did not flip to another body.
    expect(pilot._target.mesh).toBe(tgt.mesh);
  });

  it('a stationary on-axis target still aligns immediately (no regression)', () => {
    const model = new SupercruiseModel();
    const mesh = { position: new THREE.Vector3(0, 0, -5000) };
    model.setBodies([{ position: mesh.position, radius: 5 }]);
    const pilot = new SupercruisePilot(model);
    pilot.beginLeg({ toBody: mesh, bodyRadius: 5, linger: 1 });
    let i = 0;
    for (; i < 8 * 60 && pilot.phase === PilotPhase.ALIGN; i++) {
      pilot.update(DT);
      model.update(DT);
    }
    expect(pilot.phase).not.toBe(PilotPhase.ALIGN);
    // On-axis body should leave ALIGN well before the 8 s timeout.
    expect(i).toBeLessThan(8 * 60);
  });
});
