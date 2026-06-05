import { searchKnownObjects } from '../data/KnownObjectProfiles.js';
import { deriveSystemTags, tagSummary, isShallowTags } from '../generation/SystemTags.js';
import { probeRegion } from '../generation/SystemProbe.js';
import { SavedSystems } from '../state/SavedSystems.js';

/**
 * DebugPanel — developer tools overlay for Well Dipper.
 *
 * Two modes:
 *   HUD mode (backtick ` key): small always-visible corner overlay
 *     — FPS, star type, galactic position, focused body LOD + physics
 *
 *   Panel mode (F3 key): full modal with detailed inspection
 *     — all HUD info + system details, brightness ranges, feature list,
 *       quick-jump buttons, rendering layer toggles
 *
 * Both update each frame via update() when active.
 */
export class DebugPanel {
  constructor() {
    this._hudVisible = false;
    this._panelVisible = false;

    // Frame timing
    this._frames = 0;
    this._fpsAccum = 0;
    this._fps = 0;

    // Data sources (set by main.js via setters)
    this._system = null;
    this._playerPos = null;
    this._camera = null;
    this._skyRenderer = null;
    this._lodManager = null;
    this._focusIndex = -1;
    this._focusMoonIndex = -1;
    this._stellarEvolution = null;
    this._systemData = null;

    // ── System-tags / save / probe-search (system-tags-save-search) ──
    // Persisted saved-systems store (localStorage). _currentNavStar is the
    // EXACT {worldX,worldY,worldZ,seed,type} snapshot of the current system,
    // set only on override-based spawn paths (warp / probe-jump) where reload
    // is guaranteed faithful. _probeResults holds the last probe's hits.
    this._savedSystems = new SavedSystems();
    this._currentNavStar = null;
    this._probeResults = [];

    // Create DOM elements
    this._createHUD();
    this._createPanel();
  }

  /**
   * Record the navStarData snapshot of the current system. Called by main.js on
   * faithful (override-based) spawns — warp Priority-1 and probe-jump. When set,
   * "Save current system" round-trips identically; when null, save is disabled.
   */
  setCurrentNavStar(nav) {
    this._currentNavStar = nav
      ? { worldX: nav.worldX, worldY: nav.worldY, worldZ: nav.worldZ, seed: nav.seed, type: nav.type }
      : null;
    this._refreshLiveSections();
  }

  // ── Data setters (called by main.js) ──

  setSystem(system, systemData) {
    this._system = system;
    this._systemData = systemData;
    this._stellarEvolution = systemData?.stellarEvolution || null;
    this._refreshLiveSections();
  }

  setPlayerPos(pos) { this._playerPos = pos; }
  getSearchTarget() { return this._searchTarget || null; }
  clearSearchTarget() { this._searchTarget = null; }
  setGalacticMap(gm) { this._galacticMap = gm; }
  setRealStarCatalog(catalog) { this._realStarCatalog = catalog; }
  setRealFeatureCatalog(catalog) { this._realFeatureCatalog = catalog; }
  setCamera(cam) { this._camera = cam; }
  setCameraController(ctrl) { this._cameraController = ctrl; }
  setSkyRenderer(sky) { this._skyRenderer = sky; }
  setLODManager(lod) { this._lodManager = lod; }
  setFocus(planetIndex, moonIndex) {
    this._focusIndex = planetIndex;
    this._focusMoonIndex = moonIndex;
  }

  /**
   * Set the RetroRenderer for grain control.
   * @param {import('../rendering/RetroRenderer.js').RetroRenderer} renderer
   */
  setRetroRenderer(renderer) {
    this._retroRenderer = renderer;
  }

  /**
   * Set callbacks for debug spawner actions.
   * @param {object} callbacks
   * @param {function} callbacks.teleportToPosition — (pos: {x,y,z}, name: string) => void
   * @param {function} callbacks.spawnSystemType — (destType: string) => void
   * @param {function} callbacks.spawnWithSeed — (seed: string) => void
   */
  /**
   * @param {object} callbacks
   * @param {function} callbacks.teleportToPosition
   * @param {function} callbacks.spawnSystemType
   * @param {function} callbacks.spawnWithSeed
   * @param {function} callbacks.findNearest — (targetType: string) => { found, systemData, starData, message }
   */
  setSpawnCallbacks(callbacks) {
    this._spawnCallbacks = callbacks;
  }

  // ── Toggle ──

  toggleHUD() {
    this._hudVisible = !this._hudVisible;
    this._hudEl.style.display = this._hudVisible ? 'block' : 'none';
  }

  togglePanel() {
    this._panelVisible = !this._panelVisible;
    this._panelEl.style.display = this._panelVisible ? 'flex' : 'none';
    if (this._panelVisible) this._populatePanel();
  }

  get isHUDVisible() { return this._hudVisible; }
  get isPanelVisible() { return this._panelVisible; }

  // ── Per-frame update ──

  update(deltaTime) {
    // FPS counter
    this._frames++;
    this._fpsAccum += deltaTime;
    if (this._fpsAccum >= 0.5) {
      this._fps = Math.round(this._frames / this._fpsAccum);
      this._frames = 0;
      this._fpsAccum = 0;
    }

    if (this._hudVisible) this._updateHUD();
    if (this._panelVisible) this._updatePanel();
  }

  // ── HUD (corner overlay) ──

  _createHUD() {
    this._hudEl = document.getElementById('debug-hud');
    if (!this._hudEl) {
      // Create if not in HTML
      this._hudEl = document.createElement('div');
      this._hudEl.id = 'debug-hud';
      this._hudEl.style.display = 'none';
      document.body.appendChild(this._hudEl);
    }
  }

