// shapeMetrics.js — a headless instrument for "does this cloud read as a ring?" (Max, round 1: "It looks like a
// ring... It looks like a circle"). Renders the projected emission of a render pack through the CPU twin's
// integrator and measures the image. Used by tests/galactic-shape.test.js and the contact-sheet script; nothing
// in the game imports it. Headless: no three.js.
//
// Metrics (all on the luminance image, measured from the LIGHT centroid):
//   ringRatio    — mean brightness of the brightest annulus / mean brightness of the centre disc (> 1 = limb ring)
//   angularCV    — coefficient of variation of brightness around that annulus over 16 sectors (low = uniform ring)
//   centroidOff  — light centroid's distance from the projected feature centre, in units of the radius of the
//                  faint outline (the > 1%-of-max mask: the whole visible cloud, not just its bright core)
//   circularity  — perimeter² / (4π·area) of the > 10%-of-max mask (1 = disc; larger = more ragged)
//   aspect       — elongation of that mask: sqrt of the ratio of its second-moment eigenvalues (1 = round)

import { integrateRay, luminance } from './cloudFieldCPU.js';

const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]); return v.map((c) => c / l); };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** Galactic-frame direction of the pack's ionizing source (the pack stores it in the nebula-local frame). */
export function sourceDirectionGalactic(pack) {
  const c = pack.ionizing.centrePc, m = pack.rotation; // column-major; local = M·galactic → galactic = Mᵀ·local
  const g = [m[0] * c[0] + m[1] * c[1] + m[2] * c[2], m[3] * c[0] + m[4] * c[1] + m[5] * c[2], m[6] * c[0] + m[7] * c[1] + m[8] * c[2]];
  const l = Math.hypot(g[0], g[1], g[2]);
  return l > 1e-12 ? g.map((v) => v / l) : [0, 0, 1];
}

/** Six view directions (camera → cloud): along the source axis both ways (the face-on blister, the worst case for
 *  roundness) and four perpendicular to it. */
export function sixViews(axis) {
  const a = norm(axis);
  const e1 = norm(cross(a, Math.abs(a[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]));
  const e2 = cross(a, e1);
  return [
    { name: 'into source (face-on, front)', dir: a.map((c) => -c) },
    { name: 'behind (face-on, back)', dir: a.slice() },
    { name: 'side +e1', dir: e1.slice() },
    { name: 'side -e1', dir: e1.map((c) => -c) },
    { name: 'side +e2', dir: e2.slice() },
    { name: 'side -e2', dir: e2.map((c) => -c) },
  ];
}

/**
 * Orthographic render of the pack seen along `viewDir` (camera → cloud), `n` x `n` pixels, half-width `halfPc`.
 * @returns {{n:number, Y:Float64Array, rgb:Float64Array, halfPc:number}}
 */
export function renderOrtho(pack, viewDir, { n = 96, steps = 48, halfPc = pack.boundRadiusPc * 1.02 } = {}) {
  const v = norm(viewDir);
  const e1 = norm(cross(v, Math.abs(v[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]));
  const e2 = cross(e1, v);
  const back = 3 * pack.boundRadiusPc;
  const Y = new Float64Array(n * n), rgb = new Float64Array(n * n * 3);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const a = ((x + 0.5) / n * 2 - 1) * halfPc, b = (1 - (y + 0.5) / n * 2) * halfPc;
      const ro = [0, 1, 2].map((c) => -v[c] * back + a * e1[c] + b * e2[c]);
      const { L } = integrateRay(pack, ro, v, steps);
      const i = y * n + x;
      Y[i] = luminance(L);
      rgb[i * 3] = L[0]; rgb[i * 3 + 1] = L[1]; rgb[i * 3 + 2] = L[2];
    }
  }
  return { n, Y, rgb, halfPc };
}

