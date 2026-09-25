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
/** ⛔ THE DRIVER'S ONE COPY OF `NavComputer.gridNForLevel` (:71), IMPORTED RATHER THAN RESTATED.
 *  This file used to spell its own `LAG_GRID_N`, which made three copies of two constants across the
 *  build — the AC-4 defect shape, counted by the adversarial pass. `picking.js` already owns the
 *  driver's copy for the rail's z-flip, so the lag's `toView.size` reads that one. */
import { gridNFallback } from './picking.js';
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
    /* Function · design 2's SYSTEM zoom gauge, the rect the paint drew the track at.
     * Intent · AC-6 (SEAM §2): the wheel already moved `nav._systemZoom` and nothing drew it, so
     *   there was no handle to grab either. `d2System` publishes `{x,y,w,h}` — the VERTICAL track in
     *   texels — at its draw site, and `zoomGrab`/`zoomDragTo` (index.js) invert the mapping the
     *   paint used rather than restating it, exactly as the y-gauge above does.
     * Deliberate non-goals · no `cy`/`span`, because unlike the y-gauge the range is FIXED (the
     *   host's own [0.3, 5.0] clamp at `NavComputer.js:4708`) and logarithmic, so the rect is all the
     *   drag needs; design 1 publishes none (Max's ruling: no wheel zoom on the ladder) and neither
     *   design publishes one at levels 0-3.
     * ⛔ `null` IS THE DEFAULT AND IT HAS TO BE DECLARED, for the reason every rect above gives:
     *   `zoomGrab` runs on a mousedown that can land before the first frame of a design has painted,
     *   and an undefined field there reads as "no gauge" only by luck of `!r` — the declared `null`
     *   is what makes it a stated answer. Cleared by `resetPicks()` like the other paint rects. */
    zoomGaugeRect: null,  // {x,y,w,h}              — level 4, design 2
    /* Function · the hover callout's plate, where the paint put it.
     * Intent · AC-1 (wave 1b): `hoverCallout` (designs.js:1998) publishes the plate it drew so the
     *   glass can be asked where the callout is — the plate rule (INTERFACE §6), stated at the draw
     *   site like every other rect here.
     * Deliberate non-goals · nothing reads it yet and nothing eats a press inside it: the callout is
     *   never under the pointer that summoned it, so no press can land on it (SEAM §2).
     * ⛔ NOT IN `resetPicks()`, AND THAT IS NOT AN OVERSIGHT. The PAINT clears it itself at the head
     *   of both `drawDesign1` and `drawDesign2` (designs.js:796 / :2149) and again at the head of
     *   `hoverCallout` (:1999), so the driver clearing it a fourth time would be a courtesy copy of a
     *   guarantee the generated file already makes for itself. What this line buys is the window the
     *   other rects' defaults buy: the frames between `makeViewState()` and the first paint. */
    hoverCalloutRect: null,   // {x,y,w,h}          — levels 0-4, both designs, published by the paint
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
    /* ⛔ THERE IS NO `minimapRect` HERE ANY MORE (INTERFACE §8f). Design 2's 24x24 prism corner
     *  widget published one for half a day and the driver ate every press inside it, on the plate
     *  rule (INTERFACE §6). The premise was measured false: the rule holds for `plated()` labels
     *  because `plated()` knocks out a BG rect first, and this widget is four brackets, a dot, a
     *  scale column and a 5-texel mark over a starfield drawn BEFORE it and showing through. The
     *  band turned a star the pilot could see into an unclickable one. The lab publishes nothing,
     *  the driver eats nothing, and the field is gone rather than left as a `null` nobody writes. */
    /** ⭐ AC-2 — DESIGN 2'S `» STAR B nnAU` STRIP. Nothing in the pipeline resolves a companion to a
     *  system, so the click is eaten and does nothing — the strip is drawn straight across the outer
     *  orbit rings, and the rectangle is the plate rule stated where a taller orrery would need it.
     *  ⚠ Measured: no ring reaches the strip's row at any tilt today, so the eat guards nothing the
     *    paint can currently produce. The tested half is its EDGE — one texel below, nothing eaten. */
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
    /* Function · AC-4 — the D.bodies rows design 1's rail ACTUALLY DREW, when what it drew is not a
     *   slice of `D.bodies`: in the moon sub-view it lists the open planet and then that planet's
     *   own moons, in the ladder's orbit order.
     * Intent · `pickFromRow` (index.js:496) indexes `D.bodies` at level 4 by `rowBase() + row`, so
     *   without this every drawn row in the sub-view resolves to a DIFFERENT body — the same split
     *   `railTiles` exists for at levels 1-2: the paint publishes what it drew, already sliced to
     *   the drawn page and index-aligned with the drawn rows, and the picker reads the paint.
     * Deliberate non-goals · not a second list model and not a general override — `null` is the
     *   normal state and means "the rail IS a `D.bodies` page", which is every other screen. Both
     *   designs clear it to `null` at the head of their paint (designs.js:817/2675), so a stale page
     *   cannot outlive the frame that drew it. NOT cleared by `resetPicks`, for the reason
     *   `listGeom` is not: it is geometry, republished by the next paint. */
    railBodies: null,   // [D.bodies row] | null        — design 1's SUB-VIEW rail rows, as drawn
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
    /* Function · the orrery camera, now including the wheel's own magnification.
     * Intent · AC-6 (SEAM §2): `_handleWheel` (NavComputer:4701-4710) has always scaled
     *   `nav._systemZoom` by 1.15/0.87 inside [0.3, 5.0] at SYSTEM with no `viewMode` gate, and only
     *   the LEGACY orrery ever read it (:2531) — so under a design the wheel moved a number nothing
     *   drew. `refresh()` mirrors it here so design 2's orrery can scale by it.
     * Deliberate non-goals · no clamping, no easing and no reset here: the host owns all three
     *   (:607 / :4470 / :4618 set it back to 1.0 on open, tab and drill) and a second clamp on this
     *   side would be a copy of the instrument's own range, free to drift. Design 1 ignores it by
     *   Max's ruling (its ladder is a scroll, not a zoom).
     * ⛔ A DEFAULT IS MANDATORY, like every other field here: an `undefined` multiplier does not draw
     *   a small orrery, it draws `NaN` radii — and `PanelHost` catches a painter throw ONCE and then
     *   freezes the glass on the last good frame, which looks alive. */
    sysCam: { rotX: SYSTEM_ROT_X0, rotY: 0, zoom: 1 },
    view: { cx: 8, cz: 0, size: 44 },

    /* Function · WHICH SYSTEM PICTURE IS ON THE GLASS at level 4, and for which planet.
     *   `'system'` is the whole-system ladder / orrery; `'planet'` is the design-side moon sub-view,
     *   and `detailPlanet` is the `pIdx` of the planet whose moons it is drawing (`-1` when none).
     * Intent · AC-4 (SEAM §2), and Max's ruling on page item 16: *"a design-side sub-view, not a
     *   switch back to the old one."* Legacy enters `_systemMode = 'planet'` and hands the screen to
     *   `_renderPlanetDetail`; under a design that pin is deliberately skipped
     *   (`NavComputer.js:4585/4590`, AC-3 of the close pass) and MUST STAY skipped, so the sub-view
     *   needs a home of its own. This is it: two plain fields on `S`, owned end-to-end by the DRIVER,
     *   read by the painters, invisible to the host.
     * Deliberate non-goals · it is NOT a mirror of `nav._systemMode` and never writes it; it carries
     *   no moon index (the SELECTION does, on `nav._selectedBody`); and it is not a stack — the
     *   sub-view is one level deep, exactly as legacy's is.
     * ⛔ NOT CLEARED BY `resetPicks()`, and that is the same line `S.pick` draws. Everything
     *   `resetPicks` clears is published by the PAINT and is one frame's worth by construction; this
     *   is published by a CLICK and has to outlive every frame until the pilot leaves the sub-view —
     *   which is the entire feature. It is reset by the three things that END the picture instead:
     *   a level change, a design change (`refresh()` below) and `onDeactivate()`.
     * ⛔ AND BOTH NEED A DEFAULT HERE, like every other field a painter reads: the sub-view branch
     *   runs inside `d1Ladder` / `d2System`, and `PanelHost` catches a painter throw ONCE and then
     *   stops uploading — the glass freezes on the last good frame and still looks alive. */
    sysView: 'system',   // 'system' | 'planet'   — level 4, both designs
    detailPlanet: -1,    // the sub-view's planet, as a `D.bodies` row's `pIdx`

    /* Function · WHAT THE POINTER IS ON, published once a frame from the pick the driver has just
     *   resolved into the host's own `_hoveredTile` / `_hoveredLocalStar` / `_hoveredBody`.
     * Intent · AC-1 (SEAM §1). The hover was ALREADY resolved under a design — `resolveHover` writes
     *   those three host fields at the tail of `render()` — but no painter could read it: `S` and `D`
     *   carried no hover field and the painters close over `S`/`D` only. This is that one field, so
     *   the NEXT frame's paint can draw the callout legacy drew.
     *   Shape: `null`, or `{ level, kind:'sector'|'tile'|'star'|'body', sx, sy, ref }` —
     *     sector → the sector row (has `.name`);
     *     tile   → `{ col, row, kx, kz }`, `kx`/`kz` the tile CENTRE in kpc;
     *     star   → the `D.stars` row (`name, spectral, dist, distPc, wy, isReal, seed, color`);
     *     body   → `{ type:'planet'|'star'|'moon'|'belt', index, planetIndex?, moonIndex?, row }`.
     * Deliberate non-goals · it is NOT a second pick. It is built from the very object `resolveHover`
     *   just wrote to the host, so the callout and the click can never name different things; and no
     *   painter reads it this wave (the callout is wave 1b).
     * ⛔ NOT IN `resetPicks()`. Everything the PAINT publishes is one frame's worth by construction;
     *   this is published by the DRIVER at the tail of the frame and is read by the NEXT frame's
     *   paint — exactly `S.pick`'s lifetime, and clearing it with the paint's fields would erase it
     *   before anything could draw it. It is cleared instead on a LEVEL CHANGE (below, in `refresh`)
     *   and by `onDeactivate()`. */
    hover: null,      // { level, kind, sx, sy, ref } | null

    /** ⭐ THE CLICK-HIGHLIGHT (INTERFACE §5). Max: *"clicking on a cell from the grid should
     *  highlight it, then zoom into it"* — so it is written on a committed map click BEFORE the
     *  drill starts and cleared when the drill lands, which makes it visible for the whole zoom
     *  rather than for the tick it was written in.
     *  ⛔ `i`/`j` ARE THE DESIGN'S OWN GRID COORDINATES, NOT the game's `col`/`row`: `row = n-1-j`
     *  is the Z-flip and it lives in `picking.tileOf`, on the other side of this field.
     *  ⛔ `null` IS THE DEFAULT AND IT HAS TO BE DECLARED — see the note above; the lab reads it
     *  unguarded at its draw site.
     *  ⚠ TWO SHAPES, NOT ONE, AND THE COMMENT NAMED ONLY THE OLDER OF THEM. At levels 1-2 it is the
     *    grid cell; at level 0 it is the containing SECTOR, because that is what a GALAXY click
     *    drills — the cell there is not the destination (INTERFACE §5 / §8). */
    pick: null,       // { level: 1|2, i, j, tMs } | { level: 0, sector: {centerX,centerZ,size,name}, tMs } | null
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
    isCurrent: false,   // the HOST's own answer to "is the system on the glass the one the ship is in"
    /* Function · WHERE THE SHIP ACTUALLY IS in the system on the glass, or `null` when it is not in
     *   that system at all.
     * Intent · AC-5 (SEAM §2). Legacy places its diamond from `nav._currentFocusIndex` /
     *   `_currentMoonIndex` (NavComputer:280-281, written by the game through the setter at
     *   :1174-1175) and gates the whole drawing on `_isCurrentSystem()` (:2905). Neither index
     *   reached `D`, so design 2 drew its diamond at a FIXED offset and design 1 drew none.
     *   `{ planetIndex, moonIndex }`; `planetIndex < 0` means the ship is at the star (legacy's -2
     *   and -1 both land there, :2909), `moonIndex < 0` means it is on the planet, not a moon.
     * Deliberate non-goals · no screen position: the DESIGN owns the projection and already draws
     *   every body's point, so a position computed here would be a second copy of the paint's own
     *   geometry — the AC-4 defect shape. This publishes the IDENTITY; the paint answers where.
     * ⛔ `null` UNLESS `D.isCurrent`, and that is the host's 0.1 pc identity test, never a seed
     *   comparison (`D.sysStar.seed` is the string 'Sol' in Sol). A stale focus index from the system
     *   the ship really is in would paint SHIP onto a foreign planet. */
    ship: null,         // { planetIndex, moonIndex } | null
    lumCache: new Map(),
  };

  const cache = {
    sectorBase: null, sectorRows: null, sectorSortId: null,
    starsRef: null, starsLen: -1, starRowsBase: null, starSortId: null,
    sysRef: undefined, bodiesBase: null, bodySortId: null,
    level: -1,
    /* ⭐ AC-4 (nav-restorations-2026-09-20) — WHICH DESIGN THE LAST FRAME WAS PAINTED IN, so
     *   `refresh()` can see a `V` that landed on the OTHER design and close the moon sub-view with
     *   it. `-1` is "no frame yet", which matches neither 1 nor 2 and so resets on the first paint. */
    design: -1,
    nameBySeed: new Map(),
    // ⭐ AC-10 (nav-defects-batch-2026-09-18) — see `multFor`. `multGm` remembers WHICH galactic map the
    // filled values were rolled against, because a value rolled with no context is a different answer
    // and caching it silently would be worse than not filling at all.
    multBySeed: new Map(),
    multGm: undefined,
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

  /**
   * ⭐⭐ AC-10 (nav-defects-batch-2026-09-18) — HOW MANY STARS A ROW'S SYSTEM HAS, MEMOISED BY SEED.
   *
   * Three consumers read `s.mult` on ORDINARY rows and all three got `undefined`: `d2Prism`'s
   * multiplicity pips (`designs.js:1582`), the rail's COMPS column (`:1234`) and `SORT_KEYS[3]`'s
   * `mult` comparator (`state.js:249`), which is why "sort by COMPS" re-ordered nothing. The field was
   * filled for `D.selStar` alone (`:798-803`) and for no other row, because `starRowsBase` is built by
   * spreading `_localStars` entries and those carry no multiplicity — the oracle that answers the
   * question has existed the whole time and nothing called it.
   *
   * ⛔ KEYED BY SEED AND NEVER INVALIDATED, WHICH IS WHAT MAKES FILLING EVERY ROW AFFORDABLE.
   * `starRowsBase` is REBUILT EVERY TIME THE BACKGROUND LOADER GROWS `_localStars` — measured
   * headless at 417x240: 31 rebuilds carrying the list from 212 to 9,988 rows in chunks of 153-973 —
   * so a fill that recomputed would pay the whole cost once per rebuild. Against this map a rebuild
   * pays only for the seeds it has never seen.
   *
   * ⭐ MEASURED, BECAUSE THE SEAM ASKED FOR A NUMBER (node, this machine, 2026-09-18): a cold
   * `multiplicityForSeed` costs 0.97-1.60 us per row (four passes over 9,988 real prism rows: 16.0,
   * 12.7, 12.4, 9.7 ms), so filling ALL of the 42,511 rows Sol reaches would be 41-68 ms **if it
   * happened in one frame**. It does not: the worst single rebuild adds ~1,000 new seeds (~1.3 ms of
   * oracle) plus one map lookup per existing row (~50 ns each), so the ~53 ms lands spread across the
   * ~31 frames of the load and no frame carries more than a few. That is why this fills eagerly rather
   * than lazily — the lazy variant the seam allowed for would have had to fill every row anyway the
   * moment COMPS was selected, since a sort reads all of them, and would have paid it in ONE frame.
   *
   * ⚠ NO OVERLAY IS PASSED, exactly as `D.selStar`'s call passes none. It is the difference between
   *   the 'table' chain and the 'archive-roll' / 'procgen' chain for real stars, and the selected row
   *   and the list row must not be able to report different counts for the same star.
   * ⚠ A THROW IS A 1, NOT A GAP. Both designs compare `s.mult > 1` unguarded; `undefined > 1` is false,
   *   so a gap reads as "single" and is indistinguishable from an answer — the disguise `buildBodies`'
   *   name catches were caught wearing. A number is always published.
   */
  function multFor(row, gm) {
    if (cache.multBySeed.has(row.seed)) return cache.multBySeed.get(row.seed);
    let m = 1;
    try {
      m = multiplicityForSeed({ seed: row.seed, pos: { x: row.wx, y: row.wy, z: row.wz },
                                type: row.spectral, name: row.name }, { galacticMap: gm }).count;
    } catch (e) { m = 1; }
    if (!Number.isFinite(m) || m < 1) m = 1;
    cache.multBySeed.set(row.seed, m);
    return m;
  }

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
      // ⭐ AC-8 — `isKuiper` IS THE GENERATOR'S OWN ANSWER AND IT WAS THE ONE FIELD THIS ROW DROPPED.
      // `StarSystemGenerator.js:769` and `SolarSystemData.js:875` set it on the belt, and the LEGACY
      // orrery has always read it (`NavComputer.js:2590/2593/2596/2644`, `belt.isKuiper ? 'KUIPER
      // BELT' : 'ASTEROID BELT'`). Without it the designs' `beltLabel` (designs.js:1901) had to fall
      // back to GEOMETRY — "the belt beyond every planet is the Kuiper belt" — which agrees on Sol
      // and on every system `shouldOuterBeltExist` placed, and is a guess on anything else.
      // ⚠ `!!` RATHER THAN A RAW COPY, AND THE COERCION IS LOAD-BEARING IN ONE DIRECTION ONLY:
      //   upstream the flag is either `true` or ABSENT, never `false`, so `beltLabel` tests
      //   `b.isKuiper != null` to tell "the builder told me" from "the builder is silent". Copying
      //   the raw value would leave an inner belt's flag `undefined` and send it back to the
      //   geometry path; `!!` makes the silence an explicit `false` that the flag branch answers.
      rows.push({ kind: 'belt', name: 'BELT ' + ('ABC'[i] || (i + 1)), au: Number(b.centerRadiusAU) || 0, cls: 'belt',
                  isKuiper: !!b.isKuiper,
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
      // ⚠ THE ARM IS MATCHED, NOT MERELY PRESENT. `from === S.level` is what keeps an arm whose click
      //   was eaten from lagging a level change it had nothing to do with.
      const armed = !!arm && arm.from === S.level && Number.isFinite(arm.tMs);
      if (armed && navLevel !== S.level && !nav._anim && !nav._systemZoomAnim) {
        startLevelLag(nav, S.level, navLevel, now);
      }
      // ⛔⛔ AND THE ARM IS CONSUMED ON THE VERY NEXT `refresh()`, MOVED OR NOT (INTERFACE §8f). It
      //    used to survive for a second, on the theory that a driver might not render between the
      //    press and the arrival — but there is nothing to wait FOR: both writers (`tabLevel` and
      //    `remapClick`'s tab branch) hand the click straight to `_handleClick`, which moves
      //    `_levelIndex` SYNCHRONOUSLY before either returns. So by the first refresh after the arm
      //    the move has already happened or it never will, and a window is only a span in which a
      //    stale token can attach itself to somebody else's level change.
      S.levelArm = null;
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
      const toSize = fromSize / (gridNFallback(from) * 2);
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
      // ⚠ THE `0.1` IS A COPY AND THE COMMENT SAYS SO RATHER THAN PRETENDING IT IS NOT. Its source is
      //   `NavComputer.js:4625`, `toRadius: this._localRadius * 0.1`, written inline inside a literal
      //   in a LINE-FROZEN file — there is nothing to import and no line to spare to export one. So it
      //   is one restated constant, named here, kept beside the sentence that says where it came from;
      //   `gridNFallback` above is the shape this would take if `:4625` ever had a name.
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
    // ⛔ AND `S.hover` DIES WITH THE LEVEL (SEAM §1). It is not one of the paint's fields, so
    //    `resetPicks()` deliberately leaves it alone — which means that without this line a callout
    //    resolved at PRISM would still be on `S` when SECTOR painted, naming a star that is not on
    //    the glass. Cleared HERE, before the paint that reads it, and republished at the tail of the
    //    same frame by `resolveHover` if the pointer is on something at the new level.
    if (cache.level !== S.level) { cache.level = S.level; S.sortIdx = 0; S.listOffset = 0; S.hover = null; }
    /* Function · AC-4 (SEAM §2) — THE MOON SUB-VIEW DIES WITH THE PICTURE IT IS DRAWN IN.
     * Intent · `S.sysView` is a level-4 picture. Carrying it across a level change would reopen
     *   SYSTEM already inside some planet's moons — a screen the pilot never asked for, with a
     *   commit row armed for a body he cannot see — and carrying it across `V` would hand design 2
     *   a sub-view design 1 opened, which is the "settings survive, transients do not" line
     *   `onDeactivate()` already draws. The DESIGN half is a CHANGE test, because `render()` assigns
     *   `S.design` before it calls this and `cache.design` is the only record of what the last frame
     *   actually painted. The LEVEL half is an INVARIANT — "there is no sub-view anywhere but
     *   SYSTEM" — rather than a change test, because it then holds on every frame and not only on
     *   the one the level moved: a `S.sysView` set by anything at all outside level 4 is closed by
     *   the next paint instead of surviving until the level happens to change again.
     * Deliberate non-goals · it does not clear the SELECTION (leaving a system by tab has never
     *   cleared it, and AC-4's own Esc keeps it), and it does not try to see a `V` that lands on
     *   LEGACY: the driver has no entry point while `viewMode === null` (`NavComputer.js:1434`
     *   calls `render()` only under a design and `:613` skips `bufferFor`), so RAIL → CURRENT → RAIL
     *   reopens with the sub-view still up. Closing that needs one statement on the host's own `V`
     *   clause (:349), which is the HOST lane's file, not this one. */
    if (cache.design !== S.design) { cache.design = S.design; S.sysView = 'system'; S.detailPlanet = -1; }
    if (S.level !== 4 && (S.sysView !== 'system' || S.detailPlanet !== -1)) {
      S.sysView = 'system'; S.detailPlanet = -1;
    }
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
    // ⭐ AC-6 — AND THE ORRERY'S MAGNIFICATION, the third number on the same camera. `_handleWheel`
    //    already clamps it into [0.3, 5.0] and resets it to 1.0 on open/tab/drill, so this is a plain
    //    mirror with a default for the frames before the instrument has one. Same shape as the two
    //    rotations above and for the same reason: the game's field stays the single source of truth.
    S.sysCam.zoom = Number.isFinite(nav._systemZoom) ? nav._systemZoom : 1;
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
      // ⭐ AC-10 — `mult` IS FILLED HERE, ON EVERY ROW, THROUGH THE SEED MAP. See `multFor` for the
      //    measurement that says this is affordable and for why it is not lazy. ⛔ AFTER `nameFor`,
      //    because the oracle's highest-precedence chain is `KnownSystems.findByAlias(name, pos)` —
      //    Alpha Centauri reports 3 by NAME and would roll 1 or 2 procedurally without one.
      cache.multGm = D.gm;
      cache.starRowsBase = D.stars.map((s) => {
        const row = { ...s, name: nameFor(s), pc: (s.dist ?? 0) * 1000, ly: (s.dist ?? 0) * KPC_TO_LY };
        row.mult = D.gm ? multFor(row, D.gm) : (row.mult ?? 1);
        return row;
      });
    }
    // ⚠ AND IF THE BASE WAS BUILT BEFORE THE GALACTIC MAP ARRIVED, THE FILL IS REDONE ONCE. Every roll
    //   taken with a null context is a different answer from the one arrival will give, so a base built
    //   without a map holds placeholder 1s; `multGm` is the only thing that can tell them apart, and
    //   without this the COMPS sort would be the identity for as long as that base survived. One pass,
    //   at most once, and it re-ranks by clearing the sort id the way a key change does.
    if (cache.starRowsBase && D.gm && cache.multGm !== D.gm) {
      cache.multGm = D.gm; cache.multBySeed.clear(); cache.starSortId = null;
      for (const row of cache.starRowsBase) row.mult = multFor(row, D.gm);
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
    // ⭐ THE NAME THE "WHERE AM I" LABELS PRINT. `D.here` is a ROW, and star rows exist only once the
    //    PRISM loader has filled `_localStars` — measured 2026-09-25 in Sol: 0 rows at GALAXY, SECTOR,
    //    REGION and SYSTEM, so design 1's status read `UNKNOWN` and design 2's locator `—` while the
    //    game knew exactly where the pilot was. The label falls back to the game's own name; `D.here`
    //    stays a row (or null) for everything that reads its seed.
    D.hereName = D.here?.name || nav._currentSystemName || null;

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
    // ⭐ A TARGET THAT IS THE SYSTEM YOU ARE IN IS NOT A DESTINATION. The host pre-selects the current
    //    system's star when the nav opens, so below SYSTEM both designs lit `WARP TO SOL · 0.0 LY ·
    //    ENTER` from inside Sol (usability review 2026-09-25). The commit row and chip read this to
    //    draw unarmed, and `commit()` refuses the same case.
    D.targetIsHere = !!(D.target && nav._currentSystemName && D.target.name === nav._currentSystemName);
    // ⭐ AC-10 — THE SELECTED STAR GOES THROUGH THE SAME MEMO AS EVERY OTHER ROW NOW. When it IS a row
    //    (`D.starRows.find`) this is already filled and the map answers from cache; when it is the
    //    synthesised copy for a star the loader has not reached, this is the only fill it gets. ⛔ ONE
    //    CALL SITE, so the COMPS column in the detail block and the COMPS column in the list cannot
    //    report different counts for one star — which they could while this had its own `try`.
    if (D.selStar && D.selStar.mult == null && D.gm) D.selStar.mult = multFor(D.selStar, D.gm);

    // ── THE SYSTEM ON SCREEN — whatever was drilled into, INCLUDING an empty one.
    D.sys = nav._systemData || null;
    D.sysStar = nav._systemStar
      ? { ...nav._systemStar, name: nameFor(nav._systemStar) } : null;
    // ⛔ "AM I HOME" IS THE HOST'S QUESTION, NOT A SEED COMPARISON. The designs' `isHere()` compared
    //    `D.sysStar.seed` with `D.here.seed`, and in Sol those are the string 'Sol' and the hash-grid
    //    number 163760118 — so at home in Sol both designs armed the chip / commit row off the FOREIGN
    //    branch (`D.target`, which is Sol itself) with nothing selected, and said WARP instead of BURN.
    //    Measured live 2026-09-18 (AC-2). `_isCurrentSystem()` (:1089) is the 0.1 pc identity test
    //    the lab's own comment names as the authority; publish it and let the paint read it.
    D.isCurrent = !!(typeof nav._isCurrentSystem === 'function' && nav._isCurrentSystem());
    // ⭐ AC-5 — THE SHIP, GATED ON THAT SAME ANSWER AND ON NOTHING ELSE (SEAM §2). One expression,
    //    immediately under the test it depends on, so "am I home" cannot be asked twice and answered
    //    differently. ⚠ The two indices are copied, not aliased: they are plain numbers, and a design
    //    that captured the object would keep last frame's pair after a burn moved the ship.
    D.ship = D.isCurrent
      ? { planetIndex: Number.isFinite(nav._currentFocusIndex) ? nav._currentFocusIndex : -1,
          moonIndex: Number.isFinite(nav._currentMoonIndex) ? nav._currentMoonIndex : -1 }
      : null;
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
    // ── ⭐⭐ AC-2 (nav-defects-batch-2026-09-18) — NOTHING SELECTED IS NOW `null`, AND THE STAR IS A ROW
    //    ⛔ THE HABITABILITY FALLBACK IS GONE, AND IT WAS THE DEFECT, NOT A COURTESY. It ran whenever
    //    the pick was absent OR unresolvable, so the designs opened SYSTEM with a frame already on some
    //    planet, a detail block naming it and a commit row reading `BURN TO <that planet>` — a target
    //    the pilot never chose, armed, with `Enter` live. Clearing the selection (`_clearCommitSelection`
    //    at `NavComputer.js:4592`) then changed nothing on the glass, so "the selection never clears"
    //    was literally true. A guess that cannot be distinguished from a choice is not a default.
    //    ⚠ AND AN UNRESOLVABLE PICK IS `null` TOO. A `planetIndex` that matches no row means the pick
    //      and the body list disagree; drawing SOMETHING there is what hid that for a whole workstream.
    //    ⭐ THE STAR IS A ROW OF THE SAME SHAPE AS A PLANET'S, so every reader that already walks a body
    //      row — the detail block, the status line, the ladder frame, the orrery frame — reads it with
    //      no new field and no new branch beyond `kind === 'star'`. `NavComputer.js:4567` has always
    //      written `{ type: 'star', starIndex }` and this adapter has never had anywhere to put it, so
    //      picking the star left the frame wherever the fallback had put it.
    //    ⛔ `name` AND `cls` ARE NEVER `undefined`. Both designs call `.toUpperCase()` on them unguarded
    //      (`d1Rail`'s detail block does it twice on one line) and a throw out of a painter is not a
    //      blank field: `PanelHost` catches one ONCE and then stops uploading, so the glass freezes on
    //      the last good frame and still looks alive. Same rule `buildBodies` states for its rows.
    //    ⚠ `au: 0` IS TRUE OF A STAR AND IS WHAT THE LADDER NEEDS — `d1Ladder`'s virtual axis puts 0 AU
    //      at the axis origin, which is where the star mark is drawn.
    const pick = nav._selectedBody;
    const pickP = pick ? (pick.planetIndex ?? pick.index) : null;
    const starName = (D.sysStar?.name || D.sys?.star?.name || 'STAR');
    const starCls = (D.sysStar?.spectral || D.sys?.star?.type || D.sys?.star?.spectral || 'STAR');
    D.selBody = !pick ? null
      : pick.type === 'star'
        ? { kind: 'star', name: String(starName) || 'STAR', cls: String(starCls) || 'STAR',
            au: 0, rE: null, T: null, hab: null, rings: false, moons: 0,
            starIndex: pick.starIndex | 0 }
      : pick.type === 'planet'
        ? (D.bodies.find((r) => r.kind === 'planet' && r.pIdx === pickP) || null)
      : pick.type === 'moon'
        ? (D.bodies.find((r) => r.kind === 'moon' && r.pIdx === pickP && r.mIdx === pick.moonIndex) || null)
      : null;

    D.ready = !!(D.gm && D.player);
    return { S, D };
  }

  return { S, D, refresh };
}
