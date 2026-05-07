// SceneInspector — Tier 1/2 of the welldipper-scene-inspection-layer
// (Phase 3, brief 2026-05-06).
//
// Tier 1 (programmatic surface): window.__wd.takeSceneInventory pre-wired
// with main + sky scenes, the composer, the overlay registry, and the
// host-supplied registries for materials / clocks / modes / phases / audio /
// input. Plus convenience accessors (getNamed, scenes, etc.).
//
// Tier 2 (in-page panel): Shift+I toggles a fixed-position floating panel
// that renders the latest snapshot as collapsible JSON. Includes
// "copy to clipboard" for Tester / Max sharing.
//
// Both tiers are gated by `import.meta.env.DEV`. The Vite production build
// tree-shakes the install call; Phase 3 ships a build-time grep test that
// asserts the inspector strings don't leak into the prod bundle.

import { takeSceneInventory } from 'motion-test-kit/adapters/three/scene-inventory.js';
import { diffInventories } from 'motion-test-kit/core/inventory/diff.js';
import { serializeForGolden, quickGoldenDiff } from './scene-inventory-golden.js';

const PANEL_ID = '__wd-inspector-panel';
const PANEL_TITLE = '__wd Scene Inspector';

let _state = null;

/**
 * Install the inspector. Called once from main.js after the engine globals
 * are ready (scene, skyRenderer, retroRenderer, warpEffect, autopilot, etc).
 *
 * @param {{
 *   scene: object,
 *   skyRenderer: object,
 *   retroRenderer: object,
 *   warpEffect: object,
 *   autopilot: object,
 *   warpPortal: object,
 *   labMode?: object,
 *   audioCtx?: object,
 *   inputState?: () => object,
 * }} engines
 */
export function installSceneInspector(engines) {
  if (typeof window === 'undefined') return;
  if (!import.meta.env.DEV && !new URLSearchParams(location.search).has('debug')) {
    return;
  }
  if (_state) return;

  _state = {
    engines,
    materials: [],
    clocks: () => ({}),
    modes: () => ({}),
    phases: () => ({}),
    audio: () => [],
    input: () => ({}),
    syntheticLights: () => deriveSyntheticLights(engines),
    panelEl: null,
    panelExpanded: false,
    lastInventory: null,
  };

  // Auto-register canonical materials watchlist. Host can append via
  // __wd.registerMaterial(role, material, watch).
  registerCanonicalMaterials(engines);

  // Auto-derive clocks / modes / phases / audio / input from engine state.
  // These are getters so they re-evaluate at snapshot time.
  _state.clocks = () => deriveClocks(engines);
  _state.modes = () => deriveModes(engines);
  _state.phases = () => derivePhases(engines);
  _state.audio = () => deriveAudio(engines);
  _state.input = () => deriveInput(engines);

  // Tier 1 surface
  window.__wd = {
    takeSceneInventory: takeInventoryNow,
    diff: diffLatest,
    diffInventories,
    getNamed: getNamed,
    getInventory: takeInventoryNow,
    scenes: () => listScenes(engines),
    // Tier 3: golden-snapshot helpers. Returns canonical-sorted, UUID-stripped,
    // position-rounded form ready to commit to tests/golden/scene-inventory/.
    serializeForGolden: () => serializeForGolden(takeInventoryNow()),
    serializeInventory: serializeForGolden,
    quickGoldenDiff,
    saveGolden: (scenarioName) => saveGolden(scenarioName),
    registerMaterial: (role, material, watch) => {
      _state.materials.push({ role, material, watch: Array.isArray(watch) ? watch : [] });
    },
    unregisterMaterial: (role) => {
      _state.materials = _state.materials.filter((m) => m.role !== role);
    },
    setClocksProvider: (fn) => { _state.clocks = fn; },
    setModesProvider: (fn) => { _state.modes = fn; },
    setPhasesProvider: (fn) => { _state.phases = fn; },
    setAudioProvider: (fn) => { _state.audio = fn; },
    setInputProvider: (fn) => { _state.input = fn; },
    setLightsProvider: (fn) => { _state.syntheticLights = fn; },
    // Integration test suite. Lazy-loaded so module isn't installed unless used.
    runIntegrationSuite: async () => {
      const m = await import('./integration-suite.js');
      return m.runIntegrationSuite();
    },
    togglePanel,
    panelOpen: () => !!_state.panelEl?.isConnected,
  };

  // Tier 2: Shift+I keyboard handler
  window.addEventListener('keydown', onKeyDown, { capture: true });
}

