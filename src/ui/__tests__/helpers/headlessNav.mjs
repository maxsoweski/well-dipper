/**
 * headlessNav — a REAL NavComputer, in plain node, with no DOM.
 *
 * ── WHY THIS EXISTS, AND WHAT IT OVERTURNS ─────────────────────────────────
 *
 * `src/cockpit/NavSource.js`'s header states, as settled fact:
 *
 *     "A real NavComputer therefore CANNOT BE CONSTRUCTED IN A TEST, at any
 *      depth, by any arrangement."
 *
 * That is false, and the whole of lane F has been paying for it. Every check on
 * NavComputer's behaviour has had to be either a SOURCE SCAN — which the previous
 * workstream proved evadable seven different ways, by planting each one — or a
 * live browser reading, which cannot run in CI. A reviewer disproved the premise
 * by building one with a stub canvas and a stub 2D context; this file is that,
 * made reusable.
 *
 * The constructor's actual requirements turn out to be modest: a canvas object
 * with `getContext`, `addEventListener` and `getBoundingClientRect`, and a
 * `document` for the search overlay it never gets to build. No jsdom, no
 * node-canvas, no WebGL.
 *
 * ⚠ WHAT THIS IS NOT. It is not a renderer. The 2D context is a Proxy that
 * accepts every call and draws nothing, so this harness can answer "what did the
 * class DO" — which text did it emit, which rects did it publish, what did the
 * click change — and cannot answer "what did it LOOK like". Pixel questions stay
 * live. Anything here that starts asserting about appearance is lying.
 *
 * ⚠ AND IT IS NOT THE FULL RENDER-BASED REGRESSION SUITE that lane F's debt list
 * calls for. That would replace the evadable source scans wholesale and is a
 * piece of work in its own right. This is the minimum that lets the escape rework
 * be verified against the real class instead of against a description of it.
 */

const noop = () => {};

/**
 * A 2D context that records the things worth recording and swallows the rest.
 *
 * A Proxy rather than a hand-written stub because NavComputer touches a great
 * many context members across five levels and three sub-views, and a stub with a
 * gap in it fails as a TypeError deep inside a render — which reads as "the class
 * is broken headless" and is really "the fixture is short a method".
 */
export function makeRecordingContext(canvas) {
  const rec = { text: [], calls: [] };
  const gradient = { addColorStop: noop };

  const ctx = new Proxy({}, {
    get(_t, key) {
      switch (key) {
        case 'canvas': return canvas;
        case 'fillText':
        case 'strokeText':
          return (s, x, y) => { rec.text.push({ text: String(s), x, y, op: key }); };
        case 'measureText': return (s) => ({ width: String(s).length * 6 });
        case 'createLinearGradient':
        case 'createRadialGradient':
        case 'createPattern':
          return () => gradient;
        case 'getImageData':
          return (x, y, w, h) => ({
            width: w, height: h, data: new Uint8ClampedArray(Math.max(0, w * h * 4)),
          });
        case 'createImageData':
          return (w, h) => ({
            width: w, height: h, data: new Uint8ClampedArray(Math.max(0, w * h * 4)),
          });
        case 'isPointInPath': return () => false;
        case 'getContextAttributes': return () => ({});
        default:
          if (typeof key === 'symbol') return undefined;
          return (...args) => { rec.calls.push({ op: key, args }); };
      }
    },
    set() { return true; },
    has() { return true; },
  });

  return { ctx, rec };
}

/** Install the globals NavComputer's module and constructor reach for. */
function installDom(ctx) {
  const el = () => ({
    style: {}, value: '', textContent: '',
    addEventListener: noop, removeEventListener: noop, appendChild: noop,
    remove: noop, focus: noop, blur: noop,
    classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
    querySelector: () => null, querySelectorAll: () => [],
  });
  globalThis.document = {
    createElement: (tag) => (tag === 'canvas'
      ? { width: 1, height: 1, getContext: () => ctx, style: {} }
      : el()),
    addEventListener: noop, removeEventListener: noop,
    getElementById: () => null,
    body: { appendChild: noop },
  };
  globalThis.window = {
    devicePixelRatio: 1, innerWidth: 1920, innerHeight: 1080,
    addEventListener: noop, removeEventListener: noop,
  };
  globalThis.localStorage = { getItem: () => null, setItem: noop, removeItem: noop };
  if (!globalThis.Image) globalThis.Image = class { set src(_v) {} };
}

