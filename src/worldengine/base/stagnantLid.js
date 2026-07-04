// src/worldengine/base/stagnantLid.js
// ─────────────────────────────────────────────────────────────────────────────
// STAGNANT-LID SILICATE RELIEF WRITER  (World-Engine history program, increment #4b — Venus)
//
// THREE-FREE BY CONSTRUCTION: imports only alea + simplex-noise + the pure scalar helpers in
// mathutil.js. It NEVER imports three. A sibling of plates.js / shellRelief.js / magmatism.js: it
// consumes the F3 sphere carrier ({verts, adj, N, tangentFrameAt}) and REPLACES carrier.height for a
// stagnant-lid silicate body (Venus). The regime gate that selects this writer lives at the
// route()/lab boundary (planet-lod-rivers.js isStagnantLidPath), NOT in here.
//
// GENERATIVE, NOT SIMULATIVE — it places the *determined end-state* of a Venus-type history in ONE
// pass, all organized about ONE seeded mantle-plume field (reproducing the Beta–Atla–Themis causal
// logic: coronae/rifts/young volcanism cluster over concentrated upwelling):
//
//   seed N broad mantle-plume provinces from macroSeed (some ancient/tessera-forming, some corona-forming)
//     -> tessera crustal PLATEAUS over the OLDEST (ancient) plume caps: high, orthogonal fold+ribbon
//        double-fabric (two crossed ridged steeredNoise3 fields ⊥ each other)
//     -> CORONAE placed field-biased (accept ∝ plume-proximity^BIAS): active = domed interior + outer
//        trench + outer rise; inactive = raised rim + inner depression (a static morphology SELECTOR)
//     -> a young basaltic-PLAINS datum as the ~70–80% background, RIFT corridors between provinces as lows
//     -> a diagnostics-only resurfacing-age field (oldest tessera, youngest corona/rift)
//
// U IS THE SOLE LOW/MID-FREQUENCY SOURCE for carrier.height on Venus, written with `=` (REPLACE), not
// `+=` — the latitude-band writeHeightSphere fallback is exactly what this removes.
//
// RENDER-ONCE: the only iteration is a BOUNDED fixed RELAX_PASSES Jacobi smooth (verbatim plates). NO
// per-Myr time loop, NO convergence while-loop, and — because rift distance is ANALYTIC point-to-arc
// (not a BFS) — ZERO while-loops of any kind.
//
// DETERMINISM HARD-RULE: every draw is seeded via alea(seedString) in the DISJOINT 'stagnant:'
// namespace, keyed off the integer macroSeed, in a FIXED draw order. NO Math.random / NO Date.now.
// carrier.regime is left UNTOUCHED (verify.js asserts regime ∈ {0,1,2} — no 4th regime constant).
// Same macroSeed ⇒ byte-identical U / grainAngle / faultDensity / resurfAge / isTessera / coronaActive.
//
// CALIBRATION re-verified 2026-07-01 against live peer-reviewed sources (see the workstream
// BUILD-PLAN + the mechanism doc): CORONA_ACTIVE_FRAC=0.65 (2025 gravity-resolved 52/75≈0.69), tessera
// ~7–8% (Ivanov & Head 1996), coronae 9.5% coverage, resurfacing 500±200 Ma, plains ~70–80% TOTAL.
// ─────────────────────────────────────────────────────────────────────────────
import alea from 'alea';
import { createNoise3D } from 'simplex-noise';
import { clamp, clamp01 } from './mathutil.js';

