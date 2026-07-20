// src/worldengine/base/bombardment.js
// World Engine V2-6 — EXOGENIC bombardment (crater-population host channel), km-space SFD rewrite.
//
// THREE-FREE, PURE, RESURFACING-BLIND. Reads ONLY condition-vector SCALARS (radiusEarth, surfaceGravity, age,
// atmosphere.pressure, T_eq, rawTidalIoRatio) + the finished carrier.verts/adj + its own alea('bombard:'+seed)
// stream + the pure scalar helpers radPerKm (baseStep) and erosionOf (surfaceMaterial). Writes ONLY the unhashed
// signed Float32Array `craterField` — never carrier.height nor any HASHED_FIELD (own-channel discipline;
// byte-inert against the 75-golden). It reads NO geodynamic tuple, NO regime, NO composition class, NO
// archetype/label, and imports NO derived-dispatch module — so the shadow-audit's blind-writer scan passes by
// construction. It gates target-vs-not a condition-scalar DATA predicate (isImpactSurface), never a regime read.
//
// WHY THE V2-6 REWRITE (BUILD-PLAN §1C, driver-wiring audit §3 footnotes 1–3,5–6): V2-5's population was
// gravity-drawn in ANGULAR units with a gravity-COUNT factor and a binary atmo/tidal gate. Three physics errors:
// (1) primary impact FLUX does not depend on target surface gravity — the gravity-count factor was unphysical (footnote 1);
// (2) crater angular size must fall as 1/R at fixed km diameter, so a bigger planet reads finer-cratered —
//     the angular draw was radius-blind (footnote 2); (3) the binary tidal/atmo gate produced Moon-cratered
//     Rocky/Ocean/Titan and gas-giant "surfaces" — resurfacing is CONTINUOUS (footnotes 3,5). The rewrite:
//   • diameters are drawn in KM and converted at stamp time (δ = D_km·radPerKm(R)) ⇒ size ∝ 1/R;
//   • count is the CLOSED-FORM analytic population N_analytic = F_REF·R²·chronN(t_exp)·screen — g-INDEPENDENT
//     (dN/dg=0), ∝ R², Neukum-chronology-shaped, atmo-screened; never looped;
//   • only craters ABOVE the mesh floor are stamped discretely (N_stamp, tens–hundreds, R-invariant by the
//     scale-free theorem); the sub-floor SFD mass folds analytically into regolithRoughness (returned in the
//     schedule for downstream/S3 consumers);
//   • exposure age is continuous: t_exp = min(age, T_RESURF_TIDAL/td, T_RESURF_ERODE/erosion) — Io-class tides
//     and rain/wind erosion each shorten the retained record, so airless dead worlds accumulate the full age
//     while active/atmospheric ones self-suppress BY PHYSICS, not by a gate;
//   • equilibrium (N_ret = N_eq·(1−exp(−N_prod/N_eq))) is an EMERGENT property of OBLITERATION STAMPING —
//     craters stamp oldest-first, a bowl RESETS the field (obliterating older topography), rims/ejecta
//     accumulate — never a coded tanh saturation formula (CRATER_SAT_N survives only as the final safety clamp).
//
// STEP-0 CLOSED-FORM PRE-CHECK: calibration/crater-sfd-km.mjs (docs/WORKSTREAMS/…-v2-6-…/calibration) solved
// F_REF against the AC-POPSWEEP [10%,80%] coverage gate and verified N_analytic ∝ R² (strict), N_stamp ≤
// N_STAMP_SAFETY, screen<1 Venus-class / ≈1 Mars-class, and the deep-envelope gate — BEFORE this writer. Its
// printed F_REF=488000 is the source of truth the F_REF constant below cites.
//
// S3 GRAFT (BUILD-PLAN §1D, footnote 4): per-crater viscous ICE RELAXATION now rides on the stamp loop. Each
// stamped crater's floor/wall relaxes toward a dome and its rim/ejecta relaxes 100× slower (P_RIM) by the
// Arrhenius creep fraction ε (iceRelaxation below), gated by icenessOf(condition). On a warm/tidal icy world old
// craters read as domed palimpsests with crisp rims; on cold rock (iceness 0) OR a deep-frozen icy surface
// (T ⇒ η so large that t/τ<1e-16) ε≡0 exactly ⇒ the field is BIT-IDENTICAL to the un-relaxed S2 write. The
// craterField stays unhashed, so relaxation is byte-inert against the 75-golden regardless.
//
// DELIBERATE NON-GOALS (this slice, S3): the crystal material scalar is S4; the worldSeed re-roll is S5. Legacy
// F2/F3 in-shader crater synth is untouched. The VERTICAL amplitude / zone geometry of craterProfile is unchanged
// — relaxation is applied as a multiplicative fraction on the existing zone values plus the dome term.

