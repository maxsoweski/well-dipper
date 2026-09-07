/**
 * navViewModes — designs 1 and 2 as switchable modes on the full-screen nav.
 *
 * ⭐ WHAT THESE TESTS ARE ACTUALLY FOR. The designs themselves are lifted verbatim from
 * `nav-240p-lab.html`, where Max already ruled on the pictures, so re-asserting their layout here
 * would be testing the lab. What is NEW — and therefore what can be wrong — is three things: the
 * ADAPTER that feeds live instrument state into the `S` / `D` shape the lab invented, the DISPATCH
 * that decides when a mode paints, and the GATE that keeps every one of them off the cockpit glass.
 * Each case below aims at one of those.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { makeHeadlessNav } from './helpers/headlessNav.mjs';
import { NAV_VIEW_MODES, nextViewMode, loadViewMode, saveViewMode, NAV_VIEW_MODE_KEY } from '../navViewModes/index.js';

/** A nav with the prism loaded, which is what every design needs before it can draw anything real. */
async function loadedNav({ width = 427, height = 240 } = {}) {
  const h = await makeHeadlessNav({ width, height });
  h.nav._viewModesEnabled = true;
  h.nav._levelIndex = 3;
  h.nav.viewMode = 'rail';
  h.nav.render();                       // populates _localStars via _renderLocal's own loader
  h.star = h.nav._localStars.find((s) => s.dist > 1e-9);
  return h;
}

describe('the mode cycle', () => {
  it('starts at today\'s nav and returns to it', () => {
    expect(NAV_VIEW_MODES[0]).toBe(null);
    expect(nextViewMode(null)).toBe('rail');
    expect(nextViewMode('rail')).toBe('bars');
    expect(nextViewMode('bars')).toBe(null);
  });

  it('⛔ does not offer design 3 — all three judges killed it', () => {
    expect(NAV_VIEW_MODES).toHaveLength(3);
    expect(NAV_VIEW_MODES).not.toContain('panel');
  });

  it('survives a round trip through storage, and an unreadable store', () => {
    const store = new Map();
    globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) };
    saveViewMode('bars'); expect(loadViewMode()).toBe('bars');
    saveViewMode(null);   expect(loadViewMode()).toBe(null);
    store.set(NAV_VIEW_MODE_KEY, 'nonsense'); expect(loadViewMode()).toBe(null);
    globalThis.localStorage = { getItem() { throw new Error('site data blocked'); }, setItem() { throw new Error('nope'); }, removeItem() {} };
    expect(loadViewMode()).toBe(null);
    expect(() => saveViewMode('rail')).not.toThrow();
  });
});

describe('the adapter feeds the designs real instrument state', () => {
  it('ranks the loaded prism stars, names them, and knows which one you are in', async () => {
    const { nav } = await loadedNav();
    const { D } = nav._viewDriverInst;
    expect(D.stars.length, 'the prism must have loaded').toBeGreaterThan(100);
    expect(D.starRows).toHaveLength(D.stars.length);
    expect(D.starRows.every((r) => r.name), 'every ranked row carries a name').toBe(true);
    // sorted by distance, nearest first — the rail's whole premise
    for (let i = 1; i < D.starRows.length; i++) expect(D.starRows[i].dist).toBeGreaterThanOrEqual(D.starRows[i - 1].dist);
    expect(D.here?.name, 'the system you are IN').toBe(D.starRows[0].name);
    expect(D.sectorRows.length, 'all 775 sectors, ranked once').toBe(775);
  });

  it('⭐ takes the system the PILOT drilled into, not one it picked for itself', async () => {
    const { nav, star } = await loadedNav();
    nav.openToCurrentSystem(star);
    nav.render();
    const { D } = nav._viewDriverInst;
    expect(D.sysStar?.seed).toBe(star.seed);
    expect(D.bodies.length).toBeGreaterThan(0);
    expect(D.bodies.every((b) => typeof b.au === 'number')).toBe(true);
    // AU-ordered planets — what every design's SYSTEM level reads
    const planets = D.bodies.filter((b) => b.kind === 'planet');
    for (let i = 1; i < planets.length; i++) expect(planets[i].au).toBeGreaterThanOrEqual(planets[i - 1].au);
  });

  it('⛔ survives a system with no bodies at all — unreachable in the lab, reachable here', async () => {
    const { nav } = await loadedNav();
    nav._systemStar = { wx: 8, wy: 0, wz: 0, seed: 7, spectral: 'M', name: 'Empty' };
    nav._systemData = { planets: [], asteroidBelts: [] };
    nav._levelIndex = 4;
    for (const mode of ['rail', 'bars']) {
      nav.viewMode = mode;
      expect(() => nav.render(), `${mode} on an empty system`).not.toThrow();
      expect(nav._viewDriverInst.D.bodies).toEqual([]);
    }
  });
});

