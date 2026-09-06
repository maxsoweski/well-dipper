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
import { fitDesignation } from '../designation.js';
import { briefAlert } from '../../ui/AlertCue.js';

/**
 * Where things sit, as fractions of the buffer height — fixed, so that a warning
 * appearing never shoves the distance and the ETA up the glass. See DrivePanel's
 * header for the full argument.
 */
// ⛔ `LAYOUT` IS GONE. It placed everything at a fraction of the buffer height, which was right for
// a 512-tall panel canvas and is wrong the moment the panel IS the game's 46 rows: 0.88 of 46 is
// 40.48, and a glyph on a fractional baseline is resampled into the grey fringe this workstream
// removes. Slots on the grid replace it, and its stated property — that a warning appearing never
// shoves the distance and the ETA up the glass — is now structural rather than arithmetical,
// because the banner has a slot of its own that nothing else can occupy.

/**
 * What the hero is, when it is not the body under the reticle.
 *
 * Drawn only for a warp destination, never for a selected body — a label that appeared in both
 * states would be decoration rather than a discriminator. The words are NavComputer's own
 * (`NavComputer.js:1860` draws `WARP TARGET` over its prism view), so the two surfaces that can
 * name a destination name it identically.
 *
 * ⚠ AND THE PANEL DRAWS THE SHORT ONE. "WARP TARGET" is eleven characters and the glass is nine.
 * The long form stays exported and unchanged for the overlay, which is not being coarsened.
 */
const WARP_KIND = 'WARP TARGET';
const WARP_KIND_BRIEF = 'WARP';

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
 * Draw the target's designation as big as it will go.
 *
 * ── ⭐ MAX'S RULING, 2026-09-08: "SHOUT THE SHORT NAME AND THE DISTANCE" ────────────────────────
 *
 * *"2. sounds good"*, against a rendered proposal. ⛔ This is NOT the batch plan's option (a) — he
 * did not take "big discriminator with the full name small underneath". The full designation comes
 * OFF the glass; it is not relegated to small type, and there is no second line for it.
 *
 * ── WHAT THIS REPLACED, AND WHY IT WAS ALREADY BROKEN ───────────────────────────────────────────
 *
 * The old version drew the name at the display tier, measured its own probe, and on overflow
 * cleared the whole buffer and redrew ONE size down. At the game's resolution that mechanism is not
 * merely unnecessary, it is a defect: the display tier holds FOUR characters on a 55-texel panel,
 * so a nine-character designation overflowed on essentially every body, and the "one size down"
 * landed at body size — where it also did not fit, and drew off both edges anyway. The panel was
 * broken TODAY, before any of this work.
 *
 * The replacement measures the same thing the kit already knows: how many characters each tier
 * holds. The name is fitted to the panel's width FIRST (dropping the leading system name, never
 * truncating an identifier — see `designation.js`), and then drawn at the largest tier that holds
 * the result. A short designation therefore genuinely shouts, which is what was asked for.
 *
 * ⛔ NO PROBE, NO RE-CLEAR. The old "measure by drawing" forced this to be the first thing painted
 * after a clear, and made every other element's ordering load-bearing. Nothing here draws twice.
 * @private
 */
function drawHeroName(screen, name, top) {
  const t = screen.type;
  const fitted = fitDesignation(name, screen.colsAt(t.body));
  if (!fitted) return null;   // no target, no hero, no placeholder — a '—' would invent a reading
  const size = fitted.length <= screen.colsAt(t.display) ? t.display : t.body;
  return screen.text(fitted, screen.width / 2, top + size, { size, align: 'centre' });
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

  // ── WHO OWNS THE HERO SLOT ────────────────────────────────────────────────
  //
  // The body under the reticle wins, because it is the thing a burn will hit.
  // With no body, the warp destination takes the slot. That is not a nicety: the
  // two are mutually exclusive BY THE GAME'S OWN INVARIANT and the transition
  // runs one way round more often than the other. `trySelectWarpTarget`
  // (main.js:11113) opens with `if (_selectedTarget) scControls.deselect();`, so
  // choosing where to go DELETES what this panel was showing — and BodyInfo,
  // which used to type out "Warp Target" on that same click, is suppressed in
  // HELM (main.js:662, AC-OVERLAYS-RETIRE-IN-HELM). Without this, picking a
  // destination emptied the glass and announced the destination nowhere.
  const warpName = target.name ? null : (snapshot?.warp?.targetName || null);

  const t = screen.type;
  const lineTop = (i) => t.pad + i * t.lead;
  const baseline = (i) => lineTop(i) + t.body;

  screen.clear();

  // ── Slot 0: what kind of thing the hero is ──
  // Still drawn only for a warp destination. The ordering that used to be load-bearing here is
  // not any more — nothing re-clears the buffer — but the label stays above the name because that
  // is where a caption belongs, not because the painter would otherwise wipe it.
  if (warpName) {
    screen.text(WARP_KIND_BRIEF, screen.width / 2, baseline(0), { align: 'centre' });
  }

  // ── Slots 1-2: the designation ──
  drawHeroName(screen, target.name || warpName, lineTop(1));

  // ── Slot 3: the distance, on a line of its own ──
  //
  // ⛔ NOT A LABELLED ROW, AND THIS IS THE DEFECT THAT FOUND ITSELF. A row is a 3-character label
  // and a 5-character value on a 9-character panel, and `formatDistance` emits up to EIGHT
  // ("14959 Mm", "0.25 AU"). Drawn as `row('DST', …)` the label and the value OVERLAPPED — the
  // value's first glyph landed on top of the label's last — and the result was not a clipped row
  // but a smear of half-glyphs. It was found because the panel tests decode text back out of the
  // texels, so the overlap came back as a tofu run that no assertion had asked for; a test that
  // trusted the string handed to `fillText` would have been perfectly green.
  //
  // The distance gets the whole line instead. Nothing is lost by dropping the label: this panel
  // carries exactly one distance, and the number brings its own unit — "0.25 AU" cannot be read as
  // anything else. A label here would be three characters spent saying what the only number of its
  // kind on the glass already says.
  screen.text(formatDistance(target.distance), screen.width - t.pad, baseline(3), { align: 'right' });

  // ── Slot 4: the ETA ──
  // The model's, verbatim. `readout.eta` is already '--:--' for "aimed at it but not closing" and
  // null for "not aimed at it at all", which draws the label with a blank value — the row holds its
  // line either way, so nothing below it moves. Five characters, and '--:--' is exactly five.
  screen.row('ETA', readout.eta, baseline(4));

  // ── Slot 6: the approach cue ──
  // Words and a blink tier, no colour. SAFE TO DROP is steady and therefore always lit; SLOW DOWN
  // blinks slowly. The `readout.drop &&` half of the guard stops `blinkOn` being asked about an
  // absent cue, which it throws on by design.
  if (readout.drop && blinkOn(readout.drop.blink, nowMs)) {
    screen.banner(briefAlert(readout.drop.text), baseline(6));
  }
}

export default paintTarget;