import { clamp } from './mathutil.js';
import { KM_PER_EARTH_RADIUS, radPerKm } from './baseStep.js';   // pure km→angular scalar (NOT a dispatch module)
import { erosionOf, icenessOf } from './surfaceMaterial.js';      // condition-pure erosion + iceness scalars (leaf, imports nothing)
import alea from 'alea';

// ── km-space SFD priors (calibration/crater-sfd-km.mjs step-0 pre-check, 2026-07-19) ─────────────────
export const C_BASIN      = 1.0;    // SPA/disruption crater-diameter limit as a fraction of R_km (target physics)
export const C_ATMO_KM    = 0.16;   // graded atmo-floor scale (km): D_ATMO = C_ATMO_KM·P^P_ATMO_EXP
export const P_ATMO_EXP   = 0.65;   //   anchored Venus 92 bar → ~3 km, Mars 0.01 bar → ~8 m
export const D_SFD_MIN_KM = 1.0;    // SCREENING anchor (Lens L13 — NOT a stamp floor; the mesh floor governs stamping)
export const B_SFD        = 2.0;    // cumulative SFD exponent; differential pdf ∝ D^−(B_SFD+1)
export const F_REF        = 488000; // count normalization; step-0 solved it against the [10,80]% coverage gate
export const N_STAMP_SAFETY = 5000; // a SAFETY assert on the loop count — NEVER a binding min()
// ── the K_GS gravity SIZE law is kept EXACTLY (correct π-group scaling); the gravity COUNT factor is REMOVED (footnote 1) ─
export const G_REF        = 0.5;    // neutral gravity reference (kept)
export const K_GS         = 0.17;   // lower gravity → larger craters (D ∝ g^−0.17); kept exactly from V2-5
// ── Neukum lunar chronology SHAPE (published; normalized at AGE_REF) — footnote 3 ────────────────────
export const A_NEU        = 5.44e-14;
export const LAMBDA_NEU   = 6.93;   // /Ga
export const B_NEU        = 8.38e-4;
export const AGE_REF      = 4.0;    // Ga — chronology normalization (chronN(4.5)/chronN(4.0) ≈ 31 = the audit's ~30×)
export const AGE_MAX      = 4.6;    // Ga — a SURFACE cannot predate the solar system (~4.567 Ga). Physical cap on
                                    //   the exposure age: without it the Neukum exponential diverges for
                                    //   out-of-range ages (age 8 Ga → chronN ~1e12 → N_stamp ~1e15, an unbounded
                                    //   loop). Bounds N_stamp ≤ ~300 (≪ N_STAMP_SAFETY) at every physical input;
                                    //   inert on every preset (max preset age 4.5). Deviation #1 (§8, adjudicable).
