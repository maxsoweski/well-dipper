// planet-lod-rivers.js — SHARED river router + ribbon-overlay pipeline (AC4).
// Extracted from rivers-terrain-lab.main.js (the C3 Max-eye-approved router lab) so there is
// ONE source of the routing/ribbon pipeline, consumed by BOTH the router lab and the planet
// LOD lab (planet-lod-lab.html). Same rationale as AC1's shared height GLSL: the coupling
// spike's verbatim copies are untenable as two drifting copies. This module imports the
// SHARED height GLSL (planet-lod-height.glsl.js) and the histogram sea-level solver
// (planet-lod-sealevel.js), so all three consumers agree on h(pos) and on the sea level-set.
//
// Pipeline (unchanged from the proven router lab):
//   irregular spherical-Delaunay mesh (Fibonacci → Lloyd → ConvexHull adjacency)
//   → RTT FloatType readback of the REAL height field (router main(): F11 omitted, fwBase=0,
//     NO F14 sea cut, output vec4(h, grad)) → priority-flood + flat-resolve + D-inf routing
//   → Horton–Strahler order → Dunne–Leopold variable-width ribbons (Chaikin-smoothed, lifted).
import * as THREE from 'three';
import { ConvexHull } from 'three/addons/math/ConvexHull.js';
import { HEIGHT_GLSL } from './planet-lod-height.glsl.js';
import { solveSeaLevel } from './planet-lod-sealevel.js';
// WS4 T8 — grain bake host. The derivation (bakeTectonicGrain) + cube geometry (buildGrainCubeGeometry)
// + the HalfFloat cube baker (createGrainCube) all live in planet-lod-tectonic.js (the net-new
// orchestrator, plan §D1). createRiverOverlay.route() drives them once per body so the grain bake
// rides the same once-per-(preset,seed,sea) cadence the carve cube already uses (bake-once AC).
import { bakeTectonicGrain, buildGrainCubeGeometry, createGrainCube } from './planet-lod-tectonic.js';
// Baked-relief (WS world-engine-baked-relief-render-2026-06-25) Phase B — the HEIGHT cube trio
// (copies of the grain trio, carrying carrier.height instead of strike). createHeightCube is the
// GPU baker, buildHeightCubeGeometry the pure geometry, bakeHeightCube the once-per-route wrapper.
// The height DATA comes from the sphere-native E6 writer (writeHeightSphere) over the same carrier
// the grain bake uses (makeSphereField). RELIEF_CUBE_SIZE = 256 (same class as GRAIN_CUBE_SIZE).
import { createHeightCube, buildHeightCubeGeometry, bakeHeightCube, RELIEF_CUBE_SIZE } from './planet-lod-tectonic.js';
import { writeHeightSphere, writeGrainSphere } from './src/worldengine/base/tectonic.js';
import { writePlateUpliftSphere, driversToTune } from './src/worldengine/base/plates.js';
import { writeShellReliefSphere, shellRegimeOf } from './src/worldengine/base/shellRelief.js';
import { makeSphereField } from './src/worldengine/base/sphereField.js';

// ───────────────────────── Defaults (from rivers-terrain-lab.main.js) ─────────────────────
export const DEFAULT_PARAMS = Object.freeze({
  TARGET_N: 40000,
  LLOYD_ITERS: 4,
  CHANNEL_ORDER: 2,
  MIN_ORDER: 2,
  WIDTH_PHI: 0.42, WIDTH_EXP: 0.69, WIDTH_SCALE: 0.000275, WIDTH_MIN: 0.00045, WIDTH_MAX: 0.009,
  CHAIKIN_ITERS: 3,
  FLAT_RESOLVE: true,
  DINF_ROUTE: true,
  CHANNEL_FRAC: 0.06,
  LIFT: 0.999,   // seat the water just BELOW the mean surface so it sits in the channel (was 1.0035 = floating)
  // ── width law halved 2026-06-19 (pre-LOD "less cartoonish" baseline) ──
  // WIDTH_SCALE/MIN/MAX were multiplied by 0.5 (shape/ratio/seed logic unchanged). Geomorphically
  // realistic thinness (rivers ~10km ≈ 0.0016 of radius, vs this ~0.009 widest trunk still ~5× wide)
  // awaits the deferred view-dependent river-LOD workstream: below ~0.4× the fixed 40k global
  // drainage network self-erases at orbit distance (nothing finer to fall back on).
  // ── AC6 radius-coupling (Theme-B scale system) ──
  // The width fields above are calibrated at the REFERENCE radius. River width is a real-km
  // footprint; on a unit sphere it occupies a fraction ∝ 1/radiusEarth (the inverse of
  // featureFrequencyFromKm). So WIDTH_SCALE/MIN/MAX scale by refRadius/radiusEarth, clamped so a
  // giant world's rivers don't vanish and a tiny world's don't bloat. (Mesh-resolution scaling is
  // deliberately NOT done here — a single 40k global mesh can't resolve a big world's thread-thin
  // rivers; that's the deferred view-dependent LOD workstream. AC6 is macro PROPORTIONING only.)
  REF_RADIUS_EARTH: 1.0,
  WIDTH_RADIUS_FLOOR: 0.08, WIDTH_RADIUS_CEIL: 2.5,   // UAT item1: lowered 0.2→0.08 so big worlds' rivers can thin to ~true 1/radius instead of clamping
  // UAT item1 (per-planet seeded width): the planet seed draws a width-scale multiplier in this
  // band so river scale varies planet-to-planet ("can go smaller depending on seed"). Applied to
  // WIDTH_SCALE/MIN/MAX only (topology stays seed-invariant). Identity-safe: widthSeed omitted ⇒
  // multiplier 1 ⇒ params unchanged (the router lab stays byte-for-byte).
  WIDTH_SEED_LO: 0.6, WIDTH_SEED_HI: 1.5,
  // ── carve (river→valley incision) ──
  VALLEY_WIDTH_MUL: 4.0,   // valley footprint = water width × this (the V is wider than the water)
  VALLEY_DEPTH_LO: 0.45, VALLEY_DEPTH_HI: 1.0,   // center depth (0..1) lerped by stream order; cube map stores this
  // ── WS4 T10 stream-power incision law (perNodeIncision) ──
  // Δ = -K·A^m·S^n is the DEFAULT carve-depth law (Max decision #1, 2026-06-25): channel-node incision
  // scales with drainage area A (accum) and local downslope gradient S, NOT the legacy order-only tent.
  // The RAW K·A^m·S^n magnitudes are NORMALIZED across channel nodes into [VALLEY_DEPTH_LO..HI] (the
  // HalfFloat carve-cube band, range guard §D5b), so K is an overall gain that cancels under
  // normalization — m/n set the SHAPE (relative depth of big-A/steep channels vs small ones). Keep them
  // named so A/B tuning is a param change, not an edit. params.LEGACY_DEPTH=true falls back to the old
  // Strahler tent (depthAt) for A/B; default = stream-power (the tent is the FLAG, not the default).
  CARVE_K: 1.0, CARVE_M: 0.5, CARVE_N: 1.0,
  CARVE_CUBE_SIZE: 1024,
  // WS4 T8: the grain cube is a WHOLE-SPHERE direction field (one strike per node), not sparse valley
  // strips, so it tolerates a much smaller cube than the carve cube — 256 keeps the bake cheap (it
  // re-bakes once per (preset,seed,sea), same cadence as the carve). Documented tunable per intent.
  GRAIN_CUBE_SIZE: 256,
  TARGET_OCEAN_FRACTION: 0.35,   // AC3: solve uSeaLevel to this fraction (band 0.25–0.45)
});

// WS4 T8 default E6 stress drivers for the grain bake. The lab does not yet surface despin/radial-strain
// (D11/D12) as GUI drivers, so the host supplies this NEUTRAL bundle (matching the grain-oracle test):
// despinAmp 1, contraction sign +1, zero radial strain. When WS1's driver vector wires through, the
// host passes the real bundle; until then neutral gives the deterministic latitude-banded strike the
// smooth director + macroSeed band-placement organize into 2D in-shader (T13).
export const DEFAULT_GRAIN_DRIVERS = Object.freeze({ despinAmp: 1, radialStrainSign: 1, radialStrainMag: 0 });

// ───────────────────────── WS4 T8 — grain bake orchestration helper ─────────────────────────
// bakeGrainCube({ mesh, drivers, macroSeed, grainCube, deriveGrain, buildGrainGeo }) — the ONE place
// the per-body grain bake happens: derive the per-node strike-only field (bakeTectonicGrain, plan §D1),
// build the full-sphere cube geometry (buildGrainCubeGeometry, §D2/T7), and hand it to the grain cube's
// update() so the CubeCamera rasterizes the HalfFloat strike/grainMag/regime cube the shader samples.
//
// Called ONCE per createRiverOverlay.route() (so it inherits route()'s once-per-(preset,seed,sea)
// debounce — bake-once AC). Pure except for the single grainCube.update() side effect: the derivation
// has no rng / no Date.now (entropy = the integer macroSeed only, §D9), so re-running with the same
// (mesh, drivers, macroSeed) yields a byte-identical strike field. Returns the per-node arrays so the
// host can probe the shared field (one-shared-grain). grainCube may be null (the host may bake before
// the cube exists / in a renderer-less context) — the derivation still runs, the GPU update is skipped.
//
// deriveGrain / buildGrainGeo are injectable for headless testing (the real defaults are the pure
// planet-lod-tectonic.js functions; a test passes a spy cube + the real pure derivers to assert the
// once-per-call contract WITHOUT a WebGL renderer).
export function bakeGrainCube({
  mesh, drivers = DEFAULT_GRAIN_DRIVERS, macroSeed = 0, grainCube,
  deriveGrain = bakeTectonicGrain, buildGrainGeo = buildGrainCubeGeometry,
} = {}) {
  const grain = deriveGrain({ mesh, drivers, macroSeed });
  const geo = buildGrainGeo({
    mesh,
    strikeWorld: { x: grain.strikeWorldX, y: grain.strikeWorldY, z: grain.strikeWorldZ },
    grainMag: grain.grainMag,
    regime: grain.regime,
  });
  if (grainCube && typeof grainCube.update === 'function') grainCube.update(geo);
  return grain;
}

