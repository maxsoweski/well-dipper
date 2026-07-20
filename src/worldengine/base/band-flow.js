// src/worldengine/base/band-flow.js
// ─────────────────────────────────────────────────────────────────────────────
// BAND-FLOW — CPU MIRRORS for the atmo-expression render terms (World-Engine
// production-L1, atmosphere increment #3b RENDER half — "expression": interaction /
// ink-in-water / per-band jaggedness). BUILD-PLAN world-engine-atmo-expression-2026-07-17.
//
// WHAT THIS BUILDS (plain language). The GLSL that renders the "fluid world" read lives in
// zonalBandCol (planet-lod-height.glsl.js) and has NO headless test surface — vitest has no GPU. So the
// numeric TRUTH of the three new render terms lives HERE, as pure-JS mirrors the shader is a faithful
// transcription of (the emission-e CPU↔GLSL constant-parity precedent, the storm-e "new sibling module"
// precedent). Four mirrors + one new disjoint alea draw:
//   bandProxy(lat, P)             the 6-uniform ANALYTIC reconstruction of the baked band value aBand
//                                 (BUILD-PLAN §0.2 derivation) — used render-side ONLY to form a
//                                 DEFLECTION DELTA (bandProxy(lat+dLat) − bandProxy(lat)); the baked
//                                 aBand + GOLDEN_BANDFIELD_HASH are never touched.
//   advectDisplacement(dir,P,..)  the ANISOTROPIC "ink in water" meridional displacement (slice K) —
//                                 long correlation ALONG the zonal flow, short ACROSS it, + a
//                                 shear-interface FOLD. The AC-ADVECT anisotropy source.
//   stormBandDrag(dir,vorts,P,..) the storm-anchored bow + downstream wake meridional displacement
//                                 (slice I / dWake) — the AC-INTERACT / wake-reach source.
//   bandRoughness(wBand,wShear,r) the per-band edge-roughness SCALE (slice J) — belt/zone base (cyc) +
//                                 high-shear edge boost. The AC-JAG source.
//   drawBandRoughness(regime,seed)the per-seed global roughness draw uBandRough on the NEW disjoint
//                                 alea stream `bandFlow:rough:<regime>:<macroSeed>` (append-only).
//
// WHY IT IS A SIBLING (never edits climate-e5 / storm-e). #3a (climate-e5.js) owns the signed jet field
// u(lat) + its analytic shear; #3b-place (storm-e.js) owns the discrete vortices + mask. This module
// READS the resolved #3a param bundle P (import resolveParams/jetProfile/jetShear/jetShearPeak/PHYS,
// READ-ONLY) and mirrors the render terms that ride on it. It NEVER imports storm-e (the vortices are
// passed IN to stormBandDrag), NEVER mutates a carrier, NEVER writes a baked attribute. The one new
// alea stream is disjoint from every climateE5:* / stormE:* / giantD:* stream, so both goldens
// (GOLDEN_BANDFIELD_HASH −1329854088, GOLDEN_STORM_MASK_HASH 568852786) are frozen by construction.
//
// STATIC PLACE-ONCE (program discipline, non-negotiable): NO uTime anywhere. Every field is a pure
// function of position + P (+ the per-seed static warp offset). The viscous look is a baked/analytic
// STILL that READS fluid, not a running sim. Alea-only randomness (one draw: drawBandRoughness).
//
// CONSTANTS ARE CANDIDATES: the BAND_FLOW block below holds Phase-A CANDIDATE constants. The final
// freeze happens at working-Claude's live A/B read-gate (BUILD-PLAN §6.0 Phase B) AFTER this workstream.
// The candidates + the AC assertion bands they pin are documented in calibration-candidates.md
// (produced by tools/atmo-expression-calibrate.mjs).
//
// ── A NOTE ON THE ADVECTION DOMAIN TRANSFORM (deviation from BUILD-PLAN §3.1 literal pseudocode) ──
// §3.1's pseudocode builds the local flow frame AT the sample point Nraw and uses e = dot(Nraw, eF) to
// scale the domain. But a unit point is ORTHOGONAL to its own tangent frame, so e = dot(Nraw, eF) ≡ 0
// (and n = dot(Nraw, cross(Nraw,eF)) ≡ 0) — the literal transcription collapses to an ISOTROPIC warp and
// the fold vanishes, which would land AC-ADVECT's ratio at ~1.0 (the null) and FAIL. Point-sampled noise
// can only be made anisotropic by anisotropically SCALING THE DOMAIN AXES. Zonal flow is east–west =
// along longitude everywhere (bands are latitude circles), so compressing the equatorial (x,z /
// longitude) plane by 1/uInkStretch while keeping y (meridional) elongates warp features ALONG the flow —
// exactly §3.1's stated intent ("long east, short north"), globally consistent, singular-free. This is
// the numeric-truth realization per BUILD-PLAN §2.3 ("numeric truth lives in the mirror"); the slice-K
// GLSL builder transcribes THIS. Recorded as an ADJUDICABLE deviation (BUILD-PLAN §9) — surfaced in
// calibration-candidates.md; the mechanism boundary (stretch+fold, NOT literal vortex roll-up) is
// unchanged (BUILD-PLAN §3.1 mechanism-boundary note).
// ─────────────────────────────────────────────────────────────────────────────
import alea from 'alea';
import { createNoise3D } from 'simplex-noise';
import { clamp, clamp01, smoothstep } from './mathutil.js';
import { PHYS, jetProfile, jetShear, jetShearPeak } from './climate-e5.js';

