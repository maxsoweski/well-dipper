/**
 * nav-restorations-2026-09-20 — WAVE 1, THE LAB LANE: AC-2, AC-3 and AC-9.
 *
 * Three of the eleven restorations land in `nav-240p-lab.html` and reach the game through
 * `scripts/extract-nav-designs.mjs` (`--check` is the audit that the two have not parted):
 *
 *   AC-2  the prism's depth cues — a drop line per mark in two inks, the plane lattice under the
 *         marks, far-to-near draw order; and in design 1 the spectral ink and the catalogue halo.
 *   AC-3  names on design 1's prism marks in place of the eight index digits, and the height
 *         numbers — HEIGHT with its region, PLAYER Y, Y RANGE — in design 1's PRISM detail block
 *         and design 2's PRISM status line.
 *   AC-9  one zoom readout for all three looks: `VIEW <n> LY`, n = round(S.cam.radius * 3260),
 *         which is legacy's own `round(_localRadius * 1000 * 3.26)` (NavComputer.js:4272-4273).
 *
 * ── ⭐ HOW THIS FILE READS THE GLASS ────────────────────────────────────────────────────────────
 *
 * Same two instruments wave 1 of the defects batch built and its header explains at length: an ink
 * RECORDING CONTEXT (a Proxy whose `set` is honoured, so a fill's colour survives) and a
 * `drawPixelText` WRAPPER that records the post-`fit()` string the face was handed. Every string in
 * these designs is drawn as fillRects, so without the wrapper `rec.text` is empty however much
 * writing is on the screen; and without the colour a drop line is indistinguishable from a rule.
 * ⛔ IT IS THE SHIPPED `S` / `D`, NOT A FIXTURE. `paint()` repaints the very pair the driver has
 *    just rendered from, so the adapter and the level gates are upstream of every assertion here.
 *
 * ── ⛔ THE CATALOGUE STARS ARE INJECTED, AND THEY HAVE TO BE ───────────────────────────────────
 *
 * `makeHeadlessNav` stands the pilot at x = 8 kpc, where the loaded prism holds 212 procedural stars
 * and ZERO catalogue rows (`isReal` false on every one — measured). AC-2's halo clause and the whole
 * of AC-3's name clause are about `star.isReal && star.name`, so against that fixture both would
 * pass over a code path that never runs. `withCatalogue()` pushes four real rows into
 * `nav._localStars` — the array `state.js` ranks `D.starRows` from — and the background loader's own
 * growth path then rebuilds the rank around them, which is how the game itself gets them.
 *
 * ── ⛔ THE BEFORE/AFTER FRAME HASH IS A MEASUREMENT, NOT A CONSTANT IN THIS FILE ────────────────
 *
 * FNV-1a over the whole fillRect stream (coordinates and ink), 417x240, both designs, five levels,
 * painted over the SAME `S`/`D` before and after this wave's lab edits:
 *
 *   D1 L0 a47f0157 · L1 41ab86cd · L2 8289eaac · L4 f1030f02      IDENTICAL
 *   D1 L3 bfaf90a6 → daf46369      (AC-2's cues, AC-3's names and the five new detail rows)
 *   D2 L0 0923102e · L1 d29e117e · L2 2fe165a5 · L4 a8758d11      IDENTICAL
 *   D2 L3 771b2052 → 8eb7c2f7      (AC-2's cues, AC-3/AC-9's status line, the new legend row)
 *
 * i.e. PRISM in both designs and nothing else. A checked-in hash is NOT the guard, for the reason
 * both earlier waves give: three lanes are mutating this tree at once and a hash that goes red on
 * another lane's correct work is a guard that gets switched off. What is durable is the INVARIANT
 * the measurement is for — that none of this wave's ink and none of its words exist outside PRISM —
 * and that is the last case below.
 */
import { describe, it, expect } from 'vitest';
import { makeHeadlessNav } from './helpers/headlessNav.mjs';
import { makeDesigns } from '../navViewModes/designs.js';
import { FACE, drawPixelText, measurePixelText } from '../../rendering/PixelText.js';