// ── LOCKED tunables (production passes ONLY macroSeed; DEFAULTS overridable via opts.tune purely so the
// headless structure tests / exploration can sweep — the route()/lab path never overrides them). ──────
export const DEFAULTS = Object.freeze({
  PLUME_MIN: 6, PLUME_SPAN: 6,          // N_plume ∈ [6,11] — few broad Venus provinces (BAT ≈ 3 loci + rises)
  PLUME_BELT: 0.35,                     // GEODESIC Gaussian belt half-width (rad): p = exp(-(a/BELT)^2). Broad → tessera caps merge.
  TESSERA_CENTER_FRAC: 0.4,             // per-center type draw: ancient (tessera-forming) vs corona-forming
  TESSERA_FRAC: 0.075,                  // target tessera areal fraction (percentile-histogram threshold on plumeProxAncient)
  WARP_FREQ: 1.5, WARP_AMP: 0.22,       // domain-warp of the province margins (== plates)
  CORONA_POOL: 120, CORONA_BIAS: 2.0,   // candidate sites PER CORONA_POOL_REF_N nodes; accept ∝ plumeProx(site)^BIAS → tight BAT clustering
  CORONA_POOL_REF_N: 1500,              // pool scales ∝ N so corona COVERAGE is resolution-invariant (else node-scaled coronae + fixed pool → sparse/vanishing coverage on the fine game mesh). ~16 coronae at N=1500, ~430 at the 40k game mesh.
  CORONA_ACTIVE_FRAC: 0.65,             // active:inactive morphology SELECTOR (2025 gravity-resolved 52/75≈0.69, nudged down)
  CORONA_CTRL_ACCEPT: 0.13,            // AC4 random-placement control: constant accept-gate (plume-decoupled; ~matches real accept rate)
  // Corona RADIUS is RESOLUTION-ADAPTIVE (× meanEdgeAngle) so coronae are node-legible at ANY mesh
  // density: ~200–900 km on the ~40k game mesh (realistic; km citations 60–2600 informed the heavy-tailed
  // SHAPE), chunky-but-visible on the 600-node test mesh. Charter: legibility, not a literal-km fit.
  CORONA_RC_MIN_NODES: 0.5, CORONA_RC_SPAN_NODES: 1.1, CORONA_SIZE_SKEW: 2.5,  // R_c = (MIN + u^SKEW·SPAN)·meanEdgeAngle
  CORONA_SUPPORT_ACTIVE: 1.6, CORONA_SUPPORT_INACTIVE: 1.3,  // ρ = geodesicDist/R_c support cutoff (→ coronaCoverMask)
  A_DOME: 0.35, A_TRENCH: 0.30, A_RISE: 0.12,   // active radial profile amplitudes (all < the base gaps)
  A_DEP: 0.18, A_RIM: 0.22,                     // inactive radial profile amplitudes
  BASE_TESSERA: 0.70, BASE_PLAINS: 0.10, BASE_RIFT: -0.45,   // strictly-ordered base constants (gaps 0.60, 0.55; rift deep enough to stay below plains after the smooth)
  TESS_FOLD_AMP: 0.16, TESS_RIBBON_AMP: 0.08,   // Σ 0.24 < 0.60 gap ⇒ texture can't invert tessera>plains
  FOLD_FREQ: 5, RIBBON_FREQ: 13,                // ribbons finer than folds → the two-scale tessera signature
  RIFT_HALFWIDTH_NODES: 2.5,                    // rift-corridor half-width as a multiple of meanEdgeAngle (wide enough to survive the relax smooth → a clean low population)
  YOUNG_LOBE_GAIN: 0.35, AGE_FREQ: 3.0,         // resurfacing-age lobe dip toward plume centers + noise freq
  DETAIL_FREQ: 7.0, DETAIL_AMP: 0.02,           // small isotropic sub-grid texture (<< structure)
  RELAX_PASSES: 3,                              // FIXED bounded relaxation (render-once; 3 keeps thin rift lows from washing out)
});
export const RELAX_PASSES = DEFAULTS.RELAX_PASSES;

// The documented relief band for U sums to roughly [-0.3, +1.0]; the guard is generous (AC1 asserts |U| < this).
export const STAGNANT_BOUND = 4;

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════
// ── V2-2b-1 (stagnant driver-response): the neutral reference point + the driver→tune seam ──────────────
// Direct analog of magmatism.js's MAGMA_REF / magmaDriversToTune (#4-MULTIPLY volcanic discipline) on the
// STAGNANT / Venus corner. The per-body D-vector (V/dryness, g, T_surf, age, thermalState) re-tunes ONLY the
// population/placement knobs {TESSERA_FRAC, CORONA_ACTIVE_FRAC, CORONA_POOL, PLUME_MIN} via the EXISTING
// `tune ? { ...DEFAULTS, ...tune } : DEFAULTS` seam (:175) — no new writer machinery. Anchored so
// stagnantDriversToTune(VENUS_REF) === null → Venus takes the untouched DEFAULTS branch → BYTE-IDENTICAL.
// PURE: zero alea / Math.random / Date.now — it only computes DEFAULTS overrides. BASE_* floors + all
// amplitudes are UNTOUCHED ⇒ the mean(tessera)>mean(plains)>mean(rift) ordering is preserved STRUCTURALLY.

// VENUS_REF — the null point (analog of MAGMA_REF, magmatism.js:93, but ON the shipped Venus preset). Venus's
// REAL preset read-slots, READ-SURFACE-MATCHED: V,g FLAT; T_eq,age NESTED under `.condition`. massGravity is
// the EXACT live-derived g (0.815/0.95², NOT the rounded 0.903) — byte-exact vs deriveUniforms.surfaceGravity;
// inert while K_G=0 but load-bearing the instant the K_G opt-in fires. Frozen literal (base/ writers take no
// cross-imports; MAGMA_REF is likewise a literal). AC-TUNE-NULL asserts every slot === the live Venus bundle.
export const VENUS_REF = Object.freeze({
  volatileFraction: 0.02,              // FLAT V/dryness D-slot (Venus composition.volatileFraction, driver-presets.js:47)
  massGravity: 0.815 / (0.95 * 0.95),  // FLAT g D-slot — EXACT live-derive (== deriveUniforms surfaceGravity), NOT rounded 0.903
  condition: { T_eq: 737, age: 4.5 },  // NESTED read surface (deriveConditionVector: T_eq=fp.T_eq=737, age=fp.age??4.5=4.5)
});

