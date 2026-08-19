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
// FRONT-ARC GATE (orbit-ring-phantom-2026-08-12). The extent bound above closes
// the BOUNDED degeneracy. It cannot close the STRADDLING one, and that is not a
// gap in the bound — a ring the camera is inside really does project unbounded.
// The defect there is subtler: Cs is built from adj(H), and as the camera nears
// the ring's plane adj(H) collapses to rank 1, adj(H) ≈ u·vᵀ. Then
//   Cs = adj(H)ᵀ·diag(1,1,−R²)·adj(H) ≈ (u₀² + u₁² − R²u₂²)·v·vᵀ
// — a DOUBLE LINE, and its zero set vᵀp = 0 is precisely the ring plane's
// VANISHING LINE. So the band paints the vanishing line: those pixels are not
// near-misses, they are exactly on the conic the CPU handed the shader.
//
// ⛔ AND NO GUARD BUILT ON adj(H) CAN SEE IT. The reconstruction is
// adj(H)·p = u·(vᵀp), which is ZERO on that same line — a pole. Distance to the
// conic, reconstructed radius and clip-w magnitude are all functions of it, and
// all three were measured dead (artefact doc §7.2: on inclined rings the legit
// and debris classes INVERT under any w bound; the phantom's exact distance to
// the conic, 0.663 px, is SMALLER than the real ring's 0.922 px).
//
// The information survives in the FORWARD map, which is perfectly conditioned
// exactly where the inverse collapses — the same reason axisExtentInto solves
// the extent forward. Along the circle,
//   screen_x(θ) = (R(h0 cosθ + h1 sinθ) + h2) / (R(w0 cosθ + w1 sinθ) + w2)
// so screen_x(θ) = px is LINEAR in (cosθ, sinθ): A cosθ + B sinθ + C = 0, which
// with cos²+sin² = 1 has a closed-form pair of roots — one sqrt, no trig, no
// inverse, no adj(H). Each root is a REAL point of the circle whose clip w is
// evaluated FORWARD, so "is this point in front of the camera" is finally a
// well-conditioned question. frontArcDistPx returns the screen distance to the
// nearest IN-FRONT circle point; the shader rejects a pixel beyond a few px of
// one. Measured over 30 poses (radius 0.18 → 67622, four azimuths, two ring
// inclinations, camera heights 1 → 200, plus five all-legitimate controls):
// every real pixel scores ≤ 1.525 px, every phantom pixel ≥ 6.439 px, nothing
// in between. See docs/FEATURES/orbit-ring-depth-artefact.md §8.
//
// Matrix convention: Cs, Hinv are ROW-MAJOR flat length-9 (M[r*3+c]); rowW is
// length-3. Cs is symmetric so its row/column order is moot for pᵀCs p; Hinv is
// not, so frontBranchOK reads it row-major to match the shader's `uHinv * p`.
// Hfwd is the FORWARD homography, row-major, max-abs normalized (hScale is the
// factor applied, so Hfwd row 2 === hScale·rowW — the shader rebuilds that row
// from the rowW it already fetched instead of spending a texel on it).

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

/**
 * Slack added to the band's own reach to form the front-arc tolerance:
 *   arcTolPx = pixelWidth·0.5 + featherPx + ARC_TOLERANCE_MARGIN_PX
 * At shipping defaults (1.0 / 0.5) that is 3.0 px.
 *
 * SIZED FROM MEASUREMENT, not taste. frontArcDistPx minimizes along a SCREEN
 * AXIS, not along the curve's normal, so it can only ever OVERSTATE the true
 * distance — by at most √2 for a straight curve (min over both axes of
 * d/|cos α| and d/|sin α|). A pixel the band legitimately paints is within
 * 0.5 + 0.5 = 1.0 px of the curve, so its worst honest score is ~1.41, and the
 * measured worst over 30 poses is 1.525. The nearest phantom pixel measured
 * 6.439. 3.0 sits 2× above the worst real and 2.1× below the nearest phantom —
 * near the geometric mean of the gap, which is where a threshold belongs when
 * both ends must survive poses nobody has tried yet.
 *
 * ⚠ It is a SCREEN-PIXEL quantity on both sides, so it is scale-free by
 * construction: the identical margins were measured at ring radius 0.18 and at
 * 67622. Do not rescale it per ring.
 */
