/**
 * nav-restorations-2026-09-20 — WAVE 1b, THE LAB LANE: AC-1, AC-7 and AC-8.
 *
 * Three more of the eleven restorations land in `nav-240p-lab.html` and reach the game through
 * `scripts/extract-nav-designs.mjs` (`--check` is the audit that the two have not parted):
 *
 *   AC-1  hover-inspect on every screen — one plated callout beside the pointer, inside the map
 *         pane, carrying legacy's own tooltip content for whatever `S.hover` is holding: the sector
 *         name at GALAXY (NavComputer.js:1856), the tile's kpc pair at SECTOR/REGION (:1677), the
 *         star block at PRISM (:2200) and the body callout at SYSTEM (:2858). The DRIVER built the
 *         `S.hover` half in wave 1a; this is the paint.
 *   AC-7  body names on design 1's ladder (beside the letter) and design 2's orrery (in place of the
 *         roman numeral), placed by the shared `placeLabel` solver, selected > ship > belt > AU.
 *   AC-8  belt names — ASTEROID BELT / KUIPER BELT — on both pictures, and the star's fact line
 *         (`<class> · N planets · N.N Gyr`, NavComputer.js:966-969) in design 1's detail block and
 *         design 2's status line wherever they said NO BODY SELECTED.
 *
 * ── ⭐ HOW THIS FILE READS THE GLASS ────────────────────────────────────────────────────────────
 *
 * The same two instruments wave 1a used and `navDefects2026.design.test.js:75-116` explains at
 * length: an ink RECORDING CONTEXT (a Proxy whose `set` is honoured, so a fill's colour survives)
 * and a `drawPixelText` WRAPPER that records the post-`fit()` string the face was handed. Every
 * string in these designs is drawn as fillRects, so without the wrapper `rec.text` is empty however
 * much writing is on the screen.
 * ⛔ IT IS THE SHIPPED `S` / `D`, NOT A FIXTURE. `paint()` repaints the very pair the driver has just
 *    rendered from, so the adapter, the pickers and the level gates are upstream of every assertion.
 *
 * ── ⛔ THE SYSTEM IS SUPPLIED, AND IT HAS TO BE ─────────────────────────────────────────────────
 *
 * `makeHeadlessNav` stands the pilot at x = 8 kpc, where the nearest loaded star resolves to a
 * system with no belts at all — and AC-8 is entirely about belts. `SYSTEM_DATA` below is handed to
 * `nav._systemData`, which is the field `state.js`'s `buildBodies` reads, so the rows arrive through
 * the shipped adapter exactly as the game builds them. Eight planets, moons on five of them, a main
 * belt at 2.7 AU and an outer belt at 44 AU — the two cases AC-8's label has to tell apart.
 *
 * ── ⛔ `isKuiper` IS DROPPED BY THE GAME'S BODY-LIST BUILDER, AND THAT IS REPORTED, NOT PAPERED OVER ─
 *
 * The generator sets `belt.isKuiper` (`StarSystemGenerator.js:769`, `SolarSystemData.js:875`) and
 * legacy's label reads it (`NavComputer.js:2644`), but neither flat-list builder copies it across:
 * the lab's `buildSystem` now does, `state.js:645`'s does not (DRIVER's file, reported to the
 * coordinator). So `beltLabel()` reads the flag when it is there and otherwise answers from the
 * generator's own geometry — the outer belt is the one beyond every planet. THIS SUITE EXERCISES THE
 * FALLBACK, because the fixture's flag is thrown away on its way through `buildBodies`; the flag
 * path has its own case below, driven through a row the painter is handed directly.
 *
 * ── ⛔ THE BEFORE/AFTER FRAME HASH IS A MEASUREMENT, NOT A CONSTANT IN THIS FILE ────────────────
 *
 * FNV-1a over the whole fillRect stream (coordinates and ink), 417x240, both designs, five levels,
 * painted over the SAME `S`/`D` by HEAD's `designs.js` and by this wave's, pointer outside the pane:
 *
 *   D1 L0 5fef3d04 · L1 57057542 · L2 161c4bb5 · L3 00b85a16      IDENTICAL
 *   D1 L4 b5dbc8e9 → (changed)    names on the ladder, belt labels, the star line in the rail
 *   D2 L0 7732510f · L1 d3d52f9f · L2 fdd2f7ba · L3 7747a724      IDENTICAL
 *   D2 L4 e1a55c29 → (changed)    names on the orrery, belt labels, the star line on the bar
 *
 * i.e. SYSTEM in both designs and nothing else, and AC-1 adds nothing anywhere while the pointer is
 * off a mark. A checked-in hash is NOT the guard, for the reason both earlier waves give: three
 * lanes are mutating this tree at once and a hash that goes red on another lane's correct work is a
 * guard that gets switched off. What is durable is the INVARIANT the measurement is for — that the
 * callout adds no ink on empty map at any level — and that is the `⛔ ON EMPTY MAP` case below,
 * which hashes the frame twice inside one run and needs no constant.
 */
