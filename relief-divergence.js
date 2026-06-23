// relief-divergence.js — divergence measuring instrument for body-type divergence. Pure: no three.js.
// ── BUILD INTENT (record-build-intent) ──
// Function: numeric metrics that decide whether two body bundles produce categorically different worlds.
//   z-scoring makes every metric amplitude-invariant, so a pure amplitude rescale (the original coat-swap)
//   scores ~0; only distribution-SHAPE / arrangement / regime / carve differences score positive.
// Intent: provide the per-layer TDD gate AND the decisive §5 gate. hypsometricDistance is the LOAD-BEARING,
//   reseed-INVARIANT component (held-seed gate); perCellRMS is reseed-SENSITIVE and DIAGNOSTIC ONLY.
// Deliberate non-goals: not a renderer; not preset-aware; does not run the slice (orchestration lives in
//   relief-slice.js divergenceReport). It only measures arrays handed to it.

export function zscore(arr) {
  const n = arr.length, out = new Float64Array(n);
  let mean = 0; for (let i = 0; i < n; i++) mean += arr[i]; mean /= n || 1;
  let v = 0; for (let i = 0; i < n; i++) { const d = arr[i] - mean; v += d * d; } v /= n || 1;
  const std = Math.sqrt(v);
  if (std < 1e-12) return out;                       // flat field → all zeros (no divergence by amplitude)
  for (let i = 0; i < n; i++) out[i] = (arr[i] - mean) / std;
  return out;
}

// Wasserstein-1 on z-scored 1D samples = mean |sortedA - sortedB|. Reseed- AND amplitude-invariant:
// only the SHAPE of the height distribution moves it (skew/modality), i.e. a real regime/geometry change.
export function hypsometricDistance(hA, hB) {
  const a = Array.from(zscore(hA)).sort((x, y) => x - y);
  const b = Array.from(zscore(hB)).sort((x, y) => x - y);
  const n = Math.min(a.length, b.length);
  let s = 0; for (let i = 0; i < n; i++) s += Math.abs(a[i] - b[i]);
  return s / (n || 1);
}

// Per-cell RMS on z-scored fields. Reseed-SENSITIVE (a reshuffle/reseed saturates it). DIAGNOSTIC ONLY —
// must NOT certify the decisive gate.
export function perCellRMS(hA, hB) {
  const a = zscore(hA), b = zscore(hB);
  const n = Math.min(a.length, b.length);
  let s = 0; for (let i = 0; i < n; i++) { const d = a[i] - b[i]; s += d * d; }
  return Math.sqrt(s / (n || 1));
}

// Total-variation distance over the three Anderson regime classes. Reseed-invariant (regime is
// latitude+sign driven). 0 = identical class mix; up to 1 = disjoint.
export function regimeHistogramDistance(regA, regB) {
  const hist = (r) => { const h = [0, 0, 0]; for (let i = 0; i < r.length; i++) h[r[i]]++;
    for (let k = 0; k < 3; k++) h[k] /= r.length || 1; return h; };
  const a = hist(regA), b = hist(regB);
  let s = 0; for (let k = 0; k < 3; k++) s += Math.abs(a[k] - b[k]);
  return 0.5 * s;
}

export function carveFraction(incision, eps = 1e-4) {
  let c = 0; for (let i = 0; i < incision.length; i++) if (incision[i] < -eps) c++;
  return c / (incision.length || 1);
}

export function channelFraction(flowAccum, pct = 0.9) {
  const sorted = Float32Array.from(flowAccum).sort();
  const thr = sorted[Math.floor(pct * (sorted.length - 1))];
  let c = 0; for (let i = 0; i < flowAccum.length; i++) if (flowAccum[i] > thr) c++;
  return c / (flowAccum.length || 1);
}
