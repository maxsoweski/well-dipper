// src/worldengine/instrument/descriptors.js
// Non-visual analysis channel — DESCRIPTOR MATH (workstream nonvisual-analysis-channel-2026-07-24, AC-MATH).
//
// THREE-FREE, PURE, READ-ONLY. Nothing here writes a field, touches a uniform, or draws an alea stream.
// This module is the measuring half of the instrument: given a sampled field and the grid it was sampled
// on, it returns numbers ABOUT that field. The sampling half (GPU readback) lives in the lab; the two are
// deliberately split so this half is testable headlessly against fields whose answers are known in advance.
//
// WHAT IT MODELS (plain language): the questions a planetary scientist asks about a surface when they
// cannot simply look at it. How rough is it (RMS relief)? Is the mass high or low (hypsometric integral)?
// How steep (slope distribution)? What size are the repeating forms (PSD / autocorrelation wavelength)?
// How many craters of each size (size-frequency distribution)? How much river per unit area (drainage
// density)? How many zonal bands (band count)? Each of these is a number that survives a reseed — which
// is the whole point, because the thing that defeated the previous instrument was comparing two different
// random patterns to each other and calling the difference a signal.
//
// TWO RULES THIS MODULE EXISTS TO ENFORCE:
//   1. PHYSICAL UNITS. Every length is km, every area is km^2, every density is per 10^6 km^2. Nothing
//      here returns pixels. Pixel-space measurement conflates the quantity with the draw scale, and the
//      draw scale is exactly the variable under test in the radius work
//      (see docs/WORKSTREAMS/world-engine-radius-display-scale-2026-07-24/evidence/readgate-diagnosis/DIAGNOSIS.md).
//   2. WHOLE-FIELD STATISTICS. Every descriptor integrates over the entire sampled field rather than
//      tracking one feature, so per-seed pattern variance averages down instead of dominating. This is
//      DIAGNOSIS.md recommendation #3 generalised from one AC to the whole instrument.
//
// GRID CONTRACT. Descriptors take (field, grid) where field is a Float32Array/Array in row-major order
// and grid is one of:
//   equirect: { mode:'equirect', width, height, radiusKm }
//       row 0 = +90 deg latitude, row height-1 = -90; column 0 = -180 deg longitude. Cell (i,j) centre is
//       lat = 90 - (j+0.5)*180/height, lon = -180 + (i+0.5)*360/width. Area weight per row is cos(lat).
//   patch:    { mode:'patch', width, height, spanKmX, spanKmY }
//       a flat km-window; cells are spanKmX/width by spanKmY/height. Used for fine features where the
//       sphere's curvature is irrelevant and a plain FFT is well-defined.

const DEG = Math.PI / 180;
export const PER_AREA = 1e6;          // all densities report per 10^6 km^2
const POLE_GUARD_DEG = 85;            // slope stats exclude |lat| > this (cos(lat) -> 0 makes dx degenerate)

// ── grid helpers ────────────────────────────────────────────────────────────────────────────────────

/** Latitude (degrees) of row j on an equirect grid. Row 0 is the north pole side. */
export function rowLatDeg(j, height) {
  return 90 - ((j + 0.5) * 180) / height;
}

/**
 * Per-cell area in km^2 for row j. Equirect: dA = R^2 cos(lat) dphi dlambda, which sums to 4 pi R^2
 * over the whole grid. Patch: uniform cell area.
 */
export function cellAreaKm2(grid, j) {
  if (grid.mode === 'patch') {
    return (grid.spanKmX / grid.width) * (grid.spanKmY / grid.height);
  }
  const R = grid.radiusKm;
  const dPhi = Math.PI / grid.height;
  const dLambda = (2 * Math.PI) / grid.width;
  return R * R * Math.cos(rowLatDeg(j, grid.height) * DEG) * dPhi * dLambda;
}

/** Total area of the sampled domain, km^2. Equirect over a full sphere returns 4 pi R^2. */
export function totalAreaKm2(grid) {
  if (grid.mode === 'patch') return grid.spanKmX * grid.spanKmY;
  let a = 0;
  for (let j = 0; j < grid.height; j++) a += cellAreaKm2(grid, j) * grid.width;
  return a;
}