// Venus-neutral endogenic drive (== magma's H_REF; tidal-quiet, age 4.5). stagnantThermal reads ONLY an
// EXPLICIT thermalState (pass-through via clamp01) and falls back to THERMAL_REF when it is absent — it does
// NOT re-derive from raw tidalHeating. This is the load-bearing byte-safety edit (contract designDecision #6 /
// the R1 discipline): buildNeutralBodyDrivers omits thermalState at BOTH VENUS_REF and the live Venus bundle,
// so both collapse to THERMAL_REF ⇒ thermDev = 0 ⇒ byte-identical. A magmaThermal-style raw-tidal mirror would
// leak Venus's live tidalHeat (0.00118) → thermDev +0.00059 → a non-null tune at Venus → the 75-golden MOVES.
export const THERMAL_REF = 0.275;
function stagnantThermal(drivers) {
  return (drivers && drivers.thermalState != null) ? clamp01(drivers.thermalState) : THERMAL_REF;
}

// First-cut transfer gains (mirror magma's K_COUNT/K_HEIGHT/K_LO/K_ELONG). UAT-tunable; the ACs assert correct
// SIGN + measurable magnitude, not a fixed gain. K_G=0 keeps gravity relief-scaling DEFERRED (gFactor ≡ 1) so
// the anti-mush invariant stays trivially true (BASE_* floors + amplitudes untouched; g feeds NO override).
const K_TESS = 0.12,   // V(dryness) → TESSERA_FRAC        (drier ↑; a full 0.02→0.6 wet sweep drains tessera to the floor)
      K_AGE  = 0.015,  // condition.age → TESSERA_FRAC     (older ↑; headless-only limb — no age slider)
      K_ACT  = 0.35,   // thermalState → CORONA_ACTIVE_FRAC (hotter/younger ↑)
      K_ACT_T = 0.25,  // T_surf → CORONA_ACTIVE_FRAC      (hot-dry-limb ↑, via tNorm)
      K_POOL = 0.9,    // vigor(+wetness) → CORONA_POOL    (proportional multiply)
      K_PLUME = 5,     // vigor → PLUME_MIN
      K_G    = 0;      // GRAVITY relief-scaling DEFERRED  (zeroable; while 0, g feeds NO override → anti-mush trivially true)
const TSURF_SPAN = 500; // T_surf normalization span (Kelvin) — 737 → ~237 spans one unit

