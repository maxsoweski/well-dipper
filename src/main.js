import './style.css';
import * as THREE from 'three';
import { StarFlare } from './objects/StarFlare.js';
import { RealStarCatalog } from './generation/RealStarCatalog.js';
import { RealFeatureCatalog } from './generation/RealFeatureCatalog.js';
import { HashGridStarfield } from './generation/HashGridStarfield.js';
import { createStarRenderer } from './rendering/objects/StarRenderer.js';
import { Planet } from './objects/Planet.js';
import { Moon } from './objects/Moon.js';
import { BodyRenderer } from './rendering/objects/BodyRenderer.js';
import { LODManager } from './rendering/LODManager.js';
import { DebugPanel } from './ui/DebugPanel.js';
import { OrbitLine } from './objects/OrbitLine.js';
import { AsteroidBelt } from './objects/AsteroidBelt.js';
import { Billboard, billboardColor } from './objects/Billboard.js';
import { PlanetBillboard } from './objects/PlanetBillboard.js';
import { GravityWellMap } from './ui/GravityWellMap.js';
// import { CameraController } from './camera/CameraController.js'; // OLD — kept for revert
import { ShipCameraSystem, CameraMode } from './camera/ShipCameraSystem.js';
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
import { generateSolarSystem } from './generation/SolarSystemData.js';
import { KnownSystems } from './generation/KnownSystems.js';
import { SeededRandom } from './generation/SeededRandom.js';
import { SystemMap } from './ui/SystemMap.js';
import { AutoNavigator } from './auto/AutoNavigator.js';
import { FlythroughCamera } from './auto/FlythroughCamera.js';
import { AutopilotNavSequence } from './auto/AutopilotNavSequence.js';
import { WarpEffect } from './effects/WarpEffect.js';
import { WarpPortal } from './effects/WarpPortal.js';
import { portalPreviewDistanceScene, postExitDistanceScene } from './core/ScaleConstants.js';
import { Settings } from './ui/Settings.js';
import { BodyInfo } from './ui/BodyInfo.js';
import { TargetingReticle } from './ui/TargetingReticle.js';
import { SoundEngine } from './audio/SoundEngine.js';
import { MusicManager } from './audio/MusicManager.js';
import { generateSystemNames, generateSystemName } from './generation/NameGenerator.js';
import { GalacticMap } from './generation/GalacticMap.js';
import { NavComputer } from './ui/NavComputer.js';
import { StarfieldGenerator } from './generation/StarfieldGenerator.js';
import { SkyRenderer } from './rendering/SkyRenderer.js';
import { SkyFeatureLayer } from './rendering/sky/SkyFeatureLayer.js';
import { KNOWN_OBJECT_PROFILES } from './data/KnownObjectProfiles.js';
import { ShipSpawner } from './objects/ShipSpawner.js';
import { TextureBaker, getBakeType } from './rendering/TextureBaker.js';
import { createTexturedBodyMaterial } from './rendering/shaders/TexturedBodyShader.js';
import { createMaterialBodyMaterial, PALETTES } from './rendering/shaders/MaterialBodyShader.js';
import { PretextLab } from './ui/PretextLab.js';

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
const camera = new THREE.PerspectiveCamera(settings.get('fov'), window.innerWidth / window.innerHeight, 1e-9, 200000);

// ── Ship Spawner ──
const shipSpawner = new ShipSpawner();
shipSpawner.init();  // async, loads manifest in background — non-blocking

// ── Retro Renderer ──
const canvas = document.getElementById('canvas');
const retroRenderer = new RetroRenderer(canvas, scene, camera);
retroRenderer.setColorPalette(settings.get('colorPalette'));

// ── Texture Baker (runtime procedural → texture baking) ──
let textureBaker = null; // lazy-init on first use (needs renderer)

// ── Camera Controller ──
// Mobile forces TOY_BOX mode (no Flight mode on phones). The full
// `_isMobile` flag is declared further down; we compute the touch-detect
// inline here so ShipCameraSystem can gate Flight mode at construction.
const cameraController = new ShipCameraSystem(camera, canvas, {
  isMobile: 'ontouchstart' in window,
});
// Debug access for Playwright/console
window._cam = camera;
window._cc = cameraController;
window._scene = scene;
window._retroRenderer = retroRenderer;

// Toggle in-system objects (planets, moons, orbits, labels) for sky debugging.
// Call from console: window._skyOnly()  or  window._skyOnly(false) to restore.
window._skyOnly = (hide = true) => {
  // Recursively hide/show everything in the main scene
  scene.traverse(obj => {
    if (obj !== scene) obj.visible = !hide;
  });
  // The sky is rendered in a separate scene by SkyRenderer — leave it alone
  console.log(hide ? '[DEBUG] System objects hidden — sky only' : '[DEBUG] System objects restored');
};

// ── LOD Manager ──
// Evaluates camera distance to bodies and assigns LOD tiers each frame.
const lodManager = new LODManager(camera);

// ── Debug Panel ──
// Backtick (`) toggles corner HUD, F3 toggles full inspection panel.
const debugPanel = new DebugPanel();
debugPanel.setCamera(camera);
debugPanel.setCameraController(cameraController);

// When free-look ends without a focused body (title screen, deep sky),
// clear focus so the camera stays where it was looking.
cameraController.onFreeLookEnd = () => {
  if (!autoNav.isActive) {
    focusIndex = -1;
    focusMoonIndex = -1;
    focusStarIndex = -1;
  }
};
// Tell the camera controller whether a body is currently focused,
// so it knows whether to resume orbit or clear focus on free-look exit.
cameraController.hasFocusedBody = () => {
  if (autoNav.isActive) return true;
  if (!system || !system.planets) return false;
  if (focusIndex === -2 && focusStarIndex >= 0) return true;
  if (focusIndex >= 0 && focusIndex < system.planets.length) return true;
  return false;
};

// ── Galaxy State ──
// GalacticMap provides the structural galaxy. When active, it drives
// starfield generation, system properties, and warp target resolution.
// When null, legacy sequential seed mode is used (screensaver).
const galacticMap = new GalacticMap('well-dipper-galaxy-1');
let playerGalacticPos = galacticMap.getStartPosition();
let currentGalaxyStar = null; // the GalacticMap star entry we're currently at

// ── Sky Renderer ──
// Coordinates galaxy glow + starfield + sky features with shared brightness budget.
// Replaces the old pattern of manually managing Starfield + GalaxyGlow.
const skyRenderer = new SkyRenderer(galacticMap, StarfieldGenerator, settings.get('starDensity'));
skyRenderer.prepareForPosition(playerGalacticPos);
skyRenderer.activate();
retroRenderer.setSkyRenderer(skyRenderer);

// ── Real Star Catalog ──
// Load the HYG database (15,598 real naked-eye stars with names and positions).
// Once loaded, real stars are merged into every subsequent starfield generation.
const realStarCatalog = new RealStarCatalog();
// ── Real Data Catalogs ──
// Load in background. Used on next warp/teleport, not immediately.
const realFeatureCatalog = new RealFeatureCatalog();

// Load real star catalog
realStarCatalog.load().then(() => {
  StarfieldGenerator.realStarCatalog = realStarCatalog;
  debugPanel.setRealStarCatalog(realStarCatalog);
  if (_navComputer) _navComputer.setRealStarCatalog(realStarCatalog);
  console.log(`Real star catalog loaded: ${realStarCatalog.count} stars`);
});

// Load real feature catalogs (globular clusters, etc.)
realFeatureCatalog.load().then(() => {
  debugPanel.setRealFeatureCatalog(realFeatureCatalog);
  // Make real features available to the hash grid for Plummer density
  HashGridStarfield.realFeatureCatalog = realFeatureCatalog;
  console.log(`Real feature catalog loaded: ${realFeatureCatalog.globularClusters.length} globular clusters`);
});
debugPanel.setSkyRenderer(skyRenderer);
debugPanel.setRetroRenderer(retroRenderer);
debugPanel.setGalacticMap(galacticMap);
debugPanel.setPlayerPos(playerGalacticPos);

// Legacy aliases — these delegate to SkyRenderer so existing code
// (warp targets, star finding, etc.) continues to work during migration.
// TODO: Remove these once all callers are migrated to skyRenderer directly.
const starfield = {
  findNearestStar: (dir) => skyRenderer.findNearestStar(dir),
  getRandomVisibleStar: (dir) => skyRenderer.getRandomVisibleStar(dir),
  getGalaxyStarForIndex: (idx) => skyRenderer.getGalaxyStarForIndex(idx),
  setWarpUniforms: (fold, bright, rift) => skyRenderer.setWarpUniforms(fold, bright, rift),
  update: (pos) => {}, // SkyRenderer.update() handles this now
};

// ── System State ──
let seedCounter = 0;
let _currentSystemName = '';

// Deterministic string → vec3 hash for the tunnel uHashSeed uniforms.
// Triple FNV-1a walk; output in [100, 1000] matching lab seed magnitude.
function _seedStringToVec3(s) {
  const str = String(s || '');
  let h1 = 2166136261, h2 = 16777619, h3 = 374761393;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619);
    h2 = Math.imul(h2 ^ c, 2246822519);
    h3 = Math.imul(h3 ^ c, 3266489917);
  }
  const m = v => 100 + ((v >>> 0) % 900000) / 1000;
  return [m(h1), m(h2), m(h3)];
}
let system = null;
let focusIndex = -1;   // -1 = system overview, 0+ = focused planet index
let focusMoonIndex = -1; // -1 = focused on planet itself, 0+ = specific moon
let orbitsVisible = settings.get('showOrbits');
let gravityWellVisible = settings.get('showGravityWells');
// Default minimap off on mobile (too small to be useful, overlaps controls)
const _isMobile = 'ontouchstart' in window;
let minimapVisible = false; // off by default — toggle with G key
let gravityWell = null;        // GravityWellMap instance (contour minimap)
let gravityWellPlanets = null; // lightweight position proxies for the well
let systemMap = null;

// ── Body Info HUD ──
const bodyInfo = new BodyInfo();

// ── Targeting Reticle (in-system body selection HUD) ──
// Three visual states: none, tentative (hover), selected (committed).
// Owns rendering only — main.js owns the state (_hoverTarget, _selectedTarget).
const targetingReticle = new TargetingReticle(camera);
// Debug hook — inspect reticle state from DevTools / Playwright
window._reticle = targetingReticle;
window._getReticleState = () => ({
  enabled: targetingReticle.enabled,
  hover: _hoverTarget ? { kind: _hoverTarget.kind, name: _hoverTarget.name } : null,
  selected: _selectedTarget ? { kind: _selectedTarget.kind, name: _selectedTarget.name } : null,
});
window._hitTestBodies = (x, y, t) => hitTestBodies(x, y, t);

// Reticle state — single source of truth for selection
let _hoverTarget = null;     // body under the mouse (tentative reticle)
let _selectedTarget = null;  // committed/selected body (selected reticle + commit button)

// HUD master toggle (H key). Hides brackets, body-info printout, BURN button,
// and the minimap all at once. Camera/selection state is preserved — this is
// purely a visual toggle for taking in the scene without HUD clutter.
let _hudVisible = true;
function _applyHudVisibility() {
  if (typeof document !== 'undefined') {
    document.body.classList.toggle('hud-hidden', !_hudVisible);
  }
  // Minimap lives inside the RetroRenderer HUD pass, not the DOM — blank it
  // while the HUD is hidden and restore it from the saved minimapVisible
  // state when the HUD comes back.
  if (!_hudVisible) {
    retroRenderer.setHud(null, null);
  } else if (system && !gravityWellVisible && minimapVisible && systemMap) {
    retroRenderer.setHud(systemMap.scene, systemMap.camera);
  } else if (system && gravityWellVisible && gravityWell) {
    retroRenderer.setHud(gravityWell.scene, gravityWell.camera);
  }
}
// Ghost reticles for sub-pixel bodies: rebuilt every frame by the LOD loop,
// then passed to TargetingReticle.update() so each tiny planet/moon shows as
// a small dim empty bracket (Elite-style). Hover/click use the normal
// hitTestBodies path, which doesn't check mesh.visible.
const _ghostTargets = [];
// Occluders: visible body meshes that can block a reticle. Reticles render
// on a 2D overlay that doesn't participate in the WebGL depth buffer, so we
// do an analytical ray/sphere test against this list to hide reticles that
// would otherwise draw "through" a planet or star. Rebuilt every frame in
// the LOD loop. Each entry: { mesh, radius }.
const _occluders = [];
// Output of the per-frame ghost occlusion filter — only ghosts that are
// actually visible from the camera's perspective get passed to the reticle.
const _visibleGhostTargets = [];

/**
 * Analytical ray/sphere occlusion test. Returns true if any occluder's
 * sphere intersects the ray from camera → target strictly before the
 * target itself, meaning the target reticle should be hidden.
 *
 * Self-occlusion is skipped by mesh reference — if the target's own mesh
 * is in the occluder list (because it's currently visible), it doesn't
 * block itself.
 */
const _occDir = new THREE.Vector3();
function _isReticleOccluded(target) {
  if (!target?.mesh) return false;
  _occDir.subVectors(target.mesh.position, camera.position);
  const targetDist = _occDir.length();
  if (targetDist < 1e-6) return false;
  _occDir.divideScalar(targetDist);
  const cx = camera.position.x;
  const cy = camera.position.y;
  const cz = camera.position.z;
  for (let i = 0; i < _occluders.length; i++) {
    const occ = _occluders[i];
    if (occ.mesh === target.mesh) continue;
    const ox = occ.mesh.position.x - cx;
    const oy = occ.mesh.position.y - cy;
    const oz = occ.mesh.position.z - cz;
    // Project occluder center onto the ray
    const t = ox * _occDir.x + oy * _occDir.y + oz * _occDir.z;
    if (t <= 0 || t >= targetDist) continue; // behind camera or past target
    // Perpendicular distance from occluder center to the ray
    const px = cx + _occDir.x * t;
    const py = cy + _occDir.y * t;
    const pz = cz + _occDir.z * t;
    const dx = occ.mesh.position.x - px;
    const dy = occ.mesh.position.y - py;
    const dz = occ.mesh.position.z - pz;
    const perpSq = dx * dx + dy * dy + dz * dz;
    if (perpSq < occ.radius * occ.radius) return true;
  }
  return false;
}

/**
 * Clear both reticle targets. Called on warp, system swap, deselect, etc.
 */
function _clearReticleTargets() {
  _hoverTarget = null;
  _selectedTarget = null;
}

/** True if two target descriptors refer to the same in-system body. */
function _isSameTarget(a, b) {
  if (!a || !b) return false;
  if (a.kind !== b.kind) return false;
  if (a.kind === 'star') return a.starIndex === b.starIndex;
  if (a.kind === 'planet') return a.planetIndex === b.planetIndex;
  if (a.kind === 'moon') return a.planetIndex === b.planetIndex && a.moonIndex === b.moonIndex;
  return false;
}

// ── Autopilot (cinematic flythrough) ──
const autoNav = new AutoNavigator();
const flythrough = new FlythroughCamera(camera);
window._flythrough = flythrough;
window._autoNav = autoNav;
window._triggerTourComplete = () => { if (autoNav.onTourComplete) autoNav.onTourComplete(); };
window._startFlythrough = () => startFlythrough();
window._getState = () => ({ warp: warpEffect.isActive, splash: splashActive, title: titleScreenActive, autopilot: _autopilotEnabled, idle: idleTimer.toFixed(1), labState: _portalLabState });
let idleTimer = 0;

// ── Warp transition (system-to-system) ──
const warpEffect = new WarpEffect();
const warpPortal = new WarpPortal();
scene.add(warpPortal.group);  // add to the main scene (not sky scene)

// Dual-portal stencil traversal — replaces the fullscreen composite hyperspace
// with the lab's 3-state (OUTSIDE_A / INSIDE / OUTSIDE_B) mesh traversal.
// Toggle to false to fall back to the legacy composite path for comparison.
const _useDualPortal = true;

// Portal lab mode — diagnostic-only warp. Strips ALL extraneous effects
// (sounds, music, rim pulsing, flythrough reveal on arrival) so Max can
// see the raw portal + tunnel mesh behavior. Enable with `?portalLab` in
// the URL. When active, two-stage spacebar flow:
//   1. Target a star + press Space: portal OPENS at the rift direction but
//      the camera stays still. Player eyeballs the portal + tunnel mesh.
//   2. Press Space again: normal warp sequence fires (camera flies through
//      A → INSIDE → B), but sound/music/autopilot are suppressed. After the
//      warp completes, Portal B stays at its landing position in the new
//      system so Max can fly around it and inspect.
const _portalLabMode = new URLSearchParams(location.search).has('portalLab');

// Lab-mode 3-stage spacebar state machine:
//   'idle'      — ready for Space #1: open portal preview
//   'preview'   — portal open, ready for Space #2: align camera + light strip
//   'aligning'  — camera slerping + crosses lighting up; next Space fires warp
// The 'aligning' state covers both "animation in progress" and "animation
// finished, waiting for the third Space press" — mashing Space during the
// animation skips straight to firing the warp (the warp loop does its own
// slerp during FOLD so cutting the preview-align short isn't visually harsh).
let _portalLabState = 'idle';
// Distance from camera to Portal A when opened in lab-mode preview.
// Realistic ship-scale (post-scale-audit): portal sits 50× player-ship
// lengths ahead of camera (1 km for a 20 m ship). Derived from
// ScaleConstants so any change to SHIP_HULL_LENGTHS_M.player or
// PORTAL_PREVIEW_TO_SHIP propagates here. The FOLD camera ramp in
// WarpEffect.js crosses this distance over FOLD_DUR via its quadratic
// speed ramp (see foldPeakSpeedScenePerSec).
const _portalLabPreviewDistance = portalPreviewDistanceScene();
// Alignment animation state (drives camera slerp + entry-strip progress)
const _portalLabAlignDuration = 1.5;
let _portalLabAlignElapsed = 0;
const _portalLabAlignStartQuat = new THREE.Quaternion();
const _portalLabAlignTargetQuat = new THREE.Quaternion();
const _portalLabAlignLookMatrix = new THREE.Matrix4();

// Lab arrival slerp: after the warp completes, the camera is past Portal B
// and facing forward (away from the portal). Before handing control back to
// the orbit controller — whose lookAt(target) would snap the camera 180°
// instantly to face Portal B — we smoothly slerp the camera to face Portal B
// over _labArrivalDuration seconds. Orbit handoff happens when the slerp
// completes (quaternion dot exceeds threshold).
let _labArriving = false;
let _labArrivalElapsed = 0;
const _labArrivalDuration = 1.5;  // seconds
const _labArrivalTarget = new THREE.Vector3();
const _labArrivalTargetQuat = new THREE.Quaternion();
const _labArrivalStartQuat = new THREE.Quaternion();
const _labArrivalLookMatrix = new THREE.Matrix4();

// When the camera crosses Portal A's plane mid-warp, fire the system swap.
// Geometric trigger replaces the WarpEffect.js:244 timer (`elapsed > 0.15`).
//
// `warpSwapSystem()` teleports the camera to the destination star's vicinity
// with camera.lookAt(starPos). After that teleport, Portal A (at the old
// camera's vicinity) is far away and Portal B is nowhere near the new
// flight path — the subsequent OUTSIDE_B crossing would never fire.
//
// Fix: re-anchor the portal at the new camera position, aligned with the
// new camera's forward direction. Portal A ends up just behind the new
// camera (so we're still INSIDE for one frame) and Portal B ends up
// tunnelLength ahead, which the camera will then fly through during HYPER
// → EXIT. The visual jump is invisible because the tunnel is rendering
// unconditionally in INSIDE mode — the player sees only tunnel walls.
const _swapNewForward = new THREE.Vector3();
const _swapPortalAPos = new THREE.Vector3();
// Arrival forward direction — captured once at warp onComplete, used by
// the per-frame Portal B follow logic so Portal B stays in a FIXED world
// direction behind the ship (camera can freely rotate to find it) instead
// of always "behind whatever the camera is currently facing."
const _arrivalForward = new THREE.Vector3();
const _portalFollowPos = new THREE.Vector3();
const _portalFollowTarget = new THREE.Vector3();
// onTraversal must be async: onSwapSystem awaits pendingSystemDataPromise
// then calls warpSwapSystem which TELEPORTS the camera to the new system.
// Pre-2026-04-17, this callback was synchronous: it invoked onSwapSystem
// (fire-and-forget) and then re-anchored Portal A at the *pre-teleport*
// camera position. Once the async body resolved and warpSwapSystem ran,
// the camera jumped thousands of scene units away, leaving the tunnel
// mesh orphaned in the old world — HYPER rendered ~40 black frames
// because the camera was nowhere near the tunnel walls (measured: 10,499
// scene units offset vs a 200-unit tunnel length).
//
// Fix: await the full swap before re-anchoring. The await resolves after
// warpSwapSystem's camera.position.set(...), so Portal A is placed at the
// correct new-world camera position and the tunnel properly surrounds the
// camera for the rest of HYPER.
warpPortal.onTraversal = async (mode) => {
  console.log(`[WARP-PORTAL] traversal → ${mode}`);
  if (mode === 'INSIDE' && !warpEffect._swapFired && warpEffect.onSwapSystem) {
    warpEffect._swapFired = true;
    await warpEffect.onSwapSystem();

    // Re-anchor Portal A at the post-teleport camera position. Offset a
    // tiny amount (~15 mm = 1e-10 scene units) behind camera so the
    // INSIDE-mode invariant holds (camera on +forward side of Portal A)
    // without eating into the HYPER+EXIT travel budget.
    camera.getWorldDirection(_swapNewForward);
    _swapPortalAPos.copy(camera.position).addScaledVector(_swapNewForward, -1e-10);
    warpPortal.resetTraversal();
    warpPortal.open(_swapPortalAPos, _swapNewForward);
    // resetTraversal sets mode to OUTSIDE_A; force back to INSIDE for HYPER.
    warpPortal.setTraversalMode('INSIDE');
    // Dot history re-seeds on next updateTraversal call.
    warpPortal._prevDotA = null;
    warpPortal._prevDotB = null;
  }
};

window._warpPortal = warpPortal;  // DEBUG: expose for console testing
window._warpEffect = warpEffect;  // DEBUG: expose warp state + .start(dir) for console/Playwright
window._skyRenderer = skyRenderer;  // DEBUG: inspect origin/destination layers during crossover
// NOTE: warpTarget + commitSelection are exposed further down in the file,
// AFTER their declarations (they're in the TDZ here and trying to read them
// throws "Cannot access 'warpTarget' before initialization").

// Warp debug HUD — enable by appending ?warpDebug to the URL.
// Shows state, progress, and the sky-layer uniforms driven by the seamless
// tunnel code so the crossover + deformation are visible at a glance.
if (new URLSearchParams(location.search).has('warpDebug')) {
  const hud = document.createElement('div');
  hud.id = 'warp-debug-hud';
  hud.style.cssText = 'position:fixed;top:10px;right:10px;z-index:9999;background:rgba(0,0,0,0.75);color:#0f0;font:11px/1.4 "Courier New",monospace;padding:8px 12px;border:1px solid #0f0;white-space:pre;pointer-events:none;min-width:300px';
  document.body.appendChild(hud);
  window._warpDebugHUD = hud;
}
window._togglePortal = () => {
  if (warpPortal.group.visible) {
    warpPortal.close();
    console.log('[DEBUG] Portal closed');
  } else {
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const pos = camera.position.clone().addScaledVector(dir, 30);
    warpPortal.open(pos, dir);
    console.log('[DEBUG] Portal opened at', pos, 'facing', dir);
  }
};
let pendingSystemData = null; // pre-generated data cached during fold phase
let pendingSystemDataPromise = null; // in-flight generation promise; onSwapSystem awaits before spawn

// ── Warp target selection ──
// Tracks which background star the user clicked (or auto-selected).
// Direction is used when starting warp so the rift opens toward that star.
const warpTarget = {
  direction: null,   // THREE.Vector3 world-space direction, or null
  name: null,        // deterministic name for the selected star (shown in BodyInfo)
  starIndex: -1,     // index in starfield positions array (seeds name)
  destType: null,    // null = normal star, 'feature:emission-nebula' etc., 'external-galaxy'
  featureData: null, // feature data from GalacticMap (when destType is feature:*)
  galaxyData: null,  // external galaxy data (when destType is 'external-galaxy')
  blinkTimer: 0,     // accumulates time for 2 Hz blink
  blinkOn: false,    // current blink state
  turning: false,    // camera is rotating to face target before warp
  turnTimer: 0,      // seconds into the turn
  lockBlinkFrames: 0, // frame counter for rapid lock-on blink
};
window._warpTarget = warpTarget;  // DEBUG: expose warp target for Playwright driving

