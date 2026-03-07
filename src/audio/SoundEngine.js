/**
 * SoundEngine — Web Audio API synthesized sound effects.
 *
 * All sounds are generated programmatically (no audio files needed).
 * These are placeholder sounds that can be replaced with real samples later.
 *
 * Usage:
 *   const sfx = new SoundEngine(settings);
 *   sfx.play('select');
 *   sfx.play('warpCharge');
 */

export class SoundEngine {
  constructor(settings) {
    this._settings = settings;
    this._ctx = null; // Created lazily on first user gesture
    this._masterGain = null;
    this._sfxGain = null;
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
      return true;
    } catch {
      return false;
    }
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
   * @param {string} name — sound name (see switch below)
   */
  play(name) {
    if (!this._ensureContext()) return;
    // Resume context if suspended (autoplay policy)
    if (this._ctx.state === 'suspended') this._ctx.resume();

    switch (name) {
      case 'select': this._playSelect(); break;
      case 'cycle': this._playCycle(); break;
      case 'newSystem': this._playNewSystem(); break;
      case 'toggleOn': this._playToggle(true); break;
      case 'toggleOff': this._playToggle(false); break;
      case 'autopilotOn': this._playAutopilot(true); break;
      case 'autopilotOff': this._playAutopilot(false); break;
      case 'warpTarget': this._playWarpTarget(); break;
      case 'warpLockOn': this._playWarpLockOn(); break;
      case 'warpCharge': this._playWarpCharge(); break;
      case 'warpEnter': this._playWarpEnter(); break;
      case 'warpExit': this._playWarpExit(); break;
      case 'titleDismiss': this._playTitleDismiss(); break;
      case 'uiClick': this._playUIClick(); break;
    }
  }

  // ── Helper: create an oscillator → gain → sfxGain ──
  _osc(type, freq, duration) {
    const osc = this._ctx.createOscillator();
    const gain = this._ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = 0;
    osc.connect(gain);
    gain.connect(this._sfxGain);
    osc.start(this._ctx.currentTime);
    osc.stop(this._ctx.currentTime + duration);
    return { osc, gain, t: this._ctx.currentTime };
  }

  // ── Helper: white noise burst ──
  _noise(duration) {
    const bufferSize = this._ctx.sampleRate * duration;
    const buffer = this._ctx.createBuffer(1, bufferSize, this._ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const source = this._ctx.createBufferSource();
    source.buffer = buffer;
    const gain = this._ctx.createGain();
    gain.gain.value = 0;
    source.connect(gain);
    gain.connect(this._sfxGain);
    source.start(this._ctx.currentTime);
    return { source, gain, t: this._ctx.currentTime };
  }

  // ── Individual sound effects ──

  /** Soft blip when selecting a planet/moon/star */
  _playSelect() {
    const { gain, t } = this._osc('sine', 880, 0.15);
    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
  }

  /** Light tick when cycling with Tab */
  _playCycle() {
    const { gain, t } = this._osc('triangle', 660, 0.08);
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
  }

  /** Shimmer/whoosh for new system */
  _playNewSystem() {
    const { osc, gain, t } = this._osc('sine', 400, 0.5);
    osc.frequency.exponentialRampToValueAtTime(1200, t + 0.15);
    osc.frequency.exponentialRampToValueAtTime(600, t + 0.5);
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);

    // Add a noise layer
    const n = this._noise(0.3);
    n.gain.gain.setValueAtTime(0.08, n.t);
    n.gain.gain.exponentialRampToValueAtTime(0.001, n.t + 0.3);
  }

