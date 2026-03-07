/**
 * MusicManager — loads and crossfades looping music tracks.
 *
 * Tracks are loaded from /assets/music/ as OGG (with MP3 fallback).
 * Each track loops seamlessly. Transitions between tracks use crossfading.
 *
 * Usage:
 *   const music = new MusicManager(soundEngine, settings);
 *   music.play('explore');        // crossfade to explore track
 *   music.play('hyperspace');     // crossfade to hyperspace
 *   music.stop();                 // fade out current track
 *
 * Track files expected at:
 *   /assets/music/title.ogg   (+ title.mp3 fallback)
 *   /assets/music/explore.ogg
 *   /assets/music/hyperspace.ogg
 *   /assets/music/deepsky.ogg
 *   etc.
 *
 * One-shot stings (warp-charge, arrival) are played with playOnce()
 * and don't interrupt the current looping track.
 */

export class MusicManager {
  /**
   * @param {import('./SoundEngine.js').SoundEngine} soundEngine
   * @param {import('../ui/Settings.js').Settings} settings
   */
  constructor(soundEngine, settings) {
    this._soundEngine = soundEngine;
    this._settings = settings;
    this._currentTrack = null;   // { name, source, gain }
    this._nextTrack = null;      // during crossfade
    this._musicGain = null;      // master music gain node
    this._buffers = {};          // name → AudioBuffer cache
    this._loading = new Set();   // names currently loading
    this._fadeDuration = 1.5;    // seconds for crossfade
    this._stingGain = null;      // gain for one-shot stings
  }

  _ensureNodes() {
    if (this._musicGain) return;
    const ctx = this._soundEngine.context;
    if (!ctx) return;
    this._musicGain = ctx.createGain();
    this._musicGain.connect(this._soundEngine.masterGain);
    this._stingGain = ctx.createGain();
    this._stingGain.connect(this._soundEngine.masterGain);
    this.updateVolumes();
  }

  updateVolumes() {
    if (!this._musicGain) return;
    this._musicGain.gain.value = this._settings.get('musicVolume');
    if (this._stingGain) {
      this._stingGain.gain.value = this._settings.get('musicVolume');
    }
  }

  /**
   * Preload a track into the buffer cache.
   * @param {string} name — track name (e.g. 'explore')
   */
  async preload(name) {
    if (this._buffers[name] || this._loading.has(name)) return;
    this._loading.add(name);

    const ctx = this._soundEngine.context;
    if (!ctx) { this._loading.delete(name); return; }

    // Try OGG first, fall back to MP3
    const base = `${import.meta.env.BASE_URL}assets/music/`;
    for (const ext of ['ogg', 'mp3']) {
      try {
        const resp = await fetch(`${base}${name}.${ext}`);
        if (!resp.ok) continue;
        const arrayBuf = await resp.arrayBuffer();
        this._buffers[name] = await ctx.decodeAudioData(arrayBuf);
        break;
      } catch {
        // Try next format
      }
    }
    this._loading.delete(name);
  }

  /**
   * Preload all known tracks.
   */
  async preloadAll() {
    const tracks = ['title', 'explore', 'hyperspace', 'deepsky', 'warp-charge', 'arrival'];
    await Promise.all(tracks.map(t => this.preload(t)));
  }

  /**
   * Crossfade to a looping track.
   * @param {string} name — track name
   * @param {number} [fadeDuration] — override crossfade duration in seconds
   */
  async play(name, fadeDuration) {
    this._ensureNodes();
    const ctx = this._soundEngine.context;
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();

    // Already playing this track
    if (this._currentTrack?.name === name) return;

    // Make sure it's loaded
    if (!this._buffers[name]) {
      await this.preload(name);
      if (!this._buffers[name]) return; // file not found
    }

    const fade = fadeDuration ?? this._fadeDuration;
    const now = ctx.currentTime;

    // Fade out current track
    if (this._currentTrack) {
      const old = this._currentTrack;
      old.gain.gain.setValueAtTime(old.gain.gain.value, now);
      old.gain.gain.linearRampToValueAtTime(0, now + fade);
      // Stop after fade
      setTimeout(() => {
        try { old.source.stop(); } catch { /* already stopped */ }
      }, fade * 1000 + 100);
    }

    // Create new track
    const source = ctx.createBufferSource();
    source.buffer = this._buffers[name];
    source.loop = true;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(1, now + fade);
    source.connect(gain);
    gain.connect(this._musicGain);
    source.start(0);

    this._currentTrack = { name, source, gain };
  }

  /**
   * Play a one-shot sting (non-looping, doesn't replace current track).
   * @param {string} name — track name (e.g. 'warp-charge', 'arrival')
   * @param {number} [volume=1] — volume multiplier
   */
  async playOnce(name, volume = 1) {
    this._ensureNodes();
    const ctx = this._soundEngine.context;
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();

    if (!this._buffers[name]) {
      await this.preload(name);
      if (!this._buffers[name]) return;
    }

    const source = ctx.createBufferSource();
    source.buffer = this._buffers[name];
    source.loop = false;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    source.connect(gain);
    gain.connect(this._stingGain);
    source.start(0);
  }

  /**
   * Duck the current music volume (e.g. during warp charge).
   * @param {number} target — target volume (0-1)
   * @param {number} duration — ramp duration in seconds
   */
  duck(target, duration) {
    if (!this._currentTrack) return;
    const ctx = this._soundEngine.context;
    const now = ctx.currentTime;
    this._currentTrack.gain.gain.setValueAtTime(
      this._currentTrack.gain.gain.value, now
    );
    this._currentTrack.gain.gain.linearRampToValueAtTime(target, now + duration);
  }

  /**
   * Restore music volume after ducking.
   * @param {number} duration — ramp duration in seconds
   */
  unduck(duration) {
    if (!this._currentTrack) return;
    const ctx = this._soundEngine.context;
    const now = ctx.currentTime;
    this._currentTrack.gain.gain.setValueAtTime(
      this._currentTrack.gain.gain.value, now
    );
    this._currentTrack.gain.gain.linearRampToValueAtTime(1, now + duration);
  }

  /**
   * Fade out and stop all music.
   * @param {number} [fadeDuration] — override fade duration
   */
  stop(fadeDuration) {
    if (!this._currentTrack) return;
    const ctx = this._soundEngine.context;
    const fade = fadeDuration ?? this._fadeDuration;
    const now = ctx.currentTime;
    const old = this._currentTrack;
    old.gain.gain.setValueAtTime(old.gain.gain.value, now);
    old.gain.gain.linearRampToValueAtTime(0, now + fade);
    setTimeout(() => {
      try { old.source.stop(); } catch { /* already stopped */ }
    }, fade * 1000 + 100);
    this._currentTrack = null;
  }

  /** Name of the currently playing track, or null. */
  get currentTrack() {
    return this._currentTrack?.name ?? null;
  }
}
