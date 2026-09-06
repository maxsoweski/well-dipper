/**
 * The three data panels — lane F (cockpit-screen-content-2026-07-28),
 * AC-PANEL-CONTENT. DrivePanel, TargetPanel, InfoPanel.
 *
 * ── WHAT IS UNDER TEST, AND WHAT CANNOT BE ──────────────────────────────────
 *
 * NOT under test: whether the panels LOOK right. There is no canvas in this test
 * environment — this repo's vitest runs in plain node with no jsdom, no happy-dom
 * and no node-canvas — so there are no pixels to inspect. Whether the speed reads
 * as the hero, whether the inverted banner reads as alarming rather than as a
 * printing fault, whether seven rows of dossier are actually legible at seventeen
 * degrees of arc: that is Max's eye, on the glass, at the real angular size.
 * Nothing here substitutes for it and nothing here claims to.
 *
 * Under test: that WHAT REACHES THE GLASS IS THE MODEL'S OWN ANSWER, character
 * for character, and that it obeys the three panel laws. Concretely:
 *
 *   1. THE STRINGS COME FROM THE MODELS. The DRIVE hero is `speedText` from
 *      `buildFlightReadout`; the ETA is its `eta`; the INFO rows are
 *      `buildInfoRows`'s rows in its order. Asserted against the builders AND,
 *      separately, against literal expected strings — the first catches a painter
 *      that recomputes, the second catches a builder that has silently changed.
 *   2. ONE INK. Every style any painter causes to be set is PHOSPHOR.INK or
 *      PHOSPHOR.BACK. Checked two independent ways, because either alone has a
 *      hole: watching the draw log catches a colour set on a path that ran, and
 *      scanning the three source files catches a colour sitting on a path this
 *      test happens not to exercise.
 *   3. LEGIBILITY. Every text size that reaches `fillText` is at or above H/24,
 *      with 24 WRITTEN OUT HERE rather than imported from PhosphorScreen. A test
 *      that reads its expectation from the module it guards agrees with every
 *      future edit by construction and guards nothing — and the specific edit
 *      being guarded against is the reasonable-sounding "just make it a bit
 *      smaller so one more row fits", which arrives as a change to BOTH files.
 *   4. NO INVENTED STATE. This game models no fuel, hull, heat, cargo or shields
 *      anywhere, so a label naming one could only ever display a made-up number.
 *      Scanned over the strings actually DRAWN, not over the source — the cockpit
 *      geometry is full of Hull_Nose and HULL_REF_LENGTH, so a source scan for
 *      /hull/i is pure noise here.
 *   5. BLANK, NEVER ZERO. A frame with no drive model, no target and no focused
 *      body draws labels and nothing else. Pinned as an EXACT list of drawn
 *      strings, so a fabricated "0.0 km" or "0:00" cannot hide in it.
 *   6. THE BLINK ACTUALLY MOVES. The same snapshot at two clock values in
 *      opposite phases must draw different things — and a STEADY cue must draw
 *      the same thing at both, since reassurance that flashes reads as an alarm.
 *
 * ── THE SNAPSHOTS ARE REAL ──────────────────────────────────────────────────
 *
 * Every fixture goes through `buildCockpitSnapshot`, never a hand-shaped
 * lookalike. A hand-written `{ drive: { speed: 1 } }` agrees with whatever the
 * painter happens to read, so it proves the painter consistent with the test
 * author's memory of the snapshot rather than with the snapshot. The builder's
 * own defaults — `scModel?.throttle ?? 0`, `speedCap: null` when there is no
 * model — are exactly the shapes the missing-means-blank rule has to survive.
 */
import { describe, it, expect } from 'vitest';
import { decodePixelText, measurePixelText, FACE } from '../../rendering/PixelText.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { buildCockpitSnapshot } from '../CockpitSnapshot.js';
import { PhosphorScreen, PHOSPHOR } from '../PhosphorScreen.js';
import { buildFlightReadout, flightReadoutStateFromSnapshot } from '../FlightReadout.js';
import { buildInfoRows, INFO_ROWS } from '../InfoReadout.js';
import { ALERT_TEXT, briefAlert } from '../../ui/AlertCue.js';
import { formatSpeed, C_IN_SCENE_PER_S } from '../../ui/SpeedFormat.js';

import { paintDrive, shortMode, formatSpeedCap, formatTurnCap } from '../panels/DrivePanel.js';
import { paintTarget, formatDistance } from '../panels/TargetPanel.js';
import { paintInfo } from '../panels/InfoPanel.js';
import { fitDesignation } from '../designation.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const PANEL_DIR = join(HERE, '..', 'panels');
const PANEL_FILES = ['DrivePanel.js', 'TargetPanel.js', 'InfoPanel.js'];

/**
 * Is this file disabling any of its own tests?
 *
 * Comments are stripped first and the pattern is assembled from fragments,
 * because a literal one would match itself and this header discusses the very
 * helpers being scanned for. The check is about code, not prose.
 *
 * WHY THIS SITS AT MODULE SCOPE AND THROWS rather than living only inside an
 * it(). Measured on the sibling ScreenUV.test.js, not assumed: putting `it.only`
 * on one test there made vitest report "1 passed | 6 skipped" and exit GREEN,
 * because the scan was one of the tests it skipped. A self-scan that only runs as
 * a test cannot see a helper that stops it running. Module scope executes during
 * collection, before the runner can honour any focus helper, so the throw below
 * fires whatever the tests say. The it() further down is kept as well, so the
 * guarantee shows up by name in the report.
 */