/** Area weight array (one weight per cell, row-major), normalised to sum 1. */
export function areaWeights(grid) {
  const n = grid.width * grid.height;
  const w = new Float64Array(n);
  let sum = 0;
  for (let j = 0; j < grid.height; j++) {
    const a = cellAreaKm2(grid, j);
    for (let i = 0; i < grid.width; i++) { w[j * grid.width + i] = a; sum += a; }
  }
  if (sum > 0) for (let k = 0; k < n; k++) w[k] /= sum;
  return w;
}

/** Eastward (dx) and northward (dy) metric spacing in km at row j. */
export function cellSpacingKm(grid, j) {
  if (grid.mode === 'patch') {
    return { dx: grid.spanKmX / grid.width, dy: grid.spanKmY / grid.height };
  }
  const R = grid.radiusKm;
  const lat = rowLatDeg(j, grid.height) * DEG;
  return {
    dx: R * Math.cos(lat) * ((2 * Math.PI) / grid.width),
    dy: R * (Math.PI / grid.height),
  };
}

// ── distribution moments ────────────────────────────────────────────────────────────────────────────

/**
 * Weighted mean / sd / skewness / percentiles of a value set. `weights` may be omitted for uniform.
 * Percentiles are computed on the weighted empirical CDF (not the naive sorted index), so they stay
 * correct under the cos(lat) weighting that makes equirect polar rows count for less.
 */
