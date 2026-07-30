/**
 * PanelPointer — THE HOVER CHANNEL.
 *
 * Lane F, workstream `cockpit-zoom-to-panel-2026-07-29`. Max, at increment 6 UAT:
 * *"interacting with the nav computer is something unresponsive; what seems to fix
 * it is if i press and hold the mouse button for some reason."*
 *
 * ── THE ROOT CAUSE, AND WHY "PRESS AND HOLD" IS THE TELL ────────────────────
 *
 * NavComputer resolves most clicks through HOVER STATE, not through the click
 * position. `_handleClick` consults `_hoveredBody` for planets, moons and stars
 * at SYSTEM, `_hoveredLocalStar` for a star at PRISM, and `_hoveredTile` for a
 * galaxy sector or a grid tile. Only the rect-based targets — the level tab
 * strip, the autopilot button, COMMIT, the far-companion chips — are resolved
 * from the click's own coordinates.
 *
 * And that hover state is computed INSIDE THE RENDER, by comparing each body's
 * freshly projected position against `this._mouseX` / `this._mouseY`. Those two
 * numbers are written in exactly one place: `_handleMouseMove`.
 *
 * A DOM canvas gets `mousemove` continuously with no button down, so `_mouseX`/
 * `_mouseY` are always live and every frame re-resolves what the cursor is over.
 * THAT INVARIANT WAS NOT PORTED. `cockpit-screens-lab.html` forwarded
 * `pointermove` into the adapter only while `panelDrag` was true — that is, only
 * while the primary button was held. With the button up, moving across the glass
 * told the nav computer nothing at all, so at click time hover still reflected
 * wherever the pointer had last been while pressed, or `(0, 0)` — the panel's
 * top-left corner — on a fresh page.
 *
 * So: a quick click resolved against a stale hover and read as empty space. A
 * press-and-hold made `panelDrag` true, the smallest jitter forwarded a move,
 * the next drawn frame resolved hover under the cursor, and the release then
 * found a body. The hold was not fixing a timing problem; it was manufacturing
 * the missing move.
 *
 * ⭐ THE SAME MISSING CHANNEL EXPLAINS A SYMPTOM MAX HAD NOT REACHED YET. At
 * SECTOR and REGION, `_hoveredTile` is set in `_handleMouseMove`'s NON-dragging
 * branch, after `if (this._dragging) return`. During a hold `_dragging` is true,
 * so that branch never runs — meaning those grid tiles could not be clicked even
 * WITH the workaround. One channel closes every case, which is the evidence that
 * this is the cause and not a symptom that happens to respond to the fix.
 *
 * ⚠ THE CONTROL IS THE POINT OF THIS FILE. `noHoverForward` below performs the
 * identical press-and-release and asserts NOTHING is selected. Without it, every
 * test here would pass against an adapter that forwarded a click twice and never
 * hovered at all — the press/release pair alone looks like it ought to work, and
 * that appearance is exactly what cost the increment its UAT.
 */
import { describe, it, expect } from 'vitest';
import { PanelPointerAdapter } from '../PanelPointer.js';
import {
  makeHeadlessNav, fakeStar, hoverAt, findHoverPoint,
} from '../../ui/__tests__/helpers/headlessNav.mjs';

/** A raycast hit carrying the uv of a given pixel of the panel's own buffer. */
function hitAtPixel(nav, x, y) {
  return { uv: { u: x / nav._canvas.width, v: y / nav._canvas.height } };
}

const A_PLANET = (hb) => hb.type === 'planet';

/**
 * A nav computer open on a populated system, a planet located, the cursor parked.
 *
 * ⚠ THE ORDER HERE IS LOAD-BEARING, AND GETTING IT WRONG COSTS THE WHOLE FILE.
 * `PanelPointerAdapter`'s constructor OVERRIDES `_getCanvasPos` on the instance —
 * that is its entire reason for existing, since a panel canvas has no layout box.
 * The harness's `hoverAt` drives the DOM path, passing clientX/clientY for the
 * class to convert. Once the adapter is attached that conversion is gone: every
 * probe reads the adapter's parked `_pos` instead of the point it asked for. So
 * the sweep silently probes (0, 0) 3,500 times and reports that the system has no
 * planets in it. Measured, first run of this file.
 *
 * Therefore: FIND and PARK on the DOM path, THEN attach. This is the same rule as
 * the workstream's "an instrument cannot be its own control" — here the thing
 * under test disables the instrument rather than agreeing with it.
 *
 * `openToCurrentSystem` is the route a player takes; the state is not assigned
 * into. The render is required before anything can be hovered, because the
 * bodies' screen positions do not exist until a frame has projected them.
 *
 * Parking at the top-left is the state a fresh page is in — `_mouseX`/`_mouseY`
 * are initialised to 0 — and every test needs it because `findHoverPoint` leaves
 * the hover it found LIVE. Without the park, a test would be asserting against a
 * hover the sweep established rather than one the adapter delivered.
 */
