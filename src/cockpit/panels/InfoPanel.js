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
 * ⚠ ONE EXCEPTION, AND IT IS NAMED RATHER THAN SMUGGLED: the FIRST row is drawn
 * as the panel's heading — unlabelled, across the full width — rather than as a
 * label-and-value row. That is not this file knowing what BODY is; it is the
 * table saying so, with `headline: true`, for the reason the table gives.
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
 * ── SEVEN LINES AND NINE CHARACTERS IS THE BUDGET, MEASURED ─────────────────
 *
 * ⭐ REWRITTEN 2026-09-08 for `chrome-and-ui-at-240p`. The old text here reasoned
 * in fractions of the buffer height — "a `lead` of H/12 gives twelve baselines,
 * and seven rows fit with room to spare". That was true of a vector face on a
 * 512-tall panel canvas. The cockpit now draws at the GAME's resolution, and INFO
 * sits on `Screen_LL`, which measures **46.07 rows by 55.28 texels** at 240 lines
 * (projected from `cockpit-metrics.json` through the 70-degree camera; the PIXEL
 * fraction, not the angular one — `panelPose.js:34-49`). So the budget is:
 *
 *     SEVEN LINES.  A five-row cell plus one row of air is six; two margins and a
 *                   heading over six rows is 2 + 5 + 6*6 = 43, and 43 <= 46.
 *     NINE CHARACTERS.  `(53 usable + 1) / 6` — and there is no room to spare,
 *                   which is the honest word for it.
 *
 * A row is therefore a 3-character label hard-left and a 5-character value
 * hard-right. The seven FIELDS all survive; one of their VALUES does not, and
 * Max ruled on which: ATM keeps the pressure and loses the gas mix.
 *
 * ⛔ AND THE MIX CAME OFF THE GLASS, NOT OUT OF THE PIPELINE. Max, 2026-09-08:
 * *"don't get rid of any code that allows you to display what we want to
 * display."* `InfoReadout`'s `format` still produces "co2-n2 0.85 bar"; `brief`
 * is a second formatter over the same reading, and this painter asks for it. If
 * the panels change — and Max said they probably will — the long form is still
 * there to change back to.
 *
 * If an eighth row ever arrives, the answer is NOT a smaller `lead` and NOT a
 * smaller size. The kit throws below one whole cell of the face for exactly that
 * request. The answer is that INFO_ROWS is a table and something comes off it.
 */

import { buildInfoRows } from '../InfoReadout.js';
import { fitDesignation } from '../designation.js';

/**
 * The first row's baseline, as a fraction of the buffer height. Subsequent rows
 * step by the type scale's own `lead`, so the block re-spaces itself correctly if
 * the scale is ever retuned, and stays vertically centred-ish on the glass for the
 * seven rows the table has today.
 */
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

  const t = screen.type;
  const [headline, ...rows] = buildInfoRows(snapshot ?? null, undefined, { brief: true });

  // ⛔ THE GRID IS READ OFF THE KIT, NOT COMPUTED HERE. `lines` and `colsAt` are the kit's answers
  // for this buffer; a painter that derives either one itself walks off the glass silently the
  // first time the face or the padding moves. At 240p this panel is 46 rows and 9 characters.
  const cols = screen.colsAt();

  // The heading: the designation, unlabelled, across the full width. It is what the panel is ABOUT,
  // and giving it a label would spend a fifth of the line saying so.
  screen.text(fitDesignation(headline?.value, cols), t.pad, t.pad + t.body);

  // ⭐ THE RULE IS DRAWN ONLY OUT OF SPARE HEIGHT, never out of a row's. The seven-line grid is
  // exactly 43 rows and the upper pair measures 42.84, so on those panels there is nothing spare
  // and the heading is distinguished by being unlabelled and full-width — which is enough. The
  // lower pair measures 46.07, and INFO lives there, so in practice the rule is drawn and the rows
  // get one hairline of air above them. Degrading by dropping the ornament rather than the content
  // is the direction this workstream always takes.
  const spare = screen.height - (2 * t.pad + t.body + 6 * t.lead);
  const offset = Math.max(0, Math.min(spare, 2 * screen.hair));
  if (offset >= 2 * screen.hair) screen.rule(t.pad + t.body + screen.hair);

  // Note what is NOT here: no branch on a label, no special case for a field, no skipping of blank
  // rows. The table decides what the panel says; this loop decides only where it goes. A blank row
  // still holds its place, because rows that close up when a value is missing make the rest jump
  // and a pilot glancing at a moving readout misreads it.
  rows.forEach((row, i) => {
    screen.row(row.label, row.value, t.pad + t.body + (i + 1) * t.lead + offset);
  });
}

export default paintInfo;
