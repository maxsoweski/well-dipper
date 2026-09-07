/**
 * navViewModes/state.js — the ADAPTER, and the only genuinely new thinking in this workstream.
 *
 * ── WHAT IT IS FOR ──────────────────────────────────────────────────────────────────────────────
 *
 * `designs.js` is `nav-240p-lab.html`'s draw code, lifted verbatim. It reads exactly two objects —
 * `S` (what the view is showing) and `D` (the data behind it) — and in the lab those were built by a
 * page that had no user: it PICKED a system to display, PICKED a star to target, and queried the
 * starfield itself. Production has a pilot who has already made all three of those choices.
 *
 * So this file is where the lab's self-supplied answers are replaced by the instrument's real ones,
 * and it is deliberately the only place that knows both vocabularies. Everything above it draws; the
 * `NavComputer` below it holds state under its own private names. One seam, and it is testable
 * without a canvas.
 *
 * ── ⛔ MUTATE, NEVER REPLACE ────────────────────────────────────────────────────────────────────
 *
 * `makeDesigns({ S, D })` closed over those two identities once. `refresh()` writes FIELDS onto the
 * same objects every frame. Assigning `D = {...}` here would leave every design painting the frame
 * the factory was built on — and it would repaint happily forever, so the failure looks like "the
 * nav has frozen", not like a bug in this file.
 *
 * ── ⭐ WHAT IS CACHED, AND WHY EACH ONE HAD TO BE ────────────────────────────────────────────────
 *
 * The overlay repaints at 60 Hz and the cockpit panel at the ambient panel rate. Three of these
 * derivations are far too expensive to run per frame, and each is cached on a DIFFERENT key because
 * each becomes stale for a different reason:
 *
 *   · `sectorRows` — 775 sectors, each costing a `potentialDerivedDensity` call. It depends on the
 *     galaxy alone, which never changes, so it is built ONCE per instance and never invalidated.
 *   · `starRows`   — a rank over `_localStars`, which the nav's own background loader GROWS while
 *     the prism is open (212 stars, then more). Keyed on the array's identity AND its length, so a
 *     background expansion re-ranks and a repaint does not.
 *   · `bodies`     — flattened from `_systemData`, which changes only when the pilot drills into a
 *     different star. Keyed on the system object's identity.
 *
 * ⚠ `starRows` IS NOT KEYED ON THE ARRAY IDENTITY ALONE. `_localStars` is `push`ed into in place by
 * the background loader (`NavComputer._resetPrismLoad` / the expansion timer), so the identity is
 * stable across a growth that changes every rank. Length is the cheap half of the key that actually
 * moves.
 *
 * ── ⛔ WHERE THE LAB CHOSE AND PRODUCTION MUST NOT ──────────────────────────────────────────────
 *
 *   lab                                          production
 *   ─────────────────────────────────────────    ────────────────────────────────────────────────
 *   `pickSystem()` walks to the nth star that     `_systemStar` / `_systemData` — whatever the
 *   HAS bodies, so the orrery is never empty      pilot actually drilled into, empty or not
 *   `selStar` = nearest real star                 `_selectedNavStar`, the pilot's selection
 *   queries `findStarsInPrism` itself             `_localStars`, already loaded by the nav
 *
 * ⚠ AND THE EMPTY SYSTEM IS NOW REACHABLE, WHICH IT WAS NOT IN THE LAB. Proxima Centauri has zero
 * planets on this seed; the lab skipped past it by construction, so neither design has ever been
 * drawn against an empty body list. Both are given an explicit empty `bodies` array rather than a
 * null, so the row loops draw nothing instead of throwing — a painter throw is caught ONCE by
 * `PanelHost`, which then leaves the glass frozen on the last good frame.
 */

import { generateSystemName, generatePlanetName, generateMoonName } from '../../generation/NameGenerator.js';
import { displayClassOf } from '../../generation/worldClass.js';
import { multiplicityForSeed } from '../../generation/multiplicityOracle.js';
import alea from 'alea';

/** `NavComputer.js:69`, verbatim. */
const DENSITY_TO_STARS_PER_PC3 = 0.14 / 0.065;
/** kpc -> light years. */
const KPC_TO_LY = 3261.56;

/** `NavComputer._makeRng` (:315-327), the same shape — the names must match the instrument's. */
function makeRng(seed) {
  const fn = alea(seed);
  return { next: () => fn(), child: (tag) => makeRng(String(seed) + ':' + tag) };
}

