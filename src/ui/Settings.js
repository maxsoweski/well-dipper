/**
 * Settings — persistent user preferences with localStorage backing.
 *
 * Provides get/set/reset for all configurable values. Changes are saved
 * to localStorage immediately and can trigger registered callbacks.
 */

import { clampPosterizeLevels } from '../rendering/posterizeLevels.js'; const STORAGE_KEY = 'well-dipper-settings'; const CLAMPS = { posterizeLevels: clampPosterizeLevels };   // ⭐ B2P — WHERE A SETTING IS STORED IS WHERE IT IS CLAMPED. setPosterizeLevels() clamps to 2..64 on its way to the shader, so without this set('posterizeLevels', 500) PERSISTED 500 while the game drew 64: the stored setting and the drawn picture disagreed forever, and any UI reading the setting back would show a number no pixel ever used. The bound is NOT restated here — it is the very clamp the shader path spends, imported, so the two cannot drift. ⛔ RIDES THIS LINE: Settings.js is line-count fenced like the rest of B2P.

const DEFAULTS = {
  // Visual
  pixelScale: 3, posterizeLevels: 6,   // B2P: the colour quantum every body/ring/moon/asteroid shader quantises to. 6 IS the shipped value, so an absent key falls through the DEFAULTS merge to today's picture with no migration — the flightControlType precedent below, in its own words. Raising it makes the game LESS posterized as detail lands.
  starDensity: 18000,

  // Screensaver
  idleTimeout: 300,           // seconds before autopilot starts (5 minutes)
  tourLingerMultiplier: 1.0,  // 0.5 = fast tours, 2.0 = slow tours
  titleAutoDismiss: 30,       // seconds before title screen auto-dismisses

  // Display defaults
  showOrbits: false,
  showMinimap: true,
  showGravityWells: false,

  // Simulation
  // Per workstream realistic-celestial-motion-2026-04-27 + signed-slider
  // reframe (supercruise-hud-movement-design-2026-06-24):
  // 1× = realistic (Earth-orbit 1 year, Earth-rotation 24 hours) and is the
  // shipped default in EVERY mode (flight / autopilot / idle) — at human
  // flight timescales realistic motion is imperceptible, which is the goal.
  // The menu slider is now SIGNED: DOM pos -40..0..+40 maps to
  // sign(pos)·10^(|pos|/10), so pos 0 → exactly 1× (REALTIME), drag right →
  // speed up to ~10000×, drag left → REVERSE (retrograde / rewind) to
  // ~-10000×. Scales orbital revolution AND axial rotation AND asteroid
  // orbits AND binary-star orbit uniformly via the single celestialDt lever
  // (main.js:6459). A negative multiplier runs every accumulator backward.
  celestialTimeMultiplier: 1.0,

  // Camera
  fov: 70,                    // field of view in degrees
  autoRotateSpeed: 0.67,      // degrees/sec
  zoomSensitivity: 1.5,       // matches CameraController default

  // Audio
  masterVolume: 0.7,
  musicVolume: 0.5,
  sfxVolume: 0.7,

  // Color palette (0=default, 1=mono, 2=amber, 3=green, 4=blue,
  //   5=gameboy, 6=cga, 7=sepia, 8=virtualboy, 9=inverted)
  colorPalette: 0,

  // Flight control type — §supercruise-flight-toggle-settings-design-2026-06-25.
  // F is a 2-state on/off flight toggle; THIS setting picks WHICH of the three
  // flight behaviors engages on F-on. main.js reads it on each engage and maps
  // it to FlightMode (src/flight/flightModes.js) — the stored strings are the
  // FlightMode enum values verbatim so the mapping is identity:
  //   'manual' → Manual (you fly), 'align' → Align-on-select (nose centers on
  //   target), 'assist' → Assist (auto-flies to target; steer to take over).
  // Default 'manual'. No migration: an absent key falls back to 'manual' via
  // the DEFAULTS merge, which is the desired one-time default for existing
  // users (a stored value of any other enum string is preserved as-is).
  flightControlType: 'manual',
};

export class Settings {
  constructor() {
    this._values = { ...DEFAULTS };
    this._listeners = {};  // key → Set<callback>
    this._load();
  }

