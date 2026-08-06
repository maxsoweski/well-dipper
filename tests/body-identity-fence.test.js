/**
 * ════════════════════════════════════════════════════════════════════════════
 * INSTRUMENT B — BODY-IDENTITY HASH  (a generation-order fence)
 * docs/FEATURES/one-pipeline-two-frontends-PLAN.md, Step 0
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ⛔ THIS IS **NOT** THE DEFERRED PROCGEN SNAPSHOT. DO NOT DELETE IT AS ONE. ⛔
 *
 * Max deferred *render images* because a captured image pins a half-migrated
 * VISUAL state — you cannot change a shader without re-blessing it, so it goes
 * stale the moment the migration starts moving.
 *
 * This instrument captures no pixels. It hashes the RNG **draw stream** and the
 * **generated body records** that come out of `StarSystemGenerator.generate`.
 * It is invariant to every rendering change — shaders, uniforms, materials,
 * cameras, lights, the whole port — and it moves only when the *generation
 * order* moves. Those are opposite properties. If you are here because a
 * visual change broke a test, this is not the test.
 *
 * ── WHY IT HAS TO EXIST ─────────────────────────────────────────────────────
 * `SeededRandom.child()` draws from its PARENT (`src/generation/SeededRandom.js:95`
 *  — `return new SeededRandom(this.rng() + '-' + suffix)`), so adding, removing
 * or *conditionalising* a single draw anywhere upstream silently rewrites every
 * body downstream of it, with nothing in the codebase to announce it. Plan risk
 * 2 records the measured consequence: shifting `planetRng` by ONE draw changed
 * all four moons of a test planet and flipped one from plain to planet-class.
 *
 * ── THE TWO CHANNELS, AND WHY THERE ARE TWO ─────────────────────────────────
 *  1. `profile` — a SEGMENTED `SeededRandom` draw count: the running total
 *                sampled at every yield of `StarSystemGenerator._generateIterator`
 *                (which yields after the star, after each planet, each moon,
 *                migration, each belt, trojans, the exotic overlay). This is the
 *                *pure* generation-order channel. It is invariant to every
 *                additive, derived, never-drawn field, so a step that only ADDS
 *                a computed field leaves it green — the channel the plan means
 *                when Step 2 says "Instrument B stays GREEN — no new draw was
 *                added."
 *  2. `hashes`  — value hashes over the body records. Catches a stream change
 *                that preserves draw COUNTS (two draws swapped, a range
 *                widened, a distribution retuned), which channel 1 cannot see.
 *
 * A red in 1 and 2 together = the draw stream moved. Red in 2 alone = values
 * moved without the stream moving (a retuned constant, or a derived field).
 * Red in 1 alone means a draw moved somewhere that feeds no body record.
 *
 * ⚠ WHY SEGMENTED AND NOT A SINGLE TOTAL. Measured on `wd-0`: the whole system
 * takes 8903 draws, but the star, all 6 planets and all 4 moons are done by
 * draw 205 — the other 8698 are asteroid-belt particles. A single total is
 * therefore ~98% belt noise, and it is genuinely both correct and useless: an
 * extra draw inserted at index 500 moves the total by exactly +1 and moves NOT
 * ONE BODY, which reads identical to a real body regression. The per-yield
 * profile localises the movement instead of averaging it away.
 *
 * ── RE-BLESSING ─────────────────────────────────────────────────────────────
 *   WD_REBLESS_BODY_IDENTITY=1 npx vitest run tests/body-identity-fence.test.js
 * rewrites tests/baseline/body-identity.json. Per the plan: a re-bless is a
 * NAMED commit that says which step moved the stream and why. Never a reflex.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

import { SeededRandom } from '../src/generation/SeededRandom.js';
import { StarSystemGenerator } from '../src/generation/StarSystemGenerator.js';
import { GalacticMap } from '../src/generation/GalacticMap.js';

const BASELINE_PATH = fileURLToPath(
  new URL('./baseline/body-identity.json', import.meta.url),
);
const REBLESS = process.env.WD_REBLESS_BODY_IDENTITY === '1';

// ─────────────────────────────────────────────────────────────────────────────
// SEED LIST — 221 systems. See designNotes for the coverage argument.
//
//  BULK (192)   `wd-0` … `wd-191`, no galaxy context. Measured to contain 34 of
//               the 40 generation classes this file tracks, at high
//               multiplicity, including the single rarest one in the whole
//               generator (see `wd-45` below). Generating all 192 costs ~75 ms.
//  PINNED (5)   The 6 classes the bulk block misses, covered greedily out of a
//               6000-seed scan. Each is here for a NAMED reason; deleting one
//               removes a whole planet/moon code path from the fence, and the
//               coverage test below will say so by name.
//  GALAXY (24)  `gc-0` … `gc-23`, each with a real `GalacticMap` context, spread
//               0.4 → 17.65 kpc with decorrelated arm phases and three
//               scale-heights. The bulk block passes `galaxyContext = null`,
//               which is NOT the shape production uses; this block exercises the
//               context-fed branches (metallicity, age, star weights, binary
//               modifier) that null skips.
// ─────────────────────────────────────────────────────────────────────────────
const BULK_SEEDS = Array.from({ length: 192 }, (_, i) => `wd-${i}`);

const PINNED_SEEDS = [
  // Rare planet types. Each is its own branch in `cloudChance`/`ringChance`/
  // `maxMoonsByType` (PlanetGenerator.js:516-531, :539-551, :585-594), so each
  // is its own draw pattern.
  ['wd-356', 'type: shattered'],
  ['wd-395', 'type: fungal'],
  ['wd-614', 'type: city-lights'],
  ['wd-2232', 'type: ecumenopolis'],
  // `machine` AND the only terrestrial-moon system found in 6000 seeds.
  // A terrestrial moon is the one moon branch that draws clouds (×2),
  // atmosphere (×1) and aurora (×4) — MoonGenerator.js:186-201. Without this
  // seed the fence never watches seven of the moon generator's draws.
  ['wd-1403', 'type: machine + the only terrestrial moon in 6000 seeds'],
];

// Golden-angle spiral so radius and arm phase are decorrelated; three
// scale-heights so the thin disc, the thick disc and the halo are all reached.
const GALAXY_MASTER_SEED = 'body-identity-fence';
const GALAXY_POSITIONS = Array.from({ length: 24 }, (_, i) => {
  const R = 0.4 + i * 0.75;                   // 0.4 → 17.65 kpc
  const th = i * 2.399963229728653;           // golden angle, radians
  const sign = i % 6 < 3 ? 1 : -1;
  const z = i % 3 === 0 ? 0 : i % 3 === 1 ? 0.15 * sign : 1.4 * sign;
  return { x: R * Math.cos(th), y: R * Math.sin(th), z };
});

// ─────────────────────────────────────────────────────────────────────────────
// WHAT IS HASHED
//
// MOONS: the ENTIRE record, every key, no exceptions (plan requirement — four
// named fields would miss seven of fifteen draws). Two things this catches that
// a named-field set does not:
//   · `retrograde` (MoonGenerator.js:155, the live conditional draw) NEVER
//     appears as a field. It survives only as the SIGN of `orbitSpeed` (:179).
//   · A plain moon promoted to planet-class carries a whole nested `planetData`
//     and drops `aurora` — a different key set entirely (measured: 48 of 1475
//     moons over 400 seeds).
//
// PLANETS: the entire `planetData` record MINUS five keys, listed and justified
// in WORLDENGINE_BAKES below. That is the mandated {radiusEarth, type,
// massEarth} plus 28 more.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The five `planetData` fields that are NOT drawn — they are computed by the
 * world-engine port from `conditionFromPlanet(...)` at PlanetGenerator.js:725-756.
 *
 * They are excluded ON PURPOSE, and the exclusion is the difference between an
 * instrument and a nuisance. Plan Step 2 forwards the real tidal heating and
 * *deliberately moves* exactly these four bakes (`landPalette`, `iceness`,
 * `lavaGlowColor`, `lavaCrustColor` — named at plan §4 Step 2's gate), while
 * its stated gate is "Instrument B stays GREEN — no new draw was added." Hash
 * them here and Step 2 turns B red for a reason that has nothing to do with the
 * RNG stream — a red that is entirely true and entirely misleading, and that
 * gets "fixed" by re-blessing the file, which is how a fence dies.
 *
 * They are not unwatched: Instrument C (shipped-uniform delta) and Step 2's own
 * committed delta table cover them. `iceColor` is the constant `ICE_ALBEDO`.
 *
 * The key-shape test below asserts all five are still PRESENT on every live
 * record, so this list can never quietly become a hole.
 */
