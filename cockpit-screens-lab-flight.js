/**
 * cockpit-screens-lab-flight — the SCRIPTED FLIGHT the screens lab plays back.
 *
 * Lane F, workstream `cockpit-screen-content-2026-07-28`. Lab support only: this
 * module is imported by `cockpit-screens-lab.html` and by its test, and by
 * nothing under `src/`. It is at the repo root for the same reason
 * `src/worldengine/base/labCore.js` and `lab-isolation.js` are — a lab's own logic does
 * not belong in the game's source tree, but it still deserves a test.
 *
 * ── WHY A SCRIPT EXISTS AT ALL ──────────────────────────────────────────────
 *
 * The cockpit is not in the game scene yet, so the lab is the only place the
 * four panels can be looked at. But a panel showing nothing is not evidence:
 * "DRIVE renders" is a much weaker claim than "DRIVE renders correctly while the
 * ship climbs through km/s, Mm/s and c, and while it reverses". So the lab needs
 * a ship to watch, and this module is that ship.
 *
 * It is NOT a simulation and does not pretend to be. It is a TIMELINE: a pure
 * function from one number — seconds since the start of the loop — to the exact
 * bag of values `buildCockpitSnapshot` takes from main.js. Nothing integrates,
 * nothing accumulates, nothing is remembered between calls.
 *
 * THAT PURITY IS THE WHOLE DESIGN, and it buys one specific thing: THE SCRUB IS
 * CORRECT BY CONSTRUCTION. A lab that integrated a velocity would give a
 * different picture depending on how you arrived at t = 41 s — scrubbed
 * backwards, played through, or paused and resumed — so a frame Max stopped on
 * to examine would not be a frame anyone could get back to. Here, t is the only
 * input, so the frame at 41 s is the same frame every time it is asked for. The
 * test pins that by name.
 *
 * ── WHAT IS REAL HERE AND WHAT IS STAGED ────────────────────────────────────
 *
 * REAL, imported, never retyped:
 *   - the BODIES. `StarSystemGenerator.generate(seed)` produces the same planets
 *     the game flies through, and the dossier the INFO panel shows is that
 *     planet's own composition / atmosphere / tidal state / T_eq. No lorem ipsum
 *     anywhere; if the generator changes what a `venus`-type world is made of,
 *     this lab shows the new answer with no edit here.
 *   - the NAMES, from `generateSystemNames` — the same generator main.js calls,
 *     so panel text is the length and shape of real names rather than of names
 *     someone picked to fit.
 *   - the PHYSICS FIELD MAPPING. `labPhysicsForPlanet` mirrors main.js's
 *     `planetPhysics` literal field for field, INCLUDING the
 *     `planetData.atmosphere?.physics` read that AC-PANEL-CONTENT was amended
 *     for. Get this wrong and the ATMO row goes blank on every world, which is
 *     exactly the bug that amendment exists to record.
 *   - the DROP WINDOW RULE. `dropStateFor` is main.js's `_scDropState()`,
 *     evaluated over one body, with `DROP_RADIUS_FACTOR`, `DROP_ETA_MAX` and
 *     `DROP_MAX_SPEED_FLOOR` imported from `PILOT_TUNING` rather than written
 *     down. A staged SAFE TO DROP that does not obey the real capture rule would
 *     teach Max to trust a cue the game will not honour.
 *   - the SPEED CEILINGS, from `SC_TUNING` — `speedCap` and `turnRateCap` are
 *     the model's own expressions evaluated over one body.
 *
 * STAGED, and deliberately so: WHERE THE SHIP IS AND HOW FAST IT IS GOING. Those
 * are the timeline's job. They are chosen to walk the panels through every state
 * that has a rendering rule attached, in an order a pilot would actually fly.
 *
 * ── THE ONE STRUCTURAL CHOICE WORTH DEFENDING ───────────────────────────────
 *
 * Everything in the close-approach phases is expressed as a MULTIPLE of the
 * measured capture sphere and drop ceiling, never as an absolute distance or
 * speed. `0.5 * captureSphere`, `3 * dropMaxSpeed`.
 *
 * Both of those derive from the target body's RADIUS, and radius varies by two
 * orders of magnitude across generated worlds. A script written with absolute
 * numbers would show SAFE TO DROP on the seed it was tuned against and nothing
 * at all on the next one — a lab that silently stops demonstrating the thing it
 * exists to demonstrate, on a seed change. Ratios make the transitions
 * seed-independent, and the test asserts that across several seeds.
 */

