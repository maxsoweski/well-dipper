// planet-lod-tectonic.js
// WS4 orchestrator/baker — the net-new glue (dossier risk #1 / plan §D1) that builds a grain
// carrier, runs the prod E6 writer, and produces the per-node STRIKE-ONLY field the renderer will
// consume. Nothing else in the codebase does this (only vitest builds carriers today).
//
// SCOPE OF THIS FILE AT T4 (scaffold only):
//   - bakeTectonicGrain wires buildIrregularSphere → makeSphereField → writeGrainSphere and emits
//     the documented per-node arrays { grainAngleSmooth, grainMag, regime, strikeWorldX/Y/Z }.
//   - smoothStrikeAngle + the province composition are STUBBED to identity (raw quantized {0, π/2}
//     director). The continuous smooth director, the macroSeed band placement, and the cube bake
//     land in T6/T7/T8; in-shader province rotation lands in T13. T4 lands NO renderer wiring.
//
// SOURCE OF TRUTH (D10): the E6 math is imported from the PROD WS2 copy
// src/worldengine/base/tectonic.js (has the sphere path + exported band constants). The lab
// relief-e6-tectonic.js is reference only — do NOT import it (two copies → drift).
//
// MAX DECISIONS (2026-06-25) honoured here:
//   #3 move-2 / rotatePoleDeg is DROPPED. writeGrainSphere stays the EXISTING 2-arg
//      writeGrainSphere(carrier, drivers) — NO edit to src/worldengine/base/tectonic.js, and this
//      module NEVER threads rotatePoleDeg into it. bakeTectonicGrain accepts a rotatePoleDeg field
//      in its options for forward-compat / call-site stability, but it is a documented no-op.
//
// HARD RULES: no Date.now / no Math.random anywhere in this derivation. The only entropy is the
// integer macroSeed, consumed (later, T6) via the same sin-hash recipe the GLSL uses — never via
// the GUI randUnitVec3 (Math.random) helper.

import * as THREE from 'three';
import { writeGrainSphere, stressAtLat } from './src/worldengine/base/tectonic.js';
import { makeSphereField } from './src/worldengine/base/sphereField.js';

// ── smoothStrikeAngle(sMer, sZon) ──────────────────────────────────────────────────────────────
// T6 (plan §D3): a CONTINUOUS strike director re-derived from the continuous stress components.
// The raw E6 grainAngle (writeGrainSphere) is a 2-value director {0, π/2} that HARD-FLIPS at
// |sMer|=|sZon| (|lat|=45°). Fed raw, a HalfFloat cube that interpolates across that flip smears
// through angles the math never intended, reading as banded stripes with seam-smear.
//
// strike = atan2(|sZon|, |sMer|) is the natural continuous director:
//   • |sMer| ≫ |sZon|  → atan2(small, large) → 0     (meridional-dominant strike — E6's 0 case)
//   • |sZon| ≫ |sMer|  → atan2(large, small) → π/2   (zonal-dominant strike — E6's π/2 case)
//   • |sMer| = |sZon|  → atan2(1, 1) = π/4           (the crossover: PASS THROUGH, don't step)
// It is C∞ in the magnitudes, monotone non-decreasing as the zonal share grows, sign-independent
// (a 2-fold director carries magnitude, not sense), and reproduces the quantized endpoints exactly.
// The cube therefore stores a strike that never interpolates through an angle the stress never had.
export function smoothStrikeAngle(sMer, sZon) {
  return Math.atan2(Math.abs(sZon), Math.abs(sMer));
}

// ── macroSeedRotateDeg(macroSeed) — band placement for INTER-BODY variety (plan §D9, Max #3) ─────
// rotatePoleDeg = f(macroSeed): a deterministic latitude offset so different worlds get different
// band placement (the grain is otherwise latitude-only / longitudinally uniform → identical between
// bodies). Max #3 DROPS threading this into writeGrainSphere (no src/worldengine edit); instead the
// bake re-derives stress at (lat + rotateDeg) via stressAtLat, so the offset is applied entirely
// inside this module over the EXISTING 2-arg writer.
//
// Entropy = the INTEGER macroSeed only, hashed with the SAME sin-hash recipe the GLSL seedOffset
// uses (planet-lod-lab.html:2376: x = sin(n)*43758.5453; frac(x)) so the JS offset and the shader's
// uMacroOffset derive from one shared transform of the same seed (plan §D6/D9 — not one transform
// apart). NO Math.random / Date.now: pure function of the seed. Range ±45° keeps every band reachable
// while guaranteeing distinct fields across seeds.
export function macroSeedRotateDeg(macroSeed = 0) {
  const x = Math.sin((macroSeed | 0) * 12.9898 + 78.233) * 43758.5453;
  const frac = x - Math.floor(x); // [0,1)
  return (frac * 2 - 1) * 45;      // [-45°, +45°)
}

