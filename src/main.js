import './style.css';
import * as THREE from 'three';
import { Starfield } from './objects/Starfield.js';
import { Star } from './objects/Star.js';
import { Planet } from './objects/Planet.js';
import { Moon } from './objects/Moon.js';
import { OrbitLine } from './objects/OrbitLine.js';
import { AsteroidBelt } from './objects/AsteroidBelt.js';
import { CameraController } from './camera/CameraController.js';
import { RetroRenderer } from './rendering/RetroRenderer.js';
import { StarSystemGenerator } from './generation/StarSystemGenerator.js';

// ── Scene ──
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

// ── Camera ──
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 5000);

// ── Retro Renderer ──
const canvas = document.getElementById('canvas');
const retroRenderer = new RetroRenderer(canvas, scene, camera);

// ── Camera Controller ──
const cameraController = new CameraController(camera, canvas);

// ── Starfield ──
const starfield = new Starfield(3000, 500);
starfield.addTo(scene);

// ── System State ──
let seedCounter = 0;
let system = null;
let focusIndex = -1;   // -1 = system overview, 0+ = focused planet index
let focusMoonIndex = -1; // -1 = focused on planet itself, 0+ = specific moon
let orbitsVisible = false;

// ── Click-to-select (raycasting) ──
const raycaster = new THREE.Raycaster();
const _mouse = new THREE.Vector2();
const _mouseDown = { x: 0, y: 0 };
let clickTargets = new Map();

spawnSystem();

/**
 * Generate and display a full star system (single or binary).
 */
