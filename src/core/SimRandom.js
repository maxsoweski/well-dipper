// Sim-side seeded RNG — drop-in replacement for `Math.random()` in
// sim-classified code paths. Per docs/WORKSTREAMS/welldipper-fixed-
// timestep-migration-2026-05-03.md AC #13. Wraps the motion-test-kit's
// mulberry32 RNG with a module-level instance + lazy initialization.
//
// Why a separate RNG for sim:
// - `Math.random()` is browser-implementation-dependent and unseedable.
//   Two reloads of the same input replay produce different trajectories
//   because path-planning random picks (e.g., autopilot tour star
//   selection) diverge.
// - Render-side `Math.random()` (shader randomization, visual-only
//   twinkle) stays as-is — visual non-determinism doesn't affect sim
//   outcomes and shouldn't be coupled to the sim seed.
//
// Seed sourcing (in priority order):
//   1. `?seed=N` URL param on the page load.
//   2. Default: `Math.floor(Math.random() * 0xffffffff)` derived once
//      at module-import time. Non-deterministic across reloads, but
//      deterministic within the session — `simRandom()` always returns
//      the same sequence for a given session unless `_seedSimRandom`
//      is called explicitly.
//
// The seed is read once at first use and cached. Test/replay code
// that needs a specific starting state should call `_seedSimRandom(N)`
// before any sim-side code runs.

import { createRNG } from 'motion-test-kit/core/rng/mulberry32.js';

let _rng = null;
let _seed = null;

function _ensureRng() {
  if (_rng) return;
  if (_seed === null) {
    // Resolve seed from URL param if available, else random fallback.
    if (typeof location !== 'undefined' && location.search) {
      const param = new URLSearchParams(location.search).get('seed');
      const parsed = param !== null ? Number(param) : NaN;
      if (Number.isFinite(parsed)) {
        _seed = parsed >>> 0;
      }
    }
    if (_seed === null) {
      _seed = (Math.floor(Math.random() * 0xffffffff)) >>> 0;
    }
  }
  _rng = createRNG(_seed);
}

/**
 * Return a [0, 1) float — drop-in for `Math.random()`. Driven by the
 * seeded mulberry32 RNG, NOT the browser's PRNG. Use this in sim-
 * classified code paths (autopilot, nav, choreographers, body
 * generation, etc.). Render-side code can keep `Math.random()`.
 *
 * @returns {number}
 */
export function simRandom() {
  _ensureRng();
  return _rng.next();
}

/**
 * Seed the sim-side RNG to a specific value. Used by replay scenarios
 * + test harnesses to reproduce a known-good run. Resets internal state.
 *
 * @param {number} seed — uint32-coerced.
 */
export function _seedSimRandom(seed) {
  if (typeof seed !== 'number' || !Number.isFinite(seed)) {
    throw new Error('_seedSimRandom: seed must be a finite number');
  }
  _seed = seed >>> 0;
  _rng = createRNG(_seed);
}

/**
 * Read the current seed (the one used to initialize the RNG). Useful
 * for logging the seed of a non-deterministic-default session so the
 * exact run can be reproduced via `?seed=N`.
 *
 * @returns {number|null}  null before first use.
 */
export function simRandomSeed() {
  return _seed;
}

/**
 * Read the RNG's internal state — for save/restore at scenario
 * checkpoints. Pass to `_restoreSimRandomState(s)` to resume from
 * exactly the same point.
 *
 * @returns {number|null}  null before first use.
 */
export function simRandomState() {
  return _rng ? _rng.state() : null;
}

/**
 * Restore RNG state captured via `simRandomState()`.
 *
 * @param {number} state
 */
export function _restoreSimRandomState(state) {
  _ensureRng();
  _rng.restore(state);
}
