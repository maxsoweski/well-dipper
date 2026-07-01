// src/worldengine/base/climate-e5.js
// ─────────────────────────────────────────────────────────────────────────────
// E5 ATMOSPHERE / CLIMATE — SIGNED, DRIVER-ORGANIZED, PER-SEED ZONAL BAND/JET FIELD
// (World-Engine production-L1, increment 3a)
//
// WHAT THIS BUILDS (plain language). A generative gas-giant atmosphere as DATA over the sphere: a
// signed zonal wind field u(lat) (the "master field") plus two depth channels (shear-gated filament
// texture + NH₃ "mushball" compositional banding) and the Ward annual-mean insolation field W(lat,ε).
// Every field is a closed-form END-STATE (a function of latitude + per-body driver scalars + seed) —
// never a time-stepped simulation. Four archetypes fall out of ONE machine driven by ~7 scalars:
//   Jovian (gas-giant) · Saturnian · Neptunian (ice-giant) · hazy sub-Neptune.
//
// WHY IT REPLACES THE LIFT. #3a-pre shipped a FAITHFUL but UNSIGNED, SEED-INDEPENDENT, DRIVER-BLIND
// port of the old GLSL `Σ a·sin(y·k)` band sum (kept below as LEGACY, for shader-parity docs). That
// could not express the physics the contract demands: a SIGNED equatorial jet whose direction is
// decided by drivers (prograde Jovian/Saturnian vs retrograde Neptunian), a Rhines band COUNT that
// tracks rotation, the amplitude law that makes Neptune's winds the FASTEST despite the LEAST
// sunlight (the "wind paradox"), the Ward >54.7° hot-poles inversion (the Uranus tell), and per-seed
// variety. This module is that signed, driver-organized, per-seed writer.
//
// FIVE PHYSICS LAWS (all independently adversarially re-derived before implementation; see the
// worldstream research catalog atmosphere-phenomena-giants.md §2 for provenance):
//   LAW 1 Rhines band count   N ∝ √(a·Ω / U)         — faster/larger → more, narrower jets.
//   LAW 2 equatorial jet sign s_eq = tanh(K·(D/a − D_thr)) — deep shell → prograde, thin → retrograde.
//   LAW 3 amplitude law       U = C·√(F_int/diss)·(1+κ(1−D/a)) — insolation is DELIBERATELY absent
//                             (that IS the paradox): Neptune wins on convective vigor × low dissipation.
//   LAW 4 Ward insolation     s2(ε)=(5/16)(3sin²ε−2), W=1+s2·P2(sinφ); s2 flips sign at ε=54.7° → hot poles.
//   LAW 5 depth layers        turbulence = |du/dφ|·filament (shear-gated); mushball = own NH₃ banding.
// COMPUTE ORDER IS LOAD-BEARING: LAW 3 (U_peak) → LAW 1 (wavenumber m). One-directional; m never
// feeds back into U_peak. The Rhines characteristic velocity is U_peak (pre-A-scaling); the ~A_eq gap
// is absorbed into the calibrated RHINES_K (a single global calibration constant, not per-regime fit).
//
// GAS GIANTS HAVE NO RELIEF, EVER: this writer NEVER writes carrier.height (or any relief channel). It
// RETURNS fields + diagnostics; the render/bake seam decides expression (increment-3a shader rewire).
//
// THREE-FREE BY CONSTRUCTION: imports only alea + simplex-noise + the pure scalar helpers in
// mathutil.js (plates.js discipline). It NEVER imports three.
//
// DETERMINISM HARD-RULE: no Math.random / Date.now anywhere. Every random draw is alea seeded off the
// integer macroSeed in a DISJOINT namespace (`climateE5:*`, disjoint from `plates:*`/`shell:*`). Same
// (regime, macroSeed, drivers) ⇒ byte-identical fields; two different seeds ⇒ per-seed DISTINCT fields
// (band phase / amplitude / obliquity jitter), each still byte-deterministic for its own seed.
// ─────────────────────────────────────────────────────────────────────────────
import alea from 'alea';
import { createNoise3D } from 'simplex-noise';
import { clamp, clamp01 } from './mathutil.js';

