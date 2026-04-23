/**
 * AutopilotEvents — minimal event-surface hook for autopilot state changes.
 *
 * Per SYSTEM_CONTRACTS.md §10.7: autopilot exposes named transition events
 * so V-later subsystems (audio stingers, HUD cues, telemetry loggers) can
 * subscribe without autopilot knowing they exist. WS 3 bootstraps the bus
 * with `camera-mode-change`; WS 4 will add `phase-change` and `toggle`.
 *
 * V1 contract: zero subscribers in production code — emissions are valid
 * but unobserved. The interface must exist at V1 so V-later subscribers
 * are a registration step, not a restructure.
 *
 * Keep it minimal: no async handling, no error trapping beyond console,
 * no once-listeners. Subscribers are trusted.
 */
export class AutopilotEvents {
  constructor() {
    /** @type {Map<string, Set<Function>>} */
    this._listeners = new Map();
  }

  /**
   * Register a listener for `event`.
   * @param {string} event
   * @param {Function} cb — called with the event payload object.
   * @returns {Function} — unsubscribe fn.
   */
  on(event, cb) {
    if (!this._listeners.has(event)) this._listeners.set(event, new Set());
    this._listeners.get(event).add(cb);
    return () => this.off(event, cb);
  }

  /** Unregister a listener. */
  off(event, cb) {
    const set = this._listeners.get(event);
    if (set) set.delete(cb);
  }

  /**
   * Emit `event` with `payload` to all subscribers.
   * @param {string} event
   * @param {Object} payload
   */
  emit(event, payload) {
    const set = this._listeners.get(event);
    if (!set) return;
    for (const cb of set) {
      try { cb(payload); }
      catch (e) { console.error(`[AutopilotEvents] listener threw for '${event}':`, e); }
    }
  }
}
