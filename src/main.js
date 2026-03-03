import './style.css';
import * as THREE from 'three';
import { Starfield } from './objects/Starfield.js';
import { Star } from './objects/Star.js';
import { Planet } from './objects/Planet.js';
import { Moon } from './objects/Moon.js';
import { OrbitLine } from './objects/OrbitLine.js';
import { AsteroidBelt } from './objects/AsteroidBelt.js';
import { Billboard, billboardColor } from './objects/Billboard.js';
import { GravityWellMap } from './ui/GravityWellMap.js';
import { CameraController } from './camera/CameraController.js';
import { RetroRenderer } from './rendering/RetroRenderer.js';
import { StarSystemGenerator } from './generation/StarSystemGenerator.js';
import { SystemMap } from './ui/SystemMap.js';
import { AutoNavigator } from './auto/AutoNavigator.js';
import { FlythroughCamera } from './auto/FlythroughCamera.js';

// ── Scene ──
const scene = new THREE.Scene();
// No scene.background — we need the scene render target to have alpha=0
// where there are no objects, so the composite shader can show the starfield
// behind empty space (but NOT behind dark shadows).

// ── Camera ──
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 200000);

// ── Retro Renderer ──
const canvas = document.getElementById('canvas');
const retroRenderer = new RetroRenderer(canvas, scene, camera);

// ── Camera Controller ──
const cameraController = new CameraController(camera, canvas);

