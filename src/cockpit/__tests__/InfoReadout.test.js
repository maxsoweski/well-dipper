/**
 * InfoReadout — lane F (cockpit-screen-content-2026-07-28), AC-PANEL-CONTENT.
 *
 * The INFO panel's data pipeline. What is under test here is NOT "does it print
 * these seven fields" — Max was explicit that the fields are disposable and the
 * pipeline is the deliverable:
 *
 *   "one panel is an info panel that gives you info about whichever system
 *    object is selected. We can expand/adjust the systems generating that info
 *    in the future; we just need a well-architected pipeline for that info to
 *    get to the screen."
 *
 * So the properties actually asserted are the ones a future author will rely on
 * without reading this file:
 *
 *   1. ONE LINE IN ONE PLACE — adding or removing a row in INFO_ROWS adds or
 *      removes exactly that row in the output, with no other edit anywhere.
 *      Tested by extending the table from the test and checking the builder
 *      picks it up.
 *   2. MISSING MEANS BLANK, NEVER STALE AND NEVER ZERO — and specifically that
 *      this is a property of the PIPELINE, not a promise each formatter keeps.
 *      A deliberately naive `(v) => `${v || 0} K`` row is fed a missing value
 *      and must still come out blank, because it is never called.
 *   3. AN UNEXPECTED SHAPE DEGRADES TO BLANK — never "[object Object]", never a
 *      JSON dump, never a thrown error that takes the render loop with it.
 *
 * Snapshots are built through the real buildCockpitSnapshot rather than
 * hand-written, so the test breaks if the feed and the table stop agreeing.
 * Fixture values are the real generator's, measured on seed 'test-alpha'.
 *
 * Lane F owns this file. Lane E's tests/cockpit-geometry.test.js is untouched,
 * and its describe.skipIf pattern is deliberately NOT copied: lane E defends
 * that with a separate gate test, and a lane-F file that copied the skip without
 * the gate would go green on missing data.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildCockpitSnapshot } from '../CockpitSnapshot.js';
import {
  INFO_ROWS, INFO_VALUE_MAX_CHARS, BLANK,
  buildInfoRows, renderInfoValue,
  formatText, formatKelvin, formatComposition, formatAtmosphere, formatTidalState,
} from '../InfoReadout.js';
import { StarSystemGenerator } from '../../generation/StarSystemGenerator.js';

const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * Is this file disabling any of its own tests?
 *
 * Comments are stripped first: this file DISCUSSES lane E's skipIf in its header, and
 * the pattern is assembled from fragments because a literal one would match itself.
 * Either would fail a file that is in fact clean. The check is about code, not prose.
 *
 * `.only` is scanned alongside `.skip` — same failure, friendlier name. And this sits
 * at MODULE SCOPE and throws rather than living only inside an it(), because measured
 * on the sibling ScreenUV.test.js, `it.only` made vitest report "1 passed | 6 skipped"
 * and exit GREEN: the scan was one of the tests it skipped. A self-scan that only runs
 * as a test cannot see a helper that stops it running. Module scope runs at collection,
 * before the runner honours any `.only`.
 */
