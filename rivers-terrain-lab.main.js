// rivers-terrain-lab.main.js — RIVER ROUTER LAB (real-terrain coupling).
// Copies the proven router/ribbon pipeline from rivers-lab.html, swapping the stand-in
// heightAt()/FBM for an RTT readback of the REAL planet-LOD height field.
// AC2 (rivers-dendritic-drainage): the height GLSL + uniform defaults are now imported
// from the SHARED AC1 modules (planet-lod-height.glsl.js + planet-lod-uniforms.js) — the
// SAME source the lab planet shader consumes, so there is one h(pos). This file no longer
// fetches verbatim .txt/.js copies (rivers-terrain-height.{vert,frag}.txt +
// rivers-terrain-uniforms.js are obsolete). The router supplies its OWN main(): F11
// fluvialCombiner omitted, fwBase=0, NO F14 sea cut (routing reads real slope), output =
// vec4(h, grad). The vertex shader writes the varyings HEIGHT_GLSL declares (vPos/vObjN/
// vSubstellarAngle), faithful to the lab's own vertex shader.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ConvexHull } from 'three/addons/math/ConvexHull.js';
import { makeUniforms } from './planet-lod-uniforms.js';
import { HEIGHT_GLSL } from './planet-lod-height.glsl.js';
import { solveSeaLevel } from './planet-lod-sealevel.js';   // AC3: sea level from the live height histogram

const WORLD_LIGHT = new THREE.Vector3(0.6, 0.35, 0.7).normalize();   // lab static light dir (planet-lod-lab.html:172)

// Router vertex shader: identity clip-space (one texel per vertex), writes the three
// varyings HEIGHT_GLSL reads. vPos = the unit direction (RTT has no interpolated vPos, but
// a 1-px point needs no interpolation), matching the lab's `vPos = normalize(objN)`.
const HEIGHT_VERT = `
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
const ROUTER_MAIN = `
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
const HEIGHT_FRAG = HEIGHT_GLSL + ROUTER_MAIN;

// ───────────────────────── Params (copied from rivers-lab.html) ─────────────────────────
const TARGET_N     = 40000;
const LLOYD_ITERS  = 4;
const CHANNEL_ORDER= 2;
const MIN_ORDER    = 2;
const WIDTH_PHI    = 0.42, WIDTH_EXP = 0.69, WIDTH_SCALE = 0.00055, WIDTH_MIN = 0.0009, WIDTH_MAX = 0.018;
const CHAIKIN_ITERS= 3;
const FLAT_RESOLVE = true;
const DINF_ROUTE   = true;
const CHANNEL_FRAC = 0.06;
const LIFT         = 1.0035;
const TARGET_OCEAN_FRACTION = 0.35;   // AC3: solve uSeaLevel to this fraction (band 0.25–0.45)

// ───────────────────── Renderer / scene ───────────────────
const canvas = document.getElementById('canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias:true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x05060a);
// FloatType render targets need this extension on WebGL2 it's core; guard anyway.
const gl = renderer.getContext();
const canFloatRT = !!(gl.getExtension('EXT_color_buffer_float') || renderer.capabilities.isWebGL2);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth/window.innerHeight, 0.001, 100);
camera.position.set(0, 0, 3.2);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
scene.add(new THREE.AmbientLight(0xffffff, 1.15));   // high ambient so BOTH hemispheres read
const dirLight = new THREE.DirectionalLight(0xffffff, 0.35); dirLight.position.set(1,1,1); scene.add(dirLight);
const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.25); dirLight2.position.set(-1,-0.5,-1); scene.add(dirLight2); // fill

