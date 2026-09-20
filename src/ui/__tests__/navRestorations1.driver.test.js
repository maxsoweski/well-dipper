/**
 * navRestorations1.driver — THE DRIVER'S HALF OF WAVE 1 (nav-restorations-2026-09-20).
 *
 * Three fields, published by the driver and read by the LAB in a later wave:
 *
 *   `S.hover`        AC-1 — what the pointer is on, at every level, in both designs.
 *   `D.ship`         AC-5 (wave 2) — where the ship really is, gated on the host's `_isCurrentSystem()`.
 *   `S.sysCam.zoom`  AC-6 (wave 2) — the wheel's own magnification, which until now nothing drew.
 *
 * ── ⛔ THE STANDARD, INHERITED FROM navDefects2026.driver / navDefects2026w2.driver ─────────────
 *
 * A pointer move goes through `nav._handleMouseMove` and then a REAL frame; a wheel notch goes
 * through `nav._handleWheel`; a close goes through the driver method the host's fold on
 * `NavComputer.js:620` calls. Every assertion is an absolute fact — a `kind` string, an identity
 * against a live `_localStars` entry, a kpc pair to 1e-9, a number — and never a restatement of a
 * layout. Where a coordinate is asserted it is derived from the INSTRUMENT'S own fields
 * (`_viewCenter`, `_viewSize`) through `_handleClick`'s own drill arithmetic (`NavComputer.js:4652-
 * 4657`), not from the driver's copy of them, so the two can be caught disagreeing.
 *
 * ── ⭐⭐ AND TWO CASES READ `S.hover` DURING THE PAINT, WHICH IS THE ONLY PLACE IT MATTERS ───────
 *
 * `S.hover` is written at the TAIL of `render()` and read by the NEXT frame's paint. So the two
 * lifetime rules the seam fixes — "not cleared by `resetPicks()`", "cleared on a level change" —
 * are invisible at the tail of a frame: `resolveHover` republishes the field on every exit, so a
 * clear placed anywhere upstream of it leaves the same value behind at the end. `probeContext()`
 * below therefore drives `drv.render()` with a 2D context that samples `drv.S.hover` on the FIRST
 * `fillRect` of the frame — the design's own opening full-canvas fill — which is the instant a
 * painter would read it. That is a real frame, through the real driver, with the real designs.
 *
 * ── ⚠ WHAT THIS FILE DOES NOT CLAIM ─────────────────────────────────────────────────────────────
 *
 * Nothing here says a callout is DRAWN. No painter reads any of the three fields this wave, by
 * design: the lab's AC-1/AC-5/AC-6 land separately and the seam is what lets them. These cases pin
 * the half the driver owns, and they pass before and after the lab's half arrives.
 */

import { describe, it, expect } from 'vitest';
import { makeHeadlessNav } from './helpers/headlessNav.mjs';

const W = 417, H = 240;   // ⭐ MAX'S OWN BUFFER — the size every number below is measured at.

/**
 * `gridNForLevel` is module-private in `NavComputer.js:71`; these are its two constants, restated
 * here ON PURPOSE so the expected tile centre is derived from the HOST's vocabulary rather than
 * from the projection the driver inverted. Every case that uses them also asserts that
 * `S.mapProj.n` agrees, so a fixture that has gone stale fails loudly instead of quietly agreeing
 * with itself.
 */
const HOST_GRID_N = { 1: 8, 2: 16 };

/** A nav with the prism loaded and a design on, at `level`. */
async function designNav({ mode = 'rail', level = 3 } = {}) {
  const h = await makeHeadlessNav({ width: W, height: H });
  h.nav._viewModesEnabled = true;
  h.nav._levelIndex = 3;
  h.nav.viewMode = mode;
  h.nav.render();                       // populates _localStars via _renderLocal's own loader
  if (level !== 3) { h.nav._levelIndex = level; h.nav.render(); }
  h.drv = h.nav._viewDriverInst;
  return h;
}