import { StarSystemGenerator } from './src/generation/StarSystemGenerator.js';
import { generateSystemNames } from './src/generation/NameGenerator.js';
import { SeededRandom } from './src/generation/SeededRandom.js';
import { PILOT_TUNING } from './src/flight/SupercruisePilot.js';
import { SC_TUNING } from './src/flight/SupercruiseModel.js';

/** How long one loop of the script runs, in seconds. */
export const FLIGHT_DURATION_S = 72;

/**
 * The phase boundaries, in seconds. One table, so the segment labels the HUD
 * prints and the ramps below can never describe different timelines — which is
 * the failure where the caption says "REVERSE" over a panel showing a forward
 * speed, and the panel is right.
 */
const T = Object.freeze({
  IDLE_END: 6,        // sublight, sitting still, throttling up
  CLIMB_END: 26,      // drive on, log climb through all three speed tiers
  DECEL_END: 34,      // hard decel toward the target, still outside the sphere
  WINDOW_END: 40,     // crosses INTO the capture sphere, slow → SAFE TO DROP
  TOOFAST_END: 48,    // speeds up inside the sphere → SLOW DOWN
  DROP_END: 56,       // drive off, settling to sublight
  REVERSE_END: 64,    // through zero into reverse → REV prefix
  MASSLOCK_END: 72,   // the drive refuses to re-engage → TOO CLOSE
});

/** When the target is committed. Before this there is no target at all. */
const TARGET_COMMIT_S = 10;

/**
 * The top of the climb, in scene-units/sec. About 120 c — comfortably inside the
 * c tier, well under `SC_TUNING.CAP_MAX`, and far enough above the Mm/s
 * crossover that the c tier is on screen for several seconds rather than
 * flashing past. The exact value is a staging choice; the TIER BOUNDARIES it has
 * to clear are not, and the test checks the crossings rather than this number.
 */
const CLIMB_TOP_SCENE_PER_S = 240;

/** Where the target sits when it is first committed, in scene units (~4 AU). */
const COMMIT_DISTANCE = 4000;

/** The handover distance between the long approach and the close approach. */
const DECEL_END_DISTANCE = 40;

/**
 * The human-readable phases, exported so the lab's HUD can caption the frame Max
 * is looking at. `to` is exclusive; the last segment carries the end of the loop.
 */
export const FLIGHT_SEGMENTS = Object.freeze([
  { from: 0, to: T.IDLE_END, name: 'SUBLIGHT IDLE',
    note: 'drive off — SUBLIGHT tag, bipolar bar, km/s tier' },
  { from: T.IDLE_END, to: T.CLIMB_END, name: 'DRIVE ON / CLIMB',
    note: 'log climb: km/s → Mm/s → c. Target committed at 10 s' },
  { from: T.CLIMB_END, to: T.DECEL_END, name: 'APPROACH / DECEL',
    note: 'shedding speed outside the capture sphere — no drop label yet' },
  { from: T.DECEL_END, to: T.WINDOW_END, name: 'INTO THE WINDOW',
    note: 'crosses the capture sphere slow → SAFE TO DROP (steady)' },
  { from: T.WINDOW_END, to: T.TOOFAST_END, name: 'TOO FAST',
    note: 'speeds up inside the sphere → SLOW DOWN (slow blink)' },
  { from: T.TOOFAST_END, to: T.DROP_END, name: 'DROP TO SUBLIGHT',
    note: 'drive off — the bar goes bipolar, speed settles' },
  { from: T.DROP_END, to: T.REVERSE_END, name: 'REVERSE',
    note: 'through zero into reverse → REV prefix, ETA falls back to --:--' },
  { from: T.REVERSE_END, to: T.MASSLOCK_END, name: 'MASS LOCK',
    note: 'the drive refuses to re-engage → TOO CLOSE (fast blink)' },
].map((s) => Object.freeze(s)));

