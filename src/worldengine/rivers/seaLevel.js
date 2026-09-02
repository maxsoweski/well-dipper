// src/worldengine/rivers/seaLevel.js
// THE SEA-LEVEL SOLVER — moved here from planet-lod-sealevel.js lines 10–55 (at `3dded82`) on 2026-09-02.
//
// FUNCTION: `solveSeaLevel(heights, targetFraction, bins)` returns the threshold T such that
// count(h < T)/N ≈ targetFraction, by inverse-CDF over a histogram of the LIVE height field —
// measured the way the live router measures ocean (strictly below the level set). Pure and
// deterministic; degenerate ranges and targets are clamped to a finite, sensible threshold.
//
// INTENT: the sea the rivers drain into. `route()` solves it to DEFAULT_PARAMS.TARGET_OCEAN_FRACTION
// on wet bodies, and `computeOcean` thresholds against it to produce the ocean mask routeAndOrder
// routes to. It moves with the router because it is the same GPU-free half of the pipeline the game's
// bake worker must run, and because nothing under src/ could reach it at the repo root
// (tests/src-boundary-fence.test.js). planet-lod-sealevel.js becomes a one-line re-export, so the
// lab and tests/planet-lod-sealevel.test.js keep their import path unchanged.
//
// DELIBERATE NON-GOALS: no RNG, no Date.now, no three, no renderer — it imports nothing at all. It
// does NOT decide WHETHER a body is wet or what its target fraction is; the caller supplies both.
//
// ⛔ BYTE-VERBATIM BELOW THIS LINE. Every line below is the identical text from planet-lod-sealevel.js
// at `3dded82`.

const DEFAULT_BINS = 2048;

export function solveSeaLevel(heights, targetFraction, bins = DEFAULT_BINS) {
  const N = heights.length;
  if (N === 0) return 0;

  let hMin = Infinity, hMax = -Infinity;
  for (let i = 0; i < N; i++) {
    const v = heights[i];
    if (v < hMin) hMin = v;
    if (v > hMax) hMax = v;
  }

  // Degenerate range (all equal / non-finite span): return a finite, sensible threshold.
  if (!(hMax > hMin)) return hMin;

  // Degenerate targets: clamp so the achieved fraction is exactly 0 / 1.
  if (targetFraction <= 0) return hMin;                            // nothing is strictly below the min
  if (targetFraction >= 1) return hMax + (hMax - hMin) * 1e-6;     // everything is strictly below this

  // Histogram over [hMin, hMax].
  const span = hMax - hMin;
  const hist = new Float64Array(bins);
  for (let i = 0; i < N; i++) {
    let b = Math.floor(((heights[i] - hMin) / span) * bins);
    if (b < 0) b = 0; else if (b >= bins) b = bins - 1;
    hist[b]++;
  }

  // Walk the cumulative distribution to the target count; interpolate within the crossing bin
  // (uniform-within-bin) so count(h < T) ≈ targetCount.
  const targetCount = targetFraction * N;
  const binWidth = span / bins;
  let cum = 0;
  for (let b = 0; b < bins; b++) {
    const c = hist[b];
    if (c === 0) continue;
    if (cum + c >= targetCount) {
      const frac = (targetCount - cum) / c;              // 0..1 into this bin
      return hMin + (b + frac) * binWidth;
    }
    cum += c;
  }
  // Target ≈ N (rounding): everything below.
  return hMax + span * 1e-6;
}
