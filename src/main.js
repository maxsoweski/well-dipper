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
import { PlanetGenerator } from './generation/PlanetGenerator.js';
import { MoonGenerator } from './generation/MoonGenerator.js';
import { DestinationPicker } from './generation/DestinationPicker.js';
import { GalaxyGenerator } from './generation/GalaxyGenerator.js';
import { NebulaGenerator } from './generation/NebulaGenerator.js';
import { ClusterGenerator } from './generation/ClusterGenerator.js';
import { Galaxy } from './objects/Galaxy.js';
import { Nebula } from './objects/Nebula.js';
import { VolumetricNebula } from './objects/VolumetricNebula.js';
import { NavigableNebulaGenerator } from './generation/NavigableNebulaGenerator.js';
import { NavigableClusterGenerator } from './generation/NavigableClusterGenerator.js';
import { SeededRandom } from './generation/SeededRandom.js';
import { SystemMap } from './ui/SystemMap.js';
import { AutoNavigator } from './auto/AutoNavigator.js';
import { FlythroughCamera } from './auto/FlythroughCamera.js';
import { WarpEffect } from './effects/WarpEffect.js';
import { Settings } from './ui/Settings.js';
import { BodyInfo } from './ui/BodyInfo.js';
import { SoundEngine } from './audio/SoundEngine.js';
import { MusicManager } from './audio/MusicManager.js';

// ── User Settings (localStorage-backed) ──
const settings = new Settings();

// ── Audio ──
const soundEngine = new SoundEngine(settings);
const musicManager = new MusicManager(soundEngine, settings);

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
retroRenderer.setColorPalette(settings.get('colorPalette'));

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
const starfield = new Starfield(settings.get('starDensity'), 500);
starfield.addTo(retroRenderer.starfieldScene);

// ── System State ──
let seedCounter = 0;
let system = null;
let focusIndex = -1;   // -1 = system overview, 0+ = focused planet index
let focusMoonIndex = -1; // -1 = focused on planet itself, 0+ = specific moon
let orbitsVisible = settings.get('showOrbits');
let gravityWellVisible = settings.get('showGravityWells');
let minimapVisible = settings.get('showMinimap');
let gravityWell = null;        // GravityWellMap instance (contour minimap)
let gravityWellPlanets = null; // lightweight position proxies for the well
let systemMap = null;

// ── Body Info HUD ──
const bodyInfo = new BodyInfo();

// ── Autopilot (cinematic flythrough) ──
const autoNav = new AutoNavigator();
const flythrough = new FlythroughCamera(camera);
let idleTimer = 0;

// ── Warp transition (system-to-system) ──
const warpEffect = new WarpEffect();
let pendingSystemData = null; // pre-generated data cached during fold phase

// ── Warp target selection ──
// Tracks which background star the user clicked (or auto-selected).
// Direction is used when starting warp so the rift opens toward that star.
const warpTarget = {
  direction: null,   // THREE.Vector3 world-space direction, or null
  blinkTimer: 0,     // accumulates time for 2 Hz blink
  blinkOn: false,    // current blink state
  turning: false,    // camera is rotating to face target before warp
  turnTimer: 0,      // seconds into the turn
  lockBlinkFrames: 0, // frame counter for rapid lock-on blink
};

// When the tour visits every body, auto-select a visible star and warp toward it.
// Brackets blink for 1.5s, then camera turns to face it, then warp fires.
autoNav.onTourComplete = () => {
  // Navigable deep sky (nebulae, open clusters): just loop the tour.
  // The user can manually warp with Space when they want to leave.
  if (system && system._navigable) return;

  autoSelectWarpTarget();
  setTimeout(() => {
    beginWarpTurn();
  }, 1500);
};

// Deep sky contemplation: camera stays fixed, timer triggers next warp.
// No autopilot, no orbiting — these objects are impossibly far away.
let _deepSkyLingerTimer = -1; // -1 = not lingering, >=0 = counting down
let _deepSkyDrift = null;     // { startPos, endPos, duration, elapsed } — momentum coast on arrival

// Debug: force the next warp to a specific destination type.
// Press comma/period/? then Space to force galaxy/nebula/cluster.
let _forceNextDestType = null;
const _heldKeys = new Set();

// ── Title screen ──
let titleScreenActive = true;
let _titleAutoTimer = null;

function dismissTitleScreen() {
  if (!titleScreenActive) return;
  titleScreenActive = false;
  soundEngine.play('titleDismiss');
  musicManager.play('explore');
  if (_titleAutoTimer) { clearTimeout(_titleAutoTimer); _titleAutoTimer = null; }

  const el = document.getElementById('title-screen');
  if (el) {
    el.classList.add('fading');
    setTimeout(() => { el.style.display = 'none'; }, 1000);
  }

  // Smooth zoom-out: transition orbit center back to origin (object center)
  // and zoom to the same distance startFlythrough would use, so there's no snap.
  cameraController.autoRotateSpeed = settings.get('autoRotateSpeed');
  cameraController._targetGoal.set(0, 0, 0);
  cameraController._transitioning = true;
  cameraController._transitionSpeed = 0.02; // slow, graceful transition
  // Zoom to the exact distance startFlythrough uses for distant deep sky
  const radius = system?.destination?.data?.radius || 200;
  const flyViewDist = radius * 1.25;
  cameraController.distance = flyViewDist;
  cameraController.zoomSpeed = 0;

  // After the smooth transition settles, hand off to free-look orbit or autopilot.
  setTimeout(() => {
    if (!system) return;
    const isDistantDeepSky = system.type && system.type !== 'star-system' && !system._navigable;
    if (isDistantDeepSky) {
      // Free-look orbit (not bypassed) — user can drag to look around
      cameraController.autoRotateActive = true;
      _deepSkyLingerTimer = 15;
    } else if (!autoNav.isActive) {
      idleTimer = 0;
      startFlythrough();
    }
  }, 5000);
}

function toggleKeybinds() {
  const el = document.getElementById('keybinds-overlay');
  if (!el) return;
  el.style.display = el.style.display === 'none' ? 'flex' : 'none';
}

// ── Settings Panel ──
let _settingsOpen = false;

function formatSettingValue(key, value) {
  if (key === 'idleTimeout' || key === 'titleAutoDismiss') return `${value}s`;
  if (key === 'deepSkyChance') return `${value}%`;
  if (key === 'tourLingerMultiplier') return `${value.toFixed(1)}x`;
  if (key === 'autoRotateSpeed') return `${value.toFixed(1)}`;
  if (key === 'zoomSensitivity') return `${value.toFixed(1)}x`;
  if (key === 'starDensity') return `${Math.round(value / 1000)}k`;
  if (key === 'masterVolume' || key === 'musicVolume' || key === 'sfxVolume')
    return `${Math.round(value * 100)}%`;
  return String(value);
}

function populateSettingsUI() {
  const el = document.getElementById('settings-overlay');
  if (!el) return;
  el.querySelectorAll('[data-setting]').forEach(input => {
    const key = input.dataset.setting;
    if (key === 'fullscreen') {
      input.checked = !!document.fullscreenElement;
      return;
    }
    const value = settings.get(key);
    if (input.type === 'checkbox') {
      input.checked = value;
    } else if (input.tagName === 'SELECT') {
      input.value = String(value);
    } else {
      input.value = value;
      const label = input.nextElementSibling;
      if (label?.classList.contains('setting-value')) {
        label.textContent = formatSettingValue(key, value);
      }
    }
  });
}

function toggleSettings() {
  const el = document.getElementById('settings-overlay');
  if (!el) return;
  _settingsOpen = !_settingsOpen;
  soundEngine.play('uiClick');
  if (_settingsOpen) {
    populateSettingsUI();
    el.style.display = 'flex';
  } else {
    el.style.display = 'none';
  }
}

