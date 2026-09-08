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
 *
 * ⭐⭐ ROTATION IS NOW WIRED, AND IT WAS THE ONE HOP MISSING — the note that used to sit here said
 * it was "deliberately absent" because the designs' fixed shallow tilt was the picture Max ruled on.
 * Measured since, with a liveness control: rotating the legacy camera left `S.prismHits`
 * BYTE-IDENTICAL while nudging `_localCenter.z` by 0.0004 moved every mark — so the pilot was
 * already dragging a camera nothing downstream could see, and "DRAG TO ROTATE" was a promise the
 * glass could not keep. `S.cam` gains `rotX`/`rotY` and `S.sysCam` is new; the defaults are the
 * designs' own fixed tilts, derived from the gains (see `PRISM_ROT_X0` / `SYSTEM_ROT_X0`), so the
 * ruled-on picture is what a camera sitting at its default reproduces.
 * ⛔ TWO PAIRS. Level 3 drags `_localRot*` and level 4 drags `_systemRot*`, clamped differently
 * (`:4354` / `:4360`); one shared pair would make a prism drag turn the orrery.
 */

import { generateSystemName, generatePlanetName, generateMoonName } from '../../generation/NameGenerator.js';
import { displayClassOf } from '../../generation/worldClass.js';
import { multiplicityForSeed } from '../../generation/multiplicityOracle.js';
/** ⛔ THE SIM CLOCK, NOT `performance.now()` — the same one `_startDrillAnim`, `_viewEase` and
 *  `_systemZoomAnim` are measured on, so the inbound ease and the transitions it is standing beside
 *  cannot drift apart under a throttled tab. */
import { simClockMs } from '../../core/SimClock.js';
import alea from 'alea';

/** `NavComputer.js:69`, verbatim. */
const DENSITY_TO_STARS_PER_PC3 = 0.14 / 0.065;
/** kpc -> light years. */
const KPC_TO_LY = 3261.56;

// ── ⭐⭐ THE ROTATION DEFAULTS, AND THE GAINS COME FIRST (INTERFACE §1) ──────────────────────────
//
// The designs' fixed gains are NOT a rotation matrix. `projectPrism` scales dx by 0.92, dz by 0.42
// and dy by 0.55, and `hypot(0.42, 0.55) = 0.692…` ≠ 1 — so today's picture factors as an
// ELEVATION-ONLY rotation times an anisotropic scale, and the factorisation does not round-trip
// bit-identically: `K*sin(rotX₀)` comes back as 0.42000000000000004, one or two ULP off.
//
// ⛔ THEREFORE THE GAINS ARE THE NAMED CONSTANTS AND THE ANGLE IS DERIVED FROM THEM, NEVER THE
// OTHER WAY ROUND. Every consumer of the projection rounds, so no texel moves either way; but the
// raw floats also feed the bounds culls and go UNROUNDED into `S.prismHits`, where `nearestHit`
// measures a distance against a radius. The AC says byte-identical, so this does not gamble on a
// float landing off a `.5`.
/** `projectPrism`'s two vertical gains — the numbers in the draw code, not a reconstruction. */
export const PRISM_DZ = 0.42, PRISM_DY = 0.55;
/** The elevation those two gains ARE: `atan2(0.42, 0.55)` = 0.6521714117570698 rad (37.3667°). */
export const PRISM_ROT_X0 = Math.atan2(PRISM_DZ, PRISM_DY);
/** `d2System`'s TILT. ⭐ This one IS a true sine — `Math.sin(Math.asin(0.42)) === 0.42` exactly. */
export const SYSTEM_TILT = 0.42;
/** = 0.43344532006988595 rad, and the round trip through it is bit-identical. */
export const SYSTEM_ROT_X0 = Math.asin(SYSTEM_TILT);

/**
 * ⭐ AC-6's INBOUND EASE — the same 350 ms and the same smootherstep the OUTBOUND half already uses.
 *
 * ⛔ THE NUMBER IS NOT A TASTE CHOICE, IT IS A MATCH. `NavComputer.js:4476`'s tab-out `_viewEase`
 * is `duration: 350` and `:1419` eases it with `t*t*t*(t*(t*6-15)+10)`; `_updateAnim` (:1268) uses
 * the identical curve for every drill. A different duration or a different curve here would make the
 * way IN visibly a different animation from the way OUT, on the same two keys.
 */
export const LEVEL_LAG_MS = 350;
/** `NavComputer.gridNForLevel` (:71), the authority for the tile subdivision the outbound ease
 *  divides by. Restating it is the AC-4 defect shape; it is two constants and it is imported nowhere,
 *  so it is spelled here ONCE and read by the lag's `toView.size` and by nothing else. */
const LAG_GRID_N = (level) => (level === 2 ? 16 : 8);
/** The curve `_updateAnim` and `_viewEase` both run. */
const smootherstep = (t) => t * t * t * (t * (t * 6 - 15) + 10);

