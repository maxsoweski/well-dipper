// src/rendering/bake/labBakeHost.js
// THE LAB BAKE HOST — attach-once, bake-once, dispose-once, for one game body mounted on the lab
// material. Four cubes and a ribbon: PROVINCE, RELIEF, CRATER, RIVER-CARVE, and the river ribbon
// mesh parented to the body. Authored 2026-09-01 for docs/WORKSTREAMS/wire-province-cube-lab-into-game/
// (the province cube alone); grown 2026-09-02 for docs/WORKSTREAMS/wire-river-router-lab-into-game/.
//
// FUNCTION. Turn what the lab's `createRiverOverlay.route()` derives for this body into the textures
// and the child mesh the planet shader and the scene read, so the terms that were inert in the game
// stop being inert:
//
//     uProvinceCube        → uCratonColor / uFreshColor / uSedColor       (planetShaders.glsl.js:566)
//     uReliefBakeCube      → the body's macro relief, at uReliefBakeStrength
//     uCraterBakeCube      → the crater overlay, restored at uCraterBakeRestore = 1 − strength
//     uRiverCarveMap       → R valley depth · G mouth strength · B Strahler order
//     the ribbon child     → the blue river network (F11 water)
//     uSeaLevel / uCoastStrength → the sea the rivers drain into (F14), and its coasts (F20)
//
// Four modules, four jobs:
//
//     provinceDispatch.js   CPU — the lab's whole route() bundle for one body    (runs anywhere)
//     provinceWorker.js     transport — that bundle off the main thread          (browser only)
//     heightCube.js / carveCube.js / provinceCube.js   the lab's own GPU bakers  (need a renderer)
//     labBakeHost.js        GPU + lifetime + the A/B — this file                 (needs a renderer)
//
// INTENT (Max, 2026-07-31 / 2026-08-26): REPLACE, not graft; wire the lab's pipeline into the game;
// log gaps, never shoestring. NOT ONE LAW IS DERIVED HERE. The bakers are the lab's, byte-verbatim;
// the dispatch is the lab's (bodyRelief.js + rivers/); the mesh is the lab's (40k / 4). Every number
// this file writes is quoted from the lab with its line: the carve amounts and the ribbon lift from
// `riverOverlayState` (world-engine-lab.html:392) through `applyCarveAmounts` (:3020), the sea
// override from `riverReroute` (:2990-2992), the two display weights from the bundle, which composes
// `bakeReliefCrossover(visScaleOf(radiusEarth))` (:4976) and `1 −` it (:4988).
//
// WHERE THE BAKE RUNS, AND WHY THERE. A bake needs a renderer; the pack tree may not hold one
// (drivers/index.js:40 "NO RENDERER IN THE CLOSURE") and `Planet._createLabSurface` is static with
// none in scope. So the work is keyed to the body's FIRST DRAW: `surface.onBeforeRender` receives
// the live renderer from three itself. Frame 1 posts the body to the worker (or, with no Worker,
// runs the dispatch inline); the frame after the reply lands renders the cube faces and binds the
// textures. Rendering inside onBeforeRender is the pattern three's own Reflector and Refractor use;
// CubeCamera.update saves and restores the render target, tone mapping and XR state, and each
// baker's update() saves and restores the clear colour. A body never drawn never pays.
//
// WHICH BODIES GET WHAT — the lab's own F11 gate, read from ONE place (`fluvialClassOf`, driver pack
// #9; intent.md decision 4). Every solid body gets province + relief + crater. wet ∪ relict are
// ROUTED, so they also get the carve cube. Only WET is ADMITTED to the visible half — the ribbon, the
// histogram sea and the terrain-gouging amounts — because on a relict body the pack leaves the
// fluvial masters at zero and on an airless one there is no route at all.
//
// ⛔ THE SEA HAS TWO WRITERS, AND THE ROUTER WINS ON A WET BODY (intent.md decision 3). Driver pack #9
// writes `uSeaLevel` at mount (the derived level, or −1); the router solves it from the height
// histogram to TARGET_OCEAN_FRACTION at bake. Between the two the body would draw the pack's
// shoreline for as many frames as the dispatch takes and then JUMP. So attach records the pack's
// value and takes `uSeaLevel` to −1: the sea arrives WITH the rivers that drain into it, as one
// fill-in. Dispose gives the pack's value back — its write is state this host found, not authored.
// Relict and airless bodies are never touched: they have no sea by the lab's own gate.
//
// THE A/B KEYS FOR MAX. Bare, no modifier, not while typing, on every baked body at once:
//     V  province colour  ↔ 0                    (the shader's own mix knob)
//     J  rivers           — ribbon hidden + the four carve amounts ↔ 0, exactly what the lab's
//                           `setRiverOverlay(false)` does. The sea override is NOT part of the flip,
//                           because the lab's OFF leaves it in place too.
//     U  relief           — uReliefBakeStrength ↔ 0 and uCraterBakeRestore ↔ 1, the lab's crossover
//                           at strength 0: the analytic body, with the craters fully restored.
// `globalThis._labProvince` / `_labRivers` / `_labRelief` expose the same toggles plus per-body stats
// for chrome-devtools drives. A body that bakes mid-A/B matches the bodies already flipped.
//
// WHAT THE HOST BINDS IS WHAT THE MATERIAL DECLARES. `ensureLabSamplers` (LabPlanetMaterial.js:110)
// creates the sampler slots at material build; the seven SCALAR slots below it (`uReliefBakeStrength`,
// `uCraterBakeRestore`, the five `uRiverCarve*`) are ones the lab creates at init/route time and
// `makeUniforms` has never had, so attach creates any that are absent and never overwrites one that
// exists. A material carrying no relief/crater/carve sampler slots at all takes the province path
// alone — the reason is recorded, and it is what keeps tests/province-bake-host.test.js exercising
// exactly the path it was written against.
//
// DELIBERATE NON-GOALS. No grain cube (`uTectonicGrainCube`) — same message, own increment. No
// view-dependent river LOD (`uRiverCarvePatchMap` keeps its placeholder). No `createHeightSampler`
// (the strength-0 GPU fallback stays in the root module; the game routes on the carrier). No coverage
// law: the condition → ocean-fraction question is a logged backlog row, not something invented here.
// No change to any cube's size, type or pack, to the 0.65 province mix, or to the carve amounts. No
// fix for the despun path's body-blindness (appendix iii) — the lab's generative model's backlog row.
// Sol never reaches here: labPipelineAdmits refuses it by provenance upstream.
import * as THREE from 'three';
import { createProvinceCube, bakeProvinceCube, PROVINCE_CUBE_SIZE } from './provinceCube.js';
import { createHeightCube, buildHeightCubeGeometry, RELIEF_CUBE_SIZE } from './heightCube.js';
import { createCarveCubeMap } from './carveCube.js';
import { DEFAULT_PARAMS } from '../../worldengine/rivers/router.js';
import { fluvialClassOf } from '../../worldengine/drivers/fluvialDeck.js';
import { bodyRadiusOf } from '../LabPlanetMaterial.js';
import {
  GAME_MESH, sharedCarrierMesh, meshBuildCount, meshBuildMs, _resetSharedMeshForTests,
  bodyDriversFromCondition, provinceAppliesTo, provinceFractions, buildProvinceForBody, buildLabBundleForBody,
} from './provinceDispatch.js';
export {
  GAME_MESH, sharedCarrierMesh, meshBuildCount, meshBuildMs, _resetSharedMeshForTests,
  bodyDriversFromCondition, provinceAppliesTo, provinceFractions, buildProvinceForBody, buildLabBundleForBody,
};

