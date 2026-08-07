// src/worldengine/port/conditionFromPlanet.js — the GAME-SIDE adapter into the world engine.
//
// The game's PlanetGenerator output and the lab's DRIVER_PRESETS entries are nearly the same shape
// already (both carry radiusEarth / massEarth / composition / T_eq / age / tidalState / atmosphere /
// surfaceHistory), which is why this file is thin. Its job is to normalise the few differences and to
// be the ONE named seam where game data enters the engine — so the coupling is greppable instead of
// scattered through call sites.
//
// ⚠ THIS ADAPTER READS `type` FOR NOTHING. That is deliberate and load-bearing. The whole point of the
// condition-first engine is that laws key off physical scalars, never a type label. If a future edit
// needs `planetData.type` in here to make something come out right, that is a signal the LAW is
// underspecified — go add the missing condition scalar, do not smuggle the label across this seam.
//
// Field notes:
//  - `massEarth` reaches the condition vector only through surfaceGravity (g = M/R^2); the engine never
//    reads mass directly.
//  - `atmosphere` is NOT the game's computeAtmosphere() result — it is a VISUAL wrapper around it.
//    See atmosphereFromPlanet below; this was the third silent-disagreement bug found at this seam.
//    Only `pressure` and `composition` are read downstream (erosion / iceness / biosphere / crater
//    gates / the optics column term).
//  - `surfaceHistory.erosion` is NOT read by the palette chain — surfaceMaterial.js derives erosion
//    itself from pressure + temperature, precisely so it stays condition-pure.
//  - FOUR unit/shape disagreements are fixed here, each with its own block below: T_eq (equilibrium
//    vs surface), density (kg/m³ vs g/cc), atmosphere (nested vs flat, now positively validated) and
//    axialTilt (radians vs degrees). They are the same failure every time — one name, two meanings,
//    no error, a finite plausible wrong number — which is why each one is named rather than fixed
//    silently. Expect a fifth.
//  - `_provenance` (non-enumerable, on the returned condition) records 'measured' vs 'defaulted' for
//    each of the 13 inputs. Read it before believing any number this seam produces for a moon or a
//    hand-authored body.

import { deriveConditionVector } from '../../../body-condition-vector.js';

// ── THE GREENHOUSE CORRECTION — the seam's one non-trivial job. ────────────────────────────────────
// ⚠ THE TWO SIDES DISAGREE ABOUT WHAT `T_eq` MEANS, and the names do not warn you.
//   game  PlanetGenerator.T_eq = equilibriumTemperature(luminosityRel, orbitAU) — a bare radiative
//                                balance. No greenhouse. There is no surface-temperature field
//                                anywhere in the game's planet data.
//   engine condition.T_eq       = SURFACE temperature (body-condition-vector.js says so explicitly,
//                                and driver-presets.js sets Venus to 737, its surface value).
// Passing the game's number straight through therefore hands every temperature-gated law the WRONG
// PHYSICAL QUANTITY, silently: a game Venus would arrive at ~329 K instead of 737 K, and the erosion
// water-window, iceness, biosphere, crater and atmosphere-optics gates would all read it as temperate.
//
// So the adapter converts. Grey-greenhouse, the standard form:
//     T_surf = T_eq * (1 + 0.75*tau)^0.25,   tau = TAU_REF * P^TAU_EXP
// TAU_REF and TAU_EXP are solved from Earth (1 bar, 255 -> 288 K) and Venus (92 bar, 232 -> 737 K).
// Checked against four bodies that were NOT fitted, including two zero-pressure controls:
//     Mars 0.006 bar 210 K -> 210.1 (+0.1%)   Titan 1.5 bar 94 K -> 97.4 (+3.7%)
//     Moon 0 bar 270 K -> 270.0 (0%)          Europa 0 bar 102 K -> 102.0 (0%)
// Airless bodies are exact by construction (P = 0 => tau = 0 => factor 1), which is what keeps the
// airless presets' behaviour identical on both sides of the seam.
export const TAU_REF = 0.84;
export const TAU_EXP = 1.124;

