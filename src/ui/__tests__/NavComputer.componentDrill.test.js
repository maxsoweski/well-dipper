/**
 * Component drill-in state machine + render source — S5 of
 * multistar-components-2026-07-19 (AC5). Bare Object.create(NavComputer
 * .prototype) harness (glyphLabels pattern) with the extra scaffolding the
 * click path needs, enumerated per the build plan: _getCanvasPos stubbed to
 * return the click point verbatim (bypasses getBoundingClientRect),
 * _levelIndex=4, _autopilotButtonRect/_commitButtonRect null, seeded
 * _farChipRects and _systemData.componentSystems.
 *
 * The drill MECHANISM mirrors the planet-detail drill (mode + index + render
 * fn + ESC pop); the render is a SYSTEM-scale orrery over the component
 * payload (a component is a full system) — AC5's amended wording.
 */

import { describe, it, expect } from 'vitest';
import { NavComputer } from '../NavComputer.js';

// ── Stub 2D context: records arcs + texts so render assertions are real ──
function makeCtx() {
  const arcs = [];
  const texts = [];
  return {
    _arcs: arcs,
    _texts: texts,
    font: '', fillStyle: '', strokeStyle: '', lineWidth: 1, globalAlpha: 1, textAlign: 'left',
    measureText: (s) => ({ width: s.length * 6 }),
    beginPath() {}, arc(x, y, r) { arcs.push({ x, y, r }); }, fill() {},
    moveTo() {}, lineTo() {}, stroke() {}, closePath() {},
    setLineDash() {}, ellipse() {},
    createRadialGradient: () => ({ addColorStop() {} }),
    fillText(t, x, y) { texts.push({ t, x, y }); },
  };
}

// Component payload: Proxima with b/d at REAL archive orbits (payload-sourced —
// the render must draw THESE, never synthesized view-only values).
const PROXIMA_SYSTEM = () => ({
  star: { type: 'M', spectFull: 'M5.5Ve', color: [1, 0.8, 0.44], radiusSolar: 0.3 },
  planets: [
    { letter: 'd', name: 'Proxima Cen d', known: true, orbitRadiusAU: 0.02881, orbitAngle: 0.4,
      planetData: { type: 'rocky', radiusEarth: 0.692 }, moons: [] },
    { letter: 'b', name: 'Proxima Cen b', known: true, orbitRadiusAU: 0.04848, orbitAngle: 2.1,
      planetData: { type: 'terrestrial', radiusEarth: 1.02 }, moons: [] },
  ],
  zones: {},
});

const parentPayload = () => ({
  star: { type: 'G' }, star2: { type: 'K' }, isBinary: true, planets: [], zones: {},
  _knownSystemNames: { system: 'Alpha Centauri', star: 'Rigil Kentaurus', star2: 'Toliman' },
  farCompanions: [{ name: 'Proxima Centauri', class: 'M5.5Ve', type: 'M', separationAU: 13000 }],
  componentSystems: [{
    name: 'Proxima Centauri', class: 'M5.5Ve', type: 'M', separationAU: 13000,
    seed: 'alpha-centauri:component-0:x', systemData: PROXIMA_SYSTEM(),
  }],
});

const CHIP_RECT = { x: 300, y: 40, w: 80, h: 30 };
const CLICK_IN_CHIP = { x: 320, y: 50 };
const evt = (x, y) => ({ clientX: x, clientY: y, button: 0 });

// Bare harness with the click path's extra stubs (enumerated in the plan so
// the glyphLabels-reuse claim stays honest).
function drillNav({ systemData = parentPayload(), mode = 'system' } = {}) {
  const nav = Object.create(NavComputer.prototype);
  nav._anim = null;
  nav._systemZoomAnim = null;
  nav._canvas = { width: 400, height: 300 };
  nav._getCanvasPos = (e) => ({ x: e.clientX, y: e.clientY }); // click point verbatim
  nav._autopilotButtonRect = null;
  nav._levelIndex = 4;
  nav._systemMode = mode;
  nav._selectedComponentIdx = mode === 'component' ? 0 : -1;
  nav._pendingComponentSelect = null;
  nav._selectedPlanetIdx = -1;
  nav._commitButtonRect = null;
  nav._commitAction = null;
  nav._selectedBody = null;
  nav._hoveredBody = null;
  nav._localStars = [];
  nav._labelRects = [{ x: 1, y: 1, w: 5, h: 5, name: 'stale-prism-rect' }]; // must be replaced per frame
  nav._mouseX = -100;
  nav._mouseY = -100;
  nav._systemRotX = 0.5;
  nav._systemRotY = 0.0;
  nav._systemZoom = 1.0;
  // Player far from the browsed star → foreign system (info-only flavor).
  nav._playerX = 0; nav._playerY = 0; nav._playerZ = 0;
  nav._systemStar = { name: 'Rigil Kentaurus', wx: 8.000948, wy: 0.024984, wz: -0.000924, seed: 'x', spectral: 'G' };
  nav._systemData = systemData;
  nav._farChipRects = systemData
    ? [{ ...CHIP_RECT, chip: { name: 'Proxima Centauri' }, index: 0 }]
    : [];
  // Click == mousedown point → registers as a click, not a drag.
  nav._dragStartX = CLICK_IN_CHIP.x;
  nav._dragStartY = CLICK_IN_CHIP.y;
  nav._onSound = null;
  nav._onDrillSound = null;
  return nav;
}