// Map the body's D-vector → a population-knob `tune` override, anchored so stagnantDriversToTune(VENUS_REF) ===
// null → the writer's `tune ? {...DEFAULTS,...tune} : DEFAULTS` ternary (stagnantLid.js:175) takes the untouched
// branch → byte-identical Venus. Mixed read surface BY DESIGN: V,g FLAT; T_surf,age NESTED under .condition.
// ZERO alea draws — a pure DEFAULTS-override fn. Population knobs only (no BASE_* / amplitude key ever returned).
export function stagnantDriversToTune(drivers) {
  if (drivers == null) return null;                          // (i) NULL-GUARD FIRST (mirror magmatism.js:114) — dispatch
                                                             //     calls with bodyDrivers defaulting null (rivers:452);
                                                             //     the shipped structure tests (:340,:368) reach it null.
  const D = DEFAULTS;
  // read surface: V,g FLAT with VENUS_REF fallback; T_surf,age NESTED via optional-chaining + fallback (never-throw)
  const V   = drivers.volatileFraction ?? VENUS_REF.volatileFraction;   // 0.02 at Venus
  const g   = drivers.massGravity      ?? VENUS_REF.massGravity;        // exact live g at Venus (deferred: K_G=0)
  const age = drivers.condition?.age   ?? VENUS_REF.condition.age;      // 4.5 at Venus — NESTED (never re-drives stagnantThermal)
  const Ts  = drivers.condition?.T_eq  ?? VENUS_REF.condition.T_eq;     // 737 at Venus — NESTED
  const H   = stagnantThermal(drivers);                                 // explicit thermalState only → THERMAL_REF at Venus

  // deviation signals — EVERY ONE is exactly 0 at VENUS_REF and at the live Venus bundle (byte anchor)
  const dryDev   = VENUS_REF.volatileFraction - V;              // drier > 0, wetter < 0   (0 at Venus)
  const ageDev   = age - VENUS_REF.condition.age;               // older > 0               (0 at Venus)
  const tNorm    = (Ts - VENUS_REF.condition.T_eq) / TSURF_SPAN; // cooler < 0             (0 at Venus)
  const thermDev = H - THERMAL_REF;                             // hotter/younger > 0       (0 at Venus)
  const vigor    = thermDev + tNorm;                           // hot-dry-limb endogenic vigor (0 at Venus)
  const gFactor  = clamp(0.5, 2.0, Math.pow(g / VENUS_REF.massGravity, -K_G)); // K_G=0 ⇒ gFactor≡1 (byte-safe)

  // population-knob overrides — drier/older ↑ tessera; hotter/younger ↑ activeFrac + coronaCount; more vigor ↑ plumes
  const TESSERA_FRAC       = clamp(0.02, 0.20, D.TESSERA_FRAC + K_TESS * dryDev + K_AGE * ageDev);
  const CORONA_ACTIVE_FRAC = clamp(0.30, 0.95, D.CORONA_ACTIVE_FRAC + K_ACT * thermDev + K_ACT_T * tNorm);
  const CORONA_POOL        = clamp(20, 400, Math.round(D.CORONA_POOL * gFactor * (1 + K_POOL * (vigor - dryDev))));
  const PLUME_MIN          = clamp(3, 12, Math.round(D.PLUME_MIN + K_PLUME * vigor));

  // (ii) EXACT-ONLY IDENTITY GUARD (mirror magmatism.js:124-127): at VENUS_REF every override === its DEFAULT
  //      → return null → the writer takes the untouched DEFAULTS branch → byte-identical Venus.
  if (TESSERA_FRAC === D.TESSERA_FRAC && CORONA_ACTIVE_FRAC === D.CORONA_ACTIVE_FRAC &&
      CORONA_POOL === D.CORONA_POOL && PLUME_MIN === D.PLUME_MIN) return null;
  return { TESSERA_FRAC, CORONA_ACTIVE_FRAC, CORONA_POOL, PLUME_MIN };
}
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════

// ── regime resolver (mirror of shellRegimeOf, but NEVER gated on `locked` — Venus is a slow retrograde
// rotator, locked:false; gating on locked would MISS it, which IS the fall-through-to-sin²(lat) bug). ──
export const STAGNANT_LID_KEYS = new Set(['stagnant-lid', 'venus']);
export function stagnantLidRegimeOf(archetype, locked = false) {
  void locked; // key-based match ONLY — do not gate on locked
  return STAGNANT_LID_KEYS.has(archetype) ? 'venus-stagnant-lid' : null;
}

// ── tiny vec3 helpers on plain [x,y,z] arrays (three-free; verbatim from plates.js:166-168) ───────────
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function norm(a) { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }

// Deterministic uniform point on the unit sphere from an alea rng (z=2u-1, azimuth 2πv). 2 draws/call;
// draw-order is load-bearing for byte-identity. (verbatim from plates.js:171-176)
function randDir(rng) {
  const z = 2 * rng() - 1;
  const t = 2 * Math.PI * rng();
  const r = Math.sqrt(Math.max(0, 1 - z * z));
  return [r * Math.cos(t), r * Math.sin(t), z];
}

// Anisotropic ridged noise steered along a strike axis. COPIED VERBATIM from tectonic.js:93-116
// (module-private there) in the shellRelief.js:110-129 ridged-boolean form — ridged=true → 0.5-|n| (a
// positive relief lobe). Both tessera fold + ribbon call with ridged=true; fold uses the strike+π/2,
// ribbon the strike, so the two fabrics are strictly orthogonal (the tessera double-deformation).
function steeredNoise3(noise3, dir, east, north, angle, ridged, freq, sign = +1) {
  const ca = Math.cos(angle), sa = Math.sin(angle);
  const contraction = sign >= 0;
  const fScale = contraction ? 0.7 : 1.5;
  const along = contraction ? 0.25 : 0.55;
  const across = contraction ? 1.9 : 1.2;
  const sU = freq * fScale * along;
  const sV = freq * fScale * across;
  const ux = east[0] * ca + north[0] * sa;
  const uy = east[1] * ca + north[1] * sa;
  const uz = east[2] * ca + north[2] * sa;
  const vx = -east[0] * sa + north[0] * ca;
  const vy = -east[1] * sa + north[1] * ca;
  const vz = -east[2] * sa + north[2] * ca;
  const px = dir[0] * freq + ux * sU + vx * sV;
  const py = dir[1] * freq + uy * sU + vy * sV;
  const pz = dir[2] * freq + uz * sU + vz * sV;
  const nVal = noise3(px, py, pz);
  return ridged ? (0.5 - Math.abs(nVal)) : (Math.abs(nVal) - 0.5);
}

