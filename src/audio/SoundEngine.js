/**
 * SoundEngine — Sample-based sound effects loaded from /assets/sfx/.
 *
 * Each sound is an MP3 file extracted from the game's music tracks,
 * giving a unified audio aesthetic. Falls back to silence if a sample
 * fails to load.
 *
 * Usage:
 *   const sfx = new SoundEngine(settings);
 *   sfx.play('select');
 *   sfx.play('warpCharge');
 */

const SFX_NAMES = [
  'select', 'cycle', 'newSystem',
  'toggleOn', 'toggleOff',
  'autopilotOn', 'autopilotOff',
  'warpTarget', 'warpLockOn', 'warpCharge', 'warpEnter', 'warpExit',
  'titleDismiss', 'uiClick',
  'navOpen', 'navClose',
  'navDrill0', 'navDrill1', 'navDrill2', 'navDrill3', 'navDrill4',
];

export class SoundEngine {
  constructor(settings) {
    this._settings = settings;
    this._ctx = null;
    this._masterGain = null;
    this._sfxGain = null;
    this._buffers = {};   // name → AudioBuffer
    this._loading = false;
    // Session-only mute, ON at every page load (Max, 2026-06-10: the app
    // opens silent; sound is opt-in per session via the settings checkbox).
    // Deliberately NOT a persisted Settings key — persisting the unmute
    // would make the next open loud again. Saved volume levels are kept;
    // mute zeroes the master gain, which music/stings also route through.
    this._muted = true;
  }

  /** Session mute state (true = silent). */
  get muted() {
    return this._muted;
  }

  /** Set session mute and apply it to the master gain. */
  setMuted(muted) {
    this._muted = !!muted;
    this.updateVolumes();
  }

  /** Lazily create AudioContext (browsers require user gesture first). */
  _ensureContext() {
    if (this._ctx) return true;
    try {
      this._ctx = new (window.AudioContext || window.webkitAudioContext)();
      this._masterGain = this._ctx.createGain();
      this._masterGain.connect(this._ctx.destination);
      this._sfxGain = this._ctx.createGain();
      this._sfxGain.connect(this._masterGain);
      this.updateVolumes();
      this._preloadAll();
      return true;
    } catch {
      return false;
    }
  }

  /** Preload all SFX samples. */
  async _preloadAll() {
    if (this._loading) return;
    this._loading = true;
    const base = `${import.meta.env.BASE_URL}assets/sfx/`;
    await Promise.all(SFX_NAMES.map(async (name) => {
      try {
        const resp = await fetch(`${base}${name}.mp3`);
        if (!resp.ok) return;
        const buf = await resp.arrayBuffer();
        this._buffers[name] = await this._ctx.decodeAudioData(buf);
      } catch { /* sample missing — play() will be silent */ }
    }));
  }

  /** Update gain nodes from current settings. */
  updateVolumes() {
    if (!this._ctx) return;
    const s = this._settings;
    this._masterGain.gain.value = this._muted ? 0 : s.get('masterVolume');
    this._sfxGain.gain.value = s.get('sfxVolume');
  }

  /** Get the master gain node (used by MusicManager too). */
  get masterGain() {
    this._ensureContext();
    return this._masterGain;
  }

  /** Get the AudioContext. */
  get context() {
    this._ensureContext();
    return this._ctx;
  }

  /**
   * Play a named sound effect.
   * @param {string} name — sound name
   */
  play(name) {
    if (!this._ensureContext()) return;
    if (this._ctx.state === 'suspended') this._ctx.resume();

    // titleIntro is now handled by MusicManager — no SFX needed
    if (name === 'titleIntro') return;

    const buffer = this._buffers[name];
    if (!buffer) return;

    const source = this._ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this._sfxGain);
    source.start(0);
  }
}
