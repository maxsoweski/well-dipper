// src/worldengine/base/atmosphereOptics.js — World Engine V2-7 condition-derived atmosphere optics.
//
// PURE, THREE-FREE, CONDITION-SCALARS-ONLY, IMPORTS NOTHING (same leaf discipline as surfaceMaterial.js:
// the clamp01/smoothstep/mix helpers are inlined rather than pulled from mathutil so "imports nothing"
// holds, and there is NO regime-dispatch substring — incl. in comments — so the blind-writer scan passes
// by construction). It never reads a preset name, archetype, regime or PRESET_ARCHETYPE.
//
// WHAT IT REPLACES: two hand-authored name-keyed lookup tables in world-engine-lab.html —
// LIMB_COLOR_BY_PRESET and TERM_COLOR_BY_PRESET — which were the last name-keyed entries in the colour
// path. A body absent from those tables fell back to a stale previous-preset uWeatheredColor read (limb) or a
// flat warm orange (terminator); a NEW body could not get an atmosphere hue at all without a code edit.
// Deriving from condition scalars means any drawn body — including per-seed draws that never had a table
// row — gets a hue that follows its own physics.
//
// WHAT IT DELIBERATELY DOES NOT DO: it does not derive `retained` or `pressure`. Those stay condition
// INPUTS (numbers on the condition vector, like density and T_eq — not labels). See
// docs/FEATURES/surface-variation-beyond-mvp.md § "Atmospheric retention derived from scratch" for the
// measurement that ruled it out: a condition-pure retention law cannot reproduce the Titan/Europa split,
// because the fact that separates them (a primordial nitrogen inventory from formation) is not carried by
// any condition scalar. Titan reads a WEAKER Jeans hold than Europa (lambda_N2 39 vs 78) yet is the one
// with 1.5 bar of air.

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const smoothstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// ── physical constants (SI). Restated locally, not imported — leaf invariant. ───────────────────────────
const R_EARTH_M = 6.371e6;
const G_EARTH   = 9.80665;   // condition.surfaceGravity is in EARTH GRAVITIES, not m/s^2
const K_B       = 1.380649e-23;
const AMU       = 1.66053907e-27;
const M_H2      = 2 * AMU;
const T_EXO_FACTOR = 3.5;    // exosphere runs hotter than the surface (PhysicsEngine.exosphericTemperature)

// ── retention: the one piece of real escape physics this module needs. ─────────────────────────────────
// lambda = m * v_esc^2 / (2 k T_exo), the Jeans escape parameter, with v_esc^2 = 2 g R so no mass term is
// needed. LAMBDA_H2_LO/HI bracket the measured 18-body split: every hydrogen-envelope body reads >= 23,
// every solid body <= 18, so the ramp saturates on both sides with margin rather than sitting on a cliff.
export const LAMBDA_H2_LO = 18;
export const LAMBDA_H2_HI = 25;

export function jeansH2Of(cond) {
  const g = (cond?.surfaceGravity ?? 1) * G_EARTH;
  const R = (cond?.radiusEarth ?? 1) * R_EARTH_M;
  const T_exo = Math.max(T_EXO_FACTOR * (cond?.T_eq ?? 288), 1);
  const vesc2 = 2 * g * R;
  return (M_H2 * vesc2) / (2 * K_B * T_exo);
}

// primordialFractionOf(cond) — continuous [0,1] "is this a retained hydrogen envelope". Replaces the
// atmosphere.composition === 'h2-he' string test in the optics path with a derived scalar.
export function primordialFractionOf(cond) {
  return smoothstep(LAMBDA_H2_LO, LAMBDA_H2_HI, jeansH2Of(cond));
}

