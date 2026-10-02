/**
 * navViewModes/shipState.js — WHERE THE SHIP ACTUALLY IS, for every nav picture (the GPS line).
 *
 * Max, 2026-10-02: *"the GPS line should also draw to moons, and again it should draw from wherever
 * the player is currently."* Earlier: *"The 'GPS line' in the nav view should work no matter where
 * we're at in the system or in what mode."*
 *
 * ── THE DEFECT THIS REPLACES ─────────────────────────────────────────────────────────────────────
 *
 * The line used to start at a BODY INDEX (`nav._currentFocusIndex/_currentMoonIndex`), which is not
 * a position: during a burn it already names the destination, in ORRERY it is the camera's pivot,
 * and after an autopilot stop it is the closest body at any distance. So the line was drawn from
 * where you were going, not from where you were.
 *
 * ── WHAT THIS MODULE IS ──────────────────────────────────────────────────────────────────────────
 *
 * Pure functions, no THREE, no DOM, imported by four callers that must agree:
 *   - main.js `_syncNavShip()` publishes the ship's position every frame (`navShipPublication`);
 *   - `state.js` turns that publication into `D.ship` for the two designs (`deriveShip`);
 *   - `NavComputer.js`'s legacy painter turns the same publication into its own ship point;
 *   - `nav-240p-lab.html` (and therefore the extracted `designs.js`) uses the placement helpers
 *     (`ladderShipV`, `orreryShipRadius`, `fmtShipRange`) and the lab's fixture picker builds its
 *     `D.ship` through `deriveShip` from a made-up position, so the spec page and the game derive
 *     the ship by one spelling.
 *
 * ⛔ COORDINATES FIRST. Every picture places the ship from its system-centred position (`au`) or its
 *    position relative to a planet (`rel`), never from a "which body am I near" verdict. The only
 *    body identity derived here is ARRIVAL (`at`): the ship is within `SHIP_ARRIVE_K` body radii of
 *    a body, which is the distance every burn and every ORRERY "go to" parks at. A body you have
 *    arrived at is the one body that gets no line, and where the diamond snaps on every picture
 *    EXCEPT that planet's own moon sub-view, which is drawn at moon scale and places it from `rel`.
 *
 * Deliberate non-goals · no height above the plane on any picture (all are top-down), no binary
 *   star identity (both designs draw one star at the centre; the star range is to the barycentre),
 *   no velocity / heading.
 */
import { AU_TO_SCENE, EARTH_RADIUS_AU, earthRadiiToScene, solarRadiiToScene } from '../../core/ScaleConstants.js';

const E_SCENE = earthRadiiToScene(1);

/** A ship within this many body radii of a body has ARRIVED there. ⚠ 8, not 5, and measured from
 *  what the game actually parks at, not from what it computes and drops: the ORRERY "go to" glides the
 *  VIEW to about 6R of a planet (live, 2026-10-02: Jupiter framed at 6 radii), and a burn's pilot
 *  holds at `max(R·HOLD_VIEW_FRAC, 1.05R)` = 2.6R (`SupercruisePilot.js:229-231`) because `flyTo` is
 *  never handed main.js's `orbitDist`/`viewDist` (Astra's point 7 — the earlier comment here cited
 *  those and was wrong). Both are inside 8R; a moon framing (5R of the moon) is inside the moon's.
 *  It stays small against the gaps between bodies: Earth's 8R is 0.34 scene units and the Moon is
 *  60 Earth radii (2.56 units) out, so a ship halfway to the Moon is NOT at Earth.
 *  ⛔ NO CAP AT A GIANT'S INNER MOONS (live finding 1, 2026-10-02). The first build capped a planet's
 *     radius at 0.4x its innermost moon's orbit so that "halfway to Io" was not "at Jupiter"; in Sol
 *     that cap is ~1 radius at Jupiter (Amalthea), Mars and Saturn, so NO park ever counted as arrived
 *     and selecting the giant you were parked at drew a stub and `SHIP 67R⊕`. What Astra's point 1
 *     actually guards — a ship drawn ON the planet in its own moon picture while it is out among the
 *     moons — is now the painters' rule: a planet's own sub-view never snaps onto that planet (`subP`)
 *     and draws the ship from `rel`. At system scale 8R of a giant is far under a texel either way.
 *  ⭐ A MOON BEATS ITS PLANET: a ship inside a moon's own radius is at the MOON, even though it is
 *     also inside the parent's 8R (Io sits at 5.9 Jupiter radii). */
export const SHIP_ARRIVE_K = 8;
/** HYSTERESIS (Astra's point 7): once arrived, a ship stays arrived until it is this much further out
 *  than the arrival radius, so a ship parked on the boundary cannot flick the diamond and the route
 *  between "at" and "open space" every frame. */
