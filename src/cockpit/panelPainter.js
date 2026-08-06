/**
 * panelPainter — the one bridge between what the host hands out and what a
 * painter takes.
 *
 * Lane F, workstream `cockpit-screen-content-2026-07-28`, AC-PANEL-HOST /
 * AC-PANEL-CONTENT.
 *
 * ── WHY THIS FILE EXISTS AT ALL ─────────────────────────────────────────────
 *
 * Two contracts meet here and they are NOT the same shape:
 *
 *   PanelHost.setPainter takes    fn(panel, snapshot, nowMs)
 *                                 `panel` is the host's record — role, nodeName,
 *                                 mesh, metrics, canvas, ctx, texture
 *   the shipped painters take     fn(screen, snapshot, nowMs)
 *                                 `screen` is a PhosphorScreen
 *
 * The gap is deliberate on both sides and neither side should close it. The host
 * must not construct a `PhosphorScreen`, because that would be the host choosing
 * a palette and a type scale, and its header is explicit that it owns neither —
 * it will not even fill an unclaimed panel's background, because a fill needs a
 * colour. The painters must not take a raw panel, because then every one of them
 * would have to build its own kit and each could build it differently.
 *
 * So somebody has to bridge them. Until now the only bridge was a private
 * function inside `cockpit-screens-lab-panels.js`, which meant the LAB worked and
 * the game, the day the cockpit is wired into `main.js`, would have to reinvent
 * it. Reinventing it is not a compile error and not a visible one either: hand a
 * painter the PANEL instead of a kit and `PhosphorScreen`'s constructor is never
 * reached, so the first symptom is `screen.clear is not a function` thrown inside
 * `PanelHost._paintPanel`'s catch — logged ONCE, per that method's deliberate
 * once-per-panel reporting, after which four black rectangles sit in the cockpit
 * with nothing on the console to say why. That is the exact silent failure this
 * module is promoted out of the lab to make unrepeatable: there is one bridge,
 * it is under `src/`, and it has a test.
 *
 * ── THE KIT IS BUILT ONCE PER PANEL, AND THE CACHE IS THE TRAP ──────────────
 *
 * `screenForPanel` caches. The earlier lab version deliberately did not, and its
 * comment argued the case: a `PhosphorScreen` holds no state between calls, so a
 * cache is a cache with an invalidation rule to get wrong. That argument was
 * right about the risk and wrong about the trade. This is a 60 Hz paint path —
 * four panels, every repaint — and allocating an object plus a frozen type scale
 * per panel per frame to hold three numbers that did not change is waste with no
 * upside. The kit is CHEAP TO REUSE precisely because it is stateless.
 *
 * So the cache exists, and the invalidation rule is the thing to get right. Here
 * is exactly how it goes wrong if you cache naively:
 *
 *   The lab's BUFFER RESOLUTION control (and, in the game, any future quality
 *   setting) tears every panel down and rebuilds it at a different height.
 *   `PanelHost.fromRoot` makes a NEW canvas, a NEW context and a NEW panel record.
 *   A cache that remembers "this role already has a screen" then keeps handing out
 *   a kit whose `type` scale was derived from the OLD buffer height and whose
 *   `ctx` points at a canvas nothing renders any more. The panel does not error.
 *   It draws — into the wrong context, at the wrong size, and the glass either
 *   freezes on the last good frame or shows type sized for a buffer that no longer
 *   exists. Every symptom of that reads as "the resolution knob does nothing".
 *
 * The rule below therefore does NOT key on the role, and does not merely check
 * that a cached entry exists. It keys on the PANEL OBJECT (a WeakMap, so a
 * disposed host's panels are collectable rather than pinned forever) and it
 * re-validates all three of the things a `PhosphorScreen` is built out of —
 * `ctx`, `width`, `height` — against the panel's canvas on every call. Any one of
 * them differing rebuilds the kit. That covers both shapes of the failure: a
 * whole new panel record, and a canvas resized in place under a panel record that
 * was kept.
 *
 * Nothing extra is stored to make that check possible: a `PhosphorScreen` already
 * carries `ctx`, `width` and `height` as fields, so the cached object is its own
 * validity record. There is no second copy of the size to drift.
 *
 * ── THE SIZE COMES OFF THE CANVAS. NEVER A LITERAL. ────────────────────────
 *
 * `panel.canvas.width` and `panel.canvas.height` — not `DEFAULT_PANEL_BUFFER_
 * HEIGHT_PX`, not 512, not anything written down here. That canvas was sized by
 * `PanelHost` from the face's MEASURED aspect times the chosen buffer height, so
 * reading it here is what carries the derived-from-the-mesh property all the way
 * through to the type scale. A literal here would look harmless and would mean
 * the type stopped tracking the resolution knob: raise the buffer to 1024 and
 * every string would render at half its intended angular size, on a panel that
 * otherwise looks completely normal. The test scans this file's own source for
 * multi-digit numeric literals for exactly that reason.
 *
 * ── DELIBERATE NON-GOALS ───────────────────────────────────────────────────
 *
 *   - IT DOES NOT CATCH THE PAINTER'S ERRORS. `PanelHost._paintPanel` already
 *     wraps the call, reports once per panel and keeps the other three drawing. A
 *     second catch here would swallow the throw before the host ever saw it, and
 *     the host would then mark the panel as painted and re-upload an unchanged
 *     texture forever with nothing logged anywhere.
 *   - IT DOES NOT CLEAR. The host does not clear before a painter runs (it owns no
 *     palette) and neither does this, for the same reason — `screen.clear()` is
 *     every painter's own first line, and moving it here would hide a painter that
 *     forgot it.
 *   - IT KNOWS NOTHING ABOUT ROLES. Which painter goes on which piece of glass is
 *     `PanelLayout.DEFAULT_PANEL_ROLES` plus whoever calls `setPainter`. A bridge
 *     that knew role names would be a second place to keep that table.
 */