/** Ring / roundness metrics of a luminance image (see the header). */
export function ringMetrics(img, { sectors = 16, maskFrac = 0.1 } = {}) {
  const { n, Y } = img;
  let max = 0, tot = 0, sx = 0, sy = 0;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const v = Y[y * n + x];
    max = Math.max(max, v); tot += v; sx += v * x; sy += v * y;
  }
  if (!(tot > 0)) throw new Error('empty image');
  const cx = sx / tot, cy = sy / tot, g = (n - 1) / 2;
  // Outline mask, area and perimeter (boundary edges × π/4 — the mean projection factor of a pixel edge, so a
  // digital disc scores ≈ 1).
  const thr = maskFrac * max;
  const m = (x, y) => x >= 0 && y >= 0 && x < n && y < n && Y[y * n + x] > thr;
  let area = 0, edges = 0;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (!m(x, y)) continue;
    area++;
    edges += (!m(x - 1, y)) + (!m(x + 1, y)) + (!m(x, y - 1)) + (!m(x, y + 1));
  }
  const perimeter = edges * Math.PI / 4;
  // Elongation from the mask's second moments.
  let mx = 0, my = 0;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (m(x, y)) { mx += x; my += y; }
  mx /= Math.max(area, 1); my /= Math.max(area, 1);
  let sxx = 0, syy = 0, sxy = 0;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (m(x, y)) { sxx += (x - mx) ** 2; syy += (y - my) ** 2; sxy += (x - mx) * (y - my); }
  const tr = sxx + syy, det = sxx * syy - sxy * sxy, disc = Math.sqrt(Math.max(0, tr * tr / 4 - det));
  const aspect = Math.sqrt((tr / 2 + disc) / Math.max(tr / 2 - disc, 1e-9));
  const circularity = (perimeter * perimeter) / (4 * Math.PI * Math.max(area, 1));
  const rM = Math.sqrt(area / Math.PI);
  let faint = 0;
  for (let i = 0; i < n * n; i++) if (Y[i] > 0.01 * max) faint++;
  const rOut = Math.sqrt(faint / Math.PI);
  // Radial profile about the light centroid.
  const bins = Math.max(4, Math.ceil(1.5 * rM));
  const sum = new Float64Array(bins), cnt = new Float64Array(bins);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const r = Math.hypot(x - cx, y - cy);
    const b = Math.floor(r);
    if (b < bins) { sum[b] += Y[y * n + x]; cnt[b]++; }
  }
  const prof = Array.from(sum, (s, i) => (cnt[i] ? s / cnt[i] : 0));
  const rC = Math.max(1.5, 0.15 * rM);
  let cS = 0, cN = 0;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (Math.hypot(x - cx, y - cy) < rC) { cS += Y[y * n + x]; cN++; }
  }
  const centre = cN ? cS / cN : 0;
  let pk = -1, pkV = -Infinity;
  for (let b = Math.ceil(rC); b < Math.min(bins, Math.ceil(1.2 * rM)); b++) if (prof[b] > pkV) { pkV = prof[b]; pk = b; }
  const ringRatio = pk >= 0 ? pkV / Math.max(centre, 1e-30) : 0;
  // Angular uniformity of the brightest annulus.
  const rPk = pk + 0.5, halfW = Math.max(1.5, 0.1 * rM);
  const sS = new Float64Array(sectors), sN = new Float64Array(sectors);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const r = Math.hypot(x - cx, y - cy);
    if (Math.abs(r - rPk) > halfW) continue;
    const k = Math.min(sectors - 1, Math.floor(((Math.atan2(y - cy, x - cx) + Math.PI) / (2 * Math.PI)) * sectors));
    sS[k] += Y[y * n + x]; sN[k]++;
  }
  const sec = Array.from(sS, (s, i) => (sN[i] ? s / sN[i] : 0));
  const mean = sec.reduce((a, b) => a + b, 0) / sectors;
  const sd = Math.sqrt(sec.reduce((a, b) => a + (b - mean) ** 2, 0) / sectors);
  return {
    ringRatio,
    angularCV: mean > 0 ? sd / mean : 0,
    centroidOff: Math.hypot(cx - g, cy - g) / Math.max(rOut, 1),
    circularity,
    aspect,
    maskRadiusPx: rM,
    meanY: tot / (n * n),
    maxY: max,
  };
}

/** The verdict the shape tests assert on — what Max described ("a ring... a circle"): a round outline (aspect < 1.25),
 *  light spread evenly round the cloud's middle (low angular CV of the brightest annulus) AND centred on it (small
 *  centroid offset). ringRatio is reported but not required: a limb-brightened shell (ratio > 1) and an even disc
 *  (ratio ≈ 1) both read as a circle. Thresholds sit between the measured v1 maxima (CV 0.41, offset 0.125, aspect
 *  1.13) and the v2 values, measured 2026-10-03. */
export const RING_THRESHOLDS = Object.freeze({ angularCVMax: 0.5, centroidOffMax: 0.15, aspectMax: 1.25 });
export function readsAsRing(m, th = RING_THRESHOLDS) {
  return m.angularCV < th.angularCVMax && m.centroidOff < th.centroidOffMax && m.aspect < th.aspectMax;
}

/**
 * What the eye sees of the cloud: the mean luminance over its projected FOOTPRINT — every ray along which the cloud
 * is visible at all: it dims the stars behind by more than 1% (T < 0.99) or adds more than one 8-bit display step
 * of light (luminance > 1/255) — from an observer.
 * Outside (|observer| > bound): a perspective image of n x n rays framed on the bounding sphere. Inside: `n²`
 * directions spread evenly over the whole sky.
 * @param {number[]} observerPc — observer relative to the nebula centre (pc, galactic axes)
 * @returns {{meanY: number, footprint: number, rays: number}}
 */
export function footprintLuminance(pack, observerPc, { n = 48, steps = 48 } = {}) {
  const d = Math.hypot(observerPc[0], observerPc[1], observerPc[2]);
  const dirs = [];
  if (d > pack.boundRadiusPc * 1.001) {
    const v = observerPc.map((c) => -c / d);
    const e1 = norm(cross(v, Math.abs(v[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]));
    const e2 = cross(e1, v);
    const half = Math.tan(Math.asin(pack.boundRadiusPc / d)) * 1.02;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const a = ((x + 0.5) / n * 2 - 1) * half, b = ((y + 0.5) / n * 2 - 1) * half;
      dirs.push(norm([0, 1, 2].map((c) => v[c] + a * e1[c] + b * e2[c])));
    }
  } else {
    const m = n * n;
    for (let i = 0; i < m; i++) {
      const z = 1 - (2 * (i + 0.5)) / m, ph = i * 2.399963229728653, s = Math.sqrt(1 - z * z);
      dirs.push([s * Math.cos(ph), s * Math.sin(ph), z]);
    }
  }
  let sum = 0, fp = 0;
  for (const rd of dirs) {
    const r = integrateRay(pack, observerPc, rd, steps);
    const Y = luminance(r.L);
    if (r.T[1] < 0.99 || Y > 1 / 255) { sum += Y; fp++; }
  }
  return { meanY: fp ? sum / fp : 0, footprint: fp, rays: dirs.length };
}
