// src/rendering/bake/provinceDispatch.js
// THE CPU HALF OF THE PROVINCE BAKE — the lab's dispatch, run for one game body over the shared
// carrier mesh. No renderer, no DOM: this module runs identically on the main thread, inside
// provinceWorker.js, and headless under vitest. Authored 2026-09-01 for
// docs/WORKSTREAMS/wire-province-cube-lab-into-game/.
//
//     sharedCarrierMesh()  →  makeSphereField(mesh)  →  writeBodyRelief(carrier, {…})  →  carrier.province
//
// ⭐ THE MESH IS THE LAB'S MESH — 40000 / lloyd 4, planet-lod-rivers.js DEFAULT_PARAMS — AND THAT IS A
// MEASUREMENT, NOT AN INHERITANCE. The appendix (one-pipeline-two-frontends-PLAN.md § THE PROVINCE
// CUBE, MEASURED, ii) showed class FRACTIONS flat from 2500 nodes up while cost spans 60×, and asked
// for the spatial pattern to be verified. Verified 2026-09-01 over the 24 rocky-* seeds (58 solid
// moons + planets, nearest-node label agreement at 4096 fixed directions against 40k/4):
//
//     mesh        shell agree   despun agree   ms/body (shell)
//     2500 / 3       69.4%         84.6%           3.7
//     5000 / 3       71.2%         86.2%           6.5
//     10000 / 3      73.4%         89.0%          12.4
//     40000 / 4     100% (it is the reference)     51
//
// So resolution changes WHICH pixels are craton and which are basin — writeProvince's relaxation is
// in node units, so a coarser mesh relaxes over a wider angle — and any mesh but the lab's would put
// a DIFFERENT partition in the game than in the lab for the same body. That is a lab/game divergence
// declared at birth (feedback_converge-dont-declare-divergence). The game therefore runs the lab's
// mesh and pays the lab's cost — off the main thread, in provinceWorker.js — and AC-1's byte-identity
// is then exact rather than circular: same function, same mesh, same array the lab bakes.
// tests/province-bake-host.test.js pins GAME_MESH to DEFAULT_PARAMS through the lab's own import.
//
// DELIBERATE NON-GOALS: no resolution knob, no cache across bodies (province is a function of
// condition + macroSeed, unique per body), no change to the writers.
import { compositionClass } from '../../worldengine/base/e1Regime.js';
import { makeSphereField } from '../../worldengine/base/sphereField.js';
import { buildIrregularSphere } from '../../worldengine/mesh/sphereMesh.js';
import { writeBodyRelief, DEFAULT_GRAIN_DRIVERS } from '../../worldengine/dispatch/bodyRelief.js';
// ── the river half (added 2026-09-02, docs/WORKSTREAMS/wire-river-router-lab-into-game/) ─────────
import {
  compositeMargins, computeAdjGradient, computeOcean, routeAndOrder,
  paramsForRadius, widthSeedFactor, DEFAULT_PARAMS,
} from '../../worldengine/rivers/router.js';
import { buildRibbonGeometry, buildValleyGeometry } from '../../worldengine/rivers/ribbon.js';
import { solveSeaLevel } from '../../worldengine/rivers/seaLevel.js';
import { fluvialClassOf } from '../../worldengine/drivers/fluvialDeck.js';
import { bakeReliefCrossover, visScaleOf } from '../../worldengine/base/labCore.js';

/** The game's carrier resolution = the lab's (planet-lod-rivers.js DEFAULT_PARAMS). See the header. */
export const GAME_MESH = Object.freeze({ TARGET_N: 40000, LLOYD_ITERS: 4 });

