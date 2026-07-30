// src/worldengine/base/giant-drivers.js
// ─────────────────────────────────────────────────────────────────────────────
// GIANT-DRIVERS — PER-SEED CONDITION → D-SLOT DERIVATION (World-Engine, atmosphere
// "derive-not-freeze" increment, Slice D / DERIVER)
//
// WHAT THIS BUILDS (plain language). The three gas-giant shear-profile inputs that USED to be frozen
// per-regime constants in climate-e5.js `DRIVER_BUNDLES` — `shellDepthFrac`, `internalHeat`,
// `dissipation` — now DERIVE per body from the condition vector, so a re-roll gives a different (but
// still regime-plausible) jet profile: a different band COUNT (Rhines wavenumber), different storm
// latitudes (the shear argmax moves), and for Sub-Neptune a different equatorial-jet DIRECTION. Two
// pure pieces (mirrors the GROUND track's condition→driver-response split):
//   drawGiantConditions(regime, baseCondition, macroSeed)  — SEEDED. Draws a regime-plausible per-body
//       condition perturbation (mass, age, T_eq, enrichment-Z) on the disjoint alea namespace
//       `giantD:cond:<regime>:<macroSeed>` (fixed draw order), anchored so the identity draw
//       (all factors = 1) reproduces the canonical bundle. Returns a NEW condition object.
//   deriveGiantDrivers(condition)                          — PURE (no rng). Maps a condition → the
//       triple via the RATIFIED anchored-multiplicative forms (DERIVE-FORMS.md FORMS TABLE), clamped
//       to the ratified per-regime ranges. Anchored: canonical condition ⇒ DRIVER_BUNDLES triple EXACT.
//
// The seed enters ONLY via drawGiantConditions; deriveGiantDrivers is a pure physics map. Same seed ⇒
// same triple ⇒ same world. climate-e5.js / storm-e.js reach the triple ONLY through the `drivers`
// argument (resolveParams merges caller drivers over DRIVER_BUNDLES), so BOTH goldens are preserved:
// the headless golden tests call with the frozen bundle (no derived drivers); only the LAB and this
// module's own unit tests pass derived D-slots.
//
// THE RATIFIED FORMS (DERIVE-FORMS.md, ratified by Max as-is 2026-07-15 — forms/ranges/priors are law;
// exponent MAGNITUDES are measure-first calibrated here, SIGNS are physics-fixed and asserted by D4):
//   internalHeat   = IH0[reg]  · (M/M0)^α · (age0/age)^β · (T0/T_eq)^γ          clamp IH0·[0.88,1.12]
//   shellDepthFrac = SDF0[reg] · (1 − δ·(Z/Z0 − 1))                             clamp to regime SDF band
//   dissipation    = DIS0[reg] · (SDF/SDF0)^ε · (T_eq/T0)^ζ                     clamp DIS0·[0.85,1.15]
// Signs (load-bearing): IH ↑mass ↓age ↓T_eq (α,β,γ>0); SDF ↓enrichment-Z (δ>0); DIS ↑SDF ↑T_eq (ε,ζ>0).
//
// ── CALIBRATION (measure-first; sweep numbers reproducible via `node tools/giant-drivers-calibrate.mjs`) ─
//   Calibrated exponents:  α=0.35  β=0.18  γ=0.30  δ=0.95  ε=0.40  ζ=0.35
//   Calibrated draw spreads (uniform ±S about the anchor): S_MASS=0.28  S_AGE=0.30  S_TEQ=0.10  S_DENS=0.28
//   Pinned 12-seed sweep: SWEEP_SEEDS below · base = canonicalGiantCondition · rot/radius from DRIVER_BUNDLES.
//
//   SWEEP HEADLINE (derived triple ranges over the 12 seeds; bandCount = rhinesWavenumber set; canonical n):
//     regime       IH            SDF           DIS           uPeak         bandCount  eqSign  (n_frozen)
//     Jovian       1.487-1.777   0.740-0.860   0.949-1.060   1.360-1.649   {12,13}    {+}     (12)
//     Saturnian    1.707-1.994   0.850-0.950   0.806-0.877   1.485-1.808   {10,11}    {+}     (11)
//     Neptunian    2.310-2.912   0.119-0.187   0.133-0.167   7.147-8.525   {2,3}      {−}     (3)
//     Sub-Neptune  1.035-1.288   0.280-0.409   0.501-0.589   2.136-2.703   {3,4}      {−,+}   (3)  ← eqSign STRADDLES
//     Hot-Jupiter  1.760-2.159   0.800-0.900   1.132-1.259   1.353-1.657   {4,5}      {+}     (5)  (storms suppressed)
//   Sub-Neptune is the ONLY regime whose SDF band crosses D_THR=0.40 → its eq-jet DIRECTION flips
//   (2/12 seeds prograde, 10/12 retrograde); all other regimes keep a fixed drift sign (DERIVE-FORMS §5.2).
//   All 5 regimes cross their Rhines rounding boundary (bandCount set-size 2). Jovian n=12.21 and Neptunian
//   n=2.529 (the audit-confirmed boundaries) both straddle. Per-regime D-floors, all cleared:
//     D1 uPeak set-size 12/12 (≥ ⌈0.75·12⌉=9) · D3 canonical anchor EXACT (≤1e-9 ⇒ bundle triple)
//     D5 derived≠frozen 12/12 (≥9) · determinism same-seed-twice bit-identical.
//   Primary storm |lat| stdev (resolveStormPlacement over the derived profile): J 0.065 · S 0.114 · N 0.070
//   · SubN 0.188 rad — all ≥ the pinned 0.035-rad floor; distinct primary |lat| ≥ 9/12 every regime.
//
// SLICE-R AUDIT MINORS honored:
//   (1) T_eq is condition.T_eq, which body-condition-vector.js labels "SURFACE temperature (NOT
//       equilibrium temp)". We use it AS the insolation proxy the forms call T_eq — semantic label
//       noted at the read site (see `derive` below). The forms only need the RATIO T0/T_eq.
//   (2) M0 is a PINNED per-regime constant (DERIVE-FORMS §3, from DRIVER_PRESETS massEarth). The mass
//       channel is SINGLE-SOURCED: drawGiantConditions back-solves the drawn condition's surfaceGravity
//       from M0·massFactor and the condition's radiusEarth, so deriveGiantDrivers' literal-form
//       M = surfaceGravity·radiusEarth² reproduces M0·massFactor EXACTLY, regardless of whether
//       radiusEarth is the DRAWN (state.planetRadiusEarth) or FP (fp.radiusEarth) value — the
//       drawn-vs-fp radius ambiguity is NEUTRALIZED (cancels), not merely chosen. (Rationale: bulk mass
//       is a body property that must not track the render radius; the raw drawn-radius mass would be
//       ±50-80% off M0 across the gas-giant archetype radius range and would clamp-saturate internalHeat.)
//   (3) The Sub-Neptune eqSign straddle (only regime whose SDF band crosses D_THR=0.40) is MEASURED, not
//       forced — the calibration confirms SubN SDF reaches ≥0.40 for some seeds (prograde) and <0.40 for
//       others (retrograde); no other regime's band crosses 0.40 (DERIVE-FORMS §5.2, ratified).
//
// DETERMINISM HARD-RULE (climate-e5 / storm-e mold): no Math.random / Date.now anywhere. The only
// entropy is the integer macroSeed via alea in the `giantD:cond:` namespace, fixed draw order. No uTime.
// THREE-FREE: imports only alea + clamp + the frozen DRIVER_BUNDLES (never imports three).
// ─────────────────────────────────────────────────────────────────────────────
import alea from 'alea';
import { clamp } from './mathutil.js';
import { E5_REGIME, DRIVER_BUNDLES, PHYS } from './climate-e5.js';

