/**
 * AlertCue — the approach/mass-lock warnings, said in WORDS AND A BLINK ONLY.
 *
 * Lane F, workstream `cockpit-screen-content-2026-07-28`, AC-ALERT-CUE-ONE-INK.
 *
 * Why this module exists at all, given src/ui/SupercruiseHud.js already draws
 * these three warnings:
 *
 * The cockpit screens are Phosphor. ONE INK on black, monochrome by law — a CRT
 * behind glass has exactly one emitter colour, and the moment a second hue lands
 * on the glass the whole conceit collapses. The full-screen 2D HUD is under no
 * such law, and it has spent its whole life distinguishing these warnings BY
 * COLOUR: a green fill for the safe-to-drop label, an amber one for slow down,
 * a red one for the mass-lock banner. The words are almost redundant there; the
 * colour is doing the work.
 *
 * So the obvious move — port the HUD's drop-label block onto a panel — carries
 * three fillStyle assignments straight onto the glass and breaks the aesthetic
 * on the first frame anybody actually flies close to a planet. Copy-paste is not
 * a hypothetical here: the block is fifteen lines and reads like it wants to be
 * reused.
 *
 * The defence is mechanical, not disciplinary. This module returns TEXT AND A
 * BLINK TIER and nothing else, and its test walks the returned object to whatever
 * depth it has and permits only two things at each step: a container, or a string
 * from the pinned vocabulary. Stating it as a whitelist rather than a list of
 * banned colour spellings is deliberate — `colorHex: 0xff7b6b` is the HUD's red
 * exactly, in the form three.js takes, and contains no '#', no 'rgb(' and no
 * colour word for a blacklist to catch. A future author who "just needs a tint"
 * has to fight the test rather than remember a rule from a design doc. Urgency is
 * carried by the blink tier —
 * steady, slow, fast — which is a brightness-over-time signal and therefore
 * something one ink can actually say.
 *
 * THE TWO FIELDS ARE INDEPENDENT. `drop` and `massLock` are reported separately
 * and neither suppresses the other, because they are not the same axis and never
 * were: SupercruiseHud draws the mass-lock line as its OWN centre-screen banner
 * (`if (state.massLockHint)`, its own fillText, at cx / cy+48), not as a fourth
 * value of dropState. Mass-lock says "the drive will not re-engage here"; the
 * drop state says "here is how your approach speed looks". They can be true at
 * the same time and both want saying. So there is NO precedence rule to get
 * wrong, and the 3 x 2 truth table has no interaction terms — every row is just
 * its two inputs read separately. If a panel later has room for only one line,
 * that is a LAYOUT decision made at the panel, with the full cue in hand; it is
 * not a decision this module is allowed to make on the panel's behalf.
 *
 * STRINGS ARE COPIED FROM THE HUD, CHARACTER FOR CHARACTER. Note the em dash
 * (U+2014, spaced) in the mass-lock line — that is literally what the HUD draws
 * today. The test asserts these against SupercruiseHud.js's own source text, so
 * if a future panel font turns out to lack the em dash, the string changes in
 * BOTH places or the suite goes red. Two ships' worth of chrome saying slightly
 * different things about the same danger is the failure being prevented.
 */

/**
 * The exact words. These are the HUD's strings, not paraphrases of them —
 * a player glancing between the glass and the full-screen HUD must not see two
 * different warnings for one condition.
 */
export const ALERT_TEXT = Object.freeze({
  DROP_SAFE: 'SAFE TO DROP',
  DROP_SLOW: 'SLOW DOWN',
  MASS_LOCK: 'TOO CLOSE — SUBLIGHT ONLY',
});

/**
 * The same three cues at the width a cockpit panel actually has.
 *
 * ⭐ ADDED 2026-09-08 for `chrome-and-ui-at-240p`. A banner spans the panel edge to edge, and at
 * the game's resolution that is EIGHT characters on the upper pair (DRIVE, NAV) and NINE on the
 * lower (TARGET, INFO). The shipped MASS_LOCK line is twenty-five. A banner whose words run off
 * both edges is worse than a shorter one: an inverted band is recognisable before any of its
 * letters are, so it would still read as an alarm while saying nothing.
 *
 * ⛔ BESIDE `ALERT_TEXT`, NEVER INSTEAD OF IT. Max, 2026-09-08: *"don't get rid of any code that
 * allows you to display what we want to display."* The DOM overlay is not being coarsened and
 * still draws the long form; these are what the glass can hold, and the two are checked against
 * each other by the test that pairs their keys.
 *
 * MASS_LOCK loses its word space rather than a word: "TOO CLOSE" is nine characters and the upper
 * panel has eight, and of the two facts in that line — you are too close, and you are therefore
 * sublight only — the first is the one the pilot can act on.
 */
