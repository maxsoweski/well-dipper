/**
 * PanelPointer — lane F (cockpit-screen-content-2026-07-28), AC-PANEL-POINTER.
 *
 * Three defects this file exists to catch, none of which an asset check can see:
 *
 * 1. UPSIDE-DOWN SCREENS. On the Screen_* faces v = 0 is the TOP edge, so the
 *    mapping is y = v * height. The (1 - v) form is the reflex, it is wrong
 *    here, and it fails invisibly — the map still draws and still responds, it
 *    is simply inverted. So the mapping is checked at named corners, and the
 *    (1 - v) form is fed to the contract checker to prove the checker itself
 *    can fail.
 *
 * 2. THE DOM PATH. NavComputer._getCanvasPos scales by
 *    (canvas.width / rect.width) off getBoundingClientRect(). An offscreen
 *    panel canvas has no layout box, so rect.width is 0 and every coordinate
 *    comes back Infinity or NaN. The stub target's getBoundingClientRect
 *    THROWS. That is the load-bearing part of the fixture: it is not possible
 *    for the adapter to have taken the DOM path and for these tests to pass.
 *
 * 3. A DRAG THAT NEVER LETS GO. NavComputer._dragging is assigned in exactly
 *    three places — init false, true in _handleMouseDown, false in
 *    _handleMouseUp — so that last one is the only way back to false, which is
 *    why NavComputer binds it to 'mouseleave' as well as 'mouseup'. The ray
 *    missing the quad is the 3D 'mouseleave', and it must release EXACTLY once:
 *    zero leaves the map welded to the cursor, once-per-frame stamps on state
 *    the player has since re-grabbed.
 *
 * The whole battery runs at two different buffer sizes, both non-square and one
 * portrait, so nothing can pass by hard-coding a size and nothing can pass with
 * the two axes swapped.
 *
 * Lane E's describe.skipIf pattern is deliberately NOT copied here. Lane E
 * defends it with a separate gate test; a lane-F file that copied the skip
 * without the gate would go green on a deleted asset. The last test asserts
 * that over this file's own source.
 */
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  uvToPanelPixels,
  assertTopLeftOrigin,
  createPanelTexture,
  PanelPointerAdapter,
  PANEL_POINTER_EVENT,
} from '../PanelPointer.js';

const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * A NavComputer-shaped stub.
 *
 * The spies stand in for the three real handlers and, like the real ones,
 * _handleMouseDown/_handleMouseMove ask the target for the pointer position via
 * this._getCanvasPos(e). That is what exercises the override: whatever the
 * adapter installed is what the handlers see, exactly as NavComputer would see
 * it. _handleMouseUp takes no position, as in the real code.
 *
 * getBoundingClientRect throws rather than returning a zero rect, so a DOM-path
 * regression is an explosion naming itself instead of a silent Infinity.
 */
function makeNavComputerStub(bufferWidth, bufferHeight) {
  const seen = { down: [], move: [], rectCalls: 0 };

  const target = {
    _canvas: {
      width: bufferWidth,
      height: bufferHeight,
      getBoundingClientRect() {
        seen.rectCalls += 1;
        throw new Error(
          'getBoundingClientRect: this panel canvas has no layout box. Reaching ' +
          'for it means the adapter took the DOM path, where rect.width is 0 and ' +
          'every coordinate becomes Infinity or NaN.',
        );
      },
    },
  };

  target._handleMouseDown = vi.fn((e) => { seen.down.push({ e, pos: target._getCanvasPos(e) }); });
  target._handleMouseMove = vi.fn((e) => { seen.move.push({ e, pos: target._getCanvasPos(e) }); });
  target._handleMouseUp = vi.fn();

  return { target, seen };
}

/** A fabricated raycast intersection: three hands uv back as a Vector2-ish {x, y}. */
const hitAt = (u, v) => ({ uv: { x: u, y: v } });

/** The defect this module is shaped around: the OpenGL-reflex flipped mapping. */
const flippedMapping = (uv, size) => ({
  x: uv.x * size.width,
  y: (1 - uv.y) * size.height,
});

