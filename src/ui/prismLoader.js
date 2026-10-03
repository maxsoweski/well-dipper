/**
 * prismLoader.js — PRISM's slab loader (naming-prism-segments Phase 3, AC-6 and AC-8; plan §8).
 *
 * Max (2026-10-02): "The update build for the prism nav view needs to include performance
 * optimization" — and on a loading screen: "let's try to make the system work without this".
 * So there is no loading screen: the view stays live while the column fills in.
 *
 * WHAT IT DOES
 *   PRISM is one fixed 7.8125 pc column (navGrid.enterColumn). This loads it ONE 100 pc SLAB at a
 *   time (GalaxyGrid slabs, half-open: N1 = [0, 0.1) kpc, S1 = [-0.1, 0)): the slab the camera is
 *   in first, then its neighbours outward, until S30…N30 (±3 kpc) are all in.
 *
 *   Every unit of work runs under ONE time deadline per frame (default 8 ms), SHARED by every nav
 *   instance (the DOM overlay and the cockpit's glass): feature-region prefetch (one region per
 *   unit), the catalogue scan, the cell scan (resumable mid-tier, `HashGridStarfield.prismQuery`),
 *   each real star's twin search, naming + multiplicity (a few rows per unit), the row publish,
 *   and the optional sorted views (`sortedRows`). Most units are well under a millisecond (32 cells, 8
 *   rows, 256 sort steps); the one indivisible big unit is a COLD feature region (measured ≤ ~6 ms node),
 *   and that is only started with `REGION_RESERVE_MS` of the frame left. Every region a slab's units
 *   read is built first and HELD for the job (`withFeaturePins`), so eviction while paused can never
 *   turn a later unit into an inline rebuild. (Phase 3 fixup — this note used to claim every unit was
 *   ≤ 0.3 ms, which a cold region is not; Astra review finding 2.)
 *
 *   Work is resumable (each slab keeps its cursor while another slab or a sort runs) and
 *   cancellable: leaving PRISM, switching column or a reset bumps a generation and drops every
 *   partial job; a jump just re-prioritises, it never blocks.
 *
 * AC-8 — WHICH PROCEDURAL STAR A REAL STAR REPLACES IS DECIDED BY IDENTITY, NOT LOAD ORDER
 *   twin(R) = the nearest procedural star within 2 pc of real star R, over a full 3D
 *   neighbourhood generated straight from the hash grid (across column and slab edges, whatever is
 *   loaded), ties broken by star key. A procedural star is hidden iff it is some real star's twin.
 *   Each R decides alone, so the hidden set — and therefore every slab's rows — is the same for any
 *   load order. Twins are cached per galactic map by the real star's key, and dropped when the
 *   generator's inputs change (`generatorInputs`: the real-feature catalogue arriving late).
 *
 * THE SEAM (NavComputer exposes these; see the delegates at NavComputer.js `_ensureStarsLoaded`)
 *   nav.slab            → { hemi, n } the slab the camera is in
 *   nav.jumpToSlab(ref) → moves the camera height to that slab's centre and starts loading it
 *   nav.slabLoad        → { state:'idle'|'loading'|'ready', loadedSlabs:Set<ref>, progress:0..1,
 *                           emptySlabs:Set<ref>, viewSlab:ref, viewReady, suspended, rev }
 *   nav._rowsRev        → bumps only when `_localStars` (the published rows) is replaced
 *   nav.sortedRows(id, cmp) → { rows|null, rev, ready } — the published rows sorted by `cmp`,
 *                           built in slices (incremental merge when only slabs were added)
 *   nav.setLoadSuspended(bool) → main.js suspends the cockpit's loading while the glass is not drawn
 *
 * Deliberate non-goals: no unloading inside a column (a column is ≤ ~60k rows); no Web Worker; no
 * drawing (the designs read `slabLoad`).
 */
import { HashGridStarfield } from '../generation/HashGridStarfield.js';
import { addressOf, boundsOf, slabRef, realStarKey, SLAB_KPC } from '../generation/GalaxyGrid.js';
import { generateSystemName } from '../generation/NameGenerator.js';
import { multiplicityForSeed } from '../generation/multiplicityOracle.js';
import { realStarSeed } from '../generation/realStarSeed.js';
import * as navGrid from './navGrid.js';
import * as navDrill from './navDrill.js';
import alea from 'alea';

/** The per-frame budget shared by every nav instance (plan §8: "≈ 8 ms per frame"). */
export const FRAME_BUDGET_MS = 8;
/** A real star replaces a procedural star closer than this (2 pc, today's MATCH_DIST). */
export const MATCH_KPC = 0.002;
/** The column the loader fills: ±3 kpc = S30 … N30, matching the segment bar. */
export const SLAB_SPAN = Math.round(3.0 / SLAB_KPC);           // 30
export const K_MIN = -SLAB_SPAN, K_MAX = SLAB_SPAN - 1;          // S30 … N30
/** A cold feature region is only started with at least this much of the frame left (measured ≤ ~6 ms node). */
export const REGION_RESERVE_MS = 6;
/** Background slabs publish at most this often; the viewed slab publishes at once. */
export const PUBLISH_INTERVAL_MS = 100;

