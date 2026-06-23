// world-engine-relief-lab.main.js — harness glue only (viz + controls). Pure compute lives in relief-*.js.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GUI } from 'lil-gui';
import { runReliefSlice, verifyReliefSlice } from './relief-slice.js';
import { PRESETS } from './relief-presets.js';

const canvas = document.getElementById('canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x05060a);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.001, 100);
camera.position.set(0, 1.4, 1.8);
const controls = new OrbitControls(camera, canvas); controls.enableDamping = true;
scene.add(new THREE.AmbientLight(0xffffff, 0.8));
const dir = new THREE.DirectionalLight(0xffffff, 1.0); dir.position.set(1, 1.5, 0.8); scene.add(dir);

const state = { preset: 'rocky', res: 192, epoch2: true, overprint: false, seed: 'lab' };
let mesh = null, result = null;

function buildMesh(r) {
  if (mesh) { scene.remove(mesh); mesh.geometry.dispose(); mesh.material.dispose(); }
  const { n } = r.substrate; const h = r.substrate.height; const st = r.substrate.standing;
  const accum = r.substrate.flowAccum;
  const geo = new THREE.PlaneGeometry(2, 2, n - 1, n - 1);
  const pos = geo.attributes.position; const col = new Float32Array(n * n * 3);
  let hMin = Infinity, hMax = -Infinity; for (const v of h) { if (v < hMin) hMin = v; if (v > hMax) hMax = v; }
  const aMax = Math.max(1, Math.max(...accum));
  const cLow = new THREE.Color(0x3c4a2c), cMid = new THREE.Color(0x6b6450), cHi = new THREE.Color(0xcfcabc);
  const cSea = new THREE.Color(0x0a2a4d), cRiv = new THREE.Color(0x2f6fb0);
  for (let i = 0; i < n * n; i++) {
    pos.setZ(i, (h[i] - (hMin + hMax) / 2) * 0.6);                   // displacement
    let c;
    if (st[i]) c = cSea;
    else { const t = THREE.MathUtils.clamp((h[i] - hMin) / (hMax - hMin + 1e-6), 0, 1);
           c = t < 0.5 ? cLow.clone().lerp(cMid, t / 0.5) : cMid.clone().lerp(cHi, (t - 0.5) / 0.5); }
    const riv = Math.min(1, Math.log(1 + accum[i]) / Math.log(1 + aMax));   // channel tint on big-accum cells
    if (!st[i] && riv > 0.6) c = c.clone().lerp(cRiv, (riv - 0.6) / 0.4);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals(); geo.rotateX(-Math.PI / 2);
  mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }));
  scene.add(mesh);
  drawMini(r);
}

// 2D drainage map (channels black, water blue, land grey) — drainage legibility.
function drawMini(r) {
  const mini = document.getElementById('mini'); const ctx = mini.getContext('2d');
  const { n } = r.substrate; const img = ctx.createImageData(n, n);
  const accum = r.substrate.flowAccum; const aMax = Math.max(1, Math.max(...accum)); const st = r.substrate.standing;
  mini.width = n; mini.height = n;
  for (let i = 0; i < n * n; i++) {
    const riv = Math.log(1 + accum[i]) / Math.log(1 + aMax); let R, G, B;
    if (st[i]) { R = 20; G = 60; B = 120; } else if (riv > 0.55) { const k = (1 - riv) * 255; R = G = B = k; B = 120; }
    else { R = G = B = 120; }
    img.data[i * 4] = R; img.data[i * 4 + 1] = G; img.data[i * 4 + 2] = B; img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

function regen() {
  result = runReliefSlice(PRESETS[state.preset], {
    n: state.res, seed: state.seed, epoch2: state.epoch2,
    overprint: state.overprint ? { rotatePoleDeg: 35, blend: 0.4 } : undefined,
  });
  buildMesh(result);
  const v = verifyReliefSlice(result);
  document.getElementById('hud').textContent =
    `preset ${state.preset} | ${state.res}² | epoch2 ${state.epoch2} | overprint ${state.overprint}\n` +
    `E9 = CPU BAKE REFERENCE (not per-frame) | passes ${result.e9 ? result.e9.passes : '-'}\n` +
    `verify pass=${v.pass} | subtractive ${v.signals.subtractive} | carve∝relief ${v.signals.carveCorrelatesRelief}\n` +
    `noUphill ${v.signals.noUphill} | depFilled ${v.signals.depressionsFilled} | Hack h=${v.signals.hackExponent.toFixed(3)}\n` +
    `accum max/mean ${v.detail.maxA.toFixed(0)}/${v.detail.meanA.toFixed(2)} | hiCut ${v.detail.hiCut.toFixed(4)} loCut ${v.detail.loCut.toFixed(4)}`;
  return v;
}

const gui = new GUI();
gui.add(state, 'preset', Object.keys(PRESETS)).onChange(regen);
gui.add(state, 'res', { '128': 128, '192': 192, '256': 256 }).onChange(v => { state.res = +v; regen(); });
gui.add(state, 'epoch2').name('epoch 2 (carve)').onChange(regen);
gui.add(state, 'overprint').name('E6 overprint').onChange(regen);
gui.add({ reseed: () => { state.seed = 'lab' + Math.floor(performance.now()); regen(); } }, 'reseed');

window._relief = {
  THREE, get result() { return result; },
  regen, verifySlice: () => verifyReliefSlice(result),
  setPreset: (p) => { state.preset = p; return regen(); },
  setEpoch2: (b) => { state.epoch2 = !!b; return regen(); },
  setRes: (n) => { state.res = n; return regen(); },
  lookTop: () => { camera.position.set(0, 2.4, 0.001); controls.target.set(0, 0, 0); controls.update(); },
  lookOblique: () => { camera.position.set(0, 1.4, 1.8); controls.target.set(0, 0, 0); controls.update(); },
};
regen();
window.__reliefReady = true;
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
(function tick() { controls.update(); renderer.render(scene, camera); requestAnimationFrame(tick); })();
