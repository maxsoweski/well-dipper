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
  // `maxMoonsByType` (PlanetGenerator.js:537 `const cloudChance = {`, :560 `const ringChance = {`,
  // :587 `const maxMoonsByType = {`), so each
  // is its own draw pattern.
  ['wd-356', 'type: shattered'],
  ['wd-395', 'type: fungal'],
  ['wd-614', 'type: city-lights'],
  ['wd-2232', 'type: ecumenopolis'],
  // `machine` AND the only terrestrial-moon system found in 6000 seeds.
  // ⛔ THIS COMMENT WAS WRONG TWICE, MEASURED 2026-08-15. The block is clouds (×2),
  // atmosphere (×1), aurora (×3) — MoonGenerator.js:213 `density: rng.range(0.3, 0.55)` through :226 `ringWidth: rng.range(0.08, 0.15)`. SIX draws, not seven; the `color:` entries are literals.
  // ⭐ And this seed does not reach them: its terrestrial moon is `isPlanetMoon`, returns at :124, carries no aurora. The branch is UNWATCHED, not pinned.
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
//   · `retrograde` (MoonGenerator.js:179 `const retrograde = type === 'captured'`, the live conditional draw) NEVER
//     appears as a field. It survives only as the SIGN of `orbitSpeed` (:203 `orbitSpeed: retrograde ? -orbitSpeed : orbitSpeed,`).
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
 * world-engine port, in PlanetGenerator.generate — grep `const condition = conditionFromBody(planetData)`
 * and the `planetData.<field> =` assignments under it. (No line number on purpose: that region is
 * rewritten by every step of one-pipeline-two-frontends-PLAN.md, and it moved on 2026-08-07 when the
 * bake route stopped passing a hand-picked nine-key subset. See §10 of that plan.)
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
 * ⭐ THAT SENTENCE WAS ONLY HALF TRUE UNTIL 2026-08-06 (review P2). Instrument C
 * built its watched set by NAME INTERSECTION with the lab's uniforms, so it saw
 * `landPalette.fresh`/`.sediment` and MISSED `.weathered`, `lavaGlowColor` and
 * `lavaCrustColor` — the game spells those uWeatheredColor / uLavaGlow / uLavaCrust,
 * and the lab spelled the first DIFFERENTLY (`uBaseColor`) while not spelling the other
 * two at all. Three of the four quantities Step 2's own gate names sat outside both
 * instruments. C now matches by VALUE SOURCE; see THE UNIFORM MAP in
 * tools/port-uniform-delta.mjs. If you add a bake here, add it there.
 * ⭐ The drifted spelling was COLLAPSED on 2026-08-06 — the lab now says uWeatheredColor
 * too, so that pair is name-matched rather than aliased. One value, one name, both
 * frontends. The other two remain game-only by construction: the lab renders that
 * emission from an in-shader blackbody, so there is no CPU-side colour uniform to name.
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
// PLANET-CLASS SIDE-CHANNEL
// docs/FEATURES/step8-build-plan-2026-08-12.md §3, commit C1
//
// BODY IDENTITY below compares 16-hex digests, and a digest carries no class.
// So "the only records that moved are planet-class moons" — the containment
// claim Step 8b's gate rests on — was a sentence a human asserted after reading
// a diff. This makes it a partition the test computes and checks.
//
// ⛔ THE PLACEMENT IS THE ENTIRE DESIGN. This map is TOP-LEVEL: on `captureAll`'s
// return, and on the re-blessed baseline. It must NEVER go inside the object
// `captureSystem` hashes into `rollup` (`hash({ system, planets })`). Measured:
// adding a `pc` key inside `planets[]` moves wd-0's rollup
//   e67f7a5184d423ac → 95dbe61d46cc21be
// which reds the NEGATIVE CONTROL's baseline-reproduction assertion at the foot
// of this file and forces a 221-seed re-bless INSIDE the very commit whose gate
// is "no re-bless" — i.e. the side-channel would destroy the control it exists
// to sharpen. And the trap has no partial escape: wd-0 has ZERO planet-class
// moons, so on that seed the forbidden key carries no information whatsoever
// (`[]` or `[false,false,false,false]`) and moves the digest anyway. It is the
// key's PRESENCE in the JSON that moves it, never its value.
//
// ⚠ THE KEYS ARE POSITIONAL — `seed/planetIndex/moonIndex` — because those are
// the coordinates BODY IDENTITY indexes (`was.planets[i].moons[j]`). NOT the
// record's own `_ordinal` (StarSystemGenerator.js `moonData._ordinal =`), which
// looks like the same thing and is not: measured, 16 of these 794 moons carry an
// `_ordinal` whose planet index no longer matches the final `planets[]` order
// (wd-115 planet 0 moon 0 says "5.0"), because moons are stamped before the
// planet array is reordered. Keying off it would attribute a moved hash to a
// different body than the one that moved.
//
// Measured at 09b71a4 over this file's own 221 seeds: 51 planet-class moons in
// 43 systems — 24 of them predate B5.0 and 27 are its binary companions; 6 sit on
// galaxy-context seeds and 2 on pinned ones; wd-27, wd-133, wd-161, wd-166, wd-174,
// wd-1403 and gc-22 carry two each. Listed in generation order, which is the order
// `captureAll` walks its job list.
const PLANET_CLASS_MOONS = [
  'wd-10/3/0', 'wd-11/2/2', 'wd-15/6/1', 'wd-17/3/0', 'wd-20/5/1', 'wd-24/1/2', 'wd-27/1/0', 'wd-27/3/1', 'wd-29/0/0', 'wd-30/5/1', 'wd-31/5/0', 'wd-34/0/0', 'wd-35/2/0',
  'wd-36/2/0', 'wd-40/4/4', 'wd-53/2/0', 'wd-61/1/2', 'wd-66/0/1', 'wd-70/5/5', 'wd-82/2/0', 'wd-91/2/0', 'wd-100/5/1', 'wd-101/4/2', 'wd-116/5/1', 'wd-121/0/0', 'wd-126/4/3',
  'wd-133/4/3', 'wd-133/4/4', 'wd-147/1/2', 'wd-148/1/0', 'wd-153/2/1', 'wd-161/4/1', 'wd-161/5/1', 'wd-166/0/1', 'wd-166/3/1', 'wd-166/3/5', 'wd-168/3/1', 'wd-172/0/0', 'wd-174/0/1',
  'wd-174/1/0', 'wd-181/1/1', 'wd-187/2/1', 'wd-189/0/1', 'wd-1403/1/0', 'wd-1403/2/2', 'gc-0/3/0', 'gc-7/5/0', 'gc-9/1/1', 'gc-19/4/1', 'gc-22/1/0', 'gc-22/2/2',
];