export const SHIP_LEAVE_K = 1.25;
/** The floor every burn's park distance uses (`Math.max(..., 0.02)`), in scene units. */
export const SHIP_ARRIVE_FLOOR = 0.02;

const finite3 = (v) => !!v && Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);

/*  Function · which object IS the ship this frame: the flight body while FLIGHT mode is driving the
 *    camera, else the camera.
 *  Intent · Astra's point 2: in FLIGHT the camera is `flight.position + director offset × chase`
 *    (ShipCameraSystem.js:1388-1390), up to 4 scene units off the ship — less than a texel at system
 *    scale and more than the Moon's whole orbit in a moon sub-view. HELM/supercruise put the camera
 *    exactly on the ship (HeadMount), and every burn departs from `camera.position`.
 *  ⚠ ORRERY has no ship: "GO TO" glides the view and nothing flies, so there the ship IS the
 *    viewpoint by convention — flagged for Max's UAT, not decided here. */
export function shipOwnerPosition({ flightMode = false, bypassed = false, flightPos = null, cameraPos = null } = {}) {
  const src = (flightMode && !bypassed && finite3(flightPos)) ? flightPos : cameraPos;
  return finite3(src) ? { x: src.x, y: src.y, z: src.z } : null;
}

/**
 * The host's per-frame publication — `nav.setShipState(navShipPublication(...))`.
 * @returns {{pos:{x,y,z}, origin:{x,y,z}, sysKey:object}|null}  `pos` is in the REBASED frame (the
 *   renderer's), `origin` is `_worldOriginVec`, and `pos + origin` is the system-centred frame the
 *   orbit angles use. `sysKey` is the `_systemData` object the position belongs to, so a reader can
 *   refuse a position from a system that is no longer on the glass. `null` when there is no system.
 */
export function navShipPublication({ cameraController = null, camera = null, origin = null, systemData = null } = {}) {
  if (!systemData || !camera) return null;
  const cc = cameraController || {};
  const pos = shipOwnerPosition({ flightMode: !!cc.isFlightMode, bypassed: !!cc.bypassed,
                                  flightPos: cc.flight ? cc.flight.position : null, cameraPos: camera.position });
  if (!pos) return null;
  const o = finite3(origin) ? origin : { x: 0, y: 0, z: 0 };
  return { pos, origin: { x: o.x, y: o.y, z: o.z }, sysKey: systemData };
}

/** A planet's position in the SYSTEM-CENTRED frame, scene units. The live mesh when the scene has
 *  one (`_live`, main.js), else the generator's orbit — which is what a foreign system and the lab
 *  draw from, so the ship and the bodies always come out of the same numbers. */
export function planetTrueScene(p, origin) {
  const mp = p && p._live && p._live.planet && p._live.planet.mesh && p._live.planet.mesh.position;
  if (finite3(mp) && finite3(origin)) return { x: mp.x + origin.x, y: mp.y + origin.y, z: mp.z + origin.z };
  const r = (Number(p && p.orbitRadiusAU) || 0) * AU_TO_SCENE;
  const a = Number(p && (p._live && Number.isFinite(p._live.orbitAngle) ? p._live.orbitAngle : p.orbitAngle)) || 0;
  return { x: Math.cos(a) * r, y: 0, z: Math.sin(a) * r };
}

/** A moon's position RELATIVE TO ITS PLANET, scene units: the live meshes when they exist (they carry
 *  the real inclination and a retrograde orbit — Astra's point 3), else the generator's own orbit with
 *  `Moon.js:623-627`'s inclination term, phase 0 kept as a real phase. */
export function moonRelScene(p, j) {
  const live = p && p._live;
  const mp = live && live.moons && live.moons[j] && live.moons[j].mesh && live.moons[j].mesh.position;
  const pp = live && live.planet && live.planet.mesh && live.planet.mesh.position;
  if (finite3(mp) && finite3(pp)) return { x: mp.x - pp.x, y: mp.y - pp.y, z: mp.z - pp.z };
  const m = ((p && p.moons) || [])[j] || {};
  const r = (Number(m.orbitRadiusEarth) || (10 + j * 8)) * E_SCENE;
  const a = Number.isFinite(m.startAngle) ? m.startAngle : j * 2.4;
  const inc = Number(m.inclination) || 0;
  return { x: Math.cos(a) * r, y: -Math.sin(inc) * Math.sin(a) * r, z: Math.cos(inc) * Math.sin(a) * r };
}

/** The LIVE moon offset in Earth radii, or `null` when the scene has no meshes for it (a foreign
 *  system, the lab). ⛔ `null`, not the generator's orbit: the PICTURES' fallback is their own
 *  `startAngle` arithmetic, and a second fallback spelled here could disagree with it. */