/**
 * Build a real NavComputer over a buffer of the given size.
 *
 * The canvas reports a layout box the SAME size as its buffer, so the class's own
 * `_getCanvasPos` scale factor is exactly 1 and a test can hand it panel pixels
 * as `clientX`/`clientY` directly. (`NavSource` exists precisely because a real
 * panel canvas has no layout box; here we want the plain path, unpinned.)
 */
export async function makeHeadlessNav({ width = 614, height = 512 } = {}) {
  const canvas = {
    width, height,
    style: {},
    parentElement: null,
    addEventListener: noop,
    removeEventListener: noop,
    getBoundingClientRect: () => ({ left: 0, top: 0, width, height, right: width, bottom: height }),
  };
  const { ctx, rec } = makeRecordingContext(canvas);
  canvas.getContext = () => ctx;
  installDom(ctx);

  const { NavComputer } = await import('../../NavComputer.js');
  const { GalacticMap } = await import('../../../generation/GalacticMap.js');

  const nav = new NavComputer(canvas, new GalacticMap(), null);
  return { nav, canvas, rec, ctx };
}

/** A synthetic star good enough for `openToCurrentSystem` to accept. */
export const fakeStar = (over = {}) => ({
  name: 'Test Star', seed: 12345, spectral: 'G',
  wx: 8.001, wy: 0.0002, wz: 0.0003, color: '#ffefb0', ...over,
});

/**
 * Click at a position in the canvas's own pixels.
 *
 * `button` defaults to 0. Passing 2 exercises the right-click path, which is the
 * ONE remaining caller of `handleEscape` after the escape rework.
 */
export function clickAt(nav, x, y, { button = 0 } = {}) {
  nav._handleMouseDown({ clientX: x, clientY: y, button });
  nav._handleMouseUp();
  nav._handleClick({ clientX: x, clientY: y, button });
}

/** The five level tabs live in a strip `tabH` tall across the bottom. */
export const TAB_H = 32;
export function tabCentre(nav, index, levels = 5) {
  const w = nav._canvas.width / levels;
  return { x: w * (index + 0.5), y: nav._canvas.height - TAB_H / 2 };
}

/**
 * Move the pointer there, then let a FRAME decide what is under it.
 *
 * `_handleMouseMove` does not set `_hoveredBody` at level 4 — it only records
 * `_mouseX`/`_mouseY`. The hover is resolved inside the RENDER, by proximity to
 * where that frame just projected each body (`_renderSystem` clears it and
 * re-tests every planet and star; `_renderPlanetDetail` does the same for
 * moons). So "the cursor is over a planet" is a fact about the last frame, and a
 * test that moves without rendering clicks whatever the PREVIOUS frame decided
 * was under the cursor — which is how a click meant for empty space lands on the
 * moon the cursor used to be over.
 *
 * Returns the resolved `_hoveredBody`, so a caller can assert what it is holding
 * rather than assume.
 */
export function hoverAt(nav, x, y) {
  nav._handleMouseMove({ clientX: x, clientY: y });
  nav.render();
  return nav._hoveredBody;
}

/**
 * Sweep the panel for a point that hovers a body matching `pred`.
 *
 * The bodies' screen positions come out of NavComputer's own projection, which
 * a test has no honest way to predict — recomputing the projection here would
 * duplicate the production maths and go stale silently. So this looks for the
 * body the way a player does: put the cursor somewhere, see what lights up.
 *
 * `step` 8 against the class's own hit radii (14 px for a planet, 10 for a moon)
 * guarantees a grid point within 5.66 px of any body centre, so a body that is
 * drawn at all is found. On return the pointer IS at the reported point and a
 * frame has resolved the hover, so the caller can click immediately.
 */
export function findHoverPoint(nav, pred, { step = 8, inset = 16 } = {}) {
  const bottom = nav._canvas.height - TAB_H - inset; // never sweep the tab strip
  for (let y = inset; y < bottom; y += step) {
    for (let x = inset; x < nav._canvas.width - inset; x += step) {
      const hb = hoverAt(nav, x, y);
      if (hb && pred(hb, nav)) return { x, y, body: { ...hb } };
    }
  }
  return null;
}