const now = () => (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();

// ── The lab's constants, quoted with their line ─────────────────────────────────────────────────
// world-engine-lab.html:392-394 `riverOverlayState`, applied by `applyCarveAmounts` (:3020). The four
// AMOUNTS are what the overlay's on/off flips; `carveGateHi` is written unconditionally there and so
// is written unconditionally here, which is why it is not in this map.
const CARVE_AMOUNTS = Object.freeze({
  uRiverCarveStrength: 0.01,   // riverOverlayState.carveStrength
  uRiverCarveFloor: 1.3,       // riverOverlayState.carveFloor
  uRiverCarveDepth: 0.08,      // riverOverlayState.carveDepthH
  uRiverCarveRough: 0.5,       // riverOverlayState.carveRough
});
const CARVE_GATE_HI = 0.18;    // riverOverlayState.carveGateHi (:394) — set ungated at :3026
const RIBBON_LIFT = 1.0014;    // riverOverlayState.ribbonLift (:406) — the un-occlude radial scale

// The seven scalar slots the lab creates at init / route time and `makeUniforms` does not have
// (src/worldengine/shaders/uniforms.js carries uSeaLevel and uCoastStrength; not these). Created on
// attach if absent, NEVER overwritten — a slot that exists already belongs to whoever made it.
const LAB_SCALAR_SLOTS = Object.freeze({
  uReliefBakeStrength: 0, uCraterBakeRestore: 0,
  uRiverCarveStrength: 0, uRiverCarveFloor: 0, uRiverCarveDepth: 0, uRiverCarveRough: 0,
  uRiverCarveGateHi: CARVE_GATE_HI,
});

/** VRAM of one cube map: 6 faces × size² texels × HalfFloat RGBA (8 bytes). Derived, not measured. */
const cubeBytes = (size) => size * size * 6 * 8;

// ── The worker transport ────────────────────────────────────────────────────────────────────────
let _worker = null, _workerFailed = false, _nextId = 1;
const _pending = new Map();

function failWorker(reason) {
  _workerFailed = true;
  const err = new Error('province worker unavailable: ' + reason);
  for (const p of _pending.values()) p.reject(err);
  _pending.clear();
  if (_worker) { try { _worker.terminate(); } catch (_) { /* already gone */ } _worker = null; }
}
function workerOrNull() {
  if (_worker || _workerFailed) return _worker;
  if (typeof Worker === 'undefined' || typeof URL === 'undefined') { _workerFailed = true; return null; }
  try {
    _worker = new Worker(new URL('./provinceWorker.js', import.meta.url), { type: 'module' });
    _worker.onmessage = (ev) => {
      const m = ev.data || {}; const p = _pending.get(m.id); if (!p) return;
      _pending.delete(m.id);
      if (m.ok) p.resolve(m); else p.reject(new Error(m.error || 'province worker reported failure'));
    };
    _worker.onerror = (e) => failWorker((e && e.message) || 'onerror');
  } catch (e) { _workerFailed = true; _worker = null; }
  return _worker;
}
/**
 * Post one body to the worker. Resolves with the transferred bundle arrays.
 *
 * ⛔ `radiusEarth` IS NOT OPTIONAL. It feeds two different laws inside the bundle —
 * `bakeReliefCrossover(visScaleOf(R))` (the display crossover) and `paramsForRadius` (the ribbon /
 * valley width law) — and `buildLabBundleForBody` defaults it to 1. Dropping it here would silently
 * bind EVERY body at the crossover for a 1 R⊕ world and size every river for one too.
 */
function postToWorker(worker, body) {
  return new Promise((resolve, reject) => {
    const id = _nextId++;
    _pending.set(id, { resolve, reject });
    worker.postMessage({ id, condition: body.condition, macroSeed: body.macroSeed | 0, T_eq: body.T_eq ?? null, radiusEarth: body.radiusEarth });
  });
}
/** Instrument: which transport a fresh attach would take right now. */
export function provinceTransport() { return workerOrNull() ? 'worker' : 'sync'; }

// ── The live registries + the three A/Bs ────────────────────────────────────────────────────────
const LIVE = new Set();              // materials carrying a real (non-placeholder) province cube
const RELIEF_LIVE = new Set();       // materials carrying a real relief + crater cube
const RIVERS_LIVE = new Map();       // material → its ribbon mesh (WET bodies: the admitted half)
let _abInstalled = false, _abOff = false, _riversOff = false, _reliefOff = false;
function eachLive(fn) { for (const m of LIVE) fn(m); }

/** Flip province colour off/on for every baked material. Returns the state after the flip. */
export function toggleProvinceAB(force) {
  _abOff = (typeof force === 'boolean') ? force : !_abOff;
  eachLive((m) => {
    const u = m.uniforms && m.uniforms.uProvinceColorMix; if (!u) return;
    if (u._provinceLiveMix == null) u._provinceLiveMix = u.value;
    u.value = _abOff ? 0.0 : u._provinceLiveMix;
  });
  return { off: _abOff, materials: LIVE.size };
}

/** The lab's `applyCarveAmounts` (world-engine-lab.html:3020): the four gouging amounts go to their
 *  live values or to 0; the gate is written either way, exactly as the lab writes it. */
function applyCarveAmounts(uniforms, on) {
  if (!uniforms) return;
  for (const name of Object.keys(CARVE_AMOUNTS)) {
    const u = uniforms[name]; if (u) u.value = on ? CARVE_AMOUNTS[name] : 0.0;
  }
  if (uniforms.uRiverCarveGateHi) uniforms.uRiverCarveGateHi.value = CARVE_GATE_HI;
}
/** The two display weights, at their baked values or at the lab's strength-0 crossover (0 / 1). */
function applyReliefWeights(uniforms, on) {
  if (!uniforms) return;
  const s = uniforms.uReliefBakeStrength, r = uniforms.uCraterBakeRestore;
  if (s) s.value = on ? (s._labBakedStrength ?? 0) : 0;
  if (r) r.value = on ? (r._labBakedRestore ?? 0) : 1;
}

/**
 * Key `J` — the river A/B. Hides the ribbon and zeroes the four carve amounts on every admitted
 * body, which is precisely the lab's `setRiverOverlay(false)`. `uSeaLevel` / `uCoastStrength` are NOT
 * part of the flip: the lab's OFF leaves the histogram sea override standing too, and taking the sea
 * away would make the A/B a comparison of two things at once.
 */
export function toggleRiversAB(force) {
  _riversOff = (typeof force === 'boolean') ? force : !_riversOff;
  for (const [material, ribbon] of RIVERS_LIVE) {
    if (ribbon) ribbon.visible = !_riversOff;
    applyCarveAmounts(material.uniforms, !_riversOff);
  }
  return { off: _riversOff, bodies: RIVERS_LIVE.size };
}
/**
 * Key `U` — the relief A/B. `uReliefBakeStrength` ↔ 0 and `uCraterBakeRestore` ↔ 1: the lab's own
 * crossover evaluated at 0, which hands the body back to the analytic path with the crater overlay
 * fully restored. OFF is therefore exactly the pixels the game drew before this wire.
 */
export function toggleReliefAB(force) {
  _reliefOff = (typeof force === 'boolean') ? force : !_reliefOff;
  for (const m of RELIEF_LIVE) applyReliefWeights(m.uniforms, !_reliefOff);
  return { off: _reliefOff, materials: RELIEF_LIVE.size };
}

function isTypingTarget(t) {
  if (!t) return false; const tag = (t.tagName || '').toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || t.isContentEditable === true;
}
/**
 * Install the three dev instruments and, where there is a window, the three A/B keys.
 *
 * ⛔ THE INSTRUMENTS ARE NOT GATED ON THE WINDOW. They are plain readers over the live registries and
 * a headless suite has to be able to drive them; only the keydown listener needs a DOM.
 */
function installLabAbOnce() {
  if (_abInstalled) return;
  _abInstalled = true;
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') window.addEventListener('keydown', (e) => {
    if (e.shiftKey || e.ctrlKey || e.altKey || e.metaKey || e.repeat) return;
    if (isTypingTarget(e.target)) return;
    // KeyV province · KeyJ rivers · KeyU relief. All three were unbound in the game's key map —
    // measured `grep -rhoE "'Key[A-Z]'" src` 2026-09-01 (V) and 2026-09-02 (J, U).
    if (e.code === 'KeyV') {
      const r = toggleProvinceAB();
      if (typeof console !== 'undefined') console.info(`[province A/B] colour ${r.off ? 'OFF' : 'ON'} on ${r.materials} bodies`);
    } else if (e.code === 'KeyJ') {
      const r = toggleRiversAB();
      if (typeof console !== 'undefined') console.info(`[rivers A/B] ribbon + carve ${r.off ? 'OFF' : 'ON'} on ${r.bodies} bodies`);
    } else if (e.code === 'KeyU') {
      const r = toggleReliefAB();
      if (typeof console !== 'undefined') console.info(`[relief A/B] baked relief ${r.off ? 'OFF' : 'ON'} on ${r.materials} bodies`);
    }
  });
  globalThis._labProvince = {
    toggle: toggleProvinceAB,
    set(mix) { eachLive((m) => { if (m.uniforms?.uProvinceColorMix) m.uniforms.uProvinceColorMix.value = +mix; }); return LIVE.size; },
    get off() { return _abOff; },
    count() { return LIVE.size; },
    transport: provinceTransport, meshBuilds: meshBuildCount, meshMs: meshBuildMs,
  };
  globalThis._labRivers = {
    toggle: toggleRiversAB,
    get off() { return _riversOff; },
    count() { return RIVERS_LIVE.size; },
    /** The body's fluvial class — 'wet' | 'relict' | 'airless' — as the host recorded it. */
    class(surface) { const r = provinceRecordOf(surface); return (r && r.rivers && r.rivers.class) || null; },
  };
  globalThis._labRelief = {
    toggle: toggleReliefAB,
    get off() { return _reliefOff; },
    count() { return RELIEF_LIVE.size; },
    /** The LIVE uReliefBakeStrength — what the shader reads now, so the A/B is visible through it.
     *  The value it was baked at is `provinceRecordOf(surface).relief.strength`. */
    strength(surface) { const u = surface?.material?.uniforms?.uReliefBakeStrength; return u ? u.value : null; },
  };
}