  _updateHUD() {
    const lines = [];

    // FPS
    lines.push(`<span class="dh-label">FPS</span> <span class="dh-val">${this._fps}</span>`);

    // Galactic position + gravitational potential
    if (this._playerPos) {
      const p = this._playerPos;
      const R = Math.sqrt(p.x * p.x + p.z * p.z);
      lines.push(`<span class="dh-label">GAL</span> <span class="dh-val">(${p.x.toFixed(1)}, ${p.y.toFixed(2)}, ${p.z.toFixed(1)}) R=${R.toFixed(2)}</span>`);

      if (this._galacticMap) {
        const phi = this._galacticMap.gravitationalPotential(R, p.y);
        const vesc = this._galacticMap.escapeVelocity(R, p.y);
        const grad = this._galacticMap.potentialGradient(R, p.y);
        lines.push(`<span class="dh-label">WELL</span> <span class="dh-val">depth=${(-phi.total).toFixed(4)} v_esc=${vesc.toFixed(3)} grad=${grad.magnitude.toFixed(4)}</span>`);
      }
    }

    // System type
    if (this._system) {
      const type = this._system.type || 'star-system';
      const binary = this._system.isBinary ? ' [BINARY]' : '';
      lines.push(`<span class="dh-label">SYS</span> <span class="dh-val">${type}${binary}</span>`);
    }

    // Star evolution
    if (this._stellarEvolution) {
      const evo = this._stellarEvolution;
      const stage = evo.evolved
        ? `${evo.stage}${evo.remnantType ? ` (${evo.remnantType})` : ''}`
        : 'main-sequence';
      lines.push(`<span class="dh-label">STAR</span> <span class="dh-val">${stage}</span>`);
    }

    // Star renderer type
    if (this._system?.star?.type) {
      lines.push(`<span class="dh-label">RENDERER</span> <span class="dh-val">${this._system.star.type}</span>`);
    }

    // Focused body info
    if (this._system?.planets && this._focusIndex >= 0 && this._focusIndex < this._system.planets.length) {
      const entry = this._system.planets[this._focusIndex];
      const planet = entry.planet;
      const pData = planet.data;
      const lod = planet.currentLOD !== undefined ? `LOD ${planet.currentLOD}` : 'N/A';

      lines.push(`<span class="dh-label">FOCUS</span> <span class="dh-val">${pData.type} ${lod}</span>`);

      // Physics data from BodyRenderer
      if (planet.physics) {
        const phys = planet.physics;
        if (phys.composition) {
          lines.push(`<span class="dh-label">COMP</span> <span class="dh-val">${phys.composition.surfaceType || '?'} Fe=${(phys.composition.ironFraction || 0).toFixed(2)}</span>`);
        }
        if (phys.atmosphere) {
          lines.push(`<span class="dh-label">ATMO</span> <span class="dh-val">${phys.atmosphere.retained ? 'retained' : 'none'}</span>`);
        }
        if (phys.tidalState) {
          lines.push(`<span class="dh-label">TIDAL</span> <span class="dh-val">${phys.tidalState.locked ? phys.tidalState.lockType : 'free'}</span>`);
        }
        if (phys.surfaceHistory) {
          const sh = phys.surfaceHistory;
          lines.push(`<span class="dh-label">SURF</span> <span class="dh-val">bomb=${(sh.bombardmentIntensity || 0).toFixed(2)} ero=${(sh.erosionLevel || 0).toFixed(2)}</span>`);
        }
      }

      // Moon info
      if (this._focusMoonIndex >= 0 && this._focusMoonIndex < entry.moons.length) {
        const moon = entry.moons[this._focusMoonIndex];
        const mLod = moon.currentLOD !== undefined ? `LOD ${moon.currentLOD}` : 'N/A';
        lines.push(`<span class="dh-label">MOON</span> <span class="dh-val">${moon.data?.type || '?'} ${mLod}</span>`);
      }
    }

    // Sky features
    if (this._skyRenderer) {
      const tint = this._skyRenderer.getAmbientTint();
      if (tint) {
        lines.push(`<span class="dh-label">TINT</span> <span class="dh-val" style="color:rgb(${Math.round(tint.r*255)},${Math.round(tint.g*255)},${Math.round(tint.b*255)})">■</span> <span class="dh-val">${(tint.strength*100).toFixed(0)}%</span>`);
      }
    }

    // Camera distance
    if (this._camera && this._system?.star) {
      const dist = this._camera.position.length().toFixed(1);
      lines.push(`<span class="dh-label">CAM</span> <span class="dh-val">d=${dist}</span>`);
    }

    this._hudEl.innerHTML = lines.join('<br>');
  }

  // ── Panel (full modal) ──

  _createPanel() {
    this._panelEl = document.getElementById('debug-overlay');
    if (!this._panelEl) {
      this._panelEl = document.createElement('div');
      this._panelEl.id = 'debug-overlay';
      this._panelEl.style.display = 'none';
      this._panelEl.innerHTML = `
        <div class="debug-panel">
          <button class="overlay-close" aria-label="Close">&times;</button>
          <h2>DEBUG</h2>
          <div id="debug-content"></div>
          <p class="debug-dismiss">DOWN ARROW or ESC to close &nbsp; backtick (\`) toggles HUD</p>
        </div>
      `;
      document.body.appendChild(this._panelEl);

      // Close handlers
      this._panelEl.addEventListener('click', (e) => {
        if (e.target === this._panelEl) this.togglePanel();
      });
      this._panelEl.querySelector('.overlay-close')?.addEventListener('click', () => {
        this.togglePanel();
      });
    }
  }