/** Which body the INFO panel is looking at, over time. */
const FOCUS_SCHEDULE = Object.freeze([
  { from: 0, to: 14, focus: 'planetA' },
  { from: 14, to: 26, focus: 'moon' },     // T_eq / composition / tidal all blank
  { from: 26, to: 34, focus: 'none' },     // every row blank, holding its line
  { from: 34, to: FLIGHT_DURATION_S, focus: 'planetB' },
].map((s) => Object.freeze(s)));

// ── Ramp helpers ────────────────────────────────────────────────────────────

const clamp01 = (u) => Math.min(1, Math.max(0, u));
const lerp = (a, b, u) => a + (b - a) * u;
/** Smoothstep. Ramps that start and stop abruptly read as a glitch, not a burn. */
const smooth = (u) => u * u * (3 - 2 * u);
/** Position within a phase, 0 at its start and 1 at its end. */
const phase = (t, from, to) => clamp01((t - from) / (to - from));

/**
 * Geometric interpolation — the right shape for a speed that spans four decades.
 *
 * A linear ramp from 0.0012 to 240 spends 99.9% of its time in the c tier and
 * crosses both lower tiers in the first few frames, so the km/s and Mm/s
 * readouts would be there and unwatchable. Interpolating the LOGARITHM gives
 * each decade equal time, which is what makes the tier crossings something Max
 * can actually sit and watch happen.
 *
 * Both endpoints must be strictly positive; a zero endpoint has no logarithm and
 * would silently produce NaN, which `formatSpeed` would render as "NaN km/s".
 */
function logLerp(a, b, u) {
  if (!(a > 0) || !(b > 0)) {
    throw new Error(
      `logLerp: both endpoints must be > 0, got ${a} and ${b}. A zero endpoint has no ` +
      `logarithm and would propagate NaN into the speed readout as "NaN km/s".`,
    );
  }
  return a * Math.pow(b / a, u);
}

// ── The drop window: main.js's capture rule, over one body ──────────────────

/**
 * The capture sphere and drop ceiling for a body of this radius.
 *
 * Transcribed from `_scDropState()` in src/main.js, which itself single-sources
 * the two constants from `scPilot.tuning` so the HUD readout and the live
 * capture rule cannot drift. Both are imported here for the same reason: a lab
 * that staged its own SAFE TO DROP threshold would be teaching Max to trust a
 * cue at a distance the game will not honour, which is worse than showing no cue
 * at all.
 *
 * @param {number} radiusScene the target body's radius, in scene units
 * @returns {{captureSphere:number, dropMaxSpeed:number}}
 */
export function dropWindowFor(radiusScene) {
  if (!Number.isFinite(radiusScene) || radiusScene <= 0) {
    throw new Error(
      `dropWindowFor: needs a positive body radius in scene units, got ${radiusScene}. ` +
      `Everything in the close-approach phases is a multiple of the numbers derived here, ` +
      `so a bad radius does not produce a wrong-looking panel — it produces a script that ` +
      `never enters the drop window at all and a lab that silently demonstrates nothing.`,
    );
  }
  const captureSphere = radiusScene * PILOT_TUNING.DROP_RADIUS_FACTOR;
  const dropMaxSpeed = Math.max(
    captureSphere / PILOT_TUNING.DROP_ETA_MAX,
    PILOT_TUNING.DROP_MAX_SPEED_FLOOR ?? 0,
  );
  return { captureSphere, dropMaxSpeed };
}