// Two sizes, deliberately unlike each other: one landscape, one portrait, and
// no shared factor between the four numbers, so a hard-coded dimension or a
// swapped axis cannot survive both passes.
const SIZES = [
  { width: 512, height: 256 },
  { width: 300, height: 900 },
];

for (const size of SIZES) {
  const { width: W, height: H } = size;

  describe(`PanelPointer at ${W}x${H} (AC-PANEL-POINTER)`, () => {
    it('maps uv to panel pixels with v = 0 at the TOP, not the bottom', () => {
      // The four fabricated hits from the spec. (0, 0) → (0, 0) is the one that
      // separates the two conventions: under (1 - v) it would be (0, H).
      expect(uvToPanelPixels({ x: 0, y: 0 }, size)).toEqual({ x: 0, y: 0 });
      expect(uvToPanelPixels({ x: 1, y: 0 }, size)).toEqual({ x: W, y: 0 });
      expect(uvToPanelPixels({ x: 0, y: 1 }, size)).toEqual({ x: 0, y: H });
      expect(uvToPanelPixels({ x: 0.25, y: 0.75 }, size))
        .toEqual({ x: 0.25 * W, y: 0.75 * H });

      // {u, v} spelling is accepted too — hand-written fixtures say u/v, three
      // says x/y, and insisting on one only buys a silent NaN from the other.
      expect(uvToPanelPixels({ u: 0.25, v: 0.75 }, size))
        .toEqual({ x: 0.25 * W, y: 0.75 * H });
    });

    it('accepts the real mapping and REJECTS the (1 - v) form', () => {
      // The negative half is the point. A contract checker that cannot fail
      // blesses whatever it is given, so it is fed the exact defect it exists
      // to catch and required to throw.
      expect(() => assertTopLeftOrigin(uvToPanelPixels, size)).not.toThrow();
      expect(() => assertTopLeftOrigin(flippedMapping, size)).toThrow(/UPSIDE DOWN/);
      expect(() => assertTopLeftOrigin(flippedMapping, size)).toThrow(/TOP edge/);
    });

    it('delivers panel pixels to the handlers WITHOUT touching the DOM', () => {
      const { target, seen } = makeNavComputerStub(W, H);
      const adapter = new PanelPointerAdapter(target);

      for (const [u, v] of [[0, 0], [1, 0], [0, 1], [0.25, 0.75]]) {
        adapter.pointerDown(hitAt(u, v));
        adapter.pointerUp(hitAt(u, v));
      }

      expect(seen.down.map((d) => d.pos)).toEqual([
        { x: 0, y: 0 },
        { x: W, y: 0 },
        { x: 0, y: H },
        { x: 0.25 * W, y: 0.75 * H },
      ]);

      // The load-bearing assertion. The stub's rect getter throws, so a DOM-path
      // adapter could not have got this far — but assert the count anyway, so the
      // reason this fixture is shaped the way it is stays visible.
      expect(seen.rectCalls).toBe(0);

      // And no clientX/clientY was fabricated: the synthetic event carries no
      // client coordinates at all, so a handler that starts reading them fails
      // loudly rather than working off a plausible wrong number.
      for (const d of seen.down) {
        expect(d.e).toBe(PANEL_POINTER_EVENT);
        expect(d.e).not.toHaveProperty('clientX');
        expect(d.e).not.toHaveProperty('clientY');
      }
    });

    it('the override is an own property, and detach puts the prototype back', () => {
      // Assigning to the instance shadows the prototype method — that is the
      // whole mechanism, so it is asserted rather than assumed.
      const proto = { _getCanvasPos() { throw new Error('prototype _getCanvasPos ran'); } };
      const { target } = makeNavComputerStub(W, H);
      Object.setPrototypeOf(target, proto);

      const adapter = new PanelPointerAdapter(target);
      expect(Object.prototype.hasOwnProperty.call(target, '_getCanvasPos')).toBe(true);

      adapter.pointerDown(hitAt(0.25, 0.75));
      expect(target._handleMouseDown).toHaveBeenCalledTimes(1);

      adapter.detach();
      expect(Object.prototype.hasOwnProperty.call(target, '_getCanvasPos')).toBe(false);
      expect(() => target._getCanvasPos({})).toThrow(/prototype/);
    });

    it('releases the drag EXACTLY once when the ray slides off the quad', () => {
      const { target, seen } = makeNavComputerStub(W, H);
      const adapter = new PanelPointerAdapter(target);

      adapter.pointerDown(hitAt(0.25, 0.75));
      expect(target._handleMouseDown).toHaveBeenCalledTimes(1);
      expect(target._handleMouseUp).not.toHaveBeenCalled();

      adapter.pointerMove(hitAt(0.5, 0.5));
      expect(target._handleMouseMove).toHaveBeenCalledTimes(1);
      expect(seen.move[0].pos).toEqual({ x: 0.5 * W, y: 0.5 * H });
      expect(target._handleMouseUp).not.toHaveBeenCalled();

      // The ray misses. This is the 3D 'mouseleave', and _handleMouseUp is the
      // only writer that returns _dragging to false.
      const released = adapter.pointerMove(null);
      expect(released).toBe(true);
      expect(target._handleMouseUp).toHaveBeenCalledTimes(1);

      // Still missing, frame after frame. Once, not once per frame.
      adapter.pointerMove(null);
      adapter.pointerMove(null);
      adapter.pointerMove(undefined);
      expect(target._handleMouseUp).toHaveBeenCalledTimes(1);

      // A real button-up after the miss must not double-release either.
      adapter.pointerUp(hitAt(0.25, 0.75));
      expect(target._handleMouseUp).toHaveBeenCalledTimes(1);

      // Not one move was delivered for a miss — a miss is not a position.
      expect(target._handleMouseMove).toHaveBeenCalledTimes(1);
      expect(seen.rectCalls).toBe(0);
    });

    it('still releases when the button comes up over a BROKEN buffer', () => {
      // The back door into "the map is welded to the cursor". _place throws by
      // design — a canvas re-created at a new resolution reports width 0 until it
      // is sized, and that is a whole frame during which the player can let go of
      // the button. If pointerUp updates the position before it releases, that
      // throw carries the release away with it: _dragging is never returned to
      // false, and since _handleMouseUp is the ONLY writer that clears it, the
      // map pans forever after. The throw must still happen — a zero buffer is a
      // real fault and must stay loud — but it must not take the release with it.
      const { target } = makeNavComputerStub(W, H);
      const adapter = new PanelPointerAdapter(target);

      adapter.pointerDown(hitAt(0.25, 0.75));
      expect(adapter.isPressed).toBe(true);

      target._canvas.width = 0;
      expect(() => adapter.pointerUp(hitAt(0.25, 0.75))).toThrow(/positive and finite/);

      expect(target._handleMouseUp).toHaveBeenCalledTimes(1);
      expect(adapter.isPressed).toBe(false);

      // And the same for the uv-less hit, the other way _place throws.
      const second = makeNavComputerStub(W, H);
      const adapter2 = new PanelPointerAdapter(second.target);
      adapter2.pointerDown(hitAt(0.5, 0.5));
      expect(() => adapter2.pointerUp({ distance: 1 })).toThrow(/no uv/);
      expect(second.target._handleMouseUp).toHaveBeenCalledTimes(1);
      expect(adapter2.isPressed).toBe(false);
    });

    it('does not release when nothing was ever pressed', () => {
      // Hovering off the edge with no button down is not a release. Firing one
      // anyway would clear state the player never asked to let go of.
      const { target } = makeNavComputerStub(W, H);
      const adapter = new PanelPointerAdapter(target);

      adapter.pointerMove(hitAt(0.5, 0.5));
      adapter.pointerMove(null);
      adapter.pointerUp(null);

      expect(target._handleMouseUp).not.toHaveBeenCalled();
      expect(adapter.isPressed).toBe(false);
    });

    it('a press that misses the screens starts no drag to owe a release for', () => {
      const { target } = makeNavComputerStub(W, H);
      const adapter = new PanelPointerAdapter(target);

      expect(adapter.pointerDown(null)).toBe(false);
      expect(target._handleMouseDown).not.toHaveBeenCalled();
      expect(adapter.pointerMove(null)).toBe(false);
      expect(target._handleMouseUp).not.toHaveBeenCalled();
    });

    it('reads the buffer size fresh, so a resized panel keeps pointing straight', () => {
      // Caching the size at construction is the drift bug: the error is
      // proportional and grows toward the far corner, so it reads as "the
      // cursor wanders" rather than as anything with a cause.
      const { target, seen } = makeNavComputerStub(W, H);
      const adapter = new PanelPointerAdapter(target);

      adapter.pointerDown(hitAt(1, 1));
      target._canvas.width = W * 2;
      target._canvas.height = H * 3;
      adapter.pointerMove(hitAt(1, 1));

      expect(seen.down[0].pos).toEqual({ x: W, y: H });
      expect(seen.move[0].pos).toEqual({ x: W * 2, y: H * 3 });
    });

    it('fails loudly on a zero-sized buffer instead of emitting Infinity', () => {
      // Zero is the exact value an unlaid-out canvas reports, and the exact
      // value that makes the DOM path's scale factor Infinity. If it reaches
      // this module it must stop here with a message.
      const { target } = makeNavComputerStub(W, H);
      const adapter = new PanelPointerAdapter(target);
      target._canvas.width = 0;

      expect(() => adapter.pointerDown(hitAt(0.5, 0.5))).toThrow(/positive and finite/);
      expect(() => uvToPanelPixels({ x: 0.5, y: 0.5 }, { width: W, height: 0 }))
        .toThrow(/positive and finite/);
    });

    it('fails loudly when the hit geometry carries no uv', () => {
      // three leaves Intersection.uv undefined when the mesh has no uv
      // attribute. Four NaNs would park the cursor silently.
      const { target } = makeNavComputerStub(W, H);
      const adapter = new PanelPointerAdapter(target);

      expect(() => adapter.pointerDown({ distance: 1 })).toThrow(/no uv/);
      expect(() => uvToPanelPixels({ x: NaN, y: 0 }, size)).toThrow(/finite/);
    });

    it('builds panel textures with flipY false — the other half of the convention', () => {
      // three defaults flipY to true, so omitting the line does not leave it
      // "unset", it actively inverts the image. Texture and pointer have to
      // agree about which edge v = 0 is; flipping one to fix the other just
      // moves the bug from the picture to the cursor.
      const stubImage = { width: W, height: H };
      const texture = createPanelTexture(stubImage);

      expect(texture.flipY).toBe(false);
      expect(texture.image).toBe(stubImage);
      expect(texture.isTexture).toBe(true);

      expect(() => createPanelTexture(undefined)).toThrow(/width and height/);
      expect(() => createPanelTexture({ width: W })).toThrow(/width and height/);
    });

    it('refuses a target that is not NavComputer-shaped', () => {
      // Silently adapting to an object with no handlers produces a panel that
      // looks merely unresponsive, which is the hardest failure to diagnose.
      expect(() => new PanelPointerAdapter(null)).toThrow(/needs a target/);
      expect(() => new PanelPointerAdapter({ _canvas: { width: W, height: H } }))
        .toThrow(/_handleMouseDown/);
    });
  });
}

describe('PanelPointer test hygiene', () => {
  it('contains no skip helper, so a missing dependency can never make it green', () => {
    // Comments stripped first: this file DISCUSSES lane E's skipIf in its
    // header, and the pattern is assembled from fragments because a literal one
    // would match itself. Either would fail a file that is in fact clean. The
    // check is about code, not prose.
    const code = readFileSync(join(HERE, 'PanelPointer.test.js'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    const skip = new RegExp(['describe', 'it', 'test'].map((k) => k + '\\.skip').join('|'));
    expect(skip.test(code)).toBe(false);
  });

  it('ran the whole battery at two different buffer sizes', () => {
    // Guards the guard: if SIZES is ever trimmed to one entry, every test above
    // could start passing on a hard-coded dimension again.
    expect(SIZES.length).toBeGreaterThanOrEqual(2);
    expect(new Set(SIZES.map((s) => s.width)).size).toBe(SIZES.length);
    expect(new Set(SIZES.map((s) => s.height)).size).toBe(SIZES.length);
    for (const s of SIZES) expect(s.width).not.toBe(s.height);
  });
});
