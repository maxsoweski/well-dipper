/**
 * navCurrentTarget.design.test.js — naming-prism-segments batch 2, the DESIGNS' half of AC-15 and AC-17.
 *
 * Spec, Max's own words (docs/WORKSTREAMS/naming-prism-segments-2026-10-02/UAT-review-2026-10-03.md):
 *  · g-here — *"a visually meaning color-codedly consistent indicator that lets you know which thing
 *    selected is where you currently are and where the other thing selected is your target … you can
 *    click on any of those indicators which both of those should be in the upper right … If it's galaxy,
 *    it will highlight in that same color the cell in the galaxy where you are, the sector. If you're in
 *    the sector screen, it will highlight the part in the sector matrix that represents the region where
 *    your target is, or where you are if you pressed the current button up there."*
 *  · g-sector — *"Let's replace all references to you in the menus with the word Current."*
 *  · s-sky — *"The player's icon on the system map view is a different color than the name of the system
 *    that they currently inhabit."*  · s-search — *"when you select one of these search results … it
 *    follows the target color coding."*
 *  · Ruling — *"Rather than ship, the marker should say current."*
 *  · AC-17 — the marker's distance has ONE meaning (moon review): the true range to the route's target.
 *
 * Reads the glass the way the other design suites do: the shipped `S` / `D` repainted through an
 * ink-recording context, `drawPixelText` wrapped so every word is visible with its ink. Each case names
 * the sabotage that was RUN (made, watched red, reverted) in its header.
 */
import { describe, it, expect } from 'vitest';
import { makeHeadlessNav } from './helpers/headlessNav.mjs';
import { makeDesigns } from '../navViewModes/designs.js';
import { planetTrueScene, fmtShipRange, shipRangeTo } from '../navViewModes/shipState.js';
import * as navGrid from '../navGrid.js';
import { FACE, drawPixelText, measurePixelText } from '../../rendering/PixelText.js';
import { earthRadiiToScene } from '../../core/ScaleConstants.js';
import { simClockMs, _setSimClockMs } from '../../core/SimClock.js';

const W = 417, H = 240;
const E = earthRadiiToScene(1);
const O = { x: 0, y: 0, z: 0 };
const CURRENT = '#2ee6c0', TARGET = '#ffb03a', RETIRED_SHIP = '#00ff80';

function inkRecordingContext() {
  const fills = [];
  const base = { fillStyle: '#000', imageSmoothingEnabled: false };
  const ctx = new Proxy(base, {
    get(t, k) {
      if (k === 'fillRect') return (x, y, w, h) => fills.push({ x, y, w, h, ink: t.fillStyle });
      if (k in t) return t[k];
      if (typeof k === 'symbol') return undefined;
      return () => {};
    },
    set(t, k, v) { t[k] = v; return true; },
    has() { return true; },
  });
  return { ctx, fills };
}

function paint(nav, design) {
  const { S, D } = nav._viewDriverInst;
  const lines = [], viol = [];
  const { ctx, fills } = inkRecordingContext();
  const d = makeDesigns({
    S, D, onViolation: (l) => viol.push(l), face: FACE, measurePixelText,
    drawPixelText: (g, s, x, y, opts) => { lines.push({ s: String(s), x, y, color: opts?.color });
                                           return drawPixelText(g, s, x, y, opts); },
  });
  S.design = design;
  d.resetRegions(); d.resetViolations();
  if (design === 1) d.drawDesign1(ctx, W, H); else d.drawDesign2(ctx, W, H);
  return { fills, lines, viol, violations: d.violations(), regions: d.regions(), d, S, D, INK: d.INK,
           chips: (S.indicatorRects || []).map((r) => ({ ...r })), text: lines.map((l) => l.s).join('\n') };
}

const moonsOf = (orbits) => orbits.map((o, j) => ({ type: 'rock', radiusEarth: 0.3, T_eq: 100, orbitRadiusEarth: o, startAngle: 0.4 + j * 1.7 }));
function makeSys() {
  return {
    star: { type: 'G', radiusSolar: 1.0 }, ageGyr: 4.6, isBinary: false,
    zones: { hzInnerAU: 0.9, hzOuterAU: 1.4 }, asteroidBelts: [],
    planets: [0.39, 0.72, 1.0, 1.52, 5.2, 9.5].map((au, i) => ({
      orbitRadiusAU: au, orbitAngle: i * 0.8, moons: i >= 4 ? moonsOf([40, 70, 110]) : [],
      planetData: { radiusEarth: i >= 4 ? 10 : 1, T_eq: 400 - i * 40, type: i >= 4 ? 'gas giant' : 'rocky',
                    habitability: { score: i === 2 ? 0.9 : 0.1 }, rings: false },
    })),
  };
}

