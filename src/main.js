import './style.css';
import * as THREE from 'three';
import { Starfield } from './objects/Starfield.js';
import { CameraController } from './camera/CameraController.js';

// ── Renderer ──
// We render at a low resolution (320x240) for the retro look,
// then CSS scales it up to fill the browser window with crisp pixels.
const RENDER_WIDTH = 320;
const RENDER_HEIGHT = 240;

const canvas = document.getElementById('canvas');
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: false, // No antialiasing — we want sharp, chunky pixels
});
renderer.setSize(RENDER_WIDTH, RENDER_HEIGHT, false); // false = don't set CSS size
renderer.setPixelRatio(1); // Always 1:1 — no high-DPI scaling

// ── Scene ──
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000); // Pure black void

// ── Camera ──
// 70-degree field of view gives a nice sense of depth without too much distortion.
// Near/far clipping planes: 0.1 to 1000 units.
const camera = new THREE.PerspectiveCamera(
  70,
  RENDER_WIDTH / RENDER_HEIGHT,
  0.1,
  1000
);
camera.position.set(0, 0, 0); // Start at the origin

// ── Starfield ──
const starfield = new Starfield(3000, 500);
starfield.addTo(scene);

// ── Camera Controller ──
const cameraController = new CameraController(camera, canvas);

// ── Animation Loop ──
// Three.js calls this function every frame (~60fps).
// `deltaTime` tells us how much real time passed since the last frame,
// which keeps animations smooth regardless of framerate.
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const deltaTime = clock.getDelta();

  // Update camera rotation from mouse input
  cameraController.update(deltaTime);

  // Keep starfield centered on camera (it's a skybox)
  starfield.update(camera.position);

  // Draw the frame
  renderer.render(scene, camera);
}

// ── Handle Window Resize ──
// The render resolution stays 320x240, but we need to update the CSS
// so the canvas stretches to fill the window.
function onResize() {
  // Canvas CSS size fills the viewport (set in style.css)
  // We don't change the render resolution — just let CSS scale it up
  // The aspect ratio of the renderer stays fixed at 320:240 (4:3)
}

window.addEventListener('resize', onResize);

// ── Start ──
animate();
console.log('Well Dipper — Phase 1: Hello Space');