import { PhosphorScreen } from './PhosphorScreen.js';

/**
 * Panel record → the drawing kit built for its current buffer.
 *
 * A WeakMap and not a Map, because the keys are objects the host owns and throws
 * away: `dispose()` empties `_panels`, and a reload builds four new records. A
 * strong Map would hold every panel of every cockpit ever loaded — along with its
 * canvas and its 2D context — alive for the life of the page.
 *
 * Module scope rather than per-`panelPainter()`-closure on purpose. The kit
 * belongs to the PANEL, not to the painter wrapped around it, so two adapters
 * pointed at one panel share one kit instead of quietly holding two contexts onto
 * the same canvas.
 */
const SCREENS = new WeakMap();

/**
 * The Phosphor drawing kit for this panel's CURRENT buffer.
 *
 * Cached per panel and re-validated every call against the panel's own canvas —
 * see the header for the resolution-knob failure that validation exists to stop.
 *
 * @param {{ctx:object, canvas:{width:number, height:number}}} panel a PanelHost panel
 * @returns {PhosphorScreen}
 */
export function screenForPanel(panel) {
  if (!panel || !panel.ctx || !panel.canvas) {
    throw new Error(
      'screenForPanel: needs a PanelHost panel carrying a `ctx` and a `canvas`. Handing the ' +
      'painter something else fails deep inside a draw call, which PanelHost catches, reports ' +
      'once, and then leaves as a frozen screen with nothing to say why.',
    );
  }

  const { ctx, canvas } = panel;
  const cached = SCREENS.get(panel);
  // All three, every call. `ctx` catches a rebuilt buffer under a reused record;
  // the dimensions catch a canvas resized in place. Checking only that a cached
  // entry exists is the whole bug — see the header.
  if (cached && cached.ctx === ctx && cached.width === canvas.width && cached.height === canvas.height) {
    return cached;
  }

  // Dimensions off the panel's OWN canvas. Never a constant; see the header.
  const screen = new PhosphorScreen(ctx, { width: canvas.width, height: canvas.height });
  SCREENS.set(panel, screen);
  return screen;
}

/**
 * Adapt a `(screen, snapshot, nowMs)` painter to `PanelHost.setPainter`'s
 * `(panel, snapshot, nowMs)` contract.
 *
 * The non-function guard throws HERE, at wiring time, rather than letting the
 * mistake reach the render loop. Registered unchecked, a non-function would throw
 * on the first repaint from inside the host's catch — reported once, and then that
 * screen simply stays as it was, which is indistinguishable from a panel with
 * nothing to say.
 *
 * @param {(screen:PhosphorScreen, snapshot:object, nowMs:number) => void} paint
 * @returns {(panel:object, snapshot:object, nowMs:number) => void}
 */
export function panelPainter(paint) {
  if (typeof paint !== 'function') {
    throw new Error(
      `panelPainter: needs a painter function, got ${typeof paint}. A non-function registered ` +
      `through setPainter would throw on the first repaint, inside the host's catch, and that ` +
      `screen would then simply stay as it was.`,
    );
  }
  // No try/catch. PanelHost owns the reporting; a second catch here would swallow
  // the throw before it ever reached the place that logs it. See the header.
  return (panel, snapshot, nowMs) => paint(screenForPanel(panel), snapshot, nowMs);
}

export default panelPainter;
