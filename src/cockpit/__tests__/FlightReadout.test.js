/**
 * FlightReadout — lane F (cockpit-screen-content-2026-07-28).
 *
 * This module is a PORT of src/ui/SupercruiseHud.js's drive/target readout onto
 * the cockpit glass, so the thing worth testing is not "does it produce sensible
 * output" — it is "does it say EXACTLY what the overlay says". The numbers come
 * out of the supercruise model and main.js's `_scDropState()` and they are
 * physically true; a transcription slip does not make an ugly panel, it makes a
 * WRONG SAFETY CUE on the screen a pilot reads while closing on a planet.
 *
 * So the shape of this file is a TRUTH TABLE with hand-written expectations. The
 * expected strings are literals — '0.50 c', 'SAFE TO DROP', '8:20' — and not
 * re-derived by calling formatSpeed or ALERT_TEXT in the assertion, because an
 * expectation computed the same way as the answer proves only that the code is
 * self-consistent. Every row was checked against what the overlay's own
 * expressions produce for the same inputs.
 *
 * FIVE THINGS THIS FILE EXISTS TO CATCH, each of which is a plausible edit:
 *
 *   1. speedToBarFrac(speed) instead of speedToBarFrac(Math.abs(speed)). The
 *      function is not abs-safe — it takes log10 — so a reversing ship's bar
 *      clamps to EMPTY while the number beside it reads REV 0.50 c.
 *   2. The drop LABEL widened to the bar's `inWindow` formula. The overlay uses
 *      the RAW dropState for the labels and the wider OR only for the bar, on
 *      purpose: 'in-window' is only returned INSIDE the 10R capture sphere, so a
 *      widened label prints SAFE TO DROP where a drop-out does nothing.
 *   3. The 'REV ' prefix dropped. formatSpeed returns a magnitude, so without the
 *      prefix a ship reversing at half light reads identically to one going
 *      forward at half light. Right number, direction gone.
 *   4. A colour riding along. The glass is Phosphor — one ink — and the overlay
 *      distinguishes these same states with six different fillStyles.
 *   5. THE BAR'S MARKS COMPUTED IN THE WRONG DOMAIN. The bar runs on two scales
 *      — unsigned log in supercruise, signed linear sublight — and the pin and
 *      the tick have to be in whichever one `frac` is in. The overlay computes
 *      both OUTSIDE its own driveOn branch and therefore gets this wrong today;
 *      the panel deliberately does not. The whole of section "── The bar's two
 *      domains" below exists for this, including a guard that reads the
 *      overlay's source so the divergence cannot silently go stale.
 *
 * All five are PLANTED AND WATCHED TO FAIL before this file was considered done;
 * a green assertion nobody has seen go red proves nothing.
 *
 * No skip helper appears anywhere below, and that is enforced at MODULE SCOPE —
 * see assertNoSkipHelpers for why a guard inside an `it()` cannot police `.only`.
 * Lane E's tests/cockpit-geometry.test.js is entitled to its describe.skipIf
 * because a separate gate test stands behind it; lane F has no such gate, so a
 * copied skip would let a deleted input make the file green.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { speedToBarFrac, sublightBarFrac } from '../../ui/SpeedFormat.js';
import { buildAlertCue } from '../../ui/AlertCue.js';
import { buildCockpitSnapshot } from '../CockpitSnapshot.js';
import {
  buildFlightReadout, flightReadoutStateFromSnapshot,
  READOUT_TEXT, SPEED_BAND, TARGET_PRESENT,
} from '../FlightReadout.js';

const HERE = dirname(fileURLToPath(import.meta.url));

/** Source text with comments removed — every scan here is about code, not prose. */
function codeOf(path) {
  return readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')      // block comments
    .replace(/^\s*\/\/.*$/gm, '');         // line comments
}

/** Where SupercruiseHud.js lives, relative to this file. */
const HUD_PATH = join(HERE, '..', '..', 'ui', 'SupercruiseHud.js');

/**
 * The character offset of the brace that closes the block containing `from`.
 *
 * Used to establish WHERE IN THE OVERLAY'S CODE something sits, which is the
 * substance of the bar-domain divergence: the overlay's pin and tick are wrong
 * precisely because they are computed OUTSIDE its driveOn branch, and "outside"
 * is a structural claim that a text match cannot make. Depth starts at zero and
 * the first `}` that would take it negative is the one that closes the block.
 *
 * Braces inside strings and template literals would confuse this. The only span
 * it is ever pointed at is SupercruiseHud's speed-bar branch, which contains
 * none — and it throws rather than returning a guess if the braces do not
 * balance, so a future edit that introduces one is a loud failure here rather
 * than a quietly wrong offset.
 */
function closingBraceAfter(code, from) {
  let depth = 0;
  for (let i = from; i < code.length; i++) {
    if (code[i] === '{') depth++;
    else if (code[i] === '}') {
      if (depth === 0) return i;
      depth--;
    }
  }
  throw new Error(
    `closingBraceAfter: no closing brace after offset ${from}. The overlay's speed-bar ` +
    `branch could not be located, so the divergence guard below would be asserting ` +
    `nothing. Re-read SupercruiseHud.js before touching this test.`,
  );
}

/**
 * Visit every value in an object graph, at any depth, with the path that reached
 * it. `seen` is a cycle backstop: a self-referential return value would otherwise
 * hang the runner, and a hang reads like an infrastructure problem rather than
 * the test failure it actually is.
 */
function walk(value, path, visit, seen = new Set()) {
  visit(value, path);
  if (value === null || typeof value !== 'object') return;
  if (seen.has(value)) return;
  seen.add(value);
  for (const key of Object.keys(value)) {
    visit(key, `${path} (key ${key})`);
    walk(value[key], `${path}.${key}`, visit, seen);
  }
}

/**
 * Scan this file for a helper that would take tests OUT of the run and throw if
 * one is there. Comments are stripped first (the header discusses lane E's
 * skipIf) and the pattern is assembled from fragments, because a literal one
 * would match itself and fail a file that is in fact clean.
 *
 * CALLED AT MODULE SCOPE, NOT FROM AN `it()`. A guard living inside a test cannot
 * police `.only`: a stray `it.only` anywhere else skips the guard along with
 * everything else, and the file still reports green. Throwing during collection
 * cannot be skipped by anything.
 */
function assertNoSkipHelpers() {
  const code = codeOf(join(HERE, 'FlightReadout.test.js'));
  const helpers = ['skip', 'only', 'todo', 'fails'];
  const pattern = new RegExp(['describe', 'it', 'test']
    .flatMap((k) => helpers.map((h) => `${k}\\.${h}`)).join('|'));
  const hit = code.match(pattern);
  if (hit) {
    throw new Error(
      `FlightReadout.test.js contains '${hit[0]}' — a helper that takes tests out of ` +
      `the run while the file still reports green. Lane E's cockpit-geometry.test.js ` +
      `is allowed its skipIf because a separate gate test stands behind it; lane F ` +
      `has no such gate, so it has no such helper.`,
    );
  }
  return true;
}

assertNoSkipHelpers();

// ── Fixtures ────────────────────────────────────────────────────────────────
//
// Speeds chosen so each one lands in a DIFFERENT tier of formatSpeed and so the
// bar fractions are distinguishable. Values verified against the real
// SpeedFormat: 1 scene-u/s is 0.499 c ("0.50 c"), 0.001 is 149.6 km/s, which
// rounds to "150 km/s" (the km/s tier switches to integers at 100).
const FAST = 1;         // "0.50 c"      — well up the log bar
const SLOW = 0.001;     // "150 km/s"    — below the log bar's floor, frac 0
const STOP = 0;         // "0.0 km/s"
const CAP = 0.01;       // sublight cap, so SLOW is a tenth of it

// A drop ceiling SLOW sits under and FAST sits far above.
const CEILING = 0.05;

/**
 * A target position. The overlay wants a THREE.Vector3 here and reads it two
 * ways — as a truthiness flag, and by projecting it to screen space. The port
 * only ever does the first (see the divergence test below), so any truthy object
 * is a faithful stand-in.
 */