// ── slab arithmetic (all through GalaxyGrid, so every caller agrees on an edge) ──────────────────

/** Slab index k of a height: N(k+1) for k ≥ 0, S(−k) for k < 0. y = 0 is N1 (k = 0). */
export function slabIndexOfY(y) {
  const s = addressOf(0, y, 0).slab;
  return s.hemi === 'N' ? s.n - 1 : -s.n;
}
/** k → { hemi, n }. */
export function slabOfIndex(k) { return k >= 0 ? { hemi: 'N', n: k + 1 } : { hemi: 'S', n: -k }; }
/** { hemi, n } → k. */
export function indexOfSlab(s) { return s.hemi === 'N' ? s.n - 1 : -s.n; }
/** k → 'N16' / 'S3'. */
export function refOfIndex(k) { return slabRef(slabOfIndex(k)); }
/** 'N16' | 'n16' | { hemi, n } → { hemi, n } (null when malformed). */
export function parseSlab(ref) {
  if (ref && typeof ref === 'object') {
    return (ref.hemi === 'N' || ref.hemi === 'S') && Number.isInteger(ref.n) && ref.n >= 1 ? { hemi: ref.hemi, n: ref.n } : null;
  }
  const m = /^\s*([NnSs])\s*(\d+)\s*$/.exec(String(ref ?? ''));
  if (!m) return null;
  const n = Number(m[2]);
  return n >= 1 ? { hemi: m[1].toUpperCase(), n } : null;
}
/** k → [yMin, yMax) in kpc, the exact doubles GalaxyGrid.boundsOf uses. */
export function slabYRange(k) {
  const b = boundsOf({ sector: { i: 0, j: 0 }, slab: slabOfIndex(k) });
  return [b.min.y, b.max.y];
}

// The nav's rng, for naming when a bare test instance has no `_makeRng` (identical to NavComputer's).
function makeRng(seed) {
  const fn = alea(seed);
  return {
    float: () => fn(),
    int: (minOrMax, max) => (max === undefined ? Math.floor(fn() * minOrMax) : minOrMax + Math.floor(fn() * (max - minOrMax + 1))),
    pick: (arr) => arr[Math.floor(fn() * arr.length)],
    bool: (p) => fn() < (p || 0.5), chance: (p) => fn() < p,
    child: (label) => makeRng(seed + ':' + label),
  };
}

const defaultNow = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());
const defaultFrame = (cb) => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame(cb) : setTimeout(cb, 16));

// ── the shared scheduler ─────────────────────────────────────────────────────────────────────────

/**
 * ONE deadline per frame for every loader (PHASE0 §7.4: per-instance 8 ms slices would be 16 ms a
 * frame with both navs open). Each frame: deadline = now + budget; loaders take turns (the start
 * rotates each frame) until the deadline or until nobody has work.
 */
export class LoadScheduler {
  constructor() {
    this.budgetMs = FRAME_BUDGET_MS;
    this.now = defaultNow;
    this.requestFrame = defaultFrame;
    this.loaders = new Set();
    this._scheduled = false;
    this._rr = 0;
    this.stats = { frames: 0, lastFrameMs: 0, maxFrameMs: 0 };
    // ⚠ HEADLESS HARNESS ONLY (tests/helpers/headlessNav.mjs): when true, `ensure()` finishes the
    // viewed slab synchronously — the UI suites assert on rows right after one render(), which the
    // old loader's synchronous first query gave them. Production never sets it.
    this.syncView = false;
  }

  /** Tests: inject a clock / frame source. `requestFrame: null` = manual frames (`runFrame`). */
  configure({ budgetMs, now, requestFrame } = {}) {
    if (budgetMs !== undefined) this.budgetMs = budgetMs;
    if (now !== undefined) this.now = now || defaultNow;
    if (requestFrame !== undefined) this.requestFrame = requestFrame;
    this._scheduled = false;
    return this;
  }

  /** Back to the browser defaults (tests' afterEach). */
  reset() {
    this.budgetMs = FRAME_BUDGET_MS; this.now = defaultNow; this.requestFrame = defaultFrame;
    this.loaders.clear(); this._scheduled = false; this._rr = 0; this.syncView = false;
    this.stats = { frames: 0, lastFrameMs: 0, maxFrameMs: 0 };
  }

  add(loader) { this.loaders.add(loader); }
  remove(loader) { this.loaders.delete(loader); }
  hasWork() { for (const l of this.loaders) if (l.hasWork()) return true; return false; }

  /** Ask for a frame if anybody has work and none is pending. */
  wake() {
    if (this._scheduled || !this.requestFrame || !this.hasWork()) return;
    this._scheduled = true;
    this.requestFrame(() => { this._scheduled = false; this.runFrame(); });
  }