const SELF_CODE = readFileSync(join(HERE, 'panels.test.js'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');
const DISABLED_RE = new RegExp(
  ['describe', 'it', 'test'].flatMap((k) => [k + '\\.skip', k + '\\.only']).join('|'),
);
const SELF_DISABLES_TESTS = DISABLED_RE.test(SELF_CODE);
if (SELF_DISABLES_TESTS) {
  throw new Error(
    'panels.test.js disables one of its own tests (a skip or focus helper is present in its ' +
    'code). This file is the whole of the guarantee that the cockpit glass shows the model\'s ' +
    'own numbers in one ink at a readable size, so a disabled test here reads as "the panels ' +
    'are fine" when nothing was checked at all. Remove the helper.',
  );
}

// ── The recording stub context ──────────────────────────────────────────────
//
// The same recorder PhosphorScreen.test.js uses, rebuilt here because that file
// keeps it local (it exports the module's API, not its test helpers). Copying it
// rather than exporting it from there is the smaller evil: a shared test helper
// that both files depend on becomes a place where loosening one assertion
// quietly loosens another file's too.

/**
 * A width per character, as a fraction of the font size. Any plausible constant
 * does — what matters is that `measureText` returns a finite number that SCALES
 * WITH THE FONT SIZE, so a measurement taken under the wrong font comes out with
 * the wrong width instead of being absorbed.
 *
 * IT IS NOT THE REAL FONT'S METRIC, and one test below depends on knowing that:
 * the TARGET panel's "does this name fit" decision is proved to WORK here, but
 * whether a given name actually fits on real glass is a question only the
 * platform's monospace face can answer.
 */
const STUB_CHAR_W = 0.6;

/** The size `measureText` assumes when no font has been set — matches nothing. */
const STUB_NO_FONT_SIZE = 10;

const FONT_SIZE_RE = /(\d+(?:\.\d+)?)px/;

function makeRecordingCtx() {
  const log = [];
  const state = {
    fillStyle: null, strokeStyle: null, font: null,
    textAlign: null, textBaseline: null, lineWidth: null,
  };

  const ctx = {
    get log() { return log; },
    fillRect(x, y, w, h) {
      log.push({ op: 'fillRect', x, y, w, h, fillStyle: state.fillStyle });
    },
    fillText(text, x, y) {
      log.push({ op: 'fillText', text, x, y, fillStyle: state.fillStyle, font: state.font });
    },
    measureText(text) {
      const m = FONT_SIZE_RE.exec(state.font || '');
      const size = m ? Number(m[1]) : STUB_NO_FONT_SIZE;
      log.push({ op: 'measureText', text, font: state.font });
      return { width: String(text).length * STUB_CHAR_W * size };
    },
    // Present although the kit does not stroke today: a future edit that reaches
    // for a stroked hairline is then RECORDED and caught by the one-ink checks,
    // rather than crashing with "beginPath is not a function" and being fixed by
    // adding it to the stub.
    beginPath() { log.push({ op: 'beginPath' }); },
    moveTo(x, y) { log.push({ op: 'moveTo', x, y }); },
    lineTo(x, y) { log.push({ op: 'lineTo', x, y }); },
    stroke() { log.push({ op: 'stroke', strokeStyle: state.strokeStyle }); },
    save() { log.push({ op: 'save' }); },
    restore() { log.push({ op: 'restore' }); },
  };

  // Real property setters. `ctx.fillStyle = '#f00'` on a plain object is
  // invisible to any observer, and the one-ink rule would be uncheckable.
  for (const prop of ['fillStyle', 'strokeStyle', 'font', 'textAlign', 'textBaseline', 'lineWidth']) {
    Object.defineProperty(ctx, prop, {
      get() { return state[prop]; },
      set(value) { state[prop] = value; log.push({ op: 'set', prop, value }); },
    });
  }
  return ctx;
}

// ── The panel geometry these tests run at ───────────────────────────────────
//
// 512 tall is PanelHost's default buffer height; 614 is round(512 * 1.200), the
// aspect measured off cockpit.glb's display faces (0.240 x 0.200 m). Written out
// rather than imported from `derivePanelBuffer` so this file states the shape it
// is testing at instead of agreeing with whatever the host computes.
const PANEL_H = 512;
const PANEL_W = 614;

/**
 * The legibility floor, as a fraction of the buffer height — WRITTEN OUT, not
 * imported from PhosphorScreen. If MIN_TEXT_RATIO there is ever lowered, this
 * number does not move with it, which is the entire point: at 17 degrees of a 70
 * degree FOV a panel is only about 260 screen pixels tall, so H/24 arrives at the
 * pilot's eye as roughly 11 pixels of cap height. Below that a bold monospace
 * glyph stops being something you read.
 */
const MIN_TEXT_DIVISOR = 24;

/** Run one painter against one snapshot and hand back everything it did. */
function paint(painter, snapshot, nowMs = 0) {
  const ctx = makeRecordingCtx();
  const screen = new PhosphorScreen(ctx, { width: PANEL_W, height: PANEL_H });
  painter(screen, snapshot, nowMs);
  return { ctx, screen, log: ctx.log };
}


// ── ⭐ TEXT IS READ BACK OUT OF THE TEXELS NOW ─────────────────────────────────────────────────
// chrome-and-ui-at-240p moved the cockpit kit onto the repo's bitmap face, so nothing calls
// `ctx.fillText` any more and the first argument these tests used to read no longer exists.
// ⛔ THE REPLACEMENT IS NOT A SELF-REPORT. `decodePixelText` reconstructs each string from the
// `fillRect` texels actually recorded, so every assertion below still asks the GLASS what it says
// — and asks it harder than before: a dropped glyph row or a fractional scale now fails, where a
// `fillText` string argument would have read perfectly either way.
function decodedText(log) {
  const rects = log.filter((e) => e.op === 'fillRect');
  return decodePixelText(rects).map((d) => {
    const px = d.scale * FACE.h;
    // ⚠ ANY texel of the run, not the one at (x, y): a glyph's first lit pixel is rarely its
    // top-left corner, so an exact-corner lookup returned undefined and reported `fillStyle: null`
    // — which read as "text drawn with no colour set" in the one-ink checks.
    const src = rects.find((r) => r.x >= d.x && r.x < d.x + d.text.length * FACE.advance * d.scale
      && r.y >= d.y && r.y < d.y + FACE.h * d.scale && r.w === d.scale);
    return {
      // The BASELINE, not the top — `text()`/`row()`/`banner()` take a baseline and every
      // assertion here is written against that. Exact on a bitmap face: baseline = top + cap.
      op: 'fillText', text: d.text, x: d.x, y: d.y + px, size: px,
      // `font` is synthesised so the existing FONT_SIZE_RE size readers keep working unchanged.
      font: `${px}px bitmap`, fillStyle: src ? src.fillStyle : null,
    };
  });
}

const ops = (log, op) => (op === 'fillText' ? decodedText(log) : log.filter((e) => e.op === op));


/** Every string that reached the glass, in order. */
const drawn = (log) => ops(log, 'fillText').map((e) => e.text);
/** The font size a fillText entry ran at. */
const sizeOf = (entry) => Number(FONT_SIZE_RE.exec(entry.font || '')[1]);

/**
 * The value drawn on the same baseline as `label` — i.e. the right-hand half of
 * a `row()`. Returns '' when the row drew no value, which is exactly what a blank
 * reading looks like: the label holds its line and nothing sits beside it.
 */
function rowValue(log, label) {
  const texts = ops(log, 'fillText');
  const i = texts.findIndex((e) => e.text === label);
  if (i < 0) throw new Error(`no row labelled ${label} was drawn; drawn: ${texts.map((t) => t.text).join(' | ')}`);
  const beside = texts.slice(i + 1).find((e) => e.y === texts[i].y);
  return beside ? beside.text : '';
}

/**
 * Assert that `text` was drawn STRICTLY larger than everything else on the panel.
 *
 * Strictly, and that word was paid for: the first version of this took the
 * largest entry with `reduce((a, b) => size(b) > size(a) ? b : a)` and compared
 * its text. That keeps the FIRST of any tie — and the hero is drawn first — so
 * when a planted defect shrank the hero to body size, the assertion happily
 * agreed that the hero was still the biggest thing on a panel where four other
 * strings were exactly as big. A vacuous pass, measured, not imagined.
 */
function expectStrictlyBiggest(log, text) {
  const entries = ops(log, 'fillText');
  const hero = entries.find((e) => e.text === text);
  expect(hero, `${JSON.stringify(text)} was never drawn`).toBeTruthy();
  for (const e of entries) {
    if (e === hero) continue;
    expect(sizeOf(hero), `${JSON.stringify(text)} is not bigger than ${JSON.stringify(e.text)}`)
      .toBeGreaterThan(sizeOf(e));
  }
}

/** Did the whole buffer get painted black? Counts the full-panel clears. */
const fullClears = (log) => ops(log, 'fillRect')
  .filter((e) => e.x === 0 && e.y === 0 && e.w === PANEL_W && e.h === PANEL_H && e.fillStyle === PHOSPHOR.BACK);

// ── The fixtures ────────────────────────────────────────────────────────────

/**
 * A ship at half light speed, closing too fast on a selected planet, mass-locked,
 * with that planet focused for the dossier.
 *
 * Chosen so that every element of all three panels has something to say AT ONCE,
 * including both alert cues (they are independent axes — neither suppresses the
 * other — so a fixture that could not raise both would leave that untested).
 *
 * `scModel` is a stand-in with the two cap ACCESSORS the snapshot calls, because
 * `speedCap` and `turnRateCap` are methods on SupercruiseModel and the builder
 * invokes them. Everything else is the real builder's own work.
 */
const FLYING = buildCockpitSnapshot({
  scModel: {
    speed: 0.5 * C_IN_SCENE_PER_S,          // exactly 0.50 c
    throttle: 0.8,
    driveOn: true,
    speedCap: () => 4000,                   // deep-space-ish ceiling
    turnRateCap: () => 0.7,                 // rad/s — TURN_RATE_MAX, i.e. at rest
  },
  commandedSpeed: 0.6 * C_IN_SCENE_PER_S,
  sublightCap: 0.002,
  selectedTarget: { kind: 'planet', name: 'Veskol b' },
  targetDistance: 250,                      // scene units = 0.25 AU
  aimOnTarget: true,
  drop: { state: 'too-fast', dropMaxSpeed: 0.004, captureSphere: 0.01 },
  massLockHint: true,
  flightMode: 'manual',
  focusedBody: {
    kind: 'planet',
    name: 'Veskol b',
    data: { type: 'terrestrial', T_eq: 374.2 },
    physics: {
      composition: { surfaceType: 'silicate', ironFraction: 0.31 },
      atmosphere: { retained: true, composition: 'co2-n2', pressure: 0.85 },
      tidalState: { locked: false, lockType: 'none' },
    },
  },
});

/**
 * The same approach, but inside the capture sphere and slow enough to drop —
 * SAFE TO DROP, which is the STEADY cue, and no mass lock.
 */
const SAFE = buildCockpitSnapshot({
  scModel: { speed: 0.002, throttle: 0.1, driveOn: true, speedCap: () => 0.01, turnRateCap: () => 0.7 },
  selectedTarget: { kind: 'moon', name: 'Veskol b I' },
  targetDistance: 0.004,
  aimOnTarget: true,
  drop: { state: 'in-window', dropMaxSpeed: 0.004, captureSphere: 0.01 },
  flightMode: 'manual',
});

/**
 * Nothing at all: no drive model, no selection, no focus. This is literally what
 * `CockpitSnapshotProvider` holds before its first `update()`, so it is a frame
 * that WILL be painted, not a contrived edge case.
 */
const EMPTY = buildCockpitSnapshot({});

/** What the models say about the flying frame — the oracle for the painters. */
const FLYING_READOUT = buildFlightReadout(flightReadoutStateFromSnapshot(FLYING));

// ── 0. The self-scan, by name ───────────────────────────────────────────────

describe('panels.test.js — this file does not disable itself', () => {
  it('contains no skip or focus helper (also enforced at module scope)', () => {
    expect(SELF_DISABLES_TESTS).toBe(false);
  });
});

// ── 1. The strings are the models' own ──────────────────────────────────────

describe('DRIVE — every string is the flight model\'s, unchanged', () => {
  it('draws the speed, its tier, the mode and the mass-lock banner', () => {
    const { log } = paint(paintDrive, FLYING, 0);
    const texts = drawn(log);

    // Against the MODEL: a painter that recomputes the speed — drops the REV
    // prefix, picks its own tier, rounds differently — diverges here even if it
    // looks plausible on its own.
    expect(texts).toContain(FLYING_READOUT.speedValue);
    expect(texts).toContain(FLYING_READOUT.tierLine);
    // And against LITERALS, so a builder that silently changed its answer cannot
    // drag this test along with it.
    expect(FLYING_READOUT.speedValue).toBe('0.50');
    expect(FLYING_READOUT.tierLine).toBe('c');
    // ⭐ THE UNIT IS SPLIT OFF THE NUMBER, NOT DROPPED. The display tier holds four characters on
    // a panel this wide, and "0.50 c" is six — so a hero drawn from `speedText` fell back to body
    // size on every frame and the panel had no hero at all. Both halves are still on the glass and
    // still the model's own strings; this asserts the pair, so losing either one fails.
    expect(`${FLYING_READOUT.speedValue} ${FLYING_READOUT.tierLine}`)
      .toBe(FLYING_READOUT.speedText);

    // ⛔ CAP AND TURN ARE GONE FROM THE GLASS, BY MAX'S RULING OF 2026-09-08 ("1, okay"). The panel
    // is 43 rows and holds seven lines, the hero takes two of them, and these were the two rows
    // with nowhere to go. CAP's real job is already drawn as the drop tick on the speed bar.
    expect(texts, 'CAP came back to the drive screen').not.toContain('CAP');
    expect(texts, 'TURN came back to the drive screen').not.toContain('TURN');
    // ⭐ AND THE FORMATTERS ARE STILL THERE AND STILL CORRECT. Max's ruling came with *"don't get
    // rid of any code that allows you to display what we want to display"*, so what came off is the
    // DRAW, not the ability. Asserting them directly is what keeps that true rather than polite.
    const cap = formatSpeed(4000);
    expect(formatSpeedCap(4000)).toBe(`${cap.value} ${cap.unit}`);
    expect(formatSpeedCap(4000)).toBe('1,996 c');
    // 0.7 rad/s is 40.1 deg/s. Whole degrees: a decimal place is unreadable at
    // this angular size and tells the pilot nothing they can act on.
    expect(formatTurnCap(0.7)).toBe('40 deg/s');

    // The mode, with the prefix stripped — "MODE: MANUAL" is twelve characters and the panel is
    // eight. The model still composes the long form and the panel still reads it from there.
    // ⚠ READ ON A DARK BLINK PHASE, BECAUSE THE BANNER TAKES THIS LINE WHILE IT IS LIT. The panel
    // is 43 rows and has no room for a seventh element, so at most one of the two is ever drawn;
    // `FLYING` is mass-locked, and at t=0 the fast tier is lit.
    const quiet = drawn(paint(paintDrive, FLYING, 350).log);
    expect(quiet).toContain(shortMode(FLYING_READOUT.modeLine));
    expect(FLYING_READOUT.modeLine).toBe('MODE: MANUAL');
    expect(shortMode(FLYING_READOUT.modeLine)).toBe('MANUAL');
    expect(texts, 'the mode was drawn under the banner rather than replaced by it')
      .not.toContain('MANUAL');

    // The drive's own warning, at the width a banner has. The long form is untouched and is what
    // the DOM overlay still draws; `briefAlert` is the lookup between them.
    expect(texts).toContain(briefAlert(ALERT_TEXT.MASS_LOCK));
    expect(briefAlert(ALERT_TEXT.MASS_LOCK)).toBe('TOOCLOSE');
  });

  it('keeps the REV prefix on a reversing ship', () => {
    // MEASURED HOLE, and this test exists because of it. The assertion above
    // compares the hero to the model at 0.50 c — a value a hand-rolled
    // `speed / C` recomputation reproduces exactly, so a painter that had grown
    // its own speed string passed it. This case cannot be reproduced by accident:
    // `formatSpeed` returns a MAGNITUDE (it takes Math.abs), so the direction
    // exists only in the prefix the model adds afterwards, and any recomputation
    // that goes through the formatter alone loses it. The number stays right and
    // the ship silently stops reading as reversing.
    const reversing = buildCockpitSnapshot({
      scModel: { speed: -0.001, driveOn: false, throttle: -0.5, speedCap: () => 0.01, turnRateCap: () => 0.7 },
      sublightCap: 0.002,
    });
    const model = buildFlightReadout(flightReadoutStateFromSnapshot(reversing));
    // ⭐ THE PREFIX RIDES ON THE HERO, NOT ON THE TIER LINE, and that is deliberate: it belongs to
    // the number it negates. It costs the hero its size when reversing — "REV 150" is seven
    // characters and the display tier holds four — and a smaller correct number beats a large
    // wrong one, which is what a magnitude with no direction is.
    expect(drawn(paint(paintDrive, reversing, 0).log)).toContain(model.speedValue);
    expect(model.speedValue).toBe('REV 150');
    expect(model.speedText).toBe('REV 150 km/s');
  });

  it('says nothing about the drive being on — the absence of SUB is the statement', () => {
    const flying = drawn(paint(paintDrive, FLYING, 0).log);
    expect(flying, 'supercruise announced itself').not.toContain('SUB');
    expect(flying, 'the tier line lost the unit').toContain('c');

    // Drive off: the tag appears, and it shares its line with the unit. ⚠ "SUB", not "SUBLIGHT" —
    // the long word is exactly eight characters and would leave the hero number with no unit under
    // it, which is a number that means nothing. The model composes both; the panel draws the one
    // that fits, and `READOUT_TEXT.SUBLIGHT` is unchanged for the surfaces that have room.
    const off = buildCockpitSnapshot({
      scModel: { speed: 0.001, driveOn: false, throttle: 0.5, speedCap: () => 0.01, turnRateCap: () => 0.7 },
      sublightCap: 0.002,
    });
    const offModel = buildFlightReadout(flightReadoutStateFromSnapshot(off));
    expect(drawn(paint(paintDrive, off, 0).log)).toContain(offModel.tierLine);
    expect(offModel.tierLine).toBe('SUB km/s');
    expect(offModel.sublightTag, 'the long form was removed rather than left alone')
      .toBe('SUBLIGHT');
  });

  it('draws the speed as the largest thing on the panel', () => {
    // "Speed is the hero" is the one layout rule this panel exists to serve, and
    // it is the first casualty of adding rows: the natural fix for a crowded panel
    // is to shrink the number nobody is supposed to have to look for.
    const { log } = paint(paintDrive, FLYING, 0);
    expectStrictlyBiggest(log, FLYING_READOUT.speedValue);
  });
});

describe('TARGET — name, distance, ETA and the approach cue', () => {
  it('draws the selected body\'s name, its distance and the model\'s ETA', () => {
    const { log } = paint(paintTarget, FLYING, 0);
    const texts = drawn(log);

    expect(texts).toContain('Veskol b');

    // ⛔ THE DISTANCE HAS NO LABEL ANY MORE, AND THAT IS THE FIX FOR A REAL DEFECT rather than a
    // tidy-up. A row is a 3-character label and a 5-character value on a 9-character panel;
    // `formatDistance` emits up to eight ("14959 Mm", "0.25 AU"). Drawn as `row('DIST', …)` the
    // label and the value OVERLAPPED — the value's first glyph landing on the label's last — and
    // the result on the glass was a smear of half-glyphs, not a clipped row.
    //
    // ⭐ IT WAS FOUND BECAUSE THESE TESTS READ THE TEXELS BACK. The overlap came back from
    // `decodePixelText` as a run of replacement characters that no assertion had asked for. A test
    // that trusted the string handed to `fillText` would have been green on a broken panel.
    //
    // Nothing is lost by dropping the label: the panel carries exactly one distance and the number
    // brings its own unit.
    expect(texts).toContain('0.25 AU');            // 250 scene units = a quarter AU (1 AU = 1000 u)
    expect(texts).toContain(formatDistance(250));
    expect(texts, 'the distance grew a label it has no room for').not.toContain('DST');

    // The ETA is the model's string, not a second division of distance by speed. It keeps its
    // label: 'ETA' plus '4:09' is seven characters, and '--:--' is exactly five.
    expect(rowValue(log, 'ETA')).toBe(FLYING_READOUT.eta);
    expect(FLYING_READOUT.eta).toBe('4:09');

    // Too fast to drop → SLOW DOWN, at the width a banner has. Nine characters, and the long form
    // is unchanged for the DOM overlay that still draws it.
    expect(texts).toContain(briefAlert(ALERT_TEXT.DROP_SLOW));
    expect(texts).not.toContain(briefAlert(ALERT_TEXT.DROP_SAFE));
  });

  it('draws a short designation at the display tier, and a long one at body size', () => {
    // ⭐ "SHOUT THE SHORT NAME" IS MEASURED, NOT ASSERTED. The display tier is two cells tall and
    // holds four characters here; the body tier holds nine. So the panel picks the largest tier
    // that holds the FITTED name, which means a short designation genuinely shouts and a long one
    // is legible rather than absent. 'Veskol b' is eight characters and takes the body tier.
    const { log, screen } = paint(paintTarget, FLYING, 0);
    const hero = ops(log, 'fillText').find((e) => e.text === 'Veskol b');
    expect(hero, 'the name was not drawn at all').toBeTruthy();
    expect(hero.size).toBe(screen.type.body);
    expect('Veskol b'.length).toBeGreaterThan(screen.colsAt(screen.type.display));

    // ⚠ 'Sol b' would NOT take the display tier: it is five characters and the tier holds four.
    // The fixture is a name that genuinely fits, so this asserts the branch rather than the label.
    const short = buildCockpitSnapshot({
      selectedTarget: { kind: 'star', name: 'Sol' }, targetDistance: 250,
    });
    const shortLog = paint(paintTarget, short, 0).log;
    const shortHero = ops(shortLog, 'fillText').find((e) => e.text === 'Sol');
    expect(shortHero, 'a short designation was not drawn').toBeTruthy();
    expect(shortHero.size, 'a name that fits the display tier was drawn small anyway')
      .toBe(screen.type.display);
    expectStrictlyBiggest(shortLog, 'Sol');
  });

  it('fits a long designation by dropping the system, and never draws it twice', () => {
    // A real procedural designation: NameGenerator embeds ~70 bits of position injectively, so
    // 14-20 characters is ordinary and a planet suffix adds more. This is the COMMON case.
    //
    // ⛔ THIS TEST'S OLD SUBJECT — "draw at display size, measure the probe, clear the whole buffer
    // and redraw one size down" — IS GONE, and it was a defect rather than a feature at the game's
    // resolution. The display tier holds FOUR characters on this panel, so the probe overflowed on
    // essentially every body, and the "one size down" landed at body size, where a 21-character
    // name also does not fit and drew off both edges anyway. The panel was broken before this
    // workstream touched it, which is what Max was told and what he ruled on.
    //
    // ⭐ MAX'S RULING, 2026-09-08 ("2. sounds good"): shout the short name and the distance, and
    // DROP the full designation. Not "the full name small underneath" — off the glass.
    const long = buildCockpitSnapshot({
      selectedTarget: { kind: 'planet', name: 'PVX J4K7Q2M+9XP3RWZ b' },
      targetDistance: 250,
    });
    const { log, screen } = paint(paintTarget, long, 0);
    const texts = drawn(log);

    expect(texts, 'the full designation is back on the glass')
      .not.toContain('PVX J4K7Q2M+9XP3RWZ b');
    expect(texts).toContain(fitDesignation('PVX J4K7Q2M+9XP3RWZ b', screen.colsAt(screen.type.body)));

    // ⛔ ONE CLEAR, ALWAYS. The probe-and-redraw made every other element's ordering load-bearing:
    // a label painted before the hero was wiped by the overflow path, on exactly the long names
    // that most needed saying what they were. Nothing draws twice now, so nothing can be wiped.
    expect(fullClears(log).length, 'the panel cleared itself twice — a probe came back').toBe(1);
    expect(fullClears(paint(paintTarget, FLYING, 0).log).length).toBe(1);

    // ⚠ WHAT THIS DOES NOT PROVE. That the fitted string is the RIGHT thing to say about this body
    // is Max's judgement, not a measurement. What is proved is that it fits the glass, that the
    // panel says something rather than nothing, and that no identifier is silently truncated into
    // a plausible different one — which is `designation.js`'s whole subject.
  });

  it('keeps a STEADY cue lit at every phase of the clock', () => {
    // SAFE TO DROP is reassurance. A reassurance that flashes reads as an alarm,
    // and on a one-ink panel movement is the ONLY urgency channel left — so a
    // steady tier that quietly started blinking would be saying the opposite of
    // what it means.
    for (const t of [0, 400, 900, 1500, 2000]) {
      expect(drawn(paint(paintTarget, SAFE, t).log)).toContain(briefAlert(ALERT_TEXT.DROP_SAFE));
    }
    // Nine characters, which is what the lower pair of screens holds. The long form is untouched
    // and is still what the DOM overlay draws.
    expect(briefAlert(ALERT_TEXT.DROP_SAFE)).toBe('SAFE DROP');
    expect(ALERT_TEXT.DROP_SAFE).toBe('SAFE TO DROP');
  });
});

// ── 1b. TARGET says where the warp is going ─────────────────────────────────

/**
 * A warp destination picked out of the sky, with no body selected.
 *
 * ⭐ THIS IS NOT A CONTRIVED FRAME — IT IS THE ONLY FRAME THERE IS after a warp
 * pick. `trySelectWarpTarget` (main.js:11113) opens with
 * `if (_selectedTarget) scControls.deselect();`, the single-selection invariant,
 * so choosing a destination NULLS the body this panel's hero reads. Before this
 * block, the moment a pilot picked where to go the TARGET glass lost its hero and
 * held two empty rows, and — since BodyInfo, which used to type out "Warp Target",
 * is suppressed in HELM (main.js:662) — the destination was announced nowhere on
 * the primary path. The snapshot has carried `warp.targetName`
 * (CockpitSnapshot.js:208) since increment 6 and no painter has ever read it.
 */
const WARP_PICKED = buildCockpitSnapshot({
  scModel: { speed: 1.0, driveOn: true, throttle: 0.4, speedCap: () => 4000, turnRateCap: () => 0.7 },
  flightMode: 'manual',
  warpTarget: { name: 'PVX J4K7Q2M+9XP3RWZ' },
});

describe('TARGET — the warp destination, once the body selection is gone', () => {
  it('draws the destination name when a warp target is picked and nothing is selected', () => {
    // Fitted to the glass, like any other designation — a warp destination is not exempt from a
    // nine-character panel. What matters is that the destination is ANNOUNCED: before this painter
    // read `warp.targetName`, picking a destination emptied the glass and named it nowhere.
    const { log, screen } = paint(paintTarget, WARP_PICKED, 0);
    expect(drawn(log)).toContain(
      fitDesignation('PVX J4K7Q2M+9XP3RWZ', screen.colsAt(screen.type.body)));
  });

  it('labels it, so a destination cannot be misread as the body under the reticle', () => {
    // The two states occupy the same hero slot and mean opposite things — one is
    // what a burn will hit, the other is what a warp will leave for. NavComputer
    // already calls it WARP TARGET on its own prism view (NavComputer.js:1860);
    // the same words here mean the glass agrees with itself.
    // ⚠ 'WARP', not 'WARP TARGET': eleven characters on a nine-character panel. The long form is
    // still NavComputer's and still what its prism view draws; this is the same word at the width
    // the glass has, and the word that survives is the one that discriminates.
    const texts = drawn(paint(paintTarget, WARP_PICKED, 0).log);
    expect(texts).toContain('WARP');
    // And the label is absent when there is a body instead — otherwise it is
    // decoration rather than a discriminator.
    expect(drawn(paint(paintTarget, FLYING, 0).log)).not.toContain('WARP');
  });

  it('cannot lose the label to a re-clear, because there is no longer one to lose it to', () => {
    // ⭐ THE HAZARD THIS TEST GUARDED IS GONE, AND THE TEST SAYS SO RATHER THAN BEING DELETED.
    //
    // It used to assert ORDER: `drawHeroName` measured a probe at display size and, on overflow,
    // cleared the WHOLE buffer and redrew — so a label painted before that clear vanished from the
    // glass, on exactly the long designations that most needed saying what they were. And the
    // obvious assertion could not catch it, because `drawn()` reads a log and a later `clear()`
    // removes nothing from a log; only the ordering against the second clear discriminated.
    //
    // The painter measures instead of probing now, so it draws each element exactly once and the
    // ordering stopped being load-bearing. ⛔ THE RIGHT REPLACEMENT IS THE STRUCTURAL PROPERTY, not
    // a re-run of an ordering that no longer decides anything: exactly one clear, on the frame that
    // used to need two. If a probe is ever reintroduced, this goes red.
    const { log } = paint(paintTarget, WARP_PICKED, 0);
    expect(fullClears(log).length,
      'the panel cleared itself twice — a measure-by-drawing probe is back, and with it the ' +
      'ordering hazard this test used to defend against').toBe(1);

    const texts = drawn(log);
    expect(texts, 'the label was never drawn').toContain('WARP');
  });

  it('leaves DIST and ETA blank for a destination that has no in-system range', () => {
    // The load-bearing half of "blank, never zero". A warp destination is a star
    // in the galaxy, not a body in this system: `target.distance` is null and the
    // ETA model has nothing to divide. A painter that reached for the drive's
    // numbers here would print a confident reading of the wrong thing.
    const { log } = paint(paintTarget, WARP_PICKED, 0);
    const texts = drawn(log);
    // The distance line is unlabelled, so "blank" means the line is simply not there — there is no
    // label left behind to read as a reading of zero.
    expect(texts.some((t) => /\d/.test(t) && /km|Mm|AU/.test(t)),
      'a distance was printed for a destination that has none').toBe(false);
    // ETA keeps its label and blanks its value, which is what holds the line.
    expect(rowValue(log, 'ETA')).toBe('');
  });

  it('keeps the selected body as the hero if both are somehow set', () => {
    // ⚠ HONEST LIMIT: the game makes this state unreachable in BOTH directions —
    // picking a star deselects the body (main.js:11113) and picking a body calls
    // `_clearWarpTargetSelection()` (main.js:7279). So this pins the painter's
    // DETERMINISM, not a reachable frame. It is here because the hero slot is
    // shared: a later edit that swapped the precedence would replace the thing a
    // burn is about to hit with the thing a warp is about to leave for, and no
    // other test in this file would notice.
    const both = buildCockpitSnapshot({
      selectedTarget: { kind: 'planet', name: 'Veskol b' },
      targetDistance: 250,
      warpTarget: { name: 'PVX J4K7Q2M+9XP3RWZ' },
    });
    const { log, screen } = paint(paintTarget, both, 0);
    const texts = drawn(log);
    expect(texts).toContain('Veskol b');
    expect(texts).not.toContain(
      fitDesignation('PVX J4K7Q2M+9XP3RWZ', screen.colsAt(screen.type.body)));
    expect(texts).not.toContain('WARP');
  });
});

describe('INFO — the dossier, straight off the table', () => {
  it('draws every row of buildInfoRows, in order, label and value verbatim', () => {
    const { log } = paint(paintInfo, FLYING, 0);
    // ⭐ THE PANEL ASKS THE TABLE FOR ITS BRIEF PROJECTION, so the oracle does too. Asking for the
    // long form here and expecting the panel to match would assert that the redesign did not
    // happen. What is still being tested is the property that matters and has not changed: the
    // painter draws what the table hands it, in the table's order, verbatim.
    const rows = buildInfoRows(FLYING, undefined, { brief: true });
    const [headline, ...labelled] = rows;

    for (const row of labelled) {
      expect(drawn(log)).toContain(row.label);
      expect(rowValue(log, row.label)).toBe(row.value);
    }
    // The first row is the panel's HEADING — unlabelled, across the full width — so it is asserted
    // as a drawn string rather than as a row value. That is the table's instruction (`headline`),
    // not the painter's opinion about what BODY is.
    expect(drawn(log)).toContain(headline.value);

    // The order is the table's order, top to bottom on the glass.
    const labelsInDrawOrder = ops(log, 'fillText')
      .filter((e) => labelled.some((r) => r.label === e.text))
      .map((e) => e.text);
    expect(labelsInDrawOrder).toEqual(labelled.map((r) => r.label));
    const ys = ops(log, 'fillText')
      .filter((e) => labelled.some((r) => r.label === e.text))
      .map((e) => e.y);
    expect([...ys].sort((a, b) => a - b)).toEqual(ys);

    // And the literals, so a table that silently changed shape is visible here rather than being
    // agreed with. ⛔ Every value is five characters or fewer, which is the budget; the one that
    // LOSES something is ATM, and it loses the gas mix, by Max's ruling of 2026-09-08.
    expect(headline.value).toBe('Veskol b');
    expect(rowValue(log, 'TEQ')).toBe('374');
    expect(rowValue(log, 'CMP')).toBe('FE.31');
    expect(rowValue(log, 'ATM')).toBe('0.85');
    expect(rowValue(log, 'TID')).toBe('FREE');
    // ⭐ AND THE LONG FORM IS STILL PRODUCIBLE FROM THE SAME READING. This is the half of Max's
    // ruling that is easy to lose: the mix came off the GLASS, not out of the pipeline.
    const long = Object.fromEntries(buildInfoRows(FLYING).map((r) => [r.label, r.value]));
    expect(long.ATMO).toBe('co2-n2 0.85 bar');
    expect(long.COMP).toBe('silicate Fe0.31');
    expect(long.T_EQ).toBe('374 K');
  });

  it('holds the line for a moon, which has no equilibrium temperature', () => {
    // AC-PANEL-CONTENT names this case by hand: T_eq is written onto PLANET data
    // only — PlanetGenerator returns it, MoonGenerator does not, stars have no
    // such field — so it "reads BLANK, not stale, not 0" for a focused moon.
    // This is the frame where a formatter written as `${v || 0} K` produces its
    // most convincing lie: an authoritative 0 K on a body nobody measured.
    const moon = buildCockpitSnapshot({
      focusedBody: {
        kind: 'moon',
        name: 'Veskol b I',
        data: { type: 'ice' },
        physics: { tidalState: { locked: true, lockType: 'synchronous' } },
      },
    });
    const { log } = paint(paintInfo, moon, 0);

    expect(drawn(log)).toContain('TEQ');
    expect(rowValue(log, 'TEQ')).toBe('');
    expect(rowValue(log, 'TID')).toBe('SYNC');

    // Every labelled row still drew, blank or not. A row that vanished with its value would make
    // every row beneath it jump up the glass — and a pilot glancing at a readout whose lines have
    // moved reads the wrong one.
    const abbrs = INFO_ROWS.filter((r) => !r.headline).map((r) => r.abbr);
    const labels = ops(log, 'fillText').filter((e) => abbrs.includes(e.text));
    expect(labels.length).toBe(abbrs.length);

    // And at exactly the same baselines as a frame with every value present.
    const full = paint(paintInfo, FLYING, 0).log;
    const yOf = (l, label) => ops(l, 'fillText').find((e) => e.text === label).y;
    for (const a of abbrs) expect(yOf(log, a)).toBe(yOf(full, a));
  });

  it('names no field of its own — the table is the only place fields are listed', () => {
    // The deliverable Max asked for is the PIPELINE: "we can expand/adjust the
    // systems generating that info in the future". That property dies the moment
    // the painter knows a field name, because then adding a row is two edits in
    // two files — which is the shape of change that does not get made.
    const code = readFileSync(join(PANEL_DIR, 'InfoPanel.js'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');

    for (const label of INFO_ROWS.flatMap((r) => [r.label, r.abbr]).filter(Boolean)) {
      expect(code, `InfoPanel.js mentions the row label ${label} in code`).not.toContain(label);
    }
    for (const field of ['survey', 'tEq', 'composition', 'atmosphere', 'tidalState']) {
      expect(code, `InfoPanel.js reads ${field} itself instead of going through the table`)
        .not.toContain(field);
    }
  });
});

// ── 1b. The DRIVE bar is the model's, in the model's own domain ─────────────
//
// ADDED IN REVIEW, AND THE HOLE IT CLOSES WAS MEASURED, NOT IMAGINED. Everything
// above this point asserts over STRINGS, and the bar draws no text at all. So the
// suite as first written had nothing whatsoever to say about it: replacing
// `{ bipolar: readout.bar.bipolar, ticks: [{ frac: readout.bar.dropTickFrac }],
// pin: readout.bar.commandedFrac }` with `{ bipolar: false, ticks: [{ frac: 0 }],
// pin: 0 }` left all 28 tests green, and DELETING THE `screen.bar(...)` CALL
// ENTIRELY also left all 28 green. Both were run.
//
// That matters more than "one untested element". The bar carries the DROP-CEILING
// TICK — the mark a pilot watches the fill approach to know a drop-out will take —
// and it carries the charter's only answer to "show the throttle", which DrivePanel
// deliberately renders as the commanded pin rather than a number. Neither had a
// single assertion behind it.
//
// ── HOW THIS IS ASSERTED, AND WHY NOT BY READING THE ARGUMENTS ──
//
// A painter is not spied on here; only its DRAWING is recorded. So the check is an
// ORACLE COMPARISON: build a second, independent PhosphorScreen, call `bar()` on it
// with the values `buildFlightReadout` reports, and require the rectangles the panel
// actually drew in the bar's region to be exactly the rectangles the oracle drew.
//
// The oracle is the kit plus the model — never the painter — so this cannot pass by
// agreeing with the painter's own mistake. What it does NOT re-state is the bar's
// position and size: those are DrivePanel's layout, they are not exported, and
// copying 0.33 / 0.07 into this file would make the test fail on every future
// nudge of a number it is not guarding. They are RECOVERED from the panel's own
// drawing instead — see `findBarFrame`.

/**
 * Recover the bar's rectangle from a DRIVE panel's draw log.
 *
 * `PhosphorScreen.bar` frames itself with four fills, of which the top and bottom
 * edges are the only rects in the whole panel that are BOTH the bar's full width
 * AND exactly one hairline tall. Nothing else on the glass has that shape: the
 * clear is the full buffer, the banner's inverted block is the full buffer WIDTH
 * (the bar is inset by a margin either side) and is a text line tall, and the
 * bar's own fill is the inner track height. So those two rects identify the bar
 * without this file being told where it is.
 *
 * Throws rather than returning null if it does not find exactly two. A bar that
 * was never drawn would otherwise make every assertion below vacuous — which is
 * precisely the failure this whole block exists because of.
 */
function findBarFrame(log, screen) {
  const barW = screen.width - screen.type.pad * 2;
  // ⚠ THE FULL-WIDTH TEST BECAME LOad-BEARING ON 2026-07-31, when DRIVE grew a
  // SECOND bar. The throttle bar starts after its `THR` label, so it is narrower
  // than the margins by exactly the label's measured ink plus a gap — which is
  // why this still finds two edges and not four. If the label is ever dropped
  // and the throttle bar goes full width, this helper silently starts returning
  // a frame spanning both bars; the count check below is what would catch it.
  const edges = ops(log, 'fillRect')
    // ⛔ SQUARES ARE GLYPH TEXELS, NOT FRAME EDGES. Since the kit moved onto the bitmap face a
    // letter is drawn as `hair x hair` fillRects, and 'exactly one hairline tall' matched every
    // one of them — 640 of them on a DRIVE panel. A frame edge is a long thin rect and never
    // square, which is the same discriminator `decodePixelText` uses to ignore furniture.
    .filter((r) => r.w !== r.h)
    .filter((r) => Math.abs(r.w - barW) < 1e-9 && Math.abs(r.h - screen.hair) < 1e-9);
  if (edges.length !== 2) {
    throw new Error(
      `expected the bar's two horizontal frame edges in the draw log, found ${edges.length}. ` +
      `A bar that is not drawn at all lands here, and that is the point: without this ` +
      `throw, deleting screen.bar() would leave every assertion below trivially true.`,
    );
  }
  const [top, bottom] = edges.sort((a, b) => a.y - b.y);
  return { x: top.x, y: top.y, w: top.w, h: bottom.y + bottom.h - top.y };
}

/**
 * Every rect the panel drew in the bar's neighbourhood — the frame, the fill, the
 * tick that hangs below it and the pin that sits above it. The kit draws marks up
 * to `hair * 3` outside the frame, so the window is opened by twice that: wide
 * enough to catch every mark, tight enough to exclude the mode line and the banner.
 */
function barRegionRects(log, screen, frame, bounds = {}) {
  const slack = screen.hair * 6;
  const top = frame.y - slack;
  const bottom = frame.y + frame.h + slack;
  return ops(log, 'fillRect')
    // ⛔ SQUARES ARE GLYPH TEXELS, NOT FRAME EDGES. Since the kit moved onto the bitmap face a
    // letter is drawn as `hair x hair` fillRects, and 'exactly one hairline tall' matched every
    // one of them — 640 of them on a DRIVE panel. A frame edge is a long thin rect and never
    // square, which is the same discriminator `decodePixelText` uses to ignore furniture.
    .filter((r) => r.w !== r.h)
    .filter((r) => {
      // The outer window is unchanged and still asks for CONTAINMENT — that is
      // what keeps the full-buffer clear and the full-width banner out.
      if (!(r.y >= top && r.y + r.h <= bottom)) return false;
      // ⭐ THE SPLIT IS DECIDED ON THE RECT'S CENTRE, and that is the whole
      // difference between this guard working and not. A containment test at the
      // split loses any mark that STRADDLES it — and one does: a pin drawn on
      // the throttle bar reaches `hair * 3` above its frame, across the midline,
      // so it was contained in neither region and both oracles agreed with a
      // panel that had drawn an extra mark. Planted and confirmed: it was the
      // one defect of nine that survived the first version of this file.
      //
      // Every mark belongs to exactly one bar, so assigning it by which side its
      // MIDDLE falls on is both total and unambiguous. The speed bar's drop tick
      // hangs down across the same line and lands, correctly, on the speed side.
      const mid = r.y + r.h / 2;
      return mid >= (bounds.notAbove ?? -Infinity) && mid <= (bounds.notBelow ?? Infinity);
    })
    .map((r) => [q(r.x), q(r.y), q(r.w), q(r.h), r.fillStyle]);
}

/**
 * Quantise a coordinate to a nanometre of a pixel, for the comparison above.
 *
 * ⚠ NOT SLOP, AND ADDED FOR A MEASURED REASON (2026-07-31). The frames here are
 * RECOVERED from the draw log — `h` is `bottom.y + bottom.h - top.y` — so the
 * oracle is handed a height that has been through an addition and a subtraction
 * the panel never did. On the throttle bar that round-trip lands on
 * 25.599999999999994 where the panel drew 25.6, and `toEqual` reported a
 * fifteenth-decimal-place difference as a failed assertion about a bar.
 *
 * A defect this comparison exists to catch — a dropped `bipolar`, a fill from
 * the wrong edge, a pin that should not be there — moves ink by PIXELS. Nothing
 * real hides in the ninth decimal place. Rounding there keeps the assertion
 * exact where exactness means something.
 */
function q(v) {
  return Math.round(v * 1e9) / 1e9;
}

/**
 * The THROTTLE bar's rectangle, recovered the same way and by elimination.
 *
 * Added 2026-07-31. `PhosphorScreen.bar` is the only thing on DRIVE that draws a
 * rect exactly one hairline tall, and there are now two bars, so there are
 * exactly four such rects: this one takes the pair that is NOT full width. That
 * is the same trick `findBarFrame` uses, run the other way round, and it means
 * neither helper has to be told a single layout number.
 */
function findThrottleFrame(log, screen) {
  const barW = screen.width - screen.type.pad * 2;
  const candidates = ops(log, 'fillRect')
    // ⛔ SQUARES ARE GLYPH TEXELS, NOT FRAME EDGES. Since the kit moved onto the bitmap face a
    // letter is drawn as `hair x hair` fillRects, and 'exactly one hairline tall' matched every
    // one of them — 640 of them on a DRIVE panel. A frame edge is a long thin rect and never
    // square, which is the same discriminator `decodePixelText` uses to ignore furniture.
    .filter((r) => r.w !== r.h)
    .filter((r) => Math.abs(r.h - screen.hair) < 1e-9 && r.w < barW - 1e-9);

  // ⛔ A HAIRLINE-TALL RECT IS NOT NECESSARILY A FRAME EDGE, and on the grid it stopped being one.
  // `bar()` insets its FILL by `hair * 2` top and bottom, so a bar `5 * hair` tall — which is
  // exactly what a body-sized slot is — has a fill of precisely `hair`. Height alone then matched
  // four rects (two frame edges and two fills) and this helper threw on a panel that was drawn
  // perfectly. The two frame edges are the pair that SHARE AN x AND A WIDTH, and they are the
  // widest such pair, because every fill is inset inside them.
  const byExtent = new Map();
  for (const r of candidates) {
    const key = `${q(r.x)}|${q(r.w)}`;
    byExtent.set(key, [...(byExtent.get(key) ?? []), r]);
  }
  const pairs = [...byExtent.values()].filter((g) => g.length === 2);
  const edges = pairs.sort((a, b) => b[0].w - a[0].w)[0] ?? [];
  if (edges.length !== 2) {
    throw new Error(
      `expected the throttle bar's two horizontal frame edges, found ${candidates.length} ` +
      `hairline-tall rects but no matching pair among them. Deleting the screen.bar() call for ` +
      `the throttle lands here — without this throw the oracle comparison would be trivially ` +
      `true on an empty region.`,
    );
  }
  const [top, bottom] = edges.sort((a, b) => a.y - b.y);
  return { x: top.x, y: top.y, w: top.w, h: bottom.y + bottom.h - top.y };
}

/**
 * The y that separates the two bars' regions.
 *
 * ⚠ WHY A SPLIT IS NEEDED AT ALL, since it is not obvious and it is how this
 * block first went red: `barRegionRects` opens its window `hair * 6` beyond the
 * frame, which is deliberately more than the `hair * 3` a tick or a pin can
 * reach. With one bar that slack was free. With two, the speed bar's window
 * reaches 0.444H and the throttle bar's frame starts at 0.435H — so the speed
 * bar's "region" swallowed the throttle bar's frame edges and every oracle
 * comparison failed against rects the oracle was never asked to draw.
 *
 * Splitting at the midpoint is the honest fix rather than shrinking the slack:
 * shrinking it below `hair * 3` would stop catching the marks the comparison
 * exists to check, and the two windows would still overlap at these distances.
 * Each bar owns the glass down to halfway to its neighbour.
 */
function barSplitY(speedFrame, throttleFrame) {
  return (speedFrame.y + speedFrame.h + throttleFrame.y) / 2;
}

describe('DRIVE — the bar is drawn from the model, in the model\'s own domain', () => {
  /**
   * @param {object} snapshot the frame to paint
   * @param {string} why what regime this case is exercising, for the failure text
   */
  const expectBarMatchesModel = (snapshot, why) => {
    const { log, screen } = paint(paintDrive, snapshot, 0);
    const frame = findBarFrame(log, screen);
    const split = barSplitY(frame, findThrottleFrame(log, screen));
    const model = buildFlightReadout(flightReadoutStateFromSnapshot(snapshot));

    // The oracle: the kit, driven by the model, at the geometry the panel used.
    const oracleCtx = makeRecordingCtx();
    const oracle = new PhosphorScreen(oracleCtx, { width: PANEL_W, height: PANEL_H });
    oracle.bar(frame.x, frame.y, frame.w, frame.h, model.bar.frac, {
      bipolar: model.bar.bipolar,
      ticks: [{ frac: model.bar.dropTickFrac }],
      pin: model.bar.commandedFrac,
    });

    expect(barRegionRects(log, screen, frame, { notBelow: split }), `the ${why} bar is not the model's`)
      .toEqual(barRegionRects(oracleCtx.log, oracle, frame, { notBelow: split }));
  };

  /**
   * The same oracle comparison for the THROTTLE bar. Added 2026-07-31.
   *
   * Bipolar unconditionally, no ticks, no pin — and the `{}` is asserted by
   * being the oracle's whole options object rather than by a comment: a painter
   * that started passing a pin would put ink in the region that the oracle does
   * not have, and this goes red.
   */
  const expectThrottleMatchesModel = (snapshot, why) => {
    const { log, screen } = paint(paintDrive, snapshot, 0);
    const frame = findThrottleFrame(log, screen);
    const split = barSplitY(findBarFrame(log, screen), frame);
    const model = buildFlightReadout(flightReadoutStateFromSnapshot(snapshot));

    const oracleCtx = makeRecordingCtx();
    const oracle = new PhosphorScreen(oracleCtx, { width: PANEL_W, height: PANEL_H });
    oracle.bar(frame.x, frame.y, frame.w, frame.h, model.throttleFrac, { bipolar: true });

    expect(barRegionRects(log, screen, frame, { notAbove: split }), `the ${why} throttle bar is not the model's`)
      .toEqual(barRegionRects(oracleCtx.log, oracle, frame, { notAbove: split }));
  };

  it('matches the model in supercruise — log fill, drop tick, commanded pin', () => {
    // FLYING is driveOn, so the bar is UNIPOLAR: `frac` runs 0..1 from the left on
    // speedToBarFrac's log scale, and the drop tick is a real ceiling.
    expect(FLYING_READOUT.bar.bipolar).toBe(false);
    expect(FLYING_READOUT.bar.dropTickFrac).not.toBeNull();
    expectBarMatchesModel(FLYING, 'supercruise');
  });

  it('matches the model in sublight, where the bar is bipolar and signed', () => {
    // Drive off and reversing. The bar flips to a CENTRE-anchored signed scale, and
    // the failure being caught is a painter that forwards `frac` but drops
    // `bipolar`: -0.5 then clamps to an empty unipolar bar while the number beside
    // it reads REV. The two domains look identical in a draw log until the sign
    // matters, which is why this case exists as well as the one above.
    const reversing = buildCockpitSnapshot({
      scModel: { speed: -0.001, driveOn: false, throttle: -0.5, speedCap: () => 0.01, turnRateCap: () => 0.7 },
      commandedSpeed: -0.0015,
      sublightCap: 0.002,
    });
    expect(buildFlightReadout(flightReadoutStateFromSnapshot(reversing)).bar.bipolar).toBe(true);
    expectBarMatchesModel(reversing, 'sublight');
  });

  it('draws the frame but no tick when there is no drop ceiling to mark', () => {
    // No target, so `dropTickFrac` is null. The kit skips a non-finite tick rather
    // than drawing one at zero — "you must be stopped" is a reading, and an
    // invented one. Asserted as a rect COUNT difference against the same frame with
    // a ceiling, so it cannot pass by the bar having stopped drawing altogether.
    const noTarget = buildCockpitSnapshot({
      scModel: { speed: 0.5 * C_IN_SCENE_PER_S, driveOn: true, throttle: 0.8 },
      commandedSpeed: 0.6 * C_IN_SCENE_PER_S,
    });
    const model = buildFlightReadout(flightReadoutStateFromSnapshot(noTarget));
    expect(model.bar.dropTickFrac).toBeNull();

    const bare = paint(paintDrive, noTarget, 0);
    const bareFrame = findBarFrame(bare.log, bare.screen);
    const withTick = paint(paintDrive, FLYING, 0);
    const tickFrame = findBarFrame(withTick.log, withTick.screen);

    expect(barRegionRects(bare.log, bare.screen, bareFrame).length + 1)
      .toBe(barRegionRects(withTick.log, withTick.screen, tickFrame).length);

    expectBarMatchesModel(noTarget, 'no-target');
  });

  // ── The throttle bar, added 2026-07-31 on Max's UAT call ──
  //
  // Same oracle discipline as the speed bar above, and it exists for the same
  // measured reason: a bar draws no text, so every string assertion in this file
  // is silent about it. The specific thing being guarded is the null — the
  // throttle was kept OFF the glass for two increments because the snapshot
  // wrote `?? 0`, and a bar sitting at a confident dead centre on a frame with
  // no ship is the failure that argument was about.

  it('the throttle bar is the model\'s, forward and reversing', () => {
    // FLYING carries a forward throttle; the reversing fixture a negative one.
    // Both go through the oracle, because a painter that dropped `bipolar: true`
    // would draw -0.5 as an EMPTY unipolar bar — "lever at rest" — while the
    // ship backs up, and no string on the panel would disagree with it.
    expect(FLYING_READOUT.throttleFrac, 'CONTROL: FLYING has a lever position').not.toBeNull();
    expectThrottleMatchesModel(FLYING, 'forward');

    const reversing = buildCockpitSnapshot({
      scModel: { speed: -0.001, driveOn: false, throttle: -0.5, speedCap: () => 0.01, turnRateCap: () => 0.7 },
      commandedSpeed: -0.0015,
      sublightCap: 0.002,
    });
    expect(buildFlightReadout(flightReadoutStateFromSnapshot(reversing)).throttleFrac).toBe(-0.5);
    expectThrottleMatchesModel(reversing, 'reversing');
  });

  it('ALWAYS bipolar — it does not follow the speed bar into the unipolar domain', () => {
    // The bar beside it switches domain on `driveOn` and this one must not. The
    // check is geometric rather than a re-statement of the flag: in a bipolar
    // bar the fill for a positive fraction STARTS at the centre; in a unipolar
    // one it starts at the left inset. A painter that forwarded `bipolar` from
    // `readout.bar` instead of hard-coding true passes every other assertion in
    // this file and fails here, in supercruise, which is the common case.
    const { log, screen } = paint(paintDrive, FLYING, 0);
    const frame = findThrottleFrame(log, screen);
    const split = barSplitY(findBarFrame(log, screen), frame);
    const rects = barRegionRects(log, screen, frame, { notAbove: split });

    const centreX = frame.x + frame.w / 2;
    const inner = rects.filter(([x, , w]) => w > 0 && x > frame.x + 1e-9 && x + w < frame.x + frame.w - 1e-9);
    expect(inner.length, 'expected a fill and the centre zero mark').toBeGreaterThanOrEqual(2);
    expect(
      inner.some(([x]) => Math.abs(x - centreX) < screen.hair),
      'nothing starts at the centre — this bar filled from the left edge, i.e. unipolar',
    ).toBe(true);
  });

  it('AN ABSENT LEVER DRAWS THE FRAME AND NOTHING IN IT — not a zero', () => {
    // ⭐ THE ASSERTION THE WHOLE FIELD EXISTS FOR. EMPTY is a frame with no
    // supercruise model, which the snapshot reports as `throttle: null`. The kit
    // puts BOTH the fill and the centre zero mark inside its `Number.isFinite`
    // branch, so "no reading" and "lever at neutral" are genuinely different
    // pictures — an empty box versus a box with a mark in the middle of it.
    //
    // Asserted against the AT-REST case rather than in isolation, because
    // "drew fewer rects" would also pass if the bar had stopped drawing at all,
    // and because the pair is the thing that has to stay distinguishable.
    expect(buildFlightReadout(flightReadoutStateFromSnapshot(EMPTY)).throttleFrac).toBeNull();

    const absent = paint(paintDrive, EMPTY, 0);
    const absentFrame = findThrottleFrame(absent.log, absent.screen);
    const absentSplit = barSplitY(findBarFrame(absent.log, absent.screen), absentFrame);
    const absentInk = barRegionRects(absent.log, absent.screen, absentFrame, { notAbove: absentSplit });

    const atRest = buildCockpitSnapshot({ scModel: { speed: 0, driveOn: true, throttle: 0 } });
    expect(buildFlightReadout(flightReadoutStateFromSnapshot(atRest)).throttleFrac).toBe(0);
    const rest = paint(paintDrive, atRest, 0);
    const restFrame = findThrottleFrame(rest.log, rest.screen);
    const restSplit = barSplitY(findBarFrame(rest.log, rest.screen), restFrame);
    const restInk = barRegionRects(rest.log, rest.screen, restFrame, { notAbove: restSplit });

    // The frame itself is four rects and is present in both — the instrument is
    // on the glass either way, which is the point of drawing an empty one.
    expect(absentInk.length, 'the absent-lever bar drew no frame at all').toBe(4);
    // …and at rest it has exactly one more: the centre zero mark, no fill.
    expect(restInk.length, 'at rest the zero mark must be there and the fill must not').toBe(5);

    expectThrottleMatchesModel(EMPTY, 'absent-lever');
    expectThrottleMatchesModel(atRest, 'at-rest');
  });
});

// ── 2. One ink ──────────────────────────────────────────────────────────────

describe('all three panels — ONE INK ON BLACK', () => {
  it('sets no colour other than the two Phosphor values', () => {
    const seen = new Set();
    let assignments = 0;

    for (const painter of [paintDrive, paintTarget, paintInfo]) {
      for (const snap of [FLYING, SAFE, EMPTY]) {
        const { log } = paint(painter, snap, 0);
        for (const e of log) {
          if (e.op === 'set' && (e.prop === 'fillStyle' || e.prop === 'strokeStyle')) {
            seen.add(e.value);
            assignments += 1;
          }
        }
      }
    }

    // Vacuity guard first: if the painters stopped drawing — a rename, a throw
    // swallowed somewhere — the set below would be empty and trivially "a subset
    // of the two allowed colours".
    expect(assignments, 'no style was ever set; the painters drew nothing').toBeGreaterThan(20);
    expect([...seen].sort(), `colours outside the palette: ${[...seen].join(', ')}`)
      .toEqual([PHOSPHOR.BACK, PHOSPHOR.INK].sort());
  });

  it('never runs a draw under an unset or foreign colour', () => {
    for (const painter of [paintDrive, paintTarget, paintInfo]) {
      const { log } = paint(painter, FLYING, 0);
      for (const e of [...ops(log, 'fillRect'), ...ops(log, 'fillText')]) {
        expect([PHOSPHOR.INK, PHOSPHOR.BACK], `a ${e.op} ran under fillStyle ${JSON.stringify(e.fillStyle)}`)
          .toContain(e.fillStyle);
      }
    }
  });

  it('carries no colour literal in any painter\'s source', () => {
    // The draw log only sees paths that RAN. This sees the ones that did not —
    // and it is stated as a scan for colour in any spelling, because
    // `colorHex: 0xff7b6b` is the full-screen HUD's red exactly, in the form
    // three.js takes, and contains no '#' and no colour word to trip over.
    for (const file of PANEL_FILES) {
      const code = readFileSync(join(PANEL_DIR, file), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');

      expect(code, `${file} contains a hex colour literal`).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(code, `${file} contains an rgb()/hsl() literal`).not.toMatch(/\b(rgba?|hsla?)\s*\(/);
      expect(code, `${file} contains a 0x colour literal`).not.toMatch(/0x[0-9a-fA-F]{6}/);
      // A painter has no business touching a style at all: every colour the glass
      // ever sees goes through the kit's two private setters.
      expect(code, `${file} sets a canvas style directly`).not.toMatch(/fillStyle|strokeStyle/);
    }
  });
});

// ── 3. No invented state ────────────────────────────────────────────────────

describe('all three panels — no gauge for state the game does not model', () => {
  it('draws no FUEL, HULL, HEAT, CARGO or SHIELD label', () => {
    // There is no fuel, hull, heat, cargo or shield state anywhere in this game,
    // so such a row could only ever display an invented number — and a readout the
    // sim does not back is worse than a blank one, because it invites the pilot to
    // fly by it.
    //
    // Scanned over DRAWN STRINGS, not over source: the cockpit geometry is full of
    // Hull_Nose, HULL_REF_LENGTH and HULL_NAMES, so /hull/i over the source of
    // this subsystem is pure noise and would have to be weakened to pass.
    const forbidden = /fuel|hull|heat|cargo|shield/i;
    for (const painter of [paintDrive, paintTarget, paintInfo]) {
      for (const snap of [FLYING, SAFE, EMPTY]) {
        for (const s of drawn(paint(painter, snap, 0).log)) {
          expect(s, `a panel drew ${JSON.stringify(s)}`).not.toMatch(forbidden);
        }
      }
    }
  });
});

// ── 4. Blank, never stale, never zero ───────────────────────────────────────

describe('all three panels — a frame with nothing in it draws no numbers', () => {
  it('does not throw on an empty snapshot', () => {
    for (const painter of [paintDrive, paintTarget, paintInfo]) {
      expect(() => paint(painter, EMPTY, 0)).not.toThrow();
    }
    // Or on no snapshot at all. PanelHost catches a painter that throws and stops
    // updating that panel for the rest of the session, so a crash here is a screen
    // frozen on a stale image — the exact failure the whole module is against.
    for (const painter of [paintDrive, paintTarget, paintInfo]) {
      expect(() => paint(painter, null, 0)).not.toThrow();
    }
  });

  it('draws exactly the labels and nothing else on an empty frame', () => {
    // Pinned as an EXACT list rather than as "contains no zero", because the
    // interesting failure is a plausible-looking fabricated reading — "0.0 km",
    // "0:00", "0 K", "0 deg/s" — and any of those would slip past a looser check.
    // 'THR' joined the list 2026-07-31. It is a LABEL, not a reading — the bar
    // beside it draws empty on this frame — and that is exactly why it belongs
    // in this assertion: an instrument that is present and blank is the honest
    // picture, and a label that vanished with its reading would be a seventh
    // element appearing and disappearing on the glass.
    // ⚠ THE LIST SHRANK, AND EVERY REMOVAL IS A RULING RATHER THAN A DRIFT. CAP and TURN came off
    // DRIVE (Max, 2026-09-08); the speed's unit moved onto the tier line beside the drive state, so
    // the hero is '0.0' and the line below it is 'SUB km/s'; TARGET's distance lost its label,
    // which is why only 'ETA' remains there; and INFO's labels are the table's three-character
    // `abbr` forms, with the heading row unlabelled by design.
    expect(drawn(paint(paintDrive, EMPTY, 0).log)).toEqual(['0.0', 'SUB km/s', 'THR']);
    expect(drawn(paint(paintTarget, EMPTY, 0).log)).toEqual(['ETA']);
    expect(drawn(paint(paintInfo, EMPTY, 0).log))
      .toEqual(INFO_ROWS.filter((r) => !r.headline).map((r) => r.abbr));
  });

  it('draws exactly one number on an empty frame, and it is the model\'s own', () => {
    // The honest exception, stated rather than hidden: with no drive model the
    // snapshot reports `speed: 0`, and `buildFlightReadout` answers "0.0 km/s".
    // That is the MODEL's answer to "how fast is the ship", and a painter that
    // second-guessed it would be the second source of truth this whole rung
    // exists to avoid. Everything else with no reading behind it draws nothing.
    const numeric = (log) => drawn(log).filter((s) => /\d/.test(s));

    const emptyReadout = buildFlightReadout(flightReadoutStateFromSnapshot(EMPTY));
    expect(numeric(paint(paintDrive, EMPTY, 0).log)).toEqual([emptyReadout.speedValue]);
    expect(numeric(paint(paintTarget, EMPTY, 0).log)).toEqual([]);
    expect(numeric(paint(paintInfo, EMPTY, 0).log)).toEqual([]);
  });

  it('blanks a row rather than zeroing it when one reading is missing', () => {
    // A live drive, a real speed — but no target and no dossier. The rows that
    // have nothing behind them must go blank INDIVIDUALLY, which is a different
    // failure from the whole-panel-empty case above: this is the frame where a
    // formatter handed a null would produce its most convincing lie.
    const noTarget = buildCockpitSnapshot({
      scModel: { speed: 1.0, driveOn: true, throttle: 0.4, speedCap: () => 4000, turnRateCap: () => 0.7 },
      flightMode: 'manual',
    });
    const target = paint(paintTarget, noTarget, 0);
    // The distance line is unlabelled, so "blank" is the absence of the line rather than a label
    // with nothing after it. `formatDistance` returning '' is what makes `text()` draw nothing.
    expect(drawn(target.log).some((t) => /km|Mm|AU/.test(t)),
      'a distance was printed with no target to measure').toBe(false);
    expect(rowValue(target.log, 'ETA')).toBe('');

    // ⭐ AND THE DRIVE'S CEILINGS, WHICH ARE NO LONGER ON THE GLASS, ARE STILL BLANK-NOT-ZERO AT
    // THE FORMATTER. Max cut the rows and kept the code (*"don't get rid of any code that allows
    // you to display what we want to display"*), so the property that made them safe to draw is
    // asserted where it now lives — a null cap is the shape the snapshot writes, not a 0.
    expect(formatSpeedCap(null)).toBe('');
    expect(formatSpeedCap(undefined)).toBe('');
    expect(formatTurnCap(null)).toBe('');
    expect(formatTurnCap(undefined)).toBe('');
  });

  it('formatDistance answers blank, never a zero, for a missing distance', () => {
    for (const bad of [null, undefined, NaN, Infinity, 'far']) {
      expect(formatDistance(bad)).toBe('');
    }
    // A genuine zero distance is a real reading and still prints — the ship IS on
    // top of the body. Blank is reserved for "no reading", which is different.
    expect(formatDistance(0)).toBe('0.0 km');
  });
});

// ── 5. The blink moves ──────────────────────────────────────────────────────

describe('all three panels — a blinking alert actually alternates', () => {
  it('shows and hides the mass-lock banner across one fast cycle', () => {
    // Fast is 300 ms lit / 150 ms dark. Two clock values in opposite phases of the
    // SAME snapshot must produce different glass — a blink that had stopped moving
    // would read as an ordinary line, which is precisely the reading the tier
    // exists to prevent.
    const lit = drawn(paint(paintDrive, FLYING, 0).log);
    const dark = drawn(paint(paintDrive, FLYING, 350).log);

    expect(lit).toContain(briefAlert(ALERT_TEXT.MASS_LOCK));
    expect(dark).not.toContain(briefAlert(ALERT_TEXT.MASS_LOCK));
    expect(lit).not.toEqual(dark);
  });

  it('shows and hides SLOW DOWN across one slow cycle', () => {
    // Slow is 1200 / 600.
    const lit = drawn(paint(paintTarget, FLYING, 0).log);
    const dark = drawn(paint(paintTarget, FLYING, 1500).log);

    expect(lit).toContain(briefAlert(ALERT_TEXT.DROP_SLOW));
    expect(dark).not.toContain(briefAlert(ALERT_TEXT.DROP_SLOW));
    expect(lit).not.toEqual(dark);
  });

  it('phases the blink on the clock it is handed, negatives included', () => {
    // A panel that starts counting from the frame it was created, or a sim
    // resuming from a pause, hands out small negative clock values routinely.
    // JavaScript's % keeps the sign of its left operand, so the naive
    // implementation reads -100 ms as lit when it is in fact 1700 ms into an
    // 1800 ms cycle — the dark phase. The kit gets this right; this asserts the
    // panel really is asking it rather than deciding for itself.
    // -100 ms is 1700 ms into an 1800 ms cycle: DARK. The naive form reads it as
    // -100 < 1200 and lights the banner.
    expect(drawn(paint(paintTarget, FLYING, -100).log)).not.toContain(briefAlert(ALERT_TEXT.DROP_SLOW));
    // -3500 ms is 100 ms into the cycle: lit. Without this the assertion above
    // would also pass on a panel that had gone permanently dark for t < 0.
    expect(drawn(paint(paintTarget, FLYING, -3500).log)).toContain(briefAlert(ALERT_TEXT.DROP_SLOW));
  });

  it('leaves the rest of the panel untouched while an alert blinks', () => {
    // The readings must not flicker with the warning. If the banner were drawn by
    // clearing and repainting selectively, or if the layout stacked relative to
    // it, the speed and the ceilings would move every 300 ms.
    const lit = ops(paint(paintDrive, FLYING, 0).log, 'fillText');
    const dark = ops(paint(paintDrive, FLYING, 350).log, 'fillText');

    // ⚠ THE MODE LINE IS THE ONE THING THAT DOES CHANGE, AND IT IS SUPPOSED TO. A 43-row panel has
    // no room for a seventh element, so the banner TAKES the mode's line rather than being painted
    // over it — an alert outranks a mode readout, and "you are too close" is the thing to know
    // while it is true. Everything ABOVE that line is what must not move, and that is what this
    // compares: the speed, its tier, and both bars, at identical positions in both phases.
    const banner = briefAlert(ALERT_TEXT.MASS_LOCK);
    const modeLine = shortMode(FLYING_READOUT.modeLine);
    const above = (entries) => entries
      .filter((e) => e.text !== banner && e.text !== modeLine)
      .map((e) => [e.text, e.x, e.y]);
    expect(above(lit)).toEqual(above(dark));
    // And the exchange is exactly one for one, so neither can quietly go missing.
    expect(drawn(paint(paintDrive, FLYING, 0).log)).toContain(banner);
    expect(drawn(paint(paintDrive, FLYING, 0).log)).not.toContain(modeLine);
    expect(drawn(paint(paintDrive, FLYING, 350).log)).toContain(modeLine);
    expect(drawn(paint(paintDrive, FLYING, 350).log)).not.toContain(banner);
  });
});

// ── 6. Legibility ───────────────────────────────────────────────────────────

describe('all three panels — nothing is drawn below the legibility floor', () => {
  it('draws every glyph at or above H/24', () => {
    const floor = PANEL_H / MIN_TEXT_DIVISOR;
    let checked = 0;

    for (const painter of [paintDrive, paintTarget, paintInfo]) {
      for (const snap of [FLYING, SAFE, EMPTY]) {
        for (const e of ops(paint(painter, snap, 0).log, 'fillText')) {
          const size = sizeOf(e);
          expect(
            size,
            `${JSON.stringify(e.text)} was drawn at ${size}px in a ${PANEL_H}px buffer — about ` +
            `${(size / PANEL_H * 260).toFixed(1)} screen pixels at the panel's real angular size, ` +
            `against a floor of about 11`,
          ).toBeGreaterThanOrEqual(floor - 1e-9);
          checked += 1;
        }
      }
    }

    // Vacuity guard: a suite that measured nothing passes this trivially.
    expect(checked, 'no text was measured; the painters drew nothing').toBeGreaterThan(20);
  });

  it('keeps the panels sparse enough to read at 17 degrees', () => {
    // A panel is about 260 screen pixels tall. The failure this guards against is
    // not a wrong number, it is a correct one nobody can read because eleven other
    // correct ones are stacked around it. INFO's seven dossier rows are the agreed
    // budget and the type scale was chosen against them; DRIVE and TARGET are
    // deliberately sparser than that.
    const lines = (painter) => new Set(ops(paint(painter, FLYING, 0).log, 'fillText').map((e) => e.y)).size;
    expect(lines(paintDrive)).toBeLessThanOrEqual(7);
    expect(lines(paintTarget)).toBeLessThanOrEqual(5);
    expect(lines(paintInfo)).toBe(INFO_ROWS.length);
  });
});

// ── 7. Housekeeping the host relies on ──────────────────────────────────────

/**
 * ── ⛔ THE GUARD THAT SHOULD HAVE EXISTED BEFORE THE REDESIGN ──────────────────────────────────
 *
 * Two collisions shipped into this workstream and neither was visible in a spec:
 *
 *   1. TARGET drew `row('DIST', '0.25 AU')` — a 3-character label and an 8-character value on a
 *      9-character panel — and the value's first glyph landed ON the label's last. The result was
 *      not a clipped row but a smear of half-glyphs.
 *   2. DRIVE dropped the speed bar into a six-row grid slot, and `bar()` draws its pin two
 *      hairlines ABOVE the frame and its tick two BELOW. The pin overlapped the tier line and the
 *      tick overlapped the throttle frame.
 *
 * Both were found by accident, from tofu the decoder returned that no assertion had asked about.
 * ⭐ THE PROPERTY IS CHEAP AND TOTAL, so it is asserted directly and at every shipped resolution:
 * nothing a painter draws may leave the glass, and no two strings may share a texel. A layout
 * cannot collide and stay green.
 */
describe('all three panels — nothing overlaps and nothing leaves the glass', () => {
  // The upper pair (NAV, DRIVE) and the lower pair (INFO, TARGET) at 240p, 480p and 720p, projected
  // from `cockpit-metrics.json` through the 70-degree camera. See `chrome-240p-BATCH-PLANS.md` §0.5.
  // ⛔ EACH PAINTER ON THE PAIR IT ACTUALLY LIVES ON, not on both. `PanelLayout.js:53-56` puts
  // DRIVE on `Screen_UR` (upper, 8 characters) and INFO/TARGET on `Screen_LL`/`Screen_LR` (lower,
  // 9). Painting TARGET onto an upper panel fails this guard truthfully — "SLOW DOWN" is nine
  // characters — but it fails about a configuration the game does not have, and a test that
  // reports a defect in a frame nobody renders is a test that gets muted.
  const UPPER = [['upper 240p', 51, 43], ['upper 480p', 103, 86], ['upper 720p', 155, 129]];
  const LOWER = [['lower 240p', 55, 46], ['lower 480p', 110, 92], ['lower 720p', 166, 138]];
  const SHIPPED = [
    ...UPPER.map((p) => [...p, [[paintDrive, 'DRIVE']]]),
    ...LOWER.map((p) => [...p, [[paintTarget, 'TARGET'], [paintInfo, 'INFO']]]),
  ];

  const boxes = (log) => ops(log, 'fillText').map((e) => ({
    text: e.text, x: e.x, y: e.y - e.size, w: measurePixelText(e.text, e.size / FACE.h), h: e.size,
  }));
  const hits = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

  for (const [name, W, H, painters] of SHIPPED) {
    it(`keeps every panel inside a ${name} buffer, with no two strings on one texel`, () => {
      for (const [painter, label] of painters) {
        const ctx = makeRecordingCtx();
        const screen = new PhosphorScreen(ctx, { width: W, height: H });
        painter(screen, FLYING, 0);

        // ⚠ NON-VACUITY FIRST. A painter that drew nothing would satisfy every assertion below,
        // and at a small buffer "drew nothing" is a plausible failure rather than a silly one.
        const drawnBoxes = boxes(ctx.log);
        expect(drawnBoxes.length, `${label} drew no text at all on a ${name} panel`)
          .toBeGreaterThan(0);

        for (const b of drawnBoxes) {
          expect(b.x >= 0 && b.y >= 0 && b.x + b.w <= W && b.y + b.h <= H,
            `${label} drew "${b.text}" at (${b.x}, ${b.y}) ${b.w}x${b.h}, outside a ${W}x${H} ` +
            `panel. Type that runs off the glass is not clipped by anything — it simply is not ` +
            `there, and the panel reads as a shorter word.`).toBe(true);
        }
        for (let i = 0; i < drawnBoxes.length; i++) {
          for (let j = i + 1; j < drawnBoxes.length; j++) {
            expect(hits(drawnBoxes[i], drawnBoxes[j]),
              `${label} drew "${drawnBoxes[i].text}" and "${drawnBoxes[j].text}" on top of each ` +
              `other on a ${name} panel. Overlapping glyphs do not read as either string; they ` +
              `read as a smear, which is how the DIST row shipped broken.`).toBe(false);
          }
        }

        // ⭐ AND NOTHING DECODED AS TOFU. A replacement character means the decoder could not read
        // a cell back, which on a panel whose every glyph came from the shipped face means two
        // runs are interfering — the symptom that exposed both collisions above.
        for (const b of drawnBoxes) {
          expect(b.text.includes('\uFFFD'),
            `${label} put an unreadable cell on a ${name} panel: ${JSON.stringify(b.text)}`)
            .toBe(false);
        }
      }
    });
  }

  it('fits every panel inside the row budget the kit reports', () => {
    // The kit answers `lines` and `colsAt`; a painter that ignores either walks off the glass at
    // some resolution and not at others, which is the hardest kind of layout bug to reproduce.
    for (const [name, W, H] of SHIPPED) {
      const screen = new PhosphorScreen(makeRecordingCtx(), { width: W, height: H });
      expect(screen.type.lines, `${name} stopped holding seven lines`).toBeGreaterThanOrEqual(7);
      expect(screen.colsAt(), `${name} holds too few characters for a 3+5 row`)
        .toBeGreaterThanOrEqual(8);
    }
  });
});

describe('all three panels — each clears its own glass', () => {
  it('paints the buffer black before drawing anything', () => {
    // PanelHost deliberately does NOT clear before calling a painter: clearing
    // would mean the host choosing a background colour, and the Phosphor palette
    // is a taste knob with several settings. So it is the painter's job, and a
    // painter that skipped it would overprint itself into an unreadable smear
    // within a second at 12.5 Hz.
    for (const painter of [paintDrive, paintTarget, paintInfo]) {
      const { log } = paint(painter, FLYING, 0);
      const clears = fullClears(log);
      expect(clears.length).toBeGreaterThanOrEqual(1);
      // ⚠ THE "FIRST DRAW" IS A `fillRect` NOW, NOT A `fillText`. Since the kit moved onto the
      // bitmap face nothing calls fillText at all, so `findIndex(op === 'fillText')` returned -1
      // and this assertion read "0 < -1" — it could not pass, and had it been written the other
      // way round it could not have FAILED. The first ink is the first rect that is not the clear.
      const firstInk = log.findIndex((e) => e.op === 'fillRect' && !clears.includes(e));
      expect(firstInk, 'the painter drew nothing at all').toBeGreaterThan(-1);
      expect(log.indexOf(clears[0])).toBeLessThan(firstInk);
    }
  });
});
