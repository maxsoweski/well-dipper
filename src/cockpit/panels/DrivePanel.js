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
 *   3. ⭐ NOTHING. THE THROTTLE IS BACK IN THE MODEL — this item used to explain
 *      why it was not, and the explanation is worth keeping because both halves
 *      of it were fixed rather than overruled (2026-07-31, Max in UAT: *"let's
 *      make sure the throttle bar is represented on one of the screens"*).
 *
 *      It said: FlightReadout rules the throttle out as a STEERING indicator, so
 *      the panel draws `bar.commandedFrac` — the speed the throttle is asking for
 *      — as the pin instead; and a numeric "THR 72%" row was dropped because the
 *      snapshot writes `scModel?.throttle ?? 0`, so a frame with no drive model
 *      reports a throttle of zero and the row could not tell "lever at rest" from
 *      "no drive data". Printing an authoritative 0% on a blank frame is the one
 *      thing every readout in lane F is forbidden to do.
 *
 *      That second argument was sound and it was an argument against the `?? 0`,
 *      not against the throttle. The snapshot now writes null; the kit draws a
 *      non-finite fraction as an empty frame, which is "no reading" said exactly.
 *      The first argument was a misfiling: a lever position is not a steering
 *      input — it persists with nobody's hand on it. See FlightReadout's header.
 *
 *      AND `commandedFrac` DOES NOT COVER IT, which is why the pin was not
 *      already the answer. Commanded speed is throttle × the LIVE speed cap, so
 *      the pin moves under gravity with the pilot's hand perfectly still. The
 *      pin says what the ship was asked to do; the bar says where the hand is.
 *
 * ── WHAT IS ON THE GLASS, AND WHY SO LITTLE OF IT ───────────────────────────
 *
 * The panel subtends about 17 degrees of a 70-degree field of view — roughly 260
 * SCREEN pixels top to bottom whatever the buffer resolution is. That is the hard
 * constraint, so this is six elements and not a dashboard:
 *
 *     the speed, huge          the one number a glance is for
 *     SUBLIGHT, when it is     absent means supercruise; the model only emits the
 *                              tag on `driveOn === false`, strictly
 *     the speed bar            fill = current speed, pin above = commanded,
 *                              tick below = the drop ceiling
 *     THR + its bar            the lever, always bipolar, no pin — added
 *                              2026-07-31; see item 3 above for why it was not
 *                              here before and what changed
 *     CAP and TURN             the two ceilings, small, right-aligned
 *     MODE: …                  the string the HUD renders, uppercased, unchanged
 *     the mass-lock banner     inverted, blinking, no colour
 *
 * ⚠ SIX IS THE CEILING, not a new baseline. The sixth cost a re-check of every
 * clearance on the glass (LAYOUT below has the arithmetic) and it fits because it
 * is a bar with no pin and no ticks. A seventh does not obviously fit anywhere.
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
  // ⭐ THE THROTTLE, added 2026-07-31 (Max's UAT). The clearances above and below
  // it are the whole reason these three numbers are what they are, and a hairline
  // is `body/8` = H/136 ≈ 0.0074H, with the bar's ticks and pin reaching three of
  // them (0.022H) outside the frame:
  //
  //   ABOVE — the speed bar's frame bottoms at 0.400 and its DROP TICK hangs to
  //     0.422. The throttle bar's top at 0.435 clears that by 0.013H, which is
  //     the same clearance the original layout's tightest seam already ran at.
  //   BELOW — no tick, no pin, so 0.485 is the last ink. `ROW_FIRST_BASELINE`
  //     moved 0.52 → 0.545 to keep its 0.013H (a body-size row's ink top is
  //     `baseline - 0.8 × H/17` = 0.498).
  //
  // The rows moving pushed nothing else: the second row's descender now bottoms
  // at 0.651 and MODE's ink starts at 0.713, so that gap grew rather than shrank.
  THR_BAR_TOP: 0.435,
  THR_BAR_HEIGHT: 0.05,
  ROW_FIRST_BASELINE: 0.545,
  MODE_BASELINE: 0.76,
  BANNER_BASELINE: 0.92,
});

/**
 * The gap between the THR label and the bar that follows it, in hairlines.
 *
 * The bar starts from the label's MEASURED ink box, not from a guessed width —
 * `screen.text` hands its box back for exactly this. A hard-coded x would be
 * wrong at any buffer height but the one it was eyeballed at, which is the same
 * mistake writing this layout in pixels would have been.
 */
const THR_LABEL_GAP_HAIRS = 2;

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

  // ── The throttle ──
  // The lever's own position, always bipolar: fill right of the centre zero for
  // forward, left for reverse. The overlay says that difference with cyan vs
  // amber and one ink cannot, so the DIRECTION of the fill carries it — which is
  // the same substitution the sublight speed bar already makes.
  //
  // NO PIN. The overlay draws one at `tbCenterX + (tbW/2)*throttle`, which is
  // precisely where its own fill ends — a marker on the tip of the thing it
  // marks. On black glass the fill's edge already is that mark, so the pin would
  // be redundant ink, and the 0.022H it reaches ABOVE the frame is exactly the
  // clearance this row does not have.
  //
  // A null frac draws the FRAME AND NOTHING INSIDE — no fill, and no zero mark
  // either, since the kit puts the zero mark inside its finite branch. That is
  // the reading this panel needs and could not previously have: an empty
  // instrument says "no throttle data", a centre zero mark says "the lever is at
  // rest", and before the snapshot started writing null those were the same
  // picture. See CockpitSnapshot's `drive.throttle`.
  const thrY = H * LAYOUT.THR_BAR_TOP;
  const thrH = H * LAYOUT.THR_BAR_HEIGHT;
  // Vertically centre the label's ink on the bar rather than sharing a baseline
  // with it: a bar has no baseline, and a label sitting on its bottom edge reads
  // as belonging to whatever is below.
  const thrLabelBaseline = thrY + (thrH + t.label * (0.8 - 0.25)) / 2;
  const thrLabel = screen.text('THR', t.pad, thrLabelBaseline, { size: t.label });
  // `text` returns null for an empty string only; 'THR' always draws. The
  // fallback keeps the bar on the glass rather than at NaN if that ever changes.
  const thrBarX = thrLabel
    ? thrLabel.x + thrLabel.w + screen.hair * THR_LABEL_GAP_HAIRS
    : t.pad;
  screen.bar(
    thrBarX,
    thrY,
    W - t.pad - thrBarX,
    thrH,
    readout.throttleFrac,
    { bipolar: true },
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
