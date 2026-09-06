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
import { buildFlightReadout, flightReadoutStateFromSnapshot, READOUT_TEXT } from '../FlightReadout.js';
import { briefAlert } from '../../ui/AlertCue.js';
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
// ⛔ `LAYOUT` IS GONE, AND ITS FRACTIONS ARE THE REASON. It placed every element at a fraction of
// the buffer height — HERO_BASELINE 0.20, MODE_BASELINE 0.76 — which was right for a 512-tall panel
// canvas and is wrong the moment the panel IS the game's 43 rows: 0.76 of 43 is 32.68, and a glyph
// on a fractional baseline is resampled into exactly the grey fringe this workstream removes. The
// replacement is `lineTop(i)`/`baseline(i)` inside the painter, in whole grid units.
//
// The clearance arithmetic those fractions encoded is not lost, it is satisfied by construction: a
// grid slot is a cell plus a row of air, so nothing can overlap anything without the row count
// exceeding the panel, which `typeScale().lines` reports and this painter honours.

/**
 * The mode, without the prefix.
 *
 * "MODE: MANUAL" is twelve characters and the panel is eight. The prefix is stripped with the
 * model's OWN constant rather than a magic string: if `MODE_PREFIX` is ever renamed, this stops
 * stripping and prints the long form — visibly wrong on the glass — instead of silently slicing six
 * characters off a string that no longer starts with it.
 */
