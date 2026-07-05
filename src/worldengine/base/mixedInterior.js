// src/worldengine/base/mixedInterior.js
//
// World Engine V2-2b-2a — the MIXED-INTERIOR COMPOSER (the program's first genuinely novel generative
// primitive). A three-free, deterministic module that fills the 'mixed' branch of the V2-2a lid-response
// router: on ONE body it grows SHIELDS where strong upwelling centers pierce the lid and CORONAE / TESSERA
// where they merely tent it, floods the lows to a preserved basaltic-plains datum, and cuts analytic rift
// corridors between neighbouring centers — all organized about ONE seeded center field, never carrier
// latitude. It is NOT a call into the corner writers (magmatism / stagnant-lid): the expression kernels are
// mirrored (copied verbatim below), and the composition — the per-center pierce boolean + the disjoint
// province precedence + the absolute-datum province stack with a NUMERIC edifice-budget bound — is new.
//
// THREE-FREE BY CONSTRUCTION: imports ONLY alea + simplex-noise + the pure scalar helpers in mathutil.js.
// It NEVER imports the router (importing its family map would be a circular import) nor the E1 source
// module; it reads the RESOLVED E1 coordinate tuple straight off its argument (L, the compressed vigor Φ,
// the center count n) and re-derives nothing. It reads NO preset name and no morphology name of any kind.
//
// DETERMINISM HARD-RULE: every draw is seeded via alea(seedString) in the DISJOINT 'lid:' namespace, keyed
// off the integer macroSeed, in a FIXED draw order. NO Math.random / NO Date.now. carrier.regime is left
// UNTOUCHED (no 4th regime constant). Same (E1 coordinate, macroSeed) ⇒ byte-identical carrier.height +
// primitiveId + centerId + diag arrays on repeat builds. The five 'lid:' streams (all prefix-disjoint from
// 'magma:'/'stagnant:'/'plates:'/'shell:'/'e1:'):
//   • 'lid:centers:'  — the n center directions (count taken from e1.n, never re-derived).
//   • 'lid:strength:' — per-center strength_p (one draw / center, center-index order).
//   • 'lid:yield:'    — per-center yield spread y_p (one draw / center, center-index order).
//   • 'lid:type:'     — per-center TENT ancient/corona split + corona active/inactive selector.
//   • 'lid:texture:'  — the domain-warp / detail / tessera fold+ribbon noise fields.

import alea from 'alea';
import { createNoise3D } from 'simplex-noise';
import { clamp, clamp01 } from './mathutil.js';

