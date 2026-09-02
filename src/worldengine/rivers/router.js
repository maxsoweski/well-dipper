// src/worldengine/rivers/router.js
// THE GPU-FREE RIVER ROUTER CORE — moved here from planet-lod-rivers.js lines 65–114, 154–312,
// 571–583 and 593–791 (at `3dded82`) on 2026-09-02.
//
// FUNCTION: the drainage solve, and the pure per-node fields it routes over. `routeAndOrder` is the
// priority-flood → flat-resolve → D-∞ receiver → Horton–Strahler pipeline that turns a height field on
// an irregular sphere mesh into a real dendritic network (receiver/accum/order/isChannel + the AC5
// network-validity metrics). Around it: `DEFAULT_PARAMS` (the one parameter block every consumer
// starts from), `computeOcean` (the ocean mask from the solved level set), `computeAdjGradient` (the
// per-node tangent-plane finite-difference gradient the height cube packs into its GBA),
// `compositeMargins` (+ `IDENTITY_BUDGET`, the shelf/crater own-channel composite with the Inc-3b
// RMS-preserving budget solve), and the width law `widthRadiusFactor` / `widthSeedFactor` /
// `paramsForRadius`.
//
// INTENT: the GAME must get its rivers from the LAB's router — "REPLACE, not graft" (Max, 2026-07-31),
// and "we can't shoestring everything together" (2026-08-26). Everything here is pure JS over typed
// arrays with no renderer, no RTT and no GPU, so it is exactly the half of planet-lod-rivers.js the
// game's bake worker can run — and nothing under src/ could reach it while it lived in the 108 KB root
// module the boundary fence keeps out (tests/src-boundary-fence.test.js). Moved byte-verbatim, the same
// shape as the dispatch move (df6818c) and the mesh move (77fff7f/2026-09-01): planet-lod-rivers.js
// imports it back and re-exports it, so world-engine-lab.html and every existing suite keep their
// import path unchanged.
//
// WHY `rivers/` UNDER `src/worldengine/` AND NOT `src/rendering/bake/`. Carried C25 — "needs a
// renderer" vs "does not" — is the layer rule. Nothing in this file touches a renderer: THREE is used
// for `Vector3` arithmetic inside routeAndOrder only, the same three-coupled-but-GPU-free position
// mesh/sphereMesh.js holds. `createHeightSampler` (an RTT readback) and the cube bakers DO need a
// renderer and therefore stay out of here. Not `base/` because base/ WRITERS take a carrier and never
// build a graph over it, and the base suite records base/ as three-free.
//
// DELIBERATE NON-GOALS: no RNG (one-pipeline-fence registration 5 — the only entropy is the integer
// `seed` widthSeedFactor hashes); no Date.now; no renderer, no RTT, no cube bake, no geometry (the
// ribbon/valley builders are ribbon.js, the sea-level solve is seaLevel.js); no resolution or
// wet/dry policy — the caller supplies params, seaLevel and precipWeight.
//
// ⛔ BYTE-VERBATIM BELOW THIS LINE. Every line below is the identical text from planet-lod-rivers.js
// at `3dded82`; only the `three` import above it is new (it was already a bare specifier there).
import * as THREE from 'three';

