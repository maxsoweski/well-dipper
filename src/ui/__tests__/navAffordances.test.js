/**
 * AC-10 — NOTHING ON THE GLASS ADVERTISES A CONTROL THAT DOES NOT EXIST.
 *
 * ── WHAT THIS FILE IS FOR, AND WHY IT IS NOT THE OTHER NINE ─────────────────────────────────────
 *
 * The other cases in this workstream each pin ONE control. This one pins the RELATIONSHIP between
 * what the two designs SAY and what the instrument DOES, which is the thing the whole workstream is
 * about. Max, opening the session: *"every single thing needs to be functional and navigable by the
 * player."* The failure it exists to make impossible is not a broken control — it is a NEW promise,
 * added to a hint row in some later design pass, that nothing is behind. That defect ships silently,
 * because a string is not a call site and no compiler, linter or type checker will ever ask about it.
 *
 * ── ⛔ IT SCRAPES THE SOURCE, NOT THE RENDER, AND THAT IS FORCED ────────────────────────────────
 *
 * The obvious version of this test walks the recording context and reads back the drawn text. It
 * cannot work: every string on these screens goes through `drawPixelText`, which emits **fillRects**,
 * so `rec.text` is empty however much writing is on the glass. A previous case in this workstream
 * asserted the SYSTEM ladder "reveals" bodies by scraping `rec.text` and was measuring nothing at all
 * — it passed whatever the ladder did. So the promises are read out of `designs.js`'s own source
 * text, which is the only place they exist as words.
 *
 * ⚠ WHICH MAKES THE SCRAPE ITSELF LOAD-BEARING, so it is proved rather than trusted: `THE SCRAPE
 * FINDS WHAT IS ACTUALLY THERE` below asserts a known promise is in the harvest, and
 * `AN UNKNOWN PROMISE FAILS THE SWEEP` feeds the tokeniser a string that is not in the vocabulary and
 * asserts it is reported. Without those two, a scrape that silently matched nothing would report a
 * clean sweep forever.
 *
 * ── ⭐ AND EVERY PROBE DRIVES THE REAL ENTRY POINT ───────────────────────────────────────────────
 *
 * `_onKeyDown` for a key, `_handleMouseMove` + the render tail for a pick. Not a driver method. All
 * 28 view-mode tests passed while the `V` key was dead code — folded behind a `//` comment, present,
 * parsed and unreachable — because every one of them set state directly and not one drove the
 * keyboard. Max found it by playing the game. A probe here that called `drv.cycleSort()` would be
 * that same test again.
 *
 * ── ⛔⛔ REVIEW C24 (2026-09-18) — AND FIVE PROBES IN THIS FILE WERE BREAKING THAT RULE ──────────
 *
 * `CLICK A SECTOR`, `CLICK A TILE`, `CLICK A STAR`, `CLICK TO ENTER` and `SELECT A BODY` all name a
 * CLICK on the glass, and all five asserted a HOVER and stopped — worse, they reached the hover by
 * writing `_mouseX`/`_mouseY` as plain fields, so they entered neither `_handleClick` NOR
 * `_handleMouseMove`. Both halves of the rule above were broken for exactly the five phrases whose
 * promise is the click. Under a mode the click path has three gates the hover path does not —
 * `_handleClick`'s `if (this._anim) return`, `remapClick` returning `null`, and the 25-texel drag
 * test — so "the pointer lights something up" was never evidence that "the click does anything".
 *
 * All five now move the pointer through `_handleMouseMove`, let a FRAME resolve the pick (trap 4:
 * the hover resolves at the tail of the driver's `render()`), then press-release-click through
 * `clickAt` and assert THE CONSEQUENCE THE PHRASE PROMISES — the drill destination, the selected
 * star, the selected body. And the two map probes assert it DISCRIMINATINGLY: two different pointers
 * must produce two different destinations, so a click that drilled a constant cannot pass.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeHeadlessNav, makeRecordingContext, clickAt } from './helpers/headlessNav.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const DESIGNS = readFileSync(join(ROOT, 'src/ui/navViewModes/designs.js'), 'utf8');

/** Drive the REAL keydown path — the one the dead `V` key proved is the only honest entry. */
const press = (nav, code, extra = {}) =>
  nav._onKeyDown({ code, preventDefault() {}, stopPropagation() {}, ...extra });

async function nav({ mode = 'rail', level = 3 } = {}) {
  const h = await makeHeadlessNav({ width: 427, height: 240 });
  h.nav._viewModesEnabled = true;
  h.nav.viewMode = mode;
  h.nav._levelIndex = level;
  h.nav.render();
  return h.nav;
}