/**
 * The band's own reach in render px: the largest Sampson distance at which the shader
 * still paints. The fragment shader drops a pixel at `band < 0.01`, and its band is
 * `1 - smoothstep(pw*0.5, pw*0.5 + feather, d)`, so the cutoff is where
 * `3t² − 2t³ = 0.99`, i.e. t = 0.941096864 — NOT 0.5, which is the midpoint and would
 * give 0.75. At shipping defaults (1.0 / 0.5) the reach is 0.970548 px.
 *
 * This is the window the DEPTH rule selects covering roots with (frontArcDepthW). It is
 * deliberately NOT the gate's uArcTolPx: see that function for the 5962x measurement.
 */
export const BAND_ALPHA_CUTOFF_T = 0.941096864;
export function bandReachPx(pixelWidth, featherPx) {
  return pixelWidth * 0.5 + featherPx * BAND_ALPHA_CUTOFF_T;
}

export const ARC_TOLERANCE_MARGIN_PX = 2.0;

/** The shader's uArcTolPx, in one place so CPU and GLSL cannot drift. */
export function arcTolerancePx(pixelWidth, featherPx) {
  return pixelWidth * 0.5 + featherPx + ARC_TOLERANCE_MARGIN_PX;
}

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
 *   circle crosses the camera plane, or an EMPTY extent (min=+UNBOUNDED,
 *   max=−UNBOUNDED ⇒ withinRingExtent false everywhere) when the whole circle is
 *   BEHIND the camera and nothing should be painted. null ONLY on a non-finite /
 *   rank-≤1 H — never for the grazing OR the exactly-edge-on degeneracy.
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
  if (!res.Hfwd) res.Hfwd = new Float64Array(9);
  const inv = 1 / mx; // R1: normalize so max|Cs|=1 → every entry survives float32
  for (let k = 0; k < 9; k++) {
    res.Cs[k] = _Cs[k] * inv;
    res.Hinv[k] = _Hi[k];
  }
  res.rowW[0] = _rowW[0]; res.rowW[1] = _rowW[1]; res.rowW[2] = _rowW[2];

  // FORWARD homography for the front-arc gate, max-abs normalized so the float32
  // pack keeps its digits. Every use is scale-invariant — screen coords are the
  // RATIO of its rows, and the gate only reads the SIGN of the clip w — so the
  // normalization is free. hScale is kept because row 2 of Hfwd is exactly
  // hScale·rowW, which is how the shader rebuilds it without a third texel.
  let hmx = 0;
  for (let k = 0; k < 9; k++) { const av = Math.abs(_Hm[k]); if (av > hmx) hmx = av; }
  const hs = hmx > 0 && isFinite(hmx) ? 1 / hmx : 0;
  for (let k = 0; k < 9; k++) res.Hfwd[k] = _Hm[k] * hs;
  res.hScale = hs;

  // Extent bound. clip-w along the circle is w(θ) = radius·(H20 cosθ + H21 sinθ)
  // + H22, whose minimum is H22 − radius·hypot(H20,H21) in closed form. Positive
  // ⇒ the whole circle is in front of the camera ⇒ the projection is a bounded
  // closed curve AND there is no behind-camera branch to worry about. Otherwise
  // the curve is a real hyperbola: leave it unbounded (that IS what the sky looks
  // like from inside an orbit) and let the front-branch guard do its job.
  const b = res.bounds;
  const wSpan = radius * Math.hypot(_Hm[6], _Hm[7]);
  const wMin = _Hm[8] - wSpan;
  const wMax = _Hm[8] + wSpan;

  // ⭐ orbit-ring-phantom-2026-08-11 — THE THIRD CASE. clip-w around the circle
  // spans [wMin, wMax], and that admits THREE geometries, not two:
  //   wMin > 0        whole circle IN FRONT   -> bounded closed curve (below)
  //   wMin < 0 < wMax straddles the camera    -> genuinely a hyperbola (sentinel)
  //   wMax <= 0       whole circle BEHIND     -> nothing to draw AT ALL
  // Only the first two were handled: everything that failed `wMin > 0` fell
  // through to the unbounded sentinel, so a ring entirely behind the camera got
  // its extent reject DISABLED — and the extent reject is the only thing bounding
  // the edge-on degeneracy's infinite zero set (see the header + the shader's
  // EXTENT REJECT comment). The band then painted the ring PLANE's vanishing line
  // clean across the screen, in directions containing no ring, wherever the
  // reconstructed w_clip happened to come out positive — which, at a point at
  // infinity, is numerically arbitrary. MEASURED live 2026-08-11: from the
  // outermost planet looking AWAY from the star, 13 of 17 conics were behind the
  // camera (one of them radius 0.18 at 7183 units) and every one carried the
  // "genuinely unbounded" sentinel; the resulting line sat on the ecliptic's
  // vanishing line at y=155 of 855, 2px from where Max was seeing it.
  //
  // An EMPTY extent (min > max) rather than null: `null` means a non-finite /
  // rank-<=1 H and that contract is relied on upstream (update() -> active=0,
  // which zeroes the conic rows). The extent reject runs BEFORE the front-branch
  // guard in the shader, so an inverted AABB rejects every pixel with no GLSL
  // change. `!(wMax > 0)` and not `wMax <= 0` so a NaN culls rather than leaks.
  if (!(wMax > 0)) {
    b[0] = CONIC_EXTENT_UNBOUNDED;  b[1] = CONIC_EXTENT_UNBOUNDED;
    b[2] = -CONIC_EXTENT_UNBOUNDED; b[3] = -CONIC_EXTENT_UNBOUNDED;
    return res;
  }

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

