/**
 * THE GPS LINE (2026-10-02) — the LEGACY painter (`NavComputer._renderSystem` and
 * `_renderPlanetDetail`), which keeps its dashes [6, 4], alpha 0.6 and the 12-px arrow offset and
 * changes only its geometry. Its ink was its own ship green (`#00ff80`) until naming-prism-segments
 * AC-15 (Max 2026-10-03): the ship, its word and its route are the CURRENT ink now.
 *
 * Max (verbatim): *"the GPS line should also draw to moons, and again it should draw from wherever
 * the player is currently."*
 *
 * ⭐ THE CONTEXT RECORDS PATHS WITH THEIR STYLE. `headlessNav`'s recording context swallows property
 *    writes, so it cannot tell a green stroke from a grey one; this one keeps `fillStyle`,
 *    `strokeStyle` and the dash, and records each `fill()` / `stroke()` with the path it painted.
 * Each case names the sabotage that was RUN (made, watched red, reverted).
 */
import { describe, it, expect } from 'vitest';
import { makeHeadlessNav } from './helpers/headlessNav.mjs';
import { planetTrueScene, moonRelScene } from '../navViewModes/shipState.js';
import { earthRadiiToScene } from '../../core/ScaleConstants.js';

const W = 614, H = 512;
const E = earthRadiiToScene(1);
const O = { x: 0, y: 0, z: 0 };
const GREEN = '#2ee6c0';   // ⭐ AC-15: the CURRENT ink (was legacy's own ship green #00ff80) — the name is kept so the cases below read as they were written

