/**
 * DrivePanel — what the DRIVE screen draws.
 *
 * Lane F, workstream `cockpit-screen-content-2026-07-28`, AC-PANEL-CONTENT.
 *
 * ── THIS FILE IS LAYOUT. IT IS NOT A SECOND FLIGHT MODEL. ───────────────────
 *
 * Every number and every word on this panel already exists, already formatted,
 * in `buildFlightReadout(flightReadoutStateFromSnapshot(snapshot))`. That builder
 * is a careful PORT of the full-screen HUD the pilot has been flying by, and its
 * header lists the traps it already absorbed: `formatSpeed` returns a magnitude
 * so the REV prefix is added separately, `speedToBarFrac` is not abs-safe so the
 * supercruise fraction is fed `Math.abs(speed)`, the drop LABEL keys on the raw
 * `dropState` while the BAND keys on a deliberately wider `inWindow`.
 *
 * A painter that recomputed any of that would be a second implementation of a
 * SAFETY cue, and the two would drift the first time either side was touched.
 * The consequence is not an ugly panel; it is the glass telling the pilot
 * something the HUD does not, about whether a drop-out will take, while closing
 * on a planet. So this file asks the model once, at the top, and then does
 * nothing but decide where the answers go.
 *
 * THE THREE THINGS THE MODEL DOES NOT ANSWER, and why each is read raw here:
 *
 *   1. `speedCap` — the gravity-well ceiling the ship is actually flying under.
 *      `buildFlightReadout` never sees it (main.js does not hand it to the HUD),
 *      so it comes off `snapshot.drive.speedCap` and goes through `formatSpeed`,
 *      the game's ONE speed formatter. That is reuse, not re-derivation: it is a
 *      different quantity, written in the same three tiers as the speed above it,
 *      so the two numbers on this panel can be compared at a glance.
 *   2. `turnRateCap` — likewise absent from the HUD's state, and in radians per
 *      second, which is not a unit anybody flies by. Converted to degrees per
 *      second here, rounded to whole degrees; see TURN_ROW below.
 *   3. The throttle. The charter asks DRIVE to show it and the model deliberately
 *      does not: FlightReadout's header rules the throttle bar out as a STEERING
 *      indicator. What it DOES return is `bar.commandedFrac` — the speed the
 *      throttle is asking for, on the same scale as the speed the ship has — and
 *      that is what this panel draws, as the pin above the bar. A numeric "THR
 *      72%" row was considered and dropped for a specific reason: the snapshot
 *      writes `scModel?.throttle ?? 0`, so a frame with no drive model at all
 *      reports a throttle of zero, and the row could not tell "stick at rest"
 *      from "no drive data". It would print an authoritative 0% on a blank frame,
 *      which is the one thing every readout in lane F is forbidden to do. The pin
 *      says the same thing without ever having to fabricate a number.
 *
 * ── WHAT IS ON THE GLASS, AND WHY SO LITTLE OF IT ───────────────────────────
 *
 * The panel subtends about 17 degrees of a 70-degree field of view — roughly 260
 * SCREEN pixels top to bottom whatever the buffer resolution is. That is the hard
 * constraint, so this is five elements and not a dashboard:
 *
 *     the speed, huge          the one number a glance is for
 *     SUBLIGHT, when it is     absent means supercruise; the model only emits the
 *                              tag on `driveOn === false`, strictly
 *     the bar                  fill = current speed, pin above = commanded,
 *                              tick below = the drop ceiling
 *     CAP and TURN             the two ceilings, small, right-aligned
 *     MODE: …                  the string the HUD renders, uppercased, unchanged
 *     the mass-lock banner     inverted, blinking, no colour
 *
 * WHICH WARNING LIVES HERE. `buildFlightReadout` returns two cues and this panel
 * draws exactly one of them. Mass-lock — "TOO CLOSE — SUBLIGHT ONLY" — is a
 * statement about THE DRIVE: it refused to re-engage where the ship is. The drop
 * cue is a statement about THE TARGET's approach window, so it is drawn on the
 * TARGET screen. AlertCue's header is explicit that the two are independent axes
 * with no precedence rule, and that a panel with room for one line makes that
 * choice itself; this is that choice, made once, written down.
 *
 * ── FIXED BASELINES, SO NOTHING MOVES ───────────────────────────────────────
 *
 * Every y below is a fraction of the buffer height, fixed. Rows are NOT stacked
 * relative to whatever was drawn above them. That matters because half the
 * elements here come and go: the SUBLIGHT tag appears when the drive drops, the
 * banner appears on a mass-lock, CAP goes blank when there is no drive model. If
 * positions were relative, the appearance of a warning would shove the speed and
 * the ceilings up the glass — and a pilot glancing at a readout whose numbers
 * have moved reads the wrong row. A blank line holds its place; so does a missing
 * banner.
 */

