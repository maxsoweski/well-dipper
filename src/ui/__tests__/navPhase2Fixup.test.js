/**
 * navPhase2Fixup.test.js — naming-prism-segments Phase 2 FIXUP: the defects Astra's phase-2 review
 * found and the second check confirmed (report: .astra/jobs/20261002-211604-phase2-one-cell-review/).
 *
 * Max's rule (2026-10-02): *"each cell in the galaxy should represent a single sector … Every cell in
 * the sector view should be displaying a single region. Every cell in the region view should be
 * displaying a single prism."* AC-5: *"'Here' is worked out from the player's own position,
 * independent of the rows being browsed; a column that is not the player's shows no here-mark."*
 *
 * One `describe` per finding, each case written to go red when its fix is reverted (sabotage-checked
 * at write time; the note on each says what was reverted):
 *   1  banking / HERE keep the column, the camera and the saved screens in step;
 *   2  one "here" resolver for both designs, legacy, the target styling and the self-warp guard;
 *   3  the density image is rendered at its cache key (never ~100 pc off the cells);
 *   4  legacy GALAXY hover owns a shared edge by the grid's half-open rule;
 *   5  the autopilot's highlight lasts through its hover and its zoom, and the pointer cannot replace it;
 *   7  a catalogue star on a column's upper face is the neighbour's, in the legacy loader too;
 *   8  design edge labels stay whole, inside the picture, beside their parent, after a pan;
 *   9  legacy grid strokes are painted only on the map square the picker accepts.
 * (Finding 6 — neighbouring parents drawn as inert dimmed blocks — is the spec as given and is a
 *  question for Max, not a fix.)
 */
import { describe, it, expect, afterEach } from 'vitest';
import { makeHeadlessNav, navTabHeight } from './helpers/headlessNav.mjs';
import * as navGrid from '../navGrid.js';
import * as navDrill from '../navDrill.js';
import { isHereStar, hereRowOf, playerStarOf } from '../navViewModes/starIdentity.js';
import { makeDesigns } from '../navViewModes/designs.js';
import { NavGalaxyRenderer, mapKey } from '../../rendering/NavGalaxyRenderer.js';
import { boundsOf } from '../../generation/GalaxyGrid.js';
import { simClockMs, _setSimClockMs } from '../../core/SimClock.js';
import { AutopilotNavSequence } from '../../auto/AutopilotNavSequence.js';
import { measurePixelText } from '../../rendering/PixelText.js';

const W = 427, H = 240;
const key = (a) => navGrid.addressKey(a);
const landDrill = (nav) => { if (nav._anim) { nav._anim.startTime -= nav._anim.duration + 100; nav.render(); } };
const insideCol = (col, p) => p.x >= col.bounds.min.x && p.x <= col.bounds.max.x && p.z >= col.bounds.min.z && p.z <= col.bounds.max.z;
/** Is address `a` inside the box `parent` names (every part `parent` has, `a` shares)? */
const within = (a, parent) => key(a).startsWith(key(parent));