const WORLDENGINE_BAKES = [
  'iceColor', 'iceness', 'landPalette', 'lavaCrustColor', 'lavaGlowColor',
];

/** Recursively sort object keys so a literal reorder is not a false red. */
function canon(v) {
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map(canon);
  const out = {};
  for (const k of Object.keys(v).sort()) out[k] = canon(v[k]);
  return out;
}

function hash(v) {
  return createHash('sha256').update(JSON.stringify(v)).digest('hex').slice(0, 16);
}

function planetRecord(pd) {
  const out = {};
  for (const k of Object.keys(pd)) if (!WORLDENGINE_BAKES.includes(k)) out[k] = pd[k];
  return canon(out);
}

function moonRecord(m) {
  const out = {};
  for (const k of Object.keys(m)) {
    out[k] = k === 'planetData' && m[k] && typeof m[k] === 'object'
      ? planetRecord(m[k])   // planet-class moons nest a full planetData
      : m[k];
  }
  return canon(out);
}

// ─────────────────────────────────────────────────────────────────────────────
// DRAW COUNTER — instrumented HERE, in the test, never in production.
//
// Every `SeededRandom` method funnels through `this.rng()`, and `this.rng` is an
// own property assigned in the constructor (SeededRandom.js:15). Defining an
// accessor for `rng` on the PROTOTYPE means that assignment invokes our setter
// instead of creating the own property, so we wrap the Alea function on its way
// in. This counts `child()` too (SeededRandom.js:95 calls `this.rng()`, and the
// child's own constructor re-enters the setter), i.e. the whole tree.
//
// LIMIT, stated rather than discovered: this counts SeededRandom draws only.
// Nine `src/worldengine/**` modules instantiate `alea` directly. Those are
// seeded from condition VALUES, not from the generation stream, so they cannot
// shift it — but they can change body values, which the hash channel sees. The
// two channels cover each other; neither alone is complete.
// ─────────────────────────────────────────────────────────────────────────────
let drawCount = 0;
let perturbAt = null;     // self-test only: inject one extra draw at this index
let counterInstalled = false;

