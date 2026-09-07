/**
 * navPicking — THE PICKERS, THE CAMERA, THE SORT, AND THE KEYS' DRIVER METHODS.
 *
 * ── ⛔⛔ THE ONE CASE THIS FILE EXISTS FOR, AND THE ONE THE EXISTING SUITE CANNOT SEE ────────────
 *
 * `navViewModes.test.js:260-280` picks a star off the list and clicks it, and it is green. On the
 * running game that same walk acts on the WRONG STAR, because the legacy painters run FIRST under
 * every mode frame — deliberately, they are also the lazy loaders — and rewrite all three hover
 * fields on the way past from `_mouseX`/`_mouseY` against the LEGACY projection. Measured, design 1
 * at PRISM, hovering rail row 2: `XND J3DK8MQE-RLZ16U6` after `hover()`, and
 * `XND J3DJFN6W+A2AFBIA` after ONE `render()`.
 *
 * The suite could not see it because it renders BEFORE the mousemove and never between the mousemove
 * and the click. Same shape as the dead `V` key: a green test whose sample contains no input that
 * could fail it. So the fence is `hover → render() → assert the field still names the thing that was
 * hovered`, and it comes with a LIVENESS CONTROL that stands the driver's re-resolution down and
 * watches the frame destroy the pick — otherwise "it survived" could just mean "nothing was ever
 * trying to overwrite it".
 *
 * ── ⭐ AND THE GEOMETRY IS READ OFF THE PAINT, NOT RESTATED IN THE TEST ─────────────────────────
 *
 * Almost every case below renders a real frame and then takes its target out of `S.mapProj`,
 * `S.prismHits`, `S.bodyHits`, `S.railTiles` or `S.listGeom` — the same publications the picker
 * reads. A test that computed its own click point would be a THIRD copy of a projection and would go
 * stale in the same silence as the second. The three places that do build a fixture say why: an
 * overlap that real data does not reliably contain, a CSS box the harness does not have, and a
 * system whose body list has the shape that makes `pIdx` differ from a slot.
 */
import { describe, it, expect } from 'vitest';
import { makeHeadlessNav, clickAt } from './helpers/headlessNav.mjs';
import { makeDesigns } from '../navViewModes/designs.js';
import { SORT_KEYS } from '../navViewModes/state.js';
import { projRect, worldAt } from '../navViewModes/picking.js';

/** `ZOOM_STOPS[0]`, read off the design code rather than retyped — a pinned copy cannot go stale. */
const ZOOM_STOPS = makeDesigns({ S: { design: 1, level: 3 }, D: {} }).ZOOM_STOPS;

/** A nav with the prism loaded, which is what every design needs before it can draw anything real. */
async function loadedNav({ width = 427, height = 240, mode = 'rail' } = {}) {
  const h = await makeHeadlessNav({ width, height });
  h.nav._viewModesEnabled = true;
  h.nav._levelIndex = 3;
  h.nav.viewMode = mode;
  h.nav.render();                       // populates _localStars via _renderLocal's own loader
  h.star = h.nav._localStars.find((s) => s.dist > 1e-9);
  h.drv = h.nav._viewDriverInst;
  return h;
}

/**
 * A system whose SHAPE is the level-4 traps at once. ⛔ BUILT, NOT FOUND — the system the seed
 * happens to load has whatever bodies it has, and "the picker uses `pIdx`, not a slot" asserts
 * nothing unless the two actually differ.
 *
 *   `D.bodies` comes out as  [ planet(1 AU) · moon · moon · BELT(3 AU) · planet(8 AU) · planet(30 AU) ]
 *
 *   · `MIDDLE` — the 8 AU planet — is `pIdx` 1 and sits at SLOT 4, while slot 1 is somebody's moon;
 *   · a moon pip has a parent to map to;
 *   · the belt at 3 AU is between two planets, which is the ordering `buildBodies` got wrong;
 *   · and there is a body BEYOND the middle one, because `d1Ladder`'s virtual axis always places
 *     the furthest body at `x1 - 8`, under the right "..." cap's grab zone.
 */
async function trappySystem(mode = 'rail') {
  const h = await loadedNav({ mode });
  h.nav._systemStar = { wx: 8, wy: 0, wz: 0, seed: 5150, spectral: 'G', name: 'Trappy' };
  h.nav._systemData = {
    star: { type: 'G' }, zones: { hzInnerAU: 0.9, hzOuterAU: 1.4 },
    asteroidBelts: [{ centerRadiusAU: 3, widthAU: 0.4 }],
    planets: [
      { orbitRadiusAU: 1.0, planetData: { radiusEarth: 1, T_eq: 280, habitability: { score: 0.8 }, rings: false },
        moons: [{ type: 'rock', radiusEarth: 0.2, T_eq: 250, orbitRadiusAU: 0.01 },
                { type: 'ice', radiusEarth: 0.1, T_eq: 180, orbitRadiusAU: 0.02 }] },
      { orbitRadiusAU: 8, planetData: { radiusEarth: 3, T_eq: 120, habitability: { score: 0 }, rings: false }, moons: [] },
      { orbitRadiusAU: 30, planetData: { radiusEarth: 9, T_eq: 60, habitability: { score: 0 }, rings: true }, moons: [] },
    ],
  };
  h.nav._levelIndex = 4;
  h.nav.render();
  return h;
}

/** The planet whose `pIdx` (1) is NOT its slot in the flat list (4), nor its place on the axis (2). */
const middle = (drv) => drv.D.bodies.find((b) => b.kind === 'planet' && b.pIdx === 1);

/** A system with more bodies than the ladder can hold, so its "..." caps exist and are clickable. */
function crowd(nav, n = 40) {
  nav._systemData = {
    star: { type: 'G' }, zones: { hzInnerAU: 0.9, hzOuterAU: 1.4 }, asteroidBelts: [],
    planets: Array.from({ length: n }, (_, i) => ({
      orbitRadiusAU: 0.2 + i * 0.9, moons: [],
      planetData: { radiusEarth: 1 + (i % 5), T_eq: 250, habitability: { score: 0.1 }, rings: false },
    })),
  };
  nav.render();
}

const press = (nav, code, over = {}) =>
  nav._onKeyDown({ code, shiftKey: false, key: '', preventDefault() {}, stopPropagation() {}, ...over });

/** The centre texel of drawn list row `i`, from the grid the PAINT published. */
const rowPoint = (drv, i) => {
  const lg = drv.S.listGeom;
  return { x: lg.x0 + 4, y: lg.top + (i + 1) * lg.lead };
};

/** A published mark with no other mark inside its own radius, so the pick is unambiguous. */
function isolatedHit(hits) {
  return hits.find((a) => hits.every((b) => b === a || Math.hypot(a.x - b.x, a.y - b.y) > a.r + b.r + 1));
}