// ── Tier 1 internals ────────────────────────────────────────────────────

function listScenes(engines) {
  const scenes = [{ name: 'main', scene: engines.scene, camera: engines.scene?._mainCamera || window._cam }];
  const skyScene = engines.skyRenderer?.getScene?.();
  if (skyScene) {
    // Sky uses the same world camera in well-dipper (sky sphere centered on
    // camera each frame). If a separate sky camera exists, swap it in.
    scenes.push({ name: 'sky', scene: skyScene, camera: window._cam });
  }
  return scenes;
}

function takeInventoryNow(opts) {
  if (!_state) throw new Error('__wd: inspector not installed');
  const engines = _state.engines;
  const scenes = (opts?.scenes) || listScenes(engines);

  const inv = takeSceneInventory({
    scenes,
    composer: engines.retroRenderer?.composer || engines.retroRenderer?._composer,
    overlayRegistry: engines.labMode?._overlayRegistry || window._labMode?._overlayRegistry,
    renderer: engines.retroRenderer?.renderer,
    materials: _state.materials,
    clocks: _state.clocks(),
    modes: _state.modes(),
    phases: _state.phases(),
    audio: _state.audio(),
    input: _state.input(),
    ...(opts?.options || {}),
  });

  // Synthesize lights for hosts that use shader-based lighting instead of
  // THREE.Light. The lights category from kit-side traversal stays accurate
  // (.isLight === true objects); these synthetic entries are appended.
  const synthetic = _state.syntheticLights();
  if (Array.isArray(synthetic) && synthetic.length > 0) {
    inv.lights = (inv.lights || []).concat(synthetic);
  }

  // Append named container Objects (Groups that carry userData.category but
  // have no geometry — kit's takeSceneInventory filters by geometry, so
  // these named containers don't show up otherwise. Brief calls them out
  // explicitly: AsteroidBelt parent Group, ShipSpawner outer model wrapper,
  // GravityWellMap container, etc. — load-bearing for predicate lookups.)
  const namedContainers = collectNamedContainers(scenes);
  if (namedContainers.length > 0) {
    inv.meshes = (inv.meshes || []).concat(namedContainers);
  }

  _state.lastInventory = inv;
  return inv;
}