const TARGET = { x: 0, y: 0, z: -5 };

/**
 * A REAL FRAME, READ OFF THE RUNNING GAME. Lab at t=66 s, ship reversing under
 * sublight, target selected. Not a constructed case — these are the values the
 * builder was actually handed, which is why they are ugly and why they are here
 * verbatim rather than rounded into something tidier.
 *
 * What the old code did with them is the whole reason the bar-domain tests exist:
 * the fill sat at -0.528 (half astern) while the commanded pin computed to 0,
 * dead centre on a centre-zero bar, reading "commanding a full stop"; and the
 * drop tick — the SAFETY mark — landed 27% right of centre off a ceiling FIFTY
 * TIMES the sublight cap.
 */
const MEASURED = Object.freeze({
  speed: -0.00105625,
  sublightCap: 0.002,
  commandedSpeed: -0.00105625,
  dropMaxSpeed: 0.1,
});

/** What that frame's fill fraction is: -0.00105625 / 0.002, exactly. */
const MEASURED_FRAC = -0.528125;

/** The three cue objects, written out as literals rather than imported. */
const SAFE = { text: 'SAFE TO DROP', blink: 'steady' };
const SLOW_DOWN = { text: 'SLOW DOWN', blink: 'slow' };
const MASS_LOCK = { text: 'TOO CLOSE — SUBLIGHT ONLY', blink: 'fast' };

/**
 * THE TABLE. Every row is a complete `scHud.update`-shaped state and the exact
 * text the panel must show for it. `expect` is the WHOLE readout minus the bar
 * (which has its own test), compared with toEqual — so a field that appears or
 * disappears trips every row at once.
 */
const ROWS = [
  {
    name: 'supercruise, forward, nothing selected',
    state: { speed: FAST, commandedSpeed: FAST, driveOn: true, dropState: 'none', flightMode: 'manual' },
    expect: {
      speedText: '0.50 c', sublightTag: null, band: 'normal',
      eta: null, drop: null, massLock: null, modeLine: 'MODE: MANUAL',
    },
  },
  {
    name: 'supercruise, REVERSING, nothing selected',
    // The whole point of the REV prefix: formatSpeed returns a magnitude, so
    // without it this row is indistinguishable from the one above.
    state: { speed: -FAST, commandedSpeed: -FAST, driveOn: true, dropState: 'none', flightMode: null },
    expect: {
      speedText: 'REV 0.50 c', sublightTag: null, band: 'normal',
      eta: null, drop: null, massLock: null, modeLine: null,
    },
  },
  {
    name: 'supercruise, stopped',
    // 0.0, not "0" — the km/s tier keeps one decimal under 100 so a barely
    // moving ship never reads as stationary. Pinned because "0" was the bug.
    state: { speed: STOP, commandedSpeed: 0, driveOn: true, dropState: 'none' },
    expect: {
      speedText: '0.0 km/s', sublightTag: null, band: 'normal',
      eta: null, drop: null, massLock: null, modeLine: null,
    },
  },
  {
    name: 'sublight, forward — the SUBLIGHT tag',
    state: { speed: SLOW, commandedSpeed: SLOW, driveOn: false, sublightCap: CAP, dropState: 'none', flightMode: 'align' },
    expect: {
      speedText: '150 km/s', sublightTag: 'SUBLIGHT', band: 'normal',
      eta: null, drop: null, massLock: null, modeLine: 'MODE: ALIGN',
    },
  },
  {
    name: 'sublight, reversing',
    state: { speed: -SLOW, commandedSpeed: -SLOW, driveOn: false, sublightCap: CAP, dropState: 'none' },
    expect: {
      speedText: 'REV 150 km/s', sublightTag: 'SUBLIGHT', band: 'normal',
      eta: null, drop: null, massLock: null, modeLine: null,
    },
  },
  {
    name: 'target selected, far out and fast — nothing to say yet',
    state: {
      speed: FAST, commandedSpeed: FAST, driveOn: true, targetPos: TARGET,
      targetDistance: 100, aimOnTarget: false, dropState: 'none', dropMaxSpeed: CEILING,
    },
    expect: {
      speedText: '0.50 c', sublightTag: null, band: 'normal',
      eta: null, drop: null, massLock: null, modeLine: null,
    },
  },
  {
    name: 'THE ROW THAT SEPARATES BAND FROM LABEL: under the ceiling, outside the sphere',
    // dropState is 'none' — main.js's _scDropState() only leaves 'none' when the
    // ship is OUTSIDE the 10R capture sphere. The bar's wider rule fires anyway
    // (target set, under the ceiling) so the BAND reads in-window; the LABEL must
    // stay silent, because pressing drop out here does nothing at all.
    state: {
      speed: SLOW, commandedSpeed: SLOW, driveOn: true, targetPos: TARGET,
      targetDistance: 20, aimOnTarget: false, dropState: 'none', dropMaxSpeed: CEILING,
    },
    expect: {
      speedText: '150 km/s', sublightTag: null, band: 'in-window',
      eta: null, drop: null, massLock: null, modeLine: null,
    },
  },
  {
    name: 'in the window, aimed at it — SAFE TO DROP plus a live ETA',
    // 0.5 / 0.001 = 500 s = 8:20.
    state: {
      speed: SLOW, commandedSpeed: SLOW, driveOn: true, targetPos: TARGET,
      targetDistance: 0.5, aimOnTarget: true, dropState: 'in-window', dropMaxSpeed: CEILING,
    },
    expect: {
      speedText: '150 km/s', sublightTag: null, band: 'in-window',
      eta: '8:20', drop: SAFE, massLock: null, modeLine: null,
    },
  },
  {
    name: 'too fast on approach, aimed at it — SLOW DOWN',
    // 100 / 1 = 100 s = 1:40.
    state: {
      speed: FAST, commandedSpeed: FAST, driveOn: true, targetPos: TARGET,
      targetDistance: 100, aimOnTarget: true, dropState: 'too-fast', dropMaxSpeed: CEILING,
    },
    expect: {
      speedText: '0.50 c', sublightTag: null, band: 'too-fast',
      eta: '1:40', drop: SLOW_DOWN, massLock: null, modeLine: 'MODE: ASSIST',
    },
    stateExtra: { flightMode: 'assist' },
  },
  {
    name: 'too fast but LOOKING AWAY — the ETA hides, the warning does not',
    // The two gates are different on purpose: the ETA counter is contextual
    // (aim-gated), the drop label is an approach-safety cue and stays.
    state: {
      speed: FAST, commandedSpeed: FAST, driveOn: true, targetPos: TARGET,
      targetDistance: 100, aimOnTarget: false, dropState: 'too-fast', dropMaxSpeed: CEILING,
    },
    expect: {
      speedText: '0.50 c', sublightTag: null, band: 'too-fast',
      eta: null, drop: SLOW_DOWN, massLock: null, modeLine: null,
    },
  },
  {
    name: 'aimed at it but not moving — the placeholder, not a division by zero',
    state: {
      speed: STOP, commandedSpeed: 0, driveOn: true, targetPos: TARGET,
      targetDistance: 10, aimOnTarget: true, dropState: 'in-window', dropMaxSpeed: CEILING,
    },
    expect: {
      speedText: '0.0 km/s', sublightTag: null, band: 'in-window',
      eta: '--:--', drop: SAFE, massLock: null, modeLine: null,
    },
  },
  {
    name: 'aimed at it while REVERSING — no ETA, and the band still counts it under the ceiling',
    // Faithful to the overlay, quirk included: the ceiling test is a SIGNED
    // comparison (speed <= dropMaxSpeed), and main.js's _scDropState() compares
    // the same signed way, so a ship reversing hard reads as under the ceiling.
    // Transcribed rather than "fixed" — the panel must not disagree with the HUD
    // and the capture rule about the same frame.
    state: {
      speed: -FAST, commandedSpeed: -FAST, driveOn: true, targetPos: TARGET,
      targetDistance: 10, aimOnTarget: true, dropState: 'none', dropMaxSpeed: CEILING,
    },
    expect: {
      speedText: 'REV 0.50 c', sublightTag: null, band: 'in-window',
      eta: '--:--', drop: null, massLock: null, modeLine: null,
    },
  },
  {
    name: 'aimed at it with no distance yet — placeholder, never a blank line',
    state: {
      speed: FAST, commandedSpeed: FAST, driveOn: true, targetPos: TARGET,
      targetDistance: null, aimOnTarget: true, dropState: 'none', dropMaxSpeed: null,
    },
    expect: {
      speedText: '0.50 c', sublightTag: null, band: 'normal',
      eta: '--:--', drop: null, massLock: null, modeLine: null,
    },
  },
  {
    name: 'mass locked — the drive refused, and that has nothing to do with a target',
    state: {
      speed: SLOW, commandedSpeed: SLOW, driveOn: false, sublightCap: CAP,
      massLockHint: true, dropState: 'none', flightMode: 'manual',
    },
    expect: {
      speedText: '150 km/s', sublightTag: 'SUBLIGHT', band: 'normal',
      eta: null, drop: null, massLock: MASS_LOCK, modeLine: 'MODE: MANUAL',
    },
  },
  {
    name: 'mass locked AND too fast on a target — both lines, neither suppressing the other',
    state: {
      speed: FAST, commandedSpeed: FAST, driveOn: false, sublightCap: CAP,
      targetPos: TARGET, targetDistance: 65, aimOnTarget: true,
      dropState: 'too-fast', dropMaxSpeed: CEILING, massLockHint: true,
    },
    // 65 / 1 = 65 s = 1:05 — the padStart row. '1:5' would be wrong.
    expect: {
      speedText: '0.50 c', sublightTag: 'SUBLIGHT', band: 'too-fast',
      eta: '1:05', drop: SLOW_DOWN, massLock: MASS_LOCK, modeLine: null,
    },
  },
  {
    name: 'a long haul — minutes are NOT padded and do not roll into hours',
    // 3661 / 1 = 3661 s = 61:01, not 1:01:01 and not 01:01.
    state: {
      speed: FAST, commandedSpeed: FAST, driveOn: true, targetPos: TARGET,
      targetDistance: 3661, aimOnTarget: true, dropState: 'none', dropMaxSpeed: null,
    },
    expect: {
      speedText: '0.50 c', sublightTag: null, band: 'normal',
      eta: '61:01', drop: null, massLock: null, modeLine: null,
    },
  },
  {
    name: 'aiming at a body with nothing selected — no ETA for a target that is not there',
    // The ETA lives inside the overlay's `if (hasTarget)` block. Without a row
    // where the aim is on something and no target is selected, dropping that
    // outer condition would leave every other row green while the panel counted
    // down to a destination the pilot never picked.
    state: {
      speed: FAST, commandedSpeed: FAST, driveOn: true,
      targetDistance: 50, aimOnTarget: true, dropState: 'none',
    },
    expect: {
      speedText: '0.50 c', sublightTag: null, band: 'normal',
      eta: null, drop: null, massLock: null, modeLine: null,
    },
  },
  {
    name: 'in-window with NO target selected — the label is gated on the target, the band is not',
    // The mirror image of the separator row above. Should not occur upstream
    // (_scDropState returns 'none' without a body) but pins which input drives
    // which output, so the two can never be collapsed into one condition.
    state: { speed: SLOW, commandedSpeed: SLOW, driveOn: true, dropState: 'in-window' },
    expect: {
      speedText: '150 km/s', sublightTag: null, band: 'in-window',
      eta: null, drop: null, massLock: null, modeLine: null,
    },
  },
];