// ── haze: which scatterer dominates the slant path. ────────────────────────────────────────────────────
// Clear gas scatters Rayleigh (blue, lambda^-4). Particulate haze scatters Mie (grey-to-orange, weakly
// wavelength-dependent) and swamps the blue once it is optically thick. Two condition-distinguishable
// producers, plus a thin-and-dry dust case:
//   ORGANIC  — cold enough for methane/nitrogen photochemistry with a volatile budget to feed it.
//   SULFUROUS— hot AND very thick: a runaway greenhouse column with condensible sulfur/cloud decks.
// HAZE_T_COLD is a HARD gate, deliberately set at Titan/Pluto temperatures rather than anywhere near
// habitable ones. It was first written at 200 K with a 120 K ramp, which meant haze began appearing
// below 320 K — and a temperate ocean world whose per-seed draw came in at 267 K duly started growing
// tholin haze and rendered tan instead of blue. Caught live, not headless, because the calibration was
// reading RAW presets while the render reads the DRAWN condition. Organic photochemistry needs a genuinely
// cold upper atmosphere: fully engaged at/below 120 K, gone by 200 K.
export const HAZE_T_COLD   = 120;   // K — organic photochemical haze needs a cold upper atmosphere
export const HAZE_T_CLEAR  = 200;   // K — above this there is no organic haze at all
export const HAZE_VOL_LO   = 0.20;  // volatile fraction that feeds the organic haze
export const HAZE_P_THICK  = 10;    // bar — the thick-column edge for the hot sulfurous case
export const HAZE_T_HOT    = 400;   // K
export const THIN_P_LO     = 0.003; // bar — below this there is barely a column to colour at all
export const THIN_P_HI     = 0.3;   // bar — above this the column reads as a full atmosphere

export function hazeFractionOf(cond) {
  const P  = cond?.atmosphere?.pressure ?? 0;
  const T  = cond?.T_eq ?? 288;
  const vf = cond?.composition?.volatileFraction ?? 0;
  const organic  = (1 - smoothstep(HAZE_T_COLD, HAZE_T_CLEAR, T)) * smoothstep(HAZE_VOL_LO, HAZE_VOL_LO + 0.2, vf);
  const sulfurous = smoothstep(HAZE_P_THICK, HAZE_P_THICK * 4, P) * smoothstep(HAZE_T_HOT, HAZE_T_HOT + 200, T);
  return clamp01(Math.max(organic, sulfurous));
}

// columnFractionOf — how much atmosphere there is to see, on a log-pressure ramp. A 0.01 bar column
// (Mars) reads as a desaturated wisp; a 1 bar column reads full. Multiplies hue saturation, so thin
// atmospheres wash toward grey instead of showing a saturated hue they have no column to justify.
export function columnFractionOf(cond) {
  const P = Math.max(cond?.atmosphere?.pressure ?? 0, 1e-6);
  return clamp01(smoothstep(Math.log10(THIN_P_LO), Math.log10(THIN_P_HI), Math.log10(P)));
}

// ── hue anchors. Named constants so the calibration table can cite them. ───────────────────────────────
export const RAYLEIGH_BLUE   = [0.45, 0.65, 1.00];  // clear heavy gas seen edge-on (Earth's limb line)
export const TholinORANGE    = [1.00, 0.55, 0.22];  // cold organic haze (Cassini's Titan)
export const SULFUR_CREAM    = [0.95, 0.88, 0.62];  // hot thick sulfurous shroud (Venus)
export const DUST_GREY       = [0.72, 0.72, 0.78];  // a thin dry column with suspended mineral dust
// Hydrogen-envelope decks run a pure temperature ramp: cold methane absorption is blue, warming through
// ammonia-deck gold and tan, into the hot dusty alkali-scattering red.
export const DECK_COLD_BLUE  = [0.45, 0.60, 1.00];  //  ~55 K
export const DECK_GOLD       = [0.92, 0.84, 0.62];  //  ~95 K
export const DECK_TAN        = [0.86, 0.71, 0.52];  // ~130 K
export const DECK_WARM_GREY  = [0.82, 0.74, 0.62];  // ~550 K
export const DECK_HOT_RED    = [0.80, 0.50, 0.32];  // ~1400 K

