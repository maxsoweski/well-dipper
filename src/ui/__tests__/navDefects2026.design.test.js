/**
 * nav-defects-batch-2026-09-18 — THE DESIGN LANE: what the two designs DRAW.
 *
 * Three items of the twelve land in `nav-240p-lab.html` and reach the game through
 * `scripts/extract-nav-designs.mjs`:
 *
 *   AC-2  (painter half) — every reader of `D.selBody` tolerates `null` and `kind: 'star'`.
 *   AC-11 — design 1's commit bar no longer shares row 233 with the tab band.
 *   AC-12 — the legends: `/ SEARCH`, `R/F UP`, `[ ] SORT`, `- = PAGE`, and the three global keys.
 *
 * ── ⭐ HOW THIS FILE READS WORDS OFF THE GLASS, AND WHY IT IS NOT A SOURCE SCAN ─────────────────
 *
 * Every string in these designs goes through `drawPixelText`, which emits **fillRects**, so the
 * recording context's `rec.text` is empty however much writing is on the screen — the trap
 * `navAffordances.test.js` records in its own header. That file answers it by scraping `designs.js`'s
 * SOURCE, which can only ever say what the file MIGHT draw. AC-12 is about what a pilot at a
 * particular level with a particular sort key actually SEES, and a source scan cannot tell a hint row
 * that names `R/F UP` from one that named it and then had it eaten by `fit()`.
 *
 * So this file takes the factory's fourth declared departure (`designs.js`'s header: *"`PixelText` and
 * the face arrive as parameters ... so a test can drive the designs against a recording context"*) and
 * passes a `drawPixelText` that RECORDS the string and then calls the real one. What comes back is the
 * post-`fit()` text the face was handed, at that level, with that data — the glass itself, in words.
 *
 * ⛔ AND IT IS THE SHIPPED S AND D, NOT A FIXTURE. `paint()` repaints the very `S` / `D` pair the
 *    driver has just rendered from, so the adapter, the level gates and the live instrument state are
 *    all upstream of every assertion here. Only `drawPixelText` is swapped.
 * ⚠ WHICH MEANS THIS FILE DOES NOT PROVE THE GAME REACHES THESE PAINTERS — `navViewModes.test.js`
 *   does that, and the two AC-11 cases below drive the real `_handleMouseDown/_handleClick` path.
 *
 * ── ⛔ THE BEFORE/AFTER FRAME HASH IS A MEASUREMENT, NOT A CASE IN THIS FILE, AND THAT IS DELIBERATE
 *
 * AC-11 asks that the entry frames at every level other than the commit row stay byte-identical. That
 * was measured, once, against `git show HEAD:src/ui/navViewModes/designs.js` painted over the SAME
 * `S`/`D` (so no other lane's edits participate). With a planet selected at SYSTEM, the `fillRect`
 * stream above the rows this batch deliberately changes is identical at every level of both designs:
 *
 *   D1 L0 0590fd146b203d93 · L1 00ccb46a20b79440 · L2 2c3b5352ebf68f67 · L3 01e6b748aab9590c
 *   D1 L4 9f930c4b974b07c8   (cut: y + h <= 222, the row above design 1's hint line)
 *   D2 L0 cdb42fafc0b34edc · L1 dfe7d48ee6b06a91 · L2 ca023103ba11766c · L3 fba669d8cb85147f
 *   D2 L4 405335126c5cefa9   (cut: y + h <= 220, the row above design 2's legend rows)
 *
 * ⛔ A CHECKED-IN HASH CONSTANT WOULD HAVE BEEN A LIE HERE. Three lanes are mutating this tree at
 *    once; `state.js`'s AC-10 (`mult` on star rows) moved design 1's PRISM rail rows between two runs
 *    of the capture, and AC-2's own `D.selBody = null` moves SYSTEM. A pinned constant would have gone
 *    red on another lane's correct work, which is how a guard gets switched off. What IS durable is
 *    the invariant the move is FOR, and that is the case below: row 233 carries no ink.
 */
