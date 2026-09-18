/**
 * nav-defects-batch-2026-09-18, WAVE 2 — THE DESIGN LANE: three defects in what the two designs DRAW.
 *
 *   AC-18 — design 2's SECTOR/REGION status line truncated `CLICK TO ENTER` off the glass at Max's
 *           own 417x240 buffer: the one control the line advertises was the part that fell off.
 *   AC-19 — design 1's 2D YOU marker and target diamond were drawn through the map transform with no
 *           cull, so a pan walked them out of the map and onto the ranked rail.
 *   AC-20 — design 1's SYSTEM screen gave one body two different tags: the ladder indexed the
 *           non-moon bodies, the rail indexed all of them, and the two diverged at the first moon.
 *
 * All three land in `nav-240p-lab.html` and reach the game through `scripts/extract-nav-designs.mjs`
 * (`--check` exits 0 on the checked-in pair). ⛔ SO A FIX APPLIED TO `designs.js` ALONE IS NOT A FIX —
 * the extractor would overwrite it and the audit would go red.
 *
 * ── ⭐ HOW THIS FILE READS THE GLASS ─────────────────────────────────────────────────────────────
 *
 * Every string goes through `drawPixelText`, which emits **fillRects**, so a context's `rec.text` is
 * empty however much writing is on the screen. This file uses the factory's fourth declared departure
 * (`PixelText` arrives as a parameter) to pass a `drawPixelText` that RECORDS the string and then
 * calls the real one, and a `fillRect`-recording context that also keeps `fillStyle` — so a mark can
 * be told from a glyph by its INK and its SIZE. ⛔ `makeRecordingContext` cannot be used: its Proxy
 * swallows `fillStyle` assignments, and every case below turns on a colour.
 *
 * ⛔ IT IS THE SHIPPED `S` / `D`, NOT A FIXTURE. `paint()` repaints the very pair the driver has just
 *    rendered from, so the adapter, the level gates and the live host state are upstream of every
 *    assertion. Only the face is swapped.
 *
 * ⭐ AND EVERY MARK-BEARING CASE DRIVES A REAL HOST GESTURE — `_handleMouseDown` + `_handleMouseMove`
 *   for the pan, `_onKeyDown` for the sort — because a defect that only appears once the camera moves
 *   cannot be reached by setting fields on `S`.
 *
 * ── ⛔ THE MUTANTS, MEASURED AGAINST `git show HEAD:src/ui/navViewModes/designs.js` ──────────────
 *
 * Each case was run against the PRE-FIX painter (HEAD's `designs.js` imported beside the current one
 * and handed the SAME `S`/`D`), 2026-09-18, headless at 417x240:
 *
 *   AC-18  drawn status line, SECTOR: "SECTOR · TAU VELA-94 · 22124140697 SYSTEMS IN BEST TILE · CL"
 *          REGION: "REGION · TAU VELA-94 · 19615395520 SYSTEMS IN BEST TILE · CL"  — `endsWith`
 *          fails, and the line + chip measure 413 + 41 against a 417-texel buffer.
 *   AC-19  after a 200-texel horizontal pan at GALAXY, EIGHT marks land INSIDE the ranked rail — the
 *          YOU cell (27x1 at (315,114), 27x1 at (315,140), 1x25 at (315,115), 1x25 at (341,115)), the
 *          YOU dot (3x3 at (325,113)) and the target diamond (3x1/5x1/3x1 at (326-331, 113-115)). At
 *          SECTOR the same five YOU fills; at REGION 14x1/14x1/1x12/1x12/3x3 at x 356-368. Fixed
 *          painter: zero, at all three levels.
 *   AC-20  SYSTEM, 5 planets / 3 moons: under AU the ladder drew 1,2,3,4 while the rail drew
 *          "2- PHOS", "4- …", "6- …"; under NAME the ladder drew two tags; under TEMP the ladder drew
 *          NONE AT ALL — the separation pass, fed a descending list, pushed every body off the
 *          window. Fixed painter: 1..5 on the ladder and the same letters in the rail, all three keys.
 *
 * ── ⛔ THE BEFORE/AFTER FRAME HASH IS A MEASUREMENT, NOT A CHECKED-IN CONSTANT ───────────────────
 *
 * Same technique, same session, over both designs at all five levels (FNV-1a over the whole fillRect
 * stream, coordinates and ink):
 *
 *   D1 L0 9e8b1c616e4307a9 · L1 f4ba124a693d8143 · L2 b869c714a397d498 · L3 156f219243a8f2e1  IDENTICAL
 *   D1 L4 466de8b2bde1856a → 075fba2c5dc462e9   (AC-20: the tags, and only the tags)
 *   D2 L0 4cc9715e3040685b · L3 a24212bf41d6642c · L4 cf421fb8ad0a4dce                        IDENTICAL
 *   D2 L1 dc43681798a0eeff → 889b0bacd95f95a6 · L2 3f149f398b02f1d2 → 52fdbe15b9a47ced  (AC-18: the line)
 *
 * i.e. the two levels each AC names, and nothing else. A pinned constant is NOT checked in here for
 * the reason wave 1 gives: three lanes are mutating this tree at once, and a hash that goes red on
 * another lane's correct work is a guard that gets switched off. What IS durable is each invariant,
 * and those are the cases below.
 */
