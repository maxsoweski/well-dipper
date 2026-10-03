/**
 * naming-prism-segments AC-15 — ONE CURRENT INK, ONE TARGET INK, on the LEGACY look (2026-10-03).
 *
 * Max (g-here): *"a visually meaning color-codedly consistent indicator that lets you know which thing
 * selected is where you currently are and where the other thing selected is your target"*; (g-sector)
 * *"Let's replace all references to you in the menus with the word Current"*; and the ruling after the
 * review: *"Rather than ship, the marker should say current."*
 *
 * Legacy used cyan `#00d4ff` for "you are here" and ONE green `#00ff80` for both the ship (its diamond,
 * the word SHIP, its route) and the target (the warp diamond, the selected star, WARP TARGET). Now the
 * player's marks are CURRENT `#2ee6c0`, the target's are TARGET `#ffb03a` — the designs' two hexes,
 * written here as LITERALS so this file cannot drift along with a changed constant.
 *
 * ⚠ What a headless context can say: which INK each mark and word was ISSUED in, and which words were
 * drawn. Not what the pixels look like — the live step pixel-samples.
 *
 * Each case names the sabotage that was RUN (made, watched red, reverted).
 */
import { describe, it, expect } from 'vitest';
import { makeHeadlessNav } from './helpers/headlessNav.mjs';
import * as navDrill from '../navDrill.js';
import { planetTrueScene } from '../navViewModes/shipState.js';
import { earthRadiiToScene } from '../../core/ScaleConstants.js';
import * as navGrid from '../navGrid.js';

const CURRENT = '#2ee6c0';
const TARGET = '#ffb03a';
const RETIRED = /#00ff80|#00d4ff|0,\s*255,\s*128|0,\s*212,\s*255/i;
const W = 614, H = 512;
const E = earthRadiiToScene(1);
const O = { x: 0, y: 0, z: 0 };

/** Every fill / stroke / text with the style it was issued in (and each path's first point). */
function inkRecorder() {
  const ops = [];
  const st = { fillStyle: '#000', strokeStyle: '#000', font: '10px x', textAlign: 'left', globalAlpha: 1, lineWidth: 1 };
  let first = null, ty = 0;
  const stack = [];
  const ctx = new Proxy({}, {
    get(_t, k) {
      switch (k) {
        case 'save': return () => { stack.push(ty); };
        case 'restore': return () => { if (stack.length) ty = stack.pop(); };
        case 'translate': return (_x, y) => { ty += y; };
        case 'canvas': return { width: W, height: H };
        case 'beginPath': return () => { first = null; };
        case 'moveTo': case 'arc': return (x, y) => { if (!first) first = { x, y }; };
        case 'fill': return () => ops.push({ op: 'fill', style: st.fillStyle, at: first });
        case 'stroke': return () => ops.push({ op: 'stroke', style: st.strokeStyle, at: first });
        case 'fillRect': return (x, y, w, h) => ops.push({ op: 'fillRect', style: st.fillStyle, at: { x, y, w, h } });
        case 'strokeRect': return (x, y, w, h) => ops.push({ op: 'strokeRect', style: st.strokeStyle, at: { x, y, w, h } });
        case 'fillText': case 'strokeText': return (s, x, y) => ops.push({ op: 'text', s: String(s), style: k === 'fillText' ? st.fillStyle : st.strokeStyle, at: { x, y }, ty });
        case 'measureText': return (s) => ({ width: String(s).length * 6 });
        case 'createLinearGradient': case 'createRadialGradient': case 'createPattern': return () => ({ addColorStop() {} });
        case 'getImageData': case 'createImageData': return (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(Math.max(0, w * h * 4)) });
        default:
          if (k in st) return st[k];
          if (typeof k === 'symbol') return undefined;
          return () => {};
      }
    },
    set(_t, k, v) { st[k] = v; return true; },
    has() { return true; },
  });
  return { ctx, ops };
}