let H_;
async function nav0() {
  if (!H_) {
    H_ = await makeHeadlessNav({ width: W, height: H });
    H_.nav._viewModesEnabled = true; H_.nav._levelIndex = 3; H_.nav.viewMode = 'rail'; H_.nav.render();
  }
  const nav = H_.nav;
  nav._externalTarget = null; nav._selectedNavStar = null; nav._viewEase = null; nav._anim = null;
  nav._viewDriverInst.S.locate = null;
  return nav;
}
/** A 2D level, framed exactly on the player's own parent (the host's view stack, rebuilt). */
async function at2D(mode, level) {
  const nav = await nav0();
  nav.viewMode = mode;
  nav._setupViewStackForPlayer();
  nav._levelIndex = level; nav._applyLevelView();
  nav.render();
  return nav;
}
/** SYSTEM, at home (the ship's system), with the fixture system and nothing selected. */
async function atSystem(mode) {
  const nav = await nav0();
  nav.viewMode = mode; nav._systemZoom = 1; nav._systemRotY = 0;
  nav._systemStar = { name: 'HOMESTAR', seed: 7, key: 'p:test-home', wx: nav._playerX, wy: nav._playerY, wz: nav._playerZ, spectral: 'G', dist: 0 };
  const sys = makeSys();
  nav._systemData = sys; nav._currentSystemData = sys; nav._levelIndex = 4;
  nav._currentSystemName = 'HOMESTAR';
  nav._mouseX = -99; nav._mouseY = -99;
  nav._selectedBody = null; nav._commitAction = null;
  nav.setCurrentBody(-1, -1);
  nav.render();
  const S = nav._viewDriverInst.S; S.sysView = 'system'; S.detailPlanet = -1;
  return nav;
}
function publish(nav, T) {
  nav.setShipState({ pos: { x: T.x, y: T.y, z: T.z }, origin: { ...O }, sysKey: nav._systemData });
  nav.render();
}
const P = (nav, i) => planetTrueScene(nav._systemData.planets[i], O);
/** A star target ~3 kpc away — another sector, another region, another column. */
function farTarget(nav, dx = 3, dz = 1.1) {
  nav._externalTarget = { name: 'FARAWAY', x: nav._playerX + dx, y: nav._playerY, z: nav._playerZ + dz };
  nav.render();
}
const chipCentre = (r) => ({ x: Math.floor(r.x + r.w / 2), y: Math.floor(r.y + r.h / 2) });
/** A real click on a chip: the press records the host's drag-start point (a click is "not a drag" against
 *  it), then the driver's remap answers — `null` is "the mode ate it". */
