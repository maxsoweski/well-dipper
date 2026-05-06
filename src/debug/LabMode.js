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
    'reticle': '#targeting-reticle',
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
      const cam = window._scene?.children?.find?.((c) => c.isCamera) || null;
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

// ─── Scenario stubs (Phase 2 will implement actual setup logic) ─────────

export function setupScenario1Sol() {
  // TODO Phase 2: load Sol, lock Earth as warp target, position ship near origin.
  return captureEntrySnapshot('warp-from-sol');
}
export function setupScenario2Far() {
  // TODO Phase 2: position ship at >=10000 scene units, lock Sol-system body.
  return captureEntrySnapshot('warp-from-far');
}
export function setupScenario3MidCruise() {
  // TODO Phase 2: start autopilot leg, advance to mid-CRUISE.
  return captureEntrySnapshot('mid-cruise');
}
export function setupScenario4MidHyper() {
  // TODO Phase 2: start warp, advance through fold/enter into hyper, leave running.
  return captureEntrySnapshot('mid-hyper');
}
export function setupScenario5ManualFlight() {
  // TODO Phase 2: stop autopilot, position ship, enable WASD.
  return captureEntrySnapshot('manual-flight');
}
export function setupScenario6StationHold() {
  // TODO Phase 2: autopilot tour to first STATION transition.
  return captureEntrySnapshot('station-hold');
}
export function setupScenario7ReticlePersist() {
  // TODO Phase 2: warp to body, complete to idle, leave reticle/runway visible.
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