function pathRecorder() {
  const ops = [];
  let path = [], st = { fillStyle: '#000', strokeStyle: '#000', dash: [] };
  const ctx = new Proxy({}, {
    get(_t, k) {
      switch (k) {
        case 'beginPath': return () => { path = []; };
        case 'moveTo': return (x, y) => path.push(['M', x, y]);
        case 'lineTo': return (x, y) => path.push(['L', x, y]);
        case 'arc': return (x, y, r) => path.push(['A', x, y, r]);
        case 'ellipse': return (x, y) => path.push(['E', x, y]);
        case 'closePath': return () => path.push(['Z']);
        case 'setLineDash': return (d) => { st.dash = d.slice(); };
        case 'fill': return () => ops.push({ op: 'fill', style: st.fillStyle, path: path.slice(), dash: st.dash });
        case 'stroke': return () => ops.push({ op: 'stroke', style: st.strokeStyle, path: path.slice(), dash: st.dash });
        case 'measureText': return (s) => ({ width: String(s).length * 6 });
        case 'createLinearGradient': case 'createRadialGradient': return () => ({ addColorStop() {} });
        case 'fillText': return (s, x, y) => ops.push({ op: 'text', s: String(s), x, y, style: st.fillStyle });
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

const moonsOf = (orbits) => orbits.map((o, j) => ({ type: 'rock', radiusEarth: 0.3, orbitRadiusEarth: o, startAngle: 0.4 + j * 1.7 }));
function makeSys() {
  return {
    star: { type: 'G', radiusSolar: 1.0 },
    planets: [0.39, 0.72, 1.0, 1.52, 5.2, 9.5].map((au, i) => ({
      orbitRadiusAU: au, orbitAngle: i * 0.8,
      moons: i >= 4 ? moonsOf([40, 70, 110]) : [],
      planetData: { radiusEarth: i >= 4 ? 10 : 1, T_eq: 300, type: i >= 4 ? 'gas-giant' : 'rocky' },
    })),
  };
}

let H_;
async function legacyAt({ sys = makeSys(), mode = 'system', planet = -1 } = {}) {
  if (!H_) H_ = await makeHeadlessNav({ width: W, height: H });
  const nav = H_.nav;
  nav.viewMode = null; nav._systemZoom = 1;
  nav._systemStar = { name: 'Test', seed: 1, wx: 8.001, wy: 0.0002, wz: 0.0003, spectral: 'G' };
  nav._playerX = 8.001; nav._playerY = 0.0002; nav._playerZ = 0.0003;
  nav._systemData = sys; nav._currentSystemData = sys; nav._levelIndex = 4;
  nav._systemMode = mode; nav._selectedPlanetIdx = planet;
  nav._selectedBody = null; nav._hoveredBody = null; nav._mouseX = -999; nav._mouseY = -999;
  nav.setCurrentBody(-1, -1);
  return nav;
}
function publish(nav, T) { nav.setShipState({ pos: { ...T }, origin: { ...O }, sysKey: nav._systemData }); }
function frame(nav) { const { ctx, ops } = pathRecorder(); nav._renderSystem(ctx, W, H); return ops; }
const P = (nav, i) => planetTrueScene(nav._systemData.planets[i], O);
const plus = (a, b, k = 1) => ({ x: a.x + b.x * k, y: a.y + b.y * k, z: a.z + b.z * k });
/** The ship diamond: a green fill whose path is M,L,L,L,Z with the top point 7 above the centre. */
const diamondOf = (ops) => {
  const d = ops.find((o) => o.op === 'fill' && o.style === GREEN && o.path.length === 5 && o.path[0][0] === 'M'
    && Math.abs(o.path[1][2] - (o.path[0][2] + 7)) < 1e-9);
  return d ? { x: d.path[0][1], y: d.path[0][2] + 7 } : null;
};
const trajOf = (ops) => ops.find((o) => o.op === 'stroke' && o.style === GREEN && o.dash.length === 2 && o.dash[0] === 6);
const discs = (ops) => ops.filter((o) => o.op === 'fill' && o.path.length === 1 && o.path[0][0] === 'A').map((o) => ({ x: o.path[0][1], y: o.path[0][2], r: o.path[0][3], style: o.style }));

describe('GPS line — legacy orrery', () => {
  it('L1 ⛔ PLANETS AT THEIR LIVE ANGLE, AND A SHIP AT ONE STANDS ON IT', async () => {
    // ⛔ SABOTAGE RUN: `livePlanetAngle` returning the frozen `p.orbitAngle` → planet 2's disc does not
    //    move when its live angle does, red.
    const nav = await legacyAt();
    const p2 = nav._systemData.planets[2];
    const before = discs(frame(nav));
    p2._live = { orbitAngle: p2.orbitAngle + 1.3 };
    publish(nav, plus(P(nav, 2), { x: 2 * E, y: 0, z: 0 }));
    const ops = frame(nav);
    const after = discs(ops);
    const moved = after.filter((d) => !before.some((b) => Math.abs(b.x - d.x) < 1e-6 && Math.abs(b.y - d.y) < 1e-6));
    expect(moved.length, 'exactly the live planet moved').toBeGreaterThanOrEqual(1);
    const dia = diamondOf(ops);
    expect(dia, 'a diamond').toBeTruthy();
    expect(moved.some((d) => Math.hypot(d.x - dia.x, d.y - dia.y) < 1e-6), 'the diamond is on the moved planet').toBe(true);
  });

  it('L2 ⛔ IN OPEN SPACE THE SHIP IS PROJECTED FROM ITS OWN POSITION: half the radius → 1/√2 of the way out', async () => {
    // ⛔ SABOTAGE RUN: `legacyShip` answering the focus pair whatever was published → the diamond is on
    //    the star (focus -1), red.
    const nav = await legacyAt();
    publish(nav, plus(P(nav, 3), { x: 0, y: 0, z: 0 }));
    const atP3 = diamondOf(frame(nav));
    publish(nav, plus(O, P(nav, 3), 0.5));
    const half = diamondOf(frame(nav));
    publish(nav, { x: 0, y: 0, z: 0 });
    const star = diamondOf(frame(nav));
    expect(Math.hypot(half.x - star.x - (atP3.x - star.x) / Math.SQRT2, half.y - star.y - (atP3.y - star.y) / Math.SQRT2))
      .toBeLessThan(1e-6);
    expect(Math.hypot(half.x - star.x, half.y - star.y)).toBeGreaterThan(10);
  });

  it('L3 ⛔ A MOON IS A TARGET: the dashed stroke ends ON the moon dot and the arrow tip sits 12 px back', async () => {
    // ⛔ SABOTAGE RUN: `legacyOrreryTarget` returning null for a moon (today's code) → no trajectory
    //    stroke, red.
    const nav = await legacyAt();
    publish(nav, plus(P(nav, 1), { x: 2 * E, y: 0, z: 0 }));
    nav._selectedBody = { type: 'moon', planetIndex: 4, moonIndex: 1 };
    const ops = frame(nav);
    const tr = trajOf(ops);
    expect(tr, 'a dashed green stroke').toBeTruthy();
    const end = tr.path[1], start = tr.path[0];
    const moonDots = discs(ops).filter((d) => d.style === 'rgba(200, 200, 200, 0.7)');
    expect(moonDots.some((d) => Math.hypot(d.x - end[1], d.y - end[2]) < 1e-6), 'the stroke ends on a moon dot').toBe(true);
    const arrow = ops.find((o) => o.op === 'fill' && o.style === GREEN && o.path.length === 4);
    const len = Math.hypot(end[1] - start[1], end[2] - start[2]);
    const tip = { x: end[1] - (end[1] - start[1]) / len * 12, y: end[2] - (end[2] - start[2]) / len * 12 };
    expect(arrow && Math.hypot(arrow.path[0][1] - tip.x, arrow.path[0][2] - tip.y), 'the arrow tip, 12 px back').toBeLessThan(1e-6);
  });
});

describe('GPS line — legacy planet detail', () => {
  it('L4 ⛔ THE SHIP AT ANOTHER PLANET: an edge triangle, and the dashed line from it to the selected moon', async () => {
    // ⛔ SABOTAGE RUN: restoring the focus gate (`isCurrent && this._currentFocusIndex === idx`) →
    //    nothing green draws in the detail, red.
    const nav = await legacyAt({ mode: 'planet', planet: 4 });
    publish(nav, plus(P(nav, 1), { x: 2 * E, y: 0, z: 0 }));
    nav._selectedBody = { type: 'moon', planetIndex: 4, moonIndex: 1 };
    const ops = frame(nav);
    const tri = ops.find((o) => o.op === 'fill' && o.style === GREEN && o.path.length === 4);
    expect(tri, 'an edge triangle').toBeTruthy();
    const tip = tri.path[0];
    const toRim = Math.min(tip[1], W - tip[1], tip[2], H - tip[2]);
    expect(toRim, 'on the pane rim').toBeLessThan(16);
    const tr = trajOf(ops);
    expect(tr, 'and a dashed line').toBeTruthy();
    const moonDots = discs(ops).filter((d) => d.style === '#b0b0b0');
    expect(moonDots.some((d) => Math.hypot(d.x - tr.path[1][1], d.y - tr.path[1][2]) < 1e-6), 'ending on a moon of this planet').toBe(true);
  });

  it('L5 ⛔ A TARGET OUTSIDE THIS PLANET (the star) GETS AN EDGE TRIANGLE, NOT THE CENTRE PLANET', async () => {
    // ⛔ SABOTAGE RUN: `legacyDetailTarget` answering the centre for every non-moon target (today's
    //    `destP = planetP`) → the line ends on the planet, red.
    const nav = await legacyAt({ mode: 'planet', planet: 4 });
    const half = plus(P(nav, 4), moonRelScene(nav._systemData.planets[4], 0), 0.5);
    publish(nav, half);
    nav._selectedBody = { type: 'star', starIndex: 0 };
    const ops = frame(nav);
    const tr = trajOf(ops);
    expect(tr, 'a dashed line').toBeTruthy();
    const end = tr.path[1];
    const toRim = Math.min(end[1], W - end[1], end[2], H - end[2]);
    expect(toRim, `it ends on the pane rim (${toRim.toFixed(1)})`).toBeLessThan(16);
    const tris = ops.filter((o) => o.op === 'fill' && o.style === GREEN && o.path.length === 4);
    expect(tris.length, 'with an edge triangle at that end').toBeGreaterThanOrEqual(1);
    // and the ship itself, halfway to the inner moon, is a diamond INSIDE the picture
    expect(diamondOf(ops), 'the ship is drawn inside this planet\'s picture').toBeTruthy();
  });
});
