/**
 * navUatWalk2026.host — the HOST half of two fixes from Max's UAT walk of 2026-09-30
 * (docs/WORKSTREAMS/nav-restorations-2026-09-20/UAT-walk-2026-09-30.md).
 *
 * ── (C) THE GPS LINE IN EVERY MODE ───────────────────────────────────────────────────────────────
 * Max: *"I want the nav view to work in Orrery. The 'GPS line' in the nav view should work no matter
 * where we're at in the system or in what mode"*, and "yes" to: HELM Enter BURNS; ORRERY Enter GLIDES
 * THE VIEW (the click-2 glide) and the commit reads GO TO. Nothing flies in ORRERY (July rule).
 *   · `_syncNavCommitVerb` publishes `nav.commitIsView` on every instance — at birth and on every
 *     regime flip (`setScManual`). The designs read it for the verb (UI lane's half).
 *   · `dispatchNavAction` routes an ORRERY 'burn' to `_glideViewToNavBody` instead of logging inert.
 *
 * ── (D) A STAR CLICKED IN THE SKY IS THE NAV'S TARGET ────────────────────────────────────────────
 * Max: the nav *"is not picking up targets that I make when I'm actually in a star system by clicking
 * on a star in the star field."* The click reached `_externalTarget`, but every open pre-selects the
 * current system's star and `D.target` / `commit()` read the selection first → `TGT —`, Enter refused.
 *   · `_adoptSkyTargetInNav` makes the clicked star the selection; called at the click and on the
 *     overlay's open, after `_applyNavArrival`.
 *
 * ── HOW main.js IS EXERCISED ─────────────────────────────────────────────────────────────────────
 * main.js cannot be imported (module-scope THREE/DOM work; see tests/deep-link-boot-wiring.test.js).
 * So the REAL function sources are sliced out of it — matched on the comment+literal-blanked pass,
 * sliced from the comment-blanked pass at the same offsets (tests/helpers/source-scan.mjs idiom) —
 * and compiled under 'use strict' against a stub scope. The decision helpers they call
 * (`burnWorkflowAvailable`, `navDispatchDuringWarp`, `systemEntryStyle`, `orreryStandoff`) are the
 * REAL imports. (D)'s nav half runs on a REAL NavComputer under the REAL design driver.
 */

import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { stripCommentsPreservingOffsets } from '../../../tests/helpers/source-scan.mjs';
import { makeHeadlessNav } from './helpers/headlessNav.mjs';
import { burnWorkflowAvailable, navDispatchDuringWarp, systemEntryStyle } from '../../flight/flightModes.js';
import { orreryStandoff } from '../../camera/orreryStandoff.js';
import { NavComputer } from '../NavComputer.js';
import { POSITION_MATCH_TOL } from '../../generation/RealStarCatalog.js';
import { sameStar } from '../navViewModes/starIdentity.js';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const RAW = readFileSync(resolve(REPO, 'src/main.js'), 'utf8');
const MATCH = stripCommentsPreservingOffsets(RAW, { blankLiteralText: true });
const CODE = stripCommentsPreservingOffsets(RAW);

/** The whole `function NAME(...) { ... }` declaration at top level of main.js, comments blanked. */
function fnSource(name) {
  const m = new RegExp(`\\nfunction ${name}\\s*\\(`).exec(MATCH);
  if (!m) throw new Error(`EXTRACTION FAILED: no top-level function ${name} in main.js`);
  let i = m.index + m[0].length, depth = 1;
  while (depth > 0 && i < MATCH.length) { if (MATCH[i] === '(') depth++; else if (MATCH[i] === ')') depth--; i++; }
  i = MATCH.indexOf('{', i);
  const open = i;
  depth = 0;
  for (; i < MATCH.length; i++) {
    if (MATCH[i] === '{') depth++;
    else if (MATCH[i] === '}' && --depth === 0) break;
  }
  if (depth !== 0) throw new Error(`EXTRACTION FAILED: unbalanced braces in ${name} from ${open}`);
  return CODE.slice(m.index + 1, i + 1);
}

/** A matched (blanked) function body, for wiring order checks. */
function fnMatch(name) {
  const src = fnSource(name);
  const at = CODE.indexOf(src);
  return MATCH.slice(at, at + src.length);
}

const HOST_FNS = ['_syncNavCommitVerb', 'setScManual', '_installNavCallbacks', 'dispatchNavAction',
  '_glideViewToNavBody', '_skyTargetNavStar', '_adoptSkyTargetInNav'];