const SELF_CODE = readFileSync(join(HERE, 'InfoReadout.test.js'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');
const DISABLED_RE = new RegExp(
  ['describe', 'it', 'test'].flatMap((k) => [k + '\\.skip', k + '\\.only']).join('|'),
);
const SELF_DISABLES_TESTS = DISABLED_RE.test(SELF_CODE);
if (SELF_DISABLES_TESTS) {
  throw new Error(
    'InfoReadout.test.js disables one of its own tests (a skip or focus helper is present in ' +
    'its code). A disabled test here reads as "the INFO panel shows real data" when nothing ' +
    'was measured at all. Remove the helper.',
  );
}

/**
 * A focused planet, with the shapes PhysicsEngine actually produces.
 * Measured: StarSystemGenerator.generate('test-alpha').planets[0] — a venus-type
 * world, T_eq 410.2 K, silicate surface, iron fraction 0.2286, retained
 * primordial CO2 at 90 bar, not tidally locked.
 */
const PLANET = {
  kind: 'planet',
  name: 'Aletheia I',
  data: { type: 'venus', T_eq: 410.2009727680979, radius: 0.04 },
  physics: {
    composition: {
      carbonToOxygen: 0.4472145309922772,
      ironFraction: 0.2286072654961386,
      volatileFraction: 0.02632444846909493,
      surfaceType: 'silicate',
      density: 4590.387430542503,
    },
    atmosphere: { retained: true, type: 'primordial', composition: 'co2', pressure: 90, jeansH2: 100 },
    tidalState: { locked: false, lockType: 'none' },
    // Still here on purpose: the table must not read it, and leaving it in the
    // fixture is what makes that a real check.
    surfaceHistory: { bombardmentIntensity: 0, erosionLevel: 0.6820007091595458, resurfacingRate: 0.1 },
  },
};

/**
 * A focused moon. Regular moons are BodyRenderer.createMoon(moonData, null, …)
 * — the physics argument is a literal null — and MoonGenerator writes no T_eq,
 * so a moon genuinely carries none of the planet dossier.
 */
const MOON = { kind: 'moon', name: 'Kell', data: { type: 'rock', radius: 0.01 }, physics: null };

/** A focused star. Star entries in spawnSystem carry no .physics either. */
const STAR = { kind: 'star', name: 'Aletheia', data: { type: 'G', radius: 5 }, physics: null };

const snapshotFor = (focusedBody) => buildCockpitSnapshot({ focusedBody });

/** { LABEL: value } — order-independent lookups, for assertions about one row. */
const byLabel = (rows) => Object.fromEntries(rows.map((r) => [r.label, r.value]));

describe('InfoReadout — the table renders a focused body (AC-PANEL-CONTENT)', () => {
  it('renders every row of the table, in table order, for a focused planet', () => {
    const rows = buildInfoRows(snapshotFor(PLANET));

    expect(rows).toEqual([
      { label: 'BODY',  value: 'Aletheia I' },
      { label: 'CLASS', value: 'planet' },
      { label: 'TYPE',  value: 'venus' },
      { label: 'T_EQ',  value: '410 K' },
      { label: 'COMP',  value: 'silicate Fe0.23' },
      { label: 'ATMO',  value: 'co2 90 bar' },
      { label: 'TIDAL', value: 'free' },
    ]);
  });

  it('takes its labels and its order from the table, hard-coding nothing', () => {
    // If the builder listed the rows itself, this passes today and diverges the
    // first time someone edits INFO_ROWS — which is the exact failure the
    // one-line-in-one-place property exists to prevent.
    const rows = buildInfoRows(snapshotFor(PLANET));

    expect(rows.map((r) => r.label)).toEqual(INFO_ROWS.map((r) => r.label));
    expect(rows.length).toBe(INFO_ROWS.length);
  });

  it('renders a body that carries only a name, a class and a type', () => {
    // A moon reaches the panel with physics === null and no T_eq. Four of the
    // seven rows have nothing to say, and say nothing.
    expect(buildInfoRows(snapshotFor(MOON))).toEqual([
      { label: 'BODY',  value: 'Kell' },
      { label: 'CLASS', value: 'moon' },
      { label: 'TYPE',  value: 'rock' },
      { label: 'T_EQ',  value: BLANK },
      { label: 'COMP',  value: BLANK },
      { label: 'ATMO',  value: BLANK },
      { label: 'TIDAL', value: BLANK },
    ]);
  });

  it('keeps blank rows in place instead of dropping them', () => {
    // A row that vanishes when empty makes the rows below it jump up the screen,
    // and a pilot glancing at a readout that moves misreads it. Every row always
    // occupies its line, whatever it has to show.
    for (const body of [PLANET, MOON, STAR, null]) {
      const rows = buildInfoRows(snapshotFor(body));
      expect(rows.length).toBe(INFO_ROWS.length);
      expect(rows.map((r) => r.label)).toEqual(INFO_ROWS.map((r) => r.label));
    }
  });

  it('renders nothing at all — not an error — before anything is focused', () => {
    // CockpitSnapshotProvider hands out buildCockpitSnapshot({}) before the first
    // frame, so this is the panel's literal first draw after boot.
    const rows = buildInfoRows(buildCockpitSnapshot({}));

    // Count before content — `.every()` is vacuously true on an empty array.
    expect(rows.length).toBe(INFO_ROWS.length);
    expect(rows.every((r) => r.value === BLANK)).toBe(true);
  });

  it('survives a snapshot that is null or empty rather than throwing on the render loop', () => {
    expect(() => buildInfoRows(null)).not.toThrow();
    expect(() => buildInfoRows({})).not.toThrow();
    expect(buildInfoRows(null).length).toBe(INFO_ROWS.length);
    expect(buildInfoRows({}).length).toBe(INFO_ROWS.length);
    expect(buildInfoRows(null).every((r) => r.value === BLANK)).toBe(true);
    expect(buildInfoRows({}).every((r) => r.value === BLANK)).toBe(true);
  });
});

describe('InfoReadout — one line in one place (Max\'s brief)', () => {
  it('picks up a row appended to the table, with no other change anywhere', () => {
    // The whole point of the table. This adds a field the module has never heard
    // of, reading a part of the snapshot the INFO panel does not otherwise touch,
    // and it renders — no edit to the builder, no edit to the formatters.
    const extended = [...INFO_ROWS, {
      label: 'SYSTEM',
      read: (s) => s?.nav?.systemName,
      format: formatText,
    }];

    const rows = buildInfoRows(buildCockpitSnapshot({ focusedBody: PLANET, systemName: 'Aletheia' }), extended);

    expect(rows.length).toBe(INFO_ROWS.length + 1);
    expect(rows[rows.length - 1]).toEqual({ label: 'SYSTEM', value: 'Aletheia' });
    // And the rows that were already there are untouched.
    expect(rows.slice(0, INFO_ROWS.length)).toEqual(buildInfoRows(snapshotFor(PLANET)));
  });

  it('drops a row removed from the table, and only that row', () => {
    const trimmed = INFO_ROWS.filter((r) => r.label !== 'TIDAL');

    const rows = buildInfoRows(snapshotFor(PLANET), trimmed);

    expect(rows.map((r) => r.label)).toEqual(['BODY', 'CLASS', 'TYPE', 'T_EQ', 'COMP', 'ATMO']);
    expect(byLabel(rows).COMP).toBe('silicate Fe0.23');
  });

  it('reorders when the table reorders', () => {
    const reversed = [...INFO_ROWS].reverse();

    const rows = buildInfoRows(snapshotFor(PLANET), reversed);

    expect(rows.map((r) => r.label)).toEqual(INFO_ROWS.map((r) => r.label).reverse());
  });

  it('names no gauge the game has no state for', () => {
    // Checked over the RENDERED LABELS, not over source text. AC-PANEL-CONTENT
    // says so explicitly and it is right: 'hull' is pervasive in this repo as
    // cockpit GEOMETRY (Hull_Nose, HULL_REF_LENGTH, HULL_NAMES), so a source
    // grep for these words is unusable. The labels are what the pilot sees.
    const banned = /fuel|hull|heat|cargo|shield/i;

    for (const { label } of buildInfoRows(snapshotFor(PLANET))) {
      expect(label).not.toMatch(banned);
    }
  });
});

describe('InfoReadout — missing means blank, never stale, never zero', () => {
  it('renders a missing value as an EMPTY string and not a placeholder that reads like data', () => {
    // THE ANCHOR for every other assertion in this file. All of them are written
    // against the exported BLANK, which means they assert "missing renders as
    // whatever BLANK happens to be" — a tautology on its own. Change the constant
    // to '0' and the panel prints an authoritative-looking zero on every row it
    // has no reading for, which is the exact lie AC-PANEL-CONTENT forbids ("reads
    // BLANK — not stale, not 0"), and without this line the whole suite stays
    // green while it does. So the constant is pinned to the empty string here,
    // once, and the literal is repeated on the two rows that matter most below.
    expect(BLANK).toBe('');

    const moon = byLabel(buildInfoRows(snapshotFor(MOON)));
    expect(moon.T_EQ).toBe('');
    expect(moon.ATMO).toBe('');
    // And nothing that merely LOOKS like an absence marker: a dash, an 'n/a' or a
    // zero all read as content on a monochrome CRT at 17 degrees of arc.
    for (const { value } of buildInfoRows(snapshotFor(MOON))) {
      expect(value).not.toMatch(/^\s*(0|-+|—|n\/?a|null|undefined|\?+)\s*$/i);
    }
  });

  it('reads a moon\'s temperature blank rather than carrying the planet\'s number', () => {
    // The staleness trap in its exact form: focus a planet, read a real T_eq,
    // then focus a moon that has none. A panel that cached its last non-blank
    // value — or one that re-rendered only changed rows — shows 410 K on a moon.
    const planetRows = buildInfoRows(snapshotFor(PLANET));
    expect(byLabel(planetRows).T_EQ).toBe('410 K');

    const moonRows = buildInfoRows(snapshotFor(MOON));

    expect(byLabel(moonRows).T_EQ).toBe(BLANK);
    expect(byLabel(moonRows).T_EQ).not.toBe('410 K');
    expect(byLabel(moonRows).T_EQ).not.toBe('0 K');
    // Nor may any other row inherit the planet's dossier.
    expect(byLabel(moonRows).COMP).toBe(BLANK);
    expect(byLabel(moonRows).ATMO).toBe(BLANK);
    expect(byLabel(moonRows).TIDAL).toBe(BLANK);
    expect(byLabel(moonRows).BODY).toBe('Kell');
  });

  it('goes back to the planet\'s values when the planet is focused again', () => {
    // The other direction: no sticky blank either. Three calls, interleaved,
    // each a pure function of what it was handed.
    const first = buildInfoRows(snapshotFor(PLANET));
    buildInfoRows(snapshotFor(MOON));
    const third = buildInfoRows(snapshotFor(PLANET));

    expect(third).toEqual(first);
  });

  it('reads a star and an unfocused system blank, like a moon', () => {
    // PlanetGenerator writes T_eq onto planet data only. AC-PANEL-CONTENT names
    // all three cases: a focused moon, a focused star, and focusIndex === -1.
    expect(byLabel(buildInfoRows(snapshotFor(STAR))).T_EQ).toBe(BLANK);
    expect(byLabel(buildInfoRows(snapshotFor(null))).T_EQ).toBe(BLANK);
    expect(byLabel(buildInfoRows(snapshotFor(null))).BODY).toBe(BLANK);
  });

  it('reads SURVEY blank during a warp, because the system is already torn down', () => {
    const rows = buildInfoRows(buildCockpitSnapshot({ focusedBody: PLANET, warping: true }));

    // Row count first: `.every()` on an empty array is TRUE, so a builder that
    // dropped the rows entirely would satisfy the line below without this one.
    expect(rows.length).toBe(INFO_ROWS.length);
    expect(rows.every((r) => r.value === BLANK)).toBe(true);
  });

  it('never calls a formatter with a missing value, so a naive one cannot print 0', () => {
    // THE load-bearing assertion. `(v) => `${v || 0} K`` is the formatter every
    // one of us writes without thinking, and it is a lie: it turns "we don't
    // know" into an authoritative zero. It cannot lie here because it is never
    // reached — renderInfoValue checks for a missing reading BEFORE formatting.
    let calls = 0;
    const naive = {
      label: 'NAIVE',
      read: (s) => s?.survey?.tEq,
      format: (v) => { calls++; return `${v || 0} K`; },
    };

    const moon = buildInfoRows(snapshotFor(MOON), [naive]);
    expect(moon).toEqual([{ label: 'NAIVE', value: BLANK }]);
    expect(calls).toBe(0);

    // And it still renders normally when there IS a value — the guard is about
    // absence, not about disabling the row.
    expect(buildInfoRows(snapshotFor(PLANET), [naive])).toEqual([{ label: 'NAIVE', value: '410.2009727680979 K' }]);
    expect(calls).toBe(1);
  });

  it('distinguishes a value that happens to be zero from a value that is missing', () => {
    // Zero is a reading. Blank is the absence of one. A formatter guarding on
    // falsiness collapses the two, so this pins them apart.
    const zero = buildCockpitSnapshot({
      focusedBody: { kind: 'planet', name: 'Frozen', data: { type: 'ice', T_eq: 0 }, physics: null },
    });

    expect(byLabel(buildInfoRows(zero)).T_EQ).toBe('0 K');
    expect(byLabel(buildInfoRows(snapshotFor(MOON))).T_EQ).toBe(BLANK);
  });

  it('reads an airless world as "none" and an unknown atmosphere as blank', () => {
    // Same distinction, on the other row. `retained: false` is a FACT about the
    // world and must be shown; a moon with no physics at all is an absence.
    const airless = { ...PLANET, physics: { ...PLANET.physics, atmosphere: { retained: false, type: 'none', composition: 'none', pressure: 0 } } };

    expect(byLabel(buildInfoRows(snapshotFor(airless))).ATMO).toBe('none');
    expect(byLabel(buildInfoRows(snapshotFor(MOON))).ATMO).toBe(BLANK);
  });
});

describe('InfoReadout — unexpected shapes degrade to blank, never to garbage', () => {
  it('blanks a physics object whose fields are not the ones the formatter knows', () => {
    // "We can expand/adjust the systems generating that info in the future" is
    // the brief, so the generator's shapes WILL change under this panel. When
    // they do, the row must go quiet — not print a JSON dump, not print
    // "[object Object]", not throw inside the render loop.
    const weird = {
      ...PLANET,
      physics: {
        composition: { spectralClass: 'K2', unexpected: true },
        atmosphere: { thickness: 'medium' },
        tidalState: { spin: 1.4 },
      },
    };

    const rows = byLabel(buildInfoRows(snapshotFor(weird)));

    expect(rows.COMP).toBe(BLANK);
    expect(rows.ATMO).toBe(BLANK);
    expect(rows.TIDAL).toBe(BLANK);
    // Still shows what it does understand.
    expect(rows.BODY).toBe('Aletheia I');
    expect(rows.T_EQ).toBe('410 K');
  });

  it('blanks a row whose formatter stringifies an object into the value', () => {
    // The specific way this panel would end up showing garbage: a future
    // formatter interpolates an object into a template literal. That PRODUCES a
    // string, so it sails past a "did the formatter return a string" check and
    // renders "[object Object]" on the glass forever.
    const sloppy = { label: 'SLOPPY', read: (s) => s?.survey?.composition, format: (v) => `shape=${v}` };

    expect(buildInfoRows(snapshotFor(PLANET), [sloppy])).toEqual([{ label: 'SLOPPY', value: BLANK }]);
  });

  it('blanks a row whose reader throws, and still renders the rest of the panel', () => {
    // One malformed row must not black out the other three panels or interrupt
    // the frame — the pilot is flying.
    const exploding = { label: 'BOOM', read: (s) => s.survey.nothing.here, format: formatText };
    const table = [...INFO_ROWS, exploding];

    const rows = buildInfoRows(snapshotFor(PLANET), table);

    expect(byLabel(rows).BOOM).toBe(BLANK);
    expect(byLabel(rows).BODY).toBe('Aletheia I');
    expect(byLabel(rows).T_EQ).toBe('410 K');
  });

  it('blanks a row whose formatter throws', () => {
    const bad = { label: 'BAD', read: (s) => s?.survey?.name, format: () => { throw new Error('nope'); } };

    expect(buildInfoRows(snapshotFor(PLANET), [bad])).toEqual([{ label: 'BAD', value: BLANK }]);
  });

  it('clamps a long value to the character budget', () => {
    // The screens subtend roughly 17 degrees of a 70-degree field of view, so
    // line length is a real budget and a long generated name cannot be allowed
    // to push the other rows off the glass. A backstop — nothing in INFO_ROWS
    // comes anywhere near it.
    const longName = 'The Extremely Long Provisional Designation Of A Body';
    const rows = buildInfoRows(snapshotFor({ ...PLANET, name: longName }));

    expect(byLabel(rows).BODY.length).toBe(INFO_VALUE_MAX_CHARS);
    expect(longName.startsWith(byLabel(rows).BODY)).toBe(true);
    for (const r of buildInfoRows(snapshotFor(PLANET))) {
      expect(r.value.length).toBeLessThanOrEqual(INFO_VALUE_MAX_CHARS);
    }
  });

  it('refuses to coerce a non-string into a text row', () => {
    // String(42) succeeds, and so does String({}). A text formatter that coerces
    // never fails — it just prints whatever it was given, forever.
    expect(formatText('rock')).toBe('rock');
    expect(formatText(42)).toBeNull();
    expect(formatText({})).toBeNull();
    expect(formatText([])).toBeNull();
  });

  it('refuses a NaN temperature, which would otherwise read like a measurement', () => {
    expect(formatKelvin(410.2009727680979)).toBe('410 K');
    expect(formatKelvin(0)).toBe('0 K');
    expect(formatKelvin(NaN)).toBeNull();
    expect(formatKelvin(Infinity)).toBeNull();
    expect(formatKelvin('410')).toBeNull();
  });

  it('formats the physics shapes the generator actually produces', () => {
    expect(formatComposition(PLANET.physics.composition)).toBe('silicate Fe0.23');
    expect(formatComposition({ surfaceType: 'ice-rock' })).toBe('ice-rock');
    expect(formatComposition({ ironFraction: 0.5 })).toBe('Fe0.50');
    expect(formatComposition({})).toBeNull();

    expect(formatAtmosphere(PLANET.physics.atmosphere)).toBe('co2 90 bar');
    // A thin secondary atmosphere: two decimals, because 0.39 and 1.03 are the
    // real range and rounding them both to "0 bar"/"1 bar" loses the difference.
    expect(formatAtmosphere({ retained: true, type: 'secondary', composition: 'n2-o2', pressure: 0.3865391055983993 }))
      .toBe('n2-o2 0.39 bar');
    expect(formatAtmosphere({ retained: false, type: 'none', composition: 'none', pressure: 0 })).toBe('none');
    expect(formatAtmosphere({ retained: true })).toBe('retained');
    expect(formatAtmosphere({ pressure: 1 })).toBeNull();

    // Rendered exactly as DebugPanel renders it — `locked ? lockType : 'free'` —
    // so the debug HUD and the cockpit glass cannot disagree about one body.
    expect(formatTidalState({ locked: false, lockType: 'none' })).toBe('free');
    expect(formatTidalState({ locked: true, lockType: 'synchronous' })).toBe('synchronous');
    expect(formatTidalState({ locked: true, lockType: '3:2-resonance' })).toBe('3:2-resonance');
    expect(formatTidalState({ locked: true })).toBe('locked');
    expect(formatTidalState({ lockType: 'synchronous' })).toBeNull();
  });

  it('renders one row in isolation the same way the builder does', () => {
    // renderInfoValue is the seam a future panel would call directly, so it is
    // held to the same contract rather than being an internal detail.
    const row = INFO_ROWS.find((r) => r.label === 'T_EQ');

    expect(renderInfoValue(row, snapshotFor(PLANET))).toBe('410 K');
    expect(renderInfoValue(row, snapshotFor(MOON))).toBe(BLANK);
    expect(renderInfoValue(null, snapshotFor(PLANET))).toBe(BLANK);
    expect(renderInfoValue({ label: 'X' }, snapshotFor(PLANET))).toBe(BLANK);
  });
});

describe('InfoReadout — the table stays honest', () => {
  it('does not read surfaceHistory, which the snapshot no longer carries', () => {
    // Dropped because it is the same on every planet in a system: PlanetGenerator
    // hard-codes nearBelt/nearGiant/tidalHeatingRate at the call site, so on seed
    // 'test-alpha' all three planets return { bombardmentIntensity: 0,
    // erosionLevel: 0.6820007091595458, resurfacingRate: 0.1 } — three distinct
    // objects, identical values. T_eq over the same three reads 410/374/305 K.
    // The fixture still HAS the field, so this is a real check.
    expect(PLANET.physics.surfaceHistory).toBeTruthy();

    const snapshot = snapshotFor(PLANET);
    expect('surfaceHistory' in snapshot.survey).toBe(false);

    for (const row of INFO_ROWS) {
      expect(row.read(snapshot)).not.toBe(PLANET.physics.surfaceHistory);
    }
    const values = buildInfoRows(snapshot).map((r) => r.value).join('|');
    expect(values).not.toMatch(/0\.682|bombardment|erosion|resurfacing/i);
  });

  it('has readers that never throw on a snapshot with nothing in it', () => {
    // Every reader in the table must be safe against the empty first-frame
    // snapshot and against a null one, so the try/catch in renderInfoValue is a
    // backstop rather than the thing holding the panel up.
    for (const row of INFO_ROWS) {
      expect(() => row.read(buildCockpitSnapshot({}))).not.toThrow();
      expect(() => row.read(null)).not.toThrow();
      expect(() => row.read(undefined)).not.toThrow();
      expect(() => row.read({})).not.toThrow();
    }
  });

  it('gives every row a label, a reader and a formatter and nothing else', () => {
    for (const row of INFO_ROWS) {
      expect(Object.keys(row).sort()).toEqual(['format', 'label', 'read']);
      expect(typeof row.label).toBe('string');
      expect(row.label.length).toBeGreaterThan(0);
      expect(typeof row.read).toBe('function');
      expect(typeof row.format).toBe('function');
    }
    expect(new Set(INFO_ROWS.map((r) => r.label)).size).toBe(INFO_ROWS.length);
  });

  it('reads an ATMO field the generator actually produces', () => {
    // THE TRIPWIRE ON A BUG THIS PANEL FOUND. src/main.js built planetPhysics with
    //     atmosphere: entry.planetData.atmosphereRetained !== undefined ? ... : null
    // and `atmosphereRetained` HAS NEVER EXISTED on planet data — PlanetGenerator's
    // return literal has no such key, and the only occurrence of the name in that file
    // is a PARAMETER passed into habitabilityScore(). So the test was
    // `undefined !== undefined` on every planet ever generated: physics.atmosphere was
    // null game-wide, BodyRenderer.hasAtmosphere() was permanently false, the debug
    // HUD's atmosphere row had never drawn, and this panel's ATMO row would have been
    // blank on every world in the galaxy while AC-PANEL-CONTENT's cross-check compared
    // null to null and passed.
    //
    // This asserts the SEAM, not the panel: the field main.js reads must be the field
    // the generator writes. It runs the real generator rather than a fixture, because a
    // fixture is exactly what let the original defect survive — it would have modelled
    // whatever main.js believed.
    const seeds = ['test-alpha', 'Aletheia', 'seed-1', 'seed-2', 'seed-3'];
    let checked = 0;

    for (const seed of seeds) {
      for (const entry of StarSystemGenerator.generate(seed).planets ?? []) {
        const d = entry.planetData;
        // The dead field stays dead. If someone reintroduces it, the two readings
        // would silently disagree and this names it.
        expect(d.atmosphereRetained).toBeUndefined();

        // An airless world legitimately carries no physics record at all, so only
        // count the ones that do.
        if (!d.atmosphere?.physics) continue;
        checked += 1;
        expect(d.atmosphere.physics.retained).toBe(true);
        expect(typeof d.atmosphere.physics.composition).toBe('string');
      }
    }

    // Non-vacuity: if the generator ever stops producing retained atmospheres, this
    // test must fail rather than iterate nothing and report success.
    expect(checked).toBeGreaterThan(0);
  });

  it('contains no skip or focus helper, so missing data can never make it green', () => {
    // The real guard runs at module scope below — see the comment there for why an
    // in-test version cannot work. This restates the guarantee by name in the report.
    expect(SELF_DISABLES_TESTS).toBe(false);
  });
});
