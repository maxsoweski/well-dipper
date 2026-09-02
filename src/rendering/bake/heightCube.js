// src/rendering/bake/heightCube.js
// THE RELIEF (HEIGHT) CUBE BAKER — moved here from planet-lod-tectonic.js lines 237–358 (at `3dded82`)
// on 2026-09-02, byte-verbatim: the section banner, RELIEF_CUBE_SIZE, buildHeightCubeGeometry,
// createHeightCube, bakeHeightCube.
//
// FUNCTION: turns a carrier's per-node `height` + `grad` arrays (generated E6 DATA, written by
// writeHeightSphere inside writeBodyRelief) into a 256² HalfFloat RGBA cube — R = the baked
// low-frequency relief scalar, GBA = the shading-only tangent gradient — by building a watertight
// full-sphere triangle mesh (one vertex per node at its unit direction, indexed by mesh.faces) and
// rasterizing it through a CubeCamera at the origin. The planet shader reads the whole body with one
// textureCube(uReliefBakeCube, normalize(vPos)).
//
// INTENT: the river bake host feeds the SAME field to the router and to this cube, so router and
// renderer cannot disagree about where the water goes. Moving it lets the game run that bake; the
// mesh builder it pairs with (buildIrregularSphere) is GPU-free and already sits under
// src/worldengine/mesh/. planet-lod-tectonic.js imports it back and RE-EXPORTS it beside the
// province cube, so planet-lod-rivers.js, the lab and ~2 suites keep their import path.
//
// WHY `src/rendering/bake/` — carried C25, the provinceCube.js precedent (2026-09-01): genuinely
// GPU-coupled (WebGLCubeRenderTarget + CubeCamera + a renderer in every update()), and
// src/worldengine/ stays the layer that needs no GPU to load.
//
// DELIBERATE NON-GOALS: no policy about WHEN to bake or WHICH bodies — that is the bake host's, and
// SPLIT-TRAP #3 (the bake source must be carrier.height, never the sampler readback) stays enforced
// at the CALL SITE in route(), not here; this module rasterizes whatever arrays it is handed. No
// change to size, type or pack: RELIEF_CUBE_SIZE stays 256 and the target stays HalfFloat RGBA,
// because the lab renders exactly these bytes. And no entropy: no Math.random, no Date.now, and it
// must stay that way (guarded in tests/river-bake-host.test.js).
//
// ⛔ BYTE-VERBATIM BELOW THIS LINE.
import * as THREE from 'three';

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// BAKED-RELIEF (WS world-engine-baked-relief-render-2026-06-25) — Phase B: the HEIGHT cube.
//
// A SEPARATE cube mirroring the grain trio EXACTLY (Map 03 §1.6 Option B, plan §B.1). The grain
// RGBA is already full (strike.x, strike.y, grainMag, regime/2), so HEIGHT gets its own cube. The
// ONLY differences from the grain trio: per-vertex aHeight (float) + aGrad (vec3) instead of
// aStrike/aGrainMag/aRegime; the frag packs vec4(vHeight, vGrad.xyz). Same watertight full-sphere
// triangle mesh (one vertex per node at its unit dir, indexed by mesh.faces) ⇒ same direction-keyed,
// seam-free, pole-distortion-free guarantee (every direction covered by exactly one triangle, so
// last-write/replace is correct — NO blending). Same HalfFloat RGBA, LinearFilter, no mips,
// DoubleSide, depthTest/Write false.
//
// ⚠ SPLIT-TRAP #3 (plan §B.5): the height DATA fed in here is the sphere-native E6 carrier.height
// (generated DATA from writeHeightSphere) — NOT a readback of the in-shader noised() field. The bake
// host (planet-lod-rivers.js route()) enforces that source; this file only rasterizes whatever
// `height`/`grad` arrays it is handed.
//
// PURE: no rng, no Date.now — copies the per-node arrays into BufferAttributes (geometry) and renders
// them once (cube). HalfFloat precision is adequate for a coarse low-frequency relief body + a
// shading-only gradient (Map 03 §5).

export const RELIEF_CUBE_SIZE = 256;  // same class as GRAIN_CUBE_SIZE; coarse low-freq body (plan §B.1)

