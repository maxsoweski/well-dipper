/**
 * AC-OVERLAYS-RETIRE-IN-HELM, the SupercruiseHud half — READOUT vs CONTROL.
 *
 * DIEGETIC-ONLY retires the flight READOUTS in HELM because the cockpit's DRIVE
 * panel carries them on the glass; before this they were on screen twice at
 * once. It does NOT retire everything this canvas draws, and the distinction is
 * the whole point of the test:
 *
 *   GONE in HELM     the bottom-left speed + throttle cluster, the MODE line
 *   STAYS            the centre reticle cross + deflection dot — a CONTROL, and
 *                    no panel can draw a cross at screen centre
 *   STAYS            the mass-lock "TOO CLOSE" alert (no panel equivalent)
 *   STAYS            the at-the-body ETA / drop cue (world-space: says WHICH,
 *                    where the panel says how far)
 *
 * ⚠ THIS IS NOT A SOURCE SCAN. It builds the real class over a recording 2D
 * context and asks what it DREW, following `helpers/headlessNav.mjs`, which
 * exists because this lane's source scans were proven evadable seven ways.
 * It answers "what did the class do", never "what did it look like".
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { makeRecordingContext } from './helpers/headlessNav.mjs';

const noop = () => {};
let SupercruiseHud;
let rec;

beforeAll(async () => {
  const canvas = { width: 1920, height: 1080, style: {}, addEventListener: noop };
  const made = makeRecordingContext(canvas);
  rec = made.rec;
  canvas.getContext = () => made.ctx;
  globalThis.document = {
    createElement: () => canvas,
    body: { appendChild: noop },
    addEventListener: noop,
  };
  globalThis.window = { devicePixelRatio: 1, addEventListener: noop };
  globalThis.innerWidth = 1920;
  globalThis.innerHeight = 1080;
  ({ SupercruiseHud } = await import('../SupercruiseHud.js'));
});

/** A state that draws EVERY gated element, so an absence is always the gate. */
function fullState(over = {}) {
  return {
    visible: true,
    speed: 2.5,
    commandedSpeed: 3,
    driveOn: true,
    sublightCap: 0.002,
    throttle: 0.5,
    deflection: { x: 0.1, y: -0.2 },
    targetPos: { x: 0, y: 0, z: -10 },
    targetDistance: 500,
    aimOnTarget: true,
    dropMaxSpeed: 4,
    dropState: 'in-window',
    massLockHint: true,
    flightMode: 'manual',
    showReticle: true,
    ...over,
  };
}

/** Draw once and return everything that reached the glass. */
function draw(state) {
  rec.text.length = 0;
  rec.calls.length = 0;
  const hud = new SupercruiseHud({
    // `_project` needs a camera; a stub that puts the body on screen is enough.
    // Vector3.project() calls into it, so hand it the matrices it reads.
    matrixWorldInverse: { elements: null },
    projectionMatrix: { elements: null },
  });
  // Bypass three's projection entirely — this test is about WHICH elements draw,
  // not where. Returning a fixed point keeps the target-cue branch reachable.
  hud._project = () => ({ x: 900, y: 500 });
  hud.update(state);
  return rec.text.map((t) => t.text).join('\n');
}

describe('SupercruiseHud — showReadouts (AC-OVERLAYS-RETIRE-IN-HELM)', () => {
  it('CONTROL: with readouts ON, every gated element reaches the glass', () => {
    // If this ever stops drawing them, the absences below prove nothing.
    const drawn = draw(fullState());
    expect(drawn).toMatch(/2\.5|Mm\/s|c$|c\n|km\/s/m);   // the numeric speed
    expect(drawn).toContain('MODE: MANUAL');
    expect(drawn).toContain('SAFE TO DROP');
    expect(drawn).toContain('TOO CLOSE — SUBLIGHT ONLY');
  });

  it('with readouts OFF the speed cluster and MODE line are GONE', () => {
    const drawn = draw(fullState({ showReadouts: false }));
    expect(drawn).not.toContain('MODE: MANUAL');
    expect(drawn).not.toContain('SUBLIGHT\n');   // the drive-dropped tag
  });

  it('…but the mass-lock alert and the at-the-body drop cue STAY', () => {
    const drawn = draw(fullState({ showReadouts: false }));
    expect(drawn, 'the alert has no cockpit-panel equivalent').toContain('TOO CLOSE — SUBLIGHT ONLY');
    expect(drawn, 'the world-space cue says WHICH body, which the panel cannot').toContain('SAFE TO DROP');
  });

  it('…and the STEERING reticle stays, because it is a control and not a readout', () => {
    // The cross is two moveTo/lineTo pairs and the deflection dot is an arc.
    // Retiring the canvas wholesale would have taken both, and taking them
    // breaks aiming — AC-IT-FEELS-LIKE-FLYING-FROM-INSIDE's own subject.
    const before = (() => { draw(fullState({ showReadouts: false })); return rec.calls.slice(); })();
    expect(before.filter((c) => c.op === 'arc').length,
      'the deflection dot is gone — the stick has no aim indicator').toBeGreaterThan(0);
    expect(before.filter((c) => c.op === 'lineTo').length,
      'the centre cross is gone').toBeGreaterThan(0);
  });

  it('showReticle and showReadouts are INDEPENDENT gates', () => {
    // Free-look hides the reticle but (in ORRERY) keeps the numbers; HELM hides
    // the numbers but keeps the reticle. Neither may imply the other.
    draw(fullState({ showReticle: false, showReadouts: true }));
    const reticleOffArcs = rec.calls.filter((c) => c.op === 'arc').length;
    const numbersKept = rec.text.map((t) => t.text).join('\n');
    expect(numbersKept).toContain('MODE: MANUAL');
    expect(reticleOffArcs, 'showReadouts must not resurrect the reticle').toBe(0);
  });

  it('defaults to ON, so nothing that never passes the flag changes behaviour', () => {
    const drawn = draw(fullState({ showReadouts: undefined }));
    expect(drawn).toContain('MODE: MANUAL');
  });
});