// ── Archetypes ───────────────────────────────────────────────────────────────
export const E5_REGIME = Object.freeze({
  GAS_GIANT: 'gas-giant',     // Jovian
  SATURNIAN: 'saturnian',     // Saturn (deep shell, prograde, cooler)
  NEPTUNIAN: 'neptunian',     // ice giant (thin shell, RETROGRADE eq jet, wind paradox)
  SUB_NEPTUNE: 'sub-neptune', // hazy sub-Neptune (muted band contrast via haze mute)
  HOT_JUPITER: 'hot-jupiter', // legacy banded regime (emission register deferred to a later increment)
});

// ── Canonical per-body driver bundles (dimensionless; Jupiter-normalized where marked). These are
//    the DEFAULTS the writer uses when the caller passes no (or partial) drivers. Sourced from
//    atmosphere-phenomena-giants.md §0. The lab overrides rotationRate/radius/energyInput/obliquity
//    from its presets; internalHeat/dissipation/shellDepthFrac carry the archetype character. ──
export const DRIVER_BUNDLES = Object.freeze({
  [E5_REGIME.GAS_GIANT]:   Object.freeze({ rotationRate: 1.00, radius: 1.00,  energyInput: 1.0000, internalHeat: 1.67, dissipation: 1.00, shellDepthFrac: 0.80, obliquityDeg: 3.1,  hazeMute: 0.0 }),
  [E5_REGIME.SATURNIAN]:   Object.freeze({ rotationRate: 0.931, radius: 0.843, energyInput: 0.2930, internalHeat: 1.78, dissipation: 0.85, shellDepthFrac: 0.90, obliquityDeg: 26.7, hazeMute: 0.0 }),
  [E5_REGIME.NEPTUNIAN]:   Object.freeze({ rotationRate: 0.616, radius: 0.346, energyInput: 0.0297, internalHeat: 2.60, dissipation: 0.15, shellDepthFrac: 0.15, obliquityDeg: 28.3, hazeMute: 0.1 }),
  [E5_REGIME.SUB_NEPTUNE]: Object.freeze({ rotationRate: 0.550, radius: 0.220, energyInput: 0.4500, internalHeat: 1.15, dissipation: 0.55, shellDepthFrac: 0.35, obliquityDeg: 20.0, hazeMute: 0.7 }),
  [E5_REGIME.HOT_JUPITER]: Object.freeze({ rotationRate: 0.124, radius: 1.160, energyInput: 4.0000, internalHeat: 2.00, dissipation: 1.20, shellDepthFrac: 0.85, obliquityDeg: 5.0,  hazeMute: 0.0 }),
});

// ── Physics constants (the closed-form law coefficients; see the five-law block in the header) ──
export const PHYS = Object.freeze({
  D_THR: 0.40,        // LAW2 shell-depth threshold: above ⇒ prograde eq jet, below ⇒ retrograde
  K_SIGN: 6.0,        // LAW2 tanh steepness of the sign switch
  C_U: 1.0,           // LAW3 amplitude scale
  KAPPA: 1.0,         // LAW3 thin-shell momentum-concentration gain
  RHINES_K: 15.2,     // LAW1 calibrated band-count constant (= C_N/π); jovian→~12 bands, neptunian→~3
  WARD_GAIN: 0.8,     // LAW4 how strongly Ward insolation reshapes the band envelope
  ENV_BASE: 1.0,      // band-envelope baseline
  A_EQ: 0.6,          // equatorial-jet amplitude fraction
  A_MID: 0.5,         // mid-latitude alternating-jet amplitude fraction
  PHI_EQ: 0.35,       // equatorial-jet Gaussian half-width (rad ≈ 20°)
  M_MIN: 2,           // wavenumber floor (at least one alternation per hemisphere)
  MUSH_M0: 0.50,      // mushball NH₃ field midpoint
  MUSH_AMP: 0.35,     // mushball NH₃ banding amplitude
  FILAMENT_LO: 0.40,  // filament texture range [LO,HI] — LO>0 keeps corr(|turb|,|shear|) robust (LAW5)
  FILAMENT_HI: 1.00,
  FILAMENT_FREQ: 9.0, // high-freq filament so a single seed's sampled corr can't dip below 0.5
  HAZE_CONTRAST: 0.9, // fraction of band contrast a fully-hazy world loses
});