export function surfaceTemperatureOf(T_eq, pressureBar) {
  const P = Math.max(pressureBar ?? 0, 0);
  const tau = TAU_REF * Math.pow(P, TAU_EXP);
  return T_eq * Math.pow(1 + 0.75 * tau, 0.25);
}

// ── THE DENSITY UNIT CONVERSION — the seam's second silent-disagreement fix. ───────────────────────
// ⚠ THE TWO SIDES USE DIFFERENT UNITS FOR `density`, and again the names do not warn you.
//   game   deriveComposition() returns `density` in kg/m^3 (PhysicsEngine.js: 3500 + iron*5000 - ...,
//          clamped to 1000..8000).
//   engine surfaceMaterial.js compares density against DENS_ICE_HI = 2.0 and DENS_ROCK_LO = 3.5,
//          i.e. g/cc, and driver-presets.js writes 5.5 for Earth.
// A factor of 1000. Passed straight through, EVERY game body reads as maximally rocky and the icy
// gate never opens. Measured on a genuinely icy body (volatileFraction 0.5, 110 K):
//     density 2000 (game units)  -> icenessOf = 0.000   <- total gate failure
//     density 2.0  (engine units) -> icenessOf = 1.000
// That gate feeds the bombardment ice-relaxation term and the uIcenessMix albedo uniform, so the bug
// is not cosmetic. Converting here rather than changing PhysicsEngine keeps the game's own physics
// (which uses kg/m^3 consistently elsewhere) untouched.
const KG_M3_TO_G_CC = 1e-3;

export function densityToGramsPerCC(gameDensity) {
  return (gameDensity ?? 5500) * KG_M3_TO_G_CC;
}

// ── THE OBLIQUITY UNIT CONVERSION — the seam's FOURTH silent-disagreement fix. ─────────────────────
// ⚠ THE TWO SIDES USE DIFFERENT UNITS FOR `axialTilt`, UNDER THE SAME KEY NAME, and — for the third
// time in this file — the names do not warn you.
//   game   planetData.axialTilt is RADIANS.  SolarSystemData.js:180 `axialTilt: 0.41,  // 23.4°`;
//          :484 `1.71, // 97.8°`; PlanetGenerator.js:687 rolls it in ±1.5. Corroborated by two
//          independent consumers: Planet.js:1545 feeds it straight to `mesh.rotation.z` (three.js
//          radians) and TextureBaker.js:265 declares `uniform float axialTilt; // radians`.
//   lab    the fp key is DEGREES.  driver-presets.js:109 `axialTilt: 25` with the comment "(real
//          25.2 deg)", and the ONE law that reads the key — planet-lod-lab-core.js:906-908 — is
//          `// axialTilt in degrees (default 0)` / `frostLatitudeBias = clamp01(axialTilt / 90)`.
//          The rest of the engine agrees: climate-e5.js:99 `Math.sin(obliquityDeg * DEG2RAD)`,
//          storm-e.js:68 `URANIAN_OBLIQUITY: 80`, emission-e.js:164 `obliquityDeg`.
// Passed straight through, Earth's 0.41 would enter `clamp01(axialTilt / 90)` as 0.0046 instead of
// 0.26 — an 89× under-read, finite and plausible, that would show up as "the polar-cap law does
// nothing" rather than as an error. Mars would read 0.0044 instead of 0.28. This is the same failure
// shape as the density factor of 1000 and the T_eq greenhouse above, and it is the unit bug F22 is
// blocked on (`docs/FEATURES/one-pipeline-two-frontends-PLAN.md:86`, `:581`;
// `docs/FEATURES/lab-pipeline-into-game-PLAN.md:293-294` states it outright).
//
// ⚠⚠ DIRECTION, STATED BECAUSE THE PLAN'S OWN PROSE POINTS THE OTHER WAY. PLAN.md:177 says
// "convert to radians at the seam". Its cited evidence — "the game stores 0.41 for 23.4°" — is
// exactly the proof that the GAME'S NUMBER IS ALREADY RADIANS, so a degrees→radians conversion here
// would divide by 57.3 a second time and produce 0.00716 for Earth: a number that is finite,
// plausible, and wrong by the very factor the step exists to remove. The conversion the seam owes is
// RADIANS → DEGREES, into the unit both the lab's law and every engine obliquity consumer read.
// Pinned by tests/port-condition-contract.test.js so a future reader cannot "fix" it back.
const RAD_TO_DEG = 180 / Math.PI;

