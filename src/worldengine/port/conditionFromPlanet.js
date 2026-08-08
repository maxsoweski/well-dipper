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
//    each of the 14 inputs. Read it before believing any number this seam produces for a moon or a
//    hand-authored body. The input list is DERIVED FROM THIS FILE'S SOURCE TEXT by the contract test,
//    not restated there — see PROVENANCE_COVERAGE below for why that distinction is the whole fence.

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
//          SolarSystemData.js:484 `axialTilt: 1.71,`; PlanetGenerator.js:687 `const axialTilt = rings ?`
//          rolls it in ±1.5. Corroborated by two independent consumers:
//          Planet.js:1545 `this.mesh.rotation.z = this.data.axialTilt;` (a three.js radians slot),
//          and TextureBaker.js:265, which declares `uniform float axialTilt; // radians`.
//   lab    the fp key is DEGREES.  driver-presets.js:109 `axialTilt: 25` with the comment "(real
//          25.2 deg)", and the ONE law that reads the key — planet-lod-lab-core.js:907
//          `const axialTilt = d.axialTilt ?? 0;` — is under the comment planet-lod-lab-core.js:906
//          `axialTilt in degrees (default 0)` and feeds `frostLatitudeBias = clamp01(axialTilt / 90)`.
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

// ── THE OBLIQUITY DOMAIN FOLD — the seam's SIXTH silent disagreement, and the only ────────────────
// one where the UNIT was already right. Found in adversarial review of Step 1.
//
// ⚠ THE CONVERSION ABOVE IS CORRECT AND WAS STILL NOT ENOUGH. `axialTiltDegreesOf` hands the fp a
// number that is in the right unit, finite, and physically possible — and the ONE law that reads it
// cannot use it. `planet-lod-lab-core.js:907-908`:
//       const axialTilt = d.axialTilt ?? 0;
//       const frostLatitudeBias = clamp01(axialTilt / 90);
// `clamp01` has a DOMAIN of [0,90] baked into it, and Step 1 widened what arrives to [−86,+178]
// while keeping the key's name and its reader. MEASURED over the contract test's own 526-body
// corpus: 267 bodies (50.8%) arrive NEGATIVE (range −85.543…+80.769) and every one of them clamps
// to exactly 0 — one value for half the galaxy, from 526 distinct inputs. Sol is worse in the other
// direction: 4 bodies exceed 90° (3.1 rad → 177.6°, 2.2 → 126.1°, 2.14 → 122.6°, 1.71 → 98.0°) and
// all four clamp to exactly 1.000, the MAXIMUM equator-ward frost spread, when Venus at 177.6° is a
// ~2.4°-effective world that should read 0.026. That is the most wrong a value in [0,1] can be.
//
// ⚠⚠ WHY THE SIGN CAN BE DROPPED, STATED SO IT IS A DECISION AND NOT AN OVERSIGHT. Two different
// things get folded here and they have two different justifications:
//   · THE SIGN is a convention, not physics. PlanetGenerator.js:687 `const axialTilt = rings ?` and
//     PlanetGenerator.js:560 `rng.range(-1.5, 1.5)` roll a tilt ABOUT AN AXIS, consumed by
//     Planet.js:1545 `this.mesh.rotation.z`. A pole leaning −25° and one leaning +25° have the same
//     obliquity and the same seasons; only the scene-space direction differs. Nothing physical is lost.
//   · PAST 90° IS RETROGRADE, and that IS physics — but the seasons run back DOWN again, so a
//     177.6° world has the seasonal amplitude of a 2.4° world. The angle the climate laws want is
//     the effective obliquity; the retrograde BIT is a separate fact.
// ⛔ THE RETROGRADE BIT IS NOT FORWARDED, AND IS NOT LOST. It stays on the game's own record
// (`planetData.axialTilt`, untouched, still signed and still full-range) and can be read by whoever
// needs it. Adding a `retrograde` key to the condition vector would be a FIFTH key with no reader,
// which is the exact hazard this review flagged elsewhere in this file — so it is a NAMED FOLLOW-ON,
// to land with the first law that actually reads spin direction, not speculatively now.
//
// ⛔ WHY HERE AND NOT IN THE READER. `planet-drivers.js:52-65` names FIVE future laws that take
// `axialTilt` as a driver (P10 glacial flow, P11 sublimation etch, P20 meridional circulation,
// P22 seasonal volatile cycling, P23 aerosol lofting). If the fold lived in the reader, each of
// those five would have to remember it independently, a miss would be finite-and-plausible, and the
// LAB route would never catch it — every lab preset is already inside [0,90] (`driver-presets.js:109`
// = 25, `storm-e.js:68 URANIAN_OBLIQUITY: 80`, `planet-lod-lab.html:516` = 0), so a missing fold is
// invisible on the frontend where laws get developed. Folding at the producer is also what makes the
// two frontends AGREE on the key's domain, which is this program's whole thesis.
//
// ⛔ AND `deriveUniforms` IS DELIBERATELY LEFT UNGUARDED. A defensive fold there would make the
// consumer half of the gate vacuous — it would pass for any producer, including the broken one.
//
// ⚠ HAZARD THIS FOLD INTRODUCES, RECORDED BECAUSE IT IS NOT OBVIOUS: the old domain assertion
// (`Math.abs(deg) <= 180`) caught a TWICE-applied rad→deg conversion, which produces ~4900. The fold
// hides that — 1.5 rad converted twice is 4924.2°, which folds to 64.21°, an ordinary obliquity.
// So `axialTiltDegreesOf` above is kept as a PURE conversion with no fold in it, and its endpoints
// stay pinned separately (0.41 → 23.4, 1.71 → 97.98). Do not merge the two functions.