  /** Get a setting value. */
  get(key) {
    return key in this._values ? this._values[key] : DEFAULTS[key];
  }

  /** Set a setting value and persist. */
  set(key, value) {
    if (!(key in DEFAULTS)) return; if (CLAMPS[key]) value = CLAMPS[key](value);   // B2P — clamp BEFORE the store, so the value kept in memory, the value persisted to localStorage and the value handed to every listener are one number and not three.
    this._values[key] = value;
    this._save();
    // Notify listeners
    const cbs = this._listeners[key];
    if (cbs) cbs.forEach(cb => cb(value));
  }

  /** Register a callback for when a specific setting changes. */
  onChange(key, callback) {
    if (!this._listeners[key]) this._listeners[key] = new Set();
    this._listeners[key].add(callback);
  }

  /** Reset all settings to defaults. */
  reset() {
    this._values = { ...DEFAULTS };
    this._save();
    // Notify all listeners
    for (const key of Object.keys(DEFAULTS)) {
      const cbs = this._listeners[key];
      if (cbs) cbs.forEach(cb => cb(DEFAULTS[key]));
    }
  }

  /** Get all default values (for UI population). */
  getDefaults() {
    return { ...DEFAULTS };
  }

  _load() {
    try {
      const json = localStorage.getItem(STORAGE_KEY);
      if (json) {
        const saved = JSON.parse(json);
        for (const key of Object.keys(DEFAULTS)) {
          if (key in saved && typeof saved[key] === typeof DEFAULTS[key]) {
            this._values[key] = CLAMPS[key] ? CLAMPS[key](saved[key]) : saved[key];   // B2P — repair what came off disk: the typeof guard on the line above admits NaN and Infinity (both typeof 'number'), and levels 0 makes `setPosterizeLevels`'s CPU-side `Math.fround(1 / levels)` an Inf in `POSTERIZE_QUANTUM.value.y`, which turns the whole frame NaN — ⛔ the divide is on the CPU, NOT in any shipped GAME shader — but the LAB program still divides (height.glsl.js:683-684), so the clamp guards both. Corrupt or hand-edited storage is fixed on the way in, not trusted.
          }
        }
        // Migrate stale idleTimeout from old 20s default to new 300s default
        if (saved.idleTimeout !== undefined && saved.idleTimeout < 60) {
          this._values.idleTimeout = DEFAULTS.idleTimeout;
          this._save();
        }
        // §realistic-celestial-motion-2026-04-27: rename
        // `orbitSpeedMultiplier` → `celestialTimeMultiplier`. Old key
        // had a narrow 0.25–4× linear range against accelerated base
        // speeds; new key spans 1×–10000× log against realistic base
        // speeds. We don't try to translate the old value — the
        // semantic register changed (the multiplier now means "how
        // much faster than realistic"). Drop the old value cleanly so
        // the user lands on the new realistic default.
        if (saved.orbitSpeedMultiplier !== undefined) {
          delete saved.orbitSpeedMultiplier;
          this._save();
        }
        // §supercruise-hud-movement-design-2026-06-24 — signed-slider reframe.
        // The celestial-time slider became signed (-40..+40) and the DESIGN
        // intent is that the game opens to realistic (imperceptible) motion in
        // every mode. Any previously-persisted value carried the old
        // positive-only meaning and was almost certainly raised (visible
        // spin/orbit is the symptom we're fixing). One-time migration: reset
        // a stored celestialTimeMultiplier to the realistic default (1.0) so
        // Max opens to NO visible planet motion. Gated on a version marker so
        // a user who DELIBERATELY re-raises/reverses it afterward isn't
        // re-clobbered on the next load.
        if (saved.celestialTimeMultiplier !== undefined
            && saved._celestialTimeSignedMigrated !== true) {
          this._values.celestialTimeMultiplier = DEFAULTS.celestialTimeMultiplier; // 1.0
          this._values._celestialTimeSignedMigrated = true;
          this._save();
        }
      }
    } catch {
      // Corrupted or unavailable — use defaults
    }
  }

  _save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this._values));
    } catch {
      // localStorage full or blocked — silently ignore
    }
  }
}
