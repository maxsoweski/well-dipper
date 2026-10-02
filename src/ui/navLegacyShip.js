/**
 * navLegacyShip.js — the GPS line on the LEGACY nav painter (NavComputer.js `_renderSystem` and
 * `_renderPlanetDetail`), 2026-10-02.
 *
 * Max: *"the GPS line should also draw to moons, and again it should draw from wherever the player
 * is currently"* and *"it should work no matter where we're at in the system or in what mode."*
 *
 * ── WHY A MODULE AND NOT INLINE ──────────────────────────────────────────────────────────────────
 *
 * NavComputer.js has a FIXED LINE COUNT (its comments cite each other by line), so every change there
 * is folded onto an existing line. The geometry below would not fit that way, and it has to agree
 * with the designs' own reading of the same publication — so it lives here, beside `shipState.js`,
 * and NavComputer calls it.
 *
 * ── WHAT CHANGED ─────────────────────────────────────────────────────────────────────────────────
 *
 *  - The ship is where it IS (`legacyShip`): the host's published position for this system, with the
 *    diamond snapped onto a body only when the ship has ARRIVED there. Never published (headless
 *    harnesses) → the focus pair, exactly as before.
 *  - Planets and moons are drawn where they ARE (`livePlanetAngle`, `legacyMoonAngle`): `orbitAngle`
 *    and `startAngle` are frozen at generation; the scene's `_live` entry is not.
 *  - A MOON is a target in the orrery (`legacyOrreryTarget`, through `moonBandPoint` — the same
 *    expression the moon dot is drawn with), and the planet detail resolves a target by PARENT AND
 *    MOON (`legacyDetailTarget`): a target outside this planet gets an edge triangle, not the centre.
 *
 * Deliberate non-goals · legacy's own ink (`#00ff80`, dashes [6, 4], alpha 0.6, the 12-px arrow
 *   offset) is untouched; only the geometry moves. No binary-star special case: a ship at a star is
 *   placed by coordinates.
 */
import { deriveShip, focusShip, liveMoonRelE, planetTrueScene } from './navViewModes/shipState.js';

/** The ship for this nav's displayed system, or `null` (not published for it, or cleared). */
export function legacyShip(nav) {
  const pub = nav._shipState;
  if (pub === undefined) return focusShip(nav._currentFocusIndex, nav._currentMoonIndex);
  const sys = nav._systemData;
  const memo = nav._shipAtMemo;
  const sh = (pub && sys && pub.sysKey === sys) ? deriveShip(pub, sys, (memo && memo.sys === sys) ? memo.at : null) : null;
  nav._shipAtMemo = sh ? { sys, at: sh.at } : null;   // the arrival hysteresis's memory, per system
  return sh;
}

/** A planet's angle NOW — the scene's live orbit, else the generator's. ⚠ `??` then `|| 0`: a live 0
 *  is a real angle, a missing one is not a number. */
export const livePlanetAngle = (p) => Number(p && (p._live?.orbitAngle ?? p.orbitAngle)) || 0;

/** A moon's angle around its planet NOW: its live offset when the scene has one, else `startAngle`
 *  (⛔ read with `Number.isFinite`, so a phase of exactly 0 stays 0), else legacy's own constant. */
export function legacyMoonAngle(p, m, fallback) {
  const rel = liveMoonRelE(p, m);
  if (rel) return Math.atan2(rel.z, rel.x);
  const mo = ((p && p.moons) || [])[m] || {};
  return Number.isFinite(mo.startAngle) ? mo.startAngle : fallback;
}

/** The orrery's planet disc radius — the one expression `_renderSystem`'s draw loop and the ship
 *  marker share (they must agree, `moonBandRadius`'s header). */
export const legacyOrreryBaseR = (pd) => Math.max(4, Math.min(12, 3 + Math.log2(Math.max(0.5, pd.radiusEarth)) * 2.5));   // verbatim `_renderSystem`'s draw-loop expression

/** A moon's drawn point in the PLANET DETAIL picture, in its sqrt-Earth-radii world: live offset when
 *  there is one, else legacy's own orbit and phase. One expression for the dot, the selection ring,
 *  the ship-at-moon marker and a moon target. */