/** `NavComputer._estimateBlockStarCount`'s arithmetic at a new call site, not a new pipeline. */
function estStars(gm, x, z, sizeKpc) {
  const R = Math.hypot(x, z), theta = Math.atan2(z, x || 1e-10);
  const d = gm.potentialDerivedDensity(R, 0, theta).totalDensity;
  const perPc3 = Math.max(0.001, d * DENSITY_TO_STARS_PER_PC3);
  return Math.round(perPc3 * (sizeKpc * 1000) ** 2 * 600);
}

/**
 * Build the `S` / `D` pair for one NavComputer, plus the `refresh(nav)` that keeps them current.
 *
 * ⛔ Call this ONCE per instance and hand the SAME `S` and `D` to `makeDesigns`. See "mutate, never
 * replace" above.
 */
export function makeViewState() {
  const S = {
    design: 1,        // 1 = the 71x40 rail, 2 = two bars and a sky
    level: 3,
    lines: 240,
    list: false,      // design 2's 'L' mode
    sabotage: false,  // the guard's own proof lever — never true in shipped code
    zoomIdx: 0,
    buf: { width: 427, height: 240 },
  };
  const D = {
    ready: false, note: [], fail: [],
    gm: null, sectors: null, lum: null, nav: null,
    player: null, playerSector: null,
    sectorRows: [], stars: [], starRows: [], sys: null, bodies: [],
    target: null, selStar: null, selBody: null, sysStar: null, here: null,
    lumCache: new Map(),
  };

  const cache = { sectorRows: null, starsRef: null, starsLen: -1, sysRef: undefined, nameBySeed: new Map() };

  /** The system name for a prism star — memoised, because `generateSystemName` is not cheap and the
   *  rank runs over every loaded star. Keyed by seed, which is what the name is derived from. */
  const nameFor = (s) => {
    if (s.name) return s.name;
    if (cache.nameBySeed.has(s.seed)) return cache.nameBySeed.get(s.seed);
    let n = '';
    try { n = generateSystemName(makeRng(s.seed), { x: s.wx, y: s.wy, z: s.wz }); } catch (e) { n = ''; }
    cache.nameBySeed.set(s.seed, n);
    return n;
  };

  /** Flatten `_systemData` into the AU-ordered list every design wants and the instrument has never
   *  had. Lifted from the lab's `buildSystem`, minus its choice of WHICH system. */
  function buildBodies(sys, star) {
    const rows = [];
    if (!sys || !star) return rows;
    const rng = makeRng(star.seed + ':names');
    const planets = sys.planets || [];
    planets.forEach((p, i) => {
      const pd = p.planetData;
      if (!pd) return;
      let pname = '';
      try { pname = generatePlanetName(rng.child('p' + i), star.name || 'STAR', i, planets.length); }
      catch (e) { pname = (star.name || 'S') + ' ' + 'bcdefghijk'[i]; }
      rows.push({ kind: 'planet', name: pname, au: p.orbitRadiusAU, cls: displayClassOf(pd),
                  rE: pd.radiusEarth, T: pd.T_eq, hab: pd.habitability?.score ?? null,
                  rings: !!pd.rings, moons: p.moons?.length || 0, pd,
                  // ⭐ pIdx / mIdx are THIS ADAPTER'S ADDITION, not the lab's, and they are what lets a
                  // rail row hand `_hoveredBody` the { type, index } shape the SHIPPED click handler
                  // already understands. Without them the flat list's position would have to be
                  // re-derived at the hit-test — a second mapping to keep in step with this one.
                  pIdx: i });
      (p.moons || []).forEach((m, j) => {
        let mname = '';
        try { mname = generateMoonName(rng.child(`m${i}.${j}`), pname, j, p.moons.length); }
        catch (e) { mname = pname + ' ' + (j + 1); }
        rows.push({ kind: 'moon', name: mname, au: p.orbitRadiusAU, cls: m.type || 'moon',
                    rE: m.radiusEarth, T: m.T_eq, hab: null, rings: false, moons: 0, parent: i,
                    pIdx: i, mIdx: j });
      });
    });
    (sys.asteroidBelts || []).forEach((b, i) => {
      rows.push({ kind: 'belt', name: 'BELT ' + 'ABC'[i], au: b.centerRadiusAU, cls: 'belt',
                  rE: null, T: null, hab: null, rings: false, moons: 0, widthAU: b.widthAU });
    });
    return rows;
  }

  /**
   * Pull one frame of live state off the instrument. Cheap: three cache checks and some field reads.
   * @param {object} nav the NavComputer
   * @param {{width:number,height:number,lines:number}} buf the buffer being drawn into
   */
  function refresh(nav, buf) {
    S.level = nav._levelIndex | 0;
    S.lines = buf.lines;
    S.buf.width = buf.width; S.buf.height = buf.height;

    D.gm = nav._gm;
    D.sectors = nav._sectors;
    D.lum = nav._luminosityRenderer;
    D.nav = nav._navGalaxyRenderer;
    D.player = { x: nav._playerX, y: nav._playerY, z: nav._playerZ };
    D.playerSector = nav._currentSector || nav._sectors?.getSectorAt(D.player) || null;

    // ── SECTOR ROWS — galaxy-only, so built once and never invalidated.
    if (!cache.sectorRows && D.sectors && D.gm) {
      const secs = D.sectors.getSectors();
      cache.sectorRows = secs.map((s) => ({ s, n: estStars(D.gm, s.centerX, s.centerZ, s.size) }))
                             .sort((a, b) => b.n - a.n);
    }
    D.sectorRows = cache.sectorRows || [];

    // ── STAR ROWS — re-ranked when the background loader has grown `_localStars`. See the caching
    //    note above for why the array's identity alone is not a sufficient key.
    D.stars = nav._localStars || [];
    if (cache.starsRef !== D.stars || cache.starsLen !== D.stars.length) {
      cache.starsRef = D.stars; cache.starsLen = D.stars.length;
      D.starRows = D.stars
        .map((s) => ({ ...s, name: nameFor(s), pc: (s.dist ?? 0) * 1000, ly: (s.dist ?? 0) * KPC_TO_LY }))
        .sort((a, b) => (a.dist ?? Infinity) - (b.dist ?? Infinity));
    }

    // ── WHERE YOU ARE. The instrument knows by NAME (`_currentSystemName` is written from main.js);
    //    the nearest row is the fallback for a hash-grid system whose generated name differs.
    D.here = (nav._currentSystemName
      ? D.starRows.find((r) => r.name === nav._currentSystemName) : null) || D.starRows[0] || null;

    // ── WHAT IS SELECTED. The pilot's choice, never the adapter's.
    const sel = nav._selectedNavStar;
    D.selStar = sel ? (D.starRows.find((r) => r.seed === sel.seed) || {
      ...sel, name: nameFor(sel), pc: (sel.dist ?? 0) * 1000, ly: (sel.dist ?? 0) * KPC_TO_LY,
    }) : null;
    D.target = D.selStar || (nav._externalTarget ? {
      name: nav._externalTarget.name || '', wx: nav._externalTarget.x, wy: nav._externalTarget.y,
      wz: nav._externalTarget.z, seed: 0, spectral: 'G',
      ly: Math.hypot(nav._externalTarget.x - D.player.x, nav._externalTarget.y - D.player.y,
                     nav._externalTarget.z - D.player.z) * KPC_TO_LY,
    } : null);
    if (D.selStar && D.selStar.mult == null && D.gm) {
      try {
        D.selStar.mult = multiplicityForSeed(
          { seed: D.selStar.seed, pos: { x: D.selStar.wx, y: D.selStar.wy, z: D.selStar.wz },
            type: D.selStar.spectral, name: D.selStar.name }, { galacticMap: D.gm }).count;
      } catch (e) { D.selStar.mult = 1; }
    }

    // ── THE SYSTEM ON SCREEN — whatever was drilled into, INCLUDING an empty one.
    D.sys = nav._systemData || null;
    D.sysStar = nav._systemStar
      ? { ...nav._systemStar, name: nameFor(nav._systemStar) } : null;
    if (cache.sysRef !== D.sys) {
      cache.sysRef = D.sys;
      D.bodies = buildBodies(D.sys, D.sysStar);
    }
    const pick = nav._selectedBody;
    D.selBody = (pick && pick.type === 'planet' && D.bodies[pick.index]) ? D.bodies[pick.index]
      : (D.bodies.find((r) => r.kind === 'planet' && r.hab != null && r.hab > 0.5)
         || D.bodies.find((r) => r.kind === 'planet') || D.bodies[0] || null);

    D.ready = !!(D.gm && D.player);
    return { S, D };
  }

  return { S, D, refresh };
}