// ───────────────────────── Defaults (from rivers-terrain-lab.main.js) ─────────────────────
export const DEFAULT_PARAMS = Object.freeze({
  TARGET_N: 40000,
  LLOYD_ITERS: 4,
  CHANNEL_ORDER: 2,
  MIN_ORDER: 2,
  WIDTH_PHI: 0.42, WIDTH_EXP: 0.69, WIDTH_SCALE: 0.000275, WIDTH_MIN: 0.00045, WIDTH_MAX: 0.009,
  CHAIKIN_ITERS: 3,
  FLAT_RESOLVE: true,
  DINF_ROUTE: true,
  CHANNEL_FRAC: 0.06,
  LIFT: 0.999,   // seat the water just BELOW the mean surface so it sits in the channel (was 1.0035 = floating)
  // ── width law halved 2026-06-19 (pre-LOD "less cartoonish" baseline) ──
  // WIDTH_SCALE/MIN/MAX were multiplied by 0.5 (shape/ratio/seed logic unchanged). Geomorphically
  // realistic thinness (rivers ~10km ≈ 0.0016 of radius, vs this ~0.009 widest trunk still ~5× wide)
  // awaits the deferred view-dependent river-LOD workstream: below ~0.4× the fixed 40k global
  // drainage network self-erases at orbit distance (nothing finer to fall back on).
  // ── AC6 radius-coupling (Theme-B scale system) ──
  // The width fields above are calibrated at the REFERENCE radius. River width is a real-km
  // footprint; on a unit sphere it occupies a fraction ∝ 1/radiusEarth (the inverse of
  // featureFrequencyFromKm). So WIDTH_SCALE/MIN/MAX scale by refRadius/radiusEarth, clamped so a
  // giant world's rivers don't vanish and a tiny world's don't bloat. (Mesh-resolution scaling is
  // deliberately NOT done here — a single 40k global mesh can't resolve a big world's thread-thin
  // rivers; that's the deferred view-dependent LOD workstream. AC6 is macro PROPORTIONING only.)
  REF_RADIUS_EARTH: 1.0,
  WIDTH_RADIUS_FLOOR: 0.08, WIDTH_RADIUS_CEIL: 2.5,   // UAT item1: lowered 0.2→0.08 so big worlds' rivers can thin to ~true 1/radius instead of clamping
  // UAT item1 (per-planet seeded width): the planet seed draws a width-scale multiplier in this
  // band so river scale varies planet-to-planet ("can go smaller depending on seed"). Applied to
  // WIDTH_SCALE/MIN/MAX only (topology stays seed-invariant). Identity-safe: widthSeed omitted ⇒
  // multiplier 1 ⇒ params unchanged (the router lab stays byte-for-byte).
  WIDTH_SEED_LO: 0.6, WIDTH_SEED_HI: 1.5,
  // ── carve (river→valley incision) ──
  VALLEY_WIDTH_MUL: 4.0,   // valley footprint = water width × this (the V is wider than the water)
  VALLEY_DEPTH_LO: 0.45, VALLEY_DEPTH_HI: 1.0,   // center depth (0..1) lerped by stream order; cube map stores this
  // ── WS4 T10 stream-power incision law (perNodeIncision) ──
  // Δ = -K·A^m·S^n is the DEFAULT carve-depth law (Max decision #1, 2026-06-25): channel-node incision
  // scales with drainage area A (accum) and local downslope gradient S, NOT the legacy order-only tent.
  // The RAW K·A^m·S^n magnitudes are NORMALIZED across channel nodes into [VALLEY_DEPTH_LO..HI] (the
  // HalfFloat carve-cube band, range guard §D5b), so K is an overall gain that cancels under
  // normalization — m/n set the SHAPE (relative depth of big-A/steep channels vs small ones). Keep them
  // named so A/B tuning is a param change, not an edit. params.LEGACY_DEPTH=true falls back to the old
  // Strahler tent (depthAt) for A/B; default = stream-power (the tent is the FLAG, not the default).
  CARVE_K: 1.0, CARVE_M: 0.5, CARVE_N: 1.0,
  CARVE_CUBE_SIZE: 1024,
  // WS4 T8: the grain cube is a WHOLE-SPHERE direction field (one strike per node), not sparse valley
  // strips, so it tolerates a much smaller cube than the carve cube — 256 keeps the bake cheap (it
  // re-bakes once per (preset,seed,sea), same cadence as the carve). Documented tunable per intent.
  GRAIN_CUBE_SIZE: 256,
  TARGET_OCEAN_FRACTION: 0.35,   // AC3: solve uSeaLevel to this fraction (band 0.25–0.45)
});

