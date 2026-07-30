/**
 * PanelPointer — turning "the player is pointing at that screen" into
 * "the nav map believes the mouse is at pixel (x, y) of its own canvas".
 *
 * Lane F, workstream `cockpit-screen-content-2026-07-28`, AC-PANEL-POINTER.
 *
 * The four cockpit screens are 3D quads. Pointing at one produces a raycast
 * intersection carrying a uv coordinate on that face. Everything the panels
 * draw — NavComputer above all — was written for a flat DOM canvas that gets
 * real mouse events. This module is the whole of the joint between those two
 * worlds, and there are exactly three ways to get it wrong. All three are
 * defended here, and each is worth stating plainly because each produces a
 * different flavour of "it looks broken and nobody can say why".
 *
 * 1. THE VERTICAL AXIS. On these Screen_* faces v = 0 is the TOP edge — the
 *    model is authored y-down, glTF style. So the mapping is
 *
 *        x = u * width        y = v * height
 *
 *    and NOT the (1 - v) form that half a lifetime of OpenGL habit reaches for
 *    first. Get it wrong and the screens come out UPSIDE DOWN: the map still
 *    draws, the pointer still moves, everything still "works", and the picture
 *    is simply inverted. No asset check can catch that — the GLB is fine either
 *    way. Only a mapping test catches it, which is why `assertTopLeftOrigin`
 *    exists as a real exported contract rather than a comment.
 *
 *    The matching half of the same convention lives in `createPanelTexture`:
 *    textures over these panels are built with flipY = false. The two halves
 *    have to agree. If someone "fixes" an upside-down screen by flipping the
 *    texture, the picture rights itself and the POINTER goes upside down
 *    instead, which is a far nastier bug to chase. Change both or neither.
 *
 * 2. THE DOM PATH MUST NEVER BE TAKEN. NavComputer._getCanvasPos does
 *
 *        (e.clientX - rect.left) * (this._canvas.width / rect.width)
 *
 *    off getBoundingClientRect(). A panel canvas is offscreen — it has no
 *    layout box — so rect.width is 0, that factor is Infinity, and every
 *    coordinate it hands back is Infinity or NaN. So this adapter does NOT
 *    synthesise clientX/clientY onto a fake event and let NavComputer do the
 *    arithmetic. It OVERRIDES `_getCanvasPos` on the instance (an own property
 *    shadows the prototype method) so the already-correct panel pixels are
 *    handed straight back. The synthetic event we pass carries no client
 *    coordinates at all, deliberately: if some future handler starts reading
 *    them we want an immediate loud `undefined`, not a plausible-looking wrong
 *    number.
 *
 * 3. THE DRAG MUST LET GO. NavComputer._dragging is written in exactly three
 *    places — initialised false, set true in _handleMouseDown, cleared false in
 *    _handleMouseUp. That last one is the ONLY route back to false, which is
 *    why NavComputer's own constructor binds the same handler to both 'mouseup'
 *    and 'mouseleave': sliding out of the canvas has always had to count as a
 *    release. The 3D equivalent of leaving the canvas is the ray missing the
 *    quad, and it has to be honoured the same way, or the map stays welded to
 *    the cursor and pans forever. It must fire EXACTLY once, too: this is
 *    driven per frame, so a ray that keeps missing would otherwise re-release
 *    sixty times a second and stamp on state the player has since re-grabbed.
 *    The adapter tracks that with its own flag rather than reading the target's
 *    private `_dragging`, so the once-only guarantee belongs to the adapter and
 *    holds against any target shaped like NavComputer.
 *
 * 4. THE POINTER MUST REPORT ITSELF WITH NO BUTTON DOWN. This one was missed
 *    until Max hit it at increment 6 UAT: *"interacting with the nav computer is
 *    something unresponsive; what seems to fix it is if i press and hold the
 *    mouse button."* NavComputer resolves body clicks from HOVER state, and that
 *    state is recomputed inside every render by testing each body's freshly
 *    projected position against `_mouseX`/`_mouseY` — which only
 *    `_handleMouseMove` writes. A DOM canvas receives `mousemove` continuously
 *    with the button up, so hover is always current; a panel receives nothing
 *    unless someone forwards it. Forward only the pressed moves and a quick click
 *    resolves against a stale hover and reads as empty space, while press-and-hold
 *    appears to "fix" it — because the hold is what manufactures the missing move.
 *    `pointerHover` is that channel. See `PanelPointer.hover.test.js`.
 *
 * Deliberate non-goal: wheel/zoom. Press, drag, release, click and hover are what
 * the panel path now owns; a wheel wants its own decision about what scrolling a
 * screen from the pilot seat means and should not be smuggled in here untested.
 *
 * Panel dimensions are never written down. Buffer size comes from the target's
 * own canvas at the moment of the event, so a resized panel keeps working —
 * reading it once at construction is a stale-size bug waiting for the first
 * resolution change.
 */
