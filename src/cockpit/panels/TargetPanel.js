/**
 * TargetPanel — what the TARGET screen draws.
 *
 * Lane F, workstream `cockpit-screen-content-2026-07-28`, AC-PANEL-CONTENT.
 *
 * Four things, and the charter is deliberately short: WHO is selected, HOW FAR,
 * HOW LONG, and WHETHER A DROP-OUT WILL TAKE. Three of the four are handed over
 * ready-made by `buildFlightReadout` and are drawn exactly as received — see
 * DrivePanel's header for why a painter that recomputes a safety cue is the worst
 * thing lane F can ship. The fourth, the distance, has no model anywhere in the
 * game; that gap is discussed under `formatDistance` below.
 *
 * ── THE NAME IS THE HERO, AND NAMES IN THIS GAME ARE LONG ───────────────────
 *
 * A pilot glancing at this screen is asking "what am I pointed at". So the name
 * gets the display size, H/7 — about 37 screen pixels at the panel's real angular
 * size, the only thing on the glass readable without looking directly at it.
 *
 * The complication is that NameGenerator is not producing "Mars". A procedural
 * system designation embeds ~70 bits of position injectively and therefore runs
 * 14-20 characters ("PVX J4K7Q2M+9XP3RWZ"), a planet adds a letter or a suffix,
 * and a moon adds a numeral on top of that: two dozen characters is ordinary.
 * At H/7 in a monospace face, roughly fourteen characters fit across the glass.
 * So the common case OVERFLOWS, and the three ways of dealing with that are:
 *
 *   - let it clip. The name is the one thing this screen exists to say, and half
 *     of it running off both edges is worse than useless — two different bodies
 *     in one system share a prefix and would clip to the same visible string.
 *   - wrap it. The kit refuses word wrap on purpose, and two lines of hero type
 *     would eat the distance and the ETA.
 *   - drop one size, once. Body size, H/20, is about 13 screen pixels and fits
 *     forty characters. That is what happens here.
 *
 * HOW THE FIT IS MEASURED, because the obvious ways are both wrong. Guessing a
 * character budget means writing down an advance width for a font this file never
 * chose and cannot see — the kit asks the platform for generic `monospace`
 * precisely so that a missing named face cannot silently change every width. And
 * measuring by hand means setting a font on the context and calling `measureText`
 * ourselves, which is the exact trap PhosphorScreen closed: measure under the
 * previous drawer's font and every centred string lands off by the ratio of the
 * two sizes.
 *
 * So the name is DRAWN and its returned ink box is read. `text()` hands back the
 * box it actually painted, measured under the correct font by the kit itself. If
 * that box is wider than the glass, the panel is cleared and the name is redrawn
 * one size down. That costs one wasted rasterise on the overflow path, at 12.5 Hz,
 * which is nothing — and it is the only exact answer available.
 *
 * IT MUST THEREFORE BE THE FIRST THING DRAWN. The re-clear wipes the panel, so
 * anything painted before the name would vanish on exactly the frames where a
 * long name appears. That is why `drawHeroName` is called immediately after
 * `clear()` and why this paragraph exists.
 *
 * ── WHICH WARNING LIVES HERE ────────────────────────────────────────────────
 *
 * The drop cue — SAFE TO DROP (steady) and SLOW DOWN (slow blink). It is a
 * statement about the approach to THIS body, so it belongs on the screen showing
 * that body. Mass-lock is a statement about the drive and is drawn on DRIVE.
 * AlertCue's header is explicit that the two are independent, that neither
 * suppresses the other, and that a panel with room for one line makes the choice
 * itself. This is that choice.
 *
 * Note that SAFE TO DROP is `BLINK.STEADY` — lit, never blinking. That is not an
 * oversight in the cue table: reassurance that flashes reads as an alarm, and the
 * whole reason the tier exists is that on a one-ink panel, movement is the only
 * urgency channel left.
 *
 * ── NO TARGET DRAWS AN EMPTY PANEL, NOT A ZEROED ONE ────────────────────────
 *
 * With nothing selected the model returns a null ETA and a null drop cue, and the
 * snapshot's distance is null. Every one of those draws either nothing at all
 * (the hero, the banner) or a label with a blank value (the two rows). What must
 * never appear is "0.0 km" and "0:00" against a body nobody selected, which is a
 * readout that looks like an instrument reading and is not one.
 */

import { blinkOn } from '../PhosphorScreen.js';
import { buildFlightReadout, flightReadoutStateFromSnapshot } from '../FlightReadout.js';
import { KM_PER_SCENE } from '../../ui/SpeedFormat.js';
import { AU_TO_SCENE } from '../../core/ScaleConstants.js';

/**
 * Where things sit, as fractions of the buffer height — fixed, so that a warning
 * appearing never shoves the distance and the ETA up the glass. See DrivePanel's
 * header for the full argument.
 */
const LAYOUT = Object.freeze({
  HERO_BASELINE: 0.22,
  ROW_FIRST_BASELINE: 0.50,
  BANNER_BASELINE: 0.88,
});

/** Below this many km the reading is written in km. */
const KM_TIER_MAX_KM = 1000;
/** Below this many scene units the reading is written in Mm. 0.1 AU. */
const MM_TIER_MAX_SCENE = 0.1 * AU_TO_SCENE;
/** Above this magnitude a tier drops its decimals — the number is already big. */
const INTEGER_ABOVE = 100;