// ── computeAdjGradient(carrier) — per-node tangent-plane finite-difference gradient (Phase B.3) ──
// SHADING-ONLY (the router does NOT use this for routing — routeAndOrder derives its own surf-gradient
// from node-to-node drops; Map 04 §10). Packed into the height cube's GBA so perturbAnalytic can bend
// the normal. Returns Float32Array(N*3): the world-space surface gradient ∇h at each node.
//
// Method: for each node i, fit the tangent-plane slope (∂h/∂east, ∂h/∂north) by a least-squares /
// averaged finite difference over its adjacency neighbours (projected into carrier.tangentFrameAt(i)),
// then express the gradient back in world space as gE*east + gN*north (already tangent, no radial
// component). Deterministic (no rng), finite (degenerate neighbour sets ⇒ zero gradient guard),
// seam-free (operates on carrier.adj + the pole-safe tangent frame, object-space — no UV/lat-long).
export function computeAdjGradient(carrier) {
  const N = carrier.N;
  const h = carrier.height;
  const verts = carrier.verts;
  const adj = carrier.adj;
  const grad = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const { east, north } = carrier.tangentFrameAt(i);
    const di = verts[i];
    // Normal-equation accumulators for the 2×2 least-squares fit of (gE, gN) to dh ≈ gE*de + gN*dn.
    let sEE = 0, sEN = 0, sNN = 0, sEh = 0, sNh = 0, used = 0;
    const nb = adj[i];
    for (let k = 0; k < nb.length; k++) {
      const j = nb[k];
      const dj = verts[j];
      // tangent displacement toward neighbour j (project the chord onto the local tangent frame)
      const cx = dj[0] - di[0], cy = dj[1] - di[1], cz = dj[2] - di[2];
      const de = cx * east[0] + cy * east[1] + cz * east[2];
      const dn = cx * north[0] + cy * north[1] + cz * north[2];
      const dh = h[j] - h[i];
      if (!Number.isFinite(de) || !Number.isFinite(dn) || !Number.isFinite(dh)) continue;
      sEE += de * de; sEN += de * dn; sNN += dn * dn;
      sEh += de * dh; sNh += dn * dh; used++;
    }
    let gE = 0, gN = 0;
    const det = sEE * sNN - sEN * sEN;
    if (used >= 2 && Math.abs(det) > 1e-12) {
      gE = (sEh * sNN - sNh * sEN) / det;
      gN = (sNh * sEE - sEh * sEN) / det;
    }
    if (!Number.isFinite(gE)) gE = 0;
    if (!Number.isFinite(gN)) gN = 0;
    // express tangent gradient back in world space (gE along east + gN along north; both tangent)
    grad[i * 3]     = gE * east[0] + gN * north[0];
    grad[i * 3 + 1] = gE * east[1] + gN * north[1];
    grad[i * 3 + 2] = gE * east[2] + gN * north[2];
  }
  return grad;
}

// AC6: object-space river-width factor for a planet of radiusEarth. ∝ refRadius/radiusEarth
// (bigger world ⇒ proportionally thinner rivers ⇒ smaller disk-fraction), clamped off the
// degenerate extremes. radiusEarth floored at 1e-6 so a ~0 radius can't divide-by-zero.
export function widthRadiusFactor(radiusEarth, params = DEFAULT_PARAMS) {
  const ref = params.REF_RADIUS_EARTH ?? 1.0;
  const f = ref / Math.max(radiusEarth || ref, 1e-6);
  return Math.min(params.WIDTH_RADIUS_CEIL ?? 2.5, Math.max(params.WIDTH_RADIUS_FLOOR ?? 0.2, f));
}

// UAT item1: deterministic per-planet width-scale multiplier in [WIDTH_SEED_LO, WIDTH_SEED_HI],
// hashed from the planet seed (small integers like macroSeed). Same seed ⇒ same width every time;
// LO==HI (or seed null) ⇒ 1 (no variation). Affects width only, never topology.
export function widthSeedFactor(seed, params = DEFAULT_PARAMS) {
  const lo = params.WIDTH_SEED_LO ?? 1.0, hi = params.WIDTH_SEED_HI ?? 1.0;
  if (seed == null || lo === hi) return 1.0;
  let x = (Math.floor(seed) >>> 0) || 1;          // integer mix → [0,1)
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x = (x ^ (x >>> 16)) >>> 0;
  return lo + (hi - lo) * (x / 4294967296);
}

// AC6 + UAT item1: return params with the width law scaled for this planet radius AND its per-seed
// draw. Identity at the reference radius with no seed mul (so existing callers / the router lab are
// byte-for-byte unchanged). Scales the absolute width fields only — WIDTH_PHI/EXP (the accumulation
// SHAPE) are radius- and seed-invariant.
export function paramsForRadius(params = DEFAULT_PARAMS, radiusEarth, widthSeedMul = 1) {
  const kR = (radiusEarth == null) ? 1 : widthRadiusFactor(radiusEarth, params);
  const kS = widthSeedMul ?? 1;
  const k = kR * kS;
  if (Math.abs(k - 1) < 1e-9) return params;
  return { ...params,
    WIDTH_SCALE: params.WIDTH_SCALE * k, WIDTH_MIN: params.WIDTH_MIN * k, WIDTH_MAX: params.WIDTH_MAX * k,
    _widthRadiusFactor: kR, _widthSeedMul: kS, _widthFactor: k };
}

// ───────────────────────── RTT height shader (router main) ─────────────────────────
// Identity clip-space vertex shader: one texel per vertex, writes the three varyings
// HEIGHT_GLSL reads (vPos/vObjN/vSubstellarAngle), faithful to the lab's own vertex shader.
export const HEIGHT_VERT = `
  precision highp float;
  attribute vec3 aDir;
  varying vec3 vPos;
  varying vec3 vObjN;
  varying float vSubstellarAngle;
  uniform vec3 uLightDir;
  void main(){
    vObjN = normalize(aDir);
    vPos = normalize(aDir);
    vSubstellarAngle = acos(clamp(dot(vObjN, normalize(uLightDir)), -1.0, 1.0));
    gl_Position = vec4(position.xy, 0.0, 1.0);
    gl_PointSize = 1.0;
  }
`;
// Router main() — the lab's combiner chain VERBATIM minus F11 fluvialCombiner and the F14
// sea cut; fwBase=0 (no screen-space octave fade in the RTT); output packs h + grad.
export const ROUTER_MAIN = `
  void main(){
    initProvinces(vPos);
    float canyonHeight = 0.0;
    float fluvialWet = 0.0;
    float fwBase = 0.0;
    vec4 hd = fbmd(vPos, uOctaves, fwBase);
    float h = hd.x;
    vec3 grad = hd.yzw;
    vec3 gradBase = hd.yzw;
    mountainCombiner(vPos, fwBase, h, grad);
    craterCombiner(vPos, h, grad);
    ejectaCombiner(vPos, h, grad);
    canyonCombiner(vPos, h, canyonHeight, grad);
    outflowCombiner(vPos, h, canyonHeight, grad, 0.0);   // AC5 — order=0: outflow is a downstream scour, must NOT feed routing (order derives FROM routing; outflow off in routing). Early-outs ⇒ zero contribution, router baseline preserved.
    karstCombiner(vPos, h, canyonHeight, grad);
    scarpCombiner(vPos, h, grad);
    plateauCombiner(vPos, fwBase, h, grad);
    tesseraCombiner(vPos, h, grad);
    edificeCombiner(vPos, h, grad);
    chaosCombiner(vPos, h, grad);
    float fctMask;
    facetCombiner(vPos, h, grad, fctMask);
    hexCrust(vPos, h, grad);
    shatterCombiner(vPos, h, grad);
    machineRelief(vPos, h, grad);
    ecuRelief(vPos, h, grad);
    cryoRidgeCombiner(vPos, h, grad);
    sublimationCombiner(vPos, h, grad);
    glacialCombiner(vPos, fwBase, h, grad);
    massWastCombiner(vPos, gradBase, h, grad);
    duneCombiner(vPos, h, grad);
    float dustCover;
    dustCombiner(vPos, h, grad, dustCover);
    lavaCombiner(vPos, h, grad);
    float carbTar;
    carbTarCombiner(vPos, h, grad, carbTar);
    deltaCombiner(vPos, h, grad, fluvialWet, 0.0);  // mouth=0: deltas are a downstream deposit, they must NOT feed routing h (mouths derive FROM routing — circular)
    gl_FragColor = vec4(h, grad);
  }
`;
export const HEIGHT_FRAG = HEIGHT_GLSL + ROUTER_MAIN;