/**
 * The game's radian `axialTilt` in the engine's DEGREES. `undefined` in ⇒ `undefined` out: an absent
 * tilt must stay absent, never become a fabricated 0, so that `?? default` chains downstream reach
 * their own fallback and `_provenance` can name it as `'defaulted'` instead of it arriving disguised
 * as a measurement.
 */
export function axialTiltDegreesOf(gameAxialTiltRadians) {
  return gameAxialTiltRadians == null ? undefined : gameAxialTiltRadians * RAD_TO_DEG;
}

// ── THE HABITABILITY SHAPE NORMALISATION — the seam's FIFTH silent disagreement. ───────────────────
// ⚠ THE TWO SIDES DISAGREE ABOUT WHETHER `habitability` IS A NUMBER. Found while building this step;
// not previously recorded anywhere, because nothing had ever forwarded the field.
//   lab   driver-presets.js:27  `habitability: 0.7`                 → a SCALAR
//   game  PlanetGenerator.js:789 `habitability: habScore`, where
//         PhysicsEngine.js:687 returns `{ score: Math.min(score, 1.0), factors }` → an OBJECT
// The engine's one reader is `planet-lod-lab-core.js:744` — `clamp01(d.habitability ?? 0)` — and
// `clamp01` of an object is `Math.min(1, Math.max(0, {…}))` = **NaN**. NaN is the one failure mode in
// this codebase that is NOT quiet: it propagates into a uniform and the whole body renders as a black
// frame (docs/FEATURES/surface-variation-beyond-mvp.md:790 records exactly that, from an `undefined`
// axialTilt reaching a world matrix). Forwarding the raw object would therefore have shipped a
// landmine to the first step that reads the field, three steps from here.
//
// ⚠ THE FUNCTION'S OWN JSDOC IS WRONG about this: `PhysicsEngine.js:637` says
// `@returns {number} score 0-1` while `:687` returns an object. That is not fixed here — it is a
// game-side edit outside this seam — but one live consumer is already miscomputing because of it:
// `NavComputer.js:2618` and `:3218` both test `pd.habitability > 0.3`, an object-vs-number
// comparison that is ALWAYS false, so the "Habitability" HUD line has never once appeared. Reported,
// not fixed: it changes on-screen text and belongs to whoever owns the HUD.
/** The scalar the engine means by `habitability`, out of either side's shape. Absent stays absent. */
export function habitabilityScalarOf(gameHabitability) {
  if (gameHabitability == null) return undefined;
  if (typeof gameHabitability === 'number') return gameHabitability;      // lab shape, already scalar
  const s = gameHabitability.score;
  return typeof s === 'number' ? s : undefined;                           // game shape { score, factors }
}

