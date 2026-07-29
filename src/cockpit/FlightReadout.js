/**
 * FlightReadout — what the DRIVE and TARGET screens say, as plain data.
 *
 * Lane F, workstream `cockpit-screen-content-2026-07-28`.
 *
 * THIS IS A PORT, NOT A DESIGN. Every rule below already ships on the Canvas2D
 * overlay src/ui/SupercruiseHud.js, and that overlay is the thing a pilot has
 * been flying by. The numbers in it come out of the supercruise model and the
 * capture rule in main.js's `_scDropState()`; they are physically true and they
 * are load-bearing — "SAFE TO DROP" is the cue that says a drop-out will actually
 * take, and the speed band is the cue that says whether the approach is going to
 * overshoot. A transcription error here does not produce an ugly panel. It
 * produces a WRONG SAFETY CUE on the screen the pilot is looking at while closing
 * on a planet, which is worse than a blank screen, because a blank screen is
 * obviously broken and a confident wrong one is not.
 *
 * So this module recomputes NOTHING. It is handed exactly the object main.js
 * already builds for `scHud.update` — the same frame's values, not a second
 * sampling of them — and it decides only how to SAY them. The glass and the
 * full-screen HUD therefore cannot disagree within a frame.
 *
 * ── THE TWO DELIBERATE DIVERGENCES FROM THE OVERLAY ─────────────────────────
 *
 * "Recomputes nothing" is about the NUMBERS. It is not a vow to reproduce every
 * line of the overlay's drawing code, and twice it would be wrong to. Both
 * divergences below are asserted AS divergences in the test: the panel's rule
 * pinned, and the overlay's CURRENT form pinned beside it — so the day somebody
 * edits the overlay, these paragraphs get flagged as stale by a red test instead
 * of quietly turning into lies.
 *
 * ── 1. THE PROJECTION GATE IS DROPPED ──
 *
 * The overlay draws the ETA and both drop labels ANCHORED TO THE BODY: it calls
 * `this._project(state.targetPos)` and, when that returns null — the target is
 * behind the camera or off the edge of the screen — it draws neither. That gate
 * is correct for a world-anchored cue. There is nowhere on screen to put a label
 * for a body that is not on screen.
 *
 * A PANEL IS NOT WORLD-ANCHORED. It is a fixed rectangle of glass in the cabin,
 * at a known place, and its text does not point at anything. Carrying the
 * projection gate across would mean the approach warning BLANKS the moment the
 * pilot looks away from the planet they are approaching — which is exactly when a
 * panel is the thing they are reading, and exactly the danger the cue exists to
 * warn about. So the gate is dropped and `hasTarget` alone is the condition. This
 * module therefore has no camera, does no projection, and knows nothing about
 * screen space; that is enforced by a source scan in the test rather than left as
 * an intention.
 *
 * ── 2. THE BAR'S MARKS ARE COMPUTED IN THE BAR'S OWN DOMAIN ──
 *
 * The speed bar has TWO SCALES and which one is live depends on the drive.
 * Supercruise uses `speedToBarFrac`: unsigned, 0..1, logarithmic over four
 * decades. Sublight uses `sublightBarFrac`: SIGNED, -1..+1, linear in the
 * sublight cap, filling from a centre zero so that reverse reads as reverse.
 *
 * The overlay switches the FILL between the two (SupercruiseHud lines ~107-120)
 * and then computes the commanded pin and the drop tick OUTSIDE that branch,
 * with `speedToBarFrac`, unconditionally. Sublight it therefore draws two marks
 * against a scale they were not measured against. This is not a hypothesis;
 * it was read off the running game with the ship reversing sublight:
 *
 *     speed -0.00105625, sublightCap 0.002  → fill  -0.528  (half astern)
 *     commandedSpeed -0.00105625            → pin    0      (DEAD CENTRE)
 *     dropMaxSpeed 0.1                      → tick   0.274
 *
 * The pin is the mark that says what the ship has been ASKED to do, and at 0 on
 * a centre-zero bar it says "commanding a full stop" while the pilot is holding
 * full reverse. So sublight the pin is computed with `sublightBarFrac` and the
 * same substituted cap as the fill, and it tracks the fill the way it is meant
 * to.
 *
 * THE DROP TICK IS NOT RESCALED, IT IS DROPPED, and the reason is not the
 * arithmetic. `dropMaxSpeed` is the ceiling for DROPPING OUT OF SUPERCRUISE.
 * `driveOn === false` means the ship is ALREADY sublight — there is no drop-out
 * to be under the ceiling of, so the mark has no referent at all. It is not
 * mis-placed; it is a safety cue for a manoeuvre the pilot is not performing,
 * and moving it somewhere honest on the scale would still leave it meaning
 * nothing. (The arithmetic agrees, incidentally: that frame's ceiling of 0.1 is
 * FIFTY TIMES the 0.002 cap, so any faithful rescaling pins it hard right
 * forever.) `null` is this module's word for DO NOT DRAW, and both
 * `PhosphorScreen.bar` and DrivePanel already honour it — a non-finite tick is
 * skipped rather than drawn at zero.
 *
 * THE OVERLAY IS LEFT ALONE, deliberately. src/ui/SupercruiseHud.js has this
 * same defect today and fixing it would change what the pilot sees on the live
 * full-screen HUD, in a system this workstream does not own. That is Max's call,
 * not this module's, and the test pins the overlay's present form so the day it
 * is made this comment cannot go quietly out of date.
 *
 * AND THE BAND IS DELIBERATELY *NOT* GIVEN THE SAME TREATMENT, which is worth
 * saying out loud because the argument above appears to demand it. `inWindow`
 * below reads `speed <= dropMaxSpeed` with no `driveOn` gate at all, so on that
 * same measured frame it calls a ship reversing sublight "in-window" off a
 * ceiling that — by the paragraph above — has no referent there. The reasoning
 * is identical; the treatment is not, for two reasons that are about scope and
 * not about the argument. The band is a faithful port of the overlay's colour
 * rule and no panel reads it yet (DrivePanel and TargetPanel both ignore it), so
 * nothing wrong reaches the glass through it; and gating it would be a THIRD
 * divergence, invented rather than forced by something visible in flight. If a
 * panel ever draws the band, gate it here before it does.
 *
 * ── WHAT THIS MODULE DELIBERATELY DOES NOT DO ──────────────────────────────
 *
 *   - NO COLOUR, at any depth. The screens are Phosphor: one ink on black. The
 *     overlay tells its speed bands and its three warnings apart BY FILL COLOUR,
 *     so the naive port carries six of them onto the glass. The speed band is
 *     therefore a three-state ENUM here — the panel decides what a band looks
 *     like in one ink — and the two warnings come from AlertCue.js, which is the
 *     module that owns the words-and-a-blink form. Enforced by a recursive walk
 *     in the test, not by a rule in a design doc.
 *   - NO THROTTLE BAR, no deflection dot, no steering reticle, no capture-sphere
 *     ring. The overlay draws all of those and they are not in this readout. They
 *     are STEERING indicators tied to where the player is pointing right now,
 *     which is the canopy's job, not a panel's; adding them is a scoping decision
 *     for a later AC, made deliberately, not a thing that leaks in because the
 *     input object happens to carry `throttle` and `deflection`.
 *   - NO `visible` GATE. The overlay early-returns on `!state.visible` because it
 *     is a full-screen layer over the game and has to get out of the way (the H
 *     key, warp cutscenes). The glass in the cabin is always physically there, so
 *     whether a panel goes dark is a panel-lifecycle decision made where the
 *     panel is drawn, with the whole frame in hand. This builder always answers.
 */