/**
 * Stand the pilot ON the nearest loaded star and give it a system, so `_isCurrentSystem()` is true.
 *
 * ⛔ THE STAR IS THE NEAREST LOADED ONE, NOT A LITERAL. "Home" is the host's 0.1 pc identity test
 *    against `_playerX/Y/Z` (`D.isCurrent`), never a seed comparison — `D.sysStar.seed` is the
 *    string 'Sol' in Sol — so a made-up star is a FOREIGN system and `D.ship` would be `null` for
 *    the wrong reason. Copied from navDefects2026.design.test.js:128-150.
 */
function standOnSystem(nav, { planets = 4, moonsOn = 1, belts = 1 } = {}) {
  nav._systemStar = nav._localStars.reduce((m, s) => (m == null || s.dist < m.dist ? s : m), null);
  if (nav._systemStar) {
    nav._playerX = nav._systemStar.wx; nav._playerY = nav._systemStar.wy; nav._playerZ = nav._systemStar.wz;
  }
  nav._systemData = {
    star: { type: 'G' }, zones: { hzInnerAU: 0.9, hzOuterAU: 1.4 },
    asteroidBelts: Array.from({ length: belts }, (_, i) => ({ centerRadiusAU: 3.2 + i })),
    planets: Array.from({ length: planets }, (_, i) => ({
      orbitRadiusAU: 0.4 + i * 0.9, orbitAngle: i * 1.1,
      moons: i === moonsOn ? [{ type: 'rock', radiusEarth: 0.2, orbitRadiusEarth: 30 }] : [],
      planetData: { radiusEarth: 1 + (i % 4), T_eq: 260, habitability: { score: 0.2 }, rings: false },
    })),
  };
  nav._currentSystemData = nav._systemData;
  nav._levelIndex = 4;
  nav.render();
}

/** Move the pointer there and let a REAL frame resolve it. Returns this frame's `S.hover`. */
function hoverHere(h, x, y) {
  h.nav._handleMouseMove({ clientX: x, clientY: y });
  h.nav.render();
  return h.drv.S.hover;
}

/**
 * A 2D context that samples `S.hover` at the FIRST fill of the frame — i.e. inside the paint.
 *
 * ⛔ IT CANNOT BE `makeRecordingContext`: that Proxy's `set()` swallows every assignment, and the
 *    designs assign `fillStyle` constantly. This one keeps a real backing object so the paint runs
 *    exactly as it does on the glass, and records nothing but the moment.
 */
function probeContext(drv) {
  const seen = { taken: false, hover: undefined, fills: 0 };
  const base = { fillStyle: '#000', imageSmoothingEnabled: false };
  const ctx = new Proxy(base, {
    get(t, k) {
      if (k === 'fillRect') return () => {
        seen.fills++;
        if (!seen.taken) { seen.taken = true; seen.hover = drv.S.hover; }
      };
      if (k in t) return t[k];
      if (typeof k === 'symbol') return undefined;
      return () => {};
    },
    set(t, k, v) { t[k] = v; return true; },
    has() { return true; },
  });
  return { ctx, seen };
}

/** Where each level's pick lands on the HOST — `picking.js:53`'s own table, which is the contract. */
const HOST_FIELD = ['_hoveredTile', '_hoveredTile', '_hoveredTile', '_hoveredLocalStar', '_hoveredBody'];

/**
 * Sweep the drawn map pane for a point the driver resolves to something, then hover it for real.
 *
 * ⛔ SWEPT, NOT COMPUTED. Where a design puts a star mark or a planet pip is the PAINT's business,
 *    and a test that predicted it would be a second copy of draw code that is lifted verbatim from
 *    the lab. This looks for the thing the way a pilot does: put the cursor somewhere, see what
 *    lights up — the same discipline as `helpers/headlessNav.mjs`'s own `findHoverPoint`.
 *
 * ⚠ THE SWEEP READS THE **HOST'S** FIELD, NOT `S.hover`, AND THAT IS DELIBERATE TWICE OVER.
 *   (a) It is cheap: `drv.hover()` is the entry `_handleMouseMove` calls and it re-picks against the
 *       geometry the LAST frame published, so a sweep costs one hit-test per point instead of a full
 *       repaint — a `render()`-per-texel sweep of a 240p pane exhausts the heap.
 *   (b) It cannot beg the question. A sweep that looked for `S.hover` would find nothing at all if
 *       `S.hover` were never published, and the case would die by timeout or OOM instead of by an
 *       assertion — which is not a red test, it is a broken one. The host's field is written by the
 *       SAME call and by code this workstream does not touch, so the fixture stands whether or not
 *       the field under test works.
 *
 * `pred` therefore takes the HOST's picked object. On return the pointer IS at the reported point,
 * ONE real frame has resolved it, and `found.hover` is whatever `S.hover` then held — `null`
 * included, which is exactly the shape a broken publication has to be able to report.
 */