function spawnSystem() {
  // ── Clean up old system ──
  if (system) {
    system.star.dispose();
    scene.remove(system.star.mesh);
    if (system.star2) {
      system.star2.dispose();
      scene.remove(system.star2.mesh);
    }
    for (const entry of system.planets) {
      entry.planet.dispose();
      scene.remove(entry.planet.mesh);
      for (const moon of entry.moons) {
        moon.dispose();
        scene.remove(moon.mesh);
      }
    }
    for (const line of system.orbitLines) {
      line.dispose();
      scene.remove(line.mesh);
    }
    for (const belt of system.asteroidBelts) {
      belt.removeFrom(scene);
      belt.dispose();
    }
    if (system.starOrbitLines) {
      for (const line of system.starOrbitLines) {
        line.dispose();
        scene.remove(line.mesh);
      }
    }
  }

  // ── Generate system data ──
  const seed = `system-${seedCounter}`;
  const systemData = StarSystemGenerator.generate(seed);

  // ── Create star(s) ──
  const star = new Star(systemData.star);
  star.addTo(scene);

  let star2 = null;
  const starOrbitLines = [];

  if (systemData.isBinary) {
    star2 = new Star(systemData.star2);
    star2.addTo(scene);

    // Position binary stars at their starting positions
    const q = systemData.binaryMassRatio;
    const sep = systemData.binarySeparation;
    const r1 = sep * q / (1 + q);     // primary: closer to barycenter
    const r2 = sep * 1.0 / (1 + q);   // secondary: farther out
    const angle = systemData.binaryOrbitAngle;

    star.mesh.position.set(Math.cos(angle) * r1, 0, Math.sin(angle) * r1);
    star2.mesh.position.set(-Math.cos(angle) * r2, 0, -Math.sin(angle) * r2);

    // Small orbit lines for the binary stars (always visible, subtle)
    const line1 = new OrbitLine(r1, 0x666644);
    line1.addTo(scene);
    const line2 = new OrbitLine(r2, 0x666644);
    line2.addTo(scene);
    starOrbitLines.push(line1, line2);
  }

  // ── Create planets, moons, and orbit lines ──
  const planets = [];
  const orbitLines = [];

  for (let i = 0; i < systemData.planets.length; i++) {
    const entry = systemData.planets[i];

    // Create planet mesh (with star info for dual lighting)
    const planet = new Planet(entry.planetData, systemData.starInfo);
    const px = Math.cos(entry.orbitAngle) * entry.orbitRadius;
    const pz = Math.sin(entry.orbitAngle) * entry.orbitRadius;
    planet.mesh.position.set(px, 0, pz);
    planet.addTo(scene);

    // Create moons (share planet's lightDir references + star info)
    const moons = [];
    for (const moonData of entry.moons) {
      const moon = new Moon(moonData, planet._lightDir, planet._lightDir2, systemData.starInfo);
      moon.addTo(scene);
      moons.push(moon);
    }

    // Create orbit line (hidden by default)
    const orbitLine = new OrbitLine(entry.orbitRadius, 0x444444);
    orbitLine.addTo(scene);
    orbitLine.mesh.visible = orbitsVisible;
    orbitLines.push(orbitLine);

    planets.push({
      planet,
      moons,
      orbitRadius: entry.orbitRadius,
      orbitAngle: entry.orbitAngle,
      orbitSpeed: entry.orbitSpeed,
    });
  }

  // ── Create asteroid belts ──
  const asteroidBelts = [];
  for (const beltData of systemData.asteroidBelts) {
    const belt = new AsteroidBelt(beltData, systemData.starInfo);
    belt.addTo(scene);
    asteroidBelts.push(belt);
  }

  // ── Store system state ──
  system = {
    star,
    star2,
    planets,
    orbitLines,
    asteroidBelts,
    starOrbitLines,
    isBinary: systemData.isBinary,
    binaryOrbitAngle: systemData.binaryOrbitAngle,
    binaryOrbitSpeed: systemData.binaryOrbitSpeed,
    binarySeparation: systemData.binarySeparation,
    binaryMassRatio: systemData.binaryMassRatio,
  };

  // ── Build click target map ──
  clickTargets = new Map();
  for (let i = 0; i < planets.length; i++) {
    const entry = planets[i];
    clickTargets.set(entry.planet.surface, { type: 'planet', planetIndex: i });
    if (entry.planet.ring) {
      clickTargets.set(entry.planet.ring, { type: 'planet', planetIndex: i });
    }
    for (let m = 0; m < entry.moons.length; m++) {
      clickTargets.set(entry.moons[m].mesh, { type: 'moon', planetIndex: i, moonIndex: m });
    }
  }

  // ── Opening shot: randomly focus a planet or moon ──
  const heroIndex = Math.floor(Math.random() * planets.length);
  const hero = planets[heroIndex];

  let heroMoonIndex = -1;
  if (hero.moons.length > 0 && Math.random() < 0.3) {
    heroMoonIndex = Math.floor(Math.random() * hero.moons.length);
  }

  const yawOffset = (Math.random() - 0.5) * 0.25;
  cameraController.setTarget(hero.planet.mesh.position.clone());
  cameraController.yaw = hero.orbitAngle + yawOffset;
  cameraController.smoothedYaw = cameraController.yaw;
  cameraController.pitch = 0.08 + Math.random() * 0.12;
  cameraController.smoothedPitch = cameraController.pitch;
  cameraController.autoRotateActive = true;

  focusIndex = heroIndex;
  if (heroMoonIndex >= 0) {
    const moon = hero.moons[heroMoonIndex];
    const viewDist = Math.max(moon.data.radius * 8, 1.5);
    focusMoonIndex = heroMoonIndex;
    cameraController.distance = viewDist;
    cameraController.smoothedDistance = viewDist;
  } else {
    const viewDist = Math.max(hero.planet.data.radius * 6, 4);
    focusMoonIndex = -1;
    cameraController.distance = viewDist;
    cameraController.smoothedDistance = viewDist;
  }

  // ── Console log ──
  const starDesc = systemData.isBinary
    ? `${systemData.star.type}+${systemData.star2.type} binary`
    : `${systemData.star.type}-class star`;
  const beltDesc = systemData.asteroidBelts.length > 0
    ? `, ${systemData.asteroidBelts[0].asteroids.length} asteroids`
    : '';
  const heroDesc = heroMoonIndex >= 0
    ? `moon ${heroMoonIndex + 1} of planet ${heroIndex + 1}`
    : `planet ${heroIndex + 1}: ${hero.planet.data.type}`;
  console.log(`System "${seed}" — ${starDesc}, ${systemData.planets.length} planets${beltDesc} (featuring ${heroDesc})`);
}

/**
 * Focus the camera on a specific planet (by index), or overview if -1.
 */
function focusPlanet(index) {
  if (!system) return;
  focusMoonIndex = -1;

  if (index < 0 || index >= system.planets.length) {
    focusIndex = -1;
    const outerOrbit = system.planets[system.planets.length - 1].orbitRadius;
    cameraController.viewSystem(outerOrbit);
    console.log('System overview');
  } else {
    focusIndex = index;
    const entry = system.planets[index];
    const viewDist = Math.max(entry.planet.data.radius * 6, 4);
    cameraController.focusOn(entry.planet.mesh.position, viewDist);
    console.log(`Focus: planet ${index + 1} (${entry.planet.data.type})`);
  }
}

// ── Animation Loop ──
const timer = new THREE.Timer();
// Pre-allocate reusable vectors
const _sunDir = new THREE.Vector3();
const _sunDir2 = new THREE.Vector3();