/**
 * Move the pointer and let a FRAME decide what is under it (trap 4).
 *
 * ⛔ THE `render()` IS NOT OPTIONAL AND IT IS NOT A FLUSH. The legacy painters run first under every
 * mode frame and rewrite all three hover fields from `_mouseX`/`_mouseY` against the LEGACY
 * projection; the driver re-resolves at the tail. A probe that moves without rendering reads
 * whichever of the two spoke last, which is how the five C24 probes could "see" a pick that the
 * click would never act on.
 */
const hover = (n, x, y) => { n._handleMouseMove({ clientX: x, clientY: y }); n.render(); };

/**
 * Hover a point, click it, and report the tile that was under the pointer and where the drill went.
 *
 * `null` when nothing was under the pointer or the click did not drill one level deeper — either is
 * the promise unkept. `_anim.toCenter` is the destination `_startDrillAnim` was handed, which is the
 * observable a 2D→2D drill produces synchronously (the LEVEL only moves when the ease lands).
 */
function drillFrom(n, x, y, level) {
  hover(n, x, y);
  const tile = n._hoveredTile;
  if (!tile || tile.col === undefined) return null;
  clickAt(n, x, y);
  if (n._anim?.toLevel !== level + 1) return null;
  return { tile, dest: { ...n._anim.toCenter } };
}

// ── AC-4's SUB-VIEW (nav-restorations-2026-09-20, wave 2b) ────────────────────────────────────────
//
// Two of the phrases below are only ever on the glass while a planet's moon sub-view is open, so
// their probes have to REACH that screen through real input before they can prove anything on it.
// Everything here is the pilot's own walk: stand in a system with a moon-bearing planet, click the
// planet (it selects), click it again (the sub-view opens). No field on `S` is written by hand.

/** The planet these probes open — index 1, the only one in the fixture carrying moons. */
const MOONY = 1;

/**
 * Stand the pilot ON the nearest loaded star, in a system whose planet 1 has three moons.
 *
 * ⛔ THE PLAYER'S OWN SYSTEM, for the reason `SELECT A BODY`'s probe gives two entries up: under a
 *    design the foreign-system planet branch arms no selection at all, and the ENTER rule needs the
 *    planet to BE the selection before a second click can open it.
 */
async function standInMoonySystem(n, mode) {
  n.viewMode = mode;
  n._systemStar = (n._localStars || []).reduce((m, s) => (m == null || s.dist < m.dist ? s : m), null);
  if (!n._systemStar) return false;
  n._playerX = n._systemStar.wx; n._playerY = n._systemStar.wy; n._playerZ = n._systemStar.wz;
  n._systemData = {
    star: { type: 'G' }, zones: { hzInnerAU: 0.9, hzOuterAU: 1.4 },
    asteroidBelts: [{ centerRadiusAU: 3.1, widthAU: 1 }],
    planets: [0, 1, 2].map((i) => ({
      orbitRadiusAU: 0.6 + i * 1.8, orbitAngle: i * 0.9,
      moons: i === MOONY ? [0, 1, 2].map((j) => ({
        type: ['ROCK', 'ICE', 'CAPTURED'][j], radiusEarth: 0.18 + j * 0.06,
        orbitRadiusEarth: 14 + j * 21, startAngle: j * 1.4, T_eq: 120 + j,
      })) : [],
      planetData: { radiusEarth: 1 + i, T_eq: 280 - i * 40, habitability: { score: 0.2 }, rings: false },
    })),
  };
  n._currentSystemData = n._systemData;
  n._levelIndex = 4;
  n.render();
  return true;
}

/** The paint's own mark for a whole-system body — off `S.bodyHits`, never recomputed. */
const bodyMark = (n, pIdx) => (n._viewDriverInst.S.bodyHits || []).find(
  (z) => z && !z.star && z.ref && z.ref.kind === 'planet' && z.ref.pIdx === pIdx && z.moon === -1);

/** A moon's pip inside the open sub-view — published there with its own `type`/`moonIndex`. */
const subViewMoon = (n, mIdx) => (n._viewDriverInst.S.bodyHits || []).find(
  (z) => z && z.type === 'moon' && z.moonIndex === mIdx);

/** Select the planet, then click it again: the driver's ENTER rule, driven. */
function enterSubView(n, pIdx) {
  for (let i = 0; i < 2; i++) {
    const mk = bodyMark(n, pIdx);             // re-read between clicks: the first one repaints
    if (!mk) return false;
    hover(n, mk.x + 0.5, mk.y + 0.5);
    clickAt(n, mk.x + 0.5, mk.y + 0.5);
  }
  n.render();
  return n._viewDriverInst.S.sysView === 'planet' && n._viewDriverInst.S.detailPlanet === pIdx;
}