export function legacyDetailMoonPoint(p, m, project) {
  const rel = liveMoonRelE(p, m);
  const mo = ((p && p.moons) || [])[m] || {};
  const r = rel ? Math.sqrt(Math.hypot(rel.x, rel.z)) : Math.sqrt(mo.orbitRadiusEarth || (10 + m * 8));
  const a = legacyMoonAngle(p, m, m * 2.4);
  return project(Math.cos(a) * r, 0, Math.sin(a) * r);
}

/**
 * The ship's point on the legacy ORRERY, or `null`.
 * @param {object} sh   `legacyShip`'s answer
 * @param {Function} bandPoint `(p, m, baseR, wx, wz) → {wx, wz}` — NavComputer's `moonBandPoint`
 *   bound to this frame's `projScale`, so the marker and the moon dot are one expression.
 */
export function legacyOrreryShip(sh, planets, project, auToScreen, bandPoint) {
  if (!sh) return null;
  const at = sh.at;
  if (at && at.kind !== 'star' && at.pIdx >= 0 && at.pIdx < planets.length) {
    const cp = planets[at.pIdx];
    const r = auToScreen(cp.orbitRadiusAU), a = livePlanetAngle(cp);
    const wx = Math.cos(a) * r, wz = Math.sin(a) * r;
    if (at.kind === 'moon' && cp.moons && at.mIdx >= 0 && at.mIdx < cp.moons.length) {
      const mp = bandPoint(cp, at.mIdx, legacyOrreryBaseR(cp.planetData), wx, wz);
      return project(mp.wx, 0, mp.wz);
    }
    return project(wx, 0, wz);
  }
  if (sh.live && sh.au) {
    // ⭐ OPEN SPACE — and a ship at a star, binary or not, by its own coordinates. Legacy's
    //    `auToScreen` is `sqrt(au)` with no floor, so no inner lerp is needed here.
    const R = Math.hypot(sh.au.x, sh.au.z), a = Math.atan2(sh.au.z, sh.au.x);
    return project(Math.cos(a) * auToScreen(R), 0, Math.sin(a) * auToScreen(R));
  }
  return at && at.kind === 'star' ? project(0, 0, 0) : null;
}

/** The orrery's target point for `_hoveredBody || _selectedBody`, MOONS INCLUDED, or `null`. */
export function legacyOrreryTarget(target, planets, project, auToScreen, bandPoint, starP) {
  if (!target) return null;
  if (target.type === 'star') return starP;
  const ti = target.type === 'planet' ? (target.index ?? target.planetIndex) : target.planetIndex;
  if (!(ti >= 0 && ti < planets.length)) return null;
  const tp = planets[ti];
  const r = auToScreen(tp.orbitRadiusAU), a = livePlanetAngle(tp);
  const wx = Math.cos(a) * r, wz = Math.sin(a) * r;
  if (target.type === 'planet') return project(wx, 0, wz);
  if (target.type !== 'moon') return null;
  const mi = target.moonIndex ?? target.index;
  if (!(tp.moons && mi >= 0 && mi < tp.moons.length)) return null;
  const mp = bandPoint(tp, mi, legacyOrreryBaseR(tp.planetData), wx, wz);
  return project(mp.wx, 0, mp.wz);
}

const EDGE_INSET = 14;
/** Where a ray from the picture's centre along `(dx, dy)` meets the pane inset by `EDGE_INSET`. */
function edgePoint(cx, cy, dx, dy, w, h) {
  const len = Math.hypot(dx, dy);
  if (!(len > 0)) return null;
  const ux = dx / len, uy = dy / len;
  let s = Infinity;
  if (ux > 0) s = Math.min(s, (w - EDGE_INSET - cx) / ux); else if (ux < 0) s = Math.min(s, (EDGE_INSET - cx) / ux);
  if (uy > 0) s = Math.min(s, (h - EDGE_INSET - cy) / uy); else if (uy < 0) s = Math.min(s, (EDGE_INSET - cy) / uy);
  if (!Number.isFinite(s) || s < 0) return null;
  return { x: cx + ux * s, y: cy + uy * s, ux, uy, edge: true };
}
const inPane = (pt, w, h) => pt.x >= EDGE_INSET && pt.x <= w - EDGE_INSET && pt.y >= EDGE_INSET && pt.y <= h - EDGE_INSET;
/** A true-frame bearing `(bx, bz)` turned into a screen direction through this picture's projection. */
function screenDir(project, bx, bz) {
  const n = Math.hypot(bx, bz) || 1;
  const o = project(0, 0, 0), q = project(bx / n, 0, bz / n);
  return { dx: q.x - o.x, dy: q.y - o.y, o };
}