// ───────────── irregular sphere mesh (Fibonacci + Lloyd + spherical Delaunay) ─────────────
function fibonacciSphere(n) {
  const pts = new Array(n);
  const ga = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (2 * i + 1) / n;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const phi = i * ga;
    pts[i] = new THREE.Vector3(Math.cos(phi) * r, y, Math.sin(phi) * r);
  }
  return pts;
}
function sphericalDelaunay(points) {
  for (let i = 0; i < points.length; i++) points[i].__i = i;
  const hull = new ConvexHull().setFromPoints(points);
  const faces = [];
  for (const f of hull.faces) {
    const a = f.edge.head().point.__i;
    const b = f.edge.next.head().point.__i;
    const c = f.edge.next.next.head().point.__i;
    faces.push([a, b, c]);
  }
  return faces;
}
function buildAdjacency(N, faces) {
  const adjSet = Array.from({ length: N }, () => new Set());
  for (const [a, b, c] of faces) {
    adjSet[a].add(b); adjSet[a].add(c);
    adjSet[b].add(a); adjSet[b].add(c);
    adjSet[c].add(a); adjSet[c].add(b);
  }
  return adjSet.map(s => Array.from(s));
}
// Returns { verts:[[x,y,z]…], faces:[[a,b,c]…], adj:[[…neighbours]…] } — terrain-independent.
export function buildIrregularSphere(targetN, lloydIters) {
  let points = fibonacciSphere(targetN);
  for (let it = 0; it < lloydIters; it++) {
    const faces = sphericalDelaunay(points);
    const adj = buildAdjacency(points.length, faces);
    const moved = new Array(points.length);
    const c = new THREE.Vector3();
    for (let i = 0; i < points.length; i++) {
      c.copy(points[i]);
      for (const nb of adj[i]) c.add(points[nb]);
      c.normalize();
      moved[i] = c.clone();
    }
    points = moved;
  }
  const faces = sphericalDelaunay(points);
  const verts = points.map(p => [p.x, p.y, p.z]);
  const adj = buildAdjacency(verts.length, faces);
  return { verts, faces, adj };
}

// ═══════════════════ REAL HEIGHT via RTT readback (THE coupling) ═══════════════════
// Pack the N mesh vertex unit-directions as a point cloud whose clip-space xy hits one texel
// each; render the router main() to a FloatType target (RGBA = h, grad.xyz); read back per
// vertex. The height material binds the SAME `uniforms` object the planet shader consumes, so
// rivers track the live preset/dials. read() pins uOctaves (a fixed high LOD → deterministic,
// detailed routing) and disables uFwClamp (no screen-space octave fade in the 1-px RTT),
// saving/restoring both so the planet render is unaffected.
export function createHeightSampler({ renderer, uniforms, verts, octavesDuringRead = 9 }) {
  const N = verts.length;
  const W = Math.ceil(Math.sqrt(N));
  const Hh = Math.ceil(N / W);
  const positions = new Float32Array(N * 3);
  const dirs = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const px = i % W, py = Math.floor(i / W);
    positions[i * 3]     = ((px + 0.5) / W)  * 2 - 1;
    positions[i * 3 + 1] = ((py + 0.5) / Hh) * 2 - 1;
    positions[i * 3 + 2] = 0;
    dirs[i * 3] = verts[i][0]; dirs[i * 3 + 1] = verts[i][1]; dirs[i * 3 + 2] = verts[i][2];
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aDir', new THREE.BufferAttribute(dirs, 3));
  const mat = new THREE.ShaderMaterial({
    vertexShader: HEIGHT_VERT, fragmentShader: HEIGHT_FRAG, uniforms,
    glslVersion: null,   // GLSL1 (the lab shader is ES100-style: gl_FragColor)
  });
  const points = new THREE.Points(geo, mat);
  const rttScene = new THREE.Scene(); rttScene.add(points);
  const rttCam = new THREE.Camera();   // identity; the vertex shader already outputs clip space
  const target = new THREE.WebGLRenderTarget(W, Hh, {
    type: THREE.FloatType, format: THREE.RGBAFormat,
    minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter,
    depthBuffer: false, stencilBuffer: false,
  });
  const _prevClear = new THREE.Color();
  // returns { height:Float32Array(N), grad:Float32Array(N*3) }
  function read() {
    const prevOct = uniforms.uOctaves.value, prevFw = uniforms.uFwClamp.value;
    uniforms.uOctaves.value = octavesDuringRead;
    uniforms.uFwClamp.value = 0;
    const prevTarget = renderer.getRenderTarget();
    renderer.getClearColor(_prevClear); const prevAlpha = renderer.getClearAlpha();
    renderer.setRenderTarget(target);
    renderer.setClearColor(0x000000, 0); renderer.clear();
    renderer.render(rttScene, rttCam);
    const buf = new Float32Array(W * Hh * 4);
    renderer.readRenderTargetPixels(target, 0, 0, W, Hh, buf);
    renderer.setRenderTarget(prevTarget);
    renderer.setClearColor(_prevClear, prevAlpha);
    uniforms.uOctaves.value = prevOct; uniforms.uFwClamp.value = prevFw;
    const height = new Float32Array(N), grad = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      height[i] = buf[i * 4];
      grad[i * 3] = buf[i * 4 + 1]; grad[i * 3 + 1] = buf[i * 4 + 2]; grad[i * 3 + 2] = buf[i * 4 + 3];
    }
    return { height, grad };
  }
  function dispose() { geo.dispose(); mat.dispose(); target.dispose(); }
  return { read, dispose, W, Hh };
}

// ───────────── ocean mask from the real level-set (h < seaLevel) ─────────────
// AC4 (no north-star debt): `baseLevel` is an OPTIONAL per-node base-level field (Float32Array
// length N). OMITTED => today's scalar-seaLevel ocean set is byte-identical (the identity-safe
// default); SUPPLIED => each node is thresholded against its own local base level, so the later
// precip/climate increment's spatially-varying sea/base level drops in with ZERO rework here.
export function computeOcean(height, seaLevel, N, baseLevel = null) {
  const isOcean = new Uint8Array(N); let oceanCount = 0;
  for (let i = 0; i < N; i++) {
    const thresh = baseLevel ? baseLevel[i] : seaLevel;
    if (height[i] < thresh) { isOcean[i] = 1; oceanCount++; }
  }
  return { isOcean, oceanCount };
}

// ───────────── regime gate: Earth-like plate path vs despun zonal E6 (AC5) ─────────────
// The gate lives HERE at the route()/lab boundary — NOT inside the three-free src/worldengine/base
// layer, which stays regime-agnostic. Earth-like terrestrial/ocean bodies get the one-pass plate/
// uplift field; everything else (tidally-locked / icy / stagnant-lid / volatile / impact) keeps the
// existing despun/zonal E6 writers BYTE-IDENTICAL ("addition by regime, not replacement").
export function isEarthlikePlatePath(archetype, locked = false) {
  if (locked) return false;                 // tidally-locked bodies => despun shell, never plates
  return archetype === 'terrestrial' || archetype === 'ocean';
}

// Writes carrier.height for the body via the gated relief path, and returns which path ran plus the
// plate diagnostics (for the live plateProbe, AC7). Earth-like => the one-pass plate writer
// (carrier.height = U, the SOLE low/mid source). Non-Earth-like => the despun writers EXACTLY as
// before — writeGrainSphere(carrier,grainDrivers) + writeHeightSphere(carrier,{},grainDrivers,
// {name:'tectonic-build'},heightSeed) — same calls, same args, same seed => byte-identical fallback.
// Sibling of isEarthlikePlatePath: true when the body is an icy/despun shell regime. Checked AFTER
// the earthlike gate so the validated plate path is never touched (zero-clobber by construction).
export function isShellReliefPath(archetype, locked = false) {
  return shellRegimeOf(archetype, locked) !== null;
}

export function writeBodyRelief(carrier, {
  archetype = null, locked = false, grainDrivers = DEFAULT_GRAIN_DRIVERS, bodyDrivers = null, macroSeed = 0, heightSeed = 'e6:0',
} = {}) {
  if (isEarthlikePlatePath(archetype, locked)) {
    // Increment 2 (plate driver-response): the body's D-vector (bodyDrivers — a SEPARATE channel from
    // the grain-bake grainDrivers bundle) is mapped to a `tune` override via driversToTune(). SLICE A
    // stub ⇒ null ⇒ the DEFAULTS branch ⇒ byte-identical to the validated POC (AC2). SLICE B fills the
    // calibration. bodyDrivers stays null off the lab driver-response path (every existing caller).
    const plateDiag = writePlateUpliftSphere(carrier, bodyDrivers, { macroSeed, tune: driversToTune(bodyDrivers) });
    return { path: 'plate', plateDiag, shellDiag: null };
  }
  const regime = shellRegimeOf(archetype, locked);    // icy-active | volatile-cold | eyeball-despun | null
  if (regime) {
    const shellDiag = writeShellReliefSphere(carrier, grainDrivers, { macroSeed, regime });
    return { path: 'shell', plateDiag: null, shellDiag };
  }
  writeGrainSphere(carrier, grainDrivers);            // precondition: grain before height
  writeHeightSphere(carrier, {}, grainDrivers, { name: 'tectonic-build' }, heightSeed);
  return { path: 'despun', plateDiag: null, shellDiag: null };
}