// ── LOCKED tunables (first-cut, UAT-tunable; the ACs assert SIGN + the gate-calibrated counts, not a frozen
//    gain). The composer takes no override in Slice A production; `tune` merges over these for the tests. ──
export const MIXED_DEFAULTS = Object.freeze({
  // center field + broad structure
  BELT: 0.35,                 // GEODESIC squared-Gaussian belt half-width (rad): prox = exp(-(a/BELT)^2)
  WARP_FREQ: 1.5, WARP_AMP: 0.20,   // domain-warp of the province Voronoi walls (irregular, not great-circle)
  DETAIL_FREQ: 7.0, DETAIL_AMP: 0.02,  // small isotropic sub-grid texture (<< the ordering margins)
  // per-center pierce boolean (gate-2 localYield form) — the anti-mush lynchpin
  STR_LO: 0.30, SPREAD: 0.30, Y0: 0.001759, Y_K: 8.78,   // gate-2:32-33 (first-cut UAT-tunable)
  // absolute-datum province stack + NUMERIC edifice-budget bound (the §2.4 D1-MF1 fix)
  BASE_TESSERA: 0.70, BASE_PLAINS: 0.10, BASE_RIFT: -0.45,   // floor gaps 0.60 / 0.55
  MIN_FLOOR_GAP: 0.55,        // = min(tessera-plains, plains-rift); the positive within-province stack stays < this
  EDIFICE_BUDGET: 0.40, AMP_LO: 0.40,   // A_e = EDIFICE_BUDGET*(AMP_LO+(1-AMP_LO)*strength_p) ∈ [0.232,0.40]
  SWELL_BUDGET: 0.10,         // swell = SWELL_BUDGET * proximity (broad dynamic-topography dome on the plains datum)
  // shield / caldera kernel (mirror magmatism F7)
  EDIFICE_RADIUS_MIN: 0.10, EDIFICE_RADIUS_SPAN: 0.16,   // per-center angular edifice radius ∈ [0.10,0.26] rad
  SHIELD_P: 2.0,              // shield exponent (broad, low-aspect basaltic shield)
  CALDERA_FRAC: 0.15,         // summit-caldera normalized radius (F7: caldera(r)=0.5((r/c)^2-1), r<c)
  // tessera fabric (mirror stagnant)
  TESSERA_CENTER_FRAC: 0.4,   // per-TENT-center draw: ancient (tessera-forming) vs corona-forming
  TESSERA_FRAC: 0.075,        // target tessera areal fraction (percentile threshold on ancient-proximity)
  TESS_FOLD_AMP: 0.16, TESS_RIBBON_AMP: 0.08, FOLD_FREQ: 5, RIBBON_FREQ: 13,   // Σ 0.24 < 0.60 gap
  // corona radial profiles (mirror stagnant)
  CORONA_ACTIVE_FRAC: 0.65,   // active:inactive morphology selector
  CORONA_RC_NODES: 2.5,       // corona radius as a multiple of meanEdgeAngle (node-legible at any mesh)
  CORONA_SUPPORT_ACTIVE: 1.6, CORONA_SUPPORT_INACTIVE: 1.3,   // support cutoff ρ = geodesicDist/R_c
  A_DOME: 0.35, A_TRENCH: 0.30, A_RISE: 0.12, A_DEP: 0.18, A_RIM: 0.22,   // < the base gaps
  // rift corridors (mirror stagnant analytic point-to-arc)
  RIFT_HALFWIDTH_NODES: 2.5,  // corridor half-width as a multiple of meanEdgeAngle
  // bounded WITHIN-PROVINCE relaxation (render-once; NO cross-province relax — MF3)
  RELAX_PASSES: 3,
});

// The multi-valued primitiveId enum values the composer emits (a private copy — the router owns the exported
// PRIMITIVE_ID schema; duplicating the four ids the composer paints keeps it router-import-free, MF2).
// PIERCE family: shield 1, caldera 2. TENT family: corona 5, tessera 6, rift 7, stagnant-basaltic-plain 8.
const ID_SHIELD = 1, ID_CALDERA = 2, ID_CORONA = 5, ID_TESSERA = 6, ID_RIFT = 7, ID_PLAIN = 8;

// generous |height| guard, mirror of the corners' MAGMA_BOUND / STAGNANT_BOUND
export const MIXED_BOUND = 4;

// ── tiny vec3 helpers on plain [x,y,z] arrays (three-free; verbatim from magmatism.js:133-135) ────────────
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function norm(a) { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }

// Deterministic uniform point on the unit sphere from an alea rng (z=2u-1, azimuth 2πv). 2 draws/call;
// draw-order is load-bearing for byte-identity. (verbatim from magmatism.js:137-142 / stagnantLid.js:172-177)
function randDir(rng) {
  const z = 2 * rng() - 1;
  const t = 2 * Math.PI * rng();
  const r = Math.sqrt(Math.max(0, 1 - z * z));
  return [r * Math.cos(t), r * Math.sin(t), z];
}

// Anisotropic ridged noise steered along a strike axis. COPIED VERBATIM from stagnantLid.js:183-202.
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

// Analytic geodesic distance (radians) from unit point P to the great-circle ARC A→B. COPIED VERBATIM from
// stagnantLid.js:207-222. No BFS, no while-loop.
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

// Percentile threshold t on `score` such that ~frac·N nodes have score > t. 64-bin histogram, O(N), NO sort,
// order-independent. COPIED VERBATIM from stagnantLid.js:227-240.
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
  const fracInBin = hist[thrBin] > 0 ? over / hist[thrBin] : 0;
  return minv + span * ((thrBin + fracInBin) / BINS);
}