  /** One frame of work under one deadline. Returns the frame's elapsed time on `now`. */
  runFrame() {
    const t0 = this.now();
    const deadline = t0 + this.budgetMs;
    let yielded = false;
    const stop = () => yielded || this.now() >= deadline;
    // A unit that cannot be split (a cold feature region, up to ~6 ms node) asks how much is left and, when
    // it would not fit, ends the frame instead of overrunning it (`REGION_RESERVE_MS`).
    stop.remaining = () => deadline - this.now();
    stop.yieldFrame = () => { yielded = true; };
    const list = [...this.loaders];
    if (list.length > 1) { const r = this._rr++ % list.length; list.push(...list.splice(0, r)); }
    let any = true;
    while (any && !stop()) {
      any = false;
      for (const l of list) {
        if (stop()) break;
        if (l.hasWork()) { any = true; l.work(stop); }
      }
    }
    const ms = this.now() - t0;
    this.stats.frames++; this.stats.lastFrameMs = ms; if (ms > this.stats.maxFrameMs) this.stats.maxFrameMs = ms;
    this.wake();
    return ms;
  }

  /** Tests / tools: run frames until nobody has work (or `maxFrames`). Returns frames run. */
  drain(maxFrames = 100000) {
    let n = 0;
    while (n < maxFrames && this.hasWork()) { this.runFrame(); n++; }
    return n;
  }
}

/** The one scheduler every NavComputer shares. */
export const prismLoadScheduler = new LoadScheduler();

// ── twins (AC-8), cached per galactic map by real-star key ───────────────────────────────────────

const twinCaches = new WeakMap();
/**
 * ⭐ THE GENERATOR'S INPUTS, AS ONE VALUE (Phase 3 fixup, Astra finding 4). Which procedural stars exist
 * depends on the galactic map AND on the real-feature catalogue (`HashGridStarfield.realFeatureCatalog`,
 * installed asynchronously by main.js — its globular clusters add Plummer density). A twin, or a slab's
 * rows, worked out before that catalogue arrived describe a different population, so both the twin
 * cache and a loader's column are keyed by this and dropped when it changes.
 */
export function generatorInputs() {
  const f = HashGridStarfield.realFeatureCatalog;
  return f && f.loaded ? f : null;
}
function twinCacheFor(gm) {
  const inputs = generatorInputs();
  let c = twinCaches.get(gm);
  if (!c || c.inputs !== inputs) { c = { inputs, map: new Map() }; twinCaches.set(gm, c); }
  return c.map;
}
/** Tests: forget every cached twin for a map (so a test can prove order independence from cold). */
export function clearTwinCache(gm) { twinCaches.delete(gm); }

/**
 * Prefetch the feature regions a query will read, one region per unit, and HOLD them (`job.pins`):
 * every later unit of the job runs under `GalacticMap.withFeaturePins(job.pins)`, so a region the shared
 * 64-entry LRU evicts while the job is paused (the other nav instance, the game's own lookups) is handed
 * back, never rebuilt inline (Phase 3 fixup, Astra finding 2: 12 regions rebuilt in one ~34 ms node unit).
 * A cached region is a touch; a missing one is one build (≤ ~16 ms node cold, measured). True when done.
 */
function prefetchRegions(gm, job, stop) {
  if (!job.regions) { job.regions = job.regionList ? job.regionList() : job.query.featureRegions(); job.pi = 0; job.pins = new Map(); }
  while (job.pi < job.regions.length) {
    if (stop()) return false;
    const r = job.regions[job.pi];
    if (typeof stop.remaining === 'function' && stop.remaining() < REGION_RESERVE_MS
        && typeof gm.hasFeatureRegion === 'function' && !gm.hasFeatureRegion(r[0], r[1], r[2])) {
      stop.yieldFrame?.();                                   // a cold build would overrun: next frame, first
      return false;
    }
    job.pi++;
    const features = gm.prefetchFeatureRegion?.(r[0], r[1], r[2]);
    if (features && typeof gm.featureRegionKey === 'function') job.pins.set(gm.featureRegionKey(r[0], r[1], r[2]), features);
  }
  return true;
}
/** Run one unit of `job` with its held feature regions standing in for evicted ones. */
function pinned(gm, job, fn) {
  return job.pins && typeof gm.withFeaturePins === 'function' ? gm.withFeaturePins(job.pins, fn) : fn();
}

/**
 * The nearest procedural star within MATCH_KPC of a real star, over the full 3D neighbourhood
 * (extent-tested cells, every tier), ties by key — or null. Resumable: returns undefined until done.
 */
