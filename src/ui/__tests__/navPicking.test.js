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
import { describe, it, expect, vi } from 'vitest';
import { makeHeadlessNav, clickAt } from './helpers/headlessNav.mjs';
import { makeDesigns } from '../navViewModes/designs.js';
import { SORT_KEYS, makeRng, makeViewState, wrapTau,
         PRISM_DZ, PRISM_DY, SYSTEM_TILT } from '../navViewModes/state.js';
import { generatePlanetName, generateMoonName, generateSystemName } from '../../generation/NameGenerator.js';
import { projRect, worldAt, pickLabel, pickBody, pickPrismStar, pickOrbitRing, pickSector } from '../navViewModes/picking.js';

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

  // ⛔⛔ THIS CASE USED TO ASSERT THE OPPOSITE — "ROTATION IS STILL NOT AN INPUT, deliberately",
  // pinning `S.prismHits` byte-identical across a rotation. That was true and is now the defect:
  // measured live on 2026-09-08, `_localRotY += 1.1` with `_localRotX = 0.15` left every published
  // mark unmoved while a 0.0004 nudge to `_localCenter.z` moved all of them, so the pilot has been
  // dragging a camera the designs cannot see, under a hint that says DRAG TO ROTATE. The pixel half
  // is the LAB's (`projectPrism` / `d2System` read these fields); what the DRIVER owes is the two
  // pairs, sourced separately and wrapped, and that is what is pinned here.
  it('⭐⭐ THE TWO ROTATION PAIRS ARE PUBLISHED, AND THEY ARE INDEPENDENT', async () => {
    // ⛔ TWO PAIRS, NOT ONE. The game clamps `_localRotX` to [0, π/2] (:4354) and `_systemRotX` to
    // [0.1, π/2] (:4360) and drags them at different levels; folding them into one field would make
    // a prism drag turn the orrery, which is a defect no pixel test would attribute correctly.
    const { nav, drv } = await loadedNav();
    nav._levelIndex = 3;
    nav._localRotX = 0.42; nav._localRotY = 1.11;
    nav._systemRotX = 1.23; nav._systemRotY = 2.34;
    nav.render();
    expect(drv.S.cam.rotX, 'the prism elevation is not published').toBe(0.42);
    expect(drv.S.cam.rotY, 'the prism azimuth is not published').toBeCloseTo(1.11, 12);
    expect(drv.S.sysCam.rotX, 'the orrery elevation is not published').toBe(1.23);
    expect(drv.S.sysCam.rotY, 'the orrery azimuth is not published').toBeCloseTo(2.34, 12);

    // ⭐ AND MOVING ONE PAIR DOES NOT MOVE THE OTHER — the half a folded field would break.
    nav._localRotX = 1.0; nav._localRotY = 0.25;
    nav.render();
    expect(drv.S.sysCam.rotX, 'a PRISM drag moved the ORRERY elevation').toBe(1.23);
    expect(drv.S.sysCam.rotY, 'a PRISM drag turned the ORRERY').toBeCloseTo(2.34, 12);
    nav._systemRotX = 0.5; nav._systemRotY = 0.75;
    nav.render();
    expect(drv.S.cam.rotX, 'an ORRERY drag moved the PRISM elevation').toBe(1.0);
    expect(drv.S.cam.rotY, 'an ORRERY drag turned the PRISM').toBeCloseTo(0.25, 12);
  });

  it('⭐ the defaults are the DESIGNS\' OWN tilts, derived from the gains — not zero', async () => {
    // ⛔ DERIVED FROM `0.42` / `0.55`, NEVER THE OTHER WAY ROUND. `projectPrism` scales dz by 0.42
    // and dy by 0.55 and `hypot(0.42, 0.55) ≠ 1`, so today's picture is an elevation-only rotation
    // times an anisotropic scale — and the factorisation does NOT round-trip bit-identically
    // (`K*sin(rotX₀)` returns 0.42000000000000004). The gains are the constants; a default written
    // as a decimal angle would be the same gamble in a form nobody could see.
    const { S } = makeViewState();
    expect(PRISM_DZ).toBe(0.42);
    expect(PRISM_DY).toBe(0.55);
    expect(S.cam.rotX).toBe(Math.atan2(0.42, 0.55));
    expect(S.cam.rotY).toBe(0);
    // ⭐ d2System's TILT is a TRUE sine, and this round trip IS exact.
    expect(Math.sin(Math.asin(SYSTEM_TILT))).toBe(0.42);
    expect(S.sysCam.rotX).toBe(Math.asin(0.42));
    expect(S.sysCam.rotY).toBe(0);
  });

  it('⛔⛔ `S.cam.rotY` STAYS IN [0, 2π) ACROSS MANY REAL DRAGS — the raw field does not', async () => {
    // ⚠ THE INPUT IS THE DRAG, NOT AN ASSIGNMENT. `_handleMouseMove`'s level-3 branch (:4353) writes
    // `_localRotY = _dragStartRotY + dx * 0.008` with NO clamp and NO wrap, so a pilot who keeps
    // dragging the same way walks the field off to arbitrary magnitude and takes mantissa bits off
    // every sin/cos downstream. A test that set `_localRotY = 100` directly would pass over a wrap
    // that only ever sees assignments; these are `mousedown → mousemove → mouseup` triples.
    const { nav, drv } = await loadedNav();
    nav._levelIndex = 3;
    nav.render();
    const TAU = Math.PI * 2;
    const seen = [];
    for (let k = 0; k < 24; k++) {
      nav._handleMouseDown({ clientX: 10, clientY: 120 });
      nav._handleMouseMove({ clientX: 420, clientY: 120 });   // +3.28 rad of azimuth per drag
      nav._handleMouseUp();
      nav.render();
      seen.push(drv.S.cam.rotY);
      expect(drv.S.cam.rotY, `drag ${k}: azimuth left [0, 2π)`).toBeGreaterThanOrEqual(0);
      expect(drv.S.cam.rotY, `drag ${k}: azimuth left [0, 2π)`).toBeLessThan(TAU);
    }
    // ⛔ LIVENESS CONTROL — without this the case is vacuous, because "it stayed in range" is also
    // what a field that never left the range says. The RAW field must have gone well past 2π, or
    // there was nothing to wrap and the wrap is untested.
    expect(Math.abs(nav._localRotY), 'the drags did not push the raw field past 2π — nothing to wrap')
      .toBeGreaterThan(TAU * 3);
    // and it is a real rotation, not a constant: the wrapped value has to actually vary
    expect(new Set(seen.map((v) => v.toFixed(6))).size, 'the published azimuth never changed')
      .toBeGreaterThan(4);
  }, 30000);

  it('⛔ AND SO DOES `S.sysCam.rotY` — same unclamped write, on the OTHER pair', async () => {
    // ⚠ DESIGN 2, NOT DESIGN 1, AND THAT IS THE INTERFACE'S §4 SPLIT RATHER THAN A TEST CONVENIENCE:
    // at SYSTEM design 1 draws a LADDER, so the HOST diverts the drag to `S.ladderScroll` and returns
    // before `_systemRotY` (`NavComputer:4355`). Design 2 draws the orrery, so it keeps the rotation.
    // A first pass at this case dragged in `rail` and read a flat 0 — the wrong mode, not dead code.
    const { nav, drv } = await loadedNav({ mode: 'bars' });
    const TAU = Math.PI * 2;
    nav._levelIndex = 4;
    for (let k = 0; k < 12; k++) {
      nav._handleMouseDown({ clientX: 10, clientY: 120 });
      nav._handleMouseMove({ clientX: 420, clientY: 120 });
      nav._handleMouseUp();
    }
    nav.render();
    expect(Math.abs(nav._systemRotY), 'liveness: the raw orrery azimuth never left range').toBeGreaterThan(TAU);
    expect(drv.S.sysCam.rotY).toBeGreaterThanOrEqual(0);
    expect(drv.S.sysCam.rotY, 'the orrery azimuth left [0, 2π)').toBeLessThan(TAU);
    expect(Math.sin(drv.S.sysCam.rotY), 'and the wrap changed the picture')
      .toBeCloseTo(Math.sin(nav._systemRotY), 9);
  }, 30000);

  it('⛔ THE RAW `_localRotY` IS LEFT ALONE — the HOST owns it and legacy reads it', async () => {
    // `_renderLocal` (:1892) and the supercruise heading (:3605) read the raw field, so wrapping it
    // in place would move a picture nobody asked to move. The wrap belongs to the COPY.
    const { nav } = await loadedNav();
    nav._levelIndex = 3;
    nav._localRotY = 40.5;
    nav.render();
    expect(nav._localRotY, 'the driver wrote back onto the instrument\'s own field').toBe(40.5);
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

// ═══════════════════════════════════════════════════════
// AC-2 — THE ORBIT RINGS ANSWER A CLICK.  Max: "anything on screen should be clickable."
// ═══════════════════════════════════════════════════════
describe("design 2's orbit ellipses are clickable", () => {
  /**
   * A texel ON the ring `r` that is clear of every OTHER candidate the frame published — no body
   * mark within its own radius, no label plate containing it. Walked round the ring rather than
   * computed, because the only point that proves anything is one where the ring is the sole
   * remaining answer; anywhere else the mark or the label is supposed to win.
   */
  function lonelyPointOn(S, ring) {
    for (let k = 0; k < 720; k++) {
      const a = (k / 720) * Math.PI * 2;
      const x = Math.round(ring.cx + Math.cos(a) * ring.rx);
      const y = Math.round(ring.cy + Math.sin(a) * ring.ry);
      const nearMark = (S.bodyHits || []).some((h) => Math.hypot(x - h.x, y - h.y) <= (h.r || 4) + 1);
      const inPlate = (S.labelHits || []).some((h) => x >= h.x - 1 && x < h.x + h.w + 1
                                                   && y >= h.y - 1 && y < h.y + h.h + 1);
      if (!nearMark && !inPlate) return { x, y };
    }
    return null;
  }

  it('⭐⭐ A CLICK ON AN ORBIT RING SELECTS THE BODY THE RING BELONGS TO', async () => {
    const { nav, drv } = await trappySystem('bars');
    const ring = drv.S.orbitRings.find((r) => r.ref === middle(drv));
    expect(ring, 'the orrery published no ring for the middle planet').toBeTruthy();
    const p = lonelyPointOn(drv.S, ring);
    expect(p, 'no texel on the ring is clear of every mark and plate').toBeTruthy();
    // ⛔ THE POINT IS AN INPUT, NOT AN ASSERTION. Before this AC the same click resolved to nothing.
    nav._selectedBody = null;
    nav._handleMouseMove({ clientX: p.x, clientY: p.y });
    clickAt(nav, p.x, p.y);
    nav.render();
    expect(nav._selectedBody, 'the ring did not answer the click').toEqual({ type: 'planet', planetIndex: 1 });
    expect(drv.D.selBody, 'the frame is not drawn on the body the ring names').toBe(middle(drv));
  });

  it('⭐ EVERY DRAWN BODY MARK LIES ON ITS OWN RING — two publications that cannot disagree', async () => {
    // The rings come out of `dottedEllipse`'s arguments and the marks out of the orbit arithmetic
    // that placed them; nothing in the build forces the two to agree. If a ring were ever restated
    // rather than published, this is the assertion that would catch it — the mark would sit off it.
    const { drv } = await trappySystem('bars');
    const planets = drv.S.bodyHits.filter((h) => h.ref && h.ref.kind === 'planet' && h.moon < 0);
    expect(planets.length, 'no planet marks to check').toBeGreaterThan(0);
    for (const h of planets) {
      const ring = pickOrbitRing(drv.S, h.x, h.y);
      expect(ring, `the mark for ${h.ref.name} is on no ring at all`).toBeTruthy();
      expect(ring.ref, `${h.ref.name}'s mark resolved to another body's ring`).toBe(h.ref);
    }
  });

  it("⛔ A MARK ALWAYS BEATS A RING, even one lying exactly on it", async () => {
    // ⚠ BUILT, NOT FOUND — an inner planet's mark landing on an outer planet's ellipse is a real
    // arrangement (every mark is inside every larger ring) but not one a given seed reliably puts
    // under one texel. The fixture is the case the ordering exists for, and without the ordering
    // the click would select `outer` — the body whose ring is under the pointer — instead of the
    // planet whose mark the pilot can actually see there.
    const inner = { kind: 'planet', name: 'INNER', pIdx: 7, au: 1 };
    const outer = { kind: 'planet', name: 'OUTER', pIdx: 9, au: 30 };
    const S = {
      labelHits: [],
      bodyHits: [{ x: 100, y: 60, r: 4, ref: inner, moon: -1, star: false }],
      orbitRings: [{ cx: 100, cy: 100, rx: 40, ry: 40, ref: outer }],
    };
    const nav = { _systemMode: 'system', _selectedPlanetIdx: -1 };
    // The point is on OUTER's ring (100, 60) and on INNER's mark at the same time.
    expect(pickOrbitRing(S, 100, 60).ref, 'the fixture does not put the point on the ring').toBe(outer);
    expect(pickBody(nav, S, 100, 60, null)).toEqual({ type: 'planet', index: 7 });
    // and with the mark gone, the same click falls through to the ring — so the case above is a
    // CHOICE between two live candidates, not a ring that was never consulted.
    S.bodyHits = [];
    expect(pickBody(nav, S, 100, 60, null)).toEqual({ type: 'planet', index: 9 });
  });

  it("⛔ A BELT'S RING CLEARS THE SELECTION, exactly as its centre mark does", async () => {
    // A belt has no downstream identity in either build. Publishing its ring is what stops the click
    // falling through to whichever concentric ring is next — a wrong pick rather than a missing one.
    const { drv, nav } = await trappySystem('bars');
    const beltRing = drv.S.orbitRings.find((r) => r.ref && r.ref.kind === 'belt');
    expect(beltRing, 'the trappy system draws a belt; its ring must be published').toBeTruthy();
    const p = lonelyPointOn(drv.S, beltRing);
    expect(p).toBeTruthy();
    expect(pickOrbitRing(drv.S, p.x, p.y).ref.kind, 'the belt ring is not the nearest one there').toBe('belt');
    expect(pickBody(nav, drv.S, p.x, p.y, null), 'a belt answered with an identity').toBe(null);
  });

  it("⛔ DESIGN 1 PUBLISHES NO RINGS, and a design-2 ring does not outlive a switch to it", async () => {
    // Design 1's SYSTEM is a ladder with no curves. The driver clears the field for both designs,
    // which is what keeps a ring from being live under a picture that never drew one.
    const { nav, drv } = await trappySystem('bars');
    expect(drv.S.orbitRings?.length, 'design 2 must publish rings to begin with').toBeGreaterThan(0);
    const ring = drv.S.orbitRings.find((r) => r.ref === middle(drv));
    const p = lonelyPointOn(drv.S, ring);
    nav.viewMode = 'rail';
    nav.render();
    expect(drv.S.orbitRings, 'a design-2 ring outlived the design that drew it').toBe(null);
    expect(pickOrbitRing(drv.S, p.x, p.y), 'the ladder answered with a ring').toBe(null);
  });
});

// ═══════════════════════════════════════════════════════
// AC-9 — THE PRISM'S Y-GAUGE IS A HANDLE.
// Max: "The indicators on the prism and system screens should be grabbable."
// ═══════════════════════════════════════════════════════
describe("design 1's prism y-gauge is grabbable", () => {
  /** Every camera mark this frame drew: `rect(g, gaugeX + 1, …, 4, 1, INK.KEY)` — 4x1 is its own. */
  const camMarks = (rec, r) => rec.calls.filter((c) => c.op === 'fillRect'
    && c.args[0] === r.x + 1 && c.args[2] === 4 && c.args[3] === 1).map((c) => c.args[1]);

  it('⛔ THE DEFAULT PICTURE GAINS NOTHING — no camera mark until the camera has moved', async () => {
    // At prism entry `_localCenter` IS the player (`NavComputer:1186`), so the branch that draws the
    // camera never runs and the picture Max ruled on is reproduced. AC-11 in one assertion.
    const { nav, drv, rec } = await loadedNav();
    const r = drv.S.yGaugeRect;
    expect(r, 'design 1 at PRISM must publish a y-gauge').toBeTruthy();
    expect(Math.abs(drv.S.cam.y - drv.D.player.y), 'the camera does not enter on the player')
      .toBeLessThanOrEqual(1e-9);
    rec.calls.length = 0;
    nav.render();
    expect(camMarks(rec, r), 'a camera mark was drawn on the default picture').toEqual([]);
  });

  it('⭐⭐ DRAGGING THE GAUGE MOVES THE CAMERA HEIGHT, and the mark lands under the pointer', async () => {
    const { nav, drv, rec } = await loadedNav();
    const r = drv.S.yGaugeRect;
    const before = nav._localCenter.y;
    const grabAt = { x: r.x + 3, y: r.cy };
    const dropAt = { x: r.x + 3, y: Math.round(r.cy - r.span * 0.5) };
    nav._handleMouseDown({ clientX: grabAt.x, clientY: grabAt.y, button: 0 });
    nav._handleMouseMove({ clientX: dropAt.x, clientY: dropAt.y });
    expect(nav._localCenter.y, 'the drag did not move the camera at all').not.toBe(before);
    expect(nav._localCenter.y, 'the class did not use the driver\'s inverse of the paint')
      .toBe(drv.gaugeDragTo(dropAt.y));
    // ⭐⭐ AND THIS IS THE ASSERTION THAT IS NOT CIRCULAR. The line above checks the class called the
    // driver; both sides of it are the same arithmetic, so on its own it would survive the mapping
    // being wrong. The MARK comes out of `d1Prism`'s own `gaugeTexel`, which is the FORWARD
    // direction — if the inverse the drag uses ever stopped matching the paint, the mark would land
    // somewhere the pointer is not, and only this can see that.
    rec.calls.length = 0;
    nav.render();
    const marks = camMarks(rec, drv.S.yGaugeRect);
    expect(marks.length, 'the camera moved but nothing was drawn to say so').toBe(1);
    expect(Math.abs(marks[0] - dropAt.y), `the mark is at ${marks[0]}, the pointer at ${dropAt.y}`)
      .toBeLessThanOrEqual(1);
    // ⛔ AND THE ROTATION IS UNTOUCHED — one hand, one control.
    nav._handleMouseUp();
  });

  it('⛔ RELEASING LEAVES THE VIEW WHERE THE INDICATOR WAS DROPPED', async () => {
    const { nav, drv } = await loadedNav();
    const r = drv.S.yGaugeRect;
    nav._handleMouseDown({ clientX: r.x + 3, clientY: r.cy, button: 0 });
    nav._handleMouseMove({ clientX: r.x + 3, clientY: Math.round(r.cy - r.span * 0.5) });
    const dropped = nav._localCenter.y;
    nav._handleMouseUp();
    nav._handleMouseMove({ clientX: r.x + 3, clientY: r.y + 2 });
    expect(nav._localCenter.y, 'the camera kept moving after the button came up').toBe(dropped);
  });

  it('⛔ A GRAB DOES NOT SURVIVE THE PRESS THAT FOLLOWS IT, taken at another level', async () => {
    // ⭐ WRITTEN BECAUSE A MUTANT SURVIVED. Deleting the release in `_handleMouseUp` broke nothing
    // the other cases could see — the level-3 mousedown reassigns the flag on every press, so an
    // ordinary press-release-press never inherits anything. This is the path that does: the grab is
    // armed at PRISM, the NEXT press is taken at SYSTEM (a branch that never writes the flag), and
    // Tab brings the drag back to PRISM. With the release, that drag rotates; without it, a stale
    // `true` turns it into a camera jump on a press the pilot never aimed at the gauge.
    const { nav, drv } = await loadedNav();
    const r = drv.S.yGaugeRect;
    nav._handleMouseDown({ clientX: r.x + 3, clientY: r.cy, button: 0 });
    nav._handleMouseMove({ clientX: r.x + 3, clientY: Math.round(r.cy - r.span * 0.5) });
    nav._handleMouseUp();
    const parked = nav._localCenter.y;
    // a press taken at SYSTEM — `_handleMouseDown`'s level-4 branch does not touch the flag
    nav._levelIndex = 4; nav.render();
    nav._handleMouseDown({ clientX: 200, clientY: 120, button: 0 });
    // ...and Tab brings the still-held drag back to the prism
    nav._levelIndex = 3; nav.render();
    const rotBefore = nav._localRotY;
    nav._handleMouseMove({ clientX: 150, clientY: 60 });
    expect(nav._localCenter.y, 'a stale grab moved the camera on a press aimed at nothing').toBe(parked);
    expect(nav._localRotY, 'the drag did not fall through to the rotation it should be').not.toBe(rotBefore);
    nav._handleMouseUp();
  });

  it('⛔ A PRESS THAT MISSES THE STRIP STILL ROTATES THE PRISM — the grab steals nothing', async () => {
    // The gauge sits in its own column beside the map, so before this AC a press there rotated. The
    // control it gains must not spread: ten texels left of the strip is the map, and the map orbits.
    const { nav, drv } = await loadedNav();
    const r = drv.S.yGaugeRect;
    const rotBefore = nav._localRotY, yBefore = nav._localCenter.y;
    nav._handleMouseDown({ clientX: r.x - 10, clientY: r.cy, button: 0 });
    nav._handleMouseMove({ clientX: r.x - 40, clientY: r.cy - 20 });
    expect(nav._localRotY, 'the prism did not rotate').not.toBe(rotBefore);
    expect(nav._localCenter.y, 'a press off the gauge moved the camera height').toBe(yBefore);
    nav._handleMouseUp();
  });

  it('⛔ DESIGN 2 PUBLISHES NO GAUGE, and a drag in that column rotates as it always has', async () => {
    const { nav, drv } = await loadedNav({ mode: 'bars' });
    expect(drv.S.yGaugeRect, 'design 2 drew a y-gauge it does not have').toBe(null);
    const rotBefore = nav._localRotY, yBefore = nav._localCenter.y;
    nav._handleMouseDown({ clientX: 400, clientY: 120, button: 0 });
    nav._handleMouseMove({ clientX: 380, clientY: 100 });
    expect(nav._localRotY).not.toBe(rotBefore);
    expect(nav._localCenter.y).toBe(yBefore);
    nav._handleMouseUp();
  });

  it('⛔ THE DRAG IS CLAMPED TO THE STRIP THE GAUGE ACTUALLY DRAWS', async () => {
    // The gauge displays +/-halfKpc, so that is what it can be dragged across — one scale for the
    // readout and the handle. R and F still go further; this control does not silently outrun its
    // own picture.
    const { nav, drv } = await loadedNav();
    const r = drv.S.yGaugeRect;
    nav._handleMouseDown({ clientX: r.x + 3, clientY: r.cy, button: 0 });
    nav._handleMouseMove({ clientX: r.x + 3, clientY: r.cy - r.span * 40 });
    expect(nav._localCenter.y).toBeCloseTo(r.base + r.halfKpc, 12);
    nav._handleMouseMove({ clientX: r.x + 3, clientY: r.cy + r.span * 40 });
    expect(nav._localCenter.y).toBeCloseTo(r.base - r.halfKpc, 12);
    nav._handleMouseUp();
  });
});

// ═══════════════════════════════════════════════════════
// AC-1, SECOND HALF — A DRAWN CELL'S DEAD CORNER RESOLVES TO THE SECTOR THE CELL WAS DRAWN FOR.
// ═══════════════════════════════════════════════════════
describe("a drawn galaxy cell takes the click in its corners too", () => {
  /**
   * ⛔ BUILT, NOT FOUND. A disc of radius 18 under an 8x8 grid of 5-kpc cells: cell (7,3)'s centre
   * (17.5, -2.5) is inside at R=17.7, its outer corner is not. The authority hands back a DISTINCT
   * object per point so the tests can tell "the sector under the click" from "the sector under the
   * cell's centre" by identity — a shared stub would let a wrong snap pass as a right one.
   */
  function disc() {
    const made = new Map();
    const getSectorAt = ({ x, z }) => {
      if (Math.hypot(x, z) > 18) return null;
      const key = `${x.toFixed(3)},${z.toFixed(3)}`;
      if (!made.has(key)) made.set(key, { name: 'S' + key, x, z });
      return made.get(key);
    };
    const nav = { _sectors: { getSectorAt } };
    const live = new Set();
    for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) {
      if (getSectorAt({ x: (i + 0.5 - 4) * 5, z: (j + 0.5 - 4) * 5 })) live.add(j * 8 + i);
    }
    const S = { design: 1, level: 0, mapProj: { design: 1, level: 0, kind: 'square',
      ox: 0, oy: 0, sq: 80, n: 8, cell: 10, cx: 0, cz: 0, size: 40 } };
    return { nav, S, live, getSectorAt };
  }

  it('⭐⭐ THE OUTER CORNER OF A RIM CELL RESOLVES, to the sector under that cell\'s centre', () => {
    const { nav, S, live, getSectorAt } = disc();
    expect(live.has(3 * 8 + 7), 'the fixture must draw cell (7,3)').toBe(true);
    // its outer corner texel: x = 79 (the last column of cell 7), y = 30 (the first row of cell 3)
    const w = worldAt(S.mapProj, 79, 30);
    expect(getSectorAt({ x: w.wx, z: w.wz }), 'the corner must be dead ground on its own').toBe(null);
    const hit = pickSector(nav, S, 79, 30);
    expect(hit, 'the corner of a drawn cell answered nothing').toBeTruthy();
    expect(hit.sector).toBe(getSectorAt({ x: 17.5, z: -2.5 }));
  });

  it('⛔ A CULLED CELL STAYS A MISS — the fallback never re-invents the dead cells', () => {
    const { nav, S, live } = disc();
    expect(live.has(0 * 8 + 7), 'the fixture must cull cell (7,0)').toBe(false);
    expect(pickSector(nav, S, 75, 5), 'a culled cell resolved to a sector').toBe(null);
  });

  it('⛔ A TEXEL THAT ANSWERS FOR ITSELF KEEPS ITS OWN SECTOR, not the centre\'s', () => {
    // A cell can span more than one sector. The fallback must not snap interior clicks.
    const { nav, S, getSectorAt } = disc();
    const w = worldAt(S.mapProj, 72, 32);   // inside cell (7,3), inside the disc
    const own = getSectorAt({ x: w.wx, z: w.wz });
    expect(own, 'the fixture point must be live on its own').toBeTruthy();
    expect(pickSector(nav, S, 72, 32).sector).toBe(own);
    expect(own).not.toBe(getSectorAt({ x: 17.5, z: -2.5 }));
  });

  it('⭐ ON THE REAL GALAXY, every inset corner of every drawn cell resolves', async () => {
    // The live sweep, headless: the same 4 corners per drawn cell the browser probe walked. Before
    // the fallback 28 of 208 answered nothing on this seed.
    const { nav, drv } = await loadedNav();
    nav._levelIndex = 0; nav.render();
    const p = drv.S.mapProj;
    expect(p && p.kind, 'design 1 at GALAXY must publish its square').toBe('square');
    // drawn = the paint's own predicate (centre resolves); the CORNERS are the independent probe
    const live = new Set();
    for (let k = 0; k < p.n * p.n; k++) {
      const i = k % p.n, j = Math.floor(k / p.n), kk = p.size / p.n;
      if (nav._sectors.getSectorAt({ x: p.cx + (i + 0.5 - p.n / 2) * kk, z: p.cz + (j + 0.5 - p.n / 2) * kk })) live.add(k);
    }
    expect(live.size, 'nothing culled — the fixture cannot show anything').toBeLessThan(p.n * p.n);
    const r = projRect(p);
    const gx = (i) => r.x + Math.round(p.sq * i / p.n), gy = (j) => r.y + Math.round(p.sq * j / p.n);
    let probed = 0, dead = 0, culledResolving = 0;
    for (let k = 0; k < p.n * p.n; k++) {
      const i = k % p.n, j = Math.floor(k / p.n);
      if (!live.has(k)) { if (pickSector(nav, drv.S, gx(i) + 13, gy(j) + 13)) culledResolving++; continue; }
      for (const [x, y] of [[gx(i) + 1, gy(j) + 1], [gx(i + 1) - 1, gy(j) + 1], [gx(i) + 1, gy(j + 1) - 1], [gx(i + 1) - 1, gy(j + 1) - 1]]) {
        probed++;
        if (!pickSector(nav, drv.S, x, y)) dead++;
      }
    }
    expect(probed).toBe(live.size * 4);
    expect(dead, `${dead} of ${probed} drawn-cell corners still answer nothing`).toBe(0);
    expect(culledResolving, 'a culled cell\'s centre resolved').toBe(0);
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
                     'chipRect', 'cam', 'view', 'sysCam', 'pick', 'sortIdx', 'sortLabel',
                     'listOffset', 'search']) {
      expect(drv.S, `S.${k} has no default`).toHaveProperty(k);
      expect(drv.S[k], `S.${k} is undefined`).not.toBe(undefined);
    }
    // ⚠ `sysCam` AND `pick` ARE THE 2026-09-08 ADDITIONS AND THEY CARRY THE SAME RISK AS `search`
    // did: a design reads them UNGUARDED at its draw site, so an absent one is not a blank mark, it
    // is a painter throw — caught ONCE by PanelHost, after which the glass shows the last good frame
    // forever and looks alive. `pick` is legitimately `null`; the point is that it EXISTS.
    for (const k of ['rotX', 'rotY']) {
      expect(drv.S.cam, `S.cam.${k} has no default`).toHaveProperty(k);
      expect(drv.S.sysCam, `S.sysCam.${k} has no default`).toHaveProperty(k);
      expect(Number.isFinite(drv.S.cam[k]), `S.cam.${k} is not a number`).toBe(true);
      expect(Number.isFinite(drv.S.sysCam[k]), `S.sysCam.${k} is not a number`).toBe(true);
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

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// 8.  ⛔⛔ AC-10 — EVERY BODY NAME ON THE GLASS WAS A SWALLOWED `TypeError`.
//
// Live at SYSTEM on Sol, the published `S.bodyHits` read `Sol b … Sol k, Sol undefined,
// Sol undefined, Sol undefined`. `state.js`'s `makeRng` returned `{ next, child }` while
// `NameGenerator` calls `float`, `int` and `pick`, so `buildBodies`' catch fired on EVERY body of
// EVERY system and every name was the fallback `'bcdefghijk'[i]` — an alphabet with eleven letters
// against Sol's thirteen planets. And the comment on the function asserted it was the same shape as
// `NavComputer._makeRng`, which is how it survived a read.
//
// ⭐ THE FIRST CASE IS A PURE UNIT TEST ON PURPOSE. The fault is in a function's SHAPE; the cheapest
// sample that can fail is the shape itself, and routing it through a render would only add ways for
// it to pass for the wrong reason.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('the adapter\'s rng is the shape the name generator actually calls', () => {
  it('⛔ exposes float / int / pick / bool / chance / child — the instrument\'s six', () => {
    const rng = makeRng('seed');
    for (const k of ['float', 'int', 'pick', 'bool', 'chance', 'child']) {
      expect(typeof rng[k], `rng.${k} is missing — this is exactly the AC-10 fault`).toBe('function');
    }
    // and each one behaves, because "it exists" was never the question — `next` existed too
    expect(rng.float()).toBeGreaterThanOrEqual(0);
    expect(rng.float()).toBeLessThan(1);
    const i = makeRng('s').int(3, 7);
    expect(Number.isInteger(i) && i >= 3 && i <= 7, `int(3,7) returned ${i}`).toBe(true);
    expect(makeRng('s').int(4)).toBeLessThan(4);
    expect(['a', 'b', 'c']).toContain(makeRng('s').pick(['a', 'b', 'c']));
    expect(typeof makeRng('s').bool()).toBe('boolean');
    expect(typeof makeRng('s').chance(0.5)).toBe('boolean');
    expect(typeof makeRng('s').child('x').float()).toBe('number');
    // ⭐ AND IT IS DETERMINISTIC OFF THE SEED, which is what makes a name stable across frames.
    expect(makeRng('abc').float()).toBe(makeRng('abc').float());
    expect(makeRng('abc').float()).not.toBe(makeRng('xyz').float());
  });

  it('⛔ `generatePlanetName` and `generateMoonName` DO NOT THROW on it — they threw on every call', () => {
    // The old shape failed here with `TypeError: rng.float is not a function`, 39 times out of 39
    // on Sol. `generateSystemName` never did, because it ignores its rng entirely — which is why
    // only the BODY names were wrong and the fault looked like a naming quirk.
    const rng = makeRng(12345 + ':names');
    for (let i = 0; i < 13; i++) {
      const p = rng.child('p' + i);
      let name;
      expect(() => { name = generatePlanetName(p, 'Sol', i, 13); }).not.toThrow();
      expect(typeof name, `planet ${i} produced no name`).toBe('string');
      expect(name.length, `planet ${i} produced an empty name`).toBeGreaterThan(0);
      expect(name, `planet ${i} is the 'bcdefghijk' fallback running off its end`).not.toMatch(/undefined/);
      for (let j = 0; j < 3; j++) {
        let m;
        expect(() => { m = generateMoonName(rng.child(`m${i}.${j}`), name, j, 3); }).not.toThrow();
        expect(typeof m).toBe('string');
        expect(m.length).toBeGreaterThan(0);
      }
    }
    expect(() => generateSystemName(makeRng(1), { x: 8, y: 0, z: 0 })).not.toThrow();
  });

  it('⭐ a HEALTHY build is silent — otherwise the signal below is worth nothing', async () => {
    const { drv } = await trappySystem();
    expect(drv.D.bodies.length, 'the fixture built no bodies at all').toBeGreaterThan(3);
    expect(drv.D.fail.filter((f) => /buildBodies/.test(f))).toEqual([]);
    // and the names really are the generator's, not the eleven-letter fallback
    for (const b of drv.D.bodies) expect(b.name, `${b.kind} name`).not.toMatch(/undefined/);
  }, 30000);

  it('⛔ AND A FAILURE IS LOUD NOW — a throwing generator lands on `D.fail` and on the console', async () => {
    // The defect was not the wrong rng; it was that the wrong rng cost NOTHING to have. A catch that
    // swallows a TypeError on every call and returns a plausible string is a disguise, so the
    // fallback now counts itself onto the channel `designs.js`'s own two catches already use.
    // ⚠ THE SABOTAGE IS THE REAL FAULT, REPLAYED: a name generator that throws a TypeError, driven
    // through the real `buildBodies`. Reaching it means substituting the module, because every other
    // way in (a seed that throws on `toString`, a name object that throws on concat) fires OUTSIDE
    // the two catches under test and would prove nothing about them.
    vi.resetModules();
    vi.doMock('../../generation/NameGenerator.js', () => ({
      generateSystemName: () => 'STUB',
      generatePlanetName: () => { throw new TypeError('rng.float is not a function'); },
      generateMoonName: () => { throw new TypeError('rng.float is not a function'); },
    }));
    try {
      const { makeViewState: mk } = await import('../navViewModes/state.js');
      const { S, D, refresh } = mk();
      // a nav stub, because the fault is entirely inside the adapter and a real instrument would
      // only add ways for the case to pass for the wrong reason
      const stub = {
        _levelIndex: 4, _localCenter: { x: 8, y: 0, z: 0 }, _localRadius: 0.0015,
        _viewCenter: { x: 8, z: 0 }, _viewSize: 44, _playerX: 8, _playerY: 0, _playerZ: 0,
        _localStars: [], _localRotX: 0.5, _localRotY: 0.3, _systemRotX: 0.5, _systemRotY: 0,
        _systemStar: { seed: 77, name: 'Loud', wx: 8, wy: 0, wz: 0 },
        _systemData: { star: { type: 'G' }, zones: {}, asteroidBelts: [],
          planets: [{ orbitRadiusAU: 1, orbitAngle: 1,
                      moons: [{ type: 'rock', radiusEarth: 0.2, T_eq: 250 }],
                      planetData: { radiusEarth: 1, T_eq: 280, habitability: { score: 0.5 }, rings: false } }] },
      };
      const err = []; const realErr = console.error; console.error = (m) => err.push(String(m));
      try { refresh(stub, { width: 427, height: 240, lines: 240 }); } finally { console.error = realErr; }

      expect(D.bodies.length, 'the fixture built nothing to fail on').toBe(2);
      const lines = D.fail.filter((f) => /buildBodies/.test(f));
      expect(lines.length, 'a name generator that throws produced no record at all').toBe(1);
      expect(lines[0], 'the COUNT is what tells "one odd body" from "every body on the glass"')
        .toMatch(/2\/2 body names fell back/);
      expect(lines[0], 'a TypeError must be nameable as a programming error, not a missing name')
        .toMatch(/TypeError/);
      expect(err.length, 'nothing was said out loud — this is exactly how AC-10 survived').toBe(1);
      // and it is ONE line per system, not one per body: a fault that shouts 39 times is noise
      expect(S.level).toBe(4);
    } finally {
      vi.doUnmock('../../generation/NameGenerator.js');
      vi.resetModules();
    }
  }, 60000);
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// 10. ⛔⛔ A CLICK ON A LABEL SELECTS THE OBJECT THE LABEL NAMES — the live mis-selection.
//     `plated()` knocks out a BG rect before drawing, so a label's texels are the label's by
//     construction and nothing underneath is visible there to click. The mark lists did not know
//     that: measured over 120 frames per case on the old placement, 4,854 labels were sitting on a
//     mark they did not name — about 8 of Sol's ~11 drawn numerals, every frame — and a click there
//     resolved to THAT mark. The placer now refuses those slots; this ordering is what makes the
//     labels that remain correct rather than merely harmless.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('a label is picked before the mark underneath it', () => {
  const REGION = { x: 0, y: 0, w: 427, h: 240 };
  const navStub = { _localStars: [] };

  it('⛔ a body tag over a FOREIGN planet selects the planet it NAMES, not the one beneath', () => {
    const named   = { kind: 'planet', name: 'Named',   pIdx: 3, au: 9 };
    const beneath = { kind: 'planet', name: 'Beneath', pIdx: 7, au: 1 };
    const S = {
      // ⚠ The mark's disc STRADDLES the plate's bottom edge on purpose: the overlap is where the
      //    defect lives, and the part sticking out is what makes the control below possible.
      //    plate = x 100..112, y 60..66;  mark = centre (104, 66) r 4, so y 62..70.
      bodyHits:  [{ x: 104, y: 66, r: 4, ref: beneath, moon: -1, star: false }],
      labelHits: [{ x: 100, y: 60, w: 13, h: 7, ref: named, kind: 'body' }],
    };
    expect(pickLabel(S, 104, 63).ref.name).toBe('Named');
    expect(pickBody(navStub, S, 104, 63, REGION), 'inside the plate, the mark beneath still won')
      .toEqual({ type: 'planet', index: 3 });

    // CONTROL — the mark list is still live and IS what answers away from the plate. Without this,
    // the test would pass just as well if `pickBody` had stopped reading `bodyHits` altogether.
    expect(pickBody(navStub, S, 104, 69, REGION), 'the mark below the plate stopped resolving')
      .toEqual({ type: 'planet', index: 7 });
  });

  it('⛔ a body tag NEVER resolves to one of its parent\'s moon pips', () => {
    // The pips sit at `x + 4 + m*2` and the tag's own first slot starts at that same `x + 4`, so a
    // tag adjacent to its parent is exactly where a pip lives. `moon: -1` is what keeps them apart.
    const body = { kind: 'planet', name: 'Parent', pIdx: 2, au: 4 };
    const S = {
      bodyHits:  [{ x: 50, y: 40, r: 2, ref: body, moon: 1, star: false }],
      labelHits: [{ x: 47, y: 37, w: 9, h: 7, ref: body, kind: 'body' }],
    };
    expect(pickBody(navStub, S, 50, 40, REGION), 'the tag resolved to a moon it does not name')
      .toEqual({ type: 'planet', index: 2 });
  });

  it('⭐ the prism does the same, and only for label kinds that ARE stars', () => {
    const named   = { seed: 111, name: 'Named star' };
    const beneath = { seed: 222, name: 'Beneath star' };
    const S = {
      prismHits: [{ x: 200, y: 100, r: 3, ref: beneath }],
      labelHits: [{ x: 196, y: 97, w: 20, h: 7, ref: named, kind: 'star' }],
    };
    expect(pickPrismStar(navStub, S, 200, 100, REGION).star.seed).toBe(111);

    // ⛔ AND THE `kind` IS LOAD-BEARING, NOT DECORATION. A tile-ID plate carries a TILE in `ref`;
    //    handing that to the prism picker would return a tile as if it were a star.
    const T = { ...S, labelHits: [{ ...S.labelHits[0], ref: { i: 1, j: 2 }, kind: 'tile' }] };
    expect(pickPrismStar(navStub, T, 200, 100, REGION).star.seed,
      'a tile plate was consumed as a star').toBe(222);
  });

  it('⚠ containment, not nearest-distance — a plate has edges the pilot can see', () => {
    const named = { kind: 'planet', name: 'Named', pIdx: 1, au: 2 };
    const S = { bodyHits: [], labelHits: [{ x: 100, y: 60, w: 10, h: 7, ref: named, kind: 'body' }] };
    expect(pickLabel(S, 100, 60), 'the top-left texel is inside the plate').not.toBe(null);
    expect(pickLabel(S, 109, 66), 'the bottom-right texel is inside the plate').not.toBe(null);
    expect(pickLabel(S, 110, 60), 'one texel past the right edge still hit').toBe(null);
    expect(pickLabel(S, 100, 67), 'one texel past the bottom edge still hit').toBe(null);
    expect(pickLabel(S, 98, 60), 'two texels short of the left edge still hit').toBe(null);
  });

  it('⛔ an empty or absent list is not a throw — a painter throw FREEZES the glass', () => {
    // `PanelHost` catches a painter throw ONCE and then stops uploading, so the screen keeps showing
    // the last good frame and looks alive. `labelHits` is undefined between makeViewState() and the
    // first paint, which is exactly when an early pointer event can arrive.
    expect(pickLabel({}, 10, 10)).toBe(null);
    expect(pickLabel({ labelHits: [] }, 10, 10)).toBe(null);
    expect(pickLabel({ labelHits: [null, { x: 0, y: 0, w: 5, h: 5 }] }, 1, 1),
      'an entry with no ref is not an identity').toBe(null);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// 9.  ⛔⛔ THE ORBITAL ANGLE — `d2System` placed bodies at `i * 1.7 + 0.6`, the DRAW-LOOP INDEX.
//     With `[` / `]` re-sorting `D.bodies`, pressing the sort key at SYSTEM teleported every planet
//     around its ring. The angle was never missing — `StarSystemGenerator:550` draws it, `:609` sets
//     it, and the LEGACY orrery has always read it (`NavComputer:2756`). `buildBodies` dropped it.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('every planet row carries its orbital angle', () => {
  it('⭐ `ang` is the generator\'s own `orbitAngle`, the number the legacy orrery already draws', async () => {
    const { nav, drv } = await loadedNav();
    nav._systemStar = { wx: 8, wy: 0, wz: 0, seed: 909, spectral: 'G', name: 'Angled' };
    nav._systemData = {
      star: { type: 'G' }, zones: { hzInnerAU: 0.9, hzOuterAU: 1.4 },
      asteroidBelts: [{ centerRadiusAU: 3, widthAU: 0.4 }],
      planets: [
        { orbitRadiusAU: 1, orbitAngle: 0.75, moons: [{ type: 'rock', radiusEarth: 0.2, T_eq: 250, startAngle: 5.5 }],
          planetData: { radiusEarth: 1, T_eq: 280, habitability: { score: 0.8 }, rings: false } },
        { orbitRadiusAU: 8, orbitAngle: 4.25, moons: [],
          planetData: { radiusEarth: 3, T_eq: 120, habitability: { score: 0 }, rings: false } },
        { orbitRadiusAU: 30, moons: [],   // ⚠ NO ANGLE AT ALL — the row must still be drawable
          planetData: { radiusEarth: 9, T_eq: 60, habitability: { score: 0 }, rings: true } },
      ],
    };
    nav._levelIndex = 4;
    nav.render();
    const at = (au) => drv.D.bodies.find((b) => b.kind === 'planet' && b.au === au);
    expect(at(1).ang, 'the planet row dropped its orbital angle').toBe(0.75);
    expect(at(8).ang).toBe(4.25);
    // ⛔ A MISSING ANGLE IS 0, NEVER NaN. `Number(undefined)` is NaN and `cos(NaN)` puts a body
    // nowhere at all — a blank ring rather than a body at a default heading.
    expect(at(30).ang).toBe(0);
    expect(Number.isFinite(at(30).ang)).toBe(true);
    // ⛔ AND IT IS NOT THE DRAW-LOOP INDEX, which is what it was. `i*1.7+0.6` for the three planets
    // would be 0.6 / 2.3 / 4.0, and the middle one is the tell — the fixture picks angles no index
    // can produce so a regression to the index cannot pass by coincidence.
    expect(drv.D.bodies.filter((b) => b.kind === 'planet').map((b) => b.ang))
      .not.toEqual([0.6, 2.3, 4.0]);

    // ⭐ A MOON TAKES ITS PARENT'S ANGLE, NOT ITS OWN `startAngle` (5.5 here). The two are in
    // different frames: `startAngle` is the phase around the PLANET, `ang` is the phase around the
    // STAR, and this row's `au` is already the parent's. Using the moon's own would fling it around
    // the star's ring at a radius it never occupies.
    const moon = drv.D.bodies.find((b) => b.kind === 'moon');
    expect(moon.ang, 'the moon was placed on its own phase, in the wrong frame').toBe(0.75);
    expect(moon.au, 'and it shares its parent\'s radius, which is what makes that correct').toBe(1);

    // ⚠ A BELT KEEPS NO ANGLE — it is a full ring, so it has no phase to be at, and a `0` would be
    // a real angle that happens to mean "nothing".
    const belt = drv.D.bodies.find((b) => b.kind === 'belt');
    expect(belt.ang).toBe(undefined);
  }, 30000);

  it('⭐⭐ THE ORRERY TRACKS THE PLANET AS IT ORBITS — the live angle, not the generation one', async () => {
    // ⛔ THE DEFECT THIS PINS IS A VALUE THAT IS RIGHT ONCE AND THEN SILENTLY STOPS TRACKING, which
    // is the same shape the whole workstream opened with. `main.js:7875` COPIES `orbitAngle` into the
    // scene entry as a NUMBER, and from then on the sim advances only the copy (`:11358`). The nav is
    // handed `system._systemData`, the raw generation data, so reading `p.orbitAngle` draws every
    // planet WHERE IT STARTED, forever. `_live` is the back-reference folded onto `main.js:7878`.
    // ⛔ AND `buildBodies` RUNS ONCE PER SYSTEM — generating ~39 names is not cheap — so reading the
    // live value inside it is not enough on its own; the row has to be re-read every frame. Both
    // halves are required and this test fails if either is removed.
    // Max, 2026-09-07: *"I want the nav screen to reflect the actual orientation of the planets."*
    const { nav, drv } = await loadedNav();
    const live = { orbitAngle: 1.0 };                     // stands in for the scene entry
    nav._systemStar = { wx: 8, wy: 0, wz: 0, seed: 4242, spectral: 'G', name: 'Tracking' };
    nav._systemData = {
      star: { type: 'G' }, zones: { hzInnerAU: 0.9, hzOuterAU: 1.4 }, asteroidBelts: [],
      planets: [
        { orbitRadiusAU: 1, orbitAngle: 0.25, _live: live, moons: [{ type: 'rock', radiusEarth: 0.2, T_eq: 250 }],
          planetData: { radiusEarth: 1, T_eq: 280, habitability: { score: 0.8 }, rings: false } },
        { orbitRadiusAU: 5, orbitAngle: 2.5, moons: [],   // ⚠ NO `_live` — must fall back, not break
          planetData: { radiusEarth: 3, T_eq: 120, habitability: { score: 0 }, rings: false } },
      ],
    };
    nav._levelIndex = 4;
    nav.render();
    const planet = () => drv.D.bodies.find((b) => b.kind === 'planet' && b.au === 1);
    const moon = () => drv.D.bodies.find((b) => b.kind === 'moon');
    const frozen = () => drv.D.bodies.find((b) => b.kind === 'planet' && b.au === 5);

    // ⭐ THE LIVE VALUE WINS OVER THE GENERATION ONE, which is the whole point.
    expect(planet().ang, 'the row read the frozen generation angle instead of the live orbit').toBe(1.0);
    expect(frozen().ang, 'a planet with no scene entry must still draw at its generation angle').toBe(2.5);

    // ⭐⭐ NOW MOVE THE PLANET, THE WAY THE SIM MOVES IT, AND RENDER AGAIN. This is the assertion the
    // cache defeats: same system object, so `buildBodies` does NOT re-run.
    const sysRefBefore = nav._systemData;
    live.orbitAngle = 2.0;
    nav.render();
    expect(nav._systemData, 'the fixture changed system — the cache was never exercised').toBe(sysRefBefore);
    expect(planet().ang, 'the orrery froze: the row did not follow the planet as it orbited').toBe(2.0);
    expect(moon().ang, 'the moon came off its planet — it must carry the parent\'s LIVE angle').toBe(2.0);
    expect(frozen().ang, 'the fallback row drifted, so something is writing angles it should not').toBe(2.5);

    // ⛔ AN ANGLE OF EXACTLY 0 IS A REAL HEADING, NOT AN ABSENT ONE. `||` here instead of `??` would
    // snap the mark back to the generation angle once per revolution, as the planet crossed zero —
    // a body that jumps, periodically, for no reason the pilot can see.
    live.orbitAngle = 0;
    nav.render();
    expect(planet().ang, 'crossing zero fell back to the generation angle').toBe(0);

    // CONTROL — the probe is live: a value the row should NOT be reading does not move it.
    nav._systemData.planets[0].orbitAngle = 5.9;
    nav.render();
    expect(planet().ang, 'the row is reading the generation angle after all').toBe(0);
  }, 30000);

  it('⛔⛔ SORTING `D.bodies` MOVES NO BODY\'S ANGLE — the sort-key teleport', async () => {
    // ⚠ THE INPUT IS THE KEYPRESS. `[` and `]` are bound through `_onKeyDown` (:349) and the whole
    // defect is that the SORT is what moved the planets, so a test that re-sorted the array itself
    // would be testing the comparator rather than the thing that broke.
    const { nav, drv } = await loadedNav();
    nav._systemStar = { wx: 8, wy: 0, wz: 0, seed: 4242, spectral: 'G', name: 'Ringed' };
    nav._systemData = {
      star: { type: 'G' }, zones: { hzInnerAU: 0.9, hzOuterAU: 1.4 }, asteroidBelts: [],
      planets: [1.2, 0.4, 9.0, 2.7, 40].map((au, i) => ({
        orbitRadiusAU: au, orbitAngle: 0.31 + i * 1.13, moons: [],
        planetData: { radiusEarth: 1 + i, T_eq: 300 - i * 40, habitability: { score: 0.1 * i }, rings: false },
      })),
    };
    nav._levelIndex = 4;
    nav.render();
    // the truth: which angle belongs to which planet, by the identity that survives a sort
    const truth = new Map(drv.D.bodies.filter((b) => b.kind === 'planet').map((b) => [b.pIdx, b.ang]));
    expect(truth.size).toBe(5);
    expect([...truth.values()].every(Number.isFinite)).toBe(true);

    const orders = [];
    for (let k = 0; k < 6; k++) {                       // walk the whole key list and back round
      press(nav, 'BracketRight');
      nav.render();
      const planets = drv.D.bodies.filter((b) => b.kind === 'planet');
      orders.push(planets.map((b) => b.pIdx).join(','));
      for (const b of planets) {
        expect(b.ang, `sort ${drv.S.sortLabel}: planet ${b.pIdx}'s angle moved with the sort`)
          .toBe(truth.get(b.pIdx));
      }
    }
    // ⛔ LIVENESS CONTROL: if the key never re-ordered anything, "the angles held" says nothing.
    expect(new Set(orders).size, 'the sort key never changed the draw order — the case is vacuous')
      .toBeGreaterThan(1);
  }, 30000);
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// 10. ⭐ THE CLICK-HIGHLIGHT (INTERFACE §5). Max: "clicking on a cell from the grid should highlight
//     it, then zoom into it" — a SEQUENCE, so the frame has to be on the glass through the zoom.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('a clicked cell is highlighted, and stays highlighted into the zoom', () => {
  for (const [mode, level] of [['rail', 1], ['bars', 1], ['rail', 2]]) {
    it(`⭐ ${mode} L${level}: the click publishes the cell, and it survives the frames after it`, async () => {
      const { nav, drv } = await loadedNav({ mode });
      nav._levelIndex = level;
      nav.render();
      expect(drv.S.pick, 'nothing has been clicked yet').toBe(null);
      const p = drv.S.mapProj, r = projRect(p);
      const i = 3, j = 5;
      const x = r.x + (i + 0.5) * p.cell, y = r.y + (j + 0.5) * p.cell;
      nav._handleMouseMove({ clientX: x, clientY: y });
      clickAt(nav, x, y);

      // ⛔ THE COORDINATES ARE THE DESIGN'S OWN `i`/`j`, NOT the game's col/row. `row = n-1-j` is the
      // Z-flip, and handing the flipped pair to the lab would frame the MIRRORED cell — which looks
      // like a plausible highlight, right up until it is not the one that zooms.
      expect(drv.S.pick, `${mode} L${level}: the click published no highlight`).toBeTruthy();
      expect(drv.S.pick.i).toBe(i);
      expect(drv.S.pick.j).toBe(j);
      expect(drv.S.pick.j, 'the highlight is carrying the game\'s flipped row').not.toBe(p.n - 1 - j);
      expect(drv.S.pick.level).toBe(level);
      expect(Number.isFinite(drv.S.pick.tMs)).toBe(true);

      // ⛔⛔ AND IT SURVIVES THE FRAMES. Written-and-cleared in one tick is what Max already has.
      nav.render();
      expect(drv.S.pick, `${mode} L${level}: ONE render() ate the highlight`).toBeTruthy();
      expect([drv.S.pick.i, drv.S.pick.j]).toEqual([i, j]);
      nav.render(); nav.render(); nav.render();
      expect(drv.S.pick, 'four frames of the zoom ate the highlight').toBeTruthy();
      // ⭐ and the drill it is highlighting really is running, so this is the ZOOM's frames
      expect(nav._anim?.toLevel, 'no drill was started, so there is no zoom to stay visible for')
        .toBe(level + 1);
    }, 30000);
  }

  it('⛔ IT GOES OUT WHEN THE DRILL LANDS, which is the level change and not a timer', async () => {
    // `_startDrillAnim` does NOT move `_levelIndex`; `_updateAnim` assigns `toLevel` only once the
    // 400-500 ms have elapsed (:1278-1281). So the highlight's life IS the zoom's, taken off the
    // instrument's own state rather than from a clock racing it.
    // ⚠ THE DRILL IS LANDED BY REWINDING ITS OWN `startTime`, NOT BY SETTING THE GLOBAL SIM CLOCK.
    //    `_setSimClockMs` would have to be reached through a STATIC import here, while the harness
    //    imports NavComputer DYNAMICALLY — and one `vi.resetModules()` earlier in this file leaves
    //    those two holding different copies of `SimClock.js`, so the test writes one clock and the
    //    instrument reads the other. Measured: it silently never landed the drill. Moving the anim's
    //    own field touches nothing outside this nav.
    const { nav, drv } = await loadedNav();
    nav._levelIndex = 1;
    nav.render();
    const p = drv.S.mapProj, r = projRect(p);
    const x = r.x + 2.5 * p.cell, y = r.y + 1.5 * p.cell;
    nav._handleMouseMove({ clientX: x, clientY: y });
    clickAt(nav, x, y);
    expect(drv.S.pick).toBeTruthy();
    expect(nav._levelIndex, 'the level moved before the zoom, so there was nothing to watch').toBe(1);
    nav.render();
    expect(drv.S.pick, 'the highlight went out during the zoom').toBeTruthy();
    expect(nav._anim, 'no drill to land').toBeTruthy();
    nav._anim.startTime -= nav._anim.duration + 100;      // the drill lands
    nav.render();
    expect(nav._levelIndex, 'the fixture did not actually land the drill').toBe(2);
    expect(drv.S.pick, 'the highlight outlived the drill it belonged to').toBe(null);
  }, 30000);

  it('⛔ A DRAG-PAN LIGHTS NOTHING — it is not a click and it drills nothing', async () => {
    // `_handleClick` rejects a pointer that moved >5 texels (:4494-4496) AFTER `remapClick` has
    // already run, so the highlight has to apply the same test itself or a pan lights a cell that
    // is never going to zoom.
    const { nav, drv } = await loadedNav();
    nav._levelIndex = 1;
    nav.render();
    const p = drv.S.mapProj, r = projRect(p);
    const x = r.x + 2.5 * p.cell, y = r.y + 1.5 * p.cell;
    nav._handleMouseDown({ clientX: x - 40, clientY: y - 30 });
    nav._handleMouseMove({ clientX: x, clientY: y });
    nav._handleMouseUp();
    nav._handleClick({ clientX: x, clientY: y, button: 0 });
    expect(drv.S.pick, 'a pan lit a cell it was never going to drill').toBe(null);
  }, 30000);

  it('⛔ A CLICK THE MODE ATE LIGHTS NOTHING EITHER — tabs, caps, the drawn field', async () => {
    const { nav, drv } = await loadedNav();
    nav._levelIndex = 1;
    nav.render();
    // the design's own tab strip — a level change, not a cell
    const g = drv.geo(nav._canvas.width, nav._canvas.height);
    clickAt(nav, nav._canvas.width * 0.1, g.tabY + 2);
    expect(drv.S.pick, 'a tab click lit a map cell').toBe(null);
    // and the drawn search, which consumes every click while it is open
    nav._levelIndex = 1; nav.render();
    const p = drv.S.mapProj, r = projRect(p);
    const x = r.x + 2.5 * p.cell, y = r.y + 1.5 * p.cell;
    drv.searchOpen();
    nav.render();
    clickAt(nav, x, y);
    expect(drv.S.pick, 'a click on the open search field lit the map underneath it').toBe(null);
  }, 30000);

  it('⛔ PRISM AND SYSTEM PUBLISH NO CELL — they draw marks, not a lattice', async () => {
    const { nav, drv } = await loadedNav();
    nav._levelIndex = 3;
    nav.render();
    const hit = isolatedHit(drv.S.prismHits);
    nav._handleMouseMove({ clientX: hit.x, clientY: hit.y });
    clickAt(nav, hit.x, hit.y);
    expect(drv.S.pick, 'a star glyph published a grid cell').toBe(null);
  }, 30000);

  it('⛔ AND NEITHER DOES GALAXY, WHICH DRAWS A GRID — the cell is not the drill target there', async () => {
    // ⚠ THIS ONE IS NOT AN OVERSIGHT AND THE TEST EXISTS TO SAY SO. Design 1 draws an 8x8 lattice at
    // level 0, but the identity `_handleClick` drills is the containing SECTOR — one of 775 in an
    // irregular density-adaptive quadtree — and it flies to `s.centerX/centerZ` at `s.size`, which
    // need not coincide with the cell under the cursor. A frame on the cell would be the glass
    // promising "this is where you are going" about somewhere else.
    const { nav, drv } = await loadedNav();
    nav._levelIndex = 0;
    nav.render();
    const p = drv.S.mapProj, r = projRect(p);
    expect(p?.level, 'the fixture drew no level-0 map').toBe(0);
    const x = r.x + r.w * 0.34, y = r.y + r.h * 0.55;
    nav._handleMouseMove({ clientX: x, clientY: y });
    expect(nav._hoveredTile?.sector, 'the fixture point must resolve to a sector').toBeTruthy();
    clickAt(nav, x, y);
    expect(drv.S.pick, 'GALAXY framed a cell it was not going to zoom into').toBe(null);
    expect(nav._anim?.toLevel, 'and it still drilled — the exclusion is the highlight, not the click')
      .toBe(1);
  }, 30000);
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// 11. `wrapTau`, on its own terms — the one piece of arithmetic this workstream added.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('wrapTau', () => {
  it('folds any real into [0, 2π) and leaves the picture alone doing it', () => {
    const TAU = Math.PI * 2;
    for (const v of [0, 0.3, TAU - 1e-9, TAU, TAU + 0.5, 40.5, -0.5, -TAU, -100.25, 1e6]) {
      const w = wrapTau(v);
      expect(w, `wrapTau(${v}) = ${w}`).toBeGreaterThanOrEqual(0);
      expect(w, `wrapTau(${v}) = ${w}`).toBeLessThan(TAU);
      // ⭐ THE WRAP IS INVISIBLE, and that is the whole licence for doing it: sin and cos are
      // 2π-periodic, so every consumer downstream sees the same picture it saw before.
      expect(Math.sin(w)).toBeCloseTo(Math.sin(v), 9);
      expect(Math.cos(w)).toBeCloseTo(Math.cos(v), 9);
    }
    // a non-finite azimuth is 0, never NaN — NaN into a projection is a blank screen
    for (const v of [NaN, Infinity, -Infinity, undefined, null]) expect(wrapTau(v)).toBe(0);
  });
});
