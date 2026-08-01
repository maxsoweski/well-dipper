/**
 * InfoPanel — what the INFO screen draws.
 *
 * Lane F, workstream `cockpit-screen-content-2026-07-28`, AC-PANEL-CONTENT.
 *
 * The dossier on whichever body is focused: what it is called, what class of
 * thing it is, what it is made of, whether it has air, whether it is tidally
 * locked, and how hot it is. That last one — the equilibrium temperature the
 * planet generator has always computed and no readout in the game has ever shown
 * — is the reason this panel is worth building at all.
 *
 * ── THIS PAINTER IS TWENTY LINES BECAUSE THE PIPELINE IS THE DELIVERABLE ────
 *
 * Max's steer for this screen was about ARCHITECTURE, not fields: "we can
 * expand/adjust the systems generating that info in the future; we just need a
 * well-architected pipeline for that info to get to the screen." InfoReadout.js
 * is that pipeline. It holds one table, `INFO_ROWS`, where each row says what it
 * is called, where to read it, and how to write it down — so adding or dropping a
 * field is one line in one file.
 *
 * The whole point of that is lost if the painter knows anything about the fields.
 * So this file does not name a single one of them. It asks `buildInfoRows` for an
 * ordered list of `{label, value}` and draws the list. Add T_EQ's neighbour
 * tomorrow and this file does not change; that is the property being protected,
 * and the test for it is that the panel renders an EXTENDED table with no edit
 * here.
 *
 * Everything that could go wrong with a value has already gone right by the time
 * it arrives: a reader that throws, a formatter that does not recognise a shape, a
 * value that stringifies to "[object Object]", a line too long for the glass —
 * every one of those converges on a blank string inside `renderInfoValue`, before
 * this file sees it. In particular MISSING MEANS BLANK IS ENFORCED THERE, ahead of
 * the formatter, which is what stops a missing temperature rendering as an
 * authoritative "0 K". T_eq is written onto PLANET data only, so a focused moon,
 * a focused star and a cleared focus all produce exactly that case, on ordinary
 * frames, not in some edge condition.
 *
 * ── EVERY ROW ALWAYS DRAWS, BLANK OR NOT ────────────────────────────────────
 *
 * `buildInfoRows` returns one entry per table row whether or not it has a value,
 * and the kit's `row()` draws the label even when the value is empty. Both halves
 * are deliberate and they are the same rule: a row that vanished when its value
 * went missing would make every row beneath it jump up the glass, and a pilot
 * glancing at a moving readout reads the wrong line. A blank line holds its place.
 *
 * The consequence worth stating plainly: with nothing focused, this panel shows
 * seven labels and no values. That is correct. It reads as an instrument with
 * nothing to report, which is the truth, rather than as a broken screen or — far
 * worse — as a body made of nothing at zero kelvin.
 *
 * ── SEVEN ROWS IS THE BUDGET, NOT AN ACCIDENT ───────────────────────────────
 *
 * The panel subtends about 17 degrees of a 70-degree field of view, so it is
 * roughly 260 screen pixels tall and its rows land at about 13 screen pixels of
 * value against 11 of label. That is legible and it is not generous. The type
 * scale was chosen with this table in front of it — PhosphorScreen's header does
 * the arithmetic: a `lead` of H/12 gives twelve baselines, and seven rows fit with
 * room to spare, deliberately not tight.
 *
 * If an eighth and ninth row ever arrive, the answer is NOT a smaller `lead` and
 * NOT a smaller size. The kit throws below H/24 for exactly that request. The
 * answer is that INFO_ROWS is a table and something comes off it.
 */

import { buildInfoRows } from '../InfoReadout.js';

/**
 * The first row's baseline, as a fraction of the buffer height. Subsequent rows
 * step by the type scale's own `lead`, so the block re-spaces itself correctly if
 * the scale is ever retuned, and stays vertically centred-ish on the glass for the
 * seven rows the table has today.
 */
const FIRST_ROW_BASELINE = 0.23;

/**
 * Paint the INFO screen.
 *
 * `nowMs` is accepted and unused: this panel has no blinking element, because
 * nothing in a dossier is a warning. The parameter stays in the signature so all
 * three painters have one shape and can be registered interchangeably — a painter
 * with a different arity is a wiring bug waiting to happen.
 *
 * @param {import('../PhosphorScreen.js').PhosphorScreen} screen the drawing kit
 * @param {object|null} snapshot one frame from CockpitSnapshotProvider.get()
 * @param {number} [nowMs] the render-cadence clock; unused here
 */
export function paintInfo(screen, snapshot, nowMs) {   // eslint-disable-line no-unused-vars
  // The host does not clear before a painter runs — it owns no palette and so
  // cannot pick a background colour. Without this the rows overprint each other
  // into an unreadable smear as values change.
  screen.clear();

  const rows = buildInfoRows(snapshot ?? null);
  const y0 = screen.height * FIRST_ROW_BASELINE;

  // Note what is NOT here: no branch on a label, no special case for the body
  // name, no skipping of blank rows. The table decides what the panel says; this
  // loop decides only where it goes.
  rows.forEach((row, i) => {
    screen.row(row.label, row.value, y0 + i * screen.type.lead);
  });
}

export default paintInfo;
