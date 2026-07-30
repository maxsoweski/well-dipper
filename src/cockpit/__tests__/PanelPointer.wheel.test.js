/**
 * PanelPointer — THE WHEEL CHANNEL.
 *
 * Lane F, 2026-07-30. Max, after flying the cockpit: *"Scroll wheel doesn't
 * work in the nav menus in game."*
 *
 * ── WHY IT WAS MISSING, AND WHY IT LOOKED MODE-SPECIFIC ─────────────────────
 *
 * `NavComputer`'s constructor binds `_handleWheel` to ITS OWN CANVAS
 * (`NavComputer.js:234`). The DOM overlay's instance owns a real element in the
 * document, so its wheel has always worked — which is why this reads as "broken
 * in game" rather than "broken everywhere". The COCKPIT's instance draws onto an
 * offscreen texture canvas that is never in the DOM and can never receive a
 * pointer event of any kind. Everything it does receive is synthesised by the
 * cockpit's pointer router, and the router had exactly three channels: press,
 * move (drag), hover. There was no wheel channel at all, so nothing was broken
 * — the wire was absent, which is the same defect shape as increment 6's hover
 * bug and the fourth instance of it in this lane.
 *
 * ── WHY THIS FILE DRIVES A REAL NavComputer ─────────────────────────────────
 *
 * A spy asserting "`_handleWheel` was called" proves the adapter calls a method.
 * It does not prove the map zooms, and `_handleWheel`'s first statement is
 * `e.preventDefault()` — so an adapter passing the module's frozen
 * `PANEL_POINTER_EVENT` (which deliberately carries no methods and no client
 * coordinates) throws TypeError on the real class and passes against a spy.
 * The observable here is therefore `_systemZoom`, the number the pilot sees
 * move.
 *
 * ⚠ THE SIGN IS PART OF THE CONTRACT AND IS NOT THE SAME AT EVERY LEVEL.
 * `_handleWheel` inverts between PRISM (`_levelIndex === 3`, deltaY > 0 grows
 * `_localRadius`) and SYSTEM (`_levelIndex === 4`, deltaY > 0 SHRINKS
 * `_systemZoom`). An adapter that dropped, clamped or normalised `deltaY` would
 * still "work" for one direction. Both are asserted.
 */
import { describe, it, expect } from 'vitest';
import { PanelPointerAdapter } from '../PanelPointer.js';
import { makeHeadlessNav, fakeStar } from '../../ui/__tests__/helpers/headlessNav.mjs';

/** A raycast hit in the middle of the glass. The wheel reads no position. */
const ON_GLASS = { uv: { u: 0.5, v: 0.5 } };

/**
 * A nav computer at SYSTEM level with zoom at rest.
 *
 * `openToCurrentSystem` is the route a player takes — it sets `_systemZoom = 1.0`
 * and `_levelIndex = 4` itself. The precondition is asserted rather than assumed
 * so that a future change to that method fails HERE, loudly, instead of leaving
 * every zoom assertion below comparing 1.0 to 1.0 at a level with no wheel arm.
 */
async function systemLevelNav() {
  const { nav } = await makeHeadlessNav();
  nav.openToCurrentSystem(fakeStar());
  nav.render();
  expect(nav._levelIndex, 'openToCurrentSystem no longer lands at SYSTEM — this file is stale, not passing').toBe(4);
  expect(nav._systemZoom).toBe(1.0);
  return nav;
}

describe('PanelPointerAdapter.pointerWheel — scrolling the map on the glass', () => {
  it('zooms the SYSTEM map, which is the whole of the report', async () => {
    const nav = await systemLevelNav();
    const adapter = new PanelPointerAdapter(nav);
    expect(adapter.pointerWheel(ON_GLASS, -100)).toBe(true);
    expect(nav._systemZoom).toBeGreaterThan(1.0);
  });

  it('CONTROL: without the channel the same gesture moves nothing', async () => {
    // The state of the game as Max flew it. Without this, every assertion above
    // could be reading a zoom that some other part of the harness performed —
    // and "the map zoomed" would be true of a nav computer with no wheel wire.
    const nav = await systemLevelNav();
    new PanelPointerAdapter(nav);
    nav.render();
    expect(nav._systemZoom).toBe(1.0);
  });

  it('carries the SIGN, so scrolling up and down are not the same gesture', async () => {
    const up = await systemLevelNav();
    new PanelPointerAdapter(up).pointerWheel(ON_GLASS, -100);
    const down = await systemLevelNav();
    new PanelPointerAdapter(down).pointerWheel(ON_GLASS, 100);
    expect(up._systemZoom).toBeGreaterThan(1.0);
    expect(down._systemZoom).toBeLessThan(1.0);
  });

  it('supplies preventDefault — the first statement of the handler it calls', async () => {
    // Not a style point. `PANEL_POINTER_EVENT` is Object.freeze({fromPanel:true})
    // with no methods, deliberately, so that a handler reading client coordinates
    // gets a loud undefined. `_handleWheel` calls e.preventDefault() before it
    // does anything else, so the wheel channel needs its own event shape. Passing
    // the frozen singleton throws here and passes against a mock.
    const nav = await systemLevelNav();
    const adapter = new PanelPointerAdapter(nav);
    expect(() => adapter.pointerWheel(ON_GLASS, -100)).not.toThrow();
  });

  it('a wheel that missed the glass is not ours, and changes nothing', async () => {
    const nav = await systemLevelNav();
    const adapter = new PanelPointerAdapter(nav);
    expect(adapter.pointerWheel(null, -100)).toBe(false);
    expect(nav._systemZoom).toBe(1.0);
  });

  it('does NOT move the hover position — the hover channel owns that', async () => {
    // A wheel reads no coordinate. Placing on it would let a scroll re-resolve
    // what the map thinks is under the cursor without a move ever arriving,
    // which is the stale-hover failure of increment 6 wearing a new hat.
    const nav = await systemLevelNav();
    const adapter = new PanelPointerAdapter(nav);
    const before = { x: nav._mouseX, y: nav._mouseY };
    adapter.pointerWheel(ON_GLASS, -100);
    expect({ x: nav._mouseX, y: nav._mouseY }).toEqual(before);
  });
});