// ── computeAdjGradient(carrier) — per-node tangent-plane finite-difference gradient (Phase B.3) ──
// SHADING-ONLY (the router does NOT use this for routing — routeAndOrder derives its own surf-gradient
// from node-to-node drops; Map 04 §10). Packed into the height cube's GBA so perturbAnalytic can bend
// the normal. Returns Float32Array(N*3): the world-space surface gradient ∇h at each node.
//
// Method: for each node i, fit the tangent-plane slope (∂h/∂east, ∂h/∂north) by a least-squares /
// averaged finite difference over its adjacency neighbours (projected into carrier.tangentFrameAt(i)),
// then express the gradient back in world space as gE*east + gN*north (already tangent, no radial
// component). Deterministic (no rng), finite (degenerate neighbour sets ⇒ zero gradient guard),
// seam-free (operates on carrier.adj + the pole-safe tangent frame, object-space — no UV/lat-long).
export function computeAdjGradient(carrier, heightOverride = null) {
  // V2-4 slice-3: optional heightOverride lets route() compute the gradient of the margin-COMPOSITED
  // surface (carrier.height + shelfDepth) without mutating carrier.height. Omitted ⇒ reads carrier.height,
  // byte-identical for every existing 1-arg caller (the router re-point + the four test imports).
  const N = carrier.N;
  const h = heightOverride || carrier.height;
  const verts = carrier.verts;
  const adj = carrier.adj;
  const grad = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const { east, north } = carrier.tangentFrameAt(i);
    const di = verts[i];
    // Normal-equation accumulators for the 2×2 least-squares fit of (gE, gN) to dh ≈ gE*de + gN*dn.
    let sEE = 0, sEN = 0, sNN = 0, sEh = 0, sNh = 0, used = 0;
    const nb = adj[i];
    for (let k = 0; k < nb.length; k++) {
      const j = nb[k];
      const dj = verts[j];
      // tangent displacement toward neighbour j (project the chord onto the local tangent frame)
      const cx = dj[0] - di[0], cy = dj[1] - di[1], cz = dj[2] - di[2];
      const de = cx * east[0] + cy * east[1] + cz * east[2];
      const dn = cx * north[0] + cy * north[1] + cz * north[2];
      const dh = h[j] - h[i];
      if (!Number.isFinite(de) || !Number.isFinite(dn) || !Number.isFinite(dh)) continue;
      sEE += de * de; sEN += de * dn; sNN += dn * dn;
      sEh += de * dh; sNh += dn * dh; used++;
    }
    let gE = 0, gN = 0;
    const det = sEE * sNN - sEN * sEN;
    if (used >= 2 && Math.abs(det) > 1e-12) {
      gE = (sEh * sNN - sNh * sEN) / det;
      gN = (sNh * sEE - sEh * sEN) / det;
    }
    if (!Number.isFinite(gE)) gE = 0;
    if (!Number.isFinite(gN)) gN = 0;
    // express tangent gradient back in world space (gE along east + gN along north; both tangent)
    grad[i * 3]     = gE * east[0] + gN * north[0];
    grad[i * 3 + 1] = gE * east[1] + gN * north[1];
    grad[i * 3 + 2] = gE * east[2] + gN * north[2];
  }
  return grad;
}

// ── compositeMargins(carrier) — V2-4 slice-3 / V2-5 render composite (own-channel discipline) ──
// Returns a NEW Float32Array = carrier.height + carrier.shelfDepth + carrier.craterField — the two UNHASHED
// overlay channels summed ONTO (never INTO) carrier.height, so the coastline renders as a graded continental
// margin (V2-4 shelfDepth) AND dead-lid worlds render the bombardment overprint (V2-5 craterField), WITHOUT
// ever mutating carrier.height (the 75-golden captures the untouched carrier.height; both overlays live on
// their own channels — designDecision #MARGINS / V2-5 CRATER-LAYER-NOT-HEIGHT). Returns null when BOTH
// overlay channels are all-zero (non-plate + non-dead-lid worlds, and plate/dead-lid worlds with no populated
// overlay) so those paths reuse carrier.height/reliefGrad and render byte-identically (AC-LAB c).
// craterField is read null-tolerantly ((cf ? cf[i] : 0), BS-m2): both allocators populate it today, but a
// future carrier reaching route() without the field must not TypeError, and the early-out still short-
// circuits to null when only shelfDepth is populated (or neither is). Exported for the V2-5 slice-2
// composite value-identity unit test (route() below is the sole runtime caller).
// Inc-3b S1.3: the frozen identity budget — the default second argument. w_e=w_i=1 ⇒ the literal
// pre-budget loop runs, so all pre-Inc-3b callers (1 runtime + 8 test, all one-arg) reproduce h+sd+cf
// byte-for-byte with ZERO edits (AC-FENCE / AC-IDENTITY, provable by inspection).
export const IDENTITY_BUDGET = Object.freeze({ inDomain: false, w_e: 1, w_i: 1 });
// Inc-3b S1.3: ε_Vcf identity clamp (relief-budget-fit.json.epsilonVcf) — the smallest single-stamp raw
// mean-square the shipped schedule can produce. When realized V_cf < ε the RMS-preserving solve would emit
// an unbounded w_i (V_cf→0 blow-up, S0.2a #3), so we fall back to the literal identity loop instead.
const EPSILON_VCF = 1.1814295123540973e-8;