/**
 * The EFFECTIVE OBLIQUITY in degrees: the angle between spin axis and orbit normal, folded into the
 * [0°, 90°] domain every climate law in this engine assumes. Symmetric about 0° (sign is a spin-axis
 * convention) and about 90° (retrograde seasons mirror prograde ones). `undefined` in ⇒ `undefined`
 * out, for the same reason as `axialTiltDegreesOf`.
 *
 * ⛔ NaN IS DELIBERATELY NOT CAUGHT HERE, and the temptation to catch it is why this says so. An
 * `!Number.isFinite` guard returning `undefined` would turn a corrupt tilt into an ABSENT one, and
 * absent is a value this seam treats as legitimate — it would be laundered into a downstream
 * `?? default` and render as a plausible world. The block at :119-131 above argues that NaN is the
 * one failure mode in this codebase that is NOT quiet (it reaches a uniform and the body renders
 * black). That loudness is an asset. NaN in ⇒ NaN out, on purpose.
 */
export function effectiveObliquityDegreesOf(tiltDegrees) {
  if (tiltDegrees == null) return undefined;
  let t = Math.abs(tiltDegrees) % 360;
  if (t > 180) t = 360 - t;
  if (t > 90) t = 180 - t;
  return t;
}

// ── THE HABITABILITY SHAPE NORMALISATION — the seam's FIFTH silent disagreement. ───────────────────
// ⚠ THE TWO SIDES DISAGREE ABOUT WHETHER `habitability` IS A NUMBER. Found while building this step;
// not previously recorded anywhere, because nothing had ever forwarded the field.
//   lab   driver-presets.js:27 `habitability: 0.7`                  → a SCALAR
//   game  PlanetGenerator.js `habitability: habScore` — §10 symbol-only, because it sits in the
//         record literal that every step of this plan grows — assigned from
//         PhysicsEngine.js:688 `return { score: Math.min(score, 1.0), factors };` → an OBJECT
// The engine's one reader is planet-lod-lab-core.js:744 `clamp01(d.habitability ?? 0)` — and
// `clamp01` of an object is `Math.min(1, Math.max(0, {…}))` = **NaN**. NaN is the one failure mode in
// this codebase that is NOT quiet: it propagates into a uniform and the whole body renders as a black
// frame (docs/FEATURES/surface-variation-beyond-mvp.md:790 records exactly that, from an `undefined`
// axialTilt reaching a world matrix). Forwarding the raw object would therefore have shipped a
// landmine to the first step that reads the field, three steps from here.
//
// ⚠ THE FUNCTION'S OWN JSDOC IS WRONG about this: PhysicsEngine.js:637 `@returns {number} score 0-1`
// says a number, while PhysicsEngine.js:688 `return { score: Math.min(score, 1.0), factors };`
// returns an object. That is not fixed here — it is a game-side edit outside this seam — but one
// live consumer is already miscomputing because of it:
// NavComputer.js:2618 `if (pd.habitability > 0.3) lines.push(` and
// NavComputer.js:3218 `pd.habitability > 0.3` are both an object-vs-number
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
//     MoonGenerator.js:193 `atmosphere: type === 'terrestrial' ? {` — a `{ color, strength }` literal
//     closed by MoonGenerator.js:196 `} : null,`
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
// ⛔ WHAT THIS BLOCK USED TO SAY, AND WHY IT WAS RETIRED — the same failure it exists to prevent.
// It read: "THE 13 INPUTS are exactly the fields this adapter reads off `planetData` … The count is
// asserted in tests/port-condition-contract.test.js so that adding a fourteenth input without a
// provenance entry fails loudly instead of creating a blind spot." BOTH HALVES WERE FALSE, and they
// were false in this codebase's signature shape — entirely true-looking, entirely misleading:
//   · ALREADY FALSE WHEN WRITTEN. The fp literal below reads a FOURTEENTH field, `comp.carbonToOxygen`,
//     and forwards it. `Object.keys(_provenance).length` was 13.
//   · THE FENCE WAS SELF-REFERENTIAL. The test asserted `PROVENANCE_INPUTS.length === 13` and
//     `Object.keys(p) === PROVENANCE_INPUTS` — both sides derived from THIS constant, and nothing
//     read the adapter. MEASURED: injecting Step 2's own next read (`starMassEarth: d.starMassEarth`,
//     PLAN.md:201 `starMassEarth`) into the fp literal left all 47 contract tests GREEN — the 47 is
//     that era's count, not today's. A fence that cannot fail is a comment in a test-shaped costume.
//
// ⚠ THE FOURTEENTH INPUT IS NOT HYPOTHETICAL AND NOT INERT — that is why it is called out rather
// than quietly added. `carbonToOxygen` is read TODAY by two shipped consumers, and its ABSENCE is a
// claim, not a silence, because both supply `?? 0` and 0 means "definitively not a carbon world":
//   · surfaceMaterial.js:335 `cond?.composition?.carbonToOxygen` — the read sits inside
//     surfaceMaterial.js:323 `export function surfaceAlbedoOf(cond, opts) {`, NOT inside
//     surfaceMaterial.js:304 `export function surfacePaletteOf(cond) {`, which calls it four times
//     and whose palette is one of the FIVE BAKES PlanetGenerator writes onto the body record.
//     (⚠ this containment was stated the other way round until 2026-08-07 — ledger row B8.)
//     Measured on a C/O 1.2 body: dropping the field moves `fresh` from
//     [0.088, 0.085, 0.084] (graphite dark) to [0.197, 0.185, 0.168] — 2.2× brighter, and every other
//     palette slot with it.
//   · e1Regime.js:66 `export function compositionClass(cv) {` — whose C/O branch is
//     e1Regime.js:68 `cv.composition?.carbonToOxygen` — and body-condition-vector.js:107
//     `const _class = compositionClass(` uses that class to pick WHICH mass-radius law
//     `gravityRadiusRatio` applies. Measured: the class flips 'carbon' → 'rocky' and
//     the lab route's `surfaceGravity` at 1.6× drawn radius moves +38.96%.
// Population, measured over the contract test's corpus: 526/526 generated planets carry it, 12/411
// moons do, 0/39 Sol bodies do, and 1/18 lab presets does. So on Sol and on 97% of moons the engine
// is already reading a fabricated 0 for it, and the record that exists to name fabrications was silent.
//
// ── HOW THE FENCE WORKS NOW: THE ADAPTER'S CODE IS PARSED AND ITS BINDINGS RESOLVED. ──────────────
// PROVENANCE_COVERAGE maps each provenance entry to the EXACT property reads it accounts for, and
// tests/port-condition-contract.test.js holds that declaration against this module's CODE. The two
// sides of the comparison are the ADAPTER and this DECLARATION — never one constant against itself.
//
// ⭐ STATED AS A PROPERTY, NOT AS A PROCEDURE, ON PURPOSE. What this block said before described a
// text scan that no longer exists — it named brace-matching and a comment stripper, and a reader
// following it would have concluded that a read written outside `conditionFromPlanet`'s body is
// invisible to the fence. That is the OPPOSITE of the truth, in the block carrying the instruction
// this file's next editor is meant to obey. A description pinned to implementation detail is what
// rotted; the mechanism has already been rewritten twice under it. So: the property, which is what
// the next editor actually needs, and which survives the next rewrite of how it is enforced.
//
//     EVERY INPUT THIS ADAPTER READS — HOWEVER IT IS WRITTEN — MUST HAVE A DECLARED COVERAGE ROW,
//     AND EVERY DECLARED ROW MUST STILL BE READ. THE CHECK RESOLVES BINDINGS RATHER THAN MATCHING
//     TEXT, AND A NODE TYPE NOBODY HAS BUCKETED IS A FAILURE, NOT A PASS.  ⛔ A WRONG RULE FOR A
//     BUCKETED TYPE IS STILL SILENT — two such holes are known and named in KNOWN LIMITS in
//     `tests/port-condition-contract.test.js`. Read them before treating a silence as proof.
//
// Four consequences, each of them a thing an earlier version of the fence got wrong:
//   · ⛔ THE UNIT IS THE MODULE, NOT `conditionFromPlanet`'s BODY. Every function in this file is
//     covered. Moving a read into a helper, a nested closure, or module scope hides nothing, and a
//     helper's parameter becomes an input the moment the helper is CALLED with one.
//   · SPELLING IS NOT THE SUBJECT. `d.x`, `planetData.x`, `d?.x`, `d['x']`, `const {x} = d`,
//     `const p = d; p.x`, `let p; p = d`, `{ ...d }`, a ternary arm, and a helper that RETURNS the
//     input are all the same fact, because aliases of the input are resolved to a fixpoint rather
//     than pattern-matched. Naming a new spelling does not open a hole; it is already the same fact.
//   · IT RUNS IN BOTH DIRECTIONS. A read with no row names the field; a row whose read has been
//     DELETED names the row. The map cannot drift ahead of the code any more than behind it.
//   · `provenanceOf` IS PARTITIONED, NOT EXEMPT. Its reads do not COUNT as reads-needing-a-row —
//     they ARE the record, and counting them would put the record back on both sides of the
//     comparison, which is the self-referential defect above, restored. They are nonetheless
//     required to resolve to a row that ALREADY EXISTS. That body may read; it may not read
//     something undeclared.
//
// ⛔ SO: ADD A READ, ADD A ROW. If a later step reads a new field off `planetData` (Step 2 adds
// `d.tidalHeating`, `d.starMassEarth`, `d.orbitRadiusEarth` — PLAN.md:180 `impossible to add silently`)
// and does not add it here with a `provenanceOf` entry to match, the contract test goes RED naming
// the field. Proven by injection, not asserted: the test carries CONTROLS that splice each evasion
// into the REAL source in memory and require the fence to catch it, plus one that DELETES a read and
// requires the stale direction to fire — a gate whose control never moved is evidence of nothing.
//
// ⚠ THE ROWS BELOW ARE ALSO THE NAMESPACE THE READS ARE COUNTED IN, so the depth is truncated on
// purpose: one level off `planetData`, two under `composition` (that is what `comp.` means). A read
// of `d.atmosphere.physics.pressure` is therefore attributed to the declared input `d.atmosphere`
// rather than reported as a fourth undeclared thing — which is what makes `atmosphereFromPlanet`'s
// three levels of nesting analysable at all. Add the row at the depth the map speaks in.
//
// ⚠ WRITE A NEW READ AS AN ORDINARY MEMBER ACCESS ON `d` OR `comp`. Much of what the analysis cannot
// follow — the input handed to a callee it cannot see, a computed field name that is not a literal,
// the input stored into an array or iterated over — is reported by name and fails the build. That is
// deliberate and it is the difference from the two fences before this one: they were FAIL-OPEN at the
// node-TYPE level, so a construct nobody had modelled was silently fine, and five were found on disk
// with the full suite green. ⛔ But a MIS-resolved construct is not an unresolved one: a wrong rule
// for a bucketed type still passes silently, and two such holes are known (KNOWN LIMITS, in
// `tests/port-condition-contract.test.js`). So cleverness here is USUALLY a red build — not always.
//
// ⚠ WHY `composition` IS A COMPOUND ROW AND `carbonToOxygen` IS ITS OWN. The three fields the
// density/iron/volatile gate reads are a unit — a body with iron and volatiles but no density is the
// fabrication case, and one 'defaulted' for the group is the honest answer. `carbonToOxygen` is NOT
// part of that unit: it is absent on bodies whose other three are fully measured (every Sol body,
// 399 of 411 moons), and folding it into the group's all-present rule would flip those to 'defaulted'
// for a reason that has nothing to do with density. It gets its own row so it can be answered on its
// own terms.
export const PROVENANCE_COVERAGE = Object.freeze({
  radiusEarth:    Object.freeze(['d.radiusEarth']),
  massEarth:      Object.freeze(['d.massEarth']),
  composition:    Object.freeze(['d.composition', 'comp.ironFraction', 'comp.density', 'comp.volatileFraction']),
  carbonToOxygen: Object.freeze(['comp.carbonToOxygen']),
  age:            Object.freeze(['d.age']),
  T_eq:           Object.freeze(['d.T_eq']),
  eccentricity:   Object.freeze(['d.eccentricity']),
  tidalState:     Object.freeze(['d.tidalState']),
  atmosphere:     Object.freeze(['d.atmosphere']),
  surfaceHistory: Object.freeze(['d.surfaceHistory']),
  rotationHours:  Object.freeze(['d.rotationHours']),
  magneticField:  Object.freeze(['d.magneticField']),
  habitability:   Object.freeze(['d.habitability']),
  axialTilt:      Object.freeze(['d.axialTilt']),
});