// ── continuous exposure age (footnote 5): binary tidal gate → t_resurf ∝ 1/tidalHeat, plus erosion (footnote 13) ─
export const T_RESURF_TIDAL = 0.7;  // Ga·Io-ratio: td=0.15 → full exposure; Europa td≈137 → ~5 Myr → ≈0 craters BY PHYSICS
export const EPS_TD       = 1e-6;
export const T_RESURF_ERODE = 0.1;  // Ga: erosion=1 (Rocky/Ocean) → 0.1 Ga crater-retention age (real Earth ~0.1 Ga)
export const EPS_ER       = 1e-6;
// ── self-gate (condition scalars ONLY): cold solid lithosphere + a reachable solid surface (Lens L1/L17) ─────
export const CRATER_T_MAX = 450;    // K — cold enough to be a solid cratered lithosphere (not molten)
export const P_SURF_MAX   = 200;    // bar — above Venus (92), far below the giants' 1000-bar H2-He envelopes:
                                    //   in a deeper envelope impactors ablate/airburst and there is no reachable
                                    //   solid surface ("the envelope IS the surface"). A pure scalar ceiling —
                                    //   chosen over an atmosphere.composition==='h2-he' string read (§4 adjudicable).
// ── mesh resolution floor (angular): craters below this fold into regolithRoughness, never stamped discretely ─
export const MESH_FLOOR_RAD = 0.055;// 3·meanEdgeAngle at the lab display N (~12k nodes ⇒ meanEdge ≈ 2/√N ≈ 0.0183)

// ── VERTICAL amplitude (normalized-height) + dimensionless profile SHAPE — unchanged from V2-5 (crater-scale.mjs);
//    A is keyed on ANGULAR diameter δ (A ∝ δ^0.5): normalized height is planet-relative, so the angular form is
//    defensible (§4 adjudicable). The profile zone arithmetic is untouched this slice (ε relaxation is S3). ─────
export const CRATER_DEPTH_N = 0.18; // A(D_REF): bowl amplitude of a D_REF crater
export const D_REF_RAD    = 0.50;   // reference angular diameter (A(D_REF_RAD)=CRATER_DEPTH_N)
export const DEPTH_POW    = 0.5;    // sub-linear depth↑ with size
export const MIN_BASIN_DEPTH_N = 0.08; // legibility floor: a δ=D_REF basin is a visible bowl
const FLOOR_FRAC    = 0.5;          // flat floor out to FLOOR_FRAC·(δ/2)
const RIM_HEIGHT_FRAC = 0.20;       // rim crest at +RIM_HEIGHT_FRAC·A
const EJECTA_FRAC   = 0.05;         // ejecta-apron lift at +EJECTA_FRAC·A
const RIM_W         = 0.1;          // rim zone width = RIM_W·δ beyond the crest
const RIM_FRAC      = 1.0;          // ejecta-apron outer edge = RIM_FRAC·δ beyond the crest
export const CRATER_SAT_N = 0.5;    // FINAL safety clamp only (equilibrium is emergent from obliteration, not this)

// ── S3 ICE RELAXATION (BUILD-PLAN §1D, footnote 4) — Arrhenius creep of an ICY crater floor toward a dome. ─────
export const ETA_M      = 1e14;     // Pa·s — reference ice viscosity at T_MELT (Arrhenius pre-factor)
export const QSTAR      = 60e3;     // J/mol — activation energy for ice creep
export const RGAS       = 8.314;    // J/mol/K — gas constant
export const T_MELT     = 273;      // K — water-ice melting point (η reference temperature)
export const DT_TIDAL   = 120;      // K — bounded tidal warming: T_rel = T_eq + DT_TIDAL·td/(1+td)
export const RHO_ICE    = 917;      // kg/m³ — ice density (relaxation driving stress ρ·g·D)
export const SEC_PER_GA = 3.156e16; // s per Ga (1 Ga = 1e9 yr · 3.156e7 s/yr) — τ is computed in SI then → Ga
export const P_RIM      = 2;        // CONTRACT-PINNED phenomenological rim-persistence exponent (Lens L16): the rim
                                    //   relaxation time-scale is τ·(1/RIM_W)^P_RIM = 100·τ, so short-wavelength
                                    //   rims survive while long-wavelength bowls dome. NOT derived from τ∝1/λ (that
                                    //   gives only p=1 = the bowl law); motivated by elastic/lithospheric support
                                    //   steepening the effective exponent at short wavelength (no false cite).
