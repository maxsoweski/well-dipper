// Headless proof of the BOOT-FLOW REORDER (§free-look-interaction-redesign
// -2026-06-27, Part 3): the ORRERY/HELM picker is the cold-open. It REPLACES the
// "Do you wish to begin?" splash as the begin-gate. Picking a mode (or "press
// anything") STARTS the intro/title music + DESHE/score logos, then warps into
// the chosen mode. The post-pick intro is SKIPPABLE — pressing anything jumps to
// the warp.
//
// This pins the pure reducer `bootDismissAction({ phase, picked })` that the live
// host's dismiss funnels (canvas mousedown / touchstart / keydown) read to decide
// what a boot-time input should DO, given which boot phase we're in. The concrete
// side-effects (start the logo timeline, cancel the timers and reveal) live in
// main.js; here we model only the DECISION so it's testable without three.js or
// the live host — same shape as bootModeAction / modeSwapAction.
//
// Two boot phases, two actions, plus the live-game no-op:
//   - 'title' (picker shown, intro not started) → 'begin-intro' (music + logos)
//   - 'intro' (post-pick intro playing)         → 'skip-intro'  (jump to warp)
//   - 'live'  (gameplay)                        → 'none'
import { describe, it, expect } from 'vitest';
import { bootDismissAction } from '../flightModes.js';

describe('bootDismissAction — boot-time input routing by phase (pure)', () => {
  it('TITLE phase: any begin-input starts the intro (music + DESHE/score logos)', () => {
    // Whether the player clicked a mode button or "pressed anything", the title
    // picker is the begin-gate: the input BEGINS the intro sequence.
    expect(bootDismissAction({ phase: 'title', picked: 'helm' }).action).toBe('begin-intro');
    expect(bootDismissAction({ phase: 'title', picked: 'orrery' }).action).toBe('begin-intro');
    expect(bootDismissAction({ phase: 'title', picked: null }).action).toBe('begin-intro');
  });

  it('INTRO phase: any input SKIPS the post-pick intro straight to the warp', () => {
    // The intro is skippable — pressing anything / clicking / touch cancels the
    // logo timeline and jumps to the reveal.
    expect(bootDismissAction({ phase: 'intro', picked: null }).action).toBe('skip-intro');
    expect(bootDismissAction({ phase: 'intro', picked: 'helm' }).action).toBe('skip-intro');
  });

  it('LIVE phase: boot input routing does NOTHING (normal gameplay handling)', () => {
    expect(bootDismissAction({ phase: 'live', picked: null }).action).toBe('none');
    expect(bootDismissAction({ phase: undefined, picked: null }).action).toBe('none');
    expect(bootDismissAction({}).action).toBe('none');
  });

  it('begin-intro carries the boot MODE (default ORRERY when no explicit pick)', () => {
    // The "press anything to begin" path (no explicit pick) defaults to ORRERY —
    // the safe, contemplative boot; mobile coercion to ORRERY happens at the call
    // site (this reducer is regime-agnostic about the host). An explicit pick is
    // passed through bootModeAction so an unknown value still falls back to ORRERY.
    expect(bootDismissAction({ phase: 'title', picked: 'helm' }).mode).toBe('helm');
    expect(bootDismissAction({ phase: 'title', picked: 'orrery' }).mode).toBe('orrery');
    expect(bootDismissAction({ phase: 'title', picked: null }).mode).toBe('orrery');
    expect(bootDismissAction({ phase: 'title', picked: 'nonsense' }).mode).toBe('orrery');
  });

  it('only begin-intro carries a mode; skip / none leave it undefined', () => {
    expect(bootDismissAction({ phase: 'intro', picked: 'helm' }).mode).toBeUndefined();
    expect(bootDismissAction({ phase: 'live', picked: 'helm' }).mode).toBeUndefined();
  });
});
