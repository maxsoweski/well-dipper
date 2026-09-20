/**
 * nav-restorations-2026-09-20 — WAVE 2a, THE LAB LANE: AC-5, AC-6's paint, AC-10, and the wave 1b
 * callout fallout.
 *
 * Everything asserted here is drawn in `nav-240p-lab.html` and reaches the game through
 * `scripts/extract-nav-designs.mjs` (`--check` is the audit that the two have not parted):
 *
 *   fallout  a callout draws ONLY for a pointer inside the map pane. Wave 1b's integrator measured
 *            design 1 painting one for a RAIL-ROW hover: the pick is real, its point is in the rail,
 *            and every candidate plate is clamped into the map — so the plate landed in the map's
 *            corner ~35 texels from the pointer, naming a row nowhere near it.
 *   AC-5     the ship diamond at the focused body's DRAWN point in both designs (design 2's
 *            fixed-offset `cxp + 8` diamond is gone), the word SHIP beside it, and a dashed
 *            trajectory with a 3-texel chevron to the hovered-or-selected body.
 *   AC-6     design 2's orrery scales with `S.sysCam.zoom`, re-centred on the star, and draws a zoom
 *            gauge that publishes `S.zoomGaugeRect` for the driver's `zoomGrab`/`zoomDragTo`.
 *   AC-10    design 2's PRISM gains design 1's y-gauge — the SAME `yGauge` function, so the rect it
 *            publishes has the same eight fields and the host's existing `:4402` routing grabs it.
 *
 * ── ⭐ HOW THIS FILE READS THE GLASS ────────────────────────────────────────────────────────────
 *
 * Wave 1a/1b's two instruments, unchanged (`navDefects2026.design.test.js:75-116` explains them at
 * length): an ink RECORDING CONTEXT (a Proxy whose `set` is honoured, so a fill's colour survives)
 * and a `drawPixelText` WRAPPER that records the post-`fit()` string the face was handed. Every
 * string in these designs is drawn as fillRects, so without the wrapper `rec.text` is empty however
 * much writing is on screen.
 * ⛔ IT IS THE SHIPPED `S` / `D`, NOT A FIXTURE. `paint()` repaints the very pair the driver has just
 *    rendered from, so the adapter, the pickers, the level gates and the host's own mouse handlers
 *    are upstream of every assertion below.
 *
 * ── ⛔ THE BEFORE/AFTER FRAME HASHES ARE A MEASUREMENT, NOT A CONSTANT IN THIS FILE ─────────────
 *
 * FNV-1a over the whole fillRect stream (coordinates and ink), 417x240, painted over the SAME `S`/`D`
 * by HEAD's `designs.js` (wave 1b) and by this wave's, pointer parked outside the pane, zoom 1, no
 * gauge press, measured 2026-09-20:
 *
 *   D1 L0 5fef3d04 · L1 57057542 · L2 161c4bb5 · L3 00b85a16          IDENTICAL
 *        — the `yGauge` lift (design 1's inline strip becomes the function design 2 also calls)
 *          moves not one texel, which is what "exactly the shape d1Prism publishes" has to mean.
 *   D1 L4 FOREIGN 907660b7, 8349 fills both sides                     IDENTICAL   (`D.ship` null)
 *   D1 L4 current, ship at planet 0  fbd7e433 → 5dcaa2cc              CHANGED: the diamond, the
 *          word SHIP, the trajectory. AC-5, and nothing else.
 *   D2 L0 1c17e803 · L1 fb50dd73 · L2 2889c3d4                        IDENTICAL
 *   D2 L3 8aa8c943 → 3b416c8a   CHANGED: AC-10's y-gauge in place of the 24-texel scale column.
 *   D2 L4 FOREIGN b340fdf9 → 16000738, 4298 → 4331 fills. The WHOLE difference, enumerated:
 *          + 38 fills — the zoom gauge's track `(410,18,1,200)`, its two end caps, the 6-wide mark
 *            `(407,132,6,1)`, the readout's knockout plate `(388,9,25,7)` and the 33 glyph texels of
 *            `X1.0`;
 *          − 5 fills — design 2's old FIXED-OFFSET diamond at `(215..219, 118..122)` in `INK.TARGET`,
 *            which AC-5 removes.
 *          Nothing else moved: `D.ship` is null in a foreign system so AC-5 draws nothing, and
 *          `rOf` at zoom 1 is the number it always was, so every ring, body, pip and label is on the
 *          texel it was on.
 *
 * A checked-in hash is NOT the guard, for the reason both earlier waves give: three lanes are
 * mutating this tree at once and a hash that goes red on another lane's correct work is a guard that
 * gets switched off. What is durable is the INVARIANT each measurement was for, and each one below
 * hashes two frames inside one run and needs no constant.
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
 * ⛔ EIGHT PLANETS, MOONS ON FIVE, TWO BELTS — wave 1b's fixture, unchanged, because AC-5 needs a
 *    system with a moon-rich planet (the ship at a moon), an outer planet (a long trajectory) and
 *    the same belts AC-8 named. `orbitAngle` is spread so ship and target are never coincident.
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
 * ⛔ `current: true` STANDS THE PILOT ON THE SYSTEM STAR (`navDefects2026.design.test.js:128-150`):
 *    `D.isCurrent` is the HOST's `_isCurrentSystem()`, a 0.1 pc identity test against
 *    `_playerX/Y/Z`, and `D.ship` is `null` unless it answers true. `current: false` leaves the
 *    pilot where `makeHeadlessNav` put him, which IS the foreign case AC-5 has to draw nothing in.
 * ⛔ THE POINTER IS PARKED OUTSIDE THE PANE, because `render()` resolves the hover from
 *    `_mouseX`/`_mouseY` and a stale position from a previous case would give the first frame of the
 *    next one a callout — and half of this file's proof is a frame that has none.
 * ⛔ AND THE ZOOM IS RESET, because `_systemZoom` is the host's own field and survives a level
 *    change; a case that drove the wheel would otherwise hand the next one a scaled orrery.
 */