export const DOME_FRAC  = 0.3;      // relaxed-floor dome lift as a fraction of the bowl amplitude A (a fully
                                    //   relaxed floor bulges to +A·DOME_FRAC at centre). calibration/ice-relax.mjs
                                    //   prior; §4 adjudicable (calibration output is the source of truth).

// ── chronology ───────────────────────────────────────────────────────────────────────────────────────
export function chron(t)  { return A_NEU * (Math.exp(LAMBDA_NEU * t) - 1) + B_NEU * t; }
export function chronN(t) { return chron(t) / chron(AGE_REF); }
// chronInverse(u, tExp) — deterministic bisection solving chron(t)=u·chron(tExp) on [0,tExp] (48 iters, no
// tolerance branch — pure + convergent). Distributes a crater's formation time ∝ production over the exposed epoch.
export function chronInverse(u, tExp) {
  const target = u * chron(tExp);
  let lo = 0, hi = tExp;
  for (let i = 0; i < 48; i++) { const mid = 0.5 * (lo + hi); if (chron(mid) < target) lo = mid; else hi = mid; }
  return 0.5 * (lo + hi);
}

// isImpactSurface(condition) — the label-free, regime-blind self-gate (§1C): a COLD solid lithosphere with a
// REACHABLE solid surface (not a deep H2-He envelope). Reads ONLY condition-vector scalars. Note the binary
// airless/tidal gates are RETIRED — atmospheric and tidally-active worlds ARE impact surfaces, they just self-
// suppress their retained record through the continuous t_exp erosion/tidal terms (footnotes 3,5).
export function isImpactSurface(condition) {
  if (!condition) return false;
  const P = condition.atmosphere?.pressure ?? 0;
  const cold = (condition.T_eq ?? 288) < CRATER_T_MAX;   // molten worlds are not impact surfaces
  const solidSurface = P < P_SURF_MAX;                    // deep-envelope worlds have no reachable solid surface
  return cold && solidSurface;
}