// Analytic geodesic distance (radians) from unit point P to the great-circle ARC segment A→B. No BFS,
// no while-loop. If P projects inside the arc span, distance = |angle to the arc's great circle|; else
// the nearest endpoint. Degenerate (A≈B) → distance to A.
function geodesicPointToArc(P, A, B) {
  const n0 = cross(A, B);
  const nl = Math.hypot(n0[0], n0[1], n0[2]);
  if (nl < 1e-9) return Math.acos(clamp(-1, 1, dot(P, A)));
  const n = [n0[0] / nl, n0[1] / nl, n0[2] / nl];
  const dPn = dot(P, n);
  const proj = [P[0] - dPn * n[0], P[1] - dPn * n[1], P[2] - dPn * n[2]];
  const pl = Math.hypot(proj[0], proj[1], proj[2]);
  if (pl < 1e-9) return Math.PI / 2;
  const Pp = [proj[0] / pl, proj[1] / pl, proj[2] / pl];
  const abAng = Math.acos(clamp(-1, 1, dot(A, B)));
  const aAng = Math.acos(clamp(-1, 1, dot(A, Pp)));
  const bAng = Math.acos(clamp(-1, 1, dot(B, Pp)));
  if (aAng <= abAng && bAng <= abAng) return Math.abs(Math.asin(clamp(-1, 1, dPn)));
  return Math.min(Math.acos(clamp(-1, 1, dot(P, A))), Math.acos(clamp(-1, 1, dot(P, B))));
}

// Percentile threshold t on `score` (length N) such that ~frac·N nodes have score > t. 64-bin histogram
// with within-bin linear interpolation — O(N), NO sort, order-independent (bin counts don't depend on
// node order). Used so tesseraFrac lands in-band regardless of how many ancient centers a seed drew.
function percentileThreshold(score, frac, N) {
  let minv = Infinity, maxv = -Infinity;
  for (let i = 0; i < N; i++) { const v = score[i]; if (v < minv) minv = v; if (v > maxv) maxv = v; }
  const span = (maxv - minv) || 1;
  const BINS = 64;
  const hist = new Int32Array(BINS);
  for (let i = 0; i < N; i++) { let b = Math.floor(((score[i] - minv) / span) * BINS); if (b >= BINS) b = BINS - 1; if (b < 0) b = 0; hist[b]++; }
  const target = Math.round(frac * N);
  let acc = 0, thrBin = 0;
  for (let b = BINS - 1; b >= 0; b--) { acc += hist[b]; if (acc >= target) { thrBin = b; break; } }
  const over = acc - target;
  const fracInBin = hist[thrBin] > 0 ? over / hist[thrBin] : 0;   // interpolate so ~target nodes remain above
  return minv + span * ((thrBin + fracInBin) / BINS);
}

/**
 * One-pass stagnant-lid (Venus) relief-field generator. WRITES carrier.height[i]=U[i] (REPLACE, the
 * sole low/mid source), carrier.grainAngle (tessera fold strike; 0 elsewhere), carrier.faultDensity
 * (deformation intensity). Leaves carrier.regime UNTOUCHED. RETURNS the diagnostics the structure
 * tests + the live stagnantLidProbe read (plumeCenters is load-bearing so predictors rebuild arm's-length).
 *
 * @param {object} carrier  F3 sphere carrier (makeSphereField): verts, adj, N, tangentFrameAt.
 * @param {object} drivers  accepted for signature parity with the writer family; NOT consumed (seed-only).
 * @param {object} opts      { macroSeed:int, regime:string, tune:object|null, randomPlacementControl:bool }.
 */