// ── CANDIDATE constants (Phase-A; pinned to the calibration sweep, frozen at the live read-gate) ──────
// Every value here is a CANDIDATE. WAKE_BOW/WAKE_AMP/INK_AMP were raised above BUILD-PLAN §3.2's starting
// estimates by the Phase-A perceptual-floor pin (fluid-lens must-fix #1/#4: a field can satisfy the
// anisotropy RATIO yet read as nothing — so amplitude is floored to a band-width fraction, not merely
// "diff-detectable"). See calibration-candidates.md for the measured pins.
export const BAND_FLOW = Object.freeze({
  // ink-in-water (slice K)
  INK_FREQ: 2.2,          // base tendril frequency (over the unit-sphere domain)
  INK_AMP: 0.12,          // base meridional displacement (rad) at uAtmoInk=1 — FROZEN at the 2026-07-17 Phase-B read-gate: the 0.06 candidate read sub-perceptual at full disk; ×2 puts the default dial at the confirmed fluid read (evidence/readgate-bandedge-ink*.png)
  INK_OFF: Object.freeze([2.7, -1.9, 5.3]),   // decorrelated static warp offset (octave 1)
  INK_OFF2: Object.freeze([-8.1, 4.4, -2.6]), // decorrelated static warp offset (octave 2)
  FOLD_K: 0.5,            // shear-interface fold gain (breaking-wave / festoon read — NOT a vortex roll-up)
  FOLD_FREQ: 9.0,         // meridional fold frequency
  FOLD_OFF: Object.freeze([1.7, -3.3, 6.1]),  // decorrelated fold warp offset
  // per-band jaggedness (slice J)
  ROUGH_FREQ: 7.0,        // high-freq jag warp (well above the 3.7 filament / 2.2 advection → distinct band)
  ROUGH_AMP: 0.15,        // jag displacement amplitude on bandVal — FROZEN ×1.5 at the Phase-B read-gate (typical per-seed draws read subtle at 0.10; serration confirmed at the edge, evidence/readgate-bandedge-jag*.png)
  ROUGH_BELT: 0.7,        // per-band base: whole belts (cyc≈1) carry this baseline roughness
  ROUGH_EDGE: 0.5,        // edge boost: extra roughness at high-shear boundaries
  ROUGH_OFF: Object.freeze([-5.9, 2.2, 8.8]), // decorrelated jag warp offset
  ROUGH_MEAN: 1.0,        // per-seed global roughness draw mean (uBandRough)
  ROUGH_SPREAD: 0.4,      // per-seed global roughness draw half-range (±)
  // storm interaction / wake (slice I). The downstream coordinate ds = sin(θ) caps at 1 on the sphere, so
  // ds/R caps at 1/R (~4–5.5 for the R∈[0.18,0.30] primary) — WAKE_LEN is sized so the cone stays active
  // to that sphere-limited reach (well past the old 2.6R GRS cone), not to a literal 6R that never closes.
  WAKE_LEN: 4.5,          // downstream cone scale (× storm R; cone closes at along≈1.15 ⇒ ds/R≈5.2)
  WAKE_WID: 1.2,          // wake lateral Gaussian width (× storm R)
  WAKE_BOW: 0.34,         // near-storm rotational bow amplitude (× storm R) — pinned so Jovian bow ≥0.25 band-width
  WAKE_AMP: 0.22,         // downstream wake ridge amplitude (× storm R) — pinned to a band-width fraction
  WAKE_K: 7.0,            // von-Kármán meander wavenumber in the tail
});

// ── Uniform defaults (the three GUI value-slider driver-overrides; BUILD-PLAN §5/§6) ──────────────────
export const BAND_FLOW_DEFAULTS = Object.freeze({
  uAtmoInk: 1.0,      // THE boldness dial (scales dWake AND dAdvect); GUI 0..2; Max tames at UAT
  uInkStretch: 3.5,   // anisotropy (flow-axis domain compression); GUI 1..6
  // uBandRough default is per-seed (drawBandRoughness); GUI 0..2, touched-flag override in the lab
});

// ── BAND_SPIRAL (Phase-A candidates; dSpiral static log-spiral roll-up, atmo-deck-spiral slice S4) ────
// A SEPARATE frozen export — NOT folded into BAND_FLOW, whose [candidates]/[parity] tests deep-pin its
// values and dAdvect's GLSL body (which S4 never touches). dSpiral is dWake's sibling: same tangent frame,
// same count-gate, same uAtmoInk scale — a STATIC displacement that winds band material around AGED storms.
// The numeric truth lives here (spiralDisplacement); the GLSL dSpiralVec transcribes these constants with a
// [parity]-style substring test. STATIC place-once: no uTime; the only per-storm variety is the already-drawn
// ageScalar (wrap strength) + billowPhase (KH scallop azimuth) — no new alea draw in this module.
export const BAND_SPIRAL = Object.freeze({
  WRAP: 2.5,        // wrap count at ageScalar=1 (W = WRAP·age·sign(rot)); winding manifests RADIALLY (F9)
  EPS: 0.08,        // log(rr+EPS) core regularizer (keeps ψ finite as rr→0)
  AMP: 0.30,        // tangential displacement amplitude × R × uAtmoInk
  ANN_IN: 0.45, ANN_PEAK: 0.80, ANN_OUT_LO: 1.35, ANN_OUT_HI: 2.0,  // collar annulus (core oval stays coherent)
  LAMBDA_KH: 0.15,  // billow wavelength × R ⇒ NB = max(3, round(2π/0.15)) = 42 (R cancels — the R-invariant lobe count)
  SCAL: 0.35,       // scallop amplitude on the annulus (scal ∈ [1−SCAL, 1+SCAL] = [0.65, 1.35], always > 0)
  LEAN: 0.6,        // downstream lean RATE of the lobes: rad of azimuthal crest shift per unit rr, signed by
                    // local flow (F15 — a CONSTANT phase would be degenerate with billowPhase, a silent no-op)
});
// the derived KH lobe count on the annulus (R-invariant because λ_KH ∝ R cancels; adjudicable §9)
export const SPIRAL_NB = Math.max(3, Math.round((2 * Math.PI) / BAND_SPIRAL.LAMBDA_KH));   // = 42

