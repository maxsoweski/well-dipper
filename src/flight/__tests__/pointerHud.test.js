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
import { pointerHudState, aimPoint } from '../flightModes.js';

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

// The AIM POINT — where the targeting hover is sampled, BY whether the OS cursor
// is hidden (§targeting-brackets-contextual-eta-design Unit 1). It pairs with
// pointerHudState by construction: `cursorHidden` is exactly
// `pointerHudState(...).cursor === 'none'` (desktop HELM hands-on).
//   - cursor hidden  → aim = the fixed CENTER reticle (you aim by FLYING a body
//                      across screen-center; the mouse is the virtual joystick,
//                      not an aim).
//   - cursor visible → aim = the MOUSE position (ORRERY / HELM free-look / mobile
//                      — hover follows the pointer exactly as today).
describe('aimPoint — targeting aim source by cursor visibility (pure)', () => {
  it('cursor hidden (HELM hands-on): aim = the center reticle, ignoring the mouse', () => {
    const p = aimPoint({ cursorHidden: true, mouseX: 17, mouseY: 23, centerX: 960, centerY: 540 });
    expect(p).toEqual({ x: 960, y: 540 });
  });

  it('cursor visible (ORRERY / free-look / mobile): aim = the mouse position', () => {
    const p = aimPoint({ cursorHidden: false, mouseX: 17, mouseY: 23, centerX: 960, centerY: 540 });
    expect(p).toEqual({ x: 17, y: 23 });
  });

  it('stays consistent with pointerHudState: hidden IFF desktop HELM hands-on → center; else mouse', () => {
    for (const regime of ['helm', 'orrery']) {
      for (const freeLook of [false, true]) {
        for (const isMobile of [false, true]) {
          const cursorHidden = pointerHudState({ regime, freeLook, isMobile }).cursor === 'none';
          const p = aimPoint({ cursorHidden, mouseX: 5, mouseY: 6, centerX: 100, centerY: 200 });
          expect(p).toEqual(cursorHidden ? { x: 100, y: 200 } : { x: 5, y: 6 });
        }
      }
    }
  });
});
