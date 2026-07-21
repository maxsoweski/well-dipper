/**
 * BN2 — NavComputer component-view WARP commit affordance + component-name
 * commit plumbing (multistar-component-travel-2026-07-21, AC1).
 *
 * The component drill-in view was VIEW ONLY under Increment A (multistar-
 * components-2026-07-19 AC5). AC1's interview ruling supersedes that: the
 * drilled component is warp-ADDRESSABLE — [ WARP ] commits arrival at THAT
 * component. The arrival address rides the NAME channel (action.star.name →
 * warpTarget.name → arrival-resolver displayName): the only nav→arrival
 * channel main.js's dispatchNavAction whitelist copy preserves. The
 * `component: true` action flag is the opt-in component-resolution marker
 * (BN1's explicit resolver parameter's action-side twin); main.js drops it
 * harmlessly today — GB7 threads it through the mid-warp stash post-lane-B.
 *
 * Load-bearing case pinned here: the FAR-CHIP entry path leaves _systemStar
 * as the SYSTEM marker, so without _buildCommitAction reading the drilled
 * component, its commit name is the parent's — and dedup-absorbed siblings
 * (HD 156026, Zet-2 Ret) have NO PRISM marker, so the far chip is their ONLY
 * entry point.
 *
 * Harness: bare Object.create(NavComputer.prototype) with the click-path
 * scaffolding enumerated in NavComputer.componentDrill.test.js (same dir).
 */

import { describe, it, expect } from 'vitest';
import { NavComputer } from '../NavComputer.js';

// ── Stub 2D context: records texts so affordance assertions are real ──
function makeCtx() {
  const arcs = [];
  const texts = [];
  const rects = [];
  return {
    _arcs: arcs,
    _texts: texts,
    _rects: rects,
    font: '', fillStyle: '', strokeStyle: '', lineWidth: 1, globalAlpha: 1, textAlign: 'left',
    measureText: (s) => ({ width: s.length * 6 }),
    beginPath() {}, arc(x, y, r) { arcs.push({ x, y, r }); }, fill() {},
    moveTo() {}, lineTo() {}, stroke() {}, closePath() {},
    setLineDash() {}, ellipse() {}, roundRect() {},
    fillRect(x, y, w, h) { rects.push({ x, y, w, h }); },
    strokeRect() {}, save() {}, restore() {},
    translate() {}, rotate() {}, quadraticCurveTo() {},
    createRadialGradient: () => ({ addColorStop() {} }),
    createLinearGradient: () => ({ addColorStop() {} }),
    fillText(t, x, y) { texts.push({ t, x, y }); },
  };
}

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

// Alpha Cen shape: A+B binary parent + Proxima as componentSystems[0].
const alphaCenPayload = () => ({
  star: { type: 'G' }, star2: { type: 'K' }, isBinary: true, planets: [], zones: {},
  _knownSystemNames: { system: 'Alpha Centauri', star: 'Rigil Kentaurus', star2: 'Toliman' },
  farCompanions: [{ name: 'Proxima Centauri', class: 'M5.5Ve', type: 'M', separationAU: 13000 }],
  componentSystems: [{
    name: 'Proxima Centauri', class: 'M5.5Ve', type: 'M', separationAU: 13000,
    seed: 'alpha-centauri:component-0:x', systemData: PROXIMA_SYSTEM(),
  }],
});

// Guniibuu (36 Oph) shape: the component (HD 156026) was dedup-absorbed at
// catalog regen — NO PRISM marker exists for it; the far chip is the ONLY
// entry. This is the load-bearing far-chip case.
const guniibuuPayload = () => ({
  star: { type: 'K' }, planets: [], zones: {},
  _knownSystemNames: { system: 'Guniibuu', star: 'Guniibuu' },
  farCompanions: [{ name: 'HD 156026', class: 'K5V', type: 'K', separationAU: 4400 }],
  componentSystems: [{
    name: 'HD 156026', class: 'K5V', type: 'K', separationAU: 4400,
    seed: 'guniibuu:component-0:x',
    systemData: { star: { type: 'K', radiusSolar: 0.6, color: [1, 0.7, 0.4] }, planets: [], zones: {} },
  }],
});

// Procgen shape: no componentSystems, no farCompanions (AC9 byte-exact guard).
const procgenPayload = () => ({
  star: { type: 'G' }, planets: [], zones: {},
});

