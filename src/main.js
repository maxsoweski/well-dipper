import './style.css';
import * as THREE from 'three';
import { Starfield } from './objects/Starfield.js';
import { Planet } from './objects/Planet.js';
import { CameraController } from './camera/CameraController.js';
import { RetroRenderer } from './rendering/RetroRenderer.js';
import { SeededRandom } from './generation/SeededRandom.js';
import { PlanetGenerator } from './generation/PlanetGenerator.js';
import { MoonGenerator } from './generation/MoonGenerator.js';
import { Moon } from './objects/Moon.js';

// ── Scene ──
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

// ── Camera ──
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);

// ── Retro Renderer ──
const canvas = document.getElementById('canvas');
const retroRenderer = new RetroRenderer(canvas, scene, camera);

// ── Camera Controller (must exist before spawnPlanet) ──
const cameraController = new CameraController(camera, canvas);

// ── Starfield ──
const starfield = new Starfield(3000, 500);
starfield.addTo(scene);

// ── Procedural Planet + Moons ──
let seedCounter = 0;
let planet = null;
let moons = [];
planet = spawnPlanet();

function spawnPlanet(seed) {
  // Remove old planet and moons
  if (planet) {
    scene.remove(planet.mesh);
    planet.dispose();
  }
  for (const moon of moons) {
    scene.remove(moon.mesh);
    moon.dispose();
  }
  moons = [];

  const rng = new SeededRandom(seed || `planet-${seedCounter}`);
  const orbitIndex = rng.int(0, 5);
  const data = PlanetGenerator.generate(rng, orbitIndex);
  const p = new Planet(data);
  p.mesh.position.set(0, 0, 0);
  p.addTo(scene);

  // Point the orbit camera at the new planet
  cameraController.setTarget(p.mesh.position);

  // Generate moons
  for (let i = 0; i < data.moonCount; i++) {
    const moonRng = rng.child(`moon-${i}`);
    const moonData = MoonGenerator.generate(moonRng, data, i, data.moonCount);
    const moon = new Moon(moonData, p._lightDir);
    moon.addTo(scene);
    moons.push(moon);
  }

  console.log(`Generated ${data.type} planet with ${data.moonCount} moons`);
  return p;
}

// ── Animation Loop ──
const timer = new THREE.Timer();

function animate() {
  requestAnimationFrame(animate);

  timer.update();
  const deltaTime = Math.min(timer.getDelta(), 0.1);

  planet.update(deltaTime);
  for (const moon of moons) {
    moon.update(deltaTime, planet.mesh.position);
  }
  cameraController.update(deltaTime);
  starfield.update(camera.position);

  retroRenderer.render();
}

// ── Handle Window Resize ──
window.addEventListener('resize', () => retroRenderer.resize());

// ── Keyboard shortcuts ──
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    e.preventDefault();
    seedCounter++;
    planet = spawnPlanet();
  } else if (e.code === 'KeyC') {
    cameraController.centerOn(planet.mesh.position);
  }
});

// ── Start ──
animate();
console.log('Well Dipper — Phase 3: A Lonely Planet');
