/**
 * THE GPS LINE (2026-10-02) — the HOST and STATE half: where the ship IS, before any picture draws it.
 *
 * Max (verbatim): *"Yes, the GPS line should also draw to moons, and again it should draw from
 * wherever the player is currently."* Earlier: *"The 'GPS line' in the nav view should work no matter
 * where we're at in the system or in what mode."*
 *
 * What is pinned here, each case with the sabotage that was run red and then reverted:
 *   H1  the published position is rebased back into the system frame (`pos + origin`), so a world
 *       rebase cannot move the ship on the glass.
 *   H2  which object IS the ship: the flight body in FLIGHT mode, else the camera.
 *   H3  ARRIVAL: halfway to the Moon is NOT "at Earth" (Astra's point 1), parked at 2.6R is.
 *   H4  `D.ship` comes from the publication once there is one, never from the focus pair — mid-burn
 *       the focus already names the destination; and a publication from another system draws nothing.
 *   H5  the ladder interpolation lands a ship ON a stop that the separation pass pushed, and shares a
 *       band between stops of equal radius (Astra's point 6).
 *   H6  the orrery radius goes to zero at the star and is continuous at the innermost orbit.
 *   H7  the SHIP word's distance is never `0.0AU`.
 *   H8  main.js publishes to EVERY nav instance, every frame, and on the overlay's open BEFORE its
 *       first render (Astra's point 8) — the real `_syncNavShip` source, run against two fakes.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  shipOwnerPosition, navShipPublication, deriveShip, ladderShipV, orreryShipRadius, fmtShipRange,
  planetTrueScene, moonRelScene, shipRangeTo, SHIP_ARRIVE_K,
} from '../navViewModes/shipState.js';
import { makeHeadlessNav } from './helpers/headlessNav.mjs';
import { AU_TO_SCENE, earthRadiiToScene } from '../../core/ScaleConstants.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const E = earthRadiiToScene(1);

/** An Earth-and-Moon system: Earth at 1 AU, angle 0.3; the Moon at 60 Earth radii. */
const EARTH_MOON = {
  star: { type: 'G', radiusSolar: 1.0 },
  planets: [
    { orbitRadiusAU: 0.39, orbitAngle: 2.0, moons: [], planetData: { radiusEarth: 0.38 } },
    { orbitRadiusAU: 1.0, orbitAngle: 0.3, planetData: { radiusEarth: 1.0 },
      moons: [{ orbitRadiusEarth: 60, startAngle: 1.1, radiusEarth: 0.27 }] },
  ],
};