function animate() {
  requestAnimationFrame(animate);

  timer.update();
  const deltaTime = Math.min(timer.getDelta(), 0.1);

  if (system) {
    // ── Binary star orbit ──
    if (system.isBinary) {
      system.binaryOrbitAngle += system.binaryOrbitSpeed * deltaTime;
      const q = system.binaryMassRatio;
      const sep = system.binarySeparation;
      const r1 = sep * q / (1 + q);
      const r2 = sep * 1.0 / (1 + q);
      const angle = system.binaryOrbitAngle;

      system.star.mesh.position.set(
        Math.cos(angle) * r1, 0, Math.sin(angle) * r1,
      );
      system.star2.mesh.position.set(
        -Math.cos(angle) * r2, 0, -Math.sin(angle) * r2,
      );
    }

    // ── Update each planet's orbit, position, and lighting ──
    for (const entry of system.planets) {
      entry.orbitAngle += entry.orbitSpeed * deltaTime;
      const px = Math.cos(entry.orbitAngle) * entry.orbitRadius;
      const pz = Math.sin(entry.orbitAngle) * entry.orbitRadius;
      entry.planet.mesh.position.set(px, 0, pz);

      // Primary sun direction: from planet toward star 1
      if (system.isBinary) {
        const s1 = system.star.mesh.position;
        _sunDir.set(s1.x - px, 0, s1.z - pz).normalize();
      } else {
        _sunDir.set(-px, 0, -pz).normalize();
      }
      entry.planet._lightDir.copy(_sunDir);

      // Secondary sun direction (binary only)
      if (system.isBinary) {
        const s2 = system.star2.mesh.position;
        _sunDir2.set(s2.x - px, 0, s2.z - pz).normalize();
        entry.planet._lightDir2.copy(_sunDir2);
      }

      // Planet rotation + clouds
      entry.planet.update(deltaTime);

      // Moons orbit around the planet
      for (const moon of entry.moons) {
        moon.update(deltaTime, entry.planet.mesh.position);
      }
    }

    // ── Update asteroid belts ──
    for (const belt of system.asteroidBelts) {
      belt.update(deltaTime);
      // Update star positions for per-fragment lighting (binary)
      if (system.isBinary) {
        belt.updateStarPositions(system.star.mesh.position, system.star2.mesh.position);
      }
    }

    // ── Camera tracking ──
    if (focusIndex >= 0 && focusIndex < system.planets.length) {
      const entry = system.planets[focusIndex];
      if (focusMoonIndex >= 0 && focusMoonIndex < entry.moons.length) {
        cameraController.trackTarget(entry.moons[focusMoonIndex].mesh.position);
      } else {
        cameraController.trackTarget(entry.planet.mesh.position);
      }
    }
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
    spawnSystem();
  } else if (e.code === 'Escape' || e.code === 'Backquote') {
    focusPlanet(-1);
  } else if (e.code === 'Tab') {
    e.preventDefault();
    if (!system) return;
    const n = system.planets.length;
    if (e.shiftKey) {
      focusPlanet(focusIndex <= 0 ? n - 1 : focusIndex - 1);
    } else {
      focusPlanet((focusIndex + 1) % n);
    }
  } else if (e.code === 'KeyO') {
    if (!system) return;
    orbitsVisible = !orbitsVisible;
    for (const line of system.orbitLines) {
      line.mesh.visible = orbitsVisible;
    }
  } else if (e.key >= '1' && e.key <= '9') {
    const idx = parseInt(e.key) - 1;
    if (system && idx < system.planets.length) {
      focusPlanet(idx);
    }
  }
});

// ── Click-to-select ──
canvas.addEventListener('mousedown', (e) => {
  _mouseDown.x = e.clientX;
  _mouseDown.y = e.clientY;
});

canvas.addEventListener('mouseup', (e) => {
  if (e.button !== 0) return;
  const dx = e.clientX - _mouseDown.x;
  const dy = e.clientY - _mouseDown.y;
  if (dx * dx + dy * dy > 25) return;

  if (!system) return;

  _mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  _mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(_mouse, camera);

  const meshes = Array.from(clickTargets.keys());
  const hits = raycaster.intersectObjects(meshes, false);

  if (hits.length > 0) {
    const hit = hits[0];
    const info = clickTargets.get(hit.object);
    if (!info) return;

    if (info.type === 'planet') {
      focusPlanet(info.planetIndex);
    } else if (info.type === 'moon') {
      const entry = system.planets[info.planetIndex];
      const moon = entry.moons[info.moonIndex];
      const viewDist = Math.max(moon.data.radius * 8, 1.5);
      focusIndex = info.planetIndex;
      focusMoonIndex = info.moonIndex;
      cameraController.focusOn(moon.mesh.position, viewDist);
      console.log(`Focus: moon ${info.moonIndex + 1} of planet ${info.planetIndex + 1} (${moon.data.type})`);
    }
  }
});

// ── Start ──
animate();
console.log('Well Dipper — Star System');
console.log('Controls: Space=new system, Tab=next planet, 1-9=planet#, Esc=overview, O=toggle orbits');