// ── The host ────────────────────────────────────────────────────────────────────────────────────
// Geometry rebuilders for the WORKER path. The sync path hands the bundle's own geometries straight
// to the bakers; the worker path receives their typed arrays (zero-copy) and re-wraps them here.
function provinceGeometryFromArrays({ pos, wgt, idx }) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aProv', new THREE.BufferAttribute(wgt, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  return g;
}
/** The relief / crater cube geometry. `share` lets the crater cube reuse the relief's position and
 *  index BufferAttributes — the two cubes are the same sphere and the worker posts one copy (see its
 *  header); rebuilding a second identical pair here would undo that. */
function heightGeometryFromArrays({ hgt, grd }, share) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', share.position);
  g.setAttribute('aHeight', new THREE.BufferAttribute(hgt, 1));
  g.setAttribute('aGrad', new THREE.BufferAttribute(grd, 3));
  g.setIndex(share.index);
  return g;
}
function valleyGeometryFromArrays({ pos, aDepth, aMouth, aOrder, idx }) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aDepth', new THREE.BufferAttribute(aDepth, 1));
  g.setAttribute('aMouth', new THREE.BufferAttribute(aMouth, 1));
  g.setAttribute('aOrder', new THREE.BufferAttribute(aOrder, 1));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  return g;
}
/** The ribbon. Its `normal` is not posted (the worker's header says why); `computeVertexNormals`
 *  rebuilds it here in microseconds, the same call `buildRibbonGeometry` makes on the sync path
 *  (src/worldengine/rivers/ribbon.js:133). */
