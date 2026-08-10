#!/usr/bin/env node
// tools/port-uniform-delta.mjs — INSTRUMENT C of docs/FEATURES/one-pipeline-two-frontends-PLAN.md
// (Step 0, plan lines 147 and 158).
//
//   "Shipped-uniform delta harness — that a change to the port did not silently move a pixel that
//    already ships."
//
// Run:
//   node tools/port-uniform-delta.mjs --record          # capture the current tree
//   node tools/port-uniform-delta.mjs --check           # compare the current tree to the capture
//   node tools/port-uniform-delta.mjs --check --allow-deltas   # declared pixel-moving step: report, exit 0
//   node tools/port-uniform-delta.mjs --record --force  # overwrite an existing capture (deliberate)
//   node tools/port-uniform-delta.mjs --list            # print the shared-uniform resolution and stop
//   node tools/port-uniform-delta.mjs --selftest        # negative control: prove the gate still bites
//   node tools/port-uniform-delta.mjs --check-citations  # the CITATION FENCE: resolve every
//                                                        # `file:NNN `symbol`` ref in the port's
//                                                        # reasoning files and fail if the symbol
//                                                        # is not on that line (findings 5 + 6)
//
// Exit codes:  0 ok · 1 shipped uniforms moved · 2 structural break (basis changed, or a broken
//              citation) · 3 selftest
//              failed · 64 usage · 65 refused to overwrite a capture · 66 no capture · 69 a game
//              module would not load · 70 population is not deterministic
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// ⛔ THE ONE CONSTRAINT THIS TOOL EXISTS TO OBEY — plan §6 risk 5 (PLAN.md:548)
// ─────────────────────────────────────────────────────────────────────────────────────────────
// EVERY comparison this tool makes is SAME-TREE-BEFORE vs SAME-TREE-AFTER, on the SAME BODY
// RECORD — the game route measured against itself across a code change. It is NEVER lab-vs-game
// and NEVER keyed by preset NAME.
//
// Why that matters more than it sounds. The lab and the game build the world engine's input
// differently: fed the same nominal body they disagree by 3–6× on T_eq (Venus 737 K lab /
// 2345 K game; Jovian 125 / 776) and by 5–7 ORDERS OF MAGNITUDE on tidal heat (Europa 137 /
// 0.0019) — see PLAN.md:24-26. A lab-vs-game "max delta 0" gate therefore fails on day one, for
// reasons that have nothing to do with any extraction, and that false red looks EXACTLY like a
// broken change. It burns a session and it teaches the next reader to distrust the gate.
//
// Enforced mechanically, not just promised:
//   * planet-lod-uniforms.js is imported for its KEYS ONLY. Its VALUES are read exactly once, to
//     record each uniform's declared kind/arity for a shape-drift check — they are NEVER
//     differenced against a game value. See resolveSharedUniforms().
//   * Bodies are matched between capture and check by a fingerprint of the INPUT RECORD, not by
//     name, type, index or preset. A body whose record moved is reported as a POPULATION
//     MISMATCH and its uniforms are excluded from the delta table, because a delta measured
//     across two different bodies is a number that is entirely true and entirely misleading.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// WHAT IS MEASURED
// ─────────────────────────────────────────────────────────────────────────────────────────────
// The REAL production material, not a transcription of it: every body is passed through
// `new Planet(sceneData)` — Planet.js:1519 `constructor(planetData, starInfo = null) {` — and the
// uniforms are read off `planet.surface.material.uniforms`.
// Planet.js:1548 `_createSurface() {` (body :1548-1716) is the only place in the
// game that turns a condition into shipped shader numbers; re-deriving it here would create a
// second copy of exactly the law this plan is removing, and the copy would drift silently.
//
// The watched set starts from a RUNTIME name intersection against makeUniforms()'s keys
// (planet-lod-uniforms.js:8 `export function makeUniforms(WORLD_LIGHT) {`) — 28 names — and is
// then widened by an EXPLICIT VALUE-SOURCE MAP
// (see "THE UNIFORM MAP" below). A pure name intersection was the instrument's own blind spot:
// it watched uFreshColor and uSedColor and MISSED the weathered endmember, which the game spelled
// uWeatheredColor and the lab spelled uBaseColor, and which is the single largest contributor to a
// rocky body's surface colour. The tool prints what it actually resolved, prints the COMPOSITION of
// that set, and --check fails loudly if the SET changes between record and check.
// ⭐ THE SPELLINGS WERE UNIFIED ON 2026-08-06 (the lab now says uWeatheredColor too), so that one
// pair is name-matched today — which is why the map still exists rather than being deleted with it:
// the map is what makes a RE-divergence loud instead of silent. See UNIFIED NAMES below.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// WHAT THIS TOOL DELIBERATELY DOES NOT DO
// ─────────────────────────────────────────────────────────────────────────────────────────────
//  * No epsilon. No tolerance. No "close enough". Requirement: deltas are reported even when
//    small — the tool reports, a human decides. There is no threshold anywhere below which a
//    moved uniform is re-labelled "unchanged".
//  * No aggregate score. Stats are per-uniform. One mean over 27 uniforms hides the one that
//    moved, which is the entire failure mode this instrument was built for (plan §6 risk 6:
//    limbExponent moved on 222/225 gas bodies while every obvious gate read ZERO shipped
//    uniforms and passed green — PLAN.md:549).
//  * No rendering, no WebGL, no screenshot. Uniform VALUES only. A uniform can be non-default and
//    still produce nothing on screen (plan §6 risk 13); this tool measures the number, not the
//    pixel, and says so.
//  * No Sol. Sol renders from 18 NASA textures through a different renderer and carries no
//    world-engine condition fields, so a Sol body cannot validate any procgen claim. The
//    population is generated bodies only.

import { registerHooks } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

// `motion-test-kit` is a Vite alias (vite.config.js:37), not a node_modules package, and
// src/util/scene-naming.js:20 imports it — which Planet.js pulls in transitively. Node has no
// alias table, so the tool installs the same prefix rewrite Vite does. Synchronous in-thread
// hook; the game modules are therefore loaded by dynamic import BELOW this call, not by a
// hoisted static import.
const MTK = 'motion-test-kit';
registerHooks({
  resolve(spec, ctx, next) {
    if (spec === MTK || spec.startsWith(MTK + '/')) {
      return {
        url: pathToFileURL(path.join(ROOT, 'vendor', MTK, spec.slice(MTK.length))).href,
        shortCircuit: true,
      };
    }
    return next(spec, ctx);
  },
});

// Loaded through a labelled wrapper because of plan §6 risk 10 (PLAN.md:553): a prose backtick
// inside a GLSL template literal TERMINATES THE STRING, and Planet.js imports two such files
// (heightNoise.glsl.js, craterRelief.glsl.js). Under vitest that shows up as a suite which stops
// COLLECTING — 0 failures against N failed FILES — which a failure COUNT cannot see. Under node it
// is a bare SyntaxError stack with no hint of what it means. Naming it here costs four lines and
// saves the next reader the twenty minutes it cost this one.
async function loadOrExplain(rel) {
  try {
    return await import(pathToFileURL(path.join(ROOT, rel)).href);
  } catch (e) {
    console.error(`⛔ INSTRUMENT C COULD NOT LOAD ${rel}`);
    console.error(`   ${e && e.message}`);
    if (e instanceof SyntaxError) {
      console.error('   A SyntaxError in (or under) a shader module is the prose-backtick signature:');
      console.error('   a ` inside a /* glsl */ `...` literal ends the string early. Plan §6 risk 10.');
      console.error('   Check the file named in the stack above, not this tool.');
    }
    console.error('   No delta was measured. This is NOT "zero delta".');
    process.exit(69);
  }
}

const { Planet } = await loadOrExplain('src/objects/Planet.js');
const { PlanetGenerator } = await loadOrExplain('src/generation/PlanetGenerator.js');
const { StarSystemGenerator } = await loadOrExplain('src/generation/StarSystemGenerator.js');
const { SeededRandom } = await loadOrExplain('src/generation/SeededRandom.js');
const { makeUniforms } = await loadOrExplain('planet-lod-uniforms.js');
const THREE = await import('three');

// ═════════════════════════════════════════════════════════════════════════════════════════════
// POPULATION
// ═════════════════════════════════════════════════════════════════════════════════════════════
// Three strata. Every one is a pure function of an integer seed — no wall clock, no
// Math.random, no filesystem state — so --record and --check enumerate byte-identically. The
// parameters are WRITTEN INTO the capture and read back out on --check, so editing the defaults
// below cannot silently re-define the population under an existing baseline.
//
//  S — SYSTEM  : StarSystemGenerator.generate(seed) for seed 1..sysSeeds. Every planet of every
//                system, in generation order. This is the shipped population and the shipped
//                distribution: whatever mix of types and orbits the galaxy actually produces,
//                including the MOON-BEARING giants (a planet's moon count is part of its record,
//                and it is gas giants and sub-neptunes that carry the large retinues).
//  P — PLANET-CLASS MOONS: the ~3.5% of moons that reach Planet.js today (PLAN.md:396) do so via
//                main.js:7573 `new Planet(scenePMData, pmStarInfo)`. They are RARE — MoonGenerator.js:99
//                gates them on a gas-giant/sub-neptune parent with ≥3 moons, non-innermost slot,
//                at rng.chance(0.10), which measured ~1 per 40 systems. Harvesting them out of
//                the S stratum alone would give 2-3 bodies. So a wider seed sweep (1..pmScanSeeds)
//                is run for planet-class moons ONLY; their parents are not re-added.
//  G — GRID    : PlanetGenerator.generate(rng, au, null, null, forceType) over all 18 types ×
//                an orbit ladder. Coverage insurance: the S stratum's type mix is whatever the
//                galaxy rolls, and measured over 40 systems it produced 1 terrestrial and 2
//                ocean bodies. A uniform that only moves on a rare type would sit under the
//                sampling noise of a purely natural population.
const DEFAULT_POP = {
  sysSeeds: 90,        // → ~370 planets
  pmScanSeeds: 1000,   // → ~25 planet-class moons
  gridSeed: 20260806,
  gridOrbitsAU: [0.35, 0.9, 2.0, 6.0, 18.0],  // hot / habitable / warm / snowline / cold
};

// main.js does NOT hand the generator's record straight to Planet. It scene-scales it first, and
// two of the 27 shared uniforms ride on that scaling (uNoiseScale, and via `radius` nothing
// shared — but `radius` is what makes the noise scaling meaningful). Transcribed from:
//   src/main.js:6261-6118  (planets)
//   src/main.js:6329-6186  (planet-class moons; identical shape, pmRatio spelled separately)
// ⚠ THIS IS A TRANSCRIPTION and therefore a drift risk of exactly the kind this plan exists to
// remove. It is here rather than imported because main.js is a 10k-line browser entry point with
// no exported seam for it. If main.js's scaling law changes and this does not, uNoiseScale in
// this harness stops describing a shipped pixel. Named so the next reader can check it in ten
// seconds rather than trusting it.
function toSceneData(rec) {
  const ratio = rec.radius / rec.radiusScene;
  if (!Number.isFinite(ratio) || ratio <= 0) {
    throw new Error(`toSceneData: radius/radiusScene is not finite-positive (${rec.radius}/${rec.radiusScene}). `
      + 'main.js:7486 `const mapToSceneRatio` assumes both exist on every body it renders.');
  }
  return {
    ...rec,
    radius: rec.radiusScene,
    noiseScale: rec.noiseScale * ratio,
    clouds: rec.clouds ? { ...rec.clouds, scale: rec.clouds.scale * ratio } : null,
  };
}