// ── bakeTectonicGrain({ mesh, drivers, macroSeed, rotatePoleDeg }) ──────────────────────────────
// Build the carrier over the SAME buildIrregularSphere mesh the router uses, run the prod
// writeGrainSphere, and emit per-node strike-only fields. At T4 the strike is derived from the raw
// quantized carrier.grainAngle (via the smoothStrikeAngle stub) and converted to a WORLD-space unit
// strike vector through the carrier's orthonormal tangent frame: strike = cos(angle)*east +
// sin(angle)*north (dossier "Slice 1 — WS4 consumer API").
//
// macroSeed and rotatePoleDeg are accepted and validated now so the bake host (T8) and the smooth
// director (T6) plug in without a signature change. At T4 they do not alter the output (Max #3:
// rotatePoleDeg is a no-op; macroSeed band placement is T6).
export function bakeTectonicGrain({ mesh, drivers, macroSeed = 0, rotatePoleDeg = 0 } = {}) {
  if (!mesh || !mesh.verts) {
    throw new Error('bakeTectonicGrain: mesh with verts is required');
  }

  const carrier = makeSphereField(mesh);
  // 2-arg prod writer (Max #3) — pure, zero rng → byte-identical on re-run. It writes the QUANTIZED
  // grainAngle + grainMag + regime onto the carrier; those stay the confidence/classification
  // channels. The SMOOTH strike below is re-derived per node from the continuous stress, so
  // writeGrainSphere is NOT the strike source (its {0, π/2} director would band the cube).
  writeGrainSphere(carrier, drivers);

  // Band placement: a deterministic latitude offset from the integer macroSeed (plan §D9). Applied
  // here (re-derive stress at lat + rotateDeg) rather than threaded into writeGrainSphere — Max #3
  // keeps the writer 2-arg. An explicit rotatePoleDeg arg, if passed, ADDS to the macroSeed offset
  // (caller override), defaulting to 0 so existing 2-field callers are unaffected.
  const rotateDeg = macroSeedRotateDeg(macroSeed) + rotatePoleDeg;

  const N = carrier.N;
  const grainAngleSmooth = new Float32Array(N);
  const grainMag = new Float32Array(N);
  const regime = new Uint8Array(N);
  const strikeWorldX = new Float32Array(N);
  const strikeWorldY = new Float32Array(N);
  const strikeWorldZ = new Float32Array(N);

  for (let i = 0; i < N; i++) {
    // SMOOTH director (T6): re-derive the continuous stress at this node's (band-shifted) latitude
    // and take the continuous strike. stressAtLat is the SAME pure function writeGrainSphere calls,
    // so the regime/grainMag bands stay coherent with the carrier — only the ANGLE becomes smooth.
    const lat = carrier.latDegOf(i) + rotateDeg;
    const { sMer, sZon } = stressAtLat(lat, drivers);
    const angle = smoothStrikeAngle(sMer, sZon);
    grainAngleSmooth[i] = angle;
    grainMag[i] = carrier.grainMag[i];
    regime[i] = carrier.regime[i];

    // Director → world-space unit strike vector via the carrier's orthonormal tangent frame.
    const { east, north } = carrier.tangentFrameAt(i);
    const ca = Math.cos(angle), sa = Math.sin(angle);
    let sx = ca * east[0] + sa * north[0];
    let sy = ca * east[1] + sa * north[1];
    let sz = ca * east[2] + sa * north[2];
    // east/north are orthonormal so |strike| is already ~1; renormalize to wash out fp drift before
    // the HalfFloat cube pack (T7) reads these back.
    const m = Math.hypot(sx, sy, sz) || 1;
    strikeWorldX[i] = sx / m;
    strikeWorldY[i] = sy / m;
    strikeWorldZ[i] = sz / m;
  }

  return { grainAngleSmooth, grainMag, regime, strikeWorldX, strikeWorldY, strikeWorldZ };
}