/**
 * An azimuth into `[0, 2π)`.
 *
 * ⛔ BECAUSE THE GAME'S TWO AZIMUTHS ARE UNCLAMPED AND UNWRAPPED AND GROW WITHOUT BOUND.
 * `NavComputer:4353` writes `_localRotY = _dragStartRotY + dx * 0.008` and `:4359` does the same for
 * `_systemRotY` — neither is clamped (only the two ELEVATIONS are, to `[0, π/2]` at level 3 and
 * `[0.1, π/2]` at level 4, at `:4354` / `:4360`), so a pilot who keeps dragging one way walks them
 * off to arbitrary magnitude and takes mantissa bits off every `sin`/`cos` downstream with him.
 * ⭐ Wrapping is invisible to the picture — `sin` and `cos` are 2π-periodic — and it is done HERE,
 * on the copy the designs read, never on the raw field: the HOST owns `_localRotY` and the legacy
 * painters (`:1374`, `:1892`, `:3605`) read it, so touching it would move a picture nobody asked to
 * move. Two pairs in, two pairs out; this is the only arithmetic applied to either.
 */
export function wrapTau(v) {
  if (!Number.isFinite(v)) return 0;
  const TAU = Math.PI * 2;
  const r = v % TAU;
  return r < 0 ? r + TAU : r;
}

/**
 * `NavComputer._makeRng` (:315-327), THE SAME SHAPE — and until 2026-09-08 it was not, while the
 * comment on this very line asserted that it was.
 *
 * ⛔⛔ THE OLD BODY WAS `{ next, child }` AND IT MADE EVERY BODY NAME ON THE GLASS A SWALLOWED ERROR.
 * `NameGenerator.generatePlanetName` opens on `rng.float()` and `generateMoonName` calls
 * `rng.float()` / `rng.int()` / `rng.pick()`; none of those existed here, so every single call threw
 * `TypeError: rng.float is not a function` straight into `buildBodies`' `catch`, and every name Max
 * has ever read at SYSTEM was the fallback `(star.name || 'S') + ' ' + 'bcdefghijk'[i]`. That
 * alphabet has ELEVEN letters and Sol has THIRTEEN planets, so the last three rows literally read
 * `Sol undefined` — measured live off `S.bodyHits`, and reproduced headlessly.
 *
 * ⚠ AND THE COMMENT WAS THE TRAP, WHICH IS WHY THIS ONE IS LONG. A reader checking the claim rather
 * than the code closed it as fine. The instrument's rng exposes `float`, `int`, `pick`, `bool`,
 * `chance` and `child`; this now exposes exactly those six and nothing else. `next` is GONE — it was
 * this file's own invention, nothing outside these three call sites could ever reach it (the symbol
 * is module-local and unexported), and `grep -rn '\.next()' src/` finds no consumer. Keeping it
 * would have been the same lie in the other direction: a shape that is "the same" plus one.
 *
 * ⚠ `generateSystemName` ignores its rng entirely (`NameGenerator.js:571` comment, and it derives
 * from position), which is why `nameFor` never showed the fault and only the BODY names were wrong.
 */
