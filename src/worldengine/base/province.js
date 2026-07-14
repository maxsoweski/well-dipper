// src/worldengine/base/province.js
// World Engine V2-4 slice-4 — history-tied E12 PROVINCE field (BUILD-PLAN §4, calibration §6.2/§6.3).
//
// THREE-FREE. `writeProvince` is RNG-FREE + PURE (field-deterministic): it reads the carrier's history
// channels (faultDensity / grainMag / accommodation) and writes ONLY the unhashed Uint8Array `province`
// channel {0=craton, 1=orogen, 2=basin}. It is byte-inert vs the 75-golden HASHED_FIELDS
// (height/grainAngle/grainMag/regime/faultDensity — it touches none of them) and draws NO alea stream. The
// derivation is UNIVERSAL (every dispatch path, unlike the plate-only margins). Must run AFTER
// writeAccommodation in the §0 post-dispatch seam — it reads the finished `accommodation`.
//
// WHAT IT MODELS (plain language): a coarse tectonic PROVINCE map. CRATONS are the stable, quiet interiors
// (low deformation AND not a sink); OROGENS are deformation belts (high fault density OR high structural
// grain — the convergent/collision zones); BASINS are the topographic sinks (high accommodation). Regions
// are made legible (contiguous blobs, not per-node speckle) by a BOUNDED majority-vote relax over `adj`
// (fixed PROVINCE_RELAX_PASSES, the plates.js:355 Jacobi-relax idiom — never while-to-convergence).
//
// PLATE-PATH CAVEAT (flagged, not silent; BUILD-PLAN §4 R-grainMag-degenerate): on the plate path `grainMag`
// is all-zero (plates.js writes height+faultDensity only, never writeGrainSphere). The labeling reads
// whichever structural fields are NON-DEGENERATE per path via RANK normalization (a degenerate field maps to
// an all-zero rank and drops out), so orogens are carried by high faultDensity on Earth-like worlds and by
// grainMag+faultDensity on the despun path. Thresholds are cuts on each field's OWN live rank distribution
// (percentile-based, resolution- and path-independent), NOT hard-coded absolutes.
//
// THE HONESTY INSTRUMENT (AC-PROVINCE-ASSOC): `provinceAssociation` is the mean correlation-ratio η² of the
// history fields across the three classes. A high η² alone is NOT proof of history-tiedness — a merely
// CONTIGUOUS random partition also scores high over spatially-autocorrelated fields (the autocorrelation
// inflation the naive label-shuffle null misses). So the null is a CONTIGUITY-PRESERVING ENSEMBLE of
// position-noise partitions (`spatialNullPartition`) matched to the real province's region count + patch
// size; the pass line is real η² > the 99th percentile of that spatial null. A single position-noise control
// is one draw from that same process and is REJECTED by construction. `assessProvinceAssociation` runs the
// whole decision. alea is imported ONLY for this test/calibration instrument (seeded, deterministic) — the
// production `writeProvince` never calls it.

import alea from 'alea';

export const CRATON = 0, OROGEN = 1, BASIN = 2;

// ── BAKED derivation constants (province-thresholds.mjs / assoc-null.mjs output, 2026-07-14) ─────────
// Cuts are on each field's strict-less ECDF RANK in [0,1] (so they ARE per-distribution percentiles).
export const OROGEN_CUT = 0.86;            // deformation rank max(faultDensityRank, grainMagRank) ≥ this ⇒ OROGEN
export const BASIN_CUT  = 0.72;            // accommodation rank ≥ this (and not an orogen) ⇒ BASIN
export const PROVINCE_RELAX_PASSES = 3;    // fixed bounded majority-vote passes (contiguity; NO while-to-convergence)

// Strict-less ECDF rank in [0,1]: rank[i] = (# nodes with field strictly < field[i]) / (count-1). A
// degenerate (all-equal) field ⇒ every rank 0 ⇒ it contributes nothing to the labeling (path-degeneracy
// safe). Deterministic (numeric sort on a copy; Float32Array sorts numeric-ascending by default). O(N log N).
function rankNormalize(field, count) {
  const out = new Float32Array(count);
  if (count <= 1) return out;
  const sorted = Float32Array.from(field).sort();
  const denom = count - 1;
  for (let i = 0; i < count; i++) {
    // lowerBound: first index whose value >= field[i] == count of values strictly less than field[i]
    let lo = 0, hi = count;
    const v = field[i];
    while (lo < hi) { const mid = (lo + hi) >> 1; if (sorted[mid] < v) lo = mid + 1; else hi = mid; }
    out[i] = lo / denom;
  }
  return out;
}