import { describe, it, expect } from 'vitest';
import { makeHeadlessNav } from './helpers/headlessNav.mjs';
import { makeDesigns } from '../navViewModes/designs.js';
import { FACE, drawPixelText, measurePixelText } from '../../rendering/PixelText.js';

const W = 417, H = 240;                 // Max's window, and the buffer every number above is for
const INK = { RULE: '#1d3a4a', DIM: '#2f6b7a', BODY: '#7fd8e8', KEY: '#d8fbff', YOU: '#2ee6c0', TARGET: '#ffb03a' };
const TAGS = '123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** A 2D context that records each fill's RECTANGLE AND ITS INK. See the header for why. */
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

/** A nav with the prism loaded — every design needs it before it can draw anything real. */
async function loadedNav() {
  const h = await makeHeadlessNav({ width: W, height: H });
  h.nav._viewModesEnabled = true;
  h.nav._levelIndex = 3;
  h.nav.viewMode = 'rail';
  h.nav.render();
  return h;
}

/** Repaint this frame's `S` / `D` through a recording face. */
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
  return { fills, lines, viol, violations: d.violations(), regions: d.regions(), S, D,
           atY: (y) => lines.filter((l) => l.y === y).map((l) => l.s) };
}

/**
 * Put the nav at a level, in a mode, with a system drilled when SYSTEM is asked for.
 *
 * ⛔ THE SYSTEM STAR IS THE NEAREST LOADED ONE, NOT A LITERAL — see wave 1's file for why a made-up
 *    star turns every `isHere()` branch into its foreign-system twin. The BODIES stay synthetic
 *    because AC-20 needs a KNOWN moon layout: three planets carrying one moon each, which is the
 *    shape `state.js` interleaves and the shape the two indices diverged on.
 */
async function at(nav, mode, level, { planets = 5, moons = 3 } = {}) {
  nav.viewMode = mode;
  if (level === 4) {
    nav._systemStar = nav._localStars.reduce((m, s) => (m == null || s.dist < m.dist ? s : m), null);
    nav._systemData = {
      star: { type: 'G' }, zones: { hzInnerAU: 0.9, hzOuterAU: 1.4 }, asteroidBelts: [],
      planets: Array.from({ length: planets }, (_, i) => ({
        orbitRadiusAU: 0.4 + i * 0.9,
        moons: Array.from({ length: i < moons ? 1 : 0 }, () => ({ type: 'rock', radiusEarth: 0.2, T_eq: 200 })),
        planetData: { radiusEarth: 1 + (i % 4), T_eq: 260 + i * 40, habitability: { score: 0.2 }, rings: false },
      })),
    };
    nav._levelIndex = 4;
  } else nav._levelIndex = level;
  nav.render();
  return nav;
}

