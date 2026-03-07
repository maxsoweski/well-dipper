/**
 * Settings — persistent user preferences with localStorage backing.
 *
 * Provides get/set/reset for all configurable values. Changes are saved
 * to localStorage immediately and can trigger registered callbacks.
 */

const STORAGE_KEY = 'well-dipper-settings';

const DEFAULTS = {
  // Visual
  pixelScale: 3,
  starDensity: 6000,

  // Screensaver
  idleTimeout: 300,           // seconds before autopilot starts (5 minutes)
  tourLingerMultiplier: 1.0,  // 0.5 = fast tours, 2.0 = slow tours
  deepSkyChance: 15,          // % chance of deep sky destination per warp
  titleAutoDismiss: 30,       // seconds before title screen auto-dismisses

  // Display defaults
  showOrbits: false,
  showMinimap: true,
  showGravityWells: false,

  // Camera
  autoRotateSpeed: 0.67,      // degrees/sec
  zoomSensitivity: 1.5,       // matches CameraController default

  // Audio
  masterVolume: 0.7,
  musicVolume: 0.5,
  sfxVolume: 0.7,

  // Color palette (0=default, 1=mono, 2=amber, 3=green, 4=blue,
  //   5=gameboy, 6=cga, 7=sepia, 8=virtualboy, 9=inverted)
  colorPalette: 0,
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
    if (!(key in DEFAULTS)) return;
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
            this._values[key] = saved[key];
          }
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
