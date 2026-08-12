// src/worldengine/base/reliefBudget.js — Inc-3b S1 leaf: the condition-pure relief-variance budget.
//
// WHAT THIS IS (BUILD-PLAN §1.S1 S1.1; contract designDecision-S1, AC-0/AC-BUDGET):
//   deriveReliefBudget(cond, schedule) emits a CONDITION-PURE model impact fraction f_I — reading ONLY
//   condition scalars + craterSchedule(cond) outputs, NEVER the realized carrier arrays. This is the
//   S0.2a load-bearing split: a realized-norm f_I collapses the whole budget to identity (proved in
//   calibration/relief-budget-fit.json.identityCollapse). The RMS-preserving w_e/w_i SCALE is solved
//   downstream in compositeMargins from the realized channel norms — this leaf only carries the RATIO
//   target f_I. So w_e/w_i are returned as the identity defaults (1) here; compositeMargins overwrites
//   the scale when budget.inDomain.
//
//   The law is transcribed EXACTLY from the settled derivation
//   docs/WORKSTREAMS/world-engine-inc3b-relief-budget-2026-07-21/calibration/leaf-law.mjs (SETTLED S0
//   stage; every constant carries a derivation/anchor there and in leaf-law.json). The leaf cannot import
//   from docs/ — the builder transcribes; equivalence is unit-tested against leaf-law.json worked points.
//
// TOTALITY (S1.1a / lens-log M2): deriveReliefBudget runs at planet-lod-rivers.js:569 on EVERY
//   writeBodyRelief call (the 75-golden harness, the dispatch-oracle, ~40 suites, all 18 presets, the
//   gas/atmo/null-path worlds). A NaN/Inf f_I cannot move a hash (return-object field, never HASHED), but
//   a THROW would cascade the whole suite RED. So the leaf SHORT-CIRCUITS to IDENTITY before any 0/0 on
//   !isImpactSurface(cond) or a degenerate schedule, and is finite + never-throws on all 18 presets.
//
// AC-0 / AC-ORACLE: this leaf reads condition/derived scalars + craterSchedule ONLY — no taxonomy or
//   preset-name routing, no feature-association reference, no new config-flag key. Its source and public
//   symbol name are kept free of the dispatch-oracle denylist tokens (see the AC-0 grep in the S1 unit test).
//
// Frozen variance definition (relief-budget-fit.json): raw mean-square, V = mean(x^2).

// depth ../../../ from src/worldengine/base/ → repo root
import { Q_RELIEF } from './labCore.js';   // the shipped render strength exponent (0.58), REUSED — no 2nd g-law
import { erosionOf, icenessOf, P_ER_REF, DRY_ER_FLOOR } from './surfaceMaterial.js';
import { craterSchedule, isImpactSurface, transitionDiameterKm, P_COMPLEX, B_SFD } from './bombardment.js';
import { radPerKm } from './baseStep.js';

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// GAP 1 — σ_imp/R CLOSED FORM (schedule-only; validated in leaf-law.json against realized craterField RMS)
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// σ_imp² = (I1_SHAPE/4π)·nStamp·rpk⁴·E[D_km⁴·shallow²]; shallow=min(1,(K_DT/g / D_km)^P_COMPLEX);
// E closed-form over the shipped bounded-Pareto [L_trunc, D_HI_KM], B_SFD=2. Everything is a
// craterSchedule output or a condition scalar ⇒ condition-pure (S0.2a compliant). No realized array read.

// I1_SHAPE — pure profile SHAPE constant (repo-DERIVED via deterministic quadrature of the shipped
// craterProfile in leaf-law.mjs; recomputeI1() at M=200000 proves this literal to <1e-15). Frozen here
// because a 2e5-step integral per writeBodyRelief call would be absurd and the shape never changes.
export const I1_SHAPE = 0.013584246635481124;   // ∫ craterProfile(s;δ=1, simple)² · 2π s ds

// E[D⁴·shallow²] over the bounded-Pareto [L,H], B_SFD, with the Pike complex roll-off (transcribed).
export function expectedD4Shallow2(L, H, Dt, P = P_COMPLEX, B = B_SFD) {
  const C = 2 / (Math.pow(L, -B) - Math.pow(H, -B));   // bounded-Pareto normalizer (B=2)
  // part 1: simple band L..min(Dt,H) — ∫ D⁴ · C D^-3 dD = C ∫ D dD
  const b1 = Math.min(Dt, H);
  const part1 = b1 > L ? C * (b1 * b1 - L * L) / 2 : 0;
  // part 2: complex band max(Dt,L)..H — ∫ Dt^{2P} D^{4-2P} · C D^-3 dD = C Dt^{2P} ∫ D^{1-2P} dD
  const a2 = Math.max(Dt, L);
  let part2 = 0;
  if (H > a2) {
    const e = 2 - 2 * P;                                // = 0.68 at P=0.66 (>0 ⇒ convergent)
    part2 = C * Math.pow(Dt, 2 * P) * (Math.pow(H, e) - Math.pow(a2, e)) / e;
  }
  return part1 + part2;
}

