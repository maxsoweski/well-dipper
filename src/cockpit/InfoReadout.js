/**
 * InfoReadout — the INFO panel's data pipeline, as a table.
 *
 * Lane F, workstream `cockpit-screen-content-2026-07-28`, AC-PANEL-CONTENT.
 *
 * Max's steer, which is the whole brief:
 *
 *   "one panel is an info panel that gives you info about whichever system
 *    object is selected. We can expand/adjust the systems generating that info
 *    in the future; we just need a well-architected pipeline for that info to
 *    get to the screen."
 *
 * So THE PIPELINE IS THE DELIVERABLE AND THE FIELDS ARE DISPOSABLE. Before this
 * module, "which physics fields the info panel shows" was spread across the
 * snapshot builder, a formatter and a renderer, and dropping one field meant
 * three coordinated edits in three files — which is exactly the shape of change
 * that does not get made, so the panel silently ossifies around whatever the
 * first author happened to pick.
 *
 * Here there is ONE table, `INFO_ROWS`. Each row says three things and nothing
 * else: what it is CALLED, WHERE to read it out of the snapshot, and HOW to turn
 * that into a short string. Adding or removing a field is one line in one place.
 * (Honest caveat: a field whose value has a shape none of the existing
 * formatters handle also needs a formatter — but that formatter lands next to
 * the others, in this file, and the row is still one line.)
 *
 * ── MISSING MEANS BLANK. NEVER STALE, NEVER ZERO. ────────────────────────────
 *
 * This is the rule the whole module is built around, because both ways of
 * breaking it produce a readout that LIES rather than one that looks broken.
 *
 *   - Never stale is structural: `buildInfoRows` is a pure function of the
 *     snapshot it is handed and keeps no state between calls, so there is no
 *     "last good value" for a row to fall back to. Focus a planet, then a moon,
 *     and the moon cannot inherit the planet's numbers because nothing survives
 *     the call.
 *   - Never zero is enforced in ONE place rather than trusted to each
 *     formatter. `renderInfoValue` checks for a missing reading BEFORE it calls
 *     the formatter, so a formatter is never handed null/undefined and can
 *     never turn it into "0" or "none" or "—". A formatter written as
 *     `(v) => `${v || 0} K`` is the specific trap here: it renders a missing
 *     temperature as an authoritative-looking 0 K, and no test of that formatter
 *     alone would catch it. It is not reachable, because the formatter is not
 *     called at all when the value is absent.
 *
 * That is not a hypothetical. T_eq is written onto PLANET data only —
 * PlanetGenerator returns it, MoonGenerator does not, and stars have no such
 * field — so focusing a moon, focusing a star, or clearing focus all produce a
 * survey with no temperature in it. AC-PANEL-CONTENT names exactly this case:
 * T_eq "reads BLANK — not stale, not 0 — for a focused moon, a focused star, and
 * when focusIndex is -1".
 *
 * ── LINE LENGTH IS A REAL BUDGET ────────────────────────────────────────────
 *
 * The cockpit screens subtend roughly 17 degrees of a 70-degree field of view.
 * A value that reads fine in a browser console is unreadable at that angular
 * size, so every formatter here is written to produce a short string, and
 * `INFO_VALUE_MAX_CHARS` is a backstop that clamps anything a future row lets
 * through. That number is a CHARACTER budget, not a geometry one: this module
 * knows nothing about the panel's size, shape or font, and must not learn.
 * Where the text goes and how big it is drawn is the layout task's job, fed by
 * the measured mesh (see PanelLayout.js).
 *
 * ── STANDING RULE FOR WHOEVER ADDS THE NEXT ROW ─────────────────────────────
 *
 * NO GAUGE FOR FUEL, HULL, HEAT, CARGO OR SHIELDS. Not "not yet" — the game has
 * no such state anywhere, so any such row could only ever display an invented
 * number. A cockpit readout showing a fuel bar the sim does not model is worse
 * than a blank panel, because it invites the pilot to fly by it. If one of those
 * systems is ever built, the row goes in when the state exists and not before.
 *
 * ── WHY `read` IS A FUNCTION AND NOT A DOTTED PATH ──────────────────────────
 *
 * A path string ('survey.tEq') would be shorter to write and serialisable, but
 * it needs its own resolver, and it cannot express a row derived from more than
 * one field — which the next round of "expand/adjust the systems generating that
 * info" is likely to want. A function is given the snapshot and nothing else, so
 * it is just as incapable of reaching live game state as a path would be.
 */

