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
// EXPORTED for GLSL-mirror-parity: sampsonDistancePx / frontBranchOK /
// withinRingExtent are the byte-mirror of the fragment shader's per-pixel
// evaluation, so the headless suite pins the shader's math (same discipline as
// proximityFadeFactor).
//
// EXTENT BOUND (edge-on degeneracy fix). A conic has NO ENDPOINTS: when the
// camera aligns with the ring plane H goes singular, Cs drops to a rank-1
// double line and its zero set is an INFINITE LINE, so the Sampson band paints
// across and far beyond the screen (measured: 163px -> 16000px+ as elevation
// falls, against a true 126px extent). The old |det|<1e-30 reject didn't bound
// it — it only made the ring VANISH at exactly 0. So the bound is EXPLICIT:
// buildRingConic also returns the ring's screen-space AABB, solved analytically
// from the FORWARD map (perfectly conditioned at the degeneracy), and the band
// test rejects outside it. AABB ∩ line == the true SEGMENT and AABB ∩ ellipse
// == the ellipse, so the bound is exact at both ends of the ladder and merely
// conservative in between — no pop. When the circle crosses the camera plane
// the projection is GENUINELY unbounded (a hyperbola that really does sweep
// off-screen) and the ±CONIC_EXTENT_UNBOUNDED sentinel disables the bound.
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
const _ext = new Float64Array(2); // one axis' [min,max] screen extent

/**
 * Half-extent sentinel meaning "this ring's projection is genuinely unbounded"
 * (the circle crosses the camera plane, so the conic really is a hyperbola that
 * sweeps off-screen). Packed as the bounds so the extent test becomes a no-op.
 */
export const CONIC_EXTENT_UNBOUNDED = 1e30;

// ADJUGATE, not inverse (row-major 3×3 -> `out`, max-abs normalized).
//
// Everything downstream uses H⁻¹ only in scale-invariant ways: Cs = H⁻ᵀ·Ĉ·H⁻¹
// is max-abs-normalized (R1) and the plane point is the RATIO (H⁻¹p).xy/(H⁻¹p).z.
// adj(H) = det(H)·H⁻¹, so substituting it changes NOTHING for det≠0 (Cs picks up
// det², positive, which normalization divides straight back out; the ratio's det
// cancels) while staying a plain polynomial in H — perfectly well-defined AT
// det=0. That is what stops the ring VANISHING edge-on: the old inv3 rejected
// |det|<1e-30 and returned null there. Returns false only on non-finite or an
// all-zero adjugate (a truly rank-≤1 H, e.g. a zeroed matrixWorld).
function adj3Into(m, out) {
  const a = m[0], b = m[1], c = m[2];
  const d = m[3], e = m[4], f = m[5];
  const g = m[6], h = m[7], i = m[8];
  out[0] = e * i - f * h;    out[1] = -(b * i - c * h); out[2] = b * f - c * e;
  out[3] = -(d * i - f * g); out[4] = a * i - c * g;    out[5] = -(a * f - c * d);
  out[6] = d * h - e * g;    out[7] = -(a * h - b * g); out[8] = a * e - b * d;
  let mx = 0;
  for (let k = 0; k < 9; k++) {
    const v = out[k];
    if (!isFinite(v)) return false;
    const av = Math.abs(v);
    if (av > mx) mx = av;
  }
  if (!(mx > 0)) return false;
  const s = 1 / mx; // keeps the float32 upload in range; ratios are unaffected
  for (let k = 0; k < 9; k++) out[k] *= s;
  return true;
}