function twinOf(gm, rs, stop, pending) {
  const cache = twinCacheFor(gm);
  const rk = realStarKey(rs);
  if (cache.has(rk)) return cache.get(rk);
  let job = pending.get(rk);
  if (!job) {
    job = { query: HashGridStarfield.prismQuery(gm, { x: rs.x, y: rs.y, z: rs.z }, MATCH_KPC, MATCH_KPC, { extent: true }), regions: null };
    pending.set(rk, job);
  }
  if (!prefetchRegions(gm, job, stop)) return undefined;
  if (!pinned(gm, job, () => job.query.step(stop))) return undefined;
  let best = null, bestD = MATCH_KPC;
  for (const s of job.query.results) {
    const dx = s.worldX - rs.x, dy = s.worldY - rs.y, dz = s.worldZ - rs.z;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (d < bestD || (best && d === bestD && s.key < best.key)) { bestD = d; best = s; }
  }
  const twin = best ? { key: best.key, spectral: best.type } : null;
  cache.set(rk, twin);
  pending.delete(rk);
  return twin;
}

// ── a resumable, stable merge sort (for the sorted views) ────────────────────────────────────────

/**
 * Bottom-up merge sort that stops when `stop()` says so and resumes where it was. Stable. Also used
 * to merge one already-sorted array with another (`SliceSort.merge`).
 */
export class SliceSort {
  constructor(items, cmp) {
    this.cmp = cmp; this.a = items; this.b = new Array(items.length);
    this.n = items.length; this.width = 1; this.lo = 0; this.inMerge = false;
    this.i = 0; this.j = 0; this.k = 0; this.mid = 0; this.hi = 0;
    this.mergeMid = -1;                                    // ≥ 0: a single merge of a[0, mid) with a[mid, n)
    this.result = this.n <= 1 ? this.a : null;
  }

  /** Merge two already-sorted arrays (left wins ties — stable). */
  static merge(left, right, cmp) {
    const s = new SliceSort(left.concat(right), cmp);
    if (!left.length || !right.length) s.result = s.a;
    else s.mergeMid = left.length;
    return s;
  }

  step(stop) {
    if (this.result) return true;
    const cmp = this.cmp, n = this.n, single = this.mergeMid >= 0;
    let a = this.a, b = this.b, ops = 0;
    while (single || this.width < n) {
      if (!this.inMerge) {
        if (single) { this.lo = 0; this.mid = this.mergeMid; this.hi = n; }
        else { this.mid = Math.min(this.lo + this.width, n); this.hi = Math.min(this.lo + 2 * this.width, n); }
        this.i = this.lo; this.j = this.mid; this.k = this.lo; this.inMerge = true;
      }
      let i = this.i, j = this.j, k = this.k;
      const mid = this.mid, hi = this.hi;
      while (k < hi) {
        if ((++ops & 255) === 0 && stop()) { this.i = i; this.j = j; this.k = k; return false; }
        if (i < mid && (j >= hi || cmp(a[i], a[j]) <= 0)) b[k++] = a[i++];
        else b[k++] = a[j++];
      }
      this.inMerge = false;
      if (single) { this.result = b; return true; }
      this.lo += 2 * this.width;
      if (this.lo >= n) {
        this.a = b; this.b = a; a = this.a; b = this.b;
        this.width *= 2; this.lo = 0;
      }
    }
    this.result = this.a;
    return true;
  }
}

// ── the per-nav loader ───────────────────────────────────────────────────────────────────────────

const byDist = (a, b) => a.dist - b.dist;
const EDGE_PAD = 1e-9;   // kpc (1 µpc): see SlabJob

/** One slab of one column: prefetch → catalogue → cells → twins → rows. Resumable. */
class SlabJob {
  constructor(loader, k) {
    const col = loader.column;
    this.loader = loader; this.k = k; this.ref = refOfIndex(k);
    const [y0, y1] = slabYRange(k);
    this.y0 = y0; this.y1 = y1;
    this.center = { x: col.center.x, y: (y0 + y1) / 2, z: col.center.z };
    // ⚠ PADDED by EDGE_PAD: centre ± half does not reproduce the edge doubles (0.15 − 0.05 ≠ 0.1 in
    // binary), so an unpadded closed box can drop a star lying exactly on a face from BOTH slabs.
    // The half-open ownership test below decides who owns a face; the box only has to reach it.
    this.xzHalf = (col.bounds.max.x - col.bounds.min.x) / 2 + EDGE_PAD;
    this.yHalf = (y1 - y0) / 2 + EDGE_PAD;
    this.query = HashGridStarfield.prismQuery(loader.gm, this.center, this.xzHalf, this.yHalf, { extent: true });
    this.regions = null;
    // The regions to hold: the query's own (around the centre) AND every row's context lookup (around
    // each star's position), i.e. the whole box's — see GalacticMap.featureRegionsInBox.
    this.regionList = () => {
      const gm = loader.gm, q = this.query.featureRegions();
      if (typeof gm.featureRegionsInBox !== 'function') return q;
      const box = gm.featureRegionsInBox({ x: col.bounds.min.x, y: y0, z: col.bounds.min.z }, { x: col.bounds.max.x, y: y1, z: col.bounds.max.z });
      const seen = new Set(box.map((r) => r.join(',')));
      for (const r of q) if (!seen.has(r.join(','))) box.push(r);
      return box;
    };
    this.phase = 0;
    this.real = null; this.ti = 0; this.ri = 0; this.rows = []; this.suppressed = new Set(); this.seen = new Set();
  }