const DEG2RAD = Math.PI / 180;

// ── LAW 4: Ward annual-mean insolation ───────────────────────────────────────
// s2(ε) = (5/16)(3 sin²ε − 2). Zero at sin²ε = 2/3 ⇒ ε = asin√(2/3) = 54.7356°. s2<0 below (cold
// poles / warm equator), s2>0 above (HOT POLES — the >54° inversion, the Uranus tell). Earth (23.44°)
// ⇒ s2 = −0.477 (literature ≈ −0.48). NB this is the idealized annual-mean INSOLATION inversion (real
// physics); it does NOT claim a body's actual TEMPERATURE inverts (research §3 warns real Uranus is a
// near-uniform-T puzzle) — we model the radiative driver, downstream dynamics are a separate concern.
export function wardS2(obliquityDeg) {
  const s = Math.sin(obliquityDeg * DEG2RAD);
  return (5 / 16) * (3 * s * s - 2);
}
const p2 = (u) => 0.5 * (3 * u * u - 1);                  // Legendre P2
// W(φ,ε) as a signed anomaly about the global mean (mean of P2 over sinφ ~ 0), 1 + s2·P2(sinφ).
export function wardInsolation(sinLat, obliquityDeg) {
  return 1 + wardS2(obliquityDeg) * p2(clamp(-1, 1, sinLat));
}

// ── LAW 2: equatorial jet sign (continuous, driver-decided — NOT a per-regime constant) ──
export function equatorialJetSign(shellDepthFrac) {
  return Math.tanh(PHYS.K_SIGN * (shellDepthFrac - PHYS.D_THR));
}

// ── LAW 3: amplitude law (Neptune wind paradox — insolation is deliberately absent) ──
export function amplitudeLaw(internalHeat, dissipation, shellDepthFrac) {
  const shellConcentration = 1 + PHYS.KAPPA * (1 - shellDepthFrac);
  return PHYS.C_U * Math.sqrt(internalHeat / dissipation) * shellConcentration;
}

// ── LAW 1: Rhines wavenumber (jet/band count from rotation) ───────────────────
// β = 2Ω/a, L_β = π√(2U/β), N = C_N·a/L_β = RHINES_K·√(a·Ω/U). Floored at M_MIN.
export function rhinesWavenumber(rotationRate, radius, uPeak) {
  const n = PHYS.RHINES_K * Math.sqrt((radius * rotationRate) / uPeak);
  return Math.max(PHYS.M_MIN, Math.round(n));
}

// envMax over the config: env(φ)=ENV_BASE+WARD_GAIN·s2·P2(sinφ), P2∈[−0.5,1]. s2>0 ⇒ max at pole
// (P2=1); s2<0 ⇒ max at equator (P2=−0.5). Used to normalize bandNorm WITHOUT clipping the hot-poles
// feature (the fix for the "render clips exactly where AC7/AC12 want to show the inversion" bug).
function envMaxOf(s2) {
  return PHYS.ENV_BASE + PHYS.WARD_GAIN * (s2 > 0 ? s2 : -0.5 * s2);
}

/**
 * Resolve every per-seed / per-body scalar the closed-form profile needs. Pure given (regime, drivers,
 * macroSeed). The returned `params` is the COMPLETE closed-form parameter set — the AC3 arm's-length
 * re-derivation rebuilds u(lat) from this alone (so the writer's field is provably a pure function of
 * latitude + these scalars).
 */
