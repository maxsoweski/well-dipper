// src/worldengine/base/e1Regime.js
//
// World Engine V2-1 — the E1 REGIME SELECTOR (SHADOW mode). A pure, deterministic function that reads a
// body's CONDITION VECTOR (+ its integer macroSeed) and EMITS a full geodynamic tuple. It has ZERO routing
// influence this increment: nothing in any writer imports it; dispatch still keys on PRESET_ARCHETYPE. The
// tuple is consumed by the AC3 conformance oracle + the AC7 live probe now, and by the V2-2 router / V2-3
// dispatch later (ROADMAP-v2 §5). See docs/WORKSTREAMS/world-engine-v2-1-e1-shadow-2026-07-03/BUILD-PLAN.md.
//
// HARD DISCIPLINE (grep-enforced at the gate):
//   • SHADOW: computeE1 is emit-only. It reads NO archetype string (AC-0 check 1) and writes nothing.
//   • Seeded determinism: alea only, the NEW 'e1:' namespace (prefix-disjoint from the four in-use writer
//     namespaces 'magma:'/'plates:'/'shell:'/'stagnant:'); fixed draw order; NO Math.random / NO Date.now.
//   • e1.label is OUTPUT-only — no branch in this module (or anywhere) reads it; it is derived LAST.
//   • L consumes z (from T_eq/age) and Φ consumes d (from radiusEarth) — it NEVER reads condition.shellThickness
//     (SH-F2: z / D / d are three separate transforms).
//
// Numeric references (this module must reproduce them EXACTLY):
//   • L      — gate-1-L-lidstrength-form-DESIGN.md §Decision (constants VERBATIM) + gate-1-L-calib.mjs table.
//   • Φ, n   — phi-calib.mjs (delegable-#4 Φ size-aware proxy; gate-2 n = f(Φ, 1/L)).
//   • m_hp   — rawTidalIoRatio − HEATPIPE_PEG (delegable #6, exported tunable).
import alea from 'alea';
import { clamp, clamp01, smoothstep } from './mathutil.js';

// ── gate-1 L constants — VERBATIM from gate-1-L-lidstrength-form-DESIGN.md §Decision (RHOG_REF = 5.5·0.9
//    written as the product to bit-match gate-1-L-calib.mjs). Do NOT retune here — UAT owns L_STRONG / weights.
export const L_CONSTANTS = Object.freeze({
  Z_BASE: 0.15, Z_COLD: 0.55, Z_AGE: 0.25, T_ZLO: 200, T_ZHI: 320, T_MELT_LO: 1100, T_MELT_HI: 1500,
  T_ALO: 300, T_AHI: 750, V_LO: 0.05, V_HI: 0.20, MU_DRY: 0.55, MU_HEAT: 0.65,
  W_Z: 0.55, W_MU: 0.75, G_EXP: 0.15, GMOD_LO: 0.90, GMOD_HI: 1.12, RHOG_REF: 5.5 * 0.9, K_L: 0.82,
});

// ── Φ (delegable #4, phi-calib.mjs) — size-aware convective-vigor proxy. C_MASS = C_SIZE = 0.5 (raw,
//    un-compressed); sqrt is the ~2–3× compression (gate-2 PG-2); C_TIDAL = 10 on the RAW Io-ratio. ──
export const PHI_CONSTANTS = Object.freeze({ C_MASS: 0.5, C_SIZE: 0.5, C_TIDAL: 10 });

// ── n (gate-2 §Decision) — SP-CENTERS count from the COMPRESSED Φ (min(Φ,1.2)) and (1−L). ──
const N_CONSTANTS = Object.freeze({ N_BASE: 4, N_PHI: 4, N_L: 2, N_MIN: 3, N_MAX: 11 });

// ── m_hp heat-pipe margin (delegable #6) — EXPORTED tunable peg on the RAW pre-calibrateTidal Io-ratio. ──
export const HEATPIPE_PEG = 0.45;

// ── geodynamicRegime deterministic-edge band edges (gate-1 §4 / gate-2 PG-5, UAT-tunable). ──
const L_STRONG = 0.63;        // pure-strong lid cut (Venus 0.728 → strong; Mars 0.551 → mixed)
const SHOULDER_LO = 0.15;     // rawTidal shoulder below which a hot-high-L body reads as stagnant (not heat-pipe)
const ACTIVE_TIDAL = 0.5;     // rawTidalIoRatio above which an icy shell is tidally ACTIVE (Europa rt≈137)
const METH_LO = 85, METH_HI = 120;  // methane-window band (Titan T94 kept 'icy'; Frozen T60 falls to dead-lid)
const MOBILE_L = 0.35;        // rocky below this (non-heatpipe, out-of-band) reads mobile/broken-lid
const COLD_DEAD_T = 250;      // cold-dead rocky upper T (Mars T210 — diagnostic placement; Mars is oracle-excluded)
const COLD_DEAD_PHI = 0.4;    // cold-dead rocky upper Φ (Mars Φ0.268)