// ── THE ATMOSPHERE SHAPE NORMALISATION — the seam's third silent-disagreement fix. ─────────────────
// ⚠ THE TWO SIDES NEST `pressure` AT DIFFERENT DEPTHS, and once again the names do not warn you.
//   engine/lab  atmosphere = { color, retained, pressure, composition }        <- FLAT
//               (driver-presets.js: Rocky `{...retained:true, pressure:1.0, composition:'n2-o2'}`)
//   game        atmosphere = { color, strength, physics: { retained, pressure, composition, ... } }
//               PlanetGenerator computes atmoPhysics = computeAtmosphere(...) and then wraps it in a
//               VISUAL object for the renderer, burying the physics one level down.
//
// Passed straight through, `cond.atmosphere.pressure` is `undefined` and every consumer's
// `?? 0` fallback turns that into a hard zero. MEASURED before the fix, across 330 generated bodies
// spanning 11 orbits x 6 metallicities x 5 types: pressure 0.000 .. 0.000 bar — EVERY BODY IN THE
// GAME, including a 90-bar Venus and a 1.25-bar Earthlike. The consequences were not cosmetic:
//   erosionOf        -> 0 everywhere   (its pressure gate is smoothstep(0, 0.5, P))
//   airlessnessOf    -> 1 everywhere   => full space weathering darkened AND reddened every world
//   biosphereOf      -> 0 everywhere   (its air gate never opens)
//   surfaceTemperatureOf -> a NO-OP    => the greenhouse correction above, the whole of blocker B,
//                                        was installed but had never once fired on real game data
//                                        (measured T_surf == T_eq to three decimals, all 330 bodies)
// The palette that port slice 1 already ships was therefore derived from a body the engine believed
// was airless. This is the fix for that, not a slice-2 addition.
//
// A null atmosphere stays null: PlanetGenerator sets `atmosphere = null` outright when nothing is
// retained, and the engine's airless presets are null too, so the airless path is already agreed.
// An already-flat atmosphere passes through untouched, so a lab preset or a hand-authored test
// fixture fed to this adapter behaves exactly as it did before.
//
// ── STEP 1: THE SNIFF BECAME A POSITIVE SHAPE VALIDATION. ─────────────────────────────────────────
// The retired test was `if (!phys) return gameAtmosphere; // already engine-shaped` — an ABSENCE
// test. It asks "is there no `.physics`?" and concludes "then this must already be engine-shaped",
// which is a non-sequitur that one real caller falsifies:
//     MoonGenerator.js:192-196 — `atmosphere: type === 'terrestrial' ? { color, strength } : null`
// a purely VISUAL rim-glow wrapper with no physics anywhere. It has no `.physics`, so the absence
// test passed it straight through, and the resulting condition carried an atmosphere that is
// TRUTHY (so every `if (cond.atmosphere)` gate says "this world has air") whose `.pressure` is
// UNDEFINED (so every `atmosphere.pressure ?? 0` gate says "vacuum"). One object, two contradictory
// answers, no error — which is why moons cannot be trusted through this seam today.
// `hasEngineAtmosphereShape` replaces it with the POSITIVE question: does this object actually
// carry the two fields the engine reads? Nothing else in this file can tell the difference, because
// nothing downstream throws — see craterUniforms.js:125,133-138,151 and baseStep.js:99, where every
// divisor is floored.
//
// ⚠ SCOPE, MEASURED: PLAN.md:193 records 177/177 generated planets carrying `{color, physics,
// strength}` and 0 lacking `.physics`, and every `SolarSystemData.js` body with an atmosphere
// carries a `physics` block (:160, :184, :220 say so in-source). So this is a MOON-ONLY behaviour
// change. If a planet ever changes here, that is a real regression, not expected churn.
//
// ⚠ THE FLAT BRANCH STAYS A PASSTHROUGH OF THE SAME OBJECT, deliberately. A lab preset or a
// hand-authored fixture that already validates is returned UNCHANGED — not rebuilt into a
// four-key literal — so `retained: false` fixtures (tests/port-limb-optics.test.js:47-49) keep
// reaching the optics exactly as they do today, and nothing that was byte-identical stops being so.
function hasEngineAtmosphereShape(a) {
  return !!a && typeof a === 'object' && (a.retained !== undefined || a.pressure !== undefined);
}