// V2-4 slice-3 margin composite. Inc-3b S1.3: extended to compositeMargins(carrier, budget = IDENTITY_BUDGET).
// Outside the budget domain (or the frozen identity budget) the LITERAL pre-budget loop runs (same float op
// order as pre-Inc-3b — AC-IDENTITY provable by inspection; 1.0*x===x is not merely relied upon). In-domain,
// the RMS-preserving w_e/w_i are solved HERE from the REALIZED channel raw-mean-square norms (adopted §6-T2
// option (ii)+S0.2a): the leaf emits only the model ratio target f_I (condition-pure — a realized-norm f_I
// collapses to identity), and this seam supplies the absolute scale. Frozen variance definition = RAW
// mean-square V = mean(x²) (relief-budget-fit.json). shelfDepth stays weight 1. Never mutates carrier.height.
// Slice D-fix (2026-07-28): OPTIONAL third arg `craterOut` — a caller-supplied Float32Array that
// receives the EXACT crater term this composite added (cf on the identity/fallback paths, w_i·cf
// in-domain). It exists so the display crossover can restore the crater channel it fades out
// (world-engine-lab.html uCraterBakeRestore) WITHOUT a second implementation of the w_i solve — the
// weight is applied in exactly one place, here. Writing it never touches `out[i]`, so every
// existing 1- and 2-arg caller stays byte-identical BY INSPECTION (the arithmetic is untouched).
export function compositeMargins(carrier, budget = IDENTITY_BUDGET, craterOut = null) {
  const sd = carrier.shelfDepth;
  if (!sd) return null;
  const cf = carrier.craterField;
  let any = false;
  for (let i = 0; i < sd.length; i++) { if (sd[i] !== 0 || (cf ? cf[i] : 0) !== 0) { any = true; break; } }
  if (!any) return null;
  const h = carrier.height;
  const out = new Float32Array(h.length);
  const n = h.length;
  // Identity path: the literal pre-budget loop, byte-identical op order to pre-Inc-3b.
  if (!budget || !budget.inDomain) {
    for (let i = 0; i < n; i++) out[i] = h[i] + sd[i] + (cf ? cf[i] : 0);
    if (craterOut) for (let i = 0; i < n; i++) craterOut[i] = (cf ? cf[i] : 0);
    return out;
  }
  // In-domain: solve the RMS-preserving scale from realized RAW mean-square norms.
  //   r = f_I/(1−f_I); w_e² = (V_h+V_cf)/(V_h·(1+r)); w_i² = r·w_e²·V_h/V_cf  (S0.2a closed form)
  let msH = 0, msCf = 0;
  for (let i = 0; i < n; i++) { const hv = h[i]; msH += hv * hv; const c = cf ? cf[i] : 0; msCf += c * c; }
  const V_h = msH / n, V_cf = msCf / n;
  const f_I = budget.f_I;
  // Fall back to the literal identity loop when the solve is ill-posed: V_cf below the ε clamp (unbounded
  // w_i, S0.2a #3), V_h non-positive, or f_I not a valid interior ratio. Preserves total band, no blow-up.
  if (!(V_cf >= EPSILON_VCF) || !(V_h > 0) || !(f_I > 0) || !(f_I < 1)) {
    for (let i = 0; i < n; i++) out[i] = h[i] + sd[i] + (cf ? cf[i] : 0);
    if (craterOut) for (let i = 0; i < n; i++) craterOut[i] = (cf ? cf[i] : 0);
    return out;
  }
  const r = f_I / (1 - f_I);
  const w_e = Math.sqrt((V_h + V_cf) / (V_h * (1 + r)));
  const w_i = Math.sqrt(r * w_e * w_e * V_h / V_cf);
  for (let i = 0; i < n; i++) out[i] = w_e * h[i] + sd[i] + w_i * (cf ? cf[i] : 0);
  if (craterOut) for (let i = 0; i < n; i++) craterOut[i] = w_i * (cf ? cf[i] : 0);
  return out;
}