  /** Subtle click for toggle on/off */
  _playToggle(on) {
    const freq = on ? 1000 : 700;
    const { gain, t } = this._osc('square', freq, 0.05);
    gain.gain.setValueAtTime(0.1, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
  }

  /** Engage/disengage beep for autopilot */
  _playAutopilot(on) {
    if (on) {
      // Rising two-tone
      const a = this._osc('sine', 440, 0.15);
      a.gain.gain.setValueAtTime(0.2, a.t);
      a.gain.gain.exponentialRampToValueAtTime(0.001, a.t + 0.15);
      const b = this._osc('sine', 660, 0.15);
      b.osc.start(this._ctx.currentTime + 0.1);
      b.osc.stop(this._ctx.currentTime + 0.25);
      b.gain.gain.setValueAtTime(0, b.t);
      b.gain.gain.setValueAtTime(0.2, b.t + 0.1);
      b.gain.gain.exponentialRampToValueAtTime(0.001, b.t + 0.25);
    } else {
      // Falling two-tone
      const a = this._osc('sine', 660, 0.15);
      a.gain.gain.setValueAtTime(0.2, a.t);
      a.gain.gain.exponentialRampToValueAtTime(0.001, a.t + 0.15);
      const b = this._osc('sine', 440, 0.15);
      b.osc.start(this._ctx.currentTime + 0.1);
      b.osc.stop(this._ctx.currentTime + 0.25);
      b.gain.gain.setValueAtTime(0, b.t);
      b.gain.gain.setValueAtTime(0.2, b.t + 0.1);
      b.gain.gain.exponentialRampToValueAtTime(0.001, b.t + 0.25);
    }
  }

  /** Radar chirp when selecting a warp target */
  _playWarpTarget() {
    const { osc, gain, t } = this._osc('sine', 1200, 0.12);
    osc.frequency.exponentialRampToValueAtTime(1800, t + 0.06);
    osc.frequency.exponentialRampToValueAtTime(1200, t + 0.12);
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  }

  /** Escalating lock-on tone */
  _playWarpLockOn() {
    const { osc, gain, t } = this._osc('sawtooth', 300, 0.6);
    osc.frequency.exponentialRampToValueAtTime(1200, t + 0.5);
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.setValueAtTime(0.15, t + 0.4);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
  }

  /** Deep sub-bass rumble building (warp fold) */
  _playWarpCharge() {
    // Low rumble
    const { osc, gain, t } = this._osc('sine', 40, 6.0);
    osc.frequency.exponentialRampToValueAtTime(120, t + 5.5);
    gain.gain.setValueAtTime(0.05, t);
    gain.gain.linearRampToValueAtTime(0.3, t + 5.0);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 6.0);

    // Noise building
    const n = this._noise(6.0);
    const filter = this._ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 200;
    filter.frequency.exponentialRampToValueAtTime(2000, t + 5.5);
    filter.Q.value = 2;
    n.source.disconnect();
    n.source.connect(filter);
    filter.connect(n.gain);
    n.gain.gain.setValueAtTime(0.02, n.t);
    n.gain.gain.linearRampToValueAtTime(0.15, n.t + 5.0);
    n.gain.gain.exponentialRampToValueAtTime(0.001, n.t + 6.0);
  }

  /** Burst/punch into hyperspace */
  _playWarpEnter() {
    // Impact
    const { osc, gain, t } = this._osc('sine', 80, 0.8);
    osc.frequency.exponentialRampToValueAtTime(30, t + 0.8);
    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.8);

    // Noise burst
    const n = this._noise(0.4);
    n.gain.gain.setValueAtTime(0.3, n.t);
    n.gain.gain.exponentialRampToValueAtTime(0.001, n.t + 0.4);

    // High ping
    const h = this._osc('sine', 2400, 0.3);
    h.gain.gain.setValueAtTime(0.15, h.t);
    h.gain.gain.exponentialRampToValueAtTime(0.001, h.t + 0.3);
  }

  /** Deceleration whoosh on warp exit */
  _playWarpExit() {
    const { osc, gain, t } = this._osc('sine', 200, 1.5);
    osc.frequency.exponentialRampToValueAtTime(60, t + 1.5);
    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 1.5);

    const n = this._noise(1.0);
    n.gain.gain.setValueAtTime(0.15, n.t);
    n.gain.gain.exponentialRampToValueAtTime(0.001, n.t + 1.0);
  }

  /** Gentle chime when title screen dismisses */
  _playTitleDismiss() {
    const freqs = [523, 659, 784]; // C5, E5, G5 — major chord arpeggio
    freqs.forEach((f, i) => {
      const { gain, t } = this._osc('sine', f, 0.6);
      gain.gain.setValueAtTime(0, t);
      gain.gain.setValueAtTime(0.15, t + i * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5 + i * 0.08);
    });
  }

  /** Minimal click for settings/UI */
  _playUIClick() {
    const { gain, t } = this._osc('square', 800, 0.03);
    gain.gain.setValueAtTime(0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
  }
}