function ribbonGeometryFromArrays({ pos, col, idx }) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeVertexNormals();
  return g;
}

/** The ribbon mesh, in `createRiverOverlay`'s own shape (planet-lod-rivers.js:571-576). */
function makeRibbonMesh(geometry) {
  const ribbon = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, transparent: true, depthWrite: false }),
  );
  ribbon.frustumCulled = false;   // a thin shell's AABB is unreliable; never cull
  ribbon.renderOrder = 10;
  return ribbon;
}

/**
 * Attach the bake-once hook to a mounted lab surface. Returns the bake record, which is also
 * published to `surface.userData.wd.lab.province` AND `.bake` (the same object; the §12.3 E-3
 * back-link shape) or, when that path does not exist yet, to `surface.userData.wdProvince` / `.wdBake`.
 *
 * @param {THREE.Mesh} surface  — the mesh `Planet._createLabSurface` built, material already the lab's
 * @param {{condition:object, macroSeed:number, T_eq?:number, radiusEarth?:number}} body
 * @param {{createProvinceCube?:Function, createCube?:Function, createHeightCube?:Function,
 *          createCarveCube?:Function, mesh?:object, compute?:Function}} [deps]  — test seams.
 *   `compute(body)` may return the sync bundle OR a promise of the worker payload.
 */