/**
 * Classify an approach exactly as `_scDropState()` does.
 *
 * Outside the sphere → 'none', whatever the speed. Inside it, slow enough →
 * 'in-window', otherwise 'too-fast'. The comparison is `<=`, matching main.js:
 * a ship sitting exactly on the ceiling is safe to drop, not too fast.
 *
 * @param {{distance:number|null, speed:number, radiusScene:number}} approach
 * @returns {'none'|'in-window'|'too-fast'}
 */
export function dropStateFor({ distance, speed, radiusScene }) {
  if (distance == null) return 'none';
  const { captureSphere, dropMaxSpeed } = dropWindowFor(radiusScene);
  if (distance > captureSphere) return 'none';
  return speed <= dropMaxSpeed ? 'in-window' : 'too-fast';
}

// ── The world: real generated bodies, in the shape a snapshot wants ─────────

/**
 * The physics record main.js builds for a planet, field for field.
 *
 * Copied from src/main.js's `planetPhysics` literal, and the ATMOSPHERE LINE IS
 * THE POINT. main.js used to read `entry.planetData.atmosphereRetained`, a key
 * PlanetGenerator has never emitted, so `physics.atmosphere` was null on every
 * planet in the galaxy and the dossier's ATMO row had never once drawn. That was
 * found building this very panel and the AC was amended for it. If this lab read
 * the old key, the ATMO row would be blank here too and the amendment would look
 * like it had not landed.
 *
 * `surfaceHistory` is deliberately not carried: the snapshot dropped it (it is
 * byte-identical across every planet in a system), and a lab that fed a field no
 * panel reads would be quietly asserting a contract that does not exist.
 */
export function labPhysicsForPlanet(planetData) {
  return {
    composition: planetData?.composition || null,
    atmosphere: planetData?.atmosphere?.physics ?? null,
    tidalState: planetData?.tidalState || null,
  };
}

/**
 * Generate one lab world: a real system, real names, and the two planets plus
 * one moon the script flies between.
 *
 * WHICH BODIES ARE PICKED, and why it is a search rather than an index:
 *
 *   planetA  the first planet that HAS A MOON, because the script's whole middle
 *            section is "focus a moon and watch T_eq, composition and tidal go
 *            blank". A seed whose first planet is moonless would demonstrate
 *            nothing, silently.
 *   planetB  a DIFFERENT planet that has a RETAINED ATMOSPHERE, so the ATMO row
 *            has something in it on at least one of the two dossiers. Falls back
 *            to any other planet if the system has no such world — a system of
 *            airless rocks is a real system, and the honest answer there is a
 *            blank ATMO row, not a fabricated one.
 *
 * Throws if the system has no planet with a moon. That is a loud failure on
 * purpose: the alternative is a lab that comes up looking fine and never shows
 * the blanking rule the moon leg exists to show.
 *
 * @param {string} seed the system seed
 * @param {{x:number,y:number,z:number}} galacticPos where in the galaxy it sits —
 *        the naming generator derives the system's designation from it, so two
 *        lab worlds need two positions or they come out identically named
 * @returns {object} the world the script plays over
 */
