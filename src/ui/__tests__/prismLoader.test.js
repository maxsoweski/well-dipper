/**
 * prismLoader.test.js — PRISM's slab loader (naming-prism-segments Phase 3: AC-6, AC-7's seam, AC-8).
 *
 * Max: "The update build for the prism nav view needs to include performance optimization" and, on a
 * loading screen, "let's try to make the system work without this". These pin the headless half:
 *   · the slab arithmetic and the seam (nav.slab, jumpToSlab, slabLoad, _rowsRev)
 *   · ONE deadline per frame, shared by every instance, never overrun by more than one unit — under
 *     an injected SLOW clock where every density evaluation costs 0.1 ms (≈ 30× Chrome on this PC)
 *   · cancellation (leave PRISM, switch column, jump slab) and resumption
 *   · suspension (the cockpit instance) and its main.js wiring
 *   · AC-8: the same rows whatever order the slabs load in, with real stars beside column and slab edges
 *   · sorted views built in slices, incremental after a publish, equal to a plain sort in all six modes
 * The live half (Chrome traces, no task > 50 ms) is the integration check, not this file.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { stripCommentsPreservingOffsets } from '../../../tests/helpers/source-scan.mjs';
import { GalacticMap } from '../../generation/GalacticMap.js';
import { HashGridStarfield } from '../../generation/HashGridStarfield.js';
import { addressOf, slabRef, realStarKey } from '../../generation/GalaxyGrid.js';
import * as navGrid from '../navGrid.js';
import {
  prismLoadScheduler, loaderFor, slabIndexOfY, slabOfIndex, slabYRange, parseSlab, refOfIndex,
  K_MIN, K_MAX, FRAME_BUDGET_MS, SliceSort, clearTwinCache,
} from '../prismLoader.js';
import { SORT_KEYS } from '../navViewModes/state.js';
import { loaderNav, loadAll, catalogue, stubGrid, proc } from './helpers/loaderHarness.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const SOL = { x: 8, y: 0.025, z: 0 };

afterEach(() => { vi.restoreAllMocks(); prismLoadScheduler.reset(); });

/** A comparable fingerprint of the published rows, order-free. */
const fingerprint = (rows) => rows.map((r) => [r.key, r.name, r.wx, r.wy, r.wz, r.spectral, r.mult, r.seed, !!r.isReal, r.slab].join('|')).sort();

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('slab arithmetic (GalaxyGrid half-open, 100 pc)', () => {
  it('y = 0 is N1, the first point below is S1, and every slab owns its lower face only', () => {
    expect(slabOfIndex(slabIndexOfY(0))).toEqual({ hemi: 'N', n: 1 });
    expect(slabOfIndex(slabIndexOfY(-Number.MIN_VALUE))).toEqual({ hemi: 'S', n: 1 });
    for (let k = K_MIN; k <= K_MAX; k++) {
      const [y0, y1] = slabYRange(k);
      expect(slabIndexOfY(y0), `${refOfIndex(k)} does not own its lower face`).toBe(k);
      expect(slabIndexOfY(y1), `${refOfIndex(k)} owns its upper face`).toBe(k + 1);
      expect(slabIndexOfY((y0 + y1) / 2)).toBe(k);
      expect(slabRef(addressOf(0, y0, 0))).toBe(refOfIndex(k));
    }
    expect(refOfIndex(K_MIN)).toBe('S30');
    expect(refOfIndex(K_MAX)).toBe('N30');
  });

  it('refs parse both ways; malformed refs are refused', () => {
    expect(parseSlab('N16')).toEqual({ hemi: 'N', n: 16 });
    expect(parseSlab('s3')).toEqual({ hemi: 'S', n: 3 });
    expect(parseSlab({ hemi: 'N', n: 1 })).toEqual({ hemi: 'N', n: 1 });
    for (const bad of ['N0', 'X3', '', null, undefined, { hemi: 'N', n: 0 }, { hemi: 'Q', n: 2 }, 'N1.5']) expect(parseSlab(bad)).toBe(null);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('the seam: nav.slab, nav.jumpToSlab, nav.slabLoad, nav._rowsRev', () => {
  it('jumpToSlab puts the camera inside every one of the 60 slabs, and nav.slab reads it back', () => {
    const nav = loaderNav(SOL);
    for (let k = K_MIN; k <= K_MAX; k++) {
      const s = slabOfIndex(k);
      expect(nav.jumpToSlab(slabRef(s))).toEqual(s);
      const [y0, y1] = slabYRange(k);
      expect(nav._localCenter.y >= y0 && nav._localCenter.y < y1, `${slabRef(s)}: camera y ${nav._localCenter.y} outside [${y0}, ${y1})`).toBe(true);
      expect(nav.slab).toEqual(s);
    }
    const y = nav._localCenter.y;
    expect(nav.jumpToSlab('nonsense')).toBe(null);
    expect(nav._localCenter.y, 'a malformed ref moved the camera').toBe(y);
  });

  it('a jump starts loading THAT slab first, and slabLoad reports it', () => {
    const nav = loaderNav(SOL);
    expect(nav.slabLoad.state).toBe('idle');
    nav.jumpToSlab('N20');
    expect(nav.slabLoad.state).toBe('loading');
    expect(nav.slabLoad.viewSlab).toBe('N20');
    let guard = 0;
    while (!nav.slabLoad.loadedSlabs.size && guard++ < 500) prismLoadScheduler.runFrame();
    expect([...nav.slabLoad.loadedSlabs]).toEqual(['N20']);
    expect(nav.slabLoad.viewReady).toBe(true);
    for (const r of nav._localStars) expect(r.slab).toBe('N20');
  }, 60000);

  it('_rowsRev bumps exactly when the published rows are replaced — never on a frame that publishes nothing', () => {
    const nav = loaderNav(SOL);
    const L = loaderFor(nav);
    const pub = vi.spyOn(L, 'publish');
    nav._ensureStarsLoaded(SOL.x, SOL.y, SOL.z, 0);
    let rev = nav._rowsRev, arr = nav._localStars, bumps = 0, frames = 0;
    while (prismLoadScheduler.hasWork()) {
      prismLoadScheduler.runFrame(); frames++;
      if (nav._rowsRev !== rev) { bumps++; expect(nav._localStars, 'rev moved, rows did not').not.toBe(arr); }
      else expect(nav._localStars, 'rows moved, rev did not').toBe(arr);
      rev = nav._rowsRev; arr = nav._localStars;
    }
    const realPublishes = pub.mock.results.length;
    expect(frames).toBeGreaterThan(bumps);
    expect(bumps).toBeGreaterThan(1);
    expect(bumps).toBeLessThanOrEqual(realPublishes);
    expect(nav.slabLoad.state).toBe('ready');
    expect(nav.slabLoad.progress).toBe(1);
    // and ANY replacement bumps it — a caller's `= []` included
    const r0 = nav._rowsRev; nav._localStars = []; expect(nav._rowsRev).toBe(r0 + 1);
  }, 60000);
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('ONE deadline per frame, shared, under a slow clock', () => {
  const COST = 0.1;          // fake ms per density evaluation: ≈ 30× Chrome's ~3 µs on this PC
  const REGION_COST = 2;     // fake ms per feature region (one indivisible unit)
  const UNIT = 32 * COST + 1; // the most a cell slice may add after the deadline is seen (+ slack for rows/clock reads)

  function slowClock() {
    const clock = { t: 0, inRegion: false };
    const dens = GalacticMap.prototype.potentialDerivedDensity;
    vi.spyOn(GalacticMap.prototype, 'potentialDerivedDensity').mockImplementation(function (...a) {
      if (!clock.inRegion) clock.t += COST;
      return dens.apply(this, a);
    });
    const pre = GalacticMap.prototype.prefetchFeatureRegion;
    vi.spyOn(GalacticMap.prototype, 'prefetchFeatureRegion').mockImplementation(function (...a) {
      clock.inRegion = true; try { return pre.apply(this, a); } finally { clock.inRegion = false; clock.t += REGION_COST; }
    });
    return clock;
  }

  function runAll(clock) {
    const frames = [];
    let guard = 0;
    while (prismLoadScheduler.hasWork() && guard++ < 100000) {
      const t0 = clock.t;
      prismLoadScheduler.runFrame();
      frames.push(clock.t - t0);
    }
    return frames;
  }

  it('a whole column at Sol (and a real star\'s twin search): no frame runs past the deadline by more than one unit', () => {
    const clock = slowClock();
    const real = [{ x: 8.0011, y: 0.0302, z: 0.0012, name: 'Slow Star', spect: 'G' }];
    const nav = loaderNav({ ...SOL, realStars: real });
    prismLoadScheduler.configure({ requestFrame: null, now: () => (clock.t += 0.001) });
    nav._ensureStarsLoaded(SOL.x, SOL.y, SOL.z, 0);
    const frames = runAll(clock);
    expect(nav.slabLoad.state, 'the column never finished').toBe('ready');
    expect(frames.length, 'the load fitted in a few frames — the slow clock bit nothing').toBeGreaterThan(500);
    const worst = Math.max(...frames);
    expect(worst, `a frame took ${worst.toFixed(2)} fake ms (budget ${FRAME_BUDGET_MS})`).toBeLessThanOrEqual(FRAME_BUDGET_MS + Math.max(UNIT, REGION_COST));
    expect(nav._localStars.some((r) => r.name === 'Slow Star')).toBe(true);
  }, 120000);

  it('two instances loading at once share ONE budget: a frame is still ≤ budget + one unit, not two budgets', () => {
    const clock = slowClock();
    const a = loaderNav(SOL);
    prismLoadScheduler.configure({ requestFrame: null, now: () => (clock.t += 0.001) });
    a._ensureStarsLoaded(SOL.x, SOL.y, SOL.z, 0);
    // the second instance: a different column, its own nav (the cockpit's), same scheduler
    const b = Object.create(Object.getPrototypeOf(a));
    b._localStars = []; b._gm = a._gm; b._playerX = 8; b._playerY = 0; b._playerZ = 0; b._realStarCatalog = null; b._levelIndex = 3;
    const col = navGrid.enterColumn(navGrid.parentAt(3, 8.02, 0.01));
    b._prismColumn = col; b._localCenter = { x: col.center.x, y: 0.5, z: col.center.z };
    b._ensureStarsLoaded(col.center.x, 0.5, col.center.z, 0);
    expect(prismLoadScheduler.loaders.size, 'the two instances are not on ONE scheduler').toBe(2);
    expect(loaderFor(a).scheduler).toBe(prismLoadScheduler);
    expect(loaderFor(b).scheduler).toBe(prismLoadScheduler);
    const frames = [];
    for (let i = 0; i < 400; i++) { const t0 = clock.t; prismLoadScheduler.runFrame(); frames.push(clock.t - t0); }
    expect(Math.max(...frames)).toBeLessThanOrEqual(FRAME_BUDGET_MS + Math.max(UNIT, REGION_COST));
    expect(a._localStars.length, 'instance A never got a turn').toBeGreaterThan(0);
    expect(b._localStars.length, 'instance B never got a turn').toBeGreaterThan(0);
  }, 120000);
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('cancellation and resumption', () => {
  function partial(nav, frames) { nav._ensureStarsLoaded(nav._localCenter.x, nav._localCenter.y, nav._localCenter.z, 0); for (let i = 0; i < frames; i++) prismLoadScheduler.runFrame(); }

  it('leaving PRISM mid-load drops the work in flight; nothing loads afterwards; re-entry gives the uninterrupted rows', () => {
    const ref = fingerprint(loadAll(loaderNav(SOL)));
    const nav = loaderNav(SOL);
    partial(nav, 3);
    const L = loaderFor(nav);
    expect(L.jobs.size + L.slabs.size, 'nothing was in flight — the case is vacuous').toBeGreaterThan(0);
    // what NavComputer does on leaving PRISM (:4480) and navDrill on a column change
    const gen = L.gen;
    nav._localStars = []; nav._resetPrismLoad(); nav._levelIndex = 2;
    expect(L.gen).toBe(gen + 1);
    expect(L.jobs.size + L.slabs.size + L.pendingTwins.size).toBe(0);
    expect(prismLoadScheduler.hasWork()).toBe(false);
    expect(prismLoadScheduler.drain()).toBe(0);
    expect(nav._localStars).toEqual([]);
    nav._levelIndex = 3;
    expect(fingerprint(loadAll(nav))).toEqual(ref);
  }, 60000);

  it('switching column mid-load never publishes a row of the old column', () => {
    const nav = loaderNav(SOL);
    partial(nav, 4);
    const next = navGrid.enterColumn(navGrid.parentAt(3, 8.0081, 0.0001));
    expect(navGrid.sameAddress(next.address, nav._prismColumn.address)).toBe(false);
    nav._prismColumn = next;    // what navDrill.setColumn does (it also clears + resets; this proves the loader alone is safe)
    nav._ensureStarsLoaded(next.center.x, nav._localCenter.y, next.center.z, 0);
    let guard = 0;
    while (prismLoadScheduler.hasWork() && guard++ < 20000) {
      prismLoadScheduler.runFrame();
      for (const r of nav._localStars) expect(navGrid.inFootprint(next.bounds, r.wx, r.wz), `${r.key} is from the old column`).toBe(true);
    }
    expect(nav._localStars.length).toBeGreaterThan(0);
  }, 60000);

  it('a jump mid-slab loads the new slab FIRST, keeps the half-done one, and the column ends identical', () => {
    const ref = fingerprint(loadAll(loaderNav(SOL)));
    const nav = loaderNav(SOL);
    partial(nav, 1);
    const L = loaderFor(nav);
    const half = L.jobs.get(0);
    expect(half && !L.slabs.has(0), 'N1 was not half-done — the case is vacuous').toBeTruthy();
    const visited = half.query.cellsVisited;
    nav.jumpToSlab('N20');
    let firstPublished = null, guard = 0;
    while (firstPublished === null && guard++ < 1000) { prismLoadScheduler.runFrame(); if (nav.slabLoad.loadedSlabs.size) firstPublished = [...nav.slabLoad.loadedSlabs]; }
    expect(firstPublished).toEqual(['N20']);
    expect(L.jobs.get(0), 'the half-done N1 was thrown away').toBe(half);
    expect(half.query.cellsVisited, 'N1 restarted instead of resuming').toBeGreaterThanOrEqual(visited);
    prismLoadScheduler.drain();
    expect(fingerprint(nav._localStars)).toEqual(ref);
  }, 60000);

  it('the loader works only at PRISM: at another level it holds its place and resumes on return', () => {
    const nav = loaderNav(SOL);
    partial(nav, 2);
    nav._levelIndex = 4;
    expect(prismLoadScheduler.hasWork()).toBe(false);
    nav._levelIndex = 3;
    expect(prismLoadScheduler.hasWork()).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('suspension (the cockpit instance while its glass is not drawn — PHASE0 §5)', () => {
  it('a suspended instance does no work and reports it; resumed, it continues from where it stopped', () => {
    const ref = fingerprint(loadAll(loaderNav(SOL)));
    const nav = loaderNav(SOL);
    nav._ensureStarsLoaded(SOL.x, SOL.y, SOL.z, 0);
    prismLoadScheduler.runFrame();
    const L = loaderFor(nav);
    const job = L.jobs.get(0);
    const visited = job?.query.cellsVisited ?? -1;
    nav.setLoadSuspended(true);
    expect(nav.slabLoad.suspended).toBe(true);
    expect(prismLoadScheduler.hasWork()).toBe(false);
    for (let i = 0; i < 50; i++) prismLoadScheduler.runFrame();
    if (job) expect(job.query.cellsVisited, 'a suspended instance kept loading').toBe(visited);
    nav.setLoadSuspended(false);
    expect(nav.slabLoad.suspended).toBe(false);
    prismLoadScheduler.drain();
    expect(fingerprint(nav._localStars)).toEqual(ref);
  }, 60000);

  it('main.js suspends the cockpit\'s instance every frame unless the glass is drawn (live code, not a comment)', () => {
    const src = stripCommentsPreservingOffsets(readFileSync(resolve(REPO, 'src/main.js'), 'utf8'));
    const start = src.indexOf('function renderFrame(');
    expect(start).toBeGreaterThan(0);
    const body = src.slice(start, src.indexOf('\nfunction ', start + 10));
    expect(body).toMatch(/_cockpitNavComputer\?\.setLoadSuspended\?\.\(\s*!_cockpitShouldRender\(\)\s*\)/);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('AC-8 — which procedural star a real star replaces does not depend on load order', () => {
  // Real procedural stars from the hash grid; synthetic real stars placed beside a column face and a
  // slab face so their twin is in the NEIGHBOURING column / slab.
  const gm0 = new GalacticMap('well-dipper-galaxy-1');
  const near = (p, q) => Math.hypot(p.worldX - q.x, p.worldY - q.y, p.worldZ - q.z);
  /** The oracle: nearest procedural within 2 pc, by brute force over a generous box. */
  function oracleTwin(r) {
    const q = HashGridStarfield.prismQuery(gm0, r, 0.004, 0.004, { extent: true }); q.step(null);
    let best = null;
    for (const s of q.results) { const d = near(s, r); if (d < 0.002 && (!best || d < near(best, r) || (d === near(best, r) && s.key < best.key))) best = s; }
    return best;
  }

  const colB = navGrid.enterColumn(navGrid.parentAt(3, SOL.x, SOL.z));
  // Built lazily (not at collection), so a broken slab rule fails a TEST instead of the whole file.
  let FX = null;
  function fixture() {
    if (FX) return FX;
    const qN1 = HashGridStarfield.prismQuery(gm0, { x: colB.center.x, y: 0.05, z: colB.center.z }, 0.00390625, 0.05, { extent: true }); qN1.step(null);
    const qN2 = HashGridStarfield.prismQuery(gm0, { x: colB.center.x, y: 0.15, z: colB.center.z }, 0.00390625, 0.05, { extent: true }); qN2.step(null);
    const owned = (s, k) => navGrid.inFootprint(colB.bounds, s.worldX, s.worldZ) && slabIndexOfY(s.worldY) === k;

    // (1) a star of column B near one of its four side faces; a real star mirrored 0.02 pc across it
    //     (so it lives in the NEIGHBOURING column) whose oracle twin is that star
    const b = colB.bounds, EPS = 0.00002;
    const across = (s) => [
      [s.worldX - b.min.x, { x: b.min.x - EPS, y: s.worldY, z: s.worldZ }],
      [b.max.x - s.worldX, { x: b.max.x + EPS, y: s.worldY, z: s.worldZ }],
      [s.worldZ - b.min.z, { x: s.worldX, y: s.worldY, z: b.min.z - EPS }],
      [b.max.z - s.worldZ, { x: s.worldX, y: s.worldY, z: b.max.z + EPS }],
    ].sort((p, q) => p[0] - q[0])[0];
    let P1 = null, R1 = null;
    for (const s of qN1.results.filter((t) => owned(t, 0)).sort((p, q) => across(p)[0] - across(q)[0])) {
      const [gap, pos] = across(s);
      if (gap > 0.0015) break;
      const r = { ...pos, name: 'Edge Column', spect: 'K' };
      if (oracleTwin(r)?.key === s.key) { P1 = s; R1 = r; break; }
    }
    // (2) a star of slab N2 nearest its lower face (y = 0.1); a real star just below it, in N1
    const P2 = qN2.results.filter((s) => owned(s, 1)).sort((a, b) => a.worldY - b.worldY)[0];
    const R2 = { x: P2.worldX, y: 0.1 - 0.00002, z: P2.worldZ, name: 'Edge Slab', spect: '' };
    // (3) two real stars competing for one twin
    const P3 = qN1.results.filter((s) => owned(s, 0) && s !== P1)[5];
    const R3a = { x: P3.worldX + 0.00003, y: P3.worldY, z: P3.worldZ, name: 'Rival A', spect: 'M' };
    const R3b = { x: P3.worldX - 0.00003, y: P3.worldY, z: P3.worldZ, name: 'Rival B', spect: 'M' };
    const REAL = [R1, R2, R3a, R3b];
    FX = { P1, R1, P2, R2, P3, R3a, R3b, REAL };
    return FX;
  }

  it('the fixture is real: each real star\'s oracle twin is the intended star, across the edge', () => {
    const { P1, R1, P2, R2, P3, R3a, R3b } = fixture();
    expect(P1, 'no star near a column face has its mirror as its nearest neighbour').toBeTruthy();
    expect(oracleTwin(R1)?.key).toBe(P1.key);
    expect(navGrid.inFootprint(colB.bounds, R1.x, R1.z), 'R1 must be in the NEIGHBOURING column').toBe(false);
    expect(P2.worldY - 0.1, 'no star near the slab face').toBeLessThan(0.001);
    expect(oracleTwin(R2)?.key).toBe(P2.key);
    expect(slabIndexOfY(R2.y), 'R2 must be in the slab below').toBe(0);
    expect(oracleTwin(R3a)?.key).toBe(P3.key);
    expect(oracleTwin(R3b)?.key).toBe(P3.key);
  }, 60000);

  /** Load column B with the camera starting in `startRef`, cold twin cache unless `nav` is given. */
  function loadB(startRef, nav = null) {
    const n = nav || loaderNav({ ...SOL, realStars: fixture().REAL });
    if (nav) { n._prismColumn = colB; n._localCenter = { x: colB.center.x, y: 0, z: colB.center.z }; }
    n.jumpToSlab(startRef);
    loadAll(n);
    return n;
  }

  it('three load orders (and a neighbour column loaded first) give identical rows; every twin is hidden', () => {
    const { P1, R1, P2, R2, P3, R3a, R3b, REAL } = fixture();
    const orders = ['N1', 'N30', 'S30', 'N2'].map((ref) => loadB(ref));
    // the fourth: column A (where R1 lives) loads FIRST on the same nav, so R1's twin is decided there
    const a = loaderNav({ x: R1.x, y: R1.y, z: R1.z, realStars: REAL });
    loadAll(a);
    expect(a._localStars.some((r) => r.name === 'Edge Column'), 'R1 is not a row of its own column').toBe(true);
    orders.push(loadB('N1', a));
    const fp = orders.map((n) => fingerprint(n._localStars));
    for (let i = 1; i < fp.length; i++) expect(fp[i], `load order ${i} differs from order 0`).toEqual(fp[0]);
    const keys = new Set(orders[0]._localStars.map((r) => r.key));
    expect(keys.has(P1.key), 'the column-edge twin was not hidden').toBe(false);
    expect(keys.has(P2.key), 'the slab-edge twin was not hidden').toBe(false);
    expect(keys.has(P3.key), 'the contested twin was not hidden').toBe(false);
    expect(keys.has(realStarKey(R2)) && keys.has(realStarKey(R3a)) && keys.has(realStarKey(R3b))).toBe(true);
    expect(keys.has(realStarKey(R1)), 'R1 belongs to the neighbouring column, not this one').toBe(false);
    // R2 had no catalogue class: it takes its twin's, as the old merge did
    expect(orders[0]._localStars.find((r) => r.name === 'Edge Slab').spectral).toBe(P2.type);
  }, 120000);

  it('the hidden set does not depend on catalogue order or on a warm twin cache', () => {
    const { REAL } = fixture();
    const n1 = loaderNav({ ...SOL, realStars: REAL.slice().reverse() });
    n1.jumpToSlab('N1'); loadAll(n1);
    const gm = n1._gm;
    const n2 = loaderNav({ ...SOL, realStars: REAL });
    n2._gm = gm;                     // the twin cache from n1 is warm for this map
    n2.jumpToSlab('S5'); loadAll(n2);
    expect(fingerprint(n2._localStars)).toEqual(fingerprint(n1._localStars));
    clearTwinCache(gm);
  }, 120000);
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('sorted views, built in slices (all six PRISM sort modes)', () => {
  it('each mode: not ready at once, built over SEVERAL frames, and equal to a plain stable sort', () => {
    const nav = loaderNav({ x: 1.5, y: 0.02, z: 0.2 });      // the inner galaxy: ~85k rows in the column
    loadAll(nav);
    const rows = nav._localStars;
    expect(rows.length, 'too few rows for the case to mean anything').toBeGreaterThan(50000);
    for (const k of SORT_KEYS[3]) {
      const first = nav.sortedRows(k.id, k.cmp);
      expect(first.ready, `${k.id} was ready without any work`).toBe(false);
      let frames = 0, out = first;
      while (!out.ready && frames++ < 5000) { prismLoadScheduler.runFrame(); out = nav.sortedRows(k.id, k.cmp); }
      expect(out.ready).toBe(true);
      expect(frames, `${k.id}: ${rows.length} rows sorted in ${frames} frame(s) — not sliced`).toBeGreaterThan(1);
      expect(out.rows.map((r) => r.key), `${k.id} order differs from a plain sort`).toEqual(rows.slice().sort(k.cmp).map((r) => r.key));
    }
  }, 120000);

  it('rows published while a sort is active are MERGED in: the final order equals a full sort', () => {
    const nav = loaderNav({ x: 1.5, y: 0.02, z: 0.2 });
    const name = SORT_KEYS[3].find((k) => k.id === 'name');
    const merge = vi.spyOn(SliceSort, 'merge');
    nav._ensureStarsLoaded(nav._localCenter.x, 0.02, nav._localCenter.z, 0);
    let out = nav.sortedRows(name.id, name.cmp), g = 0;
    while ((prismLoadScheduler.hasWork() || !out.ready) && g++ < 20000) { prismLoadScheduler.runFrame(); out = nav.sortedRows(name.id, name.cmp); }
    expect(nav.slabLoad.state).toBe('ready');
    expect(out.ready).toBe(true);
    expect(out.rev).toBe(nav._rowsRev);
    expect(merge, 'no publish was merged incrementally').toHaveBeenCalled();
    expect(out.rows.map((r) => r.key)).toEqual(nav._localStars.slice().sort(name.cmp).map((r) => r.key));
  }, 120000);
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('rows: one column, one slab each, the generator\'s identity, and multiplicity filled', () => {
  it('every row is owned by the column and its slab (half-open), keys are unique, and mult is a number ≥ 1', () => {
    const nav = loaderNav({ ...SOL, realStars: [] });
    nav._realStarCatalog = catalogue([]);
    loadAll(nav);
    const rows = nav._localStars;
    expect(rows.length).toBeGreaterThan(1000);
    expect(new Set(rows.map((r) => r.key)).size).toBe(rows.length);
    for (const r of rows) {
      expect(navGrid.inFootprint(nav._prismColumn.bounds, r.wx, r.wz)).toBe(true);
      expect(r.slab).toBe(slabRef(addressOf(r.wx, r.wy, r.wz)));
      expect(Number.isFinite(r.mult) && r.mult >= 1).toBe(true);
      expect(typeof r.name === 'string' && r.name.length > 0).toBe(true);
    }
    expect(rows.some((r) => r.mult > 1), 'no multiple system in a whole column').toBe(true);
    expect(nav.slabLoad.loadedSlabs.size).toBe(60);
    expect(nav._loadedYMin).toBe(slabYRange(K_MIN)[0]);
    expect(nav._loadedYMax).toBe(slabYRange(K_MAX)[1]);
  }, 60000);

  it('a star exactly on the column\'s or the slab\'s UPPER face is the neighbour\'s; one on a LOWER face is ours', () => {
    const col = navGrid.enterColumn(navGrid.parentAt(3, SOL.x, SOL.z)), b = col.bounds;
    const [y0, y1] = slabYRange(0);
    const mid = { x: col.center.x, y: 0.05, z: col.center.z };
    const fx = [
      ['upper x', proc(b.max.x, mid.y, mid.z, { tier: 'M', cx: 1, cy: 1, cz: 1 }), false],
      ['upper z', proc(mid.x, mid.y, b.max.z, { tier: 'M', cx: 2, cy: 2, cz: 2 }), false],
      ['upper y', proc(mid.x, y1, mid.z, { tier: 'M', cx: 3, cy: 3, cz: 3 }), 'N2'],
      ['lower x', proc(b.min.x, mid.y, mid.z, { tier: 'M', cx: 4, cy: 4, cz: 4 }), 'N1'],
      ['lower y', proc(mid.x, y0, mid.z, { tier: 'M', cx: 5, cy: 5, cz: 5 }), 'N1'],
    ];
    stubGrid(fx.map((f) => f[1]));
    const nav = loaderNav({ ...SOL, realStars: [] });
    loadAll(nav);
    for (const [what, st, slab] of fx) {
      const rows = nav._localStars.filter((r) => r.key === st.key);
      if (slab === false) expect(rows, `${what}: a star on the upper face loaded in this column`).toHaveLength(0);
      else { expect(rows, `${what}: loaded ${rows.length} times`).toHaveLength(1); expect(rows[0].slab).toBe(slab); }
    }
  });
});