// craterSchedule(condition) — the CLOSED-FORM km-space population. Returns the analytic count (never looped),
// the discrete stamp count (the ONLY loop bound), the truncated stamp band (km), the size multiplier, the atmo
// screening factor, the exposure age, the closed-form drawn-coverage metric, and the sub-floor regolithRoughness
// (the analytic SFD mass below the mesh floor). Direct-writer-metric — the AC-GCOUNT/RADIUS-LAW asserts read this.
export function craterSchedule(condition) {
  if (!isImpactSurface(condition)) {
    return { fired: false, nAnalytic: 0, nStamp: 0, sizeMul: 1, screen: 0, tExp: 0, coverage: 0,
      R_km: 0, D_LO_KM: 0, D_HI_KM: 0, D_FLOOR_KM: 0, L_trunc: 0, regolithRoughness: 0 };
  }
  const R = Math.max(1e-6, condition.radiusEarth ?? 1.0);
  const R_km = KM_PER_EARTH_RADIUS * R;
  const g = Math.max(1e-6, condition.surfaceGravity ?? G_REF);
  const age = Math.min(AGE_MAX, Math.max(0, condition.age ?? AGE_REF));   // physical surface-age cap (Deviation #1)
  const td = condition.rawTidalIoRatio ?? 0;
  const erosion = erosionOf(condition);
  const P = condition.atmosphere?.pressure ?? 0;

  const D_ATMO_KM = C_ATMO_KM * Math.pow(P, P_ATMO_EXP);      // graded atmo floor
  const D_LO_KM   = Math.max(D_SFD_MIN_KM, D_ATMO_KM);        // low SFD edge (screening anchor or atmo floor)
  const sizeMul   = Math.pow(G_REF / g, K_GS);               // π-group size scaling (count is g-independent)
  const L         = D_LO_KM * sizeMul;                       // scaled low edge (draw edges scale BEFORE the inverse-CDF)
  const H         = C_BASIN * R_km;                          // upper edge capped at the disruption limit (target physics)
  const screen    = Math.pow(D_SFD_MIN_KM / D_LO_KM, B_SFD); // atmo screening: raised floor ⇒ fewer craters exist
  const tExp      = Math.min(age,
                             T_RESURF_TIDAL / Math.max(td, EPS_TD),
                             T_RESURF_ERODE / Math.max(erosion, EPS_ER));
  const rpk       = radPerKm(R);
  const D_FLOOR_KM = MESH_FLOOR_RAD / rpk;                   // angular mesh floor expressed in km (∝ R)
  const L_trunc   = Math.max(L, D_FLOOR_KM);                 // stamps drawn from [L_trunc, H]

  // degeneracy guards (§1C): a body too small for even one above-floor crater, or with no exposed epoch, fires
  // the gate but schedules zero discrete stamps (its mass is entirely sub-floor / it retains nothing).
  const degenerate = !(L < H) || !(L_trunc < H) || tExp <= 0;
  const nAnalytic = degenerate ? 0 : F_REF * R * R * chronN(tExp) * screen;

  // closed-form drawn-coverage metric (small-angle): coverage = N_analytic·E[(δ/2)²]/4 = N·radPerKm²·E[D²]/16,
  // E[D²] = 2L²ln(H/L)/(1−(L/H)²) for the bounded-Pareto B=2 draw over [L,H]. F_REF was calibrated against this.
  const ED2 = degenerate ? 0 : 2 * L * L * Math.log(H / L) / (1 - Math.pow(L / H, 2));
  const coverage = nAnalytic * rpk * rpk * ED2 / 16;

  // P_STAMP = fraction of the FULL SFD (over [L,H]) with D ≥ the mesh floor = the bounded-Pareto tail (L/D_FLOOR)^B.
  const P_STAMP = degenerate ? 0 : Math.min(1, Math.pow(L / D_FLOOR_KM, B_SFD));
  const nStamp = Math.round(nAnalytic * P_STAMP);

  // sub-floor SFD mass → regolithRoughness (analytic; the S3/downstream consumer of the never-stamped population).
  // = closed-form coverage of the [L, min(D_FLOOR,H)] band (the craters folded into texture rather than stamped).
  let regolithRoughness = 0;
  if (!degenerate && D_FLOOR_KM > L) {
    const Hs = Math.min(D_FLOOR_KM, H);
    const subCount = nAnalytic * (1 - P_STAMP);
    const ED2s = 2 * L * L * Math.log(Hs / L) / (1 - Math.pow(L / Hs, 2));
    regolithRoughness = subCount * rpk * rpk * ED2s / 16;
  }

  return { fired: true, nAnalytic, nStamp, sizeMul, screen, tExp, coverage,
    R_km, D_LO_KM, D_HI_KM: H, D_FLOOR_KM, L_trunc, regolithRoughness };
}

// drawBoundedPareto(u, L, H, B) — bounded-Pareto inverse-CDF: P(D≤x) = (L^−B − x^−B)/(L^−B − H^−B) on [L,H]
// (cumulative N(>D) ∝ D^−B). u∈[0,1). The V2-5 drawPowerLaw was this with L=D_MIN_RAD, H=D_MAX_RAD.
export function drawBoundedPareto(u, L, H, B) {
  const Lb = Math.pow(L, -B), Hb = Math.pow(H, -B);
  return Math.pow(Lb - u * (Lb - Hb), -1 / B);
}

// craterAmplitude(δ) — vertical bowl amplitude (normalized-height) of a crater of ANGULAR diameter δ (radians).
export function craterAmplitude(D) { return CRATER_DEPTH_N * Math.pow(D / D_REF_RAD, DEPTH_POW); }