export function makeRng(seed) {
  const fn = alea(seed);
  return {
    float: () => fn(),
    int: (minOrMax, max) => {
      if (max === undefined) return Math.floor(fn() * minOrMax); // int(max) → [0, max)
      return minOrMax + Math.floor(fn() * (max - minOrMax + 1)); // int(min, max) → [min, max] inclusive
    },
    pick: (arr) => arr[Math.floor(fn() * arr.length)],
    bool: (p) => fn() < (p || 0.5), chance: (p) => fn() < p,
    child: (tag) => makeRng(String(seed) + ':' + tag),
  };
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
                                               || ((a.dist ?? 0) - (b.dist ?? 0)) },
    // ⭐ THE TWO KEYS DESIGN 2'S LIST HEADERS NAME AND NOTHING ELSE DID (INTERFACE §8a). They go
    // AFTER the existing four so `SORT_KEYS[3][0]` is still DIST — today's order, and the picture
    // Max ruled on — and so `[`/`]` keeps landing on the same key it always has on the first press.
    // ⛔ `plane` SORTS BY `wy`, NOT BY THE COLUMN'S PRINTED VALUE. The header reads
    //    `(wy - player.y) * 1000` PC; the player offset is a constant across every row, so sorting by
    //    the raw `wy` is monotonic in the printed number and needs no access to `D.player` from
    //    inside a comparator that has none.
    // ⚠ `catalog` IS A TWO-LEVEL KEY because `isReal` is a boolean: real catalogue stars first, then
    //   distance inside each group. Without the tiebreak the sort is only as ordered as the input
    //   happened to be, and `Array.prototype.sort` stability would be doing the work silently.
    { id: 'plane', label: 'PLANE', cmp: (a, b) => (a.wy ?? 0) - (b.wy ?? 0) },
    { id: 'catalog', label: 'CATALOG', cmp: (a, b) => ((b.isReal ? 1 : 0) - (a.isReal ? 1 : 0))
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
    /** ⭐ EVERY PLACED LABEL AT ITS FINAL DRAWN RECT, published by `plated()` itself so a caller
     *  cannot re-measure the string and disagree with the plate. `[]` here rather than `null`
     *  because the designs assign it at the head of their own paint, so it is only ever undefined
     *  in the window between `makeViewState()` and the first paint — and a picker that runs in that
     *  window would throw, which freezes the glass rather than missing a click. */
    labelHits: [],      // [{x,y,w,h,ref,kind}]         — levels 3-4, tested BEFORE the mark lists
    /** ⭐ AC-2 — DESIGN 2'S ORBIT ELLIPSES, AT THE RADII THEY WERE DRAWN AT. `[{cx,cy,rx,ry,ref}]`,
     *  level 4, design 2 only. `null` — not `[]` — is the honest value everywhere else: design 1's
     *  SYSTEM is a ladder with no curves, so it publishes NO rings rather than an empty set of them,
     *  and both designs clear this at the head of their own paint so a ring cannot outlive the frame
     *  that drew it. Tested LAST of the level-4 candidates: a ring is the weakest claim on the glass
     *  and must never beat a body mark or a label sitting on top of it. */
    orbitRings: null,   // [{cx,cy,rx,ry,ref}]          — level 4, design 2
    /** ⭐ AC-9 — DESIGN 1'S PRISM Y-GAUGE, WITH THE MAPPING IT DREW ITSELF WITH.
     *  `{x,y,w,h,cy,span,halfKpc,base}`, level 3, design 1 only. `cy`/`span`/`halfKpc`/`base` are
     *  not decoration: they are what lets the drag INVERT the paint's own arithmetic instead of
     *  restating it, which is the AC-4 defect shape. `null` everywhere else. */
    yGaugeRect: null,   // {x,y,w,h,cy,span,halfKpc,base} — level 3, design 1
    /** ⭐ AC-2 — DESIGN 1'S PAGER ROW, THE `- = PAGE` LINE THAT HAS NEVER ANSWERED A CLICK.
     *  `mid` is published rather than left to the picker: `x0 + (x1 - x0) / 2` computed in the
     *  hit-test would be a second copy of the rail's own geometry, free to drift the moment the rail
     *  changes width. `null` in design 2 and while the drawn search is open — `d1Rail` returns into
     *  `d1Search` before the line that publishes it, so the pager is not on the glass and not on
     *  offer. */
    pagerRect: null,    // {x0,mid,x1,y,h}              — design 1, every level with a rail
    /** ⭐ AC-9 — DESIGN 1'S SYSTEM LADDER COUNTER, `N-M OF K`. Published ONLY when the ladder
     *  overflows (`maxScroll > 0`), because that is the only time the readout is drawn: a rectangle
     *  for a scrubber over a range with one stop in it would be grabbable and inert. `counterGrab`
     *  therefore treats a missing field as "no" and `counterDragTo` returns `null`. */
    ladderCounterRect: null,  // {x,y,w,h}              — level 4, design 1
    /** ⭐ AC-2 — DESIGN 2'S LIST-MODE COLUMN HEADERS, one entry per header the draw's own
     *  `cols[i] < W - 8` guard actually painted. `sortId` is the key `sortTo` looks up; the `N`
     *  header carries `null` because sorting by the row ordinal is the identity — its click is still
     *  EATEN (it is drawn, so it must answer) and does nothing. `null`, not `[]`, in map mode: "this
     *  picture publishes no headers" is a different claim from "it published none of them". */
    listHeaderRects: null,    // [{x,y,w,h,sortId}]     — level 3, design 2, list mode
    /** ⭐ AC-2 — DESIGN 2'S TOPBAR `HERE · SECTOR`. Drawn at every level, so published at every
     *  level; the click re-centres the frame on the player (INTERFACE §8b) at levels 0-3 and is
     *  deliberately NOT eaten at SYSTEM, where "centre on the player" has no agreed meaning. */
    locatorRect: null,        // {x,y,w,h}              — design 2, every level
    /** ⭐ AC-2 — DESIGN 2'S 24x24 PRISM CORNER WIDGET. It has no downstream identity and inventing
     *  one would be the picker deciding what the minimap means; what the rectangle buys is the PLATE
     *  RULE (INTERFACE §6) — without it a press on the widget falls through to whatever star mark
     *  lies under it and selects a star the pilot cannot see. Map mode only. */
    minimapRect: null,        // {x,y,w,h}              — level 3, design 2, map mode
    /** ⭐ AC-2 — DESIGN 2'S `» STAR B nnAU` STRIP. Same reasoning as the minimap: nothing in the
     *  pipeline resolves a companion to a system, so the click is eaten and does nothing — but the
     *  strip is drawn straight across the outer orbit rings, and without the rectangle a press on
     *  the text selects whichever ring passes beneath it. */
    companionRect: null,      // {x,y,w,h}              — level 4, design 2, wide binaries only
    /** ⭐⭐ AC-6's INBOUND HALF (INTERFACE §8d), AND IT IS THE ONE FIELD HERE NO DESIGN EVER READS.
     *  The designs read `S.level`, `S.view` and `S.cam` as they always have; this is what makes
     *  `S.level` LAG `nav._levelIndex` for 350 ms so the 2D map keeps drawing while its frame closes.
     *  ⛔ NOT IN `resetPicks`. Everything the PAINT publishes is one frame's worth by construction;
     *     these two are the driver's own and have to outlive the frames between the press and the
     *     arrival — which is the entire feature. */
    levelLag: null,     // {from,to,kind,t0,dur,fromView,toView,fromRadius,toRadius,fromCam,toCam,hold}
    /** ⭐ AND THE ARM IS SEPARATE FROM THE LAG, BECAUSE ONLY THE DRIVER'S OWN TAB PATHS MAY START
     *  ONE. `tabLevel` and `remapClick`'s tab branch write `{ from, tMs }` immediately before handing
     *  the click to `_handleClick`; a test that assigns `_levelIndex` directly, and the drill clicks
     *  (which carry their own `_anim`/`_systemZoomAnim`), never arm it and therefore never lag. */
    levelArm: null,     // { from, tMs } | null
    railTiles: [],      // [{i,j,id,x,z,n}]             — design 1's rail rows at levels 1-2
    listGeom: null,     // {x,y,rows,lead,offset,total} — design 2's list
    tabRects: null,     // [{x,y,w,h}] x5               — the DESIGN's tab strip, not the legacy one
    chipRect: null,     // {x,y,w,h}                    — the drawn commit control

    /** THE DRIVER PUBLISHES THESE. `cam` is the prism camera the game already runs and `view` is the
     *  2D frame it already drills; both are byte-identical to today's values at entry (see header).
     *
     *  ⛔⛔ TWO ROTATION PAIRS, NOT ONE, AND FOLDING THEM WOULD MAKE A PRISM DRAG TURN THE ORRERY.
     *  The game keeps `_localRot*` (level 3) and `_systemRot*` (level 4) distinct and CLAMPS THEM
     *  DIFFERENTLY — `[0, π/2]` at `:4354` against `[0.1, π/2]` at `:4360` — and `_handleMouseDown`
     *  snapshots whichever pair the level owns (`:4402-4408`). One shared pair would be two
     *  different gestures writing one field.
     *  ⛔ AND BOTH NEED A DEFAULT HERE EVEN THOUGH `refresh()` writes them every frame. A painter
     *  reading `S.sysCam.rotX` off an undefined `S.sysCam` throws; `PanelHost` catches a painter
     *  throw ONCE and then stops uploading, so the glass keeps showing the last good frame and
     *  looks alive — indistinguishable from a working nav until Max clicks something.
     *  ⭐ The defaults are the DESIGNS' OWN fixed tilts (see PRISM_ROT_X0 / SYSTEM_ROT_X0 above), so
     *  a frame drawn before the first `refresh()` — the lab's case, and the first paint's — is the
     *  picture Max ruled on rather than a top-down one. */
    cam:  { x: 0, y: 0, z: 0, radius: 0.0015, rotX: PRISM_ROT_X0, rotY: 0 },
    sysCam: { rotX: SYSTEM_ROT_X0, rotY: 0 },
    view: { cx: 8, cz: 0, size: 44 },

    /** ⭐ THE CLICK-HIGHLIGHT (INTERFACE §5). Max: *"clicking on a cell from the grid should
     *  highlight it, then zoom into it"* — so it is written on a committed map click BEFORE the
     *  drill starts and cleared when the drill lands, which makes it visible for the whole zoom
     *  rather than for the tick it was written in.
     *  ⛔ `i`/`j` ARE THE DESIGN'S OWN GRID COORDINATES, NOT the game's `col`/`row`: `row = n-1-j`
     *  is the Z-flip and it lives in `picking.tileOf`, on the other side of this field.
     *  ⛔ `null` IS THE DEFAULT AND IT HAS TO BE DECLARED — see the note above; the lab reads it
     *  unguarded at its draw site. */
    pick: null,       // { level, i, j, tMs } | null
    /** ⭐ MAX, 2026-09-07: *"disable the system screen when not in a system."* True when the ship is
     *  in no spawned system at all — `nav._currentSystemData` is null, which is the ORRERY splash boot
     *  and nothing else (every arrival sets it via `_applyNavArrival`). The designs dim the SYSTEM tab
     *  on it; the driver refuses the level on it. `false` by default so a design never reads undefined. */
    noSystem: false,

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
    // ── ⛔⛔ THE CATCHES BELOW NOW COUNT, BECAUSE A SILENT ONE IS WHAT HID AC-10 FOR A WHOLE
    //    WORKSTREAM. Both `catch`es fired on EVERY body of EVERY system for as long as this file has
    //    existed — `rng.float is not a function`, 39 of 39 on Sol — and produced a plausible-looking
    //    name each time, so nothing anywhere reported anything. A fallback that cannot be
    //    distinguished from a success is not a fallback, it is a disguise.
    //    ⭐ SO THE COUNT AND THE FIRST ERROR GO SOMEWHERE OBSERVABLE: `D.fail`, which is the
    //    channel the designs' own two catches already use (`designs.js:247`, `:255`), plus one
    //    `console.error`. It is loud ONCE PER SYSTEM, not once per body — `buildBodies` is called
    //    only when `cache.sysRef` moves — so a real fault is a line Max or a test can see and a
    //    working build is silent.
    //    ⚠ THE ERROR'S NAME RIDES THE MESSAGE ON PURPOSE. `TypeError` means THIS FILE is wrong;
    //    anything else may legitimately mean "that generator had no name for this body". The two
    //    were indistinguishable before, and the wrong one was assumed.
    const nameFail = { n: 0, first: '' };
    const noteFail = (what, e) => {
      nameFail.n++;
      if (!nameFail.first) nameFail.first = `${what} threw ${(e && e.name) || 'Error'}: ${(e && e.message) || e}`;
    };
    planets.forEach((p, i) => {
      const pd = p.planetData;
      if (!pd) return;
      let pname = '';
      try { pname = generatePlanetName(rng.child('p' + i), star.name || 'STAR', i, planets.length); }
      catch (e) { noteFail('generatePlanetName', e); pname = (star.name || 'S') + ' ' + 'bcdefghijk'[i]; }
      // ⛔ NEITHER FIELD MAY BE UNDEFINED. Both designs call `.toUpperCase()` on `name` and `cls`
      // unguarded — `d1Rail`'s detail block does it twice on one line — and `displayClassOf` returns
      // undefined for planet data it does not recognise, which is reachable from any generator
      // change upstream. A throw here is not a blank field: `PanelHost` catches a painter throw ONCE
      // and then stops uploading, so the glass freezes on the last good frame and looks alive.
      rows.push({ kind: 'planet', name: pname || '—', au: Number(p.orbitRadiusAU) || 0, cls: displayClassOf(pd) || 'unknown',
                  rE: pd.radiusEarth, T: pd.T_eq, hab: pd.habitability?.score ?? null,
                  rings: !!pd.rings, moons: p.moons?.length || 0, pd,
                  // ⭐⭐ `ang` IS THE ORBITAL ANGLE, AND DROPPING IT WAS A LIVE DEFECT (INTERFACE §2).
                  // `d2System:1160` placed each body at `i * 1.7 + 0.6` — `i` being the DRAW-LOOP
                  // INDEX — and `[`/`]` re-sorts `D.bodies` right above this function, so pressing
                  // the sort key at SYSTEM teleported every planet around its ring. The real angle
                  // was never missing: `StarSystemGenerator:550` draws it and sets it on the wrapper
                  // at `:609`, `SolarSystemData:723/846` does the deterministic equivalent for Sol,
                  // and the LEGACY orrery has always read it (`NavComputer:2756`, `:3215`,
                  // `const angle = p.orbitAngle || 0`). This row simply never copied it across.
                  // ⚠ `|| 0` RATHER THAN `?? 0` IS DELIBERATE AND LOSSLESS HERE: an angle of exactly
                  // 0 and an absent angle are the same ray, and `Number(undefined)` is NaN, which
                  // would put `cos`/`sin` of NaN into the draw code.
                  // ⭐⭐ AND IT READS THE LIVE ORBIT FIRST, BECAUSE `p.orbitAngle` IS FROZEN AT
                  // GENERATION. `main.js:7875` COPIES the angle as a number into the scene entry, and
                  // from then on the sim advances only the copy (`:11358`,
                  // `entry.orbitAngle += entry.orbitSpeed * celestialDt`). The nav is handed
                  // `system._systemData`, the raw generation data (`:7950`), so reading `p.orbitAngle`
                  // alone draws every planet WHERE IT STARTED and never moves it. `_live` is the scene
                  // entry, folded onto `main.js:7878`. Max, 2026-09-07: *"I want the nav screen to
                  // reflect the actual orientation of the planets in the game."*
                  // ⚠ `??` NOT `||` ON THE LIVE READ: an orbit genuinely passes through exactly 0, and
                  // `||` would fall back to the frozen angle every time a planet crossed it — a mark
                  // that jumps once per revolution. The outer `|| 0` still catches NaN/undefined.
                  ang: Number(p._live?.orbitAngle ?? p.orbitAngle) || 0,
                  // ⭐ pIdx / mIdx are THIS ADAPTER'S ADDITION, not the lab's, and they are what lets a
                  // rail row hand `_hoveredBody` the { type, index } shape the SHIPPED click handler
                  // already understands. Without them the flat list's position would have to be
                  // re-derived at the hit-test — a second mapping to keep in step with this one.
                  pIdx: i });
      (p.moons || []).forEach((m, j) => {
        let mname = '';
        try { mname = generateMoonName(rng.child(`m${i}.${j}`), pname, j, p.moons.length); }
        catch (e) { noteFail('generateMoonName', e); mname = pname + ' ' + (j + 1); }
        rows.push({ kind: 'moon', name: mname || '—', au: Number(p.orbitRadiusAU) || 0, cls: m.type || 'moon',
                    rE: m.radiusEarth, T: m.T_eq, hab: null, rings: false, moons: 0, parent: i,
                    // ⛔ A MOON TAKES ITS PARENT'S ANGLE, NOT ITS OWN, AND THE REASON IS THAT THE
                    // TWO ARE IN DIFFERENT FRAMES. A moon does have an angle — `startAngle`, from
                    // `MoonGenerator:181/415` and `SolarSystemData:802/829` — but it is the phase of
                    // the moon around its PLANET, while `ang` here is the phase of a body around the
                    // SYSTEM'S STAR, which is the only thing `d2System` can place: it puts a body at
                    // `(rOf(b.au), b.ang)` and this row's `au` is ALREADY the parent's
                    // `orbitRadiusAU` (line above). Using `startAngle` would scatter every moon
                    // around the star's ring at a radius it never occupies, at a scale roughly four
                    // orders of magnitude too large. Parent's angle + parent's AU puts the moon
                    // exactly where the moon is: on its planet.
                    // ⚠ AND THE ORRERY'S MOON PIPS ARE SCREEN-SPACE BADGES BY DESIGN (INTERFACE §1),
                    // so the moon's own phase has no draw site to go to even if it were wanted.
                    ang: Number(p._live?.orbitAngle ?? p.orbitAngle) || 0,   // the parent's LIVE angle — see the planet row above
                    pIdx: i, mIdx: j });
      });
    });
    (sys.asteroidBelts || []).forEach((b, i) => {
      // ⚠ NO `ang` ON A BELT, AND THAT IS CORRECT RATHER THAN AN OMISSION (INTERFACE §2): a belt is
      // drawn as a FULL RING, so it has no phase to be at. A `0` here would be a real angle that
      // happens to mean "nothing", which is the shape of the defect this whole field fixes.
      rows.push({ kind: 'belt', name: 'BELT ' + ('ABC'[i] || (i + 1)), au: Number(b.centerRadiusAU) || 0, cls: 'belt',
                  rE: null, T: null, hab: null, rings: false, moons: 0, widthAU: b.widthAU });
    });
    if (nameFail.n) {
      const line = `navViewModes/state.js buildBodies: ${nameFail.n}/${rows.length} body names fell back — ${nameFail.first}`;
      D.fail.push(line);
      // eslint-disable-next-line no-console
      console.error(line);
    }
    return rows;
  }

  /**
   * ⭐⭐ AC-6's INBOUND HALF, AND THE WHOLE OF IT IS A LAG IN ONE FIELD (INTERFACE §8d).
   *
   * ⛔ MEASURED FIRST, WHICH IS WHY THE SCOPE IS THIS NARROW. The drill click REGION→PRISM already
   * animates (`_startDrillAnim` to level 3 moves `_viewCenter`/`_viewSize`, which `S.view` reads) and
   * the star click PRISM→SYSTEM already animates (`_systemZoomAnim` moves `_localRadius`, which
   * `S.cam` reads). What still SNAPS is the TAB STRIP and the Tab KEY: `NavComputer.js:4477` sets
   * `_levelIndex` synchronously — deliberately, four suites read it on the next statement — and
   * `:4476`'s `_viewEase` covers only the way OUT.
   *
   * ⭐ SO THE ANIMATION IS NOT ADDED TO THE INSTRUMENT, IT IS ADDED TO WHAT THE DESIGN IS TOLD. The
   * level the DESIGNS branch on is `S.level`; holding it at the level being left, while `S.view` /
   * `S.cam` walk toward the level being entered, makes the 2D map close on the tile it is drilling
   * and the prism zoom into the star it is entering, out of the picture that is already on the glass.
   * ⛔ Animating the legacy painter instead would move pixels nobody can see — each design's first
   * act is an opaque full-canvas fill.
   *
   * ⛔ ONLY THE DRIVER'S OWN TAB PATHS MAY START ONE (`S.levelArm`). A test that assigns
   * `_levelIndex` directly gets no lag, and neither does a drill click — those carry `_anim` /
   * `_systemZoomAnim`, which move the very fields this would be interpolating, and two writers on one
   * field is a fight rather than an animation (`:1419` yields to `_anim` for exactly that reason).
   *
   * @returns {number} the level the DESIGNS should draw this frame — the held one while a lag runs.
   */
  function stepLevelLag(nav, navLevel) {
    const now = simClockMs();
    // ── A LEVEL CHANGE FROM ANYWHERE ELSE CANCELS IT, and so does either of the host's own
    //    animations arriving mid-lag: both write the fields below, and a real transition always wins.
    if (S.levelLag && (navLevel !== S.levelLag.to || nav._anim || nav._systemZoomAnim)) S.levelLag = null;
    if (!S.levelLag) {
      const arm = S.levelArm;
      // ⚠ THE ARM IS MATCHED, NOT MERELY PRESENT. `from === S.level` is what keeps a stale arm — one
      //   whose click was eaten, or one left by a tab that changed nothing — from lagging a level
      //   change it had nothing to do with; the one-second window is the backstop for a driver that
      //   never renders in between.
      const armed = !!arm && arm.from === S.level && Number.isFinite(arm.tMs)
        && now - arm.tMs >= 0 && now - arm.tMs <= 1000;
      if (navLevel !== S.level) {
        if (armed && !nav._anim && !nav._systemZoomAnim) startLevelLag(nav, S.level, navLevel, now);
        S.levelArm = null;   // consumed either way: an arm outlives exactly one level change
      } else if (arm && now - arm.tMs > 1000) {
        S.levelArm = null;
      }
    }
    const lag = S.levelLag;
    if (!lag) return navLevel;
    const t = lag.dur > 0 ? (now - lag.t0) / lag.dur : 1;
    if (!(t < 1)) { S.levelLag = null; return navLevel; }
    return lag.hold;
  }

  /** Arm the lag for one ordered pair, or leave it null for a pair §8d gives no ease. */
  function startLevelLag(nav, from, to, now) {
    const base = { from, to, t0: now, dur: LEVEL_LAG_MS,
                   fromView: null, toView: null, fromRadius: null, toRadius: null,
                   fromCam: null, toCam: null };
    if (from <= 2 && (to === 3 || to === 4)) {
      // ⭐ THE MIRROR OF THE OUTBOUND EASE, TERM FOR TERM. `:4476` opens the 2D frame FROM
      // `_viewSize / (gridNForLevel(idx) * 2)`; this closes it TO the same window, on the centre the
      // level being entered is actually about — `_localCenter` for the prism, the player for SYSTEM.
      const fc = nav._viewCenter || { x: 0, z: 0 };
      const fromSize = Number.isFinite(nav._viewSize) ? nav._viewSize : 44;
      const lc = nav._localCenter || {};
      const tc = (to === 3 && Number.isFinite(lc.x) && Number.isFinite(lc.z))
        ? { cx: lc.x, cz: lc.z } : { cx: nav._playerX, cz: nav._playerZ };
      const toSize = fromSize / (LAG_GRID_N(from) * 2);
      if (!Number.isFinite(fc.x) || !Number.isFinite(fc.z) || !Number.isFinite(tc.cx)
          || !Number.isFinite(tc.cz) || !(toSize > 0)) return null;
      S.levelLag = { ...base, kind: 'map', hold: from,
                     fromView: { cx: fc.x, cz: fc.z, size: fromSize },
                     toView: { cx: tc.cx, cz: tc.cz, size: toSize } };
      return S.levelLag;
    }
    if ((from === 3 && to === 4) || (from === 4 && to === 3)) {
      // ⭐ THE MIRROR OF `_systemZoomAnim` (`:4621`), which is `fromRadius → fromRadius * 0.1` over
      // 400 ms on the star-click path. Going IN the radius shrinks; coming back OUT it grows from the
      // same tenth, so the pilot arrives at the prism by zooming out of the system rather than by a cut.
      const r = Number.isFinite(nav._localRadius) ? nav._localRadius : S.cam.radius;
      if (!(r > 0)) return null;
      const star = nav._systemStar;
      const toCam = (from === 3 && star && Number.isFinite(star.wx))
        ? { x: star.wx, y: star.wy, z: star.wz }
        : (from === 3 ? { x: nav._playerX, y: nav._playerY, z: nav._playerZ } : null);
      S.levelLag = { ...base, kind: 'prism', hold: 3,
                     fromRadius: from === 3 ? r : r * 0.1,
                     toRadius: from === 3 ? r * 0.1 : r,
                     fromCam: toCam ? { x: S.cam.x, y: S.cam.y, z: S.cam.z } : null,
                     toCam };
      return S.levelLag;
    }
    // ⚠ EVERY OTHER PAIR HAS AN ANIMATION ALREADY, OR IS NOT A TAB WORTH EASING: 0-2 ↔ 0-2 is the
    //   host's own `_startDrillAnim`, and 3/4 → 0-2 is `:4476`'s outbound `_viewEase`.
    return null;
  }

  /** Walk the running lag's eased values into the two fields the designs read. Runs AFTER the live
   *  refresh below, so what it writes is the frame the design sees rather than something the
   *  instrument overwrites one statement later. */
  function applyLevelLag() {
    const lag = S.levelLag;
    if (!lag) return;
    const e = smootherstep(Math.max(0, Math.min(1, (simClockMs() - lag.t0) / lag.dur)));
    const mix = (a, b) => a + (b - a) * e;
    if (lag.kind === 'map') {
      S.view.cx = mix(lag.fromView.cx, lag.toView.cx);
      S.view.cz = mix(lag.fromView.cz, lag.toView.cz);
      S.view.size = mix(lag.fromView.size, lag.toView.size);
      return;
    }
    S.cam.radius = mix(lag.fromRadius, lag.toRadius);
    if (lag.fromCam && lag.toCam) {
      S.cam.x = mix(lag.fromCam.x, lag.toCam.x);
      S.cam.y = mix(lag.fromCam.y, lag.toCam.y);
      S.cam.z = mix(lag.fromCam.z, lag.toCam.z);
    }
  }

  /**
   * Pull one frame of live state off the instrument. Cheap: three cache checks and some field reads.
   * @param {object} nav the NavComputer
   * @param {{width:number,height:number,lines:number}} buf the buffer being drawn into
   */
  function refresh(nav, buf) {
    // ⛔ THE LEVEL IS NO LONGER READ STRAIGHT OFF THE INSTRUMENT, AND THAT IS AC-6's INBOUND HALF.
    //    `stepLevelLag` answers with `nav._levelIndex` on every frame but the 350 ms of a tab into
    //    PRISM or SYSTEM, where it answers with the level being LEFT — see its own note.
    S.level = stepLevelLag(nav, nav._levelIndex | 0);
    S.noSystem = !nav._currentSystemData;
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
    // ── ⭐⭐ AND THE ROTATION, WHICH IS THE ONE HOP THAT WAS MISSING. Measured with a liveness
    //    control on the running game: nudging `_localCenter.z` by 0.0004 moved every published mark,
    //    and `_localRotY += 1.1` with `_localRotX = 0.15` left `S.prismHits` BYTE-IDENTICAL — the
    //    pilot has been rotating a camera the designs could not see. `S.cam` was already the pipe;
    //    these four lines are the whole of it.
    //    ⛔ TWO PAIRS, INDEPENDENTLY SOURCED. `_localRot*` is the prism's and `_systemRot*` is the
    //    orrery's; they are clamped differently and dragged at different levels (see the `S` literal).
    //    ⛔ THE AZIMUTHS ARE WRAPPED, THE ELEVATIONS ARE NOT. `wrapTau` explains why the raw fields
    //    are left alone; the elevations arrive already clamped into `[0, π/2]` by the drag handler
    //    and `_tiltAnim`'s π/2 start is inside it, so there is nothing to fold.
    S.cam.rotX = Number.isFinite(nav._localRotX) ? nav._localRotX : PRISM_ROT_X0;
    S.cam.rotY = wrapTau(nav._localRotY);
    S.sysCam.rotX = Number.isFinite(nav._systemRotX) ? nav._systemRotX : SYSTEM_ROT_X0;
    S.sysCam.rotY = wrapTau(nav._systemRotY);
    const vc = nav._viewCenter || { x: 8, z: 0 };
    S.view.cx = vc.x; S.view.cz = vc.z;
    S.view.size = Number.isFinite(nav._viewSize) ? nav._viewSize : 44;
    // ⭐ AND THE INBOUND EASE OVERRIDES THEM, LAST, FOR THE 350 ms IT RUNS (INTERFACE §8d). It has to
    // be AFTER the six lines above: they are the live read, and a lag applied before them would be
    // overwritten by the instrument in the same function. ⛔ It writes ONLY `S.view` (map lag) or
    // `S.cam` (prism lag), never the instrument's own fields — the game's camera stays the single
    // source of truth and the ease is a property of what the DESIGN is told this frame.
    applyLevelLag();

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
    // ⭐⭐ THE ANGLES REFRESH EVERY FRAME, AND WITHOUT THIS THE LIVE READ ABOVE IS DEAD LETTER.
    // `buildBodies` runs ONCE PER SYSTEM (the gate right above), because generating ~39 names is not
    // cheap — so an `ang` captured in it is frozen for as long as the system is on screen, and the
    // orrery would draw a still frame no matter how correct the value was at the moment it was taken.
    // That is the same shape as the defect this workstream opened with: a value that is right once and
    // then silently stops tracking. Names stay cached; only the angle is re-read.
    // ⛔ `cache.bodiesBase` rows are the SAME OBJECTS `D.bodies` holds — `D.bodies` is a `slice()`, a
    // shallow copy of the array and not of the rows — so writing here is what the paint reads. Do not
    // "fix" that by deep-copying; the sharing is load-bearing.
    // ⚠ A BELT CORRECTLY HAS NO `pIdx` AND IS SKIPPED: a belt is a full ring, not a body at a phase.
    if (cache.bodiesBase && D.sys?.planets) {
      const ps = D.sys.planets;
      for (const r of cache.bodiesBase) {
        if (r.pIdx == null) continue;
        const p = ps[r.pIdx];
        if (p) r.ang = Number(p._live?.orbitAngle ?? p.orbitAngle) || 0;
      }
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