import { describe, it, expect } from 'vitest';
import { makeHeadlessNav, hoverAt, clickAt } from './helpers/headlessNav.mjs';
import { makeDesigns } from '../navViewModes/designs.js';
import { FACE, drawPixelText, measurePixelText } from '../../rendering/PixelText.js';

const W = 417, H = 240;                 // Max's window, and the buffer every number here is for

/** A 2D context that records each fill's RECTANGLE AND ITS INK — wave 1a's own note says why. */
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

/** FNV-1a over the whole fill stream, coordinates AND ink — one number per frame. */
function frameHash(fills) {
  let h = 0x811c9dc5;
  for (const f of fills) {
    for (const c of `${f.x},${f.y},${f.w},${f.h},${f.ink};`) {
      h ^= c.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0;
    }
  }
  return h.toString(16).padStart(8, '0');
}

/** Repaint this frame's `S` / `D` through a recording face, and keep the designs object. */
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
  return { fills, lines, viol, violations: d.violations(), regions: d.regions(), d, S, D,
           hash: frameHash(fills), text: lines.map((l) => l.s).join('\n') };
}

/**
 * ⛔ EIGHT PLANETS, TWO BELTS, AND THE OUTER ONE PAST THE LAST PLANET — every clause of AC-7 and
 *    AC-8 needs one of those. A ringed giant and a moon-rich one are there for the callout's
 *    `RINGED` and `N MOONS` lines; the habitable third planet is there because the rail's detail
 *    block colours it and the orrery draws a cross on it, so the label solver has to place around a
 *    mark that is wider than the sprite.
 */
const SYSTEM_DATA = {
  star: { type: 'G', radiusSolar: 1.0 }, ageGyr: 4.6, isBinary: false,
  zones: { hzInnerAU: 0.9, hzOuterAU: 1.4 },
  asteroidBelts: [{ centerRadiusAU: 2.7, widthAU: 1.2 }, { centerRadiusAU: 44, widthAU: 20, isKuiper: true }],
  planets: [0.39, 0.72, 1.0, 1.52, 5.2, 9.5, 19.2, 30.1].map((au, i) => ({
    orbitRadiusAU: au, orbitAngle: i * 0.8,
    moons: Array.from({ length: i >= 4 ? 3 : (i === 2 ? 1 : 0) },
                      () => ({ type: 'rock', radiusEarth: 0.2, T_eq: 100 })),
    planetData: { radiusEarth: i >= 4 ? 6 + i : 1, T_eq: 400 - i * 40,
                  type: i >= 4 ? 'gas giant' : 'rocky',
                  habitability: { score: i === 2 ? 0.9 : 0.1 }, rings: i === 5 },
  })),
};

/** A nav with the prism loaded — every design needs it before it can draw anything real. */
async function loadedNav() {
  const h = await makeHeadlessNav({ width: W, height: H });
  h.nav._viewModesEnabled = true;
  h.nav._levelIndex = 3;
  h.nav.viewMode = 'rail';
  h.nav.render();
  return h;
}

/**
 * Put the nav at a level, in a mode, with `SYSTEM_DATA` drilled when SYSTEM is asked for.
 *
 * ⛔ AND THE PILOT STANDS ON THE SYSTEM STAR, the same way `navDefects2026.design.test.js:128-150`
 *    does: `isHere()` is the HOST's `_isCurrentSystem()`, a 0.1 pc identity test against
 *    `_playerX/Y/Z`, so a nearest star a parsec away is a FOREIGN system and every no-selection case
 *    below would pass over the wrong branch of the commit chip.
 * ⛔ THE POINTER IS PARKED OUTSIDE THE PANE. `render()` resolves the hover from `_mouseX`/`_mouseY`,
 *    so a stale position left by a previous case would give the very first frame of the next one a
 *    callout — and half of AC-1's proof is a frame that has none.
 */
async function at(h, mode, level, { system = SYSTEM_DATA } = {}) {
  h.nav.viewMode = mode;
  if (level === 4) {
    h.nav._systemStar = h.nav._localStars.reduce((m, s) => (m == null || s.dist < m.dist ? s : m), null);
    if (h.nav._systemStar) {
      h.nav._playerX = h.nav._systemStar.wx; h.nav._playerY = h.nav._systemStar.wy;
      h.nav._playerZ = h.nav._systemStar.wz;
    }
    h.nav._systemData = system;
    h.nav._levelIndex = 4;
  } else h.nav._levelIndex = level;
  h.nav._mouseX = -99; h.nav._mouseY = -99;
  h.nav.render();
  return h.nav;
}