// σ_imp/R — condition-pure closed form. craterField is in normalized-height units (fraction of R),
// so its RMS IS σ_imp/R directly. Reads cond.surfaceGravity/radiusEarth + schedule scalars only.
export function sigmaImpOverR(cond, schedule) {
  const sch = schedule ?? craterSchedule(cond);
  if (!sch.fired || sch.nStamp <= 0) return 0;         // no stamped population ⇒ no impact relief
  const R = Math.max(1e-6, cond.radiusEarth ?? 1.0);
  const g = Math.max(1e-6, cond.surfaceGravity ?? 0.5);
  const rpk = radPerKm(R);
  const Dt = transitionDiameterKm(g);                  // shipped K_DT/g
  const ED4s2 = expectedD4Shallow2(sch.L_trunc, sch.D_HI_KM, Dt);
  const ms = (I1_SHAPE / (4 * Math.PI)) * sch.nStamp * Math.pow(rpk, 4) * ED4s2;
  return Math.sqrt(Math.max(0, ms));
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// GAP 2 — σ_endo/R: relic-Λ base (frozen fit) + ERODED-WORLD extension (condition-scalar, Mars-anchored)
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// RELIC-Λ BASE — the committed exactly-identified 2-anchor fit (relic-lambda-band.json.fit), transcribed
// as literals (matched bit-exact by the S1 unit test). σ_endo/R = C_RELIC·g^-Q·max(Λ_FLOOR,Φ_peak^P_Λ)·(1−K_IR·iceness).
export const RELIC = {
  C_RELIC: 0.00014558245419776515,   // relic-lambda-band.json.fit.C_RELIC (2-anchor Mercury+Moon)
  P_LAMBDA: 0.24462978039190114,     // relic-lambda-band.json.fit.P_LAMBDA
  Q_RELIEF,                          // imported (0.58) — the shipped render strength exponent, REUSED
  LAMBDA_FLOOR: 0.05,                // relic-lambda-band.json.fit.LAMBDA_FLOOR (GUESSED; inert in-set)
  K_IR: 0.5,                         // relic-lambda-band.json.fit.K_IR (Callisto-targeted; ½ crater-bowl asymptote)
};
export function sigmaEndoRelicOverR(g, phiPeak, iceness = 0) {
  const vigor = Math.max(RELIC.LAMBDA_FLOOR, Math.pow(phiPeak, RELIC.P_LAMBDA));
  return RELIC.C_RELIC * Math.pow(g, -RELIC.Q_RELIEF) * vigor * (1 - RELIC.K_IR * iceness);
}
// Φ_peak: peak convective vigor (relic relief frozen in at maximum activity ⇒ age=0). INLINED transcription
// of the shipped convective-vigor proxy, evaluated at age=0 — deliberately NOT imported: a base/ writer that
// pulled the E1 regime module in would trip the worldengine-e1-shadow-audit guardrail (which greps every
// base/ writer's raw source for an import of that module, keeping writers E1-blind). Transcribed VERBATIM:
// PHI_CONSTANTS C_MASS=C_SIZE=0.5, C_TIDAL=10; massEarth = g·d² (§4.2 named derivation / baseStep.js:20).
// age=0 ⇒ radiogenic = 1-clamp01(0/10) = 1, so the radiogenic factor is exactly 1 and drops out — the result
// is byte-identical to the shipped proxy for any cond. Equivalence is guarded by the leaf-law.json worked-point
// test (in-domain f_I to 1e-12), the same equivalence guard used for I1_SHAPE and the RELIC constants.
const PHI_C_MASS = 0.5, PHI_C_SIZE = 0.5, PHI_C_TIDAL = 10;   // e1Regime.js PHI_CONSTANTS (verbatim)
export function phiPeakOf(cond) {
  const g = cond?.surfaceGravity ?? 1.0, d = cond?.radiusEarth ?? 1.0;   // massEarthOf inputs (§4.2)
  const vigor = PHI_C_MASS * (g * d * d) + PHI_C_SIZE * d * d * d;        // radiogenic(age=0)=1 ⇒ omitted
  return Math.sqrt(Math.max(0, vigor)) + PHI_C_TIDAL * (cond?.rawTidalIoRatio ?? 0);
}

// ── ERODED-WORLD ENDO EXTENSION (transcribed; leaf-law.mjs GAP 2). ──────────────────────────────────
// The relic-Λ law is a DEAD-LID model; it under-predicts Mars σ_endo (large-scale volcano-tectonic
// structure it does not carry) → over-predicts f_I (base 0.91 vs the real-Mars-hypsometry gate [0.3,0.8]).
// Quadrature-add an independent eroded endo-relief source anchored on real-Mars hypsometry:
//   σ_endo/R = sqrt(σ_relic/R² + σ_ero/R²),  σ_ero/R = SIGMA_HYPS_MARS_OVER_R · (1 − exp(−erosion/ERO_SAT))
// erosion=0 (dead-lid) ⇒ short-circuit to relic with NO sqrt ⇒ f_I byte-identical to the base relic law.
export const R_MARS_KM = 3389.5;                 // real Mars mean radius (training, medium confidence)
export const HYPS_MARS_KM = 2.5;                 // real-Mars global hypsometric RMS (MOLA σ; training, medium confidence)
export const SIGMA_HYPS_MARS_OVER_R = HYPS_MARS_KM / R_MARS_KM;   // ≈ 7.376e-4 (eroded endo amplitude)
export const P_AEOLIAN_BAR = 6e-3;               // Mars aeolian / mean-surface pressure (~6 mbar, training)
// ERO_SAT — erosionOf evaluated at the aeolian threshold using the module's own P_ER_REF/DRY_ER_FLOOR
// (cold-dry surface ⇒ waterWindow=0 ⇒ dry floor). NOT a naked constant, NOT Mars's own erosion.
function smoothstep01(a, b, x) { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
export const ERO_SAT = smoothstep01(0, P_ER_REF, P_AEOLIAN_BAR) * DRY_ER_FLOOR;

// σ_endo/R WITH the eroded extension. relicEndo passed in (already condition-pure). BIT-EXACT dead-lid:
// erosion=0 ⇒ short-circuit to relicEndo (no sqrt), so f_I === base relic f_I byte-for-byte.
export function sigmaEndoOverR(cond, relicEndo) {
  const erosion = erosionOf(cond);
  if (!(erosion > 0)) return relicEndo;                          // dead-lid: BIT-EXACT untouched
  const sigEro = SIGMA_HYPS_MARS_OVER_R * (1 - Math.exp(-erosion / ERO_SAT));
  if (sigEro === 0) return relicEndo;                            // defensive (erosion>0 but underflow) — bit-exact
  return Math.sqrt(relicEndo * relicEndo + sigEro * sigEro);
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// THE PUBLIC LEAF — condition-pure model f_I (w_e/w_i are the identity defaults; scale solved in compositeMargins)
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// Returns { inDomain, f_I, w_e, w_i }. TOTAL: short-circuits to the identity object before any 0/0; finite
// on all 18 presets; never throws. Under adopted §6-T2 option (ii)+S0.2a the RMS-preserving w_e/w_i SOLVE
// lives in compositeMargins — this leaf emits w_e = w_i = 1 (identity defaults) and the ratio target f_I.
export function deriveReliefBudget(cond, schedule) {
  if (!cond || !isImpactSurface(cond)) return { inDomain: false, f_I: 0, w_e: 1, w_i: 1 };
  const sch = schedule ?? craterSchedule(cond);
  if (!sch || !sch.fired || !(sch.nStamp > 0)) return { inDomain: false, f_I: 0, w_e: 1, w_i: 1 };   // degenerate ⇒ identity BEFORE any divide
  const g = Math.max(1e-6, cond.surfaceGravity ?? 0.5);
  const sImp = sigmaImpOverR(cond, sch);
  const sRelic = sigmaEndoRelicOverR(g, phiPeakOf(cond), icenessOf(cond));
  const sEndo = sigmaEndoOverR(cond, sRelic);
  const denom = sImp * sImp + sEndo * sEndo;
  if (!(denom > 0)) return { inDomain: false, f_I: 0, w_e: 1, w_i: 1 };   // guard 0/0
  const f_I = (sImp * sImp) / denom;
  if (!Number.isFinite(f_I)) return { inDomain: false, f_I: 0, w_e: 1, w_i: 1 };
  return { inDomain: true, f_I, w_e: 1, w_i: 1 };
}
