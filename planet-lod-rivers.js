// planet-lod-rivers.js — SHARED river router + ribbon-overlay pipeline (AC4).
// Extracted from rivers-terrain-lab.main.js (the C3 Max-eye-approved router lab) so there is
// ONE source of the routing/ribbon pipeline, consumed by BOTH the router lab and the planet
// LOD lab (world-engine-lab.html). Same rationale as AC1's shared height GLSL: the coupling
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
import { HEIGHT_GLSL } from './src/worldengine/shaders/height.glsl.js';
import { solveSeaLevel } from './src/worldengine/rivers/seaLevel.js';
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
// ⭐ RE-POINTED 2026-09-02: this trio moved BYTE-VERBATIM to src/rendering/bake/heightCube.js (same
// workstream/commit as the carve cube below). planet-lod-tectonic.js still re-exports it, so this line
// could have stayed — it reads the new home directly because that is where the definitions now live.
import { createHeightCube, buildHeightCubeGeometry, bakeHeightCube, RELIEF_CUBE_SIZE } from './src/rendering/bake/heightCube.js';
import { createProvinceCube, bakeProvinceCube, PROVINCE_CUBE_SIZE } from './planet-lod-tectonic.js';   // V2-4 province -> GPU: carries carrier.province (craton/orogen/basin) to the renderer as one-hot weights
import { writeHeightSphere, writeGrainSphere } from './src/worldengine/base/tectonic.js';
import { writePlateUpliftSphere, driversToTune } from './src/worldengine/base/plates.js';
import { writeShellReliefSphere, shellRegimeOf, shellDriversToTune } from './src/worldengine/base/shellRelief.js';
import { writeMagmatismSphere, magmaDriversToTune } from './src/worldengine/base/magmatism.js';
import { writeStagnantLidReliefSphere, stagnantLidRegimeOf, stagnantDriversToTune } from './src/worldengine/base/stagnantLid.js';
// V2-3 (the dispatch flip): writeBodyRelief's condition-bearing branch derives its route from computeE1's
// {compositionClass, geodynamicRegime, m_hp, shellSubRegime} + the exported seed-free modalRegime/inSeededBand
// (the in-band modal collapse) — planet-lod-rivers.js is now a LEGITIMATE E1 consumer (like lidResponse.js);
// the base/ writers stay E1-blind (worldengine-e1-shadow-audit.test.js).
import { computeE1, modalRegime, inSeededBand } from './src/worldengine/base/e1Regime.js';
import { makeSphereField } from './src/worldengine/base/sphereField.js';
import { writeAccommodation, initSedimentHost } from './src/worldengine/base/hostChannels.js';
import { writePassiveMargins } from './src/worldengine/base/passiveMargins.js';   // V2-4 slice-3: passive-margin shelfDepth channel (plate path only)
import { writeProvince } from './src/worldengine/base/province.js';   // V2-4 slice-4: history-tied province channel (universal — every dispatch path; reads accommodation)
import { deriveFigureDescriptor } from './src/worldengine/base/bodyFigure.js';   // V2-4 slice-5: E2-figure descriptor (pure fn of the condition vector; rides on relief.figure — no carrier array, no RNG)
import { writeBombardment, craterSchedule } from './src/worldengine/base/bombardment.js';   // V2-5: exogenic crater-population host channel (universal call, self-gates on condition scalars; writes only the unhashed craterField). V2-6 S3: craterSchedule feeds deriveSurfaceMaterial (sub-floor regolith).
import { deriveSurfaceMaterial } from './src/worldengine/base/surfaceMaterial.js';   // V2-6 S3/S4: condition-derived material channel (iceness + crystallizationPotential + regolithRoughness) — pure, imports nothing
import { deriveReliefBudget } from './src/worldengine/base/reliefBudget.js';   // Inc-3b S1: condition-pure relief-variance budget (model f_I ratio target); RMS-preserving w_e/w_i scale solved in compositeMargins. Return-object idiom (no carrier array, no RNG ⇒ byte-inert), same as relief.surfaceMaterial. Import line is OUTSIDE the dispatch-oracle's sliced region (precedes writeBodyRelief).
// V2-2b-2a Slice C — the LAB-ONLY mixed-interior render seam (MF1 Option B). route() forwards a hand-set E1
// coordinate through the V2-2a lid-response router (classifyLidPath → the mixed composer WRITES carrier.height),
// and injects the Π=C·F instrument (one-way: rivers.js is the route/lab boundary, NOT a base/ writer, so the
// injection never closes the router↔composer↔statistic cycle). Both imports are inert until a caller passes a
// non-null labLidOverride; every PRODUCTION caller passes none → route() stays byte-inert (AC-ZERO-CLOBBER).
// V2-3: writeBodyRelief's derived dispatch now ALSO calls the router — its unbroken-lid family (heat-pipe +
// hot-high-L stagnant, gated by isUnbrokenLidPath) delegates to writeLidResponseSphere's byte-preserved corners.
import { writeLidResponseSphere, isUnbrokenLidPath } from './src/worldengine/base/lidResponse.js';
import { interpenetration } from './src/worldengine/base/interpenetration.js';
import { writeBodyRelief, DEFAULT_GRAIN_DRIVERS } from './src/worldengine/dispatch/bodyRelief.js';   // MOVED 2026-08-28: the production relief dispatch is three-free and the game needs it — imported BACK here so the lab and ~40 suites keep this import path (the featureScale.js precedent).
import { buildIrregularSphere } from './src/worldengine/mesh/sphereMesh.js';   // MOVED 2026-09-01: the carrier mesh builder, byte-verbatim; the game needs it for the province cube bake — imported BACK here and re-exported at its old location so every existing caller keeps this path.