export function atmosphereFromPlanet(gameAtmosphere) {
  if (!gameAtmosphere) return null;
  const phys = gameAtmosphere.physics;
  if (!phys) {
    // No `.physics`. Engine-shaped, or a visual-only wrapper? ASK, do not assume.
    return hasEngineAtmosphereShape(gameAtmosphere) ? gameAtmosphere : null;
  }
  if (!hasEngineAtmosphereShape(phys)) return null;  // a `.physics` that is not one either
  if (phys.retained === false) return null;          // defensive: the generator already nulls these
  return {
    // `color` is the VISUAL wrapper's, not the physics block's — the physics block has no colour.
    // Forwarding it is what keeps the rim tint available downstream; it has always been forwarded
    // here, and this line is now covered by a regression fence rather than left implicit.
    color:       gameAtmosphere.color,
    retained:    phys.retained,
    pressure:    phys.pressure ?? 0,
    composition: phys.composition ?? 'none',
  };
}

// ── `_provenance` — WHICH OF THIS BODY'S INPUTS WERE MEASURED AND WHICH WERE INVENTED. ────────────
//
// WHY IT EXISTS. Nothing at this seam throws. Every defaulted input produces a finite, plausible,
// wrong number: a moon with no `massEarth` becomes a 1 M⊕ body, a giant with no pressure becomes
// density 1.0, and the crater/relief/palette chain accepts all of it because every divisor
// downstream is floored (craterUniforms.js:125,133-138,151; baseStep.js:99). The measurement is
// entirely true — that IS what the engine computed — and entirely misleading, because it is a
// statement about a body the game never generated. PLAN §2 and §6 document three such fabrications
// that survived review; a provenance record is the only mechanism that would have named any of them
// at the moment it happened, rather than two steps later against the wrong suspect.
//
// THE 13 INPUTS are exactly the fields this adapter reads off `planetData` to build the fp. The
// count is asserted in tests/port-condition-contract.test.js so that adding a fourteenth input
// without a provenance entry fails loudly instead of creating a blind spot.
export const PROVENANCE_INPUTS = Object.freeze([
  'radiusEarth', 'massEarth', 'composition', 'age', 'T_eq', 'eccentricity', 'tidalState',
  'atmosphere', 'surfaceHistory', 'rotationHours', 'magneticField', 'habitability', 'axialTilt',
]);

/**
 * 'measured' — the game handed this seam a value for this input, on this body.
 * 'defaulted' — it did not, and whatever the engine sees is this file's or the vector's fallback.
 *
 * Two entries need their rule stated, because "is it there?" is not a well-posed question for them:
 *
 *  · `composition` is 'measured' only when ALL THREE fields the fp reads are present
 *    (ironFraction, density, volatileFraction). A partly-populated composition is precisely the
 *    fabrication case — a body with iron and volatiles but no density silently becomes
 *    5500 kg/m³ ⇒ 5.5 g/cc, i.e. Earth, and reads maximally rocky.
 *
 *  · `atmosphere` distinguishes `null` from absent. `null` is a MEASUREMENT: PlanetGenerator.js:448
 *    and MoonGenerator.js:192 set it outright to mean "nothing retained", and the engine's airless
 *    presets agree. `undefined` means the body never said. And a visual-only `{color, strength}`
 *    wrapper — the moon bug above — is 'defaulted', because it looks like an answer and is not one.
 */
function provenanceOf(d, comp) {
  const seen = (v) => (v != null ? 'measured' : 'defaulted');
  return Object.freeze({
    radiusEarth:    seen(d.radiusEarth),
    massEarth:      seen(d.massEarth),
    composition:    (comp.ironFraction != null && comp.density != null && comp.volatileFraction != null)
      ? 'measured' : 'defaulted',
    age:            seen(d.age),
    T_eq:           seen(d.T_eq),
    eccentricity:   seen(d.eccentricity),
    tidalState:     seen(d.tidalState),
    atmosphere:     (d.atmosphere === null || hasEngineAtmosphereShape(d.atmosphere?.physics ?? d.atmosphere))
      ? 'measured' : 'defaulted',
    surfaceHistory: seen(d.surfaceHistory),
    rotationHours:  seen(d.rotationHours),
    magneticField:  seen(d.magneticField),
    habitability:   seen(d.habitability),
    axialTilt:      seen(d.axialTilt),
  });
}