describe('GPS line — the host publication and D.ship', () => {
  it('H1 ⛔ A NON-ZERO WORLD ORIGIN CANCELS: au = (pos + origin) / AU_TO_SCENE', () => {
    // ⛔ SABOTAGE RUN: `deriveShip` with `T = pub.pos` (origin dropped) → au.x reads 0.2 not 1.0, red.
    const origin = { x: 800, y: 3, z: -400 };
    const trueP = { x: 1000, y: 0, z: 500 };
    const pub = { pos: { x: trueP.x - origin.x, y: trueP.y - origin.y, z: trueP.z - origin.z }, origin, sysKey: EARTH_MOON };
    const sh = deriveShip(pub, EARTH_MOON);
    expect(sh.au.x).toBeCloseTo(trueP.x / AU_TO_SCENE, 12);
    expect(sh.au.z).toBeCloseTo(trueP.z / AU_TO_SCENE, 12);
    // and the published shape carries the rebase origin it was built in
    const cam = { position: pub.pos };
    const p2 = navShipPublication({ cameraController: null, camera: cam, origin, systemData: EARTH_MOON });
    expect(p2.origin).toEqual(origin);
    expect(p2.sysKey).toBe(EARTH_MOON);
    expect(deriveShip(p2, EARTH_MOON).au.x).toBeCloseTo(1, 12);
  });

  it('H2 ⛔ THE SHIP IS THE FLIGHT BODY IN FLIGHT MODE, THE CAMERA OTHERWISE (incl. bypassed)', () => {
    // ⛔ SABOTAGE RUN: `shipOwnerPosition` returning `cameraPos` always → the FLIGHT case reads the
    //    chase camera, 4 units off, red.
    const flightPos = { x: 10, y: 0, z: 0 }, cameraPos = { x: 14, y: 0, z: 0 };
    expect(shipOwnerPosition({ flightMode: true, bypassed: false, flightPos, cameraPos })).toEqual(flightPos);
    expect(shipOwnerPosition({ flightMode: true, bypassed: true, flightPos, cameraPos })).toEqual(cameraPos);
    expect(shipOwnerPosition({ flightMode: false, bypassed: false, flightPos, cameraPos })).toEqual(cameraPos);
    const cc = { isFlightMode: true, bypassed: false, flight: { position: flightPos } };
    expect(navShipPublication({ cameraController: cc, camera: { position: cameraPos }, origin: null, systemData: EARTH_MOON }).pos)
      .toEqual(flightPos);
    expect(navShipPublication({ cameraController: cc, camera: { position: cameraPos }, origin: null, systemData: null }))
      .toBeNull();
  });

  it('H3 ⛔ HALFWAY TO THE MOON IS OPEN SPACE; PARKED AT 2.6R IS EARTH; AT THE MOON IS THE MOON', () => {
    // ⛔ SABOTAGE RUN: removing the planet's cap (0.4 x its innermost moon's orbit) → a ship halfway
    //    to a giant's inner moon (inside the giant's 8R) reads `at: the giant` — the proposal's own
    //    BLOCKER, Astra's point 1, one planet class up — red.
    const O = { x: 0, y: 0, z: 0 };
    const P = planetTrueScene(EARTH_MOON.planets[1], O);
    const M = moonRelScene(EARTH_MOON.planets[1], 0);
    const pub = (T) => ({ pos: T, origin: O, sysKey: EARTH_MOON });
    const half = deriveShip(pub({ x: P.x + M.x / 2, y: P.y + M.y / 2, z: P.z + M.z / 2 }), EARTH_MOON);
    expect(half.at, 'halfway between Earth and the Moon is NOT at Earth').toBeNull();
    const parked = deriveShip(pub({ x: P.x + 2.6 * E, y: 0, z: P.z }), EARTH_MOON);
    expect(parked.at).toEqual({ kind: 'planet', pIdx: 1, mIdx: -1 });
    expect(parked.planetIndex).toBe(1);
    const moon = deriveShip(pub({ x: P.x + M.x + 0.27 * E * 3, y: P.y + M.y, z: P.z + M.z }), EARTH_MOON);
    expect(moon.at).toEqual({ kind: 'moon', pIdx: 1, mIdx: 0 });
    expect(SHIP_ARRIVE_K).toBeLessThan(15);
    // a Jupiter: R = 11.2 Earth radii, Io at 66 — 8R (90) reaches past Io, the cap does not
    const JUP = { star: { type: 'G', radiusSolar: 1 }, planets: [{ orbitRadiusAU: 5.2, orbitAngle: 0, planetData: { radiusEarth: 11.2 },
                  moons: [{ orbitRadiusEarth: 66, startAngle: 0, radiusEarth: 0.29 }] }] };
    const J = planetTrueScene(JUP.planets[0], O);
    const halfIo = deriveShip({ pos: { x: J.x + 33 * E, y: 0, z: J.z }, origin: O, sysKey: JUP }, JUP);
    expect(halfIo.at, 'halfway to Io is NOT at Jupiter').toBeNull();
    // the 3D range to the Moon from the halfway point is half the Moon's distance
    expect(shipRangeTo(half, { kind: 'moon', pIdx: 1, mIdx: 0 }) * AU_TO_SCENE).toBeCloseTo(Math.hypot(M.x, M.y, M.z) / 2, 6);
  });

  it('H4 ⛔ MID-BURN THE DIAMOND IS WHERE THE SHIP IS, NOT THE DESTINATION; A STALE SYSTEM DRAWS NOTHING', async () => {
    // ⭐ DRIVEN THROUGH THE REAL NAV: `setCurrentBody(7)` is what a burn to planet 7 sets at its
    //    start (`main.js` focus), and `setShipState` is what `_syncNavShip` hands every frame.
    // ⛔ SABOTAGE RUN: state.js reading the focus pair whenever a publication exists → `D.ship.at`
    //    names planet 7 and `D.ship.live` is undefined, red. SECOND SABOTAGE RUN: falling back to the
    //    focus when `sysKey` does not match → the stale case reads `{planetIndex: 7}`, red.
    const h = await makeHeadlessNav({ width: 417, height: 240 });
    const nav = h.nav;
    nav._viewModesEnabled = true; nav.viewMode = 'rail'; nav._levelIndex = 3; nav.render();
    nav._systemStar = nav._localStars.reduce((m, s) => (m == null || s.dist < m.dist ? s : m), null);
    nav._playerX = nav._systemStar.wx; nav._playerY = nav._systemStar.wy; nav._playerZ = nav._systemStar.wz;
    nav._systemData = EARTH_MOON; nav._currentSystemData = EARTH_MOON; nav._levelIndex = 4;
    nav.setCurrentBody(7, -1);
    nav.render();
    expect(nav._viewDriverInst.D.ship, 'never published → the focus pair, unchanged').toEqual({ planetIndex: 7, moonIndex: -1 });
    nav.setShipState({ pos: { x: 500, y: 0, z: 0 }, origin: { x: 0, y: 0, z: 0 }, sysKey: EARTH_MOON });
    nav.render();
    const D = nav._viewDriverInst.D;
    expect(D.ship.live).toBe(true);
    expect(D.ship.at, 'open space at 0.5 AU').toBeNull();
    expect(D.ship.au.x).toBeCloseTo(0.5, 12);
    nav.setShipState({ pos: { x: 500, y: 0, z: 0 }, origin: { x: 0, y: 0, z: 0 }, sysKey: { other: true } });
    nav.render();
    expect(nav._viewDriverInst.D.ship, 'a position from another system draws nothing, never the focus').toBeNull();
    nav.setShipState(null);
    nav.render();
    expect(nav._viewDriverInst.D.ship, 'a cleared publication draws nothing').toBeNull();
  });

  it('H5 ⛔ THE LADDER LANDS ON A PUSHED STOP, AND EQUAL RADII SHARE A BAND', () => {
    // ⛔ SABOTAGE RUN (a): interpolating with the raw projector (`v = vpx(r)` everywhere) → the ship at
    //    the pushed stop's own radius lands 8 texels left of it, red.
    // ⛔ SABOTAGE RUN (b): interpolating out of a band from its FIRST stop (`a.v0`) instead of its
    //    last → a ship just past the equal-radius pair lands BETWEEN the two stops, red.
    const vpx = (v) => Math.round(4 + 200 * Math.sqrt(v / 30));
    const vals = [0.39, 0.40, 1.0];
    const vx = []; let last = -99;
    for (const v of vals) { let p = vpx(v); if (p - last < 8) p = last + 8; last = p; vx.push(p); }
    expect(vx[1], 'the fixture really has a pushed stop').toBeGreaterThan(vpx(0.40));
    const stops = [{ val: 0, v: 0 }, ...vals.map((v, i) => ({ val: v, v: vx[i] }))];
    expect(ladderShipV(0.40, stops, vpx).v).toBe(vx[1]);
    expect(ladderShipV(1.0, stops, vpx).v).toBe(vx[2]);
    const mid = ladderShipV(0.7, stops, vpx).v;
    expect(mid > vx[1] && mid < vx[2]).toBe(true);
    expect(ladderShipV(0, stops, vpx).v).toBe(0);
    const far = ladderShipV(60, stops, vpx);
    expect(far.beyond).toBe(true);
    expect(far.v).toBe(vx[2] + vpx(60) - vpx(1.0));
    // equal radii: two stops at 5.2 AU, pushed 8 apart — the ship takes the FIRST
    const eq = [{ val: 0, v: 0 }, { val: 5.2, v: 100 }, { val: 5.2, v: 108 }, { val: 9.5, v: 140 }];
    expect(ladderShipV(5.2, eq, vpx).v).toBe(100);
    const past = ladderShipV(5.21, eq, vpx).v;
    expect(past > 108 && past < 109, `just past the pair is just past BOTH stops (${past})`).toBe(true);
    const between = ladderShipV(7, eq, vpx).v;
    expect(Number.isFinite(between) && between > 108 && between < 140).toBe(true);
  });

  it('H6 ⛔ THE ORRERY RADIUS IS 0 AT THE STAR AND CONTINUOUS AT THE INNERMOST ORBIT', () => {
    // ⛔ SABOTAGE RUN: returning `rOf(R)` always → the star case reads 8 (the star's clearance ring), red.
    const rOf = (au) => 8 + 100 * Math.sqrt(au / 30);
    expect(orreryShipRadius(0, 0.39, rOf)).toBe(0);
    expect(orreryShipRadius(0.39, 0.39, rOf)).toBeCloseTo(rOf(0.39), 12);
    expect(orreryShipRadius(0.39 - 1e-9, 0.39, rOf)).toBeCloseTo(rOf(0.39), 6);
    expect(orreryShipRadius(5.2, 0.39, rOf)).toBe(rOf(5.2));
  });

  it('H7 ⛔ THE SHIP WORD NEVER READS 0.0AU', () => {
    // ⛔ SABOTAGE RUN: `au.toFixed(1) + 'AU'` for everything → `0.0AU` for a moon-system distance, red.
    expect(fmtShipRange(0.001)).toBe('23R⊕');
    expect(fmtShipRange(0.0003)).toBe('7.0R⊕');
    expect(fmtShipRange(0.00002)).toBe('0.5R⊕');
    expect(fmtShipRange(2.04)).toBe('2.0AU');
    expect(fmtShipRange(60.2)).toBe('60AU');
    expect(fmtShipRange(NaN)).toBe('');
  });

  it('H8 ⛔ main.js PUBLISHES TO EVERY NAV, AND ON OPEN BEFORE THE FIRST RENDER', () => {
    // ⭐ THE REAL SOURCE IS RUN, NOT SCANNED: `_syncNavShip`'s body is lifted out of main.js and
    //    executed against two fake navs, the module-level names it closes over handed in.
    // ⛔ SABOTAGE RUN (a): `_navComputers()[0].setShipState(pub)` (one instance) → the cockpit's fake
    //    receives nothing, red. (b): deleting `_syncNavShip();` from `openNavComputer` → the order
    //    check finds no call before `_navRenderLoop()`, red.
    const src = readFileSync(join(ROOT, 'src/main.js'), 'utf8');
    const m = src.match(/function _syncNavShip\(\) \{([^\n]*?)\}\s*$/m);
    expect(m, '_syncNavShip is defined on one line').toBeTruthy();
    const run = new Function('system', 'navShipPublication', 'cameraController', 'camera', '_worldOriginVec', '_navComputers', m[1]);
    const got = [];
    const navs = [{ setShipState: (s) => got.push(['dom', s]) }, { setShipState: (s) => got.push(['cockpit', s]) }];
    const sys = { _systemData: EARTH_MOON };
    const cam = { position: { x: 1, y: 2, z: 3 } };
    const cc = { isFlightMode: true, bypassed: false, flight: { position: { x: 7, y: 8, z: 9 } } };
    run(sys, navShipPublication, cc, cam, { x: 10, y: 0, z: 0 }, () => navs);
    expect(got.map((g) => g[0])).toEqual(['dom', 'cockpit']);
    expect(got[0][1].pos).toEqual({ x: 7, y: 8, z: 9 });
    expect(got[0][1].origin).toEqual({ x: 10, y: 0, z: 0 });
    expect(got[1][1].sysKey).toBe(EARTH_MOON);
    got.length = 0;
    run({ type: 'nebula', _systemData: null }, navShipPublication, cc, cam, { x: 0, y: 0, z: 0 }, () => navs);
    expect(got.map((g) => g[1]), 'no star system → both cleared').toEqual([null, null]);
    // the overlay's open: published before `_navRenderLoop()` renders the first frame
    const open = src.slice(src.indexOf('function openNavComputer() {'));
    const body = open.slice(0, open.indexOf('\n}\n'));
    const iSync = body.indexOf('_syncNavShip();'), iRender = body.indexOf('_navRenderLoop();');
    expect(iSync, 'openNavComputer publishes the ship').toBeGreaterThan(0);
    expect(iSync, 'before its first render').toBeLessThan(iRender);
    // and the per-frame call sits in renderFrame, the once-per-RAF callback
    const rf = src.slice(src.indexOf('function renderFrame(alpha) {'));
    expect(rf.slice(0, rf.indexOf('\n}\n')).includes('_syncNavShip();'), 'once per frame').toBe(true);
  });
});
