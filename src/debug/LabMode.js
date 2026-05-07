// ────────────────────────────────────────────────────────────────────────
// LabMode — dev-tooling keybind layer (welldipper-lab-mode-2026-05-05).
//
// This module is dev tooling, not authored player experience. It ships
// keybinds gated behind URL param ?lab=1 that teleport Max to deterministic
// test scenarios for interactive felt-experience evaluation. Implements the
// well-dipper side of the lab-modes-not-recordings rule
// (~/.claude/projects/-home-ax/memory/feedback_lab-modes-not-recordings.md).
//
// Brief: docs/WORKSTREAMS/welldipper-lab-mode-2026-05-05.md
// Replaces: the Shift+L stub block in main.js (lines ~7399-7412 pre-shipping).
//
// Discipline (per brief Drift risk #4 "lab-mode permanence"):
// Scenario functions read from production state via the documented
// window._* debug surfaces ONLY; they do NOT mutate production state via
// private fields, monkey-patches, or direct module imports of internal
// types. If a scenario needs setup that the public debug surface doesn't
// expose, ADD it to the debug surface (in main.js with explicit window._*
// exposure) — do NOT reach around the surface.
//
// Per feedback_build-dev-shortcuts.md: the LAB itself is intentional
// persistent tooling, but individual ad-hoc one-off scenarios are NOT —
// new scenarios go in the brief, get scoped, get shipped through the same
// lab module. No "let me add a quick Shift+8 for this debug" creep.
// ────────────────────────────────────────────────────────────────────────

import { takeSceneInventory } from 'motion-test-kit/adapters/three/scene-inventory';
import { createOverlayRegistry } from 'motion-test-kit/adapters/dom/overlay-registry';

const SCENARIOS = [
  null, // 1-indexed
  { id: 1, key: 'Shift+1', name: 'Warp from Sol' },
  { id: 2, key: 'Shift+2', name: 'Warp from far (>=10k units)' },
  { id: 3, key: 'Shift+3', name: 'Mid-CRUISE on autopilot leg' },
  { id: 4, key: 'Shift+4', name: 'Mid-HYPER warp tunnel' },
  { id: 5, key: 'Shift+5', name: 'Manual-flight mode (autopilot off)' },
  { id: 6, key: 'Shift+6', name: 'STATION-A hold' },
  { id: 7, key: 'Shift+7', name: 'Reticle/runway-persist reproducer' },
];

let _initialized = false;
let _initOpts = null;
let _overlayRegistry = null;
let _hudEl = null;
let _hudVisible = true;

/** True when ?lab=1 is in URL. Caller (main.js) checks this before importing. */
export function isLabModeEnabled() {
  if (typeof location === 'undefined') return false;
  return new URLSearchParams(location.search).has('lab');
}

/**
 * Initialize lab-mode. Called once at boot from main.js when ?lab=1 is set.
 *
 * @param {object} opts
 * @param {object} opts.scene             three.js Scene (for scene-inventory).
 * @param {object} opts.camera            three.js Camera.
 * @param {object} [opts.composer]        EffectComposer (optional).
 * @param {object} [opts.renderer]        WebGLRenderer (optional).
 * @param {object} [opts.overlayIds]      { id: cssSelector } overlay registrations.
 *                                        Default registers reticle/HUD/keybinds-panel/lab-hud.
 */
export function init(opts) {
  if (_initialized) return;
  _initOpts = opts || {};

  // Build overlay registry — register the four most-load-bearing DOM overlays.
  // Host can extend via opts.overlayIds.
  _overlayRegistry = createOverlayRegistry();
  const defaults = {
    'targeting-overlay': '#targeting-overlay',
    'hud': '#hud',
    'keybinds-panel': '#keybinds-overlay',
    'lab-hud': '#lab-hud',
    ...(opts?.overlayIds || {}),
  };
  for (const [id, sel] of Object.entries(defaults)) {
    _overlayRegistry.register(id, sel);
  }

  // Build HUD overlay.
  _buildHud();

  // Expose programmatic API on window for Tester invocation + console use.
  if (typeof window !== 'undefined') {
    window._labMode = {
      runScenario,
      toggleHud,
      lastEntrySnapshot: null,
      scenarios: SCENARIOS.filter(Boolean),
      _overlayRegistry,
    };
  }

  _initialized = true;
}