// ── Calibrated response exponents (SIGNS physics-fixed & D4-asserted; MAGNITUDES measure-first) ──────
export const GIANT_EXP = Object.freeze({
  alpha: 0.35,   // internalHeat ↑ mass
  beta:  0.18,   // internalHeat ↓ age   (older ⇒ cooler residual/contraction luminosity)
  gamma: 0.30,   // internalHeat ↓ T_eq  (more absorbed insolation lowers the emitted/absorbed RATIO)
  delta: 0.95,   // shellDepthFrac ↓ enrichment-Z (compositional stratification thins the active shell)
  epsilon: 0.40, // dissipation ↑ shellDepthFrac (deeper winds overlap the conductor ⇒ more Ohmic drag)
  zeta:  0.35,   // dissipation ↑ T_eq (hotter ⇒ more thermal ionization/conductivity)
});

// ── Calibrated per-body condition draw spreads (uniform ± about the anchor; giantD:cond namespace) ──
export const GIANT_DRAW = Object.freeze({
  S_MASS: 0.28,  // ±28% mass  (DERIVE-FORMS §1.1 "mass ±~30%")
  S_AGE:  0.30,  // ±30% age   (~±1.35 Gyr about age0=4.5)
  S_TEQ:  0.10,  // ±10% T_eq  (DERIVE-FORMS §1.1 "T_eq ±~10%")
  S_DENS: 0.28,  // ±28% enrichment (density-proxy) — the shellDepthFrac / eqSign-straddle carrier
});