describe('AC5 — entry (a): far-chip click', () => {
  it('far-chip click → component mode with the matching _selectedComponentIdx', () => {
    const nav = drillNav();
    nav._handleClick(evt(CLICK_IN_CHIP.x, CLICK_IN_CHIP.y));
    expect(nav._systemMode).toBe('component');
    expect(nav._selectedComponentIdx).toBe(0);
  });

  it('far-chip click on a system WITHOUT componentSystems does NOT drill (chip stays hover-only)', () => {
    const noComponents = parentPayload();
    delete noComponents.componentSystems;
    const nav = drillNav({ systemData: noComponents });
    // The chip rect is still published (farCompanions exist — hover/tooltip
    // behavior unchanged from today); only the drill is gated.
    nav._farChipRects = [{ ...CHIP_RECT, chip: { name: 'Proxima Centauri' }, index: 0 }];
    nav._handleClick(evt(CLICK_IN_CHIP.x, CLICK_IN_CHIP.y));
    expect(nav._systemMode).toBe('system');
    expect(nav._selectedComponentIdx).toBe(-1);
  });

  it('a click OUTSIDE the chip in system mode does not drill', () => {
    const nav = drillNav();
    nav._dragStartX = 150; nav._dragStartY = 150;
    nav._handleClick(evt(150, 150));
    expect(nav._systemMode).toBe('system');
  });
});

describe('AC5 — ESC pop + component-mode click return', () => {
  it('ESC in component mode pops to system (mode=system, idx=-1); a second ESC leaves level 4', () => {
    const nav = drillNav({ mode: 'component' });
    expect(nav.handleEscape()).toBe(true);
    expect(nav._systemMode).toBe('system');
    expect(nav._selectedComponentIdx).toBe(-1);
    expect(nav._levelIndex).toBe(4);        // first ESC stays in the SYSTEM view
    expect(nav.handleEscape()).toBe(true);
    expect(nav._levelIndex).toBe(3);        // second ESC → prism, unchanged behavior
  });

  it('component-mode click returns to system (info-only)', () => {
    const nav = drillNav({ mode: 'component' });
    nav._handleClick(evt(CLICK_IN_CHIP.x, CLICK_IN_CHIP.y));
    expect(nav._systemMode).toBe('system');
    expect(nav._selectedComponentIdx).toBe(-1);
  });
});

describe('AC5 — _renderComponentDetail render source', () => {
  it('reads orbits from the payload (same object, never synthesized) and sets no commit affordance', () => {
    const nav = drillNav({ mode: 'component' });
    nav._commitButtonRect = { x: 0, y: 0, w: 10, h: 10 }; // must be cleared by the view
    nav._renderComponentDetail(makeCtx(), 400, 300);
    // Payload-sourced BY IDENTITY: the view renders the exact componentSystems
    // payload object — the strongest "not synthesized" form.
    expect(nav._componentView.systemData).toBe(nav._systemData.componentSystems[0].systemData);
    expect(nav._componentView.systemData.planets.map((p) => p.orbitRadiusAU))
      .toEqual([0.02881, 0.04848]);
    expect(nav._commitButtonRect).toBeNull();
  });

  it('b and d markers are present in the drilled view (structure list = payload planets)', () => {
    const nav = drillNav({ mode: 'component' });
    const ctx = makeCtx();
    nav._renderComponentDetail(ctx, 400, 300);
    const drawn = ctx._texts.map((t) => t.t);
    expect(drawn).toContain('Proxima Cen d');
    expect(drawn).toContain('Proxima Cen b');
    // Grammar clauses drawn: title (1), annotation (3), breadcrumb (4), footer.
    expect(drawn).toContain('Alpha Centauri');
    expect(drawn).toContain('via Proxima Centauri — far companion');
    expect(drawn).toContain('part of Alpha Centauri');
    expect(drawn.some((t) => /VIEW ONLY/.test(t))).toBe(true);
    // Star + 2 planet bodies drawn as arcs (glow + bodies ≥ 3 arcs).
    expect(ctx._arcs.length).toBeGreaterThanOrEqual(3);
  });

  it('publishes its OWN label rects to _labelRects (cleared per frame, one rect per drawn planet label)', () => {
    const nav = drillNav({ mode: 'component' });
    nav._renderComponentDetail(makeCtx(), 400, 300);
    // The stale prism rect is gone; exactly one rect per planet label, so the
    // AC6 live non-overlap assertion measures THIS view (fable M2).
    expect(nav._labelRects.some((r) => r.name === 'stale-prism-rect')).toBe(false);
    expect(nav._labelRects).toHaveLength(2);
    for (const r of nav._labelRects) {
      expect(r.w).toBeGreaterThan(0);
      expect(r.h).toBeGreaterThan(0);
    }
  });

  it('degrades safely when the payload is missing (procgen / stale idx): pops back to system, no throw', () => {
    const nav = drillNav({ mode: 'component' });
    nav._selectedComponentIdx = 9; // stale index → no payload
    nav._renderComponentDetail(makeCtx(), 400, 300);
    expect(nav._systemMode).toBe('system');
    expect(nav._selectedComponentIdx).toBe(-1);
  });
});