// craterProfile(s, δ) — radial displacement at geodesic angle s (rad) from centre (UNCHANGED from V2-5; ε S3).
export function craterProfile(s, D) {
  const A = craterAmplitude(D);
  const r = 0.5 * D;
  const floorEdge = FLOOR_FRAC * r;
  const rimH = RIM_HEIGHT_FRAC * A;
  const ejH = EJECTA_FRAC * A;
  const rimEnd = r + RIM_W * D;
  const ejEnd = r + RIM_FRAC * D;
  if (s < floorEdge) return -A;
  if (s < r) { const t = (s - floorEdge) / (r - floorEdge); return -A + t * (A + rimH); }
  if (s < rimEnd) { const t = (s - r) / (rimEnd - r); return rimH + t * (ejH - rimH); }
  if (s < ejEnd) { const t = (s - rimEnd) / (ejEnd - rimEnd); return ejH * (1 - t); }
  return 0;
}
export const craterStampRadius = (D) => 0.5 * D + RIM_FRAC * D;
// bowl-interior (RESET zone) reaches the rim crest at s = r = δ/2 (floor + inner wall); s ≥ δ/2 is rim/ejecta (+=).
const bowlEdge = (D) => 0.5 * D;
const floorEdgeOf = (D) => FLOOR_FRAC * 0.5 * D;   // flat-floor edge (value = −A) — the pre-clamp exactness zone

// iceRelaxation(condition, D_km, tI, iceness) — per-crater viscous-relaxation fractions (BUILD-PLAN §1D, footnote 4).
// η(T_rel) is the Arrhenius ice viscosity with bounded tidal warming; the Maxwell-time relaxation scale τ ∝
// η/(ρ·g·D) so a LARGER crater relaxes FASTER (∂ε/∂D > 0). ε ∈ [0, iceness] is the relaxed fraction; the rim
// relaxes 100× slower (P_RIM) so palimpsests read as domed floors with crisp rims. Two exact-zero cases (the
// crisp-cold-Frozen invariant): iceness=0 (rock — granite does not flow at these T/timescales) ⇒ early-return 0;
// a very cold surface (T ⇒ η so large that t/τ < 1e-16) ⇒ 1−exp(−t/τ) === 0.0 bit-exact in float64.
export function iceRelaxation(condition, D_km, tI, iceness) {
  if (!(iceness > 0) || !(tI > 0) || !(D_km > 0)) return { epsBowl: 0, epsRim: 0, tauGa: Infinity, tauRimGa: Infinity };
  const T_eq = condition?.T_eq ?? 288;
  const td   = condition?.rawTidalIoRatio ?? 0;
  const g    = Math.max(1e-6, condition?.surfaceGravity ?? G_REF);
  const T_rel = T_eq + DT_TIDAL * td / (1 + td);                  // bounded tidal warming (td/(1+td) → 1)
  const eta   = ETA_M * Math.exp((QSTAR / RGAS) * (1 / T_rel - 1 / T_MELT));
  const g_SI  = 9.81 * g;                                          // surfaceGravity is Earth-relative → m/s²
  const D_m   = D_km * 1e3;
  const tauGa    = (4 * Math.PI * eta) / (RHO_ICE * g_SI * D_m) / SEC_PER_GA;
  const tauRimGa = tauGa * Math.pow(1 / RIM_W, P_RIM);            // 100× slower — short-λ rims persist
  const epsBowl = iceness * (1 - Math.exp(-tI / tauGa));
  const epsRim  = iceness * (1 - Math.exp(-tI / tauRimGa));
  return { epsBowl, epsRim, tauGa, tauRimGa };
}