export function liveMoonRelE(p, j) {
  const live = p && p._live;
  const mp = live && live.moons && live.moons[j] && live.moons[j].mesh && live.moons[j].mesh.position;
  const pp = live && live.planet && live.planet.mesh && live.planet.mesh.position;
  if (!finite3(mp) || !finite3(pp)) return null;
  return { x: (mp.x - pp.x) / E_SCENE, y: (mp.y - pp.y) / E_SCENE, z: (mp.z - pp.z) / E_SCENE };
}

const hyp3 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

/**
 * `D.ship` from a publication.
 * @param {object} pub  `navShipPublication`'s answer
 * @param {object} sys  the `_systemData` the position is in
 * @param {object} [prevAt]  last frame's `at` IN THIS SYSTEM (the caller drops it on a system change),
 *   for the hysteresis — `null` for a one-off derivation
 * @returns {object|null} `{ live:true, au:{x,z}, rel:[{x,y,z}] (Earth radii, per planet index),
 *   range:{ star, p:[], m:{'i.j'} } (AU, 3D), at:{kind,pIdx,mIdx}|null, planetIndex, moonIndex }`
 */
export function deriveShip(pub, sys, prevAt = null) {
  if (!pub || !finite3(pub.pos) || !sys) return null;
  const o = finite3(pub.origin) ? pub.origin : { x: 0, y: 0, z: 0 };
  const T = { x: pub.pos.x + o.x, y: pub.pos.y + o.y, z: pub.pos.z + o.z };
  const ZERO = { x: 0, y: 0, z: 0 };
  const range = { star: hyp3(T, ZERO) / AU_TO_SCENE, p: [], m: {} };
  const rel = [];
  let at = null, best = Infinity, bestRank = -1;
  const RANK = { star: 0, planet: 1, moon: 2 };
  const consider = (kind, pIdx, mIdx, d, R) => {
    let lim = Math.max(SHIP_ARRIVE_K * (Number(R) > 0 ? R : 0), SHIP_ARRIVE_FLOOR);
    if (prevAt && prevAt.kind === kind && prevAt.pIdx === pIdx && prevAt.mIdx === mIdx) lim *= SHIP_LEAVE_K;
    if (!(d < lim)) return;
    const rk = RANK[kind], q = d / lim;
    if (rk > bestRank || (rk === bestRank && q < best)) { bestRank = rk; best = q; at = { kind, pIdx, mIdx }; }
  };
  const st = sys.star || {};
  consider('star', -1, -1, range.star * AU_TO_SCENE,
           Number(st.radiusScene) > 0 ? st.radiusScene : solarRadiiToScene(Number(st.radiusSolar) || 1));
  (sys.planets || []).forEach((p, i) => {
    const P = planetTrueScene(p, o);
    const d = { x: T.x - P.x, y: T.y - P.y, z: T.z - P.z };
    rel[i] = { x: d.x / E_SCENE, y: d.y / E_SCENE, z: d.z / E_SCENE };
    const dp = Math.hypot(d.x, d.y, d.z);
    range.p[i] = dp / AU_TO_SCENE;
    const liveR = p && p._live && p._live.planet && p._live.planet.data && p._live.planet.data.radius;
    consider('planet', i, -1, dp, Number(liveR) > 0 ? liveR : (Number(p && p.planetData && p.planetData.radiusEarth) || 1) * E_SCENE);
    ((p && p.moons) || []).forEach((m, j) => {
      const M = moonRelScene(p, j);
      const dm = Math.hypot(d.x - M.x, d.y - M.y, d.z - M.z);
      range.m[`${i}.${j}`] = dm / AU_TO_SCENE;
      const lm = p._live && p._live.moons && p._live.moons[j] && p._live.moons[j].data && p._live.moons[j].data.radius;
      consider('moon', i, j, dm, Number(lm) > 0 ? lm : (Number(m && m.radiusEarth) || 0.27) * E_SCENE);
    });
  });
  return { live: true, au: { x: T.x / AU_TO_SCENE, z: T.z / AU_TO_SCENE }, rel, range, at,
           planetIndex: at ? (at.kind === 'star' ? -2 : at.pIdx) : -1,
           moonIndex: at && at.kind === 'moon' ? at.mIdx : -1 };
}

/** The OLD path — nothing has ever been published (the lab without a fixture, old harnesses): the
 *  focus indices name a body and the ship is AT it. `-1` and `-2` are both legacy's "the centre". */
export function focusShip(focusIndex, moonIndex) {
  const pi = Number.isFinite(focusIndex) ? focusIndex : -1;
  const mi = Number.isFinite(moonIndex) ? moonIndex : -1;
  const at = pi < 0 ? { kind: 'star', pIdx: -1, mIdx: -1 }
           : mi >= 0 ? { kind: 'moon', pIdx: pi, mIdx: mi } : { kind: 'planet', pIdx: pi, mIdx: -1 };
  return { planetIndex: pi, moonIndex: mi, live: false, at, au: null, rel: null, range: null };
}