/**
 * The ship's point in the legacy PLANET DETAIL (planet `idx` at the centre), or `null`. Inside this
 * planet's picture it is placed by its offset from the planet; anywhere else it is an edge marker
 * (`edge: true`, `ux/uy` pointing outward) along its bearing.
 */
export function legacyDetailShip(sh, idx, p, project, w, h) {
  if (!sh) return null;
  const at = sh.at, moons = (p && p.moons) || [];
  // ⛔ A LIVE SHIP ARRIVED AT THIS PLANET IS STILL PLACED BY ITS OFFSET: this picture is at moon scale,
  //    and a giant's 8R reaches its inner moons' orbits (live finding 1, Astra's point 1). Only the old
  //    focus path, which has no position, puts the ship on the centre.
  if (at && at.pIdx === idx && at.kind === 'planet' && !sh.live) return project(0, 0, 0);
  if (at && at.pIdx === idx && at.kind === 'moon' && at.mIdx >= 0 && at.mIdx < moons.length) return legacyDetailMoonPoint(p, at.mIdx, project);
  if (!sh.live) return null;      // the old focus path: the ship is elsewhere, which legacy never drew
  const rel = sh.rel && sh.rel[idx];
  if (!rel) return null;
  const dE = Math.hypot(rel.x, rel.z), a = Math.atan2(rel.z, rel.x);
  const pt = project(Math.cos(a) * Math.sqrt(dE), 0, Math.sin(a) * Math.sqrt(dE));
  if (inPane(pt, w, h)) return pt;
  const o = project(0, 0, 0);
  return edgePoint(o.x, o.y, pt.x - o.x, pt.y - o.y, w, h);
}

/**
 * The target point in the legacy PLANET DETAIL, resolved by PARENT AND MOON (Astra's point 5): this
 * planet or one of its moons is drawn; another planet, another planet's moon or the star is OFF this
 * picture and gets an edge point along its true bearing.
 */
export function legacyDetailTarget(target, idx, sys, project, w, h) {
  if (!target || !sys) return null;
  const planets = sys.planets || [], p = planets[idx];
  if (!p) return null;
  const moons = p.moons || [];
  let other = null;
  if (target.type === 'moon') {
    const pi = Number.isFinite(target.planetIndex) ? target.planetIndex : idx;   // a detail hover carries only `index`
    const mi = target.moonIndex ?? target.index;
    if (pi === idx) return (mi >= 0 && mi < moons.length) ? legacyDetailMoonPoint(p, mi, project) : null;
    other = planets[pi] || null;
  } else if (target.type === 'planet') {
    const ti = target.planetIndex ?? target.index;
    if (ti === idx) return project(0, 0, 0);
    other = planets[ti] || null;
  } else if (target.type !== 'star') return null;
  const here = planetTrueScene(p, null);
  const there = other ? planetTrueScene(other, null) : { x: 0, z: 0 };
  if (target.type !== 'star' && !other) return null;
  const d = screenDir(project, there.x - here.x, there.z - here.z);
  return edgePoint(d.o.x, d.o.y, d.dx, d.dy, w, h);
}

/** The outward edge triangle, in legacy's own ink. */
export function legacyEdgeTriangle(ctx, pt) {
  if (!pt) return;
  const tx = pt.x + pt.ux * 6, ty = pt.y + pt.uy * 6;
  ctx.fillStyle = '#00ff80';
  ctx.globalAlpha = 0.6;
  ctx.beginPath();
  ctx.moveTo(tx, ty);
  ctx.lineTo(pt.x - pt.ux * 2 + pt.uy * 5, pt.y - pt.uy * 2 - pt.ux * 5);
  ctx.lineTo(pt.x - pt.ux * 2 - pt.uy * 5, pt.y - pt.uy * 2 + pt.ux * 5);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1.0;
}