export function buildLabWorld(seed, galacticPos) {
  const systemData = StarSystemGenerator.generate(seed);
  const names = generateSystemNames(new SeededRandom(seed), systemData, null, galacticPos);

  const planets = systemData.planets || [];
  const aIndex = planets.findIndex((p) => (p.moons || []).length > 0);
  if (aIndex < 0) {
    throw new Error(
      `buildLabWorld: seed ${JSON.stringify(seed)} generated no planet with a moon. The ` +
      `script focuses a moon specifically to show T_eq, composition and tidal state going ` +
      `BLANK — moons carry none of the three. Without one this lab would run clean and ` +
      `demonstrate nothing. Pick a different seed.`,
    );
  }

  const withAtmo = planets.findIndex((p, i) => i !== aIndex && p.planetData?.atmosphere?.physics);
  const bIndex = withAtmo >= 0
    ? withAtmo
    : planets.findIndex((_, i) => i !== aIndex);

  const planetEntry = (i) => {
    const d = planets[i].planetData;
    return {
      kind: 'planet',
      name: names?.planets?.[i]?.name || `Planet ${i + 1}`,
      data: d,
      physics: labPhysicsForPlanet(d),
      radiusScene: d.radiusScene,
    };
  };

  const moonRaw = planets[aIndex].moons[0];
  const moon = {
    kind: 'moon',
    name: names?.planets?.[aIndex]?.moons?.[0] || 'Moon 1',
    // main.js hands moons their raw generated data with the scene radius swapped
    // in, and — the load-bearing half — hands `BodyRenderer.createMoon` a NULL
    // physics record. So a focused moon has no composition, no atmosphere and no
    // tidal state to read, and carries no T_eq either. All four rows blank, which
    // is the behaviour the INFO panel is supposed to show and this lab is here to
    // let Max confirm by eye.
    data: { ...moonRaw, radius: moonRaw.radiusScene, orbitRadius: moonRaw.orbitRadiusScene },
    physics: null,
    radiusScene: moonRaw.radiusScene,
  };

  const planetA = planetEntry(aIndex);
  const planetB = bIndex >= 0 ? planetEntry(bIndex) : planetA;

  return {
    seed,
    systemName: names?.system || seed,
    galacticPos,
    planetA,
    planetB,
    moon,
    // The body the script is FLYING AT. Its radius sets the capture sphere every
    // close-approach ratio is measured against, so it is named once here rather
    // than re-derived at each use.
    target: { kind: 'planet', name: planetA.name, radiusScene: planetA.radiusScene },
    planetCount: planets.length,
    atmoPlanetFound: withAtmo >= 0,
  };
}

// ── The timeline ────────────────────────────────────────────────────────────

/** Which segment covers this instant. Never null — the table spans the loop. */
export function segmentAt(tSec) {
  const t = wrapTime(tSec);
  return FLIGHT_SEGMENTS.find((s) => t >= s.from && t < s.to) ?? FLIGHT_SEGMENTS[FLIGHT_SEGMENTS.length - 1];
}

/**
 * Fold a time onto the loop.
 *
 * The modulo is written sign-safely — JavaScript's `%` keeps the sign of its
 * left operand, so a scrub handle dragged to a negative value would otherwise
 * land outside every segment and `segmentAt` would fall through to the last one,
 * captioning an idling ship "MASS LOCK".
 */
function wrapTime(tSec) {
  const t = Number.isFinite(tSec) ? tSec : 0;
  return ((t % FLIGHT_DURATION_S) + FLIGHT_DURATION_S) % FLIGHT_DURATION_S;
}

/** Which body is focused at this instant, or null for "nothing focused". */
function focusedAt(t, world) {
  const slot = FOCUS_SCHEDULE.find((s) => t >= s.from && t < s.to);
  switch (slot?.focus) {
    case 'planetA': return world.planetA;
    case 'planetB': return world.planetB;
    case 'moon': return world.moon;
    default: return null;
  }
}

/** Signed speed in scene-units/sec at this instant. */
function speedAt(t, dm) {
  const cap = SC_TUNING.SUBLIGHT_CAP;
  if (t < T.IDLE_END) return cap * 0.6 * smooth(phase(t, 0, T.IDLE_END));
  if (t < T.CLIMB_END) {
    return logLerp(cap * 0.6, CLIMB_TOP_SCENE_PER_S, smooth(phase(t, T.IDLE_END, T.CLIMB_END)));
  }
  if (t < T.DECEL_END) {
    return logLerp(CLIMB_TOP_SCENE_PER_S, dm * 0.6, smooth(phase(t, T.CLIMB_END, T.DECEL_END)));
  }
  // Held flat across the window crossing. The transition Max is watching for is
  // the DISTANCE crossing the sphere; holding the speed keeps that the only
  // thing that moves, so the label change has one unambiguous cause.
  if (t < T.WINDOW_END) return dm * 0.6;
  if (t < T.TOOFAST_END) return lerp(dm * 0.6, dm * 3, smooth(phase(t, T.WINDOW_END, T.TOOFAST_END)));
  if (t < T.DROP_END) return logLerp(dm * 3, cap * 0.5, smooth(phase(t, T.TOOFAST_END, T.DROP_END)));
  if (t < T.REVERSE_END) return lerp(cap * 0.5, cap * -0.7, smooth(phase(t, T.DROP_END, T.REVERSE_END)));
  return lerp(cap * -0.7, cap * 0.4, smooth(phase(t, T.REVERSE_END, T.MASSLOCK_END)));
}