export const AGE0 = 4.5;   // canonical age (Gyr); ALL gas presets omit `age` ⇒ deriveConditionVector defaults 4.5

// ── Enrichment-Z proxy weights (Z = metallicity if present, else the density-dominated proxy). ──────
// DERIVE-FORMS §1.2: condition.metallicity is `undefined` for lab presets ⇒ the density + composition
// (iron + volatile) proxy is the OPERATIVE path; metallicity is the DECLARED future primary. Density
// dominates (density0 ≫ iron+vol), so Z/Z0 ≈ densityFactor — a clean multiplicative enrichment knob.
const WZ = Object.freeze({ DENS: 1.0, IRON: 1.0, VOL: 1.0 });

// ── Pinned per-regime CANONICAL anchors (DERIVE-FORMS §3, from driver-presets.js) + ratified SDF bands.
// M0 = massEarth; T0 = T_eq (the "surface temperature" preset field the forms read as insolation proxy);
// density0/iron0/vol0 = composition fields → the Z0 enrichment anchor. IH0/SDF0/DIS0 are SOURCED from
// DRIVER_BUNDLES (single source of truth) so the D3 anchor reproduces the bundle triple by construction.
const GIANT_ANCHOR = Object.freeze({
  [E5_REGIME.GAS_GIANT]:   Object.freeze({ M0: 317.8, T0: 125,  density0: 1.33, iron0: 0.03, vol0: 0.04, sdfBand: [0.74, 0.86] }),
  [E5_REGIME.SATURNIAN]:   Object.freeze({ M0: 95.2,  T0: 95,   density0: 0.69, iron0: 0.03, vol0: 0.04, sdfBand: [0.85, 0.95] }),
  [E5_REGIME.NEPTUNIAN]:   Object.freeze({ M0: 17.1,  T0: 55,   density0: 1.64, iron0: 0.05, vol0: 0.04, sdfBand: [0.09, 0.21] }),
  [E5_REGIME.SUB_NEPTUNE]: Object.freeze({ M0: 8.2,   T0: 550,  density0: 2.20, iron0: 0.10, vol0: 0.04, sdfBand: [0.28, 0.44] }),
  [E5_REGIME.HOT_JUPITER]: Object.freeze({ M0: 400,   T0: 1400, density0: 1.30, iron0: 0.03, vol0: 0.04, sdfBand: [0.80, 0.90] }),
});

// Pinned 12-seed sweep — the calibration + the AC-DERIVER floors run over these (measure-first; chosen
// so each regime's derived uPeak crosses the Rhines rounding boundary the audit confirmed).
export const SWEEP_SEEDS = Object.freeze([1, 7, 13, 23, 42, 101, 256, 777, 1234, 2718, 3141, 9999]);

const anchorOf = (regime) => GIANT_ANCHOR[regime] || GIANT_ANCHOR[E5_REGIME.GAS_GIANT];

