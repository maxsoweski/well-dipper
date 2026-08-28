#!/usr/bin/env node
/**
 * ════════════════════════════════════════════════════════════════════════════
 * MOON CENSUS — a READ-ONLY population instrument
 * docs/FEATURES/moon-formation-channel-model-PLAN-2026-08-15.md, step B0
 * ════════════════════════════════════════════════════════════════════════════
 *
 * WHAT THIS IS. A measurement of the moon population the SHIPPED generator
 * actually produces. It imports `StarSystemGenerator` and reads what comes
 * back. It installs no wrapper, monkey-patches nothing, writes no file, and
 * mutates no record. Run it, read stdout, redirect stdout if you want a doc.
 *
 * WHY IT IS FIRST IN THE BUILD SEQUENCE. Every rate claim in the channel-model
 * plan is unfalsifiable without it, and the plan records one mis-scoping that
 * already happened for exactly this reason: the Band A conversion was computed
 * against an ASSUMED mean of ~20 moons per system when the measured figure is
 * ~3.6. A tool is not a test, so this file adds zero test IDs to Instrument A.
 *
 * ⛔ THE CORPUS IS NAMED IN THE OUTPUT, ON PURPOSE. This project has been bitten
 * repeatedly by quoting a threshold measured on one corpus against a different
 * one — `tests/moon-condition-contract.test.js` says of itself that the same
 * quantity reads 1.2499 g on its 197-seed corpus and 16.16 g on `wd-0..1499`.
 * So every number below is stamped FENCE-221, and FENCE-221 is reproduced
 * VERBATIM from `tests/body-identity-fence.test.js:93-120` (192 bulk `wd-N`
 * seeds + 5 pinned + 24 `GalacticMap` positions) so that these figures are
 * directly comparable with everything the fence has already measured.
 *
 * ⚠ CONVENTIONS THAT A READER MUST NOT ASSUME. Each is restated in the output
 * next to the number it governs, because every one of them has a defensible
 * alternative:
 *   · HILL RADIUS      R_H = a_p · (M_p / (3·M_*))^(1/3)   — the `M/(3M)` form,
 *                      the same convention the plan's §0 arithmetic used.
 *   · PARENT ORBIT     the FINAL `wrapper.orbitRadiusAU`, i.e. POST-migration
 *                      and POST-resonance-snap. That is the orbit the body has
 *                      in the game. It is NOT the orbit the moon was generated
 *                      against (StarSystemGenerator.js rewrites it in place
 *                      after the moon loop), so the count of systems whose
 *                      orbits were rewritten is reported alongside.
 *   · STAR MASS        `star.radiusSolar ** 1.25`, reproducing the generator's
 *                      own main-sequence M–R relation. `starMassSolar` is not
 *                      on the returned record; `star.radiusSolar` is.
 *   · ROCHE            `PhysicsEngine.rocheLimit(rho_parent, rho_moon)`, the
 *                      shipped function, fluid form, as a multiple of parent
 *                      radius. Uses each body's OWN `composition.density`.
 *   · SOLID PARENT     anything not in {gas-giant, hot-jupiter, sub-neptune} —
 *                      the same set `MoonGenerator.js` calls GIANT_PARENT_TYPES.
 *   · PERCENTILES      nearest-rank on the sorted sample, no interpolation.
 *
 * ⚠ THE MASS TRAP, ASSERTED RATHER THAN TRUSTED. Planet-class moons return
 * early from `MoonGenerator.generate` and never reach the record-append block,
 * so they carry NO top-level `massEarth`; their mass is on
 * `m.planetData.massEarth`. Reading `m.massEarth` across the whole population
 * yields `undefined` on 24 records and a confident, dramatic, wrong zero. This
 * tool reads BOTH paths, reports them SEPARATELY, and asserts the shape of each
 * out loud (§7) so the trap cannot be re-entered silently.
 *
 * ⭐ TWO CORPORA, BECAUSE "221 SEEDS" HAS ALREADY MEANT TWO DIFFERENT THINGS.
 * `moon-formation-audit-2026-08-15.md` reports "829 moons / 221 seeds" and
 * "10 of 72" gas giants. FENCE-221 has 794 moons and 63 gas giants. Measured
 * this session: the audit's corpus is a plain `wd-0`…`wd-220` bulk run, which
 * reproduces all four of its figures exactly (948 planets, 829 moons, 10 of 72
 * → 13.9%, 60 of 321 → 18.7%). It is registered here as BULK-221 so the two are
 * comparable side by side instead of being confused for each other again.
 *
 * USAGE
 *   node tools/moon-census.mjs                    → FENCE-221 report on stdout
 *   node tools/moon-census.mjs --corpus=bulk221   → the audit's corpus
 *   node tools/moon-census.mjs --json             → the same figures as JSON
 * Exit 0 = ran. Exit 3 = FENCE-221's shape disagreed with the fence's pinned
 * population; that is a FINDING and the tool refuses to paper over it.
 */

import { StarSystemGenerator } from '../src/generation/StarSystemGenerator.js';
import { GalacticMap } from '../src/generation/GalacticMap.js';
import { rocheLimit } from '../src/generation/PhysicsEngine.js';
import { EARTH_RADIUS_AU } from '../src/core/ScaleConstants.js';

// ─────────────────────────────────────────────────────────────────────────────
// FENCE-221 — verbatim from tests/body-identity-fence.test.js:93-120.
// ⛔ Do not "tidy" these. Their value is that they are byte-identical to the
// fence's corpus; a paraphrase that generates the same seeds today but drifts
// tomorrow destroys the comparability that is the whole point.
// ─────────────────────────────────────────────────────────────────────────────
const BULK_SEEDS = Array.from({ length: 192 }, (_, i) => `wd-${i}`);

const PINNED_SEEDS = [
  ['wd-356', 'type: shattered'],
  ['wd-395', 'type: fungal'],
  ['wd-614', 'type: city-lights'],
  ['wd-2232', 'type: ecumenopolis'],
  ['wd-1403', 'type: machine + the only terrestrial moon in 6000 seeds'],
];

