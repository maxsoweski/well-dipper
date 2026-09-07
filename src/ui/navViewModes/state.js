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
 *
 * ── ⛔ THE SORT KEY IS PART OF ALL THREE CACHE KEYS, OR NOTHING RE-SORTS ────────────────────────
 *
 * AC-8 says the ranked list re-orders. The three caches above are exactly what a naive sort loses
 * to, and each loses differently: `sectorRows` is built ONCE per instance and never invalidated, so
 * a sort applied after the first frame would never be recomputed; `starRows` is keyed on
 * `(array identity, length)`, neither of which a sort moves; `bodies` is keyed on the system
 * object's identity, which a sort does not move either. So each cache below carries the ACTIVE SORT
 * KEY'S ID as part of its key, and each stores the built-but-unsorted rows separately from the
 * sorted view — the expensive half (775 `potentialDerivedDensity` calls, a `generateSystemName` per
 * star, the body flatten) is still paid once.
 *
 * ⚠ AND THE SORT RE-ORDERS THE ARRAY THE PAINT READS, not a private copy. `D.sectorRows`,
 * `D.starRows` and `D.bodies` ARE the paint's inputs; sorting anything else would make rail row N
 * and map glyph N different objects, and the picker — which resolves a row to an object by index —
 * would then be lying rather than merely stale.
 *
 * ⚠ `buildBodies` DID NOT SORT, despite the "AU-ordered" comment it was written under: belts are
 * appended after every planet, so a belt at 3 AU landed after a planet at 30 AU. That mattered more
 * than it looked, because `d1Ladder`'s minimum-separation pass walks the list left to right and
 * pushes any body closer than 8 texels to its predecessor further RIGHT — fed a descending pair it
 * shoves the belt most of an axis past where it belongs. Level 4's default key is AU ascending, so
 * the ladder now gets the order its own arithmetic assumes.
 *
 * ── ⭐ `S.cam` AND `S.view` — THE CAMERA AND THE FRAME THE GAME ALREADY RUNS ────────────────────
 *
 * Both are written here, from live NavComputer state, and both are BYTE-IDENTICAL TO TODAY'S VALUES
 * AT ENTRY, which is what makes them safe (INTERFACE §1c, §2):
 *   · `S.cam` ← `_localCenter` / `_localRadius`. On entering PRISM the game sets `_localCenter` to
 *     the player position and `_localRadius` to 0.0015, which IS `ZOOM_STOPS[0]` — the frame Max
 *     ruled on, reproduced exactly, and live under `_updateHeldKeys`' WASD/R/F and `_handleWheel`
 *     thereafter.
 *   · `S.view` ← `_viewCenter` / `_viewSize`. `_setupViewStackForPlayer` (:1200-1225) builds
 *     stack[1] and stack[2] as exactly what `levelView(1)` and `levelView(2)` compute, so the
 *     picture at entry is unchanged and only a DRILL moves it — which is the point: today the
 *     designs are player-anchored, so clicking a sector drills the game while both designs keep
 *     drawing the player's, and "CLICK A SECTOR" is false in the way that matters.
 * ⛔ Rotation is deliberately absent. Neither prism hint advertises it and the designs' fixed
 * shallow tilt is part of the picture Max ruled on.
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
 * THE SORT KEYS, per level, in the order `[` and `]` walk them (AC-8).
 *
 * ⭐ INDEX 0 OF EVERY ROW IS TODAY'S ORDER, EXACTLY. Sectors were already `sort((a,b) => b.n - a.n)`
 * and prism stars already ascending by distance, so the default picture is unchanged and the sort is
 * an addition rather than a re-ruling. The one deliberate exception is level 4, where index 0 is AU
 * ascending against a list that was previously unsorted — see the `buildBodies` note in the header.
 *
 * ⚠ LEVELS 1-2 CARRY NO COMPARATOR, AND THAT IS NOT AN OMISSION. Their rows are not in `D` at all:
 * `d1TileRows` builds and ranks the 64 / 256 tiles INSIDE the paint, from `levelView`, and returns
 * them already sorted by star count. The driver owns `S.sortIdx` / `S.sortLabel` so the key is
 * published and legible on the glass, and the LAB is what honours it at its own draw site — the same
 * split as `S.ladderScroll`. Until it does, `[`/`]` at those two levels moves the published key and
 * nothing else, and the rail picker stays correct either way because it resolves a row through
 * `S.railTiles`, which the paint publishes AFTER whatever ordering it applied.
 *
 * @type {Array<Array<{id:string,label:string,cmp?:Function}>>}
 */