function _buildHud() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('lab-hud')) return; // idempotent
  const el = document.createElement('div');
  el.id = 'lab-hud';
  el.style.cssText = [
    'position:fixed', 'top:12px', 'right:12px', 'z-index:99999',
    'padding:10px 14px', 'background:rgba(0,0,0,0.82)',
    'border:1px solid #0f0', 'color:#0f0',
    'font:11px/1.6 "Courier New", monospace',
    'min-width:280px', 'pointer-events:none',
    'border-radius:3px',
  ].join(';');
  const lines = [
    '<b>LAB MODE</b> &mdash; ?lab=1 active',
    ...SCENARIOS.filter(Boolean).map((s) => `${s.key} &mdash; ${s.name}`),
    'Shift+L &mdash; Toggle this overlay',
  ];
  el.innerHTML = lines.join('<br>');
  document.body.appendChild(el);
  _hudEl = el;
  _hudVisible = true;
}

/** Show / hide the HUD overlay. */
export function toggleHud() {
  if (!_hudEl) return;
  _hudVisible = !_hudVisible;
  _hudEl.style.display = _hudVisible ? 'block' : 'none';
}

// ─── Snapshot capture (AC #3) ────────────────────────────────────────────

/**
 * Capture a structural snapshot at scenario entry. Tries the kit's
 * scene-inventory path first; falls back to telemetry-only structural
 * fields when the kit isn't available or throws.
 *
 * Stored on window._labMode.lastEntrySnapshot. Dispatches
 * 'labmode:scenarioReady' custom event on window.
 *
 * @param {string} scenarioName
 * @returns {object} the snapshot
 */
export function captureEntrySnapshot(scenarioName) {
  const snap = {
    scenarioName,
    timestamp: Date.now(),
    via: 'unknown',
    inventory: null,
    fallback: null,
  };

  // Forward-dependency-aware path: kit's scene-inventory technique #6.
  if (_initOpts?.scene && _initOpts?.camera && typeof takeSceneInventory === 'function') {
    try {
      snap.inventory = takeSceneInventory({
        scene: _initOpts.scene,
        camera: _initOpts.camera,
        composer: _initOpts.composer,
        renderer: _initOpts.renderer,
        overlayRegistry: _overlayRegistry,
      });
      snap.via = 'scene-inventory';
    } catch (e) {
      snap.via = 'fallback (scene-inventory threw)';
      snap.inventoryError = String(e?.message || e);
    }
  } else {
    snap.via = 'fallback (kit/scene/camera unavailable)';
  }

  // Telemetry-only fallback (always populated alongside; consumer can use either path).
  snap.fallback = {
    autopilot: _safeRead(() => ({
      shipPhase: window._autopilotMotion?._phase ?? null,
      isActive: !!window._autopilotMotion?.isActive,
      enabled: !!window._autopilotEnabled,
      autoNavActive: !!window._autoNav?.isActive,
      // V1 motion controller's body-lock surface. navSubsystem.bodyRef
      // is the legacy-nav-driven surface and stays null in V1 mode;
      // _autopilotMotion._target is V1. Capture identity (name may be
      // empty for auto-generated planet meshes) + existence + position
      // so predicates can verify body lock structurally.
      targetBodyName: window._autopilotMotion?._target?.name ?? null,
      targetBodyExists: !!window._autopilotMotion?._target,
      targetBodyPos: (() => {
        const t = window._autopilotMotion?._target;
        if (!t?.position) return null;
        return { x: t.position.x, y: t.position.y, z: t.position.z };
      })(),
      lastTelemetry: window._autopilot?.telemetry?.samples?.at?.(-1) ?? null,
    })),
    warp: _safeRead(() => ({
      state: window._warpEffect?.state ?? null,
      foldAmount: window._warpEffect?.foldAmount ?? null,
      starBrightness: window._warpEffect?.starBrightness ?? null,
      sceneFade: window._warpEffect?.sceneFade ?? null,
      exitReveal: window._warpEffect?.exitReveal ?? null,
      progress: window._warpEffect?.progress ?? null,
    })),
    nav: _safeRead(() => ({
      bodyRefName: window._navSubsystem?.bodyRef?.name ?? null,
      currentSystemName: window._currentSystemName ?? null,
    })),
    overlays: _overlayRegistry ? _overlayRegistry.snapshot() : null,
    state: _safeRead(() => window._getState?.()),
    shipWorld: _safeRead(() => {
      // window._cam is the camera (debug-exposed in main.js:126). Camera is
      // NOT in scene.children. Read it directly.
      const cam = window._cam;
      return cam?.position ? { x: cam.position.x, y: cam.position.y, z: cam.position.z } : null;
    }),
  };

  if (typeof window !== 'undefined') {
    if (window._labMode) window._labMode.lastEntrySnapshot = snap;
    try {
      window.dispatchEvent(new CustomEvent('labmode:scenarioReady', { detail: snap }));
    } catch { /* no CustomEvent in some hosts; non-fatal */ }
  }

  return snap;
}