/** A nav whose canvas KEEPS the listeners the class registers on it (helpers/headlessNav.mjs gives
 *  its own canvas a no-op `addEventListener`, so `contextmenu` is otherwise undriveable).
 *  Same shape as navRestorations4.host.test.js:227, which drives the same route. */
async function navWithCanvasListeners() {
  await makeHeadlessNav({ width: 427, height: 240 });   // installs the DOM globals NavComputer reaches for
  const listeners = new Map();
  const canvas = {
    width: 427, height: 240, style: {}, parentElement: null,
    addEventListener: (type, fn) => { listeners.set(type, fn); },
    removeEventListener: () => {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 427, height: 240, right: 427, bottom: 240 }),
  };
  const { ctx } = makeRecordingContext(canvas);
  canvas.getContext = () => ctx;
  const { NavComputer } = await import('../NavComputer.js');
  const { GalacticMap } = await import('../../generation/GalacticMap.js');
  return { nav: new NavComputer(canvas, new GalacticMap(), null), listeners };
}

/**
 * THE VOCABULARY: every phrase the designs may use to name a control, and the probe that proves the
 * control is there. A phrase with no entry here fails the sweep — that is the whole point.
 *
 * ⛔ A PROBE MUST ASSERT AN OBSERVABLE CONSEQUENCE, never that a binding exists. "The driver method
 * was called" is not evidence: the clause that calls it can be unreachable, which is exactly what
 * shipped on 2026-09-07.
 */