// relaxedCraterProfile(s, D, epsBowl, epsRim) — craterProfile's zone arithmetic with viscous relaxation applied:
// floor/wall zones × (1−epsBowl) plus a dome term (a relaxed floor bulges up); rim/ejecta zones × (1−epsRim).
// EXACT DEGENERACY: at epsBowl=epsRim=0 every zone reduces to base·(1−0)=base·1 (+0 for the dome) ⇒ BIT-IDENTICAL
// to craterProfile(s, D) — the ε=0 invariant the un-relaxed S2 write and the 75-golden byte discipline rely on.
export function relaxedCraterProfile(s, D, epsBowl, epsRim) {
  const A = craterAmplitude(D);
  const r = 0.5 * D;
  const floorEdge = FLOOR_FRAC * r;
  const rimH = RIM_HEIGHT_FRAC * A;
  const ejH = EJECTA_FRAC * A;
  const rimEnd = r + RIM_W * D;
  const ejEnd = r + RIM_FRAC * D;
  if (s < floorEdge) {                                            // flat floor: relax toward a dome
    const dome = A * DOME_FRAC * (1 - (s / floorEdge) * (s / floorEdge));
    return -A * (1 - epsBowl) + epsBowl * dome;
  }
  if (s < r) { const t = (s - floorEdge) / (r - floorEdge); return (-A + t * (A + rimH)) * (1 - epsBowl); }  // inner wall
  if (s < rimEnd) { const t = (s - r) / (rimEnd - r); return (rimH + t * (ejH - rimH)) * (1 - epsRim); }     // rim crest
  if (s < ejEnd) { const t = (s - rimEnd) / (ejEnd - rimEnd); return (ejH * (1 - t)) * (1 - epsRim); }       // ejecta apron
  return 0;
}

// forEachCrater(condition, macroSeed, N, cb) — the single entropy source + fixed per-STAMPED-crater draw order
// (u_centre → u_size → u_age; 3 draws per stamped crater — the restated stream contract; sub-floor mass never
// draws, it is analytic). Diameters are drawn from the TRUNCATED band [L_trunc, H] in km and converted to
// angular δ; formation time t_i is distributed ∝ production via the chron inverse. Craters are yielded
// OLDEST-FIRST (t_i desc, stable tie-break on draw index) so the obliteration stamp loop resets old topography
// before younger craters overprint. Returns the schedule.
export function forEachCrater(condition, macroSeed, N, cb) {
  const sched = craterSchedule(condition);
  if (!sched.fired || sched.nStamp <= 0) return sched;
  const rng = alea('bombard:' + (macroSeed | 0));
  const { nStamp, L_trunc, D_HI_KM } = sched;
  const R = Math.max(1e-6, condition.radiusEarth ?? 1.0);
  const rpk = radPerKm(R);
  const craters = new Array(nStamp);
  for (let c = 0; c < nStamp; c++) {
    const uCentre = rng();
    const uSize = rng();
    const uAge = rng();
    const D_km = drawBoundedPareto(uSize, L_trunc, D_HI_KM, B_SFD);
    const delta = D_km * rpk;                     // angular diameter ∝ 1/R at fixed D_km
    const tI = chronInverse(uAge, sched.tExp);
    craters[c] = { centre: Math.floor(uCentre * N), delta, D_km, tI, drawIndex: c };
  }
  craters.sort((a, b) => (b.tI - a.tI) || (a.drawIndex - b.drawIndex));   // oldest-first, stable
  for (const cr of craters) cb(cr.centre, cr.delta, cr.tI, cr.D_km);
  return sched;
}

