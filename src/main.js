import './style.css';
import * as THREE from 'three';
import { Starfield } from './objects/Starfield.js';
import { Star } from './objects/Star.js';
import { Planet } from './objects/Planet.js';
import { Moon } from './objects/Moon.js';
import { OrbitLine } from './objects/OrbitLine.js';
import { AsteroidBelt } from './objects/AsteroidBelt.js';
import { GravityWell } from './objects/GravityWell.js';
import { CameraController } from './camera/CameraController.js';
import { RetroRenderer } from './rendering/RetroRenderer.js';
import { StarSystemGenerator } from './generation/StarSystemGenerator.js';

// ── Scene ──
const scene = new THREE.Scene();
// No scene.background — we need the scene render target to have alpha=0
// where there are no objects, so the composite shader can show the starfield
// behind empty space (but NOT behind dark shadows).

// ── Camera ──
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 5000);

// ── Retro Renderer ──
const canvas = document.getElementById('canvas');
const retroRenderer = new RetroRenderer(canvas, scene, camera);

// ── Camera Controller ──
const cameraController = new CameraController(camera, canvas);

// When free-look ends, clear focus so the camera stays orbiting whatever
// point the user was looking at — not snapping back to the planet.
cameraController.onFreeLookEnd = () => {
  focusIndex = -1;
  focusMoonIndex = -1;
  focusStarIndex = -1;
};

// ── Starfield ──
// Rendered at full resolution (via retroRenderer.starfieldScene) for tiny
// crisp star points, separate from the low-res retro scene objects.
const starfield = new Starfield(6000, 500);
starfield.addTo(retroRenderer.starfieldScene);

