/**
 * THE GPS LINE (2026-10-02) — designs 1 and 2: the ship from WHERE IT IS, and the route to planets,
 * moons and the star, on the whole-system pictures and inside a planet's moon sub-view.
 *
 * Max (verbatim): *"Yes, the GPS line should also draw to moons, and again it should draw from
 * wherever the player is currently. I'm not sure how you make this work on the two-dimensional line
 * view exactly, but I'm sure you can figure it out."*
 *
 * Every assertion reads the glass the way `navRestorations3.design.test.js` does: the shipped `S`/`D`
 * repainted through an ink-recording context, `drawPixelText` wrapped so words are visible. The ship is
 * published exactly as main.js publishes it — `nav.setShipState({pos, origin, sysKey})` — and then the
 * real nav renders, so `state.js`'s `deriveShip` is upstream of every picture below.
 *
 * Each case names the sabotage that was RUN (made, watched red, reverted) in its header.
 */
import { describe, it, expect } from 'vitest';
import { makeHeadlessNav } from './helpers/headlessNav.mjs';
import { makeDesigns } from '../navViewModes/designs.js';
import { planetTrueScene, moonRelScene } from '../navViewModes/shipState.js';
import { FACE, drawPixelText, measurePixelText } from '../../rendering/PixelText.js';
import { earthRadiiToScene } from '../../core/ScaleConstants.js';

const W = 417, H = 240;
const E = earthRadiiToScene(1);
const O = { x: 0, y: 0, z: 0 };

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
  // ⚠ `labelHits` is SNAPSHOT: `S` is the nav's own object, so a second paint would overwrite it.
  return { fills, lines, viol, violations: d.violations(), regions: d.regions(), d, S, D, labelHits: (S.labelHits || []).slice(),
           INK: d.INK, text: lines.map((l) => l.s).join('\n') };
}

/** Eight planets; moons with real orbits on planet 2 (one) and planets 4-7 (three each). Planet 4 is
 *  10 Earth radii and its innermost moon is at 40 (4R), INSIDE its 8R arrival radius — a giant's shape. */
const moonsOf = (orbits) => orbits.map((o, j) => ({ type: 'rock', radiusEarth: 0.3, T_eq: 100,
                                                     orbitRadiusEarth: o, startAngle: 0.4 + j * 1.7 }));
function makeSys() {
  return {
    star: { type: 'G', radiusSolar: 1.0 }, ageGyr: 4.6, isBinary: false,
    zones: { hzInnerAU: 0.9, hzOuterAU: 1.4 },
    asteroidBelts: [{ centerRadiusAU: 2.7, widthAU: 1.2 }],
    planets: [0.39, 0.72, 1.0, 1.52, 5.2, 9.5, 19.2, 30.1].map((au, i) => ({
      orbitRadiusAU: au, orbitAngle: i * 0.8,
      moons: i >= 4 ? moonsOf([40, 70, 110]) : (i === 2 ? moonsOf([60]) : []),
      planetData: { radiusEarth: i >= 4 ? 6 + i : 1, T_eq: 400 - i * 40, type: i >= 4 ? 'gas giant' : 'rocky',
                    habitability: { score: i === 2 ? 0.9 : 0.1 }, rings: i === 5 },
    })),
  };
}

let H_;
async function nav0() {
  if (!H_) {
    H_ = await makeHeadlessNav({ width: W, height: H });
    H_.nav._viewModesEnabled = true; H_.nav._levelIndex = 3; H_.nav.viewMode = 'rail'; H_.nav.render();
  }
  return H_.nav;
}
/** SYSTEM, in `mode`, on a fresh copy of the fixture, nothing selected, no sub-view. */
async function at(mode, { current = true, sys = makeSys() } = {}) {
  const nav = await nav0();
  nav.viewMode = mode; nav._systemZoom = 1; nav._systemRotY = 0;
  nav._systemStar = nav._localStars.reduce((m, s) => (m == null || s.dist < m.dist ? s : m), null);
  nav._playerX = nav._systemStar.wx + (current ? 0 : 0.5);
  nav._playerY = nav._systemStar.wy; nav._playerZ = nav._systemStar.wz;
  nav._systemData = sys; nav._currentSystemData = sys; nav._levelIndex = 4;
  nav._mouseX = -99; nav._mouseY = -99;
  nav._selectedBody = null; nav._commitAction = null;
  nav.setCurrentBody(-1, -1);
  nav.render();
  const S = nav._viewDriverInst.S; S.sysView = 'system'; S.detailPlanet = -1;
  return nav;
}
/** Publish the ship at a SYSTEM-CENTRED scene position `T`, through a non-zero rebase origin. */
function publish(nav, T, origin = { x: 37, y: -2, z: 91 }) {
  nav.setShipState({ pos: { x: T.x - origin.x, y: T.y - origin.y, z: T.z - origin.z }, origin, sysKey: nav._systemData });
  nav.render();
}
const P = (nav, i) => planetTrueScene(nav._systemData.planets[i], O);
const M = (nav, i, j) => { const p = P(nav, i), m = moonRelScene(nav._systemData.planets[i], j); return { x: p.x + m.x, y: p.y + m.y, z: p.z + m.z }; };
const plus = (a, b, k = 1) => ({ x: a.x + b.x * k, y: a.y + b.y * k, z: a.z + b.z * k });
function select(nav, sel) { nav._selectedBody = sel; nav.render(); }
function openDetail(nav, pIdx) { const S = nav._viewDriverInst.S; S.sysView = 'planet'; S.detailPlanet = pIdx; }