/**
 * writeMixedInteriorSphere — the mixed-interior composer. WRITES carrier.height[i]=U[i] (REPLACE) and RETURNS
 * the multi-valued primitiveId, the per-node centerId, and a scalar/array diag bundle the ACs + the probe read.
 *
 * @param {object} carrier  F3 sphere carrier (makeSphereField output): verts, adj, N, tangentFrameAt. height
 *                          is REPLACED via .set(U). carrier.regime is left UNTOUCHED.
 * @param {object} opts
 * @param {{L:number, Φ:number, n:number}} opts.e1  the RESOLVED E1 coordinate tuple (L, compressed vigor Φ,
 *                          center count n) — read straight off, re-derived from nothing.
 * @param {number} [opts.rawTidal=0]   accepted for signature parity with the router seam; not consumed here.
 * @param {number} [opts.macroSeed=0]  the body's deterministic integer seed.
 * @param {object|null} [opts.tune=null]  headless-test DEFAULTS override.
 * @param {((mesh:object, primitiveId:Int32Array)=>{Pi:number,M:number,legibleByFamily:object})|null} [opts.interpen=null]
 *        the Π=C·F instrument, INJECTED (never imported — MF2). When a function, its {Pi, M, legibleByFamily}
 *        are stashed in mixedDiag; when null the composer emits no interpenetration diagnostics.
 * @returns {{U:Float32Array, primitiveId:Int32Array, centerId:Int32Array, mixedDiag:object}}
 */
