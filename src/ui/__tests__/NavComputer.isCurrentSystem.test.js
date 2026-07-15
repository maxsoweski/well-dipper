// _isCurrentSystem gates BOTH the SYSTEM-view preview (actual spawned data vs
// generated preview, _renderSystem) and the commit classification (burn vs
// warp, _buildCommitAction). Its radius must mean "this marker IS the star I
// am parked at", not "a star near me": with the old 0.002 kpc (2 pc) radius,
// browsing Rigil Kentaurus (1.32 pc) from Sol showed Sol's 13-planet data as
// the "preview" and built a BURN action instead of a warp — the AC4
// preview-honesty violation caught live 2026-07-15.
//
// The correct tolerance is the codebase's canonical same-star radius
// POSITION_MATCH_TOL (0.1 pc) — also the F1 seed-identity bin, so "same
// system" here agrees with seed identity by construction. A same-system
// sibling marker inside that radius (Proxima browsed FROM Alpha Centauri,
// 0.055 pc) intentionally still reads as current: its arrival routes to the
// same spawned system, so the spawned data IS its honest preview.

import { describe, it, expect } from 'vitest';
import { NavComputer } from '../NavComputer.js';

function navAt(px, py, pz) {
  const nav = Object.create(NavComputer.prototype);
  nav._playerX = px;
  nav._playerY = py;
  nav._playerZ = pz;
  return nav;
}

describe('_isCurrentSystem — identity radius, not neighborhood radius', () => {
  it('the star the player is parked at IS current (delta ~ AU scale)', () => {
    const nav = navAt(8.0, 0.025, 0.0);
    nav._systemStar = { wx: 8.0, wy: 0.025, wz: 0.0000000005 }; // ~100 AU off
    expect(nav._isCurrentSystem()).toBe(true);
  });

  it('a browsed neighbor 1.32 pc away is NOT current (Rigil-from-Sol case)', () => {
    const nav = navAt(8.0, 0.025, 0.0);
    nav._systemStar = { wx: 8.0, wy: 0.025 + 0.00132, wz: 0.0 }; // 1.32 pc in kpc
    expect(nav._isCurrentSystem()).toBe(false);
  });

  it('a same-system sibling inside 0.1 pc IS current (Proxima-from-Alpha-Cen)', () => {
    const nav = navAt(8.0, 0.025, 0.0);
    nav._systemStar = { wx: 8.0, wy: 0.025 + 0.000055, wz: 0.0 }; // 0.055 pc
    expect(nav._isCurrentSystem()).toBe(true);
  });

  it('no selection → not current', () => {
    const nav = navAt(8.0, 0.025, 0.0);
    nav._systemStar = null;
    expect(nav._isCurrentSystem()).toBe(false);
  });
});
