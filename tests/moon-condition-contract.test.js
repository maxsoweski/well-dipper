// tests/moon-condition-contract.test.js — VALUE gates for Step 8a's six derived moon fields.
// Build plan: docs/FEATURES/step8-build-plan-2026-08-12.md §5 (G3, G4, G6), commit C6.
//
// ════════════════════════════════════════════════════════════════════════════════════════════
// WHY THIS FILE EXISTS, IN ONE PARAGRAPH
// ════════════════════════════════════════════════════════════════════════════════════════════
// C4 (2f3f8fd) appended `massEarth`, `age`, `T_eq`, `composition`, `surfaceHistory` and
// `tidalState` to every plain moon. C5 (ea8afca) re-blessed Instrument B's baseline, which is
// correct process — and which also made five KNOWN-WRONG VALUES invisible to every hash channel.
// A hash says "the same as last time". It cannot say "right". Those five are named in C4's and
// C5's commit messages; every one of them is gated below, and each gate says in a comment whether
// it asserts CORRECTNESS (physics, and therefore may fail today) or CURRENT BEHAVIOUR (today's
// value, with the defect named so the next author sees a price tag instead of a green tick).
//
// ⛔ TWO GATES FAIL TODAY, BY DESIGN — see `POST-OVERLAY` and `T_eq AGREES WITH ITS PARENT`.
// Both fail on the same three bodies, both point at `src/generation/ExoticOverlay.js`, and both
// are written for correctness rather than weakened to green. Weakening them would lock the
// defects in, which is the exact failure C6 exists to prevent. The src fixes are named in each.
//
// ════════════════════════════════════════════════════════════════════════════════════════════
// THE CORPUS — stated once, and every threshold in this file names it again at its own site
// ════════════════════════════════════════════════════════════════════════════════════════════
// 197 seeds: `wd-0` … `wd-191` (the fence's BULK block) plus the fence's 5 PINNED seeds, all with
// `galaxyContext = null`. Measured at ea8afca on a clean tree:
//
//     728 moons total  =  705 plain  +  23 planet-class
//     733 plain records RETURNED by MoonGenerator.generate (705 survivors + 28 orphans discarded
//         with their parent by migration-scatter / binary culling — see C4's §8 item 1 note)
//
// ⚠ THIS IS NOT THE FENCE'S 221-SEED CORPUS. The fence adds 24 `gc-*` seeds with real GalacticMap
// contexts, and C4/C5 quote 770 plain moons on that list. This file deliberately drops the galaxy
// block: it would require duplicating the fence's `GALAXY_POSITIONS` spiral and its GalacticMap
// construction — a second source of truth for a population shape — and it buys nothing any value
// arm reads. It keeps the 5 PINNED seeds because `wd-614` is one of the three bodies the two
// failing gates below land on, and `wd-1403` is the fence's terrestrial-moon seed.
// ⛔ Do not quote a threshold from this file against the 221-seed list or against `wd-0…1499`.
// Measured spread, same quantity (surface gravity, plain moons): this corpus max 1.2499 g;
// the 221-seed fence max 1.2499 g; `wd-0…1499` max 16.16 g. The third would red every bound here.
//
// ════════════════════════════════════════════════════════════════════════════════════════════
// TWO LAYERS, AND WHY THE FILE MEASURES BOTH
// ════════════════════════════════════════════════════════════════════════════════════════════
// `MoonGenerator.generate` is wrapped for one generation pass, so every assertion can be made at
// the layer that can actually answer it:
//
//   RETURN TIME  — the record as the generator built it, plus the arguments it was built from
//                  (`zones.luminosity`, `parentOrbitAU`, the parent's mass/radius). This is the
//                  only layer where a derivation identity is checkable, because the inputs are
//                  only in scope here.
//   POST-GENERATE — the record as it survives `StarSystemGenerator.generate`, i.e. after
//                  `ExoticOverlay` has had its way with it. This is the layer every consumer sees.
//
// The pair localises break B7 as an assertion rather than a comment: the mass↔radius identity is
// green on 733/733 at return time and red on 3/705 afterwards, which names the mutating file.
//
// ⛔ NOTHING HERE IMPORTS `tests/body-identity-fence.test.js`. It has zero exports, and importing
// a vitest module executes its `describe`/`it` registrations inside the importer — this file would
// silently inherit all 8 fence tests and re-run its 221-seed capture. The seed lists below are
// duplicated (two lines, one of them a formula) with that trade stated.

import { describe, it, expect, beforeAll } from 'vitest';

import { StarSystemGenerator } from '../src/generation/StarSystemGenerator.js';
import { MoonGenerator } from '../src/generation/MoonGenerator.js';
import { PlanetGenerator } from '../src/generation/PlanetGenerator.js';
import { SeededRandom } from '../src/generation/SeededRandom.js';
import { conditionFromBody, atmosphereFromPlanet } from '../src/worldengine/port/conditionFromBody.js';
import {
  equilibriumTemperature, tidalLockTimescale, checkTidalLock,
  deriveComposition, computeSurfaceHistory,
} from '../src/generation/PhysicsEngine.js';
import { EARTH_RADIUS_AU } from '../src/core/ScaleConstants.js';

// ── Duplicated src constants, deliberately ───────────────────────────────────────────────────
// `RHO_EARTH_KGM3` (MoonGenerator.js:536 `const RHO_EARTH_KGM3 = 5514;`) and `EARTH_MASSES_PER_SUN` (:501) are module-private.
// Copying them as literals is DESIRABLE here: if either ever changes in src, a gate should red and
// the change should be a named act rather than a silent re-scaling of every moon in the universe.
// Precedent: tests/moon-mass-radius-consistency.test.js:46 duplicates EARTH_DENSITY_GCC the same way.
const RHO_EARTH_KGM3 = 5514;
const EARTH_MASSES_PER_SUN = 332946;

// ── The corpus (see header) ──────────────────────────────────────────────────────────────────
// A formula, not a curated list, so drift against the fence is a one-line visible diff.
const BULK_SEEDS = Array.from({ length: 192 }, (_, i) => `wd-${i}`);
// The fence's PINNED block, verbatim (body-identity-fence.test.js:96-110). Kept for `wd-614`
// (city-lights — one of the three ExoticOverlay casualties, and the only one with kEarth > 1) and
// `wd-1403` (the fence's terrestrial-moon seed).
const PINNED_SEEDS = ['wd-356', 'wd-395', 'wd-614', 'wd-2232', 'wd-1403'];
const SEEDS = [...BULK_SEEDS, ...PINNED_SEEDS];

const pct = (arr, p) => {
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
};

// ═════════════════════════════════════════════════════════════════════════════════════════════
// CORPUS CAPTURE
// ═════════════════════════════════════════════════════════════════════════════════════════════
const plain = [];        // surviving plain moons, post-generate, with their FINAL parent
const planetClass = [];  // surviving planet-class moons
const returned = [];     // every plain record as GENERATE RETURNED IT, with its call arguments
const atReturn = new Map(); // moon object -> its return-time snapshot