// One candidate root of the axis solve: forward-project the circle point at
// (cosθ,sinθ) = cs and return its screen distance to the pixel — or Infinity if
// that point is BEHIND the camera, which is the whole purpose. Unlike
// frontBranchOK's sign test on a reconstructed point, w here is evaluated on a
// point known to be ON the circle, so it stays meaningful when adj(H) does not.
function arcRootEval(Hfwd, rowW, radius, px, py, c, s, out, discs = null, nDisc = 0) {
  const X = radius * c, Z = radius * s;
  const wn = Hfwd[6] * X + Hfwd[7] * Z + Hfwd[8];
  if (!(wn > 0)) { out.dist = Infinity; out.w = 0; return out; }
  // OCCLUDER DISCS — the JS mirror of the fragment shader's rows-10+ loop
  // (orbit-line-local-system-occlusion-2026-08-18). `discs` is a flat (cx, cz, reff2)
  // triple list ALREADY in this ring's plane frame, exactly as the texture carries it,
  // and X/Z above are the same (X, Z) the GLSL calls q.xy. A masked point is A ROOT THAT
  // DOES NOT EXIST — the same Infinity/1.0e30 sentinel the behind-camera branch uses.
  //
  // ⚠ Params here, GLSL globals there. That asymmetry is deliberate, not drift: threading
  // them through the JS arcAxisInto is free, but doing it in GLSL would edit the arcAxis
  // call line that tools/conic-gl-gate.mjs:189 (M16) replaces literally, FATALing the gate
  // on a no-op change. "Byte-mirror" in this file means numerical parity, not one signature.
  for (let k = 0; k < nDisc; k++) {
    const o = k * 3;
    const ex = X - discs[o], ez = Z - discs[o + 1];
    if (ex * ex + ez * ez < discs[o + 2]) { out.dist = Infinity; out.w = 0; return out; }
  }
  const sx = (Hfwd[0] * X + Hfwd[1] * Z + Hfwd[2]) / wn;
  const sy = (Hfwd[3] * X + Hfwd[4] * Z + Hfwd[5]) / wn;
  out.dist = Math.hypot(sx - px, sy - py);
  // ⛔ THE DEPTH COMES FROM rowW, NOT FROM Hfwd. Hfwd is max-abs normalized, so the
  // w it yields is hScale * the true clip w. Ordering is unaffected (hScale > 0) so
  // SELECTION could use either, but the value WRITTEN must be the true one — the
  // wrong choice writes 5.3e-7x the correct depth. rowW is unnormalized and the
  // shader already has it in t6.xyz, so this costs nothing.
  out.w = rowW ? rowW[0] * X + rowW[1] * Z + rowW[2] : 0;
  return out;
}
const _rootA = { dist: Infinity, w: 0 };
const _rootB = { dist: Infinity, w: 0 };