function _safeRead(fn) {
  try { return fn(); } catch { return null; }
}

// ─── Phase 2 — scenario implementations ──────────────────────────────────
//
// Each scenario uses the documented window._lab debug surface in main.js
// + window._autoNav / _warpEffect / _autopilotMotion exposures. Async
// scenarios poll for state convergence via _waitFor; the snapshot capture
// fires AFTER state has converged (or after timeout, whichever first).

const DEFAULT_TIMEOUT_MS = 4000;
const POLL_MS = 50;

/**
 * Poll predicate at POLL_MS intervals; resolve when truthy or after timeoutMs.
 * Resolves regardless — never rejects, so callers can capture a snapshot
 * even if the scenario didn't fully converge (the snapshot itself captures
 * what state IS, not what the scenario hoped for).
 *
 * @returns {Promise<{ converged: boolean, elapsedMs: number }>}
 */
function _waitFor(predicate, timeoutMs = DEFAULT_TIMEOUT_MS) {
  return new Promise((resolve) => {
    const t0 = performance.now();
    const tick = () => {
      let ok = false;
      try { ok = !!predicate(); } catch { ok = false; }
      if (ok) { resolve({ converged: true, elapsedMs: performance.now() - t0 }); return; }
      if (performance.now() - t0 >= timeoutMs) {
        resolve({ converged: false, elapsedMs: performance.now() - t0 });
        return;
      }
      setTimeout(tick, POLL_MS);
    };
    tick();
  });
}

/**
 * Lock an autopilot tour-stop without starting motion. Returns the planet
 * index used (0 = first planet) or null if no planets available.
 */
function _lockFirstPlanet() {
  const sysInfo = window._lab?.systemInfo?.();
  if (!sysInfo?.planetCount) return null;
  if (typeof window._autoNav?.jumpToPlanet === 'function') {
    try { window._autoNav.jumpToPlanet(0); } catch { /* may fail if autopilot inactive */ }
  }
  return 0;
}