/**
 * Distance in scene units → a short physical string.
 *
 * ── THIS IS THE FIRST DISTANCE FORMATTER IN THE GAME, AND THAT IS A SMELL ───
 *
 * Everything else this panel draws comes from a model that already existed.
 * This does not: nothing in `src/ui`, `src/flight` or `src/cockpit` formats a
 * distance for display today. The full-screen HUD divides the distance by the
 * speed to get an ETA and never prints the distance itself; the targeting
 * reticle uses it only to size a bracket. So there was nothing to consume, and
 * the charter asks for the raw distance on the glass.
 *
 * It is written here, in the panel, rather than in a shared module because a
 * shared module with exactly one caller is a guess about the future. THE MOMENT A
 * SECOND READOUT NEEDS A DISTANCE, this belongs in `src/ui/DistanceFormat.js`
 * beside `SpeedFormat.js` and both callers import it — the same shape lane F
 * already uses for speed. What must not happen is a second, subtly different
 * distance formatter growing somewhere else; that is the drift this comment
 * exists to prevent.
 *
 * ── THE UNITS ARE THE GAME'S OWN, NOT NEW PHYSICS ───────────────────────────
 *
 * `KM_PER_SCENE` comes from SpeedFormat, which derives it from ScaleConstants'
 * `METERS_PER_SCENE`; `AU_TO_SCENE` is ScaleConstants' own 1 AU = 1000 scene
 * units. No conversion constant is written down here, so the scene scale cannot
 * be restated wrongly in this file — it is imported from the two places that
 * already own it.
 *
 * Three tiers, with the SAME precision rule `formatSpeed` uses (integers once the
 * number passes 100, decimals below it), so that the distance on this screen and
 * the speed on the DRIVE screen have the same shape and can be read by the same
 * habit:
 *
 *     under 1000 km      "842 km"  /  "12.4 km"
 *     under 0.1 AU       "14960 Mm" / "1.50 Mm"
 *     0.1 AU and beyond  "0.25 AU" / "30.10 AU"
 *
 * No thousands separators. They cost two glyphs on a panel that has about
 * fourteen of them across at hero size, and the readout is a magnitude at a
 * glance, not an accountancy figure.
 *
 * A non-finite or missing distance returns BLANK. `distance` is null in every
 * frame with nothing selected, and a formatter that answered "0.0 km" there would
 * be telling the pilot they are sitting on top of something.
 *
 * @param {number|null|undefined} sceneUnits distance in scene units
 * @returns {string} the reading, or '' when there is none
 */
export function formatDistance(sceneUnits) {
  if (!Number.isFinite(sceneUnits)) return '';
  const d = Math.abs(sceneUnits);

  const km = d * KM_PER_SCENE;
  if (km < KM_TIER_MAX_KM) {
    return `${km >= INTEGER_ABOVE ? Math.round(km) : km.toFixed(1)} km`;
  }
  if (d < MM_TIER_MAX_SCENE) {
    const mm = km / 1000;
    return `${mm >= INTEGER_ABOVE ? Math.round(mm) : mm.toFixed(2)} Mm`;
  }
  const au = d / AU_TO_SCENE;
  return `${au >= INTEGER_ABOVE ? Math.round(au) : au.toFixed(2)} AU`;
}

/**
 * Draw the selected body's name as big as it will go, and no smaller than body
 * size. Returns nothing; see the header for why this measures by drawing, and why
 * it MUST be the first thing painted after a clear.
 * @private
 */
function drawHeroName(screen, name) {
  const W = screen.width;
  const y = screen.height * LAYOUT.HERO_BASELINE;

  // Null/empty name draws nothing at all and returns null — no target, no hero,
  // no placeholder. A '—' or 'NO TARGET' here would be inventing a reading.
  const box = screen.text(name, W / 2, y, { size: screen.type.display, align: 'centre' });
  if (!box) return;

  // The glass minus one margin either side. `pad` is the kit's own margin, so the
  // name is held to the same edge every other element respects.
  if (box.w <= W - screen.type.pad * 2) return;

  // Overflowed. Wipe the probe and redraw one size down — ONE step, to a size
  // that is still nearly three times the legibility floor. There is deliberately
  // no shrink-to-fit loop: that is how a 13-pixel readout quietly becomes an
  // 8-pixel one, and the kit throws below the floor rather than allow it.
  screen.clear();
  screen.text(name, W / 2, y, { size: screen.type.body, align: 'centre' });
}

/**
 * Paint the TARGET screen.
 *
 * @param {import('../PhosphorScreen.js').PhosphorScreen} screen the drawing kit
 * @param {object|null} snapshot one frame from CockpitSnapshotProvider.get()
 * @param {number} nowMs the render-cadence clock, for the blink phase
 */
export function paintTarget(screen, snapshot, nowMs) {
  const readout = buildFlightReadout(flightReadoutStateFromSnapshot(snapshot ?? {}));
  const target = snapshot?.target ?? {};

  const H = screen.height;
  const t = screen.type;

  screen.clear();

  // FIRST, always — `drawHeroName` may clear again. See the header.
  drawHeroName(screen, target.name);

  // ── The two readings ──
  // DIST is the raw distance; ETA is the model's, verbatim. `readout.eta` is
  // already '--:--' for "aimed at it but not closing" and null for "not aimed at
  // it at all", which draws the label with a blank value — the row holds its line
  // either way, so the numbers below never move.
  const row0 = H * LAYOUT.ROW_FIRST_BASELINE;
  screen.row('DIST', formatDistance(target.distance), row0);
  screen.row('ETA', readout.eta, row0 + t.lead);

  // ── The approach cue ──
  // Words and a blink tier, no colour. SAFE TO DROP is steady and therefore
  // always lit; SLOW DOWN blinks slowly. The `readout.drop &&` half of the guard
  // stops `blinkOn` being asked about an absent cue, which it throws on by design.
  if (readout.drop && blinkOn(readout.drop.blink, nowMs)) {
    screen.banner(readout.drop.text, H * LAYOUT.BANNER_BASELINE);
  }
}

export default paintTarget;