const RIGIL_MARKER = () => ({
  name: 'Rigil Kentaurus', wx: 8.000948, wy: 0.024984, wz: -0.000924, seed: 'x', spectral: 'G',
});
const PROXIMA_MARKER = () => ({
  name: 'Proxima Centauri', wx: 8.000902, wy: 0.024956, wz: -0.000937, seed: 'x', spectral: 'M',
});

const CHIP_RECT = { x: 300, y: 40, w: 80, h: 30 };
const CLICK_IN_CHIP = { x: 320, y: 50 };
const evt = (x, y) => ({ clientX: x, clientY: y, button: 0 });

// Canvas 400x300 → drawH 250 → commit button rect {x:110, y:198, w:180, h:28}
// (the system view's geometry, mirrored by the component view).
const BTN_CENTER = { x: 200, y: 212 };
const OUTSIDE_BTN = { x: 150, y: 120 };

function commitNav({
  systemData = alphaCenPayload(),
  mode = 'system',
  systemStar = RIGIL_MARKER(),
  playerAtStar = false,
  chipName = 'Proxima Centauri',
} = {}) {
  const nav = Object.create(NavComputer.prototype);
  nav._anim = null;
  nav._systemZoomAnim = null;
  nav._canvas = { width: 400, height: 300 };
  nav._getCanvasPos = (e) => ({ x: e.clientX, y: e.clientY });
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
  nav._labelRects = [];
  nav._mouseX = -100;
  nav._mouseY = -100;
  nav._systemRotX = 0.5;
  nav._systemRotY = 0.0;
  nav._systemZoom = 1.0;
  nav._currentFocusIndex = -1;
  nav._currentMoonIndex = -1;
  nav._systemStar = systemStar;
  // playerAtStar → _isCurrentSystem() true (dist 0 < POSITION_MATCH_TOL);
  // else player far away → foreign system (warp flavor).
  nav._playerX = playerAtStar ? systemStar.wx : 0;
  nav._playerY = playerAtStar ? systemStar.wy : 0;
  nav._playerZ = playerAtStar ? systemStar.wz : 0;
  nav._systemData = systemData;
  nav._farChipRects = systemData?.farCompanions
    ? [{ ...CHIP_RECT, chip: { name: chipName }, index: 0 }]
    : [];
  nav._dragStartX = 0;
  nav._dragStartY = 0;
  nav._onSound = null;
  nav._onDrillSound = null;
  nav._onCommit = null;
  return nav;
}

// Click helper that satisfies the drag guard (start == click point).
function click(nav, pt) {
  nav._dragStartX = pt.x;
  nav._dragStartY = pt.y;
  nav._handleClick(evt(pt.x, pt.y));
}

const LEGACY_ACTION_KEYS = ['moonIndex', 'planetIndex', 'star', 'starIndex', 'target', 'type'];
const LEGACY_STAR_KEYS = ['name', 'seed', 'spectral', 'wx', 'wy', 'wz'];

describe('BN2 — component drill-in view exposes the WARP commit affordance (AC1)', () => {
  it('foreign drilled component view publishes a non-null commit rect + armed warp action', () => {
    const nav = commitNav({ mode: 'component' });
    const ctx = makeCtx();
    nav._renderComponentDetail(ctx, 400, 300);
    expect(nav._commitButtonRect).not.toBeNull();
    expect(nav._commitAction).toBeTruthy();
    expect(nav._commitAction.type).toBe('warp');
    expect(nav._commitAction.target).toBe('star');
    // The [ WARP ] button is actually drawn, and the view no longer claims
    // VIEW ONLY (superseded by this workstream's AC1 ruling).
    const drawn = ctx._texts.map((t) => t.t);
    expect(drawn).toContain('[ WARP ]');
    expect(drawn.some((t) => /VIEW ONLY/.test(t))).toBe(false);
  });

  it('the commit rect matches the drawn button geometry (system-view placement)', () => {
    const nav = commitNav({ mode: 'component' });
    nav._renderComponentDetail(makeCtx(), 400, 300);
    expect(nav._commitButtonRect).toEqual({ x: 110, y: 198, w: 180, h: 28 });
  });

  it('current-system drilled view has NO commit affordance (inter-component BURN is GB2, lane-B-gated)', () => {
    const nav = commitNav({ mode: 'component', playerAtStar: true });
    const ctx = makeCtx();
    nav._renderComponentDetail(ctx, 400, 300);
    expect(nav._commitButtonRect).toBeNull();
    expect(nav._commitAction).toBeNull();
    // Still honestly view-only until GB2 delivers the BURN leg.
    const drawn = ctx._texts.map((t) => t.t);
    expect(drawn.some((t) => /VIEW ONLY/.test(t))).toBe(true);
  });

  it('degrade path (stale idx) pops to system AND drops any armed component action', () => {
    const nav = commitNav({ mode: 'component' });
    nav._renderComponentDetail(makeCtx(), 400, 300); // arms the component action
    expect(nav._commitAction).toBeTruthy();
    nav._selectedComponentIdx = 9; // stale
    nav._renderComponentDetail(makeCtx(), 400, 300);
    expect(nav._systemMode).toBe('system');
    expect(nav._commitAction).toBeNull();
    expect(nav._commitButtonRect).toBeNull();
  });
});