// When the tour visits every body, use the nav computer for a cinematic warp sequence.
// The nav computer opens, drills down through galaxy levels, picks a star, and warps.
autoNav.onTourComplete = () => {
  // Initialize the nav sequence if needed
  if (!_autopilotNavSequence) {
    _autopilotNavSequence = new AutopilotNavSequence({
      navComputer: _navComputer,
      galacticMap: galacticMap,
      openNavComputer: openNavComputer,
      closeNavComputer: closeNavComputer,
      soundEngine: soundEngine,
      playerPos: playerGalacticPos,
      onWarpReady: (star) => {
        // Set warp target from the nav sequence's selected star
        warpTarget.navStarData = star;
        warpTarget.name = star.name;
        warpTarget.destType = null;
        warpTarget.featureData = null;
        warpTarget.galaxyData = null;
        // Close nav computer (dispatches the pending warp action)
        closeNavComputer();
      },
      onComplete: () => {
        // If the sequence aborted without finding a star, fall back to old behavior
        if (!warpTarget.navStarData) {
          autoSelectWarpTarget();
          if (warpTarget.navStarData || warpTarget.featureData || warpTarget.galaxyData) {
            setTimeout(() => beginWarpTurn(), 1500);
          }
        }
      },
    });
  }

  // Ensure nav computer is initialized
  if (!_navComputer) _initNavComputer();

  // Update player position for destination picking
  _autopilotNavSequence._playerPos = playerGalacticPos || { x: 8, y: 0, z: 0 };
  _autopilotNavSequence._nav = _navComputer;

  // Start the cinematic sequence
  _autopilotNavSequence.start();
};

// Deep sky contemplation: camera stays fixed, timer triggers next warp.
// No autopilot, no orbiting — these objects are impossibly far away.
let _deepSkyLingerTimer = -1; // -1 = not lingering, >=0 = counting down
let _deepSkyDrift = null;     // { startPos, endPos, duration, elapsed } — momentum coast on arrival

// Debug: force the next warp to a specific destination type.
// Press comma/period/? then Space to force galaxy/nebula/cluster.
let _forceNextDestType = null;
const _heldKeys = new Set();

// ── Splash + Intro sequence ──
let splashActive = true;

function startIntroSequence() {
  const splash = document.getElementById('splash-screen');
  if (splash) splash.style.display = 'none';

  const overlay = document.getElementById('intro-overlay');
  const logo1 = document.getElementById('intro-logo1');
  const logo2 = document.getElementById('intro-logo2');
  const titleEl = document.getElementById('title-screen');

  if (!overlay || !logo1 || !logo2) {
    // Fallback: skip intro, show title directly
    if (titleEl) titleEl.style.display = '';
    splashActive = false;
    titleScreenActive = true;
    musicManager.play('title');
    return;
  }

  overlay.style.display = '';

  // Start intro music immediately (one-shot, plays over the logo sequence)
  musicManager.playOnce('intro', 0.8);

  // Timeline (~12 seconds total):
  //   0.0s — Logo 1 fades in
  //   2.4s — Logo 1 fades out
  //   4.0s — Logo 2 fades in
  //   6.4s — Logo 2 fades out
  //   8.0s — Overlay removed, title screen shown

  // Logo 1 in
  setTimeout(() => { logo1.classList.add('visible'); }, 200);
  // Logo 1 out
  setTimeout(() => { logo1.classList.remove('visible'); }, 2400);
  // Logo 2 in
  setTimeout(() => { logo2.classList.add('visible'); }, 4000);
  // Logo 2 out
  setTimeout(() => { logo2.classList.remove('visible'); }, 6400);
  // Remove overlay, show title screen
  setTimeout(() => {
    overlay.style.display = 'none';
    if (titleEl) {
      titleEl.style.display = '';
      void titleEl.offsetHeight;
      titleEl.classList.add('animate-in');
    }
    splashActive = false;
    titleScreenActive = true;
    // Start looping title theme, then set auto-dismiss timer once loaded
    musicManager.play('title').then(() => {
      if (!titleScreenActive) return;
      const titleDur = musicManager.getDuration('title');
      const titleLoops = 1; // title track is ~3:16 — plays once, no looping needed
      const silenceGap = 3000;
      if (_titleAutoTimer) clearTimeout(_titleAutoTimer);
      if (titleDur > 0) {
        _titleAutoTimer = setTimeout(() => {
          musicManager.stop(1.0);
          _titleAutoTimer = setTimeout(() => {
            if (titleScreenActive) {
              dismissTitleScreen();
              // Always select a real hash grid star before warping — but skip
              // the auto-warp in portal-lab diagnostic mode (player drives).
              if (!_portalLabMode) {
                setTimeout(() => { autoSelectWarpTarget(); beginWarpTurn(); }, 1500);
              }
            }
          }, silenceGap);
        }, titleDur * titleLoops * 1000);
      }
    });
  }, 8000);
}

/**
 * Debug helper: teleport to a known system (Sol, etc.) and set up all the
 * state the nav computer / glow layer / debug panel need. This bypasses
 * the normal warp flow which is what sets `currentGalaxyStar` /
 * `_currentSystemName` under normal gameplay. Without those, the nav
 * computer can't identify the current system and opens to column view.
 *
 * @param {Object} knownSys — entry from KnownSystems.findAt()
 * @param {{x:number,y:number,z:number}} pos — galactic position (kpc)
 */
function _debugEnterKnownSystem(knownSys, pos) {
  playerGalacticPos = { ...pos };
  if (skyRenderer._glowLayer?.setPlayerPosition) {
    skyRenderer._glowLayer.setPlayerPosition(playerGalacticPos);
  }

  const sysData = knownSys.generate();
  sysData._knownSystemNames = knownSys.names;

  // Set currentGalaxyStar so openNavComputer can build a starData entry
  // for openToCurrentSystem (which gates the jump to system view).
  currentGalaxyStar = {
    worldX: pos.x,
    worldY: pos.y,
    worldZ: pos.z,
    seed: knownSys.seed || knownSys.name || 'known',
    type: sysData.star?.type || 'G',
    name: knownSys.name,
    isReal: true,
  };
  _currentSystemName = knownSys.name || 'Unknown';

  spawnSystem({ forWarp: false, systemData: sysData });
  debugPanel.setPlayerPos(playerGalacticPos);
  console.log(`[DEBUG] Entered known system: ${knownSys.name}`);
}

// Splash screen click/touch handler — hold D for debug skip.
// D-hold-begin: dismiss splash/title AND immediately spawn the Sol system
// (no warp animation) so the tester lands in a known reference system in
// one click instead of waiting through a warp. Shift+N randomizes the system.
function _handleSplashDismiss(e) {
  if (!splashActive) return;
  if (e.type === 'touchend') { e.preventDefault(); }
  if (_heldKeys.has('KeyD')) {
    const splash = document.getElementById('splash-screen');
    if (splash) splash.style.display = 'none';
    const titleEl = document.getElementById('title-screen');
    if (titleEl) titleEl.style.display = 'none';
    splashActive = false;
    titleScreenActive = false;
    if (skyRenderer._glowLayer?.mesh) skyRenderer._glowLayer.mesh.visible = true;
    // Clear D key so it doesn't trigger WASD flight after skip
    _heldKeys.delete('KeyD');
    _heldKeys.delete('d');
    // Spawn Sol directly — known reference system
    const solPos = { x: GalacticMap.SOLAR_R, y: GalacticMap.SOLAR_Z, z: 0.0 };
    const knownSol = KnownSystems.findAt(solPos);
    if (knownSol) {
      _debugEnterKnownSystem(knownSol, solPos);
    } else {
      console.warn('[DEBUG] Sol not found in KnownSystems — falling back to random star system');
      _debugSpawnType('star-system');
    }
    return;
  }
  startIntroSequence();
}
document.getElementById('splash-screen')?.addEventListener('click', _handleSplashDismiss);
document.getElementById('splash-screen')?.addEventListener('touchend', _handleSplashDismiss);

// ── Title screen ──
let titleScreenActive = false;
let _titleAutoTimer = null;

function dismissTitleScreen() {
  if (!titleScreenActive) return;
  titleScreenActive = false;
  // soundEngine.play('titleDismiss'); // muted for now
  musicManager.stop(0.5);
  _autopilotEnabled = true; // title screen always leads to autopilot screensaver
  // Galaxy glow stays hidden until warp (restored in onSwapSystem)
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

// ── Nav Computer ──
let _navComputerOpen = false;
let _manualBurnOrbiting = false; // true when camera is in post-burn slow orbit (flythrough active, autoNav off)
let _autopilotEnabled = false;   // persists through warps (independent of autoNav.isActive)
let _navComputer = null;
let _navAnimFrame = null;
let _autopilotNavSequence = null; // cinematic nav drill-down for autopilot warps

// ── System ambient music (periodic, with gaps) ──
let _systemMusicTimer = null;

function _scheduleSystemMusic(minDelay, maxDelay) {
  if (_systemMusicTimer) clearTimeout(_systemMusicTimer);
  const delay = (minDelay + Math.random() * (maxDelay - minDelay)) * 1000;
  _systemMusicTimer = setTimeout(() => {
    if (warpEffect.isActive || splashActive || titleScreenActive) {
      // Not the right time — reschedule
      _scheduleSystemMusic(5, 15);
      return;
    }
    musicManager.playOnce('explore', 0.6);
    // After the track plays, wait a 2-minute gap before the next play
    const trackDur = musicManager.getDuration('explore') || 94;
    _systemMusicTimer = setTimeout(() => {
      _scheduleSystemMusic(120, 120);
    }, trackDur * 1000);
  }, delay);
}

function _cancelSystemMusic() {
  if (_systemMusicTimer) { clearTimeout(_systemMusicTimer); _systemMusicTimer = null; }
}

// ── Nav Computer: open / close / dispatch (separated concerns) ──

function _initNavComputer() {
  const navCanvas = document.getElementById('nav-computer-canvas');
  _navComputer = new NavComputer(navCanvas, galacticMap, retroRenderer.renderer);
  if (realStarCatalog.loaded) _navComputer.setRealStarCatalog(realStarCatalog);

  // COMMIT button → request close (action retrieved via nav.close())
  _navComputer.setCommitCallback((action) => {
    // Store the action, then close — dispatchNavAction reads it
    _navComputer._pendingAction = action;
    closeNavComputer();
  });

  // Audio bridges
  _navComputer.setDrillSoundCallback((levelIdx) => soundEngine.play(`navDrill${levelIdx}`));
  _navComputer.setSoundCallback((name) => soundEngine.play(name));

  // Autopilot toggle from nav computer
  _navComputer.setOnAutopilotToggle((enable) => {
    if (enable) startFlythrough();
    else stopFlythrough();
    _navComputer.setAutopilotState(enable);
  });
}

function openNavComputer() {
  const el = document.getElementById('nav-computer-overlay');
  if (!el || _navComputerOpen) return;
  _navComputerOpen = true;
  soundEngine.play('navOpen');
  el.style.display = 'flex';

  if (!_navComputer) _initNavComputer();

  // Sync state
  _navComputer.setPlayerPosition(playerGalacticPos || { x: 8, y: 0, z: 0 }, null);
  _navComputer._currentSystemName = _currentSystemName || 'Unknown';
  _navComputer.setCurrentBody(focusIndex, focusMoonIndex);

  // Build star entry from currentGalaxyStar — bypasses async _localStars search.
  // This guarantees the nav opens to the correct system immediately.
  let currentStar = null;
  const sysData = system?._systemData || null;
  if (currentGalaxyStar) {
    const gs = currentGalaxyStar;
    currentStar = {
      wx: gs.worldX, wy: gs.worldY, wz: gs.worldZ,
      name: _currentSystemName || '',
      spectral: gs.type || sysData?.star?.type || 'G',
      seed: gs.seed, dist: 0, distPc: '0',
    };
  }
  _navComputer.setAutopilotState(autoNav.isActive || _autopilotEnabled);
  _navComputer.openToCurrentSystem(currentStar, sysData);

  // Pass existing warp target for display
  if (warpTarget.direction && galacticMap) {
    const targetWorldPos = _resolveWarpTargetGalacticPos();
    _navComputer.setExternalTarget(targetWorldPos, warpTarget.name || null);
  } else {
    _navComputer.setExternalTarget(null);
  }

  _navComputer.activate();
  _navRenderLoop();
}

function closeNavComputer() {
  const el = document.getElementById('nav-computer-overlay');
  if (!el || !_navComputerOpen) return;
  _navComputerOpen = false;
  soundEngine.play('navClose');

  // Read and dispatch any pending action
  const action = _navComputer?._pendingAction || null;
  _navComputer._pendingAction = null;

  if (_navComputer) _navComputer.deactivate();
  el.style.display = 'none';
  if (_navAnimFrame) { cancelAnimationFrame(_navAnimFrame); _navAnimFrame = null; }

  dispatchNavAction(action);
}

function dispatchNavAction(action) {
  if (!action) return;
  console.log(`[NAV DISPATCH] type=${action.type}, target=${action.target}, star=${action.star?.name} seed=${action.star?.seed}`);

  if (action.type === 'burn') {
    // Stop autopilot so the travelComplete handler uses the manual path
    // (otherwise it orbits autoNav's current stop, not the burn target)
    if (autoNav.isActive) {
      flythrough.stop();
      autoNav.stop();
    }
    // Update the in-system reticle's selected target BEFORE calling
    // focus*() — those trigger travel, and we want the reticle locked
    // on the destination throughout the burn.
    let burnTarget = null;
    if (action.target === 'star') burnTarget = _makeTarget('star', { starIndex: action.starIndex || 0 });
    else if (action.target === 'planet') burnTarget = _makeTarget('planet', { planetIndex: action.planetIndex });
    else if (action.target === 'moon') burnTarget = _makeTarget('moon', { planetIndex: action.planetIndex, moonIndex: action.moonIndex });
    if (burnTarget) _selectedTarget = burnTarget;
    // In-system transit — same focus functions as Tab/1-9 keys
    if (action.target === 'star') focusStar(action.starIndex || 0);
    else if (action.target === 'planet') focusPlanet(action.planetIndex);
    else if (action.target === 'moon') focusMoon(action.planetIndex, action.moonIndex);
  } else if (action.type === 'warp') {
    // Stop any active flythrough/orbit before warping
    if (flythrough.active) flythrough.stop();
    if (autoNav.isActive) autoNav.stop();
    _manualBurnOrbiting = false;
    // Inter-system warp
    _setWarpTargetFromNavStar({
      worldX: action.star.wx, worldY: action.star.wy, worldZ: action.star.wz,
      seed: action.star.seed, name: action.star.name, type: action.star.spectral,
    });
    setTimeout(() => beginWarpTurn(), 500);
  }
}

// Legacy toggle for keybind compatibility
function toggleNavComputer() {
  if (_navComputerOpen) closeNavComputer();
  else openNavComputer();
}

/**
 * Resolve the current warp target direction to a galactic position.
 * Used to pass the target to the nav computer for display.
 * Same search logic as onPrepareSystem's direction-based fallback.
 */
function _resolveWarpTargetGalacticPos() {
  const pos = playerGalacticPos || { x: 8, y: 0, z: 0 };

  // First try: if we have a starIndex, resolve via skyRenderer
  if (warpTarget.starIndex >= 0) {
    const entry = skyRenderer.getEntryForIndex(warpTarget.starIndex);
    if (entry?.starData && entry.starData.worldX !== undefined) {
      return { x: entry.starData.worldX, y: entry.starData.worldY, z: entry.starData.worldZ };
    }
  }

  // Check navStarData (nav computer selection — has exact position)
  if (warpTarget.navStarData) {
    return {
      x: warpTarget.navStarData.worldX,
      y: warpTarget.navStarData.worldY,
      z: warpTarget.navStarData.worldZ,
    };
  }

  // No direction-based fallback needed — every star is a real hash grid star
  console.warn('[WARP] _resolveWarpTargetGalacticPos: no starIndex or navStarData');
  return null;
}

/**
 * Set a warp target from a nav computer star selection.
 * Computes the sky direction from player → star and sets up the warp target
 * so it behaves identically to clicking a star in the sky.
 */
function _setWarpTargetFromNavStar(navStar) {
  const pos = playerGalacticPos || { x: 8, y: 0, z: 0 };
  const dx = navStar.worldX - pos.x;
  const dy = navStar.worldY - pos.y;
  const dz = navStar.worldZ - pos.z;
  const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (len < 1e-10) return; // star is at player position

  // Compute direction vector (same space as camera directions)
  const direction = new THREE.Vector3(dx / len, dy / len, dz / len);

  // Single-selection invariant: picking a star via the nav computer cancels
  // any in-system body selection so Space commits the warp rather than a
  // stale body burn.
  if (_selectedTarget) deselectTarget();

  // Set up warp target — attach the exact nav star data so warp resolution
  // can go directly to this star without a direction-based fallback search.
  // The fallback search uses HashGridStarfield.findStarsInRadius (same hash
  // grid the nav computer queries), so direct attachment avoids the search.
  soundEngine.play('warpTarget');
  warpTarget.direction = direction;
  warpTarget.starIndex = -1;  // no sky starfield index
  warpTarget.destType = null;  // normal star system
  warpTarget.featureData = null;
  warpTarget.galaxyData = null;
  warpTarget.navStarData = {    // exact star from nav computer's hash grid query
    worldX: navStar.worldX,
    worldY: navStar.worldY,
    worldZ: navStar.worldZ,
    seed: navStar.seed,
    type: navStar.type,
  };
  warpTarget.name = navStar.name || generateSystemName(new SeededRandom(`warp-nav-${navStar.seed}`), { x: navStar.worldX, y: navStar.worldY, z: navStar.worldZ });
  warpTarget.blinkTimer = 0;
  warpTarget.blinkOn = true;
  warpTarget.turning = false;

  // Show the target name in the HUD
  bodyInfo.showWarpTarget(warpTarget.name);
}

function _navRenderLoop() {
  if (!_navComputerOpen) return;
  _navComputer.render();
  _navAnimFrame = requestAnimationFrame(_navRenderLoop);
}

// Wire up nav computer close button + backdrop click/touch
{
  const navEl = document.getElementById('nav-computer-overlay');
  if (navEl) {
    const closeBtn = navEl.querySelector('.overlay-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', toggleNavComputer);
      closeBtn.addEventListener('touchend', (e) => { e.preventDefault(); e.stopPropagation(); toggleNavComputer(); });
    }
    navEl.addEventListener('click', (e) => {
      if (e.target === navEl) toggleNavComputer();
    });
    navEl.addEventListener('touchend', (e) => {
      if (e.target === navEl) { e.preventDefault(); toggleNavComputer(); }
    });
  }
}

// ── Settings Panel ──
let _settingsOpen = false;