/** Drive the REAL keydown path — the entry the dead `V` key proved is the only honest one. */
const press = (nav, code, extra = {}) =>
  nav._onKeyDown({ code, preventDefault() {}, stopPropagation() {}, ...extra });

/** Rectangle overlap, the only test that means anything for a fill against a region. */
const inBox = (f, b) => !!b && f.x < b.x + b.w && f.x + f.w > b.x && f.y < b.y + b.h && f.y + f.h > b.y;

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// AC-18 — DESIGN 2'S SECTOR/REGION STATUS LINE FITS, WITH THE AFFORDANCE STILL ON IT
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('AC-18 — design 2 says CLICK TO ENTER at SECTOR and REGION, on the glass', () => {
  it('⛔ THE LINE ENDS IN THE CONTROL IT ADVERTISES, AND THE LINE PLUS THE CHIP FIT 417', async () => {
    const h = await loadedNav();
    const chipW = measurePixelText('[WARP]') + 6;   // the bar's other occupant, from the painter's own literal
    for (const level of [0, 1, 2]) {
      const nav = await at(h.nav, 'bars', level);
      const p = paint(nav, 2);
      // the status line is the one string on the bottom bar's text row; the chip is the other
      const row = p.atY(H - 8 + 2);
      const line = row.find((s) => s !== '[WARP]' && s !== '[BURN]');
      expect(line, `level ${level}: design 2 draws a status line`).toBeTruthy();
      // ⭐⭐ THE WHOLE DEFECT, AS A FACT ABOUT THE DRAWN STRING. On the unfixed painter this read
      //    "… 22124140697 SYSTEMS IN BEST TILE · CL" at both 2D drill levels — `fit()` ate the
      //    affordance from the right, which is the only end it eats from.
      expect(line.endsWith('CLICK TO ENTER'),
             `level ${level}: the drawn line must still carry its affordance — got ${JSON.stringify(line)}`).toBe(true);
      // …and it is not merely present, it FITS: nothing was clipped to put it there.
      expect(measurePixelText(line) + chipW + 8 + 4,
             `level ${level}: line ${measurePixelText(line)} + chip ${chipW} must fit ${W}`).toBeLessThanOrEqual(W);
      // ⭐ AND THE TWO THINGS THE BAR IS FOR SURVIVED THE SHORTENING: where you are, and how much is
      //   in the best tile under you. AC-18 names both as things to keep.
      const sector = (nav._viewDriverInst.D.playerSector?.name || '').toUpperCase();
      expect(line, `level ${level}: the sector name`).toContain(sector);
      if (level > 0) expect(line, `level ${level}: a formatted count and its label`).toMatch(/[\d.]+[KMBT]? BEST TILE/);
      else expect(line, 'GALAXY is untouched — its count clause still reads SYSTEMS').toMatch(/SYSTEMS/);
    }
  }, 60000);
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// AC-19 — THE 2D MARKS ARE CLIPPED TO THE MAP, UNDER A REAL PAN
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('AC-19 — the YOU marker and the target diamond stay inside the map pane', () => {
  it('⛔ A REAL 200-TEXEL PAN PUTS NO MARK ON THE RAIL OR ANY OTHER CHROME, AT EVERY 2D LEVEL', async () => {
    const h = await loadedNav();
    const nav = h.nav;
    // ⭐ A REAL TARGET, so the diamond is drawn at all: `D.target` is `D.selStar`, and `D.selStar` is
    //   synthesised from `_selectedNavStar` when the loader has not reached that seed (state.js:854).
    nav._selectedNavStar = { wx: 8.4, wy: 0, wz: 0, seed: 991, name: 'Probe', spectral: 'G', dist: 0.004 };
    for (const level of [0, 1, 2]) {
      await at(nav, 'rail', level);
      const before = paint(nav, 1);
      const r = before.regions;
      // ⭐⭐ THE HOST'S OWN PAN, NOT A WRITE TO `S`. `_handleMouseDown` arms the gesture (and under a
      //    design only on the map — AC-4), `_handleMouseMove` moves `_viewCenter` by the driver's own
      //    kpc-per-texel. Setting the camera directly would skip both and prove nothing about the
      //    picture a pilot can actually produce.
      const cx = r.map.x + r.map.w / 2, cy = r.map.y + r.map.h / 2;
      const centreWas = nav._viewCenter.x;
      nav._handleMouseDown({ clientX: cx, clientY: cy, button: 0 });
      nav._handleMouseMove({ clientX: cx + 200, clientY: cy, buttons: 1 });
      nav.render();
      // ⚠ THE PAN REALLY HAPPENED. Without this the case would pass on a build where the gesture is
      //   inert — and an inert gesture is exactly what AC-4 and AC-3 were both about.
      expect(nav._viewCenter.x, `level ${level}: the drag must move the camera`).not.toBe(centreWas);
      const p = paint(nav, 1);
      // ⭐ A MARK IS TOLD FROM A GLYPH BY ITS SIZE: `drawPixelText` emits 1x1 fills (measured — every
      //   text fill in the stream is 1x1), so any YOU/TARGET fill bigger than a texel is a MARK. That
      //   is what lets this assert about the rail, whose own detail rows print `YOU` and `TARGET`.
      const marks = (rgn) => p.fills.filter((f) => (f.ink === INK.YOU || f.ink === INK.TARGET)
                                                && (f.w > 1 || f.h > 1) && inBox(f, rgn));
      expect(marks(r.rail), `level ${level}: marks painted onto the ranked rail — ${JSON.stringify(marks(r.rail))}`)
        .toEqual([]);
      expect(marks(r.status), `level ${level}: marks painted onto the status row`).toEqual([]);
      expect(marks(r.hint), `level ${level}: marks painted onto the hint row`).toEqual([]);
      // ⛔ AND NOWHERE ELSE OFF THE MAP EITHER. The tab band and the commit row are excluded because
      //    both legitimately carry YOU-ink FILLS of their own (the active tab's plate, the armed
      //    commit bar) — chrome drawing itself, not a mark that escaped a pane.
      const strays = p.fills.filter((f) => (f.ink === INK.YOU || f.ink === INK.TARGET) && (f.w > 1 || f.h > 1)
                                        && !inBox(f, r.map) && !inBox(f, r.tabs) && !inBox(f, r.commit));
      expect(strays, `level ${level}: marks outside the map pane — ${JSON.stringify(strays)}`).toEqual([]);
      expect(p.violations, `level ${level}: the mark guard fired — ${JSON.stringify(p.viol)}`).toBe(0);
      nav._handleMouseUp();
      nav._viewCenter.x = centreWas; nav._viewCenter.z = 0;   // leave the camera where the next level expects it
      nav.render();
    }
  }, 120000);
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// AC-20 — ONE BODY, ONE TAG, UNDER EVERY SORT KEY
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('AC-20 — design 1\'s ladder and rail spell the same letter for the same body', () => {
  it('⛔ UNDER ALL THREE SORT KEYS, DRIVEN BY THE REAL `]`', async () => {
    const h = await loadedNav();
    const nav = await at(h.nav, 'rail', 4, { planets: 5, moons: 3 });
    for (const step of [0, 1, 2]) {
      if (step) press(nav, 'BracketRight');    // ⭐ the real binding (NavComputer.js:349 → cycleSort)
      nav.render();
      const p = paint(nav, 1);
      const { D, S, regions } = p;
      const key = ['AU', 'NAME', 'TEMP'][S.sortIdx | 0];
      expect(S.sortIdx | 0, `press ${step}: the key actually moved`).toBe(step);

      // ── THE ORDERING, STATED INDEPENDENTLY OF THE PAINTER: the non-moon bodies by AU, and a moon
      //    takes its parent's letter (a moon has no mark of its own on the ladder — it is a pip on
      //    its parent's stem, and its `au` IS its parent's).
      const order = D.bodies.filter((b) => b.kind !== 'moon').slice().sort((a, b) => (a.au ?? 0) - (b.au ?? 0));
      const tagFor = (b) => b.kind !== 'moon'
        ? (TAGS[order.indexOf(b)] || '?')
        : (TAGS[order.findIndex((o) => o.kind === 'planet' && o.au === b.au)] || '?');

      // ── WHAT THE LADDER DREW: the single characters inside the map pane, left to right.
      const tagLines = p.lines.filter((l) => l.s.length === 1 && l.x < regions.map.x + regions.map.w);
      expect(new Set(tagLines.map((l) => l.y)).size, `${key}: every ladder tag sits on one row`).toBe(1);
      const ladder = tagLines.slice().sort((a, b) => a.x - b.x).map((l) => l.s);
      // ⛔ EVERY LADDERED BODY IS TAGGED, IN AXIS ORDER. On the unfixed painter this was 4 tags under
      //    AU, 2 under NAME and ZERO under TEMP — the separation pass walked a descending list and
      //    pushed every body past the window's end.
      expect(ladder, `${key}: the ladder's tags, left to right`).toEqual(order.map((_, i) => TAGS[i]));

      // ── WHAT THE RAIL DREW: the rows, read off the grid THE PAINT ITSELF PUBLISHED. `S.listGeom`
      //    is written by `d1Rail` from the values it drew with (`top + (i + 1) * lead`), so this
      //    cannot pick up the header, the pager or a detail row by pattern-matching their text.
      const lg = S.listGeom;
      expect(lg?.rows, `${key}: the rail published a row per body`).toBe(D.bodies.length);
      const rows = Array.from({ length: lg.rows }, (_, i) =>
        p.lines.find((l) => l.x === regions.rail.x && l.y === lg.top + (i + 1) * lg.lead));
      expect(rows.filter(Boolean).length, `${key}: every published row was drawn`).toBe(lg.rows);
      rows.forEach((row, i) => {
        const body = D.bodies[(lg.offset | 0) + i];
        // ⭐⭐ THE DEFECT, AS ONE FACT: the letter beside this row is the letter under this body on
        //    the ladder. On the unfixed painter the rail read "2- PHOS" / "4- …" / "6- …" against a
        //    ladder that had just drawn 1,2,3,4 — same frame, same body, two letters.
        expect(row.s[0], `${key}: rail row ${i} (${body?.name}) must carry the ladder's letter`)
          .toBe(tagFor(body));
        expect(row.s[1], `${key}: rail row ${i} keeps the moon marker`).toBe(body.kind === 'moon' ? '-' : ' ');
        if (body.kind !== 'moon') {
          expect(ladder[order.indexOf(body)], `${key}: and the ladder agrees for ${body.name}`).toBe(row.s[0]);
        }
      });
    }
  }, 120000);
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// THE GUARD — BOTH DESIGNS, FIVE LEVELS, NOTHING OVER ITS REGION
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('the layout guard stays silent across both designs at every level', () => {
  it('⛔ ZERO VIOLATIONS, INCLUDING THE THREE MARKS AC-19 PUT UNDER IT', async () => {
    const h = await loadedNav();
    for (const design of [1, 2]) for (const level of [0, 1, 2, 3, 4]) {
      const nav = await at(h.nav, design === 1 ? 'rail' : 'bars', level);
      const p = paint(nav, design);
      expect(p.violations, `design ${design} level ${level}: ${JSON.stringify(p.viol)}`).toBe(0);
      expect(p.regions.map, `design ${design} level ${level}: the map region is declared`).toBeTruthy();
    }
  }, 120000);
});