import { blinkOn } from '../PhosphorScreen.js';
import { buildFlightReadout, flightReadoutStateFromSnapshot } from '../FlightReadout.js';
import { formatSpeed } from '../../ui/SpeedFormat.js';

/**
 * Where things sit, as fractions of the buffer height. Fractions and not pixels
 * for the same reason the type scale is fractional: the buffer resolution is a
 * quality knob (PanelHost's `bufferHeightPx`), and anything written in absolute
 * pixels slides up the glass the moment somebody raises it to kill aliasing.
 *
 * The gaps were checked against the type scale rather than eyeballed: the hero at
 * H/7 has its ink top at 0.086H, the bar's commanded pin reaches 0.019H above the
 * bar's top edge, and the banner's descender bottoms out at 0.93H. Nothing here
 * touches anything else, and the two rows are exactly one `lead` apart, which is
 * the scale's own baseline-to-baseline distance.
 */
const LAYOUT = Object.freeze({
  HERO_BASELINE: 0.20,
  TAG_BASELINE: 0.28,
  BAR_TOP: 0.33,
  BAR_HEIGHT: 0.07,
  ROW_FIRST_BASELINE: 0.52,
  MODE_BASELINE: 0.76,
  BANNER_BASELINE: 0.92,
});

/** radians per second → degrees per second. */
const RAD_TO_DEG = 180 / Math.PI;

/**
 * The speed ceiling, in the same three tiers as the speed itself.
 *
 * THE `Number.isFinite` GUARD IS THE POINT OF THIS FUNCTION. `formatSpeed` takes
 * `Math.abs(sceneUPerSec) || 0`, so it answers a missing cap perfectly cheerfully
 * with "0.0 km/s" — an authoritative-looking zero, in a plausible unit, for a
 * reading that does not exist. `snapshot.drive.speedCap` is null whenever there is
 * no supercruise model on the frame (the snapshot writes null, not 0, precisely so
 * this case is distinguishable), which is every frame before the ship is flying.
 * Missing means BLANK — never stale, never zero.
 */
function formatSpeedCap(sceneUPerSec) {
  if (!Number.isFinite(sceneUPerSec)) return '';
  const s = formatSpeed(sceneUPerSec);
  return `${s.value} ${s.unit}`;
}

/**
 * The turn-authority ceiling, in degrees per second.
 *
 * `SupercruiseModel.turnRateCap()` is radians per second and shrinks as speed
 * approaches the local speed cap — 0.7 rad/s at rest down to a quarter of that at
 * full local speed. Radians are not a unit anybody flies by, and the number is
 * rounded to whole degrees because a decimal place is unreadable at this angular
 * size and tells the pilot nothing they can act on.
 *
 * Same missing-means-blank guard as the cap above, for the same reason: 0 deg/s
 * is a real and alarming reading ("you cannot turn"), so it must never be what a
 * frame with no drive model looks like.
 */
function formatTurnCap(radPerSec) {
  if (!Number.isFinite(radPerSec)) return '';
  return `${Math.round(radPerSec * RAD_TO_DEG)} deg/s`;
}