let H_;
async function nav0() {
  if (!H_) H_ = await makeHeadlessNav({ width: W, height: H });
  const nav = H_.nav;
  nav.viewMode = null;
  return nav;
}
/** One whole legacy frame (render(), so the HUD and tabs are in it), every op recorded. */
function frame(nav) {
  const rec = inkRecorder();
  const real = nav._ctx;
  nav._ctx = rec.ctx;
  try { nav.render(); } finally { nav._ctx = real; }
  return rec.ops;
}
const texts = (ops) => ops.filter((o) => o.op === 'text');
const wordAt = (ops, s) => texts(ops).find((o) => o.s === s);

/** Legacy at a 2D/prism level, at Sol, with a warp target and the autopilot on. */
async function at2D(level) {
  const nav = await nav0();
  nav._systemData = null; nav._currentSystemData = null; nav._selectedNavStar = null;
  nav._selectedBody = null; nav._hoveredBody = null; nav._mouseX = -999; nav._mouseY = -999;
  nav.setPlayerPosition({ x: 8, y: 0, z: 0 });
  nav._currentSystemName = 'HOME SYSTEM';
  if (!nav._currentSector?.address) throw new Error('fixture: setPlayerPosition no longer resolves the player\'s sector');
  nav.setAutopilotState(true);
  nav.setExternalTarget({ x: 8.0008, y: 0, z: 0.0006 }, 'THE TARGET');
  nav._levelIndex = level; nav._applyLevelView?.();
  if (nav._anim) nav._anim = null;
  return nav;
}

const moonsOf = (orbits) => orbits.map((o, j) => ({ type: 'rock', radiusEarth: 0.3, orbitRadiusEarth: o, startAngle: 0.4 + j * 1.7 }));
const makeSys = () => ({
  star: { type: 'G', radiusSolar: 1.0 },
  planets: [0.39, 0.72, 1.0, 1.52, 5.2, 9.5].map((au, i) => ({
    orbitRadiusAU: au, orbitAngle: i * 0.8,
    moons: i >= 4 ? moonsOf([40, 70, 110]) : [],
    planetData: { radiusEarth: i >= 4 ? 10 : 1, T_eq: 300, type: i >= 4 ? 'gas-giant' : 'rocky' },
  })),
});
/** Legacy SYSTEM (orrery or a planet's detail) with the ship published beside planet 1. */
async function atSystem({ mode = 'system', planet = -1, selected = null } = {}) {
  const nav = await nav0();
  const sys = makeSys();
  nav._systemZoom = 1; nav._externalTarget = null; nav._selectedNavStar = null;
  nav._systemStar = { name: 'Test', seed: 1, wx: 8.001, wy: 0.0002, wz: 0.0003, spectral: 'G' };
  nav._playerX = 8.001; nav._playerY = 0.0002; nav._playerZ = 0.0003;
  nav._systemData = sys; nav._currentSystemData = sys; nav._levelIndex = 4;
  nav._systemMode = mode; nav._selectedPlanetIdx = planet;
  nav._hoveredBody = null; nav._mouseX = -999; nav._mouseY = -999;
  nav.setCurrentBody(-1, -1);
  nav._selectedBody = selected; nav._commitAction = selected ? nav._buildCommitAction() : null;
  const p1 = planetTrueScene(sys.planets[1], O);
  nav.setShipState({ pos: { x: p1.x + 2 * E, y: p1.y, z: p1.z }, origin: { ...O }, sysKey: sys });
  return nav;
}
const legacyOps = (nav) => { const rec = inkRecorder(); nav._renderSystem(rec.ctx, W, H); return rec.ops; };