const GALAXY_MASTER_SEED = 'body-identity-fence';
const GALAXY_POSITIONS = Array.from({ length: 24 }, (_, i) => {
  const R = 0.4 + i * 0.75;                   // 0.4 → 17.65 kpc
  const th = i * 2.399963229728653;           // golden angle, radians
  const sign = i % 6 < 3 ? 1 : -1;
  const z = i % 3 === 0 ? 0 : i % 3 === 1 ? 0.15 * sign : 1.4 * sign;
  return { x: R * Math.cos(th), y: R * Math.sin(th), z };
});

// ─────────────────────────────────────────────────────────────────────────────
// THE CORPUS REGISTRY. Every figure this tool prints is stamped with the key of
// the corpus it came from, and the two corpora below are NOT interchangeable —
// that is the entire reason both are here rather than one.
// ─────────────────────────────────────────────────────────────────────────────
const CORPORA = {
  fence221: {
    name: 'FENCE-221',
    desc: '192 bulk `wd-0`…`wd-191` (galaxyContext null) + 5 pinned rare-type seeds + '
        + '24 `gc-N` GalacticMap positions under master seed `body-identity-fence`',
    provenance: 'verbatim from tests/body-identity-fence.test.js — the corpus every fence '
              + 'measurement in this tree is stated against',
    // The fence's pinned population, asserted below. planetClass 24 -> 51 at the B5.0 re-bless.
    pinned: { seeds: 221, planets: 961, plain: 770, planetClass: 51 },
    build: () => {
      const map = new GalacticMap(GALAXY_MASTER_SEED);
      return [
        ...BULK_SEEDS.map((s) => [s, null]),
        ...PINNED_SEEDS.map(([s]) => [s, null]),
        ...GALAXY_POSITIONS.map((p, i) => [`gc-${i}`, map.deriveGalaxyContext(p)]),
      ];
    },
  },
  bulk221: {
    name: 'BULK-221',
    desc: '221 bulk seeds `wd-0`…`wd-220`, galaxyContext null throughout',
    provenance: 'reconstructed this session as the corpus `moon-formation-audit-2026-08-15.md` '
              + 'measured on — it reproduces all four of that document\'s reported figures exactly',
    pinned: null,
    build: () => Array.from({ length: 221 }, (_, i) => [`wd-${i}`, null]),
  },
};

const GIANT_PARENT_TYPES = new Set(['gas-giant', 'hot-jupiter', 'sub-neptune']);
const EARTH_MASSES_PER_SUN = 332946;

// ─────────────────────────────────────────────────────────────────────────────
// Small statistics helpers. Nearest-rank percentiles, stated in the output.
// ─────────────────────────────────────────────────────────────────────────────
const num = (v) => (typeof v === 'number' && Number.isFinite(v));

function pct(sorted, q) {
  if (!sorted.length) return null;
  const rank = Math.min(sorted.length - 1, Math.max(0, Math.ceil(q * sorted.length) - 1));
  return sorted[rank];
}

function dist(values) {
  const s = values.slice().sort((a, b) => a - b);
  return {
    n: s.length,
    p05: pct(s, 0.05),
    median: pct(s, 0.50),
    p95: pct(s, 0.95),
    max: s.length ? s[s.length - 1] : null,
    min: s.length ? s[0] : null,
  };
}

const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const f = (v, d = 4) => (v == null ? '—' : Number(v).toFixed(d));
const pctStr = (v) => (v == null ? '—' : `${(v * 100).toFixed(2)}%`);

// ─────────────────────────────────────────────────────────────────────────────
// Body accessors. Every one of these exists because the two moon populations
// have DIFFERENT record shapes (25 keys plain, 20 planet-class), and reading
// one shape's key off the other returns `undefined` rather than throwing.
// ─────────────────────────────────────────────────────────────────────────────
const isPlanetClass = (m) => m.isPlanetMoon === true;

/** Mass in Earth masses, from whichever path this record actually carries. */
function moonMassEarth(m) {
  if (isPlanetClass(m)) return m.planetData?.massEarth;
  return m.massEarth;
}

/** Bulk density kg/m³, from whichever path this record actually carries. */
function moonDensity(m) {
  if (isPlanetClass(m)) return m.planetData?.composition?.density;
  return m.composition?.density;
}

/** Retrograde is not a field. It survives only as the SIGN of orbitSpeed. */
const isRetrograde = (m) => num(m.orbitSpeed) && m.orbitSpeed < 0;

// ─────────────────────────────────────────────────────────────────────────────
// COLLECT
// ─────────────────────────────────────────────────────────────────────────────
function collect(corpus) {
  const jobs = corpus.build();

  const systems = [];
  for (const [seed, ctx] of jobs) {
    const s = StarSystemGenerator.generate(seed, ctx);
    const starMassSolar = num(s.star?.radiusSolar) ? s.star.radiusSolar ** 1.25 : null;
    const planets = (s.planets || []).map((w) => ({
      wrapper: w,
      pd: w.planetData,
      orbitAU: w.orbitRadiusAU,
      moons: w.moons || [],
    }));
    systems.push({
      seed,
      starMassSolar,
      migrated: !!(s.migrationHistory && s.migrationHistory.occurred),
      resonant: !!s.resonanceChain,
      planets,
    });
  }
  return systems;
}

