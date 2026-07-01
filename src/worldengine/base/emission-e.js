// src/worldengine/base/emission-e.js
// ─────────────────────────────────────────────────────────────────────────────
// EMISSION-E — BLACKBODY THERMAL EMISSION REGISTER (data layer for ATMOSPHERE #2)
// (World-Engine production-L1, increment #2 "Blackbody Emission v1" — Slice 1)
//
// WHAT THIS BUILDS (plain language). A self-luminous THERMAL EMISSION register as DATA over the sphere:
// a per-node absolute Kelvin temperature field T(node) plus its blackbody chromaticity + visible
// luminance. Two geometries fall out of ONE writer driven by a handful of scalars:
//   • NON-LOCKED giant  → the annual-mean LATITUDINAL temperature shape (no substellar hotspot):
//                         T(φ) = tempEq · DAY_LIFT · W(φ,ε)   [W = #3a Ward insolation, imported].
//   • TIDALLY-LOCKED hot giant → a substellar DAYSIDE peak advected EASTWARD by the prograde jet,
//                         bounded below by a nightside floor:
//                         T(node) = mix(NIGHT_FLOOR_K, dayPeakK, max(dot(node,hotspotDir),0)^redistribution).
// Every field is a closed-form END-STATE (a pure function of node direction + driver scalars + seed) —
// never a time-stepped simulation, mirroring climate-e5.js discipline.
//
// WHY IT EXISTS. #2's RENDER already exists in the lab (F32 dayside-hotspot + F33 nightside-glow, the
// one-curve `emissiveBlackbody` ramp). This module STANDS UP the tested, reusable DATA register behind
// it: the Planck→RGB color law (AC1), the absolute T-field construction (AC2), and the determinism +
// #3a-non-interference invariants (AC3). It is the substrate #5 (brown-dwarf self-luminous) and #6
// (lava rock-vapour glow) read from later.
//
// NEVER WRITES RELIEF OR #3a FIELDS. Like climate-e5.js this writer NEVER touches carrier.height (or any
// relief / reflectance / band channel). It RETURNS its own Float32Arrays; the render/bake seam decides
// expression. #2 ADDS a register, it never edits the reflectance path (AC3 / AC7 regression gate).
//
// ONE CURVE, PINNED BY A PARITY TEST. `emissiveBlackbody` here is the CPU twin of the shared
// incandescence ramp (planet-lod-lab-core.js §1 + planet-lod-height.glsl.js). base/ modules stay
// self-contained w.r.t. the repo-root lab core, so the color stops are DUPLICATED here (EMISSION_BB_STOPS)
// and the mandatory CPU↔GLSL parity test pins them byte-equal to the shader's stops so a future
// stop-edit can't silently diverge across F32/F33/F41.
//
// DETERMINISM HARD-RULE: no Math.random / Date.now anywhere. Every random draw is alea seeded off the
// integer macroSeed in a DISJOINT namespace (`emissionE:*`, disjoint from `climateE5:*`/`plates:*`/
// `shell:*`). Same (regime, macroSeed, drivers, opts) ⇒ byte-identical fields.
// ─────────────────────────────────────────────────────────────────────────────
import alea from 'alea';
import { clamp, mix, smoothstep } from './mathutil.js';
import { wardInsolation, DRIVER_BUNDLES, E5_REGIME } from './climate-e5.js';

const DEG2RAD = Math.PI / 180;

// ── Physics constants (see the header for provenance) ─────────────────────────
//   DAY_LIFT         internal-heat / substellar lift factor on tempEq → the effective emitting peak.
//                    (calibrated in the lab: uDayTempK = T_eq × 1.15.)
//   NIGHT_FLOOR_K    the "Keating universal" nightside floor a locked hot giant never drops below.
//   HOTSPOT_OFFSET_RAD  eastward advection of the substellar hotspot by the prograde equatorial jet
//                    (0.26 rad ≈ 15°, calibrated between WASP-43b 7.75° and HD-189733b 30°).
//   LUM_ANCHOR_K     visibleLuminance re-anchor point: L(1800 K)=1 (NOT 6500 K — anchoring at 6500 K
//                    would render a 1500–2500 K hot-Jupiter numerically black).
export const EMISSION_PHYS = Object.freeze({
  DAY_LIFT: 1.15,
  NIGHT_FLOOR_K: 1100,
  HOTSPOT_OFFSET_RAD: 0.26,
  LUM_ANCHOR_K: 1800,
});