describe('AC-15 legacy — no retired ink and no SHIP / YOU word anywhere', () => {
  it('every legacy level (GALAXY, SECTOR, REGION, PRISM, SYSTEM orrery, planet detail) with a target set', async () => {
    // ⛔ SABOTAGE RUN: line 2956's word back to 'SHIP' → red on the orrery frame. Line 3976's target
    //    diamond back to '#00ff80' → red on the 2D levels.
    const frames = [];
    for (const lv of [0, 1, 2, 3]) frames.push([`level ${lv}`, frame(await at2D(lv))]);
    frames.push(['orrery', legacyOps(await atSystem({ selected: { type: 'planet', planetIndex: 4 } }))]);
    frames.push(['planet detail', legacyOps(await atSystem({ mode: 'planet', planet: 4, selected: { type: 'moon', planetIndex: 4, moonIndex: 1 } }))]);
    for (const [label, ops] of frames) {
      expect(ops.length, `${label}: fixture drew nothing`).toBeGreaterThan(5);
      const bad = ops.filter((o) => typeof o.style === 'string' && RETIRED.test(o.style));
      expect(bad.map((o) => `${o.op} ${o.style} ${o.s || ''}`), `${label}: a retired ink is still issued`).toEqual([]);
      const words = texts(ops).filter((o) => /\b(SHIP|YOU)\b/.test(o.s));
      expect(words.map((o) => o.s), `${label}: a SHIP / YOU word is still drawn`).toEqual([]);
    }
  }, 60000);
});

describe('AC-15 legacy — the player marker reads CURRENT, in the CURRENT ink', () => {
  for (const [label, opts] of [
    ['orrery', {}],
    ['planet detail', { mode: 'planet', planet: 1 }],
  ]) {
    it(`${label}: the word CURRENT under a CURRENT diamond`, async () => {
      // ⛔ SABOTAGE RUN: the word's fillStyle left at the retired 'rgba(0, 255, 128, 0.6)' → red.
      const ops = legacyOps(await atSystem(opts));
      const word = wordAt(ops, 'CURRENT');
      expect(word, 'no CURRENT word at the ship').toBeTruthy();
      expect(word.style).toBe(CURRENT);
      const dia = ops.find((o) => o.op === 'fill' && o.style === CURRENT && o.at && Math.abs(o.at.x - word.at.x) < 1e-6 && o.at.y < word.at.y);
      expect(dia, 'no CURRENT-ink diamond above the word').toBeTruthy();
    }, 60000);
  }

  it('the HUD: CURRENT SYSTEM, its name and the sector name are CURRENT ink (s-sky: name = marker ink)', async () => {
    // ⛔ SABOTAGE RUN: the system name's fillStyle back to '#fff' → red.
    const nav = await at2D(1);
    const ops = frame(nav);
    for (const s of ['CURRENT SYSTEM', 'HOME SYSTEM', nav._currentSector.name]) {
      expect(wordAt(ops, s)?.style, s).toBe(CURRENT);
    }
  }, 60000);

  for (const lv of [0, 1]) {
    it(`the player's cell on ${lv ? 'SECTOR' : 'GALAXY'} is stroked in CURRENT; the viewed level's tab border is CURRENT`, async () => {
      // ⛔ SABOTAGE RUN: GALAXY's sector stroke (:1842) / SECTOR's cell stroke (:1665) back to the
      //    retired cyan → red at that level; the active tab's border back to blue → red.
      const ops = frame(await at2D(lv));
      expect(ops.some((o) => o.op === 'strokeRect' && o.style === CURRENT && o.at.w > 4 && o.at.y < H - 40), 'the player cell').toBe(true);
      expect(ops.some((o) => o.op === 'strokeRect' && o.style === CURRENT && o.at.y >= H - 40), 'the active tab').toBe(true);
    }, 60000);
  }
  it('⭐ batch 2 fixup — a BROWSED sector\'s tab is not CURRENT (CURRENT only on the player\'s own place, as the designs)', async () => {
    // ⛔ SABOTAGE RUN: `own` back to `active` (every viewed tab CURRENT) → red.
    const nav = await at2D(1);
    const own = navGrid.parentAt(1, nav._playerX, nav._playerZ);
    const east = { sector: { i: own.sector.i + 1, j: own.sector.j } };
    const v = navGrid.viewForAddress(1, east);
    nav._viewStack[1] = { center: { x: v.cx, z: v.cz }, size: v.size, address: east };
    nav._viewCenter = { x: v.cx, z: v.cz };
    const ops = frame(nav);
    const tabs = ops.filter((o) => o.op === 'strokeRect' && o.at.y >= H - 40);
    expect(tabs.length, 'fixture: no tabs').toBe(5);
    expect(tabs.filter((o) => o.style === CURRENT).length, 'a browsed sector\'s tab is CURRENT').toBe(0);
    expect(tabs.some((o) => o.style === '#64b4ff'), 'the active tab lost its highlight').toBe(true);
  }, 60000);
});