export function distributionMoments(values, weights = null) {
  const n = values.length;
  if (!n) return { mean: NaN, sd: NaN, skew: NaN, p10: NaN, p50: NaN, p90: NaN, min: NaN, max: NaN, n: 0 };
  let wsum = 0, mean = 0, min = Infinity, max = -Infinity;
  for (let k = 0; k < n; k++) {
    const w = weights ? weights[k] : 1;
    if (!(w > 0)) continue;
    const v = values[k];
    wsum += w; mean += w * v;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (!(wsum > 0)) return { mean: NaN, sd: NaN, skew: NaN, p10: NaN, p50: NaN, p90: NaN, min: NaN, max: NaN, n: 0 };
  mean /= wsum;
  let m2 = 0, m3 = 0;
  for (let k = 0; k < n; k++) {
    const w = weights ? weights[k] : 1;
    if (!(w > 0)) continue;
    const d = values[k] - mean;
    m2 += w * d * d; m3 += w * d * d * d;
  }
  m2 /= wsum; m3 /= wsum;
  const sd = Math.sqrt(m2);
  const skew = sd > 0 ? m3 / (sd * sd * sd) : 0;
  const pct = weightedPercentiles(values, weights, [0.1, 0.5, 0.9]);
  return { mean, sd, skew, p10: pct[0], p50: pct[1], p90: pct[2], min, max, n };
}

/** Weighted percentiles via the empirical CDF. Returns one value per requested quantile. */
export function weightedPercentiles(values, weights, qs) {
  const idx = [];
  for (let k = 0; k < values.length; k++) {
    const w = weights ? weights[k] : 1;
    if (w > 0 && Number.isFinite(values[k])) idx.push(k);
  }
  idx.sort((a, b) => values[a] - values[b]);
  let total = 0;
  for (const k of idx) total += weights ? weights[k] : 1;
  const out = new Array(qs.length).fill(NaN);
  if (!(total > 0)) return out;
  let cum = 0, qi = 0;
  for (const k of idx) {
    cum += (weights ? weights[k] : 1) / total;
    while (qi < qs.length && cum >= qs[qi]) { out[qi] = values[k]; qi++; }
    if (qi >= qs.length) break;
  }
  for (let q = 0; q < qs.length; q++) if (!Number.isFinite(out[q])) out[q] = values[idx[idx.length - 1]];
  return out;
}

// ── elevation-family descriptors ────────────────────────────────────────────────────────────────────

/**
 * Area-weighted RMS relief about the area-weighted mean, in km. The plainest roughness number there is,
 * and the one the relief envelope law (Q_RELIEF) makes a prediction about.
 */
export function rmsReliefKm(heightsKm, grid) {
  const w = areaWeights(grid);
  const m = distributionMoments(heightsKm, w);
  return m.sd;
}

/**
 * Hypsometric integral: (mean - min) / (max - min), area-weighted. The standard geomorphological measure
 * of whether a surface's mass sits high (young, uplifted, near 1) or low (worn down, near 0). A linear
 * elevation ramp over uniform area returns exactly 0.5 — which is what the unit test pins.
 */
export function hypsometricIntegral(heightsKm, grid, weights = null) {
  const w = weights || areaWeights(grid);
  const m = distributionMoments(heightsKm, w);
  const span = m.max - m.min;
  if (!(span > 0)) return NaN;
  return (m.mean - m.min) / span;
}

/**
 * Slope magnitude per cell, in DEGREES, using metric-aware central differences:
 *   dz/dx over the eastward spacing R cos(lat) dlambda, dz/dy over the northward spacing R dphi.
 * Heights are km and spacings are km, so the ratio is dimensionless before the atan.
 *
 * POLE GUARD: rows beyond +/-85 deg latitude are excluded on equirect grids — cos(lat) collapses the
 * eastward spacing there and the gradient diverges for reasons of grid geometry, not terrain. The
 * excluded fraction is returned so a caller can never mistake a partial measurement for a whole one.
 */
export function slopeStats(heightsKm, grid) {
  const { width: W, height: H } = grid;
  const vals = [], wts = [];
  let excluded = 0;
  for (let j = 0; j < H; j++) {
    if (grid.mode === 'equirect' && Math.abs(rowLatDeg(j, H)) > POLE_GUARD_DEG) { excluded += W; continue; }
    const { dx, dy } = cellSpacingKm(grid, j);
    const cellA = cellAreaKm2(grid, j);
    for (let i = 0; i < W; i++) {
      // East/west wraps on equirect (longitude is periodic); patch clamps at its edges.
      const iE = grid.mode === 'equirect' ? (i + 1) % W : Math.min(i + 1, W - 1);
      const iW = grid.mode === 'equirect' ? (i - 1 + W) % W : Math.max(i - 1, 0);
      const jN = Math.max(j - 1, 0), jS = Math.min(j + 1, H - 1);
      const spanX = (grid.mode === 'equirect' || (iE !== i && iW !== i)) ? 2 * dx : dx;
      const spanY = (jS - jN) * dy;
      const dzdx = (heightsKm[j * W + iE] - heightsKm[j * W + iW]) / spanX;
      const dzdy = spanY > 0 ? (heightsKm[jS * W + i] - heightsKm[jN * W + i]) / spanY : 0;
      vals.push(Math.atan(Math.hypot(dzdx, dzdy)) / DEG);
      wts.push(cellA);
    }
  }
  const m = distributionMoments(vals, wts);
  return {
    meanDeg: m.mean, medianDeg: m.p50, p90Deg: m.p90, sdDeg: m.sd,
    excludedFraction: excluded / (W * H),
  };
}

// ── spectral descriptors (form size without tracking a form) ────────────────────────────────────────

/**
 * In-place radix-2 complex FFT. `re`/`im` must be power-of-two length. Iterative Cooley-Tukey; written
 * out rather than imported because the instrument must stay dependency-free and headless-testable.
 */
export function fft(re, im, inverse = false) {
  const n = re.length;
  if (n <= 1) return;
  if ((n & (n - 1)) !== 0) throw new Error(`fft: length must be a power of two, got ${n}`);
  for (let i = 1, j = 0; i < n; i++) {                    // bit-reversal permutation
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (inverse ? 2 : -2) * Math.PI / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ur = re[i + k], ui = im[i + k];
        const vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
        const vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ur + vr; im[i + k] = ui + vi;
        re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
        const ncr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = ncr;
      }
    }
  }
  if (inverse) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
}