function applySettingChange(key, value) {
  switch (key) {
    case 'pixelScale':
      retroRenderer.pixelScale = value;
      retroRenderer.resize();
      break;
    case 'autoRotateSpeed':
      cameraController.autoRotateSpeed = value;
      break;
    case 'zoomSensitivity':
      cameraController.scrollSensitivity = value;
      break;
    case 'showOrbits':
      if (orbitsVisible !== value) toggleOrbits();
      break;
    case 'showMinimap':
      minimapVisible = value;
      if (minimapVisible && systemMap && !gravityWellVisible) {
        retroRenderer.setHud(systemMap.scene, systemMap.camera);
      } else if (!minimapVisible && !gravityWellVisible) {
        retroRenderer.setHud(null, null);
      }
      break;
    case 'showGravityWells':
      if (gravityWellVisible !== value) toggleGravityWell();
      break;
    case 'fullscreen':
      if (value && !document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else if (!value && document.fullscreenElement) {
        document.exitFullscreen();
      }
      break;
    case 'colorPalette':
      retroRenderer.setColorPalette(value);
      break;
    case 'masterVolume':
    case 'musicVolume':
    case 'sfxVolume':
      soundEngine.updateVolumes();
      musicManager.updateVolumes();
      break;
  }
}

// Settings input event delegation
{
  const settingsEl = document.getElementById('settings-overlay');
  if (settingsEl) {
    function handleSettingsInput(e) {
      const input = e.target;
      const key = input.dataset.setting;
      if (!key) return;

      if (key === 'fullscreen') {
        applySettingChange(key, input.checked);
        return;
      }

      let value;
      if (input.type === 'checkbox') {
        value = input.checked;
      } else if (input.tagName === 'SELECT') {
        value = parseInt(input.value, 10);
      } else {
        value = parseFloat(input.value);
      }
      settings.set(key, value);

      // Update value label
      const label = input.nextElementSibling;
      if (label?.classList.contains('setting-value')) {
        label.textContent = formatSettingValue(key, value);
      }

      applySettingChange(key, value);
    }
    settingsEl.addEventListener('input', handleSettingsInput);
    settingsEl.addEventListener('change', handleSettingsInput);

    // Reset button
    settingsEl.querySelector('.settings-reset')?.addEventListener('click', () => {
      settings.reset();
      // Re-apply all defaults
      retroRenderer.pixelScale = settings.get('pixelScale');
      retroRenderer.resize();
      retroRenderer.setColorPalette(settings.get('colorPalette'));
      cameraController.autoRotateSpeed = settings.get('autoRotateSpeed');
      cameraController.scrollSensitivity = settings.get('zoomSensitivity');
      soundEngine.updateVolumes();
      musicManager.updateVolumes();
      populateSettingsUI();
    });

    // Close button
    settingsEl.querySelector('.overlay-close')?.addEventListener('click', () => {
      toggleSettings();
    });

    // Tap backdrop to close
    settingsEl.addEventListener('click', (e) => {
      if (e.target === settingsEl) toggleSettings();
    });

    // Update fullscreen checkbox when fullscreen state changes
    document.addEventListener('fullscreenchange', () => {
      const fsCheckbox = settingsEl.querySelector('[data-setting="fullscreen"]');
      if (fsCheckbox) fsCheckbox.checked = !!document.fullscreenElement;
    });
  }
}

// Keybinds close button
{
  const keybindsEl = document.getElementById('keybinds-overlay');
  if (keybindsEl) {
    keybindsEl.querySelector('.overlay-close')?.addEventListener('click', () => {
      toggleKeybinds();
    });

    // Tap backdrop to close
    keybindsEl.addEventListener('click', (e) => {
      if (e.target === keybindsEl) toggleKeybinds();
    });
  }
}

// ── Sound Test Mode ──
// Press T to open/close. Buttons trigger each SFX and music track.
let _soundTestOpen = false;
let _soundTestPopulated = false;

const SOUNDTEST_SFX = [
  { name: 'select', label: 'Select' },
  { name: 'cycle', label: 'Cycle' },
  { name: 'newSystem', label: 'New System' },
  { name: 'toggleOn', label: 'Toggle On' },
  { name: 'toggleOff', label: 'Toggle Off' },
  { name: 'autopilotOn', label: 'Autopilot On' },
  { name: 'autopilotOff', label: 'Autopilot Off' },
  { name: 'warpTarget', label: 'Warp Target' },
  { name: 'warpLockOn', label: 'Warp Lock-On' },
  { name: 'warpCharge', label: 'Warp Charge' },
  { name: 'warpEnter', label: 'Warp Enter' },
  { name: 'warpExit', label: 'Warp Exit' },
  { name: 'titleDismiss', label: 'Title Dismiss' },
  { name: 'uiClick', label: 'UI Click' },
];

const SOUNDTEST_BGM = [
  { name: 'title', label: 'Title' },
  { name: 'explore', label: 'Explore' },
  { name: 'hyperspace', label: 'Hyperspace' },
  { name: 'deepsky', label: 'Deep Sky' },
  { name: 'warp-charge', label: 'Warp Charge (sting)' },
  { name: 'arrival', label: 'Arrival (sting)' },
];

function populateSoundTest() {
  if (_soundTestPopulated) return;
  _soundTestPopulated = true;

  const sfxGrid = document.getElementById('soundtest-sfx');
  const bgmGrid = document.getElementById('soundtest-bgm');

  // SFX buttons
  for (const sfx of SOUNDTEST_SFX) {
    const btn = document.createElement('button');
    btn.className = 'soundtest-btn';
    btn.textContent = sfx.label;
    btn.addEventListener('click', () => {
      soundEngine.play(sfx.name);
    });
    sfxGrid.appendChild(btn);
  }

  // BGM buttons
  for (const track of SOUNDTEST_BGM) {
    const btn = document.createElement('button');
    btn.className = 'soundtest-btn';
    btn.dataset.track = track.name;
    btn.textContent = track.label;
    btn.addEventListener('click', () => {
      // Highlight active track
      bgmGrid.querySelectorAll('.soundtest-btn').forEach(b => b.classList.remove('playing'));

      const isOnce = track.name === 'warp-charge' || track.name === 'arrival';
      if (isOnce) {
        musicManager.playOnce(track.name);
      } else {
        btn.classList.add('playing');
        musicManager.play(track.name, 0.5);
      }
    });
    bgmGrid.appendChild(btn);
  }

  // Stop music button
  document.getElementById('soundtest-stop-music')?.addEventListener('click', () => {
    bgmGrid.querySelectorAll('.soundtest-btn').forEach(b => b.classList.remove('playing'));
    musicManager.stop(0.5);
  });
}

function toggleSoundTest() {
  const el = document.getElementById('soundtest-overlay');
  if (!el) return;
  _soundTestOpen = !_soundTestOpen;
  soundEngine.play('uiClick');
  if (_soundTestOpen) {
    populateSoundTest();
    // Highlight currently playing track
    const bgmGrid = document.getElementById('soundtest-bgm');
    if (bgmGrid) {
      bgmGrid.querySelectorAll('.soundtest-btn').forEach(b => {
        b.classList.toggle('playing', b.dataset.track === musicManager.currentTrack);
      });
    }
    el.style.display = 'flex';
  } else {
    el.style.display = 'none';
  }
}

// Sound test close button + backdrop
{
  const soundTestEl = document.getElementById('soundtest-overlay');
  if (soundTestEl) {
    soundTestEl.querySelector('.overlay-close')?.addEventListener('click', () => {
      toggleSoundTest();
    });
    soundTestEl.addEventListener('click', (e) => {
      if (e.target === soundTestEl) toggleSoundTest();
    });
  }
}

// ── Debug Gallery Mode ──
// Press D to enter/exit. ↑/↓ cycle types, ←/→ cycle seeds.
// Shows deep sky objects, stars, planets, and moons one at a time for evaluation.
const GALLERY_TYPES = [
  // Deep sky (distant view)
  'spiral-galaxy', 'elliptical-galaxy',
  'emission-nebula', 'planetary-nebula',
  'globular-cluster', 'open-cluster',
  // Deep sky (navigable — fly inside)
  'volumetric-nebula-test',
  'nav-planetary-nebula', 'nav-emission-nebula',
  'nav-open-cluster',
  // Star system objects
  'star',
  'planet-rocky', 'planet-terrestrial', 'planet-ocean', 'planet-ice',
  'planet-lava', 'planet-venus', 'planet-carbon', 'planet-eyeball',
  'planet-gas-giant', 'planet-hot-jupiter', 'planet-sub-neptune',
  'moon',
];
let galleryMode = false;
let gallerySeed = 1;
let galleryTypeIdx = 0;
let galleryObject = null;      // current Galaxy/Nebula instance (deep sky)
let _galleryMeshes = [];       // Star/Planet/Moon meshes (star system objects)
const _galleryOrigin = new THREE.Vector3(0, 0, 0); // parent position for gallery moons

// Pre-generate next system DATA at fold start (cheap CPU work, ~1-5ms).
// By the time we need to create GPU resources (hyper start), data is ready.
warpEffect.onPrepareSystem = () => {
  bodyInfo.hide();
  soundEngine.play('warpCharge');
  musicManager.duck(0.15, 4.0);
  seedCounter++;
  const seed = `system-${seedCounter}`;
  const rng = new SeededRandom(seed);
  // Use settings-based deep sky chance (overrides DestinationPicker's static weights)
  let destType;
  if (_forceNextDestType) {
    destType = _forceNextDestType;
  } else {
    const dsChance = settings.get('deepSkyChance') / 100;
    if (rng.float() >= dsChance) {
      destType = 'star-system';
    } else {
      // Pick a deep sky subtype (re-roll excluding star-system)
      destType = DestinationPicker.pickDeepSky(rng);
    }
  }
  _forceNextDestType = null; // clear after use

  if (destType === 'star-system') {
    pendingSystemData = StarSystemGenerator.generate(seed);
  } else if (destType === 'emission-nebula' || destType === 'planetary-nebula') {
    // Navigable nebulae — nav generator for star positions, billboard generator for visuals
    pendingSystemData = NavigableNebulaGenerator.generate(seed, destType);
    pendingSystemData._billboardData = NebulaGenerator.generate(seed, destType);
  } else if (destType === 'open-cluster') {
    // Navigable open cluster — use the new cluster generator
    pendingSystemData = NavigableClusterGenerator.generate(seed);
  } else if (destType.includes('galaxy')) {
    pendingSystemData = GalaxyGenerator.generate(seed, destType);
  } else if (destType.includes('cluster')) {
    // globular-cluster — distant view
    pendingSystemData = ClusterGenerator.generate(seed, destType);
  }
  pendingSystemData._destType = destType;
  console.log(`Warp: pre-generated "${destType}" (seed "${seed}") during fold`);
};

// System swap at hyper start (tunnel is opaque, hides any GPU resource creation)
warpEffect.onSwapSystem = () => {
  soundEngine.play('warpEnter');
  musicManager.play('hyperspace', 0.3);
  warpSwapSystem();
};

// When warp exit finishes, reveal the new system and restart autopilot
warpEffect.onComplete = () => {
  soundEngine.play('warpExit');
  // Switch to explore or deepsky track based on destination type
  const isDeepSky = system?.type && system.type !== 'star-system';
  musicManager.play(isDeepSky ? 'deepsky' : 'explore', 2.0);
  warpRevealSystem();
};

// ── Click-to-select (raycasting) ──
const raycaster = new THREE.Raycaster();
const _mouse = new THREE.Vector2();
let _orbitLineTargets = new Map(); // orbit line mesh → { type, planetIndex, moonIndex?, center, radius }
let _hoveredOrbitLine = null;      // currently hovered orbit line mesh
let _lastOrbitHoverTime = 0;       // throttle timer for hover check
const _mouseDown = { x: 0, y: 0 };
let clickTargets = new Map();
const _projVec = new THREE.Vector3(); // reusable for screen projection

/**
 * Screen-space orbit hit test.
 * Samples 24 points around each orbit, projects them to screen pixels,
 * and finds the closest point to the mouse. This handles perspective
 * distortion correctly (orbits look like ellipses from most angles).
 */
/**
 * Screen-space orbit hit test.
 * Reads actual vertex positions from orbit line geometry, applies the mesh's
 * world transform, projects to screen, and finds closest point to mouse.
 * Samples every Nth vertex to keep it fast (~24 samples per orbit).
 */
function hitTestOrbits(clientX, clientY, thresholdPx = 8) {
  if (_orbitLineTargets.size === 0) return null;
  camera.updateMatrixWorld(true);

  const rect = canvas.getBoundingClientRect();
  const hw = rect.width * 0.5;
  const hh = rect.height * 0.5;
  const localX = clientX - rect.left;
  const localY = clientY - rect.top;

  let best = null;
  let bestDistSq = thresholdPx * thresholdPx;

  for (const [mesh, info] of _orbitLineTargets) {
    if (!mesh.visible) continue;
    mesh.updateMatrixWorld(true);
    const posAttr = mesh.geometry.getAttribute('position');

    for (let i = 0; i < posAttr.count; i++) {
      _projVec.set(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
      _projVec.applyMatrix4(mesh.matrixWorld);
      _projVec.project(camera);
      if (_projVec.z > 1) continue;
      const sx = (_projVec.x * hw) + hw;
      const sy = (-_projVec.y * hh) + hh;
      const dx = localX - sx;
      const dy = localY - sy;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestDistSq) {
        bestDistSq = d2;
        best = { info, mesh };
      }
    }
  }
  return best;
}

// ── Title screen: spawn a random deep sky object as the backdrop ──
{
  const titleSeed = `title-${Date.now()}`;
  const titleRng = new SeededRandom(titleSeed);
  // Only use distant-view types so the object is visible as a whole showcase.
  // Nebulae use NebulaGenerator (distant billboard), not NavigableNebulaGenerator.
  // destType uses 'title-*-nebula' to avoid isNavigable() routing in spawnSystem.
  const deepSkyTypes = ['spiral-galaxy', 'elliptical-galaxy', 'emission-nebula',
                         'planetary-nebula', 'globular-cluster'];
  const titleType = deepSkyTypes[titleRng.int(0, deepSkyTypes.length - 1)];
  let titleData;
  if (titleType.includes('galaxy')) {
    titleData = GalaxyGenerator.generate(titleSeed, titleType);
    titleData._destType = titleType;
  } else if (titleType === 'emission-nebula' || titleType === 'planetary-nebula') {
    titleData = NebulaGenerator.generate(titleSeed, titleType);
    // Use a destType that won't match isNavigable() but still routes to Nebula class
    titleData._destType = `title-${titleType}`;
  } else {
    titleData = ClusterGenerator.generate(titleSeed, titleType);
    titleData._destType = titleType;
  }
  spawnSystem({ systemData: titleData });

  // Orbit around a point ABOVE the object so the camera looks above center,
  // pushing the object into the lower portion of the screen.
  const r = titleData.radius || 200;
  let orbitCenter;
  if (titleType.includes('galaxy')) {
    orbitCenter = new THREE.Vector3(0, r * 0.2, 0);
    camera.position.set(r * 0.3, r * 0.55, r * 1.1);
  } else if (titleType.includes('nebula')) {
    orbitCenter = new THREE.Vector3(0, r * 0.2, 0);
    camera.position.set(0, r * 0.2, r * 1.25);
  } else {
    // Clusters
    orbitCenter = new THREE.Vector3(0, r * 0.4, 0);
    camera.position.set(0, r * 0.35, r * 1.25);
  }
  camera.lookAt(orbitCenter);
  cameraController.restoreFromWorldState(orbitCenter);
  // Slow visible orbit for the title screen showcase
  cameraController.autoRotateSpeed = 3.0;

  // Auto-dismiss title screen after configured timeout
  _titleAutoTimer = setTimeout(() => {
    if (titleScreenActive) dismissTitleScreen();
  }, settings.get('titleAutoDismiss') * 1000);

  // Mobile fullscreen button on title screen
  // Must use touchend (not click) — click fires too late on mobile, canvas touchstart
  // dismisses the title screen first. Also requestFullscreen needs a direct user gesture.
  const fsBtn = document.getElementById('title-fullscreen-btn');
  if (fsBtn) {
    fsBtn.addEventListener('touchstart', (e) => {
      e.stopPropagation();
    }, { passive: false });
    fsBtn.addEventListener('touchend', (e) => {
      e.preventDefault();
      e.stopPropagation();
      document.documentElement.requestFullscreen().catch(() => {});
      dismissTitleScreen();
    });
  }
}

/**
 * Generate and display a full star system (single or binary).
 * @param {Object} options
 * @param {boolean} options.forWarp  — if true, skip camera setup + flythrough start (warp handles that)
 * @param {Object} options.systemData — pre-generated data from StarSystemGenerator (skips re-generation)
 */
function spawnSystem({ forWarp = false, systemData: preGenData = null } = {}) {
  // ── Reset state ──
  warpTarget.direction = null;
  const wasAutopilot = autoNav.isActive;

  // Reset camera far plane (may have been extended for navigable nebulae)
  if (camera.far > 200000) {
    camera.far = 200000;
    camera.updateProjectionMatrix();
  }
  if (!forWarp) {
    stopFlythrough();
  }
  idleTimer = 0;

  // ── Clean up old system ──
  if (system) {
    if (system.type && system.type !== 'star-system') {
      // Deep sky object: destination renderer (Galaxy/Nebula/VolumetricNebula)
      if (system.destination) {
        system.destination.removeFrom(scene);
        system.destination.dispose();
      }
      // Navigable deep sky: gas cloud + extra stars
      if (system.gasCloud) {
        system.gasCloud.removeFrom(scene);
        system.gasCloud.dispose();
      }
      if (system.extraStars) {
        for (const s of system.extraStars) {
          s.dispose();
          scene.remove(s.mesh);
        }
      }
      // Clean up dummy bodyRef objects used for tour stops
      if (system._dummyRefs) {
        for (const obj of system._dummyRefs) {
          scene.remove(obj);
        }
      }
    } else {
      // Star system cleanup (existing code)
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
          const moonObj = entry.moons[m];
          moonObj.dispose();
          scene.remove(moonObj.mesh);
          if (moonObj._clickProxy) {
            scene.remove(moonObj._clickProxy);
            moonObj._clickProxy.geometry.dispose();
            moonObj._clickProxy.material.dispose();
          }
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

  // ── Generate system data (or use pre-generated data from warp prepare phase) ──
  const seed = `system-${seedCounter}`;
  const destType = preGenData?._destType || 'star-system';

  // Deep sky objects get their own spawn path
  if (DestinationPicker.isDeepSky(destType)) {
    if (DestinationPicker.isNavigable(destType)) {
      // Navigable deep sky: stars are clickable/orbitable — normal camera behavior
      cameraController.forceFreeLook = false;
      spawnNavigableDeepSky(preGenData, destType, forWarp);
    } else {
      // Non-navigable: distant view, free-look only (no orbit targets)
      cameraController.forceFreeLook = true;
      cameraController.autoRotateActive = true; // ensure auto-rotation for deep sky views
      spawnDeepSky(preGenData, destType, forWarp);
    }
    return;
  }

  // Star systems: normal orbit camera
  cameraController.forceFreeLook = false;

  const systemData = preGenData || StarSystemGenerator.generate(seed);

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
      let moon;
      if (moonData.isPlanetMoon) {
        // Planet-class moon: use full Planet renderer with a thin wrapper
        // for orbital behavior (Planet.js has no built-in orbit logic).
        const pmRatio = moonData.planetData.radius / moonData.planetData.radiusScene;
        const scenePMData = {
          ...moonData.planetData,
          radius: moonData.planetData.radiusScene,
          noiseScale: moonData.planetData.noiseScale * pmRatio,
          clouds: moonData.planetData.clouds
            ? { ...moonData.planetData.clouds, scale: moonData.planetData.clouds.scale * pmRatio }
            : null,
        };
        // Slightly dim planet-moons so they don't outshine regular moons
        // (Planet.js uses smooth diffuse vs Moon.js's contrasty smoothstep)
        const pmStarInfo = { ...systemData.starInfo, brightness1: systemData.starInfo.brightness1 * 0.7 };
        if (pmStarInfo.brightness2) pmStarInfo.brightness2 *= 0.7;
        const planetMoon = new Planet(scenePMData, pmStarInfo);
        moon = {
          mesh: planetMoon.mesh,
          data: { ...moonData, radius: moonData.radiusScene, orbitRadius: moonData.orbitRadiusScene },
          isPlanetMoon: true,
          planet: planetMoon,
          orbitAngle: moonData.startAngle,
          addTo(s) { s.add(planetMoon.mesh); },
          dispose() { planetMoon.dispose(); },
        };
      } else {
        moon = new Moon(moonData, planet._lightDir, planet._lightDir2, systemData.starInfo);
      }
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
  // Only build if there are planets (empty systems skip the gravity well).
  if (systemData.planets.length > 0) {
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
    binarySeparation: systemData.binarySeparationScene,
    binaryMassRatio: systemData.binaryMassRatio,
    binarySeparationMap: systemData.binarySeparation, // map-unit sep for gravity well
  };

  // ── System map HUD ──
  // Only create the system map if there are planets (empty systems have nothing to map)
  if (systemData.planets.length > 0) {
    systemMap = new SystemMap(systemData, system);
    if (gravityWellVisible) {
      retroRenderer.setHud(gravityWell.scene, gravityWell.camera);
    } else if (minimapVisible) {
      retroRenderer.setHud(systemMap.scene, systemMap.camera);
    } else {
      retroRenderer.setHud(null, null);
    }
  } else {
    retroRenderer.setHud(null, null);
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
      const moonObj = entry.moons[m];
      // Planet-moons use a Group (.mesh) — register the surface child for raycasting
      const moonClickMesh = moonObj.isPlanetMoon ? moonObj.planet.surface : moonObj.mesh;
      clickTargets.set(moonClickMesh, { type: 'moon', planetIndex: i, moonIndex: m });
      if (moonObj.isPlanetMoon && moonObj.planet.ring) {
        clickTargets.set(moonObj.planet.ring, { type: 'moon', planetIndex: i, moonIndex: m });
      }
      clickTargets.set(entry.moonBillboards[m].sprite, { type: 'moon', planetIndex: i, moonIndex: m });

      // Invisible click proxy — moons are tiny in scene units (0.004-0.05) so the
      // raycaster often misses the actual geometry. This larger invisible sphere
      // ensures clicks near a moon register as hits.
      const moonR = moonObj.data.radius;
      const proxyGeo = new THREE.SphereGeometry(moonR * 4, 8, 6);
      const proxyMat = new THREE.MeshBasicMaterial({ visible: false });
      const proxy = new THREE.Mesh(proxyGeo, proxyMat);
      proxy.renderOrder = -999; // never drawn
      moonObj.mesh.parent?.add(proxy) || scene.add(proxy);
      // For regular moons, proxy moves with the moon each frame — we track it
      moonObj._clickProxy = proxy;
      clickTargets.set(proxy, { type: 'moon', planetIndex: i, moonIndex: m });
    }
  }

  // Orbit lines — register for screen-space hit testing
  _orbitLineTargets = new Map();
  for (let i = 0; i < planets.length; i++) {
    _orbitLineTargets.set(orbitLines[i].mesh, { type: 'planet', planetIndex: i });
    const entry = planets[i];
    for (let m = 0; m < entry.moonOrbitLines.length; m++) {
      _orbitLineTargets.set(entry.moonOrbitLines[m].mesh, { type: 'moon', planetIndex: i, moonIndex: m });
    }
  }

  // ── Console log ──
  const starDesc = systemData.isBinary
    ? `${systemData.star.type}+${systemData.star2.type} binary`
    : `${systemData.star.type}-class star`;
  const beltDesc = systemData.asteroidBelts.length > 0
    ? `, ${systemData.asteroidBelts[0].asteroids.length} asteroids`
    : '';
  console.log(`System "${seed}" — ${starDesc}, ${systemData.planets.length} planets${beltDesc}`);

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

  // ── During warp, skip camera setup — warpRevealSystem handles that ──
  if (forWarp) return;

  // ── Opening shot ──
  if (planets.length > 0) {
    // Randomly focus a planet or moon
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
  } else {
    // Empty system — orbit the star
    focusIndex = -1;
    focusMoonIndex = -1;
    cameraController.setTarget(new THREE.Vector3(0, 0, 0));
    cameraController.yaw = Math.random() * Math.PI * 2;
    cameraController.smoothedYaw = cameraController.yaw;
    cameraController.pitch = 0.1;
    cameraController.smoothedPitch = cameraController.pitch;
    const viewDist = star.data.radius * 6;
    cameraController.distance = viewDist;
    cameraController.smoothedDistance = viewDist;
    cameraController.autoRotateActive = true;
  }

  // Restart autopilot with new system if it was active before
  if (wasAutopilot) {
    startFlythrough();
  }
}

/**
 * Spawn a deep sky destination (galaxy, nebula, or star cluster).
 * Called from spawnSystem() when the destination type is not 'star-system'.
 */
function spawnDeepSky(data, destType, forWarp) {
  let destination;
  const isGalaxyOrCluster = destType.includes('galaxy') || destType.includes('cluster');

  if (isGalaxyOrCluster) {
    destination = new Galaxy(data);
  } else {
    destination = new Nebula(data);
  }

  destination.addTo(scene);

  // Create dummy Object3Ds for tour stop bodyRefs
  // (the camera orbits these like it orbits planets)
  const dummyRefs = [];
  for (const stop of data.tourStops) {
    const obj = new THREE.Object3D();
    obj.position.set(stop.position[0], stop.position[1], stop.position[2]);
    scene.add(obj);
    dummyRefs.push(obj);
  }

  // No click targets for deep sky (clicking empty sky still selects warp targets)
  clickTargets = new Map();
  _orbitLineTargets = new Map();
  _hoveredOrbitLine = null;

  // Store as current system
  system = {
    type: destType,
    destination,
    tourStops: data.tourStops,
    _dummyRefs: dummyRefs,
    // Star system fields (null/empty so existing code doesn't crash)
    star: null,
    star2: null,
    planets: [],
    orbitLines: [],
    asteroidBelts: [],
    starOrbitLines: null,
    isBinary: false,
  };

  // Log what was created
  const label = destType.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase());
  console.log(`Deep sky: ${label} (seed "${`system-${seedCounter}`}", ${data.particleCount || data.starCount || '?'} particles, r=${data.radius?.toFixed(0) || '?'})`);

  // DEBUG: dump all scene children to find mystery sphere
  console.log(`[DEBUG] Scene children after spawnDeepSky:`);
  scene.traverse((child) => {
    if (child.isMesh || child.isPoints || child.isSprite) {
      const geo = child.geometry ? `${child.geometry.type}(${child.geometry.parameters?.radius || '?'})` : 'no-geo';
      const mat = child.material ? child.material.type : 'no-mat';
      const pos = child.getWorldPosition(new THREE.Vector3());
      console.log(`  ${child.type}: ${geo}, ${mat}, pos=(${pos.x.toFixed(0)},${pos.y.toFixed(0)},${pos.z.toFixed(0)}), visible=${child.visible}`);
    }
  });

  // During warp, skip camera setup — warpSwapSystem/warpRevealSystem handle that
  if (forWarp) return;

  // Opening shot for non-warp spawn (rare — mainly for testing)
  const firstStop = data.tourStops[0];
  if (firstStop) {
    camera.position.set(firstStop.position[0], firstStop.position[1], firstStop.position[2]);
    camera.lookAt(0, 0, 0);
    // Sync CameraController so it doesn't override the camera position
    cameraController.restoreFromWorldState(new THREE.Vector3(0, 0, 0));
  }
}

/**
 * Spawn a navigable deep sky destination (planetary/emission nebula, open cluster).
 * These are fly-inside-able, like star systems — multiple stars you can tour between,
 * and optionally a VolumetricNebula gas cloud you can fly through.
 */
function spawnNavigableDeepSky(data, destType, forWarp) {
  // ── Gas cloud (nebulae only — billboard layers scaled to navigable size) ──
  let gasCloud = null;
  if (data._billboardData) {
    const bb = data._billboardData;
    const scale = data.radius / bb.radius;

    // Scale layer positions and sizes to navigable radius
    const scaledLayers = bb.layers.map(l => ({
      ...l,
      position: [l.position[0] * scale, l.position[1] * scale, l.position[2] * scale],
      size: l.size * scale,
    }));

    // Scale embedded star particle positions and sizes
    const scaledStarPositions = new Float32Array(bb.starPositions.length);
    const scaledStarSizes = new Float32Array(bb.starSizes.length);
    for (let i = 0; i < bb.starCount; i++) {
      scaledStarPositions[i * 3]     = bb.starPositions[i * 3] * scale;
      scaledStarPositions[i * 3 + 1] = bb.starPositions[i * 3 + 1] * scale;
      scaledStarPositions[i * 3 + 2] = bb.starPositions[i * 3 + 2] * scale;
      scaledStarSizes[i] = bb.starSizes[i] * scale;
    }

    const scaledData = {
      ...bb,
      radius: data.radius,
      layers: scaledLayers,
      starPositions: scaledStarPositions,
      starColors: bb.starColors,
      starSizes: scaledStarSizes,
      centralStar: null,  // navigable stars handle this — don't duplicate
    };

    gasCloud = new Nebula(scaledData);
    gasCloud.addTo(scene);

    // Extend camera far plane to fit the nebula — layers can be 2-3x radius
    // in size, so vertices reach well beyond the default 200K far plane.
    // Without this, most of each layer is frustum-clipped, and the clip
    // boundary shifts with the camera, causing visible flicker.
    const neededFar = data.radius * 4;
    if (neededFar > camera.far) {
      camera.far = neededFar;
      camera.updateProjectionMatrix();
    }
  }

  // ── Extend far plane for large navigable destinations ──
  // Clusters can have radius 300K+ with stars scattered throughout.
  // Without this, distant stars get frustum-clipped.
  const neededFar = data.radius * 3;
  if (neededFar > camera.far) {
    camera.far = neededFar;
    camera.updateProjectionMatrix();
  }

  // ── Stars ──
  const allStars = [];
  const starInfo = {
    color1: data.stars[0]?.color || [1, 1, 1],
    brightness1: 1.0,
    color2: data.stars.length > 1 ? data.stars[1].color : [0, 0, 0],
    brightness2: data.stars.length > 1 ? 0.5 : 0,
  };

  // Clusters need bigger stars so they're visible as bright discs at typical
  // viewing distances. Nebula stars need less exaggeration since the gas
  // cloud provides visual context.
  const isCluster = destType === 'open-cluster';
  const minVisibleFrac = isCluster ? 0.002 : 0.0003;

  for (const sData of data.stars) {
    const minVisible = data.radius * minVisibleFrac;
    const renderR = Math.max(sData.renderRadius || sData.radiusScene, minVisible);
    const starObj = new Star({ ...sData, radius: renderR, color: sData.color }, renderR);
    starObj.mesh.position.set(sData.position[0], sData.position[1], sData.position[2]);
    starObj.addTo(scene);
    allStars.push(starObj);
  }

  // ── Click targets (all stars are clickable) ──
  clickTargets = new Map();
  for (let i = 0; i < allStars.length; i++) {
    clickTargets.set(allStars[i].mesh, {
      type: 'star',
      starIndex: i,
      label: `Star ${i + 1} (${data.stars[i].type})`,
    });
  }

  // ── Build system object ──
  // Shaped like a star system so autopilot/flythrough/selection code works
  system = {
    type: destType,
    destination: null,     // no distant-view destination object
    gasCloud,              // VolumetricNebula instance (or null for clusters)
    extraStars: allStars.slice(1),  // all stars beyond the primary
    star: allStars[0] || null,
    star2: allStars[1] || null,
    planets: [],
    orbitLines: [],
    asteroidBelts: [],
    starOrbitLines: null,
    isBinary: false,
    _navigable: true,      // flag for navigable deep sky
    _navRadius: data.radius,
  };

  const label = destType.replace(/-/g, ' ');
  const starCount = allStars.length;
  const gasInfo = gasCloud ? `, ${data._billboardData?.layers?.length || 0} billboard layers` : '';
  console.log(`Navigable deep sky: ${label} (${starCount} stars${gasInfo}, r=${data.radius.toFixed(0)})`);

  // During warp, skip camera setup — warpSwapSystem/warpRevealSystem handle that
  if (forWarp) return;

  // Non-warp opening: position camera to see the first star with context
  if (allStars[0]) {
    const pos = allStars[0].mesh.position;
    // Clusters: closer to the star so it's a prominent bright disc.
    // Nebulae: further out so you see the gas cloud structure.
    const viewFrac = isCluster ? 0.04 : 0.15;
    const viewDist = data.radius * viewFrac;
    camera.position.set(pos.x, pos.y + viewDist * 0.2, pos.z + viewDist);
    camera.lookAt(pos);
    // Sync CameraController so it doesn't override the camera position
    cameraController.restoreFromWorldState(pos.clone());
  }
}

// ── Debug Instant Spawn ────────────────────────────────────────
// Jump directly to any system type without warping (Shift+1 through Shift+7).
// Generates data the same way the warp pipeline does, then calls spawnSystem.
let _debugSeedCounter = 1000;

function _debugSpawnType(destType) {
  if (galleryMode) exitGallery();

  _debugSeedCounter++;
  const seed = `debug-${destType}-${_debugSeedCounter}`;
  let preGenData;

  if (destType === 'star-system') {
    preGenData = StarSystemGenerator.generate(seed);
  } else if (destType === 'emission-nebula' || destType === 'planetary-nebula') {
    preGenData = NavigableNebulaGenerator.generate(seed, destType);
    preGenData._billboardData = NebulaGenerator.generate(seed, destType);
  } else if (destType === 'open-cluster') {
    preGenData = NavigableClusterGenerator.generate(seed);
  } else if (destType.includes('galaxy')) {
    preGenData = GalaxyGenerator.generate(seed, destType);
  } else if (destType.includes('cluster')) {
    preGenData = ClusterGenerator.generate(seed, destType);
  }
  preGenData._destType = destType;

  seedCounter = _debugSeedCounter;
  spawnSystem({ forWarp: false, systemData: preGenData });
  console.log(`Debug spawn: ${destType} (seed "${seed}")`);
}

// ── Debug Gallery ──────────────────────────────────────────────
// Shows deep sky objects one at a time for evaluating procedural variation.

/** Set visibility of every mesh in the current star system */
function _setSystemVisible(visible) {
  if (!system) return;

  if (system.type && system.type !== 'star-system') {
    // Deep sky destination (distant view)
    if (system.destination) {
      if (visible) system.destination.addTo(scene);
      else system.destination.removeFrom(scene);
    }
    // Navigable deep sky: gas cloud + stars
    if (system.gasCloud) {
      if (visible) system.gasCloud.addTo(scene);
      else system.gasCloud.removeFrom(scene);
    }
    if (system.star) system.star.mesh.visible = visible;
    if (system.star2) system.star2.mesh.visible = visible;
    if (system.extraStars) {
      for (const s of system.extraStars) s.mesh.visible = visible;
    }
  } else {
    // Star system: stars, planets, moons, billboards, orbit lines, asteroid belts
    if (system.star) system.star.mesh.visible = visible;
    if (system.star2) system.star2.mesh.visible = visible;
    for (const entry of system.planets) {
      entry.planet.mesh.visible = visible;
      entry.billboard.sprite.visible = visible;
      for (const m of entry.moons) m.mesh.visible = visible;
      for (const bb of entry.moonBillboards) bb.sprite.visible = visible;
      for (const ml of entry.moonOrbitLines) ml.mesh.visible = visible;
    }
    for (const line of system.orbitLines) line.mesh.visible = visible;
    for (const line of (system.starOrbitLines || [])) line.mesh.visible = visible;
    for (const belt of (system.asteroidBelts || [])) belt.mesh.visible = visible;
  }
}

function enterGallery() {
  galleryMode = true;
  stopFlythrough();
  _deepSkyLingerTimer = -1;
  warpTarget.direction = null;

  // Hide everything in the current system
  _setSystemVisible(false);

  // Hide HUD (system map / gravity well)
  retroRenderer.setHud(null, null);

  document.getElementById('gallery-overlay').style.display = 'block';
  gallerySpawn();
}

function exitGallery() {
  galleryMode = false;
  document.getElementById('gallery-overlay').style.display = 'none';

  // Clean up gallery objects
  _galleryCleanup();

  // Restore everything in the current system
  _setSystemVisible(true);

  // Restore HUD
  if (systemMap) {
    if (gravityWellVisible && gravityWell) {
      retroRenderer.setHud(gravityWell.scene, gravityWell.camera);
    } else if (minimapVisible) {
      retroRenderer.setHud(systemMap.scene, systemMap.camera);
    }
  }

  cameraController.bypassed = false;
}

/** Clean up any gallery-spawned objects */
function _galleryCleanup() {
  if (galleryObject) {
    galleryObject.removeFrom(scene);
    galleryObject.dispose();
    galleryObject = null;
  }
  for (const obj of _galleryMeshes) {
    scene.remove(obj.mesh || obj);
    if (obj.dispose) obj.dispose();
  }
  _galleryMeshes = [];
}

/**
 * Generate test data for the VolumetricNebula gallery entry.
 * Creates a simple spherical gas cloud to verify the renderer works
 * from both outside and inside.
 */
function _generateVolumetricTestData(rng) {
  const radius = 200;  // small for gallery viewing
  const particleCount = 15000;
  const positions = new Float32Array(particleCount * 3);
  const colors = new Float32Array(particleCount * 3);
  const sizes = new Float32Array(particleCount);
  const opacities = new Float32Array(particleCount);

  // Color theme: pick H-alpha (red) or OIII (teal)
  const isRedTheme = rng.chance(0.5);

  for (let i = 0; i < particleCount; i++) {
    // Spherical distribution, denser toward center
    const r = radius * Math.pow(rng.float(), 0.5);  // sqrt bias → denser core
    const theta = rng.range(0, 2 * Math.PI);
    const phi = Math.acos(rng.range(-1, 1));

    positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);

    // Colors: gradient from inner to outer
    const normalizedR = r / radius;
    if (isRedTheme) {
      // Inner: bright pink, outer: dim red
      colors[i * 3]     = rng.range(0.78, 1.0);
      colors[i * 3 + 1] = rng.range(0.18, 0.40) * (1 - normalizedR * 0.5);
      colors[i * 3 + 2] = rng.range(0.22, 0.48) * (1 - normalizedR * 0.5);
    } else {
      // Inner: bright teal, outer: dim blue-green
      colors[i * 3]     = rng.range(0.18, 0.40) * (1 - normalizedR * 0.3);
      colors[i * 3 + 1] = rng.range(0.60, 0.88);
      colors[i * 3 + 2] = rng.range(0.55, 0.82);
    }

    sizes[i] = rng.range(3, 12);  // large for soft cloud look
    opacities[i] = (1 - normalizedR) * rng.range(0.3, 0.8);  // denser near center
  }

  return { positions, colors, sizes, opacities, particleCount, radius };
}