// ── System State ──
let seedCounter = 0;
let system = null;
let focusIndex = -1;   // -1 = system overview, 0+ = focused planet index
let focusMoonIndex = -1; // -1 = focused on planet itself, 0+ = specific moon
let orbitsVisible = false;
let gravityWellVisible = false;
let gravityWell = null;

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
      for (const line of entry.moonOrbitLines) {
        line.dispose();
        scene.remove(line.mesh);
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

  // ── Clean up old gravity well ──
  if (gravityWell) {
    gravityWell.removeFrom(scene);
    gravityWell.dispose();
    gravityWell = null;
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

    // Small orbit lines for the binary stars (hidden by default, toggled with 'O')
    const line1 = new OrbitLine(r1, 0x00dd00);
    line1.addTo(scene);
    line1.mesh.visible = orbitsVisible;
    const line2 = new OrbitLine(r2, 0x00dd00);
    line2.addTo(scene);
    line2.mesh.visible = orbitsVisible;
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

    // Create moons + moon orbit lines (share planet's lightDir references + star info)
    const moons = [];
    const moonOrbitLines = [];
    for (const moonData of entry.moons) {
      const moon = new Moon(moonData, planet._lightDir, planet._lightDir2, systemData.starInfo);
      moon.addTo(scene);
      moons.push(moon);

      // Moon orbit line — centered on planet, tilted by inclination
      const moonLine = new OrbitLine(moonData.orbitRadius, 0x00bb00);
      moonLine.mesh.position.set(px, 0, pz);
      moonLine.mesh.rotation.x = moonData.inclination;
      moonLine.addTo(scene);
      moonLine.mesh.visible = orbitsVisible;
      moonOrbitLines.push(moonLine);
    }

    // Carve ring gaps where moons orbit inside the ring (shepherd moon effect)
    planet.setRingGaps(entry.moons);

    // Create orbit line (hidden by default)
    const orbitLine = new OrbitLine(entry.orbitRadius, 0x00ff00);
    orbitLine.addTo(scene);
    orbitLine.mesh.visible = orbitsVisible;
    orbitLines.push(orbitLine);

    planets.push({
      planet,
      moons,
      moonOrbitLines,
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

  // ── Create gravity well visualization ──
  // Grid extent covers the whole system plus some padding
  const outerOrbitRadius = systemData.planets.length > 0
    ? systemData.planets[systemData.planets.length - 1].orbitRadius
    : 50;
  gravityWell = new GravityWell(outerOrbitRadius * 2.5, 150);
  gravityWell.setStars(systemData.star, systemData.isBinary ? systemData.star2 : null);
  gravityWell.setPlanets(planets);
  // Set initial positions for the gravity well
  if (systemData.isBinary) {
    gravityWell.updateStarPositions(star.mesh.position, star2.mesh.position);
  } else {
    gravityWell.updateStarPositions(new THREE.Vector3(0, 0, 0), null);
  }
  gravityWell.updatePlanetPositions(planets);
  if (gravityWellVisible) {
    gravityWell.addTo(scene);
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
  // Stars
  clickTargets.set(star.surface, { type: 'star', starIndex: 0 });
  if (star2) {
    clickTargets.set(star2.surface, { type: 'star', starIndex: 1 });
  }
  // Planets and moons
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
  focusStarIndex = -1;

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

/**
 * Focus the camera on a star (0 = primary, 1 = secondary).
 * Uses focusIndex = -2 to signal "tracking a star" (distinct from -1 = overview).
 */
let focusStarIndex = -1;

function focusStar(starIdx) {
  if (!system) return;
  focusIndex = -2;       // special value: star focus
  focusMoonIndex = -1;
  focusStarIndex = starIdx;

  const starObj = starIdx === 1 && system.star2 ? system.star2 : system.star;
  // Cap camera distance so it stays well inside the innermost planet orbit.
  // Without this, planets can pass between the camera and star, creating
  // an ugly foreground blob.
  const innerOrbit = system.planets[0].orbitRadius;
  const idealDist = Math.max(starObj.data.radius * 6, 4);
  const viewDist = Math.min(idealDist, innerOrbit * 0.4);
  cameraController.focusOn(starObj.mesh.position, viewDist);
  const label = system.isBinary
    ? (starIdx === 0 ? 'primary star' : 'secondary star')
    : 'star';
  console.log(`Focus: ${label} (${starObj.data.type}-class)`);
}

function toggleOrbits() {
  if (!system) return;
  orbitsVisible = !orbitsVisible;
  for (const line of system.orbitLines) {
    line.mesh.visible = orbitsVisible;
  }
  if (system.starOrbitLines) {
    for (const line of system.starOrbitLines) {
      line.mesh.visible = orbitsVisible;
    }
  }
  for (const entry of system.planets) {
    for (const line of entry.moonOrbitLines) {
      line.mesh.visible = orbitsVisible;
    }
  }
}

function toggleGravityWell() {
  gravityWellVisible = !gravityWellVisible;
  if (gravityWell) {
    if (gravityWellVisible) {
      gravityWell.addTo(scene);
    } else {
      gravityWell.removeFrom(scene);
    }
  }
}

// ── Animation Loop ──
const timer = new THREE.Timer();
// Pre-allocate reusable vectors
const _sunDir = new THREE.Vector3();
const _sunDir2 = new THREE.Vector3();
const _star1Pos = new THREE.Vector3();
const _star2Pos = new THREE.Vector3();

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

      // Moon orbit lines follow the parent planet
      for (const line of entry.moonOrbitLines) {
        line.mesh.position.set(px, 0, pz);
      }
    }

    // ── Update shadow uniforms ──
    // Star world positions for shadow ray computation
    if (system.isBinary) {
      _star1Pos.copy(system.star.mesh.position);
      _star2Pos.copy(system.star2.mesh.position);
    } else {
      _star1Pos.set(0, 0, 0);
      _star2Pos.set(0, 0, 0);
    }

    for (let i = 0; i < system.planets.length; i++) {
      const entry = system.planets[i];
      const pMat = entry.planet.surface.material;

      // Pass star positions to planet shader
      pMat.uniforms.starPos1.value.copy(_star1Pos);
      pMat.uniforms.starPos2.value.copy(_star2Pos);

      // Transit shadows: moons casting shadows on this planet
      const moonCount = Math.min(entry.moons.length, 6);
      pMat.uniforms.shadowMoonCount.value = moonCount;
      for (let m = 0; m < moonCount; m++) {
        pMat.uniforms.shadowMoonPos.value[m].copy(entry.moons[m].mesh.position);
        pMat.uniforms.shadowMoonRadius.value[m] = entry.moons[m].data.radius;
      }

      // Planet-planet shadows: check immediate orbital neighbors
      let shadowPlanetIdx = 0;
      if (i > 0) {
        const inner = system.planets[i - 1];
        pMat.uniforms.shadowPlanetPos.value[shadowPlanetIdx].copy(inner.planet.mesh.position);
        pMat.uniforms.shadowPlanetRadius.value[shadowPlanetIdx] = inner.planet.data.radius;
        shadowPlanetIdx++;
      }
      if (i < system.planets.length - 1 && shadowPlanetIdx < 2) {
        const outer = system.planets[i + 1];
        pMat.uniforms.shadowPlanetPos.value[shadowPlanetIdx].copy(outer.planet.mesh.position);
        pMat.uniforms.shadowPlanetRadius.value[shadowPlanetIdx] = outer.planet.data.radius;
        shadowPlanetIdx++;
      }
      pMat.uniforms.shadowPlanetCount.value = shadowPlanetIdx;

      // Moon eclipse shadows: planet eclipsing starlight from moons
      for (const moon of entry.moons) {
        const mMat = moon.mesh.material;
        mMat.uniforms.shadowPlanetPos.value.copy(entry.planet.mesh.position);
        mMat.uniforms.shadowPlanetRadius.value = entry.planet.data.radius;
        mMat.uniforms.starPos1.value.copy(_star1Pos);
        mMat.uniforms.starPos2.value.copy(_star2Pos);
      }
    }

    // ── Update gravity well positions (stars for binary orbits, planets every frame) ──
    if (gravityWell && gravityWellVisible) {
      if (system.isBinary) {
        gravityWell.updateStarPositions(
          system.star.mesh.position,
          system.star2.mesh.position,
        );
      }
      // Update planet positions every frame (they orbit the star)
      gravityWell.updatePlanetPositions(system.planets);
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
    // Skip tracking during free-look — the user is controlling the view
    // direction manually, so trackTarget would fight with their input.
    if (!cameraController.isFreeLooking) {
      if (focusIndex === -2 && focusStarIndex >= 0) {
        // Tracking a star
        const starObj = focusStarIndex === 1 && system.star2 ? system.star2 : system.star;
        cameraController.trackTarget(starObj.mesh.position);
      } else if (focusIndex >= 0 && focusIndex < system.planets.length) {
        const entry = system.planets[focusIndex];
        if (focusMoonIndex >= 0 && focusMoonIndex < entry.moons.length) {
          cameraController.trackTarget(entry.moons[focusMoonIndex].mesh.position);
        } else {
          cameraController.trackTarget(entry.planet.mesh.position);
        }
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
    toggleOrbits();
  } else if (e.code === 'KeyG') {
    toggleGravityWell();
  } else if (e.key >= '1' && e.key <= '9') {
    const idx = parseInt(e.key) - 1;
    if (system && idx < system.planets.length) {
      focusPlanet(idx);
    }
  }
});

// ── Click/tap-to-select ──
function trySelect(clientX, clientY) {
  if (!system) return;

  _mouse.x = (clientX / window.innerWidth) * 2 - 1;
  _mouse.y = -(clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(_mouse, camera);

  const meshes = Array.from(clickTargets.keys());
  const hits = raycaster.intersectObjects(meshes, false);

  if (hits.length > 0) {
    const hit = hits[0];
    const info = clickTargets.get(hit.object);
    if (!info) return;

    if (info.type === 'star') {
      focusStar(info.starIndex);
    } else if (info.type === 'planet') {
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
}

// Mouse click
canvas.addEventListener('mousedown', (e) => {
  _mouseDown.x = e.clientX;
  _mouseDown.y = e.clientY;
});

canvas.addEventListener('mouseup', (e) => {
  if (e.button !== 0) return;
  const dx = e.clientX - _mouseDown.x;
  const dy = e.clientY - _mouseDown.y;
  if (dx * dx + dy * dy > 25) return;
  trySelect(e.clientX, e.clientY);
});

// Touch tap (single tap = select, double tap = new system)
let _lastTapTime = 0;
const _touchStart = { x: 0, y: 0 };

canvas.addEventListener('touchstart', (e) => {
  if (e.touches.length === 1) {
    _touchStart.x = e.touches[0].clientX;
    _touchStart.y = e.touches[0].clientY;
  }
}, { passive: true });

canvas.addEventListener('touchend', (e) => {
  if (e.changedTouches.length !== 1) return;
  const touch = e.changedTouches[0];
  const dx = touch.clientX - _touchStart.x;
  const dy = touch.clientY - _touchStart.y;
  // Only count as tap if finger didn't move much
  if (dx * dx + dy * dy > 400) return;

  const now = Date.now();
  if (now - _lastTapTime < 350) {
    // Double tap: new system
    seedCounter++;
    spawnSystem();
    _lastTapTime = 0;
  } else {
    _lastTapTime = now;
    // Single tap: select (use small delay to distinguish from double tap)
    setTimeout(() => {
      if (_lastTapTime !== 0 && Date.now() - _lastTapTime >= 300) {
        trySelect(touch.clientX, touch.clientY);
      }
    }, 350);
  }
}, { passive: true });

// ── Mobile Menu ──
const mobileMenu = document.getElementById('mobile-menu');
if (mobileMenu) {
  const toggle = mobileMenu.querySelector('.mobile-menu-toggle');
  const gyroBtn = mobileMenu.querySelector('[data-action="gyro"]');

  toggle.addEventListener('touchend', (e) => {
    e.preventDefault();
    e.stopPropagation();
    mobileMenu.classList.toggle('open');
  });

  mobileMenu.querySelector('.mobile-menu-items').addEventListener('touchend', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const btn = e.target.closest('button');
    if (!btn) return;

    const action = btn.dataset.action;
    if (action === 'new') {
      seedCounter++;
      spawnSystem();
    } else if (action === 'back') {
      focusPlanet(-1);
    } else if (action === 'prev') {
      if (!system) return;
      const n = system.planets.length;
      focusPlanet(focusIndex <= 0 ? n - 1 : focusIndex - 1);
    } else if (action === 'next') {
      if (!system) return;
      const n = system.planets.length;
      focusPlanet((focusIndex + 1) % n);
    } else if (action === 'orbits') {
      toggleOrbits();
      btn.classList.toggle('active', orbitsVisible);
    } else if (action === 'gravity') {
      toggleGravityWell();
      btn.classList.toggle('active', gravityWellVisible);
    } else if (action === 'gyro') {
      if (cameraController.gyroEnabled) {
        cameraController.disableGyro();
        gyroBtn.classList.remove('active');
      } else {
        cameraController.enableGyro().then((ok) => {
          if (ok) gyroBtn.classList.add('active');
        });
      }
    }

    // Close menu after action (except gyro/orbits toggles)
    if (action !== 'orbits' && action !== 'gravity' && action !== 'gyro') {
      mobileMenu.classList.remove('open');
    }
  });
}

// ── Start ──
animate();
console.log('Well Dipper — Star System');
console.log('Controls: Space=new system, Tab=next planet, 1-9=planet#, Esc=overview, O=orbits, G=gravity wells, Middle-click=free look, Click/tap=select');
