// src/rendering/bake/provinceCube.js
// THE PROVINCE CUBE BAKER — moved here from planet-lod-tectonic.js lines 360–460 (at dbe17e5) on 2026-09-01.
//
// FUNCTION: turns a carrier's `province` array (one class label per mesh node — 0 craton, 1 orogen,
// 2 basin, written by writeProvince inside writeBodyRelief) into a 128² cube map of interpolated
// one-hot WEIGHTS (RGB) plus a coverage flag (A), by rendering the mesh through a CubeCamera into a
// WebGLCubeRenderTarget. The planet shader samples it at planetShaders.glsl.js:566 and mixes
// uCratonColor / uFreshColor / uSedColor by those weights.
//
// INTENT: the game binds a 1×1 opaque-black placeholder to uProvinceCube (LabPlanetMaterial.js:84),
// which makes the province term inert on every body it renders. This is the lab's own baker, moved
// so the game can call it — not a copy. planet-lod-tectonic.js imports it back and re-exports it, so
// planet-lod-rivers.js and the lab keep their import path.
//
// WHY `src/rendering/bake/` — carried C25: this module is genuinely GPU-coupled (WebGLCubeRenderTarget,
// CubeCamera, a renderer in every update()), and src/worldengine/ stays the layer that needs no GPU
// to load. The mesh builder it pairs with is GPU-free and lives under src/worldengine/mesh/ for the
// same reason in the other direction.
//
// DELIBERATE NON-GOALS: no policy about WHEN to bake or WHICH bodies — that is labBakeHost.js. No
// change to size, type or pack: PROVINCE_CUBE_SIZE stays 128 and the target stays HalfFloat RGBA,
// because the lab renders exactly this and "one pipeline" means the game renders the same bytes.
//
// ⛔ BYTE-VERBATIM BELOW THIS LINE.
import * as THREE from 'three';

// ── PROVINCE CUBE (V2-4 province → GPU) ─────────────────────────────────────────────────────────
// carrier.province is a Uint8Array of {0=craton, 1=orogen, 2=basin} written universally by
// writeProvince() from the body's own history fields (faultDensity / grainMag / accommodation, then
// bounded majority-vote relaxation). It was computed on every dispatch path and consumed ONLY by the
// lab's debug overlay mesh — the renderer never saw it, so a craton, an orogen and a sediment basin
// all drew in one flat colour. This carries it to the shader.
//
// ⚠ WHY ONE-HOT WEIGHTS AND NOT THE LABEL. The cube rasterizes triangles with LinearFilter, so any
// value baked into it is INTERPOLATED across each face and again between texels. Baking the discrete
// label would interpolate craton(0)→orogen(1) into meaningless half-values — "0.5" is not a province.
// Baking a one-hot triple instead makes interpolation the RIGHT operation: it yields province WEIGHTS
// that sum to ~1 and give gradational boundaries, which is both what real province margins look like
// and what keeps the transition off the carrier's mesh resolution (visible faceting otherwise).
//
// Pack: R = craton weight, G = orogen weight, B = basin weight, A = coverage (1 on the sphere).
// A is NOT padding — the clear colour is (0,0,0,0), so A distinguishes "no province data baked here"
// from "a genuine craton" (which is also R=1,G=0,B=0 ... but with A=1). The shader gates on it.
export const PROVINCE_CUBE_SIZE = 128;   // HALF the relief cube: province is a low-frequency, 3-class
                                         // partition with deliberately soft margins — 256 would spend
                                         // 4x the memory resolving an edge the relaxation already blurred.

// buildProvinceCubeGeometry({ mesh, province }) — copy of buildHeightCubeGeometry's shape. One vertex
// per node at its unit direction, triangulated by mesh.faces, carrying the one-hot province weight.
export function buildProvinceCubeGeometry({ mesh, province }) {
  const verts = mesh.verts;
  const faces = mesh.faces;
  const N = verts.length;

  const pos = new Float32Array(N * 3);
  const wgt = new Float32Array(N * 3);   // one-hot {craton, orogen, basin}
  for (let i = 0; i < N; i++) {
    pos[i * 3] = verts[i][0]; pos[i * 3 + 1] = verts[i][1]; pos[i * 3 + 2] = verts[i][2];
    const p = province ? province[i] : 0;
    wgt[i * 3] = (p === 0) ? 1 : 0;
    wgt[i * 3 + 1] = (p === 1) ? 1 : 0;
    wgt[i * 3 + 2] = (p === 2) ? 1 : 0;
  }

  const idx = new Uint32Array(faces.length * 3);
  for (let f = 0; f < faces.length; f++) {
    idx[f * 3] = faces[f][0]; idx[f * 3 + 1] = faces[f][1]; idx[f * 3 + 2] = faces[f][2];
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aProv', new THREE.BufferAttribute(wgt, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  return g;
}

// createProvinceCube({ renderer, size }) — copy of createHeightCube. NEEDS a WebGL renderer ⇒ exercised
// LIVE, not headless. Clear colour (0,0,0,0) ⇒ A=0 marks un-baked directions.
export function createProvinceCube({ renderer, size = PROVINCE_CUBE_SIZE }) {
  const cubeRT = new THREE.WebGLCubeRenderTarget(size, {
    type: THREE.HalfFloatType, format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false,
  });
  const mat = new THREE.ShaderMaterial({
    glslVersion: null,
    vertexShader: `
      precision highp float;
      attribute vec3 aProv;
      varying vec3 vProv;
      void main(){ vProv = aProv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: `
      precision highp float;
      varying vec3 vProv;
      // RGB = interpolated one-hot province weights {craton, orogen, basin}; A = coverage flag.
      void main(){ gl_FragColor = vec4(vProv, 1.0); }
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
  function update(provGeo) {
    mesh.geometry.dispose();
    mesh.geometry = provGeo;
    const prevTarget = renderer.getRenderTarget();
    renderer.getClearColor(_c); const prevAlpha = renderer.getClearAlpha();
    renderer.setClearColor(0x000000, 0);   // A=0 ⇒ "no province baked here"
    cubeCam.update(renderer, cubeScene);
    renderer.setClearColor(_c, prevAlpha);
    renderer.setRenderTarget(prevTarget);
  }
  function dispose() { cubeRT.dispose(); mat.dispose(); mesh.geometry.dispose(); }
  return { texture: cubeRT.texture, update, dispose };
}

// bakeProvinceCube({ mesh, province, provinceCube }) — copy of bakeHeightCube's wrapper shape. Pure
// (no rng). provinceCube may be null (headless / pre-creation), matching the height-cube guard.
export function bakeProvinceCube({ mesh, province, provinceCube }) {
  const geo = buildProvinceCubeGeometry({ mesh, province });
  if (provinceCube && typeof provinceCube.update === 'function') provinceCube.update(geo);
  return geo;
}