function saveGolden(scenarioName) {
  const inv = takeInventoryNow();
  const golden = serializeForGolden(inv);
  const json = JSON.stringify(golden, null, 2);
  console.log('[__wd.saveGolden] ' + scenarioName + ' (paste into tests/golden/scene-inventory/' + scenarioName + '.json):');
  console.log(json);
  try {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = scenarioName + '.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  } catch (_) {}
  return golden;
}

function collectNamedContainers(scenes) {
  // Walk each scene and collect every Object3D that has userData.category
  // set AND no geometry (kit's mesh array already covers geometried ones).
  // Emits inventory-mesh-shaped entries so predicates / diff continue to
  // work uniformly. inFrustum is conservative true (containers don't have
  // bounding spheres; assume in-frustum unless host overrides).
  const out = [];
  for (const { name: source, scene } of scenes) {
    if (!scene?.traverse) continue;
    scene.traverse((obj) => {
      if (!obj || obj.geometry) return;             // geometried already covered
      if (!obj.userData?.category) return;          // unnamed container — skip
      const mwE = obj.matrixWorld?.elements;
      const worldPos = mwE
        ? [mwE[12], mwE[13], mwE[14]]
        : [obj.position?.x ?? 0, obj.position?.y ?? 0, obj.position?.z ?? 0];
      out.push({
        name: obj.name || '',
        type: obj.type || 'Group',
        uuid: obj.uuid || '',
        source,
        visible: obj.visible !== false,
        frustumCulled: obj.frustumCulled !== false,
        inFrustum: true,
        worldPos,
        layer: (obj.layers?.mask) ?? 1,
        materialUuid: '',
        geometryUuid: '',
        isContainer: true,
      });
    });
  }
  return out;
}

function diffLatest(prev) {
  // Lightweight diff: caller passes a prior inventory; returns name-set
  // delta. Heavy diff uses kit's diffInventories.
  const next = takeInventoryNow();
  const prevNames = new Set((prev?.meshes || []).filter((m) => m.visible && m.inFrustum).map((m) => m.name).filter(Boolean));
  const nextNames = new Set((next.meshes || []).filter((m) => m.visible && m.inFrustum).map((m) => m.name).filter(Boolean));
  return {
    appeared: [...nextNames].filter((n) => !prevNames.has(n)).sort(),
    disappeared: [...prevNames].filter((n) => !nextNames.has(n)).sort(),
  };
}

function getNamed(name) {
  if (!_state) return null;
  const engines = _state.engines;
  const scenes = listScenes(engines);
  for (const { scene } of scenes) {
    if (!scene?.traverse) continue;
    let found = null;
    scene.traverse((obj) => { if (!found && obj.name === name) found = obj; });
    if (found) return found;
  }
  return null;
}

// ── Auto-register canonical materials ────────────────────────────────────

function registerCanonicalMaterials(engines) {
  // Warp tunnel — uTime/uPhase are the load-bearing uniforms per brief.
  const tunnelMat = engines.warpPortal?._tunnel?.material;
  if (tunnelMat) {
    _state.materials.push({
      role: 'warp.tunnel',
      material: tunnelMat,
      watch: ['uTime', 'uPhase', 'uHyperPhase', 'uExitReveal', 'uFoldAmount'],
    });
  }
  const galaxyMat = engines.skyRenderer?._glowLayer?.mesh?.material;
  if (galaxyMat) {
    _state.materials.push({
      role: 'sky.galaxyglow',
      material: galaxyMat,
      watch: ['uTime', 'uPlayerPos', 'uBrightness'],
    });
  }
}

// ── Auto-derive engine state ─────────────────────────────────────────────

function deriveClocks(engines) {
  return {
    // Always-advancing clock so consumers have a stable reference. performance.now()
    // counts since page load; converting to seconds keeps it in the same unit as other
    // clocks. Useful as the second arg to clockProgressedSince for sanity checks.
    wall: (typeof performance !== 'undefined' && typeof performance.now === 'function') ? performance.now() / 1000 : 0,
    warp: typeof engines.warpEffect?.elapsed === 'number' ? engines.warpEffect.elapsed : 0,
    'audio.context': typeof engines.audioCtx?.currentTime === 'number' ? engines.audioCtx.currentTime : 0,
    'autopilot.tour': engines.autopilot?.telemetry?.elapsed ?? 0,
  };
}

function deriveModes(engines) {
  const out = {};
  if (engines.skyRenderer) out['sky.crossover'] = engines.skyRenderer._crossoverActive ? 'active' : 'idle';
  if (typeof engines.autopilot?.getCameraMode === 'function') {
    try { out['autopilot.camera'] = String(engines.autopilot.getCameraMode()); } catch (_) {}
  }
  if (window._useDualPortal != null) out['warp.pipeline'] = window._useDualPortal ? 'dual-portal' : 'legacy';
  return out;
}

function derivePhases(engines) {
  return {
    warp: engines.warpEffect?.state ?? 'idle',
    autopilot: engines.autopilot?._mode ?? engines.autopilot?._phase ?? 'idle',
  };
}

function deriveAudio(engines) {
  // Lightweight default: one synthetic 'context' track reflecting AudioContext
  // health. Real per-track state lives behind audio engine internals; host
  // can register a richer provider via __wd.setAudioProvider(fn).
  if (!engines.audioCtx) return [];
  return [{
    track: 'context',
    isPlaying: engines.audioCtx.state === 'running',
    currentTime: engines.audioCtx.currentTime ?? 0,
    volume: typeof engines.audioCtx.destination?.gain?.value === 'number' ? engines.audioCtx.destination.gain.value : 1,
  }];
}

function deriveSyntheticLights(engines) {
  // well-dipper uses shader-based lighting (no THREE.Light instances). Read
  // the current systemData via the host-supplied provider and emit
  // SyntheticLight entries so lightActiveAt(...) has data to assert against.
  const sd = engines.systemDataProvider ? engines.systemDataProvider() : null;
  if (!sd) return [];
  const out = [];
  if (sd.star) {
    const star = sd.star;
    const sysId = sd.seed != null ? String(sd.seed) : 'unseeded';
    const color = colorArrayToHex(sd.starInfo?.color1 || star.color);
    out.push({
      name: 'light.star.' + sysId,
      type: 'SyntheticLight',
      uuid: 'synthetic-star-' + sysId,
      source: 'main',
      visible: true,
      intensity: typeof sd.starInfo?.brightness1 === 'number' ? sd.starInfo.brightness1 : 1.0,
      color,
      worldPos: [0, 0, 0],
    });
  }
  if (sd.isBinary && sd.star2) {
    const sysId = sd.seed != null ? String(sd.seed) : 'unseeded';
    const color = colorArrayToHex(sd.starInfo?.color2 || sd.star2.color);
    out.push({
      name: 'light.star2.' + sysId,
      type: 'SyntheticLight',
      uuid: 'synthetic-star2-' + sysId,
      source: 'main',
      visible: true,
      intensity: typeof sd.starInfo?.brightness2 === 'number' ? sd.starInfo.brightness2 : 0.0,
      color,
      worldPos: [0, 0, 0],
    });
  }
  return out;
}

function colorArrayToHex(c) {
  if (!Array.isArray(c) || c.length < 3) return '';
  const r = Math.round(Math.min(1, Math.max(0, c[0])) * 255);
  const g = Math.round(Math.min(1, Math.max(0, c[1])) * 255);
  const b = Math.round(Math.min(1, Math.max(0, c[2])) * 255);
  return ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

function deriveInput(engines) {
  const heldKeys = window._heldKeys ? Array.from(window._heldKeys) : [];
  return {
    'held-keys': heldKeys,
    'last-action': window._lastAction || null,
  };
}

// ── Tier 2 panel ─────────────────────────────────────────────────────────

function onKeyDown(e) {
  if (e.key !== 'I' || !e.shiftKey) return;
  // No-op when text input focused.
  const t = e.target;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
  e.preventDefault();
  togglePanel();
}

function togglePanel() {
  if (!_state) return;
  if (_state.panelEl?.isConnected) {
    closePanel();
    return;
  }
  openPanel();
}

function openPanel() {
  const inv = takeInventoryNow();
  const el = document.createElement('div');
  el.id = PANEL_ID;
  el.style.cssText = `
    position: fixed; right: 12px; bottom: 12px;
    width: 480px; max-height: 60vh; overflow: auto;
    background: rgba(8, 12, 18, 0.94); color: #c5d8ee;
    border: 1px solid #2c4258; border-radius: 4px;
    padding: 12px 14px; font: 11px/1.45 ui-monospace, Menlo, Consolas, monospace;
    z-index: 99999; box-shadow: 0 6px 22px rgba(0,0,0,0.6);
  `;
  const header = document.createElement('div');
  header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;';
  const title = document.createElement('span');
  title.textContent = PANEL_TITLE;
  title.style.cssText = 'font-weight:700;color:#7fc3ff;';
  const actions = document.createElement('span');
  const refresh = makeBtn('refresh', () => {
    const next = takeInventoryNow();
    body.innerHTML = '';
    body.appendChild(renderTree(next));
  });
  const copy = makeBtn('copy', () => {
    navigator.clipboard?.writeText?.(JSON.stringify(_state.lastInventory, null, 2));
  });
  const close = makeBtn('close', closePanel);
  actions.append(refresh, copy, close);
  header.append(title, actions);

  const summary = document.createElement('div');
  summary.style.cssText = 'margin-bottom:8px;color:#8aa3bc;font-size:10px;';
  summary.textContent = `${inv.meshes?.length ?? 0} meshes · ${inv.cameras?.length ?? 0} cameras · ${inv.lights?.length ?? 0} lights · ${inv.composerPasses?.length ?? 0} passes · ${inv.domOverlays?.length ?? 0} overlays · phases=${JSON.stringify(inv.phases ?? {})}`;

  const body = document.createElement('div');
  body.appendChild(renderTree(inv));

  el.append(header, summary, body);
  document.body.appendChild(el);
  _state.panelEl = el;
}

function closePanel() {
  _state?.panelEl?.remove();
  if (_state) _state.panelEl = null;
}

function makeBtn(label, onClick) {
  const b = document.createElement('button');
  b.textContent = label;
  b.style.cssText = 'background:#1a2a3c;color:#7fc3ff;border:1px solid #2c4258;border-radius:3px;padding:2px 8px;margin-left:4px;font:inherit;cursor:pointer;';
  b.addEventListener('click', onClick);
  return b;
}

function renderTree(value, key, depth = 0) {
  // Compact JSON tree. Arrays > 8 items collapse with a count summary.
  const wrap = document.createElement('div');
  wrap.style.cssText = `margin-left:${depth ? 14 : 0}px;`;
  if (value === null || typeof value !== 'object') {
    const k = document.createElement('div');
    k.innerHTML = (key != null ? `<span style="color:#7fc3ff">${escape(key)}</span>: ` : '') +
      `<span style="color:#a3d39c">${escape(JSON.stringify(value))}</span>`;
    wrap.appendChild(k);
    return wrap;
  }
  const isArr = Array.isArray(value);
  const head = document.createElement('div');
  head.style.cssText = 'cursor:pointer;user-select:none;';
  const entries = isArr ? value.map((v, i) => [i, v]) : Object.entries(value);
  const summary = isArr ? `Array(${value.length})` : `Object(${entries.length})`;
  head.innerHTML = (key != null ? `<span style="color:#7fc3ff">${escape(key)}</span>: ` : '') +
    `<span style="color:#9aa9b8">▸ ${summary}</span>`;
  let expanded = depth < 1;
  const child = document.createElement('div');
  const renderChildren = () => {
    child.innerHTML = '';
    const items = entries.length > 50 ? entries.slice(0, 50) : entries;
    for (const [k, v] of items) child.appendChild(renderTree(v, k, depth + 1));
    if (entries.length > 50) {
      const more = document.createElement('div');
      more.style.cssText = 'color:#8aa3bc;font-style:italic;';
      more.textContent = `… ${entries.length - 50} more`;
      child.appendChild(more);
    }
  };
  if (expanded) { head.querySelector('span:last-child').textContent = `▾ ${summary}`; renderChildren(); }
  head.addEventListener('click', () => {
    expanded = !expanded;
    head.querySelector('span:last-child').textContent = `${expanded ? '▾' : '▸'} ${summary}`;
    if (expanded) renderChildren(); else child.innerHTML = '';
  });
  wrap.append(head, child);
  return wrap;
}

function escape(s) {
  return String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
}
