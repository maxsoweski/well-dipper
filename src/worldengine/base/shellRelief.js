// src/worldengine/base/shellRelief.js
//
// Increment 1 of the world-engine history program: the DESPUN / ICE-SHELL relief writer.
// A three-free, deterministic sibling of plates.js that organizes relief about a SEEDED paleo-spin
// axis (w0) and tidal axis (t_hat) — NOT carrier latitude — for icy / despun / tidally-locked shells,
// replacing the sin^2(lat) zonal fallback for those bodies ONLY. It never touches the validated
// Earth-like plate path — writeBodyRelief's condition-derived dispatch routes plate bodies (mobile
// lid) before ever reaching the shell regime.
//
// Determinism: every draw via alea(seedString) keyed off the integer macroSeed; NO Math.random /
// NO Date.now anywhere. Generative-not-simulative: the determined end-state in one pass + a bounded
// fixed RELAX_PASSES Jacobi smooth (mirrors plates.js). The ONLY iteration besides relaxation is an
// O(N) multi-source BFS queue drain (cell-distance transform) — copied from plates.js, NOT time-stepping.
//
// Build slices:
//   SLICE A (this scaffold) = regime resolution + dispatch seam + determinism + the convection-cell
//     partition + the diagnostics shape. The stress fields (stressTensile / thetaTraj / lineamentNode /
//     chaosMask) and the real STEP 5 relief assembly are STUBBED to deterministic placeholders.
//   SLICE B = STEP 1 stress-tensor field (despin + diurnal, diagonalized) + STEP 3 steered lineaments +
//     double-ridge cross-section + STEP 4 chaos overlay. Math pinned from research workflow wccpy01ez
//     (Melosh 1977 / Beuthe 2010 despin; Hoppa 1999 / Beuthe 2016 diurnal). See the workstream contract.

import alea from 'alea';
import { createNoise3D } from 'simplex-noise';
import { clamp, clamp01 } from './mathutil.js';
import { steeredNoise3 } from './stressFabric.js';   // V2-4 SP-STRESS-FABRIC: the one owned copy (was verbatim private here)

// ── Regime resolution (the dispatch blocker, resolved) ────────────────────────────────────────────
// One source-of-truth map accepting BOTH the short lab keys (PRESET_ARCHETYPE) and the canonical long
// keys, returning a normalized regime tag. 'volatile' is a COINED new short key (exists in no current
// vocabulary; produced by exactly one added PRESET_ARCHETYPE line for Titan).
export const SHELL_REGIMES = Object.freeze({
  ice: 'icy-active', eyeball: 'eyeball-despun', volatile: 'volatile-cold',   // short lab keys
  'icy-active': 'icy-active', 'volatile-cold': 'volatile-cold',              // canonical long keys
});

// Non-shell keys that must NEVER match the locked-fallback: a locked gas giant / lava world / exotic /
// earthlike body would otherwise be handed a rocky ice-shell lineament field (physically absurd, and an
// AC8 clobber of its despun/plate path). terrestrial/ocean are here too so a locked terrestrial falls
// through to despun, matching the pre-existing regime gate.
export const SHELL_EXCLUDE = new Set(['terrestrial', 'ocean', 'gas-giant', 'sub-neptune', 'lava', 'carbon', 'crystal']);

/**
 * Resolve an (archetype, locked) pair to a shell regime tag, or null if this body is not a shell body.
 * 1) explicit map hit (short or long key) wins;
 * 2) else a LOCKED body not in SHELL_EXCLUDE falls back to 'eyeball-despun' (catches archetype=null +
 *    locked Europa-class fall-through so it never silently drops to sin^2(lat));
 * 3) else null.
 */
export function shellRegimeOf(archetype, locked = false) {
  const mapped = SHELL_REGIMES[archetype];
  if (mapped) return mapped;
  if (locked && !SHELL_EXCLUDE.has(archetype)) return 'eyeball-despun';
  return null;
}

// ── Locked tunables (frozen — overridable ONLY by the headless structure test via `tune`, never by
//    route()/lab; identical discipline to plates DEFAULTS) ──────────────────────────────────────────
export const RELAX_PASSES = 4;
export const SHELL_BOUND = 4;   // generous bound guard, mirror of plates U_BOUND

