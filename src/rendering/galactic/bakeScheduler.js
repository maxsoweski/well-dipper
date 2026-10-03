// bakeScheduler.js — the sky-bake lifecycle as a pure state machine (headless; unit-tested on its own).
//
// The controller owns two texture SETS (front = published, back = baking). This class decides, frame by frame,
// which tiles to render into which set and when a finished bake may be shown — the GPU work is the caller's.
//
//   request(snapshot)  → a new GENERATION. The snapshot is frozen (immutable origin/destination record). Any
//                        older job — partially baked, or finished but waiting — is superseded: its tiles stop
//                        and its completion can never be published (the generation token no longer matches).
//   nextTiles(max)     → tiles to render this frame for the current job (none while stalled, held-and-ready,
//                        or failed). Bounded per frame.
//   tileDone(gen, i)   → false (discarded) when `gen` is not the live job's generation.
//   request(s, {staged: true}) → a PREPARED sky (SkyRenderer.prepareForPosition*, before its activate()): it
//                        bakes, but is not shown until commit(gen) — the moment that sky actually goes live.
//   setHold(true)      → a warp is in flight: a finished bake WAITS; the published sky stays untouched.
//   setHold(false)     → the warp reached the swap point: publish the destination if complete, else unpublish
//                        (fallback: the feature's old billboard) and publish the moment the bake completes.
//   timeout            → a job unfinished after `timeoutMs` fails: its tiles stop, nothing is published for it,
//                        the billboard fallback stays until the next request.
//
// Atomicity: a set is published ONLY when every tile of its generation is done.

export const BAKE_STATES = Object.freeze(['idle', 'baking', 'ready', 'failed']);

export class BakeScheduler {
  /**
   * @param {{tilesPerBake: number, timeoutMs?: number, holdTimeoutMs?: number, now?: () => number}} opts
   */
  constructor({ tilesPerBake, timeoutMs = 20000, holdTimeoutMs = 45000, now = () => performance.now() }) {
    if (!(tilesPerBake > 0)) throw new Error('BakeScheduler: tilesPerBake must be > 0');
    this.tilesPerBake = tilesPerBake;
    this.timeoutMs = timeoutMs;
    this.holdTimeoutMs = holdTimeoutMs;
    this.now = now;
    this.gen = 0;
    this.job = null;        // { gen, snapshot, set, next, done, startedAt, state }
    this.published = null;  // { gen, snapshot, set }
    this.deferred = null;   // a staged request waiting for the live sky's bake to finish
    this.hold = false;
    this.holdSince = null;
    this.stalled = false;   // debug: a deliberately delayed bake
    this.events = [];       // drained by the caller: {type: 'publish'|'unpublish'|'discard'|'timeout'|'supersede', gen}
    this.stats = { requests: 0, published: 0, superseded: 0, discardedTiles: 0, timeouts: 0, holdTimeouts: 0 };
  }

  /** The set index a new job bakes into: whichever set is not on screen. */
  _backSet() {
    return this.published ? 1 - this.published.set : 0;
  }

  /** Start a new generation for `snapshot` (frozen). Returns the generation token.
   *  A STAGED request (a prepared sky that is not live yet) never pre-empts an unfinished bake of the LIVE sky:
   *  it waits (deferred) until that one is published, so the sky on screen always gets its volume first. */
  request(snapshot, { staged = false } = {}) {
    this.stats.requests++;
    const gen = ++this.gen;
    const live = this.job && !this.job.staged && (this.job.state === 'baking' || this.job.state === 'ready');
    if (staged && live) {
      if (this.deferred) { this.stats.superseded++; this.events.push({ type: 'supersede', gen: this.deferred.gen }); }
      this.deferred = { gen, snapshot: Object.freeze(snapshot), staged };
      return gen;
    }
    if (this.deferred) { this.stats.superseded++; this.events.push({ type: 'supersede', gen: this.deferred.gen }); this.deferred = null; }
    if (this.job && this.job.state !== 'published') {
      this.stats.superseded++;
      this.events.push({ type: 'supersede', gen: this.job.gen });
    }
    this._startJob(gen, Object.freeze(snapshot), staged);
    return gen;
  }

  _startJob(gen, snapshot, staged) {
    this.job = { gen, snapshot, set: this._backSet(), next: 0, done: 0, startedAt: this.now(), state: 'baking', staged };
  }

