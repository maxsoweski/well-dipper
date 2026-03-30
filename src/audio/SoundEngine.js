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
];

export class SoundEngine {
  constructor(settings) {
    this._settings = settings;
    this._ctx = null;
    this._masterGain = null;
    this._sfxGain = null;
    this._buffers = {};   // name → AudioBuffer
    this._loading = false;
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
    this._masterGain.gain.value = s.get('masterVolume');
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
