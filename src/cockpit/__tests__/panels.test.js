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
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { buildCockpitSnapshot } from '../CockpitSnapshot.js';
import { PhosphorScreen, PHOSPHOR } from '../PhosphorScreen.js';
import { buildFlightReadout, flightReadoutStateFromSnapshot } from '../FlightReadout.js';
import { buildInfoRows, INFO_ROWS } from '../InfoReadout.js';
import { ALERT_TEXT } from '../../ui/AlertCue.js';
import { formatSpeed, C_IN_SCENE_PER_S } from '../../ui/SpeedFormat.js';

import { paintDrive } from '../panels/DrivePanel.js';
import { paintTarget, formatDistance } from '../panels/TargetPanel.js';
import { paintInfo } from '../panels/InfoPanel.js';

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

const ops = (log, op) => log.filter((e) => e.op === op);
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
  it('draws the speed, the ceilings, the mode line and the mass-lock banner', () => {
    const { log } = paint(paintDrive, FLYING, 0);
    const texts = drawn(log);

    // Against the MODEL: a painter that recomputes the speed — drops the REV
    // prefix, picks its own tier, rounds differently — diverges here even if it
    // looks plausible on its own.
    expect(texts).toContain(FLYING_READOUT.speedText);
    // And against a LITERAL, so a builder that silently changed its answer cannot
    // drag this test along with it.
    expect(FLYING_READOUT.speedText).toBe('0.50 c');

    // The two ceilings. CAP goes through the game's one speed formatter, so it is
    // checked against that formatter's own output as well as against the literal.
    const cap = formatSpeed(4000);
    expect(rowValue(log, 'CAP')).toBe(`${cap.value} ${cap.unit}`);
    expect(rowValue(log, 'CAP')).toBe('1,996 c');
    // 0.7 rad/s is 40.1 deg/s. Whole degrees: a decimal place is unreadable at
    // this angular size and tells the pilot nothing they can act on.
    expect(rowValue(log, 'TURN')).toBe('40 deg/s');

    // The mode line arrives already prefixed and uppercased by the model.
    expect(texts).toContain(FLYING_READOUT.modeLine);
    expect(FLYING_READOUT.modeLine).toBe('MODE: MANUAL');

    // The drive's own warning, in the HUD's exact words (em dash included).
    expect(texts).toContain(ALERT_TEXT.MASS_LOCK);
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
    expect(drawn(paint(paintDrive, reversing, 0).log)).toContain(model.speedText);
    expect(model.speedText).toBe('REV 150 km/s');
  });

  it('says nothing about the drive being on — the absence of SUBLIGHT is the statement', () => {
    const flying = drawn(paint(paintDrive, FLYING, 0).log);
    expect(flying).not.toContain('SUBLIGHT');

    // Drive off: the tag appears. The model keys this on `driveOn === false`
    // strictly, so a frame that merely forgot the field must not claim the ship
    // dropped out of supercruise.
    const off = buildCockpitSnapshot({
      scModel: { speed: 0.001, driveOn: false, throttle: 0.5, speedCap: () => 0.01, turnRateCap: () => 0.7 },
      sublightCap: 0.002,
    });
    expect(drawn(paint(paintDrive, off, 0).log)).toContain('SUBLIGHT');
  });

  it('draws the speed as the largest thing on the panel', () => {
    // "Speed is the hero" is the one layout rule this panel exists to serve, and
    // it is the first casualty of adding rows: the natural fix for a crowded panel
    // is to shrink the number nobody is supposed to have to look for.
    const { log } = paint(paintDrive, FLYING, 0);
    expectStrictlyBiggest(log, FLYING_READOUT.speedText);
  });
});