// When free-look ends, clear focus so the camera stays orbiting whatever
// point the user was looking at — not snapping back to the planet.
// Exception: during autopilot, the tour controls focus — don't clear it.
cameraController.onFreeLookEnd = () => {
  if (!autoNav.isActive) {
    focusIndex = -1;
    focusMoonIndex = -1;
    focusStarIndex = -1;
  }
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
let gravityWell = null;        // GravityWellMap instance (contour minimap)
let gravityWellPlanets = null; // lightweight position proxies for the well
let systemMap = null;

// ── Autopilot (cinematic flythrough) ──
const autoNav = new AutoNavigator();
const flythrough = new FlythroughCamera(camera);
let idleTimer = 0;
const IDLE_THRESHOLD = 20;

autoNav.onTourComplete = () => {
  // Phase 7 will replace with warp trigger. For now, loop.
};

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
  // ── Reset autopilot / flythrough ──
  const wasAutopilot = autoNav.isActive;
  stopFlythrough();
  idleTimer = 0;

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
      entry.billboard.dispose();
      entry.billboard.removeFrom(scene);
      for (let m = 0; m < entry.moons.length; m++) {
        entry.moons[m].dispose();
        scene.remove(entry.moons[m].mesh);
        entry.moonBillboards[m].dispose();
        entry.moonBillboards[m].removeFrom(scene);
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

  // ── Clean up old system map ──
  if (systemMap) {
    systemMap.dispose();
    systemMap = null;
    retroRenderer.setHud(null, null);
  }

  // ── Clean up old gravity well ──
  if (gravityWell) {
    gravityWell.dispose();
    gravityWell = null;
  }
  gravityWellPlanets = null;

  // ── Generate system data ──
  const seed = `system-${seedCounter}`;
  const systemData = StarSystemGenerator.generate(seed);

  // ── Create star(s) ──
  // Scene-unit star data: override radius with radiusScene for 3D rendering
  const sceneStarData = { ...systemData.star, radius: systemData.star.radiusScene };
  const star = new Star(sceneStarData);
  star.addTo(scene);

  let star2 = null;
  const starOrbitLines = [];

  if (systemData.isBinary) {
    const sceneStarData2 = { ...systemData.star2, radius: systemData.star2.radiusScene };
    star2 = new Star(sceneStarData2);
    star2.addTo(scene);

    // Position binary stars at their starting positions (scene units)
    const q = systemData.binaryMassRatio;
    const sep = systemData.binarySeparationScene;
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

    // Scene-unit planet data: override radius for 3D rendering.
    // Scale noiseScale and cloudScale to compensate for smaller geometry —
    // keeps the same visual texture patterns at realistic size.
    const mapToSceneRatio = entry.planetData.radius / entry.planetData.radiusScene;
    const scenePlanetData = {
      ...entry.planetData,
      radius: entry.planetData.radiusScene,
      noiseScale: entry.planetData.noiseScale * mapToSceneRatio,
      clouds: entry.planetData.clouds
        ? { ...entry.planetData.clouds, scale: entry.planetData.clouds.scale * mapToSceneRatio }
        : null,
    };
    const planet = new Planet(scenePlanetData, systemData.starInfo);
    const px = Math.cos(entry.orbitAngle) * entry.orbitRadiusScene;
    const pz = Math.sin(entry.orbitAngle) * entry.orbitRadiusScene;
    planet.mesh.position.set(px, 0, pz);
    planet.addTo(scene);

    // Billboard indicator (shown when planet is sub-pixel at render resolution)
    const billboard = new Billboard(billboardColor(scenePlanetData.baseColor));
    billboard.addTo(scene);

    // Scene-unit moon data: override radius and orbitRadius for 3D rendering.
    // Scale noiseScale like planets — compensate for smaller geometry.
    const sceneMoons = entry.moons.map(m => ({
      ...m,
      radius: m.radiusScene,
      orbitRadius: m.orbitRadiusScene,
      noiseScale: m.noiseScale * (m.radius / m.radiusScene),
    }));

    // Create moons + moon orbit lines (share planet's lightDir references + star info)
    const moons = [];
    const moonBillboards = [];
    const moonOrbitLines = [];
    for (const moonData of sceneMoons) {
      const moon = new Moon(moonData, planet._lightDir, planet._lightDir2, systemData.starInfo);
      moon.addTo(scene);
      moons.push(moon);

      // Moon billboard (shown when moon is sub-pixel) — 1 render pixel (3 screen px)
      const moonBb = new Billboard(billboardColor(moonData.baseColor), 1);
      moonBb.addTo(scene);
      moonBillboards.push(moonBb);

      // Moon orbit line — centered on planet, tilted by inclination
      const moonLine = new OrbitLine(moonData.orbitRadius, 0x00bb00);
      moonLine.mesh.position.set(px, 0, pz);
      moonLine.mesh.rotation.x = moonData.inclination;
      moonLine.addTo(scene);
      moonLine.mesh.visible = orbitsVisible;
      moonOrbitLines.push(moonLine);
    }

    // Carve ring gaps where moons orbit inside the ring (shepherd moon effect)
    planet.setRingGaps(sceneMoons);

    // Create orbit line (hidden by default) — scene-unit radius
    const orbitLine = new OrbitLine(entry.orbitRadiusScene, 0x00ff00);
    orbitLine.addTo(scene);
    orbitLine.mesh.visible = orbitsVisible;
    orbitLines.push(orbitLine);

    planets.push({
      planet,
      billboard,
      moons,
      moonBillboards,
      moonOrbitLines,
      orbitRadius: entry.orbitRadiusScene,
      orbitAngle: entry.orbitAngle,
      orbitSpeed: entry.orbitSpeed,
    });
  }

  // ── Create asteroid belts (scene-unit positions) ──
  const asteroidBelts = [];
  for (const beltData of systemData.asteroidBelts) {
    // Scale asteroid positions from map units to scene units
    const beltScaleRatio = beltData.centerRadiusScene / beltData.centerRadius;
    const sceneBeltData = {
      ...beltData,
      centerRadius: beltData.centerRadiusScene,
      width: beltData.widthScene,
      thickness: beltData.thicknessScene,
      asteroids: beltData.asteroids.map(a => ({
        ...a,
        radius: a.radius * beltScaleRatio,
        height: a.height * beltScaleRatio,
        size: a.size * beltScaleRatio,
      })),
    };
    const belt = new AsteroidBelt(sceneBeltData, systemData.starInfo);
    belt.addTo(scene);
    asteroidBelts.push(belt);
  }

  // ── Gravity well contour map (2D equipotential lines in HUD) ──
  // Fragment-shader contour lines computed per-pixel from gravitational potential.
  // Dense rings = deep well, sparse = shallow. Reads clearly at 192px HUD resolution.
  // Uses map-unit coordinates (old exaggerated scale) for the physics.
  const outerOrbitMap = systemData.planets[systemData.planets.length - 1].orbitRadius;
  const wellExtent = outerOrbitMap * 1.5;
  gravityWell = new GravityWellMap(wellExtent);

  gravityWell.setStars(
    { radius: systemData.star.radius },
    systemData.isBinary ? { radius: systemData.star2.radius } : null,
  );

  // Lightweight planet proxies (same shape as GravityWell expects)
  gravityWellPlanets = systemData.planets.map((p, i) => ({
    planet: {
      data: { radius: p.planetData.radius },
      mesh: { position: new THREE.Vector3() },
    },
    orbitRadius: p.orbitRadius,
  }));
  gravityWell.setPlanets(gravityWellPlanets);

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
    binarySeparation: systemData.binarySeparationScene,
    binaryMassRatio: systemData.binaryMassRatio,
    binarySeparationMap: systemData.binarySeparation, // map-unit sep for gravity well
  };

  // ── System map HUD ──
  systemMap = new SystemMap(systemData, system);
  if (gravityWellVisible) {
    retroRenderer.setHud(gravityWell.scene, gravityWell.camera);
  } else {
    retroRenderer.setHud(systemMap.scene, systemMap.camera);
  }

  // ── Build click target map ──
  clickTargets = new Map();
  // Stars
  clickTargets.set(star.surface, { type: 'star', starIndex: 0 });
  if (star2) {
    clickTargets.set(star2.surface, { type: 'star', starIndex: 1 });
  }
  // Planets and moons (both mesh and billboard sprite for LOD click coverage)
  for (let i = 0; i < planets.length; i++) {
    const entry = planets[i];
    clickTargets.set(entry.planet.surface, { type: 'planet', planetIndex: i });
    if (entry.planet.ring) {
      clickTargets.set(entry.planet.ring, { type: 'planet', planetIndex: i });
    }
    clickTargets.set(entry.billboard.sprite, { type: 'planet', planetIndex: i });
    for (let m = 0; m < entry.moons.length; m++) {
      clickTargets.set(entry.moons[m].mesh, { type: 'moon', planetIndex: i, moonIndex: m });
      clickTargets.set(entry.moonBillboards[m].sprite, { type: 'moon', planetIndex: i, moonIndex: m });
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
    const viewDist = moon.data.radius * 8;
    focusMoonIndex = heroMoonIndex;
    cameraController.distance = viewDist;
    cameraController.smoothedDistance = viewDist;
  } else {
    const viewDist = hero.planet.data.radius * 6;
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

  // Phase 5A diagnostic: physical units sanity check
  console.log(`  Star: ${systemData.star.radiusSolar.toFixed(2)} R☉ (${systemData.star.radiusScene.toFixed(2)} scene units)`);
  if (systemData.star2) {
    console.log(`  Star2: ${systemData.star2.radiusSolar.toFixed(2)} R☉, binary sep: ${systemData.binarySeparationAU.toFixed(3)} AU`);
  }
  for (let i = 0; i < systemData.planets.length; i++) {
    const p = systemData.planets[i];
    const moonDesc = p.moons.length > 0
      ? ` (${p.moons.length} moon${p.moons.length > 1 ? 's' : ''})`
      : '';
    console.log(`  P${i + 1}: ${p.planetData.type} — ${p.planetData.radiusEarth.toFixed(2)} R⊕, orbit ${p.orbitRadiusAU.toFixed(2)} AU${moonDesc}`);
  }

  // Restart autopilot with new system if it was active before
  if (wasAutopilot) {
    startFlythrough();
  }
}

/**
 * Populate body references on the autoNav queue.
 * Each stop gets the Three.js mesh so FlythroughCamera can track it.
 */
function populateQueueRefs() {
  for (const stop of autoNav.queue) {
    if (stop.type === 'star') {
      const starObj = stop.starIndex === 1 && system.star2 ? system.star2 : system.star;
      stop.bodyRef = starObj.mesh;
      stop.bodyRadius = starObj.data.radius;
      // Close enough to fill ~50% of FOV, but stay outside glow corona (3.5×r)
      // and inside innermost planet orbit
      const innerOrbit = system.planets[0].orbitRadius;
      stop.orbitDistance = Math.min(starObj.data.radius * 4, innerOrbit * 0.4);
    } else if (stop.type === 'planet') {
      const entry = system.planets[stop.planetIndex];
      stop.bodyRef = entry.planet.mesh;
      stop.bodyRadius = entry.planet.data.radius;
      // 2.8× radius → body fills ~50% of 70° FOV (survey distance)
      stop.orbitDistance = entry.planet.data.radius * 2.8;
    } else if (stop.type === 'moon') {
      const entry = system.planets[stop.planetIndex];
      const moon = entry.moons[stop.moonIndex];
      stop.bodyRef = moon.mesh;
      stop.bodyRadius = moon.data.radius;
      // 2.4× radius fills ~55% of FOV — survey distance with detail.
      // Minimum 0.04 keeps tiny moons visible above billboard threshold
      // while getting close enough to show surface detail at retro resolution.
      stop.orbitDistance = Math.max(moon.data.radius * 2.4, 0.04);
    }
  }
}

/**
 * Update focusIndex/focusMoonIndex/focusStarIndex from a queue stop.
 * Keeps the minimap focus ring in sync during autopilot.
 */
function updateFocusFromStop(stop) {
  if (stop.type === 'star') {
    focusIndex = -2;
    focusStarIndex = stop.starIndex;
    focusMoonIndex = -1;
  } else if (stop.type === 'planet') {
    focusIndex = stop.planetIndex;
    focusMoonIndex = -1;
    focusStarIndex = -1;
  } else if (stop.type === 'moon') {
    focusIndex = stop.planetIndex; // minimap highlights parent planet
    focusMoonIndex = stop.moonIndex;
    focusStarIndex = -1;
  }
}

/**
 * Start the cinematic flythrough tour.
 * Engages from wherever the camera is — picks a random body and
 * begins flying toward it. No teleport, no descend.
 */
function startFlythrough() {
  if (!system) return;

  autoNav.buildQueue(system);
  populateQueueRefs();
  autoNav.start();

  // Pick a random starting stop from the tour queue
  const startIdx = Math.floor(Math.random() * autoNav.queue.length);
  autoNav.currentIndex = startIdx;

  const firstStop = autoNav.getCurrentStop();
  if (!firstStop || !firstStop.bodyRef) return;

  // Bypass manual camera — flythrough drives camera directly
  cameraController.bypassed = true;

  // Set next body ref for the upcoming orbit's departure direction
  const upcoming = autoNav.getNextStop();
  flythrough.nextBodyRef = upcoming ? upcoming.bodyRef : null;

  // Begin travel from current camera position to the random body
  flythrough.beginTravelFrom(
    firstStop.bodyRef,
    firstStop.orbitDistance,
    firstStop.bodyRadius,
  );

  // "Now targeting" — blink the destination on minimap
  updateFocusFromStop(firstStop);
  if (systemMap) systemMap.triggerBlink();

  console.log('Autopilot: on (flythrough)');
}

/**
 * Stop the flythrough and hand camera back to manual orbit control.
 */
function stopFlythrough() {
  if (!autoNav.isActive && !flythrough.active) return;

  flythrough.stop();
  autoNav.stop();

  if (!system) {
    cameraController.bypassed = false;
    return;
  }

  // Find closest body to camera and restore orbit around it
  const closest = findClosestBody();
  if (closest) {
    cameraController.restoreFromWorldState(closest.position);
    focusIndex = closest.focusIndex;
    focusMoonIndex = closest.moonIndex;
    focusStarIndex = closest.starIndex;
  } else {
    cameraController.bypassed = false;
  }

  console.log('Autopilot: off');
}

/**
 * Find the closest body to the camera for seamless handoff.
 */
function findClosestBody() {
  if (!system) return null;

  let closest = null;
  let closestDist = Infinity;

  const camPos = camera.position;

  // Check stars
  const checkBody = (position, focusIdx, moonIdx, starIdx) => {
    const d = camPos.distanceTo(position);
    if (d < closestDist) {
      closestDist = d;
      closest = { position, focusIndex: focusIdx, moonIndex: moonIdx, starIndex: starIdx };
    }
  };

  checkBody(system.star.mesh.position, -2, -1, 0);
  if (system.star2) {
    checkBody(system.star2.mesh.position, -2, -1, 1);
  }

  // Check planets and moons
  for (let i = 0; i < system.planets.length; i++) {
    const entry = system.planets[i];
    checkBody(entry.planet.mesh.position, i, -1, -1);
    for (let m = 0; m < entry.moons.length; m++) {
      checkBody(entry.moons[m].mesh.position, i, m, -1);
    }
  }

  return closest;
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
    const viewDist = entry.planet.data.radius * 6;
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
  const idealDist = starObj.data.radius * 6;
  const viewDist = Math.min(idealDist, innerOrbit * 0.4);
  cameraController.focusOn(starObj.mesh.position, viewDist);
  const label = system.isBinary
    ? (starIdx === 0 ? 'primary star' : 'secondary star')
    : 'star';
  console.log(`Focus: ${label} (${starObj.data.type}-class)`);
}

/**
 * Focus the camera on a specific moon.
 */
function focusMoon(planetIndex, moonIndex) {
  if (!system) return;
  if (planetIndex < 0 || planetIndex >= system.planets.length) return;
  const entry = system.planets[planetIndex];
  if (moonIndex < 0 || moonIndex >= entry.moons.length) return;

  const moon = entry.moons[moonIndex];
  const viewDist = moon.data.radius * 8;
  focusIndex = planetIndex;
  focusMoonIndex = moonIndex;
  focusStarIndex = -1;
  cameraController.focusOn(moon.mesh.position, viewDist);
  console.log(`Focus: moon ${moonIndex + 1} of planet ${planetIndex + 1} (${moon.data.type})`);
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
  // Swap HUD between gravity well contour map and system map
  if (gravityWellVisible && gravityWell) {
    retroRenderer.setHud(gravityWell.scene, gravityWell.camera);
  } else if (systemMap) {
    retroRenderer.setHud(systemMap.scene, systemMap.camera);
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

    // ── Update star glow (distance-adaptive) ──
    system.star.updateGlow(camera);
    if (system.star2) system.star2.updateGlow(camera);

    // ── Update asteroid belts ──
    for (const belt of system.asteroidBelts) {
      belt.update(deltaTime);
      // Update star positions for per-fragment lighting (binary)
      if (system.isBinary) {
        belt.updateStarPositions(system.star.mesh.position, system.star2.mesh.position);
      }
    }

    // ── Update gravity well minimap positions (map-unit coords) ──
    if (gravityWell && gravityWellVisible && gravityWellPlanets) {
      // Sync planet positions from main system orbit angles → map-unit orbits
      for (let i = 0; i < system.planets.length && i < gravityWellPlanets.length; i++) {
        const angle = system.planets[i].orbitAngle;
        const mapOrbit = gravityWellPlanets[i].orbitRadius;
        gravityWellPlanets[i].planet.mesh.position.set(
          Math.cos(angle) * mapOrbit, 0, Math.sin(angle) * mapOrbit,
        );
      }
      gravityWell.updatePlanetPositions(gravityWellPlanets);

      // Binary star positions in map units
      if (system.isBinary) {
        const q = system.binaryMassRatio;
        const sep = system.binarySeparationMap;
        const r1 = sep * q / (1 + q);
        const r2 = sep * 1.0 / (1 + q);
        const bAngle = system.binaryOrbitAngle;
        _star1Pos.set(Math.cos(bAngle) * r1, 0, Math.sin(bAngle) * r1);
        _star2Pos.set(-Math.cos(bAngle) * r2, 0, -Math.sin(bAngle) * r2);
        gravityWell.updateStarPositions(_star1Pos, _star2Pos);
      }
    }

    // ── LOD: billboard vs mesh ──
    // When a body is too small to see at render resolution, hide the mesh
    // and show a fixed-size billboard dot instead. This ensures planets
    // and moons are always visible from any distance.
    {
      const fovRad = camera.fov * Math.PI / 180;
      const renderHeight = window.innerHeight / retroRenderer.pixelScale;
      const projScale = renderHeight / (2 * Math.tan(fovRad / 2));

      for (const entry of system.planets) {
        // Planet LOD
        const pDist = camera.position.distanceTo(entry.planet.mesh.position);
        const pPixels = (entry.planet.data.radius * 2) * projScale / pDist;
        const pShowBillboard = pPixels < 3;
        entry.planet.mesh.visible = !pShowBillboard;
        entry.billboard.sprite.visible = pShowBillboard;
        entry.billboard.sprite.position.copy(entry.planet.mesh.position);
        entry.billboard.update(camera, retroRenderer.pixelScale);

        // Moon LOD
        for (let m = 0; m < entry.moons.length; m++) {
          const moon = entry.moons[m];
          const mDist = camera.position.distanceTo(moon.mesh.position);
          const mPixels = (moon.data.radius * 2) * projScale / mDist;
          const mShowBillboard = mPixels < 3;
          moon.mesh.visible = !mShowBillboard;
          const moonBb = entry.moonBillboards[m];
          moonBb.sprite.visible = mShowBillboard;
          moonBb.sprite.position.copy(moon.mesh.position);
          moonBb.update(camera, retroRenderer.pixelScale);
        }
      }
    }

    // ── Autopilot (cinematic flythrough) ──
    if (!autoNav.isActive) {
      idleTimer += deltaTime;
      if (idleTimer >= IDLE_THRESHOLD) {
        startFlythrough();
      }
    } else if (flythrough.active) {
      const result = flythrough.update(deltaTime);

      // "Now targeting" — 2s before orbit ends, blink the next target
      if (result.targetingReady) {
        const previewStop = autoNav.getNextStop();
        if (previewStop) {
          updateFocusFromStop(previewStop);
          if (systemMap) systemMap.triggerBlink();
        }
      }

      if (result.orbitComplete) {
        // Orbit finished — begin travel to next body
        const nextStop = autoNav.advanceToNext();
        if (nextStop && nextStop.bodyRef) {
          flythrough.beginTravel(nextStop.bodyRef, nextStop.orbitDistance, nextStop.bodyRadius);
          const upcoming = autoNav.getNextStop();
          flythrough.nextBodyRef = upcoming ? upcoming.bodyRef : null;
          updateFocusFromStop(nextStop);
        }
      }

      if (result.travelComplete) {
        // Arrived at next body — begin orbit
        const stop = autoNav.getCurrentStop();
        if (stop && stop.bodyRef) {
          // Set next body ref BEFORE orbit so the orbit direction
          // can be optimized for departure toward the next body
          const upcoming = autoNav.getNextStop();
          flythrough.nextBodyRef = upcoming ? upcoming.bodyRef : null;
          flythrough.beginOrbit(stop.bodyRef, stop.orbitDistance, stop.bodyRadius, stop.linger);
          // Show current body on minimap (no blink — we just arrived)
          updateFocusFromStop(stop);
        }
      }
    }

    // ── Camera tracking (manual mode only) ──
    // Skip during flythrough (camera is driven by FlythroughCamera)
    // Skip during free-look (user controls the view)
    if (!cameraController.bypassed && !cameraController.isFreeLooking) {
      if (focusIndex === -2 && focusStarIndex >= 0) {
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

  // ── Update HUD ──
  // During flythrough, compute yaw from camera position relative to origin
  const hudYaw = cameraController.bypassed
    ? Math.atan2(camera.position.x, camera.position.z)
    : cameraController.smoothedYaw;
  if (systemMap) {
    systemMap.update(camera, hudYaw, focusIndex, deltaTime);
  }
  if (gravityWell && gravityWellVisible) {
    gravityWell.update(hudYaw);
  }

  retroRenderer.render();
}

// ── Handle Window Resize ──
window.addEventListener('resize', () => retroRenderer.resize());

// ── Keyboard shortcuts ──
window.addEventListener('keydown', (e) => {
  // A key: toggle autopilot
  if (e.code === 'KeyA') {
    if (autoNav.isActive) {
      stopFlythrough();
    } else if (system) {
      idleTimer = 0;
      startFlythrough();
    }
    return;
  }

  // During autopilot, some keys redirect the tour instead of normal behavior
  if (autoNav.isActive) {
    if (e.code === 'Space') {
      e.preventDefault();
      stopFlythrough();
      seedCounter++;
      spawnSystem();
    } else if (e.code === 'Tab') {
      e.preventDefault();
      // Jump tour forward/back — begin travel to the new stop
      const stop = autoNav.advance(e.shiftKey ? -1 : 1);
      if (stop && stop.bodyRef) {
        flythrough.beginTravel(stop.bodyRef, stop.orbitDistance, stop.bodyRadius);
        const upcoming = autoNav.getNextStop();
        flythrough.nextBodyRef = upcoming ? upcoming.bodyRef : null;
      }
    } else if (e.key === '1') {
      const stop = autoNav.jumpToStar();
      if (stop && stop.bodyRef) {
        flythrough.beginTravel(stop.bodyRef, stop.orbitDistance, stop.bodyRadius);
        const upcoming = autoNav.getNextStop();
        flythrough.nextBodyRef = upcoming ? upcoming.bodyRef : null;
      }
    } else if (e.key >= '2' && e.key <= '9') {
      const planetIdx = parseInt(e.key) - 2;
      if (system && planetIdx < system.planets.length) {
        const stop = autoNav.jumpToPlanet(planetIdx);
        if (stop && stop.bodyRef) {
          flythrough.beginTravel(stop.bodyRef, stop.orbitDistance, stop.bodyRadius);
          const upcoming = autoNav.getNextStop();
          flythrough.nextBodyRef = upcoming ? upcoming.bodyRef : null;
        }
      }
    }
    // O, G still work normally during autopilot
    if (e.code === 'KeyO') toggleOrbits();
    if (e.code === 'KeyG') toggleGravityWell();
    return;
  }

  // Normal mode (autopilot off) — reset idle timer
  idleTimer = 0;

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

  // Find the first hit on a VISIBLE object.
  // Both mesh and billboard are in clickTargets, but LOD hides one at a time.
  // Also check parent visibility — planet meshes are inside a Group.
  for (const hit of hits) {
    if (!hit.object.visible) continue;
    if (hit.object.parent && !hit.object.parent.visible) continue;

    const info = clickTargets.get(hit.object);
    if (!info) continue;

    if (info.type === 'star') {
      focusStar(info.starIndex);
    } else if (info.type === 'planet') {
      focusPlanet(info.planetIndex);
    } else if (info.type === 'moon') {
      focusMoon(info.planetIndex, info.moonIndex);
    }
    break; // only process the first valid hit
  }
}

// Idle tracking — any mouse movement resets idle timer (but no free-look)
canvas.addEventListener('mousemove', (e) => {
  if (!autoNav.isActive) {
    idleTimer = 0;
  }
  // Middle mouse free-look during flythrough
  if (flythrough.active && _middleMouseDown) {
    flythrough.addFreeLook(-e.movementX * 0.002, -e.movementY * 0.0015);
  }
});

// Middle mouse tracking for flythrough free-look
let _middleMouseDown = false;

// Mouse click
canvas.addEventListener('mousedown', (e) => {
  _mouseDown.x = e.clientX;
  _mouseDown.y = e.clientY;
  if (e.button === 1) {
    _middleMouseDown = true;
  }
  // Left-click drag turns off autopilot
  if (e.button === 0 && autoNav.isActive) {
    stopFlythrough();
  }
  if (!autoNav.isActive) idleTimer = 0;
});

window.addEventListener('mouseup', (e) => {
  if (e.button === 1) {
    _middleMouseDown = false;
    if (flythrough.active) flythrough.clearFreeLook();
  }
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
  if (!autoNav.isActive) idleTimer = 0;
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
    } else if (action === 'autonav') {
      if (autoNav.isActive) {
        stopFlythrough();
        btn.classList.remove('active');
      } else if (system) {
        idleTimer = 0;
        startFlythrough();
        btn.classList.add('active');
      }
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

    // Close menu after action (except toggles)
    if (action !== 'orbits' && action !== 'gravity' && action !== 'gyro' && action !== 'autonav') {
      mobileMenu.classList.remove('open');
    }
  });
}

// ── Start ──
animate();
console.log('Well Dipper — Star System');
console.log('Controls: Space=new system, Tab=next planet, 1-9=planet#, Esc=overview, O=orbits, G=gravity wells, A=autopilot, Middle-click=free look, Click/tap=select');
