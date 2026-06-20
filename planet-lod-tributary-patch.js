// planet-lod-tributary-patch.js — Option B river-LOD STEP 2: GPU patch bake + blend.
//
// Context (decided — see docs/superpowers/specs/2026-06-19-river-lod-design.md). STEP 1
// (planet-lod-tributaries.js, commit 31dacc8) proved the PURE topology: growTributaries grows real
// connected dendritic tributaries by local refined re-routing onto trunk-channels-as-outlets. STEP 2
// (this module) is the GPU side: it reads the REAL GPU height at the fine lattice, grows the fine
// network, rasterizes its valley DEPTH into a camera-localised 2D ORTHOGRAPHIC RenderTarget, and sets
// the uniforms the planet shader unions into sampleCarve. The whole point of the 2D ortho patch (vs a
// 2nd cube) is ANGULAR CONCENTRATION: 1024 texels over an ~8° cap ≈ 1 km/texel (~9× finer than the
// ~9 km/texel global carve cube) — that is what makes "bloom on approach" NEW structure not blur.
//
// This module imports THREE (it does GPU work). The pure primitives stay PURE in
// planet-lod-tributaries.js so their headless STEP-1 tests are untouched. projectToPatch (below) is a
// pure no-THREE port of the shader's gnomonic-tangent inverse projection, exported so the UV
// transform is unit-testable AND kept byte-aligned with the GLSL in planet-lod-lab.html.

import * as THREE from 'three';
import {
  localFrame, buildFineGrid, growTributaries, DEFAULT_TRIB_PARAMS,
} from './planet-lod-tributaries.js';
import { createHeightSampler, DEFAULT_PARAMS } from './planet-lod-rivers.js';

// ───────────────────────── projectToPatch (pure; byte-aligned with the GLSL) ─────────────────────────
// GNOMONIC-TANGENT inverse projection: given an object-space unit dir and a patch frame {N,u,v,angular},
// return the planar lateral coords (su,sv), the UV in [0,1]², the normalised lateral distance (0 centre,
// 1 cap edge), and whether the dir is inside the cap. This EXACTLY inverts buildFineGrid's forward
// placement dir = normalize(N + su·u + sv·v): su = dot(dir,u)/dot(dir,N), sv = dot(dir,v)/dot(dir,N),
// with frustum/UV half-extent R = tan(angular). MUST stay identical to patchDepth() in the lab GLSL.
export function projectToPatch(dir, { N, u, v, angular }) {
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cosd = dot(dir, N);
  const inside = cosd > Math.cos(angular);
  const su = cosd !== 0 ? dot(dir, u) / cosd : 0;
  const sv = cosd !== 0 ? dot(dir, v) / cosd : 0;
  const R = Math.tan(angular);
  const uv = [su / (2 * R) + 0.5, sv / (2 * R) + 0.5];
  const lateral = Math.hypot(su, sv) / R;
  return { su, sv, uv, lateral, inside };
}