/** The provenance entry names, derived from the coverage map so the two can never disagree. */
export const PROVENANCE_INPUTS = Object.freeze(Object.keys(PROVENANCE_COVERAGE));

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
 *  · `atmosphere` distinguishes `null` from absent. `null` is a MEASUREMENT: both
 *    PlanetGenerator.js:448 `let atmosphere = null;` and MoonGenerator.js:196 `} : null,`
 *    set it outright to mean "nothing retained", and the engine's airless
 *    presets agree. `undefined` means the body never said. And a visual-only `{color, strength}`
 *    wrapper — the moon bug above — is 'defaulted', because it looks like an answer and is not one.
 *
 *  · `carbonToOxygen` is 'defaulted' when the body carries none, and that is a LOUDER statement than
 *    it looks. The adapter deliberately omits the key rather than inventing one (the conditional
 *    spread in the fp literal), so the fabrication happens one step later, in the two consumers'
 *    `?? 0` — and 0 is not "unknown", it is "definitively not a carbon world". Sol reads that way on
 *    39/39 bodies. This row is the only place that fact is recorded.
 */
function provenanceOf(d, comp) {
  const seen = (v) => (v != null ? 'measured' : 'defaulted');
  return Object.freeze({
    radiusEarth:    seen(d.radiusEarth),
    massEarth:      seen(d.massEarth),
    composition:    (comp.ironFraction != null && comp.density != null && comp.volatileFraction != null)
      ? 'measured' : 'defaulted',
    carbonToOxygen: seen(comp.carbonToOxygen),
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
    // ⚠ TWO transforms, not one, and they are separate on purpose: DEGREES out of RADIANS
    // (the unit), then folded to the [0,90] EFFECTIVE OBLIQUITY the laws' `clamp01(x/90)`
    // assumes (the domain). Merging them would hide a twice-applied conversion — see both
    // blocks above.
    axialTilt:     effectiveObliquityDegreesOf(axialTiltDegreesOf(d.axialTilt)),
  };
  const condition = deriveConditionVector(fp, null, fp.radiusEarth);

  // ⛔ WHERE `_provenance` LIVES, AND WHY IT LIVES THERE.
  // It rides on the CONDITION VECTOR — the port's OUTPUT — and never on `planetData`. That matters
  // structurally, not stylistically: `planetData` is the subject of Instrument B's body-identity
  // fingerprint and Instrument C's watched set, and a port OUTPUT that lands inside its own
  // instrument's matching key is exactly the P1 defect Step 0 had to fix (the five WORLDENGINE_BAKES
  // are excluded from the hash for that reason — the exclusion itself is
  // body-identity-fence.test.js:192 `WORLDENGINE_BAKES.includes(k)`, over the list at
  // body-identity-fence.test.js:173 `const WORLDENGINE_BAKES`). Keeping
  // provenance off `planetData` means neither exclusion list needs to grow, and the fence stays a
  // fence instead of acquiring another hole. The record literal in `PlanetGenerator.generate` and
  // the four assignments under it — PlanetGenerator.js `planetData.iceness = icenessOf(condition);`
  // and its siblings, cited symbol-only per §10 because every step of this plan grows that region —
  // write only the five named bakes, so nothing carries this onto a body record; the contract test
  // asserts that rather than trusting it.
  //
  // NON-ENUMERABLE, and that is the second half of the same argument. `Object.keys`, `JSON.stringify`
  // and `{...spread}` (laws.js:315 `const c = baselineCondition({ ...condition,` spreads one) cannot see it, so
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