function gallerySpawn() {
  // Clean up previous gallery objects
  _galleryCleanup();

  const type = GALLERY_TYPES[galleryTypeIdx];
  const seed = `gallery-${gallerySeed}`;
  const rng = new SeededRandom(seed);

  let infoText = '';

  // ── Volumetric nebula test (Points-based gas cloud) ──
  if (type === 'volumetric-nebula-test') {
    const testData = _generateVolumetricTestData(rng);
    galleryObject = new VolumetricNebula(testData);
    galleryObject.addTo(scene);

    const radius = testData.radius;
    camera.position.set(0, radius * 0.3, radius * 2);
    camera.lookAt(0, 0, 0);

    infoText = `${testData.particleCount} particles  |  r=${radius.toFixed(0)}  |  scroll to fly inside`;
  }

  // ── Navigable nebulae (gallery preview using beautiful billboard renderer) ──
  // The VolumetricNebula (Points) renderer is used during actual warp fly-through.
  // For gallery preview, we use the Nebula.js billboard renderer which looks far
  // better — it creates wispy cloud structures via layered noise planes.
  // We also embed the navigable Star objects (scaled to match) so you can see
  // the stars you'd fly between during actual navigation.
  else if (type === 'nav-planetary-nebula' || type === 'nav-emission-nebula') {
    const nebulaType = type === 'nav-planetary-nebula' ? 'planetary-nebula' : 'emission-nebula';

    // Billboard nebula at display scale (beautiful layered noise planes)
    const billboardData = NebulaGenerator.generate(seed, nebulaType);
    galleryObject = new Nebula(billboardData);
    galleryObject.addTo(scene);

    // Also generate navigable data for the star positions
    const navData = NavigableNebulaGenerator.generate(seed, nebulaType);

    // Scale navigable stars down to billboard scale and add them
    const scaleFactor = billboardData.radius / navData.radius;
    for (const sData of navData.stars) {
      const scaledR = Math.max(billboardData.radius * 0.015, 1.5);
      const star = new Star({ ...sData, radius: scaledR, color: sData.color }, scaledR);
      star.mesh.position.set(
        sData.position[0] * scaleFactor,
        sData.position[1] * scaleFactor,
        sData.position[2] * scaleFactor,
      );
      star.addTo(scene);
      _galleryMeshes.push(star);
    }

    const radius = billboardData.radius;
    camera.position.set(0, radius * 0.5, radius * 2.5);
    camera.lookAt(0, 0, 0);

    infoText = `${nebulaType} (navigable)  |  ${navData.stars.length} stars  |  r=${radius.toFixed(0)}`;
  }

  // ── Navigable open cluster (gallery preview using particle renderer) ──
  // Same idea: use ClusterGenerator + Galaxy.js for the beautiful particle cloud,
  // then overlay the actual navigable Star objects at matching scale.
  else if (type === 'nav-open-cluster') {
    // Particle cloud at display scale (hundreds of particles = nice cluster shape)
    const particleData = ClusterGenerator.generate(seed, 'open-cluster');
    galleryObject = new Galaxy(particleData);
    galleryObject.addTo(scene);

    // Also generate navigable data for the star positions
    const navData = NavigableClusterGenerator.generate(seed);

    // Scale navigable stars down to particle-cloud scale and add them
    const scaleFactor = particleData.radius / navData.radius;
    for (const sData of navData.stars) {
      const scaledR = Math.max(particleData.radius * 0.02, 2.0);
      const star = new Star({ ...sData, radius: scaledR, color: sData.color }, scaledR);
      star.mesh.position.set(
        sData.position[0] * scaleFactor,
        sData.position[1] * scaleFactor,
        sData.position[2] * scaleFactor,
      );
      star.addTo(scene);
      _galleryMeshes.push(star);
    }

    const radius = particleData.radius;
    camera.position.set(0, radius * 0.5, radius * 2.5);
    camera.lookAt(0, 0, 0);

    infoText = `open-cluster (navigable)  |  ${navData.stars.length} stars  |  r=${radius.toFixed(0)}`;
  }

  // ── Deep sky objects (billboard/distant view) ──
  else if (type.includes('galaxy') || type.includes('nebula') || type.includes('cluster')) {
    let data;
    if (type.includes('galaxy')) {
      data = GalaxyGenerator.generate(seed, type);
    } else if (type.includes('nebula')) {
      data = NebulaGenerator.generate(seed, type);
    } else {
      data = ClusterGenerator.generate(seed, type);
    }

    const isGalaxyOrCluster = type.includes('galaxy') || type.includes('cluster');
    galleryObject = isGalaxyOrCluster ? new Galaxy(data) : new Nebula(data);
    galleryObject.addTo(scene);

    const radius = data.radius;
    camera.position.set(0, radius * 0.5, radius * 2.5);
    camera.lookAt(0, 0, 0);

    infoText = `${data.particleCount || data.starCount || '?'} particles  |  r=${radius.toFixed(0)}`;
  }

  // ── Star ──
  else if (type === 'star') {
    const systemData = StarSystemGenerator.generate(seed);
    const starData = { ...systemData.star, radius: systemData.star.radiusScene };
    const star = new Star(starData);
    star.addTo(scene);
    _galleryMeshes.push(star);

    const r = starData.radius;
    camera.position.set(0, r * 0.5, r * 8);
    camera.lookAt(0, 0, 0);

    infoText = `type ${systemData.star.type}  |  ${systemData.star.temp}K  |  r=${systemData.star.radiusSolar.toFixed(2)} R☉`;
  }

  // ── Planet ──
  else if (type.startsWith('planet-')) {
    const planetType = type.replace('planet-', '');

    // Generate planet data with forced type — all visual properties (colors,
    // clouds, atmosphere) are driven by the type, so this gives us exactly
    // the kind of planet we want with seed-based variation.
    const forcedPlanet = PlanetGenerator.generate(rng, 1.0, [0, 0, 1], null, planetType);

    // Scene-unit conversion
    const mapToSceneRatio = forcedPlanet.radius / forcedPlanet.radiusScene;
    const scenePlanetData = {
      ...forcedPlanet,
      radius: forcedPlanet.radiusScene,
      noiseScale: forcedPlanet.noiseScale * mapToSceneRatio,
      clouds: forcedPlanet.clouds
        ? { ...forcedPlanet.clouds, scale: forcedPlanet.clouds.scale * mapToSceneRatio }
        : null,
    };

    // Use a generic G-star for lighting
    const starInfo = {
      color1: [1.0, 0.96, 0.92],
      brightness1: 1.0,
      color2: [0, 0, 0],
      brightness2: 0,
    };

    const planet = new Planet(scenePlanetData, starInfo);
    planet._lightDir.set(0.5, 0.3, 0.8).normalize();
    planet.addTo(scene);
    _galleryMeshes.push(planet);

    const r = scenePlanetData.radius;
    camera.position.set(0, r * 0.3, r * 3);
    camera.lookAt(0, 0, 0);

    const features = [];
    if (forcedPlanet.rings) features.push('rings');
    if (forcedPlanet.clouds) features.push('clouds');
    if (forcedPlanet.atmosphere) features.push('atmo');
    infoText = `${forcedPlanet.radiusEarth.toFixed(2)} R⊕  |  ${features.join(', ') || 'no extras'}`;
  }

  // ── Moon ──
  else if (type === 'moon') {
    // Generate a system and pick a moon from it
    const systemData = StarSystemGenerator.generate(seed);
    // Find first planet with moons
    let moonData = null;
    let parentData = null;
    for (const entry of systemData.planets) {
      if (entry.moons.length > 0) {
        moonData = entry.moons[0];
        parentData = entry.planetData;
        break;
      }
    }

    if (moonData) {
      // Use map-unit radius (same scale the Moon class geometry expects).
      // Only override orbit so it sits at origin for gallery viewing.
      const galleryMoonData = {
        ...moonData,
        orbitRadius: 0,       // Sit at origin — no orbit
        orbitSpeed: 0,        // Don't orbit — stay still
      };

      // Light from upper-right-front so the terminator is visible
      const lightDir = new THREE.Vector3(0.6, 0.3, 0.7).normalize();
      const starInfo = {
        color1: [1.0, 0.98, 0.94],
        // Boost brightness for gallery — dark moon types (captured, rocky) are
        // barely visible at normal brightness because posterization crushes
        // their low base colors. In normal play, moons appear alongside bright
        // stars and planets so this isn't an issue.
        brightness1: 2.0,
        color2: [0, 0, 0],
        brightness2: 0,
      };

      const moon = new Moon(galleryMoonData, lightDir, null, starInfo);
      moon.addTo(scene);
      _galleryMeshes.push(moon);

      // Camera at 3x map-unit body radius
      const r = galleryMoonData.radius;
      camera.position.set(0, r * 0.3, r * 3);
      camera.lookAt(0, 0, 0);

      infoText = `type: ${moonData.type}  |  ${moonData.radiusEarth.toFixed(3)} R⊕`;
    } else {
      infoText = 'no moons in this seed — try another';
      camera.position.set(0, 1, 10);
      camera.lookAt(0, 0, 0);
    }
  }

  // Hand camera to orbit controller — user can drag to rotate, auto-rotates slowly
  cameraController.restoreFromWorldState(new THREE.Vector3(0, 0, 0));

  // Update info overlay — always update even if something went wrong above
  const label = type.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const overlay = document.getElementById('gallery-overlay');
  const info = document.getElementById('gallery-info');
  if (overlay) overlay.style.display = 'block'; // ensure visible
  if (info) info.textContent = `${label}  |  seed: ${gallerySeed}  |  ${infoText}`;
  console.log(`Gallery: ${label} (seed "${seed}")`);
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
      // and inside innermost planet orbit (if any)
      const innerOrbit = system.planets.length > 0 ? system.planets[0].orbitRadius : Infinity;
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
      // Minimum 0.15 keeps tiny moons visible and prevents near-plane clipping.
      stop.orbitDistance = Math.max(moon.data.radius * 3.5, 0.15);
    } else if (stop.type === 'deepsky-poi') {
      // Deep sky tour stop — bodyRef is the dummy Object3D created in spawnDeepSky
      // orbitDistance and bodyRadius were set by buildDeepSkyQueue
    }
  }
}