function buildPopulation(pop) {
  const bodies = [];

  // ── S: systems ─────────────────────────────────────────────────────────────────────────────
  for (let seed = 1; seed <= pop.sysSeeds; seed++) {
    const sys = StarSystemGenerator.generate(seed);
    sys.planets.forEach((entry, pi) => {
      const moons = entry.moons || [];
      bodies.push({
        id: `S:${String(seed).padStart(5, '0')}:p${pi}`,
        stratum: 'S',
        type: entry.planetData.type,
        moonCount: moons.length,
        rec: toSceneData(entry.planetData),
      });
    });
  }

  // ── P: planet-class moons ──────────────────────────────────────────────────────────────────
  for (let seed = 1; seed <= pop.pmScanSeeds; seed++) {
    const sys = StarSystemGenerator.generate(seed);
    sys.planets.forEach((entry, pi) => {
      (entry.moons || []).forEach((m, mi) => {
        if (!m.isPlanetMoon || !m.planetData) return;
        bodies.push({
          id: `P:${String(seed).padStart(5, '0')}:p${pi}:m${mi}`,
          stratum: 'P',
          type: m.planetData.type,
          moonCount: 0,
          rec: toSceneData(m.planetData),
        });
      });
    });
  }

  // ── G: forced-type grid ────────────────────────────────────────────────────────────────────
  // One SeededRandom per (type, orbit) cell so a change in draw count inside one cell cannot
  // shift every later cell's body — this stratum is coverage, not a draw-stream fence
  // (that is Instrument B's job, tests/body-identity-fence.test.js).
  let cell = 0;
  for (const type of PlanetGenerator.TYPES) {
    for (const au of pop.gridOrbitsAU) {
      const rng = new SeededRandom(pop.gridSeed + cell * 7919);
      cell++;
      let rec;
      try {
        rec = PlanetGenerator.generate(rng, au, null, null, type);
      } catch (e) {
        // Recorded, not swallowed: a type that cannot be forced at an orbit is a real fact about
        // the generator and the operator should see it rather than a silently shorter population.
        bodies.push({ id: `G:${type}:${au}`, stratum: 'G', type, moonCount: 0, rec: null, error: String(e && e.message || e) });
        continue;
      }
      bodies.push({
        id: `G:${type}:${au.toFixed(2)}au`,
        stratum: 'G',
        type: rec.type,
        moonCount: 0,
        rec: toSceneData(rec),
      });
    }
  }

  return bodies;
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
// UNIFORM RESOLUTION + VALUE FLATTENING
// ═════════════════════════════════════════════════════════════════════════════════════════════

// A THREE uniform value can be a number, an int, a Vector2/3/4, a Color, an array of vectors, or
// a typed array. Flatten to a plain number list plus a KIND tag. Unknown shapes throw rather than
// coerce — a silently-coerced uniform is a uniform whose delta is meaningless.
function kindOf(v) {
  if (typeof v === 'number') return 'number';
  if (typeof v === 'boolean') return 'boolean';
  if (v && typeof v === 'object') {
    if (v.isColor) return 'Color';
    if (v.isVector4) return 'Vector4';
    if (v.isVector3) return 'Vector3';
    if (v.isVector2) return 'Vector2';
    if (ArrayBuffer.isView(v)) return `TypedArray[${v.length}]`;
    if (Array.isArray(v)) return `Array[${v.length}]<${v.length ? kindOf(v[0]) : 'empty'}>`;
  }
  return null;
}

function flatten(v) {
  const k = kindOf(v);
  switch (k) {
    case 'number': return [v];
    case 'boolean': return [v ? 1 : 0];
    case 'Color': return [v.r, v.g, v.b];
    case 'Vector2': return [v.x, v.y];
    case 'Vector3': return [v.x, v.y, v.z];
    case 'Vector4': return [v.x, v.y, v.z, v.w];
    default:
      if (k && k.startsWith('TypedArray')) return Array.from(v);
      if (k && k.startsWith('Array')) return v.flatMap(flatten);
      throw new Error(`flatten: unsupported uniform value kind for ${JSON.stringify(v)}`);
  }
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
// THE UNIFORM MAP — match by VALUE SOURCE, not by SPELLING  (adversarial review P2, 2026-08-06)
// ═════════════════════════════════════════════════════════════════════════════════════════════
// The first version of this tool built its watched set by NAME INTERSECTION alone: 27 of the
// game's 71. That is a matching key made of SPELLING, and the same world-engine value carried
// under two different spellings was invisible to it. Not hypothetically:
//
//   surfaceMaterial.js:304 `export function surfacePaletteOf(cond) {` (body :304-318) returns
//   FOUR endmembers
//   {fresh, weathered, craton, sediment}. The lab wrote three of them to
//   uFreshColor / uBaseColor / uSedColor (planet-lod-lab.html:5431-5433, and the import comment
//   at :176 said so). The GAME wrote the same three to
//   uFreshColor / uWeatheredColor / uSedColor (src/objects/Planet.js:1628 `uFreshColor`,
//   :1603 `uWeatheredColor`, :1604 `uSedColor`).
//   Same function, same call, same body — and because the middle one was spelled differently,
//   uFresh and uSed were watched and the WEATHERED one was not. uWeatheredColor is the largest
//   single contributor to a rocky body's surface colour (Planet.js:692 `vec3 highland`,
//   :769 `vec3 rock` and :785 `vec3 crust`).
//   ⭐ PAST TENSE SINCE 2026-08-06: the drifted name was collapsed onto the game's spelling, so the
//   lab writes uWeatheredColor too and this pair is now NAME-MATCHED. The history is kept because
//   the map's job did not end with it — see UNIFIED NAMES below for what still guards the pair.
//
// That mattered immediately. PLAN.md:212 `committed delta table` (Step 2's gate) names four moving quantities —
// `landPalette`, `iceness`, `lavaGlowColor`, `lavaCrustColor`. THREE of the four reach the screen
// through uniforms the name intersection never compared: uWeatheredColor, uLavaGlow, uLavaCrust.
// Step 2's primary gate could have run green over its own declared subject.
//
// ── ⭐ HOW CITATIONS ARE WRITTEN IN THIS MAP, AND WHY SOME CARRY NO LINE NUMBER ──────────────
// This map is the AUTHORITY on which uniform carries which value, so a citation that points one
// line off does not degrade gracefully — it names the NEIGHBOURING uniform, and it reads as
// freshly verified while doing it. (Adversarial review, 2026-08-06: ~15 refs here were off by
// one or two; following `uIceColor → Planet.js:1634` landed on `uIcenessMix: { value: d.iceness }`
// and would have "shown" that the map paired a colour with a scalar.)
//
// So, two forms, and the choice between them is deliberate:
//
//   `Planet.js:1635 \`uIceColor\``   — file, line, AND the symbol at that line. Used for files that
//                                    are STABLE for this program. The symbol is what makes the
//                                    next drift survivable: grep it, do not trust the integer.
//                                    ⭐ This form is MACHINE-CHECKED — see `--check-citations`,
//                                    which reads every `file:NNN \`symbol\`` in this file and
//                                    asserts the symbol is actually on that line.
//
//   `PlanetGenerator.js \`baseColor: palette.base\``  — symbol ONLY, no line. Used for the two
//                                    REGIONS this program rewrites on a schedule: the record
//                                    literal + bake assignments at the bottom of
//                                    `PlanetGenerator.generate` (everything from `const planetData
//                                    = {` down), and ALL of
//                                    src/worldengine/port/conditionFromPlanet.js. Steps 2-12 each
//                                    add lines to both — Step 1 alone added 239 to the adapter and
//                                    re-pointed nothing — so an integer written here is born with a
//                                    half-life of one step. A ref that is WRONG is worse than a ref
//                                    that is ABSENT (that is this finding's own argument), and the
//                                    repo already rules this way: docs/NOW.md — "the workstream
//                                    docs carry build-time line numbers — grep the symbol, don't
//                                    trust them."
//
// ⛔ Do not "helpfully" add line numbers back to the symbol-only refs. The absence is the record.
//
// ⚠⚠ AND ONE TRAP THE CONVENTION CREATES, FOUND BY INSTRUMENT A ON 2026-08-07 — twice, the second
//    time inside the note warning about the first.
//
//    A citation's symbol text becomes SCANNED CONTENT. Several fences in this program prove two
//    files agree by matching a declaration against the other file's SOURCE TEXT — the durable
//    technique this program relies on. `tests/port-condition-contract.test.js` does exactly that
//    for the shared bake list, with a non-global regex, so it takes the FIRST textual match in
//    this file. Citing the symbol by reproducing its declaration head verbatim put an earlier
//    match in a comment; the assertion then parsed 60 lines of prose instead of five strings.
//    The citation was CORRECT, the test was RIGHT to go red, and only Instrument A could see it.
//
//    ⇒ RULE: cite a symbol by NAME, never by reproducing an assignment. Write `const FOO` — not
//      the form with the equals sign and the opening bracket. This fence tests CONTAINMENT, so
//      the short form verifies identically and cannot be mistaken for a declaration.
//    ⇒ COROLLARY: prose that must discuss such a declaration names it in words, as this note now
//      does. Reproducing it "just as an example" is the same edit as making it.
//    Elsewhere in PlanetGenerator.js (the aurora law, the type/palette draws) the line form is used
//    and IS machine-checked, so drift there is caught rather than believed.
//
// ── THE RULE (what gets watched, and why) ───────────────────────────────────────────────────
// A game uniform is WATCHED if its construction-time value is a function of THIS BODY — its
// record, its condition, or a game-side constant that gates world-engine output. Four tiers,
// printed next to every row, because they are not equally strong evidence:
//
//   bake      Reads one of the five WORLDENGINE_BAKES fields on planetData. Those five are
//             DELIBERATELY EXCLUDED from the body-identity fingerprint (see the block above and
//             tests/body-identity-fence.test.js:173 `const WORLDENGINE_BAKES`), so a delta row
//             see them move. Highest-value tier. Step 2's whole gate lives here.
//   condition Computed inside Planet._createSurface from conditionFromPlanet(d) — never on the
//             record at all. Same property: the delta row is the only detector.
//   gate      A Planet.js module constant that multiplies or mixes world-engine output
//             (uReliefMix at Planet.js:591, uLimbMix at :527/:535, uCraterReliefGain at :320,
//             uReliefNormalGain at :323). Constant across the population by construction, so the
//             sensitivity table will correctly call it ⛔ CONSTANT — and that is exactly the
//             claim wanted: a zero delta here proves the safety dial held. Flip RELIEF_MIX to 0
//             and every shipped relief pixel vanishes while all 20+ condition-derived uniforms
//             still read perfectly correct.
//   record    Reads a DRAWN planetData field. ⚠ FINGERPRINT-SHADOWED, and this is the honest
//             caveat the tool must state about itself: a change to the RECORD moves the body's
//             fingerprint, which EXCLUDES that body from the delta table, so the row prints
//             0.000000e+0 while the structural channel prints POPULATION MISMATCH. That row is
//             entirely true and entirely misleading if read alone. It is still worth watching,
//             because it DOES catch the other half — a change to how Planet.js READS the record
//             (a fallback, a unit, a swapped field) moves the uniform without moving the record.
//             The verdict block reprints this caveat whenever the population is not identical.
//
// A game uniform is EXCLUDED only for one of two reasons, and each one is named per uniform in
// UNWATCHED below. No uniform is dropped silently — see the completeness fence at the bottom of
// resolveSharedUniforms(), which REFUSES TO RUN if any of the game's uniforms is unclassified.
//
// ── WHAT THE LAB NAME IS FOR, AND WHAT IT IS NOT ────────────────────────────────────────────
// ⛔ Every comparison stays SAME-TREE game-vs-game. The `lab` field on an alias is documentation
// plus a typo fence (the lab name must exist in makeUniforms()); no lab VALUE is ever differenced
// against a game value. Plan §6 risk 5, PLAN.md:548. An alias with `lab: null` is watched
// game-side-only, which is the same valid comparison with one less cross-reference.

// ── UNIFIED NAMES — pairs that WERE aliases and are now one spelling ─────────────────────────
// Documentation only, no behaviour, and deliberately NOT an ALIASES row: once the two frontends
// agree on a spelling the uniform is name-matched, and the fence at resolveSharedUniforms() below
// rejects an alias for a name-matched uniform as the contradiction it is (exit 2).
//
// ⭐ WHAT STILL GUARDS THE PAIR, now that the alias row is gone. If anyone ever renames the LAB
// side back — or renames the game side — `uWeatheredColor` stops being name-matched while it is
// still on the production material, it lands in NONE of the four buckets, and the COMPLETENESS
// FENCE stops this tool dead with "UNCLASSIFIED game uniform(s): uWeatheredColor" and exit 2.
// That is a strictly LOUDER failure than the alias row it replaced: an alias whose `lab` name went
// missing was also fenced, but a re-divergence that renamed BOTH sides in step would have satisfied
// the alias and gone unnoticed. Verified by negative control 2026-08-06 — renaming the lab uniform
// back to uBaseColor and running --list exits 2 on exactly that message.
const UNIFIED_NAMES = [
  {
    name: 'uWeatheredColor', wasLab: 'uBaseColor', unifiedOn: '2026-08-06', tier: 'bake',
    why: 'surfacePaletteOf(cond).weathered through applyAlbedoTransfer. Game: Planet.js:1629 '
       + '`uWeatheredColor` reads planetData.landPalette.weathered, baked at PlanetGenerator.js '
       + '`planetData.landPalette = applyAlbedoTransfer(surfacePaletteOf(condition)`. Lab: '
       + 'planet-lod-lab.html:5431 writes the same endmember from the same call at :2794. '
       + 'THE PROVEN CASE — this is the alias the name intersection missed, and the drift PLAN.md §2 '
       + 'names as the shape every other divergence started in. The game spelling won: it names the '
       + 'ENDMEMBER rather than a position in a ramp. Zero behaviour change — Instrument C reported '
       + '0/526 on all 55 watched uniforms across the rename.',
  },
];

/** game name ↔ lab name, SAME world-engine value under two spellings. */
const ALIASES = [
  {
    game: 'uIceColor', lab: 'uIcenessAlbedo', tier: 'bake',
    why: 'ICE_ALBEDO [0.86,0.90,0.95] (surfaceMaterial.js:231 `export const ICE_ALBEDO`). Game: '
       + 'Planet.js:1635 `uIceColor` reads planetData.iceColor, set at PlanetGenerator.js '
       + '`iceColor: ICE_ALBEDO`. Lab: planet-lod-uniforms.js:278 `uIcenessAlbedo` '
       + 'carries the identical triple as "icy-surface tint the rock ramp mixes toward". Same '
       + 'constant, same role, two names. A constant TODAY — which is precisely why it needs a '
       + 'row: the moment anyone makes it condition-derived, nothing else would notice.',
  },
  {
    game: 'uReliefOctaves', lab: 'uOctaves', tier: 'gate',
    why: "fbmd's octave count, both 4.0. Game: Planet.js:591 `fbmd(pos, uReliefOctaves, 0.0)`. "
       + 'Lab: planet-lod-height.glsl.js:23 `uniform float uOctaves` declares it as "effective '
       + 'octave count" and feeds it to the same fbmd family (:1480 `fbmdRidged`, :3209 '
       + '`fbmdDamped`). Same argument to the same function.',
  },
  {
    game: 'noiseScale', lab: 'uNoiseScale', tier: 'record',
    why: 'MANY-TO-ONE, and deliberately so. The game declares the base feature frequency TWICE '
       + 'from one expression — `noiseScale` (Planet.js:1638 `noiseScale`, the legacy simplex '
       + 'stack) and `uNoiseScale` (:1655 `uNoiseScale`, fbmd), both `d.noiseScale`. Only the '
       + 'second was watched. Watching '
       + 'both is the only way a divergence BETWEEN the two paths becomes visible; a tool that '
       + 'watches one of a matched pair reports a green that means nothing about the other.',
  },
  // ── F37 aurora. Four pairs, u-prefix aside identical spellings, and the plan (§2) records them
  //    as TWO DIVERGENT LAWS today (PlanetGenerator.js:490 `const auroraColors` … :503
  //    `const ringWidth` vs planet-lod-lab.html:2585-2611,
  //    under a lab comment claiming it mirrors the game). They are the same FEATURE and the same
  //    slot in the shader; they are not yet the same law. Watched game-side, `record` tier — see
  //    the fingerprint-shadow caveat above. Listed here rather than left off so that when Step 4+
  //    unifies the law, the rows already exist and the movement is measured, not discovered.
  { game: 'auroraColor',     lab: 'uAuroraColor',     tier: 'record', why: 'F37 emission colour — planetData.aurora.color (PlanetGenerator.js:490 `const auroraColors`) ↔ planet-lod-uniforms.js:58 `uAuroraColor`.' },
  { game: 'auroraIntensity', lab: 'uAuroraIntensity', tier: 'record', why: 'F37 ring strength — planetData.aurora.intensity ↔ planet-lod-uniforms.js:57 `uAuroraIntensity`.' },
  { game: 'auroraRingLat',   lab: 'uAuroraRingLat',   tier: 'record', why: 'F37 oval magnetic latitude — planetData.aurora.ringLatitude ↔ planet-lod-uniforms.js:59 `uAuroraRingLat`.' },
  { game: 'auroraRingWidth', lab: 'uAuroraRingWidth', tier: 'record', why: 'F37 oval half-width — planetData.aurora.ringWidth ↔ planet-lod-uniforms.js:60 `uAuroraRingWidth`. The lab floors it at 0.07 (PlanetGenerator.js:503 `const ringWidth` does not). This is the §2 drift row.' },
];

/** Game uniforms with NO lab counterpart at all. Watched game-side-only (before vs after). */
const GAME_ONLY_WATCHED = [
  // ── The two remaining Step 2 bakes. No lab counterpart EXISTS: the lab renders F32/F33/F41
  //    emission from an in-shader blackbody driven by uThermalTempK / uNightTempK / uMagmaTemp
  //    (planet-lod-uniforms.js:78 `uMagmaTemp`, :455-460), never as a CPU-side colour uniform. The
  //    game bakes the colour on the CPU instead (`emissiveBlackbody` in PlanetGenerator.generate).
  //    Same law, different side of the CPU/GPU line — so there is no name to alias, and
  //    game-side-only is the correct and complete answer.
  { game: 'uLavaGlow',  tier: 'bake', why: 'PlanetGenerator.js `planetData.lavaGlowColor = emissiveBlackbody(meltTemperatureOf(condition))` → Planet.js:1636 `uLavaGlow`. Named in Step 2\'s gate (PLAN.md:212 `committed delta table`).' },
  { game: 'uLavaCrust', tier: 'bake', why: 'PlanetGenerator.js `planetData.lavaCrustColor = emissiveBlackbody(crustTemperatureOf(condition))` → Planet.js:1637 `uLavaCrust`. Named in Step 2\'s gate (PLAN.md:212 `committed delta table`).' },

  // ── Gates on world-engine output. Constants, watched as dials (see the `gate` tier above).
  { game: 'uLimbMix',          tier: 'gate', why: 'LIMB_MIX (Planet.js:1401). Planet.js:527 `pow(fresnel, mix(3.0, uLimbExponent, uLimbMix))` and :535 mix onto uLimbColor — at 0.0 the entire condition-derived limb is off while uLimbExponent/uLimbColor still read correct.' },
  { game: 'uReliefMix',        tier: 'gate', why: 'RELIEF_MIX (Planet.js:1328). Planet.js:591 gates fbmd entirely: `(uReliefMix > 0.001) ? fbmd(...) : vec4(0.0)`.' },
  { game: 'uReliefGain',       tier: 'gate', why: 'RELIEF_GAIN 3.648 (Planet.js:1335), the measured fbmd→legacy spread match. The land/sea threshold sits on it; an unmatched gain drowns or beaches every continent.' },
  { game: 'uReliefGainCont',   tier: 'gate', why: 'RELIEF_GAIN_CONT 3.744 (Planet.js:1336), the terrestrial-continent spread match.' },
  { game: 'uReliefNormalGain', tier: 'gate', why: 'RELIEF_NORMAL_GAIN 39.24 (Planet.js:1375) — a deliberate 6× exaggeration, calibrated on deflection angle over 60 bodies. Planet.js:323.' },
  { game: 'uCraterReliefGain', tier: 'gate', why: 'CRATER_RELIEF_GAIN 1.0 (Planet.js:1391), separate from uReliefNormalGain ON PURPOSE so craters do not inherit its 6×. Planet.js:320.' },

  // ── Legacy pre-world-engine record fields. These are the "R" rows of the MVP table (PLAN.md
  //    §3) — the things the port is scheduled to REPLACE. `record` tier, fingerprint-shadowed.
  //    Watched because the replacement itself is a shipped-pixel move that ought to be measured
  //    when it happens rather than discovered afterwards.
  { game: 'baseColor',          tier: 'record', why: 'PlanetGenerator.js `baseColor: palette.base`. ⚠ NOT the lab\'s uBaseColor — see COLLISIONS below.' },
  { game: 'accentColor',        tier: 'record', why: 'PlanetGenerator.js `accentColor: palette.accent`. The legacy per-type accent; also the fallback for uLavaGlow/uLavaCrust.' },
  { game: 'noiseDetail',        tier: 'record', why: 'PlanetGenerator.js `noiseDetail: rng.range(0.3, 0.8)`. Legacy simplex detail weight; no lab counterpart.' },
  { game: 'planetRadius',       tier: 'record', why: 'planetData.radius (scene-scaled by toSceneData). ⚠ NOT the lab\'s uBodyRadius, which is 1.0 in the lab\'s own unit-sphere units — different quantity, do not alias.' },
  { game: 'planetType',         tier: 'record', why: 'Planet._typeIndex() over planetData.type — the type branch the world-engine port exists to retire.' },
  { game: 'hasClouds',          tier: 'record', why: 'planetData.clouds presence gate.' },
  { game: 'cloudColor',         tier: 'record', why: 'planetData.clouds.color. Lab F31 haze/cloud colour is uHazeColor, driven by a DIFFERENT law (preset atmosphere colour) — a semantic neighbour, not the same value. Not aliased.' },
  { game: 'cloudDensity',       tier: 'record', why: 'planetData.clouds.density. Lab uCloudCoverage is driven by deriveUniforms from condition — same concept, different source. Not aliased.' },
  { game: 'cloudScale',         tier: 'record', why: 'planetData.clouds.scale × the toSceneData ratio (main.js:7486 `const mapToSceneRatio`, through :6269).' },
  { game: 'atmosphereStrength', tier: 'record', why: 'planetData.atmosphere.strength — the legacy rim magnitude uLimbMix blends against.' },
  { game: 'atmosphereColor',    tier: 'record', why: 'planetData.atmosphere.color — the PRE-PORT rim tint; Planet.js:535 `finalColor += mix(atmosphereColor, uLimbColor, uLimbMix)` mixes from it toward the condition-derived uLimbColor.' },
  { game: 'hasAurora',          tier: 'record', why: 'planetData.aurora presence gate. Lab has no counterpart gate (it gates on uAuroraIntensity), so game-side-only rather than aliased.' },
];

/**
 * Game uniforms deliberately NOT watched, each with the reason. Nothing is dropped silently:
 * the completeness fence below refuses to run if a game uniform appears in none of the buckets.
 */
const UNWATCHED = [
  // X1 — RUNTIME. The renderer overwrites these every frame AFTER construction, so the value this
  // harness reads is a placeholder that never reaches a pixel. Recording it would assert the
  // stability of a number the game does not ship, which is a green with no subject.
  { game: 'lightDir',            reason: 'runtime', why: 'overwritten per frame — src/main.js:11143 `entry.planet._lightDir.copy(_sunDir)` (also :8740 `planet._lightDir`, :11172 `moon.planet._lightDir`).' },
  { game: 'lightDir2',           reason: 'runtime', why: 'overwritten per frame — src/main.js:11149 `entry.planet._lightDir2.copy(_sunDir2)` (binary companion); constructed as (0,0,0).' },
  { game: 'time',                reason: 'runtime', why: 'animation clock — Planet.js:1955 `if (mat.uniforms.time)`, through :1918.' },
  { game: 'lodLevel',            reason: 'runtime', why: 'LOD tier — src/rendering/objects/BodyRenderer.js:181 `surface.material.uniforms.lodLevel.value = tier`.' },
  { game: 'starPos1',            reason: 'runtime', why: 'star world position — src/main.js:11208 `pu.starPos1`.' },
  { game: 'starPos2',            reason: 'runtime', why: 'second-star world position — src/main.js:11209 `pu.starPos2.value.copy(_star2Pos)` (also :10036 planet-class moons, :10042 textured moons). ⚠ The old ref here was :11298, a comment inside _updateRenderVisuals stating these are NOT written there — a citation that read as evidence and pointed at its own negation.' },
  { game: 'shadowMoonCount',     reason: 'runtime', why: 'eclipse casters — src/main.js:11213 `if (pu.shadowMoonCount)`, through :9992, rewritten every frame.' },
  { game: 'shadowMoonPos',       reason: 'runtime', why: 'eclipse casters — src/main.js:11217 `pu.shadowMoonPos`.' },
  { game: 'shadowMoonRadius',    reason: 'runtime', why: 'eclipse casters — src/main.js:11213 `if (pu.shadowMoonCount)` block.' },
  { game: 'shadowPlanetCount',   reason: 'runtime', why: 'eclipse casters — src/main.js:11224 `if (pu.shadowPlanetCount)`, assigned at :11238 `pu.shadowPlanetCount.value = shadowPlanetIdx`.' },
  { game: 'shadowPlanetPos',     reason: 'runtime', why: 'eclipse casters — src/main.js:11228 `pu.shadowPlanetPos.value[shadowPlanetIdx].copy(inner.planet.mesh.position)` (and :10009 for the outer caster).' },
  { game: 'shadowPlanetRadius',  reason: 'runtime', why: 'eclipse casters — src/main.js:11229 `pu.shadowPlanetRadius.value[shadowPlanetIdx] = inner.planet.data.radius` (and :10010).' },

  // X2 — HARNESS-BLIND. These come from `starInfo`, the SECOND constructor argument
  // (Planet.js:1519 `constructor(planetData, starInfo = null)`), which this harness never passes —
  // it builds `new Planet(rec)` with one argument, on purpose, because the population is bodies
  // and not systems. So every body would record the `|| [1,1,1]` / `?? 1.0` fallback at
  // Planet.js:1527 `this._starColor1` through :1530. A row asserting that a fallback stayed constant is a green about the
  // harness, not about the game. ⭐ If this harness ever starts passing starInfo, move these four
  // into GAME_ONLY_WATCHED — the fence below will not do it for you.
  { game: 'starColor1',      reason: 'harness-blind', why: 'Planet.js:1527 `this._starColor1 = starInfo?.color1 || [1, 1, 1]`; harness passes no starInfo.' },
  { game: 'starColor2',      reason: 'harness-blind', why: 'Planet.js:1528 `this._starColor2 = starInfo?.color2 || [0, 0, 0]`; harness passes no starInfo.' },
  { game: 'starBrightness1', reason: 'harness-blind', why: 'Planet.js:1529 `this._starBrightness1 = starInfo?.brightness1 ?? 1.0`; harness passes no starInfo.' },
  { game: 'starBrightness2', reason: 'harness-blind', why: 'Planet.js:1530 `this._starBrightness2 = starInfo?.brightness2 ?? 0.0`; harness passes no starInfo.' },
];

/**
 * NAME COLLISIONS — pairs that LOOK like aliases and are not. Documentation only, no behaviour.
 * Recorded because the obvious mechanical way to widen this map (strip/add the `u` prefix and
 * capitalise) produces every one of these, and each would be a wrong answer that renders
 * plausibly. The uWeatheredColor case is the reason this file exists; these are its inverse.
 */
const COLLISIONS = [
  { game: 'baseColor', lab: 'uBaseColor (RETIRED 2026-08-06)', why: 'The u-prefix rule matched these, and it was WRONG. The lab\'s uBaseColor was the WEATHERED endmember (planet-lod-uniforms.js:138 `uWeatheredColor`, "driven: surfacePaletteOf(cond).weathered"); the game\'s baseColor is the legacy per-type palette tone (PlanetGenerator.js `baseColor: palette.base`), a DIFFERENT quantity that still exists. The lab uniform has since been renamed uWeatheredColor (see UNIFIED NAMES), which closes this trap by construction — kept because the trap reopens the moment anyone introduces a lab uniform called uBaseColor, and because it is the reason not to.' },
  { game: 'planetRadius', lab: 'uBodyRadius', why: 'Different units and different jobs. uBodyRadius is the object-space radius of the mesh the material is bound to (planet-lod-uniforms.js:24 `uBodyRadius`, 1.0 in the lab\'s unit sphere); planetRadius is the body\'s scene radius.' },
  { game: 'uLimbMix', lab: 'uLimbStrength', why: 'Both gate the limb, neither is the other. uLimbMix is the game\'s A/B port dial (a constant); uLimbStrength is the lab\'s driven F34 rim-glow magnitude (planet-lod-uniforms.js:40 `uLimbStrength`).' },
  { game: 'cloudDensity', lab: 'uCloudCoverage', why: 'Same concept, two unrelated laws: a legacy generator draw vs a condition-driven coverage. Aliasing them would put two different quantities in one row.' },
  { game: '(none)', lab: 'uCratonColor', why: 'LAB-ONLY. surfacePaletteOf returns FOUR endmembers; the game consumes three and DROPS `craton` (planet-lod-lab.html:5460 `uniforms.uCratonColor` writes it, Planet.js has no uniform). Not a spelling gap — a missing consumer, and therefore port work, not map work.' },
];

// Resolve the watched set. ⛔ makeUniforms() is consulted for KEYS and for a KIND tag only — no
// lab VALUE is ever differenced against a game value (see the header, plan §6 risk 5).
function resolveSharedUniforms(probeMaterialUniforms) {
  const labU = makeUniforms(new THREE.Vector3(0, 1, 0)); // WORLD_LIGHT: any vector; keys don't depend on it
  const labNames = Object.keys(labU);
  const gameNames = Object.keys(probeMaterialUniforms);

  const nameMatched = gameNames.filter((n) => labNames.includes(n)).sort();
  const aliasGames = ALIASES.map((a) => a.game);
  const onlyGames = GAME_ONLY_WATCHED.map((a) => a.game);

  // ── FENCES on the map itself. A hand-written map that can rot silently is worse than no map:
  //    it reads like coverage. Every one of these throws rather than degrading.
  const problems = [];
  const gameSet = new Set(gameNames), labSet = new Set(labNames);
  for (const a of ALIASES) {
    if (!gameSet.has(a.game)) problems.push(`ALIASES: game uniform "${a.game}" is not on the production material any more — stale entry.`);
    if (a.lab && !labSet.has(a.lab)) problems.push(`ALIASES: lab uniform "${a.lab}" is not in makeUniforms() — typo or renamed; the alias would silently degrade to game-only.`);
    if (nameMatched.includes(a.game)) problems.push(`ALIASES: "${a.game}" is ALSO name-matched; an alias for a name-matched uniform is a contradiction.`);
  }
  for (const g of GAME_ONLY_WATCHED) {
    if (!gameSet.has(g.game)) problems.push(`GAME_ONLY_WATCHED: "${g.game}" is not on the production material any more — stale entry.`);
    if (labSet.has(g.game)) problems.push(`GAME_ONLY_WATCHED: "${g.game}" DOES exist in makeUniforms(); it belongs in the name-matched set, not here.`);
  }
  for (const u of UNWATCHED) {
    if (!gameSet.has(u.game)) problems.push(`UNWATCHED: "${u.game}" is not on the production material any more — stale entry.`);
  }
  // Completeness: every game uniform must be classified. This is the fence that makes the map
  // safe to hand-write — a uniform added to Planet.js tomorrow stops this tool dead rather than
  // quietly sitting outside its own gate, which is exactly how uWeatheredColor got missed.
  const classified = new Set([...nameMatched, ...aliasGames, ...onlyGames, ...UNWATCHED.map((u) => u.game)]);
  const unclassified = gameNames.filter((n) => !classified.has(n));
  if (unclassified.length) {
    problems.push(`UNCLASSIFIED game uniform(s): ${unclassified.join(', ')}.\n`
      + '     Every uniform on the production material must appear in exactly one of: the runtime\n'
      + '     name intersection, ALIASES, GAME_ONLY_WATCHED, or UNWATCHED. Decide which — and if it\n'
      + '     is UNWATCHED, write the reason. Silence is how a shipped uniform escapes its gate.');
  }
  const dupes = [...aliasGames, ...onlyGames, ...UNWATCHED.map((u) => u.game)]
    .filter((n, i, a) => a.indexOf(n) !== i);
  if (dupes.length) problems.push(`classified more than once: ${[...new Set(dupes)].join(', ')}`);
  if (problems.length) {
    console.error('⛔ INSTRUMENT C: THE UNIFORM MAP IS OUT OF DATE.');
    for (const p of problems) console.error(`   ${p}`);
    console.error('   Fix tools/port-uniform-delta.mjs. No delta was measured. This is NOT "zero delta".');
    process.exit(2);
  }

  const watched = [...nameMatched, ...aliasGames, ...onlyGames].sort();

  // Tier + lab counterpart per watched uniform. Name-matched uniforms get their tier from
  // TIER_BY_NAME below; everything else carries it on its map entry.
  const aliasByGame = new Map(ALIASES.map((a) => [a.game, a]));
  const onlyByGame = new Map(GAME_ONLY_WATCHED.map((a) => [a.game, a]));
  const shapes = {};
  for (const n of watched) {
    const gk = kindOf(probeMaterialUniforms[n].value);
    if (!gk) throw new Error(`resolveSharedUniforms: game uniform ${n} has an unrecognised value shape`);
    const labName = aliasByGame.has(n) ? aliasByGame.get(n).lab : (labSet.has(n) ? n : null);
    const origin = aliasByGame.has(n) ? 'aliased' : onlyByGame.has(n) ? 'game-only' : 'name-matched';
    const tier = aliasByGame.get(n)?.tier || onlyByGame.get(n)?.tier || TIER_BY_NAME[n];
    if (!tier) throw new Error(`resolveSharedUniforms: no tier for name-matched uniform ${n} — add it to TIER_BY_NAME.`);
    shapes[n] = {
      gameKind: gk,
      labKind: labName ? kindOf(labU[labName].value) : null,   // recorded, never differenced
      arity: flatten(probeMaterialUniforms[n].value).length,
      labName,
      origin,
      tier,
    };
  }

  return {
    shared: watched,
    shapes,
    counts: {
      game: gameNames.length,
      lab: labNames.length,
      shared: watched.length,
      nameMatched: nameMatched.length,
      aliased: aliasGames.length,
      gameOnly: onlyGames.length,
      unwatched: UNWATCHED.length,
    },
    gameOnly: gameNames.filter((n) => !labNames.includes(n)).sort(),
    unwatched: UNWATCHED,
  };
}

/**
 * Value-source tier for the NAME-MATCHED uniforms (27 when this was written; 28 since the
 * 2026-08-06 name unification). Same four tiers as the map above; kept
 * separate only because these names need no alias entry.
 *
 * ⭐ RE-VERIFIED LINE BY LINE 2026-08-07 against the uniforms object at
 * src/objects/Planet.js:1622 `const material = new THREE.ShaderMaterial({` … :1709, and every ref
 * below now carries its SYMBOL so `--check-citations` can assert the pairing mechanically. The
 * previous set was written approximately: five of them landed on the COMMENT above the uniform and
 * three on the NEIGHBOURING uniform, which in a block like this one is not a stale ref, it is a
 * WRONG ANSWER about which uniform carries which value. (`uIceColor → :1608` resolved to
 * `uIcenessMix: { value: d.iceness }` — a colour paired with a scalar.)
 *
 *   bake      — reads a WORLDENGINE_BAKES field on planetData (outside the identity fingerprint)
 *   condition — computed in _createSurface from conditionFromPlanet(d)
 *   gate      — a Planet.js module constant
 *   record    — reads a DRAWN planetData field (fingerprint-shadowed)
 */
const TIER_BY_NAME = {
  uWeatheredColor: 'bake',    // d.landPalette.weathered  — Planet.js:1629 `uWeatheredColor`.
                              // Name-matched only since 2026-08-06; it was the ALIASES row above
                              // until the lab's uBaseColor was renamed to match. See UNIFIED NAMES.
  uFreshColor: 'bake',        // d.landPalette.fresh      — Planet.js:1628 `uFreshColor`
  uSedColor: 'bake',          // d.landPalette.sediment   — Planet.js:1630 `uSedColor`
  uBioGroundColor: 'bake',    // d.landPalette.pigment    — Planet.js:1669 `uBioGroundColor`
  uIcenessMix: 'bake',        // d.iceness                — Planet.js:1634 `uIcenessMix`
  uLimbExponent: 'condition', // atmosphereOpticsOf(cond) — Planet.js:1643 `uLimbExponent`
  uLimbColor: 'condition',    //                          — Planet.js:1644 `uLimbColor`
  uTermColor: 'condition',    //                          — Planet.js:1655 `uTermColor`
  uTermStrength: 'condition', // optics.columnFraction × TERM_STRENGTH — Planet.js:1653 `uTermStrength`
  uTermWidth: 'condition',    // termWidthFor(cond.atmosphere.pressure) — Planet.js:1654 `uTermWidth`
  uBioGroundCover: 'condition', // biosphereOf(cond)      — Planet.js:1657 `uBioGroundCover`
  uCraterDensity: 'condition',  // craterUniformsFrom(cond) — Planet.js:1688 `uCraterDensity`, and
                                // the block it heads runs to :1672 `uEjectaLump` (:1668
                                // `uCraterOffset` is reliefOffsets, not craterUniformsFrom)
  uCraterComplexD: 'condition',
  uCraterRelaxation: 'condition',
  uTerraceCount: 'condition',
  uCraterScale: 'condition',
  uCraterAmp: 'condition',
  uEjectaStrength: 'condition',
  uEjectaRampart: 'condition',
  uEjectaAmp: 'condition',
  uEjectaLump: 'condition',
  uDispDomainScale: 'gate',   // RELIEF_DOMAIN_SCALE      — Planet.js:1381 `const RELIEF_DOMAIN_SCALE`
  uFwClamp: 'gate',           // literal 1                — Planet.js:1683 `uFwClamp`
  uVoroCells: 'gate',         // CRATER_VORO_CELLS        — Planet.js:1395 `const CRATER_VORO_CELLS`
  uNoiseScale: 'record',      // d.noiseScale             — Planet.js:1681 `uNoiseScale`
  uMacroOffset: 'record',     // reliefOffsets(d).macro   — Planet.js:1293 `function reliefOffsets`,
                              // hashed from 8 drawn record fields
  uDetailOffset: 'record',    // reliefOffsets(d).detail
  uCraterOffset: 'record',    // reliefOffsets(d).crater
};

// ═════════════════════════════════════════════════════════════════════════════════════════════
// BODY FINGERPRINT
// ═════════════════════════════════════════════════════════════════════════════════════════════
// A delta is only meaningful if the two runs measured the SAME body. SeededRandom.child() draws
// from its parent (src/generation/SeededRandom.js:95), so a changed draw count anywhere silently
// rewrites downstream bodies with nothing to announce it — and the resulting uniform "delta"
// would be a difference between two different planets wearing the same id.
//
// So: hash the input record. Over-inclusive on purpose for DRAWN fields — a change to an
// orbit-only field trips this even though it moves no uniform; over-triggering on "the input
// moved" is the safe direction, and a tripped body is reported as a POPULATION MISMATCH
// (excluded from the delta table) rather than as a uniform that moved.
//
// ⛔ WITH ONE EXCEPTION, AND IT IS THE WHOLE POINT OF THIS INSTRUMENT (adversarial review P1,
// 2026-08-06). Five fields on planetData are not drawn — they are OUTPUTS of the port itself,
// computed in PlanetGenerator.generate from `const condition = conditionFromPlanet(planetData)` and
// assigned onto the record below it (`planetData.landPalette = …`, `planetData.iceness = …`,
// `planetData.lavaGlowColor = …`, `planetData.lavaCrustColor = …`; `iceColor: ICE_ALBEDO` is a
// constant in the record literal). They then become shipped uniforms (uIcenessMix, uFreshColor /
// uSedColor / uWeatheredColor, uLavaGlow, uLavaCrust — Planet.js:1628 `uFreshColor` … :1611
// `uLavaCrust`).
//
// Hashing them puts this instrument's SUBJECT inside its own matching key. A port change moves
// the bake, the bake moves the fingerprint, and the body is excluded as a POPULATION MISMATCH —
// so the uniform that actually moved reports 0.000000e+0 and the operator is told to go fix a
// green Instrument B. Measured on the first gas body: iceness 0 → 0.6002, landPalette.weathered
// [0.408,0.250,0.176] → [0.241,0.228,0.206], 116 of 526 bodies excluded. And --allow-deltas does
// NOT rescue it: the structural check runs first and exits 2.
//
// That is precisely the "entirely true and entirely misleading" failure this instrument exists to
// catch, wearing the instrument's own uniform — and it would have fired at Steps 2 and 4, the two
// declared pixel-moving steps that name Instrument C as their primary gate.
//
// The negative control did not catch it because the control nudged Planet.js:1643 `uLimbExponent`,
// the uniform ASSIGNMENT site, which is DOWNSTREAM of the bake and so moved no planetData field.
// Every real
// port change in this plan moves the condition UPSTREAM of the bake. A convincing control can
// still step around the one class of change that matters.
//
// So: exclude the five bakes, and share ONE list with Instrument B, which already excludes exactly
// these (tests/body-identity-fence.test.js:173 `const WORLDENGINE_BAKES`, through :175) for the
// same reason. Two instruments that disagree about what "the same body" means resolve into an
// unactionable instruction.

// ⛔ KEEP IN SYNC with tests/body-identity-fence.test.js:173 `const WORLDENGINE_BAKES`. Derived port
// OUTPUTS, never drawn — excluded from the identity fingerprint by both instruments.
export const WORLDENGINE_BAKES = [
  'iceColor', 'iceness', 'landPalette', 'lavaCrustColor', 'lavaGlowColor',
];

/** The record minus the port's own outputs — what "the same body" means for both instruments. */
function identityRecord(rec) {
  if (rec === null || typeof rec !== 'object') return rec;
  const out = {};
  for (const k of Object.keys(rec)) if (!WORLDENGINE_BAKES.includes(k)) out[k] = rec[k];
  return out;
}
function stableStringify(v) {
  if (v === null) return 'null';
  if (v === undefined) return 'undefined';
  const t = typeof v;
  if (t === 'number') return Number.isFinite(v) ? String(v) : `#${String(v)}`;
  if (t === 'string') return JSON.stringify(v);
  if (t === 'boolean') return v ? 'true' : 'false';
  if (t === 'function') return `fn:${v.name || 'anon'}`;
  if (ArrayBuffer.isView(v)) return `[${Array.from(v).map(stableStringify).join(',')}]`;
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  if (t === 'object') {
    const keys = Object.keys(v).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(v[k])}`).join(',')}}`;
  }
  return String(v);
}

const fingerprint = (rec) =>
  createHash('sha256').update(stableStringify(identityRecord(rec))).digest('hex').slice(0, 16);

// ═════════════════════════════════════════════════════════════════════════════════════════════
// MEASUREMENT
// ═════════════════════════════════════════════════════════════════════════════════════════════
function measure(bodies, sharedNames, perturb = null) {
  const rows = [];
  const failures = [];
  for (const b of bodies) {
    if (!b.rec) { failures.push({ id: b.id, error: b.error || 'no record' }); continue; }
    let planet;
    try {
      planet = new Planet(b.rec);
    } catch (e) {
      // A body the production material cannot even be built for is a finding, not a skip.
      failures.push({ id: b.id, error: String(e && e.stack || e) });
      continue;
    }
    const u = planet.surface.material.uniforms;
    const v = sharedNames.map((n) => (n in u ? flatten(u[n].value) : null));
    // --selftest only. Never reachable from --record / --check.
    if (perturb) sharedNames.forEach((n, i) => { if (v[i]) perturb(n, v[i], b); });
    rows.push({
      id: b.id,
      stratum: b.stratum,
      type: b.type,
      moonCount: b.moonCount,
      fp: fingerprint(b.rec),
      v,
    });
  }
  return { rows, failures };
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
// STATS
// ═════════════════════════════════════════════════════════════════════════════════════════════
// Per-uniform, over the matched bodies. Never aggregated across uniforms — plan §6 risk 6: the
// failure this instrument exists for is ONE uniform moving while every summary reads clean.
//
// For a multi-component uniform the per-body delta is the MAX ABSOLUTE component delta (the
// worst channel), matching how the plan states its own numbers ("limbColor on 225/225 with max
// channel delta 0.4797", PLAN.md:247). The component that carried the max is recorded too.
// Percentiles are NEAREST-RANK on the sorted per-body |delta| list: idx = ceil(p·n) − 1.
function nearestRank(sorted, p) {
  if (sorted.length === 0) return NaN;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
  return sorted[i];
}

function statsFor(name, idx, beforeRows, afterById) {
  const deltas = [];
  let moved = 0, compared = 0;
  let maxAbs = 0, maxAbsBody = null, maxAbsComp = -1;
  let signedMin = Infinity, signedMax = -Infinity;
  for (const br of beforeRows) {
    const ar = afterById.get(br.id);
    if (!ar || ar.fp !== br.fp) continue;   // population mismatch — handled by the caller
    const a = br.v[idx], b = ar.v[idx];
    if (a === null || b === null) continue; // uniform-set change — handled by the caller
    compared++;
    let bodyMax = 0, bodyComp = -1;
    for (let c = 0; c < a.length; c++) {
      const d = b[c] - a[c];
      const ad = Math.abs(d);
      if (d < signedMin) signedMin = d;
      if (d > signedMax) signedMax = d;
      if (ad > bodyMax) { bodyMax = ad; bodyComp = c; }
    }
    // Exact inequality. No epsilon anywhere: the tool reports, a human decides.
    if (bodyMax !== 0) moved++;
    deltas.push(bodyMax);
    if (bodyMax > maxAbs) { maxAbs = bodyMax; maxAbsBody = br.id; maxAbsComp = bodyComp; }
  }
  deltas.sort((x, y) => x - y);
  return {
    name,
    compared,
    moved,
    min: deltas.length ? deltas[0] : NaN,
    median: nearestRank(deltas, 0.50),
    p95: nearestRank(deltas, 0.95),
    max: deltas.length ? deltas[deltas.length - 1] : NaN,
    signedMin: Number.isFinite(signedMin) ? signedMin : NaN,
    signedMax: Number.isFinite(signedMax) ? signedMax : NaN,
    maxAbsBody,
    maxAbsComp,
  };
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
// CLI
// ═════════════════════════════════════════════════════════════════════════════════════════════
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const argOf = (f, dflt) => { const i = argv.indexOf(f); return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt; };

const CAPTURE = path.resolve(ROOT, argOf('--capture', 'tests/baseline/port-uniform-capture.json'));
const MODE = has('--record') ? 'record' : has('--check') ? 'check'
  : has('--list') ? 'list' : has('--selftest') ? 'selftest'
  : has('--check-citations') ? 'check-citations' : null;

if (!MODE) {
  console.error('usage: node tools/port-uniform-delta.mjs (--record | --check | --list | --selftest');
  console.error('                                          | --check-citations)');
  console.error('       [--force] [--allow-deltas] [--capture <path>]');
  process.exit(64);
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
// --check-citations — THE CITATION FENCE
// ═════════════════════════════════════════════════════════════════════════════════════════════
// Adversarial review 2026-08-06, findings 5 and 6: ~15 refs in the uniform map above were off by
// one or two, and every ref INTO conditionFromPlanet.js — here, in body-condition-vector.js and in
// PLAN.md, which Steps 2-12 are executed from — had rotted within a day of Step 1 landing 239 lines
// in that file. No gate could see either. They are not typos: in a uniform block an off-by-one ref
// NAMES THE NEIGHBOURING UNIFORM, so `uIceColor → Planet.js:1634` resolved to
// `uIcenessMix: { value: d.iceness }` and read as proof that the map paired a colour with a scalar.
//
// The fix that lasts is not "fix the 15 numbers" — Step 2 re-rots them next week. It is to make the
// CITATION FORM self-verifying:
//
//     Planet.js:1635 `uIceColor`      ← line AND the symbol that must be ON that line
//
// This mode resolves every citation written in that form and fails if the symbol is not there. A
// ref with NO backticked symbol cannot be checked; those are COUNTED AND PRINTED rather than
// ignored, because an unchecked count that nobody prints is the same blind spot one level up.
//
// ⛔ SCOPE. The map below is a curated OVERRIDE, not the whole story: a basename it does not hold
// is resolved against the repo (see `resolveBase`), and this mode FAILS — symbol or no symbol —
// on one that matches no file or more than one. Never a silent skip; that is the failure mode this
// whole instrument exists to catch. SOURCES is the files carrying the port's own reasoning.
const CITE_FILES = {
  // ⛔ Step 6: `index.js` is AMBIGUOUS — it resolves to BOTH src/worldengine/drivers/index.js and
  // vendor/motion-test-kit/core/predicates/index.js, so a bare `index.js:NNN` ref is unresolvable
  // rather than merely unchecked. Disambiguated here, per this mode's own remedy text, instead of
  // rewording the citation — the PACKS registry will be cited often and every author would re-hit it.
  'index.js': 'src/worldengine/drivers/index.js',
  'Planet.js': 'src/objects/Planet.js',
  'PlanetGenerator.js': 'src/generation/PlanetGenerator.js',
  'MoonGenerator.js': 'src/generation/MoonGenerator.js',
  'SolarSystemData.js': 'src/generation/SolarSystemData.js',
  'SeededRandom.js': 'src/generation/SeededRandom.js',
  'PhysicsEngine.js': 'src/generation/PhysicsEngine.js',
  'NavComputer.js': 'src/ui/NavComputer.js',
  'BodyRenderer.js': 'src/rendering/objects/BodyRenderer.js',
  'ShaderWarmup.js': 'src/rendering/ShaderWarmup.js',
  'main.js': 'src/main.js',
  'surfaceMaterial.js': 'src/worldengine/base/surfaceMaterial.js',
  'atmosphereOptics.js': 'src/worldengine/base/atmosphereOptics.js',
  'e1Regime.js': 'src/worldengine/base/e1Regime.js',
  'baseStep.js': 'src/worldengine/base/baseStep.js',
  'bombardment.js': 'src/worldengine/base/bombardment.js',
  'adaptL0.js': 'src/worldengine/base/adaptL0.js',
  'giant-drivers.js': 'src/worldengine/base/giant-drivers.js',
  'craterUniforms.js': 'src/worldengine/port/craterUniforms.js',
  'conditionFromPlanet.js': 'src/worldengine/port/conditionFromPlanet.js',
  'albedoTransfer.js': 'src/worldengine/display/albedoTransfer.js',
  // ── added with the CITE_SOURCES widening (B4). Every one of these was NAMED BY THIS MODE'S OWN
  // UNRESOLVED / SPAN-OPEN output after the sources went in, not guessed from reading the files.
  'climate-e5.js': 'src/worldengine/base/climate-e5.js',
  'storm-e.js': 'src/worldengine/base/storm-e.js',
  'emission-e.js': 'src/worldengine/base/emission-e.js',
  'fieldSampler.js': 'src/worldengine/instrument/fieldSampler.js',
  'laws.js': 'src/worldengine/instrument/laws.js',
  'port-condition-contract.test.js': 'tests/port-condition-contract.test.js',
  'port-route-agreement.test.js': 'tests/port-route-agreement.test.js',
  // The plan and the carried ledger cite THEMSELVES and each other — §10's "quoted claim" form is
  // written that way. Without these two entries every such ref was unverifiable, which is why the
  // one live instance surfaced as SPAN-OPEN "basename not in CITE_FILES" rather than as a check.
  'PLAN.md': 'docs/FEATURES/one-pipeline-two-frontends-PLAN.md',
  'one-pipeline-two-frontends-PLAN.md': 'docs/FEATURES/one-pipeline-two-frontends-PLAN.md',
  'CARRIED.md': 'docs/FEATURES/one-pipeline-two-frontends-CARRIED.md',
  'one-pipeline-two-frontends-CARRIED.md': 'docs/FEATURES/one-pipeline-two-frontends-CARRIED.md',
  'body-condition-vector.js': 'body-condition-vector.js',
  'planet-lod-uniforms.js': 'planet-lod-uniforms.js',
  'planet-lod-height.glsl.js': 'planet-lod-height.glsl.js',
  'planet-lod-lab-core.js': 'planet-lod-lab-core.js',
  'planet-lod-lab.html': 'planet-lod-lab.html',
  'driver-presets.js': 'driver-presets.js',
  'body-identity-fence.test.js': 'tests/body-identity-fence.test.js',
  'port-limb-optics.test.js': 'tests/port-limb-optics.test.js',
  'port-uniform-delta.mjs': 'tools/port-uniform-delta.mjs',
};

// ⛔ BASENAMES THAT ARE DELIBERATELY NOT FILES. A document that explains the citation FORM has to
// show the form, and an example written in the live form is indistinguishable from a live ref —
// CARRIED.md's statement of the B3.1 defect is exactly that, and it made this mode exit 2 on a
// basename that has no path to add. The answer is not a silent skip (the failure mode this whole
// instrument exists to catch) and not deleting the example: it is an ENUMERATED, PRINTED list.
// Every entry is counted and shown on every run, and `assertIllustrativeAreNotFiles` below exits 3
// if one of these ever names a real file — the day `foo.js` exists, this list is hiding a ref.
// ── ADDED WITH STEP 3'S TWO SOURCES. `a.html` and `b.js` are the SYNTHETIC two-file corpus the
// extraction suite builds in memory to prove its duplicate detector names BOTH locations rather than
// silently taking the first — tests/radius-live-feed.test.js `expect(msg).toContain('a.html:1')`.
// They are assertion fixtures, never files, and they surfaced the moment those sources were added:
// the scanner read them as refs and exited 2 on two basenames that name nothing. That is the fence
// working, so the answer is to declare them, not to loosen the check. `assertIllustrativeAreNotFiles`
// exits 3 the day either name becomes a real file, which is the guard that keeps this list from
// quietly hiding a live ref.
const CITE_ILLUSTRATIVE = new Set(['foo.js', 'Foo.js', 'a.html', 'b.js']);

// Files whose reasoning this fence guards. PLAN.md is here because it is EXECUTED FROM.
//
// ⭐ THE NOTE ABOVE USED TO SAY ADDING A SOURCE IS "a one-line change." IT WAS NOT, AND THAT CLAIM
// IS WHY THIS LIST STAYED WRONG (round 3, B4). The four original entries omitted the two DENSEST
// carriers of the port's reasoning — `conditionFromPlanet.js` (50 refs) and the contract test (49)
// — the two files that churn fastest and therefore rot fastest. Round 3 finding 1 was broken BY
// THE ROUND THAT FIXED CITATIONS and was invisible for exactly this reason: it lived outside the
// scanned set. §11.3.4 requires this list to cover every file a step edits, and it could not.
//
// It was not one line because SOURCES and FILES were COUPLED: the adapter cites `climate-e5.js`,
// `storm-e.js` and `emission-e.js`, none of which were in CITE_FILES, and this mode exits 2 on an
// unresolvable basename by design. So widening SOURCES without widening FILES turned a correct
// citation into a red build — which happened live on 2026-08-07, when a ref written in the correct
// `line + symbol` form failed the fence and the author fell back to the weaker symbol-only form.
// A fence that punishes the correct form and passes the vacuous one (B3.1) selects against itself.
// ⭐ ROUND 4 DECOUPLED THEM (B3.4): `resolveBase` resolves any basename naming exactly one file in
// the repo, so widening SOURCES no longer forces a hand-edit here. Adding a source IS now cheap.
//
// ⛔ The CARRIED ledger is a source. It is where the port's open reasoning now lives, and §11.6
// makes it a file steps are executed against. Left out, it becomes the next unscanned carrier —
// this exact defect, one file over.
const CITE_SOURCES = [
  'tools/port-uniform-delta.mjs',
  'body-condition-vector.js',
  'docs/FEATURES/one-pipeline-two-frontends-PLAN.md',
  'docs/FEATURES/one-pipeline-two-frontends-CARRIED.md',
  'tests/body-identity-fence.test.js',
  'src/worldengine/port/conditionFromPlanet.js',
  'tests/port-condition-contract.test.js',
  'tests/port-route-agreement.test.js',
  // ── STEP 6 (2026-08-09): eleven lane-touched files added. ⛔ NOT bookkeeping — verify found FOUR
  // §10-form refs in these files that were WRONG (main.js:7570/:7412 for text at :7573/:7415) and
  // that NO gate could see, because the files carrying them were outside this list. `check:instruments`
  // reported 27 broken while the true number was 31. A ref that is both wrong and ungated is the
  // failure §11.3.4 was written against, so the carriers join the scanned set in the same commit.
  'src/objects/Planet.js',
  'src/rendering/objects/BodyRenderer.js',
  'src/rendering/LabPlanetMaterial.js',
  'src/rendering/ShaderWarmup.js',
  'src/worldengine/drivers/index.js',
  'src/worldengine/drivers/giantDeck.js',
  'src/worldengine/port/writePackUniforms.js',
  'tests/gas-body-lab-material.test.js',
  'tests/material-parity-list.test.js',
  'tests/pack-contract.test.js',
  'tests/lab-surface-ratchet.test.js',
  // ── STEP 2 added two files and §11.3.4 wants every file a step edited inside this list: the delta
  // harness (974 lines — the densest new carrier of the port's reasoning since the adapter itself)
  // and the artifact it publishes. This is exactly the B4 defect one file over, so it is closed in
  // the same commit that creates the carriers rather than after the next round finds them.
  // ⚠ CHECKED BEFORE INSERTING, because B4's lesson is that widening this list has broken builds:
  // appending here shifts every line BELOW :1005 in this file, and the two live `line + symbol`
  // refs into it — CARRIED.md's B4 row citing :997 `const CITE_SOURCES = [`, and the contract test
  // citing :756 — both sit ABOVE the insertion and are therefore unmoved. There are no refs below.
  'tools/port-condition-delta.mjs',
  'docs/FEATURES/step2-tidal-delta-table.md',
  // ── STEP 3's two files, added for the same §11.3.4 reason and with a measured correction to the
  // note above. B4's stated coupling — "adding a CITE_SOURCE is NOT a one-line change, because the
  // mode exits 2 on an unknown basename by design" — NO LONGER REPRODUCES: round 4's `resolveBase`
  // decoupled CITE_SOURCES from CITE_FILES, and adding both of these needs ZERO new CITE_FILES
  // entries. Verified by running --check-citations with them added: exit 0.
  // ⛔ THAT GREEN IS THE TRAP, AND IT IS WHY THIS COMMENT EXISTS. Before Step 3 these two files
  // carried FOUR refs and every one was symbol-less, so adding them would have moved CHECKED by 0
  // and satisfied §11.3.4 while gating nothing. THREE OF THE FOUR WERE ALSO WRONG: two cited
  // planet-lod-lab.html:3010 (a river-overlay debounce) for a statement at :1955, and one cited
  // giant-drivers.js:235 — a BLANK LINE — for text at :231. An off-by-four onto a blank line
  // survives every check this fence runs: UNRESOLVED 0, PAST-EOF 0, MALFORMED 0, and it reads as
  // freshly verified. The refs were rewritten into `line + symbol` form in the same commit, so this
  // addition lands them in the FATAL column instead of the UNCHECKED pile. Adding a source and
  // GATING a source are different acts; only the second one closes the class (§11.2).
  'tests/radius-live-feed.test.js',
  'tests/radius-live-feed-fence.test.js',
];

// `Foo.js:123 \`sym\`` — or a bare `:123 \`sym\`` continuing the last filename on the same line.
const CITE_RE = /([A-Za-z0-9_.\-]+\.(?:js|mjs|html|md)):(\d+)|(?<![\w.\/:]):(\d+)/g;

function scanCitations(relSrc, text) {
  const out = [];
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!/:\d/.test(line)) continue;
    let lastFile = null, m;
    CITE_RE.lastIndex = 0;
    while ((m = CITE_RE.exec(line))) {
      let base, ln;
      if (m[1]) { base = m[1]; ln = +m[2]; lastFile = base; } else { base = lastFile; ln = +m[3]; }
      if (!base) continue;
      if (!/\.(js|mjs|html|md)$/.test(base)) continue;
      // The symbol, if any, is a backticked run IMMEDIATELY after the number.
      //
      // ⚠ BACKTICK PARITY, and it is the difference between a fence and a noise generator. In a
      // markdown/comment line the citation itself is often already inside a code span — "following
      // `uIceColor → Planet.js:1634` landed on `uIcenessMix`". There the next backtick CLOSES the
      // span, and a naive "first backtick after the number" reads the following PROSE span as the
      // symbol and reports a break that is not one. So: only treat the next backtick as a symbol
      // opener when an EVEN number of backticks precede the citation on this line.
      const before = line.slice(0, m.index);
      const insideSpan = ((before.match(/`/g) || []).length % 2) === 1;
      const after = line.slice(m.index + m[0].length);
      // ⭐ THE PARITY VERDICT IS ONLY A FACT ON A BALANCED LINE (round 4, B3.5). Counting the
      // backticks BEFORE the citation answers "am I inside a span?" only if every span on the line
      // actually closes. One stray backtick earlier — an apostrophe typed as a backtick, a `` in
      // prose, a fence marker — inverts the answer for every citation to its right, and the failure
      // is silent in the worst direction: a genuinely BROKEN §10-form ref
      // (`file:NNN` + a separate `symbol` span) is read as "inside a span", `after.indexOf` lands
      // on the SYMBOL SPAN'S OPENING backtick, the tail between them is empty, `spanSym` comes out
      // null, and the ref falls through to UNCHECKED — not even SPAN-OPEN. Same family as B3.2:
      // the correct citation form disappears while the vacuous one passes.
      //
      // On an unbalanced line the verdict is discarded rather than trusted in either direction, and
      // the STRICT §10 reading is used instead: the symbol span must be separated from the number
      // by exactly one space (a span CLOSING on the citation has its backtick flush against it,
      // with no space) and must not open or close on whitespace (prose caught between two spans
      // does). That discriminator is what keeps this from turning trailing prose into a false
      // BROKEN. Where it finds a symbol the ref is checked normally — a broken one stays a build
      // failure, so a stray backtick is not a way to silence a red citation. Where it finds none
      // the ref is listed under TICK-PARITY, which is printed and counted; the one thing it may
      // never do is join the 300-deep UNCHECKED pile.
      const oddTicks = ((line.match(/`/g) || []).length % 2) === 1;
      if (oddTicks) {
        const strict = /^ `([^`\n\s](?:[^`\n]{0,108}[^`\n\s])?)`/.exec(after);
        out.push({ src: relSrc, srcLine: i + 1, base, ln, sym: strict ? strict[1] : null, spanSym: null, oddTicks: true, raw: line.trim() });
        continue;
      }
      if (!insideSpan) {
        const sym = /^ ?`([^`\n]{1,110})`/.exec(after);
        out.push({ src: relSrc, srcLine: i + 1, base, ln, sym: sym ? sym[1] : null, spanSym: null });
        continue;
      }
      // ⭐ THE SILENT-DROP PATH, and why it is fixed here rather than counted (round 3, B3.2).
      // `insideSpan` above was a single verdict — "no symbol" — covering two shapes that are not
      // the same thing:
      //
      //   (a) prose that mentions a ref inside a span — one span holding `uIceColor → Planet.js`
      //       and a line number. The span ENDS at the number: no symbol, and UNCHECKED is honest.
      //   (b) THE WHOLE CITATION IN ONE SPAN — one span holding `storm-e.js`, a line number, AND
      //       `URANIAN_OBLIQUITY: 80`. A fully-formed `line + symbol` ref the parser cannot see.
      //       (Both shapes are written here WITHOUT a literal `file:NNN`, because this file is its
      //       own CITE_SOURCE: an illustration written in the live form becomes a live ref.)
      //
      // (b) used to fall into UNCHECKED — one more among 232, where nobody would ever find it. A
      // fence with a silent-drop path cannot be the thing that closes a class: the vacuous form
      // passed and the CORRECT form disappeared, so the fence was pushing citations away from the
      // shape it exists to enforce. Two live instances were in the tree when this was written.
      //
      // So: take the rest of the span as a candidate symbol and RESOLVE it. Resolving moves the ref
      // into CHECKED where it always belonged. Not resolving gets its own loud category — never
      // UNCHECKED — because the tool cannot tell a broken (b) from an ordinary (a) with trailing
      // prose, and saying so out loud is the honest report. Both are printed with the target line.
      const close = after.indexOf('`');
      // §10's THIRD documented form is the "quoted claim" — a line number followed by a quoted
      // sentence, and it is written inside one span, so it lands here. Strip one matching pair of
      // surrounding double quotes: without this the whole form was unverifiable, failing on the
      // quote characters alone. A documented-correct citation form that the fence cannot resolve
      // is the same defect as a silent drop, one level up.
      const tail = (close < 0 ? '' : after.slice(0, close)).trim()
        .replace(/^"([\s\S]*)"$/, '$1').replace(/^“([\s\S]*)”$/, '$1').trim();
      const spanSym = /[A-Za-z_$]/.test(tail) ? tail.slice(0, 110) : null;
      out.push({ src: relSrc, srcLine: i + 1, base, ln, sym: null, spanSym });
    }
  }
  return out;
}

// The comparison. Whitespace is normalised on both sides (a ref must survive re-indentation);
// nothing else is. A symbol either IS on that line or it is not.
//
// ⭐ TOKEN BOUNDARY — and why the first version of this line was a VACUOUS FENCE (round 3, B3.1).
// It read `normWs(text).includes(normWs(sym))`. Substring containment with whitespace deleted is
// true of almost every line in the repo for almost every short symbol: a ref whose symbol is `d`
// holds on `const s = and(x)` because `d` sits inside `and`; a ref whose symbol is `C` holds on
// `const CITE_SOURCES = [` four times over. True of any line is not a check, and this is the fence
// §11.2 leans on to close class N — so its own vacuity was the largest hole in the class.
//
// The rule now: the symbol must occur as a TOKEN. If it begins with an identifier character, the
// character before it must not be one; likewise at the end. (Same rule `\b` encodes, applied only
// on the sides where it is meaningful, so a symbol like `.iceness` or `= [` is not penalised for
// starting or ending on punctuation.)
//
// ⚠ The boundary is evaluated against the ORIGINAL line, never against the whitespace-stripped
// form — that distinction is load-bearing. On a whitespace-stripped target `export default class`
// and `export default classFoo` are indistinguishable and a boundary test there would reject the
// true ref. So whitespace tolerance is preserved (a run of whitespace in the SYMBOL matches any
// run of whitespace in the target, which is what re-indentation and wrapping do to a ref) while
// the boundary reads real characters: `export default class` still holds on
// `export default class Foo`, and `uIceColor` does NOT hold on `uIcenessMix`.
//
// ⭐ WHITESPACE IS FOLDED ONLY WHERE THE SYMBOL HAS WHITESPACE (round 4, B3.3). The previous
// version deleted whitespace from the symbol and then inserted `\s*` between EVERY pair of
// characters. That is not "tolerating re-indentation" — it is tolerating whitespace the symbol
// never had, which makes a MISSPELLED symbol pass: `constd` matched `const d = planetData || {};`
// because `\s*` was silently offered between the `t` and the `d`. A fence that accepts a typo is
// the vacuous-fence class B3.1 named, one layer down, so it is closed the same way: the symbol is
// split on its OWN whitespace runs, each chunk must match LITERALLY and contiguously, and only the
// seams between chunks are elastic. `const  CITE_SOURCES` (two spaces) still holds on
// `const CITE_SOURCES = [` (one space) — the wrap/re-indent tolerance the self-control probe
// guards — while `constd` no longer holds on anything but a literal `constd`.
const IDENT_CH = /[A-Za-z0-9_$]/;
// A symbol has to carry at least one LETTER-class character to anchor anything. Same test the
// one-span tail already used; see SYMBOL MUST NAME SOMETHING below for why it is now a gate.
const SYM_ANCHORING = /[A-Za-z_$]/;
const reEsc = (c) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function symMatcher(sym) {
  const raw = (sym == null ? '' : String(sym)).trim();
  const chunks = raw.split(/\s+/).filter(Boolean);
  if (!chunks.length) return null;
  const body = chunks.map((chunk) => [...chunk].map(reEsc).join('')).join('\\s*');
  const left = IDENT_CH.test(raw[0]) ? '(?<![A-Za-z0-9_$])' : '';
  const right = IDENT_CH.test(raw[raw.length - 1]) ? '(?![A-Za-z0-9_$])' : '';
  return new RegExp(left + body + right);
}

// ⛔ SYMBOL MUST NAME SOMETHING. A backticked run with no letter-class character in it — `//`,
// `= [`, `});` — is a citation form with the anchoring removed: it holds on every comment line,
// every array literal, every block close in the repo. That is B3.1's vacuous fence wearing the
// correct syntax, and it was slipping through as CHECKED. `citationHolds` refuses it here so no
// caller can accidentally count one, and `runCitationCheck` files such refs in their own printed,
// FATAL category rather than letting them inflate the CHECKED headline.
function citationHolds(cite, targetLines) {
  const text = targetLines[cite.ln - 1];
  if (text === undefined) return { ok: false, why: 'PAST EOF', text: '' };
  if (!SYM_ANCHORING.test(cite.sym == null ? '' : String(cite.sym))) {
    return { ok: false, why: 'symbol has no letter-class character — it anchors nothing', text: text.trim() };
  }
  const re = symMatcher(cite.sym);
  if (!re) return { ok: false, why: 'empty symbol', text: text.trim() };
  return { ok: re.test(text), why: 'symbol not on this line as a token', text: text.trim() };
}

// ═══ RESOLVING A BASENAME (round 4, B3.4) ════════════════════════════════════════════════════
// The charter twelve screens up says this mode "FAILS on a basename it does not know, rather than
// skipping it — a fence with a silent skip is the failure mode this whole instrument exists to
// catch." That was HALF TRUE, and the half that was false was the dangerous half: a ref WITH a
// symbol to an unknown basename was fatal, and a ref WITHOUT one was quietly filed under UNCHECKED,
// where it read as "known file, no symbol" — a different and repairable fact. 41 refs across 22
// basenames were sitting in that pile, two of them in this tool's own comments.
//
// The obvious repair — hand-add 22 entries to CITE_FILES — was written, run, and REJECTED on the
// evidence: it grew this file above `const CITE_SOURCES = [`, which moved that line from 997 to
// 1028, which broke a live symbol-checked citation to it in CARRIED.md. That is not a reason to
// leave the hole; it is the diagnosis. B4 already recorded that CITE_SOURCES and CITE_FILES are
// COUPLED, so widening one forces the other. The lasting fix is to DECOUPLE them: a basename that
// names exactly one file in the repo does not need a hand-written line to say so, and a map that
// has to enumerate every file the port's prose mentions is a map that will be behind by Tuesday.
//
// So: CITE_FILES stays as the curated override and always wins; anything else is resolved against
// an index of the repo. Exactly one match resolves. More than one is AMBIGUOUS and none is
// NOT-FOUND, and both are fatal for symbol-carrying AND symbol-less refs alike — which is the
// first time the charter sentence above has been true of the code under it.
const CITE_SKIP_DIRS = new Set(['node_modules', '.git', '.claude', 'dist', 'build', 'coverage']);
const CITE_EXT = /\.(js|mjs|html|md)$/;
let _repoIndex = null;
function repoIndex() {
  if (_repoIndex) return _repoIndex;
  const idx = new Map();
  const walk = (absDir, relDir) => {
    let ents;
    try { ents = fs.readdirSync(absDir, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      const rel = relDir ? `${relDir}/${e.name}` : e.name;
      if (e.isDirectory()) {
        if (CITE_SKIP_DIRS.has(e.name)) continue;
        walk(path.join(absDir, e.name), rel);
      } else if (e.isFile() && CITE_EXT.test(e.name)) {
        if (!idx.has(e.name)) idx.set(e.name, []);
        idx.get(e.name).push(rel);
      }
    }
  };
  walk(ROOT, '');
  _repoIndex = idx;
  return idx;
}

// ⚠ `.claude` is skipped because it holds WORKTREES — full second copies of this repo. Without
// that skip almost every basename is "ambiguous" against its own clone and the resolver reports
// nothing but noise. Verified: with the skip, all 22 previously-unresolved basenames match exactly
// one file; without it, `vite.config.js` alone matches four.
function resolveBase(base) {
  if (CITE_FILES[base]) return { rel: CITE_FILES[base], how: 'CITE_FILES override' };
  const hits = repoIndex().get(base) || [];
  if (hits.length === 1) return { rel: hits[0], how: 'unique basename in repo' };
  if (hits.length > 1) return { rel: null, how: 'AMBIGUOUS', candidates: hits };
  // ⛔ PREFIX ELISION, and it is a real citation shape, not a typo. PLAN.md writes a pair as
  // `cockpit-screens-lab-flight.js:1-9` and `-panels.js:1-9`, dropping the shared prefix from the
  // second. Dropping the ref because the name "looks wrong" is the silent skip again. So a base
  // that STARTS on a non-word character is allowed to match by suffix — and only when exactly one
  // file in the repo ends that way, so the elision cannot quietly land on the wrong file.
  if (/^[^A-Za-z0-9_$]/.test(base)) {
    const tail = [];
    for (const [name, paths] of repoIndex()) if (name.endsWith(base) && paths.length === 1) tail.push(paths[0]);
    if (tail.length === 1) return { rel: tail[0], how: 'elided prefix, unique suffix match' };
    if (tail.length > 1) return { rel: null, how: 'AMBIGUOUS (elided prefix)', candidates: tail };
  }
  return { rel: null, how: 'NOT FOUND in repo' };
}

function runCitationCheck() {
  console.log('── INSTRUMENT C · citation fence ' + '─'.repeat(57));
  console.log('  Checks every `file:NNN `symbol`` ref in the port\'s own reasoning files.');
  console.log('  A ref with no backticked symbol cannot be checked BY SYMBOL; its file and line range');
  console.log('  still are, and it is counted as UNCHECKED rather than skipped.');
  console.log('');

  // ⭐ NEGATIVE CONTROL, run every time, before the real check. Two synthetic citations against
  // this very file: one that must hold and one that must fail. If either comes out the other way
  // the resolver is broken and a green below would mean nothing. This is the answer to "0 failures"
  // being indistinguishable from "0 citations resolved".
  const selfLines = fs.readFileSync(path.resolve(ROOT, 'tools/port-uniform-delta.mjs'), 'utf8').split('\n');
  const anchorLn = selfLines.findIndex((l) => l.includes('const CITE_SOURCES = [')) + 1;
  const good = citationHolds({ ln: anchorLn, sym: 'const CITE_SOURCES = [' }, selfLines);
  const bad = citationHolds({ ln: anchorLn, sym: 'const CITE_FILES = {' }, selfLines);
  // ⭐ THE THIRD PROBE IS THE ONE B3.1 ADDS, and it is the one the old fence failed. `C` occurs on
  // the anchor line four times — inside `const`, and three times inside `CITE_SOURCES` — and never
  // as a token. Under substring containment it HELD, which is what made a one-letter symbol a ref
  // that passes on almost any line. It must now fail. If the anchor line is ever rewritten so that
  // a bare `C` IS a token there, this exits 3 and says so — the loud direction, not a silent pass.
  const substr = citationHolds({ ln: anchorLn, sym: 'C' }, selfLines);
  // ⭐ AND ITS MIRROR — the probe round 4 had to add, because round 3's set could not see half of
  // its own rule. The token boundary has TWO halves. `C` above is killed by the RIGHT half alone
  // (it is followed by `o` in `const` and by `I`/`E` inside `CITE_SOURCES`), so deleting the LEFT
  // half changed nothing any probe could observe: a mutant that removed the left lookbehind kept
  // the whole self-control GREEN. A control that cannot move is not a control.
  //
  // `SOURCES` is the mirror case: on the anchor line it is a SUFFIX of `CITE_SOURCES`, so the
  // character before it is `_` (an identifier character) and the character after it is a space.
  // Only the LEFT lookbehind can reject it. It must NOT hold. If the anchor line is ever rewritten
  // so `SOURCES` stands alone as a token there, this exits 3 and says so — the loud direction.
  const suffix = citationHolds({ ln: anchorLn, sym: 'SOURCES' }, selfLines);
  // And the companion: whitespace tolerance must survive the boundary rule. A multi-word symbol
  // whose last character abuts a space in the target is a TRUE ref and must still hold.
  const spaced = citationHolds({ ln: anchorLn, sym: 'const  CITE_SOURCES' }, selfLines);
  // ⭐ AND THE MIRROR OF *THAT* — the probe that pins whitespace folding to the symbol's own
  // whitespace (B3.3). `constCITE_SOURCES` has no whitespace, so no elastic seam may be invented
  // for it; it must NOT hold on `const CITE_SOURCES = [`. Removing the fold entirely kills
  // `spaced`; making the fold universal again (the old `\s*`-between-every-character rule) makes
  // this one hold. The pair brackets the behaviour from both sides — neither probe alone does.
  const glued = citationHolds({ ln: anchorLn, sym: 'constCITE_SOURCES' }, selfLines);
  // ⭐ AND THE VACUOUS-SYMBOL PROBE. A symbol with no letter-class character anchors nothing —
  // `= [` occurs on the anchor line and on thousands of others. `citationHolds` must refuse it
  // rather than report a match, or the punctuation-only ref is a fence that always passes.
  const punct = citationHolds({ ln: anchorLn, sym: '= [' }, selfLines);
  if (!anchorLn || !good.ok || bad.ok || substr.ok || suffix.ok || !spaced.ok || glued.ok || punct.ok) {
    console.error('⛔ CITATION-FENCE SELF-CONTROL FAILED — the resolver does not distinguish a correct');
    console.error(`   ref from a wrong one (anchor line ${anchorLn}, good=${good.ok}, bad-must-be-false=${bad.ok},`);
    console.error(`   non-token-substring-must-be-false=${substr.ok}, token-SUFFIX-must-be-false=${suffix.ok},`);
    console.error(`   whitespace-tolerant=${spaced.ok}, invented-fold-must-be-false=${glued.ok},`);
    console.error(`   punctuation-only-must-be-false=${punct.ok}).`);
    console.error('   Every result below would be meaningless. Exit 3.');
    process.exit(3);
  }
  console.log(`  self-control    : PASS (a true ref at :${anchorLn} holds; a false one at the same line does not;`);
  console.log('                    a non-token substring does NOT hold and neither does a token SUFFIX (the two');
  console.log('                    halves of the boundary, probed separately); whitespace still folds where the');
  console.log('                    symbol has whitespace and NOT where it does not; punctuation-only is refused)');

  const targetCache = new Map();
  const readTarget = (base) => {
    if (!targetCache.has(base)) {
      const rel = resolveBase(base).rel;
      targetCache.set(base, rel && fs.existsSync(path.resolve(ROOT, rel))
        ? fs.readFileSync(path.resolve(ROOT, rel), 'utf8').split('\n') : null);
    }
    return targetCache.get(base);
  };

  // A CITE_FILES entry that points at a path which no longer exists resolves to `null` and every
  // ref through it reports as "basename not in CITE_FILES" — a true failure with a false reason,
  // which is the navigational-rot class this instrument exists to catch, inside the instrument.
  // Say the real thing instead, and say it before any count is printed.
  const deadEntries = Object.entries(CITE_FILES).filter(([, rel]) => !fs.existsSync(path.resolve(ROOT, rel)));
  if (deadEntries.length) {
    console.error('⛔ CITE_FILES maps basenames to paths that DO NOT EXIST. Refs through them would be');
    console.error('   reported as unknown basenames, which is the wrong reason for the right failure.');
    for (const [b, rel] of deadEntries) console.error(`     ${b} → ${rel}`);
    process.exit(3);
  }

  // The illustrative list may only ever hold names that are NOT files. If one becomes real, the
  // list is silently swallowing refs into it — the exact thing it was added to avoid.
  for (const base of CITE_ILLUSTRATIVE) {
    const collides = Object.prototype.hasOwnProperty.call(CITE_FILES, base);
    if (collides) {
      console.error(`⛔ CITE_ILLUSTRATIVE and CITE_FILES both claim "${base}". One of them is wrong and`);
      console.error('   refs to it are being classified by list order rather than by fact. Exit 3.');
      process.exit(3);
    }
  }

  const broken = [], unknown = [], unchecked = [], spanOpen = [], illustrative = [];
  const unknownNoSym = [], punctOnly = [], tickParity = [], pastEof = [];
  let checked = 0, spanRecovered = 0;
  for (const rel of CITE_SOURCES) {
    const abs = path.resolve(ROOT, rel);
    if (!fs.existsSync(abs)) { console.error(`⛔ CITE_SOURCES lists a file that does not exist: ${rel}`); process.exit(2); }
    for (const c of scanCitations(rel, fs.readFileSync(abs, 'utf8'))) {
      if (CITE_ILLUSTRATIVE.has(c.base)) { illustrative.push(c); continue; }
      // Whole-citation-in-one-code-span. Resolve it if it resolves; report it if it does not.
      // The one thing it must never do is join the UNCHECKED pile — see scanCitations.
      if (c.spanSym) {
        const sres = resolveBase(c.base);
        const tgt = sres.rel ? readTarget(c.base) : null;
        if (!tgt) { spanOpen.push({ ...c, actual: '', why: `basename unresolvable — ${sres.how}` }); continue; }
        const r = citationHolds({ ...c, sym: c.spanSym }, tgt);
        if (r.ok) { checked++; spanRecovered++; continue; }
        spanOpen.push({ ...c, actual: r.text, why: r.why });
        continue;
      }
      // ⛔ AN UNKNOWN BASENAME IS UNRESOLVED WHETHER OR NOT IT CARRIES A SYMBOL (round 4, B3.4).
      // This line used to read `(c.sym ? unknown : unchecked).push(c)`. The symbol-less half of
      // that ternary was a SILENT SKIP wearing UNCHECKED's clothes, and it flatly contradicted
      // this mode's own charter twelve screens up — "this mode FAILS on a basename it does not
      // know, rather than skipping it — a fence with a silent skip is the failure mode this whole
      // instrument exists to catch." Two live instances were sitting in the tool's OWN UNCHECKED
      // dump when this was found: `vite.config.js:37` and `scene-naming.js:20`, both in the
      // node-resolution note near the top of this file. UNCHECKED means "we know the file, we just
      // have no symbol to anchor to"; it must never mean "we have no idea what file this is."
      // Those are different facts and only one of them is repairable by writing a better citation.
      const res = resolveBase(c.base);
      if (!res.rel) { (c.sym ? unknown : unknownNoSym).push({ ...c, how: res.how, candidates: res.candidates }); continue; }
      // ⭐ A SYMBOL-LESS REF IS NOT UNVERIFIABLE — IT IS ONLY UNVERIFIABLE BY SYMBOL. The file is
      // known now, so the one fact the ref does assert can be checked: that the line EXISTS. A ref
      // to line 903 of a 726-line document is broken however you read it, and it used to sit in
      // the UNCHECKED pile as "trust, not verification" alongside refs that were merely unanchored.
      if (!c.sym) {
        // Unbalanced source line and no §10-form symbol recovered: the ref cannot be trusted in
        // either direction, so it is named rather than buried. Never UNCHECKED — see scanCitations.
        if (c.oddTicks) { tickParity.push({ ...c, why: 'odd backtick count on the source line; no `symbol` span follows the number', actual: c.raw }); continue; }
        const tgt = readTarget(c.base);
        if (tgt && tgt[c.ln - 1] === undefined) { pastEof.push({ ...c, rel: res.rel, lines: tgt.length }); continue; }
        unchecked.push(c); continue;
      }
      // A backticked run with no letter-class character anchors nothing — see SYMBOL MUST NAME
      // SOMETHING. It is not CHECKED and it is not BROKEN (the target line is irrelevant to it);
      // it is a malformed ref, and it gets said out loud.
      if (!SYM_ANCHORING.test(c.sym)) { punctOnly.push(c); continue; }
      const tgt = readTarget(c.base);
      if (!tgt) { unknown.push(c); continue; }
      const r = citationHolds(c, tgt);
      checked++;
      if (!r.ok) broken.push({ ...c, actual: r.text });
    }
  }

  console.log(`  refs CHECKED    : ${checked}   (line + symbol${spanRecovered ? `, ${spanRecovered} of them recovered from a one-span citation` : ''})`);
  console.log(`  refs UNCHECKED  : ${unchecked.length}  (line, no symbol — cannot be verified mechanically)`);
  console.log(`  refs UNRESOLVED : ${unknown.length + unknownNoSym.length}  (basename resolves to no file, or to more than one — ${unknown.length} with a symbol,`);
  console.log(`                       ${unknownNoSym.length} without. BOTH are unresolved: not knowing the file is not the`);
  console.log('                       same fact as not having a symbol, and only the second belongs in UNCHECKED)');
  console.log(`  refs PAST-EOF   : ${pastEof.length}  (symbol-less ref whose LINE does not exist in the resolved file —`);
  console.log('                       the one thing an unanchored ref does assert, and it is checkable)');
  console.log(`  refs MALFORMED  : ${punctOnly.length}  (backticked symbol with no letter-class character — anchors nothing)`);
  console.log(`  refs TICK-PARITY: ${tickParity.length}  (odd backtick count on the source line, so the in-span/out-of-span`);
  console.log('                       verdict is void — printed, NEVER folded into UNCHECKED)');
  console.log(`  refs SPAN-OPEN  : ${spanOpen.length}  (whole citation in ONE code span, tail did not resolve — listed below,`);
  console.log('                       NEVER folded into UNCHECKED; that fold is the defect B3.2 names)');
  console.log(`  refs ILLUSTRATIVE: ${illustrative.length}  (basename in CITE_ILLUSTRATIVE — an example OF the citation form,`);
  console.log('                       not a ref to a file; enumerated and printed, never skipped)');
  for (const c of illustrative) {
    console.log(`     ${c.src}:${c.srcLine}  ${c.base}:${c.ln}${c.sym ? ` \`${c.sym}\`` : ''}`);
    const real = fs.existsSync(path.resolve(ROOT, c.base));
    if (real) {
      console.error(`⛔ "${c.base}" is listed as illustrative but a file by that name EXISTS at the repo root.`);
      console.error('   This list is now hiding a real ref. Remove it from CITE_ILLUSTRATIVE. Exit 3.');
      process.exit(3);
    }
  }
  console.log('');

  if (unknown.length) {
    console.log('⛔ UNRESOLVED — these use the CHECKED form `file:NNN `symbol`` but the basename names no');
    console.log('   file in the repo, or names more than one, so the fence cannot verify them. Fix the name');
    console.log('   or add a CITE_FILES entry to disambiguate; do not delete the ref.');
    for (const u of unknown) console.log(`     ${u.src}:${u.srcLine}  ${u.base}:${u.ln} \`${u.sym}\``);
    console.log('');
  }
  if (unknownNoSym.length) {
    console.log('⛔ UNRESOLVED (no symbol) — a line-number ref whose basename names no file in the repo, or');
    console.log('   names more than one. These used to be filed as UNCHECKED, which reads as "known file, no');
    console.log('   symbol" — a different and repairable fact — and directly contradicted this mode\'s own');
    console.log('   charter. Fix the name, add a CITE_FILES entry to disambiguate, or, if the name is an');
    console.log('   example OF the citation form rather than a ref to a file, add it to CITE_ILLUSTRATIVE.');
    const byBase = {};
    for (const u of unknownNoSym) (byBase[u.base] ||= []).push(u);
    for (const [b, list] of Object.entries(byBase)) {
      console.log(`     ${b}  ×${list.length}  [${list[0].how}]   ${list.slice(0, 6).map((u) => `${u.src}:${u.srcLine}→:${u.ln}`).join('  ')}${list.length > 6 ? '  …' : ''}`);
      if (list[0].candidates) console.log(`         candidates: ${list[0].candidates.slice(0, 6).join('  ')}`);
    }
    console.log('');
  }
  if (pastEof.length) {
    console.log('⛔ PAST EOF — a symbol-less ref whose line number does not exist in the file it names. An');
    console.log('   unanchored ref asserts exactly one thing; this is that one thing being false.');
    for (const p of pastEof) console.log(`     ${p.src}:${p.srcLine}  cites  ${p.base}:${p.ln}  but ${p.rel} has ${p.lines} lines`);
    console.log('');
  }
  if (punctOnly.length) {
    console.log('⛔ MALFORMED SYMBOL — the backticked run carries no letter-class character, so it holds on');
    console.log('   any line with the same punctuation. `//` holds on every comment; `= [` on every array');
    console.log('   literal. This is the correct citation SYNTAX with the anchoring removed — B3.1\'s');
    console.log('   vacuous fence in disguise — so it is refused rather than counted as CHECKED.');
    for (const p of punctOnly) console.log(`     ${p.src}:${p.srcLine}  cites  ${p.base}:${p.ln} \`${p.sym}\``);
    console.log('');
  }
  if (tickParity.length) {
    console.log('⚠ TICK-PARITY — the SOURCE line holds an odd number of backticks, so at least one code span');
    console.log('   on it is unterminated and the "is this citation inside a span?" verdict is not a fact.');
    console.log('   A ref here cannot be trusted in EITHER direction, so it is never filed as UNCHECKED:');
    console.log('   one unmatched backtick earlier on the line used to demote a genuinely broken §10-form');
    console.log('   citation into the UNCHECKED pile, invisible among hundreds. Where the plain §10 reading');
    console.log('   resolves it is taken and CHECKED; where it does not, the ref is listed here rather than');
    console.log('   failed, because prose is not a build error. Balance the backticks on the source line.');
    for (const t of tickParity) {
      console.log(`     ${t.src}:${t.srcLine}  cites  ${t.base}:${t.ln}${t.sym ? ` \`${t.sym}\`` : ' (no symbol recovered)'}  [${t.why}]`);
      if (t.actual) console.log(`         that line actually reads: ${t.actual.slice(0, 100)}`);
    }
    console.log('');
  }
  // ⭐ PRINTED BEFORE THE BROKEN BLOCK, ON PURPOSE. `broken` exits the process, so anything
  // printed after it is invisible on exactly the runs where the file is being worked on. A
  // category that only shows up when everything else is green is a silent drop with extra steps.
  if (spanOpen.length) {
    console.log('⚠ SPAN-OPEN — the whole citation sits inside ONE code span, so the `file:NNN `symbol``');
    console.log('   parser cannot see a symbol, and the rest of the span does NOT hold on the cited line.');
    console.log('   Each is EITHER a broken citation OR ordinary prose that happens to trail a ref inside a');
    console.log('   span. This tool cannot tell those apart — which is exactly why it prints them instead of');
    console.log('   dropping them into UNCHECKED, where one more among hundreds is invisible. Read each and');
    console.log('   decide: re-write a real ref as `file:NNN` followed by a SEPARATE `symbol` span, or leave');
    console.log('   prose as prose. Non-fatal by design: making prose a build failure would be a false gate.');
    for (const s of spanOpen) {
      console.log(`     ${s.src}:${s.srcLine}  cites  ${s.base}:${s.ln}  span tail: ${JSON.stringify(s.spanSym.slice(0, 80))}  [${s.why}]`);
      if (s.actual) console.log(`         that line actually reads: ${s.actual.slice(0, 100)}`);
    }
    console.log('');
  }
  if (broken.length) {
    console.log('⛔ BROKEN CITATIONS — the symbol is NOT on the cited line:');
    for (const b of broken) {
      console.log(`     ${b.src}:${b.srcLine}  cites  ${b.base}:${b.ln} \`${b.sym}\``);
      console.log(`         that line actually reads: ${b.actual.slice(0, 100)}`);
    }
    console.log('');
    console.log('   ⭐ Do NOT just bump the integer. Open the file, confirm which line carries the');
    console.log('      SYMBOL, and cite that — a ref repaired to a second wrong line is worse than the');
    console.log('      stale one, because it now reads as freshly verified.');
    console.log('');
    console.log(`RESULT: ${broken.length} BROKEN CITATION(S). Exit 2.`);
    process.exit(2);
  }
  if (unknown.length || unknownNoSym.length) { console.log(`RESULT: ${unknown.length + unknownNoSym.length} unresolved basename ref(s). Exit 2.`); process.exit(2); }
  if (pastEof.length) { console.log(`RESULT: ${pastEof.length} ref(s) past end of file. Exit 2.`); process.exit(2); }
  if (punctOnly.length) { console.log(`RESULT: ${punctOnly.length} malformed (anchor-less) symbol(s). Exit 2.`); process.exit(2); }

  if (unchecked.length) {
    console.log('  UNCHECKED refs (line number only — trust, not verification):');
    const byFile = {};
    for (const u of unchecked) (byFile[u.src] ||= []).push(`${u.base}:${u.ln}`);
    for (const [f, list] of Object.entries(byFile)) {
      console.log(`     ${f}: ${list.length}`);
      console.log(`        ${[...new Set(list)].slice(0, 12).join('  ')}${list.length > 12 ? '  …' : ''}`);
    }
    console.log('   Converting one of these to `file:NNN `symbol`` moves it into the checked column.');
    console.log('');
  }
  console.log(`RESULT: all ${checked} symbol-anchored citations resolve. Exit 0.`);
  process.exit(0);
}

if (MODE === 'check-citations') runCitationCheck();

function gitHead() {
  try {
    const sha = execFileSync('git', ['-C', ROOT, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    const dirty = execFileSync('git', ['-C', ROOT, 'status', '--porcelain'], { encoding: 'utf8' }).trim().length > 0;
    return { sha, dirty };
  } catch { return { sha: 'unknown', dirty: null }; }
}

const fmt = (x) => (Number.isNaN(x) ? '—' : x === 0 ? '0.000000e+0' : x.toExponential(6)).padStart(14);

function printResolution(res) {
  const c = res.counts;
  console.log('── WATCHED UNIFORM RESOLUTION ' + '─'.repeat(59));
  console.log(`  src/objects/Planet.js production material : ${c.game} uniforms`);
  console.log(`  planet-lod-uniforms.js  makeUniforms()    : ${c.lab} uniforms`);
  console.log(`  WATCHED                                   : ${c.shared}`);
  console.log(`      name-matched  (same spelling)         : ${c.nameMatched}`);
  console.log(`      aliased       (same value, two names) : ${c.aliased}`);
  console.log(`      game-only     (no lab counterpart)    : ${c.gameOnly}`);
  console.log(`  deliberately UNWATCHED                    : ${c.unwatched}   (each with a named reason, below)`);
  console.log('  ⭐ Matched by VALUE SOURCE, not spelling. When this map was written a pure name');
  console.log('     intersection watched 27 and missed uWeatheredColor / uLavaGlow / uLavaCrust —');
  console.log('     three of the four quantities Step 2\'s own gate names (PLAN.md:212 `committed delta table`). The first of');
  console.log('     those was a DRIFTED SPELLING and has since been unified (2026-08-06), which is');
  console.log('     why it now reads name-matched. See THE UNIFORM MAP in this file.');
  console.log('');
  const byTier = {};
  for (const n of res.shared) (byTier[res.shapes[n].tier] ||= []).push(n);
  console.log(`  ${'UNIFORM'.padEnd(20)} ${'TIER'.padEnd(10)} ${'ORIGIN'.padEnd(12)} ${'GAME KIND'.padEnd(11)} ${'LAB NAME'.padEnd(18)} ARITY`);
  console.log('  ' + '─'.repeat(80));
  for (const n of res.shared) {
    const s = res.shapes[n];
    const lab = s.labName ? `${s.labName}${s.labName === n ? '' : ' ⭐'}` : '—';
    console.log(`  ${n.padEnd(20)} ${s.tier.padEnd(10)} ${s.origin.padEnd(12)} ${String(s.gameKind).padEnd(11)} ${lab.padEnd(18)} ${s.arity}`);
  }
  console.log('');
  console.log(`  tier census: ${Object.entries(byTier).sort().map(([t, a]) => `${t}=${a.length}`).join(' · ')}`);
  console.log('    bake      the ONLY detector — these five planetData fields are excluded from the');
  console.log('              body-identity fingerprint on purpose (WORLDENGINE_BAKES, shared with');
  console.log('              Instrument B). Step 2\'s declared gate lives entirely in this tier.');
  console.log('    condition computed in Planet._createSurface from conditionFromPlanet(d); never on');
  console.log('              the record, so likewise only visible here.');
  console.log('    gate      a Planet.js constant that multiplies world-engine output. Constant across');
  console.log('              the population by construction — a zero delta proves the dial held.');
  console.log('    record    ⚠ FINGERPRINT-SHADOWED. Reads a DRAWN planetData field, so a change to the');
  console.log('              RECORD moves the body fingerprint, excludes the body, and leaves this row');
  console.log('              reading 0.000000e+0 — entirely true and entirely misleading if read while');
  console.log('              POPULATION MISMATCH is red. It still catches the other half: a change to');
  console.log('              how Planet.js READS the record moves the uniform and not the record.');
  console.log('');
  console.log(`  ── DELIBERATELY UNWATCHED (${res.unwatched.length}) ` + '─'.repeat(50));
  for (const u of res.unwatched) {
    console.log(`    ${u.game.padEnd(20)} ${u.reason.padEnd(14)} ${u.why}`);
  }
  console.log('    runtime       the renderer overwrites it after construction; the value read here is a');
  console.log('                  placeholder that never reaches a pixel.');
  console.log('    harness-blind sourced from the `starInfo` 2nd constructor arg, which this harness never');
  console.log('                  passes — every body would record the same fallback.');
  console.log('');
  if (UNIFIED_NAMES.length) {
    console.log('  ── UNIFIED NAMES — were aliases, now ONE spelling (documentation only) ' + '─'.repeat(9));
    for (const un of UNIFIED_NAMES) {
      console.log(`    ${un.name}  ⟵ was lab \`${un.wasLab}\` until ${un.unifiedOn}\n        ${un.why}`);
    }
    console.log('    ⛔ These are NOT alias rows: a unified pair is name-matched, and an alias for a');
    console.log('       name-matched uniform is a contradiction the fence rejects. A RE-divergence is');
    console.log('       caught by the completeness fence instead — the game name stops being matched,');
    console.log('       falls into no bucket, and this tool exits 2 rather than quietly narrowing.');
    console.log('');
  }
  if (COLLISIONS.length) {
    console.log('  ── NAME COLLISIONS — look like aliases, are NOT (documentation only) ' + '─'.repeat(11));
    for (const c2 of COLLISIONS) console.log(`    ${c2.game} ✗ ${c2.lab}\n        ${c2.why}`);
    console.log('');
  }
}

// ── probe body: any generated body resolves the uniform SET (the key set is type-independent —
//    Planet._createSurface builds one object literal for every type; verified across all 18).
const probeRec = toSceneData(PlanetGenerator.generate(new SeededRandom(20260806), 1.0, null, null, 'rocky'));
const probeU = new Planet(probeRec).surface.material.uniforms;
const RES = resolveSharedUniforms(probeU);

if (MODE === 'list') {
  printResolution(RES);
  console.log('  (--list resolves and exits; no bodies were generated.)');
  process.exit(0);
}

const pop = MODE === 'record'
  ? { ...DEFAULT_POP }
  : null; // filled from the capture below

// ── RECORD ────────────────────────────────────────────────────────────────────────────────────
if (MODE === 'record') {
  if (fs.existsSync(CAPTURE) && !has('--force')) {
    console.error(`refusing to overwrite an existing capture: ${CAPTURE}`);
    console.error('A blanket re-record is how a regression becomes the new baseline. Pass --force');
    console.error('only as a deliberate, named re-bless (PLAN.md:549 — "never a blanket re-record").');
    process.exit(65);
  }
  printResolution(RES);
  const t0 = Date.now();
  const bodies = buildPopulation(pop);
  const { rows, failures } = measure(bodies, RES.shared);

  // Determinism self-check: rebuild the population from the same seeds and require an identical
  // fingerprint sequence. If generation is not a pure function of its seeds, every later delta is
  // noise, and finding that out here is much cheaper than finding it out mid-gate.
  const rows2 = measure(buildPopulation(pop), RES.shared).rows;
  const detOk = rows.length === rows2.length && rows.every((r, i) => r.id === rows2[i].id && r.fp === rows2[i].fp);
  if (!detOk) {
    console.error('DETERMINISM SELF-CHECK FAILED — two builds from identical seeds produced different bodies.');
    console.error('Instrument C cannot be recorded against a non-deterministic population.');
    process.exit(70);
  }

  const byStratum = {}; const byType = {};
  for (const r of rows) { byStratum[r.stratum] = (byStratum[r.stratum] || 0) + 1; byType[r.type] = (byType[r.type] || 0) + 1; }
  const moonBearing = rows.filter((r) => r.moonCount > 0).length;

  const capture = {
    instrument: 'C — shipped-uniform delta harness (one-pipeline-two-frontends-PLAN.md Step 0)',
    recordedAtGit: gitHead(),
    tool: path.relative(ROOT, fileURLToPath(import.meta.url)),
    population: pop,
    uniforms: RES.shared,
    shapes: RES.shapes,
    counts: RES.counts,
    gameOnly: RES.gameOnly,
    summary: { bodies: rows.length, byStratum, byType, moonBearing, failures: failures.length },
    failures,
    rows,
  };
  fs.mkdirSync(path.dirname(CAPTURE), { recursive: true });
  fs.writeFileSync(CAPTURE, JSON.stringify(capture, null, 0) + '\n');

  console.log('── POPULATION ' + '─'.repeat(75));
  console.log(`  bodies measured : ${rows.length}   (S=${byStratum.S || 0} systems · P=${byStratum.P || 0} planet-class moons · G=${byStratum.G || 0} forced-type grid)`);
  console.log(`  moon-bearing    : ${moonBearing}`);
  console.log(`  by type         : ${Object.entries(byType).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join(' ')}`);
  console.log(`  build failures  : ${failures.length}${failures.length ? ' → ' + failures.slice(0, 5).map(f => f.id).join(', ') : ''}`);
  console.log(`  determinism     : PASS (two builds from identical seeds, ${rows.length} identical fingerprints)`);
  console.log('');

  // ── What this population can and cannot catch ────────────────────────────────────────────────
  // A "zero delta" is only evidence for uniforms that actually VARY here. A uniform that is the
  // same constant on all 526 bodies would report zero delta forever — including after a change
  // that broke it — right up until the constant itself moved. That is the exact shape of failure
  // this codebase is prone to: a measurement entirely true and entirely misleading. So the
  // capture states its own blind spots rather than leaving the reader to assume coverage.
  // DISTINCT COUNT ALONE IS NOT ENOUGH, and the difference matters. uCraterDensity has 6 distinct
  // values, which reads like variation — but 521 of 526 bodies carry the SAME one (0, craters off,
  // because every rocky body the game generates retains an atmosphere; see the in-source note at
  // Planet.js:1548-1560). Its real sensitivity is FIVE bodies. So the modal share is printed next
  // to the distinct count, and anything ≥90% modal is called out as weak evidence.
  console.log('── SENSITIVITY — what a "zero delta" on this population is worth, per uniform ' + '─'.repeat(11));
  const sens = RES.shared.map((n, i) => {
    const m = new Map();
    for (const r of rows) { const k = JSON.stringify(r.v[i]); m.set(k, (m.get(k) || 0) + 1); }
    const modal = Math.max(...m.values());
    return { n, distinct: m.size, modal, share: modal / rows.length, effective: rows.length - modal };
  }).sort((a, b) => a.share - b.share || b.distinct - a.distinct);
  console.log(`  ${'UNIFORM'.padEnd(20)} ${'DISTINCT'.padStart(8)} ${'MODAL'.padStart(7)} ${'MODAL%'.padStart(7)}   EVIDENCE`);
  console.log('  ' + '─'.repeat(70));
  for (const s of sens) {
    const verdict = s.distinct <= 1 ? '⛔ CONSTANT — a zero delta here proves only that a hardcoded constant held'
      : s.share >= 0.90 ? `⚠ NEAR-CONSTANT — only ${s.effective} body(ies) carry anything else`
        : 'ok';
    console.log(`  ${s.n.padEnd(20)} ${String(s.distinct).padStart(8)} ${String(s.modal).padStart(7)} ${(s.share * 100).toFixed(1).padStart(6)}%   ${verdict}`);
  }
  const weak = sens.filter((s) => s.share >= 0.90);
  if (weak.length) {
    console.log('');
    console.log(`  ⚠ ${weak.length} of ${RES.shared.length} shared uniforms are constant or near-constant on this population.`);
    console.log('    A GREEN --check is strong evidence for the other ' + (RES.shared.length - weak.length) + ' and weak evidence for these.');
    console.log('    That is a fact about the GAME\'S BODIES, not a defect in the harness — and it is printed');
    console.log('    here so nobody reads a clean table as coverage it does not have.');
  }
  console.log('');
  console.log(`RECORDED ${rows.length} bodies × ${RES.shared.length} shared uniforms → ${path.relative(ROOT, CAPTURE)}  (${(fs.statSync(CAPTURE).size / 1024).toFixed(0)} KB, ${Date.now() - t0} ms)`);
  console.log('This capture is a BEFORE. --check measures the SAME seeds on the SAME route after a change.');
  process.exit(0);
}


// ═════════════════════════════════════════════════════════════════════════════════════════════
// COMPARE + REPORT  (shared by --check and --selftest)
// ═════════════════════════════════════════════════════════════════════════════════════════════
// `cap` is a capture object (from disk on --check, synthesised in-process on --selftest).
// `nowMeasured` is {rows, failures} from measure(). Returns {structural, stats, movedUniforms}.
function compareAndReport(cap, nowMeasured, RES) {
  let structural = 0;

  // 1) Uniform SET drift. A grown or shrunk shared set means the gate's own subject changed.
  const capSet = cap.uniforms.slice().sort();
  const nowSet = RES.shared.slice().sort();
  const added = nowSet.filter((n) => !capSet.includes(n));
  const removed = capSet.filter((n) => !nowSet.includes(n));
  const c = RES.counts;
  const composition = `${c.nameMatched} name-matched + ${c.aliased} aliased + ${c.gameOnly} game-only`
    + `, ${c.unwatched} deliberately unwatched of ${c.game}`;
  if (added.length || removed.length) {
    structural++;
    console.log('⛔ WATCHED-UNIFORM SET CHANGED since the capture:');
    if (added.length) console.log(`     added   (+${added.length}): ${added.join(', ')}`);
    if (removed.length) console.log(`     removed (-${removed.length}): ${removed.join(', ')}`);
    console.log(`   now: ${nowSet.length} watched = ${composition}`);
    console.log('   Deltas below cover the INTERSECTION only. Re-record deliberately once understood.');
    console.log('');
  } else {
    // ⭐ The composition, never a bare count. "27 uniforms, UNCHANGED" was true for months while
    // three of the four quantities Step 2's gate names were outside the set entirely.
    console.log(`  watched-uniform set: UNCHANGED (${nowSet.length} = ${composition})`);
  }

  // ── COMPOSITION DRIFT. The capture writes a `counts` block and, until 2026-08-07, NOTHING EVER
  //    READ IT. Adversarial review finding 8: the committed capture said "27 name-matched + 8
  //    aliased" while the live tool printed "28 + 7" — the classification had moved under the
  //    uWeatheredColor rename and the record still answered "how was this classified?" with the
  //    answer from before. True at record time, false now, and no gate could see it, because the
  //    comparison key is the NAME LIST and the name list was unchanged.
  //
  //    ⛔ THIS IS NOT A FAILURE, and making it one would be the wrong fix: it would force a
  //    re-record — a 526-body re-baseline — to clear a metadata mismatch, which is exactly the
  //    "re-record to make the instrument green" move this plan forbids. It is a NOTE that names
  //    what moved and what it does and does not mean.
  const capC = cap.counts;
  if (capC) {
    const keys = ['game', 'lab', 'shared', 'nameMatched', 'aliased', 'gameOnly', 'unwatched'];
    const moved = keys.filter((k) => capC[k] !== undefined && capC[k] !== c[k]);
    if (moved.length) {
      console.log('  ⓘ COMPOSITION DRIFT since the capture (the SET is identical; only its');
      console.log('    classification moved, so this is descriptive, not a comparison failure):');
      for (const k of moved) console.log(`       ${k.padEnd(12)} recorded ${capC[k]}  →  now ${c[k]}`);
      console.log('    A uniform moving between name-matched and aliased means the two frontends');
      console.log('    agreed or diverged on a SPELLING; the watched set, and therefore every delta');
      console.log('    below, is unaffected. Clear it on the next DELIBERATE --record, at a clean');
      console.log('    commit — never by re-recording to silence this line.');
    }
  }

  // 2) Shape / kind drift on a still-shared uniform (Vector3 → Color is a silent semantic swap).
  const shapeDrift = [];
  for (const n of nowSet) {
    if (!cap.shapes[n]) continue;
    const a = cap.shapes[n], b = RES.shapes[n];
    if (a.gameKind !== b.gameKind || a.arity !== b.arity) {
      shapeDrift.push({ n, from: `${a.gameKind}/${a.arity}`, to: `${b.gameKind}/${b.arity}` });
    }
  }
  if (shapeDrift.length) {
    structural++;
    console.log('⛔ UNIFORM SHAPE CHANGED:');
    for (const d of shapeDrift) console.log(`     ${d.n}: ${d.from} → ${d.to}`);
    console.log('');
  }

  // 3) Body-by-body identity.
  const nowById = new Map(nowMeasured.rows.map((r) => [r.id, r]));
  const missing = [], appeared = [], fpMoved = [];
  for (const br of cap.rows) {
    const ar = nowById.get(br.id);
    if (!ar) { missing.push(br.id); continue; }
    if (ar.fp !== br.fp) fpMoved.push(br.id);
  }
  const capIds = new Set(cap.rows.map((r) => r.id));
  for (const ar of nowMeasured.rows) if (!capIds.has(ar.id)) appeared.push(ar.id);

  console.log(`  bodies in capture : ${cap.rows.length}   now: ${nowMeasured.rows.length}`);
  const populationMoved = !!(missing.length || appeared.length || fpMoved.length);
  if (populationMoved) {
    structural++;
    console.log('');
    console.log('⛔ POPULATION MISMATCH — the generated bodies themselves moved.');
    console.log('   SeededRandom.child() draws from its parent (SeededRandom.js:95), so a changed draw');
    console.log('   count silently rewrites downstream bodies. A uniform delta measured across two');
    console.log('   DIFFERENT planets is entirely true and entirely misleading, so these bodies are');
    console.log('   EXCLUDED from the table below rather than reported as movement.');
    if (fpMoved.length) console.log(`     record changed : ${fpMoved.length}  e.g. ${fpMoved.slice(0, 6).join(', ')}`);
    if (missing.length) console.log(`     disappeared    : ${missing.length}  e.g. ${missing.slice(0, 6).join(', ')}`);
    if (appeared.length) console.log(`     new            : ${appeared.length}  e.g. ${appeared.slice(0, 6).join(', ')}`);
    console.log("   ⭐ This is Instrument B's finding surfacing here. Fix or bless it there first.");
  } else {
    console.log('  population        : IDENTICAL (every body fingerprint matched)');
  }
  if (nowMeasured.failures.length !== (cap.failures?.length ?? 0)) {
    structural++;
    console.log(`⛔ BUILD FAILURES CHANGED: ${cap.failures?.length ?? 0} → ${nowMeasured.failures.length}`);
    for (const f of nowMeasured.failures.slice(0, 5)) console.log(`     ${f.id}: ${f.error.split('\n')[0]}`);
  }
  console.log('');

  // 4) The table. EVERY shared uniform, always — including the ones that did not move.
  //    Per-uniform, never aggregated: plan §6 risk 6 is one uniform moving under a clean summary.
  const capIdx = new Map(cap.uniforms.map((n, i) => [n, i]));
  const stats = [];
  for (const n of nowSet) {
    const ci = capIdx.get(n);
    if (ci === undefined) continue;
    const ai = RES.shared.indexOf(n);
    const beforeRows = cap.rows.map((r) => ({ id: r.id, fp: r.fp, v: [r.v[ci]] }));
    const afterById = new Map(nowMeasured.rows.map((r) => [r.id, { id: r.id, fp: r.fp, v: [r.v[ai]] }]));
    stats.push(statsFor(n, 0, beforeRows, afterById));
  }

  const HDR = `  ${'UNIFORM'.padEnd(20)} ${'TIER'.padEnd(9)} ${'KIND'.padEnd(9)} ${'MOVED'.padStart(10)}   ${'MIN|Δ|'.padStart(14)} ${'MEDIAN|Δ|'.padStart(14)} ${'P95|Δ|'.padStart(14)} ${'MAX|Δ|'.padStart(14)}   WORST BODY`;
  console.log('── PER-UNIFORM DELTA (|Δ| = max abs component delta per body; nearest-rank percentiles) ─');
  console.log(HDR);
  console.log('  ' + '─'.repeat(HDR.length - 2));
  const ordered = stats.slice().sort((a, b) => (b.max || 0) - (a.max || 0) || a.name.localeCompare(b.name));
  for (const s of ordered) {
    const flag = s.moved > 0 ? '*' : ' ';
    const sh = RES.shapes[s.name];
    console.log(`${flag} ${s.name.padEnd(20)} ${sh.tier.padEnd(9)} ${String(sh.gameKind).padEnd(9)} ${`${s.moved}/${s.compared}`.padStart(10)}   ${fmt(s.min)} ${fmt(s.median)} ${fmt(s.p95)} ${fmt(s.max)}   ${s.moved ? `${s.maxAbsBody} [c${s.maxAbsComp}]` : ''}`);
  }
  console.log('');
  // ⭐ The caveat printed WHERE it applies, not only in the header. A `record`-tier row cannot
  // report movement that came from the record itself, because that body was excluded above.
  if (populationMoved) {
    const shadowed = ordered.filter((s) => RES.shapes[s.name].tier === 'record').map((s) => s.name);
    console.log(`  ⚠ THE POPULATION MOVED, so the ${shadowed.length} rows at tier \`record\` are NOT evidence of stability:`);
    console.log(`      ${shadowed.join(', ')}`);
    console.log('    Their value source is a DRAWN planetData field, and every body whose record moved was');
    console.log('    excluded from this table by design. A 0.000000e+0 on those rows is entirely true and');
    console.log('    entirely misleading right now. The `bake`, `condition` and `gate` rows are unaffected —');
    console.log('    their sources sit outside the identity fingerprint.');
    console.log('');
  }

  const movedUniforms = ordered.filter((s) => s.moved > 0);
  console.log('── VERDICT ' + '─'.repeat(78));
  console.log(`  uniforms compared      : ${stats.length}`);
  console.log(`  bodies compared        : ${stats.length ? stats[0].compared : 0}`);
  console.log(`  uniforms that MOVED    : ${movedUniforms.length}${movedUniforms.length ? ' → ' + movedUniforms.map((s) => s.name).join(', ') : ''}`);
  for (const s of movedUniforms) {
    console.log(`      ${s.name}: ${s.moved}/${s.compared} bodies, signed Δ range [${s.signedMin.toExponential(6)}, ${s.signedMax.toExponential(6)}]`);
  }
  console.log('  ⚠ This instrument measures UNIFORM VALUES, not pixels. A moved uniform may be invisible,');
  console.log('    and an unmoved one proves nothing about a feature whose gate is elsewhere. It reports');
  console.log('    every delta at full precision with NO tolerance: the tool reports, you decide.');

  return { structural, stats, movedUniforms };
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
// SELFTEST — the negative control, built in rather than performed by hand
// ═════════════════════════════════════════════════════════════════════════════════════════════
// "A gate that has never failed is not a gate" (PLAN.md:166). Step 0's stated control for this
// instrument is "nudge one shared uniform → C reports a non-zero delta."
//
// It is built into the tool instead of being a manual source edit for two reasons. It is
// repeatable by whoever runs the gate next, months from now, without them having to know which
// constant to poke. And it needs no working-tree edit at all, which matters when other agents
// hold the same files.
//
// The nudges are chosen to prove three specific properties, not just "something changed":
//   1. SCALAR path, and NO THRESHOLD — uLimbExponent moves by 1e-12, far below anything a
//      human would call meaningful. Requirement: deltas are reported even when small. If this
//      one is ever reported as 0/N, an epsilon has crept in somewhere and the instrument has
//      stopped being able to see the class of regression it was built for.
//   2. VECTOR path, ONE COMPONENT — uLimbColor's BLUE channel only. Proves the per-body |Δ| is
//      the max ABS COMPONENT delta and that the worst-component index is reported.
//   3. NOT AGGREGATED — the other 25 shared uniforms must stay at exactly 0/N. This is the
//      property plan §6 risk 6 turns on: one uniform moving under an otherwise clean report.
// It also nudges only a SUBSET of bodies (every 3rd), so the moved/total column is exercised
// rather than being trivially N/N.
function runSelftest() {
  const pop = { ...DEFAULT_POP };
  const NUDGE_SCALAR = { name: 'uLimbExponent', eps: 1e-12 };
  const NUDGE_VECTOR = { name: 'uLimbColor', comp: 2, eps: 0.25 };
  let idx = 0;
  const bodies = buildPopulation(pop);

  const before = measure(bodies, RES.shared);
  idx = 0;
  const after = measure(bodies, RES.shared, (name, vals) => {
    // Deterministic subset: every 3rd body, counted per-uniform so the stride is stable.
    if (name === RES.shared[0]) idx++;                       // advance once per body
    if (idx % 3 !== 0) return;
    if (name === NUDGE_SCALAR.name) vals[0] += NUDGE_SCALAR.eps;
    if (name === NUDGE_VECTOR.name) vals[NUDGE_VECTOR.comp] += NUDGE_VECTOR.eps;
  });

  const cap = {
    uniforms: RES.shared, shapes: RES.shapes, rows: before.rows, failures: before.failures,
  };

  console.log('── INSTRUMENT C · SELFTEST (negative control) ' + '─'.repeat(44));
  console.log(`  Two in-process measurements of the SAME ${before.rows.length} bodies. The second has exactly two`);
  console.log(`  uniforms nudged on every 3rd body:`);
  console.log(`     ${NUDGE_SCALAR.name}  += ${NUDGE_SCALAR.eps}   (scalar; deliberately below any plausible epsilon)`);
  console.log(`     ${NUDGE_VECTOR.name}[${NUDGE_VECTOR.comp}] += ${NUDGE_VECTOR.eps}   (one channel of a Vector3)`);
  console.log('  PASS requires: both report moved > 0, and every other shared uniform reports 0.');
  console.log('');

  const { structural, stats, movedUniforms } = compareAndReport(cap, after, RES);

  const byName = new Map(stats.map((s) => [s.name, s]));
  const capIdxSelf = new Map(RES.shared.map((n, i) => [n, i]));
  // The recovered delta cannot be expected to equal the nudge EXACTLY. `v + eps - v` is evaluated
  // in float64, so it is accurate to a few ULPs OF THE BASE VALUE — not of the nudge. uLimbExponent
  // lives on 1.8..3.5, whose ULP is ~4.4e-16, which is 4 orders of magnitude LARGER than the 1e-12
  // nudge itself. A tolerance scaled to the nudge would fail here forever, so the tolerance is
  // scaled to the largest base magnitude actually observed. (This assertion did fire on its first
  // run, at 1.000088900582341e-12 vs 1e-12 — which is the arithmetic being right, not the gate.)
  const maxBaseOf = (name) => {
    const i = capIdxSelf.get(name);
    let m = 0;
    for (const r of before.rows) for (const c of (r.v[i] || [])) m = Math.max(m, Math.abs(c));
    return m;
  };
  const problems = [];
  if (structural) problems.push(`selftest saw ${structural} structural break(s); it should see none`);
  for (const nud of [NUDGE_SCALAR, NUDGE_VECTOR]) {
    const s = byName.get(nud.name);
    if (!s) { problems.push(`${nud.name} was not compared at all`); continue; }
    if (s.moved === 0) problems.push(`${nud.name} was nudged by ${nud.eps} and reported 0/${s.compared} moved — the instrument is BLIND to a real change`);
    if (s.moved === s.compared) problems.push(`${nud.name} reported ALL ${s.compared} bodies moved; only every 3rd was nudged`);
    const tol = 8 * Number.EPSILON * Math.max(maxBaseOf(nud.name), nud.eps);
    if (Math.abs(s.max - nud.eps) > tol) problems.push(`${nud.name} max|Δ| ${s.max} != nudge ${nud.eps} (tolerance ${tol.toExponential(3)}, = 8 ULP of the base magnitude)`);
  }
  const nudged = new Set([NUDGE_SCALAR.name, NUDGE_VECTOR.name]);
  const spurious = movedUniforms.filter((s) => !nudged.has(s.name));
  if (spurious.length) problems.push(`uniforms moved that were NOT nudged: ${spurious.map((s) => s.name).join(', ')}`);
  if (NUDGE_VECTOR.comp !== byName.get(NUDGE_VECTOR.name)?.maxAbsComp) {
    problems.push(`${NUDGE_VECTOR.name} worst component reported as c${byName.get(NUDGE_VECTOR.name)?.maxAbsComp}, expected c${NUDGE_VECTOR.comp}`);
  }

  console.log('');
  console.log('── SELFTEST VERDICT ' + '─'.repeat(69));
  if (problems.length) {
    for (const p of problems) console.log(`  ⛔ ${p}`);
    console.log('  RESULT: THE GATE DOES NOT BITE. Exit 3.');
    process.exit(3);
  }
  console.log(`  ✓ ${NUDGE_SCALAR.name} nudged by ${NUDGE_SCALAR.eps} → reported, not swallowed (no epsilon anywhere)`);
  console.log(`  ✓ ${NUDGE_VECTOR.name} channel ${NUDGE_VECTOR.comp} nudged by ${NUDGE_VECTOR.eps} → reported, correct component`);
  console.log(`  ✓ the other ${stats.length - 2} shared uniforms reported exactly 0 — the report is per-uniform, not aggregated`);
  console.log('  RESULT: the gate bites. Exit 0.');
  process.exit(0);
}

if (MODE === 'selftest') runSelftest();

// ── CHECK ─────────────────────────────────────────────────────────────────────────────────────
if (!fs.existsSync(CAPTURE)) {
  console.error(`no capture at ${CAPTURE} — run --record first.`);
  process.exit(66);
}
const cap = JSON.parse(fs.readFileSync(CAPTURE, 'utf8'));

console.log('── INSTRUMENT C · shipped-uniform delta ' + '─'.repeat(50));
console.log(`  capture   : ${path.relative(ROOT, CAPTURE)}`);
console.log(`  recorded @: ${cap.recordedAtGit?.sha || '?'}${cap.recordedAtGit?.dirty ? ' (dirty tree)' : ''}`);
const now = gitHead();
console.log(`  now @     : ${now.sha}${now.dirty ? ' (dirty tree)' : ''}`);
console.log('  comparison: SAME-TREE-BEFORE vs SAME-TREE-AFTER, matched per body by input-record');
console.log('              fingerprint. NOT lab-vs-game. NOT keyed by preset name. (PLAN.md:548)');
console.log('');

// Rebuild the SAME population from the capture's OWN parameters, never from DEFAULT_POP — so
// editing the defaults cannot silently re-define the population under an existing baseline.
const nowMeasured = measure(buildPopulation(cap.population), RES.shared);
const { structural, movedUniforms } = compareAndReport(cap, nowMeasured, RES);

if (structural) {
  console.log('');
  console.log(`RESULT: STRUCTURAL BREAK (${structural}) — the comparison basis itself changed. Exit 2.`);
  process.exit(2);
}
if (movedUniforms.length && !has('--allow-deltas')) {
  console.log('');
  console.log('RESULT: SHIPPED UNIFORMS MOVED. Exit 1.');
  console.log('  If this step is DECLARED pixel-moving (e.g. PLAN.md Step 2 / Step 4), re-run with');
  console.log('  --allow-deltas to record the table as evidence, and re-bless affected tests BY NAME.');
  process.exit(1);
}
console.log('');
console.log(movedUniforms.length
  ? 'RESULT: shipped uniforms moved; --allow-deltas given, so this is a DECLARED pixel-moving step. Exit 0.'
  : 'RESULT: ZERO delta on all shipped shared uniforms. Exit 0.');
process.exit(0);