const localeAsc = (a) => a.every((v, i) => i === 0 || a[i - 1].localeCompare(v) <= 0);
const numAsc = (a) => a.every((v, i) => i === 0 || a[i - 1] <= v);

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// 1.  ⛔⛔ A PICK MUST SURVIVE A `render()`.  This is the regression fence for the whole workstream.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('a pick survives the frame that is drawn after it', () => {
  it('⛔ LIVENESS CONTROL: with the driver standing down, ONE render() destroys the pick', async () => {
    // The case below is only worth anything if something is actively trying to overwrite the field.
    // This proves it is: the pointer is parked on rail row 2, the driver's re-resolution is stood
    // down (it bails on a non-finite pointer), and the legacy pass alone is left to run. It NULLS
    // `_hoveredLocalStar` at :2037 and re-derives it against the LEGACY projection, so the star the
    // rail row named does not come back.
    const { nav, drv } = await loadedNav();
    const p = rowPoint(drv, 2);
    nav._handleMouseMove({ clientX: p.x, clientY: p.y });
    const picked = nav._hoveredLocalStar?.star;
    expect(picked, 'the rail row must resolve to a star at all').toBeTruthy();
    nav._mouseX = NaN;                       // the driver's tail bails; nothing else changes
    nav.render();
    expect(nav._hoveredLocalStar?.star?.seed,
      'if the legacy pass could NOT clobber this, the case below is vacuous').not.toBe(picked.seed);
  });

  for (const mode of ['rail', 'bars']) {
    it(`⭐ ${mode}: hover → render() → the field still names the star that was hovered`, async () => {
      const { nav, drv } = await loadedNav({ mode });
      nav._levelIndex = 3;
      if (mode === 'bars') drv.toggleList();     // design 2's list is its picker at PRISM
      nav.render();
      const p = rowPoint(drv, 2);
      nav._handleMouseMove({ clientX: p.x, clientY: p.y });
      const picked = nav._hoveredLocalStar?.star;
      expect(picked, `${mode}: the list row must resolve to a star`).toBeTruthy();

      nav.render();                            // ⛔ the frame that used to eat it
      expect(nav._hoveredLocalStar?.star?.seed, `${mode}: one render() changed the star`)
        .toBe(picked.seed);
      nav.render(); nav.render();              // and it is not a one-frame reprieve
      expect(nav._hoveredLocalStar?.star?.seed, `${mode}: three renders changed the star`)
        .toBe(picked.seed);

      clickAt(nav, p.x, p.y);
      expect(nav._selectedNavStar?.seed, `${mode}: the click drilled a different star`).toBe(picked.seed);
    });
  }

  it('⛔ AND A MISS CLEARS, so a stale target cannot be clicked into', async () => {
    const { nav, drv } = await loadedNav();
    const p = rowPoint(drv, 2);
    nav._handleMouseMove({ clientX: p.x, clientY: p.y });
    expect(nav._hoveredLocalStar).toBeTruthy();
    nav._handleMouseMove({ clientX: 2, clientY: 1 });     // the status row: no row, no map
    nav.render();
    expect(nav._hoveredLocalStar, 'the pointer left the row and the pick stayed armed').toBe(null);
  });

  it('a body pick at SYSTEM survives its frame too', async () => {
    const { nav, drv } = await trappySystem();
    const hit = drv.S.bodyHits.find((x) => x.ref && x.ref.kind === 'planet' && x.moon < 0);
    nav._handleMouseMove({ clientX: hit.x, clientY: hit.y });
    const held = { ...nav._hoveredBody };
    expect(held.type).toBe('planet');
    nav.render();
    expect(nav._hoveredBody, 'the legacy _renderSystem re-derived it from its own projection').toEqual(held);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// 2.  THE MAP PICKERS.  Every target is taken out of the projection the PAINT published this frame.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('the map picks at GALAXY', () => {
  for (const mode of ['rail', 'bars']) {
    it(`${mode}: resolves the SECTOR CONTAINING the point, not the nearest drawn dot`, async () => {
      // ⚠ THE MAP DRAWS A GALAXY GRID (design 1) OR ONE DOT PER RANKED SECTOR (design 2), and there
      // are 775 sectors in an irregular density-adaptive quadtree. Neither the grid cell nor a
      // nearest-centre scan is the identity; containment is, and `getSectorAt` is the same call the
      // adapter already makes for `D.playerSector`.
      const { nav, drv } = await loadedNav({ mode });
      nav._levelIndex = 0;
      nav.render();
      const p = drv.S.mapProj;
      expect(p?.level, `${mode} must publish a level-0 projection`).toBe(0);
      const r = projRect(p);
      const x = r.x + r.w * 0.34, y = r.y + r.h * 0.55;
      const { wx, wz } = worldAt(p, x, y);
      const expected = nav._sectors.getSectorAt({ x: wx, z: wz });
      expect(expected, 'the fixture point must be inside the disc').toBeTruthy();
      nav._handleMouseMove({ clientX: x, clientY: y });
      expect(nav._hoveredTile?.sector?.id).toBe(expected.id);

      const drills = [];
      nav._onDrillSound = (i) => drills.push(i);
      clickAt(nav, x, y);
      expect(drills, 'the drill sound only fires on the shipped path').toContain(1);
      expect(nav._viewStack[1]?.center).toEqual({ x: expected.centerX, z: expected.centerZ });
    });
  }

  it('⛔ REJECTS a point outside the DRAWN square, and never clamps it to the edge', async () => {
    // Design 1's map REGION is 258 texels wide and its square is 216 at ox=21. The columns between
    // are inside the region and outside the picture; clamping there drills a tile nobody clicked.
    const { nav, drv } = await loadedNav();
    nav._levelIndex = 0;
    nav.render();
    const r = projRect(drv.S.mapProj), rgn = drv.regions().map;
    expect(r.x + r.w, 'the fixture depends on the square being narrower than the pane')
      .toBeLessThan(rgn.x + rgn.w);
    nav._handleMouseMove({ clientX: r.x + r.w / 2, clientY: r.y + r.h / 2 });
    expect(nav._hoveredTile?.sector, 'the centre of the picture must pick something').toBeTruthy();
    nav._handleMouseMove({ clientX: r.x + r.w + 4, clientY: r.y + r.h / 2 });
    expect(nav._hoveredTile, 'a point beside the picture picked a sector anyway').toBe(null);
  });

  it('⛔ REJECTS a stale projection after a level change', async () => {
    const { nav, drv } = await loadedNav();
    nav._levelIndex = 0;
    nav.render();
    const r = projRect(drv.S.mapProj);
    nav._levelIndex = 1; drv.S.level = 1;        // the projection now describes a dead frame
    nav._handleMouseMove({ clientX: r.x + r.w / 2, clientY: r.y + r.h / 2 });
    expect(nav._hoveredTile, 'last frame’s rectangle was picked against').toBe(null);
  });

  it('degrades to NO PICK — never a throw — when nothing is published', async () => {
    // The lab and this driver land separately, and a `null` dereference inside a picker called from
    // the tail of render() is not a blank pick — PanelHost catches the throw ONCE and then stops
    // uploading, so the glass keeps showing the last good frame and looks alive.
    const { nav, drv } = await loadedNav();
    for (const level of [0, 1, 2, 3, 4]) {
      nav._levelIndex = level;
      nav.render();
      drv.S.mapProj = null; drv.S.prismHits = null; drv.S.bodyHits = null; drv.S.railTiles = null;
      expect(() => nav._handleMouseMove({ clientX: 120, clientY: 100 }),
        `level ${level} with nothing published`).not.toThrow();
      expect(level === 3 ? nav._hoveredLocalStar : level === 4 ? nav._hoveredBody : nav._hoveredTile)
        .toBe(null);
    }
  });
});