const shipCentre = (p) => { const f = p.fills.find((q) => q.ink === p.INK.SHIP && q.w === 5 && q.h === 1); return f ? { x: f.x + 2, y: f.y } : null; };
const wordOf = (p) => p.lines.find((l) => /^SHIP/.test(l.s)) || null;
/** The ROUTE's own texels — 1x1 ship-ink fills that are neither the diamond nor a SHIP word. */
function routeDots(p) {
  const c = shipCentre(p);
  const boxes = p.lines.filter((l) => /^SHIP/.test(l.s)).map((l) => ({ x0: l.x - 1, y0: l.y - 1, x1: l.x + measurePixelText(l.s), y1: l.y + FACE.h }));
  return p.fills.filter((f) => f.ink === p.INK.SHIP && f.w === 1 && f.h === 1
    && !(c && Math.abs(f.x - c.x) + Math.abs(f.y - c.y) <= 2)
    && !boxes.some((b) => f.x >= b.x0 && f.x <= b.x1 && f.y >= b.y0 && f.y <= b.y1));
}
const has = (dots, x, y) => dots.some((f) => f.x === x && f.y === y);
const stopOf = (S, pIdx) => (S.bodyHits || []).find((z) => z.ref && z.ref.kind === 'planet' && z.ref.pIdx === pIdx && !(z.moon >= 0));
const pipOf = (S, pIdx, m) => (S.bodyHits || []).find((z) => z.ref && z.ref.kind === 'planet' && z.ref.pIdx === pIdx && z.moon === m);
const starOf = (S) => (S.bodyHits || []).find((z) => z.star);

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('GPS line — the ship is drawn from where it IS', () => {
  it('G1 ⛔ BETWEEN TWO PLANETS, MID-BURN TO A THIRD: the diamond is between them in both designs, and turns with the orrery', async () => {
    // ⛔ SABOTAGE RUN: `state.js` taking the focus pair even when a position is published → the
    //    diamond stands on planet 7 (the burn's destination, which `setCurrentBody(7)` names), red.
    for (const [mode, design] of [['rail', 1], ['bars', 2]]) {
      const nav = await at(mode);
      nav.setCurrentBody(7, -1);
      const a2 = P(nav, 2), a3 = P(nav, 3);
      publish(nav, { x: (a2.x + a3.x) / 2, y: 0, z: (a2.z + a3.z) / 2 });
      const p = paint(nav, design);
      const c = shipCentre(p);
      expect(c, `design ${design}: a diamond`).toBeTruthy();
      expect(p.D.ship.at, 'open space').toBeNull();
      if (design === 1) {
        const axisY = p.S.ladderCaps.axisY;
        expect(c.y).toBe(axisY);
        expect(c.x > stopOf(p.S, 2).x && c.x < stopOf(p.S, 3).x, `ladder: ${c.x} between ${stopOf(p.S, 2).x} and ${stopOf(p.S, 3).x}`).toBe(true);
      } else {
        const st = starOf(p.S), tilt = Math.sin(p.S.sysCam.rotX);
        const rho = Math.hypot(c.x - st.x, (c.y - st.y) / tilt);
        const ring = (i) => p.S.orbitRings.find((r) => r.ref && r.ref.kind === 'planet' && r.ref.pIdx === i).rx;
        expect(rho > ring(2) - 1 && rho < ring(3) + 1, `orrery: radius ${rho.toFixed(1)} between rings ${ring(2).toFixed(1)}, ${ring(3).toFixed(1)}`).toBe(true);
        nav._systemRotY = Math.PI / 2; nav.render();
        const q = paint(nav, 2), c2 = shipCentre(q);
        expect(Math.hypot(c2.x - c.x, c2.y - c.y), 'a quarter turn of the orrery moves the diamond').toBeGreaterThan(5);
        expect(Math.hypot(c2.x - st.x, (c2.y - st.y) / tilt), 'along its ring').toBeCloseTo(rho, -0.5);
      }
      expect(p.violations).toBe(0);
    }
  }, 120000);

  it('G2 ⭐ AT THE TARGET\'s PARENT PLANET: a riser up the pip column on the ladder, a drop down the pip column on the orrery, and the pip wears TARGET', async () => {
    // ⛔ SABOTAGE RUN (ladder): `selIsMoon` answering false → the target pip stays DIM, red.
    // ⛔ SABOTAGE RUN (orrery): `pipOf` returning null → the route arrives on a slant, no column run, red.
    for (const [mode, design] of [['rail', 1], ['bars', 2]]) {
      const nav = await at(mode);
      select(nav, { type: 'moon', planetIndex: 4, moonIndex: 1 });
      publish(nav, plus(P(nav, 4), { x: 12 * E, y: 0, z: 0 }));
      const p = paint(nav, design);
      expect(p.D.ship.at, 'arrived at planet 4').toEqual({ kind: 'planet', pIdx: 4, mIdx: -1 });
      const pip = pipOf(p.S, 4, 1), par = stopOf(p.S, 4);
      const dots = routeDots(p);
      expect(p.fills.some((f) => f.ink === p.INK.TARGET && f.x === pip.x && f.y === pip.y && f.w === 1), 'the selected pip is TARGET').toBe(true);
      if (design === 1) {
        const axisY = p.S.ladderCaps.axisY, px = par.x;
        expect(dots.filter((f) => f.y === axisY).length, 'Leg B only: nothing along the axis').toBe(0);
        expect(dots.filter((f) => f.x === px - 3 && f.y < axisY && f.y > pip.y).length, 'a riser in column px-3').toBeGreaterThan(1);
        expect(has(dots, px - 2, pip.y), 'the chevron tip, one clear texel from the pip').toBe(true);
      } else {
        const s = pip.y < par.y ? 1 : -1;
        expect(has(dots, pip.x, pip.y - 2 * s), 'the tip, two rows off the pip in its own column').toBe(true);
        expect(dots.filter((f) => f.x === pip.x && (f.y - pip.y) * -s >= 3 && (f.y - pip.y) * -s <= 6).length,
               'a vertical approach down the column').toBeGreaterThan(0);
        expect(dots.filter((f) => Math.abs(f.x - pip.x) === 2 && Math.abs(f.y - pip.y) <= 1).length,
               'no route texel on a neighbouring pip').toBe(0);
      }
      expect(p.violations).toBe(0);
    }
  }, 120000);

  it('G3a ⛔ AT ANOTHER PLANET → AN OUTER PLANET (ladder): the route rides the axis and never paints inside an intermediate stop', async () => {
    // ⛔ SABOTAGE RUN: `routePut` ignoring the protected boxes → dots land inside planets 2-5's
    //    sprites and the belt, red.
    const nav = await at('rail');
    select(nav, { type: 'planet', planetIndex: 6 });
    publish(nav, plus(P(nav, 1), { x: 3 * E, y: 0, z: 0 }));
    const p = paint(nav, 1);
    const axisY = p.S.ladderCaps.axisY, dots = routeDots(p);
    const t = stopOf(p.S, 6);
    expect(has(dots, t.x - 6, axisY), 'the chevron tip, 6 back from the FRAMED target').toBe(true);
    expect(dots.filter((f) => f.y === axisY).length, 'a lit track along the axis').toBeGreaterThan(20);
    expect(dots.every((f) => f.y === axisY || Math.abs(f.x - (t.x - 8)) <= 0), 'off the axis only the chevron\'s flanks').toBe(true);
    for (const i of [2, 3, 4, 5]) {
      const z = stopOf(p.S, i), ex = (i === 5 ? 4 : (z.ref.rE > 4 ? 2 : 1));
      expect(dots.filter((f) => Math.abs(f.x - z.x) <= ex && Math.abs(f.y - z.y) <= 2).length, `nothing on planet ${i}`).toBe(0);
    }
    // ⚠ FIXUP (live finding 3): the belt is protected as its seven DOTS, so the track runs through
    //   the gaps between them instead of vanishing for 13 texels.
    // ⛔ FIXUP SABOTAGE RUN: `routeDash` without the slide (phase advanced on a refused texel) → the
    //    dashes fall on the belt dots' own parity and fewer than 3 show through the belt, red.
    const belt = (p.S.bodyHits || []).find((z) => z.ref && z.ref.kind === 'belt');
    expect(dots.filter((f) => f.y === axisY && Math.abs(f.x - belt.x) <= 6 && (f.x - belt.x) % 2 === 0).length, 'nothing on a belt dot').toBe(0);
    expect(dots.filter((f) => f.y === axisY && Math.abs(f.x - belt.x) <= 6).length, 'the track shows through the belt').toBeGreaterThanOrEqual(3);
  }, 120000);

  it('G3c ⛔ LIVE FINDING 3 — THE TRACK STARTS AT THE DIAMOND, NOT PAST THE BELT', async () => {
    // ⛔ SABOTAGE RUN: the ladder belt boxed as one 13-texel run again (`[6, 0]`) → the first lit
    //    texel on the star side is 7+ texels from the diamond, red.
    const nav = await at('rail');
    select(nav, { type: 'star' });
    publish(nav, { x: 2700 * Math.cos(2.2), y: 0, z: 2700 * Math.sin(2.2) });   // in the belt, at no planet
    const p = paint(nav, 1);
    expect(p.D.ship.at).toBeNull();
    const axisY = p.S.ladderCaps.axisY, c = shipCentre(p), dots = routeDots(p).filter((f) => f.y === axisY);
    const belt = (p.S.bodyHits || []).find((z) => z.ref && z.ref.kind === 'belt');
    expect(Math.abs(c.x - belt.x), 'the diamond stands in the belt').toBeLessThanOrEqual(4);
    const nearest = Math.max(...dots.filter((f) => f.x < c.x).map((f) => f.x));
    expect(c.x - nearest, 'the first lit texel on the star side is right beside the diamond').toBeLessThanOrEqual(4);
    expect(dots.filter((f) => Math.abs(f.x - belt.x) <= 6 && f.x < c.x - 2).length, 'dashes in the belt gaps').toBeGreaterThanOrEqual(2);
  }, 120000);

  it('G3b ⭐ AT ANOTHER PLANET → A MOON (ladder): along the axis, then up the moon\'s planet\'s pip column', async () => {
    // ⛔ SABOTAGE RUN: `stopX` handing back the PARENT's axis stop for a moon (no `pip`) → the route
    //    ends on the axis, no column run, red.
    const nav = await at('rail');
    select(nav, { type: 'moon', planetIndex: 5, moonIndex: 2 });
    publish(nav, plus(P(nav, 1), { x: 3 * E, y: 0, z: 0 }));
    const p = paint(nav, 1);
    const axisY = p.S.ladderCaps.axisY, dots = routeDots(p), par = stopOf(p.S, 5), pip = pipOf(p.S, 5, 2);
    expect(dots.filter((f) => f.y === axisY && f.x < par.x).length, 'Leg A on the axis').toBeGreaterThan(10);
    expect(dots.filter((f) => f.x === par.x - 3 && f.y < axisY && f.y >= pip.y).length, 'Leg B in column px-3').toBeGreaterThan(2);
    expect(has(dots, par.x - 2, pip.y), 'the tip at the pip').toBe(true);
    expect(p.violations).toBe(0);
  }, 120000);

  it('G3c ⛔ AT ANOTHER PLANET → THE STAR, in both designs', async () => {
    // ⛔ SABOTAGE RUN: `routeTarget` dropping its star branch → no route at all, red.
    for (const [mode, design] of [['rail', 1], ['bars', 2]]) {
      const nav = await at(mode);
      select(nav, { type: 'star', starIndex: 0 });
      publish(nav, plus(P(nav, 3), { x: 3 * E, y: 0, z: 0 }));
      const p = paint(nav, design);
      const st = starOf(p.S), dots = routeDots(p);
      expect(dots.length, `design ${design}: a route`).toBeGreaterThan(5);
      const near = Math.min(...dots.map((f) => Math.hypot(f.x - st.x, f.y - st.y)));
      expect(near, `design ${design}: it stops clear of the framed star (${near.toFixed(1)})`).toBeGreaterThanOrEqual(5);
      expect(near).toBeLessThanOrEqual(7);
    }
  }, 120000);

  it('G4 ⛔ A FOREIGN SYSTEM DRAWS NOTHING, EVEN WITH A POSITION PUBLISHED', async () => {
    // ⛔ SABOTAGE RUN: `state.js` deriving the ship without the `D.isCurrent` gate → `D.ship` is an
    //    object abroad and the first expect goes red.
    for (const [mode, design] of [['rail', 1], ['bars', 2]]) {
      const nav = await at(mode, { current: false });
      select(nav, { type: 'planet', planetIndex: 6 });
      publish(nav, plus(P(nav, 1), { x: 3 * E, y: 0, z: 0 }));
      const p = paint(nav, design);
      expect(p.D.isCurrent).toBe(false);
      expect(p.D.ship, `design ${design}: no ship abroad`).toBeNull();
      expect(p.fills.filter((f) => f.ink === p.INK.SHIP).length).toBe(0);
    }
  }, 120000);

  it('G5a ⭐ SUB-VIEW, HALFWAY BETWEEN THE PLANET AND ITS INNER MOON: between them on both pictures, not on the planet', async () => {
    // ⛔ SABOTAGE RUN: the moon ladder's `freeV` and the moon orrery's `free` returning nothing → no
    //    diamond in the sub-view, red. (Astra's point 1, the halfway case, at the picture level.)
    // ⛔ FIXUP SABOTAGE RUN: dropping the `subP` exemption in `drawShipLadder` / `drawShipOrrery` →
    //    the arrived ship snaps onto the planet's head in both sub-views, red.
    for (const [mode, design] of [['rail', 1], ['bars', 2]]) {
      const nav = await at(mode);
      const half = plus(P(nav, 4), moonRelScene(nav._systemData.planets[4], 0), 0.5);
      publish(nav, half);
      openDetail(nav, 4);
      const p = paint(nav, design);
      // ⚠ FIXUP (live finding 1): 20 Earth radii is 2R of this giant, so the ship has ARRIVED at it
      //   (8R, no inner-moon cap) — and the sub-view still draws it out among the moons.
      expect(p.D.ship.at, 'arrived at the giant').toEqual({ kind: 'planet', pIdx: 4, mIdx: -1 });
      const c = shipCentre(p);
      expect(c, `design ${design}: a diamond in the sub-view`).toBeTruthy();
      const head = (p.S.bodyHits || []).find((z) => z.ref && z.ref.kind === 'planet' && !(z.moon >= 0));
      const m0 = (p.S.bodyHits || []).find((z) => z.type === 'moon' && z.moonIndex === 0);
      if (design === 1) {
        expect(c.x > head.x + 2 && c.x < m0.x - 2, `ladder: ${c.x} strictly between ${head.x} and ${m0.x}`).toBe(true);
      } else {
        const vx = m0.x - head.x, vy = m0.y - head.y, wx = c.x - head.x, wy = c.y - head.y;
        const t = (wx * vx + wy * vy) / (vx * vx + vy * vy);
        const perp = Math.abs(wx * vy - wy * vx) / Math.hypot(vx, vy);
        expect(t > 0.2 && t < 0.95, `orrery: along the ray to the moon (t=${t.toFixed(2)})`).toBe(true);
        expect(perp, 'on that ray').toBeLessThanOrEqual(1.5);
      }
      expect(p.violations).toBe(0);
    }
  }, 120000);

  it('G5b ⛔ SUB-VIEW, SHIP AT ANOTHER PLANET: an outward edge marker with its distance, and a route in to the selected moon', async () => {
    // ⛔ SABOTAGE RUN: dropping the `word += range` clause → the word reads a bare SHIP, red.
    for (const [mode, design] of [['rail', 1], ['bars', 2]]) {
      const nav = await at(mode);
      select(nav, { type: 'moon', planetIndex: 4, moonIndex: 1 });
      publish(nav, plus(P(nav, 1), { x: 3 * E, y: 0, z: 0 }));
      openDetail(nav, 4);
      const p = paint(nav, design);
      expect(shipCentre(p), 'no diamond — the ship is not on this picture').toBeNull();
      const w = wordOf(p);
      expect(w && /^SHIP \d+(\.\d)?AU$/.test(w.s), `design ${design}: the word carries the distance (${w && w.s})`).toBe(true);
      const dots = routeDots(p), map = p.regions.map;
      if (design === 1) {
        const { axisY, x1 } = p.S.ladderCaps;
        expect(has(dots, x1 - 2, axisY - 3), 'the ladder\'s edge chevron, above the axis at the right end').toBe(true);
      } else {
        expect(dots.some((f) => f.x <= map.x + 5 || f.x >= map.x + map.w - 6 || f.y <= map.y + 5 || f.y >= map.y + map.h - 6),
               'an edge marker on the pane rim').toBe(true);
      }
      const m1 = (p.S.bodyHits || []).find((z) => z.type === 'moon' && z.moonIndex === 1);
      const near = Math.min(...dots.map((f) => Math.hypot(f.x - m1.x, f.y - m1.y)));
      expect(near, 'the route reaches the selected moon').toBeLessThanOrEqual(8);
      expect(p.violations).toBe(0);
    }
  }, 120000);

  it('G5c ⛔ SUB-VIEW, THE STAR SELECTED, ORRERY TURNED: the route leaves along the TRUE bearing to the star, through the azimuth', async () => {
    // ⛔ SABOTAGE RUN: `toScreen` without `+ sysRotY` (Astra's point 5) → the chevron leaves 69° off
    //    the bearing, red.
    const nav = await at('bars');
    select(nav, { type: 'star', starIndex: 0 });
    nav._systemRotY = 1.2; nav.render();
    publish(nav, plus(P(nav, 4), { x: 5 * E, y: 0, z: 0 }));
    openDetail(nav, 4);
    const p = paint(nav, 2);
    const head = (p.S.bodyHits || []).find((z) => z.ref && z.ref.kind === 'planet' && !(z.moon >= 0));
    const P4 = P(nav, 4), a = Math.atan2(-P4.z, -P4.x) + p.S.sysCam.rotY, tilt = Math.sin(p.S.sysCam.rotX);
    const want = { x: Math.cos(a), y: Math.sin(a) * tilt }, wl = Math.hypot(want.x, want.y);
    const dots = routeDots(p);
    const far = dots.reduce((m, f) => (Math.hypot(f.x - head.x, f.y - head.y) > Math.hypot(m.x - head.x, m.y - head.y) ? f : m));
    const got = { x: far.x - head.x, y: far.y - head.y }, gl = Math.hypot(got.x, got.y);
    const cos = (got.x * want.x + got.y * want.y) / (gl * wl);
    expect(gl, 'the route reaches out to the pane edge').toBeGreaterThan(40);
    expect(cos, `along the star's bearing (cos ${cos.toFixed(3)})`).toBeGreaterThan(0.98);
  }, 120000);

  it('G5d ⛔ SUB-VIEW (ladder), ANOTHER PLANET\'s MOON SELECTED: the route runs out to the right cap', async () => {
    // ⛔ SABOTAGE RUN: `if (!tp || tp.off)` narrowed to `if (tp && tp.off)` → a target this ladder does
    //    not show gets no route, red.
    const nav = await at('rail');
    select(nav, { type: 'moon', planetIndex: 5, moonIndex: 0 });
    publish(nav, plus(P(nav, 4), moonRelScene(nav._systemData.planets[4], 0), 0.5));
    openDetail(nav, 4);
    const p = paint(nav, 1);
    const { axisY, x1 } = p.S.ladderCaps, dots = routeDots(p);
    expect(has(dots, p.S.ladderMax > p.S.ladderScroll ? x1 - 7 : x1 - 2, axisY),
           'an outward chevron tip at the right end (before the cap when one is drawn)').toBe(true);
    expect(dots.filter((f) => f.y === axisY).length, 'a track along the axis').toBeGreaterThan(10);
  }, 120000);

  it('G6 ⭐ AN INCLINED, RETROGRADE MOON IS DRAWN WHERE IT IS, AND THE SHIP AT IT STANDS ON IT', async () => {
    // ⛔ SABOTAGE RUN: `sysDetail`'s `pa` taking `startAngle` → moon 0 is drawn on the far side of its
    //    planet from its real position, red.
    const nav = await at('bars');
    const sys = nav._systemData, p4 = sys.planets[4];
    const Pp = planetTrueScene(p4, O);
    const origin = { x: 37, y: -2, z: 91 };
    const reb = (v) => ({ x: v.x - origin.x, y: v.y - origin.y, z: v.z - origin.z });
    // moon 0 placed OPPOSITE its startAngle, tilted 160° (retrograde)
    const a0 = p4.moons[0].startAngle + Math.PI, r0 = 40 * E, inc = 160 * Math.PI / 180;
    const rel0 = { x: Math.cos(a0) * r0, y: -Math.sin(inc) * Math.sin(a0) * r0, z: Math.cos(inc) * Math.sin(a0) * r0 };
    p4._live = { orbitAngle: p4.orbitAngle, planet: { mesh: { position: reb(Pp) }, data: { radius: 10 * E } },
                 moons: p4.moons.map((m, j) => ({ mesh: { position: reb(plus(Pp, j === 0 ? rel0 : moonRelScene({ moons: p4.moons }, j))) },
                                                  data: { radius: 0.3 * E } })) };
    publish(nav, plus(Pp, rel0), origin);
    openDetail(nav, 4);
    const p = paint(nav, 2);
    const head = (p.S.bodyHits || []).find((z) => z.ref && z.ref.kind === 'planet' && !(z.moon >= 0));
    const m0 = (p.S.bodyHits || []).find((z) => z.type === 'moon' && z.moonIndex === 0);
    const want = Math.atan2(rel0.z, rel0.x) + p.S.sysCam.rotY;
    const got = Math.atan2((m0.y - head.y) / Math.sin(p.S.sysCam.rotX), m0.x - head.x);
    const d = Math.abs(((got - want) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI);
    expect(d, `moon 0 at its LIVE angle (off by ${d.toFixed(3)} rad)`).toBeLessThan(0.15);
    expect(p.D.ship.at, 'the ship is at moon 0').toEqual({ kind: 'moon', pIdx: 4, mIdx: 0 });
    const c = shipCentre(p);
    expect(c && { x: c.x, y: c.y }, 'and stands on its mark').toEqual({ x: m0.x, y: m0.y });
  }, 120000);

  it('G7 ⛔ THE FAR SIDE OF THE STAR: the ladder cannot show the trip, so a stub and the true range', async () => {
    // ⛔ SABOTAGE RUN: deleting the stub branch in `drawShipLadder` → no chevron and a bare SHIP, red.
    // ⚠ FIXUP (live finding 4): the stub comes from ABOVE, pointing down — it was a right-pointing
    //   chevron at `t.x - 6`, which sat on the wrong side of a target left of the ship.
    const nav = await at('rail');
    select(nav, { type: 'planet', planetIndex: 2 });
    const P2 = P(nav, 2);
    publish(nav, { x: -P2.x, y: 0, z: -P2.z });
    const p = paint(nav, 1);
    const axisY = p.S.ladderCaps.axisY, t = stopOf(p.S, 2);
    expect(shipCentre(p).x, 'the ship projects onto the target\'s own stop').toBe(t.x);
    expect(wordOf(p) && wordOf(p).s, 'the word carries the 3D range').toBe('SHIP 2.0AU');
    expect(has(routeDots(p), t.x, axisY - 6), 'a stub chevron above the framed target').toBe(true);
  }, 120000);

  it('G7b ⛔ LIVE FINDING 4 — A TARGET JUST LEFT OF THE SHIP: the stub is above it, never on its far side', async () => {
    // ⛔ SABOTAGE RUN: the old stub (`routeChevron(st, t.x - 6, axisY, 1, 0)`, pointing right) → no tip
    //    above the target and texels left of it, on the side away from the ship, red.
    const nav = await at('rail');
    select(nav, { type: 'planet', planetIndex: 3 });
    const a = nav._systemData.planets[3].orbitAngle + 0.3;
    publish(nav, { x: 1750 * Math.cos(a), y: 0, z: 1750 * Math.sin(a) });   // 1.75 AU, off planet 3's bearing
    const p = paint(nav, 1);
    expect(p.D.ship.at).toBeNull();
    const axisY = p.S.ladderCaps.axisY, t = stopOf(p.S, 3), c = shipCentre(p), dots = routeDots(p);
    expect(c.x > t.x, `the ship (${c.x}) is right of the target (${t.x})`).toBe(true);
    expect(/^SHIP \d/.test(wordOf(p) && wordOf(p).s), 'a stub, with the range in the word').toBe(true);
    expect(has(dots, t.x, axisY - 6), 'the tip above the framed target').toBe(true);
    expect(dots.filter((f) => f.x < t.x - 1).length, 'nothing on the far side of the target').toBe(0);
  }, 120000);

  it('G9 ⛔ LIVE FINDING 1 — PARKED AT A GIANT WITH CLOSE MOONS IS ARRIVED: no route, no range', async () => {
    // ⛔ SABOTAGE RUN: re-adding the 0.4 x innermost-moon cap in `deriveShip` → at 6R and at 2.6R the
    //    ship is open space, a stub draws and the word reads `SHIP …R⊕`, red.
    for (const [mode, design] of [['rail', 1], ['bars', 2]]) {
      for (const k of [6, 2.6]) {
        const nav = await at(mode);
        select(nav, { type: 'planet', planetIndex: 4 });
        publish(nav, plus(P(nav, 4), { x: 0, y: 0, z: k * 10 * E }));
        const p = paint(nav, design);
        expect(p.D.ship.at, `design ${design}, ${k}R: arrived`).toEqual({ kind: 'planet', pIdx: 4, mIdx: -1 });
        const c = shipCentre(p), s = stopOf(p.S, 4);
        expect([c.x, c.y], 'the diamond on the giant').toEqual([s.x, s.y]);
        expect(routeDots(p).length, 'no line to where you are').toBe(0);
        expect(wordOf(p) && wordOf(p).s, 'and no range').toBe('SHIP');
      }
    }
  }, 120000);

  it('G8 ⛔ FAR OUT PAST THE LAST STOP: an edge chevron above the axis and `SHIP 60AU`', async () => {
    // ⛔ SABOTAGE RUN: `ladderShipV` clamping at the last stop (no `beyond` arm) → the diamond sits on
    //    planet 7's stop and no edge marker draws, red.
    const nav = await at('rail');
    publish(nav, { x: 60000, y: 0, z: 0 });
    const p = paint(nav, 1);
    const { axisY, x1 } = p.S.ladderCaps;
    expect(shipCentre(p), 'no diamond on the window').toBeNull();
    expect(wordOf(p) && wordOf(p).s).toBe('SHIP 60AU');
    expect(has(routeDots(p), x1 - 2, axisY - 3), 'the outward chevron tip, inset 2, above the axis').toBe(true);
  }, 120000);
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('GPS line — the route never erases a mark', () => {
  /** Last-write-wins raster of a frame. */
  function raster(fills) {
    const g = new Map();
    for (const f of fills) {
      const x0 = Math.max(0, Math.round(f.x)), y0 = Math.max(0, Math.round(f.y));
      const x1 = Math.min(W, Math.round(f.x + f.w)), y1 = Math.min(H, Math.round(f.y + f.h));
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) g.set(x + y * W, f.ink);
    }
    return g;
  }
  it('N1 ⛔ EVERY MARK TEXEL OF THE ROUTE-LESS FRAME IS UNCHANGED, AND NO ROUTE TEXEL IS ON A NAME, in four routes across both designs', async () => {
    // ⭐ THE BASELINE IS THE SAME FRAME WITH `D.ship` NULLED — same selection, same pip inks — so
    //    every difference is the ship's. Texels allowed to differ: the diamond's footprint, the SHIP
    //    word's plate, and the NAME plates of either frame — since live finding 2 the names are placed
    //    off the route, so a name may take another slot when a route exists. Everything else that was
    //    not glass (BG) or rule (RULE / GRID, which the axis track is allowed to light) must be the
    //    same ink, and no route texel may land inside a name plate of the routed frame.
    // ⛔ SABOTAGE RUN: `routePut` ignoring the protected boxes → planet, belt, frame and label texels
    //    are overwritten in SHIP ink, red. FIXUP SABOTAGE RUN: every painter placing names against
    //    `hits` alone AND the route ignoring name plates → route texels on a name plate, red. (Either
    //    half alone stays green: the dry run keeps names off the line, and the plate mask keeps the
    //    line off any name — two guards for one rule.)
    const cases = [
      ['rail', 1, { type: 'planet', planetIndex: 7 }, (n) => plus(P(n, 0), { x: 3 * E, y: 0, z: 0 }), -1],
      ['rail', 1, { type: 'moon', planetIndex: 6, moonIndex: 2 }, (n) => plus(P(n, 1), { x: 3 * E, y: 0, z: 0 }), -1],
      ['bars', 2, { type: 'moon', planetIndex: 5, moonIndex: 1 }, (n) => plus(P(n, 0), { x: 3 * E, y: 0, z: 0 }), -1],
      ['bars', 2, { type: 'moon', planetIndex: 4, moonIndex: 2 }, (n) => plus(P(n, 1), { x: 3 * E, y: 0, z: 0 }), 4],
    ];
    for (const [mode, design, sel, where, sub] of cases) {
      const nav = await at(mode);
      select(nav, sel);
      publish(nav, where(nav));
      if (sub >= 0) openDetail(nav, sub);
      const withRoute = paint(nav, design);
      expect(routeDots(withRoute).length, `D${design} ${JSON.stringify(sel)}: a route drew`).toBeGreaterThan(5);
      // ⚠ NOT `null`: `D.ship.planetIndex` also ranks the LABEL queue (the ship's body is named
      //   first), so a null baseline re-places names. Same ship, no position and no arrival: nothing
      //   of the ship draws, everything else is identical.
      const keep = nav._viewDriverInst.D.ship; nav._viewDriverInst.D.ship = { ...keep, at: null, au: null, rel: null };
      const base = paint(nav, design);
      nav._viewDriverInst.D.ship = keep;
      const a = raster(base.fills), b = raster(withRoute.fills);
      const INK = withRoute.INK, free = new Set([INK.BG, INK.RULE, INK.GRID]);
      const c = shipCentre(withRoute);
      const words = withRoute.lines.filter((l) => /^SHIP/.test(l.s)).map((l) => [l.x - 1, l.y - 1, l.x + measurePixelText(l.s), l.y + FACE.h]);
      const plates = (q) => q.labelHits.map((l) => [l.x - 1, l.y - 1, l.x + l.w, l.y + FACE.h]);
      const names = [...plates(base), ...plates(withRoute)];
      const inAny = (rs, x, y) => rs.some((r) => x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3]);
      const bad = [];
      for (const [k, ink] of a) {
        if (free.has(ink)) continue;
        const x = k % W, y = (k - x) / W;
        if (c && Math.abs(x - c.x) + Math.abs(y - c.y) <= 2) continue;
        if (inAny(words, x, y) || inAny(names, x, y)) continue;
        if (b.get(k) !== ink) bad.push(`(${x},${y}) ${ink}→${b.get(k)}`);
      }
      expect(bad, `D${design} ${JSON.stringify(sel)}: ${bad.slice(0, 6).join(' ')}`).toEqual([]);
      const onName = routeDots(withRoute).filter((f) => inAny(plates(withRoute), f.x, f.y));
      expect(onName.map((f) => `(${f.x},${f.y})`), `D${design}: route texels on a name plate`).toEqual([]);
    }
  }, 180000);

  it('N2 ⛔ LIVE FINDING 2 — A NAME NEVER COVERS THE ROUTE: the ship in the belt, the star selected', async () => {
    // ⭐ The shape Max's walk measured on Sol (ship at Ceres, star selected, the MARS plate over all
    //    but two texels of the line), on this fixture: found by sweeping ship × target × azimuth with
    //    the dry run removed — this is a case where a neighbour's name lands on the line.
    // ⛔ SABOTAGE RUN: `d2System` placing names against `hits` alone (no dry-run route) → planet c's
    //    plate sits across the route a texel in from its edge, red.
    const nav = await at('bars');
    nav._systemRotY = 1; nav.render();
    select(nav, { type: 'star' });
    publish(nav, { x: 2700 * Math.cos(1), y: 0, z: 2700 * Math.sin(1) });
    const p = paint(nav, 2);
    const c = shipCentre(p), s = starOf(p.S);
    expect(c && s, 'a diamond and a star').toBeTruthy();
    const L = Math.hypot(s.x - c.x, s.y - c.y), hit = [];
    for (const lh of p.labelHits) {
      // the plate's INTERIOR (one texel in), so a rounding graze along an edge is not a cover
      const r = [lh.x, lh.y, lh.x + lh.w - 1, lh.y + FACE.h - 1];
      for (let d = 4; d <= L - 7; d += 0.5) {
        const x = Math.round(c.x + (s.x - c.x) * d / L), y = Math.round(c.y + (s.y - c.y) * d / L);
        if (x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3]) { hit.push(`${lh.ref && lh.ref.name} at (${x},${y})`); break; }
      }
    }
    expect(hit, 'no name plate across the route').toEqual([]);
    expect(routeDots(p).length, 'and the route is drawn').toBeGreaterThan(10);
    expect(p.violations).toBe(0);
  }, 120000);
});