// ── ONE-CURVE incandescence ramp — DUPLICATED from planet-lod-lab-core.js (pinned by the parity test) ──
// CHROMATICITY only (peak channel ≈ 1); caller scales brightness. Stylized Planckian-locus ramp anchored
// to real blackbody sRGB appearance (Charity), NOT a spectral integration. Red saturates first (~Draper
// point) and stays maxed; green then blue climb as the body whitens.
export const EMISSION_BB_STOPS = [
  { T:  800, c: [1.0, 0.18, 0.05] },   // deep dull red
  { T: 1500, c: [1.0, 0.42, 0.10] },   // orange
  { T: 2500, c: [1.0, 0.66, 0.32] },   // amber / yellow
  { T: 4000, c: [1.0, 0.85, 0.70] },   // warm white
  { T: 6500, c: [1.0, 0.98, 0.96] },   // white (ceiling)
];

export function emissiveBlackbody(tempK) {
  // Below the first / above the last stop → clamp to that stop (no runaway) — matches the CPU/GLSL twin.
  if (tempK <= EMISSION_BB_STOPS[0].T) return [...EMISSION_BB_STOPS[0].c];
  const last = EMISSION_BB_STOPS[EMISSION_BB_STOPS.length - 1];
  if (tempK >= last.T) return [...last.c];
  // chained-mix, each segment weighted by smoothstep(Tlo,Thi,tempK) — the GLSL chained-mix form.
  let c = [...EMISSION_BB_STOPS[0].c];
  for (let i = 1; i < EMISSION_BB_STOPS.length; i++) {
    const w = smoothstep(EMISSION_BB_STOPS[i - 1].T, EMISSION_BB_STOPS[i].T, tempK);
    c = [mix(c[0], EMISSION_BB_STOPS[i].c[0], w), mix(c[1], EMISSION_BB_STOPS[i].c[1], w), mix(c[2], EMISSION_BB_STOPS[i].c[2], w)];
  }
  return c;
}

// ── visibleLuminance — photopic-weighted visible-band blackbody luminance ─────
// Numerically integrate Planck spectral radiance × a CIE V(λ) photopic approximation over ~380–780 nm,
// RE-ANCHORED so L(LUM_ANCHOR_K = 1800 K) = 1 (AC1 physical reference). Monotonically increasing in T
// (Planck B(λ,T) rises with T at every λ ⇒ the integral rises), and ~0 (< 1e-3) below ~800 K (the
// visible band is deep in the IR tail there). This is the AC1 reference ONLY — the shipped RENDER keeps
// its own (tempK/1800)^4 quartic (Max 2026-07-01; unifying would force re-UAT of shipped F41 magma).
const H_PLANCK = 6.62607015e-34;   // J·s
const C_LIGHT = 2.99792458e8;      // m/s
const KB = 1.380649e-23;           // J/K
const C2 = (H_PLANCK * C_LIGHT) / KB;  // second radiation constant hc/k ≈ 1.438776e-2 m·K
const LAMBDA_LO = 380e-9, LAMBDA_HI = 780e-9, LAMBDA_STEPS = 400;

// CIE photopic luminous-efficiency Gaussian fit (λ in µm), a standard V(λ) approximation.
function photopicV(lambdaMeters) {
  const lUm = lambdaMeters * 1e6;
  const d = lUm - 0.559;
  return 1.019 * Math.exp(-285.4 * d * d);
}
// Relative Planck spectral radiance (the constant 2hc² prefactor is dropped — we normalize by an anchor).
function planckRel(lambdaMeters, tempK) {
  const x = C2 / (lambdaMeters * tempK);
  const denom = Math.pow(lambdaMeters, 5) * (Math.exp(x) - 1);
  return denom > 0 && Number.isFinite(denom) ? 1 / denom : 0;   // cold T ⇒ exp(x)→∞ ⇒ 0 (no NaN)
}
function bandLuminance(tempK) {
  if (!(tempK > 0)) return 0;
  const dl = (LAMBDA_HI - LAMBDA_LO) / LAMBDA_STEPS;
  let sum = 0;
  for (let i = 0; i <= LAMBDA_STEPS; i++) {
    const lam = LAMBDA_LO + i * dl;
    const w = (i === 0 || i === LAMBDA_STEPS) ? 0.5 : 1.0;   // trapezoid rule
    sum += w * planckRel(lam, tempK) * photopicV(lam) * dl;
  }
  return sum;
}
const _LUM_ANCHOR = bandLuminance(EMISSION_PHYS.LUM_ANCHOR_K);   // pure, module-load-once
export function visibleLuminance(tempK) {
  if (!(tempK > 0)) return 0;
  return bandLuminance(tempK) / _LUM_ANCHOR;
}