// mirror of storm-e's MASK_FLOOR (STORM_PHYS.MASK_FLOOR = 0.06). Duplicated as a LOCAL const to honor the
// atmo import fence (band-flow imports climate-e5 READ-ONLY only; it does NOT import storm-e). Used only
// as the self-contained default gas-deck mask baseline when a caller does not pass wStorm.
const MASK_FLOOR_MIRROR = 0.06;

// ── The static warp field — a fixed-seed 3D domain-warp, position-only (no uTime, no per-planet seed) ──
// Mirrors the GLSL bandWarpField character (F24 recursive q/r domain warp, ~unit output). Per-planet
// tendril variety enters advectDisplacement via a per-seed STATIC domain offset (seedOffsetOf), the way
// the GLSL gets it from uBandOffset — the underlying warp itself is a single static field, so every
// sample is a pure function of position ⇒ same-seed byte-equal, no animation.
const _warpNoise = createNoise3D(alea('bandFlow:warp'));
export function bandWarpField(x, y, z) {
  const q = _warpNoise(x, y, z);
  return _warpNoise(x + 4.0 * q + 11.3, y + 4.0 * q - 7.1, z + 4.0 * q + 3.9);
}

// per-seed STATIC domain offset (so different seeds → different tendrils; deterministic, no uTime).
function seedOffsetOf(P) {
  const a = P.phaseJet || 0, b = P.phaseMush || 0;
  return [Math.cos(a) * 13.1, Math.sin(b) * 7.7, Math.cos(a + b) * 4.3];
}

// ── bandProxy — the 6-uniform analytic reconstruction of the baked aBand (BUILD-PLAN §0.2) ────────────
// aBand(lat) = clamp01(0.5 + 0.5·contrast·jetProfile(lat,P)/normDenom). Because normDenom = uPeak·(aEq +
// aMid·envMax), uPeak CANCELS, leaving a closed form in 6 per-planet scalars + 4 PHYS consts:
//   bandProxy(lat) = clamp01( 0.5 + DEFLECT_SCALE·( sEq·aEq·g + aMid·mid ) )
//   DEFLECT_SCALE  = 0.5·contrast / (aEq + aMid·envMax)   (the one combined uniform uBandDeflectScale)
//   g = exp(−(lat/phiEq)²);  mid = sin(m·lat + phaseJet)·(1−g)·env;  env = envBase + wardGain·s2·P2(sinLat)
// This reproduces aBand to float tolerance (parity < 1e-3, in practice ~1e-7). It is used ONLY to form a
// DEFLECTION DELTA render-side — never to replace the baked value — so aBand + its golden are untouched.
export function bandProxy(lat, P) {
  const phiEq = PHYS.PHI_EQ, aEq = PHYS.A_EQ, wardGain = PHYS.WARD_GAIN, envBase = PHYS.ENV_BASE;
  const deflectScale = 0.5 * P.contrast / (aEq + P.aMid * P.envMax);
  const s = Math.sin(lat);
  const p2 = 0.5 * (3 * s * s - 1);
  const g = Math.exp(-(lat / phiEq) * (lat / phiEq));
  const env = envBase + wardGain * P.s2 * p2;
  const mid = Math.sin(P.m * lat + P.phaseJet) * (1 - g) * env;
  return clamp01(0.5 + deflectScale * (P.sEq * aEq * g + P.aMid * mid));
}

// The 6 per-planet proxy uniforms the slice-K GLSL bandProxy consumes (export site: rebakeE5Bands reads
// bake.params → these; BUILD-PLAN §5/§6). Single-sourced here so the lab does not re-derive DEFLECT_SCALE.
export function bandProxyUniforms(P) {
  return {
    uBandM: P.m,
    uBandPhaseJet: P.phaseJet,
    uBandSEq: P.sEq,
    uBandAMid: P.aMid,
    uBandS2: P.s2,
    uBandDeflectScale: 0.5 * P.contrast / (PHYS.A_EQ + P.aMid * P.envMax),
  };
}