  /** The newest request (a deferred one if any) — what the caller compares against to avoid re-requesting. */
  latest() {
    return this.deferred || this.job;
  }

  /** The prepared sky of generation `gen` went live: it may be shown once complete (and not held). */
  commit(gen) {
    if (this.deferred && this.deferred.gen === gen) { this.deferred.staged = false; return; }
    const j = this.job;
    if (!j || j.gen !== gen || !j.staged) return;
    j.staged = false;
    if (j.state === 'ready' && !this.hold) this._publish();
  }

  /** Forget the current request (nothing to draw). The published sky is dropped unless a warp holds it. */
  clear() {
    if (this.job && this.job.state !== 'published') {
      this.stats.superseded++;
      this.events.push({ type: 'supersede', gen: this.job.gen });
    }
    this.job = null;
    this.deferred = null;
    if (!this.hold) this._unpublish();
  }

  setHold(on) {
    on = !!on;
    if (on === this.hold) return;
    this.hold = on;
    this.holdSince = on ? this.now() : null;
    if (!on) this._release();
  }

  _release() {
    const j = this.job;
    if (j && j.state === 'ready' && !j.staged) this._publish();
    else if (this.published && (!j || j.gen !== this.published.gen)) this._unpublish();
  }

  _publish() {
    const j = this.job;
    this.published = { gen: j.gen, snapshot: j.snapshot, set: j.set };
    j.state = 'published';
    this.stats.published++;
    this.events.push({ type: 'publish', gen: j.gen });
    if (this.deferred) {
      const d = this.deferred;
      this.deferred = null;
      this._startJob(d.gen, d.snapshot, d.staged);
    }
  }

  _unpublish() {
    if (!this.published) return;
    this.events.push({ type: 'unpublish', gen: this.published.gen });
    this.published = null;
  }

  /** Housekeeping (timeouts) + the tiles to render now. */
  nextTiles(maxTiles) {
    const t = this.now();
    if (this.hold && this.holdSince != null && t - this.holdSince > this.holdTimeoutMs) {
      // A warp that never reached its swap point (interrupted): stop holding.
      this.stats.holdTimeouts++;
      this.setHold(false);
    }
    const j = this.job;
    if (!j || j.state !== 'baking') return [];
    if (t - j.startedAt > this.timeoutMs) {
      j.state = 'failed';
      this.stats.timeouts++;
      this.events.push({ type: 'timeout', gen: j.gen });
      if (!this.hold) this._unpublish();
      if (this.deferred) { const d = this.deferred; this.deferred = null; this._startJob(d.gen, d.snapshot, d.staged); }
      return [];
    }
    if (this.stalled) return [];
    const out = [];
    while (out.length < maxTiles && j.next < this.tilesPerBake) out.push({ gen: j.gen, tile: j.next++, set: j.set, snapshot: j.snapshot });
    return out;
  }

  /** Report a rendered tile. Returns false (and counts a discard) for a stale generation. */
  tileDone(gen, tile) {
    const j = this.job;
    if (!j || j.gen !== gen || j.state !== 'baking') {
      this.stats.discardedTiles++;
      this.events.push({ type: 'discard', gen });
      return false;
    }
    j.done++;
    if (j.done >= this.tilesPerBake) {
      j.state = 'ready';
      if (!this.hold && !j.staged) this._publish();
    }
    return true;
  }

  drainEvents() {
    const e = this.events;
    this.events = [];
    return e;
  }

  /** The bake state for the snapshot: idle | baking | ready (waiting on the warp) | failed, + faces done. */
  status(tilesPerFace) {
    const j = this.job;
    let state = 'idle';
    if (j) state = j.state === 'published' ? 'idle' : j.state;
    if (this.deferred && state === 'idle') state = 'baking';
    return {
      state,
      generation: this.deferred ? this.deferred.gen : j ? j.gen : null,
      deferred: !!this.deferred,
      publishedGeneration: this.published ? this.published.gen : null,
      facesDone: j ? Math.floor(j.done / tilesPerFace) : 0,
      tilesDone: j ? j.done : 0,
      tilesPerBake: this.tilesPerBake,
      hold: this.hold,
      staged: this.deferred ? !!this.deferred.staged : j ? !!j.staged : false,
      stalled: this.stalled,
      ageMs: j && j.state === 'baking' ? this.now() - j.startedAt : null,
      stats: { ...this.stats },
    };
  }
}