/**
 * Own property names `Object.keys` does NOT return — i.e. the non-enumerable ones.
 *
 * ⭐ THIS IS THE ONLY CHANNEL IN THIS FILE THAT CAN SEE A NON-ENUMERABLE APPEND.
 * Every other channel here is built from `Object.keys` (RECORD SHAPE) or from
 * `JSON.stringify` (every hash, via `canon`), and BOTH skip non-enumerable
 * properties. So
 *     Object.defineProperty(moon, 'massEarth', { value: m, enumerable: false })
 * leaves the draw profile, every body hash and the shape set all green while
 * `moon.massEarth` reads perfectly downstream. That construction is IDIOMATIC in
 * this codebase, not adversarial — it is exactly how the world-engine port
 * attaches `_provenance` (`src/worldengine/port/conditionFromBody.js`
 * `Object.defineProperty(condition, '_provenance', {`), argued there as a
 * feature: "it CANNOT enter any hash… The protection is structural."
 *
 * Which is why Step 8a's RECORD SHAPE gate is INVERTED: once the six derived
 * fields land on the plain moon record, a GREEN shape channel is a FAILURE, not
 * a pass. That inversion is only decidable if something can tell
 *   "shape unchanged because nothing was added"      (a broken 8a)
 * from
 *   "shape unchanged because what was added is invisible"  (break B3).
 * This is that something. Read the two together:
 *   shape green + hidden green ⇒ nothing landed.
 *   shape green + hidden RED   ⇒ the append was non-enumerable. Revert.
 *   shape red   + hidden green ⇒ a plain-assignment append. The correct 8a.
 */