async function at(h, mode, level, { system = SYSTEM_DATA, current = true } = {}) {
  h.nav.viewMode = mode;
  h.nav._systemZoom = 1;
  if (level === 4) {
    h.nav._systemStar = h.nav._localStars.reduce((m, s) => (m == null || s.dist < m.dist ? s : m), null);
    if (current && h.nav._systemStar) {
      h.nav._playerX = h.nav._systemStar.wx; h.nav._playerY = h.nav._systemStar.wy;
      h.nav._playerZ = h.nav._systemStar.wz;
    } else if (h.nav._systemStar) {
      // ⛔ THE PILOT HAS TO BE MOVED AWAY, NOT MERELY LEFT ALONE — measured, and it cost a red run.
      //    `_playerX/Y/Z` are the nav's own fields and they PERSIST across cases on a shared harness,
      //    so a case that had already stood the pilot on this star left the next one "foreign" in
      //    name only. Half a kpc is five thousand times `_isCurrentSystem()`'s 0.1 pc threshold, and
      //    only the x axis moves so `D.player.y` — the y-gauge's anchor — is untouched.
      h.nav._playerX = h.nav._systemStar.wx + 0.5;
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
 * Sweep a REGION for a point the driver resolves a hover at.
 *
 * ⛔ THE POINTER IS DRIVEN, NOT THE PICKER. `hoverAt` runs `_handleMouseMove` and then a whole
 *    `render()`, which is what publishes `S.hover` at the driver's own tail — so what comes back is
 *    the frame's answer, not a re-implementation of it. The step is coarse because each probe is a
 *    full nav render.
 */
function sweepFor(nav, rgn, step = { x: 9, y: 6 }) {
  for (let y = rgn.y + 2; y < rgn.y + rgn.h - 2; y += step.y) {
    for (let x = rgn.x + 2; x < rgn.x + rgn.w - 2; x += step.x) {
      hoverAt(nav, x + 0.5, y + 0.5);
      const hv = nav._viewDriverInst.S.hover;
      if (hv) return { x: x + 0.5, y: y + 0.5, hv };
    }
  }
  return null;
}

/** A real press-move-release on the host's own handlers, probing texel middles (trap 6). */
function dragY(nav, x, y0, ...ys) {
  nav._handleMouseDown({ clientX: x + 0.5, clientY: y0 + 0.5, button: 0 });
  for (const y of ys) nav._handleMouseMove({ clientX: x + 0.5, clientY: y + 0.5 });
  nav._handleMouseUp({ clientX: x + 0.5, clientY: ys[ys.length - 1] + 0.5, button: 0 });
  nav.render();
}

/** Every fill this frame laid down in the ship's ink — the diamond, the word, the dashes, the chevron. */
const shipFills = (p) => p.fills.filter((f) => f.ink === p.d.INK.SHIP);

/**
 * The TRAJECTORY's own texels: every 1x1 ship-ink fill that is not part of the word `SHIP`.
 *
 * ⛔ THE WORD HAD TO BE SUBTRACTED, AND FINDING THAT OUT COST A RED RUN. `drawPixelText` emits ONE
 *    `fillRect(x, y, 1, 1)` PER TEXEL OF EVERY GLYPH, in the colour it was handed — so four glyphs in
 *    `INK.SHIP` are ~50 fills of exactly the shape a dashed line is made of, and a case asserting
 *    "no line drew" read 54 where it expected 2. The word's box comes from the recorded draw itself
 *    (`p.lines`), not from a second guess at where `placeLabel` put it.
 * ⭐ WHICH LEAVES AN ABSOLUTE FLOOR: with no trajectory the count is exactly 2 — `SP.diam5`'s top and
 *   bottom rows, the only two 1-wide rows of the diamond.
 */
function trajectoryDots(p) {
  const word = p.lines.find((l) => l.s === 'SHIP');
  const box = word ? { x: word.x - 1, y: word.y - 1, w: measurePixelText('SHIP') + 2, h: FACE.h + 2 } : null;
  return p.fills.filter((f) => f.ink === p.d.INK.SHIP && f.w === 1 && f.h === 1
    && !(box && f.x >= box.x && f.x < box.x + box.w && f.y >= box.y && f.y < box.y + box.h));
}

/** The body mark the paint published for a `D.bodies` row (or for the primary). */
const hitFor = (S, ref) => (S.bodyHits || []).find(
  (z) => (ref === 'STAR' ? z.star : z.ref === ref) && !(z.moon >= 0));

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// THE WAVE 1b FALLOUT — A CALLOUT IS A THING ABOUT THE MAP
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('AC-1 fallout — a rail-row hover paints no callout', () => {
  it('⛔ DESIGN 1 AT PRISM AND AT SYSTEM: THE ROW RESOLVES, AND THE FRAME IS THE UNHOVERED ONE', async () => {
    // ⭐ THE ABSOLUTE FACTS, in three parts, because "no callout" is trivially satisfiable by "no
    //    hover": (1) the pointer really is on a rail row and `S.hover` really is published, with its
    //    point OUTSIDE `REGIONS.map`; (2) `S.hoverCalloutRect` is null; (3) the whole fill stream
    //    hashes to what the pointer-less frame hashed, so not one texel was added anywhere.
    // ⛔ MUTANT `hoverCallout-ungated` — delete the `hv.sx/hv.sy inside rgn` return in
    //    `hoverCallout`: the plate draws, clamped into the map's corner, and parts (2) and (3) both
    //    go red at both levels.
    // ⛔ `D.ship` IS NULLED BEFORE EACH PAINT AT BOTH LEVELS, AND THAT IS A REAL FINDING, NOT A
    //    CONVENIENCE. At SYSTEM the callout is not the only thing `S.hover` feeds: AC-5's trajectory
    //    re-targets on the HOVERED body (legacy's own `_hoveredBody || _selectedBody`, :2960), and a
    //    rail-row hover resolves to a body just as a pip does — so hovering a row legitimately
    //    re-aims the dashed line, and the frame legitimately changes. Measured: with the ship
    //    published, L4's two hashes differ by exactly that line. Nulling `D.ship` isolates the ONE
    //    thing this case is about; the trajectory's own re-aim has its own case below.
    const h = await loadedNav();
    for (const level of [3, 4]) {
      const nav = await at(h, 'rail', level);
      const drv = nav._viewDriverInst;
      drv.D.ship = null;
      const bare = paint(nav, 1);
      expect(bare.S.hoverCalloutRect, `L${level}: the pointer-less frame has no callout`).toBeNull();

      const rail = bare.regions.rail;
      const found = sweepFor(nav, rail);
      expect(found, `L${level}: the sweep must land on a rail row`).toBeTruthy();
      const map = paint(nav, 1).regions.map;
      const hv = drv.S.hover;
      expect(hv.sx >= map.x && hv.sx < map.x + map.w && hv.sy >= map.y && hv.sy < map.y + map.h,
             `L${level}: the row's hover point must be OUTSIDE the map pane`).toBe(false);

      drv.D.ship = null;
      const hovered = paint(nav, 1);
      expect(hovered.S.hoverCalloutRect, `L${level}: a rail-row hover paints no callout`).toBeNull();
      expect(hovered.hash, `L${level}: the frame is texel-for-texel the unhovered one`).toBe(bare.hash);
    }
  }, 180000);
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// AC-10 — DESIGN 2's PRISM GETS DESIGN 1's Y-GAUGE
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('AC-10 — a grabbable y-gauge in design 2\'s prism', () => {
  it('⛔ IT PUBLISHES EXACTLY DESIGN 1\'s RECT, INSIDE THE MAP PANE', async () => {
    // ⭐ THE ABSOLUTE FACT: the two designs' `S.yGaugeRect`s carry the SAME KEYS and the same four
    //    derived numbers relative to each design's own map pane — which is what "exactly the shape
    //    d1Prism publishes" means, and what `gaugeDragTo` inverts. The rect must also lie inside
    //    `REGIONS.map`, because the host returns at `:4401` unless the press is a map press.
    // ⛔ MUTANT `d2Prism-no-gauge` — delete the `yGauge(...)` call in `d2Prism`: `S.yGaugeRect` is
    //    null under design 2 (`resetPicks` cleared it) and the first expect goes red.
    const h = await loadedNav();

    const r1 = (await at(h, 'rail', 3), paint(await at(h, 'rail', 3), 1));
    const g1 = r1.S.yGaugeRect;
    const p2 = paint(await at(h, 'bars', 3), 2);
    const g2 = p2.S.yGaugeRect;
    expect(g2, 'design 2 at PRISM publishes a y-gauge').toBeTruthy();
    expect(Object.keys(g2).sort(), 'the same eight fields design 1 publishes').toEqual(Object.keys(g1).sort());
    expect(g2.w, 'the same 6-texel strip').toBe(g1.w);
    expect(g2.halfKpc, 'the same ±2 pc range').toBe(g1.halfKpc);
    expect(g2.base, 'anchored on the player, as design 1 is').toBe(g1.base);

    const map2 = p2.regions.map;
    expect(g2.y, 'the strip spans this design\'s own pane').toBe(map2.y);
    expect(g2.h).toBe(map2.h);
    expect(g2.cy).toBe(map2.y + map2.h / 2);
    expect(g2.span).toBe(map2.h / 2);
    expect(g2.x >= map2.x && g2.x + g2.w <= map2.x + map2.w,
           'and it stands INSIDE the map, or no press could ever reach it').toBe(true);
    expect(p2.violations, 'the mark guard stays silent').toBe(0);
  }, 180000);

  it('⭐ A REAL DRAG ON IT MOVES THE CAMERA HEIGHT, AND ONE TEXEL OUTSIDE IT DOES NOT', async () => {
    // ⭐ DRIVEN THROUGH THE HOST'S OWN HANDLERS — `_handleMouseDown` → `_handleMouseMove` →
    //    `_handleMouseUp` — so the whole published path runs: `pressStartsGesture`, the `:4402`
    //    arming that already accepts ANY design, `gaugeGrab` against this paint's rect and
    //    `gaugeDragTo` inverting it. Nothing here calls the driver directly.
    // ⭐ AND THE ABSOLUTE FACT IS THE NUMBER ON THE GLASS: after the drag the HEIGHT clause of AC-3
    //    reads the pc the camera moved to, not merely "some field changed".
    // ⛔ MUTANT `yGauge-publishes-nothing` — drop the `S.yGaugeRect = {...}` line: `gaugeGrab`
    //    returns false, the press spins the prism instead, `_localCenter.y` is unchanged and both
    //    halves below go red.
    const h = await loadedNav();
    const nav = await at(h, 'bars', 3);
    const p = paint(nav, 2);
    const g = p.S.yGaugeRect;
    const y0 = nav._localCenter.y;

    // a third of the way up the strip from its centre: a height the gauge can certainly represent
    const target = Math.round(g.cy - g.span / 3);
    dragY(nav, g.x + 3, Math.round(g.cy), target);
    const moved = nav._localCenter.y;
    expect(moved, 'the drag moved the camera height').not.toBe(y0);
    expect(moved, 'and it moved UP — the mark went up the strip').toBeGreaterThan(y0);
    // the mapping is the gauge's own, inverted: `base + ((cy - py) / span) * halfKpc`
    expect(moved).toBeCloseTo(g.base + ((g.cy - (target + 0.5)) / g.span) * g.halfKpc, 9);
    const after = paint(nav, 2);
    expect(after.text, 'and AC-3\'s HEIGHT number followed it')
      .toContain(`HEIGHT ${Math.round(moved * 1000)} PC ${moved >= 0 ? 'ABOVE' : 'BELOW'}`);
    // ⭐ AND THE MARK LANDED UNDER THE POINTER, which is the whole claim of publishing the mapping:
    //    the camera mark is the 4-wide KEY fill at `gx + 1`, and drawing it is `gaugeDragTo` run
    //    forwards, so its row must be the row the drag was released on (±1 for `rect()`'s rounding).
    const camMark = after.fills.filter((f) => f.ink === after.d.INK.KEY && f.w === 4 && f.h === 1 && f.x === g.x + 1);
    expect(camMark.length, 'exactly one camera mark on the strip').toBe(1);
    expect(Math.abs(camMark[0].y - target), 'the mark is under the pointer that put it there').toBeLessThanOrEqual(1);

    // ⭐ AND THE PRESS BESIDE IT IS STILL A MAP GESTURE. Two texels left of the rect's skirt.
    nav._localCenter.y = y0; nav.render(); paint(nav, 2);
    dragY(nav, g.x - 3, Math.round(g.cy), target);
    expect(nav._localCenter.y, 'a press outside the gauge must not move the height').toBe(y0);
  }, 180000);

  it('⭐ DESIGN 1\'s OWN GAUGE IS UNMOVED BY THE LIFT, AND NOTHING NEW DRAWS AT ITS OTHER LEVELS', async () => {
    // ⭐ THE LIFT (`yGauge` shared by both prisms) may not move design 1 a texel. The durable form of
    //    that is the rect's relationship to design 1's own regions, which is what it has always been.
    // ⛔ MUTANT `yGauge-off-by-one` — draw the track at `gx + 2` or publish `h: gh - 1`: the geometry
    //    assertions here and the drag's `toBeCloseTo` in design 2's case above both go red.
    const h = await loadedNav();
    const p = paint(await at(h, 'rail', 3), 1);
    const g = p.S.yGaugeRect, map = p.regions.map;
    expect(g.y).toBe(map.y);
    expect(g.h).toBe(map.h);
    expect(g.w).toBe(6);
    expect(g.x, 'design 1\'s gauge stands in its own column, right of the map').toBeGreaterThanOrEqual(map.x + map.w);
    expect(p.violations).toBe(0);

    for (const level of [0, 1, 2]) {
      const q = paint(await at(h, 'rail', level), 1);
      expect(q.S.yGaugeRect, `L${level}: no gauge outside PRISM`).toBeFalsy();
      expect(q.S.zoomGaugeRect, `L${level}: and no zoom gauge either`).toBeFalsy();
    }
  }, 180000);
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// AC-6 — THE WHEEL AT SYSTEM DRAWS SOMETHING, AND THE GAUGE IS A HANDLE
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('AC-6 — design 2\'s orrery scales with the wheel, and says so', () => {
  it('⛔ THE OUTER RING\'s RADIUS SCALES BY THE WHEEL\'s OWN FACTOR AND THE STAR DOES NOT MOVE', async () => {
    // ⭐ DRIVEN BY THE REAL WHEEL — `_handleWheel` is the host's own, untouched by this workstream,
    //    and it is what multiplies `_systemZoom` by 1.15. The observable is `S.orbitRings`, which the
    //    orrery publishes at its draw site, so the number read is the radius that was DRAWN.
    // ⛔ MUTANT `rOf-ignores-zoom` — drop the `* zoom` from `rOf`: the outer radius is unchanged
    //    after the notch and the first expect goes red. `zoom-scales-the-centre` (adding a pan term)
    //    goes red on the second.
    const h = await loadedNav();
    const nav = await at(h, 'bars', 4);
    const before = paint(nav, 2);
    const r0 = Math.max(...before.S.orbitRings.map((z) => z.rx));
    const cx0 = before.S.orbitRings[0].cx, cy0 = before.S.orbitRings[0].cy;

    nav._handleWheel({ deltaY: -100, preventDefault() {} });
    nav.render();
    const after = paint(nav, 2);
    expect(after.S.sysCam.zoom, 'the wheel moved the host\'s own field').toBeCloseTo(1.15, 6);
    const r1 = Math.max(...after.S.orbitRings.map((z) => z.rx));
    expect(r1 / r0, 'and every orbit radius grew by exactly that factor').toBeCloseTo(1.15, 6);
    expect(after.S.orbitRings[0].cx, 'the star\'s screen point does not move with the zoom').toBe(cx0);
    expect(after.S.orbitRings[0].cy).toBe(cy0);
    expect(after.violations, 'the mark guard stays silent at 1.15x').toBe(0);

    // ⭐ AND DESIGN 1 IGNORES IT — Max's ruling, spelled as an absence: the same nav, the same
    //    `_systemZoom`, and the ladder's published stops are identical.
    const ladder0 = paint(await at(h, 'rail', 4), 1).S.ladderStops.slice();
    nav._handleWheel({ deltaY: -100, preventDefault() {} });
    nav.render();
    const ladder1 = paint(nav, 1).S.ladderStops.slice();
    expect(ladder1, 'design 1\'s ladder is a scroll, not a zoom').toEqual(ladder0);
  }, 180000);

  it('⛔ AT THE TWO CLAMPS AND AT THE MIDPOINT THE MARK IS AT THE TRACK\'s BOTTOM, TOP AND MIDDLE', async () => {
    // ⭐ THE ABSOLUTE FACT is the seam's own mapping, not this painter's arithmetic:
    //    `t = (ln z − ln 0.3) / (ln 5 − ln 0.3)`, `t = 0` at the bottom and `t = 1` at the top. So at
    //    0.3 the mark is on the track's LAST row, at 5.0 on its FIRST, and at the geometric mean
    //    sqrt(0.3 × 5) = 1.2247 (t = 0.5 exactly) within a texel of its middle.
    // ⛔ THE ZOOMS ARE REACHED BY THE REAL WHEEL WHERE THE WHEEL CAN REACH THEM: 0.87^n from 1.0
    //    passes 0.3 at n = 9 and the host clamps there, 1.15^n passes 5.0 at n = 12. The midpoint has
    //    no notch on it, so `nav._systemZoom` is set directly and the field is named.
    // ⛔ MUTANT `zoomGauge-linear-t` — use `(z - 0.3) / 4.7` instead of the log form: the clamps stay
    //    right and the MIDPOINT mark lands 30 texels low, which the third block catches.
    const h = await loadedNav();
    const nav = await at(h, 'bars', 4);

    for (let i = 0; i < 12; i++) { nav._handleWheel({ deltaY: -100, preventDefault() {} }); }
    nav.render();
    const top = paint(nav, 2);
    expect(top.S.sysCam.zoom, 'the host clamps at 5.0').toBeCloseTo(5.0, 9);
    const gt = top.S.zoomGaugeRect;
    expect(gt, 'design 2 at SYSTEM publishes a zoom gauge').toBeTruthy();
    expect(markRow(top, gt), 'at 5.0 the mark is on the track\'s top row').toBe(gt.y);

    for (let i = 0; i < 24; i++) { nav._handleWheel({ deltaY: 100, preventDefault() {} }); }
    nav.render();
    const bot = paint(nav, 2);
    expect(bot.S.sysCam.zoom, 'and at 0.3 the other way').toBeCloseTo(0.3, 9);
    expect(markRow(bot, bot.S.zoomGaugeRect), 'at 0.3 the mark is on the track\'s bottom row')
      .toBe(bot.S.zoomGaugeRect.y + bot.S.zoomGaugeRect.h - 1);

    nav._systemZoom = Math.sqrt(0.3 * 5);        // the field the host owns; t = 0.5 exactly
    nav.render();
    const mid = paint(nav, 2);
    const gm = mid.S.zoomGaugeRect;
    expect(Math.abs(markRow(mid, gm) - (gm.y + (gm.h - 1) / 2)),
           'at the geometric mean the mark is within a texel of the middle').toBeLessThanOrEqual(1);
    expect(mid.text, 'and the readout names the value').toContain('X1.2');
    expect(mid.violations).toBe(0);

    // ⭐ THE GAUGE IS DESIGN 2's AND SYSTEM's ONLY — design 1's ladder gets none.
    const d1 = paint(await at(h, 'rail', 4), 1);
    expect(d1.S.zoomGaugeRect, 'no zoom gauge on the ladder').toBeFalsy();
  }, 240000);

  it('⭐ A REAL DRAG ON THE ZOOM GAUGE SETS THE HOST\'s OWN _systemZoom', async () => {
    // ⭐ THE WHOLE PUBLISHED PATH, driven through the host's handlers: the `:4405` arm, `zoomGrab`
    //    against this paint's rect, `zoomDragTo` inverting the seam's mapping, the `:4355` move
    //    clause and the `:4415` release. The observable is the host's field AND the picture: the
    //    outer ring's radius after the drag is the pre-drag radius times the new zoom.
    // ⛔ MUTANT `zoomGauge-publishes-nothing` — drop `S.zoomGaugeRect = {...}`: `zoomGrab` returns
    //    false, the press spins the orrery, `_systemZoom` stays 1 and this goes red.
    const h = await loadedNav();
    const nav = await at(h, 'bars', 4);
    const p = paint(nav, 2);
    const g = p.S.zoomGaugeRect;
    const rBase = Math.max(...p.S.orbitRings.map((z) => z.rx));

    const to = g.y + Math.round(g.h * 0.25);     // three quarters of the way UP the track
    dragY(nav, g.x + 3, g.y + Math.round(g.h * 0.5), to);
    const z = nav._systemZoom;
    expect(z, 'the drag moved the host\'s zoom').not.toBe(1);
    expect(z, 'and upward is magnification').toBeGreaterThan(1);
    const t = (g.y + g.h - (to + 0.5)) / g.h;
    expect(z).toBeCloseTo(Math.exp(Math.log(0.3) + t * (Math.log(5) - Math.log(0.3))), 6);

    const q = paint(nav, 2);
    expect(Math.max(...q.S.orbitRings.map((r) => r.rx)) / rBase,
           'and the picture followed the handle').toBeCloseTo(z, 6);
  }, 180000);
});

/** The row the zoom gauge's mark was drawn on: the 6-wide KEY fill inside the track's rect. */
function markRow(p, g) {
  const m = p.fills.filter((f) => f.ink === p.d.INK.KEY && f.w === 6 && f.h === 1
                              && f.x === g.x && f.y >= g.y && f.y < g.y + g.h);
  expect(m.length, 'exactly one zoom mark on the track').toBe(1);
  return m[0].y;
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// AC-5 — THE SHIP WHERE IT REALLY IS, AND THE LINE TO WHERE A BURN WOULD GO
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('AC-5 — the ship diamond and the trajectory', () => {
  it('⛔ THE DIAMOND\'s TEXEL IS THE FOCUSED BODY\'s DRAWN TEXEL, IN BOTH DESIGNS', async () => {
    // ⭐ DRIVEN THROUGH THE GAME'S OWN SETTER — `nav.setCurrentBody(focusIndex, moonIndex)`
    //    (NavComputer.js:1173), which is how the running game tells the nav where the ship is; the
    //    fields themselves are never poked.
    // ⭐ THE ABSOLUTE FACT: `SP.diam5`'s centre row is a 5x1 fill at `(x - 2, y)`, and `x`/`y` here
    //    are read off `S.bodyHits` — the array the PAINTER published for that very planet. So this
    //    compares the ship's texel with the body's texel, with neither number computed in this file.
    // ⛔ MUTANT `ship-fixed-offset` — restore design 2's `sprite(g, cxp + 8, cyp, SP.diam5)`: the
    //    5x1 SHIP-ink row is at the pane's centre instead of on planet 0 and this goes red.
    const h = await loadedNav();
    for (const [mode, design] of [['rail', 1], ['bars', 2]]) {
      const nav = await at(h, mode, 4);
      nav.setCurrentBody(0, -1);
      nav.render();
      const p = paint(nav, design);
      expect(p.D.ship, `design ${design}: the ship is published in the current system`).toEqual({ planetIndex: 0, moonIndex: -1 });

      const row = p.D.bodies.find((b) => b.kind === 'planet' && b.pIdx === 0);
      const hit = hitFor(p.S, row);
      expect(hit, `design ${design}: the painter drew planet 0`).toBeTruthy();
      const centre = shipFills(p).find((f) => f.w === 5 && f.h === 1);
      expect(centre, `design ${design}: the diamond's 5-texel centre row`).toBeTruthy();
      expect({ x: centre.x, y: centre.y }, `design ${design}: the diamond stands ON planet 0's mark`)
        .toEqual({ x: Math.round(hit.x) - 2, y: Math.round(hit.y) });
      expect(inRegion(p, 'map').map((l) => l.s), `design ${design}: the word`).toContain('SHIP');
      expect(p.violations, `design ${design}: the mark guard stays silent`).toBe(0);
    }
  }, 180000);

  it('⭐ AT A MOON THE DIAMOND MOVES ONTO THAT MOON\'s PIP', async () => {
    // ⭐ `moonIndex >= 0` is legacy's "offset onto the moon band"; on these two pictures the moon
    //    band IS the pip strip (design 2) and the pip column (design 1) — the only place either
    //    design draws a moon at this level. The pip's texel is read off `S.bodyHits` again.
    // ⛔ MUTANT `ship-ignores-moonIndex` — drop the `mi >= 0` branch in `shipHit`: the diamond stays
    //    on the planet and this goes red in both designs.
    const h = await loadedNav();
    for (const [mode, design] of [['rail', 1], ['bars', 2]]) {
      const nav = await at(h, mode, 4);
      nav.setCurrentBody(4, 1);                 // planet 4 has three moons in the fixture
      nav.render();
      const p = paint(nav, design);
      const row = p.D.bodies.find((b) => b.kind === 'planet' && b.pIdx === 4);
      const pip = (p.S.bodyHits || []).find((z) => z.ref === row && z.moon === 1);
      expect(pip, `design ${design}: the painter drew moon 1's pip`).toBeTruthy();
      const centre = shipFills(p).find((f) => f.w === 5 && f.h === 1);
      expect({ x: centre.x, y: centre.y }, `design ${design}: the diamond is on the pip`)
        .toEqual({ x: Math.round(pip.x) - 2, y: Math.round(pip.y) });
    }
  }, 180000);

  it('⛔ AT THE STAR (-1 AND -2) THE DIAMOND IS ON THE PRIMARY', async () => {
    // ⛔ MUTANT `ship-star-falls-through` — treat `planetIndex < 0` as "no ship": nothing draws and
    //    the diamond's row is missing. Both -1 (system overview) and -2 (docked at the star) are
    //    legacy's own values for "at the centre" (NavComputer.js:2909).
    const h = await loadedNav();
    for (const idx of [-1, -2]) {
      const nav = await at(h, 'bars', 4);
      nav.setCurrentBody(idx, -1);
      nav.render();
      const p = paint(nav, 2);
      const star = (p.S.bodyHits || []).find((z) => z.star);
      const centre = shipFills(p).find((f) => f.w === 5 && f.h === 1);
      expect({ x: centre.x, y: centre.y }, `focus ${idx}: the diamond is on the primary`)
        .toEqual({ x: Math.round(star.x) - 2, y: Math.round(star.y) });
    }
  }, 180000);

  it('⛔ THE TRAJECTORY RUNS TO THE SELECTED BODY, STOPS SHORT OF IT, AND ENDS IN A CHEVRON', async () => {
    // ⭐ DRIVEN BY A REAL CLICK on a drawn mark, so the selection arrives through the shipped picker.
    // ⭐ THE ABSOLUTE FACTS: (1) with a body selected there are SHIP-ink texels strictly between the
    //    two marks; (2) none of them is within 3 texels of the target's centre — the line stops short
    //    so it cannot erase the body it points at — and (3) the nearest ones to the target are the
    //    three chevron texels, at 4 back.
    // ⛔ MUTANT `trajectory-to-centre` — run the line to `tp.x, tp.y` with no `BACK`: texels land on
    //    the target's own mark and part (2) goes red.
    const h = await loadedNav();
    const nav = clearSelection(await at(h, 'bars', 4));
    nav.setCurrentBody(0, -1);
    nav.render();
    const before = paint(nav, 2);
    expect(trajectoryDots(before).length, 'with nothing selected there is no line — the diamond\'s two rows').toBe(2);

    const outer = before.D.bodies.filter((b) => b.kind === 'planet').reduce((m, b) => (b.au > m.au ? b : m));
    const t = hitFor(before.S, outer);
    hoverAt(nav, t.x + 0.5, t.y + 0.5);
    clickAt(nav, t.x + 0.5, t.y + 0.5);
    nav.render();
    expect(nav._viewDriverInst.D.selBody, 'the click must have selected the outer planet').toBe(outer);

    const p = paint(nav, 2);
    const th = hitFor(p.S, outer), sh = hitFor(p.S, p.D.bodies.find((b) => b.kind === 'planet' && b.pIdx === 0));
    const dots = trajectoryDots(p);
    expect(dots.length, 'a trajectory drew where there was none').toBeGreaterThan(5);
    const near = Math.min(...dots.map((f) => Math.hypot(f.x - th.x, f.y - th.y)));
    expect(near, 'no texel of the line lands on the body it points at').toBeGreaterThanOrEqual(3);
    expect(near, 'and the chevron sits 4 texels back from it').toBeLessThanOrEqual(5);
    const far = Math.max(...dots.map((f) => Math.hypot(f.x - sh.x, f.y - sh.y)));
    expect(far, 'the line reaches most of the way across').toBeGreaterThan(Math.hypot(th.x - sh.x, th.y - sh.y) / 2);
    expect(p.violations).toBe(0);
  }, 180000);

  it('⭐ THE HOVERED BODY WINS OVER THE SELECTED ONE, WHICH IS LEGACY\'s OWN RULE', async () => {
    // ⭐ Legacy: `const target = this._hoveredBody || this._selectedBody` (NavComputer.js:2960). So
    //    with planet 7 selected and the pointer on planet 2, the line goes to planet 2 — a preview
    //    of the burn the pilot is considering, which is the whole reason the hover feeds it.
    // ⭐ THE ABSOLUTE FACT: the chevron's three texels sit within 5 of the HOVERED body's published
    //    mark and further than 5 from the SELECTED one.
    // ⛔ MUTANT `trajectory-selection-only` — read `D.selBody` and ignore `S.hover`: the nearest
    //    texel to the hovered planet is the whole line's length away and this goes red.
    const h = await loadedNav();
    const nav = clearSelection(await at(h, 'bars', 4));
    nav.setCurrentBody(0, -1);
    nav.render();
    const p0 = paint(nav, 2);
    const planets = p0.D.bodies.filter((b) => b.kind === 'planet');
    const sel = planets[planets.length - 1], hov = planets[2];
    const selHit = hitFor(p0.S, sel);
    hoverAt(nav, selHit.x + 0.5, selHit.y + 0.5);
    clickAt(nav, selHit.x + 0.5, selHit.y + 0.5);
    nav.render();
    expect(nav._viewDriverInst.D.selBody, 'the outermost planet is selected').toBe(sel);

    const hovHit = hitFor(paint(nav, 2).S, hov);
    hoverAt(nav, hovHit.x + 0.5, hovHit.y + 0.5);
    const p = paint(nav, 2);
    expect(p.S.hover && p.S.hover.kind, 'the pointer is on a body').toBe('body');
    const dots = trajectoryDots(p);
    const toHov = Math.min(...dots.map((f) => Math.hypot(f.x - hovHit.x, f.y - hovHit.y)));
    const toSel = Math.min(...dots.map((f) => Math.hypot(f.x - selHit.x, f.y - selHit.y)));
    expect(toHov, 'the chevron is at the HOVERED body').toBeLessThanOrEqual(5);
    expect(toSel, 'and nowhere near the selected one').toBeGreaterThan(5);
  }, 180000);

  it('⛔ NOTHING DRAWS WHEN THE TARGET IS THE SHIP\'s OWN BODY, AND NOTHING AT ALL IN A FOREIGN SYSTEM', async () => {
    // ⭐ Two absences, each with its own cause: the first is `tp !== sp`, the second is `D.ship` being
    //    null because `D.isCurrent` is false (the host's 0.1 pc identity test).
    // ⛔ MUTANT `trajectory-self` — drop the `tp !== sp` guard: an arrowhead lands on the diamond and
    //    the first count goes up. MUTANT `ship-ungated` — read `nav._currentFocusIndex` instead of
    //    `D.ship`: the foreign half goes red.
    const h = await loadedNav();
    const nav = clearSelection(await at(h, 'bars', 4));
    nav.setCurrentBody(0, -1);
    nav.render();
    const ship = hitFor(paint(nav, 2).S, nav._viewDriverInst.D.bodies.find((b) => b.kind === 'planet' && b.pIdx === 0));
    hoverAt(nav, ship.x + 0.5, ship.y + 0.5);
    clickAt(nav, ship.x + 0.5, ship.y + 0.5);
    nav.render();
    const p = paint(nav, 2);
    expect(p.D.selBody && p.D.selBody.pIdx, 'the ship\'s own planet is now selected').toBe(0);
    expect(trajectoryDots(p).length,
           'no line, no chevron — only the diamond\'s own two 1-wide rows').toBe(2);

    for (const [mode, design] of [['rail', 1], ['bars', 2]]) {
      const foreign = await at(h, mode, 4, { current: false });
      foreign.setCurrentBody(0, -1);
      foreign.render();
      const q = paint(foreign, design);
      expect(q.D.isCurrent, `design ${design}: the fixture must be a FOREIGN system`).toBe(false);
      expect(q.D.ship, `design ${design}: and the ship is not published there`).toBeNull();
      expect(shipFills(q).length, `design ${design}: nothing of AC-5 draws in a foreign system`).toBe(0);
      expect(q.text, `design ${design}: and no word`).not.toContain('SHIP');
    }
  }, 240000);
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// THE REGRESSION SURFACE — WHAT THIS WAVE MAY NOT TOUCH
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('wave 2a — the levels this wave does not touch, and the guard', () => {
  it('⛔ THE SHIP ADDS NOTHING OUTSIDE SYSTEM: LEVELS 0-3 HASH THE SAME WITH IT AND WITHOUT IT', async () => {
    // ⭐ THE DURABLE FORM OF THE BEFORE/AFTER MEASUREMENT IN THIS FILE'S HEADER, and it needs no
    //    constant: the same nav is painted at each level with `D.ship` published and again with it
    //    null, and the two fill streams must hash identically. `D.ship` is the ONLY input AC-5 added,
    //    so a painter that read it anywhere but at SYSTEM shows up here whatever the absolute hashes
    //    happen to be on the day — which is what makes this survive three lanes mutating one tree.
    // ⛔ MUTANT `drawShip-called-from-d1TwoD` (or from `d2Prism`): the two hashes part at that level.
    const h = await loadedNav();
    for (const [mode, design] of [['rail', 1], ['bars', 2]]) {
      for (const level of [0, 1, 2, 3]) {
        const nav = await at(h, mode, level);
        nav.setCurrentBody(3, 0);
        nav.render();
        const withShip = paint(nav, design);
        const { D } = nav._viewDriverInst;
        const keep = D.ship; D.ship = null;
        const without = paint(nav, design);
        D.ship = keep;
        expect(without.hash, `design ${design} L${level}: the ship draws nothing here`).toBe(withShip.hash);
      }
    }
  }, 300000);

  it('⛔ THE MARK GUARD IS SILENT ACROSS BOTH DESIGNS x FIVE LEVELS, ZOOMED AND NOT', async () => {
    // ⭐ The guard is `assertFits` (through every `T()`) and `assertMark` (every mark the orrery
    //    draws). AC-6 is the reason the zoomed sweep is here: the rings, the bodies, the pips and the
    //    labels all move with the wheel, and an unclipped ring at 5.0 overshoots the pane by ~800
    //    texels per side.
    // ⛔ MUTANT `dottedEllipse-unclipped` / `orbit-ring-assertMark-unclipped` — pass no clip, or hand
    //    the guard the unclipped box: the zoomed sweep fires on every ring.
    const h = await loadedNav();
    for (const [mode, design] of [['rail', 1], ['bars', 2]]) {
      for (const level of [0, 1, 2, 3, 4]) {
        const nav = await at(h, mode, level);
        if (level === 4) { nav.setCurrentBody(5, 2); nav.render(); }
        const p = paint(nav, design);
        expect(p.viol, `design ${design} L${level}: ${p.viol.join(' | ')}`).toEqual([]);
      }
      const nav = await at(h, mode, 4);
      nav.setCurrentBody(0, -1);
      for (const [dir, n] of [[-100, 12], [100, 24]]) {
        for (let i = 0; i < n; i++) nav._handleWheel({ deltaY: dir, preventDefault() {} });
        nav.render();
        const p = paint(nav, design);
        expect(p.viol, `design ${design} at zoom ${nav._systemZoom.toFixed(2)}: ${p.viol.join(' | ')}`).toEqual([]);
      }
    }
  }, 300000);

  it('⛔ A ZOOMED BODY THAT HAS LEFT THE PANE IS NEITHER DRAWN NOR PICKABLE', async () => {
    // ⭐ AC-19's rule at the one site the zoom can now reach: `d1Ladder`'s `vis()` applied to the
    //    orrery. Every published `S.bodyHits` entry must have its centre inside `REGIONS.map` — a hit
    //    left behind for a mark nobody drew is a click that selects an invisible body.
    // ⛔ MUTANT `no-onPane-cull` — delete the `if (!onPane(x, y)) return;`: at 5.0 the outer planets
    //    publish hits far outside the pane and this goes red.
    const h = await loadedNav();
    const nav = await at(h, 'bars', 4);
    for (let i = 0; i < 12; i++) nav._handleWheel({ deltaY: -100, preventDefault() {} });
    nav.render();
    const p = paint(nav, 2);
    expect(p.S.sysCam.zoom).toBeCloseTo(5, 9);
    const map = p.regions.map;
    const outside = (p.S.bodyHits || []).filter(
      (z) => !(z.x >= map.x && z.x < map.x + map.w && z.y >= map.y && z.y < map.y + map.h));
    expect(outside.map((z) => (z.ref && z.ref.name) || 'star'), 'no hit outside the pane').toEqual([]);
    expect((p.S.bodyHits || []).length, 'and the picture still has marks on it').toBeGreaterThan(0);
  }, 180000);
});