beforeAll(() => {
  const orig = MoonGenerator.generate;
  MoonGenerator.generate = function wrapped(rng, planetData, moonIndex, totalMoons, parentZone, zones, parentOrbitAU) {
    const out = orig.call(this, rng, planetData, moonIndex, totalMoons, parentZone, zones, parentOrbitAU);
    if (out && !out.planetData) {
      // Primitives only — captured BEFORE any post-return mutation can reach them.
      const snap = {
        radiusEarth: out.radiusEarth,
        massEarth: out.massEarth,
        orbitRadiusEarth: out.orbitRadiusEarth,
        density: out.composition.density,
        T_eq: out.T_eq,
        age: out.age,
        tidalHeating: out.tidalHeating,
        hasAtmosphere: out.atmosphere != null,
        type: out.type,
        // arguments the derivations were computed from — only in scope here
        argLuminosity: zones?.luminosity ?? 1.0,
        argMetallicity: zones?.metallicity ?? 0,
        argFrostLine: zones?.frostLine ?? 4.85,
        argAgeGyr: zones?.ageGyr ?? planetData.age ?? 4.5,
        argParentAU: Math.max(parentOrbitAU ?? 1.0, 0.01),
        argParentMassEarth: planetData.massEarth ?? 0,
        argParentType: planetData.type,
      };
      returned.push(snap);
      atReturn.set(out, snap);
    }
    return out;
  };
  try {
    for (const seed of SEEDS) {
      const sys = StarSystemGenerator.generate(seed, null);
      sys.planets.forEach((entry, pi) => {
        (entry.moons || []).forEach((m, mi) => {
          const rec = { id: `${seed}/${pi}/${mi}`, m, parent: entry.planetData, snap: atReturn.get(m) };
          if (m.planetData) planetClass.push(rec); else plain.push(rec);
        });
      });
    }
  } finally {
    MoonGenerator.generate = orig;
  }
});