function formatSettingValue(key, value) {
  if (key === 'idleTimeout' || key === 'titleAutoDismiss') return `${value}s`;
  if (key === 'deepSkyChance') return `${value}%`;
  if (key === 'tourLingerMultiplier') return `${value.toFixed(1)}x`;
  if (key === 'fov') return `${value}°`;
  if (key === 'autoRotateSpeed') return `${value.toFixed(1)}`;
  if (key === 'orbitSpeedMultiplier') return `${value.toFixed(2)}x`;
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
    case 'fov':
      camera.fov = value;
      camera.updateProjectionMatrix();
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

    // Close button (click + touch)
    const settingsClose = settingsEl.querySelector('.overlay-close');
    settingsClose?.addEventListener('click', () => { toggleSettings(); });
    settingsClose?.addEventListener('touchend', (e) => { e.preventDefault(); e.stopPropagation(); toggleSettings(); });

    // Tap backdrop to close
    settingsEl.addEventListener('click', (e) => {
      if (e.target === settingsEl) toggleSettings();
    });
    settingsEl.addEventListener('touchend', (e) => {
      if (e.target === settingsEl) { e.preventDefault(); toggleSettings(); }
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
    const keybindsClose = keybindsEl.querySelector('.overlay-close');
    keybindsClose?.addEventListener('click', () => { toggleKeybinds(); });
    keybindsClose?.addEventListener('touchend', (e) => { e.preventDefault(); e.stopPropagation(); toggleKeybinds(); });

    // Tap backdrop to close
    keybindsEl.addEventListener('click', (e) => {
      if (e.target === keybindsEl) toggleKeybinds();
    });
    keybindsEl.addEventListener('touchend', (e) => {
      if (e.target === keybindsEl) { e.preventDefault(); toggleKeybinds(); }
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
    const soundTestClose = soundTestEl.querySelector('.overlay-close');
    soundTestClose?.addEventListener('click', () => { toggleSoundTest(); });
    soundTestClose?.addEventListener('touchend', (e) => { e.preventDefault(); e.stopPropagation(); toggleSoundTest(); });
    soundTestEl.addEventListener('click', (e) => {
      if (e.target === soundTestEl) toggleSoundTest();
    });
    soundTestEl.addEventListener('touchend', (e) => {
      if (e.target === soundTestEl) { e.preventDefault(); toggleSoundTest(); }
    });
  }
}

// ── Pretext Lab (experimental text overlay — X key) ──
let _pretextLabOpen = false;
const _pretextLab = new PretextLab();

function togglePretextLab() {
  const el = document.getElementById('pretext-lab-overlay');
  if (!el) return;
  _pretextLabOpen = !_pretextLabOpen;
  soundEngine.play('uiClick');
  if (_pretextLabOpen) {
    el.style.display = 'flex';
    _pretextLab.activate();
  } else {
    el.style.display = 'none';
    _pretextLab.deactivate();
  }
}

// Pretext Lab close button + backdrop (click + touch)
{
  const labEl = document.getElementById('pretext-lab-overlay');
  if (labEl) {
    const labClose = labEl.querySelector('.overlay-close');
    labClose?.addEventListener('click', () => { togglePretextLab(); });
    labClose?.addEventListener('touchend', (e) => { e.preventDefault(); e.stopPropagation(); togglePretextLab(); });
    labEl.addEventListener('click', (e) => {
      if (e.target === labEl) togglePretextLab();
    });
    labEl.addEventListener('touchend', (e) => {
      if (e.target === labEl) { e.preventDefault(); togglePretextLab(); }
    });
  }
}

// ── Debug Gallery Mode ──
// Press D to enter/exit. ↑/↓ cycle types, ←/→ cycle seeds.
// Shows deep sky objects, stars, planets, and moons one at a time for evaluation.
const GALLERY_TYPES = [
  // Known object profiles (all 37 real Messier/NGC objects)
  'known-feature',
  // Deep sky (distant view)
  'spiral-galaxy', 'elliptical-galaxy',
  'emission-nebula', 'planetary-nebula',
  'globular-cluster',
  // Deep sky (navigable — fly inside)
  'volumetric-nebula-test',
  'nav-planetary-nebula', 'nav-emission-nebula',
  'nav-open-cluster',
  // Star system objects
  'star-flare',
  'planet-rocky', 'planet-terrestrial', 'planet-ocean', 'planet-ice',
  'planet-lava', 'planet-venus', 'planet-carbon', 'planet-eyeball',
  'planet-gas-giant', 'planet-hot-jupiter', 'planet-sub-neptune',
  'planet-hex', 'planet-shattered', 'planet-crystal', 'planet-fungal', 'planet-machine',
  'planet-city-lights', 'planet-ecumenopolis',
  'moon',
];

// Pre-built list of known object profile keys for gallery cycling
const _knownProfileKeys = Object.keys(KNOWN_OBJECT_PROFILES);

// Shared SkyFeatureLayer instance for gallery billboard creation
let _gallerySkyFeatureLayer = null;
let galleryMode = false;
let gallerySeed = 1;
let galleryTypeIdx = 0;
let _gallerySkipDir = 1;
let galleryObject = null;      // current Galaxy/Nebula instance (deep sky)
let _galleryMeshes = [];       // Star/Planet/Moon meshes (star system objects)
const _galleryOrigin = new THREE.Vector3(0, 0, 0); // parent position for gallery moons

// Pre-generate next system DATA at fold start (cheap CPU work, ~1-5ms).
// By the time we need to create GPU resources (hyper start), data is ready.
// Also clean up the old system here so GC pressure happens during FOLD
// (lots of visual activity to mask any hitch), not during ENTER.
warpEffect.onPrepareSystem = () => {
  // Heavy generation (StarSystemGenerator.generateAsync + skyRenderer
  // .prepareForPositionAsync) runs inside this IIFE. The promise is stored
  // on pendingSystemDataPromise; onSwapSystem awaits it before spawnSystem.
  // Sync setup (sound, music, seed counter) runs immediately before the
  // first await, so FOLD-start feedback is instantaneous.
  pendingSystemDataPromise = (async () => {
  bodyInfo.hide();
  soundEngine.play('warpCharge');
  musicManager.stop(0.5);

  // Keep system visible during FOLD — camera flies past objects.
  // _hideCurrentSystem() is called later when ENTER starts (see animation loop).

  seedCounter++;
  let seed = `system-${seedCounter}`;
  const rng = new SeededRandom(seed);
  // ── Route based on what was clicked ──
  // If the player clicked a tagged galactic feature, route to a star inside it.
  // Otherwise, use DestinationPicker (which may roll deep sky destinations).
  let destType;
  if (warpTarget.destType === 'external-galaxy' && warpTarget.galaxyData) {
    // Clicked an external galaxy — Category C: view from outside.
    // Use the existing galaxy generator to create a particle cloud.
    const gal = warpTarget.galaxyData;
    const galType = gal.type === 'spiral' ? 'spiral-galaxy' : 'elliptical-galaxy';
    pendingSystemData = GalaxyGenerator.generate(gal.seed, galType);
    pendingSystemData._destType = galType;
    pendingSystemData._warpTargetName = gal.name;
    pendingSystemData._isExternalGalaxy = true; // flag for "strayed from home" prompt
    // Don't update playerGalacticPos — we're not actually IN the other galaxy
    await skyRenderer.prepareForPositionAsync(playerGalacticPos);
    console.log(`Warp: external galaxy ${gal.name} (${galType})`);
    warpTarget.destType = null;
    warpTarget.galaxyData = null;
    return;
  }

  if (warpTarget.destType?.startsWith('feature:') && warpTarget.featureData && galacticMap) {
    // Clicked a galactic feature — generate a star system at its center.
    // Category A/B routing: player arrives INSIDE the feature, sky shows
    // immersive starfield (dense warm stars for clusters, gas for nebulae).
    //
    // IMPORTANT: Don't search for a nearby GalacticMap sector star —
    // features are much smaller than sectors (0.05 kpc vs 0.5 kpc), so
    // sector stars are almost always OUTSIDE the feature. Generate the
    // system directly from the feature's seed and position.
    const feat = warpTarget.featureData;
    playerGalacticPos = {
      x: feat.position.x,
      y: feat.position.y,
      z: feat.position.z,
    };
    const galaxyContext = galacticMap.deriveGalaxyContext(playerGalacticPos);
    // Apply feature context overrides (old metal-poor stars for globulars, etc.)
    if (feat.context) {
      if (feat.context.metallicity !== undefined) galaxyContext.metallicity = feat.context.metallicity;
      if (feat.context.age !== undefined) galaxyContext.age = feat.context.age;
    }
    pendingSystemData = await StarSystemGenerator.generateAsync(feat.seed, galaxyContext);
    pendingSystemData._destType = 'star-system';
    pendingSystemData._warpTargetName = warpTarget.name || null;
    pendingSystemData._insideFeature = feat;
    await skyRenderer.prepareForPositionAsync(playerGalacticPos);
    console.log(`Warp: routed to feature ${feat.type} → system at feature center (${playerGalacticPos.x.toFixed(4)}, ${playerGalacticPos.y.toFixed(4)}, ${playerGalacticPos.z.toFixed(4)})`);
    warpTarget.destType = null;
    warpTarget.featureData = null;
    return;
  }

  if (_forceNextDestType) {
    destType = _forceNextDestType;
  } else {
    const dsChance = settings.get('deepSkyChance') / 100;
    if (rng.float() >= dsChance) {
      destType = 'star-system';
    } else {
      destType = DestinationPicker.pickDeepSky(rng);
    }
  }
  _forceNextDestType = null; // clear after use

  // ── Category A/B deep sky: route to a star inside the feature ──
  // When DestinationPicker rolls a cluster/nebula/remnant and we have
  // a galaxy active, find a real galactic feature of that type and route
  // to a star inside it. The old particle-cloud generators are ONLY used
  // as fallback when no galaxy is active (legacy screensaver mode).
  const CATEGORY_AB_TYPES = [
    'emission-nebula', 'planetary-nebula', 'open-cluster',
    'globular-cluster', 'ob-association', 'supernova-remnant',
  ];
  // Map DestinationPicker names to GalacticMap feature type names
  const DEST_TO_FEATURE = {
    'emission-nebula': 'emission-nebula',
    'planetary-nebula': 'emission-nebula', // no separate type in GalacticMap
    'open-cluster': 'open-cluster',
    'globular-cluster': 'globular-cluster',
  };

  if (CATEGORY_AB_TYPES.includes(destType) && galacticMap) {
    // Try to find a real galactic feature of this type nearby
    const featureType = DEST_TO_FEATURE[destType] || destType;
    let foundFeature = null;
    for (const radius of [3.0, 6.0, 10.0]) {
      const features = galacticMap.findNearbyFeatures(playerGalacticPos, radius);
      foundFeature = features.find(f => f.type === featureType);
      if (foundFeature) break;
    }

    if (foundFeature) {
      // Route to feature center (same logic as click routing)
      playerGalacticPos = { ...foundFeature.position };
      const galaxyContext = galacticMap.deriveGalaxyContext(playerGalacticPos);
      if (foundFeature.context) {
        if (foundFeature.context.metallicity !== undefined) galaxyContext.metallicity = foundFeature.context.metallicity;
        if (foundFeature.context.age !== undefined) galaxyContext.age = foundFeature.context.age;
      }
      pendingSystemData = await StarSystemGenerator.generateAsync(foundFeature.seed, galaxyContext);
      pendingSystemData._destType = 'star-system';
      pendingSystemData._warpTargetName = warpTarget.name || null;
      pendingSystemData._insideFeature = foundFeature;
      await skyRenderer.prepareForPositionAsync(playerGalacticPos);
      console.log(`Warp: DestinationPicker rolled ${destType} → feature ${foundFeature.type} at center`);
      return;
    }
    // No feature found — fall back to star system (the procedural model's domain).
    // The old NavigableNebula/ClusterGenerators are legacy dead code that creates
    // fake tournable objects outside the procedural galaxy model. All warp
    // destinations must come from the hash grid or real feature catalog.
    console.log(`Warp: DestinationPicker rolled ${destType} but no feature found nearby, falling back to star-system`);
    destType = 'star-system';
  }

  if (destType === 'star-system') {
    // ── Galaxy-aware system generation ──
    // First, check if the clicked starfield point maps to a specific
    // GalacticMap star. If so, warp directly to THAT star — don't do
    // a second direction-based search that might find a different star.
    let galaxyContext = null;
    let resolvedStar = null;

    // Priority 1: Nav computer selected a specific star — use its exact position + seed
    if (warpTarget.navStarData) {
      resolvedStar = warpTarget.navStarData;
      console.log(`[WARP] Priority 1 (navStarData): Y=${resolvedStar.worldY?.toFixed(4)}, seed=${resolvedStar.seed}`);
    }

    // Priority 2: Sky starfield click — resolve via index
    if (!resolvedStar && galacticMap && warpTarget.starIndex >= 0) {
      const entry = skyRenderer.getEntryForIndex(warpTarget.starIndex);
      if (entry?.starData && entry.starData.worldX !== undefined) {
        resolvedStar = entry.starData;
      }
    }

    // No direction-based fallback needed: every sky star has a starIndex
    // (Priority 2) and every nav star has navStarData (Priority 1).
    // The old direction-based search was a legacy holdover from when the
    // sky had fake fill stars. With the hash grid, every point of light
    // is a real star with exact coordinates.
    if (!resolvedStar) {
      console.warn('[WARP] No star resolved — neither navStarData nor starIndex matched. This should not happen.');
    }

    if (resolvedStar) {
      playerGalacticPos = { x: resolvedStar.worldX, y: resolvedStar.worldY, z: resolvedStar.worldZ };
      currentGalaxyStar = resolvedStar;
      galaxyContext = galacticMap.deriveGalaxyContext(playerGalacticPos);
      // Hash grid already determined this star's type — pass it through
      // so StarSystemGenerator uses it instead of re-rolling from weights
      if (resolvedStar.type) {
        galaxyContext.starTypeOverride = resolvedStar.type;
      }
      // Use the resolved star's seed for deterministic system generation
      seed = String(resolvedStar.seed);
      console.log(`[WARP] Resolved to: (${playerGalacticPos.x.toFixed(4)}, ${playerGalacticPos.y.toFixed(4)}, ${playerGalacticPos.z.toFixed(4)}) seed=${resolvedStar.seed}`);
    }

    // Check for known system override at this position —
    // but skip if the user explicitly picked a different star from the nav computer
    const hasNavStar = !!warpTarget.navStarData;
    const knownWarp = hasNavStar ? null : KnownSystems.findAt(playerGalacticPos);
    console.log(`[WARP] knownSystem check: hasNavStar=${hasNavStar}, knownWarp=${knownWarp?.name || 'none'}`);
    if (knownWarp) {
      pendingSystemData = knownWarp.generate();
      pendingSystemData._knownSystemNames = knownWarp.names;
      pendingSystemData._warpTargetName = knownWarp.name;
      console.log(`[WARP] Known system override: ${knownWarp.name}`);
    } else {
      pendingSystemData = await StarSystemGenerator.generateAsync(seed, galaxyContext);
    }
  } else if (destType.includes('galaxy')) {
    // External galaxy Easter egg — player warped to a distant galaxy visible in the sky.
    // These are definitionally outside the Milky Way model, so GalaxyGenerator is correct.
    // TODO: show "you've gone too far" message on arrival
    pendingSystemData = GalaxyGenerator.generate(seed, destType);
  } else {
    // Any other destType that wasn't caught above — should not happen in production.
    // Fall back to a star system at the current position rather than using legacy generators.
    console.warn(`[WARP] Unexpected destType '${destType}', falling back to star-system`);
    pendingSystemData = await StarSystemGenerator.generateAsync(seed);
  }
  pendingSystemData._destType = destType;
  // Carry the warp target's name into the new system so it matches what was shown
  pendingSystemData._warpTargetName = warpTarget.name || null;
  // Pre-generate sky data for new galactic position (async — HashGrid search yields between spectral types)
  await skyRenderer.prepareForPositionAsync(playerGalacticPos);
  const _sfCount = skyRenderer._pendingData?.count ?? 'NO DATA';
  console.log(`Warp: pre-generated "${destType}" (seed "${seed}") during fold | pos=(${playerGalacticPos.x.toFixed(3)},${playerGalacticPos.y.toFixed(3)},${playerGalacticPos.z.toFixed(3)}) | starfield=${_sfCount} stars`);
  })();  // end async IIFE — promise stored on pendingSystemDataPromise
};

// System swap at hyper start (tunnel is opaque, hides any GPU resource creation)
warpEffect.onSwapSystem = async () => {
  // Await in-flight async generation kicked off in onPrepareSystem. In the
  // common case, FOLD+ENTER (~6s) have already absorbed generation's ~4s
  // wall-clock work and the promise is resolved — await returns immediately.
  // If generation ran long, HYPER waits a tick before spawning rather than
  // spawning with null data. onPrepareSystem guarantees this promise is set
  // before HYPER begins (WarpEffect's state machine enforces the ordering).
  if (pendingSystemDataPromise) {
    try { await pendingSystemDataPromise; }
    catch (e) { console.error('[WARP] onPrepareSystem failed:', e); }
  }
  if (!_portalLabMode) {
    soundEngine.play('warpEnter');
    musicManager.play('hyperspace', 0.3);
  }
  warpSwapSystem();

  // ── Regenerate sky for new galactic position ──
  // Dual-portal: the mesh tunnel visually hides the transition, so we
  // synchronously dispose the old sky layers and build the new ones via
  // activate(). No dual-layer crossover — destination stars render
  // un-clipped as soon as the camera exits Portal B and sees the sky.
  //
  // Legacy path: beginWarpTransition keeps the old layers alive alongside
  // new ones so the crossover sweep (in the warp update block) can fade
  // origin → destination while the player is inside the fullscreen shader
  // tunnel. Not needed here.
  if (_useDualPortal) {
    skyRenderer.activate();
  } else {
    skyRenderer.beginWarpTransition();
  }
  skyRenderer.update(camera, 0);
  // Restore galaxy glow (hidden during title screen)
  if (skyRenderer._glowLayer?.mesh) {
    skyRenderer._glowLayer.mesh._hiddenForTitle = false;
    skyRenderer._glowLayer.mesh.visible = true;
  }
};

// When warp exit finishes, reveal the new system and restart autopilot
warpEffect.onComplete = () => {
  skyRenderer.completeWarpTransition();

  // Capture arrival direction so the per-frame Portal B follow below can
  // keep Portal B in a FIXED world-space direction behind the ship. Without
  // this, warpRevealSystem's post-warp tour flies the camera far from
  // wherever Portal B was anchored — player can never find it. Using the
  // camera's current view direction (instead of a captured direction)
  // would move Portal B with every look-around, which is the original bug.
  camera.getWorldDirection(_arrivalForward);
  warpPortal.setTraversalMode('OUTSIDE_B');

  if (_portalLabMode) {
    // Diagnostic mode: start a smooth slerp from camera's current forward
    // orientation (looking away from Portal B) to facing Portal B. The
    // cameraController stays bypassed during the slerp — otherwise its
    // orbit update's camera.lookAt(target) would snap the rotation in one
    // frame (that's the "freeze then suddenly different direction" pop).
    // Orbit handoff happens in the animation loop once the slerp completes.
    warpPortal._discB.updateMatrixWorld();
    _labArrivalTarget.setFromMatrixPosition(warpPortal._discB.matrixWorld);
    _labArrivalLookMatrix.lookAt(camera.position, _labArrivalTarget, camera.up);
    _labArrivalTargetQuat.setFromRotationMatrix(_labArrivalLookMatrix);
    _labArrivalStartQuat.copy(camera.quaternion);
    _labArrivalElapsed = 0;
    _labArriving = true;
    _portalLabState = 'idle';  // ready for a new Space #1 preview next warp
    return;
  }

  soundEngine.play('warpExit');
  // System music is handled by _scheduleSystemMusic in warpRevealSystem
  // (periodic one-shots with gaps, not looping BGM)
  warpRevealSystem();
};

// ── Click-to-select (raycasting) ──
const raycaster = new THREE.Raycaster();
const _mouse = new THREE.Vector2();
let _orbitLineTargets = new Map(); // orbit line mesh → { type, planetIndex, moonIndex?, center, radius }
let _hoveredOrbitLine = null;      // currently hovered orbit line mesh
let _lastOrbitHoverTime = 0;       // throttle timer for hover check
const _mouseDown = { x: 0, y: 0 };
let _autopilotClickPending = false; // deferred autopilot exit — see mousedown/mouseup
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

/**
 * Build a target descriptor for a star/planet/moon in the current system.
 * Returns the same shape the TargetingReticle expects, with everything
 * needed for display + selection dispatch.
 */
function _makeTarget(kind, indices) {
  if (!system) return null;
  if (kind === 'star') {
    const starIdx = indices.starIndex || 0;
    const starObj = starIdx === 1 && system.star2 ? system.star2 : system.star;
    if (!starObj) return null;
    const name = system.names
      ? (starIdx === 1 ? system.names.star2 : system.names.star)
      : null;
    return {
      kind: 'star',
      starIndex: starIdx,
      mesh: starObj.mesh,
      radius: starObj.data.radius,
      name: name || 'Star',
      type: `${starObj.data.type || 'G'}-class Star`,
    };
  }
  if (kind === 'planet') {
    const pIdx = indices.planetIndex;
    const entry = system.planets?.[pIdx];
    if (!entry) return null;
    return {
      kind: 'planet',
      planetIndex: pIdx,
      mesh: entry.planet.mesh,
      radius: entry.planet.data.radius,
      name: system.names?.planets?.[pIdx]?.name || `Planet ${pIdx + 1}`,
      type: entry.planet.data.type || 'planet',
    };
  }
  if (kind === 'moon') {
    const pIdx = indices.planetIndex;
    const mIdx = indices.moonIndex;
    const entry = system.planets?.[pIdx];
    const moon = entry?.moons?.[mIdx];
    if (!moon) return null;
    return {
      kind: 'moon',
      planetIndex: pIdx,
      moonIndex: mIdx,
      mesh: moon.mesh,
      radius: moon.data.radius,
      name: system.names?.planets?.[pIdx]?.moons?.[mIdx] || `Moon ${mIdx + 1}`,
      type: moon.data.type || 'moon',
    };
  }
  return null;
}

/**
 * Forgiving screen-space hit test for in-system bodies. Projects every
 * selectable body (stars, planets, moons) and picks the one whose screen
 * center is closest to the mouse, provided it's within an adaptive
 * threshold based on the body's projected screen radius.
 *
 * Unlike the raycaster path, this uses screen distance (not pixel-perfect
 * geometry intersection) so billboarded tiny planets / distant moons are
 * still clickable. The threshold grows with near-field bodies so huge
 * foreground planets can still be clicked at their edges.
 *
 * In-system bodies take priority over the starfield because this function
 * is called before `trySelectWarpTarget` in the click pipeline.
 *
 * @param {number} minThresholdPx — minimum click radius in CSS pixels (default 24)
 */
function hitTestBodies(clientX, clientY, minThresholdPx = 24) {
  if (!system) return null;
  camera.updateMatrixWorld(true);

  const rect = canvas.getBoundingClientRect();
  const hw = rect.width * 0.5;
  const hh = rect.height * 0.5;
  const localX = clientX - rect.left;
  const localY = clientY - rect.top;

  // Precompute FOV scalar for projected radius calculation
  const fovRad = (camera.fov * Math.PI) / 180;
  const halfHeight = rect.height * 0.5;

  let best = null;
  let bestDistSq = Infinity;

  // Tie-breaking: when two bodies project to nearly the same screen pixel
  // (within 3 px), prefer the larger object (star > planet > moon). This
  // stops a moon from "winning" a click when it's visually overlapping
  // its parent planet at the same point — without affecting the case
  // where the moon is visibly offset from the planet, in which case the
  // closest-to-mouse rule still applies.
  const TIE_PIXELS_SQ = 9; // 3 px tolerance
  const kindRank = (k) => (k === 'star' ? 3 : k === 'planet' ? 2 : 1);

  const tryBody = (target) => {
    if (!target || !target.mesh) return;
    // Project center to screen
    _projVec.copy(target.mesh.position).project(camera);
    if (_projVec.z > 1 || _projVec.z < -1) return; // behind camera or past far plane
    const sx = (_projVec.x * hw) + hw;
    const sy = (-_projVec.y * hh) + hh;

    // Adaptive threshold: body's projected pixel radius + 12px margin,
    // clamped to at least `minThresholdPx`.
    const dist = camera.position.distanceTo(target.mesh.position);
    let pixelRadius = 0;
    if (dist > 1e-6 && target.radius > 0) {
      const angularRadius = Math.atan(target.radius / dist);
      pixelRadius = (angularRadius / (fovRad * 0.5)) * halfHeight;
    }
    const threshold = Math.max(minThresholdPx, pixelRadius + 12);

    const dx = localX - sx;
    const dy = localY - sy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= threshold * threshold) return;

    if (best === null || d2 < bestDistSq - TIE_PIXELS_SQ) {
      // Clearly closer to the mouse than the current best.
      bestDistSq = d2;
      best = target;
    } else if (d2 <= bestDistSq + TIE_PIXELS_SQ) {
      // Effectively a tie — prefer the larger kind (star > planet > moon).
      if (kindRank(target.kind) > kindRank(best.kind)) {
        bestDistSq = d2;
        best = target;
      }
    }
  };

  // Primary star
  tryBody(_makeTarget('star', { starIndex: 0 }));
  // Binary companion
  if (system.star2) tryBody(_makeTarget('star', { starIndex: 1 }));
  // Planets
  if (system.planets) {
    for (let i = 0; i < system.planets.length; i++) {
      tryBody(_makeTarget('planet', { planetIndex: i }));
      const entry = system.planets[i];
      if (entry.moons) {
        for (let m = 0; m < entry.moons.length; m++) {
          tryBody(_makeTarget('moon', { planetIndex: i, moonIndex: m }));
        }
      }
    }
  }
  return best;
}

// ── Title screen: nebula backdrop with varied sparse starfield ──
// Spawn a nebula as the visual feature, but position the sky renderer
// in a random sparse inter-arm gap so the background starfield varies
// each time and doesn't overwhelm the nebula.
{
  const titleRng = new SeededRandom(`title-${Date.now()}`);

  // Position sky in a sparse inter-arm location (varied each load)
  const interArmAngles = [Math.PI * 0.5, Math.PI * 1.5, Math.PI * 0.25, Math.PI * 1.25];
  const theta = interArmAngles[titleRng.int(0, interArmAngles.length - 1)];
  const R = 5.5 + titleRng.float() * 3.0;
  const yOffset = 0.4 + titleRng.float() * 0.6;
  const titlePos = { x: R * Math.cos(theta), y: yOffset, z: R * Math.sin(theta) };
  skyRenderer.prepareForPosition(titlePos);
  // Hide galaxy glow on title screen — it detracts from the nebula
  // Hide galaxy glow — set flag so RetroRenderer's 2-pass loop respects it
  if (skyRenderer._glowLayer?.mesh) {
    skyRenderer._glowLayer.mesh.visible = false;
    skyRenderer._glowLayer.mesh._hiddenForTitle = true;
  }

  // Spawn the nebula
  const deepSkyTypes = ['emission-nebula', 'planetary-nebula'];
  const titleType = deepSkyTypes[titleRng.int(0, deepSkyTypes.length - 1)];
  const titleData = NebulaGenerator.generate(`title-${Date.now()}`, titleType);
  titleData._destType = `title-${titleType}`;
  // Use master-style simple nebula rendering
  for (const layer of titleData.layers || []) {
    layer.domainWarpStrength = 3.5;
    layer.darkLaneStrength = 0;
    layer.asymmetry = 0;
    layer.brightnessShape = 0;
  }
  spawnSystem({ systemData: titleData });

  const r = titleData.radius || 200;
  const orbitCenter = new THREE.Vector3(0, 0, 0);
  camera.position.set(0, 0, r * 1.25);
  camera.lookAt(orbitCenter);
  cameraController.restoreFromWorldState(orbitCenter);
  cameraController.autoRotateSpeed = 3.0;

  // Auto-dismiss timer is now started by startIntroSequence() when the title actually appears.

  // Mobile fullscreen button on title screen — only goes fullscreen, no dismiss
  const fsBtn = document.getElementById('title-fullscreen-btn');
  if (fsBtn) {
    fsBtn.addEventListener('touchstart', (e) => {
      e.stopPropagation();
    }, { passive: false });
    fsBtn.addEventListener('touchend', (e) => {
      e.preventDefault();
      e.stopPropagation();
      document.documentElement.requestFullscreen().catch(() => {});
    });
    fsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      document.documentElement.requestFullscreen().catch(() => {});
    });
  }
}

/**
 * Hide the current system from the scene during warp FOLD.
 * Only removes meshes from the scene (fast, no GC pressure).
 * Full disposal happens later in spawnSystem().
 * The scene fade in WarpEffect handles visual hiding, but removing
 * from the Three.js scene stops the renderer from processing them.
 */
