/**
 * cockpit-screens-lab-panels — wires the shipped panel painters onto the lab's
 * glass, and supplies the one holding card that has no shipped painter.
 *
 * Lane F, workstream `cockpit-screen-content-2026-07-28`. Lab support only:
 * imported by `cockpit-screens-lab.html` and by its test, and by nothing under
 * `src/`. It sits at the repo root for the same reason `planet-lod-lab-core.js`
 * and `lab-isolation.js` do — a lab's own wiring is not the game's source, but it
 * still deserves a test.
 *
 * ── THERE IS NO SECOND SET OF PAINTERS HERE, AND THAT IS THE POINT ──────────
 *
 * `src/cockpit/panels/DrivePanel.js`, `TargetPanel.js` and `InfoPanel.js` are
 * the shipped painters. This file imports them and does not reimplement any part
 * of them. A lab that drew its own version of the DRIVE screen would be showing
 * Max a panel the game will never render, and every judgement he made about the
 * type scale, the balance and the legibility would be about the wrong picture —
 * which is the single most expensive way a demo surface can lie.
 *
 * ── THE ONE THING THIS FILE ACTUALLY DOES: AN ADAPTER ───────────────────────
 *
 * Two contracts meet here and they are NOT the same shape:
 *
 *   PanelHost.setPainter takes    fn(panel, snapshot, nowMs)
 *                                 where `panel` carries `ctx`, `canvas`, `metrics`
 *   the shipped painters take     fn(screen, snapshot, nowMs)
 *                                 where `screen` is a PhosphorScreen
 *
 * The gap is deliberate on both sides. The host must not construct a
 * `PhosphorScreen`, because that would mean the host choosing a palette and a
 * type scale — and its header is explicit that it owns neither (it will not even
 * fill an unclaimed panel's background, because a fill needs a colour). The
 * painters must not take a raw panel, because then every one of them would have
 * to build its own kit and could build it wrong.
 *
 * So somebody has to bridge them, and `panelPainter` is that bridge. It is four
 * lines and it is worth naming rather than inlining, because getting it wrong is
 * silent: hand a painter the PANEL instead of a kit and `PhosphorScreen`'s
 * constructor is never reached, so the first symptom is `screen.clear is not a
 * function` from inside the host's painter catch — reported once, then a frozen
 * screen with nothing to say why.
 *
 * WHEN THE GAME WIRES THESE PANELS IN, IT WILL NEED THE SAME BRIDGE. That is
 * worth knowing: this is not lab scaffolding that disappears, it is the seam
 * showing up for the first time in the first place that mounts both halves. If a
 * `panelPainter` lands in `src/cockpit/` later, this file should import it and
 * delete its own.
 *
 * ── THE KIT IS BUILT PER PAINT, NOT CACHED ─────────────────────────────────
 *
 * A `PhosphorScreen` holds no state between calls — it is a context plus a type
 * scale derived from the buffer height — and the lab's BUFFER RESOLUTION control
 * tears every panel down and rebuilds it at a different height. A cached kit is
 * therefore a cache with an invalidation rule to get wrong, and getting it wrong
 * means type sized for the OLD buffer: correct-looking, wrong-sized, no error.
 * The cost of not caching is five divisions per panel per repaint, twelve and a
 * half times a second.
 */

import { PhosphorScreen } from './src/cockpit/PhosphorScreen.js';
import { paintDrive } from './src/cockpit/panels/DrivePanel.js';
import { paintTarget } from './src/cockpit/panels/TargetPanel.js';
import { paintInfo } from './src/cockpit/panels/InfoPanel.js';

/**
 * What the NAV panel says while the nav computer is not part of this rung.
 *
 * Exported so the lab's HUD and this file's test name the same strings rather
 * than each spelling them out.
 */
export const NAV_HOLDING_TEXT = Object.freeze({ TITLE: 'NAV', NOTE: 'DEFERRED' });

/** Where the two words sit, as fractions of the buffer height. */
const NAV_LAYOUT = Object.freeze({ TITLE_BASELINE: 0.42, NOTE_BASELINE: 0.58 });

