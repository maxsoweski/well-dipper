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
import { planetTrueScene } from '../navViewModes/shipState.js';
import { earthRadiiToScene } from '../../core/ScaleConstants.js';

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
  let first = null;
  const ctx = new Proxy({}, {
    get(_t, k) {
      switch (k) {
        case 'canvas': return { width: W, height: H };
        case 'beginPath': return () => { first = null; };
        case 'moveTo': case 'arc': return (x, y) => { if (!first) first = { x, y }; };
        case 'fill': return () => ops.push({ op: 'fill', style: st.fillStyle, at: first });
        case 'stroke': return () => ops.push({ op: 'stroke', style: st.strokeStyle, at: first });
        case 'fillRect': return (x, y, w, h) => ops.push({ op: 'fillRect', style: st.fillStyle, at: { x, y, w, h } });
        case 'strokeRect': return (x, y, w, h) => ops.push({ op: 'strokeRect', style: st.strokeStyle, at: { x, y, w, h } });
        case 'fillText': case 'strokeText': return (s, x, y) => ops.push({ op: 'text', s: String(s), style: k === 'fillText' ? st.fillStyle : st.strokeStyle, at: { x, y } });
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