async function navIn(mode, at = { x: 8, y: 0, z: 0 }) {
  const h = await makeHeadlessNav({ width: W, height: H });
  h.nav._viewModesEnabled = !!mode;
  h.nav.viewMode = mode;
  h.nav.setPlayerPosition(at);
  h.nav._levelIndex = 0; h.nav._applyLevelView(); h.nav.render();
  return h.nav;
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════
describe('finding 1 — HERE and banking keep the column, the camera and the saved screens in step', () => {
  // Sabotage (2026-10-02): `setColumn` without `keepCameraInColumn` AND `_applyLevelView` without its
  // PRISM call → the camera stays 5.7 kpc away in the browsed column; red.
  for (const mode of ['rail', 'bars']) {
    it(`${mode}: a foreign column, back to REGION, HERE, Tab into PRISM → the player's column, camera inside it`, async () => {
      const nav = await navIn(mode);
      const drv = nav._viewDriverInst;
      const foreign = navGrid.parentAt(3, 12, 4);                 // P8 …, Astra's reproduction
      navDrill.jumpTo(nav, 3, foreign, { y: 0 });
      nav.render();
      expect(key(nav._prismColumn.address)).toBe(key(foreign));
      drv.tabLevel(-1);                                           // PRISM → REGION (the tab strip)
      nav.render();
      expect(nav._levelIndex).toBe(2);
      drv.recentreOnPlayer();                                     // design 2's HERE (both designs expose it)
      nav._viewEase = null;
      nav.render();
      drv.tabLevel(+1);                                           // REGION → PRISM
      expect(nav._levelIndex).toBe(3);
      const mine = navGrid.parentAt(3, 8, 0);
      expect(key(nav._prismColumn.address), 'PRISM is not the player\'s column after HERE').toBe(key(mine));
      expect(insideCol(nav._prismColumn, nav._localCenter), `camera (${nav._localCenter.x}, ${nav._localCenter.z}) is outside the column on the glass`).toBe(true);
      nav.render();
      const strays = nav._localStars.filter((s) => !navGrid.inFootprint(nav._prismColumn.bounds, s.wx, s.wz));
      expect(strays.length, 'rows of another column are on the glass').toBe(0);
      expect(nav._localStars.length, 'nothing loaded — the case is vacuous').toBeGreaterThan(0);
    }, 60000);
  }

  // Sabotage (2026-10-02): the `reconcileBelow` call removed from `drillInto` → REGION is still the
  // player's N10 H9 inside sector P8's screen; red.
  it('drill GALAXY → another sector: the saved REGION and the PRISM column are inside it, and Tab lands there', async () => {
    const nav = await navIn('rail');
    const drv = nav._viewDriverInst;
    const p8 = { sector: { i: 15, j: 7 } };
    navDrill.drillInto(nav, 0, p8);
    landDrill(nav);
    expect(nav._levelIndex).toBe(1);
    expect(key(nav._viewStack[1].address)).toBe(key(p8));
    expect(within(nav._viewStack[2].address, p8), `saved REGION ${key(nav._viewStack[2].address)} is not inside P8`).toBe(true);
    expect(within(nav._prismColumn.address, nav._viewStack[2].address), 'saved column is not inside the saved region').toBe(true);
    expect(insideCol(nav._prismColumn, nav._localCenter), 'camera outside the saved column').toBe(true);
    drv.tabLevel(+1); landDrill(nav); nav._viewEase = null; nav.render();
    expect(nav._levelIndex).toBe(2);
    expect(within(drv.S.gridParent, p8), `Tab to REGION showed ${key(drv.S.gridParent)}, not a region of P8`).toBe(true);
    drv.tabLevel(+1); nav.render();
    expect(nav._levelIndex).toBe(3);
    expect(within(nav._prismColumn.address, p8), 'Tab to PRISM showed a column outside P8').toBe(true);
    // …and drilling back into the player's own sector restores the player's own region and column
    nav._levelIndex = 0; nav._applyLevelView(); nav.render();
    navDrill.drillInto(nav, 0, navGrid.parentAt(1, 8, 0));
    landDrill(nav);
    expect(key(nav._viewStack[2].address)).toBe(key(navGrid.parentAt(2, 8, 0)));
    expect(key(nav._prismColumn.address)).toBe(key(navGrid.parentAt(3, 8, 0)));
  }, 60000);
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
describe('finding 2 — one "here" resolver, by identity, never by name', () => {
  const P = { x: 8.0001, y: 0, z: 0.0001 };
  const fake = (over = {}) => ({ _playerX: P.x, _playerY: P.y, _playerZ: P.z, _prismColumn: navDrill.columnAt(P.x, P.z), ...over });

  // Sabotage (2026-10-02): the old name fallback restored in `navDrill.hereStar` → the 2 pc decoy is
  // taken as the player's star; red.
  it('legacy: a same-name star 2 pc away in the player\'s column is not here', () => {
    const nav = fake({ _currentSystemName: 'HOME' });
    const decoy = { name: 'HOME', key: 'p:0:1:2:3', wx: P.x + 0.002, wy: 0, wz: P.z };
    expect(navGrid.inFootprint(nav._prismColumn.bounds, decoy.wx, decoy.wz), 'fixture: decoy must be in the column').toBe(true);
    expect(navDrill.hereStar(nav, [decoy])).toBe(null);
  });

  // Sabotage: `playerStarOf` ignoring `_hereStarId` (position only) → the 0.05 pc stranger is here; red.
  it('a carried identity is authoritative: a keyed stranger 0.05 pc away is not the player\'s star', () => {
    const nav = fake({ _hereStarId: { key: 'p:0:9:9:9', name: 'HOME', wx: P.x, wy: P.y, wz: P.z } });
    const stranger = { key: 'p:0:1:1:1', name: 'ELSEWHERE', wx: P.x + 0.00005, wy: 0, wz: P.z };
    const own = { key: 'p:0:9:9:9', name: 'HOME', wx: P.x, wy: 0, wz: P.z };
    expect(hereRowOf(nav, [stranger])).toBe(null);
    expect(hereRowOf(nav, [stranger, own])).toBe(own);
    expect(isHereStar(nav, stranger)).toBe(false);
    // no carried identity: the explicit position fallback (nearest inside 0.1 pc) still finds a row
    expect(hereRowOf(fake(), [stranger])).toBe(stranger);
    // a carried identity for a star the player has LEFT is ignored
    expect(playerStarOf(fake({ _hereStarId: { key: 'p:0:9:9:9', wx: P.x + 1, wy: 0, wz: P.z } })).key).toBeUndefined();
  });

  // Sabotage (2026-10-02): `commit()`'s guard back to `star.name === nav._currentSystemName` → the alias
  // warps and the same-name stranger does not; red. `D.targetIsHere` back to the name test → red too.
  for (const mode of ['rail', 'bars']) {
    it(`${mode}: an alias at the player's own position is here (no warp); a same-name stranger is not`, async () => {
      const nav = await navIn(mode);
      const drv = nav._viewDriverInst;
      const home = { wx: 8, wy: 0, wz: 0, key: 'p:0:8:0:0', name: 'HOME', spectral: 'G', seed: 1 };
      nav._currentSystemName = 'HOME';
      nav.openToCurrentSystem(home, null);
      const sent = [];
      nav._onCommit = (a) => sent.push(a);
      nav._commitAction = null;
      nav._selectedNavStar = { ...home, name: 'ALIAS' };
      nav._levelIndex = 3; nav.render();
      expect(drv.D.targetIsHere, 'the alias at home reads as a destination').toBe(true);
      expect(drv.commit()).toBe(false);
      expect(sent.length, 'Enter warped to the system the player is in').toBe(0);
      nav._selectedNavStar = { wx: 8.003, wy: 0, wz: 0.001, key: 'p:0:8:0:1', name: 'HOME', spectral: 'K', seed: 2 };
      nav._commitAction = null;
      nav.render();
      expect(drv.D.targetIsHere, 'a different star that shares home\'s name reads as here').toBe(false);
      expect(drv.commit()).toBe(true);
      expect(sent.length).toBe(1);
      expect(sent[0].star.key).toBe('p:0:8:0:1');
    }, 60000);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
describe('finding 3 — the density image is rendered where its key says', () => {
  const realDoc = globalThis.document;
  afterEach(() => { globalThis.document = realDoc; });

  /** A NavGalaxyRenderer with its GPU replaced by recorders: what centre/extent each render asked for. */
  function fakeRenderer(res = 64) {
    const asked = [];
    let ext = 0;
    globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ({ drawImage() {} }) }) };
    const r = Object.create(NavGalaxyRenderer.prototype);
    Object.assign(r, {
      _resolution: res, _cache: new Map(), _cacheMax: 8, _outputCanvas: {},
      _outputCtx: { createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} },
      _renderer: { getRenderTarget() {}, setRenderTarget() {}, render() {}, readRenderTargetPixels() {} },
      _material: { uniforms: { uCenter: { value: { set: (x, z) => asked.push({ x, z }) } },
                               uExtent: { get value() { return ext; }, set value(v) { ext = v; asked[asked.length - 1].ext = v; } } } },
    });
    return { r, asked };
  }

  // Sabotage (2026-10-02): the old `Math.round(cx * 10) / 10` key with an exact-centre render → the
  // second call returns the first image, 98 pc off; red.
  it('two REGION frames 98 pc apart never share an image, and each is rendered within half a texel of its frame', () => {
    const { r, asked } = fakeRenderer(64);
    const ext = 0.0625;                                     // a REGION frame's half-width
    const a = r.render(7.951, -0.049, ext), b = r.render(8.049, 0.049, ext);
    expect(b, 'a frame 98 pc away was handed the cached image').not.toBe(a);
    const half = (2 * ext / 64) / 2;
    for (const [i, want] of [[0, { x: 7.951, z: -0.049 }], [1, { x: 8.049, z: 0.049 }]]) {
      expect(Math.abs(asked[i].x - want.x)).toBeLessThanOrEqual(half + 1e-12);
      expect(Math.abs(asked[i].z - want.z)).toBeLessThanOrEqual(half + 1e-12);
      expect(asked[i].ext).toBeCloseTo(ext, 9);
    }
    // a frame within the same output texel IS a cache hit (the cache still works)
    expect(r.render(7.951 + half / 4, -0.049, ext)).toBe(a);
  });

  it('mapKey: the keyed centre is within half an output texel at every level\'s scale', () => {
    for (const ext of [19, 1, 0.0625, 0.0039]) {
      for (const [cx, cz] of [[8, 0], [7.95123, -0.04987], [-3.3, 11.17]]) {
        const q = mapKey(cx, cz, ext, 512), half = ext / 512;
        expect(Math.abs(q.cx - cx)).toBeLessThanOrEqual(half + 1e-12);
        expect(Math.abs(q.cz - cz)).toBeLessThanOrEqual(half + 1e-12);
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
describe('finding 4 — legacy GALAXY owns a shared edge the way the grid does', () => {
  // Sabotage (2026-10-02): the screen-space `_mouseY >= by && < by + sw` test restored → on the
  // horizontal faces the hover names the sector BELOW the face; red.
  it('a pointer on every horizontal sector face through x = 8 hovers the face\'s owner (navGrid.cellAt)', async () => {
    const nav = await navIn(null);
    const P = navDrill.legacyProj(nav);
    let checked = 0, wrong = [];
    for (let j = 1; j < 19; j++) {
      const face = boundsOf({ sector: { i: 13, j } }).max.z;   // the shared face between rows j and j + 1
      const px = P.toX(8), py = P.toY(face);
      nav._mouseX = px; nav._mouseY = py;
      nav.render();
      const w = P.toWorld(px, py), want = navGrid.cellAt(0, null, w.x, w.z);
      if (!want) continue;
      checked++;
      const got = nav._hoveredTile;
      if (!got || key(got.address) !== key(want)) wrong.push(`${key(want)} ← ${got && key(got.address)}`);
    }
    expect(checked, 'no live face probed — the case is vacuous').toBeGreaterThan(5);
    expect(wrong, 'the legacy GALAXY hover disagrees with the grid on a face').toEqual([]);
  }, 60000);
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
describe('finding 5 — the autopilot\'s highlight lasts through its hover and its zoom', () => {
  // Sabotage (2026-10-02): `agePick` back to the bare 700 ms backstop → the GALAXY pick is gone at
  // 701 ms, before the 800 ms hover ends; red.
  it('design: a held pick is still on the glass at 701 ms and 1300 ms (hover 800 + zoom 600), then goes', async () => {
    const nav = await navIn('rail');
    const drv = nav._viewDriverInst;
    const p8 = { sector: { i: 15, j: 7 } };
    const t0 = simClockMs();
    navDrill.showPick(nav, 0, p8, { holdMs: 1500 });
    for (const dt of [701, 1300]) {
      _setSimClockMs(t0 + dt); nav.render();
      expect(drv.S.pick && key(drv.S.pick.address), `the pick expired at ${dt} ms`).toBe(key(p8));
    }
    _setSimClockMs(t0 + 1600); nav.render();
    expect(drv.S.pick).toBe(null);
  }, 60000);

  // Sabotage (2026-10-02): `_hoverThenDrill` calling `showPick` without `holdMs` → the pick carries no
  // hold and expires at the 700 ms backstop, before the 800 ms GALAXY hover ends; red.
  it('the autopilot\'s own step holds its pick for at least its hover plus its zoom, at every level', async () => {
    const nav = await navIn('rail');
    const drv = nav._viewDriverInst;
    const seq = new AutopilotNavSequence({
      navComputer: nav, openNavComputer: () => {}, closeNavComputer: () => {}, onWarpReady: () => {},
      onComplete: () => {}, soundEngine: null, playerPos: { x: 8, y: 0, z: 0 },
    });
    const dest = { x: 12.06, y: 0, z: 4.06 };
    for (const level of [0, 1, 2]) {
      const steps = navGrid.drillPath(dest.x, dest.z);
      navDrill.jumpTo(nav, level, steps[level].parent || null);
      nav.render();
      const waits = [];
      seq._delay = (ms, fn) => waits.push({ ms, fn });
      seq._aborted = false;
      seq._hoverThenDrill(dest, level);
      const hover = waits[0].ms;
      const t0 = simClockMs();
      const drill = level === 1 ? 500 : 600;
      _setSimClockMs(t0 + hover + drill - 1); nav.render();
      expect(drv.S.pick && key(drv.S.pick.address), `L${level}: the pick was gone before its hover (${hover} ms) and zoom ended`)
        .toBe(key(steps[level].child));
      _setSimClockMs(t0);
    }
  }, 60000);

  // Sabotage (2026-10-02): the `pickHeld` guards removed → the pointer over Sol replaces P8; red.
  it('legacy GALAXY: a pointer parked over Sol does not replace the held pick; after the hold it does', async () => {
    const nav = await navIn(null);
    const P = navDrill.legacyProj(nav);
    nav._handleMouseMove({ clientX: P.toX(8), clientY: P.toY(0) });
    nav.render();
    expect(key(nav._hoveredTile.address)).toBe('N10');
    const t0 = simClockMs();
    navDrill.showPick(nav, 0, { sector: { i: 15, j: 7 } }, { holdMs: 1500 });
    nav._handleMouseMove({ clientX: P.toX(8), clientY: P.toY(0) });
    _setSimClockMs(t0 + 900); nav.render();
    expect(key(nav._hoveredTile.address), 'the pointer replaced the autopilot\'s pick').toBe('P8');
    _setSimClockMs(t0 + 1600); nav.render();
    expect(key(nav._hoveredTile.address)).toBe('N10');
  }, 60000);
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
describe('finding 7 — a catalogue star belongs to one column in the legacy loader too', () => {
  // Sabotage (2026-10-02): the `inFootprint` line on the catalogue loop removed → the face star is a
  // row of Sol's column; red.
  it('a real star exactly on the column\'s upper x face is the neighbour\'s; one inside is a row', async () => {
    const nav = await navIn(null);
    const col = nav._prismColumn;
    const face = { name: 'FACE STAR', x: col.bounds.max.x, y: 0.0001, z: col.center.z, spect: 'K' };
    const lowFace = { name: 'LOW FACE STAR', x: col.bounds.min.x, y: 0.0001, z: col.center.z + 0.001, spect: 'K' };
    const inside = { name: 'INSIDE STAR', x: col.center.x + 0.001, y: 0.0001, z: col.center.z - 0.001, spect: 'M' };
    nav._realStarCatalog = { loaded: true, findInVolume: () => [face, lowFace, inside] };
    nav._levelIndex = 3; nav.render();
    const names = new Set(nav._localStars.map((s) => s.name));
    expect(names.has('INSIDE STAR'), 'fixture: the catalogue was not read').toBe(true);
    expect(names.has('LOW FACE STAR'), 'the lower face is this column\'s (half-open)').toBe(true);
    expect(names.has('FACE STAR'), 'a star on the upper face loaded into the column below it').toBe(false);
  }, 60000);
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
describe('finding 8 — design edge labels after a pan: whole, inside the picture, beside their parent', () => {
  /** Paint once through a glyph recorder; collect the layout guard's complaints. */
  function paint(drv, design) {
    const text = [], violations = [];
    const g = new Proxy({}, { get: (_t, k) => (k === 'canvas' ? { width: 417, height: 240 } : () => {}), set: () => true });
    const d = makeDesigns({ S: drv.S, D: drv.D, drawPixelText: (_g, s, x, y) => { text.push({ s: String(s), x, y }); },
                            onViolation: (m) => violations.push(String(m)) });
    d.resetRegions();
    (design === 1 ? d.drawDesign1 : d.drawDesign2)(g, 417, 240);
    return { text, violations };
  }
  async function framed(mode, level) {
    const h = await makeHeadlessNav({ width: 417, height: 240 });
    const nav = h.nav;
    nav._viewModesEnabled = true; nav.viewMode = mode;
    nav.setPlayerPosition({ x: 8, y: 0, z: 0 });
    nav._levelIndex = level; nav._applyLevelView(); nav.render();
    return { nav, drv: nav._viewDriverInst };
  }

  // Sabotage (2026-10-02): the lab's old `gridEdgeLabels` (row labels at the square's resting x, column
  // labels unclamped) → design 2 row labels sit inside the panned grid and column A starts at x = -2,
  // with the guard firing "overflows map"; red.
  for (const [mode, design] of [['rail', 1], ['bars', 2]]) {
    for (const [level, pans] of [[1, [1, -1, 0.37, 0.93]], [2, [0.0625, -0.05, 0.11]], [0, [7, -9]]]) {
      it(`design ${design} L${level}: after pans east/west every label is whole and inside the picture, and none overflows`, async () => {
        const { nav, drv } = await framed(mode, level);
        const base = { ...nav._viewCenter };
        for (const dx of pans) {
          nav._viewCenter = { x: base.x + dx, z: base.z + dx / 3 };
          nav.render();
          const { text, violations } = paint(drv, design);
          const overflow = violations.filter((v) => /label/.test(v) && /overflow/i.test(v));
          expect(overflow, `pan ${dx}: ${overflow[0]}`).toEqual([]);
          const p = drv.S.mapProj, clip = p.clip, n = navGrid.childCount(level), lab = navGrid.axisLabels(level);
          const cells = navGrid.childGrid(level, p.parent);
          const k = p.sq / p.size, toX = (x) => p.x0 + p.sq / 2 + (x - p.cx) * k;
          const left = toX(cells[0].bounds.min.x);
          for (let j = 0; j < n; j++) {
            for (const t of text.filter((t) => t.s === lab.rows[j] && t.y >= clip.y && t.y < clip.y + clip.h)) {
              const w = measurePixelText(t.s);
              if (design === 2) {
                expect(t.x - 1 >= clip.x && t.x + w + 1 <= clip.x + clip.w, `row ${t.s} at x ${t.x} is cut by the picture's edge`).toBe(true);
                // beside its parent's left edge — or pinned at the picture's edge when that edge is off it
                const beside = Math.round(left) - 3 - w;
                expect(t.x === beside || t.x === clip.x + 1 || t.x === clip.x + clip.w - w - 1,
                  `row ${t.s} at x ${t.x} is neither beside the parent (${beside}) nor pinned at the edge`).toBe(true);
              }
            }
          }
          for (const c of lab.cols) {
            for (const t of text.filter((t) => t.s === c && t.y < p.y0)) {
              const w = measurePixelText(t.s);
              expect(t.x >= clip.x && t.x + w <= clip.x + clip.w, `column ${c} at x ${t.x} is cut by the picture's edge`).toBe(true);
            }
          }
        }
      }, 60000);
    }
  }
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
describe('finding 9 — legacy grid strokes are painted only on the map square', () => {
  /** A context that tracks the clip in force (save / rect / clip / restore) at every strokeRect. */
  function clipRecorder() {
    const strokes = [];
    let pending = null, clip = null;
    const stack = [];
    let strokeStyle = '';
    const ctx = new Proxy({}, {
      get(_t, k) {
        if (k === 'canvas') return { width: W, height: H };
        if (k === 'strokeStyle') return strokeStyle;
        if (k === 'save') return () => stack.push(clip);
        if (k === 'restore') return () => { clip = stack.length ? stack.pop() : null; };
        if (k === 'rect') return (x, y, w, h) => { pending = { x, y, w, h }; };
        if (k === 'clip') return () => { clip = pending; };
        if (k === 'strokeRect') return (x, y, w, h) => strokes.push({ x, y, w, h, ink: strokeStyle, clip });
        if (k === 'measureText') return (s) => ({ width: String(s).length * 6 });
        if (k === 'getImageData' || k === 'createImageData') return (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(Math.max(0, w * h * 4)) });
        if (typeof k === 'symbol') return undefined;
        return () => ({ addColorStop() {} });
      },
      set(_t, k, v) { if (k === 'strokeStyle') strokeStyle = v; return true; },
    });
    return { ctx, strokes };
  }

  // Sabotage (2026-10-02): the `ctx.save(); … ctx.clip()` line in `_render2DLevel` removed → the grid's
  // strokes are drawn with no clip, 80 texels outside the square; red.
  for (const level of [0, 1, 2]) {
    it(`legacy L${level}, panned: every grid stroke is clipped to the map square the picker accepts`, async () => {
      const nav = await navIn(null);
      nav._levelIndex = level; nav._applyLevelView();
      nav._viewCenter = { x: nav._viewCenter.x + nav._viewSize / 2, z: nav._viewCenter.z + nav._viewSize / 5 };
      const rec = clipRecorder(), real = nav._ctx;
      nav._ctx = rec.ctx;
      try { nav.render(); } finally { nav._ctx = real; }
      const P = navDrill.legacyProj(nav);
      const tabH = navTabHeight(H);   // the tab strip's five cells share the grid's ink; they are not the map
      const grid = rec.strokes.filter((s) => /100, 180, 255/.test(s.ink) && !(s.h === tabH && Math.abs(s.w - W / 5) < 1e-9));
      expect(grid.length, 'no grid strokes recorded — the case is vacuous').toBeGreaterThan(10);
      const outside = grid.filter((s) => s.x < P.ox || s.x + s.w > P.ox + P.drawSize || s.y < P.oy || s.y + s.h > P.oy + P.drawSize);
      expect(outside.length, 'fixture: the pan put no cell outside the square').toBeGreaterThan(0);
      const unclipped = grid.filter((s) => !s.clip || s.clip.x !== P.ox || s.clip.y !== P.oy || s.clip.w !== P.drawSize || s.clip.h !== P.drawSize);
      expect(unclipped.map((s) => JSON.stringify(s)), 'grid strokes drawn without the map-square clip').toEqual([]);
    }, 60000);
  }
});

