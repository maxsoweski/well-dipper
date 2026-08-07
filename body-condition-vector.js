// body-condition-vector.js — the pure `_fp → condition vector` derivation (World Engine V2-0 Slice C).
//
// PURPOSE (BUILD-PLAN §2 Slice C / AC4): surface every body-condition scalar the V2-1 E1 regime
// selector will read (composition/density, age, radius, eccentricity, the RAW tidal Io-ratio as an
// explicitly-named field, shellThickness) as ONE nested `condition` sub-object attached to bodyDrivers.
// Importable by the lab (planet-lod-lab.html buildBodyDrivers), the AC1 byte-identity harness
// (tests/fixtures/v2-0-carrier-golden.mjs), the AC4 test, and — later — V2-1 E1 at the writeBodyRelief seam.
//
// SHADOW-MODE / BYTE-SAFETY: this vector is attached NESTED under bodyDrivers.condition, never as flat
// keys. The tune builders (driversToTune / magmaDriversToTune) read only flat keys and ignore unknown
// fields, so the widened bundle is inert — AC1 byte-identity (condition-less golden vs condition-bearing
// gate bundle) is the mechanical proof. R1: a FLAT `age` would re-drive magmaThermal (magmatism.js reads
// flat `d.age`); nesting keeps `condition.age` invisible to it. R4: shellThickness is surfaced AS-IS —
// NO d³ mantle-depth transform is baked here; the semantic split (z/D/d triple-duty) is V2-1's job.
import { bodyShellThickness, bodyRawTidal, bodySurfaceGravity } from './src/worldengine/base/baseStep.js'; // Slice B helpers + AC6 surfaceGravity
import { compositionClass } from './src/worldengine/base/e1Regime.js'; // gravity-selfcompression: the rocky/icy/gas/carbon gate (imports only alea + mathutil — no cycle)

// ── The mass-radius shape behind surface gravity (gravity-selfcompression-2026-07-28) ─────────────
//
// WHAT THIS REPLACES. Until now this file asserted, in its own comment, that
// "M_derived(R) = M_c·(R/R_c)³ ⇒ g = g_c·(R/R_c)" — CONSTANT DENSITY. That is false above 1 R⊕:
// larger rocky planets self-compress and get denser, so gravity rises faster than radius. The lab
// under-read a 1.6 R⊕ super-Earth's gravity by 39% (and the impact-airless preset by 174%).
//
// ⚠ WHAT KIND OF KNOWLEDGE THIS IS. There is NO measured super-Earth gravity and NO measured
// super-Earth topography — no rocky exoplanet surface has ever been spatially resolved. Both
// exponents below come from interior-structure MODELS. Everything at or below 1 g is anchored to
// Solar System bodies and is CALIBRATION; everything above is DERIVATION. A future reader must not
// conflate them, which is why they are two named constants with two separate sources rather than
// one fitted number.
//
// HIGH BRANCH — Zeng, Sasselov & Jacobsen 2016, ApJ 819:127 (arXiv:1512.08827):
//     R/R⊕ = (1.07 − 0.21·CMF)·(M/M⊕)^(1/3.7),  applicable 1–8 M⊕ and CMF 0.0–0.4.
// M ∝ R^3.7 ⇒ g = M/R² ∝ R^(3.7−2) = R^1.70, EXACTLY, at every R and every CMF: the prefactor
// enters g only as a multiplicative constant and cancels identically in the ratio form used below.
// So no CMF / iron-fraction plumbing is needed — the exponent is composition-blind WITHIN the rocky
// class. Validity in radius terms: R ∈ [1.000, 1.754] (8^(1/3.7) = 1.7542). Beyond that this is
// extrapolation of the cited fit, and the reachable radius domain runs to 16.
//
// LOW BRANCH — Valencia, O'Connell & Sasselov 2006 (arXiv:astro-ph/0511150, Icarus 181:545),
// Table 2: five fitted β = dlnR/dlnM in 0.2991–0.3094 ⇒ n = 1/β − 2 = 1.23–1.34. Self-compression
// weakens as mass falls, so the exponent drops TOWARD the incompressible value of 1 — it does NOT
// reach it, and using 1.0 here (the naive constant-density value) would be wrong by ~33% across the
// band where most of the preset table lives.
// ⚠ INFERENCE FLAG, stated because it is ours and not the paper's: Valencia's sub-Earth family is
// Super-MERCURIES (core mass fractions 50/65/80%), not Earth composition. Extrapolating their CMF
// trend down to Earth-like CMF is our step. 4/3 is the top of the defensible bracket, chosen for
// being exact and rational rather than for being more precise than the evidence.
export const GRAV_R_EXP_SUB = 4 / 3;   // R ≤ 1 — Valencia+2006 (inference, see flag above)
export const GRAV_R_EXP_SUPER = 1.70;  // R > 1 — Zeng+2016, exact given M ∝ R^3.7