/** 2D FFT of a real field, returning {re, im} row-major. Width and height must be powers of two. */
export function fft2(field, width, height) {
  const re = Float64Array.from(field), im = new Float64Array(field.length);
  const rowRe = new Float64Array(width), rowIm = new Float64Array(width);
  for (let j = 0; j < height; j++) {
    for (let i = 0; i < width; i++) { rowRe[i] = re[j * width + i]; rowIm[i] = im[j * width + i]; }
    fft(rowRe, rowIm);
    for (let i = 0; i < width; i++) { re[j * width + i] = rowRe[i]; im[j * width + i] = rowIm[i]; }
  }
  const colRe = new Float64Array(height), colIm = new Float64Array(height);
  for (let i = 0; i < width; i++) {
    for (let j = 0; j < height; j++) { colRe[j] = re[j * width + i]; colIm[j] = im[j * width + i]; }
    fft(colRe, colIm);
    for (let j = 0; j < height; j++) { re[j * width + i] = colRe[j]; im[j * width + i] = colIm[j]; }
  }
  return { re, im };
}

/**
 * Radially-averaged power spectral density of a PATCH field, plus the two numbers we actually use:
 *   dominantWavelengthKm — the physical size of the field's most energetic repeating form. THIS is the
 *       "how big are the forms" number the radius work needs, and it is measured without tracking any
 *       individual form, so a reseed does not move it the way a band-width scanline did.
 *   spectralSlope — least-squares slope of log10(power) vs log10(k) over the resolved band. Terrain
 *       tends to sit near -2 to -3; the number is a fingerprint of roughness distribution across scales.
 *
 * The mean is removed first (so k=0 does not swamp the average) and the field is Hann-windowed in both
 * axes (so the FFT's implicit periodicity does not inject an edge-step artefact at every wavenumber).
 * Requires a patch grid with power-of-two dimensions — the sphere is not periodic in latitude, so a
 * global equirect FFT would measure the seam, not the terrain.
 */
export function radialPSD(field, grid) {
  if (grid.mode !== 'patch') throw new Error('radialPSD: requires a patch grid (equirect is not periodic in latitude)');
  const { width: W, height: H } = grid;
  let mean = 0;
  for (let k = 0; k < field.length; k++) mean += field[k];
  mean /= field.length;
  const win = new Float64Array(W * H);
  for (let j = 0; j < H; j++) {
    const wy = 0.5 * (1 - Math.cos((2 * Math.PI * j) / (H - 1)));
    for (let i = 0; i < W; i++) {
      const wx = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (W - 1)));
      win[j * W + i] = (field[j * W + i] - mean) * wx * wy;
    }
  }
  const { re, im } = fft2(win, W, H);
  // Radial bins in cycles-per-domain. Frequencies fold above Nyquist, so map each axis to signed order.
  const maxR = Math.floor(Math.min(W, H) / 2);
  const power = new Float64Array(maxR + 1), count = new Float64Array(maxR + 1);
  for (let j = 0; j < H; j++) {
    const ky = j <= H / 2 ? j : j - H;
    for (let i = 0; i < W; i++) {
      const kx = i <= W / 2 ? i : i - W;
      const r = Math.round(Math.hypot(kx, ky));
      if (r < 1 || r > maxR) continue;
      const idx = j * W + i;
      power[r] += re[idx] * re[idx] + im[idx] * im[idx];
      count[r] += 1;
    }
  }
  const spectrum = [];
  for (let r = 1; r <= maxR; r++) if (count[r] > 0) spectrum.push({ k: r, power: power[r] / count[r] });
  if (!spectrum.length) return { dominantWavelengthKm: NaN, spectralSlope: NaN, spectrum };
  // The domain's physical diagonal scale: use the mean span so a non-square patch still reports sanely.
  const spanKm = (grid.spanKmX + grid.spanKmY) / 2;
  let peak = spectrum[0];
  for (const s of spectrum) if (s.power > peak.power) peak = s;
  const xs = spectrum.map((s) => Math.log10(s.k));
  const ys = spectrum.map((s) => Math.log10(Math.max(s.power, Number.MIN_VALUE)));
  const slope = leastSquaresSlope(xs, ys);
  return { dominantWavelengthKm: spanKm / peak.k, spectralSlope: slope, spectrum };
}

