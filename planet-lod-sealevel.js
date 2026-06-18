// planet-lod-sealevel.js — SINGLE SOURCE of the sea-level solver.
// AC3 (rivers-dendritic-drainage): solve sea level from the LIVE height histogram
// (inverse-CDF to a target ocean fraction) instead of the FBM-era coverage formula, which
// gave ~13% ocean on the positive-biased real combiner stack. Pure + deterministic so it is
// unit-testable; the router calls it with the per-vertex heights it reads back via RTT.
//
// solveSeaLevel(heights, targetFraction) → threshold T such that count(h < T)/N ≈ target,
// measured the way the live router measures ocean (strictly-below the level set).

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