/** The 3D range (AU) from the ship to a target identity, or `null` when unknown. */
export function shipRangeTo(ship, t) {
  if (!ship || !ship.range || !t) return null;
  const v = t.kind === 'star' ? ship.range.star
          : t.kind === 'planet' ? ship.range.p[t.pIdx]
          : t.kind === 'moon' ? ship.range.m[`${t.pIdx}.${t.mIdx}`] : null;
  return Number.isFinite(v) ? v : null;
}

/*  Function · a radius on a 1D ladder → its virtual axis position, interpolated between the stops the
 *    ladder actually DREW.
 *  Intent · Astra's point 6. The separation pass pushes stops right of their true sqrt position, so a
 *    raw `vpx(r)` puts a ship at 1.01 AU eight texels left of Earth's stop. Interpolating between the
 *    drawn stops (in sqrt space, the ladder's own compression) lands a ship AT a stop exactly ON it.
 *  ⛔ STOPS OF EQUAL RADIUS SHARE A BAND and the ship takes the band's FIRST stop — the separation
 *    pass spreads them apart, so a single-valued interpolation could not land on all of them.
 *  ⛔ THE ANCHOR IS THE PAINTER'S ORIGIN, passed in as the first stop: the star at virtual 0 on the
 *    system ladder, the open planet at `vx[0]` on the moon ladder.
 *  @param {number} r       the ship's radius (AU on the system ladder, Earth radii on the moon one)
 *  @param {Array}  stops   `[{ val, v }]` ascending by `val` — `val` a radius, `v` the drawn virtual x
 *  @param {Function} vpx   the ladder's own sqrt projector, used only past the last stop
 *  @returns {{v:number, beyond:boolean}} */
export function ladderShipV(r, stops, vpx) {
  // ⭐ BANDS: one per distinct radius, carrying the FIRST and LAST stop the separation pass gave it.
  //    A ship AT that radius takes the first; a ship between two bands runs from the band's LAST stop
  //    (it is past all of them) to the next band's first.
  const bands = [];
  for (const s of stops || []) {
    if (!s || !Number.isFinite(s.val) || !Number.isFinite(s.v)) continue;
    const b = bands[bands.length - 1];
    if (b && s.val <= b.val) b.v1 = s.v; else bands.push({ val: s.val, v0: s.v, v1: s.v });
  }
  if (!bands.length || !Number.isFinite(r)) return { v: NaN, beyond: false };
  const rr = Math.max(0, r);
  if (rr <= bands[0].val) return { v: bands[0].v0, beyond: false };
  for (let i = 0; i + 1 < bands.length; i++) {
    const a = bands[i], b = bands[i + 1];
    if (rr === b.val) return { v: b.v0, beyond: false };
    if (rr < b.val) {
      const t = (Math.sqrt(rr) - Math.sqrt(a.val)) / (Math.sqrt(b.val) - Math.sqrt(a.val));
      return { v: a.v1 + (b.v0 - a.v1) * t, beyond: false };
    }
  }
  const last = bands[bands.length - 1];
  return { v: last.v1 + (vpx(rr) - vpx(last.val)), beyond: true };
}

/*  Function · the orrery's ship radius for a true radius `R`.
 *  Intent · `rOf(0)` is the 8-texel ring around the star, so `rOf(R)` would put a ship parked beside
 *    the star on a ring 8 texels out. Inside the innermost orbit the radius goes to 0 as sqrt —
 *    zero at the star, continuous at the innermost orbit; outside it IS `rOf`, so a ship on a planet's
 *    orbit is on that planet's ring.
 *  @param {number} R    the ship's radius (same unit `rOf` takes)
 *  @param {number} rIn  the innermost orbit (a positive anchor — the caller falls back for a picture
 *                       with no orbits)
 *  @param {Function} rOf the painter's own radius function */
export function orreryShipRadius(R, rIn, rOf) {
  if (!Number.isFinite(R) || !(rIn > 0)) return NaN;
  const r = Math.max(0, R);
  return r >= rIn ? rOf(r) : rOf(rIn) * Math.sqrt(r / rIn);
}

/** A ship-to-somewhere distance for the SHIP word: Earth radii inside a moon system's scale, one
 *  decimal of AU below 10, whole AU above. ⛔ Never `0.0AU` — that was Astra's point 11. */
export function fmtShipRange(au) {
  if (!Number.isFinite(au) || au < 0) return '';
  if (au < 0.05) {
    const e = au / EARTH_RADIUS_AU;
    return `${e < 10 ? e.toFixed(1) : Math.round(e)}R⊕`;
  }
  return au < 9.95 ? `${au.toFixed(1)}AU` : `${Math.round(au)}AU`;
}