const W = 417, H = 240;                 // Max's window, and the buffer every number here is for
/** This wave's four new inks, pinned as literals AND cross-checked against the table (first case). */
const NEW = { GRID: '#0f2430', ABOVE: '#1f6b52', BELOW: '#6b2f28', HALO: '#6b4a18' };
const SPECTRAL = { O: '#9db0ff', B: '#abbfff', A: '#c9d6ff', F: '#f7f7ff', G: '#fff5ea',
                   K: '#ffd1a1', M: '#ff9f70', D: '#d9e6ff' };

/** A 2D context that records each fill's RECTANGLE AND ITS INK — the defects batch's own note says why. */
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

/**
 * Four CATALOGUE rows in the loaded prism, near the camera, two above its plane and two below.
 *
 * ⛔ PUSHED INTO `nav._localStars`, NOT HANDED TO THE PAINTER. That array is the one `state.js`
 *    builds `D.starRows` from and the one the background loader grows in place, so the rows arrive
 *    through the same rebuild the game's own loader triggers — `isReal`, `spectral` and `name` all
 *    ride through `{ ...s }` untouched (`state.js:882`).
 * ⚠ `wy` STRADDLES THE CAMERA'S PLANE ON PURPOSE: `projectPrism`'s foot is the star at `S.cam.y`, so
 *   a fixture entirely on one side could not tell the two drop-line inks apart.
 */
const CATALOGUE = [
  { key: 'VEGA',   spectral: 'A', dx:  0.0004, dz:  0.0006, dy:  0.0008 },
  { key: 'SIRIUS', spectral: 'B', dx: -0.0007, dz: -0.0009, dy: -0.0008 },
  { key: 'RIGEL',  spectral: 'O', dx:  0.0011, dz:  0.0004, dy:  0.0009 },
  { key: 'ALTAIR', spectral: 'F', dx: -0.0012, dz:  0.0012, dy: -0.0006 },
];
function withCatalogue(nav) {
  const c = nav._localCenter;
  for (const s of CATALOGUE) {
    nav._localStars.push({ wx: c.x + s.dx, wy: c.y + s.dy, wz: c.z + s.dz,
                           dist: Math.hypot(s.dx, s.dz, s.dy), seed: s.key, name: s.key,
                           spectral: s.spectral, isReal: true, color: '#ffffff' });
  }
  nav.render();
  return nav;
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
           text: lines.map((l) => l.s).join('\n') };
}

/** Put the nav at a level, in a mode, with a system drilled when SYSTEM is asked for. */
async function at(nav, mode, level) {
  nav.viewMode = mode;
  if (level === 4) {
    nav._systemStar = nav._localStars.reduce((m, s) => (m == null || s.dist < m.dist ? s : m), null);
    if (nav._systemStar) { nav._playerX = nav._systemStar.wx; nav._playerY = nav._systemStar.wy; nav._playerZ = nav._systemStar.wz; }
    nav._systemData = {
      star: { type: 'G' }, zones: { hzInnerAU: 0.9, hzOuterAU: 1.4 }, asteroidBelts: [],
      planets: Array.from({ length: 4 }, (_, i) => ({
        orbitRadiusAU: 0.4 + i * 0.9, moons: [],
        planetData: { radiusEarth: 1 + (i % 4), T_eq: 260, habitability: { score: 0.2 }, rings: false },
      })),
    };
    nav._levelIndex = 4;
  } else nav._levelIndex = level;
  nav.render();
  return nav;
}