export const SORT_KEYS = [
  [ { id: 'stars', label: 'STARS', cmp: (a, b) => b.n - a.n },
    { id: 'name',  label: 'NAME',  cmp: (a, b) => String(a.s?.name || '').localeCompare(String(b.s?.name || '')) } ],
  [ { id: 'stars', label: 'STARS' }, { id: 'id', label: 'ID' } ],
  [ { id: 'stars', label: 'STARS' }, { id: 'id', label: 'ID' } ],
  [ { id: 'dist',  label: 'DIST',  cmp: (a, b) => (a.dist ?? Infinity) - (b.dist ?? Infinity) },
    { id: 'name',  label: 'NAME',  cmp: (a, b) => String(a.name || '').localeCompare(String(b.name || '')) },
    { id: 'class', label: 'CLASS', cmp: (a, b) => String(a.spectral || '').localeCompare(String(b.spectral || ''))
                                               || ((a.dist ?? 0) - (b.dist ?? 0)) },
    { id: 'mult',  label: 'COMPS', cmp: (a, b) => ((b.mult ?? 1) - (a.mult ?? 1))
                                               || ((a.dist ?? 0) - (b.dist ?? 0)) } ],
  [ { id: 'au',    label: 'AU',    cmp: (a, b) => (a.au ?? 0) - (b.au ?? 0) },
    { id: 'name',  label: 'NAME',  cmp: (a, b) => String(a.name || '').localeCompare(String(b.name || '')) },
    { id: 'temp',  label: 'TEMP',  cmp: (a, b) => (b.T ?? -Infinity) - (a.T ?? -Infinity) } ],
];

