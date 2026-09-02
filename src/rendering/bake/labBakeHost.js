// src/rendering/bake/labBakeHost.js
// THE PROVINCE CUBE'S HOST — attach-once, bake-once, dispose-once, for one game body mounted on the
// lab material. Authored 2026-09-01 for docs/WORKSTREAMS/wire-province-cube-lab-into-game/.
//
// FUNCTION. Turn the lab's province partition for this body into the cube map the planet shader
// samples at planetShaders.glsl.js:566, so `uCratonColor` / `uFreshColor` / `uSedColor` stop being
// inert. Three modules, three jobs:
//
//     provinceDispatch.js   CPU — the lab's dispatch over the lab's mesh   (runs anywhere)
//     provinceWorker.js     transport — that dispatch off the main thread   (browser only)
//     labBakeHost.js        GPU + lifetime — this file                      (needs a renderer)
//
// INTENT (Max, 2026-07-31 / 2026-08-26): REPLACE, not graft; wire the lab's pipeline into the game;
// log gaps, never shoestring. Nothing here derives a law. The baker is the lab's (provinceCube.js,
// byte-verbatim), the dispatch is the lab's (bodyRelief.js), the mesh is the lab's (40k / 4 —
// provinceDispatch.js header explains why any other mesh would be a divergence).
//
// WHERE THE BAKE RUNS, AND WHY THERE. A bake needs a renderer; the pack tree may not hold one
// (drivers/index.js:40 "NO RENDERER IN THE CLOSURE") and `Planet._createLabSurface` is static with
// none in scope. So the work is keyed to the body's FIRST DRAW: `surface.onBeforeRender` receives
// the live renderer from three itself. Frame 1 posts the body to the worker (or, with no Worker,
// runs the dispatch inline); the frame after the reply lands renders the six cube faces (~1–3 ms)
// and binds the texture. Rendering inside onBeforeRender is the pattern three's own Reflector and
// Refractor use; CubeCamera.update saves and restores the render target, tone mapping and XR state,
// and createProvinceCube.update saves and restores the clear colour. A body never drawn never pays.
//
// THE A/B FOR MAX. Key `V` (bare, no modifier, not while typing) flips `uProvinceColorMix` between
// its live value and 0.0 on every baked material — the shader's own mix knob, so OFF is exactly the
// pixels the game drew before this wire (provSum was 0 on every body; the term was inert).
// `globalThis._labProvince` exposes the same toggle plus per-body stats for chrome-devtools drives.
//
// DELIBERATE NON-GOALS. No relief / crater / river-carve cube (same path, separate increments so a
// failure stays attributable). No change to PROVINCE_CUBE_SIZE, the cube's type, or the 0.65 mix. No
// fix for the despun path's body-blindness (appendix iii) — that is the lab's generative model's
// backlog row. Sol never reaches here: labPipelineAdmits refuses it by provenance upstream.
import * as THREE from 'three';
import { createProvinceCube, bakeProvinceCube, PROVINCE_CUBE_SIZE } from './provinceCube.js';
import {
  GAME_MESH, sharedCarrierMesh, meshBuildCount, meshBuildMs, _resetSharedMeshForTests,
  bodyDriversFromCondition, provinceAppliesTo, provinceFractions, buildProvinceForBody,
} from './provinceDispatch.js';
export {
  GAME_MESH, sharedCarrierMesh, meshBuildCount, meshBuildMs, _resetSharedMeshForTests,
  bodyDriversFromCondition, provinceAppliesTo, provinceFractions, buildProvinceForBody,
};

const now = () => (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();

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
/** Post one body to the worker. Resolves with the transferred cube-geometry arrays. */
function postToWorker(worker, body) {
  return new Promise((resolve, reject) => {
    const id = _nextId++;
    _pending.set(id, { resolve, reject });
    worker.postMessage({ id, condition: body.condition, macroSeed: body.macroSeed | 0, T_eq: body.T_eq ?? null });
  });
}
/** Instrument: which transport a fresh attach would take right now. */
export function provinceTransport() { return workerOrNull() ? 'worker' : 'sync'; }

// ── The live registry + the A/B ─────────────────────────────────────────────────────────────────
const LIVE = new Set();            // materials carrying a real (non-placeholder) province cube
let _keyBound = false, _abOff = false;
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
function isTypingTarget(t) {
  if (!t) return false; const tag = (t.tagName || '').toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || t.isContentEditable === true;
}
function bindKeyOnce() {
  if (_keyBound || typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
  _keyBound = true;
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'KeyV' || e.shiftKey || e.ctrlKey || e.altKey || e.metaKey || e.repeat) return;
    if (isTypingTarget(e.target)) return;
    const r = toggleProvinceAB();
    if (typeof console !== 'undefined') console.info(`[province A/B] colour ${r.off ? 'OFF' : 'ON'} on ${r.materials} bodies`);
  });
  globalThis._labProvince = {
    toggle: toggleProvinceAB,
    set(mix) { eachLive((m) => { if (m.uniforms?.uProvinceColorMix) m.uniforms.uProvinceColorMix.value = +mix; }); return LIVE.size; },
    get off() { return _abOff; },
    count() { return LIVE.size; },
    transport: provinceTransport, meshBuilds: meshBuildCount, meshMs: meshBuildMs,
  };
}