// The enrichment-Z proxy: metallicity primary (declared future primary), else density + composition
// (iron + volatile) — reads ONLY condition-vector slots (AC-0 driver connectivity).
function enrichmentZ(condition) {
  const meta = condition.metallicity;
  if (meta != null) return meta;                                   // declared future PRIMARY (undefined for lab presets)
  const comp = condition.composition || {};
  const dens = condition.density ?? comp.density ?? 1;
  const iron = comp.ironFraction ?? 0;
  const vol = comp.volatileFraction ?? 0;
  return WZ.DENS * dens + WZ.IRON * iron + WZ.VOL * vol;           // OPERATIVE density-dominated proxy
}

// Z0 (canonical enrichment) for a regime — evaluated at the pinned canonical density/composition, so
// the canonical condition gives Z/Z0 = 1 ⇒ shellDepthFrac = SDF0 (anchor exact).
function canonicalZ0(regime) {
  const a = anchorOf(regime);
  return WZ.DENS * a.density0 + WZ.IRON * a.iron0 + WZ.VOL * a.vol0;
}

/**
 * The CANONICAL condition vector for a regime — the identity anchor. deriveGiantDrivers(this) reproduces
 * DRIVER_BUNDLES[regime].{shellDepthFrac, internalHeat, dissipation} EXACTLY (the D3 anchor check). Mass
 * is arranged so surfaceGravity·radiusEarth² = M0 at a reference radius; the derivation is radius-invariant.
 */
export function canonicalGiantCondition(regime = E5_REGIME.GAS_GIANT) {
  const a = anchorOf(regime);
  const R_REF = 1;                                                 // any nonzero radius — mass cancels it (see §minor-2)
  return {
    regime,
    surfaceGravity: a.M0 / (R_REF * R_REF),
    radiusEarth: R_REF,
    age: AGE0,
    T_eq: a.T0,
    density: a.density0,
    composition: { ironFraction: a.iron0, volatileFraction: a.vol0, density: a.density0 },
    metallicity: undefined,                                        // operative path = density proxy
  };
}

/**
 * PURE physics map: condition → { shellDepthFrac, internalHeat, dissipation }. No RNG. The three ratified
 * anchored-multiplicative forms, clamped to the ratified per-regime ranges. Reads ONLY condition-vector
 * slots + pinned DERIVE-FORMS anchors (AC-0).
 * @param {object} condition  a condition vector (carries `regime`; lab passes drawGiantConditions output).
 */
export function deriveGiantDrivers(condition = {}) {
  const regime = condition.regime || E5_REGIME.GAS_GIANT;
  const a = anchorOf(regime);
  const bundle = DRIVER_BUNDLES[regime] || DRIVER_BUNDLES[E5_REGIME.GAS_GIANT];
  const IH0 = bundle.internalHeat, SDF0 = bundle.shellDepthFrac, DIS0 = bundle.dissipation;
  const { alpha, beta, gamma, delta, epsilon, zeta } = GIANT_EXP;

  // Mass — literal ratified form M = surfaceGravity·radiusEarth² (both condition slots; single-sourced).
  const R = condition.radiusEarth ?? 1;
  const M = (condition.surfaceGravity ?? a.M0) * R * R;
  const age = condition.age ?? AGE0;
  // NOTE (slice-R minor-1): condition.T_eq is body-condition-vector.js's "SURFACE temperature (NOT
  // equilibrium temp)" — we read it AS the forms' insolation proxy T_eq; only the ratio T0/T_eq is used.
  const T_eq = condition.T_eq ?? a.T0;
  const Z = enrichmentZ(condition);
  const Z0 = canonicalZ0(regime);

  // FORM 1 — internalHeat (energy-balance ratio; convective vigor numerator).  ↑mass ↓age ↓T_eq.
  const internalHeatRaw = IH0
    * Math.pow(M / a.M0, alpha)
    * Math.pow(AGE0 / age, beta)
    * Math.pow(a.T0 / T_eq, gamma);
  const internalHeat = clamp(IH0 * 0.88, IH0 * 1.12, internalHeatRaw);

  // FORM 2 — shellDepthFrac (jet-bearing shell fraction; sets eq-jet SIGN).  ↓enrichment-Z.
  const shellDepthFracRaw = SDF0 * (1 - delta * (Z / Z0 - 1));
  const shellDepthFrac = clamp(a.sdfBand[0], a.sdfBand[1], shellDepthFracRaw);

  // FORM 3 — dissipation (wind-paradox denominator; Ohmic braking).  ↑SDF (DERIVED) ↑T_eq.
  const dissipationRaw = DIS0
    * Math.pow(shellDepthFrac / SDF0, epsilon)
    * Math.pow(T_eq / a.T0, zeta);
  const dissipation = clamp(DIS0 * 0.85, DIS0 * 1.15, dissipationRaw);

  return { shellDepthFrac, internalHeat, dissipation };
}