// ── blackbodyEmission — the AC1 bundle: chroma + luminance + hard-clip tonemap ─
// rgb           = the one-curve emissiveBlackbody chromaticity (peak channel ≈ 1).
// lum           = visibleLuminance(tempK) (re-anchored to 1800 K).
// rgbTonemapped = per-channel min(rgb·lum, 1). There is NO global tonemapper in this lab — hard clip
//                 only (a global ACES pass would shift the reflectance path and break AC7).
export function blackbodyEmission(tempK) {
  const rgb = emissiveBlackbody(tempK);
  const lum = visibleLuminance(tempK);
  const rgbTonemapped = [
    Math.min(rgb[0] * lum, 1),
    Math.min(rgb[1] * lum, 1),
    Math.min(rgb[2] * lum, 1),
  ];
  return { rgb, lum, rgbTonemapped };
}

// ── geometry helper: rotate a unit substellar dir EASTWARD about +y ───────────
// "East" is the carrier's own convention: east = normalize((0,1,0) × dir) (sphereField.tangentFrameAt).
// dir ⊥ east and both unit ⇒ dir·cos + east·sin is the unit vector rotated eastward by `angle`.
function rotateEast(dir, angle) {
  let ex = dir[2], ey = 0, ez = -dir[0];
  const el = Math.hypot(ex, ey, ez);
  if (el < 1e-8) { ex = 0; ey = 0; ez = -1; } else { ex /= el; ey /= el; ez /= el; }
  const ca = Math.cos(angle), sa = Math.sin(angle);
  return [dir[0] * ca + ex * sa, dir[1] * ca + ey * sa, dir[2] * ca + ez * sa];
}

/**
 * Resolve the per-seed / per-body emission scalars. Pure given (regime, opts, macroSeed). A single
 * `emissionE:params:*` alea draw supplies a tiny ±1.4° per-seed offset jitter — applied to the
 * non-locked obliquity (latitude shape) AND, in radians, to the locked hotspot advection offset.
 */
function resolveEmissionParams(regime, opts, macroSeed) {
  const {
    tempEq = 288,
    locked = false,
    eqSign = 1,
    hotspotOffset = EMISSION_PHYS.HOTSPOT_OFFSET_RAD,
    redistribution = 3.0,
    obliquityDeg,
  } = opts;
  const seed = macroSeed | 0;
  const rng = alea('emissionE:params:' + regime + ':' + seed);
  const jitterDeg = (rng() - 0.5) * 2 * 1.4;               // ±1.4° per-seed offset jitter (fixed draw)

  const baseObliquity = obliquityDeg
    ?? (DRIVER_BUNDLES[regime]?.obliquityDeg)
    ?? 0;
  const effObliquityDeg = baseObliquity + jitterDeg;
  const effHotspotOffset = hotspotOffset + jitterDeg * DEG2RAD;   // tiny per-seed advection jitter
  const eastSign = Math.sign(eqSign) || 1;

  const dayPeakK = tempEq * EMISSION_PHYS.DAY_LIFT;
  const nightFloorK = EMISSION_PHYS.NIGHT_FLOOR_K;

  return {
    regime, macroSeed: seed, tempEq, locked,
    eqSign, eastSign, redistribution,
    hotspotOffset: effHotspotOffset, obliquityDeg: effObliquityDeg,
    dayPeakK, nightFloorK, jitterDeg,
    dayLift: EMISSION_PHYS.DAY_LIFT,
  };
}

/**
 * Blackbody thermal-emission writer. Evaluates the closed-form T-field per carrier node and RETURNS its
 * OWN Float32Arrays + geometry. It does NOT mutate carrier.height (or any relief / #3a field) — AC3.
 *
 * @param {object} carrier  F3 sphere carrier (makeSphereField output): needs verts (unit dirs) + N.
 * @param {object} drivers  reserved E6 driver overrides (accepted for signature parity; v1 unused
 *                          beyond obliquity-via-opts). Kept so callers mirror writeClimateE5Sphere.
 * @param {object} opts     { regime, macroSeed, tempEq, locked, eqSign, hotspotOffset, redistribution,
 *                            obliquityDeg }.
 * @returns {{ emitT:Float32Array, emitLum:Float32Array, substellarDir:Float32Array,
 *             hotspotDir:Float32Array, dayPeakK:number, nightFloorK:number, locked:boolean,
 *             params:object }}
 *   emitT   absolute Kelvin temperature per node (the #5/#6 substrate).
 *   emitLum re-anchored visibleLuminance(emitT) per node.
 */
