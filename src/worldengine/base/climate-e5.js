// src/worldengine/base/climate-e5.js
// ─────────────────────────────────────────────────────────────────────────────
// E5 ATMOSPHERE / CLIMATE — ZONAL BAND / JET PROFILE  (World-Engine production-L1, increment 3a)
//
// THE LIFT (increment-3a MUST-FIX, pre-scope). The gas-giant band/jet profile u(lat) lived ONLY in
// GLSL — src/objects/Planet.js, the GAS_BODY shader:
//       planetType 1 (gas-giant):   sin(pos.y*noiseScale*3.5)*0.5 + sin(..*7.0+0.5)*0.3 + sin(..*13.0)*0.12
//       planetType 6 (hot-jupiter): sin(pos.y*noiseScale*2.5)*0.3 + sin(..*5.0)*0.15
//       planetType 10 (sub-neptune):sin(pos.y*noiseScale*3.0)*0.1 + sin(..*6.0)*0.05
// A GLSL profile cannot be exercised by a headless test, so the increment-3a acceptance criteria
// (AC1 no-RNG static-source guard, byte-identity, boundedness, zonal structure) had no home. This
// module ports that profile into a THREE-FREE, deterministic base/ writer so those ACs run in vitest.
//
// FAITHFUL-IN-CHARACTER, AND A GENUINE u(lat). For a unit-direction carrier every vert is a point on
// the unit sphere, so `vert.y === sin(latitude)` — which is EXACTLY the shader's object-space `pos.y`
// on the unit body. The port is therefore near-literal (same harmonics, same phases, same amplitudes)
// AND is a true function of latitude: b(y) with y = sin(lat). No visual redesign is smuggled in here.
//
// SCOPE OF THE LIFT — deliberate NON-GOALS (each is scoped increment-3a/3b work, NOT the lift):
//   • NOT wired into any shader. The GLSL in Planet.js is left UNTOUCHED. Rewiring the shader to
//     consume this field is a VISIBLE change and belongs in the scoped #3a increment (behind ACs).
//   • Signed zonal WIND + regime-dependent equatorial-jet SIGN (prograde Jovian/Saturnian vs
//     RETROGRADE Neptunian/ice; sciadv ads8899) → #3b. The lift ports the UNSIGNED band value the
//     shader draws today, not a signed wind field.
//   • temperature + precip + orographic / rain-shadow coupling onto baseLevel / precipWeight → #3a.
//   • vortex / great-spot / storm-train / polar-vortex PLACEMENT (argmax anticyclonic shear) → #3b
//     (its own intent.md + contract.json). The zonal field does NOT emit vortices on its own.
//   • sub-Neptune muted-haze branch (hazeOpacity = hazeTempBell(T_eq); bandField *= 1 - hazeMute·op) → #3.
//   • per-seed band variety (phase/amplitude jitter keyed off macroSeed) → #3a (see `macroSeed` note).
//   • EYEBALL (planetType 7) is NOT a zonal band — its shader pattern is concentric rings about the
//     sub-stellar point (angDist), a different mechanism. It has no u(lat) jet profile and is excluded.
//
// THREE-FREE BY CONSTRUCTION: imports only the pure scalar helpers in mathutil.js (plates.js
// discipline). It NEVER imports three. (alea/simplex-noise are NOT needed yet — the faithful zonal
// profile is a pure deterministic function of latitude with no random draw; the seed hook is reserved
// for the #3a per-seed jitter. See DETERMINISM note.)
//
// DETERMINISM HARD-RULE: no Math.random / Date.now anywhere. The profile is a pure function of
// (regime, y, bandFreq) — same inputs => byte-identical field. `macroSeed` is accepted for signature
// parity with the writer family (plates.js) and reserved for the future #3a per-seed jitter; the
// faithful lift does not consume it, which is WHY the AC1 no-RNG static-source guard passes trivially.
//
// GAS GIANTS HAVE NO RELIEF, EVER: this writer NEVER writes carrier.height (or any relief channel).
// It RETURNS the band field + profile diagnostics; deciding the render/bake channel is #3a work.
// ─────────────────────────────────────────────────────────────────────────────
import { clamp, clamp01 } from './mathutil.js';

