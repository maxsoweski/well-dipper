/**
 * The GAME's half of the pointer wiring — that it asks the router, and WHEN.
 *
 * Increment 7, `cockpit-into-helm-2026-07-30`, step 6. Supports
 * AC-A-QUICK-CLICK-IS-ENOUGH, AC-ZOOM-AND-WORK-THE-MENU-IN-GAME and
 * AC-FLIGHT-AND-ORRERY-SURVIVE.
 *
 * ── WHY THIS IS A SOURCE SCAN AND NOT A DRIVEN TEST ─────────────────────────
 *
 * The router itself is covered by real behaviour in `CockpitRig.test.js` — it is
 * a small class with injectable everything. What is NOT coverable that way is
 * `src/main.js`: 11k lines that construct a WebGL renderer, a GLTF loader, an
 * audio engine and a galaxy at module scope. There is no import of it in this
 * suite and adding one would be a bigger change than the feature.
 *
 * So this asserts the part that a source scan CAN settle, which happens to be
 * the part most likely to break: the ORDER. Every branch in the three handlers
 * assumes the press is aimed at the WORLD. A press aimed at a monitor 0.17 m
 * from the eye is not, and the four things that would otherwise eat it — the
 * minimap drag, the free-look head grab, the autopilot-click latch, and
 * `trySelect` at the bottom of mouseup — are each a silent, plausible wrong
 * behaviour rather than an error. A later edit that moves the router hook down
 * past any of them reintroduces one, and nothing else in the suite would notice.
 *
 * The hover hook is the sharpest case. The moves that make a quick click work
 * are the UNPRESSED ones, and both the freelook branch and the joystick branch
 * `return` — so a hook placed below them is starved exactly when the pilot is
 * flying, which is the only time it matters. That is the increment 6 UAT defect,
 * arriving by a different door.
 *
 * ⚠ This does not prove the click works. It proves the game asks. The product
 * question — does a planet drill in — is live, and is the AC's own observable.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const SRC = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../main.js'), 'utf8');

/** Index of a literal, asserted to exist so a rename fails loudly, not silently. */
function at(needle, from = 0) {
  const i = SRC.indexOf(needle, from);
  expect(i, `src/main.js no longer contains \`${needle}\` — this scan is stale, not passing`).toBeGreaterThan(-1);
  return i;
}

