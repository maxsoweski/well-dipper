#!/usr/bin/env node
// tools/port-condition-delta.mjs — the COMMITTED DELTA TABLE for Step 2 of
// docs/FEATURES/one-pipeline-two-frontends-PLAN.md ("Forward the real tidal heating", PLAN.md:199).
//
// Run:
//   node tools/port-condition-delta.mjs                 # measure + rewrite the committed artifact
//   node tools/port-condition-delta.mjs --stdout        # measure, print, write nothing
//   node tools/port-condition-delta.mjs --selftest      # negative controls: prove the harness bites
//
// Exit codes: 0 ok · 1 a declared mover did not move (§11.3.6 failure) · 2 a control failed
//             · 3 selftest failed · 64 usage · 69 a module would not load
//
// ══════════════════════════════════════════════════════════════════════════════════════════════
// ⛔ WHY THIS TOOL COMPUTES BOTH LAWS ITSELF INSTEAD OF READING THE TREE
// ══════════════════════════════════════════════════════════════════════════════════════════════
// The obvious harness — "call conditionFromPlanet(rec), then call it again with the three fields
// stripped" — measures the OLD rule correctly on any tree, and measures the NEW rule ONLY on a
// tree where Step 2 has already landed. Run it a day early and it prints a table of zeros that
// looks exactly like "the change does nothing". Run it a day late and it cannot reproduce the
// before-state at all. Either way the gate is unrepeatable, which is the opposite of what a
// COMMITTED table is for.
//
// So both rules are evaluated here, from the engine's own single source:
//
//   OLD  bodyRawTidal({ radiusEarth, eccentricity })
//        — no tidalHeat, no starMassEarth, no orbitRadiusEarth. baseStep.js:23-33 then takes its
//          fallback branch with its own hardcoded defaults, `starMassEarth = 332946` and
//          `orbitRadiusEarth = 23455`, i.e. ONE SOLAR MASS AT ONE AU for every body in the galaxy.
//          That is precisely what the port produces today, because `d.tidalHeating` is spelled
//          `tidalHeat` on the fp and the two never meet.
//
//   NEW  bodyRawTidal({ radiusEarth, eccentricity, tidalHeat: d.tidalHeating,
//                       starMassEarth, orbitRadiusEarth })
//        — the D12 value wins when present (baseStep.js:29 `d.tidalHeat != null`), and when it is
//          genuinely absent the SAME fallback runs against the body's real star and real orbit
//          instead of the 1 M☉-at-1-AU stand-in.
//
// `bodyRawTidal` is imported from src/worldengine/base/baseStep.js — the shipped law. Neither
// branch is transcribed here, so this tool cannot drift from the thing it is pricing, and it
// returns the same numbers before and after the port edit lands.
//
// ⚠ WHAT "OLD" IS NOT. It is not "the value the current working tree happens to produce". At the
// time of writing the tree is mid-flight (the fp literal already says `tidalHeat: d.tidalHeating`
// but starMassEarth/orbitRadiusEarth are not forwarded yet), so a tree-reading harness would have
// measured a third law that is neither the before nor the after. Naming this is the whole reason
// the tool is built this way.
//
// ══════════════════════════════════════════════════════════════════════════════════════════════
// THE CAUSAL FOOTPRINT, MEASURED NOT ASSUMED
// ══════════════════════════════════════════════════════════════════════════════════════════════
// The table is built by taking the REAL condition — `conditionFromPlanet(rec)`, so every unit fix,
// greenhouse conversion and provenance rule in the port is the shipped one, not a copy — and
// substituting `rawTidalIoRatio` with each of the two laws.
//
// That substitution is only legitimate if `rawTidalIoRatio` really is the whole reach of the three
// forwarded fields inside `deriveConditionVector`. This tool does not assume it: FOOTPRINT PROBE
// (below) rebuilds an fp, calls `deriveConditionVector` twice with the tidal triple swapped, and
// diffs EVERY key of the returned vector. If a second key ever moves — a future law reading
// `starMassEarth` directly, say — the probe reports it and the run fails. The probe is also what
// converts `surfaceGravity` and `T_eq` reading 0 from "0 because I copied them" into "0 measured
// through a real second derivation".
//
// ══════════════════════════════════════════════════════════════════════════════════════════════
// SOL
// ══════════════════════════════════════════════════════════════════════════════════════════════
// Sol IS measured here and is reported as its own labelled population. That is legitimate for this
// step and for no other reason: this is a delta between two evaluations of a PURE FUNCTION of a
// data record. It is not a rendering claim, no Sol pixel is inspected, and nothing in this file
// may be quoted as evidence about how anything looks. Sol renders from NASA textures through a
// different renderer; that fact is why the standing rule exists and it is not weakened here.

import { registerHooks } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

// `motion-test-kit` is a Vite alias (vite.config.js), not a node_modules package. Node has no
// alias table, so install the same prefix rewrite Vite does before any game module is imported.
const MTK = 'motion-test-kit';
registerHooks({
  resolve(spec, ctx, next) {
    if (spec === MTK || spec.startsWith(MTK + '/')) {
      return { url: pathToFileURL(path.join(ROOT, 'vendor', MTK, spec.slice(MTK.length))).href, shortCircuit: true };
    }
    return next(spec, ctx);
  },
});

async function loadOrExplain(rel) {
  try {
    return await import(pathToFileURL(path.join(ROOT, rel)).href);
  } catch (e) {
    console.error(`FATAL: could not load ${rel}\n  ${e && e.message}`);
    process.exit(69);
  }
}

const { PlanetGenerator }      = await loadOrExplain('src/generation/PlanetGenerator.js');
const { StarSystemGenerator }  = await loadOrExplain('src/generation/StarSystemGenerator.js');
const { SeededRandom }         = await loadOrExplain('src/generation/SeededRandom.js');
const { generateSolarSystem }  = await loadOrExplain('src/generation/SolarSystemData.js');
const { conditionFromPlanet, surfaceTemperatureOf }
                               = await loadOrExplain('src/worldengine/port/conditionFromPlanet.js');
const { compositionClass }     = await loadOrExplain('src/worldengine/base/e1Regime.js');
const AOPT                     = await loadOrExplain('src/worldengine/base/atmosphereOptics.js');
const { atmosphereOpticsOf }   = AOPT;
const { deriveConditionVector }= await loadOrExplain('body-condition-vector.js');
const { bodyRawTidal }         = await loadOrExplain('src/worldengine/base/baseStep.js');
const { craterUniformsFrom }   = await loadOrExplain('src/worldengine/port/craterUniforms.js');
const BOMB                     = await loadOrExplain('src/worldengine/base/bombardment.js');
const SM                       = await loadOrExplain('src/worldengine/base/surfaceMaterial.js');
const { applyAlbedoTransfer }  = await loadOrExplain('src/worldengine/display/albedoTransfer.js');
const { emissiveBlackbody }    = await loadOrExplain('src/worldengine/base/emission-e.js');

// ══════════════════════════════════════════════════════════════════════════════════════════════
// UNIT BRIDGE — the two constants that make a planet-around-star configuration read on the
// Io-moon scale. Imported in spirit from PhysicsEngine.js:322-323 (`SUN_MASS_EARTH`,
// `AU_IN_EARTH_RADII`), which does not export them; restated here with the source named so the
// next reader can check rather than trust. ⚠ NOTE THE 0.2 R⊕ DISCREPANCY: PhysicsEngine uses
// 23454.8, baseStep.js:27 defaults to 23455. That is a real 0.004% difference in the denominator
// of an a^-5 law (≈0.0043% in the result) and it is why the "corrected fallback reproduces
// d.tidalHeating" check below is stated with a relative tolerance rather than as byte-identity.
const SUN_MASS_EARTH = 332946;
const AU_IN_EARTH_RADII = 23454.8;

// ══════════════════════════════════════════════════════════════════════════════════════════════
// POPULATION
// ══════════════════════════════════════════════════════════════════════════════════════════════
// The three strata are the same shape as Instrument C's (tools/port-uniform-delta.mjs), and for
// the same reasons — S is the shipped distribution, P reaches the rare planet-class moons, G is
// type coverage the galaxy does not roll often enough. What is ADDED here is the ORBITAL CONTEXT:
// every body carries the (starMassEarth, orbitRadiusEarth) pair its tidal heating was actually
// computed from, because that pair is exactly what Step 2 forwards and the record does not carry
// it. Sourced from the generator, never re-derived:
//   S  starMassSolar = radiusSolar^1.25   (StarSystemGenerator.js:386, and :223 sets
//                                          star.radiusSolar = radiusSolarVaried)
//      orbitAU       = entry.orbitRadiusAU
//   G  zones === null ⇒ PlanetGenerator.js:372 `zones?.starMassSolar || 1.0` ⇒ 1 M☉; orbit is the
//      grid AU this cell was generated at.
//   P  the parent is the PLANET, not the star: MoonGenerator.js:257-262 computes the moon's
//      tidalHeating from the parent planet's massEarth and the moon's orbitRadiusEarth.
const DEFAULT_POP = {
  sysSeeds: 90,        // → ~370 planets
  pmScanSeeds: 1000,   // → ~25 planet-class moons
  gridSeed: 20260808,
  gridOrbitsAU: [0.35, 0.9, 2.0, 6.0, 18.0],
};

function buildGeneratedPopulation(pop) {
  const bodies = [];

  for (let seed = 1; seed <= pop.sysSeeds; seed++) {
    const sys = StarSystemGenerator.generate(seed);
    const starMassSolar = Math.pow(sys.star?.radiusSolar ?? 1.0, 1.25);
    // ⚠ THE WRAPPER'S ORBIT IS NOT ALWAYS THE ORBIT THE BODY WAS GENERATED AT. Resonance-chain
    // snapping and migration both rewrite `orbitRadiusAU` AFTER `PlanetGenerator.generate` has
    // already computed `tidalHeating` from the pre-snap orbit — StarSystemGenerator.js:563
    // `PlanetGenerator.generate` generates the body, and the migration + resonance walk that follow
    // the planet loop rewrite `orbitRadiusAU`. Flagged rather than corrected: it is
    // a fact about the game's generation ORDER, it does not touch the OLD/NEW delta (the NEW rule
    // reads `d.tidalHeating` whatever orbit produced it), and it is the reason the
    // corrected-fallback cross-check below is reported per stratum instead of as one number.
    const orbitMutated = !!(sys.resonanceChain?.isResonant || sys.migrationHistory?.occurred);
    sys.planets.forEach((entry, pi) => {
      bodies.push({
        id: `S:${String(seed).padStart(5, '0')}:p${pi}`,
        stratum: 'S',
        type: entry.planetData.type,
        rec: entry.planetData,
        starMassEarth: starMassSolar * SUN_MASS_EARTH,
        orbitRadiusEarth: Math.max(entry.orbitRadiusAU, 1e-6) * AU_IN_EARTH_RADII,
        ctxSource: 'system star + orbit',
        orbitMutated,
      });
    });
  }

  for (let seed = 1; seed <= pop.pmScanSeeds; seed++) {
    const sys = StarSystemGenerator.generate(seed);
    sys.planets.forEach((entry, pi) => {
      (entry.moons || []).forEach((m, mi) => {
        if (!m.isPlanetMoon || !m.planetData) return;
        const orbRE = m.orbitRadiusEarth;
        bodies.push({
          id: `P:${String(seed).padStart(5, '0')}:p${pi}:m${mi}`,
          stratum: 'P',
          type: m.planetData.type,
          rec: m.planetData,
          starMassEarth: entry.planetData.massEarth,
          orbitRadiusEarth: (orbRE != null && orbRE > 0) ? orbRE : undefined,
          ctxSource: 'parent planet + moon orbit',
        });
      });
    });
  }

  let cell = 0;
  for (const type of PlanetGenerator.TYPES) {
    for (const au of pop.gridOrbitsAU) {
      const rng = new SeededRandom(pop.gridSeed + cell * 7919);
      cell++;
      let rec;
      try {
        rec = PlanetGenerator.generate(rng, au, null, null, type);
      } catch (e) {
        bodies.push({ id: `G:${type}:${au}`, stratum: 'G', type, rec: null, error: String(e?.message || e) });
        continue;
      }
      bodies.push({
        id: `G:${type}:${au.toFixed(2)}au`,
        stratum: 'G',
        type: rec.type,
        rec,
        starMassEarth: 1.0 * SUN_MASS_EARTH,   // zones === null ⇒ PlanetGenerator.js:372 default
        orbitRadiusEarth: au * AU_IN_EARTH_RADII,
        ctxSource: 'grid: 1 M☉ + grid orbit',
      });
    }
  }

  return bodies.filter(b => b.rec);
}