// Bounded majority-vote relax over adj (the plates.js:355 render-once relax idiom; NEVER while-to-convergence).
// Each pass: node takes the plurality label among {self + neighbours}. Ties KEEP the current label
// (deterministic, RNG-free — the reserved 'province:' entropy is not consumed; BUILD-PLAN §0 "prefer
// derivation"). Double-buffered so a pass sees the previous pass's field, not a half-updated one.
function majorityRelax(label, adj, N, passes) {
  if (passes <= 0) return;
  const buf = new Uint8Array(N);
  const counts = new Int32Array(3);
  for (let p = 0; p < passes; p++) {
    for (let i = 0; i < N; i++) {
      counts[0] = 0; counts[1] = 0; counts[2] = 0;
      counts[label[i]]++;                                  // include self
      const nb = adj[i];
      for (let k = 0; k < nb.length; k++) counts[label[nb[k]]]++;
      let best = label[i], bestC = counts[label[i]];        // tie → keep current
      for (let c = 0; c < 3; c++) if (counts[c] > bestC) { bestC = counts[c]; best = c; }
      buf[i] = best;
    }
    label.set(buf);
  }
}

// deriveProvinceLabels(fields, adj, N, opts) — the PURE labeling, parameterized so the calibration probe can
// sweep cuts/passes. fields = { faultDensity, grainMag, accommodation }. Returns a fresh Uint8Array.
export function deriveProvinceLabels(fields, adj, N, {
  orogenCut = OROGEN_CUT, basinCut = BASIN_CUT, relaxPasses = PROVINCE_RELAX_PASSES,
} = {}) {
  const fdN = rankNormalize(fields.faultDensity, N);
  const gmN = rankNormalize(fields.grainMag, N);
  const acN = rankNormalize(fields.accommodation, N);
  const label = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    const deform = fdN[i] > gmN[i] ? fdN[i] : gmN[i];      // high fault OR high grain ⇒ orogen-like
    if (deform >= orogenCut) label[i] = OROGEN;
    else if (acN[i] >= basinCut) label[i] = BASIN;         // high accommodation, not deformed ⇒ basin
    else label[i] = CRATON;                                 // quiet interior (the area-dominant background)
  }
  majorityRelax(label, adj, N, relaxPasses);
  return label;
}

// writeProvince(carrier, { seed }) — the production writer. Writes carrier.province (Uint8Array {0,1,2}).
// `seed` is RESERVED for a future tie-break entropy source ('province:'+seed) and is NOT consumed today
// (ties keep the current label). Idempotent + deterministic. Reads faultDensity/grainMag/accommodation.
export function writeProvince(carrier, { seed = 0, orogenCut, basinCut, relaxPasses } = {}) {
  const { N, adj, faultDensity, grainMag, accommodation, province } = carrier;
  const labels = deriveProvinceLabels(
    { faultDensity, grainMag, accommodation }, adj, N, { orogenCut, basinCut, relaxPasses },
  );
  province.set(labels);
  return carrier;
}

// ── ASSOCIATION STATISTIC (η²) ──────────────────────────────────────────────────────────────────────
// Correlation ratio η²(x) = SS_between / SS_total over the K=3 class means. Scale-free variance fraction.
export function eta2(labels, field, K = 3) {
  const n = field.length;
  let mean = 0; for (let i = 0; i < n; i++) mean += field[i]; mean /= n;
  const sums = new Float64Array(K), cnts = new Int32Array(K);
  for (let i = 0; i < n; i++) { sums[labels[i]] += field[i]; cnts[labels[i]]++; }
  let ssB = 0;
  for (let c = 0; c < K; c++) if (cnts[c] > 0) { const mc = sums[c] / cnts[c]; ssB += cnts[c] * (mc - mean) * (mc - mean); }
  let ssT = 0; for (let i = 0; i < n; i++) { const d = field[i] - mean; ssT += d * d; }
  return ssT > 0 ? ssB / ssT : 0;
}

// mean η² over the POPULATED (non-degenerate) history fields — the honesty statistic. A degenerate field
// (e.g. plate-path grainMag) is dropped from BOTH the real and null scoring (apples-to-apples).
export function provinceAssociation(labels, fields) {
  let sum = 0, m = 0;
  for (const f of fields) {
    let mn = Infinity, mx = -Infinity;
    for (let i = 0; i < f.length; i++) { const v = f[i]; if (v < mn) mn = v; if (v > mx) mx = v; }
    if (mx > mn) { sum += eta2(labels, f); m++; }
  }
  return m > 0 ? sum / m : 0;
}

// ── CONTIGUITY + PATCH-SIZE metrics ───────────────────────────────────────────────────────────────
// components: # connected components of same-label nodes (flood-fill over adj). contiguity: fraction of
// nodes whose own label is a plurality (≥ half) among their neighbours — a per-node speckle detector.
export function provinceStats(labels, adj, N) {
  const seen = new Uint8Array(N);
  const stack = new Int32Array(N);
  let components = 0;
  for (let s = 0; s < N; s++) {
    if (seen[s]) continue;
    components++;
    let sp = 0; stack[sp++] = s; seen[s] = 1; const L = labels[s];
    while (sp > 0) {
      const c = stack[--sp];
      const nb = adj[c];
      for (let k = 0; k < nb.length; k++) { const j = nb[k]; if (!seen[j] && labels[j] === L) { seen[j] = 1; stack[sp++] = j; } }
    }
  }
  let agree = 0;
  for (let i = 0; i < N; i++) {
    let same = 0, tot = 0;
    const nb = adj[i];
    for (let k = 0; k < nb.length; k++) { tot++; if (labels[nb[k]] === labels[i]) same++; }
    if (tot > 0 && same * 2 >= tot) agree++;
  }
  return { components, contiguity: N > 0 ? agree / N : 0 };
}

