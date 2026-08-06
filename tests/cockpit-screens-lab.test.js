/**
 * cockpit-screens-lab — tests for the screens lab's two support modules.
 *
 * Lane F, workstream `cockpit-screen-content-2026-07-28`.
 *
 * WHAT IS UNDER TEST. `cockpit-screens-lab.html` cannot be exercised here — this
 * repo's vitest runs in plain node with no jsdom, no happy-dom and no canvas —
 * so the page was written thin and everything with a decision in it was pushed
 * into two importable modules:
 *
 *   cockpit-screens-lab-flight.js   the scripted flight: a pure function from a
 *                                   time to one frame's game state
 *   cockpit-screens-lab-panels.js   the adapter that mounts the SHIPPED painters
 *                                   on a PanelHost panel, plus the NAV holding
 *                                   card, which has no shipped painter
 *
 * ── HOW THIS FILE DIFFERS FROM src/cockpit/__tests__/panels.test.js ────────
 *
 * That file unit-tests each painter against snapshots written to order. This one
 * is the INTEGRATION: it generates real star systems, runs the real script over
 * them, and drives the real painters through every frame of the resulting
 * flight. The two catch different things. A unit test proves a painter handles
 * the case it was handed; this proves the cases actually OCCUR, in the order a
 * pilot would meet them, and that nothing anywhere in the chain — generator,
 * snapshot, readout builder, painter, drawing kit — puts a second colour on the
 * glass or loses a warning along the way.
 *
 * So the assertions here are deliberately about the SEAM and not about layout.
 * Where a panel puts its rows is its own file's business and its own file's
 * test; whether the string the readout built arrives on the glass unaltered is
 * this file's.
 *
 * ── WHAT A GREEN RUN DOES NOT MEAN ────────────────────────────────────────
 *
 * It does not mean the panels LOOK right. There are no pixels in this
 * environment. Whether the speed reads at seventeen degrees of arc, whether the
 * inverted banner reads as alarming, whether the balance of a panel is any good
 * — that is Max's eye, on the glass, in the lab. This file only guarantees that
 * what reaches his eye is the truth about the ship.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as THREE from 'three';

import { parseGLB, listNodes, nodeWorldPositions, nodeWorldUvs } from './helpers/glb-parse.mjs';

import {
  FLIGHT_DURATION_S, FLIGHT_SEGMENTS, buildLabWorld, dropWindowFor,
  flightSourcesAt, segmentAt, labPhysicsForPlanet,
} from '../cockpit-screens-lab-flight.js';
import {
  LAB_PAINTERS, SCREEN_PAINTERS, NAV_HOLDING_TEXT, labNavPainter,
} from '../cockpit-screens-lab-panels.js';
// The bridge is SHIPPED code, not lab code — imported from src for the same
// reason the painters are. Its own guarantees (the per-panel kit cache and its
// invalidation, the size coming off the canvas) are pinned in
// src/cockpit/__tests__/panelPainter.test.js; what belongs here is only that the
// lab really mounts THAT bridge rather than a private copy of it.
import { panelPainter } from '../src/cockpit/panelPainter.js';

import { buildCockpitSnapshot } from '../src/cockpit/CockpitSnapshot.js';
import { buildFlightReadout, flightReadoutStateFromSnapshot } from '../src/cockpit/FlightReadout.js';
import { buildInfoRows, INFO_ROWS } from '../src/cockpit/InfoReadout.js';
import { ALERT_TEXT, BLINK } from '../src/ui/AlertCue.js';
import { PHOSPHOR, BLINK_MS, blinkOn } from '../src/cockpit/PhosphorScreen.js';
import { formatSpeed } from '../src/ui/SpeedFormat.js';
import { PanelHost, derivePanelBuffer, DEFAULT_PANEL_BUFFER_HEIGHT_PX } from '../src/cockpit/PanelHost.js';
import { DEFAULT_PANEL_ROLES, SCREEN_NODE_RE } from '../src/cockpit/PanelLayout.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ASSET_DIR = join(HERE, '..', 'public', 'assets', 'cockpit');

/**
 * Is this file disabling any of its own tests?
 *
 * WHY THIS SITS AT MODULE SCOPE AND THROWS, rather than living only inside an
 * `it()`. Measured on a sibling lane-F file: putting `it.only` on one test made
 * vitest report "1 passed | 6 skipped" and exit GREEN — because the self-scan
 * was one of the six it skipped. A guard that only runs as a test cannot see a
 * helper that stops it running. Module scope executes during COLLECTION, before
 * the runner can honour any `.only`, so this fires whatever the helpers say.
 *
 * Comments are stripped first: the prose above names the helpers, and the
 * pattern is assembled from fragments so a literal one cannot match itself.
 * Either would fail a file that is in fact clean. The check is about code.
 *
 * The `it()` further down is kept anyway, so the guarantee still appears by name
 * in the test report rather than being an invisible side effect of importing.
 */