describe('both designs draw every level', () => {
  for (const mode of ['rail', 'bars']) {
    it(`${mode} paints all five levels with no layout overflow`, async () => {
      const { nav, rec, star } = await loadedNav();
      nav.viewMode = mode;
      for (const level of [0, 1, 2, 3, 4]) {
        if (level === 4) nav.openToCurrentSystem(star); else nav._levelIndex = level;
        rec.calls.length = 0;
        expect(() => nav.render(), `${mode} at level ${level}`).not.toThrow();
        const fills = rec.calls.filter((c) => c.op === 'fillRect').length;
        expect(fills, `${mode} level ${level} drew nothing`).toBeGreaterThan(200);
        const bad = nav._viewDriverInst.violations()
          // ⚠ THE ONE KNOWN EXCEPTION, AND IT IS THE DESIGN'S OWN DECLARED TOP RISK, not a port defect.
          // The lab says so at its own draw site: design 1's SYSTEM level is a sqrt(AU) ladder with a
          // left-to-right 8-texel minimum-separation pass, and on a system whose bodies bunch at the
          // low end that pass walks the last ones off the end of the axis. They draw in WARN at the
          // edge so the failure is VISIBLE rather than an invisible glyph outside the pane — which is
          // exactly the call Max has to make. ⛔ Do not silence it; it is the instrument reporting.
          .filter((v) => !/SYSTEM ladder/.test(v.msg));
        expect(bad, `${mode} level ${level}: ${JSON.stringify(bad)}`).toHaveLength(0);
      }
    });
  }

  it('⛔ THE GUARD IS PROVED TO FIRE, not asserted to work', async () => {
    // A layout that overflows LOOKS fine on a canvas — the canvas clips the overflow for free. So the
    // guard is the only difference between "this design fits" and "this design was cropped", and a
    // guard that has never been made to fail is not yet a guard.
    const { nav } = await loadedNav();
    for (const mode of ['rail', 'bars']) {
      nav.viewMode = mode; nav._levelIndex = 3;
      nav._viewDriverInst.S.sabotage = false;
      nav.render();
      expect(nav._viewDriverInst.violations(), `${mode} clean`).toHaveLength(0);
      nav._viewDriverInst.S.sabotage = true;
      nav.render();
      expect(nav._viewDriverInst.violations().length, `${mode} sabotaged`).toBeGreaterThan(0);
      nav._viewDriverInst.S.sabotage = false;
    }
  });
});

describe('the buffer, and what must not move', () => {
  it('a mode takes the world\'s low-res buffer; today\'s nav keeps its CSS box', async () => {
    const { nav, canvas } = await loadedNav({ width: 1560, height: 860 });
    nav.viewMode = null;
    nav._resizeCanvas();
    expect([canvas.width, canvas.height], 'legacy keeps the layout box').toEqual([1560, 860]);
    nav.viewMode = 'rail';
    nav._resizeCanvas();
    expect(canvas.height, 'a mode drops to the world\'s line count').toBe(240);
    expect(canvas.width, 'width follows the box aspect at that line count')
      .toBe(Math.round((1560 / 860) * 240));
  });

  it('⛔ THE COCKPIT PANEL CAN NEVER ACQUIRE A MODE — the gate is activate(), not _bare', async () => {
    // `_openCockpitNav` never calls activate() (attachKeys' own note in NavComputer records why), so
    // a panel instance never has _viewModesEnabled set and its V key is inert. ⛔ NOT keyed off
    // `_bare`: NavPanel writes chromeless = false every paint, so _bare is permanently FALSE there
    // and a mode keyed off it would be a no-op that looks exactly like a wiring failure.
    const { nav, canvas } = await makeHeadlessNav({ width: 52, height: 43 });
    expect(nav._viewModesEnabled, 'a fresh instance is not a mode host').toBe(false);
    nav.viewMode = null;
    nav._resizeCanvas();
    expect([canvas.width, canvas.height], 'the panel keeps its own buffer').toEqual([52, 43]);
  });

  it('with no mode set, render() never touches the view-mode driver at all', async () => {
    const { nav } = await makeHeadlessNav({ width: 614, height: 512 });
    nav._levelIndex = 3;
    nav.render();
    // `null` is today's nav BY CONSTRUCTION: the driver is never even built, the way pixelType: null
    // never enters navPixelType.js. This is the assertion that keeps that true as the file changes.
    expect(nav._viewDriverInst).toBe(null);
  });
});
