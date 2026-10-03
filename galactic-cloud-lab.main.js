// galactic-cloud-lab.main.js — plumbing only: a camera, a GUI, and the game's own renderer + controller.
// No shader text and no derivation here (tests/galactic-fences.test.js enforces both). Sliders write into
// renderPackOverrides — the registered object the game reads too.
import * as THREE from 'three';
import { GUI } from 'lil-gui';
import { RetroRenderer } from './src/rendering/RetroRenderer.js';
import { SkyRenderer } from './src/rendering/SkyRenderer.js';
import { GalacticMap } from './src/generation/GalacticMap.js';
import { StarfieldGenerator } from './src/generation/StarfieldGenerator.js';
import { RealStarCatalog } from './src/generation/RealStarCatalog.js';
import { RealFeatureCatalog } from './src/generation/RealFeatureCatalog.js';
import { HashGridStarfield } from './src/generation/HashGridStarfield.js';
import { Settings } from './src/ui/Settings.js';
import { mountGalacticEngine } from './src/rendering/galactic/mountGalacticEngine.js';
import { findCloudSubjects, OBSERVER_PRESETS, presetDistancePc, observerPositionFor, approachDirection } from './src/galactic/subjects.js';
import { TUNABLES, renderPackOverrides, tuningValues, COLOUR_MODES, SHAPE_VERSIONS } from './src/galactic/renderPacks.js';

// ── The game's render path (same constructor arguments as src/main.js) ──
const settings = new Settings();
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(settings.get('fov'), innerWidth / innerHeight, 1e-9, 200000);
camera.rotation.order = 'YXZ';
const retro = new RetroRenderer(document.getElementById('canvas'), scene, camera);
retro.pixelScale = settings.get('pixelScale');
retro.setColorPalette(settings.get('colorPalette'));
retro.resize();
const galacticMap = new GalacticMap();
const sky = new SkyRenderer(galacticMap, StarfieldGenerator, settings.get('starDensity'));
const subjects = findCloudSubjects(galacticMap);

const state = { subject: subjects.procedural ? 'procedural' : 'orion', preset: '100 pc', distancePc: 100, mode: 'photo', shape: 2, volume: true, liveMarch: false, dust: true };
const feature = () => subjects[state.subject];
const observer = () => observerPositionFor(feature(), state.distancePc);

sky.prepareForPosition(observer());
sky.activate();
retro.setSkyRenderer(sky);
const api = mountGalacticEngine({ skyRenderer: sky, retroRenderer: retro, galacticMap, ctx: { label: 'lab', bakeTilesPerFrame: 8 }, force: true });
api.pin(feature());
api.setColourMode(state.mode);
api.setShape(state.shape);

// ── Camera: look toward the nebula centre along the approach line; drag to look around ──
function aimAtCentre() {
  const d = approachDirection(feature()).map((c) => -c);
  camera.rotation.set(Math.asin(Math.max(-1, Math.min(1, d[1]))), Math.atan2(-d[0], -d[2]), 0);
}
let drag = null;
addEventListener('pointerdown', (e) => { if (e.target.id === 'canvas') drag = { x: e.clientX, y: e.clientY }; });
addEventListener('pointerup', () => { drag = null; });
addEventListener('pointermove', (e) => {
  if (!drag) return;
  const k = (camera.fov * Math.PI / 180) / innerHeight;
  camera.rotation.y -= (e.clientX - drag.x) * k;
  camera.rotation.x = Math.max(-1.55, Math.min(1.55, camera.rotation.x - (e.clientY - drag.y) * k));
  drag = { x: e.clientX, y: e.clientY };
});
addEventListener('resize', () => retro.resize());

// Rebuild the sky (stars + billboards) where the observer now is; the controller retargets via SkyRenderer.
function rebuildSky() {
  sky.prepareForPosition(observer());
  sky.activate();
}