/**
 * SEEDED per-body condition draw. Perturbs the regime-plausible condition inputs the forms read
 * (mass, age, T_eq, enrichment-Z) on the disjoint `giantD:cond:<regime>:<macroSeed>` alea stream,
 * fixed draw order (mass, age, T_eq, density). Anchored: the identity draw (all factors = 1) reproduces
 * the canonical condition ⇒ deriveGiantDrivers reproduces the bundle triple. The seed is the ONLY entropy.
 *
 * Uses the clean channels of the passed base condition (T_eq, age, density, composition) as centers
 * (they equal the canonical anchor at the canonical preset) and back-solves the mass channel to the
 * pinned M0 (neutralizing the drawn-vs-fp radius ambiguity — §minor-2).
 *
 * @param {string} regime         E5_REGIME.*
 * @param {object} baseCondition  deriveConditionVector output for the current preset (RESOLVED-BY-REVISE:2
 *                                — derived FRESH at the call site, never state._lastBodyDrivers).
 * @param {number} macroSeed      integer world seed.
 * @returns {object} a NEW condition object (tagged with regime) for deriveGiantDrivers.
 */
export function drawGiantConditions(regime = E5_REGIME.GAS_GIANT, baseCondition = {}, macroSeed = 0) {
  const a = anchorOf(regime);
  const b = baseCondition || {};
  const rng = alea('giantD:cond:' + regime + ':' + (macroSeed | 0));

  // fixed draw order → byte-deterministic
  const massFactor = 1 + (rng() - 0.5) * 2 * GIANT_DRAW.S_MASS;
  const ageFactor  = 1 + (rng() - 0.5) * 2 * GIANT_DRAW.S_AGE;
  const teqFactor  = 1 + (rng() - 0.5) * 2 * GIANT_DRAW.S_TEQ;
  const densFactor = 1 + (rng() - 0.5) * 2 * GIANT_DRAW.S_DENS;

  // Mass channel: back-solve gravity so M = surfaceGravity·radiusEarth² = M0·massFactor (radius cancels).
  const R = b.radiusEarth ?? 1;
  const drawnMass = a.M0 * massFactor;
  const surfaceGravity = drawnMass / (R * R);

  // Clean channels: perturb the real base (= canonical anchor at the canonical preset) multiplicatively.
  const age = (b.age ?? AGE0) * ageFactor;
  const T_eq = (b.T_eq ?? a.T0) * teqFactor;
  const baseDensity = b.density ?? b.composition?.density ?? a.density0;
  const density = baseDensity * densFactor;

  return {
    ...b,                       // passthrough: composition (iron/vol for the Z proxy), metallicity, etc.
    regime,
    surfaceGravity,
    radiusEarth: R,
    age,
    T_eq,
    density,
  };
}

// ── Convenience: derive the triple for a drawn (regime, baseCondition, macroSeed) in one call. ───────
export function deriveGiantDriversForSeed(regime, baseCondition, macroSeed) {
  return deriveGiantDrivers(drawGiantConditions(regime, baseCondition, macroSeed));
}