export function resolveParams(regime = E5_REGIME.GAS_GIANT, drivers = {}, macroSeed = 0) {
  const base = DRIVER_BUNDLES[regime] || DRIVER_BUNDLES[E5_REGIME.GAS_GIANT];
  const d = { ...base, ...drivers };                     // caller drivers override the archetype defaults
  const seed = macroSeed | 0;
  const rng = alea('climateE5:params:' + regime + ':' + seed);

  // per-seed jitter (fixed draw order → byte-deterministic). Small, so the archetype stays recognizable.
  const phaseJet = rng() * 2 * Math.PI;
  const phaseMush = rng() * 2 * Math.PI;
  const ampJitter = 1 + (rng() - 0.5) * 0.20;            // ±10% on the mid-jet amplitude
  const obliquityDeg = d.obliquityDeg + (rng() - 0.5) * 4.0;  // ±2° seasonal jitter

  const uPeak = amplitudeLaw(d.internalHeat, d.dissipation, d.shellDepthFrac);   // LAW 3 FIRST
  const m = rhinesWavenumber(d.rotationRate, d.radius, uPeak);                   // LAW 1 (reads uPeak)
  const sEq = equatorialJetSign(d.shellDepthFrac);                              // LAW 2
  const s2 = wardS2(obliquityDeg);                                              // LAW 4
  const mMush = Math.max(3, Math.round(m * 0.5));        // NH₃ banding wavenumber (distinct from jets)
  const contrast = 1 - d.hazeMute * PHYS.HAZE_CONTRAST;  // haze mutes band contrast (sub-Neptune)
  const aMid = PHYS.A_MID * ampJitter;
  const envMax = envMaxOf(s2);
  const normDenom = uPeak * (PHYS.A_EQ + aMid * envMax); // fix: envMax, not (A_eq+A_mid) → no hot-pole clip

  return {
    regime, drivers: d, macroSeed: seed,
    uPeak, m, sEq, s2, mMush, contrast, aMid, obliquityDeg,
    phaseJet, phaseMush, envMax, normDenom,
    aEq: PHYS.A_EQ, phiEq: PHYS.PHI_EQ, envBase: PHYS.ENV_BASE, wardGain: PHYS.WARD_GAIN,
  };
}

// ── The signed zonal jet profile u(φ) — pure function of latitude + resolved params ──
// φ in radians. eqGauss owns the tropics (sign = s_eq), eqEnv=1−eqGauss suppresses the alternating
// mid-jets there so sign(u(0)) === sign(s_eq) robustly (eqEnv(0)=0). env(φ) is the Ward band envelope.
function envAt(sinLat, P) { return P.envBase + P.wardGain * P.s2 * p2(sinLat); }

export function jetProfile(lat, P) {
  const s = Math.sin(lat);                               // sinφ
  const g = Math.exp(-(lat / P.phiEq) * (lat / P.phiEq));// equatorial Gaussian
  const eqEnv = 1 - g;
  const env = envAt(s, P);
  const mid = Math.sin(P.m * lat + P.phaseJet) * eqEnv * env;
  return P.uPeak * (P.sEq * P.aEq * g + P.aMid * mid);
}

// Analytic meridional shear du/dφ (used BOTH by the writer's turbulence gate AND the AC8 correlation
// test, so they are perfectly consistent and turbulence is exactly 0 where shear is 0).
export function jetShear(lat, P) {
  const s = Math.sin(lat), c = Math.cos(lat);
  const q = lat / P.phiEq;
  const g = Math.exp(-q * q);
  const gp = -2 * lat / (P.phiEq * P.phiEq) * g;         // dG/dφ
  const eqEnv = 1 - g, eqEnvP = -gp;                     // E=1−G, E'=−G'
  const env = envAt(s, P);
  const envP = P.wardGain * P.s2 * 3 * s * c;            // dV/dφ = wardGain·s2·3 sinφ cosφ
  const S = Math.sin(P.m * lat + P.phaseJet);
  const Sp = P.m * Math.cos(P.m * lat + P.phaseJet);
  const midP = Sp * eqEnv * env + S * eqEnvP * env + S * eqEnv * envP;
  return P.uPeak * (P.sEq * P.aEq * gp + P.aMid * midP);
}

// ── LAW 5: NH₃ "mushball" compositional banding — its own latitude-banded channel (not folded into u) ──
export function mushballProfile(lat, P) {
  return PHYS.MUSH_M0 + PHYS.MUSH_AMP * Math.sin(P.mMush * lat + P.phaseMush);
}