function buildSolPopulation() {
  const sys = generateSolarSystem();
  const bodies = [];
  sys.planets.forEach((entry, pi) => {
    bodies.push({
      id: `SOL:p${pi}:${entry.planetData._canonicalName || entry.planetData.type}`,
      stratum: 'SOL',
      type: entry.planetData.type,
      rec: entry.planetData,
      starMassEarth: 1.0 * SUN_MASS_EARTH,
      orbitRadiusEarth: Math.max(entry.orbitRadiusAU, 1e-6) * AU_IN_EARTH_RADII,
      ctxSource: 'Sun + real orbit',
    });
    (entry.moons || []).forEach((m, mi) => {
      if (!m.isPlanetMoon || !m.planetData) return;
      bodies.push({
        id: `SOL:p${pi}:m${mi}:${m.planetData._canonicalName || 'moon'}`,
        stratum: 'SOL',
        type: m.planetData.type,
        rec: m.planetData,
        starMassEarth: entry.planetData.massEarth,
        orbitRadiusEarth: m.orbitRadiusEarth,
        ctxSource: 'parent planet + moon orbit',
      });
    });
  });
  return bodies;
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// THE TWO LAWS
// ══════════════════════════════════════════════════════════════════════════════════════════════
// Both go through the SHIPPED helper. The only difference between them is which fields the bundle
// carries — which is exactly the difference Step 2 makes to the fp literal.

/** Today: the port never forwards any of the three, so baseStep takes the 1 M☉-at-1-AU fallback. */
function rawTidalOld(cond) {
  return bodyRawTidal({
    radiusEarth: cond.radiusEarthCanonical,
    eccentricity: cond.eccentricity,
  });
}

/** Step 2: the D12 value wins; the fallback, when reached, uses the body's real star and orbit. */
function rawTidalNew(cond, body) {
  return bodyRawTidal({
    radiusEarth: cond.radiusEarthCanonical,
    eccentricity: cond.eccentricity,
    tidalHeat: body.rec.tidalHeating,
    starMassEarth: body.starMassEarth,
    orbitRadiusEarth: body.orbitRadiusEarth,
  });
}

/** The corrected fallback ALONE — Step 2's forwarding with the D12 value deliberately withheld.
 *  This is the counterfactual that prices what starMassEarth/orbitRadiusEarth buy on the branch
 *  where tidal heat is genuinely absent, on a population where it mostly is not. */
function rawTidalCorrectedFallback(cond, body) {
  return bodyRawTidal({
    radiusEarth: cond.radiusEarthCanonical,
    eccentricity: cond.eccentricity,
    starMassEarth: body.starMassEarth,
    orbitRadiusEarth: body.orbitRadiusEarth,
  });
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// MEASURED QUANTITIES
// ══════════════════════════════════════════════════════════════════════════════════════════════
// Every one is computed by calling the SHIPPED law on the condition. Nothing is re-derived.
//  · the three condition scalars Step 2's gate names
//  · the four bakes PlanetGenerator.generate assigns onto planetData at the bottom of the
//    constructor (`planetData.iceness = icenessOf(condition);` and its siblings) — same call
//    shape, same options, including the BIO_PIGMENT extra that albedoTransfer requires
//  · every crater uniform craterUniformsFrom returns
const BIO = SM.BIO_PIGMENT;

function quantitiesOf(cond) {
  const q = {};
  q.rawTidalIoRatio = cond.rawTidalIoRatio;
  q.surfaceGravity  = cond.surfaceGravity;
  q.T_eq            = cond.T_eq;

  const pal = applyAlbedoTransfer(SM.surfacePaletteOf(cond), { extra: { pigment: BIO } });
  q['landPalette.fresh']     = pal.fresh;
  q['landPalette.weathered'] = pal.weathered;
  q['landPalette.craton']    = pal.craton;
  q['landPalette.sediment']  = pal.sediment;
  q.iceness        = SM.icenessOf(cond);
  q.lavaGlowColor  = emissiveBlackbody(SM.meltTemperatureOf(cond));
  q.lavaCrustColor = emissiveBlackbody(SM.crustTemperatureOf(cond));

  const cu = craterUniformsFrom(cond);
  for (const k of ['density', 'scale', 'amp', 'complexD', 'relaxation', 'terraceCount',
                   'ejectaStrength', 'ejectaRampart', 'ejectaAmp', 'ejectaLump']) {
    q['crater.' + k] = cu[k];
  }
  return q;
}

const QUANTITY_ORDER = [
  'rawTidalIoRatio', 'surfaceGravity', 'T_eq',
  'landPalette.fresh', 'landPalette.weathered', 'landPalette.craton', 'landPalette.sediment',
  'iceness', 'lavaGlowColor', 'lavaCrustColor',
  'crater.density', 'crater.scale', 'crater.amp', 'crater.complexD', 'crater.relaxation',
  'crater.terraceCount', 'crater.ejectaStrength', 'crater.ejectaRampart', 'crater.ejectaAmp',
  'crater.ejectaLump',
];

/** Delta between two values of the same quantity. Scalars: |Δ|. Vectors: max |Δ| over channels.
 *  NO EPSILON ANYWHERE — a moved value is moved, however small. The tool reports; a human rules. */
function deltaOf(a, b) {
  if (typeof a === 'number' && typeof b === 'number') {
    if (!Number.isFinite(a) || !Number.isFinite(b)) return (a === b) ? 0 : NaN;
    return Math.abs(b - a);
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return NaN;
    let m = 0;
    for (let i = 0; i < a.length; i++) {
      const d = deltaOf(a[i], b[i]);
      if (!Number.isFinite(d)) return NaN;
      if (d > m) m = d;
    }
    return m;
  }
  if (a == null && b == null) return 0;
  return NaN;
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// STATS
// ══════════════════════════════════════════════════════════════════════════════════════════════
function nearestRank(sorted, p) {
  if (!sorted.length) return NaN;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
  return sorted[i];
}

function statsOf(values) {
  const clean = values.filter(Number.isFinite).slice().sort((x, y) => x - y);
  return {
    n: values.length,
    bad: values.length - clean.length,
    min: clean.length ? clean[0] : NaN,
    median: nearestRank(clean, 0.5),
    p95: nearestRank(clean, 0.95),
    max: clean.length ? clean[clean.length - 1] : NaN,
    moved: clean.filter(v => v !== 0).length,
  };
}

function fmt(x) {
  if (!Number.isFinite(x)) return 'n/a';
  if (x === 0) return '0';
  const a = Math.abs(x);
  if (a >= 1e6 || a < 1e-4) return x.toExponential(4);
  return x.toPrecision(6).replace(/\.?0+$/, '');
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// FOOTPRINT PROBE (§11.3.3 — the control that makes the copied keys mean something)
// ══════════════════════════════════════════════════════════════════════════════════════════════
// Rebuild an fp from a real condition, run deriveConditionVector twice with ONLY the tidal triple
// changed, diff every key. Two facts are wanted from it:
//   · rawTidalIoRatio MOVES — the probe is wired to something (a probe whose control never moved
//     is evidence of nothing).
//   · nothing else moves — including surfaceGravity and T_eq, which the main table copies. Their
//     zero is then a measurement through a second real derivation, not an artefact of the copy.
function fpFromCondition(cond) {
  return {
    radiusEarth: cond.radiusEarthCanonical,
    composition: cond.composition,
    age: cond.age,
    T_eq: cond.T_eq,
    eccentricity: cond.eccentricity,
    tidalState: cond.tidalState,
    atmosphere: cond.atmosphere,
    surfaceHistory: cond.surfaceHistory,
    rotationHours: cond.rotationHours,
    magneticField: cond.magneticField,
    habitability: cond.habitability,
    axialTilt: cond.axialTiltDeg,
  };
}

function footprintProbe(bodies) {
  const moved = new Map();      // key -> count of bodies on which it differed
  let probed = 0;
  const keysSeen = new Set();
  for (const b of bodies) {
    const cond = conditionFromPlanet(b.rec);
    const fpA = fpFromCondition(cond);
    const fpB = { ...fpA, tidalHeat: b.rec.tidalHeating, starMassEarth: b.starMassEarth, orbitRadiusEarth: b.orbitRadiusEarth };
    const cA = deriveConditionVector(fpA, null, fpA.radiusEarth);
    const cB = deriveConditionVector(fpB, null, fpB.radiusEarth);
    const keys = new Set([...Object.keys(cA), ...Object.keys(cB)]);
    for (const k of keys) {
      keysSeen.add(k);
      if (JSON.stringify(cA[k] ?? null) !== JSON.stringify(cB[k] ?? null)) {
        moved.set(k, (moved.get(k) || 0) + 1);
      }
    }
    probed++;
  }
  return { probed, keysSeen: [...keysSeen].sort(), moved };
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// CRATER DIAGNOSTIC — the control that makes a crater zero mean something
// ══════════════════════════════════════════════════════════════════════════════════════════════
// Step 2's gate names "plus the crater uniforms" among the quantities to publish, on the reasoning
// that `rawTidalIoRatio` feeds `craterSchedule`'s `tExp` (bombardment.js:174-176). Measured, they
// do not move at all. A zero with no control behind it is worth nothing, so this block establishes
// three separate facts and reports all of them:
//
//   1. HOW MANY BODIES HAVE CRATERS AT ALL. `craterUniformsFrom` returns CRATERS_OFF unless the
//      schedule fires AND the resolvable band is non-empty AND density ≥ CRATER_MIN_DENSITY. A
//      quantity that is off on almost every body cannot move on almost every body.
//   2. WHETHER THE CHAIN CAN SEE A TIDAL MOVE AT ALL — forced swing 0 → 1e5 on the same
//      conditions. If the uniforms move there, the comparator is not blind.
//   3. WHY THE REAL DELTA IS ZERO ANYWAY. `tExp = min(age, T_RESURF_TIDAL/td, T_RESURF_ERODE/erosion)`
//      is a MIN OF THREE. The tidal term only binds once `td` is large enough for
//      `T_RESURF_TIDAL/td` to fall below the other two. This counts, per body, which term is the
//      argmin under OLD and under NEW — the mechanism, not a guess at it.
function craterDiagnostic(bodies) {
  let cratersOn = 0, movedOnForcedSwing = 0, scheduleMovedOnForcedSwing = 0;
  const bind = { age: 0, tidal: 0, erosion: 0 };            // argmin of tExp under the NEW rule
  let tidalBindsUnderEither = 0;
  for (const b of bodies) {
    const cond = conditionFromPlanet(b.rec);
    const rOld = rawTidalOld(cond);
    const rNew = rawTidalNew(cond, b);
    const cOld = { ...cond, rawTidalIoRatio: rOld };
    const cNew = { ...cond, rawTidalIoRatio: rNew };
    if (craterUniformsFrom(cOld).density > 0) cratersOn++;

    const lo = { ...cond, rawTidalIoRatio: 0 };
    const hi = { ...cond, rawTidalIoRatio: 1e5 };
    if (JSON.stringify(craterUniformsFrom(lo)) !== JSON.stringify(craterUniformsFrom(hi))) movedOnForcedSwing++;
    if (JSON.stringify(BOMB.craterSchedule(lo)) !== JSON.stringify(BOMB.craterSchedule(hi))) scheduleMovedOnForcedSwing++;

    // Which of tExp's three terms binds?
    const termsFor = (c) => {
      const age = Math.min(BOMB.AGE_MAX, Math.max(0, c.age ?? 4.0));
      const tidal = BOMB.T_RESURF_TIDAL / Math.max(c.rawTidalIoRatio ?? 0, BOMB.EPS_TD);
      const erosion = BOMB.T_RESURF_ERODE / Math.max(SM.erosionOf(c), BOMB.EPS_ER);
      const m = Math.min(age, tidal, erosion);
      return { name: (m === tidal) ? 'tidal' : (m === erosion ? 'erosion' : 'age') };
    };
    const tn = termsFor(cNew), to = termsFor(cOld);
    bind[tn.name]++;
    if (tn.name === 'tidal' || to.name === 'tidal') tidalBindsUnderEither++;
  }
  return { n: bodies.length, cratersOn, movedOnForcedSwing, scheduleMovedOnForcedSwing, bind, tidalBindsUnderEither };
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// MEASUREMENT
// ══════════════════════════════════════════════════════════════════════════════════════════════
function measure(bodies, label) {
  const per = new Map(QUANTITY_ORDER.map(k => [k, []]));
  const ratios = [];
  let present = 0, absent = 0, bothZero = 0, realMiss = 0, realMissMutated = 0;
  const ratiosNZ = [];
  const fallbackCorrectionDeltas = [];       // control 2: what the forwarding buys on the absent branch
  const d12VsCorrectedRel = [];              // does the corrected fallback reproduce the D12 value?

  for (const b of bodies) {
    const cond = conditionFromPlanet(b.rec);
    const rOld = rawTidalOld(cond);
    const rNew = rawTidalNew(cond, b);
    const rFallbackCorrected = rawTidalCorrectedFallback(cond, b);

    const th = b.rec.tidalHeating;
    if (th != null) present++; else absent++;

    // Control 2's counterfactual: the SAME body with the D12 value withheld. OLD fallback vs
    // CORRECTED fallback — i.e. exactly the work starMassEarth/orbitRadiusEarth do.
    fallbackCorrectionDeltas.push(Math.abs(rFallbackCorrected - rOld));
    if (th != null && th > 0 && rFallbackCorrected > 0) {
      const rel = Math.abs(rFallbackCorrected - th) / th;
      d12VsCorrectedRel.push(rel);
      // 1e-12 is a FLOAT-NOISE threshold, not a tolerance on the claim: the two sides run the same
      // expression on the same doubles in a different association order, so exact bit equality is
      // not the right question. Anything above it is a genuine input disagreement, and is counted
      // separately against whether the body's system rewrote its orbit after generation.
      if (rel > 1e-12) { realMiss++; if (b.orbitMutated) realMissMutated++; }
    }

    // Ratio, for the plan's "within 2x / median 75x off" claim. Both zero ⇒ ratio 1 (agreement);
    // exactly one zero ⇒ Infinity (a total miss, and it must not be silently dropped).
    if (rOld === 0 && rNew === 0) { ratios.push(1); bothZero++; }
    else if (rOld === 0 || rNew === 0) ratios.push(Infinity);
    else { const rr = Math.max(rOld, rNew) / Math.min(rOld, rNew); ratios.push(rr); ratiosNZ.push(rr); }

    const qOld = quantitiesOf({ ...cond, rawTidalIoRatio: rOld });
    const qNew = quantitiesOf({ ...cond, rawTidalIoRatio: rNew });
    for (const k of QUANTITY_ORDER) per.get(k).push(deltaOf(qOld[k], qNew[k]));
  }

  const finiteRatios = ratios.filter(Number.isFinite).slice().sort((a, c) => a - c);
  const sortedNZ = ratiosNZ.slice().sort((a, c) => a - c);
  const infCount = ratios.filter(r => !Number.isFinite(r)).length;
  const within2x = ratios.filter(r => Number.isFinite(r) && r <= 2).length;

  return {
    label,
    n: bodies.length,
    present, absent,
    stats: new Map(QUANTITY_ORDER.map(k => [k, statsOf(per.get(k))])),
    ratio: {
      within2xCount: within2x,
      within2xPct: bodies.length ? (100 * within2x / bodies.length) : NaN,
      infCount,
      median: nearestRank(finiteRatios, 0.5),
      p95: nearestRank(finiteRatios, 0.95),
      max: finiteRatios.length ? finiteRatios[finiteRatios.length - 1] : NaN,
      // Same figures with the bodies where BOTH rules give exactly 0 removed. The plan does not
      // say how it treated those, and they are 9% of this population, so the choice is reported
      // rather than made silently.
      bothZero,
      nzN: sortedNZ.length,
      nzWithin2xPct: sortedNZ.length ? (100 * sortedNZ.filter(x => x <= 2).length / sortedNZ.length) : NaN,
      nzMedian: nearestRank(sortedNZ, 0.5),
      nzP95: nearestRank(sortedNZ, 0.95),
    },
    fallbackCorrection: statsOf(fallbackCorrectionDeltas),
    d12VsCorrected: statsOf(d12VsCorrectedRel),
    d12RealMiss: realMiss,
    d12RealMissMutated: realMissMutated,
  };
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// SELFTEST — negative controls. A harness that has never failed is not a harness.
// ══════════════════════════════════════════════════════════════════════════════════════════════
function runSelftest() {
  let bad = 0;
  const fail = (m) => { console.error('SELFTEST FAIL: ' + m); bad++; };
  const ok = (m) => console.log('  ok  ' + m);

  // 1. deltaOf sees a move it is supposed to see, at any magnitude.
  if (deltaOf(1, 1 + 1e-15) === 0) fail('deltaOf swallowed a 1e-15 move (an epsilon leaked in)');
  else ok('deltaOf reports a 1e-15 scalar move');
  if (deltaOf([0, 0, 0], [0, 3e-9, 0]) !== 3e-9) fail('deltaOf missed a per-channel vector move');
  else ok('deltaOf reports a 3e-9 vector-channel move');
  if (!Number.isNaN(deltaOf(1, null))) fail('deltaOf coerced a shape mismatch instead of NaN');
  else ok('deltaOf refuses to coerce a shape mismatch');

  // 2. The two laws genuinely differ on a body built to differ, and agree on one built to agree.
  const condLike = { radiusEarthCanonical: 1.0, eccentricity: 0.2 };
  const bDiff = { rec: { tidalHeating: 42 }, starMassEarth: SUN_MASS_EARTH, orbitRadiusEarth: AU_IN_EARTH_RADII };
  if (rawTidalNew(condLike, bDiff) !== 42) fail('NEW rule did not take the D12 value when present');
  else ok('NEW rule takes d.tidalHeating when present');
  const bAbsent = { rec: {}, starMassEarth: SUN_MASS_EARTH, orbitRadiusEarth: AU_IN_EARTH_RADII };
  const oldV = rawTidalOld(condLike), newV = rawTidalNew(condLike, bAbsent);
  if (Math.abs(newV - oldV) / Math.max(oldV, 1e-30) > 1e-3) {
    fail(`absent + 1 M☉-at-1-AU should reproduce the OLD fallback; got ${newV} vs ${oldV}`);
  } else ok('absent tidal heat at 1 M☉/1 AU reproduces the OLD fallback (the null case is null)');
  const bFar = { rec: {}, starMassEarth: SUN_MASS_EARTH, orbitRadiusEarth: 10 * AU_IN_EARTH_RADII };
  if (!(rawTidalNew(condLike, bFar) < oldV)) fail('corrected fallback did not fall with a 10x wider orbit (a^-5)');
  else ok('corrected fallback falls with orbit radius (the forwarding does something)');

  // 3. The bake/crater chain can SEE a tidal move. If it cannot, every zero in the table is a
  //    fact about the comparator instead of about the laws — this codebase's signature failure.
  const rng = new SeededRandom(20260808);
  const probeRec = PlanetGenerator.generate(rng, 1.2, null, null, 'rocky');
  const c0 = conditionFromPlanet(probeRec);
  const qLo = quantitiesOf({ ...c0, rawTidalIoRatio: 0 });
  const qHi = quantitiesOf({ ...c0, rawTidalIoRatio: 500 });
  const sawMove = QUANTITY_ORDER.filter(k => deltaOf(qLo[k], qHi[k]) > 0);
  if (!sawMove.length) fail('a 0 -> 500 tidal swing moved NOTHING downstream — the comparator is blind');
  else ok(`a 0 -> 500 tidal swing moves ${sawMove.length} quantities: ${sawMove.join(', ')}`);
  if (deltaOf(qLo.iceness, qHi.iceness) !== 0) {
    fail('iceness moved under a tidal swing — it is the declared no-op control and must not');
  } else ok('iceness reads exactly 0 under the same swing (the no-op control holds)');

  console.log(bad ? `\nSELFTEST: ${bad} failure(s)` : '\nSELFTEST: all controls held');
  return bad === 0;
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// ██ STEP 4 ITEM 4 — THE NO-SURFACE DOMAIN GUARD'S COMMITTED DELTA TABLE ██
// ══════════════════════════════════════════════════════════════════════════════════════════════
// PLAN §4 Step 4 item 4 — docs/FEATURES/one-pipeline-two-frontends-PLAN.md:242
// `compositionClass(cv) === 'gas'`.
// Writes docs/FEATURES/step4-limb-delta-table.md. Shares this file's population builders, `deltaOf`
// and `statsOf` with the Step 2 table on purpose: two delta tables that disagree about what "a body"
// or "moved" means resolve into an unactionable instruction.
//
// ⛔ SAME REASON THE STEP 2 HARNESS COMPUTES BOTH LAWS ITSELF (see this file's header). The obvious
// harness — "call conditionFromPlanet, then call it again with the guard reverted" — can only
// measure the law the tree happens to carry, so it prints zeros a day early and cannot reproduce the
// before-state a day late. Both laws are evaluated here from the SHIPPED `surfaceTemperatureOf` and
// the SHIPPED `atmosphereOpticsOf`, so this table reads the same before and after the guard lands.
//
//   OLD  T_eq = surfaceTemperatureOf(rec.T_eq, atmosphere.pressure)   — the greenhouse fit applied
//        to an envelope depth. On generated giants that depth is 1000 bar against a fit solved on
//        1 bar (Earth) and 92 bar (Venus).
//   NEW  T_eq = rec.T_eq                                              — on 'gas' bodies only. Every
//        other body keeps OLD exactly, which is what makes the non-gas rows below a control.
//
// ⚠ WHAT IS AND IS NOT TRANSCRIBED. `limbColor`, `termColor` and `limbExponent` come out of
// `atmosphereOpticsOf` — the shipped module, called, not copied. `uTermStrength` and `uTermWidth`
// are the only two of the five whose final expression lives in src/objects/Planet.js and is not
// exported, so those two ARE transcribed (TERM_STRENGTH / termWidthFor below) — and the
// transcription is not trusted: MATERIAL CROSS-CHECK builds the real `new Planet(rec)` and requires
// all five recomputed uniforms to equal the live material's, exactly, on every body.

// ⛔ TRANSCRIBED FROM src/objects/Planet.js, WHICH DOES NOT EXPORT THEM. Verify against
// src/objects/Planet.js:1420 `const TERM_STRENGTH = 0.15;` and src/objects/Planet.js:1409
// `function termWidthFor(pressureBar) {` through :1411
// `  return Math.min(0.30, Math.max(0.06, 0.12 + 0.09 * Math.log10(p)));`. A drift here is caught by
// MATERIAL CROSS-CHECK, not by a reader's diligence.
const TERM_STRENGTH = 0.15;
function termWidthFor(pressureBar) {
  const p = Math.max(pressureBar ?? 0, 1e-3);
  return Math.min(0.30, Math.max(0.06, 0.12 + 0.09 * Math.log10(p)));
}

/** The five shipped uniform VALUES src/objects/Planet.js writes from a condition, as plain data. */
function limbUniformsOf(cond) {
  const o = atmosphereOpticsOf(cond);
  return {
    uLimbExponent: o.limbExponent,                            // Planet.js:1617 `uLimbExponent: { value: optics.limbExponent },`
    uLimbColor:    o.limbColor.slice(),                       // Planet.js:1618 `uLimbColor: { value: new THREE.Vector3(...optics.limbColor) },`
    uTermColor:    o.termColor.slice(),                       // Planet.js:1629 `uTermColor: { value: new THREE.Vector3(...optics.termColor) },`
    uTermStrength: (o.columnFraction ?? 0) * TERM_STRENGTH,   // Planet.js:1627 `uTermStrength: { value: (optics.columnFraction ?? 0) * TERM_STRENGTH },`
    uTermWidth:    termWidthFor(cond.atmosphere?.pressure),   // Planet.js:1628 `uTermWidth: { value: termWidthFor(condition.atmosphere?.pressure) },`
  };
}

const LIMB_UNIFORM_ORDER = ['uLimbExponent', 'uLimbColor', 'uTermColor', 'uTermStrength', 'uTermWidth'];

/** ⚠ Read the FLATTENED pressure, not `rec.atmosphere.pressure` — the game nests it one level down
 *  and reading the wrapper is the third silent-disagreement bug conditionFromPlanet exists to close. */
function step4RowFor(cond, rec) {
  const rawTeq = rec.T_eq ?? 288;
  const P = cond.atmosphere?.pressure;
  const gas = compositionClass(cond) === 'gas';
  const tEqDefaulted = (rec.T_eq == null);   // ⇒ 288 K, a fabrication, not a measurement of this body
  const tOld = surfaceTemperatureOf(rawTeq, P);
  const tNew = gas ? rawTeq : tOld;
  // The condition is the REAL one; only T_eq is substituted, which is the whole of what the guard
  // changes inside conditionFromPlanet. `_provenance` is non-enumerable and is dropped by the
  // spread — deliberately; nothing downstream of here reads it.
  const condOld = { ...cond, T_eq: tOld };
  const condNew = { ...cond, T_eq: tNew };
  return {
    gas, rawTeq, tEqDefaulted, pressure: P ?? 0, tOld, tNew,
    ghFactor: rawTeq !== 0 ? tOld / rawTeq : NaN,
    old: limbUniformsOf(condOld),
    neu: limbUniformsOf(condNew),
    bakeOld: step4QuantitiesOf(condOld),
    bakeNew: step4QuantitiesOf(condNew),
  };
}

function sameUniforms(a, b) {
  for (const k of LIMB_UNIFORM_ORDER) if (deltaOf(a[k], b[k]) !== 0) return false;
  return true;
}

/**
 * MATERIAL CROSS-CHECK — the control that makes every other number in this table admissible.
 *
 * Builds the REAL `new Planet(rec)` and reads the five uniforms off
 * `planet.surface.material.uniforms`. Three things fall out of one measurement, and none of them is
 * assertable without it:
 *   1. THE TRANSCRIPTION IS RIGHT. TERM_STRENGTH / termWidthFor above are copies of un-exported
 *      Planet.js constants; if either drifts, `matchesNeither` becomes non-zero and this run fails.
 *   2. THE TWO LAWS ARE DISTINGUISHABLE ON REAL BODIES. `differ` counts the bodies where OLD and NEW
 *      produce different uniforms at all. A table built where `differ` is 0 is a table of zeros
 *      dressed as a measurement.
 *   3. WHICH SIDE OF THE CHANGE THIS TREE IS ON, read off the shipped material rather than off the
 *      source text. That is what makes `--step4 --check` a gate the guard's revert can red.
 */
function materialCrossCheck(Planet, rows) {
  let built = 0, failed = 0, differ = 0, matchesOld = 0, matchesNew = 0, matchesNeither = 0;
  const neitherIds = [];
  for (const r of rows) {
    let u;
    try { u = new Planet(r.body.rec).surface.material.uniforms; built++; }
    catch { failed++; continue; }
    const live = {
      uLimbExponent: u.uLimbExponent.value,
      uLimbColor: [u.uLimbColor.value.x, u.uLimbColor.value.y, u.uLimbColor.value.z],
      uTermColor: [u.uTermColor.value.x, u.uTermColor.value.y, u.uTermColor.value.z],
      uTermStrength: u.uTermStrength.value,
      uTermWidth: u.uTermWidth.value,
    };
    const d = !sameUniforms(r.m.old, r.m.neu);
    if (d) differ++;
    const mo = sameUniforms(live, r.m.old);
    const mn = sameUniforms(live, r.m.neu);
    if (mo) matchesOld++;
    if (mn) matchesNew++;
    if (!mo && !mn) { matchesNeither++; if (neitherIds.length < 5) neitherIds.push(r.body.id); }
  }
  // On a body where the two laws agree, matching "both" says nothing. The tree's law is read only
  // off the bodies where they genuinely differ.
  const discriminating = rows.filter(r => !sameUniforms(r.m.old, r.m.neu));
  let dOld = 0, dNew = 0, dNeither = 0;
  for (const r of discriminating) {
    let u; try { u = new Planet(r.body.rec).surface.material.uniforms; } catch { continue; }
    const live = {
      uLimbExponent: u.uLimbExponent.value,
      uLimbColor: [u.uLimbColor.value.x, u.uLimbColor.value.y, u.uLimbColor.value.z],
      uTermColor: [u.uTermColor.value.x, u.uTermColor.value.y, u.uTermColor.value.z],
      uTermStrength: u.uTermStrength.value,
      uTermWidth: u.uTermWidth.value,
    };
    if (sameUniforms(live, r.m.neu)) dNew++;
    else if (sameUniforms(live, r.m.old)) dOld++;
    else dNeither++;
  }
  const treeLaw = (dNeither > 0) ? 'NEITHER'
    : (dNew > 0 && dOld === 0) ? 'NEW'
    : (dOld > 0 && dNew === 0) ? 'OLD'
    : (dNew === 0 && dOld === 0) ? 'UNDETERMINED' : 'MIXED';
  return { built, failed, differ, matchesOld, matchesNew, matchesNeither, neitherIds,
           discriminating: discriminating.length, dOld, dNew, dNeither, treeLaw };
}

/**
 * NON-GAS LIVENESS — the control that stops "0 / 616 non-gas bodies moved" from being vacuous.
 * The guard is supposed to be inert outside the gas class, and the comparator returning 0 there
 * looks identical to a comparator that is not wired. So the same comparator is handed a T_eq that
 * moves by a declared amount on those same non-gas bodies; if it still reports 0, the zero above
 * was evidence of nothing.
 */
const LIVE_T_LO = 100, LIVE_T_HI = 1500;   // spans every anchor in the optics law's two hue ramps

function nonGasLiveness(rows, deltaK = 40) {
  let n = 0, movedNear = 0, movedWide = 0, tIndependent = 0, tIndepAndStill = 0;
  for (const r of rows) {
    if (r.m.gas) continue;
    n++;
    const base = limbUniformsOf({ ...r.cond, T_eq: r.m.tOld });
    if (!sameUniforms(base, limbUniformsOf({ ...r.cond, T_eq: r.m.tOld + deltaK }))) movedNear++;
    const wide = !sameUniforms(limbUniformsOf({ ...r.cond, T_eq: LIVE_T_LO }),
                               limbUniformsOf({ ...r.cond, T_eq: LIVE_T_HI }));
    if (wide) movedWide++;
    // ⚠ WHY A NON-GAS BODY CAN BE COMPLETELY TEMPERATURE-BLIND — DECOMPOSED BY MEASUREMENT, NOT BY
    // A PREDICATE. `T` reaches these five uniforms through exactly two doors: `hazeFractionOf`, and
    // `primordialFractionOf` (whose Jeans λ carries `T_exo = 3.5·T_eq` in its denominator, so `prim`
    // is temperature-dependent on a SOLID body too — which is why the obvious "haze gate" predicate
    // written here first was WRONG, predicting 425 blind bodies against 285 observed). So both doors
    // are evaluated at both probe temperatures and the answer is counted, not modelled: a body with
    // haze == 0 AND prim == 0 at both ends has no door open and cannot move, whatever the probe.
    const at = (T) => { const c = { ...r.cond, T_eq: T };
      return { h: AOPT.hazeFractionOf(c), p: AOPT.primordialFractionOf(c) }; };
    const lo = at(LIVE_T_LO), hi = at(LIVE_T_HI);
    const bothDoorsShut = (lo.h === 0 && hi.h === 0 && lo.p === 0 && hi.p === 0);
    if (bothDoorsShut) { tIndependent++; if (!wide) tIndepAndStill++; }
  }
  return { n, movedNear, movedWide, deltaK, tIndependent, tIndepAndStill,
           canMove: n - tIndependent, wideAmongCanMove: movedWide - (tIndependent - tIndepAndStill) };
}

/**
 * ACYCLICITY — the guard classifies FIRST and sets `T_eq` SECOND, which is only well-defined
 * because `compositionClass` does not read `T_eq`. That is a property of a function in a file this
 * lane may not edit, so it is CHECKED rather than assumed: every body is classified at two
 * temperatures 1400 K apart and the two answers must agree. If a future edit gives the composition
 * gate a temperature term, the guard becomes a fixpoint and this control goes red naming it.
 */
function acyclicityCheck(rows) {
  let n = 0, disagreed = 0;
  const examples = [];
  for (const r of rows) {
    n++;
    const a = compositionClass({ ...r.cond, T_eq: 100 });
    const b = compositionClass({ ...r.cond, T_eq: 1500 });
    if (a !== b) { disagreed++; if (examples.length < 5) examples.push(`${r.body.id}: ${a} vs ${b}`); }
  }
  return { n, disagreed, examples };
}

/** Per-uniform |Δ| stats over a row subset. Vectors report max abs channel delta (deltaOf's rule). */
function limbStats(rows, pick) {
  const out = new Map();
  for (const k of LIMB_UNIFORM_ORDER) {
    const vals = [];
    for (const r of rows) { if (pick && !pick(r)) continue; vals.push(deltaOf(r.m.old[k], r.m.neu[k])); }
    out.set(k, statsOf(vals));
  }
  return out;
}

// ⛔ QUANTITY_ORDER IS NOT WIDENED, DELIBERATELY — it is the Step 2 artifact's row list and adding
// to it would silently rewrite a committed table belonging to another step. Step 4 needs two rows
// Step 2 did not measure, because Instrument C reports two uniforms this table would otherwise be
// silent about: `uBioGroundCover` (biosphereOf) and `uBioGroundColor` (the palette's transferred
// pigment). They are added HERE, in a Step-4-local extension.
const STEP4_EXTRA_ORDER = ['biosphere', 'landPalette.pigment'];
const STEP4_QUANTITY_ORDER = [...QUANTITY_ORDER, ...STEP4_EXTRA_ORDER];

function step4QuantitiesOf(cond) {
  const q = quantitiesOf(cond);
  q.biosphere = SM.biosphereOf(cond);                                     // Planet.js:1631 `uBioGroundCover: { value: bioCover },`
  q['landPalette.pigment'] = applyAlbedoTransfer(SM.surfacePaletteOf(cond), { extra: { pigment: BIO } }).pigment;
  return q;
}

/** The shipped uniform each measured quantity lands in, so this table and Instrument C can be joined. */
const UNIFORM_OF_QUANTITY = {
  'landPalette.fresh': 'uFreshColor', 'landPalette.weathered': 'uWeatheredColor',
  'landPalette.sediment': 'uSedColor', 'landPalette.pigment': 'uBioGroundColor',
  'landPalette.craton': '(not a shipped uniform)',
  iceness: 'uIcenessMix', lavaGlowColor: 'uLavaGlow', lavaCrustColor: 'uLavaCrust',
  biosphere: 'uBioGroundCover',
};

function bakeStats(rows, pick) {
  const out = new Map();
  for (const k of STEP4_QUANTITY_ORDER) {
    const vals = [];
    for (const r of rows) { if (pick && !pick(r)) continue; vals.push(deltaOf(r.m.bakeOld[k], r.m.bakeNew[k])); }
    out.set(k, statsOf(vals));
  }
  return out;
}

function buildStep4Rows(bodies) {
  const rows = [];
  for (const body of bodies) {
    let cond, m;
    try { cond = conditionFromPlanet(body.rec); m = step4RowFor(cond, body.rec); }
    catch (e) { rows.push({ body, error: String(e?.message || e) }); continue; }
    rows.push({ body, cond, m });
  }
  return rows.filter(r => r.m);
}

function limbTable(stats, n) {
  const lines = ['| uniform | moved / n | min |Δ| | median |Δ| | p95 |Δ| | max |Δ| |', '|---|---:|---:|---:|---:|---:|'];
  for (const k of LIMB_UNIFORM_ORDER) {
    const s = stats.get(k);
    lines.push(`| \`${k}\` | ${s.moved} / ${n} | ${fmt(s.min)} | ${fmt(s.median)} | ${fmt(s.p95)} | ${fmt(s.max)} |`);
  }
  return lines.join('\n');
}

const STEP4_POP = { sysSeeds: 200, pmScanSeeds: 1000, gridSeed: 20260808, gridOrbitsAU: [0.35, 0.9, 2.0, 6.0, 18.0] };

async function runStep4(args) {
  const { Planet } = await loadOrExplain('src/objects/Planet.js');

  const gen = buildGeneratedPopulation(STEP4_POP);
  const sol = buildSolPopulation();
  const rows = buildStep4Rows(gen);
  const solRows = buildStep4Rows(sol);

  const gasRows = rows.filter(r => r.m.gas);
  const nonGasRows = rows.filter(r => !r.m.gas);
  const solGas = solRows.filter(r => r.m.gas);

  const gasStats = limbStats(gasRows);
  const nonGasStats = limbStats(nonGasRows);
  const solGasStats = limbStats(solGas);
  const gasBakes = bakeStats(gasRows);

  const gh = statsOf(gasRows.map(r => r.m.ghFactor));
  const xc = materialCrossCheck(Planet, rows);
  const live = nonGasLiveness(rows);
  const acyc = acyclicityCheck(rows);

  // Reproduction: the whole population is rebuilt from the same integer seeds and every one of the
  // five uniforms is re-measured. Compared on the FULL per-body vector, not on a headline — a
  // headline that matches while a body underneath it moved is this program's signature failure.
  const rows2 = buildStep4Rows(buildGeneratedPopulation(STEP4_POP));
  let reproN = 0, reproMismatch = 0;
  if (rows2.length === rows.length) {
    for (let i = 0; i < rows.length; i++) {
      reproN++;
      if (rows2[i].body.id !== rows[i].body.id) { reproMismatch++; continue; }
      if (!sameUniforms(rows2[i].m.old, rows[i].m.old) || !sameUniforms(rows2[i].m.neu, rows[i].m.neu)) reproMismatch++;
    }
  } else { reproMismatch = -1; }
  const repro = (reproMismatch === 0 && reproN === rows.length && rows.length > 0);

  // ⛔ SOL BODIES CARRY NO NAME ON THE RECORD — `_canonicalName` is null on every planet except the
  // dwarfs. So the two the plan names are identified by the pair the source authors them with,
  // ORBIT + RADIUS, verified against the literal: SolarSystemData.js:473 `    // ── Uranus ───────────────────────────────────────────────────`
  // gives SolarSystemData.js:476 `      radiusEarth: 4.01,` at SolarSystemData.js:477
  // `      orbitAU: 19.19,`, and SolarSystemData.js:559 `    // ── Neptune ──────────────────────────────────────────────────`
  // gives SolarSystemData.js:562 `      radiusEarth: 3.88,` at SolarSystemData.js:563
  // `      orbitAU: 30.07,`. Matching on both, exactly, rather than on a position in an array that a
  // future edit reorders silently.
  const SOL_NAMED = [
    { label: 'Uranus',  orbitAU: 19.19, radiusEarth: 4.01 },
    { label: 'Neptune', orbitAU: 30.07, radiusEarth: 3.88 },
  ];
  const namedSol = (spec) => solRows.find(r =>
    Math.abs((r.body.orbitRadiusEarth / AU_IN_EARTH_RADII) - spec.orbitAU) < 1e-6
    && r.body.rec.radiusEarth === spec.radiusEarth);
  const solDefaulted = solRows.filter(r => r.m.tEqDefaulted).length;
  const genDefaulted = rows.filter(r => r.m.tEqDefaulted).length;

  const head = gitHead();
  const strataCount = (st) => gen.filter(b => b.stratum === st).length;
  const gasIn = (st) => rows.filter(r => r.body.stratum === st && r.m.gas).length;

  const o = [];
  o.push('# Step 4 item 4 — the committed delta table: the no-surface domain guard');
  o.push('');
  o.push('> **Generated artifact — do not hand-edit.** Regenerate with `node tools/port-condition-delta.mjs --step4`.');
  o.push('> Gate for item 4 of Step 4 in `docs/FEATURES/one-pipeline-two-frontends-PLAN.md`.');
  o.push('> This is a **declared pixel-moving step** (§11.3.6): the named movers *must* move, and a table');
  o.push('> of zeros here is a failure, not a pass.');
  o.push('');
  o.push(`**Tree at generation:** \`${head}\` · **generated:** ${new Date().toISOString().slice(0, 10)} · **law this tree implements, read off the live material:** \`${xc.treeLaw}\``);
  o.push('');
  o.push('## ⛔ What this table is NOT evidence of (ledger C20)');
  o.push('');
  o.push('Every number below is measured **through the game material** — the five uniforms');
  o.push('`src/objects/Planet.js` writes today, with the limb term fully on — src/objects/Planet.js:1401');
  o.push('`const LIMB_MIX = 1.0;`. **Step 6 swaps most of this population onto a material whose limb');
  o.push('term is gated by a different uniform name.** This is the right gate for Step 4 and it is *not* a');
  o.push('durable statement about what a player sees afterwards. Quote it as evidence about Step 4 only.');
  o.push('');
  o.push('It is also a statement about **uniform values, not pixels**. A moved uniform may be invisible.');
  o.push('');
  o.push('## What is being differenced');
  o.push('');
  o.push('| rule | `condition.T_eq` for a `compositionClass === \'gas\'` body | every other body |');
  o.push('|---|---|---|');
  o.push('| **OLD** | `surfaceTemperatureOf(rec.T_eq, atmosphere.pressure)` — the grey-greenhouse fit, solved on Earth (1 bar) and Venus (92 bar), evaluated at the generator\'s 1000 bar envelope depth | same |');
  o.push('| **NEW** | `rec.T_eq` — the fit is not applied, because there is no surface for a surface pressure to be measured at | **identical to OLD, by construction** |');
  o.push('');
  o.push('Both are computed **by this tool** from the shipped `surfaceTemperatureOf` and the shipped');
  o.push('`atmosphereOpticsOf`, never by reading what the tree happens to do, so the table reproduces');
  o.push('before and after the guard lands. Only `T_eq` is substituted; the rest of the condition is the');
  o.push('real `conditionFromPlanet(rec)` output.');
  o.push('');
  o.push('## Population — fully specified');
  o.push('');
  o.push('⚠ §2\'s own history is that an under-specified population produced headline numbers that did not');
  o.push('reproduce. Every body below is a pure function of an integer seed and the recipe is stated in');
  o.push('full, so a disagreeing measurement can be attributed rather than argued about.');
  o.push('');
  o.push('| stratum | recipe | bodies | of which `compositionClass === \'gas\'` |');
  o.push('|---|---|---:|---:|');
  o.push(`| \`S\` | every planet of \`StarSystemGenerator.generate(seed)\`, seed = 1..${STEP4_POP.sysSeeds} | ${strataCount('S')} | ${gasIn('S')} |`);
  o.push(`| \`P\` | every **planet-class** moon (\`m.isPlanetMoon && m.planetData\`) found over seeds 1..${STEP4_POP.pmScanSeeds} | ${strataCount('P')} | ${gasIn('P')} |`);
  o.push(`| \`G\` | forced-type grid: \`PlanetGenerator.generate(new SeededRandom(${STEP4_POP.gridSeed} + cell*7919), au, null, null, type)\` over all ${PlanetGenerator.TYPES.length} \`PlanetGenerator.TYPES\` × ${STEP4_POP.gridOrbitsAU.length} orbits (${STEP4_POP.gridOrbitsAU.join(', ')} AU) | ${strataCount('G')} | ${gasIn('G')} |`);
  o.push(`| **total generated** | | **${rows.length}** | **${gasRows.length}** |`);
  o.push(`| \`SOL\` | \`generateSolarSystem()\` planets + planet-class moons — **reported separately, never pooled** | ${solRows.length} | ${solGas.length} |`);
  o.push('');
  o.push('**Exclusions, stated rather than left to inference:**');
  o.push('');
  o.push(`- Bodies whose generation threw: excluded by \`buildGeneratedPopulation\`'s final \`filter(b => b.rec)\`. On this run the three strata yielded ${gen.length} records and ${rows.length} of them derived a condition without throwing (**${gen.length - rows.length} excluded**).`);
  o.push('- **Non-planet-class moons are excluded**, and that is a scope statement, not a convenience:');
  o.push('  `MoonGenerator` emits ~none of the condition fields the world engine reads, and');
  o.push('  `tryLabShader` structurally excludes moons from this render path. They enter at Step 8.');
  o.push('- **Nothing is excluded on the basis of its measured delta.** The gas / non-gas split below is');
  o.push('  made by `compositionClass`, i.e. by the same predicate the guard itself keys on — which is');
  o.push('  what makes the non-gas rows a control rather than a leftover.');
  o.push(`- **Sol is a separate labelled population and is never pooled into the headline.** It is measured because a delta between two evaluations of a pure function of a data record is a fact about the function. ⛔ No Sol pixel was inspected; Sol renders from NASA textures through a different renderer and nothing here may be quoted as a rendering claim.`);
  o.push('');
  o.push(`**Reproduction:** the whole generated population was rebuilt from the same integer seeds and all five uniforms re-measured **per body** (not per headline): ${reproMismatch === 0 ? `**${reproN} / ${rows.length} bodies identical under both laws — PASS**` : `**MISMATCH on ${reproMismatch} bodies — FAIL**`}.`);
  o.push('');
  o.push('## The greenhouse factor this guard removes');
  o.push('');
  o.push(`Over the **${gasRows.length}** generated gas-class bodies, \`surfaceTemperatureOf(rec.T_eq, pressure) / rec.T_eq\`:`);
  o.push('');
  o.push('| | min | median | p95 | max |');
  o.push('|---|---:|---:|---:|---:|');
  o.push(`| greenhouse factor | ${fmt(gh.min)}× | **${fmt(gh.median)}×** | ${fmt(gh.p95)}× | **${fmt(gh.max)}×** |`);
  o.push('');
  o.push('## GENERATED, gas-class — the delta table');
  o.push('');
  o.push('|Δ| = |NEW − OLD| per body. Colour rows are the **max absolute channel delta**. No epsilon');
  o.push('anywhere: `moved` counts bodies whose delta is not exactly 0.');
  o.push('');
  o.push(limbTable(gasStats, gasRows.length));
  o.push('');
  const le = gasStats.get('uLimbExponent');
  o.push(`\`uLimbExponent\`'s entire law range is **1.8 – 3.5** (\`atmosphereOptics.js:161\` \`limbExponent: 3.5 - 1.7 * thick,\`), i.e. a span of 1.7 — so read its max |Δ| of ${fmt(le.max)} against that span, not against zero.`);
  o.push('');
  o.push('### The gas bodies that did NOT move — accounted for, not rounded off');
  o.push('');
  const gasStill = gasRows.filter(r => sameUniforms(r.m.old, r.m.neu));
  const gasStillNoP = gasStill.filter(r => (r.m.pressure ?? 0) <= 0).length;
  const gasStillP = gasStill.length - gasStillNoP;
  const gasStillPrimZero = gasStill.filter(r => (r.m.pressure ?? 0) > 0
    && AOPT.primordialFractionOf({ ...r.cond, T_eq: r.m.tOld }) === 0).length;
  const expOnlyStill = gasRows.filter(r => deltaOf(r.m.old.uLimbExponent, r.m.neu.uLimbExponent) === 0
                                        && deltaOf(r.m.old.uLimbColor, r.m.neu.uLimbColor) !== 0).length;
  o.push(`**${gasStill.length} of ${gasRows.length}** gas bodies move none of the five uniforms. A row of "moved" counts with no`);
  o.push('account of the residue is how a partial mechanism gets read as a total one, so:');
  o.push('');
  o.push(`- **${gasStillNoP}** carry \`atmosphere.pressure == 0\`. The greenhouse factor is exactly 1 there by`);
  o.push('  construction (`P = 0 ⇒ tau = 0`), so OLD and NEW are the *same number* and the guard has nothing');
  o.push('  to remove. These are not bodies the guard failed on; they are bodies it was already correct on.');
  o.push(`- **${gasStillP}** carry a non-zero pressure and still do not move — and **${gasStillPrimZero} of those ${gasStillP}** have`);
  o.push('  `primordialFractionOf(cond) == 0`.');
  o.push('');
  if (gasStillPrimZero > 0) {
    o.push('⚠⚠ **THAT IS A SECOND DISAGREEMENT, NOT A ROUNDING — and it is worth more than the row it sits in.**');
    o.push('`compositionClass` calls a body `\'gas\'` on ONE test: `atmosphere.composition === \'h2-he\'`, a');
    o.push('label the generator wrote. `primordialFractionOf` asks a physical question instead — the Jeans');
    o.push('escape parameter λ_H2 = m·v_esc²/(2kT_exo) against `LAMBDA_H2_LO`/`LAMBDA_H2_HI` — and answers');
    o.push(`**"this body cannot hold hydrogen"** for ${gasStillPrimZero} of the ${gasRows.length} bodies the label calls a hydrogen envelope.`);
    o.push('With `prim == 0` the deck ramp is mixed in at weight zero, `thickHaze` collapses, and the optics');
    o.push('stop reading `T_eq` at all — which is why the guard is invisible on exactly these bodies.');
    o.push('');
    o.push('**Two engine functions disagree about which bodies have a hydrogen envelope.** That is this');
    o.push('codebase\'s "one quantity, two answers" shape, and it is *out of scope for item 4*: the guard is');
    o.push('correct to key on `compositionClass`, because that is the predicate the vector itself classifies');
    o.push('on at body-condition-vector.js:107 `const _class = compositionClass(`, and a second opinion at');
    o.push('this seam would be the defect, not the fix.');
    o.push('It is recorded here so the next step that reads either function inherits a named');
    o.push('finding rather than rediscovering it against the wrong commit.');
    o.push('');
  }
  o.push(`Separately, **${expOnlyStill}** gas bodies move a \`uLimbColor\` channel while \`uLimbExponent\` stays put — the`);
  o.push('exponent is a function of `thickHaze`, which saturates at 1.0 on a deep envelope, so both');
  o.push('temperatures can land on the same clamped exponent while the hue ramp underneath still moves.');
  o.push('That is why the two "moved" counts differ, and why quoting only the exponent count would');
  o.push('understate the change.');
  o.push('');
  o.push('### ⚠ The affected set is NOT the game\'s `gas-giant` types — it crosses them');
  o.push('');
  o.push('A reviewer reading a failing byte-identity fence will see bodies labelled `rocky`, `crystal` and');
  o.push('`ice` in the moved list and reasonably suspect a leak. It is not one, and the check is mechanical:');
  o.push('**every** body the guard touches carries `atmosphere.composition === \'h2-he\'`, because that is the');
  o.push('one test `compositionClass` applies. The game `type` label is not consulted anywhere on this path —');
  o.push('which is the adapter\'s stated doctrine, not an accident of it.');
  o.push('');
  const gasByType = new Map(), allByType = new Map();
  for (const r of rows) {
    const t = r.body.type ?? '(none)';
    allByType.set(t, (allByType.get(t) || 0) + 1);
    if (r.m.gas) gasByType.set(t, (gasByType.get(t) || 0) + 1);
  }
  const notH2He = gasRows.filter(r => r.cond.atmosphere?.composition !== 'h2-he').length;
  const h2heNotGas = nonGasRows.filter(r => r.cond.atmosphere?.composition === 'h2-he').length;
  o.push(`- gas-class bodies whose \`atmosphere.composition\` is **not** \`'h2-he'\`: **${notH2He}**`);
  o.push(`- \`'h2-he'\` bodies that are **not** gas-class: **${h2heNotGas}**`);
  o.push(`- so the affected set and the \`'h2-he'\` set are ${notH2He === 0 && h2heNotGas === 0 ? '**the same set, exactly**' : '**NOT the same set — investigate before reading anything below**'}.`);
  o.push('');
  o.push('Game `type` labels inside the affected set, which is the part that looks wrong and is not:');
  o.push('');
  o.push('| game `type` | gas-class | total in population |');
  o.push('|---|---:|---:|');
  for (const [t, c] of [...gasByType.entries()].sort((a, b) => b[1] - a[1])) {
    o.push(`| \`${t}\` | ${c} | ${allByType.get(t)} |`);
  }
  o.push('');
  o.push('## GENERATED, non-gas — the control');
  o.push('');
  o.push('The guard is supposed to be **exactly inert** outside the gas class.');
  o.push('');
  o.push(limbTable(nonGasStats, nonGasRows.length));
  o.push('');
  o.push(`⛔ **A column of zeros here proves nothing on its own** — it is what a comparator that is not wired also prints. So the SAME comparator, on the SAME ${live.n} non-gas bodies, was handed a moved \`T_eq\`:`);
  o.push('');
  o.push('| probe | what it changes | non-gas bodies it moved |');
  o.push('|---|---|---:|');
  o.push(`| near | \`T_eq\` → \`T_eq + ${live.deltaK}\` K | **${live.movedNear} / ${live.n}** |`);
  o.push(`| wide | \`T_eq\` = ${LIVE_T_LO} K vs ${LIVE_T_HI} K — spans every anchor in both hue ramps | **${live.movedWide} / ${live.n}** |`);
  o.push('');
  o.push(live.movedWide > 0
    ? '**The comparator is wired.** The zeros in the table above are therefore a fact about the guard, not about the instrument.'
    : '⛔ **ZERO under a full-range probe — the comparator is blind and the control table above is meaningless.**');
  o.push('');
  o.push('⚠ **And the fraction is not 100%, which is a fact about the optics law and is stated rather than');
  o.push('quietly dropped.** `T` reaches these five uniforms through exactly two doors: `hazeFractionOf`,');
  o.push('and `primordialFractionOf` — whose Jeans λ carries `T_exo = 3.5·T_eq` in its denominator, so it');
  o.push('is temperature-dependent on a **solid** body too. Both doors are evaluated at both probe');
  o.push('temperatures and counted:');
  o.push('');
  o.push('| non-gas subset | n | moved under the wide probe |');
  o.push('|---|---:|---:|');
  o.push(`| at least one door open at some probe temperature | ${live.canMove} | **${live.wideAmongCanMove}** |`);
  o.push(`| both doors shut at both ends (\`haze == 0\` and \`prim == 0\`) | ${live.tIndependent} | ${live.tIndependent - live.tIndepAndStill} |`);
  o.push('');
  o.push(`Of the ${live.tIndependent} bodies with both doors shut, **${live.tIndepAndStill}** did indeed not move — ${live.tIndependent === 0 ? 'n/a' : ((100 * live.tIndepAndStill) / live.tIndependent).toFixed(1) + '%'} agreement between the`);
  o.push('mechanism and the observation. That agreement is why the shortfall is attributed to the law');
  o.push('rather than offered as an excuse for it.');
  o.push('');
  o.push('⚠ **The first version of this decomposition was WRONG and is recorded rather than replaced.** It');
  o.push('predicted temperature-blindness from the haze gates alone (`volatileFraction > HAZE_VOL_LO` or');
  o.push('`pressure > HAZE_P_THICK`) and called **425** of these bodies blind against **285** observed — it');
  o.push('had missed that `primordialFractionOf` reads temperature. A predicate that over-predicts the');
  o.push('blind set by 140 bodies is exactly how a real shortfall gets explained away, so the model was');
  o.push('replaced by the measurement above rather than tuned.');
  o.push('');
  o.push('## ACYCLICITY — why classifying first and setting `T_eq` second is well-defined');
  o.push('');
  o.push('The guard runs `compositionClass` **before** it decides `T_eq`, because its answer is one of');
  o.push('the fp\'s own fields. That ordering is sound only while the composition gate does not itself read');
  o.push('temperature — and that is a property of a function in another file. So it is checked, not assumed:');
  o.push('every body is classified at **100 K and at 1500 K** and the two answers must agree.');
  o.push('');
  o.push(`**${acyc.n - acyc.disagreed} / ${acyc.n}** bodies classified identically at both temperatures. ${acyc.disagreed === 0 ? 'The gate is temperature-independent, so the ordering is acyclic and the guard is a single pass.' : `⛔ **${acyc.disagreed} DISAGREED** — the composition gate now reads temperature, the guard is a fixpoint, and it must be rewritten rather than reordered. Examples: ${acyc.examples.join('; ')}.`}`);
  o.push('');
  o.push('## MATERIAL CROSS-CHECK — the control that makes the rest admissible');
  o.push('');
  o.push('Three of the five uniforms come out of the shipped `atmosphereOpticsOf`, but `uTermStrength`');
  o.push('and `uTermWidth` are finished by expressions that live in `src/objects/Planet.js` and are not');
  o.push('exported, so this tool transcribes them. A transcription is exactly the kind of thing that is');
  o.push('true when written and misleading later. So it is not trusted: every body is built as a real');
  o.push('`new Planet(rec)` and the five recomputed values are compared against');
  o.push('`planet.surface.material.uniforms`, exactly, with no tolerance.');
  o.push('');
  o.push('| | count |');
  o.push('|---|---:|');
  o.push(`| bodies built as a real \`Planet\` | ${xc.built} |`);
  o.push(`| construction failed | ${xc.failed} |`);
  o.push(`| live material matched **neither** law (⇒ the transcription has drifted) | **${xc.matchesNeither}**${xc.neitherIds.length ? ' — e.g. ' + xc.neitherIds.join(', ') : ''} |`);
  o.push(`| bodies where OLD and NEW **differ at all** (the discriminating set) | ${xc.discriminating} |`);
  o.push(`| …of those, live material == **NEW** | ${xc.dNew} |`);
  o.push(`| …of those, live material == **OLD** | ${xc.dOld} |`);
  o.push(`| …of those, live material == neither | ${xc.dNeither} |`);
  o.push('');
  o.push(`**Verdict: this tree implements \`${xc.treeLaw}\`.** That is read off the shipped material, not off the`);
  o.push('source text — which is what lets `node tools/port-condition-delta.mjs --step4 --check` go red the');
  o.push('moment the guard is reverted, and is the executed control §11.3.3 asks for.');
  o.push('');
  o.push('## ⚠ UNDECLARED MOVERS — what else the guard moves, measured because Instrument C will show it');
  o.push('');
  o.push('Step 4\'s gate names five uniforms. `condition.T_eq` is not read only by `atmosphereOpticsOf`:');
  o.push('it also reaches the `WORLDENGINE_BAKES` that `PlanetGenerator.generate` writes onto the record,');
  o.push('and the biosphere pair, all of which become shipped uniforms of their own. Those are **watched by');
  o.push('Instrument C**, so they appear in its diff whether or not this table names them. A delta table');
  o.push('that publishes five movers while the instrument publishes thirteen is exactly the true-and-');
  o.push('misleading shape this program keeps catching, so they are named here.');
  o.push('');
  o.push('Same gas-class population, same |Δ| rule. The middle column is the join key against Instrument');
  o.push('C\'s output (`npm run port-uniform-delta:check`), so the two can be read against each other');
  o.push('instead of being taken on trust:');
  o.push('');
  o.push('| quantity | shipped uniform it becomes | moved / n | median |Δ| | max |Δ| |');
  o.push('|---|---|---:|---:|---:|');
  for (const k of STEP4_QUANTITY_ORDER) {
    const s = gasBakes.get(k);
    if (s.moved === 0) continue;
    o.push(`| \`${k}\` | ${UNIFORM_OF_QUANTITY[k] ? '`' + UNIFORM_OF_QUANTITY[k] + '`' : '—'} | ${s.moved} / ${gasRows.length} | ${fmt(s.median)} | ${fmt(s.max)} |`);
  }
  const bakeZeros = STEP4_QUANTITY_ORDER.filter(k => gasBakes.get(k).moved === 0);
  o.push('');
  o.push(`Quantities that read exactly 0 on all ${gasRows.length} gas bodies (${bakeZeros.length}): ${bakeZeros.map(k => '`' + k + '`').join(', ') || '—'}`);
  o.push('');
  const shippedExtra = STEP4_QUANTITY_ORDER.filter(k => gasBakes.get(k).moved > 0
    && UNIFORM_OF_QUANTITY[k] && !UNIFORM_OF_QUANTITY[k].startsWith('('));
  o.push(`**${shippedExtra.length} shipped uniforms beyond the declared five** therefore move under this guard:`);
  o.push(shippedExtra.map(k => '`' + UNIFORM_OF_QUANTITY[k] + '`').join(', ') + '.');
  o.push('`landPalette.craton` is measured and moves too, but it is not written to any uniform, so it is');
  o.push('listed above and excluded from that count.');
  o.push('');
  o.push('⚠ **The counts here and Instrument C\'s will not match body-for-body, and should not be expected');
  o.push('to.** Instrument C runs its own 526-body population; this table runs the one declared above. The');
  o.push('claim they jointly support is *which* uniforms move and by roughly what magnitude — not a shared');
  o.push('per-body count. Two things do corroborate exactly, across two independently written harnesses:');
  o.push('`uLimbExponent`\'s maximum |Δ| of 1.7 (the law\'s entire 1.8–3.5 span), and `uTermStrength` /');
  o.push('`uTermWidth` reading **zero on both**.');
  o.push('');
  o.push('## SOL — second population, clearly labelled');
  o.push('');
  o.push('⛔ **Pure-function arithmetic on data records, and nothing else.** No Sol pixel was inspected.');
  o.push('Sol renders from NASA photographic textures through a different renderer and its bodies carry no');
  o.push('world-engine condition fields, so it cannot validate procgen or rendering. It is measured here');
  o.push('because the plan names two Sol bodies as members of the affected population, and because a delta');
  o.push('between two evaluations of a pure function of a record is a fact about the function.');
  o.push('');
  o.push(`Sol bodies: **${solRows.length}**, of which **${solGas.length}** are \`compositionClass === 'gas'\`.`);
  o.push('');
  o.push('### ⛔⛔ READ THIS BEFORE READING THE SOL NUMBERS: Sol has no `T_eq` at all');
  o.push('');
  o.push(`\`rec.T_eq\` is **absent on ${solDefaulted} / ${solRows.length}** Sol bodies — against **${genDefaulted} / ${rows.length}** generated ones. \`SolarSystemData.js\``);
  o.push('does not author an equilibrium temperature, so `d.T_eq ?? 288` fires and every Sol body enters this');
  o.push('table at **288 K**, which `conditionFromPlanet`\'s own `_provenance.T_eq` correctly reports as');
  o.push('`\'defaulted\'`. **The Sol rows below are therefore arithmetic about the number 288, not about');
  o.push('Uranus.** They are published because the plan names Uranus and Neptune as members of the affected');
  o.push('population and that claim deserves a checked answer — and the checked answer is that the guard');
  o.push('does move their uniforms, on a temperature the game invented for them. ⛔ Do not quote a Sol');
  o.push('magnitude as a physical result, and do not let the two identical rows below read as agreement');
  o.push('between two independent bodies: they are identical *because* both bodies are the same 288 K.');
  o.push('');
  o.push(limbTable(solGasStats, solGas.length));
  o.push('');
  o.push('| named body | identified by | gas-class | `rec.T_eq` | OLD `T_eq` | NEW `T_eq` | Δ`uLimbExponent` | max Δ channel `uLimbColor` |');
  o.push('|---|---|---|---:|---:|---:|---:|---:|');
  for (const spec of SOL_NAMED) {
    const r = namedSol(spec);
    if (!r) { o.push(`| ${spec.label} | orbit ${spec.orbitAU} AU + R ${spec.radiusEarth} R⊕ | _no match — \`SolarSystemData.js\` has been edited_ | | | | | |`); continue; }
    o.push(`| ${spec.label} | orbit ${spec.orbitAU} AU + R ${spec.radiusEarth} R⊕ | ${r.m.gas ? 'yes' : '**no**'} | ${r.m.tEqDefaulted ? '**absent ⇒ 288**' : fmt(r.m.rawTeq)} | ${fmt(r.m.tOld)} | ${fmt(r.m.tNew)} | ${fmt(deltaOf(r.m.old.uLimbExponent, r.m.neu.uLimbExponent))} | ${fmt(deltaOf(r.m.old.uLimbColor, r.m.neu.uLimbColor))} |`);
  }
  o.push('');
  o.push('⚠ **Jupiter and Saturn are NOT in the affected population, and that is a finding rather than an');
  o.push('omission.** Both are authored as `type: \'gas-giant\'` with **no atmosphere block at all**, so');
  o.push('`compositionClass` never sees an `h2-he` composition and does not return `\'gas\'` for them. The');
  o.push('guard is inert on the two largest bodies in Sol. Uranus and Neptune are affected only because');
  o.push('they are authored as `sub-neptune` **with** a 1000-bar `h2-he` block. The plan names exactly');
  o.push('those two, and this run agrees with it.');
  o.push('');
  o.push('---');
  o.push('');
  o.push('_Regenerate: `node tools/port-condition-delta.mjs --step4`. Gate: `--step4 --check`._');
  o.push('');

  const text = o.join('\n');
  if (args.includes('--stdout')) console.log(text);
  else if (!args.includes('--check')) {
    const dest = path.join(ROOT, 'docs/FEATURES/step4-limb-delta-table.md');
    fs.writeFileSync(dest, text);
    console.log(`wrote ${path.relative(ROOT, dest)}`);
  }

  console.log('');
  console.log(`STEP 4 · generated n=${rows.length} (gas ${gasRows.length}, non-gas ${nonGasRows.length})  sol n=${solRows.length} (gas ${solGas.length})`);
  console.log(`greenhouse factor on gas: median ${fmt(gh.median)}x  max ${fmt(gh.max)}x`);
  for (const k of LIMB_UNIFORM_ORDER) {
    const s = gasStats.get(k);
    console.log(`  ${k.padEnd(14)} moved ${String(s.moved).padStart(4)}/${gasRows.length}  median ${fmt(s.median)}  max ${fmt(s.max)}`);
  }
  console.log(`non-gas control: moved ${LIMB_UNIFORM_ORDER.map(k => nonGasStats.get(k).moved).join('/')} of ${nonGasRows.length}; liveness near ${live.movedNear}/${live.n}, wide ${live.movedWide}/${live.n} (${live.tIndependent} structurally T-blind)`);
  console.log(`material cross-check: built ${xc.built}, failed ${xc.failed}, neither ${xc.matchesNeither}, discriminating ${xc.discriminating} (NEW ${xc.dNew} / OLD ${xc.dOld}) => tree implements ${xc.treeLaw}`);
  console.log(`acyclicity: ${acyc.n - acyc.disagreed}/${acyc.n} classified identically at 100K and 1500K`);
  console.log(`reproduction: ${repro ? 'PASS' : 'FAIL'} (${reproN} bodies re-measured, ${reproMismatch} mismatches)`);

  // ── EXIT RULES ─────────────────────────────────────────────────────────────────────────────
  let rc = 0;
  const fail = (msg) => { console.error(msg); rc = Math.max(rc, 2); };
  if (xc.matchesNeither > 0) fail(`CONTROL FAILED: ${xc.matchesNeither} bodies matched NEITHER law — the Planet.js transcription in this tool has drifted. Every delta above is suspect.`);
  if (xc.discriminating === 0) fail('CONTROL FAILED: OLD and NEW produce identical uniforms on every body. The differential is not wired.');
  if (live.movedWide === 0) fail('CONTROL FAILED: the non-gas liveness probe moved nothing even under a full-range T sweep — the non-gas zero column is vacuous.');
  if (!repro) fail(`CONTROL FAILED: the table did not reproduce on a second build (${reproMismatch} mismatching bodies).`);
  if (acyc.disagreed > 0) fail(`CONTROL FAILED: compositionClass returned different classes at 100 K vs 1500 K on ${acyc.disagreed} bodies — the composition gate now reads temperature, so conditionFromPlanet's classify-then-set-T_eq ordering is a fixpoint. The guard must be rewritten, not reordered.`);
  // §11.3.6 — a declared pixel-moving step's named movers must move.
  const declaredMovers = ['uLimbExponent', 'uLimbColor', 'uTermColor'];
  for (const k of declaredMovers) {
    if (gasStats.get(k).moved === 0) { console.error(`§11.3.6: declared mover ${k} did not move on any of ${gasRows.length} gas bodies.`); rc = Math.max(rc, 1); }
  }
  // uTermStrength / uTermWidth are NAMED BY THE GATE and measured at exactly zero. Their zero is a
  // fact about the laws, not a blind comparator: both read ONLY atmosphere.pressure, which the guard
  // does not touch. Said out loud rather than left as an unexplained blank row.
  for (const k of ['uTermStrength', 'uTermWidth']) {
    if (gasStats.get(k).moved === 0) {
      console.error(`NOTE §11.3.6: ${k} is named by Step 4's gate and moved on 0/${gasRows.length}. Expected — it is a function of atmosphere.pressure alone (columnFractionOf / termWidthFor), and the guard changes only T_eq. Exit code unaffected.`);
    }
  }
  if (args.includes('--check')) {
    if (xc.treeLaw !== 'NEW') {
      console.error(`GATE FAILED: the live material implements ${xc.treeLaw}, not NEW. The no-surface guard in src/worldengine/port/conditionFromPlanet.js is absent, reverted or not reaching the material.`);
      rc = Math.max(rc, 1);
    } else {
      console.log('GATE: the live material implements NEW — the no-surface guard is landed and reaching the shipped uniforms.');
    }
  }
  process.exit(rc);
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// REPORT
// ══════════════════════════════════════════════════════════════════════════════════════════════
function gitHead() {
  try { return execFileSync('git', ['-C', ROOT, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim(); }
  catch { return 'unknown'; }
}

function tableFor(m) {
  const lines = [];
  lines.push('| quantity | moved / n | min | median | p95 | max |');
  lines.push('|---|---:|---:|---:|---:|---:|');
  for (const k of QUANTITY_ORDER) {
    const s = m.stats.get(k);
    lines.push(`| \`${k}\` | ${s.moved} / ${s.n} | ${fmt(s.min)} | ${fmt(s.median)} | ${fmt(s.p95)} | ${fmt(s.max)} |`);
  }
  return lines.join('\n');
}

function main() {
  const args = process.argv.slice(2);
  const unknown = args.filter(a => !['--stdout', '--selftest', '--step4', '--check'].includes(a));
  if (unknown.length) { console.error(`usage: node tools/port-condition-delta.mjs [--stdout|--selftest] | --step4 [--stdout|--check]`); process.exit(64); }
  if (args.includes('--check') && !args.includes('--step4')) {
    console.error('--check is only defined for --step4 (Step 2 has no tree-state gate; see this file\'s header).');
    process.exit(64);
  }

  if (args.includes('--step4')) { runStep4(args); return; }   // async; exits itself

  if (args.includes('--selftest')) process.exit(runSelftest() ? 0 : 3);

  const gen = buildGeneratedPopulation(DEFAULT_POP);
  const sol = buildSolPopulation();
  const mGen = measure(gen, 'GENERATED');
  const mSol = measure(sol, 'SOL');

  // Determinism: rebuild from the same seeds, require the same headline number.
  const mGen2 = measure(buildGeneratedPopulation(DEFAULT_POP), 'GENERATED(again)');
  const det = mGen2.n === mGen.n
    && mGen2.stats.get('rawTidalIoRatio').max === mGen.stats.get('rawTidalIoRatio').max
    && mGen2.stats.get('rawTidalIoRatio').moved === mGen.stats.get('rawTidalIoRatio').moved;

  const fp = footprintProbe(gen.slice(0, 120));
  const cd = craterDiagnostic(gen);
  const sCount = gen.filter(b => b.stratum === 'S').length;
  const sMut = gen.filter(b => b.stratum === 'S' && b.orbitMutated).length;
  const solOrbitMutatedNote = `${sMut} of the ${sCount} \`S\` bodies sit in a system where that happened.`;

  // Per-stratum ratio breakdown, for the plan-agreement section. The plan's figure was measured
  // over "161 generated planets" — closest to stratum S alone, not to the whole population.
  const byStratum = {};
  for (const s of ['S', 'P', 'G']) {
    const sub = gen.filter(b => b.stratum === s);
    if (sub.length) byStratum[s] = measure(sub, s);
  }

  const head = gitHead();
  const out = [];
  out.push('# Step 2 — the committed delta table: forwarding the real tidal heating');
  out.push('');
  out.push('> **Generated artifact — do not hand-edit.** Regenerate with `node tools/port-condition-delta.mjs`.');
  out.push('> The gate for Step 2 of `docs/FEATURES/one-pipeline-two-frontends-PLAN.md` (PLAN.md:199).');
  out.push('> This step is a **declared pixel-moving step** (§11.3.6): its named movers *must* move, and a');
  out.push('> table of zeros here is a failure, not a pass.');
  out.push('');
  out.push(`**Tree at generation:** \`${head}\` · **generated:** ${new Date().toISOString().slice(0, 10)}`);
  out.push('');
  out.push('## What is being differenced');
  out.push('');
  out.push('Both rules are computed **by this tool**, through the shipped `bodyRawTidal`');
  out.push('(`src/worldengine/base/baseStep.js`), so the table reads the same before and after the port');
  out.push('edit lands and can be re-run at any time:');
  out.push('');
  out.push('| rule | bundle handed to `bodyRawTidal` | what baseStep then does |');
  out.push('|---|---|---|');
  out.push('| **OLD** | `{radiusEarth, eccentricity}` | falls back to its own `starMassEarth = 332946`, `orbitRadiusEarth = 23455` — **1 M☉ at 1 AU, for every body in the galaxy** |');
  out.push('| **NEW** | `+ {tidalHeat: d.tidalHeating, starMassEarth, orbitRadiusEarth}` | takes the D12 value when present; when genuinely absent, runs the same fallback against the body\'s **real** star and orbit |');
  out.push('');
  out.push('The condition itself is the real one — `conditionFromPlanet(rec)` — with `rawTidalIoRatio`');
  out.push('substituted. That substitution is licensed by the FOOTPRINT PROBE below, not assumed.');
  out.push('');
  out.push('## Population');
  out.push('');
  out.push(`- **GENERATED — ${mGen.n} bodies** (target ≥300). Three strata, every one a pure function of an integer seed:`);
  out.push(`  \`S\` all planets of \`StarSystemGenerator.generate(seed)\` for seed 1..${DEFAULT_POP.sysSeeds}; \`P\` the rare planet-class moons harvested over seeds 1..${DEFAULT_POP.pmScanSeeds}; \`G\` a forced-type grid over all ${PlanetGenerator.TYPES.length} types × ${DEFAULT_POP.gridOrbitsAU.length} orbits (${DEFAULT_POP.gridOrbitsAU.join(', ')} AU).`);
  out.push(`  Determinism: a second build from the same seeds gave the same population size and the same \`rawTidalIoRatio\` headline — **${det ? 'PASS' : 'FAIL'}**.`);
  out.push(`- **SOL — ${mSol.n} bodies**, reported separately below.`);
  out.push('');
  out.push('## GENERATED — delta table');
  out.push('');
  out.push('Delta = |NEW − OLD| per body; colour/palette rows are the max absolute channel delta.');
  out.push('No epsilon anywhere: `moved` counts bodies whose delta is not exactly 0.');
  out.push('');
  out.push('⚠ **Read the magnitude column, not just the moved count.** The four `landPalette` rows move on a');
  out.push('handful of bodies at ~1e-5 in linear RGB — real, and far below anything a frame could show. The');
  out.push('two lava colours are the substantive move: they change on most of the population and by up to');
  out.push('~0.08 per channel. Reporting "landPalette moves" without the magnitude would overstate this step.');
  out.push('');
  out.push(tableFor(mGen));
  out.push('');
  out.push('## Controls (§11.3.3 — every measurement carries a control that moved)');
  out.push('');
  const rt = mGen.stats.get('rawTidalIoRatio');
  out.push(`### 1. The moved control`);
  out.push('');
  out.push(`\`rawTidalIoRatio\` moved on **${rt.moved} / ${rt.n}** generated bodies. ` +
    (rt.moved === 0
      ? '**ZERO — the differential is NOT WIRED. Every other row in this table is meaningless.**'
      : 'The differential is wired; the rows that read 0 below are facts about the laws, not about a blind comparator.'));
  out.push('');
  const movers = QUANTITY_ORDER.filter(k => mGen.stats.get(k).moved > 0);
  const zeros  = QUANTITY_ORDER.filter(k => mGen.stats.get(k).moved === 0);
  out.push(`Quantities that moved on ≥1 body (${movers.length}): ${movers.map(k => '`' + k + '`').join(', ') || '—'}`);
  out.push('');
  out.push(`Quantities that read exactly 0 on all ${rt.n} (${zeros.length}): ${zeros.map(k => '`' + k + '`').join(', ') || '—'}`);
  out.push('');
  out.push('### 2. The genuinely-absent case');
  out.push('');
  out.push(`\`d.tidalHeating\` is **present on ${mGen.present} / ${mGen.n}** generated bodies and **absent on ${mGen.absent}**.`);
  if (mGen.absent === 0) {
    out.push('');
    out.push('⚠ **The absent branch is empty on this population, and that is a real finding, not a gap in the');
    out.push('harness.** `PlanetGenerator` writes `tidalHeating` on every record it returns, and `MoonGenerator`');
    out.push('does the same for planet-class moons — so on generated bodies the NEW rule always takes the D12');
    out.push('value and the corrected fallback is never *reached*. Two consequences, both stated rather than');
    out.push('smoothed over:');
    out.push('');
    out.push('- Forwarding `starMassEarth` / `orbitRadiusEarth` buys **nothing on today\'s generated population**.');
    out.push('  It is insurance for the bodies that do not carry a D12 value — Sol\'s (below), hand-authored');
    out.push('  records, and the moons Step 8 brings through `conditionFromBody`.');
    out.push('- So the split alone is not evidence the forwarding does anything. The counterfactual below is.');
  }
  out.push('');
  out.push('**Counterfactual — the same bodies with the D12 value deliberately withheld**, so the fallback is');
  out.push('the branch taken. OLD fallback (1 M☉ at 1 AU) vs CORRECTED fallback (real star, real orbit):');
  out.push('');
  const fc = mGen.fallbackCorrection;
  out.push('| | moved / n | min | median | p95 | max |');
  out.push('|---|---:|---:|---:|---:|---:|');
  out.push(`| |Δ| of the fallback itself | ${fc.moved} / ${fc.n} | ${fmt(fc.min)} | ${fmt(fc.median)} | ${fmt(fc.p95)} | ${fmt(fc.max)} |`);
  out.push('');
  out.push('And the check that the forwarded pair is the *right* pair — relative error between the corrected');
  out.push('fallback and the body\'s own `d.tidalHeating`, over the bodies with a non-zero D12 value. This is');
  out.push('the strongest available evidence that `starMassEarth`/`orbitRadiusEarth` are the correct two');
  out.push('quantities to forward: `PhysicsEngine.js` `tidalHeatingPlanet` is the SAME Peale–Cassen–Reynolds');
  out.push('law the baseStep fallback runs, so a correctly-forwarded pair must reproduce the D12 value.');
  out.push('Reported per stratum, because the three strata answer differently and one number would hide it:');
  out.push('');
  out.push('| stratum | n (D12 > 0) | agrees to float noise (rel. err ≤ 1e-12) | real misses | of those, in a system whose orbits were rewritten | max rel. err |');
  out.push('|---|---:|---:|---:|---:|---:|');
  for (const [st, m] of Object.entries(byStratum)) {
    const d = m.d12VsCorrected;
    out.push(`| \`${st}\` | ${d.n} | ${d.n - m.d12RealMiss} / ${d.n} | ${m.d12RealMiss} | ${m.d12RealMissMutated} | ${fmt(d.max)} |`);
  }
  out.push('');
  out.push('Read the three rows separately — the two non-zero ones are findings, not noise:');
  out.push('');
  out.push('- **`G` reproduces it to float noise** (max ~3e-16). This is the clean case: the grid generates at');
  out.push('  a known orbit under a 1 M☉ default (`PlanetGenerator.js:372` `zones?.starMassSolar || 1.0`),');
  out.push('  nothing rewrites either afterwards, and the forwarded pair reconstructs the D12 value exactly.');
  out.push('  **The forwarding is correct.**');
  out.push(`- **\`S\` reproduces it exactly on most bodies and misses on the rest** — and the miss is not a bug in`);
  out.push('  the forwarding. `StarSystemGenerator` rewrites `orbitRadiusAU` **after** `PlanetGenerator` has');
  out.push('  already computed `tidalHeating`: resonance-chain snapping and migration both move a planet, and');
  out.push(`  ${solOrbitMutatedNote} So the record\'s D12 value describes the body's`);
  out.push('  **pre-snap** orbit while the wrapper reports the post-snap one. The correlation is close to');
  out.push(`  total: of the ${byStratum.S.d12RealMiss} real misses in \`S\`, **${byStratum.S.d12RealMissMutated}** are in a system whose orbits were rewritten.`);
  out.push(`  ⚠ **${byStratum.S.d12RealMiss - byStratum.S.d12RealMissMutated} is not**, and that residue is NOT explained here — it is left on the record`);
  out.push('  rather than rounded away, because a mechanism that accounts for 40 of 41 cases is exactly the');
  out.push('  kind of story that gets treated as accounting for 41.');
  out.push('  ⚠ **The ordering itself is a real finding about the game\'s own physics, independent of Step 2** —');
  out.push('  `planetData.tidalHeating` is stale on every resonance-snapped or migrated planet. It does not');
  out.push('  affect the delta table (the NEW rule takes `d.tidalHeating` whatever orbit produced it), and it');
  out.push('  is not fixed here.');
  out.push('- **`P` (planet-class moons) never reproduces it**, and this one matters for Step 8.');
  out.push('  `MoonGenerator` `_computeTidalHeating` draws a *dedicated* moon eccentricity from its own seed');
  out.push('  (`moonecc:…`) and feeds THAT to `tidalHeating()`. The value never lands on the record — the');
  out.push('  moon record\'s `eccentricity` field is a different draw entirely. So for a moon there is no pair');
  out.push('  of forwardable record fields that reconstructs its D12 value: the eccentricity that produced it');
  out.push('  is not on the record. **Forwarding `starMassEarth`/`orbitRadiusEarth` is therefore necessary but');
  out.push('  not sufficient for moons**, and Step 8\'s `conditionFromBody` will need the moon eccentricity');
  out.push('  surfaced (or the D12 value taken as authoritative and the fallback never relied on).');
  out.push('');
  out.push('### 2b. ⚠ THE CRATER UNIFORMS DO NOT MOVE — diagnosed, with its own control');
  out.push('');
  out.push('Step 2\'s gate names *"plus the crater uniforms"* among the quantities to publish, on the');
  out.push('reasoning that `rawTidalIoRatio` feeds `craterSchedule`\'s `tExp` (`bombardment.js:174-176`).');
  out.push(`**Measured: every crater uniform reads exactly 0 on ${cd.n} / ${cd.n} bodies.** That is a real`);
  out.push('result, not a blind comparator, and three separate measurements say so:');
  out.push('');
  out.push(`- **Craters are on at all on only ${cd.cratersOn} / ${cd.n} bodies.** \`craterUniformsFrom\` returns`);
  out.push('  `CRATERS_OFF` unless the schedule fires, the resolvable band is non-empty and');
  out.push('  `density ≥ CRATER_MIN_DENSITY`. A uniform that is off almost everywhere cannot move almost');
  out.push('  anywhere.');
  out.push(`- **The chain CAN see a tidal move.** Forcing \`rawTidalIoRatio\` 0 → 1e5 on the same conditions`);
  out.push(`  moves \`craterSchedule\` on **${cd.scheduleMovedOnForcedSwing} / ${cd.n}** bodies and the crater uniforms on`);
  out.push(`  **${cd.movedOnForcedSwing} / ${cd.n}** — i.e. on every body that has craters at all. The comparator is wired.`);
  out.push('- **Why the real delta is nevertheless zero.**');
  out.push('  `tExp = min(age, T_RESURF_TIDAL/td, T_RESURF_ERODE/erosion)` is a **min of three**. The tidal');
  out.push('  term only binds once `td` is large enough to pull `0.7/td` under the other two. Argmin of');
  out.push(`  \`tExp\` under the NEW rule: **age ${cd.bind.age}**, **erosion ${cd.bind.erosion}**, **tidal ${cd.bind.tidal}**`);
  out.push(`  (of ${cd.n}); the tidal term is the binding constraint under *either* rule on **${cd.tidalBindsUnderEither}** bodies.`);
  out.push('  At the Io-ratios this population actually carries, tides are not what limits crater');
  out.push('  retention — age and erosion are — so changing `td` slides a term that is not the minimum.');
  out.push('');
  out.push('**What this means for the plan.** Step 2\'s *"why now, hoisted"* argument is that Step 9 must not');
  out.push('capture byte-identity fixtures against a fabricated tidal number. For the four bakes that');
  out.push('argument is confirmed by this table. For the crater uniforms it is **not** confirmed today: on');
  out.push('this population they would capture identically either way. It remains correct as insurance —');
  out.push('the coupling is real and one body with a high enough `td` makes it bind — but Step 9 should not');
  out.push('be sequenced on the strength of a crater move that has never been observed. This finding is');
  out.push('reported rather than reconciled.');
  out.push('');
  out.push('### 3. The no-op control');
  out.push('');
  const ic = mGen.stats.get('iceness');
  out.push(`**\`iceness\` — ${ic.moved} / ${ic.n} moved, max delta ${fmt(ic.max)}.**`);
  out.push('');
  out.push('It is picked as the no-op control because its law can be read: `surfaceMaterial.js` `icenessOf`');
  out.push('reads `composition.density`, `composition.volatileFraction` and `T_eq` — and nothing else. There is');
  out.push('no tidal term and no call into one. It is nevertheless computed **through the real shipped law on');
  out.push('both branches**, from two conditions that genuinely differ, so its zero is measured rather than');
  out.push('asserted. It sits in the same list as the three bakes that DO move, which is what makes the');
  out.push('contrast informative: `landPalette` moves because `surfaceAlbedoOf` calls `resurfacingRateOf`');
  out.push('(`surfaceMaterial.js` `resurfacingRateOf`, whose first read is `cond.rawTidalIoRatio`), and the two');
  out.push('lava colours move because `meltTemperatureOf` reads the same scalar. `iceness` calls neither.');
  out.push('');
  out.push('`surfaceGravity` and `T_eq` also read 0 — but in the main table they are **copied**, so their zero');
  out.push('there proves nothing on its own. The footprint probe is what gives it weight:');
  out.push('');
  out.push('### FOOTPRINT PROBE — what the three forwarded fields can reach inside the condition vector');
  out.push('');
  out.push(`Over **${fp.probed}** bodies, an fp was rebuilt and \`deriveConditionVector\` called **twice**, differing`);
  out.push('only in `tidalHeat` / `starMassEarth` / `orbitRadiusEarth`; all ' + fp.keysSeen.length + ' returned keys were diffed.');
  out.push('');
  out.push('| condition key | bodies on which it differed |');
  out.push('|---|---:|');
  for (const k of fp.keysSeen) {
    const c = fp.moved.get(k) || 0;
    if (c > 0) out.push(`| \`${k}\` | **${c}** |`);
  }
  const unmovedKeys = fp.keysSeen.filter(k => !(fp.moved.get(k) > 0));
  out.push(`| _(all ${unmovedKeys.length} other keys, incl. \`surfaceGravity\` and \`T_eq\`)_ | 0 |`);
  out.push('');
  out.push('So the substitution the main table performs is the whole causal footprint, measured — and');
  out.push('`surfaceGravity` / `T_eq` read 0 through a second real derivation, not because they were copied.');
  out.push('If a future law reads `starMassEarth` directly, a second row appears here and the assumption');
  out.push('behind this table breaks loudly instead of silently.');
  out.push('');
  out.push('### 4. Agreement with the plan\'s figures');
  out.push('');
  const r = mGen.ratio;
  out.push('PLAN.md Step 2 (and the Step-2 brief) cite: *"within 2× of truth for **5.6%**, **median 75× off**"*,');
  out.push('measured over 161 generated planets. Measured here over ' + mGen.n + ' bodies, OLD vs NEW:');
  out.push('');
  out.push('| figure | plan | this run |');
  out.push('|---|---:|---:|');
  out.push(`| within 2× | 5.6% | **${Number.isFinite(r.within2xPct) ? r.within2xPct.toFixed(1) : 'n/a'}%** (${r.within2xCount} / ${mGen.n}) |`);
  out.push(`| median ratio | 75× | **${fmt(r.median)}×** |`);
  out.push(`| p95 ratio | — | ${fmt(r.p95)}× |`);
  out.push(`| max finite ratio | — | ${fmt(r.max)}× |`);
  out.push(`| bodies where exactly one side is 0 (ratio undefined) | — | ${r.infCount} |`);
  out.push(`| bodies where BOTH sides are exactly 0 (counted as ratio 1 above) | — | ${r.bothZero} |`);
  out.push('');
  out.push('The plan does not state how it treated bodies on which both rules return exactly 0 — here');
  out.push(`${r.bothZero} of ${mGen.n}, every one an \`eccentricity == 0\` body where an $e^{2}$ law is 0 either way.`);
  out.push('Counting them as agreement (above) or dropping them (below) changes the headline, so both are');
  out.push('published rather than one being chosen quietly:');
  out.push('');
  out.push('| figure | plan | this run, both-zero bodies dropped |');
  out.push('|---|---:|---:|');
  out.push(`| n | 161 | ${r.nzN} |`);
  out.push(`| within 2× | 5.6% | **${Number.isFinite(r.nzWithin2xPct) ? r.nzWithin2xPct.toFixed(1) : 'n/a'}%** |`);
  out.push(`| median ratio | 75× | **${fmt(r.nzMedian)}×** |`);
  out.push(`| p95 ratio | — | ${fmt(r.nzP95)}× |`);
  out.push('');
  out.push('Per stratum, because the plan\'s population was *"161 generated planets"* — closest to');
  out.push('stratum `S` alone (system planets), not to this whole population:');
  out.push('');
  out.push('| stratum | n | within 2× | median ratio | p95 ratio |');
  out.push('|---|---:|---:|---:|---:|');
  for (const [s, m] of Object.entries(byStratum)) {
    out.push(`| \`${s}\` | ${m.n} | ${m.ratio.within2xPct.toFixed(1)}% | ${fmt(m.ratio.median)}× | ${fmt(m.ratio.p95)}× |`);
  }
  out.push('');
  out.push('**⚠ THIS RUN DISAGREES WITH THE PLAN AND THE DISAGREEMENT IS NOT RECONCILED HERE.**');
  out.push('Neither figure reproduces: within-2× comes out ~3.5× higher than the plan\'s 5.6%, and the');
  out.push('median ratio ~2.3× lower than its 75×. The direction of both is the same — the sign and the');
  out.push('order of magnitude of the defect are confirmed, and "the fallback is wrong by ~1.5 orders of');
  out.push('magnitude on the median body" survives — but the exact numbers do not, on any stratum');
  out.push('individually or on the whole. Two candidate causes, neither verified here because verifying');
  out.push('them means re-deriving the plan\'s original measurement, which is out of this lane\'s scope:');
  out.push('the populations are different (526 bodies across three strata vs 161 generated planets, and');
  out.push('the strata table above shows the figure is strongly stratum-dependent), and the plan does not');
  out.push('state how it treated bodies where one side is 0. **Whoever closes Step 2 should either');
  out.push('re-derive the 5.6% / 75× on a named population or replace those figures in PLAN.md with the');
  out.push('ones above.** They should not be repeated as-is once this table exists.');
  out.push('');
  out.push('## SOL — second population, clearly labelled');
  out.push('');
  out.push('⛔ **This is a pure-function measurement and nothing else.** No Sol pixel was inspected and nothing');
  out.push('here may be quoted as a rendering claim. Sol is included because a delta between two evaluations');
  out.push('of a pure function of a data record is a fact about the function, and Sol bodies are records.');
  out.push('');
  const solEcc = sol.filter(b => (b.rec.eccentricity ?? 0) !== 0).length;
  out.push(`\`d.tidalHeating\` present on **${mSol.present} / ${mSol.n}** Sol bodies; absent on **${mSol.absent}**.`);
  out.push('');
  out.push(`**Sol is the genuinely-absent branch, in full.** All ${mSol.absent} bodies take the fallback, so this is`);
  out.push('the population where forwarding `starMassEarth` / `orbitRadiusEarth` is the only thing that could');
  out.push(`act. It reads **all zeros anyway**, for a reason worth stating: \`SolarSystemData.js\` builds its`);
  out.push(`planet records without an \`eccentricity\` field — non-zero on **${solEcc} / ${mSol.n}** bodies — and the`);
  out.push('fallback is $\\propto e^{2}$. With $e = 0$ the OLD 1 M☉-at-1-AU fallback and the corrected');
  out.push('real-star-real-orbit fallback are both exactly 0, whatever the orbit. So Sol confirms the absent');
  out.push('branch is *reached* and confirms the change is *safe* there; it is not evidence that the');
  out.push('forwarding computes anything, and must not be cited as such. The counterfactual in control 2 is.');
  out.push('');
  out.push(tableFor(mSol));
  out.push('');
  out.push('---');
  out.push('');
  out.push('_Regenerate: `node tools/port-condition-delta.mjs`. Negative controls: `node tools/port-condition-delta.mjs --selftest`._');
  out.push('');

  const text = out.join('\n');
  if (args.includes('--stdout')) {
    console.log(text);
  } else {
    const dest = path.join(ROOT, 'docs/FEATURES/step2-tidal-delta-table.md');
    fs.writeFileSync(dest, text);
    console.log(`wrote ${path.relative(ROOT, dest)}`);
  }

  // Console summary — the operator should not have to open a file to see the headline.
  console.log('');
  console.log(`GENERATED n=${mGen.n}  SOL n=${mSol.n}`);
  console.log(`rawTidalIoRatio moved on ${rt.moved}/${rt.n}   median |Δ| ${fmt(rt.median)}   max ${fmt(rt.max)}`);
  console.log(`movers: ${movers.join(', ')}`);
  console.log(`zeros : ${zeros.join(', ')}`);
  console.log(`within2x ${Number.isFinite(r.within2xPct) ? r.within2xPct.toFixed(1) : 'n/a'}%  medianRatio ${fmt(r.median)}  inf ${r.infCount}`);
  console.log(`footprint: moved keys = ${[...fp.moved.keys()].join(', ') || '(none)'}`);
  console.log(`tidalHeating present/absent: generated ${mGen.present}/${mGen.absent}   sol ${mSol.present}/${mSol.absent}`);
  console.log(`craters: on ${cd.cratersOn}/${cd.n} · forced-swing moves uniforms ${cd.movedOnForcedSwing}/${cd.n}, schedule ${cd.scheduleMovedOnForcedSwing}/${cd.n} · tExp argmin age ${cd.bind.age} / erosion ${cd.bind.erosion} / tidal ${cd.bind.tidal}`);
  for (const [s, m] of Object.entries(byStratum)) {
    console.log(`  stratum ${s}: n=${m.n} within2x ${m.ratio.within2xPct.toFixed(1)}% medianRatio ${fmt(m.ratio.median)}`);
  }

  // §11.3.6 — a declared pixel-moving step's named quantities must move. Say which did not, out
  // loud, rather than letting a zero pass as agreement.
  const namedByGate = ['rawTidalIoRatio', 'landPalette.weathered', 'iceness', 'lavaGlowColor', 'lavaCrustColor',
                       'crater.density', 'crater.scale', 'crater.amp', 'crater.complexD', 'crater.relaxation'];
  const gateZeros = namedByGate.filter(k => mGen.stats.get(k).moved === 0);
  if (gateZeros.length) {
    console.error('');
    console.error('⚠ §11.3.6 — quantities NAMED BY STEP 2\'s GATE that did not move on any body:');
    console.error('   ' + gateZeros.join(', '));
    console.error('   `iceness` is expected (declared no-op control, see the artifact). The crater rows are');
    console.error('   NOT expected by the plan text and are diagnosed in section 2b: craters are on for only');
    console.error(`   ${cd.cratersOn}/${cd.n} bodies, and tExp's tidal term is the binding minimum on ${cd.tidalBindsUnderEither}. The chain`);
    console.error(`   IS wired — a forced 0→1e5 swing moves them on ${cd.movedOnForcedSwing}/${cd.n}. This is a plan-scoping`);
    console.error('   question for the step owner, not a harness defect. Exit code stays 0.');
  }

  if (!det) { console.error('DETERMINISM FAILED — two builds from identical seeds disagreed.'); process.exit(2); }
  if (rt.moved === 0) {
    console.error('DECLARED MOVER DID NOT MOVE — rawTidalIoRatio is identical on every body. §11.3.6 failure.');
    process.exit(1);
  }
  const fpMoved = [...fp.moved.keys()];
  if (!fpMoved.includes('rawTidalIoRatio')) { console.error('FOOTPRINT PROBE: control never moved.'); process.exit(2); }
  if (fpMoved.length !== 1) { console.error(`FOOTPRINT PROBE: ${fpMoved.length} keys moved (${fpMoved.join(', ')}) — the table's substitution is no longer the whole footprint.`); process.exit(2); }
  process.exit(0);
}

main();