const ENV_NAMES = ['burnWorkflowAvailable', 'navDispatchDuringWarp', 'systemEntryStyle', 'orreryStandoff',
  'NavComputer', 'console', 'navs', 'warpTarget', 'warpEffect', 'cameraController', 'scControls',
  '_makeTarget', 'focusStar', 'focusPlanet', 'focusMoon', 'autoNav', 'flythrough', '_setWarpTargetFromNavStar',
  '_effectiveRegime', '_enterSystemInstantOrrery', 'beginWarpTurn', 'setTimeout', 'playerGalacticPos', 'POSITION_MATCH_TOL',
  'sameStar'];

/**
 * The host functions, compiled together over one stub scope. `let`s are the main.js module
 * variables the functions WRITE; everything else is read off `env`.
 */
function host(over = {}) {
  const env = {
    burnWorkflowAvailable, navDispatchDuringWarp, systemEntryStyle, orreryStandoff, NavComputer, POSITION_MATCH_TOL,
    sameStar,   // naming-prism-segments AC-2: dispatchNavAction's "is this the sky's star" is `sameStar` now
    console: { log: () => {}, warn: () => {} },
    navs: [],
    warpTarget: { direction: null, destType: null, navStarData: null, name: null, turning: false },
    warpEffect: { isActive: false },
    cameraController: { bypassed: false, glideFocus: vi.fn(), setFocusMinDistance: vi.fn() },
    scControls: { selectTarget: vi.fn() },
    _makeTarget: vi.fn(() => null),
    focusStar: vi.fn(), focusPlanet: vi.fn(), focusMoon: vi.fn(),
    autoNav: { isActive: false, stop: vi.fn() },
    flythrough: { active: false, stop: vi.fn() },
    _setWarpTargetFromNavStar: vi.fn(),
    _effectiveRegime: () => 'helm',
    _enterSystemInstantOrrery: vi.fn(),
    beginWarpTurn: vi.fn(),
    setTimeout: (fn) => fn(),
    playerGalacticPos: { x: 8, y: 0, z: 0 },
    _scManual: false,
    ...over,
  };
  // eslint-disable-next-line no-new-func
  const make = new Function('env', `'use strict';
    const { ${ENV_NAMES.join(', ')} } = env;
    const _navComputers = () => navs;
    let _scManual = env._scManual;
    let _selectedTarget = null;
    let _manualBurnOrbiting = false;
    let _pendingPlayerWarp = null;
    let _foldSnapshotTaken = false;
    let _skyPickedStarData = null;
    ${HOST_FNS.map(fnSource).join('\n')}
    return { ${HOST_FNS.join(', ')},
      setSkyPick: (d) => { _skyPickedStarData = d; },
      get selectedTarget() { return _selectedTarget; } };`);
  const h = make(env);   // ⚠ not spread: `selectedTarget` is a live getter
  h.env = env;
  return h;
}

/** A navStub good enough for `_installNavCallbacks`. */
const navStub = () => ({
  setCommitCallback() {}, setDrillSoundCallback() {}, setSoundCallback() {}, setOnAutopilotToggle() {},
});