// ⭐ RE-EXPORTED, NOT RE-DECLARED. Every existing caller imports these two from this module; the
// definitions now live in src/worldengine/dispatch/bodyRelief.js and this line is the only thing keeping
// those call sites unchanged. Deleting it is a breaking change to ~40 test files and the lab.
export { writeBodyRelief, DEFAULT_GRAIN_DRIVERS };

// ⭐ MOVED 2026-09-02 → src/worldengine/rivers/ (router.js, ribbon.js, seaLevel.js), byte-verbatim, for
// docs/WORKSTREAMS/wire-river-router-lab-into-game/. Imported back and RE-EXPORTED so every existing
// caller keeps this import path (the sphereMesh.js / bodyRelief.js precedent). route() below is unchanged.
import {
  DEFAULT_PARAMS, computeAdjGradient, IDENTITY_BUDGET, compositeMargins,
  widthRadiusFactor, widthSeedFactor, paramsForRadius, computeOcean, routeAndOrder,
} from './src/worldengine/rivers/router.js';
import { buildRibbonGeometry, buildValleyGeometry } from './src/worldengine/rivers/ribbon.js';
export {
  DEFAULT_PARAMS, computeAdjGradient, IDENTITY_BUDGET, compositeMargins,
  widthRadiusFactor, widthSeedFactor, paramsForRadius, computeOcean, routeAndOrder,
  buildRibbonGeometry, buildValleyGeometry,
};

// WS4 T8 default E6 stress drivers for the grain bake. The lab does not yet surface despin/radial-strain
// (D11/D12) as GUI drivers, so the host supplies this NEUTRAL bundle (matching the grain-oracle test):
// despinAmp 1, contraction sign +1, zero radial strain. When WS1's driver vector wires through, the
// host passes the real bundle; until then neutral gives the deterministic latitude-banded strike the
// smooth director + macroSeed band-placement organize into 2D in-shader (T13).
// DEFAULT_GRAIN_DRIVERS moved with writeBodyRelief (its only local binding) — see the re-export above.

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
    craterEjectaCombiner(vPos, h, grad);
    // ⭐ F2+F3 ARE ONE CALL SINCE 2026-08-26 — craterCombiner and ejectaCombiner ran voronoi3d TWICE over the same domain, same cells, same per-cell hash, same host gate, same hashed radius. The merge is EXACT: every input to the second call was bit-identical to the first, so this halves the dominant term of the crater pass (27 hash33 evaluations at uVoroCells 27) and moves no pixel. The body is now the SHARED craterRelief.glsl.js one the game splices, which is the convergence Max asked for.
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
// MOVED 2026-09-01 to src/worldengine/mesh/sphereMesh.js, BYTE-VERBATIM (fibonacciSphere,
// sphericalDelaunay, buildAdjacency, buildIrregularSphere), so the GAME can build the carrier the
// province cube is baked from — nothing under src/ may import this root module. Imported back and
// RE-EXPORTED below so the lab and ~60 test suites keep `import { buildIrregularSphere } from
// './planet-lod-rivers.js'` (the bodyRelief.js precedent, df6818c). three-coupled but GPU-free ⇒
// src/worldengine/, not src/rendering/bake/ (carried C25: "needs a renderer" vs "does not").
export { buildIrregularSphere };