function installDrawCounter() {
  if (counterInstalled) return;
  Object.defineProperty(SeededRandom.prototype, 'rng', {
    configurable: true,
    get() { return this.__wrappedRng; },
    set(fn) {
      this.__wrappedRng = function wrappedRng() {
        drawCount++;
        if (perturbAt !== null && drawCount === perturbAt) {
          perturbAt = null;
          fn();            // ← the injected draw: exactly what adding an
          drawCount++;     //   `rng.range(0,1)` to a generator would do
        }
        return fn();
      };
    },
  });
  counterInstalled = true;
}

function uninstallDrawCounter() {
  if (!counterInstalled) return;
  delete SeededRandom.prototype.rng;
  counterInstalled = false;
}

// ─────────────────────────────────────────────────────────────────────────────
// CAPTURE
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Drives `_generateIterator` rather than `generate` so the draw count can be
 * sampled at each yield. `generate` (StarSystemGenerator.js:139-144) does
 * nothing but drain the same iterator — the parity test below asserts that,
 * so this is not a second code path, it is the same one with a ruler on it.
 */
function captureSystem(seed, ctx) {
  drawCount = 0;
  const it = StarSystemGenerator._generateIterator(seed, ctx);
  const profile = [];
  let r = it.next();
  while (!r.done) { profile.push(drawCount); r = it.next(); }
  profile.push(drawCount);          // last entry is the whole-system total
  const s = r.value;

  const entries = s.planets || [];
  const planets = entries.map((e) => {
    const moonHashes = (e.moons || []).map((m) => hash(moonRecord(m)));
    return {
      type: e.planetData?.type ?? null,
      hash: hash(planetRecord(e.planetData)),
      moons: moonHashes,
    };
  });

  const system = {
    star: s.star?.type ?? null,
    star2: s.star2?.type ?? null,
    binary: !!s.isBinary,
    planets: entries.length,
    moons: entries.reduce((a, e) => a + (e.moons?.length || 0), 0),
    belts: (s.asteroidBelts || []).length,
    trojans: (s.trojanClusters || []).length,
  };

  return { profile, system, planets, rollup: hash({ system, planets }) };
}

/** Generation classes the seed list must keep covering. */
const GIANT_TYPES = ['gas-giant', 'hot-jupiter', 'sub-neptune'];
const PLANET_TYPES = [
  'rocky', 'sub-neptune', 'ice', 'gas-giant', 'lava', 'carbon', 'venus',
  'eyeball', 'hex', 'ocean', 'terrestrial', 'hot-jupiter', 'crystal',
  'shattered', 'fungal', 'machine', 'city-lights', 'ecumenopolis',
];