  _populatePanel() {
    const el = document.getElementById('debug-content');
    if (!el) return;

    let html = '';

    // ── System Overview ──
    html += '<div class="debug-section"><h3>SYSTEM</h3><div class="debug-grid">';
    if (this._system) {
      const type = this._system.type || 'star-system';
      html += this._row('Type', type);
      html += this._row('Binary', this._system.isBinary ? 'Yes' : 'No');
      html += this._row('Planets', this._system.planets?.length ?? 0);
      html += this._row('Belts', this._system.asteroidBelts?.length ?? 0);
      if (this._system.names?.system) {
        html += this._row('Name', this._system.names.system);
      }
    } else {
      html += this._row('Status', 'No system loaded');
    }
    html += '</div></div>';

    // ── Star Info ──
    html += '<div class="debug-section"><h3>STAR</h3><div class="debug-grid">';
    if (this._stellarEvolution) {
      const evo = this._stellarEvolution;
      html += this._row('Stage', evo.stage);
      html += this._row('Evolved', evo.evolved ? 'Yes' : 'No');
      if (evo.remnantType) html += this._row('Remnant', evo.remnantType);
      html += this._row('MS Lifetime', `${evo.msLifetime?.toFixed(2) ?? '?'} Gyr`);
    }
    if (this._system?.star?.type) {
      html += this._row('Renderer', this._system.star.type);
    }
    if (this._systemData?.star) {
      const s = this._systemData.star;
      html += this._row('Spectral', s.type || '?');
      if (s.luminosity) html += this._row('Luminosity', `${s.luminosity.toFixed(2)} L☉`);
    }
    html += '</div></div>';

    // ── Star/Object Search ──
    html += '<div class="debug-section"><h3>GO TO OBJECT</h3>';
    html += '<div class="debug-seed-row">';
    html += '<input type="text" id="debug-star-search" class="debug-input" placeholder="Search: Sirius, M42, Helix...">';
    html += '<button class="debug-btn" id="debug-star-search-go">GO</button>';
    html += '</div>';
    html += '<div style="margin-top:4px;font-size:10px">';
    html += '<label style="color:#8cf;cursor:pointer;margin-right:10px"><input type="checkbox" id="debug-search-near" checked> Near</label>';
    html += '<label style="color:#5f8;cursor:pointer"><input type="checkbox" id="debug-search-highlight" checked> Highlight</label>';
    html += '</div>';
    html += '<div id="debug-search-results" class="debug-find-status"></div>';
    html += '</div>';

    // ── Galaxy Position ──
    html += '<div class="debug-section"><h3>GALAXY</h3><div class="debug-grid">';
    if (this._playerPos) {
      const p = this._playerPos;
      const R = Math.sqrt(p.x * p.x + p.z * p.z);
      html += this._row('Position', `(${p.x.toFixed(2)}, ${p.y.toFixed(3)}, ${p.z.toFixed(2)})`);
      html += this._row('Radius', `${R.toFixed(2)} kpc`);
      html += this._row('Height', `${p.y.toFixed(3)} kpc`);
    }
    html += '</div></div>';

    // ── Planet List ──
    if (this._system?.planets?.length > 0) {
      html += '<div class="debug-section"><h3>PLANETS</h3><div class="debug-grid">';
      for (let i = 0; i < this._system.planets.length; i++) {
        const entry = this._system.planets[i];
        const p = entry.planet;
        const name = this._system.names?.planets?.[i] || `Planet ${i + 1}`;
        const lod = p.currentLOD !== undefined ? p.currentLOD : '-';
        const type = p.data?.type || '?';
        const moons = entry.moons?.length || 0;
        const focused = i === this._focusIndex ? ' ◀' : '';
        html += this._row(`${name}${focused}`, `${type} LOD:${lod} moons:${moons}`);
      }
      html += '</div></div>';
    }

    // ── Rendering Controls ──
    html += '<div class="debug-section"><h3>RENDERING</h3><div class="debug-grid">';
    if (this._skyRenderer) {
      const cfg = this._skyRenderer._brightnessConfig;
      html += this._row('Glow range', `${cfg.glow.min.toFixed(2)} – ${cfg.glow.max.toFixed(2)}`);
      html += this._row('Feature range', `${cfg.features.min.toFixed(2)} – ${cfg.features.max.toFixed(2)}`);
      html += this._row('Star range', `${cfg.stars.min.toFixed(2)} – ${cfg.stars.max.toFixed(2)}`);
      const tint = this._skyRenderer.getAmbientTint();
      html += this._row('Ambient tint', tint ? `rgb(${Math.round(tint.r*255)},${Math.round(tint.g*255)},${Math.round(tint.b*255)}) ${(tint.strength*100).toFixed(0)}%` : 'none');
    }
    html += '</div>';
    // Grain slider
    const currentGrain = this._retroRenderer?._compositeMesh?.material?.uniforms?.uGrainStrength?.value ?? 0.045;
    html += '<div class="debug-slider-row">';
    html += `<label class="dg-label">Film Grain</label>`;
    html += `<input type="range" id="debug-grain" min="0" max="0.15" step="0.005" value="${currentGrain}">`;
    html += `<span class="dg-val" id="debug-grain-val">${currentGrain.toFixed(3)}</span>`;
    html += '</div>';
    // Star brightness slider
    if (this._skyRenderer) {
      const starMax = this._skyRenderer._brightnessConfig.stars.max;
      html += '<div class="debug-slider-row">';
      html += `<label class="dg-label">Star Bright</label>`;
      html += `<input type="range" id="debug-star-bright" min="0.2" max="1.5" step="0.05" value="${starMax}">`;
      html += `<span class="dg-val" id="debug-star-bright-val">${starMax.toFixed(2)}</span>`;
      html += '</div>';
    }
    // Mouse sensitivity slider
    if (this._cameraController) {
      const sens = this._cameraController.dragSensitivity;
      html += '<div class="debug-slider-row">';
      html += `<label class="dg-label">Mouse Sens</label>`;
      html += `<input type="range" id="debug-mouse-sens" min="0.001" max="0.02" step="0.001" value="${sens}">`;
      html += `<span class="dg-val" id="debug-mouse-sens-val">${sens.toFixed(3)}</span>`;
      html += '</div>';
    }
    html += '</div>';

    // ── Galaxy Position Spawner ──
    html += '<div class="debug-section"><h3>TELEPORT TO GALAXY POSITION</h3>';
    html += '<div class="debug-btn-grid">';
    const positions = [
      { id: 'solar', label: 'Solar (R=8)', pos: { x: 8.0, y: 0.025, z: 0.0 } },
      { id: 'center', label: 'Center (R=0.5)', pos: { x: 0.5, y: 0.0, z: 0.5 } },
      { id: 'core', label: 'Core (R=0.1)', pos: { x: 0.1, y: 0.0, z: 0.0 } },
      { id: 'edge', label: 'Edge (R=14.5)', pos: { x: 14.5, y: 0.0, z: 0.0 } },
      { id: 'above', label: 'Above (h=6)', pos: { x: 4.0, y: 6.0, z: 0.0 } },
      { id: 'below', label: 'Below (h=-8)', pos: { x: 3.0, y: -8.0, z: 0.0 } },
      { id: 'arm', label: 'Arm center', pos: { x: -7.9, y: 0.025, z: -1.0 } },
      { id: 'armtip', label: 'Arm tip', pos: { x: 9.4, y: 0.025, z: -9.0 } },
      { id: 'halo', label: 'Deep halo (h=12)', pos: { x: 0.0, y: 12.0, z: 0.0 } },
      { id: 'far', label: 'Far side (h=2)', pos: { x: -16.0, y: 2.0, z: 0.0 } },
    ];
    for (const p of positions) {
      html += `<button class="debug-btn" data-teleport="${p.id}">${p.label}</button>`;
    }
    html += '</div></div>';

    // ── System Type Spawner ──
    html += '<div class="debug-section"><h3>SPAWN SYSTEM TYPE</h3>';
    html += '<div class="debug-btn-grid">';
    const types = [
      { id: 'star-system', label: 'Star System' },
      { id: 'spiral-galaxy', label: 'Spiral Galaxy' },
      { id: 'elliptical-galaxy', label: 'Elliptical Galaxy' },
      { id: 'globular-cluster', label: 'Globular Cluster' },
      // Navigable deep-sky (emission/planetary nebula, open cluster) removed as a
      // spawnable destination (deep-sky-cleanup-2026-05-29) — view them in the gallery.
    ];
    for (const t of types) {
      html += `<button class="debug-btn" data-spawn="${t.id}">${t.label}</button>`;
    }
    html += '</div></div>';

    // ── Glow Test (position-only, no starfield regen) ──
    html += '<div class="debug-section"><h3>GLOW VIEW TEST</h3>';
    html += '<div class="debug-btn-grid">';
    const glowPositions = [
      { id: 'glow-solar', label: 'Sol', pos: { x: 8.0, y: 0.025, z: 0.0 } },
      { id: 'glow-above', label: 'Above (5 kpc)', pos: { x: 0, y: 5, z: 0 } },
      { id: 'glow-above-sol', label: 'Above Sol', pos: { x: 8, y: 5, z: 0 } },
      { id: 'glow-center', label: 'Center', pos: { x: 0, y: 0, z: 0 } },
      { id: 'glow-edge', label: 'Edge (R=15)', pos: { x: 15, y: 0, z: 0 } },
      { id: 'glow-far', label: 'Far above (10 kpc)', pos: { x: 0, y: 10, z: 0 } },
      { id: 'glow-arm', label: 'In Perseus arm', pos: { x: -8, y: 0, z: -1 } },
      { id: 'glow-interarm', label: 'Inter-arm', pos: { x: 5, y: 0, z: 5 } },
    ];
    for (const p of glowPositions) {
      html += `<button class="debug-btn" data-glow="${p.id}">${p.label}</button>`;
    }
    html += '</div></div>';

    // ── Find Nearest ──
    html += '<div class="debug-section"><h3>FIND NEAREST</h3>';
    html += '<div class="debug-btn-grid">';
    const findTypes = [
      { id: 'red-giant', label: 'Red Giant' },
      { id: 'white-dwarf', label: 'White Dwarf' },
      { id: 'neutron-star', label: 'Neutron Star' },
      { id: 'black-hole', label: 'Black Hole' },
      { id: 'binary', label: 'Binary System' },
      { id: 'habitable', label: 'Habitable Planet' },
      { id: 'rings', label: 'Ringed Planet' },
      { id: 'belt', label: 'Asteroid Belt' },
      { id: 'feat:emission-nebula', label: 'Emission Nebula' },
      { id: 'feat:dark-nebula', label: 'Dark Nebula' },
      { id: 'feat:open-cluster', label: 'Open Cluster' },
      { id: 'feat:globular-cluster', label: 'Globular Cluster' },
      { id: 'feat:supernova-remnant', label: 'Supernova Remnant' },
      { id: 'feat:ob-association', label: 'OB Association' },
    ];
    for (const t of findTypes) {
      html += `<button class="debug-btn debug-find-btn" data-find="${t.id}">${t.label}</button>`;
    }
    html += '</div>';
    html += '<div id="debug-find-status" class="debug-find-status"></div>';
    html += '</div>';

    // ── Seed Input ──
    html += '<div class="debug-section"><h3>SPAWN BY SEED</h3>';
    html += '<div class="debug-seed-row">';
    html += '<input type="text" id="debug-seed-input" class="debug-input" placeholder="Enter seed..." value="">';
    html += '<button class="debug-btn" id="debug-seed-go">GO</button>';
    html += '</div></div>';

    // ── System Tags ──
    html += '<div class="debug-section"><h3>SYSTEM TAGS</h3><div class="debug-grid" id="debug-tags-grid">';
    html += this._tagsRowsHtml();
    html += '</div>';
    html += '<button class="debug-btn" id="debug-save-system" style="margin-top:6px;width:100%">★ Save current system</button>';
    html += '<div id="debug-save-status" class="debug-find-status"></div>';
    html += '</div>';

    // ── Probe Search ──
    html += '<div class="debug-section"><h3>PROBE SEARCH</h3>';
    html += '<div style="font-size:10px;color:#8cf;margin-bottom:4px">Sweeps a region of the universe and filters by tag.</div>';
    html += '<div class="debug-grid">';
    html += `<label class="dg-label">Center</label><span class="dg-val" id="debug-probe-center">${this._probeCenterLabel()}</span>`;
    html += '</div>';
    html += '<div class="debug-slider-row"><label class="dg-label">Radius (kpc)</label>';
    html += '<input type="number" id="debug-probe-radius" class="debug-input" style="width:70px" min="0.01" max="2" step="0.01" value="0.1"></div>';
    html += '<div class="debug-slider-row"><label class="dg-label">Scan depth</label>';
    html += '<select id="debug-probe-depth" class="debug-input" style="width:110px"><option value="shallow">shallow (fast)</option><option value="deep">deep (confirm rings/hab)</option></select></div>';
    // Tag filter
    html += '<div class="debug-grid" style="margin-top:4px">';
    html += `<label class="dg-label">isBinary</label><select id="debug-f-binary" class="debug-input" style="width:90px"><option value="">any</option><option value="true">yes</option><option value="false">no</option></select>`;
    html += `<label class="dg-label">primaryType</label><select id="debug-f-ptype" class="debug-input" style="width:90px"><option value="">any</option><option>O</option><option>B</option><option>A</option><option>F</option><option>G</option><option>K</option><option>M</option></select>`;
    html += `<label class="dg-label">hasRings</label><select id="debug-f-rings" class="debug-input" style="width:90px"><option value="">any</option><option value="true">yes</option></select>`;
    html += `<label class="dg-label">hasHabitable</label><select id="debug-f-hab" class="debug-input" style="width:90px"><option value="">any</option><option value="true">yes</option></select>`;
    html += '</div>';
    html += '<button class="debug-btn" id="debug-probe-run" style="margin-top:6px;width:100%">▶ Run probe</button>';
    html += '<div id="debug-probe-status" class="debug-find-status"></div>';
    html += '<div id="debug-probe-results" class="debug-grid" style="margin-top:4px"></div>';
    html += '</div>';

    // ── Saved Systems ──
    html += '<div class="debug-section"><h3>SAVED SYSTEMS</h3>';
    html += '<div class="debug-grid"><label class="dg-label">Filter</label>';
    html += `<select id="debug-saved-filter" class="debug-input" style="width:130px"><option value="">all</option><option value="isBinary">binary</option><option value="hasRings">has rings</option><option value="hasHabitable">habitable</option></select></div>`;
    html += '<div id="debug-saved-list" class="debug-grid" style="margin-top:4px"></div>';
    html += '</div>';

    el.innerHTML = html;

    // ── Wire up interactive controls ──
    this._wireControls(el, positions);
  }

