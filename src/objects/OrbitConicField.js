import * as THREE from 'three';
import { buildRingConic, CONIC_EXTENT_UNBOUNDED, arcTolerancePx, BAND_ALPHA_CUTOFF_T } from './ringConic.js';

/**
 * OrbitConicField — one fullscreen pass that paints every orbit ring's
 * screen-space conic (orbit-ring-conic Slice B; advances AC2-AC6, AC8).
 *
 * WHAT THIS IS
 * ------------
 * The 39 per-ring OrbitRingSDF quads collapse to ONE PlaneGeometry(2,2) mesh
 * drawn with a clip-space passthrough vertex shader. Per frame the CPU builds
 * each ring's screen conic via the proven Slice A math (ringConic.js), packs
 * every ring's conic + Hinv + rowW + color/alpha into an RGBA32F DataTexture,
 * and the fragment shader — for every sceneTarget pixel — loops the live ring
 * set, tests the Sampson distance band, guards the front branch, applies the
 * per-ring angular-size fade, and (over all band-passing rings at that pixel)
 * writes the FRONT-MOST ring's color + alpha + log-depth TOGETHER (argmax by
 * clip-w; never decoupled - D-4), with a co-depth tie-break: where rings compress
 * onto the horizon (equal clip-w within CONIC_WCLIP_TIE_EPS) the pixel is owned by
 * the ring that covers it most, killing the grazing argmax flap (Slice B b6 fix).
 *
 * WHY A DataTexture, NOT A UNIFORM ARRAY (D-3)
 * --------------------------------------------
 * At CONIC_MAX=64 a fixed `uniform mat3 uConic[64]` layout declares ~640 vec4
 * that the shader must COMPILE, blowing the common 224-256
 * MAX_FRAGMENT_UNIFORM_VECTORS floor on integrated/mobile GPUs. The lab probe
 * only ever proved CONIC_MAX=16. So per-ring data lives in an `RGBA32F`
 * DataTexture (CONIC_MAX wide x CONIC_TEX_ROWS tall), read with `texelFetch`,
 * NEAREST, no mips — WebGL2-native and unbounded by the uniform budget. This is
 * the single shipping data path.
 *
 * REBASE IMMUNITY (D-1b)
 * ----------------------
 * The vertex shader writes clip space directly (no modelMatrix/modelViewMatrix/
 * projectionMatrix), frustumCulled:false — so world-origin rebasing shifting
 * this mesh's .position can never move the fullscreen quad off-center. Pinned by
 * a unit assertion (b5c) on CONIC_VERTEX_SHADER.
 *
 * SCOPE (Slice B)
 * ---------------
 * Consumes GENERIC descriptors {matrixWorld, radius, color, alpha, active}. It
 * knows NOTHING about OrbitLine — that re-route (proxy meshes, param bag, prox
 * fade) is Slice C. Here the caller (the lab, then main.js) folds whatever it
 * wants into the descriptor `alpha`; the field multiplies the angular-size fade
 * on top and owns depth + overlap.
 */

// Per-frame ceiling. Rings past this are dropped (order largest-angular-size-first
// upstream so any drop is the least-visible sub-pixel ring).
//
// ⚠ The old note here said "58 rings (8 planets x (1+6 moons) + 2 binary-star)". Both
// halves were wrong and it is corrected rather than deleted so nobody re-derives it:
// Sol's Saturn is `moonCount: 9` (SolarSystemData.js:349), not 6, and Sol carries 13
// planet RECORDS, not 8. Sol is in fact the worst shipped system — 13 heliocentric +
// 26 moon + 5 barycentric extras = 44 rings — still comfortably under 64. Procgen
// systems cap at 8 planets (StarSystemGenerator.js:80-81, clamped at :499).
export const CONIC_MAX = 64;

// Per-frame OCCLUDER-DISC ceiling (orbit-line-local-system-occlusion-2026-08-18).
// Sized the way CONIC_MAX is, and note what it bounds: the DISC LIST, not the
// per-ring count. That makes per-ring truncation IMPOSSIBLE rather than merely
// unlikely, since nk <= discCount <= KEEPOUT_MAX by construction.
//
//   procgen: the largest `planetRange` upper bound is 8 (StarSystemGenerator.js:80-81,
//            spectral classes F and G) and the roll is clamped to it (:499).
//   known:   :502 `Math.max(rolledPlanetCount, knownSorted.length)` is the one path
//            that can exceed the roll. Its only shipped instance is Sol, which has 13
//            planet records of which exactly 8 carry moons (5 of the 13 `moons:` lists
//            are empty; enumerated by tools/barycentre-probe.mjs section 3 as earth,
//            mars, jupiter, saturn, uranus, neptune, pluto, eris — and nothing else).
//
// Headroom is free at runtime: the GLSL loop breaks on the per-ring `nk` exactly as the
// ring loop breaks on uCount (:252), so the bound costs compile-time unroll capacity and
// 8 texture rows (8 KB) only. Should a future system ever exceed 8 moon-bearing planets,
// discs are dropped SMALLEST-RADIUS-FIRST — the same least-visible-first drop discipline
// CONIC_MAX uses above.
export const KEEPOUT_MAX = 8;

// DataTexture is CONIC_MAX wide x CONIC_TEX_ROWS tall, RGBA32F. Per ring (one
// texel column) rows 0-9 carry:
//   row 0: Cs[0..3]                 row 4: Hinv[4..7]
//   row 1: Cs[4..7]                 row 5: Hinv[8], bMinX, bMinY, bMaxX
//   row 2: Cs[8], radius, camDist, active
//   row 3: Hinv[0..3]              row 6: rowW[0..2], bMaxY
//                                   row 7: color.rgb, alpha
//   row 8: Hfwd[0..3]              row 9: Hfwd[4..5], hScale, (spare)
// (Cs 3 texels + Hinv 3 texels + rowW 1 texel + color/alpha 1 texel = 8; the
// radius/camDist/active scalars ride the 3 spare slots of the Cs group's last
// texel, so the plan's 8-texel grouping is honored exactly.) The ring's screen
// AABB (ringConic.js `bounds`) rides the 4 remaining spare slots of the Hinv/rowW
// texels — no extra row, no extra texelFetch, since rows 5 and 6 are already read.
//
// ⭐ ROWS 8-9 ARE THE FORWARD MAP (orbit-ring-phantom-2026-08-12), and they are
// the ONE thing here that is not derived from adj(H). Only Hfwd's first two ROWS
// ride the texture: its third row is exactly hScale·rowW by construction, and
// rowW is already fetched at row 6 — so the front-arc gate costs 2 texelFetch,
// not 3, and cannot desync from rowW. See ringConic.js's FRONT-ARC GATE note for
// why the forward map is the only well-conditioned object in this regime.
//
// ⭐ ROWS 10..17 ARE THE OCCLUDER DISCS (orbit-line-local-system-occlusion-2026-08-18).
// Row 10+k, column i = ring i's k-th APPLICABLE keep-out disc, and `nk` — how many of
// them apply to ring i — rides row 9 slot 3, which nothing read before (the shader's
// only row-9 reads are t9.x/.y/.z at the front-arc call; readConic reads o9+2 and stops).
//
//   row 10+k: cx, cz, Reff2, (reserved)
//
// ⛔ cx/cz are the disc centre expressed in RING i's OWN PLANE FRAME, not world space.
// That is the whole trick: `arcRoot` already builds the circle point as
// `q = vec3(radius*cos, radius*sin, 1.0)`, and `q.xy` IS (X, Z) in that frame — the JS
// mirror names them so at ringConic.js:371, and ringConic.js:211 records that the local-Y
// column is dropped because the ring is a planar circle. So the per-pixel test is a 2-D
// distance against a texel we transform CPU-side once per (ring, disc), with no matrix
// inverse in the shader and no dependence on adj(H), whose rank-1 collapse at grazing is
// the exact regime the front-arc gate exists to escape.
//
// Reff2 = R² − cy² folds the out-of-plane offset in, so the disc arrives pre-flattened to
// the circle the BALL cuts in the ring's plane. ⛔ Subtract-then-square, never the
// `cos(θ−φ) > K` closed form: at a real heliocentric radius of 67622 against a ~20-unit
// ball, 1 − cos Δθ ≈ 4e-8, which is below float32 resolution near 1, and the gap would
// vanish silently.
export const CONIC_TEX_ROWS = 18;

