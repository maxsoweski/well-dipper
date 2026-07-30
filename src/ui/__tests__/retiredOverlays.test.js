/**
 * AC-ORRERY-KEEPS-WHAT-IT-OPERATES + AC-OVERLAYS-RETIRE-IN-HELM — the two DOM
 * surfaces the cockpit replaces.
 *
 *   BodyInfo         retires in HELM (the INFO panel is its replacement),
 *                    STAYS in ORRERY, which has no cockpit to host anything.
 *   FlightModeToast  retires in HELM (the DRIVE panel shows MODE persistently,
 *                    which is strictly more than a 1.6 s flash).
 *
 * Both are gated INSIDE the class rather than at main.js's eleven `show*` call
 * sites, because a gate repeated eleven times is a gate that gets forgotten
 * once. These build the real classes over a stub element and ask what they did.
 */
import { describe, it, expect, beforeEach } from 'vitest';

const noop = () => {};

/** A #body-info / #flight-mode-toast stand-in that records display changes. */
function makeEl() {
  const el = {
    style: { display: '' },
    textContent: '',
    offsetWidth: 1,
    classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
    appendChild: noop,
    removeChild: noop,
    querySelector: () => makeEl(),
  };
  return el;
}

let el;
beforeEach(() => {
  el = makeEl();
  globalThis.document = {
    getElementById: () => el,
    createElement: () => makeEl(),
    body: { appendChild: noop },
  };
});

describe('BodyInfo.setSuppressed — retired in HELM', () => {
  it('CONTROL: unsuppressed, a show actually reaches the element', () => {
    // Without this the absence below proves nothing.
    return import('../BodyInfo.js').then(({ BodyInfo }) => {
      const b = new BodyInfo();
      el.style.display = 'none';
      b.showStar({ type: 'G' }, 'Sol');
      expect(el.style.display, 'the readout never came up at all').not.toBe('none');
    });
  });

  it('suppressed, every public show* is a no-op', async () => {
    const { BodyInfo } = await import('../BodyInfo.js');
    const b = new BodyInfo();
    b.setSuppressed(true);
    el.style.display = 'none';
    b.showStar({ type: 'G' }, 'Sol');
    b.showPlanet({ type: 'rocky' }, 0, 'Rock');
    b.showMoon({ type: 'icy' }, 0, 0, 'Moon');
    b.showWarpTarget('Somewhere');
    expect(el.style.display, 'a show* got past the gate').toBe('none');
  });

  it('suppressing HIDES what is already up — a half-typed readout must not freeze', async () => {
    const { BodyInfo } = await import('../BodyInfo.js');
    const b = new BodyInfo();
    b.showStar({ type: 'G' }, 'Sol');
    expect(el.style.display).not.toBe('none');
    b.setSuppressed(true);       // regime flips mid-typewriter
    expect(el.style.display).toBe('none');
  });

  it('un-suppressing restores the surface for ORRERY', async () => {
    const { BodyInfo } = await import('../BodyInfo.js');
    const b = new BodyInfo();
    b.setSuppressed(true);
    b.setSuppressed(false);
    el.style.display = 'none';
    b.showStar({ type: 'G' }, 'Sol');
    expect(el.style.display, 'ORRERY lost its body readout').not.toBe('none');
  });
});

describe('FlightModeToast.setSuppressed — retired in HELM', () => {
  it('CONTROL: unsuppressed it shows', async () => {
    const { FlightModeToast } = await import('../FlightModeToast.js');
    const t = new FlightModeToast();
    el.style.display = 'none';
    t.show('Flight ON — Manual', 'hint');
    expect(el.style.display).toBe('block');
  });

  it('suppressed it does not', async () => {
    const { FlightModeToast } = await import('../FlightModeToast.js');
    const t = new FlightModeToast();
    t.setSuppressed(true);
    el.style.display = 'none';
    t.show('Flight ON — Manual', 'hint');
    expect(el.style.display).toBe('none');
  });

  it('"Flight OFF" still shows, because it fires AFTER the regime flips', async () => {
    // The asymmetry is deliberate: `_exitFlightInternal` calls setScManual(false)
    // before the toast, so by then the surface is un-suppressed. You are told you
    // left the cockpit; you are not told you are in one by a banner over the
    // panel that already says so.
    const { FlightModeToast } = await import('../FlightModeToast.js');
    const t = new FlightModeToast();
    t.setSuppressed(true);     // in HELM
    t.setSuppressed(false);    // setScManual(false) ran first
    el.style.display = 'none';
    t.show('Flight OFF', '');
    expect(el.style.display).toBe('block');
  });
});