// ───────────────────────── buildFineValleyGeometry (depth-rails only) ─────────────────────────
// Adapt buildValleyGeometry (planet-lod-rivers.js:589) to the FINE receiver chains, in PLANAR
// (su,sv,0) space (so the bake ortho cam can draw it directly — see §7 of the spec). Differences from
// the cube builder: (1) walks out.freceiver chains for out.isFineChannel===1 verts; (2) emits the
// 3-rail strip (L depth 0 · C depth d · R depth 0) at the verts' PLANAR coords out.planar[k]=[su,sv],
// z=0; (3) the side offset is the 2D planar normal of the chain direction; (4) aDepth only — mouth(G)/
// order(B) stay the global cube's job (v1 is depth-only). depthAt reuses VALLEY_DEPTH_LO/HI lerped by
// fstrahler, exactly like the global cube, so the patch floor depths read on the same scale as global.
export function buildFineValleyGeometry({ out, planar, params = {} }) {
  const P = { ...DEFAULT_PARAMS, ...params };
  const { VALLEY_DEPTH_LO, VALLEY_DEPTH_HI, VALLEY_WIDTH_MUL } = P;
  const MIN_ORDER = DEFAULT_TRIB_PARAMS.channelOrderMin;   // fine-channel gate (Strahler ≥ this)
  const { freceiver, fstrahler, isFineChannel, isOceanFine } = out;
  const Nf = planar.length;

  // max fine order present (for depth normalisation; ≥ MIN_ORDER so the lerp is well-formed).
  let maxOrder = MIN_ORDER;
  for (let k = 0; k < Nf; k++) if (fstrahler[k] > maxOrder) maxOrder = fstrahler[k];
  const depthAt = (o) => {
    const t = Math.max(0, Math.min(1, (o - MIN_ORDER) / Math.max(1, maxOrder - MIN_ORDER)));
    return VALLEY_DEPTH_LO + (VALLEY_DEPTH_HI - VALLEY_DEPTH_LO) * t;
  };
  // valley half-width in PLANAR units. The fine cell already sets the lattice spacing; a small fixed
  // multiple of it (× VALLEY_WIDTH_MUL) gives a valley a couple of cells wide — wide enough to read,
  // narrow enough to stay finer than the global carve. cellPlanar derived from the lattice extent.
  // (planar coords are in tan-units; the patch spans ±R = ±tan(angular).)
  let suMin = Infinity, suMax = -Infinity, svMin = Infinity, svMax = -Infinity;
  for (let k = 0; k < Nf; k++) {
    const s = planar[k]; if (s[0] < suMin) suMin = s[0]; if (s[0] > suMax) suMax = s[0];
    if (s[1] < svMin) svMin = s[1]; if (s[1] > svMax) svMax = s[1];
  }
  const span = Math.max(suMax - suMin, svMax - svMin) || 1;
  const halfWidth = 1.6 * (span / Math.sqrt(Nf)) * (VALLEY_WIDTH_MUL || 1);

  const vPos = [], vDepth = [], vIdx = [];
  let vBase = 0;
  for (let k = 0; k < Nf; k++) {
    if (isFineChannel[k] !== 1) continue;
    const r = freceiver[k];
    if (r === k || r < 0) continue;            // sink / self — no segment to emit
    if (isOceanFine && (isOceanFine[k] || isOceanFine[r])) continue;   // Fix 3: never carve over water
    const a = planar[k], b = planar[r];
    // chain direction in the planar plane; side = 90° rotation (the 2D normal).
    let dx = b[0] - a[0], dy = b[1] - a[1];
    const L = Math.hypot(dx, dy) || 1e-9; dx /= L; dy /= L;
    const nx = -dy, ny = dx;                    // planar normal
    const wK = halfWidth, wR = halfWidth;
    const dK = depthAt(fstrahler[k] || MIN_ORDER), dR = depthAt(fstrahler[r] || MIN_ORDER);
    // 3 rails at k: L,C,R  then 3 rails at r: L,C,R  → two quads (left + right) like the cube builder.
    vPos.push(
      a[0] - nx * wK, a[1] - ny * wK, 0,  a[0], a[1], 0,  a[0] + nx * wK, a[1] + ny * wK, 0,
      b[0] - nx * wR, b[1] - ny * wR, 0,  b[0], b[1], 0,  b[0] + nx * wR, b[1] + ny * wR, 0,
    );
    vDepth.push(0.0, dK, 0.0, 0.0, dR, 0.0);
    const aB = vBase, bB = vBase + 3;           // aB:[L,C,R]@k   bB:[L,C,R]@r
    vIdx.push(aB, aB + 1, bB, aB + 1, bB + 1, bB);             // left quad  (L,C)
    vIdx.push(aB + 1, aB + 2, bB + 1, aB + 2, bB + 2, bB + 1); // right quad (C,R)
    vBase += 6;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(vPos, 3));
  g.setAttribute('aDepth', new THREE.Float32BufferAttribute(vDepth, 1));
  g.setIndex(vIdx);
  g.userData.segmentCount = vIdx.length / 6;
  return g;
}