export function attachLabBake(surface, { condition, macroSeed = 0, T_eq = null, radiusEarth = 1 } = {}, deps = {}) {
  const material = surface && surface.material;
  const uniforms = (material && material.uniforms) || null;
  const slot = uniforms && uniforms.uProvinceCube;
  const record = {
    attached: false, applies: false, reason: null, transport: null,
    requested: false, pending: false, baked: false, failed: null, fallback: false, disposed: false,
    bakes: 0, disposes: 0, path: null, ms: null, bakeMs: null, nodes: null, fractions: null,
    cube: null, dispose: null,
    routeMs: null,
    relief: { strength: 0, restore: 0, cube: null, craterCube: null },
    rivers: { class: null, routed: false, admitted: false, seaLevel: null, carveCube: null, ribbon: null,
      packSeaLevel: null, packCoastStrength: null },
    bytes: { province: 0, relief: 0, crater: 0, carve: 0 },
  };
  if (!slot) { record.reason = 'no uProvinceCube slot on the material'; return publish(surface, record); }
  if (!provinceAppliesTo(condition)) { record.reason = 'gas: province is a solid-crust partition'; return publish(surface, record); }
  record.attached = true; record.applies = true;

  // The seven scalar slots the lab creates at init/route time (see LAB_SCALAR_SLOTS). Created here,
  // never overwritten.
  for (const name of Object.keys(LAB_SCALAR_SLOTS)) {
    if (!uniforms[name]) uniforms[name] = { value: LAB_SCALAR_SLOTS[name] };
  }

  // The relief / crater / carve half needs the three sampler slots `ensureLabSamplers` creates at
  // material build. A material that declares none of them is not carrying the lab's shader, so it
  // gets the province path alone and says so rather than binding textures nothing samples.
  const reliefSlot = uniforms.uReliefBakeCube, craterSlot = uniforms.uCraterBakeCube, carveSlot = uniforms.uRiverCarveMap;
  const riverHalf = !!(reliefSlot && craterSlot && carveSlot);
  if (!riverHalf) record.reason = 'no uReliefBakeCube / uCraterBakeCube / uRiverCarveMap slots — province only';

  // The lab's F11 gate, from ONE place (driver pack #9). wet ∪ relict route; only wet is admitted to
  // the ribbon + sea + gouging half.
  const fluvialClass = fluvialClassOf(condition);
  record.rivers.class = fluvialClass;
  record.rivers.routed = riverHalf && fluvialClass !== 'airless';
  record.rivers.admitted = riverHalf && fluvialClass === 'wet';

  // ── the sea, taken to −1 until the rivers land (see the header) ──
  const seaSlot = uniforms.uSeaLevel, coastSlot = uniforms.uCoastStrength;
  if (record.rivers.admitted && seaSlot) {
    record.rivers.packSeaLevel = seaSlot.value;
    record.rivers.packCoastStrength = coastSlot ? coastSlot.value : null;
    seaSlot.value = -1;
  }

  /** Give the pack's `uSeaLevel` / `uCoastStrength` back. The host borrowed them; it did not author
   *  them. Used by BOTH the failure path and dispose, because the −1 must never outlive the attempt
   *  to replace it. A no-op on any body that was never admitted (both values stay null). */
  const restorePackSea = () => {
    if (record.rivers.packSeaLevel != null && seaSlot) seaSlot.value = record.rivers.packSeaLevel;
    if (record.rivers.packCoastStrength != null && coastSlot) coastSlot.value = record.rivers.packCoastStrength;
  };

  const body = { condition, macroSeed, T_eq, radiusEarth };
  const makeProvinceCube = deps.createProvinceCube || deps.createCube || createProvinceCube;
  const makeHeightCube = deps.createHeightCube || createHeightCube;
  const makeCarveCube = deps.createCarveCube || createCarveCubeMap;
  const placeholders = { province: slot.value, relief: reliefSlot && reliefSlot.value,
    crater: craterSlot && craterSlot.value, carve: carveSlot && carveSlot.value };
  let result = null;   // { built } from the sync path, or { payload } from the worker

  // ── the bake frame, in the lab's order: province → relief → crater → carve → ribbon ──
  // ⛔ THE RECORD TAKES OWNERSHIP AT ALLOCATION, NOT AT SUCCESS. `dispose()` releases everything the
  // record HOLDS and nothing else, so a cube created and then lost to a throw inside `update()` would
  // be an unreachable WebGLCubeRenderTarget (50.3 MB on the carve one) that no path can ever free —
  // and the catch in `onBeforeRender` records `failed` without releasing anything. Every
  // `create → record → update` below is in that order for this reason. `bytes` goes with the
  // assignment because the target's VRAM is real from allocation, whether or not it ever gets filled.
  const bindProvince = (renderer, fill) => {
    const cube = makeProvinceCube({ renderer, size: PROVINCE_CUBE_SIZE });
    record.cube = cube; record.bytes.province = cubeBytes(PROVINCE_CUBE_SIZE);
    fill(cube);
    slot.value = cube.texture;
    LIVE.add(material);
    if (_abOff && uniforms.uProvinceColorMix) {   // arrived mid-A/B: match the others
      const u = uniforms.uProvinceColorMix; if (u._provinceLiveMix == null) u._provinceLiveMix = u.value; u.value = 0.0;
    }
  };
  /**
   * The river half. `part` is the shape both transports reduce to: the two display weights, the four
   * geometries (crater's sharing the relief's position/index), and the solved sea.
   */
  const bindRiverHalf = (renderer, part) => {
    const reliefCube = makeHeightCube({ renderer, size: RELIEF_CUBE_SIZE });
    record.relief.cube = reliefCube; record.bytes.relief = cubeBytes(RELIEF_CUBE_SIZE);
    reliefCube.update(part.reliefGeo);
    const craterCube = makeHeightCube({ renderer, size: RELIEF_CUBE_SIZE });
    record.relief.craterCube = craterCube; record.bytes.crater = cubeBytes(RELIEF_CUBE_SIZE);
    craterCube.update(part.craterGeo);
    reliefSlot.value = reliefCube.texture; craterSlot.value = craterCube.texture;
    record.relief.strength = part.strength; record.relief.restore = part.restore;
    if (uniforms.uReliefBakeStrength) uniforms.uReliefBakeStrength._labBakedStrength = part.strength;
    if (uniforms.uCraterBakeRestore) uniforms.uCraterBakeRestore._labBakedRestore = part.restore;
    applyReliefWeights(uniforms, !_reliefOff);   // a body that bakes mid-A/B matches the others
    RELIEF_LIVE.add(material);

    if (!part.routed || !part.valleyGeo) return;   // an airless body: no route, no carve cube to bind
    const carveCube = makeCarveCube({ renderer, size: DEFAULT_PARAMS.CARVE_CUBE_SIZE });
    record.rivers.carveCube = carveCube; record.bytes.carve = cubeBytes(DEFAULT_PARAMS.CARVE_CUBE_SIZE);
    carveCube.update(part.valleyGeo);
    carveSlot.value = carveCube.texture;

    if (!record.rivers.admitted || !part.ribbonGeo) return;   // relict: the route + the cube, no water, no sea
    const ribbon = makeRibbonMesh(part.ribbonGeo);
    ribbon.scale.setScalar(bodyRadiusOf(surface.geometry) * RIBBON_LIFT);
    ribbon.visible = !_riversOff;
    surface.add(ribbon);
    record.rivers.ribbon = ribbon;
    RIVERS_LIVE.set(material, ribbon);
    // the lab's `riverReroute` (:2990-2992): the histogram sea, lakes on, coast at full
    record.rivers.seaLevel = part.seaLevel;
    if (seaSlot) seaSlot.value = part.seaLevel;
    if (coastSlot) coastSlot.value = 1.0;
    applyCarveAmounts(uniforms, !_riversOff);
  };

  /** The sync bundle → the bake frame's inputs. A province-ONLY bundle (buildProvinceForBody) has no
   *  relief arrays, and then there is no river half to bake: the host bakes what it is handed. */
  const partFromBundle = (b) => {
    if (!riverHalf || !b.marginHeight || !b.marginGrad) return null;
    return {
      strength: b.strength, restore: b.restore, routed: !!b.routed, seaLevel: b.seaLevel ?? null,
      reliefGeo: buildHeightCubeGeometry({ mesh: b.mesh, height: b.marginHeight, grad: b.marginGrad }),
      craterGeo: buildHeightCubeGeometry({ mesh: b.mesh, height: b.craterOverlay, grad: b.craterGrad }),
      valleyGeo: b.valleyGeo || null, ribbonGeo: b.ribbonGeo || null,
    };
  };
  /** The worker payload → the same shape. The province seam (pos/wgt/idx/…) is untouched above it. */
  const partFromPayload = (p) => {
    if (!riverHalf || !p.relief) return null;
    const reliefGeo = heightGeometryFromArrays(p.relief, {
      position: new THREE.BufferAttribute(p.relief.pos, 3), index: new THREE.BufferAttribute(p.relief.idx, 1),
    });
    return {
      strength: p.strength, restore: p.restore, routed: !!p.routed, seaLevel: p.sea ? p.sea.seaLevel : null,
      reliefGeo,
      craterGeo: heightGeometryFromArrays(p.crater, { position: reliefGeo.getAttribute('position'), index: reliefGeo.getIndex() }),
      valleyGeo: p.valley ? valleyGeometryFromArrays(p.valley) : null,
      ribbonGeo: p.ribbon ? ribbonGeometryFromArrays(p.ribbon) : null,
    };
  };

  const bakeFromResult = (renderer) => {
    const t0 = now();
    let part = null;
    if (result.built) {
      const b = result.built;
      record.path = b.relief && b.relief.path; record.ms = b.ms; record.routeMs = b.routeMs ?? null;
      record.nodes = b.province.length; record.fractions = provinceFractions(b.province);
      part = partFromBundle(b);
      bindProvince(renderer, (cube) => bakeProvinceCube({ mesh: b.mesh, province: b.province, provinceCube: cube }));
    } else {
      const p = result.payload;
      record.path = p.path; record.ms = p.ms; record.routeMs = p.routeMs ?? null;
      record.nodes = p.nodes; record.fractions = p.fractions;
      part = partFromPayload(p);
      bindProvince(renderer, (cube) => cube.update(provinceGeometryFromArrays(p)));
    }
    if (part) bindRiverHalf(renderer, part);
    record.baked = true; record.bakes++; record.bakeMs = now() - t0;   // the WHOLE frame, all four cubes
    result = null;
  };

  /** ⛔ THE SYNC DISPATCH FOLLOWS THE MATERIAL. Routing costs 100-170 ms on top of the dispatch, and
   *  a material with no carve/relief slots could not show a metre of it. */
  const computeSync = () => ({
    built: riverHalf ? buildLabBundleForBody(body, deps.mesh || sharedCarrierMesh())
      : buildProvinceForBody(body, deps.mesh || sharedCarrierMesh()),
  });
  const request = () => {
    record.requested = true;
    let out;
    if (deps.compute) { record.transport = 'seam'; out = deps.compute(body); }
    else { const w = workerOrNull(); if (w) { record.transport = 'worker'; out = postToWorker(w, body); } else { record.transport = 'sync'; out = computeSync(); } }
    if (out && typeof out.then === 'function') {
      record.pending = true;
      out.then((payload) => { record.pending = false; if (record.disposed) return; result = payload && payload.province ? { built: payload } : { payload }; },
               (err) => { record.pending = false; if (record.disposed) return; record.fallback = true; record.failed = null; record.reason = 'worker failed: ' + String(err && err.message || err) + ' — synchronous fallback'; });
    } else {
      result = out && out.built ? out : { built: out };
    }
  };

  const prev = surface.onBeforeRender;
  surface.onBeforeRender = function provinceBakeOnBeforeRender(renderer, ...rest) {
    if (typeof prev === 'function') prev.call(this, renderer, ...rest);
    if (record.baked || record.failed || record.disposed) return;
    try {
      if (!record.requested) request();
      else if (record.fallback && !result && !record.pending) { record.transport = 'sync'; result = computeSync(); record.fallback = false; }
      if (result) bakeFromResult(renderer);
    } catch (e) {
      record.failed = String((e && e.message) || e);
      // ⛔ A FAILED BAKE MUST NOT LEAVE A WET BODY WITH NO OCEAN. Attach took `uSeaLevel` to −1 so the
      // sea could arrive WITH the rivers; `record.failed` makes this hook return early on every later
      // frame, so a bake that died before writing the solved level would leave the −1 standing until
      // dispose — the shoreline VANISHING, which is the exact defect the deferral exists to prevent.
      // The carve amounts stay at 0: no valley was rasterized, so nothing may gouge.
      if (record.rivers.seaLevel == null) restorePackSea();
      if (typeof console !== 'undefined') console.warn('[lab bake] failed; placeholders kept —', record.failed);
    }
  };

  // ── dispose: symmetric with the bake frame, and idempotent ──
  record.dispose = () => {
    if (record.disposed) return;                 // a second dispose releases nothing twice
    record.disposed = true;
    let released = 0;
    if (record.cube) { record.cube.dispose(); record.cube = null; released++; }
    if (record.relief.cube) { record.relief.cube.dispose(); record.relief.cube = null; released++; }
    if (record.relief.craterCube) { record.relief.craterCube.dispose(); record.relief.craterCube = null; released++; }
    if (record.rivers.carveCube) { record.rivers.carveCube.dispose(); record.rivers.carveCube = null; released++; }
    if (record.rivers.ribbon) {
      const ribbon = record.rivers.ribbon;
      surface.remove(ribbon);
      ribbon.geometry.dispose(); ribbon.material.dispose();
      record.rivers.ribbon = null; released++;
    }
    if (released) record.disposes++;             // ONE per dispose that released something, so it still pairs 1:1 with `bakes`
    if (slot.value !== placeholders.province) slot.value = placeholders.province;
    if (reliefSlot && reliefSlot.value !== placeholders.relief) reliefSlot.value = placeholders.relief;
    if (craterSlot && craterSlot.value !== placeholders.crater) craterSlot.value = placeholders.crater;
    if (carveSlot && carveSlot.value !== placeholders.carve) carveSlot.value = placeholders.carve;
    restorePackSea();                            // the pack's sea, given back
    if (uniforms.uReliefBakeStrength) { uniforms.uReliefBakeStrength.value = 0; delete uniforms.uReliefBakeStrength._labBakedStrength; }
    if (uniforms.uCraterBakeRestore) { uniforms.uCraterBakeRestore.value = 0; delete uniforms.uCraterBakeRestore._labBakedRestore; }
    // the four gouging amounts back to 0. NOT through `applyCarveAmounts`, which also writes the
    // gate: attach never overwrote an existing slot and teardown must not either.
    for (const name of Object.keys(CARVE_AMOUNTS)) { const u = uniforms[name]; if (u) u.value = 0.0; }
    result = null;
    LIVE.delete(material); RELIEF_LIVE.delete(material); RIVERS_LIVE.delete(material);
  };

  installLabAbOnce();
  return publish(surface, record);
}