function sweepHover(h, pred, { step = 3 } = {}) {
  const m = h.drv.regions().map;
  const field = HOST_FIELD[h.drv.S.level] || '_hoveredTile';
  for (let y = Math.floor(m.y) + 1; y < m.y + m.h - 1; y += step) {
    for (let x = Math.floor(m.x) + 1; x < m.x + m.w - 1; x += step) {
      h.drv.hover(x + 0.5, y + 0.5, W, H);        // the middle of the texel row
      const hb = h.nav[field];
      if (!hb || !pred(hb)) continue;
      // ⭐ ONE real frame, at the point the cheap scan found. The frame is what publishes `S.hover`.
      const hv = hoverHere(h, x + 0.5, y + 0.5);
      return { x: x + 0.5, y: y + 0.5, hover: hv, host: h.nav[field] };
    }
  }
  return null;
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('AC-1 — S.hover carries what the pointer is on, at every level, in both designs', () => {
// ══════════════════════════════════════════════════════════════════════════════════════════════════

  for (const mode of ['rail', 'bars']) {
    it(`⭐ ${mode}: GALAXY publishes kind 'sector' and the sector row itself`, async () => {
      const h = await designNav({ mode, level: 0 });
      const found = sweepHover(h, (hb) => !!hb.sector);
      expect(found, `${mode} at GALAXY resolved no sector anywhere in its map pane`).toBeTruthy();
      const hv = found.hover;
      expect(hv, `${mode} at GALAXY published no S.hover for a sector the host did pick`).toBeTruthy();
      expect(hv.kind).toBe('sector');
      expect(hv.level).toBe(0);
      expect(typeof hv.ref.name, 'the sector row carries no name to print').toBe('string');
      expect(hv.ref.name.length).toBeGreaterThan(0);
      // ⭐ THE SAME OBJECT THE HOST WILL DRILL. `_handleClick`'s level-0 branch flies to
      //   `_hoveredTile.sector.centerX/centerZ/size`; the callout must not be naming a different one.
      expect(hv.ref, 'S.hover.ref is not the sector the click would drill')
        .toBe(h.nav._hoveredTile.sector);
      expect(hv.sx).toBe(found.x); expect(hv.sy).toBe(found.y);
    }, 120000);

    for (const level of [1, 2]) {
      it(`⭐⭐ ${mode}: L${level} publishes the tile's kpc CENTRE, and it is where the drill flies`,
         async () => {
        const h = await designNav({ mode, level });
        const found = sweepHover(h, (hb) => Number.isFinite(hb.col));
        expect(found, `${mode} at L${level} resolved no tile anywhere in its map pane`).toBeTruthy();
        const hv = found.hover;
        expect(hv, `${mode} at L${level} published no S.hover for a tile the host did pick`).toBeTruthy();
        expect(hv.kind).toBe('tile');
        expect(hv.level).toBe(level);
        expect(hv.ref.col).toBe(h.nav._hoveredTile.col);
        expect(hv.ref.row).toBe(h.nav._hoveredTile.row);

        // ── THE INDEPENDENT DERIVATION: the host's own drill arithmetic (NavComputer.js:4652-4657)
        //    over the INSTRUMENT'S fields, not the driver's mirror of them.
        const gn = HOST_GRID_N[level];
        expect(h.drv.S.mapProj.n, 'the drawn grid is not the host\'s subdivision').toBe(gn);
        const tileSize = h.nav._viewSize / gn;
        const ext = h.nav._viewSize / 2;
        const kx = h.nav._viewCenter.x - ext + (hv.ref.col + 0.5) * tileSize;
        const kz = h.nav._viewCenter.z + ext - (hv.ref.row + 0.5) * tileSize;
        expect(hv.ref.kx, 'kx is not the centre of the tile the click would drill').toBeCloseTo(kx, 9);
        expect(hv.ref.kz, 'kz is not the centre of the tile the click would drill').toBeCloseTo(kz, 9);

        // ⛔ AND THE Z-FLIP IS LOAD-BEARING: the mirrored tile is a plausible coordinate and the
        //    wrong one. Assert the two differ wherever the row is not the middle of the grid.
        const mirrored = h.nav._viewCenter.z + ext - (gn - 1 - hv.ref.row + 0.5) * tileSize;
        if (hv.ref.row !== (gn - 1) / 2) {
          expect(Math.abs(hv.ref.kz - mirrored),
            'the fixture sits on the grid\'s mirror line, so the flip is untested here')
            .toBeGreaterThan(tileSize / 4);
        }
      }, 120000);
    }

    it(`⭐ ${mode}: PRISM publishes kind 'star' and the live D.stars row`, async () => {
      const h = await designNav({ mode, level: 3 });
      const found = sweepHover(h, (hb) => !!hb.star);
      expect(found, `${mode} at PRISM resolved no star anywhere in its map pane`).toBeTruthy();
      const hv = found.hover;
      expect(hv, `${mode} at PRISM published no S.hover for a star the host did pick`).toBeTruthy();
      expect(hv.kind).toBe('star');
      expect(hv.level).toBe(3);
      // ⛔ THE LIVE `_localStars` ENTRY, BY IDENTITY — not the ranked copy the adapter made, and not
      //    a lookalike. It is the same object `_handleClick` drills out of `_hoveredLocalStar`.
      expect(h.nav._localStars.includes(hv.ref),
        'S.hover.ref is not a row of the live star list').toBe(true);
      expect(hv.ref, 'S.hover.ref is not the star the click would drill')
        .toBe(h.nav._hoveredLocalStar.star);
      for (const f of ['seed', 'spectral', 'dist', 'wy']) {
        expect(hv.ref[f], `the star row carries no ${f} for a callout to print`).not.toBe(undefined);
      }
    }, 120000);

    it(`⭐ ${mode}: SYSTEM publishes kind 'body' with the D.bodies row of the hovered planet`,
       async () => {
      const h = await designNav({ mode, level: 3 });
      standOnSystem(h.nav);
      const found = sweepHover(h, (hb) => hb.type === 'planet');
      expect(found, `${mode} at SYSTEM resolved no planet anywhere in its map pane`).toBeTruthy();
      const hv = found.hover;
      expect(hv, `${mode} at SYSTEM published no S.hover for a planet the host did pick`).toBeTruthy();
      expect(hv.kind).toBe('body');
      expect(hv.ref.type).toBe('planet');
      expect(hv.level).toBe(4);
      expect(hv.ref.row, 'no D.bodies row came with the body').toBeTruthy();
      expect(hv.ref.row.kind).toBe('planet');
      expect(h.drv.D.bodies.includes(hv.ref.row), 'the row is not one of D.bodies').toBe(true);
      // The facts legacy's own SYSTEM tooltip prints (NavComputer.js:2858-2893) are all on the row.
      for (const f of ['name', 'au', 'cls', 'rE', 'T', 'moons']) {
        expect(hv.ref.row[f], `the body row carries no ${f}`).not.toBe(undefined);
      }
      // ⛔ AND IT NAMES THE SAME BODY THE CLICK WOULD SELECT — the identity, not the raw candidate.
      expect(hv.ref.index).toBe(h.nav._hoveredBody.index);
      expect(hv.ref.planetIndex).toBe(h.nav._hoveredBody.index);
      expect(hv.ref.row.pIdx).toBe(h.nav._hoveredBody.index);
    }, 120000);

    it(`⛔ ${mode}: empty map publishes null — a callout does not survive the cursor leaving`,
       async () => {
      const h = await designNav({ mode, level: 3 });
      const found = sweepHover(h, (hb) => !!hb.star);
      expect(found, 'nothing was hovered, so there is nothing to clear').toBeTruthy();
      expect(h.drv.S.hover, 'nothing was published, so there is nothing to clear').toBeTruthy();
      // The tab strip: outside every design's map pane at every level, and never a map candidate.
      const hv = hoverHere(h, 3.5, H - 3.5);
      expect(hv, 'S.hover survived the pointer leaving the map').toBe(null);
      expect(h.nav._hoveredLocalStar, 'and so did the host\'s own hover field').toBe(null);
    }, 120000);
  }
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('AC-1 — S.hover\'s lifetime: it outlives the frame, and dies with the level and the nav', () => {
// ══════════════════════════════════════════════════════════════════════════════════════════════════

  it('⭐⭐ IT IS STILL THERE WHEN THE NEXT FRAME PAINTS — `resetPicks()` does not clear it', async () => {
    const h = await designNav({ mode: 'rail', level: 3 });
    const found = sweepHover(h, (hb) => !!hb.star);
    expect(found, 'nothing was hovered, so the case is vacuous').toBeTruthy();
    expect(h.drv.S.hover, 'nothing was published, so the lifetime cannot be tested').toBeTruthy();
    const star = h.drv.S.hover.ref;

    // The NEXT frame, at the same pointer, sampled at its first fill — the instant a painter reads.
    const { ctx, seen } = probeContext(h.drv);
    h.drv.render(ctx, W, H);
    expect(seen.fills, 'the probe frame painted nothing at all').toBeGreaterThan(0);
    expect(seen.hover, 'S.hover was null while the frame was painting — the callout can never draw')
      .toBeTruthy();
    expect(seen.hover.kind).toBe('star');
    expect(seen.hover.ref, 'the paint saw a different star from the one the pointer is on').toBe(star);
  }, 120000);

  it('⭐⭐ AND IT IS GONE BEFORE THE NEW LEVEL PAINTS', async () => {
    const h = await designNav({ mode: 'rail', level: 3 });
    const found = sweepHover(h, (hb) => !!hb.star);
    expect(found, 'nothing was hovered, so the case is vacuous').toBeTruthy();
    expect(h.drv.S.hover, 'nothing was published, so the clear cannot be tested').toBeTruthy();
    expect(h.drv.S.hover.kind).toBe('star');

    h.nav._levelIndex = 1;                       // the level moves; the pointer does not
    const { ctx, seen } = probeContext(h.drv);
    h.drv.render(ctx, W, H);
    expect(seen.fills, 'the probe frame painted nothing at all').toBeGreaterThan(0);
    expect(seen.hover,
      'SECTOR painted with PRISM\'s star still on S.hover — a callout naming a star not on the glass')
      .toBe(null);
  }, 120000);

  it('⭐ AND THE NAV CLOSING TAKES IT WITH IT (`onDeactivate`)', async () => {
    const h = await designNav({ mode: 'rail', level: 3 });
    const found = sweepHover(h, (hb) => !!hb.star);
    expect(found, 'nothing was hovered, so the case is vacuous').toBeTruthy();
    expect(h.drv.S.hover, 'nothing was published, so the close cannot be tested').toBeTruthy();

    h.drv.onDeactivate();                        // the method the host's fold on :620 calls
    expect(h.drv.S.hover, 'the nav closed with a callout still armed').toBe(null);

    // ⛔ AND THE FIRST FRAME AFTER A REOPEN CANNOT REPUBLISH IT EITHER. The pointer has not moved,
    //    so nothing but the driver's own carried-over pick could put it back.
    const { ctx, seen } = probeContext(h.drv);
    h.drv.render(ctx, W, H);
    expect(seen.hover, 'the reopened nav painted the callout it closed with').toBe(null);
  }, 120000);
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('AC-5 / AC-6 — D.ship and S.sysCam.zoom mirror the host\'s own fields', () => {
// ══════════════════════════════════════════════════════════════════════════════════════════════════

  it('⭐ D.ship carries the focus indices at home, and is null in a foreign system', async () => {
    const h = await designNav({ mode: 'bars', level: 3 });
    standOnSystem(h.nav);
    expect(h.drv.D.isCurrent, 'the fixture did not stand the pilot on the system').toBe(true);

    // The game writes both through the setter at NavComputer.js:1174-1175.
    h.nav.setCurrentBody(2, 1);
    h.nav.render();
    expect(h.drv.D.ship).toEqual({ planetIndex: 2, moonIndex: 1 });

    h.nav.setCurrentBody(-1, -1);   // parked at the star
    h.nav.render();
    expect(h.drv.D.ship).toEqual({ planetIndex: -1, moonIndex: -1 });

    // ⛔ AND THE GATE IS THE HOST'S 0.1 pc IDENTITY TEST, NOT A SEED COMPARISON. Move the ship a
    //    kiloparsec away and the same indices must stop meaning anything — otherwise SHIP paints
    //    onto a planet of a system the ship is not in.
    h.nav.setCurrentBody(2, -1);
    h.nav._playerX += 1.0;
    h.nav.render();
    expect(h.drv.D.isCurrent).toBe(false);
    expect(h.drv.D.ship, 'a foreign system still reported a ship position').toBe(null);
  }, 120000);

  it('⭐ S.sysCam.zoom follows the WHEEL, notch for notch, and keeps the host\'s clamps', async () => {
    const h = await designNav({ mode: 'bars', level: 3 });
    standOnSystem(h.nav);
    expect(h.drv.S.sysCam.zoom, 'the orrery did not open at 1.0').toBe(1);

    const wheel = (deltaY) => { h.nav._handleWheel({ deltaY, preventDefault() {} }); h.nav.render(); };

    wheel(-100);                                  // one notch in: the host's own 1.15
    expect(h.nav._systemZoom).toBeCloseTo(1.15, 9);
    expect(h.drv.S.sysCam.zoom, 'the wheel moved the instrument and not the design')
      .toBeCloseTo(h.nav._systemZoom, 12);

    wheel(100); wheel(100);                       // and out again, past where it started
    expect(h.drv.S.sysCam.zoom).toBeCloseTo(h.nav._systemZoom, 12);
    expect(h.drv.S.sysCam.zoom).toBeLessThan(1);

    for (let i = 0; i < 40; i++) wheel(-100);     // past the host's upper clamp
    expect(h.nav._systemZoom).toBe(5);
    expect(h.drv.S.sysCam.zoom, 'the design read a zoom the instrument does not hold').toBe(5);

    for (let i = 0; i < 60; i++) wheel(100);      // and past the lower one
    expect(h.nav._systemZoom).toBe(0.3);
    expect(h.drv.S.sysCam.zoom).toBe(0.3);
  }, 120000);

  it('⛔ and both have a default before any frame — an undefined multiplier draws NaN', async () => {
    const { makeViewState } = await import('../navViewModes/state.js');
    const { S, D } = makeViewState();
    expect(S.hover, 'S.hover has no declared default').toBe(null);
    expect(S.sysCam.zoom, 'S.sysCam.zoom has no declared default').toBe(1);
    expect(D.ship, 'D.ship has no declared default').toBe(null);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('LEGACY — viewMode null publishes nothing, because no driver exists to publish it', () => {
// ══════════════════════════════════════════════════════════════════════════════════════════════════

  it('⛔ a hover and a frame in the legacy look build no driver at all', async () => {
    const h = await makeHeadlessNav({ width: W, height: H });
    h.nav._viewModesEnabled = true;
    h.nav._levelIndex = 3;
    expect(h.nav.viewMode).toBe(null);
    h.nav.render();
    h.nav._handleMouseMove({ clientX: 200, clientY: 100 });
    h.nav.render();
    expect(h.nav._viewDriverInst, 'the legacy look instantiated the view-mode driver').toBe(null);
    // The legacy painters own the hover fields under `viewMode === null`, exactly as before.
    expect(h.nav._mouseX).toBe(200);
  }, 120000);
});