describe('the map picks a TILE at SECTOR and REGION', () => {
  /** The world centre `_handleClick` computes for `{col,row}` — its arithmetic, spelled out. */
  const drillCentre = (nav, col, row, gn) => {
    const tile = nav._viewSize / gn, ext = nav._viewSize / 2;
    return { x: nav._viewCenter.x - ext + (col + 0.5) * tile,
             z: nav._viewCenter.z + ext - (row + 0.5) * tile };
  };

  for (const [mode, level] of [['rail', 1], ['rail', 2], ['bars', 1], ['bars', 2]]) {
    it(`⛔⛔ ${mode} L${level}: \`row\` IS Z-FLIPPED — the drill lands where it was clicked`, async () => {
      // ⭐ THE ASSERTION IS THE DRILL TARGET, NOT THE `{col,row}` PAIR. Handing `j` straight through
      // produces a perfectly plausible-looking `_hoveredTile` and drills into the MIRRORED tile;
      // only comparing the world point `_handleClick` lands on against the world point the
      // PROJECTION says was under the cursor can tell the two apart.
      // ⚠ AND IT COVERS BOTH DESIGN 2 PROJECTIONS: 'block' lays `blk` texels over the same kpc the
      //   density behind it spends `W` on, so a picker built on that design's own `toX`/`toY` —
      //   which this branch never calls — drills a tile roughly twice the size that was clicked.
      const { nav, drv } = await loadedNav({ mode });
      nav._levelIndex = level;
      nav.render();
      const p = drv.S.mapProj;
      expect(p?.kind, `${mode} L${level} published nothing to invert`).toBeTruthy();
      const r = projRect(p), gn = p.n;
      for (const [i, j] of [[0, 0], [1, gn - 1], [gn - 1, 2]]) {
        const x = r.x + (i + 0.5) * p.cell, y = r.y + (j + 0.5) * p.cell;
        nav._handleMouseMove({ clientX: x, clientY: y });
        expect(nav._hoveredTile, `cell ${i},${j}`).toEqual({ col: i, row: gn - 1 - j });
        const want = worldAt(p, x, y);
        const got = drillCentre(nav, i, gn - 1 - j, gn);
        expect(got.x, `cell ${i},${j} drilled a different column`).toBeCloseTo(want.wx, 6);
        expect(got.z, `cell ${i},${j} drilled the MIRRORED row`).toBeCloseTo(want.wz, 6);
      }
      // and the shipped handler really does land there
      const x = r.x + 1.5 * p.cell, y = r.y + 0.5 * p.cell;
      nav._handleMouseMove({ clientX: x, clientY: y });
      clickAt(nav, x, y);
      const want = worldAt(p, x, y);
      const stack = nav._viewStack[2].center;
      expect(stack.x).toBeCloseTo(want.wx, 6);
      expect(stack.z).toBeCloseTo(want.wz, 6);
    });
  }

  for (const level of [1, 2]) {
    it(`⭐ AC-4: the RAIL picks at L${level} — one of the two holes \`hover()\` had`, async () => {
      // Measured before the change: hover() returned {L0:true, L1:false, L2:false, L3:true, L4:true}.
      // The row's tile comes from `S.railTiles`, which the paint publishes from the SAME
      // `d1TileRows(v, v.n)` call it drew the rows from, already ranked and already sliced.
      const { nav, drv } = await loadedNav();
      nav._levelIndex = level;
      nav.render();
      const tiles = drv.S.railTiles, gn = drv.S.mapProj.n;
      expect(tiles.length, 'the rail must publish its rows').toBeGreaterThan(2);
      for (const row of [0, 1, 2]) {
        const p = rowPoint(drv, row);
        nav._handleMouseMove({ clientX: p.x, clientY: p.y });
        expect(nav._hoveredTile, `rail row ${row}`)
          .toEqual({ col: tiles[row].i, row: gn - 1 - tiles[row].j });
      }
      const p = rowPoint(drv, 1);
      nav._handleMouseMove({ clientX: p.x, clientY: p.y });   // the click reads the LAST hover
      clickAt(nav, p.x, p.y);
      const tile = nav._viewSize / gn, ext = nav._viewSize / 2;
      const target = level === 1 ? nav._viewStack[2].center : nav._localCenter;
      expect(target.x, 'the rail row did not drill to its own tile')
        .toBeCloseTo(nav._viewCenter.x - ext + (tiles[1].i + 0.5) * tile, 9);
    });
  }
});

describe('the map picks a STAR at PRISM', () => {
  for (const mode of ['rail', 'bars']) {
    it(`${mode}: a published glyph hands on the LIVE _localStars entry, matched by seed`, async () => {
      const { nav, drv } = await loadedNav({ mode });
      nav._levelIndex = 3;
      nav.render();
      const hits = drv.S.prismHits;
      expect(hits?.length, `${mode} published no prism marks`).toBeGreaterThan(10);
      const hit = isolatedHit(hits);
      expect(hit, 'the fixture needs one unambiguous mark').toBeTruthy();
      nav._handleMouseMove({ clientX: hit.x, clientY: hit.y });
      const got = nav._hoveredLocalStar;
      expect(got, `${mode}: the glyph did not resolve`).toBeTruthy();
      expect(got.star.seed).toBe(hit.ref.seed);
      expect(nav._localStars, 'the ranked COPY the adapter made is not what the drill wants')
        .toContain(got.star);
      clickAt(nav, hit.x, hit.y);
      expect(nav._selectedNavStar?.seed).toBe(hit.ref.seed);
    });
  }

  it('⭐ SCANS IN REVERSE, so the topmost glyph wins a tie', async () => {
    // ⚠ BUILT, NOT FOUND: two marks exactly equidistant from one texel is not something the real
    // starfield reliably contains, and the property only shows up in a tie.
    const { nav, drv } = await loadedNav();
    nav._levelIndex = 3;
    nav.render();
    const a = drv.D.starRows[1], b = drv.D.starRows[2];
    drv.S.prismHits = [{ x: 100, y: 100, r: 6, ref: a },     // drawn FIRST — nearer, painted UNDER
                       { x: 102, y: 100, r: 6, ref: b }];    // drawn LATER — farther, but on top
    nav._handleMouseMove({ clientX: 101, clientY: 100 });     // equidistant from both
    expect(nav._hoveredLocalStar.star.seed, 'the star painted UNDER won the tie').toBe(b.seed);
    nav._handleMouseMove({ clientX: 100, clientY: 100 });     // nearest still beats topmost
    expect(nav._hoveredLocalStar.star.seed).toBe(a.seed);
  });

  it('⛔ IS BOUNDED — an empty click does not drill the nearest star on the far side of the pane', async () => {
    // `_handleClick`'s level-3 branch has no "clicked empty space" path: it drills whatever
    // `_hoveredLocalStar` holds. So an unbounded nearest-scan makes every click in the map a drill.
    const { nav, drv } = await loadedNav();
    nav._levelIndex = 3;
    nav.render();
    const hit = isolatedHit(drv.S.prismHits);
    nav._handleMouseMove({ clientX: hit.x, clientY: hit.y });
    expect(nav._hoveredLocalStar).toBeTruthy();
    const rgn = drv.regions().map;
    const far = { x: hit.x > rgn.w / 2 ? rgn.x + 2 : rgn.x + rgn.w - 2, y: hit.y };
    drv.S.prismHits = [hit];                       // one mark, and the pointer nowhere near it
    nav._handleMouseMove({ clientX: far.x, clientY: far.y });
    expect(nav._hoveredLocalStar, 'a click in empty sky picked a star anyway').toBe(null);
    const before = nav._selectedNavStar;
    clickAt(nav, far.x, far.y);
    expect(nav._selectedNavStar, 'and it drilled').toBe(before);
  });
});

