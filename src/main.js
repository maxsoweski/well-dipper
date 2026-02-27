import './style.css';
import * as THREE from 'three';
import { Starfield } from './objects/Starfield.js';
import { CameraController } from './camera/CameraController.js';
import { RetroRenderer } from './rendering/RetroRenderer.js';

// ── Scene ──
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000); // Pure black void

// ── Camera ──
const camera = new THREE.PerspectiveCamera(
  70,              // Field of view (degrees)
  640 / 480,       // Aspect ratio (4:3)
  0.1,             // Near clipping plane
  1000             // Far clipping plane
);
camera.position.set(0, 0, 0);

// ── Retro Renderer (320×240 + dithering + posterization) ──
const canvas = document.getElementById('canvas');
const retroRenderer = new RetroRenderer(canvas, scene, camera);

// ── Starfield ──
const starfield = new Starfield(3000, 500);
starfield.addTo(scene);

// ── Test cube — temporary, just to see the dithering on a surface ──
// A gradient-colored cube makes the posterization/dithering visible.
// Stars are too tiny to show the effect. This gets removed in Phase 3.
const cubeGeometry = new THREE.BoxGeometry(2, 2, 2);
const cubeMaterial = new THREE.MeshStandardMaterial({
  color: 0x4488cc,
  roughness: 0.7,
  metalness: 0.3,
});
const testCube = new THREE.Mesh(cubeGeometry, cubeMaterial);
testCube.position.set(0, 0, -8); // Place it in front of the camera
scene.add(testCube);

// ── Lights (needed for MeshStandardMaterial to be visible) ──
const ambientLight = new THREE.AmbientLight(0x222244, 0.5); // Dim blue-ish fill
const directionalLight = new THREE.DirectionalLight(0xffeedd, 1.0); // Warm key light
directionalLight.position.set(5, 3, 5);
scene.add(ambientLight);
scene.add(directionalLight);

// ── Camera Controller ──
const cameraController = new CameraController(camera, canvas);

// ── Animation Loop ──
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const deltaTime = Math.min(clock.getDelta(), 0.1);

  // Slowly rotate the test cube so you can see dithering from different angles
  testCube.rotation.x += 0.3 * deltaTime;
  testCube.rotation.y += 0.5 * deltaTime;

  cameraController.update(deltaTime);
  starfield.update(camera.position);

  // Render through the retro post-processing pipeline
  retroRenderer.render();
}

// ── Start ──
animate();
console.log('Well Dipper — Phase 2: The PS1 Filter');