function _hideCurrentSystem() {
  if (!system) return;

  if (system.type && system.type !== 'star-system') {
    if (system.destination) system.destination.removeFrom(scene);
    if (system.gasCloud) system.gasCloud.removeFrom(scene);
    if (system._deepSkyGas) system._deepSkyGas.removeFrom(scene);
    if (system._deepSkyStars) {
      for (const s of system._deepSkyStars) scene.remove(s.mesh);
    }
    if (system.star) scene.remove(system.star.mesh);
    if (system.extraStars) {
      for (const s of system.extraStars) scene.remove(s.mesh);
    }
    if (system._dummyRefs) {
      for (const obj of system._dummyRefs) scene.remove(obj);
    }
  } else {
    scene.remove(system.star.mesh);
    if (system.star2) scene.remove(system.star2.mesh);
    for (const entry of system.planets) {
      scene.remove(entry.planet.mesh);
      entry.billboard.removeFrom(scene);
      entry.planetBillboard.removeFrom(scene);
      for (let m = 0; m < entry.moons.length; m++) {
        scene.remove(entry.moons[m].mesh);
        if (entry.moons[m]._clickProxy) scene.remove(entry.moons[m]._clickProxy);
        entry.moonBillboards[m].removeFrom(scene);
        if (entry.moons[m]._planetBillboard) entry.moons[m]._planetBillboard.removeFrom(scene);
      }
      for (const line of entry.moonOrbitLines) scene.remove(line.mesh);
    }
    for (const line of system.orbitLines) scene.remove(line.mesh);
    for (const belt of system.asteroidBelts) belt.removeFrom(scene);
    if (system.starOrbitLines) {
      for (const line of system.starOrbitLines) scene.remove(line.mesh);
    }
  }
  // Hide ships (they'll be disposed in spawnSystem cleanup)
  for (const ship of shipSpawner.ships) {
    scene.remove(ship.mesh);
  }
  // Hide HUD (don't dispose yet — that happens in spawnSystem during HYPER)
  retroRenderer.setHud(null, null);
  clickTargets = new Map();
}

/**
 * Generate and display a full star system (single or binary).
 * @param {Object} options
 * @param {boolean} options.forWarp  — if true, skip camera setup + flythrough start (warp handles that)
 * @param {Object} options.systemData — pre-generated data from StarSystemGenerator (skips re-generation)
 */