export function writeEmissionESphere(carrier, drivers = {}, opts = {}) {
  const { regime = E5_REGIME.GAS_GIANT, macroSeed = 0 } = opts;
  const P = resolveEmissionParams(regime, opts, macroSeed);
  const N = carrier.N;
  const verts = carrier.verts;

  // Substellar point fixed at +x (lon 0, lat 0); hotspot advected eastward by the (jittered) offset,
  // its direction flipping with the equatorial-jet sign (retrograde ⇒ westward).
  const substellarDir = [1, 0, 0];
  const hotspotDir = rotateEast(substellarDir, P.hotspotOffset * P.eastSign);

  const emitT = new Float32Array(N);
  const emitLum = new Float32Array(N);

  if (P.locked) {
    const span = P.dayPeakK - P.nightFloorK;
    for (let i = 0; i < N; i++) {
      const v = verts[i];
      const d = Math.max(v[0] * hotspotDir[0] + v[1] * hotspotDir[1] + v[2] * hotspotDir[2], 0);
      const w = Math.pow(d, P.redistribution);
      let T = P.nightFloorK + span * w;                     // = mix(nightFloor, dayPeak, w)
      T = clamp(P.nightFloorK, P.dayPeakK, T);               // bounded [nightFloorK, dayPeakK]
      emitT[i] = T;
      emitLum[i] = visibleLuminance(T);
    }
  } else {
    // NON-LOCKED: annual-mean latitudinal shape only (no longitudinal hotspot).
    for (let i = 0; i < N; i++) {
      const y = clamp(-1, 1, verts[i][1]);                   // sin(lat) on the unit-dir carrier
      const T = P.tempEq * P.dayLift * wardInsolation(y, P.obliquityDeg);
      emitT[i] = T;
      emitLum[i] = visibleLuminance(T);
    }
  }

  return {
    emitT, emitLum,
    substellarDir: Float32Array.from(substellarDir),
    hotspotDir: Float32Array.from(hotspotDir),
    dayPeakK: P.dayPeakK,
    nightFloorK: P.nightFloorK,
    locked: P.locked,
    params: P,
  };
}

/**
 * OPTIONAL parity stub (mirrors bakeClimateE5Attributes) — bake per-render-vertex emission attributes
 * onto a render mesh for #5/#6. NOT wired into the #2 render. Samples the SAME closed form on render
 * verts, so aEmitT/aEmitLum are the tested writer fields at matching node directions.
 * @param {Float32Array|number[]} positions flat [x,y,z,...] object-space render-vertex positions.
 * @param {number} count  vertex count.
 * @param {number} radius render sphere radius R (positions/R = unit node dir).
 */
export function bakeEmissionEAttributes(positions, count, radius, opts = {}) {
  const { regime = E5_REGIME.GAS_GIANT, macroSeed = 0 } = opts;
  const P = resolveEmissionParams(regime, opts, macroSeed);
  const substellarDir = [1, 0, 0];
  const hotspotDir = rotateEast(substellarDir, P.hotspotOffset * P.eastSign);
  const aEmitT = new Float32Array(count);
  const aEmitLum = new Float32Array(count);
  const span = P.dayPeakK - P.nightFloorK;
  for (let i = 0; i < count; i++) {
    const nx = positions[3 * i] / radius, ny = positions[3 * i + 1] / radius, nz = positions[3 * i + 2] / radius;
    let T;
    if (P.locked) {
      const d = Math.max(nx * hotspotDir[0] + ny * hotspotDir[1] + nz * hotspotDir[2], 0);
      T = clamp(P.nightFloorK, P.dayPeakK, P.nightFloorK + span * Math.pow(d, P.redistribution));
    } else {
      T = P.tempEq * P.dayLift * wardInsolation(clamp(-1, 1, ny), P.obliquityDeg);
    }
    aEmitT[i] = T;
    aEmitLum[i] = visibleLuminance(T);
  }
  return { aEmitT, aEmitLum, params: P, dayPeakK: P.dayPeakK, nightFloorK: P.nightFloorK };
}