import { formatSpeed, speedToBarFrac, sublightBarFrac } from '../ui/SpeedFormat.js';
import { etaVisible } from '../ui/SupercruiseHud.js';
import { ALERT_TEXT, BLINK, buildAlertCue } from '../ui/AlertCue.js';

export { ALERT_TEXT, BLINK };

/**
 * The words this module adds on top of AlertCue's three. Copied from the overlay
 * character for character, same as AlertCue's are, and checked against the
 * overlay's own source text in the test — two pieces of chrome saying slightly
 * different things about one condition is the failure being prevented.
 *
 * `REV` is a PREFIX, not a sign: `formatSpeed` takes `Math.abs` of what it is
 * given, so a reversing ship reads the same as a forward one unless the panel
 * says otherwise. Losing this prefix is a silent wrong readout — the number is
 * right, the direction is gone.
 */
export const READOUT_TEXT = Object.freeze({
  REV_PREFIX: 'REV ',
  SUBLIGHT: 'SUBLIGHT',
  ETA_UNKNOWN: '--:--',
  MODE_PREFIX: 'MODE: ',
});

/**
 * The speed band, as an ENUM rather than a colour.
 *
 * The overlay says this with `#ff7b6b` / `#7bff9e` / `#9fe8ff`. One ink cannot,
 * so the band is named and the panel picks the treatment — a brighter fill, a
 * hatched fill, a bracket, whatever reads at seventeen degrees of arc. Naming it
 * also makes the meaning testable, which a fillStyle string never was.
 */
