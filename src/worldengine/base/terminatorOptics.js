// src/worldengine/base/terminatorOptics.js — the F35 TERMINATOR BAND's two owned quantities,
// extracted 2026-08-21 (block B3, leg 1) so that ONE function object answers for both front-ends.
//
//     terminatorOpticsOf(condition) -> { termStrength, termWidth, termColor }
//
// ⭐ WHY THIS FILE EXISTS, in one line. `TERM_STRENGTH` and `termWidthFor` lived as MODULE-PRIVATE
// definitions inside src/objects/Planet.js — neither was `export`ed — so nothing under
// `src/worldengine/` could reach them. Ledger row P-11 is the consequence: the three `uTerm*` names
// are written by the legacy game material and by NOTHING on the world-engine side, so a body swapped
// onto the lab material loses the whole band. A pack cannot forward a law it cannot import, and
// re-typing the law inside the pack is the drift this program exists against. So the law moves here
// and BOTH sides import it — the pattern `src/worldengine/base/atmosphereOptics.js` already
// establishes (called from src/objects/Planet.js:1610 `const optics = atmosphereOpticsOf(condition);`
// and from src/worldengine/drivers/limbDeck.js:135 `  const optics = atmosphereOpticsOf(condition);`,
// one function object, both front-ends).
//
// ⛔ NOTHING HERE IS NEW AND NOTHING HERE IS TUNED. Every line below is the shipped text moved, not
// rewritten. The two constants and the one ramp are character-identical to what
// src/objects/Planet.js carried at HEAD `9e81350`. The third expression of them —
// tools/port-condition-delta.mjs's transcription, which existed ONLY because they were unexported —
// is deleted and replaced by a call to this module, so three expressions of one law become one.
// ⚠ That deletion did NOT land in the same commit as this file, contrary to what this comment said
// when it was written mid-stage: the stage was interrupted and the tool was still transcribing.
// It lands in the repair commit that also fixes the five citations the extraction broke.
//
// ⛔⛔ WHY THE MAGNITUDE MAY NOT BE RE-DERIVED HERE, EVER. The comment that rode `TERM_STRENGTH` in
// Planet.js is reproduced verbatim below because it records a defect this codebase has already paid
// for: the value was 0.5, it "swamped the surface into a heavy orange BELT on every atmospheric
// world (Max-reported, all planet types)", and a later port shipped `columnFraction` as the
// magnitude — which saturates to exactly 1.0 above 0.3 bar, i.e. 6.7x the tamed value — and
// reproduced the artifact. `columnFraction` is the AIRLESS GATE. 0.15 is the MAGNITUDE. They are not
// interchangeable and the file that forgets which is which reproduces the belt.
//
// ⛔ THREE-FREE, NO ENTROPY, CONDITION-SHAPED FROM BIRTH. The only import is the sibling optics
// module, which itself imports nothing. No `Math.random`, no `Date.now`, no alea stream, no preset
// name, no `type` label — the reads are `condition.atmosphere?.pressure` and whatever
// `atmosphereOpticsOf` reads, so a pack, a headless test, the lab and the game all get the same
// answer from the same object.
import { atmosphereOpticsOf } from './atmosphereOptics.js';

// Terminator gaussian half-width, in units of dot(N, L) — the LAB'S OWN LAW, ported verbatim from
// planet-lod-lab.html (state.termWidth). It reads only atmosphere.pressure, so it never needed
// anything out of the un-extracted applyDrivers; the earlier provisional 0.18 constant is retired.
// Hairline 0.06 at <= ~0.1 bar, 0.12 at 1 bar, ~0.14 at 1.5 bar, saturating at the 0.30
// Venus-class ceiling. The 1e-3 floor keeps log10 finite on airless bodies, whose width is inert
// behind strength 0 anyway.
export function termWidthFor(pressureBar) {
  const p = Math.max(pressureBar ?? 0, 1e-3);
  return Math.min(0.30, Math.max(0.06, 0.12 + 0.09 * Math.log10(p)));
}

// The terminator MAGNITUDE, also the lab's own value. Tuned in the lab 2026-06-15: it was 0.5, and
// that additive peak "swamped the surface into a heavy orange BELT on every atmospheric world
// (Max-reported, all planet types)". This port originally shipped columnFraction as the magnitude,
// and columnFraction saturates to exactly 1.0 above 0.3 bar — 6.7x the lab's value, which
// reproduced the very artifact the lab had already fixed. columnFraction is retained as the
// airless GATE, which is the part atmosphereOptics.js actually owns.
export const TERM_STRENGTH = 0.15;

/**
 * The three values a terminator band needs, from a condition vector alone.
 *
 * ⚠ IT CALLS `atmosphereOpticsOf` ITSELF rather than taking a pre-computed `optics` argument, and
 * that is deliberate at a measured cost. src/objects/Planet.js already holds an `optics` for the
 * limb, so the game now evaluates the optics law twice per body — pure float arithmetic over ~30
 * lines, no allocation beyond three small arrays, no I/O. The alternative — an optional `optics`
 * parameter — makes it possible to hand this function an optics object derived from a DIFFERENT
 * condition than the pressure it reads, which is a silent wrong answer rather than a slow one.
 *
 * ⛔ `termStrength` is `(columnFraction ?? 0) * TERM_STRENGTH`, character-identical to the
 * expression Planet.js shipped. The `?? 0` is load-bearing on a body whose optics somehow lack the
 * field: a NaN uniform renders as an indistinguishable black frame.
 *
 * ⚠ THE LAB'S OWN STRENGTH EXPRESSION IS THE BINARY planet-lod-lab.html:2497
 * `      state.termStrength = _fp.atmosphere?.retained ? 0.15 : 0.0;` — NOT this continuous one.
 * The game's form is kept because it is the one this row is instructed to forward, and because it
 * agrees with the lab's everywhere except on the thinnest columns.
 *
 * ⛔ THE FIGURE THAT USED TO SIT HERE IS WITHDRAWN. An earlier draft of this file claimed
 * "1139 of 1141" non-gas bodies over `lab-procedural-0…199`. Re-measured 2026-08-21 the count of
 * non-gas bodies came out differently (the moon half depends on which moon records the enumeration
 * admits), so the denominator was not reproducible and publishing a second candidate for it would
 * be guessing twice. WHAT IS REPRODUCIBLE, and was measured twice in one session under two
 * different enumerations of the same corpus: the two expressions disagree on exactly TWO bodies,
 * both of them thin-column worlds whose `columnFraction` has not yet saturated to 1.0
 * (termStrength ≈ 0.1304 and ≈ 0.1303 against the lab's flat 0.15, at ~0.105 bar). The DISAGREEING
 * SET is the load-bearing quantity; the population it sits in is not, and is not restated.
 *
 * @param {object} condition  a body condition vector (deriveConditionVector / conditionFromBody).
 * @returns {{termStrength: number, termWidth: number, termColor: number[]}}
 */
export function terminatorOpticsOf(condition) {
  const optics = atmosphereOpticsOf(condition);
  return {
    termStrength: (optics.columnFraction ?? 0) * TERM_STRENGTH,
    termWidth: termWidthFor(condition?.atmosphere?.pressure),
    termColor: optics.termColor,
  };
}