const inMap = (rgn, f) => f.x >= rgn.x && f.x < rgn.x + rgn.w && f.y >= rgn.y && f.y < rgn.y + rgn.h;

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// AC-2 — THE PRISM'S DEPTH CUES
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('AC-2 — drop lines, the plane lattice and far-first drawing', () => {
  it('⭐ THE FOUR NEW INKS ARE IN THE TABLE, NOT IN A LITERAL — without this every case below drifts', async () => {
    const h = await loadedNav();
    const { d } = paint(h.nav, 1);
    for (const [k, v] of Object.entries(NEW)) {
      expect(d.INK[k], `INK.${k} must exist and be ${v}`).toBe(v);
    }
  }, 60000);

  it('⛔ EVERY DRAWN MARK CARRIES A STEM, AND ITS INK SAYS WHICH SIDE OF THE PLANE IT IS ON', async () => {
    // ⭐ THE DIRECTION IS THE ASSERTION, NOT THE PRESENCE. `projectPrism`'s `py` is the star drawn at
    //    the camera's height, so a star ABOVE the plane has `y < py` and its stem runs DOWNWARD from
    //    the mark — which means a stem texel immediately BELOW a mark must be `INK.ABOVE`, and one
    //    immediately ABOVE it must be `INK.BELOW`. Swapping the ternary in `prismDrop` inverts every
    //    one of these and the case goes red on the first mark it checks.
    const h = await loadedNav();
    for (const [mode, design] of [['rail', 1], ['bars', 2]]) {
      const nav = await at(h.nav, mode, 3);
      const r = paint(nav, design);
      const stems = r.fills.filter((f) => f.ink === NEW.ABOVE || f.ink === NEW.BELOW);
      expect(stems.length, `design ${design}: no drop line was drawn at all`).toBeGreaterThan(0);
      expect(stems.every((f) => f.w === 1 && f.h === 1),
             `design ${design}: a drop line must be one-texel`).toBe(true);
      const marks = r.S.prismHits || [];
      expect(marks.length, `design ${design}: no marks published`).toBeGreaterThan(20);
      // ⛔ THE FOOT IS RECOVERED THROUGH THE DESIGNS' OWN `projectPrism`, FRAMED BY THE DECLARED MAP
      //    REGION — which is the very rectangle the painter centred on — and NOT by restating the
      //    painter's `cxp`/`halfH` here. The `x` self-check below is what proves the frame is right;
      //    without it this case would be measuring a projection of its own.
      const rgn = r.regions.map;
      const proj = (row) => r.d.projectPrism(row, rgn.x + rgn.w / 2, rgn.y + rgn.h / 2, rgn.w / 2, rgn.h / 2);
      let checked = 0;
      for (const m of marks) {
        const p = proj(m.ref);
        expect(Math.round(p.x), `design ${design}: the map region is not the painter's frame`).toBe(Math.round(m.x));
        const mx = Math.round(m.x), my = Math.round(p.y), fy = Math.round(p.py);
        if (Math.abs(my - fy) < 2) continue;                      // on the plane: the foot dot says it
        const want = my < fy ? NEW.ABOVE : NEW.BELOW;
        const lo = Math.min(my, fy), hi = Math.max(my, fy);
        // ⚠ `some`, NOT a per-texel identity: 212 marks share ~250 columns, so a LATER star's stem
        //   can overdraw a texel in this one's column. What cannot happen is this star's own stem
        //   being absent from the stream — the recorder keeps every fill, overdrawn or not.
        expect(stems.some((f) => f.x === mx && f.y > lo && f.y < hi && f.ink === want),
               `design ${design}: ${m.ref.name || m.ref.seed} is ${my < fy ? 'above' : 'below'} the plane ` +
               `(mark ${my}, foot ${fy}) and has no ${want === NEW.ABOVE ? 'ABOVE' : 'BELOW'} stem in column ${mx}`).toBe(true);
        checked++;
      }
      expect(checked, `design ${design}: no mark stood off the plane at all`).toBeGreaterThan(20);
      // both inks are on the glass — the fixture straddles the plane, so a one-sided answer is a bug
      expect(new Set(stems.map((f) => f.ink)).size, `design ${design}: only one side of the plane drew`).toBe(2);
    }
  }, 120000);

  it('⛔ THE PLANE LATTICE IS DRAWN, CLIPPED TO THE PANE, AND ENTIRELY UNDER THE MARKS', async () => {
    const h = await loadedNav();
    for (const [mode, design] of [['rail', 1], ['bars', 2]]) {
      const nav = await at(h.nav, mode, 3);
      const r = paint(nav, design);
      const grid = [], firstStem = r.fills.findIndex((f) => f.ink === NEW.ABOVE || f.ink === NEW.BELOW);
      r.fills.forEach((f, i) => { if (f.ink === NEW.GRID) grid.push({ ...f, i }); });
      expect(grid.length, `design ${design}: no plane lattice`).toBeGreaterThan(50);
      // ⭐ UNDER THE MARKS, STATED AS DRAW ORDER: the stems are drawn immediately before each mark in
      //    the same loop, so "the last lattice texel precedes the first stem texel" IS "the lattice
      //    is under every mark". Moving `prismPlane` below the loop makes this index comparison fail.
      expect(firstStem, `design ${design}: no stems to order the lattice against`).toBeGreaterThan(0);
      expect(grid[grid.length - 1].i, `design ${design}: the lattice must precede every mark`)
        .toBeLessThan(firstStem);
      // …and clipped to the declared map pane, to the texel
      const outside = grid.filter((f) => !inMap(r.regions.map, f));
      expect(outside, `design ${design}: ${outside.length} lattice texels outside the map pane`).toEqual([]);
    }
  }, 120000);

  it('⭐ MARKS ARE PUBLISHED — AND THEREFORE PAINTED — FAR TO NEAR', async () => {
    // ⛔ THE DEPTH IS THE DESIGNS' OWN, NOT A SECOND COPY. `projectPrism` is exported by the factory
    //    and closes over the SAME `S.cam` this frame painted with, so this reads the very number the
    //    sort sorted on. Legacy's own order is `b.starP.depth - a.starP.depth` (NavComputer.js:2029),
    //    i.e. descending — the near mark lands last and wins the overlap.
    const h = await loadedNav();
    for (const [mode, design] of [['rail', 1], ['bars', 2]]) {
      const nav = await at(h.nav, mode, 3);
      const r = paint(nav, design);
      const depths = (r.S.prismHits || []).map((m) => r.d.projectPrism(m.ref, 0, 0, 1, 1).depth);
      expect(depths.length, `design ${design}: nothing published`).toBeGreaterThan(20);
      const rising = depths.filter((v, i) => i > 0 && v > depths[i - 1] + 1e-12);
      expect(rising, `design ${design}: ${rising.length} marks painted out of far-to-near order`).toEqual([]);
    }
  }, 120000);

  it('⭐ DESIGN 1: A CATALOGUE STAR TAKES ITS SPECTRAL INK AND A HALO RING; A PROCEDURAL ONE DOES NOT', async () => {
    const h = await loadedNav();
    withCatalogue(h.nav);
    const nav = await at(h.nav, 'rail', 3);
    const r = paint(nav, 1);
    const cat = (r.S.prismHits || []).filter((m) => m.ref?.isReal && m.ref?.name);
    expect(cat.length, 'the injected catalogue rows did not reach the prism').toBe(CATALOGUE.length);
    for (const m of cat) {
      const mx = Math.round(m.x), my = Math.round(m.y);
      const ink = SPECTRAL[m.ref.spectral];
      // `plus()` is two rects: (cx-1, cy, 3, 1) and (cx, cy-1, 1, 3), in the star's spectral ink
      expect(r.fills.some((f) => f.x === mx - 1 && f.y === my && f.w === 3 && f.h === 1 && f.ink === ink),
             `${m.ref.name} (${m.ref.spectral}) must take ${ink}, not the one-bit BODY ink`).toBe(true);
      // the halo is `frame(x-2, y-2, 5, 5)` — its top edge is a 5x1 in INK.HALO
      expect(r.fills.some((f) => f.x === mx - 2 && f.y === my - 2 && f.w === 5 && f.h === 1 && f.ink === NEW.HALO),
             `${m.ref.name} must carry a halo ring at (${mx - 2},${my - 2})`).toBe(true);
    }
    // ⛔ AND THE PROCEDURAL MARKS DID NOT GET ONE — otherwise "catalogue" would mean nothing
    // `frame()` lays FOUR rects; its two horizontal edges are the 5x1s, so two per ring.
    expect(r.fills.filter((f) => f.ink === NEW.HALO && f.w === 5 && f.h === 1).length,
           'exactly one halo per catalogue star and none for the 212 procedural ones').toBe(CATALOGUE.length * 2);
  }, 120000);
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// AC-3 — NAMES ON THE PRISM, AND THE HEIGHT NUMBERS
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('AC-3 — design 1 names its catalogue stars, and both designs print the height', () => {
  it('⛔ THE EIGHT INDEX DIGITS ARE GONE AND THE NAMES ARE ON THE MARKS, SELECTED FIRST', async () => {
    const h = await loadedNav();
    withCatalogue(h.nav);
    h.nav._selectedNavStar = { seed: 'SIRIUS' };
    const nav = await at(h.nav, 'rail', 3);
    const r = paint(nav, 1);
    const mapLabels = r.lines.filter((l) => (r.S.labelHits || []).some((hit) => hit.x === l.x && hit.y === l.y));
    expect(mapLabels.length, 'no label was placed on design 1\'s prism').toBeGreaterThan(0);
    // ⭐ THE ABSOLUTE FACT: every label on the map is a NAME, and none of them is a bare index digit.
    expect(mapLabels.filter((l) => /^[1-8]$/.test(l.s)),
           'design 1 still draws the eight index digits on the prism').toEqual([]);
    expect(mapLabels.map((l) => l.s).sort()).toEqual(CATALOGUE.map((c) => c.key).sort());
    // …the SELECTED star's name is one of them, and it is drawn first (it is asked for its slot first)
    expect(r.S.selStar ?? nav._viewDriverInst.D.selStar?.name, 'the fixture did not select SIRIUS')
      .not.toBe(undefined);
    expect(mapLabels[0].s, 'the selected star must get first pick of the slots').toBe('SIRIUS');
    // …and no two labels overlap, which is what keeps the mark guard silent
    const hits = r.S.labelHits;
    for (let i = 0; i < hits.length; i++) for (let j = i + 1; j < hits.length; j++) {
      const a = hits[i], b = hits[j];
      const over = a.x - 2 < b.x + b.w + 2 && a.x + a.w + 2 > b.x - 2 && Math.abs(a.y - b.y) < FACE.h + 1;
      expect(over, `labels ${i} and ${j} overlap: ${JSON.stringify([a, b])}`).toBe(false);
    }
    expect(r.violations, 'the mark guard fired').toBe(0);
  }, 120000);

  it('⭐ DESIGN 1\'S PRISM DETAIL BLOCK PRINTS HEIGHT + REGION, PLAYER Y AND Y RANGE', async () => {
    const h = await loadedNav();
    const nav = await at(h.nav, 'rail', 3);
    // ⛔ DRIVEN OFF `_localCenter.y` — THE FIELD `R` AND `F` WRITE (NavComputer.js:1392-1393). The
    //    keys themselves move it by `_localRadius * 0.01` per animation frame (0.015 pc at the entry
    //    radius), which rounds to nothing in a headless frame; the pipe under test is that field →
    //    `S.cam.y` → the printed string, and these are the three values that cross both thresholds.
    for (const [y, region] of [[0.0, 'THIN DISK'], [0.45, 'THICK DISK'], [-1.6, 'HALO']]) {
      nav._localCenter.y = y;
      nav.render();
      const r = paint(nav, 1);
      const pc = Math.round(y * 1000);
      expect(r.text, `HEIGHT at _localCenter.y = ${y}`)
        .toContain(`HEIGHT ${pc} PC ${y >= 0 ? 'ABOVE' : 'BELOW'}`);
      expect(r.lines.map((l) => l.s), `the region line at ${y}`).toContain(`       ${region}`);
      const py = Math.round(nav._playerY * 1000);
      expect(r.text).toContain(`PLAYER Y ${py} PC`);
      expect(r.text).toContain(`Y RANGE ${Math.round((nav._playerY - 2) * 1000)} TO ${Math.round((nav._playerY + 2) * 1000)} PC`);
      expect(r.violations, `the mark guard fired at _localCenter.y = ${y}`).toBe(0);
    }
  }, 120000);

  it('⭐ DESIGN 2\'S PRISM STATUS LINE PRINTS HEIGHT WITH ITS REGION, AND IS NOT TRUNCATED', async () => {
    const h = await loadedNav();
    const nav = await at(h.nav, 'bars', 3);
    nav._localCenter.y = 0.45;
    nav.render();
    const r = paint(nav, 2);
    const status = r.lines.find((l) => l.s.startsWith('PRISM · '));
    expect(status, 'design 2 drew no PRISM status line').toBeTruthy();
    expect(status.s).toBe(`PRISM · VIEW ${Math.round(nav._localRadius * 3260)} LY · HEIGHT 450 PC ABOVE · THICK DISK`);
    // ⛔ NOT TRUNCATED: `fit()` eats from the right, so a line that ends in the region word is a line
    //    that fitted. The old line ended in `WASD PAN ` — mid-separator — at this very buffer.
    expect(status.s.endsWith('THICK DISK'), 'fit() ate the end of the status line').toBe(true);
    // …and the three keys that used to be eaten there are now drawn, on the design's own legend row
    expect(r.text, 'the keys must move to the sky, not vanish').toContain('L=LIST  WASD PAN  R/F UP');
    expect(r.violations, 'the mark guard fired').toBe(0);
  }, 120000);
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// AC-9 — ONE ZOOM READOUT, IN LIGHT-YEARS, IN BOTH LOOKS
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('AC-9 — both designs print VIEW <n> LY and the wheel moves it', () => {
  it('⛔ THE SAME INTEGER LEGACY PRINTS, IN BOTH DESIGNS, AND `PC ACROSS` IS GONE', async () => {
    const h = await loadedNav();
    for (const [mode, design] of [['rail', 1], ['bars', 2]]) {
      const nav = await at(h.nav, mode, 3);
      const before = paint(nav, design);
      // legacy: `round(this._localRadius * 1000 * 3.26)` (NavComputer.js:4272-4273)
      const ly = Math.round(nav._localRadius * 1000 * 3.26);
      expect(before.text, `design ${design} must print legacy's own number`).toContain(`VIEW ${ly} LY`);
      expect(before.text, `design ${design} still prints PC ACROSS`).not.toContain('PC ACROSS');
      // ⭐ DRIVEN THROUGH THE REAL WHEEL — `_handleWheel` at level 3 scales `_localRadius` by 1.15
      //    inside its own clamp (NavComputer.js:4701-4710). An assertion about a formula would pass
      //    on a readout wired to nothing.
      nav._handleWheel({ deltaY: 120, preventDefault() {} });
      nav.render();
      const after = paint(nav, design);
      const ly2 = Math.round(nav._localRadius * 1000 * 3.26);
      expect(ly2, `design ${design}: the wheel did not move the radius`).not.toBe(ly);
      expect(after.text, `design ${design}: the readout did not follow the wheel`).toContain(`VIEW ${ly2} LY`);
    }
  }, 120000);
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// THE BLAST RADIUS — nothing this wave adds exists outside PRISM, and the guard is silent everywhere
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('the wave touches PRISM and nothing else', () => {
  it('⛔ NONE OF THE FOUR NEW INKS AND NONE OF THE NEW WORDS APPEAR AT LEVELS 0, 1, 2 OR 4', async () => {
    // This is the durable half of the frame-hash measurement in the header: a hash goes red on
    // another lane's correct work, but "the depth-cue inks do not exist at SECTOR" cannot.
    const h = await loadedNav();
    withCatalogue(h.nav);
    for (const [mode, design] of [['rail', 1], ['bars', 2]]) {
      for (const level of [0, 1, 2, 4]) {
        const nav = await at(h.nav, mode, level);
        const r = paint(nav, design);
        const stray = r.fills.filter((f) => Object.values(NEW).includes(f.ink));
        expect(stray, `design ${design} level ${level}: ${stray.length} texels of PRISM's inks`).toEqual([]);
        for (const word of ['HEIGHT ', 'VIEW ', 'PLAYER Y ', 'Y RANGE ', 'THIN DISK', 'THICK DISK']) {
          expect(r.text.includes(word), `design ${design} level ${level} prints "${word}"`).toBe(false);
        }
      }
    }
  }, 300000);

  it('⛔ THE MARK GUARD IS SILENT ACROSS BOTH DESIGNS AND ALL FIVE LEVELS', async () => {
    const h = await loadedNav();
    withCatalogue(h.nav);
    h.nav._selectedNavStar = { seed: 'VEGA' };
    for (const [mode, design] of [['rail', 1], ['bars', 2]]) {
      for (const level of [0, 1, 2, 3, 4]) {
        const nav = await at(h.nav, mode, level);
        const r = paint(nav, design);
        expect(r.viol, `design ${design} level ${level}`).toEqual([]);
        expect(r.violations, `design ${design} level ${level}`).toBe(0);
      }
    }
  }, 300000);
});
