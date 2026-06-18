// rivers-terrain-lab.main.js — RIVER ROUTER LAB (real-terrain coupling).
// AC2/AC3 reference harness. As of AC4 the routing/ribbon pipeline lives in the SHARED module
// planet-lod-rivers.js (createRiverOverlay) — the SAME module planet-lod-lab.html consumes, so
// there is one source of the router/ribbon pipeline (no more two drifting copies, the AC1
// rationale applied to the pipeline). This file keeps ONLY the lab glue: the base-sphere viz
// shaded by the real h+grad, the HUD, and the window._rivers console handles. The overlay binds
// this lab's OWN uniforms (makeUniforms + configureWetRocky forces a wet Rocky preset, since the
// router lab has no GUI), reading the height field at uOctaves=7 (matching the old pin) so the
// stats are a zero-drift regression check against the committed AC2/AC3 record.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { makeUniforms } from './planet-lod-uniforms.js';
import { createRiverOverlay } from './planet-lod-rivers.js';

const WORLD_LIGHT = new THREE.Vector3(0.6, 0.35, 0.7).normalize();   // lab static light dir (planet-lod-lab.html:172)

// ───────────────────── Renderer / scene ───────────────────
const canvas = document.getElementById('canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias:true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x05060a);
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

// ───────── uniforms: force a faithful WET ROCKY preset (Earth-like, lakes on, ~35% sea) ─────────
// Values mirror what applyDrivers()/deriveUniforms() produce for a wet Rocky in planet-lod-lab.
const uniforms = makeUniforms(WORLD_LIGHT);
function configureWetRocky(seedShift) {
  uniforms.uFwClamp.value   = 0;            // no screen-space octave fade in RTT (the sampler also pins this)
  uniforms.uNormalMode.value = 0;
  uniforms.uNoiseScale.value = 4.0;
  uniforms.uOctaves.value    = 7.0;         // closest-LOD octave count (the sampler reads at octavesDuringRead=7)
  uniforms.uPerturb.value    = 0.55;
  uniforms.uProvinceWeight.value = 1.0;
  const s = seedShift || new THREE.Vector3(11.3, -4.1, 7.7);
  uniforms.uMacroOffset.value.copy(s);
  uniforms.uDetailOffset.value.set(s.x + 5.0, s.y - 5.0, s.z + 2.5);
  uniforms.uMountainAmp.value   = 0.55;
  uniforms.uOrogenyStrength.value = 0.6;
  uniforms.uMountainScale.value = 1.6;
  uniforms.uChasmaDepth.value   = 0.25;
  uniforms.uChasmaCount.value   = 2;
  uniforms.uScarpStrength.value = 0.12;
  uniforms.uPlateauStrength.value = 0.10;
  uniforms.uCraterDensity.value = 0.12;
  uniforms.uCraterAmp.value     = 0.6;
  uniforms.uEjectaStrength.value = 0.10;
  uniforms.uMassWastDensity.value = 1.0;
  uniforms.uFluvialDensity.value = 0.0;     // F11 OFF (the overlay replaces it)
  uniforms.uSeaLevel.value = -0.025;        // overridden by the histogram solve, kept for the 'live' fallback
  uniforms.uLiquidStability.value = 1.0;
}
configureWetRocky();

// ───────── the shared overlay (mesh + RTT sampler + routing + ribbon, all in the module) ─────────
const overlay = createRiverOverlay({ renderer, uniforms, octavesDuringRead: 7 });
scene.add(overlay.ribbon);

// ───────────── Base sphere render shaded by REAL h + grad-perturbed normal (lab viz) ─────────────
let baseMesh = null;
function buildBaseGeometry() {
  const { verts, faces, pos, N } = overlay.mesh;
  const height = overlay.height, grad = overlay.grad, isOcean = overlay.isOcean, seaLevel = overlay.seaLevel;
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
  let hMin=Infinity, hMax=-Infinity;
  for (let i=0;i<N;i++){ if(height[i]<hMin)hMin=height[i]; if(height[i]>hMax)hMax=height[i]; }
  const _n = new THREE.Vector3(), _g = new THREE.Vector3();
  for (let i=0;i<N;i++){
    positions[i*3]=pos[i*3]; positions[i*3+1]=pos[i*3+1]; positions[i*3+2]=pos[i*3+2];
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

// ═══════════════════════ regen (route via module + rebuild base + HUD) ═══════════════════════
let lastStats = null;
function regen(label, routeOpts) {
  const { stats } = overlay.route({ label, ...(routeOpts||{}) });
  lastStats = stats;
  if (baseMesh){ scene.remove(baseMesh); baseMesh.geometry.dispose(); }
  baseMesh = new THREE.Mesh(buildBaseGeometry(),
    new THREE.MeshStandardMaterial({ vertexColors:true, roughness:1, metalness:0, flatShading:false }));
  scene.add(baseMesh);
  updateHUD();
  console.log('[rivers-terrain]', label||'build', lastStats);
  return lastStats;
}

// initial build: route (histogram sea) + base + HUD
regen('build');

function updateHUD(){
  const s = lastStats;
  document.getElementById('hud').textContent =
    `REAL terrain (RTT FloatType, shared module) | F11 OFF | floatRT ${canFloatRT}\n`+
    `verts ${s.N} | faces ${s.faces} | mesh ${s.meshMs}ms | build ${s.totalMs}ms\n`+
    `C1 h [${s.hMin}, ${s.hMax}] med ${s.hMedian} | NaN ${s.nanCount}\n`+
    `C1 sea ${s.seaLevel} → ocean ${s.oceanPct}%\n`+
    `C2 orphans ${s.orphanPct}% | uphill ${s.uphillPct}% | selfLoop ${s.selfLoopLand}\n`+
    `C2 maxStrahler ${s.maxStrahler} | R_b ${s.bifurcationRatio} (trim ${s.bifurcationRatioTrimmed})\n`+
    `C2 river medTurn ${s.riverTurnMedianDeg}° | collinear<2° ${s.riverNearCollinearPct}%\n`+
    `channels ${s.channelCount} | rendered ${s.renderedCount}\n`+
    `C4 lastBuild ${s.totalMs}ms`;
}
updateHUD();

// ─────────────────────── console handles (C4) ───────────────
window._rivers = {
  THREE, overlay, uniforms,
  get mesh(){ return overlay.mesh; },
  get height(){ return overlay.height; }, get grad(){ return overlay.grad; }, get isOcean(){ return overlay.isOcean; },
  get stats(){ return lastStats; },
  lookFrom(x,y,z,d){ const r=d||3.2; camera.position.set(x*r,y*r,z*r); controls.target.set(0,0,0); controls.update(); },
  // MANUAL sea override (does NOT re-solve from the histogram): set the uniform + route 'live'.
  setSeaLevel(v){ uniforms.uSeaLevel.value = v; return regen('setSeaLevel '+v, { seaMode:'live' }); },
  // AC3: re-solve uSeaLevel from the current histogram to a target ocean fraction, re-route.
  solveSea(targetFrac){ return regen('solveSea '+(targetFrac ?? overlay.params.TARGET_OCEAN_FRACTION), { seaMode:'histogram', targetFraction: targetFrac }); },
  reseed(n){
    const k = (n||1) * 13.0;
    configureWetRocky(new THREE.Vector3(11.3 + k, -4.1 - k*0.7, 7.7 + k*0.3));
    return regen('reseed '+(n||1), { seaMode:'histogram' });
  },
  // re-read only (no seed change) — re-solves the sea, then re-routes.
  rereadAndRoute(){ return regen('reread', { seaMode:'histogram' }); },
  get TARGET_OCEAN_FRACTION(){ return overlay.params.TARGET_OCEAN_FRACTION; },
};
window.__riversTerrainReady = true;

addEventListener('resize', ()=>{ camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth,innerHeight); });
function tick(){ controls.update(); renderer.render(scene,camera); requestAnimationFrame(tick); }
tick();