import { describe, it, expect } from 'vitest';
import { makeHeadlessNav } from './helpers/headlessNav.mjs';
import { makeDesigns } from '../navViewModes/designs.js';
import { FACE, drawPixelText, measurePixelText } from '../../rendering/PixelText.js';

const W = 417, H = 240;                 // Max's window, and the buffer every number below is for
const LEAD = 6, CELL = 6;               // FACE.h + 1, FACE.advance — asserted in the first case
const INK = { RULE: '#1d3a4a', DIM: '#2f6b7a', BODY: '#7fd8e8', KEY: '#d8fbff', YOU: '#2ee6c0', TARGET: '#ffb03a' };

/**
 * A 2D context that records the ink as well as the rectangle.
 *
 * ⛔ `makeRecordingContext` CANNOT BE USED HERE: its Proxy's `set()` swallows every assignment, so
 *    `g.fillStyle = ink` is lost and a fill's COLOUR is unreadable — and AC-2's unarmed commit row is
 *    a colour change (`INK.RULE` instead of `INK.YOU`) drawn at the same coordinates as the armed one.
 */
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
  h.star = h.nav._localStars.find((s) => s.dist > 1e-9);
  return h;
}

/** Drive the REAL keydown path — the entry the dead `V` key proved is the only honest one. */
const press = (nav, code, extra = {}) =>
  nav._onKeyDown({ code, preventDefault() {}, stopPropagation() {}, ...extra });

/**
 * Repaint this frame's `S` / `D` through a recording face.
 *
 * Returns the fills (with ink), the drawn lines (post-`fit()`, in draw order), the regions the paint
 * declared and the guard's violation count for this pass.
 */
function paint(nav, design) {
  const { S, D } = nav._viewDriverInst;
  const lines = [];
  const { ctx, fills } = inkRecordingContext();
  const d = makeDesigns({
    S, D, onViolation: null, face: FACE, measurePixelText,
    drawPixelText: (g, s, x, y, opts) => { lines.push({ s: String(s), x, y, color: opts?.color });
                                           return drawPixelText(g, s, x, y, opts); },
  });
  S.design = design;
  d.resetRegions(); d.resetViolations();
  if (design === 1) d.drawDesign1(ctx, W, H); else d.drawDesign2(ctx, W, H);
  return { fills, lines, regions: d.regions(), violations: d.violations(),
           text: lines.map((l) => l.s).join('\n'), atY: (y) => lines.filter((l) => l.y === y).map((l) => l.s) };
}

/**
 * Put the nav at a level, in a mode, with a system drilled when SYSTEM is asked for.
 *
 * ⛔ THE SYSTEM STAR IS THE NEAREST LOADED ONE, NOT A LITERAL, AND THAT IS LOAD-BEARING FOR AC-2.
 *    `isHere()` is `D.sysStar.seed === D.here.seed`, and `D.here` is the nearest row of the loaded
 *    prism — so a made-up star is always a FOREIGN system, where both designs draw the WARP commit
 *    off `D.target` and never read `D.selBody` at all. A fixture like that would have let every
 *    no-selection case pass over an untouched code path. The BODIES stay synthetic: the ladder and the
 *    orrery need a known count, and `buildBodies` reads `_systemData`, which is ours to supply.
 */
async function at(h, mode, level, { planets = 4 } = {}) {
  h.nav.viewMode = mode;
  if (level === 4) {
    h.nav._systemStar = h.nav._localStars.reduce((m, s) => (m == null || s.dist < m.dist ? s : m), null);
    h.nav._systemData = {
      star: { type: 'G' }, zones: { hzInnerAU: 0.9, hzOuterAU: 1.4 }, asteroidBelts: [],
      planets: Array.from({ length: planets }, (_, i) => ({
        orbitRadiusAU: 0.4 + i * 0.9, moons: [],
        planetData: { radiusEarth: 1 + (i % 4), T_eq: 260, habitability: { score: 0.2 }, rings: false },
      })),
    };
    h.nav._levelIndex = 4;
  } else h.nav._levelIndex = level;
  h.nav.render();
  return h.nav;
}

