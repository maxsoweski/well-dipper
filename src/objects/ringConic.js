// Screen-space orbit-ring conic math (orbit-ring-conic Slice A, closes AC1).
//
// A ring's 3D circle projects to a conic in screen-pixel space; the CPU builds
// that conic per ring per frame and one fullscreen pass paints every pixel
// within the Sampson-distance band of ANY ring's curve — measured directly in
// RENDER pixels (no world-domain footprint, no derivatives, per-pixel so
// grazing slivers never starve). This module is the pure math, extracted
// verbatim from the proven lab reference (orrery-orbit-lab.html `conic` mode,
// dig record e961dfd): the homography H from the PVM columns x,z,w (local-Y
// dropped), Cs = H⁻ᵀ·diag(1,1,-R²)·H⁻¹ max-abs-normalized, the Sampson distance
// |pᵀCs p| / |2(Cs p).xy|, and the front-branch guard via the rowW sign.
//
// EXPORTED for GLSL-mirror-parity: sampsonDistancePx / frontBranchOK are the
// byte-mirror of the fragment shader's per-pixel evaluation, so the headless
// suite pins the shader's math (same discipline as proximityFadeFactor).
//
// Matrix convention: Cs, Hinv are ROW-MAJOR flat length-9 (M[r*3+c]); rowW is
// length-3. Cs is symmetric so its row/column order is moot for pᵀCs p; Hinv is
// not, so frontBranchOK reads it row-major to match the shader's `uHinv * p`.

// Module scratch — all intermediates are preallocated so the hot path (39-64
// builds/frame) allocates nothing per call (R5, GC-churn avoidance). inv3's
// per-call array literals in the lab are exactly what this removes.
const _rowX = new Float64Array(3);
const _rowY = new Float64Array(3);
const _rowW = new Float64Array(3);
const _Hm = new Float64Array(9); // homography, row-major
const _Hi = new Float64Array(9); // its inverse, row-major
const _Cs = new Float64Array(9); // pre-normalization conic, row-major

// Invert a row-major 3×3 into `out`; returns false on non-finite or
// TRUE-singular det (<1e-30) only (R2: this floor is far below the
// |camY|<1e-3 grazing band, so the ring stays drawn through the degenerate
// frame — the double-line conic merely widens the band there).
function inv3Into(m, out) {
  const a = m[0], b = m[1], c = m[2];
  const d = m[3], e = m[4], f = m[5];
  const g = m[6], h = m[7], i = m[8];
  const A = e * i - f * h;
  const B = -(d * i - f * g);
  const C = d * h - e * g;
  const det = a * A + b * B + c * C;
  if (!isFinite(det) || Math.abs(det) < 1e-30) return false;
  const s = 1 / det;
  out[0] = A * s;              out[1] = -(b * i - c * h) * s; out[2] = (b * f - c * e) * s;
  out[3] = B * s;             out[4] = (a * i - c * g) * s;  out[5] = -(a * f - c * d) * s;
  out[6] = C * s;             out[7] = -(a * h - b * g) * s; out[8] = (a * e - b * d) * s;
  return true;
}

/**
 * Build a ring's screen-space conic from its clip-space projection.
 *
 * @param {THREE.Matrix4|number[]|{clipCols:{x:number[],y:number[],w:number[]}}} pvm
 *   The P·V·M matrix (THREE.Matrix4 or a length-16 column-major array), OR the
 *   already-extracted clip rows: x/y/w each length-3 = PVM rows 0/1/3 sampled at
 *   columns [0,2,3] (the local-Y column is dropped — the ring is a planar circle).
 * @param {number} radius ring radius in the ring's local frame
 * @param {number} W sceneTarget width in pixels
 * @param {number} H sceneTarget height in pixels
 * @param {{Cs:Float64Array,Hinv:Float64Array,rowW:Float64Array}} [out]
 *   optional preallocated result to fill (zero-alloc hot path); the field reuses
 *   one per ring slot and packs it before the next call.
 * @returns {{Cs:Float64Array,Hinv:Float64Array,rowW:Float64Array}|null}
 *   Cs max-abs-normalized (max|entry|=1); null ONLY on non-finite / true-singular
 *   det (R2) — never for the grazing degeneracy.
 */