export function writeStagnantLidReliefSphere(
  carrier, drivers = {},
  { macroSeed = 0, regime = 'venus-stagnant-lid', tune = null, randomPlacementControl = false } = {},
) {
  void drivers; // seed-only (see @param)
  const T = tune ? { ...DEFAULTS, ...tune } : DEFAULTS;
  const {
    PLUME_MIN, PLUME_SPAN, PLUME_BELT, TESSERA_CENTER_FRAC, TESSERA_FRAC, WARP_FREQ, WARP_AMP,
    CORONA_POOL, CORONA_POOL_REF_N, CORONA_BIAS, CORONA_ACTIVE_FRAC, CORONA_CTRL_ACCEPT,
    CORONA_RC_MIN_NODES, CORONA_RC_SPAN_NODES, CORONA_SIZE_SKEW, CORONA_SUPPORT_ACTIVE, CORONA_SUPPORT_INACTIVE,
    A_DOME, A_TRENCH, A_RISE, A_DEP, A_RIM, BASE_TESSERA, BASE_PLAINS, BASE_RIFT,
    TESS_FOLD_AMP, TESS_RIBBON_AMP, FOLD_FREQ, RIBBON_FREQ, RIFT_HALFWIDTH_NODES,
    YOUNG_LOBE_GAIN, AGE_FREQ, DETAIL_FREQ, DETAIL_AMP, RELAX_PASSES: PASSES,
  } = T;
  const N = carrier.N;
  const verts = carrier.verts;
  const adj = carrier.adj;
  const seed = (macroSeed | 0);

  // STEP 0 — mean edge angle (parity/diag only; all widths below are DIRECT geodesic radians, so this is
  // not load-bearing here — kept for sibling-writer parity). (verbatim plates.js:212-217)
  let angSum = 0, angCnt = 0;
  for (let i = 0; i < N; i++) {
    const a = verts[i], nb = adj[i];
    for (let k = 0; k < nb.length; k++) { angSum += Math.acos(clamp(-1, 1, dot(a, verts[nb[k]]))); angCnt++; }
  }
  const meanEdgeAngle = angCnt ? angSum / angCnt : 0.1;

  // ── 1. seeded mantle-plume field (the organizing primitive) ────────────────────────────────────────
  const rngPlume = alea('stagnant:plumes:' + seed);
  const N_plume = PLUME_MIN + Math.floor(rngPlume() * PLUME_SPAN);
  const centers = [];
  for (let p = 0; p < N_plume; p++) centers.push(randDir(rngPlume)); // 2 draws each, fixed order

  const rngType = alea('stagnant:ptype:' + seed);
  const centerIsAncient = new Uint8Array(N_plume);
  for (let p = 0; p < N_plume; p++) centerIsAncient[p] = rngType() < TESSERA_CENTER_FRAC ? 1 : 0;
  // Guarantee ≥1 ancient AND ≥1 corona-forming center (deterministic, consumes no extra draws) so
  // plumeProxAncient is never all-zero and tessera always has a cap to sit on.
  let nAncient = 0; for (let p = 0; p < N_plume; p++) nAncient += centerIsAncient[p];
  if (nAncient === 0) { centerIsAncient[0] = 1; nAncient = 1; }
  else if (nAncient === N_plume) { centerIsAncient[N_plume - 1] = 0; nAncient = N_plume - 1; }

  const warp = createNoise3D(alea('stagnant:warp:' + seed));
  // Domain-warped nearest-center proximity (squared Gaussian) for an arbitrary unit dir. Returns the
  // ancient-only max (organizes TESSERA) and the all-center max (organizes CORONA acceptance + young age).
  const proxAt = (d) => {
    const wx = warp(d[0] * WARP_FREQ, d[1] * WARP_FREQ, d[2] * WARP_FREQ);
    const wy = warp(d[0] * WARP_FREQ + 19.1, d[1] * WARP_FREQ - 7.3, d[2] * WARP_FREQ + 3.7);
    const wz = warp(d[0] * WARP_FREQ - 5.2, d[1] * WARP_FREQ + 11.9, d[2] * WARP_FREQ - 2.4);
    const wd = norm([d[0] + WARP_AMP * wx, d[1] + WARP_AMP * wy, d[2] + WARP_AMP * wz]);
    let bestAnc = 0, bestAny = 0;
    for (let p = 0; p < N_plume; p++) {
      const c = centers[p];
      const a = Math.acos(clamp(-1, 1, wd[0] * c[0] + wd[1] * c[1] + wd[2] * c[2]));
      const g = Math.exp(-(a / PLUME_BELT) * (a / PLUME_BELT));
      if (centerIsAncient[p]) { if (g > bestAnc) bestAnc = g; }   // strict '>' (lowest index wins ties)
      if (g > bestAny) bestAny = g;
    }
    return { anc: bestAnc, any: bestAny };
  };

  const plumeProxAncient = new Float32Array(N);
  const plumeProx = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const px = proxAt(verts[i]);
    plumeProxAncient[i] = px.anc;
    plumeProx[i] = px.any;
  }

  // ── 2. tessera fabric: percentile-threshold the ancient-proximity field to the top TESSERA_FRAC ──────
  // Control (AC4): threshold an INDEPENDENT noise field instead → tessera scattered off the plume field.
  let tessScore = plumeProxAncient;
  if (randomPlacementControl) {
    const ctrlNoise = createNoise3D(alea('stagnant:ctrl-tess:' + seed));
    const s = new Float32Array(N);
    for (let i = 0; i < N; i++) { const d = verts[i]; s[i] = 0.5 + 0.5 * ctrlNoise(d[0] * 4, d[1] * 4, d[2] * 4); }
    tessScore = s;
  }
  const tessThresh = percentileThreshold(tessScore, TESSERA_FRAC, N);
  const isTessera = new Uint8Array(N);
  for (let i = 0; i < N; i++) isTessera[i] = tessScore[i] > tessThresh ? 1 : 0;

  // tessera double-fabric: foldAngle = strike of the radial-shortening axis (⊥ folds), from the tangent
  // gradient of plumeProxAncient. foldAngle pre-zeroed → carrier.grainAngle is 0 outside tessera.
  const foldAngle = new Float32Array(N);
  const tessTexture = new Float32Array(N);
  const tessNoiseF = createNoise3D(alea('stagnant:tessfold:' + seed));
  const tessNoiseR = createNoise3D(alea('stagnant:tessribbon:' + seed));
  for (let i = 0; i < N; i++) {
    if (!isTessera[i]) continue;
    const di = verts[i];
    const { east, north } = carrier.tangentFrameAt(i);
    let gE = 0, gN = 0;
    const nb = adj[i];
    for (let k = 0; k < nb.length; k++) {
      const j = nb[k];
      const df = plumeProxAncient[j] - plumeProxAncient[i];
      const t = [verts[j][0] - di[0], verts[j][1] - di[1], verts[j][2] - di[2]];
      gE += df * dot(t, east);
      gN += df * dot(t, north);
    }
    foldAngle[i] = Math.atan2(gN, gE); // atan2(0,0)=0 safe on a flat cap interior
    const fold = steeredNoise3(tessNoiseF, di, east, north, foldAngle[i] + Math.PI / 2, true, FOLD_FREQ);
    const ribbon = steeredNoise3(tessNoiseR, di, east, north, foldAngle[i], true, RIBBON_FREQ);
    tessTexture[i] = TESS_FOLD_AMP * (fold + 0.5) + TESS_RIBBON_AMP * (ribbon + 0.5); // both ≥0 lobes
  }

  // ── 3. coronae: field-biased candidate pool → active/inactive analytic radial profiles ───────────────
  const rngCor = alea('stagnant:corona:' + seed);
  const coronaCenters = [];
  const coronaRadiusArr = [];
  const coronaActiveArr = [];
  const coronaPool = Math.max(1, Math.round(CORONA_POOL * N / CORONA_POOL_REF_N)); // ∝ N ⇒ resolution-invariant coverage
  for (let k = 0; k < coronaPool; k++) {
    const site = randDir(rngCor);                     // 2 draws
    const acc = rngCor();                             // 1 draw (accept)
    const pAccept = randomPlacementControl ? CORONA_CTRL_ACCEPT : Math.pow(proxAt(site).any, CORONA_BIAS);
    if (acc < pAccept) {
      const u = rngCor();                             // 1 draw (radius) — only on accept
      const R_c = (CORONA_RC_MIN_NODES + Math.pow(u, CORONA_SIZE_SKEW) * CORONA_RC_SPAN_NODES) * meanEdgeAngle; // heavy-tailed, node-scaled
      const av = rngCor();                            // 1 draw (active) — only on accept
      coronaCenters.push(site);
      coronaRadiusArr.push(R_c);
      coronaActiveArr.push(av < CORONA_ACTIVE_FRAC ? 1 : 0);
    }
  }
  const coronaCount = coronaCenters.length;

  // radial profiles (ρ = geodesicDist/R_c). Active = dome + trench + outer rise; inactive = rim + interior
  // depression. All amplitudes < the base gaps ⇒ coronae never invert tessera>plains>rift.
  const coronaContrib = new Float32Array(N);
  const coronaCoverMask = new Uint8Array(N);
  for (let c = 0; c < coronaCount; c++) {
    const ctr = coronaCenters[c], Rc = coronaRadiusArr[c] || 1e-6, active = coronaActiveArr[c];
    const support = active ? CORONA_SUPPORT_ACTIVE : CORONA_SUPPORT_INACTIVE;
    for (let i = 0; i < N; i++) {
      const a = Math.acos(clamp(-1, 1, dot(verts[i], ctr)));
      const rho = a / Rc;
      if (rho > support) continue;
      coronaCoverMask[i] = 1;
      if (active) {
        const dome = A_DOME * Math.max(0, 1 - (rho / 0.75) * (rho / 0.75));
        const trench = A_TRENCH * Math.exp(-((rho - 0.95) / 0.12) * ((rho - 0.95) / 0.12));
        const rise = A_RISE * Math.exp(-((rho - 1.25) / 0.18) * ((rho - 1.25) / 0.18));
        coronaContrib[i] += dome - trench + rise;
      } else {
        const dep = A_DEP * Math.max(0, 1 - (rho / 0.85) * (rho / 0.85));
        const rim = A_RIM * Math.exp(-((rho - 0.95) / 0.10) * ((rho - 0.95) / 0.10));
        coronaContrib[i] += -dep + rim;
      }
    }
  }

  // ── 4. rift corridors: ANALYTIC point-to-arc between nearest center pairs (no BFS, no while-loop) ─────
  const inRift = new Uint8Array(N);
  const riftHalf = RIFT_HALFWIDTH_NODES * meanEdgeAngle;   // node-legible corridor half-width
  const segSeen = new Set();
  const segments = [];
  for (let p = 0; p < N_plume; p++) {
    let best = -Infinity, q = -1;
    for (let r = 0; r < N_plume; r++) {
      if (r === p) continue;
      const dd = dot(centers[p], centers[r]);
      if (dd > best) { best = dd; q = r; }
    }
    if (q >= 0) {
      const key = p < q ? p + ',' + q : q + ',' + p;
      if (!segSeen.has(key)) { segSeen.add(key); segments.push([p, q]); }
    }
  }
  for (let i = 0; i < N; i++) {
    for (let sg = 0; sg < segments.length; sg++) {
      if (geodesicPointToArc(verts[i], centers[segments[sg][0]], centers[segments[sg][1]]) < riftHalf) { inRift[i] = 1; break; }
    }
  }

  // ── 5. resurfacing-age datum (DIAGNOSTICS ONLY — no carrier channel in 4b) ────────────────────────────
  const ageNoise = createNoise3D(alea('stagnant:age:' + seed));
  const resurfAge = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const d = verts[i];
    const an = ageNoise(d[0] * AGE_FREQ, d[1] * AGE_FREQ, d[2] * AGE_FREQ);
    if (isTessera[i]) resurfAge[i] = clamp01(0.90 + 0.10 * an);                         // OLDEST
    else if (coronaCoverMask[i] || inRift[i]) resurfAge[i] = clamp01(0.10 + 0.15 * an); // YOUNGEST
    else resurfAge[i] = clamp01(0.50 - YOUNG_LOBE_GAIN * plumeProx[i] + 0.12 * an);     // regional plains, younger toward plumes
  }

  // ── 6. assembly: U = ordered base + tessera texture + corona lobes + sub-grid detail ─────────────────
  const detailNoise = createNoise3D(alea('stagnant:detail:' + seed));
  const U = new Float32Array(N);
  const deformIntensity = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const base = isTessera[i] ? BASE_TESSERA : (inRift[i] ? BASE_RIFT : BASE_PLAINS);
    const tex = isTessera[i] ? tessTexture[i] : 0;
    const cor = coronaContrib[i];
    const d = verts[i];
    const det = DETAIL_AMP * detailNoise(d[0] * DETAIL_FREQ, d[1] * DETAIL_FREQ, d[2] * DETAIL_FREQ);
    U[i] = base + tex + cor + det;
    deformIntensity[i] = clamp01(Math.abs(tex) + Math.abs(cor));
  }

  // ── bounded gen-time relaxation (render-once): fixed PASSES Jacobi smooth over carrier.adj ────────────
  // (verbatim plates.js:354-363) — a convex combination; cannot expand the bound. Double-buffered.
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

  // ── write carrier: height REPLACE (sole low/mid source), grain strike, fault (deformation) intensity ──
  carrier.height.set(U);
  carrier.grainAngle.set(foldAngle);                                    // 0 outside tessera (pre-zeroed)
  for (let i = 0; i < N; i++) carrier.faultDensity[i] = clamp01(deformIntensity[i]);
  // carrier.regime is LEFT UNTOUCHED (verify.js asserts ∈ {0,1,2}; no 4th regime constant).

  // ── diagnostics + areal fractions ────────────────────────────────────────────────────────────────────
  let tessCount = 0, plainsCount = 0, activeCount = 0;
  for (let i = 0; i < N; i++) {
    if (isTessera[i]) tessCount++;
    else if (!inRift[i] && !coronaCoverMask[i]) plainsCount++;
  }
  for (let c = 0; c < coronaCount; c++) activeCount += coronaActiveArr[c];
  const tesseraFrac = tessCount / N;
  const plainsFrac = plainsCount / N;
  const activeFrac = coronaCount ? activeCount / coronaCount : 0;

  return {
    U, regime,
    plumeCenters: centers, centerIsAncient, plumeCount: N_plume, PLUME_BELT,
    isTessera, tesseraFrac,
    coronaCenters, coronaRadius: Float32Array.from(coronaRadiusArr), coronaActive: Uint8Array.from(coronaActiveArr),
    coronaContrib, coronaCoverMask, coronaCount, activeFrac,
    inRift, plainsFrac,
    resurfAge, deformIntensity, foldAngle,
    meanEdgeAngle, relaxPasses: PASSES,
  };
}