/**
 * Build the drawing kit for one panel's buffer.
 *
 * The dimensions come off the PANEL'S OWN CANVAS, never from a constant. That
 * canvas was sized by `PanelHost` from the face's MEASURED aspect times the
 * chosen buffer height, so reading it here is what carries the derived-from-the-
 * mesh property all the way to the type scale. A hard-coded height here would
 * mean the type stopped tracking the resolution knob — the panel would look
 * right at one setting and half-size at the next, with nothing to say so.
 */
function screenForPanel(panel) {
  if (!panel || !panel.ctx || !panel.canvas) {
    throw new Error(
      'screenForPanel: needs a PanelHost panel carrying a `ctx` and a `canvas`. Passing the ' +
      'painter something else fails deep inside a draw call, which the host catches, reports ' +
      'once and then leaves as a frozen screen.',
    );
  }
  return new PhosphorScreen(panel.ctx, {
    width: panel.canvas.width,
    height: panel.canvas.height,
  });
}

/**
 * Adapt a `(screen, snapshot, nowMs)` painter to `PanelHost`'s
 * `(panel, snapshot, nowMs)` contract. See the header for why the two differ.
 *
 * @param {(screen:object, snapshot:object, nowMs:number) => void} paint
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
  return (panel, snapshot, nowMs) => paint(screenForPanel(panel), snapshot, nowMs);
}

/**
 * NAV — a holding card, because the nav computer is not part of this increment.
 *
 * Two words and nothing else, on purpose. Leaving the glass dark was the
 * alternative and it was rejected: a dark panel among three lit ones reads as a
 * panel that FAILED, and the first minutes of the demo would go on working out
 * what broke. A card that says DEFERRED carries the same information without the
 * false alarm.
 *
 * IT READS NOTHING FROM THE SNAPSHOT, and that restraint is the whole design.
 * The system name and the nav level are both right there on the frame, and
 * putting either on this panel would make it look like a working nav computer —
 * the one impression it must not give, because AC-PANEL-CONTENT's NAV clause is
 * about the real thing being live from the first frame after boot, and a
 * plausible-looking placeholder is how that gets ticked off by mistake.
 *
 * Same `(screen, snapshot, nowMs)` shape as the three shipped painters, so all
 * four register interchangeably; a painter with a different arity is a wiring
 * bug waiting to happen.
 *
 * @param {import('./src/cockpit/PhosphorScreen.js').PhosphorScreen} screen
 */
export function paintNavHoldingCard(screen) {
  // The host does not clear before a painter runs — it owns no palette and so
  // cannot choose a background colour. Same first line as the other three.
  screen.clear();
  screen.text(NAV_HOLDING_TEXT.TITLE, screen.width / 2, screen.height * NAV_LAYOUT.TITLE_BASELINE, {
    size: screen.type.display,
    align: 'centre',
  });
  screen.text(NAV_HOLDING_TEXT.NOTE, screen.width / 2, screen.height * NAV_LAYOUT.NOTE_BASELINE, {
    align: 'centre',
  });
}

/**
 * The raw `(screen, …)` painters by role, before adaptation. Exported for the
 * test, which exercises them against a stand-in kit without a PanelHost.
 */
export const SCREEN_PAINTERS = Object.freeze({
  NAV: paintNavHoldingCard,
  DRIVE: paintDrive,
  TARGET: paintTarget,
  INFO: paintInfo,
});

/**
 * The painters in `PanelHost.setPainter` form, keyed by ROLE.
 *
 * Keyed by role and not by corner, deliberately. Which corner a role lands on is
 * `PanelLayout.DEFAULT_PANEL_ROLES` — one table whose whole purpose is that
 * swapping two entries swaps which panel draws where. A lab that keyed its
 * painters by corner would silently ignore that swap and keep drawing DRIVE
 * where DRIVE used to be, which is the one edit the table exists to invite.
 */
export const LAB_PAINTERS = Object.freeze({
  NAV: panelPainter(paintNavHoldingCard),
  DRIVE: panelPainter(paintDrive),
  TARGET: panelPainter(paintTarget),
  INFO: panelPainter(paintInfo),
});