  _updatePanel() {
    // Update FPS in panel header if visible
    // Full re-populate is too expensive per frame — just update the FPS
  }

  _wireControls(container, positions) {
    // ── Sliders ──
    const grainSlider = container.querySelector('#debug-grain');
    const grainVal = container.querySelector('#debug-grain-val');
    if (grainSlider && this._retroRenderer) {
      grainSlider.addEventListener('input', () => {
        const v = parseFloat(grainSlider.value);
        this._retroRenderer.setGrainStrength(v);
        if (grainVal) grainVal.textContent = v.toFixed(3);
      });
    }

    const starBrightSlider = container.querySelector('#debug-star-bright');
    const starBrightVal = container.querySelector('#debug-star-bright-val');
    if (starBrightSlider && this._skyRenderer) {
      starBrightSlider.addEventListener('input', () => {
        const v = parseFloat(starBrightSlider.value);
        this._skyRenderer.setBrightnessRange('stars', { max: v });
        if (starBrightVal) starBrightVal.textContent = v.toFixed(2);
      });
    }

    const mouseSensSlider = container.querySelector('#debug-mouse-sens');
    const mouseSensVal = container.querySelector('#debug-mouse-sens-val');
    if (mouseSensSlider && this._cameraController) {
      mouseSensSlider.addEventListener('input', () => {
        const v = parseFloat(mouseSensSlider.value);
        this._cameraController.dragSensitivity = v;
        if (mouseSensVal) mouseSensVal.textContent = v.toFixed(3);
      });
    }

    // ── Spawn buttons ──
    if (!this._spawnCallbacks) return;

    // Teleport buttons — keep panel open so user can click multiple
    for (const btn of container.querySelectorAll('[data-teleport]')) {
      btn.addEventListener('click', () => {
        const id = btn.dataset.teleport;
        const pos = positions.find(p => p.id === id);
        if (pos && this._spawnCallbacks.teleportToPosition) {
          this._spawnCallbacks.teleportToPosition(pos.pos, pos.label);
          // Flash the button to confirm
          btn.style.background = 'rgba(0, 220, 130, 0.3)';
          setTimeout(() => { btn.style.background = ''; }, 300);
        }
      });
    }

    // Glow test buttons — only change glow shader position, no starfield regen
    const glowPosData = {
      'glow-solar': { x: 8.0, y: 0.025, z: 0.0 },
      'glow-above': { x: 0, y: 5, z: 0 },
      'glow-above-sol': { x: 8, y: 5, z: 0 },
      'glow-center': { x: 0, y: 0, z: 0 },
      'glow-edge': { x: 15, y: 0, z: 0 },
      'glow-far': { x: 0, y: 10, z: 0 },
      'glow-arm': { x: -8, y: 0, z: -1 },
      'glow-interarm': { x: 5, y: 0, z: 5 },
    };
    for (const btn of container.querySelectorAll('[data-glow]')) {
      btn.addEventListener('click', () => {
        const pos = glowPosData[btn.dataset.glow];
        if (pos && window._glowLayer) {
          window._glowLayer.debugSetPosition(pos.x, pos.y, pos.z);
          btn.style.background = 'rgba(220, 180, 0, 0.3)';
          setTimeout(() => { btn.style.background = ''; }, 300);
        }
      });
    }

    // System type buttons — keep panel open
    for (const btn of container.querySelectorAll('[data-spawn]')) {
      btn.addEventListener('click', () => {
        const type = btn.dataset.spawn;
        if (this._spawnCallbacks.spawnSystemType) {
          this._spawnCallbacks.spawnSystemType(type);
          btn.style.background = 'rgba(0, 220, 130, 0.3)';
          setTimeout(() => { btn.style.background = ''; }, 300);
        }
      });
    }

    // Find nearest buttons — show status, close on success, stay open on failure
    const findStatus = container.querySelector('#debug-find-status');
    for (const btn of container.querySelectorAll('[data-find]')) {
      btn.addEventListener('click', () => {
        const targetType = btn.dataset.find;
        if (findStatus) findStatus.textContent = `Searching for ${targetType.replace('feat:', '')}...`;
        // Run search on next frame so status text renders first
        requestAnimationFrame(() => {
          if (this._spawnCallbacks?.findNearest) {
            const result = this._spawnCallbacks.findNearest(targetType);
            if (result.found) {
              this.togglePanel(); // close on success
            } else if (findStatus) {
              findStatus.textContent = result.message;
            }
          }
        });
      });
    }

    // Star/object search
    const searchInput = container.querySelector('#debug-star-search');
    const searchBtn = container.querySelector('#debug-star-search-go');
    const searchResults = container.querySelector('#debug-search-results');
    if (searchInput && searchBtn) {
      const doSearch = () => {
        const query = searchInput.value.trim().toLowerCase();
        if (!query) return;

        // Search the real star catalog
        const catalog = this._realStarCatalog;
        if (!catalog?.loaded) {
          if (searchResults) searchResults.textContent = 'Star catalog not loaded yet';
          return;
        }

        // Find matching stars (by name, case-insensitive, partial match)
        const matches = [];
        for (const star of catalog._stars) {
          if (star.name && star.name.toLowerCase().includes(query)) {
            matches.push(star);
            if (matches.length >= 10) break; // cap results
          }
        }

        // Also search real feature catalogs (globular clusters, etc.)
        const featureCatalog = this._realFeatureCatalog;
        if (featureCatalog?.loaded) {
          for (const gc of featureCatalog.globularClusters) {
            if (gc.name && gc.name.toLowerCase().includes(query)) {
              matches.push({ ...gc, isFeatureResult: true });
              if (matches.length >= 10) break;
            }
            // Also match by Harris ID (e.g., "NGC 104")
            if (gc.harrisId && gc.harrisId.toLowerCase().includes(query)) {
              matches.push({ ...gc, isFeatureResult: true });
              if (matches.length >= 10) break;
            }
          }
        }

        // Also search known object profiles (Messier catalog etc.)
        const knownMatches = searchKnownObjects(query);
        for (const km of knownMatches) {
          // Avoid duplicates if already found via feature catalog
          const isDup = matches.some(m => m.name?.toLowerCase() === km.profile.name.toLowerCase());
          if (!isDup) {
            matches.push({
              name: `${km.profile.name} (${km.key})`,
              position: km.profile.galacticPos,
              type: km.profile.type,
              radius: km.profile.radius,
              isFeatureResult: true,
              isKnownObject: true,
              knownKey: km.key,
            });
          }
        }

        if (matches.length === 0) {
          // Check for "earth" / "sol" / "sun" special cases
          if (query === 'earth' || query === 'sol' || query === 'sun' || query === 'solar system') {
            if (this._spawnCallbacks?.teleportToPosition) {
              this._spawnCallbacks.teleportToPosition({ x: 8.0, y: 0.025, z: 0.0 }, 'Sol (Solar System)');
              if (searchResults) searchResults.textContent = 'Teleported to Sol';
            }
            return;
          }
          if (searchResults) searchResults.textContent = `No matches for "${query}"`;
          return;
        }

        if (matches.length === 1 || query === matches[0].name?.toLowerCase()) {
          // Exact or single match — teleport
          const match = matches[0];
          const targetPos = match.isFeatureResult
            ? match.position
            : { x: match.x, y: match.y, z: match.z };
          const name = match.name || match.harrisId || '?';

          // "Near" mode: offset from the feature so you can see it
          const nearCheckbox = container.querySelector('#debug-search-near');
          const nearMode = nearCheckbox?.checked && match.isFeatureResult && match.radius;

          let teleportPos;
          if (nearMode) {
            // Calculate viewing distance: feature fills ~25° of the sky.
            // distance = radius / tan(12.5°) ≈ radius * 4.5
            // Minimum 0.005 kpc (5 pc) so you're not inside tiny objects.
            const viewDist = Math.max(match.radius * 4.5, 0.005);
            // Direction from feature toward galactic center,
            // so the glow is behind the feature, not in front of it.
            const dx = -(targetPos.x || 0);
            const dy = -(targetPos.y || 0);
            const dz = -(targetPos.z || 0);
            const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
            teleportPos = {
              x: (targetPos.x || 0) + (dx / d) * viewDist,
              y: (targetPos.y || 0) + (dy / d) * viewDist,
              z: (targetPos.z || 0) + (dz / d) * viewDist,
            };
            console.log(`[NEAR] Feature radius: ${(match.radius * 1000).toFixed(1)} pc, viewing dist: ${(viewDist * 1000).toFixed(1)} pc, angular size: ~${(2 * Math.atan(match.radius / viewDist) * 180 / Math.PI).toFixed(1)}°`);
          } else {
            teleportPos = targetPos;
          }

          if (this._spawnCallbacks?.teleportToPosition) {
            this._spawnCallbacks.teleportToPosition(teleportPos, name);

            // Store the target for reticle rendering
            this._searchTarget = {
              name,
              position: targetPos,
              radius: match.radius || 0,
              type: match.type || '',
            };
            // Set target marker after teleport completes (async — glow layer gets recreated)
            const highlightCb2 = container.querySelector('#debug-search-highlight');
            this._pendingHighlight = highlightCb2?.checked ? targetPos : null;

            const desc = match.isFeatureResult
              ? `${match.type}, r=${match.radius?.toFixed?.(4) ?? match.radius} kpc`
              : `${match.spect}-class, mag ${match.mag}`;
            const modeLabel = nearMode ? ' (nearby view)' : '';
            if (searchResults) searchResults.textContent = `→ ${name} (${desc})${modeLabel}`;
          }
        } else {
          // Multiple matches — show list
          const list = matches.slice(0, 5).map(s => {
            const name = s.name || s.harrisId || '?';
            return s.isFeatureResult ? `${name} (${s.type})` : `${name} (${s.spect}, mag ${s.mag})`;
          }).join(', ');
          if (searchResults) searchResults.textContent = `${matches.length} matches: ${list}`;
        }
      };

      searchBtn.addEventListener('click', doSearch);
      searchInput.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.code === 'Enter') doSearch();
      });

      // Highlight toggle — turn reticle on/off for current target
      const highlightCb = container.querySelector('#debug-search-highlight');
      if (highlightCb) {
        highlightCb.addEventListener('change', () => {
          if (window._glowLayer) {
            if (highlightCb.checked && this._searchTarget) {
              window._glowLayer.setTargetMarker(this._searchTarget.position);
            } else {
              window._glowLayer.setTargetMarker(null);
            }
          }
        });
      }
    }

    // Seed input
    const seedBtn = container.querySelector('#debug-seed-go');
    const seedInput = container.querySelector('#debug-seed-input');
    if (seedBtn && seedInput) {
      seedBtn.addEventListener('click', () => {
        const seed = seedInput.value.trim();
        if (seed && this._spawnCallbacks.spawnWithSeed) {
          this._spawnCallbacks.spawnWithSeed(seed);
          this.togglePanel();
        }
      });
      seedInput.addEventListener('keydown', (e) => {
        e.stopPropagation(); // prevent game keybinds from firing while typing
        if (e.code === 'Enter') seedBtn.click();
      });
    }

    // ── System-tags / save / probe (system-tags-save-search) ──

    // Save current system
    const saveBtn = container.querySelector('#debug-save-system');
    const saveStatus = container.querySelector('#debug-save-status');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        if (!this._currentNavStar || !this._systemData) {
          if (saveStatus) saveStatus.textContent = 'Warp or jump to a system first (faithful save needs its star snapshot).';
          return;
        }
        const tags = deriveSystemTags(this._systemData);
        const name = this._systemData?._knownSystemNames?.system || this._systemData?._warpTargetName || null;
        this._savedSystems.save({ navStarData: this._currentNavStar, tags, name });
        if (saveStatus) saveStatus.textContent = `Saved ${this._tagSummary(tags)}`;
        this._renderSavedList(container);
      });
    }

    // Run probe
    const probeBtn = container.querySelector('#debug-probe-run');
    const probeStatus = container.querySelector('#debug-probe-status');
    if (probeBtn) {
      probeBtn.addEventListener('click', () => {
        if (!this._galacticMap) { if (probeStatus) probeStatus.textContent = 'No galaxy map.'; return; }
        const center = this._playerPos ? { ...this._playerPos } : { x: 8, y: 0, z: 0 };
        const radiusKpc = parseFloat(container.querySelector('#debug-probe-radius')?.value) || 0.1;
        const scanDepth = container.querySelector('#debug-probe-depth')?.value || 'shallow';
        const filter = this._readProbeFilter(container);
        if (probeStatus) probeStatus.textContent = 'Scanning…';
        // Defer so the "Scanning…" paint lands before a deep scan blocks.
        setTimeout(() => {
          try {
            const region = { shape: 'radius', center, radiusKpc };
            this._probeResults = probeRegion(this._galacticMap, region, filter, { scanDepth });
            if (probeStatus) probeStatus.textContent = `${this._probeResults.length} match(es) in ${radiusKpc} kpc (${scanDepth}).`;
          } catch (err) {
            this._probeResults = [];
            if (probeStatus) probeStatus.textContent = `Probe error: ${err.message}`;
          }
          this._renderProbeResults(container);
        }, 0);
      });
    }

    // Result + saved-list actions (event delegation). Wire ONCE — `container`
    // (#debug-content) persists across panel re-populates, so attaching per
    // populate would accumulate duplicate handlers. Elements are re-queried at
    // click time because innerHTML is rebuilt on each open.
    if (!this._tagsDelegationWired) {
      this._tagsDelegationWired = true;
      const jumpTo = (nav) => {
        if (this._spawnCallbacks?.jumpToNavStar) {
          this._spawnCallbacks.jumpToNavStar(nav);
          this.togglePanel();
        }
      };
      container.addEventListener('click', (e) => {
        const t = e.target;
        if (!(t instanceof HTMLElement)) return;
        const ri = t.getAttribute('data-jump-result');
        const si = t.getAttribute('data-save-result');
        const js = t.getAttribute('data-jump-saved');
        const rm = t.getAttribute('data-remove-saved');
        const status = container.querySelector('#debug-probe-status');
        if (ri != null) {
          const r = this._probeResults[Number(ri)];
          if (r) jumpTo(r.navStarData);
        } else if (si != null) {
          const r = this._probeResults[Number(si)];
          if (r) {
            this._savedSystems.save({ navStarData: r.navStarData, tags: r.tags, name: null });
            this._renderSavedList(container);
            if (status) status.textContent = `Saved ${this._tagSummary(r.tags)}`;
          }
        } else if (js != null) {
          const entry = this._savedSystems.list().find(x => x.id === js);
          if (entry) jumpTo(entry.navStarData);
        } else if (rm != null) {
          this._savedSystems.remove(rm);
          this._renderSavedList(container);
        }
      });
    }

    // Saved-list filter + initial render
    const savedFilter = container.querySelector('#debug-saved-filter');
    if (savedFilter) savedFilter.addEventListener('change', () => this._renderSavedList(container));
    this._updateSaveButtonState();
    this._renderSavedList(container);
  }

  _row(label, value) {
    return `<span class="dg-label">${label}</span><span class="dg-val">${value}</span>`;
  }

  // ── System-tags / save / probe helpers (system-tags-save-search) ──

  /** Rows for the current system's derived tags. */
  _tagsRowsHtml() {
    if (!this._systemData) return this._row('Status', 'No system loaded');
    const t = deriveSystemTags(this._systemData);
    let h = '';
    h += this._row('Binary', t.isBinary ? 'Yes' : 'No');
    h += this._row('Star type', t.secondaryType ? `${t.primaryType}+${t.secondaryType}` : (t.primaryType ?? '?'));
    h += this._row('Planets', t.planetCount);
    h += this._row('Has rings', t.hasRings ? 'Yes' : 'No');
    h += this._row('Habitable', t.hasHabitable ? 'Yes' : 'No');
    h += this._row('Archetype', t.archetype ?? '—');
    return h;
  }

  /**
   * Re-render the system-dependent sections in place. Cheap (innerHTML of two
   * small grids + button state); called only on system/nav change while the
   * panel is open, never per frame.
   */
  _refreshLiveSections() {
    if (!this._panelVisible || !this._panelEl) return;
    const grid = this._panelEl.querySelector('#debug-tags-grid');
    if (grid) grid.innerHTML = this._tagsRowsHtml();
    const center = this._panelEl.querySelector('#debug-probe-center');
    if (center) center.textContent = this._probeCenterLabel();
    this._updateSaveButtonState();
  }

  _probeCenterLabel() {
    const p = this._playerPos;
    return p ? `(${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)})` : 'current position';
  }

  /** Enable the Save button only when a faithful snapshot exists; else grey it
   * out with a persistent reason (no more click-to-find-out-it-failed). */
  _updateSaveButtonState() {
    const btn = this._panelEl?.querySelector('#debug-save-system');
    const status = this._panelEl?.querySelector('#debug-save-status');
    if (!btn) return;
    const ok = !!(this._currentNavStar && this._systemData);
    btn.disabled = !ok;
    btn.style.opacity = ok ? '1' : '0.4';
    btn.style.cursor = ok ? 'pointer' : 'not-allowed';
    btn.title = ok ? '' : 'Warp or jump to a system first — a faithful save needs its star snapshot.';
    if (status && !ok) status.textContent = 'Save needs a warp/jump arrival (faithful star snapshot).';
    else if (status && ok && status.textContent.startsWith('Save needs')) status.textContent = '';
  }

  /** Short one-line tag summary for a result/saved row. */
  _tagSummary(t) {
    return tagSummary(t);
  }

  /** Read the probe tag-filter selects into a filter object. */
  _readProbeFilter(container) {
    const filter = {};
    const bin = container.querySelector('#debug-f-binary')?.value;
    if (bin === 'true') filter.isBinary = true;
    else if (bin === 'false') filter.isBinary = false;
    const ptype = container.querySelector('#debug-f-ptype')?.value;
    if (ptype) filter.primaryType = ptype;
    if (container.querySelector('#debug-f-rings')?.value === 'true') filter.hasRings = true;
    if (container.querySelector('#debug-f-hab')?.value === 'true') filter.hasHabitable = true;
    return filter;
  }

  /** Render probe results into the results container with Jump buttons. */
  _renderProbeResults(container) {
    const box = container.querySelector('#debug-probe-results');
    if (!box) return;
    const results = this._probeResults;
    if (!results.length) { box.innerHTML = ''; return; }
    let h = '';
    const shown = results.slice(0, 50);
    for (let i = 0; i < shown.length; i++) {
      const r = shown[i];
      h += `<span class="dg-label" title="seed ${r.navStarData.seed}">${this._tagSummary(r.tags)}</span>`;
      h += `<span class="dg-val"><button class="debug-btn" data-jump-result="${i}">jump</button> <button class="debug-btn" data-save-result="${i}">★</button></span>`;
    }
    box.innerHTML = h;
  }

  /** Render the saved-systems list (respecting the active filter) with Jump/✕. */
  _renderSavedList(container) {
    const box = container.querySelector('#debug-saved-list');
    if (!box) return;
    const filterKey = container.querySelector('#debug-saved-filter')?.value || '';
    const entries = filterKey ? this._savedSystems.filterByTag({ [filterKey]: true }) : this._savedSystems.list();
    if (!entries.length) { box.innerHTML = '<span class="dg-label">— none —</span><span class="dg-val"></span>'; return; }
    let h = '';
    for (const e of entries) {
      const label = e.name || this._tagSummary(e.tags);
      h += `<span class="dg-label" title="seed ${e.navStarData.seed}">${label}</span>`;
      h += `<span class="dg-val"><button class="debug-btn" data-jump-saved="${e.id}">jump</button> <button class="debug-btn" data-remove-saved="${e.id}">✕</button></span>`;
    }
    box.innerHTML = h;
  }
}
