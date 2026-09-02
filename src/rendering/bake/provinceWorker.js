// src/rendering/bake/provinceWorker.js — the lab's per-body bake dispatch, off the main thread.
//
// WHY A WORKER. The game runs the lab's 40000-node mesh (provinceDispatch.js header: any coarser
// mesh draws a different partition), and at that resolution the dispatch costs 35–160 ms per body
// and 645 ms once for the mesh — measured 2026-09-01. On the main thread that is a 2–10 frame hitch
// per body as each first draws, and a two-thirds-second freeze the first time. Here the mesh is
// built once in this thread and every body's dispatch runs here; the main thread receives the cube
// GEOMETRY as transferable typed arrays (zero-copy) and spends ~1–3 ms rendering the cube faces.
// labBakeHost.js falls back to the synchronous path when Worker is unavailable (tests, or a
// browser that refuses module workers).
//
// ONE PIPELINE, STILL: every builder below is the lab's own (moved byte-verbatim to provinceCube.js
// / heightCube.js); they run here so the arrays they lay out are the arrays the lab's cubes are
// drawn from. three's BufferGeometry is plain JS and loads in a worker; only its typed arrays cross.
//
// ⭐ 2026-09-02 — ONE MESSAGE CARRIES THE WHOLE `route()` BUNDLE, not just the province
// (docs/WORKSTREAMS/wire-river-router-lab-into-game/, intent.md decision 6). The province, relief,
// crater, carve and ribbon arrays all come from ONE `writeBodyRelief` over ONE carrier; posting them
// in four dispatches would re-run a 35–160 ms dispatch four times for identical arrays. Each cube
// keeps its own A/B and sabotage arm on the host side, so a failure stays attributable without
// splitting the transport.
//
// PROTOCOL.
//   in:  { id, condition, macroSeed, T_eq, radiusEarth }        (condition is the plain condition vector)
//   out: { id, ok: true,
//          pos, wgt, idx, nodes, path, ms, fractions,           ⛔ THE PROVINCE SEAM, UNCHANGED —
//                                                                  labBakeHost.js reads exactly these
//                                                                  seven at the top level; they keep
//                                                                  their names and their place.
//          fluvialClass, routed, strength, restore, routeMs,
//          relief: { pos, hgt, grd, idx },
//          crater: { hgt, grd },                                — shares relief's pos/idx (see below)
//          sea:    { seaLevel, oceanCount } | null,
//          valley: { pos, aDepth, aMouth, aOrder, idx } | null,   — null on an AIRLESS body (not routed)
//          ribbon: { pos, col, idx } | null }                     — null on airless AND on RELICT: the
//                                                                   bundle builds a ribbon only for
//                                                                   `wet`, the admitted half, so there
//                                                                   is none to post on the other 64 of
//                                                                   68 routed bodies (2026-09-02).
//        { id, ok: false, error }
//
// ⛔ WHY THE CRATER GEOMETRY POSTS ONLY hgt/grd. The relief and crater cubes are the SAME sphere —
// one vertex per node at its unit direction, triangulated by mesh.faces — differing only in the
// height and gradient channels. Posting the crater's own `position` / `index` would be a second copy
// of identical bytes, and listing the SAME buffer twice in the transfer list throws DataCloneError.
// So the host binds `crater.hgt` / `crater.grd` onto `relief.pos` / `relief.idx`.
//
// ⛔ EVERY BUFFER IN THE TRANSFER LIST EXACTLY ONCE. `buildHeightCubeGeometry` allocates fresh
// arrays per call and three's Float32BufferAttribute copies its input, so no two entries below can
// alias; `tests/river-bake-host.test.js` drives this handler headless and asserts it, because a
// duplicate is a runtime throw in the browser and nothing at all in a headless unit test.
//
// DELIBERATE NON-GOALS: no policy about WHEN to bake or WHICH bodies (that is labBakeHost.js), no
// grain cube yet (same message, own increment — intent.md "Deliberately NOT in this workstream").
import { buildLabBundleForBody, provinceFractions } from './provinceDispatch.js';
import { buildProvinceCubeGeometry } from './provinceCube.js';
import { buildHeightCubeGeometry } from './heightCube.js';

const attr = (geo, name) => geo.getAttribute(name).array;