// ═══════════════════════ ROUTING + ORDER + METRICS ═══════════════════════
// Priority-flood → flat-resolve → D-inf receiver → Horton–Strahler order, plus the AC5
// network-validity metrics (orphans/uphill/bifurcation ratio/river-scale straightness).
// AC4 (no north-star debt): `precipWeight` is an OPTIONAL per-node discharge weight (Float32Array
// length N). OMITTED => the hardcoded uniform accum=1 (identity, determinism baseline holds); SUPPLIED
// => accum seeds from precipWeight[i], so the later precip/climate increment's rainfall field drops in
// with ZERO rework. `accum` lives on the routed graph that BOTH the per-route carve (buildValleyGeometry)
// AND the epoch readback (perNodeIncision) consume, so this single seam parameterizes discharge for the
// whole pipeline.
export function routeAndOrder({ mesh, height, grad, isOcean, params = DEFAULT_PARAMS, precipWeight = null }) {
  const { verts, adj } = mesh;
  const N = mesh.N != null ? mesh.N : verts.length;
  const { CHANNEL_ORDER, FLAT_RESOLVE, DINF_ROUTE } = params;

  function priorityFlood() {
    const filled = Float32Array.from(height);
    const closed = new Uint8Array(N);
    const heapE = []; const heapI = [];
    function push(e, i) { heapE.push(e); heapI.push(i); let c = heapE.length - 1;
      while (c > 0) { const p = (c - 1) >> 1; if (heapE[p] <= heapE[c]) break; [heapE[p], heapE[c]] = [heapE[c], heapE[p]]; [heapI[p], heapI[c]] = [heapI[c], heapI[p]]; c = p; } }
    function pop() { const e = heapE[0], i = heapI[0]; const le = heapE.pop(), li = heapI.pop();
      if (heapE.length) { heapE[0] = le; heapI[0] = li; let c = 0; const n = heapE.length;
        for (;;) { let l = 2 * c + 1, r = 2 * c + 2, s = c; if (l < n && heapE[l] < heapE[s]) s = l; if (r < n && heapE[r] < heapE[s]) s = r; if (s === c) break;
          [heapE[s], heapE[c]] = [heapE[c], heapE[s]]; [heapI[s], heapI[c]] = [heapI[c], heapI[s]]; c = s; } }
      return [e, i]; }
    for (let i = 0; i < N; i++) { if (isOcean[i]) { closed[i] = 1; push(filled[i], i); } }
    while (heapE.length) {
      const [, c] = pop();
      for (const nb of adj[c]) {
        if (closed[nb]) continue;
        closed[nb] = 1;
        if (filled[nb] <= filled[c]) filled[nb] = filled[c] + 1e-6;
        push(filled[nb], nb);
      }
    }
    return filled;
  }

  function computeGradOff(filled) {
    const gradOff = new Float64Array(N);
    if (!FLAT_RESOLVE) return gradOff;
    const FLATEPS = 1e-4;
    const isFlat = new Uint8Array(N);
    const hiSeed = [], loSeed = [];
    for (let i = 0; i < N; i++) {
      if (isOcean[i]) continue;
      let hasLower = false, adjHigher = false, adjLower = false;
      for (const nb of adj[i]) {
        if (filled[nb] < filled[i] - FLATEPS) { hasLower = true; adjLower = true; }
        else if (filled[nb] > filled[i] + FLATEPS) adjHigher = true;
      }
      if (!hasLower) isFlat[i] = 1;
      if (adjHigher) hiSeed.push(i);
      if (adjLower) loSeed.push(i);
    }
    const flatEdge = (a, b) => isFlat[a] && Math.abs(filled[a] - filled[b]) <= FLATEPS;
    function bfs(seeds) {
      const dist = new Int32Array(N).fill(-1); const q = [];
      for (const s of seeds) { if (isFlat[s]) { dist[s] = 0; q.push(s); } }
      let h = 0;
      while (h < q.length) { const c = q[h++]; for (const nb of adj[c]) { if (isFlat[nb] && dist[nb] < 0 && flatEdge(c, nb)) { dist[nb] = dist[c] + 1; q.push(nb); } } }
      return dist;
    }
    const dLow = bfs(loSeed.filter(i => isFlat[i]));
    const dHigh = bfs(hiSeed.filter(i => isFlat[i]));
    const GSCALE = 5e-7;
    for (let i = 0; i < N; i++) {
      if (!isFlat[i]) continue;
      const dl = dLow[i] >= 0 ? dLow[i] : 0;
      const dh = dHigh[i] >= 0 ? dHigh[i] : 0;
      gradOff[i] = GSCALE * (dl - 0.5 * dh);
    }
    return gradOff;
  }

  const filled = priorityFlood();
  const gradOff = computeGradOff(filled);
  const surf = (i) => filled[i] + gradOff[i];
  const receiver = new Int32Array(N).fill(-1);
  const _a = new THREE.Vector3(), _b = new THREE.Vector3();
  for (let i = 0; i < N; i++) {
    if (isOcean[i]) { receiver[i] = i; continue; }
    const si = surf(i);
    let best = -1;
    if (DINF_ROUTE) {
      _a.set(verts[i][0], verts[i][1], verts[i][2]);
      let bestSlope = 0;
      for (const nb of adj[i]) {
        const drop = si - surf(nb);
        if (drop <= 0) continue;
        _b.set(verts[nb][0], verts[nb][1], verts[nb][2]);
        const slope = drop / Math.max(1e-9, _a.distanceTo(_b));
        if (slope > bestSlope) { bestSlope = slope; best = nb; }
      }
    } else {
      let bestE = si;
      for (const nb of adj[i]) { if (surf(nb) < bestE) { bestE = surf(nb); best = nb; } }
    }
    receiver[i] = best === -1 ? i : best;
  }
  const order = Array.from({ length: N }, (_, i) => i).sort((a, b) => surf(b) - surf(a));
  // AC4: per-node discharge seed — precipWeight[i] when supplied, else uniform 1 (byte-identical).
  const accum = new Float32Array(N);
  for (let i = 0; i < N; i++) accum[i] = precipWeight ? precipWeight[i] : 1;
  for (const i of order) { const r = receiver[i]; if (r !== i) accum[r] += accum[i]; }

  // orphans + uphill
  let landCount = 0, uphill = 0, orphan = 0, selfLoopLand = 0;
  const visitState = new Int8Array(N);
  function reachesOcean(start) {
    const path = []; let c = start, guard = 0;
    while (true) {
      if (isOcean[c]) { for (const p of path) visitState[p] = 1; return true; }
      if (visitState[c] === 1) { for (const p of path) visitState[p] = 1; return true; }
      if (visitState[c] === 2) { for (const p of path) visitState[p] = 2; return false; }
      if (path.includes(c) || guard++ > N + 5) { for (const p of path) visitState[p] = 2; return false; }
      path.push(c);
      const r = receiver[c];
      if (r === c) { for (const p of path) visitState[p] = 2; return false; }
      c = r;
    }
  }
  for (let i = 0; i < N; i++) {
    if (isOcean[i]) continue;
    landCount++;
    if (receiver[i] === i) selfLoopLand++;
    if (receiver[i] !== i && surf(receiver[i]) > surf(i) + 1e-9) uphill++;
    if (!reachesOcean(i)) orphan++;
  }

  // Horton–Strahler
  const strahler = new Int32Array(N).fill(0);
  const childMaxOrd = new Int32Array(N).fill(0);
  const childMaxCnt = new Int32Array(N).fill(0);
  const hasChild = new Uint8Array(N);
  for (let k = 0; k < order.length; k++) {
    const i = order[k];
    if (isOcean[i]) continue;
    const ord = !hasChild[i] ? 1 : (childMaxCnt[i] >= 2 ? childMaxOrd[i] + 1 : childMaxOrd[i]);
    strahler[i] = ord;
    const r = receiver[i];
    if (r !== i && !isOcean[r]) {
      hasChild[r] = 1;
      if (ord > childMaxOrd[r]) { childMaxOrd[r] = ord; childMaxCnt[r] = 1; }
      else if (ord === childMaxOrd[r]) childMaxCnt[r]++;
    }
  }
  const isChannel = new Uint8Array(N);
  let channelCount = 0;
  for (let i = 0; i < N; i++) { if (!isOcean[i] && strahler[i] >= CHANNEL_ORDER) { isChannel[i] = 1; channelCount++; } }

  let maxOrder = 0; const orderHist = {};
  for (let i = 0; i < N; i++) { if (isOcean[i]) continue; const o = strahler[i]; if (o > maxOrder) maxOrder = o; orderHist[o] = (orderHist[o] || 0) + 1; }
  const streamCount = {};
  for (let i = 0; i < N; i++) {
    if (isOcean[i]) continue;
    const o = strahler[i]; const r = receiver[i];
    const ro = (r !== i && !isOcean[r]) ? strahler[r] : -1;
    if (ro !== o) streamCount[o] = (streamCount[o] || 0) + 1;
  }
  let rbSum = 0, rbN = 0;
  for (let w = 1; w < maxOrder - 1; w++) { const a = streamCount[w] || 0, b = streamCount[w + 1] || 0; if (a > 0 && b > 0) { rbSum += a / b; rbN++; } }
  const bifurcationRatioTrimmed = rbN ? +(rbSum / rbN).toFixed(2) : 0;
  let sx = 0, sy = 0, sxx = 0, sxy = 0, sn = 0;
  for (let w = 1; w <= maxOrder; w++) { const c = streamCount[w] || 0; if (c < 1) continue; const x = w, y = Math.log(c); sx += x; sy += y; sxx += x * x; sxy += x * y; sn++; }
  const slope = sn > 1 ? (sn * sxy - sx * sy) / (sn * sxx - sx * sx) : 0;
  const bifurcationRatio = sn > 1 ? +Math.exp(-slope).toFixed(2) : bifurcationRatioTrimmed;

  // river-scale straightness
  const DEG2 = 2 * Math.PI / 180;
  function chordDir(i, j) { let ex = verts[j][0] - verts[i][0], ey = verts[j][1] - verts[i][1], ez = verts[j][2] - verts[i][2];
    const L = Math.hypot(ex, ey, ez); return L < 1e-10 ? null : [ex / L, ey / L, ez / L]; }
  function scaleStraightness(STEP) {
    const turns = []; let bends = 0, coll = 0;
    for (let s = 0; s < N; s++) {
      if (!isChannel[s]) continue;
      let isHead = true; for (const nb of adj[s]) { if (isChannel[nb] && receiver[nb] === s) { isHead = false; break; } }
      if (!isHead) continue;
      const path = []; let c = s, g = 0;
      while (isChannel[c] && g++ < 200000) { path.push(c); const r = receiver[c]; if (r === c || !isChannel[r]) break; c = r; }
      const dirs = [];
      for (let k = 0; k + STEP < path.length; k += STEP) { const d = chordDir(path[k], path[k + STEP]); if (d) dirs.push(d); }
      for (let k = 1; k < dirs.length; k++) {
        let cc = dirs[k - 1][0] * dirs[k][0] + dirs[k - 1][1] * dirs[k][1] + dirs[k - 1][2] * dirs[k][2];
        cc = Math.max(-1, Math.min(1, cc)); const t = Math.acos(cc);
        turns.push(t); bends++; if (t < DEG2) coll++;
      }
    }
    turns.sort((a, b) => a - b);
    return { STEP, bends, nearCollinearPct: bends ? +(100 * coll / bends).toFixed(2) : 0,
             medianTurnDeg: bends ? +(turns[turns.length >> 1] * 180 / Math.PI).toFixed(2) : 0 };
  }
  const riverScale = scaleStraightness(3);
  const riverScale6 = scaleStraightness(6);

  return { filled, surf, receiver, accum, order, strahler, isChannel, channelCount,
    landCount, uphill, orphan, selfLoopLand, maxOrder, orderHist, streamCount,
    bifurcationRatio, bifurcationRatioTrimmed, riverScale, riverScale6 };
}