// ── Seeded temperate-wet Earth-mass band (BUILD-PLAN §4.5 / §2.4 #3) — PINNED boundaries. massEarth is the
//    §4.2 NAMED DERIVATION surfaceGravity·radiusEarth² (the vector carries no mass field). In: Rocky/Ocean/Eyeball. ──
const BAND = Object.freeze({ MASS_LO: 0.6, MASS_HI: 1.6, T_LO: 250, T_HI: 320, V_MIN: 0.12 });

// ── Seeded middle: FROZEN base weights + linear V/T nudges around band centers (BUILD-PLAN §4.5). The lab
//    (Slice D) may pass an override base via opts.weights (mirrors _driverAbMode); default = these frozen. ──
export const E1_REGIME_WEIGHTS = Object.freeze({ mobile: 0.45, episodic: 0.25, stagnant: 0.30 });
const NUDGE = Object.freeze({ V0: 0.25, T0: 285, K_V: 1.2, K_T: 0.30 });   // wetter → mobile ; hotter → stagnant
const REGIME_ORDER = Object.freeze(['mobile', 'episodic', 'stagnant']);     // FIXED cumulative-walk order (determinism)

// ── effectiveL on a seeded-'stagnant' pick (gate-2 §4 R-wetstag): strong-mixed band, wetter → piercable low edge. ──
const EFF = Object.freeze({ L_BASE: 0.65, L_WET: 0.05, LO: 0.60, HI: 0.66 });

// ── Stage-A compositionClass (BUILD-PLAN §4.4) + the §1 label carve-out (crystal/technogenic/geometric have
//    NO driver signature → they fall to their density class; E1 does not try to derive them). ──
export function compositionClass(cv) {
  if (cv.atmosphere && cv.atmosphere.composition === 'h2-he') return 'gas';   // h2-he envelope terminal (fires first)
  if ((cv.composition?.carbonToOxygen ?? 0) > 1) return 'carbon';            // R-exotic: C/O beats density→rocky
  return smoothstep(2.5, 3.9, cv.density ?? 5.5) < 0.5 ? 'icy' : 'rocky';    // rocky-crust density smoothstep
}

// ── L (lidStrength) — gate-1 pinned two-mechanism form, constants VERBATIM. Reads T_surf(=T_eq), V, ρ, g,
//    ageNorm=clamp01(age/10). NEVER reads shellThickness (SH-F2). ──
export function lidStrength(cv) {
  const P = L_CONSTANTS;
  const T = cv.T_eq ?? 288, V = cv.composition?.volatileFraction ?? 0.15, rho = cv.density ?? 5.5;
  const g = cv.surfaceGravity ?? 1.0, aN = clamp01((cv.age ?? 4.5) / 10);
  const meltFactor = 1 - smoothstep(P.T_MELT_LO, P.T_MELT_HI, T);   // molten → no lid
  const coldness = 1 - smoothstep(P.T_ZLO, P.T_ZHI, T);             // cold surface → thick brittle lid
  const z = clamp01(P.Z_BASE + P.Z_COLD * coldness + P.Z_AGE * aN) * meltFactor;  // MARS mechanism (↓ in T)
  const anneal = smoothstep(P.T_ALO, P.T_AHI, T);                   // hot → ductile lockup
  const dryness = 1 - smoothstep(P.V_LO, P.V_HI, V);                // dry → high effective friction
  const muProxy = clamp01(P.MU_DRY * dryness + P.MU_HEAT * anneal) * meltFactor;  // VENUS mechanism (↑ in T, ↑ dryness)
  const gMod = clamp(P.GMOD_LO, P.GMOD_HI, Math.pow((rho * g) / P.RHOG_REF, P.G_EXP));  // gentle lithostatic lever
  return clamp01(P.K_L * (P.W_Z * z + P.W_MU * muProxy) * gMod);
}

// ── massEarth — §4.2 NAMED DERIVATION. g = mass/R² EXACTLY (baseStep.js:20), so mass reconstructs from the
//    two vector scalars present post-AC6. computeE1 NEVER reads fp.massEarth (the vector carries no mass). ──
function massEarthOf(cv) {
  const g = cv.surfaceGravity ?? 1.0, d = cv.radiusEarth ?? 1.0;
  return g * d * d;
}