/**
 * f(R) — the mass-radius shape in ABSOLUTE Earth radii, continuous at the R = 1 join (1^a = 1 on
 * both branches). The value is continuous; the DERIVATIVE is not, and that kink is real physics
 * (the compression regime genuinely changes), not an artifact to smooth away. A smooth blend was
 * considered and rejected: it needs a sharpness parameter that nothing in the literature constrains,
 * and it lands within ~5% of this everywhere.
 *
 * ⚠ IT MUST BE ABSOLUTE, NOT A RATIO POWER. Gravity below is an anchored ratio f(R)/f(R_c), and an
 * anchored ratio agrees with a piecewise-in-absolute-R law ONLY when R and R_c sit on the same
 * branch. 8 of the 13 rocky/icy presets have R_c < 1, so for them a single ratio power is wrong at
 * every off-canonical radius — it would fix super-Earths by breaking Mars, Mercury, Europa and Titan
 * (56% high at Mars, R = 4).
 */
export function gravityRadiusShape(radiusEarth) {
  const r = Math.max(radiusEarth, 1e-6);  // degenerate ~0 radius cannot produce a non-finite shape
  return r <= 1 ? Math.pow(r, GRAV_R_EXP_SUB) : Math.pow(r, GRAV_R_EXP_SUPER);
}

/**
 * The multiplier on the canonical gravity g_c, normalized at the preset's canonical radius.
 *
 * BYTE-IDENTITY AT CANONICAL is the reason this stays a RATIO rather than an absolute re-derivation
 * from a Zeng M(R): when R === R_c the numerator and denominator are the same float, so x/x is
 * exactly 1.0 and g_c · 1.0 === g_c bit-for-bit — every golden, NAMED_BODY and headless path passes
 * R === R_c, so no fixture moves. An absolute re-derivation would give g(1 R⊕) = 0.99355 instead of
 * 1.000 and would move all 75 carrier rows.
 *
 * THE GATE: the self-compression law applies to the ROCKY class only. Zeng is a two-layer
 * iron/silicate fit; it has no standing for h2-he envelopes (whose real dg/dR is flat-to-negative —
 * measured between preset pairs: Neptunian→Saturnian −0.048, Jovian→Hot Jupiter −0.456), for ice
 * mantles (a different EOS family), or for carbon worlds. Those keep the retired exponent of 1 —
 * not because 1 is right for them, but because it is the status quo and changing it would be a
 * retune with no citation behind it. That debt is declared, not hidden.
 */
export function gravityRadiusRatio(radiusEarth, canonicalRadiusEarth, compClass) {
  if (compClass !== 'rocky') return radiusEarth / canonicalRadiusEarth;  // byte-identical to the retired law
  return gravityRadiusShape(radiusEarth) / gravityRadiusShape(canonicalRadiusEarth);
}