describe('BN2 — commit carries the COMPONENT name on BOTH entry paths (AC1)', () => {
  it('PRISM member-marker entry: action.star.name === componentSystems[idx].name + component flag', () => {
    // Entry (b): the PRISM click set _systemStar = the member marker itself.
    const nav = commitNav({ mode: 'component', systemStar: PROXIMA_MARKER() });
    nav._renderComponentDetail(makeCtx(), 400, 300);
    const action = nav._commitAction;
    expect(action.star.name).toBe(nav._systemData.componentSystems[0].name);
    expect(action.component).toBe(true);
    // Position/seed stay the MARKER's — the name is the arrival address
    // (name-channel transport); the marker position keeps findByAlias and the
    // F1 seed-bin identity (both alpha Cen positions hash to 1816942132).
    expect(action.star.wx).toBe(8.000902);
    expect(action.star.seed).toBe('x');
  });

  it('far-chip entry: _systemStar stays the SYSTEM marker but the commit name is the COMPONENT (load-bearing)', () => {
    // Entry (a): far-chip click drills WITHOUT touching _systemStar.
    const nav = commitNav({ mode: 'system' });
    click(nav, CLICK_IN_CHIP);
    expect(nav._systemMode).toBe('component');
    expect(nav._systemStar.name).toBe('Rigil Kentaurus'); // unchanged by the drill
    nav._renderComponentDetail(makeCtx(), 400, 300);
    const action = nav._commitAction;
    expect(action.star.name).toBe('Proxima Centauri'); // NOT the system marker
    expect(action.component).toBe(true);
    // Marker position/seed preserved (identity channel unchanged).
    expect(action.star.wx).toBe(8.000948);
    expect(action.star.seed).toBe('x');
  });

  it('dedup-absorbed sibling (no PRISM marker): far chip commits HD 156026, not Guniibuu', () => {
    const nav = commitNav({
      systemData: guniibuuPayload(),
      systemStar: { name: 'Guniibuu', wx: 4.0, wy: 0.1, wz: 0.5, seed: 'g', spectral: 'K' },
      chipName: 'HD 156026',
    });
    click(nav, CLICK_IN_CHIP);
    expect(nav._systemMode).toBe('component');
    nav._renderComponentDetail(makeCtx(), 400, 300);
    expect(nav._commitAction.star.name).toBe('HD 156026');
    expect(nav._commitAction.component).toBe(true);
  });
});

describe('BN2 — regression: non-component commit payloads byte-exact (AC9 / "A+B still lands at A+B")', () => {
  it('A+B marker commit from the SYSTEM view is byte-identical to the legacy shape — no component flag', () => {
    const nav = commitNav({ mode: 'system' });
    // The system view's foreign auto-commit (unchanged code) builds the action.
    nav._renderSystem(makeCtx(), 400, 300);
    const action = nav._commitAction;
    expect(action).toEqual({
      type: 'warp', target: 'star', starIndex: 0, planetIndex: null, moonIndex: null,
      star: {
        wx: 8.000948, wy: 0.024984, wz: -0.000924,
        seed: 'x', name: 'Rigil Kentaurus', spectral: 'G',
      },
    });
    // toEqual ignores absent-vs-undefined — pin the key sets exactly.
    expect(Object.keys(action).sort()).toEqual(LEGACY_ACTION_KEYS);
    expect(Object.keys(action.star).sort()).toEqual(LEGACY_STAR_KEYS);
    expect('component' in action).toBe(false);
  });

  it('procgen (non-component) system commit payload is byte-identical (AC9)', () => {
    const nav = commitNav({
      systemData: procgenPayload(),
      systemStar: { name: 'GX-1149', wx: 5.2, wy: 0.01, wz: 1.1, seed: 12345, spectral: 'G' },
    });
    nav._renderSystem(makeCtx(), 400, 300);
    const action = nav._commitAction;
    expect(action).toEqual({
      type: 'warp', target: 'star', starIndex: 0, planetIndex: null, moonIndex: null,
      star: { wx: 5.2, wy: 0.01, wz: 1.1, seed: 12345, name: 'GX-1149', spectral: 'G' },
    });
    expect(Object.keys(action).sort()).toEqual(LEGACY_ACTION_KEYS);
    expect(Object.keys(action.star).sort()).toEqual(LEGACY_STAR_KEYS);
    expect('component' in action).toBe(false);
  });

  it('_buildCommitAction in system mode never reads componentSystems (direct primitive pin)', () => {
    const nav = commitNav({ mode: 'system' });
    nav._selectedBody = { type: 'star', starIndex: 0 };
    const action = nav._buildCommitAction();
    expect(action.star.name).toBe('Rigil Kentaurus');
    expect('component' in action).toBe(false);
  });
});