// ── GUI ──
const gui = new GUI({ title: 'Galactic cloud lab' });
const view = gui.addFolder('View');
view.add(state, 'subject', Object.keys(subjects).filter((k) => subjects[k])).onChange(() => {
  api.pin(feature());
  state.distancePc = presetDistancePc(OBSERVER_PRESETS.find((p) => p.name === state.preset), feature());
  rebuildSky(); aimAtCentre(); gui.controllersRecursive().forEach((c) => c.updateDisplay());
});
view.add(state, 'preset', OBSERVER_PRESETS.map((p) => p.name)).onChange((name) => {
  state.distancePc = presetDistancePc(OBSERVER_PRESETS.find((p) => p.name === name), feature());
  rebuildSky(); aimAtCentre(); gui.controllersRecursive().forEach((c) => c.updateDisplay());
});
view.add(state, 'distancePc', 0, 3000, 0.5).name('distance (pc)')
  .onChange(() => api.controller.setObserver(observer()))
  .onFinishChange(rebuildSky);
view.add(state, 'mode', COLOUR_MODES).name('colour (U)').onChange((m) => api.setColourMode(m));
view.add(state, 'shape', SHAPE_VERSIONS).name('shape (V): 1 ring / 2 new').onChange((v) => api.setShape(Number(v)));
view.add(state, 'volume').name('volume (J = A/B)').onChange((on) => api.setEnabled(on));
view.add(api.controller.ctx, 'steps', 8, 128, 1).name('ray steps (ctx)').onFinishChange(() => api.controller.refresh());
view.add(state, 'liveMarch').name('live march (reference)').onChange((on) => api.setSource(on ? 'live' : 'bake'));
view.add(state, 'dust').name('dust dims stars').onChange((on) => api.setDust(on));
view.add(api.controller.ctx, 'bakeTilesPerFrame', 1, 48, 1).name('bake tiles / frame (ctx)');
view.add({ aim: aimAtCentre }, 'aim').name('look at centre');

const tune = gui.addFolder('Render pack overrides (shared with the game)');
const proxy = tuningValues();
for (const [key, spec] of Object.entries(TUNABLES)) {
  tune.add(proxy, key, spec.min, spec.max, spec.step).onChange((v) => {
    renderPackOverrides[key] = v;
    api.controller.refresh();
  });
}
tune.add({ reset() {
  for (const k of Object.keys(renderPackOverrides)) delete renderPackOverrides[k];
  Object.assign(proxy, tuningValues());
  tune.controllers.forEach((c) => c.updateDisplay());
  api.controller.refresh();
} }, 'reset').name('reset overrides');

// Keep the GUI in step with the J/U/V keys (they act on the controller directly).
addEventListener('keyup', () => {
  const s = api.controller.snapshot();
  state.mode = s.mode; state.volume = s.enabled; state.shape = s.shape;
  view.controllers.forEach((c) => c.updateDisplay());
});

// ── Real catalogues, as the game loads them (the sky re-prepares once they arrive) ──
const stars = new RealStarCatalog();
stars.load().then(() => { StarfieldGenerator.realStarCatalog = stars; rebuildSky(); });
const feats = new RealFeatureCatalog();
feats.load().then(() => { HashGridStarfield.realFeatureCatalog = feats; });

// ── Loop ──
aimAtCentre();
const hud = document.getElementById('hud');
const clock = new THREE.Clock();
let hudAt = 0;
function frame() {
  const dt = clock.getDelta(), t = clock.elapsedTime;
  sky.update(camera, dt);
  retro.setTime(t);
  retro.render();
  if (t - hudAt > 0.5) {
    hudAt = t;
    const s = api.snapshot();
    const gpu = s.gpuMs ? `gpu composite ${s.gpuMs.composite?.toFixed(3) ?? '–'} ms · bake tile ${s.gpuMs.bakeTile?.toFixed(3) ?? '–'} ms` : 'gpu timer n/a';
    hud.textContent = `${s.featureId}\n${s.active ? 'VOLUME' : 'billboard'} (${s.source}) · ${s.mode} · shape v${s.shape} · d=${s.distancePc?.toFixed(1)} pc · inside=${s.insideCloud}\nR=${s.radiusPc?.toFixed(1)} pc · params ${s.paramsHash} · bake ${s.bake.state} ${s.bake.faces} gen ${s.bake.generation}/${s.bake.publishedGeneration} · ${s.bake.faceSize}px faces\nstars: ${s.starDust} · ${(s.textureBytes / 1048576).toFixed(1)} MB · ${gpu}`;
  }
  requestAnimationFrame(frame);
}
frame();