import { CanvasTexture, LinearFilter, SRGBColorSpace } from 'three';

/**
 * The event object handed to the target's handlers.
 *
 * Frozen and empty of coordinates on purpose — see note 2 above. `fromPanel`
 * is there so anything downstream that needs to know can ask, and so a stray
 * `{}` in a stack trace is identifiable.
 */
export const PANEL_POINTER_EVENT = Object.freeze({ fromPanel: true });

/**
 * Where the pointer is parked when the ray misses the glass.
 *
 * Far enough that every proximity test in the target fails — see `pointerHover`
 * for why -1 is not, and why this is a distance rather than "just outside".
 */
const OFF_GLASS = -1e4;

/** Coordinate comparison with a little slack, for the contract checks below. */
function sameCoord(got, want) {
  return Math.abs(got - want) <= 1e-6 * Math.max(1, Math.abs(want));
}

/**
 * Pull the uv out of whatever we were handed.
 *
 * three's Intersection carries `.uv` as a Vector2, so `{ x, y }`; prose and
 * hand-written fixtures naturally say `{ u, v }`. Both are accepted because
 * insisting on one spelling only buys a silent NaN when the other shows up.
 *
 * A three raycast returns uv === undefined when the geometry has no uv
 * attribute at all — an easy state to end up in if a screen quad is ever
 * rebuilt without UVs. That has to be a named failure, not four NaNs quietly
 * parking the cursor in the corner.
 */
function readUv(uv, where) {
  if (!uv) {
    throw new Error(
      `${where}: the intersection carries no uv. A three raycast leaves uv ` +
      `undefined when the hit geometry has no uv attribute — the screen quad ` +
      `needs UVs before it can be pointed at.`,
    );
  }
  const u = uv.u !== undefined ? uv.u : uv.x;
  const v = uv.v !== undefined ? uv.v : uv.y;
  if (!Number.isFinite(u) || !Number.isFinite(v)) {
    throw new Error(`${where}: uv is not a pair of finite numbers (got u=${u}, v=${v}).`);
  }
  return { u, v };
}

/**
 * Validate a buffer size, loudly.
 *
 * Zero is the specific value that matters: it is what a canvas with no layout
 * box reports, and it is the number that turns the DOM path's scale factor into
 * Infinity. If a zero ever reaches this module we want the error message, not
 * a panel full of Infinity coordinates.
 */
function readSize(size, where) {
  const w = size && size.width;
  const h = size && size.height;
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
    throw new Error(
      `${where}: buffer size must be positive and finite, got ${w} x ${h}. ` +
      `A zero here is the signature of an unlaid-out canvas, and every ` +
      `coordinate derived from it would be Infinity or NaN.`,
    );
  }
  return { width: w, height: h };
}

/**
 * uv on a screen face → pixel inside that panel's own drawing buffer.
 *
 * v = 0 is the TOP edge, so y = v * height. See note 1 in the header for why
 * the (1 - v) form is the bug this whole module is shaped around.
 *
 * uv is not clamped. A raycast intersection is by construction inside the face,
 * so a uv outside [0, 1] means something upstream is wrong and should be
 * visible as an out-of-range pixel rather than silently pinned to an edge.
 *
 * @param {{x:number,y:number}|{u:number,v:number}} uv the hit's uv
 * @param {{width:number, height:number}} size the panel's drawing-buffer size
 * @returns {{x:number, y:number}} pixel position inside that buffer
 */
export function uvToPanelPixels(uv, size) {
  const { u, v } = readUv(uv, 'uvToPanelPixels');
  const { width, height } = readSize(size, 'uvToPanelPixels');
  return { x: u * width, y: v * height };
}

/**
 * Check a candidate mapping against the top-left-origin convention.
 *
 * Exported, not buried in the test, for two reasons. It is the executable
 * statement of the convention — the one place that says what v = 0 means — and
 * it is the only way to test the convention NEGATIVELY: hand it the (1 - v)
 * form and it must reject it. A checker that cannot fail proves nothing about
 * the mapping it blesses.
 *
 * @param {(uv:object, size:object) => {x:number,y:number}} mapFn candidate mapping
 * @param {{width:number, height:number}} size buffer size to probe at
 */