describe('TARGET — name, distance, ETA and the approach cue', () => {
  it('draws the selected body\'s name, its distance and the model\'s ETA', () => {
    const { log } = paint(paintTarget, FLYING, 0);
    const texts = drawn(log);

    expect(texts).toContain('Veskol b');

    // 250 scene units is a quarter of an AU (ScaleConstants: 1 AU = 1000 u).
    expect(rowValue(log, 'DIST')).toBe('0.25 AU');
    expect(rowValue(log, 'DIST')).toBe(formatDistance(250));

    // The ETA is the model's string, not a second division of distance by speed.
    expect(rowValue(log, 'ETA')).toBe(FLYING_READOUT.eta);
    expect(FLYING_READOUT.eta).toBe('4:09');

    // Too fast to drop → SLOW DOWN, in the HUD's words.
    expect(texts).toContain(ALERT_TEXT.DROP_SLOW);
    expect(texts).not.toContain(ALERT_TEXT.DROP_SAFE);
  });

  it('draws the target name as the largest thing on the panel when it fits', () => {
    expectStrictlyBiggest(paint(paintTarget, FLYING, 0).log, 'Veskol b');
  });

  it('drops the name one size — never below body size — rather than clip a long one', () => {
    // A real procedural designation: NameGenerator embeds ~70 bits of position
    // injectively, so 14-20 characters is ordinary and a planet suffix adds more.
    // This is the COMMON case, not an edge one.
    const long = buildCockpitSnapshot({
      selectedTarget: { kind: 'planet', name: 'PVX J4K7Q2M+9XP3RWZ b' },
      targetDistance: 250,
    });
    const { log, screen } = paint(paintTarget, long, 0);

    const nameDraws = ops(log, 'fillText').filter((e) => e.text === 'PVX J4K7Q2M+9XP3RWZ b');
    // Drawn twice: once as the probe at display size, once for real one size down.
    expect(nameDraws.length).toBe(2);
    expect(sizeOf(nameDraws[0])).toBeCloseTo(screen.type.display, 6);
    expect(sizeOf(nameDraws[1])).toBeCloseTo(screen.type.body, 6);

    // And the probe was WIPED, not left underneath. Two full clears, the second
    // after the first name draw — otherwise the hero is two overlapping strings.
    const clears = fullClears(log);
    expect(clears.length).toBe(2);
    expect(log.indexOf(clears[1])).toBeGreaterThan(log.indexOf(nameDraws[0]));

    // A short name takes the single-clear path.
    expect(fullClears(paint(paintTarget, FLYING, 0).log).length).toBe(1);

    // HONEST LIMIT: the stub's advance width is a made-up 0.6 em, so what is
    // proved here is that the DECISION works and wipes correctly — not that this
    // particular name fits on real glass. Only the platform's monospace face
    // knows that, and only Max's eye can confirm it.
  });

  it('keeps a STEADY cue lit at every phase of the clock', () => {
    // SAFE TO DROP is reassurance. A reassurance that flashes reads as an alarm,
    // and on a one-ink panel movement is the ONLY urgency channel left — so a
    // steady tier that quietly started blinking would be saying the opposite of
    // what it means.
    for (const t of [0, 400, 900, 1500, 2000]) {
      expect(drawn(paint(paintTarget, SAFE, t).log)).toContain(ALERT_TEXT.DROP_SAFE);
    }
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
    expect(drawn(paint(paintTarget, WARP_PICKED, 0).log)).toContain('PVX J4K7Q2M+9XP3RWZ');
  });

  it('labels it, so a destination cannot be misread as the body under the reticle', () => {
    // The two states occupy the same hero slot and mean opposite things — one is
    // what a burn will hit, the other is what a warp will leave for. NavComputer
    // already calls it WARP TARGET on its own prism view (NavComputer.js:1860);
    // the same words here mean the glass agrees with itself.
    const texts = drawn(paint(paintTarget, WARP_PICKED, 0).log);
    expect(texts).toContain('WARP TARGET');
    // And the label is absent when there is a body instead — otherwise it is
    // decoration rather than a discriminator.
    expect(drawn(paint(paintTarget, FLYING, 0).log)).not.toContain('WARP TARGET');
  });

  it('draws the label after the hero, so an overflowing name cannot wipe it', () => {
    // ⚠ THIS TEST EXISTS BECAUSE THE OBVIOUS ONE CANNOT FAIL, MEASURED NOT
    // IMAGINED. `WARP_PICKED`'s designation overflows at display size, so
    // `drawHeroName` takes its re-clear path; a label painted BEFORE that clear
    // is gone from the glass. But `drawn()` reads the fillText LOG, not pixels,
    // and a later `clear()` removes nothing from a log — so with the label moved
    // above `drawHeroName`, every other assertion in this block stayed green.
    // ORDER against the second clear is the only thing that discriminates.
    const { log } = paint(paintTarget, WARP_PICKED, 0);

    const clears = fullClears(log);
    expect(clears.length, 'the fixture no longer overflows; this test proves nothing').toBe(2);

    const label = ops(log, 'fillText').find((e) => e.text === 'WARP TARGET');
    expect(label, 'the label was never drawn').toBeTruthy();
    expect(log.indexOf(label)).toBeGreaterThan(log.indexOf(clears[1]));
  });

  it('leaves DIST and ETA blank for a destination that has no in-system range', () => {
    // The load-bearing half of "blank, never zero". A warp destination is a star
    // in the galaxy, not a body in this system: `target.distance` is null and the
    // ETA model has nothing to divide. A painter that reached for the drive's
    // numbers here would print a confident reading of the wrong thing.
    const { log } = paint(paintTarget, WARP_PICKED, 0);
    expect(rowValue(log, 'DIST')).toBe('');
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
    const texts = drawn(paint(paintTarget, both, 0).log);
    expect(texts).toContain('Veskol b');
    expect(texts).not.toContain('PVX J4K7Q2M+9XP3RWZ');
    expect(texts).not.toContain('WARP TARGET');
  });
});