// ── The host ────────────────────────────────────────────────────────────────────────────────────
function geometryFromArrays({ pos, wgt, idx }) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aProv', new THREE.BufferAttribute(wgt, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  return g;
}

/**
 * Attach the bake-once hook to a mounted lab surface. Returns the province record, which is also
 * published to `surface.userData.wd.lab.province` (the §12.3 E-3 back-link shape) or, when that
 * path does not exist yet, to `surface.userData.wdProvince`.
 *
 * @param {THREE.Mesh} surface  — the mesh `Planet._createLabSurface` built, material already the lab's
 * @param {{condition:object, macroSeed:number, T_eq?:number}} body
 * @param {{createCube?:Function, mesh?:object, compute?:Function}} [deps]  — test seams. `compute(body)`
 *   may return the sync result of buildProvinceForBody OR a promise of the worker payload.
 */
export function attachProvinceBake(surface, { condition, macroSeed = 0, T_eq = null } = {}, deps = {}) {
  const material = surface && surface.material;
  const slot = material && material.uniforms && material.uniforms.uProvinceCube;
  const record = {
    attached: false, applies: false, reason: null, transport: null,
    requested: false, pending: false, baked: false, failed: null, fallback: false, disposed: false,
    bakes: 0, disposes: 0, path: null, ms: null, bakeMs: null, nodes: null, fractions: null,
    cube: null, dispose: null,
  };
  if (!slot) { record.reason = 'no uProvinceCube slot on the material'; return publish(surface, record); }
  if (!provinceAppliesTo(condition)) { record.reason = 'gas: province is a solid-crust partition'; return publish(surface, record); }
  record.attached = true; record.applies = true;

  const body = { condition, macroSeed, T_eq };
  const createCube = deps.createCube || createProvinceCube;
  const placeholder = slot.value;
  let result = null;   // { geometry } from the worker, or { built } from the sync path

  const bindCube = (renderer, fill) => {
    const t0 = now();
    const cube = createCube({ renderer, size: PROVINCE_CUBE_SIZE });
    fill(cube);
    slot.value = cube.texture;
    record.cube = cube; record.baked = true; record.bakes++; record.bakeMs = now() - t0;
    LIVE.add(material);
    if (_abOff && material.uniforms.uProvinceColorMix) {   // arrived mid-A/B: match the others
      const u = material.uniforms.uProvinceColorMix; if (u._provinceLiveMix == null) u._provinceLiveMix = u.value; u.value = 0.0;
    }
  };
  const bakeFromResult = (renderer) => {
    if (result.built) {
      const b = result.built;
      record.path = b.relief && b.relief.path; record.ms = b.ms; record.nodes = b.province.length; record.fractions = provinceFractions(b.province);
      bindCube(renderer, (cube) => bakeProvinceCube({ mesh: b.mesh, province: b.province, provinceCube: cube }));
    } else {
      const p = result.payload;
      record.path = p.path; record.ms = p.ms; record.nodes = p.nodes; record.fractions = p.fractions;
      bindCube(renderer, (cube) => cube.update(geometryFromArrays(p)));
    }
    result = null;
  };
  const computeSync = () => ({ built: buildProvinceForBody(body, deps.mesh || sharedCarrierMesh()) });
  const request = () => {
    record.requested = true;
    let out;
    if (deps.compute) { record.transport = 'seam'; out = deps.compute(body); }
    else { const w = workerOrNull(); if (w) { record.transport = 'worker'; out = postToWorker(w, body); } else { record.transport = 'sync'; out = computeSync(); } }
    if (out && typeof out.then === 'function') {
      record.pending = true;
      out.then((payload) => { record.pending = false; if (record.disposed) return; result = payload && payload.built ? payload : { payload }; },
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
      if (typeof console !== 'undefined') console.warn('[province bake] failed; placeholder kept —', record.failed);
    }
  };

  record.dispose = () => {
    record.disposed = true;
    if (record.cube) { record.cube.dispose(); record.cube = null; record.disposes++; }
    if (slot.value !== placeholder) slot.value = placeholder;
    result = null;
    LIVE.delete(material);
  };

  bindKeyOnce();
  return publish(surface, record);
}

function publish(surface, record) {
  if (!surface) return record;
  surface.userData = surface.userData || {};
  const lab = surface.userData.wd && surface.userData.wd.lab;
  if (lab) lab.province = record; else surface.userData.wdProvince = record;
  return record;
}
/** Read the record back from a surface, wherever publish() put it. */
export function provinceRecordOf(surface) {
  return (surface && surface.userData && ((surface.userData.wd && surface.userData.wd.lab && surface.userData.wd.lab.province) || surface.userData.wdProvince)) || null;
}
/** Release the body's cube (idempotent). Planet.dispose / Moon.dispose call this beside material.dispose(). */
export function disposeProvinceBake(surface) {
  const r = provinceRecordOf(surface);
  if (r && typeof r.dispose === 'function') r.dispose();
  return r;
}