function classesOfSystem(s, into) {
  const entries = s.planets || [];
  const pds = entries.map((e) => e.planetData);
  const moons = entries.flatMap((e) => e.moons || []);

  if (entries.length === 0) into.add('planetless');
  else {
    into.add('has-planets');
    if (moons.length === 0) into.add('moonless');
  }
  if (moons.length) into.add('has-moons');
  if (moons.length >= 8) into.add('moon-heavy');
  into.add(s.isBinary ? 'binary' : 'single');
  if (pds.some((p) => GIANT_TYPES.includes(p.type))) into.add('giant-bearing');
  // Both branches of the LIVE conditional draw, MoonGenerator.js:155.
  if (moons.some((m) => m.type === 'captured' && m.orbitSpeed < 0)) into.add('retrograde-moon');
  if (moons.some((m) => m.type === 'captured' && m.orbitSpeed > 0)) into.add('captured-prograde');
  if (moons.some((m) => m.type === 'terrestrial')) into.add('terrestrial-moon');
  if (moons.some((m) => m.isPlanetMoon)) into.add('planet-class-moon');
  // `atmosphere === null` ⟺ `atmoPhysics.retained === false` (PlanetGenerator.js:449),
  // which is the ONLY way PlanetGenerator.js:526's `&&` short-circuits.
  if (pds.some((p) => !p.atmosphere)) into.add('atmosphere-null');
  if (pds.some((p) => p.clouds)) into.add('clouds');
  if (pds.some((p) => p.rings)) into.add('rings');
  if (pds.some((p) => p.storms)) into.add('storms');
  if (pds.some((p) => p.aurora)) into.add('aurora');
  if ((s.asteroidBelts || []).length) into.add('belts');
  if ((s.trojanClusters || []).length) into.add('trojans');
  if (s.migrationHistory) into.add('migration');
  if (s.resonanceChain) into.add('resonance');
  if (s.stellarEvolution) into.add('stellar-evolution');
  for (const t of PLANET_TYPES) if (pds.some((p) => p.type === t)) into.add(`type:${t}`);
}

function captureAll() {
  const map = new GalacticMap(GALAXY_MASTER_SEED);
  const systems = {};
  const classes = new Set();
  const planetShapes = new Set();
  const moonShapes = new Set();
  let bakeMisses = 0;

  const jobs = [
    ...BULK_SEEDS.map((s) => [s, null]),
    ...PINNED_SEEDS.map(([s]) => [s, null]),
    ...GALAXY_POSITIONS.map((p, i) => [`gc-${i}`, map.deriveGalaxyContext(p)]),
  ];

  for (const [seed, ctx] of jobs) {
    // captureSystem consumes the stream; re-generate once for the class/shape
    // survey so the draw count is never polluted by the survey itself.
    systems[seed] = captureSystem(seed, ctx);

    const s = StarSystemGenerator.generate(seed, ctx);
    classesOfSystem(s, classes);
    for (const e of s.planets || []) {
      planetShapes.add(Object.keys(planetRecord(e.planetData)).join(','));
      if (!WORLDENGINE_BAKES.every((k) => k in e.planetData)) bakeMisses++;
      for (const m of e.moons || []) moonShapes.add(Object.keys(moonRecord(m)).join(','));
    }
  }

  return {
    systems,
    classes: [...classes].sort(),
    planetShapes: [...planetShapes].sort(),
    moonShapes: [...moonShapes].sort(),
    bakeMisses,
  };
}

// ─────────────────────────────────────────────────────────────────────────────

let live;
let baseline;

beforeAll(() => {
  installDrawCounter();
  live = captureAll();

  if (REBLESS) {
    mkdirSync(dirname(BASELINE_PATH), { recursive: true });
    writeFileSync(BASELINE_PATH, `${JSON.stringify({
      _instrument: 'B — body-identity hash (generation-order fence)',
      _plan: 'docs/FEATURES/one-pipeline-two-frontends-PLAN.md, Step 0',
      _warning: 'NOT the deferred procgen snapshot. No pixels here. See the '
        + 'header of tests/body-identity-fence.test.js before touching this.',
      _rebless: 'WD_REBLESS_BODY_IDENTITY=1 npx vitest run tests/body-identity-fence.test.js',
      _worldengineBakesExcludedFromPlanetHash: WORLDENGINE_BAKES,
      seeds: {
        bulk: BULK_SEEDS,
        pinned: PINNED_SEEDS,
        galaxyMasterSeed: GALAXY_MASTER_SEED,
        galaxy: GALAXY_POSITIONS,
      },
      classes: live.classes,
      planetShapes: live.planetShapes,
      moonShapes: live.moonShapes,
      systems: live.systems,
    }, null, 1)}\n`, 'utf8');
    // eslint-disable-next-line no-console
    console.warn(
      '\n⚠  INSTRUMENT B RE-BLESSED — tests/baseline/body-identity.json was '
      + 'REWRITTEN.\n   Commit it on its own, naming the step that moved the '
      + 'draw stream and why.\n',
    );
  }

  baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
});