// The three banded gas archetypes the GLSL u(lat) profile covers. (Eyeball is concentric, excluded.)
export const E5_REGIME = Object.freeze({
  GAS_GIANT: 'gas-giant',
  HOT_JUPITER: 'hot-jupiter',
  SUB_NEPTUNE: 'sub-neptune',
});

// Per-regime harmonic content — ported VERBATIM from the Planet.js GAS_BODY shader `bands` sum.
// Each term is { f: frequency multiplier, a: amplitude, p: phase } and evaluates as
//   Σ a·sin(y · bandFreq · f + p)     with y = sin(latitude).
// The argument `y · bandFreq · f` reproduces the shader's `pos.y · noiseScale · f` exactly when
// bandFreq === the body's noiseScale uniform (the reconciliation deferred to #3a shader-rewire).
export const HARMONICS = Object.freeze({
  [E5_REGIME.GAS_GIANT]:   Object.freeze([
    Object.freeze({ f: 3.5, a: 0.5,  p: 0.0 }),
    Object.freeze({ f: 7.0, a: 0.3,  p: 0.5 }),
    Object.freeze({ f: 13.0, a: 0.12, p: 0.0 }),
  ]),
  [E5_REGIME.HOT_JUPITER]: Object.freeze([
    Object.freeze({ f: 2.5, a: 0.3,  p: 0.0 }),
    Object.freeze({ f: 5.0, a: 0.15, p: 0.0 }),
  ]),
  [E5_REGIME.SUB_NEPTUNE]: Object.freeze([
    Object.freeze({ f: 3.0, a: 0.1,  p: 0.0 }),
    Object.freeze({ f: 6.0, a: 0.05, p: 0.0 }),
  ]),
});

// Analytic amplitude bound of the raw band sum per regime = Σ|a| (each sine ∈ [-1,1]).
// gas-giant 0.92, hot-jupiter 0.45, sub-neptune 0.15. The bounded-ness AC asserts |band| ≤ this.
export const BAND_BOUND = Object.freeze({
  [E5_REGIME.GAS_GIANT]:   0.92,
  [E5_REGIME.HOT_JUPITER]: 0.45,
  [E5_REGIME.SUB_NEPTUNE]: 0.15,
});

export const DEFAULTS = Object.freeze({
  // noiseScale-equivalent global frequency multiplier. In the shader this is the PER-BODY `noiseScale`
  // uniform (Planet.js: `noiseScale: { value: d.noiseScale }`), so band count varies by body. The lift
  // pins a single documented default so the profile is well-defined headless; the shader-rewire in #3a
  // must thread the body's real noiseScale here (RECONCILE). 6.0 gives a Jupiter-plausible band count
  // (~a dozen alternating bands pole-to-pole for the gas-giant harmonic set) for the structure tests.
  BAND_FREQ: 6.0,
});

/**
 * Raw zonal band profile b(y) — the direct port of the shader's `bands` harmonic sum.
 * Pure, deterministic, no RNG. y = sin(latitude) = a unit-direction carrier vert's y-component.
 *
 * @param {number} y        sin(latitude) ∈ [-1, 1] (the node's unit-sphere y-component / shader pos.y).
 * @param {string} regime   one of E5_REGIME.* (banded gas archetype).
 * @param {object} [opts]   { bandFreq } — noiseScale-equivalent frequency (defaults to DEFAULTS.BAND_FREQ).
 * @returns {number} the raw band value (Σ a·sin(y·bandFreq·f + p)); ~0 for an unknown/relief regime.
 */
export function zonalBandProfile(y, regime = E5_REGIME.GAS_GIANT, { bandFreq = DEFAULTS.BAND_FREQ } = {}) {
  const H = HARMONICS[regime];
  if (!H) return 0;                     // non-banded / unknown regime → flat (no zonal identity)
  const yc = clamp(-1, 1, y);
  let b = 0;
  for (let k = 0; k < H.length; k++) b += H[k].a * Math.sin(yc * bandFreq * H[k].f + H[k].p);
  return b;
}