// Screen extent of the projected circle on ONE axis, into _ext = [min,max].
//
// Along the circle, screen coord = num(θ)/den(θ) with
//   num = R(h0 cosθ + h1 sinθ) + h2 ,  den = R(w0 cosθ + w1 sinθ) + w2
// (h = the H row for this axis, w = H's third row = the clip-w row). Setting
// num'·den − num·den' = 0 collapses — every cos²/sin²/cos·sin term cancels — to
//   K + A cosθ + B sinθ = 0,  K = R²(h1w0 − h0w1), A = R(h1w2 − h2w1), B = R(h2w0 − h0w2)
// i.e. M·cos(θ − atan2(B,A)) = −K with M = hypot(A,B). Two stationary θ, both
// evaluated forward — NO inverse anywhere, so this is exact and stable at the
// edge-on degeneracy. ONLY valid once the caller has established wMin > 0.
function axisExtentInto(h0, h1, h2, w0, w1, w2, R) {
  // Deflate h's component along w first: (num - lam*den)/den = num/den - lam, so
  // the stationary theta are UNCHANGED (K/A/B are 2x2 minors of [h;w], invariant
  // under h -> h - lam*w) while the minors stop losing all their digits to
  // cancellation in the near-edge-on regime, where h is very nearly parallel to
  // w. EXACTLY edge-on the screen row is constant along the circle: h ∥ w, the
  // deflated row is 0, and the extent collapses to the single value lam.
  const ww = w0 * w0 + w1 * w1 + w2 * w2;
  const lam = ww > 0 ? (h0 * w0 + h1 * w1 + h2 * w2) / ww : 0;
  const a0 = h0 - lam * w0, a1 = h1 - lam * w1, a2 = h2 - lam * w2;

  const K = R * R * (a1 * w0 - a0 * w1);
  const A = R * (a1 * w2 - a2 * w1);
  const B = R * (a2 * w0 - a0 * w2);
  const M = Math.hypot(A, B);

  // wMin > 0 => den > 0 for every theta => the ratio is a smooth periodic
  // function and MUST attain its extrema, so clamp the acos argument rather than
  // reject it; M == 0 is the constant-coordinate case above, where both roots
  // collapse onto theta = 0 and lo == hi == lam.
  const phi = M > 0 ? Math.atan2(B, A) : 0;
  const dth = M > 0 ? Math.acos(Math.max(-1, Math.min(1, -K / M))) : 0;
  let lo = Infinity, hi = -Infinity;
  for (let k = 0; k < 2; k++) {
    const th = k === 0 ? phi + dth : phi - dth;
    const c = Math.cos(th), s = Math.sin(th);
    const v = (R * (a0 * c + a1 * s) + a2) / (R * (w0 * c + w1 * s) + w2) + lam;
    if (!isFinite(v)) return false;
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  _ext[0] = lo; _ext[1] = hi;
  return true;
}

/**
 * Build a ring's screen-space conic from its clip-space projection.
 *
 * @param {THREE.Matrix4|number[]|{clipCols:{x:number[],y:number[],w:number[]}}} pvm
 *   The P·V·M matrix (THREE.Matrix4 or a length-16 column-major array), OR the
 *   already-extracted clip rows: x/y/w each length-3 = PVM rows 0/1/3 sampled at
 *   columns [0,2,3] (the local-Y column is dropped — the ring is a planar circle).
 * @param {number} radius ring radius in the ring's local frame (drives BOTH the conic and its extent)
 * @param {number} W sceneTarget width in pixels
 * @param {number} H sceneTarget height in pixels
 * @param {{Cs:Float64Array,Hinv:Float64Array,rowW:Float64Array,bounds:Float64Array}} [out]
 *   optional preallocated result to fill (zero-alloc hot path); the field reuses
 *   one per ring slot and packs it before the next call.
 * @returns {{Cs:Float64Array,Hinv:Float64Array,rowW:Float64Array,bounds:Float64Array}|null}
 *   Cs max-abs-normalized (max|entry|=1); Hinv is adj(H) (see adj3Into — the same
 *   thing up to a scale nothing downstream can see); bounds = [minX,minY,maxX,maxY]
 *   render-pixel AABB of the ring's projection, or ±CONIC_EXTENT_UNBOUNDED when the
 *   circle crosses the camera plane. null ONLY on a non-finite / rank-≤1 H — never
 *   for the grazing OR the exactly-edge-on degeneracy.
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

  if (!adj3Into(_Hm, _Hi)) return null;

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
  if (!res.bounds) res.bounds = new Float64Array(4);
  const inv = 1 / mx; // R1: normalize so max|Cs|=1 → every entry survives float32
  for (let k = 0; k < 9; k++) {
    res.Cs[k] = _Cs[k] * inv;
    res.Hinv[k] = _Hi[k];
  }
  res.rowW[0] = _rowW[0]; res.rowW[1] = _rowW[1]; res.rowW[2] = _rowW[2];

  // Extent bound. clip-w along the circle is w(θ) = radius·(H20 cosθ + H21 sinθ)
  // + H22, whose minimum is H22 − radius·hypot(H20,H21) in closed form. Positive
  // ⇒ the whole circle is in front of the camera ⇒ the projection is a bounded
  // closed curve AND there is no behind-camera branch to worry about. Otherwise
  // the curve is a real hyperbola: leave it unbounded (that IS what the sky looks
  // like from inside an orbit) and let the front-branch guard do its job.
  const b = res.bounds;
  const wMin = _Hm[8] - radius * Math.hypot(_Hm[6], _Hm[7]);
  if (wMin > 0
      && axisExtentInto(_Hm[0], _Hm[1], _Hm[2], _Hm[6], _Hm[7], _Hm[8], radius)) {
    b[0] = _ext[0]; b[2] = _ext[1];
    if (axisExtentInto(_Hm[3], _Hm[4], _Hm[5], _Hm[6], _Hm[7], _Hm[8], radius)) {
      b[1] = _ext[0]; b[3] = _ext[1];
      return res;
    }
  }
  b[0] = -CONIC_EXTENT_UNBOUNDED; b[1] = -CONIC_EXTENT_UNBOUNDED;
  b[2] = CONIC_EXTENT_UNBOUNDED;  b[3] = CONIC_EXTENT_UNBOUNDED;
  return res;
}

/**
 * Screen-extent reject — byte-mirror of the fragment shader's AABB test. The
 * margin absorbs the band's own half-width + feather so the bound never eats a
 * pixel the Sampson band legitimately paints at the curve's extremes.
 * @param {Float64Array|Float32Array|number[]} bounds [minX,minY,maxX,maxY]
 * @returns {boolean} true if (px,py) is inside the ring's projected extent
 */
export function withinRingExtent(bounds, px, py, marginPx) {
  return px >= bounds[0] - marginPx && px <= bounds[2] + marginPx
      && py >= bounds[1] - marginPx && py <= bounds[3] + marginPx;
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
 *
 * `extentBounded` mirrors the shader's degenerate fallback. When the extent bound
 * is live the WHOLE circle is in front of the camera, so there is no behind-camera
 * branch left to reject and a non-positive (or NaN) w can only be the degenerate
 * reconstruction: edge-on, adj(H) is rank-1, every pixel reconstructs to the SAME
 * point-at-infinity and w collapses to 0. The shader then falls back to the ring
 * centre's clip w (= rowW[2] > wMin > 0), so the ring is depth-sorted instead of
 * vanishing — which is exactly what Max ruled against.
 * @returns {boolean}
 */
export function frontBranchOK(Hinv, rowW, px, py, extentBounded = false) {
  const qx = Hinv[0] * px + Hinv[1] * py + Hinv[2];
  const qy = Hinv[3] * px + Hinv[4] * py + Hinv[5];
  const qz = Hinv[6] * px + Hinv[7] * py + Hinv[8];
  const X = qx / qz, Z = qy / qz;
  const w = rowW[0] * X + rowW[1] * Z + rowW[2];
  if (w > 0) return true;
  return extentBounded && rowW[2] > 0;
}