/** Ordinary least-squares slope of y on x. Shared by the PSD and SFD fits. */
export function leastSquaresSlope(xs, ys) {
  const n = xs.length;
  if (n < 2) return NaN;
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (let i = 0; i < n; i++) { sx += xs[i]; sy += ys[i]; sxx += xs[i] * xs[i]; sxy += xs[i] * ys[i]; }
  const denom = n * sxx - sx * sx;
  if (Math.abs(denom) < 1e-15) return NaN;
  return (n * sxy - sx * sy) / denom;
}

/**
 * Dominant repeat scale via the field's autocorrelation along the x axis: the lag of the first
 * autocorrelation peak after the first zero crossing, converted to km. Cheaper and more robust than the
 * PSD for a strongly ridged field, and it is the metric DIAGNOSIS.md rec #3 named specifically — it
 * measures the SAME pattern's own repeat scale rather than comparing two different random patterns.
 */
export function autocorrWavelengthKm(field, grid) {
  const { width: W, height: H } = grid;
  const dxKm = grid.mode === 'patch'
    ? grid.spanKmX / W
    : cellSpacingKm(grid, Math.floor(H / 2)).dx;
  let mean = 0;
  for (let k = 0; k < field.length; k++) mean += field[k];
  mean /= field.length;
  const maxLag = Math.floor(W / 2);
  const ac = new Float64Array(maxLag + 1);
  for (let lag = 0; lag <= maxLag; lag++) {
    let s = 0, n = 0;
    for (let j = 0; j < H; j++) {
      for (let i = 0; i + lag < W; i++) {
        s += (field[j * W + i] - mean) * (field[j * W + i + lag] - mean);
        n++;
      }
    }
    ac[lag] = n > 0 ? s / n : 0;
  }
  if (!(ac[0] > 0)) return NaN;
  for (let lag = 0; lag <= maxLag; lag++) ac[lag] /= ac[0];
  let zero = -1;
  for (let lag = 1; lag <= maxLag; lag++) if (ac[lag] <= 0) { zero = lag; break; }
  if (zero < 0) return NaN;
  // FIRST local maximum after the zero crossing — not the global one. A periodic field has peaks of
  // equal height at every multiple of its period, so a global-max search returns whichever multiple
  // floating-point noise favours (it returned 3x the true wavelength on the sinusoid fixture). The
  // first peak is the fundamental, which is what "repeat scale" means.
  for (let lag = zero + 1; lag < maxLag; lag++) {
    if (ac[lag] > ac[lag - 1] && ac[lag] >= ac[lag + 1]) return lag * dxKm;
  }
  return NaN;
}

// ── count-family descriptors ────────────────────────────────────────────────────────────────────────

/** Count per 10^6 km^2. The unit every population density in this instrument reports in. */
export function countDensity(count, areaKm2) {
  if (!(areaKm2 > 0)) return NaN;
  return (count / areaKm2) * PER_AREA;
}

/**
 * Crater size-frequency distribution, the standard planetary-science instrument for a bombarded surface.
 * Returns the cumulative curve N(>= D) per 10^6 km^2 and the log-log slope of that curve.
 *
 * Why cumulative and not a histogram: the cumulative form is what the literature reports and fits, it is
 * insensitive to binning choice, and its slope is the number with a physical meaning (a saturated /
 * equilibrium population sits near -2). Our own v2-6 law claims crater COUNT scales as g^0.34, which is a
 * prediction about where this curve sits vertically as gravity changes — directly checkable.
 *
 * `craters` is an array of {diameterKm}. Bins are logarithmic between the smallest and largest diameter;
 * the slope fit uses only bins holding at least `minPerBin` craters so the sparse large-diameter tail
 * cannot lever the fit.
 */