export function assertTopLeftOrigin(mapFn, size) {
  const { width, height } = readSize(size, 'assertTopLeftOrigin');
  const cases = [
    { uv: { u: 0, v: 0 }, want: { x: 0, y: 0 },
      note: 'v = 0 is the TOP edge of these faces' },
    { uv: { u: 1, v: 0 }, want: { x: width, y: 0 },
      note: 'u = 1 is the RIGHT edge' },
    { uv: { u: 0, v: 1 }, want: { x: 0, y: height },
      note: 'v = 1 is the BOTTOM edge' },
  ];
  for (const c of cases) {
    const got = mapFn({ x: c.uv.u, y: c.uv.v, u: c.uv.u, v: c.uv.v }, { width, height });
    if (!got || !sameCoord(got.x, c.want.x) || !sameCoord(got.y, c.want.y)) {
      throw new Error(
        `assertTopLeftOrigin: uv (${c.uv.u}, ${c.uv.v}) mapped to ` +
        `(${got && got.x}, ${got && got.y}), expected (${c.want.x}, ${c.want.y}) — ` +
        `${c.note}. A mapping that uses (1 - v) draws every panel UPSIDE DOWN.`,
      );
    }
  }
}

/**
 * Build the texture a panel's canvas is shown through.
 *
 * flipY = false is the load-bearing line, and it is the other half of the
 * pointer convention above: uv v = 0 must land on the TOP row of the canvas
 * both for drawing and for pointing. three's default is flipY = true, so
 * omitting this line does not leave the setting "unset" — it actively flips the
 * image and inverts the screens.
 *
 * colorSpace = SRGBColorSpace is the second load-bearing line, and it was
 * missing until it was seen on the glass. A CanvasTexture in three r0.183
 * defaults to NoColorSpace, so the renderer samples the canvas as LINEAR data
 * and skips the sRGB->linear decode. The Phosphor ink #EDE8DE is sRGB 0.93;
 * read as linear 0.93 it comes out far brighter and flatter than authored, and
 * the warm off-white that is the whole point of the palette renders as flat
 * pure white. Observed directly in cockpit-screens-lab.html: the panel BUFFER
 * drew warm cream while the same pixels in the 3D view were blown out.
 *
 * Mipmaps are off and the min filter is linear because these canvases are
 * redrawn every frame; regenerating a mip chain per frame per panel is real
 * cost for a surface the pilot views close to head-on. Revisit if the screens
 * ever get looked at from a sharp angle.
 *
 * @param {{width:number, height:number}} image a canvas (or anything with a size)
 * @returns {CanvasTexture}
 */
export function createPanelTexture(image) {
  if (!image || !Number.isFinite(image.width) || !Number.isFinite(image.height)) {
    throw new Error(
      'createPanelTexture: needs a drawing surface with a numeric width and height. ' +
      'A texture over an undefined canvas renders black and reports no error.',
    );
  }
  const texture = new CanvasTexture(image);
  texture.flipY = false;
  texture.colorSpace = SRGBColorSpace;
  texture.generateMipmaps = false;
  texture.minFilter = LinearFilter;
  return texture;
}

/**
 * Drives a NavComputer-shaped target from raycast hits against its panel.
 *
 * Construction installs the `_getCanvasPos` override on the target instance and
 * leaves it installed; `detach()` takes it back off. Installing once rather
 * than per event keeps the target in one state instead of flickering between
 * two, and means a handler that reaches for the position outside our call
 * stack still gets panel pixels rather than Infinity.
 *
 * Every method takes `hit` — a three Intersection, or null/undefined meaning
 * "the ray missed the quad this frame".
 */