// ── advectDisplacement — slice K "ink in water" (anisotropic static meridional displacement) ──────────
// dir: unit node direction [x,y,z]. Returns the meridional displacement dLat (radians). Anisotropic:
// LONG along the zonal flow (east / longitude), SHORT across it (meridional), + a shear-interface fold.
// Self-contained: wBand/wShear/wStorm default from P at dir's latitude (the render passes the baked
// vBand/vShear/vStorm). MASK-gated (clamp wStorm) ⇒ 0 off-gate (non-gas). No uTime.
export function advectDisplacement(dir, P, opts = {}) {
  const ink = opts.ink != null ? opts.ink : BAND_FLOW_DEFAULTS.uAtmoInk;
  const stretch = opts.stretch != null ? opts.stretch : BAND_FLOW_DEFAULTS.uInkStretch;
  const y = clamp(-1, 1, dir[1]);
  const lat = Math.asin(y);
  const sp = opts.shearPeak != null ? opts.shearPeak : (jetShearPeak(P) || 1);
  const wShear = opts.wShear != null ? opts.wShear : clamp01(Math.abs(jetShear(lat, P)) / sp);
  const wBand = opts.wBand != null ? opts.wBand : bandProxy(lat, P);
  const wStorm = opts.wStorm != null ? opts.wStorm : clamp01(MASK_FLOOR_MIRROR + (1 - MASK_FLOOR_MIRROR) * wShear);

  const off = seedOffsetOf(P);
  // anisotropic domain: compress the zonal (x,z / longitude) plane by 1/stretch, keep y (meridional).
  const sx = dir[0] / stretch, sy = dir[1], sz = dir[2] / stretch;
  const f = BAND_FLOW.INK_FREQ, o1 = BAND_FLOW.INK_OFF, o2 = BAND_FLOW.INK_OFF2;
  const d1x = sx * f + o1[0] + off[0], d1y = sy * f + o1[1] + off[1], d1z = sz * f + o1[2] + off[2];
  const s1 = bandWarpField(d1x, d1y, d1z);
  const s2f = 0.5 * bandWarpField(sx * 2 * f + o2[0] + off[0], sy * 2 * f + o2[1] + off[1], sz * 2 * f + o2[2] + off[2]);
  // shear-interface FOLD: meridional (lat) sinusoid, belt/zone phase flip (step(0.5,wBand)), shear-gated,
  // irregularized by a decorrelated warp sample (dom1.zxy + FOLD_OFF). NOT a literal vortex roll-up.
  const fo = BAND_FLOW.FOLD_OFF;
  const foldWarp = bandWarpField(d1z + fo[0], d1x + fo[1], d1y + fo[2]);
  const foldPhase = BAND_FLOW.FOLD_FREQ * lat + Math.PI * (wBand >= 0.5 ? 1 : 0);
  const fold = BAND_FLOW.FOLD_K * clamp01(wShear) * Math.sin(foldPhase) * foldWarp;

  const inkField = s1 + s2f + fold;
  return ink * BAND_FLOW.INK_AMP * inkField * clamp01(wStorm);
}

// ── stormBandDrag — slice I "interaction" (storm-anchored bow + downstream wake) ──────────────────────
// dir: unit node direction. vortices: [{center:[x,y,z], radius, rot, aspect}, ...] (storm-e records; the
// GLSL reads uStormPosSize.xyz/.w + uStormParams.x/.y). Returns the meridional displacement dLat (rad).
// (a) near-storm rotational BOW (bands wrap the oval, dies by ~1.6R); (b) DOWNSTREAM wake cone + meander
// (carries deflection ~6R past the rim). Downstream is DERIVED from sign(bandProxy(latC)−0.5) = local
// zonal-flow sign (east in zones, west in belts) — NOT hard-coded west (fluid-lens must-fix #5). Scaled
// by uAtmoInk. COUNT-gated by construction (empty vortices ⇒ 0). No uTime.
export function stormBandDrag(dir, vortices, P, opts = {}) {
  const ink = opts.ink != null ? opts.ink : BAND_FLOW_DEFAULTS.uAtmoInk;
  if (!vortices || vortices.length === 0) return 0;
  let sum = 0;
  const n = Math.min(vortices.length, 8);
  for (let i = 0; i < n; i++) {
    const v = vortices[i];
    const c = v.center;
    const R = Math.max(v.radius || 0.1, 1e-4);
    const aspect = v.aspect || 1;
    const rot = v.rot || 1;
    // storm tangent frame (same east/north stormColTerms builds): east = normalize(cross(up, c))
    let ex0 = c[2], ex1 = 0, ex2 = -c[0];
    const exLen = Math.max(Math.hypot(ex0, ex1, ex2), 1e-4);
    ex0 /= exLen; ex1 /= exLen; ex2 /= exLen;
    const north0 = c[1] * ex2 - c[2] * ex1;   // north = cross(c, east)
    const north1 = c[2] * ex0 - c[0] * ex2;
    const north2 = c[0] * ex1 - c[1] * ex0;
    const de = dir[0] * ex0 + dir[1] * ex1 + dir[2] * ex2;
    const dn = dir[0] * north0 + dir[1] * north1 + dir[2] * north2;
    const facing = (dir[0] * c[0] + dir[1] * c[1] + dir[2] * c[2]) >= 0 ? 1 : 0;
    if (facing === 0) continue;
    const latC = Math.asin(clamp(-1, 1, c[1]));
    const flow = Math.sign(bandProxy(latC, P) - 0.5) || 1;
    const ds = flow * de;
    // (a) near-storm rotational bow
    const rr = Math.hypot(de / aspect, dn) / R;
    const bow = Math.sign(dn) * (1 - smoothstep(0.0, 1.6, rr));
    // (b) downstream wake cone + von-Kármán meander
    const along = ds / (BAND_FLOW.WAKE_LEN * R);
    const latW = dn / (BAND_FLOW.WAKE_WID * R);
    const cone = smoothstep(0.05, 0.30, ds / R) * (1 - smoothstep(0.75, 1.15, along)) * Math.exp(-latW * latW);
    const wave = Math.sin(BAND_FLOW.WAKE_K * along) * (1 - smoothstep(0.6, 1.1, along));
    sum += ink * Math.sign(rot) * facing * (BAND_FLOW.WAKE_BOW * R * bow + BAND_FLOW.WAKE_AMP * R * cone * wave);
  }
  return sum;
}