function hiddenOwnKeys(o) {
  const visible = new Set(Object.keys(o));
  return Object.getOwnPropertyNames(o).filter((k) => !visible.has(k));
}

/**
 * Collapse a shape→{plain,planetClass} tally into one class's census.
 * `keyCounts` is an ARRAY of key-counts, one per distinct shape in that class,
 * so a NON-UNIFORM append (some plain moons gaining the six fields and some not,
 * which is what an early return or a conditional derivation in 8a would produce)
 * reports as `shapes: 2, keyCounts: [19, 25]` instead of hiding inside a single
 * number.
 */
function classShapeCensus(tally, which) {
  const mine = [...tally.entries()].filter(([, c]) => c[which] > 0);
  return {
    shapes: mine.length,
    keyCounts: mine.map(([shape]) => shape.split(',').length).sort((a, b) => a - b),
    records: mine.reduce((a, [, c]) => a + c[which], 0),
  };
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
  // Both branches of the LIVE conditional draw, MoonGenerator.js:179 `rng.chance(0.4)`.
  if (moons.some((m) => m.type === 'captured' && m.orbitSpeed < 0)) into.add('retrograde-moon');
  if (moons.some((m) => m.type === 'captured' && m.orbitSpeed > 0)) into.add('captured-prograde');
  if (moons.some((m) => m.type === 'terrestrial')) into.add('terrestrial-moon');
  if (moons.some((m) => m.isPlanetMoon)) into.add('planet-class-moon');
  // `atmosphere === null` ⟺ `atmoPhysics.retained === false` (PlanetGenerator.js:449
  // `if (atmoPhysics.retained) {`), which is the ONLY way PlanetGenerator.js:526
  // `const hasClouds = atmoPhysics.retained && rng.chance(cloudChance[type] || 0);` short-circuits.
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
  const planetClassMoons = [];
  const shapeTally = new Map();   // moon shape string → { plain, planetClass }
  const hiddenBodyKeys = new Set();
  let planetCount = 0;
  let moonCount = 0;
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
    // ⭐ Indexed, because the side-channel's keys must be the SAME coordinates
    // BODY IDENTITY compares. The survey pass is also the right place to derive
    // it: `m.isPlanetMoon` is already in hand here, reading it draws nothing, and
    // nothing this loop touches is hashed into `rollup` — which is exactly why
    // the side-channel can be built here without moving a single digest.
    (s.planets || []).forEach((e, pi) => {
      planetCount++;
      planetShapes.add(Object.keys(planetRecord(e.planetData)).join(','));
      if (!WORLDENGINE_BAKES.every((k) => k in e.planetData)) bakeMisses++;
      for (const k of hiddenOwnKeys(e.planetData)) hiddenBodyKeys.add(`planetData:${k}`);
      (e.moons || []).forEach((m, mi) => {
        moonCount++;
        const shape = Object.keys(moonRecord(m)).join(',');
        moonShapes.add(shape);
        for (const k of hiddenOwnKeys(m)) hiddenBodyKeys.add(`moon:${k}`);
        if (m.planetData && typeof m.planetData === 'object') {
          for (const k of hiddenOwnKeys(m.planetData)) hiddenBodyKeys.add(`moon.planetData:${k}`);
        }
        // `isPlanetMoon` is an ABSENT key on plain moons, never a falsy one
        // (MoonGenerator.js emits it only in `_generatePlanetMoon`'s literal), so
        // this is a presence test, not a `=== false` test.
        const cell = shapeTally.get(shape) || { plain: 0, planetClass: 0 };
        if (m.isPlanetMoon) {
          cell.planetClass++;
          planetClassMoons.push(`${seed}/${pi}/${mi}`);
        } else {
          cell.plain++;
        }
        shapeTally.set(shape, cell);
      });
    });
  }

  return {
    systems,
    classes: [...classes].sort(),
    planetShapes: [...planetShapes].sort(),
    moonShapes: [...moonShapes].sort(),
    // ⛔ TOP-LEVEL, and it stays top-level. See PLANET_CLASS_MOONS above for the
    // measured rollup movement that any placement inside `planets[]` causes.
    planetClassMoons,
    moonShapeCensus: {
      plain: classShapeCensus(shapeTally, 'plain'),
      planetClass: classShapeCensus(shapeTally, 'planetClass'),
    },
    hiddenBodyKeys: [...hiddenBodyKeys].sort(),
    planetCount,
    moonCount,
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
      // ⛔ TOP-LEVEL, deliberately — a sibling of `systems`, never a member of
      // it. Inside `systems` it would red the seed-count assertion below
      // (`Object.keys(baseline.systems).length`); inside a system's `planets[]`
      // it would move every rollup. Neither is reachable from here.
      // ⚠ This key does NOT exist on disk yet and will not until the first
      // re-bless after C1 — the baseline is only ever written by this block, and
      // C1 through C4 are gated on NOT running it. Until then the checked
      // expectation is the PLANET_CLASS_MOONS literal above, which needs no
      // re-bless. Nothing reads `baseline.planetClassMoons`; when it lands it is
      // a new top-level block in that commit's diff, which that commit's gate
      // text must expect.
      planetClassMoons: live.planetClassMoons,
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
      // ⛔ `wd-45` WAS PINNED HERE FOR `atmosphere-null` AND NO LONGER COVERS IT. Break B7's fix
      // (2154de1) gave its hex planet the luminosity of the star it actually orbits, T_eq fell
      // 1023.57 K -> 457.75 K, and the Jeans-escape branch stopped firing. MEASURED across
      // wd-0…wd-1499 (6279 planets): `atmosphere: null` occurred on exactly ONE planet, this one,
      // and only before the fix; after it, on ZERO. The class was never a generation path this
      // fence was covering — it was a single artefact of the defect. The DETECTOR above stays, so
      // the day a genuinely airless planet appears the class returns and this assertion reds.
      // ⚠ The corollary is a real open question and is NOT this pin's to answer: the escape branch
      // at PlanetGenerator.js:470 `if (atmoPhysics.retained) {` is now unreached for planets.
      ['wd-45', null],                                       // kept: the hex swap + retained moon (B7's wd-45/0/0)
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
    let compared = 0;
    for (const seed of Object.keys(baseline.systems)) {
      compared++;
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
    // COUNTED, not merely reported. The loop's own arithmetic is asserted first:
    // a seed dropped from either side is a fence that stopped looking, and the
    // array assertion below cannot see it (an absent seed contributes no entry).
    // 221 = 192 bulk + 5 pinned + 24 galaxy, the same arithmetic asserted above.
    expect(compared, 'seeds compared').toBe(221);
    expect(moved.slice(0, 40), `draw profile moved on ${moved.length} seed(s)`).toEqual([]);
    expect(moved.length, 'seeds whose per-yield draw profile moved').toBe(0);
  });

  it('BODY IDENTITY: every planet and every moon hashes to its baseline', () => {
    // Moons hash their ENTIRE record; planets hash all of planetData except the
    // five world-engine bakes (see WORLDENGINE_BAKES).
    //
    // ⭐ COUNTED AND PARTITIONED, not bare identity. Three assertions, in this
    // order, each failing for a different reason:
    //
    //  1. THE POPULATION, pinned as measured literals. Without it every count
    //     below is a ratio with an unasserted denominator — a generator change
    //     that halves the moon count leaves "0 records moved" perfectly, and
    //     uselessly, green.
    //  2. THE PARTITION. Every moved record is attributed to a planet, a plain
    //     moon or a planet-class moon BEFORE anything is asserted. This is the
    //     point of the commit: a body hash is 16 hex characters and carries no
    //     class, so "the only records that moved are planet-class moons" — the
    //     containment claim Step 8b's gate rests on — used to be a sentence a
    //     human wrote after reading a diff. Now it is a partition the test
    //     checks. Step 8a's prediction ("red on exactly N plain moons, 0
    //     planets, 0 planet-class") is stated by editing the expected object.
    //  3. BYTE IDENTITY, unweakened. The partition is ADDED to the equality, not
    //     substituted for it. A containment assertion on its own ("everything
    //     that moved is planet-class") is satisfied by 24 moved records and
    //     equally by 0 — and the commits between here and 8a gate on byte
    //     identity precisely because it is the strongest statement available
    //     while nothing at all is supposed to move.
    //
    // Population measured at bcb62d1 over this file's 221 seeds. 770 + 24 = 794
    // is asserted as a partition, not two independent numbers, so a moon that is
    // neither cannot hide in the gap.
    expect(
      {
        planets: live.planetCount,
        moons: live.moonCount,
        plain: live.moonCount - live.planetClassMoons.length,
        planetClass: live.planetClassMoons.length,
      },
      'live body population',
    ).toEqual({ planets: 961, moons: 821, plain: 770, planetClass: 51 });

    // The same population, read out of the baseline's OWN per-system counts.
    // This needs no re-bless — those numbers were recorded at b2ac455 — and it
    // is what catches the population drifting and the literals above being
    // "fixed" to match it.
    const onDisk = Object.values(baseline.systems).reduce(
      (a, s) => ({ planets: a.planets + s.system.planets, moons: a.moons + s.system.moons }),
      { planets: 0, moons: 0 },
    );
    expect(onDisk, 'population recorded in the baseline').toEqual({ planets: 961, moons: 821 });

    // The side-channel itself. Pinned as a literal rather than compared against
    // the baseline: `baseline.planetClassMoons` does not exist on disk until the
    // next re-bless, and a `baseline.x && expect(...)` guard would sit green and
    // vacuous through exactly the commits this is built to gate.
    expect(live.planetClassMoons, 'planet-class moon coordinates').toEqual(PLANET_CLASS_MOONS);

    const planetClass = new Set(PLANET_CLASS_MOONS);
    const diffs = [];
    const moved = { systems: 0, planets: 0, plainMoons: 0, planetClassMoons: 0 };
    let compared = 0;
    for (const seed of Object.keys(baseline.systems)) {
      compared++;
      const was = baseline.systems[seed];
      const now = live.systems[seed];
      if (!now) { moved.systems++; diffs.push(`${seed}: MISSING from live capture`); continue; }
      if (now.rollup === was.rollup) continue;

      if (JSON.stringify(now.system) !== JSON.stringify(was.system)) {
        moved.systems++;
        diffs.push(`${seed}: system ${JSON.stringify(was.system)} → ${JSON.stringify(now.system)}`);
      }
      const n = Math.max(was.planets.length, now.planets.length);
      for (let i = 0; i < n; i++) {
        const a = was.planets[i]; const b = now.planets[i];
        if (!a || !b) { moved.planets++; diffs.push(`${seed} planet ${i}: ${a ? 'vanished' : 'appeared'}`); continue; }
        if (a.hash !== b.hash) {
          moved.planets++;
          diffs.push(`${seed} planet ${i} (${a.type}→${b.type}): ${a.hash} → ${b.hash}`);
        }
        const mn = Math.max(a.moons.length, b.moons.length);
        for (let j = 0; j < mn; j++) {
          if (a.moons[j] !== b.moons[j]) {
            const key = `${seed}/${i}/${j}`;
            const cls = planetClass.has(key) ? 'planet-class' : 'plain';
            if (planetClass.has(key)) moved.planetClassMoons++; else moved.plainMoons++;
            diffs.push(`${seed} planet ${i} moon ${j} [${cls}]: ${a.moons[j] ?? '—'} → ${b.moons[j] ?? '—'}`);
          }
        }
      }
    }
    expect(compared, 'seeds compared').toBe(221);
    expect(moved, 'body records moved, partitioned by class').toEqual({
      systems: 0, planets: 0, plainMoons: 0, planetClassMoons: 0,
    });
    expect(diffs.slice(0, 40), `${diffs.length} body record(s) moved`).toEqual([]);
  });

  it('RECORD SHAPE: no field was added to or removed from a body record', () => {
    // Named separately from the value channel so an ADDITIVE field (plan Step 8
    // gives moons a condition record, "derived and never drawn") reports itself
    // by name instead of arriving as an opaque hash mismatch. When Step 8 lands,
    // this test and the value test go red together while the DRAW test stays
    // green — that combination is the proof the addition really was additive.
    //
    // ⭐⭐ AND THAT IS WHY THIS CHANNEL IS INVERTED AT STEP 8a: once the six
    // derived fields land on the plain moon record, a GREEN shape channel is a
    // FAILURE, not a pass. Green can mean two opposite things — nothing landed,
    // or what landed is invisible — and the second is the likelier accident,
    // because attaching a field non-enumerably is idiomatic here (see
    // `hiddenOwnKeys` above). The two are separated below, mechanically.
    //
    // ⛔ These two stay `toEqual` on the shape SETS. A count would be weaker in
    // exactly the wrong place: `moonShapes.length === 2` is satisfied by a
    // non-enumerable append, which is the one construction this channel exists
    // to catch. Set equality is also what makes the failure legible — the diff
    // NAMES the appended keys instead of reporting 2 ≠ 3.
    expect(live.planetShapes).toEqual(baseline.planetShapes);
    expect(live.moonShapes).toEqual(baseline.moonShapes);

    // PARTITIONED. Shape and class are a bijection today: one 19-key shape over
    // all 770 plain moons, one 20-key shape over all 24 planet-class moons (the
    // planet-class shape drops `aurora` and adds `isPlanetMoon` + `planetData`).
    // Stating it this way is what lets 8a's prediction — "the six keys land on
    // the plain shape ONLY" — be checked rather than eyeballed: a correct 8a
    // reads `plain.keyCounts [19] → [25]` with `planetClass` untouched. And
    // `shapes: 1` per class is load-bearing on its own: a NON-UNIFORM append
    // (some plain moons gaining the fields, some not) shows up as
    // `shapes: 2, keyCounts: [19, 25]` rather than silently blessing itself.
    expect(live.moonShapeCensus, 'moon record shapes, partitioned by class').toEqual({
      plain:       { shapes: 1, keyCounts: [25], records: 770 },  // 19 + the six 8a fields, C5 (8a)
      planetClass: { shapes: 1, keyCounts: [20], records: 51 },
    });

    // THE HIDDEN-KEY CHANNEL — the half of the inversion the shape sets cannot
    // see. Measured at bcb62d1: zero non-enumerable own properties on any of the
    // 794 moon records, on any nested `planetData`, or on any of the 961
    // `planetData` records. So every key a body carries is a key the hashes and
    // the shape sets above actually watch, and this asserts that stays true.
    expect(live.hiddenBodyKeys, 'non-enumerable own keys on body records').toEqual([]);

    // …and the control that makes the assertion above mean something. A zero
    // with nothing that moves it is not evidence, so the exact construction is
    // built here and shown to be invisible to every OTHER channel in this file
    // and visible to that one — on every run, rather than once by hand.
    const canary = {};
    Object.defineProperty(canary, 'massEarth', { value: 0.004, enumerable: false });
    expect(Object.keys(canary), 'B3 control: invisible to the shape channel').toEqual([]);
    expect(hash(canon(canary)), 'B3 control: invisible to every hash channel').toBe(hash(canon({})));
    expect(canary.massEarth, 'B3 control: yet fully readable downstream').toBe(0.004);
    expect(hiddenOwnKeys(canary), 'B3 control: and visible to THIS channel').toEqual(['massEarth']);
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
  // PlanetGenerator.js:547 `const hasClouds = atmoPhysics.retained && rng.chance(cloudChance[type] || 0);`
  // and confirm B goes red. That needs a production edit.
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