export function classProportions(labels, N) {
  const c = [0, 0, 0];
  for (let i = 0; i < N; i++) c[labels[i]]++;
  return [c[0] / N, c[1] / N, c[2] / N];
}

// ── THE CONTIGUITY-PRESERVING SPATIAL NULL (folds lens B#2) ──────────────────────────────────────────
// A random SPATIAL partition matched to the real province's granularity: pick K seed nodes (bounded partial
// Fisher–Yates — no while-to-convergence), multi-source BFS Voronoi to K contiguous cells, then colour each
// cell one of the three classes drawn to match the real class proportions. NO history field is read — the
// partition is equally blobby but structureless, so its η² is what "position noise at the same patch scale"
// scores. Deterministic per `seed` (seeded alea; this is the ONLY alea use, test/calibration only).
export function spatialNullPartition(mesh, { K, classProps, seed }) {
  const adj = mesh.adj;
  const N = mesh.verts ? mesh.verts.length : mesh.N;
  const rng = alea('province-null:' + seed);
  const kk = Math.max(1, Math.min(K | 0, N));
  // K distinct seeds via a bounded partial Fisher–Yates prefix (no unbounded rejection loop)
  const perm = new Int32Array(N); for (let i = 0; i < N; i++) perm[i] = i;
  const seeds = new Int32Array(kk);
  for (let k = 0; k < kk; k++) {
    const j = k + Math.floor(rng() * (N - k));
    const t = perm[k]; perm[k] = perm[j]; perm[j] = t;
    seeds[k] = perm[k];
  }
  // BFS Voronoi: nearest-seed contiguous cells
  const region = new Int32Array(N).fill(-1);
  const q = new Int32Array(N); let h = 0, t2 = 0;
  for (let k = 0; k < kk; k++) { region[seeds[k]] = k; q[t2++] = seeds[k]; }
  while (h < t2) { const c = q[h++]; const nb = adj[c]; for (let m = 0; m < nb.length; m++) { const j = nb[m]; if (region[j] < 0) { region[j] = region[c]; q[t2++] = j; } } }
  // colour each cell ~ classProps (cumulative thresholds)
  const cum0 = classProps[0], cum1 = classProps[0] + classProps[1];
  const cellClass = new Uint8Array(kk);
  for (let k = 0; k < kk; k++) { const r = rng(); cellClass[k] = r < cum0 ? CRATON : (r < cum1 ? OROGEN : BASIN); }
  const labels = new Uint8Array(N);
  for (let i = 0; i < N; i++) labels[i] = region[i] >= 0 ? cellClass[region[i]] : CRATON;
  return labels;
}

// assessProvinceAssociation — the full AC-PROVINCE-ASSOC decision (BUILD-PLAN §4).
//   real η²  vs  the p99 of NPERM contiguity-matched spatial-null partitions.
//   pass = real η² > null p99. A single position-noise control (one more null draw, distinct seed) is
//   REJECTED (η² ≤ p99) by construction. `fields` = the raw history fields (degenerate ones auto-dropped).
export function assessProvinceAssociation(labels, mesh, fields, { NPERM = 200, seed = 0, controlSeed = 424242 } = {}) {
  const adj = mesh.adj;
  const N = mesh.verts ? mesh.verts.length : mesh.N;
  const realEta2 = provinceAssociation(labels, fields);
  const { components, contiguity } = provinceStats(labels, adj, N);
  const K = Math.max(3, components);                        // matched region count ⇒ matched patch size
  const classProps = classProportions(labels, N);
  const nullEtas = new Float64Array(NPERM);
  for (let p = 0; p < NPERM; p++) {
    const nl = spatialNullPartition(mesh, { K, classProps, seed: (seed * 100003) + p });
    nullEtas[p] = provinceAssociation(nl, fields);
  }
  const sorted = Float64Array.from(nullEtas).sort();
  const p99 = sorted[Math.min(NPERM - 1, Math.max(0, Math.round(0.99 * (NPERM - 1))))];
  let nullMean = 0; for (let p = 0; p < NPERM; p++) nullMean += sorted[p]; nullMean /= NPERM;
  const controlLabels = spatialNullPartition(mesh, { K, classProps, seed: (seed * 100003) + 7_000_000 + controlSeed });
  const controlEta2 = provinceAssociation(controlLabels, fields);
  return {
    realEta2, nullP99: p99, nullMean, controlEta2,
    components, K, contiguity, classProps,
    pass: realEta2 > p99,
    controlRejected: !(controlEta2 > p99),
  };
}