function publish(surface, record) {
  if (!surface) return record;
  surface.userData = surface.userData || {};
  const lab = surface.userData.wd && surface.userData.wd.lab;
  // ONE record, two names: `province` is the name the province wire published under and every
  // instrument built on it still reads; `bake` is what it is now that four cubes ride it.
  if (lab) { lab.province = record; lab.bake = record; }
  else { surface.userData.wdProvince = record; surface.userData.wdBake = record; }
  return record;
}
/** Read the record back from a surface, wherever publish() put it. */
export function provinceRecordOf(surface) {
  return (surface && surface.userData && ((surface.userData.wd && surface.userData.wd.lab && surface.userData.wd.lab.province) || surface.userData.wdProvince)) || null;
}
/** Release everything this body owns (idempotent). Planet.dispose / Moon.dispose call it beside
 *  material.dispose(). */
export function disposeLabBake(surface) {
  const r = provinceRecordOf(surface);
  if (r && typeof r.dispose === 'function') r.dispose();
  return r;
}

// ⛔ THE OLD NAMES ARE THE NEW ONES. The province wire's two entry points stay exported so
// tests/province-bake-host.test.js and any instrument written against them keep working unedited —
// the province path is a strict SUBSET of this host, not a second implementation of it.
export const attachProvinceBake = attachLabBake;
export const disposeProvinceBake = disposeLabBake;