self.onmessage = (ev) => {
  const { id, condition, macroSeed, T_eq, radiusEarth } = ev.data || {};
  try {
    const b = buildLabBundleForBody({ condition, macroSeed, T_eq, radiusEarth });

    // ── the province cube's geometry (unchanged: the same three arrays, the same three names) ──
    const provGeo = buildProvinceCubeGeometry({ mesh: b.mesh, province: b.province });
    const pos = attr(provGeo, 'position'), wgt = attr(provGeo, 'aProv'), idx = provGeo.getIndex().array;

    // ── the relief cube (R = composited height, GBA = its tangent gradient) ──
    const reliefGeo = buildHeightCubeGeometry({ mesh: b.mesh, height: b.marginHeight, grad: b.marginGrad });
    const rPos = attr(reliefGeo, 'position'), rHgt = attr(reliefGeo, 'aHeight'), rGrd = attr(reliefGeo, 'aGrad');
    const rIdx = reliefGeo.getIndex().array;
    // ── the crater cube: the SAME builder on the crater-only overlay, so its channels are laid out
    // by the lab's code rather than by a second loop here. Its position/index are discarded — see
    // the header — and the host reuses the relief's.
    const craterGeo = buildHeightCubeGeometry({ mesh: b.mesh, height: b.craterOverlay, grad: b.craterGrad });
    const cHgt = attr(craterGeo, 'aHeight'), cGrd = attr(craterGeo, 'aGrad');

    const msg = {
      id, ok: true,
      // the province seam, byte-for-byte as it has always been
      pos, wgt, idx,
      nodes: b.province.length, path: b.relief && b.relief.path, ms: b.ms,
      fractions: provinceFractions(b.province),
      // the river bundle beside it
      fluvialClass: b.fluvialClass, routed: b.routed, strength: b.strength, restore: b.restore,
      routeMs: b.routeMs,
      relief: { pos: rPos, hgt: rHgt, grd: rGrd, idx: rIdx },
      crater: { hgt: cHgt, grd: cGrd },
      sea: null, valley: null, ribbon: null,
    };
    const transfer = [pos.buffer, wgt.buffer, idx.buffer,
      rPos.buffer, rHgt.buffer, rGrd.buffer, rIdx.buffer, cHgt.buffer, cGrd.buffer];

    // ⛔ NULL, NOT AN EMPTY GRAPH, ON AN AIRLESS BODY. Its whole fluvial family is zero by driver
    // pack #9, so the carve cube would be sampled ×0 and the ribbon drawn at width 0 — the honest
    // payload is "there is no route here" (intent.md decision 4), which the host can act on.
    if (b.routed) {
      msg.sea = { seaLevel: b.seaLevel, oceanCount: b.oceanCount };
      const vPos = attr(b.valleyGeo, 'position'), vDepth = attr(b.valleyGeo, 'aDepth'),
        vMouth = attr(b.valleyGeo, 'aMouth'), vOrder = attr(b.valleyGeo, 'aOrder'),
        vIdx = b.valleyGeo.getIndex().array;
      msg.valley = { pos: vPos, aDepth: vDepth, aMouth: vMouth, aOrder: vOrder, idx: vIdx };
      transfer.push(vPos.buffer, vDepth.buffer, vMouth.buffer, vOrder.buffer, vIdx.buffer);
    }
    // ⛔ THE RIBBON RIDES ITS OWN PRESENCE TEST, NOT `b.routed`. The bundle builds a ribbon for `wet`
    // only (provinceDispatch.js, the gate at :706's call site), so on the 66 relict bodies of the
    // 68 routed ones `b.ribbonGeo` is undefined and `ribbon` posts null — which is what the host
    // already treats as "no water here". Reading `b.ribbonGeo` under `if (b.routed)` would throw.
    if (b.ribbonGeo) {
      // the ribbon's `normal` attribute is NOT posted: computeVertexNormals() rebuilds it from
      // position + index on the host in microseconds, and MeshBasicMaterial never reads it.
      const ribPos = attr(b.ribbonGeo, 'position'), ribCol = attr(b.ribbonGeo, 'color'),
        ribIdx = b.ribbonGeo.getIndex().array;
      msg.ribbon = { pos: ribPos, col: ribCol, idx: ribIdx };
      transfer.push(ribPos.buffer, ribCol.buffer, ribIdx.buffer);
    }

    self.postMessage(msg, transfer);
  } catch (e) {
    self.postMessage({ id, ok: false, error: String((e && e.message) || e) });
  }
};