  /** @returns {boolean} true when the slab's rows are final */
  step(stop) {
    const gm = this.loader.gm;
    if (this.phase === 0) {                                   // feature regions, one per unit — and held
      if (!prefetchRegions(gm, this, stop)) return false;
      this.phase = 1;
    }
    return pinned(gm, this, () => this._step(stop));          // the query's gather and each row's context read them
  }

  _step(stop) {
    const L = this.loader, gm = L.gm;
    if (this.phase === 1) {                                   // the catalogue, once (≈ 0.1 ms scan)
      if (stop()) return false;
      this.real = L.realStarsNear(this);
      this.phase = 2;
    }
    if (this.phase === 2) {                                   // the cell scan, resumable mid-tier
      if (!this.query.step(stop)) return false;
      this.phase = 3;
    }
    if (this.phase === 3) {                                   // each nearby real star's twin (AC-8)
      while (this.ti < this.real.length) {
        if (stop()) return false;
        const twin = twinOf(gm, this.real[this.ti], stop, L.pendingTwins);
        if (twin === undefined) return false;
        if (twin) this.suppressed.add(twin.key);
        this.ti++;
      }
      this.phase = 4;
    }
    if (this.phase === 4) {                                   // own, name, multiplicity — a few rows per unit
      const res = this.query.results, col = L.column, k = this.k;
      let n = 0;
      while (this.ri < res.length) {
        if ((n++ & 7) === 0 && stop()) return false;
        const s = res[this.ri++];
        if (!navGrid.inFootprint(col.bounds, s.worldX, s.worldZ)) continue;     // half-open: one column owns a face
        if (s.worldY < this.y0 || s.worldY >= this.y1 || slabIndexOfY(s.worldY) !== k) continue;   // half-open: one slab
        if (this.suppressed.has(s.key) || this.seen.has(s.key)) continue;
        this.seen.add(s.key);
        this.rows.push(L.proceduralRow(s, this.ref));
      }
      this.phase = 5;
    }
    if (this.phase === 5) {                                   // the real stars this slab owns
      for (const rs of this.real) {
        if (!navGrid.inFootprint(L.column.bounds, rs.x, rs.z)) continue;
        if (rs.y < this.y0 || rs.y >= this.y1 || slabIndexOfY(rs.y) !== this.k) continue;
        const rk = realStarKey(rs);
        if (this.seen.has(rk)) continue;
        this.seen.add(rk);
        this.rows.push(L.realRow(rs, twinCacheFor(gm).get(rk), this.ref));
      }
      this.phase = 6;
    }
    if (this.phase === 6) {                                   // nearest the player first, as the old query's rows were
      if (!this.sorter) this.sorter = new SliceSort(this.rows, byDist);
      if (!this.sorter.step(stop)) return false;
      this.rows = this.sorter.result;
      this.phase = 7;
    }
    return true;
  }
}

export class PrismLoader {
  constructor(nav, scheduler = prismLoadScheduler) {
    this.nav = nav;
    this.scheduler = scheduler;
    this.gen = 0;
    this.colKey = null; this.column = null; this.viewK = 0; this.visLo = 0; this.visHi = 0;
    this.slabs = new Map();            // k → rows (final, published or pending)
    this.jobs = new Map();             // k → SlabJob (partial)
    this.pendingTwins = new Map();     // real key → partial twin search
    this.unpublished = [];             // ks loaded since the last publish
    this.publishedArr = null; this.lastPublishMs = -Infinity;
    this.log = [];                     // [{ rev, added }] since the last reset — for incremental sorts
    this.sorts = new Map(); this.activeSort = null;
    this.catLoaded = false;
    this._status = null;
    this.refreshStatus();
  }

  get gm() { return this.nav._gm; }

  /** Drop everything (leaving PRISM, a new column, a reset). Bumps the generation. */
  reset() {
    this.gen++;
    this.colKey = null; this.column = null;
    this.slabs.clear(); this.jobs.clear(); this.pendingTwins.clear();
    this.unpublished = []; this.publishedArr = null; this.lastPublishMs = -Infinity;
    this.log = []; this.sorts.clear(); this.activeSort = null;
    this.nav._loadedYMin = null; this.nav._loadedYMax = null;
    this.refreshStatus();
  }