// Angular-size fade band: a ring is fully visible (fade 1) once its projected
// radius reaches uAngCutoffPx render px, and fades smoothly to 0 as it collapses
// toward ANGULAR_FADE_LO_FRAC * cutoff. Below that it is a sub-pixel dot (AC8's
// "persistent dots") and is removed.
const ANGULAR_FADE_LO_FRAC = 0.5;

// Relative-w_clip tie-break epsilon for the overlap selection (grazing-drift fix,
// 2026-07-21). At grazing poses many rings compress onto the horizon line where
// their reconstructed clip-w becomes co-depth: at overlap pixels the two front
// rings' w_clip differ by a RELATIVE gap of ~0 (measured: 100% within 0.005; the
// per-frame w_clip jitter floor is ~6e-6). Under a strict `<` argmax the winner
// then flaps frame-to-frame on sub-0.3% float differences, and because each
// candidate carries its own band COVERAGE the winner's alpha flaps with it —
// suppressing and toggling the painted line (the 0.222 vs probe-0.089 regression,
// Slice B b6). This epsilon defines the co-depth band within which rings are
// treated as one depth and the pixel is owned by the ring that actually COVERS it
// most (highest band coverage `a`), deterministically. Sized from the measured
// w_clip spread: 0.005 sits above the ~0.003 co-depth plateau knee (below it the
// noise-flips leak through) and below the ~0.01 where it would start overriding
// genuine front-most color at real crossings (b5b stays 100% at 0.005, breaks at
// 0.01). Grazing toggle-per-green: 0.222 -> 0.094 (probe class), b5b 100%,
// dead-zone/gentle unchanged. Stateless: a pure function of the frame's ring set,
// no temporal state in the shader.
const CONIC_WCLIP_TIE_EPS = 0.005;

// CALIBRATED default cutoff (2026-07-21, lab-battery b8b) — see the class doc +
// `angularCutoffPx` option. 1.0 render px of PROJECTED RADIUS, fade band
// [0.5, 1.0]. Pinned to the MEASURED shipped-SDF angular dropout per ring class
// (planet ~0.8 px, moon ~0.45-0.6 px): full removal at 0.5 px sits at/below both
// classes' SDF dropouts, so the fade removes a ring only where shipped-SDF also
// drops it — 0 anti-vanish cells across the b8 perRing ladder (the provisional
// 2.0 produced 4). Settable via ctor {angularCutoffPx} and setAngularCutoff().
export const DEFAULT_ANGULAR_CUTOFF_PX = 1.0;

/**
 * JS mirror of the shader's angular-size fade (GLSL-mirror-parity discipline,
 * same reason sampsonDistancePx / proximityFadeFactor are exported). Returns 1
 * above the cutoff, smoothly 0 below, monotone in projected size, per-ring.
 *
 * @param {number} radius     ring radius in scene units
 * @param {number} camDist    3D camera distance to the ring center in scene units
 * @param {number} fovDeg     vertical camera FOV in degrees
 * @param {number} viewportH  render-target height in pixels (the 1/3-res sceneTarget)
 * @param {number} cutoffPx   projected-radius cutoff in render px (provisional; b8b-calibrated)
 * @returns {number} fade factor in [0,1]
 */