async function openSystemAndFindPlanet() {
  const { nav } = await makeHeadlessNav();
  nav.openToCurrentSystem(fakeStar());
  nav.render();

  // ⚠ WHY THE OBSERVABLE BELOW IS `_systemMode`/`_selectedPlanetIdx` AND NOT
  // `_selectedBody`. Measured, not assumed: the fixture star resolves to a
  // FOREIGN system, and `_handleClick`'s foreign arm drills a clicked planet in
  // for INFO — it deliberately does not re-select the burn target. Meanwhile
  // `openToCurrentSystem` has ALREADY set `_selectedBody` to `{type:'star'}`. So
  // "did the click select the planet" is unanswerable through `_selectedBody`
  // here: it is a star before the click and a star after, and a test asserting it
  // becomes null passes when the click lands on empty space too. The first draft
  // of this file made exactly that mistake in both directions at once.
  if (nav._isCurrentSystem()) {
    throw new Error('the fixture system is now the CURRENT system; the click routes below change arm and the observables with them');
  }

  const found = findHoverPoint(nav, A_PLANET);
  if (!found) throw new Error('no point on the panel hovers a planet — the fixture system or the class stopped cooperating');

  const parked = hoverAt(nav, 0, 0);
  if (parked) throw new Error(`the panel's top-left corner hovers a ${parked.type}; this file's premise is that it is empty`);

  const adapter = new PanelPointerAdapter(nav); // ← only now
  return { nav, adapter, found };
}

describe('PanelPointerAdapter — the hover channel', () => {
  it('CONTROL: press and release on a planet does nothing without a hover forward', async () => {
    const { nav, adapter, found } = await openSystemAndFindPlanet();
    expect(nav._systemMode).toBe('system');

    const hit = hitAtPixel(nav, found.x, found.y);
    adapter.pointerDown(hit);
    adapter.pointerUp(hit);

    // The bug, stated as an assertion. This is what Max's quick clicks did: the
    // press and the release both landed on the planet and the panel did not move.
    expect(nav._systemMode, 'the drill-in happened with no hover forwarded, so this file has no control').toBe('system');
  });

  it('a hover forward, then a frame, then the same press and release drills into the planet', async () => {
    const { nav, adapter, found } = await openSystemAndFindPlanet();

    const hit = hitAtPixel(nav, found.x, found.y);
    adapter.pointerHover(hit);
    nav.render(); // the frame is what resolves hover — see the header
    const hovered = nav._hoveredBody;
    expect(hovered, 'the hover forward did not reach the class').toBeTruthy();

    adapter.pointerDown(hit);
    adapter.pointerUp(hit);

    expect(nav._systemMode).toBe('planet');
    // The INDEX, not just the mode: this is what proves the click acted on the
    // body the frame resolved rather than on some other one that happened to
    // drill. A mode check alone passes if the click lands on any planet at all.
    expect(nav._selectedPlanetIdx).toBe(hovered.index);
  });

  it('a hover forward neither presses nor releases', async () => {
    const { nav, adapter, found } = await openSystemAndFindPlanet();

    adapter.pointerHover(hitAtPixel(nav, found.x, found.y));

    // Wiring hover through the press path would start a drag the panel then owes
    // a release for, and the map would pan under a button nobody is holding.
    expect(adapter.isPressed).toBe(false);
    expect(nav._dragging).toBe(false);
  });

  it('a hover that misses the glass clears the hover it left behind', async () => {
    const { nav, adapter, found } = await openSystemAndFindPlanet();

    adapter.pointerHover(hitAtPixel(nav, found.x, found.y));
    nav.render();
    expect(nav._hoveredBody).toBeTruthy();

    adapter.pointerHover(null);
    nav.render();

    // Left set, the tooltip stays lit on a body the cursor has left, and a click
    // that lands on the glass but not on a body acts on the stale one.
    expect(nav._hoveredBody).toBeNull();
  });

  it('the off-glass park clears a body drawn in the very corner', async () => {
    // A sentinel of -1 is NOT far enough: the class's planet hit radius is 14 px,
    // so a body projected near (0, 0) is still within reach of (-1, -1) and stays
    // hovered. The park has to exceed every hit radius the class uses.
    const { nav, adapter } = await openSystemAndFindPlanet();
    adapter.pointerHover(null);
    const p = nav._getCanvasPos({});
    expect(Math.hypot(p.x, p.y)).toBeGreaterThan(100);
  });

  it('an unpressed hover resolves a grid tile, which a held drag cannot', async () => {
    // The prediction that shows the diagnosis is the cause: at SECTOR level
    // `_hoveredTile` is set only in the non-dragging branch of _handleMouseMove,
    // so press-and-hold — the workaround that rescued every other level — never
    // reached it. One channel, every case.
    const { nav, adapter } = await openSystemAndFindPlanet();
    nav._levelIndex = 1; // SECTOR. Assigned deliberately: the drill route is
    // NavComputer's business and under test elsewhere; what is under test here
    // is which branch of the move handler a hover versus a drag reaches.
    const mid = hitAtPixel(nav, nav._canvas.width / 2, nav._canvas.height / 2);

    adapter.pointerHover(mid);
    expect(nav._hoveredTile, 'an unpressed hover did not resolve a tile').toBeTruthy();

    nav._hoveredTile = null;
    adapter.pointerDown(mid);
    adapter.pointerMove(mid);
    expect(nav._hoveredTile, 'a held drag resolved a tile, so the premise above is wrong').toBeNull();
  });
});