// ─────────────────────────────────────────────────────────────────────────────
// S1 — RHINES RADIUS WIRE + ROTATION DRAW (world-engine-atmo-deck-spiral-rhines)
//
// The Rhines band-count law (climate-e5 rhinesWavenumber) was already correct; the LAB wire fed it
// preset CONSTANTS instead of the DRAWN radius/rotation at both call sites. These pure helpers single-
// source the radius/rotation normalization (killing the two-site divergence) and draw rotation per
// archetype on the disjoint `giantD:rot:` alea stream. The only entropy is the seed via alea; no
// wall-clock, no Math.random — same static-source discipline as the deriver above.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalize a DRAWN (radiusEarth, rotationHours) into the Jupiter-normalized rotationRate/radius the
 * writer's DRIVER_BUNDLES override expects (resolveParams merges these over the frozen bundle). Single-
 * sourced so rebakeE5Bands and applyStormState (the two lab call sites) can never diverge again — the
 * broken wire that AC-RHINES fixes read (9.9/rotH, R/11.2) off the PRESET, not the drawn state.
 */
export function giantDriverScalars(planetRadiusEarth, rotationHours, e5RotationScale = 1) {
  return {
    rotationRate: (9.9 / (rotationHours ?? 24)) * (e5RotationScale ?? 1),   // Jupiter 9.9 h → 1.0
    radius: (planetRadiusEarth ?? 1) / 11.2,                               // Jupiter 11.2 RE → 1.0
  };
}

// Per-archetype GAS rotation ranges (hours). NOTE (lens fold F11): there is deliberately NO solid-ice
// key here — the PRESET_ARCHETYPE map routes BOTH the Neptunian and hazy sub-Neptune presets to the
// SHARED sub-neptune tag (V2-3 Option-B taxonomy), while the solid-ice tag belongs to airless bodies
// (Frozen / Europa) that carry no gas rotation range and correctly stay canonical. Only gas-bearing
// archetypes appear; any body whose tag is absent falls through drawRotationHours to canonical hours.
export const ROTATION_RANGES_HOURS = Object.freeze({
  'gas-giant':   [8, 14],    // audit footnote 16
  'sub-neptune': [12, 20],   // Neptunian + hazy sub-Neptune both ride this shared key
});

/**
 * Tidal-lock (pseudo-synchronous) rotation period from the orbit, via Kepler's third law
 * P = 2π√(a³/GM). `a` in Earth radii, star mass in Earth masses; returns HOURS. Used ONLY for the
 * hot-Jupiter-class identity below — never for a drawn value.
 */
export function tidalLockRotationHours(orbitRadiusEarth, starMassEarth) {
  const a = (orbitRadiusEarth ?? 0) * 6.371e6;              // m (1 Earth radius = 6.371e6 m)
  const GM = 6.674e-11 * (starMassEarth ?? 1) * 5.972e24;   // m³/s² (G · M_star, M in Earth masses)
  return (2 * Math.PI * Math.sqrt((a * a * a) / GM)) / 3600;
}

/**
 * Draw a body's rotation period (hours). The hot-Jupiter-CLASS identity — locked AND a hydrogen (h2-he)
 * envelope, the lab's existing thermalStrength idiom — is DERIVED tidally locked from the orbit, NOT
 * drawn (lens fold F10: gating on `locked` alone would send every locked SOLID preset down the Kepler
 * branch, a real behavior change; the hot-Jupiter preset is also ABSENT from PRESET_ARCHETYPE, so the
 * identity can never be archetype-keyed). Gas archetypes draw uniformly from ROTATION_RANGES_HOURS on
 * the disjoint `giantD:rot:` alea stream; every other body (no gas range) returns its canonical hours —
 * locked or not, terrestrial or icy. alea is the ONLY entropy.
 */
export function drawRotationHours({ archetype, canonicalHours, locked, hydrogenAtmo,
                                    orbitRadiusEarth, starMassEarth }, seed) {
  if (locked && hydrogenAtmo)                               // hot-Jupiter-class identity ONLY
    return tidalLockRotationHours(orbitRadiusEarth, starMassEarth);   // DERIVED, not drawn
  const range = ROTATION_RANGES_HOURS[archetype];
  if (!range) return canonicalHours ?? 24;                 // no gas range ⇒ canonical (solids/terrestrial)
  const r = alea('giantD:rot:' + archetype + ':' + (seed >>> 0))();
  return range[0] + r * (range[1] - range[0]);
}