/**
 * Paint the DRIVE screen.
 *
 * @param {import('../PhosphorScreen.js').PhosphorScreen} screen the drawing kit,
 *   already bound to this panel's buffer
 * @param {object|null} snapshot one frame from CockpitSnapshotProvider.get()
 * @param {number} nowMs the render-cadence clock, for the blink phase. NOT
 *   `snapshot.t` — the sim clock repeats across frames above 60 Hz and freezes on
 *   a pause, and an alarm that has stopped moving reads as no alarm.
 */
export function paintDrive(screen, snapshot, nowMs) {
  // ONE call to the model, at the top. Everything below reads this object and
  // nothing else; there is no second place a speed or a warning could come from.
  const readout = buildFlightReadout(flightReadoutStateFromSnapshot(snapshot ?? {}));
  const drive = snapshot?.drive ?? {};

  const H = screen.height;
  const W = screen.width;
  const t = screen.type;

  // The host does NOT clear before calling a painter (it owns no palette, so it
  // cannot choose a background colour). Without this the panel overprints itself
  // into mush within a second.
  screen.clear();

  // ── The hero ──
  // `readout.speedText` already carries the REV prefix, the tier and the unit.
  // Drawn exactly as handed over: the moment this file interpolates its own
  // number, the glass and the HUD can disagree.
  screen.text(readout.speedText, W / 2, H * LAYOUT.HERO_BASELINE, {
    size: t.display,
    align: 'centre',
  });

  // `sublightTag` is null while the drive is up, and `text` draws nothing for an
  // empty string — so "supercruise" is said by the absence of the word, and no
  // branch is needed here to say it.
  screen.text(readout.sublightTag, W / 2, H * LAYOUT.TAG_BASELINE, { align: 'centre' });

  // ── The bar ──
  // Every fraction comes from the model, in the model's own domain: `bipolar`
  // decides whether `frac` runs 0..1 from the left or -1..+1 from the centre, and
  // the kit reads the pin and the ticks in whichever domain the bar is in. A
  // non-finite tick fraction is skipped by the kit rather than drawn at zero, so
  // "no drop ceiling computed" needs no branch here either.
  screen.bar(
    t.pad,
    H * LAYOUT.BAR_TOP,
    W - t.pad * 2,
    H * LAYOUT.BAR_HEIGHT,
    readout.bar.frac,
    {
      bipolar: readout.bar.bipolar,
      ticks: [{ frac: readout.bar.dropTickFrac }],
      pin: readout.bar.commandedFrac,
    },
  );

  // ── The two ceilings ──
  // Label left, value right, one baseline each, one `lead` apart. The shared
  // right edge is what makes two rows scannable without reading the labels.
  const row0 = H * LAYOUT.ROW_FIRST_BASELINE;
  screen.row('CAP', formatSpeedCap(drive.speedCap), row0);
  screen.row('TURN', formatTurnCap(drive.turnRateCap), row0 + t.lead);

  // ── The mode line ──
  // `modeLine` is already "MODE: MANUAL" — prefix, uppercasing and all — and is
  // null when there is no manual flight mode this frame, which draws nothing.
  screen.text(readout.modeLine, t.pad, H * LAYOUT.MODE_BASELINE);

  // ── The one warning that belongs to the drive ──
  // The cue carries words and a blink TIER and no colour at all. Urgency is
  // inversion plus time; `banner` supplies the inversion, `blinkOn` supplies the
  // time, and the panel simply does not call `banner` on a dark phase.
  //
  // The `readout.massLock &&` half of this guard is load-bearing: `blinkOn`
  // THROWS on an unknown tier by design, and `undefined` is an unknown tier, so
  // asking it about a cue that is not there would take the whole panel down
  // through PanelHost's painter catch and leave the screen frozen.
  if (readout.massLock && blinkOn(readout.massLock.blink, nowMs)) {
    screen.banner(readout.massLock.text, H * LAYOUT.BANNER_BASELINE);
  }
}

export default paintDrive;