describe('INFO — the dossier, straight off the table', () => {
  it('draws every row of buildInfoRows, in order, label and value verbatim', () => {
    const { log } = paint(paintInfo, FLYING, 0);
    const rows = buildInfoRows(FLYING);

    for (const row of rows) {
      expect(drawn(log)).toContain(row.label);
      expect(rowValue(log, row.label)).toBe(row.value);
    }

    // The order is the table's order, top to bottom on the glass.
    const labelsInDrawOrder = ops(log, 'fillText')
      .filter((e) => rows.some((r) => r.label === e.text))
      .map((e) => e.text);
    expect(labelsInDrawOrder).toEqual(rows.map((r) => r.label));
    const ys = ops(log, 'fillText')
      .filter((e) => rows.some((r) => r.label === e.text))
      .map((e) => e.y);
    expect([...ys].sort((a, b) => a - b)).toEqual(ys);

    // And the literals, so a table that silently changed shape is visible here
    // rather than being agreed with.
    expect(rowValue(log, 'BODY')).toBe('Veskol b');
    expect(rowValue(log, 'T_EQ')).toBe('374 K');
    expect(rowValue(log, 'COMP')).toBe('silicate Fe0.31');
    expect(rowValue(log, 'ATMO')).toBe('co2-n2 0.85 bar');
    expect(rowValue(log, 'TIDAL')).toBe('free');
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

    expect(drawn(log)).toContain('T_EQ');
    expect(rowValue(log, 'T_EQ')).toBe('');
    expect(rowValue(log, 'TIDAL')).toBe('synchronous');

    // Every row still drew, blank or not. A row that vanished with its value
    // would make every row beneath it jump up the glass — and a pilot glancing at
    // a readout whose lines have moved reads the wrong one.
    const labels = ops(log, 'fillText').filter((e) => INFO_ROWS.some((r) => r.label === e.text));
    expect(labels.length).toBe(INFO_ROWS.length);

    // And at exactly the same baselines as a frame with every value present.
    const full = paint(paintInfo, FLYING, 0).log;
    const yOf = (l, label) => ops(l, 'fillText').find((e) => e.text === label).y;
    for (const r of INFO_ROWS) expect(yOf(log, r.label)).toBe(yOf(full, r.label));
  });

  it('names no field of its own — the table is the only place fields are listed', () => {
    // The deliverable Max asked for is the PIPELINE: "we can expand/adjust the
    // systems generating that info in the future". That property dies the moment
    // the painter knows a field name, because then adding a row is two edits in
    // two files — which is the shape of change that does not get made.
    const code = readFileSync(join(PANEL_DIR, 'InfoPanel.js'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');

    for (const label of INFO_ROWS.map((r) => r.label)) {
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
  const edges = ops(log, 'fillRect')
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
function barRegionRects(log, screen, frame) {
  const slack = screen.hair * 6;
  return ops(log, 'fillRect')
    .filter((r) => r.y >= frame.y - slack && r.y + r.h <= frame.y + frame.h + slack)
    .map((r) => [r.x, r.y, r.w, r.h, r.fillStyle]);
}

describe('DRIVE — the bar is drawn from the model, in the model\'s own domain', () => {
  /**
   * @param {object} snapshot the frame to paint
   * @param {string} why what regime this case is exercising, for the failure text
   */
  const expectBarMatchesModel = (snapshot, why) => {
    const { log, screen } = paint(paintDrive, snapshot, 0);
    const frame = findBarFrame(log, screen);
    const model = buildFlightReadout(flightReadoutStateFromSnapshot(snapshot));

    // The oracle: the kit, driven by the model, at the geometry the panel used.
    const oracleCtx = makeRecordingCtx();
    const oracle = new PhosphorScreen(oracleCtx, { width: PANEL_W, height: PANEL_H });
    oracle.bar(frame.x, frame.y, frame.w, frame.h, model.bar.frac, {
      bipolar: model.bar.bipolar,
      ticks: [{ frac: model.bar.dropTickFrac }],
      pin: model.bar.commandedFrac,
    });

    expect(barRegionRects(log, screen, frame), `the ${why} bar is not the model's`)
      .toEqual(barRegionRects(oracleCtx.log, oracle, frame));
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
    expect(drawn(paint(paintDrive, EMPTY, 0).log)).toEqual(['0.0 km/s', 'SUBLIGHT', 'CAP', 'TURN']);
    expect(drawn(paint(paintTarget, EMPTY, 0).log)).toEqual(['DIST', 'ETA']);
    expect(drawn(paint(paintInfo, EMPTY, 0).log)).toEqual(INFO_ROWS.map((r) => r.label));
  });

  it('draws exactly one number on an empty frame, and it is the model\'s own', () => {
    // The honest exception, stated rather than hidden: with no drive model the
    // snapshot reports `speed: 0`, and `buildFlightReadout` answers "0.0 km/s".
    // That is the MODEL's answer to "how fast is the ship", and a painter that
    // second-guessed it would be the second source of truth this whole rung
    // exists to avoid. Everything else with no reading behind it draws nothing.
    const numeric = (log) => drawn(log).filter((s) => /\d/.test(s));

    const emptyReadout = buildFlightReadout(flightReadoutStateFromSnapshot(EMPTY));
    expect(numeric(paint(paintDrive, EMPTY, 0).log)).toEqual([emptyReadout.speedText]);
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
    expect(rowValue(target.log, 'DIST')).toBe('');
    expect(rowValue(target.log, 'ETA')).toBe('');

    // And the same drive frame with the cap accessors gone — the shape the
    // snapshot writes as null, not as 0.
    const noCaps = buildCockpitSnapshot({ scModel: { speed: 1.0, driveOn: true, throttle: 0.4 } });
    const drive = paint(paintDrive, noCaps, 0);
    expect(rowValue(drive.log, 'CAP')).toBe('');
    expect(rowValue(drive.log, 'TURN')).toBe('');
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

    expect(lit).toContain(ALERT_TEXT.MASS_LOCK);
    expect(dark).not.toContain(ALERT_TEXT.MASS_LOCK);
    expect(lit).not.toEqual(dark);
  });

  it('shows and hides SLOW DOWN across one slow cycle', () => {
    // Slow is 1200 / 600.
    const lit = drawn(paint(paintTarget, FLYING, 0).log);
    const dark = drawn(paint(paintTarget, FLYING, 1500).log);

    expect(lit).toContain(ALERT_TEXT.DROP_SLOW);
    expect(dark).not.toContain(ALERT_TEXT.DROP_SLOW);
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
    expect(drawn(paint(paintTarget, FLYING, -100).log)).not.toContain(ALERT_TEXT.DROP_SLOW);
    // -3500 ms is 100 ms into the cycle: lit. Without this the assertion above
    // would also pass on a panel that had gone permanently dark for t < 0.
    expect(drawn(paint(paintTarget, FLYING, -3500).log)).toContain(ALERT_TEXT.DROP_SLOW);
  });

  it('leaves the rest of the panel untouched while an alert blinks', () => {
    // The readings must not flicker with the warning. If the banner were drawn by
    // clearing and repainting selectively, or if the layout stacked relative to
    // it, the speed and the ceilings would move every 300 ms.
    const lit = ops(paint(paintDrive, FLYING, 0).log, 'fillText');
    const dark = ops(paint(paintDrive, FLYING, 350).log, 'fillText');

    const withoutBanner = (entries) => entries.filter((e) => e.text !== ALERT_TEXT.MASS_LOCK);
    expect(withoutBanner(lit).map((e) => [e.text, e.x, e.y]))
      .toEqual(withoutBanner(dark).map((e) => [e.text, e.x, e.y]));
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

describe('all three panels — each clears its own glass', () => {
  it('paints the buffer black before drawing anything', () => {
    // PanelHost deliberately does NOT clear before calling a painter: clearing
    // would mean the host choosing a background colour, and the Phosphor palette
    // is a taste knob with several settings. So it is the painter's job, and a
    // painter that skipped it would overprint itself into an unreadable smear
    // within a second at 12.5 Hz.
    for (const painter of [paintDrive, paintTarget, paintInfo]) {
      const { log } = paint(painter, FLYING, 0);
      expect(fullClears(log).length).toBeGreaterThanOrEqual(1);
      expect(log.indexOf(fullClears(log)[0])).toBeLessThan(log.findIndex((e) => e.op === 'fillText'));
    }
  });
});