function spawnSystem({ forWarp = false, systemData: preGenData = null, debugCamera = false } = {}) {
  // ── Reset state ──
  warpTarget.direction = null;
  warpTarget.name = null;
  warpTarget.starIndex = -1;
  warpTarget.navStarData = null;
  warpTarget.destType = null;
  warpTarget.featureData = null;
  warpTarget.galaxyData = null;
  const wasAutopilot = debugCamera ? false : autoNav.isActive;

  // Reset camera far plane (may have been extended for navigable nebulae)
  if (camera.far > 200000) {
    camera.far = 200000;
    camera.updateProjectionMatrix();
  }
  if (!forWarp) {
    stopFlythrough();
  }
  idleTimer = 0;

  // ── Clean up ships from previous system ──
  shipSpawner.clear(scene);

  // ── Clean up old system ──
  // Meshes were already removed from scene during FOLD (_hideCurrentSystem),
  // but we still need to dispose GPU resources (textures, geometries, materials).
  // Safety net: ensure meshes are removed from scene. Usually done at FOLD→ENTER
  // transition, but can be missed if a frame skips states (e.g., tab backgrounded).
  lodManager.clear();
  _hideCurrentSystem();
  if (systemMap) {
    systemMap.dispose();
    systemMap = null;
  }
  if (system) {
    if (system.type && system.type !== 'star-system') {
      if (system.destination) system.destination.dispose();
      if (system.gasCloud) system.gasCloud.dispose();
      if (system._deepSkyGas) system._deepSkyGas.dispose();
      if (system._deepSkyStars) {
        for (const s of system._deepSkyStars) s.dispose();
      }
      if (system.star) system.star.dispose();
      if (system.extraStars) {
        for (const s of system.extraStars) s.dispose();
      }
    } else {
      system.star.dispose();
      if (system.star2) system.star2.dispose();
      for (const entry of system.planets) {
        entry.planet.dispose();
        entry.billboard.dispose();
        entry.planetBillboard.removeFrom(scene);
        entry.planetBillboard.dispose();
        for (let m = 0; m < entry.moons.length; m++) {
          entry.moons[m].dispose();
          if (entry.moons[m]._clickProxy) {
            entry.moons[m]._clickProxy.geometry.dispose();
            entry.moons[m]._clickProxy.material.dispose();
          }
          entry.moonBillboards[m].dispose();
          if (entry.moons[m]._planetBillboard) {
            entry.moons[m]._planetBillboard.removeFrom(scene);
            entry.moons[m]._planetBillboard.dispose();
          }
        }
        for (const line of entry.moonOrbitLines) line.dispose();
      }
      for (const line of system.orbitLines) line.dispose();
      for (const belt of system.asteroidBelts) belt.dispose();
      if (system.starOrbitLines) {
        for (const line of system.starOrbitLines) line.dispose();
      }
    }
  }
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
    // No gravity system for deep sky — fall back to orbit mode
    cameraController.clearGravity();
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

  // ── Generate names for star system ──
  // Known systems use pre-defined real names. Otherwise generate from seed.
  let systemNames = null;
  if (systemData._knownSystemNames) {
    systemNames = systemData._knownSystemNames;
  } else if (!systemData._navigable) {
    const nameRng = new SeededRandom(seed);
    systemNames = generateSystemNames(nameRng, systemData, systemData._warpTargetName || null);
  }

  // ── Create star(s) ──
  // Scene-unit star data: override radius with radiusScene for 3D rendering
  const sceneStarData = { ...systemData.star, radius: systemData.star.radiusScene };
  // Always use StarFlare for the primary system star(s) — gives the full
  // diffraction spike effect that matches the desired visual look.
  const star = new StarFlare(sceneStarData);
  star.addTo(scene);

  let star2 = null;
  const starOrbitLines = [];

  if (systemData.isBinary) {
    const sceneStarData2 = { ...systemData.star2, radius: systemData.star2.radiusScene };
    console.log(`[BINARY] star2: radius=${sceneStarData2.radius?.toFixed(2)}, type=${sceneStarData2.type}, color=[${sceneStarData2.color}], sep=${systemData.binarySeparationScene?.toFixed(2)}`);
    star2 = new StarFlare(sceneStarData2);
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
    // Physics data for the BodyRenderer (composition, atmosphere, tidal, surface history)
    const planetPhysics = {
      composition: entry.planetData.composition || null,
      atmosphere: entry.planetData.atmosphereRetained !== undefined
        ? { retained: entry.planetData.atmosphereRetained }
        : null,
      tidalState: entry.planetData.tidalState || null,
      surfaceHistory: entry.planetData.surfaceHistory || null,
    };
    const planet = BodyRenderer.createPlanet(scenePlanetData, planetPhysics, systemData.starInfo);
    const px = Math.cos(entry.orbitAngle) * entry.orbitRadiusScene;
    const pz = Math.sin(entry.orbitAngle) * entry.orbitRadiusScene;
    planet.mesh.position.set(px, 0, pz);
    planet.addTo(scene);
    lodManager.register(planet);

    // Billboard indicator (shown when planet is sub-pixel at render resolution)
    const billboard = new Billboard(billboardColor(scenePlanetData.baseColor));
    billboard.addTo(scene);

    // Shader billboard dot (Space Engine-style — visible at medium distance)
    const planetBillboard = new PlanetBillboard(
      billboardColor(scenePlanetData.baseColor),
      scenePlanetData.radius
    );
    planetBillboard.addTo(scene);

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
        moon = BodyRenderer.createMoon(
          moonData, null, systemData.starInfo,
          { lightDir: planet._lightDir, lightDir2: planet._lightDir2 }
        );
        lodManager.register(moon);
      }
      moon.addTo(scene);
      moons.push(moon);

      // Moon billboard (shown when moon is sub-pixel) — 2 render pixels (6 screen px)
      // Larger than background stars (1px) so moons stand out during approach
      const moonBb = new Billboard(billboardColor(moonData.baseColor), 2);
      moonBb.addTo(scene);
      moonBillboards.push(moonBb);

      // Shader billboard dot for moons (same system as planet billboards)
      const moonPb = new PlanetBillboard(
        billboardColor(moonData.baseColor),
        moonData.radiusScene
      );
      moonPb.addTo(scene);
      moon._planetBillboard = moonPb;

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
      planetBillboard,
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
    names: systemNames, // generated names for system/star/planets/moons
    _systemData: systemData, // raw generation data for nav computer
  };

  // ── Spawn flavor ships near planets ──
  {
    const shipRng = new SeededRandom(`${seed}-ships`);
    shipSpawner.spawnForSystem(scene, systemData, planets, () => shipRng.float());
  }

  // ── Initialize gravity-driven camera system ──
  // Build body mesh references for GravityField
  {
    const bodyMeshes = {
      star: star.mesh,
      star2: star2 ? star2.mesh : undefined,
      planets: planets.map(e => e.planet.mesh),
      moons: planets.map(e => e.moons.map(m => m.mesh)),
    };
    cameraController.initGravity(systemData, bodyMeshes);
  }

  // ── Debug panel update ──
  debugPanel.setSystem(system, systemData);
  debugPanel.setPlayerPos(playerGalacticPos);
  debugPanel.setLODManager(lodManager);

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
  _currentSystemName = systemNames ? systemNames.system : seed;
  const sysLabel = systemNames ? `"${systemNames.system}"` : `"${seed}"`;
  console.log(`System ${sysLabel} (seed: ${seed}) — ${starDesc}, ${systemData.planets.length} planets${beltDesc}`);

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
  if (!debugCamera) {
    // Normal mode: set up hero shot camera
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
        const viewDist = Math.max(moon.data.radius * 5, 0.08);
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
  } else {
    // Debug camera mode: orbit the star, no autopilot, camera set by caller
    focusIndex = -1;
    focusMoonIndex = -1;
    cameraController.setTarget(new THREE.Vector3(0, 0, 0));
    const viewDist = star.data.radius * 8;
    cameraController.distance = viewDist;
    cameraController.smoothedDistance = viewDist;
    cameraController.autoRotateActive = false;
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

  // Open clusters with gas layers: add Nebula cloud overlay
  let _deepSkyGas = null;
  if (data.gasLayers && data.gasLayers.length > 0) {
    const gasData = {
      layers: data.gasLayers,
      starPositions: new Float32Array(0),
      starColors: new Float32Array(0),
      starSizes: new Float32Array(0),
    };
    _deepSkyGas = new Nebula(gasData);
    _deepSkyGas.addTo(scene);
  }

  // Open clusters with navigable star data: overlay StarFlare objects
  const _deepSkyStars = [];
  if (data._navStars) {
    const navData = data._navStars;
    const scaleFactor = data.radius / navData.radius;
    for (const sData of navData.stars) {
      const scaledR = Math.max(data.radius * 0.02, 2.0);
      const star = new StarFlare({ ...sData, radius: scaledR, color: sData.color }, scaledR);
      star.mesh.position.set(
        sData.position[0] * scaleFactor,
        sData.position[1] * scaleFactor,
        sData.position[2] * scaleFactor,
      );
      star.addTo(scene);
      _deepSkyStars.push(star);
    }
  }

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
    _deepSkyGas,
    _deepSkyStars,
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

  // ── Cluster gas layers (open clusters — reflection nebulosity) ──
  if (!gasCloud && data.gasLayers && data.gasLayers.length > 0) {
    const gasData = {
      layers: data.gasLayers,
      starPositions: new Float32Array(0),
      starColors: new Float32Array(0),
      starSizes: new Float32Array(0),
    };
    gasCloud = new Nebula(gasData);
    gasCloud.addTo(scene);
  }

  // ── Cluster particle cloud (open clusters — adds ambient star particles) ──
  let clusterCloud = null;
  if (data._clusterParticles) {
    const cp = data._clusterParticles;
    // Scale particle positions to match navigable radius
    const scale = data.radius / cp.radius;
    const scaledPositions = new Float32Array(cp.positions.length);
    for (let i = 0; i < cp.particleCount; i++) {
      scaledPositions[i * 3]     = cp.positions[i * 3] * scale;
      scaledPositions[i * 3 + 1] = cp.positions[i * 3 + 1] * scale;
      scaledPositions[i * 3 + 2] = cp.positions[i * 3 + 2] * scale;
    }
    const scaledSizes = new Float32Array(cp.sizes.length);
    for (let i = 0; i < cp.particleCount; i++) {
      scaledSizes[i] = cp.sizes[i] * scale;
    }
    const scaledData = { ...cp, positions: scaledPositions, sizes: scaledSizes, radius: data.radius };
    clusterCloud = new Galaxy(scaledData);
    clusterCloud.addTo(scene);
  }

  // ── Extend far plane for large navigable destinations ──
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
  const minVisibleFrac = isCluster ? 0.006 : 0.0003;

  for (const sData of data.stars) {
    const minVisible = data.radius * minVisibleFrac;
    const renderR = Math.max(sData.renderRadius || sData.radiusScene, minVisible);
    // Cluster stars: brighten colors toward white so they pop against black sky.
    // Raw B/A star colors (0.67, 0.75, 1.0) look dim as flat discs.
    let color = sData.color;
    if (isCluster) {
      color = color.map(c => Math.min(1.0, c * 1.3 + 0.15));
    }
    const starObj = new StarFlare({ ...sData, radius: renderR, color }, renderR);
    starObj.mesh.position.set(sData.position[0], sData.position[1], sData.position[2]);
    starObj.addTo(scene);
    allStars.push(starObj);
  }

  // ── Click targets (all stars are clickable) ──
  clickTargets = new Map();
  for (let i = 0; i < allStars.length; i++) {
    clickTargets.set(allStars[i].surface, {
      type: 'star',
      starIndex: i,
      label: `Star ${i + 1} (${data.stars[i].type})`,
    });
  }

  // ── Build system object ──
  // Shaped like a star system so autopilot/flythrough/selection code works
  system = {
    type: destType,
    destination: clusterCloud,  // Galaxy particle cloud (open clusters) or null
    gasCloud,              // Nebula billboard instance (nebulae) or null
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

  // Non-warp opening: position camera to see the structure
  if (allStars[0]) {
    // Clusters: pull back to see the whole cluster (like the gallery view).
    // Nebulae: closer, since the gas cloud provides visual context.
    if (isCluster) {
      // Orbit the cluster center, not a single star
      const viewDist = data.radius * 0.6;
      camera.position.set(0, viewDist * 0.3, viewDist);
      camera.lookAt(0, 0, 0);
      cameraController.restoreFromWorldState(new THREE.Vector3(0, 0, 0));
    } else {
      // Nebulae: start well outside so you see the whole structure
      const viewDist = data.radius * 0.9;
      camera.position.set(0, viewDist * 0.2, viewDist);
      camera.lookAt(0, 0, 0);
      cameraController.restoreFromWorldState(new THREE.Vector3(0, 0, 0));
    }
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
    preGenData._clusterParticles = ClusterGenerator.generate(seed, 'open-cluster');
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

// ── Debug Panel spawn callbacks ──────────────────────────────────
// Wire up the debug panel's interactive buttons to game functions.
debugPanel.setSpawnCallbacks({
  teleportToPosition: (pos, name) => {
    if (!galacticMap) return;
    if (galleryMode) exitGallery();
    playerGalacticPos = { ...pos };
    console.log(`Teleporting to ${name}...`);

    // Break into async steps so the browser doesn't freeze.
    // Step 1: galaxy context + sky prep (fast)
    const ctx = galacticMap.deriveGalaxyContext(playerGalacticPos);

    // Update glow position immediately (instant visual feedback)
    if (skyRenderer._glowLayer?.setPlayerPosition) {
      skyRenderer._glowLayer.setPlayerPosition(playerGalacticPos);
    }

    // Step 2: starfield generation (slow ~2s) — deferred
    setTimeout(() => {
      skyRenderer.prepareForPosition(playerGalacticPos);
      skyRenderer.activate();
      skyRenderer.update(camera, 0);

      // Step 3: system generation — deferred again
      setTimeout(() => {
        const nearest = HashGridStarfield.findStarsInRadius(galacticMap, playerGalacticPos, 0.01, 1);
        const starSeed = nearest.length > 0 ? String(nearest[0].seed) : 'debug-teleport';
        const knownSys = KnownSystems.findAt(playerGalacticPos);
        let sysData;
        if (knownSys) {
          sysData = knownSys.generate();
          sysData._knownSystemNames = knownSys.names;
        } else {
          sysData = StarSystemGenerator.generate(starSeed, ctx);
        }
        sysData._destType = 'star-system';
        spawnSystem({ forWarp: false, systemData: sysData });
        debugPanel.setPlayerPos(playerGalacticPos);

        // Apply pending highlight marker (set by debug panel search)
        if (debugPanel._pendingHighlight) {
          if (window._glowLayer) {
            window._glowLayer.setTargetMarker(debugPanel._pendingHighlight);
          }
          debugPanel._pendingHighlight = null;
        }

        const armInfo = ctx.armInfo;
        console.log(`Debug teleport: ${name} → (${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)}) | arm=${ctx.spiralArmStrength.toFixed(2)} | nearestArm=${armInfo ? armInfo.armName : 'unknown'}${armInfo && armInfo.isMajor ? ' (MAJOR)' : ''}`);
      }, 50);
    }, 50);
  },
  spawnSystemType: (destType) => {
    _debugSpawnType(destType);
  },
  spawnWithSeed: (seed) => {
    if (galleryMode) exitGallery();
    const sysData = StarSystemGenerator.generate(seed);
    sysData._destType = 'star-system';
    spawnSystem({ forWarp: false, systemData: sysData });
    console.log(`Debug spawn with seed: "${seed}"`);
  },
  findNearest: (targetType) => {
    if (!galacticMap) return { found: false, message: 'No galaxy active' };
    if (galleryMode) exitGallery();

    // ── Galactic feature search (feat: prefix) ──
    if (targetType.startsWith('feat:')) {
      const featureType = targetType.slice(5); // remove 'feat:' prefix
      // Search with increasing radius until we find one
      for (const radius of [3.0, 6.0, 10.0]) {
        const features = galacticMap.findNearbyFeatures(playerGalacticPos, radius);
        const match = features.find(f => f.type === featureType);
        if (match) {
          // Position outside the feature at viewing distance.
          // Player can then click the feature in the sky to warp inside it.
          const viewDist = Math.max(match.radius * 2.0, 0.01);
          const dx = match.position.x - playerGalacticPos.x;
          const dy = match.position.y - playerGalacticPos.y;
          const dz = match.position.z - playerGalacticPos.z;
          const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
          const newPos = {
            x: match.position.x - (dx / len) * viewDist,
            y: match.position.y - (dy / len) * viewDist,
            z: match.position.z - (dz / len) * viewDist,
          };
          playerGalacticPos = newPos;
          skyRenderer.prepareForPosition(playerGalacticPos);
          skyRenderer.activate();
          skyRenderer.update(camera, 0);
          // Generate a system at this position
          const ctx = galacticMap.deriveGalaxyContext(playerGalacticPos);
          const nearest = HashGridStarfield.findStarsInRadius(galacticMap, playerGalacticPos, 0.01, 1);
          const starSeed = nearest.length > 0 ? String(nearest[0].seed) : 'feat-debug';
          const sysData = StarSystemGenerator.generate(starSeed, ctx);
          sysData._destType = 'star-system';
          spawnSystem({ forWarp: false, systemData: sysData });
          debugPanel.setPlayerPos(playerGalacticPos);
          debugPanel.setSystem(system, sysData);

          const msg = `Found ${featureType} at ${match.distance.toFixed(3)} kpc (r=${match.radius.toFixed(3)} kpc), viewing from ${viewDist.toFixed(3)} kpc away`;
          console.log(`Debug find: ${msg}`);
          return { found: true, message: msg };
        }
      }
      return { found: false, message: `No ${featureType} found within 10 kpc. Try a different galactic position (arms have more nebulae, halo has globular clusters).` };
    }

    // Search nearby stars, generate systems, check for match.
    // Rare types (neutron-star, black-hole) need a wider search.
    const isRare = targetType === 'neutron-star' || targetType === 'black-hole';
    const searchCount = isRare ? 200 : 50;
    const searchRadius = isRare ? 2.0 : 1.0;
    const nearby = HashGridStarfield.findStarsInRadius(galacticMap, playerGalacticPos, searchRadius, searchCount);
    const maxAttempts = Math.min(nearby.length, searchCount);
    let searched = 0;

    for (let i = 0; i < maxAttempts; i++) {
      const star = nearby[i];
      if (star.dist < 0.001) continue; // skip self
      searched++;

      const ctx = galacticMap.deriveGalaxyContext({
        x: star.worldX, y: star.worldY, z: star.worldZ,
      });
      const testData = StarSystemGenerator.generate(String(star.seed), ctx);

      // Check if this system matches the target type
      const evo = testData.stellarEvolution;
      let match = false;

      switch (targetType) {
        case 'red-giant':
          match = evo?.stage === 'red-giant';
          break;
        case 'white-dwarf':
          match = evo?.remnantType === 'white-dwarf';
          break;
        case 'neutron-star':
          match = evo?.remnantType === 'neutron-star';
          break;
        case 'black-hole':
          match = evo?.remnantType === 'black-hole';
          break;
        case 'binary':
          match = testData.isBinary;
          break;
        case 'habitable':
          match = testData.planets.some(p =>
            p.planetData.type === 'terrestrial' || p.planetData.type === 'ocean'
          );
          break;
        case 'rings':
          match = testData.planets.some(p => p.planetData.rings);
          break;
        case 'belt':
          match = testData.asteroidBelts && testData.asteroidBelts.length > 0;
          break;
      }

      if (match) {
        // Teleport to this star's position and spawn the system
        playerGalacticPos = { x: star.worldX, y: star.worldY, z: star.worldZ };
        skyRenderer.prepareForPosition(playerGalacticPos);
        skyRenderer.activate();
        skyRenderer.update(camera, 0);
        testData._destType = 'star-system';
        spawnSystem({ forWarp: false, systemData: testData });
        debugPanel.setPlayerPos(playerGalacticPos);
        debugPanel.setSystem(system, testData);

        // Focus camera on the star so evolved star types are visible
        if (system?.star?.mesh) {
          focusIndex = -2; // star focus mode
          focusStarIndex = 0;
          focusMoonIndex = -1;
          const starR = system.star._renderRadius || 5;
          cameraController.focusOn(system.star.mesh.position, starR * 5);
        }

        const dist = star.dist.toFixed(3);
        const msg = `Found ${targetType} at ${dist} kpc (searched ${searched} systems)`;
        console.log(`Debug find: ${msg}`);
        return { found: true, message: msg };
      }
    }

    return {
      found: false,
      message: `No ${targetType} found in ${searched} nearby systems. Try teleporting to a different galactic region first.`,
    };
  },
});

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
    if (system._deepSkyGas) {
      if (visible) system._deepSkyGas.addTo(scene);
      else system._deepSkyGas.removeFrom(scene);
    }
    if (system._deepSkyStars) {
      for (const s of system._deepSkyStars) s.mesh.visible = visible;
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
      entry.planetBillboard.mesh.visible = false; // LOD loop controls this
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
  cameraController.bypassed = false;
  cameraController.forceFreeLook = false;

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

  // Dispose the shared SkyFeatureLayer used for known-feature billboards
  if (_gallerySkyFeatureLayer) {
    _gallerySkyFeatureLayer.dispose();
    _gallerySkyFeatureLayer = null;
  }

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
let _galleryBakedRTs = [];
function _galleryCleanup() {
  if (galleryObject) {
    galleryObject.removeFrom(scene);
    galleryObject.dispose();
    galleryObject = null;
  }
  for (const obj of _galleryMeshes) {
    scene.remove(obj.mesh || obj);
    if (obj.dispose) {
      obj.dispose();
    } else if (obj instanceof THREE.Mesh) {
      // Raw THREE.Mesh (e.g., known-feature billboard) — dispose GPU resources
      obj.geometry.dispose();
      obj.material.dispose();
    }
  }
  _galleryMeshes = [];
  // Dispose baked texture render targets
  for (const rt of _galleryBakedRTs) {
    rt.dispose();
  }
  _galleryBakedRTs = [];
  // Hide comparison labels
  const lblL = document.getElementById('gallery-label-left');
  const lblR = document.getElementById('gallery-label-right');
  if (lblL) lblL.style.display = 'none';
  if (lblR) lblR.style.display = 'none';
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

  // ── Known Feature Gallery (cycles through all 37 real Messier/NGC profiles) ──
  if (type === 'known-feature') {
    // Clamp seed to valid profile index (Left/Right cycles through profiles)
    const profileIdx = ((gallerySeed - 1) % _knownProfileKeys.length + _knownProfileKeys.length) % _knownProfileKeys.length;
    const profileKey = _knownProfileKeys[profileIdx];
    const profile = KNOWN_OBJECT_PROFILES[profileKey];

    // Lazily create a SkyFeatureLayer for billboard rendering
    if (!_gallerySkyFeatureLayer) {
      _gallerySkyFeatureLayer = new SkyFeatureLayer({ min: 0.3, max: 1.0 });
    }

    const isCluster = profile.type === 'globular-cluster' || profile.type === 'open-cluster';
    const hasNebulaLayers = profile.layers > 0;

    if (isCluster && !hasNebulaLayers) {
      // Pure star clusters — auto-skip to next renderable item
      gallerySeed += _gallerySkipDir || 1;
      gallerySpawn();
      return;
    } else {
      // Build a fake feature object matching what SkyFeatureLayer expects
      const fakeFeature = {
        type: profile.type,
        color: profile.colorPrimary,
        seed: profileKey,
        knownProfile: profile,
      };

      // Place billboard at origin with a viewable size
      const billboardSize = 40;
      const billboardPos = new THREE.Vector3(0, 0, 0);
      const brightness = 1.0;

      const mesh = _gallerySkyFeatureLayer._createNebulaBillboard(
        fakeFeature, billboardPos, billboardSize, brightness
      );
      if (mesh) {
        // Rotate to face camera instead of origin (we're looking at origin)
        mesh.lookAt(camera.position);
        scene.add(mesh);
        _galleryMeshes.push(mesh);
      }

      camera.position.set(0, 0, 35);
      camera.lookAt(0, 0, 0);
    }

    // ── Build info overlay with full profile data ──
    const colorSwatch = (c) => {
      const r = Math.round(c[0] * 255);
      const g = Math.round(c[1] * 255);
      const b = Math.round(c[2] * 255);
      return `rgb(${r},${g},${b})`;
    };

    // Update the gallery overlay with rich profile info
    const overlay = document.getElementById('gallery-overlay');
    const info = document.getElementById('gallery-info');
    if (overlay) overlay.style.display = 'block';

    const profileNum = profileIdx + 1;
    const total = _knownProfileKeys.length;
    const catalogIds = [profile.messier, profile.ngc].filter(Boolean).join(' / ') || profileKey;

    let detailLines = [
      `${profile.name}  (${catalogIds})`,
      `type: ${profile.type}  |  shape: ${profile.shape}  |  layers: ${profile.layers}`,
      `mag: ${profile.integratedMagnitude}  |  warp: ${profile.domainWarpStrength}  |  asym: ${profile.asymmetry}`,
    ];
    if (profile.darkLanes) {
      detailLines.push(`dark lanes: ${profile.darkLaneStrength}`);
    }
    if (profile.centralStar) {
      detailLines.push(`central star: lum=${profile.centralStar.luminosity}`);
    }
    if (profile.embeddedStars) {
      detailLines.push(`embedded stars: ${profile.embeddedStars.count}  |  conc: ${profile.embeddedStars.concentration}`);
    }
    if (isCluster && !hasNebulaLayers) {
      detailLines.push('(cluster — stars only, no nebula billboard)');
    }

    if (info) {
      info.innerHTML = `<span style="color:#ff0">[${profileNum}/${total}]</span> ${detailLines[0]}<br>`
        + `<span style="display:inline-block;width:14px;height:14px;background:${colorSwatch(profile.colorPrimary)};vertical-align:middle;border:1px solid #555;margin-right:4px;"></span>`
        + `<span style="display:inline-block;width:14px;height:14px;background:${colorSwatch(profile.colorSecondary)};vertical-align:middle;border:1px solid #555;margin-right:8px;"></span>`
        + `mix: ${profile.colorMix}<br>`
        + detailLines.slice(1).join('<br>');
    }

    console.log(`Gallery: Known Feature ${profileNum}/${total} — ${profile.name} (${profileKey})`);
    // Hand camera to orbit controller
    cameraController.restoreFromWorldState(new THREE.Vector3(0, 0, 0));
    return;  // Skip the default overlay update at the bottom of gallerySpawn
  }

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
      const star = new StarFlare({ ...sData, radius: scaledR, color: sData.color }, scaledR);
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

  // ── Navigable open cluster (particle cloud + gas layers + stars) ──
  else if (type === 'nav-open-cluster') {
    const particleData = ClusterGenerator.generate(seed, 'open-cluster');
    const navData = NavigableClusterGenerator.generate(seed);
    const scaleFactor = particleData.radius / navData.radius;

    // Particle cloud (same as nav-open-cluster)
    galleryObject = new Galaxy(particleData);
    galleryObject.addTo(scene);

    // Gas cloud layers — scale positions to match particle cloud
    if (navData.gasLayers && navData.gasLayers.length > 0) {
      const scaledLayers = navData.gasLayers.map(l => ({
        ...l,
        position: [l.position[0] * scaleFactor, l.position[1] * scaleFactor, l.position[2] * scaleFactor],
        size: l.size * scaleFactor,
      }));
      const gasData = {
        layers: scaledLayers,
        starPositions: new Float32Array(0),
        starColors: new Float32Array(0),
        starSizes: new Float32Array(0),
      };
      const gasObj = new Nebula(gasData);
      gasObj.addTo(scene);
      _galleryMeshes.push(gasObj);
    }

    // Stars (same sizing as nav-open-cluster)
    for (const sData of navData.stars) {
      const scaledR = Math.max(particleData.radius * 0.02, 2.0);
      const star = new StarFlare({ ...sData, radius: scaledR, color: sData.color }, scaledR);
      star.mesh.position.set(
        sData.position[0] * scaleFactor,
        sData.position[1] * scaleFactor,
        sData.position[2] * scaleFactor,
      );
      star.addTo(scene);
      _galleryMeshes.push(star);
    }

    const radius = particleData.radius;
    camera.position.set(0, radius * 0.25, radius * 1.25);
    camera.lookAt(0, 0, 0);

    infoText = `open-cluster (navigable)  |  ${navData.stars.length} stars  |  gas: ${navData.gasLayers?.length || 0} layers  |  r=${radius.toFixed(0)}`;
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

    // Open clusters with reflection nebulosity: add gas cloud layers
    if (data.gasLayers && data.gasLayers.length > 0) {
      const gasData = {
        layers: data.gasLayers,
        starPositions: new Float32Array(0),
        starColors: new Float32Array(0),
        starSizes: new Float32Array(0),
      };
      const gasNebula = new Nebula(gasData);
      gasNebula.addTo(scene);
      _galleryMeshes.push(gasNebula);
    }

    const radius = data.radius;
    camera.position.set(0, radius * 0.5, radius * 2.5);
    camera.lookAt(0, 0, 0);

    infoText = `${data.particleCount || data.starCount || '?'} particles  |  r=${radius.toFixed(0)}`;
  }

  // ── Star (lens flare / diffraction spikes) ──
  else if (type === 'star-flare') {
    const systemData = StarSystemGenerator.generate(seed);
    const starData = { ...systemData.star, radius: systemData.star.radiusScene };
    const star = new StarFlare(starData);
    star.addTo(scene);
    _galleryMeshes.push(star);

    const r = starData.radius;
    camera.position.set(0, r * 0.5, r * 8);
    camera.lookAt(0, 0, 0);

    infoText = `FLARE  |  type ${systemData.star.type}  |  ${systemData.star.temp}K  |  r=${systemData.star.radiusSolar.toFixed(2)} R☉  |  L=${systemData.star.luminosity} L☉`;
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

    // ── Side-by-side: procedural (left) vs baked texture (right) ──
    const lightDir = new THREE.Vector3(0.5, 0.3, 0.8).normalize();

    // Left: procedural shader (existing Planet.js)
    const planet = new Planet(scenePlanetData, starInfo);
    planet._lightDir.copy(lightDir);
    planet.addTo(scene);
    _galleryMeshes.push(planet);

    const r = scenePlanetData.radius;
    const spacing = r * 2.8; // gap between the two spheres

    // Position procedural on the left
    planet.mesh.position.set(-spacing * 0.5, 0, 0);

    // Right: material channel approach (baked channels + palette display shader)
    if (!textureBaker) {
      textureBaker = new TextureBaker(retroRenderer.renderer);
    }
    const bakeSeed = gallerySeed * 137.0 + (forcedPlanet.baseColor?.[0] ?? 0.5) * 1000;
    const bakeType = getBakeType(planetType, false);
    // Sea level varies per planet — derived from seed for consistency
    // Lower seaLevel = more land (desert world), higher = more ocean (archipelago)
    // Terrestrial range: 0.32 (arid, ~30% water) to 0.52 (oceanic, ~65% water)
    // Ocean worlds: always high water
    const seaLevelHash = ((bakeSeed * 7919.0) % 1.0 + 1.0) % 1.0; // 0-1 from seed
    const bakeSeaLevel = planetType === 'terrestrial' ? 0.32 + seaLevelHash * 0.20
                       : planetType === 'ocean' ? 0.50 + seaLevelHash * 0.10
                       : -1.0;
    const baked = textureBaker.bakeChannels(bakeSeed, {
      noiseScale: forcedPlanet.noiseScale ?? 4.0,
      bodyType: bakeType,
      seaLevel: bakeSeaLevel,
      axialTilt: forcedPlanet.axialTilt ?? 0.0,
    });

    // Pick palette based on planet type
    const paletteMap = {
      'rocky': 'rocky', 'ice': 'ice', 'terrestrial': 'terrestrial',
      'lava': 'lava', 'volcanic': 'volcanic',
      'ocean': 'terrestrial', 'carbon': 'rocky', 'venus': 'rocky',
      'captured': 'rocky',
    };
    const paletteName = paletteMap[planetType] || 'rocky';
    let palette = { ...PALETTES[paletteName] };

    // CRITICAL: display shader seaLevel must match baking shader seaLevel
    // Override the palette's hardcoded seaLevel with the actual value we baked with
    palette.seaLevel = bakeSeaLevel;

    // Tint zone colors from planet's base/accent (non-biome types only)
    // Terrestrial uses biome sub-palette — don't override its zone colors
    if (!palette.biomeMode && forcedPlanet.baseColor && forcedPlanet.accentColor) {
      const bc = forcedPlanet.baseColor;
      const ac = forcedPlanet.accentColor;
      palette.zone0 = [ac[0] * 0.8, ac[1] * 0.8, ac[2] * 0.8];
      palette.zone1 = [
        (ac[0] + bc[0]) * 0.45,
        (ac[1] + bc[1]) * 0.45,
        (ac[2] + bc[2]) * 0.45,
      ];
      palette.zone2 = [bc[0] * 0.9, bc[1] * 0.9, bc[2] * 0.9];
      palette.zone3 = [bc[0] * 1.0, bc[1] * 1.0, bc[2] * 1.0];
      palette.zone4 = [
        Math.min(1.0, bc[0] * 1.15),
        Math.min(1.0, bc[1] * 1.15),
        Math.min(1.0, bc[2] * 1.15),
      ];
    }

    const channelGeom = new THREE.IcosahedronGeometry(scenePlanetData.radius, 4);
    const channelMat = createMaterialBodyMaterial({
      lightDir,
      lightDir2: null,
      starInfo,
      heightScale: 0.06,
      posterizeLevels: 8.0,
      ditherEdgeWidth: 0.5,
      palette,
    });
    channelMat.uniforms.materialMap.value = baked.materialMap;
    channelMat.uniforms.hasMaterial.value = 1.0;
    const channelMesh = new THREE.Mesh(channelGeom, channelMat);
    channelMesh.position.set(spacing * 0.5, 0, 0);
    scene.add(channelMesh);
    _galleryMeshes.push(channelMesh);

    // Store baked render target for cleanup
    if (!_galleryBakedRTs) _galleryBakedRTs = [];
    _galleryBakedRTs.push(baked.renderTarget);

    // Camera centered between both, far enough to see both
    cameraController.target.set(0, 0, 0);
    cameraController._targetGoal.set(0, 0, 0);
    cameraController._transitioning = false;
    cameraController.distance = r * 5;
    cameraController.smoothedDistance = r * 5;
    cameraController.pitch = 0.1;
    cameraController.smoothedPitch = 0.1;
    cameraController.smoothedYaw = cameraController.yaw;
    cameraController._returningToOrbit = false;
    cameraController.isFreeLooking = false;
    cameraController.forceFreeLook = false;
    camera.position.set(0, r * 0.5, r * 5);
    camera.lookAt(0, 0, 0);

    const features = [];
    if (forcedPlanet.rings) features.push('rings');
    if (forcedPlanet.clouds) features.push('clouds');
    if (forcedPlanet.atmosphere) features.push('atmo');
    // Show side-by-side labels
    const lblL = document.getElementById('gallery-label-left');
    const lblR = document.getElementById('gallery-label-right');
    if (lblL) lblL.style.display = 'block';
    if (lblR) lblR.style.display = 'block';

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
      // Far enough to see the full lens flare (spikes extend to ~6.5×r),
      // but stay inside innermost planet orbit (if any)
      const innerOrbit = system.planets.length > 0 ? system.planets[0].orbitRadius : Infinity;
      stop.orbitDistance = Math.min(starObj.data.radius * 8, innerOrbit * 0.6);
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
      // 3× radius fills ~60% of FOV — close enough to see surface detail.
      // Minimum 0.06 keeps tiny moons visible without near-plane clipping.
      stop.orbitDistance = Math.max(moon.data.radius * 3, 0.06);
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
    const starName = system.names
      ? (stop.starIndex === 1 ? system.names.star2 : system.names.star)
      : null;
    bodyInfo.showStar(starObj.data, starName);
  } else if (stop.type === 'planet') {
    focusIndex = stop.planetIndex;
    focusMoonIndex = -1;
    focusStarIndex = -1;
    if (system.planets[stop.planetIndex]) {
      const pName = system.names?.planets?.[stop.planetIndex]?.name ?? null;
      bodyInfo.showPlanet(system.planets[stop.planetIndex].planet.data, stop.planetIndex, pName);
    }
  } else if (stop.type === 'moon') {
    focusIndex = stop.planetIndex; // minimap highlights parent planet
    focusMoonIndex = stop.moonIndex;
    focusStarIndex = -1;
    const entry = system.planets[stop.planetIndex];
    if (entry && entry.moons[stop.moonIndex]) {
      const mName = system.names?.planets?.[stop.planetIndex]?.moons?.[stop.moonIndex] ?? null;
      bodyInfo.showMoon(entry.moons[stop.moonIndex].data, stop.planetIndex, mName);
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
  if (warpEffect.isActive) return;
  soundEngine.play('autopilotOn');
  _autopilotEnabled = true;

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
  if (!autoNav.isActive && !flythrough.active && !(_autopilotNavSequence && _autopilotNavSequence.isActive)) return;
  soundEngine.play('autopilotOff');

  // Abort any in-progress nav sequence
  if (_autopilotNavSequence && _autopilotNavSequence.isActive) {
    _autopilotNavSequence.abort();
    if (_navComputerOpen) closeNavComputer();
  }

  flythrough.stop();
  autoNav.stop();
  _manualBurnOrbiting = false;
  _autopilotEnabled = false;

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
  _cancelSystemMusic(); // stop ambient music during warp
  // Cancel any stale deep sky linger timer from the previous system
  // (e.g., title screen auto-dismiss sets this during warp)
  _deepSkyLingerTimer = -1;
  // Clear reticle state — old body references are about to be disposed
  _clearReticleTargets();

  // Create new system using pre-generated data (GPU resource creation only).
  // seedCounter was already incremented in onPrepareSystem.
  spawnSystem({ forWarp: true, systemData: pendingSystemData });
  pendingSystemData = null;
  pendingSystemDataPromise = null;

  // Position camera so it ends up approaching the first tour stop when
  // EXIT finishes. The post-warp flythrough then coasts the remaining distance.
  if (system) {
    const speed = 80; // must match cameraForwardSpeed in HYPER/EXIT phases
    // Camera now moves during all phases:
    // FOLD: progress²×40 over 4s ≈ 53 units
    // ENTER: (40 + progress×40) over 1.5s ≈ 90 units
    const foldDist = 53;
    const enterDist = 90;
    const hyperDist = speed * warpEffect.HYPER_DUR;           // 240
    const exitDist = speed * warpEffect.EXIT_DUR * 0.5;       // 80 (sqrt integral)
    const coastDist = 60;                                     // 3s post-warp approach
    const travelDist = foldDist + enterDist + hyperDist + exitDist;  // ~463

    if (system._navigable) {
      // Navigable deep sky: approach from well outside the structure
      // so you see the whole nebula/cluster on arrival, not the interior
      const navRadius = system._navRadius || 100000;
      const orbitDist = navRadius * 0.9;
      camera.position.set(0, 2, travelDist + orbitDist + coastDist);
      camera.lookAt(0, 0, 0);
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
      // Star system: approach toward the star.
      // orbitDist sets the final camera-to-star distance post-EXIT (travel
      // and coast terms cancel with starting position). The multiplier is
      // tuned so the StarFlare bloom (plane size = radius × 30) subtends
      // ~17° of the 50° FOV — star reads as large and prominent without
      // dominating the sky. No innerOrbit cap: in compact systems the cap
      // previously put the camera inside the flare plane, which made the
      // star fill the whole view on arrival (2026-04-16 fix). If
      // radius × 100 happens to exceed the first planet's orbit, that's
      // fine — we arrive slightly outside the innermost planet, which
      // still reads as a system-overview entry.
      const star = system.star;
      const starPos = star.mesh.position;
      const orbitDist = star.data.radius * 100;

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
  // Only start autoNav if autopilot was enabled before warp
  if (_autopilotEnabled) autoNav.start();

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

  // Schedule ambient system music (15-30s after arriving)
  // 20-35s after warp reveal (accounts for ~5s coast + buffer before music)
  _scheduleSystemMusic(20, 35);
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

/** Sync the nav computer's body tracking with current focus (if nav is open). */
function _syncNavBody() {
  if (_navComputerOpen && _navComputer) {
    _navComputer.setCurrentBody(focusIndex, focusMoonIndex);
  }
}

/**
 * Soft-select an in-system body. Sets the reticle's selected target,
 * rotates the camera to face the body (without traveling), and reveals
 * the COMMIT BURN button. Does NOT begin travel — that happens when
 * commitBurn() is called (via button click or Enter key).
 *
 * @param {Object} target — target descriptor from _makeTarget()
 */
/**
 * Clear any pending starfield warp target. Used by selectTarget() to
 * enforce single-selection: picking an in-system body must cancel any
 * previously picked background star so Space only ever commits one thing.
 */
function _clearWarpTargetSelection() {
  warpTarget.direction = null;
  warpTarget.name = null;
  warpTarget.starIndex = -1;
  warpTarget.navStarData = null;
  warpTarget.destType = null;
  warpTarget.featureData = null;
  warpTarget.galaxyData = null;
  warpTarget.blinkTimer = 0;
  warpTarget.blinkOn = true;
}

function selectTarget(target) {
  if (!target) {
    _selectedTarget = null;
    _updateCommitBurnButton();
    return;
  }
  // Single-selection invariant: picking a body cancels any pending
  // starfield warp target so Space commits the body (burn) rather than
  // the stale warp pick.
  _clearWarpTargetSelection();
  _selectedTarget = target;
  soundEngine.play('select');

  // Show the full body-info printout in the upper-left HUD on initial
  // selection. The reticle itself only shows the name; if Max wants the
  // details he reads them here or opens the NavComputer. BodyInfo auto-
  // fades on its own timer so this is a one-shot on click.
  if (system) {
    if (target.kind === 'planet') {
      const entry = system.planets?.[target.planetIndex];
      if (entry) {
        const pName = system.names?.planets?.[target.planetIndex]?.name ?? null;
        bodyInfo.showPlanet(entry.planet.data, target.planetIndex, pName);
      }
    } else if (target.kind === 'moon') {
      const entry = system.planets?.[target.planetIndex];
      const moon = entry?.moons?.[target.moonIndex];
      if (moon) {
        const mName = system.names?.planets?.[target.planetIndex]?.moons?.[target.moonIndex] ?? null;
        bodyInfo.showMoon(moon.data, target.planetIndex, mName);
      }
    } else if (target.kind === 'star') {
      const starIdx = target.starIndex || 0;
      let starObj;
      if (system._navigable && system.extraStars && starIdx >= 2) {
        starObj = system.extraStars[starIdx - 2] || system.star;
      } else {
        starObj = starIdx === 1 && system.star2 ? system.star2 : system.star;
      }
      if (starObj) {
        const sName = system.names
          ? (starIdx === 1 ? system.names.star2 : system.names.star)
          : null;
        bodyInfo.showStar(starObj.data, sName);
      }
    }
  }

  // Aim the camera at the selected body without moving the camera position.
  // Toy Box orbit math aims via `this.target`; rotating the orbit around a
  // new point is the natural way to "face" the body.
  if (target.mesh && !cameraController.bypassed) {
    // Transition the orbit target smoothly to the selected body's position.
    // We keep the current distance/yaw/pitch but shift `target` (the orbit
    // pivot) to the body. This re-centers the view on the body without
    // any sudden jump.
    cameraController._targetGoal.copy(target.mesh.position);
    cameraController._transitioning = true;
    cameraController._transitionSpeed = 0.06;
  }

  _updateCommitBurnButton();
}

/**
 * Deselect the currently selected target. Hides the commit burn button.
 */
function deselectTarget() {
  _selectedTarget = null;
  _updateCommitBurnButton();
}

/**
 * Actually begin travel to the currently selected target. Called by the
 * BURN button or the Space key. Routes to the existing focusPlanet /
 * focusStar / focusMoon travel logic.
 */
function commitBurn() {
  const t = _selectedTarget;
  if (!t) return;
  // Stop any current flythrough so the new burn takes over cleanly
  if (autoNav.isActive || flythrough.active) stopFlythrough();
  if (t.kind === 'star') focusStar(t.starIndex);
  else if (t.kind === 'planet') focusPlanet(t.planetIndex);
  else if (t.kind === 'moon') focusMoon(t.planetIndex, t.moonIndex);
  // Keep the selection active through travel; burn-in-progress state is
  // implied by flythrough.active. Button hides while burning.
  _updateCommitBurnButton();
}

/**
 * Universal commit — Space key or any "go now" shortcut.
 *  - In-system body selected → burn to it (in-system transit)
 *  - Warp target set (via nav computer or click) → warp
 *  - Nothing selected → no-op
 * Returns true if an action was committed.
 */
window._commitSelection = () => commitSelection();  // DEBUG: Playwright can exercise the space-key flow
function commitSelection() {
  if (warpEffect.isActive || warpTarget.turning) return false;

  // 3-stage spacebar preview flow (now the default for all warp targets).
  //   #1 (idle → preview):      open portal in place, entry strip dark
  //   #2 (preview → aligning):  start camera slerp + sequentially light crosses
  //   #3 (aligning → warp):     fire warp (cuts short any in-progress alignment)
  // `_portalLabState` survives across warps — onComplete resets it to 'idle'.
  if (warpTarget.direction) {
    if (_portalLabState === 'idle') {
      // Stop autopilot AND bypass the orbit controller so camera stays put
      // during preview + aligning. Two effects to stop:
      //   (1) flythrough/autoNav: move the camera along autopilot's tour path
      //   (2) cameraController.update(): when not bypassed, _applyOrbit()
      //       overwrites camera.quaternion every frame based on orbit state,
      //       so the Space #2 alignment slerp gets clobbered. Without this,
      //       the warp starts with the orbit controller's orientation (not
      //       the aligned one), camera flies along a curved path off the
      //       tunnel axis, and the Portal A crossing never fires.
      flythrough.stop();
      autoNav.stop();
      cameraController.killFlightVelocity();
      cameraController.bypassed = true;
      const previewPos = camera.position.clone().addScaledVector(warpTarget.direction, _portalLabPreviewDistance);
      warpPortal.resetTraversal();
      warpPortal.open(previewPos, warpTarget.direction);
      warpPortal.setRimIntensity(1.0);
      warpPortal.setEntryStripProgress(0);  // all crosses dark; lit by Space #2
      // Thread real origin + destination seeds into tunnel starfield.
      // Replaces placeholder so walls differ per-warp (AC#4).
      const [ox, oy, oz] = _seedStringToVec3(_currentSystemName || 'origin');
      const [dx, dy, dz] = _seedStringToVec3(warpTarget?.name || `dest-${seedCounter}`);
      warpPortal.setOriginSeed(ox, oy, oz);
      warpPortal.setDestinationSeed(dx, dy, dz);
      _portalLabState = 'preview';
      return true;
    }
    if (_portalLabState === 'preview') {
      // Capture start quaternion + target quaternion for the alignment slerp.
      // Target looks from camera toward `camera + warpTarget.direction` (i.e.,
      // camera rotates to face the portal direction directly).
      _portalLabAlignStartQuat.copy(camera.quaternion);
      const lookTarget = camera.position.clone().add(warpTarget.direction);
      _portalLabAlignLookMatrix.lookAt(camera.position, lookTarget, camera.up);
      _portalLabAlignTargetQuat.setFromRotationMatrix(_portalLabAlignLookMatrix);
      _portalLabAlignElapsed = 0;
      _portalLabState = 'aligning';
      return true;
    }
    // State is 'aligning' — Space #3. Fire warp (cut short any in-progress
    // alignment; the warp's own FOLD/ENTER slerp finishes the alignment).
    _portalLabState = 'idle';
    warpPortal.setEntryStripProgress(1);  // all crosses lit as we enter
    _tunnelForward.copy(warpTarget.direction);
    cameraController.killFlightVelocity();
    cameraController.bypassed = true;
    warpEffect.start(warpTarget.direction);
    return true;
  }

  if (_selectedTarget) {
    commitBurn();
    return true;
  }
  // (No reachable `beginWarpTurn()` path here anymore — the 3-stage preview
  // block above consumes any `warpTarget.direction` before we get here.
  // `beginWarpTurn` is still reachable from autopilot exit callbacks.)
  return false;
}

/** Show/hide + update the BURN HUD button based on current state. */
function _updateCommitBurnButton() {
  const btn = document.getElementById('commit-burn-btn');
  if (!btn) return;
  const burning = flythrough.active || warpEffect.isActive || warpTarget.turning;
  const visible = !!_selectedTarget && !burning;
  btn.style.display = visible ? 'block' : 'none';
  if (visible) {
    const label = _selectedTarget.name || 'TARGET';
    btn.textContent = `BURN → ${label.toUpperCase()}`;
  }
}

// Wire the commit burn button's click handler once
{
  const btn = document.getElementById('commit-burn-btn');
  if (btn) {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      commitBurn();
    });
    btn.addEventListener('touchend', (e) => {
      e.preventDefault();
      e.stopPropagation();
      commitBurn();
    });
  }
}

/**
 * Focus the camera on a specific planet (by index), or overview if -1.
 */
function focusPlanet(index) {
  if (!system) return;
  soundEngine.play('select');
  cameraController.killFlightVelocity();
  focusMoonIndex = -1;
  focusStarIndex = -1;

  if (index < 0 || index >= system.planets.length || system.planets.length === 0) {
    focusIndex = -1;
    if (system.planets.length > 0) {
      const outerOrbit = system.planets[system.planets.length - 1].orbitRadius;
      cameraController.viewSystem(outerOrbit);
    } else {
      // 0-planet system: orbit the star instead
      const starR = system.star ? system.star.data.radius : 5;
      cameraController.viewSystem(starR * 10);
    }
    bodyInfo.hide();
    console.log('System overview');
  } else {
    focusIndex = index;
    const entry = system.planets[index];
    const bodyRadius = entry.planet.data.radius;
    // Orbit distance must be large enough for the camera to see the planet
    // (planet scene radii can be < 0.1 units; camera needs breathing room)
    const orbitDist = Math.max(bodyRadius * 6, 0.02);
    console.log(`[BURN START] planet: radius=${bodyRadius.toFixed(4)}, orbitDist=${orbitDist.toFixed(4)}, ratio=${(orbitDist/Math.max(bodyRadius,0.001)).toFixed(1)}x`);
    cameraController.bypassed = true;
    flythrough.beginTravelFrom(entry.planet.mesh, orbitDist, bodyRadius);
    const pName = system.names?.planets?.[index]?.name ?? null;
    bodyInfo.showPlanet(entry.planet.data, index, pName);
    console.log(`Focus: planet ${index + 1} ${pName || ''} (${entry.planet.data.type})`);
  }
  _syncNavBody();
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
  // Smooth cinematic travel instead of instant snap
  viewDist = Math.max(viewDist, 2.0);
  const bodyRadius = starObj.data.radius;
  cameraController.bypassed = true;
  flythrough.beginTravelFrom(starObj.mesh, viewDist, bodyRadius);
  const sName = system.names
    ? (starIdx === 1 ? system.names.star2 : system.names.star)
    : null;
  bodyInfo.showStar(starObj.data, sName);
  const label = system.isBinary
    ? (starIdx === 0 ? 'primary star' : 'secondary star')
    : 'star';
  console.log(`Focus: ${label} ${sName || ''} (${starObj.data.type}-class)`);
  _syncNavBody();
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
  // 5x radius gives a good framing; floor at 0.05 prevents near-plane clipping
  const viewDist = Math.max(moon.data.radius * 5, 0.02);
  console.log(`[BURN START] moon: radius=${moon.data.radius.toFixed(4)}, orbitDist=${viewDist.toFixed(4)}, ratio=${(viewDist/Math.max(moon.data.radius,0.001)).toFixed(1)}x`);
  focusIndex = planetIndex;
  focusMoonIndex = moonIndex;
  focusStarIndex = -1;
  // Smooth cinematic travel instead of instant snap
  const bodyRadius = moon.data.radius;
  cameraController.bypassed = true;
  flythrough.beginTravelFrom(moon.mesh, viewDist, bodyRadius);
  const mName = system.names?.planets?.[planetIndex]?.moons?.[moonIndex] ?? null;
  bodyInfo.showMoon(moon.data, planetIndex, mName);
  console.log(`Focus: moon ${moonIndex + 1} ${mName || ''} of planet ${planetIndex + 1} (${moon.data.type})`);
  _syncNavBody();
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
  const el = document.documentElement;
  const isFs = document.fullscreenElement || document.webkitFullscreenElement;
  if (isFs) {
    (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
  } else {
    (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el)?.catch(() => {});
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
const _portalProj = new THREE.Vector3();
const _portalScreenUV = new THREE.Vector2(0.5, 0.5);
// Tunnel forward axis — captured at warp start so the tunnel deformation stays
// aligned even as the camera slerps during FOLD. Drives the vertex warp in
// StarfieldLayer/ProceduralGlowLayer via skyRenderer.setTunnelForward().
const _tunnelForward = new THREE.Vector3(0, 0, -1);

// Portal test mode (Shift+W to enter, SPACE to advance)
let _portalTestMode = false;
let _portalTestPhase = 'idle';  // idle | open | flying | arrived
const _portalTestForward = new THREE.Vector3(0, 0, -1);
const _portalTestStartPos = new THREE.Vector3();
let _portalTestFlightStart = 0;
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

  // ── Sky debug mode: free-look camera, render only sky scene ──
  if (window._skyDebug) {
    camera.position.set(0, 100000, 0);
    const yaw = window._skyYaw || 0;
    const pitch = window._skyPitch || 0;
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    camera.lookAt(sy * cp + camera.position.x, sp + camera.position.y, cy * cp + camera.position.z);
    camera.updateMatrixWorld();
    skyRenderer.update(camera, 0);
    // Render ONLY the sky scene (skip scene objects entirely)
    const r = retroRenderer.renderer;
    r.setRenderTarget(null);
    r.setClearColor(0x000000, 1);
    r.clear();
    r.render(skyRenderer.getScene(), camera);
    return;
  }

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
        obj.update(deltaTime, camera);
      }
      if (obj.updateGlow) obj.updateGlow(camera);
    }
    // Camera controller handles both auto-rotation and manual drag orbit
    cameraController.update(deltaTime);
    // Fixed 1e-9 near (~15 cm) — log depth buffer handles precision across range.
    // Sized so 20 m ship / 100 m portal / 500 m station don't clip on close approach.
    camera.near = 1e-9;
    camera.updateProjectionMatrix();
    skyRenderer.update(camera, deltaTime);
    retroRenderer.setTime(timer.getElapsed());
    retroRenderer.render();
    return;
  }

  if (system) {
    // ── Deep sky destination update ──
    if (system.type && system.type !== 'star-system') {
      if (system.destination) system.destination.update(deltaTime, camera);
      // Navigable deep sky: update gas cloud + extra star glows
      if (system.gasCloud) system.gasCloud.update(deltaTime, camera);
      if (system._deepSkyGas) system._deepSkyGas.update(deltaTime, camera);
      if (system._deepSkyStars) {
        for (const s of system._deepSkyStars) s.update(deltaTime, camera);
      }
      if (system.extraStars) {
        for (const s of system.extraStars) {
          if (s.update) s.update(deltaTime, camera);
          if (s.updateGlow) s.updateGlow(camera);
        }
      }
      // Primary star update + glow
      if (system.star && system.star.update) system.star.update(deltaTime, camera);
      if (system.star && system.star.updateGlow) system.star.updateGlow(camera);
      if (system.star2 && system.star2.update) system.star2.update(deltaTime, camera);
      if (system.star2 && system.star2.updateGlow) system.star2.updateGlow(camera);
    }

    // ── Star system updates (skip for deep sky) ──
    if (!system.type || system.type === 'star-system') {

    // ── Orbit speed multiplier (from settings slider) ──
    const orbitDt = deltaTime * settings.get('orbitSpeedMultiplier');

    // ── Binary star orbit ──
    if (system.isBinary) {
      system.binaryOrbitAngle += system.binaryOrbitSpeed * orbitDt;
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
      entry.orbitAngle += entry.orbitSpeed * orbitDt;
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
          moon.orbitAngle += moon.data.orbitSpeed * orbitDt;
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
          moon.update(orbitDt, entry.planet.mesh.position);
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
      const pu = pMat.uniforms;

      // Pass star positions to planet shader (if uniforms exist)
      if (pu.starPos1) pu.starPos1.value.copy(_star1Pos);
      if (pu.starPos2) pu.starPos2.value.copy(_star2Pos);

      // Transit shadows: moons casting shadows on this planet
      // (textured shader doesn't have moon shadow arrays — skip if missing)
      if (pu.shadowMoonCount) {
        const moonCount = Math.min(entry.moons.length, 6);
        pu.shadowMoonCount.value = moonCount;
        for (let m = 0; m < moonCount; m++) {
          pu.shadowMoonPos.value[m].copy(entry.moons[m].mesh.position);
          pu.shadowMoonRadius.value[m] = entry.moons[m].data.radius;
        }
      }

      // Planet-planet shadows: check immediate orbital neighbors
      // (textured shader has single shadowPlanetPos, not arrays — skip if missing)
      if (pu.shadowPlanetCount) {
        let shadowPlanetIdx = 0;
        if (i > 0) {
          const inner = system.planets[i - 1];
          pu.shadowPlanetPos.value[shadowPlanetIdx].copy(inner.planet.mesh.position);
          pu.shadowPlanetRadius.value[shadowPlanetIdx] = inner.planet.data.radius;
          shadowPlanetIdx++;
        }
        if (i < system.planets.length - 1 && shadowPlanetIdx < 2) {
          const outer = system.planets[i + 1];
          pu.shadowPlanetPos.value[shadowPlanetIdx].copy(outer.planet.mesh.position);
          pu.shadowPlanetRadius.value[shadowPlanetIdx] = outer.planet.data.radius;
          shadowPlanetIdx++;
        }
        pu.shadowPlanetCount.value = shadowPlanetIdx;
      }

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

    // ── Update stars (billboarding, LOD, glow) ──
    if (system.star.update) system.star.update(deltaTime, camera);
    system.star.updateGlow(camera);
    if (system.star2) {
      if (system.star2.update) system.star2.update(deltaTime, camera);
      system.star2.updateGlow(camera);
    }

    // ── Update asteroid belts ──
    for (const belt of system.asteroidBelts) {
      belt.update(orbitDt);
      // Update star positions for per-fragment lighting (binary)
      if (system.isBinary) {
        belt.updateStarPositions(system.star.mesh.position, system.star2.mesh.position);
      }
    }

    // ── Update flavor ships orbiting planets ──
    shipSpawner.update(orbitDt, system.planets);

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

    // ── LOD: ghost reticle vs mesh vs planet billboard ──
    // Three-tier distance model for planets:
    //   Close: full 3D mesh (pPixels >= 3)
    //   Medium: shader billboard dot — radius-scaled, dimmer than stars
    //           (pPixels < 3, distance < orbit * PLANET_BILLBOARD_RANGE)
    //   Far: ghost reticle only (pPixels < 3, beyond billboard range)
    //
    // Stars are always visible as billboards. Planet billboards have a
    // distance cutoff so they don't cluster around the star dot at extreme
    // zoom. Ghost reticles stay active for hover/click at all distances.
    //
    // NOTE: entry.billboard / entry.moonBillboards (Billboard.js) are DEAD
    // CODE — their sprites are force-hidden below. Kept for dispose path.
    const PLANET_BILLBOARD_RANGE = 15; // billboard visible within N× orbit radius
    const PLANET_GHOST_RANGE = 10000; // planet brackets visible within 10 AU (10000 scene units)
    const MOON_GHOST_RANGE = 20;      // moon brackets visible within N× moon orbit radius from parent planet
    _ghostTargets.length = 0;
    _occluders.length = 0;
    {
      const fovRad = camera.fov * Math.PI / 180;
      const renderHeight = window.innerHeight / retroRenderer.pixelScale;
      const projScale = renderHeight / (2 * Math.tan(fovRad / 2));

      // During flythrough, protect both the current body and travel destination
      // from ghosting (bodyRef = current/departure, nextBodyRef = destination)
      const flythroughBody = flythrough.active ? flythrough.bodyRef : null;
      const flythroughDest = flythrough.active ? flythrough.nextBodyRef : null;

      for (let pi = 0; pi < system.planets.length; pi++) {
        const entry = system.planets[pi];
        // Planet LOD — always show mesh for focused or flythrough-related planet
        const pDist = camera.position.distanceTo(entry.planet.mesh.position);
        const pPixels = (entry.planet.data.radius * 2) * projScale / pDist;
        const isFocusedPlanet = (focusIndex === pi && focusMoonIndex < 0);
        const pMesh = entry.planet.mesh;
        const pSurf = entry.planet.surface;
        const isFlythroughTarget = (flythroughBody === pMesh || flythroughBody === pSurf
          || flythroughDest === pMesh || flythroughDest === pSurf);
        const pIsGhost = !isFocusedPlanet && !isFlythroughTarget && pPixels < 3;
        entry.planet.mesh.visible = !pIsGhost;
        entry.billboard.sprite.visible = false; // old Billboard.js — dead code

        // Planet billboard dot: show when sub-pixel but within range
        const pBb = entry.planetBillboard;
        if (pIsGhost && pDist < entry.orbitRadius * PLANET_BILLBOARD_RANGE) {
          pBb.mesh.position.copy(entry.planet.mesh.position);
          pBb.mesh.visible = true;
          pBb.update(camera);
        } else {
          pBb.mesh.visible = false;
        }

        if (pIsGhost && pDist < PLANET_GHOST_RANGE) {
          const ghost = _makeTarget('planet', { planetIndex: pi });
          if (ghost) _ghostTargets.push(ghost);
        } else if (!pIsGhost) {
          // Visible planet can occlude other reticles behind it.
          _occluders.push({ mesh: entry.planet.mesh, radius: entry.planet.data.radius });
        }

        // Moon LOD
        for (let m = 0; m < entry.moons.length; m++) {
          const moon = entry.moons[m];
          const mDist = camera.position.distanceTo(moon.mesh.position);
          const mPixels = (moon.data.radius * 2) * projScale / mDist;
          // Always show mesh for the focused moon (never swap to ghost up close)
          const isFocusedMoon = (focusIndex === pi && focusMoonIndex === m);
          const isMoonFlythroughTarget = (flythroughBody === moon.mesh || flythroughDest === moon.mesh);
          const mIsGhost = !isFocusedMoon && !isMoonFlythroughTarget && mPixels < 3;
          moon.mesh.visible = !mIsGhost;
          const moonBb = entry.moonBillboards[m];
          moonBb.sprite.visible = false;
          // Keep click proxy in sync with moon position
          if (moon._clickProxy) moon._clickProxy.position.copy(moon.mesh.position);
          // Moon brackets + billboard: only show when camera is near the parent planet.
          const moonOrbitR = moon.data.orbitRadius || 1;
          const distToPlanet = camera.position.distanceTo(entry.planet.mesh.position);
          const moonNearby = distToPlanet < moonOrbitR * MOON_GHOST_RANGE;
          // Moon billboard dot
          const mPb = moon._planetBillboard;
          if (mPb) {
            if (mIsGhost && moonNearby) {
              mPb.mesh.position.copy(moon.mesh.position);
              mPb.mesh.visible = true;
              mPb.update(camera);
            } else {
              mPb.mesh.visible = false;
            }
          }
          if (mIsGhost && moonNearby) {
            const ghost = _makeTarget('moon', { planetIndex: pi, moonIndex: m });
            if (ghost) _ghostTargets.push(ghost);
          } else if (!mIsGhost) {
            // Visible moon can occlude other reticles behind it.
            _occluders.push({ mesh: moon.mesh, radius: moon.data.radius });
          }
        }
      }

      // Stars always render as full meshes and are typically huge — they
      // absolutely occlude reticles behind them. Add them to the occluder
      // list so binary secondaries and distant planets get properly hidden
      // when the primary is in the way.
      if (system.star?.mesh && system.star.mesh.visible) {
        _occluders.push({ mesh: system.star.mesh, radius: system.star.data.radius });
      }
      if (system.star2?.mesh && system.star2.mesh.visible) {
        _occluders.push({ mesh: system.star2.mesh, radius: system.star2.data.radius });
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
          // Capture stable tunnel axis at warp start. Camera will continue to
          // slerp toward `dir` during FOLD, but the tunnel deformation stays
          // locked to this vector so the cylinder axis is coherent.
          _tunnelForward.copy(dir);
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

    // ── Portal test mode (Shift+W + spacebar control) ──
    // When in test mode, drive the portal/camera manually based on phase.
    if (_portalTestMode) {
      // Drive rim time so it animates
      warpPortal.update(deltaTime);

      if (_portalTestPhase === 'flying') {
        // Camera flies forward along the recorded portal direction at 40 units/sec
        const speed = 40;
        camera.position.addScaledVector(_portalTestForward, speed * deltaTime);
        // After 15 seconds, mark as arrived
        const elapsed = (performance.now() - _portalTestFlightStart) / 1000;
        if (elapsed > 15) _portalTestPhase = 'arrived';
      }

      // Drive lensing while portal is visible in test mode
      if (warpPortal.group.visible) {
        _portalProj.copy(warpPortal.group.position).project(camera);
        _portalScreenUV.set((_portalProj.x + 1) * 0.5, (_portalProj.y + 1) * 0.5);
        const distToPortal = camera.position.distanceTo(warpPortal.group.position);
        const fovRad = camera.fov * Math.PI / 180;
        const screenRadius = Math.atan(8 / Math.max(distToPortal, 1)) / fovRad;
        retroRenderer.setPortalLensing(_portalScreenUV, screenRadius, 0.12);
      } else {
        retroRenderer.setPortalLensing(null, 0, 0);
      }
    }

    // ── Warp transition ──
    if (warpEffect.isActive) {
      const prevState = warpEffect.state;
      warpEffect.update(deltaTime);

      // Hide system objects when ENTER starts — they're behind the camera
      // by now (camera flew past them during FOLD) or will fade quickly.
      // Exception: distant deep sky flying TOWARD (no target) — stays visible
      // through ENTER (growing on screen). Hidden at HYPER start.
      //
      // CRITICAL: gate on `!warpEffect._swapFired`. In dual-portal mode the
      // geometric INSIDE crossing fires during ENTER (at Portal A plane),
      // which triggers warpSwapSystem → spawnSystem. That replaces `system`
      // with the NEW destination system. If we then call _hideCurrentSystem()
      // at either boundary, we'd rip the new system's meshes out of the scene.
      // Without this gate, the destination system appears invisible after
      // warp — Max reported this 2026-04-16.
      if (prevState === 'fold' && warpEffect.state === 'enter' && !warpEffect._swapFired) {
        const isDistantDS = system && system.type && system.type !== 'star-system' && !system._navigable;
        const flyingToward = isDistantDS && warpEffect.riftDirection === null;
        if (!flyingToward) {
          _hideCurrentSystem();
        }
      }
      if (prevState === 'enter' && warpEffect.state === 'hyper' && !warpEffect._swapFired) {
        // Catch any remaining objects (distant deep sky flying toward) — tunnel is opaque
        _hideCurrentSystem();
      }

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
      // Legacy starfield fold (stars folding toward a rift point) is the
      // pre-dual-portal visual. With the mesh tunnel doing the work, we
      // leave the starfield untouched during warp — no fold, full brightness.
      if (_useDualPortal) {
        starfield.setWarpUniforms(0, 1, null);
      } else {
        starfield.setWarpUniforms(warpEffect.foldAmount, warpEffect.starBrightness, _riftNDC);
      }

      // ── Seamless tunnel sky deformation (legacy — pre-dual-portal) ──
      // tunnelPhase deforms the sky sphere into a cylinder and a crossover
      // plane sweeps to blend origin/destination starfields. That was the
      // sole hyperspace visual before the physical mesh tunnel existed.
      // In dual-portal mode it must be OFF — the sky should stay a normal
      // sphere in both systems, and the mesh tunnel carries the transition.
      //
      // Without this gate, EXIT un-deforms the cylinder back to a sphere
      // (the "starfield warps from tunnel shape into default" Max saw) and
      // the crossover sweep fades origin stars out + destination stars in
      // on top of the mesh exit.
      if (_useDualPortal) {
        skyRenderer.setTunnelPhase(0);
        skyRenderer.setCrossoverAlong(1e6);
      } else {
        // NOTE: WarpEffect.foldAmount stays at 0 during FOLD (the 3D portal
        // is the primary FOLD visual). Use warpEffect.progress for the FOLD
        // ramp so the sky deformation actually animates 0→1 across the phase.
        let _tunnelPhase = 0;
        if (warpEffect.state === 'fold') {
          _tunnelPhase = warpEffect.progress;
        } else if (warpEffect.state === 'enter' || warpEffect.state === 'hyper') {
          _tunnelPhase = 1;
        } else if (warpEffect.state === 'exit') {
          _tunnelPhase = 1 - warpEffect.progress;
        }
        skyRenderer.setTunnelPhase(_tunnelPhase);
        skyRenderer.setTunnelForward(_tunnelForward);

        if (warpEffect.state === 'hyper') {
          const xoFar = 600, xoBack = -600;
          const xoPos = xoFar + (xoBack - xoFar) * warpEffect.progress;
          skyRenderer.setCrossoverAlong(xoPos);
        }
      }

      // ── Dual-portal traversal (warp-through mesh) ──
      // Both portals stay in the world for the entire warp. Portal A opens
      // 30u ahead of the starting camera along _tunnelForward at FOLD t=0;
      // Portal B sits `tunnelLength` further along the same axis. Camera
      // flies forward through OUTSIDE_A → INSIDE → OUTSIDE_B; plane-
      // crossing detection in `warpPortal.updateTraversal()` flips render
      // state and fires `onTraversal('INSIDE')` → warpEffect.onSwapSystem.
      if (_useDualPortal) {
        if (!warpPortal.group.visible) {
          // Portal spawn distance tied to ship scale via ScaleConstants.
          // Same distance as lab preview so FOLD ramp lands the camera at
          // Portal A by end of FOLD at any ship scale.
          const portalAPos = camera.position.clone()
            .addScaledVector(_tunnelForward, portalPreviewDistanceScene());
          warpPortal.resetTraversal();
          warpPortal.open(portalAPos, _tunnelForward);
        }
        // Keep rim visible throughout the warp (legacy portalRimIntensity
        // falls to 0 during HYPER; the dual-portal needs the rings visible).
        // Portal-lab mode: hold rim steady — no pulsing, no modulation.
        warpPortal.setRimIntensity(_portalLabMode ? 1.0 : Math.max(0.6, warpEffect.portalRimIntensity));
        warpPortal.setBridgeMix(warpEffect.portalBridgeMix);
        warpPortal.updateTraversal(camera);
        // No screen-space lens — the tunnel mesh IS the hyperspace visual.
        retroRenderer.setPortalLensing(null, 0, 0);
      } else if (warpEffect.portalVisible) {
        // Legacy single-portal path (kept for A/B comparison via _useDualPortal=false)
        if (!warpPortal.group.visible) {
          const portalPos = camera.position.clone()
            .addScaledVector(riftDir, portalPreviewDistanceScene());
          warpPortal.open(portalPos, riftDir);
        }
        warpPortal.setRimIntensity(warpEffect.portalRimIntensity);
        warpPortal.setBridgeMix(warpEffect.portalBridgeMix);
        _portalProj.copy(warpPortal.group.position).project(camera);
        _portalScreenUV.set(
          (_portalProj.x + 1) * 0.5,
          (_portalProj.y + 1) * 0.5,
        );
        const distToPortal = camera.position.distanceTo(warpPortal.group.position);
        const fovRad = camera.fov * Math.PI / 180;
        const screenRadius = Math.atan(8 / Math.max(distToPortal, 1)) / fovRad;
        retroRenderer.setPortalLensing(_portalScreenUV, screenRadius, 0.12);
      } else {
        if (warpPortal.group.visible) warpPortal.close();
        retroRenderer.setPortalLensing(null, 0, 0);
      }

      // Deep sky objects: override sceneFade in certain phases.
      // - Distant deep sky flying TOWARD (no target): keep visible during FOLD/ENTER
      // - Distant deep sky flying PAST (target selected): use normal sceneFade
      // - EXIT for all deep sky: keep visible (revealed through exit hole)
      let effectiveSceneFade = warpEffect.sceneFade;
      const isDistantDS = system && system.type && system.type !== 'star-system' && !system._navigable;
      const flyingPastDS = isDistantDS && warpEffect.riftDirection !== null;
      if (isDistantDS && !flyingPastDS && (warpEffect.state === 'fold' || warpEffect.state === 'enter')) {
        effectiveSceneFade = 0; // flying toward — keep galaxy visible
      }
      if (warpEffect.state === 'exit' && system && system.type && system.type !== 'star-system') {
        effectiveSceneFade = 0;
      }
      // Dual-portal: the tunnel mesh IS the HYPER visual. Never fade the
      // scene (that would hide the tunnel along with the system meshes).
      // Tunnel walls occlude the destination-system meshes at their own
      // depth, so leaving the full scene visible doesn't leak them.
      if (_useDualPortal) {
        effectiveSceneFade = 0;
      }

      // During EXIT phase, the camera has repositioned for the new system.
      // The old riftDirection now projects off-center. Force the exit reveal
      // to open from screen center so it looks correct.
      const warpUV = (warpEffect.state === 'exit')
        ? _riftUV.set(0.5, 0.5)
        : _riftUV;

      // Suppress the old screen-space portal circle during FOLD/ENTER — the 3D
      // portal owns those phases now. Pass foldGlow=0 to disable the composite
      // shader's portal aperture and chromatic aberration ring.
      const composFoldGlow = (warpEffect.state === 'fold' || warpEffect.state === 'enter')
        ? 0
        : warpEffect.foldGlow;

      // With dual-portal active the tunnel mesh replaces the fullscreen
      // hyperspace composite — zero its drivers so it doesn't render on top.
      const composHyperPhase = _useDualPortal ? 0 : warpEffect.hyperPhase;
      const composExitReveal = _useDualPortal ? 0 : warpEffect.exitReveal;
      retroRenderer.setWarpUniforms(
        effectiveSceneFade,
        warpEffect.whiteFlash,
        composHyperPhase,
        warpEffect.hyperTime,
        composFoldGlow,
        composExitReveal,
        warpUV,
      );

      // Drive new composite-shader tunnel uniforms (procedural starfield walls,
      // bridge blend, exit recession). Keeps the visual style consistent with
      // the 3D portal's tunnel during HYPER, then walls recede during EXIT.
      // In dual-portal mode the physical tunnel mesh IS the visual, so zero
      // these out — otherwise the composite shader draws an expanding
      // procedural tunnel on top of the real scene during EXIT, which looks
      // like "stars fading in from the side" as the fullscreen tunnel pattern
      // recedes and reveals the real destination system underneath.
      if (_useDualPortal) {
        retroRenderer.setTunnelUniforms(0, 0, null, null);
      } else {
        retroRenderer.setTunnelUniforms(
          warpEffect.tunnelWallRecession,
          warpEffect.portalBridgeMix,
          null,  // origin seed — keep default
          null,  // destination seed — keep default (could be derived from pendingSystemData)
        );
      }

      // ── Camera slerp: rotate to face the rift during fold/enter ──
      // After onSwapSystem fires (dual-portal INSIDE transition), camera is
      // teleported to the new system and re-oriented via lookAt(starPos).
      // The old riftDir now points somewhere meaningless in the new frame, so
      // skip the slerp — otherwise it rotates the camera away from Portal B's
      // axis and the OUTSIDE_B plane crossing never fires.
      if ((warpEffect.state === 'fold' || warpEffect.state === 'enter') && !warpEffect._swapFired) {
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

        // Deep sky objects during warp:
        // - Navigable (nebulae, open clusters): stay fixed — camera flies past them
        //   like star system objects.
        // - Distant (galaxies, globular clusters): behavior depends on warp target.
        //   * No target selected (riftDirection null): fly TOWARD the galaxy — it
        //     grows on screen (92% of camera speed = slow closing distance).
        //   * Background star selected: fly PAST the galaxy — it drifts behind you,
        //     but slowly (50% of camera speed) because of its vast scale. A planet
        //     would whoosh past at full speed; a galaxy is so immense it lingers.
        if (system && system.type && system.type !== 'star-system' && system.destination && !system._navigable) {
          const flyingPast = warpEffect.riftDirection !== null;
          const dsFactor = flyingPast ? 0.5 : 0.92;
          system.destination.mesh.position.addScaledVector(_sunDir, warpEffect.cameraForwardSpeed * dsFactor * deltaTime);
          if (system._dummyRefs) {
            for (const ref of system._dummyRefs) {
              ref.position.addScaledVector(_sunDir, warpEffect.cameraForwardSpeed * dsFactor * deltaTime);
            }
          }
        }
      }
    } else {
      // Reset warp uniforms when not warping
      starfield.setWarpUniforms(0, 1, null);
      retroRenderer.setWarpUniforms(0, 0, 0, 0, 0, 0, null);
      // Return sky layers to rest: no tunnel deformation, no crossover clip.
      // Cheap uniform writes; safe even when a warp was never started.
      skyRenderer.setTunnelPhase(0);
      skyRenderer.setCrossoverAlong(1e6);
      skyRenderer.setClipSide(0);
      // Portal B follows the ship post-warp: always postExitDistance (100 m)
      // behind the camera in the ARRIVAL direction (captured at onComplete).
      // Using arrival direction — not camera.getWorldDirection() — means
      // rotating the ship/view reveals Portal B instead of dragging it
      // along behind the view.
      if (warpPortal.group.visible && warpPortal._traversalMode === 'OUTSIDE_B') {
        _portalFollowPos.copy(camera.position)
          .addScaledVector(_arrivalForward, warpPortal._tunnelLength - postExitDistanceScene());
        warpPortal.group.position.copy(_portalFollowPos);
        _portalFollowTarget.copy(_portalFollowPos).add(_arrivalForward);
        warpPortal.group.lookAt(_portalFollowTarget);
      }

      // Post-arrival camera slerp in lab mode: smoothly rotate from the
      // forward-facing post-warp orientation to facing Portal B. Once the
      // slerp finishes, hand control to the orbit controller. Controller
      // stays bypassed during the slerp so its lookAt(target) snap doesn't
      // fight our rotation.
      if (_labArriving) {
        _labArrivalElapsed += deltaTime;
        const t = Math.min(1, _labArrivalElapsed / _labArrivalDuration);
        // Smootherstep ease: t³(t(t·6−15)+10). Gentle start + gentle stop.
        const eased = t * t * t * (t * (t * 6 - 15) + 10);
        camera.quaternion.copy(_labArrivalStartQuat).slerp(_labArrivalTargetQuat, eased);
        if (t >= 1) {
          _labArriving = false;
          cameraController.restoreFromWorldState(_labArrivalTarget);
        }
      }

      // Lab-mode alignment animation (Space #2 → Space #3 window).
      // Camera slerps from current orientation toward facing Portal A, AND
      // the entry-strip crosses light up sequentially from ship toward
      // portal over the same duration. Runs outside the warp-active branch
      // because the preview + alignment happen before warpEffect.start().
      if (_portalLabState === 'aligning') {
        _portalLabAlignElapsed += deltaTime;
        const t = Math.min(1, _portalLabAlignElapsed / _portalLabAlignDuration);
        const eased = t * t * t * (t * (t * 6 - 15) + 10);
        camera.quaternion.copy(_portalLabAlignStartQuat).slerp(_portalLabAlignTargetQuat, eased);
        warpPortal.setEntryStripProgress(t);
        // Stay in 'aligning' even after t reaches 1 — waiting for Space #3.
      }
    }

    // ── Autopilot (cinematic flythrough) ──
    // Skip idle timer during warp or title screen (title has its own 30s timer)
    if (warpEffect.isActive || splashActive || titleScreenActive) {
      // Warp, splash, or title screen is active — don't start autopilot
    } else if (flythrough.active) {
      // Flythrough runs whether autoNav is active or not (manual burns use it too)
      const result = flythrough.update(deltaTime);
      if (result.travelComplete || result.orbitComplete) {
        console.log(`[FLYTHROUGH] travelComplete=${result.travelComplete}, orbitComplete=${result.orbitComplete}, state=${flythrough.state}`);
      }

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
        // Arrived at next body — unified arrival: approach → slow orbit
        const body = flythrough._travelToBody;
        const dist = flythrough._travelToOrbitDist || 2.0;
        const bodyR = flythrough._travelToRadius || 0.01;

        if (autoNav.isActive) {
          // Autopilot: approach → one slow orbit → advance to next body
          const stop = autoNav.getCurrentStop();
          if (stop && stop.bodyRef) {
            const upcoming = autoNav.getNextStop();
            flythrough.nextBodyRef = upcoming ? upcoming.bodyRef : null;
            flythrough.beginApproach(stop.bodyRef, stop.orbitDistance, stop.bodyRadius,
              stop.linger * settings.get('tourLingerMultiplier'));
            updateFocusFromStop(stop);
          }
        } else if (body) {
          // Manual burn: skip the approach pause and flow directly into a
          // clean circular hold orbit. Travel arrived at `dist` from the
          // body already (pre-orbit blend targets it), and beginOrbit
          // re-derives yaw/pitch from the current camera position so
          // there's no visible jump — the camera simply starts rotating.
          flythrough.beginOrbit(body, dist, bodyR, 99999, {
            slowOrbit: true,
            holdOnly: true,
          });
          _manualBurnOrbiting = true;
        } else {
          // No body (shouldn't happen) — hand to manual
          flythrough.stop();
          cameraController.bypassed = false;
          cameraController.restoreFromWorldState(camera.position.clone());
        }
      }
    } else if (!autoNav.isActive) {
      // No warp, no flythrough, no autopilot — run idle timer
      idleTimer += deltaTime;
      if (idleTimer >= settings.get('idleTimeout')) {
        _manualBurnOrbiting = false;
        startFlythrough();
      }
    }

    // Also run idle timer during manual burn orbit (flythrough active but no autoNav)
    if (_manualBurnOrbiting && !autoNav.isActive) {
      idleTimer += deltaTime;
      if (idleTimer >= settings.get('idleTimeout')) {
        _manualBurnOrbiting = false;
        startFlythrough();
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
    // Paused in portal-lab diagnostic mode (no auto-warps; player drives).
    if (_deepSkyLingerTimer >= 0 && !warpEffect.isActive && !warpTarget.turning && !splashActive && !titleScreenActive && !_portalLabMode) {
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
    // Skip during gallery mode (camera orbits the gallery object at origin)
    // Skip during WASD flight — player is moving freely, don't snap back to body
    if (!cameraController.bypassed && !galleryMode && !cameraController.isFlying) {
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

  // ── WASD free-flight input ──
  // Read held keys each frame and feed thrust direction to the camera.
  // Flight is disabled during warp, title screen, overlays, gallery, and autopilot.
  {
    const flightOk = !titleScreenActive
                   && !warpEffect.isActive
                   && !warpTarget.turning
                   && !galleryMode
                   && !autoNav.isActive
                   && !_settingsOpen
                   && !_soundTestOpen
                   && document.getElementById('keybinds-overlay')?.style.display === 'none';
    cameraController._flightEnabled = flightOk;

    if (flightOk) {
      // Use e.code values (KeyW/KeyS/etc.) — immune to Shift changing e.key case
      const fwd = (_heldKeys.has('KeyW') ? 1 : 0) - (_heldKeys.has('KeyS') ? 1 : 0);
      const right = (_heldKeys.has('KeyD') ? 1 : 0) - (_heldKeys.has('KeyA') ? 1 : 0);
      const boost = _heldKeys.has('Shift') || _heldKeys.has('ShiftLeft') || _heldKeys.has('ShiftRight');
      cameraController.setFlightInput(fwd, right, boost);
    } else {
      cameraController.setFlightInput(0, 0, false);
    }
  }

  cameraController.update(deltaTime);

  // ── Near clipping plane ──
  // Fixed at 1e-9 scene units (~15 cm at AU_TO_SCENE=1000 scale). The
  // renderer has `logarithmicDepthBuffer: true` (RetroRenderer.js), so
  // depth buffer precision stays uniform across orders of magnitude —
  // we don't need to scale near-plane with camera distance.
  //
  // Sizing: the realistic-scale audit (docs/SCALE_AUDIT.md Task 3) showed
  // that anything smaller than ~26 km diameter would be sliced by a near
  // plane at 0.0001. At 1e-9, the 20 m player ship, 100 m portal aperture,
  // and 500 m stations all render without clipping at close approach.
  // Cockpit/first-person geometry (0.5–2 m) also works.
  //
  // Log depth buffer handles near=1e-9 ↔ far=200,000 comfortably (~17 bits
  // of log range across 24-bit depth buffer).
  //
  // If camera world-coords grow past ~1e7 scene units (deep halo of the
  // galaxy), float-precision jitter becomes visible — fix that with
  // camera-origin rebasing, not a near-plane cap.
  camera.near = 1e-9;
  camera.updateProjectionMatrix();

  skyRenderer.update(camera, deltaTime);
  warpPortal.update(deltaTime);
  lodManager.update();
  debugPanel.setFocus(focusIndex, focusMoonIndex);
  debugPanel.update(deltaTime);

  if (window._warpDebugHUD) {
    const we = warpEffect;
    const sr = skyRenderer;
    const sfU = sr._starfieldLayer?.mesh.material.uniforms;
    const orU = sr._originStarfieldLayer?.mesh.material.uniforms;
    const glU = sr._glowLayer?.mesh.material.uniforms;
    const fmt = (v, d = 2) => (v ?? 0).toFixed(d);
    // Portal-camera separation along _tunnelForward, useful for debugging
    // whether the camera is actually crossing the portal planes on schedule.
    const camToPortalA = warpPortal.group.visible
      ? camera.position.distanceTo(warpPortal.group.position).toFixed(1)
      : '—';
    window._warpDebugHUD.textContent =
      'WARP DEBUG (?warpDebug)\n' +
      (_portalLabMode ? `LAB MODE — stage: ${_portalLabState}\n` : '') +
      `state:       ${we.state}  active=${we.isActive}\n` +
      `progress:    ${fmt(we.progress, 3)}\n` +
      `foldAmount:  ${fmt(we.foldAmount, 3)}\n` +
      `hyperPhase:  ${fmt(we.hyperPhase, 3)}\n` +
      '\n── Dual-portal ────────────\n' +
      `portalVisible:  ${warpPortal.group.visible}\n` +
      `traversalMode:  ${warpPortal._traversalMode}\n` +
      `cam→PortalA:    ${camToPortalA}\n` +
      `tunnelLength:   ${warpPortal._tunnelLength}\n` +
      '\n── Sky layers ─────────────\n' +
      `crossoverActive: ${sr._crossoverActive}\n` +
      `originPresent:   ${!!sr._originStarfieldLayer}\n\n` +
      `tunnelPhase sf=${fmt(sfU?.uTunnelPhase?.value)} glow=${fmt(glU?.uTunnelPhase?.value)}${orU ? ` orig=${fmt(orU.uTunnelPhase.value)}` : ''}\n` +
      `crossover   sf=${fmt(sfU?.uCrossoverAlong?.value, 0)}${orU ? ` orig=${fmt(orU.uCrossoverAlong.value, 0)}` : ''}\n` +
      `clipSide    sf=${sfU?.uClipSide?.value}${orU ? ` orig=${orU.uClipSide.value}` : ''}`;
  }

  // ── Targeting reticle (tentative hover + selected committed target) ──
  // Refresh the selected-target descriptor each frame so its name/type/
  // radius stay correct if the underlying system data changes. The mesh
  // reference stays valid; only the distance moves.
  if (_selectedTarget) {
    // The body's mesh position updates each frame — distance recomputes
    // inside the reticle renderer, so no need to rebuild the descriptor.
  }
  const burning = flythrough.active || warpEffect.isActive || warpTarget.turning;
  targetingReticle.enabled = _hudVisible && !!system && !warpEffect.isActive && !splashActive && !titleScreenActive && !galleryMode;

  // Occlusion pass: reticles draw on a 2D overlay and don't share the depth
  // buffer, so we analytically test each candidate reticle against the
  // occluder list (visible planets/moons/stars built in the LOD loop above).
  // Any reticle whose target is behind a visible body is dropped from the
  // update — makes "see reticles through a planet" go away.
  _visibleGhostTargets.length = 0;
  for (let i = 0; i < _ghostTargets.length; i++) {
    const g = _ghostTargets[i];
    if (!_isReticleOccluded(g)) _visibleGhostTargets.push(g);
  }
  // Allow hover reticles during flythrough so you can preview targets
  // without stopping autopilot. Only suppress during warp/turn.
  const suppressHover = warpEffect.isActive || warpTarget.turning;
  const _hoverForReticle = (suppressHover || !_hoverTarget || _isReticleOccluded(_hoverTarget)) ? null : _hoverTarget;
  const _selectedForReticle = (_selectedTarget && !_isReticleOccluded(_selectedTarget)) ? _selectedTarget : null;

  targetingReticle.update({
    hoverTarget: _hoverForReticle,
    selectedTarget: _selectedForReticle,
    ghostTargets: _visibleGhostTargets,
  });
  _updateCommitBurnButton();

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

  retroRenderer.setTime(timer.getElapsed());
  retroRenderer.render();
}

// ── Handle Window Resize ──
window.addEventListener('resize', () => retroRenderer.resize());

// ── Keyboard shortcuts ──
window.addEventListener('keydown', (e) => {
  _heldKeys.add(e.key);
  // Also track e.code so WASD works reliably regardless of Shift state
  _heldKeys.add(e.code);

  // K key: toggle keybinds overlay (works always — title, gameplay, warp)
  if (e.code === 'KeyK') {
    toggleKeybinds();
    return;
  }

  // Down arrow: toggle debug inspection panel
  if (e.code === 'ArrowDown' && !galleryMode) {
    debugPanel.togglePanel();
    return;
  }

  // Backtick key: toggle debug HUD (corner overlay)
  if (e.code === 'Backquote') {
    debugPanel.toggleHUD();
    return;
  }

  // P key: toggle settings panel (was S — moved to free WASD for movement)
  if (e.code === 'KeyP' && !titleScreenActive) {
    toggleSettings();
    return;
  }

  // N key: toggle nav computer (blocked during warp). Shift+N is debug respawn.
  if (e.code === 'KeyN' && !e.shiftKey && !titleScreenActive && !warpEffect.isActive) {
    toggleNavComputer();
    return;
  }

  // T key: toggle sound test panel (works always except title screen)
  if (e.code === 'KeyT' && !titleScreenActive) {
    toggleSoundTest();
    return;
  }

  // X key: toggle Pretext Lab (text rendering experiments)
  if (e.code === 'KeyX' && !titleScreenActive) {
    togglePretextLab();
    return;
  }

  // Escape closes keybinds, settings, sound test, or debug overlay if open
  if (e.code === 'Escape') {
    if (debugPanel.isPanelVisible) {
      debugPanel.togglePanel();
      return;
    }
    if (_pretextLabOpen) {
      togglePretextLab();
      return;
    }
    if (_soundTestOpen) {
      toggleSoundTest();
      return;
    }
    if (_navComputerOpen) {
      if (_navComputer && _navComputer.handleEscape()) return; // back one level
      toggleNavComputer(); // close if already at galaxy level
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
    // Nothing else to dismiss: use Escape to deselect the current target
    if (_selectedTarget) {
      deselectTarget();
      return;
    }
  }

  // Block all input during splash/intro sequence
  if (splashActive) return;

  // Title screen: game keys dismiss (ignore F-keys, modifier-only, browser keys)
  if (titleScreenActive) {
    const ignore = e.key.startsWith('F') || e.key === 'Meta' || e.key === 'Alt'
      || e.key === 'Control' || e.key === 'Shift' || e.key === 'CapsLock'
      || e.key === 'Tab' || e.key === 'NumLock' || e.key === 'ScrollLock';
    if (!ignore) {
      dismissTitleScreen();
      return;
    }
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

  // Shift+B: test baked textures on the focused planet
  if (e.shiftKey && e.code === 'KeyB' && system) {
    if (!textureBaker) {
      textureBaker = new TextureBaker(retroRenderer.renderer);
    }
    // Find the focused planet or default to first
    let targetEntry = system.planets[0];
    if (focusIndex >= 0 && focusIndex < system.planets.length) {
      targetEntry = system.planets[focusIndex];
    }
    const pd = targetEntry.planet.data;
    const bakeType = getBakeType(pd.type, false);
    const seed = pd.noiseScale * 100 + (pd.baseColor?.[0] ?? 0.5) * 1000;
    console.log(`[TextureBaker] Baking type=${pd.type} (bakeType=${bakeType}), seed=${seed.toFixed(1)}`);
    const baked = textureBaker.bake(seed, {
      noiseScale: pd.noiseScale ?? 4.0,
      bodyType: bakeType,
      baseColor: pd.baseColor,
      accentColor: pd.accentColor,
      noiseDetail: pd.noiseDetail ?? 0.5,
    });
    // Create a textured material and swap it onto the planet surface
    const surface = targetEntry.planet.surface || targetEntry.planet.mesh;
    if (surface) {
      const starInfo = system.starInfo;
      const lightDir = targetEntry.planet._lightDir || new THREE.Vector3(1, 0, 0);
      const lightDir2 = targetEntry.planet._lightDir2 || null;
      const bakedMat = createTexturedBodyMaterial({
        lightDir,
        lightDir2,
        starInfo,
        heightScale: 0.06,
        posterizeLevels: 8.0,
        ditherEdgeWidth: 0.5,
      });
      // Wire baked textures
      bakedMat.uniforms.diffuseMap.value = baked.diffuseMap;
      bakedMat.uniforms.heightMap.value = baked.heightMap;
      bakedMat.uniforms.hasTextures.value = 1.0;
      bakedMat.uniforms.hasHeightMap.value = 1.0;
      surface.material = bakedMat;
      console.log('[TextureBaker] Swapped to baked texture material');
    }
    return;
  }

  // Old Shift+number and Shift+letter debug shortcuts removed.
  // All debug spawning/teleporting is now handled via the debug panel (Down Arrow key).

  // G key: toggle debug gallery (was D — moved to free WASD for movement)
  if (e.code === 'KeyG') {
    if (galleryMode) {
      exitGallery();
    } else {
      enterGallery();
    }
    return;
  }

  // H key: HUD master toggle — hides brackets, body-info printout, BURN
  // button, and minimap all at once. Works in both normal and autopilot
  // modes (placed above the autopilot branch). Camera/selection state
  // is preserved; it's purely visual.
  if (e.code === 'KeyH') {
    _hudVisible = !_hudVisible;
    _applyHudVisibility();
    return;
  }

  // Gallery mode: arrow keys cycle types/seeds
  if (galleryMode) {
    if (e.code === 'ArrowRight') {
      gallerySeed++;
      _gallerySkipDir = 1;
      gallerySpawn();
    } else if (e.code === 'ArrowLeft') {
      gallerySeed = Math.max(1, gallerySeed - 1);
      _gallerySkipDir = -1;
      gallerySpawn();
    } else if (e.code === 'ArrowUp') {
      galleryTypeIdx = (galleryTypeIdx + 1) % GALLERY_TYPES.length;
      gallerySeed = 1;
      gallerySpawn();
    } else if (e.code === 'ArrowDown') {
      galleryTypeIdx = (galleryTypeIdx - 1 + GALLERY_TYPES.length) % GALLERY_TYPES.length;
      gallerySeed = 1;
      gallerySpawn();
    }
    return;  // Block all other input in gallery mode
  }

  // Block all input during warp transition or pre-warp turn
  if (warpEffect.isActive || warpTarget.turning) return;

  // Shift+W: DEBUG — enter portal test mode (or exit if already in)
  // Then SPACEBAR advances test phases: open portal → fly through tunnel → reset
  if (e.code === 'KeyW' && e.shiftKey) {
    if (_portalTestMode) {
      // Exit test mode, restore camera
      _portalTestMode = false;
      _portalTestPhase = 'idle';
      warpPortal.close();
      if (window._cc) window._cc.bypassed = false;
      console.log('[PORTAL TEST] Exited test mode');
    } else {
      // Enter test mode — freeze camera, prepare for spacebar control
      _portalTestMode = true;
      _portalTestPhase = 'idle';
      if (window._autoNav) window._autoNav.stop();
      if (window._cc) window._cc.bypassed = true;
      console.log('[PORTAL TEST] Entered test mode. Press SPACE to open portal.');
    }
    return;
  }

  // SPACEBAR while in portal test mode: advance phase
  if (_portalTestMode && e.code === 'Space') {
    e.preventDefault();
    if (_portalTestPhase === 'idle') {
      // Phase 1: Open portal in front of camera, freeze movement
      camera.updateMatrixWorld();
      const m = camera.matrixWorld.elements;
      const fwd = new THREE.Vector3(-m[8], -m[9], -m[10]);
      _portalTestForward.copy(fwd);
      _portalTestStartPos.copy(camera.position);
      const portalPos = camera.position.clone().addScaledVector(fwd, 30);
      warpPortal.open(portalPos, fwd);
      _portalTestPhase = 'open';
      console.log('[PORTAL TEST] Phase 1: Portal open. Press SPACE to fly through.');
    } else if (_portalTestPhase === 'open') {
      // Phase 2: Start camera flight forward through tunnel
      // Disable stencil on tunnel so it keeps rendering when camera is inside.
      // (Stencil only writes where the disc is visible; once camera passes
      //  the disc, no stencil = no tunnel. Without stencil, the cylinder
      //  is a normal mesh we fly through.)
      warpPortal._tunnel.material.stencilWrite = false;
      warpPortal._tunnel.material.needsUpdate = true;
      _portalTestPhase = 'flying';
      _portalTestFlightStart = performance.now();
      console.log('[PORTAL TEST] Phase 2: Flying through tunnel...');
    } else if (_portalTestPhase === 'flying' || _portalTestPhase === 'arrived') {
      // Phase 3: Reset
      _portalTestPhase = 'idle';
      warpPortal._tunnel.material.stencilWrite = true;  // restore stencil
      warpPortal._tunnel.material.needsUpdate = true;
      warpPortal.close();
      camera.position.copy(_portalTestStartPos);
      console.log('[PORTAL TEST] Reset. Press SPACE to open portal again, or Shift+W to exit test mode.');
    }
    return;
  }

  // Shift+N: DEBUG — spawn a fresh random star system (no warp animation).
  // Quick iteration shortcut for testing Toy Box camera / orbit / burn bugs.
  if (e.code === 'KeyN' && e.shiftKey) {
    if (galleryMode) return;
    _debugSpawnType('star-system');
    console.log('[DEBUG] Respawned random star system');
    return;
  }

  // Shift+L: DEBUG — teleport to Earth's Moon (for LOD testing)
  if (e.code === 'KeyL' && e.shiftKey) {
    console.log('Debug: teleporting to Earth\'s Moon...');

    // Step 1: Spawn the Solar System via the shared helper (sets
    // currentGalaxyStar + _currentSystemName so nav computer works).
    const solPos = { x: GalacticMap.SOLAR_R, y: GalacticMap.SOLAR_Z, z: 0.0 };
    const knownSol = KnownSystems.findAt(solPos);
    if (!knownSol) {
      console.warn('Debug: Sol not found in KnownSystems!');
      return;
    }
    _debugEnterKnownSystem(knownSol, solPos);

    // Step 2: Focus camera on Earth's Moon (Earth = index 2, Moon = index 0)
    // Use requestAnimationFrame to let the system finish spawning first
    requestAnimationFrame(() => {
      if (!system || system.planets.length < 3) {
        console.warn('Debug: Solar System spawned but Earth not found at index 2');
        return;
      }
      const earthEntry = system.planets[2]; // Earth
      if (!earthEntry.moons || earthEntry.moons.length === 0) {
        console.warn('Debug: Earth has no moons');
        return;
      }
      const moon = earthEntry.moons[0]; // The Moon
      const viewDist = moon.data.radius * 15; // ~15x radius, well within LOD2 range

      focusIndex = 2;
      focusMoonIndex = 0;
      focusStarIndex = -1;
      cameraController.focusOn(moon.mesh.position, viewDist);

      const mName = system.names?.planets?.[2]?.moons?.[0] ?? 'Moon';
      bodyInfo.showMoon(moon.data, 2, mName);
      console.log(`Debug: Camera placed near ${mName}, viewDist=${viewDist.toFixed(4)}, moonRadius=${moon.data.radius.toFixed(4)}`);
    });
    return;
  }

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

  // F key: toggle camera mode (Toy Box ↔ Flight). Desktop only.
  // Guards: no mobile (ShipCameraSystem enforces but short-circuit here),
  // no warp, no splash/title, must have a gravity field (system active).
  if (e.code === 'KeyF') {
    if (_isMobile) return;
    if (warpEffect.isActive || warpTarget.turning) return;
    if (splashActive || titleScreenActive) return;
    // Deep sky scenes don't have flight. Flight requires a star system.
    if (!system || system._navigable || (system.type && system.type !== 'star-system')) {
      console.log('[MODE] Flight mode unavailable — no star system');
      return;
    }
    const newMode = cameraController.toggleCameraMode();
    console.log(`[MODE] Camera → ${newMode}`);
    return;
  }

  // Q key: toggle autopilot (was A — moved to free WASD for movement)
  if (e.code === 'KeyQ') {
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
    // WASD: stop autopilot and take manual control
    if (e.code === 'KeyW' || e.code === 'KeyA' || e.code === 'KeyS' || e.code === 'KeyD') {
      stopFlythrough();
      return;
    }
    if (e.code === 'Space') {
      e.preventDefault();
      // Universal commit — burns the in-system selection OR warps, whichever
      // is set. In autopilot this also stops the flythrough via commitBurn.
      commitSelection();
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
    // O, V still work normally during autopilot
    if (e.code === 'KeyO') toggleOrbits();
    if (e.code === 'KeyV') toggleGravityWell();
    return;
  }

  // Normal mode (autopilot off) — reset idle timer and cancel auto-warp
  idleTimer = 0;
  _deepSkyLingerTimer = -1;

  if (e.code === 'Space') {
    e.preventDefault();
    // Universal commit — in-system selection → burn; warp target → warp;
    // nothing → no-op.
    commitSelection();
  } else if (e.code === 'Escape' || e.code === 'Backquote') {
    focusPlanet(-1);
  } else if (e.code === 'Tab') {
    e.preventDefault();
    if (!system) return;
    const n = system.planets.length;
    if (n === 0) return; // no planets to cycle through
    if (e.shiftKey) {
      focusPlanet(focusIndex <= 0 ? n - 1 : focusIndex - 1);
    } else {
      focusPlanet((focusIndex + 1) % n);
    }
  } else if (e.code === 'KeyO') {
    toggleOrbits();
  } else if (e.code === 'KeyV') {
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
  _heldKeys.delete(e.code);
});

// Clear all held keys when window loses focus — prevents WASD getting "stuck"
window.addEventListener('blur', () => {
  _heldKeys.clear();
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
        if (autoNav.isActive && flythrough.active) {
          // During autopilot: jump to the selected body and immediately
          // begin travel (interrupt current orbit/travel).
          let stop = null;
          if (hit.type === 'star') {
            stop = autoNav.jumpToStar();
          } else if (hit.type === 'planet') {
            stop = autoNav.jumpToPlanet(hit.planetIndex);
          }
          if (stop && stop.bodyRef) {
            flythrough.beginTravel(stop.bodyRef, stop.orbitDistance, stop.bodyRadius);
            const upcoming = autoNav.getNextStop();
            flythrough.nextBodyRef = upcoming ? upcoming.bodyRef : null;
            updateFocusFromStop(stop);
          }
          // Update minimap focus ring
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

  // 1. Try in-system body picking (forgiving screen-space).
  // This takes priority over the starfield so clicking near a billboarded
  // planet doesn't fall through to "nearest background star".
  const bodyHit = hitTestBodies(clientX, clientY);
  if (bodyHit) {
    selectTarget(bodyHit);
    return;
  }

  // 1b. Try orbit lines (screen-space distance check)
  const orbitHit = hitTestOrbits(clientX, clientY, 6);
  if (orbitHit) {
    let target = null;
    if (orbitHit.info.type === 'planet') {
      target = _makeTarget('planet', { planetIndex: orbitHit.info.planetIndex });
    } else if (orbitHit.info.type === 'moon') {
      target = _makeTarget('moon', {
        planetIndex: orbitHit.info.planetIndex,
        moonIndex: orbitHit.info.moonIndex,
      });
    }
    if (target) selectTarget(target);
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
 *
 * The clicked point may be:
 * - A real GalacticMap star → warp to that star system
 * - A tagged galactic feature → warp to a star inside it (Category A/B)
 * - A background star → generate system from direction
 * The destType is stored on warpTarget so onPrepareSystem can route correctly.
 */
function trySelectWarpTarget(rayDir) {
  const result = starfield.findNearestStar(rayDir);
  if (!result) return; // no star close enough to the click

  // Single-selection invariant: picking a background star cancels any
  // in-system body selection so Space commits the warp rather than a
  // stale body burn.
  if (_selectedTarget) deselectTarget();

  soundEngine.play('warpTarget');
  warpTarget.direction = result.direction;
  warpTarget.starIndex = result.index;
  warpTarget.destType = null; // default: normal star system

  // Resolve star data NOW (before starfield regeneration invalidates the index)
  const entry = skyRenderer.getEntryForIndex(result.index);
  if (entry?.starData) {
    warpTarget.navStarData = entry.starData;
    // Ensure type is present (hash grid stars have it; real catalog stars need estimatedType fallback)
    if (!warpTarget.navStarData.type && entry.estimatedType) {
      warpTarget.navStarData.type = entry.estimatedType;
    }
  } else {
    warpTarget.navStarData = null;
  }

  // Extract galactic position from star data for region-aware naming
  const starPos = entry?.starData ? { x: entry.starData.worldX, y: entry.starData.worldY, z: entry.starData.worldZ } : null;

  if (entry?.isFeature) {
    // Clicked a galactic feature — route to a star inside it
    warpTarget.destType = `feature:${entry.featureType}`;
    warpTarget.featureData = entry.featureData;
    const nameRng = new SeededRandom(`feat-${entry.featureData.seed}`);
    warpTarget.name = generateSystemName(nameRng.child('names').child('system'), starPos);
    bodyInfo.showWarpTarget(`${warpTarget.name} (${entry.featureType.replace('-', ' ')})`);
  } else if (entry?.isExternalGalaxy) {
    // Clicked an external galaxy — Category C destination
    warpTarget.destType = 'external-galaxy';
    warpTarget.galaxyData = entry.galaxyData;
    warpTarget.name = entry.galaxyData.name;
    bodyInfo.showWarpTarget(`${entry.galaxyData.name} (${entry.galaxyData.type} galaxy)`);
  } else {
    // Normal star — generate name from index
    const nameRng = new SeededRandom(`warp-star-${result.index}`);
    warpTarget.name = generateSystemName(nameRng.child('names').child('system'), starPos);
    bodyInfo.showWarpTarget(warpTarget.name);
  }

  warpTarget.blinkTimer = 0;
  warpTarget.blinkOn = true;
}

/**
 * Auto-select a random visible star as warp target (screensaver mode).
 * Picks from the forward hemisphere so the brackets appear on-screen.
 */
/**
 * Auto-select a random visible star as warp target (screensaver mode).
 * Uses the same routing pipeline as manual clicks — the randomly
 * selected point might be a star, a galactic feature, or (rarely)
 * an external galaxy. destType is set so onPrepareSystem routes correctly.
 */
function autoSelectWarpTarget() {
  camera.getWorldDirection(_starRayDir);
  const result = starfield.getRandomVisibleStar(_starRayDir);
  if (!result) return;

  warpTarget.direction = result.direction;
  warpTarget.starIndex = result.index;
  warpTarget.destType = null;
  warpTarget.featureData = null;
  warpTarget.galaxyData = null;

  // Resolve star data NOW (before starfield regeneration invalidates the index).
  // Store as navStarData so warp resolution uses it directly.
  const entry = skyRenderer.getEntryForIndex(result.index);
  if (entry?.starData) {
    warpTarget.navStarData = entry.starData;
    // Ensure type is present (hash grid stars have it; real catalog stars need estimatedType fallback)
    if (!warpTarget.navStarData.type && entry.estimatedType) {
      warpTarget.navStarData.type = entry.estimatedType;
    }
  } else {
    warpTarget.navStarData = null;
  }

  // Extract galactic position for region-aware naming
  const autoStarPos = entry?.starData ? { x: entry.starData.worldX, y: entry.starData.worldY, z: entry.starData.worldZ } : null;

  if (entry?.isFeature) {
    warpTarget.destType = `feature:${entry.featureType}`;
    warpTarget.featureData = entry.featureData;
    const nameRng = new SeededRandom(`feat-${entry.featureData.seed}`);
    warpTarget.name = generateSystemName(nameRng.child('names').child('system'), autoStarPos);
  } else if (entry?.isExternalGalaxy) {
    warpTarget.destType = 'external-galaxy';
    warpTarget.galaxyData = entry.galaxyData;
    warpTarget.name = entry.galaxyData.name;
  } else {
    const nameRng = new SeededRandom(`warp-star-${result.index}`);
    warpTarget.name = generateSystemName(nameRng.child('names').child('system'), autoStarPos);
  }

  warpTarget.blinkTimer = 0;
  warpTarget.blinkOn = true;
}
window._autoSelectWarpTarget = autoSelectWarpTarget;  // DEBUG

/**
 * Begin the pre-warp camera turn. If a warp target is selected,
 * the camera slerps to face it first (brackets go solid = "locked on").
 * Once aligned, the warp fires. If no target, warp starts immediately.
 */
function beginWarpTurn() {
  if (warpEffect.isActive) return;   // already warping
  if (warpTarget.turning) return;    // already turning
  if (!_portalLabMode) soundEngine.play('warpLockOn');

  // Kill any WASD flight momentum before warping
  cameraController.killFlightVelocity();

  // Cancel deep sky linger timer (we're warping now)
  _deepSkyLingerTimer = -1;

  if (!warpTarget.direction) {
    // No target set — pick a real hash grid star before warping
    autoSelectWarpTarget();
    if (!warpTarget.direction) {
      // Still no target (no visible stars?) — abort warp
      console.warn('[WARP] No star found for warp — aborting');
      return;
    }
  }

  // Stop flythrough camera — we're taking direct control for the turn.
  // autoNav stays active (warpRevealSystem rebuilds it for the new system).
  if (flythrough.active) flythrough.stop();
  cameraController.bypassed = true;
  warpTarget.turning = true;
  warpTarget.turnTimer = 0;
  warpTarget.lockBlinkFrames = 0;
}
window._beginWarpTurn = beginWarpTurn;  // DEBUG

// Idle tracking — any mouse movement resets idle timer (but no free-look)
canvas.addEventListener('mousemove', (e) => {
  // Sky debug free-look: drag to rotate camera
  if (window._skyDebug && e.buttons === 1) {
    window._skyYaw -= (e.movementX || 0) * 0.003;
    window._skyPitch += (e.movementY || 0) * 0.003;
    window._skyPitch = Math.max(-Math.PI * 0.49, Math.min(Math.PI * 0.49, window._skyPitch));
    return;
  }
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

  // ── In-system body hover (tentative reticle) ──
  // Runs regardless of orbit line hover (it's a separate overlay).
  if (system && !warpEffect.isActive && !galleryMode) {
    const bodyHit = hitTestBodies(e.clientX, e.clientY);
    // Don't show tentative reticle on the currently selected target —
    // the selected reticle already covers it, and stacking both is noisy.
    if (bodyHit && _selectedTarget && _isSameTarget(bodyHit, _selectedTarget)) {
      _hoverTarget = null;
    } else {
      _hoverTarget = bodyHit;
    }
    // Cursor feedback: pointer when we can click a body
    if (bodyHit) canvas.style.cursor = 'pointer';
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
  if (splashActive) return;
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
  // Left-click drag turns off autopilot/manual-burn-orbit (but not during
  // warp, turn, or deep sky free-look). In FLIGHT mode, mouse drag only
  // adds a look offset — flythrough keeps running. Only WASD / explicit
  // toggle stops flythrough in Flight.
  //
  // Deferred to mouseup: clicking a target (within 5px of mousedown)
  // selects it without stopping autopilot. Only drag (> 5px movement)
  // stops autopilot. Flag is set here and checked at mouseup.
  _autopilotClickPending = e.button === 0
      && (autoNav.isActive || _manualBurnOrbiting)
      && !warpEffect.isActive && !warpTarget.turning
      && !cameraController.forceFreeLook
      && cameraController.cameraMode !== CameraMode.FLIGHT;
  if (!autoNav.isActive) {
    idleTimer = 0;
    _deepSkyLingerTimer = -1;
  }
});

// Scroll wheel resets idle timer.
// In TOY_BOX, wheel kills autopilot (old behavior). In FLIGHT, wheel
// just changes chase distance (handled inside ShipCameraSystem) and
// leaves the autopilot tour running.
canvas.addEventListener('wheel', () => {
  if ((autoNav.isActive || _manualBurnOrbiting)
      && cameraController.cameraMode !== CameraMode.FLIGHT) {
    stopFlythrough();
  }
  idleTimer = 0;
  _deepSkyLingerTimer = -1;
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
  const isDrag = dx * dx + dy * dy > 25;

  if (_autopilotClickPending) {
    _autopilotClickPending = false;
    if (isDrag) {
      // Intentional drag during autopilot → stop autopilot
      stopFlythrough();
    } else {
      // Simple click during autopilot → select target, keep flying
      trySelect(e.clientX, e.clientY);
    }
    return;
  }

  if (isDrag) return;
  trySelect(e.clientX, e.clientY);
});

// Touch tap (single tap = select, double tap = new system)
let _lastTapTime = 0;
const _touchStart = { x: 0, y: 0 };

canvas.addEventListener('touchstart', (e) => {
  if (splashActive) return;
  if (titleScreenActive) { dismissTitleScreen(); return; }
  if (e.touches.length === 1) {
    _touchStart.x = e.touches[0].clientX;
    _touchStart.y = e.touches[0].clientY;
  }
  // Stop autopilot or manual-burn-orbit on tap (matches mousedown behavior
  // for desktop). Mobile is always Toy Box, so no Flight-mode carve-out needed.
  if ((autoNav.isActive || _manualBurnOrbiting) && !warpEffect.isActive && !warpTarget.turning && !cameraController.forceFreeLook) {
    stopFlythrough();
    // Update the speed dial button state
    const autonBtn = mobileControls?.querySelector('[data-action="autonav"]');
    if (autonBtn) autonBtn.classList.remove('active');
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

// ── Mobile Controls (bottom dock + FAB speed dial) ──
const mobileControls = document.getElementById('mobile-controls');
if (mobileControls) {
  const fab = mobileControls.querySelector('.mobile-fab');
  const gyroBtn = mobileControls.querySelector('[data-action="gyro"]');

  // FAB toggle
  fab.addEventListener('touchend', (e) => {
    e.preventDefault();
    e.stopPropagation();
    fab.classList.toggle('open');
  });

  // Close speed dial when tapping outside
  document.addEventListener('touchstart', (e) => {
    if (!fab.classList.contains('open')) return;
    if (e.target.closest('.mobile-fab') || e.target.closest('.mobile-speed-dial')) return;
    fab.classList.remove('open');
  });

  // Shared handler for dock and speed dial buttons
  function handleMobileAction(e) {
    e.preventDefault();
    e.stopPropagation();
    const btn = e.target.closest('button');
    if (!btn || btn === fab) return;

    const action = btn.dataset.action;
    if (action === 'warp') {
      autoSelectWarpTarget();
      beginWarpTurn();
    } else if (action === 'nav') {
      if (_navComputerOpen) closeNavComputer();
      else openNavComputer();
    } else if (action === 'autonav-toggle') {
      if (autoNav.isActive) {
        stopFlythrough();
        btn.classList.remove('active');
      } else if (system) {
        idleTimer = 0;
        startFlythrough();
        btn.classList.add('active');
      }
    } else if (action === 'prev') {
      // Cycle through all bodies in autopilot order (star → planets → moons)
      if (!system) return;
      if (autoNav.isActive && flythrough.active) {
        const stop = autoNav.advance(-1);
        if (stop?.bodyRef) {
          flythrough.beginTravel(stop.bodyRef, stop.orbitDistance, stop.bodyRadius);
          updateFocusFromStop(stop);
        }
      } else {
        const n = system.planets.length;
        if (n === 0) return;
        focusPlanet(focusIndex <= 0 ? n - 1 : focusIndex - 1);
      }
    } else if (action === 'next') {
      if (!system) return;
      if (autoNav.isActive && flythrough.active) {
        const stop = autoNav.advance(1);
        if (stop?.bodyRef) {
          flythrough.beginTravel(stop.bodyRef, stop.orbitDistance, stop.bodyRadius);
          updateFocusFromStop(stop);
        }
      } else {
        const n = system.planets.length;
        if (n === 0) return;
        focusPlanet((focusIndex + 1) % n);
      }
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
      // State updated by fullscreenchange listener
    } else if (action === 'settings') {
      toggleSettings();
      fab.classList.remove('open'); // close speed dial when opening settings
    }
  }

  // Listen on dock and speed dial
  const dock = mobileControls.querySelector('.mobile-dock');
  const speedDial = mobileControls.querySelector('.mobile-speed-dial');
  if (dock) dock.addEventListener('touchend', handleMobileAction);
  if (speedDial) speedDial.addEventListener('touchend', handleMobileAction);

  // Update fullscreen button state when fullscreen changes
  const onFsChange = () => {
    const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
    const fsBtn = mobileControls.querySelector('[data-action="fullscreen"]');
    if (fsBtn) fsBtn.classList.toggle('active', isFs);
  };
  document.addEventListener('fullscreenchange', onFsChange);
  document.addEventListener('webkitfullscreenchange', onFsChange);
}

// ── Start ──
// Pre-compile all shaders for meshes currently in the scene — includes
// the hidden WarpPortal group (discs, rims, tunnel, entry/landing strips),
// the title-screen deep sky, HashGrid starfield, and any HUD meshes.
// Without this, the first warp stalls ~1 second compiling the portal +
// tunnel shaders on first render. `compile()` iterates scene.traverse
// and compiles materials regardless of visibility flag.
//
// Note: this only covers shaders for objects that EXIST in the scene
// right now. The destination star system's planet/moon/star shaders are
// compiled when spawnSystem creates those meshes — that's a separate
// stall tracked in `well-dipper-progress.md` and addressed by moving
// GPU work into the FOLD phase (onPrepareSystem), not here.
retroRenderer.renderer.compile(scene, camera);
animate();
console.log('Well Dipper — Star System');
console.log('Controls: Space=new system, Tab=next planet, 1-9=planet#, Esc=overview, O=orbits, G=gravity wells, H=toggle HUD, A=autopilot, Middle-click=free look, Click/tap=select');
