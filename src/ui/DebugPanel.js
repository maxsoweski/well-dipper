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

    // Create DOM elements
    this._createHUD();
    this._createPanel();
  }

  // ── Data setters (called by main.js) ──

  setSystem(system, systemData) {
    this._system = system;
    this._systemData = systemData;
    this._stellarEvolution = systemData?.stellarEvolution || null;
  }

  setPlayerPos(pos) { this._playerPos = pos; }
  setCamera(cam) { this._camera = cam; }
  setSkyRenderer(sky) { this._skyRenderer = sky; }
  setLODManager(lod) { this._lodManager = lod; }
  setFocus(planetIndex, moonIndex) {
    this._focusIndex = planetIndex;
    this._focusMoonIndex = moonIndex;
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

    // Galactic position
    if (this._playerPos) {
      const p = this._playerPos;
      const R = Math.sqrt(p.x * p.x + p.z * p.z).toFixed(2);
      lines.push(`<span class="dh-label">GAL</span> <span class="dh-val">(${p.x.toFixed(1)}, ${p.y.toFixed(2)}, ${p.z.toFixed(1)}) R=${R}</span>`);
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
          <p class="debug-dismiss">F3 or ESC to close &nbsp; backtick (\`) toggles HUD</p>
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

    // ── Sky Renderer ──
    html += '<div class="debug-section"><h3>SKY RENDERER</h3><div class="debug-grid">';
    if (this._skyRenderer) {
      const cfg = this._skyRenderer._brightnessConfig;
      html += this._row('Glow range', `${cfg.glow.min.toFixed(2)} – ${cfg.glow.max.toFixed(2)}`);
      html += this._row('Feature range', `${cfg.features.min.toFixed(2)} – ${cfg.features.max.toFixed(2)}`);
      html += this._row('Star range', `${cfg.stars.min.toFixed(2)} – ${cfg.stars.max.toFixed(2)}`);
      const tint = this._skyRenderer.getAmbientTint();
      html += this._row('Ambient tint', tint ? `rgb(${Math.round(tint.r*255)},${Math.round(tint.g*255)},${Math.round(tint.b*255)}) ${(tint.strength*100).toFixed(0)}%` : 'none');
    }
    html += '</div></div>';

    // ── Quick Actions ──
    html += '<div class="debug-section"><h3>QUICK REFERENCE</h3><div class="debug-grid">';
    html += this._row('Shift+Q', 'Solar neighborhood (R=8)');
    html += this._row('Shift+R', 'Galactic center (R=0.5)');
    html += this._row('Shift+E', 'Above galaxy (h=6)');
    html += this._row('Shift+B', 'Galactic core (R=0.1)');
    html += this._row('Shift+1-7', 'Force destination type');
    html += this._row('Shift+0', 'Solar System (secret)');
    html += '</div></div>';

    el.innerHTML = html;
  }

  _updatePanel() {
    // Update FPS in panel header if visible
    // Full re-populate is too expensive per frame — just update the FPS
  }

  _row(label, value) {
    return `<span class="dg-label">${label}</span><span class="dg-val">${value}</span>`;
  }
}