// ── bandRoughness — slice J per-band edge-roughness SCALE (BUILD-PLAN §4.1) ────────────────────────────
// Returns the roughness COEFFICIENT `rough` (pre-jag-noise, pre-ROUGH_AMP): per-band base (cyc = the
// belt/zone discriminator, from wBand) + edge boost (wShear), × the per-seed global draw uBandRough. cyc
// is the discriminator that makes whole BELTS rougher than whole ZONES (wShear alone is a BOUNDARY field
// ≈0 at every band CENTER, so it CANNOT distinguish belt from zone — fluid-lens must-fix). The GLSL edge
// term is: bandVal += ROUGH_AMP · rough · bandWarpField(pos·ROUGH_FREQ) · clamp(wStorm).
export function bandRoughness(wBand, wShear, uBandRough) {
  const cyc = clamp01((0.5 - wBand) * 2.0);   // 1 belt (cyclonic) … 0 zone
  return (BAND_FLOW.ROUGH_BELT * cyc + BAND_FLOW.ROUGH_EDGE * clamp01(wShear)) * uBandRough;
}

// ── drawBandRoughness — the per-seed global roughness draw (NEW disjoint alea stream, append-only) ─────
// uBandRough drawn per seed on `bandFlow:rough:<regime>:<macroSeed>` — a NEW namespace disjoint from every
// climateE5:* / stormE:* / giantD:* stream, so it does NOT shift any existing draw order ⇒ both goldens
// stay frozen (BUILD-PLAN §4.3; the derive-not-freeze append-only precedent). The ONLY rng in this module.
export function drawBandRoughness(regime = 'gas-giant', macroSeed = 0) {
  const rng = alea('bandFlow:rough:' + regime + ':' + (macroSeed | 0));
  return BAND_FLOW.ROUGH_MEAN + (rng() - 0.5) * 2 * BAND_FLOW.ROUGH_SPREAD;
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED METRIC HELPERS — single source of truth for the AC-ADVECT / AC-JAG estimators (so the unit test
// and the calibration tool measure the SAME quantity; no drift). Pure; import climate-e5 read-only.
// ─────────────────────────────────────────────────────────────────────────────

const dirOf = (lat, lon) => { const c = Math.cos(lat); return [c * Math.cos(lon), Math.sin(lat), c * Math.sin(lon)]; };

/**
 * AC-ADVECT anisotropy estimator (BUILD-PLAN §3.3). Ratio of decorrelation lengths L_east/L_north,
 * estimated as ⟨|∂n dLat|⟩ / ⟨|∂e dLat|⟩ (mean arc-length finite-difference gradients — the pinned
 * estimator; documented choice per §6.0 adjudicable). Longer along-flow correlation ⇒ smaller east
 * gradient ⇒ ratio > 1. Isotropic null (stretch=1) ⇒ ~1.0.
 * The RATIO is measured on the UNGATED tendril field (wStorm=1) to isolate the stretch mechanism from the
 * mask envelope: the mask is a per-latitude scalar that (a) cancels along the east transect but (b)
 * inflates the north gradient with its global latitudinal swing — a real but SEPARATE anisotropy that
 * would blur the isotropic-null test. AC-ZERO-CLOBBER owns the off-gate; AC-ADVECT owns the mechanism.
 * The peak |dLat|/|dBand| (the perceptual amplitude FLOOR — a ratio alone can pass sub-perceptual;
 * fluid-lens must-fix #1) are measured on the GATED render field (the amplitude that actually shows).
 * @returns {{ratio, peakDLat, peakDBand, peakDLatBandWidths}}
 */
export function advectAnisotropyRatio(P, opts = {}) {
  const ink = opts.ink != null ? opts.ink : BAND_FLOW_DEFAULTS.uAtmoInk;
  const stretch = opts.stretch != null ? opts.stretch : BAND_FLOW_DEFAULTS.uInkStretch;
  const lats = opts.lats || [-0.9, -0.55, -0.25, 0.25, 0.55, 0.9];   // mid-belt transect latitudes
  const lons = opts.lons || [0.3, 1.4, 2.5, 3.6, 4.7, 5.8];
  const NS = opts.steps || 512;                                       // samples per transect
  const sp = jetShearPeak(P) || 1;
  const bandWidth = Math.PI / Math.max(P.m, 1);
  let sumE = 0, cntE = 0, sumN = 0, cntN = 0, peakDLat = 0, peakDBand = 0;
  // ungated displacement (wStorm=1) → the RATIO (mechanism); gated displacement → the PEAK floors (render)
  const sample = (lat, lon) => {
    const d = dirOf(lat, lon);
    const dlUngated = advectDisplacement(d, P, { ink, stretch, shearPeak: sp, wStorm: 1 });
    const dlGated = advectDisplacement(d, P, { ink, stretch, shearPeak: sp });
    const ad = Math.abs(dlGated);
    if (ad > peakDLat) peakDLat = ad;
    const db = Math.abs(bandProxy(lat + dlGated, P) - bandProxy(lat, P));
    if (db > peakDBand) peakDBand = db;
    return dlUngated;
  };
  // EAST transects (vary lon at fixed lat); arc-length east element = cos(lat)·dlon
  for (const lat of lats) {
    const cl = Math.max(Math.cos(lat), 1e-3);
    const dLon = (2 * Math.PI) / NS;
    let prev = sample(lat, 0);
    for (let i = 1; i <= NS; i++) {
      const cur = sample(lat, i * dLon);
      sumE += Math.abs(cur - prev) / (cl * dLon); cntE++; prev = cur;
    }
  }
  // NORTH transects (vary lat at fixed lon); arc-length north element = dlat
  for (const lon of lons) {
    const latLo = -1.45, latHi = 1.45, dLat = (latHi - latLo) / NS;
    let prev = sample(latLo, lon);
    for (let i = 1; i <= NS; i++) {
      const cur = sample(latLo + i * dLat, lon);
      sumN += Math.abs(cur - prev) / dLat; cntN++; prev = cur;
    }
  }
  const gradE = sumE / Math.max(cntE, 1), gradN = sumN / Math.max(cntN, 1);
  return {
    ratio: gradN / Math.max(gradE, 1e-12),
    peakDLat, peakDBand,
    peakDLatBandWidths: peakDLat / bandWidth,
  };
}

/**
 * AC-JAG belt-CENTER vs zone-CENTER roughness split (BUILD-PLAN §4.4). Both centers sit at jetProfile
 * extrema where wShear≈0, so the split is driven by cyc (belt/zone sign), NOT a boundary-vs-center
 * tautology. Finds the min-wBand latitude (belt center, cyc≈1) and max-wBand latitude (zone center,
 * cyc≈0) over a fine sweep, evaluates bandRoughness at each.
 * @returns {{ratio, beltRough, zoneRough, beltLat, zoneLat, beltShear, zoneShear, uBandRough}}
 */
export function bandRoughnessCenters(P, opts = {}) {
  const uBandRough = opts.uBandRough != null ? opts.uBandRough : BAND_FLOW.ROUGH_MEAN;
  const NS = opts.steps || 2001;
  const sp = jetShearPeak(P) || 1;
  let beltLat = 0, zoneLat = 0, minB = Infinity, maxB = -Infinity;
  for (let i = 0; i < NS; i++) {
    const lat = (-0.5 + i / (NS - 1)) * Math.PI * 0.94;   // avoid the exact poles
    const b = bandProxy(lat, P);
    if (b < minB) { minB = b; beltLat = lat; }
    if (b > maxB) { maxB = b; zoneLat = lat; }
  }
  const beltShear = clamp01(Math.abs(jetShear(beltLat, P)) / sp);
  const zoneShear = clamp01(Math.abs(jetShear(zoneLat, P)) / sp);
  const beltRough = bandRoughness(bandProxy(beltLat, P), beltShear, uBandRough);
  const zoneRough = bandRoughness(bandProxy(zoneLat, P), zoneShear, uBandRough);
  return {
    ratio: beltRough / Math.max(zoneRough, 1e-9),
    beltRough, zoneRough, beltLat, zoneLat, beltShear, zoneShear, uBandRough,
  };
}

/**
 * stormBandDrag downstream reach profile (BUILD-PLAN §2.1 / §6.0). A point at great-circle angle θ
 * downstream of the vortex has downstream coordinate ds = sin(θ) (the projection stormBandDrag reads), so
 * ds/R — the plan's "reach in R multiples" — caps at 1/R (~4–5.5 for the primary) on the sphere. This
 * sweeps ds/R and reports the near-storm BOW peak (small meridional offset) + the max ds/R where the wake
 * |dLat| still exceeds `thresh`. Used to pin WAKE_LEN/WID/BOW/AMP so the reach clears the old 2.6R GRS
 * cone and the Jovian bow peak ≥ a band-width fraction (perceptual floor). `dsAt(x)` builds a point at
 * downstream ds/R = x (lateral dn=0) for the AC-INTERACT/wake-sanity assertion.
 * @returns {{bowPeak, bowPeakBandWidths, reachDsR, dsMax, dsAt, profile:[{dsR,dLat}...]}}
 */
export function wakeReachProfile(vortex, P, opts = {}) {
  const ink = opts.ink != null ? opts.ink : BAND_FLOW_DEFAULTS.uAtmoInk;
  const thresh = opts.thresh != null ? opts.thresh : 0.002;   // ~sub-perceptual floor in rad
  const c = vortex.center, R = Math.max(vortex.radius || 0.1, 1e-4);
  const bandWidth = Math.PI / Math.max(P.m, 1);
  // local frame at the vortex
  let ex0 = c[2], ex1 = 0, ex2 = -c[0];
  const exLen = Math.max(Math.hypot(ex0, ex1, ex2), 1e-4); ex0 /= exLen; ex1 /= exLen; ex2 /= exLen;
  const north0 = c[1] * ex2 - c[2] * ex1, north1 = c[2] * ex0 - c[0] * ex2, north2 = c[0] * ex1 - c[1] * ex0;
  const latC = Math.asin(clamp(-1, 1, c[1]));
  const flow = Math.sign(bandProxy(latC, P) - 0.5) || 1;
  const dsHat = [flow * ex0, flow * ex1, flow * ex2];   // downstream unit tangent = flow·east
  // point at downstream coordinate ds/R = x (ds = x·R = sin θ), lateral dn=0
  const dsMax = 1 / R;                                  // sphere cap on ds/R
  const dsAt = (x) => {
    const ds = Math.min(x * R, 1);                       // ds = sin θ ≤ 1
    const th = Math.asin(ds), ct = Math.cos(th), st = Math.sin(th);
    return [c[0] * ct + dsHat[0] * st, c[1] * ct + dsHat[1] * st, c[2] * ct + dsHat[2] * st];
  };
  // bow peak: small meridional offset near the core
  let bowPeak = 0;
  for (const off of [0.1, 0.25, 0.4, 0.6, 0.9]) {
    const th = off * R;
    const p = [c[0] + north0 * Math.sin(th), c[1] + north1 * Math.sin(th), c[2] + north2 * Math.sin(th)];
    const pl = Math.hypot(p[0], p[1], p[2]) || 1;
    const dl = Math.abs(stormBandDrag([p[0] / pl, p[1] / pl, p[2] / pl], [vortex], P, { ink }));
    if (dl > bowPeak) bowPeak = dl;
  }
  const profile = [];
  let reachDsR = 0;
  const STEP = opts.step || 0.1;
  for (let x = STEP; x <= dsMax - 1e-9; x += STEP) {
    const dl = Math.abs(stormBandDrag(dsAt(x), [vortex], P, { ink }));
    profile.push({ dsR: x, dLat: dl });
    if (x > 0.3 && dl >= thresh) reachDsR = x;   // last ds/R (past the near-core) where the wake still reads
  }
  return { bowPeak, bowPeakBandWidths: bowPeak / bandWidth, reachDsR, dsMax, dsAt, profile };
}

// ─────────────────────────────────────────────────────────────────────────────
// dSPIRAL (slice S4) — the STATIC log-spiral roll-up mirror + its estimators. Numeric truth for the GLSL
// dSpiralVec (planet-lod-height.glsl.js), the dWake sibling. vitest has no GPU, so this is the faithful
// CPU transcription; the GLSL carries the SAME BAND_SPIRAL constants (the constant-parity pattern).
// ─────────────────────────────────────────────────────────────────────────────

// spiralDisplacement(dir, vortices, P, {ink}) — the tangential displacement summed over vortices, returned
// as the [dE, dN] components in EACH vortex's own (east, north) tangent frame (the GLSL sums the world
// vectors east·dE + north·dN). For a SINGLE vortex — the case every direction-based prop uses — [dE, dN]
// is exact; the magnitude equals `amp` (the unit (−sinψ, cosψ) rotor × |sign(rot)|). Zero/empty vortices
// ⇒ [0, 0] (the count-gate / AC-OFFGATE). ψ = thv + W·log(rr+EPS), W = WRAP·ageScalar·sign(rot); a KH
// scallop `scal` (NB lobes, crest leaning downstream WITH rr at rate LEAN·flow — F15) modulates the
// magnitude on the annulus. STATIC: pure function of dir + the vortex records + P (no uTime, no rng).
export function spiralDisplacement(dir, vortices, P, opts = {}) {
  const ink = opts.ink != null ? opts.ink : BAND_FLOW_DEFAULTS.uAtmoInk;
  if (!vortices || vortices.length === 0) return [0, 0];
  let accE = 0, accN = 0;
  const n = Math.min(vortices.length, 8);
  for (let i = 0; i < n; i++) {
    const v = vortices[i];
    const c = v.center;
    const R = Math.max(v.radius || 0.1, 1e-4);
    const aspect = v.aspect || 1;
    const rot = v.rot || 1, s = Math.sign(rot) || 1;
    const age = v.ageScalar != null ? v.ageScalar : (v.age != null ? v.age : 0);
    const billowPhase = v.billowPhase || 0;
    // storm tangent frame (the SAME east/north dWake/stormColTerms/dSpiralVec build): east = normalize(cross(up, c))
    let ex0 = c[2], ex1 = 0, ex2 = -c[0];
    const exLen = Math.max(Math.hypot(ex0, ex1, ex2), 1e-4); ex0 /= exLen; ex1 /= exLen; ex2 /= exLen;
    const north0 = c[1] * ex2 - c[2] * ex1, north1 = c[2] * ex0 - c[0] * ex2, north2 = c[0] * ex1 - c[1] * ex0;
    const de = dir[0] * ex0 + dir[1] * ex1 + dir[2] * ex2;
    const dn = dir[0] * north0 + dir[1] * north1 + dir[2] * north2;
    const facing = (dir[0] * c[0] + dir[1] * c[1] + dir[2] * c[2]) >= 0 ? 1 : 0;
    const rr = Math.hypot(de / aspect, dn) / R;
    const thv = Math.atan2(dn, de);
    const W = BAND_SPIRAL.WRAP * age * s;                                  // wrap ∝ ageScalar·sign(rot)
    const psi = thv + W * Math.log(rr + BAND_SPIRAL.EPS);
    const ann = smoothstep(BAND_SPIRAL.ANN_IN, BAND_SPIRAL.ANN_PEAK, rr)
              * (1 - smoothstep(BAND_SPIRAL.ANN_OUT_LO, BAND_SPIRAL.ANN_OUT_HI, rr));
    const latS = Math.asin(clamp(-1, 1, c[1]));
    const flow = Math.sign(bandProxy(latS, P) - 0.5) || 1;                 // downstream sign (the dWake idiom)
    const scal = 1 + BAND_SPIRAL.SCAL
      * Math.sin(SPIRAL_NB * (thv - flow * BAND_SPIRAL.LEAN * (rr - BAND_SPIRAL.ANN_PEAK)) + billowPhase);
    const amp = ink * BAND_SPIRAL.AMP * R * ann * scal * facing;
    accE += (-Math.sin(psi)) * amp * s;
    accN += (Math.cos(psi)) * amp * s;
  }
  return [accE, accN];
}

// spiralWrapProfile(vortex, P, opts) — SINGLE-source estimator for the S4 props (the wakeReachProfile
// pattern, so the unit test + calibrate tool measure the SAME quantity). Builds the vortex frame once and
// offers: dirAt(rr, thv) — an EXACT unit dir at storm-frame (rr, thv) via the orthonormal (c, east, north)
// basis; dispAt/magAt — the displacement + its magnitude there; psiAt — the spiral phase ψ RECOVERED from
// the displacement DIRECTION (ψ = atan2(−dE·s, dN·s)); wrapVisibleOver(rr1,rr2) = |W·Δln(rr+EPS)|/2π (the
// ON-SCREEN turn count the live radial read counts — F9, NOT the vacuous ring cycle); crestShift(rrFrom,
// rrTo) — the continuously-TRACKED azimuthal shift of ONE lobe crest between two radii (unaliased: 42
// lobes leaning 0.33 rad aliases any per-lobe read, so a single crest is followed in small rr steps).
export function spiralWrapProfile(vortex, P, opts = {}) {
  const ink = opts.ink != null ? opts.ink : BAND_FLOW_DEFAULTS.uAtmoInk;
  const c = vortex.center, R = Math.max(vortex.radius || 0.1, 1e-4);
  const aspect = vortex.aspect || 1, rot = vortex.rot || 1, s = Math.sign(rot) || 1;
  const age = vortex.ageScalar != null ? vortex.ageScalar : (vortex.age != null ? vortex.age : 0);
  let ex0 = c[2], ex1 = 0, ex2 = -c[0];
  const exLen = Math.max(Math.hypot(ex0, ex1, ex2), 1e-4); ex0 /= exLen; ex1 /= exLen; ex2 /= exLen;
  const n0 = c[1] * ex2 - c[2] * ex1, n1 = c[2] * ex0 - c[0] * ex2, n2 = c[0] * ex1 - c[1] * ex0;
  const latS = Math.asin(clamp(-1, 1, c[1]));
  const flow = Math.sign(bandProxy(latS, P) - 0.5) || 1;
  const W = BAND_SPIRAL.WRAP * age * s;
  // exact (rr, thv) → unit dir: de = rr·R·aspect·cos(thv), dn = rr·R·sin(thv) ⇒ rr/thv recovered exactly at
  // aspect=1 (thv distorts by aspect but is rr-INDEPENDENT, so it cancels in every Δ over radii).
  const dirAt = (rr, thv) => {
    const de = rr * R * aspect * Math.cos(thv), dn = rr * R * Math.sin(thv);
    const al = Math.sqrt(Math.max(0, 1 - de * de - dn * dn));
    return [al * c[0] + de * ex0 + dn * n0, al * c[1] + de * ex1 + dn * n1, al * c[2] + de * ex2 + dn * n2];
  };
  const dispAt = (rr, thv) => spiralDisplacement(dirAt(rr, thv), [vortex], P, { ink });
  const magAt = (rr, thv) => { const [dE, dN] = dispAt(rr, thv); return Math.hypot(dE, dN); };
  const psiAt = (rr, thv) => { const [dE, dN] = dispAt(rr, thv); return Math.atan2(-dE * s, dN * s); };
  const dLn = (rr1, rr2) => Math.log(rr2 + BAND_SPIRAL.EPS) - Math.log(rr1 + BAND_SPIRAL.EPS);
  // continuous single-crest tracking (unaliased): find one crest near thv=0 at rrFrom, follow it in ±half-
  // lobe windows across small rr steps, return the accumulated azimuthal shift (≈ flow·LEAN·(rrTo−rrFrom)).
  const period = (2 * Math.PI) / SPIRAL_NB;
  const argmax = (rr, a, b, K = 129) => {
    let best = -Infinity, bestT = a;
    for (let k = 0; k <= K; k++) { const t = a + (b - a) * (k / K); const m = magAt(rr, t); if (m > best) { best = m; bestT = t; } }
    return bestT;
  };
  const crestShift = (rrFrom, rrTo, step = 0.05) => {
    let thvC = argmax(rrFrom, 0, period);            // the first crest in [0, one period)
    const thv0 = thvC;
    for (let rr = rrFrom + step; rr <= rrTo + 1e-9; rr += step) thvC = argmax(rr, thvC - period / 2, thvC + period / 2);
    return thvC - thv0;
  };
  return {
    dirAt, dispAt, magAt, psiAt, crestShift, W, flow, R,
    wrapVisibleOver: (rr1, rr2) => Math.abs(W * dLn(rr1, rr2)) / (2 * Math.PI),
    deltaPsiPredicted: (rr1, rr2) => W * dLn(rr1, rr2),
  };
}

// spiralMeridional(dir, vortices, P, {ink}) — the GLSL channel-(a) meridional deflection
// Δlat = asin(NrawD.y) − asin(dir.y), NrawD = normalize(dir + dSp_world). East has ZERO y-component
// (east = normalize(c.z, 0, −c.x)), so only the NORTH component of the spiral displacement reaches
// latitude. This is exactly the term the GLSL folds into dLat; single-sources the dWake+dSpiral
// superposition-envelope analysis (F17) so the calibrate tool measures the shipped quantity.
export function spiralMeridional(dir, vortices, P, opts = {}) {
  const ink = opts.ink != null ? opts.ink : BAND_FLOW_DEFAULTS.uAtmoInk;
  if (!vortices || vortices.length === 0) return 0;
  let wx = 0, wy = 0, wz = 0;
  const n = Math.min(vortices.length, 8);
  for (let i = 0; i < n; i++) {
    const [dE, dN] = spiralDisplacement(dir, [vortices[i]], P, { ink });
    const c = vortices[i].center;
    let ex0 = c[2], ex1 = 0, ex2 = -c[0];
    const exLen = Math.max(Math.hypot(ex0, ex1, ex2), 1e-4); ex0 /= exLen; ex1 /= exLen; ex2 /= exLen;
    const north0 = c[1] * ex2 - c[2] * ex1, north1 = c[2] * ex0 - c[0] * ex2, north2 = c[0] * ex1 - c[1] * ex0;
    wx += ex0 * dE + north0 * dN; wy += ex1 * dE + north1 * dN; wz += ex2 * dE + north2 * dN;
  }
  const nd = Math.hypot(dir[0] + wx, dir[1] + wy, dir[2] + wz) || 1;
  return Math.asin(clamp(-1, 1, (dir[1] + wy) / nd)) - Math.asin(clamp(-1, 1, dir[1]));
}