export class PanelPointerAdapter {
  /**
   * @param {object} target NavComputer-shaped: _canvas plus the three handlers
   * @param {{size?: {width:number,height:number}}} [options] size overrides the
   *        target's canvas, for panels that draw into a buffer they don't own
   */
  constructor(target, options = {}) {
    if (!target) throw new Error('PanelPointerAdapter: needs a target to drive.');
    for (const name of ['_handleMouseDown', '_handleMouseMove', '_handleMouseUp']) {
      if (typeof target[name] !== 'function') {
        throw new Error(
          `PanelPointerAdapter: target has no ${name}(). This adapter drives a ` +
          `NavComputer-shaped object; without that handler nothing would happen ` +
          `and the panel would look merely unresponsive.`,
        );
      }
    }

    this.target = target;
    this._sizeOverride = options.size || null;
    this._pos = { x: 0, y: 0 };
    this._pressed = false;

    this._hadOwn = Object.prototype.hasOwnProperty.call(target, '_getCanvasPos');
    this._saved = this._hadOwn ? target._getCanvasPos : undefined;

    // The whole point. An own property shadows the prototype method, so the
    // target's handlers get panel pixels without ever touching the DOM.
    // A copy is returned so a handler that mutates the result cannot corrupt
    // the position the next handler in the same frame will read.
    target._getCanvasPos = () => ({ x: this._pos.x, y: this._pos.y });
  }

  /** Put the override back the way it was found. */
  detach() {
    if (this._hadOwn) this.target._getCanvasPos = this._saved;
    else delete this.target._getCanvasPos;
  }

  /**
   * The panel's drawing-buffer size, read fresh every event.
   *
   * Fresh, not cached: a panel that gets re-created at a new resolution would
   * otherwise keep being pointed at through the old size, and the error is a
   * proportional offset that grows toward the far corner — the kind of thing
   * that reads as "the cursor drifts" rather than as a bug with a cause.
   */
  bufferSize() {
    const src = this._sizeOverride || this.target._canvas;
    if (!src) {
      throw new Error(
        'PanelPointerAdapter: target has no _canvas and no size was supplied, ' +
        'so there is nothing to express panel pixels in.',
      );
    }
    return readSize(src, 'PanelPointerAdapter.bufferSize');
  }

  /** Park the mapped position where the overridden _getCanvasPos will find it. */
  _place(hit) {
    const p = uvToPanelPixels(readUv(hit.uv, 'PanelPointerAdapter'), this.bufferSize());
    this._pos.x = p.x;
    this._pos.y = p.y;
    return p;
  }

  /**
   * Press. A press with no hit is not ours — the player clicked past the
   * screens — and must not start a drag we would then owe a release for.
   * @returns {boolean} whether a press was delivered
   */
  pointerDown(hit) {
    if (!hit) return false;
    this._place(hit);
    this._pressed = true;
    this.target._handleMouseDown(PANEL_POINTER_EVENT);
    return true;
  }

  /**
   * Move, or miss. A miss while pressed is the 3D form of the cursor leaving
   * the canvas, and NavComputer has always treated that as a release.
   * @returns {boolean} whether this move released a drag
   */
  pointerMove(hit) {
    if (!hit) return this.release();
    this._place(hit);
    this.target._handleMouseMove(PANEL_POINTER_EVENT);
    return false;
  }

  /**
   * HOVER — a move with NO button down, which is the channel note 4 describes.
   *
   * Everything the player clicks in the map body — a planet, a moon, a star at
   * PRISM, a galaxy sector, a grid tile — is resolved by `_handleClick` from hover
   * state, and that state is a fact about the LAST RENDERED FRAME. So this has to
   * arrive while the button is up, and a frame has to run between it and the
   * click, or the click resolves against wherever the pointer last was.
   *
   * ⭐ A MISS PARKS THE POSITION OFF-GLASS RATHER THAN DOING NOTHING. Left where
   * it was, the tooltip stays lit on a body the cursor has left, and a click that
   * lands on the glass but on empty space acts on the stale body instead of
   * clearing the selection. Forwarding the move with an unreachable position is
   * what makes the class clear its own hover, using its own proximity tests —
   * nothing here reaches in and nulls `_hoveredBody`, which would be this module
   * knowing the internals of a class it is only supposed to drive.
   *
   * ⚠ `OFF_GLASS` IS -1e4 AND NOT -1. The class's hit radii are up to 14 px and a
   * body can be projected into the very corner, so (-1, -1) is still within reach
   * of a body at (5, 5) and would leave it hovered. The sentinel has to exceed
   * every radius the class uses, and a value that merely looks "outside the
   * canvas" does not.
   *
   * A press owns the pointer: while one is outstanding this is a no-op and
   * `pointerMove` is the right call. Letting a hover through mid-press would
   * deliver a second move per event, and a hover-miss would park the position
   * 10,000 px away, which the drag arithmetic would read as an enormous pan.
   *
   * @param {object|null} hit the intersection, or null for "the ray missed"
   * @returns {boolean} whether the pointer is over the glass
   */
  pointerHover(hit) {
    if (this._pressed) return false;
    if (!hit) {
      this._pos.x = OFF_GLASS;
      this._pos.y = OFF_GLASS;
      this.target._handleMouseMove(PANEL_POINTER_EVENT);
      return false;
    }
    this._place(hit);
    this.target._handleMouseMove(PANEL_POINTER_EVENT);
    return true;
  }

