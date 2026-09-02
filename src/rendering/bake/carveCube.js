// src/rendering/bake/carveCube.js
// THE VALLEY-CARVE CUBE BAKER — moved here from planet-lod-rivers.js lines 1143–1194 (at `3dded82`) on 2026-09-02.
//
// FUNCTION: turns the valley FOOTPRINT geometry the river router emits (buildValleyGeometry, now
// src/worldengine/rivers/ribbon.js — per-vertex aDepth / aMouth / aOrder over overlapping tributary
// strips) into a 1024² HalfFloat cube map, by rendering those strips through a CubeCamera at the
// origin with MAX blending and no depth test, so the DEEPEST valley wins wherever tributaries cross.
// The planet shader samples it as textureCube(map, normalize(vPos)) and subtracts .r from the height
// field — direction-keyed, so no equirect seam and no pole distortion.
//
// INTENT: the game has the router and the ribbon builder (Task 1) but no way to get their output onto
// a body, because the ONE thing that rasterizes a valley network into something a shader can sample
// lived in a 108 KB root module the game may not import. This is the lab's own baker, moved — not a
// copy. planet-lod-rivers.js imports it back and re-exports it, so createRiverOverlay's ensureMesh()
// and every existing caller keep the path they have.
//
// WHY `src/rendering/bake/` — carried C25, the provinceCube.js precedent (2026-09-01): the module is
// genuinely GPU-coupled (WebGLCubeRenderTarget + CubeCamera + a renderer in update()), and
// src/worldengine/ stays the layer that loads with no GPU. Its GPU-free upstream half (the router and
// the ribbon/valley geometry) went to src/worldengine/rivers/ for the same reason in reverse.
//
// DELIBERATE NON-GOALS: no policy about WHEN to bake or WHICH bodies — that is the bake host's job.
// No change to size, type, blend or pack: 1024², HalfFloat RGBA, MaxEquation, R=depth G=mouth
// B=order, because the lab renders exactly these bytes and "one pipeline" means the game renders the
// same ones. And no entropy: this module calls neither Math.random nor Date.now, and must not start —
// the cube is a pure function of the geometry it is handed (guarded in tests/river-bake-host.test.js).
//
// ⛔ BYTE-VERBATIM BELOW THIS LINE.
import * as THREE from 'three';

// Cube map of valley depth (R channel), rendered from the valley footprint geometry by a CubeCamera
// at the origin. MAX blend + no depth test so the deepest valley wins where tributaries overlap; the
// planet shader samples it as textureCube(map, normalize(vPos)).r — direction-keyed, so no equirect
// seam or pole distortion, and rotation-invariant (object space) like every other combiner.
export function createCarveCubeMap({ renderer, size = 1024 }) {
  const cubeRT = new THREE.WebGLCubeRenderTarget(size, {
    type: THREE.HalfFloatType, format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false,
  });
  const mat = new THREE.ShaderMaterial({
    glslVersion: null,
    vertexShader: `
      precision highp float;
      attribute float aDepth;
      attribute float aMouth;
      attribute float aOrder;
      varying float vDepth;
      varying float vMouth;
      varying float vOrder;
      void main(){ vDepth = aDepth; vMouth = aMouth; vOrder = aOrder; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: `
      precision highp float;
      varying float vDepth;
      varying float vMouth;
      varying float vOrder;
      void main(){ gl_FragColor = vec4(vDepth, vMouth, vOrder, 1.0); }
    `,
    side: THREE.DoubleSide,
    depthTest: false, depthWrite: false,
    blending: THREE.CustomBlending, blendEquation: THREE.MaxEquation,
    blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
  });
  const cubeScene = new THREE.Scene();
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), mat);
  mesh.frustumCulled = false;
  cubeScene.add(mesh);
  const cubeCam = new THREE.CubeCamera(0.01, 3, cubeRT);
  const _c = new THREE.Color();
  function update(valleyGeo) {
    mesh.geometry.dispose();
    mesh.geometry = valleyGeo;
    const prevTarget = renderer.getRenderTarget();
    renderer.getClearColor(_c); const prevAlpha = renderer.getClearAlpha();
    renderer.setClearColor(0x000000, 0);   // empty cube = depth 0 (no valley); MAX accumulates from 0
    cubeCam.update(renderer, cubeScene);
    renderer.setClearColor(_c, prevAlpha);
    renderer.setRenderTarget(prevTarget);
  }
  function dispose() { cubeRT.dispose(); mat.dispose(); mesh.geometry.dispose(); }
  return { texture: cubeRT.texture, update, dispose };
}