export function writeMixedInteriorSphere(carrier, { e1, rawTidal = 0, macroSeed = 0, tune = null, interpen = null } = {}) {
  void rawTidal;   // accepted for router-seam parity; the classification already placed the body in 'mixed'
  const T = tune ? { ...MIXED_DEFAULTS, ...tune } : MIXED_DEFAULTS;
  const N = carrier.N, verts = carrier.verts, adj = carrier.adj;
  const seed = (macroSeed | 0);
  const L = e1.L, PHI = e1.Φ, n = Math.max(1, e1.n | 0);   // count from e1.n (never re-derived)

  // ── STEP 0 — mean edge angle (geodesic radians per hop): converts node-count radii to a resolution-
  //    independent GEODESIC width (verbatim plates/magma/stagnant). ────────────────────────────────────────
  let angSum = 0, angCnt = 0;
  for (let i = 0; i < N; i++) {
    const a = verts[i], nb = adj[i];
    for (let k = 0; k < nb.length; k++) { angSum += Math.acos(clamp(-1, 1, dot(a, verts[nb[k]]))); angCnt++; }
  }
  const meanEdgeAngle = angCnt ? angSum / angCnt : 0.1;

  // ── STEP 1 — seed n center directions ('lid:centers:'); the count is e1.n, NOT re-derived (G1) ───────────
  const rngCenters = alea('lid:centers:' + seed);
  const centers = [];
  for (let k = 0; k < n; k++) centers.push(randDir(rngCenters));   // 2 draws each, fixed order

  // ── STEP 2 — per-center pierce boolean (gate-2 localYield form) — SHARP, deterministic, no random tag ────
  const rngStrength = alea('lid:strength:' + seed);
  const rngYield = alea('lid:yield:' + seed);
  const strength = new Float32Array(n);
  const yspread = new Float32Array(n);   // the raw y_p draws (published so AC-PIERCE recomputes arm's-length)
  const pierce = new Uint8Array(n);
  const Ybase = T.Y0 * Math.exp(T.Y_K * L);                        // Ybase(L) = Y0·exp(Y_K·L), gate-2:22
  for (let p = 0; p < n; p++) strength[p] = T.STR_LO + (1 - T.STR_LO) * rngStrength();   // one draw/center, index order
  for (let p = 0; p < n; p++) {
    const y = rngYield();                                          // one draw/center, index order
    yspread[p] = y;
    const localYield = Ybase * (1 + T.SPREAD * (2 * y - 1));       // gate-2:20-21
    pierce[p] = (strength[p] * PHI > localYield) ? 1 : 0;          // SHARP boolean (gate-2 / designDecision #3)
  }

  // ── STEP 3 — per-center type: PIERCE grows a shield; un-pierced (TENT) splits ancient(tessera)/corona ────
  const rngType = alea('lid:type:' + seed);
  const isAncient = new Uint8Array(n);      // meaningful only for TENT centers
  const coronaActive = new Uint8Array(n);   // meaningful only for TENT corona centers
  for (let p = 0; p < n; p++) {             // two draws/center in fixed order (independent of the pierce outcome)
    isAncient[p] = rngType() < T.TESSERA_CENTER_FRAC ? 1 : 0;
    coronaActive[p] = rngType() < T.CORONA_ACTIVE_FRAC ? 1 : 0;
  }
  // ≥1-ancient guarantee (SF2, mirror stagnantLid.js:289-293; consumes no extra draws): if there is ≥1 TENT
  // center but none is ancient, promote the first TENT center — so tessera is present when the coordinate
  // warrants ancient centers, keeping mean(tessera) well-defined where the sweep expects it.
  let firstTent = -1, nAncientTent = 0;
  for (let p = 0; p < n; p++) { if (!pierce[p]) { if (firstTent < 0) firstTent = p; if (isAncient[p]) nAncientTent++; } }
  if (firstTent >= 0 && nAncientTent === 0) { isAncient[firstTent] = 1; }

  // per-center shield amplitude + radius (deterministic from strength_p — no extra stream). A_e is the
  // budget-bounded peak amplitude; Psi_e the angular edifice radius. (mirror magma A_e/Psi_e; NOT magma's
  // native unbounded EDIFICE_HEIGHT=1.0 — the previous unbounded-magma mush, N1/B-4.)
  const A_e = new Float32Array(n);
  const Psi_e = new Float32Array(n);
  for (let p = 0; p < n; p++) {
    A_e[p] = T.EDIFICE_BUDGET * (T.AMP_LO + (1 - T.AMP_LO) * strength[p]);                 // ∈ [0.232, 0.40]
    const sFrac = clamp01((strength[p] - T.STR_LO) / (1 - T.STR_LO));                       // ∈ [0,1]
    Psi_e[p] = T.EDIFICE_RADIUS_MIN + sFrac * T.EDIFICE_RADIUS_SPAN;                        // ∈ [0.10, 0.26] rad
  }

  // ── STEP 4 — noise fields (one 'lid:texture:' stream feeds every noise, in fixed creation order) ─────────
  const rngTex = alea('lid:texture:' + seed);
  const warpNoise = createNoise3D(rngTex);
  const detailNoise = createNoise3D(rngTex);
  const tessFoldNoise = createNoise3D(rngTex);
  const tessRibbonNoise = createNoise3D(rngTex);

  // ── STEP 5 — per-node fields: warped Voronoi centerId, squared-Gaussian proximity (all / ancient centers),
  //    nearest-pierce-center normalized radius r. All O(N·n), no BFS. ───────────────────────────────────────
  const centerId = new Int32Array(N);
  const prox = new Float32Array(N);          // proximity to the nearest center (any type) → swell + structure
  const proxAncient = new Float32Array(N);   // proximity to the nearest ANCIENT center → tessera placement
  const pierceR = new Float32Array(N);       // normalized radius to the nearest PIERCE center (Infinity if none)
  const pierceOwner = new Int32Array(N).fill(-1);
  const hasAncient = isAncient.some((v, p) => v && !pierce[p]);
  const belt = T.BELT;
  for (let i = 0; i < N; i++) {
    const d = verts[i];
    // domain-warp for the Voronoi walls (irregular province margins, verbatim magma/stagnant warp pattern)
    const wx = warpNoise(d[0] * T.WARP_FREQ, d[1] * T.WARP_FREQ, d[2] * T.WARP_FREQ);
    const wy = warpNoise(d[0] * T.WARP_FREQ + 19.1, d[1] * T.WARP_FREQ - 7.3, d[2] * T.WARP_FREQ + 3.7);
    const wz = warpNoise(d[0] * T.WARP_FREQ - 5.2, d[1] * T.WARP_FREQ + 11.9, d[2] * T.WARP_FREQ - 2.4);
    const wd = norm([d[0] + T.WARP_AMP * wx, d[1] + T.WARP_AMP * wy, d[2] + T.WARP_AMP * wz]);
    let best = 0, bestDot = -Infinity;
    let bestAny = 0, bestAnc = 0;
    let bestPierce = Infinity, bestPierceOwner = -1;
    for (let p = 0; p < n; p++) {
      const c = centers[p];
      const dd = wd[0] * c[0] + wd[1] * c[1] + wd[2] * c[2];
      if (dd > bestDot) { bestDot = dd; best = p; }   // strict '>' (lowest-index tie-break)
      const a = Math.acos(clamp(-1, 1, dot(d, c)));    // UNWARPED angular distance to the center direction
      const g = Math.exp(-(a / belt) * (a / belt));    // squared-Gaussian proximity
      if (g > bestAny) bestAny = g;
      if (isAncient[p] && !pierce[p] && g > bestAnc) bestAnc = g;
      if (pierce[p]) { const r = a / Psi_e[p]; if (r < bestPierce) { bestPierce = r; bestPierceOwner = p; } }
    }
    centerId[i] = best;
    prox[i] = bestAny;
    proxAncient[i] = bestAnc;
    pierceR[i] = bestPierce;
    pierceOwner[i] = bestPierceOwner;
  }

  // ── STEP 6 — tessera mask: percentile-threshold the ancient-proximity field to the top TESSERA_FRAC ──────
  const isTessera = new Uint8Array(N);
  if (hasAncient) {
    const thr = percentileThreshold(proxAncient, T.TESSERA_FRAC, N);
    for (let i = 0; i < N; i++) isTessera[i] = proxAncient[i] > thr ? 1 : 0;
  }

  // ── STEP 7 — corona coverage + contribution (analytic radial profiles around corona-type TENT centers) ──
  const coronaCover = new Uint8Array(N);
  const coronaContrib = new Float32Array(N);
  const Rc = T.CORONA_RC_NODES * meanEdgeAngle;
  for (let p = 0; p < n; p++) {
    if (pierce[p] || isAncient[p]) continue;   // corona only on un-pierced, non-ancient (corona-type) centers
    const ctr = centers[p], active = coronaActive[p];
    const support = active ? T.CORONA_SUPPORT_ACTIVE : T.CORONA_SUPPORT_INACTIVE;
    for (let i = 0; i < N; i++) {
      const rho = Math.acos(clamp(-1, 1, dot(verts[i], ctr))) / Rc;
      if (rho > support) continue;
      coronaCover[i] = 1;
      if (active) {
        const dome = T.A_DOME * Math.max(0, 1 - (rho / 0.75) * (rho / 0.75));
        const trench = T.A_TRENCH * Math.exp(-((rho - 0.95) / 0.12) * ((rho - 0.95) / 0.12));
        const rise = T.A_RISE * Math.exp(-((rho - 1.25) / 0.18) * ((rho - 1.25) / 0.18));
        coronaContrib[i] += dome - trench + rise;
      } else {
        const dep = T.A_DEP * Math.max(0, 1 - (rho / 0.85) * (rho / 0.85));
        const rim = T.A_RIM * Math.exp(-((rho - 0.95) / 0.10) * ((rho - 0.95) / 0.10));
        coronaContrib[i] += -dep + rim;
      }
    }
  }

  // ── STEP 8 — rift corridors: analytic point-to-arc between nearest center pairs (verbatim stagnant) ──────
  const inRift = new Uint8Array(N);
  const riftHalf = T.RIFT_HALFWIDTH_NODES * meanEdgeAngle;
  const segSeen = new Set();
  const segments = [];
  for (let p = 0; p < n; p++) {
    let best = -Infinity, q = -1;
    for (let r = 0; r < n; r++) {
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

  // ── STEP 9 — DISJOINT-PRECEDENCE province resolve (edifice > tessera/corona > rift > plains), per node,
  //    BEFORE height synthesis (SF3). Then the ABSOLUTE-DATUM stack: edifices add ONLY on the plains datum;
  //    the positive within-province stack stays strictly < MIN_FLOOR_GAP (magma edifices bounded, N1/B-4). ──
  const primitiveId = new Int32Array(N);
  const U = new Float32Array(N);
  const c_cal = T.CALDERA_FRAC;
  const guard = MIXED_BOUND - 1e-3;
  for (let i = 0; i < N; i++) {
    const d = verts[i];
    const det = T.DETAIL_AMP * detailNoise(d[0] * T.DETAIL_FREQ, d[1] * T.DETAIL_FREQ, d[2] * T.DETAIL_FREQ);
    const swell = T.SWELL_BUDGET * prox[i];
    let id, h;
    if (pierceR[i] < 1) {
      // EDIFICE (a pierce center's shield disc) — on the PLAINS datum only (SF3). F7 shield + summit caldera.
      const p = pierceOwner[i];
      const r = pierceR[i];
      let shape = Math.pow(1 - r, T.SHIELD_P);
      if (r < c_cal) { const s = r / c_cal; shape += 0.5 * (s * s - 1); }   // summit caldera bowl
      const edifice = A_e[p] * shape;
      id = (r < c_cal) ? ID_CALDERA : ID_SHIELD;
      h = T.BASE_PLAINS + swell + edifice;
    } else if (isTessera[i]) {
      // TESSERA plateau on the tessera datum + orthogonal fold+ribbon fabric (bounded < the tessera-plains gap)
      const { east, north } = carrier.tangentFrameAt(i);
      const fold = steeredNoise3(tessFoldNoise, d, east, north, Math.PI / 2, true, T.FOLD_FREQ);
      const ribbon = steeredNoise3(tessRibbonNoise, d, east, north, 0, true, T.RIBBON_FREQ);
      const tex = T.TESS_FOLD_AMP * (fold + 0.5) + T.TESS_RIBBON_AMP * (ribbon + 0.5);   // both ≥0 lobes
      id = ID_TESSERA;
      h = T.BASE_TESSERA + tex;
    } else if (coronaCover[i]) {
      // CORONA on the plains datum + its analytic radial lobe (amplitudes < the base gaps)
      id = ID_CORONA;
      h = T.BASE_PLAINS + coronaContrib[i];
    } else if (inRift[i]) {
      // RIFT corridor low
      id = ID_RIFT;
      h = T.BASE_RIFT + det;
    } else {
      // preserved basaltic PLAINS (the old flat ground) + the broad swell + detail
      id = ID_PLAIN;
      h = T.BASE_PLAINS + swell + det;
    }
    primitiveId[i] = id;
    U[i] = clamp(-guard, guard, h);
  }

  // ── STEP 10 — bounded WITHIN-PROVINCE relaxation (render-once). NO global cross-province relax (MF3): the
  //    Jacobi average is taken over SAME-primitiveId neighbours only, so province boundaries stay SHARP and
  //    every interior node's height stays a single kernel — the smeared-boundary mush is impossible. ────────
  const buf = new Float32Array(N);
  for (let pass = 0; pass < T.RELAX_PASSES; pass++) {
    for (let i = 0; i < N; i++) {
      let s = U[i], k = 1;
      const nb = adj[i], id = primitiveId[i];
      for (let j = 0; j < nb.length; j++) { const m = nb[j]; if (primitiveId[m] === id) { s += U[m]; k++; } }
      buf[i] = U[i] * 0.5 + (s / k) * 0.5;
    }
    U.set(buf);
  }

  // ── write carrier: height REPLACE (sole low/mid source). carrier.regime LEFT UNTOUCHED (no 4th constant). ─
  carrier.height.set(U);
  for (let i = 0; i < N; i++) carrier.faultDensity[i] = clamp01(prox[i]);   // parity bookkeeping (activity proxy)

  // per-center primitive-family diagnostics (published so the ACs read the composition arm's-length)
  const centerPierceCount = pierce.reduce((a, v) => a + v, 0);
  const mixedDiag = {
    beltScale: belt,
    strength, yield: yspread, pierce, centers,
    isAncient, coronaActive,
    A_e, Psi_e,
    n, pierceCount: centerPierceCount, meanEdgeAngle,
    Ybase, L, Φ: PHI,
    relaxPasses: T.RELAX_PASSES,
  };

  // ── Π=C·F interpenetration statistic — stashed when the caller INJECTS the instrument (MF2 one-way rule:
  //    the composer must not IMPORT interpenetration.js, since that module imports the router's familyOf and
  //    an import here would close the router↔composer↔statistic cycle. The router/lab pass it by injection).
  //    interpenetration() reads only primitiveId + the mesh {verts, adj} — never carrier.height. ────────────
  if (typeof interpen === 'function') {
    const ip = interpen(carrier, primitiveId);
    mixedDiag.Pi = ip.Pi;
    mixedDiag.M = ip.M;
    mixedDiag.legibleByFamily = ip.legibleByFamily;
  }
  return { U, primitiveId, centerId, mixedDiag };
}