// Fold one evaluated root into the running accumulator:
//   acc.dist / acc.w  — the SCREEN-ARGMIN root (the §8 coverage gate's value, and the
//                       depth fallback when nothing covers the pixel)
//   acc.minW          — the smallest clip w among roots that actually COVER the pixel
function foldRoot(r, reach, acc) {
  if (r.dist < acc.dist) { acc.dist = r.dist; acc.w = r.w; }
  if (r.dist <= reach && r.w < acc.minW) acc.minW = r.w;
  return acc;
}

// Solve screen_axis(θ) = the pixel's coordinate on that axis. A cosθ + B sinθ +
// C = 0 with cos² + sin² = 1 → the closed-form root pair below (verify: A·c +
// B·s = −C and c² + s² = 1 both fall out identically). ONE sqrt, no trig.
function arcAxisInto(Hfwd, rowW, radius, px, py, axis, reach, acc, discs = null, nDisc = 0) {
  const h0 = axis === 0 ? Hfwd[0] : Hfwd[3];
  const h1 = axis === 0 ? Hfwd[1] : Hfwd[4];
  const h2 = axis === 0 ? Hfwd[2] : Hfwd[5];
  const t = axis === 0 ? px : py;
  const A = radius * (h0 - t * Hfwd[6]);
  const B = radius * (h1 - t * Hfwd[7]);
  const C = h2 - t * Hfwd[8];
  const M2 = A * A + B * B;
  if (!(M2 > 0)) return acc;
  const disc = M2 - C * C;
  if (disc >= 0) {
    const sq = Math.sqrt(disc), iv = 1 / M2;
    foldRoot(arcRootEval(Hfwd, rowW, radius, px, py, (-A * C + B * sq) * iv, (-B * C - A * sq) * iv, _rootA, discs, nDisc), reach, acc);
    foldRoot(arcRootEval(Hfwd, rowW, radius, px, py, (-A * C - B * sq) * iv, (-B * C + A * sq) * iv, _rootB, discs, nDisc), reach, acc);
    return acc;
  }
  // No root on this axis: this screen row/column misses the curve outright.
  // Clamp to the θ that comes CLOSEST (the curve's extremum on this axis)
  // instead of hard-rejecting, so a pixel one step outside a vertical or
  // horizontal tangency — where the band legitimately still paints its feather —
  // is scored by its real distance. The other axis is well-conditioned there and
  // the min takes it anyway; this only keeps the degenerate axis honest.
  const M = Math.sqrt(M2), sg = C >= 0 ? -1 : 1;
  return foldRoot(arcRootEval(Hfwd, rowW, radius, px, py, sg * A / M, sg * B / M, _rootA, discs, nDisc), reach, acc);
}

const _acc = { dist: Infinity, w: 0, minW: Infinity };
function arcSolve(Hfwd, rowW, radius, px, py, reach, discs = null, nDisc = 0) {
  _acc.dist = Infinity; _acc.w = 0; _acc.minW = Infinity;
  arcAxisInto(Hfwd, rowW, radius, px, py, 0, reach, _acc, discs, nDisc);
  arcAxisInto(Hfwd, rowW, radius, px, py, 1, reach, _acc, discs, nDisc);
  return _acc;
}

/**
 * Front-arc distance in render pixels — byte-mirror of the fragment shader's
 * front-arc gate, and the ONLY test here that does not read adj(H).
 *
 * Returns the screen distance from (px,py) to the nearest point of the part of
 * the ring circle that is IN FRONT of the camera, minimized over both screen
 * axes. Because each axis solve is a CONSTRAINED minimum it can only overstate
 * the true distance (bounded by √2 for a locally straight curve) — it can never
 * understate it, so it cannot silently keep a phantom pixel.
 *
 * @param {Float64Array|Float32Array|number[]} Hfwd forward homography, row-major length-9
 * @param {number} radius ring radius in the ring's local frame
 * @returns {number} px distance to the nearest in-front circle point (Infinity if none)
 */
