/**
 * prismPhase3Fixup.test.js — naming-prism-segments Phase 3, the fixup pass after the live check and
 * Astra's review (job 20261003-034119-phase3-loader-bar-review). One describe per finding fixed.
 *
 * Max: "The update build for the prism nav view needs to include performance optimization" (AC-6) and
 * "you could see the un-highlighted segments in the nav bar and click or drag to a new one quickly"
 * (AC-7). Every case names the mutant it was proved against (sabotage table in the fixup report).
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { makeHeadlessNav } from './helpers/headlessNav.mjs';
import { loaderNav, catalogue } from './helpers/loaderHarness.mjs';
import { makeDesigns } from '../navViewModes/designs.js';
import { FACE, drawPixelText, measurePixelText } from '../../rendering/PixelText.js';
import { findStar, sameStar, hereRowOf } from '../navViewModes/starIdentity.js';
import { POSITION_MATCH_TOL } from '../../generation/RealStarCatalog.js';
import { HashGridStarfield } from '../../generation/HashGridStarfield.js';
import { GalacticMap } from '../../generation/GalacticMap.js';
import { multiplicityForSeed } from '../../generation/multiplicityOracle.js';
import { realStarKey } from '../../generation/GalaxyGrid.js';
import * as navGrid from '../navGrid.js';
import * as G from '../navViewModes/slabBar.js';
import {
  prismLoadScheduler, loaderFor, slabIndexOfY, FRAME_BUDGET_MS, REGION_RESERVE_MS, clearTwinCache, MATCH_KPC,
} from '../prismLoader.js';

const W = 417, H = 240;
const SOL = { x: 8, y: 0.025, z: 0 };

afterEach(() => { vi.restoreAllMocks(); prismLoadScheduler.reset(); HashGridStarfield.realFeatureCatalog = null; });

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
function paint(nav, design) {
  const { S, D } = nav._viewDriverInst;
  const { ctx, fills } = inkRecordingContext();
  const d = makeDesigns({ S, D, face: FACE, measurePixelText, drawPixelText });
  S.design = design; d.resetRegions(); d.resetViolations();
  if (design === 1) d.drawDesign1(ctx, W, H); else d.drawDesign2(ctx, W, H);
  return { fills, d, S, D, regions: d.regions(), violations: d.violations() };
}
/** A headless nav at PRISM on the column of (x, z), the ship there, the whole column loaded. */
async function loadedNav(mode, at = SOL) {
  const h = await makeHeadlessNav({ width: W, height: H });
  const nav = h.nav;
  h.rec.calls = { push() {} };
  nav._viewModesEnabled = true;
  nav._playerX = at.x; nav._playerY = at.y; nav._playerZ = at.z;
  const col = navGrid.enterColumn(navGrid.parentAt(3, at.x, at.z));
  nav._levelIndex = 3; nav._prismColumn = col; nav._localCubeSize = col.halfWidth;
  nav._localCenter = { x: col.center.x, y: at.y, z: col.center.z };
  nav.viewMode = mode;
  nav.render(); prismLoadScheduler.drain(); nav.render(); prismLoadScheduler.drain(); nav.render();
  return nav;
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('AC-6 — under a design the legacy PRISM picture is not painted (Astra finding 1)', () => {
  it('the design frame still LOADS through `_renderLocal`, but never draws the legacy prism; legacy still draws without a design', async () => {
    // MUTANT `legacy-underpaint` (delete the `if (this.viewMode) return;` in `_renderLocal`): the
    // minimap spy fires under the design — red.
    const h = await makeHeadlessNav({ width: W, height: H });
    const nav = h.nav;
    nav._viewModesEnabled = true; nav._levelIndex = 3; nav.viewMode = 'rail';
    const ensure = vi.spyOn(nav, '_ensureStarsLoaded');
    const mini = vi.spyOn(nav, '_renderPrismMinimap');
    nav.render(); nav.render();
    expect(ensure).toHaveBeenCalled();
    expect(nav._localStars.length, 'the design frame no longer loads').toBeGreaterThan(0);
    expect(mini, 'the legacy prism painted under the design').not.toHaveBeenCalled();
    // liveness: with no design the very same frame paints the legacy prism (and its minimap)
    nav.viewMode = null; nav.render();
    expect(mini).toHaveBeenCalled();
  }, 120000);
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('AC-6 — "which row is this star" without walking the whole column', () => {
  it('findStar answers exactly what the sameStar rule answers, on keyed, keyless, k: and height-less rows', () => {
    // MUTANT `prefilter-wy-nan` (drop the `|| 0` on wy in the prefilter): height-less rows go missing — red.
    // MUTANT `prefilter-no-kind` (drop the same-kind-different-key skip): a keyed neighbour inside 0.1 pc
    // is accepted — red.
    const T = POSITION_MATCH_TOL;
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const reference = (list, s) => {
      let best = null, bestD = Infinity;
      for (const r of list) {
        if (r === s || (s.key != null && r.key === s.key)) return r;
        if (!sameStar(r, s)) continue;
        const d = Math.hypot(r.wx - s.wx, (r.wy || 0) - (s.wy || 0), r.wz - s.wz);
        if (d < bestD) { bestD = d; best = r; }
      }
      return best;
    };
    for (let trial = 0; trial < 300; trial++) {
      const c = { wx: 8 + rnd() * 1e-3, wy: rnd() < 0.2 ? undefined : rnd() * 1e-3, wz: rnd() * 1e-3 };
      const rows = [];
      for (let i = 0; i < 40; i++) {
        const k = rnd();
        rows.push({
          wx: c.wx + (rnd() - 0.5) * 4 * T, wy: rnd() < 0.15 ? undefined : (c.wy || 0) + (rnd() - 0.5) * 4 * T,
          wz: c.wz + (rnd() - 0.5) * 4 * T,
          key: k < 0.4 ? `p:M:${i}:${trial}:0` : k < 0.55 ? `r:${i}` : k < 0.65 ? `k:Sys${i}` : undefined,
        });
      }
      const pick = rnd();
      const s = pick < 0.3 ? { ...c } : pick < 0.6 ? { ...c, key: `p:M:999:${trial}:0` }
        : pick < 0.8 ? { ...c, key: 'k:Sol' } : { ...rows[Math.floor(rnd() * rows.length)] };
      expect(findStar(rows, s), `trial ${trial}`).toBe(reference(rows, s));
    }
  });

  it('D.here and D.selStar on a loaded column are the rows a full scan finds — and a caller\'s own rows are still found', async () => {
    // MUTANT `near-rows-empty` (rowsNearY returns []): D.here and D.selStar go null — red.
    // MUTANT `near-rows-not-intact` (drop the `arr !== publishedArr` test): a caller's row is never found — red.
    const nav = await loadedNav('rail');
    const first = nav._localStars;
    expect(first.length).toBeGreaterThan(3000);
    // the ship moves onto a loaded star the way the game moves it (the loader starts over for it)
    const hereKey = first[Math.floor(first.length * 0.37)].key;
    const h0 = first.find((r) => r.key === hereKey);
    nav.setPlayerPosition({ x: h0.wx, y: h0.wy, z: h0.wz });
    nav.render(); prismLoadScheduler.drain(); nav.render(); prismLoadScheduler.drain();
    const rows = nav._localStars;
    expect(rows).not.toBe(first);
    const here = rows.find((r) => r.key === hereKey);
    const sel = rows[Math.floor(rows.length * 0.81)];
    nav._selectedNavStar = { ...sel };
    nav.render();
    const { D } = nav._viewDriverInst;
    expect(D.starRows.length, 'the designs are not on the loader\'s rows').toBe(rows.length);
    expect(D.hereColumn).toBe(true);
    expect(D.here, 'here').toBe(hereRowOf(nav, rows));
    expect(D.here).toBe(here);
    expect(D.selStar, 'selection').toBe(sel);
    // rows that are NOT the loader's intact publish (a caller's own array) are scanned whole
    const extra = { ...sel, key: 'p:M:1:2:3', wx: sel.wx + 1e-6, name: 'NOT LOADED' };
    nav._localStars = rows.concat([extra]);
    nav._selectedNavStar = { ...extra };
    nav.render(); prismLoadScheduler.drain(); nav.render();
    expect(nav._viewDriverInst.D.starRows).toContain(extra);
    expect(nav._viewDriverInst.D.selStar).toBe(extra);
  }, 180000);
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('AC-6 — design 2 list starfield: the same pixels, bounded by the pane (Astra finding 1)', () => {
  it('top-down at the widest zoom: every texel the old per-row draw left visible is drawn exactly once, and nothing else', async () => {
    // MUTANT `parity-flipped` (`((tx - j) & 1) === 1` in listField): half the visible field goes — red.
    // MUTANT `no-dedupe` (drop the `seen` test): duplicate texels — red.
    const nav = await loadedNav('bars');
    nav._viewDriverInst.S.list = true;
    nav._localRotX = Math.PI / 2; nav._localRadius = 0.015625;
    nav.render();
    const p = paint(nav, 2);
    const { d, S, D } = p;
    const map = p.regions.map;
    const mapY = map.y, mapH = map.h;
    const cxp = W / 2, cyp = mapY + mapH / 2;
    // the OLD picture: one RULE texel per row that lands, then the parity pass repaints BG over half
    const cy0 = Math.round(mapY), cw = Math.round(W), ch = Math.round(mapH);
    const covered = (x, y) => x >= 0 && x < cw && y >= cy0 && y < cy0 + ch && ((x - (y - cy0)) & 1) === 0;
    const want = new Set();
    for (const s of D.starRows) {
      const q = d.projectPrism(s, cxp, cyp, W / 2, mapH / 2);
      if (q.x < 0 || q.x >= W || q.y < mapY || q.y >= mapY + mapH) continue;
      const x = Math.round(q.x), y = Math.round(q.y);
      if (!covered(x, y)) want.add(`${x},${y}`);
    }
    expect(want.size, 'the fixture lands no stars on the list pane').toBeGreaterThan(200);
    // the NEW draw: RULE 1x1 fills in the pane before the parity pass's first BG fill
    const firstBg = p.fills.findIndex((f) => f.ink === d.INK.BG && f.w === 1 && f.h === 1 && f.y >= mapY && f.y < mapY + mapH);
    const field = p.fills.slice(0, firstBg).filter((f) => f.ink === d.INK.RULE && f.w === 1 && f.h === 1
      && f.y >= mapY - 1 && f.y <= mapY + mapH && f.x >= 0 && f.x <= W);
    const got = field.map((f) => `${f.x},${f.y}`);
    expect(new Set(got).size, 'a texel was drawn twice').toBe(got.length);
    expect(got.filter((k) => !want.has(k)), 'drawn but not in the old picture').toEqual([]);
    expect([...want].filter((k) => !got.includes(k)), 'in the old picture but not drawn').toEqual([]);
    expect(got.length).toBeLessThanOrEqual(Math.ceil(cw * (ch + 1) / 2) + cw);
    expect(p.violations).toBe(0);
    // and a still frame does not walk the rows again (memoised on rows + camera + pane), through the
    // driver's own designs instance — the one that keeps the memo
    nav.render();
    const rowsNow = nav._viewDriverInst.D.starRows;
    const spy = vi.spyOn(rowsNow, Symbol.iterator);
    nav.render();
    expect(nav._viewDriverInst.D.starRows).toBe(rowsNow);
    expect(spy, 'a still list frame walked every row again').not.toHaveBeenCalled();
  }, 180000);
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('AC-6 — a paused slab job never rebuilds the feature regions it already built (Astra finding 2)', () => {
  it('evict every cached region while the job is paused: resuming builds none, and the rows are unchanged', () => {
    // MUTANT `no-pins` (SlabJob.step calls `_step` directly, not under `pinned`): resuming rebuilds the
    // evicted regions inline — the spy fires — red.
    const nav = loaderNav(SOL);
    const L = loaderFor(nav);
    L.ensure(SOL.y);
    const k = slabIndexOfY(SOL.y);
    // run the job until its regions are held, then stop it
    L._workSlab(k, () => { const j = L.jobs.get(k); return !!j && j.phase >= 1; });
    const job = L.jobs.get(k);
    expect(job && job.phase, 'the job did not pause after its prefetch').toBe(1);
    expect(job.pins.size).toBeGreaterThanOrEqual(27);
    nav._gm._featureRegionCache.clear();                    // the other instance / the game evicted them all
    const gen = vi.spyOn(nav._gm, '_generateFeatureRegion');
    L._workSlab(k, () => false);
    expect(L.slabs.has(k), 'the slab did not finish').toBe(true);
    expect(gen, 'a held region was rebuilt inline').not.toHaveBeenCalled();
    // same rows as an uninterrupted load
    const ref = loaderNav(SOL); const RL = loaderFor(ref); RL.ensure(SOL.y); RL._workSlab(k, () => false);
    expect(L.slabs.get(k).map((r) => r.key)).toEqual(RL.slabs.get(k).map((r) => r.key));
  }, 120000);

  it('a slab holds every region its ROWS read too — Sol\'s column straddles the x = 8 kpc region edge', () => {
    // MUTANT `centre-regions-only` (regionList → the query's 27): rows' context lookups rebuild — red.
    const nav = loaderNav(SOL);
    const L = loaderFor(nav);
    L.ensure(SOL.y);
    const k = slabIndexOfY(SOL.y);
    L._workSlab(k, () => { const j = L.jobs.get(k); return !!j && j.phase >= 1; });
    nav._gm._featureRegionCache.clear();
    const gen = vi.spyOn(nav._gm, '_generateFeatureRegion');
    L._workSlab(k, () => false);
    expect(gen).not.toHaveBeenCalled();
    const col = nav._prismColumn;
    expect(Math.floor(col.bounds.min.x / 4) !== Math.floor(col.bounds.max.x / 4)
      || Math.floor(col.bounds.min.z / 4) !== Math.floor(col.bounds.max.z / 4), 'fixture: Sol\'s column no longer straddles a region edge').toBe(true);
  }, 120000);

  it('a cold region is only started with REGION_RESERVE_MS left: frames stay ≤ budget + one cell slice under a slow clock', () => {
    // MUTANT `no-region-reserve` (drop the remaining() test in prefetchRegions): a 6 ms region started
    // near the deadline makes a ~14 ms frame — red.
    const clock = { t: 0, inRegion: false };
    const COST = 0.1, REGION_COST = REGION_RESERVE_MS + 1;   // a region a little dearer than the reserve
    const dens = GalacticMap.prototype.potentialDerivedDensity;
    vi.spyOn(GalacticMap.prototype, 'potentialDerivedDensity').mockImplementation(function (...a) {
      if (!clock.inRegion) clock.t += COST; return dens.apply(this, a);
    });
    const gen = GalacticMap.prototype._generateFeatureRegion;
    vi.spyOn(GalacticMap.prototype, '_generateFeatureRegion').mockImplementation(function (...a) {
      clock.inRegion = true; try { return gen.apply(this, a); } finally { clock.inRegion = false; clock.t += REGION_COST; }
    });
    const nav = loaderNav(SOL);
    prismLoadScheduler.configure({ requestFrame: null, now: () => (clock.t += 0.001) });
    nav._ensureStarsLoaded(SOL.x, SOL.y, SOL.z, 0);
    let worst = 0, n = 0;
    for (; n < 3000 && prismLoadScheduler.hasWork(); n++) { const t0 = clock.t; prismLoadScheduler.runFrame(); worst = Math.max(worst, clock.t - t0); }
    expect(n, 'the slow clock bit nothing').toBeGreaterThan(100);
    expect(worst).toBeLessThanOrEqual(FRAME_BUDGET_MS + 32 * COST + 1);
  }, 180000);
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('AC-8 — twins and rows follow the generator\'s inputs (Astra finding 4)', () => {
  it('the real-feature catalogue arriving after a load: the column reloads and every twin is re-decided', () => {
    // MUTANT `twin-cache-ignores-inputs` (twinCacheFor keyed by map only): the stale twin is suppressed
    // and the new one shown — rows differ from a cold load — red.
    // MUTANT `loader-ignores-inputs` (ensure() without the inputs test): the old rows stay — red.
    const col = navGrid.enterColumn(navGrid.parentAt(3, SOL.x, SOL.z));
    const twinUnder = (gm, p) => {
      const q = HashGridStarfield.prismQuery(gm, p, MATCH_KPC, MATCH_KPC, { extent: true });
      q.step(null);
      let best = null, bd = MATCH_KPC;
      for (const s of q.results) {
        const d = Math.hypot(s.worldX - p.x, s.worldY - p.y, s.worldZ - p.z);
        if (d < bd || (best && d === bd && s.key < best.key)) { bd = d; best = s; }
      }
      return best && best.key;
    };
    const fakeCatalog = (p) => ({
      loaded: true,
      findNearby: (pos, maxD) => {
        const f = { type: 'globular-cluster', position: { ...p }, radius: 0.003, seed: 1, context: {}, overrides: {} };
        const dist = Math.hypot(f.position.x - pos.x, f.position.y - pos.y, f.position.z - pos.z);
        return dist < maxD + f.radius ? [{ ...f, distance: dist, insideFeature: dist < f.radius }] : [];
      },
    });
    // find a real-star spot in the middle of the column whose twin the cluster changes
    let p = null;
    for (let i = 0; i < 40 && !p; i++) {
      const c = { x: col.center.x + (i % 5 - 2) * 0.0004, y: 0.03 + Math.floor(i / 5) * 0.004, z: col.center.z + ((i * 3) % 5 - 2) * 0.0004 };
      const gm = new GalacticMap('well-dipper-galaxy-1');
      HashGridStarfield.realFeatureCatalog = null;
      const a = twinUnder(gm, c);
      HashGridStarfield.realFeatureCatalog = fakeCatalog(c);
      const b = twinUnder(gm, c);
      HashGridStarfield.realFeatureCatalog = null;
      if (b && a !== b) p = c;
    }
    expect(p, 'fixture: no spot where the cluster changes the twin').toBeTruthy();
    const real = [{ x: p.x, y: p.y, z: p.z, name: 'Cluster Star', spect: 'K' }];
    const key = (rows) => rows.map((r) => r.key).sort().join(' ');

    const nav = loaderNav({ ...SOL, y: p.y, realStars: real });
    nav._ensureStarsLoaded(col.center.x, p.y, col.center.z, 0);
    prismLoadScheduler.drain();
    const before = nav._localStars;
    HashGridStarfield.realFeatureCatalog = fakeCatalog(p);              // main.js installs it, late
    nav._ensureStarsLoaded(col.center.x, p.y, col.center.z, 0);
    expect(nav.slabLoad.state, 'the column did not start over').toBe('loading');
    prismLoadScheduler.drain();
    expect(nav._localStars).not.toBe(before);

    const ref = loaderNav({ ...SOL, y: p.y, realStars: real });          // a fresh map: cold twins, same inputs
    ref._ensureStarsLoaded(col.center.x, p.y, col.center.z, 0);
    prismLoadScheduler.drain();
    expect(key(nav._localStars)).toBe(key(ref._localStars));
    clearTwinCache(nav._gm); clearTwinCache(ref._gm);
  }, 240000);
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('loader multiplicity reads the star\'s POSITION (Astra finding 3)', () => {
  it('every row of an inner-galaxy slab carries the arrival oracle\'s count at its own position', () => {
    // MUTANT `mult-pos-shape` (pass `pos: {x,y,z}` again): ~44 % of rows disagree — red.
    const at = { x: 1.5, y: 0.05, z: 0.2 };
    const nav = loaderNav(at);
    nav._ensureStarsLoaded(nav._localCenter.x, at.y, nav._localCenter.z, 0);
    for (let i = 0; i < 2000 && !nav.slabLoad.viewReady; i++) prismLoadScheduler.runFrame();
    const rows = nav._localStars;
    expect(rows.length).toBeGreaterThan(500);
    const bad = rows.filter((r) => r.mult !== multiplicityForSeed(
      { seed: r.seed, worldX: r.wx, worldY: r.wy, worldZ: r.wz, type: r.spectral, name: r.name }, { galacticMap: nav._gm }).count);
    expect(bad.length, `${bad.length} of ${rows.length} rows disagree with the position-aware oracle`).toBe(0);
    // liveness: the context matters here — without the position a good share of rows roll differently
    const blind = rows.filter((r) => r.mult !== multiplicityForSeed({ seed: r.seed, type: r.spectral, name: r.name }, { galacticMap: nav._gm }).count);
    expect(blind.length).toBeGreaterThan(rows.length * 0.05);
  }, 240000);
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('AC-7 — the side view keeps the neighbouring prisms (Astra finding 6)', () => {
  it('rotation exactly 0 (edge-on): the pillars are drawn; the plane lattice is not', async () => {
    // MUTANT `edge-on-null-frame` (prismFrame returns null at tilt 0 again): no pillar — red.
    const h = await makeHeadlessNav({ width: W, height: H });
    const nav = h.nav;
    nav._viewModesEnabled = true; nav._levelIndex = 3; nav.viewMode = 'bars';
    nav._localRadius = 0.015625; nav._localRotX = 0;
    nav.render();
    const p = paint(nav, 2);
    const map = p.regions.map;
    const lat = p.fills.filter((f) => (f.ink === p.d.INK.GRID || f.ink === p.d.INK.LATTICE)
      && f.y >= map.y && f.y < map.y + map.h && f.x >= map.x && f.x < map.x + map.w);
    expect(lat.length, 'no prism boundary drawn side-on').toBeGreaterThan(20);
    // a pillar is vertical: many fills share an x and span more than a texel row
    const byX = new Map();
    for (const f of lat) byX.set(f.x, (byX.get(f.x) || new Set()).add(f.y));
    expect([...byX.values()].some((ys) => ys.size >= 4), 'no vertical pillar').toBe(true);
    expect(p.violations).toBe(0);
  }, 120000);
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('AC-7 — beyond the bar: above / below marks (plan §4.5, Astra finding 8)', () => {
  it('a ship above N30, a target exactly at +3 kpc and a view below S30 are marked in the end insets; ±3 kpc edges are exact', async () => {
    // MUTANT `no-beyond-marks` (delete the `beyond(...)` calls): every assertion below — red.
    const h = await makeHeadlessNav({ width: W, height: H });
    const nav = h.nav;
    nav._viewModesEnabled = true; nav._levelIndex = 3; nav.viewMode = 'rail';
    nav.render();
    nav._playerY = 3.05;                                     // N31: above the bar
    nav._selectedNavStar = { wx: nav._localCenter.x, wy: 3.0, wz: nav._localCenter.z, key: 'p:M:0:0:1', name: 'T', seed: 1 };
    nav._localCenter.y = -3.15;                              // S32: below the bar
    nav.render();
    const p = paint(nav, 1);
    const bar = p.S.slabBarRect;
    expect(bar).toBeTruthy();
    const at = (x, y, ink) => p.fills.some((f) => f.ink === ink && f.x <= x && x < f.x + f.w && f.y <= y && y < f.y + f.h);
    expect(at(bar.x, bar.y, p.d.INK.YOU), 'no ship mark above the bar').toBe(true);
    expect(at(bar.x + 5, bar.y, p.d.INK.TARGET), 'no target mark above the bar (y = 3.0 is N31)').toBe(true);
    expect(at(bar.x + 2, bar.y + bar.h - 1, p.d.INK.KEY), 'no view mark below the bar').toBe(true);
    // nothing in a cell claims them
    const [top, span] = G.barSpan(bar);
    const inCells = (ink, x) => p.fills.some((f) => f.ink === ink && f.x === x && f.y >= top && f.y < top + span);
    expect(inCells(p.d.INK.YOU, bar.x)).toBe(false);
    // ⚠ the edges, exactly: −3.0 is S30's floor (in the bar), +3.0 is N31's (beyond)
    expect(G.slabIndexOfY(-3.0)).toBe(-30);
    expect(G.slabIndexOfY(3.0)).toBe(30);
    nav._localCenter.y = -3.0; nav._playerY = 0.025; nav._selectedNavStar = null; nav.render();
    const q = paint(nav, 1);
    expect(q.fills.some((f) => f.ink === q.d.INK.KEY && f.y === bar.y + bar.h - 1 && f.x >= bar.x && f.x < bar.x + bar.w),
      'S30 itself was marked as below the bar').toBe(false);
  }, 120000);
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('YOU means the player — design 2\'s minimap dot (Astra finding 7, the part this phase moved)', () => {
  it('the minimap centre is YOU on the ship\'s own column and blank on a browsed one', async () => {
    // MUTANT `minimap-you-always` (drop the hereColumn test): the foreign column shows YOU — red.
    const h = await makeHeadlessNav({ width: W, height: H });
    const nav = h.nav;
    nav._viewModesEnabled = true; nav._levelIndex = 3; nav.viewMode = 'bars';
    nav.render();
    const mx = W - 53 + 12;
    const dot = (p) => p.fills.some((f) => f.ink === p.d.INK.YOU && f.x === mx && f.w === 1 && f.h === 1);
    let p = paint(nav, 2);
    expect(p.D.hereColumn).toBe(true);
    expect(dot(p), 'no YOU dot on the ship\'s column').toBe(true);
    const far = navGrid.enterColumn(navGrid.parentAt(3, nav._localCenter.x + 0.05, nav._localCenter.z));
    nav._prismColumn = far; nav._localCenter.x = far.center.x; nav._localCenter.z = far.center.z;
    nav.render();
    p = paint(nav, 2);
    expect(p.D.hereColumn).toBe(false);
    expect(dot(p), 'YOU drawn on a column the ship is not in').toBe(false);
  }, 120000);
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('AC-6 — the galaxy map\'s shader is compiled at boot, not on the first REGION frame (live trace: 62.5 ms)', () => {
  it('construction starts compileAsync with the renderer\'s target set to the map\'s own, and restores it', async () => {
    // MUTANT `no-warmup` (delete the compileAsync block): never called — red.
    // MUTANT `warm-wrong-variant` (compile without binding `_rt`): compiled against the canvas — red.
    await makeHeadlessNav({ width: W, height: H });            // the DOM stand-ins the constructor needs
    const { NavGalaxyRenderer } = await import('../../rendering/NavGalaxyRenderer.js');
    const prevRT = { tag: 'game target' };
    let current = prevRT;
    const seen = [];
    const renderer = {
      getRenderTarget: () => current,
      setRenderTarget: (t) => { current = t; },
      compileAsync: (scene, camera) => { seen.push({ target: current, scene, camera }); return Promise.resolve(scene); },
    };
    const r = new NavGalaxyRenderer(renderer, new GalacticMap('well-dipper-galaxy-1'));
    expect(seen.length, 'the shader was not compiled at construction').toBe(1);
    expect(seen[0].target, 'compiled for a different target than render() uses').toBe(r._rt);
    expect(seen[0].scene).toBe(r._scene);
    expect(current, 'the renderer\'s target was not restored').toBe(prevRT);
    // and a renderer without compileAsync (an older three, a stub) constructs exactly as before
    expect(() => new NavGalaxyRenderer({ getRenderTarget: () => null, setRenderTarget() {} }, new GalacticMap('well-dipper-galaxy-1'))).not.toThrow();
  });
});