/** Distance to the committed target in scene units, or null before commit. */
function distanceAt(t, cs) {
  if (t < TARGET_COMMIT_S) return null;
  if (t < T.CLIMB_END) {
    return logLerp(COMMIT_DISTANCE, DECEL_END_DISTANCE, smooth(phase(t, TARGET_COMMIT_S, T.CLIMB_END)));
  }
  if (t < T.DECEL_END) {
    return logLerp(DECEL_END_DISTANCE, cs * 1.6, smooth(phase(t, T.CLIMB_END, T.DECEL_END)));
  }
  // THE CROSSING. 1.6 → 0.5 sphere radii: the ship passes through the capture
  // sphere partway along, and because the speed is held flat here that crossing
  // is the sole cause of 'none' → 'in-window'.
  if (t < T.WINDOW_END) return lerp(cs * 1.6, cs * 0.5, smooth(phase(t, T.DECEL_END, T.WINDOW_END)));
  if (t < T.TOOFAST_END) return cs * 0.5;
  if (t < T.DROP_END) return lerp(cs * 0.5, cs * 0.3, smooth(phase(t, T.TOOFAST_END, T.DROP_END)));
  if (t < T.REVERSE_END) return lerp(cs * 0.3, cs * 0.9, smooth(phase(t, T.DROP_END, T.REVERSE_END)));
  return lerp(cs * 0.9, cs * 0.4, smooth(phase(t, T.REVERSE_END, T.MASSLOCK_END)));
}

/** Throttle, -1..1. Mostly cosmetic here, but it is a real snapshot field. */
function throttleAt(t) {
  if (t < T.IDLE_END) return 0.6 * smooth(phase(t, 0, T.IDLE_END));
  if (t < T.CLIMB_END) return 1;
  if (t < T.DECEL_END) return 0.2;
  if (t < T.WINDOW_END) return 0.15;
  if (t < T.TOOFAST_END) return 0.5;
  if (t < T.DROP_END) return 0.25;
  if (t < T.REVERSE_END) return lerp(0.25, -0.7, smooth(phase(t, T.DROP_END, T.REVERSE_END)));
  return lerp(-0.7, 0.4, smooth(phase(t, T.REVERSE_END, T.MASSLOCK_END)));
}

/** The MODE: line's value. Real `FlightMode` strings, not invented ones. */
function flightModeAt(t) {
  if (t < T.CLIMB_END) return 'manual';
  if (t < T.TOOFAST_END) return 'assist';
  return 'manual';
}

/**
 * `SupercruiseModel.speedCap()`, evaluated over the single body the script is
 * flying at. Same three-way max, same constants, imported not retyped.
 */
function speedCapAt(distance, radiusScene) {
  if (distance == null) return SC_TUNING.CAP_MAX;
  const surfaceDist = Math.max(0, distance - radiusScene);
  const c = Math.max(
    SC_TUNING.CAP_MIN_ABS,
    radiusScene * SC_TUNING.CAP_MIN_FRAC,
    surfaceDist / SC_TUNING.ETA_K,
  );
  return Math.min(SC_TUNING.CAP_MAX, c);
}