export function shortMode(modeLine) {
  if (typeof modeLine !== 'string' || !modeLine) return modeLine ?? null;
  const p = READOUT_TEXT.MODE_PREFIX;
  return modeLine.startsWith(p) ? modeLine.slice(p.length) : modeLine;
}

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
export function formatSpeedCap(sceneUPerSec) {
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
export function formatTurnCap(radPerSec) {
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

  const W = screen.width;
  const t = screen.type;

  // The host does NOT clear before calling a painter (it owns no palette, so it
  // cannot choose a background colour). Without this the panel overprints itself
  // into mush within a second.
  screen.clear();

  // ── THE GRID ──
  //
  // ⛔ NOT SEVEN EVEN SLOTS. DRIVE IS THE ONE PANEL THAT CANNOT USE THEM, and finding out why cost
  // a collision: `bar()` draws its commanded PIN two hairlines ABOVE the frame and its drop TICK
  // two BELOW, so a bar needs nine rows of clearance where a line of type needs five. Dropped into
  // a six-row slot, the pin overlapped the tier line above it and the tick overlapped the throttle
  // frame below — both invisible in a spec and both real on the glass.
  //
  // So this panel's rows are stated, in grid units, and the arithmetic is next to them. The budget
  // is the upper panel's 43 rows (`chrome-240p-BATCH-PLANS.md` §1):
  //
  //     pad 1 + hero 10 + gap 1 + tier 5 + gap 1 + [pin 2 + bar 5 + tick 2] + gap 1
  //             + throttle 5 + gap 1 + mode 5 + pad 1  =  40, inside 43.
  //
  // ⚠ THE BANNER TAKES THE MODE LINE RATHER THAN A ROW OF ITS OWN. There is no room for a seventh
  // element, and an alert outranks a mode readout: while you are mass-locked, "you are too close"
  // is the thing to know and "MANUAL" is not. It is also how the panel behaved before this
  // workstream, where the banner sat at 0.92H over whatever was there.
  const u = t.unit;
  const ROW = {
    hero:     { top: 1 * u,  h: t.display },
    tier:     { top: 12 * u, h: t.body },
    bar:      { top: 20 * u, h: t.body },   // pin reaches to 18u, tick to 27u
    throttle: { top: 28 * u, h: t.body },
    mode:     { top: 35 * u, h: t.body },
  };
  const baseline = (r) => ROW[r].top + ROW[r].h;

  // ── The hero ──
  // ⭐ THE LARGEST SIZE THAT FITS, CHOSEN FROM THE MEASUREMENT RATHER THAN ASSUMED.
  // The display tier is two cells tall, so it holds only FOUR characters on a
  // 51-texel panel — and `formatSpeed` emits five and six ("1,996", "999.99").
  // Drawing a six-character number at the display size would run it off both
  // edges; picking the body size unconditionally would mean the panel has no hero
  // at all. So the panel asks the kit how many characters each tier holds and
  // takes the bigger one that works.
  // ⛔ AND THE STRING IS STILL THE MODEL'S, UNTOUCHED. No reformatting, no dropped
  // decimal, no thousands separator stripped: the moment this file interpolates
  // its own number, the glass and the HUD can disagree about the same speed.
  // `speedValue` is the model's own splitting of the same reading `speedText`
  // composes — the unit is on the tier line below, not thrown away here.
  const speed = readout.speedValue ?? '';
  const heroSize = speed.length <= screen.colsAt(t.display) ? t.display : t.body;
  screen.text(speed, W / 2, ROW.hero.top + heroSize, { size: heroSize, align: 'centre' });

  // ── The tier and the drive state ──
  // `sublightTag` is null while the drive is up, so supercruise is still said by
  // the ABSENCE of the word and no branch is needed to say it. The unit joins it
  // because eight characters is exactly "SUB km/s" and a hero number with no unit
  // under it is a number that means nothing.
  screen.text(readout.tierLine, W / 2, baseline('tier'), { align: 'centre' });

  // ── The speed bar ──
  // Every fraction comes from the model, in the model's own domain: `bipolar`
  // decides whether `frac` runs 0..1 from the left or -1..+1 from the centre, and
  // the kit reads the pin and the ticks in whichever domain the bar is in. A
  // non-finite tick fraction is skipped by the kit rather than drawn at zero, so
  // "no drop ceiling computed" needs no branch here either.
  screen.bar(t.pad, ROW.bar.top, W - t.pad * 2, ROW.bar.h, readout.bar.frac, {
    bipolar: readout.bar.bipolar,
    ticks: [{ frac: readout.bar.dropTickFrac }],
    pin: readout.bar.commandedFrac,
  });

  // ── The throttle ──
  // The lever's own position, always bipolar: fill right of the centre zero for
  // forward, left for reverse. The overlay says that difference with cyan vs
  // amber and one ink cannot, so the DIRECTION of the fill carries it.
  //
  // NO PIN AND NO TICK HERE, which is also why it needs only five rows: the overlay draws a pin at
  // exactly where its own fill ends — a marker on the tip of the thing it marks — and on black
  // glass the fill's edge already is that mark.
  //
  // A null frac draws the FRAME AND NOTHING INSIDE — no fill, and no zero mark
  // either. An empty instrument says "no throttle data"; a centre zero mark says
  // "the lever is at rest", and before the snapshot started writing null those
  // were the same picture. See CockpitSnapshot's `drive.throttle`.
  const thrLabel = screen.text('THR', t.pad, baseline('throttle'));
  // `text` returns null for an empty string only; 'THR' always draws. The
  // fallback keeps the bar on the glass rather than at NaN if that ever changes.
  const thrBarX = thrLabel
    ? thrLabel.x + thrLabel.w + screen.hair * THR_LABEL_GAP_HAIRS
    : t.pad;
  screen.bar(thrBarX, ROW.throttle.top, W - t.pad - thrBarX, ROW.throttle.h,
    readout.throttleFrac, { bipolar: true });

  // ── The mode ──
  // ⛔ CAP AND TURN USED TO LIVE HERE AND MAX CUT THEM, 2026-09-08 ("1, okay").
  // The panel is 43 rows; the hero takes ten of them and the speed bar nine with
  // its marks, and the two ceilings were the rows with nowhere to go. CAP's real
  // job — how much of the bar is available right now — is already drawn as the
  // drop tick on the speed bar above, and TURN is a slowly-changing derived
  // number that nothing in the flight loop asks the pilot to act on.
  // `formatSpeedCap`/`formatTurnCap` are exported and still tested rather than
  // deleted: Max's ruling came with *"don't get rid of any code that allows you to
  // display what we want to display"*, and he expects to revisit these panels.
  //
  // The prefix goes because "MODE: MANUAL" is twelve characters on an eight
  // character panel. It is stripped with the model's own constant rather than a
  // magic string, so a rename there cannot leave this reaching for a prefix that
  // no longer exists — it would simply stop stripping, and print the long form,
  // which is visible rather than silent.
  // ⛔ AND IT IS SKIPPED WHILE THE BANNER IS LIT, rather than painted under it. The banner occupies
  // this exact line — there is no room for a seventh element on a 43-row panel — so drawing both
  // put an ink block over live type, which happens to look right only because the block is opaque.
  // Deciding it here makes the layout honest: at most one of the two is ever on the glass, and the
  // panel-overlap guard in the tests can be total instead of carrying an exemption.
  const alerting = !!readout.massLock && blinkOn(readout.massLock.blink, nowMs);
  if (!alerting) screen.text(shortMode(readout.modeLine), t.pad, baseline('mode'));

  // ── The one warning that belongs to the drive ──
  // The cue carries words and a blink TIER and no colour at all. Urgency is
  // inversion plus time; `banner` supplies the inversion, `blinkOn` supplies the
  // time, and the panel simply does not call `banner` on a dark phase.
  //
  // The `readout.massLock &&` half of this guard is load-bearing: `blinkOn`
  // THROWS on an unknown tier by design, and `undefined` is an unknown tier, so
  // asking it about a cue that is not there would take the whole panel down
  // through PanelHost's painter catch and leave the screen frozen.
  if (alerting) {
    screen.banner(briefAlert(readout.massLock.text), baseline('mode'));
  }
}

export default paintDrive;
