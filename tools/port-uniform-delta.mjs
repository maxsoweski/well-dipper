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
//
// Exit codes:  0 ok · 1 shipped uniforms moved · 2 structural break (basis changed) · 3 selftest
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
// `new Planet(sceneData)` (src/objects/Planet.js:1519) and the uniforms are read off
// `planet.surface.material.uniforms`. Planet._createSurface (:1548-1717) is the only place in the
// game that turns a condition into shipped shader numbers; re-deriving it here would create a
// second copy of exactly the law this plan is removing, and the copy would drift silently.
//
// The shared set is resolved at RUNTIME by intersecting those uniform names against
// makeUniforms()'s (planet-lod-uniforms.js:8). It is not a hardcoded list — a hardcoded list is
// how a newly-shared uniform gets silently excluded from its own gate. The plan predicted 27
// (PLAN.md:61, :158); the tool prints what it actually found and --check fails loudly if the SET
// changes between record and check.
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
//                main.js:6197 `new Planet(scenePMData)`. They are RARE — MoonGenerator.js:99
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
//   src/main.js:6110-6118  (planets)
//   src/main.js:6178-6186  (planet-class moons; identical shape, pmRatio spelled separately)
// ⚠ THIS IS A TRANSCRIPTION and therefore a drift risk of exactly the kind this plan exists to
// remove. It is here rather than imported because main.js is a 10k-line browser entry point with
// no exported seam for it. If main.js's scaling law changes and this does not, uNoiseScale in
// this harness stops describing a shipped pixel. Named so the next reader can check it in ten
// seconds rather than trusting it.
function toSceneData(rec) {
  const ratio = rec.radius / rec.radiusScene;
  if (!Number.isFinite(ratio) || ratio <= 0) {
    throw new Error(`toSceneData: radius/radiusScene is not finite-positive (${rec.radius}/${rec.radiusScene}). ` +
      `main.js:6110 assumes both exist on every body it renders.`);
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

// Resolve the shared set. ⛔ makeUniforms() is consulted for KEYS and for a KIND tag only — no
// lab VALUE is ever differenced against a game value (see the header, plan §6 risk 5).
function resolveSharedUniforms(probeMaterialUniforms) {
  const labU = makeUniforms(new THREE.Vector3(0, 1, 0)); // WORLD_LIGHT: any vector; keys don't depend on it
  const labNames = Object.keys(labU);
  const gameNames = Object.keys(probeMaterialUniforms);
  const shared = gameNames.filter((n) => labNames.includes(n)).sort();
  const shapes = {};
  for (const n of shared) {
    const gk = kindOf(probeMaterialUniforms[n].value);
    const lk = kindOf(labU[n].value);
    if (!gk) throw new Error(`resolveSharedUniforms: game uniform ${n} has an unrecognised value shape`);
    shapes[n] = {
      gameKind: gk,
      labKind: lk,                                  // recorded, never differenced
      arity: flatten(probeMaterialUniforms[n].value).length,
    };
  }
  return {
    shared,
    shapes,
    counts: { game: gameNames.length, lab: labNames.length, shared: shared.length },
    gameOnly: gameNames.filter((n) => !labNames.includes(n)).sort(),
  };
}

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
// computed from conditionFromPlanet() at PlanetGenerator.js:725 and returned at :758-764. They
// then become shipped uniforms (uIcenessMix, uFreshColor/uSedColor/uWeatheredColor, uLavaGlow,
// uLavaCrust — Planet.js:1602-1611).
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
// The negative control did not catch it because the control nudged Planet.js:1617, the uniform
// ASSIGNMENT site, which is DOWNSTREAM of the bake and so moved no planetData field. Every real
// port change in this plan moves the condition UPSTREAM of the bake. A convincing control can
// still step around the one class of change that matters.
//
// So: exclude the five bakes, and share ONE list with Instrument B, which already excludes exactly
// these (tests/body-identity-fence.test.js:157-176) for the same reason. Two instruments that
// disagree about what "the same body" means resolve into an unactionable instruction.

// ⛔ KEEP IN SYNC with WORLDENGINE_BAKES in tests/body-identity-fence.test.js:157. Derived port
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
  : has('--list') ? 'list' : has('--selftest') ? 'selftest' : null;

if (!MODE) {
  console.error('usage: node tools/port-uniform-delta.mjs (--record | --check | --list | --selftest)');
  console.error('       [--force] [--allow-deltas] [--capture <path>]');
  process.exit(64);
}

function gitHead() {
  try {
    const sha = execFileSync('git', ['-C', ROOT, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    const dirty = execFileSync('git', ['-C', ROOT, 'status', '--porcelain'], { encoding: 'utf8' }).trim().length > 0;
    return { sha, dirty };
  } catch { return { sha: 'unknown', dirty: null }; }
}

const fmt = (x) => (Number.isNaN(x) ? '—' : x === 0 ? '0.000000e+0' : x.toExponential(6)).padStart(14);

function printResolution(res) {
  console.log('── SHARED UNIFORM RESOLUTION ' + '─'.repeat(60));
  console.log(`  src/objects/Planet.js production material : ${res.counts.game} uniforms`);
  console.log(`  planet-lod-uniforms.js  makeUniforms()    : ${res.counts.lab} uniforms`);
  console.log(`  SHARED (by name, resolved at runtime)     : ${res.counts.shared}`);
  console.log(`  game-only (no lab counterpart)            : ${res.gameOnly.length}`);
  console.log('');
  for (const n of res.shared) {
    const s = res.shapes[n];
    console.log(`    ${n.padEnd(20)} game:${String(s.gameKind).padEnd(10)} lab:${String(s.labKind).padEnd(10)} arity:${s.arity}`);
  }
  console.log('');
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
  if (added.length || removed.length) {
    structural++;
    console.log('⛔ SHARED-UNIFORM SET CHANGED since the capture:');
    if (added.length) console.log(`     added   (+${added.length}): ${added.join(', ')}`);
    if (removed.length) console.log(`     removed (-${removed.length}): ${removed.join(', ')}`);
    console.log('   Deltas below cover the INTERSECTION only. Re-record deliberately once understood.');
    console.log('');
  } else {
    console.log(`  shared-uniform set: UNCHANGED (${nowSet.length} uniforms)`);
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
  if (missing.length || appeared.length || fpMoved.length) {
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

  const HDR = `  ${'UNIFORM'.padEnd(20)} ${'KIND'.padEnd(9)} ${'MOVED'.padStart(10)}   ${'MIN|Δ|'.padStart(14)} ${'MEDIAN|Δ|'.padStart(14)} ${'P95|Δ|'.padStart(14)} ${'MAX|Δ|'.padStart(14)}   WORST BODY`;
  console.log('── PER-UNIFORM DELTA (|Δ| = max abs component delta per body; nearest-rank percentiles) ─');
  console.log(HDR);
  console.log('  ' + '─'.repeat(HDR.length - 2));
  const ordered = stats.slice().sort((a, b) => (b.max || 0) - (a.max || 0) || a.name.localeCompare(b.name));
  for (const s of ordered) {
    const flag = s.moved > 0 ? '*' : ' ';
    console.log(`${flag} ${s.name.padEnd(20)} ${String(RES.shapes[s.name].gameKind).padEnd(9)} ${`${s.moved}/${s.compared}`.padStart(10)}   ${fmt(s.min)} ${fmt(s.median)} ${fmt(s.p95)} ${fmt(s.max)}   ${s.moved ? `${s.maxAbsBody} [c${s.maxAbsComp}]` : ''}`);
  }
  console.log('');

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