// ── Φ (convective vigor, delegable #4) — { phi (compressed via sqrt + tidal), vigor (raw) }. d = radiusEarth
//    (SH-F2 mantle-depth transform, SEPARATE from z and from icy D; PROVISIONAL — gate-4 f(mass,gravity) is V2-2). ──
export function convectiveVigor(cv) {
  const C = PHI_CONSTANTS;
  const age = cv.age ?? 4.5, mass = massEarthOf(cv), d = cv.radiusEarth ?? 1.0;
  const rawTidal = cv.rawTidalIoRatio ?? 0;
  const radiogenic = 1 - clamp01(age / 10);
  const vigor = radiogenic * (C.C_MASS * mass + C.C_SIZE * d * d * d);   // RAW size/mass vigor (un-compressed)
  const phi = Math.sqrt(Math.max(0, vigor)) + C.C_TIDAL * rawTidal;      // sqrt = the ~2–3× compression (PG-2)
  return { phi, vigor };
}

// ── n = f(Φ, 1/L) — gate-2. Reads the COMPRESSED Φ. ──
export function centerCount(phi, L) {
  const N = N_CONSTANTS;
  return clamp(N.N_MIN, N.N_MAX, Math.round(N.N_BASE + N.N_PHI * Math.min(phi, 1.2) + N.N_L * (1 - L)));
}

// ── Seeded-band membership (rocky temperate-wet Earth-mass). ──
function inSeededBand(cv) {
  const T = cv.T_eq ?? 288, V = cv.composition?.volatileFraction ?? 0.15, mass = massEarthOf(cv);
  return mass >= BAND.MASS_LO && mass <= BAND.MASS_HI && T >= BAND.T_LO && T <= BAND.T_HI && V >= BAND.V_MIN;
}

// ── Nudged, renormalized regime weights (BUILD-PLAN §4.5): base (frozen or lab override) + linear V/T nudges,
//    each clamped ≥0, episodic absorbs the remainder, then renormalize to sum 1. ──
export function regimeWeights(V, T, base = E1_REGIME_WEIGHTS) {
  let mobile = Math.max(0, base.mobile + NUDGE.K_V * (V - NUDGE.V0));           // wetter → more mobile
  let stagnant = Math.max(0, base.stagnant + NUDGE.K_T * (T - NUDGE.T0) / 70);  // hotter → more stagnant
  let episodic = Math.max(0, 1 - mobile - stagnant);                            // remainder
  const sum = mobile + episodic + stagnant || 1;
  return { mobile: mobile / sum, episodic: episodic / sum, stagnant: stagnant / sum };
}

// ── Deterministic weighted pick over REGIME_ORDER (fixed cumulative walk; one rng draw). ──
function weightedPick(rng, weights) {
  const u = rng();
  let acc = 0;
  for (const k of REGIME_ORDER) { acc += weights[k]; if (u < acc) return k; }
  return REGIME_ORDER[REGIME_ORDER.length - 1];   // float-tail guard: last bucket catches the remainder
}

// ── effectiveL on a seeded-'stagnant' pick (gate-2 §4): wetter nudges toward the piercable lower edge (0.60). ──
function effectiveLOf(V) {
  const wetness = smoothstep(L_CONSTANTS.V_LO, L_CONSTANTS.V_HI, V);
  return clamp(EFF.LO, EFF.HI, EFF.L_BASE - EFF.L_WET * wetness);
}

/**
 * computeE1 — pure E1 regime selector. Reads ONLY the condition vector + macroSeed (+ an optional lab-only
 * weights override); emits the full geodynamic tuple. SHADOW: no routing influence, no side effects.
 *
 * @param {object} conditionVector  bodyDrivers.condition (deriveConditionVector output).
 * @param {number} macroSeed        the body's deterministic integer seed (state.macroSeed in the lab).
 * @param {{weights?:{mobile:number,episodic:number,stagnant:number}}} [opts]  lab-only seeded-band weight
 *        override (Slice D `_lab.e1RegimeWeights`, mirrors _driverAbMode); omitted ⇒ FROZEN E1_REGIME_WEIGHTS.
 * @returns {{compositionClass:string, geodynamicRegime:string, label:string, L:number, Φ:number, V:number,
 *            n:number, m_hp:number, e1Seed:number, positionWithinRegime:number, effectiveL?:number}}
 *          effectiveL is present ONLY on a seeded-'stagnant' pick (conditional tuple member, gate-2 §4).
 */