export function craterSFD(craters, areaKm2, { bins = 12, minPerBin = 3 } = {}) {
  const ds = craters.map((c) => (typeof c === 'number' ? c : c.diameterKm)).filter((d) => d > 0).sort((a, b) => a - b);
  if (ds.length < 2) return { cumulative: [], slope: NaN, n: ds.length, densityPerArea: countDensity(ds.length, areaKm2) };
  const dMin = ds[0], dMax = ds[ds.length - 1];
  if (!(dMax > dMin)) return { cumulative: [], slope: NaN, n: ds.length, densityPerArea: countDensity(ds.length, areaKm2) };
  const logMin = Math.log10(dMin), logMax = Math.log10(dMax);
  const cumulative = [];
  for (let b = 0; b < bins; b++) {
    const D = Math.pow(10, logMin + ((logMax - logMin) * b) / bins);
    let n = 0;
    for (let k = ds.length - 1; k >= 0; k--) { if (ds[k] >= D) n++; else break; }
    cumulative.push({ diameterKm: D, countAtOrAbove: n, densityPerArea: countDensity(n, areaKm2) });
  }
  const fit = cumulative.filter((c) => c.countAtOrAbove >= minPerBin);
  const slope = fit.length >= 2
    ? leastSquaresSlope(fit.map((c) => Math.log10(c.diameterKm)), fit.map((c) => Math.log10(c.countAtOrAbove)))
    : NaN;
  return { cumulative, slope, n: ds.length, densityPerArea: countDensity(ds.length, areaKm2), fitBins: fit.length };
}

/**
 * Total length (km) of a one-cell-wide network drawn on the grid, summed over ADJACENT MASK PAIRS at
 * their true metric separation. Not "cells times cell size" — on an equirect grid that approximation is
 * anisotropic and wrong (a meridian and an equatorial line of equal cell count have very different true
 * lengths). Pair-summing is exact for both: a meridian returns R*dphi per step, an equator R*dlambda.
 *
 * Serves both drainage density (channel mask) and tectonic boundary density (boundary mask).
 */
export function networkLengthKm(mask, grid) {
  const { width: W, height: H } = grid;
  const on = (i, j) => mask[j * W + i] > 0;
  let len = 0;
  for (let j = 0; j < H; j++) {
    const { dx, dy } = cellSpacingKm(grid, j);
    for (let i = 0; i < W; i++) {
      if (!on(i, j)) continue;
      const iE = grid.mode === 'equirect' ? (i + 1) % W : i + 1;
      if (iE < W || grid.mode === 'equirect') { if (on(iE, j)) len += dx; }
      if (j + 1 < H) {
        if (on(i, j + 1)) {
          // Northward spacing is the same for both rows on equirect; average is exact for patch too.
          const dyS = (dy + cellSpacingKm(grid, j + 1).dy) / 2;
          len += dyS;
        }
      }
    }
  }
  return len;
}

/** Channel km per 10^6 km^2 — the standard geomorphological drainage density. */
export function drainageDensity(channelMask, grid) {
  return countDensity(networkLengthKm(channelMask, grid), totalAreaKm2(grid));
}

/** Boundary km per 10^6 km^2 — the tectonic analogue of drainage density. */
export function boundaryDensity(boundaryMask, grid) {
  return countDensity(networkLengthKm(boundaryMask, grid), totalAreaKm2(grid));
}

// ── atmosphere descriptor ───────────────────────────────────────────────────────────────────────────

/**
 * Zonal band count: average the field along longitude to get a latitude profile, remove its mean, and
 * count contiguous runs of constant sign. A pattern with k full cycles across the profile returns 2k
 * bands (each half-cycle is one band — the alternating jets). Runs shorter than `minRunRows` are folded
 * into their neighbour so single-row noise cannot inflate the count.
 */
export function bandCount(field, grid, { minRunRows = 2 } = {}) {
  const { width: W, height: H } = grid;
  const profile = new Float64Array(H);
  for (let j = 0; j < H; j++) {
    let s = 0;
    for (let i = 0; i < W; i++) s += field[j * W + i];
    profile[j] = s / W;
  }
  let mean = 0;
  for (let j = 0; j < H; j++) mean += profile[j];
  mean /= H;
  const runs = [];
  for (let j = 0; j < H; j++) {
    const sign = profile[j] - mean >= 0 ? 1 : -1;
    if (runs.length && runs[runs.length - 1].sign === sign) runs[runs.length - 1].len++;
    else runs.push({ sign, len: 1 });
  }
  const kept = runs.filter((r) => r.len >= minRunRows);
  return { bands: kept.length, runs: runs.length, profile };
}