// Sample the signed profile to report structural diagnostics (band/jet counts, peak amplitude, peak
// shear). bandCount = zero-crossings of u (# belt/zone alternations). jetCount = extrema of u
// (# jet cores = sign-changes of du/dφ). shearPeak → the AC2 turbulence upper bound (T_max=shearPeak).
function sampleDiagnostics(P, samples = 721) {
  const n = Math.max(9, samples | 0);
  let prevU = 0, prevD = 0, prevDir = 0;
  let bandCount = 0, jetCount = 0, maxAbs = 0, shearPeak = 0;
  for (let i = 0; i < n; i++) {
    const lat = (-0.5 + i / (n - 1)) * Math.PI;          // −π/2 → π/2
    const u = jetProfile(lat, P);
    const sh = Math.abs(jetShear(lat, P));
    if (Math.abs(u) > maxAbs) maxAbs = Math.abs(u);
    if (sh > shearPeak) shearPeak = sh;
    if (i > 0) {
      if ((u < 0) !== (prevU < 0)) bandCount++;           // zero crossing of u
      const d = u - prevU;
      const dir = d > 0 ? 1 : d < 0 ? -1 : 0;
      if (dir !== 0 && prevDir !== 0 && dir !== prevDir) jetCount++;
      if (dir !== 0) prevDir = dir;
      prevD = d;
    }
    prevU = u;
  }
  void prevD;
  return { bandCount, jetCount, maxAbs, shearPeak };
}

/**
 * E5 signed zonal band/jet writer. Evaluates the closed-form fields per carrier node and RETURNS them
 * + diagnostics. It does NOT mutate any carrier relief channel (gas giants have no relief — AC9).
 *
 * @param {object} carrier  F3 sphere carrier (makeSphereField output): needs verts (unit dirs) + N.
 * @param {object} drivers  E6 driver bundle; overrides the archetype defaults (rotationRate, radius,
 *                          energyInput, internalHeat, dissipation, shellDepthFrac, obliquityDeg, hazeMute).
 * @param {object} opts     { regime, macroSeed }.
 * @returns flat object:
 *   FIELDS (Float32Array per node):
 *     bandField  signed jet field u(lat) — the master field AND the render advection channel (sign =
 *                flow direction, magnitude = scroll speed for the "churning belts, not static" seam).
 *     bandNorm   [0,1] render value = clamp01(0.5 + 0.5·contrast·u/normDenom); haze-muted, envMax-safe.
 *     turbulence shear-gated filament texture |du/dφ|·filament ∈ [0, shearPeak] (0 at zero shear).
 *     mushball   NH₃ compositional banding ∈ [M0−AMP, M0+AMP], banded in latitude, distinct channel.
 *     W          Ward annual-mean insolation W(lat,ε) (substrate for #2/#3b/#5..#9 + AC7/AC12 render).
 *     shearMag   |du/dφ| per node (the turbulence gate; also a render gate).
 *   DIAGNOSTICS (scalars): regime, bandCount, jetCount, peakU, eqSign, sEq, wardS2, envMax, phaseJet,
 *     phaseMush, maxAbs, shearPeak, turbBound, params (full closed-form param set for AC3 re-derivation).
 */