/**
 * Sample the zonal profile across latitude and report its jet structure. Sampling is uniform in
 * y = sin(lat) (equal-area in latitude), matching how the profile is evaluated on the carrier.
 * The "jet count" = number of sign changes of the profile's first difference = number of alternating
 * band extrema pole-to-pole. This is the structural diagnostic the AC3 zonal-structure gate reads:
 * gas-giant is the richest (more harmonics), sub-neptune the smoothest.
 *
 * @returns {{ys:Float64Array, band:Float64Array, jetCount:number, maxAbs:number}}
 */
export function sampleJetProfile(regime = E5_REGIME.GAS_GIANT, { bandFreq = DEFAULTS.BAND_FREQ, samples = 401 } = {}) {
  const n = Math.max(3, samples | 0);
  const ys = new Float64Array(n);
  const band = new Float64Array(n);
  let maxAbs = 0;
  for (let i = 0; i < n; i++) {
    const y = -1 + (2 * i) / (n - 1);            // uniform in sin(lat), pole (-1) → pole (+1)
    ys[i] = y;
    const b = zonalBandProfile(y, regime, { bandFreq });
    band[i] = b;
    if (Math.abs(b) > maxAbs) maxAbs = Math.abs(b);
  }
  // count extrema via sign changes of the discrete derivative (a jet == a band boundary / crest)
  let jetCount = 0, prevSign = 0;
  for (let i = 1; i < n; i++) {
    const d = band[i] - band[i - 1];
    const s = d > 0 ? 1 : d < 0 ? -1 : 0;
    if (s !== 0 && prevSign !== 0 && s !== prevSign) jetCount++;
    if (s !== 0) prevSign = s;
  }
  return { ys, band, jetCount, maxAbs };
}

/**
 * E5 zonal band/jet writer. Evaluates the ported u(lat) profile per carrier node and RETURNS the band
 * field + diagnostics. It does NOT mutate any carrier relief channel (gas giants have no relief).
 *
 * @param {object} carrier  F3 sphere carrier (makeSphereField output): needs verts + N (+ latDegOf).
 * @param {object} drivers  the E6 driver bundle — accepted for writer-family signature parity; NOT
 *                          consumed by the faithful lift (per-seed / driver-response variety is #3a).
 * @param {object} opts     { regime, bandFreq, macroSeed } — macroSeed reserved (see file header).
 * @returns {{bandField:Float32Array, bandNorm:Float32Array, regime:string, bandFreq:number,
 *            jetCount:number, maxAbs:number}}
 *   bandField : raw zonal band value b(y) per node (the shader's `bands`, pre-turbulence).
 *   bandNorm  : clamp01(b*0.5 + 0.5) per node — the shader's `n` mapping sans turbulence/storm, for
 *               a render-parity [0,1] band value when #3a wires this in.
 */
export function writeClimateE5Sphere(carrier, drivers = {}, { regime = E5_REGIME.GAS_GIANT, bandFreq = DEFAULTS.BAND_FREQ, macroSeed = 0 } = {}) {
  void drivers;   // signature parity only (faithful lift is driver-independent — see @param drivers)
  void macroSeed; // reserved for the #3a per-seed jitter (see DETERMINISM note); unused in the lift
  const N = carrier.N;
  const verts = carrier.verts;
  const bandField = new Float32Array(N);
  const bandNorm = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const y = clamp(-1, 1, verts[i][1]);                 // y = sin(lat) on the unit-dir carrier
    const b = zonalBandProfile(y, regime, { bandFreq });
    bandField[i] = b;
    bandNorm[i] = clamp01(b * 0.5 + 0.5);
  }
  const { jetCount, maxAbs } = sampleJetProfile(regime, { bandFreq });
  return { bandField, bandNorm, regime, bandFreq, jetCount, maxAbs };
}