describe('moon condition contract — the six derived fields carry real values', () => {
  // ═══════════════════════════════════════════════════════════════════════════════════════════
  // POPULATION GUARD — declared first on purpose (§5 G3). Vitest runs `it`s in declaration order
  // within a file, so if generation ever changes shape this reds BEFORE any value arm gets to
  // pass by measuring an empty array. That failure mode — "0 blinks with no control" — is what
  // every gate below is standing on.
  //
  // MUTANT: `emptycorpus` — make `SEEDS` `['wd-0']`. plainCount 705 -> 4, this reds first.
  // ═══════════════════════════════════════════════════════════════════════════════════════════
  it('POPULATION: the corpus is the one every threshold in this file was fitted to', () => {
    // Measured at ea8afca. Corpus: 197 seeds = wd-0…wd-191 + the 5 PINNED, galaxyContext null.
    expect(SEEDS.length).toBe(197);
    expect(plain.length).toBe(705);
    expect(planetClass.length).toBe(23);
    expect(plain.length + planetClass.length).toBe(728);
    // 733 returned - 705 survivors = 28 plain orphans, discarded with their parent AFTER
    // generation. Any per-plain-moon side effect costs 733, not 705 (C4's §8 item 1).
    expect(returned.length).toBe(733);
    // §5 G3's own floor, restated so the headroom is visible rather than assumed: 41%.
    expect(plain.length).toBeGreaterThanOrEqual(500);
    // Every surviving plain moon must be linkable to its return-time snapshot, or the two-layer
    // arms below are silently comparing a record against nothing.
    expect(plain.filter((r) => r.snap != null).length).toBe(705);
  });

  // ═══════════════════════════════════════════════════════════════════════════════════════════
  // G3 PRESENCE ARM — replaces `:396`'s "zero 'defaulted' on ≥500 moons".
  //
  // ⛔ SCOPED TO THE SEVEN ROWS THE SIX FIELDS DRIVE, NOT TO THE RECORD. `provenanceOf`
  // (conditionFromBody.js:682) emits 18 rows and SEVEN of them are 'defaulted' on 100% of plain
  // moons no matter what Step 8a does — moons have no eccentricity, no host-star mass, no
  // rotation period, no magnetic field, no habitability, no axial tilt and no metallicity on the
  // record. A whole-record "zero defaulted" assertion is permanently red. This is C4's §8 item 4,
  // measured: `conditionFromBody` runs clean on all 705 (0 throws) and the six fields flip.
  //
  // ⚠ SIX FIELDS, SEVEN ROWS: `composition` and `carbonToOxygen` are separate provenance rows.
  //
  // The 'defaulted' set is asserted EXACTLY, not merely tolerated. Both directions matter: a row
  // sliding out of the measured set is a regression; a row sliding out of the defaulted set means
  // somebody quietly started fabricating an input, which is the failure `_provenance` exists for.
  //
  // MUTANT: `zerofill` — append `{massEarth: 0, age: 0, T_eq: 0, surfaceHistory: {}}` instead of
  // the real derivations. THIS ARM STAYS GREEN, and that is the point: `provenanceOf`'s rule is
  // `v != null ? 'measured' : 'defaulted'`, so 0 and {} both read 'measured'. The VALUE arms below
  // are what red. Break B4 in one sentence, wired as a test.
  // ═══════════════════════════════════════════════════════════════════════════════════════════
  it('G3 PRESENCE: the seven rows Step 8a drives read measured; the seven it cannot drive read defaulted', () => {
    const rows = {};
    let threw = 0;
    for (const r of plain) {
      let c;
      try { c = conditionFromBody(r.m); } catch { threw++; continue; }
      for (const [k, v] of Object.entries(c._provenance)) {
        rows[k] = rows[k] || { measured: 0, defaulted: 0 };
        rows[k][v]++;
      }
    }
    expect(threw).toBe(0);

    // Driven by 8a's six appended fields (composition contributes two rows).
    const DRIVEN = ['massEarth', 'composition', 'carbonToOxygen', 'age', 'T_eq', 'tidalState', 'surfaceHistory'];
    // Pre-8a fields the moon record already carried, asserted so a regression there is visible too.
    const ALREADY = ['radiusEarth', 'tidalHeat', 'orbitRadiusEarth', 'atmosphere'];
    for (const k of [...DRIVEN, ...ALREADY]) {
      expect({ row: k, ...rows[k] }).toEqual({ row: k, measured: 705, defaulted: 0 });
    }
    // Permanently defaulted — asserted as an exact set, so this doubles as the record of §8 item 4.
    const PERMANENTLY_DEFAULTED = [
      'eccentricity', 'starMassEarth', 'rotationHours', 'magneticField',
      'habitability', 'axialTilt', 'metallicity',
    ];
    for (const k of PERMANENTLY_DEFAULTED) {
      expect({ row: k, ...rows[k] }).toEqual({ row: k, measured: 0, defaulted: 705 });
    }
    // 11 measured + 7 defaulted = the whole of provenanceOf. No row is unaccounted for.
    expect(Object.keys(rows).sort()).toEqual([...DRIVEN, ...ALREADY, ...PERMANENTLY_DEFAULTED].sort());
  });

  // ═══════════════════════════════════════════════════════════════════════════════════════════
  // G3/G4 VALUE ARM — mass and radius describe the same body. CORRECTNESS. Green today.
  //
  // AT RETURN TIME, which is where MoonGenerator's own invariant is stated
  // (MoonGenerator.js:266 `moon.massEarth = moonRadiusData.radiusEarth ** 3 * (composition.density `).
  // ⚠ The symbol above is the LITERAL line text, not a math paraphrase. An earlier draft wrote
  // `massEarth = radiusEarth³ × …` — correct as algebra, a broken citation as a fence anchor,
  // because the rule is literal token presence on the cited line. :242 was always the right line.
  // Exact to 1e-9 on 733/733 records — orphans included, because an orphan is still a record the
  // generator built and a per-moon side effect costs 733, not 705.
  //
  // ⭐ THIS ARM, NOT THE DISTRIBUTION ARM, IS WHAT KILLS `nodensity`.
  // MUTANT: `nodensity` — `moon.massEarth = radiusEarth ** 3` (drop the density factor). Measured
  // on this corpus: ρ_moon/ρ⊕ spans [0.2528, 0.8610] and is NEVER 1, so this reds on 733/733,
  // deterministically, with no threshold involved. The distribution arm below only moves from
  // p95 0.5617 → 1.1046 under the same mutant, which is why it is a smoke alarm and this is the
  // detector. §5 originally leaned the whole gate on the distribution; that was the weaker half.
  // ═══════════════════════════════════════════════════════════════════════════════════════════
  it('AT RETURN: massEarth is exactly radiusEarth³ × ρ_moon/ρ⊕ on every record the generator builds', () => {
    let worst = 0;
    let violators = 0;
    for (const s of returned) {
      const rhoRel = s.density / RHO_EARTH_KGM3;
      const residual = Math.abs(s.massEarth / (s.radiusEarth ** 3 * rhoRel) - 1);
      if (residual > 1e-9) violators++;
      worst = Math.max(worst, residual);
    }
    expect({ records: returned.length, violators }).toEqual({ records: 733, violators: 0 });
    expect(worst).toBeLessThan(1e-9);
    // The density factor is never 1, which is the fact that makes `nodensity` detectable at all.
    const rel = returned.map((s) => s.density / RHO_EARTH_KGM3);
    expect(Math.min(...rel)).toBeGreaterThan(0.25);
    expect(Math.max(...rel)).toBeLessThan(0.87);
  });

  // ═══════════════════════════════════════════════════════════════════════════════════════════
  // ⛔⛔ G4 POST-OVERLAY ARM — CORRECTNESS. **THIS GATE FAILS TODAY ON 3 OF 705.** ⛔⛔
  //
  // Build-plan §5 G4 names this as "the ExoticOverlay consistency assertion nobody proposed".
  // Here it is, and it is red, and it is being left red.
  //
  // WHAT IS WRONG (break B7, declared in C4's message as known value issue 2 and blessed invisible
  // by C5): `ExoticOverlay._swapPlanetType` (src/generation/ExoticOverlay.js:325-337) rescales an
  // already-generated moon's `radiusEarth` — and `radiusScene`, `orbitRadiusEarth`,
  // `orbitRadiusScene`, `radius`, `orbitRadius`, measured: exactly those six fields on exactly
  // these three bodies — WITHOUT rescaling `massEarth`. The invariant the arm above proves at
  // return time is then broken from outside, by a file that never sees it.
  //
  // The three, measured at ea8afca on this corpus. `factor` is M/(R³·ρ/ρ⊕), i.e. exactly 1/kEarth³:
  //     wd-45/0/0    rocky moon of a `hex` parent          factor 8.6092   implied 35.96 g/cc
  //     wd-79/2/0    ice moon of a `crystal` parent        factor 6.5032   implied 27.57 g/cc
  //     wd-614/1/0   ice moon of a `city-lights` parent    factor 0.6525   implied  2.77 g/cc
  // ⭐ Two of the three are DENSER THAN OSMIUM (22.6 g/cc) and past the < 15 g/cc ceiling this
  // repo already ships and already applies to the neighbouring planet-class population
  // (tests/moon-mass-radius-consistency.test.js:59-70). This is not an internal-consistency
  // quibble; the post-overlay state is physically impossible by a standard already in the tree.
  //
  // ⛔ WHY THIS IS NOT WRITTEN AS "assert today's three violators and move on". §5's named mutant
  // for this gate is `exotic` = "leave massEarth un-rescaled at ExoticOverlay.js:325-337" — which
  // IS HEAD. A gate whose mutant is the shipped code either fails or is not a gate. Pinning the
  // violator set would be green today and would still red on a fourth violator or on the fix, but
  // it would also make the ONLY channel that can see B7 report success while three bodies carry a
  // mass and a radius describing different objects. C5's message is explicit that these do not
  // become correct by being blessed. So: correctness, red, reported.
  //
  // THE SRC FIX (not C6's to make — C6 is tests-only):
  //   `moon.massEarth *= kEarth ** 3;` inside the rescale loop at ExoticOverlay.js:330-336.
  // ⚠ That one line closes THIS gate and is NOT the whole repair. The same loop leaves
  // `tidalHeating`, `T_eq`, `tidalState` and `surfaceHistory` computed from the PRE-rescale
  // geometry on these three bodies, and its `noiseScale is texture detail, not geometry` comment
  // at :335 is false (build-plan break B1: noiseScale is `2.5/radius` on 98.77% of plain moons, so
  // it IS geometry). Scope the follow-on to the whole derived block, in its own commit, with an
  // Instrument B re-bless naming the 3 moved records.
  //
  // MUTANT (inverted, because the mutant as §5 words it is HEAD): add the `*= kEarth ** 3` line
  // and this gate goes GREEN — which is the correct signal to delete this comment block.
  // ═══════════════════════════════════════════════════════════════════════════════════════════
  it('POST-OVERLAY: mass and radius still describe the same body after StarSystemGenerator returns', () => {
    const violators = plain
      .map((r) => {
        const rhoRel = r.m.composition.density / RHO_EARTH_KGM3;
        const factor = r.m.massEarth / (r.m.radiusEarth ** 3 * rhoRel);
        return { id: r.id, factor, gcc: (r.m.massEarth / r.m.radiusEarth ** 3) * 5.514 };
      })
      .filter((x) => Math.abs(x.factor - 1) > 1e-9);
    // ⛔ EXPECTED TO FAIL TODAY: this reports the three bodies above. Do not weaken it.
    expect(violators).toEqual([]);
  });

  // ═══════════════════════════════════════════════════════════════════════════════════════════
  // G4 DISTRIBUTION ARM — replaces `:397`'s `surfaceGravity ∈ [0,3] g`, which §1 row 13 showed
  // cannot fail. CURRENT BEHAVIOUR (a plausibility envelope, deliberately), and re-fitted, because
  // §5's declared `p95 < 0.30 && max < 1.0` is FALSE — C4's known value issue 4.
  //
  // ⛔ CORPUS: 705 plain moons, 197 seeds (wd-0…wd-191 + the 5 PINNED), galaxyContext null,
  //    measured at ea8afca:
  //        p50 0.1063 · p90 0.4283 · p95 0.5617 · p99 1.0601 · max 1.2499 · min 0.002437
  //        8 bodies above 1 g · 0 above 1.5 g · 0 above 2 g
  //    Thresholds chosen: p95 < 0.70 (25% headroom) and max < 1.50 (20% headroom).
  // ⛔ These numbers DO NOT TRANSFER. On `wd-0…1499` the same quantity reaches max 16.16 g, and
  //    every one of those outliers is a POST-OVERLAY invariant violator — i.e. the tail of this
  //    distribution is break B7, not physics. Fitting a bound on that corpus would be fitting a
  //    bound to a bug.
  //
  // MUTANT: `nodensity` — measured on THIS corpus: p50 0.1750, p95 1.1046, max 2.6157, 40 bodies
  // above 1 g. Both bounds red. ⚠ Note it also reds under `zerofill` (max → 0), so say plainly:
  // the arm that CARRIES those two mutants is the per-body identity above; this one is corroboration.
  // ═══════════════════════════════════════════════════════════════════════════════════════════
  it('G4 DISTRIBUTION: plain-moon surface gravity sits in a band a moon could actually have', () => {
    const g = plain.map((r) => r.m.massEarth / r.m.radiusEarth ** 2);
    expect(g.every(Number.isFinite)).toBe(true);
    expect(pct(g, 0.95)).toBeLessThan(0.70);
    expect(Math.max(...g)).toBeLessThan(1.50);
    expect(Math.min(...g)).toBeGreaterThan(0);
    // The measured shape, pinned. A drift that stays inside the bounds still reds here, which is
    // what stops the bounds from being the only thing anybody has to satisfy.
    expect(g.filter((x) => x > 1).length).toBe(8);
    expect(g.filter((x) => x > 1.5).length).toBe(0);
    // DISTINCTNESS: a correctly-wired law that is degenerate across the population is this
    // program's characteristic failure (the cadence rule at moon-mass-radius-consistency.test.js:93).
    expect(new Set(g.map((x) => +x.toFixed(6))).size).toBeGreaterThan(600);
    // conditionFromBody must derive the same number — this is the route every consumer takes, and
    // a disagreement here would mean the gate is measuring a quantity nobody reads.
    const viaCondition = plain.map((r) => conditionFromBody(r.m).surfaceGravity);
    expect(pct(viaCondition, 0.95)).toBe(pct(g, 0.95));
    expect(Math.max(...viaCondition)).toBe(Math.max(...g));
  });

  // ═══════════════════════════════════════════════════════════════════════════════════════════
  // G4 PLANET-CLASS ARM — §5 says the shipped `< 5` at moon-mass-radius-consistency.test.js:76 is
  // "retained for planet-class". Retained AND measured here, on this corpus, so the claim that it
  // is compatible with the population is a fact rather than an inherited assumption.
  //
  // ⚠ THIS CORRECTS BUILD-PLAN §1 ROW 13, which says planet-class moons "max 3.13-3.26 g → 1 body
  // over the line today". Not on this corpus: max is 2.6663 g on 23 bodies, 1.88× inside the
  // shipped bound, and nothing is over any line. Row 13 measured a different population.
  //
  // MUTANT: `pcnomass` — drop the `massScale` cube at MoonGenerator.js:418 `const massScale = pData.radiusEarth > 0 ? (radiusEarth / pData.radiusEar` (`massEarth: pData.massEarth`,
  // unscaled). That is the exact regression moon-mass-radius-consistency.test.js exists for; it
  // put 27.6 M⊕ in a 0.89 R⊕ body, ~213 g/cc, ~35 g. Both bounds here red.
  // ═══════════════════════════════════════════════════════════════════════════════════════════
  it('G4 PLANET-CLASS: the 23 planet-class moons stay inside the shipped < 5 g bound', () => {
    const g = planetClass.map((r) => conditionFromBody(r.m.planetData).surfaceGravity);
    expect(g.length).toBe(23);
    expect(Math.max(...g)).toBeLessThan(5);        // the shipped bound, unchanged
    expect(Math.max(...g)).toBeLessThan(2.70);     // measured 2.6663 — the real headroom, pinned
    const gcc = planetClass.map((r) => ((r.m.planetData.massEarth ?? 1) / r.m.planetData.radiusEarth ** 3) * 5.514);
    expect(Math.max(...gcc)).toBeLessThan(15);     // the shipped osmium-headroom ceiling
    expect(Math.min(...gcc)).toBeGreaterThan(0.3); // lighter than water is fine (Saturn is 0.69)
    // measured band, pinned: 2.167 – 6.973 g/cc
    expect(Math.max(...gcc)).toBeLessThan(7.0);
    expect(Math.min(...gcc)).toBeGreaterThan(2.0);
  });

  // ═══════════════════════════════════════════════════════════════════════════════════════════
  // G3 VALUE ARM — T_eq, at the layer where it is derivable. CORRECTNESS. Green on 705/705.
  //
  // §5 declares `T_eq === equilibriumTemperature(zones.luminosity, parentOrbitAU)` exactly. That
  // is satisfiable, but ONLY at return time: neither the star's luminosity nor the PRE-migration
  // orbit AU survives onto the finished system (`starInfo` carries colours and brightnesses, not
  // luminosity; `system.zones` is the scene/map zoneData, not the generator's `zones`). Asserting
  // it against the final system instead would be red on 56 bodies for a reason that is a declared
  // design choice — MoonGenerator.js:251 `const luminosityRel = zones?.luminosity ?? 1.0;` deliberately uses the pre-migration AU so the value
  // agrees with the `parentZone` derived from that same number, and StarSystemGenerator.js:655-657
  // rewrites the wrapper's AU for hot-jupiter migrants after every moon is already built.
  //
  // MUTANT: `zerofill` — `moon.T_eq = 0` reds this on 705/705 while G3's presence arm stays green.
  // MUTANT: `wrongau` — pass `1.0` instead of `parentAU` into equilibriumTemperature; reds on
  // every moon whose parent is not at 1 AU.
  // ═══════════════════════════════════════════════════════════════════════════════════════════
  it('G3 VALUE: T_eq is exactly equilibriumTemperature(zones.luminosity, parentOrbitAU) at return time', () => {
    let mismatches = 0;
    for (const s of returned) {
      if (s.T_eq !== equilibriumTemperature(s.argLuminosity, s.argParentAU)) mismatches++;
    }
    expect({ records: returned.length, mismatches }).toEqual({ records: 733, mismatches: 0 });
    // `age` is the same shape of claim and costs one line: it must be the system age it was handed.
    expect(returned.filter((s) => s.age !== s.argAgeGyr).length).toBe(0);
    // Non-vacuity: measured range on the surviving 705 is 38.30 K – 462.84 K with 171 distinct
    // ages behind it. A constant T_eq would satisfy the identity above and be worthless.
    const t = plain.map((r) => r.m.T_eq);
    expect(Math.min(...t)).toBeGreaterThan(35);
    expect(Math.max(...t)).toBeLessThan(470);
    expect(new Set(t.map((x) => +x.toFixed(4))).size).toBeGreaterThan(150);
  });

  // ═══════════════════════════════════════════════════════════════════════════════════════════
  // ⛔⛔ T_eq AGREES WITH ITS PARENT — CORRECTNESS. **THIS GATE FAILS TODAY ON 3 OF 705.** ⛔⛔
  //
  // A moon and its parent occupy the same orbit around the same star. Their equilibrium
  // temperatures are the same number. That is not a convention; it is what `equilibriumTemperature`
  // is a function of. C4's known value issue 3, blessed invisible by C5.
  //
  // The three, measured at ea8afca — the SAME three bodies as the post-overlay mass gate:
  //     wd-79/2/0    moon 259.36 K   parent  11.12 K   (23.3×)
  //     wd-45/0/0    moon 457.75 K   parent 1023.57 K  (0.447×)
  //     wd-614/1/0   moon 254.77 K   parent  120.47 K  (2.11×)
  //
  // ⭐ THE CAUSE IS PARENT OBJECT IDENTITY, NOT THE PRE-MIGRATION AU — C4 says so, and it is
  // measured: migration moves the wrapper's `orbitRadiusAU` between the moon's generation and the
  // finished system on 52 of these 705 bodies, and 51 of those 52 STILL AGREE with their parent,
  // because the parent's own T_eq was computed from the same pre-migration number. (The 52nd is
  // one of the three below, i.e. it is exotic-swapped as well as migrated.) So migration is not
  // the mechanism. What breaks the agreement is `ExoticOverlay._swapPlanetType` REPLACING `planetData`
  // wholesale (ExoticOverlay.js:337) with a planet regenerated by a call that passes
  // `null /* zones */` at :315. The in-file comment says "no zones needed — forceType bypasses
  // _pickType", but `zones` also carries LUMINOSITY, metallicity and age, and
  // PlanetGenerator.js:368 is `const luminosityRel = zones?.luminosity || 1.0`. So all 10
  // exotic-swapped planets on this corpus are re-derived as if they orbited a Sun. The moon is
  // right; the parent is wrong. The 3 moons are the visible symptom of a 10-planet defect.
  //
  // THE SRC FIX (not C6's to make): pass the real `zones` at ExoticOverlay.js:315 instead of
  // `null`. ⚠ It is a universe change on 10 planets across T_eq, composition, metallicity and age,
  // so it needs its own commit and an Instrument B re-bless with a delta table.
  //
  // ⛔ WHY NOT SCOPED TO EXCLUDE EXOTIC PARENTS. That is exactly the weakening that would lock the
  // defect in: the whole reason C6 exists is that C5 made these three invisible to every hash.
  //
  // MUTANT (inverted): ⚠ MEASURED 2026-08-14 — passing real zones takes this 3 violators → **1**,
  // NOT 0. Do not expect green. The survivor is `wd-79/2/0` (moon 259.364 vs parent 260.178), and
  // it is a SECOND, separate defect: the moon's T_eq uses the PRE-migration parentOrbitAU
  // (527.736, MoonGenerator.js:251 `const luminosityRel = zones?.luminosity ?? 1.0;`'s deliberate choice) while `_swapPlanetType` regenerates
  // the planet at the FINAL orbit (524.442). Residual is exactly sqrt(527.736/524.442) = 1.00314×.
  // ⛔ And the fix is NOT one line: `_swapPlanetType(planetEntry, newType, rng)`
  // (ExoticOverlay.js:306) has no zones parameter, and `systemData.zones` is zoneData — four AU
  // boundaries, no luminosity — so passing it changes nothing. A working version took 3 edits
  // across 2 files. Whoever applies the named fix and sees red must be able to tell an
  // INCOMPLETE fix from a BROKEN one; that is what this note is for.
  // MUTANT (forward): `zerofill` — `moon.T_eq = 0` reds this on 705/705.
  // ═══════════════════════════════════════════════════════════════════════════════════════════
  it('a moon carries the same equilibrium temperature as the planet it orbits', () => {
    const disagreeing = plain
      .filter((r) => r.m.T_eq !== r.parent.T_eq)
      .map((r) => ({ id: r.id, parentType: r.parent.type, moon: r.m.T_eq, parent: r.parent.T_eq }));
    // ⛔ EXPECTED TO FAIL TODAY: reports wd-45/0/0, wd-79/2/0, wd-614/1/0. Do not weaken it.
    expect(disagreeing).toEqual([]);
  });

  // ═══════════════════════════════════════════════════════════════════════════════════════════
  // G3 VALUE ARM — tidalState. CORRECTNESS. Green on 705/705.
  //
  // Re-derives `checkTidalLock(tidalLockTimescale(...))` from the moon's own record and its FINAL
  // parent, including both unit conversions MoonGenerator.js:274 `moon.massEarth,` performs: the parent's mass
  // out of Earth masses into SOLAR masses, and the moon's orbit out of Earth radii into AU. The
  // two constants are duplicated at the top of this file on purpose.
  //
  // MUTANT: `nosolarconv` — drop `/ EARTH_MASSES_PER_SUN`. The timescale falls by 332946², every
  // body locks, and this reds on the 1 body currently unlocked plus the 172 whose lockType is not
  // 'synchronous'... measured: it reds on the exact records whose lockType changes.
  // MUTANT: `zerofill` — `moon.tidalState = {}` reds on 705/705 while G3's presence arm stays green.
  // ═══════════════════════════════════════════════════════════════════════════════════════════
  it('G3 VALUE: tidalState is exactly what checkTidalLock(tidalLockTimescale(...)) returns', () => {
    let mismatches = 0;
    for (const r of plain) {
      const expected = checkTidalLock(
        tidalLockTimescale(
          (r.parent.massEarth ?? 0) / EARTH_MASSES_PER_SUN,
          r.m.massEarth,
          r.m.radiusEarth,
          Math.max(r.m.orbitRadiusEarth * EARTH_RADIUS_AU, 1e-9),
        ),
        r.m.age,
      );
      if (expected.locked !== r.m.tidalState.locked || expected.lockType !== r.m.tidalState.lockType) mismatches++;
    }
    expect({ moons: plain.length, mismatches }).toEqual({ moons: 705, mismatches: 0 });
    // Non-vacuity, and a real fact about the population worth knowing: moons lock. 704 of 705 are
    // locked, and all three lockTypes are reachable — so this is not one constant wearing a law.
    expect(plain.filter((r) => r.m.tidalState.locked).length).toBe(704);
    expect(new Set(plain.map((r) => r.m.tidalState.lockType)).size).toBe(3);
  });

  // ═══════════════════════════════════════════════════════════════════════════════════════════
  // G3 VALUE ARM — composition internal consistency. CORRECTNESS. Green on 705/705.
  //
  // ⛔ WHY THIS IS AN ALGEBRAIC IDENTITY AND NOT A RE-DERIVATION. Re-running `deriveComposition`
  // needs the `mooncomp:` float, and `namespacedFloat` (MoonGenerator.js:578 `function namespacedFloat(key) {`) is module-private.
  // Copying it into a test would create a genuine second source of truth for a value the record
  // carries — the one duplication that is NOT acceptable here.
  //
  // Instead, note that in `deriveComposition` (PhysicsEngine.js:384-392) both outputs are affine in
  // the SAME two unknowns:
  //     C/O  = 0.55 + 0.30·met + (f − 0.5)·0.20
  //     iron = 0.28 + 0.15·met + (f − 0.5)·0.10
  // The second is exactly half the metallicity/scatter terms of the first, so eliminating both
  // unknowns gives a relation with no free parameters at all:
  //     iron = 0.28 + 0.5·(C/O − 0.55)
  // Measured: holds to floating-point exactness on 705/705, and 0 of 705 are anywhere near either
  // clamp (C/O measured 0.336–0.760 against clamps at 0.2 and 1.3), so the relation is not an
  // artefact of everything being pinned at a bound.
  //
  // MUTANT: `retune` — change either coefficient in `deriveComposition`. Reds immediately.
  // ⛔ `compswap` WAS LISTED HERE AND IS FALSE — measured 2026-08-14: giving every moon the
  // previous moon's composition leaves THIS gate GREEN. The stated reason was wrong, not just the
  // outcome: `iron = 0.28 + 0.5·(C/O − 0.55)` is PARAMETER-FREE — both unknowns eliminated — so it
  // holds for EVERY `deriveComposition` output regardless of which body produced it. Sharing a
  // metallicity and a float is irrelevant. What this gate proves is that the two fields are
  // consistent with SOME common (metallicity, float) pair, not with THIS body's. `compswap` IS
  // caught — by G4 DISTRIBUTION, G3 VALUE tidalState and SURFACE TYPE, which all red. Credit
  // reassigned to them. ⭐ A false claim reading as fresh, inside the file written to prevent that.
  // ═══════════════════════════════════════════════════════════════════════════════════════════
  it('G3 VALUE: ironFraction and carbonToOxygen come from the same metallicity and the same float', () => {
    let violators = 0;
    let clamped = 0;
    for (const r of plain) {
      const c = r.m.composition;
      if (Math.abs((0.28 + 0.5 * (c.carbonToOxygen - 0.55)) - c.ironFraction) > 1e-12) violators++;
      if (c.carbonToOxygen <= 0.2 + 1e-12 || c.carbonToOxygen >= 1.3 - 1e-12) clamped++;
      if (c.ironFraction <= 0.1 + 1e-12 || c.ironFraction >= 0.6 - 1e-12) clamped++;
    }
    expect({ moons: plain.length, violators, clamped }).toEqual({ moons: 705, violators: 0, clamped: 0 });
    // Measured spread — the relation would also hold if every moon were identical.
    const c2o = plain.map((r) => r.m.composition.carbonToOxygen);
    expect(Math.min(...c2o)).toBeGreaterThan(0.33);
    expect(Math.max(...c2o)).toBeLessThan(0.77);
    expect(new Set(c2o).size).toBeGreaterThan(600);
  });

  // ═══════════════════════════════════════════════════════════════════════════════════════════
  // SURFACE TYPE, POPULATION — CURRENT BEHAVIOUR, with the reason derived rather than shrugged at.
  // C4's known value issue 5: the moon population can only express 2 of `deriveComposition`'s 4
  // surface types. Measured on this corpus: silicate 616, ice-rock 89, carbon 0, iron-rich 0.
  //
  // WHY IT IS 2, NOT SAMPLE SIZE. `deriveComposition` classifies in order (PhysicsEngine.js:407-416):
  //   carbon     if C/O > 0.80        iron-rich  if iron > 0.45
  //   ice-rock   if volatiles > 0.40  else silicate
  // With `galaxyContext = null`, StarSystemGenerator.js:363 draws metallicity as
  // `gaussianClamped(0.0, 0.2, -1.0, 0.5)` — a HARD CEILING of 0.5 dex, and the measured max over
  // this corpus is exactly 0.5000. At met = 0.5 with f → 1 the supremum of C/O is exactly 0.80,
  // which the strict `>` never reaches (measured max 0.7597), so carbon is unreachable BY AN
  // OPEN-INTERVAL MARGIN OF ZERO. `ice-rock` stays reachable because `volatileFraction` is
  // orbit-driven, not metallicity-driven (measured max 0.6490 against a 0.40 gate).
  //
  // ⭐ NOT A MOON PROPERTY. This is the metallicity clamp, and it applies to every body the
  // generator makes. File the reachability question against `deriveComposition` /
  // StarSystemGenerator.js:363, not against Step 8.
  //
  // ⛔ WHY ASSERT 2 AND NOT DEMAND 4. A distinctness gate demanding 4 types would be permanently
  // red for an input-range reason, on a corpus that cannot produce them. But a gate that accepts
  // 2 without saying why is decoration — so the reachability unit arm below carries the other half.
  //
  // MUTANT: `liftclamp` — raise the metallicity ceiling at StarSystemGenerator.js:363 from 0.5 to
  // 1.0. Carbon becomes reachable and this reds. MUTANT: `laddersimplify` — delete the carbon or
  // iron-rich branch. The exact-count assertion still reds if the split moves at all.
  // ═══════════════════════════════════════════════════════════════════════════════════════════
  it('SURFACE TYPE: the null-galaxy population expresses exactly silicate and ice-rock', () => {
    const counts = {};
    for (const r of plain) {
      counts[r.m.composition.surfaceType] = (counts[r.m.composition.surfaceType] || 0) + 1;
    }
    // Corpus: 197 seeds, galaxyContext null, 705 plain moons, measured at ea8afca.
    expect(counts).toEqual({ silicate: 616, 'ice-rock': 89 });
  });

  // ═══════════════════════════════════════════════════════════════════════════════════════════
  // SURFACE TYPE, REACHABILITY — the function layer. This is where the finding lives.
  //
  // Two different facts, and it matters that they are different:
  //   `carbon`    IS reachable — it just needs metallicity above the 0.5 ceiling the null-galaxy
  //               path clamps to. Asserted directly at met = 1.0. So the 2-of-4 population above
  //               is an INPUT-RANGE fact, not dead code.
  //   `iron-rich` IS NOT REACHABLE FOR ANY INPUT AT ALL. ⭐ NEW FINDING, beyond what C4 recorded.
  //
  // The proof is the same algebraic relation the consistency arm uses. Wherever neither output is
  // clamped, `iron = 0.28 + 0.5·(C/O − 0.55)`, so `iron > 0.45` ⟺ `C/O > 0.89`. But the ladder
  // tests carbon FIRST at `C/O > 0.80`, so every input that would reach the iron-rich branch has
  // already returned 'carbon'. And in the clamped regime the two clamps saturate together
  // (met 6.0 → C/O 1.3, iron 0.6 → still 'carbon'). Brute-forced below over metallicity −4.0…6.0
  // and the full float range: ZERO iron-rich outcomes.
  //
  // ⛔ THIS IS A DEFECT REPORT, NOT A BLESSING. `deriveComposition`'s iron-rich branch is dead code
  // as written — a body cannot be classified iron-rich no matter what it is made of. The fix is a
  // src change and is NOT C6's to make: either test iron-rich BEFORE carbon, or lower the iron gate
  // below 0.45 / raise the carbon gate above 0.80 so the two branches stop shadowing. When that
  // lands, this assertion reds and should be rewritten to the new reachability — which is exactly
  // the signal wanted.
  //
  // MUTANT: `reorder` — move the `iron-rich` branch above `carbon` in PhysicsEngine.js:407-416.
  // The iron-rich count goes nonzero and this reds.
  // ═══════════════════════════════════════════════════════════════════════════════════════════
  it('REACHABILITY: carbon needs a metallicity the null-galaxy path clamps away; iron-rich is unreachable for any input', () => {
    // carbon is live — it is only the 0.5 metallicity ceiling that keeps it out of the population.
    expect(deriveComposition(1.0, 1.0, 4.85, 0.9).surfaceType).toBe('carbon');
    expect(deriveComposition(0.6, 1.0, 4.85, 0.9).surfaceType).toBe('carbon');
    // ...and it is genuinely out of reach at the ceiling itself, by an open-interval margin of zero.
    expect(deriveComposition(0.5, 1.0, 4.85, 0.999999).surfaceType).not.toBe('carbon');

    // iron-rich: brute force over metallicity −4.0 … 6.0 (step 0.1) × float 0 … 0.995 (step 0.005)
    // × four orbit ratios spanning both sides of the frost line. 100,800 classifications.
    const seen = new Set();
    for (let mi = -40; mi <= 60; mi++) {
      for (let fi = 0; fi < 200; fi++) {
        for (const au of [0.1, 1.0, 5.0, 50.0]) {
          seen.add(deriveComposition(mi / 10, au, 4.85, fi / 200).surfaceType);
        }
      }
    }
    expect([...seen].sort()).toEqual(['carbon', 'ice-rock', 'silicate']);
    expect(seen.has('iron-rich')).toBe(false);
  });

  // ═══════════════════════════════════════════════════════════════════════════════════════════
  // surfaceHistory — **THE nearGiant DEFECT WAS FIXED. THIS ARM NOW PINS THE FIXED CALL.**
  //
  // HISTORY (the state this gate was written against, at ea8afca): MoonGenerator.js:262 called
  //     computeSurfaceHistory(ageGyr, /* nearBelt */ false, /* nearGiant */ false, hasAtmo, tidal)
  // hardcoding BOTH flags false for every moon — including moons of gas giants, which are by
  // definition near a giant. C6 declined to fix it and priced it instead (four reasons, of which
  // #2 is the one that survived: it moves no pixel). Max ruled on 2026-08-14 that the fix goes in
  // anyway, on the ground that Step 9's crater pack consumes bombardment and getting it wrong now
  // bakes the error into that pack. Reasons #1 and #3 are superseded by that ruling.
  //
  // ⭐ REASON #2 STILL HOLDS AND IS WHY NO PIXEL GATE REDS ALONGSIDE THIS ONE. `nearGiant`
  // multiplies `bombardment` by 1.3 before the clamp (PhysicsEngine.js:809-816) and touches
  // nothing else — `erosionLevel` and `resurfacingRate` move on 0 of 448. And
  // `bombardmentIntensity` is not on the crater path: Step 9's declared consumer `craterSchedule`
  // (src/worldengine/base/bombardment.js:155-166) reads radiusEarth, surfaceGravity, age,
  // rawTidalIoRatio, atmosphere.pressure and `erosionOf` — never bombardmentIntensity. Its only
  // non-test reader in src/ is the debug overlay at src/ui/DebugPanel.js:243 and `deriveUniforms`
  // (labCore.js:702), which no game-route file imports (BodyRenderer.js:11 takes
  // `lodRampOf`/`autoOctaves`; main.js:25 takes `approachLadder`), and plain moons render through
  // src/objects/Moon.js, which has ZERO worldengine imports.
  //
  // ⛔ `nearBelt` IS STILL HARDCODED false, AND THAT HALF IS UNFIXED BY DESIGN. The reason is
  // stronger than C6's original "no defensible threshold": the information does not EXIST at this
  // point in the stream. Belts are drawn at StarSystemGenerator.js:736, AFTER the moon loop at
  // :595; `zones` (:457-467) carries no belt field and MoonGenerator references belts nowhere.
  // Computing it here would require reordering generation, which moves the draw stream for every
  // body downstream. Correct owner: the "refined by system generator later" pass that
  // PlanetGenerator.js:610 already names — one place, both populations, its own commit.
  //
  // ⚠ AND A REAL INCONSISTENCY THIS COMMIT LEAVES STANDING, FLAGGED SO IT IS NOT LOST: PLANET-CLASS
  // moons still carry `nearGiant = false` in their nested `planetData.surfaceHistory`, because they
  // are built by PlanetGenerator (MoonGenerator.js:123 `if (isLargeParent && moonIndex > 0 && totalMoons >= 3 && rng.chance(0.10` → :338) and the planet path keeps its own
  // hardcoded falses. They are moons of giants by construction (the branch at :98 gates on a
  // gas-giant/sub-neptune parent), so after this commit they disagree with their plain siblings
  // around the same parent. Same owner as nearBelt.
  //
  // MUTANT: `zerofill` — `moon.surfaceHistory = {}`. The three keys vanish and this reds on 705/705
  // while G3's presence arm stays green. MUTANT: `flatatmo` (see the atmosphere gate) flips
  // `hasAtmosphere` on a terrestrial moon and moves `erosionLevel` from the 0.03/Gyr branch to the
  // 0.15/Gyr one — reds this arm on any corpus that contains one. MUTANT: THE REVERT — restoring
  // the two hardcoded falses at MoonGenerator.js reds this arm on 181 of 705.
  // ═══════════════════════════════════════════════════════════════════════════════════════════
  it('surfaceHistory is exactly computeSurfaceHistory(age, false, parentIsGiant, hasAtmosphere, tidalHeating)', () => {
    // ⚠ CLASSIFIED ON `r.snap.argParentType`, NOT `r.parent.type`. `argParentType` is
    // `planetData.type` as captured at the moment MoonGenerator.generate was CALLED — the exact
    // value the src predicate reads. `r.parent.type` is the POST-generate type, after the
    // migration retype (StarSystemGenerator.js:662) and after ExoticOverlay. Measured divergence
    // on this corpus: 11 of 705 (gas-giant→hot-jupiter ×8, lava→hex, rocky→crystal,
    // ocean→city-lights). The two layers happen to agree on giant-ness today; asserted below so
    // they cannot silently stop agreeing.
    const GIANTS = new Set(['gas-giant', 'hot-jupiter', 'sub-neptune']);
    let mismatches = 0;
    for (const r of plain) {
      const expected = computeSurfaceHistory(
        r.m.age, false, GIANTS.has(r.snap.argParentType), r.m.atmosphere != null, r.m.tidalHeating,
      );
      const got = r.m.surfaceHistory;
      if (expected.bombardmentIntensity !== got.bombardmentIntensity
        || expected.erosionLevel !== got.erosionLevel
        || expected.resurfacingRate !== got.resurfacingRate) mismatches++;
    }
    expect({ moons: plain.length, mismatches }).toEqual({ moons: 705, mismatches: 0 });
    // The two classification layers agree on GIANT-NESS for every moon (not on type — 11 types
    // differ). If ExoticOverlay ever retyped a small parent INTO a giant, or a giant out of it,
    // this reds and names the layer split before any value gate goes mysteriously wrong.
    expect(plain.filter((r) => GIANTS.has(r.snap.argParentType) !== GIANTS.has(r.parent.type)).length,
      'moons where generation-time and post-generate giant-ness disagree').toBe(0);
    // Non-vacuity: 169 distinct erosion levels behind it (UNCHANGED by the nearGiant fix —
    // erosion is a pure function of (hasAtmosphere, ageGyr), PhysicsEngine.js:813-815), and
    // 449 of 705 bombardmentIntensity values clamped to exactly 0 by
    // `max(0, bombardment − resurfacing × 0.5)`.
    // ⭐ 449 WAS 515 BEFORE THE nearGiant FIX. The drop is exactly 66 = the zero-crossers priced
    // by the gate below. Arithmetically forced, not a second measurement: nearGiant only
    // multiplies bombardment UP and the clamp is monotone in bombardment, so this population can
    // only shrink and only by the crossers (verified: 0 of 705 records decreased).
    expect(new Set(plain.map((r) => r.m.surfaceHistory.erosionLevel)).size).toBe(169);
    expect(plain.filter((r) => r.m.surfaceHistory.bombardmentIntensity === 0).length).toBe(449);
  });

  // ═══════════════════════════════════════════════════════════════════════════════════════════
  // `nearGiant` IS NOW TRUTHFUL — this gate flipped from PRICING a defect to GUARDING the fix.
  // It measures the SAME quantity it always did (what would change if nearGiant were passed
  // truthfully) — but now that src already does, the honest answer is 0. A revert, or a narrowing
  // of the type list, reds it immediately.
  //
  // ⚠ CORPUS LABEL, LOAD-BEARING: everything here is THIS FILE'S 197-seed corpus, 705 plain moons.
  // The fence (tests/body-identity-fence.test.js) adds 24 `gc-*` seeds and reads 770 plain / 474
  // giant-parented for the same quantities. ⛔ `giantParented: 448` IS NOT STALE and must NOT be
  // "corrected" to 474 — different corpora, both right.
  //
  // WAS, at ea8afca, before the fix (this 197-seed corpus):
  //     448 of 705 (63.5%) have a giant parent — sub-neptune 261, gas-giant 179, hot-jupiter 8
  //     181 of those 448 moved `bombardmentIntensity` once nearGiant was passed truthfully
  //      66 of the 181 crossed 0 → nonzero (a body Step 9 read as "no impact history" started
  //         having one); of the remaining 115, ratio p50 1.975×, max 55.69×
  //       0 of 448 moved `erosionLevel`; 0 of 448 moved `resurfacingRate` — structural, not luck
  // ⚠ 181 and 66 are ALSO the fence's numbers on its larger corpus, and that is an ACCIDENT, not a
  // corpus-independent fact: the 26 extra gc-* giant-parented moons contribute exactly 0 movers
  // because all 26 sit in an age regime already clamped to 0. Do not reuse either number without
  // naming its corpus.
  //
  // IS, after the fix: `moved` and `crossedZero` are 0 — `today` already IS the truthful value.
  // `giantParented` is unchanged at 448: the fix changes no moon's parent, only a value.
  //
  // MUTANT: THE REVERT — restoring `false` for nearGiant at MoonGenerator.js. `moved` goes
  // 0 → 181, `crossedZero` 0 → 66, and this reds.
  // MUTANT: `narrowlist` — dropping 'sub-neptune' from GIANT_PARENT_TYPES in src. `moved` goes
  // 0 → 113 (the sub-neptune-parented movers), which is why the type list is asserted and not
  // merely commented.
  // ═══════════════════════════════════════════════════════════════════════════════════════════
  it('nearGiant is truthful: 448 moons in the affected class, 0 records left to move, 0 pixels', () => {
    const GIANTS = new Set(['gas-giant', 'sub-neptune', 'hot-jupiter']);
    // Generation-time parent type — the layer src reads. See the gate above on argParentType.
    const giantParented = plain.filter((r) => GIANTS.has(r.snap.argParentType));
    let moved = 0;
    let crossedZero = 0;
    let erosionMoved = 0;
    let resurfacingMoved = 0;
    for (const r of giantParented) {
      const today = r.m.surfaceHistory;
      const truthful = computeSurfaceHistory(r.m.age, false, true, r.m.atmosphere != null, r.m.tidalHeating);
      if (truthful.bombardmentIntensity !== today.bombardmentIntensity) {
        moved++;
        if (today.bombardmentIntensity === 0) crossedZero++;
      }
      if (truthful.erosionLevel !== today.erosionLevel) erosionMoved++;
      if (truthful.resurfacingRate !== today.resurfacingRate) resurfacingMoved++;
    }
    expect({
      giantParented: giantParented.length, moved, crossedZero, erosionMoved, resurfacingMoved,
    }).toEqual({
      giantParented: 448, moved: 0, crossedZero: 0, erosionMoved: 0, resurfacingMoved: 0,
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════════════════
  // G6 — replaces `:399`'s "zero truthy atmosphere with undefined pressure", which §1 row 15 shows
  // measures 0 → 0 forever and CANNOT be non-zero. CORRECTNESS, with a forced population, because
  // the subject does not exist in the corpus at all.
  //
  // ⭐ MEASURED, AND IT CORRECTS THE FENCE'S OWN COVERAGE CLAIM: 0 of 705 plain moons on this
  // corpus carry an atmosphere, because 0 are terrestrial-type (rocky 226, ice 235, captured 171,
  // volcanic 73, terrestrial 0). The fence pins `wd-1403` at body-identity-fence.test.js:104-108
  // saying it is "the only terrestrial-moon system found in 6000 seeds" and that without it the
  // fence "never watches seven of the moon generator's draws" at MoonGenerator.js:210 `// Terrestrial moons have atmosphere + clouds (they support life!)` —
  // but `wd-1403`'s terrestrial moon is PLANET-CLASS, built by `_generatePlanetMoon`, which never
  // reaches those lines. The seed's coverage argument names the wrong code path. (Not C6's to fix;
  // recorded here because the next author will otherwise trust it.)
  //
  // ⛔ SO THE FORCED ARM IS MANDATORY, NOT BELT-AND-BRACES. Without it this gate is vacuous by
  // construction, and §5 says to delete the gate rather than ship decoration.
  //
  // WHAT IS ASSERTED, in three arms:
  //   1. MoonGenerator emits the VISUAL-ONLY shape `{color, strength}` — the exact keys, pinned.
  //      This is the thing `flatatmo` changes.
  //   2. The engine catches it: `atmosphereFromPlanet` returns null, `conditionFromBody` carries a
  //      null atmosphere, and provenance says 'defaulted' rather than pretending it measured one.
  //   3. POSITIVE CONTROL — the violating shape, handed in directly, DOES produce the pathology.
  //      Without this the whole gate is an assertion that nothing happened.
  //
  // MUTANT: `flatatmo` — MoonGenerator.js:218 `color: [0.4, 0.6, 1.0],` emits `{retained: true, color}` instead.
  // Arm 1 reds on the key set, arm 2 reds because `hasEngineAtmosphereShape` now passes it through
  // truthy with `pressure` undefined. Arm 3 is what proves arms 1-2 are watching a live wire.
  // ═══════════════════════════════════════════════════════════════════════════════════════════
  it('G6: a terrestrial moon\'s atmosphere is the visual-only shape, and the engine refuses to read it as physics', () => {
    // ── the corpus arm, stated as the fact it is rather than as a passing assertion ──
    expect(plain.filter((r) => r.m.atmosphere != null).length).toBe(0);
    expect(plain.filter((r) => r.m.type === 'terrestrial').length).toBe(0);
    const typeCounts = {};
    for (const r of plain) typeCounts[r.m.type] = (typeCounts[r.m.type] || 0) + 1;
    expect(typeCounts).toEqual({ rocky: 226, ice: 235, captured: 171, volcanic: 73 });

    // ── the forced arm: drive MoonGenerator directly until the terrestrial branch fires ──
    // gas-giant parent + parentZone 'hz' is the only route to `terrestrial` (MoonGenerator.js:499 `if (rng.chance(0.03)) return 'terrestrial';`);
    // totalMoons = 2 keeps the planet-class branch (:99, needs >= 3) out of the way, and
    // moonIndex = 1 keeps the volcanic branch (:437, moonIndex 0 only) out of the way.
    const zones = { luminosity: 1.0, metallicity: 0.0, ageGyr: 4.5, frostLine: 4.85 };
    let forced = null;
    let foundAt = -1;
    for (let s = 0; s < 40 && !forced; s++) {
      const rng = new SeededRandom(`c6-terrestrial-${s}`);
      let parent;
      try { parent = PlanetGenerator.generate(rng, 1.0, null, null, 'gas-giant'); } catch { continue; }
      const m = MoonGenerator.generate(rng, parent, 1, 2, 'hz', zones, 1.0);
      if (m && !m.planetData && m.type === 'terrestrial') { forced = m; foundAt = s; }
    }
    // Pinned: the first hit is at s = 1, and 14 of the first 400 seeds hit. If `_pickType`'s
    // ~3% terrestrial branch or its draw order ever moves, this index moves with it.
    expect(foundAt).toBe(1);
    expect(forced).not.toBeNull();

    // ── arm 1: the emitted shape, exactly ──
    expect(Object.keys(forced.atmosphere).sort()).toEqual(['color', 'strength']);
    expect(forced.atmosphere.retained).toBeUndefined();
    expect(forced.atmosphere.pressure).toBeUndefined();
    expect(forced.clouds).not.toBeNull();
    expect(forced.aurora).not.toBeNull();

    // ── arm 2: the engine catches it ──
    expect(atmosphereFromPlanet(forced.atmosphere)).toBeNull();
    const cond = conditionFromBody(forced);
    expect(cond.atmosphere).toBeNull();
    expect(cond._provenance.atmosphere).toBe('defaulted');

    // ── arm 3: POSITIVE CONTROL — the violating shape does produce the pathology ──
    // `{retained, color}` satisfies hasEngineAtmosphereShape (conditionFromBody.js:371-372) and is
    // passed straight through at :380, giving one object that is TRUTHY to every
    // `if (cond.atmosphere)` gate and VACUUM to every `atmosphere.pressure ?? 0` gate. This is the
    // exact contradiction G6 exists to keep out, and it is reachable — one keyword away.
    const violating = atmosphereFromPlanet({ retained: true, color: [0.4, 0.6, 1.0] });
    expect(violating).toBeTruthy();
    expect(violating.pressure).toBeUndefined();

    // ── the gate itself, over corpus + forced population ──
    const subjects = [...plain.map((r) => r.m), forced];
    for (const body of subjects) {
      const c = conditionFromBody(body);
      if (c.atmosphere) expect(typeof c.atmosphere.pressure).toBe('number');
    }
    expect(subjects.length).toBe(706);
  });
});
