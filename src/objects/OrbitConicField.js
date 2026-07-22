import * as THREE from 'three';
import { buildRingConic } from './ringConic.js';

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
 * writes the FRONT-MOST ring's color + alpha + log-depth TOGETHER (single
 * argmax by clip-w; never decoupled — D-4).
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

// Per-frame ceiling. Inventory worst case is 58 rings (8 planets x (1+6 moons)
// + 2 binary-star rings) < 64. Rings past this are dropped (order largest-
// angular-size-first upstream so any drop is the least-visible sub-pixel ring).
export const CONIC_MAX = 64;

// DataTexture is CONIC_MAX wide x CONIC_TEX_ROWS tall, RGBA32F. Per ring (one
// texel column) the 8 rows carry:
//   row 0: Cs[0..3]                 row 4: Hinv[4..7]
//   row 1: Cs[4..7]                 row 5: Hinv[8], _, _, _
//   row 2: Cs[8], radius, camDist, active
//   row 3: Hinv[0..3]              row 6: rowW[0..2], _
//                                   row 7: color.rgb, alpha
// (Cs 3 texels + Hinv 3 texels + rowW 1 texel + color/alpha 1 texel = 8; the
// radius/camDist/active scalars ride the 3 spare slots of the Cs group's last
// texel, so the plan's 8-texel grouping is honored exactly.)
export const CONIC_TEX_ROWS = 8;

// Angular-size fade band: a ring is fully visible (fade 1) once its projected
// radius reaches uAngCutoffPx render px, and fades smoothly to 0 as it collapses
// toward ANGULAR_FADE_LO_FRAC * cutoff. Below that it is a sub-pixel dot (AC8's
// "persistent dots") and is removed.
const ANGULAR_FADE_LO_FRAC = 0.5;

// PROVISIONAL default cutoff — see the class doc + `angularCutoffPx` option.
// 2.0 render px of PROJECTED RADIUS: on the 1/3-res sceneTarget a ring spanning
// under ~1 px radius is an isolated dot, so full visibility at >=2 px and full
// fade by ~1 px keeps legible rings while dissolving dots. This is a STARTING
// value only; the shipping cutoff is calibrated at the lab-battery b8b step
// against the MEASURED shipped-SDF angular dropout per ring class (AC5 anti-
// vanish vs AC8 fade tension). Settable via ctor {angularCutoffPx} and
// setAngularCutoff(); do NOT treat this literal as final.
export const DEFAULT_ANGULAR_CUTOFF_PX = 2.0;

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

out vec4 outColor;