// AC6: object-space river-width factor for a planet of radiusEarth. ∝ refRadius/radiusEarth
// (bigger world ⇒ proportionally thinner rivers ⇒ smaller disk-fraction), clamped off the
// degenerate extremes. radiusEarth floored at 1e-6 so a ~0 radius can't divide-by-zero.
export function widthRadiusFactor(radiusEarth, params = DEFAULT_PARAMS) {
  const ref = params.REF_RADIUS_EARTH ?? 1.0;
  const f = ref / Math.max(radiusEarth || ref, 1e-6);
  return Math.min(params.WIDTH_RADIUS_CEIL ?? 2.5, Math.max(params.WIDTH_RADIUS_FLOOR ?? 0.2, f));
}

// UAT item1: deterministic per-planet width-scale multiplier in [WIDTH_SEED_LO, WIDTH_SEED_HI],
// hashed from the planet seed (small integers like macroSeed). Same seed ⇒ same width every time;
// LO==HI (or seed null) ⇒ 1 (no variation). Affects width only, never topology.
export function widthSeedFactor(seed, params = DEFAULT_PARAMS) {
  const lo = params.WIDTH_SEED_LO ?? 1.0, hi = params.WIDTH_SEED_HI ?? 1.0;
  if (seed == null || lo === hi) return 1.0;
  let x = (Math.floor(seed) >>> 0) || 1;          // integer mix → [0,1)
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x = (x ^ (x >>> 16)) >>> 0;
  return lo + (hi - lo) * (x / 4294967296);
}

// AC6 + UAT item1: return params with the width law scaled for this planet radius AND its per-seed
// draw. Identity at the reference radius with no seed mul (so existing callers / the router lab are
// byte-for-byte unchanged). Scales the absolute width fields only — WIDTH_PHI/EXP (the accumulation
// SHAPE) are radius- and seed-invariant.
export function paramsForRadius(params = DEFAULT_PARAMS, radiusEarth, widthSeedMul = 1) {
  const kR = (radiusEarth == null) ? 1 : widthRadiusFactor(radiusEarth, params);
  const kS = widthSeedMul ?? 1;
  const k = kR * kS;
  if (Math.abs(k - 1) < 1e-9) return params;
  return { ...params,
    WIDTH_SCALE: params.WIDTH_SCALE * k, WIDTH_MIN: params.WIDTH_MIN * k, WIDTH_MAX: params.WIDTH_MAX * k,
    _widthRadiusFactor: kR, _widthSeedMul: kS, _widthFactor: k };
}

// ───────────── ocean mask from the real level-set (h < seaLevel) ─────────────
// AC4 (no north-star debt): `baseLevel` is an OPTIONAL per-node base-level field (Float32Array
// length N). OMITTED => today's scalar-seaLevel ocean set is byte-identical (the identity-safe
// default); SUPPLIED => each node is thresholded against its own local base level, so the later
// precip/climate increment's spatially-varying sea/base level drops in with ZERO rework here.
export function computeOcean(height, seaLevel, N, baseLevel = null) {
  const isOcean = new Uint8Array(N); let oceanCount = 0;
  for (let i = 0; i < N; i++) {
    const thresh = baseLevel ? baseLevel[i] : seaLevel;
    if (height[i] < thresh) { isOcean[i] = 1; oceanCount++; }
  }
  return { isOcean, oceanCount };
}