describe('BN2 — component-mode click handling (AC1)', () => {
  it('commit-button hit in component mode COMMITS instead of popping back', () => {
    const nav = commitNav({ mode: 'component' });
    nav._renderComponentDetail(makeCtx(), 400, 300); // arms rect + action
    const commits = [];
    nav._onCommit = (a) => commits.push(a);
    click(nav, BTN_CENTER);
    expect(commits).toHaveLength(1);
    expect(commits[0].star.name).toBe('Proxima Centauri');
    expect(commits[0].component).toBe(true);
    expect(nav._systemMode).toBe('component'); // did NOT pop
  });

  it('clicks elsewhere still pop back to system AND clear the component-addressed action (leak guard)', () => {
    const nav = commitNav({ mode: 'component' });
    nav._renderComponentDetail(makeCtx(), 400, 300); // arms the component action
    expect(nav._commitAction.component).toBe(true);
    click(nav, OUTSIDE_BTN);
    expect(nav._systemMode).toBe('system');
    expect(nav._selectedComponentIdx).toBe(-1);
    // Without this clear, the SYSTEM view's rebuild guard (!_commitAction)
    // would keep the component-named action armed under the parent's WARP
    // button — a silent wrong-destination commit.
    expect(nav._commitAction).toBeNull();
    expect(nav._commitButtonRect).toBeNull();
  });

  it('after pop-back, the SYSTEM view re-arms its own marker-named action (no component leak)', () => {
    const nav = commitNav({ mode: 'component' });
    nav._renderComponentDetail(makeCtx(), 400, 300);
    click(nav, OUTSIDE_BTN); // pop
    nav._renderSystem(makeCtx(), 400, 300); // foreign auto-commit rebuilds
    expect(nav._commitAction.star.name).toBe('Rigil Kentaurus');
    expect('component' in nav._commitAction).toBe(false);
  });

  it('ESC from the drilled view clears the component action; system view then re-arms the marker action', () => {
    const nav = commitNav({ mode: 'component' });
    nav._renderComponentDetail(makeCtx(), 400, 300);
    expect(nav.handleEscape()).toBe(true);
    expect(nav._systemMode).toBe('system');
    expect(nav._commitAction).toBeNull();
    nav._renderSystem(makeCtx(), 400, 300);
    expect(nav._commitAction.star.name).toBe('Rigil Kentaurus');
    expect('component' in nav._commitAction).toBe(false);
  });
});

describe('BN2 — stale _pendingComponentSelect clearing unregressed (627d072)', () => {
  it('handleEscape still clears a pending component pre-select', () => {
    const nav = commitNav({ mode: 'system' });
    nav._pendingComponentSelect = 'Proxima Centauri';
    nav.handleEscape();
    expect(nav._pendingComponentSelect).toBeNull();
  });

  it('openToCurrentSystem still opens clean — no inherited pre-select', () => {
    const nav = commitNav({ mode: 'system' });
    nav._pendingComponentSelect = 'Proxima Centauri';
    nav.openToCurrentSystem(
      { wx: 1, wy: 2, wz: 3, seed: 's', name: 'Somewhere', spectral: 'G' },
      { star: {}, planets: [] },
    );
    expect(nav._pendingComponentSelect).toBeNull();
    expect(nav._systemMode).toBe('system');
  });
});