// ───────── irregular sphere mesh (Fibonacci + Lloyd + spherical Delaunay) ─────────
function fibonacciSphere(n) {
  const pts = new Array(n);
  const ga = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (2 * i + 1) / n;
    const r = Math.sqrt(Math.max(0, 1 - y*y));
    const phi = i * ga;
    pts[i] = new THREE.Vector3(Math.cos(phi)*r, y, Math.sin(phi)*r);
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
  const adjSet = Array.from({length:N}, () => new Set());
  for (const [a,b,c] of faces) {
    adjSet[a].add(b); adjSet[a].add(c);
    adjSet[b].add(a); adjSet[b].add(c);
    adjSet[c].add(a); adjSet[c].add(b);
  }
  return adjSet.map(s => Array.from(s));
}
function buildIrregularSphere(targetN, lloydIters) {
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
// Build the height-output ShaderMaterial (copied GLSL, F11 omitted). Pack the N mesh
// vertex unit-directions as a point cloud whose clip-space xy hits one texel each; render
// to a FloatType target (RGBA = h, grad.xyz); readback per-vertex.
const uniforms = makeUniforms(WORLD_LIGHT);
// Force a faithful WET ROCKY preset's height-relevant uniforms (Earth-like, lakes on, ~35% sea).
// Values mirror what applyDrivers()/deriveUniforms() produce for a wet Rocky in planet-lod-lab.
function configureWetRocky(seedShift) {
  uniforms.uFwClamp.value   = 0;            // CRITICAL: no screen-space octave fade in RTT
  uniforms.uNormalMode.value = 0;
  uniforms.uNoiseScale.value = 4.0;
  uniforms.uOctaves.value    = 7.0;         // closest-LOD octave count (mix(4,9) → ~7 mid)
  uniforms.uPerturb.value    = 0.55;
  uniforms.uProvinceWeight.value = 1.0;
  // seed (macro/detail domain offsets) — reseed() shifts these
  const s = seedShift || new THREE.Vector3(11.3, -4.1, 7.7);
  uniforms.uMacroOffset.value.copy(s);
  uniforms.uDetailOffset.value.set(s.x + 5.0, s.y - 5.0, s.z + 2.5);
  // Relief features for a wet Rocky:
  uniforms.uMountainAmp.value   = 0.55;     // ridged orogeny
  uniforms.uOrogenyStrength.value = 0.6;
  uniforms.uMountainScale.value = 1.6;
  uniforms.uChasmaDepth.value   = 0.25;     // a few tectonic rifts
  uniforms.uChasmaCount.value   = 2;
  uniforms.uScarpStrength.value = 0.12;
  uniforms.uPlateauStrength.value = 0.10;
  uniforms.uCraterDensity.value = 0.12;     // light cratering (old terrain)
  uniforms.uCraterAmp.value     = 0.6;
  uniforms.uEjectaStrength.value = 0.10;
  uniforms.uMassWastDensity.value = 1.0;    // talus on every solid world
  // F11 fluvial OFF (we replace it): leave uFluvialDensity = 0 (default)
  uniforms.uFluvialDensity.value = 0.0;
  // F14 sea: wet Rocky coverage ~0.35 → seaLevel = -0.2 + 0.5*0.35 ≈ -0.025
  uniforms.uSeaLevel.value = -0.025;
  uniforms.uLiquidStability.value = 1.0;
}
let seaLevel; // resolved from uSeaLevel after configure

let heightTarget = null, heightMat = null, heightPoints = null, heightScene = null, heightCam = null;
function buildHeightPass(N, verts) {
  // texel grid sized to hold N points
  const W = Math.ceil(Math.sqrt(N));
  const Hh = Math.ceil(N / W);
  // attribute: clip-space position (texel center) + unit direction
  const positions = new Float32Array(N * 3);
  const dirs = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const px = i % W, py = Math.floor(i / W);
    // texel center → clip space [-1,1]
    positions[i*3]   = ((px + 0.5) / W) * 2 - 1;
    positions[i*3+1] = ((py + 0.5) / Hh) * 2 - 1;
    positions[i*3+2] = 0;
    dirs[i*3] = verts[i][0]; dirs[i*3+1] = verts[i][1]; dirs[i*3+2] = verts[i][2];
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aDir', new THREE.BufferAttribute(dirs, 3));
  heightMat = new THREE.ShaderMaterial({
    vertexShader: HEIGHT_VERT, fragmentShader: HEIGHT_FRAG, uniforms,
    glslVersion: null,   // GLSL1 (the lab shader is ES100-style: gl_FragColor)
  });
  heightPoints = new THREE.Points(geo, heightMat);
  heightScene = new THREE.Scene();
  heightScene.add(heightPoints);
  heightCam = new THREE.Camera();   // identity; vertex shader already outputs clip space
  heightTarget = new THREE.WebGLRenderTarget(W, Hh, {
    type: THREE.FloatType, format: THREE.RGBAFormat,
    minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter,
    depthBuffer: false, stencilBuffer: false,
  });
  return { W, Hh };
}
// returns {height:Float32Array(N), grad:Float32Array(N*3)}
function readHeightRTT(N, W, Hh) {
  const prev = renderer.getRenderTarget();
  renderer.setRenderTarget(heightTarget);
  renderer.setClearColor(0x000000, 0);
  renderer.clear();
  renderer.render(heightScene, heightCam);
  const buf = new Float32Array(W * Hh * 4);
  renderer.readRenderTargetPixels(heightTarget, 0, 0, W, Hh, buf);
  renderer.setRenderTarget(prev);
  renderer.setClearColor(0x05060a);
  const height = new Float32Array(N), grad = new Float32Array(N*3);
  for (let i = 0; i < N; i++) {
    height[i]  = buf[i*4];
    grad[i*3]  = buf[i*4+1]; grad[i*3+1] = buf[i*4+2]; grad[i*3+2] = buf[i*4+3];
  }
  return { height, grad };
}

// ───────────────────── Build mesh (cached; terrain-independent) ──────────────────
const tMesh0 = performance.now();
const mesh0 = buildIrregularSphere(TARGET_N, LLOYD_ITERS);
const { verts, faces, adj } = mesh0;
const N = verts.length;
const meshMs = (performance.now() - tMesh0).toFixed(0);
const pos = new Float32Array(N*3);
for (let i=0;i<N;i++){ pos[i*3]=verts[i][0]; pos[i*3+1]=verts[i][1]; pos[i*3+2]=verts[i][2]; }

configureWetRocky();
const { W, Hh } = buildHeightPass(N, verts);

// valence sanity
let valMin=Infinity, valMax=0, valSum=0; const valHist={};
for (let i=0;i<N;i++){ const v=adj[i].length; valMin=Math.min(valMin,v); valMax=Math.max(valMax,v); valSum+=v; valHist[v]=(valHist[v]||0)+1; }
const valMean = valSum/N;

// Mutable terrain state (re-read on reseed/setSeaLevel)
let height = new Float32Array(N), grad = new Float32Array(N*3);
let isOcean = new Uint8Array(N), oceanCount = 0;

// ═══════════════════════ ROUTING + RIBBON PIPELINE (copied) ═══════════════════════
// All of S1/S2/S3 from rivers-lab.html, parameterised on the current height/isOcean arrays.
function median(arr){ if(!arr.length) return 0; const a=arr.slice().sort((x,y)=>x-y); const m=a.length>>1;
  return a.length%2? a[m] : (a[m-1]+a[m])/2; }

function resolveSea() {
  seaLevel = uniforms.uSeaLevel.value;
  isOcean = new Uint8Array(N); oceanCount = 0;
  for (let i=0;i<N;i++){ if (height[i] < seaLevel){ isOcean[i]=1; oceanCount++; } }
}

function priorityFlood() {
  const filled = Float32Array.from(height);
  const closed = new Uint8Array(N);
  const heapE = []; const heapI = [];
  function push(e,i){ heapE.push(e); heapI.push(i); let c=heapE.length-1;
    while(c>0){ const p=(c-1)>>1; if(heapE[p]<=heapE[c])break; [heapE[p],heapE[c]]=[heapE[c],heapE[p]]; [heapI[p],heapI[c]]=[heapI[c],heapI[p]]; c=p; } }
  function pop(){ const e=heapE[0], i=heapI[0]; const le=heapE.pop(), li=heapI.pop();
    if(heapE.length){ heapE[0]=le; heapI[0]=li; let c=0; const n=heapE.length;
      for(;;){ let l=2*c+1,r=2*c+2,s=c; if(l<n&&heapE[l]<heapE[s])s=l; if(r<n&&heapE[r]<heapE[s])s=r; if(s===c)break;
        [heapE[s],heapE[c]]=[heapE[c],heapE[s]]; [heapI[s],heapI[c]]=[heapI[c],heapI[s]]; c=s; } }
    return [e,i]; }
  for (let i=0;i<N;i++){ if(isOcean[i]){ closed[i]=1; push(filled[i], i); } }
  while (heapE.length){
    const [, c] = pop();
    for (const nb of adj[c]){
      if (closed[nb]) continue;
      closed[nb]=1;
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
  const hiSeed=[], loSeed=[];
  for (let i=0;i<N;i++){
    if (isOcean[i]) continue;
    let hasLower=false, adjHigher=false, adjLower=false;
    for (const nb of adj[i]){
      if (filled[nb] < filled[i]-FLATEPS) { hasLower=true; adjLower=true; }
      else if (filled[nb] > filled[i]+FLATEPS) adjHigher=true;
    }
    if (!hasLower) isFlat[i]=1;
    if (adjHigher) hiSeed.push(i);
    if (adjLower)  loSeed.push(i);
  }
  const flatEdge=(a,b)=> isFlat[a] && Math.abs(filled[a]-filled[b])<=FLATEPS;
  function bfs(seeds){
    const dist=new Int32Array(N).fill(-1); const q=[];
    for (const s of seeds){ if(isFlat[s]){ dist[s]=0; q.push(s); } }
    let h=0;
    while(h<q.length){ const c=q[h++]; for(const nb of adj[c]){ if(isFlat[nb]&&dist[nb]<0&&flatEdge(c,nb)){ dist[nb]=dist[c]+1; q.push(nb); } } }
    return dist;
  }
  const dLow = bfs(loSeed.filter(i=>isFlat[i]));
  const dHigh= bfs(hiSeed.filter(i=>isFlat[i]));
  const GSCALE = 5e-7;
  for (let i=0;i<N;i++){
    if (!isFlat[i]) continue;
    const dl = dLow[i] >=0 ? dLow[i] : 0;
    const dh = dHigh[i]>=0 ? dHigh[i] : 0;
    gradOff[i] = GSCALE * (dl - 0.5*dh);
  }
  return gradOff;
}

// FULL route+order+metrics. Returns a bundle. (No mesh rebuild — that is cached.)
function routeAndOrder() {
  const filled = priorityFlood();
  const gradOff = computeGradOff(filled);
  const surf = (i)=> filled[i] + gradOff[i];
  const receiver = new Int32Array(N).fill(-1);
  const _a = new THREE.Vector3(), _b = new THREE.Vector3();
  for (let i=0;i<N;i++){
    if (isOcean[i]) { receiver[i] = i; continue; }
    const si = surf(i);
    let best=-1;
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
      for (const nb of adj[i]){ if (surf(nb) < bestE){ bestE=surf(nb); best=nb; } }
    }
    receiver[i] = best === -1 ? i : best;
  }
  const order = Array.from({length:N}, (_,i)=>i).sort((a,b)=> surf(b)-surf(a));
  const accum = Float32Array.from({length:N}, ()=>1);
  for (const i of order){ const r = receiver[i]; if (r !== i) accum[r] += accum[i]; }

  // orphans + uphill
  let landCount=0, uphill=0, orphan=0, selfLoopLand=0;
  const visitState = new Int8Array(N);
  function reachesOcean(start){
    const path=[]; let c=start, guard=0;
    while(true){
      if (isOcean[c]) { for(const p of path) visitState[p]=1; return true; }
      if (visitState[c]===1){ for(const p of path) visitState[p]=1; return true; }
      if (visitState[c]===2){ for(const p of path) visitState[p]=2; return false; }
      if (path.includes(c) || guard++ > N+5){ for(const p of path) visitState[p]=2; return false; }
      path.push(c);
      const r = receiver[c];
      if (r === c){ for(const p of path) visitState[p]=2; return false; }
      c = r;
    }
  }
  for (let i=0;i<N;i++){
    if (isOcean[i]) continue;
    landCount++;
    if (receiver[i]===i) selfLoopLand++;
    if (receiver[i]!==i && surf(receiver[i]) > surf(i)+1e-9) uphill++;
    if (!reachesOcean(i)) orphan++;
  }

  // Strahler
  const strahler = new Int32Array(N).fill(0);
  const childMaxOrd = new Int32Array(N).fill(0);
  const childMaxCnt = new Int32Array(N).fill(0);
  const hasChild    = new Uint8Array(N);
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
  for (let i=0;i<N;i++){ if(!isOcean[i] && strahler[i] >= CHANNEL_ORDER){ isChannel[i]=1; channelCount++; } }

  let maxOrder = 0; const orderHist = {};
  for (let i=0;i<N;i++){ if(isOcean[i]) continue; const o=strahler[i]; if(o>maxOrder)maxOrder=o; orderHist[o]=(orderHist[o]||0)+1; }
  const streamCount = {};
  for (let i=0;i<N;i++){
    if(isOcean[i]) continue;
    const o = strahler[i]; const r = receiver[i];
    const ro = (r!==i && !isOcean[r]) ? strahler[r] : -1;
    if (ro !== o) streamCount[o] = (streamCount[o]||0) + 1;
  }
  let rbSum=0, rbN=0;
  for (let w=1; w<maxOrder-1; w++){ const a=streamCount[w]||0, b=streamCount[w+1]||0; if (a>0 && b>0){ rbSum += a/b; rbN++; } }
  const bifurcationRatioTrimmed = rbN ? +(rbSum/rbN).toFixed(2) : 0;
  let sx=0, sy=0, sxx=0, sxy=0, sn=0;
  for (let w=1; w<=maxOrder; w++){ const c = streamCount[w]||0; if (c<1) continue; const x=w, y=Math.log(c); sx+=x; sy+=y; sxx+=x*x; sxy+=x*y; sn++; }
  const slope = sn>1 ? (sn*sxy - sx*sy)/(sn*sxx - sx*sx) : 0;
  const bifurcationRatio = sn>1 ? +Math.exp(-slope).toFixed(2) : bifurcationRatioTrimmed;

  // river-scale straightness
  const DEG2=2*Math.PI/180;
  function chordDir(i,j){ let ex=verts[j][0]-verts[i][0], ey=verts[j][1]-verts[i][1], ez=verts[j][2]-verts[i][2];
    const L=Math.hypot(ex,ey,ez); return L<1e-10?null:[ex/L,ey/L,ez/L]; }
  function scaleStraightness(STEP){
    const turns=[]; let bends=0, coll=0;
    for(let s=0;s<N;s++){
      if(!isChannel[s])continue;
      let isHead=true; for(const nb of adj[s]){ if(isChannel[nb]&&receiver[nb]===s){isHead=false;break;} }
      if(!isHead)continue;
      const path=[]; let c=s,g=0;
      while(isChannel[c]&&g++<200000){ path.push(c); const r=receiver[c]; if(r===c||!isChannel[r])break; c=r; }
      const dirs=[];
      for(let k=0;k+STEP<path.length;k+=STEP){ const d=chordDir(path[k],path[k+STEP]); if(d)dirs.push(d); }
      for(let k=1;k<dirs.length;k++){
        let cc=dirs[k-1][0]*dirs[k][0]+dirs[k-1][1]*dirs[k][1]+dirs[k-1][2]*dirs[k][2];
        cc=Math.max(-1,Math.min(1,cc)); const t=Math.acos(cc);
        turns.push(t); bends++; if(t<DEG2)coll++;
      }
    }
    turns.sort((a,b)=>a-b);
    return { STEP, bends, nearCollinearPct: bends?+(100*coll/bends).toFixed(2):0,
             medianTurnDeg: bends?+(turns[turns.length>>1]*180/Math.PI).toFixed(2):0 };
  }
  const riverScale = scaleStraightness(3);
  const riverScale6 = scaleStraightness(6);

  return { filled, surf, receiver, accum, order, strahler, isChannel, channelCount,
    landCount, uphill, orphan, selfLoopLand, maxOrder, orderHist, streamCount,
    bifurcationRatio, bifurcationRatioTrimmed, riverScale, riverScale6 };
}

// ───────────── Base sphere render shaded by REAL h + grad-perturbed normal ─────────────
let baseMesh = null;
function buildBaseGeometry(routed) {
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(N*3);
  const colors = new Float32Array(N*3);
  const normals = new Float32Array(N*3);
  const cOcean = new THREE.Color(0x0a2a4d);
  const cShallow= new THREE.Color(0x12466e);
  const cBeach = new THREE.Color(0x6b6147);
  const cLandLo= new THREE.Color(0x3c4a2c);
  const cLandMid=new THREE.Color(0x6b6450);
  const cLandHi= new THREE.Color(0xcfcabc);
  // elevation ramp over land range
  let hMin=Infinity, hMax=-Infinity;
  for (let i=0;i<N;i++){ if(height[i]<hMin)hMin=height[i]; if(height[i]>hMax)hMax=height[i]; }
  const _n = new THREE.Vector3(), _g = new THREE.Vector3();
  for (let i=0;i<N;i++){
    positions[i*3]=pos[i*3]; positions[i*3+1]=pos[i*3+1]; positions[i*3+2]=pos[i*3+2];
    // perturbed normal from REAL grad (tangent component), so mountains/craters catch light
    _n.set(pos[i*3],pos[i*3+1],pos[i*3+2]);
    _g.set(grad[i*3],grad[i*3+1],grad[i*3+2]);
    const gTan = _g.clone().sub(_n.clone().multiplyScalar(_g.dot(_n)));
    const pn = _n.clone().sub(gTan.multiplyScalar(0.35)).normalize();
    normals[i*3]=pn.x; normals[i*3+1]=pn.y; normals[i*3+2]=pn.z;
    let c;
    if (isOcean[i]) {
      const depth = THREE.MathUtils.clamp((seaLevel - height[i]) / (seaLevel - hMin + 1e-6), 0, 1);
      c = cShallow.clone().lerp(cOcean, depth);
    } else {
      const t = THREE.MathUtils.clamp((height[i]-seaLevel)/(hMax-seaLevel+1e-6), 0, 1);
      c = t < 0.04 ? cBeach.clone().lerp(cLandLo, t/0.04)
        : t < 0.5  ? cLandLo.clone().lerp(cLandMid, (t-0.04)/0.46)
        :            cLandMid.clone().lerp(cLandHi, (t-0.5)/0.5);
    }
    colors[i*3]=c.r; colors[i*3+1]=c.g; colors[i*3+2]=c.b;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(positions,3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors,3));
  geo.setAttribute('normal', new THREE.BufferAttribute(normals,3));
  const faceIdx = new Uint32Array(faces.length*3);
  for (let f=0;f<faces.length;f++){ faceIdx[f*3]=faces[f][0]; faceIdx[f*3+1]=faces[f][1]; faceIdx[f*3+2]=faces[f][2]; }
  geo.setIndex(new THREE.BufferAttribute(faceIdx,1));
  return geo;
}

// ───────────── ribbon build (copied from rivers-lab.html) ─────────────
function buildRibbonGeometry(routed) {
  const { receiver, accum, strahler, maxOrder, isChannel } = routed;
  const rendered = new Uint8Array(N);
  for (let i=0;i<N;i++) if (isChannel[i] && strahler[i] >= MIN_ORDER) rendered[i]=1;
  const widthAt = (i) => {
    const phiW = WIDTH_PHI * Math.pow(accum[i], WIDTH_EXP);
    return THREE.MathUtils.clamp(WIDTH_SCALE * phiW, WIDTH_MIN, WIDTH_MAX);
  };
  const cOrd = (o) => {
    const t = THREE.MathUtils.clamp((o - MIN_ORDER) / Math.max(1, maxOrder - MIN_ORDER), 0, 1);
    return new THREE.Color(0x2a5cff).lerp(new THREE.Color(0x8ffaff), t);
  };
  function chaikin(pts, iters){
    let cur = pts;
    for (let it=0; it<iters; it++){
      if (cur.length < 3) break;
      const out = [cur[0]];
      for (let k=0; k<cur.length-1; k++){
        const a=cur[k], b=cur[k+1];
        const mk=(t)=>{
          const v=new THREE.Vector3(a.p[0]+(b.p[0]-a.p[0])*t, a.p[1]+(b.p[1]-a.p[1])*t, a.p[2]+(b.p[2]-a.p[2])*t).normalize().multiplyScalar(LIFT);
          return { p:[v.x,v.y,v.z], w:a.w+(b.w-a.w)*t, c:a.c.clone().lerp(b.c,t) };
        };
        out.push(mk(0.25), mk(0.75));
      }
      out.push(cur[cur.length-1]);
      cur = out;
    }
    return cur;
  }
  const heads=[];
  for (let i=0;i<N;i++){
    if(!rendered[i]) continue;
    let isHead=true;
    for(const nb of adj[i]){ if(rendered[nb] && receiver[nb]===i){ isHead=false; break; } }
    if(isHead) heads.push(i);
  }
  const ribPos = [], ribCol = [], ribIdx = []; let vBase = 0;
  const drawn = new Uint8Array(N);
  const up=new THREE.Vector3(), fwd=new THREE.Vector3(), side=new THREE.Vector3();
  function emitRibbon(spts){
    if (spts.length < 2) return;
    const P = spts.map(s=>new THREE.Vector3(s.p[0],s.p[1],s.p[2]));
    for (let k=0;k<spts.length;k++){
      const cur=P[k];
      fwd.set(0,0,0);
      if (k>0) fwd.add(cur.clone().sub(P[k-1]));
      if (k<spts.length-1) fwd.add(P[k+1].clone().sub(cur));
      up.copy(cur).normalize();
      fwd.sub(up.clone().multiplyScalar(fwd.dot(up)));
      if (fwd.lengthSq()<1e-14) fwd.set(up.y,up.z,up.x);
      fwd.normalize();
      side.crossVectors(up, fwd).normalize().multiplyScalar(spts[k].w);
      const L = cur.clone().sub(side), R = cur.clone().add(side);
      const c = spts[k].c;
      ribPos.push(L.x,L.y,L.z, R.x,R.y,R.z);
      ribCol.push(c.r,c.g,c.b, c.r,c.g,c.b);
      if (k>0){ const b0=vBase+(k-1)*2, b1=vBase+k*2; ribIdx.push(b0,b0+1,b1, b0+1,b1+1,b1); }
    }
    vBase += spts.length*2;
  }
  function pathFrom(start){
    const raw=[]; let c=start, g=0;
    while (rendered[c] && g++ < 200000){
      raw.push(c);
      if (drawn[c]) break;
      drawn[c]=1;
      const r=receiver[c];
      if (r===c || !rendered[r]){ if (r!==c) raw.push(r); break; }
      c=r;
    }
    return raw;
  }
  function buildAndEmit(start){
    const raw = pathFrom(start);
    if (raw.length < 2) return;
    const pts = raw.map(idx=>({ p:[pos[idx*3]*LIFT, pos[idx*3+1]*LIFT, pos[idx*3+2]*LIFT],
                                w:widthAt(idx), c:cOrd(strahler[idx]||MIN_ORDER) }));
    emitRibbon(chaikin(pts, CHAIKIN_ITERS));
  }
  for (const h of heads) buildAndEmit(h);
  for (let i=0;i<N;i++){ if(rendered[i] && !drawn[i]) buildAndEmit(i); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(ribPos,3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(ribCol,3));
  g.setIndex(ribIdx); g.computeVertexNormals();
  g.userData.renderedCount = rendered.reduce((a,b)=>a+b,0);
  return g;
}

// ═══════════════════════ FULL REGEN (route + render) ═══════════════════════
let ribbon = null, lastStats = null;
function regenFromHeight(label) {
  const t0 = performance.now();
  resolveSea();
  const tRoute0 = performance.now();
  const routed = routeAndOrder();
  const routeMs = performance.now() - tRoute0;
  // base mesh
  if (baseMesh){ scene.remove(baseMesh); baseMesh.geometry.dispose(); }
  baseMesh = new THREE.Mesh(buildBaseGeometry(routed),
    new THREE.MeshStandardMaterial({ vertexColors:true, roughness:1, metalness:0, flatShading:false }));
  scene.add(baseMesh);
  // ribbon
  if (ribbon){ scene.remove(ribbon); ribbon.geometry.dispose(); }
  const ribGeo = buildRibbonGeometry(routed);
  ribbon = new THREE.Mesh(ribGeo, new THREE.MeshBasicMaterial({ vertexColors:true, side:THREE.DoubleSide }));
  scene.add(ribbon);
  const totalMs = performance.now() - t0;

  // C1 height sanity
  let hmin=Infinity, hmax=-Infinity, nan=0; const hs=[];
  for (let i=0;i<N;i++){ const v=height[i]; if(!Number.isFinite(v))nan++; else { if(v<hmin)hmin=v; if(v>hmax)hmax=v; hs.push(v); } }
  hs.sort((a,b)=>a-b);
  const hmed = hs.length? hs[hs.length>>1] : 0;

  lastStats = {
    label: label||'build', N, faces: faces.length,
    meshMs:+meshMs, routeMs:+routeMs.toFixed(1), totalMs:+totalMs.toFixed(1),
    // C1
    seaLevel:+seaLevel.toFixed(4), oceanFrac:+(oceanCount/N).toFixed(3), oceanPct:+(100*oceanCount/N).toFixed(1),
    hMin:+hmin.toFixed(4), hMax:+hmax.toFixed(4), hMedian:+hmed.toFixed(4), nanCount:nan,
    // C2
    orphanPct:+(100*routed.orphan/routed.landCount).toFixed(3),
    uphillPct:+(100*routed.uphill/routed.landCount).toFixed(3),
    selfLoopLand: routed.selfLoopLand,
    maxStrahler: routed.maxOrder, bifurcationRatio: routed.bifurcationRatio,
    bifurcationRatioTrimmed: routed.bifurcationRatioTrimmed,
    riverTurnMedianDeg: routed.riverScale.medianTurnDeg, riverNearCollinearPct: routed.riverScale.nearCollinearPct,
    riverScale6TurnDeg: routed.riverScale6.medianTurnDeg,
    channelCount: routed.channelCount, renderedCount: ribGeo.userData.renderedCount,
    orderHist: routed.orderHist, streamCount: routed.streamCount,
    // valence
    valMin, valMax, valMean:+valMean.toFixed(3),
  };
  updateHUD();
  console.log('[rivers-terrain]', label||'build', lastStats);
  return lastStats;
}

// AC3: solve uSeaLevel from the CURRENT read-back heights (inverse-CDF to the target ocean
// fraction), replacing the FBM-era coverage formula. Called after every terrain re-read so a
// reseed/terrain change re-solves the sea per planet. Returns the solved threshold.
let lastTargetFrac = TARGET_OCEAN_FRACTION;
function solveSeaFromHeight(targetFrac = lastTargetFrac) {
  lastTargetFrac = targetFrac;
  const T = solveSeaLevel(height, targetFrac);
  uniforms.uSeaLevel.value = T;
  return T;
}

// initial: read RTT, solve sea from the histogram, then full regen
let fullBuildMs = '0';
const tBuild0 = performance.now();
let { height: h0, grad: g0 } = readHeightRTT(N, W, Hh);
height = h0; grad = g0;
solveSeaFromHeight();
regenFromHeight('build');
fullBuildMs = (performance.now() - tBuild0).toFixed(1);
lastStats.fullBuildMs = +fullBuildMs;

function updateHUD(){
  const s = lastStats;
  document.getElementById('hud').textContent =
    `REAL terrain (RTT FloatType) | F11 OFF | floatRT ${canFloatRT}\n`+
    `verts ${N} | faces ${faces.length} | mesh ${meshMs}ms | fullBuild ${s.fullBuildMs||fullBuildMs}ms\n`+
    `C1 h [${s.hMin}, ${s.hMax}] med ${s.hMedian} | NaN ${s.nanCount}\n`+
    `C1 sea ${s.seaLevel} → ocean ${s.oceanPct}%\n`+
    `C2 orphans ${s.orphanPct}% | uphill ${s.uphillPct}% | selfLoop ${s.selfLoopLand}\n`+
    `C2 maxStrahler ${s.maxStrahler} | R_b ${s.bifurcationRatio} (trim ${s.bifurcationRatioTrimmed})\n`+
    `C2 river medTurn ${s.riverTurnMedianDeg}° | collinear<2° ${s.riverNearCollinearPct}%\n`+
    `channels ${s.channelCount} | rendered ${s.renderedCount} (order≥${MIN_ORDER})\n`+
    `C4 lastRoute ${s.routeMs}ms | lastTotal ${s.totalMs}ms`;
}
updateHUD();

// ─────────────────────── console handles (C4) ───────────────
window._rivers = {
  THREE, verts, pos, faces, adj,
  get height(){ return height; }, get grad(){ return grad; }, get isOcean(){ return isOcean; },
  get stats(){ return lastStats; }, uniforms,
  lookFrom(x,y,z,d){ const r=d||3.2; camera.position.set(x*r,y*r,z*r); controls.target.set(0,0,0); controls.update(); },
  // C4: re-read height via RTT + re-route + re-ribbon WITHOUT rebuilding the mesh.
  // setSeaLevel = MANUAL override (does NOT re-solve from the histogram).
  setSeaLevel(v){
    uniforms.uSeaLevel.value = v;
    const r = readHeightRTT(N, W, Hh); height = r.height; grad = r.grad;
    return regenFromHeight('setSeaLevel '+v);
  },
  // AC3: re-solve uSeaLevel from the current histogram to a target ocean fraction, re-route.
  solveSea(targetFrac){
    solveSeaFromHeight(targetFrac);
    return regenFromHeight('solveSea '+(targetFrac ?? lastTargetFrac));
  },
  reseed(n){
    const k = (n||1) * 13.0;
    configureWetRocky(new THREE.Vector3(11.3 + k, -4.1 - k*0.7, 7.7 + k*0.3));
    const r = readHeightRTT(N, W, Hh); height = r.height; grad = r.grad;
    solveSeaFromHeight();   // AC3: re-solve the sea for the new terrain
    return regenFromHeight('reseed '+(n||1));
  },
  // re-read only (no seed change) — re-solves the sea, then re-routes.
  rereadAndRoute(){
    const r = readHeightRTT(N, W, Hh); height = r.height; grad = r.grad;
    solveSeaFromHeight();
    return regenFromHeight('reread');
  },
  TARGET_OCEAN_FRACTION,
};
window.__riversTerrainReady = true;

addEventListener('resize', ()=>{ camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth,innerHeight); });
function tick(){ controls.update(); renderer.render(scene,camera); requestAnimationFrame(tick); }
tick();