/** Clear the selection through the field `state.js` mirrors, then re-render so `D.selBody` follows. */
function clearSelection(nav) {
  nav._selectedBody = null; nav._commitAction = null; nav.render();
  return nav;
}

/** The strings drawn inside a named region this frame. */
const inRegion = (p, name) => {
  const r = p.regions[name];
  return p.lines.filter((l) => r && l.x >= r.x && l.x < r.x + r.w && l.y >= r.y && l.y < r.y + r.h);
};

/**
 * Sweep the map pane for a point that hovers SOMETHING and a point that hovers NOTHING.
 *
 * ⛔ THE POINTER IS DRIVEN, NOT THE PICKER. `hoverAt` runs `_handleMouseMove` and then a whole
 *    `render()`, which is what publishes `S.hover` at the driver's own tail — so what comes back is
 *    the frame's answer, not a re-implementation of it. The step is coarse on purpose: each probe is
 *    a full nav render, and a 1-texel sweep of a 252x200 pane is fifty thousand of them.
 */
function sweep(nav, rgn) {
  let found = null, empty = null;
  for (let y = rgn.y + 2; y < rgn.y + rgn.h - 2 && (!found || !empty); y += 7) {
    for (let x = rgn.x + 2; x < rgn.x + rgn.w - 2 && (!found || !empty); x += 11) {
      hoverAt(nav, x, y);
      const hv = nav._viewDriverInst.S.hover;
      if (hv && !found) found = { x, y, kind: hv.kind };
      if (!hv && !empty) empty = { x, y };
    }
  }
  return { found, empty };
}

const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/**
 * The CALLOUT's own rows, in order — not "every string that happens to lie inside its rectangle".
 *
 * ⛔ THE DIFFERENCE IS REAL AND IT COST A RED RUN. The callout is drawn LAST on the map, so its
 *    knockout plate covers whatever AC-7 labels were underneath; those labels are still in the draw
 *    stream, EARLIER, at coordinates inside the plate — measured: `HEMYAN` sat inside a body
 *    callout's box and a naive rectangle filter read it as the callout's first line. The rows are
 *    identified by their geometry instead: left edge `rect.x + 1` (the plate is laid one texel out
 *    from the glyphs) and a `FACE.h + 1` ladder from `rect.y + 1`, LAST DRAWN WINNING — which is
 *    exactly the rule the glass itself applies.
 */
