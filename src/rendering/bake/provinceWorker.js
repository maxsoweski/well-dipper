// src/rendering/bake/provinceWorker.js — the province dispatch, off the main thread.
//
// WHY A WORKER. The game runs the lab's 40000-node mesh (provinceDispatch.js header: any coarser
// mesh draws a different partition), and at that resolution the dispatch costs 35–160 ms per body
// and 645 ms once for the mesh — measured 2026-09-01. On the main thread that is a 2–10 frame hitch
// per body as each first draws, and a two-thirds-second freeze the first time. Here the mesh is
// built once in this thread and every body's dispatch runs here; the main thread receives the cube
// GEOMETRY as three transferable typed arrays (zero-copy) and spends ~1–3 ms rendering the six cube
// faces. labBakeHost.js falls back to the synchronous path when Worker is unavailable (tests, or a
// browser that refuses module workers).
//
// ONE PIPELINE, STILL: `buildProvinceCubeGeometry` below is the lab's own builder (moved byte-verbatim
// to provinceCube.js); it runs here so the arrays it lays out are the arrays the lab's cube is drawn
// from. three's BufferGeometry is plain JS and loads in a worker; only its typed arrays cross.
//
// PROTOCOL.  in: { id, condition, macroSeed, T_eq }   (condition is the plain condition vector)
//           out: { id, ok: true, pos, wgt, idx, nodes, path, ms, fractions }  — pos/wgt/idx transferred
//                { id, ok: false, error }
import { buildProvinceForBody, provinceFractions } from './provinceDispatch.js';
import { buildProvinceCubeGeometry } from './provinceCube.js';

self.onmessage = (ev) => {
  const { id, condition, macroSeed, T_eq } = ev.data || {};
  try {
    const built = buildProvinceForBody({ condition, macroSeed, T_eq });
    const geo = buildProvinceCubeGeometry({ mesh: built.mesh, province: built.province });
    const pos = geo.getAttribute('position').array, wgt = geo.getAttribute('aProv').array, idx = geo.getIndex().array;
    self.postMessage({
      id, ok: true, pos, wgt, idx,
      nodes: built.province.length, path: built.relief && built.relief.path, ms: built.ms,
      fractions: provinceFractions(built.province),
    }, [pos.buffer, wgt.buffer, idx.buffer]);
  } catch (e) {
    self.postMessage({ id, ok: false, error: String((e && e.message) || e) });
  }
};
