// Input recording + replay wiring for well-dipper. Per docs/WORKSTREAMS/
// welldipper-fixed-timestep-migration-2026-05-03.md AC #14. Wraps the
// motion-test-kit's createInputRecorder / createInputPlayer /
// createKeyboardMouseBridge / blobDownloadWriter into a single module
// keyed by URL param.
//
// URL params (read at init):
//   ?recordInput=1                  — start recording at session start.
//                                     Press F9 (handled in main.js) to
//                                     download the JSON record.
//   ?replayInput=<path/to/json>     — load record from path, replay
//                                     events at recorded frame
//                                     boundaries against the live sim.
//
// Recording capture surface (current scope per AC #14): keyboard events
// only (keydown / keyup). Mouse / wheel / touch can be added per-need;
// the kit's bridge captures them already, but the well-dipper apply-
// event handler currently maps only keyboard. Autopilot tour + manual
// W interrupt — the brief's verifiable scenario — is keyboard-only.
//
// Sequencing contract (matches kit's createInputPlayer):
//   1. Frame 0 events apply synchronously at init (rngSeed + any
//      pre-tick events).
//   2. Each sim tick runs simUpdate(stepMs).
//   3. AFTER the sim tick, frame counter advances by 1.
//   4. Events recorded for the NEW frame value apply BEFORE the next
//      sim tick.
// `replayTickPre()` is called BEFORE simStep inside main.js's bindToRAF
// simUpdate wrapper; `recordingTick()` is called AFTER simStep so the
// frame counter advances post-tick (matching the kit's tick semantics).

import { createInputRecorder } from 'motion-test-kit/core/replay/input-recorder.js';
import { createInputPlayer } from 'motion-test-kit/core/replay/input-player.js';
import { createKeyboardMouseBridge } from 'motion-test-kit/adapters/dom/keyboard-mouse-bridge.js';
import { blobDownloadWriter } from 'motion-test-kit/adapters/dom/blob-download-writer.js';
import { _seedSimRandom } from './SimRandom.js';

let _recorder = null;
let _player = null;
let _replayRecord = null;
let _replayCurrentFrame = 0;
let _replayEventIdx = 0;

const _params = (typeof location !== 'undefined' && location.search)
  ? new URLSearchParams(location.search)
  : new URLSearchParams();

/**
 * Initialize recording mode. Pass the seed already used for SimRandom
 * (so the record's frame-0 rngSeed event captures the right value) and
 * the stepMs used by the accumulator.
 *
 * Caller wires the bridge to `window` once it's available.
 *
 * @param {object} options
 * @param {number} options.rngSeed
 * @param {number} options.stepMs
 * @returns {boolean} true if recording was activated (param present)
 */
export function initRecording({ rngSeed, stepMs }) {
  if (!_params.has('recordInput')) return false;
  _recorder = createInputRecorder({ rngSeed, stepMs });
  const bridge = createKeyboardMouseBridge(_recorder);
  bridge.attach(window);
  console.log(`[InputReplay] recording active — seed=${rngSeed}, stepMs=${stepMs.toFixed(3)}`);
  return true;
}

/**
 * Advance the recorder's frame counter. Called AFTER each sim tick.
 */
export function recordingTick() {
  if (_recorder) _recorder.tick();
}

/**
 * Snapshot the current record + trigger download as JSON. Filename
 * defaults to `welldipper-input-<seed>.json`.
 *
 * @param {string} [filename]
 */
export function downloadRecording(filename) {
  if (!_recorder) {
    console.warn('[InputReplay] downloadRecording: no active recorder');
    return;
  }
  const snapshot = _recorder.snapshot();
  const seed = snapshot.events[0]?.payload?.seed ?? 'unknown';
  const path = filename || `welldipper-input-${seed}.json`;
  blobDownloadWriter(snapshot, path);
  console.log(`[InputReplay] dumped ${snapshot.events.length} events / ${snapshot.totalFrames} frames → ${path}`);
}

/**
 * Initialize replay mode. Async — fetches the JSON record from the
 * given URL, then sets up the player.
 *
 * @param {(event: { kind: string, payload: object }) => void} applyEvent
 *   Host callback. Translates 'rngSeed' / 'keydown' / 'keyup' / etc.
 *   into well-dipper sim state mutations.
 * @returns {Promise<boolean>} true if replay was activated.
 */
export async function initReplay(applyEvent) {
  const path = _params.get('replayInput');
  if (!path) return false;
  const url = path.startsWith('/') ? path : '/' + path;
  const r = await fetch(url);
  if (!r.ok) {
    throw new Error(`[InputReplay] failed to fetch ${url}: ${r.status}`);
  }
  _replayRecord = await r.json();
  if (!_replayRecord || !Array.isArray(_replayRecord.events)) {
    throw new Error('[InputReplay] invalid record JSON shape');
  }
  // Apply pre-frame-0 events (rngSeed lives here) synchronously.
  while (_replayEventIdx < _replayRecord.events.length
      && _replayRecord.events[_replayEventIdx].frame === 0) {
    applyEvent(_replayRecord.events[_replayEventIdx]);
    _replayEventIdx++;
  }
  // Stash applyEvent for tick-time apply.
  _player = { applyEvent };
  console.log(`[InputReplay] replay loaded: ${_replayRecord.events.length} events / ${_replayRecord.totalFrames} frames`);
  return true;
}

/**
 * Apply any events recorded for the *next* sim frame BEFORE the sim
 * tick runs. Called inside main.js's simUpdate wrapper before simStep.
 * This matches the kit's input-player sequencing.
 */
export function replayTickPre() {
  if (!_player || !_replayRecord) return;
  _replayCurrentFrame++;
  const events = _replayRecord.events;
  while (_replayEventIdx < events.length
      && events[_replayEventIdx].frame === _replayCurrentFrame) {
    _player.applyEvent(events[_replayEventIdx]);
    _replayEventIdx++;
  }
}

/**
 * Default applyEvent for well-dipper. Maps:
 *   'rngSeed'        → _seedSimRandom(payload.seed)
 *   'keydown'        → heldKeys.add(code, key)
 *   'keyup'          → heldKeys.delete(code, key)
 * Other kinds (mouse / wheel / touch) are ignored (out of scope for
 * AC #14's autopilot-tour-with-W-interrupt verifiable). Hosts can wrap
 * this with a custom apply that extends the kind taxonomy.
 *
 * @param {Set<string>} heldKeys  the live _heldKeys set in main.js.
 * @returns {(event: { kind: string, payload: object }) => void}
 */
export function makeWelldipperApplyEvent(heldKeys) {
  return (event) => {
    const { kind, payload } = event;
    if (kind === 'rngSeed') {
      _seedSimRandom(payload.seed);
    } else if (kind === 'keydown') {
      if (payload.code) heldKeys.add(payload.code);
      if (payload.key) heldKeys.add(payload.key);
    } else if (kind === 'keyup') {
      if (payload.code) heldKeys.delete(payload.code);
      if (payload.key) heldKeys.delete(payload.key);
    }
    // mouse / wheel / touch: ignore for AC #14 scope.
  };
}

export function isRecordingActive() { return _recorder !== null; }
export function isReplayActive() { return _player !== null; }
export function replayCurrentFrame() { return _replayCurrentFrame; }
export function replayTotalFrames() { return _replayRecord?.totalFrames ?? 0; }
export function replayComplete() {
  return _replayRecord !== null && _replayCurrentFrame >= _replayRecord.totalFrames;
}