export function frontArcDistPx(Hfwd, radius, px, py, discs = null, nDisc = 0) {
  return arcSolve(Hfwd, null, radius, px, py, 0, discs, nDisc).dist;
}

/**
 * Is the circle point at angle θ masked by one of this ring's occluder discs?
 * (orbit-line-local-system-occlusion-2026-08-18.) The predicate alone, with no camera
 * and no projection — which is the whole reason AC-GAP's "exactly one contiguous gap"
 * is provable headlessly and at EVERY pose rather than at the one pose it is measured at.
 *
 * @param {number} radius ring radius in the ring's local frame
 * @param {number} theta  angle on the circle, radians
 * @param {Float64Array|number[]} discs flat (cx, cz, reff2) triples in the RING'S plane frame
 * @param {number} nDisc  how many triples apply
 * @returns {boolean} true if that point lies inside a disc and is therefore not drawn
 */
export function arcPointMasked(radius, theta, discs, nDisc) {
  const X = radius * Math.cos(theta), Z = radius * Math.sin(theta);
  for (let k = 0; k < nDisc; k++) {
    const o = k * 3;
    const ex = X - discs[o], ez = Z - discs[o + 1];
    if (ex * ex + ez * ez < discs[o + 2]) return true;
  }
  return false;
}

/**
 * Depth for a painted ring pixel — byte-mirror of the fragment shader's depth write
 * (orbit-ring-depth-2026-08-12, artefact doc §9/§10). Same roots, same sqrt, no extra
 * texelFetch: it reads what frontArcDistPx already throws away.
 *
 * ⛔ WHY NOT THE SCREEN-NEAREST ROOT — that was candidate 4, and it is refuted (§9).
 * Near edge-on the projected ellipse is THIN, so the ring's near point (w=wMin) and far
 * point (w=wMax) both land within the band's reach of one pixel and BOTH genuinely cover
 * it. Screen distance cannot rank them; occlusion needs the SMALLER w. The error is
 * exactly wMax/wMin = (d+R)/(d−R) — unbounded as the camera approaches the ring, measured
 * 1001× at d=1.002R — and it points at Max's no-vanish ruling (d7db3a3): it HIDES line the
 * shipped shader draws.
 *
 * ⛔ AND THE WINDOW MUST BE THE BAND'S REACH, NOT THE GATE'S TOLERANCE. Roots between the
 * two are points that do NOT cover the pixel; folding them into the minimum writes the near
 * arc's depth where the near arc is not there — measured 5962× TOO NEAR on 557 of 1114 px
 * at Max's own repro pose, i.e. §2's leak recreated by the fix. The margin is thin and
 * measured: the nearest root that must be rejected sits at 0.999722 px against a reach of
 * 0.970548, so there is 0.0292 px of headroom. Do not round this constant.
 *
 * @param {Float64Array|Float32Array|number[]} Hfwd forward homography, row-major length-9
 * @param {Float64Array|Float32Array|number[]} rowW UNNORMALIZED clip-w row (the true depth)
 * @param {number} reach bandReachPx(pixelWidth, featherPx)
 * @returns {{dist:number, w:number}} gate distance, and the clip w to write
 */
export function frontArcDepthW(Hfwd, rowW, radius, px, py, reach, discs = null, nDisc = 0) {
  const a = arcSolve(Hfwd, rowW, radius, px, py, reach, discs, nDisc);
  return { dist: a.dist, w: a.minW < Infinity ? a.minW : a.w };
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
 *
 * ⚠ This is a SIGN test on a reconstruction, so it is blind in exactly the
 * regime frontArcDistPx exists for: where adj(H) is rank-1 the reconstructed w
 * is numerically arbitrary and a 190×-too-far point still reports positive.
 * Kept because the wclip it produces is what the depth write needs; it is no
 * longer the last word on coverage.
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