/**
 * Populate body references for navigable deep sky queue stops.
 * Stars in navigable deep sky are stored in system.star, system.star2, system.extraStars.
 */
function populateNavigableQueueRefs() {
  const allStars = [system.star];
  if (system.star2) allStars.push(system.star2);
  if (system.extraStars) allStars.push(...system.extraStars);

  // Compute nearest-neighbor distance for each star (for orbit distance scaling)
  const nearestDist = allStars.map((s, i) => {
    let minD = Infinity;
    for (let j = 0; j < allStars.length; j++) {
      if (i === j) continue;
      const d = s.mesh.position.distanceTo(allStars[j].mesh.position);
      if (d < minD) minD = d;
    }
    return minD;
  });

  for (const stop of autoNav.queue) {
    if (stop.type === 'star') {
      const starObj = allStars[stop.starIndex] || allStars[0];
      stop.bodyRef = starObj.mesh;
      // Overview stops keep their pre-set orbitDistance/bodyRadius
      if (stop._isOverview) continue;
      stop.bodyRadius = starObj.data.radius;
      // Orbit at 15% of nearest-neighbor distance so you can see neighbors at scale,
      // but at least 4× star radius (stay outside glow corona)
      const nn = nearestDist[stop.starIndex] || starObj.data.radius * 8;
      stop.orbitDistance = Math.max(starObj.data.radius * 4, nn * 0.15);
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
    // Show star info
    let starObj;
    if (system._navigable && system.extraStars && stop.starIndex >= 2) {
      starObj = system.extraStars[stop.starIndex - 2] || system.star;
    } else {
      starObj = stop.starIndex === 1 && system.star2 ? system.star2 : system.star;
    }
    bodyInfo.showStar(starObj.data);
  } else if (stop.type === 'planet') {
    focusIndex = stop.planetIndex;
    focusMoonIndex = -1;
    focusStarIndex = -1;
    if (system.planets[stop.planetIndex]) {
      bodyInfo.showPlanet(system.planets[stop.planetIndex].planet.data, stop.planetIndex);
    }
  } else if (stop.type === 'moon') {
    focusIndex = stop.planetIndex; // minimap highlights parent planet
    focusMoonIndex = stop.moonIndex;
    focusStarIndex = -1;
    const entry = system.planets[stop.planetIndex];
    if (entry && entry.moons[stop.moonIndex]) {
      bodyInfo.showMoon(entry.moons[stop.moonIndex].data, stop.planetIndex);
    }
  } else if (stop.type === 'deepsky-poi') {
    // Deep sky: no minimap focus (HUD is hidden)
    focusIndex = -1;
    focusMoonIndex = -1;
    focusStarIndex = -1;
    bodyInfo.hide();
  }
}

/**
 * Start the cinematic flythrough tour.
 * Engages from wherever the camera is — picks a random body and
 * begins flying toward it. No teleport, no descend.
 */
function startFlythrough() {
  if (!system) return;
  soundEngine.play('autopilotOn');

  if (system._navigable) {
    // Navigable deep sky: tour between stars (like star system)
    autoNav.buildNavigableQueue(system);
    populateNavigableQueueRefs();
  } else if (system.type && system.type !== 'star-system') {
    // Distant deep sky: no autopilot, orbit around center with free-look.
    const radius = system.destination.data.radius;
    const viewDist = radius * 1.25;
    camera.position.set(0, viewDist * 0.15, viewDist);
    camera.lookAt(0, 0, 0);
    cameraController.restoreFromWorldState(new THREE.Vector3(0, 0, 0));
    cameraController.autoRotateActive = true;
    _deepSkyLingerTimer = 15;
    console.log('Autopilot: deep sky — orbit view, 15s linger');
    return;
  } else {
    autoNav.buildQueue(system);
    populateQueueRefs();
  }
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
  soundEngine.play('autopilotOff');

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
 * Warp: dispose old system and generate a new one (hidden).
 * Called at hyper start — tunnel is fully opaque, hides everything.
 * System data was pre-generated during FOLD phase (onPrepareSystem).
 */
function warpSwapSystem() {
  // Stop autopilot (don't restore camera — warp controls it)
  flythrough.stop();
  autoNav.stop();

  // Create new system using pre-generated data (GPU resource creation only).
  // seedCounter was already incremented in onPrepareSystem.
  spawnSystem({ forWarp: true, systemData: pendingSystemData });
  pendingSystemData = null;

  // Position camera so it ends up approaching the first tour stop when
  // EXIT finishes. The post-warp flythrough then coasts the remaining distance.
  if (system) {
    const speed = 30; // must match cameraForwardSpeed in HYPER/EXIT phases
    const hyperDist = speed * warpEffect.HYPER_DUR;          // 300
    const exitDist = speed * warpEffect.EXIT_DUR * 0.5;      // 30 (smootherstep integral)
    const coastDist = 60;                                     // 3s post-warp approach
    const travelDist = hyperDist + exitDist;                  // 330

    if (system._navigable) {
      // Navigable deep sky: approach toward the primary star (same as star system)
      const star = system.star;
      if (star) {
        const starPos = star.mesh.position;
        const orbitDist = star.data.radius * 4;
        camera.position.set(starPos.x, starPos.y + 2, starPos.z + travelDist + orbitDist + coastDist);
        camera.lookAt(starPos);
      }
    } else if (system.type && system.type !== 'star-system') {
      // Distant deep sky: approach from far along +Z toward the structure center.
      // Final viewing distance is radius * 1.25 — start further out so the
      // momentum drift in warpRevealSystem has room to coast in.
      const radius = system.destination.data.radius;
      const finalDist = radius * 1.25;
      const driftExtra = finalDist * 0.6; // extra distance consumed by drift
      camera.position.set(0, 2, travelDist + finalDist + driftExtra);
      camera.lookAt(0, 0, 0);
    } else {
      // Star system: approach toward the star
      const star = system.star;
      const starPos = star.mesh.position;
      const innerOrbit = system.planets[0].orbitRadius;
      const orbitDist = Math.min(star.data.radius * 4, innerOrbit * 0.4);

      camera.position.set(starPos.x, starPos.y + 2, starPos.z + travelDist + orbitDist + coastDist);
      camera.lookAt(starPos);
    }
  }

  console.log('Warp: system swapped');
}

/**
 * Warp: reveal the new system and start autopilot.
 * Called when the warp exit phase finishes.
 *
 * The camera is ~60 units from the star at this point, still heading toward it.
 * beginTravelFrom (warpArrival mode) coasts forward for 3 seconds with
 * ease-out easing — fast start (leftover momentum) decelerating into orbit.
 * When travel completes, the autopilot loop (travelComplete handler) calls
 * beginOrbit automatically.
 */
function warpRevealSystem() {
  if (!system) return;
  cameraController.bypassed = true;

  // ── Distant deep sky: contemplation view with momentum coast ──
  // Galaxies + globular clusters — camera drifts in with decelerating momentum,
  // then hands off to free-look orbit around the object.
  if (system.type && system.type !== 'star-system' && system.destination && !system._navigable) {
    // Snap object back to origin (drifted with camera during warp)
    system.destination.mesh.position.set(0, 0, 0);

    flythrough.stop();
    autoNav.stop();

    const radius = system.destination.data.radius;
    const viewDist = radius * 1.25; // 50% closer than before
    const endPos = new THREE.Vector3(0, viewDist * 0.15, viewDist);

    // Start momentum drift from current camera position toward final viewing position
    _deepSkyDrift = {
      startPos: camera.position.clone(),
      endPos,
      duration: 4,
      elapsed: 0,
    };
    // Linger timer starts when drift completes (in animation loop)

    const label = system.type.replace(/-/g, ' ');
    console.log(`Warp: coasting into ${label} (4s drift, then free-look)`);
    return;
  }

  // ── Navigable deep sky: tour between stars (like a star system) ──
  if (system._navigable) {
    autoNav.buildNavigableQueue(system);
    populateNavigableQueueRefs();
    autoNav.currentIndex = 0;
    autoNav.start();

    const firstStop = autoNav.getCurrentStop();
    if (firstStop && firstStop.bodyRef) {
      const upcoming = autoNav.getNextStop();
      flythrough.nextBodyRef = upcoming ? upcoming.bodyRef : null;

      flythrough.beginTravelFrom(
        firstStop.bodyRef,
        firstStop.orbitDistance,
        firstStop.bodyRadius,
        { warpArrival: true },
      );

      updateFocusFromStop(firstStop);
    }

    const label = system.type.replace(/-/g, ' ');
    console.log(`Warp: touring ${label} (${autoNav.queue.length} stops)`);
    return;
  }

  // ── Star system: normal reveal ──
  autoNav.buildQueue(system);
  populateQueueRefs();

  let firstStopIdx = autoNav.queue.findIndex(s => s.type === 'star');
  if (firstStopIdx < 0) firstStopIdx = 0;
  autoNav.currentIndex = firstStopIdx;
  autoNav.start();

  const firstStop = autoNav.getCurrentStop();
  if (firstStop && firstStop.bodyRef) {
    const upcoming = autoNav.getNextStop();
    flythrough.nextBodyRef = upcoming ? upcoming.bodyRef : null;

    flythrough.beginTravelFrom(
      firstStop.bodyRef,
      firstStop.orbitDistance,
      firstStop.bodyRadius,
      { warpArrival: true },
    );

    updateFocusFromStop(firstStop);
    if (systemMap) systemMap.triggerBlink();
  }

  console.log('Warp: coasting into new system');
}

/**
 * Find the closest body to the camera for seamless handoff.
 */
function findClosestBody() {
  if (!system) return null;

  // Navigable deep sky: find the closest star
  if (system._navigable) {
    const allStars = [system.star];
    if (system.star2) allStars.push(system.star2);
    if (system.extraStars) allStars.push(...system.extraStars);

    let closest = null;
    let closestDist = Infinity;
    const camPos = camera.position;
    for (let i = 0; i < allStars.length; i++) {
      const d = camPos.distanceTo(allStars[i].mesh.position);
      if (d < closestDist) {
        closestDist = d;
        closest = { position: allStars[i].mesh.position, focusIndex: -2, moonIndex: -1, starIndex: i };
      }
    }
    return closest;
  }

  // Non-navigable deep sky: orbit the center
  if (system.type && system.type !== 'star-system') {
    return {
      position: new THREE.Vector3(0, 0, 0),
      focusIndex: -1,
      moonIndex: -1,
      starIndex: -1,
    };
  }

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
  soundEngine.play('select');
  focusMoonIndex = -1;
  focusStarIndex = -1;

  if (index < 0 || index >= system.planets.length) {
    focusIndex = -1;
    const outerOrbit = system.planets[system.planets.length - 1].orbitRadius;
    cameraController.viewSystem(outerOrbit);
    bodyInfo.hide();
    console.log('System overview');
  } else {
    focusIndex = index;
    const entry = system.planets[index];
    const viewDist = entry.planet.data.radius * 6;
    cameraController.focusOn(entry.planet.mesh.position, viewDist);
    bodyInfo.showPlanet(entry.planet.data, index);
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

  // For navigable deep sky, starIdx can go beyond 0/1 — check extraStars
  let starObj;
  if (system._navigable && system.extraStars && starIdx >= 2) {
    starObj = system.extraStars[starIdx - 2] || system.star;
  } else {
    starObj = starIdx === 1 && system.star2 ? system.star2 : system.star;
  }

  // Cap camera distance so it stays well inside the innermost planet orbit.
  // For navigable deep sky (no planets), just use a reasonable multiple of star radius.
  const idealDist = starObj.data.radius * 6;
  let viewDist = idealDist;
  if (system.planets.length > 0) {
    const innerOrbit = system.planets[0].orbitRadius;
    viewDist = Math.min(idealDist, innerOrbit * 0.4);
  }
  cameraController.focusOn(starObj.mesh.position, viewDist);
  bodyInfo.showStar(starObj.data);
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
  soundEngine.play('select');
  if (planetIndex < 0 || planetIndex >= system.planets.length) return;
  const entry = system.planets[planetIndex];
  if (moonIndex < 0 || moonIndex >= entry.moons.length) return;

  const moon = entry.moons[moonIndex];
  // Ensure minimum view distance so tiny moons don't clip or fill the camera
  const viewDist = Math.max(moon.data.radius * 8, 0.15);
  focusIndex = planetIndex;
  focusMoonIndex = moonIndex;
  focusStarIndex = -1;
  cameraController.focusOn(moon.mesh.position, viewDist);
  bodyInfo.showMoon(moon.data, planetIndex);
  console.log(`Focus: moon ${moonIndex + 1} of planet ${planetIndex + 1} (${moon.data.type})`);
}

function toggleOrbits() {
  if (!system) return;
  orbitsVisible = !orbitsVisible;
  soundEngine.play(orbitsVisible ? 'toggleOn' : 'toggleOff');
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

function toggleFullscreen() {
  if (document.fullscreenElement) {
    document.exitFullscreen();
  } else {
    document.documentElement.requestFullscreen().catch(() => {});
  }
}

function toggleGravityWell() {
  gravityWellVisible = !gravityWellVisible;
  soundEngine.play(gravityWellVisible ? 'toggleOn' : 'toggleOff');
  // Swap HUD between gravity well contour map and system map
  if (gravityWellVisible && gravityWell) {
    retroRenderer.setHud(gravityWell.scene, gravityWell.camera);
  } else if (systemMap && minimapVisible) {
    retroRenderer.setHud(systemMap.scene, systemMap.camera);
  } else {
    retroRenderer.setHud(null, null);
  }
}

// ── Animation Loop ──
const timer = new THREE.Timer();
// Pre-allocate reusable vectors
const _sunDir = new THREE.Vector3();
const _sunDir2 = new THREE.Vector3();
const _star1Pos = new THREE.Vector3();
const _star2Pos = new THREE.Vector3();
// Warp rift projection
const _riftPoint = new THREE.Vector3();
const _riftNDC = new THREE.Vector2();
const _riftUV = new THREE.Vector2();
const _targetQuat = new THREE.Quaternion();
const _lookMatrix = new THREE.Matrix4();
// Warp target projection
const _starRayDir = new THREE.Vector3();
const _targetScreenPos = new THREE.Vector3();
const _targetUV = new THREE.Vector2();
const _toBody = new THREE.Vector3();

/**
 * Check if a warp target direction is occluded by any system body (star, planet, moon).
 * Uses angular overlap: if the angle between the target direction and the direction
 * to a body is less than the body's apparent angular radius, it's occluded.
 */
function isWarpTargetOccluded(targetDir) {
  if (!system) return false;
  const camPos = camera.position;
  const bodies = [];

  // Gather all bodies with position + radius
  if (system.star) bodies.push({ pos: system.star.mesh.position, r: system.star._renderRadius });
  if (system.star2) bodies.push({ pos: system.star2.mesh.position, r: system.star2._renderRadius });
  for (const entry of system.planets) {
    bodies.push({ pos: entry.planet.mesh.position, r: entry.planet.data.radius });
    for (const moon of entry.moons) {
      bodies.push({ pos: moon.mesh.position, r: moon.data.radius });
    }
  }

  for (const { pos, r } of bodies) {
    _toBody.subVectors(pos, camPos);
    const dist = _toBody.length();
    if (dist < 0.001) continue;
    _toBody.divideScalar(dist);
    const cosAngle = _toBody.dot(targetDir);
    if (cosAngle <= 0) continue; // body is behind camera
    const angularRadius = Math.atan2(r, dist);
    const angle = Math.acos(Math.min(1, cosAngle));
    if (angle < angularRadius) return true;
  }
  return false;
}

function animate() {
  requestAnimationFrame(animate);

  timer.update();
  const deltaTime = Math.min(timer.getDelta(), 0.1);

  // ── Gallery mode: update objects, camera controller handles orbit ──
  if (galleryMode) {
    // Update deep sky objects (internal animation)
    if (galleryObject) {
      galleryObject.update(deltaTime, camera);
    }
    // Update star system objects (planet rotation, star glow, moon orbit, etc.)
    for (const obj of _galleryMeshes) {
      if (obj instanceof Moon) {
        obj.update(deltaTime, _galleryOrigin);  // Moon needs parent position
      } else if (obj.update) {
        obj.update(deltaTime);
      }
      if (obj.updateGlow) obj.updateGlow(camera);
    }
    // Camera controller handles both auto-rotation and manual drag orbit
    cameraController.update(deltaTime);
    starfield.update(camera.position);
    retroRenderer.render();
    return;
  }

  if (system) {
    // ── Deep sky destination update ──
    if (system.type && system.type !== 'star-system') {
      if (system.destination) system.destination.update(deltaTime, camera);
      // Navigable deep sky: update gas cloud + extra star glows
      if (system.gasCloud) system.gasCloud.update(deltaTime, camera);
      if (system.extraStars) {
        for (const s of system.extraStars) {
          if (s.updateGlow) s.updateGlow(camera);
        }
      }
      // Primary star glow needs updating too
      if (system.star && system.star.updateGlow) system.star.updateGlow(camera);
      if (system.star2 && system.star2.updateGlow) system.star2.updateGlow(camera);
    }

    // ── Star system updates (skip for deep sky) ──
    if (!system.type || system.type === 'star-system') {

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
        if (moon.isPlanetMoon) {
          // Planet-class moons: handle orbital positioning externally
          // (Planet.js has no orbit logic — Moon.js does it internally)
          moon.orbitAngle += moon.data.orbitSpeed * deltaTime;
          const r = moon.data.orbitRadius;
          const angle = moon.orbitAngle;
          const incl = moon.data.inclination || 0;
          const pp = entry.planet.mesh.position;
          moon.mesh.position.set(
            pp.x + Math.cos(angle) * r,
            pp.y - Math.sin(incl) * Math.sin(angle) * r,
            pp.z + Math.cos(incl) * Math.sin(angle) * r,
          );
          // Sync light direction from parent planet
          moon.planet._lightDir.copy(entry.planet._lightDir);
          if (system.isBinary) moon.planet._lightDir2.copy(entry.planet._lightDir2);
          moon.planet.update(deltaTime);
        } else {
          moon.update(deltaTime, entry.planet.mesh.position);
        }
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
        if (moon.isPlanetMoon) {
          // Planet-class moons use Planet.js shader — shadow uniforms on surface material
          const pmMat = moon.planet.surface.material;
          // Parent planet as shadow caster (reuse the planet-planet shadow slots)
          pmMat.uniforms.shadowPlanetCount.value = 1;
          pmMat.uniforms.shadowPlanetPos.value[0].copy(entry.planet.mesh.position);
          pmMat.uniforms.shadowPlanetRadius.value[0] = entry.planet.data.radius;
          pmMat.uniforms.starPos1.value.copy(_star1Pos);
          pmMat.uniforms.starPos2.value.copy(_star2Pos);
        } else {
          const mMat = moon.mesh.material;
          mMat.uniforms.shadowPlanetPos.value.copy(entry.planet.mesh.position);
          mMat.uniforms.shadowPlanetRadius.value = entry.planet.data.radius;
          mMat.uniforms.starPos1.value.copy(_star1Pos);
          mMat.uniforms.starPos2.value.copy(_star2Pos);
        }
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
          // Keep click proxy in sync with moon position
          if (moon._clickProxy) moon._clickProxy.position.copy(moon.mesh.position);
        }
      }
    }

    } // end star-system-only updates

    // ── Warp target brackets ──
    // When a warp target is selected (and warp hasn't started yet),
    // project it to screen and update the blinking bracket overlay.
    if (warpTarget.direction && !warpEffect.isActive) {
      // ── Pre-warp camera turn ──
      // Camera slerps to center the target on screen before warp fires.
      // Brackets stay solid (no blink) = "target locked".
      if (warpTarget.turning) {
        warpTarget.turnTimer += deltaTime;
        warpTarget.lockBlinkFrames++;

        // Rapid blink for first 4 cycles (2 frames on, 2 frames off = 16 frames)
        // then solid square stays on
        if (warpTarget.lockBlinkFrames <= 16) {
          warpTarget.blinkOn = Math.floor((warpTarget.lockBlinkFrames - 1) / 2) % 2 === 0;
        } else {
          warpTarget.blinkOn = true;
        }

        // Slerp camera to face the target
        _riftPoint.copy(camera.position).addScaledVector(warpTarget.direction, 10);
        _lookMatrix.lookAt(camera.position, _riftPoint, camera.up);
        _targetQuat.setFromRotationMatrix(_lookMatrix);
        camera.quaternion.slerp(_targetQuat, 1 - Math.exp(-3.0 * deltaTime));

        // Check alignment — fire warp once centered (or after 1.5s timeout)
        camera.getWorldDirection(_starRayDir);
        const alignment = _starRayDir.dot(warpTarget.direction);
        if (alignment > 0.999 || warpTarget.turnTimer > 3.0) {
          const dir = warpTarget.direction;
          warpTarget.direction = null;
          warpTarget.turning = false;
          warpEffect.start(dir);
        }
      } else {
        // Normal blink (no turn yet — waiting for Space press)
        warpTarget.blinkTimer += deltaTime;
        warpTarget.blinkOn = Math.floor(warpTarget.blinkTimer * 4) % 2 === 0;
      }

      // Project target to screen and update bracket overlay.
      // Hide brackets when the target is behind the camera — project() reflects
      // behind-camera points to the opposite side of the screen, creating a ghost.
      if (warpTarget.direction) {
        camera.getWorldDirection(_starRayDir);
        const facing = _starRayDir.dot(warpTarget.direction);
        if (facing > 0 && !isWarpTargetOccluded(warpTarget.direction)) {
          _targetScreenPos.copy(camera.position).addScaledVector(warpTarget.direction, 1000);
          _targetScreenPos.project(camera);
          _targetUV.set(
            (_targetScreenPos.x + 1) / 2,
            (_targetScreenPos.y + 1) / 2,
          );
          retroRenderer.setTargetUniforms(
            _targetUV,
            warpTarget.blinkOn ? (warpTarget.turning ? 2 : 1) : 0,
            20,
          );
        } else {
          // Target is behind camera — hide brackets
          retroRenderer.setTargetUniforms(null, 0, 0);
        }
      } else {
        retroRenderer.setTargetUniforms(null, 0, 0);
      }
    } else {
      retroRenderer.setTargetUniforms(null, 0, 0);
    }

    // ── Warp transition ──
    if (warpEffect.isActive) {
      warpEffect.update(deltaTime);

      // ── Determine rift direction (default: camera forward) ──
      const riftDir = warpEffect.riftDirection || camera.getWorldDirection(_sunDir);

      // ── Project rift direction to screen space ──
      _riftPoint.copy(camera.position).addScaledVector(riftDir, 1000);
      _riftPoint.project(camera);  // → NDC: x,y in [-1, 1]
      _riftNDC.set(
        Math.max(-1, Math.min(1, _riftPoint.x)),
        Math.max(-1, Math.min(1, _riftPoint.y)),
      );
      _riftUV.set(
        (_riftNDC.x + 1) / 2,   // NDC → UV
        (_riftNDC.y + 1) / 2,
      );

      // ── Pass rift center + warp uniforms to shaders ──
      starfield.setWarpUniforms(warpEffect.foldAmount, warpEffect.starBrightness, _riftNDC);

      // Deep sky objects: skip the scene fade-in during exit.
      // The object is already in the scene (spawned during HYPER when tunnel was opaque).
      // Setting sceneFade=0 means it's fully visible behind the tunnel mask —
      // so when the exit hole opens, the object is revealed, not faded in.
      let effectiveSceneFade = warpEffect.sceneFade;
      if (warpEffect.state === 'exit' && system && system.type && system.type !== 'star-system') {
        effectiveSceneFade = 0;
      }

      retroRenderer.setWarpUniforms(
        effectiveSceneFade,
        warpEffect.whiteFlash,
        warpEffect.hyperPhase,
        warpEffect.hyperTime,
        warpEffect.foldGlow,
        warpEffect.exitReveal,
        _riftUV,
      );

      // ── Camera slerp: rotate to face the rift during fold/enter ──
      if (warpEffect.state === 'fold' || warpEffect.state === 'enter') {
        _riftPoint.copy(camera.position).addScaledVector(riftDir, 10);
        _lookMatrix.lookAt(camera.position, _riftPoint, camera.up);
        _targetQuat.setFromRotationMatrix(_lookMatrix);
        const slerpFactor = 1 - Math.exp(-2.0 * deltaTime);
        camera.quaternion.slerp(_targetQuat, slerpFactor);
      }

      // ── Camera forward movement ──
      if (warpEffect.cameraForwardSpeed > 0) {
        camera.getWorldDirection(_sunDir);
        camera.position.addScaledVector(_sunDir, warpEffect.cameraForwardSpeed * deltaTime);

        // Distant deep sky objects: move WITH camera during warp so there's no parallax.
        // They're meant to appear impossibly far away — no visible relative motion.
        // Navigable deep sky stays in place (like star systems — you fly INTO them).
        // warpRevealSystem() snaps everything to proper positions when warp completes.
        if (system && system.type && system.type !== 'star-system' && system.destination && !system._navigable) {
          system.destination.mesh.position.addScaledVector(_sunDir, warpEffect.cameraForwardSpeed * deltaTime);
          // Also move dummy bodyRef objects so tour stop positions stay consistent
          if (system._dummyRefs) {
            for (const ref of system._dummyRefs) {
              ref.position.addScaledVector(_sunDir, warpEffect.cameraForwardSpeed * deltaTime);
            }
          }
        }
      }
    } else {
      // Reset warp uniforms when not warping
      starfield.setWarpUniforms(0, 1, null);
      retroRenderer.setWarpUniforms(0, 0, 0, 0, 0, 0, null);
    }

    // ── Autopilot (cinematic flythrough) ──
    // Skip idle timer during warp or title screen (title has its own 30s timer)
    if (warpEffect.isActive || titleScreenActive) {
      // Warp or title screen is active — don't start autopilot
    } else if (!autoNav.isActive) {
      idleTimer += deltaTime;
      if (idleTimer >= settings.get('idleTimeout')) {
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
          flythrough.beginOrbit(stop.bodyRef, stop.orbitDistance, stop.bodyRadius, stop.linger * settings.get('tourLingerMultiplier'));
          // Show current body on minimap (no blink — we just arrived)
          updateFocusFromStop(stop);
        }
      }
    }

    // ── Deep sky momentum drift (non-navigable warp arrival) ──
    // Camera drifts from warp exit position toward final viewing distance.
    // Ease-out quadratic: fast start (leftover warp momentum), slows to stop.
    if (_deepSkyDrift && !warpEffect.isActive) {
      _deepSkyDrift.elapsed += deltaTime;
      const t = Math.min(1, _deepSkyDrift.elapsed / _deepSkyDrift.duration);
      const s = 1 - (1 - t) * (1 - t); // ease-out quadratic
      camera.position.lerpVectors(_deepSkyDrift.startPos, _deepSkyDrift.endPos, s);
      camera.lookAt(0, 0, 0);
      if (t >= 1) {
        _deepSkyDrift = null;
        // Hand camera to controller for free-look orbit
        cameraController.restoreFromWorldState(new THREE.Vector3(0, 0, 0));
        cameraController.autoRotateActive = true;
        // Start contemplation timer now that drift is done
        _deepSkyLingerTimer = 15;
        console.log('Deep sky drift complete — free-look enabled, 15s linger');
      }
    }

    // ── Deep sky contemplation timer ──
    // After the timer, auto-warp away.
    // Paused during title screen (title has its own 30s dismiss timer).
    if (_deepSkyLingerTimer >= 0 && !warpEffect.isActive && !warpTarget.turning && !titleScreenActive) {
      _deepSkyLingerTimer -= deltaTime;
      if (_deepSkyLingerTimer <= 0) {
        _deepSkyLingerTimer = -1;
        // For distant deep sky, try picking a particle from the galaxy/cluster first
        let picked = false;
        if (system && system.destination && system.destination.getRandomParticle) {
          const dir = system.destination.getRandomParticle(camera);
          if (dir) {
            warpTarget.direction = dir;
            warpTarget.blinkTimer = 0;
            warpTarget.blinkOn = true;
            picked = true;
          }
        }
        if (!picked) {
          autoSelectWarpTarget();
        }
        setTimeout(() => beginWarpTurn(), 500);
      }
    }

    // ── Camera tracking (manual mode only) ──
    // Skip during flythrough (camera is driven by FlythroughCamera)
    if (!cameraController.bypassed) {
      // Determine the tracked body's position (if any)
      let trackPos = null;
      if (focusIndex === -2 && focusStarIndex >= 0) {
        const starObj = focusStarIndex === 1 && system.star2 ? system.star2 : system.star;
        trackPos = starObj.mesh.position;
      } else if (focusIndex >= 0 && focusIndex < system.planets.length) {
        const entry = system.planets[focusIndex];
        if (focusMoonIndex >= 0 && focusMoonIndex < entry.moons.length) {
          trackPos = entry.moons[focusMoonIndex].mesh.position;
        } else {
          trackPos = entry.planet.mesh.position;
        }
      }

      if (trackPos) {
        if (cameraController.isFreeLooking) {
          // Free-look: move the camera anchor to follow the body's orbit
          // so the system doesn't "fly past" the camera
          cameraController.trackFreeLookAnchor(trackPos);
        } else {
          cameraController.trackTarget(trackPos);
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
  _heldKeys.add(e.key);

  // K key: toggle keybinds overlay (works always — title, gameplay, warp)
  if (e.code === 'KeyK') {
    toggleKeybinds();
    return;
  }

  // S key: toggle settings panel (works always except title screen)
  if (e.code === 'KeyS' && !titleScreenActive) {
    toggleSettings();
    return;
  }

  // T key: toggle sound test panel (works always except title screen)
  if (e.code === 'KeyT' && !titleScreenActive) {
    toggleSoundTest();
    return;
  }

  // Escape closes keybinds, settings, or sound test overlay if open
  if (e.code === 'Escape') {
    if (_soundTestOpen) {
      toggleSoundTest();
      return;
    }
    if (_settingsOpen) {
      toggleSettings();
      return;
    }
    const kb = document.getElementById('keybinds-overlay');
    if (kb && kb.style.display !== 'none') {
      kb.style.display = 'none';
      return;
    }
  }

  // Title screen: any key dismisses (except K which we already handled)
  if (titleScreenActive) {
    dismissTitleScreen();
    return; // don't pass the dismiss key through to gameplay
  }

  // Debug destination override: set at any time (even during warp).
  // The forced type persists until the next onPrepareSystem call.
  if (e.key === ',') {
    _forceNextDestType = 'spiral-galaxy';
    console.log('Debug: next warp → spiral galaxy');
  } else if (e.key === '.' && !e.shiftKey) {
    _forceNextDestType = 'emission-nebula';
    console.log('Debug: next warp → emission nebula');
  } else if (e.key === '/' || e.key === '?') {
    _forceNextDestType = 'globular-cluster';
    console.log('Debug: next warp → globular cluster');
  }

  // Debug instant-spawn: Shift+1 through Shift+7 jump directly to a system type
  // without warping. Each press generates a new random seed.
  if (e.shiftKey && !warpEffect.isActive) {
    const debugTypes = {
      '!': 'star-system',         // Shift+1
      '@': 'spiral-galaxy',       // Shift+2
      '#': 'elliptical-galaxy',   // Shift+3
      '$': 'emission-nebula',     // Shift+4
      '%': 'planetary-nebula',    // Shift+5
      '^': 'globular-cluster',    // Shift+6
      '&': 'open-cluster',        // Shift+7
    };
    const destType = debugTypes[e.key];
    if (destType) {
      _debugSpawnType(destType);
      return;
    }
  }

  // D key: toggle debug gallery (works even during warp)
  if (e.code === 'KeyD') {
    if (galleryMode) {
      exitGallery();
    } else {
      enterGallery();
    }
    return;
  }

  // Gallery mode: arrow keys cycle types/seeds
  if (galleryMode) {
    if (e.code === 'ArrowRight') {
      gallerySeed++;
      gallerySpawn();
    } else if (e.code === 'ArrowLeft') {
      gallerySeed = Math.max(1, gallerySeed - 1);
      gallerySpawn();
    } else if (e.code === 'ArrowUp') {
      galleryTypeIdx = (galleryTypeIdx + 1) % GALLERY_TYPES.length;
      gallerySpawn();
    } else if (e.code === 'ArrowDown') {
      galleryTypeIdx = (galleryTypeIdx - 1 + GALLERY_TYPES.length) % GALLERY_TYPES.length;
      gallerySpawn();
    }
    return;  // Block all other input in gallery mode
  }

  // Block all input during warp transition or pre-warp turn
  if (warpEffect.isActive || warpTarget.turning) return;

  // M key: toggle minimap
  if (e.code === 'KeyM') {
    minimapVisible = !minimapVisible;
    if (minimapVisible && systemMap && !gravityWellVisible) {
      retroRenderer.setHud(systemMap.scene, systemMap.camera);
    } else if (!minimapVisible && !gravityWellVisible) {
      retroRenderer.setHud(null, null);
    }
    return;
  }

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
      beginWarpTurn();
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

  // Normal mode (autopilot off) — reset idle timer and cancel auto-warp
  idleTimer = 0;
  _deepSkyLingerTimer = -1;

  if (e.code === 'Space') {
    e.preventDefault();
    beginWarpTurn();
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

window.addEventListener('keyup', (e) => {
  _heldKeys.delete(e.key);
});

// ── Click/tap-to-select ──
function trySelect(clientX, clientY) {
  if (!system || warpEffect.isActive || warpTarget.turning) return;

  // 0. Check minimap click first (circular HUD region)
  // Any click inside the HUD circle is consumed — dead zone for star selection.
  if (systemMap && minimapVisible && !gravityWellVisible) {
    const uv = retroRenderer.getHudUV(clientX, clientY);
    if (uv) {
      // Inside the minimap circle — try to hit a body, but either way don't
      // let the click fall through to scene raycasting or warp star selection.
      const hit = systemMap.hitTest(uv.u, uv.v);
      if (hit) {
        if (autoNav.isActive) {
          // During autopilot: queue the selected body as next destination
          // (don't interrupt current orbit — autopilot will go there next)
          if (hit.type === 'star') {
            autoNav.jumpToStar();
          } else if (hit.type === 'planet') {
            autoNav.jumpToPlanet(hit.planetIndex);
          }
          // Update minimap focus ring to show the queued destination
          if (hit.type === 'planet') {
            focusIndex = hit.planetIndex;
            focusMoonIndex = -1;
            focusStarIndex = -1;
          }
          soundEngine.play('select');
          if (systemMap) systemMap.triggerBlink();
        } else {
          // Manual mode: smoothly fly to the selected body
          if (hit.type === 'star') {
            focusStar(hit.starIndex);
          } else if (hit.type === 'planet') {
            focusPlanet(hit.planetIndex);
          }
        }
      }
      return; // always consume clicks inside the minimap
    }
  }

  _mouse.x = (clientX / window.innerWidth) * 2 - 1;
  _mouse.y = -(clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(_mouse, camera);

  // 1. Try scene objects (planets, stars, moons)
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

    // Stop autopilot when clicking a body (needed for navigable deep sky
    // where forceFreeLook is off but flythrough may be driving the camera)
    if (autoNav.isActive || flythrough.active) {
      stopFlythrough();
    }

    if (info.type === 'star') {
      focusStar(info.starIndex);
    } else if (info.type === 'planet') {
      focusPlanet(info.planetIndex);
    } else if (info.type === 'moon') {
      focusMoon(info.planetIndex, info.moonIndex);
    }
    return; // scene object hit — done
  }

  // 1b. Try orbit lines (screen-space distance check)
  const orbitHit = hitTestOrbits(clientX, clientY, 6);
  if (orbitHit) {
    if (orbitHit.info.type === 'planet') {
      focusPlanet(orbitHit.info.planetIndex);
    } else if (orbitHit.info.type === 'moon') {
      focusMoon(orbitHit.info.planetIndex, orbitHit.info.moonIndex);
    }
    return;
  }

  // 2. Distant deep sky (galaxy/globular): try selecting a particle as warp target
  if (system && system.destination && system.destination.findNearestParticle && !system._navigable) {
    const dir = system.destination.findNearestParticle(raycaster.ray.direction, camera.position);
    if (dir) {
      warpTarget.direction = dir;
      warpTarget.blinkTimer = 0;
      warpTarget.blinkOn = true;
      return;
    }
  }

  // 3. No scene object or galaxy particle hit — try selecting a background star
  trySelectWarpTarget(raycaster.ray.direction);
}

/**
 * Select the nearest background starfield point as a warp target.
 * Green brackets will blink around it; pressing Space warps toward it.
 */
function trySelectWarpTarget(rayDir) {
  const dir = starfield.findNearestStar(rayDir);
  if (!dir) return; // no star close enough to the click

  soundEngine.play('warpTarget');
  warpTarget.direction = dir;
  warpTarget.blinkTimer = 0;
  warpTarget.blinkOn = true;
}

/**
 * Auto-select a random visible star as warp target (screensaver mode).
 * Picks from the forward hemisphere so the brackets appear on-screen.
 */
function autoSelectWarpTarget() {
  camera.getWorldDirection(_starRayDir);
  const dir = starfield.getRandomVisibleStar(_starRayDir);
  if (dir) {
    warpTarget.direction = dir;
    warpTarget.blinkTimer = 0;
    warpTarget.blinkOn = true;
  }
}

/**
 * Begin the pre-warp camera turn. If a warp target is selected,
 * the camera slerps to face it first (brackets go solid = "locked on").
 * Once aligned, the warp fires. If no target, warp starts immediately.
 */
function beginWarpTurn() {
  if (warpEffect.isActive) return;   // already warping
  if (warpTarget.turning) return;    // already turning
  soundEngine.play('warpLockOn');

  // Cancel deep sky linger timer (we're warping now)
  _deepSkyLingerTimer = -1;

  if (!warpTarget.direction) {
    // No target — warp toward camera forward immediately
    cameraController.bypassed = true;
    warpEffect.start(null);
    return;
  }

  // Stop flythrough camera — we're taking direct control for the turn.
  // autoNav stays active (warpRevealSystem rebuilds it for the new system).
  if (flythrough.active) flythrough.stop();
  cameraController.bypassed = true;
  warpTarget.turning = true;
  warpTarget.turnTimer = 0;
  warpTarget.lockBlinkFrames = 0;
}

// Idle tracking — any mouse movement resets idle timer (but no free-look)
canvas.addEventListener('mousemove', (e) => {
  if (!autoNav.isActive) {
    idleTimer = 0;
    _deepSkyLingerTimer = -1; // cancel auto-warp while user is active
  }

  // Minimap drag-to-rotate (pointer lock keeps cursor captured)
  if (_minimapDragging && systemMap) {
    if (Math.abs(e.movementX) > 0) _minimapDidDrag = true;
    systemMap.rotate(-e.movementX * 0.008);
    return; // consume the move — don't orbit the camera
  }

  // Middle mouse (or left mouse in deep sky) free-look during flythrough
  const freeLookDrag = _middleMouseDown || (cameraController.forceFreeLook && cameraController._leftFreeLooking);
  if (flythrough.active && freeLookDrag) {
    flythrough.addFreeLook(-e.movementX * 0.002, -e.movementY * 0.0015);
  }

  // ── Orbit line hover highlight (screen-space, throttled to ~30 Hz) ──
  if (!system || warpEffect.isActive || galleryMode) return;
  const now = performance.now();
  if (now - _lastOrbitHoverTime < 33) return;
  _lastOrbitHoverTime = now;

  const hit = hitTestOrbits(e.clientX, e.clientY, 8);
  const newHover = hit ? hit.mesh : null;
  if (newHover !== _hoveredOrbitLine) {
    // Restore previous
    if (_hoveredOrbitLine) {
      _hoveredOrbitLine.material.opacity = _hoveredOrbitLine._origOpacity ?? 0.8;
      _hoveredOrbitLine.material.color.copy(_hoveredOrbitLine._origColor);
      _hoveredOrbitLine.material.needsUpdate = true;
    }
    // Highlight new
    if (newHover) {
      if (!newHover._origColor) {
        newHover._origColor = newHover.material.color.clone();
        newHover._origOpacity = newHover.material.opacity;
      }
      newHover.material.color.set(0x44ff44); // bright green
      newHover.material.opacity = 1.0;
      newHover.material.needsUpdate = true;
      canvas.style.cursor = 'pointer';
    } else {
      canvas.style.cursor = '';
    }
    _hoveredOrbitLine = newHover;
  }
});

// Middle mouse tracking for flythrough free-look
let _middleMouseDown = false;

// Minimap drag-to-rotate
let _minimapDragging = false;
let _minimapDidDrag = false; // true once mouse actually moves during minimap drag

// Mouse click
canvas.addEventListener('mousedown', (e) => {
  if (titleScreenActive) { dismissTitleScreen(); return; }
  _mouseDown.x = e.clientX;
  _mouseDown.y = e.clientY;

  // Check if clicking on the minimap — start a drag-to-rotate
  if (e.button === 0 && systemMap && minimapVisible && !gravityWellVisible) {
    const uv = retroRenderer.getHudUV(e.clientX, e.clientY);
    if (uv) {
      _minimapDragging = true;
      // Prevent the camera controller from starting an orbit drag
      cameraController.isDragging = false;
      // Request pointer lock so drag works even if mouse exits the window
      canvas.requestPointerLock?.();
      // Reset idle timer — minimap interaction counts as user activity
      if (!autoNav.isActive) {
        idleTimer = 0;
        _deepSkyLingerTimer = -1;
      }
      return; // don't process further (don't stop autopilot, etc.)
    }
  }

  if (e.button === 1) {
    _middleMouseDown = true;
  }
  // Cancel momentum drift on any click — hand camera to user immediately
  if (_deepSkyDrift) {
    _deepSkyDrift = null;
    cameraController.restoreFromWorldState(new THREE.Vector3(0, 0, 0));
    cameraController.autoRotateActive = true;
    _deepSkyLingerTimer = 15;
  }
  // Left-click drag turns off autopilot (but not during warp, turn, or deep sky free-look)
  if (e.button === 0 && autoNav.isActive && !warpEffect.isActive && !warpTarget.turning && !cameraController.forceFreeLook) {
    stopFlythrough();
  }
  if (!autoNav.isActive) {
    idleTimer = 0;
    _deepSkyLingerTimer = -1;
  }
});

// Scroll wheel resets idle timer
canvas.addEventListener('wheel', () => {
  if (!autoNav.isActive) {
    idleTimer = 0;
    _deepSkyLingerTimer = -1;
  }
}, { passive: true });

window.addEventListener('mouseup', (e) => {
  if (e.button === 0 && _minimapDragging) {
    _minimapDragging = false;
    _minimapDidDrag = false;
    if (document.pointerLockElement === canvas) {
      document.exitPointerLock?.();
    }
  }
  if (e.button === 1) {
    _middleMouseDown = false;
    if (flythrough.active) flythrough.clearFreeLook();
  }
});

canvas.addEventListener('mouseup', (e) => {
  if (e.button !== 0) return;

  // End minimap drag
  if (_minimapDragging) {
    _minimapDragging = false;
    // Release pointer lock
    if (document.pointerLockElement === canvas) {
      document.exitPointerLock?.();
    }
    // If it was just a click (not a drag), try selecting a body on the minimap
    // With pointer lock, clientX/Y don't move, so use accumulated movementX
    if (!_minimapDidDrag) {
      trySelect(_mouseDown.x, _mouseDown.y);
    }
    _minimapDidDrag = false;
    return;
  }

  // Clear flythrough free-look if left-drag was acting as free-look (deep sky)
  if (cameraController.forceFreeLook && flythrough.active) {
    flythrough.clearFreeLook();
  }
  const dx = e.clientX - _mouseDown.x;
  const dy = e.clientY - _mouseDown.y;
  if (dx * dx + dy * dy > 25) return;
  trySelect(e.clientX, e.clientY);
});

// Touch tap (single tap = select, double tap = new system)
let _lastTapTime = 0;
const _touchStart = { x: 0, y: 0 };

canvas.addEventListener('touchstart', (e) => {
  if (titleScreenActive) { dismissTitleScreen(); return; }
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
    // Double tap: warp to new system
    beginWarpTurn();
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

// ── Landscape orientation lock (mobile) ──
// Request landscape on first touch. Fails silently on desktop/unsupported browsers.
let _orientationLocked = false;
window.addEventListener('touchstart', () => {
  if (_orientationLocked) return;
  _orientationLocked = true;
  try {
    screen.orientation.lock('landscape-primary').catch(() => {});
  } catch { /* not supported */ }
}, { once: false, passive: true });

// ── Mobile Menu (split-side fan-out) ──
const mobileMenu = document.getElementById('mobile-menu');
if (mobileMenu) {
  const toggle = mobileMenu.querySelector('.mobile-menu-toggle');
  const gyroBtn = mobileMenu.querySelector('[data-action="gyro"]');

  toggle.addEventListener('touchend', (e) => {
    e.preventDefault();
    e.stopPropagation();
    mobileMenu.classList.toggle('open');
  });

  // Shared handler for both side groups
  function handleMobileAction(e) {
    e.preventDefault();
    e.stopPropagation();
    const btn = e.target.closest('button');
    if (!btn) return;

    const action = btn.dataset.action;
    if (action === 'new') {
      beginWarpTurn();
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
    } else if (action === 'minimap') {
      minimapVisible = !minimapVisible;
      if (minimapVisible && systemMap && !gravityWellVisible) {
        retroRenderer.setHud(systemMap.scene, systemMap.camera);
      } else if (!minimapVisible && !gravityWellVisible) {
        retroRenderer.setHud(null, null);
      }
      btn.classList.toggle('active', minimapVisible);
    } else if (action === 'fullscreen') {
      toggleFullscreen();
      btn.classList.toggle('active', !!document.fullscreenElement);
    } else if (action === 'settings') {
      toggleSettings();
    }
    // Menu stays open — user closes it explicitly with the toggle button
  }

  // Listen on both side groups
  const leftGroup = mobileMenu.querySelector('.mobile-menu-left');
  const rightGroup = mobileMenu.querySelector('.mobile-menu-right');
  if (leftGroup) leftGroup.addEventListener('touchend', handleMobileAction);
  if (rightGroup) rightGroup.addEventListener('touchend', handleMobileAction);

  // Update fullscreen button state when fullscreen changes
  document.addEventListener('fullscreenchange', () => {
    const fsBtn = mobileMenu.querySelector('[data-action="fullscreen"]');
    if (fsBtn) fsBtn.classList.toggle('active', !!document.fullscreenElement);
  });
}

// ── Start ──
animate();
console.log('Well Dipper — Star System');
console.log('Controls: Space=new system, Tab=next planet, 1-9=planet#, Esc=overview, O=orbits, G=gravity wells, A=autopilot, Middle-click=free look, Click/tap=select');
