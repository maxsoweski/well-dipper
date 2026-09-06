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
 *
 * ⛔ ONE HALF OF THAT IS NOW WEAKER AND IT IS SAID HERE RATHER THAN BURIED.
 * chrome-and-ui-at-240p moved this overlay onto the world's pixel grid, so its
 * strings are bitmap texels and reach the context as anonymous `fillRect`s with
 * no string in them — a recording context cannot recover the words. The GEOMETRY
 * assertions still ask the context, exactly as before; the TEXT assertions read
 * `hud.getDrawnText()`, which is the class reporting on itself. See the note in
 * `draw()` for what holds that up and what the stronger version would cost.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { makeRecordingContext } from './helpers/headlessNav.mjs';
import { setRenderBuffer } from '../../rendering/renderBuffer.js';

const noop = () => {};
let SupercruiseHud;
let rec;

// The centre of the fixture's buffer, and the reticle marks that must land around it.
// ⭐ DERIVED HERE, NOT COPIED: every number below comes from BUF and the fixture's own
// deflection, so changing the buffer changes the expectations with it.
const BUF = { w: 1920, h: 1080 };
const CX = Math.round(BUF.w / 2), CY = Math.round(BUF.h / 2);
const JR = Math.min(BUF.w, BUF.h) * 0.25;

beforeAll(async () => {
  const canvas = { width: BUF.w, height: BUF.h, style: {}, addEventListener: noop };
  const made = makeRecordingContext(canvas);
  rec = made.rec;
  canvas.getContext = () => made.ctx;
  globalThis.document = {
    createElement: () => canvas,
    body: { appendChild: noop },
    addEventListener: noop,
  };
  globalThis.window = { devicePixelRatio: 1, addEventListener: noop };
  globalThis.innerWidth = BUF.w;
  globalThis.innerHeight = BUF.h;
  // ⭐ THE FIXTURE DECLARES ITS OWN BUFFER. Since chrome-and-ui-at-240p the HUD sizes its backing
  // store from RENDER_BUFFER rather than from the window, so without this the canvas would be
  // resized to whatever `bufferForLines` makes of a 1920x1080 window at the default line count and
  // every coordinate here would be a moving target. Setting it makes the geometry below exact.
  // ⚠ It is deliberately NOT a realistic 468x240: this file asks WHICH elements draw and WHERE
  // relative to centre, and a 1080-tall buffer keeps those two questions separable. Whether the
  // cluster still FITS at 240 rows is a live check (V3), not something a fixture can answer.
  setRenderBuffer(BUF.w, BUF.h, 1);
  ({ SupercruiseHud } = await import('../SupercruiseHud.js'));
});

/**
 * The reticle's own marks, and nothing else on the canvas.
 *
 * ⛔ IT HAS TO BE RETICLE-SPECIFIC, NOT "any fillRect". Since the overlay moved onto the world's
 * pixel grid EVERYTHING is a fillRect — the bars, the pins, the ticks, and every texel of every
 * glyph — so a naive count can never tell "the reticle is off" from "the numbers are on". These
 * two shapes are unique to it: a 3x3 block (the deflection dot; bars are 4 rows, pins 1 texel wide,
 * glyph texels 1x1) and a 4x1 bar (the horizontal cross arms).
 */
function reticleMarks(calls) {
  return calls.filter((c) => c.op === 'fillRect'
    && ((c.args[2] === 3 && c.args[3] === 3) || (c.args[2] === 4 && c.args[3] === 1)));
}

/** Did a fillRect land exactly here? */
function drewRect(calls, x, y, w, h) {
  return calls.some((c) => c.op === 'fillRect'
    && c.args[0] === x && c.args[1] === y && c.args[2] === w && c.args[3] === h);
}

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
  // ⚠ `rec.text` IS NOW ALWAYS EMPTY AND THAT IS NOT A BUG. `makeRecordingContext` fills it from
  // `fillText`/`strokeText` only, and this overlay draws its strings as bitmap texels — the words
  // reach the context as anonymous `fillRect` calls with no string in them. So the text half of
  // this file reads the class's own report.
  // ⛔ THIS IS WEAKER THAN WHAT IT REPLACES, AND THE HEADER ABOVE SAYS WHY THAT MATTERS: a class
  // self-report is exactly what this lane refuses elsewhere. Three things hold it up — the HUD has
  // ONE text path (a private wrapper, not a `push` beside each call), that path defaults to
  // `onMissing: 'throw'` so an unrenderable literal is loud, and the GEOMETRY assertions below
  // still ask the context. The strictly stronger option is decoding the strings back out of the
  // recorded fillRects through PixelText's glyph table; it is ~30 lines and nobody has paid for it.
  return hud.getDrawnText().join('\n');
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
    // Retiring the canvas wholesale would have taken both, and taking them
    // breaks aiming — AC-IT-FEELS-LIKE-FLYING-FROM-INSIDE's own subject.
    //
    // ⛔ EXACT GEOMETRY, NOT A CALL COUNT, and no colour filter is available to narrow it:
    // `makeRecordingContext`'s Proxy has `set() { return true; }`, so `fillStyle` is never
    // recorded. The coordinates are the discriminator instead.
    // ⭐ The cross is four opaque texel bars around a 3-texel hole, not a stroked path: a 1-px
    // stroke through the exact centre straddles it, so the mark the pilot aims with used to be
    // two grey half-rows. The hole is why the body being aimed at is never covered.
    const before = (() => { draw(fullState({ showReadouts: false })); return rec.calls.slice(); })();

    // deflection {0.1, -0.2} at jr = 270 → centre (987, 486) → a 3x3 block at its top-left.
    const dx = Math.round(CX + 0.1 * JR), dy = Math.round(CY + -0.2 * JR);
    expect(drewRect(before, dx - 1, dy - 1, 3, 3),
      'the deflection dot is gone — the stick has no aim indicator').toBe(true);

    expect(drewRect(before, CX + 3, CY, 4, 1), 'the cross has no right arm').toBe(true);
    expect(drewRect(before, CX - 6, CY, 4, 1), 'the cross has no left arm').toBe(true);
    expect(drewRect(before, CX, CY + 3, 1, 4), 'the cross has no lower arm').toBe(true);
    expect(drewRect(before, CX, CY - 6, 1, 4), 'the cross has no upper arm').toBe(true);

    // …and nothing was drawn ON the centre pixel, which is the point of the gap.
    expect(drewRect(before, CX, CY, 1, 1), 'the cross covers the thing being aimed at').toBe(false);
  });

  it('showReticle and showReadouts are INDEPENDENT gates', () => {
    // Free-look hides the reticle but (in ORRERY) keeps the numbers; HELM hides
    // the numbers but keeps the reticle. Neither may imply the other.
    const numbersKept = draw(fullState({ showReticle: false, showReadouts: true }));
    expect(numbersKept).toContain('MODE: MANUAL');
    expect(reticleMarks(rec.calls).length,
      'showReadouts must not resurrect the reticle').toBe(0);

    // Non-vacuity: the same probe must FIND the reticle when it is on, or the zero above is
    // a discriminator that has stopped discriminating.
    draw(fullState({ showReticle: true, showReadouts: true }));
    expect(reticleMarks(rec.calls).length,
      'the reticle probe finds nothing even with the reticle ON — it is vacuous')
      .toBeGreaterThan(0);
  });

  it('defaults to ON, so nothing that never passes the flag changes behaviour', () => {
    const drawn = draw(fullState({ showReadouts: undefined }));
    expect(drawn).toContain('MODE: MANUAL');
  });
});