const SELF_CODE = readFileSync(join(HERE, 'cockpit-screens-lab.test.js'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');
const DISABLED_RE = new RegExp(
  ['describe', 'it', 'test'].flatMap((k) => [k + '\\.skip', k + '\\.only']).join('|'),
);
const SELF_DISABLES_TESTS = DISABLED_RE.test(SELF_CODE);
if (SELF_DISABLES_TESTS) {
  throw new Error(
    'cockpit-screens-lab.test.js disables one of its own tests (a skip or focus helper is ' +
    'present in its code). This file is the only check that the lab shows Max the truth about ' +
    'the ship, so a disabled test here reads as "the demo is honest" when nothing was measured ' +
    'at all. Remove the helper.',
  );
}

// ── The worlds under test ───────────────────────────────────────────────────

/**
 * Several seeds, not one.
 *
 * The close-approach phases are written as MULTIPLES of the capture sphere and
 * the drop ceiling, both of which come from the target body's radius — and that
 * radius varies by more than an order of magnitude across generated worlds
 * (measured 0.020 to 0.398 scene units across these five). A script written
 * against absolute distances would enter the drop window on the seed it was
 * tuned against and on no other, so every drop-state assertion below runs over
 * all of them. Two of these land under `DROP_MAX_SPEED_FLOOR` and three above
 * it, which exercises both branches of the ceiling.
 *
 * The positions differ because the naming generator derives a system's
 * designation from where it sits; identical positions give identically-named
 * systems and the name assertions would be comparing a constant to itself.
 */
const SEEDS = Object.freeze([
  ['well-dipper-lane-F', { x: 1420.5, y: -88.25, z: 3311.75 }],
  ['test-alpha', { x: -900.25, y: 12.5, z: 640.0 }],
  ['Aletheia', { x: 4110.0, y: -220.75, z: -1503.25 }],
  ['Sol', { x: 0, y: 0, z: 0 }],
  ['phosphor', { x: 77.5, y: 640.25, z: -2200.0 }],
]);

const worlds = SEEDS.map(([seed, pos]) => buildLabWorld(seed, pos));
const world = worlds[0];

/** Walk the whole loop at this step. 0.25 s is finer than any phase boundary. */
const STEP_S = 0.25;

/** Every frame of one loop, as snapshots, for a given world. */
function walk(w = world) {
  const out = [];
  for (let t = 0; t < FLIGHT_DURATION_S; t += STEP_S) {
    out.push({ t, snapshot: buildCockpitSnapshot(flightSourcesAt(t, w)) });
  }
  return out;
}

const frames = walk();

// ── A Canvas2D-shaped recorder ─────────────────────────────────────────────

/**
 * The stand-in context the painters draw into.
 *
 * It records rather than rasterises, which is what makes "the panel drew exactly
 * the readout's string" an assertion instead of a screenshot. Three things it
 * must get right or every test below is theatre:
 *
 *  1. `measureText` MUST depend on the current font. `PhosphorScreen` sets the
 *     font, measures, then derives every centred and right-aligned x from that
 *     width — so a recorder returning a constant width would let a genuine
 *     measure-before-you-set-the-font bug through unnoticed.
 *  2. `fillStyle` is recorded on ASSIGNMENT, not only at draw time, so the
 *     one-ink check sees every style the kit sets even on a call that ends up
 *     drawing nothing.
 *  3. Nothing is validated or clamped. The recorder must not be more forgiving
 *     than a real context and must not be less: a NaN coordinate is written down
 *     as NaN, so an assertion can catch it.
 */
function makeRecordingCtx() {
  const rec = { texts: [], rects: [], styles: [] };
  let fillStyle = null;
  const ctx = {
    get fillStyle() { return fillStyle; },
    set fillStyle(v) { fillStyle = v; rec.styles.push(v); },
    strokeStyle: null,
    font: '',
    textAlign: '',
    textBaseline: '',
    fillRect(x, y, w, h) { rec.rects.push({ x, y, w, h, style: fillStyle }); },
    clearRect(x, y, w, h) { rec.rects.push({ x, y, w, h, style: 'clear' }); },
    fillText(str, x, y) { rec.texts.push({ str, x, y, style: fillStyle, font: ctx.font }); },
    measureText(str) {
      // Monospace: width is a fixed fraction of the size, times the length. The
      // 0.6 advance ratio is the usual shape of a monospace face; the exact
      // value does not matter, that it TRACKS THE FONT does.
      const m = /(\d+(?:\.\d+)?)px/.exec(ctx.font);
      const size = m ? parseFloat(m[1]) : 10;
      return { width: String(str).length * size * 0.6 };
    },
  };
  return { ctx, rec };
}

/**
 * A panel shaped the way `PanelHost` shapes one: the buffer's WIDTH DERIVED from
 * a measured aspect and a chosen height, through the host's own function. Not
 * two independent numbers — that is how a 6:5 face ends up drawn with 3:2 pixels.
 */
function makePanel(role, { aspect = 1.2, heightPx = DEFAULT_PANEL_BUFFER_HEIGHT_PX } = {}) {
  const buffer = derivePanelBuffer({ aspect }, heightPx);
  const { ctx, rec } = makeRecordingCtx();
  return {
    role,
    nodeName: DEFAULT_PANEL_ROLES[role],
    metrics: { aspect },
    canvas: { width: buffer.width, height: buffer.height },
    ctx,
    rec,
  };
}

/**
 * Paint one role at one instant THROUGH THE ADAPTER, and hand back what was
 * drawn. Going through `LAB_PAINTERS` rather than calling the painters directly
 * is deliberate: the adapter is the part of this seam the lab owns, so it should
 * be on the path of every assertion rather than tested once in isolation.
 */
function paint(role, snapshot, nowMs, opts) {
  const panel = makePanel(role, opts);
  LAB_PAINTERS[role](panel, snapshot, nowMs);
  return panel.rec;
}

/** Just the strings a paint put on the glass, in draw order. */
const drawnStrings = (rec) => rec.texts.map((t) => t.str);

// ── The scripted flight ─────────────────────────────────────────────────────

describe('scripted flight — the lab has a ship worth watching', () => {
  it('does not disable any of its own tests', () => {
    expect(SELF_DISABLES_TESTS).toBe(false);
  });

  it('walked a non-empty flight, so no assertion below is vacuous', () => {
    // Every check in this file iterates `frames`. An empty walk would satisfy
    // every `.every()` and every `for` loop silently, and the suite would come
    // back green having measured nothing at all.
    expect(frames.length).toBeGreaterThan(FLIGHT_DURATION_S);
    expect(worlds.length).toBe(SEEDS.length);
  });

  it('is a pure function of time, so a scrubbed frame is a reproducible frame', () => {
    // The whole reason the script is a timeline rather than a simulation. If
    // arriving at t = 41 s by scrubbing gave a different frame from arriving by
    // playing it through, the frame Max stops on to examine would not be one
    // anyone could get back to.
    const at = (t) => JSON.stringify(
      flightSourcesAt(t, world),
      (k, v) => (typeof v === 'function' ? '[fn]' : v),
    );
    for (const t of [0, 7.5, 19, 37.4, 41, 58.75, 71.9]) {
      expect(at(t), `t = ${t} did not reproduce`).toBe(at(t));
      // And re-derived after a full loop, which is what a wrapped scrub does.
      expect(at(t + FLIGHT_DURATION_S), `t = ${t} did not survive a wrap`).toBe(at(t));
    }
  });

  it('wraps a negative time instead of falling off the front of the timeline', () => {
    // JavaScript's % keeps the sign of its left operand, so a scrub handle
    // dragged below zero would land outside every segment. `segmentAt` would
    // then fall through to the LAST one and caption an idling ship 'MASS LOCK'.
    expect(segmentAt(-1).name).toBe(segmentAt(FLIGHT_DURATION_S - 1).name);
    expect(segmentAt(-0.5).name).toBe(FLIGHT_SEGMENTS[FLIGHT_SEGMENTS.length - 1].name);
    expect(segmentAt(0).name).toBe(FLIGHT_SEGMENTS[0].name);
  });

  it('DWELLS in all three speed tiers — km/s, Mm/s and c — not merely passes through', () => {
    // The DRIVE panel's whole numeric behaviour is tier-dependent (1-dp under
    // 100 km/s, 2-dp Mm/s, 2-dp c under 100 then integer). A script that never
    // left one tier would demonstrate a third of it.
    //
    // DWELL, NOT PRESENCE, and that distinction is the whole assertion. This was
    // originally written as "the set of tiers seen is all three" and it was
    // WEAK: measured, a linear speed ramp crosses the Mm/s tier in about a
    // quarter of a second, so whether the set contained 'Mm/s' came down to
    // whether a sampling instant happened to land inside that window. It did, so
    // the check passed on a script that showed Max the middle tier for one
    // frame. A tier that flashes past is not demonstrated. Requiring each to
    // hold for several seconds is what makes `logLerp` — which gives every
    // decade equal time — actually load-bearing rather than merely present.
    const dwellOver = (fs) => {
      const d = {};
      for (const f of fs) {
        const unit = formatSpeed(f.snapshot.drive.speed).unit;
        d[unit] = (d[unit] ?? 0) + 1;
      }
      return d;
    };

    const whole = dwellOver(frames);
    expect(Object.keys(whole).sort()).toEqual(['Mm/s', 'c', 'km/s']);
    for (const unit of ['km/s', 'Mm/s', 'c']) {
      expect(whole[unit], `over the whole flight the ${unit} tier holds for only ${whole[unit]} frames`)
        .toBeGreaterThanOrEqual(16);   // 4 seconds at this step
    }

    // AND the CLIMB specifically walks up through all three, which is where the
    // geometric ramp is actually load-bearing. Measured: the ship comes back
    // DOWN through the tiers slowly during the approach, so the whole-flight
    // count above is satisfied even by a linear climb that crosses Mm/s in a
    // quarter of a second — 1 frame on the way up, 20 seconds on the way down.
    // Watching the readout climb is a different thing from watching it fall, and
    // it is the one Max asked for, so it gets its own count.
    const climb = dwellOver(frames.filter((f) => segmentAt(f.t).name === 'DRIVE ON / CLIMB'));
    for (const unit of ['km/s', 'Mm/s', 'c']) {
      expect(climb[unit] ?? 0, `the climb passes through the ${unit} tier in ${climb[unit] ?? 0} frames`)
        .toBeGreaterThanOrEqual(8);    // 2 seconds at this step
    }
  });

  it('reverses, so the REV prefix has something to prefix', () => {
    const reversing = frames.filter((f) => f.snapshot.drive.speed < 0);
    expect(reversing.length).toBeGreaterThan(4);
    // And it reverses while the drive is OUT, which is the only regime the game
    // reverses in — a reversing supercruise would be a staged impossibility.
    expect(reversing.every((f) => f.snapshot.drive.driveOn === false)).toBe(true);
  });

  it('drops the drive to sublight, so the SUBLIGHT tag and bipolar bar are exercised', () => {
    const on = frames.filter((f) => f.snapshot.drive.driveOn);
    const off = frames.filter((f) => !f.snapshot.drive.driveOn);
    expect(on.length).toBeGreaterThan(10);
    expect(off.length).toBeGreaterThan(10);
  });

  it('fires the mass-lock cue', () => {
    expect(frames.some((f) => f.snapshot.target.massLockHint)).toBe(true);
  });

  it('reaches SAFE TO DROP and then SLOW DOWN, on every seed', () => {
    // The one sequence the approach exists to show, and the reason the script is
    // written in multiples of the capture sphere: on absolute distances this
    // would pass on seed one and quietly demonstrate nothing on the rest.
    for (const w of worlds) {
      const states = walk(w).map((f) => f.snapshot.target.dropState);
      const firstSafe = states.indexOf('in-window');
      const firstFast = states.indexOf('too-fast');
      expect(states, `${w.seed}: never left 'none'`).toContain('in-window');
      expect(states, `${w.seed}: never went too fast`).toContain('too-fast');
      expect(firstSafe, `${w.seed}: SLOW DOWN came before SAFE TO DROP`).toBeLessThan(firstFast);
      expect(states[0], `${w.seed}: started already in the window`).toBe('none');
    }
  });

  it('obeys the real capture rule at every instant, not a staged imitation', () => {
    // `dropStateFor` is main.js's `_scDropState()` over one body. This checks the
    // TIMELINE against it independently: recompute the classification from the
    // frame's own distance and speed and demand the snapshot agrees. A script
    // that hand-set 'in-window' to make the demo look good fails here — and that
    // matters more than it sounds, because SAFE TO DROP is a safety cue and a
    // lab that showed it at a distance the game will not honour would be
    // teaching Max to trust the wrong thing.
    for (const w of worlds) {
      const { captureSphere, dropMaxSpeed } = dropWindowFor(w.target.radiusScene);
      for (const { t, snapshot } of walk(w)) {
        const d = snapshot.target.distance;
        const expected = d == null
          ? 'none'
          : d > captureSphere ? 'none'
            : snapshot.drive.speed <= dropMaxSpeed ? 'in-window' : 'too-fast';
        expect(snapshot.target.dropState, `${w.seed} @ ${t}s (d=${d})`).toBe(expected);
      }
    }
  });

  it('has no target before it is committed, and one after', () => {
    // `distance` is the presence signal the whole readout keys on.
    expect(frames[0].snapshot.target.distance).toBeNull();
    expect(frames[frames.length - 1].snapshot.target.distance).not.toBeNull();
  });

  it('cycles focus across a planet, a moon and nothing', () => {
    const kinds = new Set(frames.map((f) => f.snapshot.survey.kind));
    expect(kinds.has('planet')).toBe(true);
    expect(kinds.has('moon')).toBe(true);
    expect(kinds.has(null)).toBe(true);
  });

  it('shows a real dossier on a planet — not a blank one, which would pass everything', () => {
    // The non-vacuity half of the moon test below. If the planet legs were ALSO
    // blank, "the moon blanks T_eq" would be true and meaningless.
    const planetFrames = frames.filter((f) => f.snapshot.survey.kind === 'planet');
    expect(planetFrames.length).toBeGreaterThan(10);
    for (const { t, snapshot } of planetFrames) {
      expect(typeof snapshot.survey.tEq, `@ ${t}s`).toBe('number');
      expect(snapshot.survey.composition, `@ ${t}s`).toBeTruthy();
      expect(snapshot.survey.tidalState, `@ ${t}s`).toBeTruthy();
    }
    // And at least one leg has a retained atmosphere, so the ATMO row is proved
    // to draw. That is the row which had never once rendered in the game,
    // because main.js read a key PlanetGenerator has never emitted.
    expect(frames.some((f) => f.snapshot.survey.atmosphere)).toBe(true);
  });

  it('blanks T_eq, composition and tidal state on a moon, keeping name and type', () => {
    // PlanetGenerator writes T_eq onto PLANET data only, and main.js hands
    // `BodyRenderer.createMoon` a null physics record — so all four are absent
    // for a moon and the rows must read blank rather than stale or zero.
    const moonFrames = frames.filter((f) => f.snapshot.survey.kind === 'moon');
    expect(moonFrames.length).toBeGreaterThan(10);
    for (const { t, snapshot } of moonFrames) {
      expect(snapshot.survey.tEq, `@ ${t}s`).toBeNull();
      expect(snapshot.survey.composition, `@ ${t}s`).toBeNull();
      expect(snapshot.survey.atmosphere, `@ ${t}s`).toBeNull();
      expect(snapshot.survey.tidalState, `@ ${t}s`).toBeNull();
      expect(snapshot.survey.name, `@ ${t}s`).toBeTruthy();
      expect(snapshot.survey.type, `@ ${t}s`).toBeTruthy();
    }
  });

  it('reads the atmosphere off the key PlanetGenerator actually emits', () => {
    // The AC-PANEL-CONTENT amendment, pinned. main.js used to read
    // `planetData.atmosphereRetained` — a key that has never existed — so
    // `physics.atmosphere` was null on every planet in the galaxy and the check
    // "panel matches source" compared null to null and passed while showing the
    // pilot nothing. A lab reading the old key would look identically fine.
    const withAtmo = worlds
      .flatMap((w) => [w.planetA, w.planetB])
      .filter((p) => p.data?.atmosphere?.physics);
    expect(withAtmo.length, 'no lab world has a retained atmosphere to check against').toBeGreaterThan(0);
    for (const p of withAtmo) {
      expect(labPhysicsForPlanet(p.data).atmosphere).toBe(p.data.atmosphere.physics);
    }
    // And the key that never existed stays absent, so a future "fix" that
    // reinstates it is caught here rather than by a blank row nobody notices.
    expect(withAtmo[0].data.atmosphereRetained).toBeUndefined();
  });

  it('gives every instant a segment caption that matches what the ship is doing', () => {
    // A caption that disagrees with the panel is worse than no caption — the
    // panel is right, and the caption is what Max would trust.
    expect(segmentAt(0).name).toBe('SUBLIGHT IDLE');
    const driveOut = new Set(['SUBLIGHT IDLE', 'DROP TO SUBLIGHT', 'REVERSE', 'MASS LOCK']);
    for (const { t, snapshot } of frames) {
      const seg = segmentAt(t);
      expect(
        snapshot.drive.driveOn,
        `${seg.name} @ ${t}s disagrees with the drive state it captions`,
      ).toBe(!driveOut.has(seg.name));
    }
  });
});

// ── The shipped painters, driven through the whole flight ───────────────────

describe('lab panels — the shipped painters on the lab\'s glass', () => {
  it('mounts the SHIPPED painters, not lab copies of them', () => {
    // The lab is a demo surface. If it drew its own version of DRIVE, every
    // judgement Max made about type scale, balance and legibility would be about
    // a panel the game will never render — the most expensive way a demo can lie.
    // Identity, not behaviour: this asserts the exact function objects.
    expect(SCREEN_PAINTERS.DRIVE.name).toBe('paintDrive');
    expect(SCREEN_PAINTERS.TARGET.name).toBe('paintTarget');
    expect(SCREEN_PAINTERS.INFO.name).toBe('paintInfo');
    // NAV's entry in these two maps is the FALLBACK, not the plan. The real NAV
    // painter is shipped — src/cockpit/panels/NavPanel.js, the whole nav computer
    // in full colour, chrome-less at SYSTEM — but it needs a live NavSource sized
    // to the bound panel, which does not exist at module load. So the page mounts
    // these four and then puts `labNavPainter(source)` over NAV; this card is what
    // remains on the glass when that source could not be built.
    expect(SCREEN_PAINTERS.NAV.name).toBe('paintNavHoldingCard');
    // The real one is composed HERE rather than inline in the page, so the game
    // inherits the composition instead of reinventing it.
    expect(labNavPainter).toBeInstanceOf(Function);
    // And every role in the host's config table has a painter, so no screen can
    // silently come up blank.
    expect(Object.keys(LAB_PAINTERS).sort()).toEqual(Object.keys(DEFAULT_PANEL_ROLES).sort());
  });

  it('mounts the SHIPPED bridge too, with no private copy of it left here', () => {
    // The seam the lab exists to prove. The two contracts differ by one argument
    // — a panel carrying a ctx versus a ready-made PhosphorScreen — and getting
    // it wrong is silent: the painter throws inside the host's catch, is reported
    // once, and leaves a frozen screen with nothing to explain it.
    //
    // The bridge itself now lives in src/cockpit/panelPainter.js, so this asserts
    // the LAB-side property: that the adapter really reaches the glass, and that
    // this file has not kept a second implementation of it. A private copy is the
    // whole failure being designed out — the lab would go on working while the
    // game, mounting its own version, could get it wrong with no test anywhere.
    const panel = makePanel('NAV');
    expect(() => LAB_PAINTERS.NAV(panel, frames[0].snapshot, 0)).not.toThrow();
    expect(panel.rec.texts.length).toBeGreaterThan(0);
    expect(panelPainter(() => {})).toBeInstanceOf(Function);

    const labSource = readFileSync(join(HERE, '..', 'cockpit-screens-lab-panels.js'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    expect(labSource, 'the lab builds its own drawing kit again').not.toMatch(/new PhosphorScreen/);
    expect(labSource, 'the lab no longer imports the shipped bridge')
      .toMatch(/from '\.\/src\/cockpit\/panelPainter\.js'/);
  });

  it('sets exactly two colours across every panel and every frame of the flight', () => {
    // The whole one-ink guarantee, checked as a SET rather than as an absence of
    // banned spellings. `colorHex: 0xff7b6b` is the full-screen HUD's red in the
    // form three.js takes, and it contains no '#', no 'rgb(' and no colour word
    // for a blacklist to catch — so a whitelist is the only form of this check
    // that cannot be walked past.
    const seen = new Set();
    let painted = 0;
    for (const { t, snapshot } of frames) {
      for (const role of Object.keys(LAB_PAINTERS)) {
        for (const s of paint(role, snapshot, t * 1000).styles) seen.add(s);
        painted += 1;
      }
    }
    expect(painted).toBeGreaterThan(100);
    expect([...seen].sort()).toEqual([PHOSPHOR.BACK, PHOSPHOR.INK].sort());
  });

  it('starts every panel with a full-buffer black fill, so nothing overprints', () => {
    // `PanelHost` deliberately does NOT clear before calling a painter — it owns
    // no palette and so cannot choose a background colour — which makes clearing
    // each painter's own first line. A painter that skipped it would overprint
    // itself into an unreadable smear within a second, and there are no pixels
    // in this environment to see that happen.
    //
    // So the check is structural: the FIRST rectangle any painter draws must
    // cover the whole buffer in the background colour, which is exactly what
    // `PhosphorScreen.clear()` emits. That is detectable from a draw log, and a
    // missing clear is not.
    for (const role of Object.keys(LAB_PAINTERS)) {
      for (const f of [frames[0], frames[100], frames[260]]) {
        const rec = paint(role, f.snapshot, f.t * 1000);
        const first = rec.rects[0];
        expect(first, `${role} @ ${f.t}s drew no rectangle at all`).toBeTruthy();
        expect(first.style, `${role} @ ${f.t}s did not open with the background colour`).toBe(PHOSPHOR.BACK);
        expect([first.x, first.y], `${role} @ ${f.t}s: first fill is not at the origin`).toEqual([0, 0]);
        expect(first.w, `${role} @ ${f.t}s: first fill does not span the buffer`)
          .toBe(derivePanelBuffer({ aspect: 1.2 }, DEFAULT_PANEL_BUFFER_HEIGHT_PX).width);
        expect(first.h).toBe(DEFAULT_PANEL_BUFFER_HEIGHT_PX);
      }
    }
  });

  it('puts the readout\'s speed string on DRIVE verbatim, REV prefix included', () => {
    // `formatSpeed` returns a MAGNITUDE — it takes Math.abs — so the sign is the
    // panel's job, exactly as it is SupercruiseHud's today. Anything in this
    // chain that rebuilt the string from formatSpeed would lose the prefix and
    // the number would still be right: a reversing ship reading as a forward
    // one, with nothing anywhere to say so.
    let checkedRev = 0;
    for (const { t, snapshot } of frames) {
      const readout = buildFlightReadout(flightReadoutStateFromSnapshot(snapshot));
      const strings = drawnStrings(paint('DRIVE', snapshot, t * 1000));
      expect(strings, `@ ${t}s`).toContain(readout.speedText);
      if (snapshot.drive.speed < 0) {
        expect(readout.speedText.startsWith('REV '), `@ ${t}s`).toBe(true);
        checkedRev += 1;
      }
    }
    expect(checkedRev, 'never saw a reversing frame — the REV half was not checked').toBeGreaterThan(4);
  });

  it('shows SUBLIGHT on DRIVE exactly while the drive is out, and never otherwise', () => {
    let tagged = 0, untagged = 0;
    for (const { t, snapshot } of frames) {
      const strings = drawnStrings(paint('DRIVE', snapshot, t * 1000));
      if (snapshot.drive.driveOn === false) { expect(strings, `@ ${t}s`).toContain('SUBLIGHT'); tagged += 1; }
      else { expect(strings, `@ ${t}s`).not.toContain('SUBLIGHT'); untagged += 1; }
    }
    expect(tagged).toBeGreaterThan(10);
    expect(untagged).toBeGreaterThan(10);
  });

  it('puts every non-blank dossier value on INFO exactly as the table rendered it', () => {
    // Deliberately about the SEAM and not the layout: where InfoPanel puts its
    // rows, and how it treats a blank one, is its own file's business and its own
    // file's test. What this checks is that the value the table produced is the
    // value that reaches the glass — no reformatting, no rounding, no truncation
    // happening a second time on the way past.
    let checkedValues = 0;
    for (const { t, snapshot } of frames) {
      const rows = buildInfoRows(snapshot);
      const strings = drawnStrings(paint('INFO', snapshot, t * 1000));
      for (const row of rows) {
        if (row.value === '') continue;
        expect(strings, `@ ${t}s: ${row.label}`).toContain(row.value);
        checkedValues += 1;
      }
    }
    // Non-vacuity: a flight where every dossier row was blank would satisfy the
    // loop above without comparing a single string.
    expect(checkedValues, 'no dossier value was ever non-blank').toBeGreaterThan(100);
    // And the table is the only source of those rows — a panel that invented an
    // eighth label would be inventing a gauge, which AC-PANEL-CONTENT forbids.
    expect(INFO_ROWS.length).toBe(7);
  });

  it('shows the target\'s name on TARGET once one is committed', () => {
    const before = frames.find((f) => f.snapshot.target.distance == null);
    const after = frames.find((f) => f.snapshot.target.distance != null);
    expect(before).toBeTruthy();
    expect(after).toBeTruthy();

    const late = drawnStrings(paint('TARGET', after.snapshot, after.t * 1000));
    expect(late).toContain(after.snapshot.target.name);
    // Before the commit the snapshot carries no name, so the name cannot be on
    // the glass. Checking this way rather than for a placeholder string keeps
    // the assertion about the seam and not about TARGET's empty-state wording.
    expect(before.snapshot.target.name).toBeNull();
  });

  it('banners the drop cue on TARGET, with the exact HUD words, only while lit', () => {
    // Two halves, and the second is the one that matters. SLOW DOWN blinks, so a
    // chain that ignored the blink would draw it on every frame — which reads as
    // a calm steady line, and calm is precisely the wrong reading. Checking only
    // the lit frames would let that through.
    let litChecked = 0, darkChecked = 0;
    for (const { t, snapshot } of frames) {
      const readout = buildFlightReadout(flightReadoutStateFromSnapshot(snapshot));
      const nowMs = t * 1000;
      const strings = drawnStrings(paint('TARGET', snapshot, nowMs));
      if (!readout.drop) {
        expect(strings, `@ ${t}s`).not.toContain(ALERT_TEXT.DROP_SAFE);
        expect(strings, `@ ${t}s`).not.toContain(ALERT_TEXT.DROP_SLOW);
        continue;
      }
      if (blinkOn(readout.drop.blink, nowMs)) {
        expect(strings, `@ ${t}s lit`).toContain(readout.drop.text);
        litChecked += 1;
      } else {
        expect(strings, `@ ${t}s dark`).not.toContain(readout.drop.text);
        darkChecked += 1;
      }
    }
    expect(litChecked, 'never saw a lit drop cue').toBeGreaterThan(4);
    expect(darkChecked, 'never saw a DARK drop frame — the blink gate was untested').toBeGreaterThan(1);
  });

  it('banners mass lock on DRIVE and never on TARGET', () => {
    // Mass lock says the drive refused to re-engage HERE — the ship's
    // surroundings, not a selection — so it lives with the drive. Two panels
    // shouting one warning is how a pilot learns to read one of them as noise.
    const locked = frames.filter((f) => f.snapshot.target.massLockHint);
    expect(locked.length).toBeGreaterThan(4);
    let litSeen = 0;
    for (const { t, snapshot } of locked) {
      const nowMs = t * 1000;
      const onDrive = drawnStrings(paint('DRIVE', snapshot, nowMs));
      const onTarget = drawnStrings(paint('TARGET', snapshot, nowMs));
      expect(onTarget, `@ ${t}s`).not.toContain(ALERT_TEXT.MASS_LOCK);
      if (blinkOn(BLINK.FAST, nowMs)) { expect(onDrive, `@ ${t}s`).toContain(ALERT_TEXT.MASS_LOCK); litSeen += 1; }
      else expect(onDrive, `@ ${t}s`).not.toContain(ALERT_TEXT.MASS_LOCK);
    }
    expect(litSeen, 'the fast blink was never lit across the mass-lock leg').toBeGreaterThan(2);
  });

  it('falls back to --:-- on the ETA while reversing, through the real gate', () => {
    // `etaVisible` requires speed > 0. The script does not switch the ETA line
    // off; it reverses, and the gate does the rest. That is the difference
    // between demonstrating the behaviour and imitating it.
    const reversing = frames.filter((f) => f.snapshot.drive.speed < 0 && f.snapshot.target.distance != null);
    expect(reversing.length).toBeGreaterThan(4);
    for (const { t, snapshot } of reversing) {
      const strings = drawnStrings(paint('TARGET', snapshot, t * 1000));
      expect(strings, `@ ${t}s`).toContain('--:--');
    }
    // And a forward frame with a target shows a real counter, so the check above
    // is not simply asserting that the ETA never works.
    const forward = frames.find((f) => f.snapshot.drive.speed > 0 && f.snapshot.target.distance != null);
    const fwdStrings = drawnStrings(paint('TARGET', forward.snapshot, forward.t * 1000));
    expect(fwdStrings.some((s) => /^\d+:\d\d$/.test(s))).toBe(true);
  });

  it('keeps NAV\'s FALLBACK card two words, and nothing from the snapshot', () => {
    // The real NAV painter is elsewhere and is exercised in
    // src/cockpit/__tests__/NavPanel.test.js. THIS is the card that shows when no
    // nav computer could be built, and the rule it has to keep is the same one it
    // has always kept: a NAV panel showing the system name would look like a
    // WORKING nav computer, which is the one impression a failure state must not
    // give. AC-PANEL-CONTENT's NAV clause is about the real thing being live, and
    // a plausible placeholder is exactly how that gets ticked off by mistake.
    for (const { t, snapshot } of frames) {
      const strings = drawnStrings(paint('NAV', snapshot, t * 1000));
      expect(strings, `@ ${t}s`).toEqual([NAV_HOLDING_TEXT.TITLE, NAV_HOLDING_TEXT.NOTE]);
    }
    // The system name is right there on the frame, which is what makes the check
    // above meaningful rather than trivially true.
    expect(frames[0].snapshot.nav.systemName).toBeTruthy();
  });

  it('paints every panel at every buffer height the lab offers, without tripping the type floor', () => {
    // `PhosphorScreen` THROWS on text below H/24 rather than clamping it, so a
    // layout that only works at 512 fails loudly here instead of quietly at
    // whichever resolution the lab's control happens to be left on.
    for (const heightPx of [256, 384, 512, 768, 1024]) {
      for (const role of Object.keys(LAB_PAINTERS)) {
        for (const f of [frames[0], frames[80], frames[180], frames[frames.length - 1]]) {
          expect(
            () => paint(role, f.snapshot, f.t * 1000, { heightPx }),
            `${role} at ${heightPx}px, t = ${f.t}s`,
          ).not.toThrow();
        }
      }
    }
  });

  it('scales the type with the buffer, so raising the resolution does not shrink the text', () => {
    // The reason the type scale is fractions of H rather than pixels, and the
    // reason the adapter reads the panel's own canvas instead of a constant.
    // Doubling the buffer must double every font size; if it did not, the panel
    // would look right at one setting and half-size at the next, with no error
    // anywhere — the lab's own resolution control would be the thing breaking it.
    const sizeOf = (rec) => parseFloat(/(\d+(?:\.\d+)?)px/.exec(rec.texts[0].font)[1]);
    const f = frames[80];
    const small = paint('DRIVE', f.snapshot, f.t * 1000, { heightPx: 256 });
    const large = paint('DRIVE', f.snapshot, f.t * 1000, { heightPx: 512 });
    expect(sizeOf(large) / sizeOf(small)).toBeCloseTo(2, 6);
  });

  it('derives the buffer width from the measured aspect, never from a second number', () => {
    // The lab's panels are shaped through `derivePanelBuffer` exactly as the host
    // shapes them, so a 6:5 face cannot end up drawn with 3:2 pixels here either.
    expect(makePanel('DRIVE', { aspect: 1.2, heightPx: 500 }).canvas.width).toBe(600);
    expect(makePanel('DRIVE', { aspect: 1.5, heightPx: 500 }).canvas.width).toBe(750);
  });
});

// ── The lab's mounting path, against the real cockpit assets ────────────────

/**
 * A synthetic cockpit built from a REAL GLB's own Screen_* vertices.
 *
 * The page cannot be run here, but the interesting half of it can: the sequence
 * `PanelHost.fromRoot` → `setPainter(role, LAB_PAINTERS[role])` → `host.update`
 * is exactly what the page does after the loader resolves, and it is where the
 * lab is most likely to waste Max's time. The adapter mismatch in particular is
 * silent by construction — hand a painter the panel instead of a kit and the
 * host catches the throw, reports it once and leaves a frozen screen — so if it
 * is only ever exercised in a browser, the first time anybody finds out is when
 * Max opens the page and four rectangles are black.
 *
 * The vertices come off the GLB rather than being invented so the reported
 * aspect is the model's actual one. `MeshStandardMaterial` and `Float32Buffer-
 * Attribute` are real three objects — three is pure JS and runs headless.
 */
function cockpitFromGLB(file) {
  const { json, bin } = parseGLB(readFileSync(join(ASSET_DIR, file)));
  const root = new THREE.Group();
  // ONE shared material for all four faces, which is what the model actually
  // ships (`Screen_UL/UR/LL/LR` all reference `Mat_Screen`) and is the trap the
  // host clones its way out of.
  const shared = new THREE.MeshStandardMaterial({ name: 'Mat_Screen' });
  let screens = 0;

  for (const { index, name, node } of listNodes(json)) {
    if (!SCREEN_NODE_RE.test(name || '') || node.mesh === undefined) continue;
    // World-space, because "how big is this face" is a question about the
    // cockpit and not about the mesh's local frame — the same reason PanelHost
    // calls `updateMatrixWorld(true)` before it measures anything.
    const corners = nodeWorldPositions(json, bin, index, { recursive: false });
    // The uvs come along because the host measures the face's SHAPE off them, not
    // just its orientation: the buffer's aspect is u/v, and "the longer edge is the
    // width" is a fact about this mounting rather than about panels.
    const uvs = nodeWorldUvs(json, bin, index, { recursive: false });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(corners.flat(), 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs.flat(), 2));
    const mesh = new THREE.Mesh(geometry, shared);
    mesh.name = name;
    root.add(mesh);
    screens += 1;
  }
  return { root, screens };
}

/** The canvas factory the host is given: our recorder, sized as asked. */
function stubCanvasFactory(width, height) {
  const canvas = { width, height };
  const { ctx, rec } = makeRecordingCtx();
  canvas.getContext = (kind) => (kind === '2d' ? ctx : null);
  canvas._rec = rec;
  return canvas;
}

describe('lab mounting path — PanelHost + the lab painters, on the real assets', () => {
  it('finds the assets at all, so the mount tests below are not vacuous', () => {
    const files = readdirSync(ASSET_DIR).filter((f) => f.endsWith('.glb'));
    expect(files, 'no .glb in public/assets/cockpit — nothing was mounted').toContain('cockpit.glb');
    expect(files).toContain('cockpit-tub.glb');
  });

  it('binds four panels on cockpit.glb, shaped from the faces\' own vertices', () => {
    const { root, screens } = cockpitFromGLB('cockpit.glb');
    expect(screens, 'cockpit.glb had no Screen_* meshes to bind').toBe(4);

    const host = PanelHost.fromRoot(root, { makeCanvas: stubCanvasFactory });
    expect(host.panels.length).toBe(4);
    expect(host.panels.map((p) => p.role).sort()).toEqual(Object.keys(DEFAULT_PANEL_ROLES).sort());

    for (const p of host.panels) {
      // The buffer's WIDTH is derived from the MEASURED aspect. Asserted as an
      // identity rather than against 1.2, because the whole claim is that the
      // number comes off whatever model is loaded — pinning today's value here
      // would be the hard-coding the claim is about.
      expect(p.canvas.height).toBe(DEFAULT_PANEL_BUFFER_HEIGHT_PX);
      expect(p.canvas.width).toBe(Math.round(p.canvas.height * p.metrics.aspect));
      expect(p.metrics.width).toBeGreaterThan(0);
      expect(p.metrics.aspect).toBeGreaterThan(0);
    }
    host.dispose();
  });

  it('paints all four panels through the adapter over the whole flight, silently', () => {
    // SILENTLY is the assertion that matters. `PanelHost` catches a painter's
    // throw, reports it ONCE with console.error, and then that screen simply
    // stops updating — so a broken adapter does not crash, it produces a black
    // rectangle and a single line in a console nobody is watching. Spying on
    // console.error is the only way this failure is visible from here.
    const { root } = cockpitFromGLB('cockpit.glb');
    const host = PanelHost.fromRoot(root, { makeCanvas: stubCanvasFactory });
    for (const role of Object.keys(DEFAULT_PANEL_ROLES)) host.setPainter(role, LAB_PAINTERS[role]);

    const errors = [];
    const realError = console.error;
    console.error = (...args) => errors.push(args.map(String).join(' '));
    try {
      for (const { t, snapshot } of frames) host.update(snapshot, t * 1000);
    } finally {
      console.error = realError;
    }
    expect(errors, `a painter threw: ${errors[0] ?? ''}`).toEqual([]);

    // And every panel actually drew — a host that repainted nothing would also
    // produce no errors, which is the vacuous way to pass the check above.
    for (const p of host.panels) {
      expect(p.canvas._rec.texts.length, `${p.role} drew no text at all`).toBeGreaterThan(0);
    }
    host.dispose();
  });

  it('binds zero panels on cockpit-tub.glb, and does not throw doing it', () => {
    // The tub is a live path, not a hypothetical: it ships with no Screen_*
    // nodes today. A cockpit with no screens in it is a legitimate cockpit —
    // zero panels, no throw, and nothing printed. The lab reports that outcome
    // in words on the page rather than looking broken.
    const { root, screens } = cockpitFromGLB('cockpit-tub.glb');
    expect(screens).toBe(0);

    const errors = [];
    const realError = console.error;
    console.error = (...args) => errors.push(args.map(String).join(' '));
    let host;
    try {
      host = PanelHost.fromRoot(root, { makeCanvas: stubCanvasFactory });
      // The game registers all four painters at start-up regardless, so this
      // must not throw on a screenless cockpit either.
      for (const role of Object.keys(DEFAULT_PANEL_ROLES)) host.setPainter(role, LAB_PAINTERS[role]);
      for (const { t, snapshot } of frames.slice(0, 20)) host.update(snapshot, t * 1000);
    } finally {
      console.error = realError;
    }
    expect(host.panels.length).toBe(0);
    expect(errors).toEqual([]);
    host.dispose();
  });

  it('rebuilds cleanly at every buffer height the lab\'s [B] control offers', () => {
    // The control disposes the host and builds a new one, because the buffer is
    // created at bind time. Anything that survived a dispose — a texture, a
    // material clone — would accumulate one per press, four at a time.
    const { root } = cockpitFromGLB('cockpit.glb');
    for (const heightPx of [512, 256, 384, 768, 1024]) {
      const host = PanelHost.fromRoot(root, { makeCanvas: stubCanvasFactory, bufferHeightPx: heightPx });
      for (const role of Object.keys(DEFAULT_PANEL_ROLES)) host.setPainter(role, LAB_PAINTERS[role]);
      host.update(frames[80].snapshot, 80 * STEP_S * 1000);
      for (const p of host.panels) expect(p.canvas.height, `at ${heightPx}px`).toBe(heightPx);
      host.dispose();
      // Disposal puts the model's own material back, so the next bind starts
      // from the same place the first one did.
      expect(host.panels.length).toBe(0);
    }
    // The mesh is left wearing the material it came with, not a clone pointing
    // at a disposed texture.
    for (const child of root.children) expect(child.material.name).toBe('Mat_Screen');
  });

  it('has an Eye_Point node to put the camera on, in every cockpit asset', () => {
    // The lab reads the pilot's viewpoint off this node rather than assuming the
    // origin, so that a re-fitted cabin moves the camera with the seat. If the
    // node ever goes away, the page falls back to the origin and says so — but
    // this is where that would be noticed first.
    for (const file of readdirSync(ASSET_DIR).filter((f) => f.endsWith('.glb'))) {
      const { json } = parseGLB(readFileSync(join(ASSET_DIR, file)));
      const names = listNodes(json).map(({ name }) => name);
      expect(names, `${file} has no Eye_Point`).toContain('Eye_Point');
    }
  });
});

describe('blink cadences the lab relies on', () => {
  it('agrees with AlertCue about which tiers exist', () => {
    // The lab's banners are driven by `blinkOn(cue.blink, …)`, so a tier renamed
    // on one side of that seam turns an alarm into a calm unblinking line — or
    // into a throw inside a render loop. Neither is discoverable by looking.
    expect(Object.keys(BLINK_MS).sort()).toEqual(Object.values(BLINK).sort());
  });
});

// ── The PAGE itself, read as text ───────────────────────────────────────────

/**
 * EVERYTHING ABOVE THIS LINE TESTS THE TWO MODULES. NOTHING ABOVE IT TESTS THE
 * PAGE, and the page is the deliverable — it is the only place Max can look at
 * the panels at all.
 *
 * That gap was measured, not assumed. Two edits were made to
 * `cockpit-screens-lab.html` and the whole suite stayed green through both:
 *
 *   · an import respelled `./src/cockpit/PanelHosts.js`. Vite answers a
 *     tree-shaken 500 for an unresolvable specifier, so the module never
 *     evaluates: black canvas, one line in a console nobody has open.
 *   · one `getElementById` id respelled. `document.getElementById` returns null
 *     rather than throwing, so the failure surfaces later and elsewhere — the
 *     page's own start-up line `el.bBufferLabel.textContent = …` throws
 *     "Cannot set properties of null", at module scope, which aborts the rest
 *     of the script: no render loop, no controls, a blank black page.
 *
 * Both are the SAME class of mistake — a name spelled twice and changed once —
 * and neither is catchable by running the modules. But both are catchable by
 * READING THE PAGE AS TEXT, which is what this block does. There is no jsdom
 * here and this is not pretending to be one: it does not execute a line of the
 * page. It checks the two kinds of name that must agree with something outside
 * the file, and it checks the ink.
 *
 * WHAT THIS DELIBERATELY CANNOT CATCH, said plainly so nobody reads a green run
 * as more than it is: a three.js call that does not exist, a use-before-declare,
 * a wrong render order, or anything at all about how the page LOOKS. Those need
 * a browser. This closes the two failures that are (a) most likely, because they
 * are typos, and (b) fully invisible from here otherwise.
 */
const LAB_HTML = readFileSync(join(HERE, '..', 'cockpit-screens-lab.html'), 'utf8');
const LAB_SCRIPT = (/<script type="module">([\s\S]*?)<\/script>/.exec(LAB_HTML) ?? [])[1] ?? '';

/**
 * The names a module file hands out.
 *
 * Deliberately a text scan and not an `import()`. Importing the page's targets
 * would prove they load in NODE, and the question is whether the page's written
 * specifier resolves ON DISK — a file that exists but was never imported here is
 * exactly the case a live import would miss by succeeding for the wrong reason.
 */
function exportedNames(source) {
  const names = new Set();
  for (const m of source.matchAll(/^\s*export\s+(?:default\s+)?(?:async\s+)?(?:function|class)\s+([A-Za-z0-9_$]+)/gm)) {
    names.add(m[1]);
  }
  for (const m of source.matchAll(/^\s*export\s+(?:const|let|var)\s+([A-Za-z0-9_$]+)/gm)) names.add(m[1]);
  for (const m of source.matchAll(/^\s*export\s*\{([^}]*)\}/gm)) {
    for (const part of m[1].split(',')) {
      const name = part.trim();
      if (name) names.add(name.includes(' as ') ? name.split(' as ')[1].trim() : name);
    }
  }
  return names;
}

describe('the lab page — the half no other test can see', () => {
  it('has a module script to read at all, so nothing below passes by finding nothing', () => {
    // Every check in this block scans LAB_SCRIPT. If the extraction ever stopped
    // matching — a reformat, an attribute reordered — every `for` loop below
    // would iterate zero times and report success having read nothing.
    expect(LAB_SCRIPT.length, 'could not extract the page\'s module script').toBeGreaterThan(5000);
  });

  it('resolves every relative import to a real file that exports every name asked of it', () => {
    // The single most likely way this page wastes Max's time. A bare specifier
    // (`three`, `three/addons/...`) is Vite's and three's own business and is not
    // checked here; a relative path is the page's own and is checked exactly.
    // The clause is matched as "anything but a quote", which is what stops one
    // import's clause running on into a LATER import's specifier: the quotes
    // around every intervening specifier are a wall the match cannot cross.
    // Written greedily the first time, this reported `{ OrbitControls }` as
    // coming from './src/cockpit/PanelHost.js' — a false failure that would have
    // been read as a real one.
    const imports = [...LAB_SCRIPT.matchAll(/import\s+([^']*?)\s+from\s+'(\.[^']+)'/g)];
    expect(imports.length, 'found no relative imports — the reader is broken, not the page')
      .toBeGreaterThanOrEqual(5);

    for (const [, clause, spec] of imports) {
      const target = join(HERE, '..', spec);
      expect(existsSync(target), `the page imports ${spec}, which is not a file`).toBe(true);

      const available = exportedNames(readFileSync(target, 'utf8'));
      const braced = /\{([\s\S]*)\}/.exec(clause);
      const wanted = braced
        ? braced[1].split(',').map((p) => p.trim().split(' as ')[0].trim()).filter(Boolean)
        : [];
      expect(wanted.length, `no names parsed out of the page's import from ${spec}`).toBeGreaterThan(0);
      for (const name of wanted) {
        expect(available.has(name), `the page imports { ${name} } from ${spec}, which does not export it`)
          .toBe(true);
      }
    }
  });

  it('asks the document only for element ids the markup actually defines', () => {
    // getElementById returns NULL for a name that is not there — it does not
    // throw — so a respelled id does not fail where it is written. It fails at
    // the first `.textContent` or `.onclick` on the result, which on this page
    // happens during start-up at module scope and takes the whole script down.
    const asked = [...LAB_SCRIPT.matchAll(/getElementById\('([^']+)'\)/g)].map((m) => m[1]);
    const defined = new Set([...LAB_HTML.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
    expect(asked.length, 'found no getElementById calls — the reader is broken').toBeGreaterThan(10);
    for (const id of asked) {
      expect(defined.has(id), `the page asks for #${id}, which the markup does not define`).toBe(true);
    }
  });

  it('builds a world for every seed the page\'s [N] control offers', () => {
    // The page carries its OWN seed table; the SEEDS list at the top of this file
    // is a separate literal and proving those five build proves nothing about the
    // five Max will actually cycle through. `buildLabWorld` THROWS on a system
    // whose planets all lack moons — deliberately, because the moon leg is what
    // demonstrates the blanking rule — so a seed added to the page without being
    // tried lands as "NO FLIGHT" on the glass the first time [N] reaches it.
    const table = /const LAB_SEEDS = \[([\s\S]*?)\n    \];/.exec(LAB_SCRIPT);
    expect(table, 'could not find LAB_SEEDS in the page — was the table reformatted?').toBeTruthy();
    const rows = [...table[1].matchAll(
      /\[\s*'([^']+)',\s*\{\s*x:\s*(-?[\d.]+),\s*y:\s*(-?[\d.]+),\s*z:\s*(-?[\d.]+)\s*\}\s*\]/g,
    )];
    expect(rows.length, 'parsed no seeds out of the page\'s LAB_SEEDS').toBeGreaterThan(0);
    for (const [, seed, x, y, z] of rows) {
      const built = buildLabWorld(seed, { x: +x, y: +y, z: +z });
      expect(built.target.radiusScene, `${seed}: no target radius to scale the approach against`)
        .toBeGreaterThan(0);
      expect(built.systemName, `${seed}: no system name`).toBeTruthy();
    }
  });

  it('keeps the ink a WARM off-white, written out here so the constant cannot move quietly', () => {
    // THE ONE-INK CHECK ABOVE IS A SET-EQUALITY AGAINST PHOSPHOR'S OWN VALUES, so
    // it proves "exactly two colours" and nothing whatsoever about WHICH two.
    // Measured: changing PHOSPHOR.INK to '#FFFFFF' left all 38 tests green — and
    // pure white on black at this angular size is the specific thing the spec
    // rules out, because it glares and blooms. The literal is written HERE rather
    // than imported for the usual reason: a test that reads its expectation out
    // of the file under test agrees with every future edit by construction.
    expect(PHOSPHOR.INK.toUpperCase()).toBe('#EDE8DE');
    expect(PHOSPHOR.BACK.toUpperCase()).toBe('#000000');
  });

  it('tints the page chrome with the same ink the glass is drawn in', () => {
    // The page writes the ink THREE times: the CSS `--ink` variable, the WHITE
    // entry of its [P] palette, and — by importing PhosphorScreen — whatever the
    // painters actually draw with. The header promises [P] "retints the GLASS and
    // the chrome together", and that promise is only kept while all three agree.
    // Nothing else notices when they stop: the chrome simply drifts to a slightly
    // different white than the screens, which reads as a bad monitor.
    const cssInk = /--ink:\s*(#[0-9A-Fa-f]{6})/.exec(LAB_HTML);
    const paletteInk = /name:\s*'WHITE'[^}]*?ink:\s*'(#[0-9A-Fa-f]{6})'/.exec(LAB_SCRIPT);
    expect(cssInk, 'no --ink variable found in the page\'s stylesheet').toBeTruthy();
    expect(paletteInk, 'no WHITE entry found in the page\'s phosphor table').toBeTruthy();
    expect(cssInk[1].toUpperCase(), 'the chrome\'s --ink is not the ink the panels draw with')
      .toBe(PHOSPHOR.INK.toUpperCase());
    expect(paletteInk[1].toUpperCase(), 'the [P] WHITE entry is not the ink the panels draw with')
      .toBe(PHOSPHOR.INK.toUpperCase());
  });
});