export const SPEED_BAND = Object.freeze({
  NORMAL: 'normal',
  IN_WINDOW: 'in-window',
  TOO_FAST: 'too-fast',
});

/**
 * "There is a target this frame", in the one form this module can honestly hand
 * back through the snapshot adapter.
 *
 * The overlay's `targetPos` is a live `THREE.Vector3` — the selected body's
 * `mesh.position` — and CockpitSnapshot deliberately carries no such thing,
 * because a live mesh position is precisely the reference that outlives a warp.
 * The port reads `targetPos` for TRUTHINESS ONLY (the projection gate is gone;
 * see the header), so the adapter passes this sentinel rather than a plausible
 * `{x, y, z}`. A fake position would be a lie that some future caller would
 * eventually read as a real one.
 */
export const TARGET_PRESENT = Object.freeze({ targetPresent: true });

/**
 * Seconds → "M:SS". Minutes unpadded, seconds zero-padded to two — copied off
 * SupercruiseHud so a glance from the glass to the HUD shows the same shape of
 * number. Returns null for anything that is not a finite count of seconds, and
 * the caller turns that into the '--:--' placeholder; the overlay does the same
 * thing with a `Number.isFinite` guard around its assignment.
 */
function formatEta(seconds) {
  if (!Number.isFinite(seconds)) return null;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Build one frame's DRIVE + TARGET readout.
 *
 * @param {object} [state] exactly the object main.js hands `scHud.update`:
 *   { visible, speed, commandedSpeed, driveOn, sublightCap, massLockHint,
 *     throttle, deflection, targetPos, targetDistance, aimOnTarget,
 *     captureSphere, dropMaxSpeed, dropState, flightMode, showReticle }
 * @returns {{
 *   speedText: string,
 *   sublightTag: string|null,
 *   band: 'normal'|'in-window'|'too-fast',
 *   bar: {frac:number, bipolar:boolean, commandedFrac:number, dropTickFrac:number|null},
 *   eta: string|null,
 *   drop: {text:string, blink:string}|null,
 *   massLock: {text:string, blink:string}|null,
 *   modeLine: string|null,
 * }}
 *
 * READING `bar`: `bipolar` is not decoration, it names the DOMAIN the other
 * three fields are in. False → `frac` and `commandedFrac` are unsigned 0..1 log
 * fractions and `dropTickFrac` may be one too. True → they are signed -1..+1
 * linear fractions of the sublight cap, and `dropTickFrac` is always null. A
 * consumer that ignores `bipolar` and assumes one domain will be right half the
 * time and confidently wrong the other half.
 */
export function buildFlightReadout(state = {}) {
  const speed = state.speed || 0;
  const hasTarget = !!state.targetPos;
  const dropMaxSpeed = state.dropMaxSpeed;

  // ── The number ──
  // formatSpeed returns a MAGNITUDE, so the sign is this panel's job. Same two
  // lines as the overlay, in the same order.
  const spd = formatSpeed(speed);
  const speedText = `${speed < 0 ? READOUT_TEXT.REV_PREFIX : ''}${spd.value} ${spd.unit}`;

  // The SUBLIGHT tag keys on `driveOn === false`, STRICTLY. Not `!driveOn`: a
  // frame that never set the field would then claim the drive is down, which is
  // the readout saying the ship left supercruise when it did not.
  const sublightTag = state.driveOn === false ? READOUT_TEXT.SUBLIGHT : null;

  // ── The bar ──
  // Two different scales, because one cannot cover both regimes. Supercruise is
  // log over four decades; sublight is a linear bipolar scale centred on zero,
  // since the log bar reads empty across the whole sublight range.
  //
  // THE TRAP: speedToBarFrac IS NOT ABS-SAFE. It does log10 of the speed, so a
  // reversing ship (negative speed) clamps to an EMPTY bar while the numeric
  // readout next to it says REV 0.50 c. The overlay passes Math.abs(speed) for
  // exactly this reason and says so in a comment; dropping the Math.abs is a
  // one-character regression that no eyeball catches at a glance.
  const bipolar = state.driveOn === false;
  const frac = bipolar
    ? sublightBarFrac(speed, state.sublightCap || 1)
    : speedToBarFrac(Math.abs(speed));

  // THE PIN IS COMPUTED IN WHICHEVER DOMAIN THE BAR IS IN. The three lines above
  // just chose between a signed linear scale and an unsigned log one; a pin
  // produced by the other rule is a mark drawn against a scale it was never
  // measured against, and the bar has no way to tell. Divergence 2 in the header
  // has the frame this was read off: the overlay's unconditional form puts the
  // pin at dead centre — "full stop" — while the ship is commanding full reverse.
  //
  // `state.sublightCap || 1` is repeated here rather than hoisted, and it must
  // stay IDENTICAL to the fill's: substituting a cap on one of the two lines and
  // not the other puts the fill and the pin on scales that differ by a factor of
  // the cap, which is this same defect arriving by a quieter door.
  //
  // UNIPOLAR, the commanded speed is deliberately NOT abs'd — that is the
  // overlay's behaviour and not an oversight. A negative command clamps to the
  // empty end, which is where "you have asked for reverse" belongs on a
  // forward-only scale. BIPOLAR there is nothing to throw away: the scale has a
  // left-hand side, and having one is the entire reason it exists.
  const commandedFrac = bipolar
    ? sublightBarFrac(state.commandedSpeed || 0, state.sublightCap || 1)
    : speedToBarFrac(state.commandedSpeed || 0);

  // The drop tick marks the speed ceiling a drop-out will take at. Three ways it
  // is absent, and the third is the one that is not obvious:
  //
  //   - no target selected, so there is nothing to drop toward;
  //   - a target, but no ceiling computed for it yet;
  //   - THE DRIVE IS ALREADY DOWN. `dropMaxSpeed` is the ceiling for DROPPING
  //     OUT OF SUPERCRUISE; `driveOn === false` says the ship is already
  //     sublight. The mark is not merely mis-scaled there, it has no referent —
  //     it is a safety cue for a manoeuvre the pilot is not performing, so
  //     rescaling it into the bipolar domain would place it precisely and still
  //     say nothing true. Dropping it is the only honest answer.
  //
  // null, never 0. A tick at zero reads as a real limit — "you must be stopped
  // to drop" — which is an instruction, and an invented one. PhosphorScreen.bar
  // skips a non-finite tick and DrivePanel forwards it untouched, so no caller
  // needs a branch for this.
  const dropTickFrac = !bipolar && hasTarget && dropMaxSpeed != null
    ? speedToBarFrac(dropMaxSpeed)
    : null;

  // ── The band ──
  // The overlay's `inWindow` is DELIBERATELY WIDER than the raw dropState: it is
  // also true when a target is selected and the ship is already under the drop
  // ceiling, even from outside the capture sphere, so the bar starts reading
  // "this approach speed is fine" on the way in rather than only at the sphere.
  // `too-fast` wins over it, matching the overlay's ternary order.
  const inWindow = state.dropState === 'in-window'
    || (hasTarget && dropMaxSpeed != null && speed <= dropMaxSpeed);
  const band = state.dropState === 'too-fast'
    ? SPEED_BAND.TOO_FAST
    : inWindow ? SPEED_BAND.IN_WINDOW : SPEED_BAND.NORMAL;

  // ── The ETA ──
  // Contextual: the line exists only while the aim point is over the body being
  // travelled toward. Aim away and it goes entirely, rather than leaving a
  // '--:--' lingering — that placeholder is for aimed-on-but-not-yet-moving.
  // (`hasTarget` is the port's condition here; the overlay additionally required
  // the body to project onto the screen. See the header for why a panel does not.)
  let eta = null;
  if (hasTarget && state.aimOnTarget) {
    eta = READOUT_TEXT.ETA_UNKNOWN;
    if (etaVisible({ speed, targetDistance: state.targetDistance, aimOnTarget: state.aimOnTarget })) {
      eta = formatEta(state.targetDistance / speed) ?? READOUT_TEXT.ETA_UNKNOWN;
    }
  }

  // ── The two warnings ──
  // Words and a blink tier, from the module that owns them.
  //
  // *** THE LABELS USE THE RAW dropState, NOT THE WIDER `inWindow` ABOVE. ***
  // That is the overlay's behaviour and it is not an inconsistency to tidy up.
  // The BAR is a continuous "how does this approach look" cue and may lean
  // optimistic early. The LABEL is a discrete instruction — "SAFE TO DROP" means
  // press the button NOW and the drop-out will take — and the capture rule in
  // main.js's `_scDropState()` only returns 'in-window' INSIDE the 10R capture
  // sphere. Widening the label to `inWindow` would print SAFE TO DROP while the
  // ship is still outside the sphere, where a drop-out does nothing. That is a
  // wrong safety cue, which is the single worst thing this module can ship.
  const cue = buildAlertCue({ dropState: state.dropState, massLockHint: state.massLockHint });

  return {
    speedText,
    sublightTag,
    band,
    bar: { frac, bipolar, commandedFrac, dropTickFrac },
    eta,
    // Gated on hasTarget only: no target, no approach label. The cue object
    // itself is AlertCue's shared frozen value, handed straight back so a panel
    // can compare it by identity across frames and skip re-rasterising.
    drop: hasTarget ? cue.drop : null,
    // NOT gated on a target. Mass-lock says the drive refused to re-engage HERE;
    // it is about the ship's surroundings, not about a selection, and the
    // overlay draws it as its own banner outside the `if (hasTarget)` block.
    massLock: cue.massLock,
    // The raw string, uppercased — which is what the overlay renders. It does
    // NOT route through flightModeInfo, so neither does this.
    modeLine: state.flightMode ? `${READOUT_TEXT.MODE_PREFIX}${String(state.flightMode).toUpperCase()}` : null,
  };
}

/**
 * Map a CockpitSnapshot onto the input `buildFlightReadout` takes.
 *
 * Deliberately dumb: field for field, no logic, no recomputation. The point is
 * that the runtime path and the tested path are THE SAME FUNCTION — a panel
 * calls this and then the builder, and every truth-table test above exercises
 * the builder directly, so there is no second implementation to drift.
 *
 * TWO SEAMS WORTH KNOWING ABOUT, because neither is a clean one-to-one:
 *
 *  1. THE SNAPSHOT HAS NO `targetPos`, and should not — it is a live mesh
 *     position. What it has is `target.distance`, which main.js computes as
 *     `_scTargetPos ? scModel.position.distanceTo(_scTargetPos) : null` at BOTH
 *     call sites (the one feeding the overlay and the one feeding this snapshot,
 *     from the same frame local). So `distance != null` is true in exactly the
 *     frames `targetPos` is non-null. It is the presence signal, and it is the
 *     ONLY one — `distanceTo` always returns a number, including 0, so a target
 *     the ship is sitting on top of still registers.
 *
 *     `target.kind` / `target.name` are NOT a usable backstop and must not be
 *     ORed in here, however tempting the "a frame with a target but no distance
 *     yet" story sounds. They come from a DIFFERENT feed — `_selectedTarget` —
 *     and it disagrees with `_scTargetPos` in both directions:
 *       · on an autopilot tour with nothing player-selected, kind/name are null
 *         while `_scTargetPos` falls back to `scControls.target.mesh.position`,
 *         so the drop window is live and a kind-based signal would go silent;
 *       · a selection whose body `_resolveSelectedBody()` can no longer resolve
 *         leaves kind/name set while `_scTargetPos` is null, so a kind-based
 *         signal fires where the overlay shows nothing — the panel would sit
 *         there counting '--:--' toward a body that is not being tracked.
 *     The second one is the reason the OR is worse than useless: it can only
 *     ever add frames the overlay does not have, which is precisely the
 *     direction a port is not allowed to drift.
 *  2. `flightMode` lives in `snapshot.regime`, not in `drive`. Same value, same
 *     gate (main.js writes `_scManual ? _flightMode : null` into both).
 *
 * @param {object} [snapshot] one frame from CockpitSnapshotProvider.get()
 * @returns {object} the `scHud.update`-shaped state
 */
export function flightReadoutStateFromSnapshot(snapshot = {}) {
  const drive = snapshot.drive ?? {};
  const target = snapshot.target ?? {};
  const regime = snapshot.regime ?? {};

  // Distance alone. See seam 1 above for why kind/name may not be ORed in.
  const hasTarget = target.distance != null;

  return {
    speed: drive.speed ?? 0,
    commandedSpeed: drive.commandedSpeed ?? 0,
    // The snapshot always writes a boolean here (`scModel?.driveOn ?? false`).
    // The `?? false` mirrors that default rather than inventing a different one:
    // a frame with no drive block reads as sublight, which shows the tag and the
    // bipolar bar — the conservative direction, since claiming supercruise the
    // ship does not have is the reading that misleads.
    driveOn: drive.driveOn ?? false,
    sublightCap: drive.sublightCap ?? 0,
    throttle: drive.throttle ?? 0,

    targetPos: hasTarget ? TARGET_PRESENT : null,
    targetDistance: target.distance ?? null,
    aimOnTarget: !!target.aimOnTarget,
    captureSphere: target.captureSphere ?? null,
    dropMaxSpeed: target.dropMaxSpeed ?? null,
    dropState: target.dropState ?? 'none',
    massLockHint: !!target.massLockHint,

    flightMode: regime.flightMode ?? null,
  };
}
