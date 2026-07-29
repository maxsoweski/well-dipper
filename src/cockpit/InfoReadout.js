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
  { label: 'BODY',  read: (s) => s?.survey?.name,        format: formatText },
  { label: 'CLASS', read: (s) => s?.survey?.kind,        format: formatText },
  { label: 'TYPE',  read: (s) => s?.survey?.type,        format: formatText },
  { label: 'T_EQ',  read: (s) => s?.survey?.tEq,         format: formatKelvin },
  { label: 'COMP',  read: (s) => s?.survey?.composition, format: formatComposition },
  { label: 'ATMO',  read: (s) => s?.survey?.atmosphere,  format: formatAtmosphere },
  { label: 'TIDAL', read: (s) => s?.survey?.tidalState,  format: formatTidalState },
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
export function renderInfoValue(row, snapshot) {
  if (!row || typeof row.read !== 'function' || typeof row.format !== 'function') return BLANK;

  let raw;
  try {
    raw = row.read(snapshot);
  } catch {
    return BLANK;
  }

  if (raw === null || raw === undefined) return BLANK;

  let text;
  try {
    text = row.format(raw);
  } catch {
    return BLANK;
  }

  if (typeof text !== 'string') return BLANK;
  text = text.trim();
  if (!text) return BLANK;
  if (text.includes('[object ')) return BLANK;

  return text.length > INFO_VALUE_MAX_CHARS ? text.slice(0, INFO_VALUE_MAX_CHARS) : text;
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
export function buildInfoRows(snapshot, rows = INFO_ROWS) {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => ({
    label: typeof row?.label === 'string' ? row.label : '',
    value: renderInfoValue(row, snapshot),
  }));
}