// writeBombardment(carrier, condition, { macroSeed, collectDiag }) — the production writer. Writes
// carrier.craterField (unhashed). Idempotent. No-op on the flat-grid twin (guards on verts/adj) and on
// non-impact-surfaces (field stays all-zero). carrier.height is NEVER touched.
//
// OBLITERATION STAMPING (AC-EQUILIB, §1C(iv)): craters stamp oldest-first; the bowl interior (s < δ/2) RESETS
// the field (obliterating all older topography at those nodes, including older rims); rim/ejecta (s ≥ δ/2)
// ACCUMULATE (+=). Equilibrium N_ret = N_eq·(1−exp(−N_prod/N_eq)) is EMERGENT (verified statistically by the
// age sweep), never coded. CRATER_SAT_N tanh survives ONLY as the final safety clamp.
//
// collectDiag (tests only): returns { carrier, diag } where diag exposes the PRE-CLAMP field + per-crater
// (delta, tI, cleanFloor, floorValuePreClamp) for the AC-EQUILIB floor-exactness assert — a clean floor is one
// whose flat-floor nodes NO younger crater touched (reset OR rim), so its pre-clamp value === −A(δ) exactly.
export function writeBombardment(carrier, condition, { macroSeed = 0, collectDiag = false } = {}) {
  const cf = carrier.craterField;
  cf.fill(0);
  if (!carrier.verts || !carrier.adj) return collectDiag ? { carrier, diag: emptyDiag() } : carrier;
  if (!isImpactSurface(condition)) return collectDiag ? { carrier, diag: emptyDiag() } : carrier;

  const { verts, adj } = carrier;
  const N = verts.length;
  const seen = new Int32Array(N);        // per-crater BFS epoch tag (reused without an O(N) clear)
  const queue = new Int32Array(N);
  let epoch = 0;

  // obliteration bookkeeping: lastTouch[node] = the youngest stamp-order index that stamped anything there.
  const lastTouch = collectDiag ? new Int32Array(N).fill(-1) : null;
  const craters = collectDiag ? [] : null;
  let order = 0;

  const iceness = icenessOf(condition);   // S3: viscous-relaxation gate (0 on rock ⇒ ε≡0 ⇒ byte-identical to S2)

  const sched = forEachCrater(condition, macroSeed, N, (centre, delta, tI, D_km) => {
    const { epsBowl, epsRim } = iceRelaxation(condition, D_km, tI, iceness);   // S3: per-crater relaxed fractions
    const stampR = craterStampRadius(delta);
    const bEdge = bowlEdge(delta);
    const fEdge = floorEdgeOf(delta);
    const cvx = verts[centre][0], cvy = verts[centre][1], cvz = verts[centre][2];
    const myOrder = order++;
    const floorNodes = collectDiag ? [] : null;
    epoch++;
    let qh = 0, qt = 0;
    queue[qt++] = centre; seen[centre] = epoch;
    while (qh < qt) {
      const j = queue[qh++];
      const vj = verts[j];
      const s = Math.acos(clamp(-1, 1, cvx * vj[0] + cvy * vj[1] + cvz * vj[2]));
      if (s > stampR) continue;                    // outside the ejecta apron — stop the flood
      if (s < bEdge) cf[j] = relaxedCraterProfile(s, delta, epsBowl, epsRim);   // bowl interior: RESET (obliterate older)
      else cf[j] += relaxedCraterProfile(s, delta, epsBowl, epsRim);            // rim / ejecta: accumulate
      if (collectDiag) { lastTouch[j] = myOrder; if (s < fEdge) floorNodes.push(j); }
      const nb = adj[j];
      for (let k = 0; k < nb.length; k++) { const m = nb[k]; if (seen[m] !== epoch) { seen[m] = epoch; queue[qt++] = m; } }
    }
    if (collectDiag) craters.push({ order: myOrder, delta, tI, floorNodes, A: craterAmplitude(delta) });
  });

  let diag = null;
  if (collectDiag) {
    const preClamp = Float32Array.from(cf);        // capture BEFORE the tanh safety clamp
    let nRetained = 0;
    for (const cr of craters) {
      // clean floor: NO younger crater touched any flat-floor node (lastTouch === this crater's order).
      let clean = cr.floorNodes.length > 0;
      for (const j of cr.floorNodes) if (lastTouch[j] !== cr.order) { clean = false; break; }
      cr.cleanFloor = clean;
      cr.floorValuePreClamp = cr.floorNodes.length ? preClamp[cr.floorNodes[0]] : NaN;
      if (clean) nRetained++;
    }
    diag = { preClamp, craters, nStamp: sched.nStamp, nRetained };
  }

  // FINAL safety clamp only (equilibrium is emergent from the obliteration reset above, not from this tanh).
  for (let i = 0; i < N; i++) cf[i] = CRATER_SAT_N * Math.tanh(cf[i] / CRATER_SAT_N);
  return collectDiag ? { carrier, diag } : carrier;
}

function emptyDiag() { return { preClamp: new Float32Array(0), craters: [], nStamp: 0, nRetained: 0 }; }