/** What a row shows when it has nothing to show. Not "0", not "—", not "n/a". */
export const BLANK = '';

/**
 * Hard cap on a rendered value, in characters. A backstop, not a layout: the
 * formatters below all produce far shorter strings than this, and this exists so
 * a future row that reads some long generated name cannot push the panel's other
 * rows off the glass.
 */
export const INFO_VALUE_MAX_CHARS = 24;

/** Is this a plain object we can safely pick fields off? */
function isPlainObject(v) {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

/**
 * A plain string, passed through. Anything else — a number, an object, an array
 * — is NOT coerced, it is refused. Coercion is how "[object Object]" reaches a
 * screen: `String({})` succeeds, so a formatter that coerces never fails, it
 * just prints garbage forever.
 */
export function formatText(value) {
  return typeof value === 'string' ? value.trim() : null;
}

/**
 * Equilibrium temperature, in kelvin, rounded to whole degrees — nothing about
 * this readout justifies a decimal place at 17 degrees of arc.
 *
 * `Number.isFinite` rather than `typeof === 'number'`: NaN is a number, and a
 * NaN that got into the physics would otherwise render as the literal "NaN K",
 * which reads like a measurement.
 */
export function formatKelvin(value) {
  return Number.isFinite(value) ? `${Math.round(value)} K` : null;
}

/**
 * Composition, from PhysicsEngine.deriveComposition:
 *   { carbonToOxygen, ironFraction, volatileFraction, surfaceType, density }
 *
 * Only the two fields a pilot can act on are shown — what the surface is made of
 * and how iron-rich it is. The other three are real but are laboratory numbers,
 * and this is a cockpit. Same pair DebugPanel already shows, so the two readouts
 * cannot disagree.
 */
export function formatComposition(value) {
  if (!isPlainObject(value)) return null;
  const surface = typeof value.surfaceType === 'string' ? value.surfaceType.trim() : '';
  const iron = Number.isFinite(value.ironFraction) ? `Fe${value.ironFraction.toFixed(2)}` : '';
  const text = [surface, iron].filter(Boolean).join(' ');
  return text || null;   // an object with neither field is an unexpected shape → blank
}

/**
 * Atmosphere, from PhysicsEngine.computeAtmosphere:
 *   { retained, type, composition (a STRING like 'co2-n2'), pressure, jeans* }
 *
 * `retained === false` is information — it means the world is airless, and that
 * must read "none" rather than blank. Blank is reserved for "we do not know",
 * which is a different fact. Anything whose `retained` is not a boolean is a
 * shape this formatter does not understand, and blank is the honest answer.
 *
 * Pressure is shown at a precision that scales with magnitude, because the real
 * range spans four orders of magnitude (a thin remnant near 0.01 bar to a gas
 * giant's 1000) and a fixed two decimals would waste the whole line on a giant.
 */
export function formatAtmosphere(value) {
  if (!isPlainObject(value)) return null;
  if (typeof value.retained !== 'boolean') return null;
  if (!value.retained) return 'none';

  const composition = typeof value.composition === 'string' ? value.composition.trim() : '';
  let pressure = '';
  if (Number.isFinite(value.pressure)) {
    const p = value.pressure;
    pressure = `${p >= 10 ? Math.round(p) : p.toFixed(2)} bar`;
  }
  const text = [composition, pressure].filter(Boolean).join(' ');
  return text || 'retained';   // retained, but nothing further known about it
}

/**
 * Tidal state, from PhysicsEngine.checkTidalLock:
 *   { locked, lockType: 'synchronous' | '3:2-resonance' | 'none' }
 *
 * Rendered exactly as DebugPanel renders it today — `locked ? lockType : 'free'`
 * — so the debug HUD and the cockpit glass can never tell the pilot two
 * different things about the same body.
 */
export function formatTidalState(value) {
  if (!isPlainObject(value)) return null;
  if (typeof value.locked !== 'boolean') return null;
  if (!value.locked) return 'free';
  return typeof value.lockType === 'string' && value.lockType.trim() ? value.lockType.trim() : 'locked';
}

/**
 * ── THE BRIEF PROJECTION, ADDED 2026-09-08 ──────────────────────────────────
 *
 * chrome-and-ui-at-240p draws the cockpit at the game's resolution. A panel is
 * then 46 rows tall and a letter needs five of them, so a row is a 3-character
 * label hard-left and a 5-character value hard-right. `co2-n2 0.85 bar` is
 * fifteen characters and cannot exist there in any form.
 *
 * ⛔⛔ THE MIX COMES OFF THE GLASS. IT DOES NOT COME OUT OF THIS FILE.
 *
 * Max, 2026-09-08, ruling on exactly this: *"this is fine but know we'll
 * probably switch this up in the near future so don't get rid of any code that
 * allows you to display what we want to display."*
 *
 * So `format` is untouched and still returns the full string; `brief` is a
 * SECOND formatter over the SAME raw reading. Nothing is deleted, no row leaves
 * the table, and changing our mind about what a panel shows is one edit here
 * rather than an archaeology exercise. That is this module's own stated design —
 * "THE PIPELINE IS THE DELIVERABLE AND THE FIELDS ARE DISPOSABLE" — being
 * honoured rather than a new rule.
 *
 * ⚠ THIS IS STILL A CHARACTER BUDGET, NOT A GEOMETRY ONE, and the distinction is
 * the same one `INFO_VALUE_MAX_CHARS` already makes. This module does not learn
 * the panel's size, shape or font. What it does not know — how many characters
 * fit on ONE PARTICULAR panel — stays with the panel, which is why the BODY row
 * has no `brief`: fitting a designation to a width is the painter's job.
 */

/** A 3-character label and a 5-character value: what a row is at the game's resolution. */
export const PANEL_LABEL_CHARS = 3;
export const PANEL_VALUE_CHARS = 5;

/**
 * Uppercase, cut to the budget, and drop a separator left dangling by the cut.
 *
 * ⭐ ONE RULE RATHER THAN A TABLE OF NINETEEN ABBREVIATIONS, and that is a
 * deliberate refusal to invent. `type` is an OPEN vocabulary — worldClass.js
 * emits ocean/terrestrial/ice/lava/venus/carbon/rocky, the giant roll adds
 * gas-giant/hot-jupiter/sub-neptune/saturnian/neptunian, EXOTIC_TYPES adds seven
 * more, and SolarSystemData carries hand-authored ones — so any table I wrote
 * would be incomplete the first time a class was added, and silently. Checked
 * over the whole known vocabulary: the first five characters are distinct for
 * every one of them, so truncation loses no distinction it is asked to carry.
 */
export function fitWord(text, max = PANEL_VALUE_CHARS) {
  return String(text).toUpperCase().slice(0, max).replace(/[-_ ]+$/, '');
}

/**
 * `kind` is a CLOSED vocabulary — CockpitSnapshot writes exactly star, planet or
 * moon — so this one gets the table the open vocabulary above does not.
 * ⛔ And it needs one: truncating "planet" to five gives **PLANE**, which reads
 * as an aircraft. That is the case that proves a blanket rule is not enough.
 */
export const CLASS_BRIEF = Object.freeze({ planet: 'PLNT', moon: 'MOON', star: 'STAR' });

export function briefClass(value) {
  const t = formatText(value);
  return t === null ? null : (CLASS_BRIEF[t.toLowerCase()] ?? fitWord(t));
}

export function briefType(value) {
  const t = formatText(value);
  return t === null ? null : fitWord(t);
}

/**
 * Kelvin with the unit dropped — the `TEQ` label carries it, and it has to go:
 * "410 K" is five characters but "1200 K" is six, so keeping the unit would put
 * a unit on cold worlds and none on hot ones. A column that changes shape with
 * its own value is harder to read at a glance than one that never does.
 */
export function briefKelvin(value) {
  return Number.isFinite(value) ? String(Math.round(value)) : null;
}

/**
 * The iron fraction alone. The surface type is dropped here because `TYP`
 * already carries it — an overlap being removed, not information being lost.
 */
export function briefComposition(value) {
  if (!isPlainObject(value)) return null;
  const fe = value.ironFraction;
  if (!Number.isFinite(fe)) return null;
  // 0.31 -> FE.31 (the leading zero is the one character worth spending elsewhere).
  return fe >= 1 ? `FE${fe.toFixed(1)}` : `FE${fe.toFixed(2).slice(1)}`;
}

/**
 * ⛔ THE ONE ROW THAT ACTUALLY LOSES SOMETHING, and Max ruled on it directly:
 * the pressure stays and the gas mix comes off. `co2-n2` is six characters on
 * its own, and the pressure is the number that changes as you descend.
 *
 * `retained === false` still reads NONE rather than blank — airless is
 * information, blank means "we do not know", and they are different facts.
 *
 * Precision scales with magnitude for the reason `formatAtmosphere` gives: the
 * real range spans four orders (a thin remnant near 0.01 bar to a giant's 1000),
 * and a fixed two decimals would spend the whole budget on a giant.
 */
export function briefAtmosphere(value) {
  if (!isPlainObject(value)) return null;
  if (typeof value.retained !== 'boolean') return null;
  if (!value.retained) return 'NONE';
  const p = value.pressure;
  if (!Number.isFinite(p)) return 'YES';        // retained, nothing further known
  if (p >= 10) return String(Math.round(p));    // 1000 bar is four characters
  return p.toFixed(2);                          // 0.85
}

export function briefTidalState(value) {
  if (!isPlainObject(value)) return null;
  if (typeof value.locked !== 'boolean') return null;
  if (!value.locked) return 'FREE';
  const k = typeof value.lockType === 'string' ? value.lockType.trim().toLowerCase() : '';
  if (k === 'synchronous') return 'SYNC';
  if (k.startsWith('3:2')) return '3:2';
  return k ? fitWord(k) : 'LOCK';
}

/**
 * THE TABLE. One row per line: what it is called, where it comes from, how it is
 * written down. This is the thing Max asked for — "expand/adjust the systems
 * generating that info" is an edit to this array and nothing else.
 *
 * Every `read` takes the snapshot and returns a RAW value or null/undefined; it
 * must never format, and must never invent a default, because a default here
 * would defeat the missing-means-blank rule one layer above where it is checked.
 *
 * surfaceHistory is deliberately absent, and it used to be here. It is the one
 * field from the debug HUD's dossier that was dropped, because it carries no
 * information about the body you are looking at:
 *
 *   PlanetGenerator calls computeSurfaceHistory(ageGyr, false, false,
 *   atmoRetained, 0) — nearBelt, nearGiant and tidalHeatingRate are hard-coded
 *   at the call site, so bombardmentIntensity and resurfacingRate are pure
 *   functions of the SYSTEM's age and are therefore identical for every planet
 *   in the system, and erosionLevel additionally depends only on whether the
 *   atmosphere was retained — which the ATMO row already shows. Measured on
 *   seed 'test-alpha': all three planets report
 *   { bombardmentIntensity: 0, erosionLevel: 0.6820007091595458,
 *     resurfacingRate: 0.1 } — three DISTINCT objects carrying byte-identical
 *   values, so this is not a reference leak, the generator genuinely produces
 *   the same numbers. T_eq over the same three planets reads 410 / 374 / 305 K,
 *   falling with orbit distance. One row tells you where you are; the other is
 *   the same on every world in the system.
 *
 * Max agreed to the drop; the field is gone from the snapshot's survey block too
 * (see CockpitSnapshot.js), because carrying data no panel reads is how the
 * snapshot grows a second, undocumented contract.
 */
export const INFO_ROWS = Object.freeze([
  // `abbr`/`brief` are the panel-budget projection; `label`/`format` are untouched and still
  // produce the full string. BODY deliberately has NO `brief` — fitting a designation to a
  // particular panel's width is the painter's job, not this table's.
  { label: 'BODY',  abbr: '',    read: (s) => s?.survey?.name,        format: formatText,        brief: formatText, headline: true },
  { label: 'CLASS', abbr: 'CLS', read: (s) => s?.survey?.kind,        format: formatText,        brief: briefClass },
  { label: 'TYPE',  abbr: 'TYP', read: (s) => s?.survey?.type,        format: formatText,        brief: briefType },
  { label: 'T_EQ',  abbr: 'TEQ', read: (s) => s?.survey?.tEq,         format: formatKelvin,      brief: briefKelvin },
  { label: 'COMP',  abbr: 'CMP', read: (s) => s?.survey?.composition, format: formatComposition, brief: briefComposition },
  { label: 'ATMO',  abbr: 'ATM', read: (s) => s?.survey?.atmosphere,  format: formatAtmosphere,  brief: briefAtmosphere },
  { label: 'TIDAL', abbr: 'TID', read: (s) => s?.survey?.tidalState,  format: formatTidalState,  brief: briefTidalState },
].map((row) => Object.freeze(row)));   // frozen per ROW as well — a shallow freeze
                                       // on the array alone still lets a panel
                                       // rewrite a row's formatter for everyone.

/**
 * Render ONE row against a snapshot. Every way a row can fail to produce a
 * trustworthy string converges here on the same answer: blank.
 *
 * The order of the guards is the whole design:
 *
 *   1. A reader that throws yields blank rather than taking the frame down. A
 *      cockpit panel is drawn inside the render loop; one malformed row must not
 *      black out the other three, and must not stop the ship being flown. The
 *      cost is that a genuinely buggy reader fails quietly — which is why the
 *      readers in INFO_ROWS are optional-chained one-liners with nowhere to hide
 *      a bug, and why the tests below assert on the rendered rows rather than
 *      trusting the readers.
 *   2. MISSING IS CHECKED BEFORE THE FORMATTER RUNS. This is the load-bearing
 *      line. It is what makes "missing means blank" a property of the pipeline
 *      instead of a promise each formatter has to keep.
 *   3. A formatter that returns a non-string — including the null every
 *      formatter here returns for a shape it does not recognise — yields blank.
 *   4. "[object Object]" is refused explicitly. A future formatter that
 *      interpolates an object into a template literal produces a string, so it
 *      would sail past every check above and print that on the glass. It is the
 *      single most likely way this panel ends up showing garbage, so it is
 *      checked for by name.
 *
 *      HONEST LIMIT, for whoever adds the next row: this is the ONLY shape of
 *      garbage the pipeline itself catches. A formatter that reaches for
 *      JSON.stringify produces `{"surfaceType":"silica` after the clamp — a
 *      string, not "[object ", so nothing here stops it. Every formatter in this
 *      file is safe because each one checks the shape it expects and returns null
 *      when it does not recognise it; that per-formatter discipline is what
 *      actually keeps dumps off the glass, and a new formatter must keep it.
 *      Whether the pipeline should additionally refuse anything that looks
 *      serialised is a real design question and deliberately not decided here.
 *   5. Length is clamped last, so the cap applies to whatever the formatter
 *      actually produced.
 *
 * @param {{label:string, read:Function, format:Function}} row a row of the table
 * @param {object|null} snapshot one frame from CockpitSnapshotProvider
 * @returns {string} the rendered value, or BLANK
 */
export function renderInfoValue(row, snapshot, opts = {}) {
  // ⭐ `brief` SELECTS A FORMATTER; IT NEVER SUBSTITUTES FOR A MISSING ONE. A row without a brief
  // form falls back to its full one, which keeps "one line in one place" true — adding a row does
  // not require remembering to add two formatters — and keeps the failure visible as a value that
  // is too long rather than as a value that silently vanished.
  const format = (opts.brief && typeof row?.brief === 'function') ? row.brief : row?.format;
  if (!row || typeof row.read !== 'function' || typeof format !== 'function') return BLANK;

  let raw;
  try {
    raw = row.read(snapshot);
  } catch {
    return BLANK;
  }

  if (raw === null || raw === undefined) return BLANK;

  let text;
  try {
    text = format(raw);
  } catch {
    return BLANK;
  }

  if (typeof text !== 'string') return BLANK;
  text = text.trim();
  if (!text) return BLANK;
  if (text.includes('[object ')) return BLANK;

  // The backstop tightens with the projection. ⚠ It CLAMPS rather than blanks, deliberately: a
  // value one character over is still mostly readable, where a blank row tells the pilot the
  // reading is missing when it is not. A clamp that fires is a formatter bug, and the test suite
  // asserts none of the shipped ones ever reach it.
  // ⛔ THE HEADLINE ROW IS EXEMPT FROM THE VALUE BUDGET, and it has to be. BODY is not a value in a
  // 5-character column — it is the panel's heading, drawn unlabelled across the full width, and
  // fitting a designation to a particular panel's width is the painter's job (a painter can drop a
  // leading system name; this module cannot, because it does not know how wide the glass is).
  // Without this, "Caph b II" was clamped to "Caph " — a truncation that reads as a real name.
  const cap = (opts.brief && !row.headline) ? PANEL_VALUE_CHARS : INFO_VALUE_MAX_CHARS;
  return text.length > cap ? text.slice(0, cap) : text;
}

/**
 * Turn one snapshot into the INFO panel's ordered list of rendered rows.
 *
 * Ordered, and one entry per table row ALWAYS — rows are never dropped when they
 * are blank. A row that vanishes when its value is missing makes the remaining
 * rows jump up the screen, and a pilot glancing at a moving readout misreads it.
 * A blank line holds its place.
 *
 * `rows` is a parameter rather than a hard reference to INFO_ROWS so that the
 * "one line in one place" property is testable: the tests hand in an extended
 * table and assert the builder picks the new row up with no other change. It is
 * not intended as a runtime knob; production calls this with one argument.
 *
 * @param {object|null} snapshot one frame from CockpitSnapshotProvider
 * @param {Array} [rows] the table to render; defaults to INFO_ROWS
 * @returns {Array<{label:string, value:string}>}
 */
export function buildInfoRows(snapshot, rows = INFO_ROWS, opts = {}) {
  if (!Array.isArray(rows)) return [];
  const brief = !!opts.brief;
  return rows.map((row) => ({
    // In brief mode the label comes from `abbr`, and `?? row.label` is the same fallback rule the
    // value uses: a table extended with a new row still renders, with a label that is too long
    // rather than a row that has lost its name.
    label: brief
      ? (typeof row?.abbr === 'string' ? row.abbr : (typeof row?.label === 'string' ? row.label : ''))
      : (typeof row?.label === 'string' ? row.label : ''),
    value: renderInfoValue(row, snapshot, { brief }),
  }));
}