// ─────────────────────────────────────────────────────────────────────────────
// MEASURE
// ─────────────────────────────────────────────────────────────────────────────
function measure(systems) {
  const out = {};

  // ── §1 population ─────────────────────────────────────────────────────────
  let planets = 0, plain = 0, planetClass = 0;
  for (const s of systems) for (const p of s.planets) {
    planets++;
    for (const m of p.moons) (isPlanetClass(m) ? planetClass++ : plain++);
  }
  out.population = { seeds: systems.length, planets, plain, planetClass, moons: plain + planetClass };

  // ── §2 m-bar, three denominators, because they are not the same number ────
  const perSystemMoons = systems.map((s) => s.planets.reduce((a, p) => a + p.moons.length, 0));
  const systemsWithPlanets = systems.filter((s) => s.planets.length > 0);
  const moonBearingSystems = systems.filter((_, i) => perSystemMoons[i] > 0);
  out.mBar = {
    perSystemAll: mean(perSystemMoons),
    perSystemWithPlanets: mean(systemsWithPlanets.map(
      (s) => s.planets.reduce((a, p) => a + p.moons.length, 0))),
    perMoonBearingSystem: mean(moonBearingSystems.map(
      (s) => s.planets.reduce((a, p) => a + p.moons.length, 0))),
    perPlanet: planets ? (plain + planetClass) / planets : 0,
    systemsWithPlanets: systemsWithPlanets.length,
    moonBearingSystems: moonBearingSystems.length,
    emptySystems: systems.length - systemsWithPlanets.length,
  };

  // ── §3 per parent type ────────────────────────────────────────────────────
  const byType = new Map();
  for (const s of systems) for (const p of s.planets) {
    const t = p.pd?.type ?? '(missing)';
    if (!byType.has(t)) byType.set(t, { type: t, n: 0, moons: 0, zero: 0, counts: [] });
    const row = byType.get(t);
    row.n++; row.moons += p.moons.length; row.counts.push(p.moons.length);
    if (p.moons.length === 0) row.zero++;
  }
  out.byParentType = [...byType.values()]
    .map((r) => ({ ...r, meanMoons: r.n ? r.moons / r.n : 0, pZero: r.n ? r.zero / r.n : 0,
                   maxMoons: r.counts.length ? Math.max(...r.counts) : 0 }))
    .sort((a, b) => b.n - a.n);
  const gg = out.byParentType.find((r) => r.type === 'gas-giant');
  out.pZeroGasGiant = gg ? gg.pZero : null;

  // ── §4 Band A / Band B ────────────────────────────────────────────────────
  // Band A: 0.2–0.7 R⊕ on a SOLID parent. Band B: > 1 R⊕ on any parent, and
  // separately on a giant parent (the channel the plan assigns it to).
  const bandA = { bodies: 0, onTerrestrialParent: 0, planetClass: 0,
                  byParentType: new Map(), systemsWith: new Set(), coords: [] };
  const bandB = { bodies: 0, bodiesOnGiants: 0, planetClass: 0,
                  byParentType: new Map(), systemsWith: new Set(), giantsWith: new Set() };
  let terrestrialPlanets = 0, solidPlanets = 0, giantPlanets = 0;
  const terrestrialPerSystem = [];
  const solidPerSystem = [];

  for (const s of systems) {
    let tCount = 0, sCount = 0;
    for (let pi = 0; pi < s.planets.length; pi++) {
      const p = s.planets[pi];
      const t = p.pd?.type;
      const giant = GIANT_PARENT_TYPES.has(t);
      if (giant) giantPlanets++; else { solidPlanets++; sCount++; }
      if (t === 'terrestrial') { terrestrialPlanets++; tCount++; }
      for (const m of p.moons) {
        const r = m.radiusEarth;
        if (!num(r)) continue;
        if (!giant && r >= 0.2 && r <= 0.7) {
          bandA.bodies++; bandA.systemsWith.add(s.seed);
          bandA.byParentType.set(t, (bandA.byParentType.get(t) || 0) + 1);
          if (t === 'terrestrial') bandA.onTerrestrialParent++;
          if (isPlanetClass(m)) bandA.planetClass++;
          bandA.coords.push(`${s.seed}/${pi} (parent ${t}, moon R=${r.toFixed(3)} R⊕)`);
        }
        if (r > 1.0) {
          bandB.bodies++; bandB.systemsWith.add(s.seed);
          bandB.byParentType.set(t, (bandB.byParentType.get(t) || 0) + 1);
          if (isPlanetClass(m)) bandB.planetClass++;
          if (giant) { bandB.bodiesOnGiants++; bandB.giantsWith.add(`${s.seed}/${pi}`); }
        }
      }
    }
    terrestrialPerSystem.push(tCount);
    solidPerSystem.push(sCount);
  }

  out.bands = {
    terrestrialPlanets, solidPlanets, giantPlanets,
    bandA: {
      bodies: bandA.bodies,
      planetClass: bandA.planetClass,
      onTerrestrialParent: bandA.onTerrestrialParent,
      // The physically meaningful per-planet rate: bodies on `terrestrial`
      // parents ÷ `terrestrial` planets. This is the denominator Elser's 8.3%
      // is stated against.
      perTerrestrialPlanetStrict: terrestrialPlanets
        ? bandA.onTerrestrialParent / terrestrialPlanets : null,
      // ⚠ The MIXED denominator: ALL solid-parent band-A bodies ÷ `terrestrial`
      // planets. Reported only because a careless reading of "per terrestrial
      // planet" produces it, and it is off by the ratio of solid planets to
      // terrestrial ones. Do not quote it.
      mixedSolidBodiesPerTerrestrialPlanet: terrestrialPlanets
        ? bandA.bodies / terrestrialPlanets : null,
      perSolidPlanet: solidPlanets ? bandA.bodies / solidPlanets : null,
      meanPerSystem: bandA.bodies / systems.length,
      fractionOfSystemsWithOne: bandA.systemsWith.size / systems.length,
      systemsWithOne: bandA.systemsWith.size,
      byParentType: [...bandA.byParentType.entries()].sort((a, b) => b[1] - a[1]),
      coords: bandA.coords,
    },
    bandB: {
      bodies: bandB.bodies,
      planetClass: bandB.planetClass,
      bodiesOnGiants: bandB.bodiesOnGiants,
      perGiant: giantPlanets ? bandB.bodiesOnGiants / giantPlanets : null,
      fractionOfGiantsWithOne: giantPlanets ? bandB.giantsWith.size / giantPlanets : null,
      meanPerSystem: bandB.bodies / systems.length,
      fractionOfSystemsWithOne: bandB.systemsWith.size / systems.length,
      systemsWithOne: bandB.systemsWith.size,
      byParentType: [...bandB.byParentType.entries()].sort((a, b) => b[1] - a[1]),
    },
  };

  // ── §5 terrestrial-planet multiplicity ────────────────────────────────────
  const tHist = new Map();
  for (const c of terrestrialPerSystem) tHist.set(c, (tHist.get(c) || 0) + 1);
  out.multiplicity = {
    meanTerrestrialPerSystem: mean(terrestrialPerSystem),
    meanTerrestrialPerSystemWithPlanets: mean(
      terrestrialPerSystem.filter((_, i) => systems[i].planets.length > 0)),
    meanSolidPerSystem: mean(solidPerSystem),
    histogram: [...tHist.entries()].sort((a, b) => a[0] - b[0]),
  };

  // ── §6 mass ratio, the two populations kept apart ─────────────────────────
  const ratiosPlain = [], ratiosPC = [];
  let plainMassOk = 0, plainMassMissing = 0;
  let pcTopLevelMass = 0, pcNestedMassOk = 0, pcMassMissing = 0;
  let plainCompOk = 0, pcCompOk = 0;

  for (const s of systems) for (const p of s.planets) {
    const pm = p.pd?.massEarth;
    for (const m of p.moons) {
      const pc = isPlanetClass(m);
      if (pc) {
        if (m.massEarth !== undefined) pcTopLevelMass++;
        if (num(m.planetData?.massEarth)) pcNestedMassOk++; else pcMassMissing++;
        if (num(m.planetData?.composition?.density)) pcCompOk++;
      } else {
        if (num(m.massEarth)) plainMassOk++; else plainMassMissing++;
        if (num(m.composition?.density)) plainCompOk++;
      }
      const mm = moonMassEarth(m);
      if (num(mm) && num(pm) && pm > 0) (pc ? ratiosPC : ratiosPlain).push(mm / pm);
    }
  }
  out.massRatio = {
    plain: dist(ratiosPlain),
    planetClass: dist(ratiosPC),
    combined: dist(ratiosPlain.concat(ratiosPC)),
    shapeAssertions: {
      plainWithTopLevelMassEarth: plainMassOk,
      plainMissingMassEarth: plainMassMissing,
      planetClassWithTopLevelMassEarth: pcTopLevelMass,   // expected 0 — the trap
      planetClassWithNestedMassEarth: pcNestedMassOk,
      planetClassMissingMassEntirely: pcMassMissing,
      plainWithCompositionDensity: plainCompOk,
      planetClassWithNestedCompositionDensity: pcCompOk,
    },
    // What the naive single-path read would have reported, kept so the size of
    // the trap is a measured number rather than a warning.
    naiveTopLevelOnly: dist((() => {
      const v = [];
      for (const s of systems) for (const p of s.planets) {
        const pm = p.pd?.massEarth;
        for (const m of p.moons) if (num(m.massEarth) && num(pm) && pm > 0) v.push(m.massEarth / pm);
      }
      return v;
    })()),
  };

  // ── §7 Hill and Roche ─────────────────────────────────────────────────────
  let hillEval = 0, hillSkipped = 0;
  let overFullHill = 0, overProgradeLimit = 0, overRetrogradeLimit = 0;
  // ⛔ THE THREE COUNTS ABOVE ARE NESTED, NOT DISJOINT. Every moon past 1.0 R_H
  // is ALSO past its own Domingos limit (0.4895 < 0.9309 < 1.0), so summing
  // them double-counts. `beyondDomingos` is the union — each moon judged
  // against the limit for ITS OWN orbital sense — and it is the number B8's
  // "zero moons outside the Domingos limits" assertion has to drive to zero.
  let beyondDomingos = 0, unboundAlsoBeyondDomingos = 0;
  const hillFractions = [];
  let rocheEval = 0, rocheSkipped = 0, rocheViolations = 0;
  const rocheRatios = [];
  let migratedSystems = 0, resonantSystems = 0;

  for (const s of systems) {
    if (s.migrated) migratedSystems++;
    if (s.resonant) resonantSystems++;
    for (const p of s.planets) {
      const pm = p.pd?.massEarth, pr = p.pd?.radiusEarth, pdens = p.pd?.composition?.density;
      const aAU = p.orbitAU;
      const hillAU = (num(pm) && num(aAU) && num(s.starMassSolar) && s.starMassSolar > 0)
        ? aAU * Math.cbrt((pm / EARTH_MASSES_PER_SUN) / (3 * s.starMassSolar))
        : null;
      const hillEarthRadii = hillAU == null ? null : hillAU / EARTH_RADIUS_AU;

      for (const m of p.moons) {
        const a = m.orbitRadiusEarth;
        // Hill
        if (num(a) && num(hillEarthRadii) && hillEarthRadii > 0) {
          hillEval++;
          const frac = a / hillEarthRadii;
          hillFractions.push(frac);
          const beyond = isRetrograde(m) ? frac > 0.9309 : frac > 0.4895;
          if (beyond) beyondDomingos++;
          if (frac > 1.0) { overFullHill++; if (beyond) unboundAlsoBeyondDomingos++; }
          if (isRetrograde(m)) { if (frac > 0.9309) overRetrogradeLimit++; }
          else if (frac > 0.4895) overProgradeLimit++;
        } else hillSkipped++;
        // Roche
        const md = moonDensity(m);
        if (num(a) && num(pr) && pr > 0 && num(pdens) && pdens > 0 && num(md) && md > 0) {
          rocheEval++;
          const rocheMultiple = rocheLimit(pdens, md);        // in parent radii
          const ratio = (a / pr) / rocheMultiple;
          rocheRatios.push(ratio);
          if (ratio < 1.0) rocheViolations++;
        } else rocheSkipped++;
      }
    }
  }
  out.hill = {
    convention: 'R_H = a_p · (M_p / (3·M_*))^(1/3); a_p = FINAL wrapper.orbitRadiusAU',
    evaluated: hillEval, skipped: hillSkipped,
    overFullHill,
    overProgradeLimit,   // Domingos 0.4895 R_H, prograde
    overRetrogradeLimit, // Domingos 0.9309 R_H, retrograde
    beyondDomingos,              // the UNION — the B8 acceptance number
    unboundAlsoBeyondDomingos,   // overlap; equals overFullHill when nested
    fractionDist: dist(hillFractions),
    migratedSystems, resonantSystems,
  };
  out.roche = {
    convention: 'PhysicsEngine.rocheLimit(rho_parent, rho_moon), fluid form, in parent radii',
    evaluated: rocheEval, skipped: rocheSkipped, violations: rocheViolations,
    aOverRocheDist: dist(rocheRatios),
  };

  // ── §8 sibling-order inversions ───────────────────────────────────────────
  let adjacentPairs = 0, inversions = 0, planetsWithInversion = 0;
  for (const s of systems) for (const p of s.planets) {
    let any = false;
    for (let i = 0; i + 1 < p.moons.length; i++) {
      const a = p.moons[i].orbitRadiusEarth, b = p.moons[i + 1].orbitRadiusEarth;
      if (!num(a) || !num(b)) continue;
      adjacentPairs++;
      if (b < a) { inversions++; any = true; }
    }
    if (any) planetsWithInversion++;
  }
  out.siblingOrder = { adjacentPairs, inversions, planetsWithInversion,
                       rate: adjacentPairs ? inversions / adjacentPairs : null };

  // ── §9 regular / irregular split ──────────────────────────────────────────
  // ⚠ There is no `regular` flag and no `retrograde` FIELD in the generator, so
  // this is a convention, not a read. Three of them, reported side by side.
  let capturedType = 0, retro = 0, either = 0, both = 0, total = 0;
  const inclinations = [];
  for (const s of systems) for (const p of s.planets) for (const m of p.moons) {
    total++;
    const c = m.type === 'captured', r = isRetrograde(m);
    if (c) capturedType++;
    if (r) retro++;
    if (c || r) either++;
    if (c && r) both++;
    if (num(m.inclination)) inclinations.push(Math.abs(m.inclination));
  }
  out.regularity = {
    total,
    typeCaptured: capturedType,
    retrogradeBySpeedSign: retro,
    eitherIrregular: either,
    bothCapturedAndRetrograde: both,
    regularByEither: total - either,
    absInclinationDist: dist(inclinations),
  };

  // ── §10 radius distribution, for context on the bands ─────────────────────
  const rPlain = [], rPC = [];
  for (const s of systems) for (const p of s.planets) for (const m of p.moons) {
    if (num(m.radiusEarth)) (isPlanetClass(m) ? rPC : rPlain).push(m.radiusEarth);
  }
  out.radius = { plain: dist(rPlain), planetClass: dist(rPC), combined: dist(rPlain.concat(rPC)) };

  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// REPORT
// ─────────────────────────────────────────────────────────────────────────────
function report(r, corpus) {
  const L = [];
  const say = (s = '') => L.push(s);

  say(`# Moon census — corpus ${corpus.name}`);
  say();
  say(`**Corpus:** \`${corpus.name}\` — ${corpus.desc}.`);
  say();
  say(`**Provenance:** ${corpus.provenance}.`);
  say();
  say('⛔ Do not quote any number below against a different corpus without re-measuring. This');
  say('project has already lost figures that way: `moon-formation-audit-2026-08-15.md` and');
  say('`tests/body-identity-fence.test.js` both say "221 seeds" and mean different sets.');
  say();
  say('**Tool:** `tools/moon-census.mjs` — read-only; imports the shipped generator, installs no');
  say('wrappers, writes nothing, mutates nothing.');
  say();

  // §1
  say('## 1. Population');
  say();
  const p = r.population;
  const pin = corpus.pinned;
  say(`| quantity | measured | ${pin ? 'fence pins' : 'pinned elsewhere'} |`);
  say('|---|---:|---:|');
  say(`| seeds | ${p.seeds} | ${pin ? pin.seeds : '—'} |`);
  say(`| planets | ${p.planets} | ${pin ? pin.planets : '—'} |`);
  say(`| plain moons | ${p.plain} | ${pin ? pin.plain : '—'} |`);
  say(`| planet-class moons | ${p.planetClass} | ${pin ? pin.planetClass : '—'} |`);
  say(`| moons total | ${p.moons} | ${pin ? pin.plain + pin.planetClass : '—'} |`);
  say();

  // §2
  say('## 2. m̄ — mean moons per system');
  say();
  say('⚠ Three denominators, and they are **not** interchangeable. The plan quotes 3.69; whichever');
  say('row that was, the others are the ones a rate conversion will silently get wrong.');
  say();
  const mb = r.mBar;
  say('| denominator | n | m̄ |');
  say('|---|---:|---:|');
  say(`| all systems in the corpus | ${p.seeds} | **${f(mb.perSystemAll, 4)}** |`);
  say(`| systems that have ≥1 planet | ${mb.systemsWithPlanets} | ${f(mb.perSystemWithPlanets, 4)} |`);
  say(`| systems that have ≥1 moon | ${mb.moonBearingSystems} | ${f(mb.perMoonBearingSystem, 4)} |`);
  say(`| per PLANET (not per system) | ${p.planets} | ${f(mb.perPlanet, 4)} |`);
  say();
  say(`Planet-free systems: ${mb.emptySystems} of ${p.seeds}.`);
  say();

  // §3
  say('## 3. Moons per parent type');
  say();
  say('| parent type | planets | moons | mean | max | P(zero moons) |');
  say('|---|---:|---:|---:|---:|---:|');
  for (const row of r.byParentType) {
    say(`| ${row.type} | ${row.n} | ${row.moons} | ${f(row.meanMoons, 3)} | ${row.maxMoons} | ${pctStr(row.pZero)} |`);
  }
  say();
  say(`**P(zero moons | gas giant) = ${pctStr(r.pZeroGasGiant)}**`);
  say();

  // §4
  say('## 4. Band A and Band B');
  say();
  say('**Band A** = a moon of radius 0.2–0.7 R⊕ on a SOLID parent (parent type not in');
  say('{gas-giant, hot-jupiter, sub-neptune}). **Band B** = a moon of radius > 1 R⊕.');
  say();
  const b = r.bands;
  say(`Parent inventory: ${b.terrestrialPlanets} planets of type \`terrestrial\`, ${b.solidPlanets} solid planets of any type, ${b.giantPlanets} giants.`);
  say();
  say('| Band A — the denominators are NOT interchangeable | value |');
  say('|---|---:|');
  say(`| bodies in band (solid parents, all solid types) | ${b.bandA.bodies} |`);
  say(`| of those, planet-class records | ${b.bandA.planetClass} |`);
  say(`| of those, on a \`terrestrial\` parent | ${b.bandA.onTerrestrialParent} |`);
  say(`| **per \`terrestrial\` planet (strict — Elser's denominator)** | **${f(b.bandA.perTerrestrialPlanetStrict, 5)}** |`);
  say(`| per SOLID planet (any solid type) | ${f(b.bandA.perSolidPlanet, 5)} |`);
  say(`| mean per system | ${f(b.bandA.meanPerSystem, 5)} |`);
  say(`| fraction of systems with ≥1 | ${pctStr(b.bandA.fractionOfSystemsWithOne)} (${b.bandA.systemsWithOne}/${p.seeds}) |`);
  say(`| ⚠ MIXED denominator, do not quote: all solid-parent band-A bodies ÷ \`terrestrial\` planets | ${f(b.bandA.mixedSolidBodiesPerTerrestrialPlanet, 5)} |`);
  say();
  if (b.bandA.byParentType.length) {
    say('Band A bodies by parent type: '
      + b.bandA.byParentType.map(([t, n]) => `\`${t}\` ${n}`).join(', ') + '.');
    say();
    say('Coordinates (`seed/planetIndex`): ' + b.bandA.coords.map((c) => `\`${c}\``).join('; ') + '.');
    say();
  }
  say('| Band B | value |');
  say('|---|---:|');
  say(`| bodies in band (any parent) | ${b.bandB.bodies} |`);
  say(`| of those, planet-class records | ${b.bandB.planetClass} |`);
  say(`| of those, on a giant parent | ${b.bandB.bodiesOnGiants} |`);
  say(`| per giant | ${f(b.bandB.perGiant, 5)} |`);
  say(`| fraction of giants with ≥1 | ${pctStr(b.bandB.fractionOfGiantsWithOne)} |`);
  say(`| mean per system | ${f(b.bandB.meanPerSystem, 5)} |`);
  say(`| fraction of systems with ≥1 | ${pctStr(b.bandB.fractionOfSystemsWithOne)} (${b.bandB.systemsWithOne}/${p.seeds}) |`);
  say();
  if (b.bandB.byParentType.length) {
    say('Band B bodies by parent type: '
      + b.bandB.byParentType.map(([t, n]) => `\`${t}\` ${n}`).join(', ') + '.');
    say();
  }

  // §5
  say('## 5. Terrestrial-planet multiplicity');
  say();
  say('The plan names this the highest-risk unknown: Elser\'s per-planet rate converts to a');
  say('per-system rate only through this number.');
  say();
  const mu = r.multiplicity;
  say(`- mean \`terrestrial\` planets per system (all ${p.seeds}): **${f(mu.meanTerrestrialPerSystem, 4)}**`);
  say(`- mean \`terrestrial\` planets per system with ≥1 planet: ${f(mu.meanTerrestrialPerSystemWithPlanets, 4)}`);
  say(`- mean SOLID planets per system: ${f(mu.meanSolidPerSystem, 4)}`);
  say();
  say('| terrestrial planets in system | systems |');
  say('|---:|---:|');
  for (const [k, v] of mu.histogram) say(`| ${k} | ${v} |`);
  say();

  // §6
  say('## 6. Mass ratio (moon mass ÷ parent mass)');
  say();
  say('Nearest-rank percentiles, no interpolation. The two populations are reported SEPARATELY');
  say('because they carry mass on different paths — see §7.');
  say();
  const mr = r.massRatio;
  say('| population | n | p05 | median | p95 | max |');
  say('|---|---:|---:|---:|---:|---:|');
  const row = (name, d) => say(`| ${name} | ${d.n} | ${d.p05 == null ? '—' : d.p05.toExponential(3)} | ${d.median == null ? '—' : d.median.toExponential(3)} | ${d.p95 == null ? '—' : d.p95.toExponential(3)} | ${d.max == null ? '—' : d.max.toExponential(3)} |`);
  row('plain moons', mr.plain);
  row('planet-class moons', mr.planetClass);
  row('combined', mr.combined);
  row('⚠ naive `m.massEarth` only', mr.naiveTopLevelOnly);
  say();

  // §7
  say('## 7. Record-shape assertions (the mass trap, asserted not assumed)');
  say();
  const sa = mr.shapeAssertions;
  say('| assertion | count |');
  say('|---|---:|');
  say(`| plain moons carrying top-level \`massEarth\` | ${sa.plainWithTopLevelMassEarth} |`);
  say(`| plain moons MISSING top-level \`massEarth\` | ${sa.plainMissingMassEarth} |`);
  say(`| planet-class moons carrying top-level \`massEarth\` (expect 0) | ${sa.planetClassWithTopLevelMassEarth} |`);
  say(`| planet-class moons carrying \`planetData.massEarth\` | ${sa.planetClassWithNestedMassEarth} |`);
  say(`| planet-class moons with no mass on EITHER path | ${sa.planetClassMissingMassEntirely} |`);
  say(`| plain moons carrying \`composition.density\` | ${sa.plainWithCompositionDensity} |`);
  say(`| planet-class moons carrying \`planetData.composition.density\` | ${sa.planetClassWithNestedCompositionDensity} |`);
  say();

  // §8
  say('## 8. Hill-sphere occupancy');
  say();
  say(`**Convention:** ${r.hill.convention}.`);
  say('Star mass reproduced as `star.radiusSolar ** 1.25` (`StarSystemGenerator.js:386`).');
  say('⚠ The parent orbit used is the FINAL one — migration and resonance-snap rewrite');
  say('`wrapper.orbitRadiusAU` in place AFTER the moon loop, so for a migrated system this is not');
  say('the orbit the moon was generated against. Migration incidence is reported so the size of');
  say('that caveat is visible.');
  say();
  const h = r.hill;
  say('| quantity | value |');
  say('|---|---:|');
  say(`| moons evaluated | ${h.evaluated} |`);
  say(`| moons skipped (missing input) | ${h.skipped} |`);
  say(`| prograde moons beyond 0.4895 R_H (Domingos) | ${h.overProgradeLimit} |`);
  say(`| retrograde moons beyond 0.9309 R_H (Domingos) | ${h.overRetrogradeLimit} |`);
  say(`| **UNION — beyond its OWN sense's Domingos limit (the B8 number)** | **${h.beyondDomingos}** |`);
  say(`| a > 1.0 R_H (unbound) — a SUBSET of the union above | ${h.overFullHill} |`);
  say(`| of those unbound, already counted in the union | ${h.unboundAlsoBeyondDomingos} |`);
  say();
  say('⛔ **These rows are NESTED, not disjoint — do not add them.** Because');
  say('`0.4895 < 0.9309 < 1.0`, every unbound moon is already past its own Domingos limit, so');
  say(`the ${h.overFullHill} unbound moons sit INSIDE the ${h.beyondDomingos}, not beside them. Summing the prograde,`);
  say(`retrograde and unbound rows gives ${h.overProgradeLimit + h.overRetrogradeLimit + h.overFullHill}, which is ${h.overProgradeLimit + h.overRetrogradeLimit + h.overFullHill - h.beyondDomingos} moons of double-count. B8 asserts "zero moons`);
  say(`outside 0.4895 R_H prograde / 0.9309 R_H retrograde" — the count it must drive to zero is`);
  say(`**${h.beyondDomingos}**, and the unbound subset is a severity note on it, not an addition to it.`);
  say();
  say('| further detail | value |');
  say('|---|---:|');
  say(`| a/R_H  p05 / median / p95 / max | ${f(h.fractionDist.p05, 5)} / ${f(h.fractionDist.median, 5)} / ${f(h.fractionDist.p95, 5)} / ${f(h.fractionDist.max, 5)} |`);
  say(`| systems where migration occurred | ${h.migratedSystems} / ${p.seeds} |`);
  say(`| systems with a resonance chain | ${h.resonantSystems} / ${p.seeds} |`);
  say();

  // §9
  say('## 9. Roche-limit violations');
  say();
  say(`**Convention:** ${r.roche.convention}.`);
  say();
  const ro = r.roche;
  say('| quantity | value |');
  say('|---|---:|');
  say(`| moons evaluated | ${ro.evaluated} |`);
  say(`| moons skipped (missing density) | ${ro.skipped} |`);
  say(`| inside Roche (a < R_roche) | ${ro.violations} |`);
  say(`| a/R_roche  min / p05 / median / max | ${f(ro.aOverRocheDist.min, 3)} / ${f(ro.aOverRocheDist.p05, 3)} / ${f(ro.aOverRocheDist.median, 3)} / ${f(ro.aOverRocheDist.max, 3)} |`);
  say();

  // §10
  say('## 10. Sibling-order inversions');
  say();
  const so = r.siblingOrder;
  say(`Adjacent moon pairs (by \`orbitRadiusEarth\`, in generation order): **${so.inversions} inverted of ${so.adjacentPairs}** — ${pctStr(so.rate)}.`);
  say(`Planets carrying at least one inversion: ${so.planetsWithInversion}.`);
  say();

  // §11
  say('## 11. Regular / irregular split');
  say();
  say('⚠ There is no `regular` flag and no `retrograde` FIELD on any generated moon. Retrograde');
  say('survives only as the SIGN of `orbitSpeed`. So this is a convention, and three of them are');
  say('reported side by side rather than one being passed off as a read.');
  say();
  const g = r.regularity;
  say('| convention | count | of | share |');
  say('|---|---:|---:|---:|');
  say(`| type === 'captured' | ${g.typeCaptured} | ${g.total} | ${pctStr(g.typeCaptured / g.total)} |`);
  say(`| orbitSpeed < 0 (retrograde) | ${g.retrogradeBySpeedSign} | ${g.total} | ${pctStr(g.retrogradeBySpeedSign / g.total)} |`);
  say(`| either (irregular) | ${g.eitherIrregular} | ${g.total} | ${pctStr(g.eitherIrregular / g.total)} |`);
  say(`| both | ${g.bothCapturedAndRetrograde} | ${g.total} | ${pctStr(g.bothCapturedAndRetrograde / g.total)} |`);
  say(`| regular (neither) | ${g.regularByEither} | ${g.total} | ${pctStr(g.regularByEither / g.total)} |`);
  say();
  say(`|abs inclination| p05 / median / p95 / max (rad): ${f(g.absInclinationDist.p05, 4)} / ${f(g.absInclinationDist.median, 4)} / ${f(g.absInclinationDist.p95, 4)} / ${f(g.absInclinationDist.max, 4)}`);
  say();

  // §12
  say('## 12. Moon radius distribution (context for §4)');
  say();
  say('| population | n | min | p05 | median | p95 | max |');
  say('|---|---:|---:|---:|---:|---:|---:|');
  for (const [name, d] of [['plain', r.radius.plain], ['planet-class', r.radius.planetClass], ['combined', r.radius.combined]]) {
    say(`| ${name} | ${d.n} | ${f(d.min, 4)} | ${f(d.p05, 4)} | ${f(d.median, 4)} | ${f(d.p95, 4)} | ${f(d.max, 4)} |`);
  }
  say();

  // §13 — the whole point of stamping the corpus.
  say('## 13. Disagreements with figures quoted upstream');
  say();
  say('⛔ Nothing below was adjusted to make a quoted figure come out right. Where this corpus');
  say('disagrees, the disagreement is the report.');
  say();
  say(`| quantity | quoted upstream | measured on ${corpus.name} | verdict |`);
  say('|---|---:|---:|---|');
  const mbAll = r.mBar.perSystemAll, mbP = r.mBar.perSystemWithPlanets, mbM = r.mBar.perMoonBearingSystem;
  const so2 = r.siblingOrder;
  const v = (ok, s) => (ok ? `reproduces (${s})` : `**does not reproduce**`);
  say(`| m̄, mean moons per system (PLAN §B0) | 3.69 | ${f(mbAll, 4)} all · ${f(mbP, 4)} with-planets · ${f(mbM, 4)} moon-bearing | **no denominator reproduces 3.69 on either corpus** |`);
  say(`| P(zero moons \\| gas giant) (AUDIT §2) | 13.9% (10 of 72) | ${pctStr(r.pZeroGasGiant)} | ${v(Math.abs(r.pZeroGasGiant - 0.139) < 0.0005, 'corpus match')} |`);
  say(`| sibling-order inversions (AUDIT §3.1) | 60 of 321 (18.7%) | ${so2.inversions} of ${so2.adjacentPairs} (${pctStr(so2.rate)}) | ${v(so2.inversions === 60 && so2.adjacentPairs === 321, 'corpus match')} |`);
  say(`| moons / 221 seeds (AUDIT §1) | 829 | ${p.moons} | ${v(p.moons === 829, 'corpus match')} |`);
  // ⭐ The Hill rows are the one place where a corpus match does NOT rescue the
  // audit. See the note below the table.
  say(`| moons outside R_Hill outright (AUDIT §0) | 32 of 829 | ${r.hill.overFullHill} of ${p.moons} | ${v(r.hill.overFullHill === 32, 'corpus match')} |`);
  say(`| + "47 more" beyond 0.4895 prograde ⇒ union (AUDIT §0) | 79 | ${r.hill.beyondDomingos} | ${v(r.hill.beyondDomingos === 79, 'corpus match')} |`);
  if (pin) {
    say(`| population (planets / plain / planet-class) (FENCE) | ${pin.planets} / ${pin.plain} / ${pin.planetClass} | ${p.planets} / ${p.plain} / ${p.planetClass} | ${v(p.planets === pin.planets && p.plain === pin.plain && p.planetClass === pin.planetClass, 'exact')} |`);
  }
  say();
  say('⭐ **The audit\'s corpus is not the fence\'s corpus.** Run `--corpus=bulk221` and all four');
  say('of its POPULATION figures reproduce exactly; run the default FENCE-221 and none of them do.');
  say('Both documents say "221 seeds". Neither corpus is wrong; quoting one\'s number against the');
  say('other is.');
  say();
  say('⛔ **The Hill rows are the exception, and they are a different KIND of disagreement.** The');
  say('audit\'s corpus is settled — BULK-221 reproduces its 948 planets, its 829 moons, its 10-of-72,');
  say('its 60-of-321, its 26 planet-class moons, and its 508 moon-bearing planets (73+435). So its');
  say('Hill figures cannot be excused as a corpus artefact: on the very corpus that reproduces');
  say('everything else it reports, "32 of 829 outside R_Hill, plus 47 more" measures **16 and 48**');
  say('here, a union of **51** against its 79. The audit states it recomputed "against final');
  say('orbits" — the convention used here — but records no formula. Swept this session and NOT');
  say('reproduced under: `M_p/(3M_*)` and `M_p/M_*`; thresholds 0.4895 → 1.0; per-moon and');
  say('per-planet denominators; primary-only and combined binary star mass. **Treat the audit\'s');
  say('32/47 as unsourced until someone reproduces it; the numbers above are the reproducible ones.**');
  say();

  return L.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const corpusArg = (args.find((a) => a.startsWith('--corpus=')) || '--corpus=fence221').split('=')[1];
const corpus = CORPORA[corpusArg];
if (!corpus) {
  process.stderr.write(`unknown corpus "${corpusArg}". Known: ${Object.keys(CORPORA).join(', ')}\n`);
  process.exit(2);
}

const systems = collect(corpus);
const r = measure(systems);

// ⛔ The pinned-population check runs ONLY where a pin exists, and it never
// rewrites anything to agree. A corpus that has drifted out from under the
// fence is a finding about the generator, not a nuisance about the tool.
const mismatch = [];
if (corpus.pinned) {
  const pin = corpus.pinned;
  if (r.population.seeds !== pin.seeds) mismatch.push(`seeds ${r.population.seeds} vs ${pin.seeds}`);
  if (r.population.planets !== pin.planets) mismatch.push(`planets ${r.population.planets} vs ${pin.planets}`);
  if (r.population.plain !== pin.plain) mismatch.push(`plain moons ${r.population.plain} vs ${pin.plain}`);
  if (r.population.planetClass !== pin.planetClass) mismatch.push(`planet-class moons ${r.population.planetClass} vs ${pin.planetClass}`);
}

if (args.includes('--json')) {
  process.stdout.write(JSON.stringify({ corpus: corpus.name, mismatch, ...r }, null, 2) + '\n');
} else {
  process.stdout.write(report(r, corpus) + '\n');
}

if (mismatch.length) {
  process.stderr.write(
    `\n⛔ ${corpus.name} DISAGREES WITH ITS PINNED POPULATION. This is a FINDING, not a nuisance.\n`
    + '   Do NOT adjust the expected numbers to match. Report it.\n'
    + mismatch.map((m) => `   · ${m}\n`).join(''),
  );
  process.exit(3);
}
