/**
 * OOIRegistry — Object-Of-Interest query interface stub (WS 3, V1).
 *
 * Per SYSTEM_CONTRACTS.md §10.9: autopilot's `SHOWCASE` / `ROVING` code
 * paths read OOI data through this interface, not from scene globals.
 * V1 ships the interface signature + empty-array returns so V-later can
 * replace the stub's implementation without changing any call site.
 *
 * V-later implementation lives in the `ooi-capture-and-exposure-system`
 * workstream — it will query the hash grid / scene-graph for active
 * bodies, compositional points, timed events (eclipses, transits). This
 * stub class is the architectural seam.
 *
 * Invariant: V1 exercises neither `SHOWCASE` nor `ROVING`, so the stub's
 * empty returns have no effective call sites running through the
 * production camera-mode dispatch. The interface must exist and the
 * dispatch-from-camera-mode-to-interface-query must exist at V1 so
 * V-later is a wire-up and not a restructure.
 */
export class OOIRegistry {
  constructor() {
    // No state in V1. V-later may add hash-grid refs, event schedulers, etc.
  }

  /**
   * Query nearby Objects Of Interest — bodies, compositional targets,
   * ring systems, etc. — within `radius` scene units of `camera`.
   *
   * @param {THREE.Camera} camera — the camera to query near (unused in V1).
   * @param {number} radius — query radius in scene units (unused in V1).
   * @returns {Array<Object>} — V1 always `[]`. V-later: array of OOI descriptors.
   */
  getNearbyOOIs(/* camera, radius */) {
    return [];
  }

  /**
   * Query timed events active in the window `[now, now + horizon]` —
   * eclipses, transits, close approaches, alignment events.
   *
   * @param {number} now — current time (performance.now() or sim time; unused in V1).
   * @param {number} horizon — lookahead window in seconds (unused in V1).
   * @returns {Array<Object>} — V1 always `[]`. V-later: array of event descriptors.
   */
  getActiveEvents(/* now, horizon */) {
    return [];
  }
}
