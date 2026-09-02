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