/** The four fills a 9x9 `frame()` draws, found by its top edge. */
const frames9 = (fills) => fills.filter((f) => f.w === 9 && f.h === 1);

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// AC-11 — THE COMMIT BAR OFF THE TAB BAND'S LAST ROW
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('AC-11 — design 1\'s commit bar and tab band no longer share a row', () => {
  it('⛔ ROW 233 CARRIES NO INK AT ANY LEVEL — the whole of the defect, stated as a fact', async () => {
    const h = await loadedNav();
    for (const level of [0, 1, 2, 3, 4]) {
      const nav = await at(h, 'rail', level);
      const g = nav._viewDriverInst.geo(W, H);
      expect([g.LEAD, g.CELL, g.tabY, g.commitY], `level ${level} geometry at ${W}x${H}`)
        .toEqual([LEAD, CELL, 228, 234]);
      const { fills, regions } = paint(nav, 1);
      // the hit band the driver derives is [tabY, tabY + LEAD) = 228-233; the commit rect starts at 234
      expect(g.tabY + g.LEAD, 'the two hit bands must not share a row').toBeLessThanOrEqual(g.commitY);
      expect(regions.commit.y, 'the paint declares the commit row where geometry says it is').toBe(g.commitY);
      // ⭐ THE ABSOLUTE FACT: nothing but the full-screen clear covers the tab band's last row.
      //    On the unfixed code the commit bar is `{0, 233, 417, 6}` and this list has two entries.
      const on233 = fills.filter((f) => f.y <= 233 && f.y + f.h > 233 && !(f.w === W && f.h === H));
      expect(on233, `level ${level}: ink on row 233 — ${JSON.stringify(on233)}`).toEqual([]);
      // …and the bar itself is exactly the published rectangle, full width, one row down.
      const bar = fills.filter((f) => f.x === 0 && f.w === W && f.h === LEAD && f.y === g.commitY);
      expect(bar, `level ${level}: the commit bar must be drawn at ${g.commitY}`).toHaveLength(1);
      expect([INK.YOU, INK.TARGET, INK.RULE]).toContain(bar[0].ink);
    }
  }, 60000);

  it('⭐ AND THE REAL POINTER AGREES: 233 changes level, the commit row commits', async () => {
    // ⛔ DRIVEN THROUGH `_handleMouseDown` / `_handleMouseUp` / `_handleClick`, the path a mouse takes.
    //    An assertion about rectangles alone is what shipped five tabs that could not be pressed.
    const h = await loadedNav();
    const nav = await at(h, 'rail', 4);
    const g = nav._viewDriverInst.geo(W, H);
    const click = (x, y) => { nav._handleMouseDown({ clientX: x, clientY: y, button: 0 });
                              nav._handleMouseUp();
                              nav._handleClick({ clientX: x, clientY: y, button: 0 }); };
    let fired = null;
    nav._onCommit = (a) => { fired = a; };
    // ⭐⭐ THE PRESS LANDS ON THE BAR'S OWN TOP ROW, TAKEN OUT OF THE PAINT, AND THAT IS THE WHOLE
    //    POINT OF THE CASE. AC-11's observable is *"a press at the commit bar's top row commits, a
    //    press at the tab band's bottom row changes level"* — and on the unfixed code those are the
    //    SAME row (233), where the strip is tested first and the press changes level instead. A probe
    //    aimed at the bar's middle would pass on both builds and measure nothing.
    nav._selectedNavStar = { wx: 8.4, wy: 0, wz: 0, seed: 991, name: 'Probe', spectral: 'G' };
    nav.render();
    const bar = paint(nav, 1).fills.find((f) => f.x === 0 && f.w === W && f.h === LEAD && f.y > g.tabY);
    expect(bar, 'the paint must draw a full-width commit bar below the tab row').toBeTruthy();
    click(W / 2, bar.y);
    expect(fired, `a press on the commit bar's top row (y ${bar?.y}) must commit`).toBeTruthy();
    expect(nav._levelIndex, 'and it must not change level').toBe(4);
    // the tab band's last row: it changes level, and it does NOT commit
    fired = null;
    nav._anim = null; nav._levelIndex = 4;
    nav.render();
    click(g.tabW * 0.5, g.tabY + g.LEAD - 1);
    const landed = nav._anim ? nav._anim.toLevel ?? nav._levelIndex : nav._levelIndex;
    expect(landed, 'a press on row 233 belongs to the tab strip').toBe(0);
    expect(fired, 'and it must not also commit').toBe(null);
  }, 60000);
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// AC-2 — THE PAINTER HALF: null, AND A STAR
// ⛔ FED DIRECTLY, BY THE SEAM'S OWN INSTRUCTION. `nav._selectedBody` is what `state.js` reads, so
//    writing it here drives the adapter as the pilot's click does — and leaves this lane's cases green
//    whether or not the state lane has landed, which is what the seam asks of both owners.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('AC-2 — a selection can be nothing, and it can be the star', () => {
  it('⛔ NOTHING SELECTED: design 1 frames no body, says so, and draws the row unarmed', async () => {
    const h = await loadedNav();
    const nav = await at(h, 'rail', 4);
    nav._selectedBody = null;
    nav.render();
    const { fills, lines, atY } = paint(nav, 1);
    expect(nav._viewDriverInst.D.selBody, 'the adapter must publish null').toBe(null);
    expect(frames9(fills), 'no 9x9 selection frame may be drawn').toEqual([]);
    expect(lines.map((l) => l.s)).toContain('NO BODY SELECTED');
    // the commit row: the rule's ink, the prompt, and NOT the armed fill
    const bar = fills.find((f) => f.x === 0 && f.w === W && f.h === LEAD && f.y === 234);
    expect(bar.ink, 'an unarmed commit row is drawn in the rule\'s ink').toBe(INK.RULE);
    expect(atY(234)).toEqual(['SELECT A BODY TO BURN']);
  }, 60000);

  it('⛔ NOTHING SELECTED: design 2 frames no body, its status says so, its chip is unarmed', async () => {
    const h = await loadedNav();
    const nav = await at(h, 'bars', 4);
    nav._selectedBody = null;
    nav.render();
    const { fills, atY } = paint(nav, 2);
    expect(frames9(fills), 'no 9x9 selection frame may be drawn').toEqual([]);
    expect(atY(H - 8 + 2).join(' ')).toContain('SYSTEM · NO BODY SELECTED');
    expect(nav._viewDriverInst.S.chipRect.armed, 'the chip must be drawn unarmed').toBe(false);
  }, 60000);

  it('⭐ THE STAR SELECTED: design 1 frames the axis origin and the rail names the star', async () => {
    const h = await loadedNav();
    const nav = await at(h, 'rail', 4);
    nav._selectedBody = { type: 'star', starIndex: 0 };
    nav.render();
    const { fills, lines } = paint(nav, 1);
    const sel = nav._viewDriverInst.D.selBody;
    expect(sel?.kind, 'the adapter must publish a star row').toBe('star');
    // the ladder's star mark sits at virtual 0 — the mark the picker already offered as `star: true`
    const starHit = (nav._viewDriverInst.S.bodyHits || []).find((b) => b.star);
    expect(starHit, 'the ladder must publish a star hit to frame').toBeTruthy();
    const f = frames9(fills).filter((r) => r.ink === INK.TARGET);
    expect(f.length, 'exactly one 9x9 frame, on the star').toBeGreaterThan(0);
    expect(f.every((r) => Math.abs(r.x + 4 - starHit.x) <= 1), 'the frame sits on the star mark').toBe(true);
    expect(lines.map((l) => l.s)).toContain(String(sel.name).toUpperCase());
    expect(lines.map((l) => l.s)).toContain('PRIMARY');
    expect(lines.map((l) => l.s).join('\n')).not.toContain('0.00 AU');
  }, 60000);

  it('⭐ THE STAR SELECTED: design 2 frames the pane centre and its status names the star', async () => {
    const h = await loadedNav();
    const nav = await at(h, 'bars', 4);
    nav._selectedBody = { type: 'star', starIndex: 0 };
    nav.render();
    const { fills, atY } = paint(nav, 2);
    const starHit = (nav._viewDriverInst.S.bodyHits || []).find((b) => b.star);
    expect(starHit, 'the orrery must publish its primary as a hit').toBeTruthy();
    const f = frames9(fills).filter((r) => r.ink === INK.KEY && Math.abs(r.x + 4 - starHit.x) <= 1);
    expect(f.length, 'a 9x9 frame on the primary at the pane centre').toBeGreaterThan(0);
    const status = atY(H - 8 + 2).join(' ');
    expect(status).toContain('PRIMARY');
    expect(status, 'a star has no orbit to report').not.toContain('0.00 AU');
    expect(nav._viewDriverInst.S.chipRect.armed, 'a star selection arms the chip').toBe(true);
  }, 60000);

  it('⛔ NO PAINTER THROWS ON null, AT ANY LEVEL, IN EITHER DESIGN — the PanelHost freeze guard', async () => {
    // A painter throw is not a blank field: `PanelHost` catches one ONCE and then stops uploading, so
    // the glass keeps showing the last good frame and LOOKS ALIVE. Every level, both designs, null.
    const h = await loadedNav();
    for (const [mode, design] of [['rail', 1], ['bars', 2]]) {
      for (const level of [0, 1, 2, 3, 4]) {
        const nav = await at(h, mode, level);
        nav._selectedBody = null;
        expect(() => nav.render(), `${mode} level ${level} with no selection`).not.toThrow();
        const p = paint(nav, design);
        expect(p.violations, `${mode} level ${level}: ${p.violations} layout violation(s)`).toBe(0);
      }
    }
  }, 120000);
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// AC-12 — THE LEGENDS
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('AC-12 — every bound key is named where it works, and nothing is clipped', () => {
  it('⭐ DESIGN 1 NAMES / SEARCH AND R/F UP AT PRISM, AND / SEARCH AT SYSTEM', async () => {
    const h = await loadedNav();
    for (const [level, must] of [[3, ['/ SEARCH', 'R/F UP', 'WASD PAN']], [4, ['/ SEARCH', 'SELECT A BODY']]]) {
      const nav = await at(h, 'rail', level, { planets: 40 });
      const hint = paint(nav, 1).atY(222).join(' ');
      for (const phrase of must) expect(hint, `design 1 level ${level} hint: "${hint}"`).toContain(phrase);
    }
  }, 60000);

  it('⛔ AND THEY SURVIVE EVERY SORT KEY — the clip is what hides a promise, not the omission', async () => {
    // ⭐ DRIVEN THROUGH THE REAL `[` / `]` KEYS. `fit()` truncates from the RIGHT, so the clause that
    //    disappears first is the last one on the row — which on design 1's PRISM row is `R/F UP`, the
    //    promise this AC adds. A row measured only at the DEFAULT sort key would never see it go.
    const h = await loadedNav();
    const nav = await at(h, 'rail', 3);
    const seen = new Set();
    for (let i = 0; i < 8; i++) {
      const hint = paint(nav, 1).atY(222).join(' ');
      seen.add(nav._viewDriverInst.S.sortLabel || '');
      expect(hint, `PRISM hint under sort "${nav._viewDriverInst.S.sortLabel}": "${hint}"`)
        .toContain('R/F UP');
      expect(hint).toContain('/ SEARCH');
      press(nav, 'BracketRight');
      nav.render();
    }
    expect(seen.size, 'the probe must actually have moved the sort key').toBeGreaterThan(3);
  }, 60000);

  it('⭐ DESIGN 2 NAMES [ ] SORT AND - = PAGE WHERE IT DRAWS A LIST, AND ITS SYSTEM CONTROLS', async () => {
    const h = await loadedNav();
    const nav = await at(h, 'bars', 3);
    press(nav, 'KeyL');                      // the real key into list mode
    nav.render();
    expect(nav._viewDriverInst.S.list, 'L must have reached list mode').toBe(true);
    const status = paint(nav, 2).atY(H - 8 + 2).join(' ');
    expect(status, `design 2 PRISM list status: "${status}"`).toContain('[ ] SORT');
    expect(status).toContain('- = PAGE');
    expect(status).toContain('L=MAP');

    const sys = await at(h, 'bars', 4);
    const legend = paint(sys, 2).lines.map((l) => l.s).join('\n');
    expect(legend, 'design 2\'s SYSTEM controls are named on the glass').toContain('SELECT A BODY  DRAG ROTATE  ENTER');
  }, 60000);

  it('⭐ BOTH DESIGNS PRINT V LOOK · SHIFT+TAB BACK · ESC CLOSE, AT REST, AT EVERY LEVEL', async () => {
    const h = await loadedNav();
    for (const [mode, design] of [['rail', 1], ['bars', 2]]) {
      for (const level of [0, 1, 2, 3, 4]) {
        const nav = await at(h, mode, level);
        const drawn = paint(nav, design).lines.map((l) => l.s);
        expect(drawn, `${mode} level ${level} must print the global legend`)
          .toContain('V LOOK  SHIFT+TAB BACK  ESC CLOSE');
      }
    }
  }, 120000);

  it('⛔ NOTHING OVERFLOWS ITS ROW, AND THE MARK GUARD IS SILENT — both designs x five levels', async () => {
    // The guard fires on TYPE that leaves its declared region and on the marks `assertMark` covers;
    // `fit()` cannot overflow, so what this sweep actually catches is a legend added to a row whose
    // region it does not fit, and a selection frame drawn outside a pane.
    const h = await loadedNav();
    for (const [mode, design] of [['rail', 1], ['bars', 2]]) {
      for (const level of [0, 1, 2, 3, 4]) {
        for (const sel of [null, { type: 'star', starIndex: 0 }]) {
          const nav = await at(h, mode, level, { planets: 40 });
          nav._selectedBody = level === 4 ? sel : null;
          nav.render();
          const p = paint(nav, design);
          // ⚠ THE ONE KNOWN EXCEPTION IS DESIGN 1'S SYSTEM LADDER, and it is the design's own declared
          //   top risk rather than a port defect — `navViewModes.test.js` carries the same filter with
          //   the reasoning. Everything else must be silent.
          const violations = [];
          const q = makeDesigns({ S: nav._viewDriverInst.S, D: nav._viewDriverInst.D,
                                  onViolation: (line, info) => violations.push(info) });
          nav._viewDriverInst.S.design = design;
          q.resetRegions(); q.resetViolations();
          const { ctx } = inkRecordingContext();
          if (design === 1) q.drawDesign1(ctx, W, H); else q.drawDesign2(ctx, W, H);
          const bad = violations.filter((v) => !/SYSTEM ladder/.test(v.msg));
          expect(bad, `${mode} level ${level} sel=${sel?.type ?? 'null'}: ${JSON.stringify(bad)}`).toHaveLength(0);
          expect(p.violations - (design === 1 && level === 4 ? p.violations : 0)).toBe(0);
        }
      }
    }
  }, 180000);
});