function clickChip(nav, r) {
  const c = chipCentre(r);
  nav._dragStartX = c.x; nav._dragStartY = c.y;
  return nav._viewDriverInst.remapClick(c, W, H);
}
const inMap = (p, f) => { const m = p.regions.map; return f.x >= m.x && f.x < m.x + m.w && f.y >= m.y && f.y < m.y + m.h; };
/** Does the ink lay a two-texel ring round `r` (the locate flash): its top band `r.x-1 .. r.x+r.w+1`? */
const ringAround = (p, r, ink) => p.fills.some((f) => f.ink === ink && f.h === 2 && f.y === r.y - 1
  && f.x <= Math.max(r.x - 1, p.S.mapProj.clip.x) && f.x + f.w >= Math.min(r.x + r.w + 2, p.S.mapProj.clip.x + p.S.mapProj.clip.w));

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('AC-15 — one CURRENT ink, one TARGET ink, and no YOU / SHIP anywhere', () => {
  it('⭐⭐ the ink table has CURRENT and TARGET and no YOU / SHIP, and the retired ship green is never filled', async () => {
    // ⛔ SABOTAGE RUN: the ship diamond's sprite back on a literal '#00ff80' (drawShipLadder) → red on
    //    the design-1 SYSTEM frame with a live ship.
    const nav = await atSystem('rail');
    const INK = paint(nav, 1).INK;
    expect(INK.CURRENT).toBe(CURRENT);
    expect(INK.TARGET).toBe(TARGET);
    expect('YOU' in INK, 'INK.YOU survived the rename').toBe(false);
    expect('SHIP' in INK, 'the ship green was not retired').toBe(false);
    publish(nav, { x: P(nav, 2).x + 30 * E, y: 0, z: P(nav, 2).z });
    const frames = [];
    for (const design of [1, 2]) {
      for (const level of [0, 1, 2]) frames.push([`D${design} L${level}`, paint(await at2D(design === 1 ? 'rail' : 'bars', level), design)]);
      const sysNav = await atSystem(design === 1 ? 'rail' : 'bars');
      publish(sysNav, { x: P(sysNav, 2).x + 30 * E, y: 0, z: P(sysNav, 2).z });
      frames.push([`D${design} SYSTEM`, paint(sysNav, design)]);
    }
    for (const [label, p] of frames) {
      expect(p.fills.filter((f) => f.ink === RETIRED_SHIP).length, `${label}: the retired ship green was filled`).toBe(0);
    }
  }, 120000);

  it('⭐⭐ NO "YOU" / "SHIP" WORD IS DRAWN — every level, both designs, home with a live ship, a target, the search, a foreign system', async () => {
    // ⛔ SABOTAGE RUN: the prism detail line back to 'YOU ARE HERE' → red ("PRISM target-is-here");
    //    `currentWords` back to 'SHIP' → red (SYSTEM with a ship).
    const frames = [];
    for (const [mode, design] of [['rail', 1], ['bars', 2]]) {
      for (const level of [0, 1, 2]) {
        const nav = await at2D(mode, level);
        farTarget(nav);
        frames.push([`D${design} L${level}`, paint(nav, design)]);
      }
      const sys = await atSystem(mode);
      publish(sys, { x: P(sys, 2).x + 30 * E, y: 0, z: P(sys, 2).z });
      sys._selectedBody = { type: 'planet', planetIndex: 3 }; sys.render();
      frames.push([`D${design} SYSTEM ship+target`, paint(sys, design)]);
      sys._playerX += 0.5; sys.render();                       // the system on the glass is now foreign
      frames.push([`D${design} SYSTEM foreign`, paint(sys, design)]);
    }
    // PRISM, with the player's own star selected (the detail block's "target is here" line)
    const nav = await nav0();
    nav.viewMode = 'rail'; nav._levelIndex = 3; nav.render();
    const drv = nav._viewDriverInst;
    const s = drv.D.starRows.find((r) => r.key && r.key.startsWith('p:') && r.dist > 0.0005);
    nav._playerX = s.wx; nav._playerY = s.wy; nav._playerZ = s.wz; nav._localCenter = { x: s.wx, y: s.wy, z: s.wz };
    nav.render();
    nav._selectedNavStar = drv.D.here; nav.render();
    expect(drv.D.targetIsHere, 'fixture: the selection must be the star the player is at').toBe(true);
    frames.push(['PRISM target-is-here', paint(nav, 1)]);
    for (const [label, p] of frames) {
      const bad = p.lines.filter((l) => /\b(YOU|YOUR|SHIP)\b/.test(l.s)).map((l) => l.s);
      expect(bad, `${label}: a YOU / SHIP word is still drawn`).toEqual([]);
    }
    expect(frames.find(([l]) => l === 'PRISM target-is-here')[1].text).toContain('CURRENT SYSTEM');
  }, 180000);

  it('⭐⭐ s-sky — the CURRENT marker and the name of the system the player is in are ONE ink', async () => {
    // ⛔ SABOTAGE RUN: `indicatorChips` drawing the current chip's text in KEY → red in both designs.
    for (const [mode, design] of [['rail', 1], ['bars', 2]]) {
      const nav = await atSystem(mode);
      publish(nav, { x: P(nav, 2).x + 40 * E, y: 0, z: P(nav, 2).z - 40 * E });
      const p = paint(nav, design);
      const diamond = p.fills.find((f) => inMap(p, f) && f.ink === CURRENT && f.w === 5 && f.h === 1);
      expect(diamond, `design ${design}: no CURRENT diamond on the map`).toBeTruthy();
      const cChip = p.chips.find((c) => c.who === 'current');
      const name = p.lines.find((l) => l.s === 'HOMESTAR' && l.x >= cChip.x && l.x < cChip.x + cChip.w);
      expect(name, `design ${design}: the current system's name is not in the top bar`).toBeTruthy();
      expect(name.y, `design ${design}: the name is not on the top row`).toBeLessThan(p.regions.map.y);
      expect(name.color, `design ${design}: the system name and the marker are different inks`).toBe(diamond.ink);
      // …and nowhere else on the bar is that name drawn in another ink (design 1's view label at home)
      const others = p.lines.filter((l) => l.s.includes('HOMESTAR') && l.y < p.regions.map.y && l.color !== CURRENT);
      expect(others.map((l) => `${l.s} ${l.color}`), `design ${design}: the current system's name in a second ink`).toEqual([]);
    }
  }, 60000);
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('AC-15 — the CURRENT / TARGET indicators, top right, clickable', () => {
  it('⭐ both designs publish two chips at every level, CURRENT then TARGET, right-aligned in the top bar, each in its ink', async () => {
    // ⛔ SABOTAGE RUN: `indicatorChips` publishing only the current chip → red (length 2).
    for (const [mode, design] of [['rail', 1], ['bars', 2]]) {
      for (const level of [0, 1, 2]) {
        const nav = await at2D(mode, level);
        farTarget(nav);
        const p = paint(nav, design);
        expect(p.chips.map((c) => c.who), `D${design} L${level}`).toEqual(['current', 'target']);
        const [c, t] = p.chips;
        expect(c.y).toBe(0);
        expect(c.y + c.h, `D${design} L${level}: a chip reaches below the top bar`).toBeLessThanOrEqual(p.regions.map.y);
        expect(t.x, 'TARGET is right of CURRENT').toBeGreaterThan(c.x + c.w - 1);
        expect(t.x + t.w, 'the target chip runs off the glass').toBeLessThanOrEqual(W);
        const tText = p.lines.find((l) => l.s.startsWith('FARAWAY'));
        expect(tText && tText.color, `D${design} L${level}: the target's name is not in TARGET ink`).toBe(TARGET);
        expect(tText.s, 'the target chip says how far').toMatch(/ LY$/);
        expect(p.violations, `D${design} L${level}: layout guard`).toBe(0);
      }
    }
  }, 120000);

  it('⭐⭐ GALAXY — clicking CURRENT rings the player\'s sector in CURRENT, clicking TARGET rings the target\'s in TARGET', async () => {
    // ⛔ SABOTAGE RUN: `locateInk` returning null → no ring, red; `locate` ignoring `who` (always the
    //    player's cell) → the TARGET case rings the wrong cell, red.
    for (const [mode, design] of [['rail', 1], ['bars', 2]]) {
      const nav = await at2D(mode, 0);
      farTarget(nav);
      const drv = nav._viewDriverInst;
      let p = paint(nav, design);
      const cellRect = (addr) => p.S.mapCells.find((m) => navGrid.sameAddress(m.address, addr)).rect;
      const pSec = navGrid.parentAt(1, nav._playerX, nav._playerZ);
      const tSec = navGrid.parentAt(1, nav._externalTarget.x, nav._externalTarget.z);
      expect(navGrid.sameAddress(pSec, tSec), 'fixture: the target must be in another sector').toBe(false);
      expect(ringAround(p, cellRect(pSec), CURRENT), 'control: no ring before a click').toBe(false);
      const [cChip, tChip] = p.chips;
      expect(clickChip(nav, cChip), 'the CURRENT chip did not eat its click').toBe(null);
      expect(drv.S.locate && drv.S.locate.who).toBe('current');
      nav.render(); p = paint(nav, design);
      expect(ringAround(p, cellRect(pSec), CURRENT), `design ${design}: the player's sector is not ringed in CURRENT`).toBe(true);
      expect(clickChip(nav, tChip)).toBe(null);
      nav.render(); p = paint(nav, design);
      expect(ringAround(p, cellRect(tSec), TARGET), `design ${design}: the target's sector is not ringed in TARGET`).toBe(true);
      expect(ringAround(p, cellRect(pSec), CURRENT), 'the CURRENT ring outlived the TARGET click').toBe(false);
    }
  }, 120000);

  it('⭐⭐ SECTOR — TARGET brings the target\'s own sector onto the glass and rings its region; CURRENT brings the player\'s back', async () => {
    // ⛔ SABOTAGE RUN: `locate` skipping the re-stack for TARGET → the screen stays on the player's
    //    sector, the target's region is not a drawn cell, red.
    const t0 = simClockMs();
    try {
      for (const [mode, design] of [['rail', 1], ['bars', 2]]) {
        const nav = await at2D(mode, 1);
        farTarget(nav);
        const drv = nav._viewDriverInst;
        const [, tChip] = paint(nav, design).chips;
        clickChip(nav, tChip);
        const tx = nav._externalTarget.x, tz = nav._externalTarget.z;
        expect(navGrid.sameAddress(nav._viewStack[1].address, navGrid.parentAt(1, tx, tz)),
          `design ${design}: the view stack is not the target's`).toBe(true);
        _setSimClockMs(simClockMs() + 400); nav.render();     // the ease lands (inside the 1.6 s flash)
        expect(navGrid.sameAddress(drv.S.gridParent, navGrid.parentAt(1, tx, tz)), 'the screen is not the target\'s sector').toBe(true);
        const p = paint(nav, design);
        const tCell = navGrid.childCell(1, navGrid.parentAt(2, tx, tz));
        const r = p.S.mapCells.find((m) => navGrid.sameAddress(m.address, tCell.address));
        expect(r, 'the target\'s region is not a drawn cell').toBeTruthy();
        if (drv.S.locate && drv.S.locate.on === false) { _setSimClockMs(simClockMs() + 200); nav.render(); }
        expect(ringAround(paint(nav, design), r.rect, TARGET), `design ${design}: the target's region is not ringed`).toBe(true);
        const [cChip] = paint(nav, design).chips;
        clickChip(nav, cChip);
        _setSimClockMs(simClockMs() + 400); nav.render();
        expect(navGrid.sameAddress(drv.S.gridParent, navGrid.parentAt(1, nav._playerX, nav._playerZ)),
          `design ${design}: CURRENT did not bring the player's sector back`).toBe(true);
        _setSimClockMs(t0);
      }
    } finally { _setSimClockMs(t0); }
  }, 120000);

  it('⭐ the flash blinks and ends: on, off, gone by 1.6 s', async () => {
    // ⛔ SABOTAGE RUN: `ageLocate` never expiring → still set after 2 s, red.
    const t0 = simClockMs();
    try {
      const nav = await at2D('rail', 0);
      const drv = nav._viewDriverInst;
      const [cChip] = paint(nav, 1).chips;
      clickChip(nav, cChip);
      nav.render(); expect(drv.S.locate.on).toBe(true);
      _setSimClockMs(simClockMs() + 250); nav.render(); expect(drv.S.locate.on).toBe(false);
      _setSimClockMs(simClockMs() + 2000); nav.render(); expect(drv.S.locate).toBe(null);
    } finally { _setSimClockMs(t0); }
  }, 60000);

  it('⭐ at SYSTEM a chip click is eaten and keeps the body selection (the old locator\'s AC-9 rule)', async () => {
    // ⛔ SABOTAGE RUN: the chip clause returning `p` (falling through) → `_clearCommitSelection`, red.
    for (const mode of ['rail', 'bars']) {
      const nav = await atSystem(mode);
      nav._hoveredBody = { type: 'planet', index: 1 };
      nav._selectedBody = { type: 'planet', planetIndex: 1 }; nav._commitAction = nav._buildCommitAction(); nav.render();
      const drv = nav._viewDriverInst;
      for (const r of paint(nav, mode === 'rail' ? 1 : 2).chips) {
        expect(clickChip(nav, r), `${mode}: the ${r.who} chip fell through at SYSTEM`).toBe(null);
      }
      expect(nav._selectedBody).toEqual({ type: 'planet', planetIndex: 1 });
    }
  }, 60000);
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('AC-15 — selections, search results and the tabs follow the rule', () => {
  it('⭐ PRISM: the selected star wears TARGET in design 2 (Phase 3 left it in KEY), and its name too', async () => {
    // ⛔ SABOTAGE RUN: `d2Prism`'s selected frame back to INK.KEY → red.
    const nav = await nav0();
    nav.viewMode = 'bars'; nav._levelIndex = 3; nav.render();
    const drv = nav._viewDriverInst;
    const hit = (drv.S.prismHits || []).find((h) => h.ref !== drv.D.here && h.ref.isReal) || (drv.S.prismHits || []).find((h) => h.ref !== drv.D.here);
    expect(hit, 'fixture: no star on the glass').toBeTruthy();
    nav._selectedNavStar = hit.ref; nav.render();
    const p = paint(nav, 2);
    const h2 = p.S.prismHits.find((z) => z.ref === drv.D.selStar);
    const x = Math.round(h2.x) - 3, y = Math.round(h2.y) - 3;
    expect(p.fills.some((f) => f.ink === TARGET && f.x === x && f.y === y && f.w === 7 && f.h === 1),
      'the selected star is not framed in TARGET').toBe(true);
    expect(p.fills.some((f) => f.ink === p.INK.KEY && f.x === x && f.y === y && f.w === 7 && f.h === 1),
      'the KEY frame is still drawn').toBe(false);
  }, 60000);

  it('⭐ s-search — the highlighted result is TARGET in both designs', async () => {
    // ⛔ SABOTAGE RUN: d1Search's selected row text back to INK.KEY → red; d2Search's fill → red.
    const press = (nav, code, extra = {}) => nav._onKeyDown({ code, preventDefault() {}, stopPropagation() {}, ...extra });
    for (const [mode, design] of [['rail', 1], ['bars', 2]]) {
      const nav = await at2D(mode, 0);
      press(nav, 'Slash');
      for (const [code, key] of [['KeyS', 's'], ['KeyO', 'o'], ['KeyL', 'l']]) press(nav, code, { key });
      nav.render();
      const drv = nav._viewDriverInst;
      expect(drv.S.search.rows.length, 'fixture: "sol" found nothing').toBeGreaterThan(0);
      if (!(drv.S.search.highlight >= 0)) { press(nav, 'ArrowDown'); nav.render(); }
      const p = paint(nav, design);
      const g = p.S.searchGeom, hi = drv.S.search.highlight - g.offset;
      const rowY = g.top + (hi + 1) * g.lead;
      if (design === 1) {
        const row = p.lines.find((l) => l.y === rowY && l.x === g.x0 + 1);
        expect(row && row.color, 'design 1: the picked result is not TARGET').toBe(TARGET);
      } else {
        expect(p.fills.some((f) => f.ink === TARGET && f.y === rowY - 1 && f.w > 100), 'design 2: the picked row is not a TARGET bar').toBe(true);
      }
      press(nav, 'Escape'); nav.render();
    }
  }, 60000);

  it('⭐ the active tab is CURRENT on the player\'s own sector and KEY on a browsed one', async () => {
    // ⛔ SABOTAGE RUN: `onPlayerPlace` always true → the browsed case stays CURRENT, red.
    for (const [mode, design] of [['rail', 1], ['bars', 2]]) {
      const nav = await at2D(mode, 1);
      const tabInk = (p) => {
        if (design === 1) { const tabs = p.regions.tabs; return p.fills.find((f) => f.y === tabs.y - 1 && f.h === FACE.h + 1 && f.w > 20).ink; }
        const r = p.S.tabRects[1]; return p.fills.find((f) => f.x === r.x && f.y === p.regions.map.y - 2 && f.h === 1).ink;
      };
      expect(tabInk(paint(nav, design)), `design ${design}: own sector`).toBe(CURRENT);
      const own = navGrid.parentAt(1, nav._playerX, nav._playerZ);
      const east = { sector: { i: own.sector.i + 1, j: own.sector.j } };
      const v = navGrid.viewForAddress(1, east);
      nav._viewStack[1] = { center: { x: v.cx, z: v.cz }, size: v.size, address: east };
      nav._viewCenter = { x: v.cx, z: v.cz }; nav.render();
      expect(tabInk(paint(nav, design)), `design ${design}: a browsed sector`).toBe(paint(nav, design).INK.KEY);
    }
  }, 60000);
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('AC-17 — the CURRENT marker\'s number means one thing: the true range to the target, and says so', () => {
  const wordOf = (p) => p.lines.find((l) => /^CURRENT\b/.test(l.s) && inMap(p, { x: l.x, y: l.y })) || null;

  it('⭐⭐ with a target the word is "CURRENT <range> TO <TARGET>", the range being shipRangeTo; with none it is "CURRENT"', async () => {
    // ⛔ SABOTAGE RUN: `currentWords` returning the old 'SHIP' word → red; dropping the "TO <name>"
    //    clause (`CURRENT 2.0AU`) → red.
    for (const [mode, design] of [['rail', 1], ['bars', 2]]) {
      const nav = await atSystem(mode);
      publish(nav, { x: P(nav, 2).x + 40 * E, y: 0, z: P(nav, 2).z - 40 * E });
      expect(wordOf(paint(nav, design))?.s, `design ${design}: no target`).toBe('CURRENT');
      nav._selectedBody = { type: 'planet', planetIndex: 4 }; nav._commitAction = nav._buildCommitAction(); nav.render();
      const p = paint(nav, design);
      const rg = shipRangeTo(p.D.ship, { kind: 'planet', pIdx: 4, mIdx: -1 });
      const name = p.D.bodies.find((b) => b.kind === 'planet' && b.pIdx === 4).name.toUpperCase();
      // the full spelling when the name finds a slot, else the same meaning shortened — never a bare number
      expect([`CURRENT ${fmtShipRange(rg)} TO ${name}`, `CURRENT ${fmtShipRange(rg)} TO TGT`], `design ${design}`).toContain(wordOf(p)?.s);
      expect(wordOf(p).color).toBe(CURRENT);
    }
  }, 60000);

  it('⭐⭐ ONE MEANING: a ship OFF the picture with a target still reads the range to the TARGET, never to the picture\'s origin', async () => {
    // ⛔ SABOTAGE RUN: the off-pane branch re-adding `originRange()` (the old "SHIP 60AU" to the star)
    //    → the number is the star's distance, red.
    for (const [mode, design] of [['rail', 1], ['bars', 2]]) {
      const nav = await atSystem(mode);
      const far = P(nav, 5);
      publish(nav, { x: far.x * 6, y: 0, z: far.z * 6 });          // well past the outermost orbit
      nav._selectedBody = { type: 'planet', planetIndex: 1 }; nav._commitAction = nav._buildCommitAction(); nav.render();
      const p = paint(nav, design);
      const w = wordOf(p);
      expect(w, `design ${design}: the off-picture marker lost its word`).toBeTruthy();
      const toTarget = fmtShipRange(shipRangeTo(p.D.ship, { kind: 'planet', pIdx: 1, mIdx: -1 }));
      const toStar = fmtShipRange(p.D.ship.range.star);
      expect(toTarget, 'fixture: the two ranges must differ').not.toBe(toStar);
      // ⚠ the off-pane word competes with its route for a slot; when no numbered spelling fits, the bare
      //   word is drawn — so the rule asserted is the MEANING: any number shown is the target's range.
      if (design === 1) expect(w.s, 'design 1 has room for the number').toContain(`CURRENT ${toTarget} TO`);
      if (/\d/.test(w.s)) expect(w.s, `design ${design}`).toContain(`CURRENT ${toTarget} TO`);
      expect(w.s).not.toContain(` ${toStar} `);
    }
  }, 60000);
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// ⭐ BATCH 2 FIXUP — the live step's four AC-15 FAILs and Astra's confirmed defects (2026-10-03).
// ══════════════════════════════════════════════════════════════════════════════════════════════════
/** PRISM on the player's own star, with that star selected — Sol's state when the nav opens (the host
 *  pre-selects the current system). */
async function atOwnStarSelected(mode) {
  const nav = await nav0();
  nav.viewMode = mode; nav._levelIndex = 3; nav.render();
  const drv = nav._viewDriverInst;
  const s = drv.D.starRows.find((r) => r.key && r.key.startsWith('p:') && r.dist > 0.0005);
  nav._playerX = s.wx; nav._playerY = s.wy; nav._playerZ = s.wz; nav._localCenter = { x: s.wx, y: s.wy, z: s.wz };
  nav.render();
  // ⚠ design 2 names only CATALOGUE stars (`d2Prism`'s label loop: `!s.isReal` → no label); Sol, the live case, is
  //   one, so the fixture's procedural row is marked as one to put its name on the glass in both designs.
  drv.D.here.isReal = true;
  nav._selectedNavStar = drv.D.here; nav.render();
  return nav;
}

describe('batch 2 fixup — AC-15 live FAILs', () => {
  it('⭐⭐ FAIL 2 — your own star, selected, is CURRENT at PRISM in both designs: name, mark, rail row and detail; never TARGET', async () => {
    // ⛔ SABOTAGE RUN: `starInk` back to selStar-first → the label is TARGET, red; design 1's mark loop back to
    //    `s === D.selStar` first → a TARGET 5x5 frame on the star, red.
    for (const [mode, design] of [['rail', 1], ['bars', 2]]) {
      const nav = await atOwnStarSelected(mode);
      const drv = nav._viewDriverInst;
      expect(drv.D.targetIsHere, 'fixture: the selection must be the star the player is at').toBe(true);
      const p = paint(nav, design);
      const name = String(drv.D.here.name).toUpperCase();
      const hit = p.S.prismHits.find((z) => z.ref === drv.D.here);
      expect(hit, 'fixture: the player\'s star is not on the glass').toBeTruthy();
      const words = p.lines.filter((l) => l.s.includes(name));
      expect(words.length, `design ${design}: fixture — the star's name is not drawn`).toBeGreaterThan(0);
      expect(words.filter((l) => l.color === TARGET).map((l) => l.s), `design ${design}: your own star's name in TARGET`).toEqual([]);
      expect(words.some((l) => l.color === CURRENT), `design ${design}: your own star's name is not CURRENT anywhere`).toBe(true);
      const hx = Math.round(hit.x), hy = Math.round(hit.y);
      const near = (f) => f.x >= hx - 4 && f.x <= hx + 4 && f.y >= hy - 4 && f.y <= hy + 4;
      expect(p.fills.filter((f) => near(f) && f.ink === TARGET).length, `design ${design}: a TARGET mark on your own star`).toBe(0);
      expect(p.fills.some((f) => near(f) && f.ink === CURRENT), `design ${design}: no CURRENT mark on your own star`).toBe(true);
      // ⭐ and NOTHING on the frame is TARGET but the TARGET chip's own diamond (no target exists): found live at Sol,
      //    the segment bar's TARGET tick and the column outline still read `D.selStar` (fixup round 2).
      // ⛔ SABOTAGE RUN: `slabBar`'s `tgt` back to `D.selStar || D.target` → a TARGET tick, red.
      const tc = p.chips.find((c) => c.who === 'target');
      const stray = p.fills.filter((f) => f.ink === TARGET && !(f.x >= tc.x && f.x < tc.x + tc.w && f.y < tc.y + tc.h));
      expect(stray.map((f) => `${f.x},${f.y} ${f.w}x${f.h}`), `design ${design}: TARGET ink with no target`).toEqual([]);
    }
  }, 120000);

  it('⭐ FAIL 2 control — another star selected still wears TARGET (the fix is "here wins", not "TARGET gone")', async () => {
    // ⛔ SABOTAGE RUN: `isTgtStar` always false → red.
    for (const [mode, design] of [['rail', 1], ['bars', 2]]) {
      const nav = await atOwnStarSelected(mode);
      const drv = nav._viewDriverInst;
      const other = (drv.S.prismHits || []).find((h) => h.ref !== drv.D.here);
      nav._selectedNavStar = other.ref; nav.render();
      expect(drv.D.targetIsHere).toBe(false);
      const p = paint(nav, design);
      const h = p.S.prismHits.find((z) => z.ref === drv.D.selStar);
      const hx = Math.round(h.x), hy = Math.round(h.y);
      expect(p.fills.some((f) => f.ink === TARGET && Math.abs(f.x - hx) <= 3 && Math.abs(f.y - hy) <= 3), `design ${design}`).toBe(true);
    }
  }, 120000);

  it('⭐⭐ FAIL 1 — design 1\'s SECTOR / REGION detail names the target\'s cell in TARGET ink, and the dim dash only with no target', async () => {
    // ⛔ SABOTAGE RUN: the detail's last line back to `['TARGET  —', INK.DIM]` → red.
    for (const level of [1, 2]) {
      const nav = await at2D('rail', level);
      let p = paint(nav, 1);
      const none = p.lines.find((l) => l.s.startsWith('TARGET '));
      expect(none && none.s.trim(), `L${level}: control — no target`).toBe('TARGET  —');
      farTarget(nav);
      p = paint(nav, 1);
      const line = p.lines.find((l) => l.s.startsWith('TARGET '));
      const t = nav._externalTarget;
      const c = navGrid.childCell(level, navGrid.parentAt(level + 1, t.x, t.z));
      expect(line && line.color, `L${level}: the TARGET line is not TARGET ink`).toBe(TARGET);
      expect(line.s, `L${level}: the TARGET line does not name the target's cell`).toContain(navGrid.addressKey(c.address).split(' ').pop());
      expect(line.s).toContain('FARAWAY'.slice(0, 3));
    }
  }, 60000);

  it('⭐⭐ FAIL 4 — design 2 SYSTEM: the CURRENT word never lands on the legend rows (they are painted last, over it)', async () => {
    // ⛔ SABOTAGE RUN: `shipWord` placing against the whole map (`cl`) instead of `bd` → a sweep position puts
    //    the word on the legend band, red.
    const nav = await atSystem('bars');
    const far = P(nav, 5), R5 = Math.hypot(far.x, far.z);
    let hits = 0;
    for (const k of [0.15, 0.4, 0.7, 1.0, 1.3, 2, 4]) for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      publish(nav, { x: Math.cos(a) * R5 * k, y: 0, z: Math.sin(a) * R5 * k });
      const p = paint(nav, 2);
      const word = p.lines.find((l) => /^CURRENT\b/.test(l.s) && inMap(p, { x: l.x, y: l.y }));
      if (!word) continue;
      hits++;
      const m = p.regions.map, legTop = m.y + m.h - FACE.h - 1 - (FACE.h + 1) - 1;
      expect(word.y + FACE.h + 1, `k ${k} a ${i}/24: the CURRENT word (y ${word.y}) reaches the legend band (from ${legTop})`).toBeLessThanOrEqual(legTop);
    }
    expect(hits, 'fixture: the sweep drew no CURRENT word').toBeGreaterThan(20);
  }, 180000);
});

describe('batch 2 fixup — Astra\'s confirmed defects', () => {
  it('⭐⭐ Astra 7 — design 2\'s indicator chips never run into the tab strip, at 300 / 320 / 360 / 417', async () => {
    // ⛔ SABOTAGE RUN: the old `Math.max(FACE.advance, …)` floors and an always-kept LY distance → 17 texels of
    //    overlap at 300 and the layout guard fires, red.
    for (const w of [300, 320, 360, 417]) {
      const nav = await at2D('bars', 1);
      farTarget(nav);
      const { S, D } = nav._viewDriverInst;
      const viol = [];
      const { ctx } = inkRecordingContext();
      const d = makeDesigns({ S, D, onViolation: (l) => viol.push(l), face: FACE, measurePixelText, drawPixelText });
      S.design = 2; d.resetRegions(); d.resetViolations();
      d.drawDesign2(ctx, w, H);
      const tabsEnd = Math.max(...S.tabRects.map((r) => r.x + r.w));
      for (const c of S.indicatorRects || []) expect(c.x + 1, `@${w}: the ${c.who} chip starts inside the tab strip`).toBeGreaterThanOrEqual(tabsEnd);
      for (const c of S.indicatorRects || []) expect(c.x + c.w - 1, `@${w}: the ${c.who} chip runs off the glass`).toBeLessThanOrEqual(w);
      expect(viol.filter((v) => /tab strip vs indicators/.test(v)), `@${w}: the layout guard fired`).toEqual([]);
      if (w === 417) expect((S.indicatorRects || []).length, 'control: both chips at Max\'s width').toBe(2);
    }
  }, 120000);

  it('⭐⭐ Astra 8 — PRISM: a TARGET click rings the target star when the target is set WITHOUT a selection (by its key)', async () => {
    // ⛔ SABOTAGE RUN: `locateMarks` back to `cur ? D.here : D.selStar` → no ring, red.
    for (const [mode, design] of [['rail', 1], ['bars', 2]]) {
      const nav = await nav0();
      nav.viewMode = mode; nav._levelIndex = 3; nav.render();
      const drv = nav._viewDriverInst;
      const s = (drv.S.prismHits || []).map((h) => h.ref).find((r) => r !== drv.D.here && r.key);
      expect(s, 'fixture: no keyed star on the glass').toBeTruthy();
      nav._selectedNavStar = null;
      nav._externalTarget = { name: 'KEYED', x: s.wx, y: s.wy, z: s.wz, key: s.key }; nav.render();
      expect(drv.D.selStar).toBe(null);
      const [, tChip] = paint(nav, design).chips;
      expect(clickChip(nav, tChip)).toBe(null);
      nav.render();
      const p = paint(nav, design);
      const h = p.S.prismHits.find((z) => z.ref && z.ref.key === s.key);
      expect(h, 'the target star left the glass').toBeTruthy();
      const x0 = Math.round(h.x) - 6, y0 = Math.round(h.y) - 6;
      expect(p.fills.some((f) => f.ink === TARGET && f.y === y0 && f.h === 1 && f.x <= x0 + 1 && f.x + f.w >= x0 + 12),
        `design ${design}: the target star is not ringed`).toBe(true);
    }
  }, 120000);

  it('⭐⭐ Astra 8 — SYSTEM at home, no body, a star target: the TARGET click blinks the WARP commit (the target\'s only place here)', async () => {
    // ⛔ SABOTAGE RUN: `commitFlash` always false → the commit stays a plain TARGET fill, no TARGET frame on BG, red.
    for (const [mode, design] of [['rail', 1], ['bars', 2]]) {
      const nav = await atSystem(mode);
      farTarget(nav);
      const drv = nav._viewDriverInst;
      expect(drv.D.target && !drv.D.targetIsHere, 'fixture: a live star target').toBe(true);
      const [, tChip] = paint(nav, design).chips;
      expect(clickChip(nav, tChip)).toBe(null);
      nav.render();
      const p = paint(nav, design);
      if (design === 1) {
        // inverted: the bar is BG and its word TARGET (no frame — it struck the word through, live)
        const lbl = p.lines.find((l) => /^WARP TO/.test(l.s));
        expect(lbl && lbl.color, 'design 1: the commit word is not TARGET on the flash').toBe(TARGET);
        expect(p.fills.some((f) => f.ink === TARGET && f.x === 0 && f.w === W && f.h > 1), 'design 1: the bar is still a solid TARGET fill').toBe(false);
      } else {
        const r = p.S.chipRect;
        expect(p.fills.some((f) => f.ink === TARGET && f.x === r.x && f.y === r.y && f.w === r.w && f.h === 1), 'design 2: the [WARP] chip is not framed in TARGET').toBe(true);
      }
    }
  }, 120000);

});
