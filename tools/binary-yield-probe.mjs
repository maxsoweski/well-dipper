#!/usr/bin/env node
/**
 * binary-yield-probe — the read-only yield probe behind B4 §8.
 *
 * Computes, without a line of generator code existing, the exact set of
 * (seed, planet) coordinates that the binary-companion channel selects, on each
 * corpus the toll is stated against. See
 * `docs/FEATURES/moon-formation-b4-prediction-2026-08-17.md` §8.
 *
 * ⭐ WHY THIS IS A COMMITTED TOOL AND NOT A scratchpad SCRIPT.
 * `docs/FEATURES/binary-planets-scoping-2026-08-17.md` §4 says its probe is
 * "archived at `scratchpad/probe-binary-criteria.mjs`". That file no longer
 * exists — the convention lost the evidence inside a day. B4 is a PREDICTION
 * commit; a prediction nobody can re-derive is worth less than no prediction.
 * So this lives in `tools/` next to `moon-census.mjs`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⛔ THE TWO STAMPS. Read this before trusting any number it prints.
 *
 * The selector is evaluated INSIDE the planet loop, where `planetData._ordinal`
 * and `planetData.type` are the generator's own. But `ExoticOverlay._swapPlanetType`
 * (`src/generation/ExoticOverlay.js:401` `planetEntry.planetData = newData;`)
 * REPLACES `planetData` wholesale with a fresh `PlanetGenerator.generate()`
 * result, which carries no `_systemSeed` and no `_ordinal` — the defect pinned
 * at `tests/gas-body-lab-material.test.js:567`. So for an overlay-swapped
 * planet the selector's key is NOT RECOVERABLE from `generate()`'s output, and
 * neither is the type an in-loop read would have seen.
 *
 * Measured consequence on FENCE-221: 10 swapped planets, and reading the list
 * off the output gives 26 companions where the in-loop answer is 27. The
 * missing body is `wd-1403/1`.
 *
 * To measure exactly, apply these two LINE-COUNT-NEUTRAL stamps in a DETACHED
 * PROBE WORKTREE (never the live tree — a dev server serves it on :5173 and any
 * src edit fires HMR), then run with --stamped:
 *
 *   sed -i '567s|.*|      planetData._ordinal = i; planetData._preType = planetData.type;|' \
 *     src/generation/StarSystemGenerator.js
 *   sed -i '401s|.*|    newData._preType = planetEntry.planetData._preType; newData._probeSeed = planetEntry.planetData._systemSeed; newData._probeOrdinal = planetEntry.planetData._ordinal; planetEntry.planetData = newData;|' \
 *     src/generation/ExoticOverlay.js
 *
 * ⛔ Use `_probeSeed`/`_probeOrdinal`, NOT `_systemSeed`/`_ordinal`. Restoring
 * the real names repairs the stripping defect, which unblocks two bodies in
 * `labPipelineAdmits` and moves `material-parity-list.test.js`'s
 * `provenanceBlocked 2 / swapped 341` to `0 / 343`. Measured.
 *
 * Without --stamped the probe still runs, but it REFUSES to print a coordinate
 * list and exits 3, naming every planet whose key it could not resolve.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * USAGE
 *   node tools/binary-yield-probe.mjs [--p=0.0335] [--stamped] [--json=out.json]
 *   node tools/binary-yield-probe.mjs --p=0.049 --stamped      # re-issue §8.3/§8.4 at a new rate
 *
 * EXITS  0 clean · 3 unresolved keys (run --stamped in a probe worktree)
 */

import { StarSystemGenerator } from '../src/generation/StarSystemGenerator.js';
import { GalacticMap } from '../src/generation/GalacticMap.js';