describe('the map picks a BODY at SYSTEM', () => {
  const find = (drv, pred) => drv.S.bodyHits.find(pred);

  for (const mode of ['rail', 'bars']) {
    it(`⛔ ${mode}: a MOON PIP maps to its PARENT PLANET — as a moon it would CLEAR the selection`, async () => {
      // `_handleClick` consumes a moon pick only while `_systemMode === 'planet'` (:4512-4520); in
      // 'system' mode — the mode the ladder and the orrery are both drawn in — a moon hover falls
      // through to `_clearCommitSelection()` (:4594). A moon published AS a moon is a dead click.
      const { nav, drv } = await trappySystem(mode);
      expect(nav._systemMode).toBe('system');
      const pip = find(drv, (h) => h.moon === 0 && h.ref);
      expect(pip, `${mode} published no moon pip`).toBeTruthy();
      nav._handleMouseMove({ clientX: pip.x, clientY: pip.y });
      expect(nav._hoveredBody).toEqual({ type: 'planet', index: pip.ref.pIdx });
    });
  }

  it('⛔ uses `ref.pIdx`, NEVER a position in the drawn list', async () => {
    const { nav, drv } = await trappySystem();
    const b = middle(drv);
    expect(b.pIdx, 'it is planet 1 of _systemData.planets').toBe(1);
    expect(drv.D.bodies.indexOf(b), 'and sits at slot 4 of the flat list').toBe(4);
    expect(drv.D.bodies.filter((x) => x.kind !== 'moon').indexOf(b),
      'and is the third thing the ladder draws').toBe(2);
    const hit = find(drv, (h) => h.ref === b && h.moon < 0);
    nav._handleMouseMove({ clientX: hit.x, clientY: hit.y });
    expect(nav._hoveredBody).toEqual({ type: 'planet', index: 1 });
  });

  it('⛔ THE "..." CAP GRABS ITS OWN MARK AND NOT THE LAST PLANET ON THE AXIS', async () => {
    // Found by measurement, 2026-09-08. `d1Ladder`'s virtual axis puts the FURTHEST body at
    // `vpx(auMax) = winW - 4` by construction, which is `x1 - 8` on the glass — and the cap's grab
    // zone was `>= x1 - 10`, four texels wider than the three texels it draws. So on any ladder that
    // overflows at all, the outermost planet could not be clicked: the click scrolled by the few
    // texels of overflow and the planet stayed exactly where it was.
    const { nav, drv } = await trappySystem();
    const caps = drv.S.ladderCaps;
    expect(drv.S.ladderMax, 'this fixture overflows by a few texels, which is the trap').toBeGreaterThan(0);
    const last = drv.D.bodies.find((b) => b.au === 30);
    const hit = find(drv, (h) => h.ref === last && h.moon < 0);
    expect(hit.x, 'the furthest body really does sit under the old grab zone')
      .toBeGreaterThanOrEqual(caps.x1 - 10);
    nav._handleMouseMove({ clientX: hit.x, clientY: hit.y });
    clickAt(nav, hit.x, hit.y);
    expect(nav._selectedBody, 'the cap ate the click meant for the outermost planet')
      .toEqual({ type: 'planet', planetIndex: last.pIdx });
    // and the cap itself still works, on the mark it actually draws
    const before = drv.S.ladderScroll;
    clickAt(nav, caps.x1 - 2, caps.axisY);
    expect(drv.S.ladderScroll, 'narrowing the zone killed the cap').toBeGreaterThan(before);
  });

  it('⛔ a BELT is recognised and takes NO pick — it does not leave the last body armed', async () => {
    const { nav, drv } = await trappySystem();
    const planet = find(drv, (h) => h.ref && h.ref.kind === 'planet' && h.moon < 0);
    const belt = find(drv, (h) => h.ref && h.ref.kind === 'belt');
    expect(belt, 'the paint must publish the belt as a candidate so it can be RECOGNISED').toBeTruthy();
    nav._handleMouseMove({ clientX: planet.x, clientY: planet.y });
    expect(nav._hoveredBody).toBeTruthy();
    nav._handleMouseMove({ clientX: belt.x, clientY: belt.y });
    expect(nav._hoveredBody, 'the belt left the planet armed underneath it').toBe(null);
  });

  it('the system star glyph picks the star', async () => {
    const { nav, drv } = await trappySystem();
    const star = find(drv, (h) => h.star);
    nav._handleMouseMove({ clientX: star.x, clientY: star.y });
    expect(nav._hoveredBody).toEqual({ type: 'star', index: 0 });
  });

  it('in PLANET DETAIL a moon of the DRILLED planet is a moon; any other planet\'s is not', async () => {
    const { nav, drv } = await trappySystem();
    const pip = find(drv, (h) => h.moon === 1 && h.ref);
    nav._systemMode = 'planet';
    nav._selectedPlanetIdx = pip.ref.pIdx;
    nav._handleMouseMove({ clientX: pip.x, clientY: pip.y });
    expect(nav._hoveredBody).toEqual({ type: 'moon', index: 1 });
    nav._selectedPlanetIdx = 99;      // `_handleClick` would pair this moon with the WRONG planet
    nav._handleMouseMove({ clientX: pip.x, clientY: pip.y });
    expect(nav._hoveredBody).toEqual({ type: 'planet', index: pip.ref.pIdx });
  });

  it('⛔ the ladder\'s "..." cap still consumes its click, with a real pick under it', async () => {
    const { nav, drv } = await trappySystem();
    crowd(nav);
    const caps = drv.S.ladderCaps;
    expect(drv.S.ladderMax, 'the fixture must overflow or the caps mean nothing').toBeGreaterThan(0);
    const x = caps.x1 - 2, y = caps.axisY;
    nav._handleMouseMove({ clientX: x, clientY: y });
    expect(nav._hoveredBody, 'the ladder must really have a body under its right cap').toBeTruthy();
    const selBefore = nav._selectedBody, scrollBefore = drv.S.ladderScroll;
    clickAt(nav, x, y);
    expect(drv.S.ladderScroll, 'the cap click did not scroll').toBeGreaterThan(scrollBefore);
    expect(nav._selectedBody, 'the cap click ALSO selected the body under it').toBe(selBefore);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// 3.  THE CAMERA AND THE FRAME (AC-5, INTERFACE §1c/§2).
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('the mode is fed the camera and the frame the game already runs', () => {
  it('⭐ THE DEFAULT PICTURE DOES NOT MOVE — entry state IS the frame Max ruled on', async () => {
    const { nav, drv } = await loadedNav();
    nav._localCenter = { x: nav._playerX, y: nav._playerY, z: nav._playerZ };
    nav._localRadius = 0.0015;
    nav.render();
    expect(drv.S.cam.radius, 'entry radius must be ZOOM_STOPS[0], or the prism rescales on entry')
      .toBe(ZOOM_STOPS[0]);
    expect([drv.S.cam.x, drv.S.cam.y, drv.S.cam.z]).toEqual([nav._playerX, nav._playerY, nav._playerZ]);
  });

  it('⭐ AND THE PICTURE ACTUALLY MOVES when the camera does — measured dead before this', async () => {
    // ⛔ MEASURED DEAD 2026-09-07 WITH A LIVENESS CONTROL: mutating `_localRotY`, `_localRotX`,
    // `_localRadius` and `_localCenter` left the map's pixel hash BYTE-IDENTICAL while moving the
    // ship changed it, because `projectPrism` read `D.player` and `ZOOM_STOPS[S.zoomIdx | 0]` and
    // nothing anywhere wrote `S.zoomIdx`. The marks the paint publishes are the same arithmetic, so
    // asserting they move IS asserting the picture moves.
    const { nav, drv } = await loadedNav();
    nav._levelIndex = 3;
    nav._localCenter = { x: nav._playerX, y: nav._playerY, z: nav._playerZ };
    nav._localRadius = 0.0015;
    nav.render();
    const before = drv.S.prismHits.map((h) => `${h.ref.seed}@${h.x.toFixed(3)},${h.y.toFixed(3)}`).join('|');
    nav._localCenter = { ...nav._localCenter, x: nav._localCenter.x + 0.0004 };   // one 'D' press worth
    nav.render();
    expect(drv.S.prismHits.map((h) => `${h.ref.seed}@${h.x.toFixed(3)},${h.y.toFixed(3)}`).join('|'),
      'WASD PAN is printed on the glass and moved nothing').not.toBe(before);
    nav._localRadius = 0.006;                                                     // one wheel notch
    nav.render();
    const zoomed = drv.S.prismHits.map((h) => `${h.ref.seed}@${h.x.toFixed(3)},${h.y.toFixed(3)}`).join('|');
    nav._localRadius = 0.0015;
    nav.render();
    expect(zoomed, 'the wheel zoom moved nothing')
      .not.toBe(drv.S.prismHits.map((h) => `${h.ref.seed}@${h.x.toFixed(3)},${h.y.toFixed(3)}`).join('|'));
  });

  it('⛔ ROTATION IS STILL NOT AN INPUT, deliberately', async () => {
    // Neither prism hint advertises it, and swapping the designs' fixed shallow tilt for the legacy
    // camera's full 3D rotation would change the picture Max ruled on.
    const { nav, drv } = await loadedNav();
    nav._levelIndex = 3;
    nav.render();
    const before = drv.S.prismHits.map((h) => `${h.x},${h.y}`).join('|');
    nav._localRotY += 1.2; nav._localRotX = 1.4;
    nav.render();
    expect(drv.S.prismHits.map((h) => `${h.x},${h.y}`).join('|')).toBe(before);
  });

  it('S.view follows the drill stack, so a drill moves the picture', async () => {
    const { nav, drv } = await loadedNav();
    nav._levelIndex = 1;
    nav._viewCenter = { x: 9.5, z: 2.25 };
    nav._viewSize = 1.75;
    nav.render();
    expect(drv.S.view).toEqual({ cx: 9.5, cz: 2.25, size: 1.75 });
    expect(drv.S.mapProj.cx, 'and the design drew that frame, not the player’s').toBe(9.5);
    expect(drv.S.mapProj.size).toBe(1.75);
  });

  it('⛔ `S.cam` and `S.view` are MUTATED, never replaced', async () => {
    // A design that read `S.cam` once would keep the object; replacing it would leave the prism
    // anchored to the frame the factory was built on, repainting happily forever.
    const { nav, drv } = await loadedNav();
    const cam = drv.S.cam, view = drv.S.view;
    nav._localRadius = 0.004; nav._viewSize = 3;
    nav.render();
    expect(drv.S.cam).toBe(cam);
    expect(drv.S.view).toBe(view);
    expect(cam.radius).toBe(0.004);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// 4.  SORT (AC-8) AND PAGE (AC-9).
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('the ranked list sorts', () => {
  it('index 0 of every level is TODAY\'S ORDER, so the default picture is unchanged', async () => {
    const { nav, drv } = await loadedNav();
    nav._levelIndex = 3; nav.render();
    expect(drv.S.sortIdx).toBe(0);
    expect(numAsc(drv.D.starRows.map((r) => r.dist ?? 0)), 'PRISM defaults to distance ascending').toBe(true);
    nav._levelIndex = 0; nav.render();
    const counts = drv.D.sectorRows.map((r) => r.n);
    expect(counts.every((v, i) => i === 0 || counts[i - 1] >= v), 'GALAXY defaults to count descending').toBe(true);
  });

  it('⛔ THE `starRows` CACHE IS KEYED ON (array, length) — the sort key has to be in it too', async () => {
    const { nav, drv } = await loadedNav();
    nav._levelIndex = 3; nav.render();
    const before = drv.D.starRows.map((r) => r.seed);
    press(nav, 'BracketRight');
    nav.render();                       // `_localStars` has not moved: identity and length unchanged
    expect(drv.S.sortLabel, 'the glass must NAME the key — Max never uses a console').toBe('NAME');
    expect(localeAsc(drv.D.starRows.map((r) => String(r.name || ''))),
      'the array the PAINT reads did not re-order').toBe(true);
    expect(drv.D.starRows.map((r) => r.seed)).not.toEqual(before);
    expect(drv.D.starRows.length, 'a re-order must not lose rows').toBe(before.length);
    // and the rail row the pilot now sees is the row the picker resolves
    const p = rowPoint(drv, 3);
    nav._handleMouseMove({ clientX: p.x, clientY: p.y });
    expect(nav._hoveredLocalStar.star.seed).toBe(drv.D.starRows[3].seed);
  });

  it('⛔ THE `sectorRows` CACHE IS BUILT ONCE AND NEVER INVALIDATED — same fence, worse cache', async () => {
    const { nav, drv } = await loadedNav();
    nav._levelIndex = 0; nav.render();
    const before = drv.D.sectorRows.map((r) => r.s.id);
    press(nav, 'BracketRight');
    nav.render();
    expect(drv.S.sortLabel).toBe('NAME');
    expect(localeAsc(drv.D.sectorRows.map((r) => String(r.s.name || '')))).toBe(true);
    expect(drv.D.sectorRows.map((r) => r.s.id)).not.toEqual(before);
    expect(drv.D.sectorRows).toHaveLength(775);
  });

  it('⛔ THE `bodies` CACHE IS KEYED ON THE SYSTEM OBJECT — and AU was not the baseline it claimed', async () => {
    // `buildBodies` appended belts AFTER every planet despite its "AU-ordered" comment, so a belt at
    // 3 AU landed after a planet at 30 — and `d1Ladder`'s separation pass, which walks left to right
    // pushing anything within 8 texels of its predecessor further RIGHT, shoves such a belt most of
    // an axis away from where it belongs.
    const { nav, drv } = await trappySystem();
    expect(numAsc(drv.D.bodies.map((b) => b.au)), 'the belt at 3 AU is still behind the planet at 30').toBe(true);
    expect(drv.D.bodies.findIndex((b) => b.kind === 'belt'))
      .toBeLessThan(drv.D.bodies.findIndex((b) => b.au === 30));
    const before = drv.D.bodies.map((b) => b.name);
    press(nav, 'BracketRight');
    nav.render();
    expect(drv.S.sortLabel).toBe('NAME');
    expect(localeAsc(drv.D.bodies.map((b) => String(b.name || '')))).toBe(true);
    expect(drv.D.bodies.map((b) => b.name)).not.toEqual(before);
    expect(drv.D.bodies).toHaveLength(before.length);
  });

  it('⭐ A SORTED `D.bodies` STILL PICKS RIGHT, because the identity rides the row', async () => {
    const { nav, drv } = await trappySystem();
    press(nav, 'BracketRight');           // NAME — the flat list is now in no structural order
    nav.render();
    const idx = drv.D.bodies.findIndex((b) => b.kind === 'planet');
    const p = rowPoint(drv, idx);
    nav._handleMouseMove({ clientX: p.x, clientY: p.y });
    expect(nav._hoveredBody).toEqual({ type: 'planet', index: drv.D.bodies[idx].pIdx });
    // and the orrery/ladder marks agree with the rail, because both read the same array
    const hit = drv.S.bodyHits.find((h) => h.ref === drv.D.bodies[idx] && h.moon < 0);
    nav._handleMouseMove({ clientX: hit.x, clientY: hit.y });
    expect(nav._hoveredBody).toEqual({ type: 'planet', index: drv.D.bodies[idx].pIdx });
  });

  it('the level change resets the key and the page', async () => {
    const { nav, drv } = await loadedNav();
    nav._levelIndex = 3; nav.render();
    drv.cycleSort(1); drv.page(1);
    expect(drv.S.sortIdx).toBe(1);
    expect(drv.S.listOffset).toBeGreaterThan(0);
    nav._levelIndex = 0; nav.render();
    expect(drv.S.sortIdx, 'a key index means a different key at a level with a different list').toBe(0);
    expect(drv.S.listOffset, 'page 4 of 27,524 stars means nothing against 64 tiles').toBe(0);
  });

  it('cycles both ways and wraps, at every level, and names the key it lands on', async () => {
    const { nav, drv } = await loadedNav();
    for (const level of [0, 1, 2, 3, 4]) {
      nav._levelIndex = level; nav.render();
      const n = SORT_KEYS[level].length;
      expect(drv.S.sortIdx).toBe(0);
      press(nav, 'BracketLeft');
      expect(drv.S.sortIdx, `level ${level} did not wrap backwards`).toBe(n - 1);
      press(nav, 'BracketRight');
      expect(drv.S.sortIdx).toBe(0);
      expect(drv.S.sortLabel, `level ${level} must name its key`).toBe(SORT_KEYS[level][0].label);
    }
  });
});

describe('the ranked list pages', () => {
  it('steps a whole page, clamps at both ends, and comes back to the top', async () => {
    const { nav, drv } = await loadedNav();
    nav._levelIndex = 3; nav.render();
    const rows = drv.S.listGeom.rows, total = drv.S.listGeom.total;
    expect(total, 'the fixture must have more stars than one page').toBeGreaterThan(rows * 3);
    press(nav, 'Equal'); nav.render();
    expect(drv.S.listOffset).toBe(rows);
    for (let i = 0; i < 400; i++) { press(nav, 'Equal'); }
    nav.render();
    expect(drv.S.listOffset, 'the pager ran off the end of the list').toBe(total - rows);
    for (let i = 0; i < 400; i++) { press(nav, 'Minus'); }
    nav.render();
    expect(drv.S.listOffset).toBe(0);
  });

  it('⭐ AND THE 28th STAR BECOMES REACHABLE — the picker follows the page the PAINT drew', async () => {
    // `page()` writes `S.listOffset`; the design slices by it and publishes what it SLICED as
    // `S.listGeom.offset`. Reading the intention here instead would put the picker a page away from
    // the glass for exactly as long as the paint had not honoured the field.
    const { nav, drv } = await loadedNav();
    nav._levelIndex = 3; nav.render();
    const rows = drv.S.listGeom.rows;
    const firstPageRow0 = drv.D.starRows[0].seed;
    press(nav, 'Equal');
    nav.render();
    expect(drv.S.listGeom.offset, 'the paint did not honour the offset').toBe(rows);
    const p = rowPoint(drv, 0);
    nav._handleMouseMove({ clientX: p.x, clientY: p.y });
    expect(nav._hoveredLocalStar.star.seed, 'row 0 of page 2 resolved to page 1’s row 0')
      .toBe(drv.D.starRows[rows].seed);
    expect(nav._hoveredLocalStar.star.seed).not.toBe(firstPageRow0);
    clickAt(nav, p.x, p.y);
    expect(nav._selectedNavStar.seed).toBe(drv.D.starRows[rows].seed);
  });

  it('pages design 2\'s list by the same keys', async () => {
    const { nav, drv } = await loadedNav({ mode: 'bars' });
    nav._levelIndex = 3; drv.toggleList(); nav.render();
    const rows = drv.S.listGeom.rows;
    press(nav, 'Equal'); nav.render();
    expect(drv.S.listGeom.offset).toBe(rows);
    const p = rowPoint(drv, 0);
    nav._handleMouseMove({ clientX: p.x, clientY: p.y });
    expect(nav._hoveredLocalStar.star.seed).toBe(drv.D.starRows[rows].seed);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// 5.  THE DRIVER METHODS THE KEYS CALL (INTERFACE §3).  Driven through `_onKeyDown` wherever a
//     clause exists, because all 28 view-mode tests passed while the `V` key was dead code.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('TAB changes level THROUGH the shipped click handler', () => {
  for (const mode of ['rail', 'bars']) {
    it(`${mode}: it drills rather than setting the index`, async () => {
      const { nav, drv } = await loadedNav({ mode });
      nav._levelIndex = 1;
      nav.render();
      const drills = [];
      nav._onDrillSound = (i) => drills.push(i);
      drv.tabLevel(1);
      expect(nav._levelIndex, `${mode}: Tab did not advance the level`).toBe(2);
      expect(drills, 'the drill sound only fires on the shipped path').toContain(2);
      expect(nav._modeTabIdx, 'the point landed in the LEGACY strip and was silently eaten')
        .toBeGreaterThanOrEqual(0);
      drv.tabLevel(-1);
      expect(nav._levelIndex, `${mode}: Shift+Tab did not retreat`).toBe(1);
    });
  }

  it('⛔ THROUGH `_onKeyDown`, which is the entry a dead clause would fail at', async () => {
    const { nav } = await loadedNav();
    nav._levelIndex = 1;
    nav.render();
    press(nav, 'Tab');
    expect(nav._levelIndex, 'Tab is bound nowhere the handler can reach').toBe(2);
    press(nav, 'Tab', { shiftKey: true });
    expect(nav._levelIndex).toBe(1);
  });

  it('⛔ AND THE POINT IS INVERTED THROUGH `_getCanvasPos`, not handed in as buffer texels', async () => {
    // In the running game a mode's buffer is 427x240 inside a ~1560x860 CSS box. `_getCanvasPos`
    // multiplies by `canvas.width / rect.width`, so a texel handed in raw lands a quarter of the way
    // across the strip — on a different tab, or on none.
    const { nav, canvas } = await loadedNav();
    canvas.getBoundingClientRect = () => ({ left: 137, top: 61, width: canvas.width * 4,
                                            height: canvas.height * 4,
                                            right: 137 + canvas.width * 4, bottom: 61 + canvas.height * 4 });
    nav._levelIndex = 1;
    nav.render();
    nav._viewDriverInst.tabLevel(1);
    expect(nav._levelIndex, 'the synthetic click missed its own tab under a scaled CSS box').toBe(2);
  });

  it('walks every tab of design 2\'s proportionally-spaced strip', async () => {
    // ⚠ THIS CANNOT DISTINGUISH `S.tabRects` FROM `geometry.js`'s RESTATEMENT and does not claim to:
    // on this buffer and this face the two agree texel for texel, which is exactly why the
    // restatement survived unnoticed. What it does assert is that every tab is reachable, one cell
    // at a time — a subdivision off by one cell fails here even when the two sources agree.
    const { nav, drv } = await loadedNav({ mode: 'bars' });
    nav.render();
    expect(drv.S.tabRects, 'design 2 must publish its strip').toHaveLength(5);
    for (const i of [0, 1, 2]) {
      nav._levelIndex = i === 0 ? 1 : i - 1;
      nav.render();
      drv.tabLevel(nav._levelIndex < i ? 1 : -1);
      expect(nav._levelIndex, `tab ${i}`).toBe(i);
    }
  });

  it('⭐ WRAPS AT BOTH ENDS — a key the glass names must never be dead where it is drawn', async () => {
    // Superseded a `toBe(0)` clamp on 2026-09-07. Measured on the running game, `Tab` from PRISM gave
    // [3, 4, 4, 4]: at SYSTEM it was a dead key, while design 1's hint row says `TAB LEVEL` at three
    // of the five levels. A control that is advertised and inert at one level is the whole defect
    // class this workstream exists to close, so the cycle wraps rather than stopping.
    const { nav, drv } = await loadedNav();
    nav._levelIndex = 0; nav.render();
    drv.tabLevel(-1);
    expect(nav._levelIndex, 'backwards from GALAXY wraps to SYSTEM').toBe(4);
  });
});

describe('ENTER commits', () => {
  it('at SYSTEM it fires exactly what the [ WARP ] / [ BURN ] button fires', async () => {
    const { nav } = await trappySystem();
    const action = { type: 'warp', target: 'star', star: { seed: 5150 } };
    nav._commitAction = action;
    const fired = [], sounds = [];
    nav._onCommit = (a) => fired.push(a);
    nav._onSound = (s) => sounds.push(s);
    press(nav, 'Enter');
    expect(fired, 'Enter must not build its own action').toEqual([action]);
    expect(sounds).toContain(nav._isCurrentSystem() ? 'warpLockOn' : 'warpTarget');
  });

  it('⛔ and is a NO-OP when the button would be dead, so the two cannot diverge', async () => {
    const { nav } = await trappySystem();
    nav._commitAction = null;
    let fired = 0;
    nav._onCommit = () => { fired++; };
    press(nav, 'Enter');
    expect(fired).toBe(0);
  });

  it('at PRISM it arms the selected star — the row both designs draw and nothing implemented', async () => {
    // `_selectedBody` is never written outside level-4 paths, so `_commitAction` is permanently null
    // below SYSTEM, yet both designs draw `WARP TO … ENTER` at every level. The mechanism reused is
    // `_selectSearchResult`'s tail (:866-876).
    const { nav, star } = await loadedNav();
    nav._levelIndex = 3;
    nav._selectedNavStar = star;
    nav.render();
    expect(nav._commitAction, 'this is the branch taken only when nothing is armed').toBeFalsy();
    const fired = [];
    nav._onCommit = (a) => fired.push(a);
    press(nav, 'Enter');
    expect(fired).toHaveLength(1);
    expect(fired[0].type).toBe('warp');
    expect(fired[0].target).toBe('star');
    expect(fired[0].star.seed).toBe(star.seed);
    expect(fired[0].star.wx).toBe(star.wx);
  });

  it('falls back to the external target, and fires nothing when there is neither', async () => {
    const { nav } = await loadedNav();
    nav._levelIndex = 2;
    nav._selectedNavStar = null;
    nav._externalTarget = null;
    nav.render();
    const fired = [];
    nav._onCommit = (a) => fired.push(a);
    press(nav, 'Enter');
    expect(fired, 'an unarmed nav must not warp somewhere').toHaveLength(0);
    nav._externalTarget = { x: 9, y: 0.1, z: -3, name: 'ELSEWHERE' };
    press(nav, 'Enter');
    expect(fired).toHaveLength(1);
    expect([fired[0].star.wx, fired[0].star.wy, fired[0].star.wz]).toEqual([9, 0.1, -3]);
  });

  it('⛔ never touches window._warpTarget', async () => {
    const { nav } = await trappySystem();
    nav._commitAction = { type: 'warp', target: 'star', star: { seed: 1 } };
    nav._onCommit = () => {};
    const before = globalThis.window._warpTarget;
    press(nav, 'Enter');
    expect(globalThis.window._warpTarget).toBe(before);
  });
});

describe('the drawn search is a stub that exists and does not throw', () => {
  it('opens on /, consumes the keyboard while open, and closes on Escape', async () => {
    const { nav, drv } = await loadedNav();
    nav.render();
    expect(drv.searchActive()).toBe(false);
    press(nav, 'Slash');
    expect(drv.searchActive(), '/ must open the field both hint rows advertise').toBe(true);
    // ⛔ the six pan letters go INTO the field rather than moving the camera — which is the whole
    // point of `searchActive()` gating the key clause ahead of the pan handler.
    press(nav, 'KeyW', { key: 'w' });
    press(nav, 'KeyD', { key: 'd' });
    expect(nav._heldKeys.has('KeyW'), 'a typed W panned the camera').toBe(false);
    expect(drv.S.search.text).toBe('wd');
    press(nav, 'Backspace');
    expect(drv.S.search.text).toBe('w');
    press(nav, 'Escape');
    expect(drv.searchActive()).toBe(false);
    expect(nav._heldKeys.has('KeyW')).toBe(false);
  });

  it('⛔ does NOT set _searchFocused, which would make itself unreachable', async () => {
    // `_onKeyDown` opens with `if (this._searchFocused) return;` (:349) and every view-mode clause,
    // the searchKey one included, is folded onto that line AFTER it. Setting the flag would kill the
    // field the instant it opened — Escape included.
    const { nav, drv } = await loadedNav();
    nav.render();
    drv.searchOpen();
    expect(nav._searchFocused).toBe(false);
    press(nav, 'Escape');
    expect(drv.searchActive()).toBe(false);
  });

  it('every driver method the key clauses call exists and survives being called cold', async () => {
    const { drv } = await loadedNav();
    for (const m of ['tabLevel', 'commit', 'cycleSort', 'page', 'searchOpen', 'searchActive', 'searchKey']) {
      expect(typeof drv[m], `INTERFACE §3 promises drv.${m}`).toBe('function');
    }
    const cold = await makeHeadlessNav({ width: 427, height: 240 });
    cold.nav._viewModesEnabled = true;
    cold.nav.viewMode = 'rail';
    // ⛔ every one of these before a single frame has been painted — a throw out of a key handler
    // under PanelHost stops the uploads and freezes the glass on the last good frame.
    for (const code of ['Tab', 'Enter', 'BracketLeft', 'BracketRight', 'Minus', 'Equal', 'Slash']) {
      expect(() => press(cold.nav, code), `${code} before the first frame`).not.toThrow();
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// 6.  THE TWO DEFECTS THE PICKER TRIPPED ON (INTERFACE §1f).
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('the adapter resolves the selected body by identity, not by slot', () => {
  it('⛔ the flat list is NOT indexable by a planet index', async () => {
    // `D.bodies[pick.index]` indexed the FLAT list — moons interleaved, belts appended, and since
    // AC-8 an arbitrary sort — with an index into `_systemData.planets`. ⚠ AND THE FIELD IS
    // `planetIndex`: every one of the four sites that writes `_selectedBody` (:4517, :4523, :4567,
    // :4580) writes that, not the `index` the declaration at :265 documents, so `pick.index` was
    // `undefined` on EVERY path and the detail block has never once shown the body the pilot picked.
    const { nav, drv } = await trappySystem();
    const b = middle(drv);
    expect(drv.D.bodies.indexOf(b)).toBe(4);
    expect(drv.D.bodies[1].kind, 'slot 1 must be somebody else, or the fixture proves nothing').toBe('moon');
    nav._selectedBody = { type: 'planet', planetIndex: 1 };
    nav.render();
    expect(drv.D.selBody, 'the selection frame is drawn on whatever sits at that slot').toBe(b);
    nav._selectedBody = { type: 'moon', planetIndex: 0, moonIndex: 1 };
    nav.render();
    expect(drv.D.selBody.kind).toBe('moon');
    expect([drv.D.selBody.pIdx, drv.D.selBody.mIdx]).toEqual([0, 1]);
  });

  it('⭐ AND THE ROUND TRIP CLOSES — click a planet, and the frame is drawn on that planet', async () => {
    const { nav, drv } = await trappySystem();
    const b = middle(drv);
    const hit = drv.S.bodyHits.find((h) => h.ref === b && h.moon < 0);
    nav._handleMouseMove({ clientX: hit.x, clientY: hit.y });
    clickAt(nav, hit.x, hit.y);
    nav.render();
    expect(nav._selectedBody).toEqual({ type: 'planet', planetIndex: 1 });
    expect(drv.D.selBody).toBe(b);
  });
});

describe('the commit rectangle comes out of the paint', () => {
  it('⭐ prefers S.chipRect over the geometry restatement above it', async () => {
    // ⚠ THE GETTER IS THE FIXTURE, NOT A HACK. On this buffer the published chip and the restated
    // one happen to agree texel for texel, so nothing could tell which was read. A getter stands in
    // for the design writing a DIFFERENT rectangle at its own draw site — which is exactly the case
    // the preference exists for, and the case a face or buffer change would produce for real.
    const { nav, drv } = await loadedNav({ mode: 'bars' });
    nav._levelIndex = 3;
    nav.render();
    const real = { ...drv.S.chipRect };
    expect(real.w, 'design 2 must publish its chip').toBeGreaterThan(0);
    const published = { x: 11, y: 222, w: 47, h: 9 };
    Object.defineProperty(drv.S, 'chipRect', { configurable: true, get: () => published, set() {} });
    nav.render();
    expect(nav._commitButtonRect).toEqual(published);
    delete drv.S.chipRect;
    nav.render();
    expect(nav._commitButtonRect, 'and tracks the real one once the getter is gone')
      .toEqual({ x: real.x, y: real.y, w: real.w, h: real.h });
  });

  it('and clicking the drawn chip still commits, in both designs', async () => {
    for (const mode of ['rail', 'bars']) {
      const { nav } = await trappySystem(mode);
      nav._commitAction = { type: 'warp', target: 'star', star: { seed: 5150 } };
      let fired = null;
      nav._onCommit = (a) => { fired = a; };
      nav.render();
      const r = nav._commitButtonRect;
      clickAt(nav, r.x + r.w / 2, r.y + r.h / 2);
      expect(fired, `${mode}: the drawn commit control did not fire`).toBeTruthy();
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// 7.  WHAT NONE OF THIS MAY BREAK.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('what none of this may break', () => {
  it('⛔ viewMode === null never builds a driver, so today\'s nav is untouched', async () => {
    const { nav } = await makeHeadlessNav({ width: 614, height: 512 });
    nav._levelIndex = 3;
    nav._handleMouseMove({ clientX: 100, clientY: 100 });
    nav.render();
    expect(nav._viewDriverInst).toBe(null);
  });

  it('⛔ the legacy pass\'s invisible live buttons are withdrawn under a mode', async () => {
    // Same defect AC-4 named on the cockpit panel, arriving from a third direction: `_renderHUD`
    // republishes `_autopilotButtonRect` every frame at (8, h-64, 140, 24) — 3.3% of a 240p screen,
    // in the middle-left of both designs' map panes — and `_handleClick` tests it FIRST and returns.
    // Neither design draws a toggle there, so the click was landing on a button that is not there.
    const { nav, drv } = await loadedNav();
    nav._levelIndex = 3;
    nav.render();
    expect(nav._autopilotButtonRect, 'a live rect under the prism map').toBe(null);
    let toggled = 0;
    nav._onAutopilotToggle = () => { toggled++; };
    // where the legacy toggle WOULD be, which is inside the design's map region
    const rgn = drv.regions().map;
    const x = 8 + 70, y = nav._canvas.height - 32 - 24 - 8 + 12;
    expect(y > rgn.y && y < rgn.y + rgn.h && x < rgn.x + rgn.w, 'the fixture point must be in the map').toBe(true);
    clickAt(nav, x, y);
    expect(toggled, 'a click in the star map toggled the autopilot').toBe(0);
  });

  it('⛔ the cockpit panel acquires nothing, whatever is pressed on it', async () => {
    const { nav } = await makeHeadlessNav({ width: 52, height: 43 });
    expect(nav._viewModesEnabled).toBe(false);
    for (const code of ['Tab', 'Enter', 'BracketLeft', 'Minus', 'Slash']) press(nav, code);
    expect(nav.viewMode).toBe(null);
    expect(nav._viewDriverInst).toBe(null);
  });

  it('every published field has a default, so no design can read undefined', async () => {
    // A painter throw is not a blank field: PanelHost catches it ONCE and then stops uploading, and
    // the glass keeps showing the last good frame and looks alive.
    const { drv } = await loadedNav();
    for (const k of ['mapProj', 'prismHits', 'bodyHits', 'railTiles', 'listGeom', 'tabRects',
                     'chipRect', 'cam', 'view', 'sortIdx', 'sortLabel', 'listOffset', 'search']) {
      expect(drv.S, `S.${k} has no default`).toHaveProperty(k);
      expect(drv.S[k], `S.${k} is undefined`).not.toBe(undefined);
    }
    // ⚠ The shape grew when AC-11 landed the DRAWN field: the highlight and the resolved rows are
    // read by the paint, so they live on `S` beside the query. Asserted as a whole object on purpose
    // — a missing default is what freezes the glass, because PanelHost catches a painter throw ONCE
    // and then keeps uploading the last good frame, which looks alive.
    expect(drv.S.search).toEqual({ open: false, text: '', highlight: -1, rows: [] });
  });

  it('⛔ last frame\'s candidates die with last frame\'s picture', async () => {
    // A level change must not leave the previous picture's marks live UNDERNEATH the new one, or the
    // pilot clicks a star that is not there. Design 2 nulls them at the head of its own paint;
    // the DRIVER clears them for both designs, which is what covers design 1.
    const { nav, drv } = await loadedNav();
    nav._levelIndex = 3; nav.render();
    const mark = isolatedHit(drv.S.prismHits);
    expect(mark, 'PRISM must publish marks').toBeTruthy();
    nav._levelIndex = 0; nav.render();
    expect(drv.S.prismHits?.length || 0, 'a prism mark outlived the prism').toBe(0);
    expect(drv.S.bodyHits?.length || 0).toBe(0);
    // back to PRISM with no frame painted in between: the marks are gone, so nothing resolves
    nav._levelIndex = 3; drv.S.level = 3;
    nav._handleMouseMove({ clientX: mark.x, clientY: mark.y });
    expect(nav._hoveredLocalStar, 'the pilot clicked a star that is not on the glass').toBe(null);
  });
});