export function computeE1(conditionVector, macroSeed, opts = {}) {
  const cv = conditionVector || {};
  const base = opts.weights || E1_REGIME_WEIGHTS;

  const cls = compositionClass(cv);
  const L = lidStrength(cv);
  const { phi } = convectiveVigor(cv);
  const V = cv.composition?.volatileFraction ?? 0.15;
  const n = centerCount(phi, L);
  const rawTidal = cv.rawTidalIoRatio ?? 0;
  const m_hp = rawTidal - HEATPIPE_PEG;
  const T = cv.T_eq ?? 288;

  // Single 'e1:regime:' stream (NEW namespace; disjoint from magma/plates/shell/stagnant). FIXED draw order:
  // seeded pick (if in-band) → positionWithinRegime. e1Seed = the integer seed itself (>>>0).
  const rng = alea('e1:regime:' + (macroSeed | 0));
  const e1Seed = macroSeed >>> 0;

  let geodynamicRegime, positionWithinRegime, effectiveL;

  // compositionClass gates the edge SET (matching oracle-preview.mjs writerE1 order — the AC3 numeric
  // reference): icy bodies never take the heat-pipe edge (an icy tidal world is a cryo-active SHELL, Europa —
  // NOT an Io-type heat-pipe); heat-pipe is a ROCKY-only edge (Lava/Magma). §4.5's prose lists heat-pipe
  // first but annotates Europa on the icy branch — oracle-preview resolves the ambiguity in favor of icy-first.
  if (cls === 'icy') {
    const activeTidal = rawTidal > ACTIVE_TIDAL;                       // Europa
    const methaneVolatile = V >= 0.12 && T >= METH_LO && T <= METH_HI; // Titan (methane hydrology window)
    geodynamicRegime = (activeTidal || methaneVolatile) ? 'icy' : 'dead-lid';  // else cold-dead icy (Frozen/Crystal)
    positionWithinRegime = rng();
  } else if (cls === 'gas' || cls === 'carbon') {
    // Off-pilot composition terminals: no solid-surface geodynamics. 'dead-lid' is an INERT diagnostic value —
    // the oracle/dispatch route gas/carbon by compositionClass BEFORE geodynamicRegime is ever read.
    geodynamicRegime = 'dead-lid';
    positionWithinRegime = rng();
  } else {
    // rocky:
    if (m_hp > 0) {
      geodynamicRegime = 'heat-pipe';                   // Io-type rocky heat-pipe (Lava/Magma — enormous margin)
      positionWithinRegime = rng();
    } else if (inSeededBand(cv)) {
      const weights = regimeWeights(V, T, base);
      geodynamicRegime = weightedPick(rng, weights);    // draw 1: mobile | episodic | stagnant
      positionWithinRegime = rng();                      // draw 2: within-band [0,1] coordinate
      if (geodynamicRegime === 'stagnant') effectiveL = effectiveLOf(V);  // gate-2 §4 R-wetstag hand-up
    } else if (L >= L_STRONG && rawTidal < SHOULDER_LO) {
      geodynamicRegime = 'stagnant';                    // hot-surface strong lid (Venus, data-placed)
      positionWithinRegime = rng();
    } else if (T < COLD_DEAD_T && phi < COLD_DEAD_PHI && rawTidal < SHOULDER_LO) {
      geodynamicRegime = 'dead-lid';                    // cold-dead rocky (Mars — low T, low Φ, no tidal)
      positionWithinRegime = rng();
    } else if (L < MOBILE_L) {
      geodynamicRegime = 'mobile';                      // low-L rocky → mobile/broken-lid
      positionWithinRegime = rng();
    } else {
      geodynamicRegime = 'stagnant';                    // mixed rocky → strong-lid dominant anchor
      positionWithinRegime = rng();
    }
  }

  // label — emergent, OUTPUT-ONLY (no code path branches on it; derived LAST from the fields above).
  const label = cls + '/' + geodynamicRegime;

  const out = {
    compositionClass: cls,
    geodynamicRegime,
    label,
    L,
    Φ: phi,
    V,
    n,
    m_hp,
    e1Seed,
    positionWithinRegime,
  };
  if (effectiveL !== undefined) out.effectiveL = effectiveL;   // conditional tuple member (seeded-stagnant only)
  return out;
}

// ── Modal (argmax-weight, seed-free) regime for an in-band body — the deterministic collapse the AC3 oracle
//    (Slice C) uses for writer-equality. Exported so the oracle imports it rather than re-deriving weights. ──
export function modalRegime(V, T, base = E1_REGIME_WEIGHTS) {
  const w = regimeWeights(V, T, base);
  let best = REGIME_ORDER[0], bv = -Infinity;
  for (const k of REGIME_ORDER) if (w[k] > bv) { bv = w[k]; best = k; }
  return best;
}