export async function setupScenario1Sol() {
  // Warp-from-Sol: Sol loaded, autopilot tour active locked on first
  // planet (Earth in Sol's planet sequence), ship near origin, warp idle.
  // jumpToPlanet is a no-op when autoNav is inactive — start the tour
  // first so the body lock takes effect. Max presses Space to initiate
  // the warp.
  if (typeof window._lab?.enterSol !== 'function') {
    console.warn('[LabMode] scenario 1: window._lab.enterSol unavailable');
    return captureEntrySnapshot('warp-from-sol');
  }
  window._lab.enterSol();
  await _waitFor(() => window._lab.isInSystem());
  if (typeof window._lab?.beginAutopilotTour === 'function') {
    window._lab.beginAutopilotTour();
  }
  await _waitFor(() => window._autoNav?.isActive === true, 2000);
  if (typeof window._autoNav?.jumpToPlanet === 'function') {
    try { window._autoNav.jumpToPlanet(0); } catch (e) {
      console.warn('[LabMode] scenario 1: jumpToPlanet(0) threw -', e);
    }
  }
  await _waitFor(() => !!window._navSubsystem?.bodyRef, 2000);
  return captureEntrySnapshot('warp-from-sol');
}

export async function setupScenario2Far() {
  // Warp-from-far: Sol loaded + camera teleported to a far position
  // (>= 10000 scene units from origin) so the warp scenario crosses
  // REBASE_THRESHOLD_SQ during HYPER. World-origin rebase fires at ~100
  // units; bumping to 12000 puts the ship well past several rebase cycles
  // worth of distance in the un-rebased frame. The rebase system will
  // eventually pull the camera back; capturing snapshot quickly so we
  // observe the far state.
  if (typeof window._lab?.enterSol !== 'function') {
    return captureEntrySnapshot('warp-from-far');
  }
  window._lab.enterSol();
  await _waitFor(() => window._lab.isInSystem());
  const cam = window._cam;
  if (cam?.position) {
    cam.position.set(12000, 0, -3000);
    if (typeof cam.updateMatrixWorld === 'function') cam.updateMatrixWorld(true);
  }
  _lockFirstPlanet();
  return captureEntrySnapshot('warp-from-far');
}

export async function setupScenario3MidCruise() {
  // Mid-CRUISE on autopilot leg: load Sol, begin autopilot, wait for the
  // V1 motion controller to enter CRUISE phase. AutopilotMotion exposes
  // _phase via prototype (currentPhase) but our snapshot reads _phase
  // directly per the brief's published-surface convention.
  if (typeof window._lab?.enterSol !== 'function') {
    return captureEntrySnapshot('mid-cruise');
  }
  window._lab.enterSol();
  await _waitFor(() => window._lab.isInSystem());
  if (typeof window._lab?.beginAutopilotTour === 'function') {
    window._lab.beginAutopilotTour();
  }
  await _waitFor(() => window._autopilotMotion?._phase === 'CRUISE', 6000);
  return captureEntrySnapshot('mid-cruise');
}

export async function setupScenario4MidHyper() {
  // Mid-HYPER warp tunnel: load Sol, trigger warp directly via warpEffect
  // .start(direction), wait for hyper state. Per the brief's open question
  // #1, we let the warp run rather than pause it (lab-mode is interactive
  // motion, not paused frame). Max has the ~3-second hyper window.
  if (typeof window._lab?.enterSol !== 'function') {
    return captureEntrySnapshot('mid-hyper');
  }
  window._lab.enterSol();
  await _waitFor(() => window._lab.isInSystem());
  // Construct a Vector3 by cloning an existing scene-graph position.
  // Camera-forward direction is fine; warp travels along it.
  const cam = window._cam;
  const sceneAny = window._scene;
  if (cam && window._warpEffect?.start && sceneAny?.children?.[0]?.position?.constructor) {
    const V = sceneAny.children[0].position.constructor;
    const dir = new V(0, 0, -1);
    try { window._warpEffect.start(dir); } catch (e) {
      console.warn('[LabMode] scenario 4: warpEffect.start threw —', e);
    }
  }
  await _waitFor(() => window._warpEffect?.state === 'hyper', 8000);
  return captureEntrySnapshot('mid-hyper');
}

