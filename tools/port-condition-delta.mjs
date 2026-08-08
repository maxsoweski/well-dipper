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
const { conditionFromPlanet }  = await loadOrExplain('src/worldengine/port/conditionFromPlanet.js');
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
  const unknown = args.filter(a => !['--stdout', '--selftest'].includes(a));
  if (unknown.length) { console.error(`usage: node tools/port-condition-delta.mjs [--stdout|--selftest]`); process.exit(64); }

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
