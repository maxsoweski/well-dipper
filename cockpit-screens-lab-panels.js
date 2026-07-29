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
 * ── THE ADAPTER USED TO LIVE HERE. IT LIVES IN src/ NOW. ────────────────────
 *
 * Two contracts meet when a painter is mounted on a panel, and they are NOT the
 * same shape: `PanelHost.setPainter` takes `fn(panel, snapshot, nowMs)` where the
 * panel carries `ctx`, `canvas` and `metrics`, while the shipped painters take
 * `fn(screen, snapshot, nowMs)` where `screen` is a `PhosphorScreen`. Something
 * has to bridge them, and that bridge used to be a private function in THIS FILE.
 *
 * That was wrong, and the earlier version of this header said so in as many
 * words: "when the game wires these panels in, it will need the same bridge". A
 * seam that only exists in the lab is a seam the game reinvents — and reinventing
 * it is silent, because handing a painter the PANEL instead of a kit means
 * `PhosphorScreen`'s constructor is never reached, the first symptom is
 * `screen.clear is not a function` thrown inside `PanelHost`'s painter catch, and
 * that catch reports ONCE and then leaves black rectangles in the cockpit.
 *
 * So `panelPainter` is now `src/cockpit/panelPainter.js`, with its own test, and
 * this file imports it. There is exactly one bridge and the lab is proving the
 * same one the game will use. That is the point of the lab: a demo surface that
 * exercises a private copy of the wiring is demonstrating something that will
 * never ship.
 *
 * (The promoted version also CACHES the kit per panel, which this file's copy
 * deliberately did not. The invalidation rule that made caching look unattractive
 * — the lab's own BUFFER RESOLUTION control rebuilds every panel at a new height —
 * is handled there and tested there, against exactly that case.)
 */

import { panelPainter } from './src/cockpit/panelPainter.js';
import { paintDrive } from './src/cockpit/panels/DrivePanel.js';
import { paintTarget } from './src/cockpit/panels/TargetPanel.js';
import { paintInfo } from './src/cockpit/panels/InfoPanel.js';
import { makeNavPainter } from './src/cockpit/panels/NavPanel.js';

/**
 * What the NAV panel says when this page has NO NAV SOURCE ATTACHED.
 *
 * It used to say DEFERRED, because the nav computer was not part of that rung.
 * It is part of this one: `src/cockpit/panels/NavPanel.js` renders the real
 * `NavComputer` in full colour, and the lab mounts it over this card
 * as soon as the source is built. So the card is no longer the plan — it is the
 * FAILURE STATE, and the words had to change with the meaning. "NO SOURCE" says
 * the one true thing: the nav computer could not be built on this page. The lab's
 * chrome prints the reason verbatim beside it.
 *
 * Exported so the lab's HUD and this file's test name the same strings rather
 * than each spelling them out.
 */
export const NAV_HOLDING_TEXT = Object.freeze({ TITLE: 'NAV', NOTE: 'NO SOURCE' });

/** Where the two words sit, as fractions of the buffer height. */
const NAV_LAYOUT = Object.freeze({ TITLE_BASELINE: 0.42, NOTE_BASELINE: 0.58 });

/**
 * NAV's fallback card — shown ONLY when no nav computer could be built.
 *
 * Two words and nothing else, on purpose. Leaving the glass dark was the
 * alternative and it was rejected: a dark panel among three lit ones is
 * indistinguishable from a panel whose painter threw, and the first minutes of
 * the demo would go on working out which. A card that says NO SOURCE carries the
 * cause without the guesswork.
 *
 * IT READS NOTHING FROM THE SNAPSHOT, and that restraint is the whole design.
 * The system name and the nav level are both right there on the frame, and
 * putting either on this panel would make it look like a working nav computer —
 * the one impression it must not give, because AC-PANEL-CONTENT's NAV clause is
 * about the real thing being live from the first frame after boot, and a
 * plausible-looking placeholder is how that gets ticked off by mistake. That
 * argument is the reason the card is two flat words and not, say, a level name.
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

/**
 * The REAL NAV painter, in `PanelHost.setPainter` form, over a nav source.
 *
 * Why this is not in `LAB_PAINTERS`: that map is built at module load, and a nav
 * source cannot be. Building one means building a `NavComputer`, which needs a
 * canvas, a `GalacticMap` and a WebGL renderer — and, crucially, it needs the NAV
 * PANEL'S BUFFER SIZE, which does not exist until `PanelHost.fromRoot` has bound
 * the panels off the loaded model. So the page mounts the four static painters
 * first and then puts this one over NAV, which also means the fallback card is
 * what shows if the source could not be built.
 *
 * It is here rather than inline in the page for the same reason the adapter was
 * promoted out of this file: the game will need exactly this composition —
 * `panelPainter(makeNavPainter(source))` — and a composition that only ever
 * existed inside a `<script type="module">` is one the game reinvents, silently.
 *
 * ── IT TOOK A DITHER KNOB UNTIL 2026-07-29, AND NOW TAKES NOTHING ELSE ──────
 *
 * The second argument was a `() => {threshold, gamma}` read fresh every paint.
 * Max ruled the monotone too crude for the nav view, NAV went full colour, and
 * the parameter went with it rather than being left accepting-and-ignoring — a
 * knob that silently does nothing is the one failure its own doc-comment named.
 *
 * The two knobs that replaced it, SYSTEM FILL and SYSTEM ZOOM, are FIELDS ON THE
 * NAV COMPUTER (`systemFillFactor` and `_systemZoom`), not painter arguments. So
 * whoever owns the instance writes them — the lab, from its render loop — and
 * this composition does not need to know they exist.
 *
 * @param {import('./src/cockpit/NavSource.js').NavSource} source
 * @returns {(panel:object, snapshot:object, nowMs:number) => void}
 */
export function labNavPainter(source) {
  return panelPainter(makeNavPainter(source));
}