export function buildRingConic(pvm, radius, W, H, out) {
  if (pvm && pvm.clipCols) {
    const { x, y, w } = pvm.clipCols;
    _rowX[0] = x[0]; _rowX[1] = x[1]; _rowX[2] = x[2];
    _rowY[0] = y[0]; _rowY[1] = y[1]; _rowY[2] = y[2];
    _rowW[0] = w[0]; _rowW[1] = w[1]; _rowW[2] = w[2];
  } else {
    const el = pvm.elements || pvm; // column-major: M(r,c) = el[c*4+r]
    _rowX[0] = el[0]; _rowX[1] = el[8]; _rowX[2] = el[12];
    _rowY[0] = el[1]; _rowY[1] = el[9]; _rowY[2] = el[13];
    _rowW[0] = el[3]; _rowW[1] = el[11]; _rowW[2] = el[15];
  }

  // Homography [X,Z,1]_plane → [px,py,1]_screen: fold the NDC→pixel scale
  // (ndc.x·W/2 + W/2 etc., ndc = clip/clip.w) into the clip rows. Third row is
  // the clip-w row, so H⁻¹·p recovers the plane point and its clip w.
  const hw = W * 0.5, hh = H * 0.5;
  _Hm[0] = (_rowX[0] + _rowW[0]) * hw; _Hm[1] = (_rowX[1] + _rowW[1]) * hw; _Hm[2] = (_rowX[2] + _rowW[2]) * hw;
  _Hm[3] = (_rowY[0] + _rowW[0]) * hh; _Hm[4] = (_rowY[1] + _rowW[1]) * hh; _Hm[5] = (_rowY[2] + _rowW[2]) * hh;
  _Hm[6] = _rowW[0];                   _Hm[7] = _rowW[1];                   _Hm[8] = _rowW[2];

  if (!inv3Into(_Hm, _Hi)) return null;

  // Cs = H⁻ᵀ·diag(1,1,-R²)·H⁻¹ ; Cs[i][j] = Σ_k Ck[k]·Hi[k][i]·Hi[k][j].
  const R2 = radius * radius;
  let mx = 0;
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      const s = _Hi[i] * _Hi[j]
              + _Hi[3 + i] * _Hi[3 + j]
              - R2 * _Hi[6 + i] * _Hi[6 + j];
      _Cs[i * 3 + j] = s;
      const av = Math.abs(s);
      if (av > mx) mx = av;
    }
  }
  if (!(mx > 0) || !isFinite(mx)) return null;

  const res = out || { Cs: new Float64Array(9), Hinv: new Float64Array(9), rowW: new Float64Array(3) };
  const inv = 1 / mx; // R1: normalize so max|Cs|=1 → every entry survives float32
  for (let k = 0; k < 9; k++) {
    res.Cs[k] = _Cs[k] * inv;
    res.Hinv[k] = _Hi[k];
  }
  res.rowW[0] = _rowW[0]; res.rowW[1] = _rowW[1]; res.rowW[2] = _rowW[2];
  return res;
}

/**
 * Sampson distance in render pixels: |pᵀCs p| / |2(Cs p).xy| — the byte-mirror
 * of the fragment shader's band test. Scale-invariant in Cs (R1). Cs row-major
 * flat length-9.
 * @returns {number} approximate perpendicular pixel distance from (px,py) to the conic
 */
export function sampsonDistancePx(Cs, px, py) {
  const cx = Cs[0] * px + Cs[1] * py + Cs[2];
  const cy = Cs[3] * px + Cs[4] * py + Cs[5];
  const cz = Cs[6] * px + Cs[7] * py + Cs[8];
  const v = px * cx + py * cy + cz;
  const grad = Math.hypot(2 * cx, 2 * cy);
  return Math.abs(v) / Math.max(grad, 1e-12);
}

/**
 * Front-branch guard: reconstruct the plane point XZ = (Hinv·p).xy / (Hinv·p).z
 * and require its clip w > 0 (in front of the camera). Rejects the behind-camera
 * projective branch that the conic alone can't distinguish. Hinv row-major
 * flat length-9, rowW length-3.
 * @returns {boolean}
 */
export function frontBranchOK(Hinv, rowW, px, py) {
  const qx = Hinv[0] * px + Hinv[1] * py + Hinv[2];
  const qy = Hinv[3] * px + Hinv[4] * py + Hinv[5];
  const qz = Hinv[6] * px + Hinv[7] * py + Hinv[8];
  const X = qx / qz, Z = qy / qz;
  return (rowW[0] * X + rowW[1] * Z + rowW[2]) > 0;
}
