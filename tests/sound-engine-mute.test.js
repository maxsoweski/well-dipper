// Session mute — Well Dipper opens silent by default (Max, 2026-06-10).
// SoundEngine starts muted on every construction (page load); the settings
// checkbox flips it for the session only — nothing persists, so the next
// open is muted again. Mute is applied at the master gain, which music and
// stings also route through (MusicManager connects to soundEngine.masterGain),
// so one gain silences everything. Saved volume levels are untouched.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SoundEngine } from '../src/audio/SoundEngine.js';

class FakeGain {
  constructor() { this.gain = { value: 1 }; }
  connect() {}
}
class FakeAudioContext {
  constructor() { this.destination = {}; this.state = 'running'; }
  createGain() { return new FakeGain(); }
  decodeAudioData() { return Promise.resolve({}); }
}

const fakeSettings = {
  get: (k) => ({ masterVolume: 0.7, sfxVolume: 0.6, musicVolume: 0.5 }[k]),
};

describe('SoundEngine session mute', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { AudioContext: FakeAudioContext });
    vi.stubGlobal('fetch', () => Promise.reject(new Error('no network in tests')));
  });

  it('starts muted: master gain is 0 despite saved masterVolume', () => {
    const engine = new SoundEngine(fakeSettings);
    const master = engine.masterGain; // triggers _ensureContext + updateVolumes
    expect(engine.muted).toBe(true);
    expect(master.gain.value).toBe(0);
  });

  it('setMuted(false) restores the saved masterVolume', () => {
    const engine = new SoundEngine(fakeSettings);
    const master = engine.masterGain;
    engine.setMuted(false);
    expect(engine.muted).toBe(false);
    expect(master.gain.value).toBe(0.7);
  });

  it('setMuted(true) silences again without touching sfx gain', () => {
    const engine = new SoundEngine(fakeSettings);
    const master = engine.masterGain;
    engine.setMuted(false);
    engine.setMuted(true);
    expect(master.gain.value).toBe(0);
    // sfx gain keeps its saved level — mute lives at the master node only
    expect(engine._sfxGain.gain.value).toBe(0.6);
  });

  it('updateVolumes while muted keeps master at 0 (settings slider moves must not unmute)', () => {
    const engine = new SoundEngine(fakeSettings);
    const master = engine.masterGain;
    engine.updateVolumes();
    expect(master.gain.value).toBe(0);
  });
});