// ───────────── ribbon build (Dunne–Leopold widths, Chaikin-smoothed, lifted) ─────────────
export function buildRibbonGeometry({ mesh, routed, params = DEFAULT_PARAMS }) {
  const { adj, pos } = mesh;
  const N = mesh.N != null ? mesh.N : (pos.length / 3);
  const { MIN_ORDER, WIDTH_PHI, WIDTH_EXP, WIDTH_SCALE, WIDTH_MIN, WIDTH_MAX, CHAIKIN_ITERS, LIFT } = params;
  // Geometric sphere radius the ribbon is built on. Default 1.0 = the lab's unit sphere (no-op);
  // the game surface is IcosahedronGeometry(d.radius,5), so the port passes radius = d.radius. The
  // whole ribbon scales uniformly by radius (centerline lift *radius*LIFT AND lateral width *radius),
  // so the river keeps the SAME angular footprint on any sphere. NOTE this is the GEOMETRIC radius —
  // orthogonal to radiusEarth (AC6 width-proportioning) and to ribbonLift (the un-occlude mesh scale).
  const radius = params.radius != null ? params.radius : 1;
  const { receiver, accum, strahler, maxOrder, isChannel } = routed;
  const rendered = new Uint8Array(N);
  for (let i = 0; i < N; i++) if (isChannel[i] && strahler[i] >= MIN_ORDER) rendered[i] = 1;
  const widthAt = (i) => {
    const phiW = WIDTH_PHI * Math.pow(accum[i], WIDTH_EXP);
    return THREE.MathUtils.clamp(WIDTH_SCALE * phiW, WIDTH_MIN, WIDTH_MAX);
  };
  const cOrd = (o) => {
    // Deep-water palette (de-glowed): dark navy headwaters → lit water-blue trunks. Keeps the
    // stream-order gradient but well below the old luminous cyan that read as a glowing decal.
    // Tuned to read AGAINST the carved (darkened) valley floor without glowing back to a decal.
    const t = THREE.MathUtils.clamp((o - MIN_ORDER) / Math.max(1, maxOrder - MIN_ORDER), 0, 1);
    return new THREE.Color(0x1d3c5e).lerp(new THREE.Color(0x4486bb), t);
  };
  function chaikin(pts, iters) {
    let cur = pts;
    for (let it = 0; it < iters; it++) {
      if (cur.length < 3) break;
      const out = [cur[0]];
      for (let k = 0; k < cur.length - 1; k++) {
        const a = cur[k], b = cur[k + 1];
        const mk = (t) => {
          const v = new THREE.Vector3(a.p[0] + (b.p[0] - a.p[0]) * t, a.p[1] + (b.p[1] - a.p[1]) * t, a.p[2] + (b.p[2] - a.p[2]) * t).normalize().multiplyScalar(radius * LIFT);
          return { p: [v.x, v.y, v.z], w: a.w + (b.w - a.w) * t, c: a.c.clone().lerp(b.c, t) };
        };
        out.push(mk(0.25), mk(0.75));
      }
      out.push(cur[cur.length - 1]);
      cur = out;
    }
    return cur;
  }
  const heads = [];
  for (let i = 0; i < N; i++) {
    if (!rendered[i]) continue;
    let isHead = true;
    for (const nb of adj[i]) { if (rendered[nb] && receiver[nb] === i) { isHead = false; break; } }
    if (isHead) heads.push(i);
  }
  const ribPos = [], ribCol = [], ribIdx = []; let vBase = 0;
  const drawn = new Uint8Array(N);
  const up = new THREE.Vector3(), fwd = new THREE.Vector3(), side = new THREE.Vector3();
  function emitRibbon(spts) {
    if (spts.length < 2) return;
    const P = spts.map(s => new THREE.Vector3(s.p[0], s.p[1], s.p[2]));
    for (let k = 0; k < spts.length; k++) {
      const cur = P[k];
      fwd.set(0, 0, 0);
      if (k > 0) fwd.add(cur.clone().sub(P[k - 1]));
      if (k < spts.length - 1) fwd.add(P[k + 1].clone().sub(cur));
      up.copy(cur).normalize();
      fwd.sub(up.clone().multiplyScalar(fwd.dot(up)));
      if (fwd.lengthSq() < 1e-14) fwd.set(up.y, up.z, up.x);
      fwd.normalize();
      side.crossVectors(up, fwd).normalize().multiplyScalar(spts[k].w);
      const L = cur.clone().sub(side), Rr = cur.clone().add(side);
      const c = spts[k].c;
      ribPos.push(L.x, L.y, L.z, Rr.x, Rr.y, Rr.z);
      ribCol.push(c.r, c.g, c.b, c.r, c.g, c.b);
      if (k > 0) { const b0 = vBase + (k - 1) * 2, b1 = vBase + k * 2; ribIdx.push(b0, b0 + 1, b1, b0 + 1, b1 + 1, b1); }
    }
    vBase += spts.length * 2;
  }
  function pathFrom(start) {
    const raw = []; let c = start, g = 0;
    while (rendered[c] && g++ < 200000) {
      raw.push(c);
      if (drawn[c]) break;
      drawn[c] = 1;
      const r = receiver[c];
      if (r === c || !rendered[r]) { if (r !== c) raw.push(r); break; }
      c = r;
    }
    return raw;
  }
  function buildAndEmit(start) {
    const raw = pathFrom(start);
    if (raw.length < 2) return;
    const pts = raw.map(idx => ({ p: [pos[idx * 3] * radius * LIFT, pos[idx * 3 + 1] * radius * LIFT, pos[idx * 3 + 2] * radius * LIFT],
                                  w: widthAt(idx) * radius, c: cOrd(strahler[idx] || MIN_ORDER) }));
    emitRibbon(chaikin(pts, CHAIKIN_ITERS));
  }
  for (const h of heads) buildAndEmit(h);
  for (let i = 0; i < N; i++) { if (rendered[i] && !drawn[i]) buildAndEmit(i); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(ribPos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(ribCol, 3));
  g.setIndex(ribIdx); g.computeVertexNormals();
  g.userData.renderedCount = rendered.reduce((a, b) => a + b, 0);
  // AC5: monotonic-width violation count — width must grow (never shrink) toward the sea along
  // the rendered network. width = f(accum) with accum monotone-nondecreasing downstream, so this
  // is structurally 0; the metric is the guard that the width law actually preserves that.
  let widthViolations = 0;
  for (let i = 0; i < N; i++) {
    if (!rendered[i]) continue;
    const r = receiver[i];
    if (r === i || !rendered[r]) continue;        // sea-mouth or order-cutoff terminus
    if (widthAt(r) < widthAt(i) - 1e-6) widthViolations++;
  }
  g.userData.widthViolations = widthViolations;
  return g;
}

// ═══════════════════════ CARVE — valley footprint + depth cube map ═══════════════════════
// The lab planet is a smooth normal-mapped sphere (all relief is faked via normal perturbation
// + albedo, no real geometry). So "carve a valley" = bend the normal into a V-channel + darken
// the floor ALONG THE REAL ROUTED NETWORK (this is what kept F11 from working: F11 carved a noise
// mask; this carves the actual dendritic drainage). We rasterize the network into a direction-keyed
// cube map of valley DEPTH; the planet shader samples it by surface direction and subtracts a valley
// profile from h (the existing perturbAnalytic does the normal). buildValleyGeometry emits a 3-rail
// strip (left edge depth 0 · center depth d01 · right edge depth 0) per smoothed channel path — the
// tent profile rasterizes a V-valley; the valley is wider than the water ribbon and deepens with order.
export function buildValleyGeometry({ mesh, routed, isOcean, params = DEFAULT_PARAMS }) {
  const { adj, pos } = mesh;
  const N = mesh.N != null ? mesh.N : (pos.length / 3);
  const { MIN_ORDER, WIDTH_PHI, WIDTH_EXP, WIDTH_SCALE, WIDTH_MIN, WIDTH_MAX, CHAIKIN_ITERS, LIFT,
          VALLEY_WIDTH_MUL, VALLEY_DEPTH_LO, VALLEY_DEPTH_HI } = params;
  const { receiver, accum, strahler, maxOrder, isChannel } = routed;
  const rendered = new Uint8Array(N);
  for (let i = 0; i < N; i++) if (isChannel[i] && strahler[i] >= MIN_ORDER) rendered[i] = 1;
  const halfWidthAt = (i) => {
    const phiW = WIDTH_PHI * Math.pow(accum[i], WIDTH_EXP);
    return THREE.MathUtils.clamp(WIDTH_SCALE * phiW, WIDTH_MIN, WIDTH_MAX) * VALLEY_WIDTH_MUL;
  };
  const depthAt = (o) => {
    const t = THREE.MathUtils.clamp((o - MIN_ORDER) / Math.max(1, maxOrder - MIN_ORDER), 0, 1);
    return VALLEY_DEPTH_LO + (VALLEY_DEPTH_HI - VALLEY_DEPTH_LO) * t;
  };
  // AC2: a node is a MOUTH iff it's a land channel node whose receiver is ocean. Mouth strength is
  // sized by drainage (accum) so bigger rivers carry stronger mouths (drives AC4 delta size). Normalize
  // by the largest mouth's accum so G ∈ [0..1]; guard /0 -> 1 (no mouths). isOcean is threaded in from
  // route() (the graph that was previously discarded is now used to bake the extra channels).
  const isMouth = (i) => !!isOcean && isChannel[i] && !isOcean[i] && isOcean[receiver[i]];
  let maxMouthAccum = 0;
  for (let i = 0; i < N; i++) if (isMouth(i)) { const a = accum[i]; if (a > maxMouthAccum) maxMouthAccum = a; }
  const mouthDenom = maxMouthAccum > 0 ? maxMouthAccum : 1;
  const mouthStrength = (i) => isMouth(i) ? THREE.MathUtils.clamp(accum[i] / mouthDenom, 0, 1) : 0;
  // AC2: normalized stream-order/width proxy for the B channel (same t depthAt uses).
  const orderNorm = (o) => THREE.MathUtils.clamp((o - MIN_ORDER) / Math.max(1, maxOrder - MIN_ORDER), 0, 1);
  function chaikin(pts, iters) {
    let cur = pts;
    for (let it = 0; it < iters; it++) {
      if (cur.length < 3) break;
      const out = [cur[0]];
      for (let k = 0; k < cur.length - 1; k++) {
        const a = cur[k], b = cur[k + 1];
        const mk = (t) => {
          const v = new THREE.Vector3(a.p[0] + (b.p[0] - a.p[0]) * t, a.p[1] + (b.p[1] - a.p[1]) * t, a.p[2] + (b.p[2] - a.p[2]) * t).normalize();
          return { p: [v.x, v.y, v.z], w: a.w + (b.w - a.w) * t, d: a.d + (b.d - a.d) * t,
                   m: a.m + (b.m - a.m) * t, ord: a.ord + (b.ord - a.ord) * t };
        };
        out.push(mk(0.25), mk(0.75));
      }
      out.push(cur[cur.length - 1]);
      cur = out;
    }
    return cur;
  }
  const heads = [];
  for (let i = 0; i < N; i++) {
    if (!rendered[i]) continue;
    let isHead = true;
    for (const nb of adj[i]) { if (rendered[nb] && receiver[nb] === i) { isHead = false; break; } }
    if (isHead) heads.push(i);
  }
  const vPos = [], vDepth = [], vMouth = [], vOrder = [], vIdx = []; let vBase = 0;
  const drawn = new Uint8Array(N);
  const up = new THREE.Vector3(), fwd = new THREE.Vector3(), side = new THREE.Vector3();
  function emitValley(spts) {
    if (spts.length < 2) return;
    const P = spts.map(s => new THREE.Vector3(s.p[0], s.p[1], s.p[2]));
    for (let k = 0; k < spts.length; k++) {
      const cur = P[k];
      fwd.set(0, 0, 0);
      if (k > 0) fwd.add(cur.clone().sub(P[k - 1]));
      if (k < spts.length - 1) fwd.add(P[k + 1].clone().sub(cur));
      up.copy(cur).normalize();
      fwd.sub(up.clone().multiplyScalar(fwd.dot(up)));
      if (fwd.lengthSq() < 1e-14) fwd.set(up.y, up.z, up.x);
      fwd.normalize();
      side.crossVectors(up, fwd).normalize().multiplyScalar(spts[k].w);
      const C = cur.clone().normalize();
      const L = cur.clone().sub(side).normalize(), R = cur.clone().add(side).normalize();
      vPos.push(L.x, L.y, L.z, C.x, C.y, C.z, R.x, R.y, R.z);   // 3 rails: L, C, R
      vDepth.push(0.0, spts[k].d, 0.0);
      // AC2: mouth is a point/center feature -> tent like depth (0 at edges, strength at center).
      // order is a property of the WHOLE channel -> FLAT across the cross-section, so a high-order
      // trunk's EDGE still beats a crossing low-order valley's CENTER under MAX (clean trunk oracle).
      vMouth.push(0.0, spts[k].m, 0.0);
      vOrder.push(spts[k].ord, spts[k].ord, spts[k].ord);
      if (k > 0) {
        const a = vBase + (k - 1) * 3, b = vBase + k * 3;   // a:[L,C,R]@k-1  b:[L,C,R]@k
        vIdx.push(a, a + 1, b, a + 1, b + 1, b);             // left quad  (L,C)
        vIdx.push(a + 1, a + 2, b + 1, a + 2, b + 2, b + 1); // right quad (C,R)
      }
    }
    vBase += spts.length * 3;
  }
  function pathFrom(start) {
    const raw = []; let c = start, g = 0;
    while (rendered[c] && g++ < 200000) {
      raw.push(c);
      if (drawn[c]) break;
      drawn[c] = 1;
      const r = receiver[c];
      if (r === c || !rendered[r]) { if (r !== c) raw.push(r); break; }
      c = r;
    }
    return raw;
  }
  function buildAndEmit(start) {
    const raw = pathFrom(start);
    if (raw.length < 2) return;
    const pts = raw.map(idx => ({ p: [pos[idx * 3], pos[idx * 3 + 1], pos[idx * 3 + 2]],
                                  w: halfWidthAt(idx), d: depthAt(strahler[idx] || MIN_ORDER),
                                  m: mouthStrength(idx), ord: orderNorm(strahler[idx] || MIN_ORDER) }));
    emitValley(chaikin(pts, CHAIKIN_ITERS));
  }
  for (const h of heads) buildAndEmit(h);
  for (let i = 0; i < N; i++) { if (rendered[i] && !drawn[i]) buildAndEmit(i); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(vPos, 3));
  g.setAttribute('aDepth', new THREE.Float32BufferAttribute(vDepth, 1));
  g.setAttribute('aMouth', new THREE.Float32BufferAttribute(vMouth, 1));
  g.setAttribute('aOrder', new THREE.Float32BufferAttribute(vOrder, 1));
  g.setIndex(vIdx);
  return g;
}

// ───────────── WS4 T9/T10 — perNodeIncision: the REAL carve operand (Δ ≤ 0 per mesh node) ─────────────
// THE problem this solves (plan §D5-pre): `buildValleyGeometry` returns 3-rail STRIP geometry whose
// `aDepth` is a POSITIVE tent on new strip vertices that do NOT map 1:1 to mesh nodes; `routeAndOrder`
// returns `filled` (priority-flood, which RAISES). Neither is a per-node `carved[i]`, so the
// `carve-subtractive` AC ("carved ≤ authored at every vertex") had no operand. `perNodeIncision` is that
// missing single source of carve depth: a Float32Array Δ over the SAME mesh nodes, every Δ[i] ≤ 0, the
// per-node height drop the carve applies. `buildValleyGeometry`'s per-rail `aDepth` and the carve cube's
// R channel both DERIVE from `-Δ[i]` (so the unit and the rendered cube agree by construction, not by
// coincidence — plan §D5/T9). This is a PURE function over the routed substrate: no rng, no Date.now —
// re-running with the same (mesh, routed, authored, params) yields a byte-identical Δ.
//
// `authored` is the height the router actually routed on (the routed substrate, ROUTER_MAIN field). The
// helper does NOT witness the shader's `reliefGate` (a rendered-only field, §D5d, proven LIVE in T12) and
// does NOT mutate `authored` (epoch-build-identical, §T11 — the caller applies Δ to a fresh copy).
//
// DEFAULT carve law (Max decision #1): stream-power Δ = -K·A^m·S^n on channel nodes, 0 elsewhere.
//   A = accum[i] (drainage area proxy); S[i] = local downslope gradient = max over adj of
//       (surf(i)-surf(nb))/dist(i,nb) using routed.surf (the flat-resolved filled+gradOff closure).
// The raw K·A^m·S^n magnitudes are NORMALIZED across channel nodes into [VALLEY_DEPTH_LO..HI] — the
// HalfFloat carve-cube depth band (range guard §D5b) — so the deepest trunk lands at HI and shallower
// channels scale down proportionally; deep trunks can't clip the cube or blow the carve budget.
// params.LEGACY_DEPTH=true falls back to the legacy order-only Strahler tent (depthAt) for A/B.
export function perNodeIncision({ mesh, routed, authored, params = DEFAULT_PARAMS }) {
  const { adj, pos } = mesh;
  const N = mesh.N != null ? mesh.N : (pos.length / 3);
  const { MIN_ORDER, VALLEY_DEPTH_LO, VALLEY_DEPTH_HI, CARVE_K, CARVE_M, CARVE_N } = params;
  const { accum, strahler, isChannel, surf, maxOrder } = routed;
  // void authored: the law is computed over the routed graph; authored is the substrate the caller
  // proves the subtraction against (carved = authored + Δ) and is intentionally NOT mutated here.
  void authored;

  const incision = new Float32Array(N); // defaults to 0 everywhere (off-channel nodes stay untouched)

  // channel mask — mirror buildValleyGeometry's `rendered`: a real channel of at least MIN_ORDER.
  const isCarved = (i) => isChannel[i] && strahler[i] >= MIN_ORDER;

  // node-to-node geodesic-ish distance on the unit sphere (chord length is fine for a local gradient).
  const dist = (i, j) => {
    const dx = pos[i * 3] - pos[j * 3];
    const dy = pos[i * 3 + 1] - pos[j * 3 + 1];
    const dz = pos[i * 3 + 2] - pos[j * 3 + 2];
    return Math.hypot(dx, dy, dz);
  };
  // local downslope gradient S[i] (≥ 0): steepest drop from i to any lower neighbour on the routed
  // surface. surf is the closure (i)=>filled[i]+gradOff[i] (rivers.js routeAndOrder), so this is the
  // flat-resolved hydrologic gradient the routing itself used.
  const slopeAt = (i) => {
    const si = surf(i);
    let best = 0;
    for (const nb of adj[i]) {
      const d = dist(i, nb);
      if (d < 1e-9) continue;
      const g = (si - surf(nb)) / d;
      if (g > best) best = g;
    }
    return best;
  };

  // legacy order-only tent (depthAt) reachable behind LEGACY_DEPTH for A/B (plan §T10).
  const LEGACY = !!params.LEGACY_DEPTH;
  const legacyDepth = (o) => {
    const t = THREE.MathUtils.clamp((o - MIN_ORDER) / Math.max(1, maxOrder - MIN_ORDER), 0, 1);
    return VALLEY_DEPTH_LO + (VALLEY_DEPTH_HI - VALLEY_DEPTH_LO) * t; // already in-band
  };

  if (LEGACY) {
    for (let i = 0; i < N; i++) if (isCarved(i)) incision[i] = -legacyDepth(strahler[i]);
    return incision;
  }

  // ── stream-power (default): raw magnitude K·A^m·S^n per channel node, then normalize into the band ──
  const raw = new Float32Array(N);
  let maxRaw = 0;
  for (let i = 0; i < N; i++) {
    if (!isCarved(i)) continue;
    const A = accum[i] > 0 ? accum[i] : 0;
    const S = slopeAt(i);
    const r = CARVE_K * Math.pow(A, CARVE_M) * Math.pow(S, CARVE_N);
    raw[i] = r;
    if (r > maxRaw) maxRaw = r;
  }
  if (maxRaw <= 0) return incision; // no carveable channels (degenerate) → all-zero, still subtractive

  // map raw ∈ (0..maxRaw] → depth ∈ [VALLEY_DEPTH_LO..VALLEY_DEPTH_HI]; deepest channel = HI, the rest
  // scale linearly by their stream-power magnitude (so deep, high-A/steep trunks sit deepest, in-band).
  const span = VALLEY_DEPTH_HI - VALLEY_DEPTH_LO;
  for (let i = 0; i < N; i++) {
    if (!isCarved(i) || raw[i] <= 0) continue;
    const depth = VALLEY_DEPTH_LO + span * (raw[i] / maxRaw);
    incision[i] = -depth; // strictly ≤ 0 (depth ∈ [LO..HI] > 0)
  }
  return incision;
}

// ───────────── WS4 T11 — applyIncision: fold the carve onto an IMMUTABLE COPY of the build snapshot ─────
// AC `epoch-build-identical` (unit, plan §T11). The carve apply step MUST read the epoch-1 build snapshot
// (`authored` = the routed substrate / ROUTER_MAIN field) and WRITE A FRESH array — it must NOT mutate
// `authored` in place. This preserves epoch 1 byte-identically through epoch 2, so:
//   carved[i] = authored[i] + incision[i],  incision[i] ≤ 0  ⇒  carved[i] ≤ authored[i] (height only drops).
// This is the SINGLE fold of perNodeIncision (T9/T10) onto the snapshot; keeping it a pure, allocating
// helper (no in-place `authored[i] +=`) is exactly the immutability the AC binds to. Pure: no rng, no
// Date.now — same (authored, incision) → byte-identical carved. (The rendered "epoch 1 is the uncut
// relief" claim rests on the LIVE readback T12; this unit proves only the JS-side immutable-copy + Δ≤0.)
export function applyIncision(authored, incision) {
  const N = authored.length;
  const carved = new Float32Array(N); // fresh array — authored (the build snapshot) is never written
  for (let i = 0; i < N; i++) carved[i] = authored[i] + incision[i];
  return carved;
}

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

// ───────────── stats bundle (C1 height sanity + C2/AC5 network metrics) ─────────────
export function buildStats({ routed, height, N, faces, seaLevel, oceanCount, ribGeo, label, totalMs }) {
  let hmin = Infinity, hmax = -Infinity, nan = 0; const hs = [];
  for (let i = 0; i < N; i++) { const v = height[i]; if (!Number.isFinite(v)) nan++; else { if (v < hmin) hmin = v; if (v > hmax) hmax = v; hs.push(v); } }
  hs.sort((a, b) => a - b);
  const hmed = hs.length ? hs[hs.length >> 1] : 0;
  return {
    label: label || 'build', N, faces,
    totalMs: totalMs != null ? +totalMs.toFixed(1) : null,
    seaLevel: +seaLevel.toFixed(4), oceanFrac: +(oceanCount / N).toFixed(3), oceanPct: +(100 * oceanCount / N).toFixed(1),
    hMin: +hmin.toFixed(4), hMax: +hmax.toFixed(4), hMedian: +hmed.toFixed(4), nanCount: nan,
    orphanPct: +(100 * routed.orphan / routed.landCount).toFixed(3),
    uphillPct: +(100 * routed.uphill / routed.landCount).toFixed(3),
    selfLoopLand: routed.selfLoopLand,
    maxStrahler: routed.maxOrder, bifurcationRatio: routed.bifurcationRatio, bifurcationRatioTrimmed: routed.bifurcationRatioTrimmed,
    riverTurnMedianDeg: routed.riverScale.medianTurnDeg, riverNearCollinearPct: routed.riverScale.nearCollinearPct,
    riverScale6TurnDeg: routed.riverScale6.medianTurnDeg,
    channelCount: routed.channelCount, renderedCount: ribGeo ? ribGeo.userData.renderedCount : 0,
    widthViolations: ribGeo ? (ribGeo.userData.widthViolations ?? null) : null,
    orderHist: routed.orderHist, streamCount: routed.streamCount,
  };
}

// ═══════════════════════ HIGH-LEVEL OVERLAY (the AC4 consumer API) ═══════════════════════
// Lazily builds the (terrain-independent) mesh on first route() — so a host that never enables
// rivers pays nothing. route() re-reads height + re-routes + re-ribbons WITHOUT rebuilding the
// mesh (AC7). Binds the host's LIVE uniforms, so rivers track the current preset/dials.
//   ribbon  — the THREE.Mesh overlay to add to the host scene (parent it to the spinning planet
//             so it co-rotates). Its geometry is in object space on a unit sphere × LIFT.
//   route({seaMode,targetFraction}) — 'histogram' (default; solves sea to targetFraction and
//             returns it so the host can drive its water to match) or 'live' (uses the host's
//             current uniforms.uSeaLevel as the outlet condition, no sea override).
export function createRiverOverlay({ renderer, uniforms, params = DEFAULT_PARAMS, octavesDuringRead = 9,
                                     makeGrainCube = createGrainCube }) {
  let mesh = null, sampler = null, carve = null, N = 0;
  let height = null, grad = null, isOcean = null, oceanCount = 0, seaLevel = 0, stats = null, meshMs = 0;
  let routedGraph = null;   // AC2: retain the router graph (receiver/accum/strahler/isChannel) instead of discarding it
  let plateDiag = null;     // plate-uplift increment: the plate partition diagnostics on the Earth-like path (null on despun); read by the live plateProbe (AC7)
  let shellDiag = null;     // shell-relief increment: the despun/ice-shell diagnostics on the shell path (null off it); read by the live shellProbe
  let lastHeightSource = 'sampler';  // AC7: 'carrier' when the router read the baked plate-written carrier.height, else 'sampler'
  // WS4 T8: the grain cube (whole-sphere strike field) + a bake counter. grainBakeCount increments
  // once per route() (the bake-once cadence — camera/time changes never call route(), so they never
  // re-bake; preset/seed/sea changes go through route() and DO). makeGrainCube is injectable so a
  // headless test can swap a renderer-less stub for the GPU CubeCamera baker.
  let grainCube = null, grainBakeCount = 0;
  // Baked-relief Phase B: the HEIGHT cube (whole-sphere E6 relief field) + its own bake counter.
  // Same lazy-once lifecycle + once-per-route cadence as the grain cube (bake-once AC). The DATA
  // source is the sphere-native carrier.height (writeHeightSphere), NOT the in-shader sampler read.
  let heightCube = null, heightBakeCount = 0;
  const ribbon = new THREE.Mesh(
    new THREE.BufferGeometry(),
    new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, transparent: true, depthWrite: false }),
  );
  ribbon.frustumCulled = false;   // ribbon AABB is unreliable for a thin shell; never cull
  ribbon.renderOrder = 10;

  function ensureMesh() {
    if (mesh) return;
    const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : 0;
    mesh = buildIrregularSphere(params.TARGET_N, params.LLOYD_ITERS);
    N = mesh.verts.length;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { pos[i * 3] = mesh.verts[i][0]; pos[i * 3 + 1] = mesh.verts[i][1]; pos[i * 3 + 2] = mesh.verts[i][2]; }
    mesh.pos = pos; mesh.N = N;
    sampler = createHeightSampler({ renderer, uniforms, verts: mesh.verts, octavesDuringRead });
    carve = createCarveCubeMap({ renderer, size: params.CARVE_CUBE_SIZE });
    // WS4 T8: the grain cube rides the same lazy-once lifecycle as the carve cube (built on first
    // route(), reused thereafter). makeGrainCube defaults to the real createGrainCube (CubeCamera RTT);
    // a test injects a stub so this is renderer-free in CI.
    grainCube = makeGrainCube({ renderer, size: params.GRAIN_CUBE_SIZE });
    // Baked-relief Phase B: the HEIGHT cube rides the same lazy-once lifecycle (built on first route(),
    // reused thereafter). createHeightCube is the real CubeCamera RTT baker; RELIEF_CUBE_SIZE = 256.
    heightCube = createHeightCube({ renderer, size: RELIEF_CUBE_SIZE });
    meshMs = ((typeof performance !== 'undefined' && performance.now) ? performance.now() : 0) - t0;
  }

  function route({ seaMode = 'histogram', targetFraction = params.TARGET_OCEAN_FRACTION, radiusEarth = null, widthSeed = null,
                   grainDrivers = DEFAULT_GRAIN_DRIVERS, bodyDrivers = null, macroSeed = 0, archetype = null, locked = false, label = 'route' } = {}) {
    const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : 0;
    ensureMesh();
    // ── Baked-relief Phase B/D: build the sphere-native E6 height field as DATA. The SAME carrier is
    // the single source for BOTH (a) the HEIGHT cube the renderer displaces from (Phase B/C, baked
    // below) and (b) the router's height array (Phase D re-point, just below). The §0 invariant: ONE
    // field (carrier.height) → ONE cube (heightCube) → both consumers read it, gated by ONE strength
    // uniform (uReliefBakeStrength).
    //
    // RISK #2 sourcing (resolved): route() carries grainDrivers (the E6 driver bundle) + macroSeed
    // (the body's deterministic integer seed) — both flow in here. writeHeightSphere needs (crust,
    // drivers, epoch, seed). It does NOT dereference `crust` (it derives its own seam-free thickness
    // blob from the seed family seed+':crust'); we pass an inert {} placeholder for signature parity.
    // drivers = grainDrivers (the SAME bundle the grain bake uses). heightSeed = a deterministic string
    // built from the integer macroSeed (the SAME entropy the grain bake consumes; NO Math.random).
    const heightSeed = 'e6:' + (macroSeed | 0);
    const carrier = makeSphereField(mesh);
    // ── AC5 regime gate: Earth-like terrestrial/ocean bodies get the one-pass plate/uplift field
    // (carrier.height = U, the SOLE low/mid source — REPLACES the latitude-band E6 writer); every
    // other regime keeps the despun writeGrainSphere+writeHeightSphere byte-identical. The plate
    // diagnostics (partition / boundary class / U) are retained for the live plateProbe (AC7).
    const relief = writeBodyRelief(carrier, { archetype, locked, grainDrivers, bodyDrivers, macroSeed, heightSeed });
    plateDiag = relief.plateDiag;                       // null off the plate path
    shellDiag = relief.shellDiag;                       // null off the shell path
    const reliefGrad = computeAdjGradient(carrier);     // shading-only tangent gradient (Phase B.3)
    // ── Phase D re-point (SPLIT-TRAP #5 guard): the router's height source is gated on the SAME
    // uReliefBakeStrength uniform the renderer (Phase C) gates on. strength>0 ⇒ BOTH read carrier.height
    // (the IDENTICAL array baked into heightCube below — single source, no surface-vs-rivers split).
    // strength 0 ⇒ BOTH fall back to the legacy in-shader RTT (sampler.read() / fbmd), byte-identical.
    // carrier is built on the SAME mesh the router routes (buildIrregularSphere in ensureMesh()), so
    // carrier.height[i] is indexed by the same node index — a direct re-point (Option B, LOCKED).
    const bakedOn = !!(uniforms.uReliefBakeStrength && uniforms.uReliefBakeStrength.value > 0.0);
    lastHeightSource = bakedOn ? 'carrier' : 'sampler';  // AC7: the objective single-source signal the plateProbe reads
    if (bakedOn) {
      height = carrier.height; grad = reliefGrad;       // SAME source as the cube (Option B)
    } else {
      const r = sampler.read(); height = r.height; grad = r.grad;   // legacy in-shader RTT (strength-0 fallback)
    }
    seaLevel = (seaMode === 'histogram') ? solveSeaLevel(height, targetFraction) : uniforms.uSeaLevel.value;
    const oc = computeOcean(height, seaLevel, N); isOcean = oc.isOcean; oceanCount = oc.oceanCount;
    // AC6 + UAT item1: routing/topology is radius- & seed-invariant; only the width law (ribbon +
    // valley footprint) scales — by planet radius (AC6) AND the per-planet seeded draw (UAT item1).
    const widthSeedMul = widthSeedFactor(widthSeed, params);
    const pEff = paramsForRadius(params, radiusEarth, widthSeedMul);
    const routed = routeAndOrder({ mesh, height, grad, isOcean, params });
    routedGraph = routed;   // AC2: capture the graph so consumers (mouth/order baking) can read it
    const ribGeo = buildRibbonGeometry({ mesh, routed, params: pEff });
    ribbon.geometry.dispose(); ribbon.geometry = ribGeo;
    // carve: rasterize the valley footprint into the depth (R) + mouth (G) + order (B) cube map
    const valleyGeo = buildValleyGeometry({ mesh, routed, isOcean, params: pEff });
    carve.update(valleyGeo);
    // WS4 T8: bake the grain cube ONCE per route — same cadence as the carve cube (bake-once AC).
    // route() is only called on (preset, seed, sea-level) change (via riverRerouteDebounced /
    // ensureNetworkRouted); camera/time changes never call route(), so they never re-bake. macroSeed
    // co-orients the grain with the gProvince partition (D9); grainDrivers default to the neutral E6
    // bundle until WS1's driver vector wires through.
    bakeGrainCube({ mesh, drivers: grainDrivers, macroSeed, grainCube });
    grainBakeCount++;
    // ── Baked-relief Phase B: bake the sphere-native E6 height field (the SAME `carrier` built above,
    // the SAME array the router re-points to under bakedOn) to the HEIGHT cube — same once-per-route
    // cadence as grain. source = sphere-native E6 DATA, NOT sampler.read() (the §B.5 SPLIT-TRAP #3
    // guard). This is the cube the renderer (Phase C) displaces from; the router reads the identical
    // carrier.height (Phase D) — single source, gated by the same uReliefBakeStrength uniform.
    bakeHeightCube({ mesh, height: carrier.height, grad: reliefGrad, heightCube });
    heightBakeCount++;
    const totalMs = ((typeof performance !== 'undefined' && performance.now) ? performance.now() : 0) - t0;
    stats = buildStats({ routed, height, N, faces: mesh.faces.length, seaLevel, oceanCount, ribGeo, label, totalMs });
    stats.meshMs = +meshMs.toFixed(0);
    stats.widthRadiusFactor = pEff._widthRadiusFactor != null ? +pEff._widthRadiusFactor.toFixed(3) : 1;
    stats.widthSeedFactor = pEff._widthSeedMul != null ? +pEff._widthSeedMul.toFixed(3) : 1;
    return { stats, seaLevel };
  }

  return {
    ribbon, route, ensureMesh, params,
    get mesh() { return mesh; }, get N() { return N; },
    get stats() { return stats; }, get seaLevel() { return seaLevel; },
    get height() { return height; }, get grad() { return grad; }, get isOcean() { return isOcean; },
    get sampler() { return sampler; },
    get routed() { return routedGraph; },
    // plate-uplift increment: the plate partition diagnostics (Earth-like path) + the router's height
    // source — both read by the live plateProbe (AC7). plateDiag is null on the despun path.
    get plateDiag() { return plateDiag; },
    get shellDiag() { return shellDiag; },
    get heightSource() { return lastHeightSource; },
    get carveTexture() { return carve ? carve.texture : null; },
    // WS4 T8: the baked grain cube texture (the host pushes it to uTectonicGrainCube) + the bake
    // counter (the bake-once live AC reads it: unchanged on camera/time, +1 per preset/seed/sea change).
    get grainTexture() { return grainCube ? grainCube.texture : null; },
    get grainBakeCount() { return grainBakeCount; },
    // Baked-relief Phase B: the baked HEIGHT cube texture (the host pushes it to uReliefBakeCube) + its
    // bake counter (bake-once: unchanged on camera/time, +1 per preset/seed/sea change via route()).
    get reliefTexture() { return heightCube ? heightCube.texture : null; },
    get reliefBakeCount() { return heightBakeCount; },
    dispose() { if (sampler) sampler.dispose(); if (carve) carve.dispose(); if (grainCube && grainCube.dispose) grainCube.dispose(); if (heightCube && heightCube.dispose) heightCube.dispose(); ribbon.geometry.dispose(); ribbon.material.dispose(); },
  };
}