const VOCABULARY = [
  {
    phrase: '[ ] SORT',
    control: 'the bracket keys re-order the ranked list',
    async probe() {
      const n = await nav();
      const before = n._viewDriverInst.S.sortLabel;
      const first = n._viewDriverInst.D.starRows[0];
      press(n, 'BracketRight');
      n.render();
      return n._viewDriverInst.S.sortLabel !== before
          && n._viewDriverInst.D.starRows[0] !== first;
    },
  },
  {
    phrase: '- = PAGE',
    control: 'minus and equals page the ranked list',
    async probe() {
      const n = await nav();
      press(n, 'Equal');
      n.render();
      return (n._viewDriverInst.S.listOffset | 0) > 0;
    },
  },
  {
    phrase: '/ SEARCH',
    control: 'slash opens the drawn search',
    async probe() {
      const n = await nav();
      press(n, 'Slash');
      return n._viewDriverInst.searchActive() === true;
    },
  },
  {
    phrase: 'TAB LEVEL',
    control: 'Tab changes level',
    async probe() {
      const n = await nav({ level: 3 });
      const before = n._levelIndex;
      press(n, 'Tab');
      n.render();
      return n._levelIndex !== before;
    },
  },
  {
    phrase: 'ENTER',
    control: 'Enter fires the same commit the [ WARP ] / [ BURN ] button fires',
    async probe() {
      const n = await nav();
      let fired = null;
      n._selectedNavStar = { wx: 8, wy: 0, wz: 0, seed: 991, name: 'Probe', spectral: 'G' };
      n._onCommit = (a) => { fired = a; };
      press(n, 'Enter');
      return !!fired && fired.type === 'warp';
    },
  },
  {
    phrase: 'WASD PAN',
    control: 'the four pan letters move the prism camera the designs draw from',
    async probe() {
      const n = await nav({ level: 3 });
      const before = { ...n._localCenter };
      press(n, 'KeyD');
      for (let i = 0; i < 8; i++) n.render();
      n._onKeyUp({ code: 'KeyD' });
      // ⭐ THE CAMERA MUST REACH `S.cam`, NOT JUST MOVE. Before this workstream `_localCenter`
      //    moved perfectly well and the designs' prism was anchored to the SHIP, so the picture
      //    never moved — measured byte-identical with a liveness control. Both halves, or neither.
      const moved = n._localCenter.x !== before.x || n._localCenter.z !== before.z;
      const cam = n._viewDriverInst.S.cam;
      return moved && cam.x === n._localCenter.x && cam.z === n._localCenter.z;
    },
  },
  {
    phrase: 'R/F UP',
    control: 'R and F move the prism camera in Y',
    async probe() {
      const n = await nav({ level: 3 });
      const before = n._localCenter.y;
      press(n, 'KeyR');
      for (let i = 0; i < 8; i++) n.render();
      n._onKeyUp({ code: 'KeyR' });
      return n._localCenter.y !== before && n._viewDriverInst.S.cam.y === n._localCenter.y;
    },
  },
  // ── ⭐ AC-12 (nav-defects-batch-2026-09-18) — THE THREE PHRASES THE DESIGNS NOW PRINT ───────────
  // Design 1 prints `V LOOK  SHIFT+TAB BACK  ESC CLOSE` in the free run of its tab strip and design 2
  // prints the same line, plus `SELECT A BODY  DRAG ROTATE  ENTER` at SYSTEM, over the bottom-left of
  // its map. Two of them (`TAB BACK`, `DRAG ROTATE`) are reported by `tokenize` as unbacked promises
  // until they are here, which is this file working exactly as designed: a new word on the glass has
  // to arrive with the probe that proves the control behind it.
  // ⚠ `V LOOK` IS HERE THOUGH THE TOKENISER DOES NOT DEMAND IT — a bare letter followed by a verb is
  //   not one of the shapes it matches, so V could have gone on the glass unswept. A promise that
  //   slips past the guard is exactly the promise most worth a probe.
  {
    phrase: 'V LOOK',
    control: 'V cycles the look',
    async probe() {
      const n = await nav();
      const before = n.viewMode;
      press(n, 'KeyV');
      return n.viewMode !== before && n.viewMode !== null;
    },
  },
  {
    phrase: 'SHIFT+TAB BACK',
    control: 'Shift+Tab walks the drill back one level',
    async probe() {
      const n = await nav({ level: 3 });
      press(n, 'Tab', { shiftKey: true });
      n.render();
      // a 2D<-2D step eases rather than snapping, so accept the animation's destination
      return (n._anim ? n._anim.toLevel ?? n._levelIndex : n._levelIndex) === 2;
    },
  },
  {
    phrase: 'DRAG ROTATE',
    control: "a drag on design 2's orrery turns it",
    async probe() {
      const n = await nav({ mode: 'bars', level: 4 });
      n._systemStar = { wx: 8, wy: 0, wz: 0, seed: 31, spectral: 'G', name: 'Spin' };
      n._systemData = {
        star: { type: 'G' }, zones: { hzInnerAU: 0.9, hzOuterAU: 1.4 }, asteroidBelts: [],
        planets: [{ orbitRadiusAU: 1.0, moons: [],
                    planetData: { radiusEarth: 1, T_eq: 288, habitability: { score: 0.2 }, rings: false } }],
      };
      n.render();
      const before = n._systemRotY;
      // ⭐ THE PRESS LANDS IN THE MAP PANE ON PURPOSE. Since AC-4 the host asks the driver whether the
      //    press starts a gesture at all, so a probe that pressed on the status bar would report a
      //    working rotation as broken — and would be measuring AC-4, not this promise.
      n._handleMouseDown({ clientX: n._canvas.width / 2, clientY: n._canvas.height / 2, button: 0 });
      n._handleMouseMove({ clientX: n._canvas.width / 2 + 40, clientY: n._canvas.height / 2 });
      n._handleMouseUp();
      n.render();
      // both halves: the camera moved AND the design is drawing from the moved camera
      return n._systemRotY !== before
          && n._viewDriverInst.S.sysCam.rotY !== undefined
          && Math.abs(Math.cos(n._viewDriverInst.S.sysCam.rotY) - Math.cos(n._systemRotY)) < 1e-9;
    },
  },
  {
    phrase: 'SCROLL , . OR CLICK ...',
    control: 'comma and full stop walk the SYSTEM ladder',
    async probe() {
      const n = await nav({ level: 4 });
      n._systemStar = { wx: 8, wy: 0, wz: 0, seed: 77, spectral: 'G', name: 'Crowded' };
      n._systemData = {
        star: { type: 'G' }, zones: { hzInnerAU: 0.9, hzOuterAU: 1.4 }, asteroidBelts: [],
        planets: Array.from({ length: 40 }, (_, i) => ({
          orbitRadiusAU: 0.2 + i * 0.9, moons: [],
          planetData: { radiusEarth: 1, T_eq: 250, habitability: { score: 0.1 }, rings: false },
        })),
      };
      n.render();
      const before = n._viewDriverInst.S.ladderScroll;
      press(n, 'Period');
      n.render();
      return n._viewDriverInst.S.ladderScroll !== before;
    },
  },
  {
    phrase: 'L=LIST',
    control: "L toggles design 2's list mode",
    async probe() {
      const n = await nav({ mode: 'bars', level: 3 });
      const before = n._viewDriverInst.S.list;
      press(n, 'KeyL');
      return n._viewDriverInst.S.list !== before;
    },
  },
  { phrase: 'L=MAP', control: "L toggles design 2's list mode", sameAs: 'L=LIST' },
  {
    phrase: 'CLICK A SECTOR',
    control: 'a click in the GALAXY map drills the sector under the pointer',
    async probe() {
      const n = await nav({ level: 0 });
      const p = n._viewDriverInst.S.mapProj;
      if (!p) return false;
      // ⭐ AIMED AT THE MIDDLE OF THE DISC ON PURPOSE. The square's corners are outside the galaxy,
      //    where `getSectorAt` correctly answers null — a probe that aimed there would report a
      //    working picker as broken.
      const x = p.ox + p.sq / 2, y = p.oy + p.sq / 2;
      hover(n, x, y);
      const s = n._hoveredTile?.sector;
      if (!s) return false;
      clickAt(n, x, y);
      // ⛔ THE SECTOR THE POINTER WAS OVER, NOT "a" sector: `_viewStack[1]` is built from the pick's
      //    own `centerX`/`centerZ`, so a click that drilled anything else lands somewhere else.
      const dest = n._viewStack[1]?.center;
      return n._anim?.toLevel === 1 && !!dest && dest.x === s.centerX && dest.z === s.centerZ;
    },
  },
  {
    phrase: 'CLICK A TILE',
    control: 'a click in the SECTOR / REGION map drills the tile under the pointer',
    async probe() {
      for (const level of [1, 2]) {
        const n = await nav({ level });
        const p = n._viewDriverInst.S.mapProj;
        if (!p) return false;
        const a = drillFrom(n, p.ox + p.cell * 1.5, p.oy + p.cell * 1.5, level);
        // ⭐ THE FIRST DRILL'S EASE IS STOOD DOWN so the second click is not eaten by
        //    `_handleClick`'s `if (this._anim) return` gate. Nothing else about the level moves
        //    until the ease lands, so the second pointer meets the same picture as the first.
        n._anim = null;
        const b = drillFrom(n, p.ox + p.cell * 3.5, p.oy + p.cell * 4.5, level);
        if (!a || !b) return false;
        // ⛔ THE DISCRIMINATOR. Two different tiles under two different pointers must drill to two
        //    different places; a click that drilled a constant — or the tile the LAST frame hovered
        //    — passes "something happened" and fails this.
        if (a.tile.col === b.tile.col && a.tile.row === b.tile.row) return false;
        if (a.dest.x === b.dest.x && a.dest.z === b.dest.z) return false;
      }
      return true;
    },
  },
  {
    phrase: 'CLICK A STAR',
    control: 'a click in the PRISM map selects the star under the pointer',
    async probe() {
      const n = await nav({ level: 3 });
      const hits = n._viewDriverInst.S.prismHits;
      if (!hits?.length) return false;
      const h = hits[hits.length - 1];
      hover(n, h.x, h.y);
      const star = n._hoveredLocalStar?.star;
      if (!star) return false;
      clickAt(n, h.x, h.y);
      // ⚠ WITH NO SPAWNED SYSTEM (`_currentSystemData` null, which is this harness) the click SELECTS
      //   and stops — Max, 2026-09-07: *"disable the system screen when not in a system."* The
      //   selection is the promise `CLICK A STAR` makes; the SYSTEM screen is a separate one.
      return n._selectedNavStar?.seed === star.seed && n._systemStar?.seed === star.seed;
    },
  },
  {
    phrase: 'SELECT A STAR TO WARP',
    control: "design 1's commit row: picking a star (not the system you are in) arms the warp it names",
    async probe() {
      const n = await nav({ level: 3 });
      const hits = n._viewDriverInst.S.prismHits;
      if (!hits?.length) return false;
      const h = hits[hits.length - 1];
      hover(n, h.x, h.y);
      if (!n._hoveredLocalStar?.star) return false;
      clickAt(n, h.x, h.y);
      n.render();
      const D = n._viewDriverInst.D;
      if (!D.target || D.targetIsHere) return false;
      // ⭐ AND THE SYSTEM YOU ARE IN IS NOT A DESTINATION: name it as here, and the warp disarms.
      n._currentSystemName = D.target.name;
      n.render();
      return D.targetIsHere === true;
    },
  },
  {
    phrase: 'CLICK TO ENTER',
    control: "design 2's map enters the sector / tile under the pointer at GALAXY, SECTOR and REGION",
    async probe() {
      for (const level of [0, 1, 2]) {
        const n = await nav({ mode: 'bars', level });
        const p = n._viewDriverInst.S.mapProj;
        if (!p) return false;
        if (level === 0) {
          // design 2 draws GALAXY as a full-width band (`kind: 'wide'`), whose `ox`/`oy` IS the centre
          hover(n, p.ox, p.oy);
          const s = n._hoveredTile?.sector;
          if (!s) return false;
          clickAt(n, p.ox, p.oy);
          const dest = n._viewStack[1]?.center;
          if (n._anim?.toLevel !== 1 || !dest || dest.x !== s.centerX || dest.z !== s.centerZ) return false;
        } else {
          const a = drillFrom(n, p.bx + p.cell * 1.5, p.by + p.cell * 1.5, level);
          n._anim = null;
          const b = drillFrom(n, p.bx + p.cell * 3.5, p.by + p.cell * 4.5, level);
          if (!a || !b) return false;
          if (a.tile.col === b.tile.col && a.tile.row === b.tile.row) return false;
          if (a.dest.x === b.dest.x && a.dest.z === b.dest.z) return false;
        }
      }
      return true;
    },
  },
  {
    phrase: 'SELECT A BODY',
    control: 'a click on a body glyph at SYSTEM selects THAT body and arms the commit',
    async probe() {
      const n = await nav({ level: 4 });
      // ⭐ THE SYSTEM IS THE PLAYER'S OWN ON PURPOSE. `_handleClick`'s foreign-system planet branch
      //    arms no selection at all under a mode (it armed a `_systemMode` the designs do not draw —
      //    logged as AC-2 work in picking.js, not faked here), so a foreign fixture would be asking
      //    this phrase to prove something the instrument does not yet do.
      n._systemStar = { wx: n._playerX, wy: n._playerY, wz: n._playerZ, seed: 12, spectral: 'G', name: 'Probe' };
      n._systemData = {
        star: { type: 'G' }, zones: { hzInnerAU: 0.9, hzOuterAU: 1.4 }, asteroidBelts: [],
        planets: [
          { orbitRadiusAU: 1.0, moons: [],
            planetData: { radiusEarth: 1, T_eq: 288, habitability: { score: 0.9 }, rings: false } },
          { orbitRadiusAU: 5.0, moons: [],
            planetData: { radiusEarth: 4, T_eq: 120, habitability: { score: 0 }, rings: false } },
        ],
      };
      n._currentSystemData = n._systemData;
      n.render();
      const hits = (n._viewDriverInst.S.bodyHits || []).filter((h) => h.ref && h.ref.kind === 'planet' && h.moon < 0);
      if (hits.length < 2) return false;
      // both planets, so "it selected the body under the pointer" cannot pass on a constant
      for (const h of hits.slice(0, 2)) {
        hover(n, h.x, h.y);
        const held = n._hoveredBody;
        if (!held || held.type !== 'planet') return false;
        n._selectedBody = null; n._commitAction = null;
        clickAt(n, h.x, h.y);
        if (n._selectedBody?.type !== 'planet' || n._selectedBody.planetIndex !== held.index) return false;
        if (!n._commitAction) return false;
      }
      return true;
    },
  },
  {
    phrase: 'SELECT A MOON',
    control: 'a moon pip in the open planet sub-view becomes the selection AND the burn target',
    async probe() {
      // Design 1 — the only design that draws a hint row at all. The row appears only while a
      // planet is open, so the probe has to get there the way the pilot does: select the planet,
      // then click it again (the driver's ENTER rule, navViewModes/index.js:1441).
      const n = await nav({ level: 3 });
      if (!(await standInMoonySystem(n, 'rail'))) return false;
      if (!enterSubView(n, MOONY)) return false;
      const pip = subViewMoon(n, 2);
      if (!pip) return false;
      // ⛔ CLEARED FIRST, so "the moon is selected" cannot pass on the planet selection that the
      //    ENTER gesture itself had to leave behind.
      n._selectedBody = null; n._commitAction = null;
      hover(n, pip.x + 0.5, pip.y + 0.5);
      clickAt(n, pip.x + 0.5, pip.y + 0.5);
      const sel = n._selectedBody;
      return !!sel && sel.type === 'moon' && sel.planetIndex === MOONY && sel.moonIndex === 2
          && n._commitAction?.target === 'moon' && n._commitAction?.moonIndex === 2;
    },
  },
  {
    phrase: 'RIGHT CLICK BACK',
    control: 'the right-click the canvas itself listens for leaves the sub-view and keeps the nav open',
    async probe() {
      // ⛔⛔ THE LIVE ROUTE, NOT ITS REACHABLE-LOOKING TWIN. `_handleClick` tests `e.button === 2`
      //    at NavComputer.js:4488, but no browser fires a `click` event for the secondary button —
      //    the route a real right-click takes is the canvas's own `contextmenu` listener (:336),
      //    which calls `handleEscape()` directly. The shared harness gives its canvas an
      //    `addEventListener` that throws the handler away, so this probe builds one that keeps it.
      //    Without that, this phrase could only be "proved" through a path the pilot never walks.
      const { nav: n, listeners } = await navWithCanvasListeners();
      n._viewModesEnabled = true;
      n._levelIndex = 3;
      n.viewMode = 'bars';                     // design 2 draws it on the status bar
      n.render();
      if (!(await standInMoonySystem(n, 'bars'))) return false;
      if (!enterSubView(n, MOONY)) return false;
      const drv = n._viewDriverInst;
      const ctxMenu = listeners.get('contextmenu');
      if (!ctxMenu) return false;
      // A right-click is a mousedown and THEN `contextmenu` at the same point — the listener's own
      // 5-texel test measures the second against the first.
      n._handleMouseDown({ clientX: 120.5, clientY: 110.5, button: 2 });
      ctxMenu({ clientX: 120.5, clientY: 110.5, preventDefault() {} });
      n._handleMouseUp();
      return drv.S.sysView === 'system' && drv.S.detailPlanet === -1
          && n._levelIndex === 4 && n._selectedBody?.type === 'planet';
    },
  },
  {
    phrase: 'TYPE A NAME',
    control: 'printable keys reach the drawn search field',
    async probe() {
      const n = await nav();
      press(n, 'Slash');
      for (const [code, key] of [['KeyS', 's'], ['KeyO', 'o'], ['KeyL', 'l']]) press(n, code, { key });
      return n._viewDriverInst.S.search.text === 'sol';
    },
  },
  {
    phrase: 'UP DOWN MOVE',
    control: 'the arrow keys move the search highlight',
    async probe() {
      const n = await nav();
      press(n, 'Slash');
      for (const [code, key] of [['KeyS', 's'], ['KeyO', 'o'], ['KeyL', 'l']]) press(n, code, { key });
      if ((n._viewDriverInst.S.search.rows || []).length < 2) return false;
      const before = n._viewDriverInst.S.search.highlight;
      press(n, 'ArrowDown');
      return n._viewDriverInst.S.search.highlight !== before;
    },
  },
  {
    phrase: 'ENTER WARP',
    control: 'Enter warps to the highlighted search result',
    async probe() {
      const n = await nav();
      let fired = null;
      n._onCommit = (a) => { fired = a; };
      press(n, 'Slash');
      for (const [code, key] of [['KeyS', 's'], ['KeyO', 'o'], ['KeyL', 'l']]) press(n, code, { key });
      press(n, 'Enter');
      return !!fired && fired.type === 'warp';
    },
  },
  { phrase: 'ENTER TO WARP', control: 'Enter commits', sameAs: 'ENTER' },
  {
    phrase: 'ESC CLOSE',
    control: 'Escape closes the search AND ONLY closes it',
    async probe() {
      const n = await nav({ level: 3 });
      press(n, 'Slash');
      press(n, 'Escape');
      // ⛔ BOTH HALVES. The DOM widget's Escape stopped at `input.blur()` and never reached
      //    `handleEscape`; a pilot who abandons a search must not also lose a level of the drill.
      return n._viewDriverInst.searchActive() === false && n._levelIndex === 3;
    },
  },
];