afterAll(() => {
  uninstallDrawCounter();
});

describe('Instrument B — body-identity hash (generation-order fence)', () => {
  it('the seed list on disk is the seed list in this file', () => {
    // A silently shortened seed list is a fence that passes because it stopped
    // looking. Caught here rather than by nobody.
    expect(baseline.seeds.bulk).toEqual(BULK_SEEDS);
    expect(baseline.seeds.pinned).toEqual(PINNED_SEEDS);
    expect(baseline.seeds.galaxyMasterSeed).toBe(GALAXY_MASTER_SEED);
    expect(baseline.seeds.galaxy).toEqual(GALAXY_POSITIONS);
    expect(Object.keys(baseline.systems).length)
      .toBe(BULK_SEEDS.length + PINNED_SEEDS.length + GALAXY_POSITIONS.length);
  });

  it('still covers every generation class it was built to cover', () => {
    // "More seeds is cheap; a fence that misses a class is not." If a class
    // disappears from the seed list the fence goes blind to a whole code path
    // WITHOUT going red — so it is asserted, not assumed.
    expect(live.classes).toEqual(baseline.classes);
  });

  it('is measuring the same code path production runs', () => {
    // The profile comes from `_generateIterator`; the game calls `generate`.
    // If those ever diverge the instrument is measuring a ghost, so it is
    // asserted rather than assumed — on one seed of each kind.
    expect(typeof StarSystemGenerator._generateIterator).toBe('function');
    const map = new GalacticMap(GALAXY_MASTER_SEED);
    const cases = [
      ['wd-0', null],
      ['wd-45', null],                                       // atmosphere-null
      ['wd-1403', null],                                     // terrestrial moon
      ['gc-7', map.deriveGalaxyContext(GALAXY_POSITIONS[7])], // galaxy context
    ];
    for (const [seed, ctx] of cases) {
      drawCount = 0;
      const it = StarSystemGenerator._generateIterator(seed, ctx);
      let r = it.next();
      while (!r.done) r = it.next();
      const iterDraws = drawCount;

      drawCount = 0;
      const viaGenerate = StarSystemGenerator.generate(seed, ctx);
      expect(drawCount, `${seed}: generate() draw total`).toBe(iterDraws);
      expect(hash(canon(viaGenerate)), `${seed}: generate() output`)
        .toBe(hash(canon(r.value)));
    }
  });

  it('DRAW STREAM: the per-yield draw profile is unchanged for every seed', () => {
    // ⭐ THE PRIMARY CHANNEL. Red here means a draw was added, removed or
    // conditionalised. Everything downstream of it in the stream is now a
    // different body. Invariant to derived, never-drawn fields.
    //
    // The profile index tells you WHERE: index 0 is the star, then one entry
    // per planet and per moon, then migration, the belts, trojans and the
    // exotic overlay. A change that starts at the belt index and leaves the
    // body indices alone is a belt change, not a body regression — and the
    // hash channel below will agree by staying green.
    const moved = [];
    for (const seed of Object.keys(baseline.systems)) {
      const was = baseline.systems[seed].profile;
      const now = live.systems[seed]?.profile;
      if (JSON.stringify(was) === JSON.stringify(now)) continue;
      if (!now) { moved.push(`${seed}: MISSING from live capture`); continue; }
      const at = was.findIndex((v, i) => v !== now[i]);
      moved.push(
        `${seed}: first divergence at yield ${at < 0 ? was.length : at} `
        + `(${was[at] ?? '—'} → ${now[at] ?? '—'}); `
        + `total ${was[was.length - 1]} → ${now[now.length - 1]}`,
      );
    }
    expect(moved.slice(0, 40), `draw profile moved on ${moved.length} seed(s)`).toEqual([]);
  });

  it('BODY IDENTITY: every planet and every moon hashes to its baseline', () => {
    // Moons hash their ENTIRE record; planets hash all of planetData except the
    // five world-engine bakes (see WORLDENGINE_BAKES).
    const diffs = [];
    for (const seed of Object.keys(baseline.systems)) {
      const was = baseline.systems[seed];
      const now = live.systems[seed];
      if (!now) { diffs.push(`${seed}: MISSING from live capture`); continue; }
      if (now.rollup === was.rollup) continue;

      if (JSON.stringify(now.system) !== JSON.stringify(was.system)) {
        diffs.push(`${seed}: system ${JSON.stringify(was.system)} → ${JSON.stringify(now.system)}`);
      }
      const n = Math.max(was.planets.length, now.planets.length);
      for (let i = 0; i < n; i++) {
        const a = was.planets[i]; const b = now.planets[i];
        if (!a || !b) { diffs.push(`${seed} planet ${i}: ${a ? 'vanished' : 'appeared'}`); continue; }
        if (a.hash !== b.hash) diffs.push(`${seed} planet ${i} (${a.type}→${b.type}): ${a.hash} → ${b.hash}`);
        const mn = Math.max(a.moons.length, b.moons.length);
        for (let j = 0; j < mn; j++) {
          if (a.moons[j] !== b.moons[j]) {
            diffs.push(`${seed} planet ${i} moon ${j}: ${a.moons[j] ?? '—'} → ${b.moons[j] ?? '—'}`);
          }
        }
      }
    }
    expect(diffs.slice(0, 40), `${diffs.length} body record(s) moved`).toEqual([]);
  });

  it('RECORD SHAPE: no field was added to or removed from a body record', () => {
    // Named separately from the value channel so an ADDITIVE field (plan Step 8
    // gives moons a condition record, "derived and never drawn") reports itself
    // by name instead of arriving as an opaque hash mismatch. When Step 8 lands,
    // this test and the value test go red together while the DRAW test stays
    // green — that combination is the proof the addition really was additive.
    expect(live.planetShapes).toEqual(baseline.planetShapes);
    expect(live.moonShapes).toEqual(baseline.moonShapes);
  });

  it('the excluded world-engine bakes are still present on every planetData', () => {
    // Keeps WORLDENGINE_BAKES an exclusion rather than a hole: if one of the
    // five stops being emitted, the planet hash would not notice, so this does.
    expect(live.bakeMisses).toBe(0);
  });

  // ── NEGATIVE CONTROL ──────────────────────────────────────────────────────
  // "A gate that has never failed is not a gate." (plan, Step 0 gate)
  //
  // The plan's manual version is: insert a throwaway `rng.range(0,1)` before
  // PlanetGenerator.js:526 and confirm B goes red. That needs a production edit.
  // This does the same thing from inside the test — the wrapper burns one extra
  // value out of the Alea stream at a chosen draw index, which is bit-for-bit
  // what an added `rng.range(0,1)` would do — so the proof runs on every CI run
  // instead of once, by hand, in a session nobody remembers.
  it('NEGATIVE CONTROL: one extra draw turns both channels red', () => {
    // Perturb at draw 40 — inside `wd-0`'s BODY region (its star + 6 planets +
    // 4 moons are complete by draw 205; everything after that is belt
    // particles). Perturbing at 500 instead moves the total by +1 and moves no
    // body at all, which is precisely the "correct and useless" measurement
    // this file is built to avoid; the segmented profile is what makes the
    // distinction visible.
    const seed = 'wd-0';
    const before = baseline.systems[seed];
    const PERTURB_AT = 40;
    expect(before.profile[0], 'perturbation must land inside the body region')
      .toBeLessThan(PERTURB_AT * 4);

    perturbAt = PERTURB_AT;
    const after = captureSystem(seed, null);
    perturbAt = null;

    expect(after.profile, 'draw channel must move').not.toEqual(before.profile);
    expect(after.rollup, 'hash channel must move').not.toBe(before.rollup);

    // And specifically: a moon must move. That is the failure plan risk 2
    // describes ("shifting planetRng by ONE draw changed all 4 moons of a test
    // planet"), and it is the reason the whole moon record is hashed.
    const flatMoons = (cap) => cap.planets.flatMap((p) => p.moons).join('|');
    expect(flatMoons(after), 'at least one moon record must move')
      .not.toBe(flatMoons(before));

    // Sanity: with the perturbation off, the same call reproduces the baseline.
    expect(captureSystem(seed, null).rollup).toBe(before.rollup);
  });
});