export async function setupScenario5ManualFlight() {
  // Manual-flight: Sol loaded, autopilot disabled, ship hovering.
  if (typeof window._lab?.enterSol !== 'function') {
    return captureEntrySnapshot('manual-flight');
  }
  window._lab.enterSol();
  await _waitFor(() => window._lab.isInSystem());
  if (typeof window._lab?.stopAutopilot === 'function') {
    window._lab.stopAutopilot();
  }
  return captureEntrySnapshot('manual-flight');
}

export async function setupScenario6StationHold() {
  // STATION-A hold: load Sol, autopilot tour, wait for STATION-A phase.
  // V1 motion controller's _phase enum: IDLE / CRUISE / APPROACH / STATION-A /
  // STATION-B / LHOKON. Wait for any STATION-prefix phase.
  if (typeof window._lab?.enterSol !== 'function') {
    return captureEntrySnapshot('station-hold');
  }
  window._lab.enterSol();
  await _waitFor(() => window._lab.isInSystem());
  if (typeof window._lab?.beginAutopilotTour === 'function') {
    window._lab.beginAutopilotTour();
  }
  await _waitFor(() => {
    const p = window._autopilotMotion?._phase;
    return typeof p === 'string' && p.startsWith('STATION');
  }, 30000);  // STATION arrival can take a while across CRUISE + APPROACH
  return captureEntrySnapshot('station-hold');
}

export async function setupScenario7ReticlePersist() {
  // Reticle/runway-persist reproducer: warp to body, let it complete to
  // idle, leave camera in post-warp state with reticle/runway overlay
  // visible. The regression Max reported 2026-05-05 — overlay persists
  // when it should hide. Snapshot captures overlay visibility state so
  // working-Claude can diagnose.
  if (typeof window._lab?.enterSol !== 'function') {
    return captureEntrySnapshot('reticle-persist');
  }
  window._lab.enterSol();
  await _waitFor(() => window._lab.isInSystem());
  // Trigger warp same way as scenario 4
  const cam = window._cam;
  const sceneAny = window._scene;
  if (cam && window._warpEffect?.start && sceneAny?.children?.[0]?.position?.constructor) {
    const V = sceneAny.children[0].position.constructor;
    const dir = new V(0, 0, -1);
    try { window._warpEffect.start(dir); } catch (e) {
      console.warn('[LabMode] scenario 7: warpEffect.start threw —', e);
    }
  }
  // Wait for warp to fully complete (state returns to idle AFTER going
  // non-idle). Use a small state-machine guard so we don't capture before
  // warp even started.
  let sawNonIdle = false;
  await _waitFor(() => {
    const st = window._warpEffect?.state;
    if (st && st !== 'idle') sawNonIdle = true;
    return sawNonIdle && st === 'idle';
  }, 15000);
  return captureEntrySnapshot('reticle-persist');
}

// ─── Programmatic dispatcher (AC #12) ────────────────────────────────────

const SCENARIO_FUNCS = [
  null,
  setupScenario1Sol,
  setupScenario2Far,
  setupScenario3MidCruise,
  setupScenario4MidHyper,
  setupScenario5ManualFlight,
  setupScenario6StationHold,
  setupScenario7ReticlePersist,
];

/**
 * Programmatic scenario invocation. Used by both the keydown handler
 * (Shift+digit) and the Tester subagent (window._labMode.runScenario(N)).
 *
 * @param {number} n  1..7
 * @returns {object | null} the snapshot, or null if N is invalid
 */
export function runScenario(n) {
  if (typeof n !== 'number' || n < 1 || n > 7) {
    console.warn(`[LabMode] runScenario: N must be 1-7, got ${n}`);
    return null;
  }
  if (!_initialized) {
    console.warn('[LabMode] runScenario: not initialized — caller must invoke init({scene,camera,...}) first');
    return null;
  }
  return SCENARIO_FUNCS[n]();
}