export function angularFadeFactor(radius, camDist, fovDeg, viewportH, cutoffPx) {
  const fovRad = (fovDeg * Math.PI) / 180;
  const pxPerRad = (viewportH / 2) / Math.tan(fovRad / 2);
  const projPx = (radius / Math.max(camDist, 1e-9)) * pxPerRad;
  const e0 = cutoffPx * ANGULAR_FADE_LO_FRAC;
  const e1 = cutoffPx;
  const t = Math.min(1, Math.max(0, (projPx - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/**
 * JS mirror of three's logdepthbuf_fragment for a perspective camera (r0.183.1):
 *   gl_FragDepth = log2(1 + w_clip) * logDepthBufFC * 0.5,  FC = 2/log2(far+1).
 * Pins the AC6 depth formula so a three bump can't silently desync it (b3).
 * @param {number} wClip clip-space w of the reconstructed plane point (== gl_Position.w)
 * @param {number} far   camera.far
 * @returns {number} the log-depth value written to gl_FragDepth
 */
export function logDepthFromWClip(wClip, far) {
  const FC = 2.0 / (Math.log(far + 1.0) / Math.LN2); // 2/log2(far+1)
  return (Math.log(1.0 + wClip) / Math.LN2) * FC * 0.5;
}

// Clip-space passthrough. NO modelMatrix/modelViewMatrix/projectionMatrix —
// rebase-immune by construction (D-1b, pinned by b5c).
export const CONIC_VERTEX_SHADER = /* glsl */ `
void main() {
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

// Fragment pass. GLSL3 (texelFetch). All matrices are CPU-built and packed —
// the shader carries NO inverse( / transpose( (pinned; load-bearing for the
// AC11 field-shader pin in Slice D). Row-major matrix*vector is done by hand so
// it byte-mirrors ringConic.js sampsonDistancePx / frontBranchOK.
export const CONIC_FRAGMENT_SHADER = /* glsl */ `
precision highp float;
precision highp int;
precision highp sampler2D;

uniform sampler2D uData;
uniform int   uCount;
uniform float uPixelWidth;
uniform float uFeatherPx;
uniform float uAngScale;       // pixelsPerRadian = (viewportH/2)/tan(fov/2)
uniform float uAngCutoffPx;    // projected-radius cutoff (render px)
uniform float uLogDepthBufFC;  // 2/log2(far+1)
uniform float uArcTolPx;       // front-arc gate tolerance (render px) — ringConic.arcTolerancePx

out vec4 outColor;

// Mirror of angularFadeFactor(radius, camDist, fovDeg, viewportH, cutoffPx):
// projPx = radius/camDist * pixelsPerRadian; smoothstep(cutoff*LO_FRAC, cutoff).
float angularFade(float radius, float camDist) {
  float projPx = (radius / max(camDist, 1e-9)) * uAngScale;
  return smoothstep(uAngCutoffPx * ${ANGULAR_FADE_LO_FRAC.toFixed(6)}, uAngCutoffPx, projPx);
}

// ── FRONT-ARC GATE ── byte-mirror of ringConic.js frontArcDistPx. The only test
// in this shader that does not read adj(H), which is the entire point: where the
// camera nears a ring's plane adj(H) collapses to rank 1, Cs degenerates to the
// plane's VANISHING LINE, and every adj(H)-derived quantity sits on a pole there.
// The forward map does not.

// Which ring the loop is currently on, and how many occluder discs apply to it.
// ⛔ Per-pixel-per-ring SCRATCH, not temporal state: main() writes both immediately
// before the front-arc call and nothing reads them outside that call, so the shader
// stays the pure function of the frame's ring set that the co-depth tie-break below
// depends on. They are globals rather than parameters for one reason — threading them
// through arcAxis would edit the very call line the mutation gate matches literally
// (tools/conic-gl-gate.mjs:189, M16-arc-single-axis), FATALing the gate on a no-op.
int gRing = 0;
int gNK = 0;

// One root: forward-project the circle point at (cos,sin)=cs. Returns
// vec2(screen distance, TRUE clip w), or a huge distance when that point is BEHIND
// the camera — w is evaluated on a point known to lie ON the circle, so it stays
// meaningful when the reconstruction does not.
//
// ⛔ THE RETURNED w COMES FROM rw (= rowW, unnormalized), NOT from fhw. fhw is
// hScale * rowW because Hfwd is max-abs normalized; using it writes 5.3e-7x the
// correct depth. Ordering is unaffected by hScale > 0, so the SELECTION could use
// either, but the value written must be the true one. rw is t6.xyz, already fetched.
vec2 arcRoot(vec3 fh0, vec3 fh1, vec3 fhw, vec3 rw, float radius, vec2 pix, vec2 cs) {
  vec3 q = vec3(radius * cs.x, radius * cs.y, 1.0);
  float w = dot(fhw, q);
  if (!(w > 0.0)) return vec2(1.0e30, 0.0);
  // OCCLUDER DISCS (orbit-line-local-system-occlusion-2026-08-18). q.xy is this circle
  // point's (X, Z) IN THIS RING'S OWN PLANE, and rows 10+ carry each applicable disc
  // pre-transformed into that same frame — so "is this point inside the solid?" is one
  // subtract and one dot. Reusing the existing 1.0e30 sentinel means a masked point is
  // simply A ROOT THAT DOES NOT EXIST: no new discard, no alpha channel, no uniform, and
  // a fully-masked ring falls out at the untouched arc.x > uArcTolPx gate below.
  //
  // ⛔ This is a WORLD-space containment test, deliberately. A screen-space disc would be
  // depth-blind and would erase a near ring that merely OVERLAPS a far local system,
  // which is exactly what AC-NO-COLLATERAL-OCCLUSION forbids.
  for (int k = 0; k < ${KEEPOUT_MAX}; k++) {
    if (k >= gNK) break;
    vec4 kd = texelFetch(uData, ivec2(gRing, 10 + k), 0);
    vec2 e = q.xy - kd.xy;
    if (dot(e, e) < kd.z) return vec2(1.0e30, 0.0);
  }
  return vec2(length(vec2(dot(fh0, q), dot(fh1, q)) / w - pix), dot(rw, q));
}

// Fold one root into acc = vec3(screen-argmin distance, that root's w, min COVERING w).
vec3 arcFold(vec2 r, float reach, vec3 acc) {
  if (r.x < acc.x) { acc.x = r.x; acc.y = r.y; }
  if (r.x <= reach && r.y < acc.z) acc.z = r.y;
  return acc;
}

// Solve screen_axis(theta) == the pixel's coordinate on that axis. Linear in
// (cos,sin) -> A c + B s + C = 0 with c^2+s^2 = 1 -> closed-form root pair.
// ONE sqrt, no trig, no inverse.
vec3 arcAxis(vec3 fh0, vec3 fh1, vec3 fhw, vec3 rw, float radius, vec2 pix, int axis, float reach, vec3 acc) {
  vec3 h = axis == 0 ? fh0 : fh1;
  float t = axis == 0 ? pix.x : pix.y;
  float A = radius * (h.x - t * fhw.x);
  float B = radius * (h.y - t * fhw.y);
  float C = h.z - t * fhw.z;
  float M2 = A * A + B * B;
  if (!(M2 > 0.0)) return acc;
  float disc = M2 - C * C;
  if (disc >= 0.0) {
    float sq = sqrt(disc), iv = 1.0 / M2;
    acc = arcFold(arcRoot(fh0, fh1, fhw, rw, radius, pix, vec2((-A * C + B * sq) * iv, (-B * C - A * sq) * iv)), reach, acc);
    acc = arcFold(arcRoot(fh0, fh1, fhw, rw, radius, pix, vec2((-A * C - B * sq) * iv, (-B * C + A * sq) * iv)), reach, acc);
    return acc;
  }
  // No root on this axis: clamp to the theta that comes closest (the curve's
  // extremum on this axis) rather than hard-rejecting, so the band's own feather
  // survives a vertical/horizontal tangency. The other axis is well-conditioned
  // there and the min takes it anyway.
  float M = sqrt(M2), sg = C >= 0.0 ? -1.0 : 1.0;
  return arcFold(arcRoot(fh0, fh1, fhw, rw, radius, pix, vec2(sg * A / M, sg * B / M)), reach, acc);
}

// vec3(gate distance, argmin root's w, min covering w) — byte-mirror of ringConic.js
// arcSolve. The gate reads .x exactly as before; the depth reads .z, falling back to .y.
vec3 frontArcSolve(vec3 fh0, vec3 fh1, vec3 fhw, vec3 rw, float radius, vec2 pix, float reach) {
  vec3 acc = vec3(1.0e30, 0.0, 1.0e30);
  acc = arcAxis(fh0, fh1, fhw, rw, radius, pix, 0, reach, acc);
  acc = arcAxis(fh0, fh1, fhw, rw, radius, pix, 1, reach, acc);
  return acc;
}

void main() {
  vec3 p = vec3(gl_FragCoord.xy, 1.0);

  bool  found = false;
  float bestW = 1.0e30;      // min clip-w = front-most ring owns the pixel
  vec3  bestColor = vec3(0.0);
  float bestAlpha = 0.0;

  for (int i = 0; i < ${CONIC_MAX}; i++) {
    if (i >= uCount) break;

    vec4 t2 = texelFetch(uData, ivec2(i, 2), 0);  // Cs8, radius, camDist, active
    if (t2.w < 0.5) continue;                     // inactive ring

    // Sampson distance in render px (row-major Cs, byte-mirror of sampsonDistancePx).
    vec4 t0 = texelFetch(uData, ivec2(i, 0), 0);  // Cs0..3
    vec4 t1 = texelFetch(uData, ivec2(i, 1), 0);  // Cs4..7
    vec3 csR0 = vec3(t0.x, t0.y, t0.z);
    vec3 csR1 = vec3(t0.w, t1.x, t1.y);
    vec3 csR2 = vec3(t1.z, t1.w, t2.x);
    vec3 cp = vec3(dot(csR0, p), dot(csR1, p), dot(csR2, p));
    float vnum = dot(p, cp);
    float gmag = length(2.0 * cp.xy);
    float distPx = abs(vnum) / max(gmag, 1e-12);

    float band = 1.0 - smoothstep(uPixelWidth * 0.5, uPixelWidth * 0.5 + uFeatherPx, distPx);
    if (band < 0.01) continue;

    vec4 t3 = texelFetch(uData, ivec2(i, 3), 0);  // Hinv0..3
    vec4 t4 = texelFetch(uData, ivec2(i, 4), 0);  // Hinv4..7
    vec4 t5 = texelFetch(uData, ivec2(i, 5), 0);  // Hinv8, bMinX, bMinY, bMaxX
    vec4 t6 = texelFetch(uData, ivec2(i, 6), 0);  // rowW0..2, bMaxY

    // EXTENT REJECT (byte-mirror of withinRingExtent). A conic has no endpoints:
    // edge-on, Cs degenerates to a double LINE whose zero set is infinite, so the
    // band alone paints far beyond the ring. bounds is the ring's true projected
    // AABB (±CONIC_EXTENT_UNBOUNDED = a no-op when the circle crosses the camera
    // plane and the projection really is unbounded). Margin = the band's own
    // half-width + feather + 1px so the extremes are never clipped.
    float extentMargin = uPixelWidth * 0.5 + uFeatherPx + 1.0;
    if (p.x < t5.y - extentMargin || p.x > t5.w + extentMargin ||
        p.y < t5.z - extentMargin || p.y > t6.w + extentMargin) continue;

    // Front-branch guard + clip-w (byte-mirror of frontBranchOK; row-major Hinv).
    vec3 hR0 = vec3(t3.x, t3.y, t3.z);
    vec3 hR1 = vec3(t3.w, t4.x, t4.y);
    vec3 hR2 = vec3(t4.z, t4.w, t5.x);
    vec3 q = vec3(dot(hR0, p), dot(hR1, p), dot(hR2, p));
    vec2 XZ = q.xy / q.z;
    float wclip = dot(vec3(t6.x, t6.y, t6.z), vec3(XZ, 1.0));
    if (!(wclip > 0.0)) {
      // Extent-bounded => the whole circle is in front, so there is no
      // behind-camera branch to reject; a non-positive w is the edge-on
      // degeneracy (adj(H) rank-1 => every pixel reconstructs to the same
      // point at infinity, w -> 0). Fall back to the ring centre's clip w so
      // the ring is depth-sorted instead of VANISHING.
      if (t5.y <= ${(-CONIC_EXTENT_UNBOUNDED * 0.5).toExponential(1)}) continue;
      wclip = t6.z;
      if (wclip <= 0.0) continue;
    }

    // FRONT-ARC REJECT (orbit-ring-phantom-2026-08-12). The three gates above are
    // ALL functions of adj(H), and for a ring the camera is inside and near the
    // plane of, all three are blind at once: the band's Cs has degenerated to the
    // plane's vanishing LINE (so the phantom really is on the curve — measured
    // exact distance 0.663 px, NEARER than the real ring's 0.922), the extent AABB
    // is correctly disabled because such a projection genuinely is unbounded, and
    // the front-branch guard reads only the SIGN of a reconstruction that is
    // sitting on a pole. Measured live: phantom pixels reconstruct to 116x-190x
    // the ring radius while the real ring reconstructs to 0.9996-1.000.
    //
    // This asks the one question none of them can: is there a point ON THIS
    // CIRCLE, IN FRONT of the camera, that actually projects here? Solved on the
    // forward map, which is exactly conditioned where the inverse collapses.
    // Rows 8-9 carry it; its third row is hScale * rowW (t6.xyz, already fetched).
    vec4 t8 = texelFetch(uData, ivec2(i, 8), 0);  // Hfwd0..3
    vec4 t9 = texelFetch(uData, ivec2(i, 9), 0);  // Hfwd4, Hfwd5, hScale, nk
    // Bind the occluder discs for THIS ring. t9 is already fetched, so this costs no
    // texelFetch, and a fully-masked ring dies at the arc gate below — before the two
    // arcAxis calls, which hold the loop's only sqrt.
    gRing = i; gNK = int(t9.w);
    float bandReach = uPixelWidth * 0.5 + uFeatherPx * ${BAND_ALPHA_CUTOFF_T.toFixed(9)};
    vec3 arc = frontArcSolve(vec3(t8.x, t8.y, t8.z), vec3(t8.w, t9.x, t9.y),
                             t9.z * vec3(t6.x, t6.y, t6.z), vec3(t6.x, t6.y, t6.z),
                             t2.y, p.xy, bandReach);
    if (arc.x > uArcTolPx) continue;

    // DEPTH (orbit-ring-depth-2026-08-12, artefact doc §9/§10). The wclip above is the
    // ray-intersect-PLANE depth, which at grazing IS NOT ON THE CIRCLE — §2's entire
    // 1212-px leak, measured live at 540 px. The arc solve already found the circle
    // points; take the FRONT-MOST one that actually COVERS this pixel.
    //
    // ⛔ min, not screen-nearest: near edge-on the projected ellipse is thin, so the
    // ring's near and far points both land within the band's reach of one pixel and BOTH
    // cover it. Screen distance cannot rank them (that was candidate 4 — error
    // wMax/wMin = (d+R)/(d-R), unbounded, and it HID line the shader used to draw).
    // ⛔ reach, not uArcTolPx: roots between the two do not cover the pixel, and folding
    // them in writes 5962x too NEAR — §2's leak, recreated by the fix.
    // The wclip above stays exactly as it was: it is still the COVERAGE test above, and
    // its ring-centre fallback still keeps an edge-on ring from vanishing (d7db3a3).
    wclip = arc.z < 1.0e30 ? arc.z : arc.y;

    // Angular-size fade + composed alpha.
    float ang = angularFade(t2.y, t2.z);
    vec4 t7 = texelFetch(uData, ivec2(i, 7), 0);  // color.rgb, alpha
    float a = band * t7.w * ang;
    if (a < 0.01) continue;

    // Overlap selection: front-most band-passing ring owns color + alpha + depth
    // TOGETHER (D-4, never decoupled), with a co-depth tie-break (grazing-drift
    // fix). Outside the epsilon band the strictly-nearer ring wins (true
    // front-most ordering; b5b crossing color stays correct). INSIDE the band
    // (|w_clip| within CONIC_WCLIP_TIE_EPS of the current best — the rings are
    // co-depth on the compressed horizon) the ring that COVERS this pixel more
    // strongly (higher band coverage a) takes ownership; its w_clip is within
    // epsilon of best so depth stays coherent. This kills the strict-argmax
    // frame-to-frame flap that suppressed + toggled the line at grazing.
    if (wclip < bestW * (1.0 - ${CONIC_WCLIP_TIE_EPS.toFixed(6)})) {
      bestW = wclip;
      bestColor = t7.rgb;
      bestAlpha = a;
      found = true;
    } else if (found && wclip < bestW * (1.0 + ${CONIC_WCLIP_TIE_EPS.toFixed(6)}) && a > bestAlpha) {
      bestW = wclip;
      bestColor = t7.rgb;
      bestAlpha = a;
    }
  }

  if (!found) discard;
  gl_FragDepth = log2(1.0 + bestW) * uLogDepthBufFC * 0.5;
  outColor = vec4(bestColor, bestAlpha);
}
`;

// Reusable color-normalizer scratch (accepts THREE.Color | number | {r,g,b} | [r,g,b]).
const _col = new THREE.Color();
function normalizeColor(color) {
  if (color == null) { _col.setHex(0x00ff00); }
  else if (typeof color === 'number') { _col.setHex(color); }
  else if (color.isColor) { _col.copy(color); }
  else if (Array.isArray(color)) { _col.setRGB(color[0], color[1], color[2]); }
  else if ('r' in color && 'g' in color && 'b' in color) { _col.setRGB(color.r, color.g, color.b); }
  else { _col.setHex(0x00ff00); }
  return _col;
}

export class OrbitConicField {
  /**
   * @param {object} [opts]
   * @param {number} [opts.pixelWidth=1.0]   Sampson band width in render px (matches the probe/SDF knob)
   * @param {number} [opts.featherPx=0.5]    band soft-edge width in render px
   * @param {number} [opts.angularCutoffPx]  provisional; see DEFAULT_ANGULAR_CUTOFF_PX + b8b
   * @param {number} [opts.renderOrder=999]  draw after opaque bodies (occlusion depth already written)
   */
  constructor({ pixelWidth = 1.0, featherPx = 0.5, angularCutoffPx = DEFAULT_ANGULAR_CUTOFF_PX, renderOrder = 999 } = {}) {
    this.CONIC_MAX = CONIC_MAX;
    this.textureWidth = CONIC_MAX;
    this.textureRows = CONIC_TEX_ROWS;
    this.angularCutoffPx = angularCutoffPx;

    // uCount (rings the shader iterates) and the count of active entries.
    this.count = 0;
    this.activeCount = 0;

    // ── Packed per-ring DataTexture (RGBA32F). Reused source buffer — no
    // per-frame reallocation (R5). ──
    this._source = new Float32Array(CONIC_MAX * CONIC_TEX_ROWS * 4);
    this.texture = new THREE.DataTexture(
      this._source, CONIC_MAX, CONIC_TEX_ROWS, THREE.RGBAFormat, THREE.FloatType,
    );
    this.texture.internalFormat = 'RGBA32F';
    this.texture.minFilter = THREE.NearestFilter;
    this.texture.magFilter = THREE.NearestFilter;
    this.texture.generateMipmaps = false;
    this.texture.needsUpdate = true;

    // ── Fullscreen material. Clip-space vertex, texelFetch fragment (GLSL3). ──
    this.material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: {
        uData:          { value: this.texture },
        uCount:         { value: 0 },
        uPixelWidth:    { value: pixelWidth },
        uFeatherPx:     { value: featherPx },
        uAngScale:      { value: 1.0 },
        uAngCutoffPx:   { value: angularCutoffPx },
        uLogDepthBufFC: { value: 1.0 },
        uArcTolPx:      { value: arcTolerancePx(pixelWidth, featherPx) },
      },
      vertexShader: CONIC_VERTEX_SHADER,
      fragmentShader: CONIC_FRAGMENT_SHADER,
      transparent: true,
      depthTest: true,
      depthWrite: true,
      stencilWrite: false,
      side: THREE.DoubleSide,
    });

    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = renderOrder;

    // Preallocated per-ring conic scratch so buildRingConic allocates nothing
    // in the hot path (R5). Reused across frames.
    this._scratch = [];
    for (let i = 0; i < CONIC_MAX; i++) {
      this._scratch.push({ Cs: new Float64Array(9), Hinv: new Float64Array(9), rowW: new Float64Array(3), bounds: new Float64Array(4), Hfwd: new Float64Array(9), hScale: 0 });
    }
    this._pvm = new THREE.Matrix4();
    this._viewInv = new THREE.Matrix4();
    this._camPos = new THREE.Vector3();
    this._ringCtr = new THREE.Vector3();

    // ── Slice C system-adapter scratch (updateFromSystem) ── Reused across frames
    // so the OrbitLine->descriptor build allocates nothing in the hot path (R5).
    // _descPool holds the reused descriptor objects (grows once, never shrinks);
    // _descView is the exact-length reference array handed to update() each frame.
    this._descPool = [];
    this._descView = [];
    this._descCount = 0;
    this._adapterCam = new THREE.Vector3();

    // Occluder-disc pools (orbit-line-local-system-occlusion-2026-08-18). Same zero-alloc
    // discipline as _descPool/_descView: grow once, never shrink, hand update() a
    // reference view. _discScratch stages one ring's applicable discs as flat
    // (cx, cz, reff2) triples between _resolveDiscs and _packRing.
    this._discPool = [];
    this._discView = [];
    this._discCount = 0;
    this._discScratch = new Float64Array(KEEPOUT_MAX * 3);
  }

  /** Match OrbitLine/OrbitRingSDF.addTo — add the fullscreen mesh to a scene. */
  addTo(scene) { scene.add(this.mesh); }

  /** Set the Sampson band knobs (mirrors OrbitRingSDF's uPixelWidth/uFeatherPx). */
  setBand({ pixelWidth = null, featherPx = null } = {}) {
    if (pixelWidth !== null) this.material.uniforms.uPixelWidth.value = pixelWidth;
    if (featherPx !== null) this.material.uniforms.uFeatherPx.value = featherPx;
    // The front-arc tolerance is DERIVED from the band (it must cover everything
    // the band can legitimately paint), so it moves with it or the two drift.
    this.material.uniforms.uArcTolPx.value = arcTolerancePx(
      this.material.uniforms.uPixelWidth.value, this.material.uniforms.uFeatherPx.value,
    );
    return {
      pixelWidth: this.material.uniforms.uPixelWidth.value,
      featherPx: this.material.uniforms.uFeatherPx.value,
      arcTolPx: this.material.uniforms.uArcTolPx.value,
    };
  }

  /** Set the provisional angular-size cutoff (render px of projected radius). */
  setAngularCutoff(px) {
    if (Number.isFinite(px) && px > 0) {
      this.angularCutoffPx = px;
      this.material.uniforms.uAngCutoffPx.value = px;
    }
    return this.angularCutoffPx;
  }

  /**
   * SYSTEM ADAPTER (orbit-ring-conic Slice C) — build the field's descriptor list
   * from a live main.js `system` and drive update(). This is the ONE place that
   * knows the OrbitLine surface; the generic update() below stays OrbitLine-agnostic.
   *
   * Per VISIBLE ring (star pair + planet + moon lists) it reads the LIVE mutated
   * material — so hover (material.color/.opacity, main.js :11210) and the AC3 factor
   * (uVisFactor) propagate with zero per-ring draw (R8) — and folds the THREE
   * camera-only channels into the descriptor alpha:
   *
   *     alpha = uOpacity * uVisFactor                 (CPU, per ring)
   *
   * The third channel, the camera-proximity fade, was RETIRED by Max's UAT ruling
   * 2026-08-01 (see _appendRing). The angular-size fade is deliberately NOT folded
   * here — it stays IN-SHADER
   * (angularFade multiplies on top), a three-channel CPU composition + one in-shader
   * channel; folding it CPU-side too would DOUBLE-APPLY it.
   *
   * Hidden rings (`mesh.visible === false`, set by _applyOrbitVisibility/mode sync)
   * are simply not emitted — the field is stateless per frame (no registry), so a
   * disposed/removed ring just stops appearing on the next call. Ring order is star
   * + planet first, moons last, so an (unexpected) overflow past CONIC_MAX drops the
   * least-visible sub-pixel moon rings first (R9).
   *
   * @param {object} system  main.js system: { orbitLines, starOrbitLines, planets:[{moonOrbitLines}] }
   * @param {THREE.PerspectiveCamera} camera  render-time interpolated camera (D-2)
   * @param {{width:number, height:number}} viewport  the sceneTarget dimensions
   * @returns {this}
   */
  updateFromSystem(system, camera, viewport) {
    this._adapterCam.setFromMatrixPosition(camera.matrixWorld);
    this._descCount = 0;
    // Discs first: the ring append needs nothing from them, but building them here keeps
    // the one traversal of system.planets that knows local-system membership in one place.
    const discs = this._buildOccluderDiscs(system);
    if (system) {
      // ⛔ localSystemId is LOCAL-SYSTEM MEMBERSHIP, not "which planet owns this ring".
      // system.orbitLines[i] IS planet i's own heliocentric ring and is precisely what must
      // be cut, so it carries -1 like the star rings. Only planets[i].moonOrbitLines carry i.
      const so = system.starOrbitLines;
      if (so) for (let i = 0; i < so.length; i++) this._appendRing(so[i], -1);
      const po = system.orbitLines;
      if (po) for (let i = 0; i < po.length; i++) this._appendRing(po[i], -1);
      const pl = system.planets;
      if (pl) {
        for (let i = 0; i < pl.length; i++) {
          const mo = pl[i] && pl[i].moonOrbitLines;
          if (mo) for (let j = 0; j < mo.length; j++) this._appendRing(mo[j], i);
        }
      }
    }
    const n = this._descCount;
    const view = this._descView;
    view.length = n; // reference view over the pooled objects — no object churn
    for (let i = 0; i < n; i++) view[i] = this._descPool[i];
    this.update(view, camera, viewport, discs);
    return this;
  }

  /**
   * The keep-out discs — one per moon-bearing planet, the solid a heliocentric ring is
   * meant to pass behind (orbit-line-local-system-occlusion-2026-08-18).
   *
   * Reads ring GEOMETRY ONLY: `.radius`, `.mesh.visible`, `.mesh.position`. No masses, no
   * barycentreOffset, no `_domRings`, no `entry.planet`. That is deliberate on three counts —
   * it needs no `src/main.js` change at all, it keeps working against the bare
   * `{ moonOrbitLines: [ring] }` fixtures the adapter tests use, and it makes the disc a
   * statement about what is DRAWN rather than about what the physics believes.
   *
   * Centre is the outermost local ring's own position, which resolves the barycentric split
   * for free: a dominated pair's rings are both written to the empty point (main.js:11345-11349)
   * while an undominated planet's follow the planet mesh (:11351), and either way the outermost
   * ring is sitting exactly where the local system is centred.
   *
   * Radius is `max(|ringPos − C| + ringRadius)`. When a planet's local rings share one centre —
   * every case the contract enumerates, and verified live on wd-10 — the offset term is exactly
   * 0 and this reduces to `max(ring.radius)`, the AC's literal observable. The bounding form only
   * bites on a mixed planet (a dominated pair also carrying a non-dominant moon), where it grows
   * the disc by that moon's excursion rather than clipping it.
   *
   * ⛔ Deliberately NOT grown by the moons' body radii. Bodies are already occluded by the depth
   * buffer — this pass is `depthTest: true` at renderOrder 999, drawn after opaque geometry — so
   * widening the disc for them would push the gap past the visible local system for nothing.
   *
   * @param {object} system  main.js system: { planets:[{moonOrbitLines}] }
   * @returns {Array<{cx:number,cy:number,cz:number,radius:number,systemId:number}>|null}
   */
  _buildOccluderDiscs(system) {
    const pl = system && system.planets;
    this._discCount = 0;
    if (!pl) return null;
    for (let i = 0; i < pl.length && this._discCount < KEEPOUT_MAX; i++) {
      const mo = pl[i] && pl[i].moonOrbitLines;
      if (!mo || mo.length === 0) continue;

      // Visible rings only — the same gate _appendRing applies, so a hidden local system
      // occludes nothing, exactly as it draws nothing.
      let out = null;
      for (let j = 0; j < mo.length; j++) {
        const r = mo[j];
        if (!r || !r.mesh || !r.mesh.visible) continue;
        if (out === null || r.radius > out.radius) out = r;
      }
      if (out === null) continue; // AC-APPLIES-GENERALLY: no moons (or none visible) ⇒ no disc

      out.mesh.updateMatrixWorld(true);
      const c = out.mesh.matrixWorld.elements;
      const cx = c[12], cy = c[13], cz = c[14];

      let radius = 0;
      for (let j = 0; j < mo.length; j++) {
        const r = mo[j];
        if (!r || !r.mesh || !r.mesh.visible) continue;
        const p = r.mesh.position;
        const off = Math.hypot(p.x - cx, p.y - cy, p.z - cz);
        const reach = off + r.radius;
        if (reach > radius) radius = reach;
      }

      const n = this._discCount;
      let d = this._discPool[n];
      if (!d) { d = { cx: 0, cy: 0, cz: 0, radius: 0, systemId: -1 }; this._discPool[n] = d; }
      d.cx = cx; d.cy = cy; d.cz = cz; d.radius = radius; d.systemId = i;
      this._discCount = n + 1;
    }
    const n = this._discCount;
    if (n === 0) return null;
    const view = this._discView;
    view.length = n;
    for (let k = 0; k < n; k++) view[k] = this._discPool[k];
    return view;
  }

  /**
   * Append one OrbitLine as a pooled descriptor if it is visible (Slice C adapter).
   * Zero-alloc after warm-up: reuses this._descPool[n], references ring.mesh.matrixWorld
   * and the live material color (no copies).
   */
  _appendRing(ring, systemId = -1) {
    if (!ring || !ring.mesh || !ring.mesh.visible) return;
    const n = this._descCount;
    let d = this._descPool[n];
    if (!d) { d = { matrixWorld: null, radius: 0, color: null, alpha: 1, active: true, localSystemId: -1 }; this._descPool[n] = d; }

    // Current transform off the render path (mirrors hitTestOrbits' per-mesh sync,
    // main.js:4119) — the moon-ring position is written at sim time and its
    // matrixWorld would otherwise lag until the renderer's own updateMatrixWorld.
    ring.mesh.updateMatrixWorld(true);
    const mw = ring.mesh.matrixWorld;

    const u = ring.material.uniforms;

    d.matrixWorld = mw;
    d.radius = ring.radius;
    // Live color: OrbitLine surfaces material.color (=== uColor.value, mutated in
    // place by hover); base OrbitRingSDF has only the uColor Vector3.
    d.color = ring.material.color || u.uColor.value;
    // PROXIMITY FADE RETIRED (Max UAT ruling 2026-08-01): "I do not want the lines
    // to disappear when you get close." The fade was regime-avoidance for the OLD
    // plane-domain SDF's 0.4R footprint clamp — a renderer Slice D deleted; the
    // alpha multiply merely survived the rework. Its kill radius scaled with the
    // ORBIT radius, not the body being approached (near = max(0.35, 0.02*R)), so on
    // a r=67622 ring the line died 1352 units out while the planet was ~1 unit
    // across — exactly the reported "disappear way too far away". The in-shader
    // angular-size fade still retires sub-pixel rings, so AC8 is unaffected.
    d.alpha = u.uOpacity.value * u.uVisFactor.value;
    d.active = true;
    // Opaque integer, and it stays opaque: the field still knows NOTHING about OrbitLine
    // (Slice B/C boundary above), exactly as `alpha` names no hover concept.
    d.localSystemId = systemId;
    this._descCount = n + 1;
  }

  /**
   * Rebuild the packed DataTexture from a generic ring-descriptor list.
   * @param {Array<{matrixWorld:THREE.Matrix4, radius:number, color?:*, alpha?:number, active?:boolean}>} descriptors
   * @param {THREE.PerspectiveCamera} camera  render-time camera (matrixWorld current — D-2)
   * @param {{width:number, height:number}} viewport  the sceneTarget dimensions
   */
  update(descriptors, camera, viewport, discs = null) {
    const W = viewport.width, H = viewport.height;
    const count = Math.min(descriptors.length, CONIC_MAX);
    this.count = count;

    // View inverse from the camera's (already-current) world matrix — the field
    // does NOT depend on renderer-managed matrixWorldInverse (D-2 safe).
    this._viewInv.copy(camera.matrixWorld).invert();
    this._camPos.setFromMatrixPosition(camera.matrixWorld);
    const proj = camera.projectionMatrix;

    const src = this._source;
    let active = 0;

    for (let i = 0; i < count; i++) {
      const d = descriptors[i];
      this._pvm.multiplyMatrices(this._viewInv, d.matrixWorld).premultiply(proj);
      const conic = buildRingConic(this._pvm, d.radius, W, H, this._scratch[i]);
      const isActive = d.active !== false && conic !== null;

      this._ringCtr.setFromMatrixPosition(d.matrixWorld);
      const camDist = this._camPos.distanceTo(this._ringCtr);
      const c = normalizeColor(d.color);
      const alpha = d.alpha == null ? 0.8 : d.alpha;

      const nk = discs === null ? 0 : this._resolveDiscs(d, discs);
      this._packRing(src, i, conic, d.radius, camDist, isActive ? 1 : 0, c, alpha, nk);
      if (isActive) active++;
    }

    this.activeCount = active;

    // Per-frame uniforms.
    const u = this.material.uniforms;
    u.uCount.value = count;
    const fovDeg = camera.fov == null ? 70 : camera.fov;
    const fovRad = (fovDeg * Math.PI) / 180;
    u.uAngScale.value = (H / 2) / Math.tan(fovRad / 2);
    u.uAngCutoffPx.value = this.angularCutoffPx;
    u.uLogDepthBufFC.value = 2.0 / (Math.log(camera.far + 1.0) / Math.LN2); // 2/log2(far+1)
    u.uArcTolPx.value = arcTolerancePx(u.uPixelWidth.value, u.uFeatherPx.value);

    this.texture.needsUpdate = true;
  }

  /**
   * THE PREDICATE (orbit-line-local-system-occlusion-2026-08-18). Which occluder discs
   * apply to ring `d`, transformed into that ring's own plane frame and staged in
   * `this._discScratch` for _packRing. Returns how many.
   *
   * Two terms, and only two:
   *
   *   (a) THE SAME-LOCAL-SYSTEM EXEMPTION, and it is load-bearing ALONE. The pair's inner
   *       ring r1 lies ENTIRELY inside the outer ring r2, so without this the disc erases
   *       it in full and silently deletes what binary-barycentre-render-2026-08-18 shipped.
   *   (b) 3-D CONTAINMENT — does this ring's circle actually enter the ball?
   *
   * ⛔ There is deliberately NO `ring.radius > disc.radius` term, though it reads like a
   * sensible fail-safe. Because the disc radius bounds every local ring by construction,
   * that term independently culls every same-system ring — which would make (a) dead code
   * and turn AC-LOCAL-RINGS-SURVIVE's falsification test into a permanent no-op. A
   * fail-safe that disarms the assertion protecting the thing it guards is worse than none.
   * It is also unnecessary: measured live on wd-10, the nearest foreign ring misses by
   * gap² = 2 427 689 against Reff² = 0.806, a margin of ~3e6. Geometry separates them.
   */
  _resolveDiscs(d, discs) {
    const mw = d.matrixWorld.elements;
    // Ring transforms are RIGID — rotation.x and position only; no `.scale` write exists in
    // OrbitRingSDF.js or OrbitLine.js, and WorldOrigin.js writes position. So the basis
    // columns are orthonormal and the world→local map is three dot products, not an inverse.
    const tx = mw[12], ty = mw[13], tz = mw[14];
    let nk = 0;
    for (let k = 0; k < discs.length; k++) {
      const g = discs[k];
      if (d.localSystemId >= 0 && d.localSystemId === g.systemId) continue; // (a)

      const vx = g.cx - tx, vy = g.cy - ty, vz = g.cz - tz;
      const cx = vx * mw[0] + vy * mw[1] + vz * mw[2];
      const cy = vx * mw[4] + vy * mw[5] + vz * mw[6];
      const cz = vx * mw[8] + vy * mw[9] + vz * mw[10];

      const reff2 = g.radius * g.radius - cy * cy;
      if (!(reff2 > 0)) continue;                 // the ball misses the ring's plane entirely

      const gap = Math.hypot(cx, cz) - d.radius;  // (b)
      if (gap * gap >= reff2) continue;           // the circle never enters the disc

      const o = nk * 3;
      this._discScratch[o] = cx;
      this._discScratch[o + 1] = cz;
      this._discScratch[o + 2] = reff2;
      nk++;
      if (nk === KEEPOUT_MAX) break;
    }
    return nk;
  }

  /** Pack one ring column (rows 0-9, plus 10..10+nk-1). conic===null zeros the conic rows. */
  _packRing(src, i, conic, radius, camDist, activeFlag, color, alpha, nk = 0) {
    // off(r) = (r*CONIC_MAX + i)*4 = i*4 + r*(CONIC_MAX*4). Inlined as running
    // additions of a constant row stride — no per-call closure allocation (R5).
    const stride = CONIC_MAX * 4;
    const o0 = i * 4;
    const o1 = o0 + stride, o2 = o1 + stride, o3 = o2 + stride, o4 = o3 + stride;
    const o5 = o4 + stride, o6 = o5 + stride, o7 = o6 + stride;
    const o8 = o7 + stride, o9 = o8 + stride;
    if (conic) {
      const Cs = conic.Cs, Hi = conic.Hinv, rW = conic.rowW, bd = conic.bounds;
      // row0: Cs0..3
      src[o0] = Cs[0]; src[o0 + 1] = Cs[1]; src[o0 + 2] = Cs[2]; src[o0 + 3] = Cs[3];
      // row1: Cs4..7
      src[o1] = Cs[4]; src[o1 + 1] = Cs[5]; src[o1 + 2] = Cs[6]; src[o1 + 3] = Cs[7];
      // row2: Cs8, radius, camDist, active
      src[o2] = Cs[8]; src[o2 + 1] = radius; src[o2 + 2] = camDist; src[o2 + 3] = activeFlag;
      // row3: Hinv0..3
      src[o3] = Hi[0]; src[o3 + 1] = Hi[1]; src[o3 + 2] = Hi[2]; src[o3 + 3] = Hi[3];
      // row4: Hinv4..7
      src[o4] = Hi[4]; src[o4 + 1] = Hi[5]; src[o4 + 2] = Hi[6]; src[o4 + 3] = Hi[7];
      // row5: Hinv8, bounds minX, minY, maxX
      src[o5] = Hi[8]; src[o5 + 1] = bd[0]; src[o5 + 2] = bd[1]; src[o5 + 3] = bd[2];
      // row6: rowW0..2, bounds maxY
      src[o6] = rW[0]; src[o6 + 1] = rW[1]; src[o6 + 2] = rW[2]; src[o6 + 3] = bd[3];
      // row8: Hfwd0..3   row9: Hfwd4, Hfwd5, hScale, spare. Hfwd's THIRD row is
      // deliberately absent — it is exactly hScale*rowW, which row 6 already carries.
      const Hf = conic.Hfwd, hs = conic.hScale;
      src[o8] = Hf[0]; src[o8 + 1] = Hf[1]; src[o8 + 2] = Hf[2]; src[o8 + 3] = Hf[3];
      src[o9] = Hf[4]; src[o9 + 1] = Hf[5]; src[o9 + 2] = hs;    src[o9 + 3] = nk;
    } else {
      // Null conic: zero the conic rows so no stale data lingers; keep radius/
      // camDist for introspection but force active=0 (shader skips it anyway).
      // Unrolled (rows 0,1,3,4,5,6) — no per-call array-literal allocation (R5).
      src[o0] = 0; src[o0 + 1] = 0; src[o0 + 2] = 0; src[o0 + 3] = 0;
      src[o1] = 0; src[o1 + 1] = 0; src[o1 + 2] = 0; src[o1 + 3] = 0;
      src[o3] = 0; src[o3 + 1] = 0; src[o3 + 2] = 0; src[o3 + 3] = 0;
      src[o4] = 0; src[o4 + 1] = 0; src[o4 + 2] = 0; src[o4 + 3] = 0;
      src[o5] = 0; src[o5 + 1] = 0; src[o5 + 2] = 0; src[o5 + 3] = 0;
      src[o6] = 0; src[o6 + 1] = 0; src[o6 + 2] = 0; src[o6 + 3] = 0;
      src[o2] = 0; src[o2 + 1] = radius; src[o2 + 2] = camDist; src[o2 + 3] = 0;
      src[o8] = 0; src[o8 + 1] = 0; src[o8 + 2] = 0; src[o8 + 3] = 0;
      src[o9] = 0; src[o9 + 1] = 0; src[o9 + 2] = 0; src[o9 + 3] = nk;
    }
    // row7: color.rgb, alpha
    src[o7] = color.r; src[o7 + 1] = color.g; src[o7 + 2] = color.b; src[o7 + 3] = alpha;

    // rows 10..10+nk-1: the applicable occluder discs, already in this ring's plane frame
    // (_resolveDiscs). ⛔ Slots past nk are deliberately NOT cleared — the shader breaks on
    // nk exactly as the ring loop breaks on uCount, so stale floats there are unreachable,
    // the same reasoning docs/PARKING_LOT.md:206-213 gives for stale _source past uCount.
    let oK = o9 + stride;
    const ds = this._discScratch;
    for (let k = 0; k < nk; k++, oK += stride) {
      const o = k * 3;
      src[oK] = ds[o]; src[oK + 1] = ds[o + 1]; src[oK + 2] = ds[o + 2]; src[oK + 3] = 0;
    }
  }

  /**
   * Unpack a ring's packed entry (for tests + introspection) — the exact inverse
   * of _packRing. Returns float32-precision values straight from the source buffer.
   * @param {number} i ring index
   * @returns {{Cs:Float32Array, Hinv:Float32Array, rowW:Float32Array, radius:number, camDist:number, active:number, color:{r:number,g:number,b:number}, alpha:number}}
   */
  readConic(i) {
    const src = this._source;
    const off = (r) => (r * CONIC_MAX + i) * 4;
    const o0 = off(0), o1 = off(1), o2 = off(2), o3 = off(3), o4 = off(4), o5 = off(5), o6 = off(6), o7 = off(7);
    const o8 = off(8), o9 = off(9);
    const Cs = new Float32Array([src[o0], src[o0 + 1], src[o0 + 2], src[o0 + 3], src[o1], src[o1 + 1], src[o1 + 2], src[o1 + 3], src[o2]]);
    const Hinv = new Float32Array([src[o3], src[o3 + 1], src[o3 + 2], src[o3 + 3], src[o4], src[o4 + 1], src[o4 + 2], src[o4 + 3], src[o5]]);
    const rowW = new Float32Array([src[o6], src[o6 + 1], src[o6 + 2]]);
    const bounds = new Float32Array([src[o5 + 1], src[o5 + 2], src[o5 + 3], src[o6 + 3]]);
    // Hfwd row 2 is rebuilt as hScale*rowW EXACTLY as the shader rebuilds it, so a
    // mirror test that passes here is testing the pack the GPU actually reads.
    const hScale = src[o9 + 2];
    const Hfwd = new Float32Array([
      src[o8], src[o8 + 1], src[o8 + 2], src[o8 + 3], src[o9], src[o9 + 1],
      hScale * src[o6], hScale * src[o6 + 1], hScale * src[o6 + 2],
    ]);
    return {
      Cs, Hinv, rowW, bounds, Hfwd, hScale,
      radius: src[o2 + 1], camDist: src[o2 + 2], active: src[o2 + 3],
      color: { r: src[o7], g: src[o7 + 1], b: src[o7 + 2] }, alpha: src[o7 + 3],
      keepOutCount: src[o9 + 3],
    };
  }

  /**
   * Unpack ring i's k-th packed occluder disc — the inverse of _packRing's rows 10+.
   * cx/cz are in RING i's OWN PLANE FRAME and reff2 is R² − cy², so a circle point
   * (X, Z) on that ring is inside iff (X−cx)² + (Z−cz)² < reff2. Introspection + tests.
   * @param {number} i ring index
   * @param {number} k disc index within that ring's applicable set, 0 <= k < keepOutCount
   * @returns {{cx:number, cz:number, reff2:number}}
   */
  readOccluder(i, k) {
    const src = this._source;
    const o = ((10 + k) * CONIC_MAX + i) * 4;
    return { cx: src[o], cz: src[o + 1], reff2: src[o + 2] };
  }

  /** Free GPU resources. */
  dispose() {
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.texture.dispose();
  }
}