// ═══════════════════════ ROUTING + ORDER + METRICS ═══════════════════════
// Priority-flood → flat-resolve → D-inf receiver → Horton–Strahler order, plus the AC5
// network-validity metrics (orphans/uphill/bifurcation ratio/river-scale straightness).
// AC4 (no north-star debt): `precipWeight` is an OPTIONAL per-node discharge weight (Float32Array
// length N). OMITTED => the hardcoded uniform accum=1 (identity, determinism baseline holds); SUPPLIED
// => accum seeds from precipWeight[i], so the later precip/climate increment's rainfall field drops in
// with ZERO rework. `accum` lives on the routed graph that BOTH the per-route carve (buildValleyGeometry)
// AND the epoch readback (perNodeIncision) consume, so this single seam parameterizes discharge for the
// whole pipeline.
export function routeAndOrder({ mesh, height, grad, isOcean, params = DEFAULT_PARAMS, precipWeight = null }) {
  const { verts, adj } = mesh;
  const N = mesh.N != null ? mesh.N : verts.length;
  const { CHANNEL_ORDER, FLAT_RESOLVE, DINF_ROUTE } = params;

  function priorityFlood() {
    const filled = Float32Array.from(height);
    const closed = new Uint8Array(N);
    const heapE = []; const heapI = [];
    function push(e, i) { heapE.push(e); heapI.push(i); let c = heapE.length - 1;
      while (c > 0) { const p = (c - 1) >> 1; if (heapE[p] <= heapE[c]) break; [heapE[p], heapE[c]] = [heapE[c], heapE[p]]; [heapI[p], heapI[c]] = [heapI[c], heapI[p]]; c = p; } }
    function pop() { const e = heapE[0], i = heapI[0]; const le = heapE.pop(), li = heapI.pop();
      if (heapE.length) { heapE[0] = le; heapI[0] = li; let c = 0; const n = heapE.length;
        for (;;) { let l = 2 * c + 1, r = 2 * c + 2, s = c; if (l < n && heapE[l] < heapE[s]) s = l; if (r < n && heapE[r] < heapE[s]) s = r; if (s === c) break;
          [heapE[s], heapE[c]] = [heapE[c], heapE[s]]; [heapI[s], heapI[c]] = [heapI[c], heapI[s]]; c = s; } }
      return [e, i]; }
    for (let i = 0; i < N; i++) { if (isOcean[i]) { closed[i] = 1; push(filled[i], i); } }
    while (heapE.length) {
      const [, c] = pop();
      for (const nb of adj[c]) {
        if (closed[nb]) continue;
        closed[nb] = 1;
        if (filled[nb] <= filled[c]) filled[nb] = filled[c] + 1e-6;
        push(filled[nb], nb);
      }
    }
    return filled;
  }

  function computeGradOff(filled) {
    const gradOff = new Float64Array(N);
    if (!FLAT_RESOLVE) return gradOff;
    const FLATEPS = 1e-4;
    const isFlat = new Uint8Array(N);
    const hiSeed = [], loSeed = [];
    for (let i = 0; i < N; i++) {
      if (isOcean[i]) continue;
      let hasLower = false, adjHigher = false, adjLower = false;
      for (const nb of adj[i]) {
        if (filled[nb] < filled[i] - FLATEPS) { hasLower = true; adjLower = true; }
        else if (filled[nb] > filled[i] + FLATEPS) adjHigher = true;
      }
      if (!hasLower) isFlat[i] = 1;
      if (adjHigher) hiSeed.push(i);
      if (adjLower) loSeed.push(i);
    }
    const flatEdge = (a, b) => isFlat[a] && Math.abs(filled[a] - filled[b]) <= FLATEPS;
    function bfs(seeds) {
      const dist = new Int32Array(N).fill(-1); const q = [];
      for (const s of seeds) { if (isFlat[s]) { dist[s] = 0; q.push(s); } }
      let h = 0;
      while (h < q.length) { const c = q[h++]; for (const nb of adj[c]) { if (isFlat[nb] && dist[nb] < 0 && flatEdge(c, nb)) { dist[nb] = dist[c] + 1; q.push(nb); } } }
      return dist;
    }
    const dLow = bfs(loSeed.filter(i => isFlat[i]));
    const dHigh = bfs(hiSeed.filter(i => isFlat[i]));
    const GSCALE = 5e-7;
    for (let i = 0; i < N; i++) {
      if (!isFlat[i]) continue;
      const dl = dLow[i] >= 0 ? dLow[i] : 0;
      const dh = dHigh[i] >= 0 ? dHigh[i] : 0;
      gradOff[i] = GSCALE * (dl - 0.5 * dh);
    }
    return gradOff;
  }

  const filled = priorityFlood();
  const gradOff = computeGradOff(filled);
  const surf = (i) => filled[i] + gradOff[i];
  const receiver = new Int32Array(N).fill(-1);
  const _a = new THREE.Vector3(), _b = new THREE.Vector3();
  for (let i = 0; i < N; i++) {
    if (isOcean[i]) { receiver[i] = i; continue; }
    const si = surf(i);
    let best = -1;
    if (DINF_ROUTE) {
      _a.set(verts[i][0], verts[i][1], verts[i][2]);
      let bestSlope = 0;
      for (const nb of adj[i]) {
        const drop = si - surf(nb);
        if (drop <= 0) continue;
        _b.set(verts[nb][0], verts[nb][1], verts[nb][2]);
        const slope = drop / Math.max(1e-9, _a.distanceTo(_b));
        if (slope > bestSlope) { bestSlope = slope; best = nb; }
      }
    } else {
      let bestE = si;
      for (const nb of adj[i]) { if (surf(nb) < bestE) { bestE = surf(nb); best = nb; } }
    }
    receiver[i] = best === -1 ? i : best;
  }
  const order = Array.from({ length: N }, (_, i) => i).sort((a, b) => surf(b) - surf(a));
  // AC4: per-node discharge seed — precipWeight[i] when supplied, else uniform 1 (byte-identical).
  const accum = new Float32Array(N);
  for (let i = 0; i < N; i++) accum[i] = precipWeight ? precipWeight[i] : 1;
  for (const i of order) { const r = receiver[i]; if (r !== i) accum[r] += accum[i]; }

  // orphans + uphill
  let landCount = 0, uphill = 0, orphan = 0, selfLoopLand = 0;
  const visitState = new Int8Array(N);
  function reachesOcean(start) {
    const path = []; let c = start, guard = 0;
    while (true) {
      if (isOcean[c]) { for (const p of path) visitState[p] = 1; return true; }
      if (visitState[c] === 1) { for (const p of path) visitState[p] = 1; return true; }
      if (visitState[c] === 2) { for (const p of path) visitState[p] = 2; return false; }
      if (path.includes(c) || guard++ > N + 5) { for (const p of path) visitState[p] = 2; return false; }
      path.push(c);
      const r = receiver[c];
      if (r === c) { for (const p of path) visitState[p] = 2; return false; }
      c = r;
    }
  }
  for (let i = 0; i < N; i++) {
    if (isOcean[i]) continue;
    landCount++;
    if (receiver[i] === i) selfLoopLand++;
    if (receiver[i] !== i && surf(receiver[i]) > surf(i) + 1e-9) uphill++;
    if (!reachesOcean(i)) orphan++;
  }

  // Horton–Strahler
  const strahler = new Int32Array(N).fill(0);
  const childMaxOrd = new Int32Array(N).fill(0);
  const childMaxCnt = new Int32Array(N).fill(0);
  const hasChild = new Uint8Array(N);
  for (let k = 0; k < order.length; k++) {
    const i = order[k];
    if (isOcean[i]) continue;
    const ord = !hasChild[i] ? 1 : (childMaxCnt[i] >= 2 ? childMaxOrd[i] + 1 : childMaxOrd[i]);
    strahler[i] = ord;
    const r = receiver[i];
    if (r !== i && !isOcean[r]) {
      hasChild[r] = 1;
      if (ord > childMaxOrd[r]) { childMaxOrd[r] = ord; childMaxCnt[r] = 1; }
      else if (ord === childMaxOrd[r]) childMaxCnt[r]++;
    }
  }
  const isChannel = new Uint8Array(N);
  let channelCount = 0;
  for (let i = 0; i < N; i++) { if (!isOcean[i] && strahler[i] >= CHANNEL_ORDER) { isChannel[i] = 1; channelCount++; } }

  let maxOrder = 0; const orderHist = {};
  for (let i = 0; i < N; i++) { if (isOcean[i]) continue; const o = strahler[i]; if (o > maxOrder) maxOrder = o; orderHist[o] = (orderHist[o] || 0) + 1; }
  const streamCount = {};
  for (let i = 0; i < N; i++) {
    if (isOcean[i]) continue;
    const o = strahler[i]; const r = receiver[i];
    const ro = (r !== i && !isOcean[r]) ? strahler[r] : -1;
    if (ro !== o) streamCount[o] = (streamCount[o] || 0) + 1;
  }
  let rbSum = 0, rbN = 0;
  for (let w = 1; w < maxOrder - 1; w++) { const a = streamCount[w] || 0, b = streamCount[w + 1] || 0; if (a > 0 && b > 0) { rbSum += a / b; rbN++; } }
  const bifurcationRatioTrimmed = rbN ? +(rbSum / rbN).toFixed(2) : 0;
  let sx = 0, sy = 0, sxx = 0, sxy = 0, sn = 0;
  for (let w = 1; w <= maxOrder; w++) { const c = streamCount[w] || 0; if (c < 1) continue; const x = w, y = Math.log(c); sx += x; sy += y; sxx += x * x; sxy += x * y; sn++; }
  const slope = sn > 1 ? (sn * sxy - sx * sy) / (sn * sxx - sx * sx) : 0;
  const bifurcationRatio = sn > 1 ? +Math.exp(-slope).toFixed(2) : bifurcationRatioTrimmed;

  // river-scale straightness
  const DEG2 = 2 * Math.PI / 180;
  function chordDir(i, j) { let ex = verts[j][0] - verts[i][0], ey = verts[j][1] - verts[i][1], ez = verts[j][2] - verts[i][2];
    const L = Math.hypot(ex, ey, ez); return L < 1e-10 ? null : [ex / L, ey / L, ez / L]; }
  function scaleStraightness(STEP) {
    const turns = []; let bends = 0, coll = 0;
    for (let s = 0; s < N; s++) {
      if (!isChannel[s]) continue;
      let isHead = true; for (const nb of adj[s]) { if (isChannel[nb] && receiver[nb] === s) { isHead = false; break; } }
      if (!isHead) continue;
      const path = []; let c = s, g = 0;
      while (isChannel[c] && g++ < 200000) { path.push(c); const r = receiver[c]; if (r === c || !isChannel[r]) break; c = r; }
      const dirs = [];
      for (let k = 0; k + STEP < path.length; k += STEP) { const d = chordDir(path[k], path[k + STEP]); if (d) dirs.push(d); }
      for (let k = 1; k < dirs.length; k++) {
        let cc = dirs[k - 1][0] * dirs[k][0] + dirs[k - 1][1] * dirs[k][1] + dirs[k - 1][2] * dirs[k][2];
        cc = Math.max(-1, Math.min(1, cc)); const t = Math.acos(cc);
        turns.push(t); bends++; if (t < DEG2) coll++;
      }
    }
    turns.sort((a, b) => a - b);
    return { STEP, bends, nearCollinearPct: bends ? +(100 * coll / bends).toFixed(2) : 0,
             medianTurnDeg: bends ? +(turns[turns.length >> 1] * 180 / Math.PI).toFixed(2) : 0 };
  }
  const riverScale = scaleStraightness(3);
  const riverScale6 = scaleStraightness(6);

  return { filled, surf, receiver, accum, order, strahler, isChannel, channelCount,
    landCount, uphill, orphan, selfLoopLand, maxOrder, orderHist, streamCount,
    bifurcationRatio, bifurcationRatioTrimmed, riverScale, riverScale6 };
}