// deriveConditionVector(fp, derived, radiusEarth) — pure, no side effects.
//   fp           = the raw DRIVER_PRESETS entry (composition, age, radiusEarth, eccentricity, …).
//   derived      = deriveUniforms(fp, tier) uniforms (has surfaceGravity, tidalHeat[RAW]); the lab passes
//                  its live `u`, the harness passes the same fresh derive.
//   radiusEarth  = the DRAWN render radius (state.planetRadiusEarth in the lab; fp.radiusEarth headless
//                  fallback) — R5: canonical for NAMED_BODY, seeded for archetypes.
export function deriveConditionVector(fp, derived, radiusEarth) {
  // The three fields the composition gate reads, hoisted so the gate classifies EXACTLY the values
  // the vector carries. Deriving them twice would let the gate drift from the body it is judging.
  const _density     = fp.composition?.density ?? 5.5;
  const _composition = fp.composition ?? null;
  const _atmosphere  = fp.atmosphere ?? null;
  // D14 gravity: R_c = canonical preset radius, R = the drawn 3rd arg (both with the legacy fallback
  // chain, unchanged). The class decides WHICH mass-radius law applies — see gravityRadiusRatio.
  const _R_c   = fp.radiusEarth ?? 1.0;
  const _R     = radiusEarth ?? _R_c;
  const _class = compositionClass({ atmosphere: _atmosphere, composition: _composition, density: _density });

  return {
  density:         _density,                             // composition/density
  composition:     _composition,                         // D2 volatile / D9 iron / D10 C:O passthrough
  age:             fp.age ?? 4.5,                        // D16 (age0 fallback)
  radiusEarth:     _R,                                   // radius (drawn value; fp fallback headless — R5)
  eccentricity:    fp.eccentricity ?? 0,                 // D12 input
  // ── V2-1 AC6 plumbing (gate-1 GAP-1/GAP-2): the two scalars E1's L/Φ/gMod need, missing today. ──
  T_eq:            fp.T_eq ?? 288,                        // SURFACE temperature (D3-MF2 — NOT equilibrium temp); raw-preset read (baseStep reads T_eq internally but never returns it). 288 = lab route default; fallback unreached (all 17 presets define T_eq).
  // D14 — gravity coherence (V2-6 §1A / AC-GCOHERE, exponent corrected by
  // gravity-selfcompression-2026-07-28). g_c = today's expression unchanged (canonical-preset g,
  // EXPOSED from baseStep deriveBodyScalars g=M/R², never re-derived inline). The drawn radius R
  // scales it through the mass-radius SHAPE defined at the top of this file:
  //     g = g_c · f(R)/f(R_c),   f(R) = R^(4/3) for R ≤ 1,  R^1.70 for R > 1,  ROCKY CLASS ONLY.
  // The retired form was g = g_c·(R/R_c), i.e. constant density M ∝ R³ — false above 1 R⊕, where
  // self-compression makes larger rocky planets denser. Non-rocky classes keep the retired exponent
  // (see gravityRadiusRatio for why that is status quo rather than endorsement).
  // BYTE-EXACT at canonical, unchanged from before: every golden/NAMED_BODY/headless path passes
  // R === R_c, so f(R)/f(R_c) is x/x on the identical float = 1.0 exactly and g_c·1.0 === g_c
  // bit-for-bit — no fixture re-capture (FENCE 1/2).
  // ⚠ CONSEQUENCE WORTH NAMING HERE because it is invisible at this line: e1Regime.massEarthOf
  // reconstructs M = g·R², so on the rocky branch the mass law IT sees is now M_c·(R/R_c)^3.7 above
  // 1 R⊕ and ^(10/3) below, not a flat ^3. e1Regime.js was not edited; what it reads changed.
  // NOT giant-drivers: giant-drivers.js:234 back-solves surfaceGravity = drawnMass/(R*R) from a
  // PINNED mass, so it never reads this law on any reachable path. An earlier version of this
  // comment claimed it did; that was wrong and is corrected here rather than quietly dropped.
  surfaceGravity:  (derived?.surfaceGravity ?? bodySurfaceGravity(fp)) * gravityRadiusRatio(_R, _R_c, _class),
  // ── V2-1 Slice B addendum (compositionClass gas terminal): E1's Stage-A reads atmosphere.composition
  //    ('h2-he' → 'gas', BUILD-PLAN §4.4). GAP not enumerated by gate-1 (which only sized L's inputs), so
  //    Slice A did not plumb it; surfaced here as a THIRD nested passthrough (same byte-safe discipline as
  //    T_eq/surfaceGravity — nested under condition, invisible to the flat-key tune builders, AC1-inert).
  atmosphere:      _atmosphere,                          // atmosphere passthrough (composition read by compositionClass; null for airless presets, handled by ?.composition)
  // ── V2-3 AC-PLUMB-RECONCILE (a): the writeBodyRelief dispatch's locked-awareness (eyeball-despun + T_ss)
  //    reads condition.tidalState.locked — the V2-1 BUILD-PLAN §4.5 gap. NESTED (byte-safe like T_eq /
  //    surfaceGravity — invisible to the flat-key tune builders → AC1-inert). computeE1 stays locked-BLIND;
  //    ONLY the dispatch layer reads this (as writeBodyRelief already reads a `locked` arg today). ──
  tidalState:      { locked: !!(fp.tidalState && fp.tidalState.locked) },
  // ── V2-4 Slice C5 (E2-figure descriptor) addendum: D8 rotationHours plumbed into the condition vector.
  //    Until now NO field carried spin HERE — the gas-band derivation reads the RAW `_fp.rotationHours` in
  //    the lab (planet-lod-lab.html), never this vector. NESTED (like T_eq / surfaceGravity / tidalState) ⇒
  //    invisible to the flat-key tune builders (driversToTune / magmaDriversToTune) and to computeE1, which
  //    read only named keys — so this widening is BYTE-INERT by the same V2-0 precedent the 75-golden proves
  //    (adding a nested key no path reads leaves every HASHED_FIELD untouched). The SOLE reader is
  //    bodyFigure.deriveFigureDescriptor (the E2-figure ω source); the write-path dispatch never reads it.
  //    Fallback 24 h = the driver-presets D8 default (terrestrial presets omit spin — inert here too).
  rotationHours:   fp.rotationHours ?? 24,               // D8 spin (hours) — figure ω source ONLY; never a tune-builder / computeE1 input
  rawTidalIoRatio: derived?.tidalHeat ?? bodyRawTidal(fp), // D12 RAW, explicitly named + un-calibrated (m_hp source)
  shellThickness:  bodyShellThickness(fp),               // baseStep helper (Slice B) — raw scalar, NO d³ transform (R4)
  magneticField:   fp.magneticField,                     // D13 data-only (undefined for lab presets)
  metallicity:     fp.metallicity,                       // metallicity data-only (undefined for lab presets)
  // ── STEP 1 of one-pipeline-two-frontends-PLAN.md — the WIDENED condition contract. ────────────
  // Five additive passthroughs. Same byte-safe discipline as T_eq / surfaceGravity / rotationHours
  // above: nested under `condition`, invisible to the flat-key tune builders (driversToTune /
  // magmaDriversToTune) and to computeE1, which read only named keys. No law reads any of them
  // today — that is what makes the step additive, and it is asserted (not assumed) by
  // tests/port-condition-contract.test.js.
  //
  // ⚠ surfaceHistory WAS ALREADY BEING HANDED IN AND SILENTLY DROPPED. The `surfaceHistory:` key in
  // conditionFromPlanet.js's `const fp = {` literal has put it there since the port was written,
  // and every lab preset carries one
  // (driver-presets.js:27 onward) — but this return literal never emitted it, so
  // `condition.surfaceHistory` was `undefined` on BOTH front-ends. PLAN §2 states it exactly:
  // "surfaceHistory goes in and is not emitted — the loss is in the vector, not the adapter."
  // NO DEFAULT IS INVENTED HERE. The adapter already supplies the game-side default
  // (that same `surfaceHistory:` fp key — grep it, do not chase a line number: Step 1 alone added
  // 239 lines to that file and Steps 2-12 each add more); a second default site is a second place
  // to fabricate a number,
  // and `_provenance` could not tell the two apart. A preset without one gets null, which reads as
  // "no record" rather than as "a record of nothing happening".
  surfaceHistory:  fp.surfaceHistory ?? null,
  // R_c — the CANONICAL radius, kept distinct from `radiusEarth` above, which is the DRAWN one.
  // On the lab route they differ whenever the GUI radius slider is off the preset value; on the
  // game route they are the same float by construction and Step 2's ruling says to keep it that way
  // ("do not invent a second game radius" — the game has one radius per body). Emitting R_c is what
  // lets a consumer ASK which of the two it wants instead of guessing, and Step 3's `giantRegimeOf`
  // population filter reads it by name.
  radiusEarthCanonical: _R_c,
  // D15 — the authored/scored habitability. Data-only, exactly like magneticField and metallicity.
  // ⚠ surfaceMaterial.js's biosphere law deliberately does NOT key on this (see its note at :125);
  // that decision is unchanged and stays correct. Emitting the field makes it REACHABLE, not read.
  habitability:    fp.habitability,
  // D3 obliquity — ⚠ DEGREES, AND THE NAME SAYS SO ON PURPOSE. This is the seam's FOURTH unit
  // disagreement (after density kg/m³-vs-g/cc and T_eq equilibrium-vs-surface, both handled in
  // conditionFromPlanet.js):
  //     lab   driver-presets.js:109  `axialTilt: 25`   for Mars's 25.2°  → DEGREES
  //     game  SolarSystemData.js:180 `axialTilt: 0.41` for Earth's 23.4° → RADIANS
  // and the ONE law that reads the fp key is planet-lod-lab-core.js:907-908,
  // `clamp01((d.axialTilt ?? 0) / 90)` — degrees. So the fp key `axialTilt` means DEGREES on both
  // routes (conditionFromPlanet converts at the seam), and this vector key carries the unit in its
  // name so that a reader who knows the GAME's radian field cannot mistake one for the other.
  // A single unqualified `axialTilt` on the vector is precisely how the other three unit bugs
  // happened: one name, two units, no warning.
  axialTiltDeg:    fp.axialTilt,
  };
}
