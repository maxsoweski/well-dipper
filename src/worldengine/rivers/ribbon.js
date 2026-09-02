// src/worldengine/rivers/ribbon.js
// THE RIVER + VALLEY GEOMETRY BUILDERS — moved here from planet-lod-rivers.js lines 793–905 and
// 907–1031 (at `3dded82`) on 2026-09-02.
//
// FUNCTION: turns a routed drainage graph into geometry. `buildRibbonGeometry` emits the visible blue
// river network — Dunne–Leopold widths from `accum`, Chaikin-smoothed centrelines, lifted off the
// sphere, coloured by Strahler order, with the AC5 monotonic-width violation count on userData.
// `buildValleyGeometry` emits the 3-rail carve strip (left edge depth 0 · centre depth · right edge
// depth 0) whose `aDepth`/`aMouth`/`aOrder` attributes the carve cube rasterizes into the R/G/B the
// planet shader subtracts — the V-valleys, the mouth-strength deltas and the Strahler trunk.
//
// INTENT: the same "REPLACE, not graft" wire as router.js — the game's rivers must be the LAB's ribbon
// and the LAB's carve, not a second implementation grafted onto the game's shader. Split from router.js
// rather than folded into it because these two are the only THREE-GEOMETRY producers in the moved set:
// router.js hands back typed arrays a worker can post, while these hand back BufferGeometry, so a
// consumer that only needs the solve never pulls the geometry half in.
//
// WHY `rivers/` UNDER `src/worldengine/` AND NOT `src/rendering/bake/`. Carried C25 is "needs a
// RENDERER" vs "does not". These build geometry with `THREE.BufferGeometry` / `Vector3` / `Color` and
// never touch a renderer, an RTT target or a cube camera — the same three-coupled-but-GPU-free
// position mesh/sphereMesh.js holds. The cube BAKERS that rasterize this geometry do need a renderer
// and stay out of here.
//
// DELIBERATE NON-GOALS: no RNG (one-pipeline-fence registration 5), no Date.now, no renderer and no
// cube bake; no routing (the graph arrives as `routed` from router.js); no per-node carve operand —
// `perNodeIncision` is the epoch-readback path and stays with route() in planet-lod-rivers.js.
//
// ⛔ BYTE-VERBATIM BELOW THIS LINE. Every line below is the identical text from planet-lod-rivers.js
// at `3dded82`; the two imports above it are new. `three` was already a bare specifier there, and
// DEFAULT_PARAMS was a same-file binding — it moved to router.js in the same commit, so the default
// argument `params = DEFAULT_PARAMS` below resolves to the identical frozen object, not a copy.
import * as THREE from 'three';
import { DEFAULT_PARAMS } from './router.js';

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
