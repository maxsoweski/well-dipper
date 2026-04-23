/**
 * CameraMode — enum for the autopilot camera-axis dispatch.
 *
 * Per SYSTEM_CONTRACTS.md §10.1 and docs/FEATURES/autopilot.md §"V1
 * architectural affordances for V-later items," the camera axis is a
 * first-class concept independent of the ship axis. The enum is the
 * selector for which authored camera behavior runs per frame.
 *
 * V1 ships `ESTABLISHING` as the only exercised mode (wide/slow framing
 * that paces independently of ship phase; linger on receding subjects;
 * pan forward toward incoming targets). `SHOWCASE` and `ROVING` exist
 * architecturally so the dispatch surface is a first-class selector, not
 * an if-branch — V-later lights them up as new branches, not as a
 * restructure.
 *
 * Contract: `docs/SYSTEM_CONTRACTS.md` §10.1.
 * Feature: `docs/FEATURES/autopilot.md` §"Per-phase criterion — camera axis (V1)".
 * Workstream: `docs/WORKSTREAMS/autopilot-camera-axis-retirement-2026-04-23.md`.
 */
export const CameraMode = Object.freeze({
  ESTABLISHING: 'ESTABLISHING',
  SHOWCASE:     'SHOWCASE',
  ROVING:       'ROVING',
});