/** The active key for one level: the pilot's choice at the level he is ON, index 0 everywhere else. */
export function sortKeyFor(S, level) {
  const keys = SORT_KEYS[level] || [];
  if (!keys.length) return { id: 'none', label: '' };
  return (S.level === level ? keys[S.sortIdx | 0] : keys[0]) || keys[0];
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
    // ⭐ Design 1's SYSTEM ladder pans horizontally (Max, 2026-09-07: "have the line end in a
    // '...' that we can scroll toward"). `ladderScroll` is the only field the CONTROL writes;
    // `ladderStops` / `ladderMax` / `ladderCaps` are written BY d1Ladder each paint and read by
    // the control, so the window and the thing that moves it share one arithmetic.
    ladderScroll: 0, ladderStops: [], ladderMax: 0, ladderCaps: null, ladderVisible: [-1, -1],
    buf: { width: 427, height: 240 },

    // ── ⛔ EVERY FIELD BELOW NEEDS A DEFAULT HERE EVEN THOUGH THE PAINT WRITES IT ────────────────
    // A painter throw is not a blank field. `PanelHost` catches one ONCE and then stops uploading,
    // so the glass keeps showing the last good frame and looks alive — which is indistinguishable
    // from "the nav works" until Max clicks something. So every field a design reads is declared
    // here with a value it can be drawn against, including the ones the design itself fills in.

    /** THE PAINT PUBLISHES THESE (INTERFACE §1). The driver clears them at the head of each frame,
     *  for the same reason `resetRegions()` exists: a stale rectangle makes a hit-test that should
     *  say "nothing published" quietly answer against the frame before it. */
    mapProj: null,      // {design,level,kind,x0,y0,w,h,cx,cz,spanX,spanZ,n} — levels 0-2
    prismHits: [],      // [{x,y,r,ref}]                — level 3, in DRAW ORDER
    bodyHits: [],       // [{x,y,r,ref,moon,star}]      — level 4
    railTiles: [],      // [{i,j,id,x,z,n}]             — design 1's rail rows at levels 1-2
    listGeom: null,     // {x,y,rows,lead,offset,total} — design 2's list
    tabRects: null,     // [{x,y,w,h}] x5               — the DESIGN's tab strip, not the legacy one
    chipRect: null,     // {x,y,w,h}                    — the drawn commit control

    /** THE DRIVER PUBLISHES THESE. `cam` is the prism camera the game already runs and `view` is the
     *  2D frame it already drills; both are byte-identical to today's values at entry (see header). */
    cam:  { x: 0, y: 0, z: 0, radius: 0.0015 },
    view: { cx: 8, cz: 0, size: 44 },

    /** SORT + PAGE (AC-8, AC-9). `sortLabel` exists because Max never uses a browser console — an
     *  active sort key that is not on the glass is not an affordance, it is a secret. */
    sortIdx: 0, sortLabel: '', listOffset: 0,

    /** ⭐ THE DRAWN SEARCH (AC-11), AND ALL FOUR FIELDS ARE DECLARED HERE FOR THE REASON THE BLOCK
     *  ABOVE GIVES: a design reads every one of them unguarded, and a field that arrives `undefined`
     *  is not a blank row, it is a painter throw — which `PanelHost` catches ONCE before it stops
     *  uploading and leaves the glass frozen on the last good frame, looking alive.
     *  ⛔ `rows` IS PLAIN DATA, NOT `_searchResults`. The driver mirrors the instrument's own results
     *  into `{ name, kind }` pairs (see `search.js`), so the designs never touch the resolver's
     *  shape — which is what lets the lab, which has no resolver, draw the identical field. */
    search: { open: false, text: '', highlight: -1, rows: [] },
    searchGeom: null,   // {design,top,lead,rows,x0,x1,offset,total} — d1Search / d2Search
  };
  const D = {
    ready: false, note: [], fail: [],
    gm: null, sectors: null, lum: null, nav: null,
    player: null, playerSector: null,
    sectorRows: [], stars: [], starRows: [], sys: null, bodies: [],
    target: null, selStar: null, selBody: null, sysStar: null, here: null,
    lumCache: new Map(),
  };

  const cache = {
    sectorBase: null, sectorRows: null, sectorSortId: null,
    starsRef: null, starsLen: -1, starRowsBase: null, starSortId: null,
    sysRef: undefined, bodiesBase: null, bodySortId: null,
    level: -1,
    nameBySeed: new Map(),
  };

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
      // ⛔ NEITHER FIELD MAY BE UNDEFINED. Both designs call `.toUpperCase()` on `name` and `cls`
      // unguarded — `d1Rail`'s detail block does it twice on one line — and `displayClassOf` returns
      // undefined for planet data it does not recognise, which is reachable from any generator
      // change upstream. A throw here is not a blank field: `PanelHost` catches a painter throw ONCE
      // and then stops uploading, so the glass freezes on the last good frame and looks alive.
      rows.push({ kind: 'planet', name: pname || '—', au: Number(p.orbitRadiusAU) || 0, cls: displayClassOf(pd) || 'unknown',
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
        rows.push({ kind: 'moon', name: mname || '—', au: Number(p.orbitRadiusAU) || 0, cls: m.type || 'moon',
                    rE: m.radiusEarth, T: m.T_eq, hab: null, rings: false, moons: 0, parent: i,
                    pIdx: i, mIdx: j });
      });
    });
    (sys.asteroidBelts || []).forEach((b, i) => {
      rows.push({ kind: 'belt', name: 'BELT ' + ('ABC'[i] || (i + 1)), au: Number(b.centerRadiusAU) || 0, cls: 'belt',
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

    // ── THE LEVEL CHANGED ⇒ THE SORT AND THE PAGE START AGAIN. `S.sortIdx` indexes the ACTIVE
    //    level's key list and the lists differ in length, so carrying an index across a level change
    //    either points past the end or silently means a different key; and a page offset into a
    //    27,524-row star list is meaningless against 64 tiles. Same shape as `S.ladderScroll`'s
    //    reset on a new system, and for the same reason: inheriting an offset opens the new list
    //    scrolled past everything it has.
    if (cache.level !== S.level) { cache.level = S.level; S.sortIdx = 0; S.listOffset = 0; }
    const keys = SORT_KEYS[S.level] || [];
    if (keys.length) S.sortIdx = Math.max(0, Math.min(keys.length - 1, S.sortIdx | 0));
    S.sortLabel = keys[S.sortIdx | 0]?.label || '';

    // ── ⭐ THE CAMERA AND THE FRAME (AC-5, INTERFACE §1c/§2). Mutated in place, never replaced:
    //    a design that had captured `S.cam` would keep the object, and the whole seam is that these
    //    are the numbers the game's OWN WASD/R/F pan and wheel zoom already move every frame.
    const lc = nav._localCenter || { x: 0, y: 0, z: 0 };
    S.cam.x = lc.x; S.cam.y = lc.y; S.cam.z = lc.z;
    S.cam.radius = Number.isFinite(nav._localRadius) ? nav._localRadius : 0.0015;
    const vc = nav._viewCenter || { x: 8, z: 0 };
    S.view.cx = vc.x; S.view.cz = vc.z;
    S.view.size = Number.isFinite(nav._viewSize) ? nav._viewSize : 44;

    D.gm = nav._gm;
    D.sectors = nav._sectors;
    D.lum = nav._luminosityRenderer;
    D.nav = nav._navGalaxyRenderer;
    D.player = { x: nav._playerX, y: nav._playerY, z: nav._playerZ };
    D.playerSector = nav._currentSector || nav._sectors?.getSectorAt(D.player) || null;

    // ── SECTOR ROWS — the EXPENSIVE half is galaxy-only, so it is built once and never invalidated;
    //    only the ORDER is re-derived, and only when the key moves.
    if (!cache.sectorBase && D.sectors && D.gm) {
      cache.sectorBase = D.sectors.getSectors()
        .map((s) => ({ s, n: estStars(D.gm, s.centerX, s.centerZ, s.size) }));
    }
    const secKey = sortKeyFor(S, 0);
    if (cache.sectorBase && cache.sectorSortId !== secKey.id) {
      cache.sectorSortId = secKey.id;
      cache.sectorRows = secKey.cmp ? cache.sectorBase.slice().sort(secKey.cmp) : cache.sectorBase.slice();
    }
    D.sectorRows = cache.sectorRows || [];

    // ── STAR ROWS — re-ranked when the background loader has grown `_localStars`, OR when the sort
    //    key moves. See the caching note above for why the array's identity alone is not a
    //    sufficient key, and the sort note for why the key has to be part of it.
    D.stars = nav._localStars || [];
    const starKey = sortKeyFor(S, 3);
    if (cache.starsRef !== D.stars || cache.starsLen !== D.stars.length) {
      cache.starsRef = D.stars; cache.starsLen = D.stars.length; cache.starSortId = null;
      cache.starRowsBase = D.stars
        .map((s) => ({ ...s, name: nameFor(s), pc: (s.dist ?? 0) * 1000, ly: (s.dist ?? 0) * KPC_TO_LY }));
    }
    if (cache.starRowsBase && cache.starSortId !== starKey.id) {
      cache.starSortId = starKey.id;
      D.starRows = starKey.cmp ? cache.starRowsBase.slice().sort(starKey.cmp) : cache.starRowsBase.slice();
    }

    // ── WHERE YOU ARE. The instrument knows by NAME (`_currentSystemName` is written from main.js);
    //    the NEAREST row is the fallback for a hash-grid system whose generated name differs.
    //    ⛔ NEAREST, NOT `starRows[0]` — those are the same row only while the list is sorted by
    //    distance, and AC-8 makes that one option out of four. "Where am I" cannot depend on which
    //    column the pilot last sorted by.
    D.here = (nav._currentSystemName
      ? D.starRows.find((r) => r.name === nav._currentSystemName) : null)
      || D.starRows.reduce((m, r) => (m == null || (r.dist ?? Infinity) < (m.dist ?? Infinity) ? r : m), null)
      || null;

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
    const bodyKey = sortKeyFor(S, 4);
    if (cache.sysRef !== D.sys) {
      cache.sysRef = D.sys; cache.bodySortId = null;
      cache.bodiesBase = buildBodies(D.sys, D.sysStar);
      S.ladderScroll = 0;   // ⛔ a NEW system starts at the left of its own ladder; inheriting the
                            // last one's offset opens Proxima scrolled past its only planet
    }
    if (cache.bodiesBase && cache.bodySortId !== bodyKey.id) {
      cache.bodySortId = bodyKey.id;
      // ⭐ A STABLE SORT KEEPS EACH MOON DIRECTLY AFTER ITS PLANET under the AU key, because a moon
      //    carries its parent's AU and `buildBodies` already emits them adjacent. Under NAME they
      //    scatter, which is what a name sort MEANS — `pIdx`/`mIdx` ride the rows, so the picker's
      //    identities survive any order.
      D.bodies = bodyKey.cmp ? cache.bodiesBase.slice().sort(bodyKey.cmp) : cache.bodiesBase.slice();
      S.ladderScroll = 0;   // a re-order invalidates the window you were scrolled to
    }
    // ⛔ THE FLAT LIST IS NOT INDEXABLE BY A PLANET INDEX. `_selectedBody.planetIndex` indexes
    //    `_systemData.planets`; `D.bodies` is the FLAT list with moons interleaved, belts appended
    //    and (since AC-8) an arbitrary sort applied. `D.bodies[pick.index]` therefore drew the
    //    selection frame on whatever happened to sit at that slot — click planet 2 and the frame
    //    lands on planet 0's first moon. `pIdx` is the correspondence, and it is the ONLY one.
    //    ⚠ AND THE FIELD IS `planetIndex`, NOT `index`. `NavComputer.js:265` documents the shape as
    //    `{ type, index }` and every one of the four sites that WRITES it (:4517, :4523, :4567,
    //    :4580) writes `planetIndex` / `moonIndex` / `starIndex` instead. So `pick.index` was
    //    `undefined` on every path, `D.bodies[undefined]` was `undefined`, and the selection fell
    //    through to the habitability guess EVERY TIME — the detail block has never once shown the
    //    body the pilot picked. `index` is still accepted below in case a caller honours the comment.
    const pick = nav._selectedBody;
    const pickP = pick ? (pick.planetIndex ?? pick.index) : null;
    D.selBody = (pick && pick.type === 'planet'
                   ? D.bodies.find((r) => r.kind === 'planet' && r.pIdx === pickP) : null)
      || (pick && pick.type === 'moon'
                   ? D.bodies.find((r) => r.kind === 'moon' && r.pIdx === pickP && r.mIdx === pick.moonIndex) : null)
      || (D.bodies.find((r) => r.kind === 'planet' && r.hab != null && r.hab > 0.5)
         || D.bodies.find((r) => r.kind === 'planet') || D.bodies[0] || null);

    D.ready = !!(D.gm && D.player);
    return { S, D };
  }

  return { S, D, refresh };
}
