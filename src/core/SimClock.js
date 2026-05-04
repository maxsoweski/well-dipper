// Sim-clock counter — monotonically increments by sim dt per sim tick.
// Per docs/WORKSTREAMS/welldipper-fixed-timestep-migration-2026-05-03.md
// AC #11. Replaces `performance.now()` for any sim-side timestamp/elapsed
// math whose correctness depends on replay-determinism (input replay,
// transform-hash golden trajectory, regression test reproducibility).
//
// Why a separate clock? Wall-clock (`performance.now()`) drifts across
// replays — different machine speeds + scheduler jitter mean two replays
// of the same input sequence finish at different wall-clock-elapsed
// values. The sim-clock advances by EXACTLY `simStepMs` per sim tick,
// regardless of host speed. Same input + same seed + same sim-clock at
// each tick → byte-identical replay output.
//
// Per Dana's research (`research/motion-testing-methodology-2026-05-02.md`
// §"Replay infrastructure"): *"if any gameplay logic uses
// [DOMHighResTimeStamp] directly, replays will desync on different
// hardware."* This module is the substrate that closes that gap.
//
// Units: milliseconds. Matches `performance.now()`'s unit so the migration
// is a drop-in replace with no math rescaling at call sites.
//
// Lifetime: process-scoped. Resets to 0 at module import (page load).
// Replay scenarios may want to reset this between runs — the kit's
// scenario harness controls that via `_setSimClockMs(0)`.
//
// Concurrency: single-threaded JS. No locking needed.

let _simClockMs = 0;

/**
 * Return the current sim-clock value in milliseconds.
 * @returns {number}
 */
export function simClockMs() {
  return _simClockMs;
}

/**
 * Advance the sim-clock by one sim tick. Called by the loop binding's
 * `simUpdate` exactly once per tick, with the same `stepMs` value the
 * accumulator uses (default 1000/60 ≈ 16.667 ms).
 *
 * NOTE: callers other than the loop entry should NOT call this. The
 * sim-clock is advanced exclusively by sim ticks; render-rate or
 * wall-clock-driven advances would defeat the determinism guarantee.
 *
 * @param {number} stepMs
 */
export function _advanceSimClock(stepMs) {
  _simClockMs += stepMs;
}

/**
 * Test/replay-only: force the sim-clock to a specific value. Used by
 * scenario harnesses that need to start from a known clock state. Do
 * NOT call from production code paths.
 *
 * @param {number} ms
 */
export function _setSimClockMs(ms) {
  _simClockMs = ms;
}