function calloutText(p) {
  const r = p.S.hoverCalloutRect;
  if (!r) return [];
  const LEAD = FACE.h + 1, out = [];
  for (let i = 0; r.y + 1 + i * LEAD + FACE.h <= r.y + r.h; i++) {
    const y = r.y + 1 + i * LEAD;
    const row = p.lines.filter((l) => l.x === r.x + 1 && l.y === y);
    if (!row.length) break;
    out.push(row[row.length - 1].s);
  }
  return out;
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// AC-8 — BELT NAMES, AND THE STAR'S LINE WHERE "NOTHING IS SELECTED" USED TO BE
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('AC-8 — belt names and the star line', () => {
  it('⛔ BOTH BELTS ARE NAMED ON BOTH PICTURES, AND THE OUTER ONE IS THE KUIPER BELT', async () => {
    // ⭐ THE ABSOLUTE FACT: the two strings are in the text stream at a texel position INSIDE the map
    //    pane — not merely "somewhere on the glass", which the rail's `BELT A` row would satisfy.
    // ⛔ MUTANT `beltLabel-always-asteroid` — delete the flag test and the geometric fallback and
    //    return 'ASTEROID BELT': KUIPER BELT disappears from both designs and this case goes red on
    //    the first `toContain`.
    const h = await loadedNav();
    for (const [mode, design] of [['rail', 1], ['bars', 2]]) {
      const nav = await at(h, mode, 4);
      const p = paint(nav, design);
      const onMap = inRegion(p, 'map').map((l) => l.s);
      expect(onMap, `design ${design}: the main belt's label on the map`).toContain('ASTEROID BELT');
      expect(onMap, `design ${design}: the outer belt's label on the map`).toContain('KUIPER BELT');
      expect(p.violations, `design ${design}: the mark guard must stay silent`).toBe(0);
    }
  }, 120000);

  it('⛔ THE GENERATOR\'S OWN FLAG WINS OVER THE GEOMETRY WHEN IT IS THERE', async () => {
    // ⭐ DRIVEN THROUGH THE ROW, because that is the seam: `beltLabel` reads a `D.bodies` row, and the
    //    flag's whole purpose is to answer for a belt the geometry would call wrong — an INNER belt
    //    the generator tagged Kuiper. Mutating the row the painter is handed is the only way to put
    //    that case on the glass at all: this fixture's generator flags no inner belt.
    // ⚠ REWRITTEN IN WAVE 2a, AND THE CHANGE IS THE POINT. When wave 1b wrote this case the builder
    //    DROPPED the flag, so an unflagged belt arrived `undefined` and every belt fell through to the
    //    geometry fallback. AC-8's carry-over (state.js:687, `isKuiper: !!b.isKuiper`) now carries it,
    //    and the `!!` makes the builder's silence an explicit `false` — which is exactly what
    //    `beltLabel`'s `b.isKuiper != null` test needs to tell "the builder said no" from "the builder
    //    never spoke". So the absolute fact here moved from `undefined` to `false`; the case's own
    //    subject — a flag set true beats the geometry — is untouched below.
    // ⛔ MUTANT `beltLabel-ignore-flag` — drop the `isKuiper != null` branch: the inner belt reads
    //    ASTEROID BELT off the geometry and the two-label assertion goes red.
    // ⛔ MUTANT `buildBodies-drop-isKuiper` — delete the field at state.js:687: the row arrives
    //    `undefined` and the `false` assertion goes red (this is the wave-1b behaviour, pinned as gone).
    const h = await loadedNav();
    const nav = await at(h, 'rail', 4);
    const { D } = nav._viewDriverInst;
    const inner = D.bodies.find((b) => b.kind === 'belt');
    expect(inner, 'the fixture must put a belt in D.bodies').toBeTruthy();
    expect(inner.isKuiper, 'the builder carries the flag as a real boolean: an unflagged belt is false, not absent').toBe(false);
    inner.isKuiper = true;
    const p = paint(nav, 1);
    expect(inRegion(p, 'map').map((l) => l.s).filter((s) => s === 'KUIPER BELT').length,
           'the flagged inner belt reads KUIPER BELT, and so does the outer one').toBe(2);
  }, 120000);

  it('⛔ WITH NOTHING SELECTED BOTH DESIGNS PRINT THE STAR LINE, NOT "NO BODY SELECTED"', async () => {
    // ⭐ THE ABSOLUTE FACTS: design 2's bar is one joined string and reads legacy's own sentence;
    //    design 1's rail carries the class on one row and the two numbers on the next.
    // ⛔ MUTANT `sysStarClauses-empty` — return `[]` unconditionally: both designs fall back to
    //    'NO BODY SELECTED' (the branch that is deliberately kept for a system-less glass) and every
    //    assertion below goes red.
    const h = await loadedNav();

    const nav2 = clearSelection(await at(h, 'bars', 4));
    expect(nav2._viewDriverInst.D.selBody, 'the fixture must reach the no-selection state').toBeNull();
    const p2 = paint(nav2, 2);
    const bar = inRegion(p2, 'botbar').map((l) => l.s);
    expect(bar, 'design 2\'s status line carries legacy\'s own sentence').toContain('SYSTEM · G · 8 PLANETS · 4.6 GYR');
    expect(p2.text).not.toContain('NO BODY SELECTED');

    const nav1 = clearSelection(await at(h, 'rail', 4));
    const p1 = paint(nav1, 1);
    const rail = inRegion(p1, 'rail').map((l) => l.s);
    expect(rail, 'design 1\'s detail block: the class on its own row').toContain('G');
    expect(rail, 'design 1\'s detail block: the two numbers on the next').toContain('8 PLANETS · 4.6 GYR');
    expect(p1.text).not.toContain('NO BODY SELECTED');
  }, 120000);

  it('⭐ A BINARY PRINTS BOTH CLASSES, AND IT STILL FITS THE 25-CHARACTER RAIL', async () => {
    // ⛔ MUTANT `sysStarClauses-primary-only` — drop the `isBinary && c2` branch and always return
    //    `c1`: the line reads `G` where it must read `G+M BINARY`, and the first expect goes red.
    const h = await loadedNav();
    const binary = { ...SYSTEM_DATA, isBinary: true, star2: { type: 'M' } };
    const nav = clearSelection(await at(h, 'rail', 4, { system: binary }));
    const p = paint(nav, 1);
    const rail = inRegion(p, 'rail').map((l) => l.s);
    expect(rail, 'the binary class pair').toContain('G+M BINARY');
    // ⭐ THE RAIL IS `railC * CELL - 1` = 149 texels at 417x240; nothing here may be clipped by
    //    `fit()`, which is the departure AC-8's own note says is NOT taken.
    expect(measurePixelText('G+M BINARY')).toBeLessThanOrEqual(149);
    expect(measurePixelText('8 PLANETS · 4.6 GYR')).toBeLessThanOrEqual(149);
    expect(p.violations).toBe(0);
  }, 120000);

  it('⛔ ONCE A BODY IS SELECTED THE BLOCK AND THE BAR SHOW THAT BODY, EXACTLY AS BEFORE', async () => {
    // ⭐ DRIVEN BY A REAL CLICK on a drawn mark, so the selection arrives through the shipped picker.
    // ⛔ MUTANT `star-line-unconditional` — print the star line whether or not `D.selBody` is set:
    //    the planet's own rows lose their slot and `ORBIT` / the AU clause go missing.
    const h = await loadedNav();
    const nav = clearSelection(await at(h, 'bars', 4));
    const hits = (nav._viewDriverInst.S.bodyHits || []).filter((z) => z.ref && z.ref.kind === 'planet' && z.moon < 0);
    expect(hits.length, 'the orrery must have drawn some planets').toBeGreaterThan(0);
    const t = hits[0];
    hoverAt(nav, t.x, t.y);
    clickAt(nav, t.x, t.y);
    nav.render();
    const sel = nav._viewDriverInst.D.selBody;
    expect(sel, 'the click must have selected a body').toBeTruthy();
    const p = paint(nav, 2);
    const bar = inRegion(p, 'botbar').map((l) => l.s).join(' ');
    expect(bar, 'the bar names the selected body').toContain(String(sel.name).toUpperCase());
    expect(bar, 'and prints its orbit, not the star\'s age').toContain(`${sel.au.toFixed(2)} AU`);
    expect(bar).not.toContain('4.6 GYR');
  }, 120000);
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// AC-7 — NAMES ON THE LADDER AND THE ORRERY
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('AC-7 — body names beside the ladder\'s letters and in place of the orrery\'s numerals', () => {
  it('⛔ BOTH PICTURES CARRY REAL NAMES, AND THE LADDER KEEPS ITS AU ORDER AND ITS ONE LETTER', async () => {
    // ⭐ THE ABSOLUTE FACTS, in three parts, because AC-20 of the defects batch is what this AC is
    //    most able to break: (1) at least one `D.bodies` name is drawn inside the map pane in each
    //    design; (2) `S.ladderStops` — published by the paint that drew them — is non-decreasing,
    //    which IS the AU order; (3) design 1 draws exactly one tag per DRAWN stop and every tag is a
    //    single character.
    // ⛔ MUTANT `nameQ-never-drained` — delete the `for (const q of bodyLabelOrder(nameQ))` loop in
    //    `d1Ladder` and the name branch in `d2System`: part (1) goes red in both designs while parts
    //    (2) and (3) stay green, which is the point of asserting all three.
    const h = await loadedNav();
    for (const [mode, design] of [['rail', 1], ['bars', 2]]) {
      const nav = await at(h, mode, 4);
      const { D, S } = nav._viewDriverInst;
      const names = D.bodies.filter((b) => b.kind === 'planet').map((b) => b.name.toUpperCase());
      const onMap = inRegion(paint(nav, design), 'map').map((l) => l.s);
      expect(names.filter((n) => onMap.includes(n)).length,
             `design ${design}: at least one planet name on the picture`).toBeGreaterThan(0);
      if (design === 1) {
        const stops = S.ladderStops || [];
        expect(stops.length, 'the ladder publishes a stop per body').toBe(D.bodies.filter((b) => b.kind !== 'moon').length);
        for (let i = 1; i < stops.length; i++) {
          expect(stops[i], `ladder stop ${i} must not move left of ${i - 1} (AU order, AC-20)`).toBeGreaterThanOrEqual(stops[i - 1]);
        }
        const tags = onMap.filter((s) => s.length === 1 && /[0-9A-Z]/.test(s));
        expect(tags.length, 'one letter per drawn stop').toBe(stops.length);
      }
    }
  }, 120000);

  it('⛔ NO TWO LABELS OVERLAP, AND NO LABEL COVERS A MARK IT DOES NOT NAME', async () => {
    // ⭐ MEASURED OFF THE PUBLISHED PLATES, not off a re-measurement of the strings: `S.labelHits` is
    //    what `plated()` actually drew and what `picking.pickLabel` actually tests, so a label that
    //    overlaps here is a label the pilot sees overlapping AND a click that resolves to the wrong
    //    body. The mark test uses `S.bodyHits`, which the same paint published.
    // ⛔ THE TEST IS PLATE-AGAINST-GLYPHS, AND THE ONE-TEXEL DIFFERENCE IS THE WHOLE POINT. `plated()`
    //    lays `(x-1, y-1, w+2, FACE.h+2)` — SEVEN rows for five rows of glyphs — while `placeLabel`
    //    separates two labels by `FACE.h + 1` = six. So two labels one slot apart ABUT: the lower
    //    plate's top padding row is the upper plate's bottom padding row, both filled with `INK.BG`,
    //    and not one glyph texel is erased. Asserting plate-against-plate would fail on a picture that
    //    is correct (measured: 4 such pairs on design 1's ladder); what AC-7 promises, and what this
    //    asserts, is that NO PLATE ERASES ANOTHER LABEL'S WORDS.
    // ⛔ MUTANT `placeLabel-first-candidate` — return the first candidate from `placeLabel` without
    //    testing `taken` or `marks`: both designs pile labels on each other and on foreign marks, and
    //    the two counts below go non-zero.
    const h = await loadedNav();
    for (const [mode, design] of [['rail', 1], ['bars', 2]]) {
      const nav = await at(h, mode, 4);
      paint(nav, design);
      const { S } = nav._viewDriverInst;
      const labels = (S.labelHits || []).map((z) => ({
        plate: { x: z.x - 1, y: z.y - 1, w: z.w + 2, h: FACE.h + 2 },
        glyphs: { x: z.x, y: z.y, w: z.w, h: FACE.h }, ref: z.ref }));
      expect(labels.length, `design ${design} must have placed some labels`).toBeGreaterThan(0);
      const collisions = [];
      for (let i = 0; i < labels.length; i++) {
        for (let j = 0; j < labels.length; j++) {
          if (i !== j && overlaps(labels[i].plate, labels[j].glyphs)) collisions.push([i, j]);
        }
      }
      expect(collisions, `design ${design}: a label plate erasing another label's glyphs`).toEqual([]);
      const covered = [];
      for (const { plate: L, ref: Lref } of labels.map((z) => ({ plate: z.plate, ref: z.ref }))) {
        for (const m of (S.bodyHits || [])) {
          if (!m.ref || m.ref === Lref) continue;
          const r = Number.isFinite(m.r) && m.r > 0 ? m.r : 3;
          if (overlaps(L, { x: Math.round(m.x) - r, y: Math.round(m.y) - r, w: 2 * r + 1, h: 2 * r + 1 })) {
            covered.push(`${Lref && Lref.name} over ${m.ref.name}`);
          }
        }
      }
      expect(covered, `design ${design}: labels sitting on a foreign mark`).toEqual([]);
    }
  }, 120000);

  it('⭐ THE SELECTED BODY IS NAMED EVEN WHERE IT WOULD OTHERWISE LOSE THE SLOT', async () => {
    // ⭐ THE OUTERMOST PLANET IS CHOSEN ON PURPOSE: with priority by AU it is LAST in the queue, so
    //    on design 1's crowded ladder it is one of the bodies whose name is dropped. Selecting it has
    //    to move it to the front — which is the whole of AC-7's "selected > current > by AU".
    // ⛔ MUTANT `bodyLabelOrder-identity` — return the queue unsorted: the outermost planet stays
    //    last, its name is refused a slot and this case goes red on design 1.
    const h = await loadedNav();
    const nav = await at(h, 'rail', 4);
    const { D } = nav._viewDriverInst;
    const outer = D.bodies.filter((b) => b.kind === 'planet').reduce((m, b) => (b.au > m.au ? b : m));
    const before = inRegion(paint(nav, 1), 'map').map((l) => l.s);
    expect(before, 'the fixture must actually drop the outermost name unselected').not.toContain(outer.name.toUpperCase());
    nav._selectedBody = { type: 'planet', index: outer.pIdx };
    nav.render();
    expect(nav._viewDriverInst.D.selBody, 'the selection must reach D').toBe(outer);
    const after = inRegion(paint(nav, 1), 'map').map((l) => l.s);
    expect(after, 'the selected body is named').toContain(outer.name.toUpperCase());
  }, 120000);

  it('⛔ A NAME PLATE SELECTS THE BODY IT NAMES — the plate is a target, not decoration', async () => {
    // ⭐ DRIVEN BY A REAL CLICK inside the published plate. `picking.pickLabel` is tested BEFORE the
    //    mark list, and these plates publish `kind: 'body'`, so the click must land on the named body
    //    rather than on whatever mark the plate's knockout erased.
    // ⛔ MUTANT `label-kind-name` — publish `kind: 'name'` instead of `'body'`: `pickBody` ignores the
    //    plate, falls through to `nearestHit` and selects a different body (or none), red here.
    const h = await loadedNav();
    const nav = clearSelection(await at(h, 'bars', 4));
    paint(nav, 2);
    const plate = (nav._viewDriverInst.S.labelHits || []).find((z) => z.ref && z.ref.kind === 'planet');
    expect(plate, 'design 2 must have placed a planet name').toBeTruthy();
    const px = plate.x + Math.floor(plate.w / 2), py = plate.y + Math.floor(FACE.h / 2);
    hoverAt(nav, px, py);
    clickAt(nav, px, py);
    nav.render();
    expect(nav._viewDriverInst.D.selBody, 'the click on the plate selects the body it names').toBe(plate.ref);
  }, 120000);
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// AC-1 — THE HOVER CALLOUT, AT EVERY LEVEL IN BOTH DESIGNS
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('AC-1 — hover-inspect on every screen', () => {
  it('⛔ EVERY LEVEL IN BOTH DESIGNS PAINTS ONE CALLOUT BESIDE THE POINTER, INSIDE THE MAP PANE', async () => {
    // ⭐ THE POINTER IS DRIVEN (`hoverAt` → `_handleMouseMove` → a whole `render()`), the pick is the
    //    driver's own, and the assertion is a rectangle: `S.hoverCalloutRect` published by the draw
    //    site, wholly inside `REGIONS.map`, with at least one string drawn inside it.
    // ⛔ TEN CASES IN ONE, DELIBERATELY: AC-1's whole content is "every screen", and a per-level case
    //    that skipped when the sweep found nothing would pass vacuously on the screen that broke.
    // ⛔ MUTANT `hoverCallout-noop` — a bare `return;` at the head of `hoverCallout`: every
    //    one of the ten `toBeTruthy()` calls below goes red.
    const h = await loadedNav();
    for (const [mode, design] of [['rail', 1], ['bars', 2]]) {
      for (const level of [0, 1, 2, 3, 4]) {
        const nav = await at(h, mode, level);
        const rgn = paint(nav, design).regions.map;
        const { found } = sweep(nav, rgn);
        expect(found, `design ${design} level ${level}: the sweep must find something hoverable`).toBeTruthy();
        hoverAt(nav, found.x, found.y);
        const p = paint(nav, design);
        const r = p.S.hoverCalloutRect;
        expect(r, `design ${design} level ${level} (${found.kind}): a callout must paint`).toBeTruthy();
        expect(r.x >= rgn.x && r.y >= rgn.y && r.x + r.w <= rgn.x + rgn.w && r.y + r.h <= rgn.y + rgn.h,
               `design ${design} level ${level}: ${JSON.stringify(r)} inside ${JSON.stringify(rgn)}`).toBe(true);
        expect(calloutText(p).length, `design ${design} level ${level}: words inside the plate`).toBeGreaterThan(0);
        expect(p.violations, `design ${design} level ${level}: the mark guard stays silent while hovered`).toBe(0);
        // ⭐ AND IT NEVER COVERS THE MARK IT NAMES — the pointer that summoned it stays reachable.
        const hv = p.S.hover;
        const mark = { x: Math.round(hv.sx) - 5, y: Math.round(hv.sy) - 5, w: 11, h: 11 };
        expect(overlaps(r, mark), `design ${design} level ${level}: the plate covers its own mark`).toBe(false);
      }
    }
  }, 300000);

  it('⛔ ON EMPTY MAP NOTHING DRAWS — the frame is byte-identical to the frame with no pointer at all', async () => {
    // ⭐ TWO HASHES IN ONE RUN, so there is no checked-in constant to rot: the frame painted with the
    //    pointer parked outside the pane, and the frame painted with the pointer INSIDE the pane on a
    //    point the driver resolved to nothing. AC-1 adds ink only where `S.hover` is non-null, so
    //    those two frames are the same stream of fills or the AC is wrong.
    // ⛔ MUTANT `callout-on-null-hover` — drop the `if (!hv …) return;` guard and draw the plate at
    //    the last known point: the hashes part at every level and this case goes red ten times.
    const h = await loadedNav();
    for (const [mode, design] of [['rail', 1], ['bars', 2]]) {
      for (const level of [0, 1, 2, 3, 4]) {
        const nav = await at(h, mode, level);          // `at` parks the pointer at (-99, -99)
        const base = paint(nav, design);
        // ⭐ THE MARK GUARD'S UNHOVERED HALF. The case above covers all ten screens with a callout on
        //    them; this is the same ten with none, which is the other half of the wave's own bar.
        expect(base.violations, `design ${design} level ${level}: the mark guard, unhovered`).toBe(0);
        const { empty } = sweep(nav, base.regions.map);
        expect(empty, `design ${design} level ${level}: the pane must have an empty point`).toBeTruthy();
        hoverAt(nav, empty.x, empty.y);
        const p = paint(nav, design);
        expect(p.S.hover, `design ${design} level ${level}: the sweep's point must hover nothing`).toBeNull();
        expect(p.S.hoverCalloutRect, `design ${design} level ${level}: no rectangle published`).toBeNull();
        expect(p.hash, `design ${design} level ${level}: the frame must be byte-identical`).toBe(base.hash);
      }
    }
  }, 300000);

  it('⭐ THE PRISM CALLOUT IS LEGACY\'S FOUR LINES, AND SYSTEM\'S IS LEGACY\'S BODY BLOCK', async () => {
    // ⭐ THE CONTENT IS THE ASSERTION HERE, not the rectangle: legacy's star tooltip is name, class,
    //    distance in both units and height above the plane (NavComputer.js:2202-2207), and its planet
    //    callout is type · radius, AU, temperature, moons (:2862-2871).
    // ⛔ MUTANT `calloutLines-name-only` — return `[r.name]` from every branch: the three regex
    //    assertions below go red while the rectangle cases above stay green.
    const h = await loadedNav();

    const navP = await at(h, 'rail', 3);
    const rgnP = paint(navP, 1).regions.map;
    const { found: fp } = sweep(navP, rgnP);
    expect(fp && fp.kind, 'PRISM must hover a star').toBe('star');
    hoverAt(navP, fp.x, fp.y);
    const pp = paint(navP, 1);
    const rp = pp.S.hoverCalloutRect;
    expect(rp, 'a star callout must paint at PRISM').toBeTruthy();
    const linesP = calloutText(pp);
    expect(linesP.length, 'four lines, name first').toBe(4);
    expect(linesP[1], 'the spectral class').toMatch(/^[A-Z?] CLASS$/);
    expect(linesP[2], 'the distance in pc and ly').toMatch(/^\d+\.\d\d PC \(\d+\.\d LY\)$/);
    expect(linesP[3], 'the height above the galactic plane').toMatch(/^-?\d+ PC (ABOVE|BELOW) PLANE$/);

    const navS = await at(h, 'bars', 4);
    const hit = (navS._viewDriverInst.S.bodyHits || []).find((z) => z.ref && z.ref.kind === 'planet' && z.moon < 0);
    expect(hit, 'the orrery must have drawn a planet').toBeTruthy();
    hoverAt(navS, hit.x, hit.y);
    const ps = paint(navS, 2);
    const rs = ps.S.hoverCalloutRect;
    expect(rs, 'a body callout must paint').toBeTruthy();
    const linesS = calloutText(ps);
    // ⛔ THE NAME IS CHECKED AGAINST `S.hover`'s OWN ROW, NOT AGAINST THE MARK THE SWEEP AIMED AT.
    //    `nearestHit` answers with whatever mark is closest to the pointer, and on a crowded orrery
    //    that is not always the one whose published centre was used as the aim point — measured: the
    //    pointer at planet b's texel resolved to Hemyan, one texel nearer. The AC is that the callout
    //    names WHAT IS UNDER THE POINTER, so the hover's row is the honest oracle and the alternative
    //    was a test asserting against its own guess.
    expect(ps.S.hover && ps.S.hover.kind, 'the pointer must be on a body').toBe('body');
    expect(linesS[0], 'the body\'s name').toBe(String(ps.S.hover.ref.row.name).toUpperCase());
    expect(linesS.join('\n'), 'its class and Earth radii').toMatch(/· \d+\.\d R⊕/);
    expect(linesS.join('\n'), 'its orbit').toMatch(/^\d+\.\d\d AU$/m);
    expect(linesS.join('\n'), 'its moon count').toMatch(/^\d+ MOONS?$/m);
  }, 180000);

  it('⛔ THE CALLOUT NEVER REACHES THE RAIL, THE STATUS LINE, THE TABS OR THE COMMIT ROW', async () => {
    // ⭐ THE PLATE RULE, STATED AS A FACT ABOUT EVERY OTHER DECLARED REGION: a callout is clamped
    //    into `REGIONS.map`, so its rectangle may not intersect `rail`, `status`, `hint`, `tabs`,
    //    `commit` (design 1) or `topbar` / `botbar` (design 2).
    // ⛔ MUTANT `callout-unclamped` — drop the `cl(...)` clamp and place the plate at the raw offset:
    //    a mark near the pane's right edge in design 1 pushes the plate into the rail and this goes
    //    red. (The `inside REGIONS.map` assertion above catches it too — this case names the chrome
    //    the AC actually promises, which is what a reader of a red run needs.)
    const h = await loadedNav();
    for (const [mode, design] of [['rail', 1], ['bars', 2]]) {
      const others = design === 1 ? ['status', 'rail', 'hint', 'tabs', 'commit'] : ['topbar', 'botbar'];
      for (const level of [0, 1, 2, 3, 4]) {
        const nav = await at(h, mode, level);
        const p0 = paint(nav, design);
        const { found } = sweep(nav, p0.regions.map);
        expect(found, `design ${design} level ${level}`).toBeTruthy();
        hoverAt(nav, found.x, found.y);
        const p = paint(nav, design);
        const r = p.S.hoverCalloutRect;
        expect(r, `design ${design} level ${level}`).toBeTruthy();
        for (const name of others) {
          expect(overlaps(r, p.regions[name]), `design ${design} level ${level}: callout over ${name}`).toBe(false);
        }
      }
    }
  }, 300000);
});
