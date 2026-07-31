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
    innerHTML: '',
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

/**
 * A focused planet with the three physics blocks the debug HUD prints as
 * COMP / ATMO / TIDAL — the same three the cockpit's INFO panel now shows
 * (InfoReadout.js:217-219), which is what makes them a duplication in HELM.
 */
function focusedPlanetSystem() {
  return {
    star: null,
    planets: [{
      planet: {
        data: { type: 'terrestrial' },
        currentLOD: 2,
        physics: {
          composition: { surfaceType: 'silicate', ironFraction: 0.31 },
          atmosphere: { retained: true },
          tidalState: { locked: true, lockType: 'synchronous' },
          surfaceHistory: { bombardmentIntensity: 0.4, erosionLevel: 0.2 },
        },
      },
      moons: [],
    }],
  };
}

describe('DebugPanel.setSurveySuppressed — the three dossier rows, retired in HELM', () => {
  /**
   * ⚠ THIS IS A NARROWER GATE THAN ITS TWO NEIGHBOURS, AND DELIBERATELY SO.
   *
   * BodyInfo and FlightModeToast retire WHOLE. #debug-hud must not: it is a
   * developer instrument (FPS, LOD, galactic potential, star evolution) and
   * those rows have no replacement anywhere. Only COMP / ATMO / TIDAL are
   * duplicated by the cockpit's INFO panel, and only those three go.
   *
   * ⚠ AND IT IS A GATE, NOT A DELETION, for a reason the first reading of this
   * missed: there is no INFO panel in ORRERY at all, and none in HELM when the
   * GLB fails to load (`_cockpitShouldRender()`, main.js:2701). Deleting the
   * rows would strip the diagnostic in both of those states, where nothing
   * replaces it. Suppression by regime is what every other step-8 retirement
   * does and it restores on the way out.
   */
  it('CONTROL: unsuppressed in ORRERY, the three rows reach the element', async () => {
    const { DebugPanel } = await import('../DebugPanel.js');
    const d = new DebugPanel();
    d.setSystem(focusedPlanetSystem(), {});
    d.setFocus(0, -1);
    d.toggleHUD();
    d.update(0);
    for (const label of ['COMP', 'ATMO', 'TIDAL']) {
      expect(el.innerHTML, `${label} never drew at all`).toContain(`>${label}<`);
    }
  });

  it('suppressed, the three go and the developer rows stay', async () => {
    const { DebugPanel } = await import('../DebugPanel.js');
    const d = new DebugPanel();
    d.setSystem(focusedPlanetSystem(), {});
    d.setFocus(0, -1);
    d.setSurveySuppressed(true);
    d.toggleHUD();
    d.update(0);

    for (const label of ['COMP', 'ATMO', 'TIDAL']) {
      expect(el.innerHTML, `${label} got past the gate`).not.toContain(`>${label}<`);
    }
    // The half that makes this a gate rather than a blanking. SURF and FOCUS sit
    // in the same `if (planet.physics)` neighbourhood and have NO cockpit
    // equivalent — InfoReadout.js:190-206 excludes surfaceHistory by name — so a
    // gate that swallowed them would be a deletion wearing a gate's clothes.
    for (const label of ['FPS', 'FOCUS', 'SURF']) {
      expect(el.innerHTML, `the gate took ${label}, which nothing replaces`).toContain(`>${label}<`);
    }
  });

  it('un-suppressing restores them for ORRERY', async () => {
    const { DebugPanel } = await import('../DebugPanel.js');
    const d = new DebugPanel();
    d.setSystem(focusedPlanetSystem(), {});
    d.setFocus(0, -1);
    d.setSurveySuppressed(true);
    d.setSurveySuppressed(false);
    d.toggleHUD();
    d.update(0);
    expect(el.innerHTML, 'ORRERY lost a dossier row it has no cockpit to replace').toContain('>COMP<');
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