  /**
   * Button up — and, if the gesture belongs to this panel, the click.
   *
   * ── THE CLICK, ADDED IN INCREMENT 6 ────────────────────────────────────────
   *
   * This adapter shipped without click forwarding, and the header above still
   * lists drill-down as a deliberate non-goal "wanting its own decisions about
   * what clicking a screen from the pilot seat means". Those decisions are made
   * now (workstream `cockpit-zoom-to-panel-2026-07-29`), because `_handleClick`
   * is the ONLY route in NavComputer to the level-tab strip, both SYSTEM
   * sub-views, the autopilot toggle and the [ BURN ] / [ WARP ] commit. Max's
   * "so we can interact with the full menu" is blocked on this one method.
   *
   * ⭐ THE DRAG REJECTION IS NOT REIMPLEMENTED HERE, ON PURPOSE. NavComputer
   * already owns it: `_handleClick` compares the release position against
   * `_dragStartX/_dragStartY` — which `_handleMouseDown` set — and bails past
   * 25 px². A browser fires `click` after `mouseup` regardless and lets that
   * check decide, so forwarding unconditionally is the faithful port. A second
   * threshold in here would give one rule two homes to drift between, and the
   * drift would show up as clicks that work at the centre of a pan and not at
   * its edges.
   *
   * What this method DOES own is that the click belongs to this panel at all:
   * it fires only when the press landed on the glass AND the release did too.
   * A press that started past the screens, or a drag that already slid off and
   * spent its release, must not operate the nav computer.
   *
   * ⚠ THE RETURN VALUE CHANGED MEANING with this addition: it now reports
   * whether a CLICK was delivered, not whether a release was. There were no
   * consumers at the time — nothing raycasts yet, this adapter existed only
   * under test — so the better meaning was taken while it was free. `release()`
   * still returns the release, for anyone who needs that.
   *
   * The RELEASE GOES FIRST, and the order is load-bearing rather than stylistic.
   * `_place` throws by design — on a zero-sized buffer, or on a hit whose
   * geometry has lost its UVs — and both of those are states a live panel can
   * reach for a frame (a canvas re-created at a new resolution reports width 0
   * until it is sized). Updating the position first meant that throw skipped the
   * release on its way out, so the one event that is guaranteed to let go of the
   * drag quietly did not, `_dragging` stayed true, and the map stayed welded to
   * the cursor forever after — the exact failure note 3 in the header exists to
   * prevent, reached through the back door.
   *
   * Releasing first costs nothing, because the position is cosmetic on this
   * path: NavComputer._handleMouseUp() takes no argument and reads no position,
   * it only clears _dragging and _panStartCenter. And the throw still propagates
   * loudly, so a broken buffer is not swallowed — it is merely no longer able to
   * take the drag hostage on the way past.
   */
  pointerUp(hit) {
    const released = this.release();
    if (!hit) return false;
    // Placed BEFORE the click, because `_handleClick`'s first act is to ask for
    // the position and compare it against the drag start. A click delivered
    // against the previous position reads as a drag whenever the player clicks
    // far from where they last pointed, and as a click when they do not —
    // intermittent by construction, and impossible to reproduce on demand.
    this._place(hit);
    if (!released) return false;
    if (typeof this.target._handleClick !== 'function') return false;
    this.target._handleClick(PANEL_POINTER_EVENT);
    return true;
  }

  /**
   * The single release route, guarded so it fires once per press.
   *
   * Without the flag, a ray that keeps missing calls _handleMouseUp on every
   * frame of the miss — harmless the first time, and then repeatedly clearing
   * state after the player has grabbed the map again.
   * @returns {boolean} whether a release was actually delivered
   */
  release() {
    if (!this._pressed) return false;
    this._pressed = false;
    this.target._handleMouseUp(PANEL_POINTER_EVENT);
    return true;
  }

  /** Whether a press is currently outstanding. */
  get isPressed() {
    return this._pressed;
  }
}
