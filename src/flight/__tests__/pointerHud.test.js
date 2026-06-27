// Headless proof of Part 1 (§free-look-interaction-redesign-2026-06-27): the OS
// cursor and the flight-HUD steering reticle (center cross + joystick deflection
// dot) are shown/hidden BY SUB-MODE, from one pure reducer the live host applies
// on every transition that changes regime or free-look.
//
// The decision table (desktop):
//   HELM hands-on (regime 'helm', !freeLook) → cursor 'none', showReticle true
//   HELM free-look (regime 'helm',  freeLook) → cursor 'auto', showReticle false
//   ORRERY (regime 'orrery')                  → cursor 'auto', showReticle false
// Mobile is touch-only: the cursor is irrelevant and must NEVER be hidden, so
// cursor is always 'auto' on mobile regardless of regime / free-look.
//
// The load-bearing invariant: cursor:'none' (hidden) happens ONLY in desktop HELM
// hands-on flight — the one sub-mode where the virtual joystick steers and the OS
// cursor would clutter the steering reticle. Everywhere a cursor is wanted for
// pointing/selecting (HELM free-look, ORRERY), it stays 'auto'.
import { describe, it, expect } from 'vitest';
import { pointerHudState } from '../flightModes.js';

describe('pointerHudState — cursor + steering-reticle visibility by sub-mode (pure)', () => {
  it('HELM hands-on (desktop): hides the cursor, shows the steering reticle', () => {
    const s = pointerHudState({ regime: 'helm', freeLook: false, isMobile: false });
    expect(s).toEqual({ cursor: 'none', showReticle: true });
  });

  it('HELM free-look (desktop): shows the cursor, hides the steering reticle', () => {
    const s = pointerHudState({ regime: 'helm', freeLook: true, isMobile: false });
    expect(s).toEqual({ cursor: 'auto', showReticle: false });
  });

  it('ORRERY (desktop): shows the cursor, no steering reticle', () => {
    expect(pointerHudState({ regime: 'orrery', freeLook: false, isMobile: false }))
      .toEqual({ cursor: 'auto', showReticle: false });
    // free-look flag is irrelevant in ORRERY — never hides the cursor there.
    expect(pointerHudState({ regime: 'orrery', freeLook: true, isMobile: false }))
      .toEqual({ cursor: 'auto', showReticle: false });
  });

  it('mobile: NEVER hides the cursor (touch-only), in any regime / free-look', () => {
    for (const regime of ['helm', 'orrery']) {
      for (const freeLook of [false, true]) {
        expect(pointerHudState({ regime, freeLook, isMobile: true }).cursor).toBe('auto');
      }
    }
  });

  it('cursor is hidden IFF desktop HELM hands-on flight (the one steering sub-mode)', () => {
    // Exhaustive truth table: cursor 'none' only when helm && !freeLook && !mobile.
    for (const regime of ['helm', 'orrery']) {
      for (const freeLook of [false, true]) {
        for (const isMobile of [false, true]) {
          const hidden = pointerHudState({ regime, freeLook, isMobile }).cursor === 'none';
          expect(hidden).toBe(regime === 'helm' && !freeLook && !isMobile);
        }
      }
    }
  });

  it('showReticle is true IFF HELM hands-on flight (mobile irrelevant — touch has no steering reticle either)', () => {
    expect(pointerHudState({ regime: 'helm', freeLook: false, isMobile: false }).showReticle).toBe(true);
    expect(pointerHudState({ regime: 'helm', freeLook: true, isMobile: false }).showReticle).toBe(false);
    expect(pointerHudState({ regime: 'orrery', freeLook: false, isMobile: false }).showReticle).toBe(false);
  });
});