  /**
   * Called every PRISM frame from NavComputer._ensureStarsLoaded: point the loader at the column on
   * the glass and the slab the camera is in. Cheap; never loads anything itself.
   */
  ensure(cy, yHalf = 0) {
    const nav = this.nav;
    const col = nav._prismColumn || navDrill.columnAt(nav._localCenter.x, nav._localCenter.z);
    if (!col) return;
    const key = navGrid.addressKey(col.address);
    const catLoaded = !!nav._realStarCatalog?.loaded;
    const inputs = generatorInputs();
    if (key !== this.colKey
        || (this.publishedArr && this.publishedArr.length && nav._localStars !== this.publishedArr
            && !(nav._localStars && nav._localStars.length))                 // someone CLEARED the rows without a reset
        || catLoaded !== this.catLoaded                                       // the catalogue arrived
        || inputs !== this.inputs) {                                          // the generator's inputs changed (Phase 3 fixup)
      this.reset();
      this.colKey = key; this.column = col; this.catLoaded = catLoaded; this.inputs = inputs;
      if (typeof nav._estimateBlockStarCount === 'function' && nav._gm) {
        nav._estimatedBlockStars = nav._estimateBlockStarCount(col.center, col.halfWidth ?? (col.bounds.max.x - col.bounds.min.x) / 2);
      }
      this.refreshStatus();
    }
    const y = Number.isFinite(cy) ? cy : 0, h = Number.isFinite(yHalf) && yHalf > 0 ? yHalf : 0;
    this.visLo = slabIndexOfY(y - h); this.visHi = slabIndexOfY(y + h);   // the slabs the camera's window touches
    this.setView(slabIndexOfY(y));
    this.scheduler.add(this);
    if (this.scheduler.syncView && this._active() && this._visibleMissing() !== null) this._loadViewNow();
    this.scheduler.wake();
  }

  /** Headless harness only (`scheduler.syncView`): finish the viewed slab inside this call. */
  _loadViewNow() {
    const never = () => false;
    for (let k = this._visibleMissing(); k !== null; k = this._visibleMissing()) this._workSlab(k, never);
    this.publish();
  }

  /** The viewed slab if missing, else another slab inside the camera's window that is missing, else null. */
  _visibleMissing() {
    if (!this.slabs.has(this.viewK)) return this.viewK;
    for (let k = this.visLo; k <= this.visHi; k++) if (!this.slabs.has(k)) return k;
    return null;
  }

  setView(k) {
    if (k === this.viewK) return;
    this.viewK = k;
    this.refreshStatus();
  }

  /** The next slab to work on: the viewed one, then neighbours outward inside S30…N30. */
  nextSlab() {
    if (this.colKey === null) return null;
    const v = this.viewK;
    const vis = this._visibleMissing();
    if (vis !== null) return vis;
    const reach = Math.max(Math.abs(v - K_MIN), Math.abs(v - K_MAX));
    for (let d = 1; d <= reach; d++) {
      const up = v + d, dn = v - d;
      if (up <= K_MAX && up >= K_MIN && !this.slabs.has(up)) return up;
      if (dn >= K_MIN && dn <= K_MAX && !this.slabs.has(dn)) return dn;
    }
    return null;
  }

  _active() { return this.colKey !== null && !this.nav._loadSuspended && this.nav._levelIndex === 3 && !!this.nav._gm && !this.held(); }
  /**
   * ⭐ THE SEGMENT BAR IS HELD (Phase 3 fixup, Astra finding 5; plan §7.3: "drag moves the highlight and
   * loads on release"). While a drag is on the bar the camera steps slab by slab but nothing loads,
   * publishes or re-sorts; the press is over the moment the host clears `_gaugeDrag` (mouse up, leaving
   * the canvas, V), and the next frame's `ensure` loads the slab the drag ended on, first.
   */
  held() { return !!(this.nav._gaugeDrag && this.nav._slabBarHeld); }
  _sortPending() { const s = this.activeSort && this.sorts.get(this.activeSort); return !!(s && s.job); }

  hasWork() {
    if (!this._active()) return false;
    return this.unpublished.length > 0 || this._sortPending() || this.nextSlab() !== null;
  }

  /** Work until `stop()`: viewed slab → sort → publish → background slabs. */
  work(stop) {
    const gen = this.gen;
    while (!stop() && gen === this.gen && this._active()) {
      const k = this.nextSlab();
      if (k !== null && k >= Math.min(this.viewK, this.visLo) && k <= Math.max(this.viewK, this.visHi)) { this._workSlab(k, stop); continue; }   // on screen: first
      if (this._sortPending()) { this._workSort(stop); continue; }
      if (this.unpublished.length && (k === null || this.scheduler.now() - this.lastPublishMs >= PUBLISH_INTERVAL_MS)) { this.publish(); continue; }
      if (k === null) break;
      this._workSlab(k, stop);
    }
  }

  _workSlab(k, stop) {
    let job = this.jobs.get(k);
    if (!job) { job = new SlabJob(this, k); this.jobs.set(k, job); }
    if (!job.step(stop)) return;
    this.jobs.delete(k);
    this.slabs.set(k, job.rows);
    this.unpublished.push(k);
    if (k === this.viewK || (k >= this.visLo && k <= this.visHi)) this.publish();
  }