// ═══════════════════ REAL HEIGHT via RTT readback (THE coupling) ═══════════════════
// Pack the N mesh vertex unit-directions as a point cloud whose clip-space xy hits one texel
// each; render the router main() to a FloatType target (RGBA = h, grad.xyz); read back per
// vertex. The height material binds the SAME `uniforms` object the planet shader consumes, so
// rivers track the live preset/dials. read() pins uOctaves (a fixed high LOD → deterministic,
// detailed routing) and disables uFwClamp (no screen-space octave fade in the 1-px RTT),
// saving/restoring both so the planet render is unaffected.
//
// ── AC-SAMPLER (world-engine-tectonic-realism-2026-07-29): the OPTIONAL `tapProgram` ────────────
// OMITTED — the default and the only shape route() and the tributary patch ever use — this renders
// HEIGHT_VERT + HEIGHT_FRAG (= HEIGHT_GLSL + ROUTER_MAIN) exactly as it always has. Those callers
// are byte-inert: nothing below their path changed, including which uniforms get written.
//
// SUPPLIED — `{ material, vertexShader, renderedMaterial }` — this renders the CALLER'S OWN program:
// the fragment source is `material.fragmentShader` (the same JS string the planet's material holds,
// not a copy or a concat) and the vertex source is the caller's derived point-cloud shader.
// read(tapPoint) then drives that program's uniform-gated tap.
//
// AND `renderedMaterial` IS NOT OPTIONAL, because without it every guard below is a TAUTOLOGY. The
// first shipped form compared `material.fragmentShader` against a string captured from THAT SAME
// material — both sides one object, true by construction, blind to a caller who simply handed in a
// different material. `renderedMaterial` is a resolver that returns the material THE SCENE ACTUALLY
// RENDERS WITH, evaluated at read time, so the reference comes from a different source than the
// thing it guards. The ONE case where no such resolver can exist — the L4 gradBase mutant, a program
// deliberately not the rendered one — must say so by name via `notTheRenderedProgram`, so silence
// can never be mistaken for compliance.
//
// THERE IS DELIBERATELY NO DEFAULT ON THE TAP PATH. The round-3 review's blocker 2: if the tap
// program were an OPTIONAL parameter defaulting to HEIGHT_FRAG, then dropping it at the call site —
// a renamed options bag, an extracted helper, a lost merge line — would silently revert the
// instrument to measuring bare fbmd with no cube fetch, which IS the defect AC-SAMPLER exists to
// close, while adding no token anywhere for a grep fence to catch. So:
//   · read(tapPoint !== 0) THROWS when the sampler was built without a tapProgram;
//   · a partial tapProgram (either half missing) THROWS at construction;
//   · a tapProgram whose material binds a DIFFERENT uniforms object THROWS at construction;
//   · and read() RE-ASSERTS `material.fragmentShader === <the string we compiled>` on EVERY call
//     (round-3 blocker 3 — the identity check used to live only in the control leg, so the actual
//     measurement path ran unguarded and could report numbers off a drifted program).
// An omission is therefore a loud throw at the first measurement, never a quiet wrong number.
export function createHeightSampler({ renderer, uniforms, verts, octavesDuringRead = 9,
                                      tapProgram = null, extraAttributes = null }) {
  if (tapProgram) {
    const { material: tapMaterial, vertexShader: tapVertexShader } = tapProgram;
    if (!tapMaterial || typeof tapMaterial.fragmentShader !== 'string' || !tapMaterial.fragmentShader.length) {
      throw new Error('createHeightSampler: tapProgram.material must be the caller\'s own ShaderMaterial (its fragmentShader string IS the program). No default is provided on purpose.');
    }
    if (typeof tapVertexShader !== 'string' || !tapVertexShader.length) {
      throw new Error('createHeightSampler: tapProgram.vertexShader is required (the derived point-cloud vertex source). No default is provided on purpose.');
    }
    if (tapMaterial.uniforms !== uniforms) {
      throw new Error('createHeightSampler: tapProgram.material.uniforms must BE the uniforms object passed in (reference identity). Two uniform objects means two fields.');
    }
    // Order matters: a SUPPLIED-BUT-WRONG-SHAPE resolver is a different mistake from an absent one,
    // and the caller needs to be told which. A pre-resolved value is checked first precisely because
    // it looks like compliance.
    if (tapProgram.renderedMaterial != null && typeof tapProgram.renderedMaterial !== 'function') {
      throw new Error('createHeightSampler: tapProgram.renderedMaterial must be a FUNCTION (resolved at read time). A pre-resolved value is a snapshot the caller chose, which is the tautology this parameter exists to break.');
    }
    if (typeof tapProgram.renderedMaterial !== 'function' && typeof tapProgram.notTheRenderedProgram !== 'string') {
      throw new Error('createHeightSampler: tapProgram.renderedMaterial is REQUIRED — a function resolving the material THE SCENE ACTUALLY RENDERS WITH, at read time. Without it every identity check here compares the tap material against a value taken FROM that same material, which is true by construction and cannot detect a substituted program. If this program is deliberately NOT the rendered one (the L4 gradBase mutant is the only such case in this repo), declare it by name with `notTheRenderedProgram: "<why>"`.');
    }
  }
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
  // AC-SAMPLER: zero-filled stand-ins for attributes the caller's own vertex shader declares but a
  // point cloud has no natural value for (the lab's aBand/aShear/aMush/aStorm gas-deck fields). They
  // reach Stage-6 albedo only, never h or grad, so the solid field is unaffected — but the geometry
  // must satisfy the attribute set or the program will not link.
  if (extraAttributes) {
    for (const name of Object.keys(extraAttributes)) {
      const itemSize = extraAttributes[name] | 0;
      geo.setAttribute(name, new THREE.BufferAttribute(new Float32Array(N * itemSize), itemSize));
    }
  }
  // The program. With no tapProgram this is the router program, byte for byte as before. With one,
  // the fragment source is the caller's material's OWN string reference — no copy, no concat, so
  // `mat.fragmentShader === tapProgram.material.fragmentShader` is checkable with ===.
  const fragmentShader = tapProgram ? tapProgram.material.fragmentShader : HEIGHT_FRAG;
  const vertexShader = tapProgram ? tapProgram.vertexShader : HEIGHT_VERT;
  // The vertex source the derivation was run against, snapshotted so read() can tell a recompiled /
  // hot-reloaded planet material from the one this tap shader was derived from.
  const srcVertexShader = tapProgram ? tapProgram.material.vertexShader : null;
  const mat = new THREE.ShaderMaterial({
    vertexShader, fragmentShader, uniforms,
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
  // The scene-graph reference, resolved fresh on every read. Null ONLY for a program that declared
  // itself deliberately not-the-rendered-one at construction.
  const renderedMaterialRef = typeof tapProgram?.renderedMaterial === 'function' ? tapProgram.renderedMaterial : null;
  // AC-SAMPLER — THE GUARD THAT RUNS ON EVERY MEASUREMENT (round-3 blocker 3). The identity claim
  // ("the instrument compiles the planet's own program") is only worth anything if it is checked
  // where the number is produced, not in a console leg someone has to remember to run. Called at the
  // top of every read() on a tapped sampler, before any GL work.
  //
  // THE FIRST CLAUSE IS THE ONE THAT MATTERS, and it is first because the others cannot substitute
  // for it: `renderedMaterialRef()` asks the SCENE what it is drawing with; `tapProgram.material` is
  // what this sampler compiled. Different sources, so the comparison can actually fail. The clauses
  // below it compare the compiled sources against the material they came from — which detects
  // IN-PLACE mutation of that one object and nothing else. Read together they cover substitution
  // (clause 1) and drift (clauses 2-4); either alone is half a guard.
  function assertProgramIdentity() {
    if (renderedMaterialRef) {
      const live = renderedMaterialRef();
      if (live !== tapProgram.material) {
        throw new Error('createHeightSampler.read: RENDERED-PROGRAM SUBSTITUTION — the scene is rendering with a DIFFERENT material object than the one this sampler compiled its tap from. Refusing to measure a program nothing draws with. (This is the check that string comparison against the sampler\'s own cached source cannot make: both sides of that comparison come from one object.)');
      }
    }
    if (tapProgram.material.fragmentShader !== fragmentShader) {
      throw new Error('createHeightSampler.read: PROGRAM IDENTITY DRIFT — the material\'s fragmentShader is no longer the string this sampler compiled. Refusing to measure a field the planet is not rendering. Rebuild the sampler.');
    }
    if (tapProgram.material.vertexShader !== srcVertexShader) {
      throw new Error('createHeightSampler.read: PROGRAM IDENTITY DRIFT — the material\'s vertexShader changed since the tap vertex source was derived from it. Refusing to measure. Rebuild the sampler.');
    }
    if (tapProgram.material.uniforms !== uniforms) {
      throw new Error('createHeightSampler.read: UNIFORM IDENTITY DRIFT — the material no longer binds the uniforms object this sampler reads. Refusing to measure.');
    }
  }
  // returns { height:Float32Array(N), grad:Float32Array(N*3) }
  // tapPoint: 0 (default, every pre-existing caller) renders the program as-is. Nonzero drives the
  // caller's own uFieldTap-gated tap and REQUIRES a tapProgram — there is no router fallback.
  function read(tapPoint = 0) {
    if (tapPoint !== 0 && !tapProgram) {
      throw new Error(`createHeightSampler.read: tapPoint ${tapPoint} was requested but this sampler was built with NO tapProgram, so it renders the router program (bare fbmd, no baked-cube blend, no crater restore). That is the AC-SAMPLER defect. Refusing to fall back.`);
    }
    if (tapProgram) assertProgramIdentity();
    const prevOct = uniforms.uOctaves.value, prevFw = uniforms.uFwClamp.value;
    // The tap uniform is only touched on the tapped path, so the router/tributary read() writes the
    // exact same uniform set it always did. `finally` matters here in a way it did not before: this
    // uniform lives on the material the PLANET renders with, and leaving it nonzero would paint raw
    // float field data onto the planet.
    const tapU = tapProgram ? uniforms.uFieldTap : null;
    if (tapProgram && !tapU) throw new Error('createHeightSampler.read: the tapProgram\'s uniforms carry no uFieldTap — the tap is not present in this program.');
    const prevTap = tapU ? tapU.value : 0;
    const prevTarget = renderer.getRenderTarget();
    renderer.getClearColor(_prevClear); const prevAlpha = renderer.getClearAlpha();
    const buf = new Float32Array(W * Hh * 4);
    try {
      uniforms.uOctaves.value = octavesDuringRead;
      uniforms.uFwClamp.value = 0;
      if (tapU) tapU.value = tapPoint;
      renderer.setRenderTarget(target);
      renderer.setClearColor(0x000000, 0); renderer.clear();
      renderer.render(rttScene, rttCam);
      renderer.readRenderTargetPixels(target, 0, 0, W, Hh, buf);
    } finally {
      renderer.setRenderTarget(prevTarget);
      renderer.setClearColor(_prevClear, prevAlpha);
      uniforms.uOctaves.value = prevOct; uniforms.uFwClamp.value = prevFw;
      if (tapU) tapU.value = prevTap;
    }
    const height = new Float32Array(N), grad = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      height[i] = buf[i * 4];
      grad[i * 3] = buf[i * 4 + 1]; grad[i * 3 + 1] = buf[i * 4 + 2]; grad[i * 3 + 2] = buf[i * 4 + 3];
    }
    return { height, grad };
  }
  function dispose() { geo.dispose(); mat.dispose(); target.dispose(); }
  // `fragmentShader` is exposed so a caller can re-check identity itself (defence in depth — the
  // instrument does exactly that around its own measurement wrapper).
  return { read, dispose, W, Hh, get fragmentShader() { return fragmentShader; }, get isTapped() { return !!tapProgram; } };
}

// ⭐ writeBodyRelief MOVED 2026-08-28 → src/worldengine/dispatch/bodyRelief.js (imported + re-exported
// at the top of this file). It called 22 functions, all already under src/worldengine/base/, and
// exactly one binding local to THIS file (DEFAULT_GRAIN_DRIVERS, which went with it). It touched no
// THREE symbol — so the production relief dispatch was never coupled to the river module, only
// parked in it. The game needs it to bake a province cube; nothing under src/ could reach it here.
// ⛔ The 108 KB / 24-export move of THIS file (one-pipeline-two-frontends-PLAN.md:576) is still its
// own unrun step — this was the one function that did not need it.

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

// ⭐ MOVED 2026-09-02 → src/rendering/bake/carveCube.js, BYTE-VERBATIM (createCarveCubeMap), for
// docs/WORKSTREAMS/wire-river-router-lab-into-game/. GPU-coupled (WebGLCubeRenderTarget + CubeCamera
// + a renderer in update()) ⇒ src/rendering/bake/ under carried C25, the provinceCube.js precedent —
// nothing under src/ may import this root module. Imported back and RE-EXPORTED so createRiverOverlay's
// ensureMesh() below and every existing caller keep this import path (the bodyRelief.js precedent).
import { createCarveCubeMap } from './src/rendering/bake/carveCube.js';
export { createCarveCubeMap };

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
  let reliefCarrier = null;   // V2-4: the last carrier writeBodyRelief built (province/host channels + history fields) — read by the lab province overlay + _lab.provinceProbe
  let height = null, grad = null, isOcean = null, oceanCount = 0, seaLevel = 0, stats = null, meshMs = 0;
  let routedGraph = null;   // AC2: retain the router graph (receiver/accum/strahler/isChannel) instead of discarding it
  let plateDiag = null;     // plate-uplift increment: the plate partition diagnostics on the Earth-like path (null on despun); read by the live plateProbe (AC7)
  let shellDiag = null;     // shell-relief increment: the despun/ice-shell diagnostics on the shell path (null off it); read by the live shellProbe
  let magmaDiag = null;     // magmatism increment: the mantle-plume diagnostics on the volcanic path (null off it); read by the live magmaProbe
  let stagnantDiag = null;  // stagnant-lid increment: the Venus plume-field diagnostics (null off it); read by the live stagnantLidProbe
  let mixedDiag = null;     // V2-2b-2a mixed-interior increment: the composer's diag + primitiveId histogram (null off the LAB mixed override); read by the live mixedProbe
  let lastHeightSource = 'sampler';  // AC7: 'carrier' when the router read the baked plate-written carrier.height, else 'sampler'
  // WS4 T8: the grain cube (whole-sphere strike field) + a bake counter. grainBakeCount increments
  // once per route() (the bake-once cadence — camera/time changes never call route(), so they never
  // re-bake; preset/seed/sea changes go through route() and DO). makeGrainCube is injectable so a
  // headless test can swap a renderer-less stub for the GPU CubeCamera baker.
  let grainCube = null, grainBakeCount = 0;
  // Baked-relief Phase B: the HEIGHT cube (whole-sphere E6 relief field) + its own bake counter.
  // Same lazy-once lifecycle + once-per-route cadence as the grain cube (bake-once AC). The DATA
  // source is the sphere-native carrier.height (writeHeightSphere), NOT the in-shader sampler read.
  let heightCube = null, heightBakeCount = 0, heightCubeSize = 0;
  // The PROVINCE cube (whole-sphere craton/orogen/basin partition). Same lazy-once lifecycle and
  // once-per-route cadence as grain + height. writeProvince() already ran on the carrier by this point
  // (it is called universally, before the bakes), so carrier.province is always populated here.
  let provinceCube = null, provinceBakeCount = 0;
  // Slice D-fix (2026-07-28) — the CRATER cube. Same shape/lifecycle/cadence as heightCube, but it
  // carries ONLY the exogenic crater overlay (carrier.craterField at its composite weight) and its
  // gradient. WHY IT EXISTS: uReliefBakeStrength is a single blend weight over a cube that holds the
  // macro body AND the craters, and the Slice-D display crossover fades that weight to hand the BODY
  // to the analytic path — silently taking the craters with it. Every impact-cratered preset lives
  // below 1 R⊕ (Moon/Mercury 0.27–0.38, Mars 0.53), where the crossover eats ~78% of the crater
  // signal at boot, and above 4 R⊕ it eats 100%. Max's UAT, verbatim: "below about 0.04 radius the
  // craters disappear completely". Craters are an ADDITIVE signed overlay (bowl<0, rim/ejecta>0) by
  // design, so they ride correctly on whichever body is showing — the fix is to stop them riding the
  // fade at all, not to change the fade. Zero-cost at radius 1 R⊕: the restore weight is 0 there.
  let craterCube = null, craterCubeSize = 0, craterOverlay = null;
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
    heightCube = createHeightCube({ renderer, size: RELIEF_CUBE_SIZE }); heightCubeSize = RELIEF_CUBE_SIZE;
    provinceCube = createProvinceCube({ renderer, size: PROVINCE_CUBE_SIZE });
    // Slice D-fix: the crater cube rides the identical lazy-once lifecycle and the identical baker
    // (same RGBA pack: R = overlay height, GBA = its tangent gradient).
    craterCube = createHeightCube({ renderer, size: RELIEF_CUBE_SIZE }); craterCubeSize = RELIEF_CUBE_SIZE;
    meshMs = ((typeof performance !== 'undefined' && performance.now) ? performance.now() : 0) - t0;
  }

  function route({ seaMode = 'histogram', targetFraction = params.TARGET_OCEAN_FRACTION, radiusEarth = null, widthSeed = null,
                   grainDrivers = DEFAULT_GRAIN_DRIVERS, bodyDrivers = null, macroSeed = 0, archetype = null, locked = false, T_eq = null,
                   labLidOverride = null, label = 'route' } = {}) {
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
    reliefCarrier = carrier;   // V2-4: retain for the lab province overlay + _lab.provinceProbe (province/host channels written by the writeBodyRelief seam below)
    // ── AC5 regime gate: Earth-like terrestrial/ocean bodies get the one-pass plate/uplift field
    // (carrier.height = U, the SOLE low/mid source — REPLACES the latitude-band E6 writer); every
    // other regime keeps the despun writeGrainSphere+writeHeightSphere byte-identical. The plate
    // diagnostics (partition / boundary class / U) are retained for the live plateProbe (AC7).
    const relief = writeBodyRelief(carrier, { archetype, locked, grainDrivers, bodyDrivers, macroSeed, heightSeed, T_eq });
    plateDiag = relief.plateDiag;                       // null off the plate path
    shellDiag = relief.shellDiag;                       // null off the shell path
    magmaDiag = relief.magmaDiag;                       // null off the volcanic path
    stagnantDiag = relief.stagnantDiag;                 // null off the stagnant-lid path
    // ── V2-2b-2a Slice C (MF1 Option B) — LAB-ONLY mixed-interior override. When the lab passes a hand-set E1
    //    coordinate (labLidOverride = {e1, rawTidal, macroSeed}), route it through the V2-2a lid-response router:
    //    classifyLidPath places the body (the Tharsis vector → 'mixed'), and on the mixed branch the composer
    //    WRITES carrier.height (REPLACE) over its own seeded 'lid:' center field. The Π=C·F instrument is
    //    INJECTED here (never imported by a base/ writer — MF2). The swapped carrier.height rides the SAME
    //    bakedOn re-point + bakeHeightCube path below, so the mixed relief renders for free. Every PRODUCTION
    //    caller passes labLidOverride = null → this branch is skipped → route() stays byte-inert (the 75-golden
    //    harness bypasses route() entirely; AC-ZERO-CLOBBER). The multi-valued primitiveId histogram + the
    //    composer diag are stashed in mixedDiag for the SCALAR mixed probe (per-node arrays never leave route()).
    mixedDiag = null;
    if (labLidOverride && labLidOverride.e1) {
      const lidRes = writeLidResponseSphere(carrier, bodyDrivers, {
        e1: labLidOverride.e1,
        rawTidal: labLidOverride.rawTidal != null ? labLidOverride.rawTidal : 0,
        macroSeed: labLidOverride.macroSeed != null ? labLidOverride.macroSeed : macroSeed,
        grainDrivers, locked, interpen: interpenetration,
      });
      if (lidRes.mixedDiag && lidRes.primitiveId) {
        // Small (≤8-key) primitiveId histogram, built HERE so the probe reads scalars only — the per-node
        // Int32Array never leaves route() (a full array overflows the chrome-devtools token budget).
        const pid = lidRes.primitiveId, hist = {};
        for (let i = 0; i < pid.length; i++) { const k = pid[i]; hist[k] = (hist[k] || 0) + 1; }
        mixedDiag = { ...lidRes.mixedDiag, path: lidRes.path, fineClass: lidRes.fineClass, primitiveIdHistogram: hist };
      } else {
        // The hand-set coordinate did NOT classify 'mixed' (pure-weak / pure-strong / off-pilot). Surface the
        // honest path so the probe reports the real classification, not a stale mixed diag.
        mixedDiag = { path: lidRes.path, fineClass: lidRes.fineClass, unimplemented: !!lidRes.unimplemented };
      }
    }
    const reliefGrad = computeAdjGradient(carrier);     // shading-only tangent gradient (Phase B.3)
    // ── V2-4 slice-3 margin composite (folds lens A-M1): composite carrier.height + shelfDepth into a NEW
    //    array and recompute the gradient OF that composited surface, so the shelf actually reshades/reroutes
    //    (feeding composited height but the stale pre-shelf reliefGrad would displace-without-reshading).
    //    null on non-margin worlds ⇒ reuse carrier.height/reliefGrad ⇒ byte-identical (AC-LAB c). Never
    //    mutates carrier.height (own-channel discipline; the 75-golden bypasses route()).
    // Slice D-fix: hand compositeMargins a buffer for the crater term it adds, so the display
    // crossover can restore exactly that term without re-deriving the w_i weight (one weight, one
    // place). Reused across routes; zeroed first so a preset with no craters bakes a CLEAN cube
    // rather than inheriting the previous preset's stamps.
    if (!craterOverlay || craterOverlay.length !== carrier.height.length) craterOverlay = new Float32Array(carrier.height.length);
    else craterOverlay.fill(0);
    const composited = compositeMargins(carrier, relief.reliefBudget, craterOverlay);   // Inc-3b S1.4: thread the condition-pure budget (identity outside its domain ⇒ byte-identical to pre-Inc-3b)
    const marginHeight = composited || carrier.height;
    const marginGrad = composited ? computeAdjGradient(carrier, composited) : reliefGrad;
    // ── Phase D re-point (SPLIT-TRAP #5 guard): the router's height source is gated on the SAME
    // uReliefBakeStrength uniform the renderer (Phase C) gates on. strength>0 ⇒ BOTH read carrier.height
    // (the IDENTICAL array baked into heightCube below — single source, no surface-vs-rivers split).
    // strength 0 ⇒ BOTH fall back to the legacy in-shader RTT (sampler.read() / fbmd), byte-identical.
    // carrier is built on the SAME mesh the router routes (buildIrregularSphere in ensureMesh()), so
    // carrier.height[i] is indexed by the same node index — a direct re-point (Option B, LOCKED).
    const bakedOn = !!(uniforms.uReliefBakeStrength && uniforms.uReliefBakeStrength.value > 0.0);
    lastHeightSource = bakedOn ? 'carrier' : 'sampler';  // AC7: the objective single-source signal the plateProbe reads
    if (bakedOn) {
      height = marginHeight; grad = marginGrad;         // SAME source as the cube (Option B) — margin-composited (V2-4 s3)
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
    // V2-4 province -> GPU, same once-per-route cadence. carrier.province is the history-derived
    // {craton, orogen, basin} labelling; the cube carries it as interpolated one-hot WEIGHTS so the
    // shader gets soft province margins rather than a mesh-resolution staircase (see the baker's note).
    bakeProvinceCube({ mesh, province: carrier.province, provinceCube });
    provinceBakeCount++;
    // ── Baked-relief Phase B: bake the sphere-native E6 height field (the SAME `carrier` built above,
    // the SAME array the router re-points to under bakedOn) to the HEIGHT cube — same once-per-route
    // cadence as grain. source = sphere-native E6 DATA, NOT sampler.read() (the §B.5 SPLIT-TRAP #3
    // guard). This is the cube the renderer (Phase C) displaces from; the router reads the identical
    // carrier.height (Phase D) — single source, gated by the same uReliefBakeStrength uniform.
    // inc3b S3.b diagnosis instrumentation: lab-only bake-size override for the GPU-in-loop falsifier
    // (set globalThis.__reliefBakeSize, e.g. 512, then re-route). Unset ⇒ RELIEF_CUBE_SIZE. Production
    // and headless paths never set it; heightCube may be null headless (guarded, as for the bake below).
    const _bakeSizeWant = ((typeof globalThis !== 'undefined' && globalThis.__reliefBakeSize) | 0) || RELIEF_CUBE_SIZE;
    if (heightCube && _bakeSizeWant !== heightCubeSize) {
      heightCube.dispose();
      heightCube = createHeightCube({ renderer, size: _bakeSizeWant }); heightCubeSize = _bakeSizeWant;
    }
    bakeHeightCube({ mesh, height: marginHeight, grad: marginGrad, heightCube });   // V2-4 s3: margin-composited (identical to carrier.height/reliefGrad on non-margin worlds)
    heightBakeCount++;
    // ── Slice D-fix: bake the CRATER overlay alone into its own cube, same cadence, same baker.
    // The gradient operator here is linear in the height array, so grad(h+sd+cf) = grad(h+sd)+grad(cf);
    // that is what lets the shader's restore term recompose EXACTLY what the crossover removed, in
    // both displacement and shading. Baked unconditionally (never skipped on no-crater worlds) so the
    // cube can't carry a previous preset's stamps — an all-zero overlay bakes an all-zero cube, which
    // contributes nothing. craterCube may be null headless, guarded inside bakeHeightCube as above.
    const craterGrad = computeAdjGradient(carrier, craterOverlay);
    if (craterCube && _bakeSizeWant !== craterCubeSize) {
      craterCube.dispose();
      craterCube = createHeightCube({ renderer, size: _bakeSizeWant }); craterCubeSize = _bakeSizeWant;
    }
    bakeHeightCube({ mesh, height: craterOverlay, grad: craterGrad, heightCube: craterCube });
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
    // V2-4 slice-4: the last carrier writeBodyRelief built — its `province` (+ faultDensity/grainMag/
    // accommodation) feed the ground-owned lab province overlay + _lab.provinceProbe. Read-only handle.
    get reliefCarrier() { return reliefCarrier; },
    // plate-uplift increment: the plate partition diagnostics (Earth-like path) + the router's height
    // source — both read by the live plateProbe (AC7). plateDiag is null on the despun path.
    get plateDiag() { return plateDiag; },
    get shellDiag() { return shellDiag; },
    get magmaDiag() { return magmaDiag; },
    get stagnantDiag() { return stagnantDiag; },
    // V2-2b-2a mixed-interior increment: the composer diag (beltScale/pierce/Pi/M/legibleByFamily) + the
    // ≤8-key primitiveId histogram, stashed by the labLidOverride branch. null on every production route (the
    // override rides the LAB mixed-drivers folder only) — read by the live mixedProbe (AC-THARSIS).
    get mixedDiag() { return mixedDiag; },
    get heightSource() { return lastHeightSource; },
    get carveTexture() { return carve ? carve.texture : null; },
    // WS4 T8: the baked grain cube texture (the host pushes it to uTectonicGrainCube) + the bake
    // counter (the bake-once live AC reads it: unchanged on camera/time, +1 per preset/seed/sea change).
    get grainTexture() { return grainCube ? grainCube.texture : null; },
    get grainBakeCount() { return grainBakeCount; },
    get provinceTexture() { return provinceCube && provinceCube.texture; },
    get provinceBakeCount() { return provinceBakeCount; },
    // Baked-relief Phase B: the baked HEIGHT cube texture (the host pushes it to uReliefBakeCube) + its
    // bake counter (bake-once: unchanged on camera/time, +1 per preset/seed/sea change via route()).
    get reliefTexture() { return heightCube ? heightCube.texture : null; },
    get reliefBakeCount() { return heightBakeCount; },
    // Slice D-fix: the crater-only overlay cube (host pushes it to uCraterBakeCube). Shares
    // reliefBakeCount — it is baked in the same once-per-route block, never independently.
    get craterTexture() { return craterCube ? craterCube.texture : null; },
    dispose() { if (sampler) sampler.dispose(); if (carve) carve.dispose(); if (grainCube && grainCube.dispose) grainCube.dispose(); if (heightCube && heightCube.dispose) heightCube.dispose(); if (craterCube && craterCube.dispose) craterCube.dispose(); ribbon.geometry.dispose(); ribbon.material.dispose(); },
  };
}