export function conditionFromPlanet(planetData) {
  const d = planetData || {};
  const comp = d.composition || {};
  // Flattened FIRST — both the T_eq greenhouse conversion and the passthrough below read it, and
  // reading the raw wrapper for either is the bug atmosphereFromPlanet exists to close.
  const atmosphere = atmosphereFromPlanet(d.atmosphere);
  // fp-shaped view of the game body. Defaults mirror driver-presets.js so a partially-populated body
  // degrades to the same place a sparse preset would, instead of throwing.
  const fp = {
    radiusEarth: d.radiusEarth ?? 1.0,
    massEarth:   d.massEarth ?? 1.0,
    composition: {
      ironFraction:     comp.ironFraction ?? 0.32,
      // NOT comp.density — see densityToGramsPerCC above. The game stores kg/m^3, the engine wants g/cc.
      density:          densityToGramsPerCC(comp.density),
      volatileFraction: comp.volatileFraction ?? 0.15,
      ...(comp.carbonToOxygen != null ? { carbonToOxygen: comp.carbonToOxygen } : {}),
    },
    age:           d.age ?? 4.5,
    // NOT d.T_eq — see surfaceTemperatureOf above. The engine wants SURFACE temperature.
    T_eq:          surfaceTemperatureOf(d.T_eq ?? 288, atmosphere?.pressure),
    eccentricity:  d.eccentricity ?? 0,
    tidalState:    d.tidalState || { locked: false },
    atmosphere,
    // ⚠⚠ KNOWN, MEASURED, DELIBERATELY NOT FIXED HERE — the seam's SIXTH disagreement, and the one
    // that is a KEY-NAME mismatch rather than a unit or a shape:
    //     game  PhysicsEngine.js:820-824 computeSurfaceHistory returns
    //           { bombardmentIntensity, erosionLevel, resurfacingRate }
    //     lab   driver-presets.js:27 writes `surfaceHistory:{erosion:…}` and BOTH readers spell it
    //           `erosion` — baseStep.js:38 `d.surfaceHistory?.erosion ?? 0` and
    //           planet-lod-lab-core.js:598 `d.surfaceHistory?.erosion ?? 0`.
    // MEASURED over 616 generated planets: `surfaceHistory.erosion` is undefined on 616/616, while
    // `erosionLevel` runs 0.0150 … 1.0000 (median 0.6655). So the engine reads a hard 0 for a
    // quantity that is really two-thirds of the way up its range, on every body in the game.
    // ⛔ NOT renamed in Step 1, on purpose. This is the same shape of bug as the `tidalHeat` /
    // `tidalHeating` name mismatch, and PLAN.md gives THAT one its own step (Step 2) with a
    // deliberately-NOT-byte-identity gate and a committed delta table, precisely because fixing a
    // dropped input MOVES NUMBERS. Step 1's whole claim is "additive, nothing moves". Renaming here
    // would move `deriveBodyScalars`' `surfaceHistory` scalar (baseStep.js:38 → :80) for any body
    // that reaches `makeBaseStep`, inside a step whose gate asserts nothing moved — and the gate
    // would pass anyway, because the vector's three baseStep helpers (shellThickness, rawTidal,
    // surfaceGravity) happen not to read it. A green gate over a real behaviour change is this
    // codebase's signature failure and it is not being reproduced here. Pinned by
    // tests/port-condition-contract.test.js as a NAMED known defect so it stays visible.
    surfaceHistory: d.surfaceHistory || { erosion: 0, bombardmentIntensity: 0, resurfacingRate: 0 },
    ...(d.rotationHours != null ? { rotationHours: d.rotationHours } : {}),
    // ── STEP 1 — the three inputs the port declared and never forwarded, plus the unit fix. ──────
    // ⚠ NO FABRICATED DEFAULTS ON THIS BLOCK, deliberately, and it is the opposite choice from the
    // lines above. `radiusEarth ?? 1.0` exists because the fp must always have a radius for the
    // engine to run at all. These three do not: nothing reads them yet, every future reader will
    // reach them through its own `?? fallback`, and `undefined` is the only value that lets
    // `_provenance` stay honest. A defaulted 0 here would be indistinguishable from a real
    // measurement of zero — which for `magneticField` ("no dynamo") and `axialTilt` ("no seasons")
    // are both physically meaningful readings that some body genuinely has.
    //
    // ⛔ `metallicity` IS NOT HERE, AND ITS ABSENCE IS LOAD-BEARING. It lands in Step 5, not Step 1.
    // `giant-drivers.js:124-125` reads `condition.metallicity` as its declared PRIMARY enrichment
    // term and falls through to the density proxy only while it is undefined — but `canonicalZ0`
    // (`:136-138`) is ALWAYS that density proxy, a weighted sum in g/cc, while the generated
    // `metallicity` is a DEX value (−0.473…+0.460, 39.6% of it negative). Forwarding it switches the
    // numerator's branch across a unit mismatch the denominator does not follow: measured over 144
    // generated gas bodies, `shellDepthFrac` goes from 0.740000 on all 144 to 0.860000 on all 144 —
    // pegged at its clamp ceiling. Step 1's own uniform gate would pass GREEN (no giant uniform
    // ships yet) and the failure would surface two steps later against the wrong commit.
    // tests/port-condition-contract.test.js pins the absence AND measures the trap, so this comment
    // cannot rot into folklore.
    magneticField: d.magneticField,          // D13 — the vector has declared this key since V2-0
    habitability:  habitabilityScalarOf(d.habitability), // ⚠ SCALAR out of {score,factors} — see the block above
    axialTilt:     axialTiltDegreesOf(d.axialTilt),      // ⚠ DEGREES out of RADIANS in — see the block above
  };
  const condition = deriveConditionVector(fp, null, fp.radiusEarth);

  // ⛔ WHERE `_provenance` LIVES, AND WHY IT LIVES THERE.
  // It rides on the CONDITION VECTOR — the port's OUTPUT — and never on `planetData`. That matters
  // structurally, not stylistically: `planetData` is the subject of Instrument B's body-identity
  // fingerprint and Instrument C's watched set, and a port OUTPUT that lands inside its own
  // instrument's matching key is exactly the P1 defect Step 0 had to fix (the five WORLDENGINE_BAKES
  // are excluded from the hash for that reason — tests/body-identity-fence.test.js:169). Keeping
  // provenance off `planetData` means neither exclusion list needs to grow, and the fence stays a
  // fence instead of acquiring another hole. PlanetGenerator.js:756-761 writes only its five named
  // bakes, so nothing carries this onto a body record; the contract test asserts that rather than
  // trusting it.
  //
  // NON-ENUMERABLE, and that is the second half of the same argument. `Object.keys`, `JSON.stringify`
  // and `{...spread}` (worldengine/instrument/laws.js:315 does spread a condition) cannot see it, so
  // it CANNOT enter any hash, golden or key-shape assertion by accident. The protection is
  // structural — nobody has to remember to exclude it. The cost is that a spread DROPS it, which is
  // correct: a spread-derived condition is a different body's worth of inputs and has no provenance.
  // Frozen because it is a record of what already happened; mutating it is always a bug.
  Object.defineProperty(condition, '_provenance', {
    value: provenanceOf(d, comp),
    enumerable: false,
    writable: false,
    configurable: false,
  });
  return condition;
}