  /** Real catalogue stars within MATCH_KPC of the slab's box (named ones only), in key order. */
  realStarsNear(job) {
    const cat = this.nav._realStarCatalog;
    if (!cat || !cat.loaded || typeof cat.findInVolume !== 'function') return [];
    const found = cat.findInVolume(job.center, job.xzHalf + MATCH_KPC, job.yHalf + MATCH_KPC);
    const out = found.filter((rs) => rs.name && rs.name !== '"');
    out.sort((a, b) => (realStarKey(a) < realStarKey(b) ? -1 : realStarKey(a) > realStarKey(b) ? 1 : 0));
    return out;
  }

  _colour(spectral) {
    const C = this.nav.constructor?._SPECTRAL_COLORS || {};
    return C[spectral] || '#ff9664';
  }

  _mult(row) {
    // ⛔ worldX/Y/Z, NOT `pos` (Phase 3 fixup, Astra finding 3): the oracle's `_normalize` reads
    //   `worldX…` or top-level `x…` and silently drops `pos`, so every procedural roll ran with NO
    //   galaxy context — 2,455 of 5,561 rows of one inner slab disagreed with arrival. The legacy prism
    //   (NavComputer `_renderLocal`) has always passed worldX; state.js's `multFor` made the same slip.
    try {
      const m = multiplicityForSeed({ seed: row.seed, worldX: row.wx, worldY: row.wy, worldZ: row.wz, type: row.spectral, name: row.name },
        { galacticMap: this.gm }).count;
      return Number.isFinite(m) && m >= 1 ? m : 1;
    } catch (e) { return 1; }
  }

  proceduralRow(s, ref) {
    const nav = this.nav;
    let name = '';
    try { name = generateSystemName((nav._makeRng || makeRng)(s.seed), { x: s.worldX, y: s.worldY, z: s.worldZ }); } catch (e) {
      console.warn('[NavComputer] generateSystemName failed for star', s.seed, e);
    }
    const dist = navDrill.playerDistKpc(nav, s.worldX, s.worldY, s.worldZ);
    const row = {
      wx: s.worldX, wy: s.worldY, wz: s.worldZ,
      name, spectral: s.type, color: this._colour(s.type),
      seed: s.seed, key: s.key, ident: s.ident, dist, distPc: (dist * 1000).toFixed(0), slab: ref,
    };
    row.mult = this._mult(row);
    return row;
  }

  /** A real star's row: catalogue position, name, key and F1 seed; spectral from the catalogue, else its twin's. */
  realRow(rs, twin, ref) {
    const nav = this.nav;
    const spectral = rs.spect || twin?.spectral || '?';
    const dist = navDrill.playerDistKpc(nav, rs.x, rs.y, rs.z);
    const row = {
      wx: rs.x, wy: rs.y, wz: rs.z,
      name: rs.name, spectral, color: this._colour(spectral),
      seed: realStarSeed(rs.x, rs.y, rs.z), key: realStarKey(rs), ident: null,
      dist, distPc: (dist * 1000).toFixed(0), isReal: true, slab: ref,
    };
    row.mult = this._mult(row);
    return row;
  }

  /** Replace `_localStars` with every loaded slab's rows (ascending slab), bump `_rowsRev`. */
  publish() {
    if (!this.unpublished.length) return;
    const nav = this.nav;
    const added = [];
    for (const k of this.unpublished) for (const r of this.slabs.get(k)) added.push(r);
    // The viewed slab's rows first, then outward — each slab nearest-the-player first — so the head of
    // `_localStars` is what is on screen (the old loader's first query was the visible band, by distance).
    const v = this.viewK;
    const ks = [...this.slabs.keys()].sort((a, b) => (Math.abs(a - v) - Math.abs(b - v)) || (b - a));
    const arr = [];
    for (const k of ks) { const rows = this.slabs.get(k); for (let i = 0; i < rows.length; i++) arr.push(rows[i]); }
    nav._localStars = arr;                                          // the setter bumps `_rowsRev`
    this.publishedArr = arr; this.publishedLen = arr.length;
    this.log.push({ rev: nav._rowsRev, added });
    if (this.log.length > 128) this.log.shift();
    this.unpublished = [];
    this.lastPublishMs = this.scheduler.now();
    const [lo] = slabYRange(Math.min(...ks)); const [, hi] = slabYRange(Math.max(...ks));
    nav._loadedYMin = lo; nav._loadedYMax = hi;
    this.refreshStatus();
    if (typeof nav._tryAutoSelectExternalTarget === 'function') nav._tryAutoSelectExternalTarget();
  }