export const ALERT_BRIEF = Object.freeze({
  DROP_SAFE: 'SAFE DROP',
  DROP_SLOW: 'SLOW DOWN',
  MASS_LOCK: 'TOOCLOSE',
});

/**
 * The panel form of a cue's words, by lookup rather than by truncation.
 *
 * ⚠ FALLS BACK TO THE FULL STRING, DELIBERATELY. A cue added to `ALERT_TEXT` without a brief form
 * then draws too long and is VISIBLY wrong on the glass, which is a bug that gets found. Returning
 * a silently truncated string instead would be a bug that ships.
 */
export function briefAlert(text) {
  for (const key of Object.keys(ALERT_TEXT)) {
    if (ALERT_TEXT[key] === text) return ALERT_BRIEF[key] ?? text;
  }
  return text;
}

/**
 * How hard the line insists. This is the ONLY urgency channel a one-ink panel
 * has left once colour is off the table, so it carries the whole gradient:
 * `steady` is a lit line that does not blink at all (reassurance — "you are
 * fine, drop when you like"), `slow` is a nag, `fast` is an alarm. Naming the
 * tiers rather than handing out hertz keeps the actual rate a renderer-side
 * taste knob; the panel decides what slow and fast look like on its own glass.
 */
export const BLINK = Object.freeze({ STEADY: 'steady', SLOW: 'slow', FAST: 'fast' });

/**
 * dropState → the cue for it. A table, not an if-chain, so the mapping is one
 * readable thing and adding a state is adding a row.
 *
 * 'none' is deliberately absent rather than mapped to some empty cue: no cue is
 * `null`, which a panel can test in one place, instead of a truthy object whose
 * blank text quietly draws nothing.
 *
 * Frozen, and returned by reference — the cue for a given state is the same
 * value every frame, so a panel that stashes last frame's cue to detect a change
 * can compare identity. Freezing means it cannot be tinted after the fact
 * either, which is the same property the tests enforce at the source.
 */
const DROP_CUE = Object.freeze({
  'in-window': Object.freeze({ text: ALERT_TEXT.DROP_SAFE, blink: BLINK.STEADY }),
  'too-fast': Object.freeze({ text: ALERT_TEXT.DROP_SLOW, blink: BLINK.SLOW }),
});

/** The mass-lock banner. Fast blink: the drive just refused a command. */
const MASS_LOCK_CUE = Object.freeze({ text: ALERT_TEXT.MASS_LOCK, blink: BLINK.FAST });

/** The drop states this module knows how to say. Anything else is a seam bug. */
const KNOWN_DROP_STATES = Object.freeze(['none', ...Object.keys(DROP_CUE)]);

/**
 * Build the alert cue for one frame.
 *
 * The two inputs are exactly the two values main.js already computes and hands
 * to `scHud.update` — `_scDropState().state` and `_massLockHintFrames > 0` —
 * which reach a panel as `snapshot.target.dropState` and
 * `snapshot.target.massLockHint`. Nothing is recomputed here, so the glass and
 * the 2D HUD cannot disagree within a frame; this module only decides how to
 * SAY what main.js already decided.
 *
 * Unrecognised dropState values THROW, naming the value. The silent alternative —
 * return no cue — is the bad failure: main.js renaming its enum (say 'in-window'
 * becomes 'in_window') would blank the approach warning forever, on the one screen
 * a pilot is looking at while closing on a planet, with nothing anywhere to say
 * so. Exactly two values are exempt: `null` and `undefined`, which mean "no drop
 * information this frame" and are read as 'none'. The empty string is NOT exempt —
 * `??` does not catch it and nothing upstream produces it, so it takes the
 * unknown-state path like any other string that is not one of the three.
 *
 * @param {object} [input]
 * @param {'none'|'in-window'|'too-fast'} [input.dropState] approach classification
 * @param {boolean} [input.massLockHint] the drive refused to re-engage here
 * @returns {{drop: {text:string, blink:string}|null,
 *            massLock: {text:string, blink:string}|null}}
 */
export function buildAlertCue({ dropState = 'none', massLockHint = false } = {}) {
  const state = dropState ?? 'none';
  if (!KNOWN_DROP_STATES.includes(state)) {
    throw new Error(
      `buildAlertCue: unknown dropState ${JSON.stringify(state)}. ` +
      `Known states: ${KNOWN_DROP_STATES.join(', ')}. ` +
      `main.js's _scDropState() is the source of this enum — if it was renamed, ` +
      `rename it here too rather than letting the approach cue go silent.`,
    );
  }

  return {
    drop: DROP_CUE[state] ?? null,
    massLock: massLockHint ? MASS_LOCK_CUE : null,
  };
}
