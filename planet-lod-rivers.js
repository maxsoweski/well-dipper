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

// ───────────────────────── Defaults (from rivers-terrain-lab.main.js) ─────────────────────
export const DEFAULT_PARAMS = Object.freeze({
  TARGET_N: 40000,
  LLOYD_ITERS: 4,
  CHANNEL_ORDER: 2,
  MIN_ORDER: 2,
  WIDTH_PHI: 0.42, WIDTH_EXP: 0.69, WIDTH_SCALE: 0.00055, WIDTH_MIN: 0.0009, WIDTH_MAX: 0.018,
  CHAIKIN_ITERS: 3,
  FLAT_RESOLVE: true,
  DINF_ROUTE: true,
  CHANNEL_FRAC: 0.06,
  LIFT: 0.999,   // seat the water just BELOW the mean surface so it sits in the channel (was 1.0035 = floating)
  // ── carve (river→valley incision) ──
  VALLEY_WIDTH_MUL: 4.0,   // valley footprint = water width × this (the V is wider than the water)
  VALLEY_DEPTH_LO: 0.45, VALLEY_DEPTH_HI: 1.0,   // center depth (0..1) lerped by stream order; cube map stores this
  CARVE_CUBE_SIZE: 1024,
  TARGET_OCEAN_FRACTION: 0.35,   // AC3: solve uSeaLevel to this fraction (band 0.25–0.45)
});

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
    outflowCombiner(vPos, h, canyonHeight, grad);
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
    deltaCombiner(vPos, h, grad, fluvialWet);
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
export function computeOcean(height, seaLevel, N) {
  const isOcean = new Uint8Array(N); let oceanCount = 0;
  for (let i = 0; i < N; i++) { if (height[i] < seaLevel) { isOcean[i] = 1; oceanCount++; } }
  return { isOcean, oceanCount };
}

// ═══════════════════════ ROUTING + ORDER + METRICS ═══════════════════════
// Priority-flood → flat-resolve → D-inf receiver → Horton–Strahler order, plus the AC5
// network-validity metrics (orphans/uphill/bifurcation ratio/river-scale straightness).
export function routeAndOrder({ mesh, height, grad, isOcean, params = DEFAULT_PARAMS }) {
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
  const accum = Float32Array.from({ length: N }, () => 1);
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
          const v = new THREE.Vector3(a.p[0] + (b.p[0] - a.p[0]) * t, a.p[1] + (b.p[1] - a.p[1]) * t, a.p[2] + (b.p[2] - a.p[2]) * t).normalize().multiplyScalar(LIFT);
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
    const pts = raw.map(idx => ({ p: [pos[idx * 3] * LIFT, pos[idx * 3 + 1] * LIFT, pos[idx * 3 + 2] * LIFT],
                                  w: widthAt(idx), c: cOrd(strahler[idx] || MIN_ORDER) }));
    emitRibbon(chaikin(pts, CHAIKIN_ITERS));
  }
  for (const h of heads) buildAndEmit(h);
  for (let i = 0; i < N; i++) { if (rendered[i] && !drawn[i]) buildAndEmit(i); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(ribPos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(ribCol, 3));
  g.setIndex(ribIdx); g.computeVertexNormals();
  g.userData.renderedCount = rendered.reduce((a, b) => a + b, 0);
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
export function buildValleyGeometry({ mesh, routed, params = DEFAULT_PARAMS }) {
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
  function chaikin(pts, iters) {
    let cur = pts;
    for (let it = 0; it < iters; it++) {
      if (cur.length < 3) break;
      const out = [cur[0]];
      for (let k = 0; k < cur.length - 1; k++) {
        const a = cur[k], b = cur[k + 1];
        const mk = (t) => {
          const v = new THREE.Vector3(a.p[0] + (b.p[0] - a.p[0]) * t, a.p[1] + (b.p[1] - a.p[1]) * t, a.p[2] + (b.p[2] - a.p[2]) * t).normalize();
          return { p: [v.x, v.y, v.z], w: a.w + (b.w - a.w) * t, d: a.d + (b.d - a.d) * t };
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
  const vPos = [], vDepth = [], vIdx = []; let vBase = 0;
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
                                  w: halfWidthAt(idx), d: depthAt(strahler[idx] || MIN_ORDER) }));
    emitValley(chaikin(pts, CHAIKIN_ITERS));
  }
  for (const h of heads) buildAndEmit(h);
  for (let i = 0; i < N; i++) { if (rendered[i] && !drawn[i]) buildAndEmit(i); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(vPos, 3));
  g.setAttribute('aDepth', new THREE.Float32BufferAttribute(vDepth, 1));
  g.setIndex(vIdx);
  return g;
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
      varying float vDepth;
      void main(){ vDepth = aDepth; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: `
      precision highp float;
      varying float vDepth;
      void main(){ gl_FragColor = vec4(vDepth, 0.0, 0.0, 1.0); }
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
export function createRiverOverlay({ renderer, uniforms, params = DEFAULT_PARAMS, octavesDuringRead = 9 }) {
  let mesh = null, sampler = null, carve = null, N = 0;
  let height = null, grad = null, isOcean = null, oceanCount = 0, seaLevel = 0, stats = null, meshMs = 0;
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
    meshMs = ((typeof performance !== 'undefined' && performance.now) ? performance.now() : 0) - t0;
  }

  function route({ seaMode = 'histogram', targetFraction = params.TARGET_OCEAN_FRACTION, label = 'route' } = {}) {
    const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : 0;
    ensureMesh();
    const r = sampler.read(); height = r.height; grad = r.grad;
    seaLevel = (seaMode === 'histogram') ? solveSeaLevel(height, targetFraction) : uniforms.uSeaLevel.value;
    const oc = computeOcean(height, seaLevel, N); isOcean = oc.isOcean; oceanCount = oc.oceanCount;
    const routed = routeAndOrder({ mesh, height, grad, isOcean, params });
    const ribGeo = buildRibbonGeometry({ mesh, routed, params });
    ribbon.geometry.dispose(); ribbon.geometry = ribGeo;
    // carve: rasterize the valley footprint into the depth cube map (same network as the ribbon)
    const valleyGeo = buildValleyGeometry({ mesh, routed, params });
    carve.update(valleyGeo);
    const totalMs = ((typeof performance !== 'undefined' && performance.now) ? performance.now() : 0) - t0;
    stats = buildStats({ routed, height, N, faces: mesh.faces.length, seaLevel, oceanCount, ribGeo, label, totalMs });
    stats.meshMs = +meshMs.toFixed(0);
    return { stats, seaLevel };
  }

  return {
    ribbon, route, ensureMesh, params,
    get mesh() { return mesh; }, get N() { return N; },
    get stats() { return stats; }, get seaLevel() { return seaLevel; },
    get height() { return height; }, get grad() { return grad; }, get isOcean() { return isOcean; },
    get sampler() { return sampler; },
    get carveTexture() { return carve ? carve.texture : null; },
    dispose() { if (sampler) sampler.dispose(); if (carve) carve.dispose(); ribbon.geometry.dispose(); ribbon.material.dispose(); },
  };
}