  /**
   * The PUBLISHED rows within `tol` kpc of height `y` — the rows of the slabs that can hold them — or
   * null when `_localStars` is not this loader's intact publish (replaced, or rows pushed into it), so
   * the caller must scan everything. For "which row is this star" questions (state.js `D.here`,
   * `D.selStar`): the answer lies within the 0.1 pc same-star radius of the star's height.
   */
  rowsNearY(y, tol = 0) {
    const arr = this.nav._localStars;
    if (!this.publishedArr || arr !== this.publishedArr || arr.length !== this.publishedLen || !Number.isFinite(y)) return null;
    const unpub = this.unpublished.length ? new Set(this.unpublished) : null;
    const out = [];
    for (let k = slabIndexOfY(y - tol), k1 = slabIndexOfY(y + tol); k <= k1; k++) {
      if (unpub && unpub.has(k)) continue;
      const rows = this.slabs.get(k);
      if (rows) for (let i = 0; i < rows.length; i++) out.push(rows[i]);
    }
    return out;
  }

  /** Rebuild the published status object (a NEW object whenever anything in it changes). */
  refreshStatus() {
    const loaded = new Set(), empty = new Set();
    let inRange = 0;
    if (this.publishedArr) {
      const unpub = new Set(this.unpublished);
      for (const [k, rows] of this.slabs) {
        if (unpub.has(k)) continue;
        const ref = refOfIndex(k);
        loaded.add(ref); if (!rows.length) empty.add(ref);
        if (k >= K_MIN && k <= K_MAX) inRange++;
      }
    }
    const total = K_MAX - K_MIN + 1;
    const viewRef = refOfIndex(this.viewK);
    const state = this.colKey === null ? 'idle'
      : (inRange === total && loaded.has(viewRef) && !this.unpublished.length ? 'ready' : 'loading');
    this._status = {
      state, loadedSlabs: loaded, emptySlabs: empty, progress: inRange / total,
      viewSlab: viewRef, viewReady: loaded.has(viewRef), suspended: !!this.nav._loadSuspended,
      rev: (this._status?.rev ?? 0) + 1,
    };
  }

  get status() { return this._status; }

  /**
   * The published rows sorted by `cmp` — built in slices under the shared deadline. While a sort is
   * being built this returns the last finished one (ready:false), or rows:null if there is none.
   * After a publish that only ADDED slabs, the new rows are sorted alone and merged in.
   */
  sortedRows(id, cmp) {
    const nav = this.nav;
    const rev = nav._rowsRev;
    let st = this.sorts.get(id);
    if (!st) { st = { id, cmp, rev: null, rows: null, job: null, jobRev: null, stage: null, added: null }; this.sorts.set(id, st); }
    st.cmp = cmp;
    if (st.rev === rev) return { rows: st.rows, rev, ready: true };
    // A sort in flight is never restarted by a newer publish (the column publishes every ~100 ms while
    // it loads, and a restarted full sort of 85k rows would never finish): it completes for the rows
    // it started on, then the newer slabs are merged in incrementally (`_workSort`).
    if (!st.job && st.jobRev !== rev) this._startSort(st, rev);
    this.activeSort = id;
    this.scheduler.add(this);
    this.scheduler.wake();
    return { rows: st.rows, rev: st.rev, ready: false };
  }

  _startSort(st, rev) {
    const rows = this.nav._localStars || [];
    st.jobRev = rev;
    // Incremental only if every publish since st.rev is in the log and the rows are ours.
    let added = null;
    if (st.rows && st.rev !== null && rows === this.publishedArr) {
      const i = this.log.findIndex((e) => e.rev > st.rev);
      if (i >= 0 && this.log[i].rev === st.rev + 1 && this.log[this.log.length - 1].rev === rev) {
        added = [];
        for (let j = i; j < this.log.length; j++) for (const r of this.log[j].added) added.push(r);
      }
    }
    if (added) { st.stage = 'chunk'; st.job = new SliceSort(added, st.cmp); }
    else { st.stage = 'full'; st.job = new SliceSort(rows.slice(), st.cmp); }
  }

  _workSort(stop) {
    const st = this.sorts.get(this.activeSort);
    if (!st || !st.job) return;
    if (!st.job.step(stop)) return;
    if (st.stage === 'chunk') { st.stage = 'merge'; st.job = SliceSort.merge(st.rows, st.job.result, st.cmp); return; }
    st.rows = st.job.result; st.rev = st.jobRev; st.job = null; st.stage = null;
    if (this.nav._rowsRev !== st.rev) this._startSort(st, this.nav._rowsRev);   // rows moved on meanwhile: catch up
  }
}

/** The loader for a nav instance (lazy, so bare test instances get one too). */
export function loaderFor(nav) {
  return (nav._prismLoader ||= new PrismLoader(nav));
}

/** The status a nav reports before it has ever loaded. */
export const IDLE_STATUS = Object.freeze({ state: 'idle', loadedSlabs: new Set(), emptySlabs: new Set(), progress: 0,
  viewSlab: null, viewReady: false, suspended: false, rev: 0 });
