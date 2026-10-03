// cubeAtlas.js — CPU twin of the sky-bake atlas mapping (GLSL: CLOUD_ATLAS_GLSL in shaders/cloudField.glsl.js),
// plus the star-dust transmittance read (GLSL: cloudStarTransmittance). Headless: no three.js.
//
// The bake stores the six cube faces of a sky as a 3 x 2 grid of N x N cells in one 2D texture.
// Face f: major axis m = f >> 1, sign = (f & 1) ? -1 : +1; the face's (a, b) coordinates are the components on
// axes (m+1)%3 and (m+2)%3 divided by |d_m|. Texel centres are EDGE-INCLUSIVE: texel i of N sits at
// a = -1 + 2i/(N-1), so texel 0 and N-1 lie exactly on the face edge. Two faces sharing an edge therefore hold the
// SAME rays along it, and a bilinear read that clamps inside the cell is continuous across every seam and corner.

import { ATLAS_COLS, ATLAS_ROWS, DEPTH_KNOTS } from './cloudConstants.js';

const norm = (v) => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};

/** Unit direction for face coordinates (a, b) in [-1, 1]. */
export function faceDirection(face, a, b) {
  const m = face >> 1, s = face & 1 ? -1 : 1;
  if (m === 0) return norm([s, a, b]);
  if (m === 1) return norm([b, s, a]);
  return norm([a, b, s]);
}

/** Direction of texel (i, j) of `face` in an N-texel face (edge-inclusive centres). */
export function texelDirection(face, i, j, N) {
  return faceDirection(face, -1 + (2 * i) / (N - 1), -1 + (2 * j) / (N - 1));
}

/** Face and (a, b) for a direction. Ties go to the lower axis (same rule as the GLSL). */
export function directionToFace(d) {
  const ax = Math.abs(d[0]), ay = Math.abs(d[1]), az = Math.abs(d[2]);
  if (ax >= ay && ax >= az) return { face: d[0] < 0 ? 1 : 0, a: d[1] / ax, b: d[2] / ax };
  if (ay >= az) return { face: d[1] < 0 ? 3 : 2, a: d[2] / ay, b: d[0] / ay };
  return { face: d[2] < 0 ? 5 : 4, a: d[0] / az, b: d[1] / az };
}

/** Continuous texel coordinates (x, y in [0, N-1]) of a direction within its face. */
export function texelCoord(d, N) {
  const { face, a, b } = directionToFace(d);
  const c = (v) => Math.min(N - 1, Math.max(0, ((v + 1) / 2) * (N - 1)));
  return { face, x: c(a), y: c(b) };
}

/** Atlas UV (0..1) the GLSL samples for a direction — bilinear between texel centres. */
export function atlasUV(d, N) {
  const { face, x, y } = texelCoord(d, N);
  const col = face % ATLAS_COLS, row = Math.floor(face / ATLAS_COLS);
  return [(col * N + x + 0.5) / (ATLAS_COLS * N), (row * N + y + 0.5) / (ATLAS_ROWS * N)];
}

/** Atlas size in texels for face size N. */
export function atlasSize(N) {
  return [ATLAS_COLS * N, ATLAS_ROWS * N];
}

/** Atlas pixel (integer px, py) → face and texel (twin of cloudAtlasDirection's indexing). */
export function atlasPixelToTexel(px, py, N) {
  const col = Math.floor(px / N), row = Math.floor(py / N);
  return { face: row * ATLAS_COLS + col, i: px - col * N, j: py - row * N };
}

/**
 * Bilinear read of the baked atlas for a direction, the way the GPU filters it.
 * @param {number[]} d — unit direction
 * @param {number} N — face size
 * @param {(face:number, i:number, j:number) => number[]} texel — the stored value of one texel
 */
export function sampleAtlas(d, N, texel) {
  const { face, x, y } = texelCoord(d, N);
  const i0 = Math.min(N - 2, Math.floor(x)), j0 = Math.min(N - 2, Math.floor(y));
  const fx = x - i0, fy = y - j0;
  const v00 = texel(face, i0, j0), v10 = texel(face, i0 + 1, j0);
  const v01 = texel(face, i0, j0 + 1), v11 = texel(face, i0 + 1, j0 + 1);
  return v00.map((_, c) => (v00[c] * (1 - fx) + v10[c] * fx) * (1 - fy) + (v01[c] * (1 - fx) + v11[c] * fx) * fy);
}

/** Piecewise-linear optical-depth CDF through (0,0), (DEPTH_KNOTS[q], G[q]), (1,1), at chord fraction f. */
export function depthCDF(G, f) {
  const xs = [0, ...DEPTH_KNOTS, 1], ys = [0, ...G, 1];
  const x = Math.min(1, Math.max(0, f));
  for (let q = 0; q < xs.length - 1; q++) {
    if (x <= xs[q + 1]) return ys[q] + ((ys[q + 1] - ys[q]) * (x - xs[q])) / (xs[q + 1] - xs[q]);
  }
  return 1;
}

/**
 * RGB transmittance from the observer to a star at `distPc` along `dir`, given the baked total optical depth
 * `tau` and CDF knots `G` for that direction. Stars nearer than the cloud's bounding sphere get exactly 1.
 * (Twin of the GLSL cloudStarTransmittance.)
 */
export function starTransmittance(dir, distPc, tau, G, observerPc, boundRadiusPc, extRGB) {
  const ro = observerPc;
  const tc = -(ro[0] * dir[0] + ro[1] * dir[1] + ro[2] * dir[2]);
  const h = [ro[0] + tc * dir[0], ro[1] + tc * dir[1], ro[2] + tc * dir[2]];
  const d2 = h[0] * h[0] + h[1] * h[1] + h[2] * h[2];
  const R2 = boundRadiusPc * boundRadiusPc;
  if (d2 >= R2) return [1, 1, 1];
  const half = Math.sqrt(R2 - d2);
  const t0 = Math.max(tc - half, 0), t1 = tc + half;
  if (t1 <= t0) return [1, 1, 1];
  const g = depthCDF(G, (distPc - t0) / (t1 - t0));
  return extRGB.map((e) => Math.exp(-tau * g * e));
}