// ── buildHeightCubeGeometry({ mesh, height, grad }) ─────────────────────────────────────────────
// Copy of buildGrainCubeGeometry: full-sphere watertight triangle mesh, one vertex per node at its
// unit direction (verts[i]), triangulated by mesh.faces. Per-vertex attributes:
//   position (vec3) — the node unit direction (unchanged from grain).
//   aHeight  (float) — height[i] (the baked low-frequency relief scalar).
//   aGrad    (vec3)  — grad[i*3..+2] (the per-node tangent-plane gradient, shading-only).
export function buildHeightCubeGeometry({ mesh, height, grad }) {
  const verts = mesh.verts;
  const faces = mesh.faces;
  const N = verts.length;

  const pos = new Float32Array(N * 3);
  const hgt = new Float32Array(N);
  const grd = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = verts[i][0]; pos[i * 3 + 1] = verts[i][1]; pos[i * 3 + 2] = verts[i][2];
    hgt[i] = height[i];
    if (grad) { grd[i * 3] = grad[i * 3]; grd[i * 3 + 1] = grad[i * 3 + 1]; grd[i * 3 + 2] = grad[i * 3 + 2]; }
  }

  // index: 3 vertex ids per face — a watertight sphere so the cube has no holes between nodes.
  const idx = new Uint32Array(faces.length * 3);
  for (let f = 0; f < faces.length; f++) {
    idx[f * 3] = faces[f][0]; idx[f * 3 + 1] = faces[f][1]; idx[f * 3 + 2] = faces[f][2];
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aHeight', new THREE.BufferAttribute(hgt, 1));
  g.setAttribute('aGrad', new THREE.BufferAttribute(grd, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  return g;
}

// ── createHeightCube({ renderer, size }) — LIVE/GPU baker (copy of createGrainCube) ─────────────
// Rasterize buildHeightCubeGeometry into a HalfFloat RGBA cube via a CubeCamera at the origin. The
// planet shader reads it with one textureCube(uReliefBakeCube, normalize(vPos)) → height (R) +
// tangent gradient (GBA). NEEDS a WebGL renderer ⇒ exercised LIVE on :9223, not headless.
//
// Pack: R = height, GBA = tangent gradient. Last-write/replace (NO blending — the sphere is
// watertight, every direction is covered by exactly one triangle; MaxEquation is only for the
// overlapping carve strips). No depth test (origin camera). Clear color (0,0,0,0) = zero height.
export function createHeightCube({ renderer, size = RELIEF_CUBE_SIZE }) {
  const cubeRT = new THREE.WebGLCubeRenderTarget(size, {
    type: THREE.HalfFloatType, format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false,
  });
  const mat = new THREE.ShaderMaterial({
    glslVersion: null,
    vertexShader: `
      precision highp float;
      attribute float aHeight;
      attribute vec3 aGrad;
      varying float vHeight;
      varying vec3 vGrad;
      void main(){ vHeight = aHeight; vGrad = aGrad; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: `
      precision highp float;
      varying float vHeight;
      varying vec3 vGrad;
      // R = baked low-frequency height; GBA = tangent-plane gradient (shading-only, Map 03 §5).
      void main(){ gl_FragColor = vec4(vHeight, vGrad.xyz); }
    `,
    side: THREE.DoubleSide,
    depthTest: false, depthWrite: false,
  });
  const cubeScene = new THREE.Scene();
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), mat);
  mesh.frustumCulled = false;
  cubeScene.add(mesh);
  const cubeCam = new THREE.CubeCamera(0.01, 3, cubeRT);
  const _c = new THREE.Color();
  function update(heightGeo) {
    mesh.geometry.dispose();
    mesh.geometry = heightGeo;
    const prevTarget = renderer.getRenderTarget();
    renderer.getClearColor(_c); const prevAlpha = renderer.getClearAlpha();
    renderer.setClearColor(0x000000, 0);  // empty = zero height; the sphere covers all dirs
    cubeCam.update(renderer, cubeScene);
    renderer.setClearColor(_c, prevAlpha);
    renderer.setRenderTarget(prevTarget);
  }
  function dispose() { cubeRT.dispose(); mat.dispose(); mesh.geometry.dispose(); }
  return { texture: cubeRT.texture, update, dispose };
}

// ── bakeHeightCube({ mesh, height, grad, heightCube }) ──────────────────────────────────────────
// Copy of bakeGrainCube's wrapper shape: build the geometry from the per-node DATA arrays, hand it to
// the cube's update() exactly once. Pure (no rng). heightCube may be null (host may bake before the
// cube exists / a headless test injects a stub). Returns the geometry for probing.
//
// ⚠ SPLIT-TRAP #3: `height` MUST be the sphere-native carrier.height (generated E6 DATA), NEVER the
// in-shader sampler.read()/noised() readback. The call site in route() carries that comment.
export function bakeHeightCube({ mesh, height, grad, heightCube }) {
  const geo = buildHeightCubeGeometry({ mesh, height, grad });
  if (heightCube && typeof heightCube.update === 'function') heightCube.update(geo);
  return geo;
}