const BY_PHRASE = new Map(VOCABULARY.map((v) => [v.phrase, v]));

/**
 * Harvest every phrase the designs draw that NAMES a control.
 *
 * The strings live in template literals and array literals in `designs.js`. We take the source text
 * of every one and ask which vocabulary phrases occur in it — so a phrase that is drawn is found,
 * and a phrase that is drawn and is NOT in the vocabulary is reported as an unbacked promise.
 */
/**
 * `designs.js` with its comments removed.
 *
 * ⛔ THE FIRST VERSION OF THIS SWEEP SCRAPED THE WHOLE FILE AND REPORTED `DRAG TO ROTATE` AS AN
 * UNBACKED PROMISE — a string that is no longer drawn anywhere, and appears only in the comment
 * recording that it was REMOVED for lying about a ladder. A guard that fires on its own changelog is
 * a guard that gets switched off. Only code can put words on the glass, so only code is harvested.
 */
function codeOnly(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
}

function harvestPromises() {
  const found = new Set();
  const unknown = new Set();
  // Every single- or back-quoted literal in the file, un-nested — enough for hint rows, status
  // clauses, the pager and the commit label, which is where every promise on these screens lives.
  const literals = codeOnly(DESIGNS).match(/(['`])(?:\\.|(?!\1)[^\\\n])*\1/g) || [];
  for (const raw of literals) {
    const s = raw.slice(1, -1);
    // ⚠ `[A-Z]{2}`, NOT `{3}`. The first version of this guard wanted three consecutive capitals and
    // silently dropped `R/F UP`, whose longest run is two — so a promise that IS drawn went unswept
    // and its probe was never demanded. A filter that quietly excludes is the same failure as a
    // scrape that quietly matches nothing.
    if (!/[A-Z]{2}/.test(s)) continue;                    // prose and identifiers are not promises
    for (const v of VOCABULARY) if (s.includes(v.phrase)) found.add(v.phrase);
    for (const m of tokenize(s)) unknown.add(`${m}   (in "${s.slice(0, 70)}")`);
  }
  return { found, unknown };
}

/**
 * Which control-naming phrases does this string contain that the vocabulary does not cover?
 *
 * ⚠ DELIBERATELY NARROW. A sweep that flagged every capitalised word would drown in `GALAXY`,
 * `SYSTEMS`, `RINGED`, `NEAREST 27` — readouts, not controls — and would be switched off within a
 * week, which is the ordinary fate of a noisy guard. It matches only the shapes a CONTROL takes on
 * these screens: a bracketed key, a bare key name followed by a verb, a `KEY=THING` binding, or an
 * imperative opening with CLICK / SELECT / TYPE / PRESS / DRAG / SCROLL.
 */
function tokenize(s) {
  // ⭐ MASK THE KNOWN PHRASES FIRST, THEN LOOK FOR CONTROL SHAPES IN WHAT IS LEFT.
  //
  // ⛔ The obvious version walks the string and consumes a vocabulary phrase off the front, and it is
  // wrong twice over. `CLICK A SECTOR OR A LIST ROW   [ ] SORT   / SEARCH   TAB LEVEL` leaves
  // "OR A LIST ROW ..." behind, which is connective prose and got reported as an unbacked promise;
  // and a greedy imperative match swallows to end-of-line, so `SELECT A BODY   DRAG TO ROTATE` yields
  // only the bound half and HIDES the unbound one — this file's own defect, reintroduced inside the
  // thing that is supposed to catch it. Masking is order-independent and cannot do either.
  // ⛔ LONGEST PHRASE FIRST: `ENTER` is a phrase and it is also a prefix of `ENTER WARP`.
  let rest = s;
  for (const phrase of VOCABULARY.map((v) => v.phrase).sort((x, y) => y.length - x.length)) {
    rest = rest.split(phrase).join(' \u0000 ');
  }
  const out = [];
  const patterns = [
    /\[\s*\]\s*[A-Z]+/g,                                     // "[ ] FILTER"
    /\b(?:CLICK|SELECT|TYPE|PRESS|DRAG|SCROLL)\b[^\u0000\n]*/g,  // an unbound imperative
    /\b[A-Z]=[A-Z]+/g,                                       // "K=THING"
    /\b(?:TAB|ENTER|ESC|WASD|R\/F|UP DOWN)\b[^\u0000\n]*/g,     // a key name plus its verb
    /-\s*=\s*[A-Z]+/g,                                       // "- = PAGE"
    /\/\s*SEARCH/g,
  ];
  for (const re of patterns) {
    for (const m of rest.match(re) || []) {
      const t = m.trim().replace(/\s+/g, ' ');
      if (t) out.push(t);
    }
  }
  return out;
}

describe('AC-10 — every promise the glass makes is kept', () => {
  it('⭐ THE SCRAPE FINDS WHAT IS ACTUALLY THERE — without this the sweep below is vacuous', () => {
    const { found } = harvestPromises();
    // If the harvest ever silently matched nothing, every case in this file would pass forever.
    expect(found.size, 'the scrape found no promises at all').toBeGreaterThan(8);
    for (const known of ['[ ] SORT', '/ SEARCH', 'TAB LEVEL', 'WASD PAN', 'CLICK TO ENTER']) {
      expect(found.has(known), `the scrape missed "${known}", which designs.js definitely draws`).toBe(true);
    }
  });

  it('⛔ AN UNKNOWN PROMISE FAILS THE SWEEP — this is the defect the file exists to catch', () => {
    // A design pass adds a control to a hint row and binds nothing. The tokeniser must see it.
    expect(tokenize('CLICK A STAR   [ ] FILTER   TAB LEVEL')).toEqual(['[ ] FILTER']);
    expect(tokenize('SELECT A BODY   DRAG TO ROTATE')).toEqual(['DRAG TO ROTATE']);
    // …and must NOT fire on a readout, or the guard gets switched off for noise.
    expect(tokenize('PRISM · 27524 STARS · 3.0 PC ACROSS')).toHaveLength(0);
  });

  it('⛔ NO PHRASE ON THE GLASS IS OUTSIDE THE VOCABULARY', () => {
    const { unknown } = harvestPromises();
    expect([...unknown], 'designs.js names a control this file cannot account for').toEqual([]);
  });

  for (const v of VOCABULARY) {
    const target = v.sameAs ? BY_PHRASE.get(v.sameAs) : v;
    it(`"${v.phrase}" → ${v.control}`, { timeout: 60000 }, async () => {
      const { found } = harvestPromises();
      // Only assert the drawing for phrases the designs actually carry; `sameAs` aliases share a probe.
      if (!found.has(v.phrase) && !v.sameAs) {
        throw new Error(`"${v.phrase}" is in the vocabulary but designs.js no longer draws it — `
          + 'delete the entry, or find out why the promise disappeared.');
      }
      expect(await target.probe(), `"${v.phrase}" is drawn on the glass and ${v.control} does not happen`).toBe(true);
    });
  }
});