const W = 417, H = 240;
const press = (nav, code) =>
  nav._onKeyDown({ code, shiftKey: false, ctrlKey: false, metaKey: false, altKey: false, key: '',
    preventDefault() {}, stopPropagation() {} });

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('(C) the commit verb seam — nav.commitIsView follows the regime on every instance', () => {
// ══════════════════════════════════════════════════════════════════════════════════════════════════

  it('a fresh NavComputer starts false (HELM wording) until the host says otherwise', async () => {
    const { nav } = await makeHeadlessNav({ width: W, height: H });
    expect(nav.commitIsView).toBe(false);
  }, 60000);

  it('⭐ every regime flip through setScManual rewrites BOTH instances', () => {
    const a = {}, b = {};
    const h = host({ navs: [a, b], _scManual: true });
    h.setScManual(false);                      // → ORRERY
    expect([a.commitIsView, b.commitIsView]).toEqual([true, true]);
    h.setScManual(true);                       // → HELM
    expect([a.commitIsView, b.commitIsView]).toEqual([false, false]);
  });

  it('⭐ an instance is born with the right verb — _installNavCallbacks publishes it', () => {
    const nav = navStub();
    const h = host({ navs: [nav], _scManual: false });   // ORRERY at birth
    h._installNavCallbacks(nav);
    expect(nav.commitIsView, 'built in ORRERY but would print BURN TO until the next flip').toBe(true);
    const nav2 = navStub();
    host({ navs: [nav2], _scManual: true })._installNavCallbacks(nav2);
    expect(nav2.commitIsView).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('(C) a nav burn in ORRERY glides the VIEW; in HELM it still burns', () => {
// ══════════════════════════════════════════════════════════════════════════════════════════════════

  const bodies = {
    planet: { kind: 'planet', planetIndex: 2, mesh: { position: { x: 1, y: 2, z: 3 } }, radius: 0.05, name: 'P3' },
    moon: { kind: 'moon', planetIndex: 2, moonIndex: 1, mesh: { position: { x: 4, y: 5, z: 6 } }, radius: 0.01, name: 'M' },
  };
  const makeTarget = vi.fn((kind) => bodies[kind] || null);

  it('⭐⭐ ORRERY + moon: select it, then glideFocus the LIVE mesh.position at the moon standoff — nothing flies', () => {
    const h = host({ _scManual: false, _makeTarget: makeTarget });
    h.dispatchNavAction({ type: 'burn', target: 'moon', planetIndex: 2, moonIndex: 1, starIndex: 0 });
    const { cameraController: cc, scControls, focusMoon, focusPlanet, focusStar } = h.env;
    expect(cc.glideFocus, 'ORRERY Enter did nothing — still "burn inert"').toHaveBeenCalledTimes(1);
    expect(cc.glideFocus.mock.calls[0][0], 'a clone, not the live position').toBe(bodies.moon.mesh.position);
    expect(cc.glideFocus.mock.calls[0][1]).toBe(orreryStandoff('moon', 0.01));
    expect(cc.setFocusMinDistance).toHaveBeenCalledWith(0.01, bodies.moon.mesh.position);
    expect(scControls.selectTarget).toHaveBeenCalledWith(bodies.moon);
    expect(focusMoon).not.toHaveBeenCalled();
    expect(focusPlanet).not.toHaveBeenCalled();
    expect(focusStar).not.toHaveBeenCalled();
  });

  it('ORRERY + planet glides too, at the planet standoff', () => {
    const h = host({ _scManual: false, _makeTarget: makeTarget });
    h.dispatchNavAction({ type: 'burn', target: 'planet', planetIndex: 2, moonIndex: null, starIndex: 0 });
    expect(h.env.cameraController.glideFocus).toHaveBeenCalledWith(bodies.planet.mesh.position, orreryStandoff('planet', 0.05));
    expect(h.env.focusPlanet).not.toHaveBeenCalled();
  });

  it('⛔ HELM is unchanged: the burn flies (focusMoon), no view glide', () => {
    const h = host({ _scManual: true, _makeTarget: makeTarget });
    h.dispatchNavAction({ type: 'burn', target: 'moon', planetIndex: 2, moonIndex: 1, starIndex: 0 });
    expect(h.env.focusMoon).toHaveBeenCalledWith(2, 1);
    expect(h.env.cameraController.glideFocus).not.toHaveBeenCalled();
    expect(h.selectedTarget).toBe(bodies.moon);
  });

  it('ORRERY stays inert (and flies nothing) when the body does not resolve or a flythrough owns the camera', () => {
    const h1 = host({ _scManual: false, _makeTarget: vi.fn(() => null) });
    h1.dispatchNavAction({ type: 'burn', target: 'moon', planetIndex: 9, moonIndex: 9 });
    expect(h1.env.cameraController.glideFocus).not.toHaveBeenCalled();
    expect(h1.env.focusMoon).not.toHaveBeenCalled();
    const h2 = host({ _scManual: false, _makeTarget: makeTarget,
      cameraController: { bypassed: true, glideFocus: vi.fn(), setFocusMinDistance: vi.fn() } });
    h2.dispatchNavAction({ type: 'burn', target: 'planet', planetIndex: 2 });
    expect(h2.env.cameraController.glideFocus).not.toHaveBeenCalled();
    expect(h2.env.focusPlanet).not.toHaveBeenCalled();
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('(D) a star clicked in the sky becomes the nav\'s target', () => {
// ══════════════════════════════════════════════════════════════════════════════════════════════════

  /**
   * A real nav, standing in its own system the way `_applyNavArrival` leaves it: the prism loaded,
   * `_currentSystemName` set, `openToCurrentSystem` having pre-selected HOME. Then dropped to GALAXY.
   */
  async function homeNav(mode = 'rail') {
    const h = await makeHeadlessNav({ width: W, height: H });
    const { nav } = h;
    nav._viewModesEnabled = true;
    nav._levelIndex = 3;
    nav.viewMode = mode;
    nav.render();
    const home = nav._localStars.reduce((m, s) => (m == null || s.dist < m.dist ? s : m), null);
    // ⚠ THE PLAYER STANDS AT HOME, as he does after a real arrival (naming-prism-segments Phase 2 fixup,
    //   Astra finding 2): "here" is the star the game arrived at, by identity and while the player is at
    //   it — the old name test made the nearest row "home" wherever the player stood.
    nav.setPlayerPosition({ x: home.wx, y: home.wy, z: home.wz });
    nav._levelIndex = 3; nav.render();
    nav._currentSystemName = home.name || 'HOMEY';
    nav.openToCurrentSystem({ ...home, name: nav._currentSystemName }, null);
    nav._levelIndex = 0;
    nav.render();
    return { ...h, home, drv: nav._viewDriverInst };
  }

  /** A sky click's warpTarget for a star OUTSIDE the loaded prism (as sky stars are), 40 pc off. */
  function skyClick(nav) {
    const sd = { worldX: nav._playerX + 0.04, worldY: nav._playerY, worldZ: nav._playerZ, seed: 424242, type: 'K' };
    return { direction: { x: 1, y: 0, z: 0 }, destType: null, navStarData: sd, name: 'SKYPICK', turning: false };
  }

  it('baseline (the bug): the external target ALONE leaves the nav on "TGT —" — home stays selected', async () => {
    const { nav, drv } = await homeNav();
    const wt = skyClick(nav);
    nav.setExternalTarget({ x: wt.navStarData.worldX, y: wt.navStarData.worldY, z: wt.navStarData.worldZ }, wt.name);
    nav.render();
    expect(drv.D.targetIsHere, 'this fixture no longer reproduces the walk\'s defect').toBe(true);
  }, 60000);

  it('⭐⭐ adopted: TGT names the clicked star, the WARP row is armed, and Enter warps to it', async () => {
    for (const mode of ['rail', 'bars']) {
      const { nav, drv } = await homeNav(mode);
      const wt = skyClick(nav);
      const h = host({ warpTarget: wt, playerGalacticPos: { x: nav._playerX, y: nav._playerY, z: nav._playerZ } });
      h.setSkyPick(wt.navStarData);
      expect(h._adoptSkyTargetInNav(nav)).toBe(true);
      nav.render();
      expect(drv.D.targetIsHere, `${mode}: still "TGT —"`).toBe(false);
      expect(drv.D.target?.name).toBe('SKYPICK');
      expect(drv.D.target?.seed).toBe(424242);
      expect(drv.D.target?.ly).toBeCloseTo(0.04 * 3261.56, 0);
      const fired = [];
      nav._onCommit = (a) => fired.push(a);
      nav._onSound = () => {};
      press(nav, 'Enter');
      expect(fired, `${mode}: Enter at GALAXY did not commit the sky star`).toHaveLength(1);
      expect(fired[0]).toMatchObject({ type: 'warp', target: 'star',
        star: { wx: wt.navStarData.worldX, wz: wt.navStarData.worldZ, seed: 424242, name: 'SKYPICK', spectral: 'K' } });
    }
  }, 120000);

  it('⛔ only the PILOT\'S click is adopted — an auto-pick, a feature or no target leaves the nav alone', async () => {
    const { nav } = await homeNav();
    const homeSel = nav._selectedNavStar;
    const wt = skyClick(nav);
    const h = host({ warpTarget: wt });
    h.setSkyPick({ ...wt.navStarData });          // a DIFFERENT object: the screensaver replaced it
    expect(h._adoptSkyTargetInNav(nav)).toBe(false);
    h.setSkyPick(wt.navStarData);
    wt.destType = 'feature:nebula';
    expect(h._adoptSkyTargetInNav(nav)).toBe(false);
    wt.destType = null; wt.direction = null;
    expect(h._adoptSkyTargetInNav(nav)).toBe(false);
    expect(nav._selectedNavStar).toBe(homeSel);
  }, 60000);

  it('the nav committing the sky star KEEPS the sky\'s warpTarget; a different star still re-targets', () => {
    const sd = { worldX: 8.04, worldY: 0.001, worldZ: 0.002, seed: 7, type: 'G', isRealStar: true };
    const wt = { direction: { x: 1 }, destType: null, navStarData: sd, name: 'SKY', turning: false };
    const h = host({ warpTarget: wt, _scManual: true });
    h.setSkyPick(sd);
    h.dispatchNavAction({ type: 'warp', target: 'star', star: { wx: 8.04, wy: 0.001, wz: 0.002, seed: 7, name: 'SKY', spectral: 'G' } });
    expect(h.env._setWarpTargetFromNavStar, 'the sky target was overwritten by a reduced copy').not.toHaveBeenCalled();
    expect(h.env.beginWarpTurn).toHaveBeenCalledTimes(1);
    h.dispatchNavAction({ type: 'warp', target: 'star', star: { wx: 9, wy: 0, wz: 1, seed: 8, name: 'OTHER', spectral: 'M' } });
    expect(h.env._setWarpTargetFromNavStar).toHaveBeenCalledTimes(1);
  });

  it('wiring: the click records + adopts on every instance; the overlay open adopts AFTER the arrival', () => {
    const click = fnMatch('trySelectWarpTarget');
    expect(click).toMatch(/_skyPickedStarData\s*=\s*warpTarget\.navStarData\s*;/);
    expect(click).toMatch(/for\s*\(\s*const\s+nav\s+of\s+_navComputers\(\)\s*\)\s*_adoptSkyTargetInNav\(\s*nav\s*\)/);
    const open = fnMatch('openNavComputer');
    const arrive = open.indexOf('_applyNavArrival(_domNavComputer)');
    const adopt = open.indexOf('_adoptSkyTargetInNav(_domNavComputer)');
    expect(arrive).toBeGreaterThan(-1);
    expect(adopt, 'the overlay open does not adopt, or adopts BEFORE the arrival re-selects home').toBeGreaterThan(arrive);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('(D) fixup — Astra review 2026-10-02: the adopted sky star is what Enter commits, on the screen the nav opens on', () => {
// ══════════════════════════════════════════════════════════════════════════════════════════════════

  /**
   * ⛔ NO DROP TO GALAXY. The overlay opens on SYSTEM (`openToCurrentSystem` sets level 4 and clears
   * the commit), and the first fix-D test switched to GALAXY before pressing Enter — which is how it
   * missed that Enter did nothing on the screen the pilot actually sees. A real system is attached,
   * so SYSTEM draws its own home ladder.
   */
  async function openedHome(mode = 'rail') {
    const h = await makeHeadlessNav({ width: W, height: H });
    const { nav } = h;
    nav._viewModesEnabled = true;
    nav._levelIndex = 3;
    nav.viewMode = mode;
    nav.render();
    const home = nav._localStars.reduce((m, s) => (m == null || s.dist < m.dist ? s : m), null);
    nav._currentSystemName = home.name || 'HOMEY';
    nav._playerX = home.wx; nav._playerY = home.wy; nav._playerZ = home.wz;
    const sys = { star: { type: 'G' }, zones: { hzInnerAU: 0.9, hzOuterAU: 1.4 }, asteroidBelts: [],
      planets: [0.5, 1.2, 3].map((au) => ({ orbitRadiusAU: au, moons: [],
        planetData: { radiusEarth: 1, T_eq: 260, habitability: { score: 0.2 }, rings: false } })) };
    nav.openToCurrentSystem({ ...home, name: nav._currentSystemName }, sys);
    nav.render();
    return { ...h, home, drv: nav._viewDriverInst };
  }

  /** A sky click 40 pc off — outside the loaded prism, as most sky stars are. */
  const skyClick = (nav, over = {}) => ({
    direction: { x: 1, y: 0, z: 0 }, destType: null, name: 'SKYPICK', turning: false,
    navStarData: { worldX: nav._playerX + 0.04, worldY: nav._playerY, worldZ: nav._playerZ, seed: 424242, type: 'K', ...over },
  });
  const adopt = (nav, wt) => {
    const h = host({ warpTarget: wt, playerGalacticPos: { x: nav._playerX, y: nav._playerY, z: nav._playerZ } });
    h.setSkyPick(wt.navStarData);
    expect(h._adoptSkyTargetInNav(nav)).toBe(true);
    return h;
  };
  const fire = (nav) => {
    const fired = [];
    nav._onCommit = (a) => fired.push(a); nav._onSound = () => {};
    press(nav, 'Enter');
    return fired;
  };

  it('control: freshly opened at home on SYSTEM with nothing picked, Enter commits nothing', async () => {
    const { nav } = await openedHome();
    expect(nav._levelIndex).toBe(4);
    expect(nav._isCurrentSystem(), 'the fixture must be at home').toBe(true);
    expect(fire(nav)).toEqual([]);
  }, 60000);

  it('⭐⭐ on SYSTEM — the screen the overlay opens on — Enter warps to the adopted sky star (both designs)', async () => {
    for (const mode of ['rail', 'bars']) {
      const { nav, drv } = await openedHome(mode);
      const wt = skyClick(nav);
      adopt(nav, wt);
      nav.render();
      expect(nav._levelIndex, `${mode}: adoption must not move the screen`).toBe(4);
      expect(drv.D.target?.name).toBe('SKYPICK');
      const fired = fire(nav);
      expect(fired, `${mode}: Enter on SYSTEM did nothing — finding 1`).toHaveLength(1);
      expect(fired[0]).toMatchObject({ type: 'warp', target: 'star',
        star: { wx: wt.navStarData.worldX, wz: wt.navStarData.worldZ, seed: 424242, name: 'SKYPICK' } });
    }
  }, 120000);

  it('⭐⭐ a body burn armed BEFORE the click is superseded — Enter warps to the star, not the old burn', async () => {
    const { nav } = await openedHome();
    nav._selectedBody = { type: 'planet', planetIndex: 1 };
    nav._commitAction = nav._buildCommitAction();
    expect(nav._commitAction?.type, 'the fixture must arm a home burn').toBe('burn');
    const wt = skyClick(nav);
    adopt(nav, wt);
    expect(nav._commitAction, 'the old burn survived the adoption').toBeNull();
    expect(nav._selectedBody).toBeNull();
    nav.render();
    const fired = fire(nav);
    expect(fired).toHaveLength(1);
    expect(fired[0].type, 'Enter fired the superseded burn').toBe('warp');
    expect(fired[0].star.seed).toBe(424242);
  }, 60000);

  it('⭐⭐ a loaded NEIGHBOUR 0.4 pc away does not replace the clicked star — Enter and Space go to one place', async () => {
    const { nav } = await openedHome();
    const wt = skyClick(nav);
    const sd = wt.navStarData;
    const neighbour = { wx: sd.worldX + 0.0004, wy: sd.worldY, wz: sd.worldZ, seed: 999, name: 'NEIGHBOUR', spectral: 'M', dist: 0.04 };
    nav._localStars.push(neighbour);
    adopt(nav, wt);
    expect(nav._selectedNavStar.seed, 'the 1 pc neighbourhood match swapped in a different star').toBe(424242);
    nav._tryAutoSelectExternalTarget();   // the PRISM loader re-runs this match on its first load (NavComputer :3723)
    expect(nav._selectedNavStar.seed, 'the prism loader\'s re-match swapped it').toBe(424242);
    const fired = fire(nav);
    expect(fired[0].star).toMatchObject({ wx: sd.worldX, seed: 424242, name: 'SKYPICK' });
  }, 60000);

  it('a loaded row that IS the star (inside the 0.1 pc identity radius) may stand in, and Enter still keeps the sky warpTarget', async () => {
    const { nav } = await openedHome();
    const wt = skyClick(nav);
    const sd = wt.navStarData;
    const same = { wx: sd.worldX + 0.00002, wy: sd.worldY, wz: sd.worldZ, seed: 424242, name: 'SKYPICK', spectral: 'K', dist: 0.04 };
    nav._localStars.push(same);
    const h = adopt(nav, wt);
    expect(nav._selectedNavStar, 'the identity row should be adopted (the PRISM highlights rows by identity)').toBe(same);
    const fired = fire(nav);
    h.env._scManual = true;
    h.dispatchNavAction(fired[0]);
    expect(h.env._setWarpTargetFromNavStar, 'the sky record was replaced by the 0.02 pc row').not.toHaveBeenCalled();
    expect(h.env.beginWarpTurn).toHaveBeenCalledTimes(1);
  }, 60000);

  it('⛔ unchanged for any other selection: an external target still auto-selects a row within 1 pc', async () => {
    const { nav, home } = await openedHome();
    const row = { wx: home.wx + 0.03, wy: home.wy, wz: home.wz, seed: 31337, name: 'ROW', spectral: 'G', dist: 0.03 };
    nav._localStars.push(row);
    nav.setExternalTarget({ x: row.wx + 0.0005, y: row.wy, z: row.wz }, 'ROW');   // 0.5 pc off the row
    expect(nav._selectedNavStar).toBe(row);
  }, 60000);
});