const now = () => (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();

let _mesh = null, _meshBuilds = 0, _meshMs = 0;
/** The one carrier mesh every body in a session shares. Built on first use, never again. */
export function sharedCarrierMesh() {
  if (!_mesh) { const t0 = now(); _mesh = buildIrregularSphere(GAME_MESH.TARGET_N, GAME_MESH.LLOYD_ITERS); _meshMs = now() - t0; _meshBuilds++; }
  return _mesh;
}
export function meshBuildCount() { return _meshBuilds; }
export function meshBuildMs() { return _meshMs; }
/** Tests only — drop the cached mesh so a suite can count builds from zero. */
export function _resetSharedMeshForTests() { _mesh = null; _meshBuilds = 0; _meshMs = 0; }

/**
 * The lab's NEUTRAL body-driver bundle, read off the game body's condition vector.
 *
 * body-drivers.js:22 `buildNeutralBodyDrivers(u, fp)` builds `{ massGravity: u.surfaceGravity,
 * volatileFraction: fp.composition.volatileFraction, tidalHeating: u.tidalHeat (RAW Io-ratio),
 * thermalState: undefined, coreRadiusFraction: fp.composition.coreRadiusFraction | undefined }`.
 * The condition vector already carries each of those as a derived field (conditionVector.js:134
 * surfaceGravity, :154 rawTidalIoRatio; conditionFromBody.js builds composition.volatileFraction),
 * so this is the same bundle from the same numbers by a shorter road — not a second law. Every tune
 * builder falls back to its own anchor on an absent key (plates.js `?? D_EARTH`, shellRelief.js
 * `?? REF`, stagnantLid.js `?? VENUS_REF`), so a body lacking a field degrades to exactly where the
 * lab's neutral path would.
 */
export function bodyDriversFromCondition(condition) {
  const comp = condition?.composition || {};
  return {
    massGravity: condition?.surfaceGravity,
    volatileFraction: comp.volatileFraction,
    tidalHeating: condition?.rawTidalIoRatio,
    thermalState: undefined,
    coreRadiusFraction: comp.coreRadiusFraction,
    condition,
  };
}

/** The predicate: condition-derived, never a `type` label — the same test rockySurface's entry uses. */
export function provinceAppliesTo(condition) { return compositionClass(condition) !== 'gas'; }

/** Class fractions of a province array — {craton, orogen, basin, labelled} in [0,1]. */
export function provinceFractions(province) {
  const n = province.length; let c = 0, o = 0, b = 0;
  for (let i = 0; i < n; i++) { const p = province[i]; if (p === 0) c++; else if (p === 1) o++; else if (p === 2) b++; }
  return { craton: c / n, orogen: o / n, basin: b / n, labelled: (c + o + b) / n };
}

/**
 * Run the lab's dispatch for one body over `mesh`; return the carrier with its province written.
 * `macroSeed` is the game's labMacroSeed(d); `heightSeed` is the lab's own convention
 * (planet-lod-rivers.js `'e6:' + (macroSeed | 0)`); `T_eq` is the condition's surface temperature,
 * the same field the shell and stagnant tunes read nested.
 */
export function buildProvinceForBody({ condition, macroSeed = 0, T_eq = null }, mesh = sharedCarrierMesh()) {
  const carrier = makeSphereField(mesh);
  const t0 = now();
  const relief = writeBodyRelief(carrier, {
    bodyDrivers: bodyDriversFromCondition(condition),
    grainDrivers: DEFAULT_GRAIN_DRIVERS,
    macroSeed: macroSeed | 0,
    heightSeed: 'e6:' + (macroSeed | 0),
    T_eq: T_eq ?? condition?.T_eq ?? null,
  });
  return { mesh, carrier, relief, province: carrier.province, ms: now() - t0 };
}

// ═══════════════════════ THE WHOLE route() BUNDLE, FOR ONE GAME BODY ═══════════════════════
// Added 2026-09-02 for docs/WORKSTREAMS/wire-river-router-lab-into-game/. `buildProvinceForBody`
// above stops at the province; the game needs everything else `createRiverOverlay.route()` derives
// from the same carrier — the margin-composited relief and its gradient, the crater overlay and its
// gradient, the sea level, the ocean mask, the routed drainage graph, the ribbon and the valley
// footprint — because they are ONE dispatch. Running writeBodyRelief four times to fill four cubes
// would cost 4 × 35-160 ms per body for identical arrays (intent.md decision 6).
//
// ⭐ NOT ONE LAW IS DERIVED HERE. Every line below is `route()` (planet-lod-rivers.js:602-736 at
// 885f4fc) in `route()`'s order, calling `route()`'s functions through the modules they now live in.
// The production arm only: seaMode 'histogram' (the lab's rivers-ON behaviour, intent.md decision 3),
// no labLidOverride (LAB-only), and `bakedOn` true — off the main thread there is no in-shader RTT
// sampler to fall back to, and the game routes on the carrier by construction.
//
// ⛔ THE ARGUMENT ASYMMETRY IS THE LAB'S, KEPT VERBATIM: `routeAndOrder` takes the BASE params and
// the two geometry builders take `pEff` (route() :704 vs :706/:709). Routing/topology is radius- and
// seed-invariant (AC6 + UAT item1); only the width law scales. Handing the router pEff would look
// harmless and would be a different game.
//
// ⛔ WHICH BODIES ROUTE is the lab's own F11 gate, read from ONE place — `fluvialClassOf` (driver
// pack #9). wet ∪ relict route; airless bodies do not (intent.md decision 4: every consumer of the
// carve cube is zero on that class by the pack, so the cube would be read ×0). They still get the
// relief and crater arrays, because those are gated by the crossover, not by the fluvial class.
// ⛔ AND THE RIBBON IS NARROWER STILL — `wet` alone, the ADMITTED half. See the gate at its call site.
//
// DELIBERATE NON-GOALS: no cube, no renderer, no texture — this file stays loadable in a Worker and
// headless (labBakeHost.js owns the GPU half). No cache across bodies. No tunable of its own.

/**
 * The lab's `ensureMesh()` (planet-lod-rivers.js:582-585), as an idempotent step.
 *
 * WHY IT EXISTS: `buildIrregularSphere` returns `{verts, faces, adj}`, but `buildRibbonGeometry` and
 * `buildValleyGeometry` read `mesh.pos` (a flat Float32Array of the unit directions) and `mesh.N`,
 * which the lab's overlay adds to its own mesh right after building it. `sharedCarrierMesh()` has
 * neither, so without this the two builders would read `undefined`. Additive and idempotent: every
 * other consumer of the mesh (`makeSphereField`, `buildProvinceCubeGeometry`,
 * `buildHeightCubeGeometry`) reads `verts` / `faces` / `adj` and is untouched.
 */
export function ensureRouterMesh(mesh) {
  if (mesh.pos && mesh.N != null) return mesh;
  const N = mesh.verts.length;
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { pos[i * 3] = mesh.verts[i][0]; pos[i * 3 + 1] = mesh.verts[i][1]; pos[i * 3 + 2] = mesh.verts[i][2]; }
  mesh.pos = pos; mesh.N = N;
  return mesh;
}

/**
 * Run the lab's whole `route()` for one game body over `mesh`.
 *
 * @param {object}  body
 * @param {object}  body.condition    the body's condition vector (the ONLY generative input)
 * @param {number} [body.macroSeed]   labMacroSeed(d) — the same integer the lab's `widthSeed` is
 * @param {number} [body.T_eq]        equilibrium temperature (the shell / stagnant tunes read it)
 * @param {number} [body.radiusEarth] the body's radius in R⊕ — feeds BOTH the display crossover
 *                                    (`bakeReliefCrossover(visScaleOf(R))`) and the width law
 *                                    (`paramsForRadius`). Two different laws, one number.
 * @param {object} [mesh]             the carrier mesh; defaults to the session's shared 40000/4 one.
 * @returns {object} the province bundle (`mesh, carrier, relief, province, ms`) plus the river half.
 */
export function buildLabBundleForBody({ condition, macroSeed = 0, T_eq = null, radiusEarth = 1 }, mesh = sharedCarrierMesh()) {
  ensureRouterMesh(mesh);
  const built = buildProvinceForBody({ condition, macroSeed, T_eq }, mesh);
  const { carrier, relief } = built;
  const t0 = now();

  // ── route()'s margin composite (:679-682). The crater term goes into its OWN buffer so the
  // display crossover can restore exactly what it faded out, without a second w_i solve — one
  // weight, one place (compositeMargins' third argument). Fresh per body, so it is zero-filled
  // by construction; the lab reuses one buffer and calls .fill(0) for the same reason.
  const craterOverlay = new Float32Array(carrier.height.length);
  const composited = compositeMargins(carrier, relief.reliefBudget, craterOverlay);
  const marginHeight = composited || carrier.height;
  // route() computes `reliefGrad = computeAdjGradient(carrier)` first and reuses it on the null arm
  // (:670, :682). computeAdjGradient is pure, so computing it only on that arm is value-identical
  // and skips one full least-squares pass over N nodes on the 67-of-68 routed bodies that do NOT
  // composite (measured 2026-09-02 over the 24-seed corpus).
  const marginGrad = composited ? computeAdjGradient(carrier, composited) : computeAdjGradient(carrier);
  const craterGrad = computeAdjGradient(carrier, craterOverlay);        // route() :735

  // ── the two display weights (intent.md decision 2). The lab's frame write is
  // `uReliefBakeStrength = 1.0 * bakeReliefCrossover(visScaleOf(radiusEarth))` (world-engine-lab.html
  // :4976) and `uCraterBakeRestore = 1 - that` (:4988) — the crater overlay is additive and signed,
  // so restoring it at exactly the complement keeps craters off the body's size fade.
  const strength = bakeReliefCrossover(visScaleOf(radiusEarth));
  const restore = 1 - strength;

  const fluvialClass = fluvialClassOf(condition);
  const routed = fluvialClass !== 'airless';
  const out = {
    ...built, fluvialClass, routed, strength, restore,
    marginHeight, marginGrad, craterOverlay, craterGrad,
    // ⚠ SURFACED, NEVER SILENT (contract AC-3): a body whose crossover is exactly 0 displays the
    // analytic surface while its rivers were routed on the baked one. Measured empty over the
    // 24-seed corpus — wetness needs a retained atmosphere, and the crossover only reaches 0 below
    // 0.25 R⊕ / above 4 R⊕ — but the bundle says so rather than assuming it.
    routedOnUndisplayedField: routed && strength === 0,
  };
  if (routed) {
    const seaLevel = solveSeaLevel(marginHeight, DEFAULT_PARAMS.TARGET_OCEAN_FRACTION);   // route() :697, seaMode 'histogram'
    const { isOcean, oceanCount } = computeOcean(marginHeight, seaLevel, carrier.N);      // :698
    const pEff = paramsForRadius(DEFAULT_PARAMS, radiusEarth, widthSeedFactor(macroSeed, DEFAULT_PARAMS));  // :702-703
    const routedGraph = routeAndOrder({ mesh, height: marginHeight, grad: marginGrad, isOcean, params: DEFAULT_PARAMS });  // :704 — BASE
    out.seaLevel = seaLevel; out.isOcean = isOcean; out.oceanCount = oceanCount; out.routedGraph = routedGraph;
    // ⛔ THE RIBBON IS THE WET HALF ONLY (final review #11, 2026-09-02). route() builds it on every
    // routed body because the LAB routes ONE body at a time behind a global toggle; here the class is
    // per body, and labBakeHost's `bindRiverHalf` returns before the ribbon on anything but `wet`
    // (intent.md decision 4 — a relict body has no water). Building it anyway ran a full
    // buildRibbonGeometry, transferred three more buffers and rebuilt the geometry on the main thread
    // for 64 of the 68 routed bodies, to produce a mesh nothing parents, binds or draws.
    // ⛔ THE SEA SOLVE AND THE ROUTE STAY ON EVERY ROUTED BODY, and that is not symmetry for its own
    // sake: `computeOcean` is the router's outlet condition (:698 feeds :704), and a relict body's
    // F13 outflow and F12 mouths read the carve cube's B and G channels, which `valleyGeo` carries.
    if (fluvialClass === 'wet') out.ribbonGeo = buildRibbonGeometry({ mesh, routed: routedGraph, params: pEff });   // :706 — pEff
    out.valleyGeo = buildValleyGeometry({ mesh, routed: routedGraph, isOcean, params: pEff });        // :709 — pEff
  }
  out.routeMs = now() - t0;
  return out;
}