// ── the selector's hash ──────────────────────────────────────────────────────
// A verbatim transcription of `namespacedFloat`, src/generation/MoonGenerator.js:578-587
// (module-private there). ⛔ NOT `fnv1aString`: measured over wd-0…wd-2999,
// FNV-1a's within-system gaps collapse to EIGHT distinct values across 9578
// adjacent-ordinal pairs (xmur3: 9132), because for a single-digit `_ordinal`
// the tail reduces to (h ⊕ c)·P² and P² mod 2³² = 0.148475·2³². Marginal
// uniformity passes on both — the failure is entirely in the joint structure,
// and it makes two companions in one system IMPOSSIBLE. See §8.1.
function namespacedFloat(key) {
  let h = 1779033703 ^ key.length;
  for (let i = 0; i < key.length; i++) {
    h = Math.imul(h ^ key.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** src/generation/MoonGenerator.js:29 — the eligibility complement. */
const GIANT_PARENT_TYPES = new Set(['gas-giant', 'hot-jupiter', 'sub-neptune']);

// ── corpora, transcribed from the harnesses that own them ────────────────────
const BULK = Array.from({ length: 192 }, (_, i) => `wd-${i}`);
const PINNED = ['wd-356', 'wd-395', 'wd-614', 'wd-2232', 'wd-1403'];
const GALAXY_POSITIONS = Array.from({ length: 24 }, (_, i) => {
  const R = 0.4 + i * 0.75;                 // 0.4 → 17.65 kpc
  const th = i * 2.399963229728653;         // golden angle
  const sign = i % 6 < 3 ? 1 : -1;
  return { x: R * Math.cos(th), y: R * Math.sin(th), z: i % 3 === 0 ? 0 : i % 3 === 1 ? 0.15 * sign : 1.4 * sign };
});

function corpora() {
  const map = new GalacticMap('body-identity-fence');   // tests/body-identity-fence.test.js:112
  const gc = GALAXY_POSITIONS.map((p, i) => [`gc-${i}`, map.deriveGalaxyContext(p)]);
  const nullCtx = (s) => [s, null];
  return {
    // tests/body-identity-fence.test.js:93-136, :442-444
    'FENCE-221': [...BULK.map(nullCtx), ...PINNED.map(nullCtx), ...gc],
    // tests/moon-condition-contract.test.js:84-89 — FENCE's bulk + pinned, no gc-*
    'MC-197': [...BULK.map(nullCtx), ...PINNED.map(nullCtx)],
    // tests/port-condition-contract.test.js:517
    'PCC-120': Array.from({ length: 120 }, (_, i) => [`pcc-${i}`, null]),
    // tests/material-parity-list.test.js:166
    'LAB-PROCEDURAL-200': Array.from({ length: 200 }, (_, i) => [`lab-procedural-${i}`, null]),
    // tools/moon-census.mjs:126-134 — cross-reference; NOT the same corpus as FENCE-221
    'BULK-221': Array.from({ length: 221 }, (_, i) => [`wd-${i}`, null]),
  };
}

// ── args ─────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const arg = (n, d) => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.split('=')[1] : d; };
const P = parseFloat(arg('p', '0.0335'));
const STAMPED = argv.includes('--stamped');
const JSON_OUT = arg('json', null);

if (!Number.isFinite(P) || P <= 0 || P >= 1) { console.error(`--p must be in (0,1), got ${P}`); process.exit(64); }

// ── walk ─────────────────────────────────────────────────────────────────────
const unresolved = [];
const out = { p: P, stamped: STAMPED, corpora: {} };

for (const [name, jobs] of Object.entries(corpora())) {
  const companions = [];
  const merged = [];       // today's planet-class coordinates + companions, in captureAll walk order
  let planets = 0, moons = 0, plain = 0, planetClass = 0;
  let movedFromMoonBearing = 0, movedFromCompanionOnly = 0, ordinalNeIndex = 0;
  const seedsWithCompanion = new Set();

  for (const [seed, ctx] of jobs) {
    const sys = StarSystemGenerator.generate(seed, ctx);
    (sys.planets || []).forEach((entry, pi) => {
      planets++;
      const pd = entry.planetData;
      const ms = entry.moons || [];

      // The in-loop type. `_preType` when stamped; otherwise `type`, which is
      // correct for every planet the overlay did not swap.
      const inLoopType = STAMPED ? pd._preType : pd.type;
      // The in-loop key. `_ordinal` survives on unswapped planets only.
      const ordinal = pd._ordinal ?? (STAMPED ? pd._probeOrdinal : undefined);
      const systemSeed = pd._systemSeed ?? (STAMPED ? pd._probeSeed : undefined);
      if (ordinal === undefined || systemSeed === undefined || inLoopType === undefined) {
        unresolved.push(`${name} ${seed}/${pi} type=${pd.type} — overlay stripped the key (ExoticOverlay.js:401)`);
        return;
      }
      if (ordinal !== pi) ordinalNeIndex++;

      const selected = !GIANT_PARENT_TYPES.has(inLoopType)
        && namespacedFloat(`binarypair:${systemSeed}:${ordinal}`) < P;

      if (ms.length > 0) movedFromMoonBearing++;
      else if (selected) movedFromCompanionOnly++;

      ms.forEach((m, mi) => {
        moons++;
        if (m.isPlanetMoon) { planetClass++; merged.push(`${seed}/${pi}/${mi}`); } else plain++;
      });

      if (selected) {
        // appended after the moon loop closes ⇒ its moon index is the parent's pre-existing count
        const coord = `${seed}/${pi}/${ms.length}`;
        merged.push(coord);
        seedsWithCompanion.add(seed);
        companions.push({
          coord, ordinal, inLoopType, shippedType: pd.type,
          overlaySwapped: inLoopType !== pd.type,
          parentRadiusEarth: +pd.radiusEarth.toFixed(4),
          parentMassEarth: +pd.massEarth.toFixed(4),
          existingMoons: ms.length,
          h: +namespacedFloat(`binarypair:${systemSeed}:${ordinal}`).toFixed(6),
        });
      }
    });
  }

  const N = companions.length;
  out.corpora[name] = {
    systems: jobs.length, planets, ordinalNeIndex,
    today: { moons, plain, planetClass },
    after: { moons: moons + N, plain, planetClass: planetClass + N },
    N, S: seedsWithCompanion.size, Z: movedFromCompanionOnly,
    // tests/body-identity-fence.test.js:740 — the moved-record partition.
    // `systems` is NOT 0: :376 puts the moon COUNT inside the per-seed `system`
    // object and :716 compares it. That arm moves for binaries and, through
    // regime 1, for nothing else — which is the line item's attribution channel.
    partitionRouteMAlone: { systems: seedsWithCompanion.size, planets: N, plainMoons: 0, planetClassMoons: N },
    partitionWithMoonWindow: {
      systems: seedsWithCompanion.size,
      planets: movedFromMoonBearing + movedFromCompanionOnly,
      plainMoons: plain,
      planetClassMoons: planetClass + N,
    },
    moonShapeCensusAfter: {
      plain: { shapes: 1, keyCounts: [25], records: plain },
      planetClass: { shapes: 1, keyCounts: [20], records: planetClass + N },
    },
    companions,
    PLANET_CLASS_MOONS_after: merged,
  };
}

// ── report ───────────────────────────────────────────────────────────────────
const pad = (s, n) => String(s).padEnd(n);
const num = (s, n) => String(s).padStart(n);
console.log(`\nbinary-yield-probe — p = ${P}${STAMPED ? '' : '   ⚠ UNSTAMPED (see header)'}\n`);
console.log(pad('corpus', 21) + num('planets', 8) + num('N', 5) + num('S', 5) + num('Z', 5)
  + '   planet-class      moons        pi≠_ordinal');
for (const [name, c] of Object.entries(out.corpora)) {
  console.log(pad(name, 21) + num(c.planets, 8) + num(c.N, 5) + num(c.S, 5) + num(c.Z, 5)
    + num(`${c.today.planetClass} → ${c.after.planetClass}`, 15)
    + num(`${c.today.moons} → ${c.after.moons}`, 13) + num(c.ordinalNeIndex, 12));
}
console.log('\n  N = companions · S = seeds carrying ≥1 · Z = of those, parents that had ZERO moons');
console.log('  FENCE-221 partition, Route M alone : '
  + JSON.stringify(out.corpora['FENCE-221'].partitionRouteMAlone));
console.log('  FENCE-221 partition, + moon window : '
  + JSON.stringify(out.corpora['FENCE-221'].partitionWithMoonWindow));

if (unresolved.length) {
  console.error(`\n⛔ ${unresolved.length} planet(s) whose selector key could not be resolved from the`);
  console.error('   generator output. ExoticOverlay strips `_systemSeed`/`_ordinal` on the planets it');
  console.error('   swaps. Re-run with --stamped in a detached probe worktree carrying the two stamps');
  console.error('   named in this file\'s header. The coordinate list is NOT printed, because a list');
  console.error('   short by an unknown number of rows is worse than no list.\n');
  for (const u of unresolved) console.error('   ' + u);
  if (JSON_OUT) { const fs = await import('node:fs'); fs.writeFileSync(JSON_OUT, JSON.stringify({ ...out, unresolved }, null, 2)); }
  process.exit(3);
}

const F = out.corpora['FENCE-221'];
console.log(`\nFENCE-221 coordinate list — ${F.N} companions, in the fence's own \`seed/pi/mi\` form`);
console.log('(⛔ `pi` is the FINAL index in planets[]; the selector keys on `_ordinal`, and they');
console.log(` disagree on ${F.ordinalNeIndex} of ${F.planets} planets today — see §8.4.)\n`);
for (const c of F.companions) {
  console.log(`  ${pad(c.coord, 14)} ord ${num(c.ordinal, 2)}  ${pad(c.inLoopType, 12)}`
    + `${num(c.parentRadiusEarth, 7)} R⊕ ${num(c.parentMassEarth, 9)} M⊕  moons ${c.existingMoons}`
    + `  h=${c.h}${c.overlaySwapped ? `   ⛔ overlay-swapped → ${c.shippedType}` : ''}`);
}
console.log(`\nPLANET_CLASS_MOONS (tests/body-identity-fence.test.js:288) becomes ${F.PLANET_CLASS_MOONS_after.length} entries:`);
console.log(F.PLANET_CLASS_MOONS_after.map((s) => `'${s}'`).join(', '));

if (JSON_OUT) { const fs = await import('node:fs'); fs.writeFileSync(JSON_OUT, JSON.stringify(out, null, 2)); }
console.log('');