describe('AC-15 legacy — the target is TARGET ink, and nothing else uses either ink', () => {
  it('the warp-target diamond and its name on a 2D level', async () => {
    // ⛔ SABOTAGE RUN: `_drawTargetMarker`'s label back to '#00ff80' → red.
    const ops = frame(await at2D(1));
    expect(wordAt(ops, 'THE TARGET')?.style, 'the target name').toBe(TARGET);
    expect(ops.some((o) => o.op === 'stroke' && o.style === TARGET), 'the target diamond').toBe(true);
  }, 60000);

  it('the orrery: the selected body\'s ring and the commit button are TARGET', async () => {
    // ⛔ SABOTAGE RUN: `selColor` back to `isCurrent ? '#00ff80' : blue` → red (and the retired-ink case above).
    const ops = legacyOps(await atSystem({ selected: { type: 'planet', planetIndex: 4 } }));
    expect(ops.some((o) => o.op === 'stroke' && o.style === TARGET && o.at), 'the selection ring').toBe(true);
    const btn = texts(ops).find((o) => /BURN|GO TO|WARP/.test(o.s));
    expect(btn, 'fixture: no commit button').toBeTruthy();
    expect(btn.style).toBe(TARGET);
  }, 60000);

  it('AUTOPILOT ON is drawn in neither reserved ink', async () => {
    // ⛔ SABOTAGE RUN: the ON colour set to INK.CURRENT → red.
    const ops = frame(await at2D(1));
    const ap = texts(ops).find((o) => /AUTOPILOT ON/.test(o.s));
    expect(ap, 'fixture: autopilot label not drawn').toBeTruthy();
    expect([CURRENT, TARGET]).not.toContain(String(ap.style).toLowerCase());
  }, 60000);
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// ⭐ BATCH 2 FIXUP — the live step's legacy FAIL (s-sky on SYSTEM, the gold star names, the search box over the
//    HUD) and Astra's legacy findings 2, 3, 4 (2026-10-03).
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('batch 2 fixup — legacy s-sky, star names, search', () => {
  it('⭐⭐ SYSTEM (orrery): the system title is CURRENT when it is the system you are in, white when it is not', async () => {
    // ⛔ SABOTAGE RUN: `_drawSystemHeader`'s fillStyle back to '#fff' → red. (The old s-sky test only ran at
    //    SECTOR, where this header is never drawn — Astra 12.)
    let nav = await atSystem();
    expect(nav._isCurrentSystem(), 'fixture: the ship must be in this system').toBe(true);
    let ops = legacyOps(nav);
    expect(wordAt(ops, 'Test')?.style, 'home: the system title').toBe(CURRENT);
    expect(ops.some((o) => o.op === 'fill' && o.style === CURRENT), 'home: the CURRENT marker beside it').toBe(true);
    nav = await atSystem();
    nav._playerX += 0.5;
    expect(nav._isCurrentSystem(), 'fixture: now foreign').toBe(false);
    ops = legacyOps(nav);
    expect(wordAt(ops, 'Test')?.style, 'foreign: the system title is not CURRENT').toBe('#fff');
  }, 60000);

  it('⭐ SYSTEM (orrery): the selected planet\'s name is TARGET, like its ring', async () => {
    // ⛔ SABOTAGE RUN: the planet label's fillStyle back to 'rgba(255,255,255,0.4)' for every planet → red.
    const nav = await atSystem({ selected: { type: 'planet', planetIndex: 4 } });
    const ops = legacyOps(nav);
    const name = nav._planetDisplayName(4, 'Test');
    expect(wordAt(ops, name)?.style, `the selected planet's name (${name})`).toBe(TARGET);
    expect(wordAt(ops, nav._planetDisplayName(3, 'Test'))?.style, 'an unselected planet keeps its grey').toBe('rgba(255,255,255,0.4)');
  }, 60000);

  /** PRISM with the player standing on a loaded star, named and catalogued so the label pass names it. */
  async function prismOnOwnStar() {
    const nav = await at2D(3);
    nav.setExternalTarget?.(null);
    nav._externalTarget = null;
    frame(nav);
    const rows = nav._localStars || [];
    const s = rows.find((r) => Number.isFinite(r.wx) && r.dist > 0.0005) || rows[0];
    if (!s) throw new Error('fixture: no prism rows loaded');
    s.isReal = true; s.name = 'OWNSTAR';
    nav._playerX = s.wx; nav._playerY = s.wy; nav._playerZ = s.wz;
    nav._localCenter = { x: s.wx, y: s.wy, z: s.wz };
    return { nav, s, rows };
  }

  it('⭐⭐ PRISM: your own star, selected, is CURRENT — its name, no TARGET ring, no "WARP TARGET" banner (live FAIL 2 on legacy)', async () => {
    // ⛔ SABOTAGE RUN: the ring test back to `if (isSelected)` → a TARGET stroke on your own star, red; the
    //    label `ink` back to TARGET-first → red.
    const { nav, s } = await prismOnOwnStar();
    nav._selectedNavStar = s;
    const ops = frame(nav);
    expect(navDrill.hereStar(nav, nav._localStars), 'fixture: the player must be on the star').toBe(s);
    const lbl = texts(ops).find((o) => o.s.startsWith('OWNSTAR'));
    expect(lbl, 'fixture: your own star is not labelled').toBeTruthy();
    expect(lbl.style, 'your own star\'s name').toBe(CURRENT);
    expect(texts(ops).some((o) => o.s === 'WARP TARGET'), 'a WARP TARGET banner for the system you are in').toBe(false);
    expect(ops.filter((o) => o.op === 'stroke' && o.style === TARGET).length, 'a TARGET ring on your own star').toBe(0);
  }, 60000);

  it('⭐ PRISM after a warp: the selection is the OLD column\'s row object for the star you are now at — still no WARP TARGET banner (live, Sirius)', async () => {
    // ⛔ SABOTAGE RUN: the banner test without `isHereStar` (object identity only) → "WARP TARGET" drawn, red.
    const { nav, s } = await prismOnOwnStar();
    nav._selectedNavStar = { ...s };                  // the same star, not the same object
    const ops = frame(nav);
    expect(texts(ops).some((o) => o.s === 'WARP TARGET'), 'a WARP TARGET banner for the system you are in').toBe(false);
  }, 60000);

  it('⭐⭐ PRISM: no star name is gold (#ffc850, 24 units off TARGET); the target\'s name is TARGET, the rest a neutral that is neither', async () => {
    // ⛔ SABOTAGE RUN: the label pass's fillStyle back to '#ffc850' → red.
    const { nav, s, rows } = await prismOnOwnStar();
    const other = rows.find((r) => r !== s && Number.isFinite(r.wx));
    other.isReal = true; other.name = 'OTHERSTAR';
    rows.filter((r) => r !== s && r !== other).slice(0, 6).forEach((r, i) => { r.isReal = true; r.name = `ZZSTAR${i}`; });
    nav._selectedNavStar = other;
    const ops = frame(nav);
    const labels = texts(ops).filter((o) => /^(OWNSTAR|OTHERSTAR|ZZSTAR\d)/.test(o.s));
    expect(labels.length, 'fixture: no star labels').toBeGreaterThan(1);
    expect(labels.filter((o) => String(o.style).toLowerCase() === '#ffc850').map((o) => o.s), 'gold names').toEqual([]);
    expect(texts(ops).find((o) => o.s.startsWith('OTHERSTAR'))?.style, 'the target\'s name').toBe(TARGET);
    const rest = labels.filter((o) => !o.s.startsWith('OTHERSTAR') && !o.s.startsWith('OWNSTAR'));
    for (const o of rest) expect([CURRENT, TARGET], `${o.s}: a plain star name in a reserved ink`).not.toContain(String(o.style).toLowerCase());
  }, 60000);

  it('⭐ the search box\'s highlighted row is TARGET (s-search on legacy; it was blue / white)', async () => {
    // ⛔ SABOTAGE RUN: the `.nav-search-row.hl` rule back to `rgba(60,130,220,0.28)` / `#eaf4ff` → red.
    const nav = await nav0();
    const saved = globalThis.document;
    let css = '';
    const el = () => ({ style: {}, className: '', setAttribute() {}, appendChild() {}, addEventListener() {}, blur() {}, focus() {} });
    globalThis.document = { getElementById: () => null, createElement: () => el(), head: { appendChild: (n) => { css += n.textContent || ''; } } };
    const realCanvas = nav._canvas, realDom = nav._searchDom;
    try {
      nav._searchDom = null;
      nav._canvas = Object.assign(Object.create(realCanvas), { parentElement: { appendChild() {} } });
      nav._ensureSearchDom();
    } finally { globalThis.document = saved; nav._canvas = realCanvas; nav._searchDom = realDom; }
    const rule = (css.match(/\.nav-search-row\.hl\s*\{[^}]*\}/) || [''])[0];
    expect(rule, 'fixture: no highlight rule').not.toBe('');
    expect(rule).toContain('255, 176, 58');
    expect(rule.toLowerCase()).toContain('#ffb03a');
  }, 60000);

  it('⭐⭐ the top-left HUD steps down clear of the open search box (CURRENT SYSTEM and its name were under it)', async () => {
    // ⛔ SABOTAGE RUN: `_searchShift` returning 0 → the HUD's first line is drawn under the box, red.
    const nav = await at2D(1);
    const realDom = nav._searchDom, realRect = nav._canvas.getBoundingClientRect;
    const boxBottom = 46;   // CSS px: the box is 12 px from the top and 34 tall, as the overlay's CSS lays it out
    nav._searchDom = { root: { style: { display: 'block' } }, input: { getBoundingClientRect: () => ({ left: 12, top: 12, bottom: boxBottom, height: 34 }) } };
    nav._canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: nav._canvas.width, height: nav._canvas.height });
    let ops;
    try { ops = frame(nav); } finally { nav._searchDom = realDom; nav._canvas.getBoundingClientRect = realRect; }
    for (const s of ['CURRENT SYSTEM', 'HOME SYSTEM']) {
      const o = wordAt(ops, s);
      expect(o, `fixture: ${s} not drawn`).toBeTruthy();
      expect(o.style, `${s}: still CURRENT`).toBe(CURRENT);
      expect(o.at.y + o.ty - 16, `${s}: its top (baseline ${o.at.y + o.ty}) is under the search box (bottom ${boxBottom})`).toBeGreaterThanOrEqual(boxBottom);
    }
    // …and with no search box nothing moves (every other headless frame)
    const plain = frame(await at2D(1));
    expect(wordAt(plain, 'CURRENT SYSTEM').ty, 'the HUD moved with no search box').toBe(0);
  }, 60000);
});