export function writeClimateE5Sphere(carrier, drivers = {}, { regime = E5_REGIME.GAS_GIANT, macroSeed = 0 } = {}) {
  const P = resolveParams(regime, drivers, macroSeed);
  const N = carrier.N;
  const verts = carrier.verts;

  const bandField = new Float32Array(N);
  const bandNorm = new Float32Array(N);
  const turbulence = new Float32Array(N);
  const mushball = new Float32Array(N);
  const W = new Float32Array(N);
  const shearMag = new Float32Array(N);

  // high-freq, per-seed 3D filament noise (position-dependent — this is the ONLY longitude-dependent
  // channel; the band/jet field u stays purely zonal so it passes the AC3 zonality bar).
  const filamentNoise = createNoise3D(alea('climateE5:filament:' + regime + ':' + (macroSeed | 0)));

  let nodeMaxShear = 0;                                   // exact per-node shear peak → tight turbulence bound
  for (let i = 0; i < N; i++) {
    const v = verts[i];
    const y = clamp(-1, 1, v[1]);                        // sin(lat) on the unit-dir carrier
    const lat = Math.asin(y);
    const u = jetProfile(lat, P);
    const sh = jetShear(lat, P);
    if (Math.abs(sh) > nodeMaxShear) nodeMaxShear = Math.abs(sh);
    // filament ∈ [FILAMENT_LO, FILAMENT_HI]; mean well above 0 keeps corr(|turbulence|,|shear|) robust.
    const nz = filamentNoise(v[0] * PHYS.FILAMENT_FREQ, v[1] * PHYS.FILAMENT_FREQ, v[2] * PHYS.FILAMENT_FREQ);
    const filament = PHYS.FILAMENT_LO + (PHYS.FILAMENT_HI - PHYS.FILAMENT_LO) * clamp01(0.5 + 0.5 * nz);

    bandField[i] = u;
    bandNorm[i] = clamp01(0.5 + 0.5 * P.contrast * (u / P.normDenom));
    shearMag[i] = Math.abs(sh);
    turbulence[i] = Math.abs(sh) * filament;             // shear-gated (0 where shear is 0)
    mushball[i] = mushballProfile(lat, P);
    W[i] = wardInsolation(y, P.obliquityDeg);
  }

  const diag = sampleDiagnostics(P);
  const eqSign = Math.sign(jetProfile(0, P)) || Math.sign(P.sEq);

  return {
    bandField, bandNorm, turbulence, mushball, W, shearMag,
    regime,
    bandCount: diag.bandCount,
    jetCount: diag.jetCount,
    peakU: P.uPeak,
    eqSign,
    sEq: P.sEq,
    wardS2: P.s2,
    envMax: P.envMax,
    phaseJet: P.phaseJet,
    phaseMush: P.phaseMush,
    maxAbs: diag.maxAbs,
    shearPeak: nodeMaxShear,
    turbBound: nodeMaxShear * PHYS.FILAMENT_HI,          // AC2 documented turbulence upper bound (tight)
    params: P,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// LEGACY — the faithful UNSIGNED shader-parity port (the #3a-pre "lift"). Kept for documentation of
// the original Planet.js GAS_BODY `bands` harmonic sum and any consumer wanting the literal old look.
// NOT used by writeClimateE5Sphere (which is the signed driver-organized model above).
// ─────────────────────────────────────────────────────────────────────────────
export const HARMONICS = Object.freeze({
  [E5_REGIME.GAS_GIANT]:   Object.freeze([{ f: 3.5, a: 0.5, p: 0.0 }, { f: 7.0, a: 0.3, p: 0.5 }, { f: 13.0, a: 0.12, p: 0.0 }]),
  [E5_REGIME.HOT_JUPITER]: Object.freeze([{ f: 2.5, a: 0.3, p: 0.0 }, { f: 5.0, a: 0.15, p: 0.0 }]),
  [E5_REGIME.SUB_NEPTUNE]: Object.freeze([{ f: 3.0, a: 0.1, p: 0.0 }, { f: 6.0, a: 0.05, p: 0.0 }]),
});
export const BAND_BOUND = Object.freeze({
  [E5_REGIME.GAS_GIANT]: 0.92, [E5_REGIME.HOT_JUPITER]: 0.45, [E5_REGIME.SUB_NEPTUNE]: 0.15,
});
export const DEFAULTS = Object.freeze({ BAND_FREQ: 6.0 });
export function zonalBandProfile(y, regime = E5_REGIME.GAS_GIANT, { bandFreq = DEFAULTS.BAND_FREQ } = {}) {
  const H = HARMONICS[regime];
  if (!H) return 0;
  const yc = clamp(-1, 1, y);
  let b = 0;
  for (let k = 0; k < H.length; k++) b += H[k].a * Math.sin(yc * bandFreq * H[k].f + H[k].p);
  return b;
}