// Per-regime chaos-vs-lineament weight split (selected by the normalized regime tag).
const REGIME_WEIGHTS = Object.freeze({
  'icy-active':     { DESPIN_W: 0.7, DIURNAL_W: 1.0,  CHAOS_W: 1.0 },   // cycloids + double-ridges + masked chaos
  'volatile-cold':  { DESPIN_W: 1.0, DIURNAL_W: 0.15, CHAOS_W: 0.8 },   // despin lineaments + cantaloupe cells dominate
  'eyeball-despun': { DESPIN_W: 1.0, DIURNAL_W: 0.0,  CHAOS_W: 0.0 },   // despin lineament field only; no convecting shell
});

const SHELL_DEFAULTS = Object.freeze({
  CELL_MIN: 9, CELL_SPAN: 9,        // K convection cells in [9, 18) — finer than the 7–13 plates
  WARP_FREQ: 1.6, WARP_AMP: 0.18,   // domain-warp of cell centroids (irregular, non-great-circle cell walls)
  DETAIL_FREQ: 8.0, DETAIL_AMP: 0.012,
  BELT_RADIANS: 0.06,               // geodesic falloff half-width (resolution-independent)
  SHELL_BASE: 0.0,                  // flat icy datum this increment
  RELAX_PASSES,
  // ── SLICE B stress + lineament tunables (pinned with the stress math; swept against AC2–AC5) ──
  DESPIN_REF: 1.0,                  // despin seeded-amplitude scale (folds E, Δf into one positive scalar)
  DIUR_REF: 0.09,                   // diurnal seeded-amplitude scale; tuned so raw |sigma_diur| ≈ |sigma_despin|
                                    //   (the A=2 coeffs make diurnal ~10.9x larger per unit K than despin,
                                    //    so DIUR_REF·18.1 ≈ DESPIN_REF·1.667) → REGIME_WEIGHTS act as intended:
                                    //    despin dominates volatile-cold, diurnal leads icy-active (cycloids)
  DIUR_PEAK: 18.1,                  // analytic per-unit-K peak of |sigma1_diur| (resolution-independent STRESS_REF term)
  TENSILE_THRESH: 0.05,             // min normalized tension to place a crack
  CHAOS_THRESH: 0.6,                // tension floor for chaos founder/raise
  CREST_THRESH: 0.94,              // absolute ridge-crest threshold (≈top 9% of R) — sparse, sharp crack
                                    //   network, NOT a local-max (so it stays order/resolution-independent)
  RIDGE_FREQ: 7.0,                  // steered ridge field frequency
  RIDGE_AMP: 1.4,                   // ridge relief amplitude (the dominant low/mid source)
  SHOULDER_HT: 1.2,                 // double-ridge shoulder height (the 4t(1-t) lobe)
  TROUGH_DEPTH: 0.55,               // central-trough depth (the smoothstep(0.6,1) cut) → U oscillates ACROSS the ridge
  CHAOS_BASE: -0.04, CHAOS_AMP: 0.12, CHAOS_FREQ: 5.0,   // foundered blocks below + raised matrix
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════
// ── V2-5s (shell driver-response): per-regime REFs + the driver→tune seam ──────────────────────────────
// The per-body D-vector re-tunes population/threshold/amplitude knobs via the EXISTING
// `tune ? { ...SHELL_DEFAULTS, ...tune } : SHELL_DEFAULTS` seam (:167) — no new writer machinery. Anchored
// PER REGIME so shellDriversToTune(SHELL_REFS[r], r) === null → each shipped icy preset renders BYTE-IDENTICAL
// (the three golden-pinned presets occupy three DISJOINT regimes — one per regime — so per-regime anchoring
// nulls all three exactly; the plates single-REF path is CLOSED because the shell goldens are pinned tune-less).
// PURE: zero alea / Math.random / Date.now. READ-SURFACE-MATCHED (the VENUS_REF discipline): frozen literals
// via derivation EXPRESSIONS (mass/R²; tidal via the plates EARTH_TIDAL_HEATING ioRef formula) — NO hand-typed
// decimals, NO cross-import from driver-presets.js. NEVER reads condition.radiusEarth (drawn radius — seed-varying).
const IO_TIDAL_REF = (0.0041 * 0.0041) * (317.8 * 317.8) * Math.pow(0.286, 5) / Math.pow(66, 5);
const shellTidal = (ecc, star, R, orbit) =>
  (ecc * ecc * star * star * Math.pow(R, 5) / Math.pow(orbit, 5)) / IO_TIDAL_REF;

export const SHELL_REFS = Object.freeze({
  'icy-active':     Object.freeze({ massGravity: 0.07 / (0.5 * 0.5),  volatileFraction: 0.5,  tidalHeating: shellTidal(0.1,  332946, 0.5, 2500),   condition: Object.freeze({ T_eq: 110 }) }),   // Europa
  'volatile-cold':  Object.freeze({ massGravity: 0.025 / (0.4 * 0.4), volatileFraction: 0.4,  tidalHeating: shellTidal(0.03, 332946, 0.4, 120000), condition: Object.freeze({ T_eq: 94 }) }),    // Titan
  'eyeball-despun': Object.freeze({ massGravity: 1 / (1 * 1),         volatileFraction: 0.25, tidalHeating: shellTidal(0.01, 332946, 1,   23455),  condition: Object.freeze({ T_eq: 270 }) }),   // Eyeball
});

// First-cut transfer gains (UAT-tunable; the ACs assert sign + measurability, not magnitudes).
const SPAN_DECADES = 6, K_CREST = 0.09, CREST_LO = 0.82, CREST_HI = 0.985,
      K_TENSILE = 0.03, TENSILE_LO = 0.01, TENSILE_HI = 0.12,
      K_CELL = 7, T_VIGOR_SPAN = 120, CELL_LO = 4, CELL_HI = 22,
      K_CHAOSTHRESH = 0.28, T_WARM_SPAN = 120, CHAOS_LO = 0.30, CHAOS_HI = 0.80;

/**
 * Map the body's D-vector → a population/threshold/amplitude `tune` override, anchored per regime so
 * shellDriversToTune(SHELL_REFS[regime], regime) === null (the writer's `tune ? {...SHELL_DEFAULTS,...tune}
 * : SHELL_DEFAULTS` ternary, :167, then takes the untouched branch → byte-identical shipped preset).
 * `regime` is dispatch-provided derived context (the same tuple REGIME_WEIGHTS[regime] consumes) used ONLY
 * to select the REF. Population/amplitude knobs ONLY — never DESPIN_REF/DIUR_REF/DIUR_PEAK/SHOULDER_HT/
 * TROUGH_DEPTH/SHELL_BASE/RELAX_PASSES/REGIME_WEIGHTS. ZERO alea draws — a pure DEFAULTS-override fn.
 * Read surface: flat massGravity/volatileFraction/tidalHeating + NESTED condition.T_eq (optional-chained,
 * never-throw). NEVER reads condition.radiusEarth (the drawn radius — seed-varying; grep-denied in AC-0).
 * @param {object|null} drivers  the per-body D-vector (bodyDrivers); null/{} → null (the dispatch bridge + shipped tests reach null).
 * @param {string} regime  the routed shell regime ('icy-active'|'volatile-cold'|'eyeball-despun') — selects the REF.
 * @returns {{CELL_MIN,CREST_THRESH,TENSILE_THRESH,CHAOS_THRESH,RIDGE_AMP,CHAOS_AMP,CHAOS_BASE}|null}
 */
export function shellDriversToTune(drivers, regime) {
  if (drivers == null) return null;                                   // (i) NULL-GUARD FIRST (dispatch bridge + shipped tests reach null)
  const D = SHELL_DEFAULTS;
  const REF = SHELL_REFS[regime] || SHELL_REFS['icy-active'];         // unknown regime → icy-active (writer REGIME_WEIGHTS fallback parity)
  // read surface: flat massGravity/volatileFraction/tidalHeating + NESTED condition.T_eq (optional-chained, never-throw)
  const g   = drivers.massGravity      ?? REF.massGravity;
  const vf  = drivers.volatileFraction ?? REF.volatileFraction;
  const th  = drivers.tidalHeating     ?? REF.tidalHeating;
  const Teq = drivers.condition?.T_eq  ?? REF.condition.T_eq;         // NESTED (never re-drives anything; shell reads no thermalState)

  // A1 gravity → ONE common gFactor onto RIDGE_AMP + CHAOS_AMP + CHAOS_BASE (relief ∝ 1/g). 1 at REF → byte-safe.
  const gFactor = clamp(0.4, 2.5, Math.pow(g / REF.massGravity, -0.5));
  const RIDGE_AMP  = D.RIDGE_AMP  * gFactor;
  const CHAOS_AMP  = D.CHAOS_AMP  * gFactor;
  const CHAOS_BASE = D.CHAOS_BASE * gFactor;
  // A2 tidal → CREST_THRESH (+ TENSILE_THRESH) down as tidal rises (denser cracks). log-ratio: 0 at REF (6-decade span).
  const tidalDev = clamp(-1, 1, Math.log10(Math.max(th, 1e-30) / REF.tidalHeating) / SPAN_DECADES);
  const CREST_THRESH   = clamp(CREST_LO,   CREST_HI,   D.CREST_THRESH   - K_CREST   * tidalDev);
  const TENSILE_THRESH = clamp(TENSILE_LO, TENSILE_HI, D.TENSILE_THRESH - K_TENSILE * tidalDev);
  // A3 thermal vigor (T_eq + vf) → CELL_MIN (finer convection planform). 0 at REF.
  const vigor = (Teq - REF.condition.T_eq) / T_VIGOR_SPAN + (vf - REF.volatileFraction);
  const CELL_MIN = clamp(CELL_LO, CELL_HI, Math.round(D.CELL_MIN + K_CELL * vigor));
  // A4 T_eq → CHAOS_THRESH down on warm shells (more melt-through chaos). 0 at REF.
  const warmDev = (Teq - REF.condition.T_eq) / T_WARM_SPAN;
  const CHAOS_THRESH = clamp(CHAOS_LO, CHAOS_HI, D.CHAOS_THRESH - K_CHAOSTHRESH * warmDev);

  // (ii) EXACT-ONLY IDENTITY GUARD: at REF every knob === its DEFAULT → null → the writer takes the untouched branch.
  if (CELL_MIN === D.CELL_MIN && CREST_THRESH === D.CREST_THRESH && TENSILE_THRESH === D.TENSILE_THRESH &&
      CHAOS_THRESH === D.CHAOS_THRESH && RIDGE_AMP === D.RIDGE_AMP && CHAOS_AMP === D.CHAOS_AMP && CHAOS_BASE === D.CHAOS_BASE) {
    return null;
  }
  return { CELL_MIN, CREST_THRESH, TENSILE_THRESH, CHAOS_THRESH, RIDGE_AMP, CHAOS_AMP, CHAOS_BASE };
}
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════

// ── tiny vec3 helpers on plain [x,y,z] arrays (COPIED VERBATIM from plates.js for resolution-independence) ──
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
function norm(a) { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
// Deterministic uniform point on the unit sphere from an alea rng (z = 2u-1, azimuth 2πv).
function randDir(rng) {
  const z = 2 * rng() - 1;
  const t = 2 * Math.PI * rng();
  const r = Math.sqrt(Math.max(0, 1 - z * z));
  return [r * Math.cos(t), r * Math.sin(t), z];
}
// Angular falloff: 1 at a cell wall, decaying to ~0 a few `belt` radians into the cell interior.
const falloffAng = (angDist, belt) => Math.exp(-angDist / belt);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const smoothstepS = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// steeredNoise3 (the anisotropic ridged-noise fabric) is now the owned SP-STRESS-FABRIC module
// (./stressFabric.js), imported above — was a verbatim private copy here. The ridge/trajectory call site
// (writeShellReliefSphere below) already passes a boolean `ridged`, so the call is unchanged and byte-exact
// (proven in tests/worldengine-v2-4-stress-fabric.test.js).

// Pole-safe meridional/azimuthal tangent basis at unit dir `d` about an arbitrary `axis`.
// theta_hat = meridional (increasing colatitude line), phi_hat = azimuthal (about axis). Both ⟂ d.
// Returns null at the axis pole (|axis × d| ≈ 0) → caller uses the isotropic fallback.
function axisFrame(d, axis) {
  let ph = cross(axis, d);
  const l = Math.hypot(ph[0], ph[1], ph[2]);
  if (l < 1e-7) return null;
  ph = [ph[0] / l, ph[1] / l, ph[2] / l];          // phi_hat (azimuthal)
  const th = cross(ph, d);                          // theta_hat (meridional, unit since ph⟂d are unit)
  return { theta: th, phi: ph };
}

// Project a symmetric tangent-plane tensor (eigenframe {u1,u2}, eigvals s11,s22, shear s12 in that frame)
// onto the {east,north} frame. Returns [a=ee, b=en, c=nn]. Avoids any psi-sign convention trap:
// T·v = s11(u1·v)u1 + s22(u2·v)u2 + s12((u1·v)u2 + (u2·v)u1), then dot with east/north.
function tensorToEN(u1, u2, s11, s22, s12, east, north) {
  const dotE1 = u1[0] * east[0] + u1[1] * east[1] + u1[2] * east[2];
  const dotE2 = u2[0] * east[0] + u2[1] * east[1] + u2[2] * east[2];
  const dotN1 = u1[0] * north[0] + u1[1] * north[1] + u1[2] * north[2];
  const dotN2 = u2[0] * north[0] + u2[1] * north[1] + u2[2] * north[2];
  // a = east·T·east, c = north·T·north, b = east·T·north
  const a = s11 * dotE1 * dotE1 + s22 * dotE2 * dotE2 + 2 * s12 * dotE1 * dotE2;
  const c = s11 * dotN1 * dotN1 + s22 * dotN2 * dotN2 + 2 * s12 * dotN1 * dotN2;
  const b = s11 * dotE1 * dotN1 + s22 * dotE2 * dotN2 + s12 * (dotE1 * dotN2 + dotE2 * dotN1);
  return [a, b, c];
}

/**
 * Despun / ice-shell relief writer. Mirrors writePlateUpliftSphere's signature + discipline.
 * @param {object} carrier  sphere field (verts/adj/N + height/grainAngle/faultDensity channels)
 * @param {object} drivers  accepted for signature parity; VOID this increment (seed-only, like plates)
 * @param {{macroSeed?:number, regime?:string, tune?:object}} opts
 * @returns diagnostics object (peer of plateDiag) — see the workstream contract.
 */
export function writeShellReliefSphere(carrier, drivers = {}, { macroSeed = 0, regime = 'icy-active', tune = null } = {}) {
  void drivers;   // seed-only this increment (driver-RESPONSE is the next increment, via the `tune`/drivers seam)
  const T = tune ? { ...SHELL_DEFAULTS, ...tune } : SHELL_DEFAULTS;
  const W = REGIME_WEIGHTS[regime] || REGIME_WEIGHTS['icy-active'];
  const PASSES = T.RELAX_PASSES;

  const N = carrier.N, verts = carrier.verts, adj = carrier.adj;
  const seed = (macroSeed | 0);

  // ── STEP 0 — resolution key: mean edge angle (geodesic radians per BFS hop) ──
  let angSum = 0, angCnt = 0;
  for (let i = 0; i < N; i++) {
    const a = verts[i], nb = adj[i];
    for (let k = 0; k < nb.length; k++) { angSum += Math.acos(clamp(-1, 1, dot(a, verts[nb[k]]))); angCnt++; }
  }
  const meanEdgeAngle = angCnt ? angSum / angCnt : 0.1;

  // ── seeded frames (disjoint 'shell:' alea namespace — never collides with plates' 'plates:' or 'e6:') ──
  const w0 = randDir(alea('shell:axis:' + seed));      // PALEO-SPIN axis: despin stress is organized about THIS
  const t_hat = randDir(alea('shell:tidal:' + seed));  // sub-parent (permanent-bulge) axis for diurnal stress
  const phi0 = 2 * Math.PI * alea('shell:nsr:' + seed)();   // frozen NSR / diurnal phase
  const detailNoise = createNoise3D(alea('shell:detail:' + seed));

  // ── STEP 2 — convection-cell partition (secondary; only when CHAOS_W > 0) ──
  const cellId = new Int32Array(N);
  const cellInteriorness = new Float32Array(N);
  let cellCount = 0;
  if (W.CHAOS_W > 0) {
    const rngCells = alea('shell:cells:' + seed);
    cellCount = T.CELL_MIN + Math.floor(rngCells() * T.CELL_SPAN);
    const centroids = [];
    for (let p = 0; p < cellCount; p++) { centroids.push(randDir(rngCells)); rngCells(); rngCells(); }  // + polarity/vigor draws (consumed in SLICE B)
    const warpNoise = createNoise3D(alea('shell:warp:' + seed));
    // spherical-Voronoi: nearest-by-max-dot over warped centroids; strict '>' tie-break (lowest index wins, == plates)
    for (let i = 0; i < N; i++) {
      const d = verts[i];
      const wx = warpNoise(d[0] * T.WARP_FREQ, d[1] * T.WARP_FREQ, d[2] * T.WARP_FREQ);
      const wy = warpNoise(d[0] * T.WARP_FREQ + 19.1, d[1] * T.WARP_FREQ - 7.3, d[2] * T.WARP_FREQ + 3.7);
      const wz = warpNoise(d[0] * T.WARP_FREQ - 5.2, d[1] * T.WARP_FREQ + 11.9, d[2] * T.WARP_FREQ - 2.4);
      const wd = norm([d[0] + T.WARP_AMP * wx, d[1] + T.WARP_AMP * wy, d[2] + T.WARP_AMP * wz]);
      let best = 0, bestDot = -Infinity;
      for (let p = 0; p < cellCount; p++) {
        const c = centroids[p];
        const dd = wd[0] * c[0] + wd[1] * c[1] + wd[2] * c[2];
        if (dd > bestDot) { bestDot = dd; best = p; }
      }
      cellId[i] = best;
    }
    // multi-source BFS distance transform from cell WALLS (downwelling sutures); interiors = upwelling/chaos candidates
    const cellDist = new Int32Array(N).fill(-1);
    const q = new Int32Array(N); let qh = 0, qt = 0;
    for (let i = 0; i < N; i++) {
      const nb = adj[i];
      for (let k = 0; k < nb.length; k++) { if (cellId[nb[k]] !== cellId[i]) { cellDist[i] = 0; q[qt++] = i; break; } }
    }
    if (qt === 0) { cellDist.fill(0); }
    else {
      while (qh < qt) {
        const c = q[qh++];
        const nd = cellDist[c] + 1;
        for (const nb of adj[c]) { if (cellDist[nb] < 0) { cellDist[nb] = nd; q[qt++] = nb; } }
      }
    }
    for (let i = 0; i < N; i++) cellInteriorness[i] = clamp01(1 - falloffAng(cellDist[i] * meanEdgeAngle, T.BELT_RADIANS));
  }

  // ── STEP 1 — STRESS TENSOR field (despin ⊕ diurnal), diagonalized into {east,north} ──────────────
  // Seeded positive amplitudes — ONE scalar per build per source, distinct alea draws (spec STEP 1a/1b).
  const A_despin = T.DESPIN_REF * (0.6 + 0.8 * alea('shell:despin:' + seed)());
  const A_diur   = T.DIUR_REF   * (0.6 + 0.8 * alea('shell:diur:'   + seed)());
  // Analytic, resolution-independent STRESS_REF (skeptic-fix #3): matches @600-node and @40k.
  const STRESS_REF = W.DESPIN_W * A_despin * (10 / 6) + W.DIURNAL_W * A_diur * T.DIUR_PEAK || 1e-9;
  // Non-degenerate Europa elastic-limit A=2 diurnal coefficients (skeptic-fix #2): b1≠b2, g1≠g2.
  const b1 = 5, b2 = -1, g1 = 1, g2 = 3, g3 = 1, f = 1;
  const cphi0 = Math.cos(phi0), sphi0 = Math.sin(phi0);

  const stressTensile = new Float32Array(N);   // signed sigma1 (normalized, tensile-positive)
  const thetaTraj = new Float32Array(N);        // most-tensile principal-axis angle in {east,north} == grainAngle
  const lineamentNode = new Uint8Array(N);      // 1 where a ridge-shoulder / crack is placed
  const chaosMask = new Float32Array(N);
  const eFrame = [], nFrame = [];               // cache {east,north} per node (reused by STEP 3)

  for (let i = 0; i < N; i++) {
    const d = verts[i];
    const { east, north } = carrier.tangentFrameAt(i);
    eFrame.push(east); nFrame.push(north);

    let a = 0, b = 0, c = 0;   // summed sigma_ee / sigma_en / sigma_nn in {east,north}

    // STEP 1a — DESPIN tensor about w0 (diagonal in {theta_w, phi_w}, no shear, theta_w most-tensile).
    if (W.DESPIN_W > 0) {
      const fw = axisFrame(d, w0);
      if (fw) {
        const mu = Math.cos(2 * Math.acos(clamp(-1, 1, dot(d, w0))));
        const s_th = A_despin * (3 * mu + 5) / 6;   // MERIDIONAL (theta_hat_w)
        const s_ph = A_despin * (9 * mu - 1) / 6;   // AZIMUTHAL  (phi_hat_w)
        const [da, db, dc] = tensorToEN(fw.theta, fw.phi, s_th, s_ph, 0, east, north);
        a += W.DESPIN_W * da; b += W.DESPIN_W * db; c += W.DESPIN_W * dc;
      }
    }

    // STEP 1b — DIURNAL tensor about t_hat, frozen phase phi0 (shear sigma_tp ⇒ smooth axis rotation).
    if (W.DIURNAL_W > 0) {
      const ft = axisFrame(d, t_hat);
      if (ft) {
        const theta_t = Math.acos(clamp(-1, 1, dot(d, t_hat)));
        const ct = Math.cos(theta_t), c2t = Math.cos(2 * theta_t);
        // longitude of d about t_hat from a FIXED zero-meridian (world frame), so c2p/s2p are continuous.
        const refRaw = Math.abs(t_hat[1]) < 0.99 ? [0, 1, 0] : [1, 0, 0];
        let refE = cross(refRaw, t_hat); const rl = Math.hypot(refE[0], refE[1], refE[2]) || 1;
        refE = [refE[0] / rl, refE[1] / rl, refE[2] / rl];
        const refN = cross(t_hat, refE);
        const lon = Math.atan2(dot(ft.phi, refN), dot(ft.phi, refE));  // longitude of d's azimuthal basis
        const c2p = Math.cos(2 * lon), s2p = Math.sin(2 * lon);
        const K = A_diur;
        const X_tt = -(b1 + 3 * g1 * c2t) + 3 * c2p * (b1 - g1 * c2t), Y_tt = -4 * f * s2p * (b1 - g1 * c2t);
        const X_pp = -(b2 + 3 * g2 * c2t) + 3 * c2p * (b2 - g2 * c2t), Y_pp = -4 * f * s2p * (b2 - g2 * c2t);
        const X_tp = g3 * ct * 3 * s2p,                                Y_tp = g3 * ct * 4 * f * c2p;
        const s_tt = (3 / 4) * K * (X_tt * cphi0 - Y_tt * sphi0);
        const s_pp = (3 / 4) * K * (X_pp * cphi0 - Y_pp * sphi0);
        const s_tp = (-3)    * K * (X_tp * cphi0 - Y_tp * sphi0);
        const [da, db, dc] = tensorToEN(ft.theta, ft.phi, s_tt, s_pp, s_tp, east, north);
        a += W.DIURNAL_W * da; b += W.DIURNAL_W * db; c += W.DIURNAL_W * dc;
      }
    }

    // diagonalize the summed 2×2 in {east,north}: lam_max = sigma1 (SIGNED); direct eigenvector (fix #3).
    const half = (a - c) / 2;
    const lam_max = (a + c) / 2 + Math.sqrt(half * half + b * b);
    let theta_traj;
    if (Math.abs(b) < 1e-9 && Math.abs(a - c) < 1e-9) theta_traj = 0;   // isotropic fallback
    else theta_traj = Math.atan2(lam_max - a, b);
    stressTensile[i] = clamp(-1, 1, lam_max / STRESS_REF);
    thetaTraj[i] = theta_traj;
  }

  // ── STEP 3 — steered double-ridge lineaments (crests ⟂ most-tensile axis; absolute threshold) ─────
  const ridgeNoise = createNoise3D(alea('shell:ridge:' + seed));
  const lineamentRelief = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const d = verts[i], east = eFrame[i], north = nFrame[i];
    // crack STRIKES ⟂ to the most-tensile axis ⇒ steer ridge LINES at theta_traj + π/2.
    const R = steeredNoise3(ridgeNoise, d, east, north, thetaTraj[i] + Math.PI / 2, true, T.RIDGE_FREQ) + 0.5; // → [0,1]
    const sigma = stressTensile[i];
    lineamentNode[i] = (R > T.CREST_THRESH && sigma > T.TENSILE_THRESH) ? 1 : 0;
    // analytic double-ridge cross-section: central trough + two shoulders ⇒ U oscillates ACROSS the ridge.
    const t = clamp01((R - T.CREST_THRESH) / (1 - T.CREST_THRESH));   // 0 at edge, 1 at crest centre
    const doubleRidge = T.SHOULDER_HT * 4 * t * (1 - t) - T.TROUGH_DEPTH * smoothstepS(0.6, 1.0, t);
    lineamentRelief[i] = (W.DESPIN_W + W.DIURNAL_W) * T.RIDGE_AMP * Math.max(0, sigma) * doubleRidge;  // tension-gated
  }

  // ── STEP 4 — chaos overlay (CHAOS_W>0 only; cell interiors, high tension) ──────────────────────────
  const chaosRelief = new Float32Array(N);
  if (W.CHAOS_W > 0) {
    const chaosNoise = createNoise3D(alea('shell:chaos:' + seed));
    for (let i = 0; i < N; i++) {
      const d = verts[i];
      const drive = cellInteriorness[i] * Math.max(0, stressTensile[i] - T.CHAOS_THRESH) / (1 - T.CHAOS_THRESH);
      chaosMask[i] = W.CHAOS_W * smoothstepS(0, 1, drive);
      chaosRelief[i] = chaosMask[i] * (T.CHAOS_BASE + T.CHAOS_AMP * chaosNoise(d[0] * T.CHAOS_FREQ, d[1] * T.CHAOS_FREQ, d[2] * T.CHAOS_FREQ));
    }
  }

  // ── reliefStress — the PURE STRESS-GEOMETRIC relief (lineament + chaos) BEFORE SHELL_BASE/detail/RELAX.
  // Published ADDITIVELY for the live AC10 probe (world-engine-lab.html shellProbe). It is byte-for-byte the
  // writer's own STEP-3 + STEP-4 product — i.e. exactly what the headless AC2(a) stressProximityPredictor
  // reconstructs arm's-length from thetaTraj + max(0,stressTensile) — so the live probe can use it WITHOUT
  // re-duplicating the cross-section constants. Why this over the old BFS-proximity probe:
  //   • ANTI-DEGENERACY: it carries the high-frequency DOUBLE-RIDGE cross-section oscillation. For pure
  //     despin (eyeball/volatile) sigma1_n is broadly positive, so a stress-PROXIMITY field collapses to a
  //     constant (corr→0); the steered ridge field does NOT — it stays structured for every regime.
  //   • ANTI-CIRCULARITY: built ONLY from stress geometry (thetaTraj steering + sigma1 gate via the ridge
  //     pass), with ZERO latitude term and ZERO read of U — so beating latY/latW0 in the probe is a real,
  //     falsifiable result, not a tautology. It is NOT lineamentNode, so it is not "the answer key".
  // It is additive: U, carrier.height, grainAngle, faultDensity and every pre-existing diag field are
  // unchanged (AC1 byte-identical-U + determinism stay green).
  const reliefStress = new Float32Array(N);
  for (let i = 0; i < N; i++) reliefStress[i] = lineamentRelief[i] + chaosRelief[i];

  // ── STEP 5 — assemble: SHELL_BASE + lineamentRelief + chaosRelief + detail (REPLACES the placeholder) ──
  const U = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const d = verts[i];
    U[i] = T.SHELL_BASE + lineamentRelief[i] + chaosRelief[i]
      + T.DETAIL_AMP * detailNoise(d[0] * T.DETAIL_FREQ, d[1] * T.DETAIL_FREQ, d[2] * T.DETAIL_FREQ);
  }
  carrier.height.set(U);   // REPLACE (sole low/mid source for shell regimes — no additive re-banding)

  // bounded fixed RELAX_PASSES Jacobi smooth (double-buffered convex combination, verbatim plates)
  const buf = new Float32Array(N);
  for (let pass = 0; pass < PASSES; pass++) {
    for (let i = 0; i < N; i++) {
      let sum = U[i], cnt = 1;
      const nb = adj[i];
      for (let k = 0; k < nb.length; k++) { sum += U[nb[k]]; cnt++; }
      buf[i] = U[i] * 0.5 + (sum / cnt) * 0.5;
    }
    U.set(buf);
  }
  carrier.height.set(U);

  carrier.grainAngle.set(thetaTraj);                                            // lineament strike (0 this slice)
  for (let i = 0; i < N; i++) carrier.faultDensity[i] = clamp01(Math.abs(stressTensile[i]));  // activity proxy (0 this slice)

  return {
    U, regime, cellId, cellCount, stressTensile, thetaTraj, lineamentNode, chaosMask,
    reliefStress,   // ADDITIVE: stress-geometric relief (lineament+chaos) pre-RELAX, for the live AC10 probe
    w0, t_hat, phi0, meanEdgeAngle, relaxPasses: PASSES,
  };
}