/** `SupercruiseModel.turnRateCap()` — turn authority shrinks toward the cap. */
function turnRateCapAt(speed, speedCap) {
  const frac = Math.min(1, Math.abs(speed) / Math.max(1e-6, speedCap));
  return SC_TUNING.TURN_RATE_MAX * (1 - (1 - SC_TUNING.TURN_RATE_MIN_FRAC) * frac);
}

/**
 * One instant of the scripted flight, in exactly the shape `buildCockpitSnapshot`
 * takes from main.js.
 *
 * PURE. Same `tSec` and same `world`, same object, forever. See the header for
 * why that is the load-bearing property rather than a nicety.
 *
 * `scModel` is handed over as a DUCK-TYPED STAND-IN — an object with `speed`,
 * `throttle`, `driveOn` and the two cap METHODS — because that is precisely the
 * surface `buildCockpitSnapshot` reads (`typeof scModel?.speedCap === 'function'`).
 * Constructing a real `SupercruiseModel` would need bodies, an orientation and a
 * tick loop to get the same four numbers, and would reintroduce exactly the
 * integration this module exists without.
 *
 * @param {number} tSec seconds into the loop; wrapped, so a scrub cannot escape it
 * @param {object} world from `buildLabWorld`
 * @param {number} [renderDtSec] the real render delta, for anything animating
 * @returns {object} the `sources` bag for `buildCockpitSnapshot`
 */
export function flightSourcesAt(tSec, world, renderDtSec = 1 / 60) {
  const t = wrapTime(tSec);
  const radiusScene = world.target.radiusScene;
  const { captureSphere, dropMaxSpeed } = dropWindowFor(radiusScene);

  const speed = speedAt(t, dropMaxSpeed);
  const distance = distanceAt(t, captureSphere);
  const throttle = throttleAt(t);
  // The drive is on between engaging it and dropping out of it, and at no other
  // time. Written as one expression so the SUBLIGHT tag, the bipolar bar and the
  // sublight speed ramp can never disagree about which regime the ship is in.
  const driveOn = t >= T.IDLE_END && t < T.TOOFAST_END;
  const speedCap = speedCapAt(distance, radiusScene);
  const focusedBody = focusedAt(t, world);

  return {
    simClockMs: t * 1000,
    renderDt: renderDtSec,
    helm: true,
    flightMode: flightModeAt(t),
    tour: false,
    // No warp in this script. The snapshot blanks its whole `survey` block during
    // one (the system it would describe has already been torn down), and staging
    // that would spend a leg of the flight showing an INFO panel that is blank
    // BY DESIGN — indistinguishable, on the glass, from an INFO panel that is
    // blank because it is broken. That state is worth a lab of its own, not a
    // silent eight seconds in this one.
    warping: false,

    scModel: {
      speed,
      throttle,
      driveOn,
      speedCap: () => speedCap,
      turnRateCap: () => turnRateCapAt(speed, speedCap),
    },
    sublightCap: SC_TUNING.SUBLIGHT_CAP,
    // What the throttle is ASKING for, against whichever ceiling is in force.
    commandedSpeed: throttle * (driveOn ? speedCap : SC_TUNING.SUBLIGHT_CAP),

    selectedTarget: distance == null ? null : { kind: world.target.kind, name: world.target.name },
    targetDistance: distance,
    // Aimed at the target for the whole committed leg. Reverse then makes the
    // ETA fall back to '--:--' on its own, through `etaVisible`'s `speed > 0`
    // gate, rather than by the script switching the line off — so what Max sees
    // is the real gate firing, not a staged imitation of it.
    aimOnTarget: distance != null,
    drop: {
      state: dropStateFor({ distance, speed, radiusScene }),
      dropMaxSpeed: distance == null ? null : dropMaxSpeed,
      captureSphere: distance == null ? null : captureSphere,
    },
    massLockHint: t >= T.REVERSE_END,

    focusedBody,

    navLevel: 'system',
    galacticPos: world.galacticPos,
    systemName: world.systemName,

    warpTarget: null,
    warpState: 'idle',
    warpProgress: 0,
    pilotPhase: null,
  };
}