// deckColorOf — the hydrogen-envelope hue ramp in T. Piecewise-linear through the five anchors above.
function deckColorOf(T) {
  if (T <= 55) return DECK_COLD_BLUE.slice();
  if (T <= 95)  return mix3(DECK_COLD_BLUE, DECK_GOLD, (T - 55) / 40);
  if (T <= 130) return mix3(DECK_GOLD, DECK_TAN, (T - 95) / 35);
  if (T <= 550) return mix3(DECK_TAN, DECK_WARM_GREY, smoothstep(130, 550, T));
  return mix3(DECK_WARM_GREY, DECK_HOT_RED, smoothstep(550, 1400, T));
}

// hazeColorOf — particulate hue by temperature: cold organics are tholin orange, hot ones sulfur cream.
function hazeColorOf(T) {
  return mix3(TholinORANGE, SULFUR_CREAM, smoothstep(200, HAZE_T_HOT + 100, T));
}

// ── the two colours the render actually consumes. ──────────────────────────────────────────────────────
// LIMB = the atmosphere seen edge-on, glowing in its OWN scattered colour.
// TERMINATOR = sunlight seen THROUGH the atmosphere on a long slant path, so it is the TRANSMITTED
// colour — the complement of what got scattered out. A clear Rayleigh column removes blue and reddens
// (Earth's sunset); a haze column transmits broad amber; a THIN dusty column forward-scatters micron dust
// toward the observer and goes BLUE instead (the inverted Martian sunset).
export const TERM_RAYLEIGH_RED = [1.00, 0.45, 0.18];
export const TERM_HAZE_AMBER   = [1.00, 0.62, 0.28];
export const TERM_TholinMAUVE  = [0.72, 0.52, 0.78];  // cold organic haze transmits cool, not warm
export const TERM_DUST_BLUE    = [0.45, 0.60, 1.00];

export function atmosphereOpticsOf(cond) {
  const T    = cond?.T_eq ?? 288;
  const prim = primordialFractionOf(cond);
  const haze = hazeFractionOf(cond);
  const col  = columnFractionOf(cond);

  // Solid-body limb: clear Rayleigh blue, pushed toward haze hue, then desaturated toward dust grey as
  // the column thins out. A hydrogen envelope overrides it with the deck ramp.
  const clear = mix3(DUST_GREY, RAYLEIGH_BLUE, col);
  const solid = mix3(clear, hazeColorOf(T), haze * col);
  const limbColor = mix3(solid, deckColorOf(T), prim);

  // Transmitted hue. Cold organic haze transmits mauve; hot haze transmits amber; clear columns redden;
  // a thin dry column inverts to blue. Hydrogen decks reuse their own scattered hue, warmed.
  const hazeTerm = mix3(TERM_TholinMAUVE, TERM_HAZE_AMBER, smoothstep(200, HAZE_T_HOT, T));
  // The inverted-sunset regime holds until there is a real column to redden: a 0.01 bar dusty wisp
  // still forward-scatters blue. Ramping on col DIRECTLY faded it out far too early (measured: it put
  // a 0.01 bar body a third of the way to sunset red), so the transition is deferred with its own ramp.
  const clearTerm = mix3(TERM_DUST_BLUE, TERM_RAYLEIGH_RED, smoothstep(0.15, 0.85, col));
  const solidTerm = mix3(clearTerm, hazeTerm, haze * col);
  // Hydrogen decks transmit their OWN hue, reddened by how hot the deck is — a cold methane deck stays
  // a cool blue band, a warm ammonia deck goes gold-amber, a hot alkali deck goes deep red. Particulate
  // haze MUTES that reddening (a hazy deck transmits diffuse, not saturated).
  const redden = smoothstep(60, 150, T) * 0.75 * (1 - 0.3 * haze);
  const termColor = mix3(solidTerm, mix3(deckColorOf(T), TERM_RAYLEIGH_RED, redden), prim);

  // A thick particulate shroud scatters into a FAT detached halo; a clear column keeps a narrow rim line.
  const thick = clamp01(Math.max(haze, prim * smoothstep(130, 550, T)));
  return {
    limbColor, termColor,
    limbExponent: 3.5 - 1.7 * thick,   // 3.5 narrow line -> 1.8 broad halo
    hazeFraction: haze,
    primordialFraction: prim,
    columnFraction: col,
    thickHaze: thick,
  };
}