describe('main.js hands the pointer to the cockpit router first', () => {
  it('CONTROL: `at()` fails on a needle that is not there', () => {
    // Without this every ordering assertion below could pass on -1 < -1 === false
    // ... or worse, on two -1s comparing equal. A scan whose locator cannot fail
    // is the "test that could not fail" this program keeps naming.
    expect(() => at('_thisIdentifierDoesNotExistInMainJs')).toThrow();
  });

  describe('mousedown', () => {
    const start = at("canvas.addEventListener('mousedown'");
    const router = at('_cockpitRig.pointer.down(', start);

    it('asks the router before the minimap drag can claim the press', () => {
      expect(router).toBeLessThan(at('minimapVisible && !gravityWellVisible', start));
    });

    it('asks before the free-look head grab, or a drag on the map swings the view', () => {
      expect(router).toBeLessThan(at('scHead.beginLook();', start));
    });

    it('asks before the autopilot-click latch, which mouseup would then act on', () => {
      expect(router).toBeLessThan(at('_autopilotClickPending = e.button === 0', start));
    });

    it('returns on anything but `none`, so a consumed press reaches nothing below', () => {
      const hook = SRC.slice(router - 300, router + 300);
      expect(hook).toContain("if (used !== 'none') {");
      expect(hook).toContain('_cockpitPressUsed = used;');
      expect(hook).toMatch(/_cockpitPressUsed = used;[\s\S]{0,200}?return;/);
    });
  });

  describe('mousemove — the hover channel', () => {
    const start = at("canvas.addEventListener('mousemove'");
    const hook = at('_cockpitRig.pointer.move(', start);

    it('forwards the move before the freelook branch, which returns', () => {
      expect(hook).toBeLessThan(at('if (scHead.held) {', start));
    });

    it('forwards the move before the joystick branch, which also returns', () => {
      expect(hook).toBeLessThan(at('if (_scManual && !scHead.held && !freeLook.latched) {', start));
    });

    it('is NOT gated on a button being down — that gate IS the defect', () => {
      const line = SRC.slice(SRC.lastIndexOf('\n', hook) + 1, SRC.indexOf('\n', hook));
      expect(line).not.toMatch(/e\.buttons|_mouseDown|panelDrag|button === 0/);
      expect(line).toContain('_cockpitPointerActive()');
    });
  });

  describe('mouseup', () => {
    it('the canvas handler releases and RETURNS before trySelect can re-target', () => {
      const start = at("canvas.addEventListener('mouseup'");
      const release = at('if (_cockpitPressUsed) {', start);
      expect(release).toBeLessThan(at('trySelect(e.clientX, e.clientY);', start));
      expect(SRC.slice(release, release + 200)).toMatch(/_releaseCockpitPress\([\s\S]{0,80}?return;/);
    });

    it('the window handler carries the off-canvas safety net', () => {
      const start = at("window.addEventListener('mouseup'");
      const release = at('_releaseCockpitPress(', start);
      expect(release).toBeLessThan(at('_minimapDragging = false;', start));
    });

    it('the release is latched, so calling it twice is not two releases', () => {
      const fn = SRC.slice(at('function _releaseCockpitPress('), at('/** Probe surface'));
      expect(fn).toContain('if (!_cockpitPressUsed) return;');
      expect(fn).toMatch(/_cockpitPressUsed = null;[\s\S]*?pointer\.up\(/);
    });
  });

  describe('the gate', () => {
    const gate = SRC.slice(at('function _cockpitPointerActive()'), at('let _cockpitPressUsed'));

    it('is cursor-visible HELM — the cursor half is what keeps the flight stick working', () => {
      // In HELM hands-on the OS cursor is hidden because the mouse IS the stick:
      // its offset from screen centre is the turn command. Routing there would
      // poke a panel on every steer, and there is no pointer to aim with.
      expect(gate).toContain("_pointerCursor !== 'none'");
      expect(gate).toContain('_cockpitShouldRender()');
    });

    it('refuses while the DOM overlay is open, so one gesture cannot drive both instances', () => {
      expect(gate).toContain('!_navComputerOpen');
    });

    it('refuses on the splash and the title screen', () => {
      expect(gate).toContain('!splashActive');
      expect(gate).toContain('!titleScreenActive');
    });
  });

  describe('the rest of the wiring', () => {
    it('hands the rig the game\'s look-drag state, or hover fires mid-look', () => {
      const opts = SRC.slice(at('CockpitRig.load({'), at('}).then((rig) => {'));
      expect(opts).toContain('isLookDragging: () => scHead.held,');
    });

    it('ESC dismisses a zoomed panel, and does it before the overlay branch', () => {
      const esc = at("if (e.code === 'Escape') {");
      const dismiss = at('_cockpitRig.pointer.dismiss();', esc);
      expect(dismiss).toBeLessThan(at('if (_navComputerOpen) {', esc));
      // Guarded on something actually being zoomed, or ESC would swallow the
      // deselect and every overlay below it whenever nothing was at the eye.
      const guard = at('_cockpitRig.mover.zoomedRole', esc);
      expect(guard).toBeLessThan(dismiss);
      // NAV leaves through closeNavComputer — a bare dismiss would retract the
      // panel silently and drop a COMMIT the pilot had already pressed.
      const navRoute = at('if (_cockpitNavZoomed()) closeNavComputer();', esc);
      expect(navRoute).toBeGreaterThan(guard);
      expect(navRoute).toBeLessThan(dismiss);
    });

    it('the probe reports the census, so a live check reads the receiver not the caller', () => {
      const probe = SRC.slice(at('window._cockpit = () =>'), at('// When the tour visits every body'));
      expect(probe).toContain('_cockpitRig.pointer.census');
    });
  });
});