// Mirror of angularFadeFactor(radius, camDist, fovDeg, viewportH, cutoffPx):
// projPx = radius/camDist * pixelsPerRadian; smoothstep(cutoff*LO_FRAC, cutoff).
float angularFade(float radius, float camDist) {
  float projPx = (radius / max(camDist, 1e-9)) * uAngScale;
  return smoothstep(uAngCutoffPx * ${ANGULAR_FADE_LO_FRAC.toFixed(6)}, uAngCutoffPx, projPx);
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

    // Front-branch guard + clip-w (byte-mirror of frontBranchOK; row-major Hinv).
    vec4 t3 = texelFetch(uData, ivec2(i, 3), 0);  // Hinv0..3
    vec4 t4 = texelFetch(uData, ivec2(i, 4), 0);  // Hinv4..7
    vec4 t5 = texelFetch(uData, ivec2(i, 5), 0);  // Hinv8, _, _, _
    vec3 hR0 = vec3(t3.x, t3.y, t3.z);
    vec3 hR1 = vec3(t3.w, t4.x, t4.y);
    vec3 hR2 = vec3(t4.z, t4.w, t5.x);
    vec3 q = vec3(dot(hR0, p), dot(hR1, p), dot(hR2, p));
    vec2 XZ = q.xy / q.z;
    vec4 t6 = texelFetch(uData, ivec2(i, 6), 0);  // rowW0..2, _
    float wclip = dot(vec3(t6.x, t6.y, t6.z), vec3(XZ, 1.0));
    if (wclip <= 0.0) continue;

    // Angular-size fade + composed alpha.
    float ang = angularFade(t2.y, t2.z);
    vec4 t7 = texelFetch(uData, ivec2(i, 7), 0);  // color.rgb, alpha
    float a = band * t7.w * ang;
    if (a < 0.01) continue;

    // Single argmax: the nearest band-passing ring owns color + alpha + depth.
    if (wclip < bestW) {
      bestW = wclip;
      bestColor = t7.rgb;
      bestAlpha = a;
      found = true;
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
      this._scratch.push({ Cs: new Float64Array(9), Hinv: new Float64Array(9), rowW: new Float64Array(3) });
    }
    this._pvm = new THREE.Matrix4();
    this._viewInv = new THREE.Matrix4();
    this._camPos = new THREE.Vector3();
    this._ringCtr = new THREE.Vector3();
  }

  /** Match OrbitLine/OrbitRingSDF.addTo — add the fullscreen mesh to a scene. */
  addTo(scene) { scene.add(this.mesh); }

  /** Set the Sampson band knobs (mirrors OrbitRingSDF's uPixelWidth/uFeatherPx). */
  setBand({ pixelWidth = null, featherPx = null } = {}) {
    if (pixelWidth !== null) this.material.uniforms.uPixelWidth.value = pixelWidth;
    if (featherPx !== null) this.material.uniforms.uFeatherPx.value = featherPx;
    return {
      pixelWidth: this.material.uniforms.uPixelWidth.value,
      featherPx: this.material.uniforms.uFeatherPx.value,
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
   * Rebuild the packed DataTexture from a generic ring-descriptor list.
   * @param {Array<{matrixWorld:THREE.Matrix4, radius:number, color?:*, alpha?:number, active?:boolean}>} descriptors
   * @param {THREE.PerspectiveCamera} camera  render-time camera (matrixWorld current — D-2)
   * @param {{width:number, height:number}} viewport  the sceneTarget dimensions
   */
  update(descriptors, camera, viewport) {
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

      this._packRing(src, i, conic, d.radius, camDist, isActive ? 1 : 0, c, alpha);
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

    this.texture.needsUpdate = true;
  }

  /** Pack one ring column (rows 0-7). conic===null zeros the conic rows. */
  _packRing(src, i, conic, radius, camDist, activeFlag, color, alpha) {
    const off = (r) => (r * CONIC_MAX + i) * 4;
    const o0 = off(0), o1 = off(1), o2 = off(2), o3 = off(3), o4 = off(4), o5 = off(5), o6 = off(6), o7 = off(7);
    if (conic) {
      const Cs = conic.Cs, Hi = conic.Hinv, rW = conic.rowW;
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
      // row5: Hinv8, _, _, _
      src[o5] = Hi[8]; src[o5 + 1] = 0; src[o5 + 2] = 0; src[o5 + 3] = 0;
      // row6: rowW0..2, _
      src[o6] = rW[0]; src[o6 + 1] = rW[1]; src[o6 + 2] = rW[2]; src[o6 + 3] = 0;
    } else {
      // Null conic: zero the conic rows so no stale data lingers; keep radius/
      // camDist for introspection but force active=0 (shader skips it anyway).
      for (const b of [o0, o1, o3, o4, o5, o6]) { src[b] = 0; src[b + 1] = 0; src[b + 2] = 0; src[b + 3] = 0; }
      src[o2] = 0; src[o2 + 1] = radius; src[o2 + 2] = camDist; src[o2 + 3] = 0;
    }
    // row7: color.rgb, alpha
    src[o7] = color.r; src[o7 + 1] = color.g; src[o7 + 2] = color.b; src[o7 + 3] = alpha;
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
    const Cs = new Float32Array([src[o0], src[o0 + 1], src[o0 + 2], src[o0 + 3], src[o1], src[o1 + 1], src[o1 + 2], src[o1 + 3], src[o2]]);
    const Hinv = new Float32Array([src[o3], src[o3 + 1], src[o3 + 2], src[o3 + 3], src[o4], src[o4 + 1], src[o4 + 2], src[o4 + 3], src[o5]]);
    const rowW = new Float32Array([src[o6], src[o6 + 1], src[o6 + 2]]);
    return {
      Cs, Hinv, rowW,
      radius: src[o2 + 1], camDist: src[o2 + 2], active: src[o2 + 3],
      color: { r: src[o7], g: src[o7 + 1], b: src[o7 + 2] }, alpha: src[o7 + 3],
    };
  }

  /** Free GPU resources. */
  dispose() {
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.texture.dispose();
  }
}