// ═══════════════════════════════ createTributaryPatch ═══════════════════════════════
// Returns { texture, bake({routed, baseMesh, center, angularRadius, seed, params}), dispose }.
// Internals: a FloatType (→ HalfFloat fallback) 2D RenderTarget, a depth-passthrough ShaderMaterial
// (vDepth → gl_FragColor.r) with MAX-union CustomBlending (same as createCarveCubeMap), and an
// OrthographicCamera looking down +z at the planar geometry (frustum half-size = tan(angularRadius),
// set per-bake). bake() reads the GPU height at the fine lattice, grows the fine network, rasterizes
// the planar valley geometry into the target, and sets uRiverCarvePatch* uniforms (NOT Strength —
// the GUI owns that). Static, on-demand: re-bake-on-move / windowing are deferred (spec §9).
export function createTributaryPatch({ renderer, uniforms, octaves = 12, size = 1024 }) {
  // 2D ortho RTT. FloatType first; HalfFloat fallback (the carve cube proves HalfFloat + MaxEquation).
  let target;
  try {
    target = new THREE.WebGLRenderTarget(size, size, {
      type: THREE.FloatType, format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
      depthBuffer: false, stencilBuffer: false, generateMipmaps: false,
    });
  } catch (e) {
    target = new THREE.WebGLRenderTarget(size, size, {
      type: THREE.HalfFloatType, format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
      depthBuffer: false, stencilBuffer: false, generateMipmaps: false,
    });
  }

  const mat = new THREE.ShaderMaterial({
    glslVersion: null,   // GLSL1, matching createCarveCubeMap (gl_FragColor)
    vertexShader: `
      precision highp float;
      attribute float aDepth;
      varying float vDepth;
      void main(){ vDepth = aDepth; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: `
      precision highp float;
      varying float vDepth;
      void main(){ gl_FragColor = vec4(vDepth, 0.0, 0.0, 1.0); }
    `,
    side: THREE.DoubleSide,
    depthTest: false, depthWrite: false,
    blending: THREE.CustomBlending, blendEquation: THREE.MaxEquation,
    blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
  });

  const scene = new THREE.Scene();
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), mat);
  mesh.frustumCulled = false;
  scene.add(mesh);
  // Ortho cam at (0,0,1) looking down -z onto the planar geometry at z=0 (up = +y = the v tangent
  // axis in planar space). frustum half-size R = tan(angularRadius) is set per-bake (R is per-bake).
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 10);
  cam.position.set(0, 0, 1);
  cam.up.set(0, 1, 0);
  cam.lookAt(0, 0, 0);

  const _c = new THREE.Color();

  function bake({ routed, baseMesh, center, angularRadius, seed = 0, params = {} }) {
    const gridRes = params.gridRes != null ? params.gridRes : DEFAULT_TRIB_PARAMS.gridRes;
    const region = { center, angularRadius, gridRes };

    // 1. fine lattice (deterministic; growTributaries rebuilds the SAME lattice from the same region).
    const { fverts } = buildFineGrid({ center, angularRadius }, gridRes);

    // 2. REAL GPU height at the fine verts (replaces STEP 1's CPU fbm). Higher octave count than the
    //    base router's 9 reveals sub-base-mesh relief for the fine network to follow.
    const sampler = createHeightSampler({ renderer, uniforms, verts: fverts, octavesDuringRead: octaves });
    const { height } = sampler.read();
    sampler.dispose();

    // 3. nearest-fine-vert lookup so growTributaries' macro height trends with the GPU field. The
    //    spike mixes 0.5·baseMacro + 0.5·sampleHeight; here sampleHeight returns the GPU height at the
    //    nearest fine vert (the same lattice growTributaries uses ⇒ exact index correspondence for the
    //    snapped fine verts; for arbitrary p it's the nearest, which is what the macro trend wants).
    const sampleHeight = (p) => {
      let best = 0, bestDot = -Infinity;
      for (let k = 0; k < fverts.length; k++) {
        const f = fverts[k];
        const d = p[0] * f[0] + p[1] * f[1] + p[2] * f[2];
        if (d > bestDot) { bestDot = d; best = k; }
      }
      return height[best];
    };

    // 4. grow the fine dendritic network onto the in-patch trunk outlets. Forward the full §4.3
    //    reader bundle: sampleHeight (mountains, coeff 1.0), the per-vert GPU height array + seaLevel
    //    (the shared ocean boundary) so growTributaries can claim sea outlets (Fix 2) and flag ocean
    //    cells (Fix 3). seaLevel is orchestrator-owned: read straight off the carve uniform.
    const seaLevel = uniforms.uSeaLevel ? uniforms.uSeaLevel.value : undefined;
    const out = growTributaries({ baseMesh, routed, sampleHeight, height, seaLevel, region, seed, params });

    // 5. build the planar fine valley geometry (depth rails only) and render it into the patch RTT.
    const valleyGeo = buildFineValleyGeometry({ out, planar: out.planar, params });
    mesh.geometry.dispose();
    mesh.geometry = valleyGeo;

    const R = Math.tan(angularRadius);
    cam.left = -R; cam.right = R; cam.top = R; cam.bottom = -R;
    cam.updateProjectionMatrix();

    const prevTarget = renderer.getRenderTarget();
    renderer.getClearColor(_c); const prevAlpha = renderer.getClearAlpha();
    renderer.setRenderTarget(target);
    renderer.setClearColor(0x000000, 0);   // depth 0 = MAX baseline (no valley)
    renderer.clear(true, false, false);
    renderer.render(scene, cam);
    renderer.setClearColor(_c, prevAlpha);
    renderer.setRenderTarget(prevTarget);

    // 6. set the patch uniforms (NOT Strength — the GUI owns it). N == patch centre (object space);
    //    u,v are the local-frame tangents the gnomonic inverse projection uses in the shader.
    const { u, v, n } = localFrame(center);
    if (uniforms.uRiverCarvePatchMap)     uniforms.uRiverCarvePatchMap.value = target.texture;
    if (uniforms.uRiverCarvePatchN)       uniforms.uRiverCarvePatchN.value.set(n[0], n[1], n[2]);
    if (uniforms.uRiverCarvePatchU)       uniforms.uRiverCarvePatchU.value.set(u[0], u[1], u[2]);
    if (uniforms.uRiverCarvePatchV)       uniforms.uRiverCarvePatchV.value.set(v[0], v[1], v[2]);
    if (uniforms.uRiverCarvePatchAngular) uniforms.uRiverCarvePatchAngular.value = angularRadius;

    return { center: n, u, v, angular: angularRadius, segmentCount: valleyGeo.userData.segmentCount };
  }

  function dispose() {
    target.dispose(); mat.dispose(); mesh.geometry.dispose();
  }

  return { texture: target.texture, bake, dispose };
}