// ── buildGrainCubeGeometry({ mesh, strikeWorld, grainMag, regime }) ─────────────────────────────
// T7 (plan §D2): the pure geometry the grain CubeCamera renders from. Unlike the carve cube (sparse
// valley STRIPS along channels), grain is a WHOLE-SPHERE field — every mesh node carries a strike —
// so this rasterizes a full-sphere TRIANGLE mesh: one vertex per node at its unit direction
// (verts[i]), triangulated by mesh.faces, each vertex carrying the world strike vector + grainMag +
// regime as attributes. The cube camera at the origin then reads the field by direction
// (textureCube(map, normalize(vPos))) — the same direction-keyed, seam-free, pole-distortion-free
// contract createCarveCubeMap uses, so there's no equirect seam or pole smear.
//
// Channels carried per vertex (the cube fragment packs them into RGBA — D2):
//   aStrike (vec3) → R,G hold the dominant world strike components (the cube fragment selects xy);
//   aGrainMag (float) → B (the continuous confidence channel);
//   aRegime (float, regime/2 ∈ {0,0.5,1}) → A (the classification term, normalized HalfFloat-safe).
//
// PURE: no rng, no Date.now — it only copies the already-derived per-node arrays into BufferAttributes.
export function buildGrainCubeGeometry({ mesh, strikeWorld, grainMag, regime }) {
  const verts = mesh.verts;
  const faces = mesh.faces;
  const N = verts.length;

  const pos = new Float32Array(N * 3);
  const str = new Float32Array(N * 3);
  const mag = new Float32Array(N);
  const reg = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = verts[i][0]; pos[i * 3 + 1] = verts[i][1]; pos[i * 3 + 2] = verts[i][2];
    str[i * 3] = strikeWorld.x[i]; str[i * 3 + 1] = strikeWorld.y[i]; str[i * 3 + 2] = strikeWorld.z[i];
    mag[i] = grainMag[i];
    reg[i] = regime[i] / 2; // {NORMAL:0,STRIKESLIP:1,THRUST:2} → {0,0.5,1}: finite, decodable, no clip
  }

  // index: 3 vertex ids per face — a watertight sphere so the cube has no holes between nodes.
  const idx = new Uint32Array(faces.length * 3);
  for (let f = 0; f < faces.length; f++) {
    idx[f * 3] = faces[f][0]; idx[f * 3 + 1] = faces[f][1]; idx[f * 3 + 2] = faces[f][2];
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aStrike', new THREE.BufferAttribute(str, 3));
  g.setAttribute('aGrainMag', new THREE.BufferAttribute(mag, 1));
  g.setAttribute('aRegime', new THREE.BufferAttribute(reg, 1));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  return g;
}

// ── createGrainCube({ renderer, size }) — LIVE/GPU baker (mirrors createCarveCubeMap) ───────────
// T7 (plan §D2): rasterize buildGrainCubeGeometry into a HalfFloat cube via a CubeCamera at the
// origin — the exact lifecycle createCarveCubeMap (planet-lod-rivers.js:716) uses, so the grain bake
// rides the same once-per-body cadence (T8 calls update() inside route()). The planet shader reads it
// with one textureCube(uTectonicGrainCube, normalize(vPos)) → world strike (RG), grainMag (B),
// regime (A). NEEDS a WebGL renderer ⇒ exercised LIVE on :9223, not headless (see liveDeferred).
//
// Pack: R,G = strike.xy (the dominant world components; sampleGrainStrike rebuilds z from a unit
// constraint or reads it as needed — D2), B = grainMag, A = regime. Last-write/replace (no MAX blend:
// the sphere is watertight, every direction is covered by exactly one triangle, so there is no overlap
// to resolve — unlike valley strips where MAX picks the deepest). No depth test (origin camera).
export function createGrainCube({ renderer, size = 256 }) {
  const cubeRT = new THREE.WebGLCubeRenderTarget(size, {
    type: THREE.HalfFloatType, format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false,
  });
  const mat = new THREE.ShaderMaterial({
    glslVersion: null,
    vertexShader: `
      precision highp float;
      attribute vec3 aStrike;
      attribute float aGrainMag;
      attribute float aRegime;
      varying vec3 vStrike;
      varying float vGrainMag;
      varying float vRegime;
      void main(){ vStrike = aStrike; vGrainMag = aGrainMag; vRegime = aRegime; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: `
      precision highp float;
      varying vec3 vStrike;
      varying float vGrainMag;
      varying float vRegime;
      // RG = world strike xy (interpolated as a direction, re-normalized in-shader on read);
      // B = grain magnitude; A = regime/2. z of the strike is recoverable shader-side from the
      // unit constraint + the sampled xy (the dominant components), per D2.
      void main(){ gl_FragColor = vec4(vStrike.xy, vGrainMag, vRegime); }
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
  function update(grainGeo) {
    mesh.geometry.dispose();
    mesh.geometry = grainGeo;
    const prevTarget = renderer.getRenderTarget();
    renderer.getClearColor(_c); const prevAlpha = renderer.getClearAlpha();
    renderer.setClearColor(0x000000, 0);  // empty = zero strike/mag (no grain); the sphere covers all dirs
    cubeCam.update(renderer, cubeScene);
    renderer.setClearColor(_c, prevAlpha);
    renderer.setRenderTarget(prevTarget);
  }
  function dispose() { cubeRT.dispose(); mat.dispose(); mesh.geometry.dispose(); }
  return { texture: cubeRT.texture, update, dispose };
}

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