/** The row's state, with the odd extra field folded in. */
const stateOf = (row) => ({ ...row.state, ...(row.stateExtra || {}) });

describe('FlightReadout — the overlay\'s drive/target readout, ported without colour', () => {
  it('says exactly the right thing for every row of the truth table', () => {
    for (const row of ROWS) {
      const { bar, ...text } = buildFlightReadout(stateOf(row));
      expect(text, row.name).toEqual(row.expect);
      // The bar is always present, even on rows that assert nothing about it —
      // otherwise a destructure of a missing field would quietly pass above.
      expect(typeof bar, row.name).toBe('object');
    }
    expect(ROWS.length).toBe(18);   // the whole table ran, not a subset
  });

  it('covers every branch the table claims to cover', () => {
    // Non-vacuity for the table itself. Deleting the only reversing row, or the
    // only massLockHint row, would otherwise silently narrow the suite while
    // every remaining assertion stayed green.
    const states = ROWS.map(stateOf);
    const seen = (fn) => new Set(states.map(fn));

    expect(seen((s) => s.driveOn === false)).toEqual(new Set([true, false]));
    expect(seen((s) => Math.sign(s.speed || 0))).toEqual(new Set([-1, 0, 1]));
    expect(seen((s) => !!s.targetPos)).toEqual(new Set([true, false]));
    expect(seen((s) => s.dropState || 'none'))
      .toEqual(new Set(['none', 'in-window', 'too-fast']));
    expect(seen((s) => !!s.aimOnTarget)).toEqual(new Set([true, false]));
    expect(seen((s) => !!s.massLockHint)).toEqual(new Set([true, false]));
    expect(seen((s) => !!s.flightMode)).toEqual(new Set([true, false]));
    expect(seen((s) => s.dropMaxSpeed != null)).toEqual(new Set([true, false]));

    // And the OUTPUTS actually varied — a builder returning one constant readout
    // would satisfy every input-side check above.
    const outs = ROWS.map((r) => JSON.stringify(buildFlightReadout(stateOf(r))));
    expect(new Set(outs).size).toBeGreaterThan(10);
  });

  it('fills the log bar from the MAGNITUDE, so reverse does not read as stopped', () => {
    // speedToBarFrac takes log10 and clamps, so a negative speed pins it to 0.
    // The overlay passes Math.abs for exactly this reason. Reverse at half light
    // with an EMPTY bar next to a "REV 0.50 c" readout is the failure.
    const fwd = buildFlightReadout({ speed: FAST, driveOn: true }).bar;
    const rev = buildFlightReadout({ speed: -FAST, driveOn: true }).bar;

    expect(fwd.frac).toBeCloseTo(speedToBarFrac(FAST), 12);
    expect(rev.frac).toBeCloseTo(speedToBarFrac(FAST), 12);
    expect(rev.frac).toBe(fwd.frac);
    // Named separately: this is the assertion that dies if Math.abs is dropped,
    // and it must not be able to pass by accident on a speed whose bar is empty.
    expect(rev.frac, 'the reverse bar collapsed to empty — Math.abs was lost')
      .toBeGreaterThan(0.1);
    expect(speedToBarFrac(-FAST), 'fixture check: the raw call really does clamp to 0')
      .toBe(0);
    expect(fwd.bipolar).toBe(false);
  });

  it('switches to the centre-zero sublight scale, signed, when the drive is down', () => {
    // The log bar reads empty across the whole sublight range, so sublight gets
    // its own linear bipolar scale: stop = 0, full reverse = -1, full ahead = +1.
    const fwd = buildFlightReadout({ speed: SLOW, driveOn: false, sublightCap: CAP }).bar;
    const rev = buildFlightReadout({ speed: -SLOW, driveOn: false, sublightCap: CAP }).bar;

    expect(fwd.bipolar).toBe(true);
    expect(fwd.frac).toBeCloseTo(sublightBarFrac(SLOW, CAP), 12);
    expect(fwd.frac).toBeCloseTo(0.1, 12);
    // Signed, NOT abs'd — the sign is what says which way the ship is going, and
    // this is the one scale that can say it.
    expect(rev.frac).toBeCloseTo(-0.1, 12);
    expect(rev.bipolar).toBe(true);

    // A missing cap must not divide by zero into NaN/Infinity — the overlay
    // substitutes 1, and sublightBarFrac clamps a non-positive cap to 0.
    const noCap = buildFlightReadout({ speed: SLOW, driveOn: false, sublightCap: 0 }).bar;
    expect(Number.isFinite(noCap.frac)).toBe(true);
    expect(noCap.frac).toBeCloseTo(sublightBarFrac(SLOW, 1), 12);

    // `driveOn === false` STRICTLY: an absent field is not a dropped drive.
    expect(buildFlightReadout({ speed: SLOW }).bar.bipolar).toBe(false);
    expect(buildFlightReadout({ speed: SLOW }).sublightTag).toBeNull();
    expect(buildFlightReadout({ speed: SLOW, driveOn: false }).sublightTag).toBe('SUBLIGHT');
  });

  it('pins the commanded marker un-abs\'d in supercruise, and the drop tick only when there is one', () => {
    // SUPERCRUISE ONLY — every case below leaves `driveOn` true or absent, so the
    // bar is unipolar throughout. The sublight half of the same two fields is the
    // section further down; the two domains have different right answers and
    // conflating them is the defect that section exists for.
    //
    // The commanded pin is deliberately NOT abs'd: a reverse command pins at the
    // empty end, which is where "you asked for reverse" belongs on a log scale.
    const r = buildFlightReadout({ speed: FAST, commandedSpeed: FAST, driveOn: true });
    expect(r.bar.commandedFrac).toBeCloseTo(speedToBarFrac(FAST), 12);

    const revCmd = buildFlightReadout({ speed: FAST, commandedSpeed: -FAST, driveOn: true });
    expect(revCmd.bar.commandedFrac).toBe(0);
    expect(revCmd.bar.frac).toBeGreaterThan(0);   // and the actual bar still fills

    // No commanded speed at all is 0, not NaN.
    expect(buildFlightReadout({ speed: FAST }).bar.commandedFrac).toBe(0);

    // The tick needs BOTH a target and a ceiling. Null, not 0 — a tick at zero
    // reads as "you must be stopped to drop", which is a different instruction.
    expect(buildFlightReadout({ speed: FAST, targetPos: TARGET, dropMaxSpeed: CEILING })
      .bar.dropTickFrac).toBeCloseTo(speedToBarFrac(CEILING), 12);
    expect(buildFlightReadout({ speed: FAST, targetPos: TARGET }).bar.dropTickFrac).toBeNull();
    expect(buildFlightReadout({ speed: FAST, dropMaxSpeed: CEILING }).bar.dropTickFrac).toBeNull();
    expect(speedToBarFrac(CEILING)).toBeGreaterThan(0);   // fixture: a visible tick
  });

  // ── The bar's two domains ─────────────────────────────────────────────────
  //
  // THE DEFECT THESE WERE WRITTEN FOR, stated once so every test below can be
  // short. `bar.frac` is computed by one of two functions depending on the drive:
  // `speedToBarFrac` (unsigned, 0..1, logarithmic) in supercruise, and
  // `sublightBarFrac` (SIGNED, -1..+1, linear in the cap) sublight. The pin and
  // the tick used to be computed with `speedToBarFrac` unconditionally — so
  // whenever the bar went bipolar, the fill was on one scale and the two marks
  // beside it were on another, and nothing anywhere could notice, because all
  // three are just numbers by the time PhosphorScreen.bar sees them.
  //
  // These tests are about SAFETY CUES, not tidiness. The pin says what the ship
  // has been asked to do and the tick is the drop ceiling. Both were pointing at
  // the wrong place on the glass, in a regime the pilot is in constantly.

  it('THE MEASURED FRAME: reversing sublight, the pin tracks the fill and the tick is gone', () => {
    // The real frame from the lab, verbatim — see MEASURED. This is the exact
    // reading that started the fix, so it is pinned as itself rather than
    // generalised into something prettier that might not be the failing case.
    const bar = buildFlightReadout({
      speed: MEASURED.speed,
      commandedSpeed: MEASURED.commandedSpeed,
      driveOn: false,
      sublightCap: MEASURED.sublightCap,
      targetPos: TARGET,
      dropMaxSpeed: MEASURED.dropMaxSpeed,
      dropState: 'none',
    }).bar;

    expect(bar.bipolar, 'the drive is down, so the bar is the signed sublight one').toBe(true);
    expect(bar.frac).toBeCloseTo(MEASURED_FRAC, 12);

    // The pin, in the SAME domain as the fill. This frame commanded exactly the
    // speed it had, so the two coincide — written as the literal rather than as
    // `bar.frac` so that a builder returning one field twice cannot satisfy it.
    expect(bar.commandedFrac, 'the commanded pin is not on the fill\'s scale')
      .toBeCloseTo(MEASURED_FRAC, 12);

    // And the ceiling mark is simply absent: the ship is already sublight, so
    // there is no drop-out for it to be the ceiling of.
    expect(bar.dropTickFrac, 'a drop-out ceiling was marked on a ship already sublight')
      .toBeNull();

    // ── What the OLD form produced, spelled out. ──
    // These two are fixture checks on SpeedFormat, not on the builder: they are
    // what makes the assertions above non-obvious. Without them a reader has to
    // take it on trust that 0 and 0.274 were ever the answers.
    expect(speedToBarFrac(MEASURED.commandedSpeed),
      'fixture: the log domain really does clamp a reverse command to dead centre')
      .toBe(0);
    expect(speedToBarFrac(MEASURED.dropMaxSpeed),
      'fixture: and really did put the safety tick 27% right of centre')
      .toBeCloseTo(0.2738, 3);
    // The named restatement, so the failure says what went wrong rather than
    // just printing two numbers: a pin near zero means the log domain leaked back.
    expect(bar.commandedFrac, 'the pin is back at dead centre — full reverse reading as full stop')
      .toBeLessThan(-0.4);
  });

  it('puts the pin the other side of centre when the command opposes the motion', () => {
    // The case the measured frame cannot cover, because there the command and the
    // motion agreed. Reversing at half the cap while the throttle asks for
    // three-quarters AHEAD: fill left of zero, pin right of it. That opposition is
    // the single most useful thing a centre-zero bar can show — it is what
    // "decelerating out of a reverse" looks like — and the old form could not
    // draw it at all.
    const bar = buildFlightReadout({
      speed: -0.001, commandedSpeed: 0.0015, driveOn: false, sublightCap: 0.002,
    }).bar;

    expect(bar.frac).toBeCloseTo(-0.5, 12);
    expect(bar.commandedFrac).toBeCloseTo(0.75, 12);
    expect(bar.commandedFrac, 'the forward command collapsed toward the zero mark')
      .toBeGreaterThan(0.5);

    // Sign alone would NOT catch the old form here — speedToBarFrac(0.0015) is a
    // small POSITIVE number, so it lands on the correct side of centre and merely
    // understates the command by a factor of thirty. That near-miss is why this
    // test asserts the magnitude and not just Math.sign.
    expect(speedToBarFrac(0.0015), 'fixture: the old form was positive here too, just tiny')
      .toBeLessThan(0.05);
  });

  it('puts the pin exactly on the zero mark when a stop is commanded, sublight', () => {
    const stop = buildFlightReadout({
      speed: -0.001, commandedSpeed: 0, driveOn: false, sublightCap: 0.002,
    }).bar;
    expect(stop.frac).toBeCloseTo(-0.5, 12);
    expect(stop.commandedFrac).toBe(0);

    // No commanded field at all is a commanded zero, not NaN — `|| 0`, same as
    // the supercruise path.
    const absent = buildFlightReadout({ speed: -0.001, driveOn: false, sublightCap: 0.002 }).bar;
    expect(absent.commandedFrac).toBe(0);

    // THE WEAKNESS OF THIS ROW, said out loud rather than left for a reader to
    // discover: the OLD form also returns 0 here, so neither assertion above can
    // fail on the domain bug. It earns its place anyway — 0 was the answer the
    // broken code gave for EVERY sublight command, and this is the one frame
    // where 0 is the truth. Without it, "the fix moved the wrongness rather than
    // removing it" has nothing standing against it.
    expect(speedToBarFrac(0), 'fixture: both domains agree on a commanded stop').toBe(0);
  });

  it('leaves supercruise entirely alone — fill, pin and tick all still unsigned log', () => {
    // The other direction of the same mistake, and the more dangerous one to
    // ship, because supercruise is where the drop tick actually means something.
    // A bipolar rule leaking up here would put a SIGNED fraction on a bar that
    // fills from the left edge, where everything negative clamps to empty.
    const bar = buildFlightReadout({
      speed: FAST, commandedSpeed: FAST * 0.5, driveOn: true,
      targetPos: TARGET, dropMaxSpeed: CEILING, dropState: 'none',
    }).bar;

    expect(bar.bipolar).toBe(false);
    expect(bar.frac).toBeCloseTo(speedToBarFrac(FAST), 12);
    expect(bar.commandedFrac).toBeCloseTo(speedToBarFrac(FAST * 0.5), 12);
    expect(bar.dropTickFrac).toBeCloseTo(speedToBarFrac(CEILING), 12);

    for (const [name, v] of Object.entries({
      frac: bar.frac, commandedFrac: bar.commandedFrac, dropTickFrac: bar.dropTickFrac,
    })) {
      expect(v, `${name} is outside the unipolar 0..1 domain`).toBeGreaterThanOrEqual(0);
      expect(v, `${name} is outside the unipolar 0..1 domain`).toBeLessThanOrEqual(1);
    }

    // A reverse COMMAND in supercruise still pins at the empty end, un-abs'd —
    // the behaviour the overlay has and the one row that dies immediately if the
    // signed rule is applied unconditionally.
    expect(buildFlightReadout({ speed: FAST, commandedSpeed: -FAST, driveOn: true })
      .bar.commandedFrac, 'a reverse command in supercruise must clamp to the empty end')
      .toBe(0);

    // Non-vacuity: the two domains genuinely disagree about this speed, so the
    // assertions above are distinguishing something rather than agreeing by luck.
    expect(speedToBarFrac(FAST * 0.5)).not.toBeCloseTo(sublightBarFrac(FAST * 0.5, 1), 6);
  });

  it('substitutes the SAME missing cap for the pin as for the fill', () => {
    // `sublightBarFrac` returns 0 for a non-positive cap, so both the overlay and
    // this module substitute 1. The trap is substituting on ONE of the two lines:
    // the fill and the pin then sit on scales that differ by a factor of the cap,
    // which is the same defect arriving through a quieter door. Asserted as a
    // RATIO as well as two values, because the ratio is the thing that survives
    // whatever substitute is chosen.
    for (const cap of [0, undefined, null]) {
      const label = `sublightCap ${cap}`;
      const bar = buildFlightReadout({
        speed: 0.5, commandedSpeed: 0.25, driveOn: false, sublightCap: cap,
      }).bar;

      expect(bar.bipolar, label).toBe(true);
      expect(Number.isFinite(bar.frac), `${label}: fill is not a number`).toBe(true);
      expect(Number.isFinite(bar.commandedFrac), `${label}: pin is not a number`).toBe(true);
      expect(bar.frac, label).toBeCloseTo(sublightBarFrac(0.5, 1), 12);
      expect(bar.commandedFrac, label).toBeCloseTo(sublightBarFrac(0.25, 1), 12);
      expect(bar.commandedFrac / bar.frac,
        `${label}: the pin and the fill are on different scales`).toBeCloseTo(0.5, 12);
    }

    // And a cap that IS present is honoured for both, so the loop above is about
    // the substitution and not about the cap being ignored.
    const real = buildFlightReadout({
      speed: 0.001, commandedSpeed: 0.0005, driveOn: false, sublightCap: 0.002,
    }).bar;
    expect(real.frac).toBeCloseTo(0.5, 12);
    expect(real.commandedFrac).toBeCloseTo(0.25, 12);
  });

  it('emits no drop tick sublight, whatever the target and ceiling say', () => {
    // The tick's THIRD absence condition, exhaustively: with a ceiling, without
    // one, with a target, without one. All null, because `driveOn === false` is
    // on its own sufficient — there is no drop-out to have a ceiling for.
    const sublight = (extra) => buildFlightReadout({
      speed: -0.001, commandedSpeed: -0.001, driveOn: false, sublightCap: 0.002,
      dropState: 'none', ...extra,
    }).bar.dropTickFrac;

    expect(sublight({ targetPos: TARGET, dropMaxSpeed: CEILING }),
      'a target and a ceiling still produce no tick once the drive is down').toBeNull();
    expect(sublight({ targetPos: TARGET, dropMaxSpeed: MEASURED.dropMaxSpeed })).toBeNull();
    expect(sublight({ targetPos: TARGET, dropMaxSpeed: null })).toBeNull();
    expect(sublight({ targetPos: TARGET })).toBeNull();
    expect(sublight({ dropMaxSpeed: CEILING })).toBeNull();
    expect(sublight({})).toBeNull();

    // NULL, NOT ZERO, and the distinction is the instruction: PhosphorScreen.bar
    // skips a non-finite tick, but 0 is perfectly finite and would be drawn — at
    // the centre of a bipolar bar, reading "you must be stopped".
    expect(sublight({ targetPos: TARGET, dropMaxSpeed: CEILING })).not.toBe(0);

    // The same target and the same ceiling DO produce a tick with the drive up,
    // so every row above is the drive's doing and not a broken fixture.
    expect(buildFlightReadout({
      speed: FAST, driveOn: true, targetPos: TARGET, dropMaxSpeed: CEILING, dropState: 'none',
    }).bar.dropTickFrac, 'fixture: the tick exists at all').toBeCloseTo(speedToBarFrac(CEILING), 12);
  });

  it('keeps the LABEL on the raw drop state and the BAND on the wider rule', () => {
    // THE most important distinction in this module, restated on its own so the
    // failure names itself. 'in-window' is returned by main.js's _scDropState()
    // ONLY inside the 10R capture sphere. The bar may lean optimistic on the way
    // in; the label may not, because SAFE TO DROP means "press it now and the
    // drop-out takes", and outside the sphere it does not.
    const approaching = {
      speed: SLOW, driveOn: true, targetPos: TARGET,
      dropState: 'none', dropMaxSpeed: CEILING,
    };
    const r = buildFlightReadout(approaching);
    expect(r.band, 'the bar should already be reading the approach as fine').toBe('in-window');
    expect(r.drop, 'SAFE TO DROP outside the capture sphere is a WRONG SAFETY CUE').toBeNull();

    // Inside the sphere the same speed produces both.
    const inside = buildFlightReadout({ ...approaching, dropState: 'in-window' });
    expect(inside.band).toBe('in-window');
    expect(inside.drop).toEqual(SAFE);

    // too-fast beats the wider rule, matching the overlay's ternary order: a
    // ship under the ceiling that the capture rule calls too fast reads too fast.
    const conflicted = buildFlightReadout({
      speed: SLOW, driveOn: true, targetPos: TARGET,
      dropState: 'too-fast', dropMaxSpeed: CEILING,
    });
    expect(conflicted.band).toBe('too-fast');
    expect(conflicted.drop).toEqual(SLOW_DOWN);

    // THE BOUNDARY ITSELF. The overlay's comparison is `speed <= dropMaxSpeed`,
    // and so is the capture rule's in main.js's _scDropState(). Exactly AT the
    // ceiling the drop-out takes, so the bar must already be reading in-window.
    // Without this, `<=` quietly relaxing to `<` passes every row in the table —
    // no row above sits on the ceiling — while the band flickers to 'normal' on
    // the one frame the pilot is looking for confirmation.
    const onTheCeiling = buildFlightReadout({
      speed: CEILING, driveOn: true, targetPos: TARGET,
      dropState: 'none', dropMaxSpeed: CEILING,
    });
    expect(onTheCeiling.band, 'exactly at the drop ceiling is INSIDE the window')
      .toBe('in-window');
    const justOver = buildFlightReadout({
      speed: CEILING * 1.0001, driveOn: true, targetPos: TARGET,
      dropState: 'none', dropMaxSpeed: CEILING,
    });
    expect(justOver.band, 'a hair over the ceiling is not in the window').toBe('normal');
  });

  it('shows the placeholder rather than "Infinity:NaN" for a distance that is not a number', () => {
    // etaVisible only checks `targetDistance != null`, so Infinity and NaN both
    // get past it and reach the division. The overlay wraps the conversion in
    // `Number.isFinite(secs)` and leaves '--:--' otherwise; the port copies that
    // guard, and no row in the table can exercise it because every row carries a
    // real distance. Dropping the guard therefore leaves the whole suite green
    // while the panel prints 'Infinity:NaN' at the pilot.
    const eta = (targetDistance) => buildFlightReadout({
      speed: FAST, driveOn: true, targetPos: TARGET,
      targetDistance, aimOnTarget: true, dropState: 'none',
    }).eta;

    expect(eta(Infinity), 'an infinite distance must not render as a number').toBe('--:--');
    expect(eta(-Infinity)).toBe('--:--');
    expect(eta(NaN)).toBe('--:--');
    // And the guard is not so wide it eats real answers, including zero.
    expect(eta(100)).toBe('1:40');
    expect(eta(0)).toBe('0:00');
  });

  it('hands back AlertCue\'s shared frozen cue rather than a copy of it', () => {
    // AlertCue promises the cue for a given state is the SAME VALUE every frame,
    // so a panel can stash last frame's and compare by identity to decide whether
    // to re-rasterise an expensive CRT texture. Rebuilding an identical object
    // here would pass every other assertion in this file while making that
    // comparison always report "changed" — a full redraw at 60 Hz.
    const r = buildFlightReadout({
      speed: FAST, targetPos: TARGET, dropState: 'too-fast', massLockHint: true,
    });
    const cue = buildAlertCue({ dropState: 'too-fast', massLockHint: true });
    expect(r.drop, 'identical-looking, but a NEW object').toBe(cue.drop);
    expect(r.massLock, 'identical-looking, but a NEW object').toBe(cue.massLock);
    expect(Object.isFrozen(r.drop)).toBe(true);
  });

  it('fails loudly on a drop state nobody knows, rather than going quietly blank', () => {
    // Inherited from buildAlertCue and worth pinning at this seam too: if
    // main.js renames its enum, the silent failure is a blank approach warning.
    expect(() => buildFlightReadout({ speed: FAST, targetPos: TARGET, dropState: 'in_window' }))
      .toThrow(/in_window/);
    // Absent is not unknown.
    expect(() => buildFlightReadout({ speed: FAST })).not.toThrow();
    expect(buildFlightReadout({}).drop).toBeNull();
  });

  it('renders the mode line from the raw string, uppercased, and nothing else', () => {
    // The overlay draws `MODE: ${state.flightMode.toUpperCase()}` — it does NOT
    // route through flightModeInfo, so neither does this. An unknown mode still
    // prints rather than blanking.
    expect(buildFlightReadout({ flightMode: 'manual' }).modeLine).toBe('MODE: MANUAL');
    expect(buildFlightReadout({ flightMode: 'align' }).modeLine).toBe('MODE: ALIGN');
    expect(buildFlightReadout({ flightMode: 'orbital-cruise' }).modeLine).toBe('MODE: ORBITAL-CRUISE');
    expect(buildFlightReadout({ flightMode: null }).modeLine).toBeNull();
    expect(buildFlightReadout({}).modeLine).toBeNull();
    expect(buildFlightReadout({ flightMode: '' }).modeLine).toBeNull();
  });

  // ── The deliberate divergence ─────────────────────────────────────────────

  it('DIVERGES from the overlay: an off-screen target still gets its warning', () => {
    // SupercruiseHud gates the ETA and BOTH drop labels on this._project(targetPos)
    // returning non-null — the body must be on screen and in front of the camera.
    // Correct for a cue drawn AT the body; wrong for a panel, which is a fixed
    // rectangle of glass in the cabin whose text points at nothing. Carrying the
    // gate across would blank the approach warning exactly when the pilot looks
    // away from the planet they are approaching, which is when they are reading
    // the panel and is the danger the cue exists for.
    //
    // z = +12345 is a body far BEHIND the camera. The overlay draws nothing for
    // it. The panel must speak.
    const behindCamera = { x: 0, y: 0, z: 12345 };
    const r = buildFlightReadout({
      speed: FAST, driveOn: true, targetPos: behindCamera,
      targetDistance: 100, aimOnTarget: true,
      dropState: 'too-fast', dropMaxSpeed: CEILING,
    });
    expect(r.drop, 'the panel went silent on an off-screen target').toEqual(SLOW_DOWN);
    expect(r.eta).toBe('1:40');
    expect(r.band).toBe('too-fast');

    // The same for the safe label, which is the one a pilot acts on.
    const safe = buildFlightReadout({
      speed: SLOW, driveOn: true, targetPos: behindCamera,
      targetDistance: 1, aimOnTarget: false, dropState: 'in-window', dropMaxSpeed: CEILING,
    });
    expect(safe.drop).toEqual(SAFE);

    // The gate we are diverging FROM is really there — if the overlay ever drops
    // it, this comment and this test have gone stale and should be revisited.
    const hud = codeOf(HUD_PATH);
    expect(hud, 'SupercruiseHud no longer projects the target position')
      .toMatch(/const p = this\._project\(state\.targetPos\)/);
    expect(hud, 'SupercruiseHud no longer gates its cue block on the projection')
      .toMatch(/if \(p\) \{/);
  });

  it('DIVERGES from the overlay: the bar\'s marks are read in the bar\'s own domain', () => {
    // THE OVERLAY DOES X HERE AND THE PANEL DELIBERATELY DOES Y.
    //
    // X: SupercruiseHud switches its speed-bar FILL between the two scales inside
    //    an `if (state.driveOn === false) { … } else { … }`, and then computes the
    //    commanded pin and the drop tick AFTER that block, with speedToBarFrac,
    //    unconditionally. Sublight it therefore draws both marks against a scale
    //    they were not computed for — pin at dead centre for a full-reverse
    //    command, drop tick placed off a supercruise ceiling that is fifty times
    //    the sublight cap.
    //
    // Y: this module computes the pin with sublightBarFrac when the bar is
    //    bipolar, and emits NO drop tick at all, because `dropMaxSpeed` is the
    //    ceiling for dropping OUT of supercruise and a ship with the drive down
    //    is not performing that manoeuvre.
    //
    // WHY THE OVERLAY IS NOT ALSO FIXED: it is the live full-screen HUD. Changing
    // it changes what Max sees the next time he flies, in a system this
    // workstream does not own, and the workstream's own contract pins the port as
    // faithful (AC-BASELINE-GREEN). It is his call, and it is written up in the
    // report rather than done quietly here.
    const sublight = {
      speed: MEASURED.speed, commandedSpeed: MEASURED.commandedSpeed,
      driveOn: false, sublightCap: MEASURED.sublightCap,
      targetPos: TARGET, dropMaxSpeed: MEASURED.dropMaxSpeed, dropState: 'none',
    };
    const bar = buildFlightReadout(sublight).bar;
    expect(bar.commandedFrac).toBeCloseTo(MEASURED_FRAC, 12);
    expect(bar.dropTickFrac).toBeNull();

    // ── THE STALENESS GUARD ──
    // Everything above is only a DIVERGENCE while the overlay still has the old
    // form. The day somebody fixes SupercruiseHud, the three paragraphs above and
    // FlightReadout's divergence-2 header stop being true — and a comment that has
    // quietly become a lie is worse than no comment, because the next reader
    // trusts it. So the overlay's present shape is asserted here, the same way the
    // _project() divergence above asserts the projection gate is really there.
    const hud = codeOf(HUD_PATH);

    expect(hud, 'the overlay no longer computes its commanded pin with the log fraction')
      .toMatch(/const pinX = lx \+ barW \* speedToBarFrac\(commandedSpeed\)/);
    expect(hud, 'the overlay no longer computes its drop tick with the log fraction')
      .toMatch(/const tickX = lx \+ barW \* speedToBarFrac\(dropMaxSpeed\)/);

    // ONE call to the signed scale in the whole overlay — the fill, and nothing
    // else. This is the assertion that survives a rewrite of either line above:
    // any real fix to the overlay's pin has to reach for sublightBarFrac, and
    // reaching for it a second time trips this. (The import names it too, but
    // without a paren, so the count is of CALLS.)
    const signedCalls = hud.match(/sublightBarFrac\(/g) || [];
    expect(signedCalls.length,
      'SupercruiseHud now calls the signed scale more than once — it has probably ' +
      'grown a bipolar pin or tick, which means the divergence documented in ' +
      'FlightReadout.js is stale and both comments need revisiting')
      .toBe(1);

    // And the structural half: both marks sit AFTER the whole driveOn if/else,
    // which is what "computed outside the branch" means and what a text match
    // cannot say. Located from the overlay's own source rather than by line
    // number, so an unrelated edit above does not fail this.
    const fillCall = hud.indexOf('sublightBarFrac(speed');
    expect(fillCall, 'the overlay has no bipolar sublight fill any more').toBeGreaterThan(-1);
    const ifArmEnd = closingBraceAfter(hud, fillCall);        // closes `if (driveOn === false) {`
    const elseArmOpen = hud.indexOf('{', ifArmEnd);           // opens `else {`
    const branchEnd = closingBraceAfter(hud, elseArmOpen + 1);

    expect(hud.indexOf('const pinX'),
      'the overlay now computes its pin INSIDE the driveOn branch — it may have been ' +
      'fixed, in which case this divergence no longer exists')
      .toBeGreaterThan(branchEnd);
    expect(hud.indexOf('const tickX'),
      'the overlay now computes its drop tick INSIDE the driveOn branch — see above')
      .toBeGreaterThan(branchEnd);

    // Non-vacuity for the offsets themselves: a `-1` from a failed indexOf is
    // greater than nothing and would make the two checks above meaningless.
    expect(fillCall).toBeLessThan(ifArmEnd);
    expect(ifArmEnd).toBeLessThan(branchEnd);
    expect(branchEnd).toBeLessThan(hud.length);
  });

  it('has no camera, no projection and no screen space in it at all', () => {
    // The structural half of the divergence. A future edit that "restores parity"
    // by reaching for the camera has to get past this.
    const code = codeOf(join(HERE, '..', 'FlightReadout.js'));
    // The browser globals are matched WITH their dot (`window.`, `document.`)
    // rather than as bare words: the drop-window vocabulary this module is full
    // of — 'in-window', IN_WINDOW — contains the word `window` between two word
    // boundaries, and a bare matcher fails a file that is in fact clean.
    for (const banned of [
      /_project\b/, /\.project\(/, /\bcamera\b/, /innerWidth|innerHeight/,
      /getContext|fillText|canvas/i, /\bdocument\s*\./, /\bwindow\s*\./,
    ]) {
      expect(code, `FlightReadout.js reaches for ${banned} — a panel is not world-anchored`)
        .not.toMatch(banned);
    }
  });

  // ── One ink ───────────────────────────────────────────────────────────────

  it('carries NO colour anywhere in any row\'s output, at any depth', () => {
    // The load-bearing test. The overlay distinguishes these same states with
    // #ff7b6b / #7bff9e / #9fe8ff / #ffb84d / #64ff82 / #ffffff, and a port that
    // brought one along breaks Phosphor's one-ink law on the first close approach.
    // Recursive, because a colour nested two levels down (bar.style.color) is
    // exactly what a shallow check misses and what a renderer would honour.
    //
    // Unlike AlertCue this readout legitimately contains numbers (bar fractions),
    // so a blanket "no numbers" rule is not available. Three checks stand in:
    // the text form, the NUMERIC form (0xff7b6b is the overlay's red to the byte,
    // is what three.js wants, and contains no '#' for a text check to find), and
    // colour-ish field NAMES, which catches `tone: 'amber'` — a colour with no
    // hex in it at all.
    const HUD_COLOURS = ['#7bff9e', '#ffb84d', '#ff7b6b', '#9fe8ff', '#64ff82', '#ffffff'];
    const HUD_COLOUR_INTS = HUD_COLOURS.map((h) => parseInt(h.slice(1), 16));
    const COLOUR_KEY = /colou?r|tint|\bink\b|hex|rgb|hsl|fillstyle|strokestyle|palette|shade/i;

    let strings = 0;
    for (const row of ROWS) {
      const readout = buildFlightReadout(stateOf(row));

      walk(readout, 'readout', (value, path) => {
        const isFieldName = path.includes('(key ');
        if (!isFieldName && typeof value === 'string') strings++;

        if (typeof value === 'string') {
          expect(value.startsWith('#'), `${row.name}: ${path}`).toBe(false);
          expect(value, `${row.name}: ${path}`).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
          expect(value, `${row.name}: ${path}`).not.toMatch(/\b(?:rgba?|hsla?)\s*\(/i);
          for (const hex of HUD_COLOURS) {
            expect(value.toLowerCase(), `${row.name}: ${path} carries the HUD ink ${hex}`)
              .not.toContain(hex);
          }
        }

        if (isFieldName) {
          expect(COLOUR_KEY.test(value),
            `${row.name}: field '${value}' at ${path} is a colour channel by name — ` +
            `a one-ink panel has no such field`).toBe(false);
          return;
        }

        if (typeof value === 'number') {
          expect(HUD_COLOUR_INTS, `${row.name}: ${path} = ${value}, which is one of the ` +
            `overlay's inks written as a number`).not.toContain(value);
          expect(Number.isFinite(value), `${row.name}: ${path} is ${value}`).toBe(true);
        }

        // Whatever else it is, it is not a live handle or a function.
        expect(typeof value === 'function', `${row.name}: ${path} is a function`).toBe(false);
      });
    }
    // Never pass vacuously. Counted from the table's own expectations: one
    // speedText and one band per row always, plus each optional line that row
    // says it shows, plus two strings for each cue it raises.
    const expected = ROWS.reduce((n, r) => n + 2
      + (r.expect.sublightTag ? 1 : 0)
      + (r.expect.eta ? 1 : 0)
      + (r.expect.modeLine ? 1 : 0)
      + (r.expect.drop ? 2 : 0)
      + (r.expect.massLock ? 2 : 0), 0);
    expect(strings, 'the walk inspected the wrong number of strings — either the builder ' +
      'stopped producing lines or the readout grew a field the table does not describe')
      .toBe(expected);
    expect(expected).toBeGreaterThan(40);
  });

  it('writes no colour in its own source either, so none can be added by hand', () => {
    // The walk above only sees what these rows produce. This closes the path
    // where a colour sits behind a condition the table does not reach. Comments
    // stripped: the header DISCUSSES the overlay's inks by name.
    const code = codeOf(join(HERE, '..', 'FlightReadout.js'));
    expect(code).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(code).not.toMatch(/\b(?:rgba?|hsla?)\s*\(/i);
    expect(code).not.toMatch(/\bfillStyle\b|\bstrokeStyle\b/);
    expect(code).not.toMatch(/0x[0-9a-fA-F]{6}\b/);
  });

  // ── The words are the overlay's words ─────────────────────────────────────

  it('uses the overlay\'s own literals, character for character', () => {
    // Read as TEXT, not imported: SupercruiseHud's constructor calls
    // document.createElement and this suite runs in plain node with no DOM.
    // Comments stripped so we match what the overlay DRAWS, not what its prose
    // mentions — the file discusses "REV" in a comment two lines above the code.
    const hud = codeOf(HUD_PATH);

    expect(hud, 'the overlay no longer draws SUBLIGHT').toMatch(/fillText\(\s*'SUBLIGHT'/);
    expect(hud, 'the overlay\'s REV prefix changed').toContain("'REV '");
    expect(hud, 'the overlay\'s unknown-ETA placeholder changed').toContain("'--:--'");
    expect(hud, 'the overlay now formats the mode line some other way')
      .toMatch(/MODE: \$\{state\.flightMode\.toUpperCase\(\)\}/);
    expect(hud, 'the overlay no longer zero-pads ETA seconds')
      .toMatch(/padStart\(2, '0'\)/);

    expect(READOUT_TEXT.SUBLIGHT).toBe('SUBLIGHT');
    expect(READOUT_TEXT.REV_PREFIX).toBe('REV ');
    expect(READOUT_TEXT.ETA_UNKNOWN).toBe('--:--');
    expect(READOUT_TEXT.MODE_PREFIX).toBe('MODE: ');
    expect(Object.isFrozen(READOUT_TEXT)).toBe(true);
    expect(Object.isFrozen(SPEED_BAND)).toBe(true);
    expect(new Set(Object.values(SPEED_BAND)).size).toBe(3);
  });

  // ── The adapter ───────────────────────────────────────────────────────────

  it('feeds the same builder from a CockpitSnapshot, field for field', () => {
    // The runtime path and the tested path have to be ONE function, or the truth
    // table above proves something the game does not run.
    const snapshot = buildCockpitSnapshot({
      helm: true,
      flightMode: 'assist',
      scModel: { speed: FAST, throttle: 0.8, driveOn: true },
      commandedSpeed: FAST,
      sublightCap: CAP,
      selectedTarget: { kind: 'planet', name: 'Kepler II' },
      targetDistance: 100,
      aimOnTarget: true,
      drop: { state: 'too-fast', dropMaxSpeed: CEILING, captureSphere: 2 },
      massLockHint: false,
    });

    const viaSnapshot = buildFlightReadout(flightReadoutStateFromSnapshot(snapshot));
    const direct = buildFlightReadout({
      speed: FAST, commandedSpeed: FAST, driveOn: true, sublightCap: CAP,
      targetPos: TARGET, targetDistance: 100, aimOnTarget: true,
      dropState: 'too-fast', dropMaxSpeed: CEILING, massLockHint: false,
      flightMode: 'assist',
    });
    expect(viaSnapshot).toEqual(direct);
    expect(viaSnapshot.drop).toEqual(SLOW_DOWN);
    expect(viaSnapshot.eta).toBe('1:40');
    expect(viaSnapshot.modeLine).toBe('MODE: ASSIST');
    expect(viaSnapshot.sublightTag).toBeNull();
  });

  it('reads "no target" out of a snapshot the way main.js writes it', () => {
    // The snapshot carries NO targetPos, deliberately — it is a live mesh
    // position, the exact reference CockpitSnapshot exists to keep out. What it
    // has is target.distance, which main.js computes as `_scTargetPos ? … : null`
    // and is therefore non-null in exactly the frames targetPos is.
    const noTarget = buildCockpitSnapshot({
      scModel: { speed: SLOW, driveOn: false }, sublightCap: CAP,
    });
    const state = flightReadoutStateFromSnapshot(noTarget);
    expect(state.targetPos).toBeNull();
    expect(state.dropState).toBe('none');

    const r = buildFlightReadout(state);
    expect(r.drop).toBeNull();
    expect(r.eta).toBeNull();
    expect(r.bar.dropTickFrac).toBeNull();
    expect(r.sublightTag).toBe('SUBLIGHT');

    // A SELECTION IS NOT A TARGET. `target.kind`/`target.name` come from
    // `_selectedTarget`; `target.distance` comes from `_scTargetPos`, and those
    // are different feeds that disagree. A selection whose body
    // `_resolveSelectedBody()` can no longer resolve (torn down across a warp,
    // say) leaves kind/name set while `_scTargetPos` — and therefore the
    // overlay's `hasTarget` — is null. If the adapter ORed kind/name in, the
    // panel would count '--:--' toward a body nothing is tracking while the
    // overlay beside it showed nothing at all. Distance is the presence signal.
    const staleSelection = buildCockpitSnapshot({
      scModel: { speed: FAST, driveOn: true },
      selectedTarget: { kind: 'planet', name: 'Kepler II' },
      targetDistance: null,          // main.js: `_scTargetPos ? … : null`
      aimOnTarget: true,
    });
    const stale = flightReadoutStateFromSnapshot(staleSelection);
    expect(stale.targetPos, 'a selection with no tracked position is not a target')
      .toBeNull();
    expect(buildFlightReadout(stale).eta,
      'the panel counted down to a body the overlay is not tracking').toBeNull();

    // The mirror case, which is why the signal cannot be kind/name instead:
    // an autopilot tour has no player selection at all, but `_scTargetPos` falls
    // back to the pilot's target, so the drop window is live and must show.
    const tourOnly = flightReadoutStateFromSnapshot(buildCockpitSnapshot({
      scModel: { speed: SLOW, driveOn: true },
      targetDistance: 3,             // _scTargetPos came from scControls.target
      drop: { state: 'in-window', dropMaxSpeed: CEILING },
    }));
    expect(tourOnly.targetPos, 'the autopilot\'s target is still a target')
      .toBe(TARGET_PRESENT);
    expect(buildFlightReadout(tourOnly).drop).toEqual(SAFE);

    // Distance ZERO is a target, not a missing one — `!= null`, never `||`.
    const onTop = flightReadoutStateFromSnapshot(buildCockpitSnapshot({
      scModel: { speed: SLOW, driveOn: true }, targetDistance: 0,
      drop: { state: 'in-window', dropMaxSpeed: CEILING },
    }));
    expect(onTop.targetPos).toBe(TARGET_PRESENT);

    // A selection with a distance is a target.
    const withTarget = buildCockpitSnapshot({
      scModel: { speed: SLOW, driveOn: true },
      selectedTarget: { kind: 'moon', name: 'Io' },
      targetDistance: 12,
      drop: { state: 'in-window', dropMaxSpeed: CEILING },
    });
    const st = flightReadoutStateFromSnapshot(withTarget);
    expect(st.targetPos).toBe(TARGET_PRESENT);
    expect(buildFlightReadout(st).drop).toEqual(SAFE);

    // The sentinel is a flag, not a fake position — nothing may read x/y/z off it
    // and get a plausible answer.
    expect(Object.isFrozen(TARGET_PRESENT)).toBe(true);
    expect(TARGET_PRESENT.x).toBeUndefined();

    // An empty snapshot still answers, rather than throwing on a panel built
    // before the first frame.
    expect(() => buildFlightReadout(flightReadoutStateFromSnapshot(buildCockpitSnapshot({}))))
      .not.toThrow();
    expect(() => buildFlightReadout(flightReadoutStateFromSnapshot())).not.toThrow();
  });

  it('takes nothing live out of the snapshot — the adapter is plain data', () => {
    // The snapshot's whole contract is "poke it anywhere and the ship does not
    // move". An adapter that passed something through by reference would reopen
    // that at the panel seam.
    const snapshot = buildCockpitSnapshot({
      scModel: { speed: FAST, driveOn: true },
      selectedTarget: { kind: 'planet', name: 'Kepler II' },
      targetDistance: 100,
      drop: { state: 'in-window', dropMaxSpeed: CEILING, captureSphere: 2 },
    });
    const state = flightReadoutStateFromSnapshot(snapshot);
    const isPlain = (v) => {
      const proto = Object.getPrototypeOf(v);
      return proto === Object.prototype || proto === null;
    };
    let leaves = 0;
    walk(state, 'state', (value, path) => {
      if (path.includes('(key ')) return;
      if (value === null) return;
      if (typeof value === 'object') {
        // Containers are allowed; a CLASS INSTANCE is not. A THREE.Vector3 or a
        // BodyRenderer arriving here is the live reference the snapshot exists to
        // keep out, and it looks exactly like a container to a typeof check.
        expect(isPlain(value) || Array.isArray(value),
          `${path} is a ${value?.constructor?.name} — a live handle, not plain data`)
          .toBe(true);
        return;
      }
      leaves++;
      expect(['string', 'number', 'boolean'], `${path} is a ${typeof value}`)
        .toContain(typeof value);
    });
    // Non-vacuity: the walk actually reached the fields, rather than an adapter
    // that returned {} passing by having nothing to inspect.
    expect(leaves).toBeGreaterThan(8);
  });

  it('contains no skip helper, so a missing input can never make it green', () => {
    // The real enforcement already happened at module scope, above — see
    // assertNoSkipHelpers and the reason it cannot live in here. This restates it
    // as a named test so the property shows up in the run output rather than
    // being an invisible side effect of importing the file.
    expect(assertNoSkipHelpers()).toBe(true);
  });
});
